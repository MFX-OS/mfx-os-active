'use strict';
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onDocumentCreated(
  { document: 'ncrs/{ncrId}', region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const ncrData = snap.data();
    const ncrId = event.params.ncrId;

    console.log(`NCR created: ${ncrId}`);

    await enqueue('sqfAgent', 'ncr_opened', {
      sourceCollection: 'ncrs',
      sourceId: ncrId,
      severity: ncrData.severity || null,
      department: ncrData.department || null,
      description: ncrData.description || null,
    });
  }
);

module.exports = { onNCRWrite: handler };
