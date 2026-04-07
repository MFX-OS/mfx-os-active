'use strict';
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logExecution } = require('./auditLogger');
const C = require('../../shared/collectionNames');

// Execute approved actions
async function executeApprovedActions(recommendationId, actions, executedBy) {
  const db = getFirestore();
  const results = [];

  const ALLOWED_TOOLS = ['getInventory','draftEmail','draftNotification','getTrainingExpirations','createPassportTool','getJobTicket','draftTask','draftChatAlert','getQuote','assembleJobPacketTool','transitionStatusTool','getPassport','createRecommendation'];

  for (const action of actions) {
    try {
      if (!ALLOWED_TOOLS.includes(action.tool)) {
        results.push({ tool: action.tool, status: 'error', error: 'Tool not allowed' });
        continue;
      }
      const tool = require(`../tools/${action.tool}`);
      if (!tool || typeof tool.execute !== 'function') {
        results.push({ tool: action.tool, status: 'error', error: 'Tool not found' });
        continue;
      }
      const result = await tool.execute(action.params || {});
      results.push({ tool: action.tool, status: 'success', result });
    } catch (e) {
      results.push({ tool: action.tool, status: 'error', error: e.message });
    }
  }

  // Log execution
  await logExecution(recommendationId, results.map(r => r.tool), executedBy);

  // Update recommendation status
  await db.collection(C.AGENT_RECOMMENDATIONS).doc(recommendationId).update({
    status: 'executed',
    executedAt: FieldValue.serverTimestamp(),
    executionResults: results
  });

  return results;
}

module.exports = { executeApprovedActions };
