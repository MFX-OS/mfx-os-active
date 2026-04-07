'use strict';
// ═══════════════════════════════════════════════════════════════
// MFX OS — Accessibility Module (WCAG 2.1 AA)
//
// Provides:
// - Focus trap for modals
// - Keyboard navigation for tabs and menus
// - ARIA live region announcements
// - Page title updates on navigation
// - Role="button" keyboard activation
// ═══════════════════════════════════════════════════════════════

(function() {

// ── ARIA Live Announcer ──
// Creates a visually hidden live region for screen reader announcements
var _announcer = null;
function ensureAnnouncer() {
  if (_announcer) return _announcer;
  _announcer = document.createElement('div');
  _announcer.setAttribute('role', 'status');
  _announcer.setAttribute('aria-live', 'polite');
  _announcer.setAttribute('aria-atomic', 'true');
  _announcer.className = 'sr-only';
  _announcer.id = 'mfxA11yAnnouncer';
  document.body.appendChild(_announcer);
  return _announcer;
}

function announce(message, priority) {
  var el = ensureAnnouncer();
  el.setAttribute('aria-live', priority === 'assertive' ? 'assertive' : 'polite');
  // Clear then set to force re-announcement
  el.textContent = '';
  setTimeout(function() { el.textContent = message; }, 100);
}

// ── Page Title Updates ──
// Updates document.title when views change (WCAG 2.4.2)
var _titleBase = 'MFX OS';
function updatePageTitle(viewName) {
  var titles = {
    dashboard: 'Dashboard', quotes: 'Quotes', orders: 'Orders',
    customers: 'Clients', templates: 'Materials', editor: 'Quote Editor',
    ceodash: 'FlexAi Dashboard', ppd: 'Pre-Press', production: 'Production',
    jobtracker: 'Job Tracker', logistics: 'Logistics', vendorpos: 'Vendor POs',
    vendorprofile: 'Vendor Profile', chat: 'Team Chat', notifications: 'Notifications',
    launchpad: 'Launchpad', datasync: 'Data Sync', clientservices: 'Client Services',
    sales: 'Sales', training: 'Training', audit: 'Audit', gmp: 'GMP',
    capa: 'CAPA', hr: 'Human Resources', operator: 'Operator',
    sqfdatalogs: 'SQF Data Logs', sqfalerts: 'SQF Alerts',
    sqfevidence: 'SQF Evidence', masterauto: 'Master Automation',
    records: 'Controlled Records', fsqms: 'FSQMS'
  };
  var label = titles[viewName] || viewName || 'Home';
  document.title = label + ' — ' + _titleBase;
  announce('Navigated to ' + label);
}

// ── Focus Trap for Modals ──
// Traps Tab key within modal when open (WCAG 2.4.3, 2.1.2)
var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
var _prevFocusModal = null;

function trapFocusInModal() {
  var modal = document.getElementById('modalContent');
  if (!modal) return;
  var focusable = modal.querySelectorAll(FOCUSABLE);
  if (focusable.length === 0) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];

  modal._trapHandler = function(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modal.addEventListener('keydown', modal._trapHandler);
  first.focus();
}

function releaseFocusTrap() {
  var modal = document.getElementById('modalContent');
  if (modal && modal._trapHandler) {
    modal.removeEventListener('keydown', modal._trapHandler);
    modal._trapHandler = null;
  }
  if (_prevFocusModal && _prevFocusModal.focus) {
    try { _prevFocusModal.focus(); } catch(e) {}
    _prevFocusModal = null;
  }
}

// Patch openModal/closeModal if they exist
var _origOpenModal = window.openModal;
var _origCloseModal = window.closeModal;

if (typeof _origOpenModal === 'function') {
  window.openModal = function(html) {
    _prevFocusModal = document.activeElement;
    _origOpenModal(html);
    setTimeout(trapFocusInModal, 100);
  };
}

if (typeof _origCloseModal === 'function') {
  window.closeModal = function() {
    releaseFocusTrap();
    _origCloseModal();
  };
}

// ── Keyboard Navigation for Tabs ──
// Arrow keys move between tabs (WCAG pattern: tabs)
document.addEventListener('keydown', function(e) {
  var tab = document.activeElement;
  if (!tab || tab.getAttribute('role') !== 'tab') return;

  var tabs = Array.prototype.slice.call(tab.parentElement.querySelectorAll('[role="tab"]'));
  var idx = tabs.indexOf(tab);
  if (idx === -1) return;

  var newIdx = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    newIdx = (idx + 1) % tabs.length;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    newIdx = (idx - 1 + tabs.length) % tabs.length;
  } else if (e.key === 'Home') {
    newIdx = 0;
  } else if (e.key === 'End') {
    newIdx = tabs.length - 1;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    tab.click();
    return;
  }

  if (newIdx >= 0) {
    e.preventDefault();
    tabs[idx].setAttribute('tabindex', '-1');
    tabs[newIdx].setAttribute('tabindex', '0');
    tabs[newIdx].focus();
  }
});

// ── role="button" Keyboard Activation ──
// Enter/Space activates elements with role="button" (WCAG 2.1.1)
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var el = document.activeElement;
  if (!el) return;
  if (el.getAttribute('role') === 'button' || (el.hasAttribute('tabindex') && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'INPUT')) {
    if (e.key === ' ') e.preventDefault(); // prevent scroll
    el.click();
  }
});

// ── Hamburger Menu Keyboard Support ──
document.addEventListener('keydown', function(e) {
  var ham = document.getElementById('hamMenu');
  if (!ham || !ham.classList.contains('open')) return;

  if (e.key === 'Escape') {
    if (typeof toggleHamburger === 'function') toggleHamburger();
    var logoBtn = document.getElementById('logoBtn');
    if (logoBtn) logoBtn.focus();
  }
});

// ── goView hook for title updates ──
var _origGoView = window.goView;
if (typeof _origGoView === 'function') {
  window.goView = function(v) {
    _origGoView(v);
    updatePageTitle(v);

    // Update tab aria-selected state
    var tabs = document.querySelectorAll('#mainTabs [role="tab"]');
    tabs.forEach(function(t) {
      var tabView = (t.getAttribute('onclick') || '').match(/goView\('(\w+)'\)/);
      if (tabView) {
        var isActive = tabView[1] === v;
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        t.setAttribute('tabindex', isActive ? '0' : '-1');
        if (isActive) t.classList.add('active');
        else t.classList.remove('active');
      }
    });
  };
}

// ── Expose API ──
window.MFXa11y = {
  announce: announce,
  updateTitle: updatePageTitle,
  trapFocus: trapFocusInModal,
  releaseFocus: releaseFocusTrap
};

})();
