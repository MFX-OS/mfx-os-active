(function() {
  'use strict';

  function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  var db = firebase.firestore();
  var currentTab = 'setup';
  var currentJobId = null;
  var currentJob = null;
  var timerRunning = false;
  var timerInterval = null;
  var timerSeconds = 0;
  var setupTimerSeconds = 0;
  var runTimerSeconds = 0;
  var jobTickets = [];
  var operatorLogs = [];

  // ============================================================================
  // LOAD DATA
  // ============================================================================
  function loadJobTickets() {
    db.collection('jobTickets')
      .where('status', '==', 'Active')
      .get()
      .then(function(snapshot) {
        jobTickets = [];
        snapshot.forEach(function(doc) {
          jobTickets.push(Object.assign({ id: doc.id }, doc.data()));
        });
        if (currentTab === 'setup' && jobTickets.length > 0 && !currentJobId) {
          selectJob(jobTickets[0].id);
        }
        renderTab();
      })
      .catch(function(err) {
        toast('Error loading jobs: ' + err.message, 'error');
      });
  }

  function loadCurrentJob(jobId) {
    db.collection('jobTickets')
      .doc(jobId)
      .get()
      .then(function(doc) {
        if (doc.exists) {
          currentJob = Object.assign({ id: doc.id }, doc.data());
          renderTab();
        }
      })
      .catch(function(err) {
        toast('Error loading job: ' + err.message, 'error');
      });
  }

  function loadOperatorLogs() {
    db.collection('operatorLogs')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .then(function(snapshot) {
        operatorLogs = [];
        snapshot.forEach(function(doc) {
          operatorLogs.push(Object.assign({ id: doc.id }, doc.data()));
        });
        if (currentTab === 'shiftlog') renderTab();
      })
      .catch(function(err) {
        toast('Error loading logs: ' + err.message, 'error');
      });
  }

  // ============================================================================
  // JOB SELECTION
  // ============================================================================
  function selectJob(jobId) {
    currentJobId = jobId;
    loadCurrentJob(jobId);
  }

  // ============================================================================
  // TIMER FUNCTIONS
  // ============================================================================
  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(function() {
      timerSeconds++;
      runTimerSeconds++;
      // Update only the timer display elements instead of re-rendering the entire UI
      var timerEl = document.getElementById('op-timer-total');
      var runEl = document.getElementById('op-timer-run');
      var imphEl = document.getElementById('op-timer-imph');
      if (timerEl) timerEl.textContent = formatTime(timerSeconds);
      if (runEl) runEl.textContent = 'Run: ' + formatTime(runTimerSeconds);
      if (imphEl) imphEl.textContent = calculateImpressionsPerHour();
      if (!timerEl) renderTab();
    }, 1000);
    toast('Timer started', 'success');
  }

  function stopTimer() {
    if (!timerRunning) return;
    timerRunning = false;
    clearInterval(timerInterval);
    toast('Timer stopped', 'success');
  }

  function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    setupTimerSeconds = 0;
    runTimerSeconds = 0;
    renderTab();
  }

  function formatTime(seconds) {
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds % 3600) / 60);
    var secs = seconds % 60;
    return (hours > 0 ? hours + 'h ' : '') + mins + 'm ' + secs + 's';
  }

  function calculateImpressionsPerHour() {
    if (runTimerSeconds === 0 || !currentJob || !currentJob.runSpeed) return 0;
    var hours = runTimerSeconds / 3600;
    var impressions = currentJob.runSpeed * hours;
    return Math.round(impressions);
  }

  // ============================================================================
  // RENDER TABS
  // ============================================================================
  function renderTab() {
    var container = document.getElementById('operator-content');
    if (!container) return;
    container.innerHTML = '';

    switch (currentTab) {
      case 'setup': renderSetupCard(container); break;
      case 'timer': renderLiveTimer(container); break;
      case 'qc': renderQCEntry(container); break;
      case 'shiftlog': renderShiftLog(container); break;
    }
  }

  function renderSetupCard(container) {
    var html = '<div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">';

    // Job selector
    html += '<div style="margin-bottom: 16px;">';
    html += '<label style="color: var(--tx2); font-size: 14px; display: block; margin-bottom: 8px;">Select Job:</label>';
    html += '<select id="job-select" onchange="window.MFX.OPERATOR.selectJobFromDropdown()" style="width: 100%; padding: 12px; background: var(--bg); color: var(--tx); border: 2px solid var(--bg3); border-radius: var(--bdr); font-size: 16px;">';
    html += '<option value="">-- Choose a job --</option>';

    jobTickets.forEach(function(job) {
      html += '<option value="' + job.id + '" ' + (currentJobId === job.id ? 'selected' : '') + '>' + job.sku + ' - ' + job.customerName + '</option>';
    });

    html += '</select>';
    html += '</div>';

    if (!currentJob) {
      html += '<div style="background: var(--bg2); padding: 16px; border-radius: var(--bdr); text-align: center; color: var(--tx2);">';
      html += '<p>No job selected</p>';
      html += '</div>';
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    // Large setup card
    html += '<div style="background: var(--bg2); padding: 20px; border-radius: var(--bdr); flex: 1; display: flex; flex-direction: column;">';

    // Job header
    html += '<div style="border-bottom: 3px solid var(--ac); padding-bottom: 12px; margin-bottom: 16px;">';
    html += '<div style="font-size: 24px; font-weight: bold; color: var(--ac); margin-bottom: 4px;">' + currentJob.sku + '</div>';
    html += '<div style="font-size: 14px; color: var(--tx2);">' + currentJob.customerName + '</div>';
    html += '</div>';

    // Setup details in grid
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">';

    // Substrate
    html += '<div>';
    html += '<div style="font-size: 12px; color: var(--tx2); text-transform: uppercase; margin-bottom: 6px;">Substrate</div>';
    html += '<div style="font-size: 18px; font-weight: bold; color: var(--tx);">' + (currentJob.substrate || 'N/A') + '</div>';
    html += '</div>';

    // Run Speed
    html += '<div>';
    html += '<div style="font-size: 12px; color: var(--tx2); text-transform: uppercase; margin-bottom: 6px;">Run Speed</div>';
    html += '<div style="font-size: 18px; font-weight: bold; color: var(--ac);">' + (currentJob.runSpeed || 0) + ' iph</div>';
    html += '</div>';

    // Die
    html += '<div>';
    html += '<div style="font-size: 12px; color: var(--tx2); text-transform: uppercase; margin-bottom: 6px;">Die</div>';
    html += '<div style="font-size: 18px; font-weight: bold; color: var(--tx);">' + (currentJob.die || 'N/A') + '</div>';
    html += '</div>';

    // Tension
    html += '<div>';
    html += '<div style="font-size: 12px; color: var(--tx2); text-transform: uppercase; margin-bottom: 6px;">Tension (g)</div>';
    html += '<div style="font-size: 18px; font-weight: bold; color: var(--tx);">' + (currentJob.tension || 0) + '</div>';
    html += '</div>';

    html += '</div>';

    // Ink colors
    html += '<div style="margin-bottom: 20px;">';
    html += '<div style="font-size: 12px; color: var(--tx2); text-transform: uppercase; margin-bottom: 8px;">Ink Colors</div>';
    if (currentJob.inkColors && currentJob.inkColors.length > 0) {
      html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
      currentJob.inkColors.forEach(function(color) {
        html += '<div style="background: var(--bg); padding: 8px 12px; border-radius: var(--bdr); color: var(--tx); font-size: 14px;">' + color + '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="color: var(--tx2);">No colors configured</div>';
    }
    html += '</div>';

    // Plates
    html += '<div>';
    html += '<div style="font-size: 12px; color: var(--tx2); text-transform: uppercase; margin-bottom: 8px;">Plates</div>';
    if (currentJob.plates && currentJob.plates.length > 0) {
      html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
      currentJob.plates.forEach(function(plate) {
        html += '<div style="background: var(--bg); padding: 8px 12px; border-radius: var(--bdr); color: var(--tx); font-size: 14px;">' + plate + '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="color: var(--tx2);">No plates configured</div>';
    }
    html += '</div>';

    html += '</div>';

    // Action buttons
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">';
    html += '<button onclick="window.MFX.OPERATOR.setTab(\'timer\')" style="background: var(--ac); color: var(--bg); border: none; padding: 16px; border-radius: var(--bdr); font-size: 18px; font-weight: bold; cursor: pointer; min-height: 60px;">Start Run</button>';
    html += '<button onclick="window.MFX.OPERATOR.setTab(\'qc\')" style="background: var(--gn); color: var(--bg); border: none; padding: 16px; border-radius: var(--bdr); font-size: 18px; font-weight: bold; cursor: pointer; min-height: 60px;">QC Check</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function renderLiveTimer(container) {
    var html = '<div style="padding: 16px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">';

    if (!currentJob) {
      html += '<div style="color: var(--tx2);">No job selected</div>';
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    // Large timer display
    html += '<div style="text-align: center; margin-bottom: 30px;">';
    html += '<div style="font-size: 14px; color: var(--tx2); margin-bottom: 12px;">JOB: ' + currentJob.sku + '</div>';
    html += '<div id="op-timer-total" style="font-size: 72px; font-weight: bold; color: var(--ac); font-family: monospace; letter-spacing: 2px;">' + formatTime(timerSeconds) + '</div>';
    html += '<div id="op-timer-run" style="font-size: 18px; color: var(--tx2); margin-top: 12px;">Run: ' + formatTime(runTimerSeconds) + '</div>';
    html += '</div>';

    // Impressions counter
    var imph = calculateImpressionsPerHour();
    html += '<div style="background: var(--bg2); padding: 16px; border-radius: var(--bdr); margin-bottom: 20px; text-align: center; width: 100%; max-width: 300px;">';
    html += '<div style="font-size: 14px; color: var(--tx2); margin-bottom: 8px;">Total Impressions</div>';
    html += '<div id="op-timer-imph" style="font-size: 36px; font-weight: bold; color: var(--gn);">' + imph + '</div>';
    html += '</div>';

    // Control buttons
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; width: 100%; margin-bottom: 20px;">';
    html += '<button onclick="window.MFX.OPERATOR.startTimer()" style="background: var(--gn); color: var(--bg); border: none; padding: 16px; border-radius: var(--bdr); font-size: 16px; font-weight: bold; cursor: pointer; ' + (timerRunning ? 'opacity: 0.5;' : '') + '">START</button>';
    html += '<button onclick="window.MFX.OPERATOR.stopTimer()" style="background: var(--or); color: var(--bg); border: none; padding: 16px; border-radius: var(--bdr); font-size: 16px; font-weight: bold; cursor: pointer; ' + (!timerRunning ? 'opacity: 0.5;' : '') + '">STOP</button>';
    html += '<button onclick="window.MFX.OPERATOR.resetTimer()" style="background: var(--rd); color: var(--bg); border: none; padding: 16px; border-radius: var(--bdr); font-size: 16px; font-weight: bold; cursor: pointer;">RESET</button>';
    html += '</div>';

    // Back button
    html += '<button onclick="window.MFX.OPERATOR.setTab(\'setup\')" style="background: var(--bg2); color: var(--tx); border: none; padding: 12px 20px; border-radius: var(--bdr); font-size: 16px; cursor: pointer; width: 100%;">← Back</button>';

    html += '</div>';
    container.innerHTML = html;
  }

  function renderQCEntry(container) {
    var html = '<div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">';

    if (!currentJob) {
      html += '<div style="color: var(--tx2);">No job selected</div>';
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    html += '<div style="margin-bottom: 16px;">';
    html += '<div style="font-size: 18px; font-weight: bold; color: var(--ac); margin-bottom: 8px;">' + currentJob.sku + ' - QC Inspection</div>';
    html += '</div>';

    html += '<div style="background: var(--bg2); padding: 16px; border-radius: var(--bdr); flex: 1; overflow-y: auto;">';

    // Color check
    html += '<div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--bg3);">';
    html += '<div style="font-weight: bold; color: var(--tx); margin-bottom: 12px;">Color Check</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">';
    html += '<div>';
    html += '<label style="color: var(--tx2); font-size: 12px; display: block; margin-bottom: 4px;">Delta E Value</label>';
    html += '<input type="number" id="qc-deltae" placeholder="0.0" style="width: 100%; padding: 10px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: var(--bdr);">';
    html += '</div>';
    html += '<div>';
    html += '<label style="color: var(--tx2); font-size: 12px; display: block; margin-bottom: 4px;">Tolerance (±)</label>';
    html += '<input type="number" id="qc-tolerance" placeholder="2.0" style="width: 100%; padding: 10px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: var(--bdr);">';
    html += '</div>';
    html += '</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'color\', \'pass\')" style="background: var(--gn); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Pass</button>';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'color\', \'fail\')" style="background: var(--rd); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Fail</button>';
    html += '</div>';
    html += '</div>';

    // Registration
    html += '<div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--bg3);">';
    html += '<div style="font-weight: bold; color: var(--tx); margin-bottom: 12px;">Registration</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'registration\', \'pass\')" style="background: var(--gn); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Pass</button>';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'registration\', \'fail\')" style="background: var(--rd); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Fail</button>';
    html += '</div>';
    html += '</div>';

    // Barcode
    html += '<div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--bg3);">';
    html += '<div style="font-weight: bold; color: var(--tx); margin-bottom: 12px;">Barcode Grade</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'barcode\', \'pass\')" style="background: var(--gn); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Pass</button>';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'barcode\', \'fail\')" style="background: var(--rd); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Fail</button>';
    html += '</div>';
    html += '</div>';

    // Visual
    html += '<div style="margin-bottom: 20px;">';
    html += '<div style="font-weight: bold; color: var(--tx); margin-bottom: 12px;">Visual Inspection</div>';
    html += '<div>';
    html += '<label style="color: var(--tx2); font-size: 12px; display: block; margin-bottom: 4px;">Notes</label>';
    html += '<textarea id="qc-notes" placeholder="Any observations..." style="width: 100%; padding: 10px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: var(--bdr); height: 80px; resize: vertical;"></textarea>';
    html += '</div>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'visual\', \'pass\')" style="background: var(--gn); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Pass</button>';
    html += '<button onclick="window.MFX.OPERATOR.logQCCheck(\'visual\', \'fail\')" style="background: var(--rd); color: var(--bg); border: none; padding: 12px; border-radius: var(--bdr); font-weight: bold; cursor: pointer;">Fail</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    html += '<button onclick="window.MFX.OPERATOR.setTab(\'setup\')" style="background: var(--bg2); color: var(--tx); border: none; padding: 12px; border-radius: var(--bdr); margin-top: 16px; cursor: pointer; width: 100%;">← Back</button>';

    html += '</div>';
    container.innerHTML = html;
  }

  function renderShiftLog(container) {
    var html = '<div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">';

    html += '<h2 style="color: var(--tx); margin-bottom: 16px;">Shift Log</h2>';

    html += '<div style="background: var(--bg2); padding: 12px; border-radius: var(--bdr); margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">';
    html += '<button onclick="window.MFX.OPERATOR.logShiftEvent(\'shift_start\')" style="background: var(--gn); color: var(--bg); border: none; padding: 10px; border-radius: var(--bdr); font-weight: bold; cursor: pointer; font-size: 12px;">Start Shift</button>';
    html += '<button onclick="window.MFX.OPERATOR.logShiftEvent(\'break\')" style="background: var(--or); color: var(--bg); border: none; padding: 10px; border-radius: var(--bdr); font-weight: bold; cursor: pointer; font-size: 12px;">Break</button>';
    html += '<button onclick="window.MFX.OPERATOR.logShiftEvent(\'end\')" style="background: var(--rd); color: var(--bg); border: none; padding: 10px; border-radius: var(--bdr); font-weight: bold; cursor: pointer; font-size: 12px;">End Shift</button>';
    html += '</div>';

    html += '<div style="background: var(--bg2); padding: 12px; border-radius: var(--bdr); margin-bottom: 16px;">';
    html += '<input type="text" id="shift-notes" placeholder="Log event details..." style="width: 100%; padding: 10px; background: var(--bg); color: var(--tx); border: 1px solid var(--bg3); border-radius: var(--bdr); margin-bottom: 8px;">';
    html += '<button onclick="window.MFX.OPERATOR.logCustomEvent()" style="background: var(--ac); color: var(--bg); border: none; padding: 10px; border-radius: var(--bdr); font-weight: bold; cursor: pointer; width: 100%;">Log Note</button>';
    html += '</div>';

    html += '<div style="flex: 1; overflow-y: auto;">';
    html += '<div style="display: flex; flex-direction: column; gap: 8px;">';

    operatorLogs.slice(0, 20).forEach(function(log) {
      var time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--';
      var eventColor = log.type === 'shift_start' ? 'var(--gn)' : (log.type === 'end' ? 'var(--rd)' : 'var(--tx)');
      html += '<div style="background: var(--bg2); padding: 10px; border-radius: var(--bdr); border-left: 4px solid ' + eventColor + ';">';
      html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
      html += '<div style="font-weight: bold; color: var(--tx);">' + (log.type || 'event') + '</div>';
      html += '<div style="font-size: 12px; color: var(--tx2);">' + time + '</div>';
      html += '</div>';
      if (log.notes) {
        html += '<div style="font-size: 12px; color: var(--tx2); margin-top: 4px;">' + log.notes + '</div>';
      }
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ============================================================================
  // LOG FUNCTIONS
  // ============================================================================
  function logQCCheck(checkType, result) {
    var notes = document.getElementById('qc-notes') ? document.getElementById('qc-notes').value : '';
    var deltae = document.getElementById('qc-deltae') ? document.getElementById('qc-deltae').value : '';

    var qcEntry = {
      jobId: currentJobId,
      jobSku: currentJob ? currentJob.sku : 'N/A',
      checkType: checkType,
      result: result,
      notes: notes || deltae || '',
      timestamp: new Date().toISOString(),
      operator: typeof getUserName === 'function' ? getUserName() : 'Operator'
    };

    db.collection('operatorLogs').add(qcEntry).then(function() {
      toast('QC Check logged: ' + checkType + ' - ' + result, 'success');
      var deltaEl = document.getElementById('qc-deltae');
      var tolEl = document.getElementById('qc-tolerance');
      var notesEl = document.getElementById('qc-notes');
      if (deltaEl) deltaEl.value = '';
      if (tolEl) tolEl.value = '';
      if (notesEl) notesEl.value = '';
    }).catch(function(err) {
      toast('Error logging QC: ' + err.message, 'error');
    });
  }

  function logShiftEvent(eventType) {
    var shiftEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      operator: typeof getUserName === 'function' ? getUserName() : 'Operator'
    };

    db.collection('operatorLogs').add(shiftEvent).then(function() {
      toast('Shift event logged', 'success');
      loadOperatorLogs();
    }).catch(function(err) {
      toast('Error logging event: ' + err.message, 'error');
    });
  }

  function logCustomEvent() {
    var notes = document.getElementById('shift-notes').value;
    if (!notes) {
      toast('Please enter event notes', 'error');
      return;
    }

    var event = {
      type: 'custom',
      notes: notes,
      timestamp: new Date().toISOString(),
      operator: typeof getUserName === 'function' ? getUserName() : 'Operator'
    };

    db.collection('operatorLogs').add(event).then(function() {
      toast('Event logged', 'success');
      document.getElementById('shift-notes').value = '';
      loadOperatorLogs();
    }).catch(function(err) {
      toast('Error logging event: ' + err.message, 'error');
    });
  }

  // ============================================================================
  // TAB NAVIGATION
  // ============================================================================
  function setTab(tab) {
    currentTab = tab;
    if (tab === 'shiftlog') loadOperatorLogs();
    renderTab();
  }

  function selectJobFromDropdown() {
    var select = document.getElementById('job-select');
    if (select && select.value) {
      selectJob(select.value);
    }
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  function renderOperator() {
    var el = document.getElementById('v-operator');
    if(!el) return;
    var html = '<div style="display: flex; flex-direction: column; height: 100%; background: var(--bg);">';

    // Header
    html += '<div style="background: var(--bg2); padding: 12px; border-bottom: 2px solid var(--bg3); display: flex; gap: 8px; flex-wrap: wrap;">';

    var tabs = [
      { id: 'setup', label: 'Setup Card' },
      { id: 'timer', label: 'Live Timer' },
      { id: 'qc', label: 'QC Entry' },
      { id: 'shiftlog', label: 'Shift Log' }
    ];

    tabs.forEach(function(tab) {
      var isActive = currentTab === tab.id;
      html += '<button data-op-tab="' + tab.id + '" onclick="window.MFX.OPERATOR.setTab(\'' + tab.id + '\')" style="background: ' + (isActive ? 'var(--ac)' : 'var(--bg2)') + '; color: ' + (isActive ? 'var(--bg)' : 'var(--tx)') + '; border: none; padding: 10px 14px; border-radius: var(--bdr); cursor: pointer; font-weight: bold; font-size: 13px; min-height: 44px;">' + tab.label + '</button>';
    });

    html += '</div>';

    // Content
    html += '<div id="operator-content" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>';

    html += '</div>';

    el.innerHTML = html;
    setTimeout(function() {
      renderTab();
    }, 0);
  }

  // ============================================================================
  // INIT
  // ============================================================================
  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_RENDERERS.operator = renderOperator;

  window.MFX = window.MFX || {};
  window.MFX.OPERATOR = {
    setTab: setTab,
    selectJob: selectJob,
    selectJobFromDropdown: selectJobFromDropdown,
    startTimer: startTimer,
    stopTimer: stopTimer,
    resetTimer: resetTimer,
    logQCCheck: logQCCheck,
    logShiftEvent: logShiftEvent,
    logCustomEvent: logCustomEvent,
    init: function() {
      loadJobTickets();
    }
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.MFX.OPERATOR.init();
    });
  } else {
    window.MFX.OPERATOR.init();
  }

})();
