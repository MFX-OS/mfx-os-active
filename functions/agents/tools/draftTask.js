"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * draftTask — Creates a task in the `tasks` collection.
 */
async function execute({ title, description, assignedTo, dueDate, priority, module, sourceRef }) {
  if (!title) {
    return { status: "error", error: "Missing required field: title" };
  }

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  const taskData = {
    title,
    description: description || "",
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    priority: priority || "medium",
    module: module || null,
    sourceRef: sourceRef || null,
    status: "open",
    createdBy: "agent",
    createdAt: now,
    updatedAt: now,
  };

  try {
    const ref = await db.collection("tasks").add(taskData);
    return { taskId: ref.id, status: "created" };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
