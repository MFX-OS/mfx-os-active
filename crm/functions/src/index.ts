/**
 * Microflex CRM — Cloud Functions barrel export
 *
 * Every Function in this codebase is exported here so `firebase deploy --only functions`
 * picks them up. Keep functions small and single-purpose. Prefer Firestore triggers
 * + scheduled jobs over polling.
 */
import { initializeApp } from 'firebase-admin/app';
initializeApp();

// ---- Auth ----
export { setUserClaims } from './auth/setUserClaims';

// ---- Audit ----
export { onAnyWriteAudit } from './audit/onAnyWrite';

// ---- Intake / value loop ----
export { onSalesOrderConfirmed } from './intake/onSalesOrderConfirmed';

// ---- Production ----
export { onTicketStageComplete } from './production/onTicketStageComplete';
export { onTicketQCFinalized   } from './production/onTicketQCFinalized';

// ---- Workspace integrations ----
export { gmailPushHandler } from './workspace/gmailPushHandler';

// ---- Scheduled jobs ----
export { nightlyHealthScore } from './scheduled/nightlyHealthScore';
export { slaWatcher          } from './scheduled/slaWatcher';

// ---- HTTPS API (rewrites under /api/**) ----
export { api } from './api';
