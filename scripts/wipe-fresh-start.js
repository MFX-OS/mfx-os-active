#!/usr/bin/env node
// MFX OS — Wipe All Quotes (Fresh Start)
//
// Deletes every doc in /quotes plus the portalMessages and quoteComms
// subcollections under each quote. Does NOT touch salesOrders, jobTickets,
// jobPassports, notifications, syncEvents, or Drive folders.
//
// IRREVERSIBLE — Firestore has no recycle bin. Counts first, requires you
// to type the project ID to confirm, then deletes in batches.
//
// ─── Credentials ────────────────────────────────────────────────────
// Needs admin SDK credentials. Two options:
//
// Option A (recommended): download a service-account JSON from Firebase
// Console > Project Settings > Service Accounts > "Generate new private
// key". Save it OUTSIDE the repo (e.g. C:\Users\You\firebase-key.json).
// Then before running:
//     $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\firebase-key.json"
// Delete that key file when finished.
//
// Option B: if you have gcloud installed:
//     gcloud auth application-default login --project mfx-2026
//
// ─── One-line alternative (no script needed) ────────────────────────
// If you just want to wipe /quotes without the count/confirm UX, the
// firebase CLI can do it in one command, using your existing CLI auth:
//     firebase firestore:delete --recursive quotes --project mfx-2026
// You'll be prompted interactively. Add --force to skip the prompt.
// That command also recursively deletes subcollections.
//
// ─── Usage ──────────────────────────────────────────────────────────
//     node scripts/wipe-fresh-start.js
//
// Exit codes:
//   0 — deletion complete (or nothing to delete)
//   1 — cancelled, credentials failed, or runtime error
//
'use strict';

const PROJECT_ID = process.env.MFX_PROJECT_ID || 'mfx-2026';
const COLLECTION = 'quotes';
const SUBCOLLECTIONS = ['portalMessages', 'quoteComms'];
const BATCH_SIZE = 100;

let admin;
try {
  admin = require('firebase-admin');
} catch (_) {
  // firebase-admin isn't installed at the repo root — fall back to functions/
  try {
    admin = require('../functions/node_modules/firebase-admin');
  } catch (e) {
    console.error('firebase-admin not found. Run:  cd functions && npm install firebase-admin');
    process.exit(1);
  }
}

const readline = require('readline');

try {
  admin.initializeApp({ projectId: PROJECT_ID });
} catch (e) {
  console.error('Failed to initialize firebase-admin:', e.message);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON. See script header for details.');
  process.exit(1);
}
const db = admin.firestore();

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

async function countDocs(collRef) {
  // Use .count() aggregator if available (admin SDK >= 11.x), else fall back
  if (typeof collRef.count === 'function') {
    const snap = await collRef.count().get();
    return snap.data().count;
  }
  const snap = await collRef.get();
  return snap.size;
}

async function deleteSubcollections(quoteRef) {
  let total = 0;
  for (const sub of SUBCOLLECTIONS) {
    const subRef = quoteRef.collection(sub);
    let snap = await subRef.limit(BATCH_SIZE).get();
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
      if (snap.size < BATCH_SIZE) break;
      snap = await subRef.limit(BATCH_SIZE).get();
    }
  }
  return total;
}

async function deleteAllQuotes() {
  let quoteCount = 0;
  let subCount = 0;
  while (true) {
    const snap = await db.collection(COLLECTION).limit(BATCH_SIZE).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      subCount += await deleteSubcollections(doc.ref);
      await doc.ref.delete();
      quoteCount++;
      if (quoteCount % 10 === 0) {
        process.stdout.write(`\r  Deleted ${quoteCount} quotes (+ ${subCount} subcollection docs)…`);
      }
    }
  }
  process.stdout.write(`\r  Deleted ${quoteCount} quotes (+ ${subCount} subcollection docs)…\n`);
  return { quoteCount, subCount };
}

(async () => {
  console.log('');
  console.log('=== MFX OS — Wipe All Quotes ===');
  console.log(`Project:         ${PROJECT_ID}`);
  console.log(`Collection:      /${COLLECTION}`);
  console.log(`Subcollections:  ${SUBCOLLECTIONS.join(', ')}`);
  console.log('Untouched:       salesOrders, jobTickets, jobPassports, notifications, syncEvents, Drive folders');
  console.log('');

  console.log('Counting…');
  let count;
  try {
    count = await countDocs(db.collection(COLLECTION));
  } catch (err) {
    console.error('Count failed (likely credentials):', err.message);
    console.error('See script header for credentials setup.');
    process.exit(1);
  }
  console.log(`Found ${count} quote(s) in /${COLLECTION}.`);
  if (count === 0) {
    console.log('Nothing to delete. Exiting.');
    process.exit(0);
  }

  console.log('');
  console.log('⚠  IRREVERSIBLE. Quotes + their portalMessages + quoteComms will be deleted.');
  console.log('   Drive files referenced by quote docs are NOT removed (they live in Drive).');
  console.log('');

  const typed = (await ask(`To confirm, type the project ID exactly: `)).trim();
  if (typed !== PROJECT_ID) {
    console.log(`Cancelled — you typed "${typed}", expected "${PROJECT_ID}".`);
    process.exit(1);
  }

  const second = (await ask(`Type DELETE in caps to proceed: `)).trim();
  if (second !== 'DELETE') {
    console.log('Cancelled — second confirmation not typed.');
    process.exit(1);
  }

  console.log('');
  console.log('Deleting…');
  const started = Date.now();
  const result = await deleteAllQuotes();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log('');
  console.log(`✓ Done in ${elapsed}s.`);
  console.log(`  Quotes deleted:           ${result.quoteCount}`);
  console.log(`  Subcollection docs:       ${result.subCount}`);
  console.log('');
  console.log('Next steps:');
  console.log('  - Salesorders/JobTickets still reference deleted quote IDs. Wipe those');
  console.log('    separately if you want a complete reset.');
  console.log('  - Drive folders under Clients/* still hold old PDF/art uploads. Clean');
  console.log('    those manually in Google Drive if desired.');
  process.exit(0);
})().catch(err => {
  console.error('\nWipe failed:', err);
  process.exit(1);
});
