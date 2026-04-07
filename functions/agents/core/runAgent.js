'use strict';
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAgent, isEnabled } = require('./agentRegistry');
const { buildContext } = require('./contextBuilder');
const { requiresApproval } = require('./approvalGate');
const { logRunStart, logRunComplete, logRunError } = require('./auditLogger');
const { AGENT_STATUS, SEVERITY } = require('../../shared/constants');
const C = require('../../shared/collectionNames');

async function runAgent(agentName, triggerType, opts, userId) {
  const db = getFirestore();
  const startTime = Date.now();

  // Validate agent exists and is enabled
  const agentConfig = getAgent(agentName);
  if (!agentConfig) throw new Error(`Unknown agent: ${agentName}`);

  // Check feature flag in controlConfigs
  try {
    const flagDoc = await db.collection(C.CONTROL_CONFIGS).doc('aiAgents').get();
    if (flagDoc.exists) {
      const flags = flagDoc.data();
      if (flags.globalKill === true) throw new Error('AI agent system is disabled');
      if (flags.disabled && flags.disabled.includes(agentName)) throw new Error(`Agent ${agentName} is disabled by config`);
    }
  } catch (e) {
    if (e.message.includes('disabled')) throw e;
    // Config doc missing is OK — continue with defaults
  }

  if (!isEnabled(agentName)) throw new Error(`Agent ${agentName} is not enabled`);

  // Create run record
  const runRef = db.collection(C.AGENT_RUNS).doc();
  const runData = {
    agentName,
    triggerType,
    sourceCollection: opts.sourceCollection || null,
    sourceId: opts.sourceId || null,
    status: AGENT_STATUS.RUNNING,
    startedAt: FieldValue.serverTimestamp(),
    endedAt: null,
    resultType: null,
    promptVersion: agentConfig.version,
    modelRoute: 'enterprise-default',
    requiresApproval: false,
    approved: false,
    error: null,
    userId: userId || 'system'
  };
  await runRef.set(runData);
  await logRunStart(agentName, triggerType, opts.sourceCollection, opts.sourceId, userId);

  try {
    // Build context
    const context = await buildContext(agentName, opts);

    // Load specialist agent
    const specialist = require(`../specialists/${agentName}`);
    if (!specialist || typeof specialist.analyze !== 'function') {
      throw new Error(`Specialist ${agentName} does not export analyze()`);
    }

    // Run analysis
    const result = await specialist.analyze(context, triggerType, opts);

    // Process recommendations
    const recommendations = [];
    if (result && result.recommendations && result.recommendations.length > 0) {
      for (const rec of result.recommendations) {
        const needsApproval = requiresApproval(rec.actionType || 'recommend_only', rec.severity || SEVERITY.MEDIUM);
        const recRef = db.collection(C.AGENT_RECOMMENDATIONS).doc();
        const recData = {
          agentName,
          runId: runRef.id,
          module: agentConfig.module,
          severity: rec.severity || SEVERITY.MEDIUM,
          title: rec.title,
          summary: rec.summary,
          recommendedActions: rec.actions || [],
          sourceRefs: rec.sourceRefs || [],
          status: needsApproval ? AGENT_STATUS.PENDING_APPROVAL : AGENT_STATUS.COMPLETED,
          ownerRole: rec.ownerRole || agentConfig.module,
          ownerDept: rec.ownerDept || null,
          requiresApproval: needsApproval,
          actionType: rec.actionType || 'recommend_only',
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: rec.expiresAt || null
        };
        await recRef.set(recData);
        recommendations.push({ id: recRef.id, ...recData });
      }
    }

    // Update run record
    const duration = Date.now() - startTime;
    await runRef.update({
      status: AGENT_STATUS.COMPLETED,
      endedAt: FieldValue.serverTimestamp(),
      resultType: recommendations.length > 0 ? 'recommendation' : 'no_action',
      recommendationCount: recommendations.length
    });
    await logRunComplete(agentName, runRef.id, recommendations.length > 0 ? 'recommendation' : 'no_action', duration);

    return {
      runId: runRef.id,
      agentName,
      status: 'completed',
      recommendations,
      durationMs: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    await runRef.update({
      status: AGENT_STATUS.FAILED,
      endedAt: FieldValue.serverTimestamp(),
      error: error.message
    });
    await logRunError(agentName, runRef.id, error);
    throw error;
  }
}

module.exports = { runAgent };
