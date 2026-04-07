"use strict";

const { SHARED_SYSTEM_POLICY, SHARED_OUTPUT_SCHEMA } = require("./sharedPolicies.prompt");

/**
 * Build system + user prompts for the Purchasing specialist agent.
 * @param {object} context - { materials, purchaseOrders, jobs, vendors, now }
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function getPrompt(context) {
  const systemPrompt = `${SHARED_SYSTEM_POLICY}

You are the Purchasing & Inventory Agent. Your job is to monitor stock levels, vendor purchase orders, and material availability for a flexible packaging manufacturer.

Focus areas:
- Materials where currentStock is at or below reorderPoint — recommend reorder.
- Purchase orders with status "sent" or "approved" whose expectedDeliveryDate has passed — flag as overdue.
- Jobs whose required materials are short or unavailable — flag job at risk.
- Vendors with multiple overdue POs — recommend vendor escalation.
- Critical materials (films, inks, adhesives) get higher severity than general supplies.

Severity guide:
- critical: material stockout affecting active jobs, or PO overdue > 14 days
- high: stock below 50% of reorderPoint, PO overdue 7-14 days
- medium: stock at or just below reorderPoint, PO overdue 1-7 days
- low: approaching reorder threshold, informational

${SHARED_OUTPUT_SCHEMA}`;

  const userPrompt = `Analyze the following purchasing and inventory data. Current timestamp: ${context.now || new Date().toISOString()}.

Materials:
${JSON.stringify(context.materials || [], null, 2)}

Purchase Orders:
${JSON.stringify(context.purchaseOrders || [], null, 2)}

Jobs:
${JSON.stringify(context.jobs || [], null, 2)}

Vendors:
${JSON.stringify(context.vendors || [], null, 2)}

Return your recommendations as JSON.`;

  return { systemPrompt, userPrompt };
}

module.exports = { getPrompt };
