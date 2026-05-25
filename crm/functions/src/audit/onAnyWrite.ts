/**
 * onAnyWriteAudit
 *
 * Wildcard Firestore trigger that appends an entry to /audit_log on every write
 * to any tracked collection. Clients can never write /audit_log directly (rules
 * deny it) — this Function is the only writer.
 *
 * Captures: actor uid, action (create/update/delete), collection, doc id,
 * before/after snapshots, occurred_at.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger }            from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const TRACKED_COLLECTIONS = new Set([
  'companies', 'opportunities', 'intake_flows', 'sales_orders',
  'job_passports', 'production_jobs', 'purchase_orders',
  'shipments', 'invoices', 'products', 'raw_materials', 'art_files',
]);

export const onAnyWriteAudit = onDocumentWritten(
  {
    document: '{collection}/{docId}',
    region:   'us-west1',
  },
  async (event) => {
    const { collection, docId } = event.params;

    // Skip untracked collections + the audit log itself + system docs
    if (!TRACKED_COLLECTIONS.has(collection)) return;

    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    const action = !before ? 'create' : !after ? 'delete' : 'update';

    // Try to identify the actor — Firestore triggers don't include auth context,
    // so we expect callers to set `_lastModifiedBy` (uid) on writes.
    const actorUid =
      after?._lastModifiedBy ||
      before?._lastModifiedBy ||
      'system';

    try {
      await getFirestore().collection('audit_log').add({
        collection,
        doc_id:      docId,
        action,
        actor_uid:   actorUid,
        before:      before ?? null,
        after:       after ?? null,
        occurred_at: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('Failed to write audit log entry', { collection, docId, err });
    }
  }
);
