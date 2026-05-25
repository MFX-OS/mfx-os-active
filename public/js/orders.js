// ══════════════════════════════════════════════════════════════════
// MFX OS — Phase 2: PO Library & Sales Orders
// ══════════════════════════════════════════════════════════════════

(function(){'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ─── Utility: format date (used throughout) ───
function fD(d){if(!d)return'---';var dt=d.toDate?d.toDate():new Date(d);return isNaN(dt)?String(d):dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});}

var _soCache=[];var _soReady=false;
var S_SO={view:'pipeline',soEditId:null,soFilter:'all',soSearch:''};

// ─── Firestore Listeners ───
function startSOListeners(){
  if(typeof fbDb==='undefined')return;
  var unsub=fbDb.collection('salesOrders').orderBy('createdAt','desc').onSnapshot(function(s){
    _soCache=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
    _soReady=true;
    if(typeof S!=='undefined'&&S.view==='orders')renderOrdersView();
  },function(err){console.warn('salesOrders listener error:',err.message)});
  if(typeof mfxRegisterListener==='function')mfxRegisterListener('salesOrders',unsub);
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

// ─── Main Orders View (subtabs: Pipeline | POs | Sales Orders) ───
function renderOrdersView(){
  var el=$('v-orders');if(!el)return;
  var qs=typeof DB!=='undefined'&&DB.quotes?DB.quotes():[];
  var sentQs=qs.filter(function(q){return q.status==='sent'||q.status==='won'||q.status==='ready'});
  var pos=getPOs();var sos=getSalesOrders();
  var pendingSOs=sos.filter(function(s){return s.status==='pending'});
  var approvedSOs=sos.filter(function(s){return s.status==='approved'||s.status==='sent'});

  // ── KPI bar ──
  var h='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#38bdf8">'+sentQs.length+'</div><div style="font-size:8px;color:var(--tx3);letter-spacing:1px">SENT</div></div>';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#2ee89e">'+pos.length+'</div><div style="font-size:8px;color:var(--tx3);letter-spacing:1px">POs IN</div></div>';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#fb923c">'+pendingSOs.length+'</div><div style="font-size:8px;color:var(--tx3);letter-spacing:1px">PENDING</div></div>';
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#6ee7a0">'+approvedSOs.length+'</div><div style="font-size:8px;color:var(--tx3);letter-spacing:1px">APPROVED</div></div>';
  var totalRev=0;sos.forEach(function(s){totalRev+=(Number(s.total)||0)});
  h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#00e5ff">$'+Math.round(totalRev/1000)+'K</div><div style="font-size:8px;color:var(--tx3);letter-spacing:1px">REVENUE</div></div>';
  h+='</div>';

  // ── Tabs ──
  var tabs=[
    {key:'pipeline',label:'Quote Pipeline',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',count:sentQs.length},
    {key:'pos',label:'Purchase Orders',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',count:pos.length},
    {key:'sos',label:'Sales Orders',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',count:sos.length,badge:pendingSOs.length}
  ];
  h+='<div style="display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--bdr);overflow-x:auto">';
  tabs.forEach(function(t){
    var sel=S_SO.view===t.key;
    h+='<div style="padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(sel?'var(--ac)':'transparent')+';color:'+(sel?'var(--ac)':'var(--tx3)')+'" onclick="S_SO.view=\''+t.key+'\';renderOrdersView()">'+t.icon+' '+t.label+' <span style="background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px">'+t.count+'</span>'+(t.badge?'<span style="background:var(--or);color:#000;padding:1px 5px;border-radius:8px;font-size:9px;margin-left:4px">'+t.badge+'</span>':'')+'</div>';
  });
  h+='</div>';

  if(S_SO.view==='pipeline')h+=renderQuotePipeline(sentQs,sos);
  else if(S_SO.view==='pos')h+=renderPOList(pos);
  else h+=renderSOList(sos,pendingSOs,approvedSOs);

  el.innerHTML=h;
}

// ─── Quote Pipeline — sent quotes with portal links, PO/art status ───
function renderQuotePipeline(sentQs,sos){
  var h='<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Quotes sent to clients — track PO submissions and artwork</div>';
  if(!sentQs.length)return h+'<div class="empty-state"><div class="ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg></div><p>No quotes sent yet</p></div>';

  // Sort: newest first
  sentQs.sort(function(a,b){return (b.updatedAt||'').localeCompare(a.updatedAt||'')});

  sentQs.forEach(function(q){
    var f=q.fields||{};
    var so=sos.find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});
    var hasPO=!!q.poNumber;
    var hasArt=(q.artFiles&&q.artFiles.length>0)||(q.poFiles&&q.poFiles.length>0);
    var portalLink='https://os.microflexfilm.com/portal?q='+(q.quoteNum||q.id);

    // Status colors
    var statusColor=q.status==='won'?'#2ee89e':q.status==='sent'?'#38bdf8':'#fb923c';
    var statusLabel=q.status==='won'?'WON':q.status==='sent'?'SENT':'READY';

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+statusColor+';border-radius:0 8px 8px 0;padding:14px;margin-bottom:8px">';

    // Row 1: Quote info + status
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h+='<div><span style="font-size:14px;font-weight:800;color:var(--tx)">'+esc(q.quoteNum)+'</span><span style="font-size:10px;color:var(--tx3);margin-left:6px">Rev '+esc(q.rev||'A')+'</span></div>';
    h+='<span style="font-size:9px;font-weight:700;color:'+statusColor+';background:rgba(255,255,255,.05);padding:2px 8px;border-radius:4px;border:1px solid '+statusColor+'">'+statusLabel+'</span></div>';

    // Row 2: Company + contact
    h+='<div style="font-size:13px;font-weight:600;color:var(--tx)">'+esc(f.custCo||'—')+'</div>';
    h+='<div style="font-size:10px;color:var(--tx3)">'+esc(f.custAttn||'')+' · '+esc(f.custEmail||'')+'</div>';

    // Row 3: Job desc
    h+='<div style="font-size:11px;color:var(--tx2);margin-top:4px">'+esc(f.jobDesc||(f.sA?f.sA+'x'+(f.sar||'?')+'" '+esc(f.shapeType||''):'—'))+'</div>';

    // Row 4: Status indicators
    h+='<div style="display:flex;gap:16px;margin-top:8px;font-size:10px;flex-wrap:wrap">';
    // Portal link
    h+='<a href="'+portalLink+'" target="_blank" style="display:flex;align-items:center;gap:4px;color:#38bdf8;text-decoration:none;font-weight:600" title="Open client portal"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Portal</a>';
    // PO status
    h+='<span style="display:flex;align-items:center;gap:4px;color:'+(hasPO?'#2ee89e':'#64748b')+'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+(hasPO?'<polyline points="20 6 9 17 4 12"/>':'<circle cx="12" cy="12" r="10"/>')+'</svg> PO '+(hasPO?'#'+esc(q.poNumber):'Waiting')+'</span>';
    // Artwork status
    h+='<span style="display:flex;align-items:center;gap:4px;color:'+(hasArt?'#2ee89e':'#64748b')+'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+(hasArt?'<polyline points="20 6 9 17 4 12"/>':'<circle cx="12" cy="12" r="10"/>')+'</svg> Artwork '+(hasArt?'Received':'Pending')+'</span>';
    // SO status
    if(so){
      var soColor=so.status==='pending'?'#fb923c':so.status==='approved'?'#2ee89e':so.status==='sent'?'#38bdf8':'#64748b';
      h+='<span style="display:flex;align-items:center;gap:4px;color:'+soColor+';font-weight:600;cursor:pointer" onclick="S_SO.view=\'sos\';renderOrdersView()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> '+esc(so.soNum)+' ('+so.status+')</span>';
    }
    h+='</div>';

    // Row 5: Action buttons
    h+='<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
    if(q.status==='won'&&hasPO&&!so){
      h+='<button class="btn btn-pr btn-xs" onclick="event.stopPropagation();createSOFromPO(\''+q.id+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Create Sales Order</button>';
    }
    if(so&&so.status==='pending'){
      h+='<button class="btn btn-approve btn-xs" onclick="event.stopPropagation();approveSO(\''+so.id+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve SO</button>';
    }
    if(so&&so.status==='approved'){
      h+='<button class="btn btn-pr btn-xs" onclick="event.stopPropagation();sendSOToClient(\''+so.id+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Send SO</button>';
    }
    h+='<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openPortalMessages(\''+q.id+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Messages</button>';
    h+='<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openEditor(\''+q.id+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Quote</button>';
    if(so){
      h+='<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openSODetail(\''+so.id+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> SO Detail</button>';
    }
    h+='</div>';

    h+='</div>';
  });
  return h;
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

  // Resolve pricing from qtys (handles both number arrays and object arrays)
  var selIdx=q.poQtyIndex||0;
  var rawRow=q.qtys&&q.qtys[selIdx]?q.qtys[selIdx]:null;
  var selQty=0, selPPU=0, selTotal=0;
  if(rawRow!==null){
    if(typeof rawRow==='object'&&rawRow.qty){selQty=rawRow.qty;selPPU=rawRow.ppu||0;selTotal=rawRow.total||0}
    else if(typeof rawRow==='number'){selQty=rawRow;
      // Try to get pricing from calculated matrix if available
      if(q.pricingMatrix&&q.pricingMatrix[selIdx]){selPPU=q.pricingMatrix[selIdx].ppu||0;selTotal=q.pricingMatrix[selIdx].total||0}
      else if(q.calculatedPrices&&q.calculatedPrices[selIdx]){selPPU=q.calculatedPrices[selIdx].ppu||0;selTotal=q.calculatedPrices[selIdx].total||0}
    }
  }
  // Fallback: use poQty/poTotal if available from portal submission
  if(!selQty&&q.poQty)selQty=q.poQty;
  if(!selTotal&&q.poTotal)selTotal=q.poTotal;
  if(selQty&&selTotal&&!selPPU)selPPU=selTotal/selQty;

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
    shipTo:q.poShipTo||f.shipTo||f.cityState||'',

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
    faceStock:f.faceStock||f.face||'',
    lamination:f.lamination||f.laminate||'',
    coating:f.coating||'',
    windDir:f.windDir||f.copyPos||'',
    labRoll:f.labRoll||'',
    coreDia:f.coreDia||'',
    adhesive:f.adhesive||'',
    liner:f.liner||'',
    description:q.description||'',

    // Pricing
    selectedQtyIndex:selIdx,
    selectedQty:selQty,
    ppu:selPPU,
    total:selTotal,
    allQtys:q.qtys||[],
    terms:q.terms||[],

    // Estimator & sales
    estimator:f.estimator||'',
    salesRep:f.salesRep||'',
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

  // Add to local cache immediately so openSODetail can find it
  _soCache.unshift(so);

  saveSO(so).then(function(){
    toast('Sales Order '+soNum+' created!','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.created',soNum+' created from '+q.quoteNum);
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.created',{soId:soId,soNum:soNum,quoteNum:q.quoteNum,company:f.custCo});
    // Show the SO detail immediately
    openSODetail(soId);
    // Re-render workflow tab if in editor
    if(typeof S!=='undefined'&&S.view==='editor'&&S.etab===13&&typeof renderWorkflow==='function')setTimeout(renderWorkflow,200);
    if(typeof renderEditor==='function'&&typeof S!=='undefined'&&S.view==='editor')setTimeout(renderEditor,300);
  }).catch(function(e){toast('Error creating SO: '+e.message,'err')});
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
  var totalStr=so.total?(' for $'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})):'';
  if(!confirm('Approve Sales Order '+so.soNum+totalStr+'?\n\nClient: '+(so.company||'?')+'\nPO#: '+(so.poNumber||'—')+'\n\nApproved SOs become eligible to send. This action is logged with your name.'))return;

  so.status='approved';
  so.approvedBy=getUserName();
  so.approvedAt=new Date().toISOString();
  so.notes=so.notes||[];
  so.notes.push({text:'✅ Approved by '+getUserName(),by:getUserName(),at:new Date().toISOString()});

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

  // Action buttons
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  // Preview & Download PDF — always available
  h+='<button class="btn btn-ghost" onclick="previewSOPDF(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview PDF</button>';
  h+='<button class="btn btn-ghost" onclick="downloadSOPDF(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF</button>';
  if(so.status==='pending')h+='<div class="compliance-boundary"></div><button class="btn btn-approve" onclick="closeModal();approveSO(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> CEO Approve</button>';
  if(so.status==='approved')h+='<button class="btn btn-pr" onclick="closeModal();openSOSendFlow(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Send to Client</button>';
  if(so.driveLink)h+='<a href="'+so.driveLink+'" target="_blank" class="btn btn-ghost"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> View on Drive</a>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
  h+='</div>';

  openModal(h);
}

// ─── Preview SO PDF in modal ───
function previewSOPDF(soId){
  var so=getSO(soId);if(!so)return;
  toast('Generating PDF preview...','ok');
  generateSOPDF(so).then(function(pdf){
    var url=URL.createObjectURL(pdf.blob);
    var h='<div class="modal-title">PDF Preview — '+esc(so.soNum)+'</div>';
    h+='<div style="margin-bottom:10px;font-size:11px;color:var(--tx3)">'+esc(pdf.filename)+'</div>';
    h+='<iframe src="'+url+'" style="width:100%;height:500px;border:1px solid var(--bdr);border-radius:8px;background:#fff"></iframe>';
    h+='<div style="display:flex;gap:6px;margin-top:12px">';
    h+='<a href="'+url+'" download="'+esc(pdf.filename)+'" class="btn btn-pr">Download PDF</a>';
    h+='<button class="btn btn-ghost" onclick="closeModal()">Close</button></div>';
    openModal(h);
  }).catch(function(e){toast('PDF generation error: '+e.message,'err')});
}

// ─── Download SO PDF directly ───
function downloadSOPDF(soId){
  var so=getSO(soId);if(!so)return;
  toast('Generating PDF...','ok');
  generateSOPDF(so).then(function(pdf){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(pdf.blob);
    a.download=pdf.filename;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    toast('PDF downloaded: '+pdf.filename,'ok');
  }).catch(function(e){toast('PDF generation error: '+e.message,'err')});
}

// ─── SO Send Flow — document preview + editable email template + send ───
function openSOSendFlow(soId){
  var so=getSO(soId);if(!so)return;
  // Ensure latest overrides loaded
  loadSOTemplateOverrides().finally(function(){_renderSOSendFlow(so)});
}

function _renderSOSendFlow(so){
  var h='<div class="modal-title">Send Sales Order — '+esc(so.soNum)+'</div>';
  h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:14px">'+esc(so.company)+' · '+esc(so.email)+' · '+esc(so.jobDesc)+'</div>';

  // Step toggle (Document → PDF → Email)
  h+='<div style="display:flex;gap:0;margin-bottom:12px;border:1px solid var(--bdr);border-radius:8px;overflow:hidden">';
  h+='<button id="soStepDoc" onclick="soSendStep(\'doc\')" style="flex:1;padding:8px;font-size:10px;font-weight:700;border:none;cursor:pointer;background:var(--ac);color:#000">1. SO Document</button>';
  h+='<button id="soStepPdf" onclick="soSendStep(\'pdf\');loadSendPDFPreview(\''+so.id+'\')" style="flex:1;padding:8px;font-size:10px;font-weight:700;border:none;cursor:pointer;background:var(--bg3);color:var(--tx)">2. PDF Preview</button>';
  h+='<button id="soStepEmail" onclick="soSendStep(\'email\')" style="flex:1;padding:8px;font-size:10px;font-weight:700;border:none;cursor:pointer;background:var(--bg3);color:var(--tx)">3. Email Template</button>';
  h+='</div>';

  // Step 1: Document HTML preview
  h+='<div id="soSendDoc" style="margin-bottom:14px">';
  h+='<div style="background:#fff;border-radius:8px;padding:20px;max-height:420px;overflow-y:auto;border:1px solid var(--bdr)">';
  h+=buildSOPrintHTML(so);
  h+='</div>';
  h+='<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">';
  h+='<button class="btn btn-ghost btn-sm" onclick="downloadSOPDF(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="soPrintPreview(\''+so.id+'\')">🖨 Print Preview</button>';
  h+='<div style="flex:1"></div>';
  h+='<button class="btn btn-pr btn-sm" onclick="soSendStep(\'pdf\');loadSendPDFPreview(\''+so.id+'\')">Next → PDF Preview</button>';
  h+='</div></div>';

  // Step 2: Actual PDF preview (iframe with blob URL)
  h+='<div id="soSendPdf" style="display:none;margin-bottom:14px">';
  h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:8px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:6px">ACTUAL PDF THAT WILL BE SENT / SAVED</div>';
  h+='<div id="soPdfFrameWrap" style="height:480px;border:1px solid var(--bdr);border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:11px">Click "PDF Preview" tab to generate…</div>';
  h+='</div>';
  h+='<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">';
  h+='<button class="btn btn-ghost btn-sm" onclick="downloadSOPDF(\''+so.id+'\')">⬇ Download PDF</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="loadSendPDFPreview(\''+so.id+'\',true)">🔄 Regenerate</button>';
  h+='<div style="flex:1"></div>';
  h+='<button class="btn btn-pr btn-sm" onclick="soSendStep(\'email\')">Next → Email Template</button>';
  h+='</div></div>';

  // Step 3: Email Template Selection + Edit
  h+='<div id="soSendEmail" style="display:none">';

  // Template selector
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:8px">SELECT EMAIL TEMPLATE</div>';
  h+='<div id="soTplList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
  SO_EMAIL_TEMPLATES.forEach(function(tpl,i){
    var checked=i===0?'checked':'';
    var isCustom=!!(SO_TEMPLATE_OVERRIDES[tpl.key]&&(SO_TEMPLATE_OVERRIDES[tpl.key].subject||SO_TEMPLATE_OVERRIDES[tpl.key].body));
    h+='<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor=\'var(--ac)\'" onmouseout="this.style.borderColor=\'var(--bdr)\'">';
    h+='<input type="radio" name="soTpl" value="'+tpl.key+'" '+checked+' style="accent-color:var(--ac)">';
    h+='<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(tpl.label)+(isCustom?' <span style="font-size:8px;background:#a78bfa;color:#fff;padding:1px 5px;border-radius:3px;margin-left:4px">CUSTOMIZED</span>':'')+'</div>';
    h+='<div style="font-size:10px;color:var(--tx3)">Key: '+esc(tpl.key)+'</div></div></label>';
  });
  h+='</div>';

  // Editable Subject
  h+='<div style="margin-bottom:10px"><label style="display:block;font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:4px">EMAIL SUBJECT (EDITABLE)</label>';
  h+='<input id="soTplSubject" type="text" style="width:100%;padding:10px;background:var(--inp);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:12px;font-family:inherit" oninput="_updateSOTplPreviewFromFields()"></div>';

  // Editable Body + Preview (side by side on wide screens)
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px" class="soEditGrid">';

  // Body editor
  h+='<div><label style="display:block;font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:4px">BODY HTML (EDITABLE)</label>';
  h+='<textarea id="soTplBody" style="width:100%;height:280px;padding:10px;background:var(--inp);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:10px;font-family:JetBrains Mono,monospace;resize:vertical" oninput="_updateSOTplPreviewFromFields()"></textarea>';
  h+='<div style="font-size:9px;color:var(--tx3);margin-top:4px;line-height:1.5">Placeholders: <code>{{soNum}}</code> <code>{{company}}</code> <code>{{contact}}</code> <code>{{email}}</code> <code>{{quoteNum}}</code> <code>{{poNumber}}</code> <code>{{jobDesc}}</code> <code>{{shipTo}}</code> <code>{{qty}}</code> <code>{{total}}</code> <code>{{payTerms}}</code> <code>{{status}}</code> <code>{{date}}</code></div>';
  h+='</div>';

  // Live preview
  h+='<div><label style="display:block;font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:4px">LIVE PREVIEW</label>';
  h+='<iframe id="soTplFrame" style="width:100%;height:280px;border:1px solid var(--bdr);border-radius:6px;background:#060d14" sandbox="allow-same-origin"></iframe></div>';

  h+='</div>';

  // Save / Reset buttons
  h+='<div style="display:flex;gap:6px;margin-bottom:12px">';
  h+='<button class="btn btn-ghost btn-sm" onclick="saveSOTplOverrideFromUI()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save as Default Template</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="resetSOTplFromUI(\''+so.id+'\')">↺ Reset to Original</button>';
  h+='</div>';

  // Action buttons (always visible)
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
  h+='<button class="btn btn-pr" onclick="executeSendSO(\''+so.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Email + Save PDF to Drive</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal();openSODetail(\''+so.id+'\')">Back</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  h+='</div>';
  h+='</div>';// /soSendEmail

  openModal(h);

  // Stash SO reference for callbacks
  window._soSendCurrent=so;

  // Wire up radio change → load template into fields
  setTimeout(function(){_loadTemplateIntoFields(so)},100);
  var radios=document.querySelectorAll('input[name="soTpl"]');
  radios.forEach(function(r){r.addEventListener('change',function(){_loadTemplateIntoFields(so)})});
}

// Load selected template's subject + body into editable fields
function _loadTemplateIntoFields(so){
  var sel=document.querySelector('input[name="soTpl"]:checked');
  if(!sel)return;
  var tpl=SO_EMAIL_TEMPLATES.find(function(t){return t.key===sel.value});
  if(!tpl)return;
  // Prefer raw override (unprocessed template string) if exists; otherwise use generated subject/body
  var override=SO_TEMPLATE_OVERRIDES[tpl.key]||{};
  var subj=override.subject||tpl.subject(so);
  var body=override.body||tpl.build(so);
  var subjEl=document.getElementById('soTplSubject');
  var bodyEl=document.getElementById('soTplBody');
  if(subjEl)subjEl.value=subj;
  if(bodyEl)bodyEl.value=body;
  _updateSOTplPreviewFromFields();
}

// Update iframe preview from editable fields (debounced, with live placeholder interpolation)
var _soTplPreviewTimer=null;
function _updateSOTplPreviewFromFields(){
  if(_soTplPreviewTimer)clearTimeout(_soTplPreviewTimer);
  _soTplPreviewTimer=setTimeout(function(){
    _soTplPreviewTimer=null;
    var so=window._soSendCurrent;
    if(!so)return;
    var bodyEl=document.getElementById('soTplBody');
    var frame=document.getElementById('soTplFrame');
    if(!bodyEl||!frame)return;
    try{
      var interpolated=_interpolateTemplate(bodyEl.value||'',so);
      frame.srcdoc=interpolated;
    }catch(e){console.warn('SO tpl preview error:',e)}
  },250);
}

// Save current UI values as default template override
function saveSOTplOverrideFromUI(){
  var sel=document.querySelector('input[name="soTpl"]:checked');
  if(!sel)return toast('Pick a template first','err');
  var subj=(document.getElementById('soTplSubject')||{}).value||'';
  var body=(document.getElementById('soTplBody')||{}).value||'';
  if(!subj||!body)return toast('Subject & body cannot be empty','err');
  toast('Saving template override…','ok');
  saveSOTemplateOverride(sel.value,subj,body).then(function(){
    toast('Template saved as new default','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.template.saved','Saved SO email template override: '+sel.value);
  }).catch(function(e){toast('Save failed: '+e.message,'err')});
}

// Reset the editable fields back to original hardcoded template (does NOT delete the override)
function resetSOTplFromUI(soId){
  var so=getSO(soId);if(!so)return;
  var sel=document.querySelector('input[name="soTpl"]:checked');
  if(!sel)return;
  var tpl=SO_EMAIL_TEMPLATES.find(function(t){return t.key===sel.value});
  if(!tpl)return;
  // Temporarily bypass the override to get the pristine default
  var savedOverride=SO_TEMPLATE_OVERRIDES[tpl.key];
  delete SO_TEMPLATE_OVERRIDES[tpl.key];
  var pristineSubj=tpl.subject(so);
  var pristineBody=tpl.build(so);
  SO_TEMPLATE_OVERRIDES[tpl.key]=savedOverride;
  var subjEl=document.getElementById('soTplSubject');
  var bodyEl=document.getElementById('soTplBody');
  if(subjEl)subjEl.value=pristineSubj;
  if(bodyEl)bodyEl.value=pristineBody;
  _updateSOTplPreviewFromFields();
  toast('Fields reset to original template','ok');
}

// Load/generate the actual PDF and show in iframe (step 2 of send flow)
function loadSendPDFPreview(soId,forceRegen){
  var so=getSO(soId);if(!so)return;
  var wrap=document.getElementById('soPdfFrameWrap');
  if(!wrap)return;
  if(window._soPdfPreviewUrl&&!forceRegen&&window._soPdfPreviewSoId===soId){
    wrap.innerHTML='<iframe src="'+window._soPdfPreviewUrl+'" style="width:100%;height:100%;border:none"></iframe>';
    return;
  }
  wrap.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:32px;height:32px;border:3px solid var(--bdr);border-top-color:var(--ac);border-radius:50%;animation:spin 1s linear infinite"></div><div style="font-size:11px;color:var(--tx3)">Generating PDF…</div></div>';
  generateSOPDF(so).then(function(pdf){
    if(window._soPdfPreviewUrl){try{URL.revokeObjectURL(window._soPdfPreviewUrl)}catch(e){}}
    window._soPdfPreviewUrl=URL.createObjectURL(pdf.blob);
    window._soPdfPreviewSoId=soId;
    var wrap2=document.getElementById('soPdfFrameWrap');
    if(wrap2)wrap2.innerHTML='<iframe src="'+window._soPdfPreviewUrl+'" style="width:100%;height:100%;border:none"></iframe>';
  }).catch(function(e){
    var wrap2=document.getElementById('soPdfFrameWrap');
    if(wrap2)wrap2.innerHTML='<div style="color:#dc2626;font-size:11px;padding:20px">PDF error: '+esc(e.message||String(e))+'</div>';
  });
}

// Toggle between document preview, PDF preview, and email template steps
function soSendStep(step){
  var docEl=document.getElementById('soSendDoc');
  var pdfEl=document.getElementById('soSendPdf');
  var emailEl=document.getElementById('soSendEmail');
  var btnDoc=document.getElementById('soStepDoc');
  var btnPdf=document.getElementById('soStepPdf');
  var btnEmail=document.getElementById('soStepEmail');
  if(!docEl||!emailEl)return;
  // Hide all panes
  docEl.style.display='none';
  if(pdfEl)pdfEl.style.display='none';
  emailEl.style.display='none';
  // Reset all button styles
  if(btnDoc){btnDoc.style.background='var(--bg3)';btnDoc.style.color='var(--tx)'}
  if(btnPdf){btnPdf.style.background='var(--bg3)';btnPdf.style.color='var(--tx)'}
  if(btnEmail){btnEmail.style.background='var(--bg3)';btnEmail.style.color='var(--tx)'}
  // Show active pane
  if(step==='doc'){
    docEl.style.display='';
    if(btnDoc){btnDoc.style.background='var(--ac)';btnDoc.style.color='#000'}
  }else if(step==='pdf'){
    if(pdfEl)pdfEl.style.display='';
    if(btnPdf){btnPdf.style.background='var(--ac)';btnPdf.style.color='#000'}
  }else{
    emailEl.style.display='';
    if(btnEmail){btnEmail.style.background='var(--ac)';btnEmail.style.color='#000'}
  }
}

// Print preview — opens the SO in a new window for printing
function soPrintPreview(soId){
  var so=getSO(soId);if(!so)return;
  var w=window.open('','_blank','width=850,height=1100');
  if(!w)return;
  w.document.write('<html><head><title>'+esc(so.soNum)+' — Sales Order</title><style>@media print{body{margin:0}}</style></head><body style="margin:20px;font-family:Arial,sans-serif">');
  w.document.write(buildSOPrintHTML(so));
  w.document.write('</body></html>');
  w.document.close();
  setTimeout(function(){w.print()},500);
}

function _updateSOTplPreview(so){
  var sel=document.querySelector('input[name="soTpl"]:checked');
  if(!sel)return;
  var tpl=SO_EMAIL_TEMPLATES.find(function(t){return t.key===sel.value});
  if(!tpl)return;
  var frame=document.getElementById('soTplFrame');
  if(!frame)return;
  var html=tpl.build(so);
  frame.srcdoc=html;
}

function _getSelectedTemplate(){
  var sel=document.querySelector('input[name="soTpl"]:checked');
  if(!sel)return SO_EMAIL_TEMPLATES[0];
  return SO_EMAIL_TEMPLATES.find(function(t){return t.key===sel.value})||SO_EMAIL_TEMPLATES[0];
}

// ─── Execute Send: email + PDF to Drive ───
function executeSendSO(soId){
  var so=getSO(soId);if(!so)return;
  var tpl=_getSelectedTemplate();

  // Capture any edited subject/body from the live UI BEFORE closing the modal
  var subjEl=document.getElementById('soTplSubject');
  var bodyEl=document.getElementById('soTplBody');
  var editedSubjRaw=subjEl?subjEl.value:null;
  var editedBodyRaw=bodyEl?bodyEl.value:null;

  closeModal();
  toast('Generating PDF & sending '+tpl.label+'...','ok');

  // Generate real PDF first
  generateSOPDF(so).then(function(pdf){
    // Prefer edited UI values; fall back to template defaults
    var subj=editedSubjRaw?_interpolateTemplate(editedSubjRaw,so):tpl.subject(so);
    var emailHTML=editedBodyRaw?_interpolateTemplate(editedBodyRaw,so):tpl.build(so);

    getGoogleToken().then(function(token){
      if(!token)return toast('Sign out & back in for Google access','err');

      // 1. Send email
      var raw='Content-Type: text/html; charset=utf-8\r\nFrom: MFX OS <info@microflexfilm.com>\r\nTo: '+so.email+'\r\nSubject: '+subj+'\r\nMIME-Version: 1.0\r\n\r\n'+emailHTML;
      var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

      fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
        method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({raw:encoded})
      }).then(function(r){return r.json()}).then(function(data){
        if(!data.id){toast('Email error','err');return}

        // 2. Save PDF to Drive (not HTML)
        findOrCreateClientFolder(token,so.company,so.quoteNum).then(function(folderId){
          if(!folderId){finalizeSO(so,null,tpl.key);return}
          var metadata={name:pdf.filename,mimeType:'application/pdf',parents:[folderId]};
          var form=new FormData();
          form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
          form.append('file',pdf.blob);
          fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{
            method:'POST',headers:{'Authorization':'Bearer '+token},body:form
          }).then(function(r){return r.json()}).then(function(fileData){
            var link=fileData.id?'https://drive.google.com/file/d/'+fileData.id+'/view':null;
            finalizeSO(so,link,tpl.key);
          }).catch(function(e){console.warn('Drive upload err:',e);finalizeSO(so,null,tpl.key)});
        }).catch(function(e){console.warn('Drive folder err:',e);finalizeSO(so,null,tpl.key)});
      }).catch(function(e){toast('Email error: '+e.message,'err')});
    });
  }).catch(function(e){toast('PDF generation error: '+e.message,'err')});
}

// ─── Send SO to Client (opens template selection flow) ───
function sendSOToClient(soId){
  openSOSendFlow(soId);
}

function finalizeSO(so,driveLink,templateKey){
  so.status='sent';
  so.sentAt=new Date().toISOString();
  so.sentTo=so.email;
  so.lastTemplate=templateKey||'confirmation';
  if(driveLink)so.driveLink=driveLink;
  so.notes=so.notes||[];
  var tplLabel=(SO_EMAIL_TEMPLATES.find(function(t){return t.key===templateKey})||{}).label||'Order Confirmation';
  so.notes.push({text:'✉ Sent "'+tplLabel+'" to '+so.email+(driveLink?' · PDF saved to Drive':''),by:getUserName(),at:new Date().toISOString()});

  saveSO(so).then(function(){
    toast(so.soNum+' sent to '+so.email+'!','ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.sent',so.soNum+' sent to '+so.email+' ('+tplLabel+')');
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.sent',{soId:so.id,soNum:so.soNum,company:so.company,email:so.email,template:templateKey});
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
  so=so||{};
  var _n=function(v){var n=Number(v);return isFinite(n)?n:0};
  var _fN=function(v){return _n(v).toLocaleString()};
  var _f$=function(v){return '$'+_n(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})};
  var rows='';
  if(so.allQtys&&so.allQtys.length){
    so.allQtys.forEach(function(r,i){
      r=r||{};
      var sel=i===so.selectedQtyIndex;
      rows+='<tr style="'+(sel?'background:#0a2e3e':'')+'"><td style="padding:8px 14px;font-size:12px;color:'+(sel?'#00e5ff':'#94a3b8')+';border-bottom:1px solid #1a2d40">'+(sel?'→ ':'')+_fN(r.qty)+'</td><td style="padding:8px 14px;font-size:12px;color:#94a3b8;text-align:right;border-bottom:1px solid #1a2d40">$'+_n(r.ppu).toFixed(4)+'</td><td style="padding:8px 14px;font-size:12px;color:'+(sel?'#e0f2fe':'#94a3b8')+';font-weight:'+(sel?'700':'400')+';text-align:right;border-bottom:1px solid #1a2d40">'+_f$(r.total)+'</td></tr>';
    });
  }

  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'
    +'<tr><td style="height:3px;background:#00e5ff;font-size:0">&nbsp;</td></tr>'
    +'<tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:24px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:70px;height:2px;background:#00e5ff;margin:4px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'
    +'<tr><td style="padding:5px 24px;background:#0a2e3e;text-align:center;font-size:7px;color:#00e5ff;letter-spacing:1px;border-bottom:1px solid #0f1d2b">SALES ORDER CONFIRMATION</td></tr>'
    +'<tr><td style="padding:20px 24px"><div style="font-size:20px;font-weight:900;color:#e0f2fe">'+esc(so.soNum||'—')+'</div><div style="font-size:11px;color:#64748b;margin-top:4px">Quote: '+esc(so.quoteNum||'—')+' · PO# '+esc(so.poNumber||'—')+'</div></td></tr>'
    +'<tr><td style="padding:0 24px 16px"><table width="100%" style="border:1px solid #1a2d40;border-radius:6px;border-collapse:collapse"><tr><td style="padding:12px 14px;background:#0a1a28;border-bottom:1px solid #1a2d40" colspan="3"><div style="font-size:8px;color:#00e5ff;letter-spacing:2px">ORDER DETAILS</div></td></tr><tr><td style="padding:8px 14px;font-size:11px;color:#64748b;border-bottom:1px solid #1a2d40" colspan="3">'+esc(so.jobDesc||'—')+'</td></tr>'+rows+'<tr style="background:#0a2e3e"><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#e0f2fe" colspan="2">Selected Total</td><td style="padding:10px 14px;font-size:14px;font-weight:900;color:#00e5ff;text-align:right">'+_f$(so.total)+'</td></tr></table></td></tr>'
    +'<tr><td style="padding:0 24px 16px"><table width="100%" style="font-size:11px;color:#64748b"><tr><td>Ship To: <b style="color:#e0f2fe">'+esc(so.shipTo||'—')+'</b></td></tr><tr><td>Terms: <b style="color:#e0f2fe">'+esc(so.payTerms||'Net 30')+'</b></td></tr>'+(so.poInstructions?'<tr><td>Instructions: '+esc(so.poInstructions)+'</td></tr>':'')+'</table></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#00e5ff;color:#060d14">View in Client Portal</a></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com · SQF Certified | Made in USA</td></tr></table>';
}

// ═══════════════════════════════════════
// SO EMAIL TEMPLATES
// ═══════════════════════════════════════
// Custom template overrides loaded from Firestore (controlConfigs/soEmailTemplates)
// Shape: { confirmation:{subject,body}, followup:{subject,body}, ... }
var SO_TEMPLATE_OVERRIDES={};

function loadSOTemplateOverrides(){
  if(typeof fbDb==='undefined')return Promise.resolve();
  return fbDb.collection('controlConfigs').doc('soEmailTemplates').get().then(function(doc){
    if(doc.exists){SO_TEMPLATE_OVERRIDES=doc.data()||{}}
  }).catch(function(e){console.warn('SO template overrides load error:',e)});
}

function saveSOTemplateOverride(key,subject,body){
  if(typeof fbDb==='undefined')return Promise.reject('No DB');
  SO_TEMPLATE_OVERRIDES[key]={subject:subject,body:body,updatedAt:new Date().toISOString(),updatedBy:(typeof getUserName==='function'?getUserName():'Unknown')};
  return fbDb.collection('controlConfigs').doc('soEmailTemplates').set(SO_TEMPLATE_OVERRIDES,{merge:true});
}

function resetSOTemplateOverride(key){
  if(typeof fbDb==='undefined')return Promise.reject('No DB');
  delete SO_TEMPLATE_OVERRIDES[key];
  var update={};update[key]=firebase.firestore.FieldValue.delete();
  return fbDb.collection('controlConfigs').doc('soEmailTemplates').update(update);
}

// Interpolate template placeholders with SO data
function _interpolateTemplate(str,so){
  if(!str)return'';
  return str
    .replace(/\{\{soNum\}\}/g,so.soNum||'')
    .replace(/\{\{company\}\}/g,so.company||'')
    .replace(/\{\{contact\}\}/g,so.contact||'')
    .replace(/\{\{email\}\}/g,so.email||'')
    .replace(/\{\{quoteNum\}\}/g,so.quoteNum||'')
    .replace(/\{\{poNumber\}\}/g,so.poNumber||'')
    .replace(/\{\{jobDesc\}\}/g,so.jobDesc||'')
    .replace(/\{\{shipTo\}\}/g,so.shipTo||'')
    .replace(/\{\{qty\}\}/g,Number(so.selectedQty||0).toLocaleString())
    .replace(/\{\{total\}\}/g,'$'+Number(so.total||0).toLocaleString(undefined,{minimumFractionDigits:2}))
    .replace(/\{\{payTerms\}\}/g,so.payTerms||'Net 30')
    .replace(/\{\{status\}\}/g,(so.status||'pending').toUpperCase())
    .replace(/\{\{date\}\}/g,new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}));
}

var SO_EMAIL_TEMPLATES=[
  {
    key:'confirmation',
    label:'Order Confirmation',
    subject:function(so){var o=SO_TEMPLATE_OVERRIDES.confirmation;return o&&o.subject?_interpolateTemplate(o.subject,so):'Microflex Sales Order '+so.soNum+' — '+so.company},
    build:function(so){var o=SO_TEMPLATE_OVERRIDES.confirmation;return o&&o.body?_interpolateTemplate(o.body,so):buildSOEmailHTML(so)}
  },
  {
    key:'followup',
    label:'Follow-Up / Status Update',
    subject:function(so){var o=SO_TEMPLATE_OVERRIDES.followup;return o&&o.subject?_interpolateTemplate(o.subject,so):'Update on Sales Order '+so.soNum+' — '+so.company},
    build:function(so){var o=SO_TEMPLATE_OVERRIDES.followup;return o&&o.body?_interpolateTemplate(o.body,so):buildSOFollowUpHTML(so)}
  },
  {
    key:'shipping',
    label:'Shipping Notification',
    subject:function(so){var o=SO_TEMPLATE_OVERRIDES.shipping;return o&&o.subject?_interpolateTemplate(o.subject,so):'Shipping Notice — Sales Order '+so.soNum+' — '+so.company},
    build:function(so){var o=SO_TEMPLATE_OVERRIDES.shipping;return o&&o.body?_interpolateTemplate(o.body,so):buildSOShippingHTML(so)}
  },
  {
    key:'thankyou',
    label:'Thank You / Complete',
    subject:function(so){var o=SO_TEMPLATE_OVERRIDES.thankyou;return o&&o.subject?_interpolateTemplate(o.subject,so):'Thank You — Order '+so.soNum+' Complete — Microflex'},
    build:function(so){var o=SO_TEMPLATE_OVERRIDES.thankyou;return o&&o.body?_interpolateTemplate(o.body,so):buildSOThankYouHTML(so)}
  }
];

function buildSOFollowUpHTML(so){
  so=so||{};
  var _n=function(v){var n=Number(v);return isFinite(n)?n:0};
  var _fN=function(v){return _n(v).toLocaleString()};
  var _f$=function(v){return '$'+_n(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})};
  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'
    +'<tr><td style="height:3px;background:#00e5ff;font-size:0">&nbsp;</td></tr>'
    +'<tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:24px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:70px;height:2px;background:#00e5ff;margin:4px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'
    +'<tr><td style="padding:5px 24px;background:#0a2e3e;text-align:center;font-size:7px;color:#00e5ff;letter-spacing:1px;border-bottom:1px solid #0f1d2b">ORDER STATUS UPDATE</td></tr>'
    +'<tr><td style="padding:20px 24px"><div style="font-size:20px;font-weight:900;color:#e0f2fe">'+esc(so.soNum||'—')+'</div><div style="font-size:11px;color:#64748b;margin-top:4px">Quote: '+esc(so.quoteNum||'—')+' · PO# '+esc(so.poNumber||'—')+'</div></td></tr>'
    +'<tr><td style="padding:0 24px 20px"><div style="background:#0a1a28;border:1px solid #1a2d40;border-radius:6px;padding:16px"><div style="font-size:12px;color:#94a3b8;line-height:1.6">Dear '+esc(so.contact||'Valued Customer')+',</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">We wanted to provide you with an update on your order <strong style="color:#00e5ff">'+esc(so.soNum||'—')+'</strong> for <strong style="color:#e0f2fe">'+esc(so.jobDesc||'—')+'</strong>.</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">Your order is currently <strong style="color:#00e5ff">'+esc((so.status||'pending').toUpperCase())+'</strong>. Quantity: '+_fN(so.selectedQty)+' units at '+_f$(so.total)+' total.</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">Please don\'t hesitate to reach out if you have any questions.</div></div></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#00e5ff;color:#060d14">View in Client Portal</a></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com · SQF Certified | Made in USA</td></tr></table>';
}

function buildSOShippingHTML(so){
  so=so||{};
  var _n=function(v){var n=Number(v);return isFinite(n)?n:0};
  var _fN=function(v){return _n(v).toLocaleString()};
  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'
    +'<tr><td style="height:3px;background:#4ade80;font-size:0">&nbsp;</td></tr>'
    +'<tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:24px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:70px;height:2px;background:#4ade80;margin:4px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'
    +'<tr><td style="padding:5px 24px;background:#0a3e1e;text-align:center;font-size:7px;color:#4ade80;letter-spacing:1px;border-bottom:1px solid #0f1d2b">SHIPPING NOTIFICATION</td></tr>'
    +'<tr><td style="padding:20px 24px"><div style="font-size:20px;font-weight:900;color:#e0f2fe">'+esc(so.soNum||'—')+'</div><div style="font-size:11px;color:#64748b;margin-top:4px">Quote: '+esc(so.quoteNum||'—')+' · PO# '+esc(so.poNumber||'—')+'</div></td></tr>'
    +'<tr><td style="padding:0 24px 20px"><div style="background:#0a1a28;border:1px solid #1a2d40;border-radius:6px;padding:16px"><div style="font-size:12px;color:#94a3b8;line-height:1.6">Dear '+esc(so.contact||'Valued Customer')+',</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">Great news! Your order <strong style="color:#4ade80">'+esc(so.soNum||'—')+'</strong> for <strong style="color:#e0f2fe">'+esc(so.jobDesc||'—')+'</strong> has been shipped.</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px"><strong style="color:#e0f2fe">Ship To:</strong> '+esc(so.shipTo||'—')+'</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:4px"><strong style="color:#e0f2fe">Quantity:</strong> '+_fN(so.selectedQty)+' units</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">Please allow standard transit time for delivery. Contact us if you have any questions about your shipment.</div></div></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#4ade80;color:#060d14">View in Client Portal</a></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com · SQF Certified | Made in USA</td></tr></table>';
}

function buildSOThankYouHTML(so){
  so=so||{};
  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'
    +'<tr><td style="height:3px;background:#c084fc;font-size:0">&nbsp;</td></tr>'
    +'<tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:24px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:70px;height:2px;background:#c084fc;margin:4px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'
    +'<tr><td style="padding:5px 24px;background:#2e1a3e;text-align:center;font-size:7px;color:#c084fc;letter-spacing:1px;border-bottom:1px solid #0f1d2b">ORDER COMPLETE</td></tr>'
    +'<tr><td style="padding:20px 24px"><div style="font-size:20px;font-weight:900;color:#e0f2fe">'+esc(so.soNum||'—')+'</div><div style="font-size:11px;color:#64748b;margin-top:4px">Quote: '+esc(so.quoteNum||'—')+' · PO# '+esc(so.poNumber||'—')+'</div></td></tr>'
    +'<tr><td style="padding:0 24px 20px"><div style="background:#0a1a28;border:1px solid #1a2d40;border-radius:6px;padding:16px"><div style="font-size:12px;color:#94a3b8;line-height:1.6">Dear '+esc(so.contact||'Valued Customer')+',</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">Thank you for your business! Order <strong style="color:#c084fc">'+esc(so.soNum||'—')+'</strong> for <strong style="color:#e0f2fe">'+esc(so.jobDesc||'—')+'</strong> has been fulfilled and delivered.</div><div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px">We truly appreciate your partnership with Microflex and look forward to working with you again. If you need reorders or have any feedback, please don\'t hesitate to reach out.</div></div></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#c084fc;color:#060d14">View in Client Portal</a></td></tr>'
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
    // DATA-02 fix (2026-05-24): canonical names are faceStock + lamination.
    // Legacy keys (face, laminate) kept as fallback reads; never written here.
    faceStock:f.faceStock||f.face||'',
    lamination:f.lamination||f.laminate||'',
    coating:f.coating||'',
    adhesive:f.adhesive||'',
    liner:f.liner||'',
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
      var descClean=(so.jobDesc||'').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/\s+/g,'-').substring(0,60);
      var filename=so.soNum+'_'+so.company.replace(/[^a-zA-Z0-9]/g,'-')+(descClean?'_'+descClean:'')+'.pdf';
      var pdfBlob=pdf.output('blob');var pdfBase64=pdf.output('datauristring').split(',')[1];
      resolve({blob:pdfBlob,base64:pdfBase64,filename:filename});
    }).catch(function(e){document.body.removeChild(container);reject(e)});
  });
}

function buildSOPrintHTML(so){
  // Format helpers
  var _fD=function(d){try{return new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}catch(e){return '—'}};
  var _fN=function(n){return Number(n||0).toLocaleString()};
  var _f$=function(n){return '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})};
  var _barcode=(typeof genBarcodeSVG==='function')?genBarcodeSVG:function(){return ''};
  var _qr=(typeof generateMFXQR==='function')?generateMFXQR():'';

  // Order lines — SO-focused (single confirmed qty big)
  var confQty=so.selectedQty||0;
  var confPPU=so.ppu||(confQty?so.total/confQty:0);
  var confTotal=so.total||0;

  // Secondary pricing ladder (if multiple qtys available)
  var ladderRows='';
  if(so.allQtys&&so.allQtys.length>1){
    so.allQtys.forEach(function(r,i){
      var sel=i===so.selectedQtyIndex;
      ladderRows+='<tr style="'+(sel?'background:#e0f7fa':'background:#fff')+'">'
        +'<td style="padding:6px 10px;font-size:9px;color:'+(sel?'#00838f':'#555')+';border-bottom:1px solid #e8ecf0;font-weight:'+(sel?'800':'500')+'">'+(sel?'✓ ':'')+_fN(r.qty)+'</td>'
        +'<td style="padding:6px 10px;font-size:9px;text-align:right;border-bottom:1px solid #e8ecf0;color:#555">$'+(r.ppu||0).toFixed(4)+'</td>'
        +'<td style="padding:6px 10px;font-size:9px;text-align:right;border-bottom:1px solid #e8ecf0;font-weight:'+(sel?'800':'500')+';color:'+(sel?'#0a2e3e':'#555')+'">'+_f$(r.total||0)+'</td></tr>';
    });
  }

  // Build SKU rows (if multi-sku)
  var skuRows='';
  if(so.skus&&so.skus.length){
    so.skus.forEach(function(sk,i){
      skuRows+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dashed #e8ecf0;font-size:9px">'
        +'<span style="background:#a78bfa;color:#fff;font-weight:800;padding:2px 7px;border-radius:3px;font-size:8px">SKU '+(i+1)+'</span>'
        +'<span style="flex:1;color:#0a2030;font-weight:600">'+esc(sk.name||sk.sku||'Item '+(i+1))+'</span>'
        +(sk.qty?'<span style="color:#555">'+_fN(sk.qty)+' units</span>':'')
        +'</div>';
    });
  }

  // Status stamp color
  var statusColor={'pending':'#f59e0b','approved':'#16a34a','sent':'#00bcd4','completed':'#16a34a','cancelled':'#dc2626'}[so.status]||'#94a3b0';
  var statusLabel=(so.status||'pending').toUpperCase();

  // Production timeline stages
  var stages=[
    {k:'created',l:'SO Created',done:!!so.createdAt,at:so.createdAt},
    {k:'approved',l:'CEO Approved',done:!!so.approvedAt,at:so.approvedAt},
    {k:'sent',l:'Sent to Client',done:!!so.sentAt,at:so.sentAt},
    {k:'signed',l:'Client Signed',done:!!so.clientSignedAt,at:so.clientSignedAt},
    {k:'production',l:'In Production',done:so.status==='completed'||!!so.productionStartedAt,at:so.productionStartedAt},
    {k:'shipped',l:'Shipped',done:!!so.shippedAt,at:so.shippedAt}
  ];

  return '<div style="max-width:800px;margin:0 auto;font-family:Outfit,Arial,sans-serif;background:#fff;color:#0a2030">'

    // ═══ HEADER ═══ (matches quote)
    +'<div style="padding:16px 24px 10px;display:flex;justify-content:space-between;align-items:center">'
    +'<div style="line-height:1">'
    +'<span style="font-family:Outfit,sans-serif;font-size:34px;font-weight:900;color:#0a2e3e;letter-spacing:-.5px;display:block">Microflex</span>'
    +'<div style="width:100%;height:2.5px;background:#00e5ff;margin:3px 0 4px;border-radius:1px"></div>'
    +'<span style="font-family:Outfit,sans-serif;font-size:10px;font-weight:300;color:#00838f;letter-spacing:5px;text-transform:uppercase;display:block">Film Corporation</span>'
    +'</div>'
    +(_qr?'<div style="text-align:center;flex-shrink:0;padding:0 16px"><div style="display:inline-block;padding:4px;border:1.5px solid #e0e8ee;border-radius:5px;line-height:0;background:#fafcfd">'+_qr+'</div><div style="font-size:5px;color:#00838f;letter-spacing:1.2px;font-weight:700;margin-top:3px">SCAN · CONNECT</div></div>':'')
    +'<div style="text-align:right">'
    +'<div style="font-size:10px;font-weight:800;color:#0a2e3e">MicroflexFilm.com</div>'
    +'<div style="font-size:7px;color:#7a8a98;line-height:1.5;margin-top:2px;font-weight:500">4130 Garner Rd · Riverside, CA 92501<br>(909) 360-9066 · Orders@MicroflexFilm.com</div>'
    +'<div style="font-size:7px;color:#00BCD4;font-weight:700;letter-spacing:1px;margin-top:3px">SQF Certified | Made in USA</div>'
    +'</div></div>'

    // ═══ NAVY BAR — "SALES ORDER CONFIRMATION" ═══ (differentiator from quote)
    +'<div style="padding:8px 24px;background:#0a2e3e;text-align:center;position:relative">'
    +'<span style="font-size:11px;color:#00e5ff;font-weight:800;letter-spacing:4px">◆ SALES ORDER CONFIRMATION ◆</span>'
    +'<div style="position:absolute;right:24px;top:50%;transform:translateY(-50%);background:'+statusColor+';color:#fff;font-size:8px;font-weight:800;padding:3px 10px;border-radius:12px;letter-spacing:1.5px">'+statusLabel+'</div>'
    +'</div>'

    // ═══ SO IDENTITY BAR ═══ (BIG SO number + barcode strip — unique to SO layout)
    +'<div style="display:flex;border-bottom:1px solid #e8ecf0;background:linear-gradient(90deg,#f0f9ff 0%,#fff 100%)">'
    +'<div style="flex:2;padding:14px 24px">'
    +'<div style="font-size:7px;color:#00838f;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px">Sales Order No.</div>'
    +'<div style="font-size:28px;font-weight:900;color:#0a2e3e;font-family:JetBrains Mono,monospace;line-height:1">'+esc(so.soNum||'—')+'</div>'
    +'<div style="margin-top:6px">'+_barcode(so.soNum||'SO-0000',280,36,'#0a2e3e')+'</div>'
    +'</div>'
    +'<div style="flex:1;padding:14px 24px;border-left:1px solid #e8ecf0;background:#fafcfd">'
    +'<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:9px">'
    +'<div style="color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Order Date</div><div style="color:#0a2030;font-weight:700">'+_fD(so.createdAt)+'</div>'
    +'<div style="color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Quote Ref</div><div style="color:#0a2030;font-weight:700">'+esc(so.quoteNum||'—')+' Rev '+(so.quoteRev||'A')+'</div>'
    +'<div style="color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">PO Number</div><div style="color:#0a2030;font-weight:800">'+esc(so.poNumber||'—')+'</div>'
    +'<div style="color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Terms</div><div style="color:#0a2030;font-weight:700">'+esc(so.payTerms||'Net 30')+'</div>'
    +(so.poRequiredDate?'<div style="color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Required</div><div style="color:#dc2626;font-weight:800">'+_fD(so.poRequiredDate)+'</div>':'')
    +'</div>'
    +'</div></div>'

    // ═══ BILL TO / SHIP TO / CONTACT — 3-column ═══
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e8ecf0">'
    // BILL TO
    +'<div style="padding:12px 16px;border-right:1px solid #edf0f2">'
    +'<div style="font-size:7px;color:#00BCD4;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:4px">'
    +'<span style="display:inline-block;width:12px;height:1.5px;background:#00BCD4"></span>Bill To</div>'
    +'<div style="font-size:12px;font-weight:800;color:#0a2030;line-height:1.3">'+esc(so.company||'—')+'</div>'
    +'<div style="font-size:9px;color:#555;line-height:1.5;margin-top:3px">'+esc(so.contact||'')+'</div>'
    +'<div style="font-size:9px;color:#00838f;line-height:1.5">'+esc(so.email||'')+'</div>'
    +'<div style="font-size:9px;color:#555;line-height:1.5">'+esc(so.phone||'')+'</div>'
    +'</div>'
    // SHIP TO
    +'<div style="padding:12px 16px;border-right:1px solid #edf0f2;background:#fafcfd">'
    +'<div style="font-size:7px;color:#ea580c;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:4px">'
    +'<span style="display:inline-block;width:12px;height:1.5px;background:#ea580c"></span>Ship To</div>'
    +'<div style="font-size:10px;color:#0a2030;font-weight:700;line-height:1.5;white-space:pre-wrap">'+esc(so.shipTo||so.company||'—')+'</div>'
    +'</div>'
    // SOLD BY
    +'<div style="padding:12px 16px">'
    +'<div style="font-size:7px;color:#16a34a;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:4px">'
    +'<span style="display:inline-block;width:12px;height:1.5px;background:#16a34a"></span>Sold By</div>'
    +'<div style="font-size:10px;font-weight:700;color:#0a2030">'+esc(so.estimator||'—')+'</div>'
    +(so.salesRep?'<div style="font-size:9px;color:#555;margin-top:2px">Sales Rep: '+esc(so.salesRep)+'</div>':'')
    +'<div style="font-size:9px;color:#00838f;margin-top:2px">Orders@MicroflexFilm.com</div>'
    +'</div>'
    +'</div>'

    // ═══ ORDER ITEM — big confirmation block (different from quote's pricing matrix) ═══
    +'<div style="padding:16px 24px;background:#f7fafc">'
    +'<div style="font-size:8px;color:#00BCD4;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Confirmed Order</div>'

    // Job description card
    +'<div style="background:#fff;border:1px solid #e8ecf0;border-left:4px solid #00e5ff;border-radius:6px;padding:12px 14px;margin-bottom:10px">'
    +'<div style="font-size:13px;font-weight:800;color:#0a2030;line-height:1.3">'+esc(so.jobDesc||'—')+'</div>'
    // Spec chips
    +'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">'
    +(so.sizeA||so.sizeB?'<span style="background:#d9f99d;color:#365314;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">SIZE '+esc(so.sizeA||'?')+'" × '+esc(so.sizeB||'?')+'"</span>':'')
    +(so.shapeType?'<span style="background:#bfdbfe;color:#1e3a8a;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">SHAPE '+esc(so.shapeType)+'</span>':'')
    +(so.colors?'<span style="background:#fde68a;color:#78350f;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">COLORS '+esc(String(so.colors))+'</span>':'')
    +(so.jobType?'<span style="background:#c7d2fe;color:#3730a3;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">'+esc(so.jobType.toUpperCase())+'</span>':'')
    +(so.face||so.faceStock?'<span style="background:#fed7aa;color:#7c2d12;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">FACE '+esc(so.face||so.faceStock)+'</span>':'')
    +(so.laminate||so.lamination?'<span style="background:#fed7aa;color:#7c2d12;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">LAM '+esc(so.laminate||so.lamination)+'</span>':'')
    +(so.adhesive?'<span style="background:#fed7aa;color:#7c2d12;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">ADH '+esc(so.adhesive)+'</span>':'')
    +(so.coating?'<span style="background:#fed7aa;color:#7c2d12;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">COAT '+esc(so.coating)+'</span>':'')
    +(so.windDir?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">WIND '+esc(so.windDir)+'</span>':'')
    +(so.labRoll?'<span style="background:#bbf7d0;color:#14532d;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">'+esc(String(so.labRoll))+'/ROLL</span>':'')
    +'</div>'
    +(skuRows?'<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e8ecf0">'+skuRows+'</div>':'')
    +'</div>'

    // Confirmed Qty / PPU / Total — HERO block (signature SO layout)
    +'<div style="display:grid;grid-template-columns:1.2fr 1fr 1.3fr;gap:0;background:#0a2e3e;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(10,46,62,.15)">'
    +'<div style="padding:14px 16px;text-align:center;border-right:1px solid #1a4a5f">'
    +'<div style="font-size:7px;color:#00e5ff;font-weight:800;letter-spacing:2px;margin-bottom:2px">QUANTITY</div>'
    +'<div style="font-size:22px;font-weight:900;color:#fff;line-height:1">'+_fN(confQty)+'</div>'
    +'<div style="font-size:8px;color:#7ec6d1;margin-top:2px">units</div>'
    +'</div>'
    +'<div style="padding:14px 16px;text-align:center;border-right:1px solid #1a4a5f">'
    +'<div style="font-size:7px;color:#00e5ff;font-weight:800;letter-spacing:2px;margin-bottom:2px">PRICE / UNIT</div>'
    +'<div style="font-size:16px;font-weight:900;color:#fff;line-height:1">$'+(confPPU||0).toFixed(4)+'</div>'
    +'</div>'
    +'<div style="padding:14px 16px;text-align:center;background:linear-gradient(135deg,#00e5ff 0%,#00bcd4 100%)">'
    +'<div style="font-size:7px;color:#0a2e3e;font-weight:800;letter-spacing:2px;margin-bottom:2px">ORDER TOTAL</div>'
    +'<div style="font-size:22px;font-weight:900;color:#0a2e3e;line-height:1">'+_f$(confTotal)+'</div>'
    +(so.payTerms?'<div style="font-size:8px;color:#0a2e3e;margin-top:2px;font-weight:700">'+esc(so.payTerms)+'</div>':'')
    +'</div>'
    +'</div>'

    // Pricing ladder (if multiple qtys)
    +(ladderRows?'<div style="margin-top:10px;background:#fff;border:1px solid #e8ecf0;border-radius:6px;overflow:hidden">'
      +'<div style="padding:6px 10px;background:#fafcfd;border-bottom:1px solid #e8ecf0;font-size:7px;color:#94a3b0;font-weight:800;letter-spacing:2px">PRICING LADDER</div>'
      +'<table style="width:100%;border-collapse:collapse">'
      +'<tr style="background:#f7fafc"><th style="padding:5px 10px;font-size:7px;color:#94a3b0;font-weight:800;text-align:left;letter-spacing:1.5px">QTY</th><th style="padding:5px 10px;font-size:7px;color:#94a3b0;font-weight:800;text-align:right;letter-spacing:1.5px">PRICE/UNIT</th><th style="padding:5px 10px;font-size:7px;color:#94a3b0;font-weight:800;text-align:right;letter-spacing:1.5px">TOTAL</th></tr>'
      +ladderRows+'</table></div>':'')

    +'</div>' // /Confirmed Order section

    // ═══ PRODUCTION TIMELINE (unique to SO) ═══
    +'<div style="padding:14px 24px;border-top:1px solid #e8ecf0">'
    +'<div style="font-size:8px;color:#00BCD4;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Order Lifecycle</div>'
    +'<div style="display:flex;justify-content:space-between;position:relative">'
    +'<div style="position:absolute;top:11px;left:8%;right:8%;height:2px;background:#e8ecf0;z-index:0"></div>'
    +stages.map(function(s){
      var bg=s.done?'#16a34a':'#e8ecf0';
      var color=s.done?'#fff':'#94a3b0';
      return '<div style="flex:1;text-align:center;position:relative;z-index:1">'
        +'<div style="width:22px;height:22px;border-radius:50%;background:'+bg+';color:'+color+';display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;border:2px solid #fff">'+(s.done?'✓':'○')+'</div>'
        +'<div style="font-size:7px;color:'+(s.done?'#16a34a':'#94a3b0')+';font-weight:700;margin-top:3px;text-transform:uppercase;letter-spacing:.5px">'+s.l+'</div>'
        +(s.done&&s.at?'<div style="font-size:6px;color:#94a3b0;margin-top:1px">'+_fD(s.at)+'</div>':'')
        +'</div>';
    }).join('')
    +'</div></div>'

    // ═══ INSTRUCTIONS + DEPOSIT (side by side) ═══
    +(so.poInstructions||so.depositRequired?'<div style="display:flex;gap:0;border-top:1px solid #e8ecf0">'
      +(so.poInstructions?'<div style="flex:2;padding:12px 24px;background:#fff8e1;border-right:1px solid #e8ecf0">'
        +'<div style="font-size:7px;color:#f57f17;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">⚠ Special Instructions</div>'
        +'<div style="font-size:10px;color:#333;line-height:1.5;font-weight:500">'+esc(so.poInstructions)+'</div></div>':'')
      +(so.depositRequired?'<div style="flex:1;padding:12px 24px;background:#fef3c7">'
        +'<div style="font-size:7px;color:#92400e;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Deposit Required</div>'
        +'<div style="font-size:14px;color:#92400e;font-weight:900">'+_f$(so.depositAmount||0)+'</div>'
        +(so.depositStatus?'<div style="font-size:8px;color:#78350f;font-weight:700;margin-top:2px;text-transform:uppercase">Status: '+esc(so.depositStatus)+'</div>':'')
        +'</div>':'')
      +'</div>':'')

    // ═══ APPROVAL & SIGNATURES ═══
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid #e8ecf0">'
    // CEO Approval block
    +'<div style="padding:14px 24px;border-right:1px solid #e8ecf0;background:'+(so.approvedBy?'#f0fdf4':'#fafcfd')+'">'
    +'<div style="font-size:7px;color:#16a34a;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Authorized By (Microflex)</div>'
    +(so.approvedBy?'<div style="font-size:11px;color:#0a2030;font-weight:800">'+esc(so.approvedBy)+'</div>'
      +'<div style="font-size:9px;color:#16a34a;margin-top:2px;font-weight:700">✓ APPROVED '+_fD(so.approvedAt)+'</div>'
      :'<div style="font-size:10px;color:#94a3b0;font-style:italic">Pending CEO approval</div>'
      +'<div style="border-bottom:1.5px solid #cbd5e1;margin-top:18px;width:70%"></div>'
      +'<div style="font-size:6px;color:#94a3b0;margin-top:2px">Signature</div>')
    +'</div>'
    // Client signature block
    +'<div style="padding:14px 24px;background:'+(so.clientSignature?'#f0fdf4':'#fafcfd')+'">'
    +'<div style="font-size:7px;color:#00BCD4;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Client Acknowledgement</div>'
    +(so.clientSignature?'<div style="font-size:11px;color:#0a2030;font-weight:800">'+esc(so.clientSignature)+'</div>'
      +'<div style="font-size:9px;color:#16a34a;margin-top:2px;font-weight:700">✓ SIGNED '+_fD(so.clientSignedAt)+'</div>'
      :'<div style="font-size:10px;color:#94a3b0;font-style:italic">Awaiting client signature</div>'
      +'<div style="border-bottom:1.5px solid #cbd5e1;margin-top:18px;width:70%"></div>'
      +'<div style="font-size:6px;color:#94a3b0;margin-top:2px">Signature · Date</div>')
    +'</div>'
    +'</div>'

    // ═══ TERMS FOOTER ═══
    +'<div style="padding:10px 24px;background:#f7fafc;border-top:1px solid #e8ecf0">'
    +'<div style="font-size:6px;color:#94a3b0;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Terms & Conditions</div>'
    +'<div style="font-size:7px;color:#64748b;line-height:1.6">'
    +'This Sales Order confirms production commitment upon CEO approval and client signature. '
    +'Payment terms: '+esc(so.payTerms||'Net 30')+'. '
    +'Standard industry overrun/underrun tolerance of ±10% applies. '
    +'Production begins after deposit (if required), approved art files, and final specs are received. '
    +'Changes after approval may incur additional charges and delay delivery. '
    +'All materials remain Microflex property until payment in full is received.'
    +'</div></div>'

    // ═══ BOTTOM NAVY BAR ═══
    +'<div style="padding:6px 24px;background:#0a2e3e;text-align:center">'
    +'<span style="font-size:7px;color:#00e5ff;font-weight:700;letter-spacing:2px">Microflex Film Corporation</span>'
    +'<span style="font-size:7px;color:#0a5a6a;margin:0 8px">│</span>'
    +'<span style="font-size:7px;color:#7ec6d1">4130 Garner Rd, Riverside CA 92501</span>'
    +'<span style="font-size:7px;color:#0a5a6a;margin:0 8px">│</span>'
    +'<span style="font-size:7px;color:#7ec6d1">(909) 360-9066</span>'
    +'<span style="font-size:7px;color:#0a5a6a;margin:0 8px">│</span>'
    +'<span style="font-size:7px;color:#00e5ff;font-weight:700">MicroflexFilm.com</span>'
    +'</div>'

    +'</div>';
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
          var dMeta={name:pdf.filename,mimeType:'application/pdf',parents:[folderId]};
          var dForm=new FormData();
          dForm.append('metadata',new Blob([JSON.stringify(dMeta)],{type:'application/json'}));
          dForm.append('file',pdf.blob);
          fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{
            method:'POST',headers:{'Authorization':'Bearer '+token},body:dForm
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
// ─── Portal Messages — staff viewer + reply ───
var _portalMsgUnsub=null;
function openPortalMessages(quoteId){
  if(!quoteId||typeof fbDb==='undefined')return;
  var q=null;
  if(typeof DB!=='undefined'&&DB.quotes){q=DB.quotes().find(function(qq){return qq.id===quoteId})}
  var qNum=q?q.quoteNum:quoteId;
  var co=q&&q.fields?q.fields.custCo:'Client';

  var h='<div class="modal-title" style="display:flex;justify-content:space-between;align-items:center">';
  h+='<span>Portal Messages — '+esc(qNum)+'</span>';
  h+='<a href="https://os.microflexfilm.com/portal?q='+esc(qNum)+'" target="_blank" style="font-size:10px;color:var(--ac);text-decoration:none">Open Portal ↗</a></div>';
  h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">'+esc(co)+'</div>';
  h+='<div id="pmThread" style="max-height:340px;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--bg3);border-radius:8px;min-height:80px">';
  h+='<div style="text-align:center;font-size:10px;color:var(--tx3);padding:20px">Loading messages...</div></div>';
  h+='<div style="display:flex;gap:6px"><input id="pmInput" type="text" placeholder="Reply to client..." style="flex:1;background:var(--bg);border:1px solid var(--bdr);border-radius:6px;padding:8px 12px;color:var(--tx);font-size:12px;outline:none" onkeydown="if(event.key===\'Enter\')sendStaffPortalMsg(\''+quoteId+'\')">';
  h+='<button class="btn btn-pr" onclick="sendStaffPortalMsg(\''+quoteId+'\')" style="white-space:nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send</button></div>';

  openModal(h);

  // Real-time listener
  if(_portalMsgUnsub)_portalMsgUnsub();
  _portalMsgUnsub=fbDb.collection('quotes').doc(quoteId).collection('portalMessages').orderBy('timestamp','asc').onSnapshot(function(snap){
    var el=document.getElementById('pmThread');if(!el)return;
    if(!snap.docs.length){el.innerHTML='<div style="text-align:center;font-size:10px;color:var(--tx3);padding:20px">No messages yet — send one to start the conversation</div>';return}
    el.innerHTML='';
    snap.docs.forEach(function(doc){
      var m=doc.data();
      var isClient=m.from==='client';
      var align=isClient?'flex-start':'flex-end';
      var bg=isClient?'rgba(255,255,255,.05)':'rgba(0,229,255,.1)';
      var border=isClient?'1px solid rgba(255,255,255,.08)':'1px solid rgba(0,229,255,.2)';
      var label=isClient?'Client':'MFX Staff';
      var ts=m.timestamp&&m.timestamp.toDate?m.timestamp.toDate().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
      var d=document.createElement('div');
      d.style.cssText='align-self:'+align+';max-width:80%;background:'+bg+';border:'+border+';border-radius:8px;padding:8px 12px';
      d.innerHTML='<div style="font-size:9px;color:var(--tx3);margin-bottom:2px"><b style="color:'+(isClient?'#fb923c':'#00e5ff')+'">'+esc(m.name)+'</b> · '+label+' · '+ts+'</div><div style="font-size:12px;color:var(--tx);line-height:1.5">'+esc(m.text)+'</div>';
      el.appendChild(d);
    });
    el.scrollTop=el.scrollHeight;
  },function(err){
    var el=document.getElementById('pmThread');
    if(el)el.innerHTML='<div style="text-align:center;font-size:10px;color:var(--rd);padding:20px">Error loading messages: '+err.message+'</div>';
  });
}

function sendStaffPortalMsg(quoteId){
  var input=document.getElementById('pmInput');
  if(!input||!input.value.trim()||!quoteId)return;
  var text=input.value.trim();
  input.value='';
  input.disabled=true;
  fbDb.collection('quotes').doc(quoteId).collection('portalMessages').add({
    text:text,
    name:getUserName(),
    from:'mfx',
    timestamp:firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    input.disabled=false;
    input.focus();
  }).catch(function(e){
    toast('Send failed: '+e.message,'err');
    input.disabled=false;
    input.value=text;
  });
}

// Clean up listener when modal closes
var _origCloseModal=window.closeModal;
if(typeof _origCloseModal==='function'){
  window.closeModal=function(){
    if(_portalMsgUnsub){_portalMsgUnsub();_portalMsgUnsub=null}
    _origCloseModal();
  };
}

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
window.previewSOPDF=previewSOPDF;
window.downloadSOPDF=downloadSOPDF;
window.buildSOPrintHTML=buildSOPrintHTML;
window.openSOSendFlow=openSOSendFlow;
window.executeSendSO=executeSendSO;
window.soSendStep=soSendStep;
window.soPrintPreview=soPrintPreview;
window.loadSendPDFPreview=loadSendPDFPreview;
window.saveSOTplOverrideFromUI=saveSOTplOverrideFromUI;
window.resetSOTplFromUI=resetSOTplFromUI;
window._updateSOTplPreviewFromFields=_updateSOTplPreviewFromFields;
window._loadTemplateIntoFields=_loadTemplateIntoFields;
window._interpolateTemplate=_interpolateTemplate;
window.loadSOTemplateOverrides=loadSOTemplateOverrides;
window.saveSOTemplateOverride=saveSOTemplateOverride;
window.resetSOTemplateOverride=resetSOTemplateOverride;
window.openPortalMessages=openPortalMessages;
window.sendStaffPortalMsg=sendStaffPortalMsg;
window.fD=fD;

// ─── Init on load ───
if(typeof fbDb!=='undefined'){
  setTimeout(startSOListeners,1000);
}
setTimeout(initAutoSOCreation,1500);

})();
