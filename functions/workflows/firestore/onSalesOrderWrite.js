'use strict';
// DATA-06 fix (2026-05-24): server trigger for the salesOrders collection.
// Delegates to lib/auditWrite for activity + _auditLog + statusHistory writes.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { writeAuditFromEvent } = require('../../lib/auditWrite');

const handler = onDocumentWritten(
  { document: 'salesOrders/{soId}', region: 'us-central1' },
  async (event) => {
    return writeAuditFromEvent('salesOrders', event);
  }
);

module.exports = { onSalesOrderWrite: handler };
