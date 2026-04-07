'use strict';
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const _buffer = [];
const FLUSH_SIZE = 10;

async function logAgentAction(action, data) {
  const db = getFirestore();
  const entry = {
    action,
    ...data,
    timestamp: FieldValue.serverTimestamp(),
    source: 'agent_system'
  };
  _buffer.push(entry);
  if (_buffer.length >= FLUSH_SIZE) {
    await flush();
  }
  return entry;
}

async function flush() {
  if (_buffer.length === 0) return;
  const db = getFirestore();
  const batch = db.batch();
  const items = _buffer.splice(0, FLUSH_SIZE);
  items.forEach(item => {
    batch.set(db.collection('_agentAuditLog').doc(), item);
  });
  await batch.commit();
}

async function logRunStart(agentName, triggerType, sourceCollection, sourceId, userId) {
  return logAgentAction('agent.run.start', { agentName, triggerType, sourceCollection, sourceId, userId });
}

async function logRunComplete(agentName, runId, resultType, duration) {
  return logAgentAction('agent.run.complete', { agentName, runId, resultType, durationMs: duration });
}

async function logRunError(agentName, runId, error) {
  return logAgentAction('agent.run.error', { agentName, runId, error: error.message || String(error) });
}

async function logApproval(recommendationId, decision, decidedBy, role) {
  return logAgentAction('agent.approval', { recommendationId, decision, decidedBy, role });
}

async function logExecution(recommendationId, actionIds, executedBy) {
  return logAgentAction('agent.execution', { recommendationId, actionIds, executedBy });
}

module.exports = { logAgentAction, logRunStart, logRunComplete, logRunError, logApproval, logExecution, flush };
