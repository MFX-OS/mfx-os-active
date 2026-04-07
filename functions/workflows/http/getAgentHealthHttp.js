'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const CORS_ORIGINS = ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"];
const handler = onRequest({ cors: CORS_ORIGINS, region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email || !decoded.email.endsWith('@microflexfilm.com')) {
      return res.status(403).json({ error: 'Access restricted' });
    }
  } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

  const db = getFirestore();

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch all agent run logs from the last 24 hours
    const runsSnap = await db.collection('agentRuns')
      .where('startedAt', '>=', twentyFourHoursAgo)
      .get();

    // Aggregate stats per agent
    const agentStats = {};
    runsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.agentName || 'unknown';
      if (!agentStats[name]) {
        agentStats[name] = { total: 0, success: 0, failed: 0, lastRunAt: null };
      }
      agentStats[name].total += 1;
      if (data.status === 'success') agentStats[name].success += 1;
      if (data.status === 'error' || data.status === 'failed') agentStats[name].failed += 1;

      const runTime = data.completedAt ? data.completedAt.toDate() : data.startedAt.toDate();
      if (!agentStats[name].lastRunAt || runTime > agentStats[name].lastRunAt) {
        agentStats[name].lastRunAt = runTime;
      }
    });

    // Fetch pending recommendations count per agent
    const pendingSnap = await db.collection('agentRecommendations')
      .where('status', '==', 'pending')
      .get();

    const pendingByAgent = {};
    pendingSnap.forEach((doc) => {
      const name = doc.data().agentName || 'unknown';
      pendingByAgent[name] = (pendingByAgent[name] || 0) + 1;
    });

    // Fetch approval rates (all time for meaningful stats)
    const approvalsSnap = await db.collection('agentApprovals').get();
    const approvalsByAgent = {};
    approvalsSnap.forEach((doc) => {
      const data = doc.data();
      const name = data.agentName || 'unknown';
      if (!approvalsByAgent[name]) approvalsByAgent[name] = { approved: 0, total: 0 };
      approvalsByAgent[name].total += 1;
      if (data.decision === 'approved') approvalsByAgent[name].approved += 1;
    });

    // Combine into health report
    const allAgentNames = new Set([
      ...Object.keys(agentStats),
      ...Object.keys(pendingByAgent),
      ...Object.keys(approvalsByAgent),
    ]);

    const health = {};
    for (const name of allAgentNames) {
      const stats = agentStats[name] || { total: 0, success: 0, failed: 0, lastRunAt: null };
      const approvals = approvalsByAgent[name] || { approved: 0, total: 0 };
      health[name] = {
        lastRunAt: stats.lastRunAt ? stats.lastRunAt.toISOString() : null,
        runs24h: stats.total,
        successRate24h: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : null,
        pendingRecommendations: pendingByAgent[name] || 0,
        approvalRate: approvals.total > 0 ? Math.round((approvals.approved / approvals.total) * 100) : null,
      };
    }

    res.json({ success: true, asOf: now.toISOString(), agents: health });
  } catch (e) {
    console.error('getAgentHealth error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { getAgentHealth: handler };
