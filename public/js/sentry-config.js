// ═══════════════════════════════════════════════════════════════
// MFX OS — Sentry Configuration
//
// SETUP INSTRUCTIONS:
// 1. Go to https://sentry.io and create a free account
// 2. Create a new project → Platform: JavaScript → Name: MFX-OS
// 3. Copy your DSN (looks like: https://abc123@o456.ingest.sentry.io/789)
// 4. Replace the DSN below
// 5. Rebuild and deploy: npm run build && firebase deploy --only hosting
// ═══════════════════════════════════════════════════════════════

window.MFX_SENTRY_DSN = '';
// Example: window.MFX_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

// Sentry user context — set after login
window.MFX_SENTRY_SET_USER = function() {
  if (window.Sentry && typeof getUserName === 'function' && typeof getUserId === 'function') {
    Sentry.setUser({
      id: getUserId(),
      username: getUserName(),
      email: typeof CURRENT_USER !== 'undefined' && CURRENT_USER ? CURRENT_USER.email : ''
    });
    Sentry.setTag('dept', typeof getMFXProfile === 'function' ? getMFXProfile().dept : 'unknown');
  }
};
