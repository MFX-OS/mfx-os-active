"use strict";

const { getPrompt } = require("../prompts/purchasingAgent.prompt");

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
  const materials = context.materials || [];
  const purchaseOrders = context.purchaseOrders || [];
  const jobs = context.jobs || [];

  // 1. Materials below reorder threshold
  for (const mat of materials) {
    const current = mat.currentStock != null ? mat.currentStock : null;
    const reorder = mat.reorderPoint != null ? mat.reorderPoint : null;
    if (current == null || reorder == null) continue;
    if (current > reorder) continue;

    const ratio = reorder > 0 ? current / reorder : 0;
    const isCritical = ["film", "ink", "adhesive", "laminate", "substrate"].some(
      (t) => (mat.category || mat.type || "").toLowerCase().includes(t)
    );

    let severity = "medium";
    if (current === 0) severity = "critical";
    else if (ratio < 0.5) severity = isCritical ? "critical" : "high";
    else if (isCritical) severity = "high";

    const deficit = reorder - current;

    recommendations.push(makeRec(
      `${mat.name || mat.id} stock below reorder point (${current} / ${reorder} ${mat.unit || "units"})`,
      `Material ${mat.name || mat.id} has ${current} ${mat.unit || "units"} in stock versus a reorder point of ${reorder}. Deficit: ${deficit}. ${isCritical ? "This is a critical production material." : ""}`,
      severity,
      [
        `Create purchase order for ${mat.name || mat.id} — suggested qty: ${Math.max(deficit * 2, mat.orderQty || deficit)}`,
        current === 0 ? "Check if any open POs exist for this material" : null,
        isCritical ? "Verify impact on active job schedule" : null,
      ].filter(Boolean),
      [mat.sku || mat.id].filter(Boolean),
      "Buyer",
      "Purchasing",
      "reorder"
    ));
  }

  // 2. Overdue vendor POs
  const vendorOverdueCounts = {};
  for (const po of purchaseOrders) {
    const status = (po.status || "").toLowerCase();
    if (status !== "sent" && status !== "approved") continue;
    if (!po.expectedDeliveryDate) continue;
    const overdueDays = daysBetween(po.expectedDeliveryDate, now);
    if (overdueDays <= 0) continue;

    const vendorName = po.vendorName || po.vendorId || "Unknown vendor";
    vendorOverdueCounts[vendorName] = (vendorOverdueCounts[vendorName] || 0) + 1;

    let severity = "medium";
    if (overdueDays > 14) severity = "critical";
    else if (overdueDays > 7) severity = "high";

    recommendations.push(makeRec(
      `PO ${po.poNumber || po.id} overdue by ${overdueDays} day(s) from ${vendorName}`,
      `Purchase order for ${po.description || po.materialName || "materials"} from ${vendorName} was expected ${po.expectedDeliveryDate} and is ${overdueDays} day(s) overdue.`,
      severity,
      [
        `Contact ${vendorName} for updated delivery date`,
        overdueDays > 7 ? "Identify alternative supplier" : "Request expedited shipping",
        overdueDays > 14 ? "Escalate to purchasing manager" : null,
      ].filter(Boolean),
      [po.poNumber || po.id].filter(Boolean),
      "Buyer",
      "Purchasing",
      "follow-up"
    ));
  }

  // 3. Vendors with multiple overdue POs
  for (const [vendor, count] of Object.entries(vendorOverdueCounts)) {
    if (count < 2) continue;
    recommendations.push(makeRec(
      `Vendor ${vendor} has ${count} overdue POs`,
      `${vendor} has ${count} purchase orders past their expected delivery date. This may indicate a systemic supply issue.`,
      count >= 4 ? "critical" : "high",
      [
        `Schedule vendor performance review with ${vendor}`,
        "Evaluate alternate suppliers for affected materials",
        "Review vendor scorecard and update risk rating",
      ],
      [],
      "Purchasing Manager",
      "Purchasing",
      "escalation"
    ));
  }

  // 4. Jobs at risk due to material shortages
  const lowStockMaterials = new Set(
    materials
      .filter((m) => m.currentStock != null && m.reorderPoint != null && m.currentStock <= m.reorderPoint)
      .map((m) => m.id || m.sku || m.name)
  );

  for (const job of jobs) {
    if (job.status === "complete" || job.status === "cancelled" || job.status === "shipped") continue;
    const requiredMaterials = job.materials || job.bom || [];
    const shortMaterials = requiredMaterials.filter((m) => {
      const matId = typeof m === "string" ? m : m.materialId || m.id || m.sku || m.name;
      return lowStockMaterials.has(matId);
    });

    if (shortMaterials.length === 0) continue;

    const shortNames = shortMaterials.map((m) => (typeof m === "string" ? m : m.materialId || m.id || m.name));

    recommendations.push(makeRec(
      `Job ${job.jobNumber || job.id} at risk — ${shortMaterials.length} material(s) short`,
      `Job ${job.jobNumber || job.id} (${job.customerName || "unknown customer"}) requires materials that are at or below reorder point: ${shortNames.join(", ")}.`,
      shortMaterials.length >= 3 ? "critical" : "high",
      [
        "Verify current stock can cover partial production run",
        `Expedite orders for: ${shortNames.join(", ")}`,
        "Notify production scheduler of potential delay",
      ],
      [job.jobNumber || job.id, ...shortNames].filter(Boolean),
      "Production Planner",
      "Production",
      "notification"
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
 * Analyze purchasing / inventory context and return recommendations.
 * @param {object} context - { materials, purchaseOrders, jobs, vendors, now }
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
