// ═══════════════════════════════════════════════════════════════════
// firebase admin singleton — init-once + shared db/FieldValue exports.
// All lib/ and endpoint modules should `require('./lib/firebase')` to
// get the Firestore client instead of calling getFirestore() themselves.
// ═══════════════════════════════════════════════════════════════════
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

module.exports = { db, FieldValue, getAuth };
