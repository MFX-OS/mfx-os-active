SEC-05 QUARANTINED SERVICE-ACCOUNT KEYS — 2026-05-24
=====================================================

These Firebase Admin SDK private-key JSONs were moved here from Downloads.
Anyone with one of these files has FULL admin access to mfx-2026 — they
bypass every Firestore rule.

URGENT — REVOKE THEM:
  1. Open https://console.firebase.google.com/project/mfx-2026/settings/serviceaccounts/adminsdk
  2. For each key listed below, click "..." → "Delete key"
  3. After revoking ALL keys, you can safely delete this folder.

Keys here (private_key_id):
  - See ls output in the chat log when these were moved.

If you actively use a service account for a Cloud Function / script:
  - GENERATE a fresh key in the console FIRST,
  - Update your code/env to use it,
  - THEN revoke the old keys here.

After revocation:
  rm -rf "_attic/sec-05-revoke-then-delete-2026-05-24"
