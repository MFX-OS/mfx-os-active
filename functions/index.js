const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

// 2026-05-27: Gmail service account JSON for domain-wide-delegated sends
// (info/flex@microflexfilm.com via gmail.send scope). Set with:
//   firebase functions:secrets:set GMAIL_SERVICE_ACCOUNT_JSON
// Then paste the entire service-account JSON file when prompted. Any
// function that uses sendDelegatedEmail() or getDelegatedGmailClient()
// must include this secret in its options.secrets list so the runtime
// injects it into process.env at cold start.
const GMAIL_SA_SECRET = defineSecret("GMAIL_SERVICE_ACCOUNT_JSON");
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
const DOCS_SCOPE = ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"];
// Split read vs send so the inbox-ingest path doesn't request send rights
// it doesn't need, and the auto-email path actually has send scope.
// Both must be added to domain-wide delegation in Workspace admin.
const GMAIL_READ_SCOPE = ["https://www.googleapis.com/auth/gmail.readonly"];
const GMAIL_SEND_SCOPE = ["https://www.googleapis.com/auth/gmail.send"];
const GMAIL_SCOPE = GMAIL_READ_SCOPE; // legacy alias — old callers default to read
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

      // DATA-15 follow-up fix (2026-05-24): use set(...,{merge:true}) instead
      // of update() so the FIRST call for a user (whose _rateLimits doc has
      // never been created — true for everyone post-SEC-10, since the rate
      // check was broken by IAM until now) doesn't throw NOT_FOUND.
      tx.set(ref, { count: data.count + 1, windowStart: data.windowStart, uid, action, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      _rateLimitCache.set(key, { count: data.count + 1, windowStart: data.windowStart });
      return true;
    });
    return result;
  } catch (err) {
    console.warn("Rate limit check failed, denying:", err.message);
    return false; // fail closed
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

function getDelegatedGmailClient(mailbox, scopes) {
  const raw = process.env.GMAIL_SERVICE_ACCOUNT_JSON || "";
  if (!raw || !mailbox) return null;
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    scopes || GMAIL_READ_SCOPE,
    mailbox
  );
  return google.gmail({ version: "v1", auth });
}

// Send an HTML email via the delegated Gmail service account.
// Encodes recipients in standard RFC 822 headers (To, Bcc, Subject).
// Returns the Gmail message id on success, null on failure (logged).
async function sendDelegatedEmail({ from, to, bcc, subject, html, replyTo }) {
  if (!from || !to || !subject || !html) {
    console.warn("sendDelegatedEmail: missing required fields");
    return null;
  }
  const gmail = getDelegatedGmailClient(from, GMAIL_SEND_SCOPE);
  if (!gmail) {
    console.warn(`sendDelegatedEmail: no delegated client for ${from} (set GMAIL_SERVICE_ACCOUNT_JSON + domain-wide delegation with gmail.send scope)`);
    return null;
  }
  const headers = [
    `From: ${from}`,
    `To: ${to}`
  ];
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  headers.push(`Subject: ${subject}`);
  headers.push(`MIME-Version: 1.0`);
  headers.push(`Content-Type: text/html; charset=UTF-8`);
  const raw = headers.join("\r\n") + "\r\n\r\n" + html;
  // Gmail requires URL-safe base64
  const encoded = Buffer.from(raw, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    const r = await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
    return r.data && r.data.id ? r.data.id : null;
  } catch (err) {
    console.error(`sendDelegatedEmail failed (${from} -> ${to}):`, err.message);
    return null;
  }
}

// Build the SO confirmation email HTML — branded, matches Quote look-and-feel.
// Leads with the "Sign in Google Drive" CTA when signingDocLink is available
// (the auto-flow always tries to create one). Portal link is the backup path.
function buildSOConfirmationEmail({ soNum, quoteNum, company, contact, jobDesc, selectedQty, ppu, total, payTerms, portalUrl, signingDocLink, ceoSignedBy, ceoSignedAt }) {
  const fmt$ = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtN = (n) => Number(n || 0).toLocaleString();
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#0a1929;padding:24px 32px;border-bottom:3px solid #00b4d8">
    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">MICROFLEX FILM CORPORATION</div>
    <div style="color:#94a3b8;font-size:11px;margin-top:4px;letter-spacing:2px">SALES ORDER · ACTION REQUIRED</div>
  </div>
  <div style="padding:32px">
    <p style="color:#0f172a;font-size:14px;margin:0 0 16px">Hello ${contact || "there"},</p>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 20px">
      Thank you for your purchase order. We've created Sales Order
      <strong style="color:#0a1929">${soNum}</strong> from your accepted quote
      <strong>${quoteNum || ""}</strong>${ceoSignedBy ? `, already signed by <strong>${ceoSignedBy}</strong> on behalf of Microflex` : ""}.
      <strong>Please review and countersign</strong> to lock in pricing and lead time.
    </p>
    ${ceoSignedBy ? `<div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:6px;padding:14px 18px;margin:0 0 20px;display:flex;align-items:center;gap:14px">
      <div style="font-size:24px;line-height:1">✓</div>
      <div style="flex:1">
        <div style="color:#15803d;font-size:10px;font-weight:700;letter-spacing:1.5px">SIGNED BY MICROFLEX</div>
        <div style="font-size:18px;font-family:Georgia,serif;font-style:italic;color:#0a1929;font-weight:700;line-height:1.2;margin-top:2px">${ceoSignedBy}</div>
        <div style="color:#15803d;font-size:10px;margin-top:2px">${ceoSignedAt ? new Date(ceoSignedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : ""}</div>
      </div>
    </div>` : ""}
    ${signingDocLink ? `<div style="background:#f0fdf4;border:1.5px solid #16a34a;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
      <div style="color:#15803d;font-size:11px;font-weight:700;letter-spacing:2px;margin-bottom:8px">SIGN IN GOOGLE DRIVE</div>
      <a href="${signingDocLink}" style="background:#16a34a;color:#ffffff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Open & Sign Sales Order</a>
      <div style="color:#15803d;font-size:11px;margin-top:10px;line-height:1.5">
        Opens in Google Docs. Type your name and today's date in the signature lines, then save — your signed copy lives in your Sales Order folder automatically.
      </div>
    </div>` : ""}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;width:140px">Sales Order #</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700">${soNum}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Quote #</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px">${quoteNum || "—"}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Company</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px">${company || "—"}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Job</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px">${jobDesc || "—"}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Quantity</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px">${fmtN(selectedQty)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">Unit Price</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px">$${Number(ppu || 0).toFixed(4)}</td></tr>
      <tr><td style="padding:14px 0;color:#64748b;font-size:12px">Total</td><td style="padding:14px 0;color:#0a1929;font-size:18px;font-weight:700">${fmt$(total)}</td></tr>
    </table>
    <p style="color:#64748b;font-size:11px;line-height:1.5;margin:0 0 16px">
      Payment terms: <strong>${payTerms || "Net 30"}</strong>.
    </p>
    ${portalUrl ? `<div style="text-align:center;margin:20px 0">
      <a href="${portalUrl}" style="background:#00b4d8;color:#ffffff;padding:10px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px;display:inline-block">View Full Details in Portal</a>
    </div>` : ""}
    <p style="color:#64748b;font-size:11px;margin:24px 0 0;line-height:1.5">
      Questions? Reply to this email or contact our team at
      <a href="mailto:quotes@microflexfilm.com" style="color:#00b4d8;text-decoration:none">quotes@microflexfilm.com</a>.
    </p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">
    Microflex Film Corporation · Los Angeles, CA · microflexfilm.com
  </div>
</div></body></html>`;
}


async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPE });
  return google.drive({ version: "v3", auth });
}

async function getDocsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: DOCS_SCOPE });
  return google.docs({ version: "v1", auth });
}

// Create a Google Doc copy of the SO inside the per-quote SO folder,
// populated via Docs API batchUpdate, then share with the client as
// editor so they can type their signature directly in the Doc.
// Returns { docId, docLink, folderId } so the caller can persist the
// link on the salesOrders doc and include it in the auto-email.
async function createSOSigningDoc(so) {
  if (!so || !so.soNum) throw new Error("createSOSigningDoc: so + soNum required");
  const drive = await getDriveClient();
  const docs = await getDocsClient();
  const driveId = await getMFXCoreId(drive);
  if (!driveId) throw new Error(`${DRIVE_NAME} shared drive not found`);

  // Same folder tree as the SO PDF: Clients/<Co>/<QuoteNum>/SO/
  const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
  const companyFolder = await findOrCreateFolder(drive, safeName(so.company || "Unknown"), clientsFolder.id);
  const quoteFolder = await findOrCreateFolder(drive, safeName(so.quoteNum || so.soNum), companyFolder.id);
  const soFolder = await findOrCreateFolder(drive, "SO", quoteFolder.id);

  // 1. Create empty Google Doc inside the SO folder
  const docName = `${so.soNum} — Sales Order (Sign Here)`;
  const created = await drive.files.create({
    requestBody: {
      name: docName,
      mimeType: "application/vnd.google-apps.document",
      parents: [soFolder.id]
    },
    supportsAllDrives: true,
    fields: "id,webViewLink"
  });
  const docId = created.data.id;
  const docLink = created.data.webViewLink || `https://docs.google.com/document/d/${docId}/edit`;

  // 2. Populate via Docs API. We insert from the end backwards so each
  //    insert keeps later index positions stable.
  const fmt$ = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtN = (n) => Number(n || 0).toLocaleString();
  const dateStr = new Date(so.createdAt || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const body =
    `SALES ORDER\n` +
    `${so.soNum}\n` +
    `\n` +
    `Microflex Film Corporation\n` +
    `4130 Garner Rd · Riverside, CA 92501 · (909) 360-9066\n` +
    `\n` +
    `─────────────────────────────────────────────\n` +
    `\n` +
    `BILL TO\n` +
    `${so.company || ""}\n` +
    `${so.contact || ""}\n` +
    `${so.email || ""}\n` +
    `${so.phone || ""}\n` +
    `\n` +
    `SHIP TO\n` +
    `${so.shipTo || so.company || ""}\n` +
    `\n` +
    `─────────────────────────────────────────────\n` +
    `\n` +
    `ORDER DETAILS\n` +
    `Sales Order #:  ${so.soNum}\n` +
    `Quote #:        ${so.quoteNum || ""}  (Rev ${so.quoteRev || "A"})\n` +
    `PO Number:      ${so.poNumber || "—"}\n` +
    `Order Date:     ${dateStr}\n` +
    `Payment Terms:  ${so.payTerms || "Net 30"}\n` +
    `\n` +
    `JOB\n` +
    `${so.jobDesc || ""}\n` +
    `\n` +
    `Size:      ${so.sizeA || "?"}" × ${so.sizeB || "?"}"\n` +
    `Shape:     ${so.shapeType || ""}\n` +
    `Colors:    ${so.colors || ""}\n` +
    `Material:  ${so.face || ""}  /  Lam: ${so.laminate || "NA"}  /  Coating: ${so.coating || "NA"}\n` +
    `\n` +
    `PRICING\n` +
    `Quantity:    ${fmtN(so.selectedQty)}\n` +
    `Unit Price:  $${Number(so.ppu || 0).toFixed(4)}\n` +
    `TOTAL:       ${fmt$(so.total)}\n` +
    `\n` +
    `─────────────────────────────────────────────\n` +
    `\n` +
    `TERMS & CONDITIONS\n` +
    `• Lead time is 15 working days from proof sign-off.\n` +
    `• Quantities shipped are ±10% of order quantity.\n` +
    `• Art will be billed at $90.00/hour if not in AI format.\n` +
    `• Plates, dies, and tooling remain property of Microflex until paid in full.\n` +
    `• All finished goods comply with FDA Title 21 CFR Sections 174–178.\n` +
    `\n` +
    `─────────────────────────────────────────────\n` +
    `\n` +
    `CLIENT SIGNATURE\n` +
    `\n` +
    `To approve this Sales Order, please type your full name and today's\n` +
    `date in the lines below, then save. Your signature locks in pricing\n` +
    `and lead time as quoted.\n` +
    `\n` +
    `\n` +
    `Signed by:  ____________________________________________\n` +
    `\n` +
    `Title:      ____________________________________________\n` +
    `\n` +
    `Date:       ____________________________________________\n` +
    `\n` +
    `Company:    ${so.company || ""}\n` +
    `\n`;

  const requests = [
    { insertText: { location: { index: 1 }, text: body } },
    // Make the very top "SALES ORDER" line big and bold
    { updateTextStyle: {
        range: { startIndex: 1, endIndex: 13 },
        textStyle: { bold: true, fontSize: { magnitude: 22, unit: "PT" } },
        fields: "bold,fontSize"
    }},
    // Make the SO number line big
    { updateTextStyle: {
        range: { startIndex: 13, endIndex: 13 + so.soNum.length + 1 },
        textStyle: { bold: true, fontSize: { magnitude: 18, unit: "PT" } },
        fields: "bold,fontSize"
    }}
  ];

  try {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests }
    });
  } catch (err) {
    console.warn(`createSOSigningDoc batchUpdate failed for ${docId}:`, err.message);
    // Doc still exists, just plain — don't fail the whole flow
  }

  // 3. Share with client email as writer/editor. They can type signature.
  if (so.email) {
    try {
      await drive.permissions.create({
        fileId: docId,
        supportsAllDrives: true,
        sendNotificationEmail: false, // we send our own branded email
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: String(so.email).toLowerCase()
        }
      });
    } catch (err) {
      const msg = (err && err.message) || String(err);
      if (msg.indexOf("already exists") === -1) {
        console.warn(`createSOSigningDoc share with ${so.email} failed: ${msg}`);
      }
    }
  }

  return { docId, docLink, folderId: soFolder.id };
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

// Portal client requests an upload folder for files larger than the
// 50MB Cloud Function cap. We create/find the per-quote sub-folder,
// share it with the client's email as a writer, and return the link.
// The client uploads directly to Drive; files appear in the same
// /Clients/<Co>/<Quote#>/<PO|Art>/ tree as direct uploads.
// Diagnostic: returns the service-account email the function is running
// as, plus the list of shared drives that SA can currently see. Use this
// to figure out who to share MFX-CORE with. Requires internal auth so
// it doesn't leak project info publicly.
exports.driveAccessDiagnostic = onRequest(
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

exports.getPortalUploadFolder = onRequest(
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

exports.nextSequence = onRequest(
  { memory: "256MiB", timeoutSeconds: 60, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    // DATA-15 follow-up (2026-05-24): bumped from 10/min to 30/min so bulk
    // quote creation (e.g. importing a stack of RFQs in one session) doesn't
    // hit the wall. Still abuse-proof: server is the sole source of sequence
    // numbers, so even at 30/min an attacker can only burn ~1800 numbers/hr
    // and we'd see it in audit logs immediately.
    if (!(await enforceRateLimit(req, res, actor.uid, "nextSequence", 30, 60000))) return;
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
  },
  // Project lifecycle
  projects: {
    field: "status",
    transitions: {
      "open": ["closed"],
      "closed": ["open"]
    },
    roleGates: {
      "closed": ["ceo", "admin", "administrator", "owner", "operations manager", "manager"]
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
      // Restrict to known collections only
      const ALLOWED_COLLECTIONS = ['quotes','salesOrders','vendorPOs','jobTickets','ncrs','requests','prepressInbox','tasks','projects'];
      if (!ALLOWED_COLLECTIONS.includes(collection)) {
        return sendJson(res, 400, { error: "Invalid collection: " + collection });
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

      // SO transitions trigger two distinct side-effect families:
      //   1. pending → approved: CEO has signed off. THIS is the moment we
      //      finally create the Google Doc signing surface, share it with
      //      the client, send the branded confirmation email, and advance
      //      the SO to 'sent' (sentAt stamped). Before this commit, all of
      //      that ran the moment the PO was submitted — bypassing CEO
      //      review. Now it strictly waits for approval.
      //   2. → production / shipped / complete / cancelled: notify client
      //      with a stage-appropriate update.
      if (collection === "salesOrders") {
        const so = { id: docId, ...data, ...update };
        // ─── 1. Approval → create Doc + email client + auto-advance to sent
        if (newStatus === "approved" && currentStatus === "pending") {
          try {
            // a. Create the Google Doc (idempotent — skip if already exists)
            let signingDocLink = so.signingDocLink || null;
            let signingDocId = so.signingDocId || null;
            if (!signingDocId) {
              try {
                const signingDoc = await createSOSigningDoc(so);
                signingDocLink = signingDoc.docLink;
                signingDocId = signingDoc.docId;
                await docRef.update({
                  signingDocId,
                  signingDocLink,
                  signingDocFolderId: signingDoc.folderId,
                  signingDocCreatedAt: nowIso(),
                  updatedAt: nowIso()
                });
                await logServerEvent("so.signing_doc_created", {
                  soId: docId, soNum: so.soNum || "", docId: signingDocId, sharedWith: so.email
                });
              } catch (docErr) {
                console.warn(`createSOSigningDoc failed on approve for ${so.soNum}:`, docErr.message);
                await logServerEvent("so.signing_doc_failed", {
                  soId: docId, soNum: so.soNum || "", error: docErr.message, phase: "approval"
                });
              }
            }
            // b. Send branded confirmation email with sign CTA
            const portalHost = process.env.PORTAL_HOST || "https://mfx-2026.web.app";
            const portalUrl = so.quoteId
              ? `${portalHost}/portal.html?quoteId=${encodeURIComponent(so.quoteId)}&email=${encodeURIComponent(so.email)}`
              : portalHost;
            const senderMailbox = process.env.SO_FROM_MAILBOX || "flex@microflexfilm.com";
            const html = buildSOConfirmationEmail({
              soNum: so.soNum,
              quoteNum: so.quoteNum || "",
              company: so.company || "",
              contact: so.contact || "",
              jobDesc: so.jobDesc,
              selectedQty: so.selectedQty || 0,
              ppu: so.ppu || 0,
              total: so.total || 0,
              payTerms: so.payTerms || "Net 30",
              portalUrl,
              signingDocLink,
              ceoSignedBy: so.ceoSignedBy,
              ceoSignedAt: so.ceoSignedAt
            });
            const msgId = await sendDelegatedEmail({
              from: senderMailbox,
              to: so.email,
              bcc: "team@microflexfilm.com, quotes@microflexfilm.com",
              subject: `Sales Order ${so.soNum} — ${so.company || "Microflex"}`,
              replyTo: "quotes@microflexfilm.com",
              html
            });
            if (msgId) {
              // c. Advance to 'sent' status with sentAt stamped — same
              // single user action gets us approved → sent automatically.
              await docRef.update({
                status: "sent",
                sentAt: nowIso(),
                sentTo: so.email,
                updatedAt: nowIso(),
                notes: FieldValue.arrayUnion({
                  text: `✉ Auto-sent after CEO approval to ${so.email} (Gmail msg ${msgId})`,
                  by: "System",
                  at: nowIso()
                })
              });
              await logServerEvent("so.approved_and_sent", {
                soId: docId, soNum: so.soNum || "", to: so.email, gmailMessageId: msgId
              });
            } else {
              await docRef.update({
                notes: FieldValue.arrayUnion({
                  text: `⚠ Approval succeeded but auto-send failed — staff will send manually.`,
                  by: "System",
                  at: nowIso()
                })
              });
              await logServerEvent("so.approved_send_failed", {
                soId: docId, soNum: so.soNum || "", to: so.email
              });
            }
          } catch (notifyErr) {
            console.warn("SO approval side-effects failed (status still updated):", notifyErr.message);
          }
        }
        // ─── 2. Other downstream status changes (production/shipped/etc)
        else {
          try {
            const msgId = await sendSOStatusChangeNotification(so, newStatus, req.body || {});
            if (msgId) {
              await docRef.update({
                [`statusEmails.${newStatus}.sentAt`]: nowIso(),
                [`statusEmails.${newStatus}.gmailMessageId`]: msgId
              });
              await logServerEvent("so.status_email_sent", {
                soId: docId, soNum: so.soNum || "",
                from: currentStatus, to: newStatus, gmailMessageId: msgId
              });
            }
          } catch (notifyErr) {
            console.warn("SO status email failed (transition still succeeded):", notifyErr.message);
          }
        }
      }

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
// PORTAL PO SUBMIT — Transition quote to 'won' when client signs PO
// Allows any authenticated user (portal clients) — scoped to quotes only
// ═══════════════════════════════════════════════════════════════════
const CORS_PORTAL = ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"];

exports.portalSubmitPO = onRequest(
  { memory: "256MiB", timeoutSeconds: 30, cors: CORS_PORTAL },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireAnyUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "portalSubmitPO", 5, 60000))) return;
    try {
      const { quoteId } = req.body || {};
      if (!quoteId || typeof quoteId !== "string") {
        return sendJson(res, 400, { error: "Missing quoteId" });
      }

      const quoteRef = db.collection("quotes").doc(quoteId);
      const snap = await quoteRef.get();
      if (!snap.exists) return sendJson(res, 404, { error: "Quote not found" });

      const quote = snap.data();

      // Verify the caller's email matches the quote's client email
      const callerEmail = String(actor.email || "").toLowerCase();
      const quoteClientEmail = String(quote.poClientEmail || "").toLowerCase();
      const quoteCustEmail = String((quote.fields || {}).custEmail || "").toLowerCase();
      if (callerEmail !== quoteClientEmail && callerEmail !== quoteCustEmail) {
        return sendJson(res, 403, { error: "Email mismatch — not authorized for this quote" });
      }

      // Only allow transition if PO data is present
      if (!quote.poSignature || !quote.poNumber) {
        return sendJson(res, 400, { error: "PO signature and number required before marking as won" });
      }

      // Only transition from 'sent' → 'won'
      if (quote.status !== "sent") {
        return sendJson(res, 400, { error: "Quote must be in 'sent' status (current: " + quote.status + ")" });
      }

      await quoteRef.update({
        status: "won",
        closedAt: new Date().toISOString(),
        wonDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await logServerEvent("portal.po_submitted", {
        quoteId,
        quoteNum: quote.quoteNum || "",
        company: (quote.fields || {}).custCo || "",
        clientEmail: callerEmail
      });

      // ═══ AUTO-CREATE SALES ORDER ═══
      // Check if SO already exists for this quote
      const existingSOSnap = await db.collection("salesOrders")
        .where("quoteId", "==", quoteId).limit(1).get();

      let autoSONum = null;
      if (existingSOSnap.empty) {
        // Generate SO number
        const seqDoc = db.collection("systemCounters").doc("salesOrder");
        const seqSnap = await seqDoc.get();
        const now = new Date();
        const bucket = String(now.getFullYear()).slice(-2) + String(now.getMonth() + 1).padStart(2, "0");
        let seq = 1;
        if (seqSnap.exists && seqSnap.data().bucket === bucket) {
          seq = (seqSnap.data().seq || 0) + 1;
        }
        await seqDoc.set({ bucket, seq }, { merge: true });
        autoSONum = "SO" + bucket + "-" + String(seq).padStart(3, "0");

        const f = quote.fields || {};
        const selIdx = quote.poQtyIndex || 0;
        const selRow = (quote.qtys && quote.qtys[selIdx]) ? quote.qtys[selIdx] : { qty: 0, ppu: 0, total: 0 };
        const soId = "so_" + Date.now();
        const soDoc = {
          id: soId,
          soNum: autoSONum,
          quoteId: quoteId,
          quoteNum: quote.quoteNum || "",
          quoteRev: quote.rev || "",
          status: "pending",
          company: f.custCo || "",
          contact: f.custAttn || "",
          email: f.custEmail || quote.poClientEmail || callerEmail,
          phone: f.phone || "",
          industry: f.industry || "",
          cityState: f.cityState || "",
          shipTo: quote.poShipTo || f.cityState || "",
          poNumber: quote.poNumber || "",
          poSignature: quote.poSignature || "",
          poSignedAt: quote.poSignedAt || "",
          poInstructions: quote.poInstructions || "",
          poFiles: quote.poFiles || [],
          jobDesc: (f.sA || "?") + "x" + (f.sar || "?") + '" ' + (f.shapeType || "") + " - " + (f.colors || "?") + "C " + (f.jobType || "Flexo"),
          sizeA: f.sA || "",
          sizeB: f.sar || "",
          shapeType: f.shapeType || "",
          colors: f.colors || "",
          jobType: f.jobType || "",
          face: f.face || f.faceStock || "",
          laminate: f.laminate || f.lamination || "",
          coating: f.coating || "",
          windDir: f.windDir || f.copyPos || "",
          selectedQtyIndex: selIdx,
          selectedQty: selRow.qty || 0,
          ppu: selRow.ppu || 0,
          total: selRow.total || 0,
          allQtys: quote.qtys || [],
          terms: quote.terms || [],
          estimator: f.estimator || "",
          payTerms: f.payTerms || "Net 30",
          createdAt: nowIso(),
          createdBy: "System (Auto — Portal PO)",
          updatedAt: nowIso(),
          updatedBy: "System (Auto — Portal PO)",
          approvedBy: null,
          approvedAt: null,
          sentAt: null,
          sentTo: null,
          driveLink: null,
          notes: [{ text: "📋 Auto-created from " + (quote.quoteNum || quoteId) + " (PO# " + (quote.poNumber || "N/A") + " submitted via Client Portal)", by: "System", at: nowIso() }]
        };

        await db.collection("salesOrders").doc(soId).set(soDoc);
        await logServerEvent("so.auto_created", {
          soId, soNum: autoSONum, quoteId,
          quoteNum: quote.quoteNum || "",
          company: f.custCo || "",
          total: selRow.total || 0
        });

        // NOTE: Google Doc creation + client email are intentionally
        // deferred to CEO approval. The flow is now:
        //   PO submitted → SO created (status=pending) → CEO notification
        //   CEO approves → Google Doc created + email sent + status=sent
        // See transitionStatus side-effect block for the approval handler.

        // Post notification for CEO approval
        const mgmtSnap = await db.collection("users")
          .where("role", "in", ["CEO", "ceo", "Admin", "admin", "Operations Manager"]).limit(5).get();
        const notifBatch = db.batch();
        mgmtSnap.docs.forEach(u => {
          const notifRef = db.collection("notifications").doc();
          notifBatch.set(notifRef, {
            type: "alert",
            title: "New Sales Order — " + autoSONum,
            body: (f.custCo || "Client") + " · $" + Number(selRow.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + " · Auto-created from " + (quote.quoteNum || "quote"),
            icon: "📋",
            from: "System",
            userId: u.id,
            sourceView: "orders",
            sourceId: soId,
            read: false,
            dismissed: false,
            priority: "high",
            timestamp: FieldValue.serverTimestamp()
          });
        });
        await notifBatch.commit();
      }

      sendJson(res, 200, { success: true, status: "won", autoSO: autoSONum });
    } catch (err) {
      console.error("portalSubmitPO error", err);
      sendJson(res, 500, { error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// PORTAL EMAIL BACKFILL — one-shot maintenance endpoint (2026-05-27)
// Walks /quotes and stamps poClientEmail = lowercased fields.custEmail
// (or existing poClientEmail) wherever it's missing or mixed-case.
// Need: Firestore queries are exact-case but Firebase Auth normalizes
// magic-link emails to lowercase, so quotes stored with mixed-case
// emails were invisible on the client portal even though firestore.rules
// .lower()-matches at read time. Run this once after deploy; idempotent.
// ═══════════════════════════════════════════════════════════════════
exports.backfillPortalEmails = onRequest(
  { memory: "512MiB", timeoutSeconds: 540, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    const dryRun = !!(req.body && req.body.dryRun);
    const batchSize = 400;
    let scanned = 0, updated = 0, skipped = 0, lastDocId = null;
    const samples = [];
    try {
      let query = db.collection("quotes").orderBy("__name__").limit(batchSize);
      while (true) {
        if (lastDocId) query = db.collection("quotes").orderBy("__name__").startAfter(lastDocId).limit(batchSize);
        const snap = await query.get();
        if (snap.empty) break;
        const writer = db.batch();
        let batchWrites = 0;
        snap.docs.forEach(doc => {
          scanned++;
          lastDocId = doc.id;
          const d = doc.data() || {};
          const f = d.fields || {};
          const custEmail = String(f.custEmail || "").trim();
          const currentPo = String(d.poClientEmail || "").trim();
          // Canonical key: existing poClientEmail wins (someone may have set
          // it deliberately to a different contact), else fall back to custEmail.
          const canonical = (currentPo || custEmail).toLowerCase();
          if (!canonical || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonical)) {
            skipped++;
            return;
          }
          if (canonical === currentPo) {
            skipped++;
            return;
          }
          if (samples.length < 25) {
            samples.push({ quoteId: doc.id, quoteNum: d.quoteNum || "", before: currentPo, after: canonical });
          }
          if (!dryRun) {
            writer.update(doc.ref, { poClientEmail: canonical, updatedAt: nowIso() });
            batchWrites++;
          }
          updated++;
        });
        if (!dryRun && batchWrites > 0) await writer.commit();
        if (snap.size < batchSize) break;
      }
      // ─── SECOND PASS: /salesOrders.email lowercased ────────────────
      // SO list query on the portal is where('email','==', authToken.email)
      // which is exact-case. Stored value must be lowercase to surface.
      let soScanned = 0, soUpdated = 0, soSkipped = 0, soLast = null;
      const soSamples = [];
      while (true) {
        let soQuery = db.collection("salesOrders").orderBy("__name__").limit(batchSize);
        if (soLast) soQuery = db.collection("salesOrders").orderBy("__name__").startAfter(soLast).limit(batchSize);
        const soSnap = await soQuery.get();
        if (soSnap.empty) break;
        const soWriter = db.batch();
        let soBatchWrites = 0;
        soSnap.docs.forEach(doc => {
          soScanned++;
          soLast = doc.id;
          const d = doc.data() || {};
          const cur = String(d.email || "").trim();
          const lower = cur.toLowerCase();
          if (!cur || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
            soSkipped++;
            return;
          }
          if (cur === lower) {
            soSkipped++;
            return;
          }
          if (soSamples.length < 25) {
            soSamples.push({ soId: doc.id, soNum: d.soNum || "", before: cur, after: lower });
          }
          if (!dryRun) {
            soWriter.update(doc.ref, { email: lower, updatedAt: nowIso() });
            soBatchWrites++;
          }
          soUpdated++;
        });
        if (!dryRun && soBatchWrites > 0) await soWriter.commit();
        if (soSnap.size < batchSize) break;
      }

      await logServerEvent("portal.backfillEmails", { actor: actor.email, dryRun, scanned, updated, skipped, soScanned, soUpdated, soSkipped });
      sendJson(res, 200, {
        success: true,
        dryRun,
        quotes: { scanned, updated, skipped, samples },
        salesOrders: { scanned: soScanned, updated: soUpdated, skipped: soSkipped, samples: soSamples }
      });
    } catch (err) {
      console.error("backfillPortalEmails error", err);
      sendJson(res, 500, { error: err.message, scanned, updated });
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
// SAVE SALES ORDER PDF — Backend Drive save mirroring saveQuotePDF
// Accepts base64-encoded PDF blob, uploads to Drive (Master + Client),
// updates the salesOrders doc with driveLink + clientFolderLink.
// ═══════════════════════════════════════════════════════════════════
exports.saveSalesOrderPDF = onRequest(
  { memory: "512MiB", timeoutSeconds: 120, cors: ["https://mfx-2026.web.app","https://mfx-2026.firebaseapp.com","http://localhost:5000"] },
  async (req, res) => {
    if (!ensurePost(req, res)) return;
    const actor = await requireInternalUser(req, res);
    if (!actor) return;
    if (!(await enforceRateLimit(req, res, actor.uid, "saveSalesOrderPDF", 10, 60000))) return;
    try {
      const body = req.body || {};
      const soId = body.soId;
      const soNum = body.soNum;
      const quoteNum = body.quoteNum || soNum;
      const company = body.company;
      const filename = body.filename || `${soNum}.pdf`;
      const pdfBase64 = body.pdfBase64;
      if (!soId || !soNum || !company) {
        return sendJson(res, 400, { error: "soId, soNum, and company required" });
      }

      const drive = await getDriveClient();
      const driveId = await getMFXCoreId(drive);
      if (!driveId) throw new Error(`${DRIVE_NAME} shared drive not found`);

      const results = { masterLink: null, clientLink: null };

      // Decode the PDF blob if provided — otherwise we create placeholders
      // (the file metadata-only path matches how saveQuotePDF works today,
      // so the client can either pass the blob or rely on a separate upload).
      let pdfBuffer = null;
      if (pdfBase64) {
        try {
          pdfBuffer = Buffer.from(pdfBase64, 'base64');
        } catch (e) {
          return sendJson(res, 400, { error: "Invalid pdfBase64 payload" });
        }
      }

      const uploadPdf = async (parentId) => {
        if (pdfBuffer) {
          const created = await drive.files.create({
            requestBody: { name: safeName(filename), parents: [parentId], mimeType: "application/pdf" },
            media: { mimeType: "application/pdf", body: require('stream').Readable.from(pdfBuffer) },
            supportsAllDrives: true,
            fields: "id,webViewLink"
          });
          return created.data;
        }
        const placeholder = await drive.files.create({
          requestBody: { name: safeName(filename), parents: [parentId], mimeType: "application/pdf" },
          supportsAllDrives: true,
          fields: "id,webViewLink"
        });
        return placeholder.data;
      };

      // 1. Save to Master Sales Orders folder (replace if exists)
      const masterFolder = await findOrCreateFolder(drive, "Master Sales Orders", driveId);
      const masterSearch = `name contains '${qEscape(soNum)}' and trashed=false and '${masterFolder.id}' in parents`;
      const masterExisting = await drive.files.list({
        q: masterSearch, supportsAllDrives: true, includeItemsFromAllDrives: true,
        corpora: "allDrives", fields: "files(id,name)"
      });
      if (masterExisting.data.files && masterExisting.data.files.length) {
        // Delete old so the new one replaces cleanly
        try { await drive.files.delete({ fileId: masterExisting.data.files[0].id, supportsAllDrives: true }); } catch (_) {}
      }
      const masterFile = await uploadPdf(masterFolder.id);
      results.masterLink = masterFile.webViewLink || `https://drive.google.com/file/d/${masterFile.id}`;
      results.masterFileId = masterFile.id;

      // 2. Save to Client folder — same tree as quote PDF saved by saveQuotePDF
      const clientsFolder = await findOrCreateFolder(drive, "Clients", driveId);
      const companyFolder = await findOrCreateFolder(drive, safeName(company), clientsFolder.id);
      const quoteFolder = await findOrCreateFolder(drive, safeName(quoteNum), companyFolder.id);
      const clientFile = await uploadPdf(quoteFolder.id);
      results.clientLink = clientFile.webViewLink || `https://drive.google.com/file/d/${clientFile.id}`;
      results.clientFileId = clientFile.id;
      results.clientFolderId = quoteFolder.id;

      // 3. Update the SO doc — driveLink shown on portal + internal UI
      const soRef = db.collection("salesOrders").doc(soId);
      const soSnap = await soRef.get();
      if (soSnap.exists) {
        await soRef.update({
          driveLink: results.masterLink,
          clientFolderLink: results.clientLink,
          driveSavedAt: nowIso(),
          updatedAt: nowIso(),
          updatedBy: actor.email || "System"
        });
      }

      await logServerEvent("so.pdf.saved", {
        actor: actor.email, soId, soNum, company,
        masterFileId: results.masterFileId, hasPdfBlob: !!pdfBuffer
      });
      sendJson(res, 200, { success: true, ...results });
    } catch (err) {
      console.error("saveSalesOrderPDF error:", err);
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
// ═══════════════════════════════════════════════════════════════════
// SO SIGNING DETECTION + STATUS CHANGE EMAILS
// ═══════════════════════════════════════════════════════════════════

// Walk a Google Doc body for the "Signed by:" line and extract whatever
// the client typed there. We treat the field as "signed" when the text
// after "Signed by:" has any letters (not just the underscore placeholder).
// Returns { signed, name, dateText, fullText } — name is null until signed.
async function parseSignatureFromDoc(docs, docId) {
  try {
    const doc = await docs.documents.get({ documentId: docId });
    const content = (doc.data.body && doc.data.body.content) || [];
    // Flatten all paragraph text into one string with newlines preserved
    let fullText = "";
    for (const el of content) {
      if (!el.paragraph) continue;
      for (const pe of (el.paragraph.elements || [])) {
        if (pe.textRun && pe.textRun.content) fullText += pe.textRun.content;
      }
    }
    const lines = fullText.split(/\r?\n/);
    let nameRaw = "", dateRaw = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sigMatch = line.match(/^\s*Signed by:\s*(.*)$/i);
      if (sigMatch && !nameRaw) nameRaw = sigMatch[1];
      const dateMatch = line.match(/^\s*Date:\s*(.*)$/i);
      if (dateMatch && !dateRaw) dateRaw = dateMatch[1];
    }
    // Strip underscores and whitespace — what remains is the actual signature
    const cleanName = String(nameRaw || "").replace(/_+/g, "").trim();
    const cleanDate = String(dateRaw || "").replace(/_+/g, "").trim();
    const hasLetters = /[a-z]/i.test(cleanName);
    return {
      signed: hasLetters,
      name: hasLetters ? cleanName : null,
      dateText: cleanDate || null,
      fullText
    };
  } catch (err) {
    console.warn(`parseSignatureFromDoc failed for ${docId}:`, err.message);
    return { signed: false, name: null, dateText: null, error: err.message };
  }
}

// Build the "thanks for signing" confirmation email (sent to client + BCC team)
function buildSOSignedConfirmationEmail({ soNum, signerName, company, total, portalUrl }) {
  const fmt$ = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#0a1929;padding:24px 32px;border-bottom:3px solid #16a34a">
    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">MICROFLEX FILM CORPORATION</div>
    <div style="color:#86efac;font-size:11px;margin-top:4px;letter-spacing:2px">SALES ORDER SIGNED · IN PRODUCTION QUEUE</div>
  </div>
  <div style="padding:32px">
    <div style="background:#f0fdf4;border:1.5px solid #16a34a;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
      <div style="font-size:36px;line-height:1;margin-bottom:8px">✓</div>
      <div style="color:#15803d;font-size:14px;font-weight:700">Sales Order ${soNum} is signed</div>
      <div style="color:#16a34a;font-size:12px;margin-top:4px">Signed by ${signerName || "you"} · ${fmt$(total)}</div>
    </div>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 16px">
      Thanks ${signerName ? signerName.split(/\s+/)[0] : ""}! Your signature is on file and ${company || "your order"} is now in our production queue. Our team will reach out when proof artwork is ready for your review.
    </p>
    <p style="color:#64748b;font-size:11px;line-height:1.5;margin:0 0 16px">
      Your signed Sales Order is saved in your Drive folder. We've also logged the signature internally.
    </p>
    ${portalUrl ? `<div style="text-align:center;margin:20px 0">
      <a href="${portalUrl}" style="background:#00b4d8;color:#ffffff;padding:10px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px;display:inline-block">View in Portal</a>
    </div>` : ""}
    <p style="color:#64748b;font-size:11px;margin:24px 0 0;line-height:1.5">
      Questions? Reply here or contact <a href="mailto:quotes@microflexfilm.com" style="color:#00b4d8;text-decoration:none">quotes@microflexfilm.com</a>.
    </p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">
    Microflex Film Corporation · Los Angeles, CA · microflexfilm.com
  </div>
</div></body></html>`;
}

// Branded email for SO status changes (production / shipped / complete).
// Used by the transitionStatus path when an SO moves to a notable state.
function buildSOStatusChangeEmail({ soNum, company, contact, newStatus, jobDesc, total, trackingNumber, trackingCarrier, portalUrl }) {
  const fmt$ = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const STAGE = {
    production:  { color: "#a855f7", label: "IN PRODUCTION", icon: "⚙",  msg: "Your order has entered production. We'll send proof artwork for your review shortly." },
    shipped:     { color: "#0ea5e9", label: "SHIPPED",       icon: "📦", msg: "Your order has shipped! Tracking details below." },
    complete:    { color: "#16a34a", label: "COMPLETE",      icon: "✓",  msg: "Your order is complete. Thank you for choosing Microflex!" },
    cancelled:   { color: "#dc2626", label: "CANCELLED",     icon: "✕",  msg: "This Sales Order has been cancelled. If this was unexpected, please contact us." }
  };
  const stage = STAGE[newStatus] || { color: "#64748b", label: newStatus.toUpperCase(), icon: "•", msg: "Your Sales Order status has been updated." };
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#0a1929;padding:24px 32px;border-bottom:3px solid ${stage.color}">
    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">MICROFLEX FILM CORPORATION</div>
    <div style="color:#94a3b8;font-size:11px;margin-top:4px;letter-spacing:2px">SALES ORDER UPDATE</div>
  </div>
  <div style="padding:32px">
    <div style="background:#f8fafc;border-left:4px solid ${stage.color};padding:18px 22px;margin:0 0 24px">
      <div style="color:${stage.color};font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:6px">${stage.icon}  ${stage.label}</div>
      <div style="color:#0f172a;font-size:16px;font-weight:700;margin-bottom:4px">${soNum}</div>
      <div style="color:#64748b;font-size:12px">${company || ""} · ${fmt$(total)}</div>
    </div>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 16px">Hello ${contact || "there"},</p>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 16px">${stage.msg}</p>
    ${jobDesc ? `<p style="color:#64748b;font-size:11px;margin:0 0 16px"><strong>Job:</strong> ${jobDesc}</p>` : ""}
    ${(newStatus === "shipped" && trackingNumber) ? `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f0f9ff;border-radius:6px">
      <tr><td style="padding:14px 18px"><div style="font-size:10px;color:#0369a1;font-weight:700;letter-spacing:1.5px;margin-bottom:4px">TRACKING</div><div style="font-size:14px;color:#0c4a6e;font-weight:700">${trackingCarrier || "Carrier"} · ${trackingNumber}</div></td></tr>
    </table>` : ""}
    ${portalUrl ? `<div style="text-align:center;margin:20px 0">
      <a href="${portalUrl}" style="background:${stage.color};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block">View Order Status</a>
    </div>` : ""}
    <p style="color:#64748b;font-size:11px;margin:24px 0 0;line-height:1.5">
      Questions? Reply here or contact <a href="mailto:quotes@microflexfilm.com" style="color:#00b4d8;text-decoration:none">quotes@microflexfilm.com</a>.
    </p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">
    Microflex Film Corporation · Los Angeles, CA · microflexfilm.com
  </div>
</div></body></html>`;
}

// Single entry point for sending an SO status-change email to the client.
// Idempotent: caller is responsible for not double-sending (we check
// lastStatusEmailSentFor on the SO doc).
async function sendSOStatusChangeNotification(so, newStatus, extras) {
  if (!so || !so.email || !newStatus) return null;
  // Only send for stages clients care about
  const NOTIFY_STATES = ["production", "shipped", "complete", "cancelled"];
  if (!NOTIFY_STATES.includes(newStatus)) return null;
  const portalHost = process.env.PORTAL_HOST || "https://mfx-2026.web.app";
  const portalUrl = so.quoteId
    ? `${portalHost}/portal.html?quoteId=${encodeURIComponent(so.quoteId)}&email=${encodeURIComponent(so.email)}`
    : portalHost;
  const senderMailbox = process.env.SO_FROM_MAILBOX || "flex@microflexfilm.com";
  const html = buildSOStatusChangeEmail({
    soNum: so.soNum, company: so.company, contact: so.contact,
    newStatus, jobDesc: so.jobDesc, total: so.total,
    trackingNumber: (extras && extras.trackingNumber) || so.trackingNumber || "",
    trackingCarrier: (extras && extras.trackingCarrier) || so.trackingCarrier || "",
    portalUrl
  });
  const subjects = {
    production: `Sales Order ${so.soNum} — In Production`,
    shipped:    `Sales Order ${so.soNum} — Shipped 📦`,
    complete:   `Sales Order ${so.soNum} — Complete ✓`,
    cancelled:  `Sales Order ${so.soNum} — Cancelled`
  };
  return sendDelegatedEmail({
    from: senderMailbox,
    to: so.email,
    bcc: "team@microflexfilm.com, quotes@microflexfilm.com",
    replyTo: "quotes@microflexfilm.com",
    subject: subjects[newStatus] || `Sales Order ${so.soNum} Update`,
    html
  });
}

// ═══════════════════════════════════════════════════════════════════
// OUTSTANDING-PROCESS REMINDERS
// Daily cron nudges clients on unsigned SOs and stale quotes, and
// escalates to internal notifications when items go too far overdue.
// Idempotency: tracks lastReminderAt + reminderCount on each doc.
// ═══════════════════════════════════════════════════════════════════

function daysSinceIso(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

// Per-doc-type reminder thresholds. Configurable via env if needed.
const REMINDER_CFG = {
  unsignedSO: {
    firstAfterDays: Number(process.env.REMINDER_SO_FIRST_DAYS || 3),
    repeatEveryDays: Number(process.env.REMINDER_SO_REPEAT_DAYS || 7),
    maxClientReminders: Number(process.env.REMINDER_SO_MAX || 3),
    internalEscalateDays: Number(process.env.REMINDER_SO_ESCALATE_DAYS || 14)
  },
  staleQuote: {
    firstAfterDays: Number(process.env.REMINDER_QUOTE_FIRST_DAYS || 7),
    repeatEveryDays: Number(process.env.REMINDER_QUOTE_REPEAT_DAYS || 14),
    maxClientReminders: Number(process.env.REMINDER_QUOTE_MAX || 2),
    internalEscalateDays: Number(process.env.REMINDER_QUOTE_ESCALATE_DAYS || 30)
  }
};

function buildUnsignedSOReminderEmail({ soNum, contact, company, total, daysOpen, signingDocLink, portalUrl, attemptNum }) {
  const fmt$ = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dayWord = daysOpen === 1 ? "day" : "days";
  const friendly = attemptNum === 1
    ? "Just a friendly nudge"
    : attemptNum === 2
    ? "Checking in again"
    : "One last reminder";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#0a1929;padding:24px 32px;border-bottom:3px solid #f59e0b">
    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">MICROFLEX FILM CORPORATION</div>
    <div style="color:#fcd34d;font-size:11px;margin-top:4px;letter-spacing:2px">SALES ORDER · AWAITING SIGNATURE</div>
  </div>
  <div style="padding:32px">
    <p style="color:#0f172a;font-size:14px;margin:0 0 16px">Hi ${contact || "there"},</p>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 20px">
      ${friendly} — Sales Order <strong style="color:#0a1929">${soNum}</strong> has been waiting
      for your signature for <strong>${Math.round(daysOpen)} ${dayWord}</strong>. Once it's signed,
      we'll move it into our production queue and start scheduling proofs.
    </p>
    ${signingDocLink ? `<div style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
      <div style="color:#92400e;font-size:11px;font-weight:700;letter-spacing:2px;margin-bottom:8px">SIGN IN GOOGLE DRIVE</div>
      <a href="${signingDocLink}" style="background:#f59e0b;color:#ffffff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Open & Sign Sales Order</a>
      <div style="color:#92400e;font-size:11px;margin-top:10px;line-height:1.5">Type your name + today's date in the signature lines, then save.</div>
    </div>` : ""}
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:12px">
      <tr><td style="padding:6px 0;color:#64748b;width:120px">Sales Order</td><td style="padding:6px 0;color:#0f172a;font-weight:700">${soNum}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Company</td><td style="padding:6px 0;color:#0f172a">${company || "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Order Total</td><td style="padding:6px 0;color:#0f172a;font-weight:700">${fmt$(total)}</td></tr>
    </table>
    ${portalUrl ? `<div style="text-align:center;margin:16px 0"><a href="${portalUrl}" style="background:#00b4d8;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px;display:inline-block">View in Portal</a></div>` : ""}
    <p style="color:#64748b;font-size:11px;margin:24px 0 0;line-height:1.5">
      Any questions or changes needed before signing? Just reply — we'll take care of it.
    </p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">
    Microflex Film Corporation · Los Angeles, CA · microflexfilm.com
  </div>
</div></body></html>`;
}

function buildStaleQuoteReminderEmail({ quoteNum, contact, company, jobDesc, daysOpen, portalUrl, attemptNum }) {
  const dayWord = daysOpen === 1 ? "day" : "days";
  const friendly = attemptNum === 1
    ? "Checking in on your quote"
    : "Following up once more";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#0a1929;padding:24px 32px;border-bottom:3px solid #00b4d8">
    <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">MICROFLEX FILM CORPORATION</div>
    <div style="color:#94a3b8;font-size:11px;margin-top:4px;letter-spacing:2px">QUOTE · STILL INTERESTED?</div>
  </div>
  <div style="padding:32px">
    <p style="color:#0f172a;font-size:14px;margin:0 0 16px">Hi ${contact || "there"},</p>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 20px">
      ${friendly} <strong style="color:#0a1929">${quoteNum}</strong> — we sent it
      <strong>${Math.round(daysOpen)} ${dayWord}</strong> ago and haven't heard back yet.
      Just want to make sure it didn't get lost in your inbox.
    </p>
    ${jobDesc ? `<p style="color:#64748b;font-size:12px;margin:0 0 16px"><strong>Job:</strong> ${jobDesc}</p>` : ""}
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0 0 16px">
      Got questions about pricing, lead time, or materials? Reply here and we'll
      get you what you need. If something's changed and you'd like a revised
      quote, just say the word.
    </p>
    ${portalUrl ? `<div style="text-align:center;margin:20px 0">
      <a href="${portalUrl}" style="background:#00b4d8;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block">Review Your Quote</a>
    </div>` : ""}
    <p style="color:#64748b;font-size:11px;margin:24px 0 0;line-height:1.5">
      Microflex pricing typically stays valid for 30 days from quote date.
    </p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">
    Microflex Film Corporation · Los Angeles, CA · microflexfilm.com
  </div>
</div></body></html>`;
}

// Post an internal escalation notification to ops/CEO when an item has
// been outstanding past the escalation threshold. Tracked on the doc as
// internalEscalatedAt so we don't double-post.
async function postInternalEscalation({ kind, docId, soOrQuote, daysOpen }) {
  const titlePrefix = kind === "unsignedSO" ? "Unsigned SO" : "Stale Quote";
  const title = `${titlePrefix} — ${soOrQuote.soNum || soOrQuote.quoteNum} (${Math.round(daysOpen)}d)`;
  const total = soOrQuote.total || (soOrQuote.qtys && soOrQuote.qtys[soOrQuote.poQtyIndex || 0] && soOrQuote.qtys[soOrQuote.poQtyIndex || 0].total) || 0;
  const body = `${soOrQuote.company || (soOrQuote.fields && soOrQuote.fields.custCo) || "Client"} · ${Math.round(daysOpen)} days · $${Number(total).toLocaleString(undefined, { minimumFractionDigits: 2 })} · client reminders exhausted`;
  const mgmtSnap = await db.collection("users")
    .where("role", "in", ["CEO", "ceo", "Admin", "admin", "Operations Manager"]).limit(5).get();
  const batch = db.batch();
  mgmtSnap.docs.forEach(u => {
    batch.set(db.collection("notifications").doc(), {
      type: "alert",
      title,
      body,
      icon: kind === "unsignedSO" ? "✍" : "⏳",
      from: "System (Reminders)",
      userId: u.id,
      sourceView: kind === "unsignedSO" ? "orders" : "quotes",
      sourceId: docId,
      read: false, dismissed: false,
      priority: "high",
      timestamp: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

// Scheduled daily reminder cron. Runs at 09:00 Central each weekday morning.
// ═══════════════════════════════════════════════════════════════════
// AUTO-SEND SO ON APPROVAL — hands-free server-side flow
// ═══════════════════════════════════════════════════════════════════
// 2026-05-27: round-16 client-side auto-send only fires when a staff
// member is signed in with a fresh Gmail OAuth token. If a customer
// confirms a PO at 2am and nobody's online, the SO sits in approved
// status with no email out. This trigger closes that gap: it fires on
// /salesOrders writes, detects the autoApproved=true && !sentAt state,
// and uses the existing delegated Gmail service account to send the
// confirmation email + create the signing doc — no human required.
//
// Idempotency: stamps serverAutoSendAt in a transaction so duplicate
// invocations of the trigger (Firestore sometimes redelivers) become
// no-ops. The trigger's own write back to the doc re-fires the trigger;
// the early-exit guards catch that.
//
// Coexistence with client-side flow (round 16): the client listener
// checks so.sentAt (round 25) before opening the send modal. Whichever
// path stamps sentAt first wins; the other becomes a no-op.
exports.autoSendSOOnApproval = onDocumentWritten(
  {
    document: "salesOrders/{soId}",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 120,
    secrets: [GMAIL_SA_SECRET]
  },
  async (event) => {
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    if (!after) return; // doc was deleted

    // ─── Skip conditions (each is a normal expected state, not an error) ──
    // 2026-05-27: gate is now ceoSignedAt (an explicit human electronic
    // signature), not autoApproved. CEO signature flips autoApproved=true
    // as a side effect, but we require BOTH to fire so unsigned-but-
    // auto-approved (legacy or buggy) SOs don't accidentally send.
    if (!after.autoApproved) return;
    if (!after.ceoSignedAt) return;
    if (after.sentAt) return;
    if (after.serverAutoSendAt) return; // already attempted; success/fail already recorded
    const recipient = String(after.email || "").trim();
    if (!recipient) {
      console.warn(`[autoSendSO] ${after.soNum || event.params.soId}: missing email, skipping`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      console.warn(`[autoSendSO] ${after.soNum}: malformed email "${recipient}", skipping`);
      return;
    }

    const soId = event.params.soId;
    const ref = db.collection("salesOrders").doc(soId);

    // ─── Claim the send slot atomically ──────────────────────────────────
    // If two trigger invocations race (Firestore can redeliver), only one
    // will succeed in writing serverAutoSendAt; the other re-reads and bails.
    let claimed = false;
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        const d = fresh.data() || {};
        if (d.sentAt) return; // client-side or earlier server send already
        if (d.serverAutoSendAt) return; // someone else got there first
        if (!d.autoApproved) return; // changed state mid-flight
        tx.update(ref, {
          serverAutoSendAt: nowIso(),
          serverAutoSendStatus: "in_progress"
        });
        claimed = true;
      });
    } catch (err) {
      console.error(`[autoSendSO] ${after.soNum}: claim transaction failed:`, err.message);
      return;
    }
    if (!claimed) {
      console.log(`[autoSendSO] ${after.soNum}: another invocation claimed the send slot`);
      return;
    }

    // Re-read so we have the latest state (createdAt, etc.)
    const snap = await ref.get();
    const so = snap.data() || {};
    so.id = soId;

    // ─── Create the signing Google Doc if we don't have one yet ──────────
    // The portal also has an inline typed-name signing path (round 12), so
    // a missing signing doc isn't fatal — we just continue without it.
    let signingDocLink = so.signingDocLink || null;
    if (!signingDocLink) {
      try {
        const created = await createSOSigningDoc(so);
        signingDocLink = created && created.docLink ? created.docLink : null;
        if (signingDocLink) {
          await ref.update({ signingDocLink, signingDocId: created.docId, updatedAt: nowIso() });
        }
      } catch (err) {
        console.warn(`[autoSendSO] ${so.soNum}: signing doc creation failed (continuing without):`, err.message);
      }
    }

    // ─── Build + send the email ──────────────────────────────────────────
    const senderMailbox = process.env.SO_FROM_MAILBOX || "flex@microflexfilm.com";
    const portalHost = process.env.PORTAL_HOST || "https://os.microflexfilm.com";
    const portalUrl = `${portalHost}/portal?id=${encodeURIComponent(so.quoteId || "")}&q=${encodeURIComponent(so.quoteNum || "")}`;

    const html = buildSOConfirmationEmail({
      soNum: so.soNum,
      quoteNum: so.quoteNum,
      company: so.company,
      contact: so.contact,
      jobDesc: so.jobDesc,
      selectedQty: so.selectedQty,
      ppu: so.ppu,
      total: so.total,
      payTerms: so.payTerms,
      portalUrl,
      signingDocLink,
      ceoSignedBy: so.ceoSignedBy,
      ceoSignedAt: so.ceoSignedAt
    });
    const subject = `Microflex Sales Order ${so.soNum}${so.company ? ` — ${so.company}` : ""}`;

    let msgId = null;
    try {
      msgId = await sendDelegatedEmail({
        from: senderMailbox,
        to: recipient,
        bcc: "team@microflexfilm.com,quotes@microflexfilm.com",
        subject,
        html,
        replyTo: "quotes@microflexfilm.com"
      });
    } catch (err) {
      console.error(`[autoSendSO] ${so.soNum}: sendDelegatedEmail threw:`, err.message);
    }

    // ─── Stamp results back on the SO ────────────────────────────────────
    const completedAt = nowIso();
    const update = {
      serverAutoSendCompletedAt: completedAt,
      serverAutoSendStatus: msgId ? "sent" : "failed",
      updatedAt: completedAt
    };
    if (msgId) {
      update.sentAt = completedAt;
      update.sentTo = recipient;
      update.serverAutoSendMessageId = msgId;
      update.status = "sent"; // bump from 'approved' to 'sent' for the lifecycle
      // Append a note so staff sees the trail in the SO history
      const notes = Array.isArray(so.notes) ? so.notes.slice() : [];
      notes.push({
        text: `📤 Auto-sent to ${recipient} by server (Gmail msg ${msgId})${signingDocLink ? " · signing doc created" : ""}`,
        by: "System (Auto)",
        at: completedAt
      });
      update.notes = notes;
    } else {
      // Failure recorded but sentAt stays null so client-side flow can still
      // try once a staff session is available, OR a human can manually send.
      const notes = Array.isArray(so.notes) ? so.notes.slice() : [];
      notes.push({
        text: `⚠ Server auto-send failed at ${completedAt}. Configure GMAIL_SERVICE_ACCOUNT_JSON with domain-wide delegation for ${senderMailbox}, or send manually.`,
        by: "System (Auto)",
        at: completedAt
      });
      update.notes = notes;
    }
    await ref.update(update);
    await logServerEvent("so.auto_sent", { soId, soNum: so.soNum, to: recipient, success: !!msgId, msgId });
    console.log(`[autoSendSO] ${so.soNum}: ${msgId ? "sent to " + recipient + " (msg " + msgId + ")" : "FAILED"}`);
  }
);

// Three responsibilities:
//   1. Email clients about unsigned SOs (>= REMINDER_SO_FIRST_DAYS)
//   2. Email clients about stale quotes (>= REMINDER_QUOTE_FIRST_DAYS)
//   3. Post internal escalations when items go past escalateDays
// Each doc gets at most maxClientReminders before client emails stop;
// internal escalation fires once and is recorded.
exports.scheduledSendOutstandingReminders = onSchedule(
  { schedule: "every day 09:00", timeZone: "America/Chicago", memory: "256MiB", timeoutSeconds: 240 },
  async () => {
    const cfg = REMINDER_CFG;
    const portalHost = process.env.PORTAL_HOST || "https://mfx-2026.web.app";
    const senderMailbox = process.env.SO_FROM_MAILBOX || "flex@microflexfilm.com";
    const results = { soChecked: 0, soReminded: 0, soEscalated: 0, quoteChecked: 0, quoteReminded: 0, quoteEscalated: 0, errors: 0 };

    // ─── Unsigned SOs ───────────────────────────────────────
    try {
      const soSnap = await db.collection("salesOrders")
        .where("status", "in", ["sent", "pending"])
        .limit(200).get();
      for (const d of soSnap.docs) {
        const so = { id: d.id, ...d.data() };
        if (so.clientSignedAt) continue;
        // sentAt is set by the auto-flow; if missing fall back to createdAt
        const sinceIso = so.sentAt || so.createdAt;
        const daysOpen = daysSinceIso(sinceIso);
        if (daysOpen === null || daysOpen < cfg.unsignedSO.firstAfterDays) continue;
        results.soChecked++;

        const lastReminderDays = daysSinceIso(so.lastReminderAt);
        const reminderCount = Number(so.reminderCount || 0);

        // Internal escalation (one-time) — fire when overdue regardless of client reminders
        if (daysOpen >= cfg.unsignedSO.internalEscalateDays && !so.internalEscalatedAt) {
          try {
            await postInternalEscalation({ kind: "unsignedSO", docId: d.id, soOrQuote: so, daysOpen });
            await d.ref.update({ internalEscalatedAt: nowIso() });
            results.soEscalated++;
            await logServerEvent("reminder.internal_alert", {
              kind: "unsignedSO", docId: d.id, soNum: so.soNum, daysOpen: Math.round(daysOpen)
            });
          } catch (err) {
            console.warn("SO escalation failed:", err.message);
            results.errors++;
          }
        }

        // Client reminder — skip if already maxed or sent too recently
        if (reminderCount >= cfg.unsignedSO.maxClientReminders) continue;
        if (lastReminderDays !== null && lastReminderDays < cfg.unsignedSO.repeatEveryDays) continue;
        if (!so.email) continue;

        const portalUrl = so.quoteId
          ? `${portalHost}/portal.html?quoteId=${encodeURIComponent(so.quoteId)}&email=${encodeURIComponent(so.email)}`
          : portalHost;
        try {
          const html = buildUnsignedSOReminderEmail({
            soNum: so.soNum, contact: so.contact, company: so.company,
            total: so.total, daysOpen, signingDocLink: so.signingDocLink,
            portalUrl, attemptNum: reminderCount + 1
          });
          const msgId = await sendDelegatedEmail({
            from: senderMailbox,
            to: so.email,
            bcc: "team@microflexfilm.com, quotes@microflexfilm.com",
            replyTo: "quotes@microflexfilm.com",
            subject: `Reminder: Please sign ${so.soNum}`,
            html
          });
          if (msgId) {
            await d.ref.update({
              lastReminderAt: nowIso(),
              reminderCount: reminderCount + 1,
              updatedAt: nowIso(),
              notes: FieldValue.arrayUnion({
                text: `⏰ Reminder #${reminderCount + 1} sent to ${so.email} (${Math.round(daysOpen)}d open · Gmail ${msgId})`,
                by: "System (Reminders)",
                at: nowIso()
              })
            });
            results.soReminded++;
            await logServerEvent("reminder.sent.so_unsigned", {
              soId: d.id, soNum: so.soNum, to: so.email,
              attempt: reminderCount + 1, daysOpen: Math.round(daysOpen), gmailMessageId: msgId
            });
          }
        } catch (err) {
          console.warn(`SO reminder failed for ${so.soNum}:`, err.message);
          results.errors++;
        }
      }
    } catch (err) {
      console.error("Unsigned SO reminder pass failed:", err);
      results.errors++;
    }

    // ─── Stale Quotes ──────────────────────────────────────
    try {
      const qSnap = await db.collection("quotes")
        .where("status", "==", "sent")
        .limit(200).get();
      for (const d of qSnap.docs) {
        const q = { id: d.id, ...d.data() };
        if (q.poNumber || q.poSignature) continue; // PO already submitted
        const sinceIso = q.sentAt || q.createdAt;
        const daysOpen = daysSinceIso(sinceIso);
        if (daysOpen === null || daysOpen < cfg.staleQuote.firstAfterDays) continue;
        results.quoteChecked++;

        const lastReminderDays = daysSinceIso(q.lastReminderAt);
        const reminderCount = Number(q.reminderCount || 0);

        if (daysOpen >= cfg.staleQuote.internalEscalateDays && !q.internalEscalatedAt) {
          try {
            await postInternalEscalation({ kind: "staleQuote", docId: d.id, soOrQuote: q, daysOpen });
            await d.ref.update({ internalEscalatedAt: nowIso() });
            results.quoteEscalated++;
            await logServerEvent("reminder.internal_alert", {
              kind: "staleQuote", docId: d.id, quoteNum: q.quoteNum, daysOpen: Math.round(daysOpen)
            });
          } catch (err) {
            console.warn("Quote escalation failed:", err.message);
            results.errors++;
          }
        }

        if (reminderCount >= cfg.staleQuote.maxClientReminders) continue;
        if (lastReminderDays !== null && lastReminderDays < cfg.staleQuote.repeatEveryDays) continue;
        const clientEmail = (q.fields && q.fields.custEmail) || q.poClientEmail;
        if (!clientEmail) continue;

        const fields = q.fields || {};
        const portalUrl = `${portalHost}/portal.html?quoteId=${encodeURIComponent(d.id)}&email=${encodeURIComponent(clientEmail)}`;
        try {
          const html = buildStaleQuoteReminderEmail({
            quoteNum: q.quoteNum,
            contact: fields.custAttn || "",
            company: fields.custCo || "",
            jobDesc: (fields.sA || "?") + 'x' + (fields.sar || "?") + '" ' + (fields.shapeType || ""),
            daysOpen,
            portalUrl,
            attemptNum: reminderCount + 1
          });
          const msgId = await sendDelegatedEmail({
            from: senderMailbox,
            to: clientEmail,
            bcc: "team@microflexfilm.com, quotes@microflexfilm.com",
            replyTo: "quotes@microflexfilm.com",
            subject: `${q.quoteNum} — Still interested?`,
            html
          });
          if (msgId) {
            await d.ref.update({
              lastReminderAt: nowIso(),
              reminderCount: reminderCount + 1,
              updatedAt: nowIso()
            });
            results.quoteReminded++;
            await logServerEvent("reminder.sent.quote_stale", {
              quoteId: d.id, quoteNum: q.quoteNum, to: clientEmail,
              attempt: reminderCount + 1, daysOpen: Math.round(daysOpen), gmailMessageId: msgId
            });
          }
        } catch (err) {
          console.warn(`Quote reminder failed for ${q.quoteNum}:`, err.message);
          results.errors++;
        }
      }
    } catch (err) {
      console.error("Stale quote reminder pass failed:", err);
      results.errors++;
    }

    await logServerEvent("reminder.cron.summary", results);
    console.log(`scheduledSendOutstandingReminders: ${JSON.stringify(results)}`);
  }
);

// ═══════════════════════════════════════════════════════════════════
// PORTAL DRIVE FOLDER — file-drop detection + comms
// When clients use the >50MB Drive-folder drop link, files appear in
// Drive but not in our Firestore quote record. This cron polls each
// shared folder, syncs newly-arrived files to quote.poFiles[] /
// quote.artFiles[], posts a portalMessage so the comms thread shows
// the activity, and notifies internal sales/ops.
// ═══════════════════════════════════════════════════════════════════

async function listFolderFiles(drive, folderId) {
  if (!folderId) return [];
  const q = `'${folderId}' in parents and trashed=false`;
  const r = await drive.files.list({
    q,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,owners(emailAddress,displayName))",
    pageSize: 200,
    orderBy: "createdTime"
  });
  return r.data.files || [];
}

// Whether a Drive file looks like a client-uploaded artifact (vs created
// internally via uploadToDrive). We treat the folder's known file ID set
// as the source of truth; anything new = client added it.
async function syncFolderFilesForQuote(drive, quoteId, quoteData, folderKind /* 'PO' | 'Art' */) {
  const folderObj = folderKind === "PO" ? quoteData.poUploadFolder : quoteData.artUploadFolder;
  if (!folderObj || !folderObj.folderId) return { added: 0, files: [] };
  const folderId = folderObj.folderId;

  // Build a set of file IDs we already know about (from the array of files
  // already on the quote + any IDs we explicitly tracked on the folder obj).
  const existingArr = folderKind === "PO" ? (quoteData.poFiles || []) : (quoteData.artFiles || []);
  const knownIds = new Set();
  for (const f of existingArr) {
    if (f && f.driveId) knownIds.add(f.driveId);
  }
  for (const id of (folderObj.knownFileIds || [])) knownIds.add(id);

  const driveFiles = await listFolderFiles(drive, folderId);
  const newFiles = driveFiles.filter(f => !knownIds.has(f.id));
  if (newFiles.length === 0) return { added: 0, files: [] };

  const toAppend = newFiles.map(f => ({
    name: f.name,
    url: f.webViewLink || `https://drive.google.com/file/d/${f.id}`,
    driveId: f.id,
    driveLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}`,
    uploadedAt: f.createdTime || nowIso(),
    skuIndex: null,
    viaSharedFolder: true,
    uploadedByEmail: (f.owners && f.owners[0] && f.owners[0].emailAddress) || null,
    sizeBytes: f.size ? Number(f.size) : null
  }));

  const updates = {
    updatedAt: nowIso()
  };
  if (folderKind === "PO") {
    updates.poFiles = (quoteData.poFiles || []).concat(toAppend);
    updates["poUploadFolder.knownFileIds"] = Array.from(knownIds).concat(newFiles.map(f => f.id));
    updates["poUploadFolder.lastSyncedAt"] = nowIso();
  } else {
    updates.artFiles = (quoteData.artFiles || []).concat(toAppend);
    updates["artUploadFolder.knownFileIds"] = Array.from(knownIds).concat(newFiles.map(f => f.id));
    updates["artUploadFolder.lastSyncedAt"] = nowIso();
  }
  await db.collection("quotes").doc(quoteId).update(updates);
  return { added: newFiles.length, files: toAppend };
}

// Post a portalMessages entry so the client + staff see the activity in
// the comms thread. Server-written with from='system'.
async function postFolderDropPortalMessage(quoteId, folderKind, addedFiles) {
  const names = addedFiles.map(f => f.name).slice(0, 5).join(", ");
  const more = addedFiles.length > 5 ? ` (+${addedFiles.length - 5} more)` : "";
  const noun = addedFiles.length === 1 ? "file" : "files";
  const text = `📎 ${addedFiles.length} new ${folderKind} ${noun} added to your shared Drive folder: ${names}${more}`;
  await db.collection("quotes").doc(quoteId).collection("portalMessages").add({
    text,
    name: "Microflex",
    from: "system",
    type: "folder_drop",
    folderKind,
    fileCount: addedFiles.length,
    fileNames: addedFiles.map(f => f.name),
    timestamp: FieldValue.serverTimestamp()
  });
}

// Post internal notification so sales/ops sees the client activity.
async function postFolderDropInternalNotif(quoteId, quoteData, folderKind, addedFiles) {
  const company = (quoteData.fields && quoteData.fields.custCo) || "Client";
  const quoteNum = quoteData.quoteNum || quoteId;
  const noun = addedFiles.length === 1 ? "file" : "files";
  const mgmtSnap = await db.collection("users")
    .where("role", "in", ["CEO", "ceo", "Admin", "admin", "Operations Manager", "Sales", "sales"]).limit(8).get();
  if (mgmtSnap.empty) return;
  const batch = db.batch();
  mgmtSnap.docs.forEach(u => {
    batch.set(db.collection("notifications").doc(), {
      type: "info",
      title: `${company} uploaded ${folderKind} ${noun}`,
      body: `${quoteNum} · ${addedFiles.length} new ${noun}: ${addedFiles.map(f => f.name).slice(0, 3).join(", ")}${addedFiles.length > 3 ? "..." : ""}`,
      icon: "📎",
      from: "System",
      userId: u.id,
      sourceView: "quotes",
      sourceId: quoteId,
      read: false, dismissed: false,
      priority: "normal",
      timestamp: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

// Scheduled poll: every 30 min, sync each portal-shared Drive folder
// and detect newly-dropped files.
exports.scheduledPollPortalDriveFolders = onSchedule(
  { schedule: "every 30 minutes", timeZone: "America/Chicago", memory: "256MiB", timeoutSeconds: 300 },
  async () => {
    try {
      // We want quotes that have ANY upload folder. Firestore can't OR two
      // != null where clauses, so we do two passes and dedupe.
      const [poSnap, artSnap] = await Promise.all([
        db.collection("quotes").where("poUploadFolder.folderId", "!=", null).limit(200).get().catch(() => ({ docs: [] })),
        db.collection("quotes").where("artUploadFolder.folderId", "!=", null).limit(200).get().catch(() => ({ docs: [] }))
      ]);
      const byId = new Map();
      for (const d of poSnap.docs) byId.set(d.id, d);
      for (const d of artSnap.docs) byId.set(d.id, d);
      if (byId.size === 0) {
        console.log("scheduledPollPortalDriveFolders: no quotes with shared folders");
        return;
      }

      const drive = await getDriveClient();
      const results = { quotesChecked: 0, foldersChecked: 0, filesFound: 0, messagesPosted: 0, errors: 0 };

      for (const [quoteId, d] of byId) {
        const quoteData = d.data();
        results.quotesChecked++;
        try {
          for (const kind of ["PO", "Art"]) {
            const folder = kind === "PO" ? quoteData.poUploadFolder : quoteData.artUploadFolder;
            if (!folder || !folder.folderId) continue;
            results.foldersChecked++;
            const sync = await syncFolderFilesForQuote(drive, quoteId, quoteData, kind);
            if (sync.added > 0) {
              results.filesFound += sync.added;
              await postFolderDropPortalMessage(quoteId, kind, sync.files);
              await postFolderDropInternalNotif(quoteId, quoteData, kind, sync.files);
              results.messagesPosted++;
              await logServerEvent("portal.folder.drop_detected", {
                quoteId, quoteNum: quoteData.quoteNum || "",
                folderKind: kind, fileCount: sync.added,
                fileNames: sync.files.map(f => f.name)
              });
              // Refresh in-memory copy so the second pass (Art) sees updated state
              const fresh = await db.collection("quotes").doc(quoteId).get();
              if (fresh.exists) Object.assign(quoteData, fresh.data());
            }
          }
        } catch (err) {
          results.errors++;
          console.warn(`scheduledPollPortalDriveFolders: quote ${quoteId} failed:`, err.message);
        }
      }

      await logServerEvent("portal.folder.poll_summary", results);
      console.log(`scheduledPollPortalDriveFolders: ${JSON.stringify(results)}`);
    } catch (err) {
      console.error("scheduledPollPortalDriveFolders error:", err);
    }
  }
);

// Scheduled poll: every 15 min check SOs that have a signing Doc but no
// recorded signature. For each, ask the Docs API what's in the doc — if
// the "Signed by:" line has real text, mark the SO as signed, post an
// internal notification, and email the client a thank-you confirmation.
exports.scheduledPollSOSignings = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Chicago", memory: "256MiB", timeoutSeconds: 240 },
  async () => {
    try {
      const snap = await db.collection("salesOrders")
        .where("signingDocId", "!=", null)
        .limit(100)
        .get();
      const unsigned = snap.docs.filter(d => {
        const x = d.data();
        return x.signingDocId && !x.clientSignedAt;
      });
      if (unsigned.length === 0) {
        console.log("scheduledPollSOSignings: no unsigned SOs with signing docs");
        return;
      }
      const docs = await getDocsClient();
      let signed = 0, errors = 0;
      for (const d of unsigned) {
        const so = { id: d.id, ...d.data() };
        try {
          const result = await parseSignatureFromDoc(docs, so.signingDocId);
          if (!result.signed) continue;
          // Update SO with signature details
          const nowIsoStr = nowIso();
          await db.collection("salesOrders").doc(d.id).update({
            clientSignedAt: nowIsoStr,
            clientSignedName: result.name,
            clientSignedDateText: result.dateText || null,
            updatedAt: nowIsoStr,
            notes: FieldValue.arrayUnion({
              text: `✓ Client signed via Google Doc (${result.name}${result.dateText ? ` · ${result.dateText}` : ""})`,
              by: "System (Signing Poll)",
              at: nowIsoStr
            })
          });
          await logServerEvent("so.signed.detected", {
            soId: d.id, soNum: so.soNum, signerName: result.name,
            dateText: result.dateText, docId: so.signingDocId
          });
          // Confirmation email to client + BCC team
          const portalHost = process.env.PORTAL_HOST || "https://mfx-2026.web.app";
          const portalUrl = so.quoteId
            ? `${portalHost}/portal.html?quoteId=${encodeURIComponent(so.quoteId)}&email=${encodeURIComponent(so.email)}`
            : portalHost;
          const senderMailbox = process.env.SO_FROM_MAILBOX || "flex@microflexfilm.com";
          const html = buildSOSignedConfirmationEmail({
            soNum: so.soNum, signerName: result.name,
            company: so.company, total: so.total, portalUrl
          });
          await sendDelegatedEmail({
            from: senderMailbox,
            to: so.email,
            bcc: "team@microflexfilm.com, quotes@microflexfilm.com",
            replyTo: "quotes@microflexfilm.com",
            subject: `Thanks — ${so.soNum} Signed`,
            html
          });
          // Internal notification for ops
          const mgmtSnap = await db.collection("users")
            .where("role", "in", ["CEO", "ceo", "Admin", "admin", "Operations Manager"]).limit(5).get();
          const batch = db.batch();
          mgmtSnap.docs.forEach(u => {
            batch.set(db.collection("notifications").doc(), {
              type: "alert",
              title: `Client signed ${so.soNum}`,
              body: `${so.company || ""} · ${result.name || "Client"} · $${Number(so.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} · ready for production`,
              icon: "✓",
              from: "System",
              userId: u.id,
              sourceView: "orders",
              sourceId: d.id,
              read: false, dismissed: false,
              priority: "high",
              timestamp: FieldValue.serverTimestamp()
            });
          });
          await batch.commit();
          signed++;
        } catch (err) {
          errors++;
          console.warn(`scheduledPollSOSignings: SO ${d.id} check failed:`, err.message);
        }
      }
      console.log(`scheduledPollSOSignings: checked ${unsigned.length}, ${signed} newly signed, ${errors} errors`);
    } catch (err) {
      console.error("scheduledPollSOSignings error:", err);
    }
  }
);

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
// DATA-06 + DATA-07 fix (2026-05-24): server triggers for collections that
// previously had no server-side validation, derivation, or audit logging.
const { onSalesOrderWrite: aiOnSalesOrderWrite } = require("./workflows/firestore/onSalesOrderWrite");
const { onJobPassportWrite: aiOnJobPassportWrite } = require("./workflows/firestore/onJobPassportWrite");
const { onBlueprintWrite: aiOnBlueprintWrite } = require("./workflows/firestore/onBlueprintWrite");
const { onApprovalRecordWrite: aiOnApprovalRecordWrite } = require("./workflows/firestore/onApprovalRecordWrite");
const { onPlateAssetWrite: aiOnPlateAssetWrite } = require("./workflows/firestore/onPlateAssetWrite");

exports.aiOnQuoteWrite = aiOnQuoteWrite;
exports.aiOnJobTicketWrite = aiOnJobTicketWrite;
exports.aiOnNCRWrite = aiOnNCRWrite;
exports.aiOnVendorPOWrite = aiOnVendorPOWrite;
exports.aiOnRequestCreate = aiOnRequestCreate;
exports.aiOnTrainingRecordWrite = aiOnTrainingRecordWrite;
exports.aiOnSalesOrderWrite = aiOnSalesOrderWrite;
exports.aiOnJobPassportWrite = aiOnJobPassportWrite;
exports.aiOnBlueprintWrite = aiOnBlueprintWrite;
exports.aiOnApprovalRecordWrite = aiOnApprovalRecordWrite;
exports.aiOnPlateAssetWrite = aiOnPlateAssetWrite;

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
