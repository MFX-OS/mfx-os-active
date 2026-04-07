'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    AI-CORE.JS — FlexAi Runtime Bridge                      ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  1. STATE & EVENT BUS ................................ ~line 10              ║
// ║  2. INIT & FEATURE FLAGS ............................. ~line 40              ║
// ║  3. API TRANSPORT .................................... ~line 75              ║
// ║  4. AGENT & RECOMMENDATION HELPERS ................... ~line 120             ║
// ║  5. AUTO-REFRESH LOOP ................................ ~line 165             ║
// ║  6. EXPORTS .......................................... ~line 195             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function(){

// ═══════════════════════════════════════════════
// 1. STATE & EVENT BUS
// ═══════════════════════════════════════════════

var MFXAi = window.MFXAi || {};

MFXAi._state = {
  enabled: false,
  recommendations: [],
  health: {},
  lastRefresh: null,
  agents: {},
  featureFlags: {}
};

var _listeners = {};

MFXAi.on = function(event, cb) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(cb);
};

MFXAi.emit = function(event, data) {
  var cbs = _listeners[event] || [];
  for (var i = 0; i < cbs.length; i++) {
    try { cbs[i](data); } catch(e) { console.warn('MFXAi event error:', event, e); }
  }
};

// ═══════════════════════════════════════════════
// 2. INIT & FEATURE FLAGS
// ═══════════════════════════════════════════════

MFXAi.init = function() {
  if (typeof fbDb === 'undefined') { console.warn('MFXAi.init: fbDb not ready'); return Promise.resolve(false); }
  return fbDb.collection('controlConfigs').doc('aiAgents').get().then(function(snap) {
    if (snap.exists) {
      var cfg = snap.data();
      MFXAi._state.enabled = cfg.enabled !== false;
      MFXAi._state.featureFlags = cfg.featureFlags || {};
      MFXAi._state.agents = cfg.agents || {};
      console.log('FlexAi initialized — enabled:', MFXAi._state.enabled);
    } else {
      MFXAi._state.enabled = false;
      console.log('FlexAi: no aiAgents config found, disabled');
    }
    if (MFXAi._state.enabled) MFXAi._startAutoRefresh();
    return MFXAi._state.enabled;
  }).catch(function(e) {
    console.warn('MFXAi.init error:', e.message);
    MFXAi._state.enabled = false;
    return false;
  });
};

MFXAi.isEnabled = function() {
  return MFXAi._state.enabled === true;
};

// ═══════════════════════════════════════════════
// 3. API TRANSPORT
// ═══════════════════════════════════════════════

function _getAuthHeaders() {
  if (typeof getMFXAuthHeaders === 'function') return getMFXAuthHeaders();
  if (typeof fbAuth !== 'undefined' && fbAuth.currentUser) {
    return fbAuth.currentUser.getIdToken().then(function(tok) {
      return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok };
    });
  }
  return Promise.resolve({ 'Content-Type': 'application/json' });
}

MFXAi.api = function(endpoint, data) {
  return _getAuthHeaders().then(function(headers) {
    return fetch('/api/agents/' + endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data || {})
    });
  }).then(function(r) {
    if (!r.ok) throw new Error('AI API error: ' + r.status);
    return r.json();
  });
};

MFXAi.apiGet = function(endpoint, params) {
  return _getAuthHeaders().then(function(headers) {
    var qs = '';
    if (params) {
      var parts = [];
      for (var k in params) { if (params.hasOwnProperty(k) && params[k] != null) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); }
      if (parts.length) qs = '?' + parts.join('&');
    }
    return fetch('/api/agents/' + endpoint + qs, { method: 'GET', headers: headers });
  }).then(function(r) {
    if (!r.ok) throw new Error('AI API GET error: ' + r.status);
    return r.json();
  });
};

// ═══════════════════════════════════════════════
// 4. AGENT & RECOMMENDATION HELPERS
// ═══════════════════════════════════════════════

MFXAi.runAgent = function(agentName, triggerType, sourceCollection, sourceId) {
  return MFXAi.api('run', {
    agent: agentName,
    triggerType: triggerType || 'manual',
    sourceCollection: sourceCollection || null,
    sourceId: sourceId || null,
    triggeredBy: typeof getUserName === 'function' ? getUserName() : 'unknown'
  }).then(function(res) {
    if (typeof toast === 'function') toast('Agent "' + agentName + '" triggered', 'ok');
    MFXAi.emit('agent_run', { agent: agentName, result: res });
    return res;
  });
};

MFXAi.getRecommendations = function(filters) {
  return MFXAi.apiGet('recommendations', filters || {}).then(function(data) {
    MFXAi._state.recommendations = data.recommendations || data || [];
    MFXAi._state.lastRefresh = Date.now();
    MFXAi.emit('recommendation', { recommendations: MFXAi._state.recommendations });
    return MFXAi._state.recommendations;
  });
};

MFXAi.approve = function(recId, notes) {
  return MFXAi.api('recommendations/' + recId + '/approve', {
    approvedBy: typeof getUserName === 'function' ? getUserName() : 'unknown',
    notes: notes || ''
  }).then(function(res) {
    if (typeof toast === 'function') toast('Recommendation approved', 'ok');
    MFXAi.emit('approval', { id: recId, action: 'approved', result: res });
    return res;
  });
};

MFXAi.reject = function(recId, reason) {
  return MFXAi.api('recommendations/' + recId + '/reject', {
    rejectedBy: typeof getUserName === 'function' ? getUserName() : 'unknown',
    reason: reason || ''
  }).then(function(res) {
    if (typeof toast === 'function') toast('Recommendation rejected', 'ok');
    MFXAi.emit('approval', { id: recId, action: 'rejected', result: res });
    return res;
  });
};

MFXAi.getHealth = function() {
  return MFXAi.apiGet('health').then(function(data) {
    MFXAi._state.health = data;
    MFXAi.emit('health_update', data);
    return data;
  });
};

// ═══════════════════════════════════════════════
// 5. AUTO-REFRESH LOOP
// ═══════════════════════════════════════════════

var _refreshTimer = null;
var AI_VIEWS = ['aiops', 'recommendations', 'approvals'];

MFXAi._startAutoRefresh = function() {
  if (_refreshTimer) return;
  _refreshTimer = setInterval(function() {
    if (!MFXAi._state.enabled) return;
    var cv = typeof S !== 'undefined' ? S.view : '';
    var isAiView = AI_VIEWS.indexOf(cv) >= 0;
    if (isAiView) {
      MFXAi.getRecommendations().catch(function(e) { console.warn('AI auto-refresh:', e.message); });
    }
  }, 60000);
};

MFXAi._stopAutoRefresh = function() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
};

// ═══════════════════════════════════════════════
// 6. EXPORTS
// ═══════════════════════════════════════════════

window.MFXAi = MFXAi;

})();
