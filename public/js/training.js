(function() {
  'use strict';

  function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  var db = null;
  try { db = firebase.firestore(); } catch(e) { console.warn('Training: Firestore unavailable'); }

  // Persistence helpers
  var STORE_KEY = 'mfx_training_records';
  function loadRecords() {
    try { var d = localStorage.getItem(STORE_KEY); return d ? JSON.parse(d) : null; } catch(e) { return null; }
  }
  function saveRecords(records) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(records)); } catch(e) {}
    if (db) {
      db.collection('trainingRecords').doc('master').set({ records: records, updatedAt: new Date().toISOString() }, { merge: true })
        .catch(function(e) { console.warn('Training Firestore save:', e.message); });
    }
  }
  function initRecords() {
    var saved = loadRecords();
    if (saved && saved.length > 0) return saved;
    var records = SEED_TRAINING_RECORDS.map(function(r, i) {
      return Object.assign({}, r, {
        _id: 'TR' + String(i + 1).padStart(3, '0'),
        dateCompleted: r.dateCompleted ? r.dateCompleted.toISOString() : null,
        expiry: r.expiry ? r.expiry.toISOString() : null
      });
    });
    saveRecords(records);
    return records;
  }
  var liveRecords = null;

  // Training programs
  var TRAINING_PROGRAMS = [
    { id: 'GMP', name: 'Good Manufacturing Practices', mandatory: true, modules: 12, refreshFreq: 'Annual' },
    { id: 'SQF', name: 'SQF Awareness', mandatory: true, modules: 8, refreshFreq: 'Annual' },
    { id: 'FOOD', name: 'Food Safety Fundamentals', mandatory: true, modules: 10, refreshFreq: 'Annual' },
    { id: 'HACCP', name: 'HACCP Principles', mandatory: true, modules: 6, refreshFreq: 'Annual' },
    { id: 'PRESS', name: 'Press Operation', mandatory: false, modules: 15, refreshFreq: 'Biennial' },
    { id: 'QUAL', name: 'Quality Inspection', mandatory: false, modules: 10, refreshFreq: 'Biennial' },
    { id: 'FORK', name: 'Forklift Safety', mandatory: false, modules: 4, refreshFreq: 'Annual' },
    { id: 'CHEM', name: 'Chemical Handling', mandatory: false, modules: 7, refreshFreq: 'Annual' },
    { id: 'EMERG', name: 'Emergency Response', mandatory: true, modules: 5, refreshFreq: 'Annual' },
    { id: 'HIRE', name: 'New Hire Orientation', mandatory: true, modules: 9, refreshFreq: 'Per Hire' }
  ];

  // Sample modules per program
  var TRAINING_MODULES = {
    'GMP': [
      { id: 'M1', name: 'GMP Intro', duration: 30 },
      { id: 'M2', name: 'Facility Requirements', duration: 45 },
      { id: 'M3', name: 'Equipment Maintenance', duration: 40 },
      { id: 'M4', name: 'Sanitation Procedures', duration: 60 },
      { id: 'M5', name: 'Personal Hygiene', duration: 25 },
      { id: 'M6', name: 'Documentation', duration: 35 },
      { id: 'M7', name: 'Pest Control Measures', duration: 30 },
      { id: 'M8', name: 'Supplier Management', duration: 40 },
      { id: 'M9', name: 'Non-conformance Handling', duration: 35 },
      { id: 'M10', name: 'Traceability', duration: 45 },
      { id: 'M11', name: 'Records Management', duration: 30 },
      { id: 'M12', name: 'GMP Audit Preparation', duration: 50 }
    ],
    'SQF': [
      { id: 'M1', name: 'SQF Code Overview', duration: 40 },
      { id: 'M2', name: 'Module 2: Quality & Food Safety', duration: 90 },
      { id: 'M3', name: 'Module 11: Site Requirements', duration: 75 },
      { id: 'M4', name: 'Certification Process', duration: 45 },
      { id: 'M5', name: 'Documentation Requirements', duration: 50 },
      { id: 'M6', name: 'Internal Audits for SQF', duration: 60 },
      { id: 'M7', name: 'Findings & Corrective Actions', duration: 40 },
      { id: 'M8', name: 'Management Review', duration: 35 }
    ],
    'FOOD': [
      { id: 'M1', name: 'Foodborne Pathogen Overview', duration: 45 },
      { id: 'M2', name: 'Hazard Analysis', duration: 60 },
      { id: 'M3', name: 'Critical Control Points', duration: 50 },
      { id: 'M4', name: 'Monitoring & Verification', duration: 55 },
      { id: 'M5', name: 'Cross-Contamination Prevention', duration: 40 },
      { id: 'M6', name: 'Allergen Awareness', duration: 35 },
      { id: 'M7', name: 'Food Defense', duration: 40 },
      { id: 'M8', name: 'Cleaning & Sanitation', duration: 45 },
      { id: 'M9', name: 'Recall Procedures', duration: 40 },
      { id: 'M10', name: 'Food Safety Assessment', duration: 30 }
    ],
    'HACCP': [
      { id: 'M1', name: 'HACCP Principles', duration: 60 },
      { id: 'M2', name: 'Hazard Identification', duration: 50 },
      { id: 'M3', name: 'CCP Determination', duration: 55 },
      { id: 'M4', name: 'Critical Limits & Monitoring', duration: 60 },
      { id: 'M5', name: 'Corrective Actions', duration: 45 },
      { id: 'M6', name: 'HACCP Plan Documentation', duration: 40 }
    ]
  };

  // Seed employees with training records
  var SEED_EMPLOYEES = [
    { id: 'E001', name: 'Randy Vazquez', role: 'Production Manager', hireDate: new Date(2022, 0, 15) },
    { id: 'E002', name: 'Marco Rodriguez', role: 'Press Operator', hireDate: new Date(2023, 5, 1) },
    { id: 'E003', name: 'Alex Martinez', role: 'Quality Inspector', hireDate: new Date(2023, 8, 10) },
    { id: 'E004', name: 'Diana Park', role: 'Quality Supervisor', hireDate: new Date(2021, 11, 1) },
    { id: 'E005', name: 'Jake Torres', role: 'Maintenance Tech', hireDate: new Date(2023, 2, 20) },
    { id: 'E006', name: 'Chris Walton', role: 'Shipping Lead', hireDate: new Date(2022, 6, 15) }
  ];

  var SEED_TRAINING_RECORDS = [
    { empId: 'E001', progId: 'GMP', status: 'Completed', dateCompleted: new Date(2025, 10, 1), score: 92, expiry: new Date(2026, 10, 1) },
    { empId: 'E001', progId: 'SQF', status: 'Completed', dateCompleted: new Date(2025, 9, 15), score: 88, expiry: new Date(2026, 9, 15) },
    { empId: 'E001', progId: 'FOOD', status: 'Completed', dateCompleted: new Date(2025, 8, 1), score: 95, expiry: new Date(2026, 8, 1) },
    { empId: 'E001', progId: 'HACCP', status: 'Completed', dateCompleted: new Date(2025, 7, 10), score: 90, expiry: new Date(2026, 7, 10) },

    { empId: 'E002', progId: 'HIRE', status: 'Completed', dateCompleted: new Date(2023, 5, 5), score: 85, expiry: null },
    { empId: 'E002', progId: 'GMP', status: 'Completed', dateCompleted: new Date(2024, 9, 1), score: 87, expiry: new Date(2025, 9, 1) },
    { empId: 'E002', progId: 'GMP', status: 'Due', dateCompleted: null, score: null, expiry: new Date(2025, 9, 1) },
    { empId: 'E002', progId: 'PRESS', status: 'Completed', dateCompleted: new Date(2024, 0, 15), score: 91, expiry: new Date(2026, 0, 15) },
    { empId: 'E002', progId: 'FOOD', status: 'Due', dateCompleted: null, score: null, expiry: new Date(2025, 8, 1) },

    { empId: 'E003', progId: 'HIRE', status: 'Completed', dateCompleted: new Date(2023, 8, 15), score: 89, expiry: null },
    { empId: 'E003', progId: 'QUAL', status: 'Completed', dateCompleted: new Date(2024, 1, 1), score: 94, expiry: new Date(2026, 1, 1) },
    { empId: 'E003', progId: 'FOOD', status: 'Completed', dateCompleted: new Date(2024, 11, 1), score: 92, expiry: new Date(2025, 11, 1) },
    { empId: 'E003', progId: 'GMP', status: 'Overdue', dateCompleted: null, score: null, expiry: new Date(2025, 8, 1) },

    { empId: 'E004', progId: 'GMP', status: 'Completed', dateCompleted: new Date(2025, 10, 1), score: 96, expiry: new Date(2026, 10, 1) },
    { empId: 'E004', progId: 'SQF', status: 'Completed', dateCompleted: new Date(2025, 9, 15), score: 94, expiry: new Date(2026, 9, 15) },
    { empId: 'E004', progId: 'FOOD', status: 'Completed', dateCompleted: new Date(2025, 8, 1), score: 98, expiry: new Date(2026, 8, 1) },
    { empId: 'E004', progId: 'HACCP', status: 'Completed', dateCompleted: new Date(2025, 7, 10), score: 95, expiry: new Date(2026, 7, 10) },
    { empId: 'E004', progId: 'EMERG', status: 'Completed', dateCompleted: new Date(2025, 5, 1), score: 92, expiry: new Date(2026, 5, 1) },

    { empId: 'E005', progId: 'HIRE', status: 'Completed', dateCompleted: new Date(2023, 2, 25), score: 83, expiry: null },
    { empId: 'E005', progId: 'FORK', status: 'Completed', dateCompleted: new Date(2024, 3, 1), score: 90, expiry: new Date(2025, 3, 1) },
    { empId: 'E005', progId: 'CHEM', status: 'Completed', dateCompleted: new Date(2024, 6, 15), score: 88, expiry: new Date(2025, 6, 15) },
    { empId: 'E005', progId: 'GMP', status: 'Due', dateCompleted: null, score: null, expiry: new Date(2025, 9, 1) },

    { empId: 'E006', progId: 'HIRE', status: 'Completed', dateCompleted: new Date(2022, 6, 20), score: 84, expiry: null },
    { empId: 'E006', progId: 'GMP', status: 'Completed', dateCompleted: new Date(2025, 10, 1), score: 89, expiry: new Date(2026, 10, 1) },
    { empId: 'E006', progId: 'FOOD', status: 'Completed', dateCompleted: new Date(2025, 8, 1), score: 90, expiry: new Date(2026, 8, 1) },
    { empId: 'E006', progId: 'EMERG', status: 'Completed', dateCompleted: new Date(2025, 5, 1), score: 91, expiry: new Date(2026, 5, 1) }
  ];

  function getRecords() {
    if (!liveRecords) liveRecords = initRecords();
    return liveRecords;
  }

  function recordTraining(empId, progId) {
    var records = getRecords();
    var newRec = {
      _id: 'TR' + String(records.length + 1).padStart(3, '0'),
      empId: empId,
      progId: progId,
      status: 'Completed',
      dateCompleted: new Date().toISOString(),
      score: null,
      expiry: calcExpiry(progId)
    };
    // Mark any existing Due/Overdue for same emp+prog as superseded
    records.forEach(function(r) {
      if (r.empId === empId && r.progId === progId && (r.status === 'Due' || r.status === 'Overdue')) {
        r.status = 'Completed';
        r.dateCompleted = new Date().toISOString();
        r.expiry = calcExpiry(progId);
      }
    });
    records.push(newRec);
    liveRecords = records;
    saveRecords(records);
    if (typeof toast === 'function') toast('Training recorded', 'ok');
    renderTraining();
  }

  function calcExpiry(progId) {
    var prog = TRAINING_PROGRAMS.find(function(p) { return p.id === progId; });
    if (!prog || prog.refreshFreq === 'Per Hire') return null;
    var d = new Date();
    if (prog.refreshFreq === 'Biennial') d.setFullYear(d.getFullYear() + 2);
    else d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }

  window.recordTraining = recordTraining;

  function renderTraining() {
    var container = document.getElementById('v-training');
    if(!container) return;
    var html = '<div class="training-module">';
    html += '<div class="module-tabs">';
    html += '<button class="tab-btn active" data-tab="dashboard">Dashboard</button>';
    html += '<button class="tab-btn" data-tab="programs">Programs</button>';
    html += '<button class="tab-btn" data-tab="modules">Modules</button>';
    html += '<button class="tab-btn" data-tab="records">Records</button>';
    html += '<button class="tab-btn" data-tab="compliance">Compliance Matrix</button>';
    html += '<button class="tab-btn" data-tab="dueoverdue">Due/Overdue</button>';
    html += '</div>';
    html += '<div class="tab-content" id="tab-dashboard">' + renderDashboard() + '</div>';
    html += '<div class="tab-content hidden" id="tab-programs">' + renderPrograms() + '</div>';
    html += '<div class="tab-content hidden" id="tab-modules">' + renderModules() + '</div>';
    html += '<div class="tab-content hidden" id="tab-records">' + renderRecords() + '</div>';
    html += '<div class="tab-content hidden" id="tab-compliance">' + renderComplianceMatrix() + '</div>';
    html += '<div class="tab-content hidden" id="tab-dueoverdue">' + renderDueOverdue() + '</div>';
    html += '</div>';
    html += '<style>' + getTrainingCSS() + '</style>';
    container.innerHTML = html;
    attachTrainingHandlers();
  }

  function renderDashboard() {
    var html = '<div class="training-dashboard">';
    html += '<h2>Training & Competency Dashboard</h2>';
    html += '<div class="dashboard-grid">';

    // Training completion rate
    var totalRecords = getRecords().length;
    var completed = getRecords().filter(function(r) { return r.status === 'Completed'; }).length;
    var completionRate = Math.round((completed / totalRecords) * 100);

    html += '<div class="card">';
    html += '<h3>Overall Completion</h3>';
    html += '<div class="score-display" style="color: var(--gn);">' + completionRate + '%</div>';
    html += '<p>' + completed + ' of ' + totalRecords + ' trainings completed</p>';
    html += '</div>';

    // Due trainings
    var due = getRecords().filter(function(r) { return r.status === 'Due'; }).length;
    html += '<div class="card">';
    html += '<h3>Due Trainings</h3>';
    html += '<div class="score-display" style="color: var(--or);">' + due + '</div>';
    html += '<p>Scheduled within next 30 days</p>';
    html += '</div>';

    // Overdue trainings
    var overdue = getRecords().filter(function(r) { return r.status === 'Overdue'; }).length;
    html += '<div class="card">';
    html += '<h3>Overdue Trainings</h3>';
    html += '<div class="score-display" style="color: var(--rd);">' + overdue + '</div>';
    html += '<p>Immediate action required</p>';
    html += '</div>';

    // Employee count
    html += '<div class="card">';
    html += '<h3>Team Size</h3>';
    html += '<div class="score-display" style="color: var(--ac);">' + SEED_EMPLOYEES.length + '</div>';
    html += '<p>Active employees</p>';
    html += '</div>';

    html += '</div>';

    // Employee snapshot
    html += '<div class="training-list">';
    html += '<h3>Employee Training Status</h3>';
    html += '<table class="employees-table">';
    html += '<thead><tr><th>Employee</th><th>Role</th><th>Hire Date</th><th>Completed Programs</th><th>Due/Overdue</th></tr></thead>';
    html += '<tbody>';

    SEED_EMPLOYEES.forEach(function(emp) {
      var empRecords = getRecords().filter(function(r) { return r.empId === emp.id; });
      var empCompleted = empRecords.filter(function(r) { return r.status === 'Completed'; }).length;
      var empDue = empRecords.filter(function(r) { return r.status === 'Due' || r.status === 'Overdue'; }).length;
      var statusClass = empDue === 0 ? 'compliant' : empDue > 1 ? 'overdue' : 'due';

      html += '<tr class="status-' + statusClass + '">';
      html += '<td><strong>' + emp.name + '</strong></td>';
      html += '<td>' + emp.role + '</td>';
      html += '<td>' + formatDate(emp.hireDate) + '</td>';
      html += '<td><span class="badge-green">' + empCompleted + '</span></td>';
      html += '<td><span class="badge-orange">' + empDue + '</span></td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderPrograms() {
    var html = '<div class="training-programs">';
    html += '<h2>Training Programs</h2>';
    html += '<p>10 structured programs with ' + getTotalModules() + ' total modules</p>';

    html += '<div class="programs-grid">';
    TRAINING_PROGRAMS.forEach(function(prog) {
      var mandatoryClass = prog.mandatory ? 'mandatory' : 'optional';
      html += '<div class="program-card ' + mandatoryClass + '">';
      html += '<div class="program-header">';
      html += '<h3>' + prog.name + '</h3>';
      if (prog.mandatory) {
        html += '<span class="badge-required">Required</span>';
      } else {
        html += '<span class="badge-optional">Optional</span>';
      }
      html += '</div>';
      html += '<p><strong>' + prog.modules + ' Modules</strong></p>';
      html += '<p>Refresh: ' + prog.refreshFreq + '</p>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function getTotalModules() {
    var total = 0;
    TRAINING_PROGRAMS.forEach(function(prog) {
      total += prog.modules;
    });
    return total;
  }

  function renderModules() {
    var html = '<div class="training-modules">';
    html += '<h2>Training Modules</h2>';

    Object.keys(TRAINING_MODULES).forEach(function(progId) {
      var progName = TRAINING_PROGRAMS.find(function(p) { return p.id === progId; }).name;
      var modules = TRAINING_MODULES[progId];

      html += '<div class="modules-section">';
      html += '<h3>' + progName + ' (' + modules.length + ' modules)</h3>';
      html += '<div class="modules-list">';

      modules.forEach(function(mod) {
        html += '<div class="module-item">';
        html += '<strong>' + mod.name + '</strong>';
        html += '<span class="module-duration">' + mod.duration + ' min</span>';
        html += '</div>';
      });

      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  function renderRecords() {
    var html = '<div class="training-records">';
    html += '<h2>Employee Training Records</h2>';
    html += '<form id="filter-form">';
    html += '<label>Filter by Employee:</label>';
    html += '<select id="emp-filter">';
    html += '<option value="">-- All Employees --</option>';
    SEED_EMPLOYEES.forEach(function(emp) {
      html += '<option value="' + emp.id + '">' + emp.name + '</option>';
    });
    html += '</select>';
    html += '</form>';

    html += '<table class="records-table">';
    html += '<thead><tr><th>Employee</th><th>Program</th><th>Status</th><th>Date Completed</th><th>Score</th><th>Expiry Date</th></tr></thead>';
    html += '<tbody>';

    var filteredRecords = getRecords().slice();
    filteredRecords.forEach(function(rec) {
      var emp = SEED_EMPLOYEES.find(function(e) { return e.id === rec.empId; });
      var prog = TRAINING_PROGRAMS.find(function(p) { return p.id === rec.progId; });
      var statusClass = 'status-' + rec.status.toLowerCase().replace(/ /g, '-');

      html += '<tr class="' + statusClass + '">';
      html += '<td>' + emp.name + '</td>';
      html += '<td>' + prog.name + '</td>';
      html += '<td><span class="badge-status">' + rec.status + '</span></td>';
      html += '<td>' + (rec.dateCompleted ? formatDate(rec.dateCompleted) : '-') + '</td>';
      html += '<td>' + (rec.score ? rec.score + '%' : '-') + '</td>';
      html += '<td>' + (rec.expiry ? formatDate(rec.expiry) : '-') + '</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  function renderComplianceMatrix() {
    var html = '<div class="compliance-matrix">';
    html += '<h2>Compliance Matrix - Employee × Training</h2>';
    html += '<p>Green = Completed, Yellow = Due, Red = Overdue</p>';

    html += '<div class="matrix-scroll">';
    html += '<table class="compliance-table">';
    html += '<thead><tr><th>Employee</th>';

    TRAINING_PROGRAMS.forEach(function(prog) {
      html += '<th title="' + prog.name + '">' + prog.id + '</th>';
    });
    html += '</tr></thead>';
    html += '<tbody>';

    SEED_EMPLOYEES.forEach(function(emp) {
      html += '<tr>';
      html += '<td class="emp-name"><strong>' + emp.name + '</strong></td>';

      TRAINING_PROGRAMS.forEach(function(prog) {
        var matchingRecords = getRecords().filter(function(r) {
          return r.empId === emp.id && r.progId === prog.id;
        });
        var rec = matchingRecords.length > 0 ? matchingRecords.sort(function(a, b) {
          var dateA = a.dateCompleted ? new Date(a.dateCompleted).getTime() : 0;
          var dateB = b.dateCompleted ? new Date(b.dateCompleted).getTime() : 0;
          return dateB - dateA;
        })[0] : null;

        var statusClass = 'not-started';
        var symbol = '-';
        if (rec) {
          if (rec.status === 'Completed') {
            statusClass = 'completed';
            symbol = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          } else if (rec.status === 'Due') {
            statusClass = 'due';
            symbol = '!';
          } else if (rec.status === 'Overdue') {
            statusClass = 'overdue';
            symbol = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          }
        }

        html += '<td class="matrix-cell status-' + statusClass + '">' + symbol + '</td>';
      });

      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    html += '<div class="matrix-legend">';
    html += '<div><span class="legend-box completed"></span> Completed</div>';
    html += '<div><span class="legend-box due"></span> Due</div>';
    html += '<div><span class="legend-box overdue"></span> Overdue</div>';
    html += '<div><span class="legend-box not-started"></span> Not Started</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderDueOverdue() {
    var html = '<div class="due-overdue">';
    html += '<h2>Due & Overdue Trainings</h2>';

    var dueRecords = getRecords().filter(function(r) { return r.status === 'Due' || r.status === 'Overdue'; });

    if (dueRecords.length === 0) {
      html += '<p>No due or overdue trainings.</p>';
    } else {
      html += '<div class="alerts-grid">';

      var overdue = dueRecords.filter(function(r) { return r.status === 'Overdue'; });
      if (overdue.length > 0) {
        html += '<div class="alert-section overdue">';
        html += '<h3>OVERDUE (' + overdue.length + ')</h3>';
        overdue.forEach(function(rec) {
          var emp = SEED_EMPLOYEES.find(function(e) { return e.id === rec.empId; });
          var prog = TRAINING_PROGRAMS.find(function(p) { return p.id === rec.progId; });
          html += '<div class="alert-item">';
          html += '<p><strong>' + emp.name + '</strong> - ' + prog.name + '</p>';
          html += '<p class="expired">Expired: ' + formatDate(rec.expiry) + '</p>';
          html += '<button class="btn-record" onclick="recordTraining(\'' + rec.empId + '\',\'' + rec.progId + '\')">Mark Complete</button>';
          html += '</div>';
        });
        html += '</div>';
      }

      var due = dueRecords.filter(function(r) { return r.status === 'Due'; });
      if (due.length > 0) {
        html += '<div class="alert-section due">';
        html += '<h3>DUE (Next 30 days) (' + due.length + ')</h3>';
        due.forEach(function(rec) {
          var emp = SEED_EMPLOYEES.find(function(e) { return e.id === rec.empId; });
          var prog = TRAINING_PROGRAMS.find(function(p) { return p.id === rec.progId; });
          html += '<div class="alert-item">';
          html += '<p><strong>' + emp.name + '</strong> - ' + prog.name + '</p>';
          html += '<p class="due-date">Due: ' + formatDate(rec.expiry) + '</p>';
          html += '<button class="btn-record" onclick="recordTraining(\'' + rec.empId + '\',\'' + rec.progId + '\')">Mark Complete</button>';
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function attachTrainingHandlers() {
    // Tab switching
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabName = this.getAttribute('data-tab');
        switchTab(tabName);
      });
    });

    // Filter handler
    var empFilter = document.getElementById('emp-filter');
    if (empFilter) {
      empFilter.addEventListener('change', function() {
        var selectedEmp = this.value;
        var rows = document.querySelectorAll('.records-table tbody tr');
        rows.forEach(function(row) {
          if (selectedEmp === '') {
            row.style.display = '';
          } else {
            var empName = SEED_EMPLOYEES.find(function(e) { return e.id === selectedEmp; }).name;
            if (row.cells[0].textContent.includes(empName)) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          }
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

    var btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      }
    });
  }

  function formatDate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var year = date.getFullYear();
    return month + '/' + day + '/' + year;
  }

  function getTrainingCSS() {
    return `
      .training-module { padding: 20px; }
      .module-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
      .tab-btn {
        padding: 8px 16px;
        background: var(--bg2);
        color: var(--tx);
        border: 2px solid var(--bg3);
        border-radius: var(--bdr);
        cursor: pointer;
        transition: all 0.3s;
        font-weight: 500;
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

      .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
      .card {
        background: var(--bg2);
        padding: 20px;
        border-radius: var(--bdr);
        border-left: 4px solid var(--ac);
      }
      .score-display { font-size: 36px; font-weight: bold; margin: 10px 0; }
      .card p { margin: 5px 0; font-size: 14px; }

      .training-list { margin-top: 30px; }
      .employees-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg2);
        margin-top: 15px;
      }
      .employees-table th, .employees-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
      }
      .employees-table th { background: var(--bg3); font-weight: bold; }
      .employees-table tr.status-compliant { background: rgba(0, 229, 0, 0.05); }
      .employees-table tr.status-due { background: rgba(255, 102, 0, 0.08); }
      .employees-table tr.status-overdue { background: rgba(255, 0, 0, 0.1); }

      .programs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-top: 20px; }
      .program-card {
        background: var(--bg2);
        padding: 20px;
        border-radius: var(--bdr);
        border-top: 3px solid var(--ac);
        transition: all 0.3s;
      }
      .program-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0, 229, 255, 0.2); }
      .program-card.mandatory { border-top-color: var(--ac); }
      .program-card.optional { border-top-color: var(--or); }
      .program-header { display: flex; justify-content: space-between; align-items: start; gap: 10px; margin-bottom: 10px; }
      .program-header h3 { margin: 0; color: var(--ac); }
      .badge-required { background: var(--ac); color: var(--bg); padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
      .badge-optional { background: var(--or); color: var(--bg); padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }

      .modules-section { margin-bottom: 30px; }
      .modules-section h3 { color: var(--ac); border-bottom: 2px solid var(--bg3); padding-bottom: 10px; }
      .modules-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
      .module-item {
        background: var(--bg2);
        padding: 12px;
        border-radius: var(--bdr);
        border-left: 3px solid var(--ac);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .module-duration { background: var(--bg3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: var(--tx2); }

      .records-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg2);
        margin-top: 15px;
      }
      .records-table th, .records-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
        font-size: 14px;
      }
      .records-table th { background: var(--bg3); font-weight: bold; }
      .records-table tr.status-completed { background: rgba(0, 229, 0, 0.05); }
      .records-table tr.status-due { background: rgba(255, 102, 0, 0.08); }
      .records-table tr.status-overdue { background: rgba(255, 0, 0, 0.1); }
      .badge-status { padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; background: var(--bg3); }

      #filter-form { margin-bottom: 20px; }
      #filter-form label { margin-right: 10px; font-weight: bold; }
      #filter-form select {
        padding: 8px 12px;
        background: var(--bg);
        color: var(--tx);
        border: 1px solid var(--bg3);
        border-radius: var(--bdr);
      }

      .matrix-scroll { overflow-x: auto; margin: 20px 0; }
      .compliance-table {
        border-collapse: collapse;
        background: var(--bg2);
        min-width: 800px;
      }
      .compliance-table th, .compliance-table td {
        padding: 10px;
        border: 1px solid var(--bg3);
        text-align: center;
        font-size: 12px;
      }
      .compliance-table th { background: var(--bg3); font-weight: bold; }
      .compliance-table .emp-name { text-align: left; background: var(--bg3); }
      .matrix-cell.status-completed { background: rgba(0, 229, 0, 0.3); color: var(--gn); font-weight: bold; }
      .matrix-cell.status-due { background: rgba(255, 102, 0, 0.3); color: var(--or); font-weight: bold; }
      .matrix-cell.status-overdue { background: rgba(255, 0, 0, 0.3); color: var(--rd); font-weight: bold; }
      .matrix-cell.status-not-started { background: var(--bg); color: var(--tx2); }

      .matrix-legend { display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap; }
      .matrix-legend > div { display: flex; align-items: center; gap: 8px; }
      .legend-box { width: 16px; height: 16px; border-radius: 2px; }
      .legend-box.completed { background: rgba(0, 229, 0, 0.3); }
      .legend-box.due { background: rgba(255, 102, 0, 0.3); }
      .legend-box.overdue { background: rgba(255, 0, 0, 0.3); }
      .legend-box.not-started { background: var(--bg); border: 1px solid var(--bg3); }

      .alerts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
      .alert-section {
        background: var(--bg2);
        padding: 20px;
        border-radius: var(--bdr);
      }
      .alert-section.overdue { border-left: 4px solid var(--rd); }
      .alert-section.due { border-left: 4px solid var(--or); }
      .alert-section h3 { margin-top: 0; }
      .alert-item {
        background: var(--bg);
        padding: 12px;
        margin-bottom: 10px;
        border-radius: var(--bdr);
        border-left: 3px solid var(--ac);
      }
      .alert-item p { margin: 5px 0; font-size: 14px; }
      .expired { color: var(--rd); font-weight: bold; }
      .due-date { color: var(--or); font-weight: bold; }

      .badge-green { background: rgba(0, 229, 0, 0.2); color: var(--gn); padding: 2px 6px; border-radius: 3px; font-weight: bold; }
      .badge-orange { background: rgba(255, 102, 0, 0.2); color: var(--or); padding: 2px 6px; border-radius: 3px; font-weight: bold; }
      .btn-record { margin-top:8px; padding:5px 12px; background:var(--ac); color:var(--bg); border:none; border-radius:var(--bdr); cursor:pointer; font-size:12px; font-weight:bold; }
      .btn-record:hover { opacity:0.85; }
    `;
  }

  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_RENDERERS.training = renderTraining;
})();
