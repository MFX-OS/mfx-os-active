'use strict';
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onDocumentCreated(
  { document: 'requests/{requestId}', region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const requestData = snap.data();
    const requestId = event.params.requestId;

    console.log(`New request created: ${requestId}`);

    await enqueue('quoteAgent', 'request_created', {
      sourceCollection: 'requests',
      sourceId: requestId,
      customerName: requestData.customerName || null,
      productType: requestData.productType || null,
    });
  }
);

module.exports = { onRequestCreate: handler };
