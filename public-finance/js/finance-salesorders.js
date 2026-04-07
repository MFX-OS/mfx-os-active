// ══════════════════════════════════════════════════════════════
// MFX FINANCE — Sales Orders + Green Light Gates
// ══════════════════════════════════════════════════════════════

function renderSalesOrders(){
  var sos=C.salesOrders;var f=S.soFilter||'all';
  var list=f==='all'?sos:sos.filter(function(s){return s.status===f});

  var h='<div class="tabs" style="margin-bottom:8px">';
  ['all','pending','approved','production','shipped','delivered','invoiced'].forEach(function(t){
    var c=t==='all'?sos.length:sos.filter(function(s){return s.status===t}).length;
    h+='<div class="tab '+(f===t?'active':'')+'" onclick="S.soFilter=\''+t+'\';renderSalesOrders()">'+t.charAt(0).toUpperCase()+t.slice(1)+' ('+c+')</div>';
  });
  h+='</div>';

  h+='<table class="tbl"><tr><th>SO#</th><th>Client</th><th>Quote</th><th>PO#</th><th>Pre-Press</th><th>Logistics</th><th>Qty</th><th>Total</th><th>Status</th><th></th></tr>';
  list.forEach(function(so){
    var pp=so.prePressReady?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">⬜</span>';
    var lg=so.logisticsReady?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">⬜</span>';
    h+='<tr onclick="openSODetail(\''+so.id+'\')" style="cursor:pointer">';
    h+='<td class="mono">'+so.soNum+'</td><td>'+so.company+'</td><td class="mono">'+so.quoteNum+'</td><td style="font-size:10px">'+so.poNumber+'</td>';
    h+='<td style="text-align:center">'+pp+'</td><td style="text-align:center">'+lg+'</td>';
    h+='<td>'+fN(so.qty)+'</td><td class="amt">'+f$(so.total)+'</td>';
    h+='<td><span class="pill pill-'+so.status+'">'+so.status+'</span></td>';
    h+='<td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openSODetail(\''+so.id+'\')">View</button></td></tr>';
  });
  h+='</table>';
  if(!list.length)h+='<div class="empty">No sales orders</div>';
  $('app').innerHTML=h;
}

function openSODetail(id){
  var so=C.salesOrders.find(function(x){return x.id===id});if(!so)return;

  var h='<div class="modal-title">'+so.soNum+' <span class="pill pill-'+so.status+'">'+so.status+'</span></div>';

  // Client
  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
  h+='<div style="display:flex;justify-content:space-between">';
  h+='<div><div style="font-size:14px;font-weight:700">'+so.company+'</div><div style="font-size:11px;color:var(--tx2)">'+so.contact+(so.email?' · '+so.email:'')+'</div>';
  if(so.shipTo)h+='<div style="font-size:10px;color:var(--tx3)">Ship: '+so.shipTo+'</div>';
  h+='</div><div style="text-align:right;font-size:10px;color:var(--tx3)">PO# '+so.poNumber+'<br>Quote: '+so.quoteNum+' Rev '+(so.quoteRev||'A')+'<br>Signed: '+(so.poSignature||'—')+' · '+fD(so.poSignedAt)+'</div></div></div>';

  // Job specs
  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
  h+='<div style="font-size:9px;color:var(--cy);font-weight:700;letter-spacing:1px;margin-bottom:4px">JOB SPECS</div>';
  h+='<div style="font-size:13px;font-weight:600">'+so.jobDesc+'</div>';
  if(so.specs){
    var sp=so.specs;
    h+='<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">';
    if(sp.sA)h+='<span class="pill" style="background:var(--cy);color:#000">'+sp.sA+'x'+sp.sar+'"</span>';
    if(sp.shapeType)h+='<span class="pill" style="background:var(--cy);color:#000">'+sp.shapeType+'</span>';
    if(sp.colors)h+='<span class="pill" style="background:var(--cy);color:#000">'+sp.colors+'C</span>';
    if(sp.face)h+='<span class="pill" style="background:var(--bg4);color:var(--tx2)">'+sp.face+'</span>';
    h+='</div>';
  }
  h+='</div>';

  // Pricing
  h+='<div style="display:flex;justify-content:space-between;background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
  h+='<div><div style="font-size:10px;color:var(--tx3)">Qty</div><div style="font-size:16px;font-weight:700">'+fN(so.qty)+'</div></div>';
  h+='<div><div style="font-size:10px;color:var(--tx3)">Unit Price</div><div style="font-size:16px;font-weight:700">'+f$(so.ppu)+'</div></div>';
  h+='<div><div style="font-size:10px;color:var(--tx3)">Subtotal</div><div style="font-size:16px;font-weight:700">'+f$(so.subtotal)+'</div></div>';
  if(so.setupCharges)h+='<div><div style="font-size:10px;color:var(--tx3)">Setup</div><div style="font-size:16px;font-weight:700">'+f$(so.setupCharges)+'</div></div>';
  h+='<div><div style="font-size:10px;color:var(--ac)">Total</div><div style="font-size:20px;font-weight:900;color:var(--ac)">'+f$(so.total)+'</div></div></div>';

  // Files
  if((so.poFiles&&so.poFiles.length)||(so.artFiles&&so.artFiles.length)){
    h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
    h+='<div style="font-size:9px;color:#DAA520;font-weight:700;letter-spacing:1px;margin-bottom:4px">CLIENT FILES</div>';
    if(so.poFiles&&so.poFiles.length){h+='<div style="font-size:10px;color:var(--tx3);font-weight:600">PO Docs ('+so.poFiles.length+')</div>';so.poFiles.forEach(function(f){h+='<a href="'+f.url+'" target="_blank" style="display:block;font-size:10px;color:var(--cy);padding:2px 0">📎 '+f.name+'</a>'})}
    if(so.artFiles&&so.artFiles.length){h+='<div style="font-size:10px;color:var(--tx3);font-weight:600;margin-top:4px">Art Files ('+so.artFiles.length+')</div>';so.artFiles.forEach(function(f){h+='<a href="'+f.url+'" target="_blank" style="display:block;font-size:10px;color:var(--cy);padding:2px 0">🎨 '+f.name+'</a>'})}
    h+='</div>';
  }

  // ═══ GREEN LIGHT GATES ═══
  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
  h+='<div style="font-size:9px;color:var(--gn);font-weight:700;letter-spacing:1px;margin-bottom:6px">GREEN LIGHT GATES</div>';
  h+='<div style="display:flex;gap:12px">';
  // Pre-Press gate
  h+='<div style="flex:1;background:var(--bg2);border:1px solid '+(so.prePressReady?'var(--gn)':'var(--bdr)');
  h+=';border-radius:8px;padding:12px;text-align:center">';
  h+='<div style="font-size:24px">'+(so.prePressReady?'🟢':'⬜')+'</div>';
  h+='<div style="font-size:11px;font-weight:700;color:'+(so.prePressReady?'var(--gn)':'var(--tx3)')+'">Pre-Press</div>';
  h+='<div style="font-size:9px;color:var(--tx3)">'+(so.prePressReady?'Plates ready · '+fD(so.prePressReadyAt):'Waiting for plates')+'</div>';
  if(!so.prePressReady&&so.status==='pending')h+='<button class="btn btn-gn btn-xs" onclick="setGate(\''+so.id+'\',\'prePress\')" style="margin-top:6px">Mark Ready</button>';
  h+='</div>';
  // Logistics gate
  h+='<div style="flex:1;background:var(--bg2);border:1px solid '+(so.logisticsReady?'var(--gn)':'var(--bdr)');
  h+=';border-radius:8px;padding:12px;text-align:center">';
  h+='<div style="font-size:24px">'+(so.logisticsReady?'🟢':'⬜')+'</div>';
  h+='<div style="font-size:11px;font-weight:700;color:'+(so.logisticsReady?'var(--gn)':'var(--tx3)')+'">Logistics</div>';
  h+='<div style="font-size:9px;color:var(--tx3)">'+(so.logisticsReady?'Material staged · '+fD(so.logisticsReadyAt):'Checking material')+'</div>';
  if(!so.logisticsReady&&so.status==='pending')h+='<button class="btn btn-gn btn-xs" onclick="setGate(\''+so.id+'\',\'logistics\')" style="margin-top:6px">Mark Ready</button>';
  h+='</div></div>';

  if(so.prePressReady&&so.logisticsReady&&!so.releasedToProduction){
    h+='<div style="text-align:center;margin-top:8px"><button class="btn btn-pr" onclick="releaseToProduction(\''+so.id+'\')" style="padding:10px 30px;font-size:13px">🚀 Release to Production</button></div>';
  }
  if(so.releasedToProduction){
    h+='<div style="text-align:center;margin-top:8px;color:var(--gn);font-weight:700;font-size:12px">✅ Released to Production · '+fD(so.releasedAt)+'</div>';
  }
  h+='</div>';

  // Actions
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if(so.status==='pending')h+='<button class="btn btn-pr btn-sm" onclick="approvesSO(\''+so.id+'\')">✅ Approve SO</button>';
  if(so.status==='delivered'||so.status==='shipped'){
    var hasInv=C.invoices.some(function(i){return i.soNum===so.soNum});
    if(!hasInv)h+='<button class="btn btn-pr btn-sm" onclick="createInvFromSO(\''+so.id+'\');closeModal()">📄 Create Invoice</button>';
  }
  h+='<button class="btn btn-ghost btn-sm" onclick="printSO(\''+so.id+'\')">🖨 Print SO</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div>';
  openModal(h);
}

function setGate(soId,gate){
  var up={};
  if(gate==='prePress'){up.prePressReady=true;up.prePressReadyAt=new Date().toISOString();up.prePressReadyBy=userName()}
  if(gate==='logistics'){up.logisticsReady=true;up.logisticsReadyAt=new Date().toISOString();up.logisticsReadyBy=userName()}
  up.updatedAt=new Date().toISOString();
  db.collection('salesOrders').doc(soId).update(up).then(function(){
    toast(gate+' marked ready','ok');
    // Check if both gates are green now
    var so=C.salesOrders.find(function(s){return s.id===soId});
    if(so){
      var ppReady=gate==='prePress'?true:so.prePressReady;
      var lgReady=gate==='logistics'?true:so.logisticsReady;
      if(ppReady&&lgReady){
        toast('🟢🟢 Both gates GREEN — ready for production release!','ok');
        db.collection('activity').add({type:'gates.clear',soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,message:'Pre-Press + Logistics both ready',timestamp:firebase.firestore.FieldValue.serverTimestamp()});
      }
    }
    openSODetail(soId);
  });
}

function releaseToProduction(soId){
  if(!confirm('Release this SO to production scheduling?'))return;
  db.collection('salesOrders').doc(soId).update({
    releasedToProduction:true,releasedAt:new Date().toISOString(),releasedBy:userName(),
    status:'production',updatedAt:new Date().toISOString()
  }).then(function(){
    var so=C.salesOrders.find(function(s){return s.id===soId});
    toast('🚀 '+so.soNum+' released to production!','ok');
    db.collection('activity').add({type:'so.released',soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,message:'Released to production — schedule job',timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    openSODetail(soId);
  });
}

function approvesSO(soId){
  var code=prompt('CEO Approval Code:');if(code!=='2057')return toast('Invalid code','err');
  db.collection('salesOrders').doc(soId).update({status:'approved',approvedBy:userName(),approvedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}).then(function(){
    toast('SO approved','ok');openSODetail(soId);
  });
}

function printSO(id){
  var so=C.salesOrders.find(function(x){return x.id===id});if(!so)return;
  var w=window.open('','_blank');
  var html='<html><head><style>body{font-family:Arial;margin:30px;color:#333}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;font-size:12px}.r{text-align:right}.b{font-weight:700}.cy{color:#0891b2}</style></head><body>';
  html+='<div style="display:flex;justify-content:space-between"><div><div style="font-size:24px;font-weight:900;color:#0a2e3e">Microflex Film Corporation</div><div style="font-size:10px;color:#666">4130 Garner Rd, Riverside CA 92501 · (909) 360-9066</div></div>';
  html+='<div style="text-align:right"><div style="font-size:28px;font-weight:900" class="cy">SALES ORDER</div><div style="font-size:16px;font-weight:700">'+so.soNum+'</div><div style="font-size:11px;color:#666">Date: '+fD(so.createdAt)+'<br>PO# '+so.poNumber+'<br>Quote: '+so.quoteNum+'</div></div></div>';
  html+='<div style="background:#f8f9fa;padding:12px;border-radius:6px;margin:16px 0"><strong>'+so.company+'</strong><br>'+so.contact+(so.email?' · '+so.email:'')+(so.shipTo?'<br>Ship to: '+so.shipTo:'')+'</div>';
  html+='<table><tr><th style="text-align:left">Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr>';
  html+='<tr><td>'+so.jobDesc+'</td><td class="r">'+fN(so.qty)+'</td><td class="r">'+f$(so.ppu)+'</td><td class="r b">'+f$(so.subtotal)+'</td></tr>';
  if(so.setupCharges)html+='<tr><td>Setup / Fixed Charges</td><td></td><td></td><td class="r">'+f$(so.setupCharges)+'</td></tr>';
  html+='<tr><td colspan="3" class="r b" style="font-size:14px">Total</td><td class="r b cy" style="font-size:20px">'+f$(so.total)+'</td></tr></table>';
  html+='<div style="margin-top:30px;font-size:10px;color:#999;text-align:center">SQF Certified · Made in USA</div></body></html>';
  w.document.write(html);w.document.close();setTimeout(function(){w.print()},500);
}
