'use strict';
// DATA-06 fix (2026-05-24): server trigger for the blueprints collection.
// Delegates to lib/auditWrite for activity + _auditLog + statusHistory writes.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { writeAuditFromEvent } = require('../../lib/auditWrite');

const handler = onDocumentWritten(
  { document: 'blueprints/{blueprintId}', region: 'us-central1' },
  async (event) => {
    return writeAuditFromEvent('blueprints', event);
  }
);

module.exports = { onBlueprintWrite: handler };
