'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'America/Chicago',
    region: 'us-central1',
  },
  async () => {
    console.log('Running open CAPA sweep...');
    const db = getFirestore();

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const enqueuePromises = [];

    // Find NCRs open for more than 14 days
    const ncrsSnap = await db.collection('ncrs')
      .where('status', 'in', ['open', 'in_progress', 'investigating'])
      .where('createdAt', '<=', fourteenDaysAgo)
      .get();

    console.log(`Found ${ncrsSnap.size} NCRs open > 14 days`);

    ncrsSnap.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt);
      const daysOpen = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

      enqueuePromises.push(
        enqueue('sqfAgent', 'ncr_overdue', {
          sourceCollection: 'ncrs',
          sourceId: doc.id,
          severity: data.severity || null,
          department: data.department || null,
          daysOpen,
        })
      );
    });

    // Find CAPAs open for more than 14 days
    const capasSnap = await db.collection('capas')
      .where('status', 'in', ['open', 'in_progress', 'pending_verification'])
      .where('createdAt', '<=', fourteenDaysAgo)
      .get();

    console.log(`Found ${capasSnap.size} CAPAs open > 14 days`);

    capasSnap.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt);
      const daysOpen = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

      enqueuePromises.push(
        enqueue('sqfAgent', 'capa_overdue', {
          sourceCollection: 'capas',
          sourceId: doc.id,
          severity: data.severity || null,
          assignedTo: data.assignedTo || null,
          daysOpen,
        })
      );
    });

    await Promise.all(enqueuePromises);
    console.log(`Enqueued ${enqueuePromises.length} overdue NCR/CAPA alerts`);
  }
);

module.exports = { openCAPASweep: handler };
