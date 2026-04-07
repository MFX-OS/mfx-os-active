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
var _origSignIn = window.signInWithGoogle;
window.signInWithGoogle = function() {
  if (window._mfxLoginPending) return;
  window._mfxLoginPending = true;
  var btn = document.getElementById('loginBtn');
  var spinner = document.getElementById('loginSpinner');
  var errBox = document.getElementById('loginError');
  if (btn) btn.style.display = 'none';
  if (spinner) spinner.style.display = 'block';
  if (errBox) errBox.style.display = 'none';
  if (typeof _origSignIn === 'function') {
    try { _origSignIn(); } catch(e) { _showLoginError(e.message); }
  } else {
    try {
      if (typeof fbAuth !== 'undefined') {
        var provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ hd: 'microflexfilm.com' });
        fbAuth.signInWithPopup(provider).catch(function(err) { _showLoginError(err.message); });
      } else {
        _showLoginError('App is still loading — please wait a moment and try again.');
      }
    } catch(e) { _showLoginError(e.message); }
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

// ── Register Service Worker for PWA ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      /* SW registered */
    }).catch(function(err) {
      console.warn('SW error:', err);
    });
  });
}

// ── Global keyboard shortcuts ──
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modal = document.getElementById('modalBg');
    if (modal && modal.classList.contains('open')) { closeModal(); return; }
    var ham = document.getElementById('hamMenu');
    if (ham && ham.classList.contains('open')) { toggleHamburger(); return; }
  }
});
