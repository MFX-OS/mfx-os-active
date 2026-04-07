'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onSchedule(
  {
    schedule: '30 7 * * *',
    timeZone: 'America/Chicago',
    region: 'us-central1',
  },
  async () => {
    console.log('Running training expiry sweep...');
    const db = getFirestore();

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find training records expiring within 30 days that haven't been flagged
    const snap = await db.collection('trainingRecords')
      .where('status', '==', 'active')
      .where('expirationDate', '<=', thirtyDaysFromNow)
      .where('expirationDate', '>', now)
      .get();

    console.log(`Found ${snap.size} training records expiring within 30 days`);

    const enqueuePromises = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const expDate = data.expirationDate.toDate
        ? data.expirationDate.toDate()
        : new Date(data.expirationDate);
      const daysUntilExpiry = Math.ceil((expDate - now) / (24 * 60 * 60 * 1000));

      enqueuePromises.push(
        enqueue('sqfAgent', 'training_expiry_sweep', {
          sourceCollection: 'trainingRecords',
          sourceId: doc.id,
          employeeId: data.employeeId || null,
          employeeName: data.employeeName || null,
          trainingType: data.trainingType || null,
          expirationDate: expDate.toISOString(),
          daysUntilExpiry,
        })
      );
    });

    await Promise.all(enqueuePromises);
    console.log(`Enqueued ${enqueuePromises.length} training expiry alerts`);
  }
);

module.exports = { trainingExpirySweep: handler };
