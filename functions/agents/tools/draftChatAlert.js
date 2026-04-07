"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * draftChatAlert — Posts a message to a chat channel (flex-alerts, sqf-alerts, etc.)
 * in the `chat_messages` collection.
 */
async function execute({ channel, message, severity, sourceAgent, metadata }) {
  if (!channel) {
    return { status: "error", error: "Missing required field: channel" };
  }
  if (!message) {
    return { status: "error", error: "Missing required field: message" };
  }

  const validChannels = [
    "flex-alerts",
    "sqf-alerts",
    "production-alerts",
    "quality-alerts",
    "general-alerts",
  ];

  if (!validChannels.includes(channel)) {
    return {
      status: "error",
      error: `Invalid channel: ${channel}. Valid channels: ${validChannels.join(", ")}`,
    };
  }

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  const chatMessage = {
    channel,
    message,
    severity: severity || "info",
    sourceAgent: sourceAgent || "unknown",
    metadata: metadata || {},
    type: "agent_alert",
    createdAt: now,
  };

  try {
    const ref = await db.collection("chat_messages").add(chatMessage);
    return { messageId: ref.id, status: "created", channel };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
