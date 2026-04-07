'use strict';
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { enqueue } = require('../../agents/core/agentQueue');

const handler = onDocumentWritten(
  { document: 'jobTickets/{ticketId}', region: 'us-central1' },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : null;
    const afterData = event.data.after.exists ? event.data.after.data() : null;
    const ticketId = event.params.ticketId;

    // Deletion -- nothing to do
    if (!afterData) return;

    const isNew = !beforeData;
    const beforeStage = beforeData ? beforeData.stage : null;
    const afterStage = afterData.stage;
    const stageChanged = beforeStage !== afterStage;

    // Enqueue jobAgent when ticket is created or stage changes
    if (isNew || stageChanged) {
      const triggerType = isNew ? 'job_ticket_created' : 'job_stage_change';
      console.log(`Job ticket ${ticketId}: ${triggerType} (stage: ${beforeStage} -> ${afterStage})`);

      await enqueue('jobAgent', triggerType, {
        sourceCollection: 'jobTickets',
        sourceId: ticketId,
        previousStage: beforeStage,
        currentStage: afterStage,
        jobNumber: afterData.jobNumber || null,
        product: afterData.product || null,
      });
    }
  }
);

module.exports = { onJobTicketWrite: handler };
