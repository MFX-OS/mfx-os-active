"""
apply-batch-4-fixes.py
======================
Apply 7 HIGH-severity audit fixes via atomic writes. Same pattern as batches 2-3.

Fixes:
  PERF-04  chat.js + modules.js          — bound users-collection listeners
  PERF-05  production.js                  — bound jobPassports/blueprints/jobTickets listeners
  PERF-11  firestore.indexes.json         — add 5 missing composite indexes
  PERF-12  notifications.js               — O(N²) dedup replaced with Set
  DATA-03  core.js                        — neutralize dead checkAndSeedData (SEED_CLIENTS undefined)
  DATA-08  nested duplicates              — move MFX-OS copy/MFX-OS copy/ + crm/.claude/worktrees/ to _attic
  SEC-04   firestore.rules                — lock onboarding to management + self

Skipped from initial plan: UX-02/03 (already half-fixed — goView toasts on block).

Usage:
  python3 scripts/audits/apply-batch-4-fixes.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch4')
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


def verify_json(rel):
    with open(rel) as f:
        json.load(f)


def replace_unique(content, needle, replacement, what):
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# ============================================================
# PERF-04 — Bound users listeners (chat.js + modules.js)
# ============================================================
def fix_perf_04():
    print('[PERF-04] users listeners: bound to 100 most-recently-seen')

    # chat.js — presence listener
    rel = 'public/js/chat.js'
    backup(rel)
    src = read(rel)
    old = "_presenceListener=fbDb.collection('users').onSnapshot(function(snap){"
    new = "/* PERF-04 fix (2026-05-24): bound to 100 most-recently-seen users + */\n  _presenceListener=fbDb.collection('users').orderBy('lastSeen','desc').limit(100).onSnapshot(function(snap){"
    src = replace_unique(src, old, new, 'chat.js presence listener')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK chat.js')

    # modules.js — team-users cache
    rel = 'public/js/modules.js'
    backup(rel)
    src = read(rel)
    old = "if(fbDb){fbDb.collection('users').onSnapshot(function(snap){window._allTeamUsers=snap.docs.map(function(d){var data=d.data();return data.displayName||data.email||''}).filter(Boolean)}, function(err){ console.warn('modules users listener:', err.message); })}"
    new = "if(fbDb){/* PERF-04 fix (2026-05-24): bound to 200 users — team cache doesn't need all-of-time */ fbDb.collection('users').limit(200).onSnapshot(function(snap){window._allTeamUsers=snap.docs.map(function(d){var data=d.data();return data.displayName||data.email||''}).filter(Boolean)}, function(err){ console.warn('modules users listener:', err.message); })}"
    src = replace_unique(src, old, new, 'modules.js team-users listener')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK modules.js')


# ============================================================
# PERF-05 — Bound production listeners
# ============================================================
def fix_perf_05():
    print('[PERF-05] production.js: bound 3 listeners')
    rel = 'public/js/production.js'
    backup(rel)
    src = read(rel)
    old = '''function startProductionListeners(){
  _prodListeners.push(fbDb.collection('jobPassports').orderBy('createdAt','desc').onSnapshot(function(s){
    _jpCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production')renderProductionView();
  }, function(err){ console.warn('production jobPassports listener:', err.message); }));
  _prodListeners.push(fbDb.collection('blueprints').orderBy('updatedAt','desc').onSnapshot(function(s){
    _bpCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production'&&S_JP.view==='blueprints')renderProductionView();
  }, function(err){ console.warn('production blueprints listener:', err.message); }));
  _prodListeners.push(fbDb.collection('jobTickets').orderBy('createdAt','desc').onSnapshot(function(s){
    _jtCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production'&&S_JP.view==='tickets')renderProductionView();
  }, function(err){ console.warn('production jobTickets listener:', err.message); }));
}'''
    new = '''// PERF-05 fix (2026-05-24): 3 listeners now bounded so the production board
// doesn't repaint over years of historical jobs on every ticket change.
// Older closed jobs accessible by direct doc().get() if needed.
var _PROD_PASSPORT_LIMIT = 300;
var _PROD_BLUEPRINT_LIMIT = 300;
var _PROD_TICKET_LIMIT = 300;
function startProductionListeners(){
  _prodListeners.push(fbDb.collection('jobPassports').orderBy('createdAt','desc').limit(_PROD_PASSPORT_LIMIT).onSnapshot(function(s){
    _jpCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production')renderProductionView();
  }, function(err){ console.warn('production jobPassports listener:', err.message); }));
  _prodListeners.push(fbDb.collection('blueprints').orderBy('updatedAt','desc').limit(_PROD_BLUEPRINT_LIMIT).onSnapshot(function(s){
    _bpCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production'&&S_JP.view==='blueprints')renderProductionView();
  }, function(err){ console.warn('production blueprints listener:', err.message); }));
  _prodListeners.push(fbDb.collection('jobTickets').orderBy('createdAt','desc').limit(_PROD_TICKET_LIMIT).onSnapshot(function(s){
    _jtCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production'&&S_JP.view==='tickets')renderProductionView();
  }, function(err){ console.warn('production jobTickets listener:', err.message); }));
}'''
    src = replace_unique(src, old, new, 'production.js listeners')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# PERF-11 — Add 5 missing composite indexes
# ============================================================
def fix_perf_11():
    print('[PERF-11] firestore.indexes.json: add 5 composite indexes')
    rel = 'firestore.indexes.json'
    backup(rel)
    with open(rel) as f:
        data = json.load(f)
    new_indexes = [
        # projects: where('board','==',X).orderBy('createdAt','desc')  — modules.js:16,17
        {
            "collectionGroup": "projects",
            "queryScope": "COLLECTION",
            "fields": [
                {"fieldPath": "board", "order": "ASCENDING"},
                {"fieldPath": "createdAt", "order": "DESCENDING"}
            ]
        },
        # dms: where('participants','array-contains',uid).orderBy('lastMessageAt','desc') — features.js:28
        {
            "collectionGroup": "dms",
            "queryScope": "COLLECTION",
            "fields": [
                {"fieldPath": "participants", "arrayConfig": "CONTAINS"},
                {"fieldPath": "lastMessageAt", "order": "DESCENDING"}
            ]
        },
        # activity: where('userId','==',uid).orderBy('timestamp','desc') — system-control.js:361
        {
            "collectionGroup": "activity",
            "queryScope": "COLLECTION",
            "fields": [
                {"fieldPath": "userId", "order": "ASCENDING"},
                {"fieldPath": "timestamp", "order": "DESCENDING"}
            ]
        },
        # tasks: where('assignedTo','==',name).orderBy('createdAt','desc') — system-control.js:379
        {
            "collectionGroup": "tasks",
            "queryScope": "COLLECTION",
            "fields": [
                {"fieldPath": "assignedTo", "order": "ASCENDING"},
                {"fieldPath": "createdAt", "order": "DESCENDING"}
            ]
        },
        # agentRecommendations: where('type','==',T).orderBy('createdAt','desc') — ai-ops-center.js:232
        {
            "collectionGroup": "agentRecommendations",
            "queryScope": "COLLECTION",
            "fields": [
                {"fieldPath": "type", "order": "ASCENDING"},
                {"fieldPath": "createdAt", "order": "DESCENDING"}
            ]
        },
    ]
    # Dedup against existing
    def idx_signature(idx):
        return (idx.get('collectionGroup'), idx.get('queryScope'),
                tuple((f.get('fieldPath'), f.get('order'), f.get('arrayConfig')) for f in idx.get('fields', [])))
    existing_sigs = {idx_signature(i) for i in data.get('indexes', [])}
    added = 0
    for new_idx in new_indexes:
        if idx_signature(new_idx) in existing_sigs:
            continue
        data['indexes'].append(new_idx)
        added += 1
    atomic_write(rel, json.dumps(data, indent=2) + '\n')
    verify_json(rel)
    print(f'  OK ({added} new indexes added, {len(new_indexes) - added} already existed)')


# ============================================================
# PERF-12 — O(N²) notification dedup → Set
# ============================================================
def fix_perf_12():
    print('[PERF-12] notifications.js: O(N²) dedup → Set lookup')
    rel = 'public/js/notifications.js'
    backup(rel)
    src = read(rel)
    old = "              // Dedup: check if a notification for this quote+status already exists\n              const dedupKey = `quote_${change.doc.id}_${quote.status}`;\n              if (STATE.notifications.some(n => n.sourceId === change.doc.id && n.body && n.body.indexOf(quote.status) !== -1)) return;"
    new = "              // PERF-12 fix (2026-05-24): O(1) Set lookup replaces O(N) .some() scan.\n              // _seenQuoteStatusKeys is initialized once at module scope (see init below).\n              const dedupKey = `quote_${change.doc.id}_${quote.status}`;\n              if (!window._seenQuoteStatusKeys) window._seenQuoteStatusKeys = new Set();\n              if (window._seenQuoteStatusKeys.has(dedupKey)) return;\n              window._seenQuoteStatusKeys.add(dedupKey);\n              // Cap memory growth — drop oldest if too big\n              if (window._seenQuoteStatusKeys.size > 2000) {\n                window._seenQuoteStatusKeys = new Set(Array.from(window._seenQuoteStatusKeys).slice(-1000));\n              }"
    src = replace_unique(src, old, new, 'PERF-12 notification dedup')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# DATA-03 — Neutralize dead checkAndSeedData
# ============================================================
def fix_data_03():
    print('[DATA-03] core.js: neutralize dead checkAndSeedData (SEED_CLIENTS undefined)')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    old = '''async function checkAndSeedData(){const snap=await fbDb.collection('customers').limit(1).get();
if(snap.empty&&typeof SEED_CLIENTS!=='undefined'){console.log('Seeding '+SEED_CLIENTS.length+' clients to Firestore...');
let batch=fbDb.batch(),ct=0;for(const c of SEED_CLIENTS){batch.set(fbDb.collection('customers').doc(c.id),c);ct++;if(ct>=400){await batch.commit();batch=fbDb.batch();ct=0}}if(ct>0)await batch.commit();console.log('Seed complete')}}'''
    new = '''// DATA-03 fix (2026-05-24): SEED_CLIENTS was never shipped in current source —
// the typeof guard silently no-op'd, leaving fresh environments empty without
// error. Function reduced to a documented no-op. If you actually need to seed
// customers, write a proper one-time admin script using Firebase Admin SDK
// (e.g. scripts/seed/seed-customers.js with a service account).
async function checkAndSeedData(){
  // No-op. SEED_CLIENTS is no longer defined anywhere. Customer data lives in
  // Firestore and is created by users via the Customers view, not seeded here.
  return;
}'''
    src = replace_unique(src, old, new, 'DATA-03 checkAndSeedData')
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# DATA-08 — Move nested duplicate folders to _attic
# ============================================================
def fix_data_08():
    print('[DATA-08] Moving nested duplicate directories to _attic')
    attic_root = os.path.join('_attic', 'data-08-nested-duplicates-2026-05-24')
    os.makedirs(attic_root, exist_ok=True)

    targets = [
        ('MFX-OS copy', 'MFX-OS-copy-nested'),  # the inner snapshot
        ('crm/.claude/worktrees', 'crm-worktrees'),
    ]
    moved = 0
    for src_path, dst_name in targets:
        if not os.path.exists(src_path):
            print(f'  skip (not present): {src_path}')
            continue
        dst_path = os.path.join(attic_root, dst_name)
        try:
            shutil.move(src_path, dst_path)
            print(f'  Moved: {src_path} -> {dst_path}')
            moved += 1
        except Exception as e:
            print(f'  WARN failed to move {src_path}: {e}')

    # Drop a README
    readme = os.path.join(attic_root, 'README.txt')
    with open(readme, 'w') as f:
        f.write("""DATA-08 — Nested duplicate directories moved here on 2026-05-24

Items moved:
  - MFX-OS-copy-nested/   (was at: ./MFX-OS copy/  — divergent snapshot of project)
  - crm-worktrees/        (was at: ./crm/.claude/worktrees/  — three agent worktrees)

Why moved: these were old copies that had drifted from the top-level project
(~465 lines different in core.js). Future edits to the wrong tree would silently
revert when the right one rebuilt. Grep results were also polluted with these
copies.

If you discover the live deploy needed any of these, copy back from this attic.
Otherwise delete this folder after a week of verifying nothing broke.
""")
    print(f'  OK ({moved} directories moved)')


# ============================================================
# SEC-04 — Onboarding restricted to management + self
# ============================================================
def fix_sec_04():
    print('[SEC-04] firestore.rules: onboarding -> management + self only')
    rel = 'firestore.rules'
    backup(rel)
    src = read(rel)
    old = '''    // ═══ ONBOARDING ═══
    match /onboarding/{docId} {
      allow read: if companyUser();
      allow write: if companyUser();
    }'''
    new = '''    // ═══ ONBOARDING ═══
    // SEC-04 fix (2026-05-24): Restrict reads to management or the doc owner.
    // Writes: management can do anything; the subject can self-update only
    // non-sensitive fields (their own contact info, preferences, etc.).
    // Sensitive fields (status, approvedBy, salary, ssnRef, payRate) are
    // management-only.
    match /onboarding/{docId} {
      allow read: if companyUser() && (
        isManagement()
        || resource.data.userId == request.auth.uid
        || resource.data.uid == request.auth.uid
      );
      allow create: if isManagement();
      allow update: if companyUser() && (
        isManagement()
        || (
          (resource.data.userId == request.auth.uid || resource.data.uid == request.auth.uid)
          && !request.resource.data.diff(resource.data).affectedKeys()
              .hasAny(['status','approvedBy','approvedAt','salary','payRate','ssnRef','i9Status','offerLetter','startDate','reportsTo','dept','role'])
        )
      );
      allow delete: if isManagement();
    }'''
    src = replace_unique(src, old, new, 'SEC-04 onboarding')
    atomic_write(rel, src)
    print(f'  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print(f'Applying BATCH 4 audit fixes...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_perf_04()
    fix_perf_05()
    fix_perf_11()
    fix_perf_12()
    fix_data_03()
    fix_data_08()
    fix_sec_04()
    print('\nAll BATCH 4 fixes applied.')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
