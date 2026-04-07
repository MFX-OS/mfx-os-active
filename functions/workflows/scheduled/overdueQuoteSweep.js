'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'America/Chicago',
    region: 'us-central1',
  },
  async () => {
    console.log('Running overdue quote sweep...');
    const db = getFirestore();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find quotes sent more than 7 days ago with no customer response
    const snap = await db.collection('quotes')
      .where('status', '==', 'sent')
      .where('sentAt', '<=', sevenDaysAgo)
      .get();

    console.log(`Found ${snap.size} overdue quotes`);

    const enqueuePromises = [];
    snap.forEach((doc) => {
      const data = doc.data();
      enqueuePromises.push(
        enqueue('quoteAgent', 'quote_overdue', {
          sourceCollection: 'quotes',
          sourceId: doc.id,
          customerName: data.customerName || null,
          sentAt: data.sentAt ? data.sentAt.toDate().toISOString() : null,
          amount: data.totalAmount || null,
        })
      );
    });

    await Promise.all(enqueuePromises);
    console.log(`Enqueued ${enqueuePromises.length} overdue quote tasks`);
  }
);

module.exports = { overdueQuoteSweep: handler };
