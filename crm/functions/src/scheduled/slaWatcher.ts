/**
 * slaWatcher
 *
 * Runs every 30 minutes. Flags:
 *   - Opportunities stale > 7 days at the same stage
 *   - Quotes sent > 5 days with no customer view
 *   - POs past expected_arrival
 *   - Tickets with deadline < 24h that aren't on track
 *
 * Posts a digest to Slack #ops if anything fired.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger }     from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';

export const slaWatcher = onSchedule(
  {
    schedule: 'every 30 minutes',
    region:   'us-west1',
  },
  async () => {
    const db  = getFirestore();
    const now = Date.now();
    const findings: string[] = [];

    // Stale opportunities
    const staleOpps = await db
      .collection('opportunities')
      .where('stage', 'not-in', ['won', 'lost'])
      .get();
    let staleCount = 0;
    staleOpps.forEach((d) => {
      const updated = d.data().updated_at?.toMillis?.() ?? 0;
      if (now - updated > 7 * 86400000) staleCount++;
    });
    if (staleCount > 0) findings.push(`:hourglass_flowing_sand: *${staleCount} opps* stale > 7 days`);

    // Quotes sent but never opened
    const intakeSnap = await db.collection('intake_flows').get();
    let unopened = 0;
    intakeSnap.forEach((d) => {
      const q = d.data().artifacts?.quote;
      if (q?.status === 'sent' && !q.viewedAt) {
        const sent = q.sentAt?.toMillis?.() ?? 0;
        if (now - sent > 5 * 86400000) unopened++;
      }
    });
    if (unopened > 0) findings.push(`:incoming_envelope: *${unopened} quotes* sent > 5d, never opened`);

    // POs past expected arrival
    const poSnap = await db
      .collection('purchase_orders')
      .where('status', '==', 'open')
      .get();
    let latePos = 0;
    poSnap.forEach((d) => {
      const exp = d.data().expected_arrival?.toMillis?.() ?? 0;
      if (exp && now - exp > 0) latePos++;
    });
    if (latePos > 0) findings.push(`:truck: *${latePos} POs* past expected arrival`);

    // Tickets due < 24h
    const ticketSnap = await db.collectionGroup('tickets')
      .where('status', 'in', ['released', 'queued', 'in_progress', 'qc_hold'])
      .get();
    let dueSoon = 0;
    ticketSnap.forEach((d) => {
      const deadline = d.data().planned?.deadline?.toMillis?.() ?? 0;
      if (deadline && deadline - now < 86400000) dueSoon++;
    });
    if (dueSoon > 0) findings.push(`:rotating_light: *${dueSoon} tickets* due in < 24 h`);

    if (findings.length === 0) return;

    logger.info('SLA watcher findings', findings);
    // TODO: post to Slack ops webhook
  }
);
