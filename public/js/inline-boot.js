'use strict';
// ═══════════════════════════════════════════════════════════════
// MFX OS — Inline Boot Scripts (extracted from index.html)
// Removes need for 'unsafe-inline' in CSP script-src
// ═══════════════════════════════════════════════════════════════

// ── Tab scroll fade indicators ──
document.addEventListener('DOMContentLoaded', function() {
  var ts = document.getElementById('tabScroller');
  if (!ts) return;
  function updateFades() {
    var l = document.getElementById('tabFadeLeft');
    var r = document.getElementById('tabFadeRight');
    if (l) l.style.opacity = ts.scrollLeft > 8 ? '1' : '0';
    if (r) r.style.opacity = (ts.scrollLeft + ts.clientWidth < ts.scrollWidth - 8) ? '1' : '0';
  }
  ts.addEventListener('scroll', updateFades, { passive: true });
  setTimeout(updateFades, 500);
});

// ── Login error handling + loading spinner ──
window._mfxLoginPending = false;
window.signInWithGoogle = function() {
  console.log('[MFX-AUTH] signInWithGoogle called');
  if (window._mfxLoginPending) { console.log('[MFX-AUTH] blocked — already pending'); return; }
  window._mfxLoginPending = true;
  var btn = document.getElementById('loginBtn');
  var spinner = document.getElementById('loginSpinner');
  var errBox = document.getElementById('loginError');
  if (btn) btn.style.display = 'none';
  if (spinner) spinner.style.display = 'block';
  if (errBox) errBox.style.display = 'none';
  try {
    console.log('[MFX-AUTH] fbAuth exists:', typeof fbAuth !== 'undefined', '| firebase exists:', typeof firebase !== 'undefined');
    if (typeof fbAuth !== 'undefined' && typeof firebase !== 'undefined') {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
      provider.addScope('https://www.googleapis.com/auth/drive');
      provider.addScope('https://www.googleapis.com/auth/tasks');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.setCustomParameters({ hd: 'microflexfilm.com' });
      console.log('[MFX-AUTH] calling signInWithRedirect...');
      fbAuth.signInWithRedirect(provider).then(function() {
        console.log('[MFX-AUTH] redirect initiated');
      }).catch(function(err) {
        console.error('[MFX-AUTH] signInWithRedirect FAILED:', err.code, err.message);
        _showLoginError('Sign-in error: ' + err.message);
      });
    } else {
      console.error('[MFX-AUTH] firebase or fbAuth not loaded');
      _showLoginError('App is still loading — please wait a moment and try again.');
    }
  } catch(e) {
    console.error('[MFX-AUTH] exception:', e);
    _showLoginError(e.message);
  }
};

function _showLoginError(msg) {
  window._mfxLoginPending = false;
  var btn = document.getElementById('loginBtn');
  var spinner = document.getElementById('loginSpinner');
  var errBox = document.getElementById('loginError');
  if (btn) btn.style.display = 'block';
  if (spinner) spinner.style.display = 'none';
  if (errBox) { errBox.textContent = msg || 'Sign-in failed. Please try again.'; errBox.style.display = 'block'; }
}
window.addEventListener('mfx-auth-error', function(e) { _showLoginError(e.detail); });

// ── Force-clear stale Service Worker + caches (one-time nuke) ──
(function() {
  var NUKE_KEY = 'mfx-sw-nuke-v3';
  if ('caches' in window && !localStorage.getItem(NUKE_KEY)) {
    localStorage.setItem(NUKE_KEY, '1');
    console.log('[MFX-SW] One-time cache nuke — clearing all SW caches...');
    // Unregister all service workers first
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) { r.unregister(); });
      });
    }
    // Delete all caches
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      console.log('[MFX-SW] Caches cleared, reloading...');
      location.reload();
    });
    return; // Stop further execution this load
  }
})();

// ── Register Service Worker for PWA ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function(reg) {
      // Check for updates every 60s
      setInterval(function() { reg.update(); }, 60000);
      // If a new SW is waiting, tell it to activate
      if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
      reg.addEventListener('updatefound', function() {
        var nw = reg.installing;
        if (nw) nw.addEventListener('statechange', function() {
          if (nw.state === 'activated') {
            console.log('[MFX-SW] New SW activated, reloading...');
            location.reload();
          }
        });
      });
    }).catch(function(err) {
      console.warn('SW error:', err);
    });
    // Reload when new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      console.log('[MFX-SW] Controller changed, reloading...');
      location.reload();
    });
  });
}

// ── Global keyboard shortcuts ──
document.addEventListener('keydown', function(e) {
  // Block Backspace from navigating away (browser back) when not in an input
  if (e.key === 'Backspace') {
    var tag = (e.target.tagName || '').toLowerCase();
    var editable = e.target.isContentEditable;
    var isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || editable;
    // Allow backspace in inputs/textareas, block everywhere else
    if (!isInput) {
      e.preventDefault();
      return;
    }
    // Also block if the input is disabled or readonly
    if (e.target.disabled || e.target.readOnly) {
      e.preventDefault();
      return;
    }
  }
  if (e.key === 'Escape') {
    var modal = document.getElementById('modalBg');
    if (modal && modal.classList.contains('open')) { closeModal(); return; }
    var ham = document.getElementById('hamMenu');
    if (ham && ham.classList.contains('open')) { toggleHamburger(); return; }
  }
});
