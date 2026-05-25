'use strict';
// DATA-04 + DATA-05 fix (2026-05-24): expanded quote-write trigger.
//
// Responsibilities:
//   1. Detect every status transition (not just → sent)
//   2. Write an immutable statusHistory subdoc on every status change
//   3. Write an activity log row (server-attributed, not client-trusted)
//   4. Recompute totalAmount from the authoritative qtys[selectedQtyIndex] row,
//      overriding whatever the client wrote (prevents tampering / drift)
//   5. Enqueue quoteAgent for actionable transitions (sent/approved/rejected/expired/accepted)
//
// Loop-safety: the trigger writes back to the same doc only if a real change
// is needed (totalAmount differs). Repeat fire has nothing to patch → no loop.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

// Statuses that trigger an agent run on entry
const AGENT_TRIGGER_STATUSES = ['sent', 'approved', 'rejected', 'expired', 'accepted'];

// Compute the canonical total from a quote's qtys array + selected index.
// Returns null if we can't compute (missing qtys, invalid index, NaN values).
function getCanonicalTotal(quote) {
  if (!quote || !Array.isArray(quote.qtys) || quote.qtys.length === 0) return null;
  let idx = quote.selectedQtyIndex;
  if (typeof idx !== 'number' || idx < 0 || idx >= quote.qtys.length) idx = 0;
  const row = quote.qtys[idx];
  if (!row) return null;
  // Prefer the row's explicit `total`; fall back to qty * ppu
  if (typeof row.total === 'number' && Number.isFinite(row.total)) return row.total;
  const qty = parseFloat(row.qty);
  const ppu = parseFloat(row.ppu);
  if (Number.isFinite(qty) && Number.isFinite(ppu)) return qty * ppu;
  return null;
}

const handler = onDocumentWritten(
  { document: 'quotes/{quoteId}', region: 'us-central1' },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    const quoteId = event.params.quoteId;

    // Deletion: log it, but nothing else to recompute
    if (!afterData) {
      try {
        const db = getFirestore();
        await db.collection('activity').add({
          action: 'quote.deleted',
          detail: `Quote ${(beforeData && beforeData.quoteNum) || quoteId} deleted`,
          user: (beforeData && beforeData.lastModifiedBy) || 'unknown',
          timestamp: new Date().toISOString(),
          source: 'server-trigger',
          quoteId,
        });
      } catch (e) { console.error(`Quote ${quoteId} delete activity log:`, e); }
      return;
    }

    const db = getFirestore();
    const beforeStatus = beforeData ? beforeData.status : null;
    const afterStatus = afterData.status;
    const statusChanged = beforeStatus !== afterStatus;

    // DATA-05: server-recompute totalAmount — overrides whatever client wrote.
    // Loop-safety: only write back if value actually differs.
    const canonical = getCanonicalTotal(afterData);
    const patch = {};
    if (canonical != null && canonical !== afterData.totalAmount) {
      patch.totalAmount = canonical;
      patch.totalValue = canonical; // legacy field — keep in sync
    }
    if (Object.keys(patch).length) {
      try {
        await event.data.after.ref.update(patch);
        console.log(`Quote ${quoteId}: server-recompute totalAmount ${afterData.totalAmount} -> ${canonical}`);
      } catch (e) {
        console.error(`Quote ${quoteId} total patch failed:`, e);
      }
    }

    // DATA-04: status workflow — only fire when status actually changed.
    if (statusChanged) {
      const actor = afterData.lastModifiedBy || afterData.updatedBy || 'system';
      const actorId = afterData.lastModifiedById || afterData.updatedById || null;
      const at = new Date().toISOString();
      const effectiveAmount = (patch.totalAmount != null ? patch.totalAmount : (afterData.totalAmount || afterData.totalValue || null));

      // 1. Immutable status history subdoc (auditable record of every transition)
      try {
        await event.data.after.ref.collection('statusHistory').add({
          from: beforeStatus,
          to: afterStatus,
          by: actor,
          byId: actorId,
          at,
          customerName: afterData.customerName || null,
          quoteNum: afterData.quoteNum || null,
          amount: effectiveAmount,
        });
      } catch (e) { console.error(`Quote ${quoteId} statusHistory write failed:`, e); }

      // 2. Activity log entry (server-attributed — client can't fake source)
      try {
        await db.collection('activity').add({
          action: `quote.status.${afterStatus || 'cleared'}`,
          detail: `Quote ${afterData.quoteNum || quoteId}: ${beforeStatus || '(new)'} -> ${afterStatus || '(cleared)'}`,
          user: actor,
          userId: actorId,
          timestamp: at,
          source: 'server-trigger',
          quoteId,
          customerName: afterData.customerName || null,
          amount: effectiveAmount,
        });
      } catch (e) { console.error(`Quote ${quoteId} activity log failed:`, e); }

      // 3. Agent enqueue for actionable transitions
      if (AGENT_TRIGGER_STATUSES.indexOf(afterStatus) >= 0) {
        try {
          await enqueue('quoteAgent', `quote_${afterStatus}`, {
            sourceCollection: 'quotes',
            sourceId: quoteId,
            customerName: afterData.customerName || null,
            amount: effectiveAmount,
            previousStatus: beforeStatus,
          });
        } catch (e) { console.error(`Quote ${quoteId} agent enqueue failed:`, e); }
      }

      console.log(`Quote ${quoteId}: ${beforeStatus || '(new)'} -> ${afterStatus} by ${actor}`);
    }

    // Note: overdue quote detection still handled by scheduled overdueQuoteSweep
  }
);

module.exports = { onQuoteWrite: handler };
