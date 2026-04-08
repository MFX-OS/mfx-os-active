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
  const trainingRecords = context.data.trainingRecords || [];
  const employees = context.data.employees || [];
  const programs = context.data.trainingPrograms || [];
  const onboarding = context.data.onboarding || [];

  // Build lookup of employees by id
  const empById = {};
  for (const emp of employees) { empById[emp.id] = emp; }

  // 1. Training expiring within 30 days
  for (const tr of trainingRecords) {
    if (!tr.expirationDate) continue;
    const status = (tr.status || "").toLowerCase();
    if (status === "renewed" || status === "inactive" || status === "completed") continue;
    const daysToExpiry = daysBetween(now, tr.expirationDate);
    if (daysToExpiry > 30) continue;

    const emp = empById[tr.employeeId] || {};
    const isFoodContact = (emp.department || emp.dept || tr.department || "").toLowerCase()
      .match(/production|quality|sanitation|warehouse|food.?contact/);

    let severity = "medium";
    if (daysToExpiry < 0) severity = isFoodContact ? "critical" : "high";
    else if (daysToExpiry <= 7) severity = isFoodContact ? "high" : "medium";

    const expired = daysToExpiry < 0;
    recommendations.push(makeRec(
      `Training ${expired ? "expired" : "expiring"}: ${tr.employeeName || tr.employeeId || "employee"} — ${tr.trainingName || tr.courseId || "unknown course"}`,
      `${tr.employeeName || "Employee"}'s "${tr.trainingName || tr.courseId}" ${expired ? "expired " + Math.abs(daysToExpiry) + " day(s) ago" : "expires in " + daysToExpiry + " day(s)"}. ${isFoodContact ? "Food-contact role — SQF requires current training." : ""}`,
      severity,
      [
        expired ? "Schedule immediate retraining" : "Schedule renewal before expiration",
        isFoodContact && expired ? "Reassign from food-contact duties until retrained" : null,
        "Update training matrix after completion"
      ].filter(Boolean),
      [tr.id, tr.employeeId].filter(Boolean),
      "Training Coordinator",
      "Quality",
      "review"
    ));
  }

  // 2. New employees without completed onboarding (>7 days)
  for (const ob of onboarding) {
    const status = (ob.status || "").toLowerCase();
    if (status === "complete" || status === "completed") continue;
    const startDate = ob.startDate || ob.createdAt;
    if (!startDate) continue;
    const daysSinceStart = daysBetween(startDate, now);
    if (daysSinceStart < 7) continue;

    let severity = "medium";
    if (daysSinceStart > 30) severity = "high";
    if (daysSinceStart > 60) severity = "critical";

    recommendations.push(makeRec(
      `Onboarding incomplete: ${ob.employeeName || ob.employeeId || "employee"} (${daysSinceStart} days)`,
      `${ob.employeeName || "New employee"} started ${daysSinceStart} day(s) ago but onboarding is not complete. ${ob.completedSteps ? "Completed " + ob.completedSteps + "/" + (ob.totalSteps || "?") + " steps." : ""}`,
      severity,
      [
        "Follow up with employee and manager on remaining onboarding steps",
        daysSinceStart > 30 ? "Escalate to HR manager" : "Send reminder to direct supervisor",
        "Verify all required training modules are assigned"
      ],
      [ob.id, ob.employeeId].filter(Boolean),
      "HR Manager",
      "HR",
      "review"
    ));
  }

  // 3. Training programs with low completion rates
  for (const prog of programs) {
    if (!prog.assignedCount || prog.assignedCount < 3) continue;
    const completionRate = (prog.completedCount || 0) / prog.assignedCount;
    if (completionRate >= 0.7) continue;
    const isRequired = (prog.required === true || (prog.type || "").toLowerCase() === "mandatory");

    let severity = "low";
    if (isRequired && completionRate < 0.5) severity = "high";
    else if (isRequired) severity = "medium";

    recommendations.push(makeRec(
      `Low completion: "${prog.name || prog.id}" (${Math.round(completionRate * 100)}%)`,
      `Training program "${prog.name || prog.id}" has ${prog.completedCount || 0}/${prog.assignedCount} completions (${Math.round(completionRate * 100)}%). ${isRequired ? "This is a mandatory program." : ""}`,
      severity,
      [
        "Send completion reminders to outstanding employees",
        isRequired ? "Escalate — mandatory training below threshold" : "Review if program is still relevant",
        "Check for scheduling conflicts or access issues"
      ],
      [prog.id].filter(Boolean),
      "Training Coordinator",
      "Quality",
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
