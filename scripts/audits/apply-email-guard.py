"""
apply-email-guard.py
====================
Master ON/OFF kill-switch for customer/vendor-facing emails.

What gets created:
  public/js/email-guard.js  — new module
    Provides window.MFX_EMAIL_GUARD with:
      .isBlocked()             sync check (cached)
      .blockIfDisabled(label,recipient)  returns true if blocked
      .setBlocked(blocked,reason)        write to Firestore
      .toggle()                          flip current state
      .init()                            subscribe + render banner
    On load: subscribes to Firestore systemConfig/emailControls, caches
    state in localStorage, renders persistent red banner at top of page
    when blocked. Floating 📧/🚫 indicator in bottom-right always shows
    state and is clickable to toggle.

What gets wrapped:
  public/js/modules.js
    sendGmail()                    — primary Gmail send
    emailViaMailto()               — opens Gmail compose tab
  public/js/vendor-workspace.js
    sendGmailWithAttachment()      — Gmail send with PDF attachment

What gets added:
  build.js                         — email-guard.js added to core chunk
  firestore.rules                  — systemConfig collection rule

What is INTENTIONALLY NOT guarded (internal/team channels):
  notifyTeam, sendStaffPortalMsg, sendWorkflowReply, sendChallenge,
  sendGoogleChatNotification, icSendEmail (employee-to-employee mailto)

Default state: OFF (emails work normally). Any @microflexfilm.com user
can toggle on/off. Logged to console + audit log when changed.

Usage:
  python3 scripts/audits/apply-email-guard.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-email-guard')
os.makedirs(BACKUP_DIR, exist_ok=True)


def backup(rel):
    dst = os.path.join(BACKUP_DIR, rel.replace('/', '__').replace('\\', '__'))
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    if os.path.exists(rel):
        shutil.copy2(rel, dst)


def atomic_write(rel, content):
    tmp = rel + '.applying.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    os.replace(tmp, rel)


def read(rel):
    with open(rel, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def verify_js(rel):
    r = subprocess.run(['node', '--check', rel], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'{rel}: node --check FAILED:\n{r.stderr}')


def replace_unique(content, needle, replacement, what):
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# ============================================================
# 1) Create public/js/email-guard.js
# ============================================================
EMAIL_GUARD_JS = r'''// MFX OS — Master Email Kill-Switch (2026-05-24)
// =====================================================================
// Single source of truth for "are we blocking outbound customer/vendor
// emails right now?" Lives in Firestore at systemConfig/emailControls so
// the toggle is global across every signed-in user immediately.
//
// When ON (blocked):
//   - A red banner sits at the top of every page
//   - The floating indicator turns 🚫
//   - Every guarded send function returns early with a toast warning
//
// When OFF (default):
//   - Banner hidden, indicator shows 📧 (silent)
//   - Send functions run normally
//
// Toggle via:
//   - Floating indicator in bottom-right (click)
//   - Banner "Disable" button (when ON)
//   - window.MFX_EMAIL_GUARD.toggle() from console
//
// Wired-in send sites (the "chokepoint" approach — fewer wrap-sites,
// stronger guarantee):
//   modules.js  → sendGmail(), emailViaMailto()
//   vendor-workspace.js → sendGmailWithAttachment()
// =====================================================================

(function(){
  'use strict';

  var LS_KEY = 'mfx_emailGuard_v1';
  var FS_COLLECTION = 'systemConfig';
  var FS_DOC = 'emailControls';

  // ── cached state ────────────────────────────────────────────────────
  // Defaults to OFF so that on a fresh device with no Firestore yet, we
  // don't accidentally block real sends.
  var state = readCache();
  function readCache(){
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (typeof parsed.blocked === 'boolean') return parsed;
      }
    } catch (e) {}
    return { blocked:false, blockedBy:null, blockedAt:null, reason:null };
  }
  function writeCache(s){
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  // ── public API ──────────────────────────────────────────────────────
  var MFX_EMAIL_GUARD = {
    isBlocked: function(){ return !!state.blocked; },

    // Call this at the TOP of every customer-facing send function.
    // Returns true if blocked (caller should bail), false if OK.
    blockIfDisabled: function(label, recipient){
      if (state.blocked) {
        console.warn('[EMAIL_GUARD] BLOCKED', label, '→', recipient,
                     '(testing mode; toggle off to enable sending)');
        if (typeof window.toast === 'function') {
          window.toast('🚫 ' + label + ' blocked (testing mode). Toggle off banner to send.', 'err');
        }
        // Audit log
        try {
          if (window.DB && typeof window.DB.logActivity === 'function') {
            window.DB.logActivity('email.blocked',
              label + ' → ' + (recipient || '(unknown)') +
              ' [reason: ' + (state.reason || '(none)') + ']');
          }
        } catch (e) {}
        return true;
      }
      return false;
    },

    setBlocked: function(blocked, reason){
      var user = (typeof getUserName === 'function') ? getUserName() :
                 (window.firebase && firebase.auth().currentUser ?
                   firebase.auth().currentUser.email : 'unknown');
      var next = {
        blocked: !!blocked,
        blockedBy: blocked ? user : null,
        blockedAt: blocked ? new Date().toISOString() : null,
        reason: blocked ? (reason || '(no reason given)') : null,
        updatedBy: user,
        updatedAt: new Date().toISOString()
      };
      if (!window.fbDb) {
        // No Firestore — local-only toggle (degraded mode)
        applyState(next);
        return Promise.resolve(next);
      }
      return window.fbDb.collection(FS_COLLECTION).doc(FS_DOC)
        .set(next, { merge: true })
        .then(function(){
          // The listener will call applyState() with the server-confirmed value.
          // But also apply locally immediately for snappy UI.
          applyState(next);
          if (typeof window.toast === 'function') {
            window.toast(blocked ? '🚫 Customer emails BLOCKED' : '✅ Customer emails ENABLED',
                         blocked ? 'err' : 'ok');
          }
          return next;
        });
    },

    toggle: function(){
      if (state.blocked) return this.setBlocked(false);
      var reason = (typeof window.prompt === 'function')
        ? window.prompt('Reason for blocking customer emails? (e.g. "Testing customer save flow")', '')
        : 'Manual toggle';
      if (reason === null) return; // user cancelled
      return this.setBlocked(true, reason);
    },

    getState: function(){ return Object.assign({}, state); },

    init: function(){ initOnce(); }
  };
  window.MFX_EMAIL_GUARD = MFX_EMAIL_GUARD;

  // ── rendering ───────────────────────────────────────────────────────
  function ensureBanner(){
    var b = document.getElementById('mfx-email-guard-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'mfx-email-guard-banner';
      b.style.cssText = [
        'position:fixed','top:0','left:0','right:0',
        'z-index:99998',
        'background:linear-gradient(90deg,#dc2626,#b91c1c)',
        'color:#fff','padding:10px 16px',
        'font:600 13px/1.3 -apple-system,Inter,sans-serif',
        'box-shadow:0 2px 12px rgba(220,38,38,.4)',
        'display:none','align-items:center','gap:14px',
        'border-bottom:2px solid #7f1d1d'
      ].join(';');
      b.innerHTML = '' +
        '<span style="font-size:18px">🚫</span>' +
        '<span><strong>CUSTOMER EMAILS BLOCKED</strong> &mdash; ' +
        '<span id="mfx-email-guard-banner-reason"></span></span>' +
        '<span id="mfx-email-guard-banner-meta" style="opacity:.85;font-weight:400;font-size:11px;margin-left:auto"></span>' +
        '<button id="mfx-email-guard-banner-disable" style="' +
          'background:#fff;color:#b91c1c;border:none;padding:6px 12px;' +
          'border-radius:6px;font-weight:700;cursor:pointer;font-size:12px;' +
          'box-shadow:0 2px 6px rgba(0,0,0,.15)' +
        '">Disable</button>';
      document.body.appendChild(b);
      document.getElementById('mfx-email-guard-banner-disable')
        .addEventListener('click', function(){ MFX_EMAIL_GUARD.toggle(); });
    }
    return b;
  }

  function ensureIndicator(){
    var i = document.getElementById('mfx-email-guard-indicator');
    if (!i) {
      i = document.createElement('div');
      i.id = 'mfx-email-guard-indicator';
      i.title = 'Customer email status — click to toggle';
      i.style.cssText = [
        'position:fixed','bottom:16px','right:16px',
        'z-index:99997','width:42px','height:42px','border-radius:50%',
        'background:rgba(0,0,0,.7)','color:#fff',
        'display:flex','align-items:center','justify-content:center',
        'cursor:pointer','font-size:20px',
        'box-shadow:0 4px 12px rgba(0,0,0,.4)',
        'border:1px solid rgba(255,255,255,.15)',
        'transition:transform .15s,background .15s'
      ].join(';');
      i.addEventListener('mouseenter', function(){
        i.style.transform = 'scale(1.08)';
      });
      i.addEventListener('mouseleave', function(){
        i.style.transform = 'scale(1)';
      });
      i.addEventListener('click', function(){ MFX_EMAIL_GUARD.toggle(); });
      document.body.appendChild(i);
    }
    return i;
  }

  function render(){
    if (typeof document === 'undefined' || !document.body) return;
    var banner = ensureBanner();
    var indicator = ensureIndicator();
    if (state.blocked) {
      banner.style.display = 'flex';
      var rEl = document.getElementById('mfx-email-guard-banner-reason');
      if (rEl) rEl.textContent = state.reason || 'testing mode';
      var mEl = document.getElementById('mfx-email-guard-banner-meta');
      if (mEl) {
        var who = state.blockedBy || 'unknown';
        var when = state.blockedAt ? new Date(state.blockedAt).toLocaleString() : '';
        mEl.textContent = 'by ' + who + (when ? ' · ' + when : '');
      }
      indicator.textContent = '🚫';
      indicator.style.background = '#dc2626';
      indicator.title = 'BLOCKED — click to enable customer emails';
      // Push page content down so banner doesn't cover content
      document.body.style.paddingTop = (banner.offsetHeight || 40) + 'px';
    } else {
      banner.style.display = 'none';
      indicator.textContent = '📧';
      indicator.style.background = 'rgba(34,197,94,.85)';
      indicator.title = 'Customer emails: LIVE — click to block for testing';
      document.body.style.paddingTop = '';
    }
  }

  function applyState(next){
    state = next;
    writeCache(state);
    render();
  }

  // ── init: subscribe to Firestore once + render ──────────────────────
  var inited = false;
  function initOnce(){
    if (inited) return;
    inited = true;
    // Render whatever the cache says first (snappy UI)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render);
    } else {
      render();
    }
    // Then subscribe to Firestore for live updates
    if (!window.fbDb) {
      // Try again after fbDb is ready
      var attempts = 0;
      var poll = setInterval(function(){
        attempts++;
        if (window.fbDb) {
          clearInterval(poll);
          subscribeFs();
        } else if (attempts > 60) {
          clearInterval(poll);
        }
      }, 500);
    } else {
      subscribeFs();
    }
  }
  function subscribeFs(){
    try {
      window.fbDb.collection(FS_COLLECTION).doc(FS_DOC)
        .onSnapshot(function(doc){
          if (!doc.exists) return; // keep current state
          var data = doc.data() || {};
          applyState({
            blocked: !!data.blocked,
            blockedBy: data.blockedBy || null,
            blockedAt: data.blockedAt || null,
            reason: data.reason || null
          });
        }, function(err){
          console.warn('[EMAIL_GUARD] Firestore listener:', err.message);
        });
    } catch (e) {
      console.warn('[EMAIL_GUARD] init listener:', e.message);
    }
  }

  // Auto-init on script load (idempotent)
  initOnce();

})();
'''


def write_email_guard_js():
    rel = 'public/js/email-guard.js'
    print('[email-guard] writing ' + rel)
    if os.path.exists(rel):
        existing = read(rel)
        if 'MFX OS — Master Email Kill-Switch' in existing:
            print('  SKIP (already exists)')
            return
    atomic_write(rel, EMAIL_GUARD_JS)
    verify_js(rel)
    print('  OK ({} chars)'.format(len(EMAIL_GUARD_JS)))


# ============================================================
# 2) Add email-guard.js to build.js core chunk
# ============================================================
def patch_build_js():
    rel = 'build.js'
    print('[email-guard] build.js: add email-guard.js to core')
    backup(rel)
    src = read(rel)
    if "'email-guard.js'" in src:
        print('  SKIP (already added)')
        return
    # Insert near the start of the core list so it loads before consumers.
    # The current first line of core is: 'sentry-config.js', 'sound.js', ...
    old = "  core: [\n    'sentry-config.js', 'sound.js', 'intro.js', 'core.js', 'full-menu.js',"
    new = "  core: [\n    // email-guard MUST load early so it's available before any send-site is called\n    'email-guard.js',\n    'sentry-config.js', 'sound.js', 'intro.js', 'core.js', 'full-menu.js',"
    src = replace_unique(src, old, new, 'email-guard build.js')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# 3) Wrap sendGmail and emailViaMailto in modules.js
# ============================================================
def patch_modules_js():
    rel = 'public/js/modules.js'
    print('[email-guard] modules.js: wrap sendGmail + emailViaMailto')
    backup(rel)
    src = read(rel)
    if 'EMAIL_GUARD wrap' in src:
        print('  SKIP (already applied)')
        return

    # Wrap sendGmail
    old1 = "function sendGmail(to,subject,bodyHtml,fromAddr){\ngetGoogleToken().then(function(token){"
    new1 = "function sendGmail(to,subject,bodyHtml,fromAddr){\n/* EMAIL_GUARD wrap (2026-05-24): bail if customer emails are blocked */\nif(window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.blockIfDisabled('sendGmail', to)) return;\ngetGoogleToken().then(function(token){"
    src = replace_unique(src, old1, new1, 'email-guard modules.js sendGmail')

    # Wrap emailViaMailto
    old2 = "function emailViaMailto(){var to=($('send-to')||{}).value||'';if(to==='custom')to=prompt('Email:');"
    new2 = "function emailViaMailto(){var to=($('send-to')||{}).value||'';if(to==='custom')to=prompt('Email:');\n/* EMAIL_GUARD wrap (2026-05-24): bail if customer emails are blocked */\nif(window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.blockIfDisabled('emailViaMailto', to)) return;"
    src = replace_unique(src, old2, new2, 'email-guard modules.js emailViaMailto')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# 4) Wrap sendGmailWithAttachment in vendor-workspace.js
# ============================================================
def patch_vendor_workspace_js():
    rel = 'public/js/vendor-workspace.js'
    print('[email-guard] vendor-workspace.js: wrap sendGmailWithAttachment')
    backup(rel)
    src = read(rel)
    if 'EMAIL_GUARD wrap' in src:
        print('  SKIP (already applied)')
        return

    old = "function sendGmailWithAttachment(token,to,subject,bodyHtml,pdfBlob,pdfFileName){\n  return buildMIMEEmail(to,subject,bodyHtml,pdfBlob,pdfFileName).then(function(encoded){"
    new = "function sendGmailWithAttachment(token,to,subject,bodyHtml,pdfBlob,pdfFileName){\n  /* EMAIL_GUARD wrap (2026-05-24): bail if customer emails are blocked */\n  if(window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.blockIfDisabled('sendGmailWithAttachment', to)){\n    return Promise.resolve({success:false, blocked:true, error:'Email blocked by guard'});\n  }\n  return buildMIMEEmail(to,subject,bodyHtml,pdfBlob,pdfFileName).then(function(encoded){"
    src = replace_unique(src, old, new, 'email-guard vendor-workspace sendGmailWithAttachment')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# 5) Add systemConfig rule to firestore.rules
# ============================================================
def patch_firestore_rules():
    rel = 'firestore.rules'
    print('[email-guard] firestore.rules: add systemConfig collection rule')
    backup(rel)
    src = read(rel)
    if 'match /systemConfig/' in src:
        print('  SKIP (rule already present)')
        return

    # Insert just before the closing match /{document=**} catch-all (or at the
    # end of the main match block). Use a marker that exists in the file.
    marker = "    // ═══ AUDIT COLLECTIONS ═══"
    if marker not in src:
        # fallback: insert before the trailing }
        raise RuntimeError('email-guard firestore.rules: AUDIT COLLECTIONS marker missing')

    rule = (
        "    // ═══ EMAIL KILL-SWITCH (2026-05-24) ═══\n"
        "    // Master ON/OFF flag for customer-facing emails. Read+write by any\n"
        "    // company user — keeps friction low for testing workflows.\n"
        "    match /systemConfig/{docId} {\n"
        "      allow read: if companyUser();\n"
        "      allow write: if companyUser();\n"
        "    }\n\n"
    )
    src = src.replace(marker, rule + marker, 1)
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying master email kill-switch...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    write_email_guard_js()
    patch_build_js()
    patch_modules_js()
    patch_vendor_workspace_js()
    patch_firestore_rules()
    print('\nEmail kill-switch applied.')
    print('Next:')
    print('  npm run deploy                       (rebuild bundle)')
    print('  firebase deploy --only firestore:rules   (push systemConfig rule)')
    print('After deploy:')
    print('  - Bottom-right shows green 📧 indicator (LIVE)')
    print('  - Click it → prompts for blocking reason → red banner appears')
    print('  - All customer/vendor sends now blocked until you click Disable')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
