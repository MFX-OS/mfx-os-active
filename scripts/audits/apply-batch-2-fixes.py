"""
apply-batch-2-fixes.py
======================
Apply the next round of HIGH-severity audit fixes via atomic writes.
Same safety pattern as apply-audit-fixes.py.

Fixes in this batch:
  SEC-03   storage.rules                          — path-scope portal-uploads by quoteId + email match + MIME allowlist
  DATA-04  functions/workflows/firestore/onQuoteWrite.js — handle every status transition, write history + activity
  DATA-05  functions/workflows/firestore/onQuoteWrite.js — server-recompute totalAmount from authoritative qty row

NOT included (handled separately):
  SEC-05  service-account JSONs                   — quarantined manually (bash mv); revoke in Firebase Console

Usage:
  python3 scripts/audits/apply-batch-2-fixes.py
"""
import json
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch2')
os.makedirs(BACKUP_DIR, exist_ok=True)


def backup(rel):
    dst = os.path.join(BACKUP_DIR, rel.replace('/', '__').replace('\\', '__'))
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    shutil.copy2(rel, dst)


def atomic_write(rel, content):
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


def replace_unique(content, needle, replacement, what):
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# ============================================================
# SEC-03 — storage.rules path-scope portal-uploads
# ============================================================
def fix_sec_03():
    print('[SEC-03] storage.rules: path-scoping portal-uploads')
    rel = 'storage.rules'
    backup(rel)
    src = read(rel)
    old = '''    // Portal uploads — any authenticated user (clients via email link verification)
    match /portal-uploads/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 25 * 1024 * 1024;
    }'''
    new = '''    // SEC-03 fix (2026-05-24): Portal uploads scoped by {quoteId} in the path.
    // Read/write only by company users OR the portal client whose email matches
    // the quote's poClientEmail / fields.custEmail. MIME allowlist + 25MB cap.
    // Uses firestore.get() — costs 1 Firestore read per access; acceptable trade
    // for cross-tenant isolation. NOTE: client upload code must put quoteId as
    // the first path segment for new uploads (e.g. portal-uploads/QUO123/file.pdf).
    match /portal-uploads/{quoteId}/{allPaths=**} {
      allow read: if request.auth != null && (
        companyUser() ||
        (request.auth.token.email != null &&
          firestore.get(/databases/(default)/documents/quotes/$(quoteId)).data.get('poClientEmail', '') == request.auth.token.email) ||
        (request.auth.token.email != null &&
          firestore.get(/databases/(default)/documents/quotes/$(quoteId)).data.get('fields', {}).get('custEmail', '') == request.auth.token.email)
      );
      allow write: if request.auth != null
        && request.resource.size < 25 * 1024 * 1024
        && (request.resource.contentType.matches('application/pdf')
            || request.resource.contentType.matches('image/.*')
            || request.resource.contentType.matches('application/.*zip.*')
            || request.resource.contentType.matches('application/octet-stream')
            || request.resource.contentType.matches('application/vnd\\\\..*office.*')
            || request.resource.contentType.matches('text/.*'))
        && (
          companyUser() ||
          (request.auth.token.email != null &&
            firestore.get(/databases/(default)/documents/quotes/$(quoteId)).data.get('poClientEmail', '') == request.auth.token.email) ||
          (request.auth.token.email != null &&
            firestore.get(/databases/(default)/documents/quotes/$(quoteId)).data.get('fields', {}).get('custEmail', '') == request.auth.token.email)
        );
    }
    // Legacy un-scoped portal files (uploaded before SEC-03 fix). Company users
    // can still read; writes are blocked so no new files end up un-scoped.
    match /portal-uploads/{allPaths=**} {
      allow read: if companyUser();
      allow write: if false;
    }'''
    new_src = replace_unique(src, old, new, 'storage.rules portal-uploads')
    atomic_write(rel, new_src)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# DATA-04 + DATA-05 — onQuoteWrite.js full rewrite
# ============================================================
def fix_data_04_05():
    print('[DATA-04 + DATA-05] onQuoteWrite.js: status workflow + server-side totals')
    rel = 'functions/workflows/firestore/onQuoteWrite.js'
    backup(rel)
    new_content = """'use strict';
// DATA-04 + DATA-05 fix (2026-05-24): expanded quote-write trigger.
//
// Responsibilities:
//   1. Detect every status transition (not just → sent)
//   2. Write an immutable statusHistory subdoc on every status change
//   3. Write an activity log row (server-attributed, not client-trusted)
//   4. Recompute totalAmount from the authoritative qtys[selectedQtyIndex] row,
//      overriding whatever the client wrote (prevents tampering / drift)
//   5. Enqueue quoteAgent for actionable transitions (sent/approved/rejected/expired/accepted)
//
// Loop-safety: the trigger writes back to the same doc only if a real change
// is needed (totalAmount differs). Repeat fire has nothing to patch → no loop.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

// Statuses that trigger an agent run on entry
const AGENT_TRIGGER_STATUSES = ['sent', 'approved', 'rejected', 'expired', 'accepted'];

// Compute the canonical total from a quote's qtys array + selected index.
// Returns null if we can't compute (missing qtys, invalid index, NaN values).
function getCanonicalTotal(quote) {
  if (!quote || !Array.isArray(quote.qtys) || quote.qtys.length === 0) return null;
  let idx = quote.selectedQtyIndex;
  if (typeof idx !== 'number' || idx < 0 || idx >= quote.qtys.length) idx = 0;
  const row = quote.qtys[idx];
  if (!row) return null;
  // Prefer the row's explicit `total`; fall back to qty * ppu
  if (typeof row.total === 'number' && Number.isFinite(row.total)) return row.total;
  const qty = parseFloat(row.qty);
  const ppu = parseFloat(row.ppu);
  if (Number.isFinite(qty) && Number.isFinite(ppu)) return qty * ppu;
  return null;
}

const handler = onDocumentWritten(
  { document: 'quotes/{quoteId}', region: 'us-central1' },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    const quoteId = event.params.quoteId;

    // Deletion: log it, but nothing else to recompute
    if (!afterData) {
      try {
        const db = getFirestore();
        await db.collection('activity').add({
          action: 'quote.deleted',
          detail: `Quote ${(beforeData && beforeData.quoteNum) || quoteId} deleted`,
          user: (beforeData && beforeData.lastModifiedBy) || 'unknown',
          timestamp: new Date().toISOString(),
          source: 'server-trigger',
          quoteId,
        });
      } catch (e) { console.error(`Quote ${quoteId} delete activity log:`, e); }
      return;
    }

    const db = getFirestore();
    const beforeStatus = beforeData ? beforeData.status : null;
    const afterStatus = afterData.status;
    const statusChanged = beforeStatus !== afterStatus;

    // DATA-05: server-recompute totalAmount — overrides whatever client wrote.
    // Loop-safety: only write back if value actually differs.
    const canonical = getCanonicalTotal(afterData);
    const patch = {};
    if (canonical != null && canonical !== afterData.totalAmount) {
      patch.totalAmount = canonical;
      patch.totalValue = canonical; // legacy field — keep in sync
    }
    if (Object.keys(patch).length) {
      try {
        await event.data.after.ref.update(patch);
        console.log(`Quote ${quoteId}: server-recompute totalAmount ${afterData.totalAmount} -> ${canonical}`);
      } catch (e) {
        console.error(`Quote ${quoteId} total patch failed:`, e);
      }
    }

    // DATA-04: status workflow — only fire when status actually changed.
    if (statusChanged) {
      const actor = afterData.lastModifiedBy || afterData.updatedBy || 'system';
      const actorId = afterData.lastModifiedById || afterData.updatedById || null;
      const at = new Date().toISOString();
      const effectiveAmount = (patch.totalAmount != null ? patch.totalAmount : (afterData.totalAmount || afterData.totalValue || null));

      // 1. Immutable status history subdoc (auditable record of every transition)
      try {
        await event.data.after.ref.collection('statusHistory').add({
          from: beforeStatus,
          to: afterStatus,
          by: actor,
          byId: actorId,
          at,
          customerName: afterData.customerName || null,
          quoteNum: afterData.quoteNum || null,
          amount: effectiveAmount,
        });
      } catch (e) { console.error(`Quote ${quoteId} statusHistory write failed:`, e); }

      // 2. Activity log entry (server-attributed — client can't fake source)
      try {
        await db.collection('activity').add({
          action: `quote.status.${afterStatus || 'cleared'}`,
          detail: `Quote ${afterData.quoteNum || quoteId}: ${beforeStatus || '(new)'} -> ${afterStatus || '(cleared)'}`,
          user: actor,
          userId: actorId,
          timestamp: at,
          source: 'server-trigger',
          quoteId,
          customerName: afterData.customerName || null,
          amount: effectiveAmount,
        });
      } catch (e) { console.error(`Quote ${quoteId} activity log failed:`, e); }

      // 3. Agent enqueue for actionable transitions
      if (AGENT_TRIGGER_STATUSES.indexOf(afterStatus) >= 0) {
        try {
          await enqueue('quoteAgent', `quote_${afterStatus}`, {
            sourceCollection: 'quotes',
            sourceId: quoteId,
            customerName: afterData.customerName || null,
            amount: effectiveAmount,
            previousStatus: beforeStatus,
          });
        } catch (e) { console.error(`Quote ${quoteId} agent enqueue failed:`, e); }
      }

      console.log(`Quote ${quoteId}: ${beforeStatus || '(new)'} -> ${afterStatus} by ${actor}`);
    }

    // Note: overdue quote detection still handled by scheduled overdueQuoteSweep
  }
);

module.exports = { onQuoteWrite: handler };
"""
    atomic_write(rel, new_content)
    verify_js(rel)
    print(f'  OK ({os.path.getsize(rel):,} bytes)')


# ============================================================
# RUN
# ============================================================
def main():
    print(f'Applying BATCH 2 audit fixes...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_sec_03()
    fix_data_04_05()
    print('\nAll BATCH 2 fixes applied.')
    print('Files touched:')
    for rel in ['storage.rules', 'functions/workflows/firestore/onQuoteWrite.js']:
        print(f'  {rel}: {os.path.getsize(rel):,} bytes')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
