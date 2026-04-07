'use strict';
module.exports = {
  rules: [
    { condition: 'recommendation_pending > 24h', action: 'escalate_to_manager', channel: 'flex-alerts' },
    { condition: 'recommendation_pending > 48h', action: 'escalate_to_ops_manager', channel: 'flex-alerts' },
    { condition: 'critical_severity_unreviewed > 4h', action: 'escalate_to_leadership', channel: 'flex-alerts' },
    { condition: 'agent_failure_rate > 30%', action: 'disable_agent_and_alert', channel: 'flex-alerts' },
    { condition: 'blocked_action_attempted', action: 'log_and_alert_admin', channel: 'flex-alerts' }
  ]
};
