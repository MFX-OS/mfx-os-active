// ══════════════════════════════════════════════════════════════
// MFX FINANCE — Invoices + Payments (AR)
// ══════════════════════════════════════════════════════════════

function renderInvoices(){
  var inv=C.invoices;var f=S.invFilter||'all';
  var list=f==='all'?inv:inv.filter(function(i){return i.status===f});
  // Auto-mark overdue
  var now=new Date();
  list.forEach(function(i){if(i.status==='sent'&&i.dueDate&&new Date(i.dueDate)<now){i.status='overdue';db.collection('invoices').doc(i.id).update({status:'overdue'})}});

  var h='<div class="tabs" style="margin-bottom:8px">';
  ['all','draft','sent','overdue','partial','paid'].forEach(function(t){
    var c=t==='all'?inv.length:inv.filter(function(i){return i.status===t}).length;
    h+='<div class="tab '+(f===t?'active':'')+'" onclick="S.invFilter=\''+t+'\';renderInvoices()">'+t.charAt(0).toUpperCase()+t.slice(1)+' ('+c+')</div>';
  });
  h+='</div>';

  h+='<div style="display:flex;gap:8px;margin-bottom:10px"><input id="invSrch" placeholder="Search..." oninput="filterRows(this.value)" style="max-width:260px"><button class="btn btn-pr btn-sm" onclick="showNewInvModal()">+ New Invoice</button></div>';

  h+='<table class="tbl"><tr><th>Invoice</th><th>Client</th><th>PO#</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Due</th><th></th></tr>';
  list.forEach(function(i){
    var bal=(i.total||0)-(i.paidAmount||0);
    h+='<tr onclick="openInvDetail(\''+i.id+'\')" style="cursor:pointer"><td class="mono">'+i.invoiceNum+'</td><td>'+i.company+'</td><td style="font-size:10px">'+(i.poNumber||'—')+'</td>';
    h+='<td class="amt">'+f$(i.total)+'</td><td class="amt green">'+(i.paidAmount?f$(i.paidAmount):'—')+'</td><td class="amt '+(bal>0?'red':'green')+'">'+f$(bal)+'</td>';
    h+='<td><span class="pill pill-'+i.status+'">'+i.status+'</span></td><td style="font-size:10px">'+fD(i.dueDate)+'</td>';
    h+='<td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openInvDetail(\''+i.id+'\')">View</button></td></tr>';
  });
  h+='</table>';
  if(!list.length)h+='<div class="empty">No invoices</div>';
  $('app').innerHTML=h;
}

function filterRows(q){document.querySelectorAll('.tbl tr').forEach(function(r,i){if(i)r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none'})}

// ─── Invoice Detail Modal ───
function openInvDetail(id){
  var i=C.invoices.find(function(x){return x.id===id});if(!i)return;
  var bal=(i.total||0)-(i.paidAmount||0);
  var h='<div class="modal-title">'+i.invoiceNum+' <span class="pill pill-'+i.status+'">'+i.status+'</span></div>';

  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:4px">BILL TO</div>';
  h+='<div style="font-size:14px;font-weight:700">'+i.company+'</div>';
  h+='<div style="font-size:11px;color:var(--tx2)">'+i.contact+(i.email?' · '+i.email:'')+'</div>';
  if(i.shipTo)h+='<div style="font-size:10px;color:var(--tx3)">Ship: '+i.shipTo+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:3px">PO# '+i.poNumber+' · Quote: '+i.quoteNum+' Rev '+(i.quoteRev||'A')+(i.soNum?' · SO: '+i.soNum:'')+'</div></div>';

  h+='<table class="tbl"><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr>';
  (i.lineItems||[]).forEach(function(li){h+='<tr><td>'+li.description+'</td><td>'+fN(li.qty)+'</td><td class="amt">'+f$(li.ppu)+'</td><td class="amt">'+f$(li.total)+'</td></tr>'});
  if(i.setupCharges)h+='<tr><td>Setup / Fixed Charges</td><td></td><td></td><td class="amt">'+f$(i.setupCharges)+'</td></tr>';
  h+='</table>';

  h+='<div style="text-align:right;padding:8px 0;border-top:1px solid var(--bdr)">';
  h+='<div style="font-size:11px;color:var(--tx3)">Subtotal: '+f$(i.subtotal)+'</div>';
  if(i.setupCharges)h+='<div style="font-size:11px;color:var(--tx3)">Setup: '+f$(i.setupCharges)+'</div>';
  if(i.tax)h+='<div style="font-size:11px;color:var(--tx3)">Tax: '+f$(i.tax)+'</div>';
  h+='<div style="font-size:18px;font-weight:700;color:var(--ac)">Total: '+f$(i.total)+'</div>';
  if(i.paidAmount)h+='<div style="color:var(--gn)">Paid: '+f$(i.paidAmount)+'</div>';
  if(bal>0)h+='<div style="color:var(--rd);font-weight:700">Balance: '+f$(bal)+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:3px">Terms: '+i.terms+' · Due: '+fD(i.dueDate)+'</div></div>';

  // Payment history
  if(i.payments&&i.payments.length){
    h+='<div style="background:var(--bg3);border-radius:8px;padding:10px;margin:8px 0"><div style="font-size:9px;color:var(--gn);font-weight:700;letter-spacing:1px;margin-bottom:4px">PAYMENTS</div>';
    i.payments.forEach(function(p){h+='<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--bdr);font-size:11px"><span>'+fD(p.date)+' · '+p.method+(p.ref?' #'+p.ref:'')+'</span><span class="amt green">'+f$(p.amount)+'</span></div>'});
    h+='</div>';
  }

  // Reminders sent
  if(i.reminderCount)h+='<div style="font-size:10px;color:var(--or);margin:4px 0">'+i.reminderCount+' reminder(s) sent · Last: '+fDT(i.lastReminderAt)+'</div>';

  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
  if(i.status==='draft')h+='<button class="btn btn-pr btn-sm" onclick="sendInvoice(\''+i.id+'\')">✉ Send to Client</button>';
  if(i.status!=='paid')h+='<button class="btn btn-gn btn-sm" onclick="recordPay(\''+i.id+'\')">💰 Record Payment</button>';
  if(i.status==='sent'||i.status==='overdue')h+='<button class="btn btn-ghost btn-sm" onclick="sendReminder(\''+i.id+'\')">🔔 Reminder</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="printInv(\''+i.id+'\')">🖨 Print</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div>';
  openModal(h);
}

// ─── Create Invoice ───
function createInvFromSO(soId){
  var so=C.salesOrders.find(function(x){return x.id===soId});if(!so)return toast('SO not found','err');
  var num=genInvNum();
  var termDays=parseInt((so.terms||'Net 30').replace(/\D/g,''))||30;
  var due=new Date();due.setDate(due.getDate()+termDays);

  var inv={id:uid('inv'),invoiceNum:num,soId:so.id,soNum:so.soNum,
    quoteId:so.quoteId,quoteNum:so.quoteNum,quoteRev:so.quoteRev||'A',
    company:so.company,contact:so.contact,email:so.email,phone:so.phone,
    address:so.address,shipTo:so.shipTo,poNumber:so.poNumber,
    jobDesc:so.jobDesc,
    lineItems:[{description:so.jobDesc,qty:so.qty,ppu:so.ppu,total:so.subtotal}],
    subtotal:so.subtotal||0,setupCharges:so.setupCharges||0,
    tax:0,total:so.total||0,terms:so.terms||'Net 30',
    dueDate:due.toISOString(),status:'draft',
    paidAmount:0,payments:[],reminderCount:0,
    createdAt:new Date().toISOString(),createdBy:userName(),updatedAt:new Date().toISOString(),
    sentAt:null,paidAt:null};

  db.collection('invoices').doc(inv.id).set(inv).then(function(){
    toast('Invoice '+num+' created from '+so.soNum,'ok');openInvDetail(inv.id);
  });
}

function createInvFromQuote(qid){
  var q=C.quotes.find(function(x){return x.id===qid});if(!q)return toast('Quote not found','err');
  var f=q.fields||{};var pq=q.pricedQtys||[];var si=q.poQtyIndex||0;
  var sel=pq[si]||pq[pq.length-1]||{qty:0,ppu:0,total:0};
  var fixes=q.fixedCharges||{};var fixT=(fixes.die||0)+(fixes.plates||0)+(fixes.mr||0)+(fixes.cu||0)+(fixes.shipping||0);
  var num=genInvNum();var termDays=parseInt((f.payTerms||'Net 30').replace(/\D/g,''))||30;
  var due=new Date();due.setDate(due.getDate()+termDays);

  var inv={id:uid('inv'),invoiceNum:num,quoteId:q.id,quoteNum:q.quoteNum,quoteRev:q.rev||'A',
    company:f.custCo||'',contact:f.custAttn||'',email:f.custEmail||q.poClientEmail||'',
    phone:f.custPhone||'',address:f.cityState||'',shipTo:q.poShipTo||'',poNumber:q.poNumber||'',
    jobDesc:(f.sA||'?')+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' '+(f.colors||'?')+'C',
    lineItems:[{description:(f.sA||'?')+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' '+(f.jobType||''),qty:sel.qty,ppu:sel.ppu,total:sel.total}],
    subtotal:sel.total||0,setupCharges:fixT,tax:0,total:(sel.total||0)+fixT,
    terms:f.payTerms||'Net 30',dueDate:due.toISOString(),status:'draft',
    paidAmount:0,payments:[],reminderCount:0,
    createdAt:new Date().toISOString(),createdBy:userName(),updatedAt:new Date().toISOString(),sentAt:null,paidAt:null};

  db.collection('invoices').doc(inv.id).set(inv).then(function(){toast('Invoice '+num+' created','ok');openInvDetail(inv.id)});
}

// ─── Send Invoice via Gmail ───
function sendInvoice(id){
  var i=C.invoices.find(function(x){return x.id===id});if(!i)return;
  if(!i.email)return toast('No email on invoice','err');
  if(!confirm('Send '+i.invoiceNum+' to '+i.email+'?'))return;
  var token=localStorage.getItem('mfx_google_token');
  if(!token)return toast('Sign out & back in for Google access','err');

  var body='<table cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;font-family:Arial;background:#060d14;color:#e0f2fe">';
  body+='<tr><td style="height:3px;background:#00e5ff"></td></tr>';
  body+='<tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #1e3a4f"><div style="font-size:22px;font-weight:900">Microflex</div><div style="font-size:8px;color:#00e5ff;letter-spacing:4px">INVOICE</div></td></tr>';
  body+='<tr><td style="padding:20px 24px"><div style="font-size:22px;font-weight:900;color:#00e5ff">'+i.invoiceNum+'</div><div style="font-size:12px;color:#94a3b8">PO# '+i.poNumber+' · Quote: '+i.quoteNum+'</div><div style="font-size:12px;color:#94a3b8">Due: '+fD(i.dueDate)+' · '+i.terms+'</div></td></tr>';
  body+='<tr><td style="padding:0 24px"><table width="100%" cellpadding="8" style="border:1px solid #1e3a4f;border-radius:6px;border-collapse:collapse">';
  (i.lineItems||[]).forEach(function(li){body+='<tr><td style="color:#94a3b8;border-bottom:1px solid #1e3a4f;font-size:12px">'+li.description+'</td><td style="color:#e0f2fe;text-align:right;border-bottom:1px solid #1e3a4f;font-size:12px">'+fN(li.qty)+' × '+f$(li.ppu)+'</td><td style="color:#e0f2fe;text-align:right;border-bottom:1px solid #1e3a4f;font-size:14px;font-weight:700">'+f$(li.total)+'</td></tr>'});
  if(i.setupCharges)body+='<tr><td style="color:#94a3b8;border-bottom:1px solid #1e3a4f;font-size:12px">Setup / Fixed</td><td></td><td style="color:#e0f2fe;text-align:right;border-bottom:1px solid #1e3a4f;font-size:12px">'+f$(i.setupCharges)+'</td></tr>';
  body+='<tr><td colspan="2" style="text-align:right;font-size:14px;font-weight:700;color:#00e5ff;padding:12px">Total Due</td><td style="text-align:right;font-size:20px;font-weight:900;color:#00e5ff;padding:12px">'+f$(i.total)+'</td></tr></table></td></tr>';
  body+='<tr><td style="padding:16px 24px;text-align:center"><div style="font-size:10px;color:#64748b">Microflex Film Corporation · 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com</div></td></tr></table>';

  var raw='Content-Type: text/html; charset=utf-8\r\nTo: '+i.email+'\r\nBcc: quotes@microflexfilm.com\r\nSubject: Invoice '+i.invoiceNum+' — '+f$(i.total)+' Due '+fD(i.dueDate)+' | Microflex Film\r\nMIME-Version: 1.0\r\n\r\n'+body;
  var enc=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:enc})}).then(function(r){return r.json()}).then(function(d){
    if(d.id){db.collection('invoices').doc(id).update({status:'sent',sentAt:new Date().toISOString()});toast('Sent to '+i.email,'ok');closeModal()}
    else toast('Error: '+(d.error?d.error.message:''),'err');
  });
}

// ─── Record Payment ───
function recordPay(id){
  var i=C.invoices.find(function(x){return x.id===id});if(!i)return;
  var bal=(i.total||0)-(i.paidAmount||0);
  var h='<div class="modal-title">Record Payment — '+i.invoiceNum+'</div>';
  h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:10px">'+i.company+' · Balance: <strong style="color:var(--rd)">'+f$(bal)+'</strong></div>';
  h+='<div class="fg"><label>Amount</label><input id="pAmt" type="number" step="0.01" value="'+bal.toFixed(2)+'"></div>';
  h+='<div class="row2"><div class="fg"><label>Date</label><input id="pDate" type="date" value="'+new Date().toISOString().split('T')[0]+'"></div>';
  h+='<div class="fg"><label>Method</label><select id="pMethod"><option>Check</option><option>ACH</option><option>Wire</option><option>Credit Card</option><option>Cash</option></select></div></div>';
  h+='<div class="fg"><label>Reference #</label><input id="pRef" placeholder="Check #, transaction ID"></div>';
  h+='<button class="btn btn-gn" onclick="savePay(\''+id+'\')" style="width:100%">Save Payment</button>';
  openModal(h);
}

function savePay(id){
  var i=C.invoices.find(function(x){return x.id===id});if(!i)return;
  var amt=parseFloat($('pAmt').value);if(!amt||amt<=0)return toast('Enter amount','err');
  var pays=i.payments||[];
  pays.push({amount:amt,date:$('pDate').value,method:$('pMethod').value,ref:$('pRef').value,by:userName(),at:new Date().toISOString()});
  var totalPaid=(i.paidAmount||0)+amt;
  var st=totalPaid>=(i.total||0)?'paid':(totalPaid>0?'partial':i.status);
  db.collection('invoices').doc(id).update({payments:pays,paidAmount:totalPaid,status:st,paidAt:st==='paid'?new Date().toISOString():null,updatedAt:new Date().toISOString()}).then(function(){
    toast(st==='paid'?'PAID IN FULL — '+f$(totalPaid):'Payment '+f$(amt)+' recorded','ok');
    openInvDetail(id);
  });
}

// ─── Send Reminder ───
function sendReminder(id){
  var i=C.invoices.find(function(x){return x.id===id});if(!i)return;
  var bal=(i.total||0)-(i.paidAmount||0);
  var days=Math.floor((new Date()-new Date(i.dueDate))/86400000);
  if(!confirm('Send reminder for '+i.invoiceNum+'? ('+f$(bal)+', '+days+' days overdue)'))return;
  db.collection('invoices').doc(id).update({lastReminderAt:new Date().toISOString(),reminderCount:(i.reminderCount||0)+1,updatedAt:new Date().toISOString()});
  toast('Reminder queued for '+i.invoiceNum,'ok');
}

// ─── Print ───
function printInv(id){
  var i=C.invoices.find(function(x){return x.id===id});if(!i)return;
  var w=window.open('','_blank');
  var html='<html><head><style>body{font-family:Arial;margin:30px;color:#333}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;font-size:12px}.r{text-align:right}.b{font-weight:700}.pk{color:#0891b2}</style></head><body>';
  html+='<div style="display:flex;justify-content:space-between"><div><div style="font-size:24px;font-weight:900;color:#0a2e3e">Microflex Film Corporation</div><div style="font-size:10px;color:#666">4130 Garner Rd, Riverside CA 92501 · (909) 360-9066</div></div>';
  html+='<div style="text-align:right"><div style="font-size:28px;font-weight:900" class="pk">INVOICE</div><div style="font-size:16px;font-weight:700">'+i.invoiceNum+'</div><div style="font-size:11px;color:#666">Date: '+fD(i.createdAt)+'<br>Due: '+fD(i.dueDate)+'<br>Terms: '+i.terms+'</div></div></div>';
  html+='<div style="background:#f8f9fa;padding:12px;border-radius:6px;margin:16px 0"><strong>Bill To:</strong> '+i.company+'<br>'+i.contact+(i.email?' · '+i.email:'')+'<br>PO# '+i.poNumber+'</div>';
  html+='<table><tr><th style="text-align:left">Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr>';
  (i.lineItems||[]).forEach(function(li){html+='<tr><td>'+li.description+'</td><td class="r">'+fN(li.qty)+'</td><td class="r">'+f$(li.ppu)+'</td><td class="r b">'+f$(li.total)+'</td></tr>'});
  if(i.setupCharges)html+='<tr><td>Setup / Fixed Charges</td><td></td><td></td><td class="r">'+f$(i.setupCharges)+'</td></tr>';
  html+='<tr><td colspan="3" class="r b" style="font-size:14px">Total Due</td><td class="r b pk" style="font-size:20px">'+f$(i.total)+'</td></tr></table>';
  if(i.paidAmount)html+='<div style="margin-top:12px;font-size:14px;color:#22c55e"><strong>Paid: '+f$(i.paidAmount)+'</strong> · Balance: <strong style="color:#ef4444">'+f$((i.total||0)-(i.paidAmount||0))+'</strong></div>';
  html+='<div style="margin-top:30px;font-size:10px;color:#999;text-align:center">Thank you for your business · SQF Certified · Made in USA</div></body></html>';
  w.document.write(html);w.document.close();setTimeout(function(){w.print()},500);
}

// ─── New Invoice Modal ───
function showNewInvModal(){
  var sos=C.salesOrders.filter(function(so){return!C.invoices.some(function(i){return i.soNum===so.soNum})});
  var qs=C.quotes.filter(function(q){return q.status==='won'&&q.poNumber&&!C.invoices.some(function(i){return i.quoteNum===q.quoteNum})});
  var h='<div class="modal-title">Create Invoice</div>';
  if(sos.length){
    h+='<div class="fg"><label>From Sales Order</label><select id="newInvSO"><option value="">— Select SO —</option>';
    sos.forEach(function(so){h+='<option value="'+so.id+'">'+so.soNum+' · '+so.company+' · '+f$(so.total)+'</option>'});
    h+='</select></div><button class="btn btn-pr btn-sm" onclick="var v=$(\'newInvSO\').value;if(!v)return;createInvFromSO(v);closeModal()" style="width:100%;margin-bottom:10px">Create from SO</button>';
  }
  if(qs.length){
    h+='<div class="fg"><label>From Won Quote (no SO)</label><select id="newInvQ"><option value="">— Select Quote —</option>';
    qs.forEach(function(q){h+='<option value="'+q.id+'">'+q.quoteNum+' · '+(q.fields?q.fields.custCo:'—')+' · PO#'+q.poNumber+'</option>'});
    h+='</select></div><button class="btn btn-ghost btn-sm" onclick="var v=$(\'newInvQ\').value;if(!v)return;createInvFromQuote(v);closeModal()" style="width:100%">Create from Quote</button>';
  }
  if(!sos.length&&!qs.length)h+='<div class="empty">All orders have been invoiced</div>';
  h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%;margin-top:8px">Cancel</button>';
  openModal(h);
}

// ─── Payments Tab ───
function renderPayments(){
  var all=[];
  C.invoices.forEach(function(i){(i.payments||[]).forEach(function(p){all.push(Object.assign({},p,{invoiceNum:i.invoiceNum,company:i.company}))})});
  all.sort(function(a,b){return(b.date||'').localeCompare(a.date||'')});
  var total=all.reduce(function(s,p){return s+(p.amount||0)},0);

  var h='<div class="card"><div class="card-h">All Payments <span class="badge">'+all.length+' · '+f$(total)+'</span></div>';
  h+='<table class="tbl"><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Amount</th><th>Method</th><th>Ref</th><th>By</th></tr>';
  all.forEach(function(p){
    h+='<tr><td>'+fD(p.date)+'</td><td class="mono">'+p.invoiceNum+'</td><td>'+p.company+'</td><td class="amt green">'+f$(p.amount)+'</td><td>'+p.method+'</td><td style="font-size:10px">'+(p.ref||'—')+'</td><td style="font-size:10px">'+(p.by||'—')+'</td></tr>';
  });
  h+='</table>';
  if(!all.length)h+='<div class="empty">No payments recorded</div>';
  h+='</div>';
  $('app').innerHTML=h;
}
