'use strict';
module.exports = {
  QUOTE_STATUS: ['draft', 'pending', 'ready', 'sent', 'won', 'lost', 'rejected', 'production'],
  ORDER_STATUS: ['draft', 'pending_approval', 'approved', 'in_progress', 'shipped', 'completed', 'cancelled'],
  JOB_STATUS: ['created', 'prepress', 'proofing', 'approved', 'plating', 'ready', 'production', 'qc', 'released', 'shipped', 'closed'],
  VPO_STATUS: ['draft', 'pending_approval', 'approved', 'sent', 'partial_receipt', 'received', 'closed', 'cancelled'],
  NCR_STATUS: ['open', 'investigation', 'corrective_action', 'verification', 'closed'],
  CAPA_STATUS: ['open', 'root_cause', 'action_plan', 'implementation', 'verification', 'effectiveness', 'closed'],
  TRAINING_STATUS: ['assigned', 'in_progress', 'completed', 'expired', 'overdue']
};
