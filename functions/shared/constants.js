'use strict';
// AI Agent system constants
const AGENT_NAMES = {
  QUOTE: 'quoteAgent',
  PURCHASING: 'purchasingAgent',
  SQF: 'sqfAgent',
  JOB: 'jobAgent',
  LEADERSHIP: 'leadershipAgent',
  TRAINING: 'trainingAgent',
  FINANCE: 'financeAgent',
  OPS: 'opsOrchestrator'
};

const AGENT_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  RECOMMENDATION_CREATED: 'recommendation_created',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTED: 'executed',
  VERIFIED: 'verified',
  CLOSED: 'closed',
  FAILED: 'failed'
};

const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const APPROVAL_MODES = {
  RECOMMEND_ONLY: 'recommend_only',
  DRAFT_AND_APPROVE: 'draft_and_approve',
  AUTO_EXECUTE_LOW_RISK: 'auto_execute_low_risk'
};

// Actions that NEVER auto-execute
const BLOCKED_AUTO_ACTIONS = [
  'release_product',
  'close_capa',
  'approve_proof',
  'approve_quality_release',
  'approve_financial',
  'change_permissions',
  'push_released_state',
  'sign_training_complete',
  'alter_controlled_revision',
  'bypass_traceability'
];

// Safe auto-execute actions
const SAFE_AUTO_ACTIONS = [
  'create_reminder_task',
  'post_internal_notification',
  'create_internal_digest',
  'create_internal_alert',
  'update_risk_score'
];

module.exports = { AGENT_NAMES, AGENT_STATUS, SEVERITY, APPROVAL_MODES, BLOCKED_AUTO_ACTIONS, SAFE_AUTO_ACTIONS };
