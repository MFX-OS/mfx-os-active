// ══════════════════════════════════════════════════════════════════
// MFX OS — VENDOR PO SYSTEM v2.0 — NEXT LEVEL
// Full multimedia vendor profiles, health scoring, communication
// history, calendar integration, invoice matching, SQF traceability,
// AI drafting, auto-reorder triggers, spend analytics
//
// Collections: vendorPOs, vendors, materials, activity, threads,
//              jobTickets (jtPOs[]), customers (materialActivity[]),
//              vendorComms, materialLots, calendar
//
// Requires: core.js, production.js, orders.js, modules.js, jsPDF
// INSTALL:
//   <script src="js/vendor-pos-v2.js"></script>
//   <div id="v-vendorpos" class="view"></div>
//   Hamburger: goView('vendorpos')
// ══════════════════════════════════════════════════════════════════

(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ─── CONSTANTS ───────────────────────────────────────────────────

// CEO_CODE removed — approval now uses server-side role check via ceoApprove Cloud Function

var STATUS_COLORS={
  draft:'var(--tx3)',pending_approval:'var(--or)',approved:'var(--ac)',
  rejected:'var(--rd)',sent:'#a78bfa',received:'var(--gn)',paid:'var(--tx3)'
};
var STATUS_LABELS={
  draft:'Draft',pending_approval:'Pending Approval',approved:'Approved',
  rejected:'Rejected',sent:'Sent to Vendor',received:'Received',paid:'Paid'
};

var MATERIAL_CATEGORIES=['Substrate','Ink','Plates','Laminate','Coating','Adhesive','Core/Rolls','Packaging','Chemicals','Other'];
var PAYMENT_TERMS=['Net 30','Net 45','Net 60','Due on Receipt','Prepaid','Net 15','Net 90'];
var UNITS=['ft','rolls','sheets','oz','lbs','gallons','each','sq ft','meters','liters','kg'];
var HEALTH_WEIGHTS={onTimeDelivery:35,qualityScore:25,responsiveness:20,pricingStability:10,documentCompliance:10};

var MFX_ADDRESS={
  name:'Microflex Film Corporation',address:'4130 Garner Rd',city:'Riverside, CA 92501',
  phone:'(909) 360-9066',email:'Quotes@MicroflexFilm.com',web:'microflexfilm.com',
  from:'randy@microflexfilm.com',contact:'Randy Vazquez',title:'COO'
};

// ─── STATE ───────────────────────────────────────────────────────

var VP={
  tab:'dashboard',filterStatus:'all',filterVendor:'all',search:'',
  vendorTab:'overview',  // overview|pos|comms|lots|invoices|calendar|docs|health
  materialTab:'overview',
  modalVpoId:null,vpoModalTab:'overview',
  vendorModalId:null,materialModalId:null
};

// ─── CACHES ──────────────────────────────────────────────────────

var _vpoCache=[];var _vendorCache=[];var _materialCache=[];
var _commCache=[];var _lotCache=[];var _invoiceCache=[];
var _vpoReady=false;

// ─── FIRESTORE LISTENERS ─────────────────────────────────────────

function startVPOListeners(){
  var reg=typeof mfxRegisterListener==='function'?mfxRegisterListener:function(){};
  reg('vendorPOs',fbDb.collection('vendorPOs').orderBy('createdAt','desc').onSnapshot(function(s){
    _vpoCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    _vpoReady=true;
    if(S&&S.view==='vendorpos')renderVendorPOs();
    vpUpdateApprovalBadge();
  },function(e){console.warn('vendorPOs:',e.message)}));

  reg('vendors',fbDb.collection('vendors').orderBy('name').onSnapshot(function(s){
    _vendorCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S&&S.view==='vendorpos'&&VP.tab==='vendors')renderVendorPOs();
  },function(e){console.warn('vendors:',e.message)}));

  reg('materials',fbDb.collection('materials').orderBy('name').onSnapshot(function(s){
    _materialCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S&&S.view==='vendorpos'&&VP.tab==='materials')renderVendorPOs();
  },function(e){console.warn('materials:',e.message)}));

  reg('vendorComms',fbDb.collection('vendorComms').orderBy('at','desc').onSnapshot(function(s){
    _commCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
  },function(e){console.warn('vendorComms:',e.message)}));

  reg('materialLots',fbDb.collection('materialLots').orderBy('receivedAt','desc').onSnapshot(function(s){
    _lotCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
  },function(e){console.warn('materialLots:',e.message)}));

  reg('vendorInvoices',fbDb.collection('vendorInvoices').orderBy('createdAt','desc').onSnapshot(function(s){
    _invoiceCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
  },function(e){console.warn('vendorInvoices:',e.message)}));
}

// ─── DATA ────────────────────────────────────────────────────────

function vpoAll(){return _vpoCache||[]}
function vpoGet(id){return _vpoCache.find(function(v){return v.id===id})}
function vpoVendorGet(id){return _vendorCache.find(function(v){return v.id===id})}
function materialGet(id){return _materialCache.find(function(m){return m.id===id})}
function vpoPending(){return _vpoCache.filter(function(v){return v.status==='pending_approval'})}
function vendorComms(vendorId){return _commCache.filter(function(c){return c.vendorId===vendorId})}
function vendorLots(vendorId){return _lotCache.filter(function(l){return l.vendorId===vendorId})}
function vendorInvoices(vendorId){return _invoiceCache.filter(function(i){return i.vendorId===vendorId})}

function vpoSave(vpo){vpo.updatedAt=new Date().toISOString();vpo.updatedBy=getUserName();return fbDb.collection('vendorPOs').doc(vpo.id).set(vpo,{merge:true})}
function vpoVendorSave(v){v.updatedAt=new Date().toISOString();return fbDb.collection('vendors').doc(v.id).set(v,{merge:true})}
function materialSave(m){m.updatedAt=new Date().toISOString();return fbDb.collection('materials').doc(m.id).set(m,{merge:true})}

function genVPONumLocal(){var d=new Date();var n=parseInt(localStorage.getItem('mfx_vpoctr')||'0')+1;localStorage.setItem('mfx_vpoctr',n);return'VPO'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+'-'+String(n).padStart(3,'0')}
function genVPONum(){return genVPONumLocal()}
function upgradeVPONum(vpo){if(typeof requestServerNumber!=='function')return;var tempNum=vpo.vpoNum;requestServerNumber('vendorPO',function(){return tempNum}).then(function(sn){if(sn&&sn!==tempNum){vpo.vpoNum=sn;vpoSave(vpo).catch(function(e){console.warn('vpoSave',e)})}}).catch(function(e){console.warn('vpoUpgradeNum',e)})}
function genLotNum(){return'LOT-'+Date.now().toString().slice(-8)}

// ─── VENDOR HEALTH SCORE ─────────────────────────────────────────
// Composite 0-100 score based on delivery, quality, responsiveness

function vpCalcVendorHealth(vendor){
  if(!vendor)return null;
  var dp=vendor.deliveryPerformance||{};
  var total=( dp.onTimeCount||0)+(dp.lateCount||0);
  if(!total)return null; // insufficient data

  var onTimePct=total>0?((dp.onTimeCount||0)/total*100):100;
  var qualityScore=vendor.qualityScore||100;
  var responsiveness=vendor.responsivenessScore||80;
  var pricingStability=vendor.pricingStabilityScore||90;
  var docCompliance=vendor.docComplianceScore||85;

  var score=Math.round(
    onTimePct*HEALTH_WEIGHTS.onTimeDelivery/100+
    qualityScore*HEALTH_WEIGHTS.qualityScore/100+
    responsiveness*HEALTH_WEIGHTS.responsiveness/100+
    pricingStability*HEALTH_WEIGHTS.pricingStability/100+
    docCompliance*HEALTH_WEIGHTS.documentCompliance/100
  );
  return Math.min(100,Math.max(0,score));
}

function healthColor(s){return s>=75?'var(--gn)':s>=50?'var(--or)':'var(--rd)'}
function healthLabel(s){return s>=75?'Excellent':s>=50?'Acceptable':'At Risk'}

// ─── APPROVAL BADGE ──────────────────────────────────────────────

function vpUpdateApprovalBadge(){
  var n=vpoPending().length;
  var badge=$('vpoBadge');
  if(badge){badge.textContent=n;badge.style.display=n>0?'flex':'none'}
}

// ─── UTILS ───────────────────────────────────────────────────────

// fmt$, fmtDate, fmtDT, daysUntil, daysAgo — canonical definitions in vendor-profile.js
function fmt$(n){return'$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtDate(d){if(!d)return'\u2014';var dt=new Date(d);return isNaN(dt)?d:dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}
function fmtDT(d){if(!d)return'\u2014';var dt=new Date(d);return isNaN(dt)?d:dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
function daysUntil(d){if(!d)return null;return Math.round((new Date(d)-new Date())/(1000*60*60*24))}
function daysAgo(d){if(!d)return null;return Math.round((new Date()-new Date(d))/(1000*60*60*24))}

function vpF(label,id,val,type,opts,extra){
  var h='<div><div style="font-size:9px;color:var(--tx3);margin-bottom:2px">'+label+'</div>';
  if(type==='select'){
    h+='<select id="'+id+'" '+(extra||'')+' style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px">';
    h+='<option value="">— Select —</option>';
    (opts||[]).forEach(function(o){var v=typeof o==='object'?o.id:o;var l=typeof o==='object'?o.name:o;h+='<option value="'+v+'"'+(val===v?' selected':'')+'>'+l+'</option>'});
    h+='</select>';
  }else if(type==='textarea'){
    h+='<textarea id="'+id+'" rows="'+(extra||2)+'" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px">'+(val||'')+'</textarea>';
  }else{
    h+='<input type="'+(type||'text')+'" id="'+id+'" value="'+(val||'')+'" '+(extra||'')+' style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:11px">';
  }
  return h+'</div>';
}
// gv, gf — canonical definitions in vendor-profile.js

// ─── MAIN RENDER ─────────────────────────────────────────────────

function renderVendorPOs(){
  var el=$('v-vendorpos');if(!el)return;
  var pending=vpoPending();

  var tabs=[
    {k:'dashboard',l:'Dashboard',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="1" width="22" height="22" rx="2" ry="2"/><line x1="1" y1="12" x2="23" y2="12"/><line x1="12" y1="1" x2="12" y2="23"/></svg>'},
    {k:'all',l:'All POs',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',count:vpoAll().length},
    {k:'pending',l:'Approval',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',count:pending.length,alert:pending.length>0},
    {k:'vendors',l:'Vendors',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',count:_vendorCache.length},
    {k:'materials',l:'Materials',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',count:_materialCache.length},
    {k:'invoices',l:'Invoices',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',count:_invoiceCache.length},
    {k:'analytics',l:'Analytics',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'}
  ];

  var h='<div style="display:flex;gap:0;margin-bottom:10px;border-bottom:2px solid var(--bdr);overflow-x:auto">';
  tabs.forEach(function(t){
    var active=VP.tab===t.k;
    h+='<div onclick="VP.tab=\''+t.k+'\';renderVendorPOs()" style="padding:9px 10px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(active?'var(--ac)':'transparent')+';color:'+(active?'var(--ac)':'var(--tx3)')+'">'+t.ico+' '+t.l;
    if(t.count!==undefined)h+=' <span style="background:'+(t.alert?'var(--or)':'var(--bg3)')+';color:'+(t.alert?'#000':'var(--tx3)')+';padding:1px 5px;border-radius:8px;font-size:9px">'+t.count+'</span>';
    h+='</div>';
  });
  h+='</div>';

  h+='<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center">';
  h+='<button class="btn btn-pr btn-xs" onclick="vpOpenCreate()">+ New PO</button>';
  if(VP.tab==='vendors')h+='<button class="btn btn-ghost btn-xs" onclick="vpOpenCreateVendor()">+ Vendor</button>';
  if(VP.tab==='materials')h+='<button class="btn btn-ghost btn-xs" onclick="vpOpenCreateMaterial()">+ Material</button>';
  if(VP.tab==='invoices')h+='<button class="btn btn-ghost btn-xs" onclick="vpOpenCreateInvoice()">+ Invoice</button>';
  h+='</div>';

  if(VP.tab==='dashboard')h+=vpTabDashboard();
  else if(VP.tab==='all')h+=vpTabAll();
  else if(VP.tab==='pending')h+=vpTabPending();
  else if(VP.tab==='vendors')h+=vpTabVendors();
  else if(VP.tab==='materials')h+=vpTabMaterials();
  else if(VP.tab==='invoices')h+=vpTabInvoices();
  else if(VP.tab==='analytics')h+=vpTabAnalytics();

  el.innerHTML=h;
}

// ─── DASHBOARD ───────────────────────────────────────────────────

function vpTabDashboard(){
  var all=vpoAll();
  var pending=all.filter(function(v){return v.status==='pending_approval'});
  var open=all.filter(function(v){return v.status==='sent'||v.status==='approved'});
  var overdue=all.filter(function(v){return v.status==='sent'&&v.eta&&daysUntil(v.eta)<0});
  var ytdSpend=all.filter(function(v){return(v.status==='received'||v.status==='paid')&&v.createdAt&&new Date(v.createdAt).getFullYear()===new Date().getFullYear()}).reduce(function(s,v){return s+(v.total||0)},0);
  var lowStock=_materialCache.filter(function(m){return m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint});
  var atRiskVendors=_vendorCache.filter(function(v){var h=vpCalcVendorHealth(v);return h!==null&&h<50});

  var h='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">';
  function kpi(ico,l,v,sub,c){return'<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px"><div style="font-size:9px;color:var(--tx3);letter-spacing:1px;margin-bottom:4px">'+ico+' '+l+'</div><div style="font-size:22px;font-weight:700;color:'+(c||'var(--tx)')+'">'+v+'</div><div style="font-size:9px;color:var(--tx3)">'+sub+'</div></div>'}
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>','PENDING APPROVAL',pending.length,'Needs your review','var(--or)');
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>','YTD SPEND',fmt$(ytdSpend),new Date().getFullYear()+' total','var(--gn)');
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>','LOW STOCK',lowStock.length,'Below reorder point',lowStock.length?'var(--or)':'var(--tx)');
  h+=kpi('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>','VENDOR HEALTH',atRiskVendors.length+' at risk',_vendorCache.length+' total vendors',atRiskVendors.length?'var(--rd)':'var(--gn)');
  h+='</div>';

  // Pending approval queue
  if(pending.length){
    h+='<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> AWAITING YOUR APPROVAL</div>';
    pending.forEach(function(v){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="vpOpenDetail(\''+v.id+'\')">';
      h+='<div><span style="font-size:11px;font-weight:700;color:var(--tx)">'+v.vpoNum+'</span><span style="font-size:10px;color:var(--tx3);margin-left:6px">'+v.vendorName+' · '+v.material+'</span></div>';
      h+='<div style="display:flex;gap:8px"><span style="font-size:11px;color:var(--tx)">'+fmt$(v.total)+'</span>';
      h+='<button class="btn btn-approve btn-xs" onclick="event.stopPropagation();vpCEOApprove(\''+v.id+'\')" style="font-size:9px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve</button>';
      h+='<button class="btn btn-reject btn-xs" onclick="event.stopPropagation();vpCEOReject(\''+v.id+'\')" style="font-size:9px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div></div>';
    });
    h+='</div>';
  }

  // Overdue ETAs
  if(overdue.length){
    h+='<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--rd);letter-spacing:1px;margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> OVERDUE ETAs</div>';
    overdue.forEach(function(v){var d=Math.abs(daysUntil(v.eta));h+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:10px;cursor:pointer" onclick="vpOpenDetail(\''+v.id+'\')" ><span style="color:var(--tx)">'+v.vpoNum+' · '+v.vendorName+'</span><span style="color:var(--rd)">'+d+'d late</span></div>'});
    h+='</div>';
  }

  // Low stock reorder alerts
  if(lowStock.length){
    h+='<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> REORDER NEEDED</div>';
    lowStock.forEach(function(m){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
      h+='<span style="color:var(--tx)">'+m.name+'</span>';
      h+='<div style="display:flex;gap:8px"><span style="color:var(--or)">'+(m.onHand||0)+' '+( m.unit||'')+' on hand</span>';
      h+='<button class="btn btn-ghost btn-xs" onclick="vpAutoReorder(\''+m.id+'\')" style="font-size:9px">Auto-Reorder</button></div></div>';
    });
    h+='</div>';
  }

  // At-risk vendors
  if(atRiskVendors.length){
    h+='<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px;margin-bottom:10px">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--rd);letter-spacing:1px;margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> VENDOR HEALTH ALERT</div>';
    atRiskVendors.forEach(function(v){var h2=vpCalcVendorHealth(v);h+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:10px;cursor:pointer" onclick="vpOpenVendorProfile(\''+v.id+'\')" ><span style="color:var(--tx)">'+v.name+'</span><span style="color:'+healthColor(h2)+'">'+h2+' — '+healthLabel(h2)+'</span></div>'});
    h+='</div>';
  }

  // Upcoming calendar — ETAs in next 7 days
  var upcoming=open.filter(function(v){var d=daysUntil(v.eta);return d!==null&&d>=0&&d<=7}).sort(function(a,b){return daysUntil(a.eta)-daysUntil(b.eta)});
  if(upcoming.length){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> INCOMING THIS WEEK</div>';
    upcoming.forEach(function(v){var d=daysUntil(v.eta);h+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px;cursor:pointer" onclick="vpOpenDetail(\''+v.id+'\')">'+'<span style="color:var(--tx)">'+v.vpoNum+' · '+v.material+'</span>'+'<span style="color:'+(d===0?'var(--rd)':d<=2?'var(--or)':'var(--gn)')+'">'+(d===0?'Today':d+'d')+'</span></div>'});
    h+='</div>';
  }
  return h;
}

// ─── ALL POs TAB ──────────────────────────────────────────────────

function vpTabAll(){
  var list=vpoAll();
  var h='<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">';
  h+='<input placeholder="Search..." value="'+VP.search+'" oninput="VP.search=this.value;renderVendorPOs()" style="flex:1;min-width:100px;padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px">';
  h+='<select onchange="VP.filterStatus=this.value;renderVendorPOs()" style="padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px"><option value="all">All Status</option>';
  Object.keys(STATUS_LABELS).forEach(function(s){h+='<option value="'+s+'"'+(VP.filterStatus===s?' selected':'')+'>'+STATUS_LABELS[s]+'</option>'});
  h+='</select></div>';

  if(VP.search)list=list.filter(function(v){var q=VP.search.toLowerCase();return(v.vpoNum+' '+v.vendorName+' '+v.material+' '+(v.forJTNum||'')).toLowerCase().indexOf(q)>-1});
  if(VP.filterStatus!=='all')list=list.filter(function(v){return v.status===VP.filterStatus});

  if(!list.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)">No POs match</div>';

  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--bdr)">';
  ['VPO#','Vendor','Material','Qty','Total','ETA','Status',''].forEach(function(l){h+='<th style="padding:6px 8px;text-align:left;color:var(--tx3)">'+l+'</th>'});
  h+='</tr></thead><tbody>';
  list.forEach(function(v){
    var sc=STATUS_COLORS[v.status]||'var(--tx3)';var d=daysUntil(v.eta);
    h+='<tr style="border-bottom:1px solid var(--bdr);cursor:pointer" onclick="vpOpenDetail(\''+v.id+'\')" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
    h+='<td style="padding:6px 8px;color:var(--ac);font-weight:700">'+v.vpoNum+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx)">'+v.vendorName+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx2);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(v.material||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(v.quantity||'—')+' '+(v.unit||'')+'</td>';
    h+='<td style="padding:6px 8px;font-weight:700">'+fmt$(v.total)+'</td>';
    h+='<td style="padding:6px 8px;color:'+(d===null?'var(--tx3)':d<0?'var(--rd)':d<=3?'var(--or)':'var(--tx3)')+'">'+fmtDate(v.eta)+'</td>';
    h+='<td style="padding:6px 8px"><span style="font-size:9px;color:'+sc+';border:1px solid '+sc+';padding:2px 6px;border-radius:4px">'+STATUS_LABELS[v.status]+'</span></td>';
    h+='<td style="padding:6px 8px">';
    if(v.status==='pending_approval')h+='<button class="btn btn-approve btn-xs" onclick="event.stopPropagation();vpCEOApprove(\''+v.id+'\')" style="font-size:9px">Approve</button>';
    if(v.status==='sent')h+='<button class="btn btn-gn btn-xs" onclick="event.stopPropagation();vpReceiveModal(\''+v.id+'\')" style="font-size:9px">Receive</button>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

// ─── PENDING TAB ─────────────────────────────────────────────────

function vpTabPending(){
  var pending=vpoPending();
  if(!pending.length)return'<div style="text-align:center;padding:40px;color:var(--gn);font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Nothing pending approval</div>';
  var h='<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">'+pending.length+' PO'+(pending.length>1?'s':'')+' awaiting CEO approval.</div>';
  pending.forEach(function(v){
    var h2='<div style="background:var(--bg2);border:1px solid rgba(245,158,11,.3);border-left:4px solid var(--or);border-radius:0 8px 8px 0;padding:12px;margin-bottom:10px">';
    h2+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
    h2+='<div><div style="font-size:14px;font-weight:700;color:var(--tx)">'+v.vpoNum+'</div>';
    h2+='<div style="font-size:11px;color:var(--tx3)">By '+( v.submittedBy||'—')+' · '+fmtDate(v.submittedForApprovalAt)+'</div></div>';
    h2+='<div style="font-size:20px;font-weight:700;color:var(--or)">'+fmt$(v.total)+'</div></div>';
    h2+='<div style="background:var(--bg3);border-radius:6px;padding:8px;margin-bottom:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px">';
    function r(l,val){return'<div><span style="color:var(--tx3)">'+l+': </span><span style="color:var(--tx)">'+val+'</span></div>'}
    h2+=r('Vendor',v.vendorName||'—');h2+=r('Material',v.material||'—');
    h2+=r('Qty',(v.quantity||'—')+' '+(v.unit||''));h2+=r('Terms',v.terms||'Net 30');
    h2+=r('ETA',fmtDate(v.eta));if(v.forJTNum)h2+=r('Job Ticket',v.forJTNum);
    h2+='</div>';
    if(v.notes)h2+='<div style="font-size:10px;color:var(--tx2);padding:6px;background:var(--bg3);border-radius:4px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> '+v.notes+'</div>';
    h2+='<div style="display:flex;gap:6px">';
    h2+='<button class="btn btn-approve btn-xs" onclick="vpCEOApprove(\''+v.id+'\')" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve</button>';
    h2+='<button class="btn btn-reject btn-xs" onclick="vpCEOReject(\''+v.id+'\')" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject</button>';
    h2+='<button class="btn btn-ghost btn-xs" onclick="vpPreviewPDF(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> PDF</button>';
    h2+='<button class="btn btn-ghost btn-xs" onclick="vpOpenDetail(\''+v.id+'\')">Detail</button></div></div>';
    h+=h2;
  });
  return h;
}

// ─── VENDOR TAB ──────────────────────────────────────────────────

function vpTabVendors(){
  if(!_vendorCache.length)return'<div style="text-align:center;padding:30px;color:var(--tx3)"><div style="font-size:32px;margin-bottom:8px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><p>No vendors yet</p><button class="btn btn-pr btn-xs" onclick="vpOpenCreateVendor()">+ Add Vendor</button></div>';
  var h='';
  _vendorCache.forEach(function(v){
    var vpos=_vpoCache.filter(function(p){return p.vendorName===v.name});
    var totalSpend=vpos.filter(function(p){return p.status==='paid'||p.status==='received'}).reduce(function(s,p){return s+(p.total||0)},0);
    var health=vpCalcVendorHealth(v);
    var dp=v.deliveryPerformance||{};
    var onT=(dp.onTimeCount||0);var late=(dp.lateCount||0);var total=onT+late;

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;margin-bottom:8px;overflow:hidden;cursor:pointer" onclick="vpOpenVendorProfile(\''+v.id+'\')">';
    // Health bar at top
    if(health!==null){
      h+='<div style="height:3px;background:var(--bg)"><div style="height:100%;width:'+health+'%;background:'+healthColor(health)+'"></div></div>';
    }
    h+='<div style="padding:12px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">';
    h+='<div><div style="font-size:13px;font-weight:700;color:var(--tx)">'+v.name+'</div>';
    h+='<div style="font-size:10px;color:var(--tx3)">'+( v.contact||'—')+' · '+(v.email||'—')+'</div></div>';
    if(health!==null){
      h+='<div style="text-align:right"><div style="font-size:16px;font-weight:700;color:'+healthColor(health)+'">'+health+'</div><div style="font-size:9px;color:var(--tx3)">'+healthLabel(health)+'</div></div>';
    }
    h+='</div>';
    h+='<div style="display:flex;gap:12px;font-size:10px;color:var(--tx3)">';
    h+='<span>'+vpos.length+' POs</span>';
    h+='<span>Spend: '+fmt$(totalSpend)+'</span>';
    h+='<span>Terms: '+(v.terms||'—')+'</span>';
    if(total)h+='<span style="color:'+(late>onT?'var(--rd)':onT>late?'var(--gn)':'var(--or)')+'">'+onT+'/'+(onT+late)+' on-time</span>';
    h+='</div></div></div>';
  });
  return h;
}

// ─── MATERIALS TAB ───────────────────────────────────────────────

function vpTabMaterials(){
  var lowStock=_materialCache.filter(function(m){return m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint});
  var h='';
  if(lowStock.length){
    h+='<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:8px;margin-bottom:10px;font-size:10px;color:var(--or)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> '+lowStock.length+' material'+(lowStock.length>1?'s':'')+' below reorder point</div>';
  }
  if(!_materialCache.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)"><p>No materials tracked</p><button class="btn btn-pr btn-xs" onclick="vpOpenCreateMaterial()">+ Add Material</button></div>';

  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--bdr)">';
  ['Material','Category','On Hand','On Order','Reorder At','Vendor','Unit $','SQF'].forEach(function(l){h+='<th style="padding:6px 8px;text-align:left;color:var(--tx3);white-space:nowrap">'+l+'</th>'});
  h+='</tr></thead><tbody>';
  _materialCache.forEach(function(m){
    var low=m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint;
    h+='<tr style="border-bottom:1px solid var(--bdr);cursor:pointer;background:'+(low?'rgba(239,68,68,.04)':'')+'" onclick="vpOpenMaterialProfile(\''+m.id+'\')" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
    h+='<td style="padding:6px 8px;font-weight:600;color:'+(low?'var(--rd)':'var(--tx)')+'">'+m.name+(low?' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>':'')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(m.category||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:'+(low?'var(--rd)':'var(--tx)')+'">'+(m.onHand!==undefined?m.onHand+' '+(m.unit||''):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--ac)">'+(m.onOrder?m.onOrder+' '+(m.unit||''):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+(m.reorderPoint!==undefined?m.reorderPoint+' '+(m.unit||''):'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx2)">'+(m.vendorName||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx2)">'+(m.unitCost?fmt$(m.unitCost):'—')+'</td>';
    h+='<td style="padding:6px 8px;text-align:center">'+(m.sqfTraceable?'<span style="color:var(--gn)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></span>':'—')+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

// ─── INVOICES TAB ────────────────────────────────────────────────

function vpTabInvoices(){
  var unmatched=_invoiceCache.filter(function(i){return!i.matchedVpoId});
  var h='';
  if(unmatched.length){
    h+='<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:8px;margin-bottom:10px;font-size:10px;color:var(--or)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> '+unmatched.length+' unmatched invoice'+(unmatched.length>1?'s':'')+' — please match to POs</div>';
  }
  if(!_invoiceCache.length)return h+'<div style="text-align:center;padding:30px;color:var(--tx3)"><p>No invoices logged</p><button class="btn btn-pr btn-xs" onclick="vpOpenCreateInvoice()">+ Log Invoice</button></div>';

  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--bdr)">';
  ['Invoice #','Vendor','Amount','Date','Due','Matched PO','Status',''].forEach(function(l){h+='<th style="padding:6px 8px;text-align:left;color:var(--tx3)">'+l+'</th>'});
  h+='</tr></thead><tbody>';
  _invoiceCache.forEach(function(inv){
    var matched=inv.matchedVpoId?vpoGet(inv.matchedVpoId):null;
    var dueD=daysUntil(inv.dueDate);
    h+='<tr style="border-bottom:1px solid var(--bdr)">';
    h+='<td style="padding:6px 8px;color:var(--ac);font-weight:700">'+(inv.invoiceNum||'—')+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx)">'+(inv.vendorName||'—')+'</td>';
    h+='<td style="padding:6px 8px;font-weight:700">'+fmt$(inv.amount)+'</td>';
    h+='<td style="padding:6px 8px;color:var(--tx3)">'+fmtDate(inv.invoiceDate)+'</td>';
    h+='<td style="padding:6px 8px;color:'+(dueD===null?'var(--tx3)':dueD<0?'var(--rd)':dueD<=7?'var(--or)':'var(--tx3)')+'">'+fmtDate(inv.dueDate)+'</td>';
    h+='<td style="padding:6px 8px;color:var(--ac)">'+(matched?matched.vpoNum:'<span style="color:var(--or)">Unmatched</span>')+'</td>';
    h+='<td style="padding:6px 8px"><span style="font-size:9px;color:'+(inv.paid?'var(--gn)':'var(--or)')+'">'+(inv.paid?'Paid':'Open')+'</span></td>';
    h+='<td style="padding:6px 8px">';
    if(!inv.matchedVpoId)h+='<button class="btn btn-ghost btn-xs" onclick="vpMatchInvoice(\''+inv.id+'\')" style="font-size:9px">Match PO</button>';
    if(!inv.paid)h+='<button class="btn btn-gn btn-xs" onclick="vpPayInvoice(\''+inv.id+'\')" style="font-size:9px;margin-left:2px">Pay</button>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────

function vpTabAnalytics(){
  var all=vpoAll();
  var paid=all.filter(function(v){return v.status==='paid'||v.status==='received'});
  var totalSpend=paid.reduce(function(s,v){return s+(v.total||0)},0);

  // Monthly spend last 6 months
  var monthly={};
  for(var i=5;i>=0;i--){var d=new Date();d.setMonth(d.getMonth()-i);var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');monthly[key]=0}
  paid.forEach(function(v){if(!v.createdAt)return;var d=new Date(v.createdAt);var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(monthly.hasOwnProperty(key))monthly[key]+=(v.total||0)});
  var months=Object.keys(monthly);var maxM=Math.max.apply(null,months.map(function(k){return monthly[k]}));

  var h='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:10px">MONTHLY SPEND — LAST 6 MONTHS</div>';
  h+='<div style="display:flex;gap:4px;align-items:flex-end;height:80px">';
  months.forEach(function(m){
    var val=monthly[m];var pct=maxM>0?Math.round(val/maxM*100):0;
    var label=m.split('-')[1]+'/'+m.split('-')[0].slice(2);
    h+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">';
    h+='<div style="font-size:8px;color:var(--tx3)">'+fmt$(val).replace('.00','')+'</div>';
    h+='<div style="width:100%;background:var(--ac);border-radius:2px 2px 0 0;height:'+Math.max(2,pct*60/100)+'px"></div>';
    h+='<div style="font-size:8px;color:var(--tx3)">'+label+'</div>';
    h+='</div>';
  });
  h+='</div></div>';

  // Spend by vendor
  var byVendor={};paid.forEach(function(v){if(!byVendor[v.vendorName])byVendor[v.vendorName]={count:0,total:0};byVendor[v.vendorName].count++;byVendor[v.vendorName].total+=(v.total||0)});
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:10px">';
  h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:8px">SPEND BY VENDOR</div>';
  Object.keys(byVendor).sort(function(a,b){return byVendor[b].total-byVendor[a].total}).forEach(function(name){
    var pct=totalSpend>0?Math.round(byVendor[name].total/totalSpend*100):0;
    h+='<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:var(--tx)">'+name+'</span><span style="color:var(--tx3)">'+byVendor[name].count+' · '+fmt$(byVendor[name].total)+'</span></div>';
    h+='<div style="height:4px;background:var(--bg);border-radius:2px"><div style="height:100%;width:'+pct+'%;background:var(--ac);border-radius:2px"></div></div></div>';
  });
  if(!Object.keys(byVendor).length)h+='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:10px">No completed POs yet</div>';
  h+='</div>';

  // Delivery performance by vendor
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px">';
  h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:8px">VENDOR DELIVERY PERFORMANCE</div>';
  _vendorCache.filter(function(v){var dp=v.deliveryPerformance||{};return(dp.onTimeCount||0)+(dp.lateCount||0)>0}).forEach(function(v){
    var dp=v.deliveryPerformance||{};var total=(dp.onTimeCount||0)+(dp.lateCount||0);var pct=Math.round((dp.onTimeCount||0)/total*100);
    var h2=vpCalcVendorHealth(v);
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
    h+='<span style="color:var(--tx)">'+v.name+'</span>';
    h+='<div style="display:flex;gap:12px"><span style="color:'+(pct>=90?'var(--gn)':pct>=70?'var(--or)':'var(--rd)')+'">'+pct+'% on-time</span>';
    if(h2!==null)h+='<span style="color:'+healthColor(h2)+';font-weight:700">'+h2+' health</span>';
    h+='</div></div>';
  });
  h+='</div>';
  return h;
}

// ─── VENDOR PROFILE (FULL MODAL) ─────────────────────────────────

function vpOpenVendorProfile(vendorId){
  VP.vendorModalId=vendorId;
  VP.vendorTab='overview';
  vpRenderVendorProfile();
}

function vpRenderVendorProfile(){
  var v=vpoVendorGet(VP.vendorModalId);if(!v)return;
  var health=vpCalcVendorHealth(v);
  var vpos=_vpoCache.filter(function(p){return p.vendorName===v.name||p.vendorId===v.id});
  var comms=vendorComms(v.id);
  var lots=vendorLots(v.id);
  var invoices=vendorInvoices(v.id);
  var totalSpend=vpos.filter(function(p){return p.status==='paid'||p.status==='received'}).reduce(function(s,p){return s+(p.total||0)},0);

  var tabs=[
    {k:'overview',l:'Overview',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'},
    {k:'pos',l:'PO History',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',count:vpos.length},
    {k:'comms',l:'Communications',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',count:comms.length},
    {k:'lots',l:'Lot History',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',count:lots.length},
    {k:'invoices',l:'Invoices',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',count:invoices.length},
    {k:'calendar',l:'Calendar',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'},
    {k:'docs',l:'Documents',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>'},
    {k:'health',l:'Health',ico:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'}
  ];

  var h='';
  // Vendor header with health bar
  h+='<div style="margin:-12px -12px 0;padding:0;background:var(--bg2);margin-bottom:10px">';
  if(health!==null)h+='<div style="height:4px;background:var(--bg)"><div style="height:100%;width:'+health+'%;background:'+healthColor(health)+';transition:width .3s"></div></div>';
  h+='<div style="padding:12px 12px 0">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">';
  h+='<div>';
  h+='<div style="font-size:16px;font-weight:700;color:var(--tx)">'+v.name+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">'+(v.contact||'—')+' · '+(v.email||'—')+(v.phone?' · '+v.phone:'')+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">Terms: '+(v.terms||'—')+' · Rating: '+(v.rating?'★'.repeat(v.rating):'—')+'</div>';
  h+='</div>';
  if(health!==null){
    h+='<div style="text-align:right"><div style="font-size:22px;font-weight:700;color:'+healthColor(health)+'">'+health+'</div>';
    h+='<div style="font-size:9px;color:var(--tx3)">'+healthLabel(health)+'</div></div>';
  }
  h+='</div>';

  // KPI row
  h+='<div style="display:flex;gap:10px;font-size:10px;margin-bottom:10px">';
  h+='<span style="color:var(--ac)">'+vpos.length+' POs</span>';
  h+='<span style="color:var(--gn)">'+fmt$(totalSpend)+' spent</span>';
  var dp=v.deliveryPerformance||{};var tot=(dp.onTimeCount||0)+(dp.lateCount||0);
  if(tot)h+='<span style="color:'+(dp.lateCount>dp.onTimeCount?'var(--rd)':'var(--gn)')+'">'+(Math.round((dp.onTimeCount||0)/tot*100))+'% on-time</span>';
  h+='</div>';

  // Tab bar
  h+='<div style="display:flex;gap:0;overflow-x:auto">';
  tabs.forEach(function(t){h+='<div onclick="VP.vendorTab=\''+t.k+'\';vpRenderVendorProfile()" style="padding:8px 10px;font-size:10px;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(VP.vendorTab===t.k?'var(--ac)':'transparent')+';color:'+(VP.vendorTab===t.k?'var(--ac)':'var(--tx3)')+'">'+t.ico+' '+t.l+(t.count?'<span style="background:var(--bg3);padding:1px 5px;border-radius:8px;font-size:9px;margin-left:3px">'+t.count+'</span>':'')+'</div>'});
  h+='</div></div></div>';

  // Tab content
  if(VP.vendorTab==='overview')h+=vpVendorTabOverview(v,vpos,comms);
  else if(VP.vendorTab==='pos')h+=vpVendorTabPOs(v,vpos);
  else if(VP.vendorTab==='comms')h+=vpVendorTabComms(v,comms);
  else if(VP.vendorTab==='lots')h+=vpVendorTabLots(v,lots);
  else if(VP.vendorTab==='invoices')h+=vpVendorTabInvoices(v,invoices);
  else if(VP.vendorTab==='calendar')h+=vpVendorTabCalendar(v,vpos);
  else if(VP.vendorTab==='docs')h+=vpVendorTabDocs(v);
  else if(VP.vendorTab==='health')h+=vpVendorTabHealth(v,vpos);

  // Actions
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  h+='<button class="btn btn-pr btn-xs" onclick="vpOpenCreate({vendorName:\''+v.name+'\',vendorEmail:\''+v.email+'\'})">+ New PO</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vpLogComm(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Log Comm</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vpAIDraftEmail(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Draft Email</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vpEditVendor(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
  h+='</div>';
  openModal(h);
}

function vpVendorTabOverview(v,vpos,comms){
  var dp=v.deliveryPerformance||{};var tot=(dp.onTimeCount||0)+(dp.lateCount||0);
  var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:10px">';
  function row(l,val){return'<div><span style="color:var(--tx3)">'+l+': </span><span style="color:var(--tx)">'+val+'</span></div>'}
  h+=row('Email',v.email||'—');h+=row('Phone',v.phone||'—');
  h+=row('Address',v.address||'—');h+=row('Terms',v.terms||'—');
  h+=row('Payment Method',v.paymentMethod||'—');h+=row('Rating',v.rating?'★'.repeat(v.rating):'—');
  h+=row('On-Time',tot?(Math.round((dp.onTimeCount||0)/tot*100)+'% ('+tot+' deliveries)'):'No data');
  h+=row('Avg Days Late',dp.avgDaysLate?dp.avgDaysLate+'d':'—');
  h+='</div>';
  if(v.materials&&v.materials.length){h+='<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Supplies: '+v.materials.join(' · ')+'</div>'}
  if(v.notes){h+='<div style="background:var(--bg2);border-radius:4px;padding:8px;font-size:10px;color:var(--tx2);margin-bottom:8px">'+v.notes+'</div>'}
  // Recent comms
  if(comms.length){
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:4px">RECENT COMMUNICATIONS</div>';
    comms.slice(0,3).forEach(function(c){
      var ic={email:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',call:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',meeting:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',note:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'}[c.type]||'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      h+='<div style="font-size:10px;padding:4px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--tx3)">'+ic+' '+fmtDate(c.at)+' — </span><span style="color:var(--tx2)">'+c.summary.substring(0,80)+'</span></div>';
    });
  }
  return h;
}

function vpVendorTabPOs(v,vpos){
  if(!vpos.length)return'<div style="text-align:center;padding:20px;color:var(--tx3)">No POs yet</div>';
  var h='';
  vpos.forEach(function(p){
    var sc=STATUS_COLORS[p.status]||'var(--tx3)';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr);cursor:pointer;font-size:10px" onclick="closeModal();vpOpenDetail(\''+p.id+'\')">';
    h+='<div><span style="color:var(--ac);font-weight:700">'+p.vpoNum+'</span> <span style="color:var(--tx3)">'+p.material+'</span></div>';
    h+='<div style="display:flex;gap:10px"><span style="color:var(--tx)">'+fmt$(p.total)+'</span><span style="color:'+sc+'">'+STATUS_LABELS[p.status]+'</span><span style="color:var(--tx3)">'+fmtDate(p.createdAt)+'</span></div></div>';
  });
  return h;
}

function vpVendorTabComms(v,comms){
  var h='<div style="margin-bottom:8px"><button class="btn btn-pr btn-xs" onclick="vpLogComm(\''+v.id+'\')">+ Log Communication</button></div>';
  if(!comms.length)return h+'<div style="text-align:center;padding:20px;color:var(--tx3)">No communications logged</div>';
  comms.forEach(function(c){
    var ic={email:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',call:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',meeting:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',note:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',complaint:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}[c.type]||'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    h+='<div style="background:var(--bg2);border-radius:6px;padding:8px;margin-bottom:6px">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;font-weight:600;color:var(--tx)">'+ic+' '+c.type.charAt(0).toUpperCase()+c.type.slice(1)+'</span><span style="font-size:9px;color:var(--tx3)">'+fmtDT(c.at)+' · '+( c.by||'—')+'</span></div>';
    h+='<div style="font-size:11px;color:var(--tx2)">'+c.summary+'</div>';
    if(c.actionItems)h+='<div style="font-size:10px;color:var(--or);margin-top:4px">Action: '+c.actionItems+'</div>';
    if(c.followUpDate)h+='<div style="font-size:10px;color:var(--ac);margin-top:2px">Follow-up: '+fmtDate(c.followUpDate)+'</div>';
    h+='</div>';
  });
  return h;
}

function vpVendorTabLots(v,lots){
  var h='';
  if(!lots.length)return'<div style="text-align:center;padding:20px;color:var(--tx3)">No lots recorded</div>';
  lots.forEach(function(l){
    h+='<div style="background:var(--bg2);border-radius:6px;padding:8px;margin-bottom:6px;font-size:10px">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
    h+='<span style="color:var(--ac);font-weight:700">Lot# '+l.lotNum+'</span>';
    h+='<span style="color:var(--tx3)">'+fmtDate(l.receivedAt)+'</span></div>';
    h+='<div style="color:var(--tx2)">'+l.material+' · '+l.quantity+' '+( l.unit||'')+'</div>';
    if(l.condition&&l.condition!=='Good')h+='<div style="color:var(--or)">Condition: '+l.condition+'</div>';
    if(l.sqfCertNum)h+='<div style="color:var(--gn)">SQF Cert: '+l.sqfCertNum+'</div>';
    if(l.usedOnJTs&&l.usedOnJTs.length)h+='<div style="color:var(--tx3)">Used on: '+l.usedOnJTs.join(', ')+'</div>';
    h+='</div>';
  });
  return h;
}

function vpVendorTabInvoices(v,invoices){
  var h='<div style="margin-bottom:8px"><button class="btn btn-pr btn-xs" onclick="vpOpenCreateInvoice(\''+v.id+'\')">+ Log Invoice</button></div>';
  if(!invoices.length)return h+'<div style="text-align:center;padding:20px;color:var(--tx3)">No invoices</div>';
  invoices.forEach(function(inv){
    var dueD=daysUntil(inv.dueDate);var overdue=dueD!==null&&dueD<0&&!inv.paid;
    h+='<div style="background:var(--bg2);border:1px solid '+(overdue?'rgba(239,68,68,.3)':'var(--bdr)')+';border-radius:6px;padding:8px;margin-bottom:6px;font-size:10px">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
    h+='<span style="color:var(--tx);font-weight:700">'+(inv.invoiceNum||'—')+'</span>';
    h+='<span style="font-size:11px;font-weight:700;color:'+(inv.paid?'var(--gn)':'var(--tx)')+'">'+fmt$(inv.amount)+'</span></div>';
    h+='<div style="color:var(--tx3)">Inv Date: '+fmtDate(inv.invoiceDate)+' · Due: <span style="color:'+(overdue?'var(--rd)':'var(--tx3)')+'">'+fmtDate(inv.dueDate)+(overdue?' (OVERDUE)':'')+'</span></div>';
    if(inv.matchedVpoId){var p=vpoGet(inv.matchedVpoId);h+='<div style="color:var(--ac)">PO: '+(p?p.vpoNum:inv.matchedVpoId)+'</div>'}
    else h+='<div style="color:var(--or)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> No PO matched</div>';
    h+='<div style="display:flex;gap:6px;margin-top:6px">';
    if(!inv.paid)h+='<button class="btn btn-gn btn-xs" onclick="vpPayInvoice(\''+inv.id+'\')" style="font-size:9px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Pay</button>';
    if(!inv.matchedVpoId)h+='<button class="btn btn-ghost btn-xs" onclick="vpMatchInvoice(\''+inv.id+'\')" style="font-size:9px">Match PO</button>';
    h+='</div></div>';
  });
  return h;
}

function vpVendorTabCalendar(v,vpos){
  // Show all upcoming events for this vendor on a timeline
  var events=[];
  vpos.forEach(function(p){
    if(p.eta)events.push({date:p.eta,type:'ETA',label:p.vpoNum+' — '+p.material+' delivery',color:'var(--gn)',status:p.status});
    if(p.status!=='paid'&&p.status!=='rejected'){
      // Payment due
      var termsDays={'Net 30':30,'Net 45':45,'Net 60':60,'Due on Receipt':0,'Prepaid':-1,'Net 15':15,'Net 90':90};
      var days=termsDays[p.terms]||30;
      if(days>=0&&p.sentAt){var due=new Date(p.sentAt);due.setDate(due.getDate()+days);events.push({date:due.toISOString(),type:'PAYMENT',label:p.vpoNum+' — '+fmt$(p.total)+' due',color:'var(--or)',status:p.status})}
    }
  });
  _invoiceCache.filter(function(i){return i.vendorId===v.id&&!i.paid}).forEach(function(i){
    if(i.dueDate)events.push({date:i.dueDate,type:'INVOICE',label:(i.invoiceNum||'Invoice')+' — '+fmt$(i.amount)+' due',color:'var(--rd)'});
  });
  vendorComms(v.id).filter(function(c){return c.followUpDate}).forEach(function(c){
    events.push({date:c.followUpDate,type:'FOLLOW-UP',label:c.summary.substring(0,40),color:'#a78bfa'});
  });
  events.sort(function(a,b){return new Date(a.date)-new Date(b.date)});

  var h='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:8px">VENDOR CALENDAR</div>';
  if(!events.length)return h+'<div style="color:var(--tx3);text-align:center;padding:20px">No upcoming events</div>';

  var now=new Date();
  events.forEach(function(ev){
    var evDate=new Date(ev.date);var d=Math.round((evDate-now)/(1000*60*60*24));var past=d<0;
    h+='<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--bdr);opacity:'+(past?0.5:1)+'">';
    h+='<div style="min-width:60px;text-align:center"><div style="font-size:11px;font-weight:700;color:var(--tx)">'+evDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</div>';
    h+='<div style="font-size:9px;color:'+(d<0?'var(--rd)':d===0?'var(--or)':'var(--tx3)')+'">'+( d<0?Math.abs(d)+'d ago':d===0?'Today':d+'d')+'</div></div>';
    h+='<div style="flex:1"><div style="font-size:9px;color:'+ev.color+';font-weight:700;letter-spacing:1px">'+ev.type+'</div>';
    h+='<div style="font-size:11px;color:var(--tx)">'+ev.label+'</div></div></div>';
  });

  // Add to Google Calendar button
  h+='<button class="btn btn-ghost btn-xs" onclick="vpAddETAToCalendar(\''+v.id+'\')" style="margin-top:10px;width:100%"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Sync ETAs to Google Calendar</button>';
  return h;
}

function vpVendorTabDocs(v){
  var docs=v.documents||[];
  var h='<div style="margin-bottom:8px"><button class="btn btn-pr btn-xs" onclick="vpUploadVendorDoc(\''+v.id+'\')">+ Upload Document</button></div>';
  if(!docs.length)return h+'<div style="text-align:center;padding:20px;color:var(--tx3)">No documents. Upload SDS, COA, insurance certs, etc.</div>';
  docs.forEach(function(d){
    var expired=d.expiresAt&&new Date(d.expiresAt)<new Date();
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr);font-size:10px">';
    h+='<div><span style="color:'+(expired?'var(--rd)':'var(--ac)')+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> '+d.name+'</span>';
    h+='<span style="color:var(--tx3);margin-left:6px">'+d.type+'</span>';
    if(d.expiresAt)h+='<span style="color:'+(expired?'var(--rd)':'var(--tx3)')+';margin-left:6px">'+(expired?'EXPIRED ':'Expires ')+fmtDate(d.expiresAt)+'</span>';
    h+='</div>';
    if(d.url)h+='<a href="'+d.url+'" target="_blank" class="btn btn-ghost btn-xs" style="font-size:9px">View</a>';
    h+='</div>';
  });
  return h;
}

function vpVendorTabHealth(v,vpos){
  var dp=v.deliveryPerformance||{};var tot=(dp.onTimeCount||0)+(dp.lateCount||0);
  var health=vpCalcVendorHealth(v);

  var h='<div style="text-align:center;padding:16px 0">';
  if(health!==null){
    h+='<div style="font-size:48px;font-weight:700;color:'+healthColor(health)+'">'+health+'</div>';
    h+='<div style="font-size:12px;color:var(--tx3)">Composite Health Score</div>';
  }else{
    h+='<div style="font-size:24px;color:var(--tx3)">Insufficient data</div>';
    h+='<div style="font-size:11px;color:var(--tx3)">Need at least 1 completed delivery to calculate health</div>';
  }
  h+='</div>';

  // Component breakdown
  var components=[
    {label:'On-Time Delivery',weight:HEALTH_WEIGHTS.onTimeDelivery,score:tot>0?Math.round((dp.onTimeCount||0)/tot*100):null,detail:tot?tot+' deliveries, '+(dp.lateCount||0)+' late':'No deliveries yet'},
    {label:'Quality Score',weight:HEALTH_WEIGHTS.qualityScore,score:v.qualityScore||null,detail:'Based on QC rejects and complaints'},
    {label:'Responsiveness',weight:HEALTH_WEIGHTS.responsiveness,score:v.responsivenessScore||null,detail:'PO confirmations, reply time'},
    {label:'Pricing Stability',weight:HEALTH_WEIGHTS.pricingStability,score:v.pricingStabilityScore||null,detail:'Price consistency over time'},
    {label:'Document Compliance',weight:HEALTH_WEIGHTS.documentCompliance,score:v.docComplianceScore||null,detail:'COA, SDS, certs on file'}
  ];

  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:8px">SCORE BREAKDOWN</div>';
  components.forEach(function(c){
    h+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">';
    h+='<span style="color:var(--tx)">'+c.label+' <span style="color:var(--tx3)">('+c.weight+'%)</span></span>';
    h+='<span style="color:'+(c.score===null?'var(--tx3)':healthColor(c.score))+'">'+( c.score===null?'No data':c.score)+'</span></div>';
    if(c.score!==null){
      h+='<div style="height:4px;background:var(--bg);border-radius:2px"><div style="height:100%;width:'+c.score+'%;background:'+healthColor(c.score)+';border-radius:2px"></div></div>';
    }
    h+='<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+c.detail+'</div>';
    h+='</div>';
  });

  // Manual score overrides
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin:10px 0 6px">OVERRIDE SCORES</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  h+=vpF('Quality Score (0-100)','vpHealthQuality',v.qualityScore||'','number');
  h+=vpF('Responsiveness (0-100)','vpHealthResp',v.responsivenessScore||'','number');
  h+=vpF('Pricing Stability (0-100)','vpHealthPrice',v.pricingStabilityScore||'','number');
  h+=vpF('Doc Compliance (0-100)','vpHealthDoc',v.docComplianceScore||'','number');
  h+='</div>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vpSaveHealthScores(\''+v.id+'\')" style="margin-top:8px">Save Health Scores</button>';
  return h;
}

// ─── LOG COMMUNICATION ────────────────────────────────────────────

function vpLogComm(vendorId){
  var h='<div class="modal-title">Log Communication</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Type','vpCommType','email','select',['email','call','meeting','note','complaint','other']);
  h+=vpF('Date & Time','vpCommDate',new Date().toISOString().slice(0,16),'datetime-local');
  h+='</div>';
  h+=vpF('Summary*','vpCommSummary','','textarea','',3);
  h+='<div style="margin:6px 0">'+vpF('Action Items','vpCommAction','')+'</div>';
  h+='<div style="margin:6px 0">'+vpF('Follow-up Date','vpCommFollowUp','','date')+'</div>';
  h+='<button class="btn btn-pr" onclick="vpSaveComm(\''+vendorId+'\')" style="width:100%;margin-top:8px">Save Communication</button>';
  h+='<button class="btn btn-ghost" onclick="VP.vendorTab=\'comms\';vpRenderVendorProfile()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpSaveComm(vendorId){
  var summary=gv('vpCommSummary');if(!summary)return toast('Summary required','err');
  var comm={
    id:'comm_'+Date.now(),
    vendorId:vendorId,
    type:gv('vpCommType')||'note',
    at:gv('vpCommDate')||new Date().toISOString(),
    summary:summary,
    actionItems:gv('vpCommAction'),
    followUpDate:gv('vpCommFollowUp'),
    by:getUserName(),
    createdAt:new Date().toISOString()
  };
  fbDb.collection('vendorComms').doc(comm.id).set(comm).then(function(){
    toast('Communication logged','ok');
    VP.vendorTab='comms';
    vpRenderVendorProfile();
  });
}

// ─── AI DRAFT EMAIL TO VENDOR ─────────────────────────────────────

function vpAIDraftEmail(vendorId){
  var v=vpoVendorGet(vendorId);if(!v)return;
  var types=['<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> PO Follow-up','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Delivery Schedule Inquiry','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Quality Concern','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Payment Confirmation','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Price Review Request','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Document Request'];
  var h='<div class="modal-title">AI Draft Email to Vendor</div>';
  h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">'+v.name+' · '+( v.email||'No email')+'</div>';
  types.forEach(function(t){h+='<button class="btn btn-ghost btn-xs" onclick="vpGenerateVendorEmail(\''+vendorId+'\',\''+t+'\')" style="width:100%;margin-bottom:4px;text-align:left">'+t+'</button>'});
  h+='<button class="btn btn-ghost" onclick="vpRenderVendorProfile()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpGenerateVendorEmail(vendorId,type){
  var v=vpoVendorGet(vendorId);if(!v)return;
  var recentPOs=_vpoCache.filter(function(p){return p.vendorId===vendorId||p.vendorName===v.name}).slice(0,3);
  toast('✍️ Drafting email...','ok');

  var context='Vendor: '+v.name+'. Contact: '+(v.contact||'—')+'. Terms: '+(v.terms||'Net 30')+'. Recent POs: '+recentPOs.map(function(p){return p.vpoNum+' ('+p.material+' '+fmt$(p.total)+' '+p.status+')'}).join(', ');

  // NOTE: Direct client-side calls to Anthropic API require a backend proxy.
  // The API key must never be exposed in client-side code.
  try{
    console.warn('AI email drafting requires a backend proxy for api.anthropic.com. Client-side API keys are not supported.');
    toast('AI features require backend configuration — using template instead','err');
    // Fallback: show a template email the user can edit
    var body='Dear '+(v.contact||v.name)+',\n\nI am writing regarding '+type+'.\n\nPlease let me know if you have any questions.\n\nBest regards,\nRandy Vazquez, COO\nMicroflex Film Corporation\n(909) 360-9066';
    var h='<div class="modal-title">Email Draft — '+v.name+'</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:6px">To: '+(v.email||'no email')+'</div>';
    h+='<textarea id="vpEmailBody" rows="10" style="width:100%;padding:8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px;margin-bottom:8px">'+body+'</textarea>';
    h+='<button class="btn btn-pr" onclick="vpSendVendorEmail(\''+vendorId+'\')" style="width:100%">Send via Gmail</button>';
    h+='<button class="btn btn-ghost" onclick="vpRenderVendorProfile()" style="width:100%;margin-top:4px">Discard</button>';
    openModal(h);
  }catch(e){toast('AI draft failed: '+e.message,'err')}
}

function vpSendVendorEmail(vendorId){
  var v=vpoVendorGet(vendorId);if(!v||!v.email)return toast('No vendor email','err');
  var body=$('vpEmailBody');if(!body||!body.value.trim())return toast('Empty email','err');

  var tokenPromise = typeof getGoogleToken==='function' ? getGoogleToken() : Promise.resolve(window.GTOKEN);
  tokenPromise.then(function(token){
    if(!token)return toast('Gmail token required — re-login','err');

    var subject='From Microflex Film Corporation';
    var msg='From: Randy Vazquez <'+MFX_ADDRESS.from+'>\r\nTo: '+v.email+'\r\nSubject: '+subject+'\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'+body.value;
    var encoded=btoa(unescape(encodeURIComponent(msg))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

    fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({raw:encoded})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.id){
        toast('Email sent to '+v.name,'ok');
        // Log as communication
        fbDb.collection('vendorComms').add({
          vendorId:vendorId,type:'email',at:new Date().toISOString(),
          summary:'Email sent: '+subject,by:getUserName(),gmailId:d.id,createdAt:new Date().toISOString()
        }).catch(function(e){console.warn('op:',e)});
        VP.vendorTab='comms';
        vpRenderVendorProfile();
      }else{toast('Gmail error','err')}
    }).catch(function(){toast('Send failed','err')});
  });
}

// ─── GOOGLE CALENDAR SYNC ─────────────────────────────────────────

function vpAddETAToCalendar(vendorId){
  var v=vpoVendorGet(vendorId);if(!v)return;
  var upcoming=_vpoCache.filter(function(p){return(p.vendorId===vendorId||p.vendorName===v.name)&&p.eta&&p.status==='sent'});
  if(!upcoming.length)return toast('No pending ETAs to add','err');

  getGoogleToken().then(function(token){
    if(!token)return toast('Google token required','err');
    var promises=upcoming.map(function(p){
      var eta=new Date(p.eta);
      var event={
        summary:'📦 Material ETA: '+p.material+' ('+p.vpoNum+')',
        description:'Vendor: '+v.name+'\nMaterial: '+p.material+'\nQty: '+p.quantity+' '+( p.unit||'')+'\nTotal: '+fmt$(p.total)+'\nPO: '+p.vpoNum,
        start:{date:eta.toISOString().split('T')[0]},
        end:{date:eta.toISOString().split('T')[0]},
        colorId:'2' // Sage green
      };
      return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',{
        method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(event)
      }).catch(function(e){ console.warn('vendor-pos fetch:', e.message); });
    });
    Promise.all(promises).then(function(){toast(upcoming.length+' ETA'+(upcoming.length>1?'s':'')+' added to Calendar','ok')}).catch(function(){toast('Calendar sync failed','err')});
  });
}

// ─── MATERIAL PROFILE ─────────────────────────────────────────────

function vpOpenMaterialProfile(matId){
  VP.materialModalId=matId;
  VP.materialTab='overview';
  vpRenderMaterialProfile();
}

function vpRenderMaterialProfile(){
  var m=materialGet(VP.materialModalId);if(!m)return;
  var low=m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint;
  var lots=_lotCache.filter(function(l){return l.materialId===m.id||l.material===m.name});
  var usagePOs=_vpoCache.filter(function(p){return p.materialId===m.id||p.material===m.name});

  var tabs=[{k:'overview',l:'Overview'},{k:'lots',l:'Lot History',count:lots.length},{k:'usage',l:'Usage',count:usagePOs.length},{k:'traceability',l:'SQF Trace'}];

  var h='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
  h+='<div><div style="font-size:15px;font-weight:700;color:'+(low?'var(--rd)':'var(--tx)')+'">'+(low?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ':'')+m.name+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">'+(m.category||'—')+' · '+(m.vendorName||'—')+'</div></div>';
  h+='<div style="text-align:right"><div style="font-size:18px;font-weight:700;color:'+(low?'var(--rd)':'var(--gn)')+'">'+(m.onHand!==undefined?m.onHand+' '+(m.unit||''):'—')+'</div><div style="font-size:9px;color:var(--tx3)">on hand</div></div>';
  h+='</div>';

  h+='<div style="display:flex;gap:0;margin-bottom:10px;border-bottom:1px solid var(--bdr)">';
  tabs.forEach(function(t){h+='<div onclick="VP.materialTab=\''+t.k+'\';vpRenderMaterialProfile()" style="padding:7px 10px;font-size:10px;cursor:pointer;border-bottom:2px solid '+(VP.materialTab===t.k?'var(--ac)':'transparent')+';color:'+(VP.materialTab===t.k?'var(--ac)':'var(--tx3)')+'">'+t.l+(t.count?'<span style="font-size:9px;background:var(--bg3);padding:1px 5px;border-radius:8px;margin-left:3px">'+t.count+'</span>':'')+'</div>'});
  h+='</div>';

  if(VP.materialTab==='overview'){
    function r(l,v){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px"><span style="color:var(--tx3)">'+l+'</span><span style="color:var(--tx)">'+v+'</span></div>'}
    h+=r('Spec',m.spec||'—');h+=r('Category',m.category||'—');h+=r('Vendor',m.vendorName||'—');
    h+=r('Unit Cost',m.unitCost?fmt$(m.unitCost):'—');h+=r('Unit',m.unit||'—');
    h+=r('On Hand',(m.onHand!==undefined?m.onHand+' '+(m.unit||''):'—'));
    h+=r('On Order',(m.onOrder?m.onOrder+' '+(m.unit||''):'—'));
    h+=r('Reorder Point',(m.reorderPoint!==undefined?m.reorderPoint+' '+(m.unit||''):'—'));
    h+=r('Reorder Qty',(m.reorderQty?m.reorderQty+' '+(m.unit||''):'—'));
    h+=r('SQF Traceable',m.sqfTraceable?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Yes':'—');
    if(low){
      h+='<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:8px;margin-top:10px">';
      h+='<div style="font-size:11px;color:var(--rd)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> LOW STOCK — Current: '+(m.onHand||0)+' · Reorder at: '+(m.reorderPoint||0)+'</div>';
      h+='<button class="btn btn-pr btn-xs" onclick="vpAutoReorder(\''+m.id+'\')" style="margin-top:6px;width:100%"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Auto-Generate Reorder PO</button>';
      h+='</div>';
    }
  }else if(VP.materialTab==='lots'){
    if(!lots.length){h+='<div style="text-align:center;padding:20px;color:var(--tx3)">No lots recorded</div>'}
    else{lots.forEach(function(l){
      h+='<div style="background:var(--bg2);border-radius:6px;padding:8px;margin-bottom:6px;font-size:10px">';
      h+='<div style="display:flex;justify-content:space-between"><span style="color:var(--ac);font-weight:700">Lot# '+l.lotNum+'</span><span style="color:var(--tx3)">'+fmtDate(l.receivedAt)+'</span></div>';
      h+='<div style="color:var(--tx2)">'+l.quantity+' '+(m.unit||'')+' received · Vendor: '+( l.vendorName||'—')+'</div>';
      if(l.condition!=='Good')h+='<div style="color:var(--or)">Condition: '+l.condition+'</div>';
      if(l.sqfCertNum)h+='<div style="color:var(--gn)">SQF Cert: '+l.sqfCertNum+'</div>';
      if(l.expiresAt)h+='<div style="color:var(--tx3)">Expires: '+fmtDate(l.expiresAt)+'</div>';
      if(l.usedOnJTs&&l.usedOnJTs.length)h+='<div style="color:var(--tx3)">Used on JTs: '+l.usedOnJTs.join(', ')+'</div>';
      h+='</div>';
    })}
  }else if(VP.materialTab==='usage'){
    if(!usagePOs.length){h+='<div style="text-align:center;padding:20px;color:var(--tx3)">No purchase history</div>'}
    else{
      var totalQty=usagePOs.reduce(function(s,p){return s+(p.quantity||0)},0);
      var totalCost=usagePOs.reduce(function(s,p){return s+(p.total||0)},0);
      h+='<div style="display:flex;gap:12px;font-size:10px;margin-bottom:10px">';
      h+='<span style="color:var(--ac)">'+usagePOs.length+' POs</span>';
      h+='<span>'+totalQty+' '+(m.unit||'')+'  ordered</span>';
      h+='<span style="color:var(--gn)">'+fmt$(totalCost)+' spent</span>';
      h+='</div>';
      usagePOs.forEach(function(p){
        h+='<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px;cursor:pointer" onclick="closeModal();vpOpenDetail(\''+p.id+'\')">';
        h+='<span style="color:var(--ac)">'+p.vpoNum+'</span>';
        h+='<span style="color:var(--tx3)">'+p.quantity+' '+( m.unit||'')+'</span>';
        h+='<span>'+fmt$(p.total)+'</span>';
        h+='<span style="color:var(--tx3)">'+fmtDate(p.createdAt)+'</span></div>';
      });
    }
  }else if(VP.materialTab==='traceability'){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:8px">SQF Ed.10 TRACEABILITY CHAIN</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Forward traceability: material → lot → job ticket → customer order</div>';
    if(!lots.length){h+='<div style="color:var(--tx3);text-align:center;padding:20px">No lots to trace</div>'}
    else{lots.forEach(function(l){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;padding:8px;margin-bottom:8px">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--ac)">Lot# '+l.lotNum+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3);margin-bottom:6px">Received: '+fmtDate(l.receivedAt)+' from '+( l.vendorName||'—')+(l.sqfCertNum?' · SQF Cert: '+l.sqfCertNum:'')+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3)">→ Used on: '+(l.usedOnJTs&&l.usedOnJTs.length?l.usedOnJTs.join(', '):'Not recorded')+'</div>';
      h+='</div>';
    })}
  }

  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  h+='<button class="btn btn-pr btn-xs" onclick="vpAutoReorder(\''+m.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Reorder</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vpEditMaterial(\''+m.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
  h+='</div>';
  openModal(h);
}

// ─── AUTO REORDER ─────────────────────────────────────────────────

function vpAutoReorder(matId){
  var m=materialGet(matId);if(!m)return toast('Material not found','err');
  var vendor=_vendorCache.find(function(v){return v.id===m.vendorId||v.name===m.vendorName});

  // Calculate qty needed
  var qty=m.reorderQty||100;
  // Estimate ETA from vendor lead time
  var leadDays=30;
  if(vendor&&vendor.avgLeadDays)leadDays=vendor.avgLeadDays;
  var eta=new Date();eta.setDate(eta.getDate()+leadDays);

  vpOpenCreate({
    material:m.name,materialCategory:m.category||'',materialSpec:m.spec||'',
    vendorName:m.vendorName||'',vendorEmail:vendor?vendor.email:'',
    quantity:qty,unit:m.unit||'ft',unitCost:m.unitCost||0,
    eta:eta.toISOString().split('T')[0],terms:vendor?vendor.terms:'Net 30',
    notes:'Reorder — auto-generated from low stock alert'
  });
}

// ─── CREATE VPO FORM ─────────────────────────────────────────────

function vpOpenCreate(prefill){
  prefill=prefill||{};
  var vendorOpts=_vendorCache.map(function(v){return{id:v.name,name:v.name}});
  var materialOpts=_materialCache.map(function(m){return{id:m.name,name:m.name+' ('+( m.category||'')+')'}});
  var jtOpts=(_jtCache||[]).filter(function(t){return t.status!=='closed'}).map(function(t){return{id:t.id,name:t.jtNum+' — '+t.company}});
  var soOpts=(_soCache||[]).map(function(s){return{id:s.id,name:s.soNum+' — '+s.company}});

  var h='<div class="modal-title">New Vendor Purchase Order</div>';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">VENDOR</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Vendor','vpVendor',prefill.vendorName||'','select',vendorOpts,'onchange="vpAutoFillVendor(this.value)"');
  h+=vpF('Or type vendor','vpVendorCustom',prefill.vendorCustom||'');
  h+=vpF('Vendor Email','vpVendorEmail',prefill.vendorEmail||'','email');
  h+=vpF('Vendor Phone','vpVendorPhone',prefill.vendorPhone||'');
  h+='</div>';

  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">MATERIAL</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Material','vpMaterial',prefill.material||'','select',materialOpts,'onchange="vpAutoFillMaterial(this.value)"');
  h+=vpF('Or type material','vpMaterialCustom',prefill.materialCustom||'');
  h+=vpF('Category','vpMatCat',prefill.materialCategory||'','select',MATERIAL_CATEGORIES);
  h+=vpF('Spec','vpMatSpec',prefill.materialSpec||'');
  h+='</div>';

  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">PRICING</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">';
  h+=vpF('Quantity*','vpQty',prefill.quantity||'','number','','oninput="vpCalcTotal()"');
  h+=vpF('Unit','vpUnit',prefill.unit||'ft','select',UNITS);
  h+=vpF('Unit Cost $*','vpUnitCost',prefill.unitCost||'','number','','oninput="vpCalcTotal()"');
  h+='</div>';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;padding:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">';
  h+='<span style="font-size:11px;color:var(--tx3)">PO Total</span><span id="vpTotalDisplay" style="font-size:18px;font-weight:700;color:var(--ac)">$0.00</span>';
  h+='<input type="hidden" id="vpTotal" value="0"></div>';

  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">TERMS & DATES</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Payment Terms','vpTerms',prefill.terms||'Net 30','select',PAYMENT_TERMS);
  h+=vpF('ETA*','vpEta',prefill.eta||'','date');
  h+=vpF('Shipping Method','vpShipping',prefill.shippingMethod||'');
  h+=vpF('Needed By (internal)','vpNeededBy',prefill.neededBy||'','date');
  h+='</div>';

  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:6px">LINK TO JOB (OPTIONAL)</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Job Ticket','vpLinkedJT',prefill.forJTId||'','select',jtOpts);
  h+=vpF('Sales Order','vpLinkedSO',prefill.forSOId||'','select',soOpts);
  h+='</div>';

  h+='<div style="margin-bottom:6px">'+vpF('Notes (on PDF)','vpNotes',prefill.notes||'','textarea','',2)+'</div>';
  h+='<div style="margin-bottom:10px">'+vpF('Internal Notes (NOT on PDF)','vpInternalNotes','','textarea','',2)+'</div>';

  h+='<button class="btn btn-pr" onclick="vpSaveDraft()" style="width:100%;margin-bottom:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save as Draft</button>';
  h+='<button class="btn btn-submit-approval" onclick="vpSubmitForApproval()" style="width:100%;margin-bottom:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit for CEO Approval</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%">Cancel</button>';
  openModal(h);

  if(prefill.quantity&&prefill.unitCost)setTimeout(function(){vpCalcTotal()},100);
}

function vpCalcTotal(){
  var q=gf('vpQty');var u=gf('vpUnitCost');var t=q*u;
  var d=$('vpTotalDisplay');var i=$('vpTotal');
  if(d)d.textContent=fmt$(t);if(i)i.value=t;
}

function vpAutoFillVendor(name){
  if(!name)return;var v=_vendorCache.find(function(x){return x.name===name});if(!v)return;
  if($('vpVendorEmail')&&!$('vpVendorEmail').value)$('vpVendorEmail').value=v.email||'';
  if($('vpVendorPhone')&&!$('vpVendorPhone').value)$('vpVendorPhone').value=v.phone||'';
  if(v.terms&&$('vpTerms'))$('vpTerms').value=v.terms;
}

function vpAutoFillMaterial(name){
  if(!name)return;var m=_materialCache.find(function(x){return x.name===name});if(!m)return;
  if($('vpMatCat')&&m.category)$('vpMatCat').value=m.category;
  if($('vpMatSpec')&&m.spec)$('vpMatSpec').value=m.spec;
  if($('vpUnitCost')&&m.unitCost)$('vpUnitCost').value=m.unitCost;
  if(m.vendorName&&$('vpVendor')){var opt=Array.from($('vpVendor').options).find(function(o){return o.value===m.vendorName});if(opt){$('vpVendor').value=m.vendorName;vpAutoFillVendor(m.vendorName)}}
  vpCalcTotal();
}

function vpBuildDoc(status){
  var vendorName=gv('vpVendor')||gv('vpVendorCustom');
  var material=gv('vpMaterial')||gv('vpMaterialCustom');
  if(!vendorName)return toast('Vendor required','err'),null;
  if(!material)return toast('Material required','err'),null;
  var qty=gf('vpQty');var unitCost=gf('vpUnitCost');
  var jtId=gv('vpLinkedJT');var soId=gv('vpLinkedSO');
  var jt=jtId?(_jtCache||[]).find(function(t){return t.id===jtId}):null;
  var so=soId?(_soCache||[]).find(function(s){return s.id===soId}):null;
  var vendor=_vendorCache.find(function(v){return v.name===vendorName});
  var mat=_materialCache.find(function(m){return m.name===material});
  var vpo={
    id:'vpo_'+Date.now(),vpoNum:genVPONum(),status:status,
    vendorId:vendor?vendor.id:null,vendorName:vendorName,
    vendorEmail:gv('vpVendorEmail'),vendorPhone:gv('vpVendorPhone'),
    material:material,materialSpec:gv('vpMatSpec'),materialCategory:gv('vpMatCat'),
    materialId:mat?mat.id:null,quantity:qty,unit:gv('vpUnit'),unitCost:unitCost,total:qty*unitCost,
    terms:gv('vpTerms')||'Net 30',eta:gv('vpEta'),neededBy:gv('vpNeededBy'),shippingMethod:gv('vpShipping'),
    forJTId:jtId,forJTNum:jt?jt.jtNum:'',forSOId:soId,forSONum:so?so.soNum:'',
    forJPNum:jt?jt.jpNum:'',forCompany:jt?jt.company:(so?so.company:''),
    notes:gv('vpNotes'),internalNotes:gv('vpInternalNotes'),
    requestedBy:getUserName(),requestedAt:new Date().toISOString(),
    log:[{action:'PO created ('+status+')',by:getUserName(),at:new Date().toISOString()}],
    createdAt:new Date().toISOString(),createdBy:getUserName()
  };
  return vpo;
}

function vpSaveDraft(){
  var vpo=vpBuildDoc('draft');if(!vpo)return;
  vpoSave(vpo).then(function(){
    toast(vpo.vpoNum+' draft saved','ok');
    DB&&DB.logActivity&&DB.logActivity('vpo.drafted',vpo.vpoNum);
    upgradeVPONum(vpo);
    closeModal();VP.tab='all';renderVendorPOs();
  }).catch(function(e){toast('Error: '+e.message,'err')});
}

function vpSubmitForApproval(){
  var vpo=vpBuildDoc('pending_approval');if(!vpo)return;
  if(!vpo.eta)return toast('ETA required before submitting','err');
  vpo.submittedBy=getUserName();vpo.submittedForApprovalAt=new Date().toISOString();
  vpoSave(vpo).then(function(){
    notifyTeam('📤 VPO APPROVAL REQUEST: '+vpo.vpoNum+' — '+vpo.vendorName+' | '+vpo.material+' | '+fmt$(vpo.total));
    fbDb.collection('threads').add({type:'vpo.approval_requested',vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,total:vpo.total,by:getUserName(),createdAt:new Date().toISOString(),message:'📤 VPO Approval: '+vpo.vpoNum+' — '+vpo.vendorName+' '+fmt$(vpo.total)}).catch(function(e){console.warn('op:',e)});
    toast('Submitted for approval','ok');
    closeModal();VP.tab='pending';renderVendorPOs();
  }).catch(function(e){toast('Error: '+e.message,'err')});
}

// ─── CEO APPROVAL ─────────────────────────────────────────────────

function vpCEOApprove(vpoId){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  var h='<div class="ctrl-modal-header"><div class="ctrl-label">CONTROLLED ACTION — PURCHASE ORDER APPROVAL</div><div class="ctrl-title">Approve VPO '+vpo.vpoNum+'</div></div>';
  h+='<div style="background:var(--bg2);padding:14px;border-radius:8px;margin:12px 0;font-size:12px;border-left:3px solid var(--gn)">';
  h+='<div style="margin-bottom:4px"><strong>Vendor:</strong> '+vpo.vendorName+'</div>';
  h+='<div style="margin-bottom:4px"><strong>Material:</strong> '+vpo.material+'</div>';
  h+='<div style="margin-bottom:4px"><strong>Qty:</strong> '+vpo.quantity+' '+vpo.unit+' @ '+fmt$(vpo.unitCost)+'/ea</div>';
  h+='<div style="font-size:16px;font-weight:bold;color:var(--ac);margin-top:6px">Total: '+fmt$(vpo.total)+'</div>';
  h+='<div style="color:var(--tx3);margin-top:4px">Requested by: '+(vpo.submittedBy||vpo.requestedBy||'—')+'</div></div>';
  h+='<div class="fg"><label style="font-weight:600">Approval Notes (optional)</label><textarea id="vpoApproveNote" rows="2" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);margin-top:4px" placeholder="Optional notes..."></textarea></div>';
  h+='<div class="compliance-boundary"></div>';
  h+='<div style="display:flex;gap:8px">';
  h+='<button class="btn btn-approve" id="btnVpoApprove" onclick="vpDoServerApprove(\''+vpoId+'\',\'approve\')" style="flex:1;padding:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve & Send to Vendor</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="flex:1">Cancel</button></div>';
  openModal(h);
}

function vpCEOReject(vpoId){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  var h='<div class="ctrl-modal-header"><div class="ctrl-label">CONTROLLED ACTION — PURCHASE ORDER REJECTION</div><div class="ctrl-title">Reject VPO '+vpo.vpoNum+'</div></div>';
  h+='<div style="background:var(--bg2);padding:14px;border-radius:8px;margin:12px 0;font-size:12px;border-left:3px solid var(--rd)">';
  h+='<div><strong>Vendor:</strong> '+vpo.vendorName+' &nbsp; <strong>Total:</strong> '+fmt$(vpo.total)+'</div></div>';
  h+='<div class="fg"><label style="font-weight:600;color:var(--rd)">Rejection Reason (required)</label><textarea id="vpoRejectReason" rows="3" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--rd);border-radius:6px;color:var(--tx);margin-top:4px" placeholder="Explain why this PO is being rejected..." required></textarea></div>';
  h+='<div class="compliance-boundary"></div>';
  h+='<div style="display:flex;gap:8px">';
  h+='<button class="btn btn-reject" id="btnVpoReject" onclick="vpDoServerApprove(\''+vpoId+'\',\'reject\')" style="flex:1;padding:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject PO</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="flex:1">Cancel</button></div>';
  openModal(h);
}

// Server-verified VPO approval/rejection via transitionStatus endpoint
function vpDoServerApprove(vpoId,action){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  var note='';
  if(action==='approve'){note=(document.getElementById('vpoApproveNote')||{}).value||''}
  else{note=(document.getElementById('vpoRejectReason')||{}).value||'';if(!note.trim())return toast('Rejection reason required','err')}
  // Disable buttons to prevent double-submit
  var btn=document.getElementById(action==='approve'?'btnVpoApprove':'btnVpoReject');
  if(btn){btn.disabled=true;btn.textContent='Processing...'}
  var newStatus=action==='approve'?'approved':'rejected';
  var postBody={collection:'vendorPOs',docId:vpoId,newStatus:newStatus,note:note};
  if(typeof MFXApi!=='undefined'&&MFXApi.postJSON){
    MFXApi.postJSON('/api/transitionStatus',postBody).then(function(resp){
      vpo.status=newStatus;
      if(action==='approve'){
        vpo.approvedBy=getUserName();vpo.approvedAt=new Date().toISOString();vpo.ceoNotes=note;
        vpo.log=vpo.log||[];vpo.log.push({action:'Approved (server-verified)'+(note?' — '+note:''),by:getUserName(),at:new Date().toISOString()});
        toast(vpo.vpoNum+' APPROVED','ok');
        notifyTeam('✅ VPO APPROVED: '+vpo.vpoNum+' — '+vpo.vendorName+' '+fmt$(vpo.total));
        DB&&DB.logActivity&&DB.logActivity('vpo.approved',vpo.vpoNum+' approved');
        MFX&&MFX.emit&&MFX.emit('vpo.approved',{vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,total:vpo.total});
        setTimeout(function(){vpSendToVendor(vpo.id)},800);
      }else{
        vpo.rejectedBy=getUserName();vpo.rejectedAt=new Date().toISOString();vpo.rejectionReason=note;
        vpo.log=vpo.log||[];vpo.log.push({action:'Rejected (server-verified): '+note,by:getUserName(),at:new Date().toISOString()});
        toast(vpo.vpoNum+' rejected','err');
        notifyTeam('❌ VPO REJECTED: '+vpo.vpoNum+' — '+note+' ('+vpo.submittedBy+' to revise)');
        MFX&&MFX.emit&&MFX.emit('vpo.rejected',{vpoId:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName});
      }
      closeModal();renderVendorPOs();
    }).catch(function(err){
      if(btn){btn.disabled=false;btn.textContent=action==='approve'?'Approve & Send to Vendor':'Reject PO'}
      toast('Server: '+err.message,'err');
    });
  }else{
    // Fallback: direct Firestore if API unavailable (degraded mode)
    console.warn('VPO approval: transitionStatus API unavailable, using direct write');
    var update={status:newStatus,updatedAt:new Date().toISOString(),updatedBy:getUserName()};
    if(action==='approve'){update.approvedBy=getUserName();update.approvedAt=update.updatedAt;if(note)update.ceoNotes=note}
    else{update.rejectedBy=getUserName();update.rejectedAt=update.updatedAt;if(note)update.rejectionReason=note}
    fbDb.collection('vendorPOs').doc(vpoId).update(update).then(function(){
      vpo.status=newStatus;
      toast(vpo.vpoNum+(action==='approve'?' APPROVED':' rejected'),action==='approve'?'ok':'err');
      if(action==='approve'){notifyTeam('✅ VPO APPROVED: '+vpo.vpoNum);MFX&&MFX.emit&&MFX.emit('vpo.approved',{vpoId:vpo.id});setTimeout(function(){vpSendToVendor(vpo.id)},800)}
      else{notifyTeam('❌ VPO REJECTED: '+vpo.vpoNum+' — '+note)}
      closeModal();renderVendorPOs();
    }).catch(function(e){toast('Error: '+e.message,'err');if(btn){btn.disabled=false}});
  }
}
window.vpDoServerApprove=vpDoServerApprove;

// ─── PDF & EMAIL (full implementations) ──────────────────────────

function vpBuildPDFHTML(vpo,isVendorCopy){
  var termsDays={'Net 30':30,'Net 45':45,'Net 60':60,'Due on Receipt':0,'Prepaid':-1,'Net 15':15,'Net 90':90};
  var days=termsDays[vpo.terms]||30;var due=new Date();if(days>=0)due.setDate(due.getDate()+days);
  var internalRef='';
  if(!isVendorCopy&&(vpo.forJTNum||vpo.forSONum||vpo.forCompany)){
    internalRef='<tr><td colspan="5" style="padding:8px 14px;background:#051018;border-top:1px solid #1a2d40"><div style="font-size:8px;color:#00e5ff;letter-spacing:2px;margin-bottom:3px">INTERNAL REFERENCE — NOT FOR VENDOR</div><div style="font-size:10px;color:#94a3b8">'+(vpo.forCompany?'Client: <strong style="color:#e0f2fe">'+esc(vpo.forCompany)+'</strong> &nbsp;':'')+(vpo.forSONum?'SO: <strong style="color:#e0f2fe">'+esc(vpo.forSONum)+'</strong> &nbsp;':'')+(vpo.forJTNum?'JT: <strong style="color:#e0f2fe">'+esc(vpo.forJTNum)+'</strong>':'')+'</div></td></tr>';
  }
  return'<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#060d14;color:#e0f2fe;padding:20px}</style></head><body>'
  +'<table cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;margin:0 auto">'
  +'<tr><td style="height:4px;background:#00e5ff"></td></tr>'
  +'<tr><td style="padding:20px 24px;background:#0a1520;border-bottom:1px solid #1a2d40"><table width="100%"><tr>'
  +'<td><div style="font-size:22px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:60px;height:2px;background:#00e5ff;margin:3px 0"></div><div style="font-size:7px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div><div style="font-size:9px;color:#64748b;margin-top:6px">'+MFX_ADDRESS.address+'<br>'+MFX_ADDRESS.city+'<br>'+MFX_ADDRESS.phone+'</div></td>'
  +'<td style="text-align:right;vertical-align:top"><div style="font-size:9px;color:#00e5ff;letter-spacing:2px;margin-bottom:4px">PURCHASE ORDER</div><div style="font-size:24px;font-weight:900;color:#00e5ff">'+esc(vpo.vpoNum)+'</div><div style="font-size:9px;color:#64748b;margin-top:4px">Date: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})+'</div><div style="font-size:9px;color:#64748b">Terms: <strong style="color:#e0f2fe">'+esc(vpo.terms||'Net 30')+'</strong></div><div style="font-size:9px;color:#64748b">Payment Due: <strong style="color:#e0f2fe">'+due.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</strong></div></td>'
  +'</tr></table></td></tr>'
  +'<tr><td style="padding:0 24px"><table width="100%" style="margin:16px 0"><tr>'
  +'<td style="vertical-align:top;width:50%"><div style="font-size:8px;color:#00e5ff;letter-spacing:2px;margin-bottom:6px">VENDOR</div><div style="font-size:13px;font-weight:700;color:#e0f2fe">'+esc(vpo.vendorName)+'</div>'+(vpo.vendorEmail?'<div style="font-size:10px;color:#94a3b8">'+esc(vpo.vendorEmail)+'</div>':'')+(vpo.vendorPhone?'<div style="font-size:10px;color:#94a3b8">'+esc(vpo.vendorPhone)+'</div>':'')+'</td>'
  +'<td style="vertical-align:top;width:50%"><div style="font-size:8px;color:#00e5ff;letter-spacing:2px;margin-bottom:6px">BILL TO / SHIP TO</div><div style="font-size:13px;font-weight:700;color:#e0f2fe">'+MFX_ADDRESS.name+'</div><div style="font-size:10px;color:#94a3b8">'+MFX_ADDRESS.address+'</div><div style="font-size:10px;color:#94a3b8">'+MFX_ADDRESS.city+'</div></td>'
  +'</tr></table></td></tr>'
  +'<tr><td style="padding:0 24px 16px"><table width="100%" style="border:1px solid #1a2d40;border-collapse:collapse">'
  +'<tr style="background:#0a1a28"><th style="padding:8px 14px;font-size:9px;color:#00e5ff;letter-spacing:2px;text-align:left" colspan="2">DESCRIPTION</th><th style="padding:8px 14px;font-size:9px;color:#00e5ff;text-align:center">QTY</th><th style="padding:8px 14px;font-size:9px;color:#00e5ff;text-align:center">UNIT</th><th style="padding:8px 14px;font-size:9px;color:#00e5ff;text-align:right">UNIT COST</th><th style="padding:8px 14px;font-size:9px;color:#00e5ff;text-align:right">TOTAL</th></tr>'
  +'<tr style="border-top:1px solid #1a2d40"><td colspan="2" style="padding:12px 14px;color:#e0f2fe"><strong>'+esc(vpo.material)+'</strong>'+(vpo.materialSpec?'<div style="font-size:9px;color:#64748b;margin-top:2px">'+esc(vpo.materialSpec)+'</div>':'')+(vpo.materialCategory?'<div style="font-size:9px;color:#64748b">'+esc(vpo.materialCategory)+'</div>':'')+'</td><td style="padding:12px 14px;text-align:center;color:#94a3b8">'+esc(vpo.quantity)+'</td><td style="padding:12px 14px;text-align:center;color:#94a3b8">'+esc(vpo.unit||'ft')+'</td><td style="padding:12px 14px;text-align:right;color:#94a3b8">'+fmt$(vpo.unitCost)+'</td><td style="padding:12px 14px;text-align:right;font-weight:700;color:#e0f2fe">'+fmt$(vpo.total)+'</td></tr>'
  +internalRef
  +'<tr style="background:#0a2e3e;border-top:2px solid #00e5ff"><td colspan="5" style="padding:10px 14px;font-size:12px;font-weight:700;color:#e0f2fe">TOTAL</td><td style="padding:10px 14px;font-size:16px;font-weight:900;color:#00e5ff;text-align:right">'+fmt$(vpo.total)+'</td></tr>'
  +'</table></td></tr>'
  +'<tr><td style="padding:0 24px 16px"><table width="100%" style="font-size:10px;color:#64748b">'+(vpo.eta?'<tr><td>Expected Delivery: <strong style="color:#e0f2fe">'+fmtDate(vpo.eta)+'</strong></td></tr>':'')+(vpo.shippingMethod?'<tr><td>Shipping: <strong style="color:#e0f2fe">'+esc(vpo.shippingMethod)+'</strong></td></tr>':'')+(vpo.notes?'<tr><td style="padding-top:6px">Notes: '+esc(vpo.notes)+'</td></tr>':'')+'</table></td></tr>'
  +'<tr><td style="padding:16px 24px;border-top:1px solid #1a2d40"><table width="100%"><tr><td style="vertical-align:bottom;width:50%"><div style="border-top:1px solid #1a2d40;padding-top:6px;margin-right:20px"><div style="font-size:10px;color:#e0f2fe;font-weight:700">'+MFX_ADDRESS.contact+'</div><div style="font-size:9px;color:#64748b">'+MFX_ADDRESS.title+', '+MFX_ADDRESS.name+'</div>'+(vpo.approvedAt?'<div style="font-size:9px;color:#22c55e">Approved: '+fmtDate(vpo.approvedAt)+'</div>':'')+'</div></td><td style="text-align:right;vertical-align:bottom"><div style="font-size:8px;color:#3a5060">'+MFX_ADDRESS.web+' · '+MFX_ADDRESS.email+'</div><div style="font-size:7px;color:#3a5060">SQF Certified | Made in USA</div></td></tr></table></td></tr>'
  +'</table></body></html>';
}

function vpPreviewPDF(vpoId){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  var w=window.open('','_blank','width=800,height=900');
  if(w){w.document.write(vpBuildPDFHTML(vpo,false));w.document.close()}
  else toast('Allow pop-ups to preview PDF','err');
}

function vpGeneratePDFBlob(vpo){
  return new Promise(function(resolve,reject){
    var jsPDF=window.jspdf?window.jspdf.jsPDF:window.jsPDF;
    if(!jsPDF){reject(new Error('jsPDF not loaded'));return}
    var iframe=document.createElement('iframe');
    iframe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:800px;height:1100px;border:none';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();iframe.contentDocument.write(vpBuildPDFHTML(vpo,true));iframe.contentDocument.close();
    setTimeout(function(){
      try{
        var doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter'});
        doc.html(iframe.contentDocument.body,{callback:function(pdf){document.body.removeChild(iframe);resolve(pdf)},x:0,y:0,width:612,windowWidth:800,html2canvas:{scale:0.75,backgroundColor:'#060d14'}});
      }catch(e){document.body.removeChild(iframe);reject(e)}
    },800);
  });
}

function vpSendToVendor(vpoId){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  if(!vpo.vendorEmail)return toast('No vendor email — update vendor profile','err');
  toast('📄 Generating PDF and sending to vendor...','ok');
  getGoogleToken().then(function(token){
    if(!token)return toast('Gmail token required','err');
    vpGeneratePDFBlob(vpo).then(function(pdf){
      var b64=pdf.output('datauristring').split(',')[1];
      var fname=vpo.vpoNum+'_'+vpo.vendorName.replace(/[^a-zA-Z0-9]/g,'-')+'.pdf';
      var body='<div style="font-family:Arial,sans-serif;padding:20px;background:#f8f9fa"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden"><div style="background:#060d14;padding:20px;text-align:center"><div style="font-size:22px;font-weight:900;color:#e0f2fe">Microflex</div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></div><div style="padding:24px"><p style="color:#1e293b;font-size:14px">Dear '+vpo.vendorName+',</p><p style="color:#475569;font-size:13px;margin-top:12px">Please find attached Purchase Order <strong>'+vpo.vpoNum+'</strong> from Microflex Film Corporation.</p><div style="background:#f1f5f9;border-radius:6px;padding:14px;margin:16px 0;font-size:12px;color:#475569"><div><strong>Material:</strong> '+vpo.material+'</div><div style="margin-top:4px"><strong>Quantity:</strong> '+vpo.quantity+' '+(vpo.unit||'')+'</div><div style="margin-top:4px"><strong>Total:</strong> '+fmt$(vpo.total)+'</div><div style="margin-top:4px"><strong>Terms:</strong> '+(vpo.terms||'Net 30')+'</div>'+(vpo.eta?'<div style="margin-top:4px"><strong>Requested Delivery:</strong> '+fmtDate(vpo.eta)+'</div>':'')+'</div>'+(vpo.notes?'<p style="color:#475569;font-size:13px"><strong>Notes:</strong> '+vpo.notes+'</p>':'')+'<p style="color:#475569;font-size:13px;margin-top:12px">Please confirm receipt and provide expected delivery date by replying to this email.</p><p style="color:#475569;font-size:13px;margin-top:16px">Thank you,<br><strong>'+MFX_ADDRESS.contact+'</strong><br>'+MFX_ADDRESS.title+', '+MFX_ADDRESS.name+'<br>'+MFX_ADDRESS.phone+' · '+MFX_ADDRESS.email+'</p></div></div></div>';
      var boundary='MFX_'+Date.now();
      var raw='From: '+MFX_ADDRESS.contact+' <'+MFX_ADDRESS.from+'>\r\nTo: '+vpo.vendorEmail+'\r\nSubject: Purchase Order '+vpo.vpoNum+' — Microflex Film Corporation\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="'+boundary+'"\r\n\r\n--'+boundary+'\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'+body+'\r\n\r\n--'+boundary+'\r\nContent-Type: application/pdf; name="'+fname+'"\r\nContent-Disposition: attachment; filename="'+fname+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+b64+'\r\n--'+boundary+'--';
      var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:encoded})}).then(function(r){return r.json()}).then(function(data){
        if(data.id){
          var upd=vpoGet(vpoId);if(upd){
            upd.status='sent';upd.sentAt=new Date().toISOString();upd.sentTo=vpo.vendorEmail;upd.emailMessageId=data.id;
            upd.log=upd.log||[];upd.log.push({action:'PDF emailed to '+vpo.vendorEmail,by:getUserName(),at:new Date().toISOString()});
            vpoSave(upd).then(function(){
              toast(vpo.vpoNum+' sent to '+vpo.vendorEmail,'ok');
              vpSavePDFToDrive(upd,pdf,fname,token);
              vpOnSent(upd);
              // Log comm on vendor
              if(upd.vendorId)fbDb.collection('vendorComms').add({vendorId:upd.vendorId,type:'email',at:new Date().toISOString(),summary:'PO email sent: '+vpo.vpoNum+' — '+vpo.material+' '+fmt$(vpo.total),by:getUserName(),gmailId:data.id,createdAt:new Date().toISOString()}).catch(function(e){console.warn('op:',e)});
              renderVendorPOs();
            });
          }
        }else{console.error('Gmail error:',data);toast('Gmail error','err')}
      }).catch(function(e){toast('Email failed: '+e.message,'err')});
    }).catch(function(e){toast('PDF error: '+e.message,'err')});
  });
}

function vpSavePDFToDrive(vpo,pdf,filename,token){
  findOrCreateSharedFolder(token,'Vendor POs').then(function(folderId){
    if(!folderId)return;
    var form=new FormData();
    form.append('metadata',new Blob([JSON.stringify({name:filename,mimeType:'application/pdf',parents:[folderId]})],{type:'application/json'}));
    form.append('file',pdf.output('blob'),'application/pdf');
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{method:'POST',headers:{'Authorization':'Bearer '+token},body:form}).then(function(r){return r.json()}).then(function(fd){
      if(fd.id){var link='https://drive.google.com/file/d/'+fd.id+'/view';fbDb.collection('vendorPOs').doc(vpo.id).update({driveLink:link,driveSavedAt:new Date().toISOString()});toast('PDF saved to Drive ☁','ok')}
    }).catch(function(e){console.warn('Drive save failed:',e)});
  }).catch(function(e){console.warn('Drive folder error:',e)});
}

function vpOnSent(vpo){
  // Job Ticket
  if(vpo.forJTId){var jt=(_jtCache||[]).find(function(t){return t.id===vpo.forJTId});if(jt){jt.jtPOs=jt.jtPOs||[];var ei=jt.jtPOs.findIndex(function(p){return p.vpoNum===vpo.vpoNum});var ref={id:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,material:vpo.material,quantity:vpo.quantity,unit:vpo.unit,total:vpo.total,eta:vpo.eta,status:'sent',createdAt:vpo.createdAt};if(ei>=0)jt.jtPOs[ei]=ref;else jt.jtPOs.push(ref);jt.log=jt.log||[];jt.log.push({action:'VPO sent: '+vpo.vpoNum,by:getUserName(),at:new Date().toISOString()});fbDb.collection('jobTickets').doc(jt.id).set(jt,{merge:true}).catch(function(e){console.warn('op:',e)})}}
  // Material on-order
  if(vpo.material){var mat=_materialCache.find(function(m){return m.name===vpo.material||m.id===vpo.materialId});if(mat){mat.onOrder=(mat.onOrder||0)+vpo.quantity;mat.lastPONum=vpo.vpoNum;mat.lastPODate=new Date().toISOString();materialSave(mat).catch(function(e){console.warn('op:',e)})}}
  // Vendor recentPOs
  if(vpo.vendorId){var vendor=vpoVendorGet(vpo.vendorId);if(vendor){vendor.recentPOs=vendor.recentPOs||[];vendor.recentPOs.unshift({vpoNum:vpo.vpoNum,material:vpo.material,total:vpo.total,status:'sent',eta:vpo.eta,sentAt:vpo.sentAt});if(vendor.recentPOs.length>20)vendor.recentPOs=vendor.recentPOs.slice(0,20);vpoVendorSave(vendor).catch(function(e){console.warn('op:',e)})}}
  // Notify by material type
  var cat=(vpo.materialCategory||'').toLowerCase();var mat2=vpo.material.toLowerCase();
  if(cat==='plates'||mat2.indexOf('plate')>-1)notifyTeam('🎨 PRE-PRESS: Plates ordered ('+vpo.vpoNum+') ETA '+fmtDate(vpo.eta)+' from '+vpo.vendorName);
  if(cat==='substrate'||mat2.indexOf('bopp')>-1||mat2.indexOf('substrate')>-1)notifyTeam('📦 LOGISTICS: Substrate ordered ('+vpo.vpoNum+') ETA '+fmtDate(vpo.eta)+' — '+vpo.material);
  // Client materialActivity
  if(vpo.forCompany){fbDb.collection('customers').where('company','==',vpo.forCompany).limit(1).get().then(function(snap){if(snap.empty)return;var doc=snap.docs[0];var acts=doc.data().materialActivity||[];acts.unshift({vpoNum:vpo.vpoNum,material:vpo.material,forJTNum:vpo.forJTNum,total:vpo.total,eta:vpo.eta,at:new Date().toISOString()});if(acts.length>30)acts=acts.slice(0,30);fbDb.collection('customers').doc(doc.id).update({materialActivity:acts}).catch(function(e){console.warn('op:',e)})}).catch(function(e){console.warn('op:',e)})}
  // Activity
  fbDb.collection('activity').add({type:'vpo.sent',vpoNum:vpo.vpoNum,vendor:vpo.vendorName,material:vpo.material,total:vpo.total,forJTNum:vpo.forJTNum||'',by:getUserName(),timestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(function(e){console.warn('op:',e)});
}

// ─── RECEIVE MATERIAL ─────────────────────────────────────────────

function vpReceiveModal(vpoId){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  var h='<div class="modal-title">Receive Material — '+vpo.vpoNum+'</div>';
  h+='<div style="background:var(--bg2);border-radius:6px;padding:8px;margin-bottom:10px;font-size:10px"><div style="color:var(--tx)">'+vpo.material+'</div><div style="color:var(--tx3)">From: '+vpo.vendorName+' · Ordered: '+vpo.quantity+' '+(vpo.unit||'')+'</div></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Qty Received*','vpRecQty',vpo.quantity,'number');h+=vpF('Lot Number*','vpRecLot','');
  h+=vpF('Received By','vpRecBy',getUserName(),'select',['Randy Vazquez','Laura Ornelas','Alejandra Hernandez','Moises Santillan','Fatima Gomez','Jonathan']);
  h+=vpF('Condition','vpRecCondition','Good','select',['Good','Damaged','Partial','Short Ship']);
  h+=vpF('SQF Cert #','vpRecSQF','');h+=vpF('Expires','vpRecExpires','','date');
  h+='</div>';h+=vpF('Receiving Notes','vpRecNotes','','textarea','',2);
  h+='<button class="btn btn-gn" onclick="vpConfirmReceive(\''+vpoId+'\')" style="width:100%;margin-top:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Confirm Receipt</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpConfirmReceive(vpoId){
  var vpo=vpoGet(vpoId);if(!vpo)return;
  var lot=gv('vpRecLot');if(!lot)return toast('Lot number required for SQF traceability','err');
  var qty=gf('vpRecQty')||vpo.quantity;var condition=gv('vpRecCondition');var recBy=gv('vpRecBy')||getUserName();

  vpo.status='received';vpo.receivedAt=new Date().toISOString();vpo.receivedBy=recBy;
  vpo.receivedQty=qty;vpo.lotNumber=lot;vpo.receivedCondition=condition;vpo.receivedNotes=gv('vpRecNotes');
  vpo.log=vpo.log||[];vpo.log.push({action:'Received — Lot# '+lot+' Qty: '+qty+' Condition: '+condition,by:getUserName(),at:new Date().toISOString()});

  // Create materialLots record for SQF traceability
  var lotDoc={
    id:'lot_'+Date.now(),lotNum:lot,
    materialId:vpo.materialId||null,material:vpo.material,materialCategory:vpo.materialCategory||'',
    vendorId:vpo.vendorId||null,vendorName:vpo.vendorName,
    vpoId:vpo.id,vpoNum:vpo.vpoNum,
    quantity:qty,unit:vpo.unit||'ft',
    receivedAt:new Date().toISOString(),receivedBy:recBy,condition:condition,
    sqfCertNum:gv('vpRecSQF'),expiresAt:gv('vpRecExpires')||null,
    usedOnJTs:[],usedOnSOs:[],
    createdAt:new Date().toISOString()
  };

  Promise.all([
    vpoSave(vpo),
    fbDb.collection('materialLots').doc(lotDoc.id).set(lotDoc),
    // Finance vendorPOs sync
    fbDb.collection('vendorPOs').doc(vpo.id).set({
      id:vpo.id,vpoNum:vpo.vpoNum,vendorName:vpo.vendorName,vendorEmail:vpo.vendorEmail||'',
      material:vpo.material,quantity:vpo.quantity,unitCost:vpo.unitCost,total:vpo.total,
      eta:vpo.eta,dueDate:vpo.eta,status:'received',
      forSONum:vpo.forSONum||'',forJTNum:vpo.forJTNum||'',
      receivedAt:vpo.receivedAt,receivedBy:recBy,receivedQty:qty,lotNumber:lot,
      createdAt:vpo.createdAt,updatedAt:new Date().toISOString(),source:'mfx-os'
    },{merge:true})
  ]).then(function(){
    toast(vpo.vpoNum+' received — Lot# '+lot,'ok');
    if(typeof MFX!=='undefined'&&MFX.emit) MFX.emit('vpo.received', {vpoId:vpo.id, vendor:vpo.vendorName, material:vpo.material, vpoNum:vpo.vpoNum, lot:lot, qty:qty, condition:condition, materialCategory:vpo.materialCategory||'', unit:vpo.unit||'ft', receivedBy:recBy, sqfCertNum:gv('vpRecSQF')||''});
    vpOnReceived(vpo,lotDoc);
    // Update vendor delivery performance
    vpRecordDelivery(vpo);
    closeModal();renderVendorPOs();
  });
}

function vpRecordDelivery(vpo){
  if(!vpo.vendorId)return;
  var vendor=vpoVendorGet(vpo.vendorId);if(!vendor)return;
  vendor.deliveryPerformance=vendor.deliveryPerformance||{onTimeCount:0,lateCount:0,avgDaysLate:0};
  if(vpo.eta){
    var late=new Date(vpo.receivedAt)>new Date(vpo.eta);
    if(late){vendor.deliveryPerformance.lateCount++;var dL=Math.round((new Date(vpo.receivedAt)-new Date(vpo.eta))/(1000*60*60*24));vendor.deliveryPerformance.totalDaysLate=(vendor.deliveryPerformance.totalDaysLate||0)+dL;vendor.deliveryPerformance.avgDaysLate=Math.round(vendor.deliveryPerformance.totalDaysLate/vendor.deliveryPerformance.lateCount)}
    else{vendor.deliveryPerformance.onTimeCount++}
  }
  // Recalculate health
  var h=vpCalcVendorHealth(vendor);
  vendor.lastHealthScore=h;vendor.lastHealthAt=new Date().toISOString();
  if(vendor.recentPOs){var pi=vendor.recentPOs.findIndex(function(p){return p.vpoNum===vpo.vpoNum});if(pi>=0){vendor.recentPOs[pi].status='received';vendor.recentPOs[pi].actualDelivery=vpo.receivedAt}}
  vpoVendorSave(vendor).catch(function(e){console.warn('op:',e)});
}

function vpOnReceived(vpo,lotDoc){
  // Update material inventory
  var mat=_materialCache.find(function(m){return m.name===vpo.material||m.id===vpo.materialId});
  if(mat){
    mat.onHand=(mat.onHand||0)+vpo.receivedQty;mat.onOrder=Math.max(0,(mat.onOrder||0)-vpo.quantity);
    mat.lastReceivedDate=new Date().toISOString();
    mat.lotHistory=mat.lotHistory||[];mat.lotHistory.unshift({lotNum:vpo.lotNumber,qty:vpo.receivedQty,receivedDate:vpo.receivedAt,vpoNum:vpo.vpoNum,vendor:vpo.vendorName,condition:vpo.receivedCondition,usedOn:[]});
    if(mat.lotHistory.length>50)mat.lotHistory=mat.lotHistory.slice(0,50);
    materialSave(mat).catch(function(e){console.warn('op:',e)});
  }else{
    // Auto-create material record
    materialSave({id:'mat_'+Date.now(),name:vpo.material,spec:vpo.materialSpec||'',category:vpo.materialCategory||'Substrate',vendorId:vpo.vendorId||null,vendorName:vpo.vendorName,unitCost:vpo.unitCost,unit:vpo.unit||'ft',onHand:vpo.receivedQty,onOrder:0,reorderPoint:null,sqfTraceable:true,lotHistory:[{lotNum:vpo.lotNumber,qty:vpo.receivedQty,receivedDate:vpo.receivedAt,vpoNum:vpo.vpoNum,vendor:vpo.vendorName,condition:vpo.receivedCondition,usedOn:[]}],createdAt:new Date().toISOString()}).catch(function(e){console.warn('op:',e)});
  }
  // Job Ticket
  if(vpo.forJTId){var jt=(_jtCache||[]).find(function(t){return t.id===vpo.forJTId});if(jt){var pi=(jt.jtPOs||[]).findIndex(function(p){return p.vpoNum===vpo.vpoNum});if(pi>=0){jt.jtPOs[pi].status='received';jt.jtPOs[pi].receivedAt=vpo.receivedAt;jt.jtPOs[pi].lotNumber=vpo.lotNumber}var allRec=(jt.jtPOs||[]).every(function(p){return p.status==='received'||p.status==='paid'});jt.log=jt.log||[];jt.log.push({action:'Material received: '+vpo.vpoNum+' Lot# '+vpo.lotNumber,by:getUserName(),at:new Date().toISOString()});fbDb.collection('jobTickets').doc(jt.id).set(jt,{merge:true}).then(function(){if(allRec){toast('All materials received for '+jt.jtNum,'ok');notifyTeam('📦 ALL MATERIALS IN for '+jt.jtNum+' ('+jt.company+') — ready for Materials Staged')}}).catch(function(e){console.warn('op:',e)})}}
  // Notify
  notifyTeam('📦 MATERIAL RECEIVED: '+vpo.vpoNum+' — '+vpo.material+' Lot# '+vpo.lotNumber+' from '+vpo.vendorName+(vpo.forJTNum?' | Job: '+vpo.forJTNum:''));
  fbDb.collection('activity').add({type:'material.received',vpoNum:vpo.vpoNum,material:vpo.material,lotNumber:vpo.lotNumber,qty:vpo.receivedQty,vendor:vpo.vendorName,forSONum:vpo.forSONum||'',forJTNum:vpo.forJTNum||'',by:getUserName(),timestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(function(e){console.warn('op:',e)});
}

// ─── VPO DETAIL MODAL ─────────────────────────────────────────────

function vpOpenDetail(vpoId){VP.modalVpoId=vpoId;VP.vpoModalTab='overview';vpRenderDetail()}

function vpRenderDetail(){
  var vpo=vpoGet(VP.modalVpoId);if(!vpo)return;
  var sc=STATUS_COLORS[vpo.status]||'var(--tx3)';

  var h='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
  h+='<div><div style="font-size:16px;font-weight:700;color:var(--tx)">'+vpo.vpoNum+'</div>';
  h+='<span style="font-size:9px;color:'+sc+';border:1px solid '+sc+';padding:2px 8px;border-radius:4px">'+STATUS_LABELS[vpo.status]+'</span></div>';
  h+='<div style="text-align:right"><div style="font-size:20px;font-weight:700">'+fmt$(vpo.total)+'</div></div></div>';

  var tabs=[{k:'overview',l:'Overview'},{k:'accounting',l:'Accounting'},{k:'log',l:'Log'}];
  h+='<div style="display:flex;gap:0;margin-bottom:10px;border-bottom:1px solid var(--bdr)">';
  tabs.forEach(function(t){h+='<div onclick="VP.vpoModalTab=\''+t.k+'\';vpRenderDetail()" style="padding:7px 12px;font-size:10px;cursor:pointer;border-bottom:2px solid '+(VP.vpoModalTab===t.k?'var(--ac)':'transparent')+';color:'+(VP.vpoModalTab===t.k?'var(--ac)':'var(--tx3)')+'">'+t.l+'</div>'});
  h+='</div>';

  if(VP.vpoModalTab==='overview'){
    function row(l,v){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px"><span style="color:var(--tx3)">'+l+'</span><span style="color:var(--tx)">'+v+'</span></div>'}
    h+=row('Vendor',vpo.vendorName);h+=row('Email',vpo.vendorEmail||'—');
    h+=row('Material',vpo.material);if(vpo.materialSpec)h+=row('Spec',vpo.materialSpec);
    h+=row('Qty',vpo.quantity+' '+(vpo.unit||''));h+=row('Unit Cost',fmt$(vpo.unitCost));h+=row('Total',fmt$(vpo.total));
    h+=row('Terms',vpo.terms||'Net 30');h+=row('ETA',fmtDate(vpo.eta));
    if(vpo.forJTNum)h+=row('Job Ticket',vpo.forJTNum);if(vpo.forSONum)h+=row('SO',vpo.forSONum);if(vpo.forCompany)h+=row('Client',vpo.forCompany);
    if(vpo.requestedBy)h+=row('Requested',vpo.requestedBy+' · '+fmtDate(vpo.requestedAt));
    if(vpo.approvedBy)h+=row('Approved',vpo.approvedBy+' · '+fmtDate(vpo.approvedAt));
    if(vpo.sentAt)h+=row('Sent',vpo.sentTo+' · '+fmtDate(vpo.sentAt));
    if(vpo.receivedAt)h+=row('Received',vpo.receivedQty+' '+(vpo.unit||'')+' · Lot# '+vpo.lotNumber+' · '+fmtDate(vpo.receivedAt));
    if(vpo.notes)h+='<div style="margin-top:8px;padding:8px;background:var(--bg2);border-radius:4px;font-size:10px;color:var(--tx2)">Notes: '+vpo.notes+'</div>';
    if(vpo.driveLink)h+='<a href="'+vpo.driveLink+'" target="_blank" class="btn btn-ghost btn-xs" style="margin-top:8px;display:inline-block">☁ PDF on Drive</a>';
    // Vendor quick link
    if(vpo.vendorId)h+='<button class="btn btn-ghost btn-xs" onclick="closeModal();vpOpenVendorProfile(\''+vpo.vendorId+'\')" style="margin-top:6px;margin-left:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Vendor Profile</button>';
  }else if(VP.vpoModalTab==='accounting'){
    function ar(l,v){return'<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px"><span style="color:var(--tx3)">'+l+'</span><span style="color:var(--tx)">'+v+'</span></div>'}
    h+=ar('PO Total',fmt$(vpo.total));h+=ar('Paid',fmt$(vpo.paidAmount||0));h+=ar('Balance',fmt$((vpo.total||0)-(vpo.paidAmount||0)));h+=ar('Status',STATUS_LABELS[vpo.status]);
    if(vpo.status==='received'||vpo.status==='sent'){
      h+='<div style="margin-top:10px">';
      h+=vpF('Payment Amount $','vpPayAmt','','number');h+=vpF('Invoice Ref','vpPayRef','');
      h+='<button class="btn btn-gn btn-xs" onclick="vpRecordPayment(\''+vpo.id+'\')" style="margin-top:8px;width:100%"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Record Payment</button></div>';
    }
  }else if(VP.vpoModalTab==='log'){
    var log=(vpo.log||[]).slice().reverse();
    if(!log.length)h+='<div style="color:var(--tx3);text-align:center;padding:20px">No log entries</div>';
    log.forEach(function(l){h+='<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:10px"><span style="color:var(--tx3);white-space:nowrap">'+fmtDT(l.at)+'</span><span style="color:var(--tx2)">'+l.action+'</span><span style="color:var(--tx3);margin-left:auto;white-space:nowrap">'+(l.by||'')+'</span></div>'});
  }

  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  if(vpo.status==='draft')h+='<button class="btn btn-ghost btn-xs" onclick="vpSubmitFromDetail(\''+vpo.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit</button>';
  if(vpo.status==='pending_approval'){h+='<button class="btn btn-pr btn-xs" onclick="vpCEOApprove(\''+vpo.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve</button><button class="btn btn-ghost btn-xs" onclick="vpCEOReject(\''+vpo.id+'\')" style="color:var(--rd);border-color:var(--rd)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject</button>'}
  if(vpo.status==='approved')h+='<button class="btn btn-pr btn-xs" onclick="vpSendToVendor(\''+vpo.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Send PDF</button>';
  if(vpo.status==='sent')h+='<button class="btn btn-gn btn-xs" onclick="closeModal();vpReceiveModal(\''+vpo.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Receive</button>';
  h+='<button class="btn btn-ghost btn-xs" onclick="vpPreviewPDF(\''+vpo.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> PDF</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Close</button></div>';
  openModal(h);
}

function vpSubmitFromDetail(vpoId){var vpo=vpoGet(vpoId);if(!vpo)return;vpo.status='pending_approval';vpo.submittedBy=getUserName();vpo.submittedForApprovalAt=new Date().toISOString();vpo.log=vpo.log||[];vpo.log.push({action:'Submitted for approval',by:getUserName(),at:new Date().toISOString()});vpoSave(vpo).then(function(){notifyTeam('📤 VPO APPROVAL: '+vpo.vpoNum+' — '+vpo.vendorName+' '+fmt$(vpo.total));toast('Submitted','ok');vpRenderDetail()})}

function vpRecordPayment(vpoId){var vpo=vpoGet(vpoId);if(!vpo)return;var amt=gf('vpPayAmt');if(!amt)return toast('Amount required','err');var ref=gv('vpPayRef');var totalPaid=(vpo.paidAmount||0)+amt;var ns=totalPaid>=(vpo.total||0)?'paid':'received';vpo.paidAmount=totalPaid;vpo.status=ns;if(ns==='paid')vpo.paidAt=new Date().toISOString();vpo.invoiceRef=ref||vpo.invoiceRef;vpo.log=vpo.log||[];vpo.log.push({action:'Payment recorded: '+fmt$(amt)+(ref?' Ref: '+ref:''),by:getUserName(),at:new Date().toISOString()});vpoSave(vpo).then(function(){toast('Payment recorded','ok');if(ns==='paid'&&vpo.forJTId){var jt=(_jtCache||[]).find(function(t){return t.id===vpo.forJTId});if(jt&&jt.blueprintId){var bp=typeof getBlueprint==='function'?getBlueprint(jt.blueprintId):null;if(bp){bp.lastMaterialCost=vpo.total;bp.lastMaterialPaidAt=new Date().toISOString();typeof saveBlueprint==='function'&&saveBlueprint(bp).catch(function(e){console.warn('op:',e)})}}}vpRenderDetail()})}

// ─── VENDOR MANAGEMENT ───────────────────────────────────────────

function vpOpenCreateVendor(){
  var h='<div class="modal-title">Add Vendor</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Vendor Name*','vvName','');h+=vpF('Contact Name','vvContact','');h+=vpF('Email*','vvEmail','','email');h+=vpF('Phone','vvPhone','');h+=vpF('Payment Terms','vvTerms','Net 30','select',PAYMENT_TERMS);h+=vpF('Rating (1-5)','vvRating','','select',['','1','2','3','4','5']);h+=vpF('Avg Lead Days','vvLeadDays','30','number');h+=vpF('Payment Method','vvPayMethod','Check','select',['Check','ACH','Wire','Credit Card','Net Account']);
  h+='</div>';h+=vpF('Address','vvAddress','');
  h+='<div style="margin:6px 0">'+vpF('Materials Supplied (comma-separated)','vvMaterials','')+'</div>';
  h+='<div style="margin-bottom:8px">'+vpF('Notes','vvNotes','','textarea','',2)+'</div>';
  h+='<button class="btn btn-pr" onclick="vpSaveVendor()" style="width:100%">Save Vendor</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpSaveVendor(){
  var name=gv('vvName');if(!name)return toast('Name required','err');
  var mats=gv('vvMaterials').split(',').map(function(m){return m.trim()}).filter(Boolean);
  var vendor={id:'vendor_'+Date.now(),name:name,contact:gv('vvContact'),email:gv('vvEmail'),phone:gv('vvPhone'),address:gv('vvAddress'),terms:gv('vvTerms')||'Net 30',rating:parseInt(gv('vvRating'))||null,paymentMethod:gv('vvPayMethod'),avgLeadDays:gf('vvLeadDays')||30,notes:gv('vvNotes'),materials:mats,recentPOs:[],deliveryPerformance:{onTimeCount:0,lateCount:0,avgDaysLate:0},documents:[],qualityScore:null,responsivenessScore:null,pricingStabilityScore:null,docComplianceScore:null,createdAt:new Date().toISOString(),createdBy:getUserName()};
  vpoVendorSave(vendor).then(function(){toast('Vendor saved','ok');closeModal();VP.tab='vendors';renderVendorPOs()});
}

function vpEditVendor(vendorId){
  var v=vpoVendorGet(vendorId);if(!v)return;
  var h='<div class="modal-title">Edit Vendor</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Vendor Name*','vvName',v.name);h+=vpF('Contact','vvContact',v.contact||'');h+=vpF('Email','vvEmail',v.email||'','email');h+=vpF('Phone','vvPhone',v.phone||'');h+=vpF('Terms','vvTerms',v.terms||'Net 30','select',PAYMENT_TERMS);h+=vpF('Rating','vvRating',v.rating?String(v.rating):'','select',['','1','2','3','4','5']);h+=vpF('Avg Lead Days','vvLeadDays',String(v.avgLeadDays||30),'number');h+=vpF('Payment Method','vvPayMethod',v.paymentMethod||'Check','select',['Check','ACH','Wire','Credit Card','Net Account']);
  h+='</div>';h+=vpF('Address','vvAddress',v.address||'');
  h+='<div style="margin:6px 0">'+vpF('Materials (comma-separated)','vvMaterials',(v.materials||[]).join(', '))+'</div>';
  h+='<div style="margin-bottom:8px">'+vpF('Notes','vvNotes',v.notes||'','textarea','',2)+'</div>';
  h+='<button class="btn btn-pr" onclick="vpUpdateVendor(\''+vendorId+'\')" style="width:100%">Save Changes</button>';
  h+='<button class="btn btn-ghost" onclick="VP.vendorTab=\'overview\';vpRenderVendorProfile()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpUpdateVendor(vendorId){
  var v=vpoVendorGet(vendorId);if(!v)return;
  v.name=gv('vvName')||v.name;v.contact=gv('vvContact');v.email=gv('vvEmail');v.phone=gv('vvPhone');v.address=gv('vvAddress');v.terms=gv('vvTerms')||v.terms;v.rating=parseInt(gv('vvRating'))||v.rating;v.paymentMethod=gv('vvPayMethod');v.avgLeadDays=gf('vvLeadDays')||v.avgLeadDays;v.notes=gv('vvNotes');
  var mats=gv('vvMaterials').split(',').map(function(m){return m.trim()}).filter(Boolean);if(mats.length)v.materials=mats;
  vpoVendorSave(v).then(function(){toast('Vendor updated','ok');VP.vendorTab='overview';vpRenderVendorProfile()});
}

function vpSaveHealthScores(vendorId){
  var v=vpoVendorGet(vendorId);if(!v)return;
  var q=gf('vpHealthQuality');var r=gf('vpHealthResp');var p=gf('vpHealthPrice');var d=gf('vpHealthDoc');
  if(q!==null&&q!==undefined&&q!=='')v.qualityScore=Math.min(100,Math.max(0,q));if(r!==null&&r!==undefined&&r!=='')v.responsivenessScore=Math.min(100,Math.max(0,r));if(p!==null&&p!==undefined&&p!=='')v.pricingStabilityScore=Math.min(100,Math.max(0,p));if(d!==null&&d!==undefined&&d!=='')v.docComplianceScore=Math.min(100,Math.max(0,d));
  v.lastHealthScore=vpCalcVendorHealth(v);v.lastHealthAt=new Date().toISOString();
  vpoVendorSave(v).then(function(){toast('Health scores saved','ok');VP.vendorTab='health';vpRenderVendorProfile()});
}

function vpUploadVendorDoc(vendorId){
  var types=['SDS','COA','Insurance Certificate','Food Safety Cert','SQF Cert','Other'];
  var h='<div class="modal-title">Upload Vendor Document</div>';
  h+=vpF('Document Name','vpDocName','');h+=vpF('Type','vpDocType','COA','select',types);h+=vpF('Document URL (Google Drive link)','vpDocUrl','');h+=vpF('Expires','vpDocExpires','','date');
  h+='<button class="btn btn-pr" onclick="vpSaveVendorDoc(\''+vendorId+'\')" style="width:100%;margin-top:8px">Save Document</button>';
  h+='<button class="btn btn-ghost" onclick="VP.vendorTab=\'docs\';vpRenderVendorProfile()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpSaveVendorDoc(vendorId){
  var v=vpoVendorGet(vendorId);if(!v)return;
  var name=gv('vpDocName');if(!name)return toast('Name required','err');
  v.documents=v.documents||[];v.documents.push({id:'doc_'+Date.now(),name:name,type:gv('vpDocType'),url:gv('vpDocUrl'),expiresAt:gv('vpDocExpires')||null,addedAt:new Date().toISOString(),addedBy:getUserName()});
  vpoVendorSave(v).then(function(){toast('Document saved','ok');VP.vendorTab='docs';vpRenderVendorProfile()});
}

// ─── MATERIAL MANAGEMENT ─────────────────────────────────────────

function vpOpenCreateMaterial(){
  var vendorOpts=_vendorCache.map(function(v){return{id:v.name,name:v.name}});
  var h='<div class="modal-title">Add Material</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Material Name*','vmName','');h+=vpF('Category','vmCat','Substrate','select',MATERIAL_CATEGORIES);h+=vpF('Full Spec / Description','vmSpec','');h+=vpF('Primary Vendor','vmVendor','','select',vendorOpts);h+=vpF('Unit Cost $','vmCost','','number');h+=vpF('Unit','vmUnit','ft','select',UNITS);h+=vpF('On Hand','vmOnHand','','number');h+=vpF('On Order','vmOnOrder','','number');h+=vpF('Reorder Point','vmReorder','','number');h+=vpF('Reorder Qty','vmReorderQty','','number');
  h+='</div>';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><input type="checkbox" id="vmSQF" checked><label for="vmSQF" style="font-size:11px;color:var(--tx2)">SQF Traceable (required for Ed.10 compliance)</label></div>';
  h+='<button class="btn btn-pr" onclick="vpSaveMaterial()" style="width:100%">Save Material</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpSaveMaterial(){
  var name=gv('vmName');if(!name)return toast('Name required','err');
  var vendorName=gv('vmVendor');var vendor=_vendorCache.find(function(v){return v.name===vendorName});var sqf=$('vmSQF')?$('vmSQF').checked:true;
  var mat={id:'mat_'+Date.now(),name:name,spec:gv('vmSpec'),category:gv('vmCat'),vendorId:vendor?vendor.id:null,vendorName:vendorName||'',unitCost:gf('vmCost'),unit:gv('vmUnit')||'ft',onHand:gf('vmOnHand'),onOrder:gf('vmOnOrder'),reorderPoint:gf('vmReorder')||null,reorderQty:gf('vmReorderQty')||null,sqfTraceable:sqf,lotHistory:[],createdAt:new Date().toISOString(),createdBy:getUserName()};
  materialSave(mat).then(function(){toast('Material saved','ok');closeModal();VP.tab='materials';renderVendorPOs()});
}

function vpEditMaterial(matId){
  var m=materialGet(matId);if(!m)return;
  var vendorOpts=_vendorCache.map(function(v){return{id:v.name,name:v.name}});
  var h='<div class="modal-title">Edit Material</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Name*','vmName',m.name);h+=vpF('Category','vmCat',m.category||'','select',MATERIAL_CATEGORIES);h+=vpF('Spec','vmSpec',m.spec||'');h+=vpF('Vendor','vmVendor',m.vendorName||'','select',vendorOpts);h+=vpF('Unit Cost $','vmCost',m.unitCost||'','number');h+=vpF('Unit','vmUnit',m.unit||'ft','select',UNITS);h+=vpF('On Hand','vmOnHand',m.onHand!==undefined?String(m.onHand):'','number');h+=vpF('On Order','vmOnOrder',m.onOrder||'','number');h+=vpF('Reorder Point','vmReorder',m.reorderPoint!==undefined?String(m.reorderPoint):'','number');h+=vpF('Reorder Qty','vmReorderQty',m.reorderQty||'','number');
  h+='</div>';
  h+='<button class="btn btn-pr" onclick="vpUpdateMaterial(\''+matId+'\')" style="width:100%">Save</button>';
  h+='<button class="btn btn-ghost" onclick="VP.materialTab=\'overview\';vpRenderMaterialProfile()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpUpdateMaterial(matId){
  var m=materialGet(matId);if(!m)return;
  var vendorName=gv('vmVendor');var vendor=_vendorCache.find(function(v){return v.name===vendorName});
  m.name=gv('vmName')||m.name;m.spec=gv('vmSpec');m.category=gv('vmCat');m.vendorId=vendor?vendor.id:m.vendorId;m.vendorName=vendorName||m.vendorName;m.unitCost=gf('vmCost');m.unit=gv('vmUnit')||m.unit;m.onHand=gf('vmOnHand');m.onOrder=gf('vmOnOrder');m.reorderPoint=gf('vmReorder');m.reorderQty=gf('vmReorderQty');
  materialSave(m).then(function(){toast('Material updated','ok');VP.materialTab='overview';vpRenderMaterialProfile()});
}

// ─── INVOICES ─────────────────────────────────────────────────────

function vpOpenCreateInvoice(vendorId){
  var vendorOpts=_vendorCache.map(function(v){return{id:v.id,name:v.name}});
  var vpoOpts=_vpoCache.filter(function(v){return v.status==='received'&&!v.paidAt}).map(function(v){return{id:v.id,name:v.vpoNum+' — '+v.material+' '+fmt$(v.total)}});
  var h='<div class="modal-title">Log Vendor Invoice</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=vpF('Invoice #*','invNum','');h+=vpF('Vendor','invVendor',vendorId||'','select',vendorOpts);h+=vpF('Amount*','invAmount','','number');h+=vpF('Invoice Date','invDate',new Date().toISOString().split('T')[0],'date');h+=vpF('Due Date','invDue','','date');h+=vpF('Match to PO','invPO','','select',vpoOpts);
  h+='</div>';h+=vpF('Notes','invNotes','','textarea','',2);
  h+='<button class="btn btn-pr" onclick="vpSaveInvoice()" style="width:100%;margin-top:8px">Save Invoice</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpSaveInvoice(){
  var num=gv('invNum');if(!num)return toast('Invoice # required','err');
  var vendorId=gv('invVendor');var vendor=vendorId?vpoVendorGet(vendorId):null;
  var vpoId=gv('invPO');var vpo=vpoId?vpoGet(vpoId):null;
  var inv={id:'inv_'+Date.now(),invoiceNum:num,vendorId:vendorId,vendorName:vendor?vendor.name:'',amount:gf('invAmount'),invoiceDate:gv('invDate')||new Date().toISOString().split('T')[0],dueDate:gv('invDue'),matchedVpoId:vpoId||null,matchedVpoNum:vpo?vpo.vpoNum:'',notes:gv('invNotes'),paid:false,paidAt:null,createdAt:new Date().toISOString(),createdBy:getUserName()};
  fbDb.collection('vendorInvoices').doc(inv.id).set(inv).then(function(){toast('Invoice saved','ok');closeModal();VP.tab='invoices';renderVendorPOs()});
}

function vpMatchInvoice(invId){
  var vpoOpts=_vpoCache.filter(function(v){return v.status==='received'&&!v.paidAt}).map(function(v){return{id:v.id,name:v.vpoNum+' — '+v.material+' '+fmt$(v.total)}});
  var h='<div class="modal-title">Match Invoice to PO</div>';
  h+=vpF('Select PO','vpMatchPO','','select',vpoOpts);
  h+='<button class="btn btn-pr" onclick="vpDoMatchInvoice(\''+invId+'\')" style="width:100%;margin-top:8px">Match</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function vpDoMatchInvoice(invId){var vpoId=gv('vpMatchPO');if(!vpoId)return toast('Select a PO','err');fbDb.collection('vendorInvoices').doc(invId).update({matchedVpoId:vpoId,matchedVpoNum:vpoGet(vpoId)?vpoGet(vpoId).vpoNum:'',matchedAt:new Date().toISOString()}).then(function(){toast('Matched','ok');closeModal();VP.tab='invoices';renderVendorPOs()})}

function vpPayInvoice(invId){var amt=prompt('Payment amount:');if(!amt)return;var ref=prompt('Reference (check #, ACH ref):','');fbDb.collection('vendorInvoices').doc(invId).update({paid:true,paidAt:new Date().toISOString(),paidBy:getUserName(),paidAmount:parseFloat(amt),paymentRef:ref||''}).then(function(){toast('Invoice paid','ok');renderVendorPOs()})}

// ─── AUTO GENERATE FROM JT ────────────────────────────────────────

function vpAutoGenerateFromJT(jtId){
  var jt=(_jtCache||[]).find(function(t){return t.id===jtId});if(!jt)return toast('Job ticket not found','err');
  var bp=jt.blueprintId&&typeof getBlueprint==='function'?getBlueprint(jt.blueprintId):null;
  var suggestedMaterial=jt.face||'';var suggestedVendor='';var suggestedQty=jt.qty||0;var suggestedUnitCost=0;var suggestedEta='';
  if(jt.jobDueDate){var eta=new Date(jt.jobDueDate);eta.setDate(eta.getDate()-7);suggestedEta=eta.toISOString().split('T')[0]}
  if(suggestedMaterial){var matMatch=_materialCache.find(function(m){return suggestedMaterial.toLowerCase().indexOf(m.name.toLowerCase())>-1||m.name.toLowerCase().indexOf(suggestedMaterial.toLowerCase())>-1});if(matMatch){suggestedMaterial=matMatch.name;suggestedVendor=matMatch.vendorName||'';suggestedUnitCost=matMatch.unitCost||0;if(suggestedVendor){var vend=_vendorCache.find(function(v){return v.name===suggestedVendor});if(vend&&vend.avgLeadDays&&jt.jobDueDate){var etaAdj=new Date(jt.jobDueDate);etaAdj.setDate(etaAdj.getDate()-vend.avgLeadDays);suggestedEta=etaAdj.toISOString().split('T')[0]}}}}
  if(bp&&bp.avgWaste)suggestedQty=Math.ceil(suggestedQty*(1+bp.avgWaste/100));
  vpOpenCreate({vendorName:suggestedVendor,material:suggestedMaterial,quantity:suggestedQty,unitCost:suggestedUnitCost,eta:suggestedEta,forJTId:jtId,forJTNum:jt.jtNum,forSONum:jt.soNum||'',forCompany:jt.company});
}

// ─── EXPOSE GLOBALS ───────────────────────────────────────────────

window.VP=VP;
window.renderVendorPOs=renderVendorPOs;
// Register on MFX_VIEW_RENDERERS so goView('vendorpos') works without wrapper interception
if(!window.MFX_VIEW_RENDERERS)window.MFX_VIEW_RENDERERS={};
window.MFX_VIEW_RENDERERS.vendorpos=renderVendorPOs;
window.vpOpenCreate=vpOpenCreate;
window.vpCalcTotal=vpCalcTotal;
window.vpAutoFillVendor=vpAutoFillVendor;
window.vpAutoFillMaterial=vpAutoFillMaterial;
window.vpSaveDraft=vpSaveDraft;
window.vpSubmitForApproval=vpSubmitForApproval;
window.vpCEOApprove=vpCEOApprove;
window.vpCEOReject=vpCEOReject;
window.vpPreviewPDF=vpPreviewPDF;
window.vpSendToVendor=vpSendToVendor;
window.vpOpenDetail=vpOpenDetail;
window.vpRenderDetail=vpRenderDetail;
window.vpSubmitFromDetail=vpSubmitFromDetail;
window.vpReceiveModal=vpReceiveModal;
window.vpConfirmReceive=vpConfirmReceive;
window.vpRecordPayment=vpRecordPayment;
window.vpOpenVendorProfile=vpOpenVendorProfile;
window.vpRenderVendorProfile=vpRenderVendorProfile;
window.vpOpenCreateVendor=vpOpenCreateVendor;
window.vpSaveVendor=vpSaveVendor;
window.vpEditVendor=vpEditVendor;
window.vpUpdateVendor=vpUpdateVendor;
window.vpSaveHealthScores=vpSaveHealthScores;
window.vpUploadVendorDoc=vpUploadVendorDoc;
window.vpSaveVendorDoc=vpSaveVendorDoc;
window.vpOpenMaterialProfile=vpOpenMaterialProfile;
window.vpRenderMaterialProfile=vpRenderMaterialProfile;
window.vpOpenCreateMaterial=vpOpenCreateMaterial;
window.vpSaveMaterial=vpSaveMaterial;
window.vpEditMaterial=vpEditMaterial;
window.vpUpdateMaterial=vpUpdateMaterial;
window.vpAutoReorder=vpAutoReorder;
window.vpAutoGenerateFromJT=vpAutoGenerateFromJT;
window.vpOpenCreateInvoice=vpOpenCreateInvoice;
window.vpSaveInvoice=vpSaveInvoice;
window.vpMatchInvoice=vpMatchInvoice;
window.vpDoMatchInvoice=vpDoMatchInvoice;
window.vpPayInvoice=vpPayInvoice;
window.vpLogComm=vpLogComm;
window.vpSaveComm=vpSaveComm;
window.vpAIDraftEmail=vpAIDraftEmail;
window.vpGenerateVendorEmail=vpGenerateVendorEmail;
window.vpSendVendorEmail=vpSendVendorEmail;
window.vpAddETAToCalendar=vpAddETAToCalendar;
window.vpCalcVendorHealth=vpCalcVendorHealth;
window.fmt$=fmt$;
window.fmtDate=fmtDate;
window.fmtDT=fmtDT;
window.daysUntil=daysUntil;
window.daysAgo=daysAgo;
// gv, gf, vendorGet, vendorSave are defined in vendor-profile.js — do not export here

// ─── Export caches to window for cross-module access ─────────────
// Firestore listeners in startVPOListeners() update the local vars.
// We re-export after each snapshot via a setter pattern.
Object.defineProperty(window,'_vpoCache',{get:function(){return _vpoCache},set:function(v){_vpoCache=v},configurable:true});
Object.defineProperty(window,'_vendorCache',{get:function(){return _vendorCache},set:function(v){_vendorCache=v},configurable:true});
Object.defineProperty(window,'_materialCache',{get:function(){return _materialCache},set:function(v){_materialCache=v},configurable:true});
Object.defineProperty(window,'_invoiceCache',{get:function(){return _invoiceCache},set:function(v){_invoiceCache=v},configurable:true});
Object.defineProperty(window,'_lotCache',{get:function(){return _lotCache},set:function(v){_lotCache=v},configurable:true});
Object.defineProperty(window,'_commCache',{get:function(){return _commCache},set:function(v){_commCache=v},configurable:true});

// XP
if(typeof XP_ACTIONS!=='undefined'){XP_ACTIONS['vpo.submitted']=0.5;XP_ACTIONS['vpo.approved']=1.0;XP_ACTIONS['vpo.received']=1.5;XP_ACTIONS['vpo.paid']=1.0}

// ─── INIT ─────────────────────────────────────────────────────────

function vpInit(){
  MFX.on('view.vendorpos',function(){renderVendorPOs()});
  var origGoView=window.goView;
  if(typeof origGoView==='function'){window.goView=function(v){origGoView(v);if(v==='vendorpos')renderVendorPOs()}}
  // Reorder check on init
  setTimeout(function(){
    var lowStock=_materialCache.filter(function(m){return m.onHand!==undefined&&m.reorderPoint!==undefined&&m.onHand<=m.reorderPoint});
    if(lowStock.length)notifyTeam('⚠️ STOCK ALERT: '+lowStock.length+' material'+(lowStock.length>1?'s':'')+' below reorder point — check Vendor POs > Materials');
  },5000);
  console.log('✅ MFX Vendor PO System v2 initialized');
}

if(typeof fbDb!=='undefined'){setTimeout(startVPOListeners,2000);setTimeout(vpInit,3000)}
else{document.addEventListener('DOMContentLoaded',function(){setTimeout(startVPOListeners,2000);setTimeout(vpInit,3000)})}

})();
