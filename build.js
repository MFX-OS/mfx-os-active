#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// MFX OS — Build Script
// Concatenates, minifies, and content-hashes all JS modules
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

// Exact load order matching index.html script tags
const JS_FILES = [
  'sentry-config.js', 'sound.js', 'intro.js', 'core.js', 'full-menu.js', 'os-search.js', 'audit-log.js', 'app.js', 'modules.js',
  'features.js', 'gamification.js', 'analytics.js', 'pipeline-patch.js',
  'realtime.js', 'orders.js', 'so-workflow.js', 'production.js',
  'ppd.js', 'ppd-master.js', 'ppd-labeltraxx-parity.js',
  'vendor-pos.js', 'vendor-profile.js', 'vendor-workspace.js',
  'vendor-patches.js', 'logistics.js', 'gmp.js', 'capa.js',
  'audit.js', 'training.js', 'doccontrol.js', 'hr.js', 'operator.js',
  'launchpad.js', 'sqf-datalogs.js', 'sqf-alerts.js', 'sqf-evidence.js', 'sqf-records.js', 'master-automation.js', 'client-services.js', 'sales.js',
  'job-tracker.js', 'ceo-dash.js',
  'ai-core.js', 'ai-recommendations.js', 'ai-approvals.js', 'ai-module-panels.js', 'ai-ops-center.js', 'ai-chat-bridge.js',
  'data-sync.js', 'chat.js', 'notifications.js',
  'platform-services.js', 'drive-listener.js', 'fsqms-module.js', 'a11y.js'
  // tests.js excluded from production bundle
];

// ─── CLEAN ───
function cleanBundles() {
  const files = fs.readdirSync(JS_DIR);
  let cleaned = 0;
  let skipped = 0;
  files.forEach(f => {
    if (f.startsWith('mfx-bundle.') || f.endsWith('.bak')) {
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

// ─── CONCATENATE ───
function concatenate() {
  console.log(`  Concatenating ${JS_FILES.length} files...`);
  let total = 0;
  const parts = JS_FILES.map(file => {
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
  console.log(`  Source total: ${(total / 1024).toFixed(0)} KB`);
  return combined;
}

// ─── MINIFY ───
async function minify(code) {
  if (isDev) {
    console.log('  Dev mode — skipping minification');
    return code;
  }
  const esbuild = require('esbuild');
  const result = await esbuild.transform(code, {
    minify: true,
    target: 'es2020',
    legalComments: 'none'
  });
  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn(`  ⚠ ${w.text}`));
  }
  return result.code;
}

// ─── HASH ───
function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

// ─── PATCH INDEX.HTML ───
function patchIndex(bundleFilename) {
  let html = fs.readFileSync(INDEX, 'utf8');

  // Find the block of local script tags: from first "js/" script to last "js/" script (excluding tests.js)
  // Replace with a single bundle script tag
  const scriptPattern = /<script src="js\/(?!mfx-bundle|sentry-loader|inline-boot)[^"]+\.js"><\/script>\n?/g;
  const scripts = html.match(scriptPattern);
  if (!scripts || scripts.length === 0) {
    // Already bundled — replace existing bundle tag
    html = html.replace(
      /<script src="js\/mfx-bundle\.[a-f0-9]+\.js"><\/script>/,
      `<script src="js/${bundleFilename}"></script>`
    );
  } else {
    // First time — replace all individual script tags with bundle
    let firstIdx = html.indexOf(scripts[0]);
    let lastIdx = html.lastIndexOf(scripts[scripts.length - 1]);
    let lastEnd = lastIdx + scripts[scripts.length - 1].length;

    html = html.substring(0, firstIdx)
      + `<script src="js/${bundleFilename}"></script>\n`
      + html.substring(lastEnd);
  }

  fs.writeFileSync(INDEX, html, 'utf8');
  console.log(`  Patched index.html → js/${bundleFilename}`);
}

// ─── PATCH SW.JS ───
function patchSW(bundleFilename) {
  let sw = fs.readFileSync(SW, 'utf8');

  // Bump cache version
  sw = sw.replace(/var CACHE_NAME = '[^']+';/, `var CACHE_NAME = 'mfx-${Date.now().toString(36)}';`);

  // Replace STATIC_ASSETS array
  // Find the array between [ and ];
  const startMarker = 'var STATIC_ASSETS = [';
  const startIdx = sw.indexOf(startMarker);
  if (startIdx === -1) {
    console.warn('  ⚠ Could not find STATIC_ASSETS in sw.js');
    return;
  }
  // Support both `];` and `]` (no semicolon) as end-of-array marker
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
  '/js/${bundleFilename}',
  '/manifest.json'
];`;

  sw = sw.substring(0, startIdx) + newAssets + sw.substring(endIdx + endLen);

  fs.writeFileSync(SW, sw, 'utf8');
  console.log(`  Patched sw.js → cache: js/${bundleFilename}`);
}

// ─── MAIN ───
async function main() {
  console.log('\n🔨 MFX OS Build\n');

  // Step 1: Clean old bundles and .bak files
  console.log('Step 1: Cleaning...');
  cleanBundles();

  if (isClean) {
    console.log('\n✅ Clean complete\n');
    return;
  }

  // Step 2: Concatenate
  console.log('Step 2: Concatenating...');
  const combined = concatenate();

  // Step 3: Minify
  console.log('Step 3: Minifying...');
  const minified = await minify(combined);
  const reduction = Math.round((1 - minified.length / combined.length) * 100);
  console.log(`  Minified: ${(minified.length / 1024).toFixed(0)} KB (${reduction}% reduction)`);

  // Step 4: Hash and write
  console.log('Step 4: Writing bundle...');
  const hash = hashContent(minified);
  const bundleFilename = `mfx-bundle.${hash}.js`;
  const bundlePath = path.join(JS_DIR, bundleFilename);
  fs.writeFileSync(bundlePath, minified, 'utf8');
  console.log(`  → js/${bundleFilename}`);

  // Step 5: Patch index.html
  console.log('Step 5: Patching index.html...');
  patchIndex(bundleFilename);

  // Step 6: Patch sw.js
  console.log('Step 6: Patching sw.js...');
  patchSW(bundleFilename);

  // Summary
  const sourceSize = JS_FILES.reduce((sum, f) => {
    const p = path.join(JS_DIR, f);
    return sum + (fs.existsSync(p) ? fs.statSync(p).size : 0);
  }, 0);

  console.log('\n═══════════════════════════════════════');
  console.log(`  Source:  ${(sourceSize / 1024).toFixed(0)} KB (${JS_FILES.length} files)`);
  console.log(`  Bundle:  ${(minified.length / 1024).toFixed(0)} KB (1 file)`);
  console.log(`  Saved:   ${((sourceSize - minified.length) / 1024).toFixed(0)} KB (${reduction}%)`);
  console.log(`  Hash:    ${hash}`);
  console.log(`  Mode:    ${isDev ? 'development' : 'production'}`);
  console.log('═══════════════════════════════════════\n');
  console.log('✅ Build complete — run: firebase deploy --only hosting:os\n');
}

main().catch(err => {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
});
