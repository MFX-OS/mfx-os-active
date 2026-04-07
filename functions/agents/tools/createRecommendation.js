"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * createRecommendation — Creates a recommendation directly in
 * `agentRecommendations` (used by orchestrator).
 */
async function execute({ title, summary, severity, actionType, sourceAgent, targetModule, targetDocId, suggestedActions, metadata }) {
  if (!title) {
    return { status: "error", error: "Missing required field: title" };
  }
  if (!summary) {
    return { status: "error", error: "Missing required field: summary" };
  }
  if (!severity) {
    return { status: "error", error: "Missing required field: severity" };
  }
  if (!actionType) {
    return { status: "error", error: "Missing required field: actionType" };
  }

  const validSeverities = ["low", "medium", "high", "critical"];
  if (!validSeverities.includes(severity)) {
    return { status: "error", error: `Invalid severity: ${severity}. Must be one of: ${validSeverities.join(", ")}` };
  }

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  const recData = {
    title,
    summary,
    severity,
    actionType,
    sourceAgent: sourceAgent || "orchestrator",
    targetModule: targetModule || null,
    targetDocId: targetDocId || null,
    suggestedActions: suggestedActions || [],
    metadata: metadata || {},
    status: "open",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const ref = await db.collection("agentRecommendations").add(recData);
    return { recommendationId: ref.id, status: "created" };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
