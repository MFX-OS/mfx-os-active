"""
apply-batch-9-fixes.py
======================
5 safe LOW-severity audit fixes.

Fixes:
  SEC-13   ceo-dash.html      — add @microflexfilm.com domain check to onAuthStateChanged
  SEC-14   firestore.rules    — anonymousFeedback create now requires companyUser (not just signedIn)
  UX-13    core.js            — statusReel "is online" post throttled to once per hour per browser
  UX-16    modules.js         — admin unlock now also un-mutes parent .fg and focuses the input
  UX-18    vendor-pos.js      — Auto-Reorder button disabled when material has no preferredVendor

Deferred from LOW list (real work needed):
  PERF-15  MATS lazy-load     — would need build.js + core.js changes; modest win on top of PERF-09
  DATA-15  Quote ID server    — clients depend on client-side IDs for offline. Server validation
                                possible but needs careful planning
  SEC-11   Giphy key rotation — manual: rotate key in Giphy console, then proxy through CF function
  SEC-12   CSP unsafe-inline  — huge refactor (every inline onclick) plus pre-compiled JSX for ceo-dash
  UX-15    HACCP/mockrecall back button — touches separate full HTML pages, structural change
  UX-17    Dept-home cosmetic — already mostly addressed by UX-01 in batch 4

Usage:
  python3 scripts/audits/apply-batch-9-fixes.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch9')
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
# SEC-13 — ceo-dash.html domain check
# ============================================================
def fix_sec_13():
    print('[SEC-13] ceo-dash.html: add @microflexfilm.com domain check')
    rel = 'public/ceo-dash.html'
    backup(rel)
    src = read(rel)
    if 'SEC-13 fix' in src:
        print('  SKIP (already applied)')
        return
    old = """        const unsubscribe = auth.onAuthStateChanged((authUser) => {
          if (authUser) {
            setUser(authUser);
            setShowAuthModal(false);
            fetchData();
          } else {
            setShowAuthModal(true);
            setLoading(false);
          }
        });"""
    new = """        const unsubscribe = auth.onAuthStateChanged((authUser) => {
          if (authUser) {
            // SEC-13 fix (2026-05-24): mirror the @microflexfilm.com domain check
            // from core.js. Firestore rules already gate reads, but this keeps
            // non-company Google accounts from seeing the CEO dashboard UI shell.
            if (authUser.email && !authUser.email.endsWith('@microflexfilm.com') && !authUser.isAnonymous) {
              try { auth.signOut(); } catch (e) { console.warn('signOut:', e); }
              setShowAuthModal(true);
              setLoading(false);
              setTimeout(function(){ alert('Access restricted to @microflexfilm.com accounts only.'); }, 100);
              return;
            }
            setUser(authUser);
            setShowAuthModal(false);
            fetchData();
          } else {
            setShowAuthModal(true);
            setLoading(false);
          }
        });"""
    src = replace_unique(src, old, new, 'SEC-13 ceo-dash domain check')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# SEC-14 — anonymousFeedback rule tighten
# ============================================================
def fix_sec_14():
    print('[SEC-14] firestore.rules: anonymousFeedback create -> companyUser')
    rel = 'firestore.rules'
    backup(rel)
    src = read(rel)
    if 'SEC-14 fix' in src:
        print('  SKIP (already applied)')
        return
    old = """    match /anonymousFeedback/{docId} {
      allow read: if isManagement();
      allow create: if signedIn(); // no userId stored — anonymous
      allow update: if isManagement(); // resolve
    }"""
    new = """    match /anonymousFeedback/{docId} {
      allow read: if isManagement();
      // SEC-14 fix (2026-05-24): tightened from signedIn() to companyUser() so
      // portal clients (non-employees) can't post into the "internal anonymous
      // feedback" collection. Submissions remain anonymous to READERS — we just
      // require the submitter is on the @microflexfilm.com side.
      allow create: if companyUser();
      allow update: if isManagement(); // resolve
    }"""
    src = replace_unique(src, old, new, 'SEC-14 anonymousFeedback')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# UX-13 — throttle statusReel "is online" post
# ============================================================
def fix_ux_13():
    print('[UX-13] core.js: throttle statusReel "is online" to 1/hour per browser')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    if 'UX-13 fix' in src:
        print('  SKIP (already applied)')
        return
    old = """if(typeof fbDb!=='undefined'){try{fbDb.collection('statusReel').add({text:(user.displayName||user.email)+' is online',emoji:'🟢',gif:null,user:'Flex Ai',userId:'system-flexai',dept:'System',createdAt:firebase.firestore.FieldValue.serverTimestamp(),announcement:false,likes:[],replyCount:0,mentions:[],replies:[]})}catch(e){}}"""
    new = """if(typeof fbDb!=='undefined'){try{
  // UX-13 fix (2026-05-24): throttle "<name> is online" posts to once per hour
  // per browser. Previously every page refresh / new tab spammed the feed.
  var _onlineKey = 'mfx_last_online_post_' + (user.uid || user.email || 'anon');
  var _lastOnline = parseInt(localStorage.getItem(_onlineKey) || '0', 10);
  if (Date.now() - _lastOnline > 60*60*1000) {
    localStorage.setItem(_onlineKey, String(Date.now()));
    fbDb.collection('statusReel').add({text:(user.displayName||user.email)+' is online',emoji:'🟢',gif:null,user:'Flex Ai',userId:'system-flexai',dept:'System',createdAt:firebase.firestore.FieldValue.serverTimestamp(),announcement:false,likes:[],replyCount:0,mentions:[],replies:[]});
  }
}catch(e){}}"""
    src = replace_unique(src, old, new, 'UX-13 statusReel throttle')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# UX-16 — admin unlockField also un-mutes parent + focuses
# ============================================================
def fix_ux_16():
    print('[UX-16] modules.js: admin unlockField also un-mutes parent .fg + focuses input')
    rel = 'public/js/modules.js'
    backup(rel)
    src = read(rel)
    if 'UX-16 fix' in src:
        print('  SKIP (already applied)')
        return
    # The current unlockField (post-batch-6) is at modules.js:1411.
    old = "function unlockField(id){var _pu=getMFXProfile();var _ru=(_pu.role||'').toLowerCase();if(['ceo','admin','administrator','owner','operations manager','manager'].includes(_ru)){var el=$(id);if(el){el.disabled=false;el.style.opacity='1'}}else{toast('Unauthorized — admin role required','err')}}"
    new = """function unlockField(id){
  // UX-16 fix (2026-05-24): also un-mute the parent .fg wrapper (which has its
  // own inline opacity), focus the input, and add a subtle 'unlocked' style so
  // the change is visually obvious. Server-side rule still gates the write.
  var _pu=getMFXProfile();
  var _ru=(_pu.role||'').toLowerCase();
  if(!['ceo','admin','administrator','owner','operations manager','manager'].includes(_ru)){
    toast('Unauthorized — admin role required','err');
    return;
  }
  var el=$(id);
  if(!el) return;
  el.disabled=false;
  el.style.opacity='1';
  el.style.borderColor='var(--ac)';
  // Walk up to the .fg wrapper and reset its opacity
  var parent = el.parentElement;
  while(parent && parent !== document.body){
    if(parent.classList && parent.classList.contains('fg')){
      parent.style.opacity='1';
      break;
    }
    parent = parent.parentElement;
  }
  try { el.focus(); el.select && el.select(); } catch(e){}
}"""
    src = replace_unique(src, old, new, 'UX-16 unlockField polish')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# UX-18 — Vendor Auto-Reorder disabled when no preferredVendor
# ============================================================
def fix_ux_18():
    print('[UX-18] vendor-pos.js: Auto-Reorder buttons disabled when no preferredVendor')
    rel = 'public/js/vendor-pos.js'
    backup(rel)
    src = read(rel)
    if 'UX-18 fix' in src:
        print('  SKIP (already applied)')
        return

    # Site 1: line 270 — inline list (short form)
    old1 = "h+='<button class=\"btn btn-ghost btn-xs\" onclick=\"vpAutoReorder(\\''+m.id+'\\')\" style=\"font-size:9px\">Auto-Reorder</button></div></div>';"
    new1 = """// UX-18 fix (2026-05-24): disable Auto-Reorder when no preferred vendor
var _hasVendor1 = !!(m.preferredVendor || m.preferredVendorId || m.vendorId || m.vendor);
h+='<button class="btn btn-ghost btn-xs" '+(_hasVendor1?'onclick="vpAutoReorder(\\''+m.id+'\\')"':'disabled title="Set preferred vendor first"')+' style="font-size:9px'+(_hasVendor1?'':';opacity:.4;cursor:not-allowed')+'">Auto-Reorder</button></div></div>';"""
    src = replace_unique(src, old1, new1, 'UX-18 Auto-Reorder site 1')

    # Site 2: line 947 — Auto-Generate Reorder PO (low-stock alert)
    old2 = "h+='<button class=\"btn btn-pr btn-xs\" onclick=\"vpAutoReorder(\\''+m.id+'\\')\" style=\"margin-top:6px;width:100%\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"16.5\" y1=\"9.4\" x2=\"7.5\" y2=\"4.21\"/><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/><polyline points=\"3.27 6.96 12 12.01 20.73 6.96\"/><line x1=\"12\" y1=\"22.08\" x2=\"12\" y2=\"12\"/></svg> Auto-Generate Reorder PO</button>';"
    new2 = """// UX-18 fix (2026-05-24): disable Auto-Generate Reorder PO when no preferred vendor
var _hasVendor2 = !!(m.preferredVendor || m.preferredVendorId || m.vendorId || m.vendor);
h+='<button class="btn btn-pr btn-xs" '+(_hasVendor2?'onclick="vpAutoReorder(\\''+m.id+'\\')"':'disabled title="Set preferred vendor first"')+' style="margin-top:6px;width:100%'+(_hasVendor2?'':';opacity:.4;cursor:not-allowed')+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Auto-Generate Reorder PO</button>';"""
    src = replace_unique(src, old2, new2, 'UX-18 Auto-Reorder site 2')

    # Site 3: line 994 — Reorder button (single button row)
    old3 = "h+='<button class=\"btn btn-pr btn-xs\" onclick=\"vpAutoReorder(\\''+m.id+'\\')\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"16.5\" y1=\"9.4\" x2=\"7.5\" y2=\"4.21\"/><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/><polyline points=\"3.27 6.96 12 12.01 20.73 6.96\"/><line x1=\"12\" y1=\"22.08\" x2=\"12\" y2=\"12\"/></svg> Reorder</button>';"
    new3 = """// UX-18 fix (2026-05-24): disable Reorder when no preferred vendor
var _hasVendor3 = !!(m.preferredVendor || m.preferredVendorId || m.vendorId || m.vendor);
h+='<button class="btn btn-pr btn-xs" '+(_hasVendor3?'onclick="vpAutoReorder(\\''+m.id+'\\')"':'disabled title="Set preferred vendor first"')+(_hasVendor3?'':' style="opacity:.4;cursor:not-allowed"')+'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Reorder</button>';"""
    src = replace_unique(src, old3, new3, 'UX-18 Auto-Reorder site 3')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK (3 button render sites guarded)')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying BATCH 9 (5 LOW fixes)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_sec_13()
    fix_sec_14()
    fix_ux_13()
    fix_ux_16()
    fix_ux_18()
    print('\nAll BATCH 9 fixes applied.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
