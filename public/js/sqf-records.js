// ======================================================================
// MFX OS -- SQF CONTROLLED RECORDS REGISTER & JOB PACKET ASSEMBLER
// SQF Ed.10 document control matrix with live Firestore + Drive audit
// Drop-in: <script src="js/sqf-records.js"></script>
// ======================================================================

(function(){
  'use strict';

  // ─── STATE ────────────────────────────────────────────────────
  var CR={
    tab:'register',       // register | packets | audit
    register:null,        // cached register from server
    packetLinks:null,     // packet link definitions
    counts:null,          // live collection counts
    driveStatus:null,     // Drive connectivity
    packetCache:{},       // jobTicketId → assembled packet
    selectedTicket:null,  // for packet detail view
    loading:false,
    lastFetchedAt:null
  };

  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_TITLES=window.MFX_VIEW_TITLES||{};
  window.MFX_VIEW_RENDERERS.records=renderRecordsView;
  window.MFX_VIEW_TITLES.records='SQF Controlled Records';

  // ─── HELPERS ──────────────────────────────────────────────────
  function $(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]})}
  function fDate(v){try{var d=new Date(v);if(isNaN(d))return'—';return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch(e){return'—'}}

  // ─── FETCH REGISTER ───────────────────────────────────────────
  function fetchRegister(force){
    if(CR.loading) return;
    if(!force && CR.register && CR.lastFetchedAt && Date.now()-CR.lastFetchedAt<300000) return;
    CR.loading=true;
    if(typeof window.MFXApi!=='undefined' && MFXApi.getControlledRecordsRegister){
      MFXApi.getControlledRecordsRegister().then(function(data){
        CR.register=data.register||[];
        CR.packetLinks=data.packetLinks||[];
        CR.counts=data.counts||{};
        CR.driveStatus=data.drive||{};
        CR.lastFetchedAt=Date.now();
        CR.loading=false;
        renderRecordsView();
      }).catch(function(err){
        CR.loading=false;
        console.warn('Controlled records fetch:',err.message||err);
        // Use local fallback register
        if(!CR.register) CR.register=LOCAL_REGISTER;
        renderRecordsView();
      });
    } else {
      CR.loading=false;
      CR.register=LOCAL_REGISTER;
      renderRecordsView();
    }
  }

  // ─── ASSEMBLE PACKET ─────────────────────────────────────────
  function assemblePacket(jtId, syncToDrive){
    if(!jtId) return;
    CR.loading=true;
    renderRecordsView();
    if(typeof window.MFXApi!=='undefined' && MFXApi.assembleJobPacket){
      MFXApi.assembleJobPacket({jobTicketId:jtId, syncToDrive:!!syncToDrive}).then(function(data){
        CR.packetCache[jtId]=data;
        CR.selectedTicket=jtId;
        CR.tab='packets';
        CR.loading=false;
        renderRecordsView();
        if(typeof toast==='function') toast('Packet assembled — '+data.completeness+'% complete', data.completeness===100?'ok':'err');
      }).catch(function(err){
        CR.loading=false;
        renderRecordsView();
        if(typeof toast==='function') toast('Packet assembly failed: '+(err.message||err),'err');
      });
    }
  }

  // ─── LOCAL FALLBACK REGISTER ──────────────────────────────────
  var LOCAL_REGISTER=[
    {id:'requests',name:'Customer Instructions / RFQs',collection:'requests',sqfClause:'2.1.1',owner:'CSR / Sales',retentionYears:3,purpose:'Customer requirements seeding downstream documents',packetRole:'customerInstruction'},
    {id:'quotes',name:'Approved Quotes',collection:'quotes',sqfClause:'2.1.1',owner:'Sales / CEO',retentionYears:7,purpose:'Priced proposal — becomes contract when accepted',packetRole:'approvedQuote'},
    {id:'salesOrders',name:'Sales Orders',collection:'salesOrders',sqfClause:'2.1.1',owner:'Operations / CEO',retentionYears:7,purpose:'Confirmed order converting quote to production',packetRole:'salesOrder'},
    {id:'jobPassports',name:'Job Passports',collection:'jobPassports',sqfClause:'2.6.1',owner:'Operations',retentionYears:7,purpose:'Master tracking document linking SO to production',packetRole:'jobPassport'},
    {id:'jobTickets',name:'Job Tickets',collection:'jobTickets',sqfClause:'2.6.1',owner:'Pre-Press / Production',retentionYears:7,purpose:'Individual SKU production ticket',packetRole:'jobTicket'},
    {id:'prepressInbox',name:'PrePress Shared Inbox',collection:'prepressInbox',sqfClause:'2.1.3',owner:'Pre-Press Lead',retentionYears:1,purpose:'Ingested customer emails — auditable intake trail',packetRole:'customerInstruction'},
    {id:'blueprints',name:'Art / Proof History',collection:'blueprints',sqfClause:'13.8.4',owner:'Pre-Press',retentionYears:7,purpose:'Version-controlled artwork and proof files',packetRole:'artProofHistory'},
    {id:'approvalRecords',name:'Proof Approval Records',collection:'approvalRecords',sqfClause:'2.5.2',owner:'QA / Pre-Press Lead',retentionYears:7,purpose:'Customer or internal sign-off on proof',packetRole:'approvalRecord'},
    {id:'plateIncidents',name:'Plate Incidents',collection:'plateIncidents',sqfClause:'13.8.6',owner:'Pre-Press Lead / QA',retentionYears:3,purpose:'Plate damage/defect records',packetRole:'ncrCapaLinkage'},
    {id:'prepressQueue',name:'PrePress Execution Queue',collection:'prepressQueue',sqfClause:'2.1.3',owner:'Pre-Press Lead',retentionYears:1,purpose:'Live work queue with SLA tracking'},
    {id:'exceptionOverrides',name:'Exception Overrides',collection:'exceptionOverrides',sqfClause:'2.5.4',owner:'Ops Manager / QA',retentionYears:7,purpose:'Logged deviations from standard process',packetRole:'ncrCapaLinkage'},
    {id:'ppdEvents',name:'PPD Audit Events',collection:'ppdEvents',sqfClause:'2.5.1',owner:'System / QA',retentionYears:3,purpose:'Immutable activity log for PPD actions'},
    {id:'ppdEstimates',name:'PPD Cost Estimates',collection:'ppdEstimates',sqfClause:'2.1.1',owner:'Pre-Press Lead',retentionYears:3,purpose:'Internal cost estimates for plate/proof/setup'},
    {id:'ppdTemplates',name:'PPD Job Templates',collection:'ppdTemplates',sqfClause:'13.8.4',owner:'Pre-Press Lead',retentionYears:5,purpose:'Reusable job setup templates'},
    {id:'equipmentProfiles',name:'Equipment Profiles',collection:'equipmentProfiles',sqfClause:'13.10.1',owner:'Maintenance / Production',retentionYears:10,purpose:'Press/tooling profiles with calibration history'},
    {id:'qcProcedures',name:'QC Procedures',collection:'qcProcedures',sqfClause:'2.5.2',owner:'QA Manager',retentionYears:10,purpose:'Controlled quality procedures and sampling plans'},
    {id:'returnMaterials',name:'Return Materials / RMA',collection:'returnMaterials',sqfClause:'2.6.2',owner:'QA / Customer Service',retentionYears:7,purpose:'Customer returns with root cause and disposition',packetRole:'ncrCapaLinkage'},
    {id:'sqfReleasePackets',name:'Release Packets',collection:'sqfReleasePackets',sqfClause:'2.4.4',owner:'QA Manager',retentionYears:7,purpose:'Aggregated release evidence for shipment clearance',packetRole:'releasePacket'},
    {id:'operatorLogs',name:'Operator Production Logs',collection:'operatorLogs',sqfClause:'13.3.1',owner:'Production Supervisor',retentionYears:3,purpose:'Per-shift operator entries — run counts, waste, downtime',packetRole:'operatorLog'},
    {id:'sqfQualityRecords',name:'QC Evidence Records',collection:'sqfQualityRecords',sqfClause:'2.5.2',owner:'QA Tech / QA Manager',retentionYears:7,purpose:'Inspection results — print, color, seal, contamination',packetRole:'qcEvidence'},
    {id:'shipments',name:'Shipment Records',collection:'shipments',sqfClause:'2.6.1',owner:'Logistics / Shipping',retentionYears:7,purpose:'BOL, packing list, lot traceability',packetRole:'shipmentRecord'},
    {id:'ncrs',name:'NCR / CAPA Records',collection:'ncrs',sqfClause:'2.5.4',owner:'QA Manager',retentionYears:7,purpose:'Non-conformance reports with root cause and corrective actions',packetRole:'ncrCapaLinkage'},
    {id:'receivingQueue',name:'Receiving Work Queue',collection:'receivingQueue',sqfClause:'2.4.4',owner:'QA / Receiving',retentionYears:3,purpose:'SQF 2.4.4 traceability checklist per incoming lot'},
    {id:'sqfMaterials',name:'SQF Material Receiving Log',collection:'sqfMaterials',sqfClause:'13.8.1',owner:'QA / Receiving',retentionYears:3,purpose:'Material receiving inspection log'}
  ];

  // ─── RENDER ───────────────────────────────────────────────────
  function renderRecordsView(){
    var el=$('v-records'); if(!el) return;
    if(!CR.register){ fetchRegister(); }
    var reg=CR.register||LOCAL_REGISTER;

    var h='<div class="ppd-shell" style="max-width:1200px;margin:0 auto">';

    // Header
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">';
    h+='<div><div style="font-size:20px;font-weight:800;color:var(--tx);letter-spacing:-.5px">SQF Controlled Records</div>';
    h+='<div style="font-size:11px;color:var(--tx3)">SQF Edition 10 · Document Control Matrix · MFX-CORE Shared Drive</div></div>';
    h+='<div style="display:flex;gap:6px;align-items:center">';
    // Drive status indicator
    if(CR.driveStatus){
      var dc=CR.driveStatus.connected;
      h+='<span style="font-size:10px;padding:3px 8px;border-radius:4px;background:'+(dc?'rgba(5,150,105,.15)':'rgba(239,68,68,.15)')+';color:'+(dc?'var(--gn)':'var(--rd)')+';font-weight:700">';
      h+='<svg width="8" height="8" viewBox="0 0 8 8" style="margin-right:3px"><circle cx="4" cy="4" r="4" fill="'+(dc?'var(--gn)':'var(--rd)')+'"/></svg>';
      h+=(dc?'MFX-CORE Drive Connected':'Drive Disconnected')+'</span>';
    }
    h+='<button class="btn btn-ghost btn-xs" onclick="window._sqfRecordsFetch(true)" style="font-size:9px">';
    h+='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh</button>';
    h+='</div></div>';

    // Tabs
    h+='<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--bdr);padding-bottom:8px">';
    [['register','Records Register ('+reg.length+')'],['packets','Job Packet Assembler'],['audit','Audit Dashboard']].forEach(function(t){
      var active=CR.tab===t[0];
      h+='<button onclick="window._sqfRecordsTab(\''+t[0]+'\')" style="padding:6px 14px;font-size:11px;font-weight:'+(active?'700':'500')+';color:'+(active?'var(--ac)':'var(--tx3)')+';background:'+(active?'var(--bg3)':'transparent')+';border:1px solid '+(active?'var(--ac)':'transparent')+';border-radius:6px;cursor:pointer">'+t[1]+'</button>';
    });
    h+='</div>';

    // Loading state
    if(CR.loading){
      h+='<div style="text-align:center;padding:40px;color:var(--tx3)"><div style="font-size:24px;margin-bottom:8px;animation:spin 1s linear infinite">&#9696;</div>Loading...</div>';
      h+='</div>';
      el.innerHTML=h;
      return;
    }

    if(CR.tab==='register') h+=renderRegisterTab(reg);
    else if(CR.tab==='packets') h+=renderPacketsTab();
    else if(CR.tab==='audit') h+=renderAuditTab(reg);

    h+='</div>';
    el.innerHTML=h;
  }

  // ─── REGISTER TAB ─────────────────────────────────────────────
  function renderRegisterTab(reg){
    var h='';

    // Summary metrics
    var packetRecs=reg.filter(function(r){return r.packetRole});
    var totalRetention=reg.reduce(function(s,r){return Math.max(s,r.retentionYears||0)},0);
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">';
    h+=metricCard('Total Records',reg.length,'Controlled types');
    h+=metricCard('Packet Records',packetRecs.length,'Required per job');
    h+=metricCard('Max Retention',totalRetention+'y','Longest hold');
    h+=metricCard('SQF Clauses',uniqueClauses(reg),'Referenced');
    h+='</div>';

    // Register table
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;overflow:hidden">';
    h+='<div style="padding:12px 16px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">Controlled Records Register</div>';
    h+='<div style="font-size:9px;color:var(--tx3);letter-spacing:1px">SQF ED.10 DOCUMENT CONTROL</div></div>';

    h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    h+='<thead><tr style="border-bottom:2px solid var(--bdr);background:var(--bg3)">';
    ['Record','SQF','Owner','Retain','Collection','Packet Role','Status'].forEach(function(col){
      h+='<th style="padding:8px 10px;text-align:left;color:var(--tx3);font-size:10px;font-weight:700;letter-spacing:.5px;white-space:nowrap">'+col+'</th>';
    });
    h+='</tr></thead><tbody>';

    reg.forEach(function(r,i){
      var alive=CR.counts&&CR.counts[r.id]?CR.counts[r.id].exists:null;
      var statusColor=alive===true?'var(--gn)':alive===false?'var(--or)':'var(--tx3)';
      var statusLabel=alive===true?'Active':alive===false?'Empty':'—';
      h+='<tr style="border-bottom:1px solid var(--bdr)" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
      h+='<td style="padding:8px 10px"><div style="font-weight:700;color:var(--tx)">'+esc(r.name)+'</div><div style="font-size:9px;color:var(--tx3);margin-top:2px;max-width:280px">'+esc(r.purpose||'')+'</div></td>';
      h+='<td style="padding:8px 10px"><span style="font-size:10px;color:var(--ac);font-weight:700;font-family:var(--mono)">'+esc(r.sqfClause||'')+'</span></td>';
      h+='<td style="padding:8px 10px;color:var(--tx2);white-space:nowrap">'+esc(r.owner||'')+'</td>';
      h+='<td style="padding:8px 10px;text-align:center"><span style="font-size:10px;color:var(--tx);font-weight:700">'+(r.retentionYears||'—')+'y</span></td>';
      h+='<td style="padding:8px 10px"><code style="font-size:9px;color:var(--ac);background:var(--bg3);padding:2px 6px;border-radius:3px;font-family:var(--mono)">'+esc(r.collection||'')+'</code></td>';
      h+='<td style="padding:8px 10px">';
      if(r.packetRole) h+='<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(0,212,245,.1);color:var(--ac);font-weight:600">'+esc(r.packetRole)+'</span>';
      else h+='<span style="font-size:9px;color:var(--tx3)">—</span>';
      h+='</td>';
      h+='<td style="padding:8px 10px"><span style="font-size:9px;color:'+statusColor+';font-weight:700">'+statusLabel+'</span></td>';
      h+='</tr>';
    });

    h+='</tbody></table></div></div>';

    // Drive folder structure reference
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-top:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">MFX-CORE Shared Drive Structure</div>';
    h+='<div style="font-family:var(--mono);font-size:10px;color:var(--tx2);line-height:1.8;background:var(--bg);padding:12px;border-radius:6px;border:1px solid var(--bdr)">';
    h+='<div style="color:var(--ac);font-weight:700">MFX-CORE/</div>';
    h+='<div style="padding-left:16px">';
    var tree=[
      'Clients/',
      '  {Company}/',
      '    {QuoteNum}/',
      '    {JT# . SKU}/',
      '      01_Request/',
      '      02_Source_Art/',
      '      03_Working_Files/',
      '      04_Proofs/',
      '      05_Approvals/',
      '      06_Plates_Tools/',
      '      07_Released/',
      '      08_Obsolete/',
      '      09_Issues_CAPA/',
      '      10_Master_Regs_Exports/',
      '      11_Sync_Audit/',
      'Master Quotes/',
      'Vendor POs/',
      'Vendors/',
      '  {Vendor}/',
      '    POs/ | Invoices/ | Certs/',
      'Equipment/',
      'Production/',
      '  Logs/{date}/',
      'Quality System/',
      '  Procedures/',
      '  Inspections/{date}/',
      '  NCR-CAPA/{ncrNumber}/',
      '  Returns/{rmaNum}/'
    ];
    tree.forEach(function(line){
      var indent=0;while(line.charAt(indent)===' ')indent++;
      var text=line.trim();
      var isFolder=text.charAt(text.length-1)==='/';
      h+='<div style="padding-left:'+(indent*8)+'px;color:'+(isFolder?'var(--ac)':'var(--tx3)')+'">'+esc(text)+'</div>';
    });
    h+='</div></div></div>';

    return h;
  }

  // ─── PACKETS TAB ──────────────────────────────────────────────
  function renderPacketsTab(){
    var h='';

    // Packet chain diagram
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:4px">Minimum Controlled Packet per Released Job</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:12px">SQF Ed.10 requires a complete traceability chain from customer instruction through shipment</div>';

    var links=CR.packetLinks||[
      {role:'customerInstruction',label:'Customer Instruction',required:true},
      {role:'approvedQuote',label:'Approved Quote',required:true},
      {role:'salesOrder',label:'Sales Order',required:true},
      {role:'jobPassport',label:'Job Passport',required:true},
      {role:'jobTicket',label:'Job Ticket',required:true},
      {role:'artProofHistory',label:'Art / Proof History',required:true},
      {role:'approvalRecord',label:'Approval Record',required:true},
      {role:'releasePacket',label:'Release Packet',required:true},
      {role:'operatorLog',label:'Operator Log',required:true},
      {role:'qcEvidence',label:'QC Evidence',required:true},
      {role:'shipmentRecord',label:'Shipment Record',required:false},
      {role:'ncrCapaLinkage',label:'NCR / CAPA Linkage',required:false}
    ];

    h+='<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">';
    links.forEach(function(link,i){
      var bg=link.required?'rgba(0,212,245,.1)':'rgba(245,158,11,.08)';
      var border=link.required?'var(--ac)':'var(--or)';
      h+='<div style="padding:4px 8px;background:'+bg+';border:1px solid '+border+';border-radius:4px;font-size:9px;font-weight:600;color:var(--tx)">';
      h+=esc(link.label);
      if(!link.required) h+=' <span style="color:var(--tx3)">(opt)</span>';
      h+='</div>';
      if(i<links.length-1) h+='<svg width="16" height="12" viewBox="0 0 16 12" style="color:var(--tx3)"><path d="M0 6h12M10 2l4 4-4 4" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
    });
    h+='</div></div>';

    // Assemble form
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Assemble Job Packet</div>';
    h+='<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">';
    h+='<div style="flex:1;min-width:200px"><label style="font-size:10px;color:var(--tx3);display:block;margin-bottom:3px">Job Ticket</label>';
    h+='<select id="sqfr-jt-select" style="width:100%;padding:6px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px">';
    h+='<option value="">Select a job ticket...</option>';
    // Populate from cache
    var jts=getTicketsForSelect();
    jts.forEach(function(jt){
      h+='<option value="'+esc(jt.id)+'">'+esc(jt.jtNum||jt.id)+' · '+esc(jt.company||'')+' · '+esc(jt.skuName||'')+'</option>';
    });
    h+='</select></div>';
    h+='<div class="compliance-boundary" style="margin:0"></div>';
    h+='<button class="btn btn-signoff" onclick="window._sqfAssemblePacket(false)" style="white-space:nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Assemble Packet</button>';
    h+='<button class="btn btn-release" onclick="window._sqfAssemblePacket(true)" style="white-space:nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Assemble + Sync to Drive</button>';
    h+='</div></div>';

    // Show selected packet result
    if(CR.selectedTicket && CR.packetCache[CR.selectedTicket]){
      h+=renderPacketResult(CR.packetCache[CR.selectedTicket]);
    }

    // Previously assembled packets
    var cached=Object.keys(CR.packetCache);
    if(cached.length>0){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-top:16px">';
      h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Recent Packet Assemblies</div>';
      cached.forEach(function(jtId){
        var p=CR.packetCache[jtId];
        var c=p.completeness||0;
        var color=c===100?'var(--gn)':c>=70?'var(--or)':'var(--rd)';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="window._sqfSelectPacket(\''+esc(jtId)+'\')">';
        h+='<div><span style="font-size:11px;font-weight:700;color:var(--tx)">'+esc(p.jtNum||jtId)+'</span>';
        h+='<span style="font-size:10px;color:var(--tx3);margin-left:6px">'+esc(p.company||'')+'</span></div>';
        h+='<div style="display:flex;gap:8px;align-items:center">';
        if(p.gaps&&p.gaps.length) h+='<span style="font-size:9px;color:var(--rd)">'+p.gaps.length+' gap'+(p.gaps.length>1?'s':'')+'</span>';
        h+='<span style="font-size:11px;font-weight:700;color:'+color+'">'+c+'%</span>';
        h+='</div></div>';
      });
      h+='</div>';
    }

    return h;
  }

  function renderPacketResult(p){
    var h='';
    var c=p.completeness||0;
    var color=c===100?'var(--gn)':c>=70?'var(--or)':'var(--rd)';

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:4px solid '+color+';border-radius:0 10px 10px 0;padding:16px">';

    // Header
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    h+='<div><div style="font-size:16px;font-weight:800;color:var(--tx)">'+esc(p.jtNum||p.jobTicketId)+'</div>';
    h+='<div style="font-size:11px;color:var(--tx3)">'+esc(p.company||'')+'</div></div>';
    h+='<div style="text-align:right"><div style="font-size:28px;font-weight:800;color:'+color+'">'+c+'%</div>';
    h+='<div style="font-size:9px;color:var(--tx3)">'+p.presentCount+'/'+p.requiredCount+' required</div></div></div>';

    // Completeness bar
    h+='<div style="height:6px;background:var(--bg3);border-radius:3px;margin-bottom:16px;overflow:hidden">';
    h+='<div style="height:100%;width:'+c+'%;background:'+color+';border-radius:3px;transition:width .3s"></div></div>';

    // Warnings
    if(p.warnings&&p.warnings.length){
      h+='<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:8px;margin-bottom:12px">';
      p.warnings.forEach(function(w){
        h+='<div style="font-size:10px;color:var(--rd);margin-bottom:2px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> '+esc(w)+'</div>';
      });
      h+='</div>';
    }

    // Chain links
    h+='<div style="display:grid;gap:8px">';
    var links=CR.packetLinks||LOCAL_REGISTER;
    var chainOrder=['customerInstruction','approvedQuote','salesOrder','jobPassport','jobTicket','artProofHistory','approvalRecord','releasePacket','operatorLog','qcEvidence','shipmentRecord','ncrCapaLinkage'];
    chainOrder.forEach(function(role){
      var link=p.links&&p.links[role];
      var present=link&&link.present;
      var labelMap={customerInstruction:'Customer Instruction',approvedQuote:'Approved Quote',salesOrder:'Sales Order',jobPassport:'Job Passport',jobTicket:'Job Ticket',artProofHistory:'Art / Proof History',approvalRecord:'Approval Record',releasePacket:'Release Packet',operatorLog:'Operator Log',qcEvidence:'QC Evidence',shipmentRecord:'Shipment Record',ncrCapaLinkage:'NCR / CAPA'};
      var label=labelMap[role]||role;
      var reqd=role!=='shipmentRecord'&&role!=='ncrCapaLinkage';
      var ic=present?'var(--gn)':reqd?'var(--rd)':'var(--or)';

      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg3);border-radius:6px;border-left:3px solid '+ic+'">';
      // Check/X icon
      if(present) h+='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      else h+='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="'+ic+'" stroke-width="2"><circle cx="12" cy="12" r="10"/>'+(reqd?'<line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>':'<line x1="8" y1="12" x2="16" y2="12"/>')+'</svg>';
      h+='<div style="flex:1"><div style="font-size:11px;font-weight:700;color:var(--tx)">'+esc(label)+'</div>';
      // Detail line
      if(link){
        var details=[];
        if(link.num) details.push(link.num);
        if(link.status) details.push(link.status);
        if(link.count) details.push(link.count+' record'+(link.count>1?'s':''));
        if(link.disposition) details.push(link.disposition);
        if(link.bolNumber) details.push('BOL: '+link.bolNumber);
        if(link.ncrCount) details.push(link.ncrCount+' NCR'+(link.ncrCount>1?'s':''));
        if(link.note) details.push(link.note);
        if(details.length) h+='<div style="font-size:9px;color:var(--tx3)">'+esc(details.join(' · '))+'</div>';
      }
      h+='</div>';
      if(!reqd) h+='<span style="font-size:8px;color:var(--tx3);letter-spacing:.5px">OPTIONAL</span>';
      h+='</div>';
    });
    h+='</div>';

    // Manifest sync status
    if(p.manifestSynced!==undefined){
      h+='<div style="margin-top:8px;font-size:10px;color:'+(p.manifestSynced?'var(--gn)':'var(--or)')+'">';
      h+=(p.manifestSynced?'Packet manifest synced to Drive 07_Released/':'Manifest sync skipped')+'</div>';
    }

    h+='</div>';
    return h;
  }

  // ─── AUDIT TAB ────────────────────────────────────────────────
  function renderAuditTab(reg){
    var h='';

    // Retention calendar
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Retention Schedule</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Minimum retention periods per SQF Ed.10 and FDA 21 CFR 117 for food-contact packaging</div>';

    // Group by retention years
    var byRetention={};
    reg.forEach(function(r){
      var y=r.retentionYears||0;
      if(!byRetention[y]) byRetention[y]=[];
      byRetention[y].push(r);
    });
    var years=Object.keys(byRetention).sort(function(a,b){return Number(b)-Number(a)});
    years.forEach(function(y){
      var recs=byRetention[y];
      var barWidth=Math.round((Number(y)/10)*100);
      h+='<div style="margin-bottom:8px">';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">';
      h+='<span style="font-size:12px;font-weight:800;color:var(--ac);min-width:24px">'+y+'y</span>';
      h+='<div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">';
      h+='<div style="height:100%;width:'+barWidth+'%;background:var(--ac);border-radius:3px"></div></div>';
      h+='<span style="font-size:9px;color:var(--tx3);min-width:20px">'+recs.length+'</span></div>';
      h+='<div style="padding-left:32px;display:flex;flex-wrap:wrap;gap:4px">';
      recs.forEach(function(r){
        h+='<span style="font-size:9px;padding:2px 6px;background:var(--bg3);border:1px solid var(--bdr);border-radius:3px;color:var(--tx2)">'+esc(r.name)+'</span>';
      });
      h+='</div></div>';
    });
    h+='</div>';

    // SQF clause coverage
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">SQF Clause Coverage</div>';
    var byClause={};
    reg.forEach(function(r){
      var cl=r.sqfClause||'—';
      if(!byClause[cl]) byClause[cl]=[];
      byClause[cl].push(r);
    });
    var clauseNames={'2.1.1':'Management Commitment','2.1.3':'Communication','2.4.4':'Food Safety / HACCP','2.5.1':'Verification Activities','2.5.2':'Verification Procedures','2.5.4':'Corrective Actions','2.6.1':'Product Traceability','2.6.2':'Product Withdrawal/Recall','13.3.1':'Sanitation','13.8.1':'Raw Materials Receiving','13.8.4':'Packaging Specifications','13.8.6':'Tooling & Equipment','13.10.1':'Calibration'};
    Object.keys(byClause).sort().forEach(function(cl){
      var recs=byClause[cl];
      h+='<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">';
      h+='<span style="font-size:11px;font-weight:700;color:var(--ac);font-family:var(--mono);min-width:50px">'+esc(cl)+'</span>';
      h+='<div style="flex:1"><div style="font-size:10px;color:var(--tx2);margin-bottom:3px">'+(clauseNames[cl]||'')+'</div>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:3px">';
      recs.forEach(function(r){
        h+='<span style="font-size:9px;padding:1px 5px;background:rgba(0,212,245,.08);border:1px solid rgba(0,212,245,.2);border-radius:3px;color:var(--tx)">'+esc(r.name)+'</span>';
      });
      h+='</div></div>';
      h+='<span style="font-size:10px;color:var(--tx3);min-width:20px;text-align:right">'+recs.length+'</span>';
      h+='</div>';
    });
    h+='</div>';

    // Packet role coverage
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Job Packet Role Mapping</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Records that contribute to the minimum controlled packet per released job</div>';
    var roles={};
    reg.forEach(function(r){if(r.packetRole){if(!roles[r.packetRole])roles[r.packetRole]=[];roles[r.packetRole].push(r)}});
    Object.keys(roles).forEach(function(role){
      var recs=roles[role];
      h+='<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">';
      h+='<span style="font-size:10px;font-weight:700;color:var(--ac);min-width:120px">'+esc(role)+'</span>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:3px">';
      recs.forEach(function(r){
        h+='<span style="font-size:9px;padding:1px 5px;background:var(--bg3);border:1px solid var(--bdr);border-radius:3px;color:var(--tx2)">'+esc(r.name)+'</span>';
      });
      h+='</div></div>';
    });
    h+='</div>';

    return h;
  }

  // ─── UTILITY ──────────────────────────────────────────────────
  function metricCard(label,value,sub){
    return '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center">'
      +'<div style="font-size:20px;font-weight:800;color:var(--ac)">'+esc(value)+'</div>'
      +'<div style="font-size:10px;font-weight:600;color:var(--tx)">'+esc(label)+'</div>'
      +'<div style="font-size:9px;color:var(--tx3)">'+esc(sub||'')+'</div></div>';
  }

  function uniqueClauses(reg){
    var seen={};reg.forEach(function(r){if(r.sqfClause)seen[r.sqfClause]=true});
    return Object.keys(seen).length;
  }

  function getTicketsForSelect(){
    // Pull from PPD cache, core cache, or Firestore cache
    if(window.PPD&&window.PPD.tickets) return window.PPD.tickets.slice(0,100);
    if(typeof getJobTickets==='function') return (getJobTickets()||[]).slice(0,100);
    return [];
  }

  // ─── GLOBAL HOOKS ─────────────────────────────────────────────
  window._sqfRecordsFetch=fetchRegister;
  window._sqfRecordsTab=function(tab){CR.tab=tab;renderRecordsView()};
  window._sqfAssemblePacket=function(syncToDrive){
    var sel=$('sqfr-jt-select');
    if(!sel||!sel.value){if(typeof toast==='function')toast('Select a job ticket first','err');return}
    assemblePacket(sel.value, syncToDrive);
  };
  window._sqfSelectPacket=function(jtId){
    CR.selectedTicket=jtId;
    CR.tab='packets';
    renderRecordsView();
  };

  // ─── SIDEBAR REGISTRATION ────────────────────────────────────
  // Add to sidebar under Quality section if the sidebar items hook exists
  if(typeof MFX!=='undefined'&&MFX.on){
    MFX.on('sidebar.ready',function(){
      // Register view for navigation
      if(typeof goView==='function'){
        window._goRecords=function(){goView('records')};
      }
    });
  }

})();
