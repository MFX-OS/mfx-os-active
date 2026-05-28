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

// ─── SO Self-Heal ──────────────────────────────────────────────────
// 2026-05-27: SOs created before the round-2 autoCreateSO fix were
// populated with q.qtys[idx] (plain numbers) instead of pricing rows
// from q.pricedQtys. Result: so.selectedQty/total/ppu are undefined/0
// and so.allQtys is an array of numbers, not {qty,ppu,total} objects.
// Every preview surface (preview modal, send flow, PDF, email body)
// then renders zeros. This helper detects that shape, looks up the
// linked quote, derives the correct pricing, mutates the SO in place,
// and persists the patch so the next read sees clean data.
function _soPricingIsBroken(so){
  if(!so)return false;
  // selectedQty missing, total missing, or allQtys is array of plain numbers
  if(!so.selectedQty || !so.total)return true;
  if(Array.isArray(so.allQtys) && so.allQtys.length){
    var first=so.allQtys[0];
    if(typeof first === 'number')return true; // legacy plain-number array
    if(first && typeof first === 'object' && !('qty' in first) && !('total' in first))return true;
  }
  return false;
}

function _findQuoteForSO(so){
  // Try in-memory quotes first (staff app keeps them loaded), then Firestore.
  var quotes=(typeof DB!=='undefined' && DB.quotes) ? DB.quotes() : [];
  var q=null;
  if(so.quoteId) q=quotes.find(function(x){return x.id===so.quoteId});
  if(!q && so.quoteNum) q=quotes.find(function(x){return x.quoteNum===so.quoteNum});
  if(q) return Promise.resolve(q);
  // Fall back to Firestore
  if(so.quoteId && typeof fbDb !== 'undefined'){
    return fbDb.collection('quotes').doc(so.quoteId).get().then(function(doc){
      if(doc.exists) return Object.assign({id:doc.id}, doc.data());
      return null;
    }).catch(function(){return null});
  }
  return Promise.resolve(null);
}

function hydrateSOFromQuote(so){
  if(!so || !_soPricingIsBroken(so))return Promise.resolve(so);
  return _findQuoteForSO(so).then(function(q){
    if(!q){
      console.warn('[SO heal] could not find quote for',so.soNum||so.id);
      return so;
    }
    var selIdx=q.poQtyIndex||so.selectedQtyIndex||0;
    var skuCount=q.poSkuCount||so.skuCount||1;
    var pricedQtys=q.pricedQtys||[];
    var newAllQtys=pricedQtys.map(function(pr){
      var c=pr && pr.skus ? pr.skus[skuCount] : null;
      return {qty:(pr&&pr.qty)||0, ppu:(c&&c.ppu)||0, total:(c&&c.tot)||0};
    });
    var sel={qty:q.poSelectedQty||0, ppu:0, total:q.poSelectedTotal||0};
    if(pricedQtys[selIdx]){
      var c=pricedQtys[selIdx].skus && pricedQtys[selIdx].skus[skuCount];
      sel={
        qty:pricedQtys[selIdx].qty || q.poSelectedQty || 0,
        ppu:(c&&c.ppu) || 0,
        total:(c&&c.tot) || q.poSelectedTotal || 0
      };
    }
    // Mutate in place so caller sees fresh data
    so.allQtys=newAllQtys;
    so.selectedQtyIndex=selIdx;
    so.selectedQty=sel.qty;
    so.skuCount=skuCount;
    so.ppu=sel.ppu;
    so.total=sel.total || so.total || 0;
    // Persist (best-effort — don't block the caller on the write)
    if(typeof fbDb !== 'undefined'){
      fbDb.collection('salesOrders').doc(so.id).set({
        allQtys:so.allQtys, selectedQtyIndex:so.selectedQtyIndex,
        selectedQty:so.selectedQty, skuCount:so.skuCount,
        ppu:so.ppu, total:so.total, updatedAt:new Date().toISOString()
      },{merge:true}).then(function(){
        console.log('[SO heal] '+so.soNum+' pricing rehydrated from quote '+q.quoteNum);
      }).catch(function(e){console.warn('[SO heal] save failed:',e.message)});
    }
    return so;
  });
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
    // Include id= so the portal does a direct doc GET; without it the portal
    // falls back to where('quoteNum','==',…) which Firestore's list rule
    // can't satisfy for portal clients (the rule requires an email WHERE).
    var portalLink='https://os.microflexfilm.com/portal?id='+encodeURIComponent(q.id||'')+'&q='+encodeURIComponent(q.quoteNum||q.id||'');

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
    // Messages button removed 2026-05-27 — client comms moved to email.
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
// Approval is now the trigger that creates the Google Doc signing surface,
// shares it with the client, sends the branded confirmation email, and
// auto-advances the SO to 'sent'. All of that happens server-side via
// /api/transitionStatus so the role gate + side effects are enforced.
function approveSO(soId){
  var profile=getMFXProfile();
  var allowedRoles=['ceo','admin','administrator','owner','operations manager'];
  var userRole=(profile.role||'').toLowerCase();
  if(!allowedRoles.includes(userRole)){
    toast('Unauthorized — CEO or admin role required','err');return;
  }

  var so=getSO(soId);if(!so)return;
  var totalStr=so.total?(' for $'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})):'';
  if(!confirm('Approve Sales Order '+so.soNum+totalStr+'?\n\nClient: '+(so.company||'?')+'\nPO#: '+(so.poNumber||'—')+'\n\nApproving will:\n  • Create the Google Doc for client signature\n  • Email the client with the sign link (BCC team@/quotes@)\n  • Mark the SO as Sent\n\nLogged with your name. Continue?'))return;

  toast('Approving — creating Doc + emailing client…','ok');
  var payload={collection:'salesOrders',docId:so.id,newStatus:'approved',machine:'salesOrders'};
  var apiP=(typeof MFX_API!=='undefined'&&MFX_API.postJSON)
    ? MFX_API.postJSON('/api/transitionStatus',payload)
    : fetch('/api/transitionStatus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json()});

  apiP.then(function(resp){
    if(!resp||resp.error){
      toast('Approval failed: '+(resp&&resp.error?resp.error:'unknown'),'err');
      return;
    }
    // Server auto-advances 'approved' → 'sent' on success, so reflect that
    // in local cache so the UI matches without a full refetch.
    so.status='sent';
    so.approvedBy=getUserName();
    so.approvedAt=new Date().toISOString();
    so.sentAt=new Date().toISOString();
    so.sentTo=so.email;
    so.notes=so.notes||[];
    so.notes.push({text:'✅ Approved by '+getUserName()+' — Doc + email auto-sent',by:getUserName(),at:new Date().toISOString()});
    toast(so.soNum+' approved and sent to '+so.email,'ok');
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.approved',so.soNum+' CEO approved & sent');
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.approved',{soId:so.id,soNum:so.soNum,company:so.company});
    renderOrdersView();
  }).catch(function(e){
    toast('Approval failed: '+(e.message||e),'err');
  });
}

// ─── SO Detail View ───
function openSODetail(soId){
  var so=getSO(soId);if(!so)return;
  // Self-heal broken pricing before rendering. Fast no-op when data is clean.
  // hydrateSOFromQuote mutates `so` in place, so just await and render — no
  // recursion (which would loop forever if heal couldn't find a quote).
  if(_soPricingIsBroken(so)){
    hydrateSOFromQuote(so).then(function(){_renderSODetail(so)}).catch(function(){_renderSODetail(so)});
    return;
  }
  _renderSODetail(so);
}
function _renderSODetail(so){
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
  hydrateSOFromQuote(so).then(function(){
  return generateSOPDF(so);
  }).then(function(pdf){
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
  // Heal pricing if this SO predates the autoCreateSO fix, then render.
  hydrateSOFromQuote(so).then(function(){
    loadSOTemplateOverrides().finally(function(){_renderSOSendFlow(so)});
  });
}

function _renderSOSendFlow(so){
  var h='<div class="modal-title">📋 Sales Order Workspace — '+esc(so.soNum)+'</div>';
  h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:14px">'+esc(so.company)+' · '+esc(so.email)+' · '+esc(so.jobDesc)+'</div>';

  // ─── Drive Save Location card ──────────────────────────────────────
  // 2026-05-27 round 46: shows where the SO PDF lives on the shared
  // drive (master + per-client). Auto-saved by saveSOPDFToDrive when
  // the SO is generated. Regenerate button rebuilds the PDF.
  var _hasMaster=!!so.driveLink;
  var _hasClient=!!so.clientFolderLink;
  h+='<div style="background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(34,197,94,.02));border:1px solid '+(_hasMaster?'rgba(34,197,94,.4)':'rgba(255,255,255,.08)')+';border-radius:8px;padding:10px 12px;margin-bottom:12px">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:'+(_hasMaster?'8px':'0')+'">';
  h+='<div style="font-size:9px;color:'+(_hasMaster?'#22c55e':'var(--tx3)')+';font-weight:800;letter-spacing:1.5px">📁 PDF ON DRIVE'+(_hasMaster?' · ✓ SAVED':' · NOT YET SAVED')+'</div>';
  h+='<button class="btn btn-ghost btn-xs" onclick="regenerateSOPDF(\''+so.id+'\')" style="white-space:nowrap">'+(_hasMaster?'↻ Regenerate':'⬆ Save Now')+'</button>';
  h+='</div>';
  if(_hasMaster){
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">';
    h+='<a href="'+esc(so.driveLink)+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:4px;color:var(--tx);text-decoration:none"><span>📄</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">MFX-CORE / Master Sales Orders / '+esc(so.soNum||'')+'.pdf</span></a>';
    if(_hasClient)h+='<a href="'+esc(so.clientFolderLink)+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:4px;color:var(--tx);text-decoration:none"><span>📁</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Clients / '+esc(so.company||'')+' / '+esc(so.quoteNum||'')+'</span></a>';
    h+='</div>';
  }
  h+='</div>';

  // ─── Signature Timeline strip ──────────────────────────────────────
  // Mirrors the portal timeline (round 44/45): 3 stages with date+who.
  (function(){
    var _stages = [
      {label:'REQUEST SENT', at:so.clientSignRequestSentAt||so.signatureFlowStartedAt, by:so.signatureFlowStartedBy||'Microflex'},
      {label:'CLIENT SIGNED', at:so.clientSignedAt, by:so.clientSignature},
      {label:'CSR CONFIRMED', at:so.csrConfirmedAt, by:so.csrConfirmedBy}
    ];
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:10px 12px;margin-bottom:12px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:800;letter-spacing:1.5px;margin-bottom:8px">SIGNATURE TIMELINE</div>';
    h+='<div style="display:flex;gap:6px">';
    _stages.forEach(function(s){
      var done=!!s.at;
      h+='<div style="flex:1;background:'+(done?'rgba(34,197,94,.06)':'var(--bg2)')+';border:1px solid '+(done?'rgba(34,197,94,.3)':'var(--bdr)')+';border-radius:5px;padding:6px 8px;text-align:center">';
      h+='<div style="font-size:13px;color:'+(done?'#22c55e':'var(--tx3)')+';line-height:1">'+(done?'✓':'○')+'</div>';
      h+='<div style="font-size:7px;color:'+(done?'#22c55e':'var(--tx3)')+';font-weight:800;letter-spacing:.5px;margin-top:3px">'+s.label+'</div>';
      h+='<div style="font-size:8px;color:'+(done?'var(--tx)':'var(--tx3)')+';margin-top:2px;line-height:1.2;min-height:18px">'+(done?(s.at?fD(s.at):'')+(s.by?'<br>'+esc(s.by):''):'pending')+'</div>';
      h+='</div>';
    });
    h+='</div></div>';
  })();

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
  // ─── From / To dropdowns (2026-05-27 round 46) ────────────────────
  // From defaults to flex@ (or whatever SO_FROM_MAILBOX is set to) but
  // staff can override to quotes@/info@ or any "Send mail as" alias on
  // their Gmail account. To defaults to the SO's stored client email
  // and offers a few sensible swaps.
  var _sendAs = (typeof window!=='undefined' && Array.isArray(window.MFX_SEND_AS) && window.MFX_SEND_AS.length)
    ? window.MFX_SEND_AS
    : ['flex@microflexfilm.com','quotes@microflexfilm.com','info@microflexfilm.com'];
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
  // From
  h+='<div><label style="display:block;font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:4px">FROM</label>';
  h+='<select id="soTplFrom" style="width:100%;padding:9px;background:var(--inp);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:12px">';
  _sendAs.forEach(function(addr,i){
    h+='<option value="'+esc(addr)+'"'+(i===0?' selected':'')+'>'+esc(addr)+'</option>';
  });
  h+='</select></div>';
  // To
  h+='<div><label style="display:block;font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:4px">TO</label>';
  h+='<select id="soTplTo" style="width:100%;padding:9px;background:var(--inp);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:12px">';
  if(so.email)h+='<option value="'+esc(so.email)+'" selected>'+esc(so.email)+' (client)</option>';
  if(so.contact && so.email)h+='<option value="'+esc(so.email)+'">'+esc(so.contact)+' &lt;'+esc(so.email)+'&gt;</option>';
  h+='<option value="team@microflexfilm.com">team@microflexfilm.com (internal only)</option>';
  h+='<option value="quotes@microflexfilm.com">quotes@microflexfilm.com</option>';
  h+='<option value="__custom__">Custom email…</option>';
  h+='</select>';
  h+='<input id="soTplToCustom" type="text" placeholder="Type custom email" style="display:none;width:100%;padding:9px;margin-top:6px;background:var(--inp);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:12px">';
  // Wire the custom toggle inline
  h+='<script>(function(){var s=document.getElementById(\'soTplTo\');var c=document.getElementById(\'soTplToCustom\');if(s&&c)s.addEventListener(\'change\',function(){c.style.display=this.value===\'__custom__\'?\'block\':\'none\';if(this.value===\'__custom__\')c.focus()})})()</script>';
  h+='</div>';
  h+='</div>';

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

// Show the SO preview using buildSOPrintHTML directly in an iframe via
// srcdoc — bypasses html2canvas which hangs on cross-origin QR images
// and CDN font race conditions. The actual PDF is still generated at
// send time by generateSOPDF (called by executeSendSO). Use the
// "🔄 Regenerate as PDF" button to force the heavy PDF render here
// for double-checking — falls back to HTML preview on failure.
//
// Third argument is the container element id — defaults to the modal's
// soPdfFrameWrap, but the quote-editor "SO Preview" tab (app.js) passes
// 'soEditorPdfWrap' / 'shipPdfWrap' for its inline panes. Without this
// the editor panes were stuck on "Loading PDF…" forever.
function loadSendPDFPreview(soId,forceRegen,containerId){
  var so=getSO(soId);if(!so)return;
  var wrapId=containerId||'soPdfFrameWrap';
  var wrap=document.getElementById(wrapId);
  if(!wrap)return;

  // Fast path: HTML preview (default). No canvas, no PDF round-trip.
  if(!forceRegen){
    try{
      var html=buildSOPrintHTML(so);
      // Wrap with body styles so the SO content renders cleanly inside an iframe
      var doc='<!DOCTYPE html><html><head><meta charset="utf-8">'
        +'<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;700;900&display=swap" rel="stylesheet">'
        +'<style>body{margin:0;padding:20px;background:#f5f7f9;font-family:Outfit,Arial,sans-serif}</style>'
        +'</head><body>'+html+'</body></html>';
      wrap.innerHTML='<iframe srcdoc="'+doc.replace(/"/g,'&quot;')+'" style="width:100%;height:100%;border:none;background:#fff"></iframe>';
      return;
    }catch(e){
      wrap.innerHTML='<div style="color:#dc2626;font-size:11px;padding:20px">Preview error: '+esc(e.message||String(e))+'</div>';
      return;
    }
  }

  // Slow path: actually render the PDF (only on explicit Regenerate click)
  if(window._soPdfPreviewUrl&&window._soPdfPreviewSoId===soId){
    wrap.innerHTML='<iframe src="'+window._soPdfPreviewUrl+'" style="width:100%;height:100%;border:none"></iframe>';
    return;
  }
  wrap.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px"><div style="width:32px;height:32px;border:3px solid var(--bdr);border-top-color:var(--ac);border-radius:50%;animation:spin 1s linear infinite"></div><div style="font-size:11px;color:var(--tx3)">Rendering actual PDF (this can take 10–20s)…</div></div>';
  // 30s timeout — if html2canvas hangs we surface an error instead of leaving spinner
  var timeoutId=setTimeout(function(){
    var w=document.getElementById(wrapId);
    if(w&&w.querySelector('div'))w.innerHTML='<div style="color:#dc2626;font-size:11px;padding:20px">PDF generation timed out after 30s. The HTML preview above shows what will be sent — click "Send" to proceed; the PDF will be generated server-side then.</div>';
  },30000);
  generateSOPDF(so).then(function(pdf){
    clearTimeout(timeoutId);
    if(window._soPdfPreviewUrl){try{URL.revokeObjectURL(window._soPdfPreviewUrl)}catch(e){}}
    window._soPdfPreviewUrl=URL.createObjectURL(pdf.blob);
    window._soPdfPreviewSoId=soId;
    var wrap2=document.getElementById(wrapId);
    if(wrap2)wrap2.innerHTML='<iframe src="'+window._soPdfPreviewUrl+'" style="width:100%;height:100%;border:none"></iframe>';
  }).catch(function(e){
    clearTimeout(timeoutId);
    var wrap2=document.getElementById(wrapId);
    if(wrap2)wrap2.innerHTML='<div style="color:#dc2626;font-size:11px;padding:20px">PDF render failed: '+esc(e.message||String(e))+'. The HTML preview still works — click Send.</div>';
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
  // 2026-05-27 round 46: From/To dropdowns. Fall back to defaults if
  // the modal isn't open or the inputs aren't present.
  var fromEl=document.getElementById('soTplFrom');
  var toEl=document.getElementById('soTplTo');
  var toCustomEl=document.getElementById('soTplToCustom');
  var fromAddr=fromEl?fromEl.value:'flex@microflexfilm.com';
  var toAddr=so.email;
  if(toEl){
    if(toEl.value==='__custom__' && toCustomEl && toCustomEl.value.trim())toAddr=toCustomEl.value.trim();
    else if(toEl.value)toAddr=toEl.value;
  }
  if(!toAddr)return toast('No recipient — set the "To" dropdown','err');

  closeModal();
  toast('Generating PDF & sending '+tpl.label+' to '+toAddr+'...','ok');

  // Generate real PDF first
  generateSOPDF(so).then(function(pdf){
    // Prefer edited UI values; fall back to template defaults
    var subj=editedSubjRaw?_interpolateTemplate(editedSubjRaw,so):tpl.subject(so);
    var emailHTML=editedBodyRaw?_interpolateTemplate(editedBodyRaw,so):tpl.build(so);

    getGoogleToken().then(function(token){
      if(!token)return toast('Sign out & back in for Google access','err');

      // 1. Send email — BCC team@/quotes@ so internal stays in the loop
      // (matches the Quote BCC fix shipped earlier). Reply-To routes
      // client replies to quotes@ instead of the staffer's personal inbox.
      var raw='Content-Type: text/html; charset=utf-8\r\n'
        +'From: MFX OS <'+fromAddr+'>\r\n'
        +'To: '+toAddr+'\r\n'
        +'Bcc: team@microflexfilm.com, quotes@microflexfilm.com\r\n'
        +'Reply-To: quotes@microflexfilm.com\r\n'
        +'Subject: '+subj+'\r\n'
        +'MIME-Version: 1.0\r\n\r\n'+emailHTML;
      var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

      fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
        method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({raw:encoded})
      }).then(function(r){return r.json()}).then(function(data){
        if(!data.id){toast('Email error','err');return}

        // 2. Save PDF to Drive via server (Master Sales Orders + Clients/Co/QuoteNum)
        // Reading blob as base64 → POST to /api/saveSalesOrderPDF. Server uses
        // service-account Drive creds, so success doesn't depend on the staffer's
        // OAuth Drive scope. SO doc gets driveLink + clientFolderLink set there.
        var reader=new FileReader();
        reader.onloadend=function(){
          var b64=(reader.result||'').toString().split(',')[1]||'';
          var payload={soId:so.id,soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,filename:pdf.filename,pdfBase64:b64};
          var p=(typeof MFX_API!=='undefined'&&MFX_API.postJSON)
            ? MFX_API.postJSON('/api/saveSalesOrderPDF',payload)
            : fetch('/api/saveSalesOrderPDF',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json()});
          p.then(function(resp){
            var link=resp&&resp.success?(resp.masterLink||resp.clientLink):null;
            if(!link)console.warn('saveSalesOrderPDF returned no link:',resp);
            finalizeSO(so,link,tpl.key);
          }).catch(function(e){
            console.warn('saveSalesOrderPDF failed:',e);
            finalizeSO(so,null,tpl.key);
          });
        };
        reader.onerror=function(){
          console.warn('PDF blob read failed');
          finalizeSO(so,null,tpl.key);
        };
        reader.readAsDataURL(pdf.blob);
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
  // 2026-05-27 rebuild — old layout rendered a 3-row qty/$/total ladder
  // that showed all zeros for SOs created before the autoCreateSO fix
  // (allQtys was plain numbers, not {qty,ppu,total} objects). Customer
  // saw "0 / $0.0000 / $0.00" rows. Replaced with:
  //   - single confirmed Order Summary card (qty + PPU + total)
  //   - Shipping / Production status pills that flip to "Pending"
  //     until artwork is approved (matches the staff editor's Order
  //     Status & Pricing card from round 5)
  //   - cleaner client/order details split
  // Sign + portal CTA preserved.
  so=so||{};
  var _n=function(v){var n=Number(v);return isFinite(n)?n:0};
  var _fN=function(v){return _n(v).toLocaleString()};
  var _f$=function(v){return '$'+_n(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})};
  var _fD=function(d){try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch(e){return ''}};

  var artApproved=!!(so.artworkApproved || so.artApprovedAt || so.proofApprovedAt);
  var shipLabel = artApproved ? 'SCHEDULING' : 'PENDING';
  var shipDesc  = artApproved
    ? 'Carrier and ship date being confirmed.'
    : 'Carrier and ship date confirmed after artwork approval.';
  var prodLabel = artApproved ? 'IN QUEUE' : 'PENDING';
  var prodDesc  = artApproved
    ? 'Standard lead time begins from artwork sign-off.'
    : 'Production begins once your artwork proof is approved.';
  var statusColor = artApproved ? '#22c55e' : '#f59e0b';

  // Pricing — use confirmed values; derive PPU when missing
  var confQty = _n(so.selectedQty);
  var confTotal = _n(so.total);
  var confPPU = _n(so.ppu) || (confQty ? confTotal/confQty : 0);

  return '<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14">'

    // Accent bar + brand header
    +'<tr><td style="height:3px;background:#00e5ff;font-size:0">&nbsp;</td></tr>'
    +'<tr><td style="padding:18px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:26px;font-weight:900;color:#e0f2fe;letter-spacing:-.5px">Microflex</div><div style="width:70px;height:2px;background:#00e5ff;margin:5px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr>'

    // Section header strip
    +'<tr><td style="padding:6px 24px;background:#0a2e3e;text-align:center;font-size:8px;color:#00e5ff;letter-spacing:3px;font-weight:700;border-bottom:1px solid #0f1d2b">◆ SALES ORDER CONFIRMATION ◆</td></tr>'

    // SO identity (number + quote/PO refs)
    +'<tr><td style="padding:22px 24px 8px"><div style="font-size:22px;font-weight:900;color:#e0f2fe;letter-spacing:-.3px">'+esc(so.soNum||'—')+'</div><div style="font-size:11px;color:#64748b;margin-top:4px">Quote: <b style="color:#94a3b8">'+esc(so.quoteNum||'—')+'</b> · PO# <b style="color:#94a3b8">'+esc(so.poNumber||'—')+'</b>'+(so.poSignature?' · Signed by '+esc(so.poSignature):'')+'</div></td></tr>'

    // Friendly opener
    +'<tr><td style="padding:12px 24px;font-size:14px;color:#94a3b8;line-height:1.55">Hi'+(so.contact?' '+esc(String(so.contact).split(/\s+/)[0]):'')+',<br><br>Thanks for your order. We\'ve received PO# <b style="color:#e0f2fe">'+esc(so.poNumber||'—')+'</b> and your sales order is now in our system. Here\'s a confirmation of what we\'re building.</td></tr>'

    // Order summary card — single confirmed total, no zero ladder
    +'<tr><td style="padding:8px 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a2d40;border-radius:8px;border-collapse:separate;overflow:hidden">'
    +  '<tr><td style="padding:12px 16px;background:#0a1a28;border-bottom:1px solid #1a2d40"><div style="font-size:9px;color:#00e5ff;letter-spacing:2px;font-weight:700">ORDER SUMMARY</div></td></tr>'
    +  '<tr><td style="padding:14px 16px;font-size:14px;color:#e0f2fe;font-weight:700;border-bottom:1px solid #1a2d40;line-height:1.4">'+esc(so.jobDesc||'—')+'</td></tr>'
    +  '<tr><td style="padding:0">'
    +    '<table width="100%" cellpadding="0" cellspacing="0">'
    +      '<tr>'
    +        '<td style="padding:14px 16px;width:33%;border-right:1px solid #1a2d40"><div style="font-size:8px;color:#64748b;letter-spacing:1.5px;font-weight:700">QUANTITY</div><div style="font-size:22px;font-weight:900;color:#e0f2fe;margin-top:4px">'+_fN(confQty)+'</div></td>'
    +        '<td style="padding:14px 16px;width:33%;border-right:1px solid #1a2d40"><div style="font-size:8px;color:#64748b;letter-spacing:1.5px;font-weight:700">UNIT PRICE</div><div style="font-size:16px;font-weight:800;color:#e0f2fe;margin-top:6px">$'+confPPU.toFixed(4)+'</div></td>'
    +        '<td style="padding:14px 16px;width:33%;background:#0a2e3e"><div style="font-size:8px;color:#00e5ff;letter-spacing:1.5px;font-weight:700">ORDER TOTAL</div><div style="font-size:18px;font-weight:900;color:#00e5ff;margin-top:4px">'+_f$(confTotal)+'</div></td>'
    +      '</tr>'
    +    '</table>'
    +  '</td></tr>'
    +'</table></td></tr>'

    // Status pills row — Shipping / Production / Terms
    +'<tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr>'
    +  '<td style="padding:0 4px 0 0;width:50%;vertical-align:top"><div style="border:1px solid #1a2d40;border-left:3px solid '+statusColor+';border-radius:6px;padding:10px 12px;background:#0a1520"><div style="display:block"><span style="font-size:8px;color:#64748b;letter-spacing:1.5px;font-weight:700">SHIPPING</span><span style="float:right;background:'+statusColor+'22;color:'+statusColor+';font-size:8px;font-weight:800;letter-spacing:1px;padding:2px 7px;border-radius:3px">'+shipLabel+'</span></div><div style="font-size:11px;color:#94a3b8;line-height:1.45;margin-top:6px;clear:both">'+shipDesc+'</div></div></td>'
    +  '<td style="padding:0 0 0 4px;width:50%;vertical-align:top"><div style="border:1px solid #1a2d40;border-left:3px solid '+statusColor+';border-radius:6px;padding:10px 12px;background:#0a1520"><div style="display:block"><span style="font-size:8px;color:#64748b;letter-spacing:1.5px;font-weight:700">PRODUCTION TIME</span><span style="float:right;background:'+statusColor+'22;color:'+statusColor+';font-size:8px;font-weight:800;letter-spacing:1px;padding:2px 7px;border-radius:3px">'+prodLabel+'</span></div><div style="font-size:11px;color:#94a3b8;line-height:1.45;margin-top:6px;clear:both">'+prodDesc+'</div></div></td>'
    +'</tr></table></td></tr>'

    // Ship-to + Terms strip
    +'<tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a2d40;border-radius:6px;border-collapse:separate"><tr>'
    +  '<td style="padding:10px 14px;width:50%;border-right:1px solid #1a2d40"><div style="font-size:8px;color:#64748b;letter-spacing:1.5px;font-weight:700">SHIP TO</div><div style="font-size:12px;color:#e0f2fe;font-weight:600;margin-top:3px;line-height:1.4">'+esc(so.shipTo||so.company||'—')+'</div></td>'
    +  '<td style="padding:10px 14px;width:50%"><div style="font-size:8px;color:#64748b;letter-spacing:1.5px;font-weight:700">PAYMENT TERMS</div><div style="font-size:12px;color:#e0f2fe;font-weight:600;margin-top:3px">'+esc(so.payTerms||'Net 30')+'</div></td>'
    +'</tr></table></td></tr>'

    // Next-steps note
    +'<tr><td style="padding:0 24px 16px"><div style="background:#0a1520;border:1px solid #1a2d40;border-radius:6px;padding:12px 14px;font-size:11px;color:#94a3b8;line-height:1.6"><b style="color:#e0f2fe;font-size:9px;letter-spacing:1.5px;display:block;margin-bottom:4px">NEXT STEPS</b>Our pre-press team will send you an artwork proof for approval. Once you sign off, production schedules the run and shipping confirms the carrier and ETA.</div></td></tr>'

    // Portal CTA
    +'<tr><td style="padding:14px 24px 20px;text-align:center"><a href="https://os.microflexfilm.com/portal?id='+encodeURIComponent(so.quoteId||'')+'&q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:14px 36px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#00e5ff;color:#060d14;letter-spacing:.5px">View in Client Portal</a><div style="font-size:10px;color:#64748b;margin-top:8px">Sign the sales order and track production status</div></td></tr>'

    // Footer
    +'<tr><td style="padding:14px 24px;background:#0a1520;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b;line-height:1.6"><b style="color:#94a3b8">Microflex Film Corporation</b><br>4130 Garner Rd · Riverside CA 92501 · (909) 360-9066<br><a href="mailto:Orders@MicroflexFilm.com" style="color:#00e5ff;text-decoration:none">Orders@MicroflexFilm.com</a> · <a href="https://www.microflexfilm.com" style="color:#00e5ff;text-decoration:none">MicroflexFilm.com</a><br><span style="color:#1e3a4f">SQF Certified · Made in USA</span></td></tr>'
    +'</table>';
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
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?id='+encodeURIComponent(so.quoteId||'')+'&q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#00e5ff;color:#060d14">View in Client Portal</a></td></tr>'
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
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?id='+encodeURIComponent(so.quoteId||'')+'&q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#4ade80;color:#060d14">View in Client Portal</a></td></tr>'
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
    +'<tr><td style="padding:12px 24px;text-align:center"><a href="https://os.microflexfilm.com/portal?id='+encodeURIComponent(so.quoteId||'')+'&q='+encodeURIComponent(so.quoteNum||'')+'" style="display:inline-block;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;background:#c084fc;color:#060d14">View in Client Portal</a></td></tr>'
    +'<tr><td style="padding:12px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com · SQF Certified | Made in USA</td></tr></table>';
}

// ═══════════════════════════════════════
// AUTO-CREATE SO WHEN QUOTE IS WON
// ═══════════════════════════════════════
function initAutoSOCreation(){
  if(typeof MFX==='undefined'||typeof MFX.on!=='function')return;

  // 2026-05-27: Replaced auto-create-on-won with manual "Confirm PO" gate.
  // A client-submitted PO transitions the quote to 'won' via portalSubmitPO,
  // but the SO is NOT generated until a staff member reviews the incoming
  // PO and clicks Confirm in the quote editor. This listener now surfaces a
  // notification so staff knows there's a PO awaiting confirmation; the
  // actual SO creation moved to the 'quote.po_confirmed' listener below.
  MFX.on('quote.status',function(d){
    if(!d||d.status!=='won')return;
    var q=d.quote;if(!q)return;
    if(!q.poNumber)return;
    var existing=_soCache.find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});
    if(existing)return; // SO already exists (legacy auto-created flow)
    if(q.poConfirmedBy)return; // already confirmed (handled by po_confirmed listener)
    console.log('[PO] '+q.quoteNum+' awaiting staff confirmation before SO is generated');
    if(typeof addNotification==='function'){
      addNotification({
        type:'alert',
        title:'New PO — Confirmation Needed',
        body:q.quoteNum+' has a new PO# '+esc(q.poNumber)+' from '+esc((q.fields&&q.fields.custCo)||'?')+'. Open the quote and click Confirm to generate the sales order.',
        sourceView:'editor',
        sourceId:q.id,
        priority:'high'
      });
    }
    if(typeof MFX.emit==='function')MFX.emit('quote.po_awaiting_confirmation',{quote:q});
  });

  // Staff clicks "Confirm PO" → this fires → SO gets generated.
  MFX.on('quote.po_confirmed',function(d){
    if(!d||!d.quote)return;
    var q=d.quote;
    if(!q.poNumber){console.warn('[PO confirm] no PO on '+q.quoteNum);return}
    var existing=_soCache.find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});
    if(existing){console.log('SO already exists for '+q.quoteNum+': '+existing.soNum);return}
    console.log('[PO confirm] generating SO for '+q.quoteNum+' (confirmed by '+(q.poConfirmedBy||'staff')+')');
    autoCreateSO(q);
  });
}

// ─── Staff action: Confirm Incoming PO ──────────────────────────────
// Called from the quote editor's "Confirm PO" banner. Stamps the quote
// with poConfirmedBy + poConfirmedAt, persists, then emits the event
// that triggers SO creation. Idempotent — re-confirming does nothing.
function confirmIncomingPO(quoteId){
  if(!quoteId){toast&&toast('Quote not specified','err');return}
  if(typeof DB==='undefined'||!DB.quotes){toast&&toast('Database unavailable','err');return}
  var all=DB.quotes();
  var q=all.find(function(x){return x.id===quoteId});
  if(!q){toast&&toast('Quote not found','err');return}
  if(!q.poNumber){toast&&toast('No PO submitted yet on this quote','err');return}
  // If an SO already exists, bail — the gate's done its job.
  var existingSO=(typeof _soCache!=='undefined') && _soCache.find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});
  if(existingSO){toast&&toast('Sales Order '+existingSO.soNum+' already exists for this quote','info');return}
  // 2026-05-27 round 46: idempotent. If poConfirmedBy was set but no SO
  // got created (autoCreateSO threw, browser closed mid-flow, etc.),
  // re-clicking just re-triggers SO generation without re-stamping.
  if(!q.poConfirmedBy){
    q.poConfirmedBy = (typeof getUserName==='function')?getUserName():'Staff';
    q.poConfirmedAt = new Date().toISOString();
    q.updatedAt = q.poConfirmedAt;
    if(!q.activityLog)q.activityLog=[];
    q.activityLog.push({action:'po_confirmed', by:q.poConfirmedBy, at:q.poConfirmedAt, detail:'PO# '+q.poNumber+' confirmed — generating sales order'});
    DB.saveQ(all, q.id);
    toast&&toast('PO confirmed — generating sales order…','ok');
  } else {
    toast&&toast('PO already confirmed — retrying SO generation…','ok');
  }
  // Trigger SO generation. MFX.emit fires the listener registered by
  // initAutoSOCreation, which calls autoCreateSO. Direct fallback only
  // when MFX is unavailable (would otherwise double-create the SO).
  if(typeof MFX!=='undefined'&&typeof MFX.emit==='function'){
    MFX.emit('quote.po_confirmed',{quote:q});
  } else if(typeof autoCreateSO==='function'){
    autoCreateSO(q);
  }
  // Re-render editor so the banner disappears
  if(typeof renderEditor==='function')renderEditor();
}

// ─── Staff action: CEO Electronic Signature on SO ──────────────────────
// 2026-05-27: replaces the round-15 auto-approval. After an SO is
// generated (and validation passed), it sits in 'pending' with
// ceoSignNeeded=true until a CEO/management user opens the quote editor
// and types their name into the banner. This function stamps
// ceoSignedAt/By/Signature, flips status to 'approved' + autoApproved=true,
// then fires the existing 'so.auto_approved' event so the auto-send
// (client-side or server-side) does the actual send.
// ─── Send SO for Signatures (staff → Client → CSR chain) ──────────
// 2026-05-27 (rev): simplified chain. CEO sign step removed at the
// user's request — staff "Send for Signatures" goes directly to the
// client. After client signs, CSR confirms hand-off to Production.
//   1. Email goes to client with portal link + PDF link
//   2. signatureFlow → 'awaiting_client', clientSignRequestSentAt stamped
//   3. Client signs in portal → signatureFlow='awaiting_csr'
//   4. CSR opens editor → green banner → "Confirm & Hand Off"
//   5. signatureFlow='in_production' → passport+ticket created,
//      PPD + Logistics notified
function sendSOForSignatures(soId){
  if(!soId||typeof fbDb==='undefined')return toast&&toast('Cannot send — DB unavailable','err');
  var so=getSO(soId);
  if(!so)return toast&&toast('Sales order not found','err');
  if(so.signatureFlow==='awaiting_client' || so.signatureFlow==='awaiting_csr' || so.signatureFlow==='in_production'){
    return toast&&toast('Already sent — currently '+so.signatureFlow,'info');
  }
  // Legacy: SO was started on the old CEO chain (round 21) and is sitting
  // in awaiting_ceo. Advance it straight to awaiting_client so the new
  // simplified flow takes over.
  if(so.signatureFlow==='awaiting_ceo'){
    if(!confirm('This SO was started under the old CEO-signature flow. Skip the CEO step and send directly to the client?'))return;
  }
  if(!so.email)return toast&&toast('SO has no client email — fix the quote first','err');
  if(!so.driveLink){
    if(typeof saveSOPDFToDrive==='function'){
      toast&&toast('Generating PDF first…','ok');
      return saveSOPDFToDrive(so).then(function(){
        var fresh=getSO(soId);
        if(fresh)sendSOForSignatures(soId);
      }).catch(function(e){
        toast&&toast('Cannot send — PDF save failed: '+e.message,'err');
      });
    } else {
      return toast&&toast('Cannot send — no PDF yet. Click "Save PDF Now" first.','err');
    }
  }
  if(!confirm('Send '+so.soNum+' to '+(so.email||'client')+' for signature?\n\n• They receive an email with the PDF + portal link.\n• Once signed, CSR confirms and the order moves into production.\n\nProceed?')){
    return;
  }
  var now=new Date().toISOString();
  var by=typeof getUserName==='function'?getUserName():'Staff';
  var upd={
    signatureFlow:'awaiting_client',
    signatureFlowStartedAt:now,
    signatureFlowStartedBy:by,
    clientSignRequestSentAt:now,
    updatedAt:now,
    updatedBy:by
  };
  var notes=Array.isArray(so.notes)?so.notes.slice():[];
  notes.push({text:'📨 Signature request sent to client ('+(so.email||'?')+'). Awaiting countersignature.',by:by,at:now});
  upd.notes=notes;
  Object.assign(so,upd);
  if(window.setSaveState)window.setSaveState('saving');
  fbDb.collection('salesOrders').doc(soId).update(upd).then(function(){
    if(window.setSaveState)window.setSaveState('saved');
    toast&&toast('Sent — client ('+so.email+') will get the email shortly','ok');
    _sendClientSignRequestEmail(so).catch(function(e){console.warn('[client email] '+e.message)});
    if(typeof fbDb!=='undefined'){
      fbDb.collection('activity').add({
        type:'so.signatureFlow.started',
        soId:so.id,soNum:so.soNum,company:so.company,
        clientEmail:so.email,
        startedBy:by,
        timestamp:firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
    }
    if(typeof renderEditor==='function')renderEditor();
    if(typeof renderOrdersView==='function')renderOrdersView();
    if(typeof renderWorkflow==='function')renderWorkflow();
  }).catch(function(e){
    if(window.setSaveState)window.setSaveState('error');
    toast&&toast('Send failed: '+e.message,'err');
    console.error('[sendSOForSignatures]',e);
  });
}
window.sendSOForSignatures=sendSOForSignatures;

// Best-effort client-side Gmail send of the CEO sign request. Falls
// back silently if the user doesn't have Gmail OAuth (e.g., they're
// not logged in as a Workspace staff user). Server-side flex@ sender
// can be added later via a new Cloud Function trigger.
function _sendCEOSignRequestEmail(so){
  if(typeof getGoogleToken!=='function')return Promise.reject(new Error('Gmail not available'));
  return getGoogleToken().then(function(token){
    if(!token)throw new Error('No Gmail token');
    var editorUrl='https://os.microflexfilm.com/?editQuote='+encodeURIComponent(so.quoteId||'');
    var ceoEmail=so.ceoSignRequestSentTo||'flex@microflexfilm.com';
    var subj='Sign Required: Sales Order '+so.soNum+' — '+so.company;
    var body=[
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a1a28;color:#e0f2fe;padding:0">',
        '<div style="padding:20px 24px;background:#060d14;border-bottom:1px solid #1a2d40">',
          '<div style="font-size:22px;font-weight:900">Microflex</div>',
          '<div style="font-size:10px;color:#00e5ff;letter-spacing:2px;margin-top:4px">CEO SIGNATURE REQUIRED</div>',
        '</div>',
        '<div style="padding:24px;line-height:1.6">',
          '<p style="font-size:14px;color:#e0f2fe">A new Sales Order is ready for your electronic signature.</p>',
          '<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px">',
            '<tr><td style="padding:8px 0;color:#64748b;width:130px">Sales Order</td><td style="color:#e0f2fe;font-weight:700">',so.soNum,'</td></tr>',
            '<tr><td style="padding:8px 0;color:#64748b">Customer</td><td style="color:#e0f2fe">',so.company||'',' · PO# ',(so.poNumber||'—'),'</td></tr>',
            '<tr><td style="padding:8px 0;color:#64748b">Total</td><td style="color:#00e5ff;font-weight:700">$',Number(so.total||0).toLocaleString(undefined,{minimumFractionDigits:2}),'</td></tr>',
          '</table>',
          '<p><a href="',so.driveLink||'#','" target="_blank" style="display:inline-block;padding:10px 22px;background:#0a2e3e;color:#00e5ff;font-weight:700;border-radius:5px;text-decoration:none;font-size:12px;margin-right:8px">📄 Review PDF</a>',
          '<a href="',editorUrl,'" target="_blank" style="display:inline-block;padding:10px 22px;background:#00e5ff;color:#060d14;font-weight:800;border-radius:5px;text-decoration:none;font-size:12px">✍ Open & Sign</a></p>',
          '<p style="font-size:11px;color:#64748b;margin-top:18px">After you sign, the customer will automatically receive the SO with a countersignature request. Once they sign, CSR can confirm hand-off to Production.</p>',
        '</div>',
      '</div>'
    ].join('');
    var raw='Content-Type:text/html;charset=utf-8\r\nFrom:MFX OS <flex@microflexfilm.com>\r\nTo:'+ceoEmail+'\r\nSubject:'+subj+'\r\nMIME-Version:1.0\r\n\r\n'+body;
    var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:encoded})}).then(function(r){return r.json()}).then(function(d){
      if(d.id){toast&&toast('CEO sign request emailed ✓','ok');return d}
      throw new Error((d.error&&d.error.message)||'Gmail send failed');
    });
  });
}

function signSOAsCEO(soId, typedName){
  if(!soId||typeof fbDb==='undefined')return toast&&toast('Cannot sign — DB unavailable','err');
  var name=String(typedName||'').trim();
  if(!name)return toast&&toast('Type your name to sign','err');
  if(!confirm('Sign Sales Order as CEO?\n\nThis approves the order and sends it to the customer for their signature. You can\'t undo this without contacting them.')){
    return;
  }
  var sos=typeof getSalesOrders==='function'?getSalesOrders():[];
  var so=sos.find(function(x){return x.id===soId});
  if(!so)return toast&&toast('Sales order not found','err');
  if(so.ceoSignedAt)return toast&&toast('Already signed by '+so.ceoSignedBy,'info');
  var now=new Date().toISOString();
  var by=typeof getUserName==='function'?getUserName():'CEO';
  var upd={
    ceoSignedAt:now,
    ceoSignedBy:by,
    ceoSignature:name,
    ceoSignNeeded:false,
    // Status moves: pending → approved on CEO sign. autoApproved stays
    // false here — we use signatureFlow for routing, not autoApproved.
    status:'approved',
    approvedAt:now,
    approvedBy:by,
    // Advance the multi-step signature chain to the client half.
    signatureFlow:'awaiting_client',
    clientSignRequestSentAt:now,
    updatedAt:now,
    updatedBy:by
  };
  var notes=Array.isArray(so.notes)?so.notes.slice():[];
  notes.push({text:'✍ CEO ('+by+') signed as "'+name+'" — sending countersignature request to client ('+(so.email||'?')+').',by:by,at:now});
  upd.notes=notes;
  Object.assign(so, upd);
  if(window.setSaveState)window.setSaveState('saving');
  fbDb.collection('salesOrders').doc(soId).update(upd).then(function(){
    if(window.setSaveState)window.setSaveState('saved');
    toast&&toast('SO '+so.soNum+' signed by CEO — sending to client for countersignature','ok');
    // Send the client a countersignature request email (best-effort,
    // client-side Gmail). Server-side autoSendSOOnApproval still fires
    // as backup when DwD is configured.
    _sendClientSignRequestEmail(so).catch(function(e){console.warn('[client email] '+e.message)});
    if(typeof fbDb!=='undefined'){
      fbDb.collection('activity').add({
        type:'so.ceo_signed',
        soId:so.id,soNum:so.soNum,company:so.company,
        signedBy:by,signature:name,
        timestamp:firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
    }
    if(typeof renderEditor==='function')renderEditor();
    if(typeof renderOrdersView==='function')renderOrdersView();
    if(typeof renderWorkflow==='function')renderWorkflow();
  }).catch(function(e){
    if(window.setSaveState)window.setSaveState('error');
    toast&&toast('Sign failed: '+e.message,'err');
    console.error('[signSOAsCEO]',e);
  });
}
window.signSOAsCEO=signSOAsCEO;

// ─── CSR Confirmation — client has signed, hand off to production ───
// 2026-05-27: final step of the signature chain. After CSR confirms,
// the autoCreateProductionRecordsOnSign Firestore trigger sees both
// csrConfirmedAt set and creates the Job Passport + Job Ticket. PPD +
// Logistics notifications also fire from the trigger.
function confirmSOAsCSR(soId){
  if(!soId||typeof fbDb==='undefined')return toast&&toast('Cannot confirm — DB unavailable','err');
  var so=getSO(soId);
  if(!so)return toast&&toast('Sales order not found','err');
  if(so.csrConfirmedAt)return toast&&toast('Already confirmed by '+(so.csrConfirmedBy||'CSR'),'info');
  if(!so.clientSignedAt)return toast&&toast('Client hasn\'t signed yet — cannot confirm','err');
  if(!confirm('Confirm '+so.soNum+' and hand off to Production?\n\nThis will:\n• Generate the Job Passport + Job Ticket\n• Notify Pre-Press + Logistics teams\n• Lock the SO into production status')){
    return;
  }
  var now=new Date().toISOString();
  var by=typeof getUserName==='function'?getUserName():'CSR';
  var upd={
    csrConfirmedAt:now,
    csrConfirmedBy:by,
    signatureFlow:'in_production',
    status:'completed',
    updatedAt:now,
    updatedBy:by
  };
  var notes=Array.isArray(so.notes)?so.notes.slice():[];
  notes.push({text:'✓ CSR ('+by+') confirmed all signatures complete. Handing off to Production — Job Passport + Ticket auto-creating, PPD + Logistics notified.',by:by,at:now});
  upd.notes=notes;
  Object.assign(so,upd);
  if(window.setSaveState)window.setSaveState('saving');
  fbDb.collection('salesOrders').doc(soId).update(upd).then(function(){
    if(window.setSaveState)window.setSaveState('saved');
    toast&&toast('SO '+so.soNum+' confirmed — Production records being generated','ok');
    if(typeof fbDb!=='undefined'){
      fbDb.collection('activity').add({
        type:'so.csr_confirmed',
        soId:so.id,soNum:so.soNum,company:so.company,
        confirmedBy:by,
        timestamp:firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
    }
    if(typeof renderEditor==='function')renderEditor();
    if(typeof renderOrdersView==='function')renderOrdersView();
    if(typeof renderWorkflow==='function')renderWorkflow();
  }).catch(function(e){
    if(window.setSaveState)window.setSaveState('error');
    toast&&toast('Confirm failed: '+e.message,'err');
    console.error('[confirmSOAsCSR]',e);
  });
}
window.confirmSOAsCSR=confirmSOAsCSR;

// Email the client a countersignature request with portal link.
function _sendClientSignRequestEmail(so){
  if(typeof getGoogleToken!=='function')return Promise.reject(new Error('Gmail not available'));
  return getGoogleToken().then(function(token){
    if(!token)throw new Error('No Gmail token');
    var portalUrl='https://os.microflexfilm.com/portal?id='+encodeURIComponent(so.quoteId||'')+'&q='+encodeURIComponent(so.quoteNum||'');
    var subj='Countersignature Required: Sales Order '+so.soNum+' — '+so.company;
    var body=[
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#0a2030">',
        '<div style="padding:18px 24px;background:#0a1929;color:#fff">',
          '<div style="font-size:22px;font-weight:900">Microflex</div>',
          '<div style="font-size:10px;color:#00e5ff;letter-spacing:2px;margin-top:4px">SALES ORDER · YOUR SIGNATURE NEEDED</div>',
        '</div>',
        '<div style="padding:24px;line-height:1.6;font-size:13px">',
          '<p>Hello ',(so.contact||'there'),',</p>',
          '<p>Your Sales Order <strong>',so.soNum,'</strong> has been signed by Microflex and is now ready for your countersignature.</p>',
          '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:14px 0">',
            '<tr><td style="padding:6px 0;color:#64748b;width:130px">Order</td><td><strong>',so.soNum,'</strong> · PO# ',(so.poNumber||'—'),'</td></tr>',
            '<tr><td style="padding:6px 0;color:#64748b">Job</td><td>',(so.jobDesc||'—'),'</td></tr>',
            '<tr><td style="padding:6px 0;color:#64748b">Quantity</td><td>',Number(so.selectedQty||0).toLocaleString(),'</td></tr>',
            '<tr><td style="padding:6px 0;color:#64748b">Total</td><td style="font-weight:700">$',Number(so.total||0).toLocaleString(undefined,{minimumFractionDigits:2}),'</td></tr>',
          '</table>',
          '<p style="text-align:center;margin:20px 0">',
            '<a href="',portalUrl,'" style="display:inline-block;padding:12px 30px;background:#00b4d8;color:#fff;font-weight:700;border-radius:5px;text-decoration:none">Review & Sign in Portal</a>',
          '</p>',
          (so.driveLink?'<p style="text-align:center;margin:10px 0"><a href="'+so.driveLink+'" style="color:#00b4d8;font-size:11px">📄 Download Sales Order PDF</a></p>':''),
          '<p style="color:#64748b;font-size:11px;margin-top:20px">Once you sign, our CSR team will confirm and move your order into production. Questions? Reply to this email or contact <a href="mailto:quotes@microflexfilm.com">quotes@microflexfilm.com</a>.</p>',
        '</div>',
      '</div>'
    ].join('');
    var raw='Content-Type:text/html;charset=utf-8\r\nFrom:MFX OS <flex@microflexfilm.com>\r\nTo:'+so.email+'\r\nBcc:team@microflexfilm.com,quotes@microflexfilm.com\r\nReply-To:quotes@microflexfilm.com\r\nSubject:'+subj+'\r\nMIME-Version:1.0\r\n\r\n'+body;
    var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:encoded})}).then(function(r){return r.json()}).then(function(d){
      if(d.id){
        toast&&toast('Client countersignature request sent ✓','ok');
        // Stamp sentAt + sentTo on the SO so the server-side trigger
        // sees it as already dispatched and doesn't double-send.
        if(typeof fbDb!=='undefined'){
          fbDb.collection('salesOrders').doc(so.id).update({
            sentAt:new Date().toISOString(),
            sentTo:so.email,
            updatedAt:new Date().toISOString()
          }).catch(function(){});
        }
        return d;
      }
      throw new Error((d.error&&d.error.message)||'Gmail send failed');
    });
  });
}

// ─── Auto-send when an SO passes validation + auto-approval ──────────
// 2026-05-27: SOs that pass autoCreateSO's validation gate emit
// 'so.auto_approved'. Here we run the standard send-to-customer flow
// automatically. executeSendSO() reads its inputs (template, subject,
// body) from the send modal's DOM and Gmail OAuth from the active staff
// session — so we open the modal first, give it a moment to render, then
// click Send programmatically. If no staff is online or the Gmail token
// is stale, the modal sits open ready for a one-click manual confirm.
// (Full hands-free send when nobody is signed in would need a Cloud
// Function trigger — left as a follow-up.)
// ─── Save SO PDF to Drive (Master Sales Orders + client folder) ───────
// 2026-05-27: previously only fired when staff manually clicked Send in
// the modal. Now also fires automatically right after autoCreateSO
// auto-signs the SO as Moises — so so.driveLink is populated within
// seconds of generation, even if no one ever opens the send modal.
// Server endpoint /api/saveSalesOrderPDF stores in MFX-CORE/Master Sales
// Orders/<SO#>.pdf and a copy in MFX-CORE/Clients/<Co>/<Quote#>/. Returns
// masterLink + clientFolderLink which we stamp on the SO doc.
function saveSOPDFToDrive(so){
  if(!so||!so.id||!so.soNum)return Promise.reject(new Error('SO id/soNum required'));
  if(typeof generateSOPDF!=='function')return Promise.reject(new Error('generateSOPDF not loaded'));
  return hydrateSOFromQuote(so).then(function(){
    return generateSOPDF(so);
  }).then(function(pdf){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onerror=function(){reject(new Error('PDF blob read failed'))};
      reader.onloadend=function(){
        var b64=(reader.result||'').toString().split(',')[1]||'';
        var payload={soId:so.id,soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,filename:pdf.filename,pdfBase64:b64};
        var doPost=(typeof MFX_API!=='undefined'&&MFX_API.postJSON)
          ? MFX_API.postJSON('/api/saveSalesOrderPDF',payload)
          : fetch('/api/saveSalesOrderPDF',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json()});
        doPost.then(function(resp){
          if(resp && resp.success){
            // Update local cache so the editor's SO tab shows the link immediately
            var cached=_soCache.find(function(x){return x.id===so.id});
            if(cached){
              cached.driveLink=resp.masterLink||cached.driveLink;
              cached.clientFolderLink=resp.clientLink||cached.clientFolderLink;
            }
            console.log('[saveSOPDFToDrive] '+so.soNum+' saved · master='+(resp.masterLink||'-')+' client='+(resp.clientLink||'-'));
            resolve(resp);
          } else {
            reject(new Error((resp&&resp.error)||'saveSalesOrderPDF returned no link'));
          }
        }).catch(reject);
      };
      reader.readAsDataURL(pdf.blob);
    });
  });
}
window.saveSOPDFToDrive=saveSOPDFToDrive;

// Convenience wrapper used by the SO tab regenerate button. Resolves
// the SO from cache by id, then runs save + toasts + re-renders the
// editor so the freshly-stamped driveLink shows immediately.
function regenerateSOPDF(soId){
  var so=getSO(soId);
  if(!so){toast&&toast('SO not found','err');return}
  toast&&toast('Generating PDF & saving to Master Sales Orders…','ok');
  saveSOPDFToDrive(so).then(function(){
    toast&&toast('PDF saved to Master Sales Orders ✓','ok');
    if(typeof renderEditor==='function')renderEditor();
    if(typeof renderOrdersView==='function')renderOrdersView();
    if(typeof renderWorkflow==='function')renderWorkflow();
  }).catch(function(e){
    console.error('[regenerateSOPDF]',e);
    toast&&toast('PDF save failed: '+(e.message||e),'err');
  });
}
window.regenerateSOPDF=regenerateSOPDF;

function initSOAutoSendListener(){
  if(typeof MFX==='undefined'||typeof MFX.on!=='function')return;
  MFX.on('so.auto_approved',function(d){
    if(!d||!d.so)return;
    var so=d.so;

    // 2026-05-27: kick off PDF generation + Drive save IMMEDIATELY on
    // auto-sign, regardless of whether the staff modal is going to open.
    // This makes so.driveLink available within ~5-10 seconds of SO
    // generation. The Gmail send (separate flow below) will pick up the
    // same so once driveLink is set, so the email has a real PDF ref.
    try{
      saveSOPDFToDrive(so).then(function(){
        toast&&toast('SO '+so.soNum+' PDF saved to Master Sales Orders ✓','ok');
        // Re-render any open editor / orders view so the new driveLink shows
        if(typeof renderEditor==='function' && typeof S!=='undefined' && S.editId===so.quoteId)renderEditor();
        if(typeof renderOrdersView==='function')renderOrdersView();
        if(typeof renderWorkflow==='function')renderWorkflow();
      }).catch(function(e){
        console.warn('[saveSOPDFToDrive auto] '+so.soNum+' failed:',e.message);
        toast&&toast('PDF save failed for '+so.soNum+' — '+e.message,'err');
      });
    }catch(e){
      console.warn('[saveSOPDFToDrive auto] threw:',e.message);
    }
    // 2026-05-27: server-side autoSendSOOnApproval trigger now races with
    // this client-side path. Whichever stamps sentAt first wins; the other
    // should bow out. We give the server a small head-start window since
    // its trigger fires within ~1s of the Firestore write, before this
    // listener runs (we're triggered from MFX events on the local app).
    // If sentAt or serverAutoSendAt is already set, skip and toast.
    var refresh=function(){
      if(typeof fbDb==='undefined')return Promise.resolve(so);
      return fbDb.collection('salesOrders').doc(so.id).get().then(function(snap){
        var fresh=snap.exists?Object.assign({id:snap.id},snap.data()):so;
        // Reflect the fresh state into the cached SO so renderers stay in sync
        var cached=_soCache.find(function(x){return x.id===so.id});
        if(cached)Object.assign(cached,fresh);
        return fresh;
      }).catch(function(){return so});
    };
    refresh().then(function(fresh){
      if(fresh.sentAt){
        try{toast('SO '+fresh.soNum+' already sent — '+(fresh.serverAutoSendStatus==='sent'?'server delivered':'client delivered'),'ok')}catch(_){}
        console.log('[SO auto-send] '+fresh.soNum+' already has sentAt — skipping client send');
        if(typeof renderOrdersView==='function')renderOrdersView();
        return;
      }
      if(fresh.serverAutoSendAt && fresh.serverAutoSendStatus==='in_progress'){
        try{toast('Server is sending '+fresh.soNum+' — give it a moment','ok')}catch(_){}
        console.log('[SO auto-send] '+fresh.soNum+' server send in progress — skipping client send');
        return;
      }
      _runClientAutoSend(fresh);
    });
  });
}

// Pulled out so the wait-for-fresh-state logic above stays readable.
function _runClientAutoSend(so){
  try{toast('Auto-send queued for '+so.soNum+' — opening send flow','ok')}catch(_){}
    // Open the send flow modal — this hydrates the SO, loads template
    // overrides, and renders the template selector + subject/body editors.
    if(typeof openSOSendFlow==='function'){
      try{openSOSendFlow(so.id)}catch(e){console.warn('[SO auto-send] openSOSendFlow:',e.message);return}
    } else {
      console.warn('[SO auto-send] openSOSendFlow not available — staff must send manually');
      return;
    }
    // Wait for the modal + PDF preview pipeline to settle, then click
    // the Send button. 1500ms covers SO_TEMPLATES load + DOM render.
    setTimeout(function(){
      // Find the modal's Send button — search by onclick text since the
      // modal builds button HTML inline without a stable id.
      var modal=document.querySelector('.modal') || document.getElementById('modalContent');
      if(!modal){console.warn('[SO auto-send] no modal found');return}
      var btns=modal.querySelectorAll('button');
      var sendBtn=null;
      for(var i=0;i<btns.length;i++){
        var onclick=btns[i].getAttribute('onclick')||'';
        if(onclick.indexOf('executeSendSO')>=0){sendBtn=btns[i];break}
      }
      if(sendBtn){
        console.log('[SO auto-send] firing Send for '+so.soNum);
        sendBtn.click();
      } else {
        console.warn('[SO auto-send] Send button not found — staff must click manually');
        try{toast('SO '+so.soNum+' is ready — click Send to dispatch','ok')}catch(_){}
      }
    },1500);
}

async function autoCreateSO(q){
  var f=q.fields||{};
  if(!f.custCo||!f.custCo.trim())return;
  var selIdx=q.poQtyIndex||0;
  var skuCount=q.poSkuCount||1;
  // q.qtys is a plain array of quantity numbers; pricing lives in q.pricedQtys
  // as [{qty:N, skus:{1:{tot,ppu}, 2:{tot,ppu}, ...}}, ...]. The portal also
  // stores the client's final selection on the quote as poSelectedQty /
  // poSelectedTotal — use those as the authoritative source for the selected
  // row, and derive the priced grid for the email body from pricedQtys.
  var selRow={qty:0,ppu:0,total:0};
  if(q.pricedQtys&&q.pricedQtys[selIdx]){
    var _pr=q.pricedQtys[selIdx];
    var _cell=_pr.skus&&_pr.skus[skuCount];
    selRow={qty:_pr.qty||q.poSelectedQty||0,ppu:(_cell&&_cell.ppu)||0,total:(_cell&&_cell.tot)||q.poSelectedTotal||0};
  } else {
    selRow={qty:q.poSelectedQty||0,ppu:0,total:q.poSelectedTotal||0};
  }
  var allQtysForEmail=(q.pricedQtys||[]).map(function(pr){
    var c=pr&&pr.skus?pr.skus[skuCount]:null;
    return {qty:pr&&pr.qty||0,ppu:(c&&c.ppu)||0,total:(c&&c.tot)||0};
  });

  var soId='so_'+Date.now();
  var soNum;
  try{soNum=await genSONUM()}catch(e){soNum=genSONUMLocal()}

  // ─── Validation + multi-step signature flow ─────────────────────────
  // 2026-05-27 (round 40 rev): NO auto-sign anymore. SO is created in
  // 'pending' status with signatureFlow='ready_to_send'. Staff explicitly
  // clicks "Send for Signatures" to start the chain:
  //   ready_to_send → awaiting_ceo → awaiting_client → awaiting_csr
  //   → in_production (passport + ticket created, PPD/Logistics notified)
  // Validation result is still recorded so a "fields missing" banner can
  // surface if anything's incomplete; doesn't block creation.
  var _custEmail=String(f.custEmail||q.poClientEmail||'').trim().toLowerCase();
  var _emailValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_custEmail);
  var _validation={
    hasCompany: !!(f.custCo && f.custCo.trim()),
    hasEmail: _emailValid,
    hasPO: !!(q.poNumber && q.poSignature),
    hasTotal: !!(selRow.total || q.poSelectedTotal),
    hasShipTo: !!(q.poShipTo || f.cityState)
  };
  var _validationPassed = Object.keys(_validation).every(function(k){return _validation[k]});

  var so={
    id:soId,
    soNum:soNum,
    quoteId:q.id,
    quoteNum:q.quoteNum,
    quoteRev:q.rev,
    // All SOs start 'pending'. Status only moves to 'approved' after CEO
    // electronically signs, then 'sent' once client signature request
    // mails, then 'completed' once CSR confirms hand-off.
    status: 'pending',
    autoApproved: false,
    autoApprovalChecks: _validation,
    signatureFlow: _validationPassed ? 'ready_to_send' : 'pending',
    signatureFlowStartedAt: null,
    signatureFlowStartedBy: null,
    // CEO half — set by signSOAsCEO() once staff sends the request and
    // CEO opens the editor + clicks the cyan signing banner.
    ceoSignRequestSentAt: null,
    ceoSignRequestSentTo: null,
    ceoSignNeeded: false,
    ceoSignedAt: null,
    ceoSignedBy: null,
    ceoSignature: null,
    // Client half — clientSignRequestSentAt stamped when CEO sign
    // triggers the auto-email; clientSignedAt by the portal sign form.
    clientSignRequestSentAt: null,
    clientSignedAt: null,
    clientSignature: null,
    clientApproved: false,
    // CSR confirmation — blocks production handoff (passport + ticket
    // creation) until a CSR explicitly confirms the SO is good to go.
    csrConfirmedAt: null,
    csrConfirmedBy: null,
    // Production notifications — stamped by the post-CSR trigger.
    ppdNotifiedAt: null,
    logisticsNotifiedAt: null,

    company:f.custCo||'',
    contact:f.custAttn||'',
    // Lowercased — portal SO list query uses where('email','==', authToken.email)
    // which is exact-case. Firebase Auth normalizes tokens to lowercase, so the
    // stored value must also be lowercase or the SO won't surface in the portal.
    email:String(f.custEmail||q.poClientEmail||'').trim().toLowerCase(),
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
    selectedQty:selRow.qty||q.poSelectedQty||0,
    skuCount:skuCount,
    ppu:selRow.ppu||0,
    total:selRow.total||q.poSelectedTotal||0,
    // Email body iterates over allQtys expecting {qty,ppu,total} per row.
    // q.qtys is plain numbers — use the priced grid we derived above so the
    // SO confirmation email actually shows real prices instead of $0.0000.
    allQtys:allQtysForEmail.length?allQtysForEmail:(q.qtys||[]).map(function(n){return {qty:n,ppu:0,total:0}}),
    terms:q.terms||[],

    estimator:f.estimator||'',
    payTerms:f.payTerms||'Net 30',

    createdAt:new Date().toISOString(),
    createdBy:'System (Auto)',
    updatedAt:new Date().toISOString(),
    updatedBy:'System (Auto)',
    approvedBy: null,
    approvedAt: null,
    sentAt:null,
    sentTo:null,
    driveLink:null,
    notes:[{
      text: _validationPassed
        ? '📋 Auto-created from '+q.quoteNum+' (Won with PO# '+q.poNumber+'). Ready for signatures — staff click "Send for Signatures" to dispatch to CEO.'
        : '📋 Auto-created from '+q.quoteNum+' (Won with PO# '+q.poNumber+'). Cannot start signature flow — fix missing fields first: '+Object.keys(_validation).filter(function(k){return !_validation[k]}).join(', '),
      by:'System',
      at:new Date().toISOString()
    }]
  };

  saveSO(so).then(function(){
    if(_validationPassed){
      toast('SO '+soNum+' generated — click "Send for Signatures" to start the approval chain','ok');
    } else {
      var missing=Object.keys(_validation).filter(function(k){return !_validation[k]});
      toast('SO '+soNum+' created — fix '+missing.join(', ')+' before sending for signatures','err');
    }
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('so.created',soNum+' created from '+q.quoteNum+(_validationPassed?' — ready for signatures':' — fields incomplete'));
    if(typeof MFX!=='undefined'&&MFX.track)MFX.track('so.created',{soId:soId,soNum:soNum,quoteNum:q.quoteNum,company:f.custCo,readyToSend:_validationPassed});
    if(typeof MFX!=='undefined'&&MFX.emit){
      MFX.emit('so.created',{so:so,quote:q,readyToSend:_validationPassed});
    }
    // Auto-save the SO PDF to Master Sales Orders so staff sees the
    // Drive link the moment the SO appears (round 20 wiring). The
    // signature flow then layers on top — staff clicks "Send for
    // Signatures" once they've reviewed the PDF.
    if(typeof saveSOPDFToDrive==='function'){
      saveSOPDFToDrive(so).then(function(){
        if(typeof renderEditor==='function')renderEditor();
        if(typeof renderOrdersView==='function')renderOrdersView();
      }).catch(function(e){console.warn('[autoCreateSO] PDF save deferred:',e.message)});
    }
    // 2026-05-27 round 46: after SO generation, switch to SO tab AND
    // auto-open the SO Workspace modal (preview + email template +
    // To/From dropdowns + Drive save location + signature timeline).
    // That gives staff one place to review and dispatch.
    if(typeof S!=='undefined' && S.editId===q.id){
      S.etab=10;
      if(typeof renderEditor==='function')renderEditor();
      // Give the editor a tick to re-render before the modal opens on top
      setTimeout(function(){
        if(typeof openSOSendFlow==='function')openSOSendFlow(soId);
      }, 300);
    }

    // Always notify CEO — every SO requires electronic signature now.
    if(typeof addNotification==='function'){
      var needsFix = !_validationPassed;
      addNotification({
        type:'alert',
        title:needsFix ? 'SO Needs Fixing Before CEO Sign' : 'Sales Order Awaiting CEO Signature',
        body:soNum+' for '+esc(f.custCo)+' ($'+Number(so.total).toLocaleString(undefined,{minimumFractionDigits:2})+') — '+(needsFix?'missing fields: '+Object.keys(_validation).filter(function(k){return !_validation[k]}).join(', '):'open the quote and sign as CEO to dispatch'),
        sourceView:'editor',
        sourceId:q.id,
        priority:'high'
      });
    }

    S_SO.view='sos';
    if(typeof renderOrdersView==='function')renderOrdersView();
  }).catch(function(e){toast('Auto SO error: '+e.message,'err')});
}

// ═══════════════════════════════════════
// SO PDF GENERATION (matches quote design)
// Hardened against the silent failures we hit in production:
//   - CDN libs are deferred so they may not be loaded yet → poll up to 10s
//   - html2canvas hangs forever on cross-origin <img> tags without CORS
//     headers (api.qrserver.com) → strip external images before render
//   - html2canvas itself has no internal timeout → race against 20s hard
//     cap, clean up the offscreen container regardless of outcome
//   - Every failure path now rejects with a human-readable message that
//     hits the toast / preview error UI
// ═══════════════════════════════════════
function generateSOPDF(so){
  return new Promise(function(resolve,reject){
    if(!so){reject(new Error('No SO provided'));return}

    // 1. Wait for deferred CDN libs (html2canvas + jsPDF) up to 10s
    var libStart=Date.now();
    function libsReady(){
      return typeof html2canvas==='function'
        && typeof jspdf!=='undefined' && jspdf && jspdf.jsPDF;
    }
    function waitForLibs(cb){
      if(libsReady())return cb(null);
      if(Date.now()-libStart>10000)return cb(new Error('PDF libraries (html2canvas / jsPDF) did not load within 10s. Hard refresh the page and try again.'));
      setTimeout(function(){waitForLibs(cb)},200);
    }

    waitForLibs(function(libErr){
      if(libErr)return reject(libErr);

      // 2. Build the SO HTML, strip cross-origin <img> tags that would
      //    hang html2canvas. Inline SVGs (barcodes/QR via qrcode-generator
      //    lib) survive — only api.qrserver.com fallback gets removed.
      var container=document.createElement('div');
      container.style.cssText='position:fixed;top:-9999px;left:-9999px;width:800px;background:#fff;padding:30px;color:#000;font-family:Arial,sans-serif';
      try{
        var html=buildSOPrintHTML(so);
        var stripped=0;
        html=html.replace(/<img\s+[^>]*src="https?:\/\/[^"]+"[^>]*>/gi,function(){stripped++;return ''});
        if(stripped)console.warn('[generateSOPDF] stripped '+stripped+' external image(s) before render');
        container.innerHTML=html;
        document.body.appendChild(container);
      }catch(buildErr){
        console.error('[generateSOPDF] buildSOPrintHTML threw:',buildErr);
        return reject(new Error('SO content build failed: '+(buildErr.message||buildErr)));
      }

      // 3. Race html2canvas against a 20s hard timeout
      var done=false;
      var cleanup=function(){
        if(container&&container.parentNode){try{container.parentNode.removeChild(container)}catch(_){}}
      };
      var timeoutId=setTimeout(function(){
        if(done)return; done=true;
        cleanup();
        reject(new Error('PDF generation timed out after 20s. The HTML preview still works — use Print Preview instead, or open the SO Doc from Drive.'));
      },20000);

      html2canvas(container,{
        scale:2,
        useCORS:true,
        backgroundColor:'#ffffff',
        logging:false,
        imageTimeout:5000   // never wait more than 5s per image
      }).then(function(canvas){
        if(done)return; done=true;
        clearTimeout(timeoutId);
        cleanup();
        try{
          var imgData=canvas.toDataURL('image/jpeg',0.95);
          var pdf=new jspdf.jsPDF('p','mm','letter');
          var pdfW=pdf.internal.pageSize.getWidth();
          var imgW=pdfW-20;
          var imgH=(canvas.height*imgW)/canvas.width;
          pdf.addImage(imgData,'JPEG',10,10,imgW,imgH);
          var descClean=String(so.jobDesc||'').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/\s+/g,'-').substring(0,60);
          var coClean=String(so.company||'Co').replace(/[^a-zA-Z0-9]/g,'-');
          var filename=(so.soNum||'SO')+'_'+coClean+(descClean?'_'+descClean:'')+'.pdf';
          var pdfBlob=pdf.output('blob');
          var pdfBase64=pdf.output('datauristring').split(',')[1];
          resolve({blob:pdfBlob,base64:pdfBase64,filename:filename});
        }catch(renderErr){
          console.error('[generateSOPDF] jsPDF render failed:',renderErr);
          reject(new Error('PDF assembly failed: '+(renderErr.message||renderErr)));
        }
      }).catch(function(canvasErr){
        if(done)return; done=true;
        clearTimeout(timeoutId);
        cleanup();
        var msg=(canvasErr&&canvasErr.message)?canvasErr.message:String(canvasErr);
        console.error('[generateSOPDF] html2canvas failed:',canvasErr);
        reject(new Error('Canvas render failed: '+msg));
      });
    });
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

  // Secondary pricing ladder — only show rows with real qty data, and only
  // show the ladder at all if there are 2+ meaningful rows. Empty qty
  // arrays from incomplete quotes used to render 5 rows of zeros.
  var ladderRows='';
  if(so.allQtys&&so.allQtys.length){
    var realRows=so.allQtys.filter(function(r){return r&&Number(r.qty)>0});
    if(realRows.length>1){
      so.allQtys.forEach(function(r,i){
        if(!r||!Number(r.qty))return; // skip zero rows
        var sel=i===so.selectedQtyIndex;
        ladderRows+='<tr style="'+(sel?'background:#e0f7fa':'background:#fff')+'">'
          +'<td style="padding:6px 10px;font-size:9px;color:'+(sel?'#00838f':'#555')+';border-bottom:1px solid #e8ecf0;font-weight:'+(sel?'800':'500')+'">'+(sel?'✓ ':'')+_fN(r.qty)+'</td>'
          +'<td style="padding:6px 10px;font-size:9px;text-align:right;border-bottom:1px solid #e8ecf0;color:#555">$'+(r.ppu||0).toFixed(4)+'</td>'
          +'<td style="padding:6px 10px;font-size:9px;text-align:right;border-bottom:1px solid #e8ecf0;font-weight:'+(sel?'800':'500')+';color:'+(sel?'#0a2e3e':'#555')+'">'+_f$(r.total||0)+'</td></tr>';
      });
    }
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

  // Helper for section headers — numbered per SOA spec
  var _section=function(num,title,color){
    color=color||'#00BCD4';
    return '<div style="padding:14px 24px 8px 24px;border-top:1px solid #e8ecf0">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      +'<span style="background:'+color+';color:#fff;font-size:9px;font-weight:900;padding:3px 8px;border-radius:3px;letter-spacing:1px">'+num+'</span>'
      +'<span style="font-size:10px;color:'+color+';font-weight:800;letter-spacing:2px;text-transform:uppercase">'+title+'</span>'
      +'</div></div>';
  };
  // Helper for a labelled cell
  var _field=function(label,value,opts){
    opts=opts||{};
    return '<div style="'+(opts.style||'')+'">'
      +'<div style="font-size:7px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px">'+esc(label)+'</div>'
      +'<div style="font-size:'+(opts.size||10)+'px;font-weight:'+(opts.weight||'700')+';color:#0a2030;line-height:1.4">'+(value==null||value===''?'<span style="color:#cbd5e1;font-weight:500">—</span>':esc(String(value)))+'</div>'
      +'</div>';
  };

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

    // ═══════════════════════════════════════════════════════════════
    // SECTION 1 — CUSTOMER & COMPANY INFORMATION
    // ═══════════════════════════════════════════════════════════════
    +_section('1','Customer & Company Information','#00BCD4')
    // Microflex (printer) + Bill To / Ship To / CSR rep — 4-col grid
    +'<div style="padding:0 24px 12px 24px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">'
    // Printer (Microflex)
    +'<div style="border-left:3px solid #00BCD4;padding-left:10px">'
    +'<div style="font-size:8px;color:#00BCD4;font-weight:800;letter-spacing:1.5px;margin-bottom:4px">PRINTER</div>'
    +'<div style="font-size:11px;font-weight:800;color:#0a2030">Microflex Film Corp.</div>'
    +'<div style="font-size:9px;color:#555;line-height:1.5;margin-top:3px">4130 Garner Rd<br>Riverside, CA 92501</div>'
    +'<div style="font-size:9px;color:#00838f;margin-top:2px">(909) 360-9066</div>'
    +'<div style="font-size:9px;color:#00838f">Orders@MicroflexFilm.com</div>'
    +(so.taxId?'<div style="font-size:8px;color:#94a3b0;margin-top:3px">Tax ID: '+esc(so.taxId)+'</div>':'')
    +'</div>'
    // Bill To
    +'<div style="border-left:3px solid #16a34a;padding-left:10px">'
    +'<div style="font-size:8px;color:#16a34a;font-weight:800;letter-spacing:1.5px;margin-bottom:4px">BILL TO</div>'
    +'<div style="font-size:11px;font-weight:800;color:#0a2030">'+esc(so.company||'—')+'</div>'
    +'<div style="font-size:9px;color:#555;line-height:1.5;margin-top:3px">'+esc(so.contact||'')+'</div>'
    +'<div style="font-size:9px;color:#00838f">'+esc(so.email||'')+'</div>'
    +'<div style="font-size:9px;color:#555">'+esc(so.phone||'')+'</div>'
    +(so.billToAddress?'<div style="font-size:9px;color:#555;margin-top:3px;white-space:pre-wrap">'+esc(so.billToAddress)+'</div>':'')
    +'</div>'
    // Ship To
    +'<div style="border-left:3px solid #ea580c;padding-left:10px">'
    +'<div style="font-size:8px;color:#ea580c;font-weight:800;letter-spacing:1.5px;margin-bottom:4px">SHIP TO</div>'
    +'<div style="font-size:10px;color:#0a2030;font-weight:700;line-height:1.5;white-space:pre-wrap">'+esc(so.shipTo||so.company||'—')+'</div>'
    +'<div style="font-size:8px;color:#94a3b0;margin-top:6px">PO #</div>'
    +'<div style="font-size:11px;font-weight:800;color:#0a2030">'+esc(so.poNumber||'—')+'</div>'
    +'</div>'
    // CSR / Prepress Rep
    +'<div style="border-left:3px solid #a855f7;padding-left:10px">'
    +'<div style="font-size:8px;color:#a855f7;font-weight:800;letter-spacing:1.5px;margin-bottom:4px">CSR / PREPRESS REP</div>'
    +'<div style="font-size:10px;font-weight:700;color:#0a2030">'+esc(so.csrName||so.estimator||'—')+'</div>'
    +(so.csrEmail||so.estimator?'<div style="font-size:9px;color:#00838f;margin-top:2px">'+esc(so.csrEmail||'Orders@MicroflexFilm.com')+'</div>':'')
    +(so.csrPhone?'<div style="font-size:9px;color:#555">'+esc(so.csrPhone)+'</div>':'')
    +(so.salesRep?'<div style="font-size:8px;color:#94a3b0;margin-top:4px">Sales Rep</div><div style="font-size:9px;font-weight:700;color:#0a2030">'+esc(so.salesRep)+'</div>':'')
    +'</div>'
    +'</div>'

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2 — JOB SPECIFICATIONS & TECHNICAL DETAILS
    // ═══════════════════════════════════════════════════════════════
    +_section('2','Job Specifications & Technical Details','#0ea5e9')
    +'<div style="padding:0 24px 12px 24px">'
    // Item & description card
    +'<div style="background:#fff;border:1px solid #e8ecf0;border-left:4px solid #0ea5e9;border-radius:6px;padding:12px 14px;margin-bottom:10px">'
    +'<div style="font-size:7px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px">Item & Description</div>'
    +'<div style="font-size:13px;font-weight:800;color:#0a2030;line-height:1.3">'+esc(so.jobDesc||'—')+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">'
    +(so.sizeA||so.sizeB?'<span style="background:#d9f99d;color:#365314;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">SIZE '+esc(so.sizeA||'?')+'" × '+esc(so.sizeB||'?')+'"</span>':'')
    +(so.shapeType?'<span style="background:#bfdbfe;color:#1e3a8a;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">SHAPE '+esc(so.shapeType)+'</span>':'')
    +(so.colors?'<span style="background:#fde68a;color:#78350f;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">COLORS '+esc(String(so.colors))+'</span>':'')
    +(so.jobType?'<span style="background:#c7d2fe;color:#3730a3;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">'+esc(so.jobType.toUpperCase())+'</span>':'')
    +(so.gauge||so.thickness?'<span style="background:#bae6fd;color:#075985;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">'+esc(so.gauge||so.thickness)+' MIL</span>':'')
    +'</div>'
    +(skuRows?'<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e8ecf0">'+skuRows+'</div>':'')
    +'</div>'
    // Material structure + quantity / overrun
    +'<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px 12px">'
    +'<div style="font-size:7px;color:#c2410c;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">MATERIAL STRUCTURE</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px">'
    +_field('Face Stock',so.face||so.faceStock,{size:10})
    +_field('Lamination',so.laminate||so.lamination,{size:10})
    +_field('Adhesive',so.adhesive,{size:10})
    +_field('Coating',so.coating,{size:10})
    +(so.liner?_field('Liner',so.liner,{size:10}):'')
    +(so.materialStructure?'<div style="grid-column:1/-1">'+_field('Structure',so.materialStructure,{size:10})+'</div>':'')
    +'</div></div>'
    +'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 12px">'
    +'<div style="font-size:7px;color:#15803d;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">QUANTITY & TOLERANCE</div>'
    +'<div style="font-size:18px;font-weight:900;color:#0a2030;line-height:1">'+_fN(confQty)+'</div>'
    +'<div style="font-size:9px;color:#15803d;font-weight:700;margin-top:2px">units ordered</div>'
    +'<div style="font-size:8px;color:#64748b;margin-top:6px">Over/Under-run allowance:</div>'
    +'<div style="font-size:11px;font-weight:800;color:#0a2030">±'+esc(so.overUnderPct||'10')+'% (industry standard)</div>'
    +'</div></div>'
    // Artwork details
    +'<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:10px 12px">'
    +'<div style="font-size:7px;color:#7c3aed;font-weight:800;letter-spacing:1.5px;margin-bottom:6px">ARTWORK DETAILS</div>'
    +'<div style="display:grid;grid-template-columns:2fr 1fr 2fr;gap:8px 14px">'
    +_field('File Name',so.artworkFileName||(so.artFiles&&so.artFiles[0]&&so.artFiles[0].name)||null,{size:10})
    +_field('Version',so.artworkVersion,{size:10})
    +_field('PMS / CMYK Colors',so.pmsColors,{size:10})
    +'</div>'
    +(so.windDir||so.labRoll||so.gussetType||so.zipperType||so.tearNotch?'<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ddd6fe;display:flex;flex-wrap:wrap;gap:4px">'
      +(so.windDir?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">WIND '+esc(so.windDir)+'</span>':'')
      +(so.labRoll?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">'+esc(String(so.labRoll))+'/ROLL</span>':'')
      +(so.gussetType?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">GUSSET '+esc(so.gussetType)+'</span>':'')
      +(so.zipperType?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">ZIPPER '+esc(so.zipperType)+'</span>':'')
      +(so.tearNotch?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">TEAR NOTCH</span>':'')
      +(so.degassingValve?'<span style="background:#e9d5ff;color:#581c87;font-size:8px;font-weight:700;padding:2px 8px;border-radius:3px">DEGAS VALVE</span>':'')
      +'</div>':'')
    +'</div>'
    +'</div>'

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 — PROOFING & SETUP PARAMETERS
    // ═══════════════════════════════════════════════════════════════
    +_section('3','Proofing & Setup Parameters','#f59e0b')
    +'<div style="padding:0 24px 12px 24px">'
    +'<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 14px">'
    +_field('Proofing Type',so.proofingType||'Digital PDF Proof',{size:10})
    +_field('Approval Deadline',so.approvalDeadline?_fD(so.approvalDeadline):null,{size:10})
    +_field('Required In-Hand',so.poRequiredDate?_fD(so.poRequiredDate):null,{size:10})
    +'</div>'
    +'</div>'

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4 — FINANCIALS & PRICING
    // ═══════════════════════════════════════════════════════════════
    +_section('4','Financials & Pricing','#0a2e3e')
    +'<div style="padding:0 24px 14px 24px">'
    // Hero (Qty / PPU / Total)
    +'<div style="display:grid;grid-template-columns:1.2fr 1fr 1.3fr;gap:0;background:#0a2e3e;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(10,46,62,.15)">'
    +'<div style="padding:14px 16px;text-align:center;border-right:1px solid #1a4a5f">'
    +'<div style="font-size:7px;color:#00e5ff;font-weight:800;letter-spacing:2px;margin-bottom:2px">QUANTITY</div>'
    +'<div style="font-size:22px;font-weight:900;color:#fff;line-height:1">'+_fN(confQty)+'</div>'
    +'</div>'
    +'<div style="padding:14px 16px;text-align:center;border-right:1px solid #1a4a5f">'
    +'<div style="font-size:7px;color:#00e5ff;font-weight:800;letter-spacing:2px;margin-bottom:2px">PRICE / UNIT</div>'
    +'<div style="font-size:16px;font-weight:900;color:#fff;line-height:1">$'+(confPPU||0).toFixed(4)+'</div>'
    +'</div>'
    +'<div style="padding:14px 16px;text-align:center;background:linear-gradient(135deg,#00e5ff 0%,#00bcd4 100%)">'
    +'<div style="font-size:7px;color:#0a2e3e;font-weight:800;letter-spacing:2px;margin-bottom:2px">GRAND TOTAL</div>'
    +'<div style="font-size:22px;font-weight:900;color:#0a2e3e;line-height:1">'+_f$(confTotal)+'</div>'
    +(so.payTerms?'<div style="font-size:8px;color:#0a2e3e;margin-top:2px;font-weight:700">'+esc(so.payTerms)+'</div>':'')
    +'</div>'
    +'</div>'
    // Itemized Costs (only if any are set)
    +((so.plateFee||so.dieFee||so.setupFee||so.designCharge||so.taxAmount)?'<div style="margin-top:10px;background:#fff;border:1px solid #e8ecf0;border-radius:6px;overflow:hidden">'
      +'<div style="padding:6px 10px;background:#fafcfd;border-bottom:1px solid #e8ecf0;font-size:7px;color:#94a3b0;font-weight:800;letter-spacing:2px">ITEMIZED COSTS</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:10px">'
      +(so.plateFee?'<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#555">Plates / Tooling</td><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#0a2030;font-weight:700">'+_f$(so.plateFee)+'</td></tr>':'')
      +(so.dieFee?'<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#555">Die / Cutting</td><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#0a2030;font-weight:700">'+_f$(so.dieFee)+'</td></tr>':'')
      +(so.setupFee?'<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#555">Setup / Make-Ready</td><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#0a2030;font-weight:700">'+_f$(so.setupFee)+'</td></tr>':'')
      +(so.designCharge?'<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#555">Design / Art</td><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#0a2030;font-weight:700">'+_f$(so.designCharge)+'</td></tr>':'')
      +(so.taxAmount?'<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#555">Tax</td><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#0a2030;font-weight:700">'+_f$(so.taxAmount)+'</td></tr>':'')
      +'</table></div>':'')
    // Pricing ladder
    +(ladderRows?'<div style="margin-top:10px;background:#fff;border:1px solid #e8ecf0;border-radius:6px;overflow:hidden">'
      +'<div style="padding:6px 10px;background:#fafcfd;border-bottom:1px solid #e8ecf0;font-size:7px;color:#94a3b0;font-weight:800;letter-spacing:2px">PRICING LADDER</div>'
      +'<table style="width:100%;border-collapse:collapse">'
      +'<tr style="background:#f7fafc"><th style="padding:5px 10px;font-size:7px;color:#94a3b0;font-weight:800;text-align:left;letter-spacing:1.5px">QTY</th><th style="padding:5px 10px;font-size:7px;color:#94a3b0;font-weight:800;text-align:right;letter-spacing:1.5px">PRICE/UNIT</th><th style="padding:5px 10px;font-size:7px;color:#94a3b0;font-weight:800;text-align:right;letter-spacing:1.5px">TOTAL</th></tr>'
      +ladderRows+'</table></div>':'')
    // Payment terms strip
    +'<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
    +_field('Payment Terms',so.payTerms||'Net 30',{size:11,style:'background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px'})
    +_field('Deposit Required',so.depositRequired?_f$(so.depositAmount||0):'None',{size:11,style:'background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px'})
    +_field('Preferred Method',so.paymentMethod,{size:11,style:'background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px'})
    +'</div>'
    +'</div>'

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 — FULFILLMENT & LOGISTICS
    // ═══════════════════════════════════════════════════════════════
    +_section('5','Fulfillment & Logistics','#16a34a')
    +'<div style="padding:0 24px 14px 24px">'
    +'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px 14px">'
    +_field('Lead Time',so.leadTimeDays?(so.leadTimeDays+' business days from artwork approval'):'10–15 business days',{size:10})
    +_field('Estimated Ship Date',so.estimatedShipDate?_fD(so.estimatedShipDate):null,{size:10})
    +_field('Shipping Method',so.shippingMethod||so.shippingCarrier,{size:10})
    +_field('FOB Terms',so.fobTerms,{size:10})
    +'</div>'
    +'</div>'

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

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 — TERMS & CONDITIONS · SIGNATURES
    // ═══════════════════════════════════════════════════════════════
    +_section('6','Terms & Conditions','#dc2626')
    // Disclaimer block
    +'<div style="padding:0 24px 12px 24px">'
    +'<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 12px;font-size:9px;color:#7f1d1d;line-height:1.6">'
    +'<strong style="color:#991b1b">This Sales Order is binding</strong> upon CEO approval and client signature, and is governed by Microflex Film Corporation\'s standard Terms & Conditions. '
    +'Payment terms: <strong>'+esc(so.payTerms||'Net 30')+'</strong>. '
    +'Standard industry over/under-run tolerance of <strong>±'+esc(so.overUnderPct||'10')+'%</strong> applies. '
    +'Color variance up to ΔE 3.0 between proof and press is industry-acceptable. '
    +'Production begins after deposit (if required), approved art files, and final specs are received. '
    +'Cancellations after approval are subject to charges for incurred costs. '
    +'Claims must be filed within 30 days of receipt. '
    +'All plates, dies, and tooling remain Microflex property until paid in full. '
    +'Full terms at <span style="text-decoration:underline">MicroflexFilm.com/Terms</span>.'
    +'</div></div>'
    // Signature blocks — 2026-05-27 enhanced to render typed-name italic
    // signatures (matches portal-side render). CEO half pulls from
    // ceoSignedBy/ceoSignature/ceoSignedAt (set by autoCreateSO auto-sign
    // round 16); falls back to approvedBy for legacy SOs. Client half is
    // populated by submitSOApproval() on the portal.
    +(function(){
      var _ceoSigned = !!(so.ceoSignedAt || so.approvedBy);
      var _ceoName   = so.ceoSignedBy   || so.approvedBy || '';
      var _ceoSigTxt = so.ceoSignature  || so.ceoSignedBy || so.approvedBy || '';
      var _ceoDate   = so.ceoSignedAt   || so.approvedAt;
      var _cliSigned = !!so.clientSignedAt;
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid #e8ecf0">'
        // CEO Approval block
        +'<div style="padding:14px 24px;border-right:1px solid #e8ecf0;background:'+(_ceoSigned?'#f0fdf4':'#fafcfd')+'">'
          +'<div style="font-size:7px;color:'+(_ceoSigned?'#16a34a':'#94a3b0')+';font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Authorized By (Microflex)'+(_ceoSigned?' · ✓':'')+'</div>'
          +(_ceoSigned
            ? '<div style="font-size:22px;font-family:Outfit,Georgia,serif;font-style:italic;font-weight:700;color:#0a2030;border-bottom:1.5px solid #16a34a;padding-bottom:3px;line-height:1.2;margin-bottom:4px">'+esc(_ceoSigTxt)+'</div>'
              +'<div style="font-size:10px;color:#0a2030;font-weight:700">'+esc(_ceoName)+'</div>'
              +'<div style="font-size:9px;color:#16a34a;font-weight:700;margin-top:2px">Approved on '+_fD(_ceoDate)+'</div>'
            : '<div style="font-size:10px;color:#94a3b0;font-style:italic">Pending CEO approval</div>'
              +'<div style="border-bottom:1.5px solid #cbd5e1;margin-top:18px;width:70%"></div>'
              +'<div style="font-size:6px;color:#94a3b0;margin-top:2px">Signature · Date</div>')
        +'</div>'
        // Client signature block
        +'<div style="padding:14px 24px;background:'+(_cliSigned?'#f0fdf4':'#fafcfd')+'">'
          +'<div style="font-size:7px;color:'+(_cliSigned?'#16a34a':'#00BCD4')+';font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Client Acknowledgement'+(_cliSigned?' · ✓':'')+'</div>'
          +(_cliSigned
            ? '<div style="font-size:22px;font-family:Outfit,Georgia,serif;font-style:italic;font-weight:700;color:#0a2030;border-bottom:1.5px solid #16a34a;padding-bottom:3px;line-height:1.2;margin-bottom:4px">'+esc(so.clientSignature||'—')+'</div>'
              +'<div style="font-size:10px;color:#0a2030;font-weight:700">'+esc(so.clientSignature||'—')+'</div>'
              +'<div style="font-size:9px;color:#16a34a;font-weight:700;margin-top:2px">Signed on '+_fD(so.clientSignedAt)+(so.clientEmail?' · '+esc(so.clientEmail):'')+'</div>'
            : '<div style="font-size:10px;color:#94a3b0;font-style:italic">Awaiting client signature</div>'
              +'<div style="border-bottom:1.5px solid #cbd5e1;margin-top:18px;width:70%"></div>'
              +'<div style="font-size:6px;color:#94a3b0;margin-top:2px">Signature · Date</div>')
        +'</div>'
      +'</div>'
      +(_ceoSigned && _cliSigned ? '<div style="text-align:center;font-size:8px;color:#16a34a;font-weight:800;letter-spacing:2px;padding:8px 0;border-top:1px solid #d1fae5;border-bottom:1px solid #d1fae5;background:#f0fdf4">✓ FULLY EXECUTED — BOTH SIGNATURES ON FILE</div>' : '');
    })()

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
  h+='<a href="https://os.microflexfilm.com/portal?id='+esc(quoteId)+'&q='+esc(qNum)+'" target="_blank" style="font-size:10px;color:var(--ac);text-decoration:none">Open Portal ↗</a></div>';
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

// ═══════════════════════════════════════
// SO SHIP PANE — inline send-flow inside the quote editor (tab 11,
// id=ep-so-send). The pane references three globals that were never
// defined, which is why the PDF stayed stuck on "Loading PDF…", the
// Subject and Body were empty, and Send Email would have thrown.
// ═══════════════════════════════════════
function _getEditorLinkedSO(){
  if(typeof S==='undefined'||!S||!S.editId)return null;
  if(typeof getQ!=='function'||typeof getSalesOrders!=='function')return null;
  var qq=getQ(S.editId);if(!qq)return null;
  var sos=getSalesOrders();if(!sos)return null;
  return sos.find(function(s){return s.quoteId===qq.id||s.quoteNum===qq.quoteNum})||null;
}

function initSOShipPane(){
  var so=_getEditorLinkedSO();if(!so)return;
  // 1. Trigger the PDF preview (fast HTML srcdoc path — instant render)
  if(window.loadSendPDFPreview)loadSendPDFPreview(so.id,false,'shipPdfWrap');
  // 2. Populate the email composer with the default Confirmation template
  _loadShipTemplate();
}
window.initSOShipPane=initSOShipPane;

function _loadShipTemplate(){
  var sel=document.getElementById('shipTplSelect');
  if(!sel)return;
  var key=sel.value||'confirmation';
  var tpl=SO_EMAIL_TEMPLATES.find(function(t){return t.key===key});
  if(!tpl)return;
  var so=_getEditorLinkedSO();if(!so)return;
  // Prefer saved override (raw template, run through interpolator)
  var override=SO_TEMPLATE_OVERRIDES[key]||{};
  var subj=override.subject?_interpolateTemplate(override.subject,so):tpl.subject(so);
  var body=override.body?_interpolateTemplate(override.body,so):tpl.build(so);
  var subjEl=document.getElementById('shipSubject');
  var bodyEl=document.getElementById('shipBody');
  if(subjEl)subjEl.value=subj;
  if(bodyEl)bodyEl.value=body;
}
window._loadShipTemplate=_loadShipTemplate;

// Send button on the ship pane. Reads the composer's live values
// (so any edits stick), generates the PDF, sends via Gmail with PDF
// attachment + BCC team@/quotes@, then saves the PDF to Drive via
// /api/saveSalesOrderPDF (server-side, service-account auth).
function shipSOFromPane(soId){
  var so=getSO(soId);if(!so)return toast('SO not found','err');
  var to=((document.getElementById('shipTo')||{}).value||so.email||'').trim();
  var subj=((document.getElementById('shipSubject')||{}).value||'').trim();
  var body=((document.getElementById('shipBody')||{}).value||'').trim();
  var sel=document.getElementById('shipTplSelect');
  var tplKey=sel?sel.value:'confirmation';
  if(!to)return toast('No recipient email','err');
  if(!subj||!body)return toast('Subject/body empty — pick a template first','err');

  toast('Generating PDF & sending...','ok');
  generateSOPDF(so).then(function(pdf){
    var finalSubj=_interpolateTemplate(subj,so);
    var finalBody=_interpolateTemplate(body,so);

    getGoogleToken().then(function(token){
      if(!token)return toast('Gmail auth required — sign out and back in','err');

      // Multipart MIME: HTML body + PDF attachment. BCC matches the
      // other SO send paths.
      var boundary='----=mfx_so_ship_'+Date.now();
      var raw=''
        +'From: MFX OS <flex@microflexfilm.com>\r\n'
        +'To: '+to+'\r\n'
        +'Bcc: team@microflexfilm.com, quotes@microflexfilm.com\r\n'
        +'Reply-To: quotes@microflexfilm.com\r\n'
        +'Subject: '+finalSubj+'\r\n'
        +'MIME-Version: 1.0\r\n'
        +'Content-Type: multipart/mixed; boundary="'+boundary+'"\r\n\r\n'
        +'--'+boundary+'\r\n'
        +'Content-Type: text/html; charset=utf-8\r\n\r\n'
        +finalBody+'\r\n\r\n'
        +'--'+boundary+'\r\n'
        +'Content-Type: application/pdf; name="'+pdf.filename+'"\r\n'
        +'Content-Disposition: attachment; filename="'+pdf.filename+'"\r\n'
        +'Content-Transfer-Encoding: base64\r\n\r\n'
        +pdf.base64+'\r\n\r\n'
        +'--'+boundary+'--';
      var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

      fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
        method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({raw:encoded})
      }).then(function(r){return r.json()}).then(function(data){
        if(!data.id){toast('Email send failed — check Google auth','err');return}
        toast('Email sent to '+to,'ok');

        // Server-side Drive save (mirrors executeSendSO)
        var payload={soId:so.id,soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,filename:pdf.filename,pdfBase64:pdf.base64};
        var p=(typeof MFX_API!=='undefined'&&MFX_API.postJSON)
          ? MFX_API.postJSON('/api/saveSalesOrderPDF',payload)
          : fetch('/api/saveSalesOrderPDF',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json()});
        p.then(function(resp){
          var link=resp&&resp.success?(resp.masterLink||resp.clientLink):null;
          if(!link)console.warn('saveSalesOrderPDF returned no link:',resp);
          finalizeSO(so,link,tplKey);
        }).catch(function(e){
          console.warn('saveSalesOrderPDF failed:',e);
          finalizeSO(so,null,tplKey);
        });
      }).catch(function(e){toast('Email error: '+e.message,'err')});
    });
  }).catch(function(e){toast('PDF error: '+(e.message||e),'err')});
}
window.shipSOFromPane=shipSOFromPane;

// ─── Init on load ───
if(typeof fbDb!=='undefined'){
  setTimeout(startSOListeners,1000);
}
setTimeout(initAutoSOCreation,1500);
setTimeout(initSOAutoSendListener,1500);
window.confirmIncomingPO=confirmIncomingPO;
// 2026-05-27: legacy buttons in the quote editor (Workflow tab, SO tab,
// orders pipeline card, orders SO list) call createSOFromPO(quoteId) but
// no function by that name was ever defined — they were silently
// failing with "SO module not loaded" toast. Alias to the canonical PO
// confirmation gate so all 4 buttons run the same flow:
//   confirmIncomingPO → autoCreateSO → auto-sign as Moises → auto-send.
window.createSOFromPO=confirmIncomingPO;

})();
