// ════════════════════════════════════════════════════════════════════════════════
// MFX OS — LOGISTICS & SHIPPING MODULE v1
// Comprehensive logistics pipeline for Microflex Film Corporation
// Job lifecycle tracking, inventory management, QC gates, packaging, deliveries, spoilage
// ════════════════════════════════════════════════════════════════════════════════

(function(){
  'use strict';

  if(typeof window === 'undefined') return;

  // ═══ MODULE STATE ═══
  var _logisticsListeners = [];
  var LOGISTICS = {
    tab: 'dashboard',
    jobs: [],
    materials: [],
    shipments: [],
    spoilage: [],
    vendors: [],
    listenersStarted: false,
    settings: {}
  };

  window.LOGISTICS = LOGISTICS;
  window.MFX_VIEW_RENDERERS = window.MFX_VIEW_RENDERERS || {};
  window.MFX_VIEW_TITLES = window.MFX_VIEW_TITLES || {};
  window.MFX_VIEW_RENDERERS.logistics = renderLogisticsView;
  window.MFX_VIEW_TITLES.logistics = 'Logistics & Shipping';

  // ═══ CONSTANTS ═══
  var JOB_STAGES = [
    'Material Planning',
    'Purchasing',
    'Receiving',
    'Staging',
    'Production',
    'QC',
    'Packaging',
    'Ready to Ship',
    'Out for Delivery',
    'Delivered',
    'Complete'
  ];

  var MATERIAL_ZONES = {
    'A': 'Film',
    'B': 'Inks',
    'C': 'Consumables',
    'D': 'Digital',
    'E': 'Tooling',
    'F': 'WIP/FG',
    'Q': 'Quarantine',
    'S': 'Shipping'
  };

  var QC_CHECKS = [
    'Visual Inspection',
    'Delta E Color Check',
    'Barcode Scan Grade',
    'Registration Accuracy',
    'Text Legibility',
    'Die Cut Quality',
    'Adhesion Test',
    'Label Count Verification'
  ];

  var PACKAGING_STEPS = [
    'Shrink Wrapped',
    'Poly Bagged',
    'Boxed/Cartoned',
    'Shipping Label Applied',
    'Palletized/Staged'
  ];

  // ═══ DEMO/SEED DATA ═══
  var SUPPLIERS = [
    'Avery Dennison',
    'Sun Chemical',
    'Flint Group',
    'INX International',
    'Eastman Kodak'
  ];

  var DEMO_MATERIALS = [
    {id:'m001',name:'White BOPP 2mil',zone:'A',onHand:500,reserved:120,reorderPoint:200,unitCost:0.45,supplier:'Avery Dennison'},
    {id:'m002',name:'Clear Laminate',zone:'A',onHand:300,reserved:80,reorderPoint:150,unitCost:0.32,supplier:'Avery Dennison'},
    {id:'m003',name:'Permanent Adhesive',zone:'A',onHand:450,reserved:100,reorderPoint:180,unitCost:0.15,supplier:'Sun Chemical'},
    {id:'m004',name:'40# SCK Liner',zone:'A',onHand:200,reserved:50,reorderPoint:100,unitCost:0.08,supplier:'Flint Group'},
    {id:'m005',name:'Silver Met BOPP',zone:'A',onHand:280,reserved:70,reorderPoint:120,unitCost:0.52,supplier:'INX International'},
    {id:'m006',name:'Process CMYK UV',zone:'B',onHand:120,reserved:30,reorderPoint:60,unitCost:45.00,supplier:'Sun Chemical'},
    {id:'m007',name:'PMS 286 Blue',zone:'B',onHand:80,reserved:20,reorderPoint:40,unitCost:48.50,supplier:'Flint Group'},
    {id:'m008',name:'Opaque White',zone:'B',onHand:60,reserved:15,reorderPoint:35,unitCost:52.00,supplier:'INX International'},
    {id:'m009',name:'Silicone Release Spray',zone:'C',onHand:25,reserved:5,reorderPoint:15,unitCost:12.50,supplier:'Eastman Kodak'},
    {id:'m010',name:'Cleaning Solution',zone:'C',onHand:18,reserved:4,reorderPoint:10,unitCost:8.75,supplier:'Sun Chemical'}
  ];

  // Demo drivers kept as fallback when Firestore 'drivers' collection is unavailable
  var DEMO_DRIVERS = [
    {id:'d001',name:'Miguel Reyes',vehicle:'Van #1 Ford Transit',phone:'555-0101'},
    {id:'d002',name:'Carlos Duran',vehicle:'Van #2 Mercedes Sprinter',phone:'555-0102'},
    {id:'d003',name:'Tommy Vo',vehicle:'Truck #1 Isuzu NPR',phone:'555-0103'}
  ];
  var _drivers = DEMO_DRIVERS;

  function loadDrivers() {
    if(typeof firebase !== 'undefined') {
      try {
        var db = firebase.firestore();
        db.collection('drivers').get().then(function(snap) {
          if(snap.size > 0) {
            _drivers = snap.docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
          }
        }).catch(function() { /* use fallback */ });
      } catch(e) {}
    }
  }

  var DEMO_JOBS = [
    {id:'JT001',sku:'SKU-2024-001',client:'Acme Corp',quantity:50000,machine:'Flexo 3',dueDate:'2026-04-10',stage:'Production',bomUsage:45,linkedPOs:['PO-2501','PO-2502']},
    {id:'JT002',sku:'SKU-2024-002',client:'BrandWorks Inc',quantity:35000,machine:'Flexo 1',dueDate:'2026-04-12',stage:'QC',bomUsage:72,linkedPOs:['PO-2503']},
    {id:'JT003',sku:'SKU-2024-003',client:'Label Solutions',quantity:25000,machine:'Flexo 2',dueDate:'2026-04-15',stage:'Packaging',bomUsage:88,linkedPOs:['PO-2504','PO-2505']},
    {id:'JT004',sku:'SKU-2024-004',client:'PackCorp',quantity:60000,machine:'Flexo 3',dueDate:'2026-04-08',stage:'Ready to Ship',bomUsage:95,linkedPOs:['PO-2506']},
    {id:'JT005',sku:'SKU-2024-005',client:'Acme Corp',quantity:45000,machine:'Flexo 4',dueDate:'2026-04-20',stage:'Receiving',bomUsage:15,linkedPOs:['PO-2507']},
    {id:'JT006',sku:'SKU-2024-006',client:'PrintTech',quantity:30000,machine:'Flexo 1',dueDate:'2026-04-18',stage:'Staging',bomUsage:30,linkedPOs:['PO-2508']},
    {id:'JT007',sku:'SKU-2024-007',client:'Packaging Plus',quantity:40000,machine:'Flexo 2',dueDate:'2026-04-05',stage:'Out for Delivery',bomUsage:98,linkedPOs:['PO-2509']},
    {id:'JT008',sku:'SKU-2024-008',client:'Label Solutions',quantity:55000,machine:'Flexo 3',dueDate:'2026-03-28',stage:'Delivered',bomUsage:100,linkedPOs:['PO-2510']}
  ];

  // ═══ HELPER FUNCTIONS ═══
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(s) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]; }); }
  function num(n) { return Number(n || 0).toLocaleString(); }
  function money(n) { return '$' + Number(n || 0).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2}); }
  function fDate(v) { try { var d = v && v.toDate ? v.toDate() : new Date(v); if(!d || isNaN(d)) return '—'; return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); } catch(e) { return '—'; } }
  function daysUntil(dateStr) { var d = new Date(dateStr).getTime() - Date.now(); return Math.ceil(d / 86400000); }
  function uid(prefix) { return (prefix || 'log') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

  function toast(msg, type) {
    if(typeof window.toast === 'function') {
      window.toast(msg, type);
    } else {
      console.log('[' + (type || 'info').toUpperCase() + ']', msg);
    }
  }

  function openModal(html) {
    if(typeof window.openModal === 'function') {
      window.openModal(html);
    } else {
      console.log('Modal:', html);
    }
  }

  function closeModal() {
    if(typeof window.closeModal === 'function') {
      window.closeModal();
    }
  }

  // ═══ STAGE HELPERS ═══
  function stageIndex(stage) {
    return JOB_STAGES.indexOf(stage);
  }

  function stageColor(stage) {
    var map = {
      'Material Planning': '#94a3b8',
      'Purchasing': '#38bdf8',
      'Receiving': '#06b6d4',
      'Staging': '#14b8a6',
      'Production': '#8b5cf6',
      'QC': '#f59e0b',
      'Packaging': '#f97316',
      'Ready to Ship': '#10b981',
      'Out for Delivery': '#3b82f6',
      'Delivered': '#16a34a',
      'Complete': '#6b7280'
    };
    return map[stage] || 'var(--tx3)';
  }

  function stageBadge(stage) {
    return '<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;background:' + stageColor(stage) + '15;color:' + stageColor(stage) + ';border:1px solid ' + stageColor(stage) + '40">' + stage + '</span>';
  }

  // ═══ FIRESTORE LISTENERS ═══
  function ensureListeners() {
    if(LOGISTICS.listenersStarted || typeof firebase === 'undefined') return;
    LOGISTICS.listenersStarted = true;

    var db = firebase.firestore();

    // Real-time job tickets listener
    _logisticsListeners.push(db.collection('jobTickets').limit(500).onSnapshot(
      function(snap) {
        LOGISTICS.jobs = snap.docs.map(function(d) { var x = d.data() || {}; x.id = d.id; return x; });
        if(window.S && window.S.view === 'logistics') renderLogisticsView();
      },
      function(err) { console.warn('Logistics jobs listener:', err); }
    ));

    // Real-time materials listener
    _logisticsListeners.push(db.collection('materials').limit(300).onSnapshot(
      function(snap) {
        LOGISTICS.materials = snap.docs.map(function(d) { var x = d.data() || {}; x.id = d.id; return x; });
        if(window.S && window.S.view === 'logistics') renderLogisticsView();
      },
      function(err) { console.warn('Logistics materials listener:', err); }
    ));

    // Real-time shipments listener
    _logisticsListeners.push(db.collection('shipments').limit(200).onSnapshot(
      function(snap) {
        LOGISTICS.shipments = snap.docs.map(function(d) { var x = d.data() || {}; x.id = d.id; return x; });
        if(window.S && window.S.view === 'logistics') renderLogisticsView();
      },
      function(err) { console.warn('Logistics shipments listener:', err); }
    ));

    // Real-time spoilage listener
    _logisticsListeners.push(db.collection('spoilage').limit(200).onSnapshot(
      function(snap) {
        LOGISTICS.spoilage = snap.docs.map(function(d) { var x = d.data() || {}; x.id = d.id; return x; });
        if(window.S && window.S.view === 'logistics') renderLogisticsView();
      },
      function(err) { console.warn('Logistics spoilage listener:', err); }
    ));
  }

  // ═══ RENDER FUNCTIONS ═══
  function renderLogisticsView() {
    ensureListeners();
    var el = $('v-logistics');
    if(!el) return;

    // Use demo data if Firestore is empty
    var isDemo = !LOGISTICS.jobs.length;
    var jobs = LOGISTICS.jobs.length ? LOGISTICS.jobs : DEMO_JOBS;
    var materials = LOGISTICS.materials.length ? LOGISTICS.materials : DEMO_MATERIALS;

    var h = '';
    h += '<div style="padding:16px;background:var(--bg);min-height:100vh">';
    h += '<div style="max-width:1400px;margin:0 auto">';

    // ═══ DEMO BANNER ═══
    if(isDemo){ h += '<div style="background:rgba(255,170,44,0.12);border:1px solid var(--or);border-radius:8px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--or)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Showing sample data — create Job Tickets in Production to populate real logistics data</div>'; }

    // ═══ HEADER ═══
    h += '<div style="margin-bottom:24px">';
    h += '<h1 style="font-size:24px;font-weight:800;color:var(--ac);margin:0 0 8px;font-family:\'Outfit\',monospace"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Logistics & Shipping</h1>';
    h += '<p style="color:var(--tx3);font-size:12px;margin:0">Pipeline tracking • Inventory • QC • Deliveries • Spoilage</p>';
    h += '</div>';

    // ═══ TAB NAVIGATION ═══
    h += '<div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--bdr);overflow-x:auto">';
    var tabs = ['dashboard','jobs','materials','inkroom','qc','packaging','deliveries','spoilage'];
    var tabLabels = ['Dashboard','Jobs','Materials','Ink Room','QC Gate','Packaging','Deliveries','Spoilage'];
    tabs.forEach(function(tab, i) {
      h += '<button onclick="setLogisticsTab(\'' + tab + '\')" style="padding:10px 12px;border:none;background:none;color:' + (LOGISTICS.tab === tab ? 'var(--ac)' : 'var(--tx3)') + ';border-bottom:2px solid ' + (LOGISTICS.tab === tab ? 'var(--ac)' : 'transparent') + ';cursor:pointer;font-size:12px;font-weight:600;transition:all 200ms;white-space:nowrap">' + tabLabels[i] + '</button>';
    });
    h += '</div>';

    // ═══ RENDER ACTIVE TAB ═══
    if(LOGISTICS.tab === 'dashboard') h += renderDashboard(jobs, materials);
    else if(LOGISTICS.tab === 'jobs') h += renderJobsTab(jobs);
    else if(LOGISTICS.tab === 'materials') h += renderMaterialsTab(materials);
    else if(LOGISTICS.tab === 'inkroom') h += renderInkRoomTab(materials);
    else if(LOGISTICS.tab === 'qc') h += renderQCTab(jobs);
    else if(LOGISTICS.tab === 'packaging') h += renderPackagingTab(jobs);
    else if(LOGISTICS.tab === 'deliveries') h += renderDeliveriesTab();
    else if(LOGISTICS.tab === 'spoilage') h += renderSpoilageTab();

    h += '</div>';
    h += '</div>';

    el.innerHTML = h;
  }

  // ═══ DASHBOARD TAB ═══
  function renderDashboard(jobs, materials) {
    var inProduction = jobs.filter(function(j) { return j.stage === 'Production'; }).length;
    var needQC = jobs.filter(function(j) { return j.stage === 'QC'; }).length;
    var packaging = jobs.filter(function(j) { return j.stage === 'Packaging'; }).length;
    var readyToShip = jobs.filter(function(j) { return j.stage === 'Ready to Ship'; }).length;
    var outForDelivery = jobs.filter(function(j) { return j.stage === 'Out for Delivery'; }).length;

    var lowStock = materials.filter(function(m) { return (m.onHand || 0) <= (m.reorderPoint || 0); });

    var h = '';

    // ═══ KPI CARDS ═══
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
    h += kpiCard('In Production', inProduction, 'var(--ac)');
    h += kpiCard('Need QC', needQC, 'var(--or)');
    h += kpiCard('Packaging', packaging, '#8b5cf6');
    h += kpiCard('Ready to Ship', readyToShip, 'var(--gn)');
    h += kpiCard('Out for Delivery', outForDelivery, '#3b82f6');
    h += '</div>';

    // ═══ ALERTS ═══
    if(lowStock.length > 0) {
      h += '<div style="background:#8B0000;border:1px solid #ff4444;border-radius:10px;padding:12px;margin-bottom:16px">';
      h += '<div style="font-size:11px;font-weight:700;color:#ff6b6b;margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> LOW STOCK ALERT (' + lowStock.length + ' items)</div>';
      lowStock.forEach(function(m) {
        h += '<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">' + esc(m.name) + ' — On hand: ' + num(m.onHand) + ', Reorder point: ' + num(m.reorderPoint) + '</div>';
      });
      h += '</div>';
    }

    // ═══ JOB PIPELINE VISUALIZATION ═══
    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:20px">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Job Pipeline</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px">';
    JOB_STAGES.forEach(function(stage) {
      var count = jobs.filter(function(j) { return j.stage === stage; }).length;
      h += '<div style="text-align:center;padding:8px;background:' + stageColor(stage) + '15;border:1px solid ' + stageColor(stage) + '40;border-radius:6px">';
      h += '<div style="font-size:16px;font-weight:800;color:' + stageColor(stage) + ';font-family:\'Courier New\',monospace">' + count + '</div>';
      h += '<div style="font-size:9px;color:var(--tx3);margin-top:2px">' + stage + '</div>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>';

    // ═══ CRITICAL JOBS (OVERDUE/DUE SOON) ═══
    var criticalJobs = jobs.filter(function(j) {
      if(!j.dueDate) return false;
      var daysLeft = daysUntil(j.dueDate);
      return daysLeft <= 2;
    }).sort(function(a, b) { return daysUntil(a.dueDate) - daysUntil(b.dueDate); });

    if(criticalJobs.length > 0) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:20px">';
      h += '<div style="font-size:12px;font-weight:700;color:var(--or);margin-bottom:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> CRITICAL — Due in 2 days or less</div>';
      criticalJobs.slice(0, 5).forEach(function(job) {
        var daysLeft = daysUntil(job.dueDate);
        h += '<div style="background:var(--bg3);padding:10px;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">';
        h += '<div><div style="font-size:11px;font-weight:600;color:var(--ac)">' + esc(job.id) + ' · ' + esc(job.client) + '</div><div style="font-size:9px;color:var(--tx3)">' + num(job.quantity) + ' units · ' + stageBadge(job.stage) + '</div></div>';
        h += '<div style="text-align:right"><div style="font-size:11px;font-weight:700;color:' + (daysLeft <= 0 ? 'var(--rd)' : 'var(--or)') + '">Due in ' + daysLeft + ' day' + (Math.abs(daysLeft) !== 1 ? 's' : '') + '</div></div>';
        h += '</div>';
      });
      h += '</div>';
    }

    return h;
  }

  function kpiCard(label, value, color) {
    return '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px;text-align:center">' +
      '<div style="font-size:28px;font-weight:800;color:' + color + ';font-family:\'Courier New\',monospace;line-height:1">' + value + '</div>' +
      '<div style="font-size:10px;color:var(--tx3);margin-top:4px;font-weight:600">' + label + '</div>' +
      '</div>';
  }

  // ═══ JOBS TAB ═══
  function renderJobsTab(jobs) {
    var h = '';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';

    jobs.sort(function(a, b) {
      var aIdx = stageIndex(a.stage || '');
      var bIdx = stageIndex(b.stage || '');
      return aIdx - bIdx;
    }).forEach(function(job) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
      h += '<div>';
      h += '<div style="font-size:12px;font-weight:700;color:var(--ac);font-family:\'Courier New\',monospace">' + esc(job.id) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3)">' + esc(job.sku) + '</div>';
      h += '</div>';
      h += stageBadge(job.stage || 'Unknown');
      h += '</div>';

      h += '<div style="font-size:11px;margin-bottom:8px">';
      h += '<div style="color:var(--tx);margin-bottom:2px"><strong>' + esc(job.client) + '</strong></div>';
      h += '<div style="color:var(--tx3);font-size:10px">Qty: ' + num(job.quantity) + ' · Machine: ' + esc(job.machine || '—') + '</div>';
      h += '</div>';

      if(job.dueDate) {
        var daysLeft = daysUntil(job.dueDate);
        h += '<div style="padding:6px;background:' + (daysLeft <= 0 ? '#8B0000' : daysLeft <= 3 ? '#FF6600' : 'var(--bg3)') + ';border-radius:4px;margin-bottom:8px;text-align:center">';
        h += '<div style="font-size:10px;font-weight:700;color:' + (daysLeft <= 0 ? '#ff6b6b' : daysLeft <= 3 ? '#ffaa33' : 'var(--tx3)') + '">Due ' + fDate(job.dueDate) + ' (' + daysLeft + 'd)</div>';
        h += '</div>';
      }

      // BOM Usage bar
      var bomPct = job.bomUsage || 0;
      h += '<div style="margin-bottom:8px">';
      h += '<div style="font-size:9px;color:var(--tx3);margin-bottom:2px">BOM Usage: ' + bomPct + '%</div>';
      h += '<div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">';
      h += '<div style="height:100%;width:' + bomPct + '%;background:linear-gradient(90deg,var(--ac),#00ffaa);transition:width 200ms"></div>';
      h += '</div>';
      h += '</div>';

      // Linked POs
      if(job.linkedPOs && job.linkedPOs.length > 0) {
        h += '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px">POs: ' + job.linkedPOs.map(esc).join(', ') + '</div>';
      }

      // Action buttons
      h += '<div style="display:flex;gap:6px">';
      var currentIdx = stageIndex(job.stage || '');
      if(currentIdx >= 0 && currentIdx < JOB_STAGES.length - 1) {
        var nextStage = JOB_STAGES[currentIdx + 1];
        h += '<button onclick="advanceJobStage(\'' + esc(job.id) + '\',\'' + esc(nextStage) + '\')" style="flex:1;padding:6px;background:var(--ac);color:#000;border:none;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer">→ ' + nextStage.split(' ')[0] + '</button>';
      }
      h += '<button onclick="openJobDetails(\'' + esc(job.id) + '\')" style="flex:1;padding:6px;background:var(--bg3);color:var(--tx3);border:1px solid var(--bdr);border-radius:4px;font-size:10px;font-weight:700;cursor:pointer">View</button>';
      h += '</div>';
      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ═══ MATERIALS TAB ═══
  function renderMaterialsTab(materials) {
    var h = '';
    h += '<div style="overflow-x:auto">';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    h += '<thead style="background:var(--bg3);border-bottom:1px solid var(--bdr)">';
    h += '<tr>';
    h += '<th style="padding:8px;text-align:left;color:var(--ac);font-weight:700">Material</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Zone</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">On Hand</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Reserved</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Reorder Pt</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Unit Cost</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Supplier</th>';
    h += '</tr>';
    h += '</thead>';
    h += '<tbody>';

    materials.sort(function(a, b) { return (a.zone || '').localeCompare(b.zone || ''); }).forEach(function(m) {
      var onHand = m.onHand || 0;
      var reorderPt = m.reorderPoint || 0;
      var isLowStock = onHand <= reorderPt;

      h += '<tr style="border-bottom:1px solid var(--bdr);background:' + (isLowStock ? '#8B000015' : 'transparent') + '">';
      h += '<td style="padding:8px;color:var(--tx)">' + esc(m.name) + ' <span style="color:var(--tx3);font-size:9px">(' + esc(m.id) + ')</span></td>';
      h += '<td style="padding:8px;text-align:center;color:var(--ac);font-weight:600">' + esc(m.zone || '—') + ' (' + esc(MATERIAL_ZONES[m.zone] || '?') + ')</td>';
      h += '<td style="padding:8px;text-align:center;color:' + (isLowStock ? '#ff6b6b' : 'var(--gn)') + ';font-weight:600">' + num(onHand) + '</td>';
      h += '<td style="padding:8px;text-align:center;color:var(--tx3)">' + num(m.reserved || 0) + '</td>';
      h += '<td style="padding:8px;text-align:center;color:var(--tx3)">' + num(reorderPt) + '</td>';
      h += '<td style="padding:8px;text-align:center;color:var(--gn);font-weight:600">' + money(m.unitCost || 0) + '</td>';
      h += '<td style="padding:8px;color:var(--tx3)">' + esc(m.supplier || '—') + '</td>';
      h += '</tr>';
    });

    h += '</tbody>';
    h += '</table>';
    h += '</div>';
    return h;
  }

  // ═══ INK ROOM TAB ═══
  function renderInkRoomTab(materials) {
    var inks = materials.filter(function(m) { return (m.zone || '') === 'B'; });

    var h = '';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';

    inks.forEach(function(ink) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
      h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:8px">' + esc(ink.name) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);margin-bottom:8px;line-height:1.4">';
      h += '<div><strong>ID:</strong> ' + esc(ink.id) + '</div>';
      h += '<div><strong>Type:</strong> ' + esc(ink.type || 'UV') + '</div>';
      h += '<div><strong>Supplier:</strong> ' + esc(ink.supplier || '—') + '</div>';
      h += '<div><strong>Hazard Level:</strong> <span style="color:' + (ink.hazardLevel === 'High' ? 'var(--rd)' : ink.hazardLevel === 'Medium' ? 'var(--or)' : 'var(--gn)') + '">' + esc(ink.hazardLevel || 'Low') + '</span></div>';
      h += '</div>';

      var onHand = ink.onHand || 0;
      var reorderPt = ink.reorderPoint || 0;

      h += '<div style="background:var(--bg3);padding:10px;border-radius:6px;margin-bottom:8px">';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
      h += '<div style="font-size:10px;color:var(--tx3)">On Hand</div>';
      h += '<div style="font-size:11px;font-weight:700;color:' + (onHand <= reorderPt ? 'var(--rd)' : 'var(--gn)') + '">' + num(onHand) + ' units</div>';
      h += '</div>';
      h += '<div style="display:flex;justify-content:space-between">';
      h += '<div style="font-size:10px;color:var(--tx3)">Reorder Point</div>';
      h += '<div style="font-size:10px;color:var(--tx3)">' + num(reorderPt) + ' units</div>';
      h += '</div>';
      h += '</div>';

      h += '<button onclick="openInkDetails(\'' + esc(ink.id) + '\')" style="width:100%;padding:6px;background:var(--bg3);color:var(--ac);border:1px solid var(--bdr);border-radius:4px;font-size:10px;font-weight:700;cursor:pointer">View Details</button>';
      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ═══ QC GATE TAB ═══
  function renderQCTab(jobs) {
    var qcJobs = jobs.filter(function(j) { return j.stage === 'QC' || j.stage === 'Production'; });

    var h = '';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">';

    qcJobs.slice(0, 8).forEach(function(job) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
      h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:10px">' + esc(job.id) + ' — ' + esc(job.client) + '</div>';

      QC_CHECKS.forEach(function(check, i) {
        var checked = job.qcChecks && job.qcChecks[i] ? 'checked' : '';
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px;background:var(--bg3);border-radius:4px">';
        h += '<input type="checkbox" ' + checked + ' onclick="updateQCCheck(\'' + esc(job.id) + '\',' + i + ')" style="cursor:pointer;width:16px;height:16px">';
        h += '<label style="flex:1;font-size:10px;color:var(--tx);cursor:pointer;margin:0">' + check + '</label>';
        h += '<span style="font-size:9px;color:' + (checked ? 'var(--gn)' : 'var(--tx3)') + '">' + (checked ? '✓' : '○') + '</span>';
        h += '</div>';
      });

      h += '<div style="margin-top:10px;padding:8px;background:#0a5a0a;border-radius:4px">';
      h += '<button onclick="completeQC(\'' + esc(job.id) + '\')" style="width:100%;padding:6px;background:var(--gn);color:#000;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer">✓ Pass & Advance to Packaging</button>';
      h += '</div>';

      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ═══ PACKAGING TAB ═══
  function renderPackagingTab(jobs) {
    var packagingJobs = jobs.filter(function(j) { return j.stage === 'Packaging' || j.stage === 'Ready to Ship'; });

    var h = '';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';

    packagingJobs.forEach(function(job) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
      h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:8px">' + esc(job.id) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">' + num(job.quantity) + ' units for ' + esc(job.client) + '</div>';

      var packagingProgress = job.packagingSteps || {};

      PACKAGING_STEPS.forEach(function(step, i) {
        var isDone = packagingProgress[i] ? true : false;
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px;background:var(--bg3);border-radius:4px">';
        h += '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onclick="updatePackagingStep(\'' + esc(job.id) + '\',' + i + ')" style="cursor:pointer;width:16px;height:16px">';
        h += '<label style="flex:1;font-size:10px;color:var(--tx);cursor:pointer;margin:0">' + step + '</label>';
        h += '<span style="font-size:9px;color:' + (isDone ? 'var(--gn)' : 'var(--tx3)') + '">' + (isDone ? '✓' : '○') + '</span>';
        h += '</div>';
      });

      var stepsComplete = Object.keys(packagingProgress).length;
      h += '<div style="margin-top:8px;padding:4px;background:var(--bg3);border-radius:4px;text-align:center">';
      h += '<div style="font-size:9px;color:var(--tx3)">' + stepsComplete + '/' + PACKAGING_STEPS.length + ' steps complete</div>';
      h += '</div>';

      if(stepsComplete === PACKAGING_STEPS.length) {
        h += '<div style="margin-top:8px"><button onclick="completePackaging(\'' + esc(job.id) + '\')" style="width:100%;padding:6px;background:var(--gn);color:#000;border:none;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer">✓ Ready to Ship</button></div>';
      }

      h += '</div>';
    });

    h += '</div>';
    return h;
  }

  // ═══ DELIVERIES TAB ═══
  function renderDeliveriesTab() {
    var h = '';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:20px">';

    _drivers.forEach(function(driver) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
      h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + esc(driver.name) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">';
      h += '<div>Vehicle: ' + esc(driver.vehicle) + '</div>';
      h += '<div>Phone: ' + esc(driver.phone) + '</div>';
      h += '</div>';

      h += '<div style="background:var(--bg3);padding:8px;border-radius:4px;margin-bottom:8px;text-align:center">';
      h += '<div style="font-size:11px;font-weight:700;color:var(--ac)">3 Shipments Scheduled</div>';
      h += '</div>';

      h += '<button onclick="openDriverSchedule(\'' + esc(driver.id) + '\')" style="width:100%;padding:6px;background:var(--bg3);color:var(--ac);border:1px solid var(--bdr);border-radius:4px;font-size:10px;font-weight:700;cursor:pointer">View Schedule</button>';
      h += '</div>';
    });

    h += '</div>';

    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Scheduled Shipments</div>';
    h += '<div style="overflow-x:auto">';
    h += '<table style="width:100%;border-collapse:collapse;font-size:10px">';
    h += '<thead style="background:var(--bg3);border-bottom:1px solid var(--bdr)">';
    h += '<tr>';
    h += '<th style="padding:8px;text-align:left;color:var(--ac);font-weight:700">Job</th>';
    h += '<th style="padding:8px;text-align:left;color:var(--ac);font-weight:700">Client</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Driver</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Date</th>';
    h += '<th style="padding:8px;text-align:center;color:var(--ac);font-weight:700">Status</th>';
    h += '</tr>';
    h += '</thead>';
    h += '<tbody>';

    var shipments = LOGISTICS.shipments.length ? LOGISTICS.shipments : [];
    (shipments.length ? shipments : [
      {id:'ship001',jobId:'JT007',client:'Packaging Plus',driver:'Miguel Reyes',date:'2026-04-05',status:'In Transit'},
      {id:'ship002',jobId:'JT008',client:'Label Solutions',driver:'Carlos Duran',date:'2026-03-28',status:'Delivered'}
    ]).slice(0, 6).forEach(function(ship) {
      var statusColor = ship.status === 'Delivered' ? 'var(--gn)' : ship.status === 'In Transit' ? 'var(--ac)' : 'var(--or)';
      h += '<tr style="border-bottom:1px solid var(--bdr)">';
      h += '<td style="padding:8px;color:var(--tx)">' + esc(ship.jobId || '—') + '</td>';
      h += '<td style="padding:8px;color:var(--tx3)">' + esc(ship.client || '—') + '</td>';
      h += '<td style="padding:8px;text-align:center;color:var(--tx3)">' + esc(ship.driver || '—') + '</td>';
      h += '<td style="padding:8px;text-align:center;color:var(--tx3)">' + fDate(ship.date) + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600;color:' + statusColor + '">' + esc(ship.status) + '</td>';
      h += '</tr>';
    });

    h += '</tbody>';
    h += '</table>';
    h += '</div>';
    h += '</div>';

    return h;
  }

  // ═══ SPOILAGE TAB ═══
  function renderSpoilageTab() {
    var spoilage = LOGISTICS.spoilage.length ? LOGISTICS.spoilage : [];

    var totalWaste = spoilage.reduce(function(sum, s) { return sum + (parseFloat(s.quantity) || 0); }, 0);
    var totalCost = spoilage.reduce(function(sum, s) { return sum + (parseFloat(s.estCost) || 0); }, 0);

    var h = '';

    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
    h += kpiCard('Total Waste', num(totalWaste), 'var(--rd)');
    h += kpiCard('Est. Cost', money(totalCost), 'var(--or)');
    h += kpiCard('Incidents', spoilage.length, 'var(--tx3)');
    h += '</div>';

    h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:20px">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:12px">＋ Log Spoilage Event</div>';
    h += '<form onsubmit="logSpoilageEvent(event)" style="display:grid;gap:10px">';
    h += '<input type="text" id="logSpoilageMaterial" placeholder="Material/Item" style="padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;color:var(--tx);font-size:10px" required>';
    h += '<textarea id="logSpoilageReason" placeholder="Reason (defect, wrong qty, damage, etc)" style="padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;color:var(--tx);font-size:10px;resize:vertical;height:60px" required></textarea>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    h += '<input type="number" id="logSpoilageQty" placeholder="Qty (units)" style="padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;color:var(--tx);font-size:10px" required>';
    h += '<input type="number" id="logSpoilageCost" placeholder="Est Cost ($)" step="0.01" style="padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;color:var(--tx);font-size:10px" required>';
    h += '</div>';
    h += '<button type="submit" style="padding:8px;background:var(--ac);color:#000;border:none;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer">Log Event</button>';
    h += '</form>';
    h += '</div>';

    if(spoilage.length > 0) {
      h += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px">';
      h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:12px">Recent Spoilage Log</div>';
      h += '<div style="display:grid;gap:10px">';

      spoilage.slice(-10).reverse().forEach(function(s) {
        h += '<div style="background:var(--bg3);padding:10px;border-radius:6px;border-left:3px solid var(--rd)">';
        h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
        h += '<div style="font-size:11px;font-weight:600;color:var(--tx)">' + esc(s.material || 'Unknown') + '</div>';
        h += '<div style="font-size:10px;color:var(--tx3)">' + fDate(s.loggedAt) + '</div>';
        h += '</div>';
        h += '<div style="font-size:10px;color:var(--tx3);margin-bottom:4px">' + esc(s.reason || '—') + '</div>';
        h += '<div style="display:flex;justify-content:space-between">';
        h += '<div style="font-size:10px;color:var(--tx3)">Qty: ' + num(s.quantity) + ' units</div>';
        h += '<div style="font-size:10px;color:var(--or);font-weight:600">' + money(s.estCost || 0) + '</div>';
        h += '</div>';
        h += '</div>';
      });

      h += '</div>';
      h += '</div>';
    }

    return h;
  }

  // ═══ GLOBAL FUNCTIONS ═══
  window.setLogisticsTab = function(tab) {
    LOGISTICS.tab = tab;
    renderLogisticsView();
  };

  window.advanceJobStage = function(jobId, nextStage) {
    toast('Advancing ' + jobId + ' to ' + nextStage, 'success');
    if(typeof firebase !== 'undefined') {
      var db = firebase.firestore();
      db.collection('jobTickets').doc(jobId).update({ stage: nextStage })
        .then(function() { toast('Job updated', 'success'); })
        .catch(function(e) { toast('Error: ' + e.message, 'error'); });
    }
  };

  window.openJobDetails = function(jobId) {
    var job = LOGISTICS.jobs.find(function(j) { return j.id === jobId; });
    if(!job) {
      toast('Job not found', 'error');
      return;
    }

    var html = '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:20px;max-width:500px">';
    html += '<div style="font-size:16px;font-weight:800;color:var(--ac);margin-bottom:16px">' + esc(job.id) + '</div>';
    html += '<div style="display:grid;gap:10px;font-size:11px">';
    html += '<div><strong style="color:var(--ac)">SKU:</strong> ' + esc(job.sku) + '</div>';
    html += '<div><strong style="color:var(--ac)">Client:</strong> ' + esc(job.client) + '</div>';
    html += '<div><strong style="color:var(--ac)">Quantity:</strong> ' + num(job.quantity) + ' units</div>';
    html += '<div><strong style="color:var(--ac)">Machine:</strong> ' + esc(job.machine) + '</div>';
    html += '<div><strong style="color:var(--ac)">Due Date:</strong> ' + fDate(job.dueDate) + '</div>';
    html += '<div><strong style="color:var(--ac)">Current Stage:</strong> ' + stageBadge(job.stage) + '</div>';
    html += '<div><strong style="color:var(--ac)">BOM Usage:</strong> ' + (job.bomUsage || 0) + '%</div>';
    html += '</div>';
    html += '<button onclick="closeModal()" style="margin-top:16px;width:100%;padding:8px;background:var(--bg3);color:var(--ac);border:1px solid var(--bdr);border-radius:4px;cursor:pointer">Close</button>';
    html += '</div>';

    openModal(html);
  };

  window.updateQCCheck = function(jobId, checkIndex) {
    var job = LOGISTICS.jobs.find(function(j) { return j.id === jobId; });
    if(!job) { toast('Job not found', 'error'); return; }
    job.qcChecks = job.qcChecks || {};
    job.qcChecks[checkIndex] = !job.qcChecks[checkIndex];
    if(typeof firebase !== 'undefined') {
      var db = firebase.firestore();
      db.collection('jobTickets').doc(jobId).update({ qcChecks: job.qcChecks })
        .then(function() { if(typeof DB!=='undefined'&&DB.logActivity) DB.logActivity('logistics.qc', 'QC check updated for job '+jobId); toast('QC check ' + (checkIndex + 1) + ' saved', 'success'); })
        .catch(function(err) { toast('Save error: ' + err.message, 'error'); });
    } else {
      toast('QC check ' + (checkIndex + 1) + ' toggled (local only)', 'info');
      renderLogisticsView();
    }
  };

  window.completeQC = function(jobId) {
    window.advanceJobStage(jobId, 'Packaging');
  };

  window.updatePackagingStep = function(jobId, stepIndex) {
    var job = LOGISTICS.jobs.find(function(j) { return j.id === jobId; });
    if(!job) { toast('Job not found', 'error'); return; }
    job.packagingSteps = job.packagingSteps || {};
    job.packagingSteps[stepIndex] = !job.packagingSteps[stepIndex];
    if(typeof firebase !== 'undefined') {
      var db = firebase.firestore();
      db.collection('jobTickets').doc(jobId).update({ packagingSteps: job.packagingSteps })
        .then(function() { if(typeof DB!=='undefined'&&DB.logActivity) DB.logActivity('logistics.packaging', 'Packaging step updated for job '+jobId); toast('Packaging step ' + (stepIndex + 1) + ' saved', 'success'); })
        .catch(function(err) { toast('Save error: ' + err.message, 'error'); });
    } else {
      toast('Packaging step ' + (stepIndex + 1) + ' toggled (local only)', 'info');
      renderLogisticsView();
    }
  };

  window.completePackaging = function(jobId) {
    window.advanceJobStage(jobId, 'Ready to Ship');
  };

  window.openInkDetails = function(inkId) {
    var ink = LOGISTICS.materials.find(function(m) { return m.id === inkId; });
    if(!ink) ink = DEMO_MATERIALS.find(function(m) { return m.id === inkId; });
    if(!ink) { toast('Ink not found', 'error'); return; }

    var html = '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:20px;max-width:500px">';
    html += '<div style="font-size:16px;font-weight:800;color:var(--ac);margin-bottom:16px">' + esc(ink.name) + '</div>';
    html += '<div style="display:grid;gap:10px;font-size:11px">';
    html += '<div><strong style="color:var(--ac)">Type:</strong> ' + esc(ink.type || 'UV') + '</div>';
    html += '<div><strong style="color:var(--ac)">Supplier:</strong> ' + esc(ink.supplier) + '</div>';
    html += '<div><strong style="color:var(--ac)">On Hand:</strong> ' + num(ink.onHand) + ' units</div>';
    html += '<div><strong style="color:var(--ac)">Reorder Point:</strong> ' + num(ink.reorderPoint) + ' units</div>';
    html += '<div><strong style="color:var(--ac)">Unit Cost:</strong> ' + money(ink.unitCost) + '</div>';
    html += '<div><strong style="color:var(--ac)">Hazard Level:</strong> <span style="color:' + (ink.hazardLevel === 'High' ? 'var(--rd)' : 'var(--gn)') + '">' + esc(ink.hazardLevel || 'Low') + '</span></div>';
    html += '</div>';
    html += '<button onclick="closeModal()" style="margin-top:16px;width:100%;padding:8px;background:var(--bg3);color:var(--ac);border:1px solid var(--bdr);border-radius:4px;cursor:pointer">Close</button>';
    html += '</div>';

    openModal(html);
  };

  window.openDriverSchedule = function(driverId) {
    var driver = _drivers.find(function(d) { return d.id === driverId; });
    if(!driver) { toast('Driver not found', 'error'); return; }

    var html = '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:20px;max-width:500px">';
    html += '<div style="font-size:16px;font-weight:800;color:var(--ac);margin-bottom:16px">' + esc(driver.name) + '</div>';
    html += '<div style="display:grid;gap:10px;font-size:11px;margin-bottom:16px">';
    html += '<div><strong style="color:var(--ac)">Vehicle:</strong> ' + esc(driver.vehicle) + '</div>';
    html += '<div><strong style="color:var(--ac)">Phone:</strong> ' + esc(driver.phone) + '</div>';
    html += '</div>';
    html += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:10px">Today Schedule</div>';
    html += '<div style="background:var(--bg3);padding:10px;border-radius:6px;margin-bottom:6px"><div style="font-size:10px;color:var(--tx)">8:00 AM - Pickup at Warehouse (JT007)</div></div>';
    html += '<div style="background:var(--bg3);padding:10px;border-radius:6px;margin-bottom:6px"><div style="font-size:10px;color:var(--tx)">10:30 AM - Delivery to Packaging Plus</div></div>';
    html += '<div style="background:var(--bg3);padding:10px;border-radius:6px"><div style="font-size:10px;color:var(--tx)">2:00 PM - Pickup at Warehouse (JT009)</div></div>';
    html += '<button onclick="closeModal()" style="margin-top:16px;width:100%;padding:8px;background:var(--bg3);color:var(--ac);border:1px solid var(--bdr);border-radius:4px;cursor:pointer">Close</button>';
    html += '</div>';

    openModal(html);
  };

  window.logSpoilageEvent = function(e) {
    e.preventDefault();
    var material = ($('logSpoilageMaterial') || {}).value || '';
    var reason = ($('logSpoilageReason') || {}).value || '';
    var quantity = parseFloat(($('logSpoilageQty') || {}).value) || 0;
    var estCost = parseFloat(($('logSpoilageCost') || {}).value) || 0;
    if(!material || !quantity) { toast('Material and quantity required', 'error'); return; }
    var doc = {
      id: uid('spoil'),
      material: material,
      reason: reason,
      quantity: quantity,
      estCost: estCost,
      loggedAt: new Date().toISOString(),
      loggedBy: (typeof window.getUserName === 'function') ? window.getUserName() : 'User'
    };
    if(typeof firebase !== 'undefined') {
      var db = firebase.firestore();
      db.collection('spoilage').doc(doc.id).set(doc)
        .then(function() { if(typeof DB!=='undefined'&&DB.logActivity) DB.logActivity('logistics.spoilage', 'Spoilage logged: '+doc.material); toast('Spoilage event logged and saved', 'success'); })
        .catch(function(err) { toast('Save error: ' + err.message, 'error'); });
    } else {
      // Fallback: add to local state
      LOGISTICS.spoilage.push(doc);
      toast('Spoilage event logged (local only)', 'success');
      renderLogisticsView();
    }
  };

  // ═══ INITIALIZATION ═══
  function initLogistics() {
    loadDrivers();
    if(typeof window.MFX !== 'undefined' && window.MFX.on) {
      window.MFX.on('view.logistics', function() {
        renderLogisticsView();
      });
    }

    // Chain goView — save previous wrapper and call it, then add logistics logic
    var _logisticsOrigGoView = window.goView;
    if(typeof _logisticsOrigGoView === 'function') {
      window.goView = function(v) {
        _logisticsOrigGoView.apply(this, arguments);
        if(v === 'logistics') {
          renderLogisticsView();
        }
      };
    }

    window.renderLogisticsView = renderLogisticsView;
    console.log('✅ MFX Logistics module v1 initialized');
  }

  if(document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initLogistics, 1500);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initLogistics, 1500);
    });
  }

  window.detachLogisticsListeners=function(){_logisticsListeners.forEach(function(fn){fn()});_logisticsListeners=[];};

})();
