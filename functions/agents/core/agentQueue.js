'use strict';
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const C = require('../../shared/collectionNames');

async function enqueue(agentName, triggerType, sourceCollection, sourceId, priority) {
  const db = getFirestore();
  const ref = db.collection(C.AGENT_SCHEDULES).doc();
  await ref.set({
    agentName,
    triggerType,
    sourceCollection: sourceCollection || null,
    sourceId: sourceId || null,
    priority: priority || 'normal',
    status: 'queued',
    queuedAt: FieldValue.serverTimestamp(),
    startedAt: null,
    completedAt: null,
    runId: null
  });
  return ref.id;
}

async function dequeue(limit) {
  const db = getFirestore();
  const snap = await db.collection(C.AGENT_SCHEDULES)
    .where('status', '==', 'queued')
    .orderBy('queuedAt')
    .limit(limit || 5)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markProcessing(queueId, runId) {
  const db = getFirestore();
  await db.collection(C.AGENT_SCHEDULES).doc(queueId).update({
    status: 'processing',
    startedAt: FieldValue.serverTimestamp(),
    runId
  });
}

async function markDone(queueId) {
  const db = getFirestore();
  await db.collection(C.AGENT_SCHEDULES).doc(queueId).update({
    status: 'completed',
    completedAt: FieldValue.serverTimestamp()
  });
}

module.exports = { enqueue, dequeue, markProcessing, markDone };
