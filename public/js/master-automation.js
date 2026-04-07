// ======================================================================
// MFX OS -- MASTER AUTOMATION STATUS & SYSTEM HEALTH DASHBOARD
// Comprehensive view of ALL workflows, triggers, automations, records,
// and links to Drive/Firestore. SQF Ed.10 compliance overlay.
// ======================================================================

(function(){
  'use strict';

  // ─── STATE ────────────────────────────────────────────────────
  var MA={
    tab:'overview',  // overview | automations | records | health | drive
    loading:false,
    health:{},       // module → health info
    automations:[],  // computed on render
    lastCheck:null
  };

  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_TITLES=window.MFX_VIEW_TITLES||{};
  window.MFX_VIEW_RENDERERS.masterauto=renderMasterAuto;
  window.MFX_VIEW_TITLES.masterauto='Master Automation & System Status';

  // ─── HELPERS ──────────────────────────────────────────────────
  function $(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]})}

  // ─── MODULE REGISTRY ──────────────────────────────────────────
  // Every module in the system with its role, automations, and health checks
  var MODULES=[
    {id:'quotes',name:'Quote Engine',dept:'Sales',file:'app.js',
     sqf:['2.1.1'],
     automations:['Auto-number (Q-YYYY-NNN)','CEO approval workflow','Auto-save to Drive on approval','Registry auto-add','PDF generation','Email-to-client','Revision chain tracking','Pricing lock on approval','Client activity log','Collaboration invite'],
     triggers:['New quote created','Quote submitted for approval','CEO approves/rejects','Quote sent to client','Revision created'],
     collections:['quotes','quoteTemplates'],
     driveFolder:'Clients/{Company}/{QuoteNum}/',
     status:'active'},

    {id:'salesorders',name:'Sales Orders',dept:'Operations',file:'orders.js',
     sqf:['2.1.1','2.6.1'],
     automations:['SO number generation','CEO approval gate','Status state machine (draft→approved→in_production→shipped→invoiced→closed)','Job passport auto-create','Auto-link to quote'],
     triggers:['SO created from quote','SO approved','SO status transition','SO linked to production'],
     collections:['salesOrders'],
     driveFolder:'Clients/{Company}/{SONum}/',
     status:'active'},

    {id:'ppd',name:'Pre-Press Design (PPD)',dept:'Pre-Press',file:'ppd.js',
     sqf:['2.1.3','2.5.1','13.8.4','13.8.6'],
     automations:['13-stage state machine','Job ticket auto-creation','Workbench kanban board','SLA countdown timer','Drive workspace provisioning','Proof approval capture','Plate incident logging','Blueprint versioning','Cost estimation engine','Exception override logging','Transition audit trail'],
     triggers:['Job ticket created','Status transition (13 stages)','Proof uploaded','Approval received','Plate incident reported','Exception override','SLA breach alert'],
     collections:['jobTickets','jobPassports','prepressInbox','prepressQueue','blueprints','approvalRecords','plateIncidents','ppdEvents','ppdEstimates','ppdTemplates','exceptionOverrides','controlConfigs'],
     driveFolder:'Clients/{Company}/{JT# . SKU}/01-11_subfolders/',
     status:'active'},

    {id:'vendorpos',name:'Vendor PO System',dept:'Purchasing',file:'vendor-pos.js',
     sqf:['2.1.1'],
     automations:['VPO number generation','3-tier approval (Self/$500, Manager/$2500, CEO/$2500+)','Status lifecycle (draft→pending→approved→sent→received→paid)','Overdue VPO detection','Auto-receipt matching','Budget tracking'],
     triggers:['VPO created','VPO submitted for approval','VPO approved/rejected','VPO sent to vendor','Material received','Invoice matched'],
     collections:['vendorPOs','vendorInvoices'],
     driveFolder:'Vendor POs/',
     status:'active'},

    {id:'vendorprofile',name:'Vendor Management',dept:'Quality / Purchasing',file:'vendor-profile.js',
     sqf:['2.1.1','13.8.1'],
     automations:['SQF status tracking (Approved/Conditional/Probation/Disqualified)','Cert expiration alerts','Scorecard generation','Communication log','Material catalog linking','Insurance tracking'],
     triggers:['Vendor created/updated','Cert uploaded/expired','SQF status changed','Scorecard generated'],
     collections:['vendors','vendorComms','materials','materialLots'],
     driveFolder:'Vendors/{VendorName}/Certs|Invoices/',
     status:'active'},

    {id:'audit',name:'SQF Audit Manager',dept:'Quality',file:'audit.js',
     sqf:['2.5.1','2.5.2'],
     automations:['Audit scheduling','Finding tracking','Management review workflow','Evidence capture with e-signature','SQF clause mapping','Corrective action linkage','Dashboard with Firestore live data'],
     triggers:['Audit created/scheduled','Finding logged','Management review submitted','Evidence captured','Corrective action assigned'],
     collections:['audits','managementReviews'],
     driveFolder:'Quality System/Inspections/{date}/',
     status:'active'},

    {id:'capa',name:'NCR / CAPA System',dept:'Quality',file:'capa.js',
     sqf:['2.5.4'],
     automations:['NCR auto-numbering (timestamp-based)','Root cause analysis workflow','Corrective action tracking','CAPA effectiveness review','Escalation triggers','Linkage to audits/complaints'],
     triggers:['NCR created','Root cause identified','Corrective action assigned/completed','CAPA review due','Escalation threshold'],
     collections:['ncrs','capaSuggestions'],
     driveFolder:'Quality System/NCR-CAPA/{ncrNumber}/',
     status:'active'},

    {id:'fsqms',name:'FSQMS (Food Safety QMS)',dept:'Quality',file:'fsqms-module.js',
     sqf:['11.1','11.2','11.3','11.4','11.5','11.6','11.7','11.8'],
     automations:['Sanitation log tracking','Quality check recording','Materials receiving log','Dual-write persistence (localStorage + Firestore)','Alert system','Trend analysis'],
     triggers:['Sanitation log entry','Quality deviation recorded','Material received','Alert threshold breached'],
     collections:['fsqmsSanitation','fsqmsQuality','fsqmsMaterials'],
     driveFolder:null,
     status:'active'},

    {id:'datalogs',name:'SQF Data Logs',dept:'Quality / Production',file:'sqf-datalogs.js',
     sqf:['11.1','11.2','13.3.1','13.8.1'],
     automations:['Sanitation inspection tracking','Facilities maintenance log','Quality control records','Materials receiving with hold tags','Work order generation','Variance calculation','Alert escalation','Firestore real-time sync'],
     triggers:['Log entry created','Hold tag issued','Work order generated','Variance exceeds threshold','Alert escalated'],
     collections:['sqfSanitation','sqfFacilities','sqfQuality','sqfMaterials'],
     driveFolder:null,
     status:'active'},

    {id:'gmp',name:'GMP Inspections',dept:'Quality',file:'gmp.js',
     sqf:['11.1','11.2','11.4'],
     automations:['Zone-based inspection checklist','Temperature/humidity readings','Corrective action capture','Trend reporting','Pass/fail scoring'],
     triggers:['GMP inspection started','Inspection completed','Corrective action needed','Reading out of range'],
     collections:['gmpInspections','gmpReadings'],
     driveFolder:null,
     status:'active'},

    {id:'training',name:'SQF Training',dept:'Quality / HR',file:'training.js',
     sqf:['2.9'],
     automations:['Training record tracking','Competency assessment','Cert expiration alerts','SQF module mapping','Training schedule management'],
     triggers:['Training completed','Cert expires','Assessment due','New employee onboarded'],
     collections:['trainingRecords'],
     driveFolder:null,
     status:'active'},

    {id:'doccontrol',name:'Document Control',dept:'Quality',file:'sqf-doccontrol.js',
     sqf:['2.5.2'],
     automations:['Document change request (DCR) workflow','Version control','Distribution tracking','Review/approval cycle','Obsolete document archival'],
     triggers:['DCR submitted','Document approved','Distribution completed','Review due'],
     collections:['dcrs','distributions'],
     driveFolder:'Quality System/Procedures/',
     status:'active'},

    {id:'records',name:'Controlled Records Register',dept:'Quality',file:'sqf-records.js',
     sqf:['2.1.1','2.5.2'],
     automations:['24-collection register matrix','Job packet assembly','Packet completeness scoring','Drive manifest sync','Retention schedule tracking','SQF clause coverage mapping'],
     triggers:['Register refresh','Packet assembled','Drive sync initiated'],
     collections:['All 24 controlled collections'],
     driveFolder:'All mapped folders',
     status:'active'},

    {id:'chat',name:'Team Chat',dept:'All',file:'chat.js',
     sqf:[],
     automations:['Real-time messaging','Thread support','File attachments','Channel management','DM support','Listener auto-cleanup on navigate'],
     triggers:['Message sent','Channel created','File uploaded'],
     collections:['chat_channels','chat_messages','dms','messages','replies'],
     driveFolder:null,
     status:'active'},

    {id:'realtime',name:'Real-time Sync',dept:'System',file:'realtime.js',
     sqf:[],
     automations:['Presence tracking','Live data sync via onSnapshot','Cross-tab coordination','Activity feed','Connection status indicator'],
     triggers:['User goes online/offline','Data changed','Tab focused'],
     collections:['presence','activity','microfeed'],
     driveFolder:null,
     status:'active'},

    {id:'notifications',name:'Notification System',dept:'System',file:'notifications.js',
     sqf:[],
     automations:['Push notification dispatch','In-app notification bell','Read/unread tracking','Priority escalation'],
     triggers:['Event emitted on bus','Approval needed','SLA breach','System alert'],
     collections:['notifications'],
     driveFolder:null,
     status:'active'},

    {id:'platform',name:'Platform Services',dept:'System',file:'platform-services.js',
     sqf:[],
     automations:['API client for all Cloud Functions','Token management','Request batching','Error handling'],
     triggers:['API call initiated','Token expired','Error response'],
     collections:[],
     driveFolder:null,
     status:'active'}
  ];

  // ─── CLOUD FUNCTIONS ──────────────────────────────────────────
  var CLOUD_FUNCTIONS=[
    {id:'uploadToDrive',name:'Upload to Drive',endpoint:'/api/uploadToDrive',method:'POST',auth:'Bearer token',purpose:'Upload files to MFX-CORE Shared Drive',sqf:['2.5.2'],rewrite:true},
    {id:'getClientFolder',name:'Get Client Folder',endpoint:'/api/getClientFolder',method:'POST',auth:'Bearer token',purpose:'Get or create client folder structure on Drive',sqf:['2.1.1'],rewrite:true},
    {id:'nextSequence',name:'Next Sequence',endpoint:'/api/nextSequence',method:'POST',auth:'Bearer token',purpose:'Atomic counter for quote/SO/VPO numbering',sqf:[],rewrite:true},
    {id:'provisionPPDWorkspace',name:'Provision PPD Workspace',endpoint:'/api/provisionPPDWorkspace',method:'POST',auth:'Bearer token',purpose:'Create 11-subfolder workspace on Drive for job tickets',sqf:['13.8.4'],rewrite:true},
    {id:'ingestSharedInbox',name:'Ingest Shared Inbox',endpoint:'/api/ingestSharedInbox',method:'POST',auth:'Bearer token',purpose:'Pull emails from shared Gmail to pre-press inbox',sqf:['2.1.3'],rewrite:true},
    {id:'ceoApprove',name:'CEO Approve',endpoint:'/api/ceoApprove',method:'POST',auth:'Bearer token + role check',purpose:'Server-side approval with role validation',sqf:['2.1.1'],rewrite:true},
    {id:'transitionStatus',name:'Transition Status',endpoint:'/api/transitionStatus',method:'POST',auth:'Bearer token + role check',purpose:'Validated PPD state transitions with audit trail',sqf:['2.5.1'],rewrite:true},
    {id:'saveQuotePDF',name:'Save Quote PDF',endpoint:'/api/saveQuotePDF',method:'POST',auth:'Bearer token',purpose:'Generate and save quote PDF to Drive',sqf:['2.1.1'],rewrite:true},
    {id:'processVPOApproval',name:'Process VPO Approval',endpoint:'/api/processVPOApproval',method:'POST',auth:'Bearer token + role check',purpose:'Server-side VPO approval with tier validation',sqf:['2.1.1'],rewrite:true},
    {id:'checkOverdueVPOs',name:'Check Overdue VPOs',endpoint:'/api/checkOverdueVPOs',method:'POST',auth:'Bearer token',purpose:'Scan for overdue vendor POs and flag alerts',sqf:[],rewrite:true},
    {id:'createPassport',name:'Create Passport',endpoint:'/api/createPassport',method:'POST',auth:'Bearer token',purpose:'Create job passport linking SO to production',sqf:['2.6.1'],rewrite:true},
    {id:'ppdHealthCheck',name:'PPD Health Check',endpoint:'/api/ppdHealthCheck',method:'POST',auth:'Bearer token',purpose:'Audit PPD pipeline for stale/stuck tickets',sqf:['2.5.1'],rewrite:true},
    {id:'scheduledInboxIngest',name:'Scheduled Inbox Ingest',endpoint:'/api/scheduledInboxIngest',method:'POST',auth:'Bearer token',purpose:'Periodic email ingest (cron-ready)',sqf:['2.1.3'],rewrite:true},
    {id:'getControlledRecordsRegister',name:'Controlled Records Register',endpoint:'/api/getControlledRecordsRegister',method:'POST',auth:'Bearer token',purpose:'Return full SQF controlled records matrix with live counts',sqf:['2.5.2'],rewrite:true},
    {id:'assembleJobPacket',name:'Assemble Job Packet',endpoint:'/api/assembleJobPacket',method:'POST',auth:'Bearer token',purpose:'Assemble controlled packet for a job ticket',sqf:['2.5.2','2.6.1'],rewrite:true}
  ];

  // ─── FIRESTORE COLLECTIONS MASTER LIST ────────────────────────
  var COLLECTIONS=[
    {name:'quotes',module:'Quote Engine',sqf:'2.1.1',records:'active',retention:'7y'},
    {name:'quoteTemplates',module:'Quote Engine',sqf:'2.1.1',records:'active',retention:'5y'},
    {name:'salesOrders',module:'Sales Orders',sqf:'2.1.1',records:'active',retention:'7y'},
    {name:'customers',module:'CRM',sqf:'2.1.1',records:'active',retention:'7y'},
    {name:'jobTickets',module:'PPD',sqf:'2.6.1',records:'controlled',retention:'7y'},
    {name:'jobPassports',module:'PPD',sqf:'2.6.1',records:'controlled',retention:'7y'},
    {name:'prepressInbox',module:'PPD',sqf:'2.1.3',records:'controlled',retention:'1y'},
    {name:'prepressQueue',module:'PPD',sqf:'2.1.3',records:'active',retention:'1y'},
    {name:'blueprints',module:'PPD',sqf:'13.8.4',records:'controlled',retention:'7y'},
    {name:'approvalRecords',module:'PPD',sqf:'2.5.2',records:'controlled',retention:'7y'},
    {name:'plateIncidents',module:'PPD',sqf:'13.8.6',records:'controlled',retention:'3y'},
    {name:'ppdEvents',module:'PPD',sqf:'2.5.1',records:'audit trail',retention:'3y'},
    {name:'ppdEstimates',module:'PPD',sqf:'2.1.1',records:'active',retention:'3y'},
    {name:'ppdTemplates',module:'PPD',sqf:'13.8.4',records:'active',retention:'5y'},
    {name:'controlConfigs',module:'PPD',sqf:'2.5.1',records:'system',retention:'10y'},
    {name:'exceptionOverrides',module:'PPD',sqf:'2.5.4',records:'controlled',retention:'7y'},
    {name:'vendorPOs',module:'Vendor POs',sqf:'2.1.1',records:'active',retention:'7y'},
    {name:'vendorInvoices',module:'Vendor POs',sqf:'2.1.1',records:'active',retention:'7y'},
    {name:'vendors',module:'Vendor Mgmt',sqf:'13.8.1',records:'active',retention:'7y'},
    {name:'vendorComms',module:'Vendor Mgmt',sqf:'2.1.1',records:'active',retention:'3y'},
    {name:'materials',module:'Vendor Mgmt',sqf:'13.8.1',records:'active',retention:'7y'},
    {name:'materialLots',module:'Vendor Mgmt',sqf:'13.8.1',records:'controlled',retention:'7y'},
    {name:'audits',module:'Audit',sqf:'2.5.1',records:'controlled',retention:'7y'},
    {name:'managementReviews',module:'Audit',sqf:'2.5.1',records:'controlled',retention:'7y'},
    {name:'ncrs',module:'CAPA',sqf:'2.5.4',records:'controlled',retention:'7y'},
    {name:'capaSuggestions',module:'CAPA',sqf:'2.5.4',records:'active',retention:'3y'},
    {name:'fsqmsSanitation',module:'FSQMS',sqf:'11.2',records:'controlled',retention:'3y'},
    {name:'fsqmsQuality',module:'FSQMS',sqf:'11.5',records:'controlled',retention:'3y'},
    {name:'fsqmsMaterials',module:'FSQMS',sqf:'13.8.1',records:'controlled',retention:'3y'},
    {name:'sqfSanitation',module:'Data Logs',sqf:'11.2',records:'controlled',retention:'3y'},
    {name:'sqfFacilities',module:'Data Logs',sqf:'11.1',records:'controlled',retention:'3y'},
    {name:'sqfQuality',module:'Data Logs',sqf:'11.5',records:'controlled',retention:'3y'},
    {name:'sqfMaterials',module:'Data Logs',sqf:'13.8.1',records:'controlled',retention:'3y'},
    {name:'gmpInspections',module:'GMP',sqf:'11.1',records:'controlled',retention:'3y'},
    {name:'gmpReadings',module:'GMP',sqf:'11.1',records:'controlled',retention:'1y'},
    {name:'trainingRecords',module:'Training',sqf:'2.9',records:'controlled',retention:'7y'},
    {name:'dcrs',module:'Doc Control',sqf:'2.5.2',records:'controlled',retention:'10y'},
    {name:'distributions',module:'Doc Control',sqf:'2.5.2',records:'active',retention:'3y'},
    {name:'qcProcedures',module:'Doc Control',sqf:'2.5.2',records:'controlled',retention:'10y'},
    {name:'equipmentProfiles',module:'Equipment',sqf:'13.10.1',records:'controlled',retention:'10y'},
    {name:'operatorLogs',module:'Production',sqf:'13.3.1',records:'controlled',retention:'3y'},
    {name:'shipments',module:'Logistics',sqf:'2.6.1',records:'controlled',retention:'7y'},
    {name:'returnMaterials',module:'RMA',sqf:'2.6.2',records:'controlled',retention:'7y'},
    {name:'receivingQueue',module:'Receiving',sqf:'2.4.4',records:'controlled',retention:'3y'},
    {name:'sqfReleasePackets',module:'Release',sqf:'2.4.4',records:'controlled',retention:'7y'},
    {name:'sqfQualityRecords',module:'QC Evidence',sqf:'2.5.2',records:'controlled',retention:'7y'},
    {name:'chat_channels',module:'Chat',sqf:null,records:'operational',retention:'1y'},
    {name:'chat_messages',module:'Chat',sqf:null,records:'operational',retention:'1y'},
    {name:'dms',module:'Chat',sqf:null,records:'operational',retention:'1y'},
    {name:'messages',module:'Chat',sqf:null,records:'operational',retention:'1y'},
    {name:'replies',module:'Chat',sqf:null,records:'operational',retention:'1y'},
    {name:'notifications',module:'Notifications',sqf:null,records:'operational',retention:'90d'},
    {name:'presence',module:'Realtime',sqf:null,records:'ephemeral',retention:'0'},
    {name:'activity',module:'Realtime',sqf:null,records:'operational',retention:'90d'},
    {name:'microfeed',module:'Realtime',sqf:null,records:'operational',retention:'90d'},
    {name:'projects',module:'Board',sqf:null,records:'operational',retention:'3y'},
    {name:'discussions',module:'Board',sqf:null,records:'operational',retention:'1y'},
    {name:'threads',module:'Board',sqf:null,records:'operational',retention:'1y'},
    {name:'support',module:'Board',sqf:null,records:'operational',retention:'1y'},
    {name:'tasks',module:'Tasks',sqf:null,records:'operational',retention:'1y'},
    {name:'requests',module:'Intake',sqf:'2.1.1',records:'controlled',retention:'3y'},
    {name:'users',module:'Auth',sqf:null,records:'system',retention:'permanent'},
    {name:'systemCounters',module:'System',sqf:null,records:'system',retention:'permanent'},
    {name:'sqfDailyDigests',module:'SQF Alerts',sqf:'2.5.1',records:'controlled',retention:'1y'},
    {name:'sqfEscalations',module:'SQF Alerts',sqf:'2.5.4',records:'controlled',retention:'3y'},
    {name:'swabResults',module:'Sanitation',sqf:'11.2',records:'controlled',retention:'3y'},
    {name:'waterTests',module:'Sanitation',sqf:'11.2',records:'controlled',retention:'3y'},
    {name:'spoilage',module:'Production',sqf:'13.3.1',records:'controlled',retention:'3y'}
  ];

  // ─── WORKFLOW AUTOMATIONS (cross-module triggers) ─────────────
  var WORKFLOWS=[
    {name:'Quote → CEO Approval → Ready → Client',
     modules:['quotes','app'],trigger:'submitForApproval()',
     steps:['Quote saved with fields validated','Status → approval','CEO role-check gate','Status → ready','bakePricing() locks numbers','Auto-save to Drive','Auto-add to Registry','Optional: auto-email to client'],
     sqf:'2.1.1',status:'automated',cloud:'ceoApprove'},

    {name:'Quote → Sales Order → Job Passport',
     modules:['quotes','salesorders','ppd'],trigger:'convertToSO()',
     steps:['Quote approved','SO created from quote','SO number generated','CEO approves SO','Job passport created via Cloud Function','PPD job tickets auto-created per SKU'],
     sqf:'2.1.1 → 2.6.1',status:'automated',cloud:'createPassport'},

    {name:'PPD 13-Stage State Machine',
     modules:['ppd'],trigger:'transitionStatus()',
     steps:['Intake → Validation','Validation → Art Review','Art Review → Engineering','Engineering → File Prep','File Prep → Proof Ready','Proof Ready → Proof Sent','Proof Sent → Waiting Approval','Waiting Approval → Revision Needed / Plate Ready','Plate Ready → Release QA','Release QA → Released','Any → Blocked'],
     sqf:'2.5.1',status:'automated',cloud:'transitionStatus'},

    {name:'VPO 3-Tier Approval',
     modules:['vendorpos'],trigger:'submitVPO()',
     steps:['VPO created with line items','Total calculated','Tier determined ($500/$2500)','Self-approve ≤$500','Manager approve $500-$2500','CEO approve >$2500','Status → approved → sent → received → paid'],
     sqf:'2.1.1',status:'automated',cloud:'processVPOApproval'},

    {name:'Email Ingest → Pre-Press Queue',
     modules:['ppd'],trigger:'scheduledInboxIngest()',
     steps:['Gmail shared inbox scanned','New emails extracted','Attachments processed','Entries created in prepressInbox','Pre-press lead notified','Manual triage to job tickets'],
     sqf:'2.1.3',status:'semi-automated',cloud:'scheduledInboxIngest'},

    {name:'NCR → Root Cause → CAPA → Verification',
     modules:['capa'],trigger:'createNCR()',
     steps:['Non-conformance reported','NCR auto-numbered','Root cause analysis documented','Corrective action assigned','CAPA implementation tracked','Effectiveness verified','NCR closed or escalated'],
     sqf:'2.5.4',status:'automated',cloud:null},

    {name:'Audit → Findings → Management Review',
     modules:['audit'],trigger:'startAudit()',
     steps:['Audit scheduled and created','Checklist items assessed','Findings logged with evidence','Corrective actions assigned','Management review scheduled','Review completed with e-signature','Follow-up actions tracked'],
     sqf:'2.5.1',status:'automated',cloud:null},

    {name:'Material Receiving → QC → Release/Hold',
     modules:['datalogs','fsqms'],trigger:'logReceiving()',
     steps:['Material arrives at dock','Receiving inspection checklist','COA verified','Lot number recorded','QC inspection results logged','Release or hold tag issued','Material moved to approved storage'],
     sqf:'13.8.1 → 2.4.4',status:'automated',cloud:null},

    {name:'Job Packet Assembly → Drive Sync',
     modules:['records'],trigger:'assemblePacket()',
     steps:['Job ticket selected','All 12 chain roles checked','Missing documents flagged','Completeness % calculated','Warnings generated for gaps','Manifest JSON created','Optional: sync to Drive 07_Released/'],
     sqf:'2.5.2 → 2.6.1',status:'automated',cloud:'assembleJobPacket'},

    {name:'PPD Health Check (Pipeline Audit)',
     modules:['ppd'],trigger:'ppdHealthCheck()',
     steps:['All active tickets scanned','Stale tickets identified (>SLA)','Blocked tickets flagged','Stage distribution calculated','Health score computed','Alerts generated for at-risk items'],
     sqf:'2.5.1',status:'automated',cloud:'ppdHealthCheck'},

    {name:'Overdue VPO Detection',
     modules:['vendorpos'],trigger:'checkOverdueVPOs()',
     steps:['All open VPOs scanned','Expected delivery dates checked','Overdue items flagged','Vendor notified','Escalation to purchasing manager','Dashboard alert updated'],
     sqf:null,status:'semi-automated',cloud:'checkOverdueVPOs'},

    {name:'Drive Workspace Provisioning',
     modules:['ppd'],trigger:'provisionPPDWorkspace()',
     steps:['Job ticket created','Client folder located/created','SKU subfolder created','11 standard subfolders created','Folder IDs stored in Firestore','Links available in PPD workbench'],
     sqf:'13.8.4',status:'automated',cloud:'provisionPPDWorkspace'},

    {name:'GMP Zone Inspection',
     modules:['gmp'],trigger:'startInspection()',
     steps:['Zone selected','Checklist items assessed','Temperature/humidity readings captured','Photos attached','Pass/fail scored','Corrective actions if needed','Report generated'],
     sqf:'11.1 → 11.4',status:'manual + digital capture',cloud:null},

    {name:'Sanitation Pre-Op / Post-Op',
     modules:['datalogs','fsqms'],trigger:'logSanitation()',
     steps:['Zone/line selected','Pre-op checklist completed','Chemical concentrations verified','Swab results recorded','Post-op verification','Deviations flagged','Records stored in Firestore'],
     sqf:'11.2',status:'manual + digital capture',cloud:null},

    {name:'Document Change Request (DCR)',
     modules:['doccontrol'],trigger:'createDCR()',
     steps:['Change request submitted','Document identified','Reviewers assigned','Review/comment cycle','Approval/rejection','New version published','Old version archived','Distribution list updated'],
     sqf:'2.5.2',status:'automated',cloud:null},

    {name:'Real-time Presence & Activity',
     modules:['realtime'],trigger:'startRealtimeSync()',
     steps:['User authenticated','Presence heartbeat started (15s)','onSnapshot listeners attached','Activity feed updated','Cross-tab events coordinated','Cleanup on logout/navigate'],
     sqf:null,status:'automated',cloud:null}
  ];

  // ─── HEALTH CHECK ─────────────────────────────────────────────
  function runHealthCheck(){
    MA.health={};
    MA.lastCheck=new Date().toISOString();

    // Check each module's health by probing its globals
    MODULES.forEach(function(m){
      var h={status:'unknown',issues:[],score:100};

      // Check if module rendered/registered
      if(window.MFX_VIEW_RENDERERS){
        var viewKeys={quotes:'quotes',ppd:'ppd',vendorpos:'vendorpos',vendorprofile:'vendorprofile',audit:'audit',records:'records',chat:'chat',capa:'capa'};
        // Most modules are routed through goView, not direct renderer
      }

      // Check Firestore connectivity
      if(typeof firebase!=='undefined'){
        try{
          var db=firebase.firestore();
          if(db) h.firestoreOk=true;
        }catch(e){
          h.firestoreOk=false;
          h.issues.push('Firestore not initialized');
          h.score-=30;
        }
      }

      // Check for known globals
      if(m.id==='ppd'&&typeof window.PPD==='undefined'){h.issues.push('PPD global not found');h.score-=10}
      if(m.id==='chat'&&typeof window.chatDetachListeners==='undefined'){h.issues.push('Chat cleanup not registered');h.score-=5}

      // Module-specific checks
      if(m.collections&&m.collections.length){
        h.collectionCount=m.collections.length;
      }

      h.status=h.score>=90?'healthy':h.score>=70?'degraded':'critical';
      MA.health[m.id]=h;
    });
  }

  // ─── RENDER ───────────────────────────────────────────────────
  function renderMasterAuto(){
    var el=$('v-masterauto');if(!el)return;

    if(!MA.lastCheck) runHealthCheck();

    var h='<div style="max-width:1400px;margin:0 auto;padding:0 8px">';

    // Header
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px">';
    h+='<div>';
    h+='<div style="font-size:22px;font-weight:800;color:var(--tx);letter-spacing:-.5px">Master Automation & System Status</div>';
    h+='<div style="font-size:11px;color:var(--tx3)">MFX OS · '+MODULES.length+' Modules · '+CLOUD_FUNCTIONS.length+' Cloud Functions · '+COLLECTIONS.length+' Collections · '+WORKFLOWS.length+' Workflows</div>';
    h+='</div>';
    h+='<div style="display:flex;gap:6px">';
    h+='<button class="btn btn-ghost btn-xs" onclick="window._maHealthCheck()" style="font-size:9px">Run Health Check</button>';
    h+='<button class="btn btn-ghost btn-xs" onclick="goView(\'records\')" style="font-size:9px">Controlled Records →</button>';
    h+='</div></div>';

    // Tabs
    h+='<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--bdr);padding-bottom:8px;flex-wrap:wrap">';
    var tabs=[['overview','System Overview'],['automations','Workflows & Triggers ('+WORKFLOWS.length+')'],['modules','Modules ('+MODULES.length+')'],['cloud','Cloud Functions ('+CLOUD_FUNCTIONS.length+')'],['collections','Collections ('+COLLECTIONS.length+')'],['drive','Drive Map']];
    tabs.forEach(function(t){
      var active=MA.tab===t[0];
      h+='<button onclick="window._maTab(\''+t[0]+'\')" style="padding:6px 12px;font-size:11px;font-weight:'+(active?'700':'500')+';color:'+(active?'var(--ac)':'var(--tx3)')+';background:'+(active?'var(--bg3)':'transparent')+';border:1px solid '+(active?'var(--ac)':'transparent')+';border-radius:6px;cursor:pointer;white-space:nowrap">'+t[1]+'</button>';
    });
    h+='</div>';

    if(MA.tab==='overview') h+=renderOverview();
    else if(MA.tab==='automations') h+=renderAutomations();
    else if(MA.tab==='modules') h+=renderModules();
    else if(MA.tab==='cloud') h+=renderCloudFunctions();
    else if(MA.tab==='collections') h+=renderCollections();
    else if(MA.tab==='drive') h+=renderDriveMap();

    h+='</div>';
    el.innerHTML=h;
  }

  // ─── OVERVIEW TAB ─────────────────────────────────────────────
  function renderOverview(){
    var h='';

    // Metric cards
    var totalAutomations=0;MODULES.forEach(function(m){totalAutomations+=m.automations.length});
    var totalTriggers=0;MODULES.forEach(function(m){totalTriggers+=m.triggers.length});
    var controlledCols=COLLECTIONS.filter(function(c){return c.records==='controlled'});
    var sqfClauses={};COLLECTIONS.forEach(function(c){if(c.sqf)sqfClauses[c.sqf]=true});
    var fullyAutomated=WORKFLOWS.filter(function(w){return w.status==='automated'}).length;

    h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px">';
    h+=metricCard(MODULES.length,'Active Modules','System components');
    h+=metricCard(totalAutomations,'Automations','Across all modules');
    h+=metricCard(totalTriggers,'Event Triggers','Workflow initiators');
    h+=metricCard(CLOUD_FUNCTIONS.length,'Cloud Functions','Server-side endpoints');
    h+=metricCard(COLLECTIONS.length,'Firestore Collections','Data stores');
    h+=metricCard(controlledCols.length,'Controlled Records','SQF-regulated');
    h+=metricCard(Object.keys(sqfClauses).length,'SQF Clauses','Referenced');
    h+=metricCard(fullyAutomated+'/'+WORKFLOWS.length,'Automated Workflows','End-to-end');
    h+='</div>';

    // System Health Summary
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';

    // Left: Module health grid
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:12px">Module Health</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px">';
    MODULES.forEach(function(m){
      var hlth=MA.health[m.id]||{status:'unknown',score:100};
      var sc=hlth.status==='healthy'?'var(--gn)':hlth.status==='degraded'?'var(--or)':'var(--rd)';
      h+='<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg3);border-radius:6px;border-left:3px solid '+sc+'">';
      h+='<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="'+sc+'"/></svg>';
      h+='<div><div style="font-size:10px;font-weight:700;color:var(--tx)">'+esc(m.name)+'</div>';
      h+='<div style="font-size:8px;color:var(--tx3)">'+esc(m.dept)+'</div></div>';
      h+='</div>';
    });
    h+='</div></div>';

    // Right: Workflow automation coverage
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:12px">Workflow Automation Level</div>';
    var auto=WORKFLOWS.filter(function(w){return w.status==='automated'}).length;
    var semi=WORKFLOWS.filter(function(w){return w.status==='semi-automated'}).length;
    var manual=WORKFLOWS.filter(function(w){return w.status.indexOf('manual')>=0}).length;
    var pctAuto=Math.round((auto/WORKFLOWS.length)*100);

    h+='<div style="text-align:center;margin-bottom:12px">';
    h+='<div style="font-size:42px;font-weight:800;color:var(--ac)">'+pctAuto+'%</div>';
    h+='<div style="font-size:10px;color:var(--tx3)">Fully Automated</div></div>';

    h+='<div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;margin-bottom:12px;display:flex">';
    h+='<div style="width:'+Math.round((auto/WORKFLOWS.length)*100)+'%;background:var(--gn)"></div>';
    h+='<div style="width:'+Math.round((semi/WORKFLOWS.length)*100)+'%;background:var(--or)"></div>';
    h+='<div style="width:'+Math.round((manual/WORKFLOWS.length)*100)+'%;background:var(--tx3)"></div>';
    h+='</div>';

    h+='<div style="display:flex;gap:16px;justify-content:center;font-size:10px">';
    h+='<span><svg width="8" height="8" viewBox="0 0 8 8" style="vertical-align:middle;margin-right:3px"><circle cx="4" cy="4" r="4" fill="var(--gn)"/></svg>Automated ('+auto+')</span>';
    h+='<span><svg width="8" height="8" viewBox="0 0 8 8" style="vertical-align:middle;margin-right:3px"><circle cx="4" cy="4" r="4" fill="var(--or)"/></svg>Semi ('+semi+')</span>';
    h+='<span><svg width="8" height="8" viewBox="0 0 8 8" style="vertical-align:middle;margin-right:3px"><circle cx="4" cy="4" r="4" fill="var(--tx3)"/></svg>Manual ('+manual+')</span>';
    h+='</div></div>';

    h+='</div>';

    // SQF Clause Heat Map
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:4px">SQF Edition 10 Clause Coverage</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:12px">Number of collections and modules mapped to each SQF clause</div>';

    var clauseMap={};
    COLLECTIONS.forEach(function(c){
      if(c.sqf){
        if(!clauseMap[c.sqf]) clauseMap[c.sqf]={collections:0,modules:new Set()};
        clauseMap[c.sqf].collections++;
      }
    });
    MODULES.forEach(function(m){
      (m.sqf||[]).forEach(function(cl){
        if(!clauseMap[cl]) clauseMap[cl]={collections:0,modules:new Set()};
        clauseMap[cl].modules.add(m.name);
      });
    });

    var clauseNames={'2.1.1':'Management Commitment','2.1.3':'Communication','2.4.4':'Food Safety / HACCP','2.5.1':'Verification Activities','2.5.2':'Verification Procedures','2.5.4':'Corrective Actions','2.6.1':'Product Traceability','2.6.2':'Product Withdrawal','2.9':'Training & Competency','11.1':'Site Requirements','11.2':'Building & Grounds','11.3':'Pest Prevention','11.4':'Personal Hygiene','11.5':'Foreign Material Control','11.6':'Storage & Handling','11.7':'Waste Management','11.8':'Equipment & Maintenance','13.3.1':'Sanitation Monitoring','13.8.1':'Raw Materials Receiving','13.8.4':'Packaging Specifications','13.8.6':'Tooling & Equipment','13.10.1':'Calibration'};

    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">';
    Object.keys(clauseMap).sort().forEach(function(cl){
      var data=clauseMap[cl];
      var modCount=data.modules.size||0;
      var intensity=Math.min(1,data.collections/10);
      h+='<div style="padding:8px;background:rgba(0,212,245,'+(.05+intensity*.15)+');border:1px solid rgba(0,212,245,.2);border-radius:6px">';
      h+='<div style="font-size:12px;font-weight:800;color:var(--ac);font-family:var(--mono)">'+esc(cl)+'</div>';
      h+='<div style="font-size:9px;color:var(--tx2);margin:2px 0">'+(clauseNames[cl]||'')+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3)">'+data.collections+' collections · '+modCount+' modules</div>';
      h+='</div>';
    });
    h+='</div></div>';

    // Quick links
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Quick Navigation</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">';
    var links=[
      {label:'Controlled Records Register',view:'records'},
      {label:'SQF Audit Manager',view:'audit'},
      {label:'NCR / CAPA',view:'capa'},
      {label:'PPD Workbench',view:'ppd'},
      {label:'Vendor Management',view:'vendorprofile'},
      {label:'Quote Engine',view:'quotes'},
      {label:'Sales Orders',view:'orders'},
      {label:'Data Logs',view:'datalogs'},
      {label:'GMP Inspections',view:'gmp'},
      {label:'Document Control',view:'doccontrol'},
      {label:'Training Records',view:'training'},
      {label:'Team Chat',view:'chat'}
    ];
    links.forEach(function(l){
      h+='<button onclick="goView(\''+l.view+'\')" style="padding:8px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:10px;font-weight:600;cursor:pointer;text-align:left;transition:all .15s" onmouseover="this.style.borderColor=\'var(--ac)\'" onmouseout="this.style.borderColor=\'var(--bdr)\'">';
      h+=esc(l.label)+' →</button>';
    });
    h+='</div></div>';

    return h;
  }

  // ─── AUTOMATIONS TAB ──────────────────────────────────────────
  function renderAutomations(){
    var h='';

    WORKFLOWS.forEach(function(wf,i){
      var statusColor=wf.status==='automated'?'var(--gn)':wf.status==='semi-automated'?'var(--or)':'var(--tx3)';
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:12px;border-left:4px solid '+statusColor+'">';

      // Header
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:6px">';
      h+='<div>';
      h+='<div style="font-size:14px;font-weight:700;color:var(--tx)">'+esc(wf.name)+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:2px">';
      h+='Trigger: <code style="color:var(--ac);font-family:var(--mono);background:var(--bg3);padding:1px 4px;border-radius:3px;font-size:9px">'+esc(wf.trigger)+'</code>';
      if(wf.sqf) h+=' · SQF '+esc(wf.sqf);
      h+='</div></div>';

      h+='<div style="display:flex;gap:4px;align-items:center">';
      if(wf.cloud) h+='<span style="font-size:9px;padding:2px 6px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);border-radius:3px;color:#a78bfa;font-weight:600">☁ '+esc(wf.cloud)+'</span>';
      h+='<span style="font-size:9px;padding:2px 6px;background:rgba(0,0,0,.2);border-radius:3px;color:'+statusColor+';font-weight:700;text-transform:uppercase">'+esc(wf.status)+'</span>';
      h+='</div></div>';

      // Steps pipeline
      h+='<div style="display:flex;flex-wrap:wrap;gap:2px;align-items:center">';
      wf.steps.forEach(function(step,j){
        h+='<div style="padding:4px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;font-size:9px;color:var(--tx2)">';
        h+='<span style="color:var(--ac);font-weight:700;margin-right:3px">'+(j+1)+'</span>'+esc(step)+'</div>';
        if(j<wf.steps.length-1) h+='<svg width="12" height="10" viewBox="0 0 12 10" style="color:var(--tx3);flex-shrink:0"><path d="M0 5h8M7 2l3 3-3 3" stroke="currentColor" fill="none" stroke-width="1.2"/></svg>';
      });
      h+='</div>';

      // Modules involved
      h+='<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">';
      wf.modules.forEach(function(mid){
        h+='<span style="font-size:8px;padding:1px 5px;background:var(--bg);border:1px solid var(--bdr);border-radius:3px;color:var(--tx3)">'+esc(mid)+'</span>';
      });
      h+='</div>';

      h+='</div>';
    });

    return h;
  }

  // ─── MODULES TAB ──────────────────────────────────────────────
  function renderModules(){
    var h='';

    h+='<div style="display:grid;gap:12px">';
    MODULES.forEach(function(m){
      var hlth=MA.health[m.id]||{status:'unknown',score:100};
      var sc=hlth.status==='healthy'?'var(--gn)':hlth.status==='degraded'?'var(--or)':'var(--rd)';

      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;border-left:4px solid '+sc+'">';

      // Header
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px">';
      h+='<div>';
      h+='<div style="font-size:15px;font-weight:700;color:var(--tx)">'+esc(m.name)+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+esc(m.dept)+' · <code style="font-size:9px;color:var(--ac);font-family:var(--mono)">'+esc(m.file)+'</code></div>';
      h+='</div>';
      h+='<div style="display:flex;gap:4px;align-items:center">';
      (m.sqf||[]).forEach(function(cl){
        h+='<span style="font-size:9px;padding:2px 5px;background:rgba(0,212,245,.1);border:1px solid rgba(0,212,245,.2);border-radius:3px;color:var(--ac);font-weight:600;font-family:var(--mono)">'+esc(cl)+'</span>';
      });
      h+='<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="'+sc+'"/></svg>';
      h+='</div></div>';

      // Automations
      h+='<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Automations ('+m.automations.length+')</div>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:3px">';
      m.automations.forEach(function(a){
        h+='<span style="font-size:9px;padding:2px 6px;background:var(--bg3);border:1px solid var(--bdr);border-radius:3px;color:var(--tx2)">'+esc(a)+'</span>';
      });
      h+='</div></div>';

      // Triggers
      h+='<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Triggers ('+m.triggers.length+')</div>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:3px">';
      m.triggers.forEach(function(t){
        h+='<span style="font-size:9px;padding:2px 6px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:3px;color:var(--or)">⚡ '+esc(t)+'</span>';
      });
      h+='</div></div>';

      // Collections + Drive
      h+='<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:9px;color:var(--tx3)">';
      if(m.collections&&m.collections.length){
        h+='<span>Collections: '+m.collections.map(function(c){return'<code style="color:var(--ac);font-family:var(--mono)">'+esc(c)+'</code>'}).join(', ')+'</span>';
      }
      if(m.driveFolder){
        h+='<span>Drive: <code style="color:#a78bfa;font-family:var(--mono)">'+esc(m.driveFolder)+'</code></span>';
      }
      h+='</div>';

      h+='</div>';
    });
    h+='</div>';

    return h;
  }

  // ─── CLOUD FUNCTIONS TAB ──────────────────────────────────────
  function renderCloudFunctions(){
    var h='';

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;overflow:hidden;margin-bottom:16px">';
    h+='<div style="padding:12px 16px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">Cloud Functions (Firebase)</div>';
    h+='<div style="font-size:9px;color:var(--tx3)">Node 22 · us-central1 · Auth: Bearer Token</div></div>';

    h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    h+='<thead><tr style="border-bottom:2px solid var(--bdr);background:var(--bg3)">';
    ['Function','Endpoint','Auth','SQF','Purpose','Rewrite'].forEach(function(col){
      h+='<th style="padding:8px 10px;text-align:left;color:var(--tx3);font-size:10px;font-weight:700;letter-spacing:.5px;white-space:nowrap">'+col+'</th>';
    });
    h+='</tr></thead><tbody>';

    CLOUD_FUNCTIONS.forEach(function(fn){
      h+='<tr style="border-bottom:1px solid var(--bdr)" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
      h+='<td style="padding:8px 10px;font-weight:700;color:var(--tx)">'+esc(fn.name)+'</td>';
      h+='<td style="padding:8px 10px"><code style="font-size:9px;color:var(--ac);font-family:var(--mono)">'+esc(fn.endpoint)+'</code></td>';
      h+='<td style="padding:8px 10px;font-size:9px;color:var(--tx2)">'+esc(fn.auth)+'</td>';
      h+='<td style="padding:8px 10px">';
      (fn.sqf||[]).forEach(function(cl){
        h+='<span style="font-size:9px;color:var(--ac);font-family:var(--mono);margin-right:3px">'+esc(cl)+'</span>';
      });
      if(!fn.sqf||!fn.sqf.length) h+='<span style="color:var(--tx3)">—</span>';
      h+='</td>';
      h+='<td style="padding:8px 10px;font-size:10px;color:var(--tx2);max-width:250px">'+esc(fn.purpose)+'</td>';
      h+='<td style="padding:8px 10px"><span style="font-size:9px;color:var(--gn);font-weight:700">'+esc(fn.rewrite?'✓ Active':'✗ Missing')+'</span></td>';
      h+='</tr>';
    });

    h+='</tbody></table></div></div>';

    // API client info
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px">API Client (platform-services.js)</div>';
    h+='<div style="font-size:10px;color:var(--tx2);line-height:1.6">';
    h+='All Cloud Functions are accessible via <code style="color:var(--ac);font-family:var(--mono)">window.MFXApi</code> object.<br>';
    h+='Auth: Firebase ID token auto-attached as Bearer header.<br>';
    h+='Domain lock: <code style="color:var(--ac);font-family:var(--mono)">requireInternalUser()</code> validates token server-side.<br>';
    h+='CORS: Currently open (to be restricted to app domains).';
    h+='</div></div>';

    return h;
  }

  // ─── COLLECTIONS TAB ──────────────────────────────────────────
  function renderCollections(){
    var h='';

    // Summary by type
    var types={};
    COLLECTIONS.forEach(function(c){
      var t=c.records||'unknown';
      if(!types[t]) types[t]=0;
      types[t]++;
    });

    h+='<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    var typeColors={controlled:'var(--ac)',active:'var(--gn)',operational:'var(--or)',system:'#a78bfa',ephemeral:'var(--tx3)','audit trail':'var(--cy)'};
    Object.keys(types).forEach(function(t){
      var color=typeColors[t]||'var(--tx3)';
      h+='<div style="padding:8px 16px;background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;text-align:center">';
      h+='<div style="font-size:20px;font-weight:800;color:'+color+'">'+types[t]+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">'+esc(t)+'</div></div>';
    });
    h+='</div>';

    // Table
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;overflow:hidden">';
    h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    h+='<thead><tr style="border-bottom:2px solid var(--bdr);background:var(--bg3)">';
    ['Collection','Module','SQF','Type','Retention'].forEach(function(col){
      h+='<th style="padding:8px 10px;text-align:left;color:var(--tx3);font-size:10px;font-weight:700;letter-spacing:.5px;white-space:nowrap">'+col+'</th>';
    });
    h+='</tr></thead><tbody>';

    COLLECTIONS.forEach(function(c){
      var typeColor=typeColors[c.records]||'var(--tx3)';
      h+='<tr style="border-bottom:1px solid var(--bdr)" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">';
      h+='<td style="padding:6px 10px"><code style="font-size:10px;color:var(--ac);font-family:var(--mono);font-weight:600">'+esc(c.name)+'</code></td>';
      h+='<td style="padding:6px 10px;color:var(--tx2);font-size:10px">'+esc(c.module)+'</td>';
      h+='<td style="padding:6px 10px">';
      if(c.sqf) h+='<span style="font-size:9px;color:var(--ac);font-family:var(--mono);font-weight:600">'+esc(c.sqf)+'</span>';
      else h+='<span style="color:var(--tx3)">—</span>';
      h+='</td>';
      h+='<td style="padding:6px 10px"><span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(0,0,0,.2);color:'+typeColor+';font-weight:600">'+esc(c.records)+'</span></td>';
      h+='<td style="padding:6px 10px;font-size:10px;color:var(--tx2)">'+esc(c.retention)+'</td>';
      h+='</tr>';
    });

    h+='</tbody></table></div></div>';

    return h;
  }

  // ─── DRIVE MAP TAB ────────────────────────────────────────────
  function renderDriveMap(){
    var h='';

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:4px">MFX-CORE Shared Drive — Complete Structure</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:12px">Google Shared Drive with service account auth · All SQF controlled documents stored here</div>';

    var driveTree=[
      {path:'MFX-CORE/',depth:0,type:'root',desc:'Shared Drive root'},
      {path:'Clients/',depth:1,type:'folder',desc:'Customer master folders — auto-created per company'},
      {path:'{Company}/',depth:2,type:'dynamic',desc:'Auto-named from customer record'},
      {path:'{QuoteNum}/',depth:3,type:'dynamic',desc:'Quote PDFs and history'},
      {path:'{SONum}/',depth:3,type:'dynamic',desc:'Sales order documents'},
      {path:'{JP#}/',depth:3,type:'dynamic',desc:'Job passport documents'},
      {path:'{JT# · SKU}/',depth:3,type:'dynamic',desc:'PPD workspace — 11 subfolders'},
      {path:'01_Request/',depth:4,type:'subfolder',desc:'Customer instructions, RFQs'},
      {path:'02_Source_Art/',depth:4,type:'subfolder',desc:'Original artwork files'},
      {path:'03_Working_Files/',depth:4,type:'subfolder',desc:'Pre-press working files'},
      {path:'04_Proofs/',depth:4,type:'subfolder',desc:'Proof versions'},
      {path:'05_Approvals/',depth:4,type:'subfolder',desc:'Customer approval records'},
      {path:'06_Plates_Tools/',depth:4,type:'subfolder',desc:'Plate files, die lines'},
      {path:'07_Released/',depth:4,type:'subfolder',desc:'Final released files + packet manifest'},
      {path:'08_Obsolete/',depth:4,type:'subfolder',desc:'Superseded versions'},
      {path:'09_Issues_CAPA/',depth:4,type:'subfolder',desc:'NCR/CAPA documents linked to this job'},
      {path:'10_Master_Regs_Exports/',depth:4,type:'subfolder',desc:'Master registration, regulatory docs'},
      {path:'11_Sync_Audit/',depth:4,type:'subfolder',desc:'Sync logs and audit trail'},
      {path:'Master Quotes/',depth:1,type:'folder',desc:'Central quote PDF archive'},
      {path:'Vendor POs/',depth:1,type:'folder',desc:'All vendor purchase orders'},
      {path:'Vendors/',depth:1,type:'folder',desc:'Vendor document repository'},
      {path:'{VendorName}/',depth:2,type:'dynamic',desc:'Per-vendor folder'},
      {path:'POs/',depth:3,type:'subfolder',desc:'Vendor PO copies'},
      {path:'Invoices/',depth:3,type:'subfolder',desc:'Vendor invoices'},
      {path:'Certs/',depth:3,type:'subfolder',desc:'SQF/GFSI certs, COIs, insurance'},
      {path:'Equipment/',depth:1,type:'folder',desc:'Equipment profiles, calibration records'},
      {path:'{EquipmentId}/',depth:2,type:'dynamic',desc:'Per-equipment folder'},
      {path:'Production/',depth:1,type:'folder',desc:'Production records'},
      {path:'Logs/{date}/',depth:2,type:'dynamic',desc:'Daily operator logs'},
      {path:'Quality System/',depth:1,type:'folder',desc:'QMS document repository'},
      {path:'Procedures/',depth:2,type:'subfolder',desc:'Controlled QC procedures'},
      {path:'Inspections/{date}/',depth:2,type:'dynamic',desc:'Audit and inspection records'},
      {path:'NCR-CAPA/{ncrNumber}/',depth:2,type:'dynamic',desc:'NCR investigation files'},
      {path:'Returns/{rmaNum}/',depth:2,type:'dynamic',desc:'RMA investigation and disposition'}
    ];

    h+='<div style="font-family:var(--mono);font-size:10px;background:var(--bg);padding:12px;border-radius:6px;border:1px solid var(--bdr);line-height:2">';
    driveTree.forEach(function(item){
      var indent=item.depth*20;
      var color=item.type==='root'?'var(--ac)':item.type==='dynamic'?'#a78bfa':item.type==='subfolder'?'var(--gn)':'var(--or)';
      var icon=item.type==='root'?'💾':item.type==='dynamic'?'📁':'📂';
      h+='<div style="padding-left:'+indent+'px;display:flex;align-items:center;gap:6px">';
      h+='<span>'+icon+'</span>';
      h+='<span style="color:'+color+';font-weight:'+(item.depth<=1?'700':'500')+'">'+esc(item.path)+'</span>';
      h+='<span style="color:var(--tx3);font-size:9px;font-family:var(--font)">'+esc(item.desc)+'</span>';
      h+='</div>';
    });
    h+='</div></div>';

    // Cloud Function → Drive mapping
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:10px">Drive Integration Points</div>';

    var driveIntegrations=[
      {fn:'uploadToDrive',action:'Upload file to any Drive folder',auto:true},
      {fn:'getClientFolder',action:'Find or create Clients/{Company}/',auto:true},
      {fn:'provisionPPDWorkspace',action:'Create {JT#·SKU}/ with 11 subfolders',auto:true},
      {fn:'saveQuotePDF',action:'Save PDF to Master Quotes/ and Clients/{Company}/{QuoteNum}/',auto:true},
      {fn:'assembleJobPacket',action:'Write packet manifest JSON to 07_Released/',auto:true},
      {fn:'ppdHealthCheck',action:'Audit Drive workspace completeness',auto:false}
    ];

    driveIntegrations.forEach(function(di){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bdr)">';
      h+='<code style="font-size:10px;color:var(--ac);font-family:var(--mono);min-width:180px;font-weight:600">'+esc(di.fn)+'()</code>';
      h+='<span style="font-size:10px;color:var(--tx2);flex:1">'+esc(di.action)+'</span>';
      h+='<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:'+(di.auto?'rgba(5,150,105,.1)':'rgba(245,158,11,.1)')+';color:'+(di.auto?'var(--gn)':'var(--or)')+';font-weight:600">'+(di.auto?'Auto':'Manual')+'</span>';
      h+='</div>';
    });

    h+='</div>';

    return h;
  }

  // ─── UTILITY ──────────────────────────────────────────────────
  function metricCard(value,label,sub){
    return '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center">'
      +'<div style="font-size:22px;font-weight:800;color:var(--ac)">'+esc(String(value))+'</div>'
      +'<div style="font-size:10px;font-weight:600;color:var(--tx)">'+esc(label)+'</div>'
      +'<div style="font-size:9px;color:var(--tx3)">'+esc(sub||'')+'</div></div>';
  }

  // ─── GLOBAL HOOKS ─────────────────────────────────────────────
  window._maTab=function(tab){MA.tab=tab;renderMasterAuto()};
  window._maHealthCheck=function(){runHealthCheck();renderMasterAuto();if(typeof toast==='function')toast('Health check complete','ok')};

})();
