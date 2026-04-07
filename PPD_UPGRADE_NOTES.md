# PPD Upgrade Notes

This revision adds a dedicated **PPD / PrePress Design** department module inside the existing MFX OS while preserving the existing shared data model and current modules.

## Added
- `public/js/ppd.js` — new PPD workspace module
- `public/ppd.html` — dedicated entry point redirect to `index.html?module=ppd`
- New `v-ppd` view and PPD tab/menu entry
- PPD chartreuse visual mode and login branding
- PPD Home, Intake Desk, Workbench, Approvals, Assets, and History screens
- Shared-link settings for Google Drive, Dropbox, shared inbox, Google Chat, and dashboards
- PPD request creation/editing using existing `requests` collection
- Request-to-job-ticket conversion using existing `jobTickets` collection
- PPD Job Studio updates that write namespaced `ppd` data onto job tickets
- Approval logging using new `approvalRecords` collection
- Plate/tool incident logging using new `plateIncidents` collection

## Compatibility / safety choices
- Existing modules were kept in place
- Existing `jobTickets.prePressStatus` is still written so the current Production prepress queue continues to work
- Existing Drive/portal integrations were left intact
- Firestore rules were **not tightened** in this revision to avoid breaking current access patterns
- Number generation was **not moved server-side** in this revision to avoid changing current order/passport/ticket flows

## Smoke tests run
- `node --check public/js/ppd.js`
- `node --check public/js/core.js`
- `node --check public/js/production.js`

## Recommended next hardening phase
- Server-side ID generation for sales orders / job passports / job tickets
- Role-based Firestore rules
- Shared-inbox event ingestion rather than polling user mailboxes
- Job-level Drive folder auto-provisioning + labels
- Dropbox webhook / sync integration
- Approval routing to Google Chat cards + email links
