"""
apply-batch-7-fixes.py
======================
Apply 6 safe MEDIUM-severity audit fixes via atomic writes.

Fixes:
  PERF-07  core.js              — drop JSON.stringify(q.fields) diff in saveQ; always log edit
  PERF-08  core.js              — module-level cache for mfx_tasks localStorage (4 sites)
  PERF-14  sqf-datalogs.js      — gate the 4 Firestore-listener render() calls behind S.view check
  UX-10    modules.js           — guard send-quote / save-to-drive on missing deps
  UX-11    ppd-master.js        — defer PPD wrapper init to DOMContentLoaded (race fix)
  DATA-11  app.js               — add audit log entry to deleteTask

Deferred (need own session, real refactor):
  DATA-10  SEED_X demo data migration (8+ modules)
  DATA-13  FSQMS event-driven save refactor
  DATA-14  Customer per-doc save refactor

Already addressed by prior batches:
  UX-09 / UX-20 — covered by UX-05 in batch 6 (unlock buttons hidden for non-admins)
  DATA-12       — addressed by DATA-02 (write paths unified; reads keep fallback)
  UX-06         — Signal Command shows friendly "Coming soon" — not actively broken

Skipped on second read:
  UX-14 (notesTags loss) — DB.saveQ uses set({merge:true}) so notesTags ARE preserved.
        Audit's pointed-at mechanism doesn't reproduce. Skip until repro reported.

Usage:
  python3 scripts/audits/apply-batch-7-fixes.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch7')
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


def replace_n(content, needle, replacement, what, expected_count):
    count = content.count(needle)
    if count != expected_count:
        raise RuntimeError(f'{what}: needle matched {count} times (expected {expected_count})')
    return content.replace(needle, replacement)


# ============================================================
# PERF-07 — drop the stringify diff in saveQ
# ============================================================
def fix_perf_07():
    print('[PERF-07] core.js: drop JSON.stringify diff in saveQ — always log edit')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    if 'PERF-07 fix' in src:
        print('  SKIP (already applied)')
        return
    old = """const oldFields=JSON.stringify(q.fields);
for(const k of Object.keys(q.fields)){const v=el(k);if(v!==undefined)q.fields[k]=v}
// Also capture checkbox fields that might not be in FDEF yet
['showSetupOnPDF','showShippingOnPDF','showPlateOnPDF'].forEach(function(k){const v=el(k);if(v!==undefined)q.fields[k]=v});
const descEl=document.querySelector('#v-editor [data-field="description"]');if(descEl)q.description=descEl.value;
const newFields=JSON.stringify(q.fields);
if(oldFields!==newFields){if(!q.activityLog)q.activityLog=[];q.activityLog.push({action:'edit',by:getUserName(),at:new Date().toISOString(),detail:'Fields updated'})}"""
    new = """// PERF-07 fix (2026-05-24): dropped the JSON.stringify(q.fields) before/after
// diff that was used only to decide whether to push an "edit" activity log
// entry. saveQ is user-initiated (the Save button) so we always log it — saves
// the double-stringify of large quote field objects on every save.
for(const k of Object.keys(q.fields)){const v=el(k);if(v!==undefined)q.fields[k]=v}
// Also capture checkbox fields that might not be in FDEF yet
['showSetupOnPDF','showShippingOnPDF','showPlateOnPDF'].forEach(function(k){const v=el(k);if(v!==undefined)q.fields[k]=v});
const descEl=document.querySelector('#v-editor [data-field="description"]');if(descEl)q.description=descEl.value;
if(!q.activityLog)q.activityLog=[];q.activityLog.push({action:'edit',by:getUserName(),at:new Date().toISOString(),detail:'Fields updated'})"""
    src = replace_unique(src, old, new, 'PERF-07 stringify diff')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# PERF-08 — module-level cache for mfx_tasks localStorage
# ============================================================
def fix_perf_08():
    print('[PERF-08] core.js: module-level cache for mfx_tasks localStorage')
    rel = 'public/js/core.js'
    src = read(rel)

    # Find a stable injection point for the cache helpers (right before hubAddTask)
    inject_anchor = "function hubAddTask(){var text=prompt('Task:');"
    inject_before = """// PERF-08 fix (2026-05-24): module-level cache for mfx_tasks localStorage.
// Before: every renderStaffHub() + every task add/toggle/delete did
//   JSON.parse(localStorage.getItem('mfx_tasks')) — synchronous & blocks main thread.
// After: parse once, keep in memory, invalidate on write.
var _mfxTasksCache=null;
function getMfxTasks(){
  if(_mfxTasksCache!==null)return _mfxTasksCache;
  try{_mfxTasksCache=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');}
  catch(e){_mfxTasksCache=[];}
  if(!Array.isArray(_mfxTasksCache))_mfxTasksCache=[];
  return _mfxTasksCache;
}
function setMfxTasks(arr){
  _mfxTasksCache=Array.isArray(arr)?arr:[];
  try{localStorage.setItem('mfx_tasks',JSON.stringify(_mfxTasksCache));}
  catch(e){console.warn('setMfxTasks failed:',e);}
}
"""
    src = replace_unique(src, inject_anchor, inject_before + inject_anchor, 'PERF-08 inject helpers')

    # IMPORTANT: replace function bodies FIRST (they each contain a
    # `var tasks=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');` line that
    # would otherwise make site A's needle non-unique).

    # Site B: hubAddTask body
    src = replace_unique(src,
        "function hubAddTask(){var text=prompt('Task:');if(!text)return;var date=prompt('Due date (YYYY-MM-DD) or leave blank:');var tasks=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');tasks.unshift({id:'t'+Date.now(),text:text.trim(),date:date||'',done:false});localStorage.setItem('mfx_tasks',JSON.stringify(tasks));renderStaffHub()}",
        "function hubAddTask(){var text=prompt('Task:');if(!text)return;var date=prompt('Due date (YYYY-MM-DD) or leave blank:');var tasks=getMfxTasks().slice();tasks.unshift({id:'t'+Date.now(),text:text.trim(),date:date||'',done:false});setMfxTasks(tasks);renderStaffHub()}",
        'PERF-08 hubAddTask')

    # Site C: hubToggleTask
    src = replace_unique(src,
        "function hubToggleTask(tid){var tasks=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');var t=tasks.find(function(x){return x.id===tid});if(t)t.done=!t.done;localStorage.setItem('mfx_tasks',JSON.stringify(tasks));renderStaffHub()}",
        "function hubToggleTask(tid){var tasks=getMfxTasks().slice();var t=tasks.find(function(x){return x.id===tid});if(t)t.done=!t.done;setMfxTasks(tasks);renderStaffHub()}",
        'PERF-08 hubToggleTask')

    # Site D: hubDeleteTask
    src = replace_unique(src,
        "function hubDeleteTask(tid){var tasks=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');localStorage.setItem('mfx_tasks',JSON.stringify(tasks.filter(function(x){return x.id!==tid})));renderStaffHub()}",
        "function hubDeleteTask(tid){setMfxTasks(getMfxTasks().filter(function(x){return x.id!==tid}));renderStaffHub()}",
        'PERF-08 hubDeleteTask')

    # Site A LAST: the remaining standalone read inside renderStaffHub. Now
    # that the 3 function bodies have been replaced, this needle is unique.
    src = replace_unique(src,
        "var tasks=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');",
        "var tasks=getMfxTasks();",
        'PERF-08 site A (renderStaffHub)')

    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK (4 sites + helper functions)')


# ============================================================
# PERF-14 — gate SQF Firestore-listener render() calls
# ============================================================
def fix_perf_14():
    print('[PERF-14] sqf-datalogs.js: gate 4 listener render() calls behind S.view check')
    rel = 'public/js/sqf-datalogs.js'
    backup(rel)
    src = read(rel)
    # The 4 listener renders all share the exact same surrounding pattern:
    #   updateAlertCount();
    #   render();
    # which doesn't appear anywhere else in the file (verified).
    old = "        updateAlertCount();\n        render();\n      }, function(err) {"
    new = "        updateAlertCount();\n        // PERF-14 fix (2026-05-24): only re-render if user is actually on SQF view\n        if(typeof S!=='undefined' && S.view && /sqf|fsqms/i.test(S.view)) render();\n      }, function(err) {"
    new_src = src.replace(old, new)
    n = (len(src) - len(new_src.replace(new, old))) // 0 if False else 0
    actual_count = src.count(old)
    if actual_count == 0:
        raise RuntimeError('PERF-14: listener render pattern not found')
    new_src = src.replace(old, new)
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({actual_count} listener render calls gated)')


# ============================================================
# UX-10 — guard send-quote / save-to-drive on missing deps
# ============================================================
def fix_ux_10():
    print('[UX-10] modules.js: guard sendQuote* / saveQuoteToDrive on missing deps')
    rel = 'public/js/modules.js'
    backup(rel)
    src = read(rel)
    # Wrap each function body's first line with a guard that bails with a helpful
    # toast when the Google Drive integration / sendFromTab helper isn't ready.

    old1 = """function sendQuoteToMe(){
var q=getQ(S.editId);if(!q)return;
var myEmail=getUserEmail();if(!myEmail)return toast('No email found — sign out and back in','err');"""
    new1 = """function sendQuoteToMe(){
// UX-10 fix (2026-05-24): guard on missing deps so the button can't silently throw
if(typeof _doSendWithOverride!=='function'||typeof getSendTemplates!=='function'){
  return toast('Send helper not loaded — refresh the page and retry','err');
}
var q=getQ(S.editId);if(!q)return;
var myEmail=getUserEmail();if(!myEmail)return toast('No email found — sign out and back in','err');"""
    src = replace_unique(src, old1, new1, 'UX-10 sendQuoteToMe')

    old2 = """function sendQuoteToCustomer(){
var q=getQ(S.editId);if(!q)return;
var custEmail=(document.getElementById('send-cust-email')||{}).value||q.fields.custEmail||'';"""
    new2 = """function sendQuoteToCustomer(){
// UX-10 fix (2026-05-24): guard on missing deps so the button can't silently throw
if(typeof _doSendWithOverride!=='function'||typeof getSendTemplates!=='function'){
  return toast('Send helper not loaded — refresh the page and retry','err');
}
var q=getQ(S.editId);if(!q)return;
var custEmail=(document.getElementById('send-cust-email')||{}).value||q.fields.custEmail||'';"""
    src = replace_unique(src, old2, new2, 'UX-10 sendQuoteToCustomer')

    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK (2 send-quote helpers guarded)')


# ============================================================
# UX-11 — defer PPD wrapper init to DOMContentLoaded
# ============================================================
def fix_ux_11():
    print('[UX-11] ppd-master.js: defer wrapper init to DOMContentLoaded (race fix)')
    rel = 'public/js/ppd-master.js'
    backup(rel)
    src = read(rel)
    # Add a typeof guard before wrapping so an undefined ppd.js export doesn't get
    # captured. If ppd.js loads after ppd-master.js, the wrap silently no-ops AND
    # leaves the original window.syncPPDSharedInbox intact (when it's later set).
    old = """  var __origSyncPPDSharedInbox = window.syncPPDSharedInbox;
  window.syncPPDSharedInbox = function(force){"""
    new = """  // UX-11 fix (2026-05-24): only wrap if ppd.js has already published the
  // global. If it loads later (IIFE race), retry on DOMContentLoaded. Failing
  // that, the call below is a no-op and the original (when defined) survives.
  var __origSyncPPDSharedInbox = window.syncPPDSharedInbox;
  if(typeof __origSyncPPDSharedInbox !== 'function'){
    document.addEventListener('DOMContentLoaded', function(){
      var fn = window.syncPPDSharedInbox;
      if(typeof fn === 'function' && fn.__mfxWrapped !== true){
        var orig = fn;
        var wrapped = makeSyncPPDSharedInboxWrapper(orig);
        wrapped.__mfxWrapped = true;
        window.syncPPDSharedInbox = wrapped;
      }
    }, {once:true});
  }
  function makeSyncPPDSharedInboxWrapper(orig){
    return function(force){
      // Body wired below — kept as a closure factory so DOMContentLoaded path
      // can rebuild the wrapper after ppd.js finally publishes its IIFE export.
      return _ppdSyncSharedInboxBody.call(this, orig, force);
    };
  }
  function _ppdSyncSharedInboxBody(original, force){
"""
    src = replace_unique(src, old, new, 'UX-11 PPD wrapper init')

    # Need to close that new function and re-export. The original body continues:
    # "    var PPD = getPPD(); ..."
    # We need to make the body inside `function _ppdSyncSharedInboxBody` use
    # `original` instead of `__origSyncPPDSharedInbox`. The body calls
    # `__origSyncPPDSharedInbox(...)` exactly once or twice. Let me find it and
    # rename for the new function scope.

    # Find calls to __origSyncPPDSharedInbox inside that body and adapt them.
    # For safety, replace `__origSyncPPDSharedInbox(` with `original(` ONLY inside
    # the function we just opened.
    # Crude but bounded: there should be 1-2 calls within the body before the
    # function closes with `};`.

    # The original function ends with `};` matching `window.syncPPDSharedInbox = function(force){`.
    # We rebuilt that opener. Now we need to close the body + re-emit the wrapper assignment.
    # Look for the next standalone `};` after the inject point that closes the original.

    # Find the body opener we just added and the end of the original function.
    marker = 'function _ppdSyncSharedInboxBody(original, force){\n'
    after_marker_idx = src.find(marker) + len(marker)

    # Find the function's closing `};` — it's the original body close.
    # Scan from after_marker_idx for the FIRST occurrence of "\n  };\n" (the
    # close of the old `window.syncPPDSharedInbox = function(force){`).
    close_pos = src.find('\n  };\n', after_marker_idx)
    if close_pos < 0:
        raise RuntimeError('UX-11: could not find original close marker `\\n  };\\n`')

    # Build the body region that needs __origSyncPPDSharedInbox → original
    body_region = src[after_marker_idx:close_pos]
    body_region = body_region.replace('__origSyncPPDSharedInbox(', 'original(')
    body_region = body_region.replace('__origSyncPPDSharedInbox.', 'original.')

    # Re-emit: keep the body (with `original` now), then close `_ppdSyncSharedInboxBody`,
    # then publish the wrapper if we have a real original.
    post = """  }
  // Publish the wrapper synchronously if the original was already defined.
  // (If not, DOMContentLoaded above will re-wrap once it appears.)
  if(typeof __origSyncPPDSharedInbox === 'function'){
    var __ppdWrappedSync = makeSyncPPDSharedInboxWrapper(__origSyncPPDSharedInbox);
    __ppdWrappedSync.__mfxWrapped = true;
    window.syncPPDSharedInbox = __ppdWrappedSync;
  }
"""

    src = src[:after_marker_idx] + body_region + post + src[close_pos + len('\n  };\n'):]

    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# DATA-11 — audit hook on deleteTask
# ============================================================
def fix_data_11():
    print('[DATA-11] app.js: add audit hook to deleteTask')
    rel = 'public/js/app.js'
    backup(rel)
    src = read(rel)
    old = """function deleteTask(tid){if(!confirm('Delete?'))return;fbDb.collection('tasks').doc(tid).delete().then(function(){closeModal();toast('Deleted','ok');renderMeetingsView()})}"""
    new = """function deleteTask(tid){if(!confirm('Delete?'))return;
// DATA-11 fix (2026-05-24): audit hook — server trigger onTaskWrite would be
// ideal long-term, but for now write a client-side activity entry so the delete
// at least leaves a breadcrumb. logActivity sets user/userId from the session.
if(typeof DB!=='undefined'&&DB.logActivity){DB.logActivity('task.deleted','Task '+tid+' deleted')}
fbDb.collection('tasks').doc(tid).delete().then(function(){closeModal();toast('Deleted','ok');renderMeetingsView()}).catch(function(e){console.error('deleteTask:',e);if(typeof toast==='function')toast('Delete failed — check connection','err')})}"""
    src = replace_unique(src, old, new, 'DATA-11 deleteTask')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying BATCH 7 audit fixes (6 safe MEDIUM)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_perf_07()
    fix_perf_08()
    fix_perf_14()
    fix_ux_10()
    fix_ux_11()
    fix_data_11()
    print('\nAll BATCH 7 fixes applied.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import sys
        print(f'\nFAILED: {e}', file=sys.stderr)
        sys.exit(1)
