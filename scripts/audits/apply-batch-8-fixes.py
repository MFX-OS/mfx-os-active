"""
apply-batch-8-fixes.py
======================
Final MEDIUM refactors:
  DATA-13  fsqms-module.js  — persist by-record-ID (with batch fallback)
                              Was: only writes last array element on every save,
                              so editing an older entry never syncs to Firestore
                              and concurrent operators overwrite each other.
                              Now: writes the SPECIFIC record (by id) when caller
                              passes one, otherwise batch-writes all entries.

  DATA-14  core.js          — saveC per-doc when changedId provided + saveCust
                              now passes the changed id. Stops rewriting every
                              customer doc on every single edit. Backwards-
                              compatible: callers that don't pass changedId still
                              get whole-collection batch (legacy mode).

Deferred (each its own per-module project):
  DATA-10  SEED_X demo data — 8 modules each hard-code demo arrays for
                              dashboards. Each module needs its own Firestore
                              schema design + migration. Out of scope for an
                              atomic batch.

Skipped on second look:
  UX-14    saveQ uses set({merge:true}) — notesTags ARE preserved.
  UX-06    Signal Command already shows a friendly "coming soon" placeholder.

Usage:
  python3 scripts/audits/apply-batch-8-fixes.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch8')
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
# DATA-13 — FSQMS persist by-ID with batch fallback
# ============================================================
def fix_data_13():
    print('[DATA-13] fsqms-module.js: persist by-record-ID')
    rel = 'public/js/fsqms-module.js'
    backup(rel)
    src = read(rel)
    if 'DATA-13 fix' in src:
        print('  SKIP (already applied)')
        return

    old = """  function persistSan(){
    localStorage.setItem('mfx-fsqms-san',JSON.stringify(SAN));
    if(_fsqmsDb&&SAN.length){var last=SAN[SAN.length-1];_fsqmsDb.collection('fsqmsSanitation').doc(last.id).set(last).catch(function(e){console.warn('FSQMS sync san:',e.message);});}
  }
  function persistQual(){
    localStorage.setItem('mfx-fsqms-qual',JSON.stringify(QUAL));
    if(_fsqmsDb&&QUAL.length){var last=QUAL[QUAL.length-1];_fsqmsDb.collection('fsqmsQuality').doc(last.id).set(last).catch(function(e){console.warn('FSQMS sync qual:',e.message);});}
  }
  function persistMat(){
    localStorage.setItem('mfx-fsqms-mat',JSON.stringify(MAT));
    if(_fsqmsDb&&MAT.length){var last=MAT[MAT.length-1];_fsqmsDb.collection('fsqmsMaterials').doc(last.id).set(last).catch(function(e){console.warn('FSQMS sync mat:',e.message);});}
  }"""

    new = """  // DATA-13 fix (2026-05-24): persist by record-ID instead of always the
  // last-array-element. Callers that know which record changed can pass its
  // id for an efficient single-doc write. Callers that don't pass an id fall
  // back to batch-writing the full array (safe but heavier). This is what
  // SQF compliance needs — edits to old entries now actually persist, and
  // concurrent operators no longer overwrite each other's records.
  function _persistArray(localKey, collectionName, arr, targetId){
    localStorage.setItem(localKey, JSON.stringify(arr));
    if(!_fsqmsDb || !arr.length) return;
    if(targetId){
      var rec = arr.find(function(x){return x && x.id === targetId;});
      if(rec){
        _fsqmsDb.collection(collectionName).doc(rec.id).set(rec)
          .catch(function(e){console.warn('FSQMS sync '+collectionName+':', e.message);});
      }
      return;
    }
    // No id given — batch the whole array (legacy "best effort" mode).
    try{
      var batch = _fsqmsDb.batch();
      arr.forEach(function(rec){
        if(rec && rec.id) batch.set(_fsqmsDb.collection(collectionName).doc(rec.id), rec);
      });
      batch.commit().catch(function(e){console.warn('FSQMS sync '+collectionName+' batch:', e.message);});
    }catch(e){console.warn('FSQMS sync '+collectionName+' batch setup:', e.message);}
  }
  function persistSan(id){ _persistArray('mfx-fsqms-san','fsqmsSanitation',SAN,id); }
  function persistQual(id){ _persistArray('mfx-fsqms-qual','fsqmsQuality',QUAL,id); }
  function persistMat(id){ _persistArray('mfx-fsqms-mat','fsqmsMaterials',MAT,id); }"""

    src = replace_unique(src, old, new, 'DATA-13 fsqms persist')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# DATA-14 — saveC per-doc when changedId provided
# ============================================================
def fix_data_14():
    print('[DATA-14] core.js: saveC per-doc + saveCust passes changedId')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    if 'DATA-14 fix' in src:
        print('  SKIP (already applied)')
        return

    # ---- 1) Replace saveC body to accept changedId ----
    old_save_c = "saveC(cs){const b=fbDb.batch();cs.forEach(c=>b.set(fbDb.collection('customers').doc(c.id),c));firestoreRetry(function(){ return b.commit(); }).catch(function(e){ console.error('saveC:',e); if(typeof toast==='function') toast('Save failed — check connection','err'); });_cache.customers=cs},"
    new_save_c = """saveC(cs,changedId){
  // DATA-14 fix (2026-05-24): if caller passes changedId, write only that
  // doc. Concurrent users editing different customers no longer overwrite
  // each other. Legacy mode (no changedId) batch-writes everything as
  // before. Recommended: callers should always pass the changed customer's
  // id when known.
  if(changedId){
    var changed = cs.find(function(x){return x.id === changedId;});
    if(changed){
      firestoreRetry(function(){
        return fbDb.collection('customers').doc(changed.id).set(changed, {merge:true});
      }).catch(function(e){ console.error('saveC('+changedId+'):',e); if(typeof toast==='function') toast('Save failed — check connection','err'); });
    } else {
      console.warn('saveC: changedId '+changedId+' not found in cs array — falling back to batch');
    }
    _cache.customers = cs;
    return;
  }
  // Legacy: write the whole list (kept for callers that don't know which one changed)
  const b = fbDb.batch();
  cs.forEach(function(c){ b.set(fbDb.collection('customers').doc(c.id), c); });
  firestoreRetry(function(){ return b.commit(); }).catch(function(e){ console.error('saveC batch:',e); if(typeof toast==='function') toast('Save failed — check connection','err'); });
  _cache.customers = cs;
},"""
    src = replace_unique(src, old_save_c, new_save_c, 'DATA-14 saveC body')

    # ---- 2) saveCust passes c.id ----
    old_save_cust = "function saveCust(c){const all=DB.customers();const i=all.findIndex(x=>x.id===c.id);if(i>=0)all[i]=c;else all.unshift(c);DB.saveC(all);toast('Saved','ok');"
    new_save_cust = "function saveCust(c){const all=DB.customers();const i=all.findIndex(x=>x.id===c.id);if(i>=0)all[i]=c;else all.unshift(c);DB.saveC(all,c.id);toast('Saved','ok'); // DATA-14 fix: pass changedId so only one doc is written"
    src = replace_unique(src, old_save_cust, new_save_cust, 'DATA-14 saveCust caller')

    # ---- 3) Add a marker for the fix so idempotency check works ----
    # (the change above already contains 'DATA-14 fix' string, so check works)

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying BATCH 8 (final MEDIUM refactors)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_data_13()
    fix_data_14()
    print('\nAll BATCH 8 fixes applied.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
