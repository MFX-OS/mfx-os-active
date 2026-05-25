"""
apply-perf-15-lazy-mats.py
==========================
PERF-15: extract the 475-entry MATS materials catalog out of core.js into a
new lazy chunk `mats`, loaded on demand (with 3s eager preload). Cuts both
the initial bundle transfer and parse-time.

Strategy:
  1. Read public/js/core.js, locate the `const MATS=[ ... ];` block
     (currently lines ~851-1326).
  2. Create a new file `public/js/mats-data.js` whose body is an IIFE that
     PUSHES all those entries into `window.MATS` (preserves the original
     array reference held by consumers).
  3. In core.js, replace the const block with a tiny stub:
       var MATS = window.MATS = window.MATS || [];
  4. Add `mats` to build.js CHUNK_GROUPS.
  5. Patch app.js:buildMS to retry after loadChunk('mats') if MATS empty.
  6. Patch modules.js:openMatProfile + renderVendors to do the same.

Consumer-safety design:
  The chunk does Array.prototype.push.apply(window.MATS, data) so any
  module-init code that did `var MATS = window.MATS` continues to see the
  same array reference — it just gets populated later. NO consumer needs
  to switch from sync to async access.

The lazy chunk is auto-eager-preloaded 3s after page boot via the same
loadChunk loop core.js already uses for chat + ai.

Usage:
  python3 scripts/audits/apply-perf-15-lazy-mats.py
"""
import os
import re
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-perf15-mats')
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
# 1) Extract MATS block out of core.js → new mats-data.js
# ============================================================
def extract_and_stub_core():
    rel = 'public/js/core.js'
    print('[PERF-15] core.js: extracting MATS, replacing with stub')
    backup(rel)
    src = read(rel)
    if 'PERF-15 fix' in src:
        print('  SKIP (already applied)')
        return None

    # Find the MATS block. Anchor on the unique-in-file declaration.
    start_marker = '\nconst MATS=[\n'
    if start_marker not in src:
        raise RuntimeError('PERF-15: could not locate "const MATS=[" in core.js')
    start_idx = src.index(start_marker) + 1  # keep the leading \n outside

    # Find the closing `];` of the array. Walk forward, count nesting.
    # Simple, since each MATS entry is a one-line object: scan for first `];\n`
    # AFTER the start marker that's at column 0.
    search_from = start_idx + len(start_marker.lstrip('\n'))
    close_re = re.search(r'^\];\s*$', src[search_from:], flags=re.MULTILINE)
    if not close_re:
        raise RuntimeError('PERF-15: could not locate closing "];" of MATS array')
    close_idx = search_from + close_re.end()  # position just after `];`

    mats_block = src[start_idx:close_idx]   # includes "const MATS=[\n... \n];"
    entry_lines = [l for l in mats_block.split('\n') if l.startswith('{v:')]
    print(f'  Found MATS block: {len(entry_lines)} entries '
          f'({len(mats_block)} chars, lines {src[:start_idx].count(chr(10))+1}-{src[:close_idx].count(chr(10))+1})')

    stub = (
        "// PERF-15 fix (2026-05-24): MATS catalog moved to lazy 'mats' chunk\n"
        "// (public/js/mats-data.js). This stub keeps consumers working before\n"
        "// the chunk loads. The chunk pushes entries into this exact array, so\n"
        "// any consumer holding a reference to window.MATS keeps it valid.\n"
        "var MATS = window.MATS = window.MATS || [];"
    )
    new_src = src[:start_idx] + stub + src[close_idx:]
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK: stubbed (was {len(mats_block)} chars, now {len(stub)} chars; saved {len(mats_block)-len(stub)} chars from core.js)')
    return mats_block


# ============================================================
# 2) Create public/js/mats-data.js
# ============================================================
def write_mats_chunk(mats_block):
    if mats_block is None:
        # Already-applied path; chunk file should already exist.
        if os.path.exists('public/js/mats-data.js'):
            print('[PERF-15] mats-data.js already exists, skipping create')
            return
        raise RuntimeError('PERF-15: mats-data.js missing AND core.js already stubbed — broken state, restore from backup')

    print('[PERF-15] creating public/js/mats-data.js')
    # Extract just the entry lines (everything between `const MATS=[` and `];`)
    inner_lines = []
    inside = False
    for line in mats_block.split('\n'):
        if line.startswith('const MATS=['):
            inside = True
            continue
        if inside and re.match(r'^\];\s*$', line):
            break
        if inside:
            inner_lines.append(line)
    entry_count = len([l for l in inner_lines if l.startswith('{v:')])

    chunk_src = (
        "// PERF-15 fix (2026-05-24): lazy MATS catalog chunk.\n"
        "// Loaded on demand by loadChunk('mats') and eager-preloaded 3s after page\n"
        "// boot. Pushes entries into window.MATS so existing consumer references\n"
        "// (`var MATS = window.MATS`) keep pointing at the same array.\n"
        "(function(){\n"
        "  var data = [\n"
        + ''.join('  ' + l + '\n' for l in inner_lines)
        + "  ];\n"
        "  if(window.MATS && Array.isArray(window.MATS)){\n"
        "    Array.prototype.push.apply(window.MATS, data);\n"
        "  } else {\n"
        "    window.MATS = data;\n"
        "  }\n"
        "  console.info('[chunk] mats loaded: ' + (window.MATS ? window.MATS.length : 0) + ' entries');\n"
        "})();\n"
    )
    atomic_write('public/js/mats-data.js', chunk_src)
    verify_js('public/js/mats-data.js')
    print(f'  OK: wrote {entry_count} entries ({len(chunk_src)} chars)')


# ============================================================
# 3) Add 'mats' to build.js CHUNK_GROUPS
# ============================================================
def patch_build_js():
    rel = 'build.js'
    print('[PERF-15] build.js: add mats chunk')
    backup(rel)
    src = read(rel)
    if "mats: ['mats-data.js']" in src:
        print('  SKIP (already applied)')
        return

    old = "  ai:   ['ai-core.js', 'ai-recommendations.js', 'ai-approvals.js',\n         'ai-module-panels.js', 'ai-ops-center.js'],\n};"
    new = (
        "  ai:   ['ai-core.js', 'ai-recommendations.js', 'ai-approvals.js',\n"
        "         'ai-module-panels.js', 'ai-ops-center.js'],\n"
        "  // PERF-15 fix (2026-05-24): MATS catalog (475 entries) lazy-loaded\n"
        "  mats: ['mats-data.js'],\n"
        "};"
    )
    src = replace_unique(src, old, new, 'PERF-15 build.js CHUNK_GROUPS')
    atomic_write(rel, src)
    print('  OK')


# ============================================================
# 4) Patch app.js:buildMS to retry after chunk loads
# ============================================================
def patch_app_js():
    rel = 'public/js/app.js'
    print('[PERF-15] app.js: buildMS retry-after-chunk guard')
    backup(rel)
    src = read(rel)
    if 'PERF-15 fix' in src:
        print('  SKIP (already applied)')
        return

    # Use a single-line needle that's unique in the file (avoids CRLF/LF
    # mismatch issues with multi-line patterns).
    old = "const vs=[...new Set(MATS.map(m=>m.v))];for(const v of vs){"
    new = "/* PERF-15 fix: if mats chunk not loaded yet, kick it off and re-render */ if((!MATS||!MATS.length)&&typeof loadChunk==='function'){loadChunk('mats').then(function(){buildMS(id,def)}).catch(function(e){console.warn('mats chunk load:',e&&e.message)});return} const vs=[...new Set(MATS.map(m=>m.v))];for(const v of vs){"
    src = replace_unique(src, old, new, 'PERF-15 app.js buildMS guard')
    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# 5) Patch modules.js:renderVendors + openMatProfile guards
# ============================================================
def patch_modules_js():
    rel = 'public/js/modules.js'
    print('[PERF-15] modules.js: renderVendors + openMatProfile guards')
    backup(rel)
    src = read(rel)
    if 'PERF-15 fix' in src:
        print('  SKIP (already applied)')
        return

    # Single-line needles to avoid CRLF/LF line-ending mismatches.
    # renderVendors: insert guard right at function entry.
    old_rv = "function renderVendors(){const vendors=JSON.parse(localStorage.getItem('mfx_vendors')||'[]');"
    new_rv = "function renderVendors(){/* PERF-15 fix: ensure mats chunk loaded before rendering vendor catalog */ if((!MATS||!MATS.length)&&typeof loadChunk==='function'){loadChunk('mats').then(function(){renderVendors()}).catch(function(e){console.warn('mats chunk load:',e&&e.message)});return} const vendors=JSON.parse(localStorage.getItem('mfx_vendors')||'[]');"
    src = replace_unique(src, old_rv, new_rv, 'PERF-15 modules.js renderVendors guard')

    # openMatProfile: same pattern
    old_omp = "function openMatProfile(specId){const mat=MATS.find(m=>m.s===specId);"
    new_omp = "function openMatProfile(specId){/* PERF-15 fix: ensure mats chunk loaded before profile lookup */ if((!MATS||!MATS.length)&&typeof loadChunk==='function'){loadChunk('mats').then(function(){openMatProfile(specId)}).catch(function(e){console.warn('mats chunk load:',e&&e.message)});return} const mat=MATS.find(m=>m.s===specId);"
    src = replace_unique(src, old_omp, new_omp, 'PERF-15 modules.js openMatProfile guard')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print('Applying PERF-15 (lazy-load MATS catalog)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    mats_block = extract_and_stub_core()
    write_mats_chunk(mats_block)
    patch_build_js()
    patch_app_js()
    patch_modules_js()
    print('\nPERF-15 fix applied.')
    print('Next: npm run deploy  (build will produce mfx-mats.HASH.js chunk)')
    print('Verify: open the app, open a quote, confirm material dropdowns')
    print('        populate. Console should show "[chunk] mats loaded: 475 entries"')
    print('        shortly after page load.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
