// ══════════════════════════════════════════════════════════════════
// MFX OS — VENDOR PROFILE & PO SYSTEM v2.0
// Next-level: Rich profiles, communications, AI scoring, calendar,
// 3-way match, SQF qualification, lot traceability, cost→pricing bridge
//
// Collections: vendorPOs, vendors, materials, vendorInvoices,
//              vendorComms, vendorCerts, activity, threads, jobTickets
//
// INSTALL (4 lines in index.html):
// 1. <script src="js/vendor-profile.js"></script>  (after vendor-pos.js)
// 2. <div id="v-vendorprofile" class="view"></div>
// 3. Hamburger: onclick="goView('vendorprofile')"  label "Vendor Hub"
// 4. Tab: <div class="tab" onclick="goView('vendorprofile')">Vendors</div>
// ══════════════════════════════════════════════════════════════════

(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ─── CROSS-MODULE CACHE ACCESSORS ────────────────────────────────
// vendor-pos.js exports caches via Object.defineProperty on window.
// Use accessor functions so we always get the latest snapshot.
function getVpoCache() { return window._vpoCache || []; }
function getVendorCache() { return window._vendorCache || []; }
function getMaterialCache() { return window._materialCache || []; }

// ─── STATE ────────────────────────────────────────────────────────
var VPR={
  view:'hub',           // hub | profile | scorecard | sqf | materials | calendar | reports | inbox
  vendorId:null,
  profileTab:'overview',// overview | orders | comms | docs | scorecard | contacts | calendar | invoices
  search:'',
  filterStatus:'all',
  aiLoading:false,
  calEvents:[],
  calMonth:new Date().getMonth(),
  calYear:new Date().getFullYear()
};

// ─── EXTENDED VENDOR SCHEMA ───────────────────────────────────────
// Extends the vendors collection with full SQF + AP fields

var VENDOR_CATEGORIES=['Substrate Supplier','Ink Supplier','Plate Maker','Equipment','Laminate Supplier','Packaging','Die Maker','Services','Other'];
var PAYMENT_METHODS=['ACH','Wire','Check','Credit Card','Net Terms'];
var SQF_STATUSES=['Approved','Conditional','Probation','Disqualified','New - Pending Review'];
var APPROVAL_TIERS=[
  {label:'Under $500',max:500,approver:'Self-Approve',code:null},
  {label:'$500–$2,500',max:2500,approver:'Manager',code:'mgr'},
  {label:'Over $2,500',max:Infinity,approver:'CEO',code:'ceo'}
];

// ─── UTILS ────────────────────────────────────────────────────────
// fmt$, fmtDate, fmtDT, daysUntil, daysAgo — local definitions (IIFE-scoped)
function fmt$(n){return'$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtDate(d){if(!d)return'\u2014';var dt=new Date(d);return isNaN(dt)?d:dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}
function fmtDT(d){if(!d)return'\u2014';var dt=new Date(d);return isNaN(dt)?d:dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
function daysUntil(d){if(!d)return null;return Math.round((new Date(d)-new Date())/(1000*60*60*24))}
function daysAgo(d){if(!d)return null;return Math.round((new Date()-new Date(d))/(1000*60*60*24))}
var MFX_ADDR={name:'Microflex Film Corporation',addr:'4130 Garner Rd, Riverside, CA 92501',phone:'(909) 360-9066',email:'Quotes@MicroflexFilm.com'};
function gv(id){var el=document.getElementById(id);return el?el.value.trim():''}
function gf(id){var el=document.getElementById(id);return el?parseFloat(el.value)||0:0}
function gb(id){var el=document.getElementById(id);return el?el.checked:false}

function vendorGet(id){return(window._vendorCache||[]).find(function(v){return v.id===id})}
function vendorSave(v){v.updatedAt=new Date().toISOString();if(typeof fbDb==='undefined')return Promise.reject(new Error('fbDb not available'));return fbDb.collection('vendors').doc(v.id).set(v,{merge:true})}
function vposByVendor(vendorId){
  var v=vendorGet(vendorId);if(!v)return[];
  return(getVpoCache()).filter(function(p){return p.vendorName===v.name||p.vendorId===vendorId});
}

// ─── VENDOR SCORECARD CALCULATION ─────────────────────────────────
function calcVendorScore(vendor){
  var pos=vposByVendor(vendor.id);
  var score={overall:100,delivery:100,quality:100,pricing:100,responsiveness:100,details:{}};
  if(!pos.length)return score;

  // Delivery: on-time percentage
  var dp=vendor.deliveryPerformance||{onTimeCount:0,lateCount:0,avgDaysLate:0};
  var total=dp.onTimeCount+dp.lateCount;
  if(total>0){
    var onTimePct=dp.onTimeCount/total;
    score.delivery=Math.round(onTimePct*100);
    score.details.deliveryPct=score.delivery;
    score.details.avgDaysLate=dp.avgDaysLate||0;
  }

  // Quality: rejection rate from QC logs linked to this vendor's materials
  var rejections=vendor.qualityRejections||0;
  var deliveries=total||1;
  var rejectionRate=rejections/deliveries;
  score.quality=Math.max(0,Math.round((1-rejectionRate)*100));
  score.details.rejections=rejections;

  // Pricing: invoice accuracy (actual vs PO amount)
  var invoiceVariances=vendor.invoiceVariances||[];
  if(invoiceVariances.length){
    var avgVar=invoiceVariances.reduce(function(s,v){return s+Math.abs(v)},0)/invoiceVariances.length;
    score.pricing=Math.max(0,Math.round(100-avgVar*100));
  }

  // Responsiveness: avg days to confirm PO
  var confirmTimes=vendor.confirmationTimes||[];
  if(confirmTimes.length){
    var avgDays=confirmTimes.reduce(function(s,d){return s+d},0)/confirmTimes.length;
    score.responsiveness=Math.max(0,Math.round(100-avgDays*8)); // 8pts per day avg
  }

  // Overall weighted average
  score.overall=Math.round(score.delivery*0.35+score.quality*0.30+score.pricing*0.20+score.responsiveness*0.15);
  return score;
}

function scoreColor(s){return s>=85?'var(--gn)':s>=65?'var(--or)':'var(--rd)'}
function scoreGrade(s){return s>=90?'A':s>=80?'B':s>=70?'C':s>=60?'D':'F'}

// ─── APPROVAL TIER LOGIC ─────────────────────────────────────────
function getApprovalTier(amount){
  for(var i=0;i<APPROVAL_TIERS.length;i++){
    if(amount<=APPROVAL_TIERS[i].max)return APPROVAL_TIERS[i];
  }
  return APPROVAL_TIERS[APPROVAL_TIERS.length-1];
}

// ─── MAIN VIEW RENDERER ───────────────────────────────────────────
function renderVendorProfile(){
  var el=document.getElementById('v-vendorprofile');if(!el)return;
  var h='';

  if(VPR.view==='hub')h=vprHub();
  else if(VPR.view==='profile'&&VPR.vendorId)h=vprProfile();
  else if(VPR.view==='sqf')h=vprSQF();
  else if(VPR.view==='materials')h=vprMaterials();
  else if(VPR.view==='calendar')h=vprCalendar();
  else if(VPR.view==='reports')h=vprReports();
  else if(VPR.view==='inbox')h=vprInbox();
  else h=vprHub();

  el.innerHTML=h;
  if(VPR.view==='calendar')vprLoadCalendarEvents();
}

// ─── HUB VIEW ─────────────────────────────────────────────────────
function vprHub(){
  var vendors=getVendorCache();
  var pos=getVpoCache();
  var pending=pos.filter(function(p){return p.status==='pending_approval'});
  var overdueETA=pos.filter(function(p){return p.status==='sent'&&p.eta&&daysUntil(p.eta)<0});
  var lowStock=(getMaterialCache()).filter(function(m){return m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint});
  var expiringSoon=vendors.filter(function(v){
    if(!v.sqfCertExpiry)return false;
    return daysUntil(v.sqfCertExpiry)<=30&&daysUntil(v.sqfCertExpiry)>0;
  });
  var expired=vendors.filter(function(v){return v.sqfCertExpiry&&daysUntil(v.sqfCertExpiry)<0&&v.sqfStatus==='Approved'});

  var h='';

  // Nav bar
  h+='<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">';
  var navs=[{k:'hub',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Hub'},{k:'sqf',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SQF'},{k:'materials',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Materials'},{k:'calendar',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Calendar'},{k:'reports',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> Reports'},{k:'inbox',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Comms'}];
  navs.forEach(function(n){
    h+='<button class="btn btn-xs '+(VPR.view===n.k?'btn-pr':'btn-ghost')+'" onclick="VPR.view=\''+n.k+'\';renderVendorProfile()">'+n.l+'</button>';
  });
  h+='<div style="flex:1"></div>';
  h+='<button class="btn btn-pr btn-xs" onclick="vprOpenNewVendor()">+ Vendor</button>';
  h+='</div>';

  // Alert bar
  if(pending.length||overdueETA.length||lowStock.length||expiringSoon.length||expired.length){
    h+='<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:10px;margin-bottom:12px">';
    h+='<div style="font-size:9px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ATTENTION NEEDED</div>';
    if(pending.length)h+='<div style="font-size:11px;color:var(--or);padding:2px 0;cursor:pointer" onclick="VPR.view=\'hub\';renderVendorProfile()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> '+pending.length+' PO'+(pending.length>1?'s':'')+' awaiting approval</div>';
    if(overdueETA.length)h+='<div style="font-size:11px;color:var(--rd);padding:2px 0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> '+overdueETA.length+' overdue material ETA'+(overdueETA.length>1?'s':'')+'</div>';
    if(lowStock.length)h+='<div style="font-size:11px;color:var(--or);padding:2px 0;cursor:pointer" onclick="VPR.view=\'materials\';renderVendorProfile()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> '+lowStock.length+' material'+(lowStock.length>1?'s':'')+' below reorder point</div>';
    if(expired.length)h+='<div style="font-size:11px;color:var(--rd);padding:2px 0;cursor:pointer" onclick="VPR.view=\'sqf\';renderVendorProfile()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> '+expired.length+' vendor cert'+(expired.length>1?'s':'')+' EXPIRED</div>';
    if(expiringSoon.length)h+='<div style="font-size:11px;color:var(--or);padding:2px 0;cursor:pointer" onclick="VPR.view=\'sqf\';renderVendorProfile()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> '+expiringSoon.length+' cert'+(expiringSoon.length>1?'s':'')+' expiring within 30 days</div>';
    h+='</div>';
  }

  // KPI row
  var totalSpend=pos.filter(function(p){return p.status==='paid'||p.status==='received'}).reduce(function(s,p){return s+(p.total||0)},0);
  var approvedVendors=vendors.filter(function(v){return v.sqfStatus==='Approved'}).length;
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  function kpi(ico,l,v,sub,c,onclick){return'<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:10px;'+(onclick?'cursor:pointer':'')+';" '+(onclick?'onclick="'+onclick+'"':'')+'>'+
    '<div style="font-size:9px;color:var(--tx3);letter-spacing:1px">'+ico+' '+l+'</div>'+
    '<div style="font-size:22px;font-weight:700;color:'+(c||'var(--tx)')+';margin:3px 0">'+v+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+sub+'</div></div>'}
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>','VENDORS',vendors.length,approvedVendors+' SQF approved','var(--ac)');
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>','YTD SPEND',fmt$(totalSpend),'All vendors','var(--gn)');
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>','OPEN POs',pos.filter(function(p){return p.status==='sent'||p.status==='approved'}).length,'Pending delivery','var(--or)');
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>','SQF STATUS',approvedVendors+'/'+vendors.length,'Approved suppliers','var(--ac)','VPR.view=\'sqf\';renderVendorProfile()');
  h+='</div>';

  // Search
  h+='<div style="display:flex;gap:6px;margin-bottom:10px">';
  h+='<input placeholder="Search vendors..." value="'+VPR.search+'" oninput="VPR.search=this.value;renderVendorProfile()" style="flex:1;padding:7px 10px;border:1px solid var(--bdr);border-radius:8px;background:var(--inp);color:var(--tx);font-size:12px">';
  h+='<select onchange="VPR.filterStatus=this.value;renderVendorProfile()" style="padding:7px;border:1px solid var(--bdr);border-radius:8px;background:var(--inp);color:var(--tx);font-size:11px">';
  h+='<option value="all">All Status</option>';
  SQF_STATUSES.forEach(function(s){h+='<option value="'+s+'"'+(VPR.filterStatus===s?' selected':'')+'>'+s+'</option>'});
  h+='</select></div>';

  // Vendor grid
  var list=vendors;
  if(VPR.search){var q=VPR.search.toLowerCase();list=list.filter(function(v){return(v.name+' '+(v.category||'')+' '+(v.materials||[]).join(' ')).toLowerCase().indexOf(q)>-1})}
  if(VPR.filterStatus!=='all')list=list.filter(function(v){return v.sqfStatus===VPR.filterStatus});

  if(!list.length){
    h+='<div style="text-align:center;padding:40px;color:var(--tx3)"><div style="font-size:40px;margin-bottom:10px"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><p>No vendors yet</p><button class="btn btn-pr btn-xs" onclick="vprOpenNewVendor()">+ Add Vendor</button></div>';
    return h;
  }

  h+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">';
  list.forEach(function(v){
    var score=calcVendorScore(v);
    var vpos=vposByVendor(v.id);
    var openPOs=vpos.filter(function(p){return p.status==='sent'||p.status==='approved'}).length;
    var sqfColor={Approved:'var(--gn)',Conditional:'var(--or)',Probation:'var(--rd)',Disqualified:'var(--rd)','New - Pending Review':'var(--tx3)'}[v.sqfStatus]||'var(--tx3)';
    var certExpiry=v.sqfCertExpiry?daysUntil(v.sqfCertExpiry):null;

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:12px;cursor:pointer;transition:border .15s" onmouseover="this.style.borderColor=\'var(--ac)\'" onmouseout="this.style.borderColor=\'var(--bdr)\'" onclick="vprOpenProfile(\''+v.id+'\')">'+
      // Header
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'+
      '<div style="flex:1">'+
      '<div style="font-size:13px;font-weight:700;color:var(--tx)">'+v.name+'</div>'+
      '<div style="font-size:10px;color:var(--tx3)">'+(v.category||'Supplier')+'</div>'+
      '</div>'+
      // Score ring
      '<div style="text-align:center;min-width:44px">'+
      '<div style="font-size:18px;font-weight:700;color:'+scoreColor(score.overall)+'">'+score.overall+'</div>'+
      '<div style="font-size:8px;color:var(--tx3)">'+scoreGrade(score.overall)+'</div>'+
      '</div></div>'+
      // Score bars
      '<div style="margin-bottom:8px">'+vprMiniScoreBar('Delivery',score.delivery)+vprMiniScoreBar('Quality',score.quality)+'</div>'+
      // Info row
      '<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:10px;color:var(--tx3)">'+
      '<span style="color:'+sqfColor+'">●  '+(v.sqfStatus||'Unverified')+'</span>'+
      (openPOs?'<span style="color:var(--ac)">'+openPOs+' open PO'+(openPOs>1?'s':'')+'</span>':'<span>No open POs</span>')+
      (certExpiry!==null?'<span style="color:'+(certExpiry<0?'var(--rd)':certExpiry<=30?'var(--or)':'var(--tx3)')+'">Cert: '+(certExpiry<0?Math.abs(certExpiry)+'d expired':certExpiry+'d')+'</span>':'')
      +'</div>'+
      // Quick actions
      '<div style="display:flex;gap:4px;margin-top:8px">'+
      '<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();vprOpenProfile(\''+v.id+'\')" style="flex:1">View Profile</button>'+
      '<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();vpOpenCreate({vendorName:\''+v.name+'\'})" style="flex:1">+ PO</button>'+
      '</div>'+
      '</div>';
  });
  h+='</div>';
  return h;
}

function vprMiniScoreBar(label,score){
  return'<div style="margin-bottom:3px"><div style="display:flex;justify-content:space-between;font-size:8px;color:var(--tx3);margin-bottom:1px"><span>'+label+'</span><span style="color:'+scoreColor(score)+'">'+score+'%</span></div>'+
    '<div style="height:3px;background:var(--bg);border-radius:2px"><div style="height:100%;width:'+score+'%;background:'+scoreColor(score)+';border-radius:2px;transition:width .3s"></div></div></div>';
}

// ─── VENDOR PROFILE VIEW ──────────────────────────────────────────
function vprOpenProfile(vendorId){
  VPR.view='profile';
  VPR.vendorId=vendorId;
  VPR.profileTab='overview';
  renderVendorProfile();
}

function vprProfile(){
  var v=vendorGet(VPR.vendorId);
  if(!v)return'<div style="padding:20px;color:var(--tx3)">Vendor not found. <button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()">← Back</button></div>';

  var score=calcVendorScore(v);
  var vpos=vposByVendor(v.id);
  var sqfColor={Approved:'var(--gn)',Conditional:'var(--or)',Probation:'var(--rd)',Disqualified:'var(--rd)','New - Pending Review':'var(--tx3)'}[v.sqfStatus]||'var(--tx3)';

  var h='';

  // ── VENDOR HEADER CARD ──
  h+='<div style="background:linear-gradient(135deg,var(--bg2),var(--bg3));border:1px solid var(--bdr);border-radius:12px;padding:14px;margin-bottom:12px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">';
  h+='<div>'+
    '<button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()" style="margin-bottom:6px">← All Vendors</button>'+
    '<div style="font-size:20px;font-weight:700;color:var(--tx)">'+v.name+'</div>'+
    '<div style="font-size:11px;color:var(--tx3)">'+(v.category||'Supplier')+' · '+(v.email||'No email')+'</div>'+
    '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+
    '<span style="font-size:10px;color:'+sqfColor+';border:1px solid '+sqfColor+';padding:2px 8px;border-radius:4px">'+( v.sqfStatus||'Unverified')+'</span>'+
    (v.terms?'<span style="font-size:10px;color:var(--tx3);border:1px solid var(--bdr);padding:2px 8px;border-radius:4px">'+v.terms+'</span>':'')+'</div>'+
    '</div>';
  // Score dashboard
  h+='<div style="text-align:center;min-width:80px">'+
    '<div style="font-size:36px;font-weight:900;color:'+scoreColor(score.overall)+'">'+score.overall+'</div>'+
    '<div style="font-size:11px;font-weight:700;color:'+scoreColor(score.overall)+'">Grade '+scoreGrade(score.overall)+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">Vendor Score</div>'+
    '</div>';
  h+='</div>';
  // Score breakdown bars
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  [{l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Delivery',s:score.delivery},{l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Quality',s:score.quality},{l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Pricing',s:score.pricing},{l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Response',s:score.responsiveness}].forEach(function(b){
    h+='<div><div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px"><span style="color:var(--tx3)">'+b.l+'</span><span style="color:'+scoreColor(b.s)+'">'+b.s+'%</span></div>'+
      '<div style="height:5px;background:var(--bg);border-radius:3px"><div style="height:100%;width:'+b.s+'%;background:'+scoreColor(b.s)+';border-radius:3px;transition:width .5s"></div></div></div>';
  });
  h+='</div></div>';

  // ── PROFILE TABS ──
  var tabs=[
    {k:'overview',l:'Overview',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'},
    {k:'orders',l:'PO History',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'},
    {k:'invoices',l:'Invoices',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'},
    {k:'comms',l:'Communications',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'},
    {k:'docs',l:'Docs & Certs',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
    {k:'scorecard',l:'Scorecard',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'},
    {k:'contacts',l:'Contacts',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'},
    {k:'calendar',l:'Schedule',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'}
  ];
  h+='<div style="display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--bdr);overflow-x:auto">';
  tabs.forEach(function(t){
    h+='<div onclick="VPR.profileTab=\''+t.k+'\';renderVendorProfile()" style="padding:8px 12px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(VPR.profileTab===t.k?'var(--ac)':'transparent')+';color:'+(VPR.profileTab===t.k?'var(--ac)':'var(--tx3)')+'">'+t.ico+' '+t.l+'</div>';
  });
  h+='</div>';

  // ── TAB CONTENT ──
  if(VPR.profileTab==='overview')h+=vprTabOverview(v,score,vpos);
  else if(VPR.profileTab==='orders')h+=vprTabOrders(v,vpos);
  else if(VPR.profileTab==='invoices')h+=vprTabInvoices(v,vpos);
  else if(VPR.profileTab==='comms')h+=vprTabComms(v,vpos);
  else if(VPR.profileTab==='docs')h+=vprTabDocs(v);
  else if(VPR.profileTab==='scorecard')h+=vprTabScorecard(v,score,vpos);
  else if(VPR.profileTab==='contacts')h+=vprTabContacts(v);
  else if(VPR.profileTab==='calendar')h+=vprTabVendorCal(v,vpos);

  return h;
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────
function vprTabOverview(v,score,vpos){
  var totalSpend=vpos.filter(function(p){return p.status==='paid'||p.status==='received'}).reduce(function(s,p){return s+(p.total||0)},0);
  var openPOs=vpos.filter(function(p){return p.status==='sent'||p.status==='approved'});
  var pendingAP=vpos.filter(function(p){return p.status==='received'&&(!p.paidAmount||(p.paidAmount||0)<(p.total||0))});
  var pendingBalance=pendingAP.reduce(function(s,p){return s+(p.total||0)-(p.paidAmount||0)},0);

  var h='';

  // KPI row
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
  function vkpi(ico,l,v2,c){return'<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:8px">'+
    '<div style="font-size:9px;color:var(--tx3)">'+ico+' '+l+'</div>'+
    '<div style="font-size:16px;font-weight:700;color:'+(c||'var(--tx)')+';margin-top:2px">'+v2+'</div></div>'}
  h+=vkpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>','Total Spend',fmt$(totalSpend),'var(--gn)');
  h+=vkpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>','Open POs',openPOs.length,'var(--ac)');
  h+=vkpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>','AP Balance',fmt$(pendingBalance),'var(--rd)');
  h+='</div>';

  // Contact & info
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">VENDOR INFO</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px">';
  function orow(l,v2){return'<div><span style="color:var(--tx3)">'+l+': </span><span style="color:var(--tx)">'+v2+'</span></div>'}
  h+=orow('Category',v.category||'—');
  h+=orow('Contact',v.contact||'—');
  h+=orow('Email',v.email||'—');
  h+=orow('Phone',v.phone||'—');
  h+=orow('Terms',v.terms||'—');
  h+=orow('Payment',v.paymentMethod||'—');
  h+=orow('Lead Time',(v.avgLeadDays||'?')+' days');
  h+=orow('SQF Status',v.sqfStatus||'Unverified');
  if(v.taxId)h+=orow('Tax ID / W9',v.taxId);
  if(v.address)h+=orow('Address',v.address);
  h+='</div></div>';

  // Materials supplied
  if(v.materials&&v.materials.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">MATERIALS SUPPLIED</div>';
    v.materials.forEach(function(m){
      h+='<div style="display:inline-block;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;padding:2px 8px;margin:2px;font-size:10px;color:var(--tx2)">'+m+'</div>';
    });
    h+='</div>';
  }

  // Recent POs
  if(openPOs.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">OPEN PURCHASE ORDERS</div>';
    openPOs.slice(0,5).forEach(function(p){
      var d=daysUntil(p.eta);
      h+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px;cursor:pointer" onclick="vpOpenDetail(\''+p.id+'\')">';
      h+='<div><span style="color:var(--ac);font-weight:600">'+p.vpoNum+'</span><span style="color:var(--tx3);margin-left:6px">'+p.material+'</span></div>';
      h+='<div style="display:flex;gap:8px"><span style="color:var(--tx)">'+fmt$(p.total)+'</span>';
      h+='<span style="color:'+(d===null?'var(--tx3)':d<0?'var(--rd)':d<=3?'var(--or)':'var(--tx3)')+'">ETA: '+fmtDate(p.eta)+'</span></div></div>';
    });
    h+='</div>';
  }

  // Quick actions
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  h+='<button class="btn btn-pr btn-xs" onclick="vpOpenCreate({vendorName:\''+v.name+'\',vendorEmail:\''+( v.email||'')+'\',vendorPhone:\''+( v.phone||'')+'\'})">+ New PO</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprSendVendorEmail(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Email Vendor</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprScheduleFollowUp(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Schedule Follow-up</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprGenerateScorecard(\''+v.id+'\')">AI Scorecard</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprEditVendor(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
  h+='</div>';
  return h;
}

// ── ORDERS TAB ────────────────────────────────────────────────────
function vprTabOrders(v,vpos){
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h+='<div style="font-size:10px;color:var(--tx3)">'+vpos.length+' total POs · '+fmt$(vpos.reduce(function(s,p){return s+(p.total||0)},0))+' total spend</div>';
  h+='<button class="btn btn-pr btn-xs" onclick="vpOpenCreate({vendorName:\''+v.name+'\'})">+ New PO</button></div>';

  if(!vpos.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)">No POs with this vendor yet</div>';

  var STATUS_COLORS_MAP={draft:'var(--tx3)',pending_approval:'var(--or)',approved:'var(--ac)',rejected:'var(--rd)',sent:'#a78bfa',received:'var(--gn)',paid:'var(--tx3)'};
  var STATUS_LABELS_MAP={draft:'Draft',pending_approval:'Pending Approval',approved:'Approved',rejected:'Rejected',sent:'Sent',received:'Received',paid:'Paid'};

  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  h+='<thead><tr style="border-bottom:2px solid var(--bdr)">';
  ['VPO#','Material','Total','ETA','Status','Actions'].forEach(function(l){
    h+='<th style="padding:6px 8px;text-align:left;color:var(--tx3)">'+l+'</th>';
  });
  h+='</tr></thead><tbody>';
  vpos.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)}).forEach(function(p){
    var sc=STATUS_COLORS_MAP[p.status]||'var(--tx3)';
    var d=daysUntil(p.eta);
    h+='<tr style="border-bottom:1px solid var(--bdr);cursor:pointer" onclick="vpOpenDetail(\''+p.id+'\')" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
    h+='<td style="padding:6px 8px;color:var(--ac);font-weight:700">'+p.vpoNum+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx2);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+( p.material||'—')+'</td>';
    h+='<td style="padding:6px 8px;font-weight:700;color:var(--tx)">'+fmt$(p.total)+'</td>';
    h+='<td style="padding:6px 8px;color:'+(d===null?'var(--tx3)':d<0?'var(--rd)':d<=3?'var(--or)':'var(--tx3)')+'">'+fmtDate(p.eta)+'</td>';
    h+='<td style="padding:6px 8px"><span style="font-size:9px;color:'+sc+';border:1px solid '+sc+';padding:1px 6px;border-radius:3px">'+(STATUS_LABELS_MAP[p.status]||p.status)+'</span></td>';
    h+='<td style="padding:6px 8px">';
    if(p.status==='sent')h+='<button class="btn btn-gn btn-xs" onclick="event.stopPropagation();vpReceiveModal(\''+p.id+'\')">Receive</button>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

// ── INVOICES TAB (3-way match) ────────────────────────────────────
function vprTabInvoices(v,vpos){
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h+='<div style="font-size:10px;color:var(--tx3)">Track vendor invoices against POs for 3-way match</div>';
  h+='<button class="btn btn-pr btn-xs" onclick="vprLogVendorInvoice(\''+v.id+'\')">+ Log Invoice</button></div>';

  var receivedPOs=vpos.filter(function(p){return p.status==='received'||p.status==='paid'});
  if(!receivedPOs.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)">No received POs to invoice against</div>';

  receivedPOs.forEach(function(p){
    var invoiceAmt=p.vendorInvoiceAmount||0;
    var poDelta=invoiceAmt-p.total;
    var match=!invoiceAmt?'pending':Math.abs(poDelta/p.total)<0.02?'match':'discrepancy';
    var mc={match:'var(--gn)',discrepancy:'var(--rd)',pending:'var(--tx3)'}[match];

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+mc+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h+='<div><span style="font-size:11px;font-weight:700;color:var(--ac)">'+p.vpoNum+'</span>';
    h+='<span style="font-size:10px;color:var(--tx3);margin-left:8px">'+p.material+'</span></div>';
    h+='<span style="font-size:9px;color:'+mc+';border:1px solid '+mc+';padding:1px 6px;border-radius:3px">'+(match==='pending'?'No Invoice Yet':match==='match'?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Matched':'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Discrepancy')+'</span></div>';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:10px">';
    h+='<div><div style="color:var(--tx3)">PO Amount</div><div style="font-weight:700;color:var(--tx)">'+fmt$(p.total)+'</div></div>';
    h+='<div><div style="color:var(--tx3)">Invoice Amount</div><div style="font-weight:700;color:'+(invoiceAmt?'var(--tx)':'var(--tx3)')+'">'+( invoiceAmt?fmt$(invoiceAmt):'—')+'</div></div>';
    h+='<div><div style="color:var(--tx3)">Variance</div><div style="font-weight:700;color:'+mc+'">'+( invoiceAmt?(poDelta>=0?'+':'')+fmt$(poDelta):'—')+'</div></div>';
    h+='</div>';
    if(!invoiceAmt){
      h+='<button class="btn btn-ghost btn-xs" onclick="vprLogInvoiceAmount(\''+p.id+'\')" style="margin-top:6px">Enter Invoice Amount</button>';
    }
    h+='</div>';
  });
  return h;
}

function vprLogVendorInvoice(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  var vpos=vposByVendor(vendorId).filter(function(p){return p.status==='received'||p.status==='paid'});
  var h='<div class="modal-title">Log Vendor Invoice</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Invoice #','vinvNum','');
  h+=vField('Invoice Amount $','vinvAmt','','number');
  h+=vField('Invoice Date','vinvDate','','date');
  h+=vField('Link to PO','vinvPO','','select',vpos.map(function(p){return{id:p.id,name:p.vpoNum+' — '+p.material+' '+fmt$(p.total)}}));
  h+='</div>';
  h+=vField('Notes','vinvNotes','','textarea');
  h+='<button class="btn btn-pr" onclick="vprSaveVendorInvoice(\''+vendorId+'\')" style="width:100%;margin-top:8px">Save Invoice</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprLogInvoiceAmount(vpoId){
  var h='<div class="modal-title">Enter Invoice Amount</div>';
  h+=vField('Invoice Amount $','vinvAmt2','','number');
  h+=vField('Invoice #','vinvNum2','');
  h+='<button class="btn btn-pr" onclick="vprSaveInvoiceMatch(\''+vpoId+'\')" style="width:100%;margin-top:8px">Save</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSaveInvoiceMatch(vpoId){
  var amt=gf('vinvAmt2');var num=gv('vinvNum2');
  if(!amt)return toast('Amount required','err');
  fbDb.collection('vendorPOs').doc(vpoId).update({
    vendorInvoiceAmount:amt,vendorInvoiceNum:num||'',invoiceLoggedAt:new Date().toISOString(),invoiceLoggedBy:getUserName()
  }).then(function(){toast('Invoice logged','ok');closeModal();vprOpenProfile(VPR.vendorId)});
}

function vprSaveVendorInvoice(vendorId){
  var amt=gf('vinvAmt');var num=gv('vinvNum');var date=gv('vinvDate');var poId=gv('vinvPO');
  if(!amt)return toast('Amount required','err');
  var inv={id:'vi_'+Date.now(),vendorId:vendorId,invoiceNum:num||'',amount:amt,date:date||new Date().toISOString().split('T')[0],forVpoId:poId||'',notes:gv('vinvNotes'),loggedAt:new Date().toISOString(),loggedBy:getUserName()};
  // If linked to PO, update the PO with invoice data
  if(poId){vprSaveInvoiceMatch_direct(poId,amt,num);}
  // Store on vendor record
  var v=vendorGet(vendorId)||{};
  v.invoices=v.invoices||[];v.invoices.unshift(inv);
  vendorSave(v).then(function(){toast('Invoice logged','ok');closeModal();vprOpenProfile(vendorId)});
}

function vprSaveInvoiceMatch_direct(vpoId,amt,num){
  fbDb.collection('vendorPOs').doc(vpoId).update({vendorInvoiceAmount:amt,vendorInvoiceNum:num||''}).catch(function(e){console.warn('op:',e)});
}

// ── COMMUNICATIONS TAB ───────────────────────────────────────────
function vprTabComms(v,vpos){
  var comms=v.communications||[];
  var h='<div style="display:flex;gap:6px;margin-bottom:10px">';
  h+='<button class="btn btn-pr btn-xs" onclick="vprLogCommunication(\''+v.id+'\')">+ Log Communication</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprSendVendorEmail(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Send Email</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprAIDraftEmail(\''+v.id+'\',\'general\')">AI Draft</button>';
  h+='</div>';

  if(!comms.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)">No communications logged yet</div>';

  var typeColors={email:'var(--ac)',call:'var(--gn)',meeting:'#a78bfa',note:'var(--tx3)',po_confirm:'var(--or)',dispute:'var(--rd)'};
  comms.slice().reverse().forEach(function(c){
    var tc=typeColors[c.type]||'var(--tx3)';
    h+='<div style="background:var(--bg2);border-left:3px solid '+tc+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
    h+='<div><span style="font-size:9px;font-weight:700;color:'+tc+';text-transform:uppercase">'+( c.type||'note')+'</span>';
    h+='<span style="font-size:10px;color:var(--tx3);margin-left:8px">'+c.by+'</span></div>';
    h+='<span style="font-size:9px;color:var(--tx3)">'+fmtDT(c.at)+'</span></div>';
    if(c.subject)h+='<div style="font-size:11px;font-weight:600;color:var(--tx);margin-bottom:3px">'+c.subject+'</div>';
    h+='<div style="font-size:10px;color:var(--tx2)">'+c.text+'</div>';
    if(c.outcome)h+='<div style="font-size:10px;color:var(--gn);margin-top:4px">Outcome: '+c.outcome+'</div>';
    h+='</div>';
  });
  return h;
}

function vprLogCommunication(vendorId){
  var h='<div class="modal-title">Log Communication</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Type','vcommType','email','select',['email','call','meeting','note','po_confirm','dispute']);
  h+=vField('Date & Time','vcommDate',new Date().toISOString().slice(0,16),'datetime-local');
  h+=vField('Subject / Topic','vcommSubj','');
  h+=vField('Outcome (optional)','vcommOutcome','');
  h+='</div>';
  h+=vField('Notes','vcommText','','textarea','',4);
  h+='<button class="btn btn-pr" onclick="vprSaveCommunication(\''+vendorId+'\')" style="width:100%;margin-top:8px">Save</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSaveCommunication(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  var entry={id:'comm_'+Date.now(),type:gv('vcommType'),at:gv('vcommDate')||new Date().toISOString(),subject:gv('vcommSubj'),outcome:gv('vcommOutcome'),text:gv('vcommText'),by:getUserName()};
  if(!entry.text)return toast('Notes required','err');
  v.communications=v.communications||[];
  v.communications.push(entry);
  // If PO confirm, log confirmation time for responsiveness scoring
  if(entry.type==='po_confirm'){
    v.confirmationTimes=v.confirmationTimes||[];
    // Find most recent sent PO and calc days
    var sentPO=(getVpoCache()).filter(function(p){return p.vendorName===v.name&&p.status==='sent'}).sort(function(a,b){return new Date(b.sentAt)-new Date(a.sentAt)})[0];
    if(sentPO&&sentPO.sentAt){v.confirmationTimes.push(Math.round((new Date(entry.at)-new Date(sentPO.sentAt))/(1000*60*60*24)))}
  }
  vendorSave(v).then(function(){toast('Communication logged','ok');closeModal();VPR.profileTab='comms';renderVendorProfile()});
}

// ── DOCUMENTS & CERTS TAB (SQF) ───────────────────────────────────
function vprTabDocs(v){
  var certs=v.certificates||[];
  var docs=v.documents||[];

  var h='<div style="display:flex;gap:6px;margin-bottom:10px">';
  h+='<button class="btn btn-pr btn-xs" onclick="vprUploadCert(\''+v.id+'\')">+ Upload Certificate</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprUploadDoc(\''+v.id+'\')">+ Attach Document</button>';
  h+='</div>';

  // SQF Qualification Summary
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">SQF SUPPLIER QUALIFICATION (Ed.10 Clause 2.3)</div>';
  var sqfItems=[
    {l:'Supplier Approval Status',v:v.sqfStatus||'Pending',ok:v.sqfStatus==='Approved'},
    {l:'Food Safety Certificate',v:v.foodSafetyCert||'Not on file',ok:!!v.foodSafetyCert},
    {l:'Certificate Expiry',v:fmtDate(v.sqfCertExpiry),ok:v.sqfCertExpiry&&daysUntil(v.sqfCertExpiry)>0},
    {l:'Allergen Declaration',v:v.allergenDeclaration||'Not on file',ok:!!v.allergenDeclaration},
    {l:'COA Required per Lot',v:v.coaRequired?'Yes — Required':'Not set',ok:v.coaRequired!==undefined},
    {l:'W9 / Tax ID',v:v.taxId||'Not on file',ok:!!v.taxId},
    {l:'FSMA Compliance',v:v.fsmaStatus||'Not confirmed',ok:v.fsmaStatus==='Compliant'},
    {l:'Annual Re-evaluation Due',v:fmtDate(v.nextEvaluationDate),ok:v.nextEvaluationDate&&daysUntil(v.nextEvaluationDate)>0}
  ];
  sqfItems.forEach(function(item){
    h+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
    h+='<span style="color:var(--tx3)">'+item.l+'</span>';
    h+='<span style="color:'+(item.ok?'var(--gn)':'var(--or)')+'">'+( item.ok?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ':' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ')+item.v+'</span></div>';
  });
  h+='<button class="btn btn-ghost btn-xs" onclick="vprEditSQF(\''+v.id+'\')" style="margin-top:8px">Edit SQF Data</button>';
  h+='</div>';

  // Certificates
  if(certs.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">CERTIFICATES</div>';
    certs.forEach(function(c){
      var expired=c.expiry&&daysUntil(c.expiry)<0;
      var expiringSoon=c.expiry&&daysUntil(c.expiry)<=30&&daysUntil(c.expiry)>0;
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr)">';
      h+='<div><div style="font-size:11px;font-weight:600;color:var(--tx)">'+c.name+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3)">'+c.type+' · Issued: '+fmtDate(c.issued)+'</div></div>';
      h+='<div style="text-align:right">';
      if(c.expiry)h+='<div style="font-size:10px;color:'+(expired?'var(--rd)':expiringSoon?'var(--or)':'var(--gn)')+'">Exp: '+fmtDate(c.expiry)+(expired?' EXPIRED':expiringSoon?' SOON':'')+'</div>';
      if(c.driveLink)h+='<a href="'+c.driveLink+'" target="_blank" class="btn btn-ghost btn-xs" style="font-size:8px">☁ View</a>';
      h+='</div></div>';
    });
    h+='</div>';
  }

  // Documents
  if(docs.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">DOCUMENTS</div>';
    docs.forEach(function(d){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
      h+='<span style="color:var(--tx)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> '+d.name+'</span>';
      h+='<div style="display:flex;gap:4px">';
      if(d.url)h+='<a href="'+d.url+'" target="_blank" class="btn btn-ghost btn-xs">View</a>';
      h+='<span style="color:var(--tx3)">'+fmtDate(d.uploadedAt)+'</span></div></div>';
    });
    h+='</div>';
  }

  return h;
}

function vprEditSQF(vendorId){
  var v=vendorGet(vendorId)||{};
  var h='<div class="modal-title">SQF Qualification Data</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('SQF Approval Status','vsqfStatus',v.sqfStatus||'','select',SQF_STATUSES);
  h+=vField('Food Safety Cert #','vsqfCert',v.foodSafetyCert||'');
  h+=vField('Certificate Expiry','vsqfExpiry',v.sqfCertExpiry||'','date');
  h+=vField('Next Evaluation Date','vsqfNextEval',v.nextEvaluationDate||'','date');
  h+=vField('FSMA Status','vsqfFSMA',v.fsmaStatus||'','select',['Not confirmed','Compliant','Exempt','Non-compliant']);
  h+=vField('Allergen Declaration','vsqfAllergen',v.allergenDeclaration||'');
  h+=vField('Tax ID / W9 on file','vsqfTaxId',v.taxId||'');
  h+=vField('COA Required per Lot?','vsqfCOA',v.coaRequired?'yes':'no','select',['yes','no']);
  h+='</div>';
  h+=vField('SQF Notes','vsqfNotes',v.sqfNotes||'','textarea','',3);
  h+='<button class="btn btn-pr" onclick="vprSaveSQF(\''+vendorId+'\')" style="width:100%;margin-top:8px">Save SQF Data</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSaveSQF(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  var prevStatus=v.sqfStatus;
  v.sqfStatus=gv('vsqfStatus');
  v.foodSafetyCert=gv('vsqfCert');
  v.sqfCertExpiry=gv('vsqfExpiry');
  v.nextEvaluationDate=gv('vsqfNextEval');
  v.fsmaStatus=gv('vsqfFSMA');
  v.allergenDeclaration=gv('vsqfAllergen');
  v.taxId=gv('vsqfTaxId');
  v.coaRequired=gv('vsqfCOA')==='yes';
  v.sqfNotes=gv('vsqfNotes');
  // Log status change
  if(prevStatus!==v.sqfStatus){
    v.sqfLog=v.sqfLog||[];
    v.sqfLog.push({from:prevStatus,to:v.sqfStatus,by:getUserName(),at:new Date().toISOString()});
    notifyTeam('🏅 Vendor SQF status changed: '+v.name+' → '+v.sqfStatus);
  }
  vendorSave(v).then(function(){toast('SQF data saved','ok');closeModal();VPR.profileTab='docs';renderVendorProfile()});
}

function vprUploadCert(vendorId){
  var h='<div class="modal-title">Upload Certificate</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Certificate Name*','vcertName','e.g. SQF Level 2 Certificate');
  h+=vField('Type','vcertType','','select',['SQF Certificate','Third-Party Audit','Food Safety','FSMA','GFSI','ISO','Other']);
  h+=vField('Issue Date','vcertIssued','','date');
  h+=vField('Expiry Date','vcertExpiry','','date');
  h+=vField('Google Drive Link','vcertLink','');
  h+='</div>';
  h+='<button class="btn btn-pr" onclick="vprSaveCert(\''+vendorId+'\')" style="width:100%;margin-top:8px">Save Certificate</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSaveCert(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  var name=gv('vcertName');if(!name)return toast('Name required','err');
  var cert={id:'cert_'+Date.now(),name:name,type:gv('vcertType'),issued:gv('vcertIssued'),expiry:gv('vcertExpiry'),driveLink:gv('vcertLink'),uploadedAt:new Date().toISOString(),uploadedBy:getUserName()};
  v.certificates=v.certificates||[];v.certificates.push(cert);
  // Auto-update SQF expiry if SQF cert
  if(cert.type==='SQF Certificate'&&cert.expiry){v.sqfCertExpiry=cert.expiry;v.foodSafetyCert=cert.name}
  vendorSave(v).then(function(){toast('Certificate saved','ok');closeModal();VPR.profileTab='docs';renderVendorProfile()});
}

// ── SCORECARD TAB ────────────────────────────────────────────────
function vprTabScorecard(v,score,vpos){
  var h='';

  // Full scorecard
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px;margin-bottom:10px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div><div style="font-size:14px;font-weight:700;color:var(--tx)">Vendor Scorecard</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">Auto-calculated from PO history, QC logs, invoice data</div></div>';
  h+='<div style="text-align:center"><div style="font-size:48px;font-weight:900;color:'+scoreColor(score.overall)+'">'+score.overall+'</div><div style="font-size:12px;font-weight:700;color:'+scoreColor(score.overall)+'">Grade '+scoreGrade(score.overall)+'</div></div></div>';

  // Category breakdown
  var cats=[
    {l:'Delivery Performance',s:score.delivery,ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',w:'35%',details:['On-time: '+(score.details.deliveryPct||100)+'%','Avg days late: '+(score.details.avgDaysLate||0)]},
    {l:'Quality',s:score.quality,ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',w:'30%',details:['Rejections: '+(score.details.rejections||0),'COA compliance: '+(v.coaRequired?'Required':'N/A')]},
    {l:'Price Accuracy',s:score.pricing,ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',w:'20%',details:['Invoice vs PO match','Variance tolerance: ±2%']},
    {l:'Responsiveness',s:score.responsiveness,ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',w:'15%',details:['PO confirmation time','Days to respond']}
  ];

  cats.forEach(function(c){
    h+='<div style="margin-bottom:10px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
    h+='<div><span style="font-size:12px">'+c.ico+'</span><span style="font-size:11px;font-weight:600;color:var(--tx);margin-left:6px">'+c.l+'</span><span style="font-size:9px;color:var(--tx3);margin-left:6px">Weight: '+c.w+'</span></div>';
    h+='<span style="font-size:16px;font-weight:700;color:'+scoreColor(c.s)+'">'+c.s+'%</span></div>';
    h+='<div style="height:8px;background:var(--bg);border-radius:4px;margin-bottom:4px"><div style="height:100%;width:'+c.s+'%;background:'+scoreColor(c.s)+';border-radius:4px;transition:width .5s"></div></div>';
    h+='<div style="font-size:9px;color:var(--tx3)">'+c.details.join(' · ')+'</div>';
    h+='</div>';
  });
  h+='</div>';

  // Scorecard history
  if(v.scorecardHistory&&v.scorecardHistory.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">SCORECARD HISTORY</div>';
    v.scorecardHistory.slice(-6).forEach(function(sc){
      h+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
      h+='<span style="color:var(--tx3)">'+fmtDate(sc.date)+'</span>';
      h+='<span style="font-weight:700;color:'+scoreColor(sc.overall)+'">'+sc.overall+' ('+scoreGrade(sc.overall)+')</span></div>';
    });
    h+='</div>';
  }

  // Actions
  h+='<div style="display:flex;gap:6px">';
  h+='<button class="btn btn-pr btn-xs" onclick="vprGenerateScorecard(\''+v.id+'\')">Generate AI Scorecard Report</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprEmailScorecard(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Email to Vendor</button>';
  h+='</div>';
  return h;
}

// ── CONTACTS TAB ─────────────────────────────────────────────────
function vprTabContacts(v){
  var contacts=v.contacts||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  h+='<div style="font-size:10px;color:var(--tx3)">All contacts at '+v.name+'</div>';
  h+='<button class="btn btn-pr btn-xs" onclick="vprAddContact(\''+v.id+'\')">+ Add Contact</button></div>';

  // Primary contact
  h+='<div style="background:var(--bg2);border:1px solid var(--ac);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">PRIMARY CONTACT</div>';
  h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">'+(v.contact||'Not set')+'</div>';
  h+='<div style="font-size:11px;color:var(--tx2)">'+(v.email||'No email')+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">'+(v.phone||'No phone')+'</div>';
  h+='<div style="display:flex;gap:4px;margin-top:6px">';
  if(v.email)h+='<button class="btn btn-ghost btn-xs" onclick="vprSendVendorEmail(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Email</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprEditVendor(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
  h+='</div></div>';

  // Additional contacts
  if(contacts.length){
    contacts.forEach(function(c){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:8px">';
      h+='<div style="display:flex;justify-content:space-between">';
      h+='<div><div style="font-size:12px;font-weight:600;color:var(--tx)">'+c.name+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+(c.title||'—')+'</div>';
      h+='<div style="font-size:10px;color:var(--tx2)">'+(c.email||'—')+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+(c.phone||'—')+'</div></div>';
      h+='<div style="text-align:right"><div style="font-size:9px;color:var(--tx3)">'+(c.department||'')+'</div>';
      if(c.email)h+='<button class="btn btn-ghost btn-xs" onclick="vprSendToContact(\''+v.id+'\',\''+c.email+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></button>';
      h+='</div></div></div>';
    });
  }else if(!v.contact){
    h+='<div style="text-align:center;padding:20px;color:var(--tx3)">No contacts added yet</div>';
  }
  return h;
}

function vprAddContact(vendorId){
  var h='<div class="modal-title">Add Contact</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Name*','vcName','');
  h+=vField('Title','vcTitle','');
  h+=vField('Email','vcEmail','','email');
  h+=vField('Phone','vcPhone','');
  h+=vField('Department','vcDept','','select',['Purchasing','Sales','Accounting','Operations','Quality','Management','Other']);
  h+=vField('Notes','vcNotes','');
  h+='</div>';
  h+='<button class="btn btn-pr" onclick="vprSaveContact(\''+vendorId+'\')" style="width:100%;margin-top:8px">Add Contact</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSaveContact(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  var name=gv('vcName');if(!name)return toast('Name required','err');
  var contact={id:'ct_'+Date.now(),name:name,title:gv('vcTitle'),email:gv('vcEmail'),phone:gv('vcPhone'),department:gv('vcDept'),notes:gv('vcNotes'),addedAt:new Date().toISOString(),addedBy:getUserName()};
  v.contacts=v.contacts||[];v.contacts.push(contact);
  vendorSave(v).then(function(){toast('Contact added','ok');closeModal();VPR.profileTab='contacts';renderVendorProfile()});
}

// ── VENDOR CALENDAR TAB ──────────────────────────────────────────
function vprTabVendorCal(v,vpos){
  var upcoming=vpos.filter(function(p){return p.eta&&(p.status==='sent'||p.status==='approved')}).sort(function(a,b){return new Date(a.eta)-new Date(b.eta)});
  var h='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Upcoming delivery schedule and scheduled follow-ups for '+v.name+'</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:12px">';
  h+='<button class="btn btn-pr btn-xs" onclick="vprScheduleFollowUp(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Schedule Follow-up</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="VPR.view=\'calendar\';renderVendorProfile()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Full Calendar</button>';
  h+='</div>';
  if(!upcoming.length)return h+'<div style="text-align:center;padding:20px;color:var(--tx3)">No upcoming deliveries scheduled</div>';
  upcoming.forEach(function(p){
    var d=daysUntil(p.eta);
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:4px solid '+(d<0?'var(--rd)':d<=3?'var(--or)':'var(--ac)')+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center">';
    h+='<div><div style="font-size:11px;font-weight:700;color:var(--tx)">'+p.vpoNum+' — '+p.material+'</div>';
    h+='<div style="font-size:10px;color:var(--tx3)">'+fmt$(p.total)+' · PO Status: '+p.status+'</div></div>';
    h+='<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:'+(d<0?'var(--rd)':d<=3?'var(--or)':'var(--tx)')+'">'+fmtDate(p.eta)+'</div>';
    h+='<div style="font-size:9px;color:var(--tx3)">'+(d<0?Math.abs(d)+'d overdue':d===0?'Due today':d+'d away')+'</div></div></div></div>';
  });
  return h;
}

// ─── FULL CALENDAR VIEW ───────────────────────────────────────────
function vprCalendar(){
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()">← Back</button>';
  h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">'+new Date(VPR.calYear,VPR.calMonth).toLocaleDateString('en-US',{month:'long',year:'numeric'})+'</div>';
  h+='<div style="display:flex;gap:4px">';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprCalPrev()">←</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprCalToday()">Today</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprCalNext()">→</button>';
  h+='</div></div>';

  // Build calendar grid
  var firstDay=new Date(VPR.calYear,VPR.calMonth,1).getDay();
  var daysInMonth=new Date(VPR.calYear,VPR.calMonth+1,0).getDate();
  var today=new Date();

  h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(d){
    h+='<div style="text-align:center;font-size:9px;color:var(--tx3);padding:4px">'+d+'</div>';
  });
  h+='</div>';
  h+='<div id="vprCalGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';

  // Empty cells before first day
  for(var i=0;i<firstDay;i++)h+='<div style="min-height:50px"></div>';

  // Get PO ETAs and calendar events for this month
  var allPOs=getVpoCache();
  var monthETAs={};
  allPOs.forEach(function(p){
    if(p.eta){
      var d=new Date(p.eta);
      if(d.getMonth()===VPR.calMonth&&d.getFullYear()===VPR.calYear){
        var day=d.getDate();
        monthETAs[day]=monthETAs[day]||[];
        monthETAs[day].push(p);
      }
    }
  });

  for(var day=1;day<=daysInMonth;day++){
    var isToday=today.getDate()===day&&today.getMonth()===VPR.calMonth&&today.getFullYear()===VPR.calYear;
    var dayEvents=monthETAs[day]||[];
    var calEvs=(VPR.calEvents||[]).filter(function(e){
      var d=new Date(e.start&&e.start.dateTime||e.start&&e.start.date);
      return d.getDate()===day&&d.getMonth()===VPR.calMonth&&d.getFullYear()===VPR.calYear;
    });

    h+='<div style="min-height:50px;background:'+(isToday?'rgba(0,229,255,.08)':'var(--bg2)')+';border:1px solid '+(isToday?'var(--ac)':'var(--bdr)')+';border-radius:6px;padding:3px">';
    h+='<div style="font-size:10px;font-weight:'+(isToday?'700':'400')+';color:'+(isToday?'var(--ac)':'var(--tx3)')+';margin-bottom:2px">'+day+'</div>';
    dayEvents.slice(0,2).forEach(function(p){
      var d=daysUntil(p.eta);
      h+='<div style="font-size:7px;background:'+(d<0?'rgba(239,68,68,.15)':d<=3?'rgba(245,158,11,.15)':'rgba(0,229,255,.1)')+';color:'+(d<0?'var(--rd)':d<=3?'var(--or)':'var(--ac)')+';border-radius:3px;padding:1px 3px;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+p.vpoNum+' — '+p.material+'"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> '+p.vpoNum+'</div>';
    });
    calEvs.slice(0,1).forEach(function(e){
      h+='<div style="font-size:7px;background:rgba(167,139,250,.15);color:#a78bfa;border-radius:3px;padding:1px 3px;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> '+( e.summary||'Event').substring(0,12)+'</div>';
    });
    h+='</div>';
  }
  h+='</div>';

  // Legend
  h+='<div style="display:flex;gap:12px;margin-top:8px;font-size:9px;color:var(--tx3)">';
  h+='<span style="color:var(--ac)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> PO Delivery ETA</span>';
  h+='<span style="color:#a78bfa"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Calendar Event</span>';
  h+='<span style="color:var(--rd)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Overdue</span>';
  h+='<span style="color:var(--or)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Due Soon</span>';
  h+='</div>';

  // Upcoming deliveries list
  var upcoming=allPOs.filter(function(p){return p.eta&&(p.status==='sent'||p.status==='approved')&&daysUntil(p.eta)>=0&&daysUntil(p.eta)<=14}).sort(function(a,b){return new Date(a.eta)-new Date(b.eta)});
  if(upcoming.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-top:12px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">NEXT 14 DAYS — EXPECTED DELIVERIES</div>';
    upcoming.forEach(function(p){
      var d=daysUntil(p.eta);
      h+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px;cursor:pointer" onclick="vpOpenDetail(\''+p.id+'\')">';
      h+='<div><span style="color:var(--ac);font-weight:600">'+p.vpoNum+'</span><span style="color:var(--tx3);margin-left:6px">'+p.vendorName+'</span></div>';
      h+='<div style="display:flex;gap:8px"><span style="color:var(--tx2)">'+p.material.substring(0,20)+'</span>';
      h+='<span style="color:'+(d===0?'var(--rd)':d<=3?'var(--or)':'var(--tx3)')+'">'+fmtDate(p.eta)+' ('+(d===0?'Today':d+'d')+')</span></div></div>';
    });
    h+='</div>';
  }
  return h;
}

function vprCalPrev(){VPR.calMonth--;if(VPR.calMonth<0){VPR.calMonth=11;VPR.calYear--}renderVendorProfile()}
function vprCalNext(){VPR.calMonth++;if(VPR.calMonth>11){VPR.calMonth=0;VPR.calYear++}renderVendorProfile()}
function vprCalToday(){VPR.calMonth=new Date().getMonth();VPR.calYear=new Date().getFullYear();renderVendorProfile()}

var _vprCalLoading=false;
function vprLoadCalendarEvents(){
  if(_vprCalLoading)return; // prevent recursive renders
  _vprCalLoading=true;
  if(typeof getGoogleToken==='undefined'){_vprCalLoading=false;return;}
  getGoogleToken().then(function(token){
    if(!token){_vprCalLoading=false;return}
    var start=new Date(VPR.calYear,VPR.calMonth,1).toISOString();
    var end=new Date(VPR.calYear,VPR.calMonth+1,0,23,59).toISOString();
    var calId=localStorage.getItem('mfx_calendar_id')||'primary';
    fetch('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calId)+'/events?timeMin='+encodeURIComponent(start)+'&timeMax='+encodeURIComponent(end)+'&maxResults=50&singleEvents=true&orderBy=startTime',{
      headers:{'Authorization':'Bearer '+token}
    }).then(function(r){return r.json()}).then(function(d){
      VPR.calEvents=(d.items||[]).filter(function(e){return e.summary&&(e.summary.toLowerCase().indexOf('vendor')+e.summary.indexOf('VPO-')+e.summary.indexOf('delivery'))>-2});
      _vprCalLoading=false;
      var grid=document.getElementById('vprCalGrid');
      if(grid)renderVendorProfile(); // re-render with events
    }).catch(function(){_vprCalLoading=false});
  }).catch(function(){_vprCalLoading=false});
}

// ─── SQF VIEW ─────────────────────────────────────────────────────
function vprSQF(){
  var vendors=getVendorCache();
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div><div style="font-size:13px;font-weight:700;color:var(--tx)">SQF Supplier Management</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">SQF Edition 10 — Clause 2.3 Supplier & Raw Material Management</div></div>';
  h+='<button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()">← Hub</button></div>';

  // Compliance summary
  var approved=vendors.filter(function(v){return v.sqfStatus==='Approved'}).length;
  var conditional=vendors.filter(function(v){return v.sqfStatus==='Conditional'}).length;
  var probation=vendors.filter(function(v){return v.sqfStatus==='Probation'}).length;
  var unverified=vendors.filter(function(v){return!v.sqfStatus||v.sqfStatus==='New - Pending Review'}).length;
  var expiringSoon=vendors.filter(function(v){return v.sqfCertExpiry&&daysUntil(v.sqfCertExpiry)<=30&&daysUntil(v.sqfCertExpiry)>0}).length;
  var expired=vendors.filter(function(v){return v.sqfCertExpiry&&daysUntil(v.sqfCertExpiry)<0}).length;

  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
  function sqfkpi(l,n,c){return'<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:8px;text-align:center">'+
    '<div style="font-size:24px;font-weight:700;color:'+c+'">'+n+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+l+'</div></div>'}
  h+=sqfkpi('Approved',approved,'var(--gn)');
  h+=sqfkpi('Conditional / Probation',conditional+probation,'var(--or)');
  h+=sqfkpi('Unverified',unverified,'var(--tx3)');
  h+=sqfkpi('Certs Expiring Soon',expiringSoon,'var(--or)');
  h+=sqfkpi('Certs Expired',expired,'var(--rd)');
  h+=sqfkpi('Total Vendors',vendors.length,'var(--ac)');
  h+='</div>';

  // Vendor qualification table
  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:10px">';
  h+='<thead><tr style="border-bottom:2px solid var(--bdr)">';
  ['Vendor','Category','SQF Status','Cert Expiry','COA Req','FSMA','Next Eval','Actions'].forEach(function(l){
    h+='<th style="padding:6px 8px;text-align:left;color:var(--tx3)">'+l+'</th>';
  });
  h+='</tr></thead><tbody>';
  vendors.forEach(function(v){
    var sqfColor={Approved:'var(--gn)',Conditional:'var(--or)',Probation:'var(--rd)',Disqualified:'var(--rd)','New - Pending Review':'var(--tx3)'}[v.sqfStatus]||'var(--tx3)';
    var certDays=v.sqfCertExpiry?daysUntil(v.sqfCertExpiry):null;
    h+='<tr style="border-bottom:1px solid var(--bdr)" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
    h+='<td style="padding:6px 8px;font-weight:600;color:var(--tx);cursor:pointer" onclick="vprOpenProfile(\''+v.id+'\')">'+v.name+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(v.category||'—')+'</td>';
    h+='<td style="padding:6px 8px"><span style="color:'+sqfColor+'">'+(v.sqfStatus||'Unverified')+'</span></td>';
    h+='<td style="padding:6px 8px;color:'+(certDays===null?'var(--tx3)':certDays<0?'var(--rd)':certDays<=30?'var(--or)':'var(--gn)')+'">'+(v.sqfCertExpiry?fmtDate(v.sqfCertExpiry)+(certDays<0?' ⛔':certDays<=30?' ⚠️':''):'—')+'</td>';
    h+='<td style="padding:6px 8px;text-align:center">'+(v.coaRequired?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">—</span>')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(v.fsmaStatus||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:'+(v.nextEvaluationDate&&daysUntil(v.nextEvaluationDate)<30?'var(--or)':'var(--tx3)')+'">'+(v.nextEvaluationDate?fmtDate(v.nextEvaluationDate):'—')+'</td>';
    h+='<td style="padding:6px 8px"><button class="btn btn-ghost btn-xs" onclick="VPR.vendorId=\''+v.id+'\';VPR.view=\'profile\';VPR.profileTab=\'docs\';renderVendorProfile()">Manage</button></td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

// ─── MATERIALS VIEW ───────────────────────────────────────────────
function vprMaterials(){
  var mats=getMaterialCache();
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div><div style="font-size:13px;font-weight:700;color:var(--tx)">Materials Inventory</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">Tracks on-hand, on-order, lot history. SQF traceability ready.</div></div>';
  h+='<div style="display:flex;gap:4px"><button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()">← Hub</button>';
  h+='<button class="btn btn-pr btn-xs" onclick="vpOpenCreateMaterial()">+ Material</button></div></div>';

  // Pricing bridge alert
  var quoteMatMismatch=vprCheckMatPricing();
  if(quoteMatMismatch.length){
    h+='<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:9px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:4px">💡 PRICING BRIDGE — MATERIAL COST CHANGES DETECTED</div>';
    quoteMatMismatch.forEach(function(m){
      h+='<div style="font-size:10px;color:var(--tx2);padding:2px 0">'+m.material+': actual cost '+fmt$(m.actual)+' vs quote rate '+fmt$(m.quoted)+' — <span style="color:var(--or)">'+m.quotes+' quotes may be affected</span></div>';
    });
    h+='<button class="btn btn-ghost btn-xs" onclick="vprFlagAffectedQuotes()" style="margin-top:6px">Flag Affected Quotes</button>';
    h+='</div>';
  }

  // Low stock alerts
  var lowStock=mats.filter(function(m){return m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint});
  if(lowStock.length){
    h+='<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:9px;font-weight:700;color:var(--rd);letter-spacing:1px;margin-bottom:4px">⚠️ LOW STOCK — REORDER NEEDED</div>';
    lowStock.forEach(function(m){
      h+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
      h+='<span style="color:var(--tx)">'+m.name+'</span>';
      h+='<div style="display:flex;gap:8px"><span style="color:var(--rd)">'+(m.onHand||0)+' '+(m.unit||'')+'</span>';
      h+='<button class="btn btn-pr btn-xs" onclick="vpOpenCreate({material:\''+m.name+'\',materialCategory:\''+( m.category||'')+'\',vendorName:\''+( m.vendorName||'')+'\'})">Reorder</button></div></div>';
    });
    h+='</div>';
  }

  // Materials table
  if(!mats.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)">No materials tracked yet. Add a material to start inventory tracking.</div>';

  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:10px">';
  h+='<thead><tr style="border-bottom:2px solid var(--bdr)">';
  ['Material','Category','Vendor','On Hand','On Order','Reorder At','Unit Cost','Lots','SQF'].forEach(function(l){
    h+='<th style="padding:6px 8px;text-align:left;color:var(--tx3)">'+l+'</th>';
  });
  h+='</tr></thead><tbody>';
  mats.forEach(function(m){
    var low=m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint;
    h+='<tr style="border-bottom:1px solid var(--bdr);background:'+(low?'rgba(239,68,68,.04)':'')+';cursor:pointer" onclick="vpOpenMaterialDetail(\''+m.id+'\')" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
    h+='<td style="padding:6px 8px;font-weight:600;color:'+(low?'var(--rd)':'var(--tx)')+'">'+m.name+(low?' ⚠':'')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(m.category||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx2)">'+(m.vendorName||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:'+(low?'var(--rd)':'var(--tx)')+'">'+( m.onHand!==undefined?m.onHand+' '+(m.unit||''):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--ac)">'+( m.onOrder?m.onOrder+' '+(m.unit||''):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+( m.reorderPoint!==undefined?m.reorderPoint+' '+(m.unit||''):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx2)">'+(m.unitCost?fmt$(m.unitCost):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(m.lotHistory?m.lotHistory.length:'0')+'</td>';
    h+='<td style="padding:6px 8px;text-align:center">'+(m.sqfTraceable?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">—</span>')+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

// Material Cost → Quote Engine Bridge
function vprCheckMatPricing(){
  var mats=getMaterialCache();
  var qs=typeof DB!=='undefined'?DB.quotes():[];
  var MATS_data=typeof MATS!=='undefined'?MATS:[];
  var mismatches=[];
  mats.forEach(function(m){
    if(!m.unitCost)return;
    // Find matching spec in MATS array (by name/vendor lookup)
    var specMatch=MATS_data.find(function(s){return s.v&&m.vendorName&&s.v.toLowerCase()===m.vendorName.toLowerCase()});
    if(specMatch&&specMatch.m&&Math.abs(specMatch.m-m.unitCost)/specMatch.m>0.05){
      // Cost differs >5% from quoted rate
      var affectedQs=qs.filter(function(q){return q.status==='draft'||q.status==='approval'}).length;
      if(affectedQs>0)mismatches.push({material:m.name,actual:m.unitCost,quoted:specMatch.m,quotes:affectedQs});
    }
  });
  return mismatches;
}

function vprFlagAffectedQuotes(){
  toast('Reviewing quotes for material cost changes...','ok');
  setTimeout(function(){
    notifyTeam('💡 Material costs have changed — review open quotes for repricing needed. Randy to approve before sending.');
    toast('Team notified about pricing review','ok');
  },800);
}

// ─── REPORTS VIEW ─────────────────────────────────────────────────
function vprReports(){
  var vendors=getVendorCache();
  var pos=getVpoCache();
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">Vendor Analytics & Reports</div>';
  h+='<div style="display:flex;gap:4px"><button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()">← Hub</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vprGenerateFullReport()">🤖 AI Report</button></div></div>';

  // Top vendors by spend
  var byVendor={};
  pos.forEach(function(p){
    if(!byVendor[p.vendorName])byVendor[p.vendorName]={pos:0,spend:0,received:0,avgLeadDays:[]};
    byVendor[p.vendorName].pos++;
    byVendor[p.vendorName].spend+=(p.total||0);
    if(p.status==='received'||p.status==='paid'){
      byVendor[p.vendorName].received++;
      if(p.sentAt&&p.receivedAt){
        byVendor[p.vendorName].avgLeadDays.push(Math.round((new Date(p.receivedAt)-new Date(p.sentAt))/(1000*60*60*24)));
      }
    }
  });
  var totalSpend=Object.values(byVendor).reduce(function(s,v){return s+v.spend},0);
  var sorted=Object.entries(byVendor).sort(function(a,b){return b[1].spend-a[1].spend});

  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">TOP VENDORS BY SPEND</div>';
  sorted.slice(0,8).forEach(function(entry){
    var name=entry[0],d=entry[1];
    var pct=totalSpend>0?Math.round(d.spend/totalSpend*100):0;
    var avgLead=d.avgLeadDays.length?Math.round(d.avgLeadDays.reduce(function(a,b){return a+b},0)/d.avgLeadDays.length):null;
    h+='<div style="margin-bottom:8px">';
    h+='<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">';
    h+='<span style="color:var(--tx)">'+name+'</span>';
    h+='<span style="color:var(--tx3)">'+d.pos+' POs · '+fmt$(d.spend)+(avgLead?' · '+avgLead+'d lead':'')+'</span></div>';
    h+='<div style="height:4px;background:var(--bg);border-radius:2px"><div style="height:100%;width:'+pct+'%;background:var(--ac);border-radius:2px"></div></div>';
    h+='</div>';
  });
  h+='</div>';

  // Spend by category
  var byCategory={};
  pos.forEach(function(p){
    var cat=p.materialCategory||'Other';
    if(!byCategory[cat])byCategory[cat]={count:0,spend:0};
    byCategory[cat].count++;byCategory[cat].spend+=(p.total||0);
  });
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">SPEND BY MATERIAL CATEGORY</div>';
  Object.entries(byCategory).sort(function(a,b){return b[1].spend-a[1].spend}).forEach(function(entry){
    var pct=totalSpend>0?Math.round(entry[1].spend/totalSpend*100):0;
    h+='<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:var(--tx)">'+entry[0]+'</span><span style="color:var(--tx3)">'+entry[1].count+' POs · '+fmt$(entry[1].spend)+'</span></div>';
    h+='<div style="height:4px;background:var(--bg);border-radius:2px"><div style="height:100%;width:'+pct+'%;background:var(--or);border-radius:2px"></div></div></div>';
  });
  h+='</div>';

  // Monthly spend trend (last 6 months)
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">MONTHLY SPEND TREND</div>';
  var months=[];for(var i=5;i>=0;i--){var d=new Date();d.setMonth(d.getMonth()-i);months.push({label:d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}),m:d.getMonth(),y:d.getFullYear(),spend:0})}
  pos.forEach(function(p){
    if(!p.createdAt)return;var d=new Date(p.createdAt);
    months.forEach(function(m){if(d.getMonth()===m.m&&d.getFullYear()===m.y)m.spend+=(p.total||0)});
  });
  var maxSpend=Math.max.apply(null,months.map(function(m){return m.spend}));
  h+='<div style="display:flex;align-items:flex-end;gap:8px;height:80px">';
  months.forEach(function(m){
    var h2=maxSpend>0?Math.round(m.spend/maxSpend*70):2;
    h+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">';
    h+='<div style="font-size:8px;color:var(--tx3)">'+( m.spend>0?'$'+Math.round(m.spend/1000)+'k':'—')+'</div>';
    h+='<div style="width:100%;background:var(--ac);border-radius:3px 3px 0 0;height:'+(h2||2)+'px"></div>';
    h+='<div style="font-size:8px;color:var(--tx3)">'+m.label+'</div></div>';
  });
  h+='</div></div>';
  return h;
}

// ─── COMMUNICATIONS INBOX ─────────────────────────────────────────
function vprInbox(){
  var vendors=getVendorCache();
  var allComms=[];
  vendors.forEach(function(v){
    (v.communications||[]).forEach(function(c){
      allComms.push(Object.assign({},c,{vendorId:v.id,vendorName:v.name}));
    });
  });
  allComms.sort(function(a,b){return new Date(b.at)-new Date(a.at)});

  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">Vendor Communications</div>';
  h+='<button class="btn btn-ghost btn-xs" onclick="VPR.view=\'hub\';renderVendorProfile()">← Hub</button></div>';

  if(!allComms.length)return h+'<div style="text-align:center;padding:40px;color:var(--tx3)">No communications logged yet</div>';

  var typeColors={email:'var(--ac)',call:'var(--gn)',meeting:'#a78bfa',note:'var(--tx3)',po_confirm:'var(--or)',dispute:'var(--rd)'};
  allComms.slice(0,30).forEach(function(c){
    var tc=typeColors[c.type]||'var(--tx3)';
    h+='<div style="background:var(--bg2);border-left:3px solid '+tc+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px;cursor:pointer" onclick="vprOpenProfile(\''+c.vendorId+'\')">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:3px">';
    h+='<div><span style="font-size:10px;font-weight:700;color:var(--ac)">'+c.vendorName+'</span>';
    h+='<span style="font-size:9px;color:'+tc+';margin-left:8px;text-transform:uppercase">'+( c.type||'note')+'</span>';
    h+='<span style="font-size:9px;color:var(--tx3);margin-left:8px">by '+c.by+'</span></div>';
    h+='<span style="font-size:9px;color:var(--tx3)">'+fmtDT(c.at)+'</span></div>';
    if(c.subject)h+='<div style="font-size:11px;font-weight:600;color:var(--tx)">'+c.subject+'</div>';
    h+='<div style="font-size:10px;color:var(--tx2)">'+c.text.substring(0,100)+(c.text.length>100?'...':'')+'</div>';
    h+='</div>';
  });
  return h;
}

// ─── VENDOR FORM (NEW / EDIT) ─────────────────────────────────────
function vprOpenNewVendor(){vprEditVendor(null)}

function vprEditVendor(vendorId){
  var v=vendorId?vendorGet(vendorId):{};
  var isNew=!vendorId;
  var h='<div class="modal-title">'+(isNew?'New Vendor':'Edit Vendor')+'</div>';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">BASIC INFO</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Vendor Name*','veName',v.name||'');
  h+=vField('Category','veCategory',v.category||'','select',VENDOR_CATEGORIES);
  h+=vField('Primary Contact','veContact',v.contact||'');
  h+=vField('Email*','veEmail',v.email||'','email');
  h+=vField('Phone','vePhone',v.phone||'');
  h+=vField('Website','veWebsite',v.website||'');
  h+=vField('Address','veAddress',v.address||'');
  h+=vField('Tax ID / W9','veTaxId',v.taxId||'');
  h+='</div>';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">PURCHASING</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Payment Terms','veTerms',v.terms||'Net 30','select',['Net 30','Net 45','Net 60','Due on Receipt','Prepaid','Net 15']);
  h+=vField('Payment Method','vePayment',v.paymentMethod||'','select',PAYMENT_METHODS);
  h+=vField('Avg Lead Time (days)','veLeadDays',v.avgLeadDays||'','number');
  h+=vField('Rating (1-5)','veRating',v.rating||'','select',['','1','2','3','4','5']);
  h+='</div>';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">SQF</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('SQF Status','veSQF',v.sqfStatus||'New - Pending Review','select',SQF_STATUSES);
  h+=vField('Cert Expiry','veCertExp',v.sqfCertExpiry||'','date');
  h+='</div>';
  h+=vField('Materials Supplied (comma-separated)','veMaterials',(v.materials||[]).join(', '));
  h+='<div style="margin:6px 0">'+vField('Notes','veNotes',v.notes||'','textarea','',2)+'</div>';
  h+='<button class="btn btn-pr" onclick="vprSaveVendor('+(vendorId?'\''+vendorId+'\'':'null')+')" style="width:100%;margin-top:8px">'+(isNew?'Create Vendor':'Save Changes')+'</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSaveVendor(vendorId){
  var name=gv('veName');if(!name)return toast('Vendor name required','err');
  var matsRaw=gv('veMaterials');var mats=matsRaw?matsRaw.split(',').map(function(m){return m.trim()}).filter(Boolean):[];
  var isNew=!vendorId;
  var existing=vendorId?vendorGet(vendorId):{};
  var v=Object.assign({},existing,{
    id:vendorId||'vendor_'+Date.now(),
    name:name,category:gv('veCategory'),contact:gv('veContact'),email:gv('veEmail'),
    phone:gv('vePhone'),website:gv('veWebsite'),address:gv('veAddress'),taxId:gv('veTaxId'),
    terms:gv('veTerms')||'Net 30',paymentMethod:gv('vePayment'),
    avgLeadDays:gf('veLeadDays')||null,rating:parseInt(gv('veRating'))||null,
    sqfStatus:gv('veSQF')||'New - Pending Review',sqfCertExpiry:gv('veCertExp')||null,
    materials:mats,notes:gv('veNotes')
  });
  if(isNew){v.createdAt=new Date().toISOString();v.createdBy=getUserName();v.deliveryPerformance={onTimeCount:0,lateCount:0,avgDaysLate:0};v.communications=[];v.contacts=[];v.certificates=[]}
  vendorSave(v).then(function(){
    toast((isNew?'Vendor created':'Vendor updated'),'ok');
    closeModal();
    if(isNew){VPR.view='hub';renderVendorProfile()}
    else{VPR.profileTab='overview';renderVendorProfile()}
  });
}

// ─── AI FEATURES ──────────────────────────────────────────────────

function vprGenerateScorecard(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  var vpos=vposByVendor(vendorId);
  var score=calcVendorScore(v);
  if(VPR.aiLoading)return toast('AI generating...','ok');
  VPR.aiLoading=true;toast('🤖 Generating AI scorecard...','ok');

  var context='Vendor: '+v.name+' ('+( v.category||'Supplier')+')'+
    '\nSQF Status: '+(v.sqfStatus||'Unverified')+
    '\nOverall Score: '+score.overall+'/100 (Grade '+scoreGrade(score.overall)+')'+
    '\nDelivery: '+score.delivery+'% | Quality: '+score.quality+'% | Pricing: '+score.pricing+'% | Response: '+score.responsiveness+'%'+
    '\nTotal POs: '+vpos.length+' | Deliveries: '+(v.deliveryPerformance?v.deliveryPerformance.onTimeCount+v.deliveryPerformance.lateCount:0)+
    '\nOn-time deliveries: '+(v.deliveryPerformance?v.deliveryPerformance.onTimeCount:0)+
    '\nAvg days late: '+(v.deliveryPerformance?v.deliveryPerformance.avgDaysLate||0:0)+
    '\nQuality rejections: '+(v.qualityRejections||0)+
    '\nTotal spend: '+vpos.reduce(function(s,p){return s+(p.total||0)},0).toFixed(2);

  try{
    toast('AI scorecard requires backend proxy — generating template...','info');
    VPR.aiLoading=false;
    var scoreText='<div style="color:var(--tx)"><div style="font-size:13px;font-weight:700;color:var(--ac);margin-bottom:8px">Vendor Scorecard: '+v.name+'</div>';
    scoreText+='<div style="margin-bottom:6px"><strong>Delivery Score:</strong> '+(score.delivery||'N/A')+'%</div>';
    scoreText+='<div style="margin-bottom:6px"><strong>Quality Score:</strong> '+(score.quality||'N/A')+'%</div>';
    scoreText+='<div style="margin-bottom:6px"><strong>Pricing Score:</strong> '+(score.pricing||'N/A')+'%</div>';
    scoreText+='<div style="margin-bottom:6px"><strong>Responsiveness:</strong> '+(score.responsiveness||'N/A')+'%</div>';
    scoreText+='<div style="margin-bottom:6px"><strong>Overall Grade:</strong> '+scoreGrade(score.overall)+' ('+score.overall+'/100)</div>';
    scoreText+='<div style="margin-top:10px;font-size:10px;color:var(--tx3)">Template scorecard — connect AI backend for full analysis.</div></div>';
    var text=scoreText;
    // Save to scorecard history
    var v2=vendorGet(vendorId)||{};
    v2.scorecardHistory=v2.scorecardHistory||[];
    v2.scorecardHistory.push({date:new Date().toISOString(),overall:score.overall,delivery:score.delivery,quality:score.quality,report:text});
    v2.lastScorecardAt=new Date().toISOString();
    vendorSave(v2).catch(function(e){console.warn('op:',e)});
    // Show in modal
    openModal('<div class="modal-title">AI Vendor Scorecard — '+v.name+'</div>'+
      '<div style="max-height:60vh;overflow-y:auto;font-size:11px">'+text+'</div>'+
      '<div style="display:flex;gap:6px;margin-top:10px">'+
      '<button class="btn btn-pr btn-xs" onclick="vprEmailScorecard(\''+vendorId+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Email to Vendor</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">Close</button></div>');
  }catch(e){VPR.aiLoading=false;toast('Scorecard error: '+e.message,'err')}
}

function vprAIDraftEmail(vendorId,emailType){
  var v=vendorGet(vendorId);if(!v)return;
  toast('✍️ Drafting email...','ok');
  var typeDescs={
    general:'A professional business email to a supplier',
    followup:'A polite follow-up on a pending PO or delivery',
    dispute:'A professional but firm email about a delivery or quality dispute',
    scorecard:'Sending the vendor their quarterly performance scorecard with constructive feedback',
    qualification:'Requesting updated SQF certificates or food safety documentation'
  };
  var vpos=vposByVendor(vendorId);
  var context='Vendor: '+v.name+' | Contact: '+(v.contact||'Team')+'<'+v.email+'> | Category: '+(v.category||'Supplier')+' | Open POs: '+vpos.filter(function(p){return p.status==='sent'}).length;

  try{
    toast('AI email draft requires backend proxy — generating template...','info');
    var body='Dear '+(v.contact||'Team')+',\n\nI hope this message finds you well. I am writing regarding our ongoing partnership.\n\n';
    if(emailType==='followup'){body+='I wanted to follow up on our pending purchase orders. Could you please provide an update on the current status and expected delivery timeline?\n\n';}
    else if(emailType==='dispute'){body+='I need to bring to your attention a concern regarding a recent order. We would appreciate the opportunity to discuss this matter and work toward a resolution.\n\n';}
    else if(emailType==='scorecard'){body+='As part of our vendor management program, I am sharing your quarterly performance review. We value our partnership and look forward to continued collaboration.\n\n';}
    else if(emailType==='qualification'){body+='As part of our SQF certification requirements, we need to request updated food safety documentation and certificates for our records.\n\n';}
    else{body+='Thank you for your continued partnership with Microflex Film Corporation. Please do not hesitate to reach out if you have any questions.\n\n';}
    body+='Best regards,\nRandy Vazquez\nCOO, Microflex Film Corporation';
    var subject={general:'Update from Microflex Film Corporation',followup:'Following Up — '+( vpos.filter(function(p){return p.status==='sent'})[0]?vpos.filter(function(p){return p.status==='sent'})[0].vpoNum:'Open PO'),dispute:'Concern Regarding Recent Order',scorecard:'Vendor Performance Review — Q'+Math.ceil((new Date().getMonth()+1)/3)+' '+new Date().getFullYear(),qualification:'SQF Documentation Request'}[emailType||'general'];
    openModal('<div class="modal-title">Email Draft — '+v.name+'</div>'+
      '<div style="font-size:10px;color:var(--tx3);margin-bottom:6px">To: '+v.email+' | Subject: '+subject+'</div>'+
      '<textarea id="vprEmailBody" rows="10" style="width:100%;padding:8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px;margin-bottom:8px">'+body+'</textarea>'+
      '<button class="btn btn-pr" onclick="vprSendVendorEmailDraft(\''+vendorId+'\',\''+subject+'\')" style="width:100%">Send via Gmail</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Discard</button>');
  }catch(e){toast('Email draft error','err')}
}

function vprSendVendorEmail(vendorId){
  var v=vendorGet(vendorId);if(!v)return;
  if(!v.email)return toast('No email on vendor profile','err');
  var types=[{k:'general',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> General Message'},{k:'followup',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> PO Follow-up'},{k:'dispute',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Dispute / Issue'},{k:'scorecard',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Scorecard'},{k:'qualification',l:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SQF Documentation Request'}];
  var h='<div class="modal-title">Email '+v.name+'</div>';
  h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">'+v.email+'</div>';
  types.forEach(function(t){
    h+='<button class="btn btn-ghost btn-xs" onclick="vprAIDraftEmail(\''+vendorId+'\',\''+t.k+'\')" style="width:100%;margin-bottom:4px;text-align:left">'+t.l+'</button>';
  });
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprSendVendorEmailDraft(vendorId,subject){
  var v=vendorGet(vendorId);if(!v)return;
  var body=document.getElementById('vprEmailBody');if(!body)return;

  var tokenPromise = typeof getGoogleToken==='function' ? getGoogleToken() : Promise.resolve(window.GTOKEN);
  tokenPromise.then(function(token){
    if(!token)return toast('Gmail token required — re-login','err');
    var raw='From: Randy Vazquez <randy@microflexfilm.com>\r\nTo: '+v.email+'\r\nSubject: '+subject+'\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'+body.value;
    var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({raw:encoded})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.id){
        // Log to vendor comms
        var v2=vendorGet(vendorId)||{};
        v2.communications=v2.communications||[];
        v2.communications.push({id:'comm_'+Date.now(),type:'email',subject:subject,text:body.value.substring(0,200),by:getUserName(),at:new Date().toISOString()});
        vendorSave(v2).catch(function(e){console.warn('op:',e)});
        toast('Email sent to '+v.email,'ok');closeModal();
      }else{toast('Gmail send failed','err')}
    }).catch(function(e){toast('Gmail error','err')});
  });
}

function vprEmailScorecard(vendorId){
  var v=vendorGet(vendorId);if(!v||!v.email)return toast('No email on vendor profile','err');
  vprAIDraftEmail(vendorId,'scorecard');
}

function vprGenerateFullReport(){
  toast('🤖 Generating full vendor analytics report...','ok');
  var vendors=getVendorCache();
  var pos=getVpoCache();
  var totalSpend=pos.reduce(function(s,p){return s+(p.total||0)},0);
  var context='Vendors: '+vendors.length+' | Total POs: '+pos.length+' | Total spend: $'+totalSpend.toFixed(0)+' | SQF approved: '+vendors.filter(function(v){return v.sqfStatus==='Approved'}).length;
  try{
    toast('AI report requires backend proxy — generating template...','info');
    var sqfApproved=vendors.filter(function(v){return v.sqfStatus==='Approved'}).length;
    var text='<div style="color:var(--tx)"><div style="font-size:13px;font-weight:700;color:var(--ac);margin-bottom:8px">Vendor Analytics Summary</div>';
    text+='<div style="margin-bottom:6px"><strong>Total Vendors:</strong> '+vendors.length+'</div>';
    text+='<div style="margin-bottom:6px"><strong>Total POs:</strong> '+pos.length+'</div>';
    text+='<div style="margin-bottom:6px"><strong>Total Spend:</strong> $'+totalSpend.toFixed(2)+'</div>';
    text+='<div style="margin-bottom:6px"><strong>SQF Approved:</strong> '+sqfApproved+' of '+vendors.length+' ('+(vendors.length?Math.round(sqfApproved/vendors.length*100):0)+'%)</div>';
    text+='<div style="margin-top:10px;font-weight:700;color:var(--or)">Action Items:</div>';
    text+='<div>1. Review vendors without SQF approval ('+(vendors.length-sqfApproved)+' remaining)</div>';
    text+='<div>2. Evaluate delivery performance across all active vendors</div>';
    text+='<div>3. Schedule quarterly scorecard reviews for top-spend vendors</div>';
    text+='<div style="margin-top:10px;font-size:10px;color:var(--tx3)">Template report — connect AI backend for full analysis.</div></div>';
    openModal('<div class="modal-title">AI Vendor Analytics Report</div><div style="max-height:60vh;overflow-y:auto;font-size:11px">'+text+'</div><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:10px">Close</button>');
  }catch(e){toast('Report error','err')}
}

// ─── SCHEDULE FOLLOW-UP (Calendar) ───────────────────────────────
function vprScheduleFollowUp(vendorId){
  var v=vendorGet(vendorId)||{};
  var h='<div class="modal-title">Schedule Follow-up</div>';
  h+=vField('Topic','vfuTopic','PO Follow-up — '+v.name);
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vField('Date','vfuDate','','date');
  h+=vField('Time','vfuTime','09:00','time');
  h+=vField('Duration (min)','vfuDur','30','number');
  h+=vField('Notes','vfuNotes','');
  h+='</div>';
  h+='<button class="btn btn-pr" onclick="vprCreateFollowUpEvent(\''+vendorId+'\')" style="width:100%;margin-top:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Add to Calendar</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vprCreateFollowUpEvent(vendorId){
  var v=vendorGet(vendorId)||{};
  var topic=gv('vfuTopic');var date=gv('vfuDate');var time=gv('vfuTime');var dur=gf('vfuDur')||30;var notes=gv('vfuNotes');
  if(!date)return toast('Date required','err');
  var desc='Vendor: '+v.name+(v.email?'\nEmail: '+v.email:'')+(notes?'\nNotes: '+notes:'');
  if(typeof createCalendarEvent==='function'){
    createCalendarEvent('📞 '+topic,desc,date,time,dur);
    // Also log to vendor comms
    var v2=vendorGet(vendorId)||{};
    v2.communications=v2.communications||[];
    v2.communications.push({id:'comm_'+Date.now(),type:'meeting',subject:topic,text:'Scheduled follow-up on '+date+(notes?' — '+notes:''),by:getUserName(),at:new Date().toISOString()});
    vendorSave(v2).catch(function(e){console.warn('op:',e)});
    toast('Follow-up scheduled','ok');closeModal();
  }else{toast('Calendar integration required','err')}
}

// ─── STALE PO AUTOMATIONS ─────────────────────────────────────────
function vprCheckStaleVendorPOs(){
  var pos=getVpoCache();
  var stale=pos.filter(function(p){
    return p.status==='sent'&&p.sentAt&&daysAgo(p.sentAt)>=3;
  });
  stale.forEach(function(p){
    // Create follow-up draft if not already done
    if(!p.followUpSent){
      var v=(getVendorCache()).find(function(v){return v.name===p.vendorName});
      if(v&&v.email){
        notifyTeam('⏰ STALE PO: '+p.vpoNum+' sent '+daysAgo(p.sentAt)+'d ago to '+p.vendorName+' — no update received. Consider follow-up.');
        fbDb.collection('vendorPOs').doc(p.id).update({followUpNotifiedAt:new Date().toISOString()}).catch(function(e){console.warn('op:',e)});
      }
    }
  });
}

// ─── AUTO ETA CALENDAR EVENTS ────────────────────────────────────
// Called when a PO is sent — creates calendar event for ETA
function vprAutoCreateETAEvent(vpo){
  if(!vpo.eta||typeof createCalendarEvent!=='function')return;
  var v=(getVendorCache()).find(function(v){return v.name===vpo.vendorName});
  var desc='VPO: '+vpo.vpoNum+'\nMaterial: '+vpo.material+'\nVendor: '+vpo.vendorName+( v&&v.email?'\nEmail: '+v.email:'')+'\nAmount: $'+vpo.total.toFixed(2);
  createCalendarEvent('📦 '+vpo.material+' — '+vpo.vendorName,desc,vpo.eta,'08:00',60);
  // Also create 3-day warning event
  var warnDate=new Date(vpo.eta);warnDate.setDate(warnDate.getDate()-3);
  if(warnDate>new Date()){
    var warnDateStr=warnDate.toISOString().split('T')[0];
    createCalendarEvent('⚠️ Follow-up: '+vpo.vpoNum+' ETA in 3 days','PO '+vpo.vpoNum+' expected delivery on '+vpo.eta,warnDateStr,'09:00',30);
  }
}

// ─── FIELD HELPER ────────────────────────────────────────────────
function vField(label,id,val,type,opts,extra){
  var h='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">'+label+'</div>';
  if(type==='select'){
    h+='<select id="'+id+'" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px">';
    h+='<option value="">— Select —</option>';
    (opts||[]).forEach(function(o){var v2=typeof o==='object'?o.id:o;var l=typeof o==='object'?o.name:o;h+='<option value="'+v2+'"'+(val===v2?' selected':'')+'>'+l+'</option>'});
    h+='</select>';
  }else if(type==='textarea'){
    h+='<textarea id="'+id+'" rows="'+(extra||2)+'" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px">'+( val||'')+'</textarea>';
  }else{
    h+='<input type="'+(type||'text')+'" id="'+id+'" value="'+(val||'')+'" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px">';
  }
  h+='</div>';
  return h;
}

function vprUploadDoc(vendorId){toast('Attach document: Upload to Drive and paste the link','ok')}

// ─── MFX EVENT BUS HOOKS ─────────────────────────────────────────
// Hook into vpo.approved to auto-create calendar ETA event
if(typeof MFX!=='undefined'){
  MFX.on('vpo.approved',function(d){
    if(!d||!d.vpoId)return;
    var vpo=(getVpoCache()).find(function(p){return p.id===d.vpoId});
    if(vpo)setTimeout(function(){vprAutoCreateETAEvent(vpo)},1500);
  });
}

// ─── EXPOSE GLOBALS ───────────────────────────────────────────────
window.VPR=VPR;
window.renderVendorProfile=renderVendorProfile;
// Register on MFX_VIEW_RENDERERS so goView('vendorprofile') works without wrapper interception
if(!window.MFX_VIEW_RENDERERS)window.MFX_VIEW_RENDERERS={};
window.MFX_VIEW_RENDERERS.vendorprofile=renderVendorProfile;
window.vprOpenProfile=vprOpenProfile;
window.vprOpenNewVendor=vprOpenNewVendor;
window.vprEditVendor=vprEditVendor;
window.vprSaveVendor=vprSaveVendor;
window.vprLogCommunication=vprLogCommunication;
window.vprSaveCommunication=vprSaveCommunication;
window.vprSendVendorEmail=vprSendVendorEmail;
window.vprSendVendorEmailDraft=vprSendVendorEmailDraft;
window.vprEmailScorecard=vprEmailScorecard;
window.vprGenerateScorecard=vprGenerateScorecard;
window.vprAIDraftEmail=vprAIDraftEmail;
window.vprGenerateFullReport=vprGenerateFullReport;
window.vprScheduleFollowUp=vprScheduleFollowUp;
window.vprCreateFollowUpEvent=vprCreateFollowUpEvent;
window.vprEditSQF=vprEditSQF;
window.vprSaveSQF=vprSaveSQF;
window.vprUploadCert=vprUploadCert;
window.vprSaveCert=vprSaveCert;
window.vprUploadDoc=vprUploadDoc;
window.vprAddContact=vprAddContact;
window.vprSaveContact=vprSaveContact;
window.vprLogVendorInvoice=vprLogVendorInvoice;
window.vprSaveVendorInvoice=vprSaveVendorInvoice;
window.vprLogInvoiceAmount=vprLogInvoiceAmount;
window.vprSaveInvoiceMatch=vprSaveInvoiceMatch;
window.vprCalPrev=vprCalPrev;
window.vprCalNext=vprCalNext;
window.vprCalToday=vprCalToday;
window.vprFlagAffectedQuotes=vprFlagAffectedQuotes;
window.vprAutoCreateETAEvent=vprAutoCreateETAEvent;
window.vprLoadCalendarEvents=vprLoadCalendarEvents;
window.vprCheckStaleVendorPOs=vprCheckStaleVendorPOs;
window.vprSaveInvoiceMatch_direct=vprSaveInvoiceMatch_direct;
function vprSendToContact(vendorId, email) {
  if (!email) return toast('No email address', 'err');
  var vendor = getVendorCache().find(function(v) { return v.id === vendorId; });
  var name = vendor ? vendor.name || vendor.company : 'Vendor';
  var subject = 'From Microflex Film Corporation';
  var body = 'Hello,\n\nThank you.\n\nBest regards,\n' + (typeof getUserName === 'function' ? getUserName() : 'MFX Team');
  var gmailUrl = 'https://mail.google.com/mail/?view=cm&to=' + encodeURIComponent(email) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  window.open(gmailUrl, '_blank');
}
window.vprSendToContact=vprSendToContact;
window.vField=vField;
window.calcVendorScore=calcVendorScore;
window.getApprovalTier=getApprovalTier;

// ─── INIT ─────────────────────────────────────────────────────────
function vprInit(){
  var origGoView=window.goView;
  if(typeof origGoView==='function'){
    window.goView=function(v){
      origGoView(v);
      if(v==='vendorprofile'){renderVendorProfile()}
    };
  }
  // Daily stale PO check
  setTimeout(vprCheckStaleVendorPOs,10000);
  // Listen for vendor cache updates
  if(typeof fbDb!=='undefined'){
    fbDb.collection('vendors').orderBy('name').onSnapshot(function(s){
      window._vendorCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
      if(S&&S.view==='vendorprofile')renderVendorProfile();
      // Update approval badge
      var pend=(window._vpoCache||[]).filter(function(v){return v.status==='pending_approval'}).length;
      var b=document.getElementById('vpoBadge');if(b){b.textContent=pend;b.style.display=pend>0?'flex':'none'}
    },function(e){console.warn('vendors listener:',e.message)});
  }
  console.log('✅ MFX Vendor Profile System v2 initialized');
}

if(typeof fbDb!=='undefined'){
  setTimeout(vprInit,3000);
}else{
  document.addEventListener('DOMContentLoaded',function(){setTimeout(vprInit,3000)});
}

})();
