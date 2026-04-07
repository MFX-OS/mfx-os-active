'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { executeTool } = require('../../agents/core/toolExecutor');

const handler = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let uid, userEmail;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid;
    userEmail = decoded.email;
    if (!userEmail || !userEmail.endsWith('@microflexfilm.com')) {
      return res.status(403).json({ error: 'Access restricted' });
    }
  } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

  const { recommendationId, decisionNotes } = req.body;
  if (!recommendationId) return res.status(400).json({ error: 'recommendationId required' });

  const db = getFirestore();

  try {
    const recRef = db.collection('agentRecommendations').doc(recommendationId);
    const recSnap = await recRef.get();
    if (!recSnap.exists) return res.status(404).json({ error: 'Recommendation not found' });

    const rec = recSnap.data();
    if (rec.status !== 'pending') {
      return res.status(409).json({ error: `Recommendation already ${rec.status}` });
    }

    // Verify user role meets approval threshold
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userRole = userData.role || 'viewer';

    const roleHierarchy = { viewer: 0, operator: 1, supervisor: 2, manager: 3, admin: 4 };
    const requiredLevel = roleHierarchy[rec.approvalThreshold] || 2;
    const userLevel = roleHierarchy[userRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Role '${userRole}' insufficient. Requires '${rec.approvalThreshold}' or above.` });
    }

    // Update recommendation status
    await recRef.update({
      status: 'approved',
      approvedBy: uid,
      approvedAt: FieldValue.serverTimestamp(),
      decisionNotes: decisionNotes || null,
    });

    // Create approval record
    await db.collection('agentApprovals').add({
      recommendationId,
      decision: 'approved',
      decidedBy: uid,
      decidedByEmail: userEmail,
      decisionNotes: decisionNotes || null,
      agentName: rec.agentName || null,
      module: rec.module || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Execute safe auto-actions if the recommendation includes them
    let executionResult = null;
    if (rec.autoAction && rec.autoAction.tool) {
      try {
        executionResult = await executeTool(rec.autoAction.tool, rec.autoAction.params || {}, uid);
        await recRef.update({ executionStatus: 'completed', executionResult });
      } catch (execErr) {
        console.error('Auto-action execution failed:', execErr);
        await recRef.update({ executionStatus: 'failed', executionError: execErr.message });
        executionResult = { error: execErr.message };
      }
    }

    res.json({ success: true, status: 'approved', executionResult });
  } catch (e) {
    console.error('approveAgentAction error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { approveAgentAction: handler };
