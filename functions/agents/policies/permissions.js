'use strict';
// Agent permission policies — what each agent can read/write

const AGENT_PERMISSIONS = {
  quoteAgent: {
    read: ['requests', 'quotes', 'customers', 'salesOrders'],
    write: [], // recommendations only
    draft: ['tasks', 'notifications'],
    blocked: ['approve_quote', 'send_external_email', 'modify_price_after_lock']
  },
  purchasingAgent: {
    read: ['materials', 'materialLots', 'vendorPOs', 'vendors', 'receivingQueue'],
    write: [],
    draft: ['tasks', 'notifications'],
    blocked: ['issue_po_over_threshold', 'mark_receipt_complete', 'alter_lot_traceability']
  },
  sqfAgent: {
    read: ['trainingRecords', 'ncrs', 'audits', 'dcrs', 'managementReviews', 'gmpInspections', 'gmpReadings', 'swabResults', 'waterTests', 'sqfEscalations'],
    write: [],
    draft: ['tasks', 'notifications'],
    blocked: ['close_capa', 'release_product', 'sign_training_complete', 'alter_audit_result']
  },
  jobAgent: {
    read: ['jobTickets', 'jobPassports', 'prepressInbox', 'approvalRecords', 'prepressQueue', 'ppdEvents'],
    write: [],
    draft: ['tasks', 'notifications'],
    blocked: ['advance_to_released', 'override_exception_without_approval']
  },
  leadershipAgent: {
    read: ['agentRecommendations', 'systemHealth', 'syncEvents', 'activity', 'quotes', 'ncrs', 'vendorPOs'],
    write: [],
    draft: ['notifications'],
    blocked: ['all_operational_state_changes']
  }
};

function canRead(agentName, collection) {
  const perms = AGENT_PERMISSIONS[agentName];
  return perms ? perms.read.includes(collection) : false;
}

function canDraft(agentName, collection) {
  const perms = AGENT_PERMISSIONS[agentName];
  return perms ? perms.draft.includes(collection) : false;
}

function isBlocked(agentName, action) {
  const perms = AGENT_PERMISSIONS[agentName];
  return perms ? perms.blocked.includes(action) : true;
}

module.exports = { AGENT_PERMISSIONS, canRead, canDraft, isBlocked };
