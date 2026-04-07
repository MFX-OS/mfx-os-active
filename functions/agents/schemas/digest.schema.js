"use strict";

/**
 * digest.schema.js — Validates digest/summary objects.
 */

const VALID_PERIODS = ["daily", "weekly", "monthly", "custom"];
const VALID_DIGEST_TYPES = ["operations", "quality", "safety", "executive", "combined"];

function validate(digest) {
  const errors = [];

  if (!digest || typeof digest !== "object") {
    return { valid: false, errors: ["Input must be a non-null object"] };
  }

  const required = ["title", "period", "generatedBy", "sections"];
  const missing = required.filter((f) => !digest[f]);
  if (missing.length) {
    return { valid: false, errors: missing.map((f) => `Missing ${f}`) };
  }

  if (typeof digest.title !== "string") {
    errors.push("title must be a string");
  }

  if (!VALID_PERIODS.includes(digest.period)) {
    errors.push(`Invalid period '${digest.period}'. Must be one of: ${VALID_PERIODS.join(", ")}`);
  }

  if (digest.digestType && !VALID_DIGEST_TYPES.includes(digest.digestType)) {
    errors.push(`Invalid digestType '${digest.digestType}'. Must be one of: ${VALID_DIGEST_TYPES.join(", ")}`);
  }

  if (typeof digest.generatedBy !== "string") {
    errors.push("generatedBy must be a string");
  }

  if (!Array.isArray(digest.sections)) {
    errors.push("sections must be an array");
  } else {
    digest.sections.forEach((section, i) => {
      if (!section.heading) {
        errors.push(`sections[${i}] missing heading`);
      }
      if (!section.content && !section.items) {
        errors.push(`sections[${i}] must have content or items`);
      }
    });
  }

  if (digest.startDate && typeof digest.startDate !== "string") {
    errors.push("startDate must be an ISO date string");
  }

  if (digest.endDate && typeof digest.endDate !== "string") {
    errors.push("endDate must be an ISO date string");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validate, VALID_PERIODS, VALID_DIGEST_TYPES };
