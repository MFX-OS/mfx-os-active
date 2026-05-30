// ═══════════════════════════════════════════════════════════════════
// Gmail clients — two flavors:
//   - getDelegatedGmailClient(mailbox, scopes): impersonates a domain
//     mailbox via JWT/service-account DWD. Requires GMAIL_SA_SECRET in
//     the calling function's options.secrets so the JSON is in env.
//   - getGmailClient(accessToken): for OAuth flows where we already
//     have an access token from the user.
// sendDelegatedEmail wraps the delegated client to send branded HTML.
// Returns null (and logs) on missing env — never throws on send failure.
// ═══════════════════════════════════════════════════════════════════
const { google } = require("googleapis");
const { GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE } = require("./secrets");

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

function getOAuthClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

async function getGmailClient(accessToken) {
  const auth = getOAuthClient(accessToken);
  return google.gmail({ version: "v1", auth });
}

module.exports = {
  getDelegatedGmailClient,
  sendDelegatedEmail,
  getOAuthClient,
  getGmailClient,
};
