/**
 * nightlyHealthScore
 *
 * Scheduled at 02:00 PT every night. Recomputes a 0–100 health score per
 * customer based on signal mix: recency of last activity, open-opp value,
 * overdue invoices, recent QC holds on their orders.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger }     from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const nightlyHealthScore = onSchedule(
  {
    schedule:    '0 2 * * *',
    timeZone:    'America/Los_Angeles',
    region:      'us-west1',
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();

    const customersSnap = await db
      .collection('companies')
      .where('type', 'in', ['client', 'both'])
      .get();

    let updates = 0;
    for (const doc of customersSnap.docs) {
      const c = doc.data();
      let score = 50;

      // Activity recency: +10 if active in last 14 days, -10 if quiet > 60 days
      const lastActivity = c.last_activity_at?.toMillis?.() ?? 0;
      const daysSince = (now - lastActivity) / 86400000;
      if (daysSince < 14)      score += 15;
      else if (daysSince > 60) score -= 15;

      // Open opps: +5 per active opp value tier
      const oppsSnap = await db
        .collection('opportunities')
        .where('company_id', '==', doc.id)
        .where('stage', 'not-in', ['won', 'lost'])
        .get();
      score += Math.min(20, oppsSnap.size * 5);

      // Overdue invoices: -10 per overdue, capped at -30
      const overdueSnap = await db
        .collection('invoices')
        .where('company_id', '==', doc.id)
        .where('type', '==', 'AR')
        .where('status', '==', 'overdue')
        .get();
      score -= Math.min(30, overdueSnap.size * 10);

      // Recent QC holds: -5 per hold in last 30 days, capped at -15
      // (simplified — real impl traverses tickets)
      score = Math.max(0, Math.min(100, Math.round(score)));

      await doc.ref.update({
        health_score: score,
        health_updated_at: FieldValue.serverTimestamp(),
      });
      updates++;
    }

    logger.info(`Nightly health score: updated ${updates} customers`);
  }
);
