/**
 * onTicketQCFinalized
 *
 * Fires when a ticket's qc.result transitions from 'pending' → 'pass' | 'fail' | 'hold'.
 * On pass: render the COA PDF from a Docs template, append it to the passport COA
 * packet in Drive, and create a shipment-readiness task.
 * On fail / hold: notify supervisor + flag the ticket on the dashboard.
 */
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger }            from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const onTicketQCFinalized = onDocumentUpdated(
  {
    document: 'job_passports/{passportId}/tickets/{ticketId}',
    region:   'us-west1',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    const wasPending = before.qc?.result === 'pending';
    const isFinal = ['pass', 'fail', 'hold'].includes(after.qc?.result);
    if (!wasPending || !isFinal) return;

    const db = getFirestore();
    const { passportId, ticketId } = event.params;

    if (after.qc.result === 'pass') {
      // TODO: renderCoaPdf(passportId, ticketId, after.qc.measurements);
      // For now, write a placeholder reference
      await db.doc(`job_passports/${passportId}/tickets/${ticketId}`).update({
        'qc.coa_drive_id': `pending-${ticketId}.pdf`,
        _lastModifiedBy: 'system',
      });

      // Create a shipment-readiness task for shipping team
      await db.collection('tasks').add({
        title: `Ship ready — ${ticketId}`,
        description: `Ticket QC pass. Verify packout and stage for outbound.`,
        assignee_role: 'shipping',
        priority: 'high',
        parent: { collection: 'tickets', id: ticketId, passport_id: passportId },
        status: 'open',
        created_at: FieldValue.serverTimestamp(),
        _lastModifiedBy: 'system',
      });

      logger.info(`Ticket ${ticketId} QC pass — COA pending render, ship task created`);
    } else if (after.qc.result === 'hold' || after.qc.result === 'fail') {
      // Block downstream operations and create a disposition task
      await db.collection('tasks').add({
        title: `QC ${after.qc.result.toUpperCase()} — ${ticketId} requires disposition`,
        description: after.qc.note || 'QC outcome blocked further processing.',
        assignee_role: 'qc',
        priority: 'high',
        parent: { collection: 'tickets', id: ticketId, passport_id: passportId },
        status: 'open',
        created_at: FieldValue.serverTimestamp(),
        _lastModifiedBy: 'system',
      });

      logger.warn(`Ticket ${ticketId} QC ${after.qc.result} — disposition task created`);
    }
  }
);
