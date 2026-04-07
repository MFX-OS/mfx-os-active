"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * createPassportTool — Wraps the existing createPassport logic.
 * Requires approval before execution.
 */
async function execute({ jobTicketId, requestedBy, approvalId }) {
  if (!jobTicketId) {
    return { status: "error", error: "Missing required field: jobTicketId" };
  }
  if (!approvalId) {
    return { status: "error", error: "This tool requires approval. Missing approvalId." };
  }

  const db = getFirestore();

  try {
    // Verify approval exists and is granted
    const approvalDoc = await db.collection("agentApprovals").doc(approvalId).get();
    if (!approvalDoc.exists) {
      return { status: "error", error: `Approval ${approvalId} not found` };
    }
    const approval = approvalDoc.data();
    if (approval.status !== "approved") {
      return { status: "error", error: `Approval ${approvalId} is not approved (current: ${approval.status})` };
    }

    // Verify the job ticket exists
    const ticketDoc = await db.collection("jobTickets").doc(jobTicketId).get();
    if (!ticketDoc.exists) {
      return { status: "not_found", error: `Job ticket ${jobTicketId} not found` };
    }

    const ticket = ticketDoc.data();
    const now = FieldValue.serverTimestamp();

    // Create the passport document
    const passportData = {
      jobTicketId,
      jobNumber: ticket.jobNumber || null,
      customerName: ticket.customerName || null,
      description: ticket.description || "",
      status: "created",
      steps: ticket.steps || [],
      qualityChecks: [],
      createdBy: requestedBy || "agent",
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection("jobPassports").add(passportData);

    // Update the job ticket to reference the passport
    await db.collection("jobTickets").doc(jobTicketId).update({
      passportId: ref.id,
      updatedAt: now,
    });

    return { passportId: ref.id, jobTicketId, status: "created" };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
