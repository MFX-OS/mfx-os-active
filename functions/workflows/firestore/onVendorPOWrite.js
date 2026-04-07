'use strict';
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onDocumentWritten(
  { document: 'vendorPOs/{poId}', region: 'us-central1' },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    const poId = event.params.poId;

    // Deletion -- nothing to do
    if (!afterData) return;

    const beforeStatus = beforeData ? beforeData.status : null;
    const afterStatus = afterData.status;

    // Enqueue purchasingAgent when status changes
    if (afterStatus !== beforeStatus) {
      console.log(`Vendor PO ${poId} status changed: ${beforeStatus} -> ${afterStatus}`);
      await enqueue('purchasingAgent', 'vendor_po_status_change', {
        sourceCollection: 'vendorPOs',
        sourceId: poId,
        previousStatus: beforeStatus,
        newStatus: afterStatus,
        vendorName: afterData.vendorName || null,
      });
    }
  }
);

module.exports = { onVendorPOWrite: handler };
