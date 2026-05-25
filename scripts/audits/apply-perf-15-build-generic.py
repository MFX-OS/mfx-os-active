"""
apply-perf-15-build-generic.py
==============================
Follow-up to PERF-15: refactor build.js so it builds ALL non-core chunks
listed in CHUNK_GROUPS instead of having hardcoded chat+ai steps.

Why: After PERF-15 added `mats: ['mats-data.js']` to CHUNK_GROUPS, the next
build still produced only 3 files because main() and patchSW() were
hardcoded for chat+ai. The new `mats` chunk was silently ignored — loading
the deployed app would hit "Unknown chunk: mats" because the manifest
didn't include it.

This script makes both main() and patchSW() iterate over CHUNK_GROUPS, so
any future chunk added to CHUNK_GROUPS auto-builds.

Usage:
  python3 scripts/audits/apply-perf-15-build-generic.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-perf15-build')
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


def fix_build_js():
    print('[PERF-15 build] build.js: generic chunk iteration')
    rel = 'build.js'
    backup(rel)
    src = read(rel)
    if 'PERF-15 build generic' in src:
        print('  SKIP (already applied)')
        return

    # ----------------------------------------------------------------------
    # 1) Replace main() — build all non-core chunks in a loop, then core.
    # ----------------------------------------------------------------------
    old_main_marker = "  // Build each chunk. Hash core LAST because it needs to know the chat+ai"
    if old_main_marker not in src:
        raise RuntimeError('PERF-15 build: could not locate main() marker')

    # Find the end of main() — the `}` that closes async function main()
    # We'll match from the marker through the "Build complete" log line, and
    # extract everything up to the close of main().
    # Simpler: find the marker, then find the next "✅ Build complete" log
    # line, then find the closing `}` right after.
    start = src.index(old_main_marker)
    end_log = "  console.log('✅ Build complete — run: firebase deploy --only hosting:os\\n');"
    if end_log not in src[start:]:
        raise RuntimeError('PERF-15 build: could not locate end-log marker')
    end = src.index(end_log, start) + len(end_log) + 1  # include trailing newline

    new_main_block = (
        "  // PERF-15 build generic (2026-05-24): iterate ALL non-core chunks in\n"
        "  // CHUNK_GROUPS so new chunks (mats, future ones) auto-build without\n"
        "  // touching this file. Core is still built LAST so it can ship the manifest.\n"
        "  const nonCoreNames = Object.keys(CHUNK_GROUPS).filter(n => n !== 'core');\n"
        "  const chunkBuilds = {}; // {name: {filename, size}}\n"
        "  let stepNum = 2;\n"
        "  for (const name of nonCoreNames) {\n"
        "    console.log(`Step ${stepNum}: Building ${name} chunk...`);\n"
        "    const raw = concatenateGroup(name, CHUNK_GROUPS[name]);\n"
        "    const min = await minify(raw);\n"
        "    const hash = hashContent(min);\n"
        "    const filename = `mfx-${name}.${hash}.js`;\n"
        "    fs.writeFileSync(path.join(JS_DIR, filename), min, 'utf8');\n"
        "    console.log(`  → js/${filename} (${(min.length / 1024).toFixed(0)} KB)`);\n"
        "    chunkBuilds[name] = { filename, size: min.length };\n"
        "    stepNum++;\n"
        "  }\n"
        "\n"
        "  console.log(`Step ${stepNum}: Building core chunk (with chunk manifest)...`);\n"
        "  const manifestEntries = nonCoreNames\n"
        "    .map(n => `\"${n}\":${JSON.stringify(chunkBuilds[n].filename)}`)\n"
        "    .join(',');\n"
        "  const manifestHeader =\n"
        "    `\\n/* ═══ chunk manifest (PERF-09) ═══ */\\n` +\n"
        "    `window.MFX_CHUNK_MANIFEST = {${manifestEntries}};\\n`;\n"
        "  const coreRaw  = manifestHeader + concatenateGroup('core', CHUNK_GROUPS.core);\n"
        "  const coreMin  = await minify(coreRaw);\n"
        "  const coreHash = hashContent(coreMin);\n"
        "  const coreFilename = `mfx-core.${coreHash}.js`;\n"
        "  fs.writeFileSync(path.join(JS_DIR, coreFilename), coreMin, 'utf8');\n"
        "  console.log(`  → js/${coreFilename} (${(coreMin.length / 1024).toFixed(0)} KB)`);\n"
        "  stepNum++;\n"
        "\n"
        "  console.log(`Step ${stepNum}: Patching index.html...`);\n"
        "  patchIndex(coreFilename);\n"
        "  stepNum++;\n"
        "\n"
        "  console.log(`Step ${stepNum}: Patching sw.js...`);\n"
        "  patchSW(coreFilename, chunkBuilds);\n"
        "\n"
        "  const chunkTotal = Object.values(chunkBuilds).reduce((s,c) => s + c.size, 0);\n"
        "  const totalSize = coreMin.length + chunkTotal;\n"
        "  const initialLoad = coreMin.length;\n"
        "  console.log('\\n═══════════════════════════════════════');\n"
        "  console.log(`  Initial load (core):  ${(initialLoad / 1024).toFixed(0)} KB`);\n"
        "  for (const name of nonCoreNames) {\n"
        "    console.log(`  Lazy ${name} chunk:${' '.repeat(Math.max(1, 8-name.length))}${(chunkBuilds[name].size / 1024).toFixed(0)} KB (lazy)`);\n"
        "  }\n"
        "  console.log(`  Total all chunks:     ${(totalSize / 1024).toFixed(0)} KB`);\n"
        "  console.log(`  Saved off initial:    ${((totalSize - initialLoad) / 1024).toFixed(0)} KB (${Math.round((totalSize - initialLoad) / totalSize * 100)}%)`);\n"
        "  console.log(`  Mode: ${isDev ? 'development' : 'production'}`);\n"
        "  console.log('═══════════════════════════════════════\\n');\n"
        "  console.log('✅ Build complete — run: firebase deploy --only hosting:os\\n');\n"
    )

    src = src[:start] + new_main_block + src[end:]

    # ----------------------------------------------------------------------
    # 2) Replace patchSW signature + body — accept chunkBuilds map.
    # ----------------------------------------------------------------------
    old_patchsw_sig = "function patchSW(coreFilename, chatFilename, aiFilename) {"
    new_patchsw_sig = "function patchSW(coreFilename, chunkBuilds) {"
    src = replace_unique(src, old_patchsw_sig, new_patchsw_sig, 'PERF-15 build patchSW sig')

    old_static_assets = """  const newAssets = `var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/theme.css',
  '/js/${coreFilename}',
  '/js/${chatFilename}',
  '/js/${aiFilename}',
  '/manifest.json'
];`;"""
    new_static_assets = """  // PERF-15 build generic: STATIC_ASSETS now includes every chunk in chunkBuilds.
  const chunkLines = Object.values(chunkBuilds)
    .map(c => `  '/js/${c.filename}',`)
    .join('\\n');
  const newAssets = `var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/theme.css',
  '/js/${coreFilename}',
${chunkLines}
  '/manifest.json'
];`;"""
    src = replace_unique(src, old_static_assets, new_static_assets, 'PERF-15 build STATIC_ASSETS')

    # Also update the log line "Patched sw.js (3 chunks in cache)"
    old_log = "  console.log(`  Patched sw.js (3 chunks in cache)`);"
    new_log = "  console.log(`  Patched sw.js (${Object.keys(chunkBuilds).length + 1} entries in cache)`);"
    src = replace_unique(src, old_log, new_log, 'PERF-15 build sw.js log')

    # Update the header banner so it stops claiming "3-bundle"
    old_banner = "  console.log('\\n🔨 MFX OS Build (PERF-09: 3-bundle split)\\n');"
    new_banner = "  console.log('\\n🔨 MFX OS Build (PERF-09: code-split bundles)\\n');"
    src = replace_unique(src, old_banner, new_banner, 'PERF-15 build banner')

    atomic_write(rel, src)
    verify_js(rel)
    print('  OK')


def main():
    print('Applying PERF-15 follow-up (generic chunk iteration in build.js)...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_build_js()
    print('\nDone. Next: npm run deploy')
    print('Expect to see "Building mats chunk..." step and an mfx-mats.HASH.js file.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
