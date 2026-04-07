// ══════════════════════════════════════════════════════════════
// MFX FINANCE — Core
// Same Firebase project mfx-2026, same Firestore, same Auth
// Trigger: portal fires po.approved → this app picks up
// ══════════════════════════════════════════════════════════════

const FBC={apiKey:"AIzaSyA5N8V4jVNe4pVt3jmjEdbQEfv1lnKj7PM",authDomain:"mfx-2026.web.app",projectId:"mfx-2026",storageBucket:"mfx-2026.firebasestorage.app",messagingSenderId:"21746521413",appId:"1:21746521413:web:7229f14cabaebb1e0a1a2c"};
firebase.initializeApp(FBC);
var db=firebase.firestore();var auth=firebase.auth();
db.enablePersistence({synchronizeTabs:true}).catch(function(){});

var USER=null;var S={tab:'dashboard',invFilter:'all',soFilter:'all'};
var C={invoices:[],quotes:[],customers:[],salesOrders:[],vendors:[],vendorPOs:[],payments:[]};

// ─── Utils ───
function $(id){return document.getElementById(id)}
function f$(n){return'$'+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
function fN(n){return Number(n||0).toLocaleString()}
function fD(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch(e){return'—'}}
function fDT(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return'—'}}
function uid(pre){return(pre||'f')+'_'+Date.now()+'_'+Math.random().toString(36).substr(2,5)}
function toast(msg,type){var el=$('toastEl');el.className='toast toast-'+(type||'ok')+' show';el.textContent=msg;setTimeout(function(){el.classList.remove('show')},3000)}
function openModal(h){$('modalContent').innerHTML=h;$('modalBg').style.display='flex'}
function closeModal(){$('modalBg').style.display='none'}
function userName(){return USER?USER.displayName||USER.email.split('@')[0]:'?'}
function userEmail(){return USER?USER.email:''}

// ─── Auth ───
auth.onAuthStateChanged(function(u){
  if(u){
    if(!u.email.endsWith('@microflexfilm.com')){auth.signOut();alert('Restricted');return}
    USER=u;$('userDisp').textContent=userName();
    // Capture Google token for Gmail API
    var cred=u.providerData&&u.providerData[0];
    initListeners();goTab('dashboard');
  }else{
    $('app').innerHTML='<div style="text-align:center;padding:100px 20px"><div style="font-family:Outfit,Inter,sans-serif;font-size:32px;font-weight:900;color:var(--tx);margin-bottom:2px;letter-spacing:-1px">Microflex</div><div style="font-size:9px;color:var(--tx3);letter-spacing:4px;text-transform:uppercase;margin-bottom:24px">Finance</div><div style="font-size:11px;color:var(--tx3);margin-bottom:20px">Sign in with your @microflexfilm.com account</div><button class="btn btn-pr" onclick="financeSignIn()" style="padding:14px 40px;font-size:14px;box-shadow:0 0 24px rgba(0,229,255,.2)">Sign in with Google</button></div>';
  }
});

// ─── Sign In — redirect-based (desktop-safe) ───
function financeSignIn(){var gp=new firebase.auth.GoogleAuthProvider();gp.setCustomParameters({hd:'microflexfilm.com'});auth.signInWithRedirect(gp)}

// ─── Listeners — all same Firestore ───
function initListeners(){
  // Invoices
  db.collection('invoices').orderBy('createdAt','desc').onSnapshot(function(s){
    C.invoices=s.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    if(S.tab==='dashboard')renderDash();if(S.tab==='invoices')renderInvoices();if(S.tab==='payments')renderPayments();
  });
  // Quotes
  db.collection('quotes').orderBy('updatedAt','desc').limit(200).onSnapshot(function(s){
    C.quotes=s.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    if(S.tab==='dashboard')renderDash();if(S.tab==='incoming')renderIncoming();
  });
  // Customers
  db.collection('customers').orderBy('company').onSnapshot(function(s){
    C.customers=s.docs.map(function(d){return Object.assign({id:d.id},d.data())});
  });
  // Sales Orders
  db.collection('salesOrders').orderBy('createdAt','desc').onSnapshot(function(s){
    C.salesOrders=s.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    if(S.tab==='salesOrders')renderSalesOrders();if(S.tab==='dashboard')renderDash();if(S.tab==='incoming')renderIncoming();
  });
  // Vendors
  db.collection('vendors').orderBy('name').onSnapshot(function(s){
    C.vendors=s.docs.map(function(d){return Object.assign({id:d.id},d.data())});
  });
  // Vendor POs
  db.collection('vendorPOs').orderBy('createdAt','desc').onSnapshot(function(s){
    C.vendorPOs=s.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    if(S.tab==='vendorPOs')renderVendorPOs();
  });

  // ════ THE TRIGGER: Watch for PO submissions from portal ════
  // Deduplication: track processed activity IDs to prevent duplicate SO creation
  var _processedActivityIds={};
  var _ready=false;
  db.collection('activity').where('type','==','po.approved').orderBy('timestamp','desc').limit(20)
    .onSnapshot(function(s){
      s.docChanges().forEach(function(ch){
        if(ch.type!=='added'||!_ready)return;
        var actId=ch.doc.id;
        if(_processedActivityIds[actId])return;
        _processedActivityIds[actId]=true;
        var a=ch.doc.data();if(!a.quoteNum)return;
        console.log('🔔 FINANCE: PO received —',a.quoteNum,'PO#',a.poNumber,'by',a.signedBy);
        toast('🔔 PO received: '+a.quoteNum+' — PO#'+a.poNumber,'ok');
        // Check if SO already exists
        var hasSO=C.salesOrders.some(function(so){return so.quoteNum===a.quoteNum});
        if(!hasSO){
          setTimeout(function(){autoCreateSO(a.quoteId,a.quoteNum,a.poNumber,a.signedBy)},1500);
        }
      });
      _ready=true;
    });

  // ═══ CANONICAL WORKFLOW EVENT SERVICE ═══
  // Watch all workflow events from OS (both client-originated and server-originated)
  var _wsReady=false;
  db.collection('activity')
    .where('type','in',['vpo.sent','vpo.received','vpo.payment_recorded','vpo.invoice_logged','vpo.overdue','vpo.approved','quote.sent','passport.created','so.created'])
    .orderBy('timestamp','desc').limit(50)
    .onSnapshot(function(s){
      s.docChanges().forEach(function(ch){
        if(ch.type!=='added'||!_wsReady)return;
        var actId=ch.doc.id;
        if(_processedActivityIds[actId])return;
        _processedActivityIds[actId]=true;
        var a=ch.doc.data();
        if(a.source==='finance')return;

        // VPO events
        if(a.type==='vpo.invoice_logged'&&a.requiresFinanceReview){
          toast('⚠️ Invoice discrepancy: '+a.vpoNum+' PO $'+Number(a.poAmount||0).toFixed(2)+' vs Invoice $'+Number(a.invoiceAmount||0).toFixed(2)+' — review AP','err');
        }
        if(a.type==='vpo.payment_recorded'){
          toast('💰 Payment recorded in OS: '+a.vpoNum+' $'+Number(a.paymentAmount||0).toFixed(2)+(a.isPaid?' — PAID IN FULL':' — partial'),'ok');
        }
        if(a.type==='vpo.received'){
          toast('📦 Received: '+a.vpoNum+' · '+a.vendorName+(a.lotNumber?' · Lot# '+a.lotNumber:'')+' — invoice expected','ok');
        }
        if(a.type==='vpo.overdue'){
          toast('🔴 OVERDUE: '+a.vpoNum+' · '+a.vendorName+' ('+(a.daysOverdue||'?')+'d past ETA)','err');
        }
        if(a.type==='vpo.approved'){
          toast('✅ VPO Approved: '+(a.vpoNum||'?')+' — '+(a.vendorName||'?')+' $'+Number(a.total||0).toFixed(2),'ok');
        }

        // Quote/SO/Passport events (server-originated)
        if(a.type==='quote.sent'){
          console.log('📧 Quote sent:',a.quoteNum,'to',a.recipient);
        }
        if(a.type==='passport.created'){
          toast('📋 Job Passport '+a.jpNum+' created for '+a.company,'ok');
        }
        if(a.type==='so.created'){
          toast('📋 Sales Order '+a.soNum+' created from PO#'+a.poNumber,'ok');
        }

        if(S.tab==='vendorPOs')renderVendorPOs();
        if(S.tab==='dashboard')renderDash();
      });
      _wsReady=true;
    });
}

// ─── Auto-create Sales Order from PO ───
function autoCreateSO(quoteId,quoteNum,poNumber,signedBy){
  var q=C.quotes.find(function(x){return x.id===quoteId||x.quoteNum===quoteNum});
  if(!q){console.warn('Quote not found for SO:',quoteNum);return}
  var f=q.fields||{};
  var pq=q.pricedQtys||[];
  var selIdx=q.poQtyIndex||0;
  var sel=pq[selIdx]||pq[pq.length-1]||{qty:0,ppu:0,total:0};
  var setup=q.setupTotal||0;
  var fixes=q.fixedCharges||{};
  var fixTotal=(fixes.die||0)+(fixes.plates||0)+(fixes.mr||0)+(fixes.cu||0)+(fixes.shipping||0);

  var d=new Date();var yy=String(d.getFullYear()).slice(2);var mm=String(d.getMonth()+1).padStart(2,'0');
  var cnt=C.salesOrders.length+1;
  var soNum='SO'+yy+mm+'-'+String(cnt).padStart(3,'0');

  var so={
    id:uid('so'),soNum:soNum,
    quoteId:q.id,quoteNum:q.quoteNum,quoteRev:q.rev||'A',
    customerId:null,company:f.custCo||'',contact:f.custAttn||'',
    email:f.custEmail||q.poClientEmail||'',phone:f.custPhone||'',
    address:f.cityState||'',shipTo:q.poShipTo||f.shipTo||'',
    poNumber:poNumber||q.poNumber||'',poSignature:signedBy||q.poSignature||'',
    poSignedAt:q.poSignedAt||new Date().toISOString(),
    poFiles:q.poFiles||[],artFiles:q.artFiles||[],
    jobDesc:(f.sA||'?')+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' '+(f.colors||'?')+'C '+(f.jobType||'Flexo'),
    specs:{sA:f.sA,sar:f.sar,shapeType:f.shapeType,colors:f.colors,nAcross:f.nAcross,face:f.face,laminate:f.laminate,jobType:f.jobType},
    qty:sel.qty||0,ppu:sel.ppu||0,subtotal:sel.total||0,
    setupCharges:fixTotal,tax:0,total:(sel.total||0)+fixTotal,
    terms:f.payTerms||'Net 30',
    allQtys:pq,selectedQtyIndex:selIdx,
    status:'pending',
    approvedBy:null,approvedAt:null,
    sentAt:null,sentTo:null,
    acceptedAt:null,acceptedSignature:null,
    // Workflow gates
    prePressReady:false,logisticsReady:false,releasedToProduction:false,
    createdAt:new Date().toISOString(),createdBy:'System (auto from PO)',
    updatedAt:new Date().toISOString(),
    notes:[]
  };

  db.collection('salesOrders').doc(so.id).set(so).then(function(){
    console.log('✅ SO auto-created:',soNum,'from',quoteNum);
    toast('📋 Sales Order '+soNum+' created from PO#'+poNumber,'ok');
    // Log activity
    db.collection('activity').add({type:'so.created',soNum:soNum,quoteNum:quoteNum,poNumber:poNumber,company:so.company,createdBy:'System',timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    // Notify pre-press and logistics
    db.collection('activity').add({type:'prepress.new',soNum:soNum,quoteNum:quoteNum,company:so.company,artFiles:so.artFiles.length,message:'Art files ready for processing',timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    db.collection('activity').add({type:'logistics.new',soNum:soNum,quoteNum:quoteNum,company:so.company,specs:so.jobDesc,qty:so.qty,message:'Check material availability',timestamp:firebase.firestore.FieldValue.serverTimestamp()});
  }).catch(function(e){toast('SO error: '+e.message,'err')});
}

// ─── Nav ───
function goTab(t){
  S.tab=t;
  document.querySelectorAll('#navTabs a').forEach(function(a,i){a.classList.remove('active')});
  var map={dashboard:0,incoming:1,salesOrders:2,invoices:3,payments:4,vendorPOs:5,vendors:6,reports:7,payroll:8};
  var tabs=document.querySelectorAll('#navTabs a');
  if(tabs[map[t]])tabs[map[t]].classList.add('active');
  ({dashboard:renderDash,incoming:renderIncoming,salesOrders:renderSalesOrders,invoices:renderInvoices,payments:renderPayments,vendorPOs:renderVendorPOs,vendors:renderVendors,reports:renderReports,payroll:renderPayroll})[t]();
}

// ─── Dashboard ───
function renderDash(){
  var inv=C.invoices;var sos=C.salesOrders;var qs=C.quotes;var vp=C.vendorPOs;
  var now=new Date();

  // AR calcs
  var totalAR=inv.filter(function(i){return i.status!=='paid'}).reduce(function(s,i){return s+((i.total||0)-(i.paidAmount||0))},0);
  var overdue=inv.filter(function(i){return i.status!=='paid'&&i.dueDate&&new Date(i.dueDate)<now});
  var overdueAmt=overdue.reduce(function(s,i){return s+((i.total||0)-(i.paidAmount||0))},0);
  var paidMonth=inv.filter(function(i){return i.paidAt&&new Date(i.paidAt).getMonth()===now.getMonth()&&new Date(i.paidAt).getFullYear()===now.getFullYear()}).reduce(function(s,i){return s+(i.paidAmount||0)},0);

  // Quotes needing SO
  var needSO=qs.filter(function(q){return q.status==='won'&&q.poNumber&&!sos.some(function(so){return so.quoteNum===q.quoteNum})});
  // SOs needing invoice
  var needInv=sos.filter(function(so){return(so.status==='shipped'||so.status==='delivered')&&!inv.some(function(i){return i.soNum===so.soNum})});
  // Pending SOs (need approval/green light)
  var pendingSOs=sos.filter(function(so){return so.status==='pending'||so.status==='approved'});
  // AP
  var totalAP=vp.filter(function(v){return v.status!=='paid'}).reduce(function(s,v){return s+((v.total||0)-(v.paidAmount||0))},0);

  var h='<div class="stats-row">';
  h+='<div class="stat-card"><div class="stat-val cyan">'+f$(totalAR)+'</div><div class="stat-lbl">AR OUTSTANDING</div></div>';
  h+='<div class="stat-card"><div class="stat-val '+(overdueAmt>0?'red':'green')+'">'+f$(overdueAmt)+'</div><div class="stat-lbl">AR OVERDUE</div></div>';
  h+='<div class="stat-card"><div class="stat-val green">'+f$(paidMonth)+'</div><div class="stat-lbl">RECEIVED THIS MONTH</div></div>';
  h+='<div class="stat-card"><div class="stat-val orange">'+pendingSOs.length+'</div><div class="stat-lbl">PENDING SALES ORDERS</div></div>';
  h+='<div class="stat-card"><div class="stat-val orange">'+needInv.length+'</div><div class="stat-lbl">NEED INVOICING</div></div>';
  h+='<div class="stat-card"><div class="stat-val red">'+f$(totalAP)+'</div><div class="stat-lbl">AP OUTSTANDING</div></div>';
  h+='</div>';

  // AR Aging
  var cur=0,a30=0,a60=0,a90=0,a90p=0;
  inv.filter(function(i){return i.status!=='paid'}).forEach(function(i){
    var bal=(i.total||0)-(i.paidAmount||0);var due=i.dueDate?new Date(i.dueDate):new Date(i.createdAt);
    var days=Math.floor((now-due)/(86400000));
    if(days<=0)cur+=bal;else if(days<=30)a30+=bal;else if(days<=60)a60+=bal;else if(days<=90)a90+=bal;else a90p+=bal;
  });
  var at=cur+a30+a60+a90+a90p||1;
  h+='<div class="card"><div class="card-h">AR Aging</div>';
  h+='<div class="aging-bar"><div style="width:'+Math.round(cur/at*100)+'%;background:var(--gn)"></div><div style="width:'+Math.round(a30/at*100)+'%;background:var(--cy)"></div><div style="width:'+Math.round(a60/at*100)+'%;background:var(--or)"></div><div style="width:'+Math.round(a90/at*100)+'%;background:#ef4444"></div><div style="width:'+Math.round(a90p/at*100)+'%;background:#991b1b"></div></div>';
  h+='<div style="display:flex;gap:14px;font-size:10px;color:var(--tx3);margin-top:6px;flex-wrap:wrap"><span style="color:var(--gn)">Current '+f$(cur)+'</span><span style="color:var(--cy)">1-30 '+f$(a30)+'</span><span style="color:var(--or)">31-60 '+f$(a60)+'</span><span style="color:#ef4444">61-90 '+f$(a90)+'</span><span style="color:#991b1b">90+ '+f$(a90p)+'</span></div></div>';

  // Won quotes needing SO
  if(needSO.length){
    h+='<div class="card"><div class="card-h">PO Received — Need Sales Order <span class="badge">'+needSO.length+'</span></div>';
    h+='<table class="tbl"><tr><th>Quote</th><th>Client</th><th>PO#</th><th>Signed By</th><th>Files</th><th>Amount</th><th></th></tr>';
    needSO.forEach(function(q){
      var pf=(q.poFiles||[]).length;var af=(q.artFiles||[]).length;
      h+='<tr><td class="mono">'+q.quoteNum+'</td><td>'+(q.fields?q.fields.custCo:'—')+'</td><td>'+q.poNumber+'</td><td>'+(q.poSignature||'—')+'</td>';
      h+='<td>'+(pf?'📎'+pf:'—')+' '+(af?'🎨'+af:'')+'</td>';
      h+='<td class="amt green">'+(q.wonAmount?f$(q.wonAmount):'—')+'</td>';
      h+='<td><button class="btn btn-pr btn-xs" onclick="autoCreateSO(\''+q.id+'\',\''+q.quoteNum+'\',\''+(q.poNumber||'')+'\',\''+(q.poSignature||'')+'\')">Create SO</button></td></tr>';
    });
    h+='</table></div>';
  }

  // Pending SOs with green light gates
  if(pendingSOs.length){
    h+='<div class="card"><div class="card-h">Sales Orders — Awaiting Green Light <span class="badge">'+pendingSOs.length+'</span></div>';
    h+='<table class="tbl"><tr><th>SO#</th><th>Client</th><th>Quote</th><th>Pre-Press</th><th>Logistics</th><th>Amount</th><th></th></tr>';
    pendingSOs.forEach(function(so){
      var pp=so.prePressReady?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">⬜</span>';
      var lg=so.logisticsReady?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">⬜</span>';
      h+='<tr onclick="openSODetail(\''+so.id+'\')" style="cursor:pointer"><td class="mono">'+so.soNum+'</td><td>'+so.company+'</td><td class="mono">'+so.quoteNum+'</td>';
      h+='<td style="text-align:center">'+pp+'</td><td style="text-align:center">'+lg+'</td>';
      h+='<td class="amt">'+f$(so.total)+'</td>';
      h+='<td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openSODetail(\''+so.id+'\')">View</button></td></tr>';
    });
    h+='</table></div>';
  }

  // Recent invoices
  h+='<div class="card"><div class="card-h">Recent Invoices</div>';
  if(inv.length){
    h+='<table class="tbl"><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Balance</th><th>Status</th><th>Due</th></tr>';
    inv.slice(0,8).forEach(function(i){
      var bal=(i.total||0)-(i.paidAmount||0);
      h+='<tr onclick="openInvDetail(\''+i.id+'\')" style="cursor:pointer"><td class="mono">'+i.invoiceNum+'</td><td>'+i.company+'</td><td class="amt">'+f$(i.total)+'</td><td class="amt '+(bal>0?'red':'green')+'">'+f$(bal)+'</td><td><span class="pill pill-'+i.status+'">'+i.status+'</span></td><td style="font-size:10px">'+fD(i.dueDate)+'</td></tr>';
    });
    h+='</table>';
  }else{h+='<div class="empty">No invoices yet</div>'}
  h+='</div>';

  $('app').innerHTML=h;
}

// ─── Number generators ───
function genSONum(){var d=new Date();return'SO'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+'-'+String(C.salesOrders.length+1).padStart(3,'0')}
function genInvNum(){var d=new Date();var n=C.invoices.length+1;return'INV'+String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+'-'+String(n).padStart(3,'0')}

// ══════════════════════════════════════════════════════════════
// INCOMING ORDERS INBOX
// Shows pipeline: POs received → pending SOs → awaiting CEO approval
// ══════════════════════════════════════════════════════════════
function renderIncoming(){
  var sos=C.salesOrders;var qs=C.quotes;
  var now=new Date();

  // 1) Incoming POs with no SO yet
  var needSO=qs.filter(function(q){return q.status==='won'&&q.poNumber&&!sos.some(function(so){return so.quoteNum===q.quoteNum})});
  // 2) SOs pending CEO approval
  var pendingApproval=sos.filter(function(so){return so.status==='pending'});
  // 3) SOs approved, awaiting production release
  var approved=sos.filter(function(so){return so.status==='approved'});
  // 4) Recently created SOs (last 30 days) — full pipeline view
  var recent=sos.filter(function(so){var d=new Date(so.createdAt);return(now-d)<(30*86400000)});

  var total=needSO.length+pendingApproval.length+approved.length;

  var h='<div class="card"><div class="card-h" style="display:flex;align-items:center;gap:10px">Incoming Orders Inbox';
  if(total)h+=' <span class="badge" style="background:var(--ac);color:#000;font-size:11px;padding:2px 8px;border-radius:10px">'+total+' action needed</span>';
  h+='</div>';

  // ── Section 1: New POs needing Sales Orders ──
  if(needSO.length){
    h+='<div style="margin-bottom:16px">';
    h+='<div style="font-size:10px;color:var(--or);font-weight:700;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:6px">⏳ PO RECEIVED — AWAITING SALES ORDER <span class="badge" style="background:var(--or);color:#000">'+needSO.length+'</span></div>';
    h+='<table class="tbl"><tr><th>Quote</th><th>Client</th><th>PO#</th><th>Signed By</th><th>Art Files</th><th>Amount</th><th>Date Received</th><th></th></tr>';
    needSO.forEach(function(q){
      var af=(q.artFiles||[]).length;var pf=(q.poFiles||[]).length;
      var recvDate=q.poSignedAt||q.updatedAt||q.createdAt;
      h+='<tr><td class="mono">'+q.quoteNum+'</td><td><strong>'+(q.fields?q.fields.custCo:'—')+'</strong></td>';
      h+='<td>'+q.poNumber+'</td><td>'+(q.poSignature||'—')+'</td>';
      h+='<td>'+(pf?'📎'+pf+' ':'')+(af?'🎨'+af:'—')+'</td>';
      h+='<td class="amt green">'+(q.wonAmount?f$(q.wonAmount):'—')+'</td>';
      h+='<td style="font-size:10px">'+fD(recvDate)+'</td>';
      h+='<td><button class="btn btn-pr btn-xs" onclick="autoCreateSO(\''+q.id+'\',\''+q.quoteNum+'\',\''+(q.poNumber||'')+'\',\''+(q.poSignature||'')+'\')">Create SO</button></td></tr>';
    });
    h+='</table></div>';
  }

  // ── Section 2: Pending CEO Approval ──
  if(pendingApproval.length){
    h+='<div style="margin-bottom:16px">';
    h+='<div style="font-size:10px;color:#f59e0b;font-weight:700;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:6px">🔒 PENDING CEO APPROVAL <span class="badge" style="background:#f59e0b;color:#000">'+pendingApproval.length+'</span></div>';
    h+='<table class="tbl"><tr><th>SO#</th><th>Client</th><th>Quote</th><th>PO#</th><th>Job</th><th>Qty</th><th>Total</th><th>Created</th><th></th></tr>';
    pendingApproval.forEach(function(so){
      h+='<tr><td class="mono">'+so.soNum+'</td><td><strong>'+so.company+'</strong></td>';
      h+='<td class="mono">'+so.quoteNum+'</td><td style="font-size:10px">'+so.poNumber+'</td>';
      h+='<td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis">'+so.jobDesc+'</td>';
      h+='<td>'+fN(so.qty)+'</td><td class="amt">'+f$(so.total)+'</td>';
      h+='<td style="font-size:10px">'+fD(so.createdAt)+'</td>';
      h+='<td style="display:flex;gap:4px"><button class="btn btn-gn btn-xs" onclick="ceoApprove(\''+so.id+'\')">✅ Approve</button>';
      h+='<button class="btn btn-ghost btn-xs" onclick="openSODetail(\''+so.id+'\')">View</button></td></tr>';
    });
    h+='</table></div>';
  }

  // ── Section 3: Approved — Awaiting Gates/Production ──
  if(approved.length){
    h+='<div style="margin-bottom:16px">';
    h+='<div style="font-size:10px;color:var(--gn);font-weight:700;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:6px">✅ CEO APPROVED — AWAITING PRODUCTION GATES <span class="badge" style="background:var(--gn);color:#000">'+approved.length+'</span></div>';
    h+='<table class="tbl"><tr><th>SO#</th><th>Client</th><th>Quote</th><th>Pre-Press</th><th>Logistics</th><th>Total</th><th>Approved</th><th></th></tr>';
    approved.forEach(function(so){
      var pp=so.prePressReady?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">⬜</span>';
      var lg=so.logisticsReady?'<span style="color:var(--gn)">✅</span>':'<span style="color:var(--tx3)">⬜</span>';
      h+='<tr><td class="mono">'+so.soNum+'</td><td>'+so.company+'</td><td class="mono">'+so.quoteNum+'</td>';
      h+='<td style="text-align:center">'+pp+'</td><td style="text-align:center">'+lg+'</td>';
      h+='<td class="amt">'+f$(so.total)+'</td>';
      h+='<td style="font-size:10px">'+fD(so.approvedAt)+'</td>';
      h+='<td><button class="btn btn-ghost btn-xs" onclick="openSODetail(\''+so.id+'\')">View</button></td></tr>';
    });
    h+='</table></div>';
  }

  // ── Section 4: Pipeline Overview — Last 30 Days ──
  h+='<div style="margin-top:12px">';
  h+='<div style="font-size:10px;color:var(--cy);font-weight:700;letter-spacing:1px;margin-bottom:6px">📋 ORDER PIPELINE — LAST 30 DAYS ('+recent.length+')</div>';
  if(recent.length){
    h+='<table class="tbl"><tr><th>SO#</th><th>Client</th><th>PO#</th><th>Qty</th><th>Total</th><th>Status</th><th>Expected</th><th>Created</th></tr>';
    recent.forEach(function(so){
      // Estimate expected date: approvedAt + 14 days or createdAt + 21 days
      var base=so.approvedAt?new Date(so.approvedAt):new Date(so.createdAt);
      var lead=so.status==='pending'?21:so.status==='approved'?14:so.status==='production'?7:0;
      var expected=new Date(base.getTime()+(lead*86400000));
      var expClass=expected<now&&so.status!=='delivered'&&so.status!=='invoiced'?'red':'';
      h+='<tr onclick="openSODetail(\''+so.id+'\')" style="cursor:pointer">';
      h+='<td class="mono">'+so.soNum+'</td><td>'+so.company+'</td><td style="font-size:10px">'+so.poNumber+'</td>';
      h+='<td>'+fN(so.qty)+'</td><td class="amt">'+f$(so.total)+'</td>';
      h+='<td><span class="pill pill-'+so.status+'">'+so.status+'</span></td>';
      h+='<td style="font-size:10px" class="'+expClass+'">'+fD(expected)+'</td>';
      h+='<td style="font-size:10px">'+fD(so.createdAt)+'</td></tr>';
    });
    h+='</table>';
  }else{h+='<div class="empty">No orders in the last 30 days</div>'}
  h+='</div>';

  if(!needSO.length&&!pendingApproval.length&&!approved.length&&!recent.length){
    h+='<div class="empty" style="padding:40px">No incoming orders. When a client submits a PO through the portal, it will appear here automatically.</div>';
  }
  h+='</div>';
  $('app').innerHTML=h;
}

// ─── CEO Approval (enhanced) ───
function ceoApprove(soId){
  var so=C.salesOrders.find(function(x){return x.id===soId});if(!so)return;
  var h='<div class="modal-title">CEO Approval Required</div>';
  h+='<div style="background:var(--bg3);border-radius:8px;padding:16px;margin-bottom:12px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:start">';
  h+='<div><div style="font-size:18px;font-weight:800">'+so.soNum+'</div>';
  h+='<div style="font-size:14px;font-weight:600;color:var(--tx)">'+so.company+'</div>';
  h+='<div style="font-size:11px;color:var(--tx3)">'+so.jobDesc+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">PO# '+so.poNumber+' · Quote: '+so.quoteNum+'</div></div>';
  h+='<div style="text-align:right"><div style="font-size:10px;color:var(--tx3)">Order Total</div>';
  h+='<div style="font-size:24px;font-weight:900;color:var(--ac)">'+f$(so.total)+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3)">'+fN(so.qty)+' units @ '+f$(so.ppu)+'/ea</div></div></div></div>';

  h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
  h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--tx3)">Terms</div><div style="font-size:13px;font-weight:700">'+(so.terms||'Net 30')+'</div></div>';
  h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--tx3)">PO Signed</div><div style="font-size:13px;font-weight:700">'+fD(so.poSignedAt)+'</div></div>';
  h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--tx3)">Art Files</div><div style="font-size:13px;font-weight:700">'+((so.artFiles||[]).length||0)+'</div></div></div>';

  h+='<div style="text-align:center;padding:12px">';
  h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Enter CEO approval code to authorize this sales order</div>';
  h+='<input type="password" id="ceoCodeInput" placeholder="Approval Code" style="padding:10px 20px;font-size:16px;text-align:center;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;color:var(--tx);width:160px;margin-bottom:12px" onkeydown="if(event.key===\'Enter\')submitCeoApproval(\''+so.id+'\')">';
  h+='<div style="display:flex;gap:8px;justify-content:center">';
  h+='<button class="btn btn-gn" onclick="submitCeoApproval(\''+so.id+'\')" style="padding:10px 30px;font-size:14px">✅ Approve Order</button>';
  h+='<button class="btn btn-ghost" onclick="rejectSO(\''+so.id+'\')" style="padding:10px 20px">❌ Reject</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  h+='</div></div>';
  openModal(h);
  setTimeout(function(){var inp=$('ceoCodeInput');if(inp)inp.focus()},100);
}

function submitCeoApproval(soId){
  var code=$('ceoCodeInput')?$('ceoCodeInput').value:'';
  if(code!=='2057'){toast('Invalid approval code','err');return}
  db.collection('salesOrders').doc(soId).update({
    status:'approved',approvedBy:userName(),approvedAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  }).then(function(){
    var so=C.salesOrders.find(function(s){return s.id===soId});
    toast('✅ '+so.soNum+' approved by CEO','ok');
    db.collection('activity').add({type:'so.approved',soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,approvedBy:userName(),message:'CEO approved — proceed with gates',timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    closeModal();
    if(S.tab==='incoming')renderIncoming();
  });
}

function rejectSO(soId){
  var reason=prompt('Rejection reason:');if(!reason)return;
  db.collection('salesOrders').doc(soId).update({
    status:'rejected',rejectedBy:userName(),rejectedAt:new Date().toISOString(),
    rejectionReason:reason,updatedAt:new Date().toISOString()
  }).then(function(){
    var so=C.salesOrders.find(function(s){return s.id===soId});
    toast('❌ '+so.soNum+' rejected','err');
    db.collection('activity').add({type:'so.rejected',soNum:so.soNum,quoteNum:so.quoteNum,company:so.company,rejectedBy:userName(),reason:reason,timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    closeModal();
    if(S.tab==='incoming')renderIncoming();
  });
}

// Placeholders for tabs loaded from other files
function renderVendors(){$('app').innerHTML='<div class="card"><div class="card-h">Vendors</div><div class="empty">Vendor management — next session</div></div>'}
function renderReports(){$('app').innerHTML='<div class="card"><div class="card-h">Reports</div><div class="empty">P&L, Balance Sheet, Cash Flow — next session</div></div>'}
function renderPayroll(){$('app').innerHTML='<div class="card"><div class="card-h">Payroll</div><div class="empty">Time tracking + payroll export — next session</div></div>'}
