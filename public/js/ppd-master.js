
(function(){
  'use strict';
  if(typeof window==='undefined') return;

  var MASTER_DEFAULTS = {
    sourceOfTruth: {
      jobState: 'Firestore',
      approvals: 'Firestore',
      internalFiles: 'Google Shared Drive',
      externalExchange: 'Dropbox (optional edge only)',
      releasedPackets: 'Google Shared Drive',
      executionQueue: 'Firestore → local daemon',
      dashboards: 'Derived from Firestore + registers'
    },
    validationRules: [
      'No job without a ticket',
      'No proof without a tracked version',
      'No release without approval record',
      'Google Drive is the internal source of truth',
      'Dropbox is optional exchange only',
      'Overrides must be logged with reason and owner'
    ],
    permissionsSummary: [
      'Artist: edit work and notes',
      'Prepress: update stage and checklist',
      'QA: approve / reject',
      'Lead / Ops: override and rebalance',
      'CEO: read-only executive visibility'
    ]
  };

  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[s];}); }
  function money(n){ return '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function dt(v){ try{ var d=v&&v.toDate?v.toDate():new Date(v); return isNaN(d)?'—':d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return '—'; } }
  function toast(msg, kind){ if(typeof window.toast==='function') window.toast(msg, kind||'ok'); }
  function getPPD(){ return window.PPD || null; }
  function ensureState(){
    var PPD = getPPD();
    if(!PPD) return false;
    PPD.events = PPD.events || [];
    PPD.queue = PPD.queue || [];
    PPD.overrides = PPD.overrides || [];
    PPD.controlConfig = Object.assign({}, MASTER_DEFAULTS, PPD.controlConfig || {});
    PPD.settings = PPD.settings || {};
    if(typeof PPD.settings.dropboxMode === 'undefined') PPD.settings.dropboxMode = 'optional';
    if(typeof PPD.settings.driveMode === 'undefined') PPD.settings.driveMode = 'primary';
    return true;
  }

  function attachExtraListeners(){
    var PPD = getPPD();
    if(!PPD || typeof fbDb==='undefined' || PPD.masterListenersStarted) return;
    PPD.masterListenersStarted = true;
    try{ fbDb.collection('ppdEvents').limit(200).onSnapshot(function(s){ PPD.events=s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }); if(window.S&&window.S.view==='ppd'&&PPD.tab==='control') setTimeout(injectControlView,0); }, function(err){ console.warn('ppd-master ppdEvents listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('prepressQueue').limit(100).onSnapshot(function(s){ PPD.queue=s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }); if(window.S&&window.S.view==='ppd'&&PPD.tab==='control') setTimeout(injectControlView,0); }, function(err){ console.warn('ppd-master prepressQueue listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('exceptionOverrides').limit(100).onSnapshot(function(s){ PPD.overrides=s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }); if(window.S&&window.S.view==='ppd'&&PPD.tab==='control') setTimeout(injectControlView,0); }, function(err){ console.warn('ppd-master exceptionOverrides listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('controlConfigs').doc('ppd').onSnapshot(function(doc){ if(doc.exists){ PPD.controlConfig = Object.assign({}, MASTER_DEFAULTS, doc.data()||{}); if(window.S&&window.S.view==='ppd'&&PPD.tab==='control') setTimeout(injectControlView,0); } }, function(err){ console.warn('ppd-master controlConfigs listener:', err.message); }); }catch(e){}
  }

  function registerCounts(PPD){
    return {
      requests: (PPD.requests||[]).length,
      inbox: (PPD.inbox||[]).length,
      tickets: (PPD.tickets||[]).length,
      approvals: (PPD.approvals||[]).length,
      incidents: (PPD.incidents||[]).length,
      queue: (PPD.queue||[]).length,
      overrides: (PPD.overrides||[]).length,
      events: (PPD.events||[]).length,
      blueprints: (PPD.blueprints||[]).length
    };
  }

  function sourceRows(PPD){
    var sot = (PPD.controlConfig && PPD.controlConfig.sourceOfTruth) || MASTER_DEFAULTS.sourceOfTruth;
    return [
      ['Job state', sot.jobState],
      ['Approvals', sot.approvals],
      ['Internal files', sot.internalFiles],
      ['External exchange', sot.externalExchange],
      ['Released packets', sot.releasedPackets],
      ['Execution queue', sot.executionQueue],
      ['Dashboards', sot.dashboards]
    ];
  }

  function connectorStatus(PPD){
    return [
      ['Google Shared Drive', PPD.settings && PPD.settings.driveUrl ? 'Connected' : 'Set link'],
      ['Dropbox (optional)', PPD.settings && PPD.settings.dropboxUrl ? 'Configured edge link' : 'Not used'],
      ['Shared Inbox', PPD.settings && PPD.settings.inboxEmail ? PPD.settings.inboxEmail : 'Not configured'],
      ['Gmail query', PPD.settings && PPD.settings.inboxQuery ? PPD.settings.inboxQuery : 'Default unread'],
      ['Chat space', PPD.settings && PPD.settings.chatUrl ? 'Connected' : 'Not configured'],
      ['Master dashboard', PPD.settings && PPD.settings.masterDashUrl ? 'Connected' : 'Not configured']
    ];
  }

  function listRows(title, rows){
    var h = '<div class="card ppd-section"><div class="ppd-section-title">'+esc(title)+'</div><div style="display:grid;gap:8px">';
    rows.forEach(function(r){ h += '<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(r[0])+'</div><div class="ppd-list-meta">'+esc(r[1]||'')+'</div></div></div>'; });
    h += '</div></div>';
    return h;
  }

  function metricBox(label, value, sub){
    return '<div class="ppd-metric"><div class="ppd-metric-val">'+esc(value)+'</div><div class="ppd-metric-lbl">'+esc(label)+'</div><div class="ppd-metric-sub">'+esc(sub||'')+'</div></div>';
  }

  function latestEvents(PPD){
    return (PPD.events||[]).slice().sort(function(a,b){
      var ad = new Date((a.createdAtIso||a.createdAt||0)).getTime();
      var bd = new Date((b.createdAtIso||b.createdAt||0)).getTime();
      return bd-ad;
    }).slice(0,10);
  }

  function injectControlTab(){
    var PPD = getPPD();
    if(!PPD) return;
    var tabs = document.querySelector('.ppd-tabs');
    if(!tabs || tabs.querySelector('[data-ppd-master-tab="control"]')) return;
    var btn = document.createElement('button');
    btn.className = 'ppd-tab' + (PPD.tab==='control' ? ' active' : '');
    btn.textContent = 'Control';
    btn.setAttribute('data-ppd-master-tab','control');
    btn.onclick = function(){ PPD.tab='control'; if(window.MFX_VIEW_RENDERERS&&window.MFX_VIEW_RENDERERS.ppd) window.MFX_VIEW_RENDERERS.ppd(); };
    tabs.appendChild(btn);
  }

  function injectControlView(){
    var PPD = getPPD();
    if(!PPD || PPD.tab!=='control') return;
    var shell = document.querySelector('#v-ppd .ppd-shell');
    if(!shell) return;
    var old = shell.querySelector('[data-ppd-master-control]');
    if(old) old.remove();
    var counts = registerCounts(PPD);
    var connectors = connectorStatus(PPD);
    var rules = (PPD.controlConfig && PPD.controlConfig.validationRules) || MASTER_DEFAULTS.validationRules;
    var perms = (PPD.controlConfig && PPD.controlConfig.permissionsSummary) || MASTER_DEFAULTS.permissionsSummary;
    var ev = latestEvents(PPD);
    var queueOpen = (PPD.queue||[]).filter(function(x){ return !/done|released|closed/i.test(String(x.status||'')); });
    var overridesOpen = (PPD.overrides||[]).filter(function(x){ return !/closed|expired|resolved/i.test(String(x.status||'')); });
    var h = '';
    h += '<div data-ppd-master-control class="ppd-grid-2">';
    h += '<div class="card ppd-section"><div class="ppd-section-title">Control plane</div><div class="ppd-section-sub">Shared truth, connector status, and live governance for the PPD module.</div><div class="ppd-metrics">';
    h += metricBox('Registers', Object.keys(counts).length, 'Tracked data buckets');
    h += metricBox('Queue Open', queueOpen.length, 'Execution items not closed');
    h += metricBox('Overrides', overridesOpen.length, 'Active exception records');
    h += metricBox('Events', counts.events, 'Audit-like activity feed');
    h += '</div></div>';
    h += listRows('Source of truth contract', sourceRows(PPD));
    h += listRows('Connector status', connectors);
    h += listRows('Validation rules', rules.map(function(x){ return [x,'']; }));
    h += listRows('Permissions summary', perms.map(function(x){ return [x,'']; }));
    h += '<div class="card ppd-section"><div class="ppd-section-title">Master register snapshot</div><div style="display:grid;gap:8px">';
    [
      ['Requests', counts.requests],['Inbox items', counts.inbox],['Tickets', counts.tickets],['Approvals', counts.approvals],['Incidents', counts.incidents],['Blueprints', counts.blueprints],['Queue items', counts.queue],['Overrides', counts.overrides]
    ].forEach(function(r){ h += '<div class="ppd-list-item"><div class="ppd-list-title">'+esc(r[0])+'</div><div class="ppd-chip">'+esc(r[1])+'</div></div>'; });
    h += '</div></div>';
    h += '<div class="card ppd-section"><div class="ppd-section-title">Recent sync / governance events</div>';
    if(!ev.length) h += '<div class="empty-state"><div class="ico">🧾</div><p>No PPD events logged yet</p></div>';
    else ev.forEach(function(e){ h += '<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(e.type||'event')+'</div><div class="ppd-list-meta">'+esc((e.summary||'')||JSON.stringify(e.payload||{}).slice(0,120))+'</div></div><div class="ppd-chip">'+dt(e.createdAtIso||e.createdAt)+'</div></div>'; });
    h += '</div>';
    h += '<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="ppd-section-title">Exception governance</div><button class="btn btn-pr btn-sm" onclick="openPPDOverrideForm()">Log Override</button></div>';
    if(!overridesOpen.length) h += '<div class="empty-state"><div class="ico">🛡️</div><p>No open overrides</p></div>';
    else overridesOpen.slice(0,12).forEach(function(x){ h += '<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(x.type||'Override')+'</div><div class="ppd-list-meta">'+esc(x.reason||x.notes||'')+'</div></div><div class="ppd-chip warn">'+esc(x.status||'open')+'</div></div>'; });
    h += '</div>';
    h += '</div>';
    shell.insertAdjacentHTML('beforeend', h);
    injectControlTab();
  }

  function renderEnhancer(){
    if(!ensureState()) return;
    attachExtraListeners();
    injectControlTab();
    injectControlView();
  }

  function wrapRenderer(){
    if(!window.MFX_VIEW_RENDERERS || !window.MFX_VIEW_RENDERERS.ppd || window.MFX_VIEW_RENDERERS.ppd.__ppdMasterWrapped) return;
    var base = window.MFX_VIEW_RENDERERS.ppd;
    var wrapped = function(){
      var out = base.apply(this, arguments);
      setTimeout(renderEnhancer, 0);
      return out;
    };
    wrapped.__ppdMasterWrapped = true;
    window.MFX_VIEW_RENDERERS.ppd = wrapped;
  }

  function logPPDEvent(type, payload){
    if(typeof fbDb==='undefined') return Promise.resolve(false);
    return fbDb.collection('ppdEvents').add({
      type: type,
      payload: payload || {},
      summary: payload && payload.summary ? payload.summary : '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
      createdBy: typeof getUserName==='function' ? getUserName() : 'System',
      createdById: typeof getUserId==='function' ? getUserId() : ''
    }).catch(function(err){ console.warn('ppdEvents log:', err.message || err); return false; });
  }
  window.logPPDEvent = logPPDEvent;

  function wrap(name, handler){
    var original = window[name];
    if(typeof original !== 'function' || original.__ppdMasterWrapped) return;
    window[name] = function(){ return handler.call(this, original, Array.prototype.slice.call(arguments)); };
    window[name].__ppdMasterWrapped = true;
  }

  wrap('openPPDSettings', function(original, args){
    var out = original.apply(this, args);
    setTimeout(function(){
      var modal = document.getElementById('modalContent');
      if(!modal) return;
      var title = modal.querySelector('.modal-title');
      if(title) title.textContent = 'PPD Shared Links + Inbox Settings';
      var drive = document.getElementById('ppd-set-drive');
      if(drive && drive.parentNode && drive.parentNode.querySelector('label')) drive.parentNode.querySelector('label').textContent='Google Shared Drive (source of truth)';
      var drop = document.getElementById('ppd-set-dropbox');
      if(drop && drop.parentNode){
        if(drop.parentNode.querySelector('label')) drop.parentNode.querySelector('label').textContent='Dropbox Exchange (optional edge)';
        var note = document.createElement('div');
        note.style.fontSize='10px'; note.style.color='var(--tx3)'; note.style.marginTop='4px';
        note.textContent='Dropbox is optional. Google Shared Drive remains the internal source of truth.';
        drop.parentNode.appendChild(note);
      }
    }, 20);
    return out;
  });

  wrap('savePPDSettings', function(original, args){
    var result = original.apply(this, args);
    setTimeout(function(){ var PPD=getPPD(); if(PPD){ PPD.settings.driveMode='primary'; PPD.settings.dropboxMode='optional'; localStorage.setItem('mfx_ppd_master_settings', JSON.stringify(PPD.settings)); } logPPDEvent('ppd.settings.saved', {summary:'PPD settings updated', drivePrimary:true, dropboxOptional:true}); }, 200);
    return result;
  });

  var __origSyncPPDSharedInbox = window.syncPPDSharedInbox;
  window.syncPPDSharedInbox = function(force){
    var PPD = getPPD();
    if(!PPD) return Promise.resolve(false);
    if(PPD.inboxSyncInFlight && !force) return Promise.resolve(false);
    if(!window.syncPPDInbox){ if(force) toast('Inbox sync helper unavailable','err'); return Promise.resolve(false); }
    var hasDelegatedMailbox = !!(PPD.settings && PPD.settings.inboxEmail);
    if(!window.GTOKEN && !hasDelegatedMailbox){ if(force) toast('Google sign-in token unavailable','err'); return Promise.resolve(false); }
    PPD.inboxSyncInFlight = true;
    return window.syncPPDInbox({
      query: (PPD.settings && PPD.settings.inboxQuery) || 'label:inbox is:unread',
      maxResults: 15,
      mailbox: (PPD.settings && PPD.settings.inboxEmail) || '',
      accessToken: window.GTOKEN || ''
    }).then(function(result){
      PPD.lastInboxSyncAt = new Date().toISOString();
      PPD.lastInboxSyncResult = result;
      if(force) toast('Inbox sync complete','ok');
      logPPDEvent('ppd.inbox.sync', {summary:'Shared inbox synced', created: result && result.created || 0, updated: result && result.updated || 0, mailbox: result && result.mailbox || ((PPD.settings && PPD.settings.inboxEmail) || '')});
      if(window.MFX && MFX.track) MFX.track('ppd.inbox.synced', result || {});
      if(window.MFX_VIEW_RENDERERS && window.MFX_VIEW_RENDERERS.ppd) window.MFX_VIEW_RENDERERS.ppd();
      return result;
    }).catch(function(err){
      if(force) toast((err && err.message) || String(err),'err');
      console.warn('PPD inbox sync:', err && err.message || err);
      return false;
    }).finally(function(){ PPD.inboxSyncInFlight = false; });
  };

  wrap('savePPDRequest', function(original, args){
    var company = (document.getElementById('ppd-r-company')||{}).value || '';
    var subject = (document.getElementById('ppd-r-subject')||{}).value || '';
    if(!company.trim() || !subject.trim()) { toast('Company and Subject / SKU are required', 'err'); return false; }
    var result = original.apply(this, args);
    setTimeout(function(){ logPPDEvent('ppd.request.saved', {summary:'PPD request saved', company: company.trim(), subject: subject.trim()}); }, 300);
    return result;
  });

  wrap('savePPDJobStudio', function(original, args){
    var stage = (document.getElementById('ppd-j-stage')||{}).value || 'Intake';
    var drive = (document.getElementById('ppd-j-drive')||{}).value || '';
    var dropbox = (document.getElementById('ppd-j-dropbox')||{}).value || '';
    if(stage === 'Released' && !drive.trim()) {
      if(!window.confirm('This job is being marked Released without a Google Shared Drive folder. Continue anyway?')) return false;
    }
    var result = original.apply(this, args);
    setTimeout(function(){ logPPDEvent('ppd.job.updated', {summary:'Job Studio updated', stage: stage, hasDrive: !!drive.trim(), hasDropbox: !!dropbox.trim()}); }, 300);
    return result;
  });

  wrap('savePPDApproval', function(original, args){
    var status = (document.getElementById('ppd-a-status')||{}).value || 'Awaiting Approval';
    var version = (document.getElementById('ppd-a-version')||{}).value || '';
    if((status === 'Approved' || status === 'Rejected') && !version.trim()) {
      if(!window.confirm('Approval version is blank. Save the approval anyway?')) return false;
    }
    var result = original.apply(this, args);
    setTimeout(function(){ logPPDEvent('ppd.approval.saved', {summary:'Approval record saved', status: status, version: version || 'unspecified'}); }, 300);
    return result;
  });

  wrap('savePlateIncident', function(original, args){
    var client = (document.getElementById('ppd-i-client')||{}).value || '';
    var part = (document.getElementById('ppd-i-part')||{}).value || '';
    var jt = (document.getElementById('ppd-i-jt')||{}).value || '';
    if(!client.trim() && !part.trim() && !jt.trim()) { toast('Add at least a client, part / plate #, or job ticket #', 'err'); return false; }
    var result = original.apply(this, args);
    setTimeout(function(){ logPPDEvent('ppd.incident.saved', {summary:'Plate / tool incident logged', client: client, partNumber: part, jobTicketNum: jt}); }, 300);
    return result;
  });

  wrap('provisionPPDJobFolders', function(original, args){
    return Promise.resolve(original.apply(this, args)).then(function(result){ logPPDEvent('ppd.folders.provisioned', {summary:'PPD job folders provisioned', rootFolderId: result && result.rootFolderId || ''}); return result; });
  });

  window.openPPDOverrideForm = function(){
    if(typeof openModal !== 'function') return;
    var h = '<div class="modal-title">PPD Override / Exception</div>'+
      '<div class="fg"><label>Type</label><select id="ppd-o-type"><option>Rush override</option><option>Release override</option><option>Data correction</option><option>Execution bypass</option></select></div>'+
      '<div class="fg"><label>Owner</label><input id="ppd-o-owner" value="'+esc(typeof getUserName==='function'?getUserName():'')+'"></div>'+
      '<div class="fg"><label>Status</label><select id="ppd-o-status"><option>open</option><option>review</option><option>resolved</option></select></div>'+
      '<div class="fg"><label>Reason / notes</label><textarea id="ppd-o-reason" style="min-height:90px"></textarea></div>'+
      '<button class="btn btn-pr" style="width:100%" onclick="savePPDOverride()">Save Override</button>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };

  window.savePPDOverride = function(){
    if(typeof fbDb==='undefined') return toast('Firestore unavailable','err');
    var payload = {
      type: (document.getElementById('ppd-o-type')||{}).value || 'Override',
      owner: (document.getElementById('ppd-o-owner')||{}).value || (typeof getUserName==='function'?getUserName():'System'),
      status: (document.getElementById('ppd-o-status')||{}).value || 'open',
      reason: (document.getElementById('ppd-o-reason')||{}).value || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
      createdBy: typeof getUserName==='function' ? getUserName() : 'System',
      createdById: typeof getUserId==='function' ? getUserId() : ''
    };
    if(!payload.reason.trim()) return toast('Reason is required','err');
    fbDb.collection('exceptionOverrides').add(payload).then(function(){ closeModal(); toast('Override logged','ok'); return logPPDEvent('ppd.override.saved', {summary:'Override logged', type: payload.type, status: payload.status}); }).catch(function(err){ toast(err.message||String(err),'err'); });
  };

  function boot(){
    ensureState();
    wrapRenderer();
    attachExtraListeners();
    if(window.S && window.S.view==='ppd') setTimeout(renderEnhancer,0);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
