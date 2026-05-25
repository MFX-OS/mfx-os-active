#!/usr/bin/env node
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
