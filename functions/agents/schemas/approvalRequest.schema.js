"use strict";

/**
 * approvalRequest.schema.js — Validates approval request objects.
 */

const VALID_STATUSES = ["pending", "approved", "rejected", "expired"];
const VALID_TOOL_NAMES = [
  "createPassportTool",
  "assembleJobPacketTool",
  "transitionStatusTool",
];

function validate(req) {
  const errors = [];

  if (!req || typeof req !== "object") {
    return { valid: false, errors: ["Input must be a non-null object"] };
  }

  const required = ["toolName", "requestedBy", "reason", "params"];
  const missing = required.filter((f) => !req[f]);
  if (missing.length) {
    return { valid: false, errors: missing.map((f) => `Missing ${f}`) };
  }

  if (!VALID_TOOL_NAMES.includes(req.toolName)) {
    errors.push(`Invalid toolName '${req.toolName}'. Must be one of: ${VALID_TOOL_NAMES.join(", ")}`);
  }

  if (typeof req.requestedBy !== "string") {
    errors.push("requestedBy must be a string");
  }

  if (typeof req.reason !== "string") {
    errors.push("reason must be a string");
  }

  if (typeof req.params !== "object" || req.params === null) {
    errors.push("params must be a non-null object");
  }

  if (req.status && !VALID_STATUSES.includes(req.status)) {
    errors.push(`Invalid status '${req.status}'. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  if (req.expiresAt && !(req.expiresAt instanceof Date) && typeof req.expiresAt !== "string") {
    errors.push("expiresAt must be a Date or ISO string");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validate, VALID_STATUSES, VALID_TOOL_NAMES };
