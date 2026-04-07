'use strict';
const { BLOCKED_AUTO_ACTIONS, SAFE_AUTO_ACTIONS, APPROVAL_MODES, SEVERITY } = require('../../shared/constants');

// Approval matrix: determines if an action needs human approval
const APPROVAL_MATRIX = {
  // Action type -> required approval level
  'create_task': { mode: APPROVAL_MODES.AUTO_EXECUTE_LOW_RISK, minRole: null },
  'post_notification': { mode: APPROVAL_MODES.AUTO_EXECUTE_LOW_RISK, minRole: null },
  'create_digest': { mode: APPROVAL_MODES.AUTO_EXECUTE_LOW_RISK, minRole: null },
  'create_alert': { mode: APPROVAL_MODES.AUTO_EXECUTE_LOW_RISK, minRole: null },
  'update_risk_score': { mode: APPROVAL_MODES.AUTO_EXECUTE_LOW_RISK, minRole: null },
  'draft_email': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'manager' },
  'draft_po': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'manager' },
  'draft_follow_up': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'manager' },
  'create_passport': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'operations_manager' },
  'assemble_packet': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'manager' },
  'transition_status': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'operations_manager' },
  'release_product': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'ceo' },
  'close_capa': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'quality_manager' },
  'approve_financial': { mode: APPROVAL_MODES.DRAFT_AND_APPROVE, minRole: 'ceo' }
};

function requiresApproval(actionType, severity) {
  if (BLOCKED_AUTO_ACTIONS.includes(actionType)) return true;
  if (SAFE_AUTO_ACTIONS.includes(actionType) && severity !== SEVERITY.CRITICAL) return false;
  const matrix = APPROVAL_MATRIX[actionType];
  if (!matrix) return true; // unknown actions always need approval
  return matrix.mode !== APPROVAL_MODES.AUTO_EXECUTE_LOW_RISK;
}

function getApprovalMode(actionType) {
  const matrix = APPROVAL_MATRIX[actionType];
  return matrix ? matrix.mode : APPROVAL_MODES.DRAFT_AND_APPROVE;
}

function getMinRole(actionType) {
  const matrix = APPROVAL_MATRIX[actionType];
  return matrix ? matrix.minRole : 'ceo';
}

function canApprove(userRole, actionType) {
  const ROLE_HIERARCHY = ['operator', 'user', 'coordinator', 'supervisor', 'manager', 'operations_manager', 'quality_manager', 'director', 'ceo', 'admin', 'administrator', 'owner'];
  const minRole = getMinRole(actionType);
  if (!minRole) return true;
  const userLevel = ROLE_HIERARCHY.indexOf(userRole.toLowerCase());
  const requiredLevel = ROLE_HIERARCHY.indexOf(minRole);
  return userLevel >= requiredLevel;
}

module.exports = { requiresApproval, getApprovalMode, getMinRole, canApprove, APPROVAL_MATRIX };
