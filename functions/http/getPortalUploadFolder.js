// POST /api/getPortalUploadFolder
// Portal client requests an upload folder for files larger than the
// 50MB Cloud Function cap. We create/find the per-quote sub-folder,
// share it with the client's email as a writer, and return the link.
// The client uploads directly to Drive; files appear in the same
// /Clients/<Co>/<Quote#>/<PO|Art>/ tree as direct uploads.
const { onRequest } = require("firebase-functions/v2/https");
const { db } = require("../lib/firebase");
const { sendJson, safeName, nowIso, logServerEvent } = require("../lib/utils");
const { ensurePost, requireAnyUser } = require("../lib/auth");
const { enforceRateLimit } = require("../lib/rateLimit");
const { getDriveClient, getMFXCoreId, findOrCreateFolder } = require("../lib/drive");
const { DRIVE_NAME } = require("../lib/secrets");

const getPortalUploadFolder = onRequest(
  { memory: "256MiB", cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const user = await requireAnyUser(req, res);
    if (!user) return;
    if (!user.email) { sendJson(res, 403, { error: "User email required to share folder" }); return; }
    if (!(await enforceRateLimit(req, res, user.uid, "getPortalUploadFolder", 5, 60000))) return;

    const body = req.body || {};
    const quoteId = body.quoteId;
    const fileType = body.fileType;
    if (!quoteId || !fileType) {
      sendJson(res, 400, { error: "quoteId and fileType required" });
      return;
    }
    if (fileType !== "PO" && fileType !== "Art") {
      sendJson(res, 400, { error: "fileType must be 'PO' or 'Art'" });
      return;
    }

    const userEmail = String(user.email).toLowerCase();
    const isInternal = /@microflexfilm\.com$/.test(userEmail);

    let quoteDoc;
    try {
      quoteDoc = await db.collection("quotes").doc(quoteId).get();
    } catch (err) {
      sendJson(res, 500, { error: "Quote lookup failed: " + err.message });
      return;
    }
    if (!quoteDoc.exists) { sendJson(res, 404, { error: "Quote not found" }); return; }
    const quote = quoteDoc.data() || {};
    const fields = quote.fields || {};
    const custEmail = String(fields.custEmail || "").toLowerCase();
    const poEmail = String(quote.poClientEmail || "").toLowerCase();

    // Portal user must match the quote's customer email (same gate as
    // portal.html quote-load check at line 409). Staff always allowed.
    if (!isInternal && userEmail !== custEmail && userEmail !== poEmail) {
      sendJson(res, 403, { error: "Email does not match this quote's customer contact" });
      return;
    }

    const company = fields.custCo || "Unknown";
    const quoteNum = quote.quoteNum || quoteId;

    try {
      const drive = await getDriveClient();
      const driveId = await getMFXCoreId(drive);
      if (!driveId) { sendJson(res, 500, { error: `${DRIVE_NAME} shared drive not found` }); return; }

      const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
      const companyFolder = await findOrCreateFolder(drive, safeName(company), clientsFolder.id);
      const rootFolder = await findOrCreateFolder(drive, safeName(quoteNum), companyFolder.id);
      const typeFolder = await findOrCreateFolder(drive, safeName(fileType), rootFolder.id);

      // Share folder with the user's email as writer.
      // sendNotificationEmail:true so they get a Drive invitation with the link.
      // If the permission already exists (re-request), Drive returns 409 — log and continue.
      let shareError = null;
      try {
        await drive.permissions.create({
          fileId: typeFolder.id,
          supportsAllDrives: true,
          sendNotificationEmail: true,
          emailMessage: `Upload large files for ${company} quote ${quoteNum} (${fileType}) here. Files dropped in this folder sync to the MFX OS automatically.`,
          requestBody: {
            type: "user",
            role: "writer",
            emailAddress: userEmail
          }
        });
      } catch (err) {
        const msg = (err && err.message) || String(err);
        // Permission already exists is fine — folder was previously shared
        if (msg.indexOf('already exists') === -1 && msg.indexOf('duplicate') === -1) {
          shareError = msg;
          console.warn(`[Drive] Share ${typeFolder.id} with ${userEmail} failed: ${msg}`);
        }
      }

      const link = `https://drive.google.com/drive/folders/${typeFolder.id}`;

      // Persist on the quote so portal reload can show the link without
      // re-issuing the share (Drive will email them again otherwise).
      const fieldName = fileType === "PO" ? "poUploadFolder" : "artUploadFolder";
      try {
        await db.collection("quotes").doc(quoteId).set({
          [fieldName]: {
            folderId: typeFolder.id,
            link,
            sharedWith: userEmail,
            sharedAt: nowIso()
          },
          updatedAt: nowIso()
        }, { merge: true });
      } catch (err) {
        console.warn("Failed to persist upload folder on quote:", err.message);
      }

      await logServerEvent('portal.folder.shared', {
        quoteId, quoteNum, company, fileType,
        folderId: typeFolder.id, sharedWith: userEmail,
        shareError: shareError || null
      });

      sendJson(res, 200, {
        success: true,
        folderId: typeFolder.id,
        link,
        sharedWith: userEmail,
        path: `${DRIVE_NAME}/Clients/${company}/${quoteNum}/${fileType}`,
        shareWarning: shareError
      });
    } catch (err) {
      console.error("getPortalUploadFolder error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

module.exports = { getPortalUploadFolder };
