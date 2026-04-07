(function(){
  'use strict';
  if(typeof window==='undefined') return;
  var PPD = window.PPD || null;
  if(!PPD) return;

  var EXTRA_TABS = [
    ['estimating','Estimating'],
    ['templates','Templates'],
    ['equipment','Equipment'],
    ['capacity','Capacity'],
    ['quality','Quality']
  ];

  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]; }); }
  function toast(msg,kind){ if(typeof window.toast==='function') window.toast(msg,kind||'ok'); }
  function uid(prefix){ return (prefix||'id')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }
  function dt(v){ try{ var d=v&&v.toDate?v.toDate():new Date(v); return isNaN(d)?'—':d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return '—'; } }
  function dOnly(v){ try{ var d=v&&v.toDate?v.toDate():new Date(v); return isNaN(d)?'':d.toISOString().slice(0,10); }catch(e){ return ''; } }
  function money(n){ return '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function pct(n){ return Number(n||0).toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})+'%'; }
  function asNum(v){ var n=parseFloat(v); return isNaN(n)?0:n; }
  function byDate(arr,key){ return (arr||[]).slice().sort(function(a,b){ return new Date((b&&b[key])||0)-new Date((a&&a[key])||0); }); }
  function field(label, input){ return '<div class="fg"><label>'+esc(label)+'</label>'+input+'</div>'; }
  function meter(label, value, sub){ return '<div class="ppd-metric"><div class="ppd-metric-val">'+esc(value)+'</div><div class="ppd-metric-lbl">'+esc(label)+'</div><div class="ppd-metric-sub">'+esc(sub||'')+'</div></div>'; }
  function cardRow(title, meta, right){ return '<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(title)+'</div><div class="ppd-list-meta">'+esc(meta||'')+'</div></div>'+(right?'<div class="ppd-chip">'+esc(right)+'</div>':'')+'</div>'; }
  function ensureParityState(){
    PPD.estimates = PPD.estimates || [];
    PPD.templates = PPD.templates || [];
    PPD.equipmentProfiles = PPD.equipmentProfiles || [];
    PPD.qcProcedures = PPD.qcProcedures || [];
    PPD.returnMaterials = PPD.returnMaterials || [];
    PPD.parityListenersStarted = PPD.parityListenersStarted || false;
  }

  function requestParityNumber(kind,prefix,fallback){
    if(window.MFX_API && navigator.onLine!==false){
      return window.MFX_API.postJSON('/api/nextSequence',{kind:kind,prefix:prefix}).then(function(r){ return r.formatted; }).catch(function(){ return typeof fallback==='function'?fallback():prefix+Date.now(); });
    }
    return Promise.resolve(typeof fallback==='function'?fallback():prefix+Date.now());
  }

  function ensureListeners(){
    ensureParityState();
    if(PPD.parityListenersStarted || typeof fbDb==='undefined') return;
    PPD.parityListenersStarted = true;
    try{ fbDb.collection('ppdEstimates').limit(300).onSnapshot(function(s){ PPD.estimates = byDate(s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt'); decorate(); }, function(err){ console.warn('ppd-labeltraxx-parity ppdEstimates listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('ppdTemplates').limit(300).onSnapshot(function(s){ PPD.templates = byDate(s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt'); decorate(); }, function(err){ console.warn('ppd-labeltraxx-parity ppdTemplates listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('equipmentProfiles').limit(300).onSnapshot(function(s){ PPD.equipmentProfiles = byDate(s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt'); decorate(); }, function(err){ console.warn('ppd-labeltraxx-parity equipmentProfiles listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('qcProcedures').limit(300).onSnapshot(function(s){ PPD.qcProcedures = byDate(s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt'); decorate(); }, function(err){ console.warn('ppd-labeltraxx-parity qcProcedures listener:', err.message); }); }catch(e){}
    try{ fbDb.collection('returnMaterials').limit(300).onSnapshot(function(s){ PPD.returnMaterials = byDate(s.docs.map(function(d){ var x=d.data()||{}; x.id=d.id; return x; }),'updatedAt'); decorate(); }, function(err){ console.warn('ppd-labeltraxx-parity returnMaterials listener:', err.message); }); }catch(e){}
  }

  function getEquipmentById(id){ return (PPD.equipmentProfiles||[]).find(function(x){ return x.id===id; }) || null; }
  function getBlueprintLabel(id){ var b=(PPD.blueprints||[]).find(function(x){ return x.id===id; }); return b ? (b.productName||b.blueprintName||b.name||b.id) : ''; }

  function calculateEstimate(rec){
    rec = rec || {};
    var eq = getEquipmentById(rec.equipmentProfileId) || {};
    var qty = asNum(rec.quantity);
    var colors = asNum(rec.colors||0);
    var materialCost = asNum(rec.materialCost);
    var plateCost = asNum(rec.plateCost);
    var artworkCost = asNum(rec.artworkCost);
    var miscCost = asNum(rec.miscCost);
    var markupPct = asNum(rec.markupPct || 25);
    var pressPasses = Math.max(1, asNum(rec.pressPasses || 1));
    var hourlyRate = asNum(eq.hourlyRate || rec.hourlyRate || 150);
    var setupHours = (asNum(eq.makeReadyHours || rec.makeReadyHours || 1.5) + asNum(eq.washUpHours || rec.washUpHours || 0.4)) * pressPasses;
    var speedPerHour = Math.max(1, asNum(eq.speedPerHour || rec.speedPerHour || 12000));
    var spoilagePct = asNum(rec.spoilagePct || eq.spoilagePct || 0.04);
    var complexityPct = asNum(rec.complexityPct || 0);
    var colorPenalty = Math.max(0, colors - asNum(eq.maxColors || 8)) > 0 ? 0.12 : 0;
    var runHours = qty / speedPerHour;
    var laborHours = setupHours + runHours * (1 + complexityPct + colorPenalty);
    var laborCost = laborHours * hourlyRate;
    var wasteCost = materialCost * (spoilagePct + (complexityPct*0.5));
    var totalCost = materialCost + plateCost + artworkCost + miscCost + laborCost + wasteCost;
    var sellPrice = totalCost * (1 + markupPct/100);
    var grossProfit = sellPrice - totalCost;
    var marginPct = sellPrice>0 ? (grossProfit / sellPrice) * 100 : 0;
    return {
      laborHours: round2(laborHours),
      setupHours: round2(setupHours),
      runHours: round2(runHours),
      laborCost: round2(laborCost),
      wasteCost: round2(wasteCost),
      totalCost: round2(totalCost),
      sellPrice: round2(sellPrice),
      grossProfit: round2(grossProfit),
      marginPct: round2(marginPct),
      warnings: buildEstimateWarnings(rec, eq, colors)
    };
  }
  function round2(n){ return Math.round((Number(n)||0)*100)/100; }
  function buildEstimateWarnings(rec, eq, colors){
    var out=[];
    if(eq.maxColors && colors>eq.maxColors) out.push('Color count exceeds selected equipment profile max colors');
    if(!rec.blueprintId) out.push('Blueprint / product master not linked');
    if(!rec.equipmentProfileId) out.push('Equipment profile not selected');
    if(asNum(rec.quantity)<=0) out.push('Quantity must be greater than zero');
    if(!rec.company) out.push('Customer / company should be specified');
    return out;
  }

  function parityShell(html){ return '<div data-ppd-parity-view class="ppd-grid-2">'+html+'</div>'; }

  function renderEstimating(){
    var ests = PPD.estimates || [];
    var totalSell = ests.reduce(function(s,x){ return s + asNum(x.summary && x.summary.sellPrice); },0);
    var avgMargin = ests.length ? ests.reduce(function(s,x){ return s + asNum(x.summary && x.summary.marginPct); },0)/ests.length : 0;
    var h='';
    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><div class="ppd-section-title">Prepress estimating engine</div><div class="ppd-section-sub">Costed prepress and production-support estimates with equipment-driven assumptions, duplication, comparison, and job conversion.</div></div><div style="display:flex;gap:8px"><button class="btn btn-pr btn-sm" onclick="openPPDEstimateForm()">＋ New Estimate</button><button class="btn btn-ghost btn-sm" onclick="openPPDEstimateCompare()">Compare</button></div></div><div class="ppd-metrics">';
    h+=meter('Estimates', ests.length, 'Saved prepress estimates');
    h+=meter('Sell Value', money(totalSell), 'Aggregate of saved sell values');
    h+=meter('Avg Margin', pct(avgMargin), 'Across saved estimates');
    h+=meter('Warnings', ests.filter(function(e){ return e.summary && e.summary.warnings && e.summary.warnings.length; }).length, 'Estimates requiring review');
    h+='</div></div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Recent estimates</div>';
    if(!ests.length) h+='<div class="empty-state"><div class="ico">🧮</div><p>No estimates yet</p></div>';
    else ests.slice(0,14).forEach(function(e){
      var eq = getEquipmentById(e.equipmentProfileId);
      var meta = [e.company||'Internal', getBlueprintLabel(e.blueprintId)||'No blueprint', eq?eq.name:'No equipment'].filter(Boolean).join(' · ');
      var right = money(e.summary && e.summary.sellPrice);
      h+='<div class="ppd-list-item"><div style="min-width:0"><div class="ppd-list-title">'+esc(e.estimateNum||e.id)+' · '+esc(e.title||'Untitled estimate')+'</div><div class="ppd-list-meta">'+esc(meta)+' · Qty '+esc(e.quantity||0)+' · Margin '+esc((e.summary&&e.summary.marginPct!=null)?pct(e.summary.marginPct):'0%')+'</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><div class="ppd-chip">'+esc(right)+'</div><button class="btn btn-ghost btn-xs" onclick="openPPDEstimateForm(\''+esc(e.id)+'\')">Edit</button><button class="btn btn-ghost btn-xs" onclick="duplicatePPDEstimate(\''+esc(e.id)+'\')">Duplicate</button><button class="btn btn-ghost btn-xs" onclick="convertEstimateToPPDJob(\''+esc(e.id)+'\')">To Job</button></div></div>';
    });
    h+='</div>';
    return parityShell(h);
  }

  function renderTemplates(){
    var templates = PPD.templates || [];
    var h='';
    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="ppd-section-title">Template engine</div><div class="ppd-section-sub">Reusable estimating, product setup, checklist, and prepress defaults for repeatable jobs.</div></div><button class="btn btn-pr btn-sm" onclick="openPPDTemplateForm()">＋ New Template</button></div><div class="ppd-metrics">';
    h+=meter('Templates', templates.length, 'Reusable setup packs');
    h+=meter('Blueprint-linked', templates.filter(function(t){ return !!t.blueprintId; }).length, 'Templates tied to product masters');
    h+=meter('Estimate-based', templates.filter(function(t){ return !!t.sourceEstimateId; }).length, 'Saved from estimate models');
    h+=meter('Checklist packs', templates.filter(function(t){ return t.checklist && Object.keys(t.checklist).length; }).length, 'Release and proof defaults');
    h+='</div></div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Available templates</div>';
    if(!templates.length) h+='<div class="empty-state"><div class="ico">📐</div><p>No templates saved</p></div>';
    else templates.slice(0,16).forEach(function(t){
      var meta=[getBlueprintLabel(t.blueprintId)||'', t.equipmentProfileName||'', t.company||''].filter(Boolean).join(' · ');
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(t.name||'Template')+'</div><div class="ppd-list-meta">'+esc(meta||'General defaults')+'</div></div><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-xs" onclick="openPPDTemplateForm(\''+esc(t.id)+'\')">Edit</button><button class="btn btn-ghost btn-xs" onclick="applyPPDTemplatePrompt(\''+esc(t.id)+'\')">Apply</button></div></div>';
    });
    h+='</div>';
    return parityShell(h);
  }

  function renderEquipment(){
    var equipment = PPD.equipmentProfiles || [];
    var h='';
    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="ppd-section-title">Equipment profiles</div><div class="ppd-section-sub">Make-ready, wash-up, speed, spoilage, max-color, hourly-rate, and specialty assumptions used in costing and capacity planning.</div></div><button class="btn btn-pr btn-sm" onclick="openPPDEquipmentForm()">＋ New Equipment</button></div><div class="ppd-metrics">';
    h+=meter('Profiles', equipment.length, 'Stored press / device profiles');
    h+=meter('Flexo', equipment.filter(function(e){ return /flexo/i.test(e.pressType||''); }).length, 'Flexographic profiles');
    h+=meter('Digital', equipment.filter(function(e){ return /digital|indigo/i.test(e.pressType||''); }).length, 'Digital profiles');
    h+=meter('Specialties', equipment.filter(function(e){ return e.specialties && e.specialties.length; }).length, 'Profiles with user-defined options');
    h+='</div></div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Profile library</div>';
    if(!equipment.length) h+='<div class="empty-state"><div class="ico">⚙️</div><p>No equipment profiles saved</p></div>';
    else equipment.slice(0,16).forEach(function(e){
      var meta=[e.pressType||'Press', 'Rate '+money(e.hourlyRate||0)+'/hr', 'Speed '+numCompact(e.speedPerHour||0)+'/hr', 'Spoilage '+pct((e.spoilagePct||0)*100)].join(' · ');
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(e.name||'Equipment')+'</div><div class="ppd-list-meta">'+esc(meta)+'</div></div><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-xs" onclick="openPPDEquipmentForm(\''+esc(e.id)+'\')">Edit</button><button class="btn btn-ghost btn-xs" onclick="openPPDEquipmentProfiler(\''+esc(e.id)+'\')">Profiler</button></div></div>';
    });
    h+='</div>';
    return parityShell(h);
  }
  function numCompact(n){ return Number(n||0).toLocaleString(); }

  function renderCapacity(){
    var tickets = (PPD.tickets||[]).filter(function(t){ return String(t.status||'').toLowerCase()!=='closed'; });
    var byOwner = {};
    tickets.forEach(function(t){ var o=(t.ppd&&t.ppd.assignedTo)||t.assignedTo||'Unassigned'; (byOwner[o]=byOwner[o]||[]).push(t); });
    var similarGroups = {};
    tickets.forEach(function(t){ var key=(t.blueprintId||'')+'|'+((t.ppd&&t.ppd.equipmentProfileId)||'')+'|'+(t.company||''); if(key==='||') return; (similarGroups[key]=similarGroups[key]||[]).push(t); });
    var h='';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Capacity + similar-job planning</div><div class="ppd-section-sub">Operator / prepress workload, art-proof-plate stage visibility, and quick identification of jobs with similar setup to batch efficiently.</div><div class="ppd-metrics">';
    h+=meter('Open Tickets', tickets.length, 'Live prepress work');
    h+=meter('Assigned Owners', Object.keys(byOwner).length, 'People with current workload');
    h+=meter('Similar Groups', Object.keys(similarGroups).filter(function(k){ return (similarGroups[k]||[]).length>1; }).length, 'Potential batching groups');
    h+=meter('Art/Proof/Plate', tickets.filter(function(t){ var s=((t.ppd&&t.ppd.stage)||''); return /Art Review|Proof|Plate/i.test(s); }).length, 'Core prepress status items');
    h+='</div></div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Workload by owner</div>';
    if(!tickets.length) h+='<div class="empty-state"><div class="ico">📊</div><p>No active tickets</p></div>';
    else Object.keys(byOwner).sort().forEach(function(owner){
      var list = byOwner[owner];
      var dueSoon = list.filter(function(t){ return t.ppd&&t.ppd.dueDate && (new Date(t.ppd.dueDate)-Date.now())<172800000; }).length;
      h+=cardRow(owner, list.length+' ticket(s) · '+dueSoon+' due ≤ 48h', list.length);
    });
    h+='</div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Find similar</div>';
    var groups=Object.keys(similarGroups).filter(function(k){ return (similarGroups[k]||[]).length>1; });
    if(!groups.length) h+='<div class="empty-state"><div class="ico">🧩</div><p>No similar setup groups detected yet</p></div>';
    else groups.slice(0,12).forEach(function(key){
      var list = similarGroups[key] || [];
      var base=list[0]||{};
      var meta=[base.company||'', getBlueprintLabel(base.blueprintId)||'', (getEquipmentById((base.ppd&&base.ppd.equipmentProfileId)||'')||{}).name||''].filter(Boolean).join(' · ');
      h+=cardRow((list.length)+' similar jobs', meta, list.map(function(t){ return t.jtNum; }).slice(0,3).join(', '));
    });
    h+='</div>';
    return parityShell(h);
  }

  function renderQuality(){
    var procs = PPD.qcProcedures || [];
    var returns = PPD.returnMaterials || [];
    var h='';
    h+='<div class="card ppd-section"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="ppd-section-title">Quality events + RMAs</div><div class="ppd-section-sub">Event-tied procedures, procedure warnings, return / complaint logging, and corrective-action tracking inside PPD.</div></div><div style="display:flex;gap:8px"><button class="btn btn-pr btn-sm" onclick="openPPDQCProcedureForm()">＋ Procedure</button><button class="btn btn-ghost btn-sm" onclick="openPPDRMAForm()">＋ RMA</button></div></div><div class="ppd-metrics">';
    h+=meter('Procedures', procs.length, 'Event-driven rules and checklists');
    h+=meter('Active', procs.filter(function(p){ return p.active!==false; }).length, 'Currently enabled');
    h+=meter('Returns / RMAs', returns.length, 'Logged return or complaint records');
    h+=meter('Open Corrective', returns.filter(function(r){ return !/closed|resolved/i.test(String(r.status||'')); }).length, 'Need corrective action closure');
    h+='</div></div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Procedure library</div>';
    if(!procs.length) h+='<div class="empty-state"><div class="ico">✅</div><p>No QC procedures configured</p></div>';
    else procs.slice(0,12).forEach(function(p){
      var meta=[p.event||'event', p.scopeType||'scope', p.scopeRef||'', p.priority||''].filter(Boolean).join(' · ');
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(p.name||'Procedure')+'</div><div class="ppd-list-meta">'+esc(meta)+'</div></div><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-xs" onclick="openPPDQCProcedureForm(\''+esc(p.id)+'\')">Edit</button></div></div>';
    });
    h+='</div>';
    h+='<div class="card ppd-section"><div class="ppd-section-title">Recent return / complaint log</div>';
    if(!returns.length) h+='<div class="empty-state"><div class="ico">↩️</div><p>No RMAs logged</p></div>';
    else returns.slice(0,12).forEach(function(r){
      var meta=[r.type||'RMA', r.company||'', r.ticketNum||'', r.status||'Open'].filter(Boolean).join(' · ');
      h+='<div class="ppd-list-item"><div><div class="ppd-list-title">'+esc(r.rmaNum||r.id)+'</div><div class="ppd-list-meta">'+esc(meta)+' · '+esc(r.description||'')+'</div></div><div style="display:flex;gap:6px"><div class="ppd-chip">'+esc(money(r.totalCost||0))+'</div><button class="btn btn-ghost btn-xs" onclick="openPPDRMAForm(\''+esc(r.id)+'\')">Edit</button></div></div>';
    });
    h+='</div>';
    return parityShell(h);
  }

  function ensureTabs(){
    var tabs = document.querySelector('.ppd-tabs');
    if(!tabs) return;
    EXTRA_TABS.forEach(function(tab){
      if(tabs.querySelector('[data-ppd-parity-tab="'+tab[0]+'"]')) return;
      var btn=document.createElement('button');
      btn.className='ppd-tab'+(PPD.tab===tab[0]?' active':'');
      btn.textContent=tab[1];
      btn.setAttribute('data-ppd-parity-tab',tab[0]);
      btn.onclick=function(){ PPD.tab=tab[0]; if(window.MFX_VIEW_RENDERERS&&window.MFX_VIEW_RENDERERS.ppd) window.MFX_VIEW_RENDERERS.ppd(); };
      tabs.appendChild(btn);
    });
  }

  function injectView(){
    if(EXTRA_TABS.map(function(x){ return x[0]; }).indexOf(PPD.tab)===-1) return;
    var shell=document.querySelector('#v-ppd .ppd-shell');
    if(!shell) return;
    var old=shell.querySelector('[data-ppd-parity-view]');
    if(old) old.remove();
    var html='';
    if(PPD.tab==='estimating') html=renderEstimating();
    if(PPD.tab==='templates') html=renderTemplates();
    if(PPD.tab==='equipment') html=renderEquipment();
    if(PPD.tab==='capacity') html=renderCapacity();
    if(PPD.tab==='quality') html=renderQuality();
    shell.insertAdjacentHTML('beforeend', html);
  }

  function decorate(){ ensureParityState(); ensureListeners(); ensureTabs(); injectView(); }

  var prevRenderer = window.MFX_VIEW_RENDERERS && window.MFX_VIEW_RENDERERS.ppd;
  if(typeof prevRenderer==='function' && !prevRenderer.__ppdParityWrapped){
    window.MFX_VIEW_RENDERERS.ppd=function(){ var out = prevRenderer.apply(this, arguments); setTimeout(decorate,0); return out; };
    window.MFX_VIEW_RENDERERS.ppd.__ppdParityWrapped = true;
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(decorate,1200); });
  setTimeout(decorate,1800);

  function calcSummaryFromForm(){
    var rec = {
      company: (document.getElementById('ppd-e-company')||{}).value || '',
      blueprintId: (document.getElementById('ppd-e-blueprint')||{}).value || '',
      equipmentProfileId: (document.getElementById('ppd-e-equipment')||{}).value || '',
      quantity: (document.getElementById('ppd-e-qty')||{}).value || 0,
      colors: (document.getElementById('ppd-e-colors')||{}).value || 0,
      materialCost: (document.getElementById('ppd-e-material')||{}).value || 0,
      plateCost: (document.getElementById('ppd-e-plate')||{}).value || 0,
      artworkCost: (document.getElementById('ppd-e-art')||{}).value || 0,
      miscCost: (document.getElementById('ppd-e-misc')||{}).value || 0,
      markupPct: (document.getElementById('ppd-e-markup')||{}).value || 25,
      pressPasses: (document.getElementById('ppd-e-passes')||{}).value || 1,
      complexityPct: (document.getElementById('ppd-e-complexity')||{}).value || 0
    };
    var s = calculateEstimate(rec);
    var tgt = document.getElementById('ppd-e-summary');
    if(tgt){
      tgt.innerHTML = '<div class="ppd-metrics" style="margin-top:6px">'+
        meter('Total Cost', money(s.totalCost), 'Setup + run + material + plates')+
        meter('Sell Price', money(s.sellPrice), 'With markup applied')+
        meter('Gross Profit', money(s.grossProfit), 'Estimated contribution')+
        meter('Margin', pct(s.marginPct), 'Projected margin')+
      '</div>'+
      (s.warnings.length?'<div class="ppd-section-sub" style="margin-top:8px;color:#fda4af">Warnings: '+esc(s.warnings.join(' · '))+'</div>':'');
    }
    return s;
  }

  window.openPPDEstimateForm=function(id){
    var e=(PPD.estimates||[]).find(function(x){ return x.id===id; }) || {};
    var equipmentOpts = ['<option value="">Select equipment</option>'].concat((PPD.equipmentProfiles||[]).map(function(x){ return '<option value="'+esc(x.id)+'"'+(e.equipmentProfileId===x.id?' selected':'')+'>'+esc(x.name)+' · '+esc(x.pressType||'')+'</option>'; }));
    var blueprintOpts = ['<option value="">Optional blueprint</option>'].concat((PPD.blueprints||[]).map(function(x){ return '<option value="'+esc(x.id)+'"'+(e.blueprintId===x.id?' selected':'')+'>'+esc(x.productName||x.blueprintName||x.name||x.id)+'</option>'; }));
    var h='<div class="modal-title">'+esc(id?'Edit Estimate':'New Estimate')+'</div>'+
      field('Title','<input id="ppd-e-title" value="'+esc(e.title||'')+'" placeholder="Estimate title">')+
      field('Customer / Company','<input id="ppd-e-company" value="'+esc(e.company||'')+'" placeholder="Customer">')+
      field('Blueprint / Product Master','<select id="ppd-e-blueprint">'+blueprintOpts.join('')+'</select>')+
      field('Equipment Profile','<select id="ppd-e-equipment" onchange="calcPPDEstimateForm()">'+equipmentOpts.join('')+'</select>')+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
      field('Quantity','<input id="ppd-e-qty" type="number" min="0" step="1" value="'+esc(e.quantity||'')+'" oninput="calcPPDEstimateForm()">')+
      field('Colors','<input id="ppd-e-colors" type="number" min="0" step="1" value="'+esc(e.colors||'')+'" oninput="calcPPDEstimateForm()">')+
      field('Material Cost','<input id="ppd-e-material" type="number" min="0" step="0.01" value="'+esc(e.materialCost||'')+'" oninput="calcPPDEstimateForm()">')+
      field('Plate Cost','<input id="ppd-e-plate" type="number" min="0" step="0.01" value="'+esc(e.plateCost||'')+'" oninput="calcPPDEstimateForm()">')+
      field('Artwork Cost','<input id="ppd-e-art" type="number" min="0" step="0.01" value="'+esc(e.artworkCost||'')+'" oninput="calcPPDEstimateForm()">')+
      field('Misc Cost','<input id="ppd-e-misc" type="number" min="0" step="0.01" value="'+esc(e.miscCost||'')+'" oninput="calcPPDEstimateForm()">')+
      field('Markup %','<input id="ppd-e-markup" type="number" min="0" step="0.1" value="'+esc(e.markupPct!=null?e.markupPct:25)+'" oninput="calcPPDEstimateForm()">')+
      field('Press Passes','<input id="ppd-e-passes" type="number" min="1" step="1" value="'+esc(e.pressPasses||1)+'" oninput="calcPPDEstimateForm()">')+
      field('Complexity %','<input id="ppd-e-complexity" type="number" min="0" step="0.01" value="'+esc(e.complexityPct||0)+'" oninput="calcPPDEstimateForm()">')+
      '</div>'+
      field('Notes','<textarea id="ppd-e-notes" style="min-height:80px">'+esc(e.notes||'')+'</textarea>')+
      '<div id="ppd-e-summary"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn btn-pr" onclick="savePPDEstimate('+(id?'\''+esc(id)+'\'':'')+')">Save Estimate</button><button class="btn btn-ghost" onclick="calcPPDEstimateForm()">Recalculate</button></div>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
    setTimeout(calcSummaryFromForm,0);
  };
  window.calcPPDEstimateForm=function(){ return calcSummaryFromForm(); };

  window.savePPDEstimate=async function(id){
    var estimateNum = id ? (((PPD.estimates||[]).find(function(x){ return x.id===id; })||{}).estimateNum||'') : await requestParityNumber('estimate','EST',function(){ return 'EST'+String(Date.now()).slice(-8); });
    var payload={
      estimateNum: estimateNum,
      title: (document.getElementById('ppd-e-title')||{}).value || 'Prepress Estimate',
      company: (document.getElementById('ppd-e-company')||{}).value || '',
      blueprintId: (document.getElementById('ppd-e-blueprint')||{}).value || '',
      equipmentProfileId: (document.getElementById('ppd-e-equipment')||{}).value || '',
      quantity: asNum((document.getElementById('ppd-e-qty')||{}).value),
      colors: asNum((document.getElementById('ppd-e-colors')||{}).value),
      materialCost: asNum((document.getElementById('ppd-e-material')||{}).value),
      plateCost: asNum((document.getElementById('ppd-e-plate')||{}).value),
      artworkCost: asNum((document.getElementById('ppd-e-art')||{}).value),
      miscCost: asNum((document.getElementById('ppd-e-misc')||{}).value),
      markupPct: asNum((document.getElementById('ppd-e-markup')||{}).value),
      pressPasses: asNum((document.getElementById('ppd-e-passes')||{}).value),
      complexityPct: asNum((document.getElementById('ppd-e-complexity')||{}).value),
      notes: (document.getElementById('ppd-e-notes')||{}).value || '',
      summary: calcSummaryFromForm(),
      updatedAt: new Date().toISOString(),
      updatedBy: (typeof getUserName==='function'?getUserName():'System')
    };
    if(!payload.title || !payload.company){ toast('Title and customer are required','err'); return; }
    if(!id){ payload.createdAt = new Date().toISOString(); payload.createdBy = (typeof getUserName==='function'?getUserName():'System'); }
    var ref = id ? fbDb.collection('ppdEstimates').doc(id) : fbDb.collection('ppdEstimates').doc(uid('est'));
    ref.set(payload,{merge:true}).then(function(){ closeModal(); toast('Estimate saved','ok'); logParityEvent('estimate.saved',{estimateNum:payload.estimateNum,title:payload.title,company:payload.company}); }).catch(function(e){ toast(e.message,'err'); });
  };

  window.duplicatePPDEstimate=async function(id){
    var e=(PPD.estimates||[]).find(function(x){ return x.id===id; }); if(!e) return toast('Estimate not found','err');
    var estimateNum = await requestParityNumber('estimate','EST',function(){ return 'EST'+String(Date.now()).slice(-8); });
    var copy=JSON.parse(JSON.stringify(e)); delete copy.id; copy.estimateNum=estimateNum; copy.title=(copy.title||'Estimate')+' Copy'; copy.createdAt=new Date().toISOString(); copy.updatedAt=new Date().toISOString(); copy.createdBy=(typeof getUserName==='function'?getUserName():'System'); copy.updatedBy=copy.createdBy;
    fbDb.collection('ppdEstimates').doc(uid('est')).set(copy,{merge:true}).then(function(){ toast('Estimate duplicated','ok'); logParityEvent('estimate.duplicated',{source:e.estimateNum,newEstimateNum:estimateNum}); }).catch(function(err){ toast(err.message,'err'); });
  };

  window.openPPDEstimateCompare=function(){
    var options=(PPD.estimates||[]).slice(0,40).map(function(e){ return '<option value="'+esc(e.id)+'">'+esc((e.estimateNum||e.id)+' · '+(e.title||''))+'</option>'; }).join('');
    var h='<div class="modal-title">Compare Estimates</div>'+
      field('Estimate A','<select id="ppd-c-a">'+options+'</select>')+
      field('Estimate B','<select id="ppd-c-b">'+options+'</select>')+
      '<button class="btn btn-pr" style="width:100%" onclick="runPPDEstimateCompare()">Compare</button>'+
      '<div id="ppd-c-out" style="margin-top:10px"></div>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Close</button>';
    openModal(h);
  };
  window.runPPDEstimateCompare=function(){
    var a=(PPD.estimates||[]).find(function(x){ return x.id===((document.getElementById('ppd-c-a')||{}).value); });
    var b=(PPD.estimates||[]).find(function(x){ return x.id===((document.getElementById('ppd-c-b')||{}).value); });
    if(!a || !b) return toast('Select two estimates','err');
    var out=document.getElementById('ppd-c-out'); if(!out) return;
    function row(label,av,bv){ return '<div class="ppd-list-item"><div class="ppd-list-title">'+esc(label)+'</div><div style="display:grid;grid-template-columns:100px 100px;gap:8px"><div class="ppd-chip">'+esc(av)+'</div><div class="ppd-chip">'+esc(bv)+'</div></div></div>'; }
    out.innerHTML = '<div class="card ppd-section"><div class="ppd-section-title">Estimate comparison</div>'+
      row('Sell Price', money(a.summary&&a.summary.sellPrice), money(b.summary&&b.summary.sellPrice))+
      row('Total Cost', money(a.summary&&a.summary.totalCost), money(b.summary&&b.summary.totalCost))+
      row('Margin %', pct(a.summary&&a.summary.marginPct), pct(b.summary&&b.summary.marginPct))+
      row('Labor Hours', String(a.summary&&a.summary.laborHours), String(b.summary&&b.summary.laborHours))+
      row('Warnings', String((a.summary&&a.summary.warnings||[]).length), String((b.summary&&b.summary.warnings||[]).length))+
      '</div>';
  };

  window.convertEstimateToPPDJob=async function(id){
    var e=(PPD.estimates||[]).find(function(x){ return x.id===id; }); if(!e) return toast('Estimate not found','err');
    var jtNum = await requestServerNumber('jobTicket', function(){ return 'JT'+String(Date.now()).slice(-6); });
    var jtId='jt_'+Date.now();
    var eq=getEquipmentById(e.equipmentProfileId)||{};
    var stage='Validation';
    var ticket={
      id:jtId,
      jtNum:jtNum,
      company:e.company||'Internal',
      skuName:e.title||'Prepress Work',
      blueprintId:e.blueprintId||'',
      status:'prepress',
      prePressStatus:'pending',
      createdAt:new Date().toISOString(),
      createdBy:(typeof getUserName==='function'?getUserName():'System'),
      updatedAt:new Date().toISOString(),
      updatedBy:(typeof getUserName==='function'?getUserName():'System'),
      ppd:{
        stage:stage,
        sourceType:'estimate',
        sourceEstimateId:e.id,
        assignedTo:(typeof getUserName==='function'?getUserName():'System'),
        dueDate:'',
        proofStatus:'Not Started',
        blocked:(e.summary&&e.summary.warnings||[]).length>0,
        notes:e.notes||'',
        equipmentProfileId:e.equipmentProfileId||'',
        estimateNum:e.estimateNum||'',
        estimateSummary:e.summary||{},
        checklist:{files:false,art:false,proof:false,release:false}
      },
      log:[{action:'Created from estimate '+(e.estimateNum||e.id),by:(typeof getUserName==='function'?getUserName():'System'),at:new Date().toISOString()}]
    };
    fbDb.collection('jobTickets').doc(ticket.id).set(ticket,{merge:true}).then(function(){
      toast('Estimate converted to job','ok');
      if(typeof provisionPPDWorkspace==='function') return provisionPPDWorkspace({jobTicketId:ticket.id,jobTicketNum:ticket.jtNum,company:ticket.company,skuName:ticket.skuName,blueprintId:ticket.blueprintId||''}).catch(function(){});
    }).then(function(data){
      if(data&&data.rootFolderUrl){ fbDb.collection('jobTickets').doc(ticket.id).set({ppd:{driveFolderUrl:data.rootFolderUrl,driveFolderId:data.rootFolderId,driveFolders:data.folders||{}},updatedAt:new Date().toISOString()},{merge:true}); }
      logParityEvent('estimate.converted',{estimateNum:e.estimateNum||'',jobTicketNum:jtNum,company:e.company||''});
    }).catch(function(err){ toast(err.message,'err'); });
  };

  window.openPPDTemplateForm=function(id){
    var t=(PPD.templates||[]).find(function(x){ return x.id===id; }) || {};
    var equipmentOpts = ['<option value="">Optional equipment default</option>'].concat((PPD.equipmentProfiles||[]).map(function(x){ return '<option value="'+esc(x.id)+'"'+(t.equipmentProfileId===x.id?' selected':'')+'>'+esc(x.name)+'</option>'; }));
    var blueprintOpts = ['<option value="">Optional blueprint</option>'].concat((PPD.blueprints||[]).map(function(x){ return '<option value="'+esc(x.id)+'"'+(t.blueprintId===x.id?' selected':'')+'>'+esc(x.productName||x.blueprintName||x.name||x.id)+'</option>'; }));
    var h='<div class="modal-title">'+esc(id?'Edit Template':'New Template')+'</div>'+
      field('Template Name','<input id="ppd-t-name" value="'+esc(t.name||'')+'">')+
      field('Customer / Company','<input id="ppd-t-company" value="'+esc(t.company||'')+'">')+
      field('Blueprint Default','<select id="ppd-t-blueprint">'+blueprintOpts.join('')+'</select>')+
      field('Equipment Default','<select id="ppd-t-equipment">'+equipmentOpts.join('')+'</select>')+
      field('Markup Default %','<input id="ppd-t-markup" type="number" step="0.1" value="'+esc(t.markupPct!=null?t.markupPct:25)+'">')+
      field('Checklist Defaults','<input id="ppd-t-checklist" value="'+esc((t.checklistLabels||[]).join(', '))+'" placeholder="files, art, proof, release">')+
      field('Notes / Instructions','<textarea id="ppd-t-notes" style="min-height:80px">'+esc(t.notes||'')+'</textarea>')+
      '<button class="btn btn-pr" style="width:100%" onclick="savePPDTemplate('+(id?'\''+esc(id)+'\'':'')+')">Save Template</button>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };

  window.savePPDTemplate=function(id){
    var equipmentId=(document.getElementById('ppd-t-equipment')||{}).value||'';
    var eq=getEquipmentById(equipmentId)||{};
    var payload={
      name:(document.getElementById('ppd-t-name')||{}).value||'Template',
      company:(document.getElementById('ppd-t-company')||{}).value||'',
      blueprintId:(document.getElementById('ppd-t-blueprint')||{}).value||'',
      equipmentProfileId:equipmentId,
      equipmentProfileName:eq.name||'',
      markupPct:asNum((document.getElementById('ppd-t-markup')||{}).value),
      checklistLabels:String((document.getElementById('ppd-t-checklist')||{}).value||'').split(',').map(function(x){ return x.trim(); }).filter(Boolean),
      notes:(document.getElementById('ppd-t-notes')||{}).value||'',
      updatedAt:new Date().toISOString(),
      updatedBy:(typeof getUserName==='function'?getUserName():'System')
    };
    if(!id){ payload.createdAt=new Date().toISOString(); payload.createdBy=payload.updatedBy; }
    var ref=id?fbDb.collection('ppdTemplates').doc(id):fbDb.collection('ppdTemplates').doc(uid('tpl'));
    ref.set(payload,{merge:true}).then(function(){ closeModal(); toast('Template saved','ok'); logParityEvent('template.saved',{name:payload.name}); }).catch(function(err){ toast(err.message,'err'); });
  };

  window.applyPPDTemplatePrompt=function(templateId){
    var t=(PPD.templates||[]).find(function(x){ return x.id===templateId; }); if(!t) return toast('Template not found','err');
    var ticketOpts=(PPD.tickets||[]).filter(function(x){ return String(x.status||'').toLowerCase()!=='closed'; }).map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.jtNum+' · '+(x.company||'')+' · '+(x.skuName||''))+'</option>'; }).join('');
    var h='<div class="modal-title">Apply Template</div>'+
      field('Template','<input value="'+esc(t.name||'')+'" disabled>')+
      field('Target Job Ticket','<select id="ppd-t-target">'+ticketOpts+'</select>')+
      '<button class="btn btn-pr" style="width:100%" onclick="applyPPDTemplate(\''+esc(templateId)+'\')">Apply to Job</button>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };
  window.applyPPDTemplate=function(templateId){
    var t=(PPD.templates||[]).find(function(x){ return x.id===templateId; }); if(!t) return toast('Template not found','err');
    var ticketId=(document.getElementById('ppd-t-target')||{}).value||''; if(!ticketId) return toast('Select a job ticket','err');
    var checklist={};
    (t.checklistLabels||[]).forEach(function(x){ var k=x.toLowerCase(); if(['files','art','proof','release'].indexOf(k)>=0) checklist[k]=false; });
    var ppdPatch={ templateId:t.id, templateName:t.name||'', equipmentProfileId:t.equipmentProfileId||'', markupPct:t.markupPct||0, notes:t.notes||'' };
    if(Object.keys(checklist).length) ppdPatch.checklist=checklist;
    fbDb.collection('jobTickets').doc(ticketId).set({
      updatedAt:new Date().toISOString(), updatedBy:(typeof getUserName==='function'?getUserName():'System'),
      blueprintId:t.blueprintId||'',
      ppd: ppdPatch
    },{merge:true}).then(function(){ closeModal(); toast('Template applied','ok'); logParityEvent('template.applied',{template:t.name||'',ticketId:ticketId}); }).catch(function(err){ toast(err.message,'err'); });
  };

  window.openPPDEquipmentForm=function(id){
    var e=(PPD.equipmentProfiles||[]).find(function(x){ return x.id===id; }) || {};
    var h='<div class="modal-title">'+esc(id?'Edit Equipment':'New Equipment Profile')+'</div>'+
      field('Name','<input id="ppd-eq-name" value="'+esc(e.name||'')+'">')+
      field('Press Type','<input id="ppd-eq-type" value="'+esc(e.pressType||'Flexo')+'" placeholder="Flexo / Digital / Indigo">')+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
      field('Hourly Rate','<input id="ppd-eq-rate" type="number" step="0.01" value="'+esc(e.hourlyRate||150)+'">')+
      field('Max Colors','<input id="ppd-eq-colors" type="number" step="1" value="'+esc(e.maxColors||8)+'">')+
      field('Make Ready Hrs','<input id="ppd-eq-mr" type="number" step="0.01" value="'+esc(e.makeReadyHours||1.5)+'">')+
      field('Wash Up Hrs','<input id="ppd-eq-wu" type="number" step="0.01" value="'+esc(e.washUpHours||0.4)+'">')+
      field('Speed / Hr','<input id="ppd-eq-speed" type="number" step="1" value="'+esc(e.speedPerHour||12000)+'">')+
      field('Spoilage %','<input id="ppd-eq-spoil" type="number" step="0.0001" value="'+esc(e.spoilagePct||0.04)+'">')+
      '</div>'+
      field('Specialties','<textarea id="ppd-eq-special" style="min-height:80px" placeholder="Comma-separated attachments / specialties">'+esc((e.specialties||[]).join(', '))+'</textarea>')+
      field('Profiler Notes','<textarea id="ppd-eq-notes" style="min-height:80px">'+esc(e.notes||'')+'</textarea>')+
      '<button class="btn btn-pr" style="width:100%" onclick="savePPDEquipment('+(id?'\''+esc(id)+'\'':'')+')">Save Profile</button>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };
  window.savePPDEquipment=function(id){
    var payload={
      name:(document.getElementById('ppd-eq-name')||{}).value||'Equipment',
      pressType:(document.getElementById('ppd-eq-type')||{}).value||'Flexo',
      hourlyRate:asNum((document.getElementById('ppd-eq-rate')||{}).value),
      maxColors:asNum((document.getElementById('ppd-eq-colors')||{}).value),
      makeReadyHours:asNum((document.getElementById('ppd-eq-mr')||{}).value),
      washUpHours:asNum((document.getElementById('ppd-eq-wu')||{}).value),
      speedPerHour:asNum((document.getElementById('ppd-eq-speed')||{}).value),
      spoilagePct:asNum((document.getElementById('ppd-eq-spoil')||{}).value),
      specialties:String((document.getElementById('ppd-eq-special')||{}).value||'').split(',').map(function(x){ return x.trim(); }).filter(Boolean),
      notes:(document.getElementById('ppd-eq-notes')||{}).value||'',
      updatedAt:new Date().toISOString(),
      updatedBy:(typeof getUserName==='function'?getUserName():'System')
    };
    if(!id){ payload.createdAt=new Date().toISOString(); payload.createdBy=payload.updatedBy; }
    var ref=id?fbDb.collection('equipmentProfiles').doc(id):fbDb.collection('equipmentProfiles').doc(uid('eq'));
    ref.set(payload,{merge:true}).then(function(){ closeModal(); toast('Equipment profile saved','ok'); logParityEvent('equipment.saved',{name:payload.name}); }).catch(function(err){ toast(err.message,'err'); });
  };
  window.openPPDEquipmentProfiler=function(id){
    var e=(PPD.equipmentProfiles||[]).find(function(x){ return x.id===id; }); if(!e) return toast('Profile not found','err');
    var s=calculateEstimate({equipmentProfileId:e.id, quantity:100000, colors:4, materialCost:1000, plateCost:450, artworkCost:150, miscCost:50, markupPct:25, pressPasses:1, complexityPct:0.05});
    var h='<div class="modal-title">Equipment profiler · '+esc(e.name||'')+'</div><div class="card ppd-section">'+cardRow('Press Type',e.pressType||'', '')+cardRow('Hourly Rate', money(e.hourlyRate||0), '')+cardRow('Make Ready / Wash Up', String(e.makeReadyHours||0)+' / '+String(e.washUpHours||0)+' hrs','')+cardRow('Speed / Hr', numCompact(e.speedPerHour||0), '')+cardRow('Spoilage', pct((e.spoilagePct||0)*100), '')+cardRow('Max Colors', e.maxColors||'', '')+'</div><div class="card ppd-section" style="margin-top:10px"><div class="ppd-section-title">Reference scenario</div><div class="ppd-section-sub">100k qty · 4 colors · $1,000 material · $450 plates</div><div class="ppd-metrics">'+meter('Total Cost',money(s.totalCost),'')+meter('Sell Price',money(s.sellPrice),'')+meter('Margin',pct(s.marginPct),'')+meter('Labor Hours',s.laborHours,'')+'</div></div><button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="closeModal()">Close</button>';
    openModal(h);
  };

  window.openPPDQCProcedureForm=function(id){
    var p=(PPD.qcProcedures||[]).find(function(x){ return x.id===id; }) || {};
    var eventOptions=['Estimate Open','Job Created','Intake','Validation','Art Review','Proof Ready','Proof Sent','Waiting Approval','Revision Needed','Plate Ready','Release QA','Released','Return'];
    var h='<div class="modal-title">'+esc(id?'Edit QC Procedure':'New QC Procedure')+'</div>'+
      field('Name','<input id="ppd-qc-name" value="'+esc(p.name||'')+'">')+
      field('Event','<select id="ppd-qc-event">'+eventOptions.map(function(x){ return '<option'+((p.event||'')===x?' selected':'')+'>'+x+'</option>'; }).join('')+'</select>')+
      field('Scope Type','<select id="ppd-qc-scope"><option'+((p.scopeType||'all')==='all'?' selected':'')+'>all</option><option'+((p.scopeType||'')==='company'?' selected':'')+'>company</option><option'+((p.scopeType||'')==='blueprint'?' selected':'')+'>blueprint</option><option'+((p.scopeType||'')==='ticket'?' selected':'')+'>ticket</option></select>')+
      field('Scope Ref','<input id="ppd-qc-ref" value="'+esc(p.scopeRef||'')+'" placeholder="Company / blueprint / ticket ref">')+
      field('Priority','<select id="ppd-qc-priority"><option'+((p.priority||'Medium')==='Low'?' selected':'')+'>Low</option><option'+((p.priority||'Medium')==='Medium'?' selected':'')+'>Medium</option><option'+((p.priority||'Medium')==='High'?' selected':'')+'>High</option></select>')+
      field('Checklist / Notes','<textarea id="ppd-qc-notes" style="min-height:90px">'+esc(p.notes||'')+'</textarea>')+
      '<div class="fg"><label>Active</label><input id="ppd-qc-active" type="checkbox" '+(p.active!==false?'checked':'')+'></div>'+
      '<button class="btn btn-pr" style="width:100%" onclick="savePPDQCProcedure('+(id?'\''+esc(id)+'\'':'')+')">Save Procedure</button>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };
  window.savePPDQCProcedure=function(id){
    var payload={
      name:(document.getElementById('ppd-qc-name')||{}).value||'Procedure',
      event:(document.getElementById('ppd-qc-event')||{}).value||'Validation',
      scopeType:(document.getElementById('ppd-qc-scope')||{}).value||'all',
      scopeRef:(document.getElementById('ppd-qc-ref')||{}).value||'',
      priority:(document.getElementById('ppd-qc-priority')||{}).value||'Medium',
      notes:(document.getElementById('ppd-qc-notes')||{}).value||'',
      active:!!((document.getElementById('ppd-qc-active')||{}).checked),
      updatedAt:new Date().toISOString(),
      updatedBy:(typeof getUserName==='function'?getUserName():'System')
    };
    if(!id){ payload.createdAt=new Date().toISOString(); payload.createdBy=payload.updatedBy; }
    var ref=id?fbDb.collection('qcProcedures').doc(id):fbDb.collection('qcProcedures').doc(uid('qcp'));
    ref.set(payload,{merge:true}).then(function(){ closeModal(); toast('QC procedure saved','ok'); logParityEvent('qc.saved',{name:payload.name,event:payload.event}); }).catch(function(err){ toast(err.message,'err'); });
  };

  window.openPPDRMAForm=function(id){
    var r=(PPD.returnMaterials||[]).find(function(x){ return x.id===id; }) || {};
    var h='<div class="modal-title">'+esc(id?'Edit RMA / Return':'New RMA / Return')+'</div>'+
      field('RMA Type','<select id="ppd-rma-type"><option'+((r.type||'RMA')==='RMA'?' selected':'')+'>RMA</option><option'+((r.type||'')==='Complaint'?' selected':'')+'>Complaint</option><option'+((r.type||'')==='Nonconforming Vendor Material'?' selected':'')+'>Nonconforming Vendor Material</option></select>')+
      field('Customer / Company','<input id="ppd-rma-company" value="'+esc(r.company||'')+'">')+
      field('Ticket #','<input id="ppd-rma-ticket" value="'+esc(r.ticketNum||'')+'">')+
      field('Status','<select id="ppd-rma-status"><option'+((r.status||'Open')==='Open'?' selected':'')+'>Open</option><option'+((r.status||'')==='Corrective Action'?' selected':'')+'>Corrective Action</option><option'+((r.status||'')==='Resolved'?' selected':'')+'>Resolved</option><option'+((r.status||'')==='Closed'?' selected':'')+'>Closed</option></select>')+
      field('Description','<textarea id="ppd-rma-desc" style="min-height:80px">'+esc(r.description||'')+'</textarea>')+
      field('Corrective Action','<textarea id="ppd-rma-ca" style="min-height:80px">'+esc(r.correctiveAction||'')+'</textarea>')+
      field('Cost / Credit Impact','<input id="ppd-rma-cost" type="number" step="0.01" value="'+esc(r.totalCost||'')+'">')+
      '<button class="btn btn-pr" style="width:100%" onclick="savePPDRMA('+(id?'\''+esc(id)+'\'':'')+')">Save RMA</button>'+
      '<button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="closeModal()">Cancel</button>';
    openModal(h);
  };
  window.savePPDRMA=async function(id){
    var rmaNum = id ? (((PPD.returnMaterials||[]).find(function(x){ return x.id===id; })||{}).rmaNum||'') : await requestParityNumber('rma','RMA',function(){ return 'RMA'+String(Date.now()).slice(-8); });
    var payload={
      rmaNum:rmaNum,
      type:(document.getElementById('ppd-rma-type')||{}).value||'RMA',
      company:(document.getElementById('ppd-rma-company')||{}).value||'',
      ticketNum:(document.getElementById('ppd-rma-ticket')||{}).value||'',
      status:(document.getElementById('ppd-rma-status')||{}).value||'Open',
      description:(document.getElementById('ppd-rma-desc')||{}).value||'',
      correctiveAction:(document.getElementById('ppd-rma-ca')||{}).value||'',
      totalCost:asNum((document.getElementById('ppd-rma-cost')||{}).value),
      updatedAt:new Date().toISOString(),
      updatedBy:(typeof getUserName==='function'?getUserName():'System')
    };
    if(!id){ payload.createdAt=new Date().toISOString(); payload.createdBy=payload.updatedBy; }
    var ref=id?fbDb.collection('returnMaterials').doc(id):fbDb.collection('returnMaterials').doc(uid('rma'));
    ref.set(payload,{merge:true}).then(function(){ closeModal(); toast('RMA saved','ok'); logParityEvent('rma.saved',{rmaNum:rmaNum,type:payload.type}); }).catch(function(err){ toast(err.message,'err'); });
  };

  function logParityEvent(type,payload){
    if(typeof fbDb==='undefined') return;
    try{
      fbDb.collection('ppdEvents').add({ type:type, summary:JSON.stringify(payload||{}), payload:payload||{}, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdAtIso: new Date().toISOString(), createdBy: (typeof getUserName==='function'?getUserName():'System') });
    }catch(e){}
  }

  function matchScope(proc, ticket){
    if(!proc || proc.active===false) return false;
    var scope = String(proc.scopeType||'all').toLowerCase();
    var ref = String(proc.scopeRef||'');
    if(scope==='all') return true;
    if(scope==='company') return String(ticket.company||'')===ref;
    if(scope==='blueprint') return String(ticket.blueprintId||'')===ref;
    if(scope==='ticket') return String(ticket.jtNum||ticket.id||'')===ref || String(ticket.id||'')===ref;
    return true;
  }

  function evaluateQCForTicket(ticketId, stage){
    var ticket=(PPD.tickets||[]).find(function(x){ return x.id===ticketId; });
    if(!ticket || !stage) return;
    var matches=(PPD.qcProcedures||[]).filter(function(p){ return String(p.event||'')===String(stage) && matchScope(p,ticket); });
    if(!matches.length) return;
    logParityEvent('qc.event.triggered',{ ticketId: ticketId, jtNum: ticket.jtNum||'', stage: stage, procedures: matches.map(function(x){ return x.name; }) });
    toast('QC procedure triggered: '+matches.map(function(x){ return x.name; }).join(', '),'info');
  }

  if(typeof window.savePPDJobStudio==='function' && !window.savePPDJobStudio.__parityWrapped){
    var prevSave = window.savePPDJobStudio;
    window.savePPDJobStudio = function(ticketId){
      var stageEl = document.getElementById('ppd-j-stage');
      var stage = stageEl ? stageEl.value : '';
      var res = prevSave.apply(this, arguments);
      setTimeout(function(){ evaluateQCForTicket(ticketId, stage); }, 900);
      return res;
    };
    window.savePPDJobStudio.__parityWrapped = true;
  }
})();
