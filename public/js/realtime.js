// ═══ MFX OS — REAL-TIME SYNC MODULE ═══
// Firestore onSnapshot listeners for live data across all users

(function() {
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

var MFX_LISTENERS = {};

// ═══ GLOBAL LISTENER REGISTRY — any module can register listeners for cleanup ═══
window._mfxGlobalListeners = window._mfxGlobalListeners || {};
window.mfxRegisterListener = function(key, unsub) {
  if (window._mfxGlobalListeners[key] && typeof window._mfxGlobalListeners[key] === 'function') {
    window._mfxGlobalListeners[key](); // clean up previous
  }
  window._mfxGlobalListeners[key] = unsub;
};
window.mfxUnregisterListener = function(key) {
  if (window._mfxGlobalListeners[key] && typeof window._mfxGlobalListeners[key] === 'function') {
    window._mfxGlobalListeners[key]();
  }
  delete window._mfxGlobalListeners[key];
};
window.mfxCleanupAllListeners = function() {
  Object.keys(window._mfxGlobalListeners).forEach(function(key) {
    if (typeof window._mfxGlobalListeners[key] === 'function') {
      try { window._mfxGlobalListeners[key](); } catch(e) {}
    }
  });
  window._mfxGlobalListeners = {};
  console.log('[MFX] All global listeners cleaned up');
};

function startRealtimeSync() {
  if (!fbDb) return;
  console.log('🔴 Starting real-time sync...');

  // ═══ QUOTES — handled by core.js startListeners() to avoid duplicates ═══
  // (removed duplicate quotes listener — core.js already manages quotes onSnapshot)

  // ═══ REQUESTS — live updates ═══
  MFX_LISTENERS.requests = fbDb.collection('requests')
    .orderBy('submittedAt', 'desc').limit(50)
    .onSnapshot(function(snap) {
      var me = getUserName();
      var mine = snap.docs.filter(function(d) { return d.data().assignedTo === me && d.data().status === 'pending' });
      // Update inbox badge
      var badge = $('inboxBadge');
      if (badge) {
        if (mine.length > 0) {
          badge.textContent = mine.length;
          badge.style.display = 'flex';
          // Pulse if new
          badge.classList.add('glow-pulse');
          setTimeout(function() { badge.classList.remove('glow-pulse') }, 3000);
        } else {
          badge.style.display = 'none';
        }
      }
      // Desktop notification for new requests
      if (mine.length > 0 && window._lastReqCount !== undefined && mine.length > window._lastReqCount) {
        showDesktopNotification('📨 New Request', mine[0].data().requestType + ' from ' + mine[0].data().submittedBy);
        if (typeof playTone === 'function') playTone(800, 0.15, 0.1);
      }
      window._lastReqCount = mine.length;
      // Refresh if on request views
      if (S.view === 'supportinbox' && typeof openSubmittedRequests === 'function') {
        // Don't auto-refresh if user is typing
        if (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA') {
          // Soft refresh — just update the list
        }
      }
    }, function(err) { console.log('Requests listener err:', err.message) });

  // ═══ TASKS — live updates ═══
  MFX_LISTENERS.tasks = fbDb.collection('tasks')
    .orderBy('createdAt', 'desc').limit(50)
    .onSnapshot(function(snap) {
      window._rtTasks = snap.docs.map(function(d) { return Object.assign({id: d.id}, d.data()) });
      if (S.view === 'dashboard') loadDashTodo(getUserName(), new Date().toISOString().split('T')[0]);
    }, function(err) { console.log('Tasks listener err:', err.message) });

  // ═══ MOOD FEED — live updates (48hr window) ═══
  MFX_LISTENERS.microfeed = fbDb.collection('microfeed')
    .orderBy('timestamp', 'desc').limit(20)
    .onSnapshot(function(snap) {
      if (S.view === 'dashboard' && typeof loadMoodFeed === 'function') loadMoodFeed();
    }, function(err) { console.log('Feed listener err:', err.message) });

  // ═══ PROJECTS — live board updates ═══
  MFX_LISTENERS.projects = fbDb.collection('projects')
    .orderBy('createdAt', 'desc').limit(30)
    .onSnapshot(function(snap) {
      if (S.view === 'supportboard') renderBoardTab(window._boardTab || 0);
    }, function(err) { console.log('Projects listener err:', err.message) });

  // ═══ THREADS — live thread updates ═══
  MFX_LISTENERS.threads = fbDb.collection('threads')
    .orderBy('timestamp', 'desc').limit(20)
    .onSnapshot(function(snap) {
      if (S.view === 'supportboard' && window._boardTab === 3) renderBoardTab(3);
    }, function(err) { console.log('Threads listener err:', err.message) });

  // ═══ ONLINE PRESENCE ═══
  updatePresence();
  MFX_LISTENERS._presenceInterval = setInterval(updatePresence, 60000); // Update every minute

  console.log('✅ 5 real-time listeners active (quotes handled by core.js)');
}

function stopRealtimeSync() {
  Object.keys(MFX_LISTENERS).forEach(function(key) {
    if (typeof MFX_LISTENERS[key] === 'function') {
      MFX_LISTENERS[key](); // unsubscribe
    } else if (key === '_presenceInterval') {
      clearInterval(MFX_LISTENERS[key]);
    }
  });
  MFX_LISTENERS = {};
  // Clean up all globally registered listeners from other modules
  if (typeof window.mfxCleanupAllListeners === 'function') window.mfxCleanupAllListeners();
}

// ═══ SYNC INDICATOR ═══
function flashSyncDot() {
  var dot = $('syncDot');
  if (!dot) {
    dot = document.createElement('div');
    dot.id = 'syncDot';
    dot.style.cssText = 'position:fixed;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:var(--gn);z-index:150;opacity:0;transition:opacity .3s';
    document.body.appendChild(dot);
  }
  dot.style.opacity = '1';
  dot.style.background = 'var(--gn)';
  dot.style.boxShadow = '0 0 8px var(--gn)';
  setTimeout(function() { dot.style.opacity = '0.3'; dot.style.boxShadow = 'none' }, 1500);
}

// ═══ DESKTOP NOTIFICATIONS ═══
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(function(perm) {
      console.log('Notification permission:', perm);
    });
  }
}

function showDesktopNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    var n = new Notification(title, {
      body: body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>',
      tag: 'mfx-' + Date.now(),
      requireInteraction: false
    });
    setTimeout(function() { n.close() }, 5000);
  }
}

// ═══ ONLINE PRESENCE ═══
function updatePresence() {
  if (!fbDb || !getUserId()) return;
  fbDb.collection('users').doc(getUserId()).set({
    name: getUserName(),
    email: getUserEmail(),
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    online: true,
    dept: (getMFXProfile() || {}).dept || '',
    role: (getMFXProfile() || {}).role || ''
  }, { merge: true }).catch(function(e){console.warn('op:',e)});
}

function getOnlineUsers(callback) {
  if (!fbDb) { callback([]); return; }
  var fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  fbDb.collection('users').where('lastSeen', '>', fiveMinAgo).get()
    .then(function(snap) {
      var users = snap.docs.map(function(d) { return Object.assign({id: d.id}, d.data()) });
      callback(users);
    }).catch(function(e) { console.warn('realtimeLoad:',e); callback([]) });
}

// ═══ HOOK INTO AUTH ═══
var _origOnAuth = typeof onAuthChange === 'function' ? onAuthChange : null;
function hookRealtimeAuth() {
  if (!fbAuth) return;
  fbAuth.onAuthStateChanged(function(user) {
    if (user) {
      setTimeout(function() {
        startRealtimeSync();
        requestNotificationPermission();
      }, 2000); // Give other modules time to init
    } else {
      stopRealtimeSync();
    }
  });
}
// Expose functions globally
window.startRealtimeSync = startRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;
window.getOnlineUsers = getOnlineUsers;
window.showDesktopNotification = showDesktopNotification;
window.requestNotificationPermission = requestNotificationPermission;

// Auto-hook on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hookRealtimeAuth);
} else {
  setTimeout(hookRealtimeAuth, 1000);
}

})();
