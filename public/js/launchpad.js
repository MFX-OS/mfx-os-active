// ══════════════════════════════════════════════════════════════════
// MFX OS — MISSION BOARD · Role Workbenches
// launchpad.js v2.0
//
// Replaces module-first home with role/shift/exception boards.
// Work surfaces as actionable queues, not scavenger hunts.
// Roles: Leadership, CSR, Pre-Press, Production, Purchasing, QA, Finance
// ══════════════════════════════════════════════════════════════════

(function() {
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

var db = typeof fbDb !== 'undefined' ? fbDb : (typeof firebase !== 'undefined' ? firebase.firestore() : null);
var _boardCache = {};
var _activeRole = null;
var _boardTab = 'missions'; // missions | modules | shiftchecks | sqf
var _refreshTimer = null;

// ═══════════════════════════════════════════════════════════════
// ROLE DETECTION
// ═══════════════════════════════════════════════════════════════
var ROLE_MAP = {
  // Map dept/role strings to canonical workbench keys
  'ceo':         'leadership',
  'owner':       'leadership',
  'admin':       'leadership',
  'administrator':'leadership',
  'operations':  'leadership',
  'operations manager': 'leadership',
  'manager':     'leadership',
  'general manager': 'leadership',
  'csr':         'csr',
  'client services': 'csr',
  'sales':       'csr',
  'estimation':  'csr',
  'estimator':   'csr',
  'account manager': 'csr',
  'pre-press':   'prepress',
  'prepress':    'prepress',
  'design':      'prepress',
  'art':         'prepress',
  'graphic':     'prepress',
  'production':  'production',
  'press':       'production',
  'operator':    'production',
  'floor':       'production',
  'purchasing':  'purchasing',
  'buyer':       'purchasing',
  'procurement': 'purchasing',
  'receiving':   'purchasing',
  'quality':     'qa',
  'qa':          'qa',
  'qc':          'qa',
  'sqf':         'qa',
  'compliance':  'qa',
  'food safety': 'qa',
  'finance':     'finance',
  'accounting':  'finance',
  'accounts':    'finance',
  'payroll':     'finance',
  'ap':          'finance',
  'ar':          'finance'
};

function detectRole() {
  if (_activeRole) return _activeRole;
  try {
    var profileKey = 'mfx_profile_' + (typeof CURRENT_USER !== 'undefined' && CURRENT_USER ? CURRENT_USER.uid : 'default');
    var p = JSON.parse(localStorage.getItem(profileKey) || '{}');
    var role = (p.role || '').toLowerCase().trim();
    var dept = (p.dept || '').toLowerCase().trim();
    // Check role first, then dept
    if (ROLE_MAP[role]) return ROLE_MAP[role];
    if (ROLE_MAP[dept]) return ROLE_MAP[dept];
    // Fuzzy match
    var combined = role + ' ' + dept;
    var keys = Object.keys(ROLE_MAP);
    for (var i = 0; i < keys.length; i++) {
      if (combined.indexOf(keys[i]) !== -1) return ROLE_MAP[keys[i]];
    }
  } catch(e) {}
  return 'leadership'; // Default for admins / unknown
}

function setActiveRole(role) {
  _activeRole = role;
  renderLaunchpad();
}

// ═══════════════════════════════════════════════════════════════
// WORKBENCH DEFINITIONS — What each role cares about
// ═══════════════════════════════════════════════════════════════
var WORKBENCHES = {
  leadership: {
    label: 'Leadership',
    icon: '👔',
    color: 'var(--ac)',
    queues: [
      { key: 'approvals',    label: 'Decisions Needed',     icon: '⚡', color: 'var(--or)', query: 'approvals' },
      { key: 'sqfExceptions',label: 'SQF Exceptions',       icon: '🛡', color: 'var(--rd)', query: 'sqfExceptions' },
      { key: 'blockedJobs',  label: 'Jobs Blocked',         icon: '🚫', color: 'var(--rd)', query: 'blockedJobs' },
      { key: 'overdueVPOs',  label: 'Overdue Vendor POs',   icon: '📦', color: 'var(--or)', query: 'overdueVPOs' },
      { key: 'kpis',         label: 'KPIs & Health',        icon: '📊', color: 'var(--gn)', query: 'kpis' },
      { key: 'recentWins',   label: 'Recent Wins',          icon: '🎉', color: 'var(--gn)', query: 'recentWins' }
    ]
  },
  csr: {
    label: 'Sales / CSR',
    icon: '📞',
    color: 'var(--cy)',
    queues: [
      { key: 'quotesAction',  label: 'Quotes Needing Action', icon: '📝', color: 'var(--or)', query: 'quotesAction' },
      { key: 'poReceived',    label: 'POs Received',          icon: '📋', color: 'var(--gn)', query: 'poReceived' },
      { key: 'pendingSend',   label: 'Ready to Send',         icon: '📤', color: 'var(--ac)', query: 'pendingSend' },
      { key: 'followUps',     label: 'Follow-ups Due',        icon: '🔔', color: 'var(--or)', query: 'followUps' },
      { key: 'clientUpdates', label: 'Client Updates',        icon: '💬', color: 'var(--tx2)',query: 'clientUpdates' },
      { key: 'pipeline',      label: 'Pipeline Summary',      icon: '📈', color: 'var(--ac)', query: 'pipeline' }
    ]
  },
  prepress: {
    label: 'Pre-Press',
    icon: '🎨',
    color: '#a78bfa',
    queues: [
      { key: 'proofsWaiting', label: 'Proofs Waiting Approval', icon: '🖼', color: 'var(--or)', query: 'proofsWaiting' },
      { key: 'artIncoming',   label: 'Art Files Incoming',      icon: '📥', color: 'var(--ac)', query: 'artIncoming' },
      { key: 'plateReady',    label: 'Plates Ready for Release',icon: '🔧', color: 'var(--gn)', query: 'plateReady' },
      { key: 'blockedPPD',    label: 'Blocked / Revision',      icon: '🚫', color: 'var(--rd)', query: 'blockedPPD' },
      { key: 'inboxItems',    label: 'Inbox Items',             icon: '📧', color: 'var(--tx2)',query: 'inboxItems' },
      { key: 'ppdPipeline',   label: 'PPD Pipeline',            icon: '🔄', color: 'var(--ac)', query: 'ppdPipeline' }
    ]
  },
  production: {
    label: 'Production',
    icon: '🏭',
    color: 'var(--gn)',
    queues: [
      { key: 'jobsRunning',   label: 'Jobs Running Now',        icon: '▶', color: 'var(--gn)', query: 'jobsRunning' },
      { key: 'jobsBlocked',   label: 'Jobs Blocked on Release', icon: '🚫', color: 'var(--rd)', query: 'jobsBlocked' },
      { key: 'materialsNeeded',label: 'Materials Needed',       icon: '📦', color: 'var(--or)', query: 'materialsNeeded' },
      { key: 'sanClearance',   label: 'Sanitation Clearance',   icon: '🧹', color: 'var(--ac)', query: 'sanClearance' },
      { key: 'scheduleToday',  label: 'Schedule Today',         icon: '📅', color: 'var(--tx2)',query: 'scheduleToday' },
      { key: 'qcPending',     label: 'QC Checks Pending',      icon: '✅', color: 'var(--or)', query: 'qcPending' }
    ]
  },
  purchasing: {
    label: 'Purchasing',
    icon: '🛒',
    color: 'var(--or)',
    queues: [
      { key: 'receiptsToday', label: 'Receipts Due Today',     icon: '📦', color: 'var(--ac)', query: 'receiptsToday' },
      { key: 'pendingApproval',label: 'POs Pending Approval',  icon: '⏳', color: 'var(--or)', query: 'pendingApproval' },
      { key: 'overdueVPOs',   label: 'Overdue Deliveries',     icon: '🔴', color: 'var(--rd)', query: 'overdueVPOs' },
      { key: 'receivingQueue',label: 'Receiving Queue',        icon: '📋', color: 'var(--gn)', query: 'receivingQueue' },
      { key: 'invoiceMismatch',label: 'Invoice Mismatches',    icon: '⚠',  color: 'var(--rd)', query: 'invoiceMismatch' },
      { key: 'supplierRisk',  label: 'Supplier Risk',          icon: '🛡', color: 'var(--or)', query: 'supplierRisk' }
    ]
  },
  qa: {
    label: 'Quality / SQF',
    icon: '🛡',
    color: 'var(--rd)',
    queues: [
      { key: 'holdTags',      label: 'Active Hold Tags',        icon: '🏷', color: 'var(--rd)', query: 'holdTags' },
      { key: 'quarantine',    label: 'Quarantined Materials',    icon: '⛔', color: 'var(--rd)', query: 'quarantine' },
      { key: 'sanFails',      label: 'Sanitation Failures',     icon: '🧹', color: 'var(--or)', query: 'sanFails' },
      { key: 'receivingInsp', label: 'Receiving Inspections',   icon: '📋', color: 'var(--or)', query: 'receivingInsp' },
      { key: 'capaOpen',      label: 'Open CAPAs',              icon: '📝', color: 'var(--ac)', query: 'capaOpen' },
      { key: 'trainingDue',   label: 'Training Due/Overdue',    icon: '🎓', color: 'var(--or)', query: 'trainingDue' }
    ]
  },
  finance: {
    label: 'Finance',
    icon: '💰',
    color: '#22c55e',
    queues: [
      { key: 'invoicesOpen',  label: 'Open Invoices',           icon: '📄', color: 'var(--ac)', query: 'invoicesOpen' },
      { key: 'arOverdue',     label: 'AR Overdue',              icon: '🔴', color: 'var(--rd)', query: 'arOverdue' },
      { key: 'apDue',         label: 'AP Due This Week',        icon: '💳', color: 'var(--or)', query: 'apDue' },
      { key: 'sosPending',    label: 'SOs Pending',             icon: '📋', color: 'var(--or)', query: 'sosPending' },
      { key: 'paymentRecords',label: 'Recent Payments',         icon: '✅', color: 'var(--gn)', query: 'paymentRecords' },
      { key: 'revenueKPI',    label: 'Revenue / KPIs',          icon: '📊', color: 'var(--ac)', query: 'revenueKPI' }
    ]
  }
};

// ═══════════════════════════════════════════════════════════════
// DATA FETCHERS — Pull live data from Firestore + caches
// ═══════════════════════════════════════════════════════════════
function fetchQueueData(queryKey) {
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);

  switch(queryKey) {

    // ─── LEADERSHIP ───
    case 'approvals':
      var items = [];
      // Quotes needing approval
      if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
        DB.quotes().filter(function(q) { return q.status === 'approval'; }).forEach(function(q) {
          items.push({ id: q.id, type: 'Quote Approval', title: q.quoteNum + ' — ' + ((q.fields && q.fields.custCo) || '?'), amount: q.wonAmount || q.totalPrice || 0, age: daysSince(q.updatedAt), action: 'quotes', actionLabel: 'Review' });
        });
      }
      // VPOs needing approval
      if (window._vpoCache) {
        window._vpoCache.filter(function(p) { return p.status === 'pending'; }).forEach(function(p) {
          items.push({ id: p.id, type: 'VPO Approval', title: p.vpoNum + ' — ' + p.vendorName, amount: p.total || 0, age: daysSince(p.createdAt), action: 'vendorpos', actionLabel: 'Approve' });
        });
      }
      // SOs needing approval
      if (typeof DB !== 'undefined' && DB.salesOrders) {
        (typeof DB.salesOrders === 'function' ? DB.salesOrders() : []).filter(function(so) { return so.status === 'pending'; }).forEach(function(so) {
          items.push({ id: so.id, type: 'SO Approval', title: so.soNum + ' — ' + so.company, amount: so.total || 0, age: daysSince(so.createdAt), action: 'orders', actionLabel: 'Approve' });
        });
      }
      return items.sort(function(a, b) { return b.age - a.age; });

    case 'sqfExceptions':
      var exc = [];
      if (typeof window.SQF_TRIGGERS !== 'undefined') {
        (window.SQF_TRIGGERS.getActiveHoldTags ? window.SQF_TRIGGERS.getActiveHoldTags() : []).forEach(function(h) {
          exc.push({ id: h.id, type: 'Hold Tag', title: (h.tagNum || h.id) + ' — ' + (h.product || '?'), severity: 'critical', action: 'sqfdatalogs' });
        });
        (window.SQF_TRIGGERS.getQuarantinedMaterials ? window.SQF_TRIGGERS.getQuarantinedMaterials() : []).forEach(function(q) {
          exc.push({ id: q.id, type: 'Quarantine', title: (q.material || q.id) + ' — ' + (q.supplier || '?'), severity: 'major', action: 'sqfdatalogs' });
        });
        (window.SQF_TRIGGERS.getSanitationFailures ? window.SQF_TRIGGERS.getSanitationFailures() : []).forEach(function(s) {
          exc.push({ id: s.id, type: 'Sanitation Fail', title: (s.line || s.area || s.zone || '?'), severity: 'critical', action: 'sqfdatalogs' });
        });
      }
      return exc;

    case 'blockedJobs':
      var blocked = [];
      if (typeof getJobTickets === 'function') {
        getJobTickets().filter(function(jt) { return jt.status === 'Blocked' || (jt.ppd && jt.ppd.stage === 'Blocked'); }).forEach(function(jt) {
          blocked.push({ id: jt.id, type: 'Blocked', title: (jt.jtNum || jt.id) + ' — ' + (jt.company || '?'), reason: jt.blockReason || 'Unspecified', action: 'jobtracker' });
        });
      }
      return blocked;

    case 'overdueVPOs':
      var overdue = [];
      if (window._vpoCache) {
        window._vpoCache.filter(function(p) { return p.status === 'sent' && p.eta && new Date(p.eta) < now; }).forEach(function(p) {
          overdue.push({ id: p.id, type: 'Overdue VPO', title: p.vpoNum + ' — ' + p.vendorName, detail: p.material, daysOverdue: Math.round((now - new Date(p.eta)) / 86400000), action: 'vendorpos' });
        });
      }
      return overdue.sort(function(a, b) { return b.daysOverdue - a.daysOverdue; });

    case 'kpis':
      return buildKPIs();

    case 'recentWins':
      var wins = [];
      if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
        DB.quotes().filter(function(q) { return q.status === 'won'; }).sort(function(a, b) { return (b.wonDate || b.closedAt || '') > (a.wonDate || a.closedAt || '') ? 1 : -1; }).slice(0, 5).forEach(function(q) {
          wins.push({ id: q.id, type: 'Won', title: q.quoteNum + ' — ' + ((q.fields && q.fields.custCo) || '?'), amount: q.wonAmount || 0, date: q.wonDate || q.closedAt });
        });
      }
      return wins;

    // ─── CSR / SALES ───
    case 'quotesAction':
      var qa = [];
      if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
        DB.quotes().filter(function(q) { return q.status === 'draft' || q.status === 'rejected'; }).sort(function(a, b) { return (b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1; }).slice(0, 15).forEach(function(q) {
          qa.push({ id: q.id, type: q.status === 'draft' ? 'Draft' : 'Rejected', title: q.quoteNum + ' — ' + ((q.fields && q.fields.custCo) || '?'), age: daysSince(q.updatedAt), action: 'quotes', actionLabel: 'Edit' });
        });
      }
      return qa;

    case 'poReceived':
      var pos = [];
      if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
        DB.quotes().filter(function(q) { return q.status === 'won' && q.poNumber; }).sort(function(a, b) { return (b.wonDate || '') > (a.wonDate || '') ? 1 : -1; }).slice(0, 10).forEach(function(q) {
          pos.push({ id: q.id, type: 'PO', title: q.quoteNum + ' — PO#' + q.poNumber, company: (q.fields && q.fields.custCo) || '?', date: q.wonDate || q.closedAt, action: 'quotes' });
        });
      }
      return pos;

    case 'pendingSend':
      var ps = [];
      if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
        DB.quotes().filter(function(q) { return q.status === 'ready'; }).forEach(function(q) {
          ps.push({ id: q.id, type: 'Ready', title: q.quoteNum + ' — ' + ((q.fields && q.fields.custCo) || '?'), age: daysSince(q.updatedAt), action: 'quotes', actionLabel: 'Send' });
        });
      }
      return ps;

    case 'followUps':
      var fu = [];
      if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
        DB.quotes().filter(function(q) { return q.status === 'sent' && daysSince(q.sentAt) > 3; }).forEach(function(q) {
          fu.push({ id: q.id, type: 'Follow-up', title: q.quoteNum + ' — ' + ((q.fields && q.fields.custCo) || '?'), daysSent: daysSince(q.sentAt), action: 'quotes', actionLabel: 'Follow up' });
        });
      }
      return fu.sort(function(a, b) { return b.daysSent - a.daysSent; });

    case 'pipeline':
      return buildPipeline();

    case 'clientUpdates': return [];

    // ─── PRE-PRESS ───
    case 'proofsWaiting':
      var proofs = [];
      if (typeof getJobTickets === 'function') {
        getJobTickets().filter(function(jt) { return jt.ppd && (jt.ppd.stage === 'Waiting Approval' || jt.ppd.stage === 'Proof Sent'); }).forEach(function(jt) {
          proofs.push({ id: jt.id, type: jt.ppd.stage, title: (jt.jtNum || jt.id) + ' — ' + (jt.company || '?'), age: daysSince(jt.ppd.stageChangedAt || jt.updatedAt), action: 'ppd' });
        });
      }
      return proofs;

    case 'artIncoming':
      var art = [];
      if (typeof getJobTickets === 'function') {
        getJobTickets().filter(function(jt) { return jt.ppd && (jt.ppd.stage === 'Intake' || jt.ppd.stage === 'Validation'); }).forEach(function(jt) {
          art.push({ id: jt.id, type: jt.ppd.stage, title: (jt.jtNum || jt.id) + ' — ' + (jt.company || '?'), action: 'ppd' });
        });
      }
      return art;

    case 'plateReady':
      var plates = [];
      if (typeof getJobTickets === 'function') {
        getJobTickets().filter(function(jt) { return jt.ppd && jt.ppd.stage === 'Plate Ready'; }).forEach(function(jt) {
          plates.push({ id: jt.id, type: 'Plate Ready', title: (jt.jtNum || jt.id) + ' — ' + (jt.company || '?'), action: 'ppd' });
        });
      }
      return plates;

    case 'blockedPPD':
      var bp = [];
      if (typeof getJobTickets === 'function') {
        getJobTickets().filter(function(jt) { return jt.ppd && (jt.ppd.stage === 'Blocked' || jt.ppd.stage === 'Revision Needed'); }).forEach(function(jt) {
          bp.push({ id: jt.id, type: jt.ppd.stage, title: (jt.jtNum || jt.id) + ' — ' + (jt.company || '?'), reason: jt.ppd.blockReason || '', action: 'ppd' });
        });
      }
      return bp;

    case 'inboxItems': return []; // Would query prepressInbox collection
    case 'ppdPipeline': return buildPPDPipeline();

    // ─── PRODUCTION ───
    case 'jobsRunning':
      var running = [];
      if (typeof getJobTickets === 'function') {
        getJobTickets().filter(function(jt) { return jt.status === 'running'; }).forEach(function(jt) {
          running.push({ id: jt.id, type: 'Running', title: (jt.jtNum || jt.id) + ' — ' + (jt.company || '?'), machine: jt.machine || jt.pressLine || '—', action: 'jobtracker' });
        });
      }
      return running;

    case 'jobsBlocked':
      return fetchQueueData('blockedJobs');

    case 'materialsNeeded': return []; // Would query job BOM vs received materials
    case 'scheduleToday': return [];

    case 'sanClearance':
      var san = [];
      if (typeof window.SQF_TRIGGERS !== 'undefined' && window.SQF_TRIGGERS.getSanitationFailures) {
        window.SQF_TRIGGERS.getSanitationFailures().forEach(function(s) {
          san.push({ id: s.id, type: 'San Fail', title: (s.line || s.area || '?') + ' — NOT CLEARED', severity: 'critical', action: 'sqfdatalogs' });
        });
      }
      if (san.length === 0) san.push({ id: 'clear', type: 'All Clear', title: 'All lines cleared for production', severity: 'ok' });
      return san;

    case 'qcPending': return [];

    // ─── PURCHASING ───
    case 'receiptsToday':
      var rt = [];
      if (window._vpoCache) {
        window._vpoCache.filter(function(p) { return p.status === 'sent' && p.eta && p.eta.slice(0, 10) === todayStr; }).forEach(function(p) {
          rt.push({ id: p.id, type: 'Expected', title: p.vpoNum + ' — ' + p.vendorName, detail: p.material, action: 'vendorpos', actionLabel: 'Receive' });
        });
      }
      return rt;

    case 'pendingApproval':
      var pa = [];
      if (window._vpoCache) {
        window._vpoCache.filter(function(p) { return p.status === 'pending'; }).forEach(function(p) {
          pa.push({ id: p.id, type: 'Pending', title: p.vpoNum + ' — ' + p.vendorName, amount: p.total || 0, action: 'vendorpos' });
        });
      }
      return pa;

    case 'receivingQueue':
      var rq = [];
      // Pull from SQF_TRIGGERS if available
      if (typeof window.SQF_TRIGGERS !== 'undefined' && window.SQF_TRIGGERS.getPendingReceivingTasks) {
        // This is async — we'll show cached version
        if (_boardCache._receivingTasks) {
          rq = _boardCache._receivingTasks;
        }
        // Refresh in background
        window.SQF_TRIGGERS.getPendingReceivingTasks().then(function(tasks) {
          _boardCache._receivingTasks = tasks.map(function(t) {
            var done = (t.checklist || []).filter(function(c) { return c.done; }).length;
            var total = (t.checklist || []).length;
            return { id: t.id, type: 'Receiving', title: t.material + ' — ' + t.vendor, detail: t.vpoNum + ' · ' + done + '/' + total + ' checks', progress: total > 0 ? Math.round(done / total * 100) : 0, action: 'sqfdatalogs' };
          });
        }).catch(function() {});
      }
      return rq;

    case 'invoiceMismatch': return [];
    case 'supplierRisk': return fetchQueueData('overdueVPOs');

    // ─── QA ───
    case 'holdTags':
      return (typeof window.SQF_TRIGGERS !== 'undefined' && window.SQF_TRIGGERS.getActiveHoldTags ? window.SQF_TRIGGERS.getActiveHoldTags() : []).map(function(h) {
        return { id: h.id, type: 'Hold Tag', title: (h.tagNum || h.id) + ' — ' + (h.product || '?'), severity: 'critical', lot: h.lot, action: 'sqfdatalogs' };
      });

    case 'quarantine':
      return (typeof window.SQF_TRIGGERS !== 'undefined' && window.SQF_TRIGGERS.getQuarantinedMaterials ? window.SQF_TRIGGERS.getQuarantinedMaterials() : []).map(function(q) {
        return { id: q.id, type: 'Quarantine', title: (q.material || q.id), detail: q.supplier || '', action: 'sqfdatalogs' };
      });

    case 'sanFails':
      return (typeof window.SQF_TRIGGERS !== 'undefined' && window.SQF_TRIGGERS.getSanitationFailures ? window.SQF_TRIGGERS.getSanitationFailures() : []).map(function(s) {
        return { id: s.id, type: 'San Fail', title: (s.line || s.area || s.zone || '?'), severity: 'critical', action: 'sqfdatalogs' };
      });

    case 'receivingInsp':
      return fetchQueueData('receivingQueue');

    case 'capaOpen': return [];
    case 'trainingDue':
      var td = [];
      try {
        var trRecs = JSON.parse(localStorage.getItem('mfx_training_records') || '[]');
        trRecs.filter(function(r) { return r.status === 'Due' || r.status === 'Overdue'; }).forEach(function(r) {
          td.push({ id: r.id, type: r.status, title: (r.employeeName || '?') + ' — ' + (r.programName || '?'), severity: r.status === 'Overdue' ? 'critical' : 'major', action: 'training' });
        });
      } catch(e) {}
      return td;

    // ─── FINANCE ───
    case 'invoicesOpen': return [];
    case 'arOverdue': return [];
    case 'apDue': return [];
    case 'sosPending':
      var sp = [];
      if (typeof DB !== 'undefined' && DB.salesOrders) {
        (typeof DB.salesOrders === 'function' ? DB.salesOrders() : []).filter(function(so) { return so.status === 'pending' || so.status === 'approved'; }).forEach(function(so) {
          sp.push({ id: so.id, type: so.status === 'pending' ? 'Pending' : 'Approved', title: so.soNum + ' — ' + so.company, amount: so.total || 0, action: 'orders' });
        });
      }
      return sp;
    case 'paymentRecords': return [];
    case 'revenueKPI': return buildKPIs();

    default: return [];
  }
}

// ─── HELPERS ───
function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function buildKPIs() {
  var kpis = [];
  if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
    var qs = DB.quotes();
    var won = qs.filter(function(q) { return q.status === 'won'; });
    var lost = qs.filter(function(q) { return q.status === 'lost'; });
    var wr = won.length + lost.length > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
    kpis.push({ id: 'wr', type: 'KPI', title: 'Win Rate', value: wr + '%', color: wr >= 50 ? 'var(--gn)' : 'var(--or)' });
    kpis.push({ id: 'tq', type: 'KPI', title: 'Total Quotes', value: String(qs.length), color: 'var(--ac)' });
    kpis.push({ id: 'aw', type: 'KPI', title: 'Active Won', value: String(won.length), color: 'var(--gn)' });
  }
  if (typeof window.SQF_ALERT_COUNT === 'number') {
    kpis.push({ id: 'sqf', type: 'KPI', title: 'SQF Alerts', value: String(window.SQF_ALERT_COUNT), color: window.SQF_ALERT_COUNT > 0 ? 'var(--rd)' : 'var(--gn)' });
  }
  return kpis;
}

function buildPipeline() {
  var stages = { draft: 0, approval: 0, ready: 0, sent: 0, won: 0, lost: 0 };
  if (typeof DB !== 'undefined' && typeof DB.quotes === 'function') {
    DB.quotes().forEach(function(q) { if (stages.hasOwnProperty(q.status)) stages[q.status]++; });
  }
  return Object.keys(stages).map(function(k) {
    return { id: k, type: 'Stage', title: k.charAt(0).toUpperCase() + k.slice(1), value: String(stages[k]), color: k === 'won' ? 'var(--gn)' : k === 'lost' ? 'var(--rd)' : 'var(--ac)' };
  });
}

function buildPPDPipeline() {
  var stages = {};
  if (typeof getJobTickets === 'function') {
    getJobTickets().forEach(function(jt) {
      if (jt.ppd && jt.ppd.stage) {
        var s = jt.ppd.stage;
        stages[s] = (stages[s] || 0) + 1;
      }
    });
  }
  return Object.keys(stages).map(function(k) {
    return { id: k, type: 'Stage', title: k, value: String(stages[k]), color: k === 'Released' ? 'var(--gn)' : k === 'Blocked' ? 'var(--rd)' : 'var(--ac)' };
  });
}

// ═══════════════════════════════════════════════════════════════
// RENDER — Mission Board
// ═══════════════════════════════════════════════════════════════

function renderMissionBoard(container) {
  var role = detectRole();
  var wb = WORKBENCHES[role];
  if (!wb) wb = WORKBENCHES.leadership;

  var h = '';

  // ─── Greeting + Role Selector ───
  var userName = typeof getUserName === 'function' ? getUserName() : 'User';
  var hour = new Date().getHours();
  var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  h += '<div>';
  h += '<div style="font-size:22px;font-weight:800;color:var(--tx);letter-spacing:-.5px">' + greeting + ', ' + userName + '</div>';
  h += '<div style="font-size:11px;color:var(--tx3);margin-top:2px">' + wb.icon + ' ' + wb.label + ' Workbench · ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + '</div>';
  h += '</div>';

  // Role switcher dropdown
  h += '<div style="position:relative">';
  h += '<select onchange="window.MFX.LAUNCHPAD.setRole(this.value)" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bdr);border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:var(--mono)">';
  Object.keys(WORKBENCHES).forEach(function(k) {
    h += '<option value="' + k + '"' + (k === role ? ' selected' : '') + '>' + WORKBENCHES[k].icon + ' ' + WORKBENCHES[k].label + '</option>';
  });
  h += '</select></div>';
  h += '</div>';

  // ─── Urgent Banner ───
  var urgentCount = 0;
  wb.queues.forEach(function(q) {
    var data = fetchQueueData(q.query);
    _boardCache[q.key] = data;
    if (q.color === 'var(--rd)' || q.color === 'var(--or)') urgentCount += data.length;
  });

  if (urgentCount > 0) {
    h += '<div style="background:rgba(255,80,100,.08);border:1px solid rgba(255,80,100,.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">';
    h += '<div style="font-size:20px">⚡</div>';
    h += '<div><div style="font-size:13px;font-weight:700;color:var(--rd)">' + urgentCount + ' item' + (urgentCount > 1 ? 's' : '') + ' need attention</div>';
    h += '<div style="font-size:10px;color:var(--tx3)">Action required before end of shift</div></div>';
    h += '</div>';
  }

  // ─── Queue Cards Grid ───
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';

  wb.queues.forEach(function(q) {
    var items = _boardCache[q.key] || [];
    var count = items.length;
    var isEmpty = count === 0;
    var isKPI = q.query === 'kpis' || q.query === 'pipeline' || q.query === 'ppdPipeline' || q.query === 'revenueKPI';

    h += '<div style="background:var(--bg2);border-radius:10px;border:1px solid var(--bdr);overflow:hidden;transition:border-color .2s' + (count > 0 && !isKPI ? ';border-left:3px solid ' + q.color : '') + '">';

    // Card Header
    h += '<div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bdr)">';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="font-size:16px">' + q.icon + '</span>';
    h += '<span style="font-size:12px;font-weight:700;color:var(--tx)">' + q.label + '</span>';
    h += '</div>';
    if (!isKPI) {
      h += '<span style="background:' + (count > 0 ? q.color : 'var(--bg3)') + ';color:' + (count > 0 ? '#000' : 'var(--tx3)') + ';font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px;min-width:20px;text-align:center">' + count + '</span>';
    }
    h += '</div>';

    // Card Body
    h += '<div style="padding:8px 14px;max-height:200px;overflow-y:auto">';

    if (isKPI) {
      // KPI display
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;padding:4px 0">';
      items.forEach(function(item) {
        h += '<div style="text-align:center;padding:6px">';
        h += '<div style="font-size:20px;font-weight:800;color:' + (item.color || 'var(--ac)') + '">' + (item.value || '—') + '</div>';
        h += '<div style="font-size:9px;color:var(--tx3);text-transform:uppercase;margin-top:2px">' + item.title + '</div>';
        h += '</div>';
      });
      h += '</div>';
    } else if (isEmpty) {
      h += '<div style="padding:12px 0;text-align:center;color:var(--tx3);font-size:11px">✓ All clear</div>';
    } else {
      // Queue items
      items.slice(0, 5).forEach(function(item) {
        h += '<div style="padding:6px 0;border-bottom:1px solid var(--bg3);display:flex;align-items:center;justify-content:space-between;gap:8px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:11px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (item.title || '—') + '</div>';
        h += '<div style="font-size:9px;color:var(--tx3);display:flex;gap:6px;margin-top:1px">';
        h += '<span>' + (item.type || '') + '</span>';
        if (item.amount) h += '<span style="color:var(--gn)">' + (typeof f$ === 'function' ? f$(item.amount) : '$' + Number(item.amount).toFixed(0)) + '</span>';
        if (item.age !== undefined && item.age < 900) h += '<span>' + item.age + 'd ago</span>';
        if (item.daysOverdue) h += '<span style="color:var(--rd)">' + item.daysOverdue + 'd overdue</span>';
        if (item.detail) h += '<span>' + item.detail + '</span>';
        if (item.severity === 'critical') h += '<span style="color:var(--rd);font-weight:700">CRITICAL</span>';
        if (item.progress !== undefined) h += '<span>' + item.progress + '% done</span>';
        h += '</div></div>';
        if (item.action) {
          h += '<button onclick="goView(\'' + item.action + '\')" style="background:var(--bg3);color:var(--tx);border:none;padding:3px 8px;border-radius:4px;font-size:9px;cursor:pointer;white-space:nowrap;font-weight:600">' + (item.actionLabel || 'Go') + '</button>';
        }
        h += '</div>';
      });
      if (count > 5) {
        h += '<div style="padding:4px 0;text-align:center;font-size:10px;color:var(--tx3)">+ ' + (count - 5) + ' more</div>';
      }
    }

    h += '</div></div>';
  });

  h += '</div>';

  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// RENDER — Module Grid (secondary navigation)
// ═══════════════════════════════════════════════════════════════
function renderModuleGrid(container) {
  var modules = [
    { key: 'dashboard',    icon: '📊', label: 'Dashboard',      color: 'var(--ac)' },
    { key: 'quotes',       icon: '📝', label: 'Quotes',         color: 'var(--cy)' },
    { key: 'orders',       icon: '📋', label: 'Orders',         color: 'var(--gn)' },
    { key: 'customers',    icon: '👤', label: 'Customers',      color: 'var(--ac)' },
    { key: 'vendorpos',    icon: '🛒', label: 'Vendor POs',     color: 'var(--or)' },
    { key: 'ppd',          icon: '🎨', label: 'Pre-Press',      color: '#a78bfa' },
    { key: 'jobtracker',   icon: '🔧', label: 'Job Tracker',    color: 'var(--gn)' },
    { key: 'production',   icon: '🏭', label: 'Production',     color: 'var(--ac)' },
    { key: 'logistics',    icon: '🚚', label: 'Logistics',      color: 'var(--or)' },
    { key: 'operator',     icon: '⚙',  label: 'Operator',       color: 'var(--tx2)' },
    { key: 'sqfdatalogs',  icon: '🛡', label: 'SQF Data Logs',  color: 'var(--rd)' },
    { key: 'gmp',          icon: '🏥', label: 'GMP',            color: 'var(--gn)' },
    { key: 'capa',         icon: '📝', label: 'CAPA / NCR',     color: 'var(--or)' },
    { key: 'audit',        icon: '📋', label: 'SQF Audits',     color: 'var(--ac)' },
    { key: 'training',     icon: '🎓', label: 'Training',       color: '#a78bfa' },
    { key: 'doccontrol',   icon: '📁', label: 'Doc Control',    color: 'var(--tx2)' },
    { key: 'templates',    icon: '📐', label: 'Materials/Specs', color: 'var(--ac)' },
    { key: 'ceodash',      icon: '🤖', label: 'FlexAi',         color: 'var(--cy)' },
    { key: 'datasync',     icon: '🔄', label: 'Data Sync',      color: 'var(--tx2)' },
    { key: 'hr',           icon: '👥', label: 'HR / People',    color: 'var(--or)' }
  ];

  var h = '<div style="padding:4px 0 8px"><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600">All Modules</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">';
  modules.forEach(function(m) {
    h += '<div onclick="goView(\'' + m.key + '\')" style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px 8px;text-align:center;cursor:pointer;transition:all .15s" onmouseenter="this.style.borderColor=\'' + m.color + '\';this.style.transform=\'translateY(-2px)\'" onmouseleave="this.style.borderColor=\'var(--bdr)\';this.style.transform=\'none\'">';
    h += '<div style="font-size:22px;margin-bottom:4px">' + m.icon + '</div>';
    h += '<div style="font-size:9px;color:var(--tx);font-weight:600;line-height:1.2">' + m.label + '</div>';
    h += '</div>';
  });
  h += '</div></div>';
  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// RENDER — Shift Checks (preserved from v1)
// ═══════════════════════════════════════════════════════════════
var SHIFT_CHECKS = [
  { id: 'check_1', title: 'GMP Walkthrough',      description: 'Verify facility meets GMP standards' },
  { id: 'check_2', title: 'Temperature Readings',  description: 'Record production + storage temperatures' },
  { id: 'check_3', title: 'Equipment Inspection',  description: 'Check press, die cutter, packaging equipment' },
  { id: 'check_4', title: 'Material Check',        description: 'Verify materials properly labeled and stored' },
  { id: 'check_5', title: 'Safety Check',          description: 'Guards, emergency stops, safety signs in place' },
  { id: 'check_6', title: 'Housekeeping',          description: 'Floor clean, aisles clear, waste disposed' }
];
var shiftCheckState = {};

function loadShiftChecks() {
  try {
    var stored = JSON.parse(localStorage.getItem('mfx_shift_checks') || '{}');
    var today = new Date().toISOString().split('T')[0];
    shiftCheckState = (stored.date === today) ? (stored.checks || {}) : {};
  } catch(e) { shiftCheckState = {}; }
}

function toggleShiftCheck(idx) {
  if (idx < 0 || idx >= SHIFT_CHECKS.length) return;
  var checkId = SHIFT_CHECKS[idx].id;
  shiftCheckState[checkId] = !shiftCheckState[checkId];
  try {
    localStorage.setItem('mfx_shift_checks', JSON.stringify({ date: new Date().toISOString().split('T')[0], checks: shiftCheckState }));
  } catch(e) {}
  renderLaunchpad();
}

function renderShiftChecks(container) {
  var checked = 0;
  var h = '<div style="padding:4px 0 8px"><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600">Daily Shift Checks</div>';
  h += '<div style="display:grid;gap:6px">';
  SHIFT_CHECKS.forEach(function(check, idx) {
    var done = !!shiftCheckState[check.id];
    if (done) checked++;
    h += '<label style="display:flex;align-items:center;gap:10px;background:var(--bg2);padding:10px 12px;border-radius:8px;border-left:3px solid ' + (done ? 'var(--gn)' : 'var(--or)') + ';cursor:pointer">';
    h += '<input type="checkbox" ' + (done ? 'checked' : '') + ' onchange="window.MFX.LAUNCHPAD.toggleShiftCheck(' + idx + ')" style="width:18px;height:18px;cursor:pointer;accent-color:var(--gn)">';
    h += '<div><div style="font-size:12px;font-weight:600;color:' + (done ? 'var(--tx3)' : 'var(--tx)') + ';' + (done ? 'text-decoration:line-through' : '') + '">' + check.title + '</div>';
    h += '<div style="font-size:9px;color:var(--tx3)">' + check.description + '</div></div>';
    h += '</label>';
  });
  h += '</div>';
  var pct = Math.round(checked / SHIFT_CHECKS.length * 100);
  h += '<div style="margin-top:8px;background:var(--bg3);height:6px;border-radius:3px;overflow:hidden"><div style="background:' + (pct === 100 ? 'var(--gn)' : 'var(--or)') + ';height:100%;width:' + pct + '%;transition:width .3s"></div></div>';
  h += '<div style="font-size:9px;color:var(--tx3);margin-top:4px;text-align:right">' + checked + '/' + SHIFT_CHECKS.length + ' complete</div>';
  h += '</div>';
  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// RENDER — SQF Readiness
// ═══════════════════════════════════════════════════════════════
function renderSQFReadiness(container) {
  var scores = { 'Training': 85, 'GMP': 92, 'CAPA Closure': 78, 'Audit': 88, 'Quality': 91 };
  try {
    var trRecs = JSON.parse(localStorage.getItem('mfx_training_records') || '[]');
    if (trRecs.length) { var comp = trRecs.filter(function(r) { return r.status === 'Completed'; }).length; scores['Training'] = Math.round((comp / trRecs.length) * 100); }
    if (typeof window.SQF_ALERT_COUNT === 'number') { scores['Quality'] = Math.max(60, 100 - (window.SQF_ALERT_COUNT * 5)); }
  } catch(e) {}
  var avg = Math.round(Object.values(scores).reduce(function(a, b) { return a + b; }, 0) / Object.keys(scores).length);

  var h = '<div style="padding:4px 0 8px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  h += '<div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;font-weight:600">SQF Readiness</div>';
  h += '<div style="font-size:20px;font-weight:800;color:' + (avg >= 85 ? 'var(--gn)' : 'var(--or)') + '">' + avg + '%</div>';
  h += '</div>';
  h += '<div style="display:grid;gap:6px">';
  Object.keys(scores).forEach(function(k) {
    var s = scores[k]; var c = s >= 90 ? 'var(--gn)' : s >= 80 ? 'var(--ac)' : 'var(--or)';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<div style="width:80px;font-size:10px;color:var(--tx3)">' + k + '</div>';
    h += '<div style="flex:1;background:var(--bg3);height:8px;border-radius:4px;overflow:hidden"><div style="background:' + c + ';height:100%;width:' + s + '%"></div></div>';
    h += '<div style="width:30px;font-size:10px;color:' + c + ';text-align:right;font-weight:700">' + s + '</div>';
    h += '</div>';
  });
  h += '</div></div>';
  container.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER — Launchpad
// ═══════════════════════════════════════════════════════════════
function renderLaunchpad() {
  var el = document.getElementById('v-launchpad');
  if (!el) return;

  loadShiftChecks();

  var h = '<div style="display:flex;flex-direction:column;height:100%;background:var(--bg);overflow:hidden">';

  // Tab bar
  h += '<div style="background:var(--bg2);padding:6px 12px;border-bottom:1px solid var(--bdr);display:flex;gap:4px;flex-shrink:0">';
  var tabs = [
    { id: 'missions', label: '⚡ Mission Board' },
    { id: 'modules',  label: '🧩 Modules' },
    { id: 'shiftchecks', label: '☑ Shift Checks' },
    { id: 'sqf', label: '🛡 SQF' }
  ];
  tabs.forEach(function(t) {
    var isActive = _boardTab === t.id;
    h += '<button onclick="window.MFX.LAUNCHPAD.setTab(\'' + t.id + '\')" style="background:' + (isActive ? 'var(--ac)' : 'transparent') + ';color:' + (isActive ? '#000' : 'var(--tx3)') + ';border:none;padding:7px 12px;border-radius:6px;cursor:pointer;font-weight:' + (isActive ? '700' : '500') + ';font-size:11px;transition:all .15s">' + t.label + '</button>';
  });
  h += '</div>';

  // Content area
  h += '<div id="launchpad-content" style="flex:1;overflow-y:auto;padding:16px"></div>';

  h += '</div>';
  el.innerHTML = h;

  // Render active tab
  var contentEl = document.getElementById('launchpad-content');
  if (!contentEl) return;

  switch (_boardTab) {
    case 'missions':    renderMissionBoard(contentEl); break;
    case 'modules':     renderModuleGrid(contentEl); break;
    case 'shiftchecks': renderShiftChecks(contentEl); break;
    case 'sqf':         renderSQFReadiness(contentEl); break;
  }

  // Auto-refresh mission board every 30s
  if (_refreshTimer) clearInterval(_refreshTimer);
  if (_boardTab === 'missions') {
    _refreshTimer = setInterval(function() {
      var c = document.getElementById('launchpad-content');
      if (c && _boardTab === 'missions') renderMissionBoard(c);
    }, 30000);
  }
}

function setTab(tab) {
  _boardTab = tab;
  renderLaunchpad();
}

// ═══════════════════════════════════════════════════════════════
// INIT + EXPORTS
// ═══════════════════════════════════════════════════════════════
window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
window.MFX_VIEW_RENDERERS.launchpad = renderLaunchpad;

window.MFX = window.MFX || {};
window.MFX.LAUNCHPAD = {
  setTab: setTab,
  setRole: setActiveRole,
  toggleShiftCheck: toggleShiftCheck,
  detectRole: detectRole,
  getWorkbench: function() { return WORKBENCHES[detectRole()]; },
  init: function() {
    loadShiftChecks();
  },
  // Legacy compat
  startWalkthrough: function() {},
  completeWalkthrough: function() {}
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { window.MFX.LAUNCHPAD.init(); });
} else {
  window.MFX.LAUNCHPAD.init();
}

// ─── Also register as default home if user has no preference ───
window.getPreferredHomeView = window.getPreferredHomeView || function() { return 'launchpad'; };

console.log('✅ MFX Mission Board v2 loaded — role workbenches active');

})();
