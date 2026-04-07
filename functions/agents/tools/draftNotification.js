"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * draftNotification — Creates a notification in the `notifications` collection
 * with type 'ai_recommendation'.
 */
async function execute({ userId, title, body, severity, actionUrl, metadata }) {
  if (!userId) {
    return { status: "error", error: "Missing required field: userId" };
  }
  if (!title) {
    return { status: "error", error: "Missing required field: title" };
  }

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  const notificationData = {
    userId,
    title,
    body: body || "",
    type: "ai_recommendation",
    severity: severity || "info",
    actionUrl: actionUrl || null,
    metadata: metadata || {},
    read: false,
    createdAt: now,
  };

  try {
    const ref = await db.collection("notifications").add(notificationData);
    return { notificationId: ref.id, status: "created" };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
