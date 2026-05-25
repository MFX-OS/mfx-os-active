'use strict';
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
