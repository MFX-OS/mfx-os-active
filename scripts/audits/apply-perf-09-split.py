"""
apply-perf-09-split.py
======================
PERF-09: Refactor build pipeline to produce 3 bundles instead of 1.

Architecture:
  mfx-core.<hash>.js  — 49 files, ~2.1 MB minified (loaded synchronously)
  mfx-chat.<hash>.js  — chat.js + ai-chat-bridge.js (~270 KB, lazy-loaded)
  mfx-ai.<hash>.js    — 5 ai-* modules (~60 KB, lazy-loaded)

Lazy chunks load:
  1. Eagerly 2 seconds after page ready (so they're warm before clicks)
  2. On-demand when goView('chat') or goView('aiops') fires
     (catches the case where eager preload hasn't completed yet)

A reentrancy guard on goView prevents infinite recursion.

Changes:
  1. build.js              — rewritten to multi-chunk; produces manifest + patches html/sw
  2. public/index.html     — loads only mfx-core.<hash>.js (build does patching)
  3. public/sw.js          — STATIC_ASSETS now lists all 3 chunks (build does patching)
  4. public/js/core.js     — inject loadChunk() + VIEW_CHUNK_MAP + goView wrapping

Idempotent — safe to re-run. Verifies syntax of every output before declaring done.

Usage:
  python3 scripts/audits/apply-perf-09-split.py
"""
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S') + '-perf09')
os.makedirs(BACKUP_DIR, exist_ok=True)


def backup(rel):
    dst = os.path.join(BACKUP_DIR, rel.replace('/', '__').replace('\\', '__'))
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    if os.path.exists(rel):
        shutil.copy2(rel, dst)


def atomic_write(rel, content):
    os.makedirs(os.path.dirname(rel) or '.', exist_ok=True)
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


# ============================================================
# Step 1: Rewrite build.js to produce 3 bundles
# ============================================================
NEW_BUILD_JS = r"""#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// MFX OS — Build Script (PERF-09 fix: 3-bundle split)
// Concatenates, minifies, and content-hashes JS modules into 3 chunks:
//   mfx-core.<hash>.js  — core, always loaded
//   mfx-chat.<hash>.js  — chat + ai-chat-bridge, lazy
//   mfx-ai.<hash>.js    — ai-* modules, lazy
//
// Usage: node build.js [--dev] [--clean]
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, 'public');
const JS_DIR = path.join(PUBLIC, 'js');
const INDEX = path.join(PUBLIC, 'index.html');
const SW = path.join(PUBLIC, 'sw.js');

const isDev = process.argv.includes('--dev');
const isClean = process.argv.includes('--clean');

// PERF-09: 3-bundle chunk split.
// `core` loads synchronously. `chat` and `ai` are lazy — fetched when their
// views open (or eagerly preloaded 2s after page load, see core.js loadChunk).
const CHUNK_GROUPS = {
  core: [
    'sentry-config.js', 'sound.js', 'intro.js', 'core.js', 'full-menu.js',
    'os-search.js', 'audit-log.js', 'app.js', 'modules.js',
    'features.js', 'gamification.js', 'analytics.js', 'pipeline-patch.js',
    'realtime.js', 'orders.js', 'so-workflow.js', 'production.js',
    'ppd.js', 'ppd-master.js', 'ppd-labeltraxx-parity.js',
    'vendor-pos.js', 'vendor-profile.js', 'vendor-workspace.js',
    'vendor-patches.js', 'logistics.js', 'gmp.js', 'capa.js',
    'audit.js', 'training.js', 'doccontrol.js', 'hr.js', 'operator.js',
    'launchpad.js', 'sqf-datalogs.js', 'sqf-alerts.js', 'sqf-evidence.js',
    'sqf-records.js', 'master-automation.js', 'client-services.js', 'sales.js',
    'job-tracker.js', 'ceo-dash.js', 'system-control.js',
    'data-sync.js', 'notifications.js', 'platform-services.js',
    'drive-listener.js', 'fsqms-module.js', 'a11y.js',
  ],
  chat: ['chat.js', 'ai-chat-bridge.js'],
  ai:   ['ai-core.js', 'ai-recommendations.js', 'ai-approvals.js',
         'ai-module-panels.js', 'ai-ops-center.js'],
};

// ─── CLEAN ───
function cleanBundles() {
  const files = fs.readdirSync(JS_DIR);
  let cleaned = 0;
  let skipped = 0;
  files.forEach(f => {
    if (/^mfx-(bundle|core|chat|ai)\./.test(f) || f.endsWith('.bak')) {
      try {
        fs.unlinkSync(path.join(JS_DIR, f));
        cleaned++;
      } catch (e) {
        if (e.code === 'EPERM' || e.code === 'EACCES') {
          console.warn(`  ⚠ Cannot remove ${f} (locked on host FS) — skipping`);
          skipped++;
        } else {
          throw e;
        }
      }
    }
  });
  console.log(`  Cleaned ${cleaned} file(s)${skipped ? `, skipped ${skipped} locked file(s)` : ''}`);
}

// ─── CONCATENATE ONE GROUP ───
function concatenateGroup(groupName, files) {
  let total = 0;
  const parts = files.map(file => {
    const filepath = path.join(JS_DIR, file);
    if (!fs.existsSync(filepath)) {
      console.warn(`  ⚠ Missing: ${file} — skipping`);
      return '';
    }
    const content = fs.readFileSync(filepath, 'utf8');
    total += content.length;
    return `\n/* ═══ ${file} ═══ */\n${content}`;
  });
  const combined = parts.join('\n;\n');
  console.log(`  [${groupName}] ${files.length} files, ${(total / 1024).toFixed(0)} KB source`);
  return combined;
}

// ─── MINIFY ───
async function minify(code) {
  if (isDev) return code;
  const esbuild = require('esbuild');
  const result = await esbuild.transform(code, {
    minify: true,
    target: 'es2020',
    legalComments: 'none',
    pure: ['console.log'],
  });
  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn(`  ⚠ ${w.text}`));
  }
  return result.code;
}

function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

// ─── PATCH INDEX.HTML ───
function patchIndex(coreFilename) {
  let html = fs.readFileSync(INDEX, 'utf8');

  // Replace any existing mfx-bundle.* or mfx-core.* script tag with new core.
  // Also strip any prior mfx-chat.* / mfx-ai.* tags — those load via loadChunk now.
  const monolithic = /<script src="js\/mfx-bundle\.[a-f0-9]+\.js"><\/script>\n?/g;
  const oldCore    = /<script src="js\/mfx-core\.[a-f0-9]+\.js"><\/script>\n?/g;
  const oldChat    = /<script src="js\/mfx-chat\.[a-f0-9]+\.js"><\/script>\n?/g;
  const oldAi      = /<script src="js\/mfx-ai\.[a-f0-9]+\.js"><\/script>\n?/g;

  if (monolithic.test(html)) {
    html = html.replace(monolithic, `<script src="js/${coreFilename}"></script>\n`);
  } else if (oldCore.test(html)) {
    html = html.replace(oldCore, `<script src="js/${coreFilename}"></script>\n`);
  } else {
    // Fallback: replace the individual JS_FILES script-tag block with our core tag
    const scriptPattern = /<script src="js\/(?!mfx-(bundle|core|chat|ai)|sentry-loader|inline-boot)[^"]+\.js"><\/script>\n?/g;
    const scripts = html.match(scriptPattern);
    if (scripts && scripts.length) {
      const firstIdx = html.indexOf(scripts[0]);
      const lastIdx  = html.lastIndexOf(scripts[scripts.length - 1]);
      const lastEnd  = lastIdx + scripts[scripts.length - 1].length;
      html = html.substring(0, firstIdx)
           + `<script src="js/${coreFilename}"></script>\n`
           + html.substring(lastEnd);
    }
  }
  // Always strip lingering chat/ai tags — those are dynamically loaded now.
  html = html.replace(oldChat, '').replace(oldAi, '');

  fs.writeFileSync(INDEX, html, 'utf8');
  console.log(`  Patched index.html → js/${coreFilename}`);
}

// ─── PATCH SW.JS ───
function patchSW(coreFilename, chatFilename, aiFilename) {
  let sw = fs.readFileSync(SW, 'utf8');
  sw = sw.replace(/var CACHE_NAME = '[^']+';/, `var CACHE_NAME = 'mfx-${Date.now().toString(36)}';`);
  sw = sw.replace(/var CDN_CACHE = '[^']+';/, `var CDN_CACHE = 'mfx-cdn-${Date.now().toString(36)}';`);

  const startMarker = 'var STATIC_ASSETS = [';
  const startIdx = sw.indexOf(startMarker);
  if (startIdx === -1) {
    console.warn('  ⚠ Could not find STATIC_ASSETS in sw.js');
    return;
  }
  let endIdx = sw.indexOf('];', startIdx);
  let endLen = 2;
  if (endIdx === -1) {
    endIdx = sw.indexOf(']', startIdx);
    endLen = 1;
  }
  if (endIdx === -1) {
    console.warn('  ⚠ Could not find end of STATIC_ASSETS in sw.js');
    return;
  }
  const newAssets = `var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/theme.css',
  '/js/${coreFilename}',
  '/js/${chatFilename}',
  '/js/${aiFilename}',
  '/manifest.json'
];`;
  sw = sw.substring(0, startIdx) + newAssets + sw.substring(endIdx + endLen);
  fs.writeFileSync(SW, sw, 'utf8');
  console.log(`  Patched sw.js (3 chunks in cache)`);
}

// ─── MAIN ───
async function main() {
  console.log('\n🔨 MFX OS Build (PERF-09: 3-bundle split)\n');

  console.log('Step 1: Cleaning...');
  cleanBundles();
  if (isClean) { console.log('\n✅ Clean complete\n'); return; }

  // Build each chunk. Hash core LAST because it needs to know the chat+ai
  // filenames so it can ship the manifest.
  console.log('Step 2: Building chat chunk...');
  const chatRaw  = concatenateGroup('chat', CHUNK_GROUPS.chat);
  const chatMin  = await minify(chatRaw);
  const chatHash = hashContent(chatMin);
  const chatFilename = `mfx-chat.${chatHash}.js`;
  fs.writeFileSync(path.join(JS_DIR, chatFilename), chatMin, 'utf8');
  console.log(`  → js/${chatFilename} (${(chatMin.length / 1024).toFixed(0)} KB)`);

  console.log('Step 3: Building ai chunk...');
  const aiRaw  = concatenateGroup('ai', CHUNK_GROUPS.ai);
  const aiMin  = await minify(aiRaw);
  const aiHash = hashContent(aiMin);
  const aiFilename = `mfx-ai.${aiHash}.js`;
  fs.writeFileSync(path.join(JS_DIR, aiFilename), aiMin, 'utf8');
  console.log(`  → js/${aiFilename} (${(aiMin.length / 1024).toFixed(0)} KB)`);

  console.log('Step 4: Building core chunk (with chunk manifest)...');
  // The manifest header gets injected as the first line of the core bundle.
  // core.js's loadChunk() reads window.MFX_CHUNK_MANIFEST at runtime.
  const manifestHeader =
    `\n/* ═══ chunk manifest (PERF-09) ═══ */\n` +
    `window.MFX_CHUNK_MANIFEST = {` +
    `"chat":${JSON.stringify(chatFilename)},` +
    `"ai":${JSON.stringify(aiFilename)}};\n`;
  const coreRaw  = manifestHeader + concatenateGroup('core', CHUNK_GROUPS.core);
  const coreMin  = await minify(coreRaw);
  const coreHash = hashContent(coreMin);
  const coreFilename = `mfx-core.${coreHash}.js`;
  fs.writeFileSync(path.join(JS_DIR, coreFilename), coreMin, 'utf8');
  console.log(`  → js/${coreFilename} (${(coreMin.length / 1024).toFixed(0)} KB)`);

  console.log('Step 5: Patching index.html...');
  patchIndex(coreFilename);

  console.log('Step 6: Patching sw.js...');
  patchSW(coreFilename, chatFilename, aiFilename);

  const totalSize = coreMin.length + chatMin.length + aiMin.length;
  const initialLoad = coreMin.length;
  console.log('\n═══════════════════════════════════════');
  console.log(`  Initial load (core):  ${(initialLoad / 1024).toFixed(0)} KB`);
  console.log(`  Lazy chat chunk:      ${(chatMin.length / 1024).toFixed(0)} KB (loaded when chat opens)`);
  console.log(`  Lazy ai chunk:        ${(aiMin.length / 1024).toFixed(0)} KB (loaded when aiops opens)`);
  console.log(`  Total all chunks:     ${(totalSize / 1024).toFixed(0)} KB`);
  console.log(`  Saved off initial:    ${((totalSize - initialLoad) / 1024).toFixed(0)} KB (${Math.round((totalSize - initialLoad) / totalSize * 100)}%)`);
  console.log(`  Mode: ${isDev ? 'development' : 'production'}`);
  console.log('═══════════════════════════════════════\n');
  console.log('✅ Build complete — run: firebase deploy --only hosting:os\n');
}

main().catch(err => {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
});
"""


# ============================================================
# Step 2: Patch core.js to add loadChunk() + goView wrapping
# ============================================================
def patch_core_js():
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)

    if 'PERF-09 fix' in src:
        print('  [core.js] SKIP (already patched)')
        return

    # ---- INJECT 1: loadChunk + VIEW_CHUNK_MAP ----
    # Inject right after the existing `function isViewAllowedForDept` ends —
    # that gives us a stable anchor and ensures loadChunk is defined before goView.
    chunk_loader_block = '''
// ═══ PERF-09 fix (2026-05-24): lazy chunk loader ═══
// build.js produces 3 bundles. core (this one) loads synchronously. `chat` and
// `ai` load on demand via this loader. window.MFX_CHUNK_MANIFEST is injected by
// build.js at the top of the core bundle and maps chunk name -> hashed filename.
window.MFX_CHUNK_MANIFEST = window.MFX_CHUNK_MANIFEST || {};
var VIEW_CHUNK_MAP = {
  'chat': 'chat',
  'aiops': 'ai',
};
window.VIEW_CHUNK_MAP = VIEW_CHUNK_MAP;
var _loadedChunks = {};
function loadChunk(name){
  if(_loadedChunks[name]) return _loadedChunks[name];
  var filename = (window.MFX_CHUNK_MANIFEST||{})[name];
  if(!filename){
    return Promise.reject(new Error('Unknown chunk: '+name));
  }
  _loadedChunks[name] = new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = '/js/' + filename;
    s.async = false;
    s.onload = function(){ console.info('[chunk] loaded:', name); resolve(); };
    s.onerror = function(){
      delete _loadedChunks[name];
      reject(new Error('Failed to load chunk: '+name));
    };
    document.head.appendChild(s);
  });
  return _loadedChunks[name];
}
window.loadChunk = loadChunk;
// Eagerly preload lazy chunks 2 seconds after auth + listeners are ready, so
// they're warm before the user clicks. On-demand fallback in goView covers the
// case where they haven't loaded yet.
if(typeof window !== 'undefined'){
  setTimeout(function(){
    try{
      Object.keys(window.MFX_CHUNK_MANIFEST||{}).forEach(function(name){
        loadChunk(name).catch(function(err){ console.warn('preload '+name+':', err.message); });
      });
    }catch(e){ console.warn('chunk preload:', e); }
  }, 3000);
}
// ═══ end PERF-09 loader ═══

'''
    # Anchor: right after the isViewAllowedForDept function definition closes.
    anchor = 'window.getUserDeptHome=getUserDeptHome;\nwindow.isViewAllowedForDept=isViewAllowedForDept;'
    if anchor not in src:
        raise RuntimeError('PERF-09: anchor for chunk loader not found in core.js')
    src = src.replace(anchor, anchor + '\n' + chunk_loader_block)

    # ---- INJECT 2: chunk-load gate at the TOP of goView ----
    # Find the goView function and insert the gate at its first line.
    go_old = '''function goView(v){
// ═══ DEPARTMENT ACCESS GATE ═══
if(window.CURRENT_USER&&CURRENT_USER.dept&&typeof isViewAllowedForDept==='function'){'''
    go_new = '''function goView(v){
// PERF-09 fix (2026-05-24): lazy-load chunk for views that live in chat/ai bundles.
// _reentry guard prevents infinite recursion if chunk's onload eventually re-calls goView.
if(!goView._reentry){
  var __chunk = (window.VIEW_CHUNK_MAP||{})[v];
  if(__chunk && typeof loadChunk==='function' && !_loadedChunks[__chunk]){
    goView._reentry = true;
    loadChunk(__chunk).then(function(){
      goView._reentry = false;
      goView(v);
    }).catch(function(err){
      goView._reentry = false;
      console.error('Chunk load failed for '+v+':', err);
      if(typeof toast==='function') toast('Failed to load '+v+' module — refresh and retry','err');
    });
    return;
  }
}
goView._reentry = false;
// ═══ DEPARTMENT ACCESS GATE ═══
if(window.CURRENT_USER&&CURRENT_USER.dept&&typeof isViewAllowedForDept==='function'){'''
    if go_old not in src:
        raise RuntimeError('PERF-09: goView anchor not found in core.js')
    src = src.replace(go_old, go_new)

    atomic_write(rel, src)
    verify_js(rel)
    print('  [core.js] OK — chunk loader + goView wrapping injected')


# ============================================================
# RUN
# ============================================================
def main():
    print(f'Applying PERF-09 — 3-bundle code split...')
    print(f'Backup dir: {BACKUP_DIR}\n')

    # 1) Replace build.js
    print('Step 1: Rewriting build.js')
    backup('build.js')
    atomic_write('build.js', NEW_BUILD_JS)
    verify_js('build.js')
    print(f'  build.js: {os.path.getsize("build.js"):,} bytes')

    # 2) Patch core.js
    print('Step 2: Patching public/js/core.js')
    patch_core_js()

    # 3) Run new build.js
    print('Step 3: Running new build.js to produce 3 bundles')
    r = subprocess.run(['node', 'build.js'], capture_output=True, text=True)
    if r.returncode != 0:
        print('  FAILED — build.js output:')
        print(r.stdout)
        print(r.stderr, file=sys.stderr)
        raise RuntimeError('build.js failed; check stderr above')
    print(r.stdout)

    # 4) Verify all bundles
    print('Step 4: Verifying output bundles')
    js_dir = 'public/js'
    bundles = [f for f in os.listdir(js_dir) if f.startswith(('mfx-core.', 'mfx-chat.', 'mfx-ai.')) and f.endswith('.js')]
    for b in sorted(bundles):
        path = os.path.join(js_dir, b)
        verify_js(path)
        print(f'  ✓ {b} ({os.path.getsize(path):,} bytes)')

    print('\nAll PERF-09 changes applied. Test in incognito then deploy.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
