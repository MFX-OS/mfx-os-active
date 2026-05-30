// ═══════════════════════════════════════════════════════════════════
// Google Drive / Docs / Sheets clients + folder helpers.
// All clients use application-default GoogleAuth (Cloud Functions
// service account) — no per-user OAuth here. The MFX-CORE shared
// drive is the parent for all client/PPD folder trees.
// ═══════════════════════════════════════════════════════════════════
const { google } = require("googleapis");
const {
  DRIVE_SCOPE,
  DOCS_SCOPE,
  SHEETS_SCOPE,
  DRIVE_NAME,
} = require("./secrets");
const { qEscape } = require("./utils");

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPE });
  return google.drive({ version: "v3", auth });
}

async function getDocsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: DOCS_SCOPE });
  return google.docs({ version: "v1", auth });
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: SHEETS_SCOPE });
  return google.sheets({ version: "v4", auth });
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

module.exports = {
  getDriveClient,
  getDocsClient,
  getSheetsClient,
  getMFXCoreId,
  findFolder,
  createFolder,
  findOrCreateFolder,
};
