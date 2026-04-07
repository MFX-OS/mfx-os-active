"use strict";

const { getFirestore } = require("firebase-admin/firestore");

/**
 * getJobTicket — Reads a job ticket by ID from `jobTickets`.
 */
async function execute({ jobTicketId }) {
  if (!jobTicketId) {
    return { status: "error", error: "Missing required field: jobTicketId" };
  }

  const db = getFirestore();

  try {
    const doc = await db.collection("jobTickets").doc(jobTicketId).get();
    if (!doc.exists) {
      return { status: "not_found", error: `Job ticket ${jobTicketId} not found` };
    }
    return { status: "ok", jobTicketId: doc.id, data: doc.data() };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
