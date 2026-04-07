"use strict";

const { getFirestore } = require("firebase-admin/firestore");

/**
 * getPassport — Reads a job passport by ID from `jobPassports`.
 */
async function execute({ passportId }) {
  if (!passportId) {
    return { status: "error", error: "Missing required field: passportId" };
  }

  const db = getFirestore();

  try {
    const doc = await db.collection("jobPassports").doc(passportId).get();
    if (!doc.exists) {
      return { status: "not_found", error: `Job passport ${passportId} not found` };
    }
    return { status: "ok", passportId: doc.id, data: doc.data() };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
