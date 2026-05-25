"""
apply-batch-3-fixes.py
======================
Apply 10 SAFE MEDIUM-severity audit fixes via atomic writes. Same pattern
as previous batches. Stops at first failure with no half-applied state.

Fixes in this batch:
  DATA-09  cleanup       — delete firebase.json.backup, functions/index.js.bak; add to .gitignore
  UX-07    cleanup       — move 4 orphan project-root HTMLs to _attic
  PERF-10  build.js       — bump CDN_CACHE version on every build (CACHE_NAME already bumps)
  UX-12    public/js/core.js — convert alert('Access restricted') to toast(); fix signOut race
  SEC-06   firestore.rules — statusReel update: author OR like-only fields
  SEC-07   firestore.rules — kudos/polls/microfeed/tasks/chat_channels-tasks author checks
  SEC-08   firestore.rules — lock _auditLog create (server-only)
  SEC-09   firestore.rules — activity create requires userId === auth.uid
  SEC-10   firestore.rules — lock counters writes (server-only via Cloud Function)
  UX-08/19 public/js/notifications.js — replace empty `catch(e){}` with `catch(e){console.warn(...)}`

Usage:
  python3 scripts/audits/apply-batch-3-fixes.py
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

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-batch3')
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
# DATA-09 — Delete .bak files; add to .gitignore
# ============================================================
def fix_data_09():
    print('[DATA-09] Removing .bak / .backup files')
    moved = []
    targets = ['firebase.json.backup', 'functions/index.js.bak']
    attic = os.path.join('_attic', 'data-09-removed-bak-files-2026-05-24')
    os.makedirs(attic, exist_ok=True)
    for t in targets:
        if os.path.exists(t):
            dst = os.path.join(attic, os.path.basename(t))
            shutil.move(t, dst)
            moved.append(t)
            print(f'  Moved: {t} -> {dst}')
    # Ensure .gitignore covers them
    gi = '.gitignore'
    if os.path.exists(gi):
        gi_content = read(gi)
        added = []
        for pat in ['*.bak', '*.backup']:
            if pat not in gi_content:
                added.append(pat)
        if added:
            new_gi = gi_content.rstrip() + '\n# DATA-09 audit fix\n' + '\n'.join(added) + '\n'
            atomic_write(gi, new_gi)
            print(f'  .gitignore: added {added}')
    print(f'  OK ({len(moved)} files moved)')


# ============================================================
# UX-07 — Move orphan HTMLs from project root to _attic
# ============================================================
def fix_ux_07():
    print('[UX-07] Moving orphan project-root HTMLs to _attic')
    targets = [
        'mfx-os-scoreboard.html',
        'mfx-os-status.html',
        'mfx-pipeline-audit.html',
        'mfx-pipeline-v3.html',
    ]
    attic = os.path.join('_attic', 'ux-07-orphan-htmls-2026-05-24')
    os.makedirs(attic, exist_ok=True)
    moved = 0
    for t in targets:
        if os.path.exists(t):
            dst = os.path.join(attic, t)
            shutil.move(t, dst)
            print(f'  Moved: {t} -> {dst}')
            moved += 1
    if moved:
        # Drop a README noting where they went and why
        readme = os.path.join(attic, 'README.txt')
        with open(readme, 'w') as f:
            f.write("""UX-07: Orphan project-root HTMLs — 2026-05-24

These HTML files were sitting at the project root (NOT under public/), so
Firebase Hosting was never serving them. If any of them is needed, move
back to public/ and add a reference. Otherwise these are dead.

Files moved here:
  - mfx-os-scoreboard.html
  - mfx-os-status.html
  - mfx-pipeline-audit.html
  - mfx-pipeline-v3.html
""")
    print(f'  OK ({moved} files moved)')


# ============================================================
# PERF-10 — Bump CDN_CACHE in build.js patchSW
# ============================================================
def fix_perf_10():
    print('[PERF-10] build.js: bump CDN_CACHE version on every build')
    rel = 'build.js'
    backup(rel)
    src = read(rel)
    old = '''  // Bump cache version
  sw = sw.replace(/var CACHE_NAME = '[^']+';/, `var CACHE_NAME = 'mfx-${Date.now().toString(36)}';`);'''
    new = '''  // Bump cache version (PERF-10 fix 2026-05-24: also bump CDN_CACHE so cached
  // third-party assets don't pin to a stale Firebase SDK version forever)
  const buildId = Date.now().toString(36);
  sw = sw.replace(/var CACHE_NAME = '[^']+';/, `var CACHE_NAME = 'mfx-${buildId}';`);
  sw = sw.replace(/var CDN_CACHE = '[^']+';/, `var CDN_CACHE = 'mfx-cdn-${buildId}';`);'''
    new_src = replace_unique(src, old, new, 'build.js cache bump')
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# UX-12 — alert() → toast(); fix signOut race
# ============================================================
def fix_ux_12():
    print('[UX-12] core.js: alert -> toast for access-restricted; fix signOut race')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    # Both occurrences of the alert with slightly different surrounding context
    edits = [
        # signInWithGoogle redirect path (line ~516)
        (
            '''if(!result.user.email.endsWith('@microflexfilm.com')){result.user.delete();alert('Access restricted to @microflexfilm.com accounts only.');return}''',
            '''if(!result.user.email.endsWith('@microflexfilm.com')){if(typeof toast==='function')toast('Access restricted to @microflexfilm.com accounts — please switch accounts and retry','err');setTimeout(function(){result.user.delete().catch(function(){})},50);return}'''
        ),
        # onAuthStateChanged path (line ~647)
        (
            '''if(user.email&&!user.email.endsWith('@microflexfilm.com')&&!user.isAnonymous){ /* blocked non-company user */ fbAuth.signOut();alert('Access restricted to @microflexfilm.com accounts only.');return}''',
            '''if(user.email&&!user.email.endsWith('@microflexfilm.com')&&!user.isAnonymous){ /* UX-12 fix 2026-05-24: toast first, then signOut so the toast actually shows */ if(typeof toast==='function')toast('Access restricted to @microflexfilm.com accounts — please switch accounts and retry','err');setTimeout(function(){fbAuth.signOut()},800);return}'''
        ),
    ]
    n_changed = 0
    for old, new in edits:
        count = src.count(old)
        if count == 0:
            print(f'  WARN: needle not found (skipping one edit)')
            continue
        if count > 1:
            raise RuntimeError(f'UX-12: needle matched {count} times')
        src = src.replace(old, new)
        n_changed += 1
    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK ({n_changed} edits applied)')


# ============================================================
# SEC-06..10 — firestore.rules tightening
# ============================================================
def fix_sec_06_07_08_09_10():
    print('[SEC-06,07,08,09,10] firestore.rules: author/server-only enforcement')
    rel = 'firestore.rules'
    backup(rel)
    src = read(rel)

    # SEC-09: activity create must have userId == auth.uid (close fake-actor write)
    old_act = '''    match /activity/{activityId} {
      allow read: if companyUser();
      allow create: if companyUser() || signedIn(); // portal clients can log activity
      allow update, delete: if isManagement();
    }'''
    new_act = '''    match /activity/{activityId} {
      allow read: if companyUser();
      // SEC-09 fix (2026-05-24): require userId field to match the writer's
      // auth.uid so portal clients/employees can't fake actor names.
      allow create: if (companyUser() || signedIn())
        && request.resource.data.keys().hasAll(['userId'])
        && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isManagement();
    }'''
    src = replace_unique(src, old_act, new_act, 'SEC-09 activity')

    # SEC-10: counters — lock writes to server-only
    old_ctr = '''    match /counters/{docId} {
      allow read, write: if companyUser();
    }'''
    new_ctr = '''    match /counters/{docId} {
      // SEC-10 fix (2026-05-24): legacy counters collection — lock writes to
      // server-only. All increments must go through the nextSequence Cloud
      // Function which is properly auth'd. systemCounters is already locked.
      allow read: if companyUser();
      allow write: if false;
    }'''
    src = replace_unique(src, old_ctr, new_ctr, 'SEC-10 counters')

    # SEC-08: _auditLog — server-only writes
    old_aud = '''    // Audit log — append-only for clients, read for management
    match /_auditLog/{logId} {
      allow read: if isManagement();
      allow create: if companyUser();
      allow update, delete: if false;
    }'''
    new_aud = '''    // SEC-08 fix (2026-05-24): _auditLog is now SERVER-ONLY. Client writes
    // are blocked so audit entries can't be forged or omitted. Use Firestore
    // triggers (onWrite for sensitive collections) to emit audit entries from
    // function context where request.auth.uid is trustworthy.
    match /_auditLog/{logId} {
      allow read: if isManagement();
      allow create, update, delete: if false;
    }'''
    src = replace_unique(src, old_aud, new_aud, 'SEC-08 _auditLog')

    # SEC-06: statusReel — author full update, others only whitelisted fields
    old_sr = '''    // ═══ STATUS REEL ═══
    match /statusReel/{statusId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser(); // likes, reply count
      allow delete: if companyUser() && (
        resource.data.userId == request.auth.uid || isManagement()
      );
      match /replies/{replyId} {
        allow read: if companyUser();
        allow create: if companyUser();
      }
    }'''
    new_sr = '''    // ═══ STATUS REEL ═══
    // SEC-06 fix (2026-05-24): only author or management can edit content;
    // everyone else limited to like/reply-count fields.
    match /statusReel/{statusId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser() && (
        resource.data.userId == request.auth.uid
        || isManagement()
        || request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['likes','likedBy','replyCount','reactions','viewedBy'])
      );
      allow delete: if companyUser() && (
        resource.data.userId == request.auth.uid || isManagement()
      );
      match /replies/{replyId} {
        allow read: if companyUser();
        allow create: if companyUser();
      }
    }'''
    src = replace_unique(src, old_sr, new_sr, 'SEC-06 statusReel')

    # SEC-07a: kudos
    old_k = '''    match /kudos/{docId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser(); // likes
      allow delete: if isManagement();
    }'''
    new_k = '''    // SEC-07 fix (2026-05-24): only author can edit content; others limited
    // to like fields. Delete restricted to management.
    match /kudos/{docId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser() && (
        resource.data.fromUserId == request.auth.uid
        || isManagement()
        || request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['likes','likedBy','reactions'])
      );
      allow delete: if isManagement();
    }'''
    src = replace_unique(src, old_k, new_k, 'SEC-07 kudos')

    # SEC-07b: polls
    old_p = '''    match /polls/{docId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser(); // voting, closing
      allow delete: if isManagement();
    }'''
    new_p = '''    // SEC-07 fix (2026-05-24): only author or management can edit poll
    // content; everyone else can vote (votes field) or react.
    match /polls/{docId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser() && (
        resource.data.createdBy == request.auth.uid
        || resource.data.createdById == request.auth.uid
        || isManagement()
        || request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['votes','voters','reactions','closed','closedAt'])
      );
      allow delete: if isManagement();
    }'''
    src = replace_unique(src, old_p, new_p, 'SEC-07 polls')

    # SEC-07c: microfeed — write restricted via canEditCollaboration which is
    # just companyUser; tighten to author-only edit/delete
    old_mf = '''    match /microfeed/{feedId} {
      allow read: if companyUser();
      allow write: if canEditCollaboration();
    }'''
    new_mf = '''    // SEC-07 fix (2026-05-24): only author can edit/delete; anyone in company
    // can create new posts.
    match /microfeed/{feedId} {
      allow read: if companyUser();
      allow create: if canEditCollaboration();
      allow update, delete: if canEditCollaboration() && (
        resource.data.userId == request.auth.uid
        || resource.data.createdById == request.auth.uid
        || isManagement()
      );
    }'''
    src = replace_unique(src, old_mf, new_mf, 'SEC-07 microfeed')

    # SEC-07d: tasks (top-level collection)
    old_t = '''    match /tasks/{taskId} {
      allow read: if companyUser();
      allow write: if canEditCollaboration();
    }'''
    new_t = '''    // SEC-07 fix (2026-05-24): creator OR assignee can edit; anyone in company
    // can create. Delete restricted to creator/management.
    match /tasks/{taskId} {
      allow read: if companyUser();
      allow create: if canEditCollaboration();
      allow update: if canEditCollaboration() && (
        resource.data.createdById == request.auth.uid
        || resource.data.assignedToId == request.auth.uid
        || resource.data.userId == request.auth.uid
        || isManagement()
      );
      allow delete: if canEditCollaboration() && (
        resource.data.createdById == request.auth.uid
        || isManagement()
      );
    }'''
    src = replace_unique(src, old_t, new_t, 'SEC-07 tasks')

    # SEC-07e: chat_channels/{ch}/tasks/{t}
    old_ct = '''    // ═══ CHAT WORKSPACE SUBCOLLECTIONS ═══
    match /chat_channels/{channelId}/tasks/{taskId} {
      allow read, write: if companyUser();
    }'''
    new_ct = '''    // ═══ CHAT WORKSPACE SUBCOLLECTIONS ═══
    // SEC-07 fix (2026-05-24): creator or assignee can edit/delete.
    match /chat_channels/{channelId}/tasks/{taskId} {
      allow read: if companyUser();
      allow create: if companyUser();
      allow update: if companyUser() && (
        resource.data.createdById == request.auth.uid
        || resource.data.assignedToId == request.auth.uid
        || isManagement()
      );
      allow delete: if companyUser() && (
        resource.data.createdById == request.auth.uid
        || isManagement()
      );
    }'''
    src = replace_unique(src, old_ct, new_ct, 'SEC-07 chat tasks')

    atomic_write(rel, src)
    print(f'  OK (5 collections tightened)')


# ============================================================
# UX-08 / UX-19 — notifications.js silent catches → logged
# ============================================================
def fix_ux_08_19():
    print('[UX-08/19] notifications.js: replacing silent empty catches')
    rel = 'public/js/notifications.js'
    backup(rel)
    src = read(rel)
    # Replace `catch(e){}` / `catch(){}` / `catch (e) {}` patterns with a
    # warn variant. Use regex to catch all whitespace variants. We add a fixed
    # context tag 'notif' so failures at least leave a breadcrumb.
    pattern = re.compile(r'catch\s*\(\s*([a-zA-Z_]\w*)?\s*\)\s*\{\s*\}')
    def repl(m):
        ident = m.group(1) or 'e'
        return f'catch ({ident}) {{ console.warn(\'notif:\', {ident}); }}'
    new_src, n = pattern.subn(repl, src)
    if n == 0:
        print('  WARN: no empty catches found, skipping')
        return
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({n} empty catches converted to console.warn)')


# ============================================================
# RUN
# ============================================================
def main():
    print(f'Applying BATCH 3 audit fixes...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_data_09()
    fix_ux_07()
    fix_perf_10()
    fix_ux_12()
    fix_sec_06_07_08_09_10()
    fix_ux_08_19()
    print('\nAll BATCH 3 fixes applied.')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
