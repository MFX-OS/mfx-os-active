"use strict";

const { getFirestore } = require("firebase-admin/firestore");

/**
 * getQuote — Reads a quote by ID from the `quotes` collection.
 */
async function execute({ quoteId }) {
  if (!quoteId) {
    return { status: "error", error: "Missing required field: quoteId" };
  }

  const db = getFirestore();

  try {
    const doc = await db.collection("quotes").doc(quoteId).get();
    if (!doc.exists) {
      return { status: "not_found", error: `Quote ${quoteId} not found` };
    }
    return { status: "ok", quoteId: doc.id, data: doc.data() };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
