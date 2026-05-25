'use strict';
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onDocumentWritten(
  { document: 'quotes/{quoteId}', region: 'us-central1' },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    const quoteId = event.params.quoteId;

    // Deletion -- nothing to do
    if (!afterData) return;

    const beforeStatus = beforeData ? beforeData.status : null;
    const afterStatus = afterData.status;

    // When status changes to 'sent', enqueue quoteAgent
    if (afterStatus === 'sent' && beforeStatus !== 'sent') {
      console.log(`Quote ${quoteId} status changed to 'sent'`);
      await enqueue('quoteAgent', 'quote_sent', {
        sourceCollection: 'quotes',
        sourceId: quoteId,
        customerName: afterData.customerName || null,
        amount: afterData.totalAmount || null,
      });
    }

    // Note: overdue quote detection is handled by the scheduled overdueQuoteSweep
  }
);

module.exports = { onQuoteWrite: handler };
