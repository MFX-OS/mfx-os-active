'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║              AI-CHAT-BRIDGE.JS — FlexAi Chat & Alert Integration           ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  1. EVENT LISTENERS ...................................... ~line 10          ║
// ║  2. ALERT REEL INTEGRATION ............................... ~line 55          ║
// ║  3. CHAT CHANNEL INTEGRATION ............................. ~line 90          ║
// ║  4. NOTIFICATION BADGES .................................. ~line 130         ║
// ║  5. INIT ................................................. ~line 160         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

(function(){

var MFXAi = window.MFXAi || {};
var _realtimeUnsub = null;
var _pendingCount = 0;

// ═══════════════════════════════════════════════
// 1. EVENT LISTENERS — React to MFXAi events
// ═══════════════════════════════════════════════

MFXAi._initChatBridge = function() {
  // Listen for new recommendations
  MFXAi.on('recommendation:new', function(rec) {
    _showRecToast(rec);
    _updateBadge();
  });

  // Listen for approval status changes
  MFXAi.on('approval:completed', function(data) {
    if (typeof toast === 'function') {
      toast('AI action ' + (data.approved ? 'approved' : 'rejected') + ': ' + (data.title || ''), data.approved ? 'ok' : 'info');
    }
  });

  // Listen for agent errors
  MFXAi.on('agent:error', function(data) {
    if (typeof toast === 'function') {
      toast('Agent error: ' + (data.message || 'Unknown'), 'err');
    }
  });

  // Start realtime listener for pending approvals
  _startRealtimeListener();
};

function _showRecToast(rec) {
  if (!rec) return;
  var sev = rec.severity || 'info';
  var type = sev === 'critical' || sev === 'high' ? 'warn' : 'info';
  if (typeof toast === 'function') {
    toast('FlexAi: ' + (rec.title || 'New recommendation'), type);
  }
  // Also push to alert reel if high/critical
  if (sev === 'critical' || sev === 'high') {
    _pushAlertReel(rec);
  }
}

// ═══════════════════════════════════════════════
// 2. ALERT REEL INTEGRATION
// ═══════════════════════════════════════════════

function _pushAlertReel(rec) {
  var reel = document.getElementById('alertReel');
  var inner = document.getElementById('alertReelInner');
  var text = document.getElementById('alertText');
  var flag = document.getElementById('alertFlag');
  if (!reel || !inner || !text) return;

  var colors = { critical: '#ef4444', high: '#f97316' };
  var bgColor = colors[rec.severity] || '#f59e0b';

  flag.textContent = rec.severity === 'critical' ? '🚨' : '⚠️';
  text.textContent = 'FlexAi: ' + (rec.title || 'Action required');
  inner.style.background = bgColor + '18';
  inner.style.borderLeft = '3px solid ' + bgColor;
  inner.style.color = bgColor;
  reel.style.display = 'block';

  // Auto-hide after 10 seconds for non-critical
  if (rec.severity !== 'critical') {
    setTimeout(function() {
      if (reel) reel.style.display = 'none';
    }, 10000);
  }
}

// ═══════════════════════════════════════════════
// 3. CHAT CHANNEL INTEGRATION
// ═══════════════════════════════════════════════

MFXAi.postToFlexAlerts = function(message, metadata) {
  if (typeof fbDb === 'undefined') return Promise.resolve();

  var msg = {
    channel: 'flex-alerts',
    text: message,
    sender: 'FlexAi',
    senderName: 'FlexAi System',
    type: 'system',
    metadata: metadata || {},
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString()
  };

  return fbDb.collection('chatMessages').add(msg).catch(function(e) {
    console.warn('FlexAi chat post failed:', e.message);
  });
};

MFXAi._postAgentResult = function(agentName, result) {
  if (!result) return;
  var text = '🤖 ' + (agentName || 'Agent').replace(/_/g, ' ') + ' completed';
  if (result.recommendationCount) text += ' — ' + result.recommendationCount + ' recommendation(s)';
  if (result.summary) text += '\n' + result.summary;
  MFXAi.postToFlexAlerts(text, { agent: agentName, runId: result.runId || '' });
};

// ═══════════════════════════════════════════════
// 4. NOTIFICATION BADGES
// ═══════════════════════════════════════════════

function _startRealtimeListener() {
  if (typeof fbDb === 'undefined') return;
  if (_realtimeUnsub) { try { _realtimeUnsub(); } catch(e){} }

  try {
    _realtimeUnsub = fbDb.collection('agentRecommendations')
      .where('status', '==', 'pending_approval')
      .onSnapshot(function(snap) {
        _pendingCount = snap.size;
        _updateBadge();
        // Emit event for other modules
        MFXAi.emit('approvals:countChanged', { count: _pendingCount });
      }, function(err) {
        console.warn('FlexAi realtime listener error:', err.message);
      });
  } catch(e) {
    console.warn('FlexAi realtime setup failed:', e.message);
  }
}

function _updateBadge() {
  // Update any AI badge elements in the UI
  var badges = document.querySelectorAll('[data-ai-badge]');
  for (var i = 0; i < badges.length; i++) {
    if (_pendingCount > 0) {
      badges[i].textContent = _pendingCount > 99 ? '99+' : String(_pendingCount);
      badges[i].style.display = 'flex';
    } else {
      badges[i].style.display = 'none';
    }
  }

  // Also update hamburger menu badge if exists
  var hamBadge = document.getElementById('hamAiBadge');
  if (hamBadge) {
    hamBadge.textContent = _pendingCount > 0 ? String(_pendingCount) : '';
    hamBadge.style.display = _pendingCount > 0 ? 'inline-flex' : 'none';
  }
}

MFXAi.getPendingCount = function() { return _pendingCount; };

// ═══════════════════════════════════════════════
// 5. CLEANUP
// ═══════════════════════════════════════════════

MFXAi._cleanupChatBridge = function() {
  if (_realtimeUnsub) { try { _realtimeUnsub(); } catch(e){} _realtimeUnsub = null; }
};

window.MFXAi = MFXAi;

})();
