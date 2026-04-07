'use strict';
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onDocumentWritten(
  { document: 'trainingRecords/{recordId}', region: 'us-central1' },
  async (event) => {
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    const recordId = event.params.recordId;

    // Deletion -- nothing to do
    if (!afterData) return;

    // Check if expiration is approaching (within 30 days)
    const expirationDate = afterData.expirationDate
      ? (afterData.expirationDate.toDate ? afterData.expirationDate.toDate() : new Date(afterData.expirationDate))
      : null;

    if (!expirationDate) return;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (expirationDate <= thirtyDaysFromNow && expirationDate > now) {
      console.log(`Training record ${recordId} expiring soon: ${expirationDate.toISOString()}`);

      await enqueue('sqfAgent', 'training_expiring', {
        sourceCollection: 'trainingRecords',
        sourceId: recordId,
        employeeId: afterData.employeeId || null,
        trainingType: afterData.trainingType || null,
        expirationDate: expirationDate.toISOString(),
      });
    }
  }
);

module.exports = { onTrainingRecordWrite: handler };
