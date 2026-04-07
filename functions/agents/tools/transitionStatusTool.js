"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * transitionStatusTool — Wraps the existing transitionStatus logic.
 * Requires approval. This is the most sensitive tool.
 */

// Define valid status transitions per collection
const VALID_TRANSITIONS = {
  jobTickets: {
    draft: ["submitted"],
    submitted: ["in_review", "rejected"],
    in_review: ["approved", "rejected"],
    approved: ["in_progress"],
    in_progress: ["on_hold", "completed"],
    on_hold: ["in_progress", "cancelled"],
    completed: ["archived"],
    rejected: ["draft"],
  },
  jobPassports: {
    created: ["in_progress"],
    in_progress: ["quality_check", "on_hold"],
    quality_check: ["passed", "failed"],
    passed: ["completed"],
    failed: ["in_progress"],
    on_hold: ["in_progress", "cancelled"],
    completed: ["archived"],
  },
  quotes: {
    draft: ["submitted"],
    submitted: ["under_review"],
    under_review: ["approved", "rejected", "revision_needed"],
    revision_needed: ["submitted"],
    approved: ["accepted", "expired"],
    rejected: ["draft"],
    accepted: ["invoiced"],
  },
};

async function execute({ collection, documentId, newStatus, reason, requestedBy, approvalId }) {
  if (!collection) {
    return { status: "error", error: "Missing required field: collection" };
  }
  if (!documentId) {
    return { status: "error", error: "Missing required field: documentId" };
  }
  if (!newStatus) {
    return { status: "error", error: "Missing required field: newStatus" };
  }
  if (!approvalId) {
    return { status: "error", error: "This tool requires approval. Missing approvalId." };
  }

  const transitions = VALID_TRANSITIONS[collection];
  if (!transitions) {
    return {
      status: "error",
      error: `Unsupported collection: ${collection}. Supported: ${Object.keys(VALID_TRANSITIONS).join(", ")}`,
    };
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

    // Fetch the document
    const docRef = db.collection(collection).doc(documentId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return { status: "not_found", error: `Document ${documentId} not found in ${collection}` };
    }

    const currentStatus = doc.data().status;
    if (!currentStatus) {
      return { status: "error", error: "Document has no status field" };
    }

    // Validate the transition
    const allowedNext = transitions[currentStatus];
    if (!allowedNext) {
      return {
        status: "error",
        error: `No transitions defined from status '${currentStatus}' in ${collection}`,
      };
    }
    if (!allowedNext.includes(newStatus)) {
      return {
        status: "error",
        error: `Invalid transition: '${currentStatus}' -> '${newStatus}'. Allowed: ${allowedNext.join(", ")}`,
      };
    }

    const now = FieldValue.serverTimestamp();

    // Perform the transition
    await docRef.update({
      status: newStatus,
      updatedAt: now,
    });

    // Record the transition in a status history subcollection
    await docRef.collection("statusHistory").add({
      from: currentStatus,
      to: newStatus,
      reason: reason || null,
      changedBy: requestedBy || "agent",
      approvalId,
      timestamp: now,
    });

    return {
      status: "transitioned",
      collection,
      documentId,
      from: currentStatus,
      to: newStatus,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
