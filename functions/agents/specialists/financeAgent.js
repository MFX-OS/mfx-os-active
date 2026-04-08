"use strict";

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
  const invoices = context.data.invoices || [];
  const vendorInvoices = context.data.vendorInvoices || [];
  const salesOrders = context.data.salesOrders || [];

  // 1. AR aging — customer invoices past due
  for (const inv of invoices) {
    const status = (inv.status || "").toLowerCase();
    if (status === "paid" || status === "cancelled" || status === "voided") continue;
    const dueDate = inv.dueDate || inv.paymentDue;
    if (!dueDate) continue;
    const daysOverdue = daysBetween(dueDate, now);
    if (daysOverdue <= 0) continue;

    let severity = "low";
    const amount = inv.total || inv.amount || 0;
    if (daysOverdue > 60 || amount > 10000) severity = "critical";
    else if (daysOverdue > 30 || amount > 5000) severity = "high";
    else if (daysOverdue > 14) severity = "medium";

    const bucket = daysOverdue > 90 ? "90+" : daysOverdue > 60 ? "61-90" : daysOverdue > 30 ? "31-60" : "1-30";

    recommendations.push(makeRec(
      `Invoice ${inv.invoiceNum || inv.id} overdue (${bucket} days) — $${amount.toLocaleString()}`,
      `Invoice for ${inv.customerName || inv.company || "customer"} is ${daysOverdue} day(s) past due. Amount: $${amount.toLocaleString()}. ${inv.contactEmail ? "Contact: " + inv.contactEmail : ""}`,
      severity,
      [
        daysOverdue <= 14 ? "Send payment reminder" : "Escalate to collections process",
        daysOverdue > 30 ? "Review credit terms for this customer" : null,
        daysOverdue > 60 ? "Consider credit hold on new orders" : null,
        "Log collection attempt in activity"
      ].filter(Boolean),
      [inv.id, inv.customerId].filter(Boolean),
      "Accounting Manager",
      "Accounting",
      daysOverdue > 30 ? "escalation" : "review"
    ));
  }

  // 2. Vendor invoices awaiting approval
  for (const vinv of vendorInvoices) {
    const status = (vinv.status || "").toLowerCase();
    if (status !== "pending" && status !== "received") continue;
    const receivedDate = vinv.receivedDate || vinv.createdAt;
    if (!receivedDate) continue;
    const daysPending = daysBetween(receivedDate, now);
    if (daysPending < 7) continue;

    const amount = vinv.total || vinv.amount || 0;
    let severity = "low";
    if (daysPending > 30) severity = "high";
    else if (daysPending > 14) severity = "medium";

    recommendations.push(makeRec(
      `Vendor invoice ${vinv.invoiceNum || vinv.id} pending ${daysPending} days — $${amount.toLocaleString()}`,
      `Invoice from ${vinv.vendorName || vinv.vendor || "vendor"} received ${daysPending} day(s) ago, still awaiting approval. Amount: $${amount.toLocaleString()}. ${vinv.poNumber ? "PO: " + vinv.poNumber : "No PO linked."}`,
      severity,
      [
        "Review and approve or reject invoice",
        !vinv.poNumber ? "Match invoice to purchase order" : null,
        daysPending > 14 ? "Check for early payment discount deadline" : null
      ].filter(Boolean),
      [vinv.id, vinv.vendorId].filter(Boolean),
      "Accounting Manager",
      "Accounting",
      "review"
    ));
  }

  // 3. Sales orders fulfilled but not invoiced
  for (const so of salesOrders) {
    const status = (so.status || "").toLowerCase();
    if (status !== "fulfilled" && status !== "shipped") continue;
    if (so.invoiced === true || so.invoiceId) continue;
    const fulfilledDate = so.fulfilledAt || so.shippedAt || so.updatedAt;
    if (!fulfilledDate) continue;
    const daysSinceFulfilled = daysBetween(fulfilledDate, now);
    if (daysSinceFulfilled < 3) continue;

    let severity = "medium";
    if (daysSinceFulfilled > 14) severity = "high";

    recommendations.push(makeRec(
      `SO ${so.soNum || so.id} fulfilled ${daysSinceFulfilled} days ago — not yet invoiced`,
      `Sales order for ${so.customerName || so.company || "customer"} was fulfilled ${daysSinceFulfilled} day(s) ago but no invoice has been generated. ${so.total ? "Order value: $" + so.total.toLocaleString() : ""}`,
      severity,
      [
        "Generate invoice for fulfilled order",
        "Verify shipping confirmation and delivery receipt",
        daysSinceFulfilled > 7 ? "Prioritize — revenue recognition delay" : null
      ].filter(Boolean),
      [so.id, so.customerId].filter(Boolean),
      "Accounting Manager",
      "Accounting",
      "review"
    ));
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function analyze(context, triggerType, opts = {}) {
  const ruleRecs = runRules(context);
  return { recommendations: ruleRecs };
}

module.exports = { analyze };
