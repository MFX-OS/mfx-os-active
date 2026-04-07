"use strict";

const { getPrompt } = require("../prompts/quoteAgent.prompt");

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
  const quotes = context.quotes || [];
  const rfqs = context.rfqs || [];

  // 1. Aging quotes — sent > 7 days, no response
  for (const q of quotes) {
    if (q.status !== "sent" && q.status !== "open") continue;
    const sentDate = q.sentDate || q.createdAt;
    if (!sentDate) continue;
    const age = daysBetween(sentDate, now);
    if (age < 7) continue;

    const isHighValue = (q.totalValue || q.total || 0) >= 25000;
    let severity = "medium";
    if (age > 14) severity = "high";
    if (isHighValue && age > 7) severity = severity === "high" ? "critical" : "high";

    recommendations.push(makeRec(
      `Quote ${q.quoteNumber || q.id} aging ${age} days without response`,
      `Quote for ${q.customerName || "unknown customer"} was sent ${age} days ago and has received no response. ${isHighValue ? "This is a high-value quote ($" + (q.totalValue || q.total) + ")." : ""}`,
      severity,
      [
        `Send follow-up email to ${q.contactEmail || q.customerName || "customer"}`,
        age > 14 ? "Schedule phone call with customer" : "Check if customer received the quote",
        isHighValue ? "Notify sales manager of at-risk high-value quote" : null,
      ].filter(Boolean),
      [q.quoteNumber || q.id].filter(Boolean),
      "Sales Rep",
      "Sales",
      "follow-up"
    ));
  }

  // 2. Stalled pending approvals — > 2 days
  for (const q of quotes) {
    if (q.status !== "pending_approval" && q.status !== "pendingApproval") continue;
    const approvalDate = q.approvalRequestedDate || q.updatedAt || q.createdAt;
    if (!approvalDate) continue;
    const stalledDays = daysBetween(approvalDate, now);
    if (stalledDays < 2) continue;

    let severity = "medium";
    if (stalledDays > 5) severity = "high";
    const isHighValue = (q.totalValue || q.total || 0) >= 25000;
    if (isHighValue && stalledDays > 3) severity = "critical";

    recommendations.push(makeRec(
      `Approval stalled ${stalledDays} days for quote ${q.quoteNumber || q.id}`,
      `Quote for ${q.customerName || "unknown customer"} has been pending approval for ${stalledDays} days. Approver: ${q.approver || "unassigned"}.`,
      severity,
      [
        `Notify approver ${q.approver || "(unassigned)"} of pending quote`,
        stalledDays > 5 ? "Escalate to sales manager" : "Send reminder to approver",
      ],
      [q.quoteNumber || q.id].filter(Boolean),
      "Sales Manager",
      "Sales",
      "approval"
    ));
  }

  // 3. Incomplete RFQs — missing required fields
  const requiredRfqFields = ["customerName", "quantity", "substrate", "dimensions", "targetPrice"];
  for (const rfq of rfqs) {
    if (rfq.status === "closed" || rfq.status === "cancelled") continue;
    const missing = requiredRfqFields.filter((f) => !rfq[f] && rfq[f] !== 0);
    if (missing.length === 0) continue;

    recommendations.push(makeRec(
      `RFQ ${rfq.rfqNumber || rfq.id} missing ${missing.length} required field(s)`,
      `RFQ from ${rfq.customerName || "unknown customer"} is missing: ${missing.join(", ")}. Cannot produce an accurate quote without these fields.`,
      missing.length >= 3 ? "high" : "medium",
      [
        `Contact customer to obtain: ${missing.join(", ")}`,
        "Update RFQ record once information is received",
      ],
      [rfq.rfqNumber || rfq.id].filter(Boolean),
      "Sales Rep",
      "Sales",
      "follow-up"
    ));
  }

  // 4. Quotes nearing expiration
  for (const q of quotes) {
    if (!q.expirationDate) continue;
    if (q.status === "accepted" || q.status === "closed" || q.status === "cancelled") continue;
    const daysToExpiry = daysBetween(now, q.expirationDate);
    if (daysToExpiry > 7) continue;
    if (daysToExpiry < 0) {
      recommendations.push(makeRec(
        `Quote ${q.quoteNumber || q.id} has expired`,
        `Quote for ${q.customerName || "unknown customer"} expired ${Math.abs(daysToExpiry)} day(s) ago. Decide whether to extend or close.`,
        "high",
        ["Contact customer to check interest", "Extend expiration if customer is still engaged", "Close quote if no longer viable"],
        [q.quoteNumber || q.id].filter(Boolean),
        "Sales Rep",
        "Sales",
        "follow-up"
      ));
    } else {
      const isHighValue = (q.totalValue || q.total || 0) >= 25000;
      recommendations.push(makeRec(
        `Quote ${q.quoteNumber || q.id} expires in ${daysToExpiry} day(s)`,
        `Quote for ${q.customerName || "unknown customer"} expires soon. ${isHighValue ? "High-value quote — prioritize." : ""}`,
        daysToExpiry <= 2 ? (isHighValue ? "critical" : "high") : "medium",
        ["Send expiration reminder to customer", "Confirm pricing is still valid"],
        [q.quoteNumber || q.id].filter(Boolean),
        "Sales Rep",
        "Sales",
        "follow-up"
      ));
    }
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
    // LLM unavailable or failed — that is fine, rules still ran
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dedup helper
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
 * Analyze quote context and return recommendations.
 * @param {object} context - data payload (quotes, rfqs, customers, now)
 * @param {string} triggerType - e.g. "scheduled", "manual", "event"
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
