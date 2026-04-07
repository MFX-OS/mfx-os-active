'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║           AI-MODULE-PANELS.JS — Inline AI Panels for Module Views          ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  1. PANEL CONFIG & MAPPING ........................... ~line 12              ║
// ║  2. PANEL INJECTION .................................. ~line 55              ║
// ║  3. MODULE-SPECIFIC RENDERERS ........................ ~line 110             ║
// ║     A. Quotes — AI Insights .......................... ~line 115             ║
// ║     B. Vendor/Logistics — Stock & Vendor Alerts ...... ~line 155            ║
// ║     C. Compliance — Compliance Watch ................. ~line 195            ║
// ║     D. Production — Job Readiness .................... ~line 235            ║
// ║  4. PANEL CHROME (collapse/expand) ................... ~line 265            ║
// ║  5. GO-VIEW HOOK REGISTRATION ........................ ~line 285            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function(){

var MFXAi = window.MFXAi || {};

// ═══════════════════════════════════════════════
// 1. PANEL CONFIG & MAPPING
// ═══════════════════════════════════════════════

var MODULE_PANELS = {
  quotes: {
    label: 'AI Insights',
    icon: '&#9889;',
    accent: 'var(--cy)',
    module: 'sales',
    renderer: '_renderQuotesPanel'
  },
  vendorpos: {
    label: 'Stock & Vendor Alerts',
    icon: '&#128230;',
    accent: 'var(--or)',
    module: 'logistics',
    renderer: '_renderLogisticsPanel'
  },
  logistics: {
    label: 'Stock & Vendor Alerts',
    icon: '&#128230;',
    accent: 'var(--or)',
    module: 'logistics',
    renderer: '_renderLogisticsPanel'
  },
  sqfdatalogs: {
    label: 'Compliance Watch',
    icon: '&#128203;',
    accent: 'var(--gn)',
    module: 'quality',
    renderer: '_renderCompliancePanel'
  },
  fsqms: {
    label: 'Compliance Watch',
    icon: '&#128203;',
    accent: 'var(--gn)',
    module: 'quality',
    renderer: '_renderCompliancePanel'
  },
  capa: {
    label: 'Compliance Watch',
    icon: '&#128203;',
    accent: 'var(--gn)',
    module: 'quality',
    renderer: '_renderCompliancePanel'
  },
  training: {
    label: 'Compliance Watch',
    icon: '&#128203;',
    accent: 'var(--gn)',
    module: 'quality',
    renderer: '_renderCompliancePanel'
  },
  production: {
    label: 'Job Readiness',
    icon: '&#9881;',
    accent: 'var(--ac)',
    module: 'production',
    renderer: '_renderProductionPanel'
  },
  jobtracker: {
    label: 'Job Readiness',
    icon: '&#9881;',
    accent: 'var(--ac)',
    module: 'production',
    renderer: '_renderProductionPanel'
  }
};

// ═══════════════════════════════════════════════
// 2. PANEL INJECTION
// ═══════════════════════════════════════════════

MFXAi.injectModulePanel = function(viewName) {
  if (!MFXAi.isEnabled || !MFXAi.isEnabled()) return;
  var cfg = MODULE_PANELS[viewName];
  if (!cfg) return;

  // Remove any existing panel
  var existing = document.getElementById('aiPanel_' + viewName);
  if (existing) existing.remove();

  // Find the main content area to inject into
  var mainEl = $('main') || document.querySelector('.view-content') || document.querySelector('[id$="View"]');
  if (!mainEl) return;

  // Fetch relevant recommendations for this module
  var recs = (MFXAi._state.recommendations || []).filter(function(r) {
    return r.module === cfg.module && (r.status === 'pending_approval' || r.status === 'approved');
  });

  // Also try fetching fresh if cache is stale
  if (!MFXAi._state.lastRefresh || Date.now() - MFXAi._state.lastRefresh > 120000) {
    MFXAi.getRecommendations({ module: cfg.module }).then(function(fresh) {
      var filtered = fresh.filter(function(r) { return r.status === 'pending_approval' || r.status === 'approved'; });
      if (filtered.length) _injectPanel(mainEl, viewName, cfg, filtered);
    }).catch(function() {});
    // Still try with cached data
    if (recs.length) _injectPanel(mainEl, viewName, cfg, recs);
    return;
  }

  if (!recs.length) return;
  _injectPanel(mainEl, viewName, cfg, recs);
};

function _injectPanel(mainEl, viewName, cfg, recs) {
  // Don't duplicate
  if (document.getElementById('aiPanel_' + viewName)) return;

  var panel = document.createElement('div');
  panel.id = 'aiPanel_' + viewName;
  panel.className = 'ai-panel';
  panel.style.cssText = 'background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid ' + cfg.accent + ';border-radius:8px;margin-bottom:12px;overflow:hidden';

  var collapsed = localStorage.getItem('aiPanel_' + viewName + '_collapsed') === '1';

  var h = '';
  // Header
  h += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer" onclick="MFXAi._togglePanel(\'' + viewName + '\')">';
  h += '<span style="font-size:14px">' + cfg.icon + '</span>';
  h += '<span style="font-size:12px;font-weight:700;color:' + cfg.accent + '">' + cfg.label + '</span>';
  h += '<span style="background:' + cfg.accent + ';color:#000;font-size:9px;font-weight:700;border-radius:50%;min-width:18px;height:18px;line-height:18px;text-align:center;display:inline-block">' + recs.length + '</span>';
  h += '<span style="margin-left:auto;font-size:10px;color:var(--tx3)" id="aiPanelChevron_' + viewName + '">' + (collapsed ? '&#9654;' : '&#9660;') + '</span>';
  h += '</div>';

  // Body
  h += '<div id="aiPanelBody_' + viewName + '" style="padding:0 12px 10px 12px;' + (collapsed ? 'display:none' : '') + '">';

  // Render module-specific content
  if (typeof MFXAi[cfg.renderer] === 'function') {
    h += MFXAi[cfg.renderer](recs);
  } else {
    h += _renderGenericPanel(recs);
  }

  h += '</div>';

  panel.innerHTML = h;
  mainEl.insertBefore(panel, mainEl.firstChild);
}

// ═══════════════════════════════════════════════
// 3. MODULE-SPECIFIC RENDERERS
// ═══════════════════════════════════════════════

// --- A. Quotes: AI Insights ---
MFXAi._renderQuotesPanel = function(recs) {
  var h = '';
  var risks = recs.filter(function(r) { return r.tags && r.tags.indexOf('risk') >= 0; });
  var followups = recs.filter(function(r) { return r.tags && r.tags.indexOf('followup') >= 0; });
  var other = recs.filter(function(r) { return (!r.tags || (r.tags.indexOf('risk') < 0 && r.tags.indexOf('followup') < 0)); });

  if (risks.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:4px">Quote Risks (' + risks.length + ')</div>';
    for (var i = 0; i < Math.min(risks.length, 3); i++) {
      h += _miniCard(risks[i]);
    }
  }
  if (followups.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--cy);margin-bottom:4px;margin-top:6px">Aging Follow-ups (' + followups.length + ')</div>';
    for (var j = 0; j < Math.min(followups.length, 3); j++) {
      h += _miniCard(followups[j]);
    }
  }
  if (other.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--tx2);margin-bottom:4px;margin-top:6px">Suggested Actions (' + other.length + ')</div>';
    for (var k = 0; k < Math.min(other.length, 3); k++) {
      h += _miniCard(other[k]);
    }
  }
  if (!h) h = _renderGenericPanel(recs);
  if (recs.length > 3) h += '<div style="font-size:10px;color:var(--cy);cursor:pointer;margin-top:6px" onclick="goView(\'aiops\')">View all ' + recs.length + ' recommendations &rarr;</div>';
  return h;
};

// --- B. Vendor/Logistics: Stock & Vendor Alerts ---
MFXAi._renderLogisticsPanel = function(recs) {
  var h = '';
  var lowStock = recs.filter(function(r) { return r.tags && r.tags.indexOf('low_stock') >= 0; });
  var overdue = recs.filter(function(r) { return r.tags && r.tags.indexOf('overdue') >= 0; });
  var other = recs.filter(function(r) { return (!r.tags || (r.tags.indexOf('low_stock') < 0 && r.tags.indexOf('overdue') < 0)); });

  if (lowStock.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--rd);margin-bottom:4px">Low Stock Alerts (' + lowStock.length + ')</div>';
    for (var i = 0; i < Math.min(lowStock.length, 3); i++) h += _miniCard(lowStock[i]);
  }
  if (overdue.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:4px;margin-top:6px">Overdue POs (' + overdue.length + ')</div>';
    for (var j = 0; j < Math.min(overdue.length, 3); j++) h += _miniCard(overdue[j]);
  }
  if (other.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--tx2);margin-bottom:4px;margin-top:6px">Other Alerts (' + other.length + ')</div>';
    for (var k = 0; k < Math.min(other.length, 2); k++) h += _miniCard(other[k]);
  }
  if (!h) h = _renderGenericPanel(recs);
  if (recs.length > 3) h += '<div style="font-size:10px;color:var(--cy);cursor:pointer;margin-top:6px" onclick="goView(\'aiops\')">View all &rarr;</div>';
  return h;
};

// --- C. Compliance: Compliance Watch ---
MFXAi._renderCompliancePanel = function(recs) {
  var h = '';
  var training = recs.filter(function(r) { return r.tags && r.tags.indexOf('training_expiry') >= 0; });
  var ncr = recs.filter(function(r) { return r.tags && r.tags.indexOf('ncr_pattern') >= 0; });
  var audit = recs.filter(function(r) { return r.tags && r.tags.indexOf('audit') >= 0; });
  var other = recs.filter(function(r) {
    return !r.tags || (r.tags.indexOf('training_expiry') < 0 && r.tags.indexOf('ncr_pattern') < 0 && r.tags.indexOf('audit') < 0);
  });

  if (training.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:4px">Training Expirations (' + training.length + ')</div>';
    for (var i = 0; i < Math.min(training.length, 3); i++) h += _miniCard(training[i]);
  }
  if (ncr.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--rd);margin-bottom:4px;margin-top:6px">NCR Patterns (' + ncr.length + ')</div>';
    for (var j = 0; j < Math.min(ncr.length, 3); j++) h += _miniCard(ncr[j]);
  }
  if (audit.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--cy);margin-bottom:4px;margin-top:6px">Audit Prep (' + audit.length + ')</div>';
    for (var k = 0; k < Math.min(audit.length, 2); k++) h += _miniCard(audit[k]);
  }
  if (other.length) {
    for (var m = 0; m < Math.min(other.length, 2); m++) h += _miniCard(other[m]);
  }
  if (!h) h = _renderGenericPanel(recs);
  if (recs.length > 3) h += '<div style="font-size:10px;color:var(--cy);cursor:pointer;margin-top:6px" onclick="goView(\'aiops\')">View all &rarr;</div>';
  return h;
};

// --- D. Production: Job Readiness ---
MFXAi._renderProductionPanel = function(recs) {
  var h = '';
  var stalled = recs.filter(function(r) { return r.tags && r.tags.indexOf('stalled') >= 0; });
  var missing = recs.filter(function(r) { return r.tags && r.tags.indexOf('missing_input') >= 0; });
  var other = recs.filter(function(r) {
    return !r.tags || (r.tags.indexOf('stalled') < 0 && r.tags.indexOf('missing_input') < 0);
  });

  if (stalled.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--rd);margin-bottom:4px">Stalled Jobs (' + stalled.length + ')</div>';
    for (var i = 0; i < Math.min(stalled.length, 3); i++) h += _miniCard(stalled[i]);
  }
  if (missing.length) {
    h += '<div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:4px;margin-top:6px">Missing Inputs (' + missing.length + ')</div>';
    for (var j = 0; j < Math.min(missing.length, 3); j++) h += _miniCard(missing[j]);
  }
  if (other.length) {
    for (var k = 0; k < Math.min(other.length, 2); k++) h += _miniCard(other[k]);
  }
  if (!h) h = _renderGenericPanel(recs);
  if (recs.length > 3) h += '<div style="font-size:10px;color:var(--cy);cursor:pointer;margin-top:6px" onclick="goView(\'aiops\')">View all &rarr;</div>';
  return h;
};

// --- Generic fallback ---
function _renderGenericPanel(recs) {
  var h = '';
  for (var i = 0; i < Math.min(recs.length, 4); i++) h += _miniCard(recs[i]);
  return h;
}

// Mini card for inline panels
function _miniCard(rec) {
  var SEV_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
  var sc = SEV_COLORS[rec.severity] || '#888';
  var h = '<div style="background:var(--bg3);border-radius:6px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:center;gap:6px">';
  h += '<span style="width:6px;height:6px;border-radius:50%;background:' + sc + ';flex-shrink:0"></span>';
  h += '<span style="font-size:11px;color:var(--tx);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(rec.title || rec.summary || 'Recommendation') + '</span>';
  if (rec.status === 'pending_approval') {
    h += '<span style="font-size:9px;color:var(--or)">pending</span>';
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════
// 4. PANEL CHROME (collapse/expand)
// ═══════════════════════════════════════════════

MFXAi._togglePanel = function(viewName) {
  var body = $('aiPanelBody_' + viewName);
  var chevron = $('aiPanelChevron_' + viewName);
  if (!body) return;
  var isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (chevron) chevron.innerHTML = isHidden ? '&#9660;' : '&#9654;';
  localStorage.setItem('aiPanel_' + viewName + '_collapsed', isHidden ? '0' : '1');
};

// ═══════════════════════════════════════════════
// 5. GO-VIEW HOOK REGISTRATION
// ═══════════════════════════════════════════════

var _prevAfterGoView = window.MFX_AFTER_GO_VIEW;
window.MFX_AFTER_GO_VIEW = function(v) {
  // Chain previous hook
  if (typeof _prevAfterGoView === 'function') _prevAfterGoView(v);
  // Inject AI panel after short delay to let view render
  if (MFXAi.isEnabled && MFXAi.isEnabled()) {
    setTimeout(function() { MFXAi.injectModulePanel(v); }, 200);
  }
};

window.MFXAi = MFXAi;

})();
