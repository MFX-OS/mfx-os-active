"use strict";

const { getPrompt } = require("../prompts/sqfAgent.prompt");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(dateA, dateB) {
  const msPerDay = 86400000;
  return Math.floor((new Date(dateB) - new Date(dateA)) / msPerDay);
}

function makeRec(title, summary, severity, actions, sourceRefs, ownerRole, ownerDept, actionType) {
  return { title, summary, severity, actions, sourceRefs, ownerRole, ownerDept, actionType };
}

// ---------------------------------------------------------------------------
// Rule-based analysis
// ---------------------------------------------------------------------------

function runRules(context) {
  const now = new Date(context.now || Date.now());
  const recommendations = [];
  const trainingRecords = context.trainingRecords || [];
  const ncrs = context.ncrs || [];
  const auditActions = context.auditActions || [];
  const inspections = context.inspections || [];

  // 1. Training records expiring within 30 days
  for (const tr of trainingRecords) {
    if (!tr.expirationDate) continue;
    if (tr.status === "renewed" || tr.status === "inactive") continue;
    const daysToExpiry = daysBetween(now, tr.expirationDate);
    if (daysToExpiry > 30) continue;

    const isFoodContact = (tr.role || tr.department || "").toLowerCase().match(
      /production|quality|sanitation|warehouse|food.?contact/
    );

    let severity = "medium";
    if (daysToExpiry < 0) severity = isFoodContact ? "critical" : "high";
    else if (daysToExpiry <= 7) severity = isFoodContact ? "high" : "medium";

    const expired = daysToExpiry < 0;

    recommendations.push(makeRec(
      `Training ${expired ? "expired" : "expiring"} for ${tr.employeeName || tr.employeeId || "employee"}: ${tr.trainingName || tr.courseId || "unknown course"}`,
      `${tr.employeeName || "Employee"}'s training "${tr.trainingName || tr.courseId}" ${expired ? "expired " + Math.abs(daysToExpiry) + " day(s) ago" : "expires in " + daysToExpiry + " day(s)"}. ${isFoodContact ? "This employee is in a food-contact role — SQF compliance requires current training." : ""}`,
      severity,
      [
        expired ? "Immediately schedule retraining session" : "Schedule training renewal before expiration",
        isFoodContact && expired ? "Temporarily reassign employee from food-contact duties until retrained" : null,
        "Update training matrix after completion",
      ].filter(Boolean),
      [tr.recordId || tr.id, tr.employeeId].filter(Boolean),
      "QA Manager",
      "Quality",
      "review"
    ));
  }

  // 2. Open NCRs aging > 14 days
  for (const ncr of ncrs) {
    const status = (ncr.status || "").toLowerCase();
    if (status === "closed" || status === "cancelled" || status === "resolved") continue;
    const openedDate = ncr.openedDate || ncr.createdAt;
    if (!openedDate) continue;
    const ageDays = daysBetween(openedDate, now);
    if (ageDays < 14) continue;

    let severity = "medium";
    if (ageDays > 30) severity = "critical";
    else if (ageDays > 21) severity = "high";

    const hasCapa = ncr.capaId || ncr.capaLinked;

    recommendations.push(makeRec(
      `NCR ${ncr.ncrNumber || ncr.id} open for ${ageDays} days`,
      `Non-conformance "${ncr.title || ncr.description || ncr.ncrNumber}" has been open for ${ageDays} days. ${hasCapa ? "CAPA " + (ncr.capaId || "") + " is linked." : "No CAPA linked — root cause analysis may be needed."} Category: ${ncr.category || "unspecified"}.`,
      severity,
      [
        !hasCapa ? "Initiate CAPA investigation for this NCR" : "Review linked CAPA progress",
        ageDays > 21 ? "Escalate to quality director for management review" : "Follow up with assigned investigator",
        "Verify containment actions are in place",
      ],
      [ncr.ncrNumber || ncr.id, ncr.capaId].filter(Boolean),
      "QA Manager",
      "Quality",
      "review"
    ));
  }

  // 3. Overdue audit actions
  for (const action of auditActions) {
    const status = (action.status || "").toLowerCase();
    if (status === "complete" || status === "closed" || status === "verified") continue;
    if (!action.dueDate) continue;
    const overdueDays = daysBetween(action.dueDate, now);
    if (overdueDays <= 0) continue;

    let severity = "medium";
    if (overdueDays > 30) severity = "critical";
    else if (overdueDays > 14) severity = "high";

    recommendations.push(makeRec(
      `Audit action "${action.title || action.id}" overdue by ${overdueDays} day(s)`,
      `Audit action from ${action.auditType || "audit"} (${action.auditDate || "unknown date"}) is ${overdueDays} day(s) past due. Assigned to: ${action.assignee || "unassigned"}. Finding: ${action.finding || "not specified"}.`,
      severity,
      [
        `Contact ${action.assignee || "assignee"} for status update`,
        overdueDays > 14 ? "Escalate to plant manager" : "Set new target completion date",
        "Document reason for delay in audit tracking system",
      ],
      [action.actionId || action.id, action.auditId].filter(Boolean),
      "QA Manager",
      "Quality",
      "escalation"
    ));
  }

  // 4. Repeated GMP inspection failures — same area, multiple fails
  const failsByArea = {};
  for (const insp of inspections) {
    if ((insp.result || "").toLowerCase() !== "fail") continue;
    const area = insp.area || insp.zone || insp.location || "Unknown Area";
    if (!failsByArea[area]) failsByArea[area] = [];
    failsByArea[area].push(insp);
  }

  for (const [area, fails] of Object.entries(failsByArea)) {
    if (fails.length < 2) continue;

    // Sort by date to get the range
    const dates = fails
      .map((f) => f.inspectionDate || f.date || f.createdAt)
      .filter(Boolean)
      .sort();

    let severity = "high";
    if (fails.length >= 4) severity = "critical";

    const failTypes = [...new Set(fails.map((f) => f.failureType || f.category || "unspecified"))];

    recommendations.push(makeRec(
      `Repeated GMP failures in ${area} (${fails.length} occurrences)`,
      `Area "${area}" has recorded ${fails.length} GMP inspection failures${dates.length >= 2 ? " between " + dates[0] + " and " + dates[dates.length - 1] : ""}. Failure types: ${failTypes.join(", ")}. This pattern suggests a systemic issue requiring root cause analysis.`,
      severity,
      [
        "Initiate root cause analysis for recurring failures in this area",
        "Review sanitation and maintenance procedures for " + area,
        "Schedule targeted re-inspection within 48 hours",
        fails.length >= 4 ? "Escalate to SQF practitioner for CAPA" : "Add to next management review agenda",
      ],
      fails.map((f) => f.inspectionId || f.id).filter(Boolean),
      "SQF Practitioner",
      "Quality",
      "review"
    ));
  }

  // 5. CAPA items approaching or past due (check NCRs that have CAPA links)
  for (const ncr of ncrs) {
    if (!ncr.capaDueDate) continue;
    const status = (ncr.capaStatus || "").toLowerCase();
    if (status === "closed" || status === "verified") continue;
    const daysUntilDue = daysBetween(now, ncr.capaDueDate);
    if (daysUntilDue > 7) continue;

    const overdue = daysUntilDue < 0;
    let severity = "medium";
    if (overdue && Math.abs(daysUntilDue) > 14) severity = "critical";
    else if (overdue) severity = "high";

    recommendations.push(makeRec(
      `CAPA ${ncr.capaId || ""} ${overdue ? "overdue by " + Math.abs(daysUntilDue) + " day(s)" : "due in " + daysUntilDue + " day(s)"}`,
      `CAPA linked to NCR ${ncr.ncrNumber || ncr.id} is ${overdue ? "overdue" : "approaching its due date"}. ${overdue ? "Immediate attention required." : "Ensure corrective actions are on track."}`,
      severity,
      [
        overdue ? "Escalate CAPA to quality director" : "Verify all corrective actions are in progress",
        "Schedule effectiveness review",
      ],
      [ncr.capaId, ncr.ncrNumber || ncr.id].filter(Boolean),
      "QA Manager",
      "Quality",
      "review"
    ));
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// LLM-enhanced analysis
// ---------------------------------------------------------------------------

async function runLLM(context) {
  try {
    const llmClient = require("../providers/llmClient");
    const { systemPrompt, userPrompt } = getPrompt(context);
    const response = await llmClient.chat({ systemPrompt, userPrompt });
    const parsed = typeof response === "string" ? JSON.parse(response) : response;
    return parsed.recommendations || [];
  } catch (_err) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

function dedup(rulesRecs, llmRecs) {
  const seen = new Set(rulesRecs.map((r) => r.title));
  const merged = [...rulesRecs];
  for (const rec of llmRecs) {
    if (!seen.has(rec.title)) {
      seen.add(rec.title);
      merged.push(rec);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze SQF / compliance context and return recommendations.
 * @param {object} context - { trainingRecords, ncrs, auditActions, inspections, now }
 * @param {string} triggerType
 * @param {object} opts - { useLLM: boolean }
 * @returns {Promise<{ recommendations: Array }>}
 */
async function analyze(context, triggerType, opts = {}) {
  const ruleRecs = runRules(context);

  let llmRecs = [];
  if (opts.useLLM !== false) {
    llmRecs = await runLLM(context);
  }

  const recommendations = dedup(ruleRecs, llmRecs);
  return { recommendations };
}

module.exports = { analyze };
