(function() {
  'use strict';

  function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  var db = firebase.firestore();

  // Document types
  var DOC_TYPES = ['SOP', 'Policy', 'Form', 'Record', 'Specification'];
  var DOC_STATUSES = ['Draft', 'Review', 'Approved', 'Obsolete'];

  // Seed documents
  var SEED_DOCUMENTS = [
    {
      id: 'DOC-001',
      title: 'GMP Procedures',
      type: 'SOP',
      revision: 3,
      status: 'Approved',
      owner: 'Diana Park',
      effectiveDate: new Date(2025, 8, 1),
      reviewDueDate: new Date(2026, 8, 1),
      pages: 24
    },
    {
      id: 'DOC-002',
      title: 'Cleaning & Sanitation',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Randy Vazquez',
      effectiveDate: new Date(2025, 6, 15),
      reviewDueDate: new Date(2026, 6, 15),
      pages: 18
    },
    {
      id: 'DOC-003',
      title: 'Pest Control Program',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Chris Walton',
      effectiveDate: new Date(2025, 5, 1),
      reviewDueDate: new Date(2026, 5, 1),
      pages: 12
    },
    {
      id: 'DOC-004',
      title: 'Receiving & Inspection',
      type: 'SOP',
      revision: 1,
      status: 'Approved',
      owner: 'Marco Rodriguez',
      effectiveDate: new Date(2025, 9, 1),
      reviewDueDate: new Date(2026, 9, 1),
      pages: 16
    },
    {
      id: 'DOC-005',
      title: 'Ink Mixing Procedure',
      type: 'SOP',
      revision: 3,
      status: 'Approved',
      owner: 'Randy Vazquez',
      effectiveDate: new Date(2025, 4, 1),
      reviewDueDate: new Date(2026, 4, 1),
      pages: 14
    },
    {
      id: 'DOC-006',
      title: 'Press Setup & Operation',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Marco Rodriguez',
      effectiveDate: new Date(2025, 7, 1),
      reviewDueDate: new Date(2026, 7, 1),
      pages: 22
    },
    {
      id: 'DOC-007',
      title: 'Quality Inspection',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Alex Martinez',
      effectiveDate: new Date(2025, 8, 15),
      reviewDueDate: new Date(2026, 8, 15),
      pages: 20
    },
    {
      id: 'DOC-008',
      title: 'Product Shipping',
      type: 'SOP',
      revision: 1,
      status: 'Approved',
      owner: 'Chris Walton',
      effectiveDate: new Date(2025, 9, 1),
      reviewDueDate: new Date(2026, 9, 1),
      pages: 12
    },
    {
      id: 'DOC-009',
      title: 'CAPA Procedure',
      type: 'SOP',
      revision: 3,
      status: 'Approved',
      owner: 'Diana Park',
      effectiveDate: new Date(2025, 3, 1),
      reviewDueDate: new Date(2026, 3, 1),
      pages: 15
    },
    {
      id: 'DOC-010',
      title: 'Internal Audit',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Diana Park',
      effectiveDate: new Date(2025, 7, 1),
      reviewDueDate: new Date(2026, 7, 1),
      pages: 18
    },
    {
      id: 'DOC-011',
      title: 'Management Review',
      type: 'SOP',
      revision: 1,
      status: 'Approved',
      owner: 'Randy Vazquez',
      effectiveDate: new Date(2025, 9, 15),
      reviewDueDate: new Date(2026, 9, 15),
      pages: 10
    },
    {
      id: 'DOC-012',
      title: 'Training Program',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Diana Park',
      effectiveDate: new Date(2025, 6, 1),
      reviewDueDate: new Date(2026, 6, 1),
      pages: 16
    },
    {
      id: 'DOC-013',
      title: 'Document Control',
      type: 'SOP',
      revision: 2,
      status: 'Approved',
      owner: 'Diana Park',
      effectiveDate: new Date(2025, 5, 1),
      reviewDueDate: new Date(2026, 5, 1),
      pages: 14
    },
    {
      id: 'DOC-014',
      title: 'Food Safety Policy',
      type: 'Policy',
      revision: 2,
      status: 'Approved',
      owner: 'Randy Vazquez',
      effectiveDate: new Date(2024, 0, 1),
      reviewDueDate: new Date(2026, 0, 1),
      pages: 8
    },
    {
      id: 'DOC-015',
      title: 'Quality Assurance Policy',
      type: 'Policy',
      revision: 1,
      status: 'Review',
      owner: 'Diana Park',
      effectiveDate: new Date(2026, 2, 1),
      reviewDueDate: new Date(2027, 2, 1),
      pages: 6
    }
  ];

  // Seed DCR records
  var SEED_DCRS = [
    {
      id: 'DCR-20251201-001',
      title: 'Update Cleaning Procedures for New Equipment',
      submittedBy: 'Marco Rodriguez',
      submittedDate: new Date(2025, 10, 25),
      status: 'Approved',
      affectedDoc: 'DOC-002',
      changeReason: 'New press requires updated sanitation protocol',
      stages: {
        submit: { date: new Date(2025, 10, 25), by: 'Marco Rodriguez' },
        review: { date: new Date(2025, 10, 26), by: 'Diana Park', approved: true },
        approve: { date: new Date(2025, 10, 27), by: 'Randy Vazquez' },
        implement: { date: new Date(2025, 10, 28), by: 'Diana Park' }
      }
    },
    {
      id: 'DCR-20251215-001',
      title: 'Add Metal Detector Check to Inspection SOP',
      submittedBy: 'Alex Martinez',
      submittedDate: new Date(2025, 10, 15),
      status: 'Review',
      affectedDoc: 'DOC-007',
      changeReason: 'Enhance foreign material control',
      stages: {
        submit: { date: new Date(2025, 10, 15), by: 'Alex Martinez' },
        review: { date: new Date(2025, 10, 16), by: 'Diana Park', approved: false }
      }
    },
    {
      id: 'DCR-20251120-001',
      title: 'Minor Edits to Press Setup SOP',
      submittedBy: 'Marco Rodriguez',
      submittedDate: new Date(2025, 9, 15),
      status: 'Closed',
      affectedDoc: 'DOC-006',
      changeReason: 'Clarify changeover procedures',
      stages: {
        submit: { date: new Date(2025, 9, 15), by: 'Marco Rodriguez' },
        review: { date: new Date(2025, 9, 16), by: 'Diana Park', approved: true },
        approve: { date: new Date(2025, 9, 17), by: 'Randy Vazquez' },
        implement: { date: new Date(2025, 9, 18), by: 'Diana Park' },
        close: { date: new Date(2025, 9, 20), by: 'Diana Park' }
      }
    }
  ];

  function renderDocControl() {
    var container = document.getElementById('v-doccontrol');
    if(!container) return;
    var html = '<div class="doccontrol-module">';
    html += '<div class="module-tabs">';
    html += '<button class="tab-btn active" data-tab="dashboard">Dashboard</button>';
    html += '<button class="tab-btn" data-tab="registry">Document Registry</button>';
    html += '<button class="tab-btn" data-tab="dcr">DCR Workflow</button>';
    html += '<button class="tab-btn" data-tab="sops">SOPs</button>';
    html += '<button class="tab-btn" data-tab="policies">Policies</button>';
    html += '<button class="tab-btn" data-tab="distribution">Controlled Copy</button>';
    html += '</div>';
    html += '<div class="tab-content" id="tab-dashboard">' + renderDashboard() + '</div>';
    html += '<div class="tab-content hidden" id="tab-registry">' + renderRegistry() + '</div>';
    html += '<div class="tab-content hidden" id="tab-dcr">' + renderDCRWorkflow() + '</div>';
    html += '<div class="tab-content hidden" id="tab-sops">' + renderSOPs() + '</div>';
    html += '<div class="tab-content hidden" id="tab-policies">' + renderPolicies() + '</div>';
    html += '<div class="tab-content hidden" id="tab-distribution">' + renderDistribution() + '</div>';
    html += '</div>';
    html += '<style>' + getDocControlCSS() + '</style>';
    container.innerHTML = html;
    attachDocControlHandlers();
  }

  function renderDashboard() {
    var html = '<div class="doccontrol-dashboard">';
    html += '<h2>Document Control Dashboard</h2>';
    html += '<div class="dashboard-grid">';

    // Document statistics
    var totalDocs = SEED_DOCUMENTS.length;
    var approvedDocs = SEED_DOCUMENTS.filter(function(d) { return d.status === 'Approved'; }).length;
    var reviewDocs = SEED_DOCUMENTS.filter(function(d) { return d.status === 'Review'; }).length;

    html += '<div class="card">';
    html += '<h3>Total Documents</h3>';
    html += '<div class="score-display" style="color: #00e5ff;">' + totalDocs + '</div>';
    html += '<p>' + approvedDocs + ' Approved, ' + reviewDocs + ' In Review</p>';
    html += '</div>';

    // SOPs
    var sops = SEED_DOCUMENTS.filter(function(d) { return d.type === 'SOP'; }).length;
    html += '<div class="card">';
    html += '<h3>SOPs</h3>';
    html += '<div class="score-display" style="color: #00e500;">' + sops + '</div>';
    html += '<p>Standard Operating Procedures</p>';
    html += '</div>';

    // Policies
    var policies = SEED_DOCUMENTS.filter(function(d) { return d.type === 'Policy'; }).length;
    html += '<div class="card">';
    html += '<h3>Policies</h3>';
    html += '<div class="score-display" style="color: #ff6600;">' + policies + '</div>';
    html += '<p>Corporate Policies</p>';
    html += '</div>';

    // DCR status
    var openDCRs = SEED_DCRS.filter(function(d) { return d.status !== 'Closed'; }).length;
    html += '<div class="card">';
    html += '<h3>Active DCRs</h3>';
    html += '<div class="score-display" style="color: #ffff00;">' + openDCRs + '</div>';
    html += '<p>Document Change Requests</p>';
    html += '</div>';

    html += '</div>';

    // Documents due for review
    var today = new Date();
    var dueForReview = SEED_DOCUMENTS.filter(function(d) {
      var daysUntilReview = Math.floor((d.reviewDueDate - today) / (1000 * 60 * 60 * 24));
      return daysUntilReview <= 90 && daysUntilReview >= 0;
    });

    html += '<div class="review-due-section">';
    html += '<h3>Documents Due for Review (Next 90 Days)</h3>';
    if (dueForReview.length === 0) {
      html += '<p>No documents due for review in the next 90 days.</p>';
    } else {
      html += '<table class="review-table">';
      html += '<thead><tr><th>Document ID</th><th>Title</th><th>Revision</th><th>Review Due</th><th>Owner</th></tr></thead>';
      html += '<tbody>';
      dueForReview.forEach(function(doc) {
        html += '<tr>';
        html += '<td><strong>' + doc.id + '</strong></td>';
        html += '<td>' + doc.title + '</td>';
        html += '<td>Rev ' + doc.revision + '</td>';
        html += '<td>' + formatDate(doc.reviewDueDate) + '</td>';
        html += '<td>' + doc.owner + '</td>';
        html += '</tr>';
      });
      html += '</tbody>';
      html += '</table>';
    }
    html += '</div>';

    // Recent DCRs
    html += '<div class="recent-dcrs">';
    html += '<h3>Recent Document Change Requests</h3>';
    html += '<div class="dcr-list">';
    SEED_DCRS.slice(0, 5).forEach(function(dcr) {
      var statusClass = 'status-' + dcr.status.toLowerCase();
      html += '<div class="dcr-item ' + statusClass + '">';
      html += '<div class="dcr-header">';
      html += '<span class="dcr-id">' + dcr.id + '</span>';
      html += '<span class="dcr-status">' + dcr.status + '</span>';
      html += '</div>';
      html += '<p><strong>' + dcr.title + '</strong></p>';
      html += '<p>Submitted: ' + formatDate(dcr.submittedDate) + ' by ' + dcr.submittedBy + '</p>';
      html += '<p>Affects: ' + dcr.affectedDoc + '</p>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderRegistry() {
    var html = '<div class="doc-registry">';
    html += '<h2>Document Registry</h2>';
    html += '<p>Master list of all controlled documents</p>';

    html += '<div class="registry-filters">';
    html += '<label>Filter by Type:</label>';
    html += '<select id="type-filter">';
    html += '<option value="">-- All Types --</option>';
    DOC_TYPES.forEach(function(type) {
      html += '<option value="' + type + '">' + type + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<table class="registry-table">';
    html += '<thead><tr><th>Doc ID</th><th>Title</th><th>Type</th><th>Rev</th><th>Status</th><th>Owner</th><th>Effective Date</th><th>Review Due</th><th>Pages</th></tr></thead>';
    html += '<tbody>';

    SEED_DOCUMENTS.forEach(function(doc) {
      var statusClass = 'status-' + doc.status.toLowerCase();
      html += '<tr class="' + statusClass + '" data-type="' + doc.type + '">';
      html += '<td><strong>' + doc.id + '</strong></td>';
      html += '<td>' + doc.title + '</td>';
      html += '<td><span class="badge-type">' + doc.type + '</span></td>';
      html += '<td>' + doc.revision + '</td>';
      html += '<td><span class="badge-status">' + doc.status + '</span></td>';
      html += '<td>' + doc.owner + '</td>';
      html += '<td>' + formatDate(doc.effectiveDate) + '</td>';
      html += '<td>' + formatDate(doc.reviewDueDate) + '</td>';
      html += '<td>' + doc.pages + '</td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    return html;
  }

  function renderDCRWorkflow() {
    var html = '<div class="dcr-workflow">';
    html += '<h2>DCR (Document Change Request) Workflow</h2>';
    html += '<p>Process: Submit → Review → Approve → Implement → Close</p>';

    html += '<div class="create-dcr-form">';
    html += '<h3>Create New DCR</h3>';
    html += '<form id="dcr-form">';
    html += '<div class="form-group">';
    html += '<label>Title:</label>';
    html += '<input type="text" id="dcr-title" placeholder="Brief description of change" required>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Affected Document:</label>';
    html += '<select id="dcr-doc" required>';
    html += '<option value="">-- Select --</option>';
    SEED_DOCUMENTS.forEach(function(doc) {
      html += '<option value="' + doc.id + '">' + doc.id + ': ' + doc.title + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Change Reason:</label>';
    html += '<textarea id="dcr-reason" placeholder="Why is this change needed?" rows="3"></textarea>';
    html += '</div>';
    html += '<button type="button" id="submit-dcr-btn" class="btn-primary">Submit DCR</button>';
    html += '</form>';
    html += '</div>';

    html += '<div class="dcr-summary">';
    html += '<h3>DCR Status Overview</h3>';
    var approved = SEED_DCRS.filter(function(d) { return d.status === 'Approved'; }).length;
    var review = SEED_DCRS.filter(function(d) { return d.status === 'Review'; }).length;
    var closed = SEED_DCRS.filter(function(d) { return d.status === 'Closed'; }).length;

    html += '<div class="status-boxes">';
    html += '<div class="status-box"><strong>' + approved + '</strong><p>Approved</p></div>';
    html += '<div class="status-box"><strong>' + review + '</strong><p>In Review</p></div>';
    html += '<div class="status-box"><strong>' + closed + '</strong><p>Closed</p></div>';
    html += '</div>';

    html += '<h3>All DCRs</h3>';
    html += '<table class="dcr-table">';
    html += '<thead><tr><th>DCR ID</th><th>Title</th><th>Submitted By</th><th>Date</th><th>Affected Doc</th><th>Status</th><th>Progress</th></tr></thead>';
    html += '<tbody>';

    SEED_DCRS.forEach(function(dcr) {
      var stageCount = Object.keys(dcr.stages).length;
      var completedStages = 0;
      Object.values(dcr.stages).forEach(function() { completedStages++; });
      var progressPercent = Math.round((completedStages / 5) * 100);
      var statusClass = 'status-' + dcr.status.toLowerCase();

      html += '<tr class="' + statusClass + '">';
      html += '<td><strong>' + dcr.id + '</strong></td>';
      html += '<td>' + dcr.title + '</td>';
      html += '<td>' + dcr.submittedBy + '</td>';
      html += '<td>' + formatDate(dcr.submittedDate) + '</td>';
      html += '<td>' + dcr.affectedDoc + '</td>';
      html += '<td><span class="badge-status">' + dcr.status + '</span></td>';
      html += '<td><div class="progress-bar"><div class="progress-fill" style="width: ' + progressPercent + '%"></div></div></td>';
      html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderSOPs() {
    var html = '<div class="sops-view">';
    html += '<h2>Standard Operating Procedures (SOPs)</h2>';
    html += '<p>13 documented SOPs covering all operational aspects</p>';

    var sops = SEED_DOCUMENTS.filter(function(d) { return d.type === 'SOP'; });

    html += '<div class="sops-grid">';
    sops.forEach(function(sop) {
      var statusClass = 'status-' + sop.status.toLowerCase();
      html += '<div class="sop-card ' + statusClass + '">';
      html += '<div class="sop-header">';
      html += '<h3>' + sop.id + ': ' + sop.title + '</h3>';
      html += '<span class="badge-status">' + sop.status + '</span>';
      html += '</div>';
      html += '<p><strong>Revision:</strong> ' + sop.revision + '</p>';
      html += '<p><strong>Owner:</strong> ' + sop.owner + '</p>';
      html += '<p><strong>Pages:</strong> ' + sop.pages + '</p>';
      html += '<p><strong>Effective:</strong> ' + formatDate(sop.effectiveDate) + '</p>';
      html += '<p><strong>Review Due:</strong> ' + formatDate(sop.reviewDueDate) + '</p>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderPolicies() {
    var html = '<div class="policies-view">';
    html += '<h2>Corporate Policies</h2>';

    var policies = SEED_DOCUMENTS.filter(function(d) { return d.type === 'Policy'; });

    html += '<div class="policies-grid">';
    policies.forEach(function(policy) {
      var statusClass = 'status-' + policy.status.toLowerCase();
      html += '<div class="policy-card ' + statusClass + '">';
      html += '<div class="policy-header">';
      html += '<h3>' + policy.id + ': ' + policy.title + '</h3>';
      html += '<span class="badge-status">' + policy.status + '</span>';
      html += '</div>';
      html += '<p><strong>Revision:</strong> ' + policy.revision + '</p>';
      html += '<p><strong>Owner:</strong> ' + policy.owner + '</p>';
      html += '<p><strong>Pages:</strong> ' + policy.pages + '</p>';
      html += '<p><strong>Effective:</strong> ' + formatDate(policy.effectiveDate) + '</p>';
      html += '<p><strong>Review Due:</strong> ' + formatDate(policy.reviewDueDate) + '</p>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderDistribution() {
    var html = '<div class="distribution-view">';
    html += '<h2>Controlled Copy Distribution</h2>';
    html += '<p>Track which employees have received controlled copies of key documents</p>';

    html += '<form id="distribution-form">';
    html += '<div class="form-group">';
    html += '<label>Document:</label>';
    html += '<select id="dist-doc" required>';
    html += '<option value="">-- Select --</option>';
    SEED_DOCUMENTS.filter(function(d) { return d.status === 'Approved'; }).forEach(function(doc) {
      html += '<option value="' + doc.id + '">' + doc.id + ': ' + doc.title + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Recipient:</label>';
    html += '<select id="dist-recipient" required>';
    html += '<option value="">-- Select --</option>';
    html += '<option value="Randy Vazquez">Randy Vazquez</option>';
    html += '<option value="Marco Rodriguez">Marco Rodriguez</option>';
    html += '<option value="Alex Martinez">Alex Martinez</option>';
    html += '<option value="Diana Park">Diana Park</option>';
    html += '<option value="Jake Torres">Jake Torres</option>';
    html += '<option value="Chris Walton">Chris Walton</option>';
    html += '</select>';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<label>Distribution Date:</label>';
    html += '<input type="date" id="dist-date" required>';
    html += '</div>';
    html += '<button type="button" id="record-distribution-btn" class="btn-primary">Record Distribution</button>';
    html += '</form>';

    html += '<h3>Distribution Records</h3>';
    html += '<p>Sample records of controlled copy distribution:</p>';
    html += '<table class="distribution-table">';
    html += '<thead><tr><th>Document</th><th>Recipient</th><th>Date Distributed</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    html += '<tr><td>DOC-001</td><td>Randy Vazquez</td><td>2025-09-01</td><td>Received</td></tr>';
    html += '<tr><td>DOC-001</td><td>Diana Park</td><td>2025-09-01</td><td>Received</td></tr>';
    html += '<tr><td>DOC-002</td><td>Marco Rodriguez</td><td>2025-07-15</td><td>Received</td></tr>';
    html += '<tr><td>DOC-007</td><td>Alex Martinez</td><td>2025-09-15</td><td>Received</td></tr>';
    html += '<tr><td>DOC-012</td><td>Diana Park</td><td>2025-06-01</td><td>Acknowledged</td></tr>';
    html += '</tbody>';
    html += '</table>';

    html += '</div>';
    return html;
  }

  function attachDocControlHandlers() {
    // Tab switching
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabName = this.getAttribute('data-tab');
        switchTab(tabName);
      });
    });

    // Document type filter
    var typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', function() {
        var selectedType = this.value;
        var rows = document.querySelectorAll('.registry-table tbody tr');
        rows.forEach(function(row) {
          if (selectedType === '') {
            row.style.display = '';
          } else {
            if (row.getAttribute('data-type') === selectedType) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          }
        });
      });
    }

    // Submit DCR
    var submitDcrBtn = document.getElementById('submit-dcr-btn');
    if (submitDcrBtn) {
      submitDcrBtn.addEventListener('click', function() {
        var title = document.getElementById('dcr-title').value;
        var doc = document.getElementById('dcr-doc').value;
        var reason = document.getElementById('dcr-reason').value;

        if (!title || !doc || !reason) {
          toast('Please fill in all fields', 'error');
          return;
        }

        var dcrData = {
          title: title,
          affectedDoc: doc,
          reason: reason,
          submittedBy: 'Current User',
          submittedDate: new Date(),
          status: 'Submit'
        };

        db.collection('dcrs').add(dcrData).then(function(docRef) {
          toast('DCR submitted: ' + docRef.id, 'success');
          document.getElementById('dcr-form').reset();
        }).catch(function(error) {
          toast('Error submitting DCR: ' + error.message, 'error');
        });
      });
    }

    // Record distribution
    var recordDistBtn = document.getElementById('record-distribution-btn');
    if (recordDistBtn) {
      recordDistBtn.addEventListener('click', function() {
        var doc = document.getElementById('dist-doc').value;
        var recipient = document.getElementById('dist-recipient').value;
        var date = document.getElementById('dist-date').value;

        if (!doc || !recipient || !date) {
          toast('Please fill in all fields', 'error');
          return;
        }

        var distData = {
          document: doc,
          recipient: recipient,
          date: new Date(date),
          status: 'Distributed',
          recordedAt: new Date()
        };

        db.collection('distributions').add(distData).then(function(docRef) {
          toast('Distribution recorded: ' + docRef.id, 'success');
          document.getElementById('distribution-form').reset();
        }).catch(function(error) {
          toast('Error recording distribution: ' + error.message, 'error');
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

  function getDocControlCSS() {
    return `
      .doccontrol-module { padding: 20px; }
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

      .review-due-section { background: var(--bg2); padding: 20px; border-radius: var(--bdr); margin-bottom: 30px; margin-top: 30px; }
      .review-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      .review-table th, .review-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
        font-size: 14px;
      }
      .review-table th { background: var(--bg3); font-weight: bold; }

      .recent-dcrs { background: var(--bg2); padding: 20px; border-radius: var(--bdr); margin-top: 30px; }
      .dcr-list { margin-top: 15px; }
      .dcr-item {
        background: var(--bg);
        padding: 15px;
        margin-bottom: 10px;
        border-radius: var(--bdr);
        border-left: 4px solid var(--bg3);
      }
      .dcr-item.status-approved { border-left-color: var(--gn); }
      .dcr-item.status-review { border-left-color: var(--or); }
      .dcr-item.status-closed { border-left-color: var(--tx2); }
      .dcr-header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
      .dcr-id { font-weight: bold; color: var(--ac); }
      .dcr-status { padding: 2px 8px; background: var(--ac); color: var(--bg); border-radius: 3px; font-size: 12px; }
      .dcr-item p { margin: 5px 0; font-size: 13px; }

      .registry-filters { margin-bottom: 20px; }
      .registry-filters label { margin-right: 10px; font-weight: bold; }
      .registry-filters select {
        padding: 8px 12px;
        background: var(--bg);
        color: var(--tx);
        border: 1px solid var(--bg3);
        border-radius: var(--bdr);
      }

      .registry-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg2);
        margin-top: 15px;
      }
      .registry-table th, .registry-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
        font-size: 13px;
      }
      .registry-table th { background: var(--bg3); font-weight: bold; }
      .registry-table tr.status-approved { background: rgba(0, 229, 0, 0.05); }
      .registry-table tr.status-review { background: rgba(255, 102, 0, 0.1); }
      .registry-table tr.status-draft { background: rgba(200, 200, 200, 0.08); }
      .registry-table tr.status-obsolete { opacity: 0.7; }

      .badge-type { background: var(--bg3); padding: 2px 6px; border-radius: 3px; font-size: 12px; }
      .badge-status { padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; background: var(--ac); color: var(--bg); }

      .create-dcr-form { background: var(--bg2); padding: 20px; border-radius: var(--bdr); margin-bottom: 30px; }
      .form-group { margin-bottom: 15px; }
      .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
      .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--bg3);
        border-radius: var(--bdr);
        background: var(--bg);
        color: var(--tx);
        font-family: inherit;
      }
      .btn-primary {
        background: var(--ac);
        color: var(--bg);
        padding: 10px 20px;
        border: none;
        border-radius: var(--bdr);
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
      }
      .btn-primary:hover { opacity: 0.8; transform: translateY(-2px); }

      .status-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
      .status-box {
        background: var(--bg);
        padding: 20px;
        border-radius: var(--bdr);
        text-align: center;
        border-left: 4px solid var(--ac);
      }
      .status-box strong { font-size: 28px; color: var(--ac); display: block; }
      .status-box p { margin: 10px 0 0 0; font-size: 14px; }

      .dcr-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg2);
        margin-top: 15px;
      }
      .dcr-table th, .dcr-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
        font-size: 13px;
      }
      .dcr-table th { background: var(--bg3); font-weight: bold; }
      .dcr-table tr.status-approved { background: rgba(0, 229, 0, 0.05); }
      .dcr-table tr.status-review { background: rgba(255, 102, 0, 0.08); }
      .dcr-table tr.status-closed { background: rgba(100, 200, 200, 0.05); }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: var(--bg3);
        border-radius: 4px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: var(--ac);
        transition: width 0.3s;
      }

      .sops-grid, .policies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-top: 20px; }
      .sop-card, .policy-card {
        background: var(--bg2);
        padding: 20px;
        border-radius: var(--bdr);
        border-top: 3px solid var(--ac);
      }
      .sop-card.status-draft, .policy-card.status-draft { border-top-color: var(--tx2); opacity: 0.7; }
      .sop-card.status-review, .policy-card.status-review { border-top-color: var(--or); }
      .sop-header, .policy-header { display: flex; justify-content: space-between; align-items: start; gap: 10px; margin-bottom: 15px; }
      .sop-header h3, .policy-header h3 { margin: 0; color: var(--ac); }
      .sop-card p, .policy-card p { margin: 8px 0; font-size: 13px; }

      .distribution-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg2);
        margin-top: 15px;
      }
      .distribution-table th, .distribution-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--bg3);
      }
      .distribution-table th { background: var(--bg3); font-weight: bold; }
    `;
  }

  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_RENDERERS.doccontrol = renderDocControl;
})();
