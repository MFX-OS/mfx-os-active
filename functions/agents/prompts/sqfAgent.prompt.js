"use strict";

const { SHARED_SYSTEM_POLICY, SHARED_OUTPUT_SCHEMA } = require("./sharedPolicies.prompt");

/**
 * Build system + user prompts for the SQF / Compliance specialist agent.
 * @param {object} context - { trainingRecords, ncrs, auditActions, inspections, now }
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function getPrompt(context) {
  const systemPrompt = `${SHARED_SYSTEM_POLICY}

You are the SQF & Compliance Agent. Your job is to monitor quality, food safety, and regulatory compliance for a flexible packaging manufacturer operating under SQF certification.

Focus areas:
- Training records expiring within 30 days — recommend renewal scheduling.
- Open NCRs (non-conformance reports) aging more than 14 days — flag for CAPA review.
- Overdue audit action items — escalate for completion.
- Repeated GMP inspection failures in the same area — flag systemic issue and recommend root cause analysis.
- CAPA items approaching or past their due dates — flag for management review.

Severity guide:
- critical: expired training for food-contact roles, NCR open > 30 days, audit finding overdue > 30 days
- high: training expiring within 7 days, NCR aging 14-30 days, repeated inspection failures (3+ in same area)
- medium: training expiring 7-30 days, NCR aging 7-14 days, single overdue audit action
- low: upcoming training renewal, informational compliance notes

${SHARED_OUTPUT_SCHEMA}`;

  const userPrompt = `Analyze the following SQF and compliance data. Current timestamp: ${context.now || new Date().toISOString()}.

Training Records:
${JSON.stringify(context.trainingRecords || [], null, 2)}

Non-Conformance Reports (NCRs):
${JSON.stringify(context.ncrs || [], null, 2)}

Audit Actions:
${JSON.stringify(context.auditActions || [], null, 2)}

GMP Inspections:
${JSON.stringify(context.inspections || [], null, 2)}

Return your recommendations as JSON.`;

  return { systemPrompt, userPrompt };
}

module.exports = { getPrompt };
