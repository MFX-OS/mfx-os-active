// ═══════════════════════════════════════════════════════════════════
// Secret + scope constants. Declared once at module load.
// Any function that uses sendDelegatedEmail() or getDelegatedGmailClient()
// must include GMAIL_SA_SECRET in its options.secrets list so the
// runtime injects GMAIL_SERVICE_ACCOUNT_JSON into process.env at cold start.
// Set with: firebase functions:secrets:set GMAIL_SERVICE_ACCOUNT_JSON
// ═══════════════════════════════════════════════════════════════════
const { defineSecret } = require("firebase-functions/params");

const GMAIL_SA_SECRET = defineSecret("GMAIL_SERVICE_ACCOUNT_JSON");

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"];
const DOCS_SCOPE = ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"];
const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
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

module.exports = {
  GMAIL_SA_SECRET,
  DRIVE_SCOPE,
  DOCS_SCOPE,
  SHEETS_SCOPE,
  GMAIL_READ_SCOPE,
  GMAIL_SEND_SCOPE,
  GMAIL_SCOPE,
  DRIVE_NAME,
  DEFAULT_PPD_SUBFOLDERS,
};
