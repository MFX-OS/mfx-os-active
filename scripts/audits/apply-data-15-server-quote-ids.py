"""
apply-data-15-server-quote-ids.py
=================================
DATA-15 fix: route quote-number generation through the server-side
`nextSequence` Cloud Function instead of the now-blocked client transaction.

Root cause:
  Two prior fixes (SEC-10 + DATA-15 design) collided:
    - SEC-10 locked firestore.rules `counters/*` to deny ALL client writes.
    - newQuote() and dupQuote() still call `genQNFirestore()` which tries a
      CLIENT-SIDE transaction (read+write) on `counters/quoteNumber`.
  Effect: every quote creation silently fails the transaction's tx.set() and
  the quote stays at its temporary `MF2605-T1234` placeholder forever.

Why the fix is small:
  The proper server path is already deployed end-to-end:
    - `nextSequence` Cloud Function (functions/index.js:550) — auth + rate-limited
    - /api/nextSequence rewrite (firebase.json)
    - `window.requestServerNumber(kind, fallbackFactory)` helper (core.js:486)
  Just need to swap the call sites at core.js:1870 and core.js:1883 from the
  dead `genQNFirestore()` to the working `requestServerNumber('quote', genQN)`.

What changes in this script:
  public/js/core.js
    1) newQuote(): genQNFirestore().then(...) →
                   requestServerNumber('quote', genQN).then(...)
    2) dupQuote(): same swap in the !asRev branch
    3) genQNServer(): no longer pretends genQNFirestore() might work; goes
                      straight to requestServerNumber.

Backwards compatibility:
  - `genQNFirestore()` is kept defined (it's harmless dead code; some test or
    third-party code might still import it). It just won't be called by the
    main flow.
  - The toast message changes from "Using temporary quote number — check
    connection" to "Server number pending — using temporary" (truer).

Usage:
  python3 scripts/audits/apply-data-15-server-quote-ids.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-data15')
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
# Patch public/js/core.js
# ============================================================
def fix_core_js():
    print('[DATA-15] public/js/core.js: route quote IDs through server')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    if 'DATA-15 fix' in src:
        print('  SKIP (already applied)')
        return

    # ---- 1) newQuote() — swap genQNFirestore() for requestServerNumber('quote', genQN) ----
    old_newquote = """// Get Firestore atomic number FIRST, then save
genQNFirestore().then(function(serverNum){
  q.quoteNum=serverNum;
}).catch(function(e){
  console.error('Quote number failed, using temp:',e);
  toast('Using temporary quote number — check connection','warn');
}).then(function(){
  var all=DB.quotes();all.unshift(q);DB.saveQ(all,q.id);openEditor(q.id);toast('Draft created','ok');
  DB.logActivity('quote.create',q.quoteNum+' — '+(q.fields.custCo||'New'));
})}"""
    new_newquote = """// DATA-15 fix (2026-05-24): get server-assigned quote number via the
// nextSequence Cloud Function. SEC-10 locked the counters/* collection from
// client writes, so the old genQNFirestore() client transaction never
// succeeded — every new quote was stuck with its temporary `-T####`
// placeholder. requestServerNumber routes through /api/nextSequence which
// is auth-gated, rate-limited, and atomic on the server.
(typeof requestServerNumber==='function'
  ? requestServerNumber('quote', genQN)
  : Promise.resolve(genQN())
).then(function(serverNum){
  if(serverNum) q.quoteNum=serverNum;
}).catch(function(e){
  console.error('Quote number failed, using temp:',e);
  toast('Server number pending — using temporary','warn');
}).then(function(){
  var all=DB.quotes();all.unshift(q);DB.saveQ(all,q.id);openEditor(q.id);toast('Draft created','ok');
  DB.logActivity('quote.create',q.quoteNum+' — '+(q.fields.custCo||'New'));
})}"""
    src = replace_unique(src, old_newquote, new_newquote, 'DATA-15 newQuote')

    # ---- 2) dupQuote() — same swap in the !asRev branch ----
    old_dup = "if(asRev){n.rev=nextRev(o.rev);_finishDup()}else{n.rev='A';n.parentQuoteId=null;n.quoteNum=genQN();genQNFirestore().then(function(sn){n.quoteNum=sn}).catch(function(e){console.error('Dup quote number failed:',e);toast('Using temporary quote number','warn')}).then(_finishDup)}}"
    new_dup = "if(asRev){n.rev=nextRev(o.rev);_finishDup()}else{n.rev='A';n.parentQuoteId=null;n.quoteNum=genQN();/* DATA-15 fix: server-assigned dup quote # via nextSequence */(typeof requestServerNumber==='function'?requestServerNumber('quote',genQN):Promise.resolve(genQN())).then(function(sn){if(sn)n.quoteNum=sn}).catch(function(e){console.error('Dup quote number failed:',e);toast('Server number pending — using temporary','warn')}).then(_finishDup)}}"
    src = replace_unique(src, old_dup, new_dup, 'DATA-15 dupQuote')

    # ---- 3) genQNServer() — skip the always-failing client transaction ----
    old_genqnserver = "async function genQNServer(){if(window.fbDb){try{return await genQNFirestore()}catch(e){console.error('genQNServer firestore fail:',e)}}if(typeof requestServerNumber==='function'){try{return await requestServerNumber('quote',function(){return genQN()})}catch(e){}}return genQN()}"
    new_genqnserver = """async function genQNServer(){
  // DATA-15 fix (2026-05-24): go straight to requestServerNumber. The old
  // genQNFirestore() path is dead under SEC-10 rules (counters/* is now
  // server-write-only). Kept defined above for back-compat but no longer
  // tried first — that was producing noisy console errors and a wasted RTT.
  if(typeof requestServerNumber==='function'){
    try{return await requestServerNumber('quote',function(){return genQN()})}
    catch(e){console.warn('genQNServer requestServerNumber fail:',e&&e.message)}
  }
  return genQN();
}"""
    src = replace_unique(src, old_genqnserver, new_genqnserver, 'DATA-15 genQNServer')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying DATA-15 (route quote IDs through server)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_core_js()
    print('\nDATA-15 fix applied.')
    print('Next: npm run deploy  (rebuilds mfx-core bundle)')
    print('Verify: open the app, click "+ New Quote", confirm the quote # is')
    print('        MF2606-001 (no "-T" prefix). Console should NOT log any')
    print('        "genQNServer firestore fail" warnings.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
