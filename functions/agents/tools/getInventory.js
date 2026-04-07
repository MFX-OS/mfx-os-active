"use strict";

const { getFirestore } = require("firebase-admin/firestore");

/**
 * getInventory — Reads the `materials` collection and returns items
 * that are at or below their reorder point.
 */
async function execute({ category, limit }) {
  const db = getFirestore();
  const maxResults = limit || 100;

  try {
    let query = db.collection("materials");

    if (category) {
      query = query.where("category", "==", category);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return { status: "ok", items: [], count: 0 };
    }

    const belowReorder = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const qty = typeof data.quantityOnHand === "number" ? data.quantityOnHand : 0;
      const reorderPt = typeof data.reorderPoint === "number" ? data.reorderPoint : 0;

      if (qty <= reorderPt) {
        belowReorder.push({
          materialId: doc.id,
          name: data.name || "Unknown",
          category: data.category || null,
          quantityOnHand: qty,
          reorderPoint: reorderPt,
          unit: data.unit || null,
          supplier: data.supplier || null,
        });
      }
    });

    const limited = belowReorder.slice(0, maxResults);

    return { status: "ok", items: limited, count: limited.length, totalBelowReorder: belowReorder.length };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

module.exports = { execute };
