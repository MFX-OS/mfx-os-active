// ══════════════════════════════════════════════════════════════
// MFX FINANCE — Vendor POs (AP)
// ══════════════════════════════════════════════════════════════

function renderVendorPOs(){
  var vps=C.vendorPOs;
  var h='<div style="display:flex;justify-content:space-between;margin-bottom:10px"><div class="card-h" style="margin:0">Vendor Purchase Orders</div><button class="btn btn-pr btn-sm" onclick="showNewVPOModal()">+ New Vendor PO</button></div>';

  h+='<table class="tbl"><tr><th>VPO#</th><th>Vendor</th><th>Material</th><th>For Job</th><th>Total</th><th>ETA</th><th>Status</th><th></th></tr>';
  vps.forEach(function(v){
    h+='<tr onclick="openVPODetail(\''+v.id+'\')" style="cursor:pointer"><td class="mono">'+v.vpoNum+'</td><td>'+v.vendorName+'</td><td>'+(v.material||'—')+'</td><td class="mono" style="font-size:10px">'+(v.forSONum||'—')+'</td>';
    h+='<td class="amt">'+f$(v.total)+'</td><td style="font-size:10px">'+fD(v.eta)+'</td>';
    h+='<td><span class="pill pill-'+v.status+'">'+v.status+'</span></td>';
    h+='<td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openVPODetail(\''+v.id+'\')">View</button></td></tr>';
  });
  h+='</table>';
  if(!vps.length)h+='<div class="empty">No vendor POs yet</div>';
  $('app').innerHTML=h;
}

function showNewVPOModal(){
  var h='<div class="modal-title">New Vendor PO</div>';
  h+='<div class="row2"><div class="fg"><label>Vendor Name</label><input id="vpVendor" placeholder="Material supplier"></div>';
  h+='<div class="fg"><label>Vendor Email</label><input id="vpEmail" type="email" placeholder="orders@vendor.com"></div></div>';
  h+='<div class="row2"><div class="fg"><label>Material</label><input id="vpMat" placeholder="e.g. White BOPP 2mil"></div>';
  h+='<div class="fg"><label>Quantity</label><input id="vpQty" placeholder="e.g. 5000 ft or 10 rolls"></div></div>';
  h+='<div class="row2"><div class="fg"><label>Unit Cost</label><input id="vpUnit" type="number" step="0.01" placeholder="0.00"></div>';
  h+='<div class="fg"><label>Total</label><input id="vpTotal" type="number" step="0.01" placeholder="0.00"></div></div>';
  h+='<div class="row2"><div class="fg"><label>For SO#</label><select id="vpSO"><option value="">General stock</option>';
  C.salesOrders.filter(function(s){return s.status!=='invoiced'}).forEach(function(s){h+='<option value="'+s.soNum+'">'+s.soNum+' · '+s.company+'</option>'});
  h+='</select></div><div class="fg"><label>Expected Delivery</label><input id="vpEta" type="date"></div></div>';
  h+='<div class="fg"><label>Notes</label><textarea id="vpNotes" rows="2"></textarea></div>';
  h+='<div class="row2"><div class="fg"><label>Terms</label><select id="vpTerms"><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Due on Receipt</option><option>Prepaid</option></select></div><div class="fg"><label>Approval</label><button class="btn btn-pr" onclick="createVPO()" style="width:100%;margin-top:18px">Create & Send</button></div></div>';
  h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
  openModal(h);
}

function createVPO(){
  var d=new Date();var num='VPO'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+'-'+String(C.vendorPOs.length+1).padStart(3,'0');
  var total=parseFloat($('vpTotal').value)||0;
  var terms=$('vpTerms').value;var termDays=parseInt(terms.replace(/\D/g,''))||30;
  var due=new Date();due.setDate(due.getDate()+termDays);

  var vpo={id:uid('vpo'),vpoNum:num,
    vendorName:$('vpVendor').value,vendorEmail:$('vpEmail').value,
    material:$('vpMat').value,quantity:$('vpQty').value,
    unitCost:parseFloat($('vpUnit').value)||0,total:total,
    forSONum:$('vpSO').value||null,
    eta:$('vpEta').value||null,terms:terms,dueDate:due.toISOString(),
    notes:$('vpNotes').value,
    status:'sent',paidAmount:0,
    receivedAt:null,receivedQty:null,lotNumber:null,
    createdAt:new Date().toISOString(),createdBy:userName(),updatedAt:new Date().toISOString()
  };

  db.collection('vendorPOs').doc(vpo.id).set(vpo).then(function(){
    toast('Vendor PO '+num+' created','ok');closeModal();
    db.collection('activity').add({type:'vpo.created',vpoNum:num,vendor:vpo.vendorName,material:vpo.material,total:total,timestamp:firebase.firestore.FieldValue.serverTimestamp()});
  });
}

function openVPODetail(id){
  var v=C.vendorPOs.find(function(x){return x.id===id});if(!v)return;
  var h='<div class="modal-title">'+v.vpoNum+' <span class="pill pill-'+v.status+'">'+v.status+'</span></div>';
  h+='<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">';
  h+='<div style="font-size:14px;font-weight:700">'+v.vendorName+'</div>';
  h+='<div style="font-size:11px;color:var(--tx2)">'+(v.vendorEmail||'No email')+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">Material: <strong>'+v.material+'</strong> · Qty: '+v.quantity+'</div>';
  if(v.forSONum)h+='<div style="font-size:10px;color:var(--cy)">For SO: '+v.forSONum+'</div>';
  h+='</div>';

  h+='<div style="display:flex;gap:20px;margin-bottom:8px">';
  h+='<div><div style="font-size:10px;color:var(--tx3)">Unit Cost</div><div style="font-size:16px;font-weight:700">'+f$(v.unitCost)+'</div></div>';
  h+='<div><div style="font-size:10px;color:var(--tx3)">Total</div><div style="font-size:16px;font-weight:700;color:var(--rd)">'+f$(v.total)+'</div></div>';
  h+='<div><div style="font-size:10px;color:var(--tx3)">ETA</div><div style="font-size:16px;font-weight:700">'+fD(v.eta)+'</div></div>';
  h+='<div><div style="font-size:10px;color:var(--tx3)">Due</div><div style="font-size:16px;font-weight:700">'+fD(v.dueDate)+'</div></div></div>';

  if(v.receivedAt)h+='<div style="background:#052e16;border:1px solid var(--gn);border-radius:8px;padding:10px;margin-bottom:8px;font-size:11px;color:var(--gn)">✅ Received '+fD(v.receivedAt)+' · Qty: '+(v.receivedQty||v.quantity)+' · Lot# '+(v.lotNumber||'—')+'</div>';

  h+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if(v.status==='sent')h+='<button class="btn btn-gn btn-sm" onclick="receiveVPO(\''+v.id+'\')">📦 Mark Received</button>';
  if(v.status!=='paid')h+='<button class="btn btn-ghost btn-sm" onclick="payVPO(\''+v.id+'\')">💰 Record Payment</button>';
  h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div>';
  openModal(h);
}

function receiveVPO(id){
  var lot=prompt('Lot Number (from material label):');
  var qty=prompt('Quantity Received:');
  db.collection('vendorPOs').doc(id).update({
    status:'received',receivedAt:new Date().toISOString(),receivedBy:userName(),
    receivedQty:qty||null,lotNumber:lot||null,updatedAt:new Date().toISOString()
  }).then(function(){
    toast('Material received + logged','ok');openVPODetail(id);
    // Notify logistics gate if linked to SO
    var v=C.vendorPOs.find(function(x){return x.id===id});
    if(v&&v.forSONum){
      db.collection('activity').add({type:'material.received',vpoNum:v.vpoNum,material:v.material,lotNumber:lot,forSONum:v.forSONum,timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    }
  });
}

function payVPO(id){
  var v=C.vendorPOs.find(function(x){return x.id===id});if(!v)return;
  var bal=(v.total||0)-(v.paidAmount||0);
  var amt=prompt('Payment amount (balance: '+f$(bal)+'):',bal.toFixed(2));
  if(!amt)return;amt=parseFloat(amt);
  var totalPaid=(v.paidAmount||0)+amt;
  var st=totalPaid>=(v.total||0)?'paid':'received';
  db.collection('vendorPOs').doc(id).update({paidAmount:totalPaid,status:st,paidAt:st==='paid'?new Date().toISOString():null,updatedAt:new Date().toISOString()}).then(function(){
    toast('Vendor payment recorded','ok');openVPODetail(id);
  });
}
