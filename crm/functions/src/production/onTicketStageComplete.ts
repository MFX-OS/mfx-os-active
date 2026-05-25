/**
 * onTicketStageComplete
 *
 * Fires when a route stage on a ticket transitions to status='done'. Rolls actuals
 * up to the parent passport, advances the next stage to 'queued' (if not already),
 * and notifies #prod-floor on Slack if the ticket is now complete.
 */
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger }            from 'firebase-functions/v2';
import { defineSecret }      from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const slackProdFloor = defineSecret('slack-webhook-prod-floor');

export const onTicketStageComplete = onDocumentUpdated(
  {
    document: 'job_passports/{passportId}/tickets/{ticketId}',
    region:   'us-west1',
    secrets:  [slackProdFloor],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    const beforeRoute = before.route ?? [];
    const afterRoute  = after.route ?? [];

    // Detect a stage that just transitioned to "done"
    const advanced = afterRoute.find((r: any, i: number) =>
      r.status === 'done' && beforeRoute[i]?.status !== 'done'
    );
    if (!advanced) return;

    const db = getFirestore();
    const { passportId, ticketId } = event.params;

    // If all stages done, mark ticket complete
    const allDone = afterRoute.every((r: any) => r.status === 'done');
    if (allDone && after.status !== 'complete') {
      await db.doc(`job_passports/${passportId}/tickets/${ticketId}`).update({
        status: 'complete',
        completed_at: FieldValue.serverTimestamp(),
        _lastModifiedBy: 'system',
      });

      // Roll up to passport
      const passportRef = db.doc(`job_passports/${passportId}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(passportRef);
        const data = snap.data();
        if (!data) return;
        const next = (data.rollup?.tickets_complete ?? 0) + 1;
        const total = data.rollup?.ticket_count ?? 0;
        tx.update(passportRef, {
          'rollup.tickets_complete': next,
          status: next >= total ? 'complete' : 'in_production',
        });
      });

      // Slack notify
      const webhook = slackProdFloor.value();
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `:white_check_mark: Ticket ${ticketId} complete · passport ${passportId}`,
          }),
        }).catch((err) => logger.warn('Slack notify failed', err));
      }
    }

    logger.info(`Ticket ${ticketId} stage advanced → ${advanced.stage}`);
  }
);
