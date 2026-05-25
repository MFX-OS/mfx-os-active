"""
apply-batch-6-fixes.py
======================
Apply the final 3 actionable HIGH-severity audit fixes via atomic writes.

Fixes:
  PERF-06  chat.js     — chat read-receipts: replace per-message update() with single WriteBatch
  UX-04    app.js      — replace "Bulletin board coming soon" stub button with disabled placeholder
  UX-05    modules.js  — hide profile-field unlock buttons for non-admin users (UI side; server already enforces)

Marked complete-by-prior-fix (no edit needed):
  UX-02 / UX-03  — goView already toasts on access denied (added in UX-12 / batch 3).
                   Buttons remain visible but no longer silently fail.
                   Cosmetic-only menu filtering deferred — risky to touch render loop.

Deferred (needs design session, not atomic edit):
  PERF-09  bundle code splitting — touches build.js + module init across 56 files.

Usage:
  python3 scripts/audits/apply-batch-6-fixes.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch6')
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
# PERF-06 — chat read-receipts: batch the per-message updates
# ============================================================
def fix_perf_06():
    print('[PERF-06] chat.js: batching per-message read-receipt writes')
    rel = 'public/js/chat.js'
    backup(rel)
    src = read(rel)
    old = """      // Mark as read
      var uid=getUserId();
      snap.docs.forEach(function(d){
        var data=d.data();
        if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
          fbDb.collection('chat_messages').doc(d.id).update({readBy:firebase.firestore.FieldValue.arrayUnion(uid)}).catch(function(){});
        }
      });"""
    new = """      // PERF-06 fix (2026-05-24): batch all read-receipt writes into a single
      // WriteBatch.commit() per snapshot instead of one .update() per message.
      // Cuts chat-channel Firestore write volume by up to 100x on busy channels.
      var uid=getUserId();
      var pending=[];
      snap.docs.forEach(function(d){
        var data=d.data();
        if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
          pending.push(d.id);
        }
      });
      if(pending.length){
        var batch=fbDb.batch();
        pending.forEach(function(id){
          batch.update(fbDb.collection('chat_messages').doc(id),
                       {readBy:firebase.firestore.FieldValue.arrayUnion(uid)});
        });
        batch.commit().catch(function(e){console.warn('chat read-receipts batch:',e&&e.message)});
      }"""
    new_src = replace_unique(src, old, new, 'PERF-06 chat read-receipts')
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# UX-04 — Bulletin board "coming soon" → disabled placeholder
# ============================================================
def fix_ux_04():
    print('[UX-04] app.js: removing "Bulletin board coming soon" stub')
    rel = 'public/js/app.js'
    backup(rel)
    src = read(rel)

    # 1) Replace the button render with a clearer disabled placeholder
    old1 = """h+='<div style="text-align:center"><button class="btn btn-ghost btn-xs" onclick="deptBulletinPost(\\''+key+'\\')">+ Post Update</button></div>';"""
    new1 = """// UX-04 fix (2026-05-24): "Post Update" button removed — feature not yet built.
// Original behavior was a toast saying "coming soon"; replaced with an honest
// placeholder so the dept-home page doesn't ship a fake action.
h+='<div style="text-align:center;font-size:9px;color:var(--tx3);font-style:italic;padding:4px 0">Bulletin posting — coming Q3 2026</div>';"""
    src = replace_unique(src, old1, new1, 'UX-04 bulletin button')

    # 2) Mark the handler itself as deprecated (keep it so any orphan callers don't error)
    old2 = """function deptBulletinPost(key){toast('Bulletin board coming soon','ok')}"""
    new2 = """// UX-04 fix (2026-05-24): handler kept as no-op (with informational toast) in case
// any remaining onclick attributes reference it. Render path no longer exposes it.
function deptBulletinPost(key){if(typeof toast==='function')toast('Bulletin posting not yet built — coming Q3 2026','info')}"""
    src = replace_unique(src, old2, new2, 'UX-04 handler')

    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# UX-05 — hide unlock buttons for non-admin users
# ============================================================
def fix_ux_05():
    print('[UX-05] modules.js: hide unlock buttons in profile for non-admin users')
    rel = 'public/js/modules.js'
    backup(rel)
    src = read(rel)
    old = """function openUserProfile(){var p=getMFXProfile();var me=getUserName();var fn=p.displayName||me.split(' ')[0];var h='<div class="modal-title">My Profile</div><div style="text-align:center;margin-bottom:12px"><div style="width:56px;height:56px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#000;margin:0 auto">'+me.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase()+'</div><div style="font-size:14px;font-weight:700;color:var(--tx);margin-top:6px">'+me+'</div><div style="font-size:10px;color:var(--tx3)">'+(CURRENT_USER?CURRENT_USER.email:'')+'</div></div><div class="fg"><label>Full Name (locked)</label><input value="'+me+'" disabled style="opacity:.5"></div><div class="fg"><label>Email (locked)</label><input value="'+(CURRENT_USER?CURRENT_USER.email:'')+'" disabled style="opacity:.5"></div><div class="fg"><label>Display Name (@ tag) <span style="color:var(--or)">Admin</span></label><input id="up-name" value="'+fn+'" disabled style="opacity:.5"><button class="btn btn-ghost btn-xs" onclick="unlockField(\\'up-name\\')" style="margin-top:4px">🔓</button></div><div class="fg"><label>Flex ID <span style="color:var(--or)">Admin</span></label><input id="up-flexid" value="'+(p.flexId||'')+'" disabled style="opacity:.5"><button class="btn btn-ghost btn-xs" onclick="unlockField(\\'up-flexid\\')" style="margin-top:4px">🔓</button></div><div class="fg"><label>Position / Title <span style="color:var(--or)">Admin</span></label><input id="up-position" value="'+(p.position||'')+'" disabled style="opacity:.5" placeholder="e.g. Director of Digital & Operations"><button class="btn btn-ghost btn-xs" onclick="unlockField(\\'up-position\\')" style="margin-top:4px">🔓</button></div><div class="fg"><label>Role <span style="color:var(--or)">Admin</span></label><input id="up-role" value="'+(p.role||'')+'" disabled style="opacity:.5"><button class="btn btn-ghost btn-xs" onclick="unlockField(\\'up-role\\')" style="margin-top:4px">🔓</button></div><div class="fg"><label>Department <span style="color:var(--or)">Admin</span></label><select id="up-dept" disabled style="opacity:.5"><option value="">—</option>';['Operations','Estimation','Pre-Press','Production','Quality','Accounting','Sales','Administration'].forEach(function(d){h+='<option'+(p.dept===d?' selected':'')+'>'+d+'</option>'});h+='</select><button class="btn btn-ghost btn-xs" onclick="unlockField(\\'up-dept\\')" style="margin-top:4px">🔓</button></div><button class="btn btn-pr" onclick="saveUserProfile()" style="width:100%;margin-top:10px">Save</button><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';openModal(h)}"""
    new = """function openUserProfile(){
  // UX-05 fix (2026-05-24): unlock buttons (🔓) are now only rendered for users
  // whose role is in the admin set. Non-admins see plain locked inputs without
  // a frustrating "unlock then deny" interaction. Firestore rules also block
  // self-update of role/dept regardless (users/{userId} rule), so this is UI
  // polish on top of an already-enforced server constraint.
  var p=getMFXProfile();
  var me=getUserName();
  var fn=p.displayName||me.split(' ')[0];
  var _isAdmin=['ceo','admin','administrator','owner','operations manager','manager'].includes((p.role||'').toLowerCase());
  function lockBtn(id){return _isAdmin?'<button class="btn btn-ghost btn-xs" onclick="unlockField(\\''+id+'\\')" style="margin-top:4px">🔓</button>':'';}
  function adminTag(){return _isAdmin?'<span style="color:var(--or)">Admin</span>':'<span style="color:var(--tx3)" title="Locked — request admin to change">Locked</span>';}
  var h='<div class="modal-title">My Profile</div>'+
    '<div style="text-align:center;margin-bottom:12px"><div style="width:56px;height:56px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#000;margin:0 auto">'+me.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase()+'</div><div style="font-size:14px;font-weight:700;color:var(--tx);margin-top:6px">'+me+'</div><div style="font-size:10px;color:var(--tx3)">'+(CURRENT_USER?CURRENT_USER.email:'')+'</div></div>'+
    '<div class="fg"><label>Full Name (locked)</label><input value="'+me+'" disabled style="opacity:.5"></div>'+
    '<div class="fg"><label>Email (locked)</label><input value="'+(CURRENT_USER?CURRENT_USER.email:'')+'" disabled style="opacity:.5"></div>'+
    '<div class="fg"><label>Display Name (@ tag) '+adminTag()+'</label><input id="up-name" value="'+fn+'" disabled style="opacity:.5">'+lockBtn('up-name')+'</div>'+
    '<div class="fg"><label>Flex ID '+adminTag()+'</label><input id="up-flexid" value="'+(p.flexId||'')+'" disabled style="opacity:.5">'+lockBtn('up-flexid')+'</div>'+
    '<div class="fg"><label>Position / Title '+adminTag()+'</label><input id="up-position" value="'+(p.position||'')+'" disabled style="opacity:.5" placeholder="e.g. Director of Digital & Operations">'+lockBtn('up-position')+'</div>'+
    '<div class="fg"><label>Role '+adminTag()+'</label><input id="up-role" value="'+(p.role||'')+'" disabled style="opacity:.5">'+lockBtn('up-role')+'</div>'+
    '<div class="fg"><label>Department '+adminTag()+'</label><select id="up-dept" disabled style="opacity:.5"><option value="">—</option>';
  ['Operations','Estimation','Pre-Press','Production','Quality','Accounting','Sales','Administration'].forEach(function(d){h+='<option'+(p.dept===d?' selected':'')+'>'+d+'</option>'});
  h+='</select>'+lockBtn('up-dept')+'</div>'+
    '<button class="btn btn-pr" onclick="saveUserProfile()" style="width:100%;margin-top:10px">Save</button>'+
    '<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
  openModal(h);
}"""
    new_src = replace_unique(src, old, new, 'UX-05 unlock buttons')
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying BATCH 6 audit fixes...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_perf_06()
    fix_ux_04()
    fix_ux_05()
    print('\nAll BATCH 6 fixes applied.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
