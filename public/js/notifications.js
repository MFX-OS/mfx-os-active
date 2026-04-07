(function() {
  'use strict';
  // MFX OS Notification System v1
  // Complete notification management with Firebase and Google Workspace integration

  const STATE = {
    notifications: [],
    unreadCount: 0,
    panelOpen: false,
    activeTab: 'all',
    lastGmailCheck: 0,
    lastCalendarCheck: 0,
    lastTasksCheck: 0,
    pollingIntervals: {}
  };

  const CONFIG = {
    POLL_INTERVAL_GMAIL: 120000, // 2 minutes
    POLL_INTERVAL_CALENDAR: 300000, // 5 minutes
    POLL_INTERVAL_TASKS: 300000, // 5 minutes
    FLASH_DURATION: 5000, // 5 seconds
    FIRESTORE_BATCH_SIZE: 20
  };

  // Listener tracking for cleanup (prevents memory leaks)
  var _notifListeners = [];

  function _trackListener(el, ev, fn) {
    if (el) {
      el.addEventListener(ev, fn);
      _notifListeners.push({el: el, ev: ev, fn: fn});
    }
  }

  // Render-specific listeners (cleared each time renderNotificationList runs)
  var _renderListeners = [];

  function _trackRenderListener(el, ev, fn) {
    if (el) {
      el.addEventListener(ev, fn);
      _renderListeners.push({el: el, ev: ev, fn: fn});
    }
  }

  function _cleanupRenderListeners() {
    _renderListeners.forEach(function(l) {
      if (l.el) l.el.removeEventListener(l.ev, l.fn);
    });
    _renderListeners = [];
  }

  function cleanupNotifListeners() {
    _cleanupRenderListeners();
    _notifListeners.forEach(function(l) {
      if (l.el) l.el.removeEventListener(l.ev, l.fn);
    });
    _notifListeners = [];
  }
  window.cleanupNotifListeners = cleanupNotifListeners;

  // ============================================================================
  // STYLES - Inject CSS
  // ============================================================================
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'mfx-notif-styles';
    style.textContent = `
      /* Notification Bell */
      .mfx-notif-bell {
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 8px;
        background: rgba(0, 229, 255, 0.08);
        border: 1px solid rgba(0, 229, 255, 0.12);
        transition: all 0.2s ease;
        font-size: 20px;
      }

      .mfx-notif-bell:hover {
        background: rgba(0, 229, 255, 0.12);
        border-color: rgba(0, 229, 255, 0.24);
      }

      .mfx-notif-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #f44;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        border: 2px solid #061e2a;
      }

      .mfx-notif-badge.hidden {
        display: none;
      }

      /* Notification Panel / Dropdown */
      .mfx-notif-panel {
        position: fixed;
        top: 56px;
        right: 12px;
        width: 380px;
        max-width: calc(100vw - 16px);
        max-height: min(500px, 70vh);
        background: #0a2535;
        border: 1px solid rgba(0, 229, 255, 0.12);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        animation: slideDown 0.3s ease;
        z-index: 700;
      }
      @media(max-width:720px){
        .mfx-notif-panel{width:calc(100vw - 16px);right:8px;left:8px}
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .mfx-notif-panel.hidden {
        display: none;
      }

      .mfx-notif-header {
        padding: 16px;
        border-bottom: 1px solid rgba(0, 229, 255, 0.12);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .mfx-notif-header h3 {
        margin: 0;
        color: #f5f2ed;
        font-size: 18px;
        font-weight: 600;
      }

      .mfx-notif-close {
        background: none;
        border: none;
        color: #f5f2ed;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
      }

      .mfx-notif-close:hover {
        color: #00e5ff;
      }

      /* Tabs */
      .mfx-notif-tabs {
        display: flex;
        border-bottom: 1px solid rgba(0, 229, 255, 0.12);
        overflow-x: auto;
      }

      .mfx-notif-tab {
        padding: 12px 16px;
        background: none;
        border: none;
        color: #a0a0a0;
        cursor: pointer;
        font-size: 14px;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }

      .mfx-notif-tab:hover {
        color: #f5f2ed;
      }

      .mfx-notif-tab.active {
        color: #00e5ff;
        border-bottom-color: #00e5ff;
      }

      /* Notification List */
      .mfx-notif-list {
        flex: 1;
        overflow-y: auto;
        padding: 0;
      }

      .mfx-notif-item {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0, 229, 255, 0.06);
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .mfx-notif-item:hover {
        background: rgba(0, 229, 255, 0.08);
      }

      .mfx-notif-item.unread {
        background: rgba(0, 229, 255, 0.05);
      }

      .mfx-notif-icon {
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .mfx-notif-content {
        flex: 1;
        min-width: 0;
      }

      .mfx-notif-title {
        margin: 0 0 4px 0;
        color: #f5f2ed;
        font-size: 14px;
        font-weight: 600;
      }

      .mfx-notif-body {
        margin: 0 0 4px 0;
        color: #a0a0a0;
        font-size: 13px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .mfx-notif-meta {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: 12px;
      }

      .mfx-notif-time {
        color: #707070;
      }

      .mfx-notif-badge-source {
        background: rgba(0, 229, 255, 0.12);
        color: #00e5ff;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
      }

      .mfx-notif-actions {
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .mfx-notif-item:hover .mfx-notif-actions {
        opacity: 1;
      }

      .mfx-notif-action-btn {
        background: none;
        border: 1px solid rgba(0, 229, 255, 0.24);
        color: #00e5ff;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
      }

      .mfx-notif-action-btn:hover {
        background: rgba(0, 229, 255, 0.12);
        border-color: #00e5ff;
      }

      /* Flash Notifications */
      .mfx-notif-flash {
        position: fixed;
        top: 80px;
        right: 20px;
        background: #0a2535;
        border: 1px solid rgba(0, 229, 255, 0.12);
        border-radius: 8px;
        padding: 12px 16px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        max-width: 360px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        animation: flashIn 0.3s ease;
        cursor: pointer;
        z-index: 710;
      }

      @keyframes flashIn {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes flashOut {
        to {
          opacity: 0;
          transform: translateY(-20px);
        }
      }

      .mfx-notif-flash.closing {
        animation: flashOut 0.3s ease forwards;
      }

      .mfx-notif-flash-icon {
        font-size: 20px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .mfx-notif-flash-content {
        flex: 1;
        min-width: 0;
      }

      .mfx-notif-flash-title {
        margin: 0 0 2px 0;
        color: #f5f2ed;
        font-size: 14px;
        font-weight: 600;
      }

      .mfx-notif-flash-body {
        margin: 0;
        color: #a0a0a0;
        font-size: 12px;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .mfx-notif-flash-time {
        color: #707070;
        font-size: 11px;
        margin-top: 2px;
      }

      .mfx-notif-flash-close {
        background: none;
        border: none;
        color: #707070;
        cursor: pointer;
        padding: 0;
        font-size: 18px;
        flex-shrink: 0;
        transition: color 0.2s;
      }

      .mfx-notif-flash-close:hover {
        color: #f5f2ed;
      }

      /* Footer */
      .mfx-notif-footer {
        padding: 12px 16px;
        border-top: 1px solid rgba(0, 229, 255, 0.12);
        display: flex;
        gap: 8px;
      }

      .mfx-notif-footer-btn {
        padding: 8px 12px;
        background: rgba(0, 229, 255, 0.08);
        border: 1px solid rgba(0, 229, 255, 0.24);
        color: #00e5ff;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .mfx-notif-footer-btn:hover {
        background: rgba(0, 229, 255, 0.16);
      }

      /* Empty State */
      .mfx-notif-empty {
        padding: 40px 16px;
        text-align: center;
        color: #707070;
        font-size: 14px;
      }

      /* Modal */
      .mfx-notif-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 720;
      }

      .mfx-notif-modal.hidden {
        display: none;
      }

      .mfx-notif-modal-content {
        background: #0a2535;
        border: 1px solid rgba(0, 229, 255, 0.12);
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
      }

      .mfx-notif-modal-title {
        margin: 0 0 16px 0;
        color: #f5f2ed;
        font-size: 18px;
        font-weight: 600;
      }

      .mfx-notif-modal-list {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 16px;
      }

      .mfx-notif-modal-item {
        padding: 10px;
        margin-bottom: 8px;
        background: rgba(0, 229, 255, 0.06);
        border: 1px solid rgba(0, 229, 255, 0.12);
        border-radius: 6px;
        cursor: pointer;
        color: #f5f2ed;
        font-size: 14px;
        transition: all 0.2s;
      }

      .mfx-notif-modal-item:hover {
        background: rgba(0, 229, 255, 0.12);
        border-color: rgba(0, 229, 255, 0.24);
      }

      .mfx-notif-modal-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .mfx-notif-modal-btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid rgba(0, 229, 255, 0.24);
        background: rgba(0, 229, 255, 0.08);
        color: #00e5ff;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }

      .mfx-notif-modal-btn:hover {
        background: rgba(0, 229, 255, 0.16);
      }

      .mfx-notif-modal-btn.cancel {
        background: transparent;
        color: #a0a0a0;
      }

      .mfx-notif-modal-btn.cancel:hover {
        background: rgba(0, 229, 255, 0.06);
        color: #f5f2ed;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // DOM INITIALIZATION
  // ============================================================================
  function initializeDOM() {
    // Inject notification bell into header
    const hdrActions = document.getElementById('hdrActions');
    if (hdrActions && !document.getElementById('mfx-notif-bell')) {
      const bellHTML = `
        <button id="mfx-notif-bell" title="Notifications" style="position:relative;background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center">
          <span id="mfx-notif-dot" style="width:8px;height:8px;border-radius:50%;background:var(--ac,#00e5ff);display:block;box-shadow:0 0 6px rgba(0,229,255,.5)"></span>
        </button>
      `;
      hdrActions.insertAdjacentHTML('beforeend', bellHTML);

      var _bellHandler = function(e) {
        e.stopPropagation();
        toggleNotifDropdown();
      };
      _trackListener(document.getElementById('mfx-notif-bell'), 'click', _bellHandler);
    }

    // Create notification panel
    if (!document.getElementById('mfx-notif-panel')) {
      const panelHTML = `
        <div id="mfx-notif-panel" class="mfx-notif-panel hidden">
          <div class="mfx-notif-header">
            <h3>Notifications</h3>
            <button class="mfx-notif-close" id="mfx-notif-panel-close">✕</button>
          </div>
          <div class="mfx-notif-tabs">
            <button class="mfx-notif-tab active" data-tab="all">All</button>
            <button class="mfx-notif-tab" data-tab="alerts">Alerts</button>
            <button class="mfx-notif-tab" data-tab="mentions">Mentions</button>
            <button class="mfx-notif-tab" data-tab="tasks">Tasks</button>
            <button class="mfx-notif-tab" data-tab="reminders">Reminders</button>
            <button class="mfx-notif-tab" data-tab="jobs">Jobs</button>
          </div>
          <div class="mfx-notif-list" id="mfx-notif-list"></div>
          <div class="mfx-notif-footer">
            <button class="mfx-notif-footer-btn" id="mfx-notif-mark-all-read">Mark all as read</button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', panelHTML);

      // Tab event listeners
      document.querySelectorAll('.mfx-notif-tab').forEach(tab => {
        var _tabHandler = (e) => {
          document.querySelectorAll('.mfx-notif-tab').forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');
          STATE.activeTab = e.target.dataset.tab;
          renderNotificationList();
        };
        _trackListener(tab, 'click', _tabHandler);
      });

      _trackListener(document.getElementById('mfx-notif-panel-close'), 'click', togglePanel);
      _trackListener(document.getElementById('mfx-notif-mark-all-read'), 'click', markAllAsRead);
    }
  }

  // ============================================================================
  // NOTIFICATION MANAGEMENT
  // ============================================================================
  function addNotification(notification) {
    const now = Date.now();
    const notification_obj = {
      id: `notif_${now}_${Math.random().toString(36).substr(2, 9)}`,
      type: notification.type || 'alert',
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '📢',
      sourceView: notification.sourceView,
      sourceId: notification.sourceId,
      sourceUrl: notification.sourceUrl,
      from: notification.from || 'System',
      read: false,
      dismissed: false,
      priority: notification.priority || 'normal',
      timestamp: now,
      actions: notification.actions || []
    };

    STATE.notifications.unshift(notification_obj);
    STATE.unreadCount++;
    window.NOTIF_STATE = STATE;
    if(typeof _updateNotifBadge==='function') _updateNotifBadge((window._currentAlerts||[]).length);

    // Save to Firestore — strip undefined/null fields and sanitize deeply
    if (window.fbDb && typeof window.fbDb.collection === 'function') {
      try {
        const userId = (typeof getUserId === 'function' ? getUserId() : '');
        if (!userId) { /* skip Firestore save if no user */ }
        else {
          const payload = {
            userId: userId,
            type: String(notification_obj.type || 'alert'),
            title: String(notification_obj.title || ''),
            body: String(notification_obj.body || ''),
            icon: String(notification_obj.icon || ''),
            from: String(notification_obj.from || 'System'),
            read: false,
            dismissed: false,
            priority: String(notification_obj.priority || 'normal'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          };
          // Only add optional string fields if truthy
          if (notification_obj.sourceView) payload.sourceView = String(notification_obj.sourceView);
          if (notification_obj.sourceId) payload.sourceId = String(notification_obj.sourceId);
          if (notification_obj.sourceUrl) payload.sourceUrl = String(notification_obj.sourceUrl);
          window.fbDb.collection('notifications').add(payload)
            .catch(function(err) { if (err.code !== 'permission-denied') console.warn('Notif save:', err.code); });
        }
      } catch (err) {
        console.warn('Notif save error:', err.message);
      }
    }

    updateBadge();
    renderNotificationList();

    return notification_obj;
  }

  function dismissNotification(notifId) {
    const notif = STATE.notifications.find(n => n.id === notifId);
    if (notif) {
      notif.dismissed = true;
      STATE.notifications = STATE.notifications.filter(n => !n.dismissed);
      updateBadge();
      renderNotificationList();
    }
  }

  function markAsRead(notifId) {
    const notif = STATE.notifications.find(n => n.id === notifId);
    if (notif && !notif.read) {
      notif.read = true;
      STATE.unreadCount = Math.max(0, STATE.unreadCount - 1);
      updateBadge();
    }
  }

  function markAllAsRead() {
    STATE.notifications = [];
    STATE.unreadCount = 0;
    window._currentAlerts = [];
    updateBadge();
    renderNotificationList();
    renderNotificationList();
  }

  // ============================================================================
  // RENDERING
  // ============================================================================
  function updateBadge() {
    const dot = document.getElementById('mfx-notif-dot');
    if (dot) {
      var total = STATE.unreadCount + ((window._currentAlerts && window._currentAlerts.length) || 0);
      if (total > 0 && !STATE.panelOpen) {
        dot.style.animation = 'pulse 1.5s infinite';
      } else {
        dot.style.animation = 'none';
      }
    }
  }

  function renderNotificationList() {
    const list = document.getElementById('mfx-notif-list');
    if (!list) return;

    // Build unified notification list from all sources
    var allItems = STATE.notifications.slice();
    var me = typeof getUserName === 'function' ? getUserName() : '';
    var cutoff = Date.now() - (24 * 60 * 60 * 1000);

    // ── QUOTES: approvals, rejections, won, sent needing follow-up ──
    try {
      var qs = typeof DB !== 'undefined' && DB.quotes ? DB.quotes() : [];
      qs.forEach(function(q) {
        if (!q.updatedAt) return;
        var t = new Date(q.updatedAt).getTime();
        if (isNaN(t) || t < cutoff) return;
        if (q.status === 'approval' && q.createdBy === me) {
          allItems.push({id:'q_appr_'+q.id, type:'alerts', icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', title:q.quoteNum+' awaiting CEO approval', body:(q.fields.custCo||'')+' — '+q.rev, timestamp:q.updatedAt, sourceView:'editor', sourceId:q.id, read:false});
        }
        if (q.status === 'rejected' && q.createdBy === me) {
          allItems.push({id:'q_rej_'+q.id, type:'alerts', icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', title:q.quoteNum+' was rejected', body:(q.rejectionReason||'No reason given'), timestamp:q.updatedAt, sourceView:'editor', sourceId:q.id, read:false});
        }
        if (q.status === 'won' && q.createdBy === me) {
          allItems.push({id:'q_won_'+q.id, type:'alerts', icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', title:q.quoteNum+' WON!', body:(q.fields.custCo||'')+(q.wonAmount?' — $'+q.wonAmount:''), timestamp:q.closedAt||q.updatedAt, sourceView:'editor', sourceId:q.id, read:false});
        }
      });
    } catch(e) {}

    // ── @MENTIONS in quote internal notes ──
    try {
      qs.forEach(function(q) {
        (q.internalNotes||[]).forEach(function(n) {
          if (!n.text || !n.at) return;
          var t = new Date(n.at).getTime();
          if (isNaN(t) || t < cutoff) return;
          if (n.text.indexOf('@'+me) >= 0 || n.text.indexOf('@'+me.replace(/\s/g,'')) >= 0) {
            allItems.push({id:'mention_'+q.id+'_'+n.id, type:'mentions', icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>', title:(n.by||'Someone')+' mentioned you in '+q.quoteNum, body:n.text.substring(0,80), timestamp:n.at, sourceView:'editor', sourceId:q.id, read:false});
          }
        });
      });
    } catch(e) {}

    // ── TASKS assigned to user ──
    try {
      var tasks = window._rtTasks || JSON.parse(localStorage.getItem('mfx_tasks')||'[]');
      tasks.forEach(function(t) {
        if (t.done || t.completed) return;
        if (t.assignedTo && t.assignedTo !== me) return;
        var ts = t.createdAt || t.dueDate;
        if (!ts) return;
        allItems.push({id:'task_'+t.id, type:'tasks', icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>', title:t.title||t.text||'Task', body:t.dueDate?'Due: '+t.dueDate:'', timestamp:ts, sourceView:'dashboard', read:false});
      });
    } catch(e) {}

    // ── JOB TICKETS assigned to user ──
    try {
      var jts = window._jtCache || [];
      jts.forEach(function(jt) {
        if (!jt.updatedAt) return;
        var t = new Date(jt.updatedAt).getTime();
        if (isNaN(t) || t < cutoff) return;
        var assignee = jt.ppd && jt.ppd.assignedTo ? jt.ppd.assignedTo : '';
        if (assignee && assignee.toLowerCase().indexOf(me.toLowerCase()) >= 0) {
          allItems.push({id:'jt_'+jt.id, type:'jobs', icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', title:(jt.jtNum||jt.id)+' — '+(jt.company||''), body:'Stage: '+(jt.ppd&&jt.ppd.stage||jt.status||''), timestamp:jt.updatedAt, sourceView:'ppd', read:false});
        }
      });
    } catch(e) {}

    // ── SYSTEM ALERTS from _currentAlerts ──
    try {
      (window._currentAlerts||[]).forEach(function(a, i) {
        allItems.push({id:'alert_'+i, type:'alerts', icon:a.flag||'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', title:a.text||'Alert', body:'', timestamp:Date.now(), read:false});
      });
    } catch(e) {}

    // Deduplicate by id
    var seen = {};
    allItems = allItems.filter(function(n) {
      if (!n.id || seen[n.id]) return false;
      seen[n.id] = true;
      return true;
    });

    // Filter to last 24 hours
    allItems = allItems.filter(function(n) {
      var ts = n.timestamp;
      if (!ts) return true;
      var t = typeof ts === 'number' ? ts : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime());
      return !isNaN(t) && t > cutoff;
    });

    // Sort newest first
    allItems.sort(function(a, b) {
      var ta = a.timestamp ? (typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime()) : 0;
      var tb = b.timestamp ? (typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime()) : 0;
      return tb - ta;
    });

    // Filter by active tab
    var filtered = allItems;
    if (STATE.activeTab !== 'all') {
      filtered = filtered.filter(n => n.type === STATE.activeTab);
    }

    if (filtered.length === 0) {
      list.innerHTML = '<div class="mfx-notif-empty">No notifications yet</div>';
      return;
    }

    list.innerHTML = filtered.map(notif => `
      <div class="mfx-notif-item ${notif.read ? '' : 'unread'}" data-notif-id="${notif.id}">
        <div class="mfx-notif-icon">${notif.icon}</div>
        <div class="mfx-notif-content">
          <div class="mfx-notif-title">${escapeHtml(notif.title)}</div>
          <div class="mfx-notif-body">${escapeHtml(notif.body)}</div>
          <div class="mfx-notif-meta">
            <span class="mfx-notif-time">${timeAgo(notif.timestamp)}</span>
            ${notif.sourceView ? `<span class="mfx-notif-badge-source">${escapeHtml(notif.sourceView)}</span>` : ''}
          </div>
        </div>
        <div class="mfx-notif-actions">
          <button class="mfx-notif-action-btn" data-action="reassign">Reassign</button>
          <button class="mfx-notif-action-btn" data-action="dismiss">✕</button>
        </div>
      </div>
    `).join('');

    // Clean up old render listeners before attaching new ones
    _cleanupRenderListeners();

    // Attach event listeners
    list.querySelectorAll('.mfx-notif-item').forEach(item => {
      const notifId = item.dataset.notifId;
      const notif = STATE.notifications.find(n => n.id === notifId);

      var _itemClickHandler = (e) => {
        if (!e.target.closest('.mfx-notif-actions')) {
          // Dismiss on click — remove from list entirely
          dismissNotification(notifId);
          togglePanel();
          // Navigate to the right place
          if (notif && notif.sourceView === 'editor' && notif.sourceId && typeof openEditor === 'function') {
            openEditor(notif.sourceId);
          } else if (notif && notif.sourceUrl) {
            window.open(notif.sourceUrl, '_blank');
          } else if (notif && notif.sourceView) {
            goView(notif.sourceView);
          }
        }
      };
      _trackRenderListener(item, 'click', _itemClickHandler);

      var dismissBtn = item.querySelector('[data-action="dismiss"]');
      if (dismissBtn) {
        var _dismissHandler = (e) => {
          e.stopPropagation();
          dismissNotification(notifId);
        };
        _trackRenderListener(dismissBtn, 'click', _dismissHandler);
      }

      var reassignBtn = item.querySelector('[data-action="reassign"]');
      if (reassignBtn) {
        var _reassignHandler = (e) => {
          e.stopPropagation();
          showReassignModal(notifId);
        };
        _trackRenderListener(reassignBtn, 'click', _reassignHandler);
      }
    });
  }

  function showFlash(notification) {
    // Flash popups disabled — blue dot handles notification indication
    return;
    var activeFlashes = document.querySelectorAll('.mfx-notif-flash:not(.closing):not(.mfx-flash-more)');

    // If already 3 visible, show/update "view more" card instead of adding another
    if (activeFlashes.length >= 3) {
      var moreEl = document.getElementById('mfx-flash-more');
      if (!moreEl) {
        var moreHTML = '<div class="mfx-notif-flash mfx-flash-more" id="mfx-flash-more" onclick="if(typeof goView===\'function\')goView(\'notifications\');window._closeAllFlashes()" style="text-align:center;cursor:pointer;justify-content:center">';
        moreHTML += '<div style="font-size:11px;color:#00e5ff;font-weight:700">View more notifications...</div>';
        moreHTML += '</div>';
        document.body.insertAdjacentHTML('beforeend', moreHTML);
      }
      adjustFlashPositions();
      return;
    }

    var flashId = 'flash_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    var flashHTML = '<div class="mfx-notif-flash" id="' + flashId + '">';
    flashHTML += '<div class="mfx-notif-flash-icon">' + (notification.icon || '') + '</div>';
    flashHTML += '<div class="mfx-notif-flash-content">';
    flashHTML += '<div class="mfx-notif-flash-title">' + escapeHtml(notification.title) + '</div>';
    flashHTML += '<div class="mfx-notif-flash-body">' + escapeHtml(notification.body) + '</div>';
    flashHTML += '<div class="mfx-notif-flash-time">just now</div>';
    flashHTML += '</div>';
    flashHTML += '<button class="mfx-notif-flash-close" onclick="event.stopPropagation();window._closeFlash(\'' + flashId + '\')">✕</button>';
    flashHTML += '</div>';

    document.body.insertAdjacentHTML('beforeend', flashHTML);

    // Click body of flash to navigate then close
    var flash = document.getElementById(flashId);
    if (flash) {
      var _flashClickHandler = function(e) {
        if (!e.target.closest('.mfx-notif-flash-close')) {
          if (notification.sourceView) goView(notification.sourceView);
          else if (notification.sourceUrl) window.open(notification.sourceUrl, '_blank');
          window._closeFlash(flashId);
        }
      };
      _trackListener(flash, 'click', _flashClickHandler);
    }

    // Auto-dismiss after 8 seconds
    setTimeout(function() { window._closeFlash(flashId); }, 8000);
    adjustFlashPositions();
  }

  // Global close function accessible from onclick attributes
  window._closeFlash = function(flashId) { closeFlash(flashId); };
  window._closeAllFlashes = function() {
    document.querySelectorAll('.mfx-notif-flash').forEach(function(f) { f.remove(); });
  };

  function closeFlash(flashId) {
    const flash = document.getElementById(flashId);
    if (flash) {
      flash.classList.add('closing');
      setTimeout(() => {
        flash.remove();
        adjustFlashPositions();
      }, 300);
    }
  }

  function adjustFlashPositions() {
    const flashes = document.querySelectorAll('.mfx-notif-flash:not(.closing)');
    let topOffset = 80;
    flashes.forEach(flash => {
      flash.style.top = topOffset + 'px';
      topOffset += flash.offsetHeight + 12;
    });
  }

  function togglePanel() { toggleNotifDropdown(); }

  function toggleNotifDropdown() {
    var panel = document.getElementById('mfx-notif-panel');
    if (!panel) return;
    if (STATE.panelOpen) {
      // Close
      panel.classList.add('hidden');
      STATE.panelOpen = false;
      // Stop blink — user has seen notifications
      var dot = document.getElementById('mfx-notif-dot');
      if (dot) dot.style.animation = 'none';
    } else {
      // Close calendar dropdown if open
      var calDD = document.getElementById('mfx-cal-dropdown');
      if (calDD) { calDD.classList.add('hidden'); window._calDropdownOpen = false; }
      // Position below the bell button
      var bell = document.getElementById('mfx-notif-bell');
      if (bell) {
        var rect = bell.getBoundingClientRect();
        panel.style.top = (rect.bottom + 4) + 'px';
        panel.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
      }
      panel.classList.remove('hidden');
      STATE.panelOpen = true;
      renderNotificationList();
    }
  }

  // Close dropdown on outside click
  var _outsideClickHandler = function(e) {
    if (STATE.panelOpen) {
      var panel = document.getElementById('mfx-notif-panel');
      var bell = document.getElementById('mfx-notif-bell');
      if (panel && !panel.contains(e.target) && bell && !bell.contains(e.target)) {
        panel.classList.add('hidden');
        STATE.panelOpen = false;
        var dot = document.getElementById('mfx-notif-dot');
        if (dot) dot.style.animation = 'none';
      }
    }
  };
  _trackListener(document, 'click', _outsideClickHandler);

  // ============================================================================
  // REASSIGN MODAL
  // ============================================================================
  function showReassignModal(notifId) {
    const notif = STATE.notifications.find(n => n.id === notifId);
    if (!notif) return;

    const modalId = `reassign_modal_${Date.now()}`;
    const modalHTML = `
      <div class="mfx-notif-modal" id="${modalId}">
        <div class="mfx-notif-modal-content">
          <h3 class="mfx-notif-modal-title">Reassign to</h3>
          <div class="mfx-notif-modal-list" id="reassign-user-list"></div>
          <div class="mfx-notif-modal-buttons">
            <button class="mfx-notif-modal-btn cancel" data-action="cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById(modalId);
    const userList = modal.querySelector('#reassign-user-list');

    // Fetch users from Firestore
    if (window.fbDb && typeof window.fbDb.collection === 'function') {
      try {
        window.fbDb.collection('users').get().then(snapshot => {
          snapshot.forEach(doc => {
            const user = doc.data();
            const itemHTML = `
              <div class="mfx-notif-modal-item" data-user-id="${doc.id}">
                ${user.displayName || user.email}
              </div>
            `;
            userList.insertAdjacentHTML('beforeend', itemHTML);
          });

          userList.querySelectorAll('.mfx-notif-modal-item').forEach(item => {
            var _modalItemHandler = () => {
              const userId = item.dataset.userId;
              reassignNotification(notifId, userId);
              modal.remove();
            };
            _trackListener(item, 'click', _modalItemHandler);
          });
        }).catch(err => {
          userList.innerHTML = '<div style="color:#f44">Error loading users</div>';
        });
      } catch (err) {
        userList.innerHTML = '<div style="color:#f44">Error loading users</div>';
      }
    }

    var _cancelHandler = () => {
      modal.remove();
    };
    _trackListener(modal.querySelector('[data-action="cancel"]'), 'click', _cancelHandler);
  }

  function reassignNotification(notifId, userId) {
    const notif = STATE.notifications.find(n => n.id === notifId);
    if (!notif) return;

    notif.read = true;
    STATE.unreadCount = Math.max(0, STATE.unreadCount - 1);

    // Create new notification for target user
    if (window.fbDb && typeof window.fbDb.collection === 'function') {
      try {
        window.fbDb.collection('notifications').add({
          userId: userId,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          icon: notif.icon,
          sourceView: notif.sourceView,
          sourceId: notif.sourceId,
          sourceUrl: notif.sourceUrl,
          from: (typeof getUserEmail === 'function' ? getUserEmail() : ''),
          read: false,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.log('Reassign error:', err.code));
      } catch (err) {
        console.log('Firestore error:', err.code);
      }
    }

    toast('Notification reassigned', 'success');
    updateBadge();
    renderNotificationList();
  }

  // ============================================================================
  // FIRESTORE REAL-TIME LISTENERS
  // ============================================================================
  function initializeFirestoreListeners() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') {
      console.log('⚠️ Firestore not available for notifications');
      return;
    }

    const userId = (typeof getUserId === 'function' ? getUserId() : '');
    if (!userId) return;

    try {
      // Listen to notifications collection
      // NOTE: Do NOT call addNotification() here — it writes back to Firestore
      // and would cause an infinite loop. Instead, update local STATE directly.
      window.fbDb.collection('notifications')
        .where('userId', '==', userId)
        .limit(50)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const notif = change.doc.data();
              const localId = change.doc.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

              // Skip if we already have this notification locally
              if (STATE.notifications.some(n => n.id === localId)) return;

              const notification_obj = {
                id: localId,
                type: notif.type || 'alert',
                title: notif.title,
                body: notif.body,
                icon: notif.icon || '📢',
                sourceView: notif.sourceView,
                sourceId: notif.sourceId,
                sourceUrl: notif.sourceUrl,
                from: notif.from || 'System',
                read: notif.read || false,
                dismissed: false,
                priority: notif.priority || 'normal',
                timestamp: notif.timestamp || Date.now(),
                actions: notif.actions || []
              };

              STATE.notifications.unshift(notification_obj);
              if (!notification_obj.read) STATE.unreadCount++;
              updateBadge();
              renderNotificationList();

              // Show flash
              showFlash(notif);
            }
          });
        }, err => console.log('Notifications listener error:', err.code));
    } catch (err) {
      console.log('Firestore listener setup error:', err.code);
    }
  }

  function listenToQuoteUpdates() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;

    const currentUserId = (typeof getUserId === 'function' ? getUserId() : '');
    const currentUserEmail = (typeof getUserEmail === 'function' ? getUserEmail() : '');
    var currentUserName = typeof getUserName==='function'?getUserName():'';
    if (!currentUserId && !currentUserEmail && !currentUserName) return;

    try {
      let _qInitialLoad = true;
      window.fbDb.collection('quotes').onSnapshot(snapshot => {
        if (_qInitialLoad) { _qInitialLoad = false; return; }
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const quote = change.doc.data();

            // Only notify if this quote is relevant to the current user
            const isRelevant = (
              quote.createdBy === currentUserId ||
              quote.createdBy === currentUserEmail ||
              (currentUserName && quote.createdBy === currentUserName) ||
              quote.assignedTo === currentUserId ||
              quote.assignedTo === currentUserEmail ||
              (currentUserName && quote.assignedTo === currentUserName)
            );
            if (!isRelevant) return;

            if (quote.status) {
              // Dedup: check if a notification for this quote+status already exists
              const dedupKey = `quote_${change.doc.id}_${quote.status}`;
              if (STATE.notifications.some(n => n.sourceId === change.doc.id && n.body && n.body.indexOf(quote.status) !== -1)) return;

              addNotification({
                type: 'alert',
                title: 'Quote Updated',
                body: `Quote #${quote.id} status changed to ${quote.status}`,
                icon: '📋',
                sourceView: 'quotes',
                sourceId: change.doc.id,
                from: 'System',
                priority: 'normal'
              });
              showFlash({
                type: 'alert',
                title: 'Quote Updated',
                body: `Quote #${quote.id} status changed to ${quote.status}`,
                icon: '📋',
                sourceView: 'quotes'
              });
            }
          }
        });
      }, err => console.log('Quotes listener error:', err.code));
    } catch (err) {
      console.log('Quotes listener error:', err.code);
    }
  }

  function listenToTaskAssignments() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;

    const userId = (typeof getUserId === 'function' ? getUserId() : '');
    if (!userId) return;

    try {
      window.fbDb.collection('tasks')
        .where('assignedTo', '==', userId)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const task = change.doc.data();
              addNotification({
                type: 'tasks',
                title: 'New Task Assigned',
                body: task.title || 'You have been assigned a new task',
                icon: '✓',
                sourceView: 'tasks',
                sourceId: change.doc.id,
                from: task.assignedBy || 'System',
                priority: 'high'
              });
              showFlash({
                type: 'tasks',
                title: 'New Task Assigned',
                body: task.title || 'You have been assigned a new task',
                icon: '✓',
                sourceView: 'tasks'
              });
            }
          });
        }, err => console.log('Tasks listener error:', err.code));
    } catch (err) {
      console.log('Tasks listener error:', err.code);
    }
  }

  // ============================================================================
  // JOB TICKET REAL-TIME NOTIFICATIONS
  // ============================================================================
  function listenToJobTickets() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;

    try {
      let _jtInitialLoad = true;
      window.fbDb.collection('jobTickets').onSnapshot(snapshot => {
        // Skip the initial snapshot — it fires 'added' for every existing doc and floods notifications
        if (_jtInitialLoad) { _jtInitialLoad = false; return; }
        snapshot.docChanges().forEach(change => {
          // Only fire on 'added' — 'modified' floods with a notification per field change
          if (change.type !== 'added') return;

          const jt = change.doc.data();
          const ticketNum = jt.ticketNumber || jt.id || change.doc.id;
          const client = jt.clientName || jt.client || 'Unknown';

          // Flash for urgent or rush new tickets
          if (jt.priority === 'Urgent' || jt.rush === true) {
            addNotification({
              type: 'jobs',
              title: `Job #${ticketNum} Added`,
              body: `${client} — Status: ${jt.status || jt.workflowStatus} | Assigned: ${jt.assignedTo || 'Unassigned'}`,
              icon: '🎫',
              sourceView: 'jobtracker',
              sourceId: change.doc.id,
              from: jt.assignedTo || 'System',
              priority: 'high'
            });
            showFlash({
              type: 'jobs',
              title: (jt.rush ? '🔥 RUSH ' : '⚡ URGENT ') + `Job #${ticketNum}`,
              body: `${client} — ${jt.jobDescription || ''}`.substring(0, 80),
              icon: jt.rush ? '🔥' : '⚡',
              sourceView: 'jobtracker'
            });
          }

          // Overdue check with dedup
          const due = jt.jobDueDate || jt.dueDate;
          if (due && jt.status !== 'CLOSED' && jt.status !== 'ACCOUNTING') {
            const dueTime = new Date(due).getTime();
            if (dueTime < Date.now()) {
              const daysOverdue = Math.floor((Date.now() - dueTime) / (24*60*60*1000));
              if (daysOverdue > 0 && daysOverdue < 90) {
                const alreadyNotified = STATE.notifications.some(n => n.sourceId === change.doc.id && n.title && n.title.indexOf('OVERDUE') !== -1);
                if (!alreadyNotified) {
                  addNotification({
                    type: 'alert',
                    title: `⚠️ OVERDUE: Job #${ticketNum}`,
                    body: `${client} — ${daysOverdue} day${daysOverdue>1?'s':''} overdue — ${jt.assignedTo || 'Unassigned'}`,
                    icon: '⚠️',
                    sourceView: 'jobtracker',
                    sourceId: change.doc.id,
                    from: 'System',
                    priority: 'high'
                  });
                }
              }
            }
          }

          // Blocked job alert with dedup
          if (jt.blocked === true || jt.blocked === 'Yes') {
            const alreadyBlocked = STATE.notifications.some(n => n.sourceId === change.doc.id && n.title && n.title.indexOf('BLOCKED') !== -1);
            if (!alreadyBlocked) {
              addNotification({
                type: 'alert',
                title: `🚫 BLOCKED: Job #${ticketNum}`,
                body: `${client} — ${jt.blockerNotes || jt.blockerCategory || 'Blocked'}`,
                icon: '🚫',
                sourceView: 'jobtracker',
                sourceId: change.doc.id,
                from: 'System',
                priority: 'high'
              });
            }
          }
        });
      }, err => console.log('JobTickets notification listener error:', err.code));
    } catch (err) {
      console.log('JobTickets listener error:', err.code);
    }
  }

  // ============================================================================
  // GOOGLE WORKSPACE INTEGRATIONS
  // ============================================================================
  function initializeGoogleIntegrations() {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if(cached && Date.now() < exp) window.GTOKEN = cached;
      else {
        console.log('ℹ️ Google token not available, skipping Google integrations');
        return;
      }
    }

    // Google integrations available on-demand only — no auto-polling
    // Users click to fetch Gmail, Calendar, Tasks manually
    console.log('Google integrations ready (on-demand, no auto-poll)');
  }

  // Expose manual fetch functions globally
  window.mfxFetchGmail = function() { pollGmailInbox(); };
  window.mfxFetchCalendar = function() { pollCalendarEvents(); };
  window.mfxFetchTasks = function() { pollTasksLists(); };

  function pollGmailInbox() {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if(cached && Date.now() < exp) window.GTOKEN = cached;
      else return;
    }

    const now = Date.now();
    if (now - STATE.lastGmailCheck < 10000) return; // Debounce
    STATE.lastGmailCheck = now;

    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=in:inbox+is:unread';

    fetch(url, {
      headers: { Authorization: 'Bearer ' + window.GTOKEN }
    })
      .then(r => r.json())
      .then(data => {
        if (data.messages && Array.isArray(data.messages)) {
          data.messages.forEach(msg => {
            fetchGmailMessage(msg.id);
          });
        }
      })
      .catch(err => console.log('Gmail poll error:', err.message));
  }

  function fetchGmailMessage(messageId) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;

    fetch(url, {
      headers: { Authorization: 'Bearer ' + window.GTOKEN }
    })
      .then(r => r.json())
      .then(data => {
        const headers = data.payload.headers || [];
        var rawFrom = headers.find(h => h.name === 'From')?.value || 'Unknown';
        var rawSubject = headers.find(h => h.name === 'Subject')?.value || 'New Email';
        var esc = function(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; };
        const from = esc(rawFrom);
        const subject = esc(rawSubject);

        // Cache for Notification Center
        if (!window._mfxGmailCache) window._mfxGmailCache = [];
        if (!window._mfxGmailCache.some(function(e){ return e.id === messageId; })) {
          window._mfxGmailCache.push({id:messageId, from:from, subject:subject, date:data.internalDate?new Date(parseInt(data.internalDate)).toISOString():new Date().toISOString()});
          if (window._mfxGmailCache.length > 20) window._mfxGmailCache.shift();
        }

        addNotification({
          type: 'email',
          title: subject,
          body: from,
          icon: '✉️',
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${messageId}`,
          from: from,
          priority: 'normal'
        });

        showFlash({
          type: 'email',
          title: subject,
          body: from,
          icon: '✉️',
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${messageId}`
        });
      })
      .catch(err => console.log('Fetch Gmail message error:', err.message));
  }

  function pollCalendarEvents() {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if(cached && Date.now() < exp) window.GTOKEN = cached;
      else return;
    }

    const now = Date.now();
    if (now - STATE.lastCalendarCheck < 10000) return;
    STATE.lastCalendarCheck = now;

    // Fetch today's full calendar + next 2 hours for urgent alerts
    var todayStart = new Date(); todayStart.setHours(0,0,0,0);
    var todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const timeMin = todayStart.toISOString();
    const timeMax = todayEnd.toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=20`;

    fetch(url, {
      headers: { Authorization: 'Bearer ' + window.GTOKEN }
    })
      .then(r => r.json())
      .then(data => {
        if (data.items && Array.isArray(data.items)) {
          // Cache all today's events for Notification Center
          window._mfxCalCache = data.items.map(function(ev) { return {id:ev.id, summary:ev.summary, start:ev.start, end:ev.end, htmlLink:ev.htmlLink}; });

          data.items.forEach(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            const minutesUntil = Math.round((startTime - Date.now()) / 60000);

            if (minutesUntil > 0 && minutesUntil <= 15) {
              addNotification({
                type: 'reminders',
                title: `Meeting in ${minutesUntil} min`,
                body: event.summary || 'Calendar event',
                icon: '📅',
                sourceUrl: event.htmlLink,
                from: 'Calendar',
                priority: minutesUntil <= 5 ? 'high' : 'normal'
              });

              showFlash({
                type: 'reminders',
                title: `Meeting in ${minutesUntil} min`,
                body: event.summary || 'Calendar event',
                icon: '📅',
                sourceUrl: event.htmlLink
              });
            }
          });
        }
      })
      .catch(err => console.log('Calendar poll error:', err.message));
  }

  function pollTasksLists() {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if(cached && Date.now() < exp) window.GTOKEN = cached;
      else return;
    }

    const now = Date.now();
    if (now - STATE.lastTasksCheck < 10000) return;
    STATE.lastTasksCheck = now;

    const url = 'https://tasks.googleapis.com/tasks/v1/users/@me/lists';

    fetch(url, {
      headers: { Authorization: 'Bearer ' + window.GTOKEN }
    })
      .then(r => r.json())
      .then(data => {
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(list => {
            fetchTasksFromList(list.id);
          });
        }
      })
      .catch(err => console.log('Tasks lists error:', err.message));
  }

  function fetchTasksFromList(listId) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const url = `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?dueMin=${today}&dueMax=${tomorrow}&showCompleted=false&maxResults=5`;

    fetch(url, {
      headers: { Authorization: 'Bearer ' + window.GTOKEN }
    })
      .then(r => r.json())
      .then(data => {
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(task => {
            if (task.due) {
              addNotification({
                type: 'reminders',
                title: 'Task due today',
                body: task.title || 'Google Task',
                icon: '✓',
                sourceUrl: task.selfLink,
                from: 'Google Tasks',
                priority: 'normal'
              });
            }
          });
        }
      })
      .catch(err => console.log('Fetch tasks error:', err.message));
  }

  // ============================================================================
  // FIRESTORE CHAT SYSTEM
  // ============================================================================
  function listenToMentions() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;

    const userId = (typeof getUserId === 'function' ? getUserId() : '');
    if (!userId) return;

    try {
      window.fbDb.collectionGroup('notes')
        .where('mentions', 'array-contains', userId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const note = change.doc.data();
              addNotification({
                type: 'mentions',
                title: '@Mentioned in collaboration',
                body: note.text || 'You were mentioned',
                icon: '@️',
                from: note.author || 'Team',
                priority: 'high'
              });

              showFlash({
                type: 'mentions',
                title: '@Mentioned',
                body: note.text || 'You were mentioned',
                icon: '@️'
              });
            }
          });
        }, err => console.log('Mentions listener error:', err.code));
    } catch (err) {
      console.log('Mentions listener error:', err.code);
    }
  }

  // ============================================================================
  // MFX EVENT BUS — quote.status listener
  // ============================================================================
  function listenToQuoteStatusEvents() {
    if (typeof MFX === 'undefined' || typeof MFX.on !== 'function') return;

    MFX.on('quote.status', function(d) {
      if (!d) return;
      var status = d.status || '';
      var quoteNum = (d.quote && d.quote.quoteNum) || d.quoteId || '';
      var creator = (d.quote && d.quote.createdBy) || '';

      if (status === 'approval') {
        addNotification({
          type: 'alert',
          title: 'Quote Awaiting Approval',
          body: 'Quote #' + quoteNum + ((d.quote && d.quote.fields && d.quote.fields.custCo) ? ' (' + d.quote.fields.custCo + ')' : '') + ' submitted for CEO approval',
          icon: '🟡',
          sourceView: 'quotes',
          sourceId: d.quoteId || '',
          from: creator || 'System',
          priority: 'high'
        });
      } else if (status === 'rejected') {
        addNotification({
          type: 'alert',
          title: 'Quote Rejected',
          body: 'Quote #' + quoteNum + ' was rejected',
          icon: '🔴',
          sourceView: 'quotes',
          sourceId: d.quoteId || '',
          from: 'Management',
          priority: 'high'
        });
      } else if (status === 'won') {
        addNotification({
          type: 'alert',
          title: 'Quote Won!',
          body: 'Quote #' + quoteNum + ' has been won — great job team!',
          icon: '🏆',
          sourceView: 'quotes',
          sourceId: d.quoteId || '',
          from: 'System',
          priority: 'high'
        });
      } else if (status === 'sent') {
        addNotification({
          type: 'alert',
          title: 'Quote Sent',
          body: 'Quote #' + quoteNum + ' has been sent to the customer',
          icon: '📤',
          sourceView: 'quotes',
          sourceId: d.quoteId || '',
          from: 'System',
          priority: 'normal'
        });
      }
    });
  }

  // ============================================================================
  // PORTAL ACTIVITY LISTENERS — Real-time notifications for client uploads/messages
  // ============================================================================
  var _portalSeenActivity = {};  // dedup by activity doc ID
  var _portalSeenMessages = {};  // dedup by message doc ID
  var _portalQuoteSnapshots = {}; // track previous poFiles/artFiles counts per quote

  function listenToPortalActivity() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;

    // 1. Listen to activity collection for po.approved events from portal clients
    var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    var _firstActivityLoad = true;
    window.fbDb.collection('activity')
      .where('type', '==', 'po.approved')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot(function(snap) {
        // Skip the initial load to avoid flooding with old notifications
        if (_firstActivityLoad) {
          _firstActivityLoad = false;
          snap.docs.forEach(function(d) { _portalSeenActivity[d.id] = true; });
          return;
        }
        snap.docChanges().forEach(function(change) {
          if (change.type !== 'added') return;
          var d = change.doc;
          if (_portalSeenActivity[d.id]) return;
          _portalSeenActivity[d.id] = true;
          var a = d.data();
          addNotification({
            type: 'alert',
            title: 'PO Submitted — ' + (a.quoteNum || 'Quote'),
            body: (a.company || 'Client') + ' submitted PO #' + (a.poNumber || '—') +
              ' signed by ' + (a.signedBy || '—') +
              (a.filesCount ? ' with ' + a.filesCount + ' file' + (a.filesCount > 1 ? 's' : '') : ''),
            icon: '📦',
            sourceView: 'quotes',
            sourceId: a.quoteId || '',
            from: a.clientEmail || a.company || 'Portal Client',
            priority: 'high'
          });
          // Play a sound + show a prominent toast
          if (typeof playSound === 'function') playSound('success');
          if (typeof toast === 'function') {
            toast('📦 PO received for ' + (a.quoteNum || 'quote') + ' from ' + (a.company || 'client'), 'ok');
          }
          // Auto-generate Sales Order if one doesn't exist yet
          _autoCreateSO(a.quoteId);
        });
      }, function(err) { console.warn('Portal activity listener:', err.message); });

    // 2. Listen to quotes collection for portal file uploads (poFiles / artFiles changes)
    _watchPortalFileUploads();

    // 3. Listen to portalMessages across active quotes
    _watchPortalMessages();
  }

  function _autoCreateSO(quoteId) {
    if (!quoteId) return;
    // Wait for quote data to sync from Firestore snapshot, then check & create
    setTimeout(function() {
      // Check if SO already exists for this quote
      if (typeof getSalesOrders === 'function') {
        var existing = getSalesOrders().find(function(s) { return s.quoteId === quoteId; });
        if (existing) {
          console.log('SO already exists for ' + quoteId + ': ' + existing.soNum);
          return;
        }
      }
      if (typeof createSOFromPO === 'function') {
        console.log('Auto-generating Sales Order for quote ' + quoteId);
        try {
          createSOFromPO(quoteId);
        } catch(e) {
          console.warn('Auto SO creation failed:', e);
        }
      }
    }, 4000); // 4s delay to ensure quote data is synced from Firestore
  }

  function _watchPortalFileUploads() {
    // We piggyback on the existing quotes snapshot in _cache.quotes
    // Check every time quotes update for new portal file activity
    var _prevFileState = {};

    // Capture initial state so we don't notify on first load
    var _initialized = false;
    var _checkInterval = setInterval(function() {
      if (!window._cache && !(typeof DB !== 'undefined' && DB.quotes)) return;
      var quotes = (typeof DB !== 'undefined' && DB.quotes) ? DB.quotes() : [];
      if (!quotes.length) return;

      if (!_initialized) {
        // Snapshot initial file counts
        quotes.forEach(function(q) {
          _prevFileState[q.id] = {
            poCount: (q.poFiles || []).length,
            artCount: (q.artFiles || []).length,
            hasSignature: !!q.poSignature
          };
        });
        _initialized = true;
        return;
      }

      quotes.forEach(function(q) {
        var prev = _prevFileState[q.id] || { poCount: 0, artCount: 0, hasSignature: false };
        var curPo = (q.poFiles || []).length;
        var curArt = (q.artFiles || []).length;

        // Detect new PO files
        if (curPo > prev.poCount) {
          var newCount = curPo - prev.poCount;
          addNotification({
            type: 'alert',
            title: 'PO Files Uploaded — ' + (q.quoteNum || 'Quote'),
            body: (q.fields && q.fields.custCo ? q.fields.custCo : 'Client') +
              ' uploaded ' + newCount + ' PO file' + (newCount > 1 ? 's' : ''),
            icon: '📎',
            sourceView: 'quotes',
            sourceId: q.id,
            from: q.poClientEmail || 'Portal Client',
            priority: 'high'
          });
          if (typeof toast === 'function') {
            toast('📎 ' + newCount + ' PO file' + (newCount > 1 ? 's' : '') + ' uploaded for ' + (q.quoteNum || 'quote'), 'ok');
          }
        }

        // Detect new art files
        if (curArt > prev.artCount) {
          var newArt = curArt - prev.artCount;
          addNotification({
            type: 'alert',
            title: 'Art Files Uploaded — ' + (q.quoteNum || 'Quote'),
            body: (q.fields && q.fields.custCo ? q.fields.custCo : 'Client') +
              ' uploaded ' + newArt + ' art file' + (newArt > 1 ? 's' : ''),
            icon: '🎨',
            sourceView: 'quotes',
            sourceId: q.id,
            from: q.poClientEmail || 'Portal Client',
            priority: 'high'
          });
          if (typeof toast === 'function') {
            toast('🎨 ' + newArt + ' art file' + (newArt > 1 ? 's' : '') + ' uploaded for ' + (q.quoteNum || 'quote'), 'ok');
          }
        }

        // Update tracked state
        _prevFileState[q.id] = { poCount: curPo, artCount: curArt, hasSignature: !!q.poSignature };
      });
    }, 3000); // Check every 3 seconds (quotes snapshot updates in real-time)
  }

  function _watchPortalMessages() {
    if (!window.fbDb) return;
    // Listen to all sent/won quotes for portal messages
    var _watchedQuotes = {};
    var _firstMsgLoad = {};

    function watchQuoteMessages(quoteId, quoteNum, company) {
      if (_watchedQuotes[quoteId]) return;
      _watchedQuotes[quoteId] = true;
      _firstMsgLoad[quoteId] = true;

      window.fbDb.collection('quotes').doc(quoteId).collection('portalMessages')
        .orderBy('timestamp', 'desc').limit(5)
        .onSnapshot(function(snap) {
          if (_firstMsgLoad[quoteId]) {
            _firstMsgLoad[quoteId] = false;
            snap.docs.forEach(function(d) { _portalSeenMessages[d.id] = true; });
            return;
          }
          snap.docChanges().forEach(function(change) {
            if (change.type !== 'added') return;
            var d = change.doc;
            if (_portalSeenMessages[d.id]) return;
            _portalSeenMessages[d.id] = true;
            var m = d.data();
            // Only notify on client messages, not MFX staff replies
            if (m.from !== 'client') return;
            addNotification({
              type: 'alert',
              title: 'Portal Message — ' + (quoteNum || 'Quote'),
              body: (m.name || 'Client') + ': ' + (m.text || '').substring(0, 80),
              icon: '💬',
              sourceView: 'quotes',
              sourceId: quoteId,
              from: m.name || 'Portal Client',
              priority: 'normal'
            });
            if (typeof toast === 'function') {
              toast('💬 Message from ' + (m.name || 'client') + ' on ' + (quoteNum || 'quote'), 'ok');
            }
          });
        }, function(err) { /* portalMessages sub-listener */ });
    }

    // Start watching sent/won quotes, and re-check when quotes update
    function scanQuotes() {
      var quotes = (typeof DB !== 'undefined' && DB.quotes) ? DB.quotes() : [];
      quotes.forEach(function(q) {
        if (q.status === 'sent' || q.status === 'won') {
          watchQuoteMessages(q.id, q.quoteNum, q.fields && q.fields.custCo);
        }
      });
    }

    // Scan immediately and then periodically as quotes load
    setTimeout(scanQuotes, 2000);
    setInterval(scanQuotes, 15000);
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  function timeAgo(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    var secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return Math.floor(secs/60) + 'm ago';
    if (secs < 86400) return Math.floor(secs/3600) + 'h ago';
    return Math.floor(secs/86400) + 'd ago';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ============================================================================
  // CHAT MESSAGE & @MENTION LISTENER
  // ============================================================================
  function listenToChatMentions() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;
    var userId = (typeof getUserId === 'function' ? getUserId() : '');
    var userName = (typeof getUserName === 'function' ? getUserName() : '');
    if (!userId && !userName) return;

    try {
      var _chatInitial = true;
      window.fbDb.collectionGroup('chat_messages')
        .orderBy('timestamp', 'desc')
        .limit(30)
        .onSnapshot(function(snapshot) {
          if (_chatInitial) { _chatInitial = false; return; }
          snapshot.docChanges().forEach(function(change) {
            if (change.type !== 'added') return;
            var msg = change.doc.data();
            if (msg.userId === userId) return; // skip own messages

            // Check if user is mentioned
            var mentions = msg.mentions || [];
            var isMentioned = mentions.indexOf(userId) !== -1 || mentions.indexOf(userName) !== -1;
            // Also check raw text for @username
            var text = msg.text || '';
            if (!isMentioned && userName && text.toLowerCase().indexOf('@' + userName.toLowerCase()) !== -1) {
              isMentioned = true;
            }

            if (isMentioned) {
              addNotification({
                type: 'mentions',
                title: '@ Mentioned in Chat',
                body: (msg.user || 'Someone') + ': ' + text.substring(0, 100),
                icon: '@',
                from: msg.user || 'Team',
                sourceView: 'chat',
                priority: 'high'
              });
              showFlash({
                type: 'mentions',
                title: '@ ' + (msg.user || 'Someone') + ' mentioned you',
                body: text.substring(0, 80),
                icon: '@'
              });
            }
          });
        }, function(err) { console.log('Chat mentions listener:', err.code); });
    } catch (err) {
      console.log('Chat mentions listener error:', err.message);
    }
  }

  // ============================================================================
  // TASK UPDATE LISTENER (owned tasks — not just new assignments)
  // ============================================================================
  function listenToOwnedTaskUpdates() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;
    var userId = (typeof getUserId === 'function' ? getUserId() : '');
    var userName = (typeof getUserName === 'function' ? getUserName() : '');
    if (!userId && !userName) return;

    try {
      var _taskInitial = true;
      // Listen for tasks assigned to user (modified)
      window.fbDb.collection('tasks')
        .where('assignedTo', '==', userId)
        .onSnapshot(function(snapshot) {
          if (_taskInitial) { _taskInitial = false; return; }
          snapshot.docChanges().forEach(function(change) {
            if (change.type !== 'modified') return;
            var task = change.doc.data();
            var updatedBy = task.updatedBy || task.lastModifiedBy || '';
            if (updatedBy === userId) return; // skip own edits

            addNotification({
              type: 'tasks',
              title: 'Task Updated',
              body: (task.title || 'Your task') + ' — Status: ' + (task.status || 'updated'),
              icon: '✓',
              sourceView: 'dashboard',
              sourceId: change.doc.id,
              from: updatedBy || 'System',
              priority: 'normal'
            });
            showFlash({
              type: 'tasks',
              title: 'Task Updated',
              body: (task.title || 'Your task') + (task.status ? ' → ' + task.status : ''),
              icon: '✓'
            });
          });
        }, function(err) { console.log('Owned tasks listener:', err.code); });
    } catch (err) {
      console.log('Owned tasks listener error:', err.message);
    }
  }

  // ============================================================================
  // JOB TICKET UPDATE LISTENER (owned/assigned jobs — modified)
  // ============================================================================
  function listenToOwnedJobUpdates() {
    if (!window.fbDb || typeof window.fbDb.collection !== 'function') return;
    var userId = (typeof getUserId === 'function' ? getUserId() : '');
    var userName = (typeof getUserName === 'function' ? getUserName() : '');
    if (!userId && !userName) return;

    try {
      var _jobInitial = true;
      window.fbDb.collection('jobTickets')
        .where('assignedTo', '==', userId)
        .onSnapshot(function(snapshot) {
          if (_jobInitial) { _jobInitial = false; return; }
          snapshot.docChanges().forEach(function(change) {
            if (change.type !== 'modified') return;
            var jt = change.doc.data();
            var updatedBy = jt.updatedBy || jt.lastModifiedBy || '';
            if (updatedBy === userId) return;

            var ticketNum = jt.ticketNumber || jt.jobNum || change.doc.id;
            var client = jt.clientName || jt.customerName || '';
            addNotification({
              type: 'jobs',
              title: 'Job #' + ticketNum + ' Updated',
              body: (client ? client + ' — ' : '') + 'Status: ' + (jt.status || jt.workflowStatus || 'updated'),
              icon: '📋',
              sourceView: 'jobtracker',
              sourceId: change.doc.id,
              from: updatedBy || 'System',
              priority: 'normal'
            });
            showFlash({
              type: 'jobs',
              title: 'Job #' + ticketNum + ' Updated',
              body: (client ? client + ' — ' : '') + (jt.status || ''),
              icon: '📋'
            });
          });
        }, function(err) { console.log('Owned jobs listener:', err.code); });
    } catch (err) {
      console.log('Owned jobs listener error:', err.message);
    }
  }

  // ============================================================================
  // GMAIL UNREAD POLLING (periodic, not on-demand only)
  // ============================================================================
  function startGmailPolling() {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if (cached && Date.now() < exp) window.GTOKEN = cached;
      else return;
    }
    // Poll every 2 minutes for new emails
    function pollLoop() {
      pollGmailInbox();
      setTimeout(pollLoop, 120000);
    }
    setTimeout(pollLoop, 10000); // first poll after 10s
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  window.initNotifications = function() {
    console.log('📢 Initializing MFX Notifications...');
    window.NOTIF_STATE = STATE;

    injectStyles();
    initializeDOM();
    initializeFirestoreListeners();
    listenToQuoteUpdates();
    listenToTaskAssignments();
    listenToJobTickets();
    listenToMentions();
    listenToChatMentions();
    listenToOwnedTaskUpdates();
    listenToOwnedJobUpdates();
    listenToQuoteStatusEvents();
    listenToPortalActivity();
    initializeGoogleIntegrations();
    startGmailPolling();

    console.log('✅ MFX Notifications v2 initialized');
  };

  // ============================================================================
  // NOTIFICATION CENTER — Full-page view
  // ============================================================================
  function renderNotificationCenter() {
    var el = document.getElementById('v-notifications');
    if (!el) return;

    var me = typeof getUserName === 'function' ? getUserName() : '';
    var cutoff = Date.now() - (24 * 60 * 60 * 1000);
    var tab = window._notifCenterTab || 'all';

    // Aggregate from all sources (same logic as renderNotificationList)
    var allItems = STATE.notifications.slice();

    // Quotes
    try {
      var qs = typeof DB !== 'undefined' && DB.quotes ? DB.quotes() : [];
      qs.forEach(function(q) {
        if (!q.updatedAt) return;
        var t = new Date(q.updatedAt).getTime();
        if (isNaN(t) || t < cutoff) return;
        var isMine = q.createdBy === me;
        if (q.status === 'approval' && isMine)
          allItems.push({id:'q_appr_'+q.id, type:'alerts', icon:'clock', color:'#c4b5fd', title:q.quoteNum+' awaiting CEO approval', body:(q.fields.custCo||''), timestamp:q.updatedAt, nav:'editor', navId:q.id});
        if (q.status === 'rejected' && isMine)
          allItems.push({id:'q_rej_'+q.id, type:'alerts', icon:'x', color:'#ef4444', title:q.quoteNum+' rejected', body:(q.rejectionReason||''), timestamp:q.updatedAt, nav:'editor', navId:q.id});
        if (q.status === 'won' && isMine)
          allItems.push({id:'q_won_'+q.id, type:'alerts', icon:'check', color:'#16a34a', title:q.quoteNum+' WON', body:(q.fields.custCo||'')+(q.wonAmount?' — $'+q.wonAmount:''), timestamp:q.closedAt||q.updatedAt, nav:'editor', navId:q.id});
        if (q.status === 'ready' && isMine)
          allItems.push({id:'q_rdy_'+q.id, type:'alerts', icon:'check', color:'#00e5ff', title:q.quoteNum+' ready to send', body:(q.fields.custCo||''), timestamp:q.updatedAt, nav:'editor', navId:q.id});
        if (q.status === 'sent' && isMine) {
          var sentDays = q.sentAt ? Math.floor((Date.now() - new Date(q.sentAt).getTime()) / 86400000) : 0;
          if (sentDays >= 3)
            allItems.push({id:'q_fu_'+q.id, type:'alerts', icon:'clock', color:'#f97316', title:q.quoteNum+' needs follow-up', body:(q.fields.custCo||'')+' — sent '+sentDays+'d ago', timestamp:q.sentAt, nav:'editor', navId:q.id});
        }
        // @Mentions
        (q.internalNotes||[]).forEach(function(n) {
          if (!n.text || !n.at) return;
          var mt = new Date(n.at).getTime();
          if (isNaN(mt) || mt < cutoff) return;
          if (n.text.indexOf('@'+me) >= 0 || n.text.indexOf('@'+me.replace(/\\s/g,'')) >= 0)
            allItems.push({id:'m_'+q.id+'_'+n.id, type:'mentions', icon:'at', color:'#00e5ff', title:(n.by||'Someone')+' mentioned you', body:q.quoteNum+': '+n.text.substring(0,60), timestamp:n.at, nav:'editor', navId:q.id});
        });
      });
    } catch(e) {}

    // Tasks
    try {
      var tasks = window._rtTasks || JSON.parse(localStorage.getItem('mfx_tasks')||'[]');
      tasks.forEach(function(t) {
        if (t.done || t.completed) return;
        if (t.assignedTo && t.assignedTo !== me) return;
        allItems.push({id:'task_'+t.id, type:'tasks', icon:'check-square', color:'#f97316', title:t.title||t.text||'Task', body:t.dueDate?'Due: '+t.dueDate:'', timestamp:t.createdAt||t.dueDate||Date.now(), nav:'dashboard'});
      });
    } catch(e) {}

    // Jobs assigned to user
    try {
      var jts = window._jtCache || [];
      jts.forEach(function(jt) {
        if (!jt.updatedAt) return;
        var t = new Date(jt.updatedAt).getTime();
        if (isNaN(t) || t < cutoff) return;
        var assignee = jt.ppd && jt.ppd.assignedTo ? jt.ppd.assignedTo : '';
        if (assignee && assignee.toLowerCase().indexOf(me.toLowerCase()) >= 0)
          allItems.push({id:'jt_'+jt.id, type:'jobs', icon:'file', color:'#8b5cf6', title:(jt.jtNum||jt.id), body:(jt.company||'')+' — '+(jt.ppd&&jt.ppd.stage||jt.status||''), timestamp:jt.updatedAt, nav:'ppd'});
      });
    } catch(e) {}

    // System alerts
    try {
      (window._currentAlerts||[]).forEach(function(a, i) {
        allItems.push({id:'alert_'+i, type:'alerts', icon:'alert', color:'#ef4444', title:a.text||'Alert', body:'', timestamp:Date.now()});
      });
    } catch(e) {}

    // Emails (from Gmail polling cache)
    try {
      (window._mfxGmailCache||[]).forEach(function(email) {
        allItems.push({id:'email_'+email.id, type:'emails', icon:'mail', color:'#22d3ee', title:escapeHtml(email.from||email.sender||''), body:escapeHtml(email.subject||''), timestamp:email.date||email.receivedAt||Date.now()});
      });
    } catch(e) {}

    // Calendar events today
    try {
      (window._mfxCalCache||[]).forEach(function(ev) {
        allItems.push({id:'cal_'+ev.id, type:'calendar', icon:'calendar', color:'#daa520', title:escapeHtml(ev.summary||ev.title||'Event'), body:ev.start&&ev.start.dateTime?new Date(ev.start.dateTime).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'All day', timestamp:ev.start&&ev.start.dateTime?ev.start.dateTime:Date.now()});
      });
    } catch(e) {}

    // Deduplicate
    var seen = {};
    allItems = allItems.filter(function(n) { if (!n.id || seen[n.id]) return false; seen[n.id] = true; return true; });

    // Filter 24h
    allItems = allItems.filter(function(n) {
      var ts = n.timestamp;
      if (!ts) return true;
      var t = typeof ts === 'number' ? ts : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime());
      return !isNaN(t) && t > cutoff;
    });

    // Sort newest first
    allItems.sort(function(a, b) {
      var ta = a.timestamp ? (typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime()) : 0;
      var tb = b.timestamp ? (typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime()) : 0;
      return tb - ta;
    });

    // Tab counts
    var counts = {all: allItems.length, alerts: 0, mentions: 0, tasks: 0, jobs: 0, emails: 0, calendar: 0};
    allItems.forEach(function(n) { if (counts[n.type] !== undefined) counts[n.type]++; });

    // Filter by tab
    var filtered = tab === 'all' ? allItems : allItems.filter(function(n) { return n.type === tab; });

    // SVG icon map
    var icons = {
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
    };
    function svi(name, color) {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+(color||'currentColor')+'" stroke-width="2">'+(icons[name]||icons.alert)+'</svg>';
    }

    // Render
    var h = '<div style="padding:16px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    h += '<div style="font-size:18px;font-weight:700;color:var(--tx)">Notification Center</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="if(typeof mfxFetchGmail===\'function\')mfxFetchGmail();if(typeof mfxFetchCalendar===\'function\')mfxFetchCalendar();setTimeout(renderNotifCenter,2000)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Sync Email & Calendar</button>';
    h += '</div>';

    // Filter tabs
    var tabs = [
      {key:'all', label:'All', count:counts.all},
      {key:'alerts', label:'Alerts', count:counts.alerts},
      {key:'mentions', label:'Mentions', count:counts.mentions},
      {key:'tasks', label:'Tasks', count:counts.tasks},
      {key:'jobs', label:'Jobs', count:counts.jobs},
      {key:'emails', label:'Emails', count:counts.emails},
      {key:'calendar', label:'Calendar', count:counts.calendar}
    ];
    h += '<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr);overflow-x:auto">';
    tabs.forEach(function(t) {
      var active = tab === t.key;
      h += '<div onclick="window._notifCenterTab=\'' + t.key + '\';renderNotifCenter()" style="padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(active?'var(--ac)':'transparent')+';color:'+(active?'var(--ac)':'var(--tx3)')+';margin-bottom:-2px">';
      h += t.label + ' <span style="background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:9px;margin-left:2px">' + t.count + '</span></div>';
    });
    h += '</div>';

    // Mark all read button
    if (filtered.length > 0) {
      h += '<div style="text-align:right;margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="window._clearAllNotifs()">Clear all</button></div>';
    }

    // Items
    if (filtered.length === 0) {
      h += '<div style="text-align:center;padding:40px 0;color:var(--tx3)">';
      h += '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="1.5" style="display:block;margin:0 auto 10px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
      h += '<div style="font-size:12px">No notifications</div></div>';
    } else {
      filtered.forEach(function(n) {
        var navAttr = '';
        if (n.nav === 'editor' && n.navId) navAttr = 'onclick="openEditor(\'' + n.navId + '\')"';
        else if (n.nav) navAttr = 'onclick="goView(\'' + n.nav + '\')"';
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;border-bottom:1px solid var(--bdr);transition:background .15s" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'" ' + navAttr + '>';
        h += '<div style="flex-shrink:0;margin-top:2px">' + svi(n.icon, n.color) + '</div>';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:12px;font-weight:600;color:var(--tx)">' + escapeHtml(n.title) + '</div>';
        if (n.body) h += '<div style="font-size:11px;color:var(--tx3);margin-top:2px">' + escapeHtml(n.body) + '</div>';
        h += '<div style="font-size:9px;color:var(--tx3);margin-top:3px;opacity:.7">' + timeAgo(n.timestamp) + '</div>';
        h += '</div>';
        h += '<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();this.closest(\'div[style]\').remove()" style="flex-shrink:0;font-size:14px;opacity:.5">✕</button>';
        h += '</div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  }

  window.renderNotifCenter = renderNotificationCenter;
  window._clearAllNotifs = function() {
    STATE.notifications = [];
    STATE.unreadCount = 0;
    window._currentAlerts = [];
    updateBadge();
    renderNotificationCenter();
  };

  // Register as view renderer
  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_RENDERERS.notifications = renderNotificationCenter;

  // ============================================================================
  // GOOGLE CALENDAR WRITE-BACK
  // Create calendar events when tasks/jobs have due dates
  // ============================================================================
  function createCalendarEvent(opts) {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if(cached && Date.now() < exp) window.GTOKEN = cached;
      else { console.warn('No Google token — cannot create calendar event'); return Promise.resolve(null); }
    }
    var title = opts.title || 'MFX Task';
    var description = opts.description || '';
    var startDate = opts.start ? new Date(opts.start) : new Date();
    var endDate = opts.end ? new Date(opts.end) : new Date(startDate.getTime() + 3600000);
    var body = {
      summary: title,
      description: description + '\n\n— Created by MFX OS',
      start: opts.allDay ? { date: startDate.toISOString().split('T')[0] } : { dateTime: startDate.toISOString() },
      end: opts.allDay ? { date: endDate.toISOString().split('T')[0] } : { dateTime: endDate.toISOString() },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }, { method: 'popup', minutes: 10 }] },
      colorId: opts.colorId || undefined
    };
    return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + window.GTOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.ok ? r.json() : null; })
      .then(function(ev) {
        if (ev) { console.log('✅ Calendar event created:', ev.summary); toast && toast('Added to Google Calendar', 'ok'); }
        return ev;
      }).catch(function(e) { console.warn('Calendar write failed:', e); return null; });
  }

  function createGoogleTask(opts) {
    if (!window.GTOKEN) {
      var cached = sessionStorage.getItem('mfx_gtoken');
      var exp = parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
      if(cached && Date.now() < exp) window.GTOKEN = cached;
      else return Promise.resolve(null);
    }
    var title = opts.title || 'MFX Task';
    var notes = opts.notes || '';
    var due = opts.due ? new Date(opts.due).toISOString() : undefined;
    var body = { title: title, notes: notes + '\n\n— Created by MFX OS' };
    if (due) body.due = due;
    return fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + window.GTOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.ok ? r.json() : null; })
      .then(function(t) {
        if (t) { console.log('✅ Google Task created:', t.title); }
        return t;
      }).catch(function(e) { console.warn('Task write failed:', e); return null; });
  }

  // Auto-sync: Watch Firestore for new tasks/jobs with due dates and create calendar events
  function initCalendarSync() {
    if (!fbDb || !fbAuth || !fbAuth.currentUser) return;
    var uid = fbAuth.currentUser.uid;
    var userName = fbAuth.currentUser.displayName || fbAuth.currentUser.email.split('@')[0];

    // Watch tasks assigned to current user
    fbDb.collection('tasks').where('assignedTo', '==', userName).onSnapshot(function(snap) {
      snap.docChanges().forEach(function(change) {
        if (change.type === 'added') {
          var t = change.doc.data();
          if (t.dueDate && !t._calSynced) {
            createCalendarEvent({
              title: '📋 Task: ' + (t.title || t.name || 'Untitled'),
              description: 'Assigned by: ' + (t.assignedBy || 'Unknown') + '\nPriority: ' + (t.priority || 'Normal'),
              start: t.dueDate,
              allDay: true,
              colorId: t.priority === 'High' || t.priority === 'Urgent' ? '11' : '9'
            }).then(function(ev) {
              if (ev) fbDb.collection('tasks').doc(change.doc.id).update({ _calSynced: true, _calEventId: ev.id }).catch(function(e){console.warn('op:',e)});
            });
          }
        }
      });
    }, function() {});

    // Watch job tickets for due dates
    fbDb.collection('jobTickets').onSnapshot(function(snap) {
      snap.docChanges().forEach(function(change) {
        if (change.type === 'added' || change.type === 'modified') {
          var jt = change.doc.data();
          if (jt.jobDueDate && !jt._calSynced) {
            createCalendarEvent({
              title: '🎫 Job Due: ' + (jt.jobTicketNumber || '') + ' — ' + (jt.clientName || ''),
              description: 'Job: ' + (jt.jobDescription || '') + '\nPress: ' + (jt.press || '') + '\nAssigned: ' + (jt.assignedTo || ''),
              start: jt.jobDueDate,
              allDay: true,
              colorId: jt.priority === 'Urgent' ? '11' : jt.priority === 'High' ? '6' : '9'
            }).then(function(ev) {
              if (ev) fbDb.collection('jobTickets').doc(change.doc.id).update({ _calSynced: true, _calEventId: ev.id }).catch(function(e){console.warn('op:',e)});
            });
          }
        }
      });
    }, function() {});

    // Watch quotes for follow-up dates
    fbDb.collection('quotes').onSnapshot(function(snap) {
      snap.docChanges().forEach(function(change) {
        if (change.type === 'added') {
          var q = change.doc.data();
          if (q.followUpDate && !q._calSynced) {
            createCalendarEvent({
              title: '📊 Quote Follow-up: ' + (q.company || q.customer || 'Unknown'),
              description: 'Quote #' + (q.quoteNumber || change.doc.id) + '\nAmount: $' + (q.total || '0'),
              start: q.followUpDate,
              allDay: true,
              colorId: '5'
            }).then(function(ev) {
              if (ev) fbDb.collection('quotes').doc(change.doc.id).update({ _calSynced: true, _calEventId: ev.id }).catch(function(e){console.warn('op:',e)});
            });
          }
        }
      });
    }, function() {});

    console.log('✅ Google Calendar sync active');
  }

  // Calendar sync available on-demand — no auto-start
  window.mfxSyncCalendar = function() { if(window.GTOKEN) initCalendarSync(); else toast('Sign in with Google first','err'); };

  // Expose public API
  window.MFXNotifications = {
    addNotification: addNotification,
    dismissNotification: dismissNotification,
    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead,
    showFlash: showFlash,
    togglePanel: toggleNotifDropdown,
    toggleNotifDropdown: toggleNotifDropdown,
    getUnreadCount: () => STATE.unreadCount,
    getNotifications: () => STATE.notifications,
    STATE: STATE,
    createCalendarEvent: createCalendarEvent,
    createGoogleTask: createGoogleTask,
    init: window.initNotifications,
    cleanup: cleanupNotifListeners
  };

  // Auto-initialize only if auth is already resolved
  // Otherwise, core.js onAuthStateChanged will call initNotifications()
  if (typeof fbAuth !== 'undefined' && fbAuth.currentUser) {
    if (document.readyState === 'loading') {
      _trackListener(document, 'DOMContentLoaded', window.initNotifications);
    } else {
      window.initNotifications();
    }
  }

})();
