"""
apply-batch-5-fixes.py
======================
DATA-06 + DATA-07: Server-side triggers + immutable audit logging for the 5
collections that currently have no Firestore trigger:
  - salesOrders
  - jobPassports
  - blueprints
  - approvalRecords
  - plateAssets

Each new trigger:
  - Fires on every create/update/delete (onDocumentWritten)
  - Writes to /activity (server-attributed feed entry)
  - Writes to /_auditLog (immutable compliance log with field diff)
  - Detects status transitions and adds a status-history subdoc

Shared helper: functions/lib/auditWrite.js — keeps each trigger tiny + DRY.

Wires 5 new exports into functions/index.js so Firebase deploys them.

Usage:
  python3 scripts/audits/apply-batch-5-fixes.py
"""
import json
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch5')
os.makedirs(BACKUP_DIR, exist_ok=True)


def backup(rel):
    dst = os.path.join(BACKUP_DIR, rel.replace('/', '__').replace('\\', '__'))
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    if os.path.exists(rel):
        shutil.copy2(rel, dst)


def atomic_write(rel, content):
    os.makedirs(os.path.dirname(rel) or '.', exist_ok=True)
    tmp = rel + '.applying.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    os.replace(tmp, rel)


def read(rel):
    with open(rel, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def verify_js(rel):
    r = subprocess.run(['node', '--check', rel], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'{rel}: node --check FAILED:\n{r.stderr}')


# ============================================================
# Step 1: Shared audit helper (DATA-07 implementation core)
# ============================================================
AUDIT_HELPER = """'use strict';
// DATA-06 + DATA-07 (2026-05-24): Shared audit + activity writer for Firestore
// onDocumentWritten triggers. Each per-collection trigger delegates to this
// helper so the wire-up logic stays in one place.
//
// Writes TWO records per change:
//   1. /activity/{auto}      — human-readable feed entry (server-attributed)
//   2. /_auditLog/{auto}     — immutable compliance entry with field diff
//
// Status-tracked collections also write to a /<col>/{id}/statusHistory/{auto}
// subdoc when the status field changes.
//
// Loop-safety: we never write to /activity or /_auditLog from this helper in a
// way that would re-trigger any of the collection triggers (those only watch
// business-data paths).

const { getFirestore } = require('firebase-admin/firestore');

const STATUS_TRACKED_COLLECTIONS = new Set([
  'salesOrders', 'jobPassports', 'blueprints', 'approvalRecords',
]);

// Field-by-field shallow diff. Returns { fieldName: { from, to } } for changed
// keys. Ignores nested-object internal changes (we just record the new value as
// "to" and the old value as "from") to keep audit entries finite-size.
function computeDiff(before, after) {
  const diff = {};
  const beforeObj = before || {};
  const afterObj = after || {};
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  // Skip noisy / large / system fields
  const SKIP = new Set([
    'updatedAt', 'updatedBy', 'updatedById',
    'lastModifiedAt', 'lastModifiedBy', 'lastModifiedById',
    '_calSynced', 'searchBlob',
  ]);
  for (const k of allKeys) {
    if (SKIP.has(k)) continue;
    const a = beforeObj[k];
    const b = afterObj[k];
    let changed = false;
    if (a === undefined && b !== undefined) changed = true;
    else if (a !== undefined && b === undefined) changed = true;
    else if (typeof a !== typeof b) changed = true;
    else if (a !== b) {
      // For objects/arrays, do a quick JSON compare. Truncated values stored.
      try {
        if (JSON.stringify(a) !== JSON.stringify(b)) changed = true;
      } catch (_e) { changed = true; }
    }
    if (changed) {
      diff[k] = {
        from: typeof a === 'string' && a.length > 500 ? a.slice(0, 500) + '…' : a === undefined ? null : a,
        to:   typeof b === 'string' && b.length > 500 ? b.slice(0, 500) + '…' : b === undefined ? null : b,
      };
    }
  }
  return diff;
}

function actorOf(data) {
  if (!data) return { name: 'system', id: null };
  return {
    name: data.lastModifiedBy || data.updatedBy || data.createdBy || 'system',
    id:   data.lastModifiedById || data.updatedById || data.createdById || null,
  };
}

function humanName(collection, data, docId) {
  if (!data) return docId;
  return data.soNum || data.jobNum || data.quoteNum || data.passportNum
      || data.blueprintNum || data.recordNum || data.assetNum || data.name
      || docId;
}

/**
 * Write activity + audit entries for a Firestore document change.
 * @param {string} collection - top-level collection name
 * @param {object} event - the onDocumentWritten event
 * @param {object} [opts] - { displayName?: string, agentEnqueue?: function }
 */
async function writeAuditFromEvent(collection, event, opts) {
  opts = opts || {};
  const db = getFirestore();
  const beforeData = event.data.before.exists ? event.data.before.data() : null;
  const afterData  = event.data.after.exists  ? event.data.after.data()  : null;
  const docId      = event.params[Object.keys(event.params)[0]];

  let action;
  if (!beforeData && afterData) action = 'create';
  else if (beforeData && !afterData) action = 'delete';
  else if (beforeData && afterData) action = 'update';
  else return; // shouldn't happen

  // Determine actor (best effort — server triggers don't have request.auth)
  const actor = actorOf(afterData || beforeData);
  const at = new Date().toISOString();
  const name = humanName(collection, afterData || beforeData, docId);

  // 1) Activity feed
  try {
    const detail =
      action === 'create' ? `${collection} ${name} created` :
      action === 'delete' ? `${collection} ${name} deleted` :
                            `${collection} ${name} updated`;
    await db.collection('activity').add({
      action: `${collection}.${action}`,
      detail,
      user: actor.name,
      userId: actor.id,
      timestamp: at,
      source: 'server-trigger',
      collection,
      docId,
    });
  } catch (e) { console.error(`[audit ${collection}/${docId}] activity write failed:`, e); }

  // 2) Immutable audit log with field diff (only meaningful for update + delete)
  try {
    const auditEntry = {
      collection,
      docId,
      action,
      by: actor.name,
      byId: actor.id,
      at,
    };
    if (action === 'update') {
      auditEntry.changes = computeDiff(beforeData, afterData);
    } else if (action === 'delete') {
      auditEntry.snapshot = beforeData; // preserve last state for forensics
    } else if (action === 'create') {
      auditEntry.snapshot = afterData;
    }
    await db.collection('_auditLog').add(auditEntry);
  } catch (e) { console.error(`[audit ${collection}/${docId}] _auditLog write failed:`, e); }

  // 3) Status history subdoc (only for tracked collections + on status change)
  if (STATUS_TRACKED_COLLECTIONS.has(collection)
      && action === 'update'
      && beforeData && afterData
      && beforeData.status !== afterData.status) {
    try {
      await event.data.after.ref.collection('statusHistory').add({
        from: beforeData.status,
        to: afterData.status,
        by: actor.name,
        byId: actor.id,
        at,
      });
    } catch (e) { console.error(`[audit ${collection}/${docId}] statusHistory write failed:`, e); }
  }

  // 4) Optional agent enqueue hook (caller decides if/when)
  if (typeof opts.agentEnqueue === 'function') {
    try { await opts.agentEnqueue({ action, beforeData, afterData, docId, actor }); }
    catch (e) { console.error(`[audit ${collection}/${docId}] agent enqueue failed:`, e); }
  }
}

module.exports = { writeAuditFromEvent, computeDiff };
"""


# ============================================================
# Step 2: Per-collection trigger files (5 of them)
# ============================================================
def make_trigger(collection, doc_path, fn_name):
    return f"""'use strict';
// DATA-06 fix (2026-05-24): server trigger for the {collection} collection.
// Delegates to lib/auditWrite for activity + _auditLog + statusHistory writes.

const {{ onDocumentWritten }} = require('firebase-functions/v2/firestore');
const {{ writeAuditFromEvent }} = require('../../lib/auditWrite');

const handler = onDocumentWritten(
  {{ document: '{doc_path}', region: 'us-central1' }},
  async (event) => {{
    return writeAuditFromEvent('{collection}', event);
  }}
);

module.exports = {{ {fn_name}: handler }};
"""


TRIGGERS = [
    # (collection name, doc-path template, export function name, output filename)
    ('salesOrders',     'salesOrders/{soId}',       'onSalesOrderWrite',    'onSalesOrderWrite.js'),
    ('jobPassports',    'jobPassports/{passportId}', 'onJobPassportWrite',  'onJobPassportWrite.js'),
    ('blueprints',      'blueprints/{blueprintId}', 'onBlueprintWrite',     'onBlueprintWrite.js'),
    ('approvalRecords', 'approvalRecords/{docId}',  'onApprovalRecordWrite','onApprovalRecordWrite.js'),
    ('plateAssets',     'plateAssets/{assetId}',    'onPlateAssetWrite',    'onPlateAssetWrite.js'),
]


# ============================================================
# Step 3: Edit functions/index.js to wire the 5 new exports
# ============================================================
def patch_index_js():
    rel = 'functions/index.js'
    backup(rel)
    src = read(rel)

    # The import block we'll append after
    old_imports = '''const { onTrainingRecordWrite: aiOnTrainingRecordWrite } = require("./workflows/firestore/onTrainingRecordWrite");'''
    new_imports = '''const { onTrainingRecordWrite: aiOnTrainingRecordWrite } = require("./workflows/firestore/onTrainingRecordWrite");
// DATA-06 + DATA-07 fix (2026-05-24): server triggers for collections that
// previously had no server-side validation, derivation, or audit logging.
const { onSalesOrderWrite: aiOnSalesOrderWrite } = require("./workflows/firestore/onSalesOrderWrite");
const { onJobPassportWrite: aiOnJobPassportWrite } = require("./workflows/firestore/onJobPassportWrite");
const { onBlueprintWrite: aiOnBlueprintWrite } = require("./workflows/firestore/onBlueprintWrite");
const { onApprovalRecordWrite: aiOnApprovalRecordWrite } = require("./workflows/firestore/onApprovalRecordWrite");
const { onPlateAssetWrite: aiOnPlateAssetWrite } = require("./workflows/firestore/onPlateAssetWrite");'''
    if src.count(old_imports) != 1:
        raise RuntimeError('index.js: imports block not found')
    src = src.replace(old_imports, new_imports)

    old_exports = '''exports.aiOnTrainingRecordWrite = aiOnTrainingRecordWrite;'''
    new_exports = '''exports.aiOnTrainingRecordWrite = aiOnTrainingRecordWrite;
exports.aiOnSalesOrderWrite = aiOnSalesOrderWrite;
exports.aiOnJobPassportWrite = aiOnJobPassportWrite;
exports.aiOnBlueprintWrite = aiOnBlueprintWrite;
exports.aiOnApprovalRecordWrite = aiOnApprovalRecordWrite;
exports.aiOnPlateAssetWrite = aiOnPlateAssetWrite;'''
    if src.count(old_exports) != 1:
        raise RuntimeError('index.js: exports block not found')
    src = src.replace(old_exports, new_exports)

    atomic_write(rel, src)
    verify_js(rel)


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying BATCH 5 audit fixes (DATA-06 + DATA-07)...')
    print(f'Backup dir: {BACKUP_DIR}\n')

    # 1) Shared helper
    print('[helper] functions/lib/auditWrite.js')
    helper_path = 'functions/lib/auditWrite.js'
    if os.path.exists(helper_path):
        backup(helper_path)
    atomic_write(helper_path, AUDIT_HELPER)
    verify_js(helper_path)
    print(f'  OK ({os.path.getsize(helper_path):,} bytes)')

    # 2) Per-collection triggers
    for (collection, doc_path, fn_name, fname) in TRIGGERS:
        rel = f'functions/workflows/firestore/{fname}'
        print(f'[trigger] {collection} -> {rel}')
        if os.path.exists(rel):
            backup(rel)
        atomic_write(rel, make_trigger(collection, doc_path, fn_name))
        verify_js(rel)
        print(f'  OK')

    # 3) Wire into index.js
    print('[wire] functions/index.js')
    patch_index_js()
    print(f'  OK')

    print('\nAll BATCH 5 fixes applied.')
    print('\nNew function names to deploy:')
    for (collection, _, fn_name, _) in TRIGGERS:
        print(f'  ai{fn_name[0].upper()}{fn_name[1:]}  ({collection})')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
