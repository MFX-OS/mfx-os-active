(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  var USERS = ['Maria Rodriguez', 'James Chen', 'Sarah Patel', 'Alex Williams', 'Kim Torres'];
  var LINES = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Flexo Press A', 'Flexo Press B', 'Converting Line'];
  var SHIFTS = [
    { value: 'Day', label: 'Day (6am–2pm)' },
    { value: 'Evening', label: 'Evening (2pm–10pm)' },
    { value: 'Night', label: 'Night (10pm–6am)' }
  ];
  var ZONES = [
    'Zone 1A - Packaging Line 1',
    'Zone 1B - Packaging Line 2',
    'Zone 1C - Converting',
    'Zone 2A - Receiving',
    'Zone 2B - Storage',
    'Zone 3A - Break Room',
    'Zone 3B - Locker Room',
    'Zone 4A - Exterior East',
    'Zone 4B - Exterior West',
    'Zone 4C - Dock Area'
  ];
  var SUPPLIERS = [
    'Nexpack Films',
    'ChemTech Inks',
    'PolyBase Corp',
    'SealRight Materials',
    'ColorPro Pigments',
    'GreenLeaf Substrates'
  ];
  var MATERIALS = [
    'LDPE Film Roll',
    'HDPE Granules',
    'Flexo Ink Black',
    'Flexo Ink Cyan',
    'Flexo Ink Magenta',
    'Adhesive TS-400',
    'Release Liner 40#',
    'Aluminum Foil Laminate',
    'OPP Film',
    'Solvent Blend SB-20',
    'Cardboard Core 3"',
    'Stretch Wrap',
    'Corrugated Shipper',
    'Labels Thermal',
    'Cleaning Chemical 101'
  ];

  // ============================================================================
  // STATE & DATA
  // ============================================================================
  var db = firebase.firestore();
  var state = {
    currentTab: 'overview',
    currentSubTab: {},
    sanitationLogs: [],
    facilitiesLogs: [],
    qualityLogs: [],
    materialsLogs: [],
    filteredData: {},
    alertCount: 0
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) {
    return n < 10 ? '0' + n : n;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  function generateHoldTagNumber() {
    return 'HT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  function generateWorkOrderNumber() {
    return 'WO-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  function toast(msg, type) {
    if (window.toast) {
      window.toast(msg, type);
    } else {
      console.log('[' + (type || 'info') + '] ' + msg);
    }
  }

  function openModal(html) {
    if (window.openModal) {
      window.openModal(html);
    }
  }

  function closeModal() {
    if (window.closeModal) {
      window.closeModal();
    }
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function emitEvent(eventName, data) {
    if (window.MFX && window.MFX.emit) {
      window.MFX.emit(eventName, data);
    }
  }

  function calculateVariance(expected, actual) {
    if (!expected || expected === 0) return 0;
    return Math.round(((actual - expected) / expected) * 100);
  }

  function highlightVariance(variance, threshold) {
    if (Math.abs(variance) > threshold) {
      return 'style="background-color: var(--rd);"';
    }
    return '';
  }

  // ============================================================================
  // DATA LOADING & SYNC
  // ============================================================================
  function loadData() {
    loadSanitationLogs();
    loadFacilitiesLogs();
    loadQualityLogs();
    loadMaterialsLogs();
  }

  function loadSanitationLogs() {
    var reg=typeof mfxRegisterListener==='function'?mfxRegisterListener:function(){};
    reg('sqfSanitation',db.collection('sqfSanitation')
      .orderBy('date', 'desc')
      .limit(100)
      .onSnapshot(function(snap) {
        state.sanitationLogs = [];
        snap.forEach(function(doc) {
          state.sanitationLogs.push(Object.assign({ id: doc.id }, doc.data()));
        });
        updateAlertCount();
        render();
      }, function(err) {
        console.error('Load sanitation error:', err);
      }));
  }

  function loadFacilitiesLogs() {
    var reg=typeof mfxRegisterListener==='function'?mfxRegisterListener:function(){};
    reg('sqfFacilities',db.collection('sqfFacilities')
      .orderBy('date', 'desc')
      .limit(100)
      .onSnapshot(function(snap) {
        state.facilitiesLogs = [];
        snap.forEach(function(doc) {
          state.facilitiesLogs.push(Object.assign({ id: doc.id }, doc.data()));
        });
        updateAlertCount();
        render();
      }, function(err) {
        console.error('Load facilities error:', err);
      }));
  }

  function loadQualityLogs() {
    var reg=typeof mfxRegisterListener==='function'?mfxRegisterListener:function(){};
    reg('sqfQuality',db.collection('sqfQuality')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .onSnapshot(function(snap) {
        state.qualityLogs = [];
        snap.forEach(function(doc) {
          state.qualityLogs.push(Object.assign({ id: doc.id }, doc.data()));
        });
        updateAlertCount();
        render();
      }, function(err) {
        console.error('Load quality error:', err);
      }));
  }

  function loadMaterialsLogs() {
    var reg=typeof mfxRegisterListener==='function'?mfxRegisterListener:function(){};
    reg('sqfMaterials',db.collection('sqfMaterials')
      .orderBy('date', 'desc')
      .limit(100)
      .onSnapshot(function(snap) {
        state.materialsLogs = [];
        snap.forEach(function(doc) {
          state.materialsLogs.push(Object.assign({ id: doc.id }, doc.data()));
        });
        updateAlertCount();
        render();
      }, function(err) {
        console.error('Load materials error:', err);
      }));
  }

  // ============================================================================
  // ALERT COUNT
  // ============================================================================
  function updateAlertCount() {
    var count = 0;

    // Count open hold tags
    state.qualityLogs.forEach(function(log) {
      if (log.type === 'holdTag' && log.status !== 'closed') {
        count++;
      }
    });

    // Count quarantine items
    state.materialsLogs.forEach(function(log) {
      if (log.type === 'receiving' && log.disposition === 'Quarantine') {
        count++;
      }
    });

    // Count sanitation FAILs
    state.sanitationLogs.forEach(function(log) {
      if (log.type === 'preOpDaily' && log.lineRelease === 'HELD') {
        count++;
      }
    });

    // Count critical maintenance
    state.facilitiesLogs.forEach(function(log) {
      if (log.type === 'maintenance' && log.priority === 'Critical' && log.status !== 'Complete') {
        count++;
      }
    });

    state.alertCount = count;
    window.SQF_ALERT_COUNT = count;
  }

  // ============================================================================
  // TAB 1: OVERVIEW DASHBOARD
  // ============================================================================
  function renderOverviewTab() {
    var todayStr = today();
    var sanitationToday = state.sanitationLogs.filter(function(log) {
      return log.date && log.date.startsWith(todayStr);
    });
    var qualityToday = state.qualityLogs.filter(function(log) {
      return log.date && log.date.startsWith(todayStr);
    });
    var receivingToday = state.materialsLogs.filter(function(log) {
      return log.type === 'receiving' && log.date && log.date.startsWith(todayStr);
    });

    var openHolds = state.qualityLogs.filter(function(log) {
      return log.type === 'holdTag' && log.status !== 'closed';
    });

    var quarantineItems = state.materialsLogs.filter(function(log) {
      return log.type === 'receiving' && log.disposition === 'Quarantine';
    });

    var criticalMaint = state.facilitiesLogs.filter(function(log) {
      return log.type === 'maintenance' && log.priority === 'Critical' && log.status !== 'Complete';
    });

    var html = '<div style="padding: 20px;">';
    html += '<h2>SQF Data Logs Dashboard</h2>';

    // KPI Grid
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px;">';
    html += renderKPICard('Sanitation Logs Today', sanitationToday.length.toString(), 'var(--ac)');
    html += renderKPICard('Quality Checks Today', qualityToday.length.toString(), 'var(--ac)');
    html += renderKPICard('Receiving Today', receivingToday.length.toString(), 'var(--ac)');
    html += renderKPICard('Open Hold Tags', openHolds.length.toString(), openHolds.length > 0 ? 'var(--rd)' : 'var(--gn)');
    html += renderKPICard('Quarantine Items', quarantineItems.length.toString(), quarantineItems.length > 0 ? 'var(--rd)' : 'var(--gn)');
    html += renderKPICard('Critical Maintenance', criticalMaint.length.toString(), criticalMaint.length > 0 ? 'var(--rd)' : 'var(--gn)');
    html += '</div>';

    // Items Requiring Action
    html += '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--tx); margin-top: 0;">Items Requiring Action</h3>';

    if (openHolds.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4 style="color: var(--rd); margin: 10px 0;">Hold Tags (' + openHolds.length + ')</h4>';
      openHolds.slice(0, 5).forEach(function(hold) {
        html += '<div style="background: var(--bg); padding: 10px; margin: 5px 0; border-left: 4px solid var(--rd); border-radius: 4px;">';
        html += '<strong>' + (hold.tagNum || 'N/A') + '</strong> | ' + (hold.product || 'N/A') + ' | Lot: ' + (hold.lot || 'N/A') + ' | Risk: ' + (hold.riskLevel || 'N/A');
        html += '</div>';
      });
      html += '</div>';
    }

    if (quarantineItems.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4 style="color: var(--rd); margin: 10px 0;">Quarantine Items (' + quarantineItems.length + ')</h4>';
      quarantineItems.slice(0, 5).forEach(function(item) {
        html += '<div style="background: var(--bg); padding: 10px; margin: 5px 0; border-left: 4px solid var(--or); border-radius: 4px;">';
        html += '<strong>' + (item.material || 'N/A') + '</strong> | ' + (item.supplier || 'N/A') + ' | Lot: ' + (item.supplierLot || 'N/A');
        html += '</div>';
      });
      html += '</div>';
    }

    if (criticalMaint.length > 0) {
      html += '<div>';
      html += '<h4 style="color: var(--rd); margin: 10px 0;">Critical Maintenance (' + criticalMaint.length + ')</h4>';
      criticalMaint.slice(0, 5).forEach(function(maint) {
        html += '<div style="background: var(--bg); padding: 10px; margin: 5px 0; border-left: 4px solid var(--rd); border-radius: 4px;">';
        html += '<strong>' + (maint.area || 'N/A') + '</strong> | ' + (maint.issue || 'N/A');
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';

    // Recent Activity Feed
    html += '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px;">';
    html += '<h3 style="color: var(--tx); margin-top: 0;">Recent Activity (Last 15)</h3>';
    var allActivity = [];
    state.sanitationLogs.forEach(function(log) {
      allActivity.push({
        type: 'Sanitation',
        text: log.type + ' - Line: ' + (log.line || 'N/A'),
        ts: log.date || log.timestamp || ''
      });
    });
    state.facilitiesLogs.forEach(function(log) {
      allActivity.push({
        type: 'Facilities',
        text: log.area || 'N/A',
        ts: log.date || ''
      });
    });
    state.qualityLogs.forEach(function(log) {
      allActivity.push({
        type: 'Quality',
        text: log.product || log.tagNum || 'N/A',
        ts: log.date || log.timestamp || ''
      });
    });
    state.materialsLogs.forEach(function(log) {
      allActivity.push({
        type: 'Materials',
        text: log.material || 'N/A',
        ts: log.date || ''
      });
    });
    allActivity.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
    allActivity.slice(0, 15).forEach(function(item) {
      html += '<div style="padding: 8px; border-bottom: 1px solid var(--bg); color: var(--tx3);">';
      html += '<strong style="color: var(--ac);">' + item.type + '</strong> - ' + item.text + ' <span style="float: right; font-size: 0.85em;">' + (item.ts || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderKPICard(title, value, color) {
    return '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; text-align: center; border-top: 4px solid ' + color + ';">' +
      '<div style="font-size: 0.9em; color: var(--tx3); margin-bottom: 10px;">' + title + '</div>' +
      '<div style="font-size: 2em; font-weight: bold; color: ' + color + ';">' + value + '</div>' +
      '</div>';
  }

  // ============================================================================
  // TAB 2: SANITATION LOGS
  // ============================================================================
  function renderSanitationTab() {
    var subTab = state.currentSubTab.sanitation || 'preOpDaily';
    var html = '<div style="padding: 20px;">';
    html += '<h2>Sanitation Logs</h2>';
    html += '<div style="border-bottom: 1px solid var(--bg3); margin-bottom: 20px;">';
    html += '<button class="tab-btn' + (subTab === 'preOpDaily' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchSanitationSubTab(\'preOpDaily\')">Pre-Op Daily</button>';
    html += '<button class="tab-btn' + (subTab === 'deepClean' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchSanitationSubTab(\'deepClean\')">Deep Clean Weekly</button>';
    html += '<button class="tab-btn' + (subTab === 'monthly' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchSanitationSubTab(\'monthly\')">Monthly</button>';
    html += '</div>';

    if (subTab === 'preOpDaily') {
      html += renderPreOpDailyForm();
      html += renderSanitationRecordsTable('preOpDaily');
    } else if (subTab === 'deepClean') {
      html += renderDeepCleanForm();
      html += renderSanitationRecordsTable('deepClean');
    } else {
      html += renderMonthlyForm();
      html += renderSanitationRecordsTable('monthly');
    }

    html += '</div>';
    return html;
  }

  function renderPreOpDailyForm() {
    var formId = 'preOpForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Pre-Op Daily Inspection (§13.3)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Entry</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'preOpDate', 'date', today());
    html += renderField('Shift', 'preOpShift', 'select', '', SHIFTS.map(function(s) { return s.value; }));
    html += renderField('Production Line', 'preOpLine', 'select', '', LINES);
    html += renderField('Completed By', 'preOpCompletedBy', 'select', '', USERS);
    html += renderField('Verified By', 'preOpVerifiedBy', 'select', '', USERS);
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Inspection Checklist</h4>';
    var checklistItems = [
      'Floors & Drains',
      'Walls & Ceilings',
      'Equipment Surfaces',
      'Overhead Structures',
      'Utensils & Tools',
      'Chemical Residual Check',
      'Light Covers Intact',
      'Pest Observations'
    ];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    checklistItems.forEach(function(item) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('ATP Result (RLU)', 'preOpATP', 'number', '');
    html += renderField('Line Release Decision', 'preOpLineRelease', 'select', '', ['RELEASED', 'HELD']);
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Deficiencies/Notes</label>';
    html += '<textarea style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.savePreOpDaily()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Pre-Op Log</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderDeepCleanForm() {
    var formId = 'deepCleanForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Deep Clean Weekly</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Entry</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'deepCleanDate', 'date', today());
    html += renderField('Completed By', 'deepCleanBy', 'select', '', USERS);
    html += renderField('Zone', 'deepCleanZone', 'select', '', ZONES);
    html += renderField('Chemical Used', 'deepCleanChemical', 'text', '');
    html += renderField('Concentration', 'deepCleanConcentration', 'text', '');
    html += renderField('Contact Time (min)', 'deepCleanContactTime', 'number', '');
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Verification</h4>';
    var verifyItems = ['Equipment Disassembled', 'Rinse Verified', 'Drains Degreased', 'Walls Scrubbed', 'Overheads Wiped', 'Photos Taken'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    verifyItems.forEach(function(item) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>YES</option><option>NO</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('ATP Results (RLU)', 'deepCleanATP', 'number', '');
    html += renderField('Overall Pass/Fail', 'deepCleanPass', 'select', '', ['PASS', 'FAIL']);
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveDeepClean()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Deep Clean Log</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderMonthlyForm() {
    var formId = 'monthlyForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Monthly Deep Inspection</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Entry</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'monthlyDate', 'date', today());
    html += renderField('Inspector', 'monthlyInspector', 'select', '', USERS);
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Inspection Items</h4>';
    var monthlyItems = ['Pest Treatment', 'Drains Scoped', 'Roof Inspected', 'HVAC Filters', 'Traps Cleaned', 'Exterior Walls', 'Docks', 'Condenser/Evap Coils'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    monthlyItems.forEach(function(item) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">CARs Raised / Supervisor Notes</label>';
    html += '<textarea style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveMonthly()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Monthly Log</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderSanitationRecordsTable(type) {
    var records = state.sanitationLogs.filter(function(log) {
      return log.type === type;
    });
    var html = '<div style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead style="background: var(--bg2);">';
    html += '<tr>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Date</th>';
    if (type === 'preOpDaily') {
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Shift</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Line</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">By</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Status</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Release</th>';
    } else if (type === 'deepClean') {
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Zone</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">By</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Result</th>';
    } else {
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Inspector</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Items Passed</th>';
    }
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    records.forEach(function(rec) {
      html += '<tr style="border-bottom: 1px solid var(--bg3);">';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.date || '') + '</td>';
      if (type === 'preOpDaily') {
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.shift || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.line || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.completedBy || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">CHECKED</td>';
        var releaseBgColor = rec.lineRelease === 'RELEASED' ? 'var(--gn)' : 'var(--rd)';
        html += '<td style="padding: 10px;"><span style="background: ' + releaseBgColor + '; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">' + (rec.lineRelease || '') + '</span></td>';
      } else if (type === 'deepClean') {
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.zone || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.completedBy || '') + '</td>';
        var passBgColor = rec.pass === 'PASS' ? 'var(--gn)' : 'var(--rd)';
        html += '<td style="padding: 10px;"><span style="background: ' + passBgColor + '; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">' + (rec.pass || '') + '</span></td>';
      } else {
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.inspector || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">8/8</td>';
      }
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  // ============================================================================
  // TAB 3: FACILITIES LOGS
  // ============================================================================
  function renderFacilitiesTab() {
    var subTab = state.currentSubTab.facilities || 'dailyInspection';
    var html = '<div style="padding: 20px;">';
    html += '<h2>Facilities Logs</h2>';
    html += '<div style="border-bottom: 1px solid var(--bg3); margin-bottom: 20px;">';
    html += '<button class="tab-btn' + (subTab === 'dailyInspection' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchFacilitiesSubTab(\'dailyInspection\')">Daily Inspection</button>';
    html += '<button class="tab-btn' + (subTab === 'weeklyWalkthrough' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchFacilitiesSubTab(\'weeklyWalkthrough\')">Weekly Walkthrough</button>';
    html += '<button class="tab-btn' + (subTab === 'monthlyReview' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchFacilitiesSubTab(\'monthlyReview\')">Monthly Review</button>';
    html += '<button class="tab-btn' + (subTab === 'maintenance' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchFacilitiesSubTab(\'maintenance\')">Maintenance Requests</button>';
    html += '</div>';

    if (subTab === 'dailyInspection') {
      html += renderDailyInspectionForm();
      html += renderFacilitiesRecordsTable('dailyInspection');
    } else if (subTab === 'weeklyWalkthrough') {
      html += renderWeeklyWalkthroughForm();
      html += renderFacilitiesRecordsTable('weeklyWalkthrough');
    } else if (subTab === 'monthlyReview') {
      html += renderMonthlyReviewForm();
      html += renderFacilitiesRecordsTable('monthlyReview');
    } else {
      html += renderMaintenanceRequestForm();
      html += renderFacilitiesRecordsTable('maintenance');
    }

    html += '</div>';
    return html;
  }

  function renderDailyInspectionForm() {
    var formId = 'dailyInspForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Daily Inspection (§13.1/§13.3/§13.4)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Entry</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'dailyInspDate', 'date', today());
    html += renderField('Shift', 'dailyInspShift', 'select', '', SHIFTS.map(function(s) { return s.value; }));
    html += renderField('Inspector', 'dailyInspInspector', 'select', '', USERS);
    html += renderField('Area', 'dailyInspArea', 'text', '');
    html += renderField('Temperature (°F)', 'dailyInspTemp', 'number', '');
    html += renderField('Humidity (%)', 'dailyInspHumidity', 'number', '');
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Premises Checklist (§13.1)</h4>';
    var premisesItems = ['Floors', 'Drains', 'Walls/Partitions', 'Ceilings', 'Doors & Seals', 'Windows', 'Lighting', 'Light Covers', 'Ventilation', 'Pest Exclusion', 'Storage', 'Equipment Condition'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    premisesItems.forEach(function(item) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('Pest Activity', 'dailyInspPest', 'select', '', ['None', 'Minor', 'Active - CAR Raised']);
    html += renderField('Maintenance Required', 'dailyInspMaint', 'select', '', ['No', 'Minor', 'URGENT']);
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('Priority Level', 'dailyInspPriority', 'select', '', ['None', 'Low', 'Medium', 'High', 'Critical - IMMEDIATE']);
    html += renderField('Work Order #', 'dailyInspWO', 'text', '');
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Issues Found</label>';
    html += '<textarea style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveDailyInspection()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Inspection</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderWeeklyWalkthroughForm() {
    var formId = 'weeklyWalkForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Weekly Walkthrough (§13.1/§13.3)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Walkthrough</button>';
    html += '<form id="' + formId + '" style="display: none;">';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'weeklyWalkDate', 'date', today());
    html += renderField('Lead Inspector', 'weeklyWalkInspector', 'select', '', USERS);
    html += renderField('Accompanying Staff', 'weeklyWalkStaff', 'text', '');
    html += renderField('Week #', 'weeklyWalkWeek', 'number', Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000).toString());
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Building Exterior</h4>';
    var exteriorItems = ['Roof Condition', 'Wall Integrity', 'Loading Docks', 'Waste Area', 'Grounds/Landscaping', 'Signage', 'Pest Bait Stations'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    exteriorItems.forEach(function(item) {
      html += '<div><label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select id="weeklyExt_' + item.replace(/[^a-zA-Z]/g,'') + '" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option></select></div>';
    });
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Interior Production Areas</h4>';
    var interiorItems = ['Floors & Drains', 'Walls & Ceilings', 'Lighting & Covers', 'Ventilation / HVAC', 'Handwash Stations', 'Employee Practices', 'Chemical Storage', 'Allergen Controls', 'Waste Management', 'Glass & Brittle Plastics'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    interiorItems.forEach(function(item) {
      html += '<div><label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select id="weeklyInt_' + item.replace(/[^a-zA-Z]/g,'') + '" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option></select></div>';
    });
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('Overall Status', 'weeklyWalkStatus', 'select', '', ['Pass', 'Conditional Pass', 'Fail - CAR Required']);
    html += renderField('CARs Raised', 'weeklyWalkCARs', 'number', '0');
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Findings & Corrective Actions</label>';
    html += '<textarea id="weeklyWalkFindings" style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveWeeklyWalkthrough()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Walkthrough</button>';
    html += '</form></div>';
    return html;
  }

  function renderMonthlyReviewForm() {
    var formId = 'monthlyRevForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Monthly Facilities Review (§13.1/§13.2)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Review</button>';
    html += '<form id="' + formId + '" style="display: none;">';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Month', 'monthlyRevMonth', 'date', today().slice(0, 7) + '-01');
    html += renderField('Reviewer', 'monthlyRevReviewer', 'select', '', USERS);
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Facility Systems Review</h4>';
    var systemItems = ['HVAC Performance', 'Water System', 'Compressed Air', 'Electrical', 'Fire Protection', 'Security Systems', 'Waste Treatment'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    systemItems.forEach(function(item) {
      html += '<div><label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select id="monthlyRev_' + item.replace(/[^a-zA-Z]/g,'') + '" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>Satisfactory</option><option>Needs Attention</option><option>Deficient - CAR Required</option></select></div>';
    });
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Maintenance Program</h4>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Open Work Orders', 'monthlyRevOpenWO', 'number', '');
    html += renderField('Completed This Month', 'monthlyRevCompWO', 'number', '');
    html += renderField('Overdue Work Orders', 'monthlyRevOverdueWO', 'number', '');
    html += renderField('Preventive Maintenance %', 'monthlyRevPM', 'number', '');
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('Overall Rating', 'monthlyRevRating', 'select', '', ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unacceptable']);
    html += renderField('CARs Raised', 'monthlyRevCARs', 'number', '0');
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Summary & Action Items</label>';
    html += '<textarea id="monthlyRevSummary" style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveMonthlyReview()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Review</button>';
    html += '</form></div>';
    return html;
  }

  function renderMaintenanceRequestForm() {
    var formId = 'maintRequestForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Maintenance Work Request (§13.2)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Request</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'maintDate', 'date', today());
    html += renderField('Reported By', 'maintReportedBy', 'select', '', USERS);
    html += renderField('Area / Equipment', 'maintArea', 'text', '');
    html += renderField('Priority', 'maintPriority', 'select', '', ['Low', 'Medium', 'High', 'Critical - Food Safety Risk']);
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Issue Description</label>';
    html += '<textarea style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('Assigned To', 'maintAssignedTo', 'select', '', USERS);
    html += renderField('Target Date', 'maintTargetDate', 'date', '');
    html += renderField('Status', 'maintStatus', 'select', '', ['Open', 'In Progress', 'Complete', 'Deferred']);
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveMaintenance()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Request</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderFacilitiesRecordsTable(type) {
    var records = state.facilitiesLogs.filter(function(log) {
      return log.type === type;
    });
    var html = '<div style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead style="background: var(--bg2);">';
    html += '<tr>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Date</th>';
    if (type === 'dailyInspection') {
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Inspector</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Area</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Status</th>';
    } else {
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Area/Equip</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Priority</th>';
      html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Status</th>';
    }
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    records.forEach(function(rec) {
      html += '<tr style="border-bottom: 1px solid var(--bg3);">';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.date || '') + '</td>';
      if (type === 'dailyInspection') {
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.inspector || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.area || '') + '</td>';
        html += '<td style="padding: 10px; color: var(--tx3);">CHECKED</td>';
      } else {
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.area || '') + '</td>';
        var priorityColor = rec.priority === 'Critical - Food Safety Risk' ? 'var(--rd)' : (rec.priority === 'High' ? 'var(--or)' : 'var(--ac)');
        html += '<td style="padding: 10px;"><span style="background: ' + priorityColor + '; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">' + (rec.priority || '') + '</span></td>';
        html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.status || '') + '</td>';
      }
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  // ============================================================================
  // TAB 4: QUALITY LOGS (continued in next chunk)
  // ============================================================================
  function renderQualityTab() {
    var subTab = state.currentSubTab.quality || 'inProcess';
    var html = '<div style="padding: 20px;">';
    html += '<h2>Quality Logs</h2>';
    html += '<div style="border-bottom: 1px solid var(--bg3); margin-bottom: 20px;">';
    html += '<button class="tab-btn' + (subTab === 'inProcess' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchQualitySubTab(\'inProcess\')">In-Process Quality</button>';
    html += '<button class="tab-btn' + (subTab === 'holdTags' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchQualitySubTab(\'holdTags\')">Hold Tags</button>';
    html += '<button class="tab-btn' + (subTab === 'finishedRelease' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchQualitySubTab(\'finishedRelease\')">Finished Product Release</button>';
    html += '</div>';

    if (subTab === 'inProcess') {
      html += renderInProcessQualityForm();
      html += renderQualityRecordsTable('inProcess');
    } else if (subTab === 'holdTags') {
      html += renderHoldTagForm();
      html += renderHoldTagsDisplay();
    } else {
      html += renderFinishedProductForm();
      html += renderQualityRecordsTable('finishedRelease');
    }

    html += '</div>';
    return html;
  }

  function renderInProcessQualityForm() {
    var formId = 'inProcessForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">In-Process Quality Check (§2.4/§13.9)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Check</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'qcDate', 'date', today());
    html += renderField('Time', 'qcTime', 'time', '');
    html += renderField('Shift', 'qcShift', 'select', '', SHIFTS.map(function(s) { return s.value; }));
    html += renderField('Line', 'qcLine', 'select', '', LINES);
    html += renderField('Product Code', 'qcProduct', 'text', '');
    html += renderField('Lot #', 'qcLot', 'text', '');
    html += renderField('Job Order', 'qcJobOrder', 'text', '');
    html += renderField('Customer', 'qcCustomer', 'text', '');
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Dimensional (auto-highlight >5% variance)</h4>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">';
    html += '<div><label style="color: var(--tx3); font-size: 0.9em;">Width</label><input type="text" placeholder="Spec" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px; margin-bottom: 5px;"><input type="text" placeholder="Actual" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></div>';
    html += '<div><label style="color: var(--tx3); font-size: 0.9em;">Length</label><input type="text" placeholder="Spec" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px; margin-bottom: 5px;"><input type="text" placeholder="Actual" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></div>';
    html += '<div><label style="color: var(--tx3); font-size: 0.9em;">Thickness</label><input type="text" placeholder="Spec" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px; margin-bottom: 5px;"><input type="text" placeholder="Actual" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></div>';
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Quality Attributes</h4>';
    var qualityAttrs = ['Print Registration', 'Color Match', 'Seal Strength', 'Surface Cleanliness', 'Film Tension', 'Label Accuracy'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    qualityAttrs.forEach(function(attr) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + attr + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('Defects', 'qcDefects', 'select', '', ['None', 'Cosmetic', 'Dimensional', 'Print', 'Seal', 'Contamination', 'Multiple']);
    html += renderField('Sample Qty', 'qcSampleQty', 'number', '');
    html += renderField('Reject Qty', 'qcRejectQty', 'number', '');
    html += renderField('Disposition', 'qcDisposition', 'select', '', ['RELEASED', 'ON HOLD', 'REWORK', 'REJECTED']);
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Defect Description</label>';
    html += '<textarea style="width: 100%; min-height: 60px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveInProcessQuality()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Quality Check</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderHoldTagForm() {
    var formId = 'holdTagForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Issue Hold Tag (§2.5/§13.9)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--rd); color: #fff; border: none; border-radius: 4px; cursor: pointer;">+ NEW HOLD TAG</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="background: var(--rd); color: #fff; padding: 15px; margin-bottom: 20px; border-radius: 4px; font-weight: bold;">';
    html += 'HOLD TAG — Product must be physically tagged and segregated immediately!';
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Product Code', 'htProduct', 'text', '');
    html += renderField('Lot #', 'htLot', 'text', '');
    html += renderField('Qty on Hold', 'htQty', 'number', '');
    html += renderField('Unit', 'htUnit', 'select', '', ['rolls', 'pallets', 'cases', 'kg', 'sheets', 'reams']);
    html += renderField('Hold Type', 'htType', 'select', '', ['Quality', 'Food Safety', 'Traceability', 'CCP Deviation', 'Customer Complaint', 'Regulatory']);
    html += renderField('Risk Level', 'htRiskLevel', 'select', '', ['Low', 'Medium', 'High']);
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Reason for Hold</label>';
    html += '<textarea id="holdReason" style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Investigation Notes</label>';
    html += '<textarea style="width: 100%; min-height: 60px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveHoldTag()" style="margin-top: 20px; padding: 10px 20px; background: var(--rd); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Issue Hold Tag</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderHoldTagsDisplay() {
    var holdTags = state.qualityLogs.filter(function(log) {
      return log.type === 'holdTag' && log.status !== 'closed';
    });

    var html = '<div>';
    if (holdTags.length === 0) {
      html += '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; text-align: center; color: var(--gn);">';
      html += 'No active hold tags. All clear!';
      html += '</div>';
    } else {
      holdTags.forEach(function(tag) {
        html += '<div style="background: var(--bg2); border: 3px solid var(--rd); border-radius: var(--bdr); padding: 20px; margin-bottom: 15px;">';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">';
        html += '<div>';
        html += '<div style="color: var(--tx3); font-size: 0.9em;">Tag Number</div>';
        html += '<div style="color: var(--ac); font-size: 1.3em; font-weight: bold;">' + (tag.tagNum || 'N/A') + '</div>';
        html += '</div>';
        html += '<div>';
        html += '<div style="color: var(--tx3); font-size: 0.9em;">Issued</div>';
        html += '<div style="color: var(--tx); font-size: 1em;">' + (tag.date || '') + '</div>';
        html += '</div>';
        html += '<div>';
        html += '<div style="color: var(--tx3); font-size: 0.9em;">Product / Lot</div>';
        html += '<div style="color: var(--tx); font-size: 1em;">' + (tag.product || 'N/A') + ' / ' + (tag.lot || 'N/A') + '</div>';
        html += '</div>';
        html += '<div>';
        html += '<div style="color: var(--tx3); font-size: 0.9em;">Qty</div>';
        html += '<div style="color: var(--tx); font-size: 1em;">' + (tag.qty || 'N/A') + ' ' + (tag.unit || '') + '</div>';
        html += '</div>';
        html += '</div>';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
        html += '<div>';
        html += '<div style="color: var(--tx3); font-size: 0.9em; margin-bottom: 5px;">Risk Level</div>';
        var riskColor = tag.riskLevel === 'High' ? 'var(--rd)' : (tag.riskLevel === 'Medium' ? 'var(--or)' : 'var(--ac)');
        html += '<span style="background: ' + riskColor + '; color: #000; padding: 6px 12px; border-radius: 4px; font-weight: bold;">' + (tag.riskLevel || '') + '</span>';
        html += '</div>';
        html += '<div>';
        html += '<div style="color: var(--tx3); font-size: 0.9em; margin-bottom: 5px;">Type</div>';
        html += '<div style="color: var(--tx);">' + (tag.holdType || '') + '</div>';
        html += '</div>';
        html += '</div>';
        html += '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--bg3);">';
        html += '<div style="color: var(--tx3); font-size: 0.9em; margin-bottom: 5px;">Reason</div>';
        html += '<div style="color: var(--tx);">' + (tag.reason || '') + '</div>';
        html += '</div>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function renderFinishedProductForm() {
    var formId = 'finishedForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Finished Product Release (§13.9)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Release</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'fpDate', 'date', today());
    html += renderField('Product Code', 'fpProduct', 'text', '');
    html += renderField('Lot #', 'fpLot', 'text', '');
    html += renderField('Job Order', 'fpJobOrder', 'text', '');
    html += renderField('Qty', 'fpQty', 'number', '');
    html += renderField('Unit', 'fpUnit', 'select', '', ['rolls', 'cases', 'pallets', 'kg', 'sheets']);
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Release Criteria</h4>';
    var releaseCriteria = ['All CCP Records Complete', 'In-Process QC Passed', 'Label Accuracy Verified', 'Product Meets Spec', 'Packaging Integrity OK', 'Foreign Material Check', 'Traceability Records Complete'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    releaseCriteria.forEach(function(criterion) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + criterion + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>PASS</option><option>FAIL</option><option>N/A</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="margin-top: 20px;">';
    html += '<label style="color: var(--tx3);">Final Disposition</label>';
    html += '<select id="fpDisposition" style="width: 100%; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
    html += '<option>RELEASED</option><option>ON HOLD</option><option>REWORK</option><option>REJECTED</option>';
    html += '</select>';
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveFinishedProduct()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Release</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderQualityRecordsTable(type) {
    var records = state.qualityLogs.filter(function(log) {
      return log.type === type;
    });
    var html = '<div style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead style="background: var(--bg2);">';
    html += '<tr>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Date</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Product/Lot</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Line</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Result</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    records.forEach(function(rec) {
      html += '<tr style="border-bottom: 1px solid var(--bg3);">';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.date || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.product || rec.tagNum || 'N/A') + ' / ' + (rec.lot || 'N/A') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.line || 'N/A') + '</td>';
      var disp = rec.disposition || rec.pass || 'N/A';
      var dispColor = disp === 'RELEASED' || disp === 'PASS' ? 'var(--gn)' : 'var(--rd)';
      html += '<td style="padding: 10px;"><span style="background: ' + dispColor + '; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">' + disp + '</span></td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  // ============================================================================
  // TAB 5: MATERIALS & SUPPLIES (continued in next chunk)
  // ============================================================================
  function renderMaterialsTab() {
    var subTab = state.currentSubTab.materials || 'receiving';
    var html = '<div style="padding: 20px;">';
    html += '<h2>Materials & Supplies</h2>';
    html += '<div style="border-bottom: 1px solid var(--bg3); margin-bottom: 20px;">';
    html += '<button class="tab-btn' + (subTab === 'receiving' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchMaterialsSubTab(\'receiving\')">Receiving Log</button>';
    html += '<button class="tab-btn' + (subTab === 'inventory' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchMaterialsSubTab(\'inventory\')">Inventory Count</button>';
    html += '<button class="tab-btn' + (subTab === 'usage' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchMaterialsSubTab(\'usage\')">Material Usage / BOM</button>';
    html += '</div>';

    if (subTab === 'receiving') {
      html += renderReceivingKPIs();
      html += renderReceivingForm();
      html += renderReceivingRecordsTable();
    } else if (subTab === 'inventory') {
      html += renderInventoryCountForm();
      html += renderInventoryRecordsTable();
    } else {
      html += renderMaterialUsageForm();
      html += renderMaterialUsageTable();
    }

    html += '</div>';
    return html;
  }

  function renderReceivingKPIs() {
    var todayStr = today();
    var todayReceiving = state.materialsLogs.filter(function(log) {
      return log.type === 'receiving' && log.date && log.date.startsWith(todayStr);
    });
    var quarantine = state.materialsLogs.filter(function(log) {
      return log.type === 'receiving' && log.disposition === 'Quarantine';
    });
    var pendingCoA = state.materialsLogs.filter(function(log) {
      return log.type === 'receiving' && log.coA === 'Pending';
    });
    var usage = state.materialsLogs.filter(function(log) {
      return log.type === 'usage' && log.date && log.date.startsWith(todayStr);
    });

    var html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">';
    html += renderKPICard('Today\'s Receipts', todayReceiving.length.toString(), 'var(--ac)');
    html += renderKPICard('Quarantine Items', quarantine.length.toString(), quarantine.length > 0 ? 'var(--rd)' : 'var(--gn)');
    html += renderKPICard('Pending CoA', pendingCoA.length.toString(), pendingCoA.length > 0 ? 'var(--or)' : 'var(--gn)');
    html += renderKPICard('Usage Logs Today', usage.length.toString(), 'var(--ac)');
    html += '</div>';
    return html;
  }

  function renderReceivingForm() {
    var formId = 'receivingForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Receiving Log (§13.8)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Receipt</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'rcvDate', 'date', today());
    html += renderField('Time', 'rcvTime', 'time', '');
    html += renderField('Received By', 'rcvBy', 'select', '', USERS);
    html += renderField('Supplier', 'rcvSupplier', 'select', '', SUPPLIERS);
    html += renderField('PO Number', 'rcvPO', 'text', '');
    html += renderField('Material', 'rcvMaterial', 'select', '', MATERIALS);
    html += renderField('Supplier Lot #', 'rcvSupplierLot', 'text', '');
    html += renderField('Qty', 'rcvQty', 'number', '');
    html += renderField('Unit', 'rcvUnit', 'select', '', ['rolls', 'kg', 'L', 'cases', 'pallets', 'drums', 'bags']);
    html += renderField('Storage Location', 'rcvStorageLocation', 'text', '');
    html += '</div>';

    html += '<h4 style="color: var(--tx); margin-top: 20px;">Inspection Checklist</h4>';
    var inspItems = ['Vehicle Clean', 'Label Matches PO', 'Quantity Matches PO', 'Packaging Condition', 'No Pest Evidence', 'No Off-Odors'];
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    inspItems.forEach(function(item) {
      html += '<div>';
      html += '<label style="color: var(--tx3); font-size: 0.9em;">' + item + '</label>';
      html += '<select style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      html += '<option>YES</option><option>NO</option>';
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">';
    html += renderField('CoA', 'rcvCoA', 'select', '', ['Yes', 'Pending', 'Not Required', 'No']);
    html += renderField('Disposition', 'rcvDisposition', 'select', '', ['Approved', 'Quarantine', 'Rejected', 'Pending']);
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveReceiving()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Receipt</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderReceivingRecordsTable() {
    var records = state.materialsLogs.filter(function(log) {
      return log.type === 'receiving';
    });
    var html = '<div style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead style="background: var(--bg2);">';
    html += '<tr>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Date</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Supplier</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Material</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Qty</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Disposition</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">CoA</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    records.forEach(function(rec) {
      html += '<tr style="border-bottom: 1px solid var(--bg3);">';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.date || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.supplier || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.material || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.qty || '') + ' ' + (rec.unit || '') + '</td>';
      var dispColor = rec.disposition === 'Approved' ? 'var(--gn)' : (rec.disposition === 'Quarantine' ? 'var(--rd)' : 'var(--or)');
      html += '<td style="padding: 10px;"><span style="background: ' + dispColor + '; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">' + (rec.disposition || '') + '</span></td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.coA || '') + '</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  function renderInventoryCountForm() {
    var formId = 'inventoryForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Inventory Count</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ Count</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Material', 'invMaterial', 'select', '', MATERIALS);
    html += renderField('Location', 'invLocation', 'text', '');
    html += renderField('Expected Qty', 'invExpected', 'number', '');
    html += renderField('Counted Qty', 'invCounted', 'number', '');
    html += renderField('Variance Reason', 'invVarianceReason', 'text', '');
    html += renderField('Lot Numbers', 'invLotNumbers', 'text', '');
    html += renderField('Condition', 'invCondition', 'select', '', ['Good', 'Damaged', 'Expired', 'Degraded']);
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveInventory()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Count</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderInventoryRecordsTable() {
    var records = state.materialsLogs.filter(function(log) {
      return log.type === 'inventory';
    });
    var html = '<div style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead style="background: var(--bg2);">';
    html += '<tr>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Material</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Location</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Expected</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Counted</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Variance</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    records.forEach(function(rec) {
      var variance = calculateVariance(rec.expectedQty, rec.countedQty);
      html += '<tr style="border-bottom: 1px solid var(--bg3);">';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.material || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.location || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.expectedQty || 0) + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.countedQty || 0) + '</td>';
      var varStyle = variance !== 0 ? 'style="background: var(--rd); color: #fff;"' : '';
      html += '<td style="padding: 10px;" ' + varStyle + '>' + variance + '%</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  function renderMaterialUsageForm() {
    var formId = 'usageForm_' + uuid();
    var html = '<div style="background: var(--bg2); border-radius: var(--bdr); padding: 20px; margin-bottom: 20px;">';
    html += '<h3 style="color: var(--ac); margin-top: 0;">Material Usage / BOM Log (§2.6 Traceability)</h3>';
    html += '<button onclick="document.getElementById(\'' + formId + '\').style.display = document.getElementById(\'' + formId + '\').style.display === \'none\' ? \'block\' : \'none\';" style="margin-bottom: 15px; padding: 8px 15px; background: var(--ac); color: #000; border: none; border-radius: 4px; cursor: pointer;">+ New Usage</button>';
    html += '<form id="' + formId + '" style="display: none;">';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    html += renderField('Date', 'usageDate', 'date', today());
    html += renderField('Shift', 'usageShift', 'select', '', SHIFTS.map(function(s) { return s.value; }));
    html += renderField('Line', 'usageLine', 'select', '', LINES);
    html += renderField('Job Order', 'usageJobOrder', 'text', '');
    html += renderField('Material', 'usageMaterial', 'select', '', MATERIALS);
    html += renderField('Lot #', 'usageLot', 'text', '');
    html += renderField('Qty Used', 'usageQtyUsed', 'number', '');
    html += renderField('Waste Qty', 'usageWaste', 'number', '');
    html += renderField('Finished Product Code', 'usageProductCode', 'text', '');
    html += renderField('Finished Product Lot #', 'usageProductLot', 'text', '');
    html += '</div>';

    html += '<button type="button" onclick="window.SQF_VIEW.saveUsage()" style="margin-top: 20px; padding: 10px 20px; background: var(--gn); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Usage Log</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderMaterialUsageTable() {
    var records = state.materialsLogs.filter(function(log) {
      return log.type === 'usage';
    });
    var html = '<div style="overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead style="background: var(--bg2);">';
    html += '<tr>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Date</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Line</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Material</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Lot #</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Qty Used</th>';
    html += '<th style="padding: 10px; text-align: left; color: var(--tx); border-bottom: 2px solid var(--bg3);">Finished Lot</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    records.forEach(function(rec) {
      html += '<tr style="border-bottom: 1px solid var(--bg3);">';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.date || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.line || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.material || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.lot || '') + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.qtyUsed || 0) + '</td>';
      html += '<td style="padding: 10px; color: var(--tx3);">' + (rec.productLot || '') + '</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  // ============================================================================
  // PRINT FUNCTION
  // ============================================================================
  function printSQFLog(title, rows) {
    var win = window.open('', 'printWindow', 'width=900,height=600');
    var html = '<html><head><title>' + esc(title) + '</title>';
    html += '<style>';
    html += 'body { font-family: Arial, sans-serif; margin: 20px; background: #fff; color: #333; }';
    html += 'h1 { color: #00e5ff; text-align: center; border-bottom: 3px solid #00e5ff; padding-bottom: 10px; }';
    html += 'table { width: 100%; border-collapse: collapse; margin: 20px 0; }';
    html += 'th { background: #1a1a2e; color: #00e5ff; padding: 10px; text-align: left; font-weight: bold; }';
    html += 'td { padding: 10px; border-bottom: 1px solid #ddd; }';
    html += 'tr:nth-child(even) { background: #f9f9f9; }';
    html += '.signature-line { margin: 40px 0; display: inline-block; width: 250px; border-top: 1px solid #333; padding-top: 5px; }';
    html += '</style>';
    html += '</head><body>';
    html += '<h1>SQF Data Log — ' + esc(title) + '</h1>';
    html += '<table>';
    html += '<thead><tr>';
    if (rows && rows.length > 0) {
      Object.keys(rows[0]).forEach(function(key) {
        html += '<th>' + esc(key) + '</th>';
      });
    }
    html += '</tr></thead>';
    html += '<tbody>';
    if (rows && rows.length > 0) {
      rows.forEach(function(row) {
        html += '<tr>';
        Object.values(row).forEach(function(val) {
          html += '<td>' + esc(val || '') + '</td>';
        });
        html += '</tr>';
      });
    }
    html += '</tbody>';
    html += '</table>';
    html += '<div style="margin-top: 40px;">';
    html += '<div class="signature-line">Completed By: ________________</div>';
    html += '<div class="signature-line" style="margin-left: 100px;">Verified By: ________________</div>';
    html += '</div>';
    html += '<div style="margin-top: 40px; font-size: 0.8em; color: #999;">';
    html += 'Printed on ' + new Date().toLocaleString() + ' | SQF Ed.10 Compliance Data Logs';
    html += '</div>';
    html += '</body></html>';
    win.document.write(html);
    win.document.close();
  }

  // ============================================================================
  // FORM HELPER
  // ============================================================================
  function renderField(label, id, type, value, options) {
    var html = '<div>';
    html += '<label for="' + id + '" style="display: block; color: var(--tx3); font-size: 0.9em; margin-bottom: 5px;">' + label + '</label>';
    if (type === 'select') {
      html += '<select id="' + id + '" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;">';
      if (options) {
        options.forEach(function(opt) {
          html += '<option value="' + opt + '">' + opt + '</option>';
        });
      }
      html += '</select>';
    } else if (type === 'textarea') {
      html += '<textarea id="' + id + '" style="width: 100%; min-height: 80px; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px;"></textarea>';
    } else {
      html += '<input type="' + type + '" id="' + id + '" value="' + (value || '') + '" style="width: 100%; padding: 6px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 4px; box-sizing: border-box;">';
    }
    html += '</div>';
    return html;
  }

  // ============================================================================
  // RENDER MAIN VIEW
  // ============================================================================
  function render() {
    var container = document.getElementById('sqf-datalogs-container');
    if (!container) return;

    var html = '<div style="background: var(--bg); color: var(--tx); min-height: 100vh; padding: 0;">';
    html += '<div style="border-bottom: 1px solid var(--bg3); background: var(--bg2); position: sticky; top: 0; z-index: 100;">';
    html += '<div style="padding: 20px; border-bottom: 1px solid var(--bg3); display: flex; gap: 15px;">';
    html += '<button class="tab-btn' + (state.currentTab === 'overview' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchTab(\'overview\')" style="padding: 10px 20px; background: ' + (state.currentTab === 'overview' ? 'var(--ac)' : 'transparent') + '; color: ' + (state.currentTab === 'overview' ? '#000' : 'var(--tx)') + '; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Overview</button>';
    html += '<button class="tab-btn' + (state.currentTab === 'sanitation' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchTab(\'sanitation\')" style="padding: 10px 20px; background: ' + (state.currentTab === 'sanitation' ? 'var(--ac)' : 'transparent') + '; color: ' + (state.currentTab === 'sanitation' ? '#000' : 'var(--tx)') + '; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Sanitation</button>';
    html += '<button class="tab-btn' + (state.currentTab === 'facilities' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchTab(\'facilities\')" style="padding: 10px 20px; background: ' + (state.currentTab === 'facilities' ? 'var(--ac)' : 'transparent') + '; color: ' + (state.currentTab === 'facilities' ? '#000' : 'var(--tx)') + '; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Facilities</button>';
    html += '<button class="tab-btn' + (state.currentTab === 'quality' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchTab(\'quality\')" style="padding: 10px 20px; background: ' + (state.currentTab === 'quality' ? 'var(--ac)' : 'transparent') + '; color: ' + (state.currentTab === 'quality' ? '#000' : 'var(--tx)') + '; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Quality</button>';
    html += '<button class="tab-btn' + (state.currentTab === 'materials' ? ' active' : '') + '" onclick="window.SQF_VIEW.switchTab(\'materials\')" style="padding: 10px 20px; background: ' + (state.currentTab === 'materials' ? 'var(--ac)' : 'transparent') + '; color: ' + (state.currentTab === 'materials' ? '#000' : 'var(--tx)') + '; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Materials</button>';
    html += '</div>';
    html += '</div>';

    var contentHtml = '';
    if (state.currentTab === 'overview') {
      contentHtml = renderOverviewTab();
    } else if (state.currentTab === 'sanitation') {
      contentHtml = renderSanitationTab();
    } else if (state.currentTab === 'facilities') {
      contentHtml = renderFacilitiesTab();
    } else if (state.currentTab === 'quality') {
      contentHtml = renderQualityTab();
    } else if (state.currentTab === 'materials') {
      contentHtml = renderMaterialsTab();
    }

    html += contentHtml;
    html += '</div>';
    container.innerHTML = html;
  }

  // ============================================================================
  // SAVE HANDLERS
  // ============================================================================
  function getFormData(formId) {
    var form = document.getElementById(formId);
    if (!form) return {};
    var formData = new FormData(form);
    var data = {};
    formData.forEach(function(value, key) {
      data[key] = value;
    });
    return data;
  }

  function saveToFirestore(collection, data) {
    data.id = uuid();
    data.timestamp = new Date().toISOString();
    return db.collection(collection).add(data).then(function() {
      toast('Record saved successfully', 'success');
    }).catch(function(err) {
      console.error('Save error:', err);
      toast('Error saving record', 'error');
    });
  }

  // ============================================================================
  // TAB SWITCHING
  // ============================================================================
  function switchTab(tab) {
    state.currentTab = tab;
    render();
  }

  function switchSanitationSubTab(subTab) {
    if (!state.currentSubTab.sanitation) state.currentSubTab.sanitation = {};
    state.currentSubTab.sanitation = subTab;
    render();
  }

  function switchFacilitiesSubTab(subTab) {
    if (!state.currentSubTab.facilities) state.currentSubTab.facilities = {};
    state.currentSubTab.facilities = subTab;
    render();
  }

  function switchQualitySubTab(subTab) {
    if (!state.currentSubTab.quality) state.currentSubTab.quality = {};
    state.currentSubTab.quality = subTab;
    render();
  }

  function switchMaterialsSubTab(subTab) {
    if (!state.currentSubTab.materials) state.currentSubTab.materials = {};
    state.currentSubTab.materials = subTab;
    render();
  }

  // ============================================================================
  // DATA SAVE FUNCTIONS
  // ============================================================================
  function savePreOpDaily() {
    var preOpDate = document.getElementById('preOpDate')?.value || today();
    var preOpLine = document.getElementById('preOpLine')?.value || '';
    var preOpShift = document.getElementById('preOpShift')?.value || '';
    var lineRelease = document.getElementById('preOpLineRelease')?.value || 'HELD';

    var data = {
      type: 'preOpDaily',
      date: preOpDate,
      line: preOpLine,
      shift: preOpShift,
      completedBy: document.getElementById('preOpCompletedBy')?.value || '',
      verifiedBy: document.getElementById('preOpVerifiedBy')?.value || '',
      lineRelease: lineRelease,
      atp: document.getElementById('preOpATP')?.value || ''
    };

    saveToFirestore('sqfSanitation', data);

    if (lineRelease === 'HELD') {
      emitEvent('sqf.sanitation.fail', {
        line: preOpLine,
        date: preOpDate,
        deficiencies: document.querySelector('textarea[placeholder*="Deficiencies"]')?.value || ''
      });
    }

    closeModal();
    render();
  }

  function saveDeepClean() {
    var zone = document.getElementById('deepCleanZone')?.value || '';
    var data = {
      type: 'deepClean',
      date: document.getElementById('deepCleanDate')?.value || today(),
      zone: zone,
      completedBy: document.getElementById('deepCleanBy')?.value || '',
      pass: document.getElementById('deepCleanPass')?.value || 'FAIL'
    };

    saveToFirestore('sqfSanitation', data);
    render();
  }

  function saveMonthly() {
    var data = {
      type: 'monthly',
      date: document.getElementById('monthlyDate')?.value || today(),
      inspector: document.getElementById('monthlyInspector')?.value || ''
    };

    saveToFirestore('sqfSanitation', data);
    render();
  }

  function saveDailyInspection() {
    var area = document.getElementById('dailyInspArea')?.value || '';
    var priority = document.getElementById('dailyInspPriority')?.value || 'None';
    var maint = document.getElementById('dailyInspMaint')?.value || 'No';

    var data = {
      type: 'dailyInspection',
      date: document.getElementById('dailyInspDate')?.value || today(),
      shift: document.getElementById('dailyInspShift')?.value || '',
      inspector: document.getElementById('dailyInspInspector')?.value || '',
      area: area,
      temp: document.getElementById('dailyInspTemp')?.value || '',
      humidity: document.getElementById('dailyInspHumidity')?.value || '',
      priority: priority
    };

    saveToFirestore('sqfFacilities', data);

    if (priority === 'Critical - IMMEDIATE') {
      emitEvent('sqf.maintenance.critical', {
        area: area,
        issue: document.querySelector('textarea')?.value || ''
      });
    }

    render();
  }

  function saveMaintenance() {
    var priority = document.getElementById('maintPriority')?.value || 'Low';
    var area = document.getElementById('maintArea')?.value || '';
    var wo = generateWorkOrderNumber();

    var data = {
      type: 'maintenance',
      date: document.getElementById('maintDate')?.value || today(),
      reportedBy: document.getElementById('maintReportedBy')?.value || '',
      area: area,
      priority: priority,
      status: document.getElementById('maintStatus')?.value || 'Open',
      workOrder: wo
    };

    saveToFirestore('sqfFacilities', data);

    if (priority === 'Critical - Food Safety Risk') {
      emitEvent('sqf.maintenance.critical', {
        area: area,
        issue: document.querySelector('textarea')?.value || ''
      });
    }

    render();
  }

  function saveWeeklyWalkthrough() {
    var status = document.getElementById('weeklyWalkStatus')?.value || 'Pass';
    var data = {
      type: 'weeklyWalkthrough',
      date: document.getElementById('weeklyWalkDate')?.value || today(),
      inspector: document.getElementById('weeklyWalkInspector')?.value || '',
      accompanyingStaff: document.getElementById('weeklyWalkStaff')?.value || '',
      weekNumber: document.getElementById('weeklyWalkWeek')?.value || '',
      overallStatus: status,
      carsRaised: document.getElementById('weeklyWalkCARs')?.value || '0',
      findings: document.getElementById('weeklyWalkFindings')?.value || ''
    };
    saveToFirestore('sqfFacilities', data);
    if (status === 'Fail - CAR Required') {
      emitEvent('sqf.walkthrough.fail', { inspector: data.inspector, findings: data.findings });
    }
    render();
  }

  function saveMonthlyReview() {
    var rating = document.getElementById('monthlyRevRating')?.value || 'Satisfactory';
    var data = {
      type: 'monthlyReview',
      date: document.getElementById('monthlyRevMonth')?.value || today(),
      reviewer: document.getElementById('monthlyRevReviewer')?.value || '',
      openWorkOrders: document.getElementById('monthlyRevOpenWO')?.value || '',
      completedWorkOrders: document.getElementById('monthlyRevCompWO')?.value || '',
      overdueWorkOrders: document.getElementById('monthlyRevOverdueWO')?.value || '',
      preventiveMaintenancePct: document.getElementById('monthlyRevPM')?.value || '',
      overallRating: rating,
      carsRaised: document.getElementById('monthlyRevCARs')?.value || '0',
      summary: document.getElementById('monthlyRevSummary')?.value || ''
    };
    saveToFirestore('sqfFacilities', data);
    if (rating === 'Unacceptable') {
      emitEvent('sqf.facilities.unacceptable', { reviewer: data.reviewer, summary: data.summary });
    }
    render();
  }

  function saveInProcessQuality() {
    var product = document.getElementById('qcProduct')?.value || '';
    var lot = document.getElementById('qcLot')?.value || '';
    var line = document.getElementById('qcLine')?.value || '';

    var data = {
      type: 'inProcess',
      date: document.getElementById('qcDate')?.value || today(),
      time: document.getElementById('qcTime')?.value || '',
      shift: document.getElementById('qcShift')?.value || '',
      line: line,
      product: product,
      lot: lot,
      jobOrder: document.getElementById('qcJobOrder')?.value || '',
      customer: document.getElementById('qcCustomer')?.value || '',
      disposition: document.getElementById('qcDisposition')?.value || 'RELEASED'
    };

    saveToFirestore('sqfQuality', data);

    if (data.disposition && data.disposition !== 'RELEASED') {
      emitEvent('sqf.quality.reject', {
        product: product,
        lot: lot,
        line: line,
        disposition: data.disposition
      });
    }

    render();
  }

  function saveHoldTag() {
    var tagNum = generateHoldTagNumber();
    var product = document.getElementById('htProduct')?.value || '';
    var lot = document.getElementById('htLot')?.value || '';
    var riskLevel = document.getElementById('htRiskLevel')?.value || 'Medium';

    var data = {
      type: 'holdTag',
      tagNum: tagNum,
      date: new Date().toISOString(),
      product: product,
      lot: lot,
      qty: document.getElementById('htQty')?.value || '',
      unit: document.getElementById('htUnit')?.value || '',
      holdType: document.getElementById('htType')?.value || '',
      riskLevel: riskLevel,
      reason: (document.getElementById('holdReason') || {}).value || '',
      status: 'open'
    };

    saveToFirestore('sqfQuality', data);

    emitEvent('sqf.holdTag.issued', {
      tagNum: tagNum,
      product: product,
      lot: lot,
      risk: riskLevel
    });

    toast('HOLD TAG ISSUED: ' + tagNum, 'warn');
    render();
  }

  function saveFinishedProduct() {
    var data = {
      type: 'finishedRelease',
      date: document.getElementById('fpDate')?.value || today(),
      product: document.getElementById('fpProduct')?.value || '',
      lot: document.getElementById('fpLot')?.value || '',
      jobOrder: document.getElementById('fpJobOrder')?.value || '',
      qty: document.getElementById('fpQty')?.value || '',
      unit: document.getElementById('fpUnit')?.value || '',
      disposition: document.getElementById('fpDisposition')?.value || 'RELEASED'
    };

    saveToFirestore('sqfQuality', data);
    render();
  }

  function saveReceiving() {
    var material = document.getElementById('rcvMaterial')?.value || '';
    var supplier = document.getElementById('rcvSupplier')?.value || '';
    var disposition = document.getElementById('rcvDisposition')?.value || 'Pending';

    var data = {
      type: 'receiving',
      date: document.getElementById('rcvDate')?.value || today(),
      time: document.getElementById('rcvTime')?.value || '',
      receivedBy: document.getElementById('rcvBy')?.value || '',
      supplier: supplier,
      poNumber: document.getElementById('rcvPO')?.value || '',
      material: material,
      supplierLot: document.getElementById('rcvSupplierLot')?.value || '',
      qty: document.getElementById('rcvQty')?.value || '',
      unit: document.getElementById('rcvUnit')?.value || '',
      storageLocation: document.getElementById('rcvStorageLocation')?.value || '',
      coA: document.getElementById('rcvCoA')?.value || '',
      disposition: disposition
    };

    saveToFirestore('sqfMaterials', data);

    if (disposition === 'Quarantine') {
      emitEvent('sqf.quarantine', {
        material: material,
        supplier: supplier,
        lot: document.getElementById('rcvSupplierLot')?.value || ''
      });
    }

    render();
  }

  function saveInventory() {
    var data = {
      type: 'inventory',
      date: new Date().toISOString(),
      material: document.getElementById('invMaterial')?.value || '',
      location: document.getElementById('invLocation')?.value || '',
      expectedQty: parseFloat(document.getElementById('invExpected')?.value || 0),
      countedQty: parseFloat(document.getElementById('invCounted')?.value || 0),
      variance: calculateVariance(parseFloat(document.getElementById('invExpected')?.value || 0), parseFloat(document.getElementById('invCounted')?.value || 0))
    };

    saveToFirestore('sqfMaterials', data);
    render();
  }

  function saveUsage() {
    var material = document.getElementById('usageMaterial')?.value || '';
    var lot = document.getElementById('usageLot')?.value || '';

    var data = {
      type: 'usage',
      date: document.getElementById('usageDate')?.value || today(),
      shift: document.getElementById('usageShift')?.value || '',
      line: document.getElementById('usageLine')?.value || '',
      jobOrder: document.getElementById('usageJobOrder')?.value || '',
      material: material,
      lot: lot,
      qtyUsed: parseFloat(document.getElementById('usageQtyUsed')?.value || 0),
      waste: parseFloat(document.getElementById('usageWaste')?.value || 0),
      productCode: document.getElementById('usageProductCode')?.value || '',
      productLot: document.getElementById('usageProductLot')?.value || ''
    };

    saveToFirestore('sqfMaterials', data);
    render();
  }

  // ============================================================================
  // TRIGGERS
  // ============================================================================
  window.SQF_TRIGGERS = {
    getAlertCount: function() {
      return state.alertCount;
    },
    getOpenHolds: function() {
      return state.qualityLogs.filter(function(log) {
        return log.type === 'holdTag' && log.status !== 'closed';
      });
    },
    getQuarantineItems: function() {
      return state.materialsLogs.filter(function(log) {
        return log.type === 'receiving' && log.disposition === 'Quarantine';
      });
    },
    getCriticalMaintenance: function() {
      return state.facilitiesLogs.filter(function(log) {
        return log.type === 'maintenance' && log.priority === 'Critical - Food Safety Risk' && log.status !== 'Complete';
      });
    },
    getTodaySanitation: function() {
      var todayStr = today();
      return state.sanitationLogs.filter(function(log) {
        return log.date && log.date.startsWith(todayStr);
      });
    },
    isLineClear: function(lineId) {
      var latest = state.sanitationLogs.filter(function(log) {
        return log.type === 'preOpDaily' && log.line === lineId;
      }).sort(function(a, b) {
        return (b.date || '').localeCompare(a.date || '');
      })[0];
      return latest ? latest.lineRelease === 'RELEASED' : false;
    },
    getMaterialTraceability: function(lotNum) {
      var receiving = state.materialsLogs.filter(function(log) {
        return log.type === 'receiving' && log.supplierLot === lotNum;
      });
      var usage = state.materialsLogs.filter(function(log) {
        return log.type === 'usage' && log.lot === lotNum;
      });
      var finished = state.qualityLogs.filter(function(log) {
        return log.productLot === lotNum;
      });
      return { receiving: receiving, usage: usage, finished: finished };
    }
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  window.SQF_VIEW = {
    switchTab: switchTab,
    switchSanitationSubTab: switchSanitationSubTab,
    switchFacilitiesSubTab: switchFacilitiesSubTab,
    switchQualitySubTab: switchQualitySubTab,
    switchMaterialsSubTab: switchMaterialsSubTab,
    savePreOpDaily: savePreOpDaily,
    saveDeepClean: saveDeepClean,
    saveMonthly: saveMonthly,
    saveDailyInspection: saveDailyInspection,
    saveWeeklyWalkthrough: saveWeeklyWalkthrough,
    saveMonthlyReview: saveMonthlyReview,
    saveMaintenance: saveMaintenance,
    saveInProcessQuality: saveInProcessQuality,
    saveHoldTag: saveHoldTag,
    saveFinishedProduct: saveFinishedProduct,
    saveReceiving: saveReceiving,
    saveInventory: saveInventory,
    saveUsage: saveUsage,
    printSQFLog: printSQFLog
  };

  window.SQF_ALERT_COUNT = 0;

  loadData();
  // Don't render on startup — render when user navigates to sqfdatalogs view

  // Register with MFX renderer system
  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_RENDERERS.sqfdatalogs = renderSQFDataLogs;

  function renderSQFDataLogs() {
    var el = document.getElementById('v-sqfdatalogs');
    if (!el) return;
    el.id = 'v-sqfdatalogs';
    // Create or reuse the inner container
    var inner = document.getElementById('sqf-datalogs-container');
    if (!inner) {
      inner = document.createElement('div');
      inner.id = 'sqf-datalogs-container';
      inner.style.cssText = 'height:100%;overflow-y:auto';
      el.innerHTML = '';
      el.appendChild(inner);
    }
    render();
  }

})();
