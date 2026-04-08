// ══════════════════════════════════════════════════════════════════
// MFX OS — Phase 2: PO Library & Sales Orders
// ══════════════════════════════════════════════════════════════════

(function(){'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ─── Utility: format date (used throughout) ───
function fD(d){if(!d)return'---';var dt=d.toDate?d.toDate():new Date(d);return isNaN(dt)?String(d):dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});}

var _soCache=[];var _soReady=false;
var S_SO={view:'pos',soEditId:null,soFilter:'all',soSearch:''};

// ─── Firestore Listeners ───
function startSOListeners(){
  if(typeof fbDb==='undefined')return;
  fbDb.collection('salesOrders').orderBy('createdAt','desc').onSnapshot(function(s){
    _soCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    _soReady=true;
    if(typeof S!=='undefined'&&S.view==='orders')renderOrdersView();
  },function(err){console.warn('salesOrders listener error:',err.message)});
}

// ─── Data Access ───
function getSalesOrders(){return _soCache||[]}
function getSO(id){return _soCache.find(function(s){return s.id===id})}
function getPOs(){return(typeof DB!=='undefined'&&DB.quotes)?DB.quotes().filter(function(q){return q.status==='won'&&q.poNumber}):[]}

function saveSO(so){
  so.updatedAt=new Date().toISOString();
  so.updatedBy=getUserName();
  return fbDb.collection('salesOrders').doc(so.id).set(so,{merge:true});
}

function genSONUMLocal(){
  var d=new Date();var yy=String(d.getFullYear()).slice(2);var mm=String(d.getMonth()+1).padStart(2,'0');
  var r=Math.floor(Math.random()*9000)+1000;
  return 'SO'+yy+mm+'-'+String(r);
}
async function genSONUMFirestore(){
  if(!window.fbDb)return genSONUMLocal();
  var d=new Date();var yy=String(d.getFullYear()).slice(2);var mm=String(d.getMonth()+1).padStart(2,'0');
  var ref=window.fbDb.collection('counters').doc('soNumber');
  try{
    var val=await window.fbDb.runTransaction(function(tx){
      return tx.get(ref).then(function(doc){
        var n=(doc.exists?doc.data().value:0)+1;
        tx.set(ref,{value:n});return n;
      });
    });
    return 'SO'+yy+mm+'-'+String(val).padStart(3,'0');
  }catch(e){console.error('genSONUMFirestore:',e);return genSONUMLocal()}
}
function genSONUM(){return genSONUMFirestore()}

// ─── Main Orders View (subtabs: POs | Sales Orders) ───
function renderOrdersView(){
  var el=$('v-orders');if(!el)return;
  var pos=getPOs();var sos=getSalesOrders();
  var pendingSOs=sos.filter(function(s){return s.status==='pending'});
  var approvedSOs=sos.filter(function(s){return s.status==='approved'||s.status==='sent'});

  var h='<div style="display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--bdr)">';
  h+='<div style="padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;border-bottom:2px solid '+(S_SO.view==='pos'?'var(--ac)':'transparent')+';color:'+(S_SO.view==='pos'?'var(--ac)':'var(--tx3)')+'" onclick="S_SO.view=\'pos\';renderOrdersView()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Purchase Orders <span style="background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px">'+pos.length+'</span></div>';
  h+='<div style="padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;border-bottom:2px solid '+(S_SO.view==='sos'?'var(--ac)':'transparent')+';color:'+(S_SO.view==='sos'?'var(--ac)':'var(--tx3)')+'" onclick="S_SO.view=\'sos\';renderOrdersView()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Sales Orders <span style="background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px">'+sos.length+'</span>'+(pendingSOs.length?'<span style="background:var(--or);color:#000;padding:1px 5px;border-radius:8px;font-size:9px;margin-left:4px">'+pendingSOs.length+'</span>':'')+'</div>';
  h+='</div>';

  if(S_SO.view==='pos')h+=renderPOList(pos);
  else h+=renderSOList(sos,pendingSOs,approvedSOs);

  el.innerHTML=h;
}

// ─── PO List ───
function renderPOList(pos){
  var h='<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Quotes won with PO submitted by clients</div>';
  if(!pos.length)return h+'<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><p>No POs received yet</p></div>';

  pos.forEach(function(q){
    var f=q.fields||{};
    var hasSO=_soCache.some(function(s){return s.quoteId===q.id});
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="openEditor(\''+q.id+'\')">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h+='<div><span style="font-size:13px;font-weight:700;color:var(--tx)">'+esc(q.quoteNum)+'</span><span style="font-size:10px;color:var(--tx3);margin-left:6px">Rev '+esc(q.rev)+'</span></div>';
    h+='<span class="pill pill-won">WON</span></div>';
    h+='<div style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(f.custCo||'—')+'</div>';
    h+='<div style="display:flex;gap:12px;margin-top:6px;font-size:10px;color:var(--tx3)">';
    h+='<span>PO# '+(q.poNumber||'—')+'</span>';
    h+='<span>Signed: '+(q.poSignature||'—')+'</span>';
    h+='<span>'+(q.poSignedAt?fD(q.poSignedAt):'—')+'</span>';
    if(q.poFiles&&q.poFiles.length)h+='<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> '+q.poFiles.length+' file'+(q.poFiles.length>1?'s':'')+'</span>';
    h+='</div>';
    h+='<div style="margin-top:8px;display:flex;gap:6px">';
    if(!hasSO){h+='<button class="btn btn-pr btn-xs" onclick="event.stopPropagation();createSOFromPO(\''+q.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Create Sales Order</button>'}
    else{h+='<span style="font-size:10px;color:var(--gn);font-weight:600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SO Created</span>'}
    h+='</div></div>';
  });
  return h;
}

// ─── Sales Order List ───
function renderSOList(sos,pending,approved){
  var h='';
  // Buckets
  if(pending.length){
    h+='<div style="font-size:11px;font-weight:700;color:var(--or);margin-bottom:6px;letter-spacing:1px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> PENDING APPROVAL ('+pending.length+')</div>';
    pending.forEach(function(so){h+=renderSOCard(so)});
  }
  if(approved.length){
    h+='<div style="font-size:11px;font-weight:700;color:var(--gn);margin:12px 0 6px;letter-spacing:1px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> APPROVED ('+approved.length+')</div>';
    approved.forEach(function(so){h+=renderSOCard(so)});
  }
  var other=sos.filter(function(s){return s.status!=='pending'&&s.status!=='approved'&&s.status!=='sent'});
  if(other.length){
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx3);margin:12px 0 6px;letter-spacing:1px">ALL ('+other.length+')</div>';
    other.forEach(function(so){h+=renderSOCard(so)});
  }
  if(!sos.length)h+='<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></div><p>No sales orders yet</p><div style="font-size:10px;color:var(--tx3)">Create one from a received PO</div></div>';
  return h;
}

function renderSOCard(so){
  var statusColors={pending:'var(--or)',approved:'var(--gn)',sent:'var(--ac)',draft:'var(--tx3)'};
  var statusLabels={pending:'Pending Approval',approved:'Approved',sent:'Sent to Client',draft:'Draft'};
  var sc=statusColors[so.status]||'var(--tx3)';
  var sl=statusLabels[so.status]||so.status;

  var h='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+sc+';border-radius:0 8px 8px 0;padding:12px;margin-bottom:8px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h+='<div><span style="font-size:13px;font-weight:700;color:var(--tx)">'+esc(so.soNum||'—')+'</span><span style="font-size:10px;color:var(--tx3);margin-left:8px">from '+esc(so.quoteNum)+'</span></div>';
  h+='<span style="font-size:9px;font-weight:700;color:'+sc+';background:rgba(255,255,255,.05);padding:2px 8px;border-radius:4px;border:1px solid '+sc+'">'+sl+'</span></div>';
  h+='<div style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(so.company||'—')+'</div>';
  h+='<div style="display:flex;gap:12px;margin-top:4px;font-size:10px;color:var(--tx3)">';
  h+='<span>PO# '+esc(so.poNumber||'—')+'</span>';
  h+='<span>Contact: '+esc(so.contact||'—')+'</span>';
  if(so.selectedQty)h+='<span>Qty: '+Number(so.selectedQty).toLocaleString()+'</span>';
  if(so.total)h+='<span>Total: $'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})+'</span>';
  h+='</div>';
  h+='<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
  if(so.status==='pending'){
    h+='<button class="btn btn-approve btn-xs" onclick="approveSO(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> CEO Approve</button>';
    h+='<button class="btn btn-ghost btn-xs" onclick="openSODetail(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View</button>';
  }
  if(so.status==='approved'){
    h+='<button class="btn btn-pr btn-xs" onclick="sendSOToClient(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Send to Client</button>';
    h+='<button class="btn btn-ghost btn-xs" onclick="openSODetail(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View</button>';
  }
  if(so.status==='sent'){
    h+='<button class="btn btn-ghost btn-xs" onclick="openSODetail(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View</button>';
    if(so.driveLink)h+='<a href="'+so.driveLink+'" target="_blank" class="btn btn-ghost btn-xs" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> Drive</a>';
  }
  h+='</div></div>';
  return h;
}

// ─── Create Sales Order from PO ───
async function createSOFromPO(quoteId){
  var q=getQ(quoteId);if(!q)return toast('Quote not found','err');
  var f=q.fields||{};
  if(!f.custCo || !f.custCo.trim()) { toast('Quote has no customer — cannot create SO','err'); return; }
  if(!q.poNumber) { toast('Quote has no PO number — mark as Won first','err'); return; }
  var selIdx=q.poQtyIndex||0;
  var selRow=q.qtys&&q.qtys[selIdx]?q.qtys[selIdx]:{qty:0,ppu:0,total:0};

  if(typeof requestServerNumber !== 'function') { toast('Server unavailable — cannot generate SO number','err'); return; }
  var soId='so_'+Date.now();
  var soNum=await requestServerNumber('salesOrder', genSONUMLocal);

  var so={
    id:soId,
    soNum:soNum,
    quoteId:q.id,
    quoteNum:q.quoteNum,
    quoteRev:q.rev,
    status:'pending',

    // Client info
    company:f.custCo||'',
    contact:f.custAttn||'',
    email:f.custEmail||q.poClientEmail||'',
    phone:f.phone||'',
    industry:f.industry||'',
    cityState:f.cityState||'',
    shipTo:q.poShipTo||f.cityState||'',

    // PO info
    poNumber:q.poNumber||'',
    poSignature:q.poSignature||'',
    poSignedAt:q.poSignedAt||'',
    poInstructions:q.poInstructions||'',
    poFiles:q.poFiles||[],

    // Product specs
    jobDesc:(f.sA||'?')+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' - '+(f.colors||'?')+'C '+(f.jobType||'Flexo'),
    sizeA:f.sA||'',
    sizeB:f.sar||'',
    shapeType:f.shapeType||'',
    colors:f.colors||'',
    jobType:f.jobType||'',
    face:f.face||f.faceStock||'',
    laminate:f.laminate||f.lamination||'',
    coating:f.coating||'',
    windDir:f.windDir||f.copyPos||'',

    // Pricing
    selectedQtyIndex:selIdx,
    selectedQty:selRow.qty,
    ppu:selRow.ppu||0,
    total:selRow.total||0,
    allQtys:q.qtys||[],
    terms:q.terms||[],

    // Estimator
    estimator:f.estimator||'',
    payTerms:f.payTerms||'Net 30',

    // Meta
    createdAt:new Date().toISOString(),
    createdBy:getUserName(),
    updatedAt:new Date().toISOString(),
    updatedBy:getUserName(),
    approvedBy:null,
    approvedAt:null,
    sentAt:null,
    sentTo:null,
    driveLink:null,
    notes:[]
  };

  saveSO(so).then(function(){
    toast('Sales Order '+soNum+' created','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.created',soNum+' created from '+q.quoteNum);
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.created',{soId:soId,soNum:soNum,quoteNum:q.quoteNum,company:f.custCo});
    S_SO.view='sos';
    renderOrdersView();
  }).catch(function(e){toast('Error: '+e.message,'err')});
}

// ─── CEO Approve Sales Order ───
function approveSO(soId){
  var p=getMFXProfile();
  var allowedRoles=['ceo','admin','administrator','owner','operations manager'];
  var userRole=(p.role||'').toLowerCase();
  if(!allowedRoles.includes(userRole)){
    toast('Unauthorized — CEO or admin role required','err');return;
  }

  var so=getSO(soId);if(!so)return;
  so.status='approved';
  so.approvedBy='CEO';
  so.approvedAt=new Date().toISOString();
  so.notes=so.notes||[];
  so.notes.push({text:'✅ CEO Approved',by:'CEO',at:new Date().toISOString()});

  saveSO(so).then(function(){
    toast(so.soNum+' approved!','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.approved',so.soNum+' CEO approved');
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.approved',{soId:so.id,soNum:so.soNum,company:so.company});
    renderOrdersView();
  });
}

// ─── SO Detail View ───
function openSODetail(soId){
  var so=getSO(soId);if(!so)return;
  var h='<div class="modal-title">'+esc(so.soNum)+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:12px">From Quote: '+esc(so.quoteNum)+' Rev '+esc(so.quoteRev||'A')+' · PO# '+esc(so.poNumber)+'</div>';

  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:6px">CLIENT</div>';
  h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">'+esc(so.company)+'</div>';
  h+='<div style="font-size:11px;color:var(--tx2)">'+esc(so.contact)+' · '+esc(so.email)+'</div>';
  h+='<div style="font-size:11px;color:var(--tx3)">Ship to: '+esc(so.shipTo)+'</div>';
  h+='</div>';

  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:6px">ORDER</div>';
  h+='<div style="font-size:12px;color:var(--tx)">'+esc(so.jobDesc)+'</div>';
  h+='<div style="display:flex;gap:12px;margin-top:6px;font-size:11px;color:var(--tx2)">';
  h+='<span>Qty: '+Number(so.selectedQty).toLocaleString()+'</span>';
  h+='<span>PPU: $'+(so.ppu||0).toFixed(4)+'</span>';
  h+='<span style="font-weight:700;color:var(--ac)">Total: $'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})+'</span>';
  h+='</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">Terms: '+so.payTerms+'</div>';
  if(so.poInstructions)h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">Instructions: '+esc(so.poInstructions)+'</div>';
  h+='</div>';

  if(so.poFiles&&so.poFiles.length){
    h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:6px">FILES ('+so.poFiles.length+')</div>';
    so.poFiles.forEach(function(f){
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--bdr)">';
      h+='<span style="font-size:11px;color:var(--tx)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> '+esc(f.name)+'</span>';
      h+='<a href="'+f.url+'" target="_blank" style="font-size:10px;color:var(--ac)">View</a></div>';
    });
    h+='</div>';
  }

  // Notes/timeline
  if(so.notes&&so.notes.length){
    h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:6px">TIMELINE</div>';
    so.notes.forEach(function(n){
      h+='<div style="font-size:10px;padding:3px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--tx3)">'+fD(n.at)+'</span> · <span style="color:var(--tx)">'+esc(n.text)+'</span> <span style="color:var(--tx3)">by '+esc(n.by)+'</span></div>';
    });
    h+='</div>';
  }

  h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if(so.status==='pending')h+='<div class="compliance-boundary"></div><button class="btn btn-approve" onclick="closeModal();approveSO(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> CEO Approve</button>';
  if(so.status==='approved')h+='<button class="btn btn-pr" onclick="closeModal();sendSOToClient(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Send to Client & Save to Drive</button>';
  if(so.driveLink)h+='<a href="'+so.driveLink+'" target="_blank" class="btn btn-ghost"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> View on Drive</a>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
  h+='</div>';

  openModal(h);
}

// ─── Send SO to Client + Save PDF to Drive ───
function sendSOToClient(soId){
  var so=getSO(soId);if(!so)return;
  toast('Generating & sending Sales Order...','ok');

  // Generate SO HTML for email
  var soHTML=buildSOEmailHTML(so);

  getGoogleToken().then(function(token){
    if(!token)return toast('Sign out & back in for Google access','err');

    // 1. Send email to client
    var subj='Microflex Sales Order '+so.soNum+' — '+so.company;
    var raw='Content-Type: text/html; charset=utf-8\r\nFrom: MFX OS <info@microflexfilm.com>\r\nTo: '+so.email+'\r\nSubject: '+subj+'\r\nMIME-Version: 1.0\r\n\r\n'+soHTML;
    var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

    fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({raw:encoded})
    }).then(function(r){return r.json()}).then(function(data){
      if(!data.id){toast('Email error','err');return}

      // 2. Save to Drive — find/create client folder
      findOrCreateClientFolder(token,so.company,so.quoteNum).then(function(folderId){
        if(!folderId){
          finalizeSO(so,null);
          return;
        }
        // Create a Google Doc with SO content
        var docName=so.soNum+'_'+so.company.replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/\s/g,'-');
        var metadata={name:docName,mimeType:'text/html',parents:[folderId]};
        var form=new FormData();
        form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
        form.append('file',new Blob([soHTML],{type:'text/html'}));

        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{
          method:'POST',headers:{'Authorization':'Bearer '+token},body:form
        }).then(function(r){return r.json()}).then(function(fileData){
          var link=fileData.id?'https://drive.google.com/file/d/'+fileData.id+'/view':null;
          finalizeSO(so,link);
        }).catch(function(e){console.warn('soPassportCreate',e);finalizeSO(so,null)});
      }).catch(function(e){console.warn('soPassportCreate',e);finalizeSO(so,null)});
    }).catch(function(e){toast('Email error: '+e.message,'err')});
  });
}

function finalizeSO(so,driveLink){
  so.status='sent';
  so.sentAt=new Date().toISOString();
  so.sentTo=so.email;
  if(driveLink)so.driveLink=driveLink;
  so.notes=so.notes||[];
  so.notes.push({text:'✉ Sent to '+so.email+(driveLink?' · Saved to Drive':''),by:getUserName(),at:new Date().toISOString()});

  saveSO(so).then(function(){
    toast(so.soNum+' sent to '+so.email+'!','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.sent',so.soNum+' sent to '+so.email);
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.sent',{soId:so.id,soNum:so.soNum,company:so.company,email:so.email});
    renderOrdersView();
  });
}

// ─── Find or create client folder in MFX-CORE shared drive ───
function findOrCreateClientFolder(token,company,quoteNum){
  var cleanCo=company.replace(/[^a-zA-Z0-9 ]/g,'').trim();
  return fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50',{
    headers:{'Authorization':'Bearer '+token}
  }).then(function(r){return r.json()}).then(function(drives){
    var mfxDrive=null;
    if(drives.drives){drives.drives.forEach(function(d){if(d.name==='MFX-CORE')mfxDrive=d.id})}
    if(!mfxDrive)return null;

    // Find or create Clients folder
    var q1='name=\'Clients\' and mimeType=\'application/vnd.google-apps.folder\' and \''+mfxDrive+'\' in parents and trashed=false';
    return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q1)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
      headers:{'Authorization':'Bearer '+token}
    }).then(function(r){return r.json()}).then(function(data){
      var clientsFolder=(data.files&&data.files.length)?data.files[0].id:null;
      if(!clientsFolder){
        // Create Clients folder
        return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
          method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
          body:JSON.stringify({name:'Clients',mimeType:'application/vnd.google-apps.folder',parents:[mfxDrive]})
        }).then(function(r){return r.json()}).then(function(f){return f.id||null});
      }
      return clientsFolder;
    }).then(function(clientsFolderId){
      if(!clientsFolderId)return null;
      // Find or create company folder
      var q2='name=\''+cleanCo+'\' and mimeType=\'application/vnd.google-apps.folder\' and \''+clientsFolderId+'\' in parents and trashed=false';
      return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q2)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
        headers:{'Authorization':'Bearer '+token}
      }).then(function(r){return r.json()}).then(function(data2){
        var companyFolder=(data2.files&&data2.files.length)?data2.files[0].id:null;
        if(!companyFolder){
          return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
            method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
            body:JSON.stringify({name:cleanCo,mimeType:'application/vnd.google-apps.folder',parents:[clientsFolderId]})
          }).then(function(r){return r.json()}).then(function(f){return f.id||null});
        }
        return companyFolder;
      }).then(function(companyFolderId){
        if(!companyFolderId)return null;
        // Find or create quote folder
        var q3='name=\''+quoteNum+'\' and mimeType=\'application/vnd.google-apps.folder\' and \''+companyFolderId+'\' in parents and trashed=false';
        return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q3)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
          headers:{'Authorization':'Bearer '+token}
        }).then(function(r){return r.json()}).then(function(data3){
          var quoteFolder=(data3.files&&data3.files.length)?data3.files[0].id:null;
          if(!quoteFolder){
            return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
              method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
              body:JSON.stringify({name:quoteNum,mimeType:'application/vnd.google-apps.folder',parents:[companyFolderId]})
            }).then(function(r){return r.json()}).then(function(f){return f.id||null});
          }
          return quoteFolder;
        });
      });
    });
  }).catch(function(e){console.error('Drive folder error:',e);return null});
}

// ─── Build SO Email HTML ───
function buildSOEmailHTML(so){
  var rows='';
  if(so.allQtys&&so.allQtys.length){
    so.allQtys.forEach(function(r,i){
      var sel=i===so.selectedQtyIndex;
      rows+='<tr style="'+(sel?'background:#0a2e3e':'')+'"><td style="padding:8px 14px;font-size:12px;color:'+(sel?'#00e5ff':'#94a3b8')+';border-bottom:1px solid #1a2d40">'+(sel?'→ ':'')+Number(r.qty).toLocaleString()+'</td><td style="padding:8px 14px;font-size:12px;color:#94a3b8;text-align:right;border-bottom:1px solid #1a2d40">$'+(r.ppu||0).toFixed(4)+'</td><td style="padding:8px 14px;font-size:12px;color:'+(sel?'#e0f2fe':'#94a3b8')+';font-weight:'+(sel?'700':'400')+';text-align:right;border-bottom:1px solid #1a2d40">$'+Number(r.total||0).toLocaleString(undefined,{minimumFractionDigits:2})+'</td></tr>';
    });
  }

  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'
    +'<tr><td style="height:3px;background:#00e5ff;font-size:0">&nbsp;</td></tr>'
    +'<tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:24px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:70px;height:2px;background:#00e5ff;margin:4px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'
    +'<tr><td style="padding:5px 24px;background:#0a2e3e;text-align:center;font-size:7px;color:#00e5ff;letter-spacing:1px;border-bottom:1px solid #0f1d2b">SALES ORDER CONFIRMATION</td></tr>'
    +'<tr><td style="padding:20px 24px"><div style="font-size:20px;font-weight:900;color:#e0f2fe">'+so.soNum+'</div><div style="font-size:11px;color:#64748b;margin-top:4px">Quote: '+so.quoteNum+' · PO# '+so.poNumber+'</div></td></tr>'
    +'<tr><td style="padding:0 24px 16px"><table width="100%" style="border:1px solid #1a2d40;border-radius:6px;border-collapse:collapse"><tr><td style="padding:12px 14px;background:#0a1a28;border-bottom:1px solid #1a2d40" colspan="3"><div style="font-size:8px;color:#00e5ff;letter-spacing:2px">ORDER DETAILS</div></td></tr><tr><td style="padding:8px 14px;font-size:11px;color:#64748b;border-bottom:1px solid #1a2d40" colspan="3">'+so.jobDesc+'</td></tr>'+rows+'<tr style="background:#0a2e3e"><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#e0f2fe" colspan="2">Selected Total</td><td style="padding:10px 14px;font-size:14px;font-weight:900;color:#00e5ff;text-align:right">$'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})+'</td></tr></table></td></tr>'
    +'<tr><td style="padding:0 24px 16px"><table width="100%" style="font-size:11px;color:#64748b"><tr><td>Ship To: <b style="color:#e0f2fe">'+so.shipTo+'</b></td></tr><tr><td>Terms: <b style="color:#e0f2fe">'+so.payTerms+'</b></td></tr>'+(so.poInstructions?'<tr><td>Instructions: '+so.poInstructions+'</td></tr>':'')+'</table></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://mfx-2026.web.app/portal?q='+so.quoteNum+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#00e5ff;color:#060d14">View in Client Portal</a></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com · SQF Certified | Made in USA</td></tr></table>';
}

// ═══════════════════════════════════════
// AUTO-CREATE SO WHEN QUOTE IS WON
// ═══════════════════════════════════════
function initAutoSOCreation(){
  if(typeof MFX==='undefined'||typeof MFX.on!=='function')return;

  MFX.on('quote.status',function(d){
    if(!d||d.status!=='won')return;
    var q=d.quote;if(!q)return;

    // Only auto-create if PO exists and SO doesn't already exist
    if(!q.poNumber){console.log('SO auto-create skipped: no PO on '+q.quoteNum);return}
    var existing=_soCache.find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});
    if(existing){console.log('SO already exists for '+q.quoteNum+': '+existing.soNum);return}

    console.log('Auto-creating Sales Order for '+q.quoteNum+'...');
    autoCreateSO(q);
  });
}

async function autoCreateSO(q){
  var f=q.fields||{};
  if(!f.custCo||!f.custCo.trim())return;
  var selIdx=q.poQtyIndex||0;
  var selRow=q.qtys&&q.qtys[selIdx]?q.qtys[selIdx]:{qty:0,ppu:0,total:0};

  var soId='so_'+Date.now();
  var soNum;
  try{soNum=await genSONUM()}catch(e){soNum=genSONUMLocal()}

  var so={
    id:soId,
    soNum:soNum,
    quoteId:q.id,
    quoteNum:q.quoteNum,
    quoteRev:q.rev,
    status:'pending',

    company:f.custCo||'',
    contact:f.custAttn||'',
    email:f.custEmail||q.poClientEmail||'',
    phone:f.phone||'',
    industry:f.industry||'',
    cityState:f.cityState||'',
    shipTo:q.poShipTo||f.cityState||'',

    poNumber:q.poNumber||'',
    poSignature:q.poSignature||'',
    poSignedAt:q.poSignedAt||'',
    poInstructions:q.poInstructions||'',
    poFiles:q.poFiles||[],

    jobDesc:(f.sA||'?')+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' - '+(f.colors||'?')+'C '+(f.jobType||'Flexo'),
    sizeA:f.sA||'',
    sizeB:f.sar||'',
    shapeType:f.shapeType||'',
    colors:f.colors||'',
    jobType:f.jobType||'',
    face:f.face||f.faceStock||'',
    laminate:f.laminate||f.lamination||'',
    coating:f.coating||'',
    windDir:f.windDir||f.copyPos||'',

    selectedQtyIndex:selIdx,
    selectedQty:selRow.qty,
    ppu:selRow.ppu||0,
    total:selRow.total||0,
    allQtys:q.qtys||[],
    terms:q.terms||[],

    estimator:f.estimator||'',
    payTerms:f.payTerms||'Net 30',

    createdAt:new Date().toISOString(),
    createdBy:'System (Auto)',
    updatedAt:new Date().toISOString(),
    updatedBy:'System (Auto)',
    approvedBy:null,
    approvedAt:null,
    sentAt:null,
    sentTo:null,
    driveLink:null,
    notes:[{text:'📋 Auto-created from '+q.quoteNum+' (Won with PO# '+q.poNumber+')',by:'System',at:new Date().toISOString()}]
  };

  saveSO(so).then(function(){
    toast('Sales Order '+soNum+' auto-created — pending CEO approval','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.auto_created',soNum+' auto-created from '+q.quoteNum);
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.auto_created',{soId:soId,soNum:soNum,quoteNum:q.quoteNum,company:f.custCo});
    if(typeof MFX!=='undefined'&&MFX.emit)MFX.emit('so.pending_approval',{so:so,quote:q});

    // Notify CEO via notification system
    if(typeof addNotification==='function'){
      addNotification({
        type:'alert',
        title:'Sales Order Needs Approval',
        body:soNum+' for '+esc(f.custCo)+' ($'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})+') — auto-created from '+q.quoteNum,
        sourceView:'orders',
        sourceId:soId,
        priority:'high'
      });
    }

    S_SO.view='sos';
    if(typeof renderOrdersView==='function')renderOrdersView();
  }).catch(function(e){toast('Auto SO error: '+e.message,'err')});
}

// ═══════════════════════════════════════
// SO PDF GENERATION (matches quote design)
// ═══════════════════════════════════════
function generateSOPDF(so){
  return new Promise(function(resolve,reject){
    var container=document.createElement('div');
    container.style.cssText='position:fixed;top:-9999px;left:-9999px;width:800px;background:#fff;padding:30px;color:#000;font-family:Arial,sans-serif';
    container.innerHTML=buildSOPrintHTML(so);
    document.body.appendChild(container);

    if(typeof html2canvas!=='function'){reject('html2canvas not loaded');return}
    html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then(function(canvas){
      document.body.removeChild(container);
      var imgData=canvas.toDataURL('image/jpeg',0.95);
      var pdf=new jspdf.jsPDF('p','mm','letter');
      var pdfW=pdf.internal.pageSize.getWidth();
      var imgW=pdfW-20;var imgH=(canvas.height*imgW)/canvas.width;
      pdf.addImage(imgData,'JPEG',10,10,imgW,imgH);
      var filename=so.soNum+'_'+so.company.replace(/[^a-zA-Z0-9]/g,'-')+'.pdf';
      var pdfBlob=pdf.output('blob');var pdfBase64=pdf.output('datauristring').split(',')[1];
      resolve({blob:pdfBlob,base64:pdfBase64,filename:filename});
    }).catch(function(e){document.body.removeChild(container);reject(e)});
  });
}

function buildSOPrintHTML(so){
  var rows='';
  if(so.allQtys&&so.allQtys.length){
    so.allQtys.forEach(function(r,i){
      var sel=i===so.selectedQtyIndex;
      rows+='<tr style="'+(sel?'background:#e0f7fa':'')+'">'
        +'<td style="padding:8px 14px;font-size:12px;border-bottom:1px solid #e0e0e0">'+(sel?'→ ':'')+Number(r.qty).toLocaleString()+'</td>'
        +'<td style="padding:8px 14px;font-size:12px;text-align:right;border-bottom:1px solid #e0e0e0">$'+(r.ppu||0).toFixed(4)+'</td>'
        +'<td style="padding:8px 14px;font-size:12px;font-weight:'+(sel?'700':'400')+';text-align:right;border-bottom:1px solid #e0e0e0">$'+Number(r.total||0).toLocaleString(undefined,{minimumFractionDigits:2})+'</td></tr>';
    });
  }

  return '<div style="max-width:760px;margin:0 auto;font-family:Arial,sans-serif">'
    // Header
    +'<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #00bcd4;padding-bottom:16px;margin-bottom:20px">'
    +'<div><div style="font-size:28px;font-weight:900;color:#0a1929">Microflex</div><div style="font-size:8px;color:#00838f;letter-spacing:4px;text-transform:uppercase">Film Corporation</div></div>'
    +'<div style="text-align:right"><div style="font-size:9px;color:#00838f;letter-spacing:2px;font-weight:700">SALES ORDER CONFIRMATION</div>'
    +'<div style="font-size:22px;font-weight:900;color:#0a1929;margin-top:4px">'+esc(so.soNum)+'</div>'
    +'<div style="font-size:10px;color:#666">Date: '+new Date(so.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'</div></div></div>'

    // Reference
    +'<div style="display:flex;gap:20px;margin-bottom:20px">'
    +'<div style="flex:1;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:12px">'
    +'<div style="font-size:8px;color:#00838f;letter-spacing:2px;font-weight:700;margin-bottom:6px">REFERENCE</div>'
    +'<div style="font-size:11px;color:#333"><div>Quote: <strong>'+esc(so.quoteNum)+' Rev '+(so.quoteRev||'A')+'</strong></div>'
    +'<div>PO#: <strong>'+esc(so.poNumber)+'</strong></div>'
    +'<div>Estimator: '+esc(so.estimator)+'</div>'
    +'<div>Terms: '+esc(so.payTerms)+'</div></div></div>'

    // Client
    +'<div style="flex:1;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:12px">'
    +'<div style="font-size:8px;color:#00838f;letter-spacing:2px;font-weight:700;margin-bottom:6px">CLIENT</div>'
    +'<div style="font-size:13px;font-weight:700;color:#0a1929">'+esc(so.company)+'</div>'
    +'<div style="font-size:11px;color:#333">'+esc(so.contact)+'</div>'
    +'<div style="font-size:11px;color:#333">'+esc(so.email)+'</div>'
    +'<div style="font-size:11px;color:#666;margin-top:4px">Ship to: '+esc(so.shipTo)+'</div></div></div>'

    // Product specs
    +'<div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:20px">'
    +'<div style="font-size:8px;color:#00838f;letter-spacing:2px;font-weight:700;margin-bottom:6px">PRODUCT SPECIFICATIONS</div>'
    +'<div style="font-size:12px;color:#333;font-weight:600">'+esc(so.jobDesc)+'</div>'
    +'<div style="display:flex;gap:20px;margin-top:6px;font-size:11px;color:#555">'
    +'<span>Size: '+esc(so.sizeA)+'x'+esc(so.sizeB)+'"</span>'
    +'<span>Shape: '+esc(so.shapeType)+'</span>'
    +'<span>Colors: '+esc(String(so.colors))+'</span>'
    +(so.face?'<span>Face: '+esc(so.face)+'</span>':'')
    +(so.laminate?'<span>Laminate: '+esc(so.laminate)+'</span>':'')
    +'</div></div>'

    // Pricing table
    +'<table style="width:100%;border:1px solid #e0e0e0;border-radius:6px;border-collapse:collapse;margin-bottom:20px">'
    +'<tr style="background:#0a1929"><th style="padding:10px 14px;font-size:9px;color:#00bcd4;letter-spacing:2px;text-align:left">QTY</th><th style="padding:10px 14px;font-size:9px;color:#00bcd4;letter-spacing:2px;text-align:right">PRICE/UNIT</th><th style="padding:10px 14px;font-size:9px;color:#00bcd4;letter-spacing:2px;text-align:right">TOTAL</th></tr>'
    +rows
    +'<tr style="background:#0a1929"><td style="padding:12px 14px;font-size:13px;font-weight:700;color:#fff" colspan="2">Selected Total</td><td style="padding:12px 14px;font-size:16px;font-weight:900;color:#00bcd4;text-align:right">$'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})+'</td></tr></table>'

    // Instructions
    +(so.poInstructions?'<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:12px;margin-bottom:20px"><div style="font-size:8px;color:#f57f17;letter-spacing:2px;font-weight:700;margin-bottom:4px">SPECIAL INSTRUCTIONS</div><div style="font-size:11px;color:#333">'+esc(so.poInstructions)+'</div></div>':'')

    // Approval
    +(so.approvedBy?'<div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:12px;margin-bottom:20px;text-align:center"><div style="font-size:10px;font-weight:700;color:#2e7d32">✅ APPROVED BY '+esc(so.approvedBy).toUpperCase()+' — '+new Date(so.approvedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'</div></div>':'')

    // Footer
    +'<div style="border-top:2px solid #e0e0e0;padding-top:12px;text-align:center;font-size:9px;color:#999">'
    +'Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501 · (909) 360-9066 · Quotes@MicroflexFilm.com<br>SQF Certified | Made in USA</div></div>';
}

// ═══════════════════════════════════════
// AUTO-SAVE PDF TO DRIVE ON CEO APPROVAL
// ═══════════════════════════════════════
function approveSOwithDrive(soId){
  var p=getMFXProfile();
  var allowedRoles=['ceo','admin','administrator','owner','operations manager'];
  var userRole=(p.role||'').toLowerCase();
  if(!allowedRoles.includes(userRole)){
    toast('Unauthorized — CEO or admin role required','err');return;
  }

  var so=getSO(soId);if(!so)return;

  // Update status first
  so.status='approved';
  so.approvedBy=getUserName();
  so.approvedAt=new Date().toISOString();
  so.notes=so.notes||[];
  so.notes.push({text:'✅ CEO Approved by '+getUserName(),by:getUserName(),at:new Date().toISOString()});

  saveSO(so).then(function(){
    toast(so.soNum+' approved! Generating PDF...','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.approved',so.soNum+' CEO approved by '+getUserName());
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.approved',{soId:so.id,soNum:so.soNum,company:so.company});
    renderOrdersView();

    // Auto-generate PDF and save to Drive
    generateSOPDF(so).then(function(pdf){
      getGoogleToken().then(function(token){
        if(!token){toast('Sign in for Google Drive access','err');return}
        findOrCreateClientFolder(token,so.company,so.quoteNum).then(function(folderId){
          if(!folderId){toast('Drive folder not found','err');return}
          var metadata={name:pdf.filename,mimeType:'application/pdf',parents:[folderId]};
          var form=new FormData();
          form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
          form.append('file',pdf.blob);
          fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{
            method:'POST',headers:{'Authorization':'Bearer '+token},body:form
          }).then(function(r){return r.json()}).then(function(fileData){
            if(fileData.id){
              so.driveLink='https://drive.google.com/file/d/'+fileData.id+'/view';
              so.notes.push({text:'☁ PDF saved to Drive: '+pdf.filename,by:'System',at:new Date().toISOString()});
              saveSO(so).then(function(){
                toast('SO PDF saved to Drive!','ok');
                renderOrdersView();
              });
            }
          }).catch(function(e){toast('Drive upload error: '+e.message,'err')});
        });
      });
    }).catch(function(e){console.warn('SO PDF gen error:',e)});
  });
}

// ─── Expose globals ───
window.S_SO=S_SO;
window.renderOrdersView=renderOrdersView;
window.createSOFromPO=createSOFromPO;
window.approveSO=approveSOwithDrive;
window.openSODetail=openSODetail;
window.sendSOToClient=sendSOToClient;
window.getSalesOrders=getSalesOrders;
window.getSO=getSO;
window.getPOs=getPOs;
window.saveSO=saveSO;
window.startSOListeners=startSOListeners;
window.generateSOPDF=generateSOPDF;
window.fD=fD;

// ─── Init on load ───
if(typeof fbDb!=='undefined'){
  setTimeout(startSOListeners,1000);
}
setTimeout(initAutoSOCreation,1500);

})();
