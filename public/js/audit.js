(function() {
  'use strict';

  var db;
  try { db = firebase.firestore(); } catch(e) { console.warn('Audit: Firebase not ready, will retry on init'); }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]});}

  // SQF Ed.10 Module 2 & 11 clauses with audit questions
  var SQF_CLAUSES = [
    { id: '2.1', title: 'Management Commitment', section: 'Module 2', questions: 8 },
    { id: '2.4', title: 'Food Safety Plan', section: 'Module 2', questions: 7 },
    { id: '2.5', title: 'SQF System Verification', section: 'Module 2', questions: 6 },
    { id: '2.7', title: 'Food Defense', section: 'Module 2', questions: 5 },
    { id: '2.8', title: 'Allergen Management', section: 'Module 2', questions: 6 },
    { id: '2.9', title: 'Training & Competency', section: 'Module 2', questions: 5 },
    { id: '11.1', title: 'Site Requirements', section: 'Module 11', questions: 4 },
    { id: '11.2', title: 'Building & Grounds', section: 'Module 11', questions: 8 },
    { id: '11.3', title: 'Pest Prevention', section: 'Module 11', questions: 6 },
    { id: '11.4', title: 'Personal Hygiene', section: 'Module 11', questions: 5 },
    { id: '11.5', title: 'Foreign Material Control', section: 'Module 11', questions: 4 },
    { id: '11.6', title: 'Storage & Handling', section: 'Module 11', questions: 5 },
    { id: '11.7', title: 'Waste Management', section: 'Module 11', questions: 3 },
    { id: '11.8', title: 'Equipment & Maintenance', section: 'Module 11', questions: 5 }
  ];

  var AUDIT_QUESTIONS = [
    // Clause 2.1 - Management Commitment
    { clauseId: '2.1', qNum: 1, text: 'Is food safety policy documented and signed by management?' },
    { clauseId: '2.1', qNum: 2, text: 'Are resources allocated for food safety program?' },
    { clauseId: '2.1', qNum: 3, text: 'Is food safety team established with defined roles?' },
    { clauseId: '2.1', qNum: 4, text: 'Are management review meetings held quarterly?' },
    { clauseId: '2.1', qNum: 5, text: 'Is competency of food safety personnel documented?' },
    { clauseId: '2.1', qNum: 6, text: 'Are customer complaints tracked and investigated?' },
    { clauseId: '2.1', qNum: 7, text: 'Is internal audit program documented?' },
    { clauseId: '2.1', qNum: 8, text: 'Are regulatory requirements identified and monitored?' },
    // Clause 2.4 - Food Safety Plan
    { clauseId: '2.4', qNum: 1, text: 'Is HACCP plan documented for all products?' },
    { clauseId: '2.4', qNum: 2, text: 'Are hazards identified and analyzed?' },
    { clauseId: '2.4', qNum: 3, text: 'Are CCPs (Critical Control Points) established?' },
    { clauseId: '2.4', qNum: 4, text: 'Are critical limits defined for each CCP?' },
    { clauseId: '2.4', qNum: 5, text: 'Are monitoring procedures documented?' },
    { clauseId: '2.4', qNum: 6, text: 'Are corrective actions defined for CCP deviations?' },
    { clauseId: '2.4', qNum: 7, text: 'Is HACCP plan reviewed annually?' },
    // Clause 2.5 - SQF System Verification
    { clauseId: '2.5', qNum: 1, text: 'Are product specifications verified against standards?' },
    { clauseId: '2.5', qNum: 2, text: 'Are supplier audits conducted and documented?' },
    { clauseId: '2.5', qNum: 3, text: 'Are lab test results available for raw materials?' },
    { clauseId: '2.5', qNum: 4, text: 'Are finished product tests performed per SQF?' },
    { clauseId: '2.5', qNum: 5, text: 'Is traceability testing conducted annually?' },
    { clauseId: '2.5', qNum: 6, text: 'Are validation studies documented for processes?' },
    // Clause 2.7 - Food Defense
    { clauseId: '2.7', qNum: 1, text: 'Is food defense policy documented?' },
    { clauseId: '2.7', qNum: 2, text: 'Are unauthorized persons prevented from accessing product areas?' },
    { clauseId: '2.7', qNum: 3, text: 'Is perimeter security maintained and inspected?' },
    { clauseId: '2.7', qNum: 4, text: 'Are suspicious packages/containers reported?' },
    { clauseId: '2.7', qNum: 5, text: 'Is food defense training provided to all staff?' },
    // Clause 2.8 - Allergen Management
    { clauseId: '2.8', qNum: 1, text: 'Is allergen list documented for all products?' },
    { clauseId: '2.8', qNum: 2, text: 'Are ingredient allergens verified with suppliers?' },
    { clauseId: '2.8', qNum: 3, text: 'Is labeling correct for all allergens?' },
    { clauseId: '2.8', qNum: 4, text: 'Are changeover procedures followed between allergen products?' },
    { clauseId: '2.8', qNum: 5, text: 'Are cross-contamination risks identified and mitigated?' },
    { clauseId: '2.8', qNum: 6, text: 'Is allergen training provided annually?' },
    // Clause 2.9 - Training & Competency
    { clauseId: '2.9', qNum: 1, text: 'Is training plan documented and updated?' },
    { clauseId: '2.9', qNum: 2, text: 'Are training records maintained for all employees?' },
    { clauseId: '2.9', qNum: 3, text: 'Is competency assessment performed?' },
    { clauseId: '2.9', qNum: 4, text: 'Are refresher trainings conducted annually?' },
    { clauseId: '2.9', qNum: 5, text: 'Is new hire orientation completed within 30 days?' },
    // Clause 11.1 - Site Requirements
    { clauseId: '11.1', qNum: 1, text: 'Is site registered with regulatory authority?' },
    { clauseId: '11.1', qNum: 2, text: 'Is facility risk assessment documented?' },
    { clauseId: '11.1', qNum: 3, text: 'Are operational procedures documented?' },
    { clauseId: '11.1', qNum: 4, text: 'Is preventive maintenance schedule followed?' },
    // Clause 11.2 - Building & Grounds
    { clauseId: '11.2', qNum: 1, text: 'Are grounds free from pest breeding areas?' },
    { clauseId: '11.2', qNum: 2, text: 'Are walls/floors/ceilings in good repair?' },
    { clauseId: '11.2', qNum: 3, text: 'Are production areas separated from non-food areas?' },
    { clauseId: '11.2', qNum: 4, text: 'Is adequate lighting maintained in all areas?' },
    { clauseId: '11.2', qNum: 5, text: 'Is ventilation adequate and maintained?' },
    { clauseId: '11.2', qNum: 6, text: 'Are drains functioning and cleaned regularly?' },
    { clauseId: '11.2', qNum: 7, text: 'Is hand washing facility accessible in production?' },
    { clauseId: '11.2', qNum: 8, text: 'Are restrooms separated from production areas?' },
    // Clause 11.3 - Pest Prevention
    { clauseId: '11.3', qNum: 1, text: 'Is pest control program documented?' },
    { clauseId: '11.3', qNum: 2, text: 'Are pest traps monitored weekly?' },
    { clauseId: '11.3', qNum: 3, text: 'Are pesticides stored safely outside production?' },
    { clauseId: '11.3', qNum: 4, text: 'Is pest control contractor qualified and certified?' },
    { clauseId: '11.3', qNum: 5, text: 'Are pest reports reviewed monthly?' },
    { clauseId: '11.3', qNum: 6, text: 'Is corrective action taken for pest findings?' },
    // Clause 11.4 - Personal Hygiene
    { clauseId: '11.4', qNum: 1, text: 'Is personal hygiene policy documented?' },
    { clauseId: '11.4', qNum: 2, text: 'Are health requirements checked at hiring?' },
    { clauseId: '11.4', qNum: 3, text: 'Is hygiene training provided to all staff?' },
    { clauseId: '11.4', qNum: 4, text: 'Is protective clothing provided and clean?' },
    { clauseId: '11.4', qNum: 5, text: 'Are hand washing signs visible in restrooms?' },
    // Clause 11.5 - Foreign Material Control
    { clauseId: '11.5', qNum: 1, text: 'Is foreign material control plan documented?' },
    { clauseId: '11.5', qNum: 2, text: 'Are metal detectors/x-rays used for finished product?' },
    { clauseId: '11.5', qNum: 3, text: 'Are glass/brittle items minimized in production?' },
    { clauseId: '11.5', qNum: 4, text: 'Is procedure in place for product recalls?' },
    // Clause 11.6 - Storage & Handling
    { clauseId: '11.6', qNum: 1, text: 'Is FIFO (First In First Out) practiced?' },
    { clauseId: '11.6', qNum: 2, text: 'Are storage areas organized and labeled?' },
    { clauseId: '11.6', qNum: 3, text: 'Are shelf life limits enforced?' },
    { clauseId: '11.6', qNum: 4, text: 'Are storage conditions monitored (temp/humidity)?' },
    { clauseId: '11.6', qNum: 5, text: 'Is damaged product removed and documented?' },
    // Clause 11.7 - Waste Management
    { clauseId: '11.7', qNum: 1, text: 'Is waste disposal procedure documented?' },
    { clauseId: '11.7', qNum: 2, text: 'Are waste containers separate from product areas?' },
    { clauseId: '11.7', qNum: 3, text: 'Is waste removal frequency adequate?' },
    // Clause 11.8 - Equipment & Maintenance
    { clauseId: '11.8', qNum: 1, text: 'Is equipment list documented with specs?' },
    { clauseId: '11.8', qNum: 2, text: 'Is preventive maintenance schedule followed?' },
    { clauseId: '11.8', qNum: 3, text: 'Is equipment calibration current?' },
    { clauseId: '11.8', qNum: 4, text: 'Are maintenance records available?' },
    { clauseId: '11.8', qNum: 5, text: 'Is cleaning procedure documented for all equipment?' }
  ];

  var AUDIT_SCHEDULES = [
    { type: 'SQF Certification', frequency: 'Annual', month: 'January', daysNotice: 30 },
    { type: 'Internal Audit', frequency: 'Quarterly', month: 'Jan/Apr/Jul/Oct', daysNotice: 14 },
    { type: 'GMP Audit', frequency: 'Monthly', month: 'Every month', daysNotice: 7 },
    { type: 'Management Review', frequency: 'Quarterly', month: 'Jan/Apr/Jul/Oct', daysNotice: 7 }
  ];

  // Seed data
  var SEED_AUDITS = [
    {
      id: 'AUD-20251105-001',
      type: 'Internal Audit',
      date: new Date(2025, 10, 5),
      auditor: 'Diana Park',
      status: 'Completed',
      score: 94,
      findings: [
        { id: 'F-001', severity: 'Minor NC', clause: '11.2', description: 'Minor wear on door seal', corrAction: 'Replace seal', status: 'Closed' }
      ]
    },
    {
      id: 'AUD-20251015-001',
      type: 'GMP Audit',
      date: new Date(2025, 9, 15),
      auditor: 'Randy Vazquez',
      status: 'Completed',
      score: 98,
      findings: []
    },
    {
      id: 'AUD-20260115-001',
      type: 'SQF Certification',
      date: new Date(2026, 0, 15),
      auditor: 'TBD',
      status: 'Scheduled',
      score: null,
      findings: []
    }
  ];

  function renderAudit() {
    var container = document.getElementById('v-audit');
    if(!container) return;
    var html = '<div class="audit-module">';
    html += '<div class="module-tabs">';
    html += '<button class="tab-btn active" data-tab="dashboard">Dashboard</button>';
    html += '<button class="tab-btn" data-tab="schedule">Audit Schedule</button>';
    html += '<button class="tab-btn" data-tab="runaudit">Run Audit</button>';
    html += '<button class="tab-btn" data-tab="findings">Findings</button>';
    html += '<button class="tab-btn" data-tab="review">Management Review</button>';
    html += '<button class="tab-btn" data-tab="clauses">SQF Clauses</button>';
    html += '</div>';
    html += '<div class="tab-content" id="tab-dashboard">' + renderDashboard() + '</div>';
    html += '<div class="tab-content hidden" id="tab-schedule">' + renderSchedule() + '</div>';
    html += '<div class="tab-content hidden" id="tab-runaudit">' + renderRunAudit() + '</div>';
    html += '<div class="tab-content hidden" id="tab-findings">' + renderFindings() + '</div>';
    html += '<div class="tab-content hidden" id="tab-review">' + renderManagementReview() + '</div>';
    html += '<div class="tab-content hidden" id="tab-clauses">' + renderSQFClauses() + '</div>';
    html += '</div>';
    html += '<style>' + getAuditCSS() + '</style>';
    container.innerHTML = html;
    attachAuditHandlers();
    if(window.SQF_EV) setTimeout(function(){SQF_EV.initAllPads();},80);
  }

  function renderDashboard() {
    var html = '<div class="audit-dashboard">';
    html += '<h2>Audit Dashboard</h2>';
    html += '<div class="dashboard-grid" id="audit-dash-kpis">';
    html += '<div class="card"><h3>Recent Audits</h3><p style="color:var(--tx3)">Loading...</p></div>';
    html += '<div class="card"><h3>Outstanding Findings</h3><p style="color:var(--tx3)">Loading...</p></div>';
    html += '<div class="card"><h3>Management Reviews</h3><p style="color:var(--tx3)">Loading...</p></div>';
    html += '</div>';
    html += '<div class="audit-list" id="audit-dash-list"><h3>Recent Audits & Reviews</h3><p style="color:var(--tx3)">Loading from Firestore...</p></div>';
    html += '</div>';

    // Async load from Firestore
    setTimeout(loadDashboardData, 100);
    return html;
  }

  function loadDashboardData() {
    if (!db) {
      renderDashboardFallback();
      return;
    }
    // Load audits and management reviews in parallel
    var auditsP = db.collection('audits').orderBy('createdAt','desc').limit(20).get().catch(function(){ return null; });
    var reviewsP = db.collection('managementReviews').orderBy('createdAt','desc').limit(10).get().catch(function(){ return null; });

    Promise.all([auditsP, reviewsP]).then(function(results) {
      var auditSnap = results[0];
      var reviewSnap = results[1];

      var audits = [];
      if (auditSnap) auditSnap.forEach(function(d) { audits.push(Object.assign({id:d.id}, d.data())); });
      var reviews = [];
      if (reviewSnap) reviewSnap.forEach(function(d) { reviews.push(Object.assign({id:d.id}, d.data())); });

      // Merge with seed data if no Firestore data
      var allAudits = audits.length ? audits : SEED_AUDITS;

      // KPI cards
      var kpiEl = document.getElementById('audit-dash-kpis');
      if (kpiEl) {
        var completed = allAudits.filter(function(a){ return a.status === 'Completed'; }).length;
        var scheduled = allAudits.filter(function(a){ return a.status === 'Scheduled'; }).length;
        var totalFindings = allAudits.reduce(function(sum, a){ return sum + (a.findings ? a.findings.length : (a.totalQuestions ? 1 : 0)); }, 0);
        var avgScore = 0;
        var scored = allAudits.filter(function(a){ return a.score || a.overallScore; });
        if (scored.length) avgScore = Math.round(scored.reduce(function(s,a){ return s + (a.score || a.overallScore || 0); }, 0) / scored.length);
        var scoreColor = avgScore >= 95 ? '#00e5ff' : avgScore >= 85 ? '#00e500' : '#ff6600';

        var h = '';
        h += '<div class="card"><h3>Audit Summary</h3>';
        h += '<div class="score-display" style="color:' + scoreColor + '">' + (avgScore || '—') + (avgScore ? '%' : '') + '</div>';
        h += '<p>Completed: ' + completed + ' · Scheduled: ' + scheduled + '</p></div>';

        h += '<div class="card"><h3>Findings</h3>';
        h += '<p style="font-size:24px;font-weight:800;color:var(--tx)">' + totalFindings + '</p>';
        h += '<p style="color:var(--tx3)">Total across all audits</p></div>';

        h += '<div class="card"><h3>Management Reviews</h3>';
        h += '<p style="font-size:24px;font-weight:800;color:var(--tx)">' + reviews.length + '</p>';
        h += '<p style="color:var(--tx3)">Completed reviews on file</p></div>';
        kpiEl.innerHTML = h;
      }

      // Audit + review list
      var listEl = document.getElementById('audit-dash-list');
      if (listEl) {
        var lh = '<h3>Recent Audits & Reviews</h3>';
        allAudits.slice(0, 5).forEach(function(audit) {
          var statusClass = audit.status === 'Completed' ? 'completed' : 'scheduled';
          lh += '<div class="audit-item ' + statusClass + '">';
          lh += '<div class="audit-header">';
          lh += '<span class="audit-id">' + esc(audit.id || audit.type || 'Audit') + '</span>';
          lh += '<span class="audit-type">' + esc(audit.type || audit.auditType || '') + '</span>';
          lh += '<span class="audit-status">' + esc(audit.status || 'Completed') + '</span>';
          var sc = audit.score || audit.overallScore;
          if (sc) lh += '<span class="audit-score">' + sc + '%</span>';
          lh += '</div>';
          lh += '<div class="audit-details">';
          lh += '<span>Date: ' + formatDate(audit.date || audit.createdAt) + '</span>';
          lh += '<span>Auditor: ' + esc(audit.auditor || audit.createdBy || '') + '</span>';
          lh += '</div></div>';
        });
        if (reviews.length) {
          lh += '<h3 style="margin-top:16px">Recent Management Reviews</h3>';
          reviews.slice(0, 5).forEach(function(r) {
            lh += '<div class="audit-item completed">';
            lh += '<div class="audit-header">';
            lh += '<span class="audit-id">Review</span>';
            lh += '<span class="audit-type">SQF 2.1.4</span>';
            lh += '<span class="audit-status">Completed</span>';
            lh += '</div>';
            lh += '<div class="audit-details">';
            lh += '<span>Date: ' + formatDate(r.date || r.createdAt) + '</span>';
            lh += '<span>Attendees: ' + esc((r.attendees || '').substring(0, 60)) + '</span>';
            lh += '</div></div>';
          });
        }
        if (!allAudits.length && !reviews.length) {
          lh += '<p style="color:var(--tx3)">No audits or reviews recorded yet.</p>';
        }
        listEl.innerHTML = lh;
      }
    });
  }

  function renderDashboardFallback() {
    // Fallback using seed data when Firestore is unavailable
    var kpiEl = document.getElementById('audit-dash-kpis');
    if (kpiEl) {
      var h = '<div class="card"><h3>Audit Summary</h3><div class="score-display" style="color:#00e500">—</div><p>Firestore unavailable</p></div>';
      h += '<div class="card"><h3>Findings</h3><p style="color:var(--tx3)">Connect Firestore to view live data</p></div>';
      h += '<div class="card"><h3>Management Reviews</h3><p style="color:var(--tx3)">—</p></div>';
      kpiEl.innerHTML = h;
    }
    var listEl = document.getElementById('audit-dash-list');
    if (listEl) {
      var lh = '<h3>Sample Audits (Seed Data)</h3>';
      SEED_AUDITS.forEach(function(audit) {
        lh += '<div class="audit-item"><div class="audit-header"><span class="audit-id">' + esc(audit.id) + '</span><span class="audit-type">' + esc(audit.type) + '</span><span class="audit-status">' + esc(audit.status) + '</span></div></div>';
      });
      listEl.innerHTML = lh;
    }
  }

  function renderSchedule() {
    var html = '<div class="audit-schedule">';
    html += '<h2>Audit Schedule</h2>';
    html += '<div class="schedule-grid">';
    AUDIT_SCHEDULES.forEach(function(sched) {
      html += '<div class="schedule-card">';
      html += '<h3>' + sched.type + '</h3>';
      html += '<p><strong>Frequency:</strong> ' + sched.frequency + '</p>';
      html += '<p><strong>Month:</strong> ' + sched.month + '</p>';
      html += '<p><strong>Notice:</strong> ' + sched.daysNotice + ' days</p>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderRunAudit() {
    var html = '<div class="run-audit">';
    html += '<h2>Run New Audit</h2>';
    html += '<form id="audit-form">';
    html += '<div class="form-group">';
    html += '<label>Audit Type:</label>';
    html += '<select id="audit-type" required>';
    html += '<option value="">-- Select --</option>';
    html += '<option value="Internal Audit">Internal Audit</option>';
    html += '<option value="SQF Certification">SQF Certification</option>';
    html += '<option value="GMP Audit">GMP Audit</option>';
    html += '</select>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Auditor:</label>';
    html += '<input type="text" id="audit-auditor" placeholder="Auditor name" required>';
    html += '</div>';
    html += '<button type="button" id="start-audit-btn" class="btn-primary">Start Audit</button>';
    html += '</form>';
    html += '<div id="audit-questions-container"></div>';
    html += '</div>';
    return html;
  }

  function renderFindings() {
    var html = '<div class="findings-module">';
    html += '<h2>Audit Findings & Corrective Actions</h2>';

    var allFindings = [];
    SEED_AUDITS.forEach(function(audit) {
      audit.findings.forEach(function(finding) {
        allFindings.push({
          id: finding.id,
          auditId: audit.id,
          severity: finding.severity,
          clause: finding.clause,
          description: finding.description,
          corrAction: finding.corrAction,
          status: finding.status
        });
      });
    });

    if (allFindings.length === 0) {
      html += '<p>No findings recorded.</p>';
    } else {
      html += '<table class="findings-table">';
      html += '<thead><tr><th>ID</th><th>Severity</th><th>Clause</th><th>Description</th><th>Corr. Action</th><th>Status</th></tr></thead>';
      html += '<tbody>';
      allFindings.forEach(function(f) {
        html += '<tr class="severity-' + f.severity.toLowerCase().replace(/ /g, '-') + '">';
        html += '<td>' + f.id + '</td>';
        html += '<td>' + f.severity + '</td>';
        html += '<td>' + f.clause + '</td>';
        html += '<td>' + f.description + '</td>';
        html += '<td>' + f.corrAction + '</td>';
        html += '<td>' + f.status + '</td>';
        html += '</tr>';
      });
      html += '</tbody>';
      html += '</table>';
    }

    html += '</div>';
    return html;
  }

  function renderManagementReview() {
    var html = '<div class="management-review">';
    html += '<h2>Management Review Meetings</h2>';
    html += '<form id="review-form">';
    html += '<div class="form-group">';
    html += '<label>Review Date:</label>';
    html += '<input type="date" id="review-date" required>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Attendees:</label>';
    html += '<textarea id="review-attendees" placeholder="List attendees" rows="3"></textarea>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Topics Discussed:</label>';
    html += '<textarea id="review-topics" placeholder="Food safety performance, audit results, customer complaints, etc." rows="4"></textarea>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Decisions & Actions:</label>';
    html += '<textarea id="review-decisions" placeholder="Decisions made, actions assigned" rows="4"></textarea>';
    html += '</div>';
    if(window.SQF_EV){
      html += SQF_EV.renderAttachmentZone('audit-review','management_review');
      html += SQF_EV.renderSignaturePad('audit-review','Reviewed By — E-Signature');
    }
    html += '<button type="button" class="btn-primary compliance-boundary" id="save-review-btn">Save Review</button>';
    html += '</form>';
    html += '</div>';
    return html;
  }

  function renderSQFClauses() {
    var html = '<div class="sqf-clauses">';
    html += '<h2>SQF Ed.10 Module Clauses</h2>';

    var module2 = SQF_CLAUSES.filter(function(c) { return c.section === 'Module 2'; });
    var module11 = SQF_CLAUSES.filter(function(c) { return c.section === 'Module 11'; });

    html += '<h3>Module 2 - Quality & Food Safety</h3>';
    html += '<div class="clauses-grid">';
    module2.forEach(function(clause) {
      html += '<div class="clause-card">';
      html += '<h4>' + clause.id + ': ' + clause.title + '</h4>';
      html += '<p>Questions: ' + clause.questions + '</p>';
      html += '</div>';
    });
    html += '</div>';

    html += '<h3>Module 11 - Site Requirements & Operation</h3>';
    html += '<div class="clauses-grid">';
    module11.forEach(function(clause) {
      html += '<div class="clause-card">';
      html += '<h4>' + clause.id + ': ' + clause.title + '</h4>';
      html += '<p>Questions: ' + clause.questions + '</p>';
      html += '</div>';
    });
    html += '</div>';

    html += '<p class="total-questions">Total Questions: ' + AUDIT_QUESTIONS.length + '</p>';
    html += '</div>';
    return html;
  }

  function attachAuditHandlers() {
    // Tab switching
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabName = this.getAttribute('data-tab');
        switchTab(tabName);
      });
    });

    // Start audit button
    var startAuditBtn = document.getElementById('start-audit-btn');
    if (startAuditBtn) {
      startAuditBtn.addEventListener('click', function() {
        var type = document.getElementById('audit-type').value;
        var auditor = document.getElementById('audit-auditor').value;
        if (!type || !auditor) {
          toast('Please fill in all fields', 'error');
          return;
        }
        renderAuditQuestions(type, auditor);
      });
    }

    // Save management review
    var saveReviewBtn = document.getElementById('save-review-btn');
    if (saveReviewBtn) {
      saveReviewBtn.addEventListener('click', function() {
        var date = document.getElementById('review-date').value;
        var attendees = document.getElementById('review-attendees').value;
        var topics = document.getElementById('review-topics').value;
        var decisions = document.getElementById('review-decisions').value;

        if (!date || !attendees || !topics || !decisions) {
          toast('Please fill in all fields', 'error');
          return;
        }

        var reviewData = {
          date: new Date(date),
          attendees: attendees,
          topics: topics,
          decisions: decisions,
          createdAt: new Date(),
          retentionYears: 7,
          sqfClause: '2.1.4'
        };
        if(window.SQF_EV){reviewData.evidence=SQF_EV.collectEvidence('audit-review');SQF_EV.uploadEvidence('audit-review','managementReview',{recordNum:'MR_'+date}).catch(function(){});SQF_EV.clearStash('audit-review');}

        db.collection('managementReviews').add(reviewData).then(function(docRef) {
          toast('Management review saved: ' + docRef.id, 'success');
          document.getElementById('review-form').reset();
        }).catch(function(error) {
          toast('Error saving review: ' + error.message, 'error');
        });
      });
    }
  }

  function switchTab(tabName) {
    var contents = document.querySelectorAll('.tab-content');
    contents.forEach(function(content) {
      content.classList.add('hidden');
    });
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    if(tabName==='review'&&window.SQF_EV) setTimeout(function(){SQF_EV.initAllPads();},50);

    var btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      }
    });
  }

  function renderAuditQuestions(type, auditor) {
    var container = document.getElementById('audit-questions-container');
    var html = '<div class="audit-questions">';
    html += '<h3>Audit Questions - ' + type + '</h3>';
    html += '<p>Auditor: ' + auditor + '</p>';
    html += '<form id="questions-form">';

    SQF_CLAUSES.forEach(function(clause) {
      var clauseQuestions = AUDIT_QUESTIONS.filter(function(q) { return q.clauseId === clause.id; });
      if (clauseQuestions.length > 0) {
        html += '<fieldset class="clause-fieldset">';
        html += '<legend>' + clause.id + ': ' + clause.title + '</legend>';
        clauseQuestions.forEach(function(q) {
          var qId = 'q_' + clause.id + '_' + q.qNum;
          html += '<div class="question-group">';
          html += '<label><strong>' + q.text + '</strong></label>';
          html += '<div class="radio-group">';
          html += '<label><input type="radio" name="' + qId + '" value="Compliant"> Compliant</label>';
          html += '<label><input type="radio" name="' + qId + '" value="Minor NC"> Minor NC</label>';
          html += '<label><input type="radio" name="' + qId + '" value="Major NC"> Major NC</label>';
          html += '<label><input type="radio" name="' + qId + '" value="N/A"> N/A</label>';
          html += '</div>';
          html += '<textarea placeholder="Notes" class="note-field" data-q="' + qId + '" rows="2"></textarea>';
          html += '</div>';
        });
        html += '</fieldset>';
      }
    });

    html += '<button type="button" id="submit-audit-btn" class="btn-primary">Submit Audit</button>';
    html += '</form>';
    html += '</div>';
    container.innerHTML = html;

    var submitBtn = container.querySelector('#submit-audit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        var responses = [];
        var radioButtons = container.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(function(rb) {
          if (rb.checked) {
            responses.push({ question: rb.name, answer: rb.value });
          }
        });

        if (responses.length < AUDIT_QUESTIONS.length) {
          toast('Please answer all questions', 'error');
          return;
        }

        var auditData = {
          type: type,
          auditor: auditor,
          date: new Date(),
          responses: responses,
          status: 'In Review'
        };

        db.collection('audits').add(auditData).then(function(docRef) {
          toast('Audit submitted: ' + docRef.id, 'success');
          setTimeout(function() { window.MFX_VIEW_RENDERERS.audit(); }, 1500);
        }).catch(function(error) {
          toast('Error saving audit: ' + error.message, 'error');
        });
      });
    }
  }

  function formatDate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var year = date.getFullYear();
    return month + '/' + day + '/' + year;
  }

  function getAuditCSS() {
    return `
      .audit-module { padding: 20px; }
      .module-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
      .tab-btn {
        padding: 8px 16px;
        background: var(--bg2);
        color: var(--tx);
        border: 2px solid var(--bg3);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;
      }
      .tab-btn.active {
        background: var(--ac);
        color: var(--bg);
        border-color: var(--ac);
      }
      .tab-btn:hover { background: var(--bg3); }
      .tab-content { animation: fadeIn 0.3s; }
      .tab-content.hidden { display: none; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

      .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
      .card {
        background: var(--bg2);
        padding: 20px;
        border-radius: 8px;
        border-left: 4px solid var(--ac);
      }
      .score-display { font-size: 32px; font-weight: bold; margin: 10px 0; }

      .audit-list { margin-top: 30px; }
      .audit-item {
        background: var(--bg2);
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 8px;
        border-left: 4px solid var(--bg3);
      }
      .audit-item.completed { border-left-color: var(--gn); }
      .audit-item.scheduled { border-left-color: var(--or); }
      .audit-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
      .audit-id { font-weight: bold; color: var(--ac); }
      .audit-status { padding: 2px 8px; background: var(--ac); color: var(--bg); border-radius: 3px; font-size: 12px; }
      .audit-score { color: var(--gn); font-weight: bold; }
      .audit-details { display: flex; gap: 20px; font-size: 14px; flex-wrap: wrap; }
      .findings-count { color: var(--or); font-weight: bold; }

      .schedule-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
      .schedule-card {
        background: var(--bg2);
        padding: 20px;
        border-radius: 8px;
        border-top: 3px solid var(--ac);
      }
      .schedule-card h3 { color: var(--ac); margin-top: 0; }
      .schedule-card p { margin: 8px 0; font-size: 14px; }

      .run-audit { max-width: 500px; }
      .form-group { margin-bottom: 15px; }
      .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
      .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--bg3);
        border-radius: 8px;
        background: var(--bg);
        color: var(--tx);
        font-family: inherit;
      }

      .audit-questions { background: var(--bg2); padding: 20px; border-radius: 8px; }
      .clause-fieldset {
        border: 1px solid var(--bg3);
        padding: 15px;
        margin-bottom: 15px;
        border-radius: 8px;
      }
      .clause-fieldset legend { padding: 0 10px; color: var(--ac); font-weight: bold; }
      .question-group { margin-bottom: 20px; }
      .question-group label { margin-bottom: 8px; display: block; }
      .radio-group { display: flex; gap: 20px; margin-bottom: 8px; flex-wrap: wrap; }
      .radio-group label { margin: 0; display: flex; align-items: center; gap: 5px; cursor: pointer; }
      .note-field { width: 100%; padding: 8px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: 8px; font-family: monospace; }

      .findings-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg2);
        margin-top: 15px;
      }
      .findings-table th, .findings-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
      }
      .findings-table th { background: var(--bg3); font-weight: bold; }
      .findings-table tr.severity-major-nc { background: rgba(255, 0, 0, 0.1); }
      .findings-table tr.severity-minor-nc { background: rgba(255, 102, 0, 0.1); }

      .clauses-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px; }
      .clause-card {
        background: var(--bg2);
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid var(--ac);
      }
      .clause-card h4 { margin-top: 0; color: var(--ac); }
      .total-questions { text-align: center; font-size: 18px; font-weight: bold; color: var(--ac); margin-top: 30px; }

      .btn-primary {
        background: var(--ac);
        color: var(--bg);
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
      }
      .btn-primary:hover { opacity: 0.8; transform: translateY(-2px); }
    `;
  }

  window.MFX_VIEW_RENDERERS.audit = renderAudit;
})();
