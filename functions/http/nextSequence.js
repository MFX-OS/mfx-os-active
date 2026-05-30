// POST /api/nextSequence
// Server-side sequence allocator — sole writer of systemCounters (the
// collection is rules-locked). Maps high-level kinds (quote, salesOrder,
// jobTicket, vendorPO, …) to prefix + padding. Rate-limited per user.
// DATA-15 follow-up (2026-05-24): bumped from 10/min to 30/min so bulk
// quote creation (e.g. importing a stack of RFQs in one session) doesn't
// hit the wall. Still abuse-proof: server is the sole source of sequence
// numbers, so even at 30/min an attacker can only burn ~1800 numbers/hr
// and we'd see it in audit logs immediately.
const { onRequest } = require("firebase-functions/v2/https");
const { sendJson, logServerEvent } = require("../lib/utils");
const { ensurePost, requireInternalUser } = require("../lib/auth");
const { enforceRateLimit } = require("../lib/rateLimit");
const { issueSequence } = require("../lib/sequence");

const nextSequence = onRequest(
  { memory: "256MiB", timeoutSeconds: 60, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "nextSequence", 30, 60000))) return;
    try {
      const kindMap = {
        quote: { kind: "quote", prefix: "MF" },
        salesOrder: { kind: "salesOrder", prefix: "SO" },
        jobPassport: { kind: "jobPassport", prefix: "JP" },
        jobTicket: { kind: "jobTicket", prefix: "JT" },
        ppdTicket: { kind: "ppdTicket", prefix: "PPD" },
        proof: { kind: "proof", prefix: "PR" },
        plateIncident: { kind: "plateIncident", prefix: "PI" },
        vendorPO: { kind: "vendorPO", prefix: "VPO" }
      };
      const requested = (req.body && req.body.kind) || "jobTicket";
      const cfg = kindMap[requested] || { kind: requested, prefix: String((req.body && req.body.prefix) || "ID").toUpperCase() };
      const result = await issueSequence(cfg.kind, cfg.prefix, Number((req.body && req.body.padLength) || 3));
      await logServerEvent('sequence.issued', { actor: actor.email || '', kind: cfg.kind, formatted: result.formatted });
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      console.error("nextSequence error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

module.exports = { nextSequence };
