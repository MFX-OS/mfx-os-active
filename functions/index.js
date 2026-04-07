const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { google } = require("googleapis");
const Busboy = require("busboy");
const path = require("path");
const os = require("os");
const fs = require("fs");

initializeApp();
const db = getFirestore();

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"];
const GMAIL_SCOPE = ["https://www.googleapis.com/auth/gmail.readonly"];
const DRIVE_NAME = "MFX-CORE";
const DEFAULT_PPD_SUBFOLDERS = [
  "01_Request",
  "02_Source_Art",
  "03_Working_Files",
  "04_Proofs",
  "05_Approvals",
  "06_Plates_Tools",
  "07_Released",
  "08_Obsolete",
  "09_Issues_CAPA",
  "10_Master_Regs_Exports",
  "11_Sync_Audit"
];

function sendJson(res, code, payload) {
  res.status(code).json(payload);
}

function ensurePost(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "POST only" });
    return false;
  }
  return true;
}

function safeName(input, fallback = "Untitled") {
  const cleaned = String(input || "")
    .replace(/[\\/:*?"<>|#%{}~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function qEscape(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function nowIso() {
  return new Date().toISOString();
}


function parseBearer(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  if (!/^Bearer\s+/i.test(auth)) return "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function relaxedHttpAuthEnabled() {
  // Auth bypass disabled in production — only allow in Firebase emulator
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.MFX_RELAXED_HTTP_AUTH === 'true') return true;
  return false;
}

async function requireInternalUser(req, res) {
  if (relaxedHttpAuthEnabled()) return { uid: "relaxed-http-auth", email: "relaxed@microflexfilm.com" };
  const token = parseBearer(req);
  if (!token) {
    sendJson(res, 401, { error: "Missing auth token" });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const email = String(decoded.email || "").toLowerCase();
    if (!/@microflexfilm\.com$/.test(email)) {
      sendJson(res, 403, { error: "Internal access only" });
      return null;
    }
    return decoded;
  } catch (err) {
    sendJson(res, 401, { error: "Invalid auth token" });
    return null;
  }
}

// Allows any Firebase-authenticated user (including portal clients)
async function requireAnyUser(req, res) {
  if (relaxedHttpAuthEnabled()) return { uid: "relaxed-http-auth", email: "relaxed@portal.com" };
  const token = parseBearer(req);
  if (!token) {
    sendJson(res, 401, { error: "Missing auth token" });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    sendJson(res, 401, { error: "Invalid auth token" });
    return null;
  }
}

async function logServerEvent(type, payload) {
  try {
    await db.collection("syncEvents").add({
      type,
      payload: payload || {},
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso()
    });
  } catch (err) {
    console.warn("syncEvents log failed:", err.message || err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER — Firestore-backed sliding window per user+action
// ═══════════════════════════════════════════════════════════════════
const _rateLimitCache = new Map(); // in-memory fast check

async function checkRateLimit(uid, action, maxPerWindow, windowMs) {
  windowMs = windowMs || 60000; // default 1 minute
  const key = `${uid}:${action}`;
  const now = Date.now();

  // Fast in-memory check first
  const cached = _rateLimitCache.get(key);
  if (cached && cached.count >= maxPerWindow && (now - cached.windowStart) < windowMs) {
    return false; // rate limited
  }

  // Firestore persistent check for cross-instance consistency
  const ref = db.collection("_rateLimits").doc(key);
  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : { count: 0, windowStart: now };

      if ((now - data.windowStart) >= windowMs) {
        // Window expired — reset
        tx.set(ref, { count: 1, windowStart: now, uid, action, updatedAt: FieldValue.serverTimestamp() });
        _rateLimitCache.set(key, { count: 1, windowStart: now });
        return true;
      }

      if (data.count >= maxPerWindow) {
        return false; // rate limited
      }

      tx.update(ref, { count: data.count + 1, updatedAt: FieldValue.serverTimestamp() });
      _rateLimitCache.set(key, { count: data.count + 1, windowStart: data.windowStart });
      return true;
    });
    return result;
  } catch (err) {
    console.warn("Rate limit check failed, allowing:", err.message);
    return true; // fail open
  }
}

async function enforceRateLimit(req, res, uid, action, maxPerWindow, windowMs) {
  const allowed = await checkRateLimit(uid, action, maxPerWindow, windowMs);
  if (!allowed) {
    sendJson(res, 429, { error: "Rate limit exceeded. Please try again later." });
    return false;
  }
  return true;
}

function getDelegatedGmailClient(mailbox) {
  const raw = process.env.GMAIL_SERVICE_ACCOUNT_JSON || "";
  if (!raw || !mailbox) return null;
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    GMAIL_SCOPE,
    mailbox
  );
  return google.gmail({ version: "v1", auth });
}


async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPE });
  return google.drive({ version: "v3", auth });
}

function getOAuthClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

async function getGmailClient(accessToken) {
  const auth = getOAuthClient(accessToken);
  return google.gmail({ version: "v1", auth });
}

async function getMFXCoreId(drive) {
  const r = await drive.drives.list({ pageSize: 100, useDomainAdminAccess: false });
  console.log('[Drive] Found drives:', (r.data.drives || []).map(d => d.name));
  const d = (r.data.drives || []).find((x) => x.name === DRIVE_NAME);
  if (!d) {
    // Try case-insensitive / partial match
    const partial = (r.data.drives || []).find((x) => x.name.toUpperCase().includes('MFX'));
    if (partial) { console.log('[Drive] Partial match:', partial.name); return partial.id; }
  }
  return d ? d.id : null;
}

async function findFolder(drive, name, parentId) {
  const q = [
    `name='${qEscape(name)}'`,
    "mimeType='application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    "trashed=false"
  ].join(" and ");
  const r = await drive.files.list({
    q,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
    fields: "files(id,name,webViewLink)"
  });
  return (r.data.files || [])[0] || null;
}

async function createFolder(drive, name, parentId) {
  const c = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    },
    supportsAllDrives: true,
    fields: "id,name,webViewLink"
  });
  return c.data;
}

async function findOrCreateFolder(drive, name, parentId) {
  const existing = await findFolder(drive, name, parentId);
  if (existing) return existing;
  return createFolder(drive, name, parentId);
}

async function issueSequence(kind, prefix, padLength = 3) {
  const bucket = (() => {
    const d = new Date();
    return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const ref = db.collection("systemCounters").doc(kind);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let seq = 1;
    if (snap.exists) {
      const data = snap.data() || {};
      seq = data.bucket === bucket ? Number(data.value || 0) + 1 : 1;
    }
    tx.set(ref, {
      kind,
      prefix,
      bucket,
      value: seq,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return {
      bucket,
      value: seq,
      formatted: `${prefix}${bucket}-${String(seq).padStart(padLength, "0")}`
    };
  });
  return result;
}

function parseEmailAddress(raw) {
  const value = String(raw || "");
  const m = value.match(/<([^>]+)>/);
  const email = (m ? m[1] : value).trim();
  const name = value.replace(/<[^>]+>/, "").replace(/\"/g, "").trim();
  return { email, name: name || email };
}

function deriveCompanyFromMessage(subject, from) {
  const candidates = [subject, from]
    .filter(Boolean)
    .join(" | ")
    .replace(/RE:|FW:|FWD:/gi, "")
    .split(/[|\-–—]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return candidates[0] || "";
}

async function upsertPrepressInboxRecord(payload) {
  const ref = db.collection("prepressInbox").doc(payload.id);
  const existing = await ref.get();
  const body = {
    ...payload,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!existing.exists) body.createdAt = FieldValue.serverTimestamp();
  await ref.set(body, { merge: true });
  return !existing.exists;
}

exports.uploadToDrive = onRequest(
  { memory: "512MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    // Accept any authenticated Firebase user (internal + portal clients)
    const user = await requireAnyUser(req, res);
    if (!user) return;
    if (!(await enforceRateLimit(req, res, user.uid, "uploadToDrive", 10, 60000))) return;

    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const fileData = { path: null, name: null, mime: null, buffer: null };

    busboy.on("field", (name, val) => { fields[name] = val; });
    busboy.on("file", (_fieldname, file, info) => {
      fileData.name = info.filename;
      fileData.mime = info.mimeType || "application/octet-stream";
      const safeFileName = safeName(fileData.name || 'upload');
      fileData.path = path.join(os.tmpdir(), `${Date.now()}_${safeFileName}`);
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => { fileData.buffer = Buffer.concat(chunks); });
      file.pipe(fs.createWriteStream(fileData.path));
    });

    busboy.on("finish", async () => {
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      if (fileData.buffer && fileData.buffer.length > MAX_FILE_SIZE) {
        if (fileData.path && fs.existsSync(fileData.path)) fs.unlinkSync(fileData.path);
        return res.status(413).json({ error: 'File too large. Maximum 50MB.' });
      }
      if (!fileData.path || !fields.company || !(fields.quoteNum || fields.jobTicketNum) || !fields.fileType) {
        sendJson(res, 400, { error: "Missing fields" });
        return;
      }
      try {
        const drive = await getDriveClient();
        const driveId = await getMFXCoreId(drive);
        if (!driveId) {
          sendJson(res, 500, { error: `${DRIVE_NAME} shared drive not found` });
          return;
        }

        const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
        const companyFolder = await findOrCreateFolder(drive, safeName(fields.company), clientsFolder.id);
        const rootKey = safeName(fields.jobTicketNum || fields.quoteNum);
        const rootFolder = await findOrCreateFolder(drive, rootKey, companyFolder.id);
        const typeFolder = await findOrCreateFolder(drive, safeName(fields.fileType), rootFolder.id);

        const driveFile = await drive.files.create({
          requestBody: { name: safeName(fileData.name || 'upload'), parents: [typeFolder.id], mimeType: fileData.mime },
          media: { mimeType: fileData.mime, body: fs.createReadStream(fileData.path) },
          supportsAllDrives: true,
          fields: "id, webViewLink"
        });
        fs.unlinkSync(fileData.path);
        const link = driveFile.data.webViewLink || `https://drive.google.com/file/d/${driveFile.data.id}`;

        if (fields.quoteId) {
          const ref = db.collection("quotes").doc(fields.quoteId);
          const doc = await ref.get();
          if (doc.exists) {
            const compat = fields.fileType === "PO" ? "poFiles" : "artFiles";
            const arr = doc.data()[compat] || [];
            arr.push({
              name: fileData.name,
              url: link,
              driveId: driveFile.data.id,
              uploadedAt: nowIso(),
              folderId: typeFolder.id
            });
            await ref.set({ [compat]: arr, updatedAt: nowIso() }, { merge: true });
          }
        }

        if (fields.jobTicketId) {
          await db.collection("jobTickets").doc(fields.jobTicketId).set({
            updatedAt: nowIso(),
            ppd: {
              driveFolderUrl: `https://drive.google.com/drive/folders/${rootFolder.id}`,
              lastUploadedFile: {
                name: fileData.name,
                driveId: driveFile.data.id,
                driveLink: link,
                fileType: fields.fileType,
                uploadedAt: nowIso()
              }
            }
          }, { merge: true });
        }

        await logServerEvent('ppd.file.uploaded', { company: fields.company, recordNum: fields.jobTicketNum || fields.quoteNum || '', fileType: fields.fileType, driveId: driveFile.data.id, rootFolderId: rootFolder.id });
        sendJson(res, 200, {
          success: true,
          name: fileData.name,
          driveId: driveFile.data.id,
          driveLink: link,
          rootFolderId: rootFolder.id,
          folder: `${DRIVE_NAME}/Clients/${fields.company}/${rootKey}/${fields.fileType}`
        });
      } catch (err) {
        if (fileData.path && fs.existsSync(fileData.path)) fs.unlinkSync(fileData.path);
        console.error("Upload error:", err);
        sendJson(res, 500, { error: err.message });
      }
    });
    busboy.end(req.rawBody);
  }
);

// Portal upload — accessible by any authenticated user (clients via magic link)
exports.portalUploadToDrive = onRequest(
  { memory: "512MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const user = await requireAnyUser(req, res);
    if (!user) return;
    if (!(await enforceRateLimit(req, res, user.uid, "portalUpload", 10, 60000))) return;

    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const fileData = { path: null, name: null, mime: null, buffer: null };

    busboy.on("field", (name, val) => { fields[name] = val; });
    busboy.on("file", (_fieldname, file, info) => {
      fileData.name = info.filename;
      fileData.mime = info.mimeType || "application/octet-stream";
      const safeFileName = safeName(fileData.name || 'upload');
      fileData.path = path.join(os.tmpdir(), `${Date.now()}_${safeFileName}`);
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => { fileData.buffer = Buffer.concat(chunks); });
      file.pipe(fs.createWriteStream(fileData.path));
    });

    busboy.on("finish", async () => {
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB for portal
      if (fileData.buffer && fileData.buffer.length > MAX_FILE_SIZE) {
        if (fileData.path && fs.existsSync(fileData.path)) fs.unlinkSync(fileData.path);
        return res.status(413).json({ error: 'File too large. Maximum 25MB.' });
      }
      if (!fileData.path || !fields.company || !fields.quoteNum || !fields.fileType) {
        sendJson(res, 400, { error: "Missing fields" });
        return;
      }
      try {
        const drive = await getDriveClient();
        const driveId = await getMFXCoreId(drive);
        if (!driveId) {
          sendJson(res, 500, { error: `${DRIVE_NAME} shared drive not found` });
          return;
        }

        const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
        const companyFolder = await findOrCreateFolder(drive, safeName(fields.company), clientsFolder.id);
        const rootFolder = await findOrCreateFolder(drive, safeName(fields.quoteNum), companyFolder.id);
        const typeFolder = await findOrCreateFolder(drive, safeName(fields.fileType), rootFolder.id);

        const driveFile = await drive.files.create({
          requestBody: { name: safeName(fileData.name || 'upload'), parents: [typeFolder.id], mimeType: fileData.mime },
          media: { mimeType: fileData.mime, body: fs.createReadStream(fileData.path) },
          supportsAllDrives: true,
          fields: "id,webViewLink"
        });

        if (fileData.path && fs.existsSync(fileData.path)) fs.unlinkSync(fileData.path);
        const link = driveFile.data.webViewLink || `https://drive.google.com/file/d/${driveFile.data.id}/view`;

        // Update quote doc with file info
        if (fields.quoteId) {
          const ref = db.collection("quotes").doc(fields.quoteId);
          const compat = fields.fileType === 'PO' ? 'poFiles' : 'artFiles';
          const docSnap = await ref.get();
          const arr = docSnap.exists && docSnap.data()[compat] ? docSnap.data()[compat] : [];
          arr.push({ name: fileData.name, url: link, driveId: driveFile.data.id, driveLink: link, uploadedAt: nowIso(), uploadedBy: user.email || 'portal' });
          await ref.set({ [compat]: arr, updatedAt: nowIso() }, { merge: true });
        }

        await logServerEvent('portal.file.uploaded', { company: fields.company, quoteNum: fields.quoteNum, fileType: fields.fileType, driveId: driveFile.data.id, uploadedBy: user.email || 'portal' });
        sendJson(res, 200, {
          success: true,
          name: fileData.name,
          driveId: driveFile.data.id,
          driveLink: link,
          rootFolderId: rootFolder.id,
          folder: `${DRIVE_NAME}/Clients/${fields.company}/${fields.quoteNum}/${fields.fileType}`
        });
      } catch (err) {
        if (fileData.path && fs.existsSync(fileData.path)) fs.unlinkSync(fileData.path);
        console.error("Portal upload error:", err);
        sendJson(res, 500, { error: err.message });
      }
    });
    busboy.end(req.rawBody);
  }
);

exports.getClientFolder = onRequest(
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

exports.nextSequence = onRequest(
  { memory: "256MiB", timeoutSeconds: 60, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "nextSequence", 10, 60000))) return;
    try {
      const kindMap = {
        quote: { kind: "quote", prefix: "MF" },
        salesOrder: { kind: "salesOrder", prefix: "SO" },
        jobPassport: { kind: "jobPassport", prefix: "JP" },
        jobTicket: { kind: "jobTicket", prefix: "JT" },
        ppdTicket: { kind: "ppdTicket", prefix: "PPD" },
        proof: { kind: "proof", prefix: "PR" },
        plateIncident: { kind: "plateIncident", prefix: "PI" },
        vendorPO: { kind: "vendorPO", prefix: "VPO" }
      };
      const requested = (req.body && req.body.kind) || "jobTicket";
      const cfg = kindMap[requested] || { kind: requested, prefix: String((req.body && req.body.prefix) || "ID").toUpperCase() };
      const result = await issueSequence(cfg.kind, cfg.prefix, Number((req.body && req.body.padLength) || 3));
      await logServerEvent('sequence.issued', { actor: actor.email || '', kind: cfg.kind, formatted: result.formatted });
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      console.error("nextSequence error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

exports.provisionPPDWorkspace = onRequest(
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

exports.ingestSharedInbox = onRequest(
  { memory: "256MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const body = req.body || {};
      // accessToken accepted for backward compat but prefer delegated service account
      const accessToken = body.accessToken;
      const mailbox = String(body.mailbox || body.inboxEmail || '').trim();
      const query = String(body.query || body.gmailQuery || "label:inbox is:unread");
      const maxResults = Math.max(1, Math.min(Number(body.maxResults || 15), 50));
      let gmail = null;
      // Prefer delegated service account (no user token needed)
      if (mailbox) gmail = getDelegatedGmailClient(mailbox);
      if (!gmail) {
        if (!accessToken) throw new Error("Configure GMAIL_SERVICE_ACCOUNT_JSON with domain-wide delegation, or provide accessToken");
        gmail = await getGmailClient(accessToken);
      }
      const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
      const messages = list.data.messages || [];
      let created = 0;
      let updated = 0;

      for (const msg of messages) {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "To", "Date"]
        });
        const payload = detail.data || {};
        const headers = payload.payload && payload.payload.headers ? payload.payload.headers : [];
        const header = (name) => (headers.find((h) => h.name === name) || {}).value || "";
        const fromRaw = header("From");
        const toRaw = header("To");
        const subject = header("Subject") || "New Email";
        const fromParts = parseEmailAddress(fromRaw);
        const receivedAt = payload.internalDate ? new Date(Number(payload.internalDate)).toISOString() : nowIso();
        const record = {
          id: msg.id,
          provider: "gmail",
          source: mailbox ? "sharedMailbox" : "sharedInbox",
          gmailMessageId: msg.id,
          gmailThreadId: payload.threadId || msg.threadId || "",
          subject,
          snippet: payload.snippet || "",
          from: fromRaw,
          fromEmail: fromParts.email,
          fromName: fromParts.name,
          to: toRaw,
          company: body.company || deriveCompanyFromMessage(subject, fromParts.name),
          mailbox: mailbox || 'me',
          priority: "normal",
          status: "new",
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
          receivedAt,
          ingestQuery: query,
          assignedDept: "Pre-Press",
          linkedJobTicketId: "",
          linkedRequestId: ""
        };
        const wasCreated = await upsertPrepressInboxRecord(record);
        if (wasCreated) created += 1; else updated += 1;
      }

      await logServerEvent('ppd.inbox.ingested', { actor: actor.email || '', mailbox: mailbox || 'me', query, scanned: messages.length, created, updated });
      sendJson(res, 200, {
        success: true,
        mailbox: mailbox || 'me',
        query,
        scanned: messages.length,
        created,
        updated
      });
    } catch (err) {
      console.error("ingestSharedInbox error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// CEO APPROVE — Server-side quote/SO approval with role verification
// ═══════════════════════════════════════════════════════════════════
exports.ceoApprove = onRequest(
  { memory: "256MiB", timeoutSeconds: 60, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "ceoApprove", 20, 60000))) return;
    try {
      const { docId, collection, action, note } = req.body || {};
      if (!docId || !collection || !action) {
        return sendJson(res, 400, { error: "docId, collection, and action are required" });
      }
      if (!['quotes', 'salesOrders', 'vendorPOs'].includes(collection)) {
        return sendJson(res, 400, { error: "Invalid collection" });
      }
      if (!['approve', 'reject'].includes(action)) {
        return sendJson(res, 400, { error: "Invalid action" });
      }
      // Verify role server-side
      const userDoc = await db.collection("users").doc(actor.uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userRole = (userData.role || "").toLowerCase();
      const userDept = (userData.dept || "").toLowerCase();
      const approvedRoles = ["ceo", "admin", "administrator", "owner", "operations manager", "manager"];
      const approvedDepts = ["operations", "administration"];
      if (!approvedRoles.includes(userRole) && !approvedDepts.includes(userDept)) {
        return sendJson(res, 403, { error: "Insufficient role for approval" });
      }
      const docRef = db.collection(collection).doc(docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return sendJson(res, 404, { error: "Document not found" });
      const now = new Date().toISOString();
      const update = { updatedAt: now, updatedBy: actor.email };
      if (action === "approve") {
        update.status = collection === "quotes" ? "ready" : "approved";
        update.approvedBy = actor.email;
        update.approvedAt = now;
        if (note) update.approvalNote = note;
        // VPO-specific: add approval tier metadata
        if (collection === "vendorPOs") {
          const vpoData = docSnap.data();
          const total = vpoData.total || 0;
          update.approvalTier = total <= 500 ? "Self-Approved" : total <= 2500 ? "Manager-Approved" : "CEO-Approved";
        }
      } else {
        update.status = "rejected";
        update.rejectedBy = actor.email;
        update.rejectedAt = now;
        if (note) update.rejectionReason = note;
      }
      // Sanitize note to prevent stored XSS
      if (update.approvalNote) update.approvalNote = String(update.approvalNote).replace(/<[^>]*>/g, '').substring(0, 500);
      if (update.rejectionReason) update.rejectionReason = String(update.rejectionReason).replace(/<[^>]*>/g, '').substring(0, 500);
      await docRef.update(update);
      await logServerEvent("ceo." + action, { actor: actor.email, collection, docId, status: update.status, note: note || "" });
      sendJson(res, 200, { success: true, action, status: update.status, approvedBy: actor.email });
    } catch (err) {
      console.error("ceoApprove error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// TRANSITION STATUS — Server-side state machine enforcement
// Validates ALL status/stage transitions for quotes, SOs, PPD, jobs
// ═══════════════════════════════════════════════════════════════════

const STATE_MACHINES = {
  // Quote lifecycle
  quotes: {
    field: "status",
    transitions: {
      "draft": ["approval", "archived"],
      "approval": ["ready", "rejected"],
      "rejected": ["draft", "approval", "archived"],
      "ready": ["sent", "draft", "archived"],
      "sent": ["won", "lost", "draft", "archived"],
      "won": ["archived"],
      "lost": ["draft", "archived"],
      "archived": ["draft"]
    },
    roleGates: {
      "ready": ["ceo", "admin", "administrator", "owner", "operations manager", "manager"]
    }
  },
  // Sales Order lifecycle
  salesOrders: {
    field: "status",
    transitions: {
      "pending": ["approved", "rejected", "cancelled"],
      "approved": ["sent", "cancelled"],
      "rejected": ["pending", "cancelled"],
      "sent": ["fulfilled", "cancelled"],
      "fulfilled": ["closed"],
      "cancelled": [],
      "closed": []
    },
    roleGates: {
      "approved": ["ceo", "admin", "administrator", "owner", "operations manager", "manager"]
    }
  },
  // Job Ticket lifecycle
  jobTickets: {
    field: "status",
    transitions: {
      "open": ["prepress", "running", "closed"],
      "prepress": ["running", "open", "closed"],
      "running": ["qa", "prepress", "closed"],
      "qa": ["closed", "running"],
      "closed": ["open"]
    },
    // Server-side sanitation gate: QC transition requires sanitation clearance
    asyncGates: {
      "qa": { checkSanitation: true }
    }
  },
  // PPD Stage lifecycle
  "jobTickets.ppd": {
    field: "ppd.stage",
    transitions: {
      "Intake": ["Validation", "Blocked"],
      "Validation": ["Art Review", "Intake", "Blocked"],
      "Art Review": ["Engineering", "Validation", "Blocked"],
      "Engineering": ["File Prep", "Art Review", "Blocked"],
      "File Prep": ["Proof Ready", "Engineering", "Blocked"],
      "Proof Ready": ["Proof Sent", "File Prep", "Blocked"],
      "Proof Sent": ["Waiting Approval", "Proof Ready", "Blocked"],
      "Waiting Approval": ["Revision Needed", "Plate Ready", "Blocked"],
      "Revision Needed": ["Art Review", "File Prep", "Proof Ready", "Blocked"],
      "Plate Ready": ["Release QA", "Waiting Approval", "Blocked"],
      "Release QA": ["Released", "Plate Ready", "Blocked"],
      "Released": ["Blocked"],
      "Blocked": ["Intake", "Validation", "Art Review", "Engineering", "File Prep", "Proof Ready", "Proof Sent", "Waiting Approval", "Plate Ready", "Release QA"]
    },
    releaseGates: {
      "Released": {
        requireChecklist: ["files", "art", "proof", "release"],
        requireField: "ppd.proofStatus",
        requireValue: "Approved"
      }
    }
  },
  // Job Passport lifecycle
  jobPassports: {
    field: "status",
    transitions: {
      "active": ["prepress", "production", "complete"],
      "prepress": ["production", "active", "complete"],
      "production": ["shipping", "complete"],
      "shipping": ["complete"],
      "complete": ["active"]
    }
  },
  // Vendor PO lifecycle
  vendorPOs: {
    field: "status",
    transitions: {
      "draft": ["pending", "cancelled"],
      "pending": ["approved", "rejected", "cancelled"],
      "approved": ["sent", "cancelled"],
      "rejected": ["draft", "cancelled"],
      "sent": ["received", "partial", "cancelled"],
      "received": ["closed"],
      "partial": ["received", "closed"],
      "cancelled": [],
      "closed": []
    },
    roleGates: {
      "approved": ["ceo", "admin", "administrator", "owner", "operations manager", "manager", "buyer", "purchasing"]
    }
  }
};

exports.transitionStatus = onRequest(
  { memory: "256MiB", timeoutSeconds: 60, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "transitionStatus", 30, 60000))) return;
    try {
      const { collection, docId, newStatus, note, machine } = req.body || {};
      if (!collection || !docId || !newStatus) {
        return sendJson(res, 400, { error: "collection, docId, and newStatus required" });
      }

      // Determine which state machine to use
      const machineKey = machine || collection;
      const sm = STATE_MACHINES[machineKey];
      if (!sm) {
        return sendJson(res, 400, { error: "No state machine defined for: " + machineKey });
      }

      // Fetch the document
      const docRef = db.collection(collection).doc(docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return sendJson(res, 404, { error: "Document not found" });
      }

      const data = docSnap.data();

      // Get current status (supports dot-notation like "ppd.stage")
      let currentStatus;
      if (sm.field.includes(".")) {
        const parts = sm.field.split(".");
        let obj = data;
        for (const p of parts) { obj = obj ? obj[p] : undefined; }
        currentStatus = obj || "";
      } else {
        currentStatus = data[sm.field] || "";
      }

      // Validate transition
      const allowed = sm.transitions[currentStatus];
      if (!allowed) {
        return sendJson(res, 400, { error: "Unknown current status: " + currentStatus });
      }
      if (!allowed.includes(newStatus)) {
        return sendJson(res, 403, {
          error: "Invalid transition: " + currentStatus + " → " + newStatus,
          allowed: allowed
        });
      }

      // Check role gates (some transitions require specific roles)
      if (sm.roleGates && sm.roleGates[newStatus]) {
        const userDoc = await db.collection("users").doc(actor.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const userRole = (userData.role || "").toLowerCase();
        const userDept = (userData.dept || "").toLowerCase();
        const requiredRoles = sm.roleGates[newStatus];
        const approvedDepts = ["operations", "administration"];
        if (!requiredRoles.includes(userRole) && !approvedDepts.includes(userDept)) {
          return sendJson(res, 403, {
            error: "Role '" + userRole + "' cannot transition to '" + newStatus + "'. Requires: " + requiredRoles.join(", ")
          });
        }
      }

      // Check release gates (e.g., PPD Released requires checklist)
      if (sm.releaseGates && sm.releaseGates[newStatus]) {
        const gate = sm.releaseGates[newStatus];
        if (gate.requireChecklist) {
          const checklist = data.ppd && data.ppd.checklist ? data.ppd.checklist : {};
          const missing = gate.requireChecklist.filter(k => !checklist[k]);
          if (missing.length > 0) {
            return sendJson(res, 403, {
              error: "Release blocked — incomplete checklist items: " + missing.join(", ")
            });
          }
        }
        if (gate.requireField) {
          const parts = gate.requireField.split(".");
          let val = data;
          for (const p of parts) { val = val ? val[p] : undefined; }
          if (val !== gate.requireValue) {
            return sendJson(res, 403, {
              error: "Release blocked — " + gate.requireField + " must be '" + gate.requireValue + "' (currently: '" + (val || "none") + "')"
            });
          }
        }
      }

      // Check async gates (e.g., sanitation clearance for QC)
      if (sm.asyncGates && sm.asyncGates[newStatus]) {
        const asyncGate = sm.asyncGates[newStatus];
        if (asyncGate.checkSanitation) {
          // Query today's sanitation records for the job's line/machine
          const todayStr = new Date().toISOString().slice(0, 10);
          const line = data.line || data.machine || data.pressLine || "";
          if (line) {
            const sanSnap = await db.collection("sqfSanitation")
              .where("date", "==", todayStr)
              .where("line", "==", line)
              .limit(5)
              .get();
            const hasFail = sanSnap.docs.some(d => {
              const sd = d.data();
              return sd.readyForProd === "fail" || sd.passFailOverall === "fail";
            });
            if (hasFail) {
              // Log the gate block as an escalation
              await db.collection("sqfEscalations").add({
                type: "qcGateBlock",
                severity: "critical",
                data: { docId, collection, line, newStatus, reason: "Sanitation not cleared" },
                createdAt: FieldValue.serverTimestamp(),
                createdAtIso: nowIso(),
                createdBy: actor.email,
                status: "open",
                escalateTo: ["operations_manager", "quality_supervisor"]
              });
              return sendJson(res, 403, {
                error: "QC BLOCKED: Line '" + line + "' has sanitation failures today. Clear sanitation before QC.",
                gate: "sanitation",
                line: line
              });
            }
          }
        }
      }

      // Apply the transition
      const now = new Date().toISOString();
      const update = { updatedAt: now, updatedBy: actor.email };

      if (sm.field.includes(".")) {
        // Dot-notation update (e.g., ppd.stage)
        update[sm.field] = newStatus;
      } else {
        update[sm.field] = newStatus;
      }

      // Add metadata for specific transitions
      if (newStatus === "ready" || newStatus === "approved") {
        update.approvedBy = actor.email;
        update.approvedAt = now;
      }
      if (newStatus === "rejected") {
        update.rejectedBy = actor.email;
        update.rejectedAt = now;
        if (note) update.rejectionReason = String(note).replace(/<[^>]*>/g, '').substring(0, 500);
      }
      if (newStatus === "sent") {
        update.sentAt = now;
      }
      if (newStatus === "won" || newStatus === "lost" || newStatus === "closed" || newStatus === "complete") {
        update.closedAt = now;
      }

      await docRef.update(update);

      await logServerEvent("status.transition", {
        actor: actor.email,
        collection,
        docId,
        from: currentStatus,
        to: newStatus,
        note: note || ""
      });

      sendJson(res, 200, {
        success: true,
        collection,
        docId,
        from: currentStatus,
        to: newStatus,
        updatedBy: actor.email
      });

    } catch (err) {
      console.error("transitionStatus error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// SAVE QUOTE PDF — Backend Drive save for quote.sent workflow
// Moves client-side Drive API calls to server service account
// ═══════════════════════════════════════════════════════════════════
exports.saveQuotePDF = onRequest(
  { memory: "512MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "saveQuotePDF", 10, 60000))) return;
    try {
      const body = req.body || {};
      const { quoteId, quoteNum, company, filename, recipient, registryNote } = body;
      if (!quoteId || !quoteNum || !company) {
        return sendJson(res, 400, { error: "quoteId, quoteNum, and company required" });
      }

      const drive = await getDriveClient();
      const driveId = await getMFXCoreId(drive);
      if (!driveId) throw new Error(`${DRIVE_NAME} shared drive not found`);

      const results = { masterLink: null, clientLink: null };

      // 1. Save to Master Quotes folder
      const masterFolder = await findOrCreateFolder(drive, "Master Quotes", driveId);
      // Check for existing file by quoteNum
      const searchQ = `name contains '${qEscape(quoteNum)}' and trashed=false and '${masterFolder.id}' in parents`;
      const existing = await drive.files.list({
        q: searchQ, supportsAllDrives: true, includeItemsFromAllDrives: true,
        corpora: "allDrives", fields: "files(id,name)"
      });
      const existId = (existing.data.files && existing.data.files.length) ? existing.data.files[0].id : null;
      // Create a placeholder file (PDF blob sent separately via uploadToDrive, or we mark as saved)
      if (!existId) {
        const placeholder = await drive.files.create({
          requestBody: { name: safeName(filename || quoteNum + ".pdf"), parents: [masterFolder.id], mimeType: "application/pdf" },
          supportsAllDrives: true, fields: "id,webViewLink"
        });
        results.masterLink = placeholder.data.webViewLink || `https://drive.google.com/file/d/${placeholder.data.id}`;
        results.masterFileId = placeholder.data.id;
      } else {
        results.masterLink = `https://drive.google.com/file/d/${existId}`;
        results.masterFileId = existId;
      }

      // 2. Save to Client folder
      const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
      const companyFolder = await findOrCreateFolder(drive, safeName(company), clientsFolder.id);
      const quoteFolder = await findOrCreateFolder(drive, safeName(quoteNum), companyFolder.id);
      const clientFile = await drive.files.create({
        requestBody: { name: safeName(filename || quoteNum + ".pdf"), parents: [quoteFolder.id], mimeType: "application/pdf" },
        supportsAllDrives: true, fields: "id,webViewLink"
      });
      results.clientLink = clientFile.data.webViewLink || `https://drive.google.com/file/d/${clientFile.data.id}`;
      results.clientFileId = clientFile.data.id;
      results.clientFolderId = quoteFolder.id;

      // 3. Update quote doc in Firestore
      const quoteRef = db.collection("quotes").doc(quoteId);
      const quoteSnap = await quoteRef.get();
      if (quoteSnap.exists) {
        await quoteRef.update({
          driveLink: results.masterLink,
          clientFolderLink: results.clientLink,
          driveSavedAt: nowIso(),
          updatedAt: nowIso(),
          "workflow.driveSaved": true,
          "workflow.registryUpdated": !!registryNote
        });
      }

      // 4. Log activity for finance bridge
      await db.collection("activity").add({
        type: "quote.sent",
        quoteId, quoteNum, company,
        recipient: recipient || "",
        driveLink: results.masterLink,
        timestamp: FieldValue.serverTimestamp(),
        source: "mfx-os",
        user: actor.email
      });

      await logServerEvent("quote.pdf.saved", { actor: actor.email, quoteId, quoteNum, company, masterFileId: results.masterFileId });
      sendJson(res, 200, { success: true, ...results });
    } catch (err) {
      console.error("saveQuotePDF error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// PROCESS VPO APPROVAL — Backend Drive/Registry/Chat for vpo.approved
// Moves client-side Google API calls to server service account
// ═══════════════════════════════════════════════════════════════════
exports.processVPOApproval = onRequest(
  { memory: "512MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "processVPOApproval", 10, 60000))) return;
    try {
      const body = req.body || {};
      const { vpoId } = body;
      if (!vpoId) return sendJson(res, 400, { error: "vpoId required" });

      const vpoSnap = await db.collection("vendorPOs").doc(vpoId).get();
      if (!vpoSnap.exists) return sendJson(res, 404, { error: "VPO not found" });
      const vpo = Object.assign({ id: vpoSnap.id }, vpoSnap.data());

      const drive = await getDriveClient();
      const driveId = await getMFXCoreId(drive);
      const results = { driveLink: null, folderCreated: false };

      if (driveId) {
        // Create folder: MFX-CORE/Vendor POs/[VPO#]
        const vpFolder = await findOrCreateFolder(drive, "Vendor POs", driveId);
        const vpoFolder = await findOrCreateFolder(drive, safeName(vpo.vpoNum || vpoId), vpFolder.id);
        results.folderId = vpoFolder.id;
        results.driveLink = `https://drive.google.com/drive/folders/${vpoFolder.id}`;
        results.folderCreated = true;

        // Also create vendor-specific folder
        const vendorsFolder = await findOrCreateFolder(drive, "Vendors", driveId);
        if (vpo.vendorName) {
          const vendorFolder = await findOrCreateFolder(drive, safeName(vpo.vendorName), vendorsFolder.id);
          await findOrCreateFolder(drive, "POs", vendorFolder.id);
          await findOrCreateFolder(drive, "Invoices", vendorFolder.id);
          await findOrCreateFolder(drive, "Certs", vendorFolder.id);
        }
      }

      // Update VPO doc with Drive link
      const updateData = { updatedAt: nowIso() };
      if (results.driveLink) updateData.driveLink = results.driveLink;
      await db.collection("vendorPOs").doc(vpoId).update(updateData);

      // Log activity for Finance bridge
      await db.collection("activity").add({
        type: "vpo.approved",
        vpoId: vpo.id,
        vpoNum: vpo.vpoNum || "",
        vendorName: vpo.vendorName || "",
        total: vpo.total || 0,
        approvedBy: actor.email,
        driveLink: results.driveLink || "",
        timestamp: FieldValue.serverTimestamp(),
        source: "mfx-os"
      });

      // Send Google Chat webhook if configured
      const chatWebhook = process.env.MFX_GCHAT_WEBHOOK || "";
      if (chatWebhook) {
        const chatMsg = `✅ *VPO Approved*\n${vpo.vpoNum || "?"} — ${vpo.vendorName || "?"}\n${vpo.material || ""} · $${Number(vpo.total || 0).toFixed(2)}\nApproved by: ${actor.email}`;
        await fetch(chatWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chatMsg })
        }).catch(e => console.warn("Chat webhook:", e.message));
      }

      await logServerEvent("vpo.approval.processed", { actor: actor.email, vpoId, vpoNum: vpo.vpoNum, driveLink: results.driveLink });
      sendJson(res, 200, { success: true, ...results });
    } catch (err) {
      console.error("processVPOApproval error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// CHECK OVERDUE VPOs — Scheduled backend job (callable via HTTP)
// Replaces browser-side 4-hour interval in vendor-workspace.js
// ═══════════════════════════════════════════════════════════════════
exports.checkOverdueVPOs = onRequest(
  { memory: "256MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // Query all sent VPOs with ETA before today
      const sentSnap = await db.collection("vendorPOs")
        .where("status", "==", "sent")
        .get();

      let overdueCount = 0;
      let notifiedCount = 0;
      const overdueList = [];

      for (const doc of sentSnap.docs) {
        const vpo = doc.data();
        if (!vpo.eta) continue;
        const eta = new Date(vpo.eta);
        if (eta >= now) continue; // Not overdue

        overdueCount++;
        const daysOverdue = Math.round((now - eta) / (1000 * 60 * 60 * 24));

        overdueList.push({
          vpoId: doc.id,
          vpoNum: vpo.vpoNum || doc.id,
          vendorName: vpo.vendorName || "",
          material: vpo.material || "",
          eta: vpo.eta,
          daysOverdue
        });

        // Skip if already notified today
        if (vpo._overdueNotifiedDate === todayStr) continue;

        // Mark as notified today (allows daily re-notification, not just once)
        await doc.ref.update({
          _overdueNotified: true,
          _overdueNotifiedDate: todayStr,
          overdueNotifiedAt: nowIso()
        });

        // Log activity for Finance
        await db.collection("activity").add({
          type: "vpo.overdue",
          vpoId: doc.id,
          vpoNum: vpo.vpoNum || "",
          vendorName: vpo.vendorName || "",
          material: vpo.material || "",
          eta: vpo.eta,
          daysOverdue,
          timestamp: FieldValue.serverTimestamp(),
          source: "mfx-os-scheduled"
        });

        // Create escalation for critical overdue (>7 days)
        if (daysOverdue > 7) {
          await db.collection("sqfEscalations").add({
            type: "vpoOverdue",
            severity: daysOverdue > 14 ? "critical" : "major",
            data: { vpoId: doc.id, vpoNum: vpo.vpoNum, vendorName: vpo.vendorName, daysOverdue },
            createdAt: FieldValue.serverTimestamp(),
            createdAtIso: nowIso(),
            createdBy: "system-scheduled",
            status: "open",
            escalateTo: daysOverdue > 14 ? ["operations_manager", "ceo"] : ["purchasing_manager"]
          });
        }

        // Chat webhook
        const chatWebhook = process.env.MFX_GCHAT_WEBHOOK || "";
        if (chatWebhook) {
          const msg = `🔴 *PO OVERDUE*\n${vpo.vpoNum || "?"} — ${vpo.vendorName || "?"}\n${vpo.material || ""}\nExpected: ${new Date(vpo.eta).toLocaleDateString("en-US")} (${daysOverdue}d ago)\nAction: Follow up immediately`;
          await fetch(chatWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: msg })
          }).catch(e => console.warn("Chat webhook:", e.message));
        }

        notifiedCount++;
      }

      await logServerEvent("vpo.overdue.check", { actor: actor.email || "scheduler", overdueCount, notifiedCount });
      sendJson(res, 200, { success: true, overdueCount, notifiedCount, overdueList });
    } catch (err) {
      console.error("checkOverdueVPOs error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// CREATE PASSPORT — Backend passport creation triggered by so.approved
// Replaces client-side delayed createPassportFromSO call
// ═══════════════════════════════════════════════════════════════════
exports.createPassport = onRequest(
  { memory: "256MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const body = req.body || {};
      const { soId } = body;
      if (!soId) return sendJson(res, 400, { error: "soId required" });

      const soSnap = await db.collection("salesOrders").doc(soId).get();
      if (!soSnap.exists) return sendJson(res, 404, { error: "Sales Order not found" });
      const so = Object.assign({ id: soSnap.id }, soSnap.data());

      // Check if passport already exists for this SO
      const existingJP = await db.collection("jobPassports")
        .where("soId", "==", soId)
        .limit(1)
        .get();
      if (!existingJP.empty) {
        const existing = existingJP.docs[0];
        return sendJson(res, 200, {
          success: true,
          alreadyExists: true,
          passportId: existing.id,
          jpNum: existing.data().jpNum || ""
        });
      }

      // Issue JP number via sequence
      const seq = await issueSequence("jobPassport", "JP");

      // Create passport document
      const passport = {
        jpNum: seq.formatted,
        soId: so.id,
        soNum: so.soNum || "",
        quoteId: so.quoteId || "",
        quoteNum: so.quoteNum || "",
        company: so.company || "",
        contact: so.contact || "",
        email: so.email || "",
        jobDesc: so.jobDesc || "",
        specs: so.specs || {},
        qty: so.qty || 0,
        poNumber: so.poNumber || "",
        status: "active",
        createdAt: nowIso(),
        createdBy: actor.email,
        updatedAt: nowIso()
      };

      const jpRef = await db.collection("jobPassports").add(passport);

      // Update the SO to link passport
      await db.collection("salesOrders").doc(soId).update({
        passportId: jpRef.id,
        passportNum: seq.formatted,
        updatedAt: nowIso()
      });

      // Log activity
      await db.collection("activity").add({
        type: "passport.created",
        passportId: jpRef.id,
        jpNum: seq.formatted,
        soNum: so.soNum || "",
        company: so.company || "",
        timestamp: FieldValue.serverTimestamp(),
        source: "mfx-os",
        user: actor.email
      });

      await logServerEvent("passport.created", { actor: actor.email, passportId: jpRef.id, jpNum: seq.formatted, soId });
      sendJson(res, 200, { success: true, passportId: jpRef.id, jpNum: seq.formatted });
    } catch (err) {
      console.error("createPassport error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// PPD HEALTH CHECK — Idempotent folder verification + repair
// ═══════════════════════════════════════════════════════════════════
exports.ppdHealthCheck = onRequest(
  { memory: "256MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const body = req.body || {};
      const { jobTicketId } = body;
      if (!jobTicketId) return sendJson(res, 400, { error: "jobTicketId required" });

      const jtSnap = await db.collection("jobTickets").doc(jobTicketId).get();
      if (!jtSnap.exists) return sendJson(res, 404, { error: "Job Ticket not found" });
      const jt = Object.assign({ id: jtSnap.id }, jtSnap.data());

      const ppd = jt.ppd || {};
      const report = {
        jobTicketId,
        jtNum: jt.jtNum || "",
        rootFolderExists: false,
        subfolders: {},
        missingFolders: [],
        repairedFolders: [],
        status: "healthy"
      };

      if (!ppd.driveFolderId) {
        // No PPD folder exists — provision it
        report.status = "missing";
        report.recommendation = "Run provisionPPDWorkspace to create folder tree";
        return sendJson(res, 200, { success: true, ...report });
      }

      // Verify root folder exists on Drive
      const drive = await getDriveClient();
      try {
        const rootCheck = await drive.files.get({
          fileId: ppd.driveFolderId,
          supportsAllDrives: true,
          fields: "id,name,trashed"
        });
        report.rootFolderExists = !rootCheck.data.trashed;
      } catch (e) {
        report.rootFolderExists = false;
        report.status = "broken";
        report.error = "Root folder not accessible: " + e.message;
        return sendJson(res, 200, { success: true, ...report });
      }

      // Check each expected subfolder
      for (const subName of DEFAULT_PPD_SUBFOLDERS) {
        const existing = await findFolder(drive, subName, ppd.driveFolderId);
        if (existing) {
          report.subfolders[subName] = { exists: true, id: existing.id };
        } else {
          report.missingFolders.push(subName);
          // Auto-repair: create missing subfolder
          if (body.repair !== false) {
            const created = await createFolder(drive, subName, ppd.driveFolderId);
            report.subfolders[subName] = { exists: true, id: created.id, repaired: true };
            report.repairedFolders.push(subName);
          } else {
            report.subfolders[subName] = { exists: false };
          }
        }
      }

      if (report.missingFolders.length > 0 && report.repairedFolders.length > 0) {
        report.status = "repaired";
        // Update Firestore with repaired folder data
        const updatedFolders = {};
        for (const [name, info] of Object.entries(report.subfolders)) {
          if (info.id) updatedFolders[name] = { id: info.id, url: `https://drive.google.com/drive/folders/${info.id}` };
        }
        await db.collection("jobTickets").doc(jobTicketId).set({
          updatedAt: nowIso(),
          ppd: { driveFolders: updatedFolders, healthCheckedAt: nowIso() }
        }, { merge: true });
      } else if (report.missingFolders.length === 0) {
        report.status = "healthy";
        await db.collection("jobTickets").doc(jobTicketId).set({
          updatedAt: nowIso(),
          ppd: { healthCheckedAt: nowIso() }
        }, { merge: true });
      }

      await logServerEvent("ppd.health.check", { actor: actor.email, jobTicketId, status: report.status, repaired: report.repairedFolders.length });
      sendJson(res, 200, { success: true, ...report });
    } catch (err) {
      console.error("ppdHealthCheck error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// SCHEDULED INBOX INGESTION — Centralized endpoint for PPD inbox
// ═══════════════════════════════════════════════════════════════════
exports.scheduledInboxIngest = onRequest(
  { memory: "256MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const body = req.body || {};
      const mailboxes = body.mailboxes || [body.mailbox || ""];
      const query = String(body.query || "label:inbox is:unread");
      const maxResults = Math.max(1, Math.min(Number(body.maxResults || 15), 50));
      const results = [];

      for (const mailbox of mailboxes.filter(Boolean)) {
        const gmail = getDelegatedGmailClient(mailbox);
        if (!gmail) {
          results.push({ mailbox, error: "No delegated client available", scanned: 0, created: 0 });
          continue;
        }
        try {
          const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
          const messages = list.data.messages || [];
          let created = 0, updated = 0;

          for (const msg of messages) {
            const detail = await gmail.users.messages.get({
              userId: "me", id: msg.id, format: "metadata",
              metadataHeaders: ["From", "Subject", "To", "Date"]
            });
            const payload = detail.data || {};
            const headers = payload.payload && payload.payload.headers ? payload.payload.headers : [];
            const header = (name) => (headers.find((h) => h.name === name) || {}).value || "";
            const fromParts = parseEmailAddress(header("From"));
            const receivedAt = payload.internalDate ? new Date(Number(payload.internalDate)).toISOString() : nowIso();
            const record = {
              id: msg.id,
              provider: "gmail",
              source: "scheduledIngest",
              gmailMessageId: msg.id,
              gmailThreadId: payload.threadId || msg.threadId || "",
              subject: header("Subject") || "New Email",
              snippet: payload.snippet || "",
              from: header("From"),
              fromEmail: fromParts.email,
              fromName: fromParts.name,
              to: header("To"),
              company: deriveCompanyFromMessage(header("Subject"), fromParts.name),
              mailbox,
              priority: "normal",
              status: "new",
              sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
              receivedAt,
              ingestQuery: query,
              assignedDept: "Pre-Press",
              linkedJobTicketId: "",
              linkedRequestId: ""
            };
            const wasCreated = await upsertPrepressInboxRecord(record);
            if (wasCreated) created++; else updated++;
          }
          results.push({ mailbox, scanned: messages.length, created, updated });
        } catch (e) {
          results.push({ mailbox, error: e.message, scanned: 0, created: 0 });
        }
      }

      const totalCreated = results.reduce((s, r) => s + (r.created || 0), 0);
      const totalScanned = results.reduce((s, r) => s + (r.scanned || 0), 0);
      await logServerEvent("ppd.inbox.scheduled", { actor: actor.email || "scheduler", mailboxes, totalScanned, totalCreated });
      sendJson(res, 200, { success: true, results, totalScanned, totalCreated });
    } catch (err) {
      console.error("scheduledInboxIngest error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// CONTROLLED RECORDS REGISTER — SQF Ed.10 document control matrix
// Every record type with owner, retention, trigger, Drive location
// ═══════════════════════════════════════════════════════════════════

const CONTROLLED_RECORDS = [
  // ── Commercial chain ─────────────��────────────────────────────
  {
    id: "requests",
    name: "Customer Instructions / RFQs",
    collection: "requests",
    sqfClause: "2.1.1",
    owner: "CSR / Sales",
    retentionYears: 3,
    purpose: "Captures customer requirements, substrate specs, print specs, and delivery terms that seed every downstream document",
    trigger: "Customer submits RFQ, CSR logs intake, or shared inbox ingestion",
    driveFolder: "Clients/{company}/{recordNum}/01_Request",
    requiredFields: ["company", "subject", "requestType"],
    packetRole: "customerInstruction"
  },
  {
    id: "quotes",
    name: "Approved Quotes",
    collection: "quotes",
    sqfClause: "2.1.1",
    owner: "Sales / CEO",
    retentionYears: 7,
    purpose: "Priced proposal with material specs, quantities, and terms — becomes contract when accepted",
    trigger: "quote.sent event, CEO approval via transitionStatus",
    driveFolder: "Master Quotes/{quoteNum}.pdf AND Clients/{company}/{quoteNum}/",
    requiredFields: ["quoteNum", "company", "status", "items"],
    packetRole: "approvedQuote"
  },
  {
    id: "salesOrders",
    name: "Sales Orders",
    collection: "salesOrders",
    sqfClause: "2.1.1",
    owner: "Operations / CEO",
    retentionYears: 7,
    purpose: "Confirmed order converting quote to production commitment with customer PO reference",
    trigger: "so.created from won quote, CEO approval transitions to approved",
    driveFolder: "Clients/{company}/{soNum}/",
    requiredFields: ["soNum", "company", "status", "quoteId"],
    packetRole: "salesOrder"
  },
  {
    id: "jobPassports",
    name: "Job Passports",
    collection: "jobPassports",
    sqfClause: "2.6.1",
    owner: "Operations",
    retentionYears: 7,
    purpose: "Master tracking document linking SO to production — carries traceability chain through every department",
    trigger: "passport.created from so.approved via createPassport endpoint",
    driveFolder: "Clients/{company}/{jpNum}/",
    requiredFields: ["jpNum", "soId", "company", "status"],
    packetRole: "jobPassport"
  },
  // ── PrePress / PPD chain ──────────────────────���───────────────
  {
    id: "jobTickets",
    name: "Job Tickets",
    collection: "jobTickets",
    sqfClause: "2.6.1",
    owner: "Pre-Press / Production",
    retentionYears: 7,
    purpose: "Individual SKU production ticket with specs, plate info, and press instructions derived from passport",
    trigger: "Generated from passport via generateJobTickets",
    driveFolder: "Clients/{company}/{jtNum} · {skuName}/",
    requiredFields: ["jtNum", "passportId", "status"],
    packetRole: "jobTicket"
  },
  {
    id: "prepressInbox",
    name: "PrePress Shared Inbox",
    collection: "prepressInbox",
    sqfClause: "2.1.3",
    owner: "Pre-Press Lead",
    retentionYears: 1,
    purpose: "Ingested customer emails with art files, revision requests, and proof feedback — auditable intake trail",
    trigger: "Scheduled Gmail ingestion via ingestSharedInbox / scheduledInboxIngest",
    driveFolder: "Clients/{company}/{jtNum}/01_Request/",
    requiredFields: ["subject", "fromEmail", "receivedAt"],
    packetRole: "customerInstruction"
  },
  {
    id: "blueprints",
    name: "Art / Proof History (Blueprints)",
    collection: "blueprints",
    sqfClause: "13.8.4",
    owner: "Pre-Press",
    retentionYears: 7,
    purpose: "Version-controlled artwork and proof files — each version tracked with reviewer, date, and disposition",
    trigger: "Artist uploads via PPD Job Studio, file upload to Drive",
    driveFolder: "Clients/{company}/{jtNum}/02_Source_Art/ AND /04_Proofs/",
    requiredFields: ["company", "skuName"],
    packetRole: "artProofHistory"
  },
  {
    id: "approvalRecords",
    name: "Proof Approval Records",
    collection: "approvalRecords",
    sqfClause: "2.5.2",
    owner: "QA / Pre-Press Lead",
    retentionYears: 7,
    purpose: "Customer or internal sign-off on proof version — gates release to plate and production",
    trigger: "savePPDApproval in PPD module, customer portal approval",
    driveFolder: "Clients/{company}/{jtNum}/05_Approvals/",
    requiredFields: ["status", "version"],
    packetRole: "approvalRecord"
  },
  {
    id: "plateIncidents",
    name: "Plate Incidents",
    collection: "plateIncidents",
    sqfClause: "13.8.6",
    owner: "Pre-Press Lead / QA",
    retentionYears: 3,
    purpose: "Damage, wear, or defect records for flexo plates — triggers CAPA if pattern detected",
    trigger: "Operator or pre-press logs incident, linked to job ticket",
    driveFolder: "Clients/{company}/{jtNum}/09_Issues_CAPA/",
    requiredFields: ["incidentDate", "plateId"],
    packetRole: "ncrCapaLinkage"
  },
  // ── Production / Quality chain ────────────────────────────────
  {
    id: "prepressQueue",
    name: "PrePress Execution Queue",
    collection: "prepressQueue",
    sqfClause: "2.1.3",
    owner: "Pre-Press Lead",
    retentionYears: 1,
    purpose: "Live work queue with priority, assignment, and SLA tracking for prepress tasks",
    trigger: "Job ticket creation, manual queue entry, rebalance by lead",
    driveFolder: null,
    requiredFields: ["status", "priority"],
    packetRole: null
  },
  {
    id: "exceptionOverrides",
    name: "Exception Overrides",
    collection: "exceptionOverrides",
    sqfClause: "2.5.4",
    owner: "Operations Manager / QA",
    retentionYears: 7,
    purpose: "Logged deviations from standard process — reason, owner, and expiry required per SQF 2.5.4",
    trigger: "Manual override logged via PPD Control tab or FSQMS",
    driveFolder: null,
    requiredFields: ["type", "reason", "owner", "status"],
    packetRole: "ncrCapaLinkage"
  },
  {
    id: "ppdEvents",
    name: "PPD Audit Events",
    collection: "ppdEvents",
    sqfClause: "2.5.1",
    owner: "System / QA",
    retentionYears: 3,
    purpose: "Immutable activity log for every PPD action — settings change, sync, approval, release, override",
    trigger: "Automatic on every PPD action via logPPDEvent",
    driveFolder: null,
    requiredFields: ["type", "createdAt"],
    packetRole: null
  },
  {
    id: "ppdEstimates",
    name: "PPD Cost Estimates",
    collection: "ppdEstimates",
    sqfClause: "2.1.1",
    owner: "Pre-Press Lead / Sales",
    retentionYears: 3,
    purpose: "Internal pre-press cost estimates for plate, proof, and setup — feeds quote pricing",
    trigger: "Pre-press lead creates estimate for new or repeat job",
    driveFolder: "Clients/{company}/{jtNum}/10_Master_Regs_Exports/",
    requiredFields: ["company", "estimateTotal"],
    packetRole: null
  },
  {
    id: "ppdTemplates",
    name: "PPD Job Templates",
    collection: "ppdTemplates",
    sqfClause: "13.8.4",
    owner: "Pre-Press Lead",
    retentionYears: 5,
    purpose: "Reusable job setup templates with standard specs, plate configs, and checklist presets",
    trigger: "Pre-press lead saves template from completed job",
    driveFolder: null,
    requiredFields: ["name", "specs"],
    packetRole: null
  },
  {
    id: "equipmentProfiles",
    name: "Equipment Profiles",
    collection: "equipmentProfiles",
    sqfClause: "13.10.1",
    owner: "Maintenance / Production",
    retentionYears: 10,
    purpose: "Press, converter, and tooling profiles with calibration history, maintenance schedules, and capability specs",
    trigger: "Equipment commissioning, calibration event, maintenance completion",
    driveFolder: "Equipment/{equipmentId}/",
    requiredFields: ["name", "type", "status"],
    packetRole: null
  },
  {
    id: "qcProcedures",
    name: "QC Procedures",
    collection: "qcProcedures",
    sqfClause: "2.5.2",
    owner: "QA Manager",
    retentionYears: 10,
    purpose: "Controlled quality procedures — inspection methods, acceptance criteria, sampling plans per SQF element",
    trigger: "QA creates/revises procedure, annual review cycle",
    driveFolder: "Quality System/Procedures/",
    requiredFields: ["title", "revision", "effectiveDate", "approvedBy"],
    packetRole: null
  },
  {
    id: "returnMaterials",
    name: "Return Materials / RMA",
    collection: "returnMaterials",
    sqfClause: "2.6.2",
    owner: "QA / Customer Service",
    retentionYears: 7,
    purpose: "Customer returns with root cause, disposition, and linked NCR — feeds CAPA and vendor scorecard",
    trigger: "Customer complaint, internal rejection at shipping, QC hold disposition",
    driveFolder: "Quality System/Returns/{rmaNum}/",
    requiredFields: ["company", "reason", "disposition", "linkedJobTicketId"],
    packetRole: "ncrCapaLinkage"
  },
  // ── Release / Shipment / NCR (packet completers) ──────────────
  {
    id: "sqfReleasePackets",
    name: "Release Packets",
    collection: "sqfReleasePackets",
    sqfClause: "2.4.4",
    owner: "QA Manager",
    retentionYears: 7,
    purpose: "Aggregated release evidence — all checklist items verified, CCPs complete, product cleared for shipment",
    trigger: "QA completes final release in FSQMS, assembleJobPacket validates chain",
    driveFolder: "Clients/{company}/{jtNum}/07_Released/",
    requiredFields: ["jobTicketId", "disposition", "releasedBy", "releasedAt"],
    packetRole: "releasePacket"
  },
  {
    id: "operatorLogs",
    name: "Operator Production Logs",
    collection: "operatorLogs",
    sqfClause: "13.3.1",
    owner: "Production Supervisor",
    retentionYears: 3,
    purpose: "Per-shift press operator entries — run counts, waste, downtime, adjustments, and in-process checks",
    trigger: "Operator logs during production run, shift end summary",
    driveFolder: "Production/Logs/{date}/",
    requiredFields: ["jobTicketId", "operator", "shift", "date"],
    packetRole: "operatorLog"
  },
  {
    id: "sqfQualityRecords",
    name: "QC Evidence Records",
    collection: "sqfQualityRecords",
    sqfClause: "2.5.2",
    owner: "QA Tech / QA Manager",
    retentionYears: 7,
    purpose: "In-process and final QC inspection results — print registration, color, seal, contamination checks",
    trigger: "QC tech completes inspection in FSQMS quality module",
    driveFolder: "Quality System/Inspections/{date}/",
    requiredFields: ["jobTicketId", "inspectionType", "disposition", "inspector"],
    packetRole: "qcEvidence"
  },
  {
    id: "shipments",
    name: "Shipment Records",
    collection: "shipments",
    sqfClause: "2.6.1",
    owner: "Logistics / Shipping",
    retentionYears: 7,
    purpose: "BOL, packing list, lot traceability, and carrier details — completes the forward traceability chain",
    trigger: "Shipping completes dispatch in logistics module",
    driveFolder: "Clients/{company}/{jtNum}/07_Released/",
    requiredFields: ["jobTicketId", "bolNumber", "carrier", "shippedAt"],
    packetRole: "shipmentRecord"
  },
  {
    id: "ncrs",
    name: "NCR / CAPA Records",
    collection: "ncrs",
    sqfClause: "2.5.4",
    owner: "QA Manager",
    retentionYears: 7,
    purpose: "Non-conformance reports with root cause analysis, corrective/preventive actions, and effectiveness verification",
    trigger: "QC hold, customer complaint, audit finding, or operator-reported defect via CAPA module",
    driveFolder: "Quality System/NCR-CAPA/{ncrNumber}/",
    requiredFields: ["ncrNumber", "stage", "category"],
    packetRole: "ncrCapaLinkage"
  },
  // ── SQF-specific receiving / materials ────────────────────────
  {
    id: "receivingQueue",
    name: "Receiving Work Queue",
    collection: "receivingQueue",
    sqfClause: "2.4.4",
    owner: "QA / Receiving",
    retentionYears: 3,
    purpose: "SQF Ed.10 clause 2.4.4 traceability checklist for every incoming material lot",
    trigger: "vpo.received event creates task via sqf-alerts receiving handler",
    driveFolder: null,
    requiredFields: ["vpoId", "lot", "status"],
    packetRole: null
  },
  {
    id: "sqfMaterials",
    name: "SQF Material Receiving Log",
    collection: "sqfMaterials",
    sqfClause: "13.8.1",
    owner: "QA / Receiving",
    retentionYears: 3,
    purpose: "Material receiving inspection log — CoA, condition, lot, disposition per SQF 13.8",
    trigger: "vpo.received → sqf-alerts creates entry, or FSQMS material receiving form",
    driveFolder: null,
    requiredFields: ["material", "lot", "disposition", "receivedAt"],
    packetRole: null
  }
];

// Packet link definitions — the minimum controlled chain per released job
const PACKET_LINKS = [
  { role: "customerInstruction", label: "Customer Instruction / RFQ", required: true },
  { role: "approvedQuote", label: "Approved Quote", required: true },
  { role: "salesOrder", label: "Sales Order", required: true },
  { role: "jobPassport", label: "Job Passport", required: true },
  { role: "jobTicket", label: "Job Ticket", required: true },
  { role: "artProofHistory", label: "Art / Proof History", required: true },
  { role: "approvalRecord", label: "Approval Record", required: true },
  { role: "releasePacket", label: "Release Packet", required: true },
  { role: "operatorLog", label: "Operator Log", required: true },
  { role: "qcEvidence", label: "QC Evidence", required: true },
  { role: "shipmentRecord", label: "Shipment Record", required: false },
  { role: "ncrCapaLinkage", label: "NCR / CAPA Linkage", required: false }
];

exports.getControlledRecordsRegister = onRequest(
  { memory: "256MiB", timeoutSeconds: 30, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      // Gather live counts for each collection — parallel for speed
      const counts = {};
      const countResults = await Promise.allSettled(
        CONTROLLED_RECORDS.map(async (rec) => {
          try {
            const snap = await db.collection(rec.collection).limit(1).get();
            return { id: rec.id, exists: !snap.empty, collection: rec.collection };
          } catch (e) {
            return { id: rec.id, exists: false, error: e.message };
          }
        })
      );
      countResults.forEach((r) => {
        const v = r.status === 'fulfilled' ? r.value : { id: 'unknown', exists: false, error: 'rejected' };
        counts[v.id] = v;
      });

      // Check Drive connectivity
      let driveConnected = false;
      let driveId = null;
      try {
        const drive = await getDriveClient();
        driveId = await getMFXCoreId(drive);
        driveConnected = !!driveId;
      } catch (e) {
        driveConnected = false;
      }

      sendJson(res, 200, {
        success: true,
        register: CONTROLLED_RECORDS,
        packetLinks: PACKET_LINKS,
        counts,
        drive: { connected: driveConnected, driveId, driveName: DRIVE_NAME },
        generatedAt: nowIso()
      });
    } catch (err) {
      console.error("getControlledRecordsRegister error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ════════════════════════════════════════════════���══════════════════
// ASSEMBLE JOB PACKET — Validate + link the full SQF controlled chain
// for a given job ticket. Returns completeness report + Drive links
// ══════════════════════════════════════════════════��════════════════
exports.assembleJobPacket = onRequest(
  { memory: "512MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    try {
      const body = req.body || {};
      const { jobTicketId } = body;
      if (!jobTicketId) return sendJson(res, 400, { error: "jobTicketId required" });

      const jtSnap = await db.collection("jobTickets").doc(jobTicketId).get();
      if (!jtSnap.exists) return sendJson(res, 404, { error: "Job Ticket not found" });
      const jt = Object.assign({ id: jtSnap.id }, jtSnap.data());

      const packet = {
        jobTicketId: jt.id,
        jtNum: jt.jtNum || "",
        company: jt.company || "",
        links: {},
        completeness: 0,
        requiredCount: 0,
        presentCount: 0,
        gaps: [],
        warnings: []
      };

      // 1. Job Ticket itself
      packet.links.jobTicket = {
        present: true,
        docId: jt.id,
        num: jt.jtNum || "",
        status: jt.status || "",
        driveFolder: (jt.ppd && jt.ppd.driveFolderUrl) || null
      };

      // 2. Job Passport
      let passport = null;
      if (jt.passportId) {
        const jpSnap = await db.collection("jobPassports").doc(jt.passportId).get();
        if (jpSnap.exists) {
          passport = Object.assign({ id: jpSnap.id }, jpSnap.data());
          packet.links.jobPassport = { present: true, docId: passport.id, num: passport.jpNum || "", status: passport.status || "" };
        }
      }
      if (!passport) {
        // Try finding by jtNum reference
        const jpQ = await db.collection("jobPassports").where("jobTicketIds", "array-contains", jt.id).limit(1).get();
        if (!jpQ.empty) {
          passport = Object.assign({ id: jpQ.docs[0].id }, jpQ.docs[0].data());
          packet.links.jobPassport = { present: true, docId: passport.id, num: passport.jpNum || "" };
        }
      }
      if (!packet.links.jobPassport) packet.links.jobPassport = { present: false };

      // 3. Sales Order
      const soId = (passport && passport.soId) || jt.soId || "";
      if (soId) {
        const soSnap = await db.collection("salesOrders").doc(soId).get();
        if (soSnap.exists) {
          const so = soSnap.data();
          packet.links.salesOrder = { present: true, docId: soId, num: so.soNum || "", status: so.status || "" };
          // 4. Quote
          const qId = so.quoteId || jt.quoteId || "";
          if (qId) {
            const qSnap = await db.collection("quotes").doc(qId).get();
            if (qSnap.exists) {
              const q = qSnap.data();
              packet.links.approvedQuote = { present: true, docId: qId, num: q.quoteNum || "", status: q.status || "", driveLink: q.driveLink || null };
            }
          }
        }
      }
      if (!packet.links.salesOrder) packet.links.salesOrder = { present: false };
      if (!packet.links.approvedQuote) packet.links.approvedQuote = { present: false };

      // 5. Customer Instruction (requests or prepressInbox linked to this job)
      const reqQ = await db.collection("requests").where("linkedJobTicketId", "==", jt.id).limit(5).get();
      const inboxQ = await db.collection("prepressInbox").where("linkedJobTicketId", "==", jt.id).limit(5).get();
      const ciCount = reqQ.size + inboxQ.size;
      packet.links.customerInstruction = {
        present: ciCount > 0,
        count: ciCount,
        requestIds: reqQ.docs.map(d => d.id),
        inboxIds: inboxQ.docs.map(d => d.id)
      };

      // 6. Art / Proof History (blueprints linked to job or company+sku)
      let bpQ = await db.collection("blueprints").where("jobTicketId", "==", jt.id).limit(20).get();
      if (bpQ.empty && jt.blueprintId) {
        const bpSnap = await db.collection("blueprints").doc(jt.blueprintId).get();
        if (bpSnap.exists) bpQ = { size: 1, docs: [bpSnap], empty: false };
      }
      packet.links.artProofHistory = {
        present: !bpQ.empty,
        count: bpQ.size || (bpQ.docs ? bpQ.docs.length : 0),
        latestVersion: bpQ.docs && bpQ.docs.length ? (bpQ.docs[0].data().version || "") : ""
      };

      // 7. Approval Record
      const apQ = await db.collection("approvalRecords").where("jobTicketId", "==", jt.id).limit(5).get();
      packet.links.approvalRecord = {
        present: !apQ.empty,
        count: apQ.size,
        latestStatus: apQ.docs.length ? (apQ.docs[0].data().status || "") : ""
      };

      // 8. Release Packet
      const relQ = await db.collection("sqfReleasePackets").where("jobTicketId", "==", jt.id).limit(1).get();
      packet.links.releasePacket = {
        present: !relQ.empty,
        disposition: relQ.docs.length ? (relQ.docs[0].data().disposition || "") : ""
      };

      // 9. Operator Log
      const opQ = await db.collection("operatorLogs").where("jobTicketId", "==", jt.id).limit(5).get();
      packet.links.operatorLog = {
        present: !opQ.empty,
        count: opQ.size
      };

      // 10. QC Evidence
      const qcQ = await db.collection("sqfQualityRecords").where("jobTicketId", "==", jt.id).limit(10).get();
      packet.links.qcEvidence = {
        present: !qcQ.empty,
        count: qcQ.size
      };

      // 11. Shipment Record
      const shipQ = await db.collection("shipments").where("jobTicketId", "==", jt.id).limit(1).get();
      packet.links.shipmentRecord = {
        present: !shipQ.empty,
        bolNumber: shipQ.docs.length ? (shipQ.docs[0].data().bolNumber || "") : ""
      };

      // 12. NCR / CAPA Linkage
      const ncrQ = await db.collection("ncrs").where("linkedJobTicketId", "==", jt.id).limit(10).get();
      const piQ = await db.collection("plateIncidents").where("jobTicketId", "==", jt.id).limit(5).get();
      packet.links.ncrCapaLinkage = {
        present: ncrQ.size > 0 || piQ.size > 0,
        ncrCount: ncrQ.size,
        incidentCount: piQ.size,
        note: (ncrQ.size === 0 && piQ.size === 0) ? "No NCRs — clean job" : ""
      };

      // Calculate completeness
      for (const link of PACKET_LINKS) {
        const found = packet.links[link.role];
        if (link.required) {
          packet.requiredCount++;
          if (found && found.present) {
            packet.presentCount++;
          } else {
            packet.gaps.push({ role: link.role, label: link.label });
          }
        } else {
          // Optional but note if present
          if (found && found.present) packet.presentCount++;
        }
      }
      packet.completeness = packet.requiredCount > 0 ? Math.round((packet.presentCount / packet.requiredCount) * 100) : 0;

      // Warnings for partial data
      if (jt.status === "closed" || (jt.ppd && jt.ppd.stage === "Released")) {
        if (packet.completeness < 100) {
          packet.warnings.push("Job is released/closed but packet is only " + packet.completeness + "% complete — SQF audit risk");
        }
      }
      if (packet.links.approvalRecord && packet.links.approvalRecord.present && packet.links.approvalRecord.latestStatus === "Rejected") {
        packet.warnings.push("Latest approval record shows Rejected — verify re-approval exists");
      }

      // Optionally sync packet to Drive
      if (body.syncToDrive && jt.ppd && jt.ppd.driveFolderId) {
        try {
          const drive = await getDriveClient();
          const releasedFolder = await findOrCreateFolder(drive, "07_Released", jt.ppd.driveFolderId);
          // Create a packet manifest JSON file in the Released folder
          const manifestName = `${jt.jtNum || jt.id}_packet_manifest_${new Date().toISOString().slice(0, 10)}.json`;
          const manifestContent = JSON.stringify(packet, null, 2);
          const bufStream = require("stream").Readable.from([manifestContent]);
          await drive.files.create({
            requestBody: { name: manifestName, parents: [releasedFolder.id], mimeType: "application/json" },
            media: { mimeType: "application/json", body: bufStream },
            supportsAllDrives: true,
            fields: "id"
          });
          packet.manifestSynced = true;
        } catch (e) {
          packet.manifestSynced = false;
          packet.warnings.push("Drive manifest sync failed: " + e.message);
        }
      }

      // Persist packet snapshot in Firestore
      await db.collection("sqfReleasePackets").doc(jt.id + "_packet").set({
        ...packet,
        assembledAt: nowIso(),
        assembledBy: actor.email,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      await logServerEvent("packet.assembled", {
        actor: actor.email, jobTicketId: jt.id, jtNum: jt.jtNum || "",
        completeness: packet.completeness, gaps: packet.gaps.length
      });

      sendJson(res, 200, { success: true, ...packet });
    } catch (err) {
      console.error("assembleJobPacket error:", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// SCHEDULED: Check Overdue VPOs — Runs daily at 7:00 AM CT
// ═══════════════════════════════════════════════════════════════════
exports.scheduledCheckOverdueVPOs = onSchedule(
  { schedule: "every day 07:00", timeZone: "America/Chicago", memory: "256MiB", timeoutSeconds: 120 },
  async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const sentSnap = await db.collection("vendorPOs").where("status", "==", "sent").get();
      let overdueCount = 0, notifiedCount = 0;

      for (const doc of sentSnap.docs) {
        const vpo = doc.data();
        if (!vpo.eta) continue;
        const eta = new Date(vpo.eta);
        if (eta >= now) continue;
        overdueCount++;
        const daysOverdue = Math.round((now - eta) / (1000 * 60 * 60 * 24));
        if (vpo._overdueNotifiedDate === todayStr) continue;

        await doc.ref.update({ _overdueNotified: true, _overdueNotifiedDate: todayStr, overdueNotifiedAt: nowIso() });
        await db.collection("activity").add({
          type: "vpo.overdue", vpoId: doc.id, vpoNum: vpo.vpoNum || "", vendorName: vpo.vendorName || "",
          material: vpo.material || "", eta: vpo.eta, daysOverdue,
          timestamp: FieldValue.serverTimestamp(), source: "mfx-os-cron"
        });

        if (daysOverdue > 7) {
          await db.collection("sqfEscalations").add({
            type: "vpoOverdue", severity: daysOverdue > 14 ? "critical" : "major",
            data: { vpoId: doc.id, vpoNum: vpo.vpoNum, vendorName: vpo.vendorName, daysOverdue },
            createdAt: FieldValue.serverTimestamp(), createdAtIso: nowIso(),
            createdBy: "system-cron", status: "open",
            escalateTo: daysOverdue > 14 ? ["operations_manager", "ceo"] : ["purchasing_manager"]
          });
        }

        const chatWebhook = process.env.MFX_GCHAT_WEBHOOK || "";
        if (chatWebhook) {
          const msg = `🔴 *PO OVERDUE*\n${vpo.vpoNum || "?"} — ${vpo.vendorName || "?"}\n${vpo.material || ""}\nExpected: ${new Date(vpo.eta).toLocaleDateString("en-US")} (${daysOverdue}d ago)`;
          await fetch(chatWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }).catch(e => console.warn("Chat webhook:", e.message));
        }
        notifiedCount++;
      }

      await logServerEvent("vpo.overdue.cron", { overdueCount, notifiedCount });
      console.log(`checkOverdueVPOs cron: ${overdueCount} overdue, ${notifiedCount} notified`);
    } catch (err) {
      console.error("scheduledCheckOverdueVPOs error:", err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// SCHEDULED: Inbox Ingestion — Runs every 2 hours during business
// ═══════════════════════════════════════════════════════════════════
exports.scheduledInboxIngestCron = onSchedule(
  { schedule: "every 2 hours from 06:00 to 20:00", timeZone: "America/Chicago", memory: "256MiB", timeoutSeconds: 120 },
  async () => {
    try {
      const cfgSnap = await db.collection("config").doc("inboxIngest").get();
      const cfg = cfgSnap.exists ? cfgSnap.data() : {};
      const mailboxes = cfg.mailboxes || [];
      const query = cfg.query || "label:inbox is:unread";
      const maxResults = Math.min(Number(cfg.maxResults || 15), 50);

      if (mailboxes.length === 0) {
        console.log("scheduledInboxIngestCron: no mailboxes configured in config/inboxIngest");
        return;
      }

      let totalCreated = 0, totalScanned = 0;
      for (const mailbox of mailboxes) {
        const gmail = getDelegatedGmailClient(mailbox);
        if (!gmail) { console.warn(`No gmail client for ${mailbox}`); continue; }
        try {
          const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
          const messages = list.data.messages || [];
          let created = 0;
          for (const msg of messages) {
            const detail = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "metadata", metadataHeaders: ["From", "Subject", "To", "Date"] });
            const payload = detail.data || {};
            const headers = payload.payload && payload.payload.headers ? payload.payload.headers : [];
            const header = (name) => (headers.find((h) => h.name === name) || {}).value || "";
            const fromParts = parseEmailAddress(header("From"));
            const receivedAt = payload.internalDate ? new Date(Number(payload.internalDate)).toISOString() : nowIso();
            const record = {
              id: msg.id, provider: "gmail", source: "cronIngest", gmailMessageId: msg.id,
              gmailThreadId: payload.threadId || "", subject: header("Subject") || "New Email",
              snippet: payload.snippet || "", from: header("From"), fromEmail: fromParts.email,
              fromName: fromParts.name, to: header("To"),
              company: deriveCompanyFromMessage(header("Subject"), fromParts.name),
              mailbox, priority: "normal", status: "new",
              sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
              receivedAt, ingestQuery: query, assignedDept: "Pre-Press",
              linkedJobTicketId: "", linkedRequestId: ""
            };
            const wasCreated = await upsertPrepressInboxRecord(record);
            if (wasCreated) created++;
          }
          totalScanned += messages.length;
          totalCreated += created;
        } catch (e) {
          console.warn(`Inbox cron error for ${mailbox}:`, e.message);
        }
      }

      await logServerEvent("ppd.inbox.cron", { mailboxes: mailboxes.length, totalScanned, totalCreated });
      console.log(`inboxIngestCron: scanned ${totalScanned}, created ${totalCreated}`);
    } catch (err) {
      console.error("scheduledInboxIngestCron error:", err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// AI AGENT SYSTEM — FlexAi Governed Intelligence
// ═══════════════════════════════════════════════════════════════════

// HTTP endpoints
const { runAgent: aiRunAgent } = require("./workflows/http/runAgentHttp");
const { approveAgentAction } = require("./workflows/http/approveAgentActionHttp");
const { rejectAgentAction } = require("./workflows/http/rejectAgentActionHttp");
const { getRecommendations } = require("./workflows/http/getRecommendationsHttp");
const { getAgentHealth } = require("./workflows/http/getAgentHealthHttp");

exports.aiRunAgent = aiRunAgent;
exports.aiApproveAction = approveAgentAction;
exports.aiRejectAction = rejectAgentAction;
exports.aiGetRecommendations = getRecommendations;
exports.aiGetHealth = getAgentHealth;

// Firestore triggers
const { onQuoteWrite: aiOnQuoteWrite } = require("./workflows/firestore/onQuoteWrite");
const { onJobTicketWrite: aiOnJobTicketWrite } = require("./workflows/firestore/onJobTicketWrite");
const { onNCRWrite: aiOnNCRWrite } = require("./workflows/firestore/onNCRWrite");
const { onVendorPOWrite: aiOnVendorPOWrite } = require("./workflows/firestore/onVendorPOWrite");
const { onRequestCreate: aiOnRequestCreate } = require("./workflows/firestore/onRequestCreate");
const { onTrainingRecordWrite: aiOnTrainingRecordWrite } = require("./workflows/firestore/onTrainingRecordWrite");

exports.aiOnQuoteWrite = aiOnQuoteWrite;
exports.aiOnJobTicketWrite = aiOnJobTicketWrite;
exports.aiOnNCRWrite = aiOnNCRWrite;
exports.aiOnVendorPOWrite = aiOnVendorPOWrite;
exports.aiOnRequestCreate = aiOnRequestCreate;
exports.aiOnTrainingRecordWrite = aiOnTrainingRecordWrite;

// Scheduled sweeps
const { dailyLeadershipDigest } = require("./workflows/scheduled/dailyLeadershipDigest");
const { overdueQuoteSweep } = require("./workflows/scheduled/overdueQuoteSweep");
const { lowStockSweep } = require("./workflows/scheduled/lowStockSweep");
const { trainingExpirySweep } = require("./workflows/scheduled/trainingExpirySweep");
const { openCAPASweep } = require("./workflows/scheduled/openCAPASweep");

exports.aiDailyLeadershipDigest = dailyLeadershipDigest;
exports.aiOverdueQuoteSweep = overdueQuoteSweep;
exports.aiLowStockSweep = lowStockSweep;
exports.aiTrainingExpirySweep = trainingExpirySweep;
exports.aiOpenCAPASweep = openCAPASweep;
