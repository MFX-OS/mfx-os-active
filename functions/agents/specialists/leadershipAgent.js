"use strict";

const { getPrompt } = require("../prompts/leadershipAgent.prompt");

// ---------------------------------------------------------------------------
// Severity ranking for sorting
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function sevRank(s) {
  return SEVERITY_RANK[(s || "").toLowerCase()] || 0;
}

function makeRec(title, summary, severity, actions, sourceRefs, ownerRole, ownerDept, actionType) {
  return { title, summary, severity, actions, sourceRefs, ownerRole, ownerDept, actionType };
}

// ---------------------------------------------------------------------------
// Rule-based aggregation
// ---------------------------------------------------------------------------

function runRules(context) {
  const agentResults = context.agentResults || {};
  const recommendations = [];

  // Collect all recommendations from all agents
  const allRecs = [];
  const agentNames = Object.keys(agentResults);

  for (const agentName of agentNames) {
    const result = agentResults[agentName];
    const recs = result.recommendations || result || [];
    for (const rec of Array.isArray(recs) ? recs : []) {
      allRecs.push({ ...rec, _agentSource: agentName });
    }
  }

  if (allRecs.length === 0) {
    return {
      recommendations: [],
      digest: "No specialist agents reported findings. Operations appear nominal.",
      topItems: [],
      byDepartment: {},
    };
  }

  // Sort by severity descending
  allRecs.sort((a, b) => sevRank(b.severity) - sevRank(a.severity));

  // Group by department
  const byDepartment = {};
  for (const rec of allRecs) {
    const dept = rec.ownerDept || "Unassigned";
    if (!byDepartment[dept]) {
      byDepartment[dept] = { count: 0, topSeverity: "low", items: [] };
    }
    byDepartment[dept].count += 1;
    byDepartment[dept].items.push(rec);
    if (sevRank(rec.severity) > sevRank(byDepartment[dept].topSeverity)) {
      byDepartment[dept].topSeverity = rec.severity;
    }
  }

  // Strip items from byDepartment for the output (keep it lean)
  const byDepartmentSummary = {};
  for (const [dept, data] of Object.entries(byDepartment)) {
    byDepartmentSummary[dept] = { count: data.count, topSeverity: data.topSeverity };
  }

  // Top 5 items
  const topItems = allRecs.slice(0, 5).map((r) => ({
    title: r.title,
    severity: r.severity,
    ownerDept: r.ownerDept || "Unassigned",
    agentSource: r._agentSource,
  }));

  // Identify cross-functional bottlenecks
  // Look for approvals / escalations that appear in multiple agents
  const approvalRecs = allRecs.filter(
    (r) => r.actionType === "approval" || r.actionType === "escalation"
  );
  if (approvalRecs.length >= 3) {
    recommendations.push(makeRec(
      `${approvalRecs.length} stuck approvals / escalations across departments`,
      `There are ${approvalRecs.length} items requiring approval or escalation across ${new Set(approvalRecs.map((r) => r.ownerDept)).size} department(s). These may be creating downstream bottlenecks.`,
      "high",
      [
        "Review stuck approvals in daily leadership standup",
        "Assign clear owners and deadlines for each escalation",
        "Consider temporary delegation for absent approvers",
      ],
      approvalRecs.map((r) => r.sourceRefs || []).flat().slice(0, 10),
      "Plant Manager",
      "Leadership",
      "review"
    ));
  }

  // Flag departments with critical items
  for (const [dept, data] of Object.entries(byDepartment)) {
    const criticalCount = data.items.filter((r) => r.severity === "critical").length;
    if (criticalCount >= 2) {
      recommendations.push(makeRec(
        `${dept} has ${criticalCount} critical items requiring immediate attention`,
        `The ${dept} department has ${criticalCount} critical-severity findings. These should be addressed before end of day.`,
        "critical",
        [
          `Schedule urgent review with ${dept} team lead`,
          "Allocate resources to resolve critical items",
          "Report status by end of day",
        ],
        data.items.filter((r) => r.severity === "critical").map((r) => r.sourceRefs || []).flat().slice(0, 10),
        "Plant Manager",
        "Leadership",
        "escalation"
      ));
    }
  }

  // Build narrative digest
  const totalCount = allRecs.length;
  const critCount = allRecs.filter((r) => r.severity === "critical").length;
  const highCount = allRecs.filter((r) => r.severity === "high").length;
  const deptList = Object.entries(byDepartmentSummary)
    .sort((a, b) => sevRank(b[1].topSeverity) - sevRank(a[1].topSeverity))
    .map(([dept, d]) => `${dept} (${d.count} items, top severity: ${d.topSeverity})`)
    .join("; ");

  let digest = `Today's analysis surfaced ${totalCount} recommendations across ${agentNames.length} specialist agent(s).`;
  if (critCount > 0) {
    digest += ` ${critCount} critical item(s) require immediate attention.`;
  }
  if (highCount > 0) {
    digest += ` ${highCount} high-severity item(s) should be addressed today.`;
  }
  digest += ` Department breakdown: ${deptList}.`;
  if (topItems.length > 0) {
    digest += ` Top priority: "${topItems[0].title}" (${topItems[0].severity}, ${topItems[0].ownerDept}).`;
  }

  return {
    recommendations,
    digest,
    topItems,
    byDepartment: byDepartmentSummary,
  };
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
    return {
      recommendations: parsed.recommendations || [],
      digest: parsed.digest || null,
      topItems: parsed.topItems || null,
      byDepartment: parsed.byDepartment || null,
    };
  } catch (_err) {
    return { recommendations: [], digest: null, topItems: null, byDepartment: null };
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
 * Aggregate cross-functional recommendations and produce leadership digest.
 * @param {object} context - { agentResults: { quoteAgent: {...}, purchasingAgent: {...}, ... }, orgSummary, now }
 * @param {string} triggerType
 * @param {object} opts - { useLLM: boolean }
 * @returns {Promise<{ recommendations: Array, digest: string, topItems: Array, byDepartment: object }>}
 */
async function analyze(context, triggerType, opts = {}) {
  const ruleResult = runRules(context);

  let llmResult = { recommendations: [], digest: null, topItems: null, byDepartment: null };
  if (opts.useLLM !== false) {
    llmResult = await runLLM(context);
  }

  const recommendations = dedup(ruleResult.recommendations, llmResult.recommendations);

  return {
    recommendations,
    digest: llmResult.digest || ruleResult.digest,
    topItems: llmResult.topItems || ruleResult.topItems,
    byDepartment: llmResult.byDepartment || ruleResult.byDepartment,
  };
}

module.exports = { analyze };
