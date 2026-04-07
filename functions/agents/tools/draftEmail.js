"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * draftEmail — Creates a draft email record in `agentDrafts` collection for
 * human review. NOT sent automatically.
 */
async function execute({ to, subject, body, cc, replyTo, sourceAgent, context }) {
  if (!to) {
    return { status: "error", error: "Missing required field: to" };
  }
  if (!subject) {
    return { status: "error", error: "Missing required field: subject" };
  }
  if (!body) {
    return { status: "error", error: "Missing required field: body" };
  }

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  const draftData = {
    type: "email",
    to: Array.isArray(to) ? to : [to],
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
    subject,
    body,
    replyTo: replyTo || null,
    sourceAgent: sourceAgent || "unknown",
    context: context || {},
    status: "pending_review",
    reviewedBy: null,
    reviewedAt: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const ref = await db.collection("agentDrafts").add(draftData);
    return { draftId: ref.id, status: "pending_review" };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
