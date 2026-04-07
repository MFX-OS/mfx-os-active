// ══════════════════════════════════════════════════════════════════
// MFX OS — VENDOR SYSTEM PATCH FILE
// vendor-patches.js
//
// Load this LAST — after vendor-pos.js, vendor-profile.js, vendor-workspace.js
// Fixes all cross-module wiring gaps identified in ISSUES_AND_FIXES.md
//
// <script src="js/vendor-patches.js"></script>
// ══════════════════════════════════════════════════════════════════

(function(){
'use strict';

// ─── FIX 1: Export private caches to window scope ─────────────────
// vendor-pos IIFE keeps caches private — profile + workspace need them.
// The IIFE-scoped variables (_vpoCache etc.) are NOT accessible here.
// Instead, vendor-pos.js exports its caches via window already (via its
// window.VP and window exports). We use window.VP to access the state.
// If caches already exist on window (set by vendor-pos.js exports), no-op.
function syncCaches(){
  // vendor-pos.js should be exporting these via its window.xxx lines.
  // This is a safety net — if they exist on window already, nothing to do.
  // The old code tried to access IIFE-scoped vars which are always undefined here.
  if(!window._vpoCache)window._vpoCache=[];
  if(!window._vendorCache)window._vendorCache=[];
  if(!window._materialCache)window._materialCache=[];
  if(!window._invoiceCache)window._invoiceCache=[];
  if(!window._lotCache)window._lotCache=[];
}
// Run immediately and after each render cycle
syncCaches();
setInterval(syncCaches,15000); // Fallback poll every 15s

// ─── FIX 3: vpOpenMaterialDetail alias ────────────────────────────
window.vpOpenMaterialDetail=function(id){
  if(typeof window.vpOpenMaterialProfile==='function')window.vpOpenMaterialProfile(id);
};

// ─── FIX 4: vprSendToContact ─────────────────────────────────────
window.vprSendToContact=function(vendorId,email){
  if(!email)return;
  var v=(window._vendorCache||[]).find(function(v){return v.id===vendorId})||{};
  if(typeof window.vprAIDraftEmail==='function'){
    // Temporarily override email target
    var orig=v.email;v.email=email;
    window.vprAIDraftEmail(vendorId,'general');
    v.email=orig;
  }else{
    if(typeof window.sendGmail==='function')window.sendGmail(email,'Re: Microflex Film Corporation','Hello,');
    else toast('No email function available','err');
  }
};

// ─── FIX 5: Route send button to workspace version ────────────────
// Wrap vpSendToVendor to prefer workspace version if loaded
var _origSend=window.vpSendToVendor;
window.vpSendToVendor=function(vpoId){
  if(typeof window.wsSendVPOToVendor==='function'){
    window.wsSendVPOToVendor(vpoId);
  }else if(_origSend){
    _origSend(vpoId);
  }
};

// ─── FIX 6: Tiered approval wiring (server-verified) ────────────
var _origSubmit=window.vpSubmitForApproval;
window.vpSubmitForApproval=function(vpoId){
  var vpo=(window._vpoCache||[]).find(function(p){return p.id===vpoId});
  if(!vpo){if(_origSubmit)_origSubmit(vpoId);return}

  var tier=typeof window.getApprovalTier==='function'
    ?window.getApprovalTier(vpo.total)
    :{label:'CEO',max:Infinity,approver:'CEO'};

  if(tier.approver==='Self-Approve'){
    // Under $500 — self-approve via server transitionStatus
    if(typeof MFXApi!=='undefined'&&MFXApi.postJSON){
      MFXApi.postJSON('/api/transitionStatus',{collection:'vendorPOs',docId:vpoId,newStatus:'approved',note:'Self-approved (under $500)'}).then(function(){
        toast('PO self-approved (under $500)','ok');
        if(typeof MFX!=='undefined'&&MFX.emit)MFX.emit('vpo.approved',{vpoId:vpoId,tier:'self'});
        if(typeof renderVendorPOs==='function')renderVendorPOs();
      }).catch(function(err){toast('Server: '+err.message,'err')});
    }else if(typeof fbDb!=='undefined'){
      fbDb.collection('vendorPOs').doc(vpoId).update({
        status:'approved',approvedBy:typeof getUserName==='function'?getUserName():'User',
        approvedAt:new Date().toISOString(),approvalTier:'Self-Approved (under $500)',updatedAt:new Date().toISOString()
      }).then(function(){toast('PO self-approved','ok');if(typeof renderVendorPOs==='function')renderVendorPOs()});
    }
  }else{
    // Manager or CEO — route to the server-verified approval modal
    if(typeof window.vpCEOApprove==='function'){
      window.vpCEOApprove(vpoId);
    }else if(_origSubmit){
      _origSubmit(vpoId);
    }
  }
};

// ─── FIX 7: Route vpConfirmReceive to workspace version ───────────
var _origConfirmReceive=window.vpConfirmReceive;
window.vpConfirmReceive=function(vpoId){
  var qtyEl=document.getElementById('rcvQty');
  var lotEl=document.getElementById('rcvLot');
  var qty=qtyEl?qtyEl.value:null;
  var lot=lotEl?lotEl.value:null;
  if(typeof closeModal==='function')closeModal();
  if(typeof window.wsMarkVPOReceived==='function'){
    window.wsMarkVPOReceived(vpoId,qty,lot);
  }else if(_origConfirmReceive){
    _origConfirmReceive(vpoId);
  }
};

// ─── FIX 9: Route vpRecordPayment to workspace payment modal ─────
var _origRecordPayment=window.vpRecordPayment;
window.vpRecordPayment=function(vpoId){
  if(typeof window.wsShowPaymentModal==='function'){
    window.wsShowPaymentModal(vpoId);
  }else if(_origRecordPayment){
    _origRecordPayment(vpoId);
  }
};

// ─── FIX 8: Invoice log button → workspace upload modal ──────────
// vprLogVendorInvoice is called from profile — wrap it
var _origLogInvoice=window.vprLogVendorInvoice;
window.vprLogVendorInvoice=function(vendorId){
  // Find most recent received PO for this vendor to log against
  var vpo=(window._vpoCache||[]).filter(function(p){
    var v=(window._vendorCache||[]).find(function(v){return v.id===vendorId});
    return v&&(p.vendorName===v.name||p.vendorId===vendorId)&&(p.status==='received'||p.status==='paid');
  }).sort(function(a,b){return new Date(b.receivedAt)-new Date(a.receivedAt)})[0];

  if(vpo&&typeof window.wsShowInvoiceUploadModal==='function'){
    window.wsShowInvoiceUploadModal(vpo.id);
  }else if(_origLogInvoice){
    _origLogInvoice(vendorId);
  }
};

// ─── FIX 11: Calendar events load when profile Schedule tab opens ─
var _origRenderProfile=window.renderVendorProfile;
if(typeof _origRenderProfile==='function'){
  window.renderVendorProfile=function(){
    _origRenderProfile.apply(this,arguments);
    // Load Google Calendar events when schedule tab is active
    var VPR=window.VPR||{};
    if(VPR.profileTab==='calendar'&&typeof window.vprLoadCalendarEvents==='function'){
      setTimeout(window.vprLoadCalendarEvents,400);
    }
  };
}

// ─── FIX 12: Overdue checker cache guard ─────────────────────────
var _origCheck=window.wsCheckOverduePOs;
window.wsCheckOverduePOs=function(){
  if(!window._vpoCache||!window._vpoCache.length)return; // cache not ready
  if(_origCheck)_origCheck();
};

// ─── BONUS: Wire Invoice Amount quick-log to workspace ────────────
var _origLogInvAmt=window.vprSaveInvoiceMatch;
window.vprSaveInvoiceMatch=function(vpoId){
  var amtEl=document.getElementById('vinvAmt2');
  var numEl=document.getElementById('vinvNum2');
  var amt=amtEl?parseFloat(amtEl.value)||0:0;
  var num=numEl?numEl.value.trim():'';
  if(!amt){if(typeof toast==='function')toast('Amount required','err');return}
  if(typeof window.wsLogVendorInvoiceAndNotifyFinance==='function'){
    if(typeof closeModal==='function')closeModal();
    window.wsLogVendorInvoiceAndNotifyFinance(vpoId,num,amt,null);
  }else if(_origLogInvAmt){
    _origLogInvAmt(vpoId);
  }
};

// ─── BONUS: getApprovalTier export — no hardcoded codes, server enforces roles ─
if(typeof window.getApprovalTier==='undefined'){
  window.getApprovalTier=function(amount){
    var tiers=[
      {label:'Under $500',max:500,approver:'Self-Approve'},
      {label:'$500–$2,500',max:2500,approver:'Manager'},
      {label:'Over $2,500',max:Infinity,approver:'CEO'}
    ];
    for(var i=0;i<tiers.length;i++){if(amount<=tiers[i].max)return tiers[i]}
    return tiers[tiers.length-1];
  };
}

// ─── BONUS: Debug helper ──────────────────────────────────────────
window.mfxVendorDebug=function(){
  console.table({
    '_vpoCache':   (window._vpoCache||[]).length+' POs',
    '_vendorCache':(window._vendorCache||[]).length+' vendors',
    '_materialCache':(window._materialCache||[]).length+' materials',
    '_invoiceCache':(window._invoiceCache||[]).length+' invoices',
    'wsSendVPOToVendor':   typeof window.wsSendVPOToVendor,
    'wsMarkVPOReceived':   typeof window.wsMarkVPOReceived,
    'wsShowInvoiceUploadModal': typeof window.wsShowInvoiceUploadModal,
    'wsShowPaymentModal':  typeof window.wsShowPaymentModal,
    'vprAIDraftEmail':     typeof window.vprAIDraftEmail,
    'getApprovalTier':     typeof window.getApprovalTier,
    'renderVendorPOs':     typeof window.renderVendorPOs,
    'renderVendorProfile': typeof window.renderVendorProfile
  });
};

console.log('✅ MFX Vendor Patches loaded — run mfxVendorDebug() to verify wiring');

})();
