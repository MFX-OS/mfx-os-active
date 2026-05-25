'use strict';
// DATA-06 fix (2026-05-24): server trigger for the jobPassports collection.
// Delegates to lib/auditWrite for activity + _auditLog + statusHistory writes.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { writeAuditFromEvent } = require('../../lib/auditWrite');

const handler = onDocumentWritten(
  { document: 'jobPassports/{passportId}', region: 'us-central1' },
  async (event) => {
    return writeAuditFromEvent('jobPassports', event);
  }
);

module.exports = { onJobPassportWrite: handler };
