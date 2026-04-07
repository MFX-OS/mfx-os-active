'use strict';
// ═══════════════════════════════════════════════════════════════
// MFX OS — System-Wide Audit Logger
// SQF Ed.10 Clause 2.4.2 — Record keeping & traceability
//
// Captures all significant Firestore writes to _auditLog collection.
// Provides immutable audit trail for compliance, investigations,
// and regulatory audits.
// ═══════════════════════════════════════════════════════════════

(function() {
'use strict';

// ── Config ──
var AUDIT_COLLECTION = '_auditLog';
var BATCH_SIZE = 10;
var FLUSH_INTERVAL = 5000; // 5 seconds
var _auditQueue = [];
var _auditTimer = null;

// ── Collections that require audit logging ──
var AUDITED_COLLECTIONS = [
  'quotes', 'salesOrders', 'vendorPOs', 'jobTickets', 'ncrs',
  'customers', 'users', 'requests', 'passports',
  'sqfEscalations', 'sqfEvidence', 'dcrs', 'capaRecords',
  'shipments', 'spoilage', 'pestSightings', 'trainingSessions',
  'qualityHolds', 'sanitationLogs', 'gmpInspections',
  'controlledRecords', 'config'
];

// ── Core audit function ──
function auditWrite(action, collection, docId, data, opts) {
  opts = opts || {};
  if (AUDITED_COLLECTIONS.indexOf(collection) === -1 && !opts.force) return;

  var entry = {
    action: action,       // 'create', 'update', 'delete', 'approve', 'transition'
    collection: collection,
    docId: docId || '',
    timestamp: new Date().toISOString(),
    userId: typeof getUserId === 'function' ? getUserId() : 'unknown',
    userName: typeof getUserName === 'function' ? getUserName() : 'unknown',
    userEmail: typeof getUserEmail === 'function' ? getUserEmail() : '',
    dept: '',
    role: '',
    source: opts.source || 'client',
    summary: opts.summary || (action + ' ' + collection + '/' + (docId || '').slice(0, 8)),
    fieldChanges: opts.fields || null,  // optional: which fields changed
    previousValues: opts.prev || null,  // optional: previous values
    ip: '',  // set server-side if needed
    userAgent: navigator.userAgent.slice(0, 120)
  };

  // Get dept/role from profile
  if (typeof getMFXProfile === 'function') {
    var p = getMFXProfile();
    entry.dept = p.dept || '';
    entry.role = p.role || '';
  }

  _auditQueue.push(entry);

  // Flush if batch is full
  if (_auditQueue.length >= BATCH_SIZE) {
    _flushAuditQueue();
  } else if (!_auditTimer) {
    _auditTimer = setTimeout(_flushAuditQueue, FLUSH_INTERVAL);
  }
}

// ── Batch flush to Firestore ──
function _flushAuditQueue() {
  if (_auditTimer) { clearTimeout(_auditTimer); _auditTimer = null; }
  if (_auditQueue.length === 0) return;

  var batch = _auditQueue.splice(0, BATCH_SIZE);
  if (typeof fbDb === 'undefined') return;

  var fb = fbDb.batch();
  batch.forEach(function(entry) {
    var ref = fbDb.collection(AUDIT_COLLECTION).doc();
    fb.set(ref, entry);
  });

  fb.commit().catch(function(e) {
    console.warn('Audit log flush failed:', e.message);
    // Re-queue failed entries (cap at 100 to prevent memory leak)
    if (_auditQueue.length < 100) {
      _auditQueue = batch.concat(_auditQueue);
    }
  });

  // Continue flushing if more in queue
  if (_auditQueue.length > 0) {
    _auditTimer = setTimeout(_flushAuditQueue, 1000);
  }
}

// ── Convenience wrappers ──
function auditCreate(collection, docId, summary) {
  auditWrite('create', collection, docId, null, { summary: summary });
}

function auditUpdate(collection, docId, fields, summary) {
  auditWrite('update', collection, docId, null, { fields: fields, summary: summary });
}

function auditDelete(collection, docId, summary) {
  auditWrite('delete', collection, docId, null, { summary: summary });
}

function auditApprove(collection, docId, action, summary) {
  auditWrite('approve', collection, docId, null, { summary: summary || (action + ' on ' + collection + '/' + docId) });
}

function auditTransition(collection, docId, fromStatus, toStatus) {
  auditWrite('transition', collection, docId, null, {
    summary: collection + '/' + (docId || '').slice(0, 8) + ': ' + fromStatus + ' → ' + toStatus,
    fields: { status: { from: fromStatus, to: toStatus } }
  });
}

// ── Query audit log ──
function queryAuditLog(filters, limit) {
  limit = limit || 100;
  if (typeof fbDb === 'undefined') return Promise.resolve([]);

  var q = fbDb.collection(AUDIT_COLLECTION).orderBy('timestamp', 'desc');

  if (filters) {
    if (filters.collection) q = q.where('collection', '==', filters.collection);
    if (filters.docId) q = q.where('docId', '==', filters.docId);
    if (filters.userId) q = q.where('userId', '==', filters.userId);
    if (filters.action) q = q.where('action', '==', filters.action);
    if (filters.since) q = q.where('timestamp', '>=', filters.since);
  }

  return q.limit(limit).get().then(function(snap) {
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  });
}

// ── Render audit log viewer ──
function renderAuditLog(containerId, filters) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="padding:20px;color:var(--tx3)">Loading audit log...</div>';

  queryAuditLog(filters, 200).then(function(entries) {
    if (entries.length === 0) {
      el.innerHTML = '<div style="padding:20px;color:var(--tx3)">No audit entries found.</div>';
      return;
    }

    var h = '<div class="pn" style="padding:12px"><div class="stt">Audit Log (' + entries.length + ' entries)</div>';
    h += '<table class="tw" style="width:100%;font-size:11px"><thead><tr>';
    h += '<th>Time</th><th>User</th><th>Action</th><th>Collection</th><th>Doc</th><th>Summary</th>';
    h += '</tr></thead><tbody>';

    entries.forEach(function(e) {
      var actionColor = { create: 'var(--gn)', update: 'var(--ac)', delete: 'var(--rd)', approve: 'var(--or)', transition: 'var(--neon-purple)' }[e.action] || 'var(--tx3)';
      var time = e.timestamp ? new Date(e.timestamp).toLocaleString() : '';
      h += '<tr>';
      h += '<td style="white-space:nowrap">' + esc(time) + '</td>';
      h += '<td>' + esc(e.userName || '') + '</td>';
      h += '<td><span style="color:' + actionColor + ';font-weight:600">' + esc(e.action || '') + '</span></td>';
      h += '<td>' + esc(e.collection || '') + '</td>';
      h += '<td style="font-family:monospace;font-size:10px">' + esc((e.docId || '').slice(0, 10)) + '</td>';
      h += '<td>' + esc(e.summary || '') + '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div>';
    el.innerHTML = h;
  }).catch(function(err) {
    el.innerHTML = '<div style="padding:20px;color:var(--rd)">Audit log error: ' + esc(err.message) + '</div>';
  });
}

// ── Flush on page unload ──
window.addEventListener('beforeunload', function() {
  if (_auditQueue.length > 0) _flushAuditQueue();
});

// ── Expose API ──
window.MFXAudit = {
  log: auditWrite,
  create: auditCreate,
  update: auditUpdate,
  delete: auditDelete,
  approve: auditApprove,
  transition: auditTransition,
  query: queryAuditLog,
  render: renderAuditLog,
  flush: _flushAuditQueue,
  AUDITED_COLLECTIONS: AUDITED_COLLECTIONS
};

})();
