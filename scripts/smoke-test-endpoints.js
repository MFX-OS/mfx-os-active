#!/usr/bin/env node
// MFX OS — Smoke test for the three new endpoints shipped 2026-05.
//
// Tests:
//   1. /api/uploadToDrive            — direct file upload
//   2. /api/getPortalUploadFolder    — Drive folder share for large files
//   3. /api/saveSalesOrderPDF        — server-side SO PDF save
//
// Required env (set in .env.smoke or your shell):
//   FIREBASE_API_KEY         — public Web API key (see Console > Project Settings)
//   MFX_TEST_PORTAL_EMAIL    — a real portal-client email tied to MFX_TEST_QUOTE_ID
//   MFX_TEST_PORTAL_PASSWORD — its password (if using email/password) — OR set
//                              MFX_TEST_PORTAL_ID_TOKEN directly
//   MFX_TEST_STAFF_EMAIL     — internal @microflexfilm.com email
//   MFX_TEST_STAFF_PASSWORD  — its password — OR set MFX_TEST_STAFF_ID_TOKEN
//   MFX_TEST_QUOTE_ID        — Firestore quote doc id for portal user
//   MFX_TEST_SO_ID           — Firestore salesOrders doc id (will be updated)
//
// Optional env:
//   MFX_BASE_URL             — default https://mfx-2026.web.app
//   MFX_TEST_SO_NUM          — default derived from soId
//   MFX_TEST_SO_COMPANY      — default "SMOKE TEST"
//   SKIP_UPLOAD              — set to "1" to skip the uploadToDrive test
//   SKIP_FOLDER              — set to "1" to skip the getPortalUploadFolder test
//   SKIP_SO_PDF              — set to "1" to skip the saveSalesOrderPDF test
//
// Usage:
//   node scripts/smoke-test-endpoints.js
//   npm run test:smoke
//
// Exit codes:
//   0 — all tests passed (or skipped)
//   1 — any test failed
//   2 — missing required env vars

'use strict';

const BASE = process.env.MFX_BASE_URL || 'https://mfx-2026.web.app';
const API_KEY = process.env.FIREBASE_API_KEY || '';

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`
};

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const marker = ok ? C.green('✓ PASS') : C.red('✗ FAIL');
  console.log(`  ${marker}  ${name}`);
  if (detail) console.log(`         ${C.dim(detail)}`);
}

async function signIn(email, password) {
  if (!API_KEY) throw new Error('FIREBASE_API_KEY env var required');
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await r.json();
  if (!r.ok || !data.idToken) {
    throw new Error(`signIn failed for ${email}: ${data.error?.message || r.status}`);
  }
  return data.idToken;
}

async function getPortalToken() {
  if (process.env.MFX_TEST_PORTAL_ID_TOKEN) return process.env.MFX_TEST_PORTAL_ID_TOKEN;
  return signIn(process.env.MFX_TEST_PORTAL_EMAIL, process.env.MFX_TEST_PORTAL_PASSWORD);
}

async function getStaffToken() {
  if (process.env.MFX_TEST_STAFF_ID_TOKEN) return process.env.MFX_TEST_STAFF_ID_TOKEN;
  return signIn(process.env.MFX_TEST_STAFF_EMAIL, process.env.MFX_TEST_STAFF_PASSWORD);
}

// Smallest valid PDF — 7 bytes of header + minimal catalog/trailer.
// 600 bytes total is plenty; just needs Drive to accept it as application/pdf.
function makeTinyPdfBase64() {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
    'xref',
    '0 4',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000054 00000 n ',
    '0000000100 00000 n ',
    'trailer<</Size 4/Root 1 0 R>>',
    'startxref',
    '155',
    '%%EOF'
  ].join('\n');
  return Buffer.from(pdf, 'utf8').toString('base64');
}

// ─── TEST 1: /api/uploadToDrive ───
async function testUploadToDrive() {
  console.log(C.bold('\n[1/3] /api/uploadToDrive'));
  if (process.env.SKIP_UPLOAD === '1') {
    console.log('  ' + C.yellow('⊘ SKIPPED') + '  (SKIP_UPLOAD=1)');
    return;
  }
  try {
    const token = await getPortalToken();
    const pdfBase64 = makeTinyPdfBase64();
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(pdfBase64, 'base64')], { type: 'application/pdf' }), `smoke-${Date.now()}.pdf`);
    form.append('company', 'SMOKE TEST');
    form.append('quoteNum', 'SMOKE-' + Date.now());
    form.append('fileType', 'PO');
    form.append('quoteId', process.env.MFX_TEST_QUOTE_ID || 'smoke-test-quote');

    const r = await fetch(`${BASE}/api/uploadToDrive`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: form
    });
    const data = await r.json().catch(() => ({}));

    if (r.status === 200 && data.success && data.driveLink) {
      record('uploadToDrive returns 200 + driveLink', true, data.driveLink);
    } else {
      record('uploadToDrive returns 200 + driveLink', false, `HTTP ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (err) {
    record('uploadToDrive', false, err.message);
  }
}

// ─── TEST 2: /api/getPortalUploadFolder ───
async function testGetPortalUploadFolder() {
  console.log(C.bold('\n[2/3] /api/getPortalUploadFolder'));
  if (process.env.SKIP_FOLDER === '1') {
    console.log('  ' + C.yellow('⊘ SKIPPED') + '  (SKIP_FOLDER=1)');
    return;
  }
  const quoteId = process.env.MFX_TEST_QUOTE_ID;
  if (!quoteId) {
    record('getPortalUploadFolder', false, 'MFX_TEST_QUOTE_ID not set');
    return;
  }
  try {
    const token = await getPortalToken();
    const r = await fetch(`${BASE}/api/getPortalUploadFolder`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, fileType: 'PO' })
    });
    const data = await r.json().catch(() => ({}));

    if (r.status === 200 && data.success && data.link && data.sharedWith) {
      record('getPortalUploadFolder returns folder + sharedWith email', true,
        `${data.sharedWith} → ${data.link}`);
    } else if (r.status === 403) {
      record('getPortalUploadFolder', false,
        `403 — portal email mismatch. Check MFX_TEST_PORTAL_EMAIL matches quote.fields.custEmail or poClientEmail`);
    } else {
      record('getPortalUploadFolder', false, `HTTP ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }

    // Rate-limit smoke check: 6 requests in quick succession should hit 429
    let limited = false;
    for (let i = 0; i < 6; i++) {
      const rr = await fetch(`${BASE}/api/getPortalUploadFolder`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, fileType: 'PO' })
      });
      if (rr.status === 429) { limited = true; break; }
    }
    record('getPortalUploadFolder rate-limit triggers 429 after 5/min', limited,
      limited ? 'rate limiter is working' : 'no 429 seen — limiter may be disabled or window expired');
  } catch (err) {
    record('getPortalUploadFolder', false, err.message);
  }
}

// ─── TEST 3: /api/saveSalesOrderPDF ───
async function testSaveSalesOrderPDF() {
  console.log(C.bold('\n[3/3] /api/saveSalesOrderPDF'));
  if (process.env.SKIP_SO_PDF === '1') {
    console.log('  ' + C.yellow('⊘ SKIPPED') + '  (SKIP_SO_PDF=1)');
    return;
  }
  const soId = process.env.MFX_TEST_SO_ID;
  if (!soId) {
    record('saveSalesOrderPDF', false, 'MFX_TEST_SO_ID not set');
    return;
  }
  try {
    const token = await getStaffToken();
    const soNum = process.env.MFX_TEST_SO_NUM || ('SMOKE-' + Date.now());
    const company = process.env.MFX_TEST_SO_COMPANY || 'SMOKE TEST';
    const r = await fetch(`${BASE}/api/saveSalesOrderPDF`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        soId, soNum, quoteNum: soNum, company,
        filename: `${soNum}-smoke.pdf`,
        pdfBase64: makeTinyPdfBase64()
      })
    });
    const data = await r.json().catch(() => ({}));

    if (r.status === 200 && data.success && data.masterLink && data.clientLink) {
      record('saveSalesOrderPDF returns 200 + masterLink + clientLink', true,
        `master=${data.masterLink.slice(0, 60)}…`);
    } else if (r.status === 403) {
      record('saveSalesOrderPDF', false,
        `403 — internal user required. Check MFX_TEST_STAFF_EMAIL ends with @microflexfilm.com`);
    } else {
      record('saveSalesOrderPDF', false, `HTTP ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (err) {
    record('saveSalesOrderPDF', false, err.message);
  }
}

function preflight() {
  const missing = [];
  if (!API_KEY) missing.push('FIREBASE_API_KEY');
  const needPortal = process.env.SKIP_UPLOAD !== '1' || process.env.SKIP_FOLDER !== '1';
  const needStaff = process.env.SKIP_SO_PDF !== '1';
  if (needPortal && !process.env.MFX_TEST_PORTAL_ID_TOKEN) {
    if (!process.env.MFX_TEST_PORTAL_EMAIL) missing.push('MFX_TEST_PORTAL_EMAIL');
    if (!process.env.MFX_TEST_PORTAL_PASSWORD) missing.push('MFX_TEST_PORTAL_PASSWORD');
  }
  if (needStaff && !process.env.MFX_TEST_STAFF_ID_TOKEN) {
    if (!process.env.MFX_TEST_STAFF_EMAIL) missing.push('MFX_TEST_STAFF_EMAIL');
    if (!process.env.MFX_TEST_STAFF_PASSWORD) missing.push('MFX_TEST_STAFF_PASSWORD');
  }
  if (missing.length) {
    console.error(C.red('Missing required env vars:'), missing.join(', '));
    console.error('See header of ' + __filename + ' for full env reference.');
    process.exit(2);
  }
}

(async () => {
  console.log(C.bold(`MFX OS Endpoint Smoke Tests`));
  console.log(C.dim(`Target: ${BASE}`));
  console.log(C.dim(`Started: ${new Date().toISOString()}`));
  preflight();

  await testUploadToDrive();
  await testGetPortalUploadFolder();
  await testSaveSalesOrderPDF();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('');
  console.log(C.bold('─── Summary ───'));
  console.log(`  ${C.green(passed + ' passed')}, ${failed ? C.red(failed + ' failed') : '0 failed'}, ${results.length} total`);

  if (failed > 0) {
    console.log('');
    console.log(C.red('Some smoke tests failed. Check Functions logs:'));
    console.log(C.dim('  firebase functions:log --only uploadToDrive,getPortalUploadFolder,saveSalesOrderPDF'));
    process.exit(1);
  }
  process.exit(0);
})().catch(err => {
  console.error(C.red('Smoke test runner crashed:'), err);
  process.exit(1);
});
