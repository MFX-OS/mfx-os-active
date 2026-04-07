"use strict";

/**
 * riskAlert.schema.js — Validates risk alert objects.
 */

const VALID_SEVERITIES = ["low", "medium", "high", "critical"];
const VALID_RISK_CATEGORIES = [
  "quality",
  "safety",
  "compliance",
  "deadline",
  "material_shortage",
  "training_gap",
  "equipment",
  "financial",
  "other",
];

function validate(alert) {
  const errors = [];

  if (!alert || typeof alert !== "object") {
    return { valid: false, errors: ["Input must be a non-null object"] };
  }

  const required = ["title", "description", "severity", "category", "sourceAgent"];
  const missing = required.filter((f) => !alert[f]);
  if (missing.length) {
    return { valid: false, errors: missing.map((f) => `Missing ${f}`) };
  }

  if (typeof alert.title !== "string") {
    errors.push("title must be a string");
  }

  if (typeof alert.description !== "string") {
    errors.push("description must be a string");
  }

  if (!VALID_SEVERITIES.includes(alert.severity)) {
    errors.push(`Invalid severity '${alert.severity}'. Must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }

  if (!VALID_RISK_CATEGORIES.includes(alert.category)) {
    errors.push(`Invalid category '${alert.category}'. Must be one of: ${VALID_RISK_CATEGORIES.join(", ")}`);
  }

  if (typeof alert.sourceAgent !== "string") {
    errors.push("sourceAgent must be a string");
  }

  if (alert.affectedDocuments && !Array.isArray(alert.affectedDocuments)) {
    errors.push("affectedDocuments must be an array");
  }

  if (alert.mitigationSteps && !Array.isArray(alert.mitigationSteps)) {
    errors.push("mitigationSteps must be an array");
  }

  if (alert.likelihood !== undefined) {
    if (typeof alert.likelihood !== "number" || alert.likelihood < 0 || alert.likelihood > 1) {
      errors.push("likelihood must be a number between 0 and 1");
    }
  }

  if (alert.impact !== undefined) {
    if (typeof alert.impact !== "number" || alert.impact < 1 || alert.impact > 5) {
      errors.push("impact must be a number between 1 and 5");
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validate, VALID_SEVERITIES, VALID_RISK_CATEGORIES };
