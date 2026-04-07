// so-workflow.js — Sales Order workflow helpers
// Client-side validation that mirrors server-side STATE_MACHINES.salesOrders
(function() {
  'use strict';

  var SO_TRANSITIONS = {
    'pending':   ['approved', 'rejected', 'cancelled'],
    'approved':  ['sent', 'cancelled'],
    'rejected':  ['pending', 'cancelled'],
    'sent':      ['fulfilled', 'cancelled'],
    'fulfilled': ['closed'],
    'cancelled': [],
    'closed':    []
  };

  window.MFX_SO_WORKFLOW = {
    transitions: SO_TRANSITIONS,

    canTransition: function(fromStatus, toStatus) {
      var allowed = SO_TRANSITIONS[(fromStatus || '').toLowerCase()] || [];
      return allowed.indexOf((toStatus || '').toLowerCase()) !== -1;
    },

    getAllowedTransitions: function(currentStatus) {
      return SO_TRANSITIONS[(currentStatus || '').toLowerCase()] || [];
    },

    // Transition via server-side API (preferred)
    transitionViaAPI: function(docId, newStatus, note) {
      if (typeof getMFXAuthHeaders !== 'function') {
        return Promise.reject(new Error('Auth not available'));
      }
      return getMFXAuthHeaders().then(function(headers) {
        return fetch('/api/transitionStatus', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            collection: 'salesOrders',
            docId: docId,
            newStatus: newStatus,
            note: note || ''
          })
        }).then(function(r) { return r.json(); }).catch(function(e){ console.warn('so-workflow fetch:', e.message); });
      });
    }
  };
})();
