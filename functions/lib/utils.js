// ═══════════════════════════════════════════════════════════════════
// Generic helpers — JSON response, name sanitization, date utilities,
// audit log writer. No dependencies on Firebase secrets/auth.
// ═══════════════════════════════════════════════════════════════════
const { db, FieldValue } = require("./firebase");

function sendJson(res, code, payload) {
  res.status(code).json(payload);
}

function safeName(input, fallback = "Untitled") {
  const cleaned = String(input || "")
    .replace(/[\\/:*?"<>|#%{}~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function qEscape(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function nowIso() {
  return new Date().toISOString();
}

function daysSinceIso(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

async function logServerEvent(type, payload) {
  try {
    await db.collection("syncEvents").add({
      type,
      payload: payload || {},
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso()
    });
  } catch (err) {
    console.warn("syncEvents log failed:", err.message || err);
  }
}

module.exports = {
  sendJson,
  safeName,
  qEscape,
  nowIso,
  daysSinceIso,
  logServerEvent,
};
