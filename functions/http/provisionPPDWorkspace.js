// POST /api/provisionPPDWorkspace
// Stand up the PPD folder tree for a new job: MFX-CORE/Clients/<Co>/
// <Ticket#> · <SKU>/{01_Request, 02_Source_Art, ..., 11_Sync_Audit}.
// Persists the root folder URL on the linked jobTicket and/or blueprint
// so the workspace UI can deep-link. Safe to re-run — find-or-create.
const { onRequest } = require("firebase-functions/v2/https");
const { db } = require("../lib/firebase");
const { sendJson, safeName, nowIso, logServerEvent } = require("../lib/utils");
const { ensurePost, requireInternalUser } = require("../lib/auth");
const { getDriveClient, getMFXCoreId, findOrCreateFolder } = require("../lib/drive");
const { DRIVE_NAME, DEFAULT_PPD_SUBFOLDERS } = require("../lib/secrets");

const provisionPPDWorkspace = onRequest(
  { memory: "256MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const body = req.body || {};
      const company = safeName(body.company, "Client");
      const jobTicketNum = safeName(body.jobTicketNum || body.quoteNum || body.jobId, `JT-${Date.now()}`);
      const skuName = safeName(body.skuName || body.blueprintName || "Job", "Job");
      const drive = await getDriveClient();
      const driveId = await getMFXCoreId(drive);
      if (!driveId) throw new Error(`${DRIVE_NAME} shared drive not found`);

      const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
      const companyFolder = await findOrCreateFolder(drive, company, clientsFolder.id);
      const jobFolderName = `${jobTicketNum} · ${skuName}`;
      const jobFolder = await findOrCreateFolder(drive, jobFolderName, companyFolder.id);

      const createdFolders = {};
      for (const name of DEFAULT_PPD_SUBFOLDERS) {
        const folder = await findOrCreateFolder(drive, name, jobFolder.id);
        createdFolders[name] = {
          id: folder.id,
          url: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`
        };
      }

      if (body.jobTicketId) {
        await db.collection("jobTickets").doc(body.jobTicketId).set({
          updatedAt: nowIso(),
          ppd: {
            driveFolderUrl: `https://drive.google.com/drive/folders/${jobFolder.id}`,
            driveFolderId: jobFolder.id,
            driveFolders: createdFolders,
            provisionedAt: nowIso()
          }
        }, { merge: true });
      }

      if (body.blueprintId) {
        await db.collection("blueprints").doc(body.blueprintId).set({
          updatedAt: nowIso(),
          ppdFolderTemplate: {
            company,
            rootFolderId: jobFolder.id,
            rootFolderUrl: `https://drive.google.com/drive/folders/${jobFolder.id}`
          }
        }, { merge: true });
      }

      await logServerEvent('ppd.workspace.provisioned', { actor: actor.email || '', jobTicketId: body.jobTicketId || '', jobTicketNum: body.jobTicketNum || '', company, rootFolderId: jobFolder.id });
      sendJson(res, 200, {
        success: true,
        driveName: DRIVE_NAME,
        rootFolderId: jobFolder.id,
        rootFolderUrl: `https://drive.google.com/drive/folders/${jobFolder.id}`,
        folders: createdFolders
      });
    } catch (err) {
      console.error("provisionPPDWorkspace error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

module.exports = { provisionPPDWorkspace };
