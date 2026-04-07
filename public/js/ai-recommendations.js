'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║              AI-RECOMMENDATIONS.JS — Recommendation List & Detail UI       ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  1. CONSTANTS & HELPERS .............................. ~line 10              ║
// ║  2. RECOMMENDATION LIST .............................. ~line 45              ║
// ║  3. FILTER BAR ....................................... ~line 110             ║
// ║  4. RECOMMENDATION DETAIL ............................ ~line 160            ║
// ║  5. APPROVAL FORM MODAL .............................. ~line 210            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function(){

var MFXAi = window.MFXAi || {};

// ═══════════════════════════════════════════════
// 1. CONSTANTS & HELPERS
// ═══════════════════════════════════════════════

var SEV_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
var STATUS_COLORS = { pending_approval: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', executed: 'var(--cy)' };
var STATUS_LABELS = { pending_approval: 'Pending', approved: 'Approved', rejected: 'Rejected', executed: 'Executed' };
var MODULES = ['all', 'sales', 'logistics', 'quality', 'production'];

function sevBadge(sev) {
  var c = SEV_COLORS[sev] || '#888';
  return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#fff;background:' + c + ';text-transform:uppercase">' + esc(sev || 'info') + '</span>';
}

function statusBadge(st) {
  var c = STATUS_COLORS[st] || '#888';
  var lbl = STATUS_LABELS[st] || st;
  return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:' + c + ';border:1px solid ' + c + '">' + esc(lbl) + '</span>';
}

function timeAgo(ts) {
  if (!ts) return '';
  var d = typeof ts === 'string' ? new Date(ts) : (ts.toDate ? ts.toDate() : new Date(ts));
  var diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
  return Math.floor(diff / 1440) + 'd ago';
}

// ═══════════════════════════════════════════════
// 2. RECOMMENDATION LIST
// ═══════════════════════════════════════════════

MFXAi.renderRecommendationList = function(containerId, filters) {
  var el = $(containerId);
  if (!el) return;

  var f = filters || {};
  el.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center">Loading recommendations...</div>';

  MFXAi.getRecommendations(f).then(function(recs) {
    if (!recs || !recs.length) {
      el.innerHTML = '<div style="color:var(--tx3);padding:40px;text-align:center;font-size:13px">No recommendations found</div>';
      return;
    }

    var h = '';
    h += _renderFilterBar(containerId, f);
    h += '<div id="' + containerId + '_list" style="display:flex;flex-direction:column;gap:8px;padding:8px 0">';

    var filtered = _applyFilters(recs, f);
    for (var i = 0; i < filtered.length; i++) {
      h += _renderRecCard(filtered[i]);
    }
    h += '</div>';
    el.innerHTML = h;
  }).catch(function(e) {
    el.innerHTML = '<div style="color:var(--rd);padding:20px;text-align:center">Error loading: ' + esc(e.message) + '</div>';
  });
};

function _renderRecCard(rec) {
  var h = '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;cursor:pointer" onclick="MFXAi.renderRecommendationDetail(\'aiRecDetail\',\'' + esc(rec.id) + '\')">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
  h += sevBadge(rec.severity);
  h += statusBadge(rec.status);
  h += '<span style="margin-left:auto;font-size:10px;color:var(--tx3)">' + timeAgo(rec.createdAt) + '</span>';
  h += '</div>';
  h += '<div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:4px">' + esc(rec.title || 'Untitled') + '</div>';
  h += '<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">' + esc(rec.summary || '') + '</div>';
  h += '<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--tx3)">';
  h += '<span>Agent: ' + esc(rec.agentName || rec.agent || '—') + '</span>';
  if (rec.sourceCollection) h += '<span>Source: ' + esc(rec.sourceCollection) + '</span>';
  h += '</div>';

  // Action buttons for pending items
  if (rec.status === 'pending_approval') {
    h += '<div style="display:flex;gap:6px;margin-top:8px">';
    h += '<button class="btn btn-pr" style="font-size:10px;padding:4px 10px" onclick="event.stopPropagation();MFXAi.renderApprovalForm(\'' + esc(rec.id) + '\')">Approve</button>';
    h += '<button class="btn btn-ghost" style="font-size:10px;padding:4px 10px;color:var(--rd)" onclick="event.stopPropagation();MFXAi.renderApprovalForm(\'' + esc(rec.id) + '\',true)">Reject</button>';
    if (rec.sourceId) h += '<button class="btn btn-ghost" style="font-size:10px;padding:4px 10px" onclick="event.stopPropagation();MFXAi._viewSource(\'' + esc(rec.sourceCollection || '') + '\',\'' + esc(rec.sourceId) + '\')">View Source</button>';
    h += '</div>';
  }

  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════
// 3. FILTER BAR
// ═══════════════════════════════════════════════

function _renderFilterBar(containerId, filters) {
  var h = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">';
  // Module filter
  h += '<select id="' + containerId + '_modFilter" onchange="MFXAi._applyListFilter(\'' + containerId + '\')" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bdr);border-radius:6px;padding:4px 8px;font-size:11px">';
  for (var i = 0; i < MODULES.length; i++) {
    var sel = (filters.module === MODULES[i] || (!filters.module && MODULES[i] === 'all')) ? ' selected' : '';
    h += '<option value="' + MODULES[i] + '"' + sel + '>' + MODULES[i].charAt(0).toUpperCase() + MODULES[i].slice(1) + '</option>';
  }
  h += '</select>';

  // Severity filter
  h += '<select id="' + containerId + '_sevFilter" onchange="MFXAi._applyListFilter(\'' + containerId + '\')" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bdr);border-radius:6px;padding:4px 8px;font-size:11px">';
  h += '<option value="all">All Severity</option>';
  var sevs = ['critical', 'high', 'medium', 'low'];
  for (var s = 0; s < sevs.length; s++) {
    var ss = (filters.severity === sevs[s]) ? ' selected' : '';
    h += '<option value="' + sevs[s] + '"' + ss + '>' + sevs[s].charAt(0).toUpperCase() + sevs[s].slice(1) + '</option>';
  }
  h += '</select>';

  // Status filter
  h += '<select id="' + containerId + '_statusFilter" onchange="MFXAi._applyListFilter(\'' + containerId + '\')" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bdr);border-radius:6px;padding:4px 8px;font-size:11px">';
  h += '<option value="all">All Status</option>';
  var stats = ['pending_approval', 'approved', 'rejected', 'executed'];
  for (var t = 0; t < stats.length; t++) {
    var st = (filters.status === stats[t]) ? ' selected' : '';
    h += '<option value="' + stats[t] + '"' + st + '>' + (STATUS_LABELS[stats[t]] || stats[t]) + '</option>';
  }
  h += '</select>';

  h += '</div>';
  return h;
}

MFXAi._applyListFilter = function(containerId) {
  var mod = $(containerId + '_modFilter');
  var sev = $(containerId + '_sevFilter');
  var stat = $(containerId + '_statusFilter');
  var f = {};
  if (mod && mod.value !== 'all') f.module = mod.value;
  if (sev && sev.value !== 'all') f.severity = sev.value;
  if (stat && stat.value !== 'all') f.status = stat.value;
  MFXAi.renderRecommendationList(containerId, f);
};

function _applyFilters(recs, f) {
  return recs.filter(function(r) {
    if (f.module && f.module !== 'all' && r.module !== f.module) return false;
    if (f.severity && f.severity !== 'all' && r.severity !== f.severity) return false;
    if (f.status && f.status !== 'all' && r.status !== f.status) return false;
    return true;
  });
}

// ═══════════════════════════════════════════════
// 4. RECOMMENDATION DETAIL
// ═══════════════════════════════════════════════

MFXAi.renderRecommendationDetail = function(containerId, recId) {
  var recs = MFXAi._state.recommendations || [];
  var rec = null;
  for (var i = 0; i < recs.length; i++) { if (recs[i].id === recId) { rec = recs[i]; break; } }

  if (!rec) {
    // Fetch from API
    MFXAi.apiGet('recommendations/' + recId).then(function(data) {
      _renderDetail(containerId, data);
    }).catch(function(e) {
      var el = $(containerId);
      if (el) el.innerHTML = '<div style="color:var(--rd);padding:20px">Error: ' + esc(e.message) + '</div>';
    });
    return;
  }
  _renderDetail(containerId, rec);
};

function _renderDetail(containerId, rec) {
  var el = $(containerId) || document.getElementById(containerId);
  if (!el) {
    // Open in modal if no container
    var wrap = '<div id="aiRecDetail" style="max-width:600px"></div>';
    openModal(wrap);
    setTimeout(function() { _renderDetail('aiRecDetail', rec); }, 50);
    return;
  }

  var h = '<div style="padding:12px">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">';
  h += sevBadge(rec.severity);
  h += statusBadge(rec.status);
  h += '<span style="font-size:10px;color:var(--tx3);margin-left:auto">' + timeAgo(rec.createdAt) + '</span>';
  h += '</div>';
  h += '<div style="font-size:16px;font-weight:700;color:var(--tx);margin-bottom:8px">' + esc(rec.title || 'Untitled') + '</div>';
  h += '<div style="font-size:12px;color:var(--tx2);margin-bottom:12px;line-height:1.5">' + esc(rec.summary || '') + '</div>';

  // Agent info
  h += '<div style="font-size:11px;color:var(--tx3);margin-bottom:12px">';
  h += 'Agent: <strong>' + esc(rec.agentName || rec.agent || '—') + '</strong>';
  if (rec.sourceCollection) h += ' &middot; Source: ' + esc(rec.sourceCollection);
  if (rec.sourceId) h += ' / ' + esc(rec.sourceId);
  h += '</div>';

  // Recommended actions
  if (rec.recommendedActions && rec.recommendedActions.length) {
    h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:6px">Recommended Actions</div>';
    for (var a = 0; a < rec.recommendedActions.length; a++) {
      var act = rec.recommendedActions[a];
      h += '<div style="background:var(--bg3);border-radius:6px;padding:8px;margin-bottom:4px;font-size:11px;color:var(--tx2)">';
      h += typeof act === 'string' ? esc(act) : esc(act.description || act.action || JSON.stringify(act));
      h += '</div>';
    }
    h += '</div>';
  }

  // Source references
  if (rec.sourceRefs && rec.sourceRefs.length) {
    h += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:6px">Source References</div>';
    for (var r = 0; r < rec.sourceRefs.length; r++) {
      var ref = rec.sourceRefs[r];
      h += '<div style="font-size:10px;color:var(--cy);cursor:pointer;margin-bottom:2px" onclick="MFXAi._viewSource(\'' + esc(ref.collection || '') + '\',\'' + esc(ref.id || '') + '\')">';
      h += esc(ref.collection || '') + '/' + esc(ref.id || ref.label || '');
      h += '</div>';
    }
    h += '</div>';
  }

  // Action buttons
  if (rec.status === 'pending_approval') {
    h += '<div style="display:flex;gap:8px;margin-top:16px">';
    h += '<button class="btn btn-pr" onclick="MFXAi.renderApprovalForm(\'' + esc(rec.id) + '\')">Approve</button>';
    h += '<button class="btn btn-ghost" style="color:var(--rd)" onclick="MFXAi.renderApprovalForm(\'' + esc(rec.id) + '\',true)">Reject</button>';
    h += '</div>';
  }

  h += '</div>';
  el.innerHTML = h;
}

// ═══════════════════════════════════════════════
// 5. APPROVAL FORM MODAL
// ═══════════════════════════════════════════════

MFXAi.renderApprovalForm = function(recId, isReject) {
  var action = isReject ? 'Reject' : 'Approve';
  var color = isReject ? 'var(--rd)' : 'var(--gn)';

  var h = '<div style="padding:16px;max-width:420px">';
  h += '<div style="font-size:15px;font-weight:700;color:var(--tx);margin-bottom:12px">' + action + ' Recommendation</div>';
  h += '<div style="margin-bottom:12px">';
  h += '<label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">' + (isReject ? 'Rejection Reason' : 'Approval Notes') + '</label>';
  h += '<textarea id="aiApprovalNotes" rows="4" style="width:100%;background:var(--bg2);color:var(--tx);border:1px solid var(--bdr);border-radius:6px;padding:8px;font-size:12px;resize:vertical" placeholder="' + (isReject ? 'Why is this being rejected?' : 'Optional notes...') + '"></textarea>';
  h += '</div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  h += '<button class="btn btn-pr" style="background:' + color + '" onclick="MFXAi._submitApproval(\'' + esc(recId) + '\',' + (isReject ? 'true' : 'false') + ')">' + action + '</button>';
  h += '</div></div>';

  openModal(h);
};

MFXAi._submitApproval = function(recId, isReject) {
  var notes = $('aiApprovalNotes') ? $('aiApprovalNotes').value : '';
  var promise = isReject ? MFXAi.reject(recId, notes) : MFXAi.approve(recId, notes);
  promise.then(function() {
    closeModal();
    // Re-fetch recommendations to update lists
    MFXAi.getRecommendations();
  }).catch(function(e) {
    if (typeof toast === 'function') toast('Error: ' + e.message, 'err');
  });
};

MFXAi._viewSource = function(collection, docId) {
  if (!collection || !docId) return;
  var viewMap = { quotes: 'quotes', customers: 'customers', vendorPOs: 'vendorpos', jobs: 'jobtracker', ncrs: 'capa', training: 'training' };
  var view = viewMap[collection];
  if (view && typeof goView === 'function') {
    goView(view);
  } else {
    if (typeof toast === 'function') toast('Source: ' + collection + '/' + docId, 'info');
  }
};

window.MFXAi = MFXAi;

})();
