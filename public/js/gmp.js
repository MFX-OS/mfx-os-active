// ══════════════════════════════════════════════════════════════════
// MFX OS — GMP & ENVIRONMENTAL MONITORING (SQF Ed.10)
// Hazard Analysis & Quality Assurance System
// Drop-in: <script src="js/gmp.js"></script>
// ══════════════════════════════════════════════════════════════════

(function(){
  'use strict';

  // ─── STATE ───
  var _gmpCache={
    gmpInspections:[],
    tempReadings:[],
    swabResults:[],
    waterTests:[],
    pestLogs:[],
    pestSightings:[],
    wasteLog:[],
    glassRegister:[]
  };
  var _gmpReady=false;
  var S_GMP={tab:'dashboard',subtab:'overview',editId:null,filter:'all',search:''};

  // ─── CONSTANTS ───
  var ZONES=['Production Floor','Ink Room (Zone B)','Warehouse (Zone A)','Shipping (Zone S)','Prepress','Break Room','Restrooms','Loading Dock','Mechanical Room','Office'];
  var PEST_TYPES=['Rodent','Insect — Flying','Insect — Crawling','Bird','Stored Product Pest','Other'];
  var PEST_DEVICES=['Bait Station','Glue Board','ILT (Insect Light Trap)','Exterior Bait Station','Pheromone Trap'];
  var SWAB_SITES=['Press 1 — Impression Cylinder','Press 1 — Unwind Shaft','Press 2 — Platen','Ink Station 3 — Tray','Laminator — Nip Roll','Slitter — Blade Guard','Warehouse — Rack A-01','Break Room — Counter','Restroom — Door Handle','Shipping — Packing Table'];
  var WATER_POINTS=['Main Inlet','Break Room Faucet','Restroom','Ink Room Wash Station','Eyewash Station'];
  var GLASS_ITEMS=['Office window','Fluorescent covers','UV lamp housings','Thermometers'];

  var GMP_CHECKLIST=[
    {id:'gmp01',cat:'Personal Hygiene',item:'All personnel wearing clean uniforms/smocks',sqf:'11.4.1'},
    {id:'gmp02',cat:'Personal Hygiene',item:'No jewelry (rings, watches, earrings) in production',sqf:'11.4.2'},
    {id:'gmp03',cat:'Personal Hygiene',item:'Hair restraints worn (caps/nets)',sqf:'11.4.3'},
    {id:'gmp04',cat:'Personal Hygiene',item:'Handwashing after breaks/restroom',sqf:'11.4.4'},
    {id:'gmp05',cat:'Personal Hygiene',item:'No food/drink/tobacco in production areas',sqf:'11.4.5'},
    {id:'gmp06',cat:'Personal Hygiene',item:'Personal belongings stored in designated lockers',sqf:'11.4.6'},
    {id:'gmp07',cat:'Facility Condition',item:'Floors clean, dry, free of debris',sqf:'11.2.2'},
    {id:'gmp08',cat:'Facility Condition',item:'Walls & ceilings intact — no peeling paint, damage',sqf:'11.2.3'},
    {id:'gmp09',cat:'Facility Condition',item:'Lighting adequate and fixtures protected/shatterproof',sqf:'11.2.5'},
    {id:'gmp10',cat:'Facility Condition',item:'Doors and windows sealed — no gaps',sqf:'11.2.7'},
    {id:'gmp11',cat:'Facility Condition',item:'Drains clean and covered',sqf:'11.2.8'},
    {id:'gmp12',cat:'Facility Condition',item:'Ventilation adequate — no condensation',sqf:'11.2.9'},
    {id:'gmp13',cat:'Pest Awareness',item:'No evidence of pest activity (droppings, gnaw marks, nesting)',sqf:'11.3.1'},
    {id:'gmp14',cat:'Pest Awareness',item:'Exterior doors closed when not in use',sqf:'11.3.3'},
    {id:'gmp15',cat:'Pest Awareness',item:'ILTs operational and clean',sqf:'11.3.4'},
    {id:'gmp16',cat:'Foreign Material',item:'No glass/brittle plastic in production areas',sqf:'11.5.1'},
    {id:'gmp17',cat:'Foreign Material',item:'Metal detection N/A (label/packaging — documented exemption)',sqf:'11.5.2'},
    {id:'gmp18',cat:'Foreign Material',item:'Pallets inspected — no splinters or nails protruding',sqf:'11.5.3'},
    {id:'gmp19',cat:'Storage',item:'Materials stored off floor (min 6" clearance)',sqf:'11.6.1'},
    {id:'gmp20',cat:'Storage',item:'FIFO/FEFO rotation observed',sqf:'11.6.2'},
    {id:'gmp21',cat:'Storage',item:'Chemicals stored separately from production materials',sqf:'11.6.3'},
    {id:'gmp22',cat:'Storage',item:'Quarantine area clearly marked and secured',sqf:'11.6.4'},
    {id:'gmp23',cat:'Waste Management',item:'Waste bins emptied regularly — not overflowing',sqf:'11.7.1'},
    {id:'gmp24',cat:'Waste Management',item:'Waste area clean and pest-free',sqf:'11.7.2'},
    {id:'gmp25',cat:'Equipment',item:'Equipment surfaces clean and free of ink/adhesive buildup',sqf:'11.8.1'},
    {id:'gmp26',cat:'Equipment',item:'Maintenance tools stored properly after use',sqf:'11.8.2'},
    {id:'gmp27',cat:'Documentation',item:'GMP signage posted (handwashing, no food, PPE)',sqf:'11.9.1'},
    {id:'gmp28',cat:'Documentation',item:'Cleaning schedule posted and current',sqf:'11.9.2'},
  ];

  var TEMP_LIMITS={
    'Production Floor':{tempMin:65,tempMax:80,humMin:30,humMax:60},
    'Ink Room (Zone B)':{tempMin:65,tempMax:78,humMin:30,humMax:55},
    'Warehouse (Zone A)':{tempMin:55,tempMax:85,humMin:20,humMax:65},
    'Shipping (Zone S)':{tempMin:55,tempMax:85,humMin:20,humMax:65},
    'Prepress':{tempMin:65,tempMax:78,humMin:35,humMax:55},
  };

  // ─── SEED DATA ───
  var SEED_DATA={
    gmpInspections:[
      {id:'insp001',date:'2026-03-28',zone:'Production Floor',type:'Daily',inspector:'Marco Rodriguez',passed:26,total:28,score:92.86,category:'Facility Condition',findings:'Floors clean, minor ink spot on west wall cleaned immediately',capa:''},
      {id:'insp002',date:'2026-03-27',zone:'Warehouse (Zone A)',type:'Daily',inspector:'Diana Park',passed:27,total:28,score:96.43,category:'Storage',findings:'FIFO rotation verified, one pallet misaligned corrected',capa:''},
      {id:'insp003',date:'2026-03-26',zone:'Ink Room (Zone B)',type:'Weekly',inspector:'Carlos Mendez',passed:25,total:28,score:89.29,category:'Personal Hygiene',findings:'Two personnel without proper hair restraints — retrained',capa:'Additional PPE briefing scheduled'},
    ],
    tempReadings:[
      {id:'tmp001',zone:'Production Floor',date:'2026-04-03',time:'06:15',temp:72.3,humidity:45,by:'Marco Rodriguez',status:'in'},
      {id:'tmp002',zone:'Production Floor',date:'2026-04-03',time:'12:00',temp:73.8,humidity:48,by:'Marco Rodriguez',status:'in'},
      {id:'tmp003',zone:'Ink Room (Zone B)',date:'2026-04-03',time:'06:30',temp:70.5,humidity:42,by:'Marco Rodriguez',status:'in'},
      {id:'tmp004',zone:'Warehouse (Zone A)',date:'2026-04-03',time:'06:20',temp:68.2,humidity:40,by:'Diana Park',status:'in'},
      {id:'tmp005',zone:'Shipping (Zone S)',date:'2026-04-03',time:'06:25',temp:72.1,humidity:44,by:'Diana Park',status:'in'},
      {id:'tmp006',zone:'Production Floor',date:'2026-04-02',time:'15:45',temp:79.2,humidity:52,by:'Marco Rodriguez',status:'warn'},
      {id:'tmp007',zone:'Prepress',date:'2026-04-03',time:'06:10',temp:71.8,humidity:48,by:'Carlos Mendez',status:'in'},
    ],
    swabResults:[
      {id:'swab001',site:'Press 1 — Impression Cylinder',date:'2026-03-28',apc:150,coliform:'Negative',yeastMold:'Negative',status:'pass'},
      {id:'swab002',site:'Ink Station 3 — Tray',date:'2026-03-28',apc:320,coliform:'Negative',yeastMold:'Positive',status:'fail'},
      {id:'swab003',site:'Laminator — Nip Roll',date:'2026-03-28',apc:85,coliform:'Negative',yeastMold:'Negative',status:'pass'},
      {id:'swab004',site:'Break Room — Counter',date:'2026-03-28',apc:420,coliform:'Positive',yeastMold:'Positive',status:'fail'},
      {id:'swab005',site:'Warehouse — Rack A-01',date:'2026-03-28',apc:45,coliform:'Negative',yeastMold:'Negative',status:'pass'},
    ],
    waterTests:[
      {id:'wt001',point:'Main Inlet',date:'2026-03-28',pH:7.2,chlorine:0.8,coliform:'Negative',turbidity:0.1,status:'pass'},
      {id:'wt002',point:'Break Room Faucet',date:'2026-03-28',pH:7.1,chlorine:0.7,coliform:'Negative',turbidity:0.15,status:'pass'},
      {id:'wt003',point:'Ink Room Wash Station',date:'2026-03-28',pH:7.3,chlorine:0.9,coliform:'Negative',turbidity:0.12,status:'pass'},
      {id:'wt004',point:'Eyewash Station',date:'2026-03-25',pH:7.0,chlorine:0.6,coliform:'Negative',turbidity:0.08,status:'pass'},
    ],
    pestLogs:[
      {id:'pst001',date:'2026-03-15',provider:'Orkin',tech:'Carlos Mendez',type:'Monthly Service',findings:'All stations inspected. ILT Unit #3 — 4 flies. No rodent activity.',activity:'None',followUp:''},
      {id:'pst002',date:'2026-02-15',provider:'Orkin',tech:'Sarah Wong',type:'Monthly Service',findings:'Rodent droppings found in loading dock — 3 new stations placed.',activity:'Remediation',followUp:'Recheck 2026-02-22'},
    ],
    pestSightings:[
      {id:'pest001',zone:'Loading Dock',sightingType:'Rodent',date:'2026-02-20',time:'14:30',description:'Single mouse droppings near dock door',resolution:'Traps set, area cleaned',resolvedBy:'Diana Park',resolvedDate:'2026-02-22',status:'resolved'},
      {id:'pest002',zone:'Break Room',sightingType:'Insect — Flying',date:'2026-03-18',time:'09:15',description:'Small fruit fly near waste bin',resolution:'Bin emptied, drain bleached',resolvedBy:'Marco Rodriguez',resolvedDate:'2026-03-18',status:'resolved'},
    ],
    wasteLog:[
      {id:'waste001',type:'UV Ink Waste',date:'2026-03-20',amount:'15 kg',handler:'Disposal Services Inc',manifest:'MFX-2026-089',notes:'Empty cartridges from Press 1'},
      {id:'waste002',type:'General Waste',date:'2026-03-22',amount:'220 kg',handler:'Standard Waste',manifest:'—',notes:'Weekly cleanup'},
    ],
    glassRegister:[
      {id:'glass001',item:'Office window',type:'Tempered Glass',protected:'Yes',lastInspected:'2026-03-15'},
      {id:'glass002',item:'Fluorescent covers',type:'Plastic',protected:'Yes',lastInspected:'2026-03-22'},
      {id:'glass003',item:'UV lamp housings',type:'Borosilicate Glass',protected:'Yes',lastInspected:'2026-03-20'},
      {id:'glass004',item:'Thermometers',type:'Mercury Glass',protected:'Yes',lastInspected:'2026-03-18'},
    ]
  };

  // ─── FIREBASE ───
  var db=null;
  function initFirebase(){
    try{
      db=firebase.firestore();
      startGMPListeners();
    }catch(e){
      console.warn('Firebase not ready for GMP',e);
      _gmpCache=SEED_DATA;
      _gmpReady=true;
    }
  }

  function startGMPListeners(){
    if(!db)return;
    // Map Firestore collection names to local cache keys.
    // Firestore rules define 'gmpReadings' but locally we store as 'tempReadings'.
    var cols=[
      {fb:'gmpInspections',key:'gmpInspections'},
      {fb:'gmpReadings',key:'tempReadings'},
      {fb:'swabResults',key:'swabResults'},
      {fb:'waterTests',key:'waterTests'},
      {fb:'pestLogs',key:'pestLogs'},
      {fb:'pestSightings',key:'pestSightings'},
      {fb:'wasteLog',key:'wasteLog'},
      {fb:'glassRegister',key:'glassRegister'}
    ];
    cols.forEach(function(c){
      db.collection(c.fb).orderBy('date','desc').limit(200).onSnapshot(function(s){
        _gmpCache[c.key]=s.docs.map(function(d){return Object.assign({},d.data(),{id:d.id})});
      },function(e){
        console.warn('GMP listener error for '+c.fb,e);
      });
    });
    _gmpReady=true;
  }

  // ─── UTILITIES ───
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]});}
  function getToday(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function formatDate(iso){return iso?new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}):'-'}
  function fDate(d){return new Date(d).toLocaleDateString()}
  function fTime(t){return t?t.slice(0,5):'-'}
  function gid(){return 'id_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4)}
  function N(n){return Number(n||0).toLocaleString()}
  function pct(num,den){return den>0?(num/den*100).toFixed(1)+'%':'0%'}

  function toast(msg,type){
    if(window.MFX&&window.MFX.emit){
      window.MFX.emit('toast',{msg:msg,type:type||'info'});
    }else{
      console.log('['+type+']',msg);
    }
  }

  function openModal(html){
    var m=document.getElementById('mfx-modal')||document.createElement('div');
    m.id='mfx-modal';
    m.innerHTML='<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:999;display:flex;align-items:center;justify-content:center" onclick="closeModal()"><div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:12px;max-width:600px;max-height:80vh;overflow:auto;padding:20px;box-shadow:0 20px 80px rgba(0,0,0,.5)" onclick="event.stopPropagation()">'+html+'<div style="margin-top:20px;display:flex;gap:8px;justify-content:flex-end"><button onclick="closeModal()" style="padding:8px 16px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);cursor:pointer;font-weight:700">Close</button></div></div></div>';
    document.body.appendChild(m);
  }

  function closeModal(){
    var m=document.getElementById('mfx-modal');
    if(m)m.remove();
  }

  // ─── CLASSIFICATION ───
  function classifyTemp(zone,temp,humidity){
    var limits=TEMP_LIMITS[zone]||{tempMin:65,tempMax:80,humMin:30,humMax:60};
    if(temp>=limits.tempMin&&temp<=limits.tempMax&&humidity>=limits.humMin&&humidity<=limits.humMax)return 'in';
    if((temp>limits.tempMax+3||temp<limits.tempMin-3)||(humidity>limits.humMax+5||humidity<limits.humMin-5))return 'out';
    return 'warn';
  }

  function statusColor(status){
    if(status==='in'||status==='pass')return '#2ee89e';
    if(status==='warn')return '#ffaa2c';
    if(status==='out'||status==='fail')return '#ff6474';
    return '#6a809e';
  }

  function statusBg(status){
    if(status==='in'||status==='pass')return 'rgba(46,232,158,0.08)';
    if(status==='warn')return 'rgba(255,170,44,0.08)';
    if(status==='out'||status==='fail')return 'rgba(255,100,116,0.08)';
    return 'rgba(106,128,158,0.08)';
  }

  function statusLabel(status){
    var m={in:'In Range',out:'Out of Range',warn:'Warning',pass:'Pass',fail:'Fail',resolved:'Resolved',open:'Open'};
    return m[status]||status;
  }

  // ─── DASHBOARD ───
  function renderDashboard(){
    var el=$('v-gmp');if(!el)return;

    var today=getToday();
    var todayReadings=_gmpCache.tempReadings.filter(function(r){return r.date===today});
    var todayWarnings=todayReadings.filter(function(r){return r.status==='warn'||r.status==='out'});
    var recentInsp=_gmpCache.gmpInspections[0]||{};
    var openPests=_gmpCache.pestSightings.filter(function(p){return p.status==='open'});
    var recentSwabs=_gmpCache.swabResults.slice(0,5);
    var swabFails=recentSwabs.filter(function(s){return s.status==='fail'}).length;
    var recentWater=_gmpCache.waterTests.slice(0,5);
    var lastPestSvc=_gmpCache.pestLogs[0];

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px">';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#00d4f5;font-family:\'SF Mono\',monospace">'+N(todayReadings.length)+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Readings Today</div></div>';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#ffaa2c;font-family:\'SF Mono\',monospace">'+N(todayWarnings.length)+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Warnings</div></div>';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#a17bff;font-family:\'SF Mono\',monospace">'+(recentInsp.score?recentInsp.score.toFixed(1)+'%':'---')+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;letter-spacing:1px;margin-top:4px">GMP Score</div></div>';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#ff6474;font-family:\'SF Mono\',monospace">'+N(openPests.length)+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Open Pests</div></div>';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:#2ee89e;font-family:\'SF Mono\',monospace">'+N(_gmpCache.glassRegister.length)+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Glass Items</div></div>';
    h+='</div>';

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px;margin-bottom:12px">';
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Temperature Warnings</div>';
    if(todayWarnings.length){
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">';
      todayWarnings.forEach(function(w){
        h+='<div style="background:var(--bg3);border-left:3px solid '+statusColor(w.status)+';padding:8px;border-radius:4px;font-size:10px">';
        h+='<div style="font-weight:700;color:var(--tx)">'+w.zone+'</div>';
        h+='<div style="color:var(--tx3)">Temp: '+w.temp+'°F | Humidity: '+w.humidity+'%</div>';
        h+='<div style="color:var(--tx4);font-size:9px">'+fTime(w.time)+' by '+w.by+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }else{
      h+='<div style="color:var(--tx3);font-size:10px">All zones within acceptable range</div>';
    }
    h+='</div>';

    if(openPests.length){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px;margin-bottom:12px">';
      h+='<div style="font-size:11px;font-weight:700;color:#ff6474;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Open Pest Sightings ('+openPests.length+')</div>';
      openPests.slice(0,3).forEach(function(p){
        h+='<div style="background:var(--bg3);padding:8px;border-radius:4px;margin-bottom:6px;font-size:10px">';
        h+='<div style="font-weight:700;color:var(--tx)">'+p.zone+' — '+p.sightingType+'</div>';
        h+='<div style="color:var(--tx3)">'+p.description+'</div>';
        h+='<div style="color:var(--tx4);font-size:9px">'+formatDate(p.date)+' '+p.time+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px">';
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Quick Stats</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:10px">';
    h+='<div><span style="color:var(--tx3)">Surface Swabs (Recent):</span> <span style="color:var(--tx);font-weight:700">'+N(recentSwabs.length)+'</span> <span style="color:'+statusColor(swabFails>0?'fail':'pass')+'">'+swabFails+' fail</span></div>';
    h+='<div><span style="color:var(--tx3)">Water Tests (Recent):</span> <span style="color:var(--tx);font-weight:700">'+N(recentWater.length)+'</span> <span style="color:#2ee89e">all pass</span></div>';
    h+='<div><span style="color:var(--tx3)">Pest Inspections:</span> <span style="color:var(--tx);font-weight:700">'+N(_gmpCache.pestLogs.length)+'</span> <span style="color:var(--tx4)">'+(lastPestSvc?formatDate(lastPestSvc.date):'—')+'</span></div>';
    h+='<div><span style="color:var(--tx3)">GMP Inspections:</span> <span style="color:var(--tx);font-weight:700">'+N(_gmpCache.gmpInspections.length)+'</span> <span style="color:var(--tx4)">'+(recentInsp?formatDate(recentInsp.date):'—')+'</span></div>';
    h+='</div></div>';

    el.innerHTML=h;
  }

  // ─── TEMPERATURE / HUMIDITY ───
  function renderTemperatureView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
    h+='<button onclick="S_GMP.subtab=\'readings\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='readings'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='readings'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Readings</button>';
    h+='<button onclick="S_GMP.subtab=\'newreading\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='newreading'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='newreading'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Log Reading</button>';
    h+='</div>';

    if(S_GMP.subtab==='readings'){
      h+=renderTempReadings();
    }else{
      h+=renderTempForm();
    }

    el.innerHTML=h;
  }

  function renderTempReadings(){
    var h='<table style="width:100%;border-collapse:collapse;font-size:10px">';
    h+='<thead><tr style="border-bottom:2px solid var(--bdr)"><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Date</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Zone</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Time</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Temp</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Humidity</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Status</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">By</th></tr></thead>';
    h+='<tbody>';
    _gmpCache.tempReadings.slice(0,30).forEach(function(r){
      var status=classifyTemp(r.zone,r.temp,r.humidity);
      h+='<tr style="border-bottom:1px solid var(--bdr)"><td style="padding:8px">'+formatDate(r.date)+'</td><td style="padding:8px">'+r.zone+'</td><td style="padding:8px">'+fTime(r.time)+'</td><td style="padding:8px;text-align:center;font-weight:700">'+r.temp+'°F</td><td style="padding:8px;text-align:center;font-weight:700">'+r.humidity+'%</td><td style="padding:8px;text-align:center"><span style="background:'+statusBg(status)+';color:'+statusColor(status)+';padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">'+statusLabel(status)+'</span></td><td style="padding:8px">'+r.by+'</td></tr>';
    });
    h+='</tbody></table>';
    return h;
  }

  function renderTempForm(){
    var h='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Zone</label><select id="tempZone" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>'+ZONES.join('</option><option>')+'</option></select></div>';
    h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Date</label><input id="tempDate" type="date" value="'+getToday()+'" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
    h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Time (HH:MM)</label><input id="tempTime" type="time" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
    h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Temperature (°F)</label><input id="tempVal" type="number" step="0.1" min="50" max="100" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
    h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Humidity (%)</label><input id="tempHum" type="number" step="0.1" min="0" max="100" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
    h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Logged By</label><input id="tempBy" type="text" placeholder="Your name" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
    h+='</div>';
    h+='<button onclick="saveTemperatureReading()" style="margin-top:12px;padding:8px 16px;background:#00d4f5;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Save Reading</button>';
    h+='</div>';
    return h;
  }

  function saveTemperatureReading(){
    var zone=document.getElementById('tempZone').value;
    var date=document.getElementById('tempDate').value;
    var time=document.getElementById('tempTime').value;
    var temp=parseFloat(document.getElementById('tempVal').value);
    var hum=parseFloat(document.getElementById('tempHum').value);
    var by=document.getElementById('tempBy').value||'Unknown';

    if(!zone||!date||!time||isNaN(temp)||isNaN(hum)){
      toast('Please fill all fields','error');
      return;
    }

    var status=classifyTemp(zone,temp,hum);
    var rec={id:gid(),zone:zone,date:date,time:time,temp:temp,humidity:hum,by:by,status:status};
    _gmpCache.tempReadings.unshift(rec);

    if(db){
      db.collection('gmpReadings').doc(rec.id).set(rec).then(function(){
        toast('Temperature reading saved','success');
        S_GMP.subtab='readings';
        renderTemperatureView();
      }).catch(function(e){
        toast('Error saving: '+e.message,'error');
      });
    }else{
      toast('Temperature reading saved locally','success');
      renderTemperatureView();
    }
  }

  // ─── SURFACE SWAB TESTING ───
  function renderSwabView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
    h+='<button onclick="S_GMP.subtab=\'results\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='results'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='results'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Results</button>';
    h+='<button onclick="S_GMP.subtab=\'newswab\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='newswab'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='newswab'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Log Swab</button>';
    h+='</div>';

    if(S_GMP.subtab==='results'){
      h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="border-bottom:2px solid var(--bdr)"><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Date</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Site</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">APC</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Coliform</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Yeast/Mold</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Result</th></tr></thead><tbody>';
      _gmpCache.swabResults.slice(0,25).forEach(function(r){
        h+='<tr style="border-bottom:1px solid var(--bdr)"><td style="padding:8px">'+formatDate(r.date)+'</td><td style="padding:8px;font-size:9px">'+r.site+'</td><td style="padding:8px;text-align:center">'+N(r.apc)+'</td><td style="padding:8px;text-align:center;color:'+statusColor(r.coliform==='Negative'?'pass':'fail')+'">'+r.coliform+'</td><td style="padding:8px;text-align:center;color:'+statusColor(r.yeastMold==='Negative'?'pass':'fail')+'">'+r.yeastMold+'</td><td style="padding:8px;text-align:center"><span style="background:'+statusBg(r.status)+';color:'+statusColor(r.status)+';padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">'+statusLabel(r.status)+'</span></td></tr>';
      });
      h+='</tbody></table>';
    }else{
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px">';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Site</label><select id="swabSite" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>'+SWAB_SITES.join('</option><option>')+'</option></select></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Date</label><input id="swabDate" type="date" value="'+getToday()+'" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">APC Count</label><input id="swabAPC" type="number" min="0" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Coliform</label><select id="swabColiform" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>Negative</option><option>Positive</option></select></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Yeast/Mold</label><select id="swabYM" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>Negative</option><option>Positive</option></select></div>';
      h+='</div>';
      h+='<button onclick="saveSwabResult()" style="margin-top:12px;padding:8px 16px;background:#00d4f5;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Save Swab</button>';
      h+='</div>';
    }

    el.innerHTML=h;
  }

  function saveSwabResult(){
    var site=document.getElementById('swabSite').value;
    var date=document.getElementById('swabDate').value;
    var apc=parseInt(document.getElementById('swabAPC').value)||0;
    var coliform=document.getElementById('swabColiform').value;
    var ym=document.getElementById('swabYM').value;

    if(!site||!date){
      toast('Please fill all fields','error');
      return;
    }

    var status=(coliform==='Negative'&&ym==='Negative')?'pass':'fail';
    var rec={id:gid(),site:site,date:date,apc:apc,coliform:coliform,yeastMold:ym,status:status};
    _gmpCache.swabResults.unshift(rec);

    if(db){
      db.collection('swabResults').doc(rec.id).set(rec).catch(function(e){
        toast('Error: '+e.message,'error');
      });
    }
    toast('Swab result saved','success');
    S_GMP.subtab='results';
    renderSwabView();
  }

  // ─── WATER QUALITY ───
  function renderWaterView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
    h+='<button onclick="S_GMP.subtab=\'tests\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='tests'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='tests'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Tests</button>';
    h+='<button onclick="S_GMP.subtab=\'newwater\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='newwater'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='newwater'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Log Test</button>';
    h+='</div>';

    if(S_GMP.subtab==='tests'){
      h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="border-bottom:2px solid var(--bdr)"><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Date</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Point</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">pH</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Chlorine</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Coliform</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Turbidity</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Result</th></tr></thead><tbody>';
      _gmpCache.waterTests.slice(0,20).forEach(function(w){
        h+='<tr style="border-bottom:1px solid var(--bdr)"><td style="padding:8px">'+formatDate(w.date)+'</td><td style="padding:8px">'+w.point+'</td><td style="padding:8px;text-align:center">'+w.pH+'</td><td style="padding:8px;text-align:center">'+w.chlorine+' ppm</td><td style="padding:8px;text-align:center;color:'+statusColor(w.coliform==='Negative'?'pass':'fail')+'">'+w.coliform+'</td><td style="padding:8px;text-align:center">'+w.turbidity+' NTU</td><td style="padding:8px;text-align:center"><span style="background:'+statusBg(w.status)+';color:'+statusColor(w.status)+';padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">'+statusLabel(w.status)+'</span></td></tr>';
      });
      h+='</tbody></table>';
    }else{
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px">';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Point</label><select id="waterPoint" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>'+WATER_POINTS.join('</option><option>')+'</option></select></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Date</label><input id="waterDate" type="date" value="'+getToday()+'" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">pH</label><input id="waterPH" type="number" step="0.1" min="5" max="9" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Chlorine (ppm)</label><input id="waterChl" type="number" step="0.1" min="0" max="5" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Coliform</label><select id="waterColiform" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>Negative</option><option>Positive</option></select></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Turbidity (NTU)</label><input id="waterTurb" type="number" step="0.01" min="0" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='</div>';
      h+='<button onclick="saveWaterTest()" style="margin-top:12px;padding:8px 16px;background:#00d4f5;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Save Test</button>';
      h+='</div>';
    }

    el.innerHTML=h;
  }

  function saveWaterTest(){
    var point=document.getElementById('waterPoint').value;
    var date=document.getElementById('waterDate').value;
    var pH=parseFloat(document.getElementById('waterPH').value)||0;
    var chlorine=parseFloat(document.getElementById('waterChl').value)||0;
    var coliform=document.getElementById('waterColiform').value;
    var turbidity=parseFloat(document.getElementById('waterTurb').value)||0;

    if(!point||!date){
      toast('Please fill all fields','error');
      return;
    }

    var status=(coliform==='Negative'&&pH>=6.5&&pH<=8.5)?'pass':'fail';
    var rec={id:gid(),point:point,date:date,pH:pH,chlorine:chlorine,coliform:coliform,turbidity:turbidity,status:status};
    _gmpCache.waterTests.unshift(rec);

    if(db){
      db.collection('waterTests').doc(rec.id).set(rec).catch(function(e){
        toast('Error: '+e.message,'error');
      });
    }
    toast('Water test saved','success');
    S_GMP.subtab='tests';
    renderWaterView();
  }

  // ─── GMP INSPECTIONS ───
  function renderInspectionsView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
    h+='<button onclick="S_GMP.subtab=\'inspections\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='inspections'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='inspections'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">History</button>';
    h+='<button onclick="S_GMP.subtab=\'newinsp\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='newinsp'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='newinsp'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">New Inspection</button>';
    h+='</div>';

    if(S_GMP.subtab==='inspections'){
      _gmpCache.gmpInspections.slice(0,15).forEach(function(insp){
        h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-bottom:8px">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h+='<div><span style="font-weight:700;color:var(--tx)">'+insp.zone+'</span><span style="font-size:9px;color:var(--tx3);margin-left:8px">'+formatDate(insp.date)+'</span></div>';
        h+='<span style="background:'+statusBg('in')+';color:'+statusColor('in')+';padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">'+insp.score.toFixed(1)+'%</span>';
        h+='</div>';
        h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:4px">Inspector: '+insp.inspector+' | '+insp.type+' | '+insp.passed+'/'+insp.total+' passed</div>';
        h+='<div style="font-size:10px;color:var(--tx3)">'+insp.findings+'</div>';
        if(insp.capa)h+='<div style="font-size:10px;color:#ffaa2c;margin-top:4px">CAPA: '+insp.capa+'</div>';
        h+='</div>';
      });
    }else{
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px">';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Zone</label><select id="inspZone" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>'+ZONES.join('</option><option>')+'</option></select></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Date</label><input id="inspDate" type="date" value="'+getToday()+'" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Inspector</label><input id="inspInspector" type="text" placeholder="Your name" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Type</label><select id="inspType" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px"><option>Daily</option><option>Weekly</option></select></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">Findings</label><textarea id="inspFindings" placeholder="Notes" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px;min-height:60px"></textarea></div>';
      h+='<div><label style="font-size:9px;color:var(--tx4);text-transform:uppercase;display:block;margin-bottom:4px">CAPA (if needed)</label><textarea id="inspCAPA" placeholder="Corrective actions" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:11px;min-height:60px"></textarea></div>';
      h+='</div>';
      h+='<button onclick="startAuditFromForm()" style="margin-top:12px;padding:8px 16px;background:#a17bff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Start Checklist →</button>';
      h+='</div>';
    }

    el.innerHTML=h;
  }

  // ─── RUN AUDIT ───
  function startAuditFromForm(){
    // Store inspection metadata from the form before navigating away
    S_GMP.auditMeta={
      zone:(document.getElementById('inspZone')||{}).value||'Production Floor',
      date:(document.getElementById('inspDate')||{}).value||getToday(),
      inspector:(document.getElementById('inspInspector')||{}).value||'Unknown',
      type:(document.getElementById('inspType')||{}).value||'Daily',
      findings:(document.getElementById('inspFindings')||{}).value||'',
      capa:(document.getElementById('inspCAPA')||{}).value||''
    };
    S_GMP.tab='runaudit';
    renderGMP();
  }

  function renderRunAuditView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    var cats=[];GMP_CHECKLIST.forEach(function(item){if(cats.indexOf(item.cat)<0)cats.push(item.cat)});

    var total=GMP_CHECKLIST.length;
    h+='<div id="gmp-progress-bar" style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:12px">';
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:6px">Progress: <span id="gmp-progress-text" style="font-family:\'SF Mono\',monospace">0/'+total+'</span> (<span id="gmp-progress-pct" style="color:#00d4f5">0%</span>)</div>';
    h+='<div style="background:var(--bg2);border-radius:4px;height:6px;overflow:hidden"><div id="gmp-progress-fill" style="background:#00d4f5;height:100%;width:0%;transition:all .3s"></div></div>';
    h+='</div>';

    cats.forEach(function(cat){
      var items=GMP_CHECKLIST.filter(function(i){return i.cat===cat});
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-bottom:10px">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--ac);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">'+cat+' ('+items.length+')</div>';
      items.forEach(function(item){
        h+='<div style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:var(--bg3);border-radius:4px;margin-bottom:6px">';
        h+='<input type="checkbox" data-gmp-check="1" style="margin-top:2px;cursor:pointer">';
        h+='<div><div style="font-size:10px;color:var(--tx);line-height:1.4">'+item.item+'</div><div style="font-size:8px;color:var(--tx4);margin-top:2px">SQF '+item.sqf+'</div></div>';
        h+='</div>';
      });
      h+='</div>';
    });

    if(window.SQF_EV){h+=SQF_EV.renderAttachmentZone('gmp-insp','gmpInspection');h+=SQF_EV.renderSignaturePad('gmp-insp','Inspector — E-Signature');}
    h+='<div class="compliance-boundary" style="margin:12px 0"></div>';
    h+='<button class="btn btn-signoff" onclick="saveGMPInspection()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Save Inspection</button>';

    el.innerHTML=h;

    // Init signature pads
    if(window.SQF_EV) setTimeout(function(){SQF_EV.initAllPads()},50);

    // Attach change listeners to update progress bar after DOM insertion
    var checkboxes=el.querySelectorAll('[data-gmp-check]');
    checkboxes.forEach(function(cb){
      cb.addEventListener('change',function(){
        var checked=el.querySelectorAll('[data-gmp-check]:checked').length;
        var p=total>0?Math.round(checked/total*100):0;
        var txt=document.getElementById('gmp-progress-text');
        var pctEl=document.getElementById('gmp-progress-pct');
        var fill=document.getElementById('gmp-progress-fill');
        if(txt)txt.textContent=checked+'/'+total;
        if(pctEl)pctEl.textContent=p+'%';
        if(fill)fill.style.width=p+'%';
      });
    });
  }

  function saveGMPInspection(){
    var meta=S_GMP.auditMeta||{};
    var zone=meta.zone||'Production Floor';
    var date=meta.date||getToday();
    var inspector=meta.inspector||'Unknown';
    var type=meta.type||'Daily';
    var findings=meta.findings||'';
    var capa=meta.capa||'';

    var checked=document.querySelectorAll('[data-gmp-check]:checked').length;
    var total=GMP_CHECKLIST.length;
    var score=total>0?Math.round(checked/total*1000)/10:0;

    var rec={
      id:gid(),
      date:date,
      zone:zone,
      type:type,
      inspector:inspector,
      passed:checked,
      total:total,
      score:score,
      category:GMP_CHECKLIST[0].cat,
      findings:findings,
      capa:capa
    };
    if(window.SQF_EV){rec.evidence=SQF_EV.collectEvidence('gmp-insp');SQF_EV.uploadEvidence('gmp-insp','gmpInspection',{recordNum:'GMP_'+date+'_'+zone.replace(/\s/g,'')}).catch(function(e){console.warn('gmpEvidenceUpload:',e);});SQF_EV.clearStash('gmp-insp');}

    _gmpCache.gmpInspections.unshift(rec);

    if(db){
      db.collection('gmpInspections').doc(rec.id).set(rec).catch(function(e){
        toast('Error: '+e.message,'error');
      });
    }

    toast('✓ GMP Inspection saved ('+score.toFixed(1)+'%)','success');
    S_GMP.tab='inspections';
    S_GMP.subtab='inspections';
    renderInspectionsView();
  }

  // ─── GLASS & BRITTLE REGISTER ───
  function renderGlassView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="border-bottom:2px solid var(--bdr)"><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Item</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Type</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Protected</th><th style="padding:8px;text-align:center;font-size:8px;color:var(--tx4);text-transform:uppercase">Last Inspected</th></tr></thead><tbody>';
    _gmpCache.glassRegister.forEach(function(g){
      h+='<tr style="border-bottom:1px solid var(--bdr)"><td style="padding:8px">'+g.item+'</td><td style="padding:8px">'+g.type+'</td><td style="padding:8px;text-align:center"><span style="color:#2ee89e;font-weight:700">'+g.protected+'</span></td><td style="padding:8px;text-align:center">'+formatDate(g.lastInspected)+'</td></tr>';
    });
    h+='</tbody></table>';

    el.innerHTML=h;
  }

  // ─── PEST CONTROL ───
  function renderPestView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
    h+='<button onclick="S_GMP.subtab=\'pests\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='pests'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='pests'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Logs</button>';
    h+='<button onclick="S_GMP.subtab=\'sightings\';renderGMP()" style="padding:8px 14px;background:'+(S_GMP.subtab==='sightings'?'var(--ac)':'var(--bg3)')+';color:'+(S_GMP.subtab==='sightings'?'#000':'var(--tx)')+';border:1px solid var(--bdr);border-radius:6px;cursor:pointer;font-weight:700;font-size:11px">Sightings</button>';
    h+='</div>';

    if(S_GMP.subtab==='sightings'){
      _gmpCache.pestSightings.forEach(function(p){
        var col=p.status==='resolved'?'#2ee89e':'#ff6474';
        h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+col+';border-radius:0 8px 8px 0;padding:12px;margin-bottom:8px">';
        h+='<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
        h+='<div><span style="font-weight:700;color:var(--tx)">'+p.zone+'</span><span style="font-size:9px;color:var(--tx3);margin-left:8px">'+formatDate(p.date)+'</span></div>';
        h+='<span style="background:'+(p.status==='resolved'?'rgba(46,232,158,0.08)':'rgba(255,100,116,0.08)')+';color:'+col+';padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase">'+p.status+'</span>';
        h+='</div>';
        h+='<div style="font-size:10px;color:var(--tx)">'+p.sightingType+': '+p.description+'</div>';
        h+='<div style="font-size:9px;color:var(--tx3);margin-top:4px">Resolution: '+p.resolution+'</div>';
        h+='<div style="font-size:9px;color:var(--tx4)">By '+p.resolvedBy+' on '+formatDate(p.resolvedDate)+'</div>';
        h+='</div>';
      });
    }else{
      _gmpCache.pestLogs.forEach(function(p){
        h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-bottom:8px">';
        h+='<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
        h+='<div><span style="font-weight:700;color:var(--tx)">'+p.provider+'</span><span style="font-size:9px;color:var(--tx3);margin-left:8px">'+formatDate(p.date)+'</span></div>';
        h+='<span style="background:rgba(46,232,158,0.08);color:#2ee89e;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700">'+p.type+'</span>';
        h+='</div>';
        h+='<div style="font-size:10px;color:var(--tx3)">Tech: '+p.tech+'</div>';
        h+='<div style="font-size:10px;color:var(--tx);margin-top:4px">'+p.findings+'</div>';
        h+='</div>';
      });
    }

    el.innerHTML=h;
  }

  // ─── WASTE MANAGEMENT ───
  function renderWasteView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    h+='<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="border-bottom:2px solid var(--bdr)"><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Date</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Type</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Amount</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Handler</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Manifest</th><th style="padding:8px;text-align:left;font-size:8px;color:var(--tx4);text-transform:uppercase">Notes</th></tr></thead><tbody>';
    _gmpCache.wasteLog.forEach(function(w){
      h+='<tr style="border-bottom:1px solid var(--bdr)"><td style="padding:8px">'+formatDate(w.date)+'</td><td style="padding:8px;font-weight:700">'+w.type+'</td><td style="padding:8px">'+w.amount+'</td><td style="padding:8px;font-size:9px">'+w.handler+'</td><td style="padding:8px;font-size:9px">'+w.manifest+'</td><td style="padding:8px;font-size:9px;color:var(--tx3)">'+w.notes+'</td></tr>';
    });
    h+='</tbody></table>';

    el.innerHTML=h;
  }

  // ─── SQF COMPLIANCE ───
  function renderSQFView(){
    var el=$('v-gmp');if(!el)return;

    var h='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr)">';
    var tabs=['Dashboard','Temperature','Swabs','Water','Inspections','Run Audit','Glass','Pest','Waste','SQF'];
    tabs.forEach(function(t){
      var key=t.toLowerCase().replace(/\s/g,'');
      h+='<div style="padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer;border-bottom:3px solid '+(S_GMP.tab===key?'#00d4f5':'transparent')+';color:'+(S_GMP.tab===key?'#00d4f5':'var(--tx3)')+'" onclick="S_GMP.tab=\''+key+'\';renderGMP()">'+t+'</div>';
    });
    h+='</div>';

    var cats=[];GMP_CHECKLIST.forEach(function(item){if(cats.indexOf(item.cat)<0)cats.push(item.cat)});

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:14px;margin-bottom:12px">';
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:10px">SQF Edition 10 Readiness — Target Cert Date: January 2027</div>';

    var avgScore=_gmpCache.gmpInspections.length>0?_gmpCache.gmpInspections.slice(0,10).reduce(function(a,b){return a+b.score},0)/_gmpCache.gmpInspections.slice(0,10).length:0;

    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:900;color:#a17bff;font-family:\'SF Mono\',monospace">'+avgScore.toFixed(1)+'%</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;margin-top:4px">Avg GMP Score</div></div>';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:900;color:#2ee89e;font-family:\'SF Mono\',monospace">'+N(_gmpCache.gmpInspections.length)+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;margin-top:4px">Inspections</div></div>';
    h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:900;color:#14b8a6;font-family:\'SF Mono\',monospace">'+N(_gmpCache.tempReadings.length)+'</div><div style="font-size:8px;color:var(--tx4);text-transform:uppercase;margin-top:4px">Readings Logged</div></div>';
    h+='</div>';

    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:12px"><strong>SQF PRP Checklist Coverage:</strong></div>';
    cats.forEach(function(cat){
      var items=GMP_CHECKLIST.filter(function(i){return i.cat===cat});
      h+='<div style="background:var(--bg3);border-radius:6px;padding:8px;margin-bottom:6px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center">';
      h+='<span style="font-size:10px;font-weight:700;color:var(--tx)">'+cat+'</span>';
      h+='<span style="font-size:9px;color:var(--ac);font-weight:700">'+items.length+' items</span>';
      h+='</div>';
      h+='<div style="background:var(--bg2);border-radius:3px;height:4px;margin-top:4px;overflow:hidden"><div style="background:#a17bff;height:100%;width:85%;transition:all .3s"></div></div>';
      h+='</div>';
    });

    h+='<div style="margin-top:14px;padding:12px;background:var(--bg3);border:1px solid rgba(161,123,255,0.19);border-radius:6px;font-size:10px;color:var(--tx3)">';
    h+='<strong>Next Steps:</strong> Continue monthly GMP inspections, maintain temperature logs, conduct quarterly water testing. Target 92%+ average GMP score by Q4 2026.';
    h+='</div>';

    el.innerHTML=h;
  }

  // ─── MAIN RENDER ───
  function renderGMP(){
    var tab=S_GMP.tab||'dashboard';
    switch(tab){
      case 'dashboard': renderDashboard(); break;
      case 'temperature': renderTemperatureView(); break;
      case 'swabs': renderSwabView(); break;
      case 'water': renderWaterView(); break;
      case 'inspections': renderInspectionsView(); break;
      case 'runaudit': renderRunAuditView(); break;
      case 'glass': renderGlassView(); break;
      case 'pest': renderPestView(); break;
      case 'waste': renderWasteView(); break;
      case 'sqf': renderSQFView(); break;
      default: renderDashboard();
    }
  }

  // ─── INIT ───
  function initGMP(){
    if(typeof MFX!=='undefined'&&MFX.on){
      MFX.on('view.gmp',function(){
        renderGMP();
      });
    }

    var origGoView=window.goView;
    if(typeof origGoView==='function'){
      window.goView=function(v){
        origGoView(v);
        if(v==='gmp'){
          renderGMP();
        }
      };
    }

    initFirebase();
    console.log('✅ MFX GMP & Environmental Monitoring v1.0 initialized');
  }

  // Helper to get element by ID
  var $=function(id){return document.getElementById(id)};

  // Register renderer and global exports
  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_RENDERERS.gmp=renderGMP;
  window.renderGMP=renderGMP;
  window.saveTemperatureReading=saveTemperatureReading;
  window.saveSwabResult=saveSwabResult;
  window.saveWaterTest=saveWaterTest;
  window.saveGMPInspection=saveGMPInspection;
  window.startAuditFromForm=startAuditFromForm;
  window.S_GMP=S_GMP;

  // Auto-init (Firebase listeners + goView wrapper)
  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(initGMP,1500);
  }else{
    document.addEventListener('DOMContentLoaded',function(){
      setTimeout(initGMP,1500);
    });
  }
})();
