'use strict';
// DATA-06 fix (2026-05-24): server trigger for the approvalRecords collection.
// Delegates to lib/auditWrite for activity + _auditLog + statusHistory writes.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { writeAuditFromEvent } = require('../../lib/auditWrite');

const handler = onDocumentWritten(
  { document: 'approvalRecords/{docId}', region: 'us-central1' },
  async (event) => {
    return writeAuditFromEvent('approvalRecords', event);
  }
);

module.exports = { onApprovalRecordWrite: handler };
