'use strict';
// Fields to redact from agent context to prevent data leakage
module.exports = {
  globalRedact: ['password', 'ssn', 'bankAccount', 'creditCard', 'apiKey', 'secret', 'token'],
  collectionRedact: {
    employees: ['ssn', 'bankInfo', 'salary', 'medicalInfo'],
    customers: ['creditCardNumber', 'bankDetails'],
    users: ['passwordHash', 'refreshToken', 'mfaSecret']
  },
  // Redact from LLM prompts
  redactFromPrompt(data, collection) {
    if (!data || typeof data !== 'object') return data;
    const redacted = { ...data };
    const fields = [...this.globalRedact, ...(this.collectionRedact[collection] || [])];
    fields.forEach(f => { if (redacted[f]) redacted[f] = '[REDACTED]'; });
    return redacted;
  }
};
