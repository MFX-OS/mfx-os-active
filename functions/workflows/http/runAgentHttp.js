'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { runAgent } = require('../../agents/core/runAgent');

const CORS_ORIGINS = ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"];
const handler = onRequest({ cors: CORS_ORIGINS, region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let uid;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid;
    // Verify company email
    if (!decoded.email || !decoded.email.endsWith('@microflexfilm.com')) {
      return res.status(403).json({ error: 'Access restricted' });
    }
  } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

  const { agentName, triggerType, sourceCollection, sourceId } = req.body;
  if (!agentName) return res.status(400).json({ error: 'agentName required' });

  try {
    const result = await runAgent(agentName, triggerType || 'manual', { sourceCollection, sourceId }, uid);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('runAgent error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { runAgent: handler };
