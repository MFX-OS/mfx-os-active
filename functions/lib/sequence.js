// ═══════════════════════════════════════════════════════════════════
// Server-side sequence allocator. Buckets by YYMM so counters
// reset monthly. systemCounters is rules-locked (server-only write),
// so this is the only legitimate writer.
// Returns { bucket, value, formatted } — caller usually wants `formatted`.
// ═══════════════════════════════════════════════════════════════════
const { db, FieldValue } = require("./firebase");

async function issueSequence(kind, prefix, padLength = 3) {
  const bucket = (() => {
    const d = new Date();
    return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const ref = db.collection("systemCounters").doc(kind);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let seq = 1;
    if (snap.exists) {
      const data = snap.data() || {};
      seq = data.bucket === bucket ? Number(data.value || 0) + 1 : 1;
    }
    tx.set(ref, {
      kind,
      prefix,
      bucket,
      value: seq,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return {
      bucket,
      value: seq,
      formatted: `${prefix}${bucket}-${String(seq).padStart(padLength, "0")}`
    };
  });
  return result;
}

module.exports = { issueSequence };
