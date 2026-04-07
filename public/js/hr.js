(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
var STORE_KEY = 'mfx-hr-data';
var DEPARTMENTS = ['Leadership','Operations & Support','CRM','Pre-Press Design','Production','QA/SQF','Logistics','Maintenance','Finance','HR'];
var DEPT_COLORS = {Leadership:'#6366f1','Operations & Support':'#0ea5e9',CRM:'#10b981','Pre-Press Design':'#f59e0b',Production:'#ef4444','QA/SQF':'#8b5cf6',Logistics:'#f97316',Maintenance:'#64748b',Finance:'#22d3ee',HR:'#ec4899'};
var STATUS_COLORS = {Active:'#22c55e',Inactive:'#3b82f6','On Leave':'#f59e0b',Terminated:'#ef4444',Onboarding:'#06b6d4',Suspended:'#f97316'};
var TRAINING_ALL = ['Food Safety Policy','GMP','Sanitation','Chemical','Allergen','Food Defense','Food Fraud','Traceability','CAPA','Internal Audit','Environmental Monitoring','HazCom','Fire Safety','New Employee Orientation','Food Safety Culture','Maintenance GMP','LOTO'];
var ROLE_TRAININGS = {
  'CEO':['Food Safety Policy','Food Defense','Food Safety Culture'],
  'COO':['Food Safety Policy','GMP','Food Defense','Traceability','Food Safety Culture','CAPA'],
  'Operations Assistant':['Food Safety Policy','GMP','Food Defense','Traceability'],
  'Production Manager':['Food Safety Policy','GMP','Sanitation','Chemical','Allergen','Food Defense','Traceability','CAPA','Maintenance GMP','LOTO','Fire Safety'],
  'QA Manager':['Food Safety Policy','GMP','Sanitation','Chemical','Allergen','Food Defense','Food Fraud','Traceability','CAPA','Internal Audit','Environmental Monitoring'],
  'Production Operator':['Food Safety Policy','GMP','Sanitation','Chemical','Allergen','Food Defense','Food Fraud','HazCom','Fire Safety','New Employee Orientation'],
  'Logistics Lead':['Food Safety Policy','GMP','Food Defense','Fire Safety'],
  'Maintenance Tech':['Food Safety Policy','GMP','Sanitation','Chemical','Maintenance GMP','LOTO','Fire Safety','HazCom']
};
var SQF_CLAUSES = [
  {clause:'2.1',title:'Management Commitment',status:'In Progress',owner:'Moises Santillan'},
  {clause:'2.2',title:'Document Control',status:'In Progress',owner:'Randy Vazquez'},
  {clause:'2.4',title:'Food Safety / HACCP',status:'In Progress',owner:'Diana Park'},
  {clause:'2.6',title:'Corrective & Preventive Actions',status:'In Progress',owner:'Diana Park'},
  {clause:'2.7',title:'Food Safety Training',status:'In Progress',owner:'Randy Vazquez'},
  {clause:'11.1',title:'GMP - Site Requirements',status:'In Progress',owner:'Alex Martinez'},
  {clause:'11.2',title:'GMP - Personnel Practices',status:'In Progress',owner:'Randy Vazquez'}
];

// ─── SEED DATA ──────────────────────────────────────────────────────────────
function makeSeed(){
  var emps = [
    {id:'MFX-LDR-01',firstName:'Moises',lastName:'Santillan',preferredName:'',email:'moises@mframesinc.com',phone:'(714)555-0101',address:'',department:'Leadership',role:'CEO',type:'Full-Time',shift:'Day',startDate:'2018-01-15',payType:'Salary',payRate:145000,authorityClass:'Executive',sqfRole:true,emergencyContact:{name:'Ana Santillan',phone:'(714)555-0100'},accessZones:['All'],notes:'Founder',status:'Active',onboardingComplete:true,training:{},disciplinary:[]},
    {id:'MFX-LDR-02',firstName:'Randy',lastName:'Vazquez',preferredName:'',email:'randy@mframesinc.com',phone:'(714)555-0102',address:'',department:'Leadership',role:'COO',type:'Full-Time',shift:'Day',startDate:'2018-03-01',payType:'Salary',payRate:120000,authorityClass:'Executive',sqfRole:true,emergencyContact:{name:'Maria Vazquez',phone:'(714)555-0103'},accessZones:['All'],notes:'',status:'Active',onboardingComplete:true,training:{},disciplinary:[]},
    {id:'MFX-OPS-01',firstName:'Jazmin',lastName:'Gonzalez',preferredName:'Jaz',email:'jazmin@mframesinc.com',phone:'(714)555-0104',address:'',department:'Operations & Support',role:'Operations Assistant',type:'Full-Time',shift:'Day',startDate:'2023-06-12',payType:'Hourly',payRate:22.50,authorityClass:'Standard',sqfRole:true,emergencyContact:{name:'Carlos Gonzalez',phone:'(714)555-0105'},accessZones:['Office','Production'],notes:'',status:'Active',onboardingComplete:true,training:{},disciplinary:[]},
    {id:'MFX-PRD-01',firstName:'Alex',lastName:'Martinez',preferredName:'',email:'alex.m@mframesinc.com',phone:'(714)555-0106',address:'',department:'Production',role:'Production Manager',type:'Full-Time',shift:'Day',startDate:'2020-02-10',payType:'Salary',payRate:75000,authorityClass:'Manager',sqfRole:true,emergencyContact:{name:'Rosa Martinez',phone:'(714)555-0107'},accessZones:['Production','Warehouse'],notes:'',status:'Active',onboardingComplete:true,training:{},disciplinary:[]},
    {id:'MFX-QA-01',firstName:'Diana',lastName:'Park',preferredName:'',email:'diana@mframesinc.com',phone:'(714)555-0108',address:'',department:'QA/SQF',role:'QA Manager',type:'Full-Time',shift:'Day',startDate:'2021-08-01',payType:'Salary',payRate:85000,authorityClass:'Manager',sqfRole:true,emergencyContact:{name:'James Park',phone:'(714)555-0109'},accessZones:['QA Lab','Production'],notes:'SQF Practitioner',status:'Active',onboardingComplete:true,training:{},disciplinary:[]},
    {id:'MFX-PRD-02',firstName:'Marco',lastName:'Rodriguez',preferredName:'',email:'marco@mframesinc.com',phone:'(714)555-0110',address:'',department:'Production',role:'Production Operator',type:'Full-Time',shift:'Swing',startDate:'2022-04-18',payType:'Hourly',payRate:19.75,authorityClass:'Standard',sqfRole:false,emergencyContact:{name:'Elena Rodriguez',phone:'(714)555-0111'},accessZones:['Production'],notes:'',status:'Active',onboardingComplete:true,training:{},disciplinary:[{id:'d1',type:'Verbal Warning',date:'2025-11-10',description:'Missed two scheduled shifts without notification.',status:'Closed',issuedBy:'Alex Martinez'}]},
    {id:'MFX-LOG-01',firstName:'Chris',lastName:'Walton',preferredName:'',email:'chris@mframesinc.com',phone:'(714)555-0112',address:'',department:'Logistics',role:'Logistics Lead',type:'Full-Time',shift:'Day',startDate:'2021-01-20',payType:'Salary',payRate:62000,authorityClass:'Lead',sqfRole:false,emergencyContact:{name:'Sara Walton',phone:'(714)555-0113'},accessZones:['Warehouse','Shipping'],notes:'',status:'Active',onboardingComplete:true,training:{},disciplinary:[]},
    {id:'MFX-MNT-01',firstName:'Jake',lastName:'Torres',preferredName:'',email:'jake@mframesinc.com',phone:'(714)555-0114',address:'',department:'Maintenance',role:'Maintenance Tech',type:'Full-Time',shift:'Day',startDate:'2022-09-05',payType:'Hourly',payRate:24,authorityClass:'Standard',sqfRole:false,emergencyContact:{name:'Linda Torres',phone:'(714)555-0115'},accessZones:['All'],notes:'',status:'Active',onboardingComplete:true,training:{},disciplinary:[{id:'d2',type:'Written Warning',date:'2025-08-22',description:'Failed to follow LOTO procedure during conveyor maintenance.',status:'Closed',issuedBy:'Alex Martinez'}]}
  ];
  // Seed training completions (randomized but deterministic)
  emps.forEach(function(e){
    var req = ROLE_TRAININGS[e.role]||[];
    var t = {};
    req.forEach(function(tr,i){
      t[tr] = (i < Math.ceil(req.length*0.7)) ? 'complete' : 'incomplete';
    });
    e.training = t;
  });
  return emps;
}

// ─── STATE ──────────────────────────────────────────────────────────────────
var state = {tab:'dashboard',subTab:'profile',employees:[],selectedId:null,editId:null,search:'',filterDept:'All',filterStatus:'All'};

function loadData(){
  try{
    var raw = sessionStorage.getItem(STORE_KEY);
    if(raw){state.employees=JSON.parse(raw);if(state.employees.length)return;}
  }catch(e){}
  state.employees = makeSeed();
  saveData();
}
function saveData(){sessionStorage.setItem(STORE_KEY,JSON.stringify(state.employees));}
function empName(e){return e.firstName+' '+e.lastName;}
function empInitials(e){return (e.firstName[0]||'')+(e.lastName[0]||'');}
function hueFromId(id){var h=0;for(var i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))%360;return h;}

function statusBadge(s){var c=STATUS_COLORS[s]||'#888';return '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+c+'22;color:'+c+'">'+s+'</span>';}
function deptBadge(d){var c=DEPT_COLORS[d]||'#888';return '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+c+'22;color:'+c+'">'+d+'</span>';}
function sqfBadge(){return '<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:#8b5cf622;color:#8b5cf6">SQF</span>';}
function avatar(e,sz){var h=hueFromId(e.id);sz=sz||32;return '<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:hsl('+h+',55%,45%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:'+(sz*0.38)+'px;flex-shrink:0">'+empInitials(e)+'</div>';}

function trainingPct(e){
  var req=ROLE_TRAININGS[e.role]||[];if(!req.length)return 100;
  var done=0;req.forEach(function(t){if(e.training[t]==='complete')done++;});
  return Math.round(done/req.length*100);
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
var S = {
  wrap:'display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--tx);',
  topBar:'background:var(--bg2);padding:10px 16px;border-bottom:1px solid var(--bdr);display:flex;gap:6px;flex-wrap:wrap;align-items:center;',
  tabBtn:'padding:7px 14px;border-radius:var(--bdr);font-weight:700;font-size:12px;border:none;cursor:pointer;',
  tabAct:'background:var(--ac);color:var(--bg);',
  tabOff:'background:transparent;color:var(--tx2);',
  content:'flex:1;overflow-y:auto;padding:20px;',
  card:'background:var(--bg2);border-radius:var(--bdr);padding:16px;',
  kpi:'background:var(--bg2);border-radius:var(--bdr);padding:14px;text-align:center;',
  th:'padding:8px 10px;text-align:left;color:var(--tx3);text-transform:uppercase;font-size:10px;font-weight:700;border-bottom:1px solid var(--bdr);',
  td:'padding:8px 10px;font-size:13px;border-bottom:1px solid var(--bdr);',
  btn:'padding:7px 14px;border-radius:var(--bdr);font-weight:700;font-size:12px;border:none;cursor:pointer;',
  input:'background:var(--bg);border:1px solid var(--bdr2);border-radius:var(--bdr);padding:8px 10px;color:var(--tx);font-size:13px;width:100%;box-sizing:border-box;',
  label:'display:block;font-size:11px;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;font-weight:600;'
};
function btnStyle(bg,fg){return S.btn+';background:'+bg+';color:'+fg+';';}

// ─── TABS ───────────────────────────────────────────────────────────────────
var TABS = [
  {id:'dashboard',label:'Dashboard'},
  {id:'employees',label:'Employees'},
  {id:'training',label:'SQF Training Matrix'},
  {id:'disciplinary',label:'Disciplinary'},
  {id:'compliance',label:'Compliance'},
  {id:'onboarding',label:'Onboarding'}
];

// ─── RENDER MAIN ────────────────────────────────────────────────────────────
function renderHR(){
  var el=document.getElementById('v-hr');if(!el)return;
  loadData();
  var h='<div style="'+S.wrap+'">';
  // Tab bar
  h+='<div style="'+S.topBar+'">';
  TABS.forEach(function(t){
    var act=state.tab===t.id&&!state.selectedId&&!state.editId;
    h+='<button onclick="window.MFX.HR.setTab(\''+t.id+'\')" style="'+S.tabBtn+(act?S.tabAct:S.tabOff)+'">'+t.label+'</button>';
  });
  h+='</div>';
  h+='<div id="hr-content" style="'+S.content+'"></div>';
  h+='</div>';
  el.innerHTML=h;
  setTimeout(renderContent,0);
}

function renderContent(){
  var c=document.getElementById('hr-content');if(!c)return;
  if(state.editId!==null){renderForm(c);return;}
  if(state.selectedId){renderDetail(c);return;}
  switch(state.tab){
    case 'dashboard':renderDashboard(c);break;
    case 'employees':renderEmployees(c);break;
    case 'training':renderTrainingMatrix(c);break;
    case 'disciplinary':renderDisciplinary(c);break;
    case 'compliance':renderCompliance(c);break;
    case 'onboarding':renderOnboarding(c);break;
  }
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function renderDashboard(c){
  var emps=state.employees;
  var active=emps.filter(function(e){return e.status==='Active';}).length;
  var sqfCrit=emps.filter(function(e){return e.sqfRole;}).length;
  var gaps=0;emps.forEach(function(e){if(trainingPct(e)<100)gaps++;});
  var disc=0;emps.forEach(function(e){e.disciplinary.forEach(function(d){if(d.status==='Open')disc++;});});

  var h='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;">';
  var kpis=[{n:emps.length,l:'Headcount',cl:'var(--ac)'},{n:active,l:'Active',cl:'#22c55e'},{n:sqfCrit,l:'SQF Critical Roles',cl:'#8b5cf6'},{n:gaps,l:'Training Gaps',cl:'#f59e0b'},{n:disc,l:'Open Disciplinary',cl:'#ef4444'}];
  kpis.forEach(function(k){
    h+='<div style="'+S.kpi+'"><div style="font-size:28px;font-weight:800;color:'+k.cl+'">'+k.n+'</div><div style="font-size:11px;color:var(--tx3);margin-top:4px;">'+k.l+'</div></div>';
  });
  h+='</div>';

  // Department bar chart
  h+='<div style="'+S.card+';margin-bottom:20px;"><div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:12px;">Headcount by Department</div>';
  var deptCounts={};DEPARTMENTS.forEach(function(d){deptCounts[d]=0;});
  emps.forEach(function(e){deptCounts[e.department]=(deptCounts[e.department]||0)+1;});
  var maxC=Math.max.apply(null,DEPARTMENTS.map(function(d){return deptCounts[d]||0;}))||1;
  DEPARTMENTS.forEach(function(d){
    var cnt=deptCounts[d]||0;var pct=Math.round(cnt/maxC*100);
    var col=DEPT_COLORS[d]||'var(--ac)';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    h+='<div style="width:140px;font-size:11px;color:var(--tx2);text-align:right;flex-shrink:0;">'+d+'</div>';
    h+='<div style="flex:1;height:18px;background:var(--bg);border-radius:3px;overflow:hidden;">';
    h+='<div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:3px;transition:width .3s;"></div></div>';
    h+='<div style="width:24px;font-size:12px;font-weight:700;color:var(--tx);">'+cnt+'</div></div>';
  });
  h+='</div>';

  // Alerts
  h+='<div style="'+S.card+'"><div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px;">Alerts</div>';
  var alerts=[];
  emps.forEach(function(e){
    var p=trainingPct(e);if(p<100)alerts.push({msg:empName(e)+' training at '+p+'% ('+e.role+')',type:'warn'});
    e.disciplinary.forEach(function(d){if(d.status==='Open')alerts.push({msg:'Open '+d.type+' for '+empName(e),type:'error'});});
    if(!e.onboardingComplete)alerts.push({msg:empName(e)+' onboarding incomplete',type:'info'});
  });
  if(!alerts.length)h+='<div style="color:var(--tx3);font-size:12px;">No active alerts.</div>';
  alerts.slice(0,10).forEach(function(a){
    var ac=a.type==='error'?'#ef4444':a.type==='warn'?'#f59e0b':'var(--ac)';
    h+='<div style="padding:6px 0;font-size:12px;color:'+ac+';border-bottom:1px solid var(--bdr);">'+a.msg+'</div>';
  });
  h+='</div>';
  c.innerHTML=h;
}

// ─── EMPLOYEES TABLE ────────────────────────────────────────────────────────
function renderEmployees(c){
  var h='<div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">';
  h+='<input id="hr-search" placeholder="Search employees..." value="'+state.search+'" oninput="window.MFX.HR.onSearch(this.value)" style="'+S.input+';max-width:240px;">';
  h+='<select id="hr-dept-filter" onchange="window.MFX.HR.onDeptFilter(this.value)" style="'+S.input+';max-width:180px;"><option value="All">All Departments</option>';
  DEPARTMENTS.forEach(function(d){h+='<option value="'+d+'"'+(state.filterDept===d?' selected':'')+'>'+d+'</option>';});
  h+='</select>';
  h+='<select id="hr-status-filter" onchange="window.MFX.HR.onStatusFilter(this.value)" style="'+S.input+';max-width:140px;"><option value="All">All Status</option>';
  ['Active','Inactive','On Leave','Terminated','Onboarding','Suspended'].forEach(function(s){h+='<option value="'+s+'"'+(state.filterStatus===s?' selected':'')+'>'+s+'</option>';});
  h+='</select>';
  h+='<button onclick="window.MFX.HR.addNew()" style="'+btnStyle('var(--ac)','var(--bg)')+'">+ Add Employee</button>';
  h+='</div>';

  var filtered=state.employees.filter(function(e){
    if(state.filterDept!=='All'&&e.department!==state.filterDept)return false;
    if(state.filterStatus!=='All'&&e.status!==state.filterStatus)return false;
    if(state.search){var q=state.search.toLowerCase();if((empName(e)+' '+e.id+' '+e.role+' '+e.department).toLowerCase().indexOf(q)===-1)return false;}
    return true;
  });

  h+='<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
  h+='<thead><tr>';
  ['','Name','ID','Department','Role','Type','SQF','Training','Status'].forEach(function(col){h+='<th style="'+S.th+'">'+col+'</th>';});
  h+='</tr></thead><tbody>';
  filtered.forEach(function(e,i){
    var bg=i%2===0?'transparent':'var(--bg2)';
    var pct=trainingPct(e);var pctColor=pct===100?'#22c55e':pct>=70?'#f59e0b':'#ef4444';
    h+='<tr style="background:'+bg+';cursor:pointer;" onclick="window.MFX.HR.select(\''+e.id+'\')">';
    h+='<td style="'+S.td+'">'+avatar(e,28)+'</td>';
    h+='<td style="'+S.td+';font-weight:600;color:var(--tx);">'+empName(e)+'</td>';
    h+='<td style="'+S.td+';color:var(--tx2);font-size:11px;font-family:monospace;">'+e.id+'</td>';
    h+='<td style="'+S.td+'">'+deptBadge(e.department)+'</td>';
    h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;">'+e.role+'</td>';
    h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;">'+e.type+'</td>';
    h+='<td style="'+S.td+'">'+(e.sqfRole?sqfBadge():'')+'</td>';
    h+='<td style="'+S.td+';font-weight:700;color:'+pctColor+';font-size:12px;">'+pct+'%</td>';
    h+='<td style="'+S.td+'">'+statusBadge(e.status)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  c.innerHTML=h;
}

// ─── EMPLOYEE DETAIL ────────────────────────────────────────────────────────
function renderDetail(c){
  var e=state.employees.find(function(x){return x.id===state.selectedId;});
  if(!e){state.selectedId=null;renderContent();return;}
  var h='<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">';
  h+='<button onclick="window.MFX.HR.back()" style="'+btnStyle('var(--bg2)','var(--tx)')+'">Back</button>';
  h+=avatar(e,48);
  h+='<div><div style="font-size:18px;font-weight:700;color:var(--tx);">'+empName(e)+'</div>';
  h+='<div style="font-size:12px;color:var(--tx2);">'+e.role+' | '+e.department+' | '+e.id+'</div></div>';
  h+='<div style="margin-left:auto;display:flex;gap:8px;">';
  h+=statusBadge(e.status);
  if(e.sqfRole)h+=' '+sqfBadge();
  h+='</div>';
  h+='<button onclick="window.MFX.HR.editEmp(\''+e.id+'\')" style="'+btnStyle('var(--ac)','var(--bg)')+'">Edit</button>';
  h+='</div>';

  // Sub-tabs
  var subs=['profile','training','disciplinary','attendance','payroll','onboarding'];
  h+='<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--bdr);padding-bottom:8px;">';
  subs.forEach(function(s){
    var act=state.subTab===s;
    h+='<button onclick="window.MFX.HR.subTab(\''+s+'\')" style="'+S.tabBtn+(act?'background:var(--ac);color:var(--bg);':'background:transparent;color:var(--tx2);')+'font-size:11px;padding:5px 10px;">'+s.charAt(0).toUpperCase()+s.slice(1)+'</button>';
  });
  h+='</div>';

  // Sub-tab content
  switch(state.subTab){
    case 'profile':h+=detailProfile(e);break;
    case 'training':h+=detailTraining(e);break;
    case 'disciplinary':h+=detailDisciplinary(e);break;
    case 'attendance':h+=detailAttendance(e);break;
    case 'payroll':h+=detailPayroll(e);break;
    case 'onboarding':h+=detailOnboarding(e);break;
  }
  c.innerHTML=h;
}

function detailProfile(e){
  var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';
  h+='<div style="'+S.card+'">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Personal</div>';
  var fields=[['First Name',e.firstName],['Last Name',e.lastName],['Preferred Name',e.preferredName||'-'],['Email',e.email],['Phone',e.phone],['Address',e.address||'-']];
  fields.forEach(function(f){h+='<div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--tx3);">'+f[0]+':</span> <span style="color:var(--tx);font-size:13px;">'+f[1]+'</span></div>';});
  h+='</div>';
  h+='<div style="'+S.card+'">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Employment</div>';
  var f2=[['Department',e.department],['Role',e.role],['Type',e.type],['Shift',e.shift||'-'],['Start Date',e.startDate],['Authority Class',e.authorityClass||'-'],['SQF Role',e.sqfRole?'Yes':'No'],['Access Zones',(e.accessZones||[]).join(', ')||'-']];
  f2.forEach(function(f){h+='<div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--tx3);">'+f[0]+':</span> <span style="color:var(--tx);font-size:13px;">'+f[1]+'</span></div>';});
  h+='</div>';
  h+='<div style="'+S.card+'">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Emergency Contact</div>';
  var ec=e.emergencyContact||{name:'-',phone:'-'};
  h+='<div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--tx3);">Name:</span> <span style="color:var(--tx);font-size:13px;">'+ec.name+'</span></div>';
  h+='<div><span style="font-size:11px;color:var(--tx3);">Phone:</span> <span style="color:var(--tx);font-size:13px;">'+ec.phone+'</span></div>';
  h+='</div>';
  h+='<div style="'+S.card+'">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Notes</div>';
  h+='<div style="color:var(--tx);font-size:13px;">'+(e.notes||'None')+'</div>';
  h+='</div></div>';
  return h;
}

function detailTraining(e){
  var req=ROLE_TRAININGS[e.role]||[];
  var h='<div style="'+S.card+'">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Training Progress: '+trainingPct(e)+'%</div>';
  if(!req.length){h+='<div style="color:var(--tx3);font-size:12px;">No required trainings for this role.</div>';}
  else{
    h+='<table style="width:100%;border-collapse:collapse;">';
    h+='<thead><tr><th style="'+S.th+'">Training</th><th style="'+S.th+'">Status</th><th style="'+S.th+'">Action</th></tr></thead><tbody>';
    req.forEach(function(t,i){
      var done=e.training[t]==='complete';
      var bg=i%2===0?'transparent':'var(--bg2)';
      h+='<tr style="background:'+bg+'">';
      h+='<td style="'+S.td+';color:var(--tx);">'+t+'</td>';
      h+='<td style="'+S.td+'">'+(done?'<span style="color:#22c55e;font-weight:700;font-size:12px;">Complete</span>':'<span style="color:#ef4444;font-weight:700;font-size:12px;">Incomplete</span>')+'</td>';
      h+='<td style="'+S.td+'"><button onclick="window.MFX.HR.toggleTraining(\''+e.id+'\',\''+t+'\')" style="'+btnStyle(done?'var(--bg2)':'#22c55e',done?'var(--tx)':'#fff')+'font-size:10px;padding:3px 8px;">'+(done?'Mark Incomplete':'Mark Complete')+'</button></td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
  }
  h+='</div>';return h;
}

function detailDisciplinary(e){
  var h='<div style="'+S.card+'">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;">Disciplinary Records</div>';
  h+='<button onclick="window.MFX.HR.addDisc(\''+e.id+'\')" style="'+btnStyle('var(--ac)','var(--bg)')+'font-size:11px;padding:4px 10px;">+ Add</button></div>';
  if(!e.disciplinary.length)h+='<div style="color:var(--tx3);font-size:12px;">No disciplinary records.</div>';
  else{
    e.disciplinary.forEach(function(d){
      var tc=d.type==='Verbal Warning'?'#f59e0b':d.type==='Written Warning'?'#f97316':'#ef4444';
      var sc=d.status==='Open'?'#ef4444':'#22c55e';
      h+='<div style="padding:10px;border:1px solid var(--bdr);border-radius:var(--bdr);margin-bottom:8px;">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;">';
      h+='<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+tc+'22;color:'+tc+'">'+d.type+'</span>';
      h+='<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+sc+'22;color:'+sc+'">'+d.status+'</span></div>';
      h+='<div style="margin-top:6px;font-size:12px;color:var(--tx);">'+d.description+'</div>';
      h+='<div style="margin-top:4px;font-size:11px;color:var(--tx3);">'+d.date+' | Issued by: '+d.issuedBy+'</div>';
      h+='</div>';
    });
  }
  h+='</div>';return h;
}

function detailAttendance(e){
  return '<div style="'+S.card+'"><div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Attendance</div><div style="color:var(--tx3);font-size:12px;">Attendance tracking data will appear here when integrated with time clock system.</div></div>';
}
function detailPayroll(e){
  var h='<div style="'+S.card+'">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:10px;">Payroll Information</div>';
  h+='<div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--tx3);">Pay Type:</span> <span style="color:var(--tx);font-size:13px;">'+e.payType+'</span></div>';
  h+='<div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--tx3);">Rate:</span> <span style="color:var(--tx);font-size:13px;">'+(e.payType==='Salary'?'$'+e.payRate.toLocaleString()+'/yr':'$'+e.payRate.toFixed(2)+'/hr')+'</span></div>';
  h+='</div>';return h;
}
function detailOnboarding(e){
  var h='<div style="'+S.card+'">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;">Onboarding</div>';
  h+='<button onclick="window.MFX.HR.toggleOnboard(\''+e.id+'\')" style="'+btnStyle(e.onboardingComplete?'var(--bg2)':'#22c55e',e.onboardingComplete?'var(--tx)':'#fff')+'font-size:11px;padding:4px 10px;">'+(e.onboardingComplete?'Mark Incomplete':'Mark Complete')+'</button></div>';
  h+='<div style="color:var(--tx);font-size:13px;">Status: '+(e.onboardingComplete?'<span style="color:#22c55e;font-weight:700;">Complete</span>':'<span style="color:#f59e0b;font-weight:700;">In Progress</span>')+'</div>';
  h+='</div>';return h;
}

// ─── ADD/EDIT FORM ──────────────────────────────────────────────────────────
function renderForm(c){
  var isNew=state.editId==='new';
  var e=isNew?{id:'',firstName:'',lastName:'',preferredName:'',email:'',phone:'',address:'',department:DEPARTMENTS[0],role:'',type:'Full-Time',shift:'Day',startDate:'',payType:'Hourly',payRate:0,authorityClass:'Standard',sqfRole:false,emergencyContact:{name:'',phone:''},accessZones:[],notes:'',status:'Active',onboardingComplete:false,training:{},disciplinary:[]}:state.employees.find(function(x){return x.id===state.editId;});
  if(!e){state.editId=null;renderContent();return;}

  var h='<div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">';
  h+='<button onclick="window.MFX.HR.cancelEdit()" style="'+btnStyle('var(--bg2)','var(--tx)')+'">Cancel</button>';
  h+='<span style="font-size:16px;font-weight:700;color:var(--tx);">'+(isNew?'Add Employee':'Edit: '+empName(e))+'</span></div>';

  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">';
  function field(lbl,id,val,type){
    type=type||'text';
    h+='<div><label style="'+S.label+'">'+lbl+'</label><input id="hrf-'+id+'" type="'+type+'" value="'+(val||'')+'" style="'+S.input+'"></div>';
  }
  field('First Name','firstName',e.firstName);
  field('Last Name','lastName',e.lastName);
  field('Preferred Name','preferredName',e.preferredName);
  field('Email','email',e.email,'email');
  field('Phone','phone',e.phone);
  field('Address','address',e.address);

  // Department select
  h+='<div><label style="'+S.label+'">Department</label><select id="hrf-department" style="'+S.input+'">';
  DEPARTMENTS.forEach(function(d){h+='<option value="'+d+'"'+(e.department===d?' selected':'')+'>'+d+'</option>';});
  h+='</select></div>';

  field('Role','role',e.role);

  h+='<div><label style="'+S.label+'">Type</label><select id="hrf-type" style="'+S.input+'">';
  ['Full-Time','Part-Time','Contractor','Seasonal'].forEach(function(t){h+='<option'+(e.type===t?' selected':'')+'>'+t+'</option>';});
  h+='</select></div>';

  h+='<div><label style="'+S.label+'">Shift</label><select id="hrf-shift" style="'+S.input+'">';
  ['Day','Swing','Night'].forEach(function(s){h+='<option'+(e.shift===s?' selected':'')+'>'+s+'</option>';});
  h+='</select></div>';

  field('Start Date','startDate',e.startDate,'date');

  h+='<div><label style="'+S.label+'">Pay Type</label><select id="hrf-payType" style="'+S.input+'">';
  ['Hourly','Salary'].forEach(function(p){h+='<option'+(e.payType===p?' selected':'')+'>'+p+'</option>';});
  h+='</select></div>';

  field('Pay Rate','payRate',e.payRate,'number');

  h+='<div><label style="'+S.label+'">Authority Class</label><select id="hrf-authorityClass" style="'+S.input+'">';
  ['Standard','Lead','Manager','Executive'].forEach(function(a){h+='<option'+(e.authorityClass===a?' selected':'')+'>'+a+'</option>';});
  h+='</select></div>';

  h+='<div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><input type="checkbox" id="hrf-sqfRole"'+(e.sqfRole?' checked':'')+'><label for="hrf-sqfRole" style="color:var(--tx);font-size:13px;">SQF Critical Role</label></div>';

  field('Emergency Name','ecName',(e.emergencyContact||{}).name);
  field('Emergency Phone','ecPhone',(e.emergencyContact||{}).phone);
  field('Access Zones (comma sep)','accessZones',(e.accessZones||[]).join(', '));

  h+='</div>';
  h+='<div style="margin-top:12px;"><label style="'+S.label+'">Notes</label><textarea id="hrf-notes" style="'+S.input+';height:60px;resize:vertical;">'+(e.notes||'')+'</textarea></div>';

  h+='<div style="margin-top:16px;display:flex;gap:10px;">';
  h+='<button onclick="window.MFX.HR.saveForm()" style="'+btnStyle('#22c55e','#fff')+'">Save</button>';
  h+='<button onclick="window.MFX.HR.cancelEdit()" style="'+btnStyle('var(--bg2)','var(--tx)')+'">Cancel</button>';
  if(!isNew)h+='<button onclick="window.MFX.HR.toggleStatus(\''+e.id+'\')" style="'+btnStyle(e.status==='Active'?'#ef4444':'#22c55e','#fff')+'">'+(e.status==='Active'?'Deactivate':'Activate')+'</button>';
  h+='</div>';
  c.innerHTML=h;
}

// ─── TRAINING MATRIX ────────────────────────────────────────────────────────
function renderTrainingMatrix(c){
  var sqfEmps=state.employees.filter(function(e){return e.sqfRole||ROLE_TRAININGS[e.role];});
  var allTrainings=[];
  var seen={};
  sqfEmps.forEach(function(e){(ROLE_TRAININGS[e.role]||[]).forEach(function(t){if(!seen[t]){seen[t]=true;allTrainings.push(t);}});});
  if(!allTrainings.length){allTrainings=TRAINING_ALL;}

  var h='<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">';
  h+='<thead><tr><th style="'+S.th+';position:sticky;left:0;background:var(--bg);z-index:1;">Employee</th>';
  allTrainings.forEach(function(t){
    var short=t.replace(/Food Safety /g,'FS ').replace(/ /g,'<br>');
    h+='<th style="'+S.th+';text-align:center;min-width:40px;font-size:9px;">'+short+'</th>';
  });
  h+='<th style="'+S.th+';text-align:center;">%</th></tr></thead><tbody>';

  sqfEmps.forEach(function(e,i){
    var req=ROLE_TRAININGS[e.role]||[];
    var bg=i%2===0?'transparent':'var(--bg2)';
    h+='<tr style="background:'+bg+'">';
    h+='<td style="'+S.td+';font-weight:600;color:var(--tx);position:sticky;left:0;background:'+bg+';z-index:1;">'+empName(e)+'</td>';
    allTrainings.forEach(function(t){
      var isReq=req.indexOf(t)!==-1;
      var done=e.training[t]==='complete';
      var cell='';
      if(isReq&&done)cell='<span style="color:#22c55e;font-weight:900;font-size:14px;">&#10003;</span>';
      else if(isReq&&!done)cell='<span style="color:#ef4444;font-weight:900;font-size:14px;">!</span>';
      else cell='<span style="color:var(--tx3);font-size:8px;">&#9679;</span>';
      h+='<td style="'+S.td+';text-align:center;">'+cell+'</td>';
    });
    var pct=trainingPct(e);var pc=pct===100?'#22c55e':pct>=70?'#f59e0b':'#ef4444';
    h+='<td style="'+S.td+';text-align:center;font-weight:700;color:'+pc+'">'+pct+'%</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="margin-top:12px;font-size:11px;color:var(--tx3);display:flex;gap:16px;">';
  h+='<span><span style="color:#22c55e;font-weight:900;">&#10003;</span> Complete</span>';
  h+='<span><span style="color:#ef4444;font-weight:900;">!</span> Required / Incomplete</span>';
  h+='<span><span style="color:var(--tx3);font-size:8px;">&#9679;</span> Not Required</span></div>';
  c.innerHTML=h;
}

// ─── DISCIPLINARY (ALL) ─────────────────────────────────────────────────────
function renderDisciplinary(c){
  var all=[];
  state.employees.forEach(function(e){
    e.disciplinary.forEach(function(d){
      all.push({emp:empName(e),empId:e.id,type:d.type,date:d.date,desc:d.description,status:d.status,by:d.issuedBy});
    });
  });
  all.sort(function(a,b){return b.date.localeCompare(a.date);});

  var h='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:14px;">All Disciplinary Records ('+all.length+')</div>';
  if(!all.length)h+='<div style="color:var(--tx3);font-size:12px;">No records.</div>';
  else{
    h+='<table style="width:100%;border-collapse:collapse;">';
    h+='<thead><tr>';
    ['Type','Date','Employee','Description','Status','Issued By'].forEach(function(col){h+='<th style="'+S.th+'">'+col+'</th>';});
    h+='</tr></thead><tbody>';
    all.forEach(function(d,i){
      var bg=i%2===0?'transparent':'var(--bg2)';
      var tc=d.type==='Verbal Warning'?'#f59e0b':d.type==='Written Warning'?'#f97316':'#ef4444';
      var sc=d.status==='Open'?'#ef4444':'#22c55e';
      h+='<tr style="background:'+bg+'">';
      h+='<td style="'+S.td+'"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+tc+'22;color:'+tc+'">'+d.type+'</span></td>';
      h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;">'+d.date+'</td>';
      h+='<td style="'+S.td+';color:var(--tx);font-weight:600;cursor:pointer;" onclick="window.MFX.HR.select(\''+d.empId+'\')">'+d.emp+'</td>';
      h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;max-width:300px;">'+d.desc+'</td>';
      h+='<td style="'+S.td+'"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+sc+'22;color:'+sc+'">'+d.status+'</span></td>';
      h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;">'+d.by+'</td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
  }
  c.innerHTML=h;
}

// ─── COMPLIANCE ─────────────────────────────────────────────────────────────
function renderCompliance(c){
  var h='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:14px;">SQF Edition 10 Compliance Status</div>';
  h+='<table style="width:100%;border-collapse:collapse;">';
  h+='<thead><tr>';
  ['Clause','Title','Status','Owner'].forEach(function(col){h+='<th style="'+S.th+'">'+col+'</th>';});
  h+='</tr></thead><tbody>';
  SQF_CLAUSES.forEach(function(cl,i){
    var bg=i%2===0?'transparent':'var(--bg2)';
    var sc=cl.status==='Complete'?'#22c55e':cl.status==='In Progress'?'#f59e0b':'#ef4444';
    h+='<tr style="background:'+bg+'">';
    h+='<td style="'+S.td+';font-weight:700;color:var(--ac);font-family:monospace;">'+cl.clause+'</td>';
    h+='<td style="'+S.td+';color:var(--tx);">'+cl.title+'</td>';
    h+='<td style="'+S.td+'"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:'+sc+'22;color:'+sc+'">'+cl.status+'</span></td>';
    h+='<td style="'+S.td+';color:var(--tx2);">'+cl.owner+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  c.innerHTML=h;
}

// ─── ONBOARDING ─────────────────────────────────────────────────────────────
function renderOnboarding(c){
  var pending=state.employees.filter(function(e){return !e.onboardingComplete;});
  var h='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:14px;">Onboarding In Progress ('+pending.length+')</div>';
  if(!pending.length)h+='<div style="color:var(--tx3);font-size:12px;">All employees have completed onboarding.</div>';
  else{
    h+='<table style="width:100%;border-collapse:collapse;">';
    h+='<thead><tr>';
    ['','Name','Department','Role','Start Date','Status'].forEach(function(col){h+='<th style="'+S.th+'">'+col+'</th>';});
    h+='</tr></thead><tbody>';
    pending.forEach(function(e,i){
      var bg=i%2===0?'transparent':'var(--bg2)';
      h+='<tr style="background:'+bg+';cursor:pointer;" onclick="window.MFX.HR.select(\''+e.id+'\')">';
      h+='<td style="'+S.td+'">'+avatar(e,26)+'</td>';
      h+='<td style="'+S.td+';font-weight:600;color:var(--tx);">'+empName(e)+'</td>';
      h+='<td style="'+S.td+'">'+deptBadge(e.department)+'</td>';
      h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;">'+e.role+'</td>';
      h+='<td style="'+S.td+';color:var(--tx2);font-size:12px;">'+e.startDate+'</td>';
      h+='<td style="'+S.td+'"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#f59e0b22;color:#f59e0b;">In Progress</span></td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
  }
  c.innerHTML=h;
}

// ─── ACTIONS ────────────────────────────────────────────────────────────────
function setTab(t){state.tab=t;state.selectedId=null;state.editId=null;state.subTab='profile';renderHR();}
function selectEmp(id){state.selectedId=id;state.editId=null;state.subTab='profile';renderHR();}
function goBack(){state.selectedId=null;state.editId=null;renderHR();}
function editEmp(id){state.editId=id;renderHR();}
function addNew(){state.editId='new';renderHR();}
function cancelEdit(){state.editId=null;renderHR();}
function setSubTab(s){state.subTab=s;renderContent();}

function saveForm(){
  var isNew=state.editId==='new';
  var gv=function(id){var el=document.getElementById('hrf-'+id);return el?el.value:'';};
  var gc=function(id){var el=document.getElementById('hrf-'+id);return el?el.checked:false;};

  var firstName=gv('firstName').trim();var lastName=gv('lastName').trim();
  if(!firstName||!lastName){if(typeof toast==='function')toast('First and last name required','error');return;}

  var obj={
    firstName:firstName,lastName:lastName,preferredName:gv('preferredName'),
    email:gv('email'),phone:gv('phone'),address:gv('address'),
    department:gv('department'),role:gv('role'),type:gv('type'),
    shift:gv('shift'),startDate:gv('startDate'),
    payType:gv('payType'),payRate:parseFloat(gv('payRate'))||0,
    authorityClass:gv('authorityClass'),sqfRole:gc('sqfRole'),
    emergencyContact:{name:gv('ecName'),phone:gv('ecPhone')},
    accessZones:gv('accessZones').split(',').map(function(s){return s.trim();}).filter(Boolean),
    notes:document.getElementById('hrf-notes')?document.getElementById('hrf-notes').value:''
  };

  if(isNew){
    var prefix='MFX-'+obj.department.substring(0,3).toUpperCase()+'-';
    var max=0;state.employees.forEach(function(e){if(e.id.indexOf(prefix)===0){var n=parseInt(e.id.split('-').pop(),10);if(n>max)max=n;}});
    obj.id=prefix+String(max+1).padStart(2,'0');
    obj.status='Onboarding';obj.onboardingComplete=false;obj.training={};obj.disciplinary=[];
    state.employees.push(obj);
  }else{
    var idx=state.employees.findIndex(function(e){return e.id===state.editId;});
    if(idx===-1)return;
    Object.keys(obj).forEach(function(k){state.employees[idx][k]=obj[k];});
  }
  saveData();
  state.editId=null;
  if(isNew)state.selectedId=obj.id;
  renderHR();
  if(typeof toast==='function')toast('Employee saved','success');
}

function toggleStatus(id){
  var e=state.employees.find(function(x){return x.id===id;});
  if(!e)return;
  e.status=e.status==='Active'?'Inactive':'Active';
  saveData();renderHR();
}

function toggleTraining(empId,training){
  var e=state.employees.find(function(x){return x.id===empId;});
  if(!e)return;
  if(!e.training)e.training={};
  e.training[training]=e.training[training]==='complete'?'incomplete':'complete';
  saveData();renderContent();
}

function toggleOnboard(id){
  var e=state.employees.find(function(x){return x.id===id;});
  if(!e)return;
  e.onboardingComplete=!e.onboardingComplete;
  saveData();renderContent();
}

function addDisc(empId){
  var desc=prompt('Describe the incident:');if(!desc)return;
  var type=prompt('Type (Verbal Warning / Written Warning / Suspension):');if(!type)return;
  var e=state.employees.find(function(x){return x.id===empId;});if(!e)return;
  e.disciplinary.push({id:'d'+Date.now(),type:type,date:new Date().toISOString().split('T')[0],description:desc,status:'Open',issuedBy:'Admin'});
  saveData();renderContent();
}

function onSearch(v){state.search=v;var c=document.getElementById('hr-content');if(c)renderEmployees(c);}
function onDeptFilter(v){state.filterDept=v;var c=document.getElementById('hr-content');if(c)renderEmployees(c);}
function onStatusFilter(v){state.filterStatus=v;var c=document.getElementById('hr-content');if(c)renderEmployees(c);}

// ─── REGISTER ───────────────────────────────────────────────────────────────
window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
window.MFX_VIEW_RENDERERS.hr = renderHR;

window.MFX = window.MFX || {};
window.MFX.HR = {
  setTab:setTab,select:selectEmp,back:goBack,editEmp:editEmp,addNew:addNew,
  cancelEdit:cancelEdit,saveForm:saveForm,subTab:setSubTab,
  toggleStatus:toggleStatus,toggleTraining:toggleTraining,toggleOnboard:toggleOnboard,
  addDisc:addDisc,onSearch:onSearch,onDeptFilter:onDeptFilter,onStatusFilter:onStatusFilter,
  init:function(){loadData();renderHR();}
};

})();
