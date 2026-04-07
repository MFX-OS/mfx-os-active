'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║               AI-APPROVALS.JS — Approval Queue & History                   ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  1. APPROVAL QUEUE ................................... ~line 10              ║
// ║  2. APPROVAL HISTORY ................................. ~line 95              ║
// ║  3. BADGE COUNT ...................................... ~line 155             ║
// ║  4. INLINE QUICK ACTIONS ............................. ~line 175             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function(){

var MFXAi = window.MFXAi || {};

var SEV_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
var SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function sevBadge(sev) {
  var c = SEV_COLORS[sev] || '#888';
  return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#fff;background:' + c + ';text-transform:uppercase">' + esc(sev || 'info') + '</span>';
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
// 1. APPROVAL QUEUE
// ═══════════════════════════════════════════════

MFXAi.renderApprovalQueue = function(containerId) {
  var el = $(containerId);
  if (!el) return;
  el.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center">Loading approval queue...</div>';

  MFXAi.getRecommendations({ status: 'pending_approval' }).then(function(recs) {
    // Sort by severity (critical first) then age (oldest first)
    recs.sort(function(a, b) {
      var sa = SEV_ORDER[a.severity] != null ? SEV_ORDER[a.severity] : 9;
      var sb = SEV_ORDER[b.severity] != null ? SEV_ORDER[b.severity] : 9;
      if (sa !== sb) return sa - sb;
      var ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      var tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    if (!recs.length) {
      el.innerHTML = '<div style="color:var(--tx3);padding:40px;text-align:center;font-size:13px">No items awaiting approval</div>';
      return;
    }

    var h = '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Pending Approvals <span style="font-size:11px;color:var(--cy)">(' + recs.length + ')</span></div>';
    h += '<div style="display:flex;flex-direction:column;gap:8px">';

    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px" id="aq_' + esc(r.id) + '">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      h += sevBadge(r.severity);
      h += '<span style="font-size:12px;font-weight:600;color:var(--tx);flex:1">' + esc(r.title || 'Untitled') + '</span>';
      h += '<span style="font-size:10px;color:var(--tx3)">' + timeAgo(r.createdAt) + '</span>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px">' + esc(r.summary || '') + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Agent: ' + esc(r.agentName || r.agent || '—') + '</div>';

      // Inline notes + quick actions
      h += '<div style="display:flex;gap:6px;align-items:center">';
      h += '<input type="text" id="aqn_' + esc(r.id) + '" placeholder="Notes (optional)..." style="flex:1;background:var(--bg3);color:var(--tx);border:1px solid var(--bdr);border-radius:6px;padding:4px 8px;font-size:11px">';
      h += '<button class="btn btn-pr" style="font-size:10px;padding:4px 10px;white-space:nowrap" onclick="MFXAi._quickApprove(\'' + esc(r.id) + '\')">Approve</button>';
      h += '<button class="btn btn-ghost" style="font-size:10px;padding:4px 10px;color:var(--rd);white-space:nowrap" onclick="MFXAi._quickReject(\'' + esc(r.id) + '\')">Reject</button>';
      h += '</div>';

      h += '</div>';
    }

    h += '</div>';
    el.innerHTML = h;

    // Update badge count
    MFXAi._updateApprovalBadge(recs.length);
  }).catch(function(e) {
    el.innerHTML = '<div style="color:var(--rd);padding:20px;text-align:center">Error: ' + esc(e.message) + '</div>';
  });
};

// ═══════════════════════════════════════════════
// 2. APPROVAL HISTORY
// ═══════════════════════════════════════════════

MFXAi.renderApprovalHistory = function(containerId) {
  var el = $(containerId);
  if (!el) return;
  el.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center">Loading history...</div>';

  MFXAi.apiGet('recommendations', { status: 'approved,rejected', limit: 50 }).then(function(data) {
    var recs = data.recommendations || data || [];
    if (!recs.length) {
      el.innerHTML = '<div style="color:var(--tx3);padding:40px;text-align:center;font-size:13px">No approval history yet</div>';
      return;
    }

    // Sort by decision time descending
    recs.sort(function(a, b) {
      var ta = a.decidedAt ? new Date(a.decidedAt).getTime() : 0;
      var tb = b.decidedAt ? new Date(b.decidedAt).getTime() : 0;
      return tb - ta;
    });

    var h = '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Recent Decisions</div>';
    h += '<div style="display:flex;flex-direction:column;gap:6px">';

    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      var isApproved = r.status === 'approved';
      var decColor = isApproved ? 'var(--gn)' : 'var(--rd)';
      var decIcon = isApproved ? '&#10003;' : '&#10007;';

      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;display:flex;align-items:flex-start;gap:10px">';
      h += '<div style="font-size:16px;color:' + decColor + ';line-height:1">' + decIcon + '</div>';
      h += '<div style="flex:1">';
      h += '<div style="font-size:12px;font-weight:600;color:var(--tx)">' + esc(r.title || 'Untitled') + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);margin-top:2px">';
      h += (isApproved ? 'Approved' : 'Rejected') + ' by ' + esc(r.decidedBy || r.approvedBy || r.rejectedBy || '—');
      h += ' &middot; ' + timeAgo(r.decidedAt);
      h += '</div>';
      if (r.decisionNotes || r.notes || r.reason) {
        h += '<div style="font-size:10px;color:var(--tx2);margin-top:4px;font-style:italic">"' + esc(r.decisionNotes || r.notes || r.reason) + '"</div>';
      }
      h += '</div>';
      h += sevBadge(r.severity);
      h += '</div>';
    }

    h += '</div>';
    el.innerHTML = h;
  }).catch(function(e) {
    el.innerHTML = '<div style="color:var(--rd);padding:20px;text-align:center">Error: ' + esc(e.message) + '</div>';
  });
};

// ═══════════════════════════════════════════════
// 3. BADGE COUNT
// ═══════════════════════════════════════════════

MFXAi._updateApprovalBadge = function(count) {
  var badge = document.getElementById('aiApprovalBadge');
  if (!badge && count > 0) {
    // Try to inject badge into nav
    var navItems = document.querySelectorAll('[data-view="aiops"]');
    for (var i = 0; i < navItems.length; i++) {
      var b = document.createElement('span');
      b.id = 'aiApprovalBadge';
      b.style.cssText = 'display:inline-block;background:var(--rd);color:#fff;font-size:9px;font-weight:700;border-radius:50%;min-width:16px;height:16px;line-height:16px;text-align:center;margin-left:4px';
      b.textContent = count;
      navItems[i].appendChild(b);
    }
  } else if (badge) {
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }
};

// ═══════════════════════════════════════════════
// 4. INLINE QUICK ACTIONS
// ═══════════════════════════════════════════════

MFXAi._quickApprove = function(recId) {
  var notes = $('aqn_' + recId) ? $('aqn_' + recId).value : '';
  var card = $('aq_' + recId);
  if (card) card.style.opacity = '0.5';

  MFXAi.approve(recId, notes).then(function() {
    if (card) card.style.display = 'none';
    MFXAi.getRecommendations({ status: 'pending_approval' }).then(function(recs) {
      MFXAi._updateApprovalBadge(recs.length);
    });
  }).catch(function(e) {
    if (card) card.style.opacity = '1';
    if (typeof toast === 'function') toast('Approve failed: ' + e.message, 'err');
  });
};

MFXAi._quickReject = function(recId) {
  var notes = $('aqn_' + recId) ? $('aqn_' + recId).value : '';
  if (!notes) {
    if (typeof toast === 'function') toast('Please enter a rejection reason', 'warn');
    var inp = $('aqn_' + recId);
    if (inp) { inp.style.borderColor = 'var(--rd)'; inp.focus(); }
    return;
  }
  var card = $('aq_' + recId);
  if (card) card.style.opacity = '0.5';

  MFXAi.reject(recId, notes).then(function() {
    if (card) card.style.display = 'none';
    MFXAi.getRecommendations({ status: 'pending_approval' }).then(function(recs) {
      MFXAi._updateApprovalBadge(recs.length);
    });
  }).catch(function(e) {
    if (card) card.style.opacity = '1';
    if (typeof toast === 'function') toast('Reject failed: ' + e.message, 'err');
  });
};

window.MFXAi = MFXAi;

})();
