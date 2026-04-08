'use strict';
const { AGENT_NAMES } = require('../../shared/constants');

// Registry of all available agents and their configs
const REGISTRY = {
  [AGENT_NAMES.QUOTE]: {
    name: AGENT_NAMES.QUOTE,
    label: 'Quote Agent',
    description: 'Accelerates RFQ and quote follow-up',
    module: 'sales',
    triggerTypes: ['request_created', 'quote_aging', 'quote_sent', 'quote_pending_approval'],
    readCollections: ['requests', 'quotes', 'customers', 'salesOrders'],
    enabled: true,
    version: '1.0.0'
  },
  [AGENT_NAMES.PURCHASING]: {
    name: AGENT_NAMES.PURCHASING,
    label: 'Purchasing Agent',
    description: 'Manages low stock, reorder risk, and vendor delays',
    module: 'logistics',
    triggerTypes: ['low_stock', 'po_overdue', 'receiving_mismatch', 'vendor_eta_slip'],
    readCollections: ['materials', 'materialLots', 'vendorPOs', 'vendors', 'receivingQueue'],
    enabled: true,
    version: '1.0.0'
  },
  [AGENT_NAMES.SQF]: {
    name: AGENT_NAMES.SQF,
    label: 'SQF Agent',
    description: 'Compliance watch, training, CAPA support, and audit prep',
    module: 'quality',
    triggerTypes: ['training_expiring', 'ncr_opened', 'audit_due', 'doc_revision', 'sanitation_exception'],
    readCollections: ['trainingRecords', 'ncrs', 'audits', 'dcrs', 'gmpInspections'],
    enabled: true,
    version: '1.0.0'
  },
  [AGENT_NAMES.JOB]: {
    name: AGENT_NAMES.JOB,
    label: 'Job Agent',
    description: 'Job readiness, packet assembly, and stage stall detection',
    module: 'production',
    triggerTypes: ['order_approved', 'ticket_created', 'stage_stalled', 'packet_incomplete'],
    readCollections: ['jobTickets', 'jobPassports', 'prepressInbox', 'approvalRecords'],
    enabled: true,
    version: '1.0.0'
  },
  [AGENT_NAMES.LEADERSHIP]: {
    name: AGENT_NAMES.LEADERSHIP,
    label: 'Leadership Agent',
    description: 'Cross-functional summaries and exception reporting',
    module: 'leadership',
    triggerTypes: ['daily_digest', 'shift_end', 'critical_event'],
    readCollections: ['agentRecommendations', 'systemHealth', 'activity'],
    enabled: true,
    version: '1.0.0'
  },
  [AGENT_NAMES.TRAINING]: {
    name: AGENT_NAMES.TRAINING,
    label: 'Training Agent',
    description: 'Training, onboarding, and compliance assignment',
    module: 'quality',
    triggerTypes: ['training_expiring', 'new_employee', 'role_change'],
    readCollections: ['trainingRecords', 'trainingPrograms', 'employees'],
    enabled: true,
    version: '1.0.0'
  },
  [AGENT_NAMES.FINANCE]: {
    name: AGENT_NAMES.FINANCE,
    label: 'Finance Agent',
    description: 'AR aging, collections, credit risk',
    module: 'finance',
    triggerTypes: ['invoice_aging', 'credit_hold', 'collections_due'],
    readCollections: ['invoices', 'vendorInvoices', 'salesOrders'],
    enabled: true,
    version: '1.0.0'
  }
};

function getAgent(name) { return REGISTRY[name] || null; }
function getEnabledAgents() { return Object.values(REGISTRY).filter(a => a.enabled); }
function getAllAgents() { return Object.values(REGISTRY); }
function isEnabled(name) { const a = REGISTRY[name]; return a ? a.enabled : false; }

module.exports = { REGISTRY, getAgent, getEnabledAgents, getAllAgents, isEnabled };
