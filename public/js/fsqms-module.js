// ======================================================================
// MFX OS -- FOOD SAFETY & QUALITY MANAGEMENT SYSTEM (SQF Ed.10)
// Sanitation, Quality, Materials & SQF Element Readiness
// Drop-in: <script src="js/fsqms-module.js"></script>
// ======================================================================

(function(){
  'use strict';

  // --- STATE (localStorage cache + Firestore sync) ---
  var ST={tab:'dashboard',sanSub:'preop',qualSub:'inprocess',matSub:'receiving'};
  var SAN=JSON.parse(localStorage.getItem('mfx-fsqms-san')||'[]');
  var QUAL=JSON.parse(localStorage.getItem('mfx-fsqms-qual')||'[]');
  var MAT=JSON.parse(localStorage.getItem('mfx-fsqms-mat')||'[]');
  var _fsqmsDb=null;
  try{_fsqmsDb=typeof fbDb!=='undefined'?fbDb:(typeof firebase!=='undefined'?firebase.firestore():null);}catch(e){}

  function persistSan(){
    localStorage.setItem('mfx-fsqms-san',JSON.stringify(SAN));
    if(_fsqmsDb&&SAN.length){var last=SAN[SAN.length-1];_fsqmsDb.collection('fsqmsSanitation').doc(last.id).set(last).catch(function(e){console.warn('FSQMS sync san:',e.message);});}
  }
  function persistQual(){
    localStorage.setItem('mfx-fsqms-qual',JSON.stringify(QUAL));
    if(_fsqmsDb&&QUAL.length){var last=QUAL[QUAL.length-1];_fsqmsDb.collection('fsqmsQuality').doc(last.id).set(last).catch(function(e){console.warn('FSQMS sync qual:',e.message);});}
  }
  function persistMat(){
    localStorage.setItem('mfx-fsqms-mat',JSON.stringify(MAT));
    if(_fsqmsDb&&MAT.length){var last=MAT[MAT.length-1];_fsqmsDb.collection('fsqmsMaterials').doc(last.id).set(last).catch(function(e){console.warn('FSQMS sync mat:',e.message);});}
  }

  // Load from Firestore on init (merge with localStorage)
  function fsqmsLoadFromFirestore(){
    if(!_fsqmsDb)return;
    var existingIds={};
    SAN.forEach(function(r){existingIds[r.id]=1});
    QUAL.forEach(function(r){existingIds[r.id]=1});
    MAT.forEach(function(r){existingIds[r.id]=1});

    _fsqmsDb.collection('fsqmsSanitation').orderBy('date','desc').limit(200).get().then(function(snap){
      var added=0;
      snap.forEach(function(d){var rec=d.data();if(!existingIds[rec.id]){SAN.push(rec);existingIds[rec.id]=1;added++;}});
      if(added){localStorage.setItem('mfx-fsqms-san',JSON.stringify(SAN));if(ST.tab==='dashboard'||ST.tab==='sanitation')renderFSQMS();}
    }).catch(function(){});

    _fsqmsDb.collection('fsqmsQuality').orderBy('date','desc').limit(200).get().then(function(snap){
      var added=0;
      snap.forEach(function(d){var rec=d.data();if(!existingIds[rec.id]){QUAL.push(rec);existingIds[rec.id]=1;added++;}});
      if(added){localStorage.setItem('mfx-fsqms-qual',JSON.stringify(QUAL));if(ST.tab==='dashboard'||ST.tab==='quality')renderFSQMS();}
    }).catch(function(){});

    _fsqmsDb.collection('fsqmsMaterials').orderBy('date','desc').limit(200).get().then(function(snap){
      var added=0;
      snap.forEach(function(d){var rec=d.data();if(!existingIds[rec.id]){MAT.push(rec);existingIds[rec.id]=1;added++;}});
      if(added){localStorage.setItem('mfx-fsqms-mat',JSON.stringify(MAT));if(ST.tab==='dashboard'||ST.tab==='materials')renderFSQMS();}
    }).catch(function(){});
  }
  setTimeout(fsqmsLoadFromFirestore, 2000);

  // --- CONSTANTS ---
  var USERS=['Maria Rodriguez','James Chen','Sarah Patel','Alex Williams','Kim Torres'];
  var SHIFTS=['Day 6am-2pm','Evening 2pm-10pm','Night 10pm-6am'];
  var LINES=['Line 1','Line 2','Line 3','Flexo Press A','Flexo Press B','Converting Line'];
  var SUPPLIERS=['Nexpack Films','ChemTech Inks','PolyBase Corp','SealRight Materials','ColorPro Pigments'];
  var MATERIALS=['LDPE Film Roll','HDPE Granules','Flexo Ink','Adhesive TS-400','Release Liner','PET Film','Solvent Blend','Lamination Adhesive'];
  var SQF_ELEMENTS=[
    {clause:'2.1',name:'Management Commitment',score:92,risk:'low'},
    {clause:'2.4',name:'Food Safety / HACCP',score:95,risk:'low'},
    {clause:'2.5',name:'SQF Verification',score:71,risk:'high'},
    {clause:'2.6',name:'Traceability',score:90,risk:'low'},
    {clause:'2.9',name:'Allergen Management',score:68,risk:'high'},
    {clause:'13.3',name:'Sanitation',score:89,risk:'low'},
    {clause:'13.8',name:'Raw Materials',score:83,risk:'low'},
    {clause:'13.10',name:'Calibration',score:74,risk:'medium'}
  ];
  var SAN_CHECKS=['Floors/Drains','Walls','Equipment','Overheads','Utensils','Chemical Residual','Light Covers'];
  var QC_CHECKS=['Print Registration','Color Match','Seal Strength','Surface Cleanliness'];
  var DEFECT_TYPES=['none','cosmetic','dimensional','print','seal','contamination'];
  var HOLD_TYPES=['quality','food-safety','ccp-deviation','allergen'];
  var RELEASE_CHECKS=['CCPs Complete','In-Process Passed','Labels OK','Meets Spec','Packaging OK','Traceability OK'];

  // --- HELPERS ---
  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function nowTime(){return new Date().toTimeString().slice(0,5);}
  function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
  function esc(s){return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function opts(arr,blank){return (blank?'<option value="">'+blank+'</option>':'')+arr.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');}
  function badge(t){
    var c=t==='PASS'||t==='Released'||t==='Approved'||t==='RELEASED'||t==='APPROVED'?'#0f0':
          t==='FAIL'||t==='Rejected'||t==='REJECTED'?'#f44':
          t==='HOLD'||t==='Hold'||t==='Quarantine'?'#fb0':
          t==='low'||t==='LOW'?'#4c6':
          t==='medium'||t==='MED'?'#fb0':'#f44';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#000;background:'+c+'">'+esc(t).toUpperCase()+'</span>';
  }
  function riskBadge(r){
    var c=r==='low'?'#4c6':r==='medium'?'#fb0':'#f44';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#000;background:'+c+'">'+r.toUpperCase()+'</span>';
  }
  function statusBadge(s){
    var map={pass:'#4c6',fail:'#f44',hold:'#fb0',released:'#00bcd4',approved:'#00bcd4',quarantine:'#fb0',rejected:'#f44',rework:'#fb0',held:'#fb0'};
    var c=map[(s||'').toLowerCase()]||'var(--tx3)';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#000;background:'+c+'">'+esc(s).toUpperCase()+'</span>';
  }
  function pfBtns(name){
    return '<div style="display:flex;gap:4px">'+
      '<button type="button" onclick="this.parentNode.dataset.v=\'pass\';this.style.background=\'#4c6\';this.nextSibling.style.background=\'\';this.nextSibling.nextSibling.style.background=\'\'" style="padding:3px 10px;border-radius:12px;border:1px solid var(--bdr);cursor:pointer;font-size:11px;background:'+'"'+' data-name="'+name+'">PASS</button>'+
      '<button type="button" onclick="this.parentNode.dataset.v=\'fail\';this.previousSibling.style.background=\'\';this.style.background=\'#f44\';this.nextSibling.style.background=\'\'" style="padding:3px 10px;border-radius:12px;border:1px solid var(--bdr);cursor:pointer;font-size:11px">FAIL</button>'+
      '<button type="button" onclick="this.parentNode.dataset.v=\'n/a\';this.previousSibling.previousSibling.style.background=\'\';this.previousSibling.style.background=\'\';this.style.background=\'#29b6f6\'" style="padding:3px 10px;border-radius:12px;border:1px solid var(--bdr);cursor:pointer;font-size:11px">N/A</button>'+
    '</div>';
  }
  function tblHead(cols){
    return '<table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr>'+cols.map(function(c){
      return '<th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--tx3);border-bottom:1px solid var(--bdr)">'+c+'</th>';
    }).join('')+'</tr></thead><tbody>';
  }
  function tblRow(cells,i){
    var bg=i%2===0?'var(--bg2)':'transparent';
    return '<tr style="background:'+bg+'">'+cells.map(function(c){
      return '<td style="padding:6px 8px;font-size:12px;color:var(--tx);border-bottom:1px solid var(--bdr)">'+c+'</td>';
    }).join('')+'</tr>';
  }

  // --- PILL TABS ---
  function pills(items,active,fn){
    return '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">'+items.map(function(it){
      var act=it.id===active;
      return '<button onclick="'+fn+'(\''+it.id+'\')" style="padding:6px 16px;border-radius:20px;border:1px solid '+(act?'var(--ac)':'var(--bdr)')+';background:'+(act?'var(--ac)':'transparent')+';color:'+(act?'#000':'var(--tx)')+';cursor:pointer;font-size:12px;font-weight:'+(act?'700':'400')+'">'+it.label+'</button>';
    }).join('')+'</div>';
  }

  // --- FORM ROW HELPERS ---
  function fRow(label,html){return '<div style="margin-bottom:10px"><label style="display:block;font-size:11px;color:var(--tx3);margin-bottom:3px">'+label+'</label>'+html+'</div>';}
  function fInput(id,type,ph){return '<input id="'+id+'" type="'+(type||'text')+'" placeholder="'+(ph||'')+'" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:12px;box-sizing:border-box"/>';}
  function fSelect(id,items,blank){return '<select id="'+id+'" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:12px;box-sizing:border-box">'+opts(items,blank||'-- Select --')+'</select>';}
  function fTextarea(id,ph){return '<textarea id="'+id+'" rows="2" placeholder="'+(ph||'')+'" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:12px;box-sizing:border-box;resize:vertical"></textarea>';}

  // --- DASHBOARD ---
  function renderDashboard(){
    var todayStr=today();
    var sanToday=SAN.filter(function(r){return r.date===todayStr;}).length;
    var qualToday=QUAL.filter(function(r){return r.date===todayStr&&r.type==='qc';}).length;
    var openHolds=QUAL.filter(function(r){return r.type==='hold'&&(!r.resolved);}).length;
    var matToday=MAT.filter(function(r){return r.date===todayStr&&r.type==='receiving';}).length;
    var avgScore=Math.round(SQF_ELEMENTS.reduce(function(s,e){return s+e.score;},0)/SQF_ELEMENTS.length);

    var kpis=[
      {n:avgScore+'%',l:'SQF Score'},
      {n:sanToday,l:'Sanitation Today'},
      {n:qualToday,l:'QC Today'},
      {n:openHolds,l:'Open Holds'},
      {n:matToday,l:'Materials Received'}
    ];
    var h='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">';
    kpis.forEach(function(k){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;text-align:center">'+
        '<div style="font-size:28px;font-weight:700;color:var(--ac)">'+k.n+'</div>'+
        '<div style="font-size:11px;color:var(--tx3);margin-top:4px">'+k.l+'</div></div>';
    });
    h+='</div>';

    // SQF Element Readiness
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:20px">';
    h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:12px">SQF Element Readiness</div>';
    h+=tblHead(['Clause','Element','Score','Risk']);
    SQF_ELEMENTS.forEach(function(el,i){
      var bar='<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:'+el.score+'%;height:100%;background:'+(el.score>=85?'#4c6':el.score>=75?'#fb0':'#f44')+';border-radius:3px"></div></div><span style="font-size:11px;min-width:32px">'+el.score+'%</span></div>';
      h+=tblRow([el.clause,el.name,bar,riskBadge(el.risk)],i);
    });
    h+='</tbody></table></div>';

    // Recent activity cards
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px">Recent Sanitation</div>';
    SAN.slice(-3).reverse().forEach(function(r){
      h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;color:var(--tx2)">'+esc(r.date)+' | '+esc(r.line)+' | '+statusBadge(r.release)+' <span style="color:var(--tx3)">by '+esc(r.completedBy)+'</span></div>';
    });
    if(!SAN.length) h+='<div style="font-size:11px;color:var(--tx3)">No records yet</div>';
    h+='</div>';

    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px">';
    h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px">Recent Quality</div>';
    QUAL.slice(-3).reverse().forEach(function(r){
      var lbl=r.type==='hold'?'HOLD #'+esc(r.tagNum):r.type==='release'?'RELEASE':esc(r.productCode||'');
      h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;color:var(--tx2)">'+esc(r.date)+' | '+lbl+' | '+statusBadge(r.disposition||r.finalDisp||'')+'</div>';
    });
    if(!QUAL.length) h+='<div style="font-size:11px;color:var(--tx3)">No records yet</div>';
    h+='</div></div>';
    return h;
  }

  // --- SANITATION ---
  function renderSanitation(){
    var h=pills([
      {id:'preop',label:'Pre-Op Daily'},
      {id:'weekly',label:'Weekly Deep Clean'},
      {id:'monthly',label:'Monthly Review'}
    ],ST.sanSub,'window.MFX.FSQMS.setSanSub');

    if(ST.sanSub==='preop'){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
      h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:12px">Pre-Op Sanitation Inspection</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Date',fInput('san-date','date'));
      h+=fRow('Shift',fSelect('san-shift',SHIFTS));
      h+=fRow('Line',fSelect('san-line',LINES));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
      h+=fRow('Completed By',fSelect('san-by',USERS));
      h+=fRow('Verified By',fSelect('san-vby',USERS));
      h+='</div>';
      h+='<div style="font-size:12px;font-weight:600;color:var(--tx);margin:12px 0 8px">Inspection Checks</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      SAN_CHECKS.forEach(function(c){
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px"><span style="font-size:11px;color:var(--tx)">'+c+'</span><div id="san-chk-'+c.replace(/[^a-zA-Z]/g,'')+'" data-v="">'+pfBtns(c)+'</div></div>';
      });
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px">';
      h+=fRow('ATP Result (RLU)',fInput('san-atp','number','e.g. 150'));
      h+=fRow('Pest Activity',fSelect('san-pest',['None','Minor','Significant']));
      h+=fRow('Line Release',fSelect('san-release',['Released','Held']));
      h+='</div>';
      h+=fRow('Deficiencies / Notes',fTextarea('san-notes','Describe any deficiencies...'));
      if(window.SQF_EV){h+=SQF_EV.renderAttachmentZone('fsqms-san','sanitation');h+=SQF_EV.renderSignaturePad('fsqms-san','Completed By — E-Signature');}
      h+='<div class="compliance-boundary" style="margin-top:12px"></div>';
      h+='<button class="btn btn-signoff" onclick="window.MFX.FSQMS.saveSan()" style="margin-top:8px">Save Record</button>';
      h+='</div>';
    } else if(ST.sanSub==='weekly'){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px"><div style="font-size:13px;color:var(--tx2)">Weekly deep clean records follow the same pre-op form. Switch to Pre-Op Daily to log a deep clean entry and note "Weekly Deep Clean" in deficiencies.</div></div>';
    } else {
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px"><div style="font-size:13px;color:var(--tx2)">Monthly review summary is auto-generated from logged pre-op records. Total records this month: <strong>'+SAN.filter(function(r){return r.date&&r.date.slice(0,7)===today().slice(0,7);}).length+'</strong></div></div>';
    }

    // Records table
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-top:16px">';
    h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:8px">Sanitation Records</div>';
    h+=tblHead(['Date','Line','By','Equipment','Release','Notes']);
    SAN.slice().reverse().forEach(function(r,i){
      var eqSt=Object.keys(r.checks||{}).map(function(k){return r.checks[k]==='fail'?k:'';}).filter(Boolean).join(', ')||'All Pass';
      h+=tblRow([esc(r.date),esc(r.line),esc(r.completedBy),eqSt==='All Pass'?statusBadge('pass'):'<span style="color:#f44;font-size:11px">FAIL: '+esc(eqSt)+'</span>',statusBadge(r.release),esc(r.notes||'--').slice(0,40)],i);
    });
    if(!SAN.length) h+='<tr><td colspan="6" style="padding:12px;font-size:12px;color:var(--tx3);text-align:center">No records</td></tr>';
    h+='</tbody></table></div>';
    return h;
  }

  // --- QUALITY ---
  function renderQuality(){
    var h=pills([
      {id:'inprocess',label:'In-Process QC'},
      {id:'hold',label:'Hold Tags'},
      {id:'release',label:'Product Release'}
    ],ST.qualSub,'window.MFX.FSQMS.setQualSub');

    if(ST.qualSub==='inprocess'){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
      h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:12px">In-Process QC Check</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Date',fInput('qc-date','date'));
      h+=fRow('Time',fInput('qc-time','time'));
      h+=fRow('Shift',fSelect('qc-shift',SHIFTS));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Line',fSelect('qc-line',LINES));
      h+=fRow('Product Code',fInput('qc-prod','text','e.g. FLX-2024-001'));
      h+=fRow('Lot #',fInput('qc-lot','text','e.g. L240401A'));
      h+='</div>';
      h+='<div style="font-size:12px;font-weight:600;color:var(--tx);margin:12px 0 8px">Quality Checks</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      QC_CHECKS.forEach(function(c){
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px"><span style="font-size:11px;color:var(--tx)">'+c+'</span><div id="qc-chk-'+c.replace(/[^a-zA-Z]/g,'')+'" data-v="">'+pfBtns(c)+'</div></div>';
      });
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px">';
      h+=fRow('Defects',fSelect('qc-defects',DEFECT_TYPES));
      h+=fRow('Disposition',fSelect('qc-disp',['Released','Hold','Rework','Rejected']));
      h+=fRow('QC Tech',fSelect('qc-tech',USERS));
      h+='</div>';
      if(window.SQF_EV){h+=SQF_EV.renderAttachmentZone('fsqms-qc','qc');h+=SQF_EV.renderSignaturePad('fsqms-qc','QC Tech — E-Signature');}
      h+='<div class="compliance-boundary" style="margin-top:12px"></div>';
      h+='<button class="btn btn-signoff" onclick="window.MFX.FSQMS.saveQC()" style="margin-top:8px">Save QC Record</button>';
      h+='</div>';
    } else if(ST.qualSub==='hold'){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px;border-left:4px solid #f44">';
      h+='<div style="font-size:14px;font-weight:700;color:#f44;margin-bottom:12px">Issue Hold Tag</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Date',fInput('ht-date','date'));
      h+=fRow('Tag #',fInput('ht-tag','text','e.g. HT-0042'));
      h+=fRow('Issued By',fSelect('ht-by',USERS));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Product Code',fInput('ht-prod','text'));
      h+=fRow('Lot #',fInput('ht-lot','text'));
      h+=fRow('Qty on Hold',fInput('ht-qty','number'));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
      h+=fRow('Hold Type',fSelect('ht-type',HOLD_TYPES));
      h+=fRow('Risk Level',fSelect('ht-risk',['Low','Medium','High']));
      h+='</div>';
      h+=fRow('Reason',fTextarea('ht-reason','Describe reason for hold...'));
      if(window.SQF_EV){h+=SQF_EV.renderAttachmentZone('fsqms-hold','hold');h+=SQF_EV.renderSignaturePad('fsqms-hold','Issued By — E-Signature');}
      h+='<div class="compliance-boundary" style="margin-top:12px"></div>';
      h+='<button class="btn btn-hold" onclick="window.MFX.FSQMS.saveHold()" style="margin-top:8px">Issue Hold Tag</button>';
      h+='</div>';
    } else {
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
      h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:12px">Product Release</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
      h+=fRow('Date',fInput('rel-date','date'));
      h+=fRow('Product Code / Lot',fInput('rel-prodlot','text','e.g. FLX-2024-001 / L240401A'));
      h+='</div>';
      h+='<div style="font-size:12px;font-weight:600;color:var(--tx);margin:12px 0 8px">Release Checks</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      RELEASE_CHECKS.forEach(function(c){
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px"><span style="font-size:11px;color:var(--tx)">'+c+'</span><div id="rel-chk-'+c.replace(/[^a-zA-Z]/g,'')+'" data-v="">'+pfBtns(c)+'</div></div>';
      });
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">';
      h+=fRow('Final Disposition',fSelect('rel-disp',['Released','Hold','Rejected']));
      h+=fRow('Released By',fSelect('rel-by',USERS));
      h+='</div>';
      if(window.SQF_EV){h+=SQF_EV.renderAttachmentZone('fsqms-release','release');h+=SQF_EV.renderSignaturePad('fsqms-release','Released By — E-Signature');}
      h+='<div class="compliance-boundary" style="margin-top:12px"></div>';
      h+='<button class="btn btn-release" onclick="window.MFX.FSQMS.saveRelease()" style="margin-top:8px">Save Release</button>';
      h+='</div>';
    }

    // Quality records table
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-top:16px">';
    h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:8px">Quality Records</div>';
    h+=tblHead(['Date','Type','Product/Lot','Disposition','By']);
    QUAL.slice().reverse().forEach(function(r,i){
      var tp=r.type==='hold'?'<span style="color:#f44;font-weight:700">HOLD #'+esc(r.tagNum)+'</span>':r.type==='release'?'Release':'QC';
      var pl=esc(r.productCode||r.prodLot||'')+' / '+esc(r.lot||'');
      h+=tblRow([esc(r.date),tp,pl,statusBadge(r.disposition||r.finalDisp||''),esc(r.tech||r.issuedBy||r.releasedBy||'')],i);
    });
    if(!QUAL.length) h+='<tr><td colspan="5" style="padding:12px;font-size:12px;color:var(--tx3);text-align:center">No records</td></tr>';
    h+='</tbody></table></div>';
    return h;
  }

  // --- MATERIALS ---
  function renderMaterials(){
    var h=pills([
      {id:'receiving',label:'Receiving'},
      {id:'usage',label:'Usage'}
    ],ST.matSub,'window.MFX.FSQMS.setMatSub');

    if(ST.matSub==='receiving'){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
      h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:12px">Material Receiving Inspection</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Date',fInput('mat-date','date'));
      h+=fRow('Supplier',fSelect('mat-supplier',SUPPLIERS));
      h+=fRow('PO Number',fInput('mat-po','text','e.g. PO-20240401'));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Material',fSelect('mat-material',MATERIALS));
      h+=fRow('Lot #',fInput('mat-lot','text'));
      h+=fRow('Quantity',fInput('mat-qty','number'));
      h+='</div>';
      h+='<div style="font-size:12px;font-weight:600;color:var(--tx);margin:12px 0 8px">Receiving Checks</div>';
      var rchecks=['Vehicle Clean','Labels Match','Qty Matches','Condition OK','No Pest'];
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      rchecks.forEach(function(c){
        h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px"><span style="font-size:11px;color:var(--tx)">'+c+'</span><div id="mat-chk-'+c.replace(/[^a-zA-Z]/g,'')+'" data-v="">'+pfBtns(c)+'</div></div>';
      });
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px">';
      h+=fRow('CoA Received?',fSelect('mat-coa',['Yes','No']));
      h+=fRow('Disposition',fSelect('mat-disp',['Approved','Quarantine','Rejected']));
      h+=fRow('Storage Location',fInput('mat-loc','text','e.g. WH-A-03'));
      h+='</div>';
      if(window.SQF_EV){h+=SQF_EV.renderAttachmentZone('fsqms-mat','receiving');h+=SQF_EV.renderSignaturePad('fsqms-mat','Received By — E-Signature');}
      h+='<div class="compliance-boundary" style="margin-top:12px"></div>';
      h+='<button class="btn btn-signoff" onclick="window.MFX.FSQMS.saveMat()" style="margin-top:8px">Save Receiving</button>';
      h+='</div>';
    } else {
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-bottom:16px">';
      h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:12px">Material Usage Log</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h+=fRow('Date',fInput('mu-date','date'));
      h+=fRow('Shift',fSelect('mu-shift',SHIFTS));
      h+=fRow('Line',fSelect('mu-line',LINES));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
      h+=fRow('Job Order',fInput('mu-job','text','e.g. JO-20240401'));
      h+=fRow('Material',fSelect('mu-material',MATERIALS));
      h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">';
      h+=fRow('Material Lot #',fInput('mu-mlot','text'));
      h+=fRow('Qty Used',fInput('mu-qty','number'));
      h+=fRow('Waste',fInput('mu-waste','number','kg'));
      h+=fRow('Finished Lot #',fInput('mu-flot','text','Forward trace'));
      h+='</div>';
      h+='<button onclick="window.MFX.FSQMS.saveUsage()" style="margin-top:8px;padding:8px 24px;border-radius:8px;border:none;background:var(--ac);color:#000;font-weight:700;cursor:pointer">Save Usage</button>';
      h+='</div>';
    }

    // Materials records table
    h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;margin-top:16px">';
    h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:8px">Materials Records</div>';
    h+=tblHead(['Date','Type','Material','Lot','Supplier/Line','Disposition/Qty']);
    MAT.slice().reverse().forEach(function(r,i){
      if(r.type==='receiving'){
        h+=tblRow([esc(r.date),'Receiving',esc(r.material),esc(r.lot),esc(r.supplier),statusBadge(r.disposition)],i);
      } else {
        h+=tblRow([esc(r.date),'Usage',esc(r.material),esc(r.mlot),esc(r.line),'Used: '+esc(r.qty)+' | Waste: '+esc(r.waste)],i);
      }
    });
    if(!MAT.length) h+='<tr><td colspan="6" style="padding:12px;font-size:12px;color:var(--tx3);text-align:center">No records</td></tr>';
    h+='</tbody></table></div>';
    return h;
  }

  // --- MAIN RENDER ---
  function renderFSQMS(){
    var el=document.getElementById('v-fsqms');
    if(!el) return;
    var h='<div style="padding:20px;max-width:1200px;margin:0 auto;font-family:inherit">';
    h+='<div style="font-size:20px;font-weight:700;color:var(--tx);margin-bottom:4px">Food Safety & Quality Management</div>';
    h+='<div style="font-size:12px;color:var(--tx3);margin-bottom:16px">SQF Edition 10 -- Flexo Packaging FSQMS</div>';

    // Main tabs
    var tabs=[
      {id:'dashboard',label:'Dashboard'},
      {id:'sanitation',label:'Sanitation'},
      {id:'quality',label:'Quality'},
      {id:'materials',label:'Materials'}
    ];
    h+=pills(tabs,ST.tab,'window.MFX.FSQMS.setTab');

    if(ST.tab==='dashboard') h+=renderDashboard();
    else if(ST.tab==='sanitation') h+=renderSanitation();
    else if(ST.tab==='quality') h+=renderQuality();
    else if(ST.tab==='materials') h+=renderMaterials();

    h+='</div>';
    el.innerHTML=h;

    // Set default dates and init evidence pads
    setTimeout(function(){
      var ds=['san-date','qc-date','ht-date','rel-date','mat-date','mu-date'];
      ds.forEach(function(id){var e=document.getElementById(id);if(e&&!e.value)e.value=today();});
      var te=document.getElementById('qc-time');if(te&&!te.value)te.value=nowTime();
      if(window.SQF_EV) SQF_EV.initAllPads();
    },0);
  }

  // --- COLLECT PASS/FAIL ---
  function collectChecks(prefix,items){
    var out={};
    items.forEach(function(c){
      var id=prefix+c.replace(/[^a-zA-Z]/g,'');
      var el=document.getElementById(id);
      if(el){
        var btns=el.querySelectorAll('div[data-v]');
        if(btns.length) out[c]=btns[0].dataset.v||'';
        var parent=el.closest?el.closest('[data-v]'):el;
        if(parent&&parent.dataset&&parent.dataset.v) out[c]=parent.dataset.v;
        // fallback: check child div
        var d=el.querySelector('div');
        if(d&&d.dataset&&d.dataset.v) out[c]=d.dataset.v;
        if(!out[c]){
          // check the div itself
          var wrap=el.querySelector('div[style]');
          if(wrap&&wrap.dataset.v) out[c]=wrap.dataset.v;
        }
      }
    });
    return out;
  }

  function gv(id){var e=document.getElementById(id);return e?e.value:'';}

  // --- SAVE FUNCTIONS ---
  function saveSan(){
    var rec={
      id:uid(),type:'preop',date:gv('san-date'),shift:gv('san-shift'),line:gv('san-line'),
      completedBy:gv('san-by'),verifiedBy:gv('san-vby'),
      checks:collectChecks('san-chk-',SAN_CHECKS),
      atp:gv('san-atp'),pest:gv('san-pest'),release:gv('san-release'),notes:gv('san-notes')
    };
    if(!rec.date||!rec.line){if(typeof toast==='function')toast('Date and Line are required','err');return;}
    if(window.SQF_EV){rec.evidence=SQF_EV.collectEvidence('fsqms-san');SQF_EV.uploadEvidence('fsqms-san','sanitation',{recordNum:'SAN_'+rec.date+'_'+rec.line.replace(/\s/g,'')}).catch(function(){});SQF_EV.clearStash('fsqms-san');}
    SAN.push(rec);persistSan();renderFSQMS();
  }
  function saveQC(){
    var rec={
      id:uid(),type:'qc',date:gv('qc-date'),time:gv('qc-time'),shift:gv('qc-shift'),
      line:gv('qc-line'),productCode:gv('qc-prod'),lot:gv('qc-lot'),
      checks:collectChecks('qc-chk-',QC_CHECKS),
      defects:gv('qc-defects'),disposition:gv('qc-disp'),tech:gv('qc-tech')
    };
    if(!rec.date||!rec.line){if(typeof toast==='function')toast('Date and Line are required','err');return;}
    if(window.SQF_EV){rec.evidence=SQF_EV.collectEvidence('fsqms-qc');SQF_EV.uploadEvidence('fsqms-qc','qc',{recordNum:'QC_'+rec.date+'_'+rec.lot}).catch(function(){});SQF_EV.clearStash('fsqms-qc');}
    QUAL.push(rec);persistQual();renderFSQMS();
  }
  function saveHold(){
    var rec={
      id:uid(),type:'hold',date:gv('ht-date'),tagNum:gv('ht-tag'),issuedBy:gv('ht-by'),
      productCode:gv('ht-prod'),lot:gv('ht-lot'),qty:gv('ht-qty'),
      holdType:gv('ht-type'),riskLevel:gv('ht-risk'),reason:gv('ht-reason'),
      disposition:'Hold',resolved:false
    };
    if(!rec.date||!rec.tagNum){if(typeof toast==='function')toast('Date and Tag # are required','err');return;}
    if(window.SQF_EV){rec.evidence=SQF_EV.collectEvidence('fsqms-hold');SQF_EV.uploadEvidence('fsqms-hold','hold',{recordNum:'HOLD_'+rec.tagNum}).catch(function(){});SQF_EV.clearStash('fsqms-hold');}
    QUAL.push(rec);persistQual();renderFSQMS();
  }
  function saveRelease(){
    var rec={
      id:uid(),type:'release',date:gv('rel-date'),prodLot:gv('rel-prodlot'),
      checks:collectChecks('rel-chk-',RELEASE_CHECKS),
      finalDisp:gv('rel-disp'),releasedBy:gv('rel-by')
    };
    if(!rec.date){if(typeof toast==='function')toast('Date is required','err');return;}
    if(window.SQF_EV){rec.evidence=SQF_EV.collectEvidence('fsqms-release');SQF_EV.uploadEvidence('fsqms-release','release',{recordNum:'REL_'+rec.date+'_'+rec.prodLot}).catch(function(){});SQF_EV.clearStash('fsqms-release');}
    QUAL.push(rec);persistQual();renderFSQMS();
  }
  function saveMatRec(){
    var rchecks=['Vehicle Clean','Labels Match','Qty Matches','Condition OK','No Pest'];
    var rec={
      id:uid(),type:'receiving',date:gv('mat-date'),supplier:gv('mat-supplier'),po:gv('mat-po'),
      material:gv('mat-material'),lot:gv('mat-lot'),qty:gv('mat-qty'),
      checks:collectChecks('mat-chk-',rchecks),
      coa:gv('mat-coa'),disposition:gv('mat-disp'),location:gv('mat-loc')
    };
    if(!rec.date||!rec.material){if(typeof toast==='function')toast('Date and Material are required','err');return;}
    if(window.SQF_EV){rec.evidence=SQF_EV.collectEvidence('fsqms-mat');SQF_EV.uploadEvidence('fsqms-mat','receiving',{recordNum:'REC_'+rec.date+'_'+rec.lot}).catch(function(){});SQF_EV.clearStash('fsqms-mat');}
    MAT.push(rec);persistMat();renderFSQMS();
  }
  function saveUsage(){
    var rec={
      id:uid(),type:'usage',date:gv('mu-date'),shift:gv('mu-shift'),line:gv('mu-line'),
      job:gv('mu-job'),material:gv('mu-material'),mlot:gv('mu-mlot'),
      qty:gv('mu-qty'),waste:gv('mu-waste'),finishedLot:gv('mu-flot')
    };
    if(!rec.date||!rec.material){if(typeof toast==='function')toast('Date and Material are required','err');return;}
    MAT.push(rec);persistMat();renderFSQMS();
  }

  // --- TAB SETTERS ---
  function setTab(t){ST.tab=t;renderFSQMS();}
  function setSanSub(t){ST.sanSub=t;renderFSQMS();}
  function setQualSub(t){ST.qualSub=t;renderFSQMS();}
  function setMatSub(t){ST.matSub=t;renderFSQMS();}

  // --- REGISTER ---
  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_RENDERERS.fsqms=renderFSQMS;

  window.MFX=window.MFX||{};
  window.MFX.FSQMS={
    render:renderFSQMS,
    setTab:setTab,
    setSanSub:setSanSub,
    setQualSub:setQualSub,
    setMatSub:setMatSub,
    saveSan:saveSan,
    saveQC:saveQC,
    saveHold:saveHold,
    saveRelease:saveRelease,
    saveMat:saveMatRec,
    saveUsage:saveUsage
  };

})();
