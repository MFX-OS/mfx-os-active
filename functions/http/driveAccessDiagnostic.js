// POST /api/driveAccessDiagnostic
// Diagnostic: returns the service-account email the function is running
// as, plus the list of shared drives that SA can currently see. Use this
// to figure out who to share MFX-CORE with. Requires internal auth so
// it doesn't leak project info publicly.
const { onRequest } = require("firebase-functions/v2/https");
const { google } = require("googleapis");
const { sendJson } = require("../lib/utils");
const { requireInternalUser } = require("../lib/auth");
const { getDriveClient } = require("../lib/drive");
const { DRIVE_SCOPE, DRIVE_NAME } = require("../lib/secrets");

const driveAccessDiagnostic = onRequest(
  { memory: "256MiB", cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPE });
      const client = await auth.getClient();
      const saEmail = client.email || (client.credentials && client.credentials.client_email) || null;
      const drive = await getDriveClient();
      const list = await drive.drives.list({ pageSize: 100, useDomainAdminAccess: false }).catch(e => ({ data: { drives: [], error: e.message } }));
      const drives = (list.data && list.data.drives) || [];
      const targetFound = drives.find(d => d.name === DRIVE_NAME) || drives.find(d => d.name && d.name.toUpperCase().includes('MFX')) || null;
      sendJson(res, 200, {
        serviceAccountEmail: saEmail,
        target: DRIVE_NAME,
        targetFound: targetFound ? { id: targetFound.id, name: targetFound.name } : null,
        visibleDrives: drives.map(d => ({ id: d.id, name: d.name })),
        listError: list.data && list.data.error ? list.data.error : null,
        instructions: targetFound
          ? `${DRIVE_NAME} is visible. If features still fail, check that the SA has Manager (not just Viewer) access.`
          : `${DRIVE_NAME} is NOT visible to ${saEmail}. Open Google Drive > Shared drives > ${DRIVE_NAME} > Manage members, and add ${saEmail} as Manager.`
      });
    } catch (err) {
      console.error("driveAccessDiagnostic error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

module.exports = { driveAccessDiagnostic };
