"use strict";

/**
 * recommendation.schema.js — Validates recommendation objects.
 */

const VALID_SEVERITIES = ["low", "medium", "high", "critical"];
const VALID_ACTION_TYPES = [
  "create_task",
  "send_notification",
  "send_email",
  "chat_alert",
  "create_passport",
  "assemble_packet",
  "transition_status",
  "reorder_material",
  "escalate",
  "info_only",
];

function validate(rec) {
  const errors = [];

  if (!rec || typeof rec !== "object") {
    return { valid: false, errors: ["Input must be a non-null object"] };
  }

  const required = ["title", "summary", "severity", "actionType"];
  const missing = required.filter((f) => !rec[f]);
  if (missing.length) {
    return { valid: false, errors: missing.map((f) => `Missing ${f}`) };
  }

  if (!VALID_SEVERITIES.includes(rec.severity)) {
    errors.push(`Invalid severity '${rec.severity}'. Must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }

  if (!VALID_ACTION_TYPES.includes(rec.actionType)) {
    errors.push(`Invalid actionType '${rec.actionType}'. Must be one of: ${VALID_ACTION_TYPES.join(", ")}`);
  }

  if (rec.title && typeof rec.title !== "string") {
    errors.push("title must be a string");
  }

  if (rec.summary && typeof rec.summary !== "string") {
    errors.push("summary must be a string");
  }

  if (rec.suggestedActions && !Array.isArray(rec.suggestedActions)) {
    errors.push("suggestedActions must be an array");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validate, VALID_SEVERITIES, VALID_ACTION_TYPES };
