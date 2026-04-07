// pipeline-patch.js — Quote pipeline status sync
// Ensures quote status transitions are reflected in real-time listeners
(function() {
  'use strict';
  // If quote status changes happen via the server-side transitionStatus API,
  // the Firestore onSnapshot listeners in core.js handle the UI update automatically.
  // This patch adds a safety net for any client-side status writes that bypass the API.

  if (typeof window.MFX === 'undefined') window.MFX = {};
  if (typeof window.MFX._pipelinePatched !== 'undefined') return;
  window.MFX._pipelinePatched = true;

  // Ensure quote list re-renders when a status change is detected
  var origGoView = window.goView;
  if (typeof origGoView === 'function') {
    window.goView = function(view) {
      origGoView(view);
      // Force refresh quote counts when navigating to quotes or dashboard
      if ((view === 'quotes' || view === 'dashboard') && typeof window.refreshQuoteCounts === 'function') {
        try { window.refreshQuoteCounts(); } catch(e) {}
      }
    };
  }
})();
