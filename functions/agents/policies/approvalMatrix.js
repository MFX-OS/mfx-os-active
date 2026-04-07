'use strict';
module.exports = {
  // severity -> required approver role
  approval_thresholds: {
    low: 'supervisor',
    medium: 'manager',
    high: 'operations_manager',
    critical: 'ceo'
  },
  // department -> default approver role
  department_approvers: {
    sales: 'operations_manager',
    production: 'operations_manager',
    logistics: 'operations_manager',
    quality: 'quality_manager',
    finance: 'ceo',
    hr: 'operations_manager'
  },
  // Maximum auto-execute actions per agent per hour
  rate_limits: {
    quoteAgent: 20,
    purchasingAgent: 15,
    sqfAgent: 15,
    jobAgent: 10,
    leadershipAgent: 5
  }
};
