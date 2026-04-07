// ══════════════════════════════════════════════════════════════════
// MFX OS — Global Search (Instant, In-Memory)
// Zero network calls — searches all cached data instantly on keystroke
// ══════════════════════════════════════════════════════════════════

(function(){
'use strict';

var PAGES=[
  {key:'dashboard',label:'Dashboard',dept:'Home',icon:'grid',tags:'home main overview'},
  {key:'ceodash',label:'CEO Daily Dash',dept:'FlexAi',icon:'bar-chart',tags:'ceo executive kpi metrics ai'},
  {key:'aiops',label:'AI Operations Center',dept:'FlexAi',icon:'cpu',tags:'ai agent flexai operations command'},
  {key:'quotes',label:'Quotes / Estimation',dept:'Client Services',icon:'file-text',tags:'quote estimate rfq pricing bid proposal'},
  {key:'customers',label:'Clients / Accounts',dept:'Client Services',icon:'users',tags:'customer client account crm'},
  {key:'orders',label:'Orders / Sales Orders',dept:'Client Services',icon:'shopping-cart',tags:'order sales po purchase'},
  {key:'sales',label:'Sales Pipeline',dept:'Client Services',icon:'trending-up',tags:'sales deals pipeline revenue'},
  {key:'templates',label:'Specs & Materials',dept:'Client Services',icon:'book',tags:'template material spec substrate sku barcode ink film'},
  {key:'clientservices',label:'Client Services Hub',dept:'Client Services',icon:'headphones',tags:'cs workspace daily dash'},
  {key:'vendorpos',label:'Vendor POs',dept:'Purchasing',icon:'file-text',tags:'vendor purchase order po procurement invoice payment'},
  {key:'vendorprofile',label:'Vendor Hub',dept:'Purchasing',icon:'home',tags:'vendor profile supplier hub management'},
  {key:'ppd',label:'Pre-Press & Design',dept:'Pre-Press',icon:'layers',tags:'ppd prepress design artwork blueprint proof label barcode dieline plate film'},
  {key:'production',label:'Production',dept:'Production',icon:'settings',tags:'production manufacturing job floor press machine equipment'},
  {key:'jobtracker',label:'Job Tracker',dept:'Production',icon:'clipboard',tags:'job ticket tracker lifecycle barcode label sku'},
  {key:'operator',label:'Operator Station',dept:'Production',icon:'monitor',tags:'operator station press floor'},
  {key:'logistics',label:'Logistics & Inventory',dept:'Logistics',icon:'package',tags:'logistics shipping inventory warehouse receiving lot barcode tracking shipment'},
  {key:'quality',label:'Quality Dashboard',dept:'Quality',icon:'shield',tags:'quality qc inspection hold'},
  {key:'capa',label:'CAPA / NCR',dept:'Quality',icon:'alert-triangle',tags:'capa ncr corrective action complaint deviation nonconformance hold reject'},
  {key:'gmp',label:'GMP & Environmental',dept:'FSQMS',icon:'thermometer',tags:'gmp sanitation environmental facility'},
  {key:'audit',label:'SQF Audits',dept:'FSQMS',icon:'check-circle',tags:'audit sqf internal external'},
  {key:'training',label:'Training',dept:'FSQMS',icon:'award',tags:'training certification employee sqf'},
  {key:'doccontrol',label:'Document Control',dept:'FSQMS',icon:'folder',tags:'document control sop procedure'},
  {key:'sqfdatalogs',label:'SQF Data Logs',dept:'FSQMS',icon:'database',tags:'data log temperature pressure sqf'},
  {key:'records',label:'Controlled Records',dept:'FSQMS',icon:'archive',tags:'records controlled sqf'},
  {key:'hr',label:'HR / People',dept:'Operations',icon:'users',tags:'hr human resources employee people'},
  {key:'operations',label:'Operations Hub',dept:'Operations',icon:'activity',tags:'operations ops workspace'},
  {key:'datasync',label:'Data Sync',dept:'FlexAi',icon:'refresh-cw',tags:'sync data import export'},
  {key:'launchpad',label:'Launchpad / Onboarding',dept:'FlexAi',icon:'rocket',tags:'launchpad onboarding getting started'},
  {key:'fsqms',label:'FSQMS Hub',dept:'FSQMS',icon:'shield',tags:'fsqms food safety sqf hub'}
];

var ICONS={
  'grid':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  'bar-chart':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
  'cpu':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>',
  'file-text':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  'users':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  'shopping-cart':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  'trending-up':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  'book':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  'headphones':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  'home':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  'layers':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  'settings':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/></svg>',
  'clipboard':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
  'monitor':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  'package':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
  'shield':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  'alert-triangle':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  'thermometer':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
  'check-circle':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  'award':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
  'folder':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  'database':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  'archive':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  'activity':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  'refresh-cw':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  'rocket':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>'
};

function ico(name){return ICONS[name]||ICONS['grid']}

// ---- Record sources: all in-memory, zero network ----
var RECORD_SOURCES=[
  // Core DB caches (populated by core.js startListeners after auth)
  {get:function(){return typeof DB!=='undefined'&&DB.quotes?DB.quotes():[]},fields:['quoteNum','customerName','jobName','description','fields.custCo'],label:'Quote',view:'quotes',
   fmt:function(d){return (d.quoteNum||'')+(d.customerName||(d.fields&&d.fields.custCo)?(' \u2014 '+(d.customerName||(d.fields&&d.fields.custCo))):'')}},
  {get:function(){return typeof DB!=='undefined'&&DB.customers?DB.customers():[]},fields:['name','company','email','phone'],label:'Client',view:'customers',
   fmt:function(d){return (d.name||d.company||'Unknown')+(d.email?' \u00b7 '+d.email:'')}},
  {get:function(){return typeof DB!=='undefined'&&DB.templates?DB.templates():[]},fields:['name','sku','category','barcode'],label:'Spec',view:'templates',
   fmt:function(d){return (d.name||d.sku||'Unknown')+(d.category?' ('+d.category+')':'')+(d.barcode?' \u00b7 BC: '+d.barcode:'')}},
  // Vendor caches (vendor-pos.js defineProperty — populated by startVPOListeners)
  {get:function(){return window._vendorCache||[]},fields:['name','company','contact','email'],label:'Vendor',view:'vendorprofile',
   fmt:function(d){return (d.name||d.company||'Unknown')+(d.contact?' \u00b7 '+d.contact:'')}},
  {get:function(){return window._vpoCache||[]},fields:['vpoNum','material','vendorName','barcode'],label:'Vendor PO',view:'vendorpos',
   fmt:function(d){return (d.vpoNum||'')+(d.vendorName?' \u2014 '+d.vendorName:'')+(d.material?' \u00b7 '+d.material:'')}},
  {get:function(){return window._materialCache||[]},fields:['name','sku','category','barcode','type'],label:'Material',view:'templates',
   fmt:function(d){return (d.name||d.sku||'Unknown')+(d.category?' ('+d.category+')':'')+(d.barcode?' \u00b7 BC: '+d.barcode:'')}},
  {get:function(){return window._invoiceCache||[]},fields:['invoiceNum','vendorName','amount'],label:'Invoice',view:'vendorpos',
   fmt:function(d){return (d.invoiceNum||'')+(d.vendorName?' \u2014 '+d.vendorName:'')+(d.amount?' \u00b7 $'+d.amount:'')}},
  {get:function(){return window._lotCache||[]},fields:['lotNumber','materialName','sku','barcode','supplier'],label:'Lot',view:'logistics',
   fmt:function(d){return (d.lotNumber||'')+(d.materialName?' \u2014 '+d.materialName:'')+(d.barcode?' \u00b7 BC: '+d.barcode:'')}},
  // Production caches (production.js global functions — populated by startProductionListeners)
  {get:function(){return typeof getJobTickets==='function'?getJobTickets():[]},fields:['jtNum','jobNum','ticketNumber','customerName','clientName','description','soNum','sku','barcode'],label:'Job Ticket',view:'jobtracker',
   fmt:function(d){return (d.jtNum||d.jobNum||d.ticketNumber||'')+(d.customerName||d.clientName?(' \u2014 '+(d.customerName||d.clientName)):'')}},
  {get:function(){return typeof getBlueprints==='function'?getBlueprints():[]},fields:['name','customerName','sku','barcode','description','jobNum'],label:'Blueprint',view:'ppd',
   fmt:function(d){return (d.name||d.sku||'')+(d.customerName?' \u2014 '+d.customerName:'')+(d.barcode?' \u00b7 BC: '+d.barcode:'')}},
  {get:function(){return typeof getPassports==='function'?getPassports():[]},fields:['jpNum','customerName','jobName','sku','status'],label:'Job Passport',view:'production',
   fmt:function(d){return (d.jpNum||'')+(d.customerName||d.jobName?(' \u2014 '+(d.customerName||d.jobName)):'')+(d.status?' \u00b7 '+d.status:'')}},
  // Sales orders (orders.js global function — populated by startSOListeners)
  {get:function(){return typeof getSalesOrders==='function'?getSalesOrders():[]},fields:['soNum','customerName','poNumber','description'],label:'Sales Order',view:'orders',
   fmt:function(d){return (d.soNum||d.poNumber||'')+(d.customerName?' \u2014 '+d.customerName:'')}}
];

// ---- Main search function ----
var _lastQuery='';

function osSearch(q){
  q=(q||'').trim().toLowerCase();
  var el=document.getElementById('osSearchResults');
  if(!el)return;
  if(!q){el.style.display='none';_lastQuery='';return;}
  _lastQuery=q;
  var pageHits=searchPages(q);
  var dataHits=searchRecords(q);
  renderResults(el,pageHits,dataHits,q);
  el.style.display='block';
}

function searchPages(q){
  var results=[];
  for(var i=0;i<PAGES.length;i++){
    var p=PAGES[i];
    if((p.label+' '+p.dept+' '+p.tags).toLowerCase().indexOf(q)!==-1){
      results.push({type:'page',key:p.key,label:p.label,dept:p.dept,icon:p.icon});
    }
  }
  return results;
}

function searchRecords(q){
  var hits=[];
  var seen={};
  for(var s=0;s<RECORD_SOURCES.length&&hits.length<30;s++){
    var src=RECORD_SOURCES[s];
    var data;
    try{data=src.get()}catch(e){continue}
    if(!data||!data.length)continue;
    for(var i=0;i<data.length&&hits.length<30;i++){
      var doc=data[i];
      var id=doc.id||doc._id||(''+s+'_'+i);
      if(seen[id])continue;
      var match=false;
      for(var f=0;f<src.fields.length;f++){
        var key=src.fields[f];
        var val=doc[key];
        // Support nested fields like 'fields.custCo'
        if(!val&&key.indexOf('.')!==-1){var parts=key.split('.');val=doc;for(var p=0;p<parts.length&&val;p++)val=val[parts[p]]}
        if(val&&String(val).toLowerCase().indexOf(q)!==-1){match=true;break}
      }
      if(match){
        seen[id]=1;
        hits.push({type:'record',label:src.label,view:src.view,id:id,text:src.fmt(doc)});
      }
    }
  }
  return hits;
}

// ---- Render ----
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function highlight(text,q){
  if(!q)return esc(text);
  var escaped=esc(text);
  var re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
  return escaped.replace(re,'<mark style="background:#00e5ff30;color:var(--cy);border-radius:2px;padding:0 1px">$1</mark>');
}

function renderResults(el,pageHits,dataHits,q){
  if(q!==_lastQuery)return;
  var h='';
  if(!pageHits.length&&!dataHits.length){
    h='<div style="padding:16px;text-align:center;color:var(--tx3);font-size:11px">No results for "'+esc(q)+'"</div>';
    el.innerHTML=h;return;
  }
  if(pageHits.length){
    h+='<div style="padding:8px 12px 4px;font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Pages</div>';
    for(var i=0;i<Math.min(pageHits.length,8);i++){
      var p=pageHits[i];
      h+='<div class="os-sr" onclick="goView(\''+p.key+'\');toggleHamburger();document.getElementById(\'osSearchInput\').value=\'\';document.getElementById(\'osSearchResults\').style.display=\'none\'" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .15s;border-radius:6px;margin:2px 4px">';
      h+='<span style="color:var(--cy);flex-shrink:0">'+ico(p.icon)+'</span>';
      h+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+highlight(p.label,q)+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3)">'+esc(p.dept)+'</div></div>';
      h+='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg></div>';
    }
  }
  if(dataHits.length){
    h+='<div style="padding:8px 12px 4px;font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--bdr);margin-top:4px">Records</div>';
    for(var j=0;j<Math.min(dataHits.length,20);j++){
      var r=dataHits[j];
      h+='<div class="os-sr" onclick="goView(\''+r.view+'\');toggleHamburger();document.getElementById(\'osSearchInput\').value=\'\';document.getElementById(\'osSearchResults\').style.display=\'none\'" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .15s;border-radius:6px;margin:2px 4px">';
      h+='<span style="background:var(--bg3);border-radius:4px;padding:3px 6px;font-size:8px;font-weight:700;color:var(--cy);flex-shrink:0;text-transform:uppercase">'+esc(r.label)+'</span>';
      h+='<div style="flex:1;min-width:0;font-size:11px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+highlight(r.text,q)+'</div>';
      h+='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg></div>';
    }
  }
  el.innerHTML=h;
}

// ---- Keyboard shortcut ----
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){
    e.preventDefault();
    var ham=document.getElementById('hamMenu');
    if(!ham||!ham.classList.contains('open')){
      if(typeof toggleHamburger==='function')toggleHamburger();
    }
    setTimeout(function(){
      var inp=document.getElementById('osSearchInput');
      if(inp){inp.focus();inp.select();}
    },100);
  }
  if(e.key==='Escape'){
    var res=document.getElementById('osSearchResults');
    if(res)res.style.display='none';
  }
});

window.osSearch=osSearch;

})();

// Hover style
(function(){
  var s=document.createElement('style');
  s.textContent='.os-sr:hover{background:var(--bg3) !important}';
  document.head.appendChild(s);
})();
