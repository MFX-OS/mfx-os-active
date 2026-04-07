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

  let uid;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid;
    if (!decoded.email || !decoded.email.endsWith('@microflexfilm.com')) {
      return res.status(403).json({ error: 'Access restricted' });
    }
  } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

  const db = getFirestore();

  try {
    // Fetch user profile for department/role filtering
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userDept = userData.department || null;
    const userRole = userData.role || 'viewer';

    // Build query with filters
    const { status, module, severity, limit: limitParam } = req.query;
    const queryLimit = Math.min(parseInt(limitParam, 10) || 50, 200);

    let query = db.collection('agentRecommendations')
      .orderBy('createdAt', 'desc')
      .limit(queryLimit);

    if (status) {
      query = query.where('status', '==', status);
    } else {
      // Default to pending
      query = query.where('status', '==', 'pending');
    }

    if (module) {
      query = query.where('module', '==', module);
    }

    if (severity) {
      query = query.where('severity', '==', severity);
    }

    const snap = await query.get();
    const recommendations = [];

    snap.forEach((doc) => {
      const data = doc.data();
      // Filter by department visibility: admins/managers see all, others see own dept
      const isAdmin = userRole === 'admin' || userRole === 'manager';
      if (!isAdmin && data.department && userDept && data.department !== userDept) {
        return;
      }
      recommendations.push({ id: doc.id, ...data });
    });

    res.json({ success: true, count: recommendations.length, recommendations });
  } catch (e) {
    console.error('getRecommendations error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { getRecommendations: handler };
