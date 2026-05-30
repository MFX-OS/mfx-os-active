// ═══════════════════════════════════════════════════════════════════
// Firestore-backed sliding-window rate limiter with in-memory fast path.
// Fails closed: if the persistent check throws, the request is denied.
// DATA-15 follow-up (2026-05-24): uses set(...,{merge:true}) so the first
// call for a user (whose _rateLimits doc never existed) doesn't NOT_FOUND.
// ═══════════════════════════════════════════════════════════════════
const { db, FieldValue } = require("./firebase");
const { sendJson } = require("./utils");

const _rateLimitCache = new Map(); // in-memory fast check

async function checkRateLimit(uid, action, maxPerWindow, windowMs) {
  windowMs = windowMs || 60000; // default 1 minute
  const key = `${uid}:${action}`;
  const now = Date.now();

  // Fast in-memory check first
  const cached = _rateLimitCache.get(key);
  if (cached && cached.count >= maxPerWindow && (now - cached.windowStart) < windowMs) {
    return false; // rate limited
  }

  // Firestore persistent check for cross-instance consistency
  const ref = db.collection("_rateLimits").doc(key);
  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : { count: 0, windowStart: now };

      if ((now - data.windowStart) >= windowMs) {
        // Window expired — reset
        tx.set(ref, { count: 1, windowStart: now, uid, action, updatedAt: FieldValue.serverTimestamp() });
        _rateLimitCache.set(key, { count: 1, windowStart: now });
        return true;
      }

      if (data.count >= maxPerWindow) {
        return false; // rate limited
      }

      tx.set(ref, { count: data.count + 1, windowStart: data.windowStart, uid, action, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      _rateLimitCache.set(key, { count: data.count + 1, windowStart: data.windowStart });
      return true;
    });
    return result;
  } catch (err) {
    console.warn("Rate limit check failed, denying:", err.message);
    return false; // fail closed
  }
}

async function enforceRateLimit(req, res, uid, action, maxPerWindow, windowMs) {
  const allowed = await checkRateLimit(uid, action, maxPerWindow, windowMs);
  if (!allowed) {
    sendJson(res, 429, { error: "Rate limit exceeded. Please try again later." });
    return false;
  }
  return true;
}

module.exports = {
  checkRateLimit,
  enforceRateLimit,
};
