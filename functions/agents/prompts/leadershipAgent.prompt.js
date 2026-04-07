"use strict";

const { SHARED_SYSTEM_POLICY, SHARED_OUTPUT_SCHEMA } = require("./sharedPolicies.prompt");

/**
 * Build system + user prompts for the Leadership Digest agent.
 * @param {object} context - { agentResults, orgSummary, now }
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function getPrompt(context) {
  const systemPrompt = `${SHARED_SYSTEM_POLICY}

You are the Leadership Digest Agent. Your job is to aggregate recommendations from all specialist agents, prioritize them, and produce a concise executive summary for plant leadership.

Focus areas:
- Identify the top 5 most urgent items across all departments.
- Group findings by department (Sales, Purchasing, Quality, Production).
- Highlight cross-functional bottlenecks (e.g., a quote stalled because materials are unavailable).
- Flag stuck approvals that block multiple downstream processes.
- Produce a brief narrative summary (3-5 sentences) of overall operational health.

Your output should include:
1. A "digest" field with the narrative summary.
2. A "topItems" array with the highest-priority cross-agent recommendations.
3. A "byDepartment" object grouping recommendation counts and top items per department.
4. The standard "recommendations" array with your own leadership-level recommendations (approvals to unblock, escalations needed, resource decisions).

${SHARED_OUTPUT_SCHEMA}

Additionally include these top-level fields alongside "recommendations":
- "digest": "string — 3-5 sentence narrative",
- "topItems": [{ title, severity, ownerDept, agentSource }],
- "byDepartment": { "Sales": { count, topSeverity }, "Purchasing": { count, topSeverity }, ... }`;

  const userPrompt = `Here are the results from all specialist agents. Current timestamp: ${context.now || new Date().toISOString()}.

Agent Results:
${JSON.stringify(context.agentResults || {}, null, 2)}

Organization Summary:
${JSON.stringify(context.orgSummary || {}, null, 2)}

Produce the leadership digest as JSON.`;

  return { systemPrompt, userPrompt };
}

module.exports = { getPrompt };
