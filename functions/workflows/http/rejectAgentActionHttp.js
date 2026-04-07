'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const CORS_ORIGINS = ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"];
const handler = onRequest({ cors: CORS_ORIGINS, region: 'us-central1' }, async (req, res) => {
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

  const { recommendationId, reason } = req.body;
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

    // Update recommendation status
    await recRef.update({
      status: 'rejected',
      rejectedBy: uid,
      rejectedAt: FieldValue.serverTimestamp(),
      rejectionReason: reason || null,
    });

    // Create approval record with decision='rejected'
    await db.collection('agentApprovals').add({
      recommendationId,
      decision: 'rejected',
      decidedBy: uid,
      decidedByEmail: userEmail,
      reason: reason || null,
      agentName: rec.agentName || null,
      module: rec.module || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, status: 'rejected' });
  } catch (e) {
    console.error('rejectAgentAction error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { rejectAgentAction: handler };
