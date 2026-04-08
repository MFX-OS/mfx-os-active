(function(){
  'use strict';
  if(typeof window==='undefined') return;

  var _ppdListeners=[];
  var PPD_TYPES=['Dieline','Engineering','Artwork','Proof','Spoilage','Redo','Sample','Internal Request'];
  var PPD_STAGES=['Intake','Validation','Art Review','Engineering','File Prep','Proof Ready','Proof Sent','Waiting Approval','Revision Needed','Plate Ready','Release QA','Released','Blocked'];
  var PPD_PROOF_STATES=['Not Started','Internal Review','Sent','Awaiting Approval','Approved','Rejected'];
  var PPD_TRANSITIONS = {
    'Intake': ['Validation','Blocked'],
    'Validation': ['Art Review','Intake','Blocked'],
    'Art Review': ['Engineering','Validation','Blocked'],
    'Engineering': ['File Prep','Art Review','Blocked'],
    'File Prep': ['Proof Ready','Engineering','Blocked'],
    'Proof Ready': ['Proof Sent','File Prep','Blocked'],
    'Proof Sent': ['Waiting Approval','Proof Ready','Blocked'],
    'Waiting Approval': ['Revision Needed','Plate Ready','Blocked'],
    'Revision Needed': ['Art Review','File Prep','Proof Ready','Blocked'],
    'Plate Ready': ['Release QA','Waiting Approval','Blocked'],
    'Release QA': ['Released','Plate Ready','Blocked'],
    'Released': ['Blocked'],
    'Blocked': ['Intake','Validation','Art Review','Engineering','File Prep','Proof Ready','Proof Sent','Waiting Approval','Plate Ready','Release QA']
  };
  var PPD={
    tab:'home',
    requests:[],
    inbox:[],
    tickets:[],
    blueprints:[],
    approvals:[],
    incidents:[],
    listenersStarted:false,
    inboxSyncTimer:null,
    inboxSyncInFlight:false,
    lastInboxSyncAt:null,
    lastInboxSyncResult:null,
    settings:loadSettings()
  };
  window.PPD=PPD;
  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_TITLES=window.MFX_VIEW_TITLES||{};
  window.MFX_VIEW_RENDERERS.ppd=renderPPDView;
  window.MFX_VIEW_TITLES.ppd='PPD · PrePress Design';

  var urlParams={};
  try{ var u=new URL(window.location.href); u.searchParams.forEach(function(v,k){urlParams[k]=v}); }catch(e){}
  var forcedEntry=(String(urlParams.module||'').toLowerCase()==='ppd' || /ppd\.html$/i.test(window.location.pathname||''));

  var previousAfterGo=window.MFX_AFTER_GO_VIEW;
  window.MFX_AFTER_GO_VIEW=function(v){
    if(typeof previousAfterGo==='function') previousAfterGo(v);
    syncPPDChrome(v==='ppd');
    if(v==='ppd') ensureInboxPolling();
  };

  window.getPreferredHomeView=function(){
    try{
      if(forcedEntry) return 'ppd';
    }catch(e){}
    return 'launchpad';
  };

  document.addEventListener('DOMContentLoaded',function(){
    applyLoginBranding(forcedEntry);
    ensurePPDTabVisible();
  });
  setTimeout(function(){ applyLoginBranding(forcedEntry); ensurePPDTabVisible(); ensureListeners(); },1200);

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s];}); }
  function escJs(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' '); }
  function uid(prefix){ return (prefix||'ppd')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }
  function fDate(v){ try{ var d=v&&v.toDate?v.toDate():new Date(v); if(!d||isNaN(d)) return '—'; return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }catch(e){ return '—'; } }
  function fDateTime(v){ try{ var d=v&&v.toDate?v.toDate():new Date(v); if(!d||isNaN(d)) return '—'; return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return '—'; } }
  function hoursSince(v){ try{ var d=v&&v.toDate?v.toDate():new Date(v); if(!d||isNaN(d)) return 0; return (Date.now()-d.getTime())/36e5; }catch(e){ return 0; } }
  function num(n){ return Number(n||0).toLocaleString(); }
  function money(n){ return '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function sortByDateDesc(arr,key){
    return arr.slice().sort(function(a,b){
      var av=a&&a[key], bv=b&&b[key];
      var ad=av&&av.toDate?av.toDate().getTime():new Date(av||0).getTime();
      var bd=bv&&bv.toDate?bv.toDate().getTime():new Date(bv||0).getTime();
      return bd-ad;
    });
  }
  function stageColor(stage){
    var map={
      'Intake':'var(--ac)','Validation':'var(--ac)','Art Review':'#fde047','Engineering':'#38bdf8',
      'File Prep':'#f59e0b','Proof Ready':'#fbbf24','Proof Sent':'#facc15','Waiting Approval':'#fb7185',
      'Revision Needed':'#ef4444','Plate Ready':'#22c55e','Release QA':'#93c5fd','Released':'#16a34a','Blocked':'#f97316'
    };
    return map[stage]||'var(--tx3)';
  }
  function isPPDRequest(r){
    var dept=String((r.department||r.dept||'')).toLowerCase();
    var type=String(r.requestType||'');
    return dept==='pre-press' || dept==='prepress' || dept==='ppd' || PPD_TYPES.indexOf(type)>=0;
  }
  function getTicketStage(jt){
    if(jt.ppd && jt.ppd.stage) return jt.ppd.stage;
    if(jt.prePressStatus==='done') return 'Released';
    if(jt.prePressStatus==='in-progress') return 'Art Review';
    if(jt.prePressStatus==='pending') return 'Intake';
    if(jt.status==='prepress') return 'Validation';
    return 'Intake';
  }
  function legacyPrepressFromStage(stage){
    if(stage==='Released' || stage==='Plate Ready' || stage==='Release QA') return 'done';
    if(stage==='Intake' || stage==='Validation') return 'pending';
    return 'in-progress';
  }
  function getActiveTickets(){ return PPD.tickets.filter(function(t){ return String(t.status||'').toLowerCase()!=='closed'; }); }
  function getCombinedIntake(){
    var reqs=PPD.requests.map(function(r){ return normalizeRequestRecord(r,'request'); });
    var inbox=PPD.inbox.map(function(i){ return normalizeInboxRecord(i); });
    return sortByDateDesc(reqs.concat(inbox),'sortAt');
  }
  function normalizeRequestRecord(r,source){
    return {
      sourceType: source||'request',
      id:r.id,
      status:r.status||'pending',
      requestType:r.requestType||'Request',
      company:r.company||r.client||'Internal',
      subject:r.subject||r.requestType||'Request',
      description:r.description||r.notes||'',
      assignedTo:r.assignedTo||r.owner||'',
      priority:r.priority||'Normal',
      createdAt:r.submittedAt||r.createdAt||r.updatedAt||'',
      sortAt:r.submittedAt||r.createdAt||r.updatedAt||'',
      linkedJobTicketId:r.linkedJobTicketId||'',
      raw:r
    };
  }
  function normalizeInboxRecord(i){
    return {
      sourceType:'inbox',
      id:i.id,
      status:i.status||'new',
      requestType:'Shared Inbox',
      company:esc(i.company||'Unknown'),
      subject:esc(i.subject||'Inbox message'),
      description:esc(i.snippet||''),
      assignedTo:esc(i.assignedTo||'Intake Desk'),
      priority:i.priority||'Normal',
      createdAt:i.receivedAt||i.createdAt||i.updatedAt||'',
      sortAt:i.receivedAt||i.createdAt||i.updatedAt||'',
      linkedJobTicketId:i.linkedJobTicketId||'',
      raw:i
    };
  }

  function getSalesSnapshot(){ return typeof getSalesOrders==='function' ? (getSalesOrders()||[]) : []; }
  function getPassportSnapshot(){ return typeof getPassports==='function' ? (getPassports()||[]) : []; }
  function getTicketSnapshot(){ return typeof getJobTickets==='function' ? (getJobTickets()||[]) : PPD.tickets; }
  function getCommercialDependencies(){
    var sos=getSalesSnapshot();
    var passports=getPassportSnapshot();
    var approvedWithoutPassport=sos.filter(function(so){ return (so.status==='approved'||so.status==='sent') && !passports.some(function(jp){ return jp.soId===so.id; }); });
    var passportsWithoutTickets=passports.filter(function(jp){ return (jp.status==='active' || jp.status==='prepress') && !getTicketSnapshot().some(function(t){ return t.passportId===jp.id; }); });
    return { approvedWithoutPassport:approvedWithoutPassport, passportsWithoutTickets:passportsWithoutTickets };
  }

  function ensurePPDTabVisible(){
    var tabs=document.querySelectorAll('.tab');
    [].forEach.call(tabs,function(t){ if(t.textContent.trim()==='PPD') t.style.display='block'; });
  }

  function applyLoginBranding(enabled){
    var body=document.body;
    if(!body) return;
    body.classList.toggle('ppd-mode', !!enabled);
    var wordmark=document.querySelector('#loginWordmark > div');
    var copyLine=document.querySelector('#loginCopy > div:first-child');
    var copyLine2=document.querySelector('#loginCopy > div:nth-child(2)');
    var sub=document.querySelector('#loginWordmark div:nth-child(3)');
    var signLabel=document.querySelector('#loginFormBlock div[style*="Sign In"]');
    if(enabled){
      document.title='PPD · PrePress Design';
      if(wordmark){ wordmark.textContent='PPD'; wordmark.style.color='var(--ac)'; wordmark.style.textShadow='0 0 18px rgba(215,255,47,.45)'; }
      if(sub){ sub.textContent='PrePress Design'; sub.style.color='rgba(215,255,47,.65)'; }
      if(copyLine) copyLine.textContent='The PrePress Department Workspace';
      if(copyLine2) copyLine2.textContent='ARTWORK · PROOFS · PLATES · RELEASE';
      if(signLabel) signLabel.textContent='PPD Access';
    }
  }

  function syncPPDChrome(active){
    var body=document.body;
    if(body) body.classList.toggle('ppd-mode', !!active);
    if(!active) return;
    var badge=$('topDeptBadge'); if(badge){ badge.textContent='PPD'; badge.style.background='var(--dept-pp)'; badge.style.color='#000'; }
    var role=$('topUserRole'); if(role){ role.textContent='PrePress Design Workspace'; }
  }

  function ensureListeners(){
    if(PPD.listenersStarted || typeof fbDb==='undefined') return;
    PPD.listenersStarted=true;

    _ppdListeners.push(fbDb.collection('requests').limit(300).onSnapshot(function(snap){
      PPD.requests=sortByDateDesc(snap.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }).filter(isPPDRequest),'submittedAt');
      if(window.S && window.S.view==='ppd') renderPPDView();
    },function(err){ console.warn('PPD requests listener:',err); }));

    _ppdListeners.push(fbDb.collection('prepressInbox').limit(300).onSnapshot(function(snap){
      PPD.inbox=sortByDateDesc(snap.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'receivedAt');
      if(window.S && window.S.view==='ppd') renderPPDView();
    },function(err){ console.warn('PPD inbox listener:',err); PPD.inbox=[]; }));

    _ppdListeners.push(fbDb.collection('jobTickets').limit(400).onSnapshot(function(snap){
      PPD.tickets=sortByDateDesc(snap.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt');
      if(window.S && window.S.view==='ppd') renderPPDView();
    },function(err){ console.warn('PPD tickets listener:',err); }));

    _ppdListeners.push(fbDb.collection('blueprints').limit(250).onSnapshot(function(snap){
      PPD.blueprints=sortByDateDesc(snap.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt');
      if(window.S && window.S.view==='ppd' && (PPD.tab==='history'||PPD.tab==='dashboards')) renderPPDView();
    },function(err){ console.warn('PPD blueprints listener:',err); }));

    _ppdListeners.push(fbDb.collection('approvalRecords').limit(250).onSnapshot(function(snap){
      PPD.approvals=sortByDateDesc(snap.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'createdAt');
      if(window.S && window.S.view==='ppd' && (PPD.tab==='approvals'||PPD.tab==='home'||PPD.tab==='dashboards')) renderPPDView();
    },function(){ PPD.approvals=[]; }));

    _ppdListeners.push(fbDb.collection('plateIncidents').limit(250).onSnapshot(function(snap){
      PPD.incidents=sortByDateDesc(snap.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'incidentDate');
      if(window.S && window.S.view==='ppd' && (PPD.tab==='assets'||PPD.tab==='dashboards'||PPD.tab==='home')) renderPPDView();
    },function(){ PPD.incidents=[]; }));
  }

  function ensureInboxPolling(){
    if(PPD.inboxSyncTimer) return;
    var everyMs=Math.max(1,Number(PPD.settings.syncEveryMin||3))*60*1000;
    PPD.inboxSyncTimer=setInterval(function(){
      if(window.S && window.S.view==='ppd') syncPPDSharedInbox(false);
    },everyMs);
  }

  function stopInboxPolling(){
    if(PPD.inboxSyncTimer){ clearInterval(PPD.inboxSyncTimer); PPD.inboxSyncTimer=null; }
  }

  function metric(label, value, sub){
    return '<div class="ppd-metric"><div class="ppd-metric-val">'+esc(value)+'</div><div class="ppd-metric-lbl">'+esc(label)+'</div><div class="ppd-metric-sub">'+esc(sub||'')+'</div></div>';
  }

  function renderPPDView(){
    ensureListeners();
    ensureInboxPolling();
    var el=$('v-ppd'); if(!el) return;
    syncPPDChrome(true);
    var intake=getCombinedIntake();
    var activeTickets=getActiveTickets();
    var waitingApproval=activeTickets.filter(function(t){ return getTicketStage(t)==='Waiting Approval' || (t.ppd&&t.ppd.proofStatus==='Awaiting Approval'); });
    var blocked=activeTickets.filter(function(t){ return getTicketStage(t)==='Blocked' || (t.ppd&&t.ppd.blocked); });
    var dueSoon=activeTickets.filter(function(t){ return t.ppd&&t.ppd.dueDate && new Date(t.ppd.dueDate).getTime()-Date.now() < 1000*60*60*48 && new Date(t.ppd.dueDate).getTime()-Date.now() > -1000*60*60*24; });
    var releaseReady=activeTickets.filter(function(t){ var c=(t.ppd&&t.ppd.checklist)||{}; return !!c.files && !!c.art && !!c.proof && !!c.release; });
    var inboxNew=PPD.inbox.filter(function(i){ return String(i.status||'new').toLowerCase()==='new'; });
    var incidentCost=PPD.incidents.reduce(function(sum,x){ return sum + Number(x.totalCost||0); },0);

    var h='';
    h+='<div class="ppd-shell fade-in">';
    h+='<div class="ppd-hero">';
    h+='<div><div class="ppd-kicker">Department Workspace</div><div class="ppd-title">PPD · PrePress Design</div><div class="ppd-sub">Shared inbox, planning, proofs, approvals, assets, issue history, and production handoff in one controlled PrePress workspace.</div></div>';
    h+='<div class="ppd-hero-actions">';
    h+='<button class="btn btn-pr" onclick="openPPDRequestForm()">＋ New Intake</button>';
    h+='<button class="btn btn-ghost" onclick="syncPPDSharedInbox(true)">📥 Sync Inbox</button>';
    h+='<button class="btn btn-ghost" onclick="openPPDSettings()">⚙ Workspace Settings</button>';
    h+='</div></div>';

    h+='<div class="ppd-metrics">';
    h+=metric('Open Intake', intake.filter(function(x){ return !/closed|done|converted/i.test(String(x.status||'')); }).length, 'Requests + inbox cards needing action');
    h+=metric('Inbox New', inboxNew.length, 'Gmail items not triaged yet');
    h+=metric('Active Jobs', activeTickets.length, 'Live prepress jobs and tickets');
    h+=metric('Waiting Approval', waitingApproval.length, 'Proofs or releases awaiting signoff');
    h+=metric('Blocked', blocked.length, 'Jobs with active blockers');
    h+=metric('Release Ready', releaseReady.length, 'All core checks completed');
    h+=metric('Due ≤ 48h', dueSoon.length, 'Approaching promised window');
    h+=metric('Incident Cost', money(incidentCost), 'Logged plate / tool impact');
    h+='</div>';

    h+='<div class="ppd-tabs">';
    [['home','Home'],['intake','Intake Desk'],['workbench','My Workbench'],['approvals','Approvals'],['dashboards','Dashboards'],['assets','Assets'],['history','History']].forEach(function(tab){
      h+='<button class="ppd-tab'+(PPD.tab===tab[0]?' active':'')+'" onclick="setPPDTab(\''+tab[0]+'\')">'+tab[1]+'</button>';
    });
    h+='</div>';

    if(PPD.tab==='home') h+=renderHome(activeTickets, intake, waitingApproval, blocked, releaseReady);
    if(PPD.tab==='intake') h+=renderIntake(intake);
    if(PPD.tab==='workbench') h+=renderWorkbench(activeTickets);
    if(PPD.tab==='approvals') h+=renderApprovals(waitingApproval);
    if(PPD.tab==='dashboards') h+=renderDashboards(activeTickets, intake, waitingApproval, blocked, releaseReady);
    if(PPD.tab==='assets') h+=renderAssets();
    if(PPD.tab==='history') h+=renderHistory();
    h+='</div>';

    el.innerHTML=h;
  }

  function renderHome(activeTickets, intake, waitingApproval, blocked, releaseReady){
    var dep=getCommercialDependencies();
    var stageCounts={};
    PPD_STAGES.forEach(function(st){ stageCounts[st]=0; });
    activeTickets.forEach(function(t){ stageCounts[getTicketStage(t)] = (stageCounts[getTicketStage(t)]||0)+1; });

    var h='<div class="ppd-grid-2">';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Today / next actions</div>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">';
    h+=moduleLink('Orders','📦',"goView('orders')");
    h+=moduleLink('Production','🏭',"goView('production')");
    h+=moduleLink('Team Chat','📌',"openTeamChat&&openTeamChat()");
    h+=moduleLink('Calendar','📅',"openMeetings&&openMeetings()");
    h+=moduleLink('My Inbox','📬',"openSupportInbox&&openSupportInbox()");
    h+=moduleLink('Data Sync','🔄',"goView('datasync')");
    h+='</div>';
    h+='<div class="ppd-section-sub">The module stays inside the OS while linking directly to other operating lanes only when needed.</div>';
    h+='<div style="display:grid;gap:8px">';
    h+=summaryRow('Shared inbox not triaged', PPD.inbox.filter(function(x){return String(x.status||'new').toLowerCase()==='new';}).length, 'Open Intake Desk');
    h+=summaryRow('Approved sales orders without passport', dep.approvedWithoutPassport.length, dep.approvedWithoutPassport.length?dep.approvedWithoutPassport[0].soNum+' next':'No gap detected');
    h+=summaryRow('Passports without tickets', dep.passportsWithoutTickets.length, dep.passportsWithoutTickets.length?dep.passportsWithoutTickets[0].jpNum+' next':'No gap detected');
    h+=summaryRow('Jobs waiting client approval', waitingApproval.length, waitingApproval.length?'Proof center needs follow-up':'Queue is clear');
    h+=summaryRow('Blocked jobs', blocked.length, blocked.length?'Open blocker log in Job Studio':'No active blockers');
    h+=summaryRow('Release-ready jobs', releaseReady.length, releaseReady.length?'Release QA can advance now':'Nothing release-ready yet');
    h+='</div></div>';

    h+='<div class="card ppd-section"><div class="ppd-section-title">Stage control tower</div><div class="ppd-section-sub">Operational stage counts across the current prepress queue.</div>';
    PPD_STAGES.forEach(function(st){
      var count=stageCounts[st]||0;
      var max=Math.max(activeTickets.length,1);
      h+='<div style="display:grid;grid-template-columns:150px 1fr 34px;gap:8px;align-items:center;margin-bottom:7px">';
      h+='<div style="font-size:11px;color:var(--tx)">'+esc(st)+'</div>';
      h+='<div style="height:10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:999px;overflow:hidden"><div style="height:100%;width:'+Math.max(4,(count/max)*100)+'%;background:'+stageColor(st)+';opacity:.9"></div></div>';
      h+='<div style="font-size:10px;color:var(--tx3);text-align:right">'+count+'</div></div>';
    });
    h+='</div>';

    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center"><div class="ppd-section-title">Shared inbox + office intake</div><button class="btn btn-ghost btn-xs" onclick="setPPDTab(\'intake\')">Open Intake Desk</button></div>';
    h+='<div class="ppd-section-sub">'+renderInboxStatusLine()+'</div>';
    if(!intake.length) h+='<div class="empty-state"><div class="ico">📥</div><p>No active intake cards</p></div>';
    else intake.slice(0,6).forEach(function(item){ h+=intakeCard(item); });
    h+='</div>';

    h+='<div class="card ppd-section"><div class="ppd-section-title">Recent active jobs</div>';
    if(!activeTickets.length) h+='<div class="empty-state"><div class="ico">🎨</div><p>No active prepress jobs yet</p></div>';
    else sortByDateDesc(activeTickets,'updatedAt').slice(0,8).forEach(function(t){ h+=ticketRow(t,true); });
    h+='</div>';
    h+='</div>';
    return h;
  }

  function renderIntake(intake){
    var inboxOnly=intake.filter(function(x){ return x.sourceType==='inbox'; });
    var requestsOnly=intake.filter(function(x){ return x.sourceType!=='inbox'; });
    var h='<div class="ppd-grid-2">';
    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="ppd-section-title">Shared Inbox Intake</div><div style="display:flex;gap:8px"><button class="btn btn-ghost btn-xs" onclick="syncPPDSharedInbox(true)">Sync Gmail</button><button class="btn btn-pr btn-sm" onclick="openPPDSettings()">Inbox Settings</button></div></div>';
    h+='<div class="ppd-section-sub">'+renderInboxStatusLine()+'</div>';
    if(!inboxOnly.length) h+='<div class="empty-state"><div class="ico">✉️</div><p>No shared inbox items captured yet</p></div>';
    else inboxOnly.slice(0,40).forEach(function(item){ h+=intakeCard(item); });
    h+='</div>';

    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="ppd-section-title">Structured Requests</div><button class="btn btn-pr btn-sm" onclick="openPPDRequestForm()">New Request</button></div>';
    h+='<div class="ppd-section-sub">Internal office requests, proof requests, artwork changes, dielines, engineering, spoilage, samples, and redo work.</div>';
    if(!requestsOnly.length) h+='<div class="empty-state"><div class="ico">📥</div><p>No active prepress requests</p></div>';
    else requestsOnly.slice(0,40).forEach(function(item){ h+=intakeCard(item); });
    h+='</div>';
    h+='</div>';
    return h;
  }

  function renderWorkbench(activeTickets){
    var cols=['Intake','Validation','Art Review','Engineering','File Prep','Proof Ready','Proof Sent','Waiting Approval','Revision Needed','Plate Ready','Release QA','Released','Blocked'];
    var h='<div class="ppd-board">';
    cols.forEach(function(stage){
      var items=activeTickets.filter(function(t){ return getTicketStage(t)===stage; });
      h+='<div class="ppd-col"><div class="ppd-col-title">'+stage+' <span>'+items.length+'</span></div>';
      if(!items.length) h+='<div class="ppd-col-empty">No jobs</div>';
      else items.slice(0,16).forEach(function(t){ h+=ticketMiniCard(t); });
      h+='</div>';
    });
    h+='</div>';
    return h;
  }

  function renderApprovals(waitingApproval){
    var h='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="ppd-section-title">Proof + Approval Center</div><button class="btn btn-pr btn-sm" onclick="openPPDApprovalForm()">Log Approval</button></div>';
    h+='<div class="ppd-section-sub">Structured proof and approval records tied back to jobs, versions, and release timeline.</div>';
    var records=PPD.approvals.slice(0,25);
    if(records.length){
      records.forEach(function(a){
        h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(a.jobTicketNum||a.jtNum||a.jobTicketId||'Approval')+' · '+esc(a.status||'Logged')+'</div><div class="ppd-list-meta">'+esc(a.version||'No version')+' · '+esc(a.approver||a.requestedFrom||'Unknown')+' · '+fDateTime(a.createdAt||a.approvedAt)+'</div></div><div class="ppd-chip">'+esc(a.type||'Proof')+'</div></div>';
      });
    } else if(waitingApproval.length){
      waitingApproval.forEach(function(t){ h+=ticketRow(t,false); });
    } else {
      h+='<div class="empty-state"><div class="ico">✅</div><p>No pending approval activity</p></div>';
    }
    h+='</div>';
    return h;
  }

  function renderDashboards(activeTickets, intake, waitingApproval, blocked, releaseReady){
    var approvalAging=waitingApproval.map(function(t){ return {ticket:t,hrs:hoursSince((t.updatedAt||t.createdAt))}; }).sort(function(a,b){ return b.hrs-a.hrs; });
    var incidentCost=PPD.incidents.reduce(function(sum,x){ return sum + Number(x.totalCost||0); },0);
    var dep=getCommercialDependencies();
    var h='<div class="ppd-grid-2">';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Operational dashboard</div><div class="ppd-section-sub">Live rollup of intake, queue, approvals, blockers, readiness, and incidents.</div>';
    h+=dashboardTable([
      ['Open intake', intake.filter(function(x){ return !/closed|done|converted/i.test(String(x.status||'')); }).length],
      ['Shared inbox new', PPD.inbox.filter(function(x){ return String(x.status||'new').toLowerCase()==='new'; }).length],
      ['Active jobs', activeTickets.length],
      ['Waiting approval', waitingApproval.length],
      ['Blocked', blocked.length],
      ['Release ready', releaseReady.length],
      ['Incident cost', money(incidentCost)]
    ]);
    h+='</div>';

    h+='<div class="card ppd-section"><div class="ppd-section-title">Cross-module dependency dashboard</div><div class="ppd-section-sub">What PPD is waiting on or feeding across sales, passports, tickets, and production.</div>';
    h+=dashboardTable([
      ['Approved SOs without passport', dep.approvedWithoutPassport.length],
      ['Passports without tickets', dep.passportsWithoutTickets.length],
      ['Tickets in Intake/Validation', activeTickets.filter(function(t){ var s=getTicketStage(t); return s==='Intake'||s==='Validation'; }).length],
      ['Tickets in production-ready stages', activeTickets.filter(function(t){ var s=getTicketStage(t); return s==='Plate Ready'||s==='Release QA'||s==='Released'; }).length],
      ['Blueprint records', PPD.blueprints.length],
      ['Approval records', PPD.approvals.length]
    ]);
    h+='</div>';

    h+='<div class="card ppd-section"><div class="ppd-section-title">Approval aging</div>';
    if(!approvalAging.length) h+='<div class="empty-state"><div class="ico">⏱️</div><p>No approvals aging right now</p></div>';
    else approvalAging.slice(0,10).forEach(function(row){
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(row.ticket.jtNum||row.ticket.id)+' · '+esc(row.ticket.company||'—')+'</div><div class="ppd-list-meta">'+esc(getTicketStage(row.ticket))+' · '+esc((row.ticket.ppd&&row.ticket.ppd.proofStatus)||'Pending')+'</div></div><div class="ppd-chip warn">'+Math.round(row.hrs)+'h</div></div>';
    });
    h+='</div>';

    h+='<div class="card ppd-section"><div class="ppd-section-title">Dashboards + master registers</div>';
    h+=linkRow('Master Registers Dashboard', PPD.settings.masterDashUrl, 'Executive + operations rollup');
    h+=linkRow('Operations Dashboard', PPD.settings.opsDashUrl, 'WIP, blockers, release readiness');
    h+=moduleLink('FlexAi Dashboard','📊',"goView('ceodash')");
    h+=moduleLink('Data Sync','🔄',"goView('datasync')");
    h+='</div>';
    h+='</div>';
    return h;
  }

  function renderAssets(){
    var h='<div class="ppd-grid-2">';
    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="ppd-section-title">Plate / Tool Incident Log</div><button class="btn btn-pr btn-sm" onclick="openPlateIncidentForm()">Log Incident</button></div>';
    h+='<div class="ppd-section-sub">Damaged plates, reburns, obsolete art, delays, and remake cost recorded inside the same OS.</div>';
    if(!PPD.incidents.length){ h+='<div class="empty-state"><div class="ico">🧱</div><p>No plate incidents logged yet</p></div>'; }
    else PPD.incidents.slice(0,16).forEach(function(i){
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(i.incidentNum||i.partNumber||i.plateJob||i.client||'Plate incident')+'</div><div class="ppd-list-meta">'+esc(i.client||'No client')+' · '+esc(i.jobTicketNum||i.jobTicket||'No JT')+' · '+fDate(i.incidentDate)+'</div></div><div class="ppd-chip danger">'+esc(i.damageType||'Issue')+'</div></div>';
    });
    h+='</div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Connected file systems</div>';
    h+=linkRow('Open Shared Drive', PPD.settings.driveUrl, 'Working files, proofs, approvals, and released packets');
    h+=linkRow('Open Dropbox Exchange', PPD.settings.dropboxUrl, 'Edge exchange folders for client/vendor collaboration');
    h+=linkRow('Google Chat Space', PPD.settings.chatUrl, 'Department coordination space');
    h+='<div class="ppd-section-sub" style="margin-top:8px">Store folder links at the job level in Job Studio so every ticket carries its own Drive / Dropbox references without leaving the module.</div>';
    h+='</div></div>';
    return h;
  }

  function renderHistory(){
    var h='<div class="ppd-grid-2">';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Recent blueprints / specs</div>';
    if(!PPD.blueprints.length) h+='<div class="empty-state"><div class="ico">📐</div><p>No blueprints found</p></div>';
    else PPD.blueprints.slice(0,14).forEach(function(bp){
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(bp.bpId||bp.id)+' · '+esc(bp.bpName||bp.name||'Blueprint')+'</div><div class="ppd-list-meta">'+esc(bp.company||bp.client||'—')+' · '+esc(bp.colors||'')+'C · '+esc(bp.face||'')+'</div></div><div class="ppd-chip">'+esc(bp.jobType||'Spec')+'</div></div>';
    });
    h+='</div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Client + SKU memory</div>';
    h+='<div class="ppd-section-sub">The same jobs, proofs, issues, and incidents accumulate into reusable client history and SKU memory. This panel is fed from blueprints, tickets, approvals, and incidents already attached to the shared OS data model.</div>';
    var recent=sortByDateDesc(PPD.tickets,'updatedAt').slice(0,10);
    if(!recent.length) h+='<div class="empty-state"><div class="ico">🧠</div><p>No recent history yet</p></div>';
    else recent.forEach(function(t){ h+=ticketRow(t,false); });
    h+='</div></div>';
    return h;
  }

  function renderInboxStatusLine(){
    var parts=[];
    parts.push(PPD.settings.inboxEmail ? ('Inbox: '+PPD.settings.inboxEmail) : 'No inbox email configured');
    if(PPD.settings.inboxQuery) parts.push('Query: '+PPD.settings.inboxQuery);
    if(PPD.lastInboxSyncAt) parts.push('Last sync: '+fDateTime(PPD.lastInboxSyncAt));
    if(PPD.lastInboxSyncResult && PPD.lastInboxSyncResult.created!=null) parts.push('Added: '+PPD.lastInboxSyncResult.created+' / Updated: '+PPD.lastInboxSyncResult.updated);
    return parts.join(' · ');
  }

  function intakeCard(item){
    var isInbox=item.sourceType==='inbox';
    var badge=isInbox ? '<span class="ppd-chip warn">Inbox</span>' : '<span class="ppd-chip">Request</span>';
    var actions='';
    if(isInbox){
      actions+='<button class="btn btn-ghost btn-xs" onclick="convertPPDInboxToRequest(\''+item.id+'\')">Create Request</button>';
      actions+='<button class="btn btn-pr btn-xs" onclick="convertPPDInboxToTicket(\''+item.id+'\')">Create Job</button>';
      if(item.raw && item.raw.sourceUrl) actions+='<a class="btn btn-ghost btn-xs" href="'+esc(item.raw.sourceUrl)+'" target="_blank" rel="noopener">Open Gmail</a>';
    } else {
      actions+='<button class="btn btn-ghost btn-xs" onclick="openPPDRequestForm(\''+escJs(item.raw.requestType||'Artwork')+'\',\''+item.id+'\')">Edit</button>';
      actions+='<button class="btn btn-pr btn-xs" onclick="convertPPDRequestToTicket(\''+item.id+'\')">Create Job</button>';
    }
    return '<div class="ppd-request-card">'
      +'<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><div class="ppd-list-title">'+esc(item.subject)+' · '+esc(item.company||'Internal')+'</div><div class="ppd-list-meta">'+esc(item.assignedTo||'Intake Desk')+' · '+esc(item.priority||'Normal')+' priority · '+fDateTime(item.createdAt)+'</div></div>'+badge+'</div>'
      +'<div class="ppd-request-desc">'+esc(item.description||'—')+'</div>'
      +'<div class="ppd-request-actions">'+actions+'</div>'
      +'</div>';
  }

  function ticketRow(t,withOpen){
    var st=getTicketStage(t);
    var due=t.ppd&&t.ppd.dueDate ? fDate(t.ppd.dueDate) : 'No due date';
    return '<div class="ppd-list-item">'
      +'<div><div class="ppd-list-title">'+esc(t.jtNum||t.id)+' · '+esc(t.skuName||'SKU')+'</div><div class="ppd-list-meta">'+esc(t.company||'—')+' · '+esc(st)+' · '+due+'</div></div>'
      +'<div style="display:flex;gap:6px;align-items:center"><span class="ppd-pill" style="--ppd-pill:'+stageColor(st)+'">'+esc(st)+'</span>'+(withOpen?'<button class="btn btn-ghost btn-xs" onclick="openPPDJobStudio(\''+t.id+'\')">Open</button>':'')+'</div></div>';
  }
  function ticketMiniCard(t){
    var st=getTicketStage(t);
    return '<div class="ppd-mini" onclick="openPPDJobStudio(\''+t.id+'\')">'
      +'<div class="ppd-mini-top"><span>'+esc(t.jtNum||t.id)+'</span><span class="ppd-mini-stage" style="color:'+stageColor(st)+'">'+esc(st)+'</span></div>'
      +'<div class="ppd-mini-main">'+esc(t.skuName||'SKU')+'</div>'
      +'<div class="ppd-mini-sub">'+esc(t.company||'—')+'</div>'
      +'</div>';
  }
  function linkRow(label,url,desc){
    var action=url?'<a class="btn btn-ghost btn-xs" href="'+esc(url)+'" target="_blank" rel="noopener">Open</a>':'<button class="btn btn-ghost btn-xs" onclick="openPPDSettings()">Set link</button>';
    return '<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(label)+'</div><div class="ppd-list-meta">'+esc(desc)+'</div></div>'+action+'</div>';
  }
  function moduleLink(label, icon, onclick){
    return '<button class="btn btn-ghost btn-xs" onclick="'+onclick+'">'+icon+' '+label+'</button>';
  }
  function summaryRow(label, value, sub){
    return '<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(label)+'</div><div class="ppd-list-meta">'+esc(sub||'')+'</div></div><div class="ppd-chip">'+esc(value)+'</div></div>';
  }
  function dashboardTable(rows){
    var h='<div style="display:grid;gap:8px">';
    rows.forEach(function(r){ h+=summaryRow(r[0], r[1], r[2]||''); });
    h+='</div>';
    return h;
  }
  function field(label,input){ return '<div class="fg"><label>'+label+'</label>'+input+'</div>'; }
  function check(id,label,val){ return '<label style="display:flex;align-items:center;gap:8px;background:var(--bg3);padding:8px;border-radius:8px"><input type="checkbox" id="'+id+'"'+(val?' checked':'')+' style="width:auto"> <span style="font-size:11px">'+label+'</span></label>'; }
  function loadSettings(){
    try{
      return Object.assign({
        driveUrl:'', dropboxUrl:'', inboxEmail:'', inboxQuery:'label:inbox is:unread to:prepress@microflexfilm.com', chatUrl:'', masterDashUrl:'', opsDashUrl:'', syncEveryMin:3
      }, JSON.parse(localStorage.getItem('mfx_ppd_workbench_settings')||'{}'));
    }catch(e){ return {driveUrl:'',dropboxUrl:'',inboxEmail:'',inboxQuery:'label:inbox is:unread to:prepress@microflexfilm.com',chatUrl:'',masterDashUrl:'',opsDashUrl:'',syncEveryMin:3}; }
  }

  window.setPPDTab=function(tab){ PPD.tab=tab; renderPPDView(); };

  window.openPPDSettings=function(){
    var s=PPD.settings;
    var h='<div class="modal-title">PPD Shared Links + Inbox Settings</div>'
      +field('Google Shared Drive','<input id="ppd-set-drive" value="'+esc(s.driveUrl||'')+'" placeholder="https://drive.google.com/...">')
      +field('Dropbox Exchange','<input id="ppd-set-dropbox" value="'+esc(s.dropboxUrl||'')+'" placeholder="https://www.dropbox.com/...">')
      +field('Shared Inbox Email','<input id="ppd-set-inbox" value="'+esc(s.inboxEmail||'')+'" placeholder="prepress@microflexfilm.com">')
      +field('Gmail Intake Query','<input id="ppd-set-query" value="'+esc(s.inboxQuery||'')+'" placeholder="label:inbox is:unread to:prepress@...">')
      +field('Inbox Sync Minutes','<input id="ppd-set-sync" type="number" min="1" max="30" value="'+esc(s.syncEveryMin||3)+'">')
      +field('Google Chat Space URL','<input id="ppd-set-chat" value="'+esc(s.chatUrl||'')+'" placeholder="https://chat.google.com/...">')
      +field('Master Dashboard URL','<input id="ppd-set-dash" value="'+esc(s.masterDashUrl||'')+'" placeholder="https://docs.google.com/...">')
      +field('Operations Dashboard URL','<input id="ppd-set-ops-dash" value="'+esc(s.opsDashUrl||'')+'" placeholder="https://docs.google.com/...">')
      +'<button class="btn btn-pr" style="width:100%" onclick="savePPDSettings()">Save</button>'
      +'<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Close</button>';
    openModal(h);
  };

  window.savePPDSettings=function(){
    PPD.settings={
      driveUrl:( $('ppd-set-drive')||{} ).value||'',
      dropboxUrl:( $('ppd-set-dropbox')||{} ).value||'',
      inboxEmail:( $('ppd-set-inbox')||{} ).value||'',
      inboxQuery:( $('ppd-set-query')||{} ).value||'',
      syncEveryMin:parseInt(( $('ppd-set-sync')||{} ).value||3,10)||3,
      chatUrl:( $('ppd-set-chat')||{} ).value||'',
      masterDashUrl:( $('ppd-set-dash')||{} ).value||'',
      opsDashUrl:( $('ppd-set-ops-dash')||{} ).value||''
    };
    localStorage.setItem('mfx_ppd_workbench_settings',JSON.stringify(PPD.settings));
    stopInboxPolling();
    ensureInboxPolling();
    closeModal();
    toast('PPD settings saved','ok');
    renderPPDView();
  };

  window.syncPPDSharedInbox=function(force){
    if(PPD.inboxSyncInFlight && !force) return Promise.resolve(false);
    if(!window.syncPPDInbox){ if(force) toast('Inbox sync helper unavailable','err'); return Promise.resolve(false); }
    if(!window.GTOKEN){ if(force) toast('Google sign-in token unavailable','err'); return Promise.resolve(false); }
    PPD.inboxSyncInFlight=true;
    return window.syncPPDInbox({
      query: PPD.settings.inboxQuery || 'label:inbox is:unread',
      maxResults: 15,
      mailbox: PPD.settings.inboxEmail || ''
    }).then(function(result){
      PPD.lastInboxSyncAt=new Date().toISOString();
      PPD.lastInboxSyncResult=result;
      if(force) toast('Inbox sync complete','ok');
      if(window.MFX&&MFX.track) MFX.track('ppd.inbox.synced',result);
      renderPPDView();
      return result;
    }).catch(function(err){
      if(force) toast(err.message,'err');
      console.warn('PPD inbox sync:',err.message||err);
      return false;
    }).finally(function(){ PPD.inboxSyncInFlight=false; });
  };

  window.openPPDRequestForm=function(defaultType, requestId){
    var existing=requestId?PPD.requests.find(function(r){ return r.id===requestId; }):null;
    var h='<div class="modal-title">'+(existing?'Edit':'New')+' PPD Request</div>'
      +field('Request Type','<select id="ppd-r-type">'+PPD_TYPES.map(function(t){ var selected=((existing&&existing.requestType)||defaultType||'Artwork')===t?' selected':''; return '<option'+selected+'>'+t+'</option>'; }).join('')+'</select>')
      +field('Company / Client','<input id="ppd-r-company" value="'+esc(existing&&existing.company||'')+'" placeholder="Client or internal requester">')
      +field('Subject / SKU','<input id="ppd-r-subject" value="'+esc(existing&&existing.subject||existing&&existing.sku||'')+'" placeholder="SKU, product, or task title">')
      +field('Priority','<select id="ppd-r-priority"><option'+((existing&&existing.priority)==='Low'?' selected':'')+'>Low</option><option'+((existing&&existing.priority)==='Normal'?' selected':'')+'>Normal</option><option'+((existing&&existing.priority)==='High'?' selected':'')+'>High</option><option'+((existing&&existing.priority)==='Rush'?' selected':'')+'>Rush</option></select>')
      +field('Target Date','<input id="ppd-r-target" type="date" value="'+esc(existing&&existing.targetDate||'')+'">')
      +field('Description','<textarea id="ppd-r-desc" style="min-height:110px">'+esc(existing&&existing.description||'')+'</textarea>')
      +'<button class="btn btn-pr" style="width:100%" onclick="savePPDRequest('+(requestId?'\''+requestId+'\'':'')+')">Save Request</button>'
      +'<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };

  window.savePPDRequest=function(requestId){
    var payload={
      department:'Pre-Press',
      requestType:( $('ppd-r-type')||{} ).value||'Artwork',
      company:( $('ppd-r-company')||{} ).value||'Internal',
      subject:( $('ppd-r-subject')||{} ).value||'',
      sku:( $('ppd-r-subject')||{} ).value||'',
      priority:( $('ppd-r-priority')||{} ).value||'Normal',
      targetDate:( $('ppd-r-target')||{} ).value||'',
      description:( $('ppd-r-desc')||{} ).value||'',
      assignedTo:getUserName(),
      submittedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:new Date().toISOString(),
      updatedBy:getUserName(),
      status:'pending'
    };
    var ref=requestId?fbDb.collection('requests').doc(requestId):fbDb.collection('requests').doc(uid('req'));
    ref.set(payload,{merge:true}).then(function(){
      closeModal(); toast('PPD request saved','ok'); if(window.MFX&&MFX.track) MFX.track('ppd.request.saved',{requestId:ref.id});
    }).catch(function(e){ toast(e.message,'err'); });
  };

  async function createPPDJobFromSource(sourceType, sourceDoc){
    var jtId='jt_'+Date.now();
    var jtNum=await requestServerNumber('jobTicket', function(){ return 'JT'+String(Date.now()).slice(-6); });
    var company=sourceDoc.company||sourceDoc.client||'Internal';
    var sku=sourceDoc.subject||sourceDoc.sku||sourceDoc.requestType||sourceDoc.subject||'Prepress Work';
    var notes=sourceDoc.description||sourceDoc.snippet||'';
    var stage=(sourceType==='inbox'?'Validation':'Intake');
    var jt={
      id:jtId,
      jtNum:jtNum,
      company:company,
      skuName:sku,
      status:'prepress',
      prePressStatus:'pending',
      ppd:{
        stage:stage,
        assignedTo:sourceDoc.assignedTo||getUserName(),
        dueDate:sourceDoc.targetDate||'',
        sourceType:sourceType,
        sourceRequestId:sourceType==='request'?sourceDoc.id:'',
        sourceInboxId:sourceType==='inbox'?sourceDoc.id:'',
        proofStatus:'Not Started',
        blocked:false,
        driveFolderUrl:'',
        dropboxFolderUrl:'',
        checklist:{files:false,art:false,proof:false,release:false},
        notes:notes
      },
      createdAt:new Date().toISOString(),
      createdBy:getUserName(),
      updatedAt:new Date().toISOString(),
      updatedBy:getUserName(),
      log:[{action:'Created from '+sourceType+' '+sourceDoc.id,by:getUserName(),at:new Date().toISOString()}]
    };
    await fbDb.collection('jobTickets').doc(jt.id).set(jt,{merge:true});
    if(sourceType==='request'){
      await fbDb.collection('requests').doc(sourceDoc.id).set({status:'converted',linkedJobTicketId:jt.id,updatedAt:new Date().toISOString()},{merge:true});
    } else {
      await fbDb.collection('prepressInbox').doc(sourceDoc.id).set({status:'converted',linkedJobTicketId:jt.id,updatedAt:new Date().toISOString()},{merge:true});
    }
    if(typeof provisionPPDWorkspace==='function'){
      try{
        var provision=await provisionPPDWorkspace({jobTicketId:jt.id,jobTicketNum:jt.jtNum,company:company,skuName:sku});
        await fbDb.collection('jobTickets').doc(jt.id).set({ppd:{driveFolderUrl:provision.rootFolderUrl,driveFolderId:provision.rootFolderId,driveFolders:provision.folders||{}},updatedAt:new Date().toISOString(),updatedBy:getUserName()},{merge:true});
      }catch(err){ console.warn('PPD folder provisioning:',err.message||err); }
    }
    toast('PPD job created','ok');
    PPD.tab='workbench';
    renderPPDView();
    return jt;
  }

  window.convertPPDRequestToTicket=function(requestId){
    var r=PPD.requests.find(function(x){ return x.id===requestId; });
    if(!r) return toast('Request not found','err');
    createPPDJobFromSource('request', r).catch(function(e){ toast(e.message,'err'); });
  };

  window.convertPPDInboxToRequest=function(inboxId){
    var item=PPD.inbox.find(function(x){ return x.id===inboxId; });
    if(!item) return toast('Inbox item not found','err');
    var payload={
      department:'Pre-Press',
      requestType:'Artwork',
      company:item.company||'',
      subject:item.subject||'',
      sku:item.subject||'',
      priority:item.priority||'Normal',
      description:item.snippet||'',
      sourceInboxId:item.id,
      sourceUrl:item.sourceUrl||'',
      submittedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:new Date().toISOString(),
      updatedBy:getUserName(),
      status:'pending'
    };
    var requestId=uid('req');
    fbDb.collection('requests').doc(requestId).set(payload,{merge:true}).then(function(){
      return fbDb.collection('prepressInbox').doc(item.id).set({status:'convertedToRequest',linkedRequestId:requestId,updatedAt:new Date().toISOString()},{merge:true});
    }).then(function(){ toast('Inbox item converted to request','ok'); }).catch(function(e){ toast(e.message,'err'); });
  };

  window.convertPPDInboxToTicket=function(inboxId){
    var item=PPD.inbox.find(function(x){ return x.id===inboxId; });
    if(!item) return toast('Inbox item not found','err');
    createPPDJobFromSource('inbox', item).catch(function(e){ toast(e.message,'err'); });
  };

  window.openPPDJobStudio=function(ticketId){
    var t=PPD.tickets.find(function(x){ return x.id===ticketId; });
    if(!t) return toast('Job not found','err');
    var ppd=t.ppd||{};
    var checklist=ppd.checklist||{};
    var h='<div class="modal-title">'+esc(t.jtNum||ticketId)+' · Job Studio</div>'
      +'<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">'+esc(t.company||'—')+' · '+esc(t.skuName||'SKU')+'</div>'
      +field('Stage','<select id="ppd-j-stage">'+PPD_STAGES.map(function(st){ return '<option'+(getTicketStage(t)===st?' selected':'')+'>'+st+'</option>'; }).join('')+'</select>')
      +field('Assigned To','<input id="ppd-j-assigned" value="'+esc(ppd.assignedTo||t.assignedTo||'')+'">')
      +field('Due Date','<input id="ppd-j-due" type="date" value="'+esc(ppd.dueDate||'')+'">')
      +field('Proof Status','<select id="ppd-j-proof">'+PPD_PROOF_STATES.map(function(st){ return '<option'+((ppd.proofStatus||'Not Started')===st?' selected':'')+'>'+st+'</option>'; }).join('')+'</select>')
      +field('Google Shared Drive Folder','<input id="ppd-j-drive" value="'+esc(ppd.driveFolderUrl||'')+'" placeholder="https://drive.google.com/...">')
      +field('Dropbox Exchange Folder','<input id="ppd-j-dropbox" value="'+esc(ppd.dropboxFolderUrl||'')+'" placeholder="https://www.dropbox.com/...">')
      +field('Blocked?','<select id="ppd-j-blocked"><option value="no"'+(!(ppd.blocked)?' selected':'')+'>No</option><option value="yes"'+(ppd.blocked?' selected':'')+'>Yes</option></select>')
      +field('Blocker / Notes','<textarea id="ppd-j-notes" style="min-height:80px">'+esc(ppd.notes||'')+'</textarea>')
      +'<div class="fg"><label>Checklist</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
      +check('ppd-j-chk-files','Files validated',checklist.files)+check('ppd-j-chk-art','Artwork reviewed',checklist.art)+check('ppd-j-chk-proof','Proof cycle logged',checklist.proof)+check('ppd-j-chk-release','Release packet ready',checklist.release)
      +'</div></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn btn-pr" onclick="savePPDJobStudio(\''+t.id+'\')">Save</button><button class="btn btn-ghost" onclick="provisionPPDJobFolders(\''+t.id+'\')">Provision Folders</button></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><button class="btn btn-ghost" onclick="openPPDApprovalForm(\''+t.id+'\')">Log Approval</button><button class="btn btn-ghost" onclick="goView(\'production\');closeModal()">Open Production</button></div>'
      +'<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Close</button>';
    openModal(h);
  };

  window.provisionPPDJobFolders=function(ticketId){
    var t=PPD.tickets.find(function(x){ return x.id===ticketId; });
    if(!t) return toast('Job not found','err');
    return provisionPPDWorkspace({jobTicketId:t.id,jobTicketNum:t.jtNum,company:t.company||'Client',skuName:t.skuName||'Job',blueprintId:t.blueprintId||''}).then(function(data){
      toast('Folders provisioned','ok');
      fbDb.collection('jobTickets').doc(t.id).set({ppd:{driveFolderUrl:data.rootFolderUrl,driveFolderId:data.rootFolderId,driveFolders:data.folders||{}},updatedAt:new Date().toISOString(),updatedBy:getUserName()},{merge:true});
      return data;
    }).catch(function(err){ toast(err.message||String(err),'err'); throw err; });
  };

  window.savePPDJobStudio=function(ticketId){
    // PPD_TRANSITIONS is now at module scope (shared with savePPDApproval)
    var t=PPD.tickets.find(function(x){ return x.id===ticketId; });
    if(!t) return toast('Job not found','err');
    var stage=( $('ppd-j-stage')||{} ).value||'Intake';
    var currentStage = (t.ppd && t.ppd.stage) || 'Intake';
    if(PPD_TRANSITIONS[currentStage] && PPD_TRANSITIONS[currentStage].length > 0 && PPD_TRANSITIONS[currentStage].indexOf(stage) === -1) {
      toast('Cannot move from ' + currentStage + ' to ' + stage,'err'); return;
    }
    if(stage === 'Released') {
      var clFiles = !!( ($('ppd-j-chk-files')||{}).checked );
      var clArt = !!( ($('ppd-j-chk-art')||{}).checked );
      var clProof = !!( ($('ppd-j-chk-proof')||{}).checked );
      var clRelease = !!( ($('ppd-j-chk-release')||{}).checked );
      if(!clFiles || !clArt || !clProof || !clRelease) {
        toast('Complete all checklist items before release','err'); return;
      }
    }
    // Auto-update file lifecycle based on stage
    var FILE_STAGE_MAP = {
      'Intake': 'working',
      'Validation': 'working',
      'Art Review': 'working',
      'Engineering': 'working',
      'File Prep': 'working',
      'Proof Ready': 'proof',
      'Proof Sent': 'proof',
      'Waiting Approval': 'proof',
      'Revision Needed': 'working',
      'Plate Ready': 'approved',
      'Release QA': 'approved',
      'Released': 'released',
      'Blocked': 'hold'
    };
    var patch={
      prePressStatus:legacyPrepressFromStage(stage),
      status:(stage==='Released'?'running':'prepress'),
      updatedAt:new Date().toISOString(),
      updatedBy:getUserName(),
      ppd:{
        stage:stage,
        fileStatus:FILE_STAGE_MAP[stage] || 'working',
        assignedTo:( $('ppd-j-assigned')||{} ).value||'',
        dueDate:( $('ppd-j-due')||{} ).value||'',
        proofStatus:( $('ppd-j-proof')||{} ).value||'Not Started',
        driveFolderUrl:( $('ppd-j-drive')||{} ).value||'',
        dropboxFolderUrl:( $('ppd-j-dropbox')||{} ).value||'',
        blocked:(( $('ppd-j-blocked')||{} ).value==='yes'),
        notes:( $('ppd-j-notes')||{} ).value||'',
        checklist:{
          files:!!(( $('ppd-j-chk-files')||{} ).checked),
          art:!!(( $('ppd-j-chk-art')||{} ).checked),
          proof:!!(( $('ppd-j-chk-proof')||{} ).checked),
          release:!!(( $('ppd-j-chk-release')||{} ).checked)
        }
      }
    };
    var flatPatch = {};
    // Flatten nested ppd fields using dot notation
    if(patch.ppd) {
      Object.keys(patch.ppd).forEach(function(k) {
        if(k === 'checklist' && typeof patch.ppd.checklist === 'object') {
          Object.keys(patch.ppd.checklist).forEach(function(ck) {
            flatPatch['ppd.checklist.' + ck] = patch.ppd.checklist[ck];
          });
        } else {
          flatPatch['ppd.' + k] = patch.ppd[k];
        }
      });
    }
    // Copy non-ppd fields
    Object.keys(patch).forEach(function(k) { if(k !== 'ppd') flatPatch[k] = patch[k]; });
    fbDb.collection('jobTickets').doc(ticketId).update(flatPatch).then(function(){
      var needProvision = !(patch.ppd.driveFolderUrl) && ['Art Review','Engineering','File Prep','Proof Ready','Proof Sent','Waiting Approval','Revision Needed','Plate Ready','Release QA','Released'].indexOf(stage)>=0;
      if(needProvision && typeof provisionPPDWorkspace==='function'){
        provisionPPDJobFolders(ticketId).catch(function(e){ console.warn('ppdProvisionFolders', e); });
      }
      closeModal(); toast('PPD job updated','ok'); if(window.MFX&&MFX.track) MFX.track('ppd.job.updated',{ticketId:ticketId,stage:stage});
    }).catch(function(e){ toast(e.message,'err'); });
  };

  window.openPPDApprovalForm=function(ticketId){
    var t=ticketId?PPD.tickets.find(function(x){ return x.id===ticketId; }):null;
    var h='<div class="modal-title">Log Approval</div>'
      +field('Job Ticket','<input id="ppd-a-jt" value="'+esc(t&&t.jtNum||'')+'" placeholder="JT-####">')
      +field('Type','<select id="ppd-a-type"><option>Proof</option><option>Internal QA</option><option>Release</option></select>')
      +field('Version','<input id="ppd-a-version" placeholder="v1 / Rev A">')
      +field('Status','<select id="ppd-a-status"><option>Awaiting Approval</option><option>Approved</option><option>Rejected</option></select>')
      +field('Requested From / Approver','<input id="ppd-a-approver" placeholder="Customer or internal approver">')
      +field('Comments','<textarea id="ppd-a-comments" style="min-height:80px"></textarea>')
      +'<button class="btn btn-pr" style="width:100%" onclick="savePPDApproval('+(ticketId?"'"+ticketId+"'":'')+')">Save Approval</button>'
      +'<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };

  window.savePPDApproval=function(ticketId){
    var payload={
      jobTicketId:ticketId||'',
      jobTicketNum:( $('ppd-a-jt')||{} ).value||'',
      type:( $('ppd-a-type')||{} ).value||'Proof',
      version:( $('ppd-a-version')||{} ).value||'',
      status:( $('ppd-a-status')||{} ).value||'Awaiting Approval',
      approver:( $('ppd-a-approver')||{} ).value||'',
      comments:( $('ppd-a-comments')||{} ).value||'',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      createdBy:getUserName()
    };
    fbDb.collection('approvalRecords').add(payload).then(function(){
      closeModal(); toast('Approval record saved','ok');
      if(ticketId){
        var newStage=(payload.status==='Approved'?'Plate Ready':payload.status==='Rejected'?'Revision Needed':'Waiting Approval');
        var ticket=PPD.tickets.find(function(x){ return x.id===ticketId; });
        var currentStage = ticket && ticket.ppd ? ticket.ppd.stage : 'Intake';
        if(typeof PPD_TRANSITIONS !== 'undefined' && PPD_TRANSITIONS[currentStage] && !PPD_TRANSITIONS[currentStage].includes(newStage)) {
          console.warn('Approval stage transition not in standard flow:', currentStage, '->', newStage, '— skipping auto-advance');
          return;
        }
        fbDb.collection('jobTickets').doc(ticketId).update({
          'ppd.proofStatus': payload.status === 'Approved' ? 'Approved' : (payload.status === 'Rejected' ? 'Rejected' : payload.status),
          'ppd.stage': newStage,
          updatedAt: new Date().toISOString(),
          updatedBy: typeof getUserName==='function'?getUserName():'System'
        });
      }
    }).catch(function(e){ toast(e.message,'err'); });
  };

  window.openPlateIncidentForm=function(jobId){
    var t=jobId?PPD.tickets.find(function(x){ return x.id===jobId; }):null;
    var h='<div class="modal-title">Plate / Tool Incident</div>'
      +field('Date','<input id="ppd-i-date" type="date" value="'+new Date().toISOString().split('T')[0]+'">')
      +field('Client','<input id="ppd-i-client" value="'+esc(t&&t.company||'')+'">')
      +field('Part / Plate #','<input id="ppd-i-part" placeholder="Plate or part number">')
      +field('Job Ticket #','<input id="ppd-i-jt" value="'+esc(t&&t.jtNum||'')+'">')
      +field('Damage Type','<select id="ppd-i-type"><option>Damaged</option><option>Spoilage</option><option>Reburn</option><option>Obsolete Artwork</option><option>Remake</option></select>')
      +field('Cost Impact','<input id="ppd-i-cost" type="number" min="0" step="0.01" placeholder="0.00">')
      +field('Notes','<textarea id="ppd-i-notes" style="min-height:80px"></textarea>')
      +'<button class="btn btn-pr" style="width:100%" onclick="savePlateIncident()">Save Incident</button>'
      +'<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };

  window.savePlateIncident=async function(){
    var incidentNum=await requestServerNumber('plateIncident', function(){ return 'PI'+String(Date.now()).slice(-6); });
    var payload={
      incidentNum:incidentNum,
      incidentDate:( $('ppd-i-date')||{} ).value||new Date().toISOString().split('T')[0],
      client:( $('ppd-i-client')||{} ).value||'',
      partNumber:( $('ppd-i-part')||{} ).value||'',
      jobTicketNum:( $('ppd-i-jt')||{} ).value||'',
      damageType:( $('ppd-i-type')||{} ).value||'Damaged',
      totalCost:parseFloat(( $('ppd-i-cost')||{} ).value||0)||0,
      notes:( $('ppd-i-notes')||{} ).value||'',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      createdBy:getUserName()
    };
    fbDb.collection('plateIncidents').add(payload).then(function(){ closeModal(); toast('Incident logged','ok'); }).catch(function(e){ toast(e.message,'err'); });
  };

  window.detachPPDListeners=function(){_ppdListeners.forEach(function(fn){fn()});_ppdListeners=[];};
})();
