'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║              AI-OPS-CENTER.JS — FlexAi Command Hub View                    ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  1. CONSTANTS & STATE ................................ ~line 14              ║
// ║  2. MAIN RENDERER (renderOpsCenter) .................. ~line 30             ║
// ║  3. TAB SWITCHING .................................... ~line 85             ║
// ║  4. HEALTH LOADER .................................... ~line 100            ║
// ║  5. TAB A — COMMAND CENTER ........................... ~line 120            ║
// ║  6. TAB B — RECOMMENDATIONS .......................... ~line 225            ║
// ║  7. TAB C — APPROVALS ................................ ~line 240            ║
// ║  8. TAB D — LEADERSHIP DIGEST ........................ ~line 255            ║
// ║  9. TAB E — AGENT ADMIN .............................. ~line 320            ║
// ║ 10. TRIGGER AGENT .................................... ~line 420            ║
// ║ 11. HELPERS .......................................... ~line 440            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function(){

var MFXAi = window.MFXAi || {};
var _activeTab = 'command';
var _healthCache = null;

// Tab definitions
var TABS = [
  {k:'command', l:'Command Center', ico:'\u26A1'},
  {k:'recommendations', l:'Recommendations', ico:'\uD83D\uDCA1'},
  {k:'approvals', l:'Approvals', ico:'\u2705'},
  {k:'digest', l:'Leadership Digest', ico:'\uD83D\uDCCA'},
  {k:'admin', l:'Agent Admin', ico:'\u2699\uFE0F'}
];

// ═══════════════════════════════════════════════
// 2. MAIN RENDERER
// ═══════════════════════════════════════════════

MFXAi.renderOpsCenter = function(containerId) {
  var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!el) return;

  var h = '';
  h += '<div style="padding:16px;max-width:1200px;margin:0 auto">';

  // Header
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">';
  h += '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#00e5ff,#0891b2);display:flex;align-items:center;justify-content:center;font-size:18px">\uD83E\uDD16</div>';
  h += '<div><div style="font-size:16px;font-weight:800;color:var(--cy);letter-spacing:.5px">AI Operations Center</div>';
  h += '<div style="font-size:11px;color:var(--tx3)">FlexAi Governed Intelligence</div></div>';
  h += '<div style="flex:1"></div>';
  h += '<div id="aiops_status" style="display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;border:1px solid var(--bdr);font-size:10px;color:var(--tx3)">';
  h += '<span id="aiops_dot" style="width:8px;height:8px;border-radius:50%;background:#666"></span>';
  h += '<span id="aiops_label">Checking...</span></div>';
  h += '</div>';

  // Tabs
  h += '<div style="display:flex;gap:4px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">';
  for (var i = 0; i < TABS.length; i++) {
    var t = TABS[i];
    var active = t.k === _activeTab;
    h += '<button onclick="MFXAi._switchOpsTab(\'' + t.k + '\')" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid ' + (active ? 'var(--cy)' : 'var(--bdr)') + ';background:' + (active ? 'rgba(0,229,255,.12)' : 'var(--bg2)') + ';color:' + (active ? 'var(--cy)' : 'var(--tx3)') + ';font-size:11px;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;white-space:nowrap;transition:all .2s">';
    h += '<span>' + t.ico + '</span>' + esc(t.l) + '</button>';
  }
  h += '</div>';

  // Tab content area
  h += '<div id="aiops_content" style="min-height:400px"></div>';
  h += '</div>';

  el.innerHTML = h;

  // Load health status
  _loadHealth();
  // Render active tab
  _renderTab(_activeTab);
};

// ═══════════════════════════════════════════════
// 3. TAB SWITCHING
// ═══════════════════════════════════════════════

MFXAi._switchOpsTab = function(tab) {
  _activeTab = tab;
  // Re-render full ops center
  var el = document.getElementById('v-aiops');
  if (el) MFXAi.renderOpsCenter(el);
};

// ═══════════════════════════════════════════════
// 4. HEALTH LOADER
// ═══════════════════════════════════════════════

function _loadHealth() {
  MFXAi.getHealth().then(function(h) {
    _healthCache = h;
    var dot = document.getElementById('aiops_dot');
    var lbl = document.getElementById('aiops_label');
    if (dot && lbl) {
      var ok = h && h.status === 'healthy';
      dot.style.background = ok ? '#22c55e' : '#f59e0b';
      lbl.textContent = ok ? 'System Healthy' : 'Degraded';
    }
  }).catch(function() {
    var dot = document.getElementById('aiops_dot');
    var lbl = document.getElementById('aiops_label');
    if (dot) dot.style.background = '#ef4444';
    if (lbl) lbl.textContent = 'Offline';
  });
}

function _renderTab(tab) {
  var el = document.getElementById('aiops_content');
  if (!el) return;

  if (tab === 'command') _renderCommandCenter(el);
  else if (tab === 'recommendations') _renderRecsTab(el);
  else if (tab === 'approvals') _renderApprovalsTab(el);
  else if (tab === 'digest') _renderDigestTab(el);
  else if (tab === 'admin') _renderAdminTab(el);
}

// ═══════════════════════════════════════════════
// 5. TAB A — COMMAND CENTER
// ═══════════════════════════════════════════════

function _renderCommandCenter(el) {
  var h = '';

  // Agent Status Grid
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Agent Status</div>';
  h += '<div id="aiops_agents" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px">';

  var agents = [
    {k:'quote_agent', l:'Quote Agent', ico:'\uD83D\uDCCB', desc:'Sales & quoting analysis'},
    {k:'purchasing_agent', l:'Purchasing Agent', ico:'\uD83D\uDCE6', desc:'Stock & vendor monitoring'},
    {k:'sqf_agent', l:'SQF Agent', ico:'\uD83D\uDEE1\uFE0F', desc:'Compliance & food safety'},
    {k:'job_agent', l:'Job Agent', ico:'\uD83C\uDFED', desc:'Production readiness'},
    {k:'leadership_agent', l:'Leadership Agent', ico:'\uD83D\uDCCA', desc:'Cross-functional insights'}
  ];

  for (var i = 0; i < agents.length; i++) {
    var a = agents[i];
    var cfg = (MFXAi._state.agents && MFXAi._state.agents[a.k]) || {};
    var enabled = cfg.enabled !== false;
    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    h += '<span style="font-size:18px">' + a.ico + '</span>';
    h += '<div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--tx)">' + esc(a.l) + '</div>';
    h += '<div style="font-size:10px;color:var(--tx3)">' + esc(a.desc) + '</div></div>';
    h += '<span style="width:8px;height:8px;border-radius:50%;background:' + (enabled ? '#22c55e' : '#666') + '"></span>';
    h += '</div>';
    h += '<div style="display:flex;gap:4px;margin-top:8px">';
    h += '<button class="btn btn-pr" style="font-size:9px;padding:3px 8px" onclick="MFXAi._triggerAgent(\'' + a.k + '\')">Run Now</button>';
    h += '</div>';
    h += '</div>';
  }
  h += '</div>';

  // Quick Actions
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Quick Actions</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">';
  h += '<button class="btn btn-pr" style="font-size:11px;padding:6px 14px" onclick="MFXAi._triggerAgent(\'leadership_agent\')">Generate Leadership Digest</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="MFXAi._triggerAgent(\'sqf_agent\')">Run Compliance Check</button>';
  h += '<button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="MFXAi._triggerAgent(\'purchasing_agent\')">Low Stock Scan</button>';
  h += '</div>';

  // Recent Activity
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Recent Activity</div>';
  h += '<div id="aiops_activity" style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:12px;min-height:120px">';
  h += '<div style="color:var(--tx3);font-size:11px;text-align:center;padding:20px">Loading activity...</div>';
  h += '</div>';

  el.innerHTML = h;
  _loadRecentActivity();
}

function _loadRecentActivity() {
  if (typeof fbDb === 'undefined') return;
  fbDb.collection('_agentAuditLog').orderBy('timestamp','desc').limit(15).get().then(function(snap) {
    var el = document.getElementById('aiops_activity');
    if (!el) return;
    if (snap.empty) { el.innerHTML = '<div style="color:var(--tx3);font-size:11px;text-align:center;padding:20px">No recent agent activity</div>'; return; }
    var h = '';
    snap.forEach(function(doc) {
      var d = doc.data();
      var ts = d.timestamp ? (d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp)) : new Date();
      var ago = _timeAgo(ts);
      h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">';
      h += '<span style="font-size:10px;color:var(--tx3);min-width:50px">' + ago + '</span>';
      h += '<span style="font-size:11px;color:var(--tx)">' + esc(d.action || d.type || 'agent_event') + '</span>';
      h += '<span style="font-size:10px;color:var(--tx3);flex:1;text-align:right">' + esc(d.agentName || d.agent || '') + '</span>';
      h += '</div>';
    });
    el.innerHTML = h;
  }).catch(function(e) {
    var el = document.getElementById('aiops_activity');
    if (el) el.innerHTML = '<div style="color:var(--rd);font-size:11px;text-align:center;padding:20px">Error: ' + esc(e.message) + '</div>';
  });
}

// ═══════════════════════════════════════════════
// 6. TAB B — RECOMMENDATIONS
// ═══════════════════════════════════════════════

function _renderRecsTab(el) {
  el.innerHTML = '<div id="aiops_recs"></div>';
  if (MFXAi.renderRecommendationList) MFXAi.renderRecommendationList('aiops_recs');
  else el.innerHTML = '<div style="color:var(--tx3);font-size:12px;text-align:center;padding:40px">Recommendation module not loaded</div>';
}

// ═══════════════════════════════════════════════
// 7. TAB C — APPROVALS
// ═══════════════════════════════════════════════

function _renderApprovalsTab(el) {
  var h = '<div id="aiops_approvals" style="margin-bottom:20px"></div>';
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin:16px 0 10px">History</div>';
  h += '<div id="aiops_history"></div>';
  el.innerHTML = h;
  if (MFXAi.renderApprovalQueue) MFXAi.renderApprovalQueue('aiops_approvals');
  if (MFXAi.renderApprovalHistory) MFXAi.renderApprovalHistory('aiops_history');
}

// ═══════════════════════════════════════════════
// 8. TAB D — LEADERSHIP DIGEST
// ═══════════════════════════════════════════════

function _renderDigestTab(el) {
  el.innerHTML = '<div style="color:var(--tx3);font-size:11px;text-align:center;padding:20px">Loading latest digest...</div>';

  if (typeof fbDb === 'undefined') { el.innerHTML = '<div style="color:var(--tx3);padding:40px;text-align:center">Database not available</div>'; return; }

  fbDb.collection('agentRecommendations').where('type','==','digest').orderBy('createdAt','desc').limit(1).get().then(function(snap) {
    if (snap.empty) {
      el.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px">\uD83D\uDCCA</div><div style="font-size:13px;color:var(--tx3)">No leadership digest available yet</div><div style="margin-top:12px"><button class="btn btn-pr" style="font-size:11px" onclick="MFXAi._triggerAgent(\'leadership_agent\')">Generate Now</button></div></div>';
      return;
    }

    var doc = snap.docs[0];
    var d = doc.data();
    var h = '';
    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:12px;padding:20px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">';
    h += '<span style="font-size:20px">\uD83D\uDCCA</span>';
    h += '<div><div style="font-size:14px;font-weight:700;color:var(--tx)">' + esc(d.title || 'Leadership Digest') + '</div>';
    h += '<div style="font-size:10px;color:var(--tx3)">' + _formatDate(d.createdAt) + '</div></div></div>';

    // Summary
    if (d.summary) {
      h += '<div style="font-size:12px;color:var(--tx2);line-height:1.6;margin-bottom:16px;white-space:pre-wrap">' + esc(d.summary) + '</div>';
    }

    // Sections
    if (d.sections && d.sections.length) {
      for (var i = 0; i < d.sections.length; i++) {
        var sec = d.sections[i];
        h += '<div style="margin-bottom:12px;padding:12px;background:var(--bg3);border-radius:8px">';
        h += '<div style="font-size:12px;font-weight:700;color:var(--cy);margin-bottom:4px">' + esc(sec.title || 'Section') + '</div>';
        h += '<div style="font-size:11px;color:var(--tx2);line-height:1.5">' + esc(sec.body || sec.content || '') + '</div>';
        h += '</div>';
      }
    }

    // Key metrics
    if (d.metrics) {
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:12px">';
      var keys = Object.keys(d.metrics);
      for (var j = 0; j < keys.length; j++) {
        h += '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">';
        h += '<div style="font-size:18px;font-weight:800;color:var(--cy)">' + esc(String(d.metrics[keys[j]])) + '</div>';
        h += '<div style="font-size:10px;color:var(--tx3);margin-top:2px">' + esc(keys[j].replace(/_/g,' ')) + '</div>';
        h += '</div>';
      }
      h += '</div>';
    }

    h += '</div>';
    el.innerHTML = h;
  }).catch(function(e) {
    el.innerHTML = '<div style="color:var(--rd);padding:20px;text-align:center;font-size:12px">Error loading digest: ' + esc(e.message) + '</div>';
  });
}

// ═══════════════════════════════════════════════
// 9. TAB E — AGENT ADMIN
// ═══════════════════════════════════════════════

function _renderAdminTab(el) {
  var h = '';
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Agent Configuration</div>';

  // Permission check
  h += '<div style="font-size:10px;color:var(--or);margin-bottom:12px">Admin access required to modify agent settings</div>';

  // Config from MFXAi._state
  var agents = MFXAi._state.agents || {};
  var keys = Object.keys(agents);

  if (!keys.length) {
    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:20px;text-align:center">';
    h += '<div style="font-size:12px;color:var(--tx3)">No agent configurations found</div>';
    h += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Set up in Firestore: controlConfigs/aiAgents</div>';
    h += '</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:8px">';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var cfg = agents[k];
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px">';
      h += '<span style="width:8px;height:8px;border-radius:50%;background:' + (cfg.enabled !== false ? '#22c55e' : '#666') + '"></span>';
      h += '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">' + esc(k.replace(/_/g,' ')) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3)">Mode: ' + esc(cfg.approvalMode || 'recommend_only') + '</div></div>';
      h += '<span style="font-size:10px;color:' + (cfg.enabled !== false ? 'var(--gn)' : 'var(--tx3)') + '">' + (cfg.enabled !== false ? 'Active' : 'Disabled') + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }

  // Feature Flags
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin:20px 0 10px">Feature Flags</div>';
  var flags = MFXAi._state.featureFlags || {};
  var fkeys = Object.keys(flags);
  if (!fkeys.length) {
    h += '<div style="font-size:11px;color:var(--tx3)">No feature flags configured</div>';
  } else {
    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:12px">';
    for (var j = 0; j < fkeys.length; j++) {
      h += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr)">';
      h += '<span style="font-size:11px;color:var(--tx)">' + esc(fkeys[j]) + '</span>';
      h += '<span style="font-size:10px;color:' + (flags[fkeys[j]] ? 'var(--gn)' : 'var(--rd)') + '">' + (flags[fkeys[j]] ? 'ON' : 'OFF') + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }

  // Policies summary
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx);margin:20px 0 10px">Governance Policies</div>';
  h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:12px">';
  h += '<div style="font-size:11px;color:var(--tx2);line-height:1.6">';
  h += '\u2022 Blocked auto-actions: release product, close CAPA, approve finances, modify permissions, delete records, override QA hold<br>';
  h += '\u2022 Approval modes: recommend_only, draft_and_approve, auto_execute_low_risk<br>';
  h += '\u2022 All actions logged to _agentAuditLog<br>';
  h += '\u2022 PII redaction enforced on all outputs<br>';
  h += '\u2022 Rate limits: 10 runs/agent/hour, 50 recommendations/day';
  h += '</div></div>';

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════
// 10. TRIGGER AGENT
// ═══════════════════════════════════════════════

MFXAi._triggerAgent = function(agentName) {
  if (typeof toast === 'function') toast('Running ' + agentName.replace(/_/g,' ') + '...', 'info');
  MFXAi.runAgent(agentName, {manual:true}).then(function(result) {
    if (typeof toast === 'function') toast(agentName.replace(/_/g,' ') + ' completed', 'ok');
    // Refresh the current tab
    _renderTab(_activeTab);
  }).catch(function(e) {
    if (typeof toast === 'function') toast('Agent error: ' + (e.message || 'unknown'), 'err');
  });
};

// ═══════════════════════════════════════════════
// 11. HELPERS
// ═══════════════════════════════════════════════

function _timeAgo(d) {
  var diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'now';
  if (diff < 60) return diff + 'm';
  if (diff < 1440) return Math.floor(diff / 60) + 'h';
  return Math.floor(diff / 1440) + 'd';
}

function _formatDate(ts) {
  if (!ts) return '';
  var d = typeof ts === 'string' ? new Date(ts) : (ts.toDate ? ts.toDate() : new Date(ts));
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

window.MFXAi = MFXAi;

})();

// Register view renderer OUTSIDE the IIFE so it always uses the global reference
window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
window.MFX_VIEW_RENDERERS.aiops = function() {
  var el = document.getElementById('v-aiops');
  if (el && window.MFXAi && window.MFXAi.renderOpsCenter) window.MFXAi.renderOpsCenter(el);
  else if (el) el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--tx3)"><h3>AI Operations Center</h3><p>FlexAi is initializing... Please wait a moment and try again.</p></div>';
};
