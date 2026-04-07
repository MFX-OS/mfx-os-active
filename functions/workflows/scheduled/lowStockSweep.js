'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Chicago',
    region: 'us-central1',
  },
  async () => {
    console.log('Running low stock sweep...');
    const db = getFirestore();

    // Scan materials where current quantity is below reorder point
    const snap = await db.collection('materials')
      .where('trackInventory', '==', true)
      .get();

    const enqueuePromises = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const currentQty = data.currentQuantity || 0;
      const reorderPoint = data.reorderPoint || 0;

      if (currentQty <= reorderPoint) {
        enqueuePromises.push(
          enqueue('purchasingAgent', 'low_stock_detected', {
            sourceCollection: 'materials',
            sourceId: doc.id,
            materialName: data.name || null,
            currentQuantity: currentQty,
            reorderPoint: reorderPoint,
            preferredVendor: data.preferredVendor || null,
            unit: data.unit || null,
          })
        );
      }
    });

    await Promise.all(enqueuePromises);
    console.log(`Enqueued ${enqueuePromises.length} low stock alerts`);
  }
);

module.exports = { lowStockSweep: handler };
