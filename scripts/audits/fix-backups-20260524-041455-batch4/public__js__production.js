'use strict';
// ══════════════════════════════════════════════════════════════════
// MFX OS — Phase 3: Job Passports, SKU Blueprints, Job Tickets
// ══════════════════════════════════════════════════════════════════

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

var _jpCache=[];var _bpCache=[];var _jtCache=[];
var _prodListeners=[];
var S_JP={view:'passports',jpEditId:null,bpFilter:'all'};

// ─── Firestore Listeners ───
function startProductionListeners(){
  _prodListeners.push(fbDb.collection('jobPassports').orderBy('createdAt','desc').onSnapshot(function(s){
    _jpCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production')renderProductionView();
  }, function(err){ console.warn('production jobPassports listener:', err.message); }));
  _prodListeners.push(fbDb.collection('blueprints').orderBy('updatedAt','desc').onSnapshot(function(s){
    _bpCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production'&&S_JP.view==='blueprints')renderProductionView();
  }, function(err){ console.warn('production blueprints listener:', err.message); }));
  _prodListeners.push(fbDb.collection('jobTickets').orderBy('createdAt','desc').onSnapshot(function(s){
    _jtCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    if(S.view==='production'&&S_JP.view==='tickets')renderProductionView();
  }, function(err){ console.warn('production jobTickets listener:', err.message); }));
}

function getPassports(){return _jpCache||[]}
function getPassport(id){return _jpCache.find(function(p){return p.id===id})}
function getBlueprints(){return _bpCache||[]}
function getBlueprint(id){return _bpCache.find(function(b){return b.id===id})}
function getJobTickets(){return _jtCache||[]}

function savePassport(jp){jp.updatedAt=new Date().toISOString();jp.updatedBy=getUserName();return fbDb.collection('jobPassports').doc(jp.id).set(jp,{merge:true})}
function saveBlueprint(bp){bp.updatedAt=new Date().toISOString();bp.updatedBy=getUserName();return fbDb.collection('blueprints').doc(bp.id).set(bp,{merge:true})}
function saveJobTicket(jt){jt.updatedAt=new Date().toISOString();jt.updatedBy=getUserName();return fbDb.collection('jobTickets').doc(jt.id).set(jt,{merge:true})}

function genJPLocal(){var d=new Date();var r=Math.floor(Math.random()*9000)+1000;return 'JP'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+'-'+String(r)}
function genJTLocal(){var d=new Date();var r=Math.floor(Math.random()*9000)+1000;return 'JT'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+'-'+String(r)}
async function genJPNumFirestore(){
  if(!window.fbDb)return genJPLocal();
  var d=new Date();var yy=String(d.getFullYear()).slice(2);var mm=String(d.getMonth()+1).padStart(2,'0');
  var ref=window.fbDb.collection('counters').doc('jpNumber');
  try{
    var val=await window.fbDb.runTransaction(function(tx){
      return tx.get(ref).then(function(doc){var n=(doc.exists?doc.data().value:0)+1;tx.set(ref,{value:n});return n;});
    });
    return 'JP'+yy+mm+'-'+String(val).padStart(3,'0');
  }catch(e){console.error('genJPNumFirestore:',e);return genJPLocal()}
}
async function genJTNumFirestore(){
  if(!window.fbDb)return genJTLocal();
  var d=new Date();var yy=String(d.getFullYear()).slice(2);var mm=String(d.getMonth()+1).padStart(2,'0');
  var ref=window.fbDb.collection('counters').doc('jtNumber');
  try{
    var val=await window.fbDb.runTransaction(function(tx){
      return tx.get(ref).then(function(doc){var n=(doc.exists?doc.data().value:0)+1;tx.set(ref,{value:n});return n;});
    });
    return 'JT'+yy+mm+'-'+String(val).padStart(3,'0');
  }catch(e){console.error('genJTNumFirestore:',e);return genJTLocal()}
}
function genJPNum(){return genJPNumFirestore()}
function genJTNum(){return genJTNumFirestore()}

// ══════════════════════════════════════════════════════════════════
// MAIN PRODUCTION VIEW — 4 sub-tabs
// ══════════════════════════════════════════════════════════════════
function renderProductionView(){
  var el=$('v-production');if(!el)return;
  var tabs=[
    {key:'passports',label:'Job Passports',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',count:_jpCache.length},
    {key:'blueprints',label:'Blueprints',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',count:_bpCache.length},
    {key:'tickets',label:'Job Tickets',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',count:_jtCache.filter(function(t){return t.status!=='closed'}).length},
    {key:'prepress',label:'Pre-Press',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',count:_jtCache.filter(function(t){return t.prePressStatus&&t.prePressStatus!=='done'}).length}
  ];
  var h='<div style="display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--bdr);overflow-x:auto">';
  tabs.forEach(function(t){
    h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(S_JP.view===t.key?'var(--ac)':'transparent')+';color:'+(S_JP.view===t.key?'var(--ac)':'var(--tx3)')+'" onclick="S_JP.view=\''+t.key+'\';renderProductionView()">'+t.icon+' '+t.label+' <span style="background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:9px">'+t.count+'</span></div>';
  });
  h+='</div>';

  if(S_JP.view==='passports')h+=renderPassportList();
  else if(S_JP.view==='blueprints')h+=renderBlueprintLibrary();
  else if(S_JP.view==='tickets')h+=renderJobTicketList();
  else if(S_JP.view==='prepress')h+=renderPrePressQueue();

  el.innerHTML=h;
}

// ══════════════════════════════════════════════════════════════════
// JOB PASSPORTS
// ══════════════════════════════════════════════════════════════════
function renderPassportList(){
  var h='<div style="display:flex;gap:6px;margin-bottom:10px">';
  // Show SOs that don't have passports yet
  var sos=getSalesOrders().filter(function(so){return(so.status==='approved'||so.status==='sent')&&!_jpCache.some(function(jp){return jp.soId===so.id})});
  if(sos.length){
    h+='<div style="background:rgba(251,146,60,.06);border:1px solid rgba(251,146,60,.2);border-radius:8px;padding:10px;margin-bottom:10px;width:100%">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:6px">'+sos.length+' APPROVED SO'+(sos.length>1?'s':'')+' WITHOUT PASSPORT</div>';
    sos.forEach(function(so){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr)">';
      h+='<span style="font-size:11px;color:var(--tx)">'+so.soNum+' · '+so.company+' · '+so.quoteNum+'</span>';
      h+='<button class="btn btn-pr btn-xs" onclick="createPassportFromSO(\''+so.id+'\')">Create Passport</button></div>';
    });
    h+='</div>';
  }
  h+='</div>';

  if(!_jpCache.length&&!sos.length)return h+'<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><p>No job passports yet</p><div style="font-size:10px;color:var(--tx3)">Create from an approved Sales Order</div></div>';

  var statusOrder={active:0,prepress:1,production:2,shipping:3,complete:4};
  var sorted=_jpCache.slice().sort(function(a,b){return(statusOrder[a.status]||9)-(statusOrder[b.status]||9)});

  sorted.forEach(function(jp){
    var sc={active:'var(--ac)',prepress:'#a78bfa',production:'var(--gn)',shipping:'var(--or)',complete:'var(--tx3)'}[jp.status]||'var(--tx3)';
    var sl={active:'Active',prepress:'Pre-Press',production:'Production',shipping:'Shipping',complete:'Complete'}[jp.status]||jp.status;
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+sc+';border-radius:0 8px 8px 0;padding:12px;margin-bottom:8px;cursor:pointer" onclick="openPassportDetail(\''+jp.id+'\')">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
    h+='<div><span style="font-size:13px;font-weight:700;color:var(--tx)">'+jp.jpNum+'</span><span style="font-size:10px;color:var(--tx3);margin-left:8px">'+jp.soNum+' → '+jp.quoteNum+'</span></div>';
    h+='<span style="font-size:9px;font-weight:700;color:'+sc+';padding:2px 8px;border-radius:4px;border:1px solid '+sc+'">'+sl+'</span></div>';
    h+='<div style="font-size:12px;font-weight:600;color:var(--tx)">'+jp.company+'</div>';
    h+='<div style="font-size:11px;color:var(--tx3);margin-top:2px">'+jp.jobDesc+'</div>';
    h+='<div style="display:flex;gap:8px;margin-top:6px;font-size:10px;color:var(--tx3)">';
    h+='<span>SKUs: '+(jp.skus?jp.skus.length:0)+'</span>';
    h+='<span>Qty: '+Number(jp.selectedQty||0).toLocaleString()+'</span>';
    var confirmed=(jp.skus||[]).filter(function(s){return s.confirmed}).length;
    var total=(jp.skus||[]).length;
    if(total)h+='<span style="color:'+(confirmed===total?'var(--gn)':'var(--or)')+'">Confirmed: '+confirmed+'/'+total+'</span>';
    h+='</div></div>';
  });
  return h;
}

// ─── Create Passport from SO ───
async function createPassportFromSO(soId, opts){
  opts = opts || {};
  var autoTickets = opts.autoTickets !== false; // default true: auto-generate tickets after
  var so=getSO(soId);if(!so)return toast('Sales Order not found','err');

  // Idempotency — if a passport already exists for this SO, return it instead of creating a duplicate
  var existing=(_jpCache||[]).find(function(p){return p.soId===so.id});
  if(existing){
    if(autoTickets){
      var hasTickets=(_jtCache||[]).some(function(t){return t.passportId===existing.id});
      if(!hasTickets) setTimeout(function(){generateJobTickets(existing.id)}, 500);
    }
    return existing;
  }

  var jpId='jp_'+Date.now();
  if(typeof requestServerNumber !== 'function') { toast('Server unavailable — cannot generate job number','err'); return; }
  var jpNum=await requestServerNumber('jobPassport', genJPLocal);

  // Build initial SKU list from the SO — start with 1 SKU matching the quote specs.
  // Auto-confirm because the SO has already been CEO-approved — specs are final.
  var sku1={
    id:'sku_'+Date.now(),
    name:so.jobDesc,
    sizeA:so.sizeA,sizeB:so.sizeB,shapeType:so.shapeType,
    colors:so.colors,jobType:so.jobType,
    face:so.face,laminate:so.laminate,coating:so.coating,
    windDir:so.windDir,
    qty:so.selectedQty,
    blueprintId:null,
    confirmed:autoTickets?true:false,
    confirmedAt:autoTickets?new Date().toISOString():undefined,
    confirmedBy:autoTickets?getUserName():undefined,
    notes:''
  };

  var jp={
    id:jpId,
    jpNum:jpNum,
    soId:so.id,
    soNum:so.soNum,
    quoteId:so.quoteId,
    quoteNum:so.quoteNum,
    status:'active',

    company:so.company,
    contact:so.contact,
    email:so.email,
    shipTo:so.shipTo,

    jobDesc:so.jobDesc,
    poNumber:so.poNumber,
    selectedQty:so.selectedQty,
    total:so.total,
    payTerms:so.payTerms,
    estimator:so.estimator,

    skus:[sku1],
    files:so.poFiles||[],

    log:[{action:'Passport created from '+so.soNum,by:getUserName(),at:new Date().toISOString()}],

    createdAt:new Date().toISOString(),
    createdBy:getUserName(),
    updatedAt:new Date().toISOString(),
    updatedBy:getUserName()
  };

  savePassport(jp).then(function(){
    toast('Job Passport '+jpNum+' created','ok');
    DB.logActivity('jp.created',jpNum+' from '+so.soNum);
    MFX.track('jp.created',{jpId:jpId,jpNum:jpNum,soNum:so.soNum,company:so.company});
    notifyTeam('🛂 New Job Passport: '+jpNum+' — '+so.company+' ('+so.quoteNum+')');
    // Link passport back to the SO so UI (SO Preview, Orders) can show the jump-link
    if(typeof fbDb!=='undefined'){
      fbDb.collection('salesOrders').doc(so.id).set({passportId:jpId,passportNum:jpNum,updatedAt:new Date().toISOString()},{merge:true}).catch(function(e){console.warn('SO passport link:',e.message)});
    }
    S_JP.view='passports';
    if(typeof renderProductionView==='function' && typeof S!=='undefined' && S.view==='production') renderProductionView();

    // Auto-generate tickets + provision PPD workspace when triggered by SO approval
    if(autoTickets){
      // Small delay so the passport is in _jpCache before generateJobTickets reads it
      setTimeout(function(){
        var fresh=getPassport(jpId);
        if(!fresh){
          // Cache not hydrated yet — inject directly so generateJobTickets can find it
          if(Array.isArray(_jpCache)) _jpCache.push(jp);
        }
        generateJobTickets(jpId);
      }, 800);
    }
  });
  return jp;
}

// ─── Passport Detail ───
function openPassportDetail(jpId){
  var jp=getPassport(jpId);if(!jp)return;

  var h='<div class="modal-title" style="margin-bottom:0">'+jp.jpNum+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:12px">'+jp.soNum+' → '+jp.quoteNum+' · PO# '+jp.poNumber+'</div>';

  // Status selector
  h+='<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">';
  ['active','prepress','production','shipping','complete'].forEach(function(st){
    var active=jp.status===st;
    h+='<button class="btn btn-xs '+(active?'btn-pr':'btn-ghost')+'" onclick="setPassportStatus(\''+jp.id+'\',\''+st+'\');closeModal();setTimeout(function(){openPassportDetail(\''+jp.id+'\')},300)" style="font-size:9px">'+st+'</button>';
  });
  h+='</div>';

  // Client & order info
  h+='<div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:8px">';
  h+='<div style="font-size:12px;font-weight:700;color:var(--tx)">'+jp.company+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">'+jp.contact+' · '+jp.email+' · Ship: '+jp.shipTo+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+jp.jobDesc+' · Qty: '+Number(jp.selectedQty).toLocaleString()+' · $'+Number(jp.total).toLocaleString(undefined,{minimumFractionDigits:2})+'</div>';
  h+='</div>';

  // SKUs
  h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1.5px;margin:10px 0 6px">SKUs ('+(jp.skus||[]).length+')</div>';
  (jp.skus||[]).forEach(function(sku,i){
    var bp=sku.blueprintId?getBlueprint(sku.blueprintId):null;
    h+='<div style="background:var(--bg3);border:1px solid '+(sku.confirmed?'var(--gn)':'var(--bdr)')+';border-radius:6px;padding:10px;margin-bottom:6px">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center">';
    h+='<div style="font-size:12px;font-weight:600;color:var(--tx)">'+(sku.confirmed?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ':'')+(sku.name||'SKU '+(i+1))+'</div>';
    h+='<div style="display:flex;gap:4px">';
    if(!sku.confirmed){
      if(bp){h+='<button class="btn btn-pr btn-xs" onclick="confirmSKU(\''+jp.id+'\','+i+');closeModal();setTimeout(function(){openPassportDetail(\''+jp.id+'\')},300)">Confirm</button>'}
      else{h+='<button class="btn btn-ghost btn-xs" onclick="closeModal();linkBlueprintToSKU(\''+jp.id+'\','+i+')">Link Blueprint</button>'}
    }
    h+='</div></div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+(sku.sizeA||'?')+'x'+(sku.sizeB||'?')+'" '+(sku.shapeType||'')+' · '+(sku.colors||'?')+'C '+(sku.jobType||'Flexo')+' · Qty: '+Number(sku.qty||0).toLocaleString()+'</div>';
    if(bp)h+='<div style="font-size:10px;color:var(--ac);margin-top:2px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> Blueprint: '+bp.bpName+' ('+bp.bpId+')</div>';
    h+='</div>';
  });
  h+='<button class="btn btn-ghost btn-xs" onclick="closeModal();addSKUToPassport(\''+jp.id+'\')" style="margin-bottom:10px">+ Add SKU</button>';

  // Generate job tickets
  var allConfirmed=(jp.skus||[]).length>0&&(jp.skus||[]).every(function(s){return s.confirmed});
  if(allConfirmed){
    var hasTickets=_jtCache.some(function(t){return t.passportId===jp.id});
    if(!hasTickets){
      h+='<button class="btn btn-pr" onclick="closeModal();generateJobTickets(\''+jp.id+'\')" style="width:100%;padding:12px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Generate Job Tickets</button>';
    }else{
      h+='<div style="background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:6px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--gn);text-align:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Job tickets generated</div>';
    }
  }

  // Files
  if(jp.files&&jp.files.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1.5px;margin:6px 0 4px">FILES ('+jp.files.length+')</div>';
    jp.files.forEach(function(f){
      h+='<div style="font-size:10px;padding:3px 0;border-bottom:1px solid var(--bdr)"><a href="'+f.url+'" target="_blank" style="color:var(--ac)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> '+f.name+'</a></div>';
    });
  }

  // Log
  if(jp.log&&jp.log.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1.5px;margin:10px 0 4px">LOG</div>';
    jp.log.slice(-10).reverse().forEach(function(l){
      h+='<div style="font-size:9px;padding:2px 0;color:var(--tx3)">'+fD(l.at)+' · '+l.action+' — '+l.by+'</div>';
    });
  }

  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:8px">Close</button>';
  openModal(h);
}

function setPassportStatus(jpId,st){
  var jp=getPassport(jpId);if(!jp)return;
  jp.status=st;
  jp.log=jp.log||[];
  jp.log.push({action:'Status → '+st,by:getUserName(),at:new Date().toISOString()});
  savePassport(jp).then(function(){toast('Status → '+st,'ok')});
}

function addSKUToPassport(jpId){
  var jp=getPassport(jpId);if(!jp)return;
  var name=prompt('SKU name/description:');if(!name)return;
  var qty=prompt('Quantity:',jp.selectedQty);
  jp.skus=jp.skus||[];
  jp.skus.push({
    id:'sku_'+Date.now(),name:name,
    sizeA:jp.skus[0]?jp.skus[0].sizeA:'',sizeB:jp.skus[0]?jp.skus[0].sizeB:'',
    shapeType:jp.skus[0]?jp.skus[0].shapeType:'',colors:jp.skus[0]?jp.skus[0].colors:'',
    jobType:jp.skus[0]?jp.skus[0].jobType:'',face:jp.skus[0]?jp.skus[0].face:'',
    laminate:jp.skus[0]?jp.skus[0].laminate:'',coating:jp.skus[0]?jp.skus[0].coating:'',
    windDir:jp.skus[0]?jp.skus[0].windDir:'',qty:parseInt(qty)||0,
    blueprintId:null,confirmed:false,notes:''
  });
  jp.log.push({action:'SKU added: '+name,by:getUserName(),at:new Date().toISOString()});
  savePassport(jp).then(function(){toast('SKU added','ok');openPassportDetail(jpId)});
}

function confirmSKU(jpId,skuIdx){
  var jp=getPassport(jpId);if(!jp||!jp.skus[skuIdx])return;
  jp.skus[skuIdx].confirmed=true;
  jp.skus[skuIdx].confirmedAt=new Date().toISOString();
  jp.skus[skuIdx].confirmedBy=getUserName();
  jp.log.push({action:'SKU confirmed: '+jp.skus[skuIdx].name,by:getUserName(),at:new Date().toISOString()});
  savePassport(jp).then(function(){toast('SKU confirmed','ok')});
}

// ══════════════════════════════════════════════════════════════════
// BLUEPRINT LIBRARY
// ══════════════════════════════════════════════════════════════════
function renderBlueprintLibrary(){
  var h='<div style="display:flex;gap:6px;margin-bottom:10px"><button class="btn btn-pr btn-xs" onclick="createNewBlueprint()">+ New Blueprint</button>';
  h+='<input placeholder="Search blueprints..." style="flex:1;padding:6px 10px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px" oninput="S_JP.bpSearch=this.value;renderProductionView()"></div>';

  var bps=_bpCache;
  if(S_JP.bpSearch){var s=S_JP.bpSearch.toLowerCase();bps=bps.filter(function(b){return(b.bpName+' '+b.company+' '+(b.jobDesc||'')).toLowerCase().includes(s)})}

  if(!bps.length)return h+'<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div><p>No blueprints yet</p><div style="font-size:10px;color:var(--tx3)">Create one or link from a Job Passport SKU</div></div>';

  bps.forEach(function(bp){
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-bottom:6px;cursor:pointer" onclick="openBlueprintDetail(\''+bp.id+'\')">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center">';
    h+='<div><span style="font-size:12px;font-weight:700;color:var(--ac)">'+bp.bpId+'</span><span style="font-size:11px;font-weight:600;color:var(--tx);margin-left:8px">'+bp.bpName+'</span></div>';
    h+='<span style="font-size:9px;color:var(--tx3)">Used: '+(bp.useCount||0)+'x</span></div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+(bp.sizeA||'?')+'x'+(bp.sizeB||'?')+'" '+(bp.shapeType||'')+' · '+(bp.colors||'?')+'C '+(bp.jobType||'')+' · '+(bp.face||'—')+' / '+(bp.laminate||'—')+'</div>';
    if(bp.company)h+='<div style="font-size:10px;color:var(--tx3)">Origin: '+bp.company+'</div>';
    h+='</div>';
  });
  return h;
}

function createNewBlueprint(prefill){
  var bpId='BP-'+String(Date.now()).slice(-6);
  var name=prompt('Blueprint name:',(prefill?prefill.name:''));if(!name)return;

  var bp={
    id:'bp_'+Date.now(),
    bpId:bpId,
    bpName:name,
    sizeA:(prefill?prefill.sizeA:''),sizeB:(prefill?prefill.sizeB:''),
    shapeType:(prefill?prefill.shapeType:''),colors:(prefill?prefill.colors:''),
    jobType:(prefill?prefill.jobType:''),face:(prefill?prefill.face:''),
    laminate:(prefill?prefill.laminate:''),coating:(prefill?prefill.coating:''),
    windDir:(prefill?prefill.windDir:''),
    company:(prefill?prefill.company:''),
    notes:'',
    useCount:0,
    productionHistory:[],
    createdAt:new Date().toISOString(),
    createdBy:getUserName(),
    updatedAt:new Date().toISOString(),
    updatedBy:getUserName()
  };

  saveBlueprint(bp).then(function(){
    toast('Blueprint '+bpId+' created','ok');
    DB.logActivity('bp.created',bpId+' — '+name);
    if(prefill&&prefill._linkCallback)prefill._linkCallback(bp.id);
    else renderProductionView();
  });
  return bp;
}

function openBlueprintDetail(bpId){
  var bp=getBlueprint(bpId);if(!bp)return;
  var h='<div class="modal-title">'+bp.bpId+' — '+bp.bpName+'</div>';

  h+='<div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:8px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:6px">SPECIFICATIONS</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">';
  h+='<div><span style="color:var(--tx3)">Size:</span> <span style="color:var(--tx)">'+(bp.sizeA||'?')+'x'+(bp.sizeB||'?')+'"</span></div>';
  h+='<div><span style="color:var(--tx3)">Shape:</span> <span style="color:var(--tx)">'+(bp.shapeType||'—')+'</span></div>';
  h+='<div><span style="color:var(--tx3)">Colors:</span> <span style="color:var(--tx)">'+(bp.colors||'—')+'</span></div>';
  h+='<div><span style="color:var(--tx3)">Process:</span> <span style="color:var(--tx)">'+(bp.jobType||'—')+'</span></div>';
  h+='<div><span style="color:var(--tx3)">Face:</span> <span style="color:var(--tx)">'+(bp.face||'—')+'</span></div>';
  h+='<div><span style="color:var(--tx3)">Laminate:</span> <span style="color:var(--tx)">'+(bp.laminate||'—')+'</span></div>';
  h+='<div><span style="color:var(--tx3)">Coating:</span> <span style="color:var(--tx)">'+(bp.coating||'—')+'</span></div>';
  h+='<div><span style="color:var(--tx3)">Wind:</span> <span style="color:var(--tx)">'+(bp.windDir||'—')+'</span></div>';
  h+='</div>';
  if(bp.company)h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">Origin: '+bp.company+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:2px">Used '+bp.useCount+'x · Created '+fD(bp.createdAt)+' by '+bp.createdBy+'</div>';
  h+='</div>';

  if(bp.productionHistory&&bp.productionHistory.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1.5px;margin:8px 0 4px">PRODUCTION HISTORY</div>';
    bp.productionHistory.forEach(function(ph){
      h+='<div style="font-size:10px;padding:3px 0;border-bottom:1px solid var(--bdr);color:var(--tx3)">'+fD(ph.at)+' · '+ph.jpNum+' · Qty: '+Number(ph.qty).toLocaleString()+' — '+ph.by+'</div>';
    });
  }

  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:8px">Close</button>';
  openModal(h);
}

function linkBlueprintToSKU(jpId,skuIdx){
  var jp=getPassport(jpId);if(!jp)return;
  var sku=jp.skus[skuIdx];

  // Show picker: existing blueprints or create new
  var h='<div class="modal-title">Link Blueprint to SKU</div>';
  h+='<div style="font-size:11px;color:var(--tx2);margin-bottom:10px">'+sku.name+'</div>';
  h+='<button class="btn btn-pr btn-xs" onclick="closeModal();createBlueprintForSKU(\''+jpId+'\','+skuIdx+')" style="width:100%;margin-bottom:10px">+ Create New Blueprint</button>';

  if(_bpCache.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:6px">OR LINK EXISTING:</div>';
    _bpCache.forEach(function(bp){
      h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:8px;margin-bottom:4px;cursor:pointer" onclick="closeModal();doLinkBlueprint(\''+jpId+'\','+skuIdx+',\''+bp.id+'\')">';
      h+='<div style="font-size:11px;font-weight:600;color:var(--ac)">'+bp.bpId+' — '+bp.bpName+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+(bp.sizeA||'?')+'x'+(bp.sizeB||'?')+'" · '+(bp.colors||'?')+'C · '+(bp.face||'—')+'</div></div>';
    });
  }
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
  openModal(h);
}

function createBlueprintForSKU(jpId,skuIdx){
  var jp=getPassport(jpId);if(!jp)return;
  var sku=jp.skus[skuIdx];
  createNewBlueprint({
    name:sku.name,sizeA:sku.sizeA,sizeB:sku.sizeB,shapeType:sku.shapeType,
    colors:sku.colors,jobType:sku.jobType,face:sku.face,laminate:sku.laminate,
    coating:sku.coating,windDir:sku.windDir,company:jp.company,
    _linkCallback:function(bpId){doLinkBlueprint(jpId,skuIdx,bpId)}
  });
}

function doLinkBlueprint(jpId,skuIdx,bpId){
  var jp=getPassport(jpId);if(!jp)return;
  jp.skus[skuIdx].blueprintId=bpId;
  jp.log.push({action:'Blueprint linked to SKU: '+jp.skus[skuIdx].name,by:getUserName(),at:new Date().toISOString()});

  var bp=getBlueprint(bpId);
  if(bp){bp.useCount=(bp.useCount||0)+1;saveBlueprint(bp)}

  savePassport(jp).then(function(){
    toast('Blueprint linked','ok');
    openPassportDetail(jpId);
  });
}

// ══════════════════════════════════════════════════════════════════
// JOB TICKETS
// ══════════════════════════════════════════════════════════════════
function renderJobTicketList(){
  var h='';
  var open=_jtCache.filter(function(t){return t.status!=='closed'});
  var closed=_jtCache.filter(function(t){return t.status==='closed'});

  if(!_jtCache.length)return '<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div><p>No job tickets yet</p><div style="font-size:10px;color:var(--tx3)">Generate from a Job Passport with all SKUs confirmed</div></div>';

  if(open.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:6px">OPEN ('+open.length+')</div>';
    open.forEach(function(jt){h+=renderJTCard(jt)});
  }
  if(closed.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--tx3);letter-spacing:1px;margin:12px 0 6px">CLOSED ('+closed.length+')</div>';
    closed.slice(0,10).forEach(function(jt){h+=renderJTCard(jt)});
  }
  return h;
}

function renderJTCard(jt){
  var sc={open:'var(--ac)',prepress:'#a78bfa',running:'var(--gn)',qa:'var(--or)',closed:'var(--tx3)'}[jt.status]||'var(--tx3)';
  var h='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+sc+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center">';
  h+='<div><span style="font-size:12px;font-weight:700;color:var(--tx)">'+jt.jtNum+'</span><span style="font-size:10px;color:var(--tx3);margin-left:6px">'+jt.jpNum+'</span></div>';
  h+='<div style="display:flex;gap:4px">';
  ['open','prepress','running','qa','closed'].forEach(function(st){
    h+='<button class="btn btn-xs '+(jt.status===st?'btn-pr':'btn-ghost')+'" onclick="setJTStatus(\''+jt.id+'\',\''+st+'\')" style="font-size:8px;padding:2px 6px">'+st+'</button>';
  });
  h+='</div></div>';
  h+='<div style="font-size:11px;color:var(--tx);margin-top:4px">'+jt.skuName+' · '+jt.company+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">Qty: '+Number(jt.qty||0).toLocaleString()+' · '+(jt.sizeA||'?')+'x'+(jt.sizeB||'?')+'" · '+(jt.colors||'?')+'C '+(jt.jobType||'')+'</div>';
  if(jt.blueprintId){var bp=getBlueprint(jt.blueprintId);if(bp)h+='<div style="font-size:10px;color:var(--ac)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> '+bp.bpId+' — '+bp.bpName+'</div>'}
  if(jt.ppd&&jt.ppd.stage)h+='<div style="font-size:10px;color:var(--dept-pp);margin-top:3px">PPD: '+jt.ppd.stage+(jt.ppd.proofStatus?' · '+jt.ppd.proofStatus:'')+'</div>';
  var jtVpos=(window._vpoCache||[]).filter(function(v){return v.forJTId===jt.id||v.forJTNum===jt.jtNum});
  if(jtVpos.length){h+='<div style="font-size:10px;color:#a78bfa;margin-top:3px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> '+jtVpos.length+' vendor PO'+(jtVpos.length>1?'s':'')+' linked</div>'}
  if(jt.status!=='closed'){h+='<div style="margin-top:5px"><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();vpAutoGenerateFromJT(\''+jt.id+'\')" style="font-size:9px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Order Materials</button></div>'}
  h+='</div>';
  return h;
}

function setJTStatus(jtId,st){
  var jt=_jtCache.find(function(t){return t.id===jtId});if(!jt)return;
  jt.status=st;
  jt.log=jt.log||[];
  jt.log.push({action:'Status → '+st,by:getUserName(),at:new Date().toISOString()});
  var newSt=st;var ticket=jt;
  saveJobTicket(jt).then(function(){toast(jt.jtNum+' → '+st,'ok');if(typeof MFX!=='undefined'&&MFX.emit) MFX.emit('job.stageChange', {jtId:jt.id, stage:jt.status});
  // After saving ticket status, check passport auto-sync
  (function autoSyncPassport(jpId, newStatus) {
    if(!jpId) return;
    var jp = _jpCache.find(function(p){ return p.id === jpId; });
    if(!jp) return;
    var tickets = _jtCache.filter(function(t){ return t.passportId === jpId || t.jpId === jpId; });
    if(!tickets.length) return;
    var allPrepress = tickets.every(function(t){ return t.status === 'prepress' || t.status === 'running' || t.status === 'qa' || t.status === 'closed'; });
    var allRunning = tickets.every(function(t){ return t.status === 'running' || t.status === 'qa' || t.status === 'closed'; });
    var allClosed = tickets.every(function(t){ return t.status === 'closed'; });
    var targetStatus = null;
    if(allClosed) targetStatus = 'complete';
    else if(allRunning) targetStatus = 'production';
    else if(allPrepress) targetStatus = 'prepress';
    if(targetStatus && jp.status !== targetStatus) {
      jp.status = targetStatus;
      jp.updatedAt = new Date().toISOString();
      fbDb.collection('jobPassports').doc(jpId).update({ status: targetStatus, updatedAt: jp.updatedAt })
        .catch(function(e){ console.warn('passport auto-sync:', e); });
    }
  })(ticket.passportId || ticket.jpId, newSt);
  });
}

async function generateJobTickets(jpId){
  if(window._generatingTickets) return;
  window._generatingTickets = true;
  var jp=getPassport(jpId);if(!jp){window._generatingTickets=false;return;}
  var created=0;
  var promises=[];

  for (const sku of (jp.skus||[])) {
    var jtId='jt_'+Date.now()+'_'+(created++);
    if(typeof requestServerNumber !== 'function') { toast('Server unavailable — cannot generate job number','err'); return; }
    var jtNum=await requestServerNumber('jobTicket', genJTLocal);
    const jt={
      id:jtId,
      jtNum:jtNum,
      passportId:jp.id,
      jpNum:jp.jpNum,
      soNum:jp.soNum,
      quoteNum:jp.quoteNum,
      company:jp.company,
      contact:jp.contact,
      email:jp.email,

      skuId:sku.id,
      skuName:sku.name,
      blueprintId:sku.blueprintId||null,
      sizeA:sku.sizeA,sizeB:sku.sizeB,shapeType:sku.shapeType,
      colors:sku.colors,jobType:sku.jobType,
      face:sku.face,laminate:sku.laminate,coating:sku.coating,windDir:sku.windDir,
      qty:sku.qty,

      status:'open',
      prePressStatus:'pending',
      logisticsStatus:'pending',
      ppd:{
        stage:'Intake',
        assignedTo:'',
        dueDate:'',
        proofStatus:'Not Started',
        blocked:false,
        driveFolderUrl:'',
        dropboxFolderUrl:'',
        checklist:{files:false,art:false,proof:false,release:false}
      },

      log:[{action:'Job ticket created from '+jp.jpNum,by:getUserName(),at:new Date().toISOString()}],

      createdAt:new Date().toISOString(),
      createdBy:getUserName(),
      updatedAt:new Date().toISOString(),
      updatedBy:getUserName()
    };

    promises.push(saveJobTicket(jt).then(function(){
      if(typeof provisionPPDWorkspace==='function'){
        return provisionPPDWorkspace({jobTicketId:jt.id,jobTicketNum:jt.jtNum,company:jt.company,skuName:jt.skuName,quoteNum:jt.quoteNum,blueprintId:jt.blueprintId||''}).catch(function(err){console.warn('PPD folder provisioning:',err.message||err);});
      }
    }));

    if(sku.blueprintId){
      var bp=getBlueprint(sku.blueprintId);
      if(bp){
        bp.productionHistory=bp.productionHistory||[];
        bp.productionHistory.push({jpNum:jp.jpNum,jtNum:jtNum,qty:sku.qty,at:new Date().toISOString(),by:getUserName()});
        promises.push(saveBlueprint(bp));
      }
    }
  }

  jp.status='prepress';
  jp.log.push({action:created+' job ticket(s) generated',by:getUserName(),at:new Date().toISOString()});
  promises.push(savePassport(jp));

  Promise.all(promises).then(function(){
    window._generatingTickets = false;
    toast(created+' job ticket(s) created','ok');
    DB.logActivity('jt.batch',created+' tickets from '+jp.jpNum);
    MFX.track('jt.created',{jpId:jp.id,jpNum:jp.jpNum,count:created,company:jp.company});

    notifyTeam('🎫 '+created+' NEW JOB TICKET'+(created>1?'S':'')+': '+jp.jpNum+' — '+jp.company+' ('+jp.quoteNum+')\n🎨 Pre-Press: Art/proofs needed\n📦 Logistics: Materials to stage');

    S_JP.view='tickets';
    renderProductionView();
  }).catch(function(err){
    window._generatingTickets = false;
    console.error('generateJobTickets error:',err);
    toast('Error generating tickets','err');
  });
}

// ─── Pre-Press Queue ───
function renderPrePressQueue(){
  var tickets=_jtCache.filter(function(t){return t.status!=='closed'});
  var ppPending=tickets.filter(function(t){return t.prePressStatus==='pending'||t.prePressStatus==='in-progress'});
  var ppDone=tickets.filter(function(t){return t.prePressStatus==='done'});

  var h='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><div style="font-size:11px;color:var(--tx3)">Art files, proofs, and plate readiness for active job tickets</div><button class="btn btn-ghost btn-xs" onclick="goView(\'ppd\')">Open PPD</button></div>'; 

  if(!tickets.length)return h+'<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></div><p>No active tickets for pre-press</p></div>';

  if(ppPending.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:6px">NEEDS ATTENTION ('+ppPending.length+')</div>';
    ppPending.forEach(function(jt){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid #a78bfa;border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center">';
      h+='<div><span style="font-size:12px;font-weight:700;color:var(--tx)">'+jt.jtNum+'</span><span style="font-size:10px;color:var(--tx3);margin-left:6px">'+jt.company+'</span></div>';
      h+='<div style="display:flex;gap:4px">';
      ['pending','in-progress','done'].forEach(function(st){
        h+='<button class="btn btn-xs '+(jt.prePressStatus===st?'btn-pr':'btn-ghost')+'" onclick="setPPStatus(\''+jt.id+'\',\''+st+'\')" style="font-size:8px;padding:2px 6px">'+st+'</button>';
      });
      h+='</div></div>';
      h+='<div style="font-size:11px;color:var(--tx);margin-top:4px">'+jt.skuName+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+(jt.sizeA||'?')+'x'+(jt.sizeB||'?')+'" · '+(jt.colors||'?')+'C · '+(jt.face||'—')+'</div>';
      if(jt.ppd&&jt.ppd.stage)h+='<div style="font-size:10px;color:var(--dept-pp);margin-top:3px">PPD: '+jt.ppd.stage+(jt.ppd.proofStatus?' · '+jt.ppd.proofStatus:'')+'</div>'; 
      h+='</div>';
    });
  }

  if(ppDone.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--gn);letter-spacing:1px;margin:12px 0 6px">COMPLETE ('+ppDone.length+')</div>';
    ppDone.forEach(function(jt){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px;color:var(--tx3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> '+jt.jtNum+' · '+jt.skuName+' · '+jt.company+'</div>';
    });
  }
  return h;
}

function setPPStatus(jtId,st){
  var jt=_jtCache.find(function(t){return t.id===jtId});if(!jt)return;
  jt.prePressStatus=st;
  jt.ppd=jt.ppd||{};
  jt.ppd.stage=(st==='done'?'Released':st==='in-progress'?'Art Review':'Intake');
  jt.log=jt.log||[];
  jt.log.push({action:'Pre-press → '+st,by:getUserName(),at:new Date().toISOString()});
  if(st==='done')notifyTeam('🎨 Pre-press COMPLETE: '+jt.jtNum+' — '+jt.skuName+' ('+jt.company+') ready for production');
  var newSt=st;var ticket=jt;
  saveJobTicket(jt).then(function(){toast(jt.jtNum+' pre-press → '+st,'ok');if(typeof MFX!=='undefined'&&MFX.emit) MFX.emit('job.stageChange', {jtId:jt.id, stage:jt.ppd.stage});
  // After saving ticket status, check passport auto-sync
  (function autoSyncPassport(jpId, newStatus) {
    if(!jpId) return;
    var jp = _jpCache.find(function(p){ return p.id === jpId; });
    if(!jp) return;
    var tickets = _jtCache.filter(function(t){ return t.passportId === jpId || t.jpId === jpId; });
    if(!tickets.length) return;
    var allPrepress = tickets.every(function(t){ return t.status === 'prepress' || t.status === 'running' || t.status === 'qa' || t.status === 'closed'; });
    var allRunning = tickets.every(function(t){ return t.status === 'running' || t.status === 'qa' || t.status === 'closed'; });
    var allClosed = tickets.every(function(t){ return t.status === 'closed'; });
    var targetStatus = null;
    if(allClosed) targetStatus = 'complete';
    else if(allRunning) targetStatus = 'production';
    else if(allPrepress) targetStatus = 'prepress';
    if(targetStatus && jp.status !== targetStatus) {
      jp.status = targetStatus;
      jp.updatedAt = new Date().toISOString();
      fbDb.collection('jobPassports').doc(jpId).update({ status: targetStatus, updatedAt: jp.updatedAt })
        .catch(function(e){ console.warn('passport auto-sync:', e); });
    }
  })(ticket.passportId || ticket.jpId, newSt);
  });
}

// ─── Init ───
if(typeof fbDb!=='undefined'){
  setTimeout(startProductionListeners,1500);
}
window.detachProductionListeners=function(){_prodListeners.forEach(function(fn){fn()});_prodListeners=[];};
