'use strict';
// DATA-06 fix (2026-05-24): server trigger for the plateAssets collection.
// Delegates to lib/auditWrite for activity + _auditLog + statusHistory writes.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { writeAuditFromEvent } = require('../../lib/auditWrite');

const handler = onDocumentWritten(
  { document: 'plateAssets/{assetId}', region: 'us-central1' },
  async (event) => {
    return writeAuditFromEvent('plateAssets', event);
  }
);

module.exports = { onPlateAssetWrite: handler };
