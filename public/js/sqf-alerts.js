/* ═══════════════════════════════════════════════════════════
   SQF ALERT WIRING — Hamburger Red Glow + Cross-Module Triggers
   Microflex Film Corp · MFX OS v3.0
   ═══════════════════════════════════════════════════════════ */
(function(){
'use strict';

var db = firebase.firestore();
var _alertListeners = [];
var _alertCount = 0;
var _holdTags = [];
var _quarantine = [];
var _critMaint = [];
var _sanFails = [];
var _sqfAlertInterval1 = null; // flushDailyDigest
var _sqfAlertInterval2 = null; // midnight rollover check

// ─── HAMBURGER RED GLOW ───────────────────────────────────
function updateHamburgerGlow(){
  var badge = document.getElementById('sqfAlertBadge');
  var dot = document.getElementById('sqfAlertDot');
  var header = document.getElementById('hamSqfHeader');
  var item = document.getElementById('hamSqfItem');

  _alertCount = _holdTags.length + _quarantine.length + _critMaint.length + _sanFails.length;
  window.SQF_ALERT_COUNT = _alertCount;

  if(badge){
    if(_alertCount > 0){
      badge.style.display = 'inline-block';
      badge.textContent = _alertCount;
    } else {
      badge.style.display = 'none';
    }
  }

  if(dot){
    dot.style.display = _alertCount > 0 ? 'inline-block' : 'none';
  }

  // Glow the section header red when alerts exist
  if(header){
    if(_alertCount > 0){
      header.style.color = 'var(--rd)';
      header.style.animation = 'sqfGlow 2s ease-in-out infinite';
      header.style.opacity = '1';
    } else {
      header.style.color = '#f97316';
      header.style.animation = 'none';
      header.style.opacity = '.6';
    }
  }

  // Highlight the SQF Data Logs item
  if(item){
    if(_alertCount > 0){
      item.style.background = 'rgba(255,100,116,0.06)';
      item.style.borderLeft = '3px solid var(--rd)';
    } else {
      item.style.background = '';
      item.style.borderLeft = '';
    }
  }

  // Also update the alert reel if critical
  if(_holdTags.length > 0 && typeof window.showAlertReel === 'function'){
    window.showAlertReel('sqf', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ' + _holdTags.length + ' Hold Tag' + (_holdTags.length>1?'s':'') + ' Active — product segregated', 'rd');
  }
}

// ─── FIRESTORE LISTENERS ──────────────────────────────────

// Listen for open hold tags
_alertListeners.push(db.collection('sqfQuality')
  .where('type','==','holdTag')
  .where('status','==','Open')
  .onSnapshot(function(snap){
    _holdTags = [];
    snap.forEach(function(doc){ _holdTags.push(Object.assign({id:doc.id}, doc.data())); });
    updateHamburgerGlow();
  }, function(err){ console.warn('SQF hold listener:', err); }));

// Listen for quarantine items
_alertListeners.push(db.collection('sqfMaterials')
  .where('disposition','==','quarantine')
  .onSnapshot(function(snap){
    _quarantine = [];
    snap.forEach(function(doc){ _quarantine.push(Object.assign({id:doc.id}, doc.data())); });
    updateHamburgerGlow();
  }, function(err){ console.warn('SQF quarantine listener:', err); }));

// Listen for critical maintenance
_alertListeners.push(db.collection('sqfFacilities')
  .where('type','==','maintenance')
  .where('status','==','Open')
  .onSnapshot(function(snap){
    _critMaint = [];
    snap.forEach(function(doc){
      var d = doc.data();
      if(d.priority === 'critical') _critMaint.push(Object.assign({id:doc.id}, d));
    });
    updateHamburgerGlow();
  }, function(err){ console.warn('SQF maint listener:', err); }));

// Listen for today's sanitation failures
var todayStr = new Date().toISOString().slice(0,10);
_alertListeners.push(db.collection('sqfSanitation')
  .where('date','==',todayStr)
  .onSnapshot(function(snap){
    _sanFails = [];
    snap.forEach(function(doc){
      var d = doc.data();
      if(d.readyForProd === 'fail' || d.passFailOverall === 'fail') _sanFails.push(Object.assign({id:doc.id}, d));
    });
    updateHamburgerGlow();
  }, function(err){ console.warn('SQF san listener:', err); }));

// ─── ESCALATION ROUTING ──────────────────────────────────
// Write escalation records to Firestore for audit trail + routing
function escalate(type, severity, data) {
  var record = {
    type: type,
    severity: severity,
    data: data || {},
    createdAt: new Date().toISOString(),
    createdBy: typeof getUserName === 'function' ? getUserName() : 'System',
    status: 'open',
    acknowledged: false
  };
  // Route by severity
  if (severity === 'critical') {
    record.escalateTo = ['operations_manager', 'ceo'];
    record.requiresAck = true;
    record.slaMinutes = 30;
  } else if (severity === 'major') {
    record.escalateTo = ['quality_supervisor'];
    record.requiresAck = true;
    record.slaMinutes = 120;
  } else {
    record.escalateTo = ['shift_lead'];
    record.requiresAck = false;
    record.slaMinutes = 480;
  }
  db.collection('sqfEscalations').add(record).catch(function(e) { console.warn('Escalation write:', e); });
  return record;
}

// ─── CAPA SUGGESTION WORKER ──────────────────────────────
function suggestCAPA(title, source, severity, description) {
  // Write CAPA suggestion to Firestore for the CAPA module to pick up
  var suggestion = {
    title: title,
    source: source,
    severity: severity,
    description: description,
    suggestedAt: new Date().toISOString(),
    suggestedBy: 'SQF Alert System',
    status: 'suggested',
    autoCreated: true
  };
  db.collection('capaSuggestions').add(suggestion).then(function(ref) {
    console.log('CAPA suggestion created:', ref.id);
  }).catch(function(e) { console.warn('CAPA suggestion:', e); });
  // Also try the direct CAPA module API
  if (typeof window.MFX_CAPA !== 'undefined' && window.MFX_CAPA.suggestNCR) {
    window.MFX_CAPA.suggestNCR({ title: title, source: source, severity: severity, description: description });
  }
}

// ─── DAILY DIGEST TRACKING ───────────────────────────────
var _digestKey = 'mfx_sqf_digest_' + todayStr;
function trackForDigest(category, item) {
  try {
    var digest = JSON.parse(localStorage.getItem(_digestKey) || '{"holdTags":[],"quarantine":[],"sanFails":[],"critMaint":[],"escalations":[],"receiving":[]}');
    if (digest[category] && !digest[category].some(function(d) { return d.id === item.id; })) {
      digest[category].push({ id: item.id, summary: item.product || item.material || item.area || item.line || 'Unknown', time: new Date().toISOString() });
      localStorage.setItem(_digestKey, JSON.stringify(digest));
    }
  } catch(e) {}
}

// Write daily digest to Firestore at end of session / periodically
function flushDailyDigest() {
  try {
    var digest = JSON.parse(localStorage.getItem(_digestKey) || '{}');
    var total = (digest.holdTags || []).length + (digest.quarantine || []).length + (digest.sanFails || []).length + (digest.critMaint || []).length + (digest.receiving || []).length;
    if (total === 0) return;
    db.collection('sqfDailyDigests').doc(todayStr).set({
      date: todayStr,
      holdTags: digest.holdTags || [],
      quarantine: digest.quarantine || [],
      sanFails: digest.sanFails || [],
      critMaint: digest.critMaint || [],
      escalations: digest.escalations || [],
      receiving: digest.receiving || [],
      totalAlerts: total,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(function(e) { console.warn('Digest flush:', e); });
  } catch(e) {}
}
// Flush digest every 5 minutes and on page unload
_sqfAlertInterval1 = setInterval(flushDailyDigest, 300000);
window.addEventListener('beforeunload', flushDailyDigest);

// ─── SANITATION LINE CLEARANCE CHECK ─────────────────────
// Exposed globally so production/logistics can call it
window.SQF_TRIGGERS = window.SQF_TRIGGERS || {};
window.SQF_TRIGGERS.isLineClear = function(lineId) {
  if (!lineId) return true; // No line specified = skip check
  var fail = _sanFails.find(function(s) {
    return (s.line === lineId || s.area === lineId || s.zone === lineId);
  });
  return !fail; // true = clear, false = blocked
};

window.SQF_TRIGGERS.getActiveHoldTags = function() { return _holdTags.slice(); };
window.SQF_TRIGGERS.getQuarantinedMaterials = function() { return _quarantine.slice(); };
window.SQF_TRIGGERS.getSanitationFailures = function() { return _sanFails.slice(); };

// ─── RECEIVING WORK QUEUE API ────────────────────────────────
// Exposed globally so vendor-pos, SQF datalogs, and other modules can interact
window.SQF_TRIGGERS.completeChecklistItem = function(taskId, itemKey) {
  if (!taskId || !itemKey) return Promise.reject(new Error('taskId and itemKey required'));
  return db.collection('receivingQueue').doc(taskId).get().then(function(doc) {
    if (!doc.exists) throw new Error('Task not found');
    var task = doc.data();
    var checklist = task.checklist || [];
    var updated = false;
    for (var i = 0; i < checklist.length; i++) {
      if (checklist[i].key === itemKey) {
        checklist[i].done = true;
        checklist[i].completedAt = new Date().toISOString();
        checklist[i].completedBy = typeof getUserName === 'function' ? getUserName() : 'User';
        updated = true;
        break;
      }
    }
    if (!updated) throw new Error('Checklist item not found: ' + itemKey);
    // Check if all required items complete
    var allRequired = checklist.filter(function(c) { return c.required; });
    var allDone = allRequired.every(function(c) { return c.done; });
    var updates = {
      checklist: checklist,
      checklistComplete: allDone,
      updatedAt: new Date().toISOString()
    };
    if (allDone) {
      updates.status = 'complete';
      updates.completedAt = new Date().toISOString();
      updates.completedBy = typeof getUserName === 'function' ? getUserName() : 'User';
    }
    return db.collection('receivingQueue').doc(taskId).update(updates);
  }).catch(function(e){ console.warn('SQF_ALERTS get:', e.message); });
};

window.SQF_TRIGGERS.getReceivingTask = function(taskId) {
  return db.collection('receivingQueue').doc(taskId).get().then(function(doc) {
    return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
  }).catch(function(e){ console.warn('SQF_ALERTS get:', e.message); });
};

window.SQF_TRIGGERS.getPendingReceivingTasks = function() {
  return db.collection('receivingQueue')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get().then(function(snap) {
      var tasks = [];
      snap.forEach(function(doc) { tasks.push(Object.assign({ id: doc.id }, doc.data())); });
      return tasks;
    }).catch(function(e){ console.warn('SQF_ALERTS get:', e.message); });
};

window.SQF_TRIGGERS.quarantineFromReceiving = function(taskId, reason) {
  return db.collection('receivingQueue').doc(taskId).get().then(function(doc) {
    if (!doc.exists) throw new Error('Task not found');
    var task = doc.data();
    // Update task to quarantine disposition
    db.collection('receivingQueue').doc(taskId).update({
      status: 'quarantined',
      disposition: 'quarantine',
      quarantineReason: reason || '',
      updatedAt: new Date().toISOString()
    });
    // Write quarantine record to sqfMaterials
    db.collection('sqfMaterials').add({
      type: 'receiving',
      date: new Date().toISOString(),
      supplier: task.vendor || '',
      material: task.material || '',
      supplierLot: task.lot || '',
      qty: task.qty || '',
      disposition: 'quarantine',
      quarantineReason: reason || '',
      poNumber: task.vpoNum || '',
      taskId: taskId,
      autoCreated: true,
      source: 'receiving.quarantine'
    });
    // Emit quarantine event for escalation routing
    if (typeof window.MFX !== 'undefined' && window.MFX.emit) {
      window.MFX.emit('sqf.quarantine', {
        material: task.material,
        supplier: task.vendor,
        lot: task.lot,
        vpoNum: task.vpoNum,
        reason: reason
      });
    }
    return { quarantined: true, taskId: taskId };
  }).catch(function(e){ console.warn('SQF_ALERTS get:', e.message); });
};

// ─── CROSS-MODULE EVENT LISTENERS ─────────────────────────
if(window.MFX && window.MFX.on){

  // Hold tag → escalate + auto-create CAPA suggestion
  window.MFX.on('sqf.holdTag.issued', function(data){
    console.log('SQF Hold Tag issued:', data.tagNum, '—', data.product, 'Lot:', data.lot);
    toast('Hold Tag ' + data.tagNum + ' issued — ' + data.product, 'err');
    var sev = data.risk === 'high' ? 'critical' : 'major';
    escalate('holdTag', sev, { tagNum: data.tagNum, product: data.product, lot: data.lot, risk: data.risk });
    suggestCAPA(
      'Hold Tag ' + data.tagNum + ' — ' + data.product,
      'Quality Hold Tag',
      data.risk === 'high' ? 'Critical' : 'Major',
      'Product held: ' + data.product + ' Lot ' + data.lot + '. Risk: ' + data.risk
    );
    trackForDigest('holdTags', { id: data.tagNum, product: data.product });
  });

  // Sanitation fail → escalate + block production line
  window.MFX.on('sqf.sanitation.fail', function(data){
    console.log('Sanitation FAIL:', data.line, data.date);
    toast('Sanitation FAIL — ' + data.line + ' NOT released for production', 'err');
    escalate('sanitationFail', 'critical', { line: data.line, date: data.date });
    trackForDigest('sanFails', { id: data.line + '_' + data.date, line: data.line });
  });

  // Quarantine → escalate + alert purchasing
  window.MFX.on('sqf.quarantine', function(data){
    console.log('Material quarantined:', data.material, 'from', data.supplier);
    toast('Quarantine — ' + data.material + ' from ' + data.supplier, 'err');
    escalate('quarantine', 'major', { material: data.material, supplier: data.supplier, lot: data.lot });
    suggestCAPA(
      'Material Quarantine — ' + data.material,
      'Receiving / Material Control',
      'Major',
      'Material: ' + data.material + ' from ' + data.supplier + (data.lot ? ' Lot: ' + data.lot : '') + '. Quarantined pending investigation.'
    );
    trackForDigest('quarantine', { id: data.material, material: data.material });
  });

  // Critical maintenance → escalate immediately
  window.MFX.on('sqf.maintenance.critical', function(data){
    console.log('CRITICAL Maintenance:', data.area, '—', data.issue);
    toast('CRITICAL Maintenance — ' + data.area, 'err');
    escalate('criticalMaintenance', 'critical', { area: data.area, issue: data.issue });
    trackForDigest('critMaint', { id: data.area, area: data.area });
  });

  // Quality reject → escalate + alert shipping
  window.MFX.on('sqf.quality.reject', function(data){
    console.log('Product REJECTED:', data.product, 'Lot:', data.lot);
    toast('Product REJECTED — ' + data.product + ' Lot ' + data.lot, 'err');
    escalate('qualityReject', 'major', { product: data.product, lot: data.lot });
    suggestCAPA(
      'Product Rejection — ' + data.product,
      'Quality Control',
      'Major',
      'Product: ' + data.product + ' Lot ' + (data.lot || 'N/A') + ' rejected during QC. Review required.'
    );
  });

  // PRODUCTION QUALITY GATE: when a job enters QC stage, block if sanitation not clear
  window.MFX.on('job.stageChange', function(data){
    if(!data) return;
    if(data.stage === 'QC'){
      var lineId = data.line || data.machine || '';
      var clear = window.SQF_TRIGGERS.isLineClear(lineId);
      if(!clear){
        toast('BLOCKED: Line ' + lineId + ' sanitation not verified — cannot enter QC', 'err');
        escalate('qcGateBlock', 'critical', {
          jobId: data.jobId || data.jtId,
          jobNum: data.jtNum || data.jobNum,
          line: lineId,
          reason: 'Sanitation not cleared for production line'
        });
        // Attempt server-side block via transitionStatus rejection
        if(data.jobId && typeof MFXApi !== 'undefined' && MFXApi.postJSON){
          MFXApi.postJSON('/api/transitionStatus', {
            collection: 'jobTickets', docId: data.jobId, newStatus: 'production',
            note: 'QC blocked: sanitation not cleared for line ' + lineId
          }).catch(function(e){ console.warn('QC gate revert:', e); });
        }
        // Notify supervisor
        if(typeof notifyTeam === 'function'){
          notifyTeam('BLOCKED: Job ' + (data.jtNum || data.jobId) + ' cannot enter QC — line ' + lineId + ' sanitation failed. Clear sanitation first.');
        }
        return; // Block the transition
      }
    }
    // Also check for release-to-ship if hold tags exist for product
    if(data.stage === 'shipping' || data.stage === 'Ready to Ship'){
      if(_holdTags.length > 0){
        var blocked = _holdTags.find(function(h){ return h.jobId === data.jobId || h.jtId === data.jtId; });
        if(blocked){
          toast('BLOCKED: Active hold tag on this job — cannot ship', 'err');
          escalate('shipGateBlock', 'critical', { jobId: data.jobId, holdTag: blocked.tagNum });
          return;
        }
      }
    }
  });

  // VPO received → create receiving work-queue task with traceability checklist
  window.MFX.on('vpo.received', function(data){
    if(!data || !data.vpoNum) return;
    console.log('VPO received — creating receiving work-queue task for', data.vendor, data.vpoNum);

    var taskId = 'rcv_' + (data.vpoNum || '').replace(/[^a-zA-Z0-9]/g,'_') + '_' + Date.now();
    var now = new Date().toISOString();
    var receivedBy = data.receivedBy || (typeof getUserName === 'function' ? getUserName() : 'System');

    // SQF Edition 10 traceability checklist items
    var checklist = [
      { key: 'coaVerified',       label: 'Certificate of Analysis (CoA) verified',       done: false, required: true },
      { key: 'lotRecorded',       label: 'Lot/batch number recorded in receiving log',   done: !!data.lot, required: true },
      { key: 'qtyVerified',       label: 'Quantity verified against PO',                 done: !!data.qty, required: true },
      { key: 'conditionInspected',label: 'Packaging condition inspected (no damage)',     done: !!data.condition, required: true },
      { key: 'tempVerified',      label: 'Temperature check (if applicable)',             done: false, required: false },
      { key: 'labelVerified',     label: 'Label/marking verified (material, grade, lot)', done: false, required: true },
      { key: 'foreignMaterial',   label: 'Foreign material / contamination check',        done: false, required: true },
      { key: 'sqfCertValid',      label: 'Supplier SQF certificate valid / on file',      done: !!data.sqfCertNum, required: true },
      { key: 'storageAssigned',   label: 'Storage location assigned (FIFO verified)',     done: false, required: true },
      { key: 'allergenCheck',     label: 'Allergen cross-contact risk assessed',          done: false, required: false },
      { key: 'receivingLogSaved', label: 'Receiving log entry saved to FSQMS',            done: false, required: true }
    ];

    var task = {
      id: taskId,
      type: 'receiving',
      status: 'pending',
      priority: 'high',
      title: 'Receiving Inspection — ' + (data.material || 'Material') + ' from ' + (data.vendor || 'Vendor'),
      vpoId: data.vpoId || '',
      vpoNum: data.vpoNum,
      vendor: data.vendor || '',
      material: data.material || '',
      materialCategory: data.materialCategory || '',
      lot: data.lot || '',
      qty: data.qty || '',
      unit: data.unit || '',
      condition: data.condition || '',
      sqfCertNum: data.sqfCertNum || '',
      checklist: checklist,
      checklistComplete: false,
      assignedTo: receivedBy,
      createdAt: now,
      createdBy: 'SQF Alert System',
      updatedAt: now,
      dueBy: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours SLA
      sqfClause: '2.4.4 — Incoming Goods & Services',
      notes: ''
    };

    // Write to receivingQueue collection in Firestore
    db.collection('receivingQueue').doc(taskId).set(task).then(function() {
      console.log('Receiving task created:', taskId);
      toast('📋 Receiving task created — complete traceability checklist', 'ok');

      // Pre-populate the FSQMS receiving log entry with VPO data
      var receivingData = {
        type: 'receiving',
        date: now,
        receivedBy: receivedBy,
        supplier: data.vendor || '',
        poNumber: data.vpoNum || '',
        material: data.material || '',
        supplierLot: data.lot || '',
        qty: data.qty || '',
        unit: data.unit || '',
        condition: data.condition || '',
        disposition: 'Accept',
        coA: '',
        taskId: taskId,
        storageLocation: '',
        autoCreated: true,
        source: 'vpo.received'
      };
      db.collection('sqfMaterials').add(receivingData).then(function(ref) {
        // Mark the receiving log checklist item as done
        db.collection('receivingQueue').doc(taskId).update({
          'checklist.10.done': true, // receivingLogSaved index
          updatedAt: new Date().toISOString()
        }).catch(function() {});
        console.log('FSQMS receiving log auto-created:', ref.id);
      }).catch(function(e) { console.warn('FSQMS receiving log:', e); });

    }).catch(function(e) { console.warn('Receiving task creation:', e); });

    // Track for daily digest
    trackForDigest('receiving', { id: taskId, material: data.material || data.vpoNum });

    // Escalate if supplier has no SQF cert on file
    if(!data.sqfCertNum) {
      escalate('receivingNoCert', 'major', {
        vendor: data.vendor,
        material: data.material,
        vpoNum: data.vpoNum,
        reason: 'No SQF certificate on file for this delivery'
      });
    }
  });
}

// ─── DASHBOARD INTEGRATION ────────────────────────────────
window.SQF_ALERT_COUNT = _alertCount;
// Expose digest access for dashboard/launchpad
window.getSQFDailyDigest = function() {
  try { return JSON.parse(localStorage.getItem(_digestKey) || '{}'); } catch(e) { return {}; }
};

// ─── PERIODIC REFRESH ─────────────────────────────────────
// Check every 60s for date changes (midnight rollover) — use soft refresh instead of location.reload
_sqfAlertInterval2 = setInterval(function(){
  var now = new Date().toISOString().slice(0,10);
  if(now !== todayStr){
    // Date changed — flush yesterday's digest, update today
    flushDailyDigest();
    todayStr = now;
    _digestKey = 'mfx_sqf_digest_' + todayStr;
    // Re-query today's sanitation — detach old sanitation listener first to prevent leak
    if(_alertListeners.length > 0) { var lastUnsub = _alertListeners.pop(); if(typeof lastUnsub === 'function') lastUnsub(); }
    _alertListeners.push(db.collection('sqfSanitation').where('date','==',now).onSnapshot(function(snap){
      _sanFails = [];
      snap.forEach(function(doc){
        var d = doc.data();
        if(d.readyForProd === 'fail' || d.passFailOverall === 'fail') _sanFails.push(Object.assign({id:doc.id}, d));
      });
      updateHamburgerGlow();
    }, function(err){ console.warn('SQF san listener refresh:', err); }));
  }
}, 60000);

// ─── INTERVAL CLEANUP ─────────────────────────────────────
function clearSqfAlertIntervals(){
  if(_sqfAlertInterval1){clearInterval(_sqfAlertInterval1);_sqfAlertInterval1=null;}
  if(_sqfAlertInterval2){clearInterval(_sqfAlertInterval2);_sqfAlertInterval2=null;}
  // Also detach listeners on cleanup
  _alertListeners.forEach(function(fn){ if(typeof fn === 'function') fn(); }); _alertListeners = [];
}
window.clearSqfAlertIntervals = clearSqfAlertIntervals;

window.detachSqfAlertListeners = function(){ _alertListeners.forEach(function(fn){ if(typeof fn === 'function') fn(); }); _alertListeners = []; };

console.log('MFX SQF Alert Wiring loaded — monitoring hold tags, quarantine, sanitation, maintenance + escalation routing');

})();
