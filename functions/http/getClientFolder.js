// POST /api/getClientFolder
// Internal lookup: given company + quoteNum/jobTicketNum, return the
// per-job folder under MFX-CORE/Clients/<Co>/<Quote|Job#>/. Creates
// the folder tree if it doesn't exist (idempotent on subsequent calls).
const { onRequest } = require("firebase-functions/v2/https");
const { sendJson, safeName, logServerEvent } = require("../lib/utils");
const { ensurePost, requireInternalUser } = require("../lib/auth");
const { getDriveClient, getMFXCoreId, findOrCreateFolder } = require("../lib/drive");
const { DRIVE_NAME } = require("../lib/secrets");

const getClientFolder = onRequest(
  { memory: "256MiB", cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const user = await requireInternalUser(req, res);
    if (!user) return;
    const body = req.body || {};
    const company = body.company || req.query.company;
    const quoteNum = body.quoteNum || req.query.quoteNum;
    const jobTicketNum = body.jobTicketNum || req.query.jobTicketNum;
    if (!company || !(quoteNum || jobTicketNum)) {
      sendJson(res, 400, { error: "company and quoteNum/jobTicketNum required" });
      return;
    }
    try {
      const drive = await getDriveClient();
      const driveId = await getMFXCoreId(drive);
      if (!driveId) {
        sendJson(res, 500, { error: `${DRIVE_NAME} not found` });
        return;
      }
      const cFid = await findOrCreateFolder(drive, "Clients", driveId);
      const coFid = await findOrCreateFolder(drive, safeName(company), cFid.id);
      const rootFolder = await findOrCreateFolder(drive, safeName(jobTicketNum || quoteNum), coFid.id);
      await logServerEvent('ppd.folder.lookup', { company, folderId: rootFolder.id, recordNum: jobTicketNum || quoteNum });
      sendJson(res, 200, {
        folderId: rootFolder.id,
        folderLink: `https://drive.google.com/drive/folders/${rootFolder.id}`,
        path: `${DRIVE_NAME}/Clients/${company}/${jobTicketNum || quoteNum}`
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  }
);

module.exports = { getClientFolder };
