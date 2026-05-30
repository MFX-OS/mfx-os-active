// ═══════════════════════════════════════════════════════════════════
// HTTP auth helpers — bearer parsing, ID-token verification,
// company-domain enforcement, dev/emulator relaxation, POST gate.
// All write a 4xx response on failure and return null so the caller
// can `if (!ctx) return;` immediately.
// ═══════════════════════════════════════════════════════════════════
const { getAuth } = require("./firebase");
const { sendJson } = require("./utils");

function parseBearer(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  if (!/^Bearer\s+/i.test(auth)) return "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function relaxedHttpAuthEnabled() {
  // Auth bypass disabled in production — only allow in Firebase emulator
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.MFX_RELAXED_HTTP_AUTH === 'true') return true;
  return false;
}

function ensurePost(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "POST only" });
    return false;
  }
  return true;
}

async function requireInternalUser(req, res) {
  if (relaxedHttpAuthEnabled()) return { uid: "relaxed-http-auth", email: "relaxed@microflexfilm.com" };
  const token = parseBearer(req);
  if (!token) {
    sendJson(res, 401, { error: "Missing auth token" });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const email = String(decoded.email || "").toLowerCase();
    if (!/@microflexfilm\.com$/.test(email)) {
      sendJson(res, 403, { error: "Internal access only" });
      return null;
    }
    return decoded;
  } catch (err) {
    sendJson(res, 401, { error: "Invalid auth token" });
    return null;
  }
}

// Allows any Firebase-authenticated user (including portal clients)
async function requireAnyUser(req, res) {
  if (relaxedHttpAuthEnabled()) return { uid: "relaxed-http-auth", email: "relaxed@portal.com" };
  const token = parseBearer(req);
  if (!token) {
    sendJson(res, 401, { error: "Missing auth token" });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    sendJson(res, 401, { error: "Invalid auth token" });
    return null;
  }
}

module.exports = {
  parseBearer,
  relaxedHttpAuthEnabled,
  ensurePost,
  requireInternalUser,
  requireAnyUser,
};
