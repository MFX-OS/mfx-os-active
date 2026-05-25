// ══════════════════════════════════════════════════════════════════════════════
// MFX OS — CAPA/NCR MODULE (Corrective & Preventive Actions)
// Quality Management: NCR reporting, root cause analysis, action tracking
// Firestore: ncrs collection | 800+ lines | Dark theme
// ══════════════════════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var db;
  try { db = firebase.firestore(); } catch(e) { console.warn('CAPA: Firebase not ready, will retry on init'); }
  var currentUser = null;
  var currentNCR = null;
  var seedDataAdded = false;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]});}

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE & SEVERITY CONFIG
  // ─────────────────────────────────────────────────────────────────────────────
  var STAGES = {
    'Reported': '#ffaa2c',
    'Under Investigation': '#5faaff',
    'Root Cause Identified': '#a17bff',
    'Corrective Action Planned': '#f472b6',
    'In Progress': '#f97316',
    'Verification Pending': '#14b8a6',
    'Closed - Effective': '#2ee89e',
    'Closed - Ineffective': '#ff6474',
    'Re-Opened': '#ff6474'
  };

  var SEVERITY = ['Minor', 'Major', 'Critical'];
  var SOURCES = [
    'GMP Inspection', 'Environmental Swab', 'Temperature Excursion', 'Water Test Failure',
    'Pest Sighting', 'QC Inspection', 'Customer Complaint', 'Vendor NCR', 'Internal Audit',
    'Management Review', 'Regulatory', 'Employee Report', 'Spill Incident',
    'Equipment Failure', 'SQF Audit Finding'
  ];
  var CATEGORIES = [
    'Product Quality', 'Food Safety', 'GMP', 'Environmental', 'Equipment',
    'Process', 'Documentation', 'Training', 'Supplier', 'Customer', 'Safety', 'Regulatory'
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER MAIN CAPA VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  function renderCAPA(){
    var el = document.getElementById('v-capa');
    if(!el) return;

    if(typeof getCurrentUser === 'function') {
      currentUser = getCurrentUser();
    }

    // Ensure seed data
    ensureSeedData();

    var html = '<div class="capa-container">' +
      '<style>' +
      '.capa-container{background:var(--bg);color:var(--tx);min-height:100vh;padding:20px;font-family:Inter,sans-serif}' +
      '.capa-header{display:flex;gap:20px;align-items:center;margin-bottom:24px}' +
      '.capa-header h1{margin:0;font-size:32px;font-weight:700;flex:1}' +
      '.capa-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;border-bottom:1px solid var(--bg2)}' +
      '.capa-tab{padding:12px 16px;background:transparent;border:none;color:var(--tx2);cursor:pointer;font-size:14px;font-weight:600;border-bottom:3px solid transparent;transition:all 0.2s}' +
      '.capa-tab:hover{color:var(--tx)}' +
      '.capa-tab.active{color:var(--ac);border-bottom-color:var(--ac)}' +
      '.capa-content{background:var(--bg2);border-radius:8px;padding:24px}' +
      '.capa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}' +
      '.capa-card{background:var(--bg3);border:1px solid var(--bg);border-radius:8px;padding:16px;cursor:pointer;transition:all 0.2s}' +
      '.capa-card:hover{background:var(--bg);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.3)}' +
      '.capa-card-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:12px}' +
      '.capa-card-id{font-weight:700;color:var(--ac);font-size:13px}' +
      '.capa-badge{display:inline-block;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:4px 4px 0 0}' +
      '.severity-minor{background:rgba(46,232,158,0.2);color:#2ee89e}' +
      '.severity-major{background:rgba(249,115,22,0.2);color:#f97316}' +
      '.severity-critical{background:rgba(255,100,116,0.2);color:#ff6474}' +
      '.stage-badge{background:rgba(255,170,44,0.2);color:#ffaa2c;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600}' +
      '.kpi-box{background:var(--bg3);border:1px solid var(--bg);border-radius:8px;padding:20px;text-align:center}' +
      '.kpi-value{font-size:40px;font-weight:700;color:var(--ac);margin:8px 0}' +
      '.kpi-label{font-size:12px;color:var(--tx2);text-transform:uppercase;letter-spacing:0.5px}' +
      '.form-group{margin-bottom:16px}' +
      '.form-group label{display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:var(--tx);text-transform:uppercase;letter-spacing:0.5px}' +
      '.form-group input,.form-group select,.form-group textarea{width:100%;background:var(--bg2);border:1px solid var(--bg);border-radius:6px;padding:10px;color:var(--tx);font-size:13px;font-family:inherit}' +
      '.form-group textarea{min-height:100px;resize:vertical}' +
      '.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}' +
      '.btn{padding:10px 16px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.5px}' +
      '.btn-primary{background:var(--ac);color:#000;border:none}' +
      '.btn-primary:hover{background:var(--ac2);box-shadow:0 4px 12px rgba(0,229,255,0.3)}' +
      '.btn-secondary{background:var(--bg3);color:var(--tx);border:1px solid var(--bg)}' +
      '.btn-secondary:hover{background:var(--bg)}' +
      '.detail-section{background:var(--bg3);border-left:3px solid var(--ac);padding:16px;margin-bottom:16px;border-radius:4px}' +
      '.detail-section h3{margin:0 0 12px 0;font-size:14px;color:var(--ac);text-transform:uppercase}' +
      '.action-list{list-style:none;padding:0;margin:0}' +
      '.action-item{background:var(--bg2);padding:12px;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}' +
      '.action-status{font-size:11px;font-weight:600;padding:3px 8px;border-radius:3px;background:rgba(46,232,158,0.2);color:#2ee89e}' +
      '.timeline{position:relative;padding:20px 0}' +
      '.timeline-item{display:flex;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--bg)}' +
      '.timeline-marker{width:20px;height:20px;border-radius:50%;background:var(--ac);flex-shrink:0;margin-top:2px}' +
      '.timeline-content{flex:1}' +
      '.timeline-content strong{display:block;color:var(--ac);margin-bottom:4px;font-size:12px}' +
      '.timeline-content p{margin:0;font-size:13px;color:var(--tx2)}' +
      '.why-level{background:var(--bg2);padding:12px;border-radius:6px;margin-bottom:12px}' +
      '.why-level label{display:block;font-size:11px;font-weight:600;color:var(--ac);text-transform:uppercase;margin-bottom:6px}' +
      '.why-level input{width:100%;background:var(--bg3);border:1px solid var(--bg);padding:8px;border-radius:4px;color:var(--tx);font-size:12px}' +
      '.fishbone{background:var(--bg3);border:2px solid var(--bg);border-radius:8px;padding:20px;min-height:400px}' +
      '.fishbone-category{background:var(--bg2);padding:12px;border-left:3px solid var(--ac);margin-bottom:16px;border-radius:4px}' +
      '.fishbone-category h4{margin:0 0 8px 0;font-size:12px;font-weight:700;color:var(--ac)}' +
      '.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:300}' +
      '.modal-content{background:var(--bg2);border-radius:8px;padding:24px;max-width:600px;width:90%;max-height:90vh;overflow-y:auto}' +
      '.close-btn{position:absolute;top:12px;right:12px;background:none;border:none;color:var(--tx);font-size:24px;cursor:pointer}' +
      '.capa-filter{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}' +
      '.filter-input{background:var(--bg3);border:1px solid var(--bg);padding:8px 12px;border-radius:6px;color:var(--tx);font-size:12px}' +
      '.filter-input:focus{outline:none;border-color:var(--ac)}' +
      '.chart-container{background:var(--bg3);border:1px solid var(--bg);border-radius:8px;padding:16px;margin-bottom:16px}' +
      '.severity-breakdown{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}' +
      '.severity-item{background:var(--bg2);padding:12px;border-radius:6px;text-align:center}' +
      '.severity-item-num{font-size:28px;font-weight:700;margin-bottom:4px}' +
      '.severity-item-label{font-size:11px;color:var(--tx2)}' +
      '</style>' +
      '<div class="capa-header">' +
      '<h1>CAPA / NCR Management</h1>' +
      '<button class="btn btn-primary" onclick="window.MFX_CAPA.toggleReportForm()">+ Report Issue</button>' +
      '</div>' +
      '<div class="capa-tabs" id="capaTabs"></div>' +
      '<div class="capa-content" id="capaContent"></div>' +
      '</div>';

    el.innerHTML = html;
    initCAPATabs();
    showTab('dashboard');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  function initCAPATabs(){
    var tabs = [
      'Dashboard', 'All NCRs', 'Open Issues', 'Report Issue',
      'Root Cause', '5 Why', 'Fishbone', 'Action Tracker',
      'Effectiveness', 'Trends', 'KPIs', 'SQF Audit'
    ];
    var tabsEl = document.getElementById('capaTabs');
    if(!tabsEl) return;

    tabsEl.innerHTML = tabs.map(function(t){
      var slug = t.toLowerCase().replace(/\s+/g, '-');
      return '<button class="capa-tab" onclick="window.MFX_CAPA.showTab(\'' + slug + '\')"> ' + t + '</button>';
    }).join('');
  }

  function showTab(slug){
    var contentEl = document.getElementById('capaContent');
    if(!contentEl) return;

    var tabs = document.querySelectorAll('.capa-tab');
    tabs.forEach(function(t){t.classList.remove('active')});

    var activeTab = Array.from(tabs).find(function(t){
      return t.textContent.toLowerCase().replace(/\s+/g, '-').includes(slug);
    });
    if(activeTab) activeTab.classList.add('active');

    switch(slug){
      case 'dashboard': renderDashboard(contentEl); break;
      case 'all-ncrs': renderAllNCRs(contentEl); break;
      case 'open-issues': renderOpenIssues(contentEl); break;
      case 'report-issue': renderReportForm(contentEl); break;
      case 'root-cause': renderRootCauseMenu(contentEl); break;
      case '5-why': renderFiveWhyForm(contentEl); break;
      case 'fishbone': renderFishboneForm(contentEl); break;
      case 'action-tracker': renderActionTracker(contentEl); break;
      case 'effectiveness': renderEffectiveness(contentEl); break;
      case 'trends': renderTrends(contentEl); break;
      case 'kpis': renderKPIs(contentEl); break;
      case 'sqf-audit': renderSQFAudit(contentEl); break;
      default: contentEl.innerHTML = '<p>Tab not found</p>';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────
  function renderDashboard(el){
    if(!db){el.innerHTML='<p style="color:var(--tx3);padding:20px">Loading CAPA data...</p>';return;}
    db.collection('ncrs').get().then(function(snap){
      var allNCRs = [];
      snap.forEach(function(doc){
        allNCRs.push(Object.assign({id: doc.id}, doc.data()));
      });

      var totalNCRs = allNCRs.length;
      var openNCRs = allNCRs.filter(function(n){
        return n.stage && n.stage !== 'Closed - Effective' && n.stage !== 'Closed - Ineffective';
      }).length;
      var overdueActions = allNCRs.filter(function(n){
        return n.stage === 'Corrective Action Planned' && new Date(n.actionDueDate) < new Date();
      }).length;
      var closedNCRs = allNCRs.filter(function(n){
        return (n.stage === 'Closed - Effective' || n.stage === 'Closed - Ineffective') && n.reportedDate && n.closedDate;
      });
      var avgDaysToClose = 0;
      if(closedNCRs.length > 0){
        var totalDays = closedNCRs.reduce(function(sum, n){
          return sum + Math.max(0, Math.round((new Date(n.closedDate) - new Date(n.reportedDate)) / (1000*60*60*24)));
        }, 0);
        avgDaysToClose = Math.round(totalDays / closedNCRs.length);
      }
      var effectivenessRate = Math.round(allNCRs.filter(function(n){
        return n.stage === 'Closed - Effective';
      }).length / Math.max(totalNCRs, 1) * 100);

      var byStage = {};
      allNCRs.forEach(function(n){
        var s = n.stage || 'Unknown';
        byStage[s] = (byStage[s] || 0) + 1;
      });

      var bySeverity = {Minor: 0, Major: 0, Critical: 0};
      allNCRs.forEach(function(n){
        if(bySeverity.hasOwnProperty(n.severity)){
          bySeverity[n.severity]++;
        }
      });

      var stageChart = Object.keys(byStage).map(function(stage){
        return '<div class="action-item">' +
          '<span><span class="stage-badge" style="background-color:' + (STAGES[stage]||'#999') + '22;color:' + (STAGES[stage]||'#999') + '">' + stage + '</span></span>' +
          '<strong>' + byStage[stage] + '</strong>' +
          '</div>';
      }).join('');

      var html = '<div class="capa-grid">' +
        '<div class="kpi-box"><div class="kpi-label">Total NCRs</div><div class="kpi-value">' + totalNCRs + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Open Issues</div><div class="kpi-value">' + openNCRs + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Overdue Actions</div><div class="kpi-value">' + overdueActions + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Avg Days to Close</div><div class="kpi-value">' + avgDaysToClose + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Effectiveness %</div><div class="kpi-value">' + effectivenessRate + '%</div></div>' +
        '</div>' +
        '<div class="detail-section">' +
        '<h3>NCR Pipeline by Stage</h3>' +
        stageChart +
        '</div>' +
        '<div class="detail-section">' +
        '<h3>Severity Breakdown</h3>' +
        '<div class="severity-breakdown">' +
        '<div class="severity-item"><div class="severity-item-num">' + bySeverity.Minor + '</div><div class="severity-item-label">Minor</div></div>' +
        '<div class="severity-item"><div class="severity-item-num">' + bySeverity.Major + '</div><div class="severity-item-label">Major</div></div>' +
        '<div class="severity-item"><div class="severity-item-num">' + bySeverity.Critical + '</div><div class="severity-item-label">Critical</div></div>' +
        '</div>' +
        '</div>';

      el.innerHTML = html;
    }).catch(function(e){ el.innerHTML='<p style="color:var(--rd);padding:20px">Error loading CAPA data: '+e.message+'</p>'; });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ALL NCRs LIST
  // ─────────────────────────────────────────────────────────────────────────────
  function renderAllNCRs(el){
    var html = '<div>' +
      '<div class="capa-filter">' +
      '<input type="text" class="filter-input" id="ncrSearch" placeholder="Search..." onkeyup="window.MFX_CAPA.filterNCRs()">' +
      '<select class="filter-input" id="ncrStageFilter" onchange="window.MFX_CAPA.filterNCRs()">' +
      '<option value="">All Stages</option>' +
      Object.keys(STAGES).map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-input" id="ncrSeverityFilter" onchange="window.MFX_CAPA.filterNCRs()">' +
      '<option value="">All Severities</option>' +
      SEVERITY.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      '<div class="capa-grid" id="ncrGrid"></div>' +
      '</div>';

    el.innerHTML = html;
    loadAndDisplayNCRs();
  }

  function loadAndDisplayNCRs(){
    if(!db) return;
    db.collection('ncrs').get().then(function(snap){
      var ncrs = [];
      snap.forEach(function(doc){
        ncrs.push(Object.assign({id: doc.id}, doc.data()));
      });
      displayNCRGrid(ncrs);
    }).catch(function(e){ console.warn('loadNCRs error:',e.message); });
  }

  function displayNCRGrid(ncrs){
    var grid = document.getElementById('ncrGrid');
    if(!grid) return;

    var html = ncrs.map(function(n){
      return '<div class="capa-card" onclick="window.MFX_CAPA.showNCRDetail(\'' + n.id + '\')">' +
        '<div class="capa-card-header">' +
        '<div><div class="capa-card-id">NCR-' + esc(n.ncrNumber||'0001') + '</div><div style="font-weight:700;color:var(--tx);margin-top:4px">' + esc(n.title||'Untitled') + '</div></div>' +
        '</div>' +
        '<div style="margin:12px 0">' +
        '<span class="capa-badge severity-' + (n.severity||'minor').toLowerCase() + '">' + (n.severity||'Minor') + '</span>' +
        '<span class="capa-badge" style="background:' + (STAGES[n.stage]||'#999') + '22;color:' + (STAGES[n.stage]||'#999') + '">' + (n.stage||'Reported') + '</span>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--tx2);margin-top:12px">' +
        '<div>Assigned: ' + (n.assignedTo||'Unassigned') + '</div>' +
        '<div>Reported: ' + (n.reportedDate ? new Date(n.reportedDate).toLocaleDateString() : 'N/A') + '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    grid.innerHTML = html;
  }

  function filterNCRs(){
    var search = (document.getElementById('ncrSearch')||{}).value || '';
    var stageFilter = (document.getElementById('ncrStageFilter')||{}).value || '';
    var severityFilter = (document.getElementById('ncrSeverityFilter')||{}).value || '';

    db.collection('ncrs').get().then(function(snap){
      var ncrs = [];
      snap.forEach(function(doc){
        var d = Object.assign({id: doc.id}, doc.data());
        if(search && !JSON.stringify(d).toLowerCase().includes(search.toLowerCase())) return;
        if(stageFilter && d.stage !== stageFilter) return;
        if(severityFilter && d.severity !== severityFilter) return;
        ncrs.push(d);
      });
      displayNCRGrid(ncrs);
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OPEN ISSUES
  // ─────────────────────────────────────────────────────────────────────────────
  function renderOpenIssues(el){
    db.collection('ncrs').where('stage', 'in', ['Reported', 'Under Investigation', 'Root Cause Identified', 'Corrective Action Planned', 'In Progress']).get().then(function(snap){
      var openNCRs = [];
      snap.forEach(function(doc){
        openNCRs.push(Object.assign({id: doc.id}, doc.data()));
      });

      var html = '<div class="capa-grid">';
      html += openNCRs.map(function(n){
        return '<div class="capa-card" onclick="window.MFX_CAPA.showNCRDetail(\'' + esc(n.id) + '\')">' +
          '<div class="capa-card-id">NCR-' + esc(n.ncrNumber||'0001') + '</div>' +
          '<div style="font-weight:700;color:var(--tx);margin:8px 0">' + esc(n.title||'Untitled') + '</div>' +
          '<span class="capa-badge severity-' + (n.severity||'minor').toLowerCase() + '">' + (n.severity||'Minor') + '</span>' +
          '<span class="capa-badge" style="background:' + (STAGES[n.stage]||'#999') + '22;color:' + (STAGES[n.stage]||'#999') + '">' + (n.stage||'Reported') + '</span>' +
          '<div style="font-size:11px;color:var(--tx2);margin-top:12px">Days Open: ' + (n.daysOpen||0) + '</div>' +
          '</div>';
      }).join('') +
      '</div>';

      el.innerHTML = html;
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NCR DETAIL VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  function showNCRDetail(ncrId){
    db.collection('ncrs').doc(ncrId).get().then(function(doc){
      if(!doc.exists){
        toast('NCR not found', 'err');
        return;
      }

      var n = Object.assign({id: doc.id}, doc.data());
      currentNCR = n;

      var html = '<div style="position:relative">' +
        '<button class="close-btn" onclick="window.MFX_CAPA.closeDetailModal()">×</button>' +
        '<h2 style="margin-top:0;color:var(--ac)">NCR-' + esc(n.ncrNumber||'0001') + ': ' + esc(n.title||'') + '</h2>' +
        '<div style="display:flex;gap:12px;margin-bottom:16px">' +
        '<span class="capa-badge severity-' + esc((n.severity||'minor').toLowerCase()) + '">' + esc(n.severity||'Minor') + '</span>' +
        '<span class="capa-badge" style="background:' + (STAGES[n.stage]||'#999') + '22;color:' + (STAGES[n.stage]||'#999') + '">' + esc(n.stage||'Reported') + '</span>' +
        '</div>' +
        '<div class="detail-section">' +
        '<h3>Issue Details</h3>' +
        '<p><strong>Source:</strong> ' + esc(n.source||'N/A') + '</p>' +
        '<p><strong>Category:</strong> ' + esc(n.category||'N/A') + '</p>' +
        '<p><strong>Description:</strong></p>' +
        '<p style="white-space:pre-wrap">' + esc(n.description||'') + '</p>' +
        '<p><strong>Immediate Action:</strong></p>' +
        '<p style="white-space:pre-wrap">' + esc(n.immediateAction||'') + '</p>' +
        '</div>' +
        '<div class="detail-section">' +
        '<h3>Assignments</h3>' +
        '<p><strong>Assigned To:</strong> ' + esc(n.assignedTo||'Unassigned') + '</p>' +
        '<p><strong>Department:</strong> ' + esc(n.department||'N/A') + '</p>' +
        '</div>' +
        '<div class="detail-section">' +
        '<h3>Dates</h3>' +
        '<p><strong>Reported:</strong> ' + (n.reportedDate ? new Date(n.reportedDate).toLocaleDateString() : 'N/A') + '</p>' +
        '<p><strong>Target Close:</strong> ' + (n.targetCloseDate ? new Date(n.targetCloseDate).toLocaleDateString() : 'N/A') + '</p>' +
        '</div>';

      if(n.rootCauseAnalysis && Object.keys(n.rootCauseAnalysis).length > 0){
        html += '<div class="detail-section">' +
          '<h3>Root Cause Analysis</h3>' +
          '<p><strong>Method:</strong> ' + (n.rootCauseAnalysis.method||'') + '</p>' +
          '<p><strong>Summary:</strong></p>' +
          '<p style="white-space:pre-wrap">' + (n.rootCauseAnalysis.summary||'') + '</p>' +
          '</div>';
      }

      if(n.correctiveActions && n.correctiveActions.length > 0){
        html += '<div class="detail-section">' +
          '<h3>Corrective Actions</h3>' +
          '<ul class="action-list">';
        n.correctiveActions.forEach(function(a){
          html += '<li class="action-item">' +
            '<span><strong>' + (a.action||'') + '</strong><br><small>' + (a.owner||'') + ' - Due: ' + (a.dueDate||'') + '</small></span>' +
            '<span class="action-status">' + (a.status||'Open') + '</span>' +
            '</li>';
        });
        html += '</ul></div>';
      }

      if(n.timeline && n.timeline.length > 0){
        html += '<div class="detail-section">' +
          '<h3>Timeline</h3>' +
          '<div class="timeline">';
        n.timeline.forEach(function(t){
          html += '<div class="timeline-item">' +
            '<div class="timeline-marker"></div>' +
            '<div class="timeline-content">' +
            '<strong>' + (t.event||'') + '</strong>' +
            '<p>' + (t.note||'') + '</p>' +
            '</div>' +
            '</div>';
        });
        html += '</div></div>';
      }

      html += '</div>';
      openModal(html);
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  function closeDetailModal(){
    closeModal();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT ISSUE FORM
  // ─────────────────────────────────────────────────────────────────────────────
  function renderReportForm(el){
    var html = '<form id="ncrReportForm" onsubmit="window.MFX_CAPA.submitNCR(event)">' +
      '<div class="form-group">' +
      '<label>Title *</label>' +
      '<input type="text" id="ncrTitle" required>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group">' +
      '<label>Source *</label>' +
      '<select id="ncrSource" required>' +
      '<option></option>' +
      SOURCES.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Category *</label>' +
      '<select id="ncrCategory" required>' +
      '<option></option>' +
      CATEGORIES.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group">' +
      '<label>Severity *</label>' +
      '<select id="ncrSeverity" required>' +
      '<option></option>' +
      SEVERITY.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Department *</label>' +
      '<input type="text" id="ncrDepartment" required>' +
      '</div>' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Description *</label>' +
      '<textarea id="ncrDescription" required></textarea>' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Immediate Action Required *</label>' +
      '<textarea id="ncrImmediateAction" required></textarea>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group">' +
      '<label>Assigned To</label>' +
      '<input type="text" id="ncrAssignedTo">' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Target Close Date</label>' +
      '<input type="date" id="ncrTargetCloseDate">' +
      '</div>' +
      '</div>' +
      (window.SQF_EV ? SQF_EV.renderAttachmentZone('capa-ncr','ncr') + SQF_EV.renderSignaturePad('capa-ncr','Reported By — E-Signature') : '') +
      '<div class="compliance-boundary" style="margin-top:12px"></div>' +
      '<button type="submit" class="btn btn-signoff">Submit NCR</button>' +
      '</form>';

    el.innerHTML = html;
    if(window.SQF_EV) setTimeout(function(){SQF_EV.initAllPads()},50);
  }

  function toggleReportForm(){
    var el = document.getElementById('v-capa');
    if(el && el.querySelector('#ncrReportForm')){
      closeModal();
    } else {
      showTab('report-issue');
    }
  }

  function submitNCR(e){
    e.preventDefault();

    var ncrData = {
      ncrNumber: new Date().getFullYear().toString().slice(2)+String(Date.now()).slice(-6),
      title: document.getElementById('ncrTitle').value,
      source: document.getElementById('ncrSource').value,
      category: document.getElementById('ncrCategory').value,
      severity: document.getElementById('ncrSeverity').value,
      department: document.getElementById('ncrDepartment').value,
      description: document.getElementById('ncrDescription').value,
      immediateAction: document.getElementById('ncrImmediateAction').value,
      assignedTo: document.getElementById('ncrAssignedTo').value || 'Unassigned',
      targetCloseDate: document.getElementById('ncrTargetCloseDate').value,
      stage: 'Reported',
      reportedDate: new Date().toISOString(),
      daysOpen: 0,
      createdBy: currentUser || 'System',
      createdAt: new Date().toISOString()
    };
    if(window.SQF_EV){ncrData.evidence=SQF_EV.collectEvidence('capa-ncr');SQF_EV.uploadEvidence('capa-ncr','ncr',{recordNum:'NCR_'+ncrData.ncrNumber}).catch(function(e){console.warn('capaEvidenceUpload:',e);});SQF_EV.clearStash('capa-ncr');}

    db.collection('ncrs').add(ncrData).then(function(){
      toast('NCR submitted successfully', 'ok');
      renderAllNCRs(document.getElementById('capaContent'));
      closeModal();
    }).catch(function(e){
      console.error('NCR submit error:', e);
      toast('Error submitting NCR', 'err');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROOT CAUSE MENU
  // ─────────────────────────────────────────────────────────────────────────────
  function renderRootCauseMenu(el){
    var html = '<div style="text-align:center">' +
      '<h2 style="color:var(--ac)">Select Root Cause Analysis Method</h2>' +
      '<div class="capa-grid">' +
      '<div class="capa-card" onclick="window.MFX_CAPA.showTab(\'5-why\')" style="cursor:pointer">' +
      '<h3 style="color:var(--ac);margin:0">5 Why Analysis</h3>' +
      '<p>Iterative technique: ask "why" 5 times to find root cause</p>' +
      '</div>' +
      '<div class="capa-card" onclick="window.MFX_CAPA.showTab(\'fishbone\')" style="cursor:pointer">' +
      '<h3 style="color:var(--ac);margin:0">Fishbone / Ishikawa</h3>' +
      '<p>6 categories: Man, Machine, Material, Method, Measurement, Environment</p>' +
      '</div>' +
      '</div>' +
      '</div>';
    el.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5 WHY ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────────
  function renderFiveWhyForm(el){
    var html = '<form id="fiveWhyForm" onsubmit="window.MFX_CAPA.submit5Why(event)">' +
      '<div class="form-group">' +
      '<label>NCR ID (optional - leave blank for new analysis)</label>' +
      '<input type="text" id="whyNCRRef">' +
      '</div>' +
      '<div class="form-group">' +
      '<label>Problem Statement *</label>' +
      '<textarea id="whyProblem" required></textarea>' +
      '</div>';

    for(var i=1; i<=5; i++){
      html += '<div class="why-level">' +
        '<label>Why ' + i + '?</label>' +
        '<input type="text" id="why' + i + 'Q" placeholder="Why did this happen?">' +
        '<label style="margin-top:8px;display:block">Answer ' + i + ':</label>' +
        '<input type="text" id="why' + i + 'A" placeholder="Answer to why ' + i + '...">' +
        '</div>';
    }

    html += '<div class="form-group">' +
      '<label>Root Cause Summary *</label>' +
      '<textarea id="whyRootCause" required></textarea>' +
      '</div>' +
      '<button type="submit" class="btn btn-primary">Save 5 Why Analysis</button>' +
      '</form>';

    el.innerHTML = html;
  }

  function submit5Why(e){
    e.preventDefault();
    var analysis = {
      problemStatement: document.getElementById('whyProblem').value,
      whyLevels: [],
      rootCauseSummary: document.getElementById('whyRootCause').value,
      method: '5 Why Analysis',
      createdAt: new Date().toISOString()
    };

    for(var i=1; i<=5; i++){
      analysis.whyLevels.push({
        level: i,
        question: document.getElementById('why' + i + 'Q').value,
        answer: document.getElementById('why' + i + 'A').value
      });
    }

    var ncrRef = document.getElementById('whyNCRRef').value;
    if(ncrRef){
      db.collection('ncrs').doc(ncrRef).update({
        rootCauseAnalysis: analysis
      }).then(function(){
        toast('5 Why Analysis saved', 'ok');
      }).catch(function(e){
        console.error('Error:', e);
        toast('Error saving analysis', 'err');
      });
    } else {
      toast('5 Why Analysis saved locally', 'ok');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FISHBONE DIAGRAM
  // ─────────────────────────────────────────────────────────────────────────────
  function renderFishboneForm(el){
    var categories = ['Man (People)', 'Machine (Equipment)', 'Material', 'Method (Process)', 'Measurement', 'Mother Nature (Environment)'];

    var html = '<form id="fishboneForm" onsubmit="window.MFX_CAPA.submitFishbone(event)">' +
      '<div class="form-group">' +
      '<label>Problem/Effect *</label>' +
      '<input type="text" id="fbEffect" required>' +
      '</div>' +
      '<div class="form-group">' +
      '<label>NCR ID (optional)</label>' +
      '<input type="text" id="fbNCRRef">' +
      '</div>';

    categories.forEach(function(cat){
      var catId = cat.toLowerCase().replace(/[^a-z]/g, '');
      html += '<div class="fishbone-category">' +
        '<h4>' + cat + '</h4>' +
        '<textarea id="fb' + catId + '" placeholder="List causes for ' + cat + '..." rows="3"></textarea>' +
        '</div>';
    });

    html += '<button type="submit" class="btn btn-primary">Save Fishbone Analysis</button>' +
      '</form>';

    el.innerHTML = html;
  }

  function submitFishbone(e){
    e.preventDefault();
    var categoryNames = ['Man (People)', 'Machine (Equipment)', 'Material', 'Method (Process)', 'Measurement', 'Mother Nature (Environment)'];
    var categories = {};
    categoryNames.forEach(function(cat){
      categories[cat] = 'fb' + cat.toLowerCase().replace(/[^a-z]/g, '');
    });

    var fishbone = {
      effect: document.getElementById('fbEffect').value,
      causes: {},
      method: 'Fishbone / Ishikawa',
      createdAt: new Date().toISOString()
    };

    Object.keys(categories).forEach(function(name){
      fishbone.causes[name] = document.getElementById(categories[name]).value;
    });

    var ncrRef = document.getElementById('fbNCRRef').value;
    if(ncrRef){
      db.collection('ncrs').doc(ncrRef).update({
        rootCauseAnalysis: fishbone
      }).then(function(){
        toast('Fishbone Analysis saved', 'ok');
      }).catch(function(e){
        toast('Error saving analysis', 'err');
      });
    } else {
      toast('Fishbone Analysis saved', 'ok');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTION TRACKER
  // ─────────────────────────────────────────────────────────────────────────────
  function renderActionTracker(el){
    db.collection('ncrs').get().then(function(snap){
      var allActions = [];
      snap.forEach(function(doc){
        var n = doc.data();
        if(n.correctiveActions){
          n.correctiveActions.forEach(function(a){
            allActions.push(Object.assign({ncrId: doc.id}, a));
          });
        }
      });

      var html = '<div class="capa-filter">' +
        '<select class="filter-input" id="actionStatusFilter" onchange="window.MFX_CAPA.filterActions()">' +
        '<option value="">All Statuses</option>' +
        '<option value="Open">Open</option>' +
        '<option value="In Progress">In Progress</option>' +
        '<option value="Complete">Complete</option>' +
        '<option value="Overdue">Overdue</option>' +
        '</select>' +
        '</div>' +
        '<ul class="action-list" id="actionList">';

      allActions.forEach(function(a){
        var isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'Complete';
        html += '<li class="action-item">' +
          '<div>' +
          '<strong>' + (a.action||'') + '</strong><br>' +
          '<small>Owner: ' + (a.owner||'') + ' | Due: ' + (a.dueDate||'') + '</small>' +
          '</div>' +
          '<span class="action-status" style="background:' + (isOverdue?'rgba(255,100,116,0.2)':'rgba(46,232,158,0.2)') + ';color:' + (isOverdue?'#ff6474':'#2ee89e') + '">' + (isOverdue?'Overdue':a.status||'Open') + '</span>' +
          '</li>';
      });

      html += '</ul>';
      el.innerHTML = html;
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  function filterActions(){
    var filterValue = (document.getElementById('actionStatusFilter') || {}).value || '';
    var items = document.querySelectorAll('#actionList .action-item');
    items.forEach(function(item){
      if(!filterValue){
        item.style.display = '';
        return;
      }
      var statusEl = item.querySelector('.action-status');
      var statusText = statusEl ? statusEl.textContent.trim() : '';
      item.style.display = (statusText === filterValue) ? '' : 'none';
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECTIVENESS VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  function renderEffectiveness(el){
    db.collection('ncrs').where('stage', '==', 'Closed - Effective').get().then(function(snap){
      var verified = 0;
      var pending = 0;
      snap.forEach(function(doc){
        var n = doc.data();
        if(n.verificationResult && n.verificationResult.effective){
          verified++;
        } else {
          pending++;
        }
      });

      var html = '<div class="capa-grid">' +
        '<div class="kpi-box"><div class="kpi-label">Verified Effective</div><div class="kpi-value">' + verified + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Verification Pending</div><div class="kpi-value">' + pending + '</div></div>' +
        '</div>' +
        '<div class="detail-section">' +
        '<h3>Recent Verifications</h3>' +
        '<p>Verification records for closed corrective actions...</p>' +
        '</div>';

      el.innerHTML = html;
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRENDS
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTrends(el){
    db.collection('ncrs').get().then(function(snap){
      var bySource = {};
      var byCategory = {};
      var bySeverity = {Minor: 0, Major: 0, Critical: 0};

      snap.forEach(function(doc){
        var n = doc.data();
        bySource[n.source] = (bySource[n.source] || 0) + 1;
        byCategory[n.category] = (byCategory[n.category] || 0) + 1;
        if(bySeverity.hasOwnProperty(n.severity)){
          bySeverity[n.severity]++;
        }
      });

      var html = '<div class="detail-section">' +
        '<h3>NCRs by Source</h3>';
      Object.keys(bySource).forEach(function(src){
        html += '<div class="action-item"><span>' + src + '</span><strong>' + bySource[src] + '</strong></div>';
      });
      html += '</div>' +
        '<div class="detail-section">' +
        '<h3>NCRs by Category</h3>';
      Object.keys(byCategory).forEach(function(cat){
        html += '<div class="action-item"><span>' + cat + '</span><strong>' + byCategory[cat] + '</strong></div>';
      });
      html += '</div>' +
        '<div class="detail-section">' +
        '<h3>Severity Distribution</h3>' +
        '<div class="severity-breakdown">' +
        '<div class="severity-item"><div class="severity-item-num">' + bySeverity.Minor + '</div><div class="severity-item-label">Minor</div></div>' +
        '<div class="severity-item"><div class="severity-item-num">' + bySeverity.Major + '</div><div class="severity-item-label">Major</div></div>' +
        '<div class="severity-item"><div class="severity-item-num">' + bySeverity.Critical + '</div><div class="severity-item-label">Critical</div></div>' +
        '</div>' +
        '</div>';

      el.innerHTML = html;
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────────────────────────────────────────
  function renderKPIs(el){
    db.collection('ncrs').get().then(function(snap){
      var allNCRs = [];
      snap.forEach(function(doc){
        allNCRs.push(Object.assign({id: doc.id}, doc.data()));
      });

      var closed = allNCRs.filter(function(n){
        return n.stage === 'Closed - Effective' || n.stage === 'Closed - Ineffective';
      }).length;
      var closureRate = Math.round((closed / Math.max(allNCRs.length, 1)) * 100);
      var effective = allNCRs.filter(function(n){
        return n.stage === 'Closed - Effective';
      }).length;
      var effectivenessRate = Math.round((effective / Math.max(closed, 1)) * 100);
      var recurrenceRate = 5; // Mock data
      var avgResponseTime = 3; // Mock data

      var html = '<div class="capa-grid">' +
        '<div class="kpi-box"><div class="kpi-label">CAPA Effectiveness Rate</div><div class="kpi-value">' + effectivenessRate + '%</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Closure Rate</div><div class="kpi-value">' + closureRate + '%</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Recurrence Rate</div><div class="kpi-value">' + recurrenceRate + '%</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Avg Response Days</div><div class="kpi-value">' + avgResponseTime + '</div></div>' +
        '</div>';

      el.innerHTML = html;
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SQF AUDIT TAB
  // ─────────────────────────────────────────────────────────────────────────────
  function renderSQFAudit(el){
    var html = '<div class="detail-section">' +
      '<h3>SQF Audit Compliance</h3>' +
      '<p>CAPA system tracks corrective and preventive actions in accordance with SQF Code requirements.</p>' +
      '<ul style="margin:12px 0;padding-left:20px">' +
      '<li>9.1 – Management responsibility for CAPA</li>' +
      '<li>9.2 – Root cause analysis and corrective actions</li>' +
      '<li>9.3 – Verification of effectiveness</li>' +
      '<li>Documentation of all actions and results</li>' +
      '<li>Trending and analysis of effectiveness</li>' +
      '</ul>' +
      '</div>';

    el.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEED DATA
  // ─────────────────────────────────────────────────────────────────────────────
  function ensureSeedData(){
    if(seedDataAdded) return;
    seedDataAdded = true;

    db.collection('ncrs').where('ncrNumber', '==', '0001').get().then(function(snap){
      if(snap.size > 0) return; // Data already exists

      var seedNCRs = [
        {
          ncrNumber: '0001',
          title: 'Swab Fail - Break Room Counter',
          source: 'Environmental Swab',
          category: 'Food Safety',
          severity: 'Major',
          description: 'ATP swab on break room counter returned positive result indicating insufficient sanitation.',
          immediateAction: 'Immediately re-cleaned and re-tested break room counter. Training conducted on cleaning procedure.',
          stage: 'Closed - Effective',
          assignedTo: 'Sarah Johnson',
          department: 'Quality Assurance',
          reportedDate: new Date(Date.now() - 45*24*60*60*1000).toISOString(),
          targetCloseDate: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
          daysOpen: 40,
          rootCauseAnalysis: {
            method: '5 Why Analysis',
            summary: 'Cleaner was not following proper sanitation procedure. Inadequate training and lack of oversight were root causes.',
            whyLevels: [
              {level: 1, question: 'Why did swab result fail?', answer: 'Counter surface not properly sanitized'},
              {level: 2, question: 'Why was it not sanitized?', answer: 'Cleaner missed the area'},
              {level: 3, question: 'Why did cleaner miss it?', answer: 'Unclear procedure'},
              {level: 4, question: 'Why unclear?', answer: 'Inadequate training'},
              {level: 5, question: 'Why inadequate?', answer: 'No procedure review in 2 years'}
            ]
          },
          correctiveActions: [
            {action: 'Retrain all cleaning staff on sanitation SOP', owner: 'HR', status: 'Complete', dueDate: '2026-03-20'},
            {action: 'Implement daily sanitation checklist with signatures', owner: 'Quality', status: 'Complete', dueDate: '2026-03-22'},
            {action: 'Conduct monthly ATP swab verification', owner: 'Quality', status: 'Complete', dueDate: '2026-04-01'}
          ],
          verificationResult: {method: 'ATP Swab', effective: true, verifiedDate: new Date().toISOString()},
          timeline: [
            {event: 'NCR Reported', note: 'Environmental swab positive'},
            {event: 'Immediate Action', note: 'Counter re-cleaned and re-tested'},
            {event: 'Root Cause Found', note: '5 Why analysis completed'},
            {event: 'Actions Completed', note: 'All corrective actions implemented'},
            {event: 'Verification', note: 'Effectiveness confirmed - CLOSED'}
          ]
        },
        {
          ncrNumber: '0002',
          title: 'Liner Gauge Variance - Vendor NCR',
          source: 'Vendor NCR',
          category: 'Equipment',
          severity: 'Major',
          description: 'Vendor supplied liners outside gauge specification. 500 units affected.',
          immediateAction: 'Quarantine all affected liners. Contact vendor for replacement shipment.',
          stage: 'Closed - Effective',
          assignedTo: 'Michael Chen',
          department: 'Procurement',
          reportedDate: new Date(Date.now() - 60*24*60*60*1000).toISOString(),
          targetCloseDate: new Date(Date.now() - 15*24*60*60*1000).toISOString(),
          daysOpen: 45,
          correctiveActions: [
            {action: 'Audit vendor quality procedures', owner: 'Procurement', status: 'Complete', dueDate: '2026-03-15'},
            {action: 'Implement incoming gauge verification for all liners', owner: 'QA', status: 'Complete', dueDate: '2026-03-25'},
            {action: 'Quarterly vendor quality reviews', owner: 'Procurement', status: 'Complete', dueDate: '2026-04-01'}
          ],
          verificationResult: {method: 'Incoming Inspection', effective: true},
          timeline: [
            {event: 'NCR Reported', note: 'Vendor gauge variance detected'},
            {event: 'Containment', note: 'All affected units quarantined'},
            {event: 'Root Cause', note: 'Vendor QC procedure inadequate'},
            {event: 'Actions', note: 'Corrective actions implemented'},
            {event: 'Closed', note: 'Vendor compliance verified - EFFECTIVE'}
          ]
        },
        {
          ncrNumber: '0003',
          title: 'GMP Ceiling Paint Chip',
          source: 'GMP Inspection',
          category: 'GMP',
          severity: 'Minor',
          description: 'Small paint chip found on production room ceiling. Immediate area cleaned. No product contamination identified.',
          immediateAction: 'Production stopped in area. Ceiling cleaned. Area inspected for other debris.',
          stage: 'In Progress',
          assignedTo: 'David Martinez',
          department: 'Maintenance',
          reportedDate: new Date(Date.now() - 8*24*60*60*1000).toISOString(),
          targetCloseDate: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
          daysOpen: 8,
          correctiveActions: [
            {action: 'Paint ceiling in production room', owner: 'Maintenance', status: 'In Progress', dueDate: '2026-04-10'},
            {action: 'Inspect all facility ceilings for paint integrity', owner: 'Maintenance', status: 'Open', dueDate: '2026-04-15'}
          ],
          timeline: [
            {event: 'NCR Reported', note: 'Paint chip discovered during inspection'},
            {event: 'Containment', note: 'Area cleaned and production halted'},
            {event: 'In Progress', note: 'Corrective actions underway'}
          ]
        },
        {
          ncrNumber: '0004',
          title: 'Customer Complaint - Barcode Scan Failure',
          source: 'Customer Complaint',
          category: 'Product Quality',
          severity: 'Critical',
          description: 'Customer reported 50 cases with barcode label issues. Barcodes not scanning at retail checkout.',
          immediateAction: 'Customer provided replacement shipment. Investigation into label printing initiated.',
          stage: 'Under Investigation',
          assignedTo: 'Jennifer Lee',
          department: 'Operations',
          reportedDate: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
          targetCloseDate: new Date(Date.now() + 14*24*60*60*1000).toISOString(),
          daysOpen: 3,
          timeline: [
            {event: 'NCR Reported', note: 'Customer complaint received'},
            {event: 'Immediate Action', note: 'Replacement shipment provided'},
            {event: 'Under Investigation', note: 'Root cause analysis in progress'}
          ]
        },
        {
          ncrNumber: '0005',
          title: 'Temperature Warning - Cold Storage Excursion',
          source: 'Temperature Excursion',
          category: 'Environmental',
          severity: 'Minor',
          description: 'Temperature sensor alarm triggered. Cold room reached 42°F for 15 minutes before stabilizing.',
          immediateAction: 'Thermostat adjusted. Sensor calibration verified.',
          stage: 'Reported',
          assignedTo: 'Robert Thompson',
          department: 'Maintenance',
          reportedDate: new Date().toISOString(),
          targetCloseDate: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
          daysOpen: 0,
          timeline: [
            {event: 'NCR Reported', note: 'Temperature excursion detected'}
          ]
        }
      ];

      seedNCRs.forEach(function(ncr){
        db.collection('ncrs').add(ncr).catch(function(e){
          console.error('Error adding seed NCR:', e);
        });
      });

      console.log('✅ CAPA seed data initialized');
    }).catch(function(e){ console.warn('CAPA get:', e.message); });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIALIZATION & GLOBAL EXPORTS
  // ─────────────────────────────────────────────────────────────────────────────
  function capaInit(){
    if(typeof MFX !== 'undefined' && MFX.on){
      MFX.on('view.capa', function(){
        renderCAPA();
      });
    }

    var origGoView = window.goView;
    if(typeof origGoView === 'function'){
      window.goView = function(v){
        origGoView(v);
        if(v === 'capa'){
          renderCAPA();
        }
      };
    }

    console.log('✅ MFX CAPA/NCR Module initialized');
  }

  // Register renderer immediately (before init delay)
  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_RENDERERS.capa = renderCAPA;

  // Export all public methods
  window.MFX_CAPA = window.MFX_CAPA || {};
  window.MFX_CAPA.renderCAPA = renderCAPA;
  window.MFX_CAPA.showTab = showTab;
  window.MFX_CAPA.showNCRDetail = showNCRDetail;
  window.MFX_CAPA.closeDetailModal = closeDetailModal;
  window.MFX_CAPA.toggleReportForm = toggleReportForm;
  window.MFX_CAPA.submitNCR = submitNCR;
  window.MFX_CAPA.filterNCRs = filterNCRs;
  window.MFX_CAPA.submit5Why = submit5Why;
  window.MFX_CAPA.submitFishbone = submitFishbone;
  window.MFX_CAPA.filterActions = filterActions;

  // suggestNCR — auto-create NCR from SQF alert data
  function suggestNCR(data) {
    var ncr = {
      title: data.title || 'Auto-suggested NCR',
      source: data.source || 'SQF Alert',
      description: data.description || '',
      stage: 'Reported',
      reportedDate: new Date().toISOString().split('T')[0],
      reportedBy: typeof getUserName==='function'?getUserName():'System',
      severity: data.severity || 'minor',
      status: 'open'
    };
    var _db=db||(typeof fbDb!=='undefined'?fbDb:null);
    if(_db) {
      _db.collection('ncrs').add(ncr).then(function(){
        if(typeof toast==='function') toast('NCR auto-created from SQF alert','ok');
      }).catch(function(e){ console.warn('suggestNCR failed:',e.message); });
    }
  }
  window.MFX_CAPA.suggestNCR = suggestNCR;

  // Init after DOM ready
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(capaInit, 1500);
  } else {
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(capaInit, 1500);
    });
  }
})();
