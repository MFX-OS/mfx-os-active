/**
 * setUserClaims
 *
 * When /users/{uid} is created or its `role` changes, write the role into the
 * user's Auth custom claims. The front-end and Firestore rules read these claims
 * to gate access. Without this Function, role-based access doesn't work.
 *
 * Architecture doc reference: §4 (Roles & permissions) and §11 (Setup).
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger }            from 'firebase-functions/v2';
import { getAuth }           from 'firebase-admin/auth';

const VALID_ROLES = new Set([
  'admin', 'sales_mgr', 'sales', 'cs', 'art', 'buyer',
  'planner', 'operator', 'qc', 'shipping', 'finance', 'exec',
]);

export const setUserClaims = onDocumentWritten(
  {
    document: 'users/{uid}',
    region:   'us-west1',
  },
  async (event) => {
    const uid = event.params.uid;
    const after  = event.data?.after.data();
    const before = event.data?.before.data();

    // Doc deleted — clear claims
    if (!after) {
      await getAuth().setCustomUserClaims(uid, null);
      logger.info(`Cleared claims for ${uid}`);
      return;
    }

    const role     = after.role;
    const dept     = after.department || null;
    const isActive = after.is_active !== false;

    if (!VALID_ROLES.has(role)) {
      logger.warn(`User ${uid} has invalid role "${role}" — claims not updated`);
      return;
    }

    // Skip if nothing relevant changed
    if (
      before &&
      before.role === role &&
      before.department === dept &&
      before.is_active === after.is_active
    ) {
      return;
    }

    const claims = isActive
      ? { role, dept }
      : { role: 'disabled' };  // soft-disable — can't pass any role check

    await getAuth().setCustomUserClaims(uid, claims);
    logger.info(`Set claims for ${uid}`, claims);
  }
);
