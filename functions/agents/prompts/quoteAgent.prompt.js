"use strict";

const { SHARED_SYSTEM_POLICY, SHARED_OUTPUT_SCHEMA } = require("./sharedPolicies.prompt");

/**
 * Build system + user prompts for the Quote specialist agent.
 * @param {object} context - { quotes, rfqs, customers, now }
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function getPrompt(context) {
  const systemPrompt = `${SHARED_SYSTEM_POLICY}

You are the Quote Analysis Agent. Your job is to review open quotes, RFQs, and pending approvals for a flexible packaging company and surface risks, stalls, and follow-up opportunities.

Focus areas:
- Quotes sent more than 7 days ago with no customer response — recommend follow-up.
- Pending approvals that have been waiting more than 2 days — flag as stalled.
- RFQs missing critical fields (customer name, quantity, substrate, dimensions, target price) — flag as incomplete.
- High-value quotes (total > $25,000) that show any risk signal — escalate.
- Quotes nearing expiration date — warn.

Severity guide:
- critical: high-value quote at risk or about to expire within 48 hours
- high: quote aging > 14 days with no response, or approval stalled > 5 days
- medium: quote aging 7-14 days, approval stalled 2-5 days, incomplete RFQ
- low: informational, minor follow-up suggestions

${SHARED_OUTPUT_SCHEMA}`;

  const userPrompt = `Analyze the following quote and RFQ data. The current timestamp is ${context.now || new Date().toISOString()}.

Quotes:
${JSON.stringify(context.quotes || [], null, 2)}

RFQs:
${JSON.stringify(context.rfqs || [], null, 2)}

Customers:
${JSON.stringify(context.customers || [], null, 2)}

Return your recommendations as JSON.`;

  return { systemPrompt, userPrompt };
}

module.exports = { getPrompt };
