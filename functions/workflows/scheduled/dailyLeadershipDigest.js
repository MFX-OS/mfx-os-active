'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { runAgent } = require('../../agents/core/runAgent');

const handler = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'America/Chicago',
    region: 'us-central1',
  },
  async () => {
    console.log('Running daily leadership digest...');

    try {
      const result = await runAgent('leadershipAgent', 'scheduled_digest', {
        digestType: 'morning',
        period: 'daily',
      }, 'system');

      console.log('Leadership digest completed:', result);
    } catch (e) {
      console.error('Leadership digest failed:', e);
      throw e;
    }
  }
);

module.exports = { dailyLeadershipDigest: handler };
