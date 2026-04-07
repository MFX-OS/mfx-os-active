"use strict";

// jobAgent does not have its own LLM prompt file — it is rule-based only,
// but follows the same analyze() signature for consistency.

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
  const jobs = context.jobs || [];

  // Required fields for a job ticket to be considered complete
  const requiredFields = [
    "customerName",
    "jobNumber",
    "substrate",
    "quantity",
    "dueDate",
    "printSpec",
    "artworkApproved",
    "proofApproved",
  ];

  for (const job of jobs) {
    const status = (job.status || "").toLowerCase();
    if (status === "complete" || status === "shipped" || status === "cancelled" || status === "invoiced") continue;

    // 1. Missing required fields
    const missing = requiredFields.filter((f) => {
      const val = job[f];
      return val === undefined || val === null || val === "";
    });

    if (missing.length > 0) {
      const blocksProduction = missing.some((f) =>
        ["substrate", "quantity", "printSpec", "artworkApproved", "proofApproved"].includes(f)
      );

      recommendations.push(makeRec(
        `Job ${job.jobNumber || job.id} missing ${missing.length} required field(s)`,
        `Job ticket for ${job.customerName || "unknown customer"} is missing: ${missing.join(", ")}. ${blocksProduction ? "Production cannot start without these fields." : "Administrative fields need to be completed."}`,
        blocksProduction ? "high" : "medium",
        [
          `Complete missing fields: ${missing.join(", ")}`,
          blocksProduction ? "Do not release job to production until all fields are complete" : null,
          missing.includes("artworkApproved") ? "Request artwork approval from customer" : null,
          missing.includes("proofApproved") ? "Send proof to customer for approval" : null,
        ].filter(Boolean),
        [job.jobNumber || job.id].filter(Boolean),
        "CSR",
        "Sales",
        "notification"
      ));
    }

    // 2. Stalled stages — no status change > 3 days
    const lastUpdate = job.lastStatusChange || job.updatedAt;
    if (lastUpdate && status !== "complete") {
      const stalledDays = daysBetween(lastUpdate, now);
      if (stalledDays >= 3) {
        let severity = "medium";
        if (stalledDays > 7) severity = "high";
        if (stalledDays > 14) severity = "critical";

        // Check if job is due soon
        if (job.dueDate) {
          const daysToDue = daysBetween(now, job.dueDate);
          if (daysToDue <= 3 && stalledDays >= 3) severity = "critical";
          else if (daysToDue <= 7 && stalledDays >= 5) severity = "high";
        }

        recommendations.push(makeRec(
          `Job ${job.jobNumber || job.id} stalled in "${job.currentStage || status}" for ${stalledDays} day(s)`,
          `Job for ${job.customerName || "unknown customer"} has been in stage "${job.currentStage || status}" for ${stalledDays} days without progress. ${job.assignee ? "Assigned to: " + job.assignee + "." : "No assignee recorded."}`,
          severity,
          [
            job.assignee ? `Contact ${job.assignee} for status update` : "Assign an owner to this job stage",
            stalledDays > 7 ? "Escalate to production manager" : "Identify and resolve blocking issue",
            job.dueDate ? `Job due date: ${job.dueDate} — verify schedule impact` : null,
          ].filter(Boolean),
          [job.jobNumber || job.id].filter(Boolean),
          job.assignee ? "Production Supervisor" : "Production Manager",
          "Production",
          stalledDays > 7 ? "escalation" : "notification"
        ));
      }
    }

    // 3. Incomplete packets — missing approvals or artwork
    const packetIssues = [];
    if (job.artworkApproved === false || job.artworkApproved === "pending") {
      packetIssues.push("artwork not approved");
    }
    if (job.proofApproved === false || job.proofApproved === "pending") {
      packetIssues.push("proof not approved");
    }
    if (job.plateReady === false || job.plateReady === "pending") {
      packetIssues.push("plates not ready");
    }
    if (job.specSheet === false || job.specSheet === "missing" || job.specSheet === "") {
      packetIssues.push("spec sheet missing");
    }
    if (job.qualityPlanApproved === false || job.qualityPlanApproved === "pending") {
      packetIssues.push("quality plan not approved");
    }

    // Only flag if the job is approaching production stages
    const productionStatuses = ["prepress", "pre-press", "scheduling", "scheduled", "ready", "press", "printing"];
    const nearProduction = productionStatuses.some((s) => status.includes(s) || (job.currentStage || "").toLowerCase().includes(s));

    if (packetIssues.length > 0 && (nearProduction || (job.dueDate && daysBetween(now, job.dueDate) <= 14))) {
      recommendations.push(makeRec(
        `Job ${job.jobNumber || job.id} has incomplete packet (${packetIssues.length} issue(s))`,
        `Job for ${job.customerName || "unknown customer"} is ${nearProduction ? "approaching production" : "due within 14 days"} but the job packet is incomplete: ${packetIssues.join(", ")}.`,
        packetIssues.length >= 3 ? "high" : "medium",
        [
          ...packetIssues.map((issue) => `Resolve: ${issue}`),
          "Notify CSR and prepress coordinator",
          nearProduction ? "Hold production release until packet is complete" : null,
        ].filter(Boolean),
        [job.jobNumber || job.id].filter(Boolean),
        "CSR",
        "Sales",
        "notification"
      ));
    }

    // 4. Jobs past due date
    if (job.dueDate) {
      const daysPastDue = daysBetween(job.dueDate, now);
      if (daysPastDue > 0) {
        recommendations.push(makeRec(
          `Job ${job.jobNumber || job.id} is ${daysPastDue} day(s) past due`,
          `Job for ${job.customerName || "unknown customer"} was due ${job.dueDate} and is now ${daysPastDue} day(s) late. Current stage: ${job.currentStage || status}.`,
          daysPastDue > 7 ? "critical" : daysPastDue > 3 ? "high" : "medium",
          [
            "Notify customer of revised delivery timeline",
            "Identify cause of delay and document",
            "Prioritize job in production schedule",
            daysPastDue > 7 ? "Escalate to plant manager" : null,
          ].filter(Boolean),
          [job.jobNumber || job.id].filter(Boolean),
          "Production Manager",
          "Production",
          "escalation"
        ));
      }
    }
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze job readiness context and return recommendations.
 * @param {object} context - { jobs, now }
 * @param {string} triggerType
 * @param {object} opts - { useLLM: boolean }
 * @returns {Promise<{ recommendations: Array }>}
 */
async function analyze(context, triggerType, opts = {}) {
  const ruleRecs = runRules(context);

  // Job agent is rule-based only for now — LLM enhancement can be added later
  // when a jobAgent.prompt.js is created.

  return { recommendations: ruleRecs };
}

module.exports = { analyze };
