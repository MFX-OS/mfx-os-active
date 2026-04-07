"use strict";

const { getFirestore, Timestamp } = require("firebase-admin/firestore");

/**
 * getTrainingExpirations — Reads training records expiring within N days
 * (default 30).
 */
async function execute({ withinDays, department }) {
  const days = withinDays || 30;

  if (typeof days !== "number" || days < 1) {
    return { status: "error", error: "withinDays must be a positive number" };
  }

  const db = getFirestore();
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const cutoffTs = Timestamp.fromDate(cutoff);
  const nowTs = Timestamp.fromDate(now);

  try {
    let query = db
      .collection("trainingRecords")
      .where("expirationDate", ">=", nowTs)
      .where("expirationDate", "<=", cutoffTs);

    const snapshot = await query.get();

    const expirations = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (department && data.department !== department) {
        return; // skip if filtering by department
      }
      expirations.push({
        recordId: doc.id,
        employeeName: data.employeeName || "Unknown",
        employeeId: data.employeeId || null,
        department: data.department || null,
        certification: data.certification || data.trainingName || "Unknown",
        expirationDate: data.expirationDate ? data.expirationDate.toDate().toISOString() : null,
      });
    });

    return { status: "ok", items: expirations, count: expirations.length, withinDays: days };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
