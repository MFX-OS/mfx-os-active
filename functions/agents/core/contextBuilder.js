'use strict';
const { getFirestore } = require('firebase-admin/firestore');
const C = require('../../shared/collectionNames');
const redaction = require('../policies/redactionRules');

// Build context for an agent by reading relevant collections
async function buildContext(agentName, opts) {
  const db = getFirestore();
  const context = { agent: agentName, builtAt: new Date().toISOString(), data: {} };

  const reads = getContextReads(agentName, opts);
  const promises = reads.map(async (read) => {
    try {
      let query = db.collection(read.collection);
      if (read.where) {
        read.where.forEach(w => { query = query.where(w[0], w[1], w[2]); });
      }
      if (read.orderBy) query = query.orderBy(read.orderBy[0], read.orderBy[1] || 'desc');
      if (read.limit) query = query.limit(read.limit);
      const snap = await query.get();
      context.data[read.key] = snap.docs.map(d => redaction.redactFromPrompt({ id: d.id, ...d.data() }, read.collection));
    } catch (e) {
      context.data[read.key] = [];
      console.warn(`Context read failed for ${read.key}:`, e.message);
    }
  });

  await Promise.all(promises);

  // If a specific source document was requested, fetch it
  if (opts && opts.sourceCollection && opts.sourceId) {
    try {
      const doc = await db.collection(opts.sourceCollection).doc(opts.sourceId).get();
      context.sourceDoc = doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      context.sourceDoc = null;
    }
  }

  return context;
}

function getContextReads(agentName, opts) {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const READS = {
    quoteAgent: [
      { key: 'pendingRequests', collection: C.REQUESTS, where: [['status', '==', 'pending']], limit: 50 },
      { key: 'recentQuotes', collection: C.QUOTES, orderBy: ['updatedAt'], limit: 50 },
      { key: 'customers', collection: C.CUSTOMERS, limit: 200 },
      { key: 'salesOrders', collection: C.SALES_ORDERS, orderBy: ['createdAt'], limit: 30 }
    ],
    purchasingAgent: [
      { key: 'materials', collection: C.MATERIALS, limit: 200 },
      { key: 'vendorPOs', collection: C.VENDOR_POS, orderBy: ['createdAt'], limit: 50 },
      { key: 'vendors', collection: C.VENDORS, limit: 100 },
      { key: 'materialLots', collection: C.MATERIAL_LOTS, orderBy: ['receivedAt'], limit: 50 }
    ],
    sqfAgent: [
      { key: 'trainingRecords', collection: C.TRAINING_RECORDS, limit: 100 },
      { key: 'ncrs', collection: C.NCRS, where: [['status', '!=', 'closed']], limit: 50 },
      { key: 'audits', collection: C.AUDITS, limit: 20 },
      { key: 'dcrs', collection: C.DCRS, limit: 30 },
      { key: 'gmpInspections', collection: C.GMP_INSPECTIONS, orderBy: ['date'], limit: 20 }
    ],
    jobAgent: [
      { key: 'jobTickets', collection: C.JOB_TICKETS, limit: 50 },
      { key: 'jobPassports', collection: C.JOB_PASSPORTS, limit: 50 },
      { key: 'approvalRecords', collection: C.APPROVAL_RECORDS, orderBy: ['createdAt'], limit: 30 },
      { key: 'prepressQueue', collection: C.PREPRESS_QUEUE, limit: 30 }
    ],
    leadershipAgent: [
      { key: 'recommendations', collection: 'agentRecommendations', where: [['status', '==', 'pending_approval']], limit: 50 },
      { key: 'recentActivity', collection: C.ACTIVITY, orderBy: ['timestamp'], limit: 30 },
      { key: 'systemHealth', collection: C.SYSTEM_HEALTH, limit: 5 },
      { key: 'recentQuotes', collection: C.QUOTES, orderBy: ['updatedAt'], limit: 20 },
      { key: 'openNCRs', collection: C.NCRS, where: [['status', '!=', 'closed']], limit: 20 },
      { key: 'vendorPOs', collection: C.VENDOR_POS, orderBy: ['createdAt'], limit: 20 }
    ],
    // trainingAgent: removed — no specialist file exists
  };

  return READS[agentName] || [];
}

// Build a single-document context for event-driven triggers
async function buildTriggerContext(collection, docId, relatedCollections) {
  const db = getFirestore();
  const context = { builtAt: new Date().toISOString(), data: {} };

  try {
    const doc = await db.collection(collection).doc(docId).get();
    context.sourceDoc = doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (e) {
    context.sourceDoc = null;
  }

  if (relatedCollections) {
    for (const rc of relatedCollections) {
      try {
        let q = db.collection(rc.collection);
        if (rc.where) rc.where.forEach(w => { q = q.where(w[0], w[1], w[2]); });
        if (rc.limit) q = q.limit(rc.limit);
        const snap = await q.get();
        context.data[rc.key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { context.data[rc.key] = []; }
    }
  }

  return context;
}

module.exports = { buildContext, buildTriggerContext, getContextReads };
