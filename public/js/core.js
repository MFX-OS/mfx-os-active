'use strict';
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                        MFX CORE.JS — MODULE MAP                           ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║                                                                            ║
// ║  1. CONFIG & INITIALIZATION .......................... ~line 69             ║
// ║     firestoreRetry, runLoginSequence, animateLogoToTopbar,                 ║
// ║     Firebase config, MFX event bus, $, f$, CURRENT_USER,                  ║
// ║     getUserEmail, getUserName, getUserId,                                  ║
// ║     getStoredProfileSeed, buildUserAccessPayload                          ║
// ║                                                                            ║
// ║  2. AUTH & SESSION ................................... ~line 289            ║
// ║     syncUserAccessProfile, getMFXAuthHeaders,                             ║
// ║     _makeGoogleProvider, _captureGoogleCred, signInWithGoogle,            ║
// ║     signOut, showUserMenu, onAuthStateChanged handler                     ║
// ║                                                                            ║
// ║  3. API SERVICES ..................................... ~line 319            ║
// ║     MFX_API, requestServerNumber, provisionPPDWorkspace, syncPPDInbox     ║
// ║                                                                            ║
// ║  4. DATABASE LAYER ................................... ~line 365            ║
// ║     _cache, DB (quotes/customers/templates), saveQ/saveC/saveT,           ║
// ║     delDoc, logActivity, startListeners, Firestore onSnapshot             ║
// ║                                                                            ║
// ║  5. SEED DATA & SPEC CONSTANTS ....................... ~line 418            ║
// ║     checkAndSeedData, MATS, MFX_TERMS, SQF_BADGE, QUOTE_LOGO,            ║
// ║     SPEC_DIES, SPEC_FILMS, SPEC_LABELS, SPEC_VARNISHES                    ║
// ║                                                                            ║
// ║  6. SPEC LIST MANAGEMENT ............................. ~line 471            ║
// ║     getSpecList, addSpecItem, removeUserSpecItem, deleteSpec,              ║
// ║     editSpec, showSpecManager, addNewDie, addNewSpec, addNewVarnish,       ║
// ║     filterSpecList, pickDieFromModal                                       ║
// ║                                                                            ║
// ║  7. APP STATE & UTILITY .............................. ~line 525            ║
// ║     S (view state), FDEF, DEFAULT_TERMS, QDEF,                            ║
// ║     f5$, fN, fD, uid, toast, genQN, genQNServer,                          ║
// ║     nextRev, togCard, openModal, closeModal                               ║
// ║                                                                            ║
// ║  8. NAVIGATION ....................................... ~line 562            ║
// ║     goView, openEditor, exitEditor, renderers map, titles map             ║
// ║                                                                            ║
// ║  9. QUOTE ENGINE ..................................... ~line 606            ║
// ║     newQuote, dupQuote, setQStatus, VALID_TRANSITIONS,                    ║
// ║     bakePricing, delQuote, getQ, saveQ (editor)                           ║
// ║                                                                            ║
// ║ 10. CUSTOMER MANAGEMENT .............................. ~line 681            ║
// ║     saveCust, delCust, showCustForm                                        ║
// ║                                                                            ║
// ║ 11. TEMPLATES ........................................ ~line 707            ║
// ║     saveTpl, delTpl                                                        ║
// ║                                                                            ║
// ║ 12. DASHBOARD & STAFF HUB ............................ ~line 717            ║
// ║     renderStaffHub, control panel, alerts, tasks,                          ║
// ║     live feed, discussions listener                                        ║
// ║                                                                            ║
// ║ 13. FLEX ZONE ........................................ ~line 845            ║
// ║     openFlexZone, renderFlexZone, switchFlexTab                            ║
// ║     (feed, leaderboard, badges, activity, scratch pad)                     ║
// ║                                                                            ║
// ║ 14. HUB HELPERS ...................................... ~line 927            ║
// ║     saveScratchPad, clearScratchPad, hubChangeMood,                       ║
// ║     hubPostStatus, hubAddTask, hubToggleTask, hubDeleteTask               ║
// ║                                                                            ║
// ║  NOTE: All functions are globally scoped and cross-reference each other.   ║
// ║  A module bundler would be required to split into separate files.          ║
// ║  This map documents logical groupings for maintainability.                 ║
// ║                                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ═══════════════════════════════════════════════════════════════
// MENU UNLOCK — retained as no-ops (referenced by index.html footer tap)
// Full menu is always visible via role-based auth — no lock needed
// ═══════════════════════════════════════════════════════════════
function mfxUnlockPrompt(){}
function mfxLockMenu(){}
function _mfxApplyUnlock(){
  // Gate behind authenticated user — require CURRENT_USER from Firebase auth
  if(!window.CURRENT_USER){return;}
  // Show advanced tabs
  document.querySelectorAll('.tab.adv').forEach(function(t){t.style.display='';});
  // Inject full colored department menu into hamburger (always re-inject if empty)
  var adv=document.getElementById('hamAdvanced');
  if(adv){
    if(typeof _buildFullHamMenu==='function' && (!adv.innerHTML || adv.innerHTML.length<100)){
      adv.innerHTML=_buildFullHamMenu();
    }
    adv.style.display='block';
    // Apply department visibility filter to hamburger menu sections
    _applyHamDeptFilter();
  }
}
// Hide ham menu departments the user doesn't belong to (unless admin)
function _applyHamDeptFilter(){
  if(!CURRENT_USER||!CURRENT_USER.dept)return; // no dept = admin, show all
  var dept=CURRENT_USER.dept.toLowerCase().trim();
  var role=(CURRENT_USER.role||'').toLowerCase();
  // Admin/exec/operations/CEO see everything
  if(/ceo|admin|owner|director|vp|operations|administration|executive|management/.test(role))return;
  if(/operations|administration|ceo|executive|management/.test(dept))return;
  // Map dept to which ham sections to show (hamSub-XX IDs)
  var DEPT_HAM_SECTIONS={
    'client services':['cs','jt'],'sales':['cs'],'estimation':['cs','jt'],
    'pre-press':['pp','jt'],'prepress':['pp','jt'],
    'production':['prod','jt','pp'],'manufacturing':['prod','jt','pp'],
    'logistics':['log','jt'],'shipping':['log','jt'],
    'quality':['qa','fsqms'],'qa':['qa','fsqms'],
    'finance':['fin'],'accounting':['fin'],
    'fsqms':['fsqms','qa'],'sqf':['fsqms','qa'],
    'hr':['ops']
  };
  var allowed=DEPT_HAM_SECTIONS[dept];
  if(!allowed)return; // unknown dept = show all
  // Each top-level dept button is wrapped in a div with padding:2px 12px
  var adv=document.getElementById('hamAdvanced');
  if(!adv)return;
  var topSections=adv.children;
  for(var i=0;i<topSections.length;i++){
    var sec=topSections[i];
    // Find the hamSub-XX inside this section
    var sub=sec.querySelector('[id^="hamSub-"]');
    if(!sub)continue;
    var secId=sub.id.replace('hamSub-','');
    // Always show FlexAi/dashboard items
    if(secId==='ai'||secId==='flex')continue;
    sec.style.display=allowed.indexOf(secId)>=0?'':'none';
  }
}
window._applyHamDeptFilter=_applyHamDeptFilter;
window.mfxUnlockPrompt=mfxUnlockPrompt;
window.mfxLockMenu=mfxLockMenu;

// ═══════════════════════════════════════════════════════════════
// SECTION 1: CONFIG & INITIALIZATION
// Functions: firestoreRetry, runLoginSequence, animateLogoToTopbar,
//            Firebase init, MFX event bus, $, f$, CURRENT_USER,
//            getUserEmail, getUserName, getUserId,
//            getStoredProfileSeed, buildUserAccessPayload
// Dependencies: firebase SDK (loaded via <script>), localStorage
// ═══════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════
// FIRESTORE RETRY UTILITY
// ════════════════════════════════════════════════
function firestoreRetry(fn, maxRetries) {
  maxRetries = maxRetries || 2;
  var attempt = 0;
  function tryOnce() {
    return fn().catch(function(e) {
      attempt++;
      if (attempt < maxRetries && (e.code === 'unavailable' || e.code === 'deadline-exceeded' || e.message && e.message.indexOf('network') >= 0)) {
        var delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        return new Promise(function(resolve) { setTimeout(resolve, delay); }).then(tryOnce);
      }
      throw e;
    });
  }
  return tryOnce();
}

// ════════════════════════════════════════════════
// LOGIN SCREEN ANIMATION SEQUENCE
// ════════════════════════════════════════════════

window.runLoginSequence = function(){
  // Guard — only run once
  if(window._loginSeqRan) return;
  window._loginSeqRan = true;

  // Force reflow so CSS transitions actually fire after display:none→block
  requestAnimationFrame(function(){ requestAnimationFrame(function(){

    var wm   = document.getElementById('loginWordmark');
    var copy = document.getElementById('loginCopy');
    var bar  = document.getElementById('loginDivBar');
    var div  = document.getElementById('loginDivider');
    var form = document.getElementById('loginFormBlock');
    var logo = document.getElementById('loginLogoBlock');

    if(!wm) return;

    // Step 1 — wordmark rises (immediate)
    wm.style.opacity = '1';
    wm.style.transform = 'translateY(0)';

    // Step 2 — cyan bar sweeps (450ms)
    setTimeout(function(){
      if(bar) bar.style.width = '240px';
    }, 450);

    // Step 3 — copy fades (700ms)
    setTimeout(function(){
      if(copy) copy.style.opacity = '1';
    }, 700);

    // Step 4 — neon divider grows (1100ms)
    setTimeout(function(){
      if(div){
        div.style.height = '240px';
        div.style.margin = '0 52px';
      }
    }, 1100);

    // Step 5 — form slides in (1600ms)
    setTimeout(function(){
      if(form){
        form.style.width = '320px';
        form.style.opacity = '1';
        form.style.padding = '0 24px';
      }
      if(logo) logo.style.transform = 'translateX(-24px)';
    }, 1600);

  })});
};

// ════════════════════════════════════════════════
// APP ENTRY ANIMATION — logo flies to topbar
// ════════════════════════════════════════════════

window.animateLogoToTopbar = function(){
  var loginScreen = document.getElementById('loginScreen');
  var logoBlock   = document.getElementById('loginLogoBlock');
  var topbar      = document.querySelector('.topbar');

  if(!loginScreen || !logoBlock || !topbar) {
    if(typeof window.dismissIntroAfterLogin==='function')window.dismissIntroAfterLogin();else if(loginScreen)loginScreen.style.display='none';
    return;
  }

  // Get position of logo block and topbar MFX text
  var lRect = logoBlock.getBoundingClientRect();
  var tRect = topbar.getBoundingClientRect();

  // Clone the wordmark for the fly animation
  var clone = document.createElement('div');
  clone.style.cssText = [
    'position:fixed',
    'left:' + (lRect.left + lRect.width/2 - 60) + 'px',
    'top:' + (lRect.top + lRect.height/2 - 30) + 'px',
    'z-index:9500',
    'pointer-events:none',
    'transition:all 0.55s cubic-bezier(.4,0,.2,1)',
    'transform-origin:left center'
  ].join(';');
  clone.innerHTML =
    '<div style="font-family:Outfit,Inter,sans-serif;font-size:48px;font-weight:900;color:#00e5ff;letter-spacing:-1px;text-shadow:0 0 20px rgba(0,229,255,.5);white-space:nowrap">Microflex</div>';
  document.body.appendChild(clone);

  // Fade out login
  loginScreen.style.transition = 'opacity 0.4s ease';
  loginScreen.style.opacity = '0';

  // Fly clone to topbar position after brief pause
  setTimeout(function(){
    if(typeof window.dismissIntroAfterLogin==='function')window.dismissIntroAfterLogin();else loginScreen.style.display='none';
    var tx = tRect.left + 40;
    var ty = tRect.top + tRect.height/2 - 10;
    clone.style.left = tx + 'px';
    clone.style.top  = ty + 'px';
    clone.style.transform = 'scale(0.22)';
    clone.style.opacity = '0';
  }, 80);

  // Remove clone after animation
  setTimeout(function(){
    if(clone.parentNode) clone.parentNode.removeChild(clone);
  }, 700);
};




// ═══ FIREBASE CONFIG — REPLACE WITH YOUR PROJECT ═══
const firebaseConfig={apiKey:"AIzaSyA5N8V4jVNe4pVt3jmjEdbQEfv1lnKj7PM",authDomain:"os.microflexfilm.com",projectId:"mfx-2026",storageBucket:"mfx-2026.firebasestorage.app",messagingSenderId:"21746521413",appId:"1:21746521413:web:7229f14cabaebb1e0a1a2c",measurementId:"G-DLLD80B7YS"};
firebase.initializeApp(firebaseConfig);
const fbAuth=firebase.auth();
const fbDb=firebase.firestore();
// Use modern cache settings instead of deprecated enablePersistence
fbDb.settings({cacheSizeBytes:firebase.firestore.CACHE_SIZE_UNLIMITED,merge:true});
try{fbDb.enablePersistence({synchronizeTabs:true}).catch(function(e){if(e.code!=='unimplemented'&&e.code!=='failed-precondition')console.warn('persistence:',e.code)});}catch(e){}
window.fbDb=fbDb;window.fbAuth=fbAuth;

// ══════════════════════════════════════════════════════════════
// MFX EVENT BUS — Central nervous system
// Modules emit events, other modules listen and react.
// No module calls another module directly.
// ══════════════════════════════════════════════════════════════
window.MFX={
  _listeners:{},
  on:function(event,fn){if(!this._listeners[event])this._listeners[event]=[];this._listeners[event].push(fn);return this},
  off:function(event,fn){if(!this._listeners[event])return;this._listeners[event]=this._listeners[event].filter(function(f){return f!==fn});return this},
  emit:function(event,data){
    // console.log('🔵 MFX.emit:',event,data?Object.keys(data):'');
    var fns=this._listeners[event]||[];
    fns.forEach(function(fn){try{fn(data)}catch(e){console.error('MFX listener error ['+event+']:',e)}});
    // Also emit wildcard for global logging
    var wild=this._listeners['*']||[];
    wild.forEach(function(fn){try{fn({event:event,data:data})}catch(e){}});
    return this
  },
  // Environment config
  env:window.location.hostname.indexOf('mfx-2026')>=0?'production':'development',
  version:'2.2.0',
  // Convenience: emit + log to Firestore activity
  track:function(event,detail){
    this.emit(event,detail);
    if(typeof fbDb!=='undefined'&&typeof getUserName==='function'){
      fbDb.collection('activity').add({
        action:event,
        detail:typeof detail==='string'?detail:JSON.stringify(detail||{}).substring(0,500),
        user:getUserName(),userId:getUserId(),
        timestamp:new Date().toISOString(),source:'client'
      }).catch(function(e){console.warn('MFX.track:',e)});
    }
  }
};

// Global debug listener — turn on with: localStorage.setItem('mfx_debug','1')
if(localStorage.getItem('mfx_debug')==='1'){
  MFX.on('*',function(d){console.log('%c[MFX]','color:#00e5ff;font-weight:bold',d.event,d.data)});
}

// ══════════════════════════════════════════════════════════════
// DEPARTMENT NAVIGATION CONFIG — single source of truth
// Dashboard launcher and hamburger menu should reference this
// instead of maintaining their own copies.
// ══════════════════════════════════════════════════════════════
window.MFX_DEPARTMENTS = [
  {key:'ceo', name:'FlexAi', color:'#00e5ff', items:[
    {name:'Daily Dash', view:'ceodash'},
    {name:'Approvals', fn:'openCEOPortal()'},
    {name:'On Production', view:'production'},
    {name:'Employee Snapshot', view:'hr'}
  ]},
  {key:'cs', name:'Client Services', color:'#a855f7', items:[
    {name:'Clients / CRM', view:'customers'},
    {name:'Quotes & Estimating', view:'quotes'},
    {name:'POs / Sales Orders', view:'orders'},
    {name:'Requests', fn:'openRFQInbox()'},
    {name:'Specs & Materials', view:'templates'},
    {name:'CAPA / NCR', view:'capa'}
  ]},
  {key:'pp', name:'Pre-Press', color:'#c4ff2a', items:[
    {name:'PPD Workspace', view:'ppd'},
    {name:'Document Control', view:'doccontrol'}
  ]},
  {key:'lg', name:'Logistics', color:'#f97316', items:[
    {name:'Inventory', view:'logistics'},
    {name:'Purchasing', view:'vendorpos'},
    {name:'Receiving', view:'logistics'},
    {name:'Vendor POs', view:'vendorpos'},
    {name:'Vendor Hub', view:'vendors'},
    {name:'Shipping', view:'logistics'}
  ]},
  {key:'pr', name:'Production', color:'#4169e1', items:[
    {name:'Production Floor', view:'production'},
    {name:'Job Tracker', view:'jobtracker'},
    {name:'Operator Station', view:'operator'}
  ]},
  {key:'fn', name:'Finance', color:'#daa520', items:[
    {name:'Finance Portal', fn:"window.open('https://mfx-2026-finance.web.app','_blank')"},
    {name:'Analytics', fn:'openAnalytics()'}
  ]},
  {key:'oq', name:'Operations / Quality', color:'#ef4444', items:[
    {name:'Controlled Records', view:'records'},
    {name:'SQF Data Logs', view:'sqfdatalogs'},
    {name:'GMP & Environmental', view:'gmp'},
    {name:'SQF Audits', view:'audit'},
    {name:'Training', view:'training'},
    {name:'HR / People', view:'hr'},
    {name:'HACCP Plan', fn:"window.open('/haccp.html','_blank')"},
    {name:'Mock Recall', fn:"window.open('/mockrecall.html','_blank')"},
    {name:'Data Sync', view:'datasync'}
  ]}
];

// ══════════════════════════════════════════════════════════════
// UNIFIED STATE — single source of truth for app state
// Modules can use MFX.state.quotes instead of DB.quotes(), etc.
// ══════════════════════════════════════════════════════════════
MFX.state = {
  get view() { return S.view; },
  get editId() { return S.editId; },
  get isOnline() { return navigator.onLine !== false; },
  get currentUser() { return CURRENT_USER; },
  get quotes() { return DB.quotes(); },
  get customers() { return DB.customers(); },
  get templates() { return DB.templates(); },
  get alerts() { return window._currentAlerts || []; },
  get notifications() { return window.NOTIF_STATE ? window.NOTIF_STATE.notifications || [] : []; },
  get unreadCount() { return window.NOTIF_STATE ? window.NOTIF_STATE.unreadCount || 0 : 0; }
};

const $=id=>document.getElementById(id);
const f$=n=>{n=parseFloat(n)||0;return '$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');};
var CURRENT_USER=null;
window.CURRENT_USER=null;
var _coreListeners=[];
window._rfqPending=0;window._rfqData={pending:0,overdue:[]};if(fbDb){_coreListeners.push(fbDb.collection('requests').where('status','==','pending').onSnapshot(function(s){window._rfqPending=s.size;window._rfqData.pending=s.size;window._rfqData.overdue=s.docs.filter(function(d){var r=d.data();return r.submittedAt&&(Date.now()-new Date(r.submittedAt).getTime()>48*3600000);}).map(function(d){return Object.assign({id:d.id},d.data());});if(S.view==='dashboard')renderDash()}, function(err){ console.warn('core requests listener:', err.message); }))}
function getUserEmail(){return CURRENT_USER?CURRENT_USER.email:''}
function getUserName(){return CURRENT_USER?(CURRENT_USER.displayName||CURRENT_USER.email.split('@')[0]):'Unknown'}
function getUserId(){return CURRENT_USER?CURRENT_USER.uid:'anon'}

function getStoredProfileSeed(uid){
  try{
    var key='mfx_profile_'+(uid||'default');
    return JSON.parse(localStorage.getItem(key)||'{}')||{};
  }catch(e){ return {}; }
}
function buildUserAccessPayload(user){
  var seed=getStoredProfileSeed(user&&user.uid);
  // NOTE: role and dept are NOT included here — they are set by management only
  // and including them with stale/empty values triggers Firestore security rule denials
  var payload={
    email:(user&&user.email)||'',
    displayName:(user&&((user.displayName)||((user.email||'').split('@')[0])))||'',
    flexId:seed.flexId||'',
    pods:seed.pods||'',
    yearJoined:seed.yearJoined||'',
    lastUpdated:seed.lastUpdated||new Date().toISOString()
  };
  // Only set role/dept on first-time creation (when seed has values and doc doesn't exist yet)
  if(seed.role) payload.role=seed.role;
  if(seed.dept) payload.dept=seed.dept;
  // Derived permissions based on seed dept
  if(seed.dept){
    payload.permissions={
      ppd:Boolean(/pre-?press|production|quality|operations|administration/i.test(seed.dept||'')),
      commercial:Boolean(/sales|estimation|operations|administration/i.test(seed.dept||''))
    };
  }
  return payload;
}
window.buildUserAccessPayload=buildUserAccessPayload;

// ═══════════════════════════════════════════════════════════════
// SECTION 2: AUTH & SESSION MANAGEMENT
// Functions: syncUserAccessProfile, getMFXAuthHeaders,
//            _makeGoogleProvider, _captureGoogleCred, signInWithGoogle,
//            signOut, showUserMenu, onAuthStateChanged handler
// Dependencies: fbAuth, fbDb, CURRENT_USER, window.GTOKEN,
//              firebase.auth.GoogleAuthProvider
// ═══════════════════════════════════════════════════════════════

window.syncUserAccessProfile=function(){
  try{
    if(!CURRENT_USER||!fbDb) return Promise.resolve(false);
    var payload=buildUserAccessPayload(CURRENT_USER);
    payload.lastSeen=firebase.firestore.FieldValue.serverTimestamp();
    payload.lastLogin=firebase.firestore.FieldValue.serverTimestamp();
    return fbDb.collection('users').doc(CURRENT_USER.uid).set(payload,{merge:true});
  }catch(e){ console.warn('syncUserAccessProfile:',e); return Promise.resolve(false); }
};
window.getMFXAuthHeaders=function(){
  return Promise.resolve().then(function(){
    if(typeof fbAuth!=='undefined' && fbAuth.currentUser && typeof fbAuth.currentUser.getIdToken==='function'){
      return fbAuth.currentUser.getIdToken().catch(function(e){ console.warn('getIdToken:',e); return ''; });
    }
    return '';
  }).then(function(token){
    var headers={'Content-Type':'application/json'};
    if(token) headers.Authorization='Bearer '+token;
    return headers;
  });
};
// ═══════════════════════════════════════════════════════════════
// SECTION 3: API SERVICES
// Functions: MFX_API.postJSON, requestServerNumber,
//            provisionPPDWorkspace, syncPPDInbox
// Dependencies: getMFXAuthHeaders, window.GTOKEN, fetch API
// ═══════════════════════════════════════════════════════════════

// ─── Network button loading state helper ────────────────────────────────
// Disables a button + adds spinner class for the duration of an async op.
// Safe to call without a button (no-op); button may be a DOM element or id.
window.withButtonLoading = function(btn, promiseFactory){
  var el = (typeof btn === 'string') ? document.getElementById(btn) : btn;
  if(el && el.tagName){
    el.disabled = true;
    el.classList.add('mfx-btn-loading');
    el.setAttribute('aria-busy','true');
  }
  var clear = function(){
    if(el && el.tagName){
      el.disabled = false;
      el.classList.remove('mfx-btn-loading');
      el.removeAttribute('aria-busy');
    }
  };
  var p;
  try { p = promiseFactory(); } catch(e){ clear(); return Promise.reject(e); }
  if(!p || typeof p.then !== 'function'){ clear(); return Promise.resolve(p); }
  return p.then(function(v){ clear(); return v; }, function(e){ clear(); throw e; });
};

window.MFX_API={
  // postJSON(url, body, btnEl?) — if btnEl is passed, button is disabled with
  // spinner during the request (cleared on settle).
  postJSON:function(url,body,btnEl){
    var doFetch = function(){
      return window.getMFXAuthHeaders().then(function(headers){
        return fetch(url,{method:'POST',headers:headers,body:JSON.stringify(body||{})});
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(data){
          if(!r.ok) throw new Error(data.error||('Request failed: '+r.status));
          return data;
        });
      });
    };
    return btnEl ? window.withButtonLoading(btnEl, doFetch) : doFetch();
  }
};
window.requestServerNumber=function(kind,fallbackFactory){
  if(window.MFX_API&&navigator.onLine!==false){
    return window.MFX_API.postJSON('/api/nextSequence',{kind:kind}).then(function(data){ return data.formatted; }).catch(function(err){
      console.warn('requestServerNumber fallback:',err.message);
      return typeof fallbackFactory==='function'?fallbackFactory():String(Date.now());
    });
  }
  return Promise.resolve(typeof fallbackFactory==='function'?fallbackFactory():String(Date.now()));
};
// Server-side state machine transition for any collection
window.serverTransition=function(collection, docId, newStatus, machine) {
  if(!window.MFX_API) return Promise.reject(new Error('API not available'));
  return window.MFX_API.postJSON('/api/transitionStatus', {
    collection: collection, docId: docId, newStatus: newStatus, machine: machine || collection
  });
};
window.provisionPPDWorkspace=function(opts){
  return window.MFX_API.postJSON('/api/provisionPPDWorkspace',opts||{});
};
window.syncPPDInbox=function(opts){
  if(!window.GTOKEN) return Promise.reject(new Error('Google token unavailable'));
  var payload=Object.assign({accessToken:window.GTOKEN},opts||{});
  return window.MFX_API.postJSON('/api/ingestSharedInbox',payload);
};

function _makeGoogleProvider(){var gp=new firebase.auth.GoogleAuthProvider();gp.addScope('https://www.googleapis.com/auth/calendar.events');gp.addScope('https://www.googleapis.com/auth/gmail.send');gp.addScope('https://www.googleapis.com/auth/gmail.readonly');gp.addScope('https://www.googleapis.com/auth/drive');gp.addScope('https://www.googleapis.com/auth/tasks');gp.addScope('https://www.googleapis.com/auth/spreadsheets');return gp}
function _captureGoogleCred(result){var cred=result.credential||firebase.auth.GoogleAuthProvider.credentialFromResult(result);if(cred&&cred.accessToken){window.GTOKEN=cred.accessToken;sessionStorage.setItem('mfx_gtoken',cred.accessToken);sessionStorage.setItem('mfx_gtoken_exp',String(Date.now()+3500000));/* token captured */}else{ /* no credential */ }}
// Popup-first sign-in with redirect fallback
function signInWithGoogle(){var gp=_makeGoogleProvider();gp.setCustomParameters({hd:'microflexfilm.com'});fbAuth.signInWithRedirect(gp)}
// Handle redirect result on page load
fbAuth.getRedirectResult().then(function(result){if(result&&result.user){if(!result.user.email.endsWith('@microflexfilm.com')){if(typeof toast==='function')toast('Access restricted to @microflexfilm.com accounts — please switch accounts and retry','err');setTimeout(function(){result.user.delete().catch(function(){})},50);return}_captureGoogleCred(result)}}).catch(function(e){console.warn('Redirect result:',e.code)})
// Email/password sign-in
function signInWithEmail(){var email=document.getElementById('loginEmail');var pass=document.getElementById('loginPass');if(!email||!pass||!email.value||!pass.value){if(typeof toast==='function')toast('Enter email and password','err');return}if(!email.value.endsWith('@microflexfilm.com')){if(typeof toast==='function')toast('Access restricted to @microflexfilm.com accounts','err');return}var btn=document.getElementById('iEmailBtn');if(btn){btn.disabled=true;btn.textContent='Signing in...'}fbAuth.signInWithEmailAndPassword(email.value,pass.value).then(function(result){if(result.user&&!result.user.email.endsWith('@microflexfilm.com')){result.user.delete();alert('Access restricted to @microflexfilm.com accounts only.')}}).catch(function(e){if(btn){btn.disabled=false;btn.textContent='Sign In'}if(e.code==='auth/user-not-found'||e.code==='auth/wrong-password'||e.code==='auth/invalid-credential'){if(typeof toast==='function')toast('Invalid email or password','err')}else if(e.code==='auth/too-many-requests'){if(typeof toast==='function')toast('Too many attempts — try again later','err')}else{if(typeof toast==='function')toast(e.message,'err')}})}
function signOut(){if(typeof DB!=='undefined'&&DB.logActivity) DB.logActivity('user.logout', (typeof getUserName==='function'?getUserName():'User')+' logged out');fbAuth.signOut()}
function showUserMenu(){openModal('<div class="modal-title">'+getUserName()+'</div><div style="font-size:12px;color:var(--tx2);margin-bottom:12px">'+(CURRENT_USER?.email||'')+'</div><button class="btn btn-ghost" onclick="closeModal();signOut()">Sign Out</button><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>')}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: DATABASE LAYER
// Functions: DB.quotes, DB.customers, DB.templates, DB.saveQ,
//            DB.saveC, DB.saveT, DB.logActivity, DB.delDoc,
//            startListeners (Firestore onSnapshot bindings)
// Dependencies: fbDb, firestoreRetry, _cache, getUserName, getUserId
// ═══════════════════════════════════════════════════════════════

const _cache={quotes:null,customers:null,templates:null};let _ready=false;

// ─── Unified save state indicator ──────────────────────────────────────────
// One source of truth for the top-bar save chip. Replaces ad-hoc writes from
// DB.saveQ / markDirty / markClean that used to fight each other.
// States: 'dirty' | 'saving' | 'saved' | 'error' | 'idle'
window.setSaveState = function(state, msg){
  var si = document.getElementById('saveIndicator');
  if(!si) return;
  clearTimeout(window._saveStateTimer);
  switch(state){
    case 'dirty':
      si.style.display='block'; si.textContent=msg||'● Unsaved'; si.style.color='var(--or)'; break;
    case 'saving':
      si.style.display='block'; si.textContent=msg||'Saving…'; si.style.color='var(--tx3)'; break;
    case 'saved':
      si.style.display='block'; si.textContent=msg||'✓ Saved'; si.style.color='var(--gn)';
      window._saveStateTimer=setTimeout(function(){ si.style.display='none'; }, 2000); break;
    case 'error':
      si.style.display='block'; si.textContent=msg||'⚠ Save failed'; si.style.color='var(--rd)'; break;
    case 'idle':
    default:
      si.style.display='none'; break;
  }
};

const DB={
quotes(){return _cache.quotes||[]},
customers(){return _cache.customers||[]},
templates(){return _cache.templates||[]},
saveQ(quotes,changedId){window.setSaveState('saving');
var toSave=changedId?quotes.filter(function(q){return q.id===changedId}):quotes;
var anyFailed=false;
var settled=0;var total=toSave.length;
toSave.forEach(q=>{q.updatedBy=getUserName();q.updatedById=getUserId();q.updatedAt=new Date().toISOString();if(!q.createdBy){q.createdBy=getUserName();q.createdById=getUserId()}firestoreRetry(function(){ return fbDb.collection('quotes').doc(q.id).set(q,{merge:true}); }).then(function(){ settled++; if(settled===total && !anyFailed) window.setSaveState('saved'); }).catch(function(e){ console.error('saveQ:',e); anyFailed=true; settled++; if(typeof toast==='function') toast('Save failed — check connection','err'); window.setSaveState('error'); })});_cache.quotes=quotes;},
saveC(cs,changedId){
  // DATA-14 fix (2026-05-24): if caller passes changedId, write only that
  // doc. Concurrent users editing different customers no longer overwrite
  // each other. Legacy mode (no changedId) batch-writes everything as
  // before. Recommended: callers should always pass the changed customer's
  // id when known.
  window.setSaveState('saving');
  if(changedId){
    var changed = cs.find(function(x){return x.id === changedId;});
    if(changed){
      firestoreRetry(function(){
        return fbDb.collection('customers').doc(changed.id).set(changed, {merge:true});
      }).then(function(){ window.setSaveState('saved'); }).catch(function(e){ console.error('saveC('+changedId+'):',e); if(typeof toast==='function') toast('Save failed — check connection','err'); window.setSaveState('error'); });
    } else {
      console.warn('saveC: changedId '+changedId+' not found in cs array — falling back to batch');
      window.setSaveState('idle');
    }
    _cache.customers = cs;
    return;
  }
  // Legacy: write the whole list (kept for callers that don't know which one changed)
  const b = fbDb.batch();
  cs.forEach(function(c){ b.set(fbDb.collection('customers').doc(c.id), c); });
  firestoreRetry(function(){ return b.commit(); }).then(function(){ window.setSaveState('saved'); }).catch(function(e){ console.error('saveC batch:',e); if(typeof toast==='function') toast('Save failed — check connection','err'); window.setSaveState('error'); });
  _cache.customers = cs;
},
saveT(ts){window.setSaveState('saving');const b=fbDb.batch();ts.forEach(t=>b.set(fbDb.collection('quoteTemplates').doc(t.id),t));firestoreRetry(function(){ return b.commit(); }).then(function(){ window.setSaveState('saved'); }).catch(function(e){ console.error('saveT:',e); if(typeof toast==='function') toast('Save failed — check connection','err'); window.setSaveState('error'); });_cache.templates=ts},
logActivity(action,detail){fbDb.collection('activity').add({action:action,detail:detail,user:getUserName(),userId:getUserId(),timestamp:new Date().toISOString(),source:'client'}).catch(e=>console.error('log:',e))},
delDoc(col,id){if(window.MFXAudit)window.MFXAudit.delete(col,id);window.setSaveState('saving');firestoreRetry(function(){ return fbDb.collection(col).doc(id).delete(); }).then(function(){ window.setSaveState('saved','✓ Deleted'); }).catch(function(e){ console.error('delDoc:',e); if(typeof toast==='function') toast('Save failed — check connection','err'); window.setSaveState('error'); })}
};

// PERF-01/02/03 fix (2026-05-24): Bounded listeners.
// Limits prevent unbounded Firestore reads. Older docs accessible via direct
// query (openEditor uses doc().get()) so editing pre-window quotes still works.
// The editId preservation block keeps the active edit visible even if it's
// outside the recent window. Tune these constants if working set grows.
var QUOTES_LISTENER_LIMIT = 500;
var CUSTOMERS_LISTENER_LIMIT = 1000;
var TEMPLATES_LISTENER_LIMIT = 200;
window.MFX_LISTENER_LIMITS = {quotes:QUOTES_LISTENER_LIMIT, customers:CUSTOMERS_LISTENER_LIMIT, templates:TEMPLATES_LISTENER_LIMIT};

function startListeners(){
_coreListeners.push(fbDb.collection('quotes').orderBy('updatedAt','desc').limit(QUOTES_LISTENER_LIMIT).onSnapshot(s=>{
  var incoming=s.docs.map(d=>({...d.data(),id:d.id}));
  // Preserve the actively-edited quote if the snapshot doesn't include it (pending write OR out-of-window)
  if(S.editId&&S.view==='editor'){
    var editQ=_cache.quotes&&_cache.quotes.find(function(q){return q.id===S.editId});
    if(editQ&&!incoming.find(function(q){return q.id===S.editId})){
      incoming.unshift(editQ);
    }
  }
  _cache.quotes=incoming;
  if(_ready){
    if(S.view!=='editor'){({dashboard:renderDash,quotes:renderQuotes,customers:renderCust,templates:renderTpl,clientservices:window.MFX_VIEW_RENDERERS&&window.MFX_VIEW_RENDERERS.clientservices,sales:window.MFX_VIEW_RENDERERS&&window.MFX_VIEW_RENDERERS.sales})[S.view]?.()}
    else if(S.etab===13&&typeof renderWorkflow==='function'){renderWorkflow();if(typeof renderConnections==='function')renderConnections()}
  }
}, err => console.warn('core quotes listener:', err.message)));
_coreListeners.push(fbDb.collection('customers').orderBy('company').limit(CUSTOMERS_LISTENER_LIMIT).onSnapshot(s=>{_cache.customers=s.docs.map(d=>({...d.data(),id:d.id}));if(_ready){if(S.view==='customers')renderCust();if(S.view==='clientservices'&&window.MFX_VIEW_RENDERERS&&window.MFX_VIEW_RENDERERS.clientservices)window.MFX_VIEW_RENDERERS.clientservices();}}, err => console.warn('core customers listener:', err.message)));
_coreListeners.push(fbDb.collection('quoteTemplates').limit(TEMPLATES_LISTENER_LIMIT).onSnapshot(s=>{_cache.templates=s.docs.map(d=>({...d.data(),id:d.id}))}, err => console.warn('core quoteTemplates listener:', err.message)));
// DATA-01: start spec overlay listeners + run one-time localStorage migration
if(typeof _startSpecOverlayListeners==='function')_startSpecOverlayListeners();
if(typeof _migrateLocalSpecOverlayOnce==='function')setTimeout(_migrateLocalSpecOverlayOnce, 2000);
_ready=true}

// ═══ DEPARTMENT → HOME VIEW MAPPING ═══
var DEPT_HOME_MAP={
  'client services':'dept-cs-home','sales':'dept-cs-home','estimation':'dept-cs-home',
  'pre-press':'dept-pp-home','prepress':'dept-pp-home',
  'production':'dept-production-home','manufacturing':'dept-production-home',
  'logistics':'dept-logistics-home','shipping':'dept-logistics-home','warehouse':'dept-logistics-home',
  'quality':'dept-quality-home','qa':'dept-quality-home',
  'finance':'dept-finance-home','accounting':'dept-finance-home',
  'fsqms':'dept-fsqms-home','sqf':'dept-fsqms-home','food safety':'dept-fsqms-home',
  'operations':'dept-operations-home','administration':'dept-operations-home',
  'ceo':'dashboard','executive':'dashboard','management':'dashboard'
};
window.DEPT_HOME_MAP=DEPT_HOME_MAP;
// ═══ DEPARTMENT → ALLOWED VIEWS ═══
// UX-01 fix (2026-05-24): every dept-*-home alias (both short and long form)
// is in every dept's list so the hamburger menu's cross-dept landing pages
// always navigate. Short names (dept-prod-home, dept-qa-home, etc.) come from
// full-menu.js; long names (dept-production-home, ...) are legacy. Both work.
var ALL_DEPT_HOMES=[
  'dept-cs-home','dept-pp-home','dept-jt-home',
  'dept-prod-home','dept-production-home',
  'dept-qa-home','dept-quality-home',
  'dept-fin-home','dept-finance-home',
  'dept-lg-home','dept-logistics-home',
  'dept-fsq-home','dept-fsqms-home',
  'dept-ops-home','dept-operations-home',
  'dept-fai-home'
];
var DEPT_ALLOWED_VIEWS={
  'client services':['quotes','customers','orders','templates','clientservices','sales','vendorpos','vendorprofile','ppd','jobtracker','dashboard','ceodash','launchpad','aiops'].concat(ALL_DEPT_HOMES),
  'sales':['quotes','customers','orders','templates','clientservices','sales','vendorpos','vendorprofile','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'estimation':['quotes','customers','orders','templates','clientservices','sales','vendorpos','vendorprofile','ppd','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'pre-press':['ppd','jobtracker','production','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'prepress':['ppd','jobtracker','production','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'production':['production','jobtracker','operator','ppd','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'manufacturing':['production','jobtracker','operator','ppd','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'logistics':['logistics','production','jobtracker','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'shipping':['logistics','production','jobtracker','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'warehouse':['logistics','production','jobtracker','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'quality':['quality','capa','gmp','audit','training','doccontrol','sqfdatalogs','fsqms','records','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'qa':['quality','capa','gmp','audit','training','doccontrol','sqfdatalogs','fsqms','records','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'finance':['accounting','finance','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'accounting':['accounting','finance','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'fsqms':['gmp','capa','audit','training','doccontrol','sqfdatalogs','fsqms','records','quality','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'sqf':['gmp','capa','audit','training','doccontrol','sqfdatalogs','fsqms','records','quality','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'food safety':['gmp','capa','audit','training','doccontrol','sqfdatalogs','fsqms','records','quality','dashboard','launchpad'].concat(ALL_DEPT_HOMES),
  'operations':null,'administration':null,'ceo':null,'executive':null,'management':null
};
window.ALL_DEPT_HOMES=ALL_DEPT_HOMES;
window.DEPT_ALLOWED_VIEWS=DEPT_ALLOWED_VIEWS;

function getUserDeptHome(dept){
  if(!dept)return'dashboard';
  var key=dept.toLowerCase().trim();
  return DEPT_HOME_MAP[key]||'dashboard';
}
function isViewAllowedForDept(view,dept,role){
  if(!dept)return true; // no dept set = show everything (admin/unassigned)
  var key=dept.toLowerCase().trim();
  // CEO/admin/operations see everything
  if(role&&/ceo|admin|owner|director|vp|operations/i.test(role))return true;
  if(/operations|administration|ceo|executive|management/i.test(key))return true;
  var allowed=DEPT_ALLOWED_VIEWS[key];
  if(!allowed)return true; // null = unrestricted (admin depts)
  return allowed.indexOf(view)>=0;
}
window.getUserDeptHome=getUserDeptHome;
window.isViewAllowedForDept=isViewAllowedForDept;

// ═══ PERF-09 fix (2026-05-24): lazy chunk loader ═══
// build.js produces 3 bundles. core (this one) loads synchronously. `chat` and
// `ai` load on demand via this loader. window.MFX_CHUNK_MANIFEST is injected by
// build.js at the top of the core bundle and maps chunk name -> hashed filename.
window.MFX_CHUNK_MANIFEST = window.MFX_CHUNK_MANIFEST || {};
var VIEW_CHUNK_MAP = {
  'chat': 'chat',
  'aiops': 'ai',
};
window.VIEW_CHUNK_MAP = VIEW_CHUNK_MAP;
var _loadedChunks = {};
function loadChunk(name){
  if(_loadedChunks[name]) return _loadedChunks[name];
  var filename = (window.MFX_CHUNK_MANIFEST||{})[name];
  if(!filename){
    return Promise.reject(new Error('Unknown chunk: '+name));
  }
  _loadedChunks[name] = new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = '/js/' + filename;
    s.async = false;
    s.onload = function(){ console.info('[chunk] loaded:', name); resolve(); };
    s.onerror = function(){
      delete _loadedChunks[name];
      reject(new Error('Failed to load chunk: '+name));
    };
    document.head.appendChild(s);
  });
  return _loadedChunks[name];
}
window.loadChunk = loadChunk;
// Eagerly preload lazy chunks 2 seconds after auth + listeners are ready, so
// they're warm before the user clicks. On-demand fallback in goView covers the
// case where they haven't loaded yet.
if(typeof window !== 'undefined'){
  setTimeout(function(){
    try{
      Object.keys(window.MFX_CHUNK_MANIFEST||{}).forEach(function(name){
        loadChunk(name).catch(function(err){ console.warn('preload '+name+':', err.message); });
      });
    }catch(e){ console.warn('chunk preload:', e); }
  }, 3000);
}
// ═══ end PERF-09 loader ═══



fbAuth.onAuthStateChanged(user=>{try{if(user){if(user.email&&!user.email.endsWith('@microflexfilm.com')&&!user.isAnonymous){ /* UX-12 fix 2026-05-24: toast first, then signOut so the toast actually shows */ if(typeof toast==='function')toast('Access restricted to @microflexfilm.com accounts — please switch accounts and retry','err');setTimeout(function(){fbAuth.signOut()},800);return} /* Auth signed in */ CURRENT_USER={uid:user.uid,email:user.email,displayName:user.displayName,photoURL:user.photoURL};window.CURRENT_USER=CURRENT_USER;
syncUserAccessProfile().catch(function(e){console.warn('User doc write:',e)});
if(typeof DB!=='undefined'&&DB.logActivity) DB.logActivity('user.login', (user.displayName||user.email)+' logged in');
// FlexAi auto-status: user online
if(typeof fbDb!=='undefined'){try{
  // UX-13 fix (2026-05-24): throttle "<name> is online" posts to once per hour
  // per browser. Previously every page refresh / new tab spammed the feed.
  var _onlineKey = 'mfx_last_online_post_' + (user.uid || user.email || 'anon');
  var _lastOnline = parseInt(localStorage.getItem(_onlineKey) || '0', 10);
  if (Date.now() - _lastOnline > 60*60*1000) {
    localStorage.setItem(_onlineKey, String(Date.now()));
    fbDb.collection('statusReel').add({text:(user.displayName||user.email)+' is online',emoji:'🟢',gif:null,user:'Flex Ai',userId:'system-flexai',dept:'System',createdAt:firebase.firestore.FieldValue.serverTimestamp(),announcement:false,likes:[],replyCount:0,mentions:[],replies:[]});
  }
}catch(e){}}
if(!window.GTOKEN){var cached=sessionStorage.getItem('mfx_gtoken');var exp=parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');if(cached&&Date.now()<exp)window.GTOKEN=cached;}
var ls=$('loginScreen'),ap=$('app');if(ap)ap.style.display='block';if(typeof window.dismissIntroAfterLogin==='function')window.dismissIntroAfterLogin();else if(ls)ls.style.display='none';
// Fetch user dept/role from Firestore for department routing
var _userDeptPromise=Promise.resolve({dept:'',role:''});
if(typeof fbDb!=='undefined'){
  _userDeptPromise=fbDb.collection('users').doc(user.uid).get().then(function(doc){
    if(doc.exists){var d=doc.data();return{dept:d.dept||'',role:d.role||'',permissions:d.permissions||{}};}
    return{dept:'',role:''};
  }).catch(function(){return{dept:'',role:''};});
}
_userDeptPromise.then(function(_uInfo){
CURRENT_USER.dept=_uInfo.dept||'';CURRENT_USER.role=_uInfo.role||'';CURRENT_USER.permissions=_uInfo.permissions||{};window.CURRENT_USER=CURRENT_USER;
checkAndSeedData().then(()=>{startListeners();setTimeout(()=>{var _pKey='mfx_profile_'+(CURRENT_USER?CURRENT_USER.uid:'default');if(!localStorage.getItem(_pKey)){localStorage.setItem(_pKey,JSON.stringify({flexId:'',role:'',dept:'',pods:'',mood:'😊',yearJoined:'',lastUpdated:new Date().toISOString()}))}
// Restore editor state from URL or sessionStorage
var _restoredEditor=false;
var _urlPath=window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
if(_urlPath.indexOf('editor/')===0){var _rQid=_urlPath.split('/')[1];if(_rQid){_restoredEditor=true;setTimeout(function(){openEditor(_rQid)},200)}}
else{var _ssEdit=sessionStorage.getItem('mfx_editId');if(_ssEdit&&_urlPath==='editor'){_restoredEditor=true;setTimeout(function(){openEditor(_ssEdit)},200)}}
if(!_restoredEditor){var _home=getUserDeptHome(CURRENT_USER.dept);goView(_home)}
if(typeof populateHamUser==='function')populateHamUser();
if(typeof _mfxApplyUnlock==='function')_mfxApplyUnlock();
if(typeof initGamification==='function')initGamification();
if(typeof initSounds==='function')initSounds();
if(typeof MFX_SENTRY_SET_USER==='function')MFX_SENTRY_SET_USER();
if(typeof initFeatures==='function')initFeatures();
if(typeof initNotifications==='function')initNotifications();
if(typeof _initInactivity==='function')_initInactivity();
if(typeof initPresenceBar==='function')initPresenceBar();
if(typeof MFXAi!=='undefined'&&MFXAi.init)MFXAi.init().then(function(){if(MFXAi._initChatBridge)MFXAi._initChatBridge()}).catch(function(e){console.warn('FlexAi init:',e)});
// duplicate syncUserAccessProfile call removed — already called on line 279
},500)}).catch(function(e){console.error('Auth init error:',e);goView('launchpad')})});/*end _userDeptPromise.then*/}else{_clearInactivity();
// FlexAi auto-status: user offline
if(typeof fbDb!=='undefined'&&CURRENT_USER){try{var _offName=CURRENT_USER.displayName||CURRENT_USER.email||'User';fbDb.collection('statusReel').add({text:_offName+' went offline',emoji:'🔴',gif:null,user:'Flex Ai',userId:'system-flexai',dept:'System',createdAt:firebase.firestore.FieldValue.serverTimestamp(),announcement:false,likes:[],replyCount:0,mentions:[],replies:[]})}catch(e){}}
CURRENT_USER=null;window.CURRENT_USER=null;var ls2=$('loginScreen'),ap2=$('app');if(ap2)ap2.style.display='none';
var intr=document.getElementById('introScreen');
if(intr){intr.style.display='block';intr.style.opacity='1';intr.style.transform='';
  // Show the form immediately on re-login
  var fw=document.getElementById('loginFormBlock')||document.querySelector('#introScreen .form-wrap');
  if(fw){fw.style.opacity='1';fw.style.transform='translateY(0)';}
}}}catch(e){console.error('onAuthStateChanged error:',e)}});

// FlexAi auto-status on tab close + unsaved changes warning
window.addEventListener('beforeunload', function(e){
  // Warn if there are unsaved changes in the editor
  if(window._viewDirty && S && S.view === 'editor'){
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
  }
  if(typeof fbDb!=='undefined'&&CURRENT_USER){
    try{var _name=CURRENT_USER.displayName||CURRENT_USER.email||'User';
    navigator.sendBeacon&&navigator.sendBeacon('/__/noop',''); // keep connection alive briefly
    fbDb.collection('statusReel').add({text:_name+' went offline',emoji:'🔴',gif:null,user:'Flex Ai',userId:'system-flexai',dept:'System',createdAt:firebase.firestore.FieldValue.serverTimestamp(),announcement:false,likes:[],replyCount:0,mentions:[],replies:[]})}catch(e){}
  }
});

// Online/Offline indicators
window.addEventListener('online', function() {
  var si = document.getElementById('saveIndicator');
  if (si) { si.textContent = 'Back online'; si.style.display = 'block'; si.style.color = 'var(--gn)'; setTimeout(function(){ si.style.display = 'none'; }, 3000); }
});
window.addEventListener('offline', function() {
  var si = document.getElementById('saveIndicator');
  if (si) { si.textContent = 'Offline \u2014 changes queued'; si.style.display = 'block'; si.style.color = 'var(--or)'; }
});

// ═══════════════════════════════════════════════════════════════
// INACTIVITY TIMEOUT — Auto-logout after 30 minutes idle
// ═══════════════════════════════════════════════════════════════
var _inactivityTimer=null;
var _INACTIVITY_MS=30*60*1000; // 30 minutes
var _inactivityWarned=false;

function _resetInactivity(){
  if(_inactivityTimer)clearTimeout(_inactivityTimer);
  _inactivityWarned=false;
  if(!CURRENT_USER)return;
  // Warn at 25 min, logout at 30 min
  _inactivityTimer=setTimeout(function(){
    if(!CURRENT_USER)return;
    _inactivityWarned=true;
    if(typeof toast==='function')toast('Session expires in 5 minutes — move mouse to stay logged in','warn');
    _inactivityTimer=setTimeout(function(){
      if(!CURRENT_USER)return;
      if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('user.timeout',getUserName()+' auto-logged out (30 min inactivity)');
      if(typeof toast==='function')toast('Logged out due to inactivity','info');
      setTimeout(function(){signOut()},1500);
    },5*60*1000);
  },25*60*1000);
}

function _initInactivity(){
  _resetInactivity();
  ['mousedown','keydown','scroll','touchstart','pointermove'].forEach(function(evt){
    document.addEventListener(evt,_resetInactivity,{passive:true,capture:true});
  });
}

function _clearInactivity(){
  if(_inactivityTimer){clearTimeout(_inactivityTimer);_inactivityTimer=null;}
}
window._clearInactivity=_clearInactivity;

// ═══════════════════════════════════════════════════════════════
// SECTION 5: SEED DATA & SPEC CONSTANTS
// Functions: checkAndSeedData
// Constants: MATS, MFX_TERMS, SQF_BADGE, QUOTE_LOGO, QUOTE_LOGO_SVG,
//            SPEC_DIES, SPEC_FILMS, SPEC_LABELS, SPEC_VARNISHES
// Dependencies: fbDb, SEED_CLIENTS (external)
// ═══════════════════════════════════════════════════════════════

// DATA-03 fix (2026-05-24): SEED_CLIENTS was never shipped in current source —
// the typeof guard silently no-op'd, leaving fresh environments empty without
// error. Function reduced to a documented no-op. If you actually need to seed
// customers, write a proper one-time admin script using Firebase Admin SDK
// (e.g. scripts/seed/seed-customers.js with a service account).
async function checkAndSeedData(){
  // No-op. SEED_CLIENTS is no longer defined anywhere. Customer data lives in
  // Firestore and is created by users via the Customers view, not seeded here.
  return;
}
// PERF-15 fix (2026-05-24): MATS catalog moved to lazy 'mats' chunk
// (public/js/mats-data.js). This stub keeps consumers working before
// the chunk loads. The chunk pushes entries into this exact array, so
// any consumer holding a reference to window.MATS keeps it valid.
var MATS = window.MATS = window.MATS || [];
const MFX_TERMS=`Lead time is 15 working days from proof sign off. Quantities shipped are +/- 10% of order quantity and for stand up gusset bags is +/- 20%. Stability testing must be done prior to running order and material approval form is signed after testing is concluded. Art will be billed at $90.00/hour if art is not in AI format.

Disclaimer - Microflex makes no representation, warranties, or guarantees regarding the use of any particular material for any particular purpose. Testing and approval of all materials is the sole responsibility of the customer. In the event of a printing error Microflex\u2019s liability is expressly limited to replacement of the particular defective job. Under no circumstances shall Microflex be responsible or liable for any monetary, incidental, consequential, punitive or special damages (including loss of profits) or for any remedy other than the reprint of a defective job.

In regards to food contact regulations for all finished articles please note the following: Finished goods are not adulterated or misbranded within the meaning of the Federal Food, Drug and Cosmetic Act (FEDCA) as amended and not an article, which may not, under the provisions of the act, be introduced into interstate commerce. This is applicable to all raw materials: Base and Laminates, as they are certified by our suppliers to be suitable for food contact. All, if any inks utilized in the manufacturing process are compliant with the US FDA regulations for food contact. All, if any, adhesives and coatings are suitable for food packaging applications. Material specification sheets can be supplied on request for all materials and for clarification purposes to demonstrate legal compliance. Are not adulterated or misbranded within the meaning of the pure foods and drug laws or ordinances of any U.S. state or city which applicable to such shipments or delivery; comply with all applicable Federal, State and local laws, including but not limited to, Consumer Product Safety Act and the Fair Labor Standards Act. Comply with Food and Drug Administration Title 21 CFR sections 174-178. This regulation describes film, which may be safely used in contact with all types of food excluding alcoholic beverages.`;
const SQF_BADGE='data:image/png;base64,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';
const QUOTE_LOGO='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzNjAgNTIiIHdpZHRoPSIzNjAiIGhlaWdodD0iNTIiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJtZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDBlNWZmO3N0b3Atb3BhY2l0eToxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwYmNkNDtzdG9wLW9wYWNpdHk6MSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2ciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzY0NzQ4YjtzdG9wLW9wYWNpdHk6MSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM5NGEzYjg7c3RvcC1vcGFjaXR5OjEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDwhLS0gTWFpbiB3b3JkbWFyayAtLT4KICA8dGV4dCB4PSIwIiB5PSIzMiIgZm9udC1mYW1pbHk9IkFyaWFsIEJsYWNrLEFyaWFsLEhlbHZldGljYSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSJ1cmwoI21nKSIgbGV0dGVyLXNwYWNpbmc9IjMiPk1JQ1JPRkxFWDwvdGV4dD4KICA8IS0tIEFjY2VudCBsaW5lIC0tPgogIDxyZWN0IHg9IjAiIHk9IjQwIiB3aWR0aD0iMjgyIiBoZWlnaHQ9IjIuNSIgcng9IjEuMjUiIGZpbGw9InVybCgjbWcpIiBvcGFjaXR5PSIwLjYiLz4KICA8IS0tIFN1YnRpdGxlIC0tPgogIDx0ZXh0IHg9IjAiIHk9IjUwIiBmb250LWZhbWlseT0iQXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNy41IiBmaWxsPSJ1cmwoI3NnKSIgbGV0dGVyLXNwYWNpbmc9IjQiIGZvbnQtd2VpZ2h0PSI2MDAiPkZJTE0gQ09SUE9SQVRJT048L3RleHQ+Cjwvc3ZnPg==';
const QUOTE_LOGO_SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 52" width="360" height="52">
  <defs>
    <linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00e5ff;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#00bcd4;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="sg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#64748b;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#94a3b8;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <!-- Main wordmark -->
  <text x="0" y="32" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="36" font-weight="900" fill="url(#mg)" letter-spacing="3">MICROFLEX</text>
  <!-- Accent line -->
  <rect x="0" y="40" width="282" height="2.5" rx="1.25" fill="url(#mg)" opacity="0.6"/>
  <!-- Subtitle -->
  <text x="0" y="50" font-family="Arial,Helvetica,sans-serif" font-size="7.5" fill="url(#sg)" letter-spacing="4" font-weight="600">FILM CORPORATION</text>
</svg>`;
const SPEC_DIES=[{"id": "AG1000", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "4", "sAr": "3", "repeat": "3.125", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "-", "cRad": "0.125", "gearTooth": "75", "notes": "Die No Good, Use Ag1013"}, {"id": "AG1001", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "3", "sAr": "4", "repeat": "4.125", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "99", "notes": "3X4"}, {"id": "AG1002", "shape": "Perf", "blankSize": "16\"", "cutTo": "Metal To Metal", "sA": "-", "sAr": "3.125", "repeat": "3.125", "nA": "1", "nAr": "3.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "75", "notes": "3.125"}, {"id": "AG1003", "shape": "Perf", "blankSize": "16\"", "cutTo": "Metal To Metal", "sA": "-", "sAr": "4.125", "repeat": "4.125", "nA": "1", "nAr": "3.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "99", "notes": "4.125"}, {"id": "AG1004", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "4", "sAr": "5", "repeat": "5.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "82", "notes": "4X5"}, {"id": "AG1005", "shape": "Perf/ Sheeter", "blankSize": "16\"", "cutTo": "Metal To Metal", "sA": "0", "sAr": "16", "repeat": "16", "nA": "0", "nAr": "1.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "128", "notes": "16"}, {"id": "AG1006", "shape": "Flexible Circle", "blankSize": "Flexible", "cutTo": "40# Liner", "sA": "2.5", "sAr": "2.5", "repeat": "-", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "0", "notes": "Die Only Fits On 120 Tooth Mag Cyl."}, {"id": "AG1007", "shape": "Magnetic Cylinder", "blankSize": "16\"", "cutTo": "-", "sA": "-", "sAr": "16", "repeat": "16", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "-", "cRad": "0", "gearTooth": "128", "notes": "Magnetic Cylinder"}, {"id": "AG1008", "shape": "Special Shape", "blankSize": "7\"", "cutTo": "Multi Level", "sA": "3.25", "sAr": "8", "repeat": "8.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0", "cRad": "0.015625", "gearTooth": "65", "notes": "Rectangle/ Vacuum"}, {"id": "AG1009", "shape": "Perf", "blankSize": "7\"", "cutTo": "Metal To Metal", "sA": "-", "sAr": "6.625", "repeat": "6.625", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "0", "cRad": "", "gearTooth": "53", "notes": "6.625"}, {"id": "AG1010", "shape": "Rectangle", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "4", "sAr": "6.5", "repeat": "6.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0", "cRad": "0.0625", "gearTooth": "53", "notes": "4X6.5"}, {"id": "AG1011", "shape": "Perf", "blankSize": "7\"", "cutTo": "Metal To Metal", "sA": "-", "sAr": "3.125", "repeat": "3.125", "nA": "1", "nAr": "3.0", "gapAr": "0", "gapA": "0", "cRad": "", "gearTooth": "75", "notes": "3.125"}, {"id": "AG1012", "shape": "Rectangle", "blankSize": "7\"", "cutTo": "Metal To Metal", "sA": "2", "sAr": "3", "repeat": "3.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "50", "notes": "2X3"}, {"id": "AG1013", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "4", "sAr": "3", "repeat": "3.125", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "4X3"}, {"id": "AG1014", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "4", "sAr": "4", "repeat": "4.125", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "99", "notes": "4X4"}, {"id": "AG1015", "shape": "Rectangle", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "1.25", "sAr": "2", "repeat": "2.125", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "68", "notes": "1.25X2"}, {"id": "AG1016", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.375", "sAr": "6.75", "repeat": "6.875", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "2.375X6.75"}, {"id": "AG1017", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "3", "sAr": "15", "repeat": "15.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "121", "notes": "3X15"}, {"id": "AG1018", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.125", "sAr": "11.375", "repeat": "11.5", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "92", "notes": "2.125X11.375"}, {"id": "AG1019", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "1.75", "sAr": "1.8125", "repeat": "1.9375", "nA": "4", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.03125", "gearTooth": "93", "notes": "1.75X1.8125"}, {"id": "AG1020", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.25", "sAr": "5.5", "repeat": "5.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "90", "notes": "2.25X5.5"}, {"id": "AG1021", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "4.25", "sAr": "5.125", "repeat": "5.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "84", "notes": "4.25X5.125"}, {"id": "AG1022", "shape": "Rectangle", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "1", "sAr": "2", "repeat": "2.125", "nA": "5", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "68", "notes": "1X2"}, {"id": "AG1023", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "4.375", "sAr": "15", "repeat": "15.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "121", "notes": "4.375X15"}, {"id": "AG1024", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.125", "sAr": "8.875", "repeat": "9", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "72", "notes": "2.125X8.875"}, {"id": "AG1025", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "3", "sAr": "10", "repeat": "10.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "81", "notes": "3X10"}, {"id": "AG1026", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "1.875", "sAr": "3.5", "repeat": "3.667", "nA": "4", "nAr": "3.0", "gapAr": "0.167", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "88", "notes": "1.875X3.5"}, {"id": "AG1027", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.5", "sAr": "4", "repeat": "4.1667", "nA": "3", "nAr": "3.0", "gapAr": "0.1667", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "100", "notes": "2.5X4"}, {"id": "AG1028", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.75", "sAr": "3.75", "repeat": "3.875", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "93", "notes": "2.75X3.75"}, {"id": "AG1029", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "2", "sAr": "3", "repeat": "3.875", "nA": "7", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "124", "notes": "2X3"}, {"id": "AG1030", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "4", "sAr": "6", "repeat": "6.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "98", "notes": "4X6"}, {"id": "AG1031", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "4.75", "sAr": "17.875", "repeat": "18", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "144", "notes": "4.75X17.875"}, {"id": "AG1032", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "5", "sAr": "10.25", "repeat": "10.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "83", "notes": "5X10.25"}, {"id": "AG1033", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "3", "sAr": "8.5", "repeat": "", "nA": "2", "nAr": "1.0", "gapAr": "", "gapA": "0.125", "cRad": "", "gearTooth": "", "notes": "Watch Dial"}, {"id": "AG1034", "shape": "Special Shape", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "2.5", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "", "gearTooth": "57", "notes": "Watch Dial"}, {"id": "AG1035", "shape": "Circle", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "2.25", "sAr": "2.25", "repeat": "2.375", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "", "gearTooth": "57", "notes": "2.25X2.25"}, {"id": "AG1036", "shape": "Rectangle", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "1.25", "sAr": "6", "repeat": "6.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "98", "notes": "1.25X6"}, {"id": "AG1037", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "3.75", "sAr": "6.25", "repeat": "6.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "102", "notes": "3.75X6.25"}, {"id": "AG1038", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "1.875", "sAr": "5.5", "repeat": "5.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "1.875X5.5"}, {"id": "AG1039", "shape": "Oval", "blankSize": "7\"", "cutTo": "40# Liner", "sA": "0.625", "sAr": "0.875", "repeat": "1", "nA": "8", "nAr": "7.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "56", "notes": ".625X.875"}, {"id": "AG1040", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "5.25", "sAr": "6", "repeat": "6.125", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "98", "notes": "5.25X6"}, {"id": "AG1041", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.5", "sAr": "4.25", "repeat": "4.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "70", "notes": "2.5X4.25"}, {"id": "AG1042", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "4", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "4X8"}, {"id": "AG1043", "shape": "Circle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "1.75", "sAr": "1.75", "repeat": "1.875", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "60", "notes": "1.75"}, {"id": "AG1044", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1", "sAr": "2.5", "repeat": "2.625", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "63", "notes": "1X2.5"}, {"id": "AG1045", "shape": "Rectangle", "blankSize": "12.25\"", "cutTo": "40# Liner", "sA": "5.5", "sAr": "7.875", "repeat": "8", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "5.5X7.875"}, {"id": "AG1046", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.5", "sAr": "1.5", "repeat": "1.625", "nA": "4", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "65", "notes": "1.5X1.5"}, {"id": "AG1047", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "4", "sAr": "0.75", "repeat": "0.875", "nA": "1", "nAr": "8.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "56", "notes": "4X.75"}, {"id": "AG1048", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2", "sAr": "0.5", "repeat": "0.625", "nA": "1", "nAr": "12.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "60", "notes": "2X.5"}, {"id": "AG1049", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1", "sAr": "6", "repeat": "6.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "98", "notes": "1X6"}, {"id": "AG1050", "shape": "Special Shape", "blankSize": "16\"", "cutTo": "50# Liner", "sA": "1", "sAr": "1", "repeat": "1.1429", "nA": "5", "nAr": "14.0", "gapAr": "0.1429", "gapA": "0.125", "cRad": "0", "gearTooth": "128", "notes": "1X1"}, {"id": "AG1051", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "5", "sAr": "7", "repeat": "7.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": "5X7"}, {"id": "AG1052", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "4", "sAr": "10", "repeat": "10.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "81", "notes": "4X10"}, {"id": "AG1053", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "3", "sAr": "5", "repeat": "5.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "82", "notes": "3X5"}, {"id": "AG1054", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "5.5", "sAr": "15.5", "repeat": "15.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "125", "notes": "5.5X15.5"}, {"id": "AG1055", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.5", "sAr": "4.5", "repeat": "4.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "2.5X4.5"}, {"id": "AG1056", "shape": "Perf", "blankSize": "10\"", "cutTo": "Metal To Metal", "sA": "-", "sAr": "6.125", "repeat": "6.125", "nA": "1", "nAr": "2.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "98", "notes": "6.125"}, {"id": "AG1057", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "3", "sAr": "3", "repeat": "3.125", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "75", "notes": "3X3"}, {"id": "AG1058", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "6", "sAr": "8", "repeat": "8.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "6X8"}, {"id": "AG1059", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2", "sAr": "1.5", "repeat": "1.625", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "65", "notes": "2X1.5"}, {"id": "AG1060", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "40# Liner", "sA": "3.625", "sAr": "14.375", "repeat": "14.5", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "3.625X14.375"}, {"id": "AG1061", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "4.25", "sAr": "15.875", "repeat": "16", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "128", "notes": "4.25X15.875"}, {"id": "AG1062", "shape": "Rectangle", "blankSize": "10\" Special", "cutTo": "40# Liner", "sA": "2.25", "sAr": "9.5", "repeat": "9.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "77", "notes": "2.25X9.5"}, {"id": "AG1063", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "0.5", "sAr": "2", "repeat": "2.125", "nA": "5", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "68", "notes": "0.5X2"}, {"id": "AG1064", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "0.5", "sAr": "2.25", "repeat": "2.375", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": "0.5X2.25"}, {"id": "AG1065", "shape": "Rectangle", "blankSize": "12\"", "cutTo": "40# Liner", "sA": "5.5", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "114", "notes": "5.5X7"}, {"id": "AG1066", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "40# Liner", "sA": "5.5", "sAr": "5.5", "repeat": "5.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "5.5X5.5"}, {"id": "AG1067", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "40# Liner", "sA": "5.5", "sAr": "15.1875", "repeat": "15.375", "nA": "2", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "123", "notes": "5.5X15.1875"}, {"id": "AG1068", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "-", "sA": "3", "sAr": "8.625", "repeat": "8.75", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "70", "notes": "3X8.625"}, {"id": "AG1069", "shape": "Rectangle", "blankSize": "15\"", "cutTo": "40# Liner", "sA": "3.375", "sAr": "9.125", "repeat": "9.25", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "3.375X9.125"}, {"id": "AG1070", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "3", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "3X8"}, {"id": "AG1071", "shape": "Perf", "blankSize": "16\"", "cutTo": "Metal To Metal", "sA": "-", "sAr": "4.125", "repeat": "4.125", "nA": "0", "nAr": "2.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "66", "notes": "4.125"}, {"id": "AG1072", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "0.5", "sAr": "1.5", "repeat": "1.625", "nA": "5", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "52", "notes": "0.5X1.5"}, {"id": "AG1073", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1", "sAr": "1.5", "repeat": "1.625", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "52", "notes": "1X1.5"}, {"id": "AG1074", "shape": "Oval", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1", "sAr": "2", "repeat": "2.125", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "68", "notes": "1X2"}, {"id": "AG1075", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.25", "sAr": "2.5", "repeat": "2.625", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "63", "notes": "1.25X2.5"}, {"id": "AG1076", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1", "sAr": "3.5", "repeat": "3.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "58", "notes": "1X3.5"}, {"id": "AG1077", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Loiner", "sA": "3.25", "sAr": "5.25", "repeat": "5.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "86", "notes": "3.25X5.25"}, {"id": "AG1078", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "40# Liner", "sA": "3.125", "sAr": "10.5", "repeat": "10.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "3.125X10.5"}, {"id": "AG1079", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.25\"", "sAr": "2.5\"", "repeat": "2.625\"", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "63", "notes": "1.25X2.5"}, {"id": "AG1080", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.75", "sAr": "4", "repeat": "4.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "66", "notes": "1.75X4"}, {"id": "AG1081", "shape": "Rectangle", "blankSize": "9\"", "cutTo": "40# Liner", "sA": "1.75", "sAr": "7.625", "repeat": "7.75", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "62", "notes": "1.75X7.625"}, {"id": "AG1082", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "4.5625", "sAr": "12", "repeat": "12.125", "nA": "2", "nAr": "1.0", "gapAr": "0.025", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "98", "notes": "4.5625X12"}, {"id": "AG1083", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.75", "sAr": "9.25", "repeat": "9.375", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "75", "notes": "2.75X9.25"}, {"id": "AG1084", "shape": "Circle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.5", "sAr": "2.5", "repeat": "2.625", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "63", "notes": "2.5X2.5"}, {"id": "AG1085", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "3", "sAr": "9", "repeat": "9.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "73", "notes": "3X9"}, {"id": "AG1086", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.625", "sAr": "7.125", "repeat": "7.125", "nA": "5", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "58", "notes": "1.625X7.125"}, {"id": "AG1087", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "8.5", "sAr": "11", "repeat": "11.125", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "8.5X11"}, {"id": "AG1088", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40# Liner", "sA": "2.75", "sAr": "10", "repeat": "10.125", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "81", "notes": "2.75X10"}, {"id": "AG1089", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2", "sAr": "4", "repeat": "4.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "2X4"}, {"id": "AG1090", "shape": "Rectangle", "blankSize": "650Webtron", "cutTo": "40# Liner", "sA": "5", "sAr": "6", "repeat": "6.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "49", "notes": "5X6"}, {"id": "AG1091", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.375", "sAr": "9.25", "repeat": "9.375", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "75", "notes": "2.375X9.25"}, {"id": "AG1092", "shape": "Special Shape", "blankSize": "650Webtron", "cutTo": "40# Liner", "sA": "1.2099", "sAr": "3.4375", "repeat": "3.5625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "57", "notes": "1.2099X3.4375"}, {"id": "AG1093", "shape": "Special Shape", "blankSize": "650Webtron", "cutTo": "40# Liner", "sA": "1.2099", "sAr": "3.4375", "repeat": "3.5625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "57", "notes": "1.2099X3.4375"}, {"id": "AG1094", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "4.75", "sAr": "5", "repeat": "5.125", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "82", "notes": "4.75X5"}, {"id": "AG1095", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "0.1875", "sAr": "1.5635", "repeat": "1.6875", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "54", "notes": ".1875X1.5635"}, {"id": "AG1096", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "4", "sAr": "2", "repeat": "2.125", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "4X2"}, {"id": "AG1097", "shape": "Rectangle", "blankSize": "11\" Modified", "cutTo": "40# Liner", "sA": "4.9875", "sAr": "11.4375", "repeat": "11.625", "nA": "2", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "4.9875X11.4375"}, {"id": "AG1098", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "40#", "sA": "1", "sAr": "1", "repeat": "1.1875", "nA": "4", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "54", "notes": "1X1"}, {"id": "AG1099", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "40#", "sA": "5", "sAr": "7.5", "repeat": "7.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "61", "notes": "5X7.5"}, {"id": "AG1100", "shape": "Special Shape", "blankSize": "10Ma", "cutTo": "40#", "sA": "2.5", "sAr": "3.5", "repeat": "3.5", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "58", "notes": "2.5X3.5"}, {"id": "AG1101", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40#", "sA": "4.85", "sAr": "3.25", "repeat": "3.375", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "81", "notes": "4.85X3.25"}, {"id": "AG1102", "shape": "Special Shape", "blankSize": "-", "cutTo": "40# Liner", "sA": "1.3125", "sAr": "5.125", "repeat": "5.25", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "96", "notes": "1.3125X5.125"}, {"id": "AG1103", "shape": "Circle", "blankSize": "10\"", "cutTo": "40#", "sA": "3.5", "sAr": "3.5", "repeat": "3.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "58", "notes": "3.5X3.5"}, {"id": "AG1104", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40#", "sA": "2.8314", "sAr": "13.788", "repeat": "13.9755", "nA": "5", "nAr": "1.0", "gapAr": "0.212", "gapA": "0.125", "cRad": "0.125", "gearTooth": "112", "notes": "2.8314X13.788"}, {"id": "AG1105", "shape": "Rectangle", "blankSize": "750Webtron", "cutTo": "40#", "sA": "1.375", "sAr": "2.5", "repeat": "2.625", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "84", "notes": "1.375X2.5"}, {"id": "AG1106", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40#", "sA": "3.75", "sAr": "2.375", "repeat": "2.5", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "3.75X2.375"}, {"id": "AG1107", "shape": "Special Shape", "blankSize": "13\"", "cutTo": "40#", "sA": "4.75", "sAr": "12", "repeat": "12.25", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "4.75X12"}, {"id": "AG1108", "shape": "Circle", "blankSize": "16\"", "cutTo": "40#", "sA": "7.25", "sAr": "7.25", "repeat": "7.5", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "Circle", "gearTooth": "120", "notes": "7.25X7.25"}, {"id": "AG1109", "shape": "Sheeter", "blankSize": "11\"", "cutTo": "Metal To Metal", "sA": "11", "sAr": "12.125", "repeat": "12.125", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "0", "cRad": "Sheeter", "gearTooth": "98", "notes": "Sheeter"}, {"id": "AG1110", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "40#", "sA": "2.3125", "sAr": "3.875", "repeat": "4", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "64", "notes": "2.3125X3.875"}, {"id": "AG1111", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "3.5", "sAr": "19.75", "repeat": "20", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "Rectangle", "gearTooth": "160", "notes": "3.5X19.75"}, {"id": "AG1112", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "1.0938", "sAr": "7.125", "repeat": "7.25", "nA": "6", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "1.0938X7.125"}, {"id": "AG1113", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "2.8314", "sAr": "9.7889", "repeat": "10", "nA": "3", "nAr": "1.0", "gapAr": "0.2111", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "2.8314X9.7889"}, {"id": "AG1114", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner", "sA": "3.25", "sAr": "19.5", "repeat": "20", "nA": "2", "nAr": "1.0", "gapAr": "0.5", "gapA": "0.125", "cRad": "0.125", "gearTooth": "160", "notes": "3.25X19.5"}, {"id": "AG1115", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.1874", "sAr": "3.2931", "repeat": "3.5", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.2069", "cRad": "Special Shape", "gearTooth": "56", "notes": "1.1874X3.2931"}, {"id": "AG1116", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "40# Liner", "sA": "2.4375", "sAr": "9", "repeat": "9.125", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "73", "notes": "2.4375X9"}, {"id": "AG1117", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40# Liner", "sA": "2.625", "sAr": "12.3125", "repeat": "12.25", "nA": "4", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "100", "notes": "2.625X12.3125"}, {"id": "AG1118", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.5", "sAr": "10.375", "repeat": "10.5", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "84", "notes": "2.5X10.375"}, {"id": "AG1119", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.0625", "sAr": "11.5", "repeat": "11.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "2.625X11.5"}, {"id": "AG1120", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.0625", "sAr": "11.5", "repeat": "11.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "1.0625X11.5"}, {"id": "AG1121", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "0.817", "sAr": "5.25", "repeat": "5.375", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "86", "notes": ".817X5.25"}, {"id": "AG1122", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40# Liner", "sA": "5.25", "sAr": "15.125", "repeat": "15.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "123", "notes": "5.25X15.125"}, {"id": "AG1123", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.5", "sAr": "3", "repeat": "3.125", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "75", "notes": "2.5X3"}, {"id": "AG1124", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "1.75", "sAr": "3.875", "repeat": "4", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "1.75X3.875"}, {"id": "AG1125", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40# Liner", "sA": "2.25", "sAr": "2", "repeat": "2.125", "nA": "4", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "2.25X2"}, {"id": "AG1126", "shape": "Special Shape", "blankSize": "13\"", "cutTo": "1.2Mil Clear Liner", "sA": "5.25", "sAr": "1.875", "repeat": "2.125", "nA": "2", "nAr": "5.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "5.25X1.875"}, {"id": "AG1127", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "1.2Mil Clear Liner", "sA": "4.75", "sAr": "1.75", "repeat": "1.875", "nA": "2", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "4.75X1.75"}, {"id": "AG1128", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "1.2Mil Clear Liner", "sA": "3.75", "sAr": "1.25", "repeat": "1.375", "nA": "3", "nAr": "8.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "3.75X1.25"}, {"id": "AG1129", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "1.2Mil Clear Liner", "sA": "6", "sAr": "1.5", "repeat": "1.625", "nA": "2", "nAr": "8.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "104", "notes": "6X1.5"}, {"id": "AG1130", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "8.5", "sAr": "11", "repeat": "-", "nA": "1", "nAr": "1.0", "gapAr": "0.25", "gapA": "0", "cRad": "0", "gearTooth": "90", "notes": "8.5X11"}, {"id": "AG1131", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "40# Liner", "sA": "6.25", "sAr": "8.75", "repeat": "8.875", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "71", "notes": "6.25X8.75"}, {"id": "AG1132", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "40#", "sA": "2", "sAr": "2", "repeat": "2.125", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "68", "notes": "2X2"}, {"id": "AG1133", "shape": "Special Shape", "blankSize": "-", "cutTo": "40# Liner", "sA": "8.5", "sAr": "11", "repeat": "-", "nA": "2", "nAr": "8.0", "gapAr": "Custom", "gapA": "Custom", "cRad": "Custom", "gearTooth": "88", "notes": "8.5X11"}, {"id": "AG1134", "shape": "Special Shape", "blankSize": "-", "cutTo": "40# Liner", "sA": "8.5", "sAr": "11", "repeat": "-", "nA": "5", "nAr": "10.0", "gapAr": "Custom", "gapA": "Custom", "cRad": "Custom", "gearTooth": "89", "notes": "8.5X11"}, {"id": "AG1135", "shape": "Display Box", "blankSize": "10\"", "cutTo": "1-Pt. Cis Semi Gloss", "sA": "8", "sAr": "8.9687", "repeat": "9.125", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "1.563", "cRad": "Special Shape", "gearTooth": "73", "notes": "8X8.9687"}, {"id": "AG1136", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "1.625", "sAr": "11.375", "repeat": "11.5", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "92", "notes": "1.625X11.375"}, {"id": "AG1137", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.5Mil Kaft Liner", "sA": "4.375", "sAr": "11.5", "repeat": "11.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "4.375X11.5"}, {"id": "AG1139", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "2.3Mil Bopp 40# Sc Liner", "sA": "4.1875", "sAr": "9.5", "repeat": "9.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "77", "notes": "4.1875X9.5"}, {"id": "AG1140", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "2.3Mil Bopp 40# Sc Liner", "sA": "5.625", "sAr": "5.625", "repeat": "5.75", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0", "cRad": "Circle", "gearTooth": "92", "notes": "5.625X5.625"}, {"id": "AG1141", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "10Pt. Semi Gloss", "sA": "6.5", "sAr": "5.25", "repeat": "5.375", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.25", "gearTooth": "86", "notes": "6.5X5.25"}, {"id": "AG1142", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "1Mil Clear Bopp/1.2Mil Liner", "sA": "2.25", "sAr": "1.875", "repeat": "2", "nA": "4", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "2.25X1.875"}, {"id": "AG1143", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "1Mil Clear Bopp/1.2Mil Liner", "sA": "4.1813", "sAr": "1.875", "repeat": "2.125", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "85", "notes": "4.1813X1.875"}, {"id": "AG1144", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.3 Ml White Bopp / 40# Liner", "sA": "1.75", "sAr": "3.875", "repeat": "4", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "96", "notes": "1.75X3.875"}, {"id": "AG1145", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.3 Ml White Bopp / 40# Liner", "sA": "2", "sAr": "2.375", "repeat": "2.5", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "2X2.375"}, {"id": "AG1146", "shape": "Square", "blankSize": "10\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.625", "sAr": "9", "repeat": "9.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "73", "notes": "3.625X9"}, {"id": "AG1147", "shape": "Square", "blankSize": "750 Webtron", "cutTo": "2.3 Ml White Bopp / 40# Liner", "sA": "6", "sAr": "6", "repeat": "6.125", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "6X6"}, {"id": "AG1148", "shape": "Square", "blankSize": "751 Webtron", "cutTo": "25 Ml White Thermal Transfer / 40# Liner", "sA": "2.75", "sAr": "5", "repeat": "5.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "82", "notes": "2.75X5"}, {"id": "AG1149", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 2.5Mil Liner", "sA": "3.5", "sAr": "3.875", "repeat": "4", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "3.5X3.875"}, {"id": "AG1150", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 40#", "sA": "0.8125", "sAr": "7", "repeat": "7.125", "nA": "6", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": "0.8125X7"}, {"id": "AG1151", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 40#", "sA": "0.625", "sAr": "4.875", "repeat": "4.875", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "0.625X4.875"}, {"id": "AG1152", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 40#", "sA": "1.6875", "sAr": "4.125", "repeat": "4.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "68", "notes": "1.6875X4.125"}, {"id": "AG1153", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 40#", "sA": "2.75", "sAr": "4", "repeat": "4.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "2.75X4"}, {"id": "AG1154", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 40#", "sA": "0.625", "sAr": "6.5", "repeat": "6.625", "nA": "5", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "54", "notes": ".625X6.5"}, {"id": "AG1155", "shape": "Rectangle", "blankSize": "750Wbetron", "cutTo": "2 Mil Metalized Bopp/ 40#", "sA": "3", "sAr": "7", "repeat": "7", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": "3X7"}, {"id": "AG1156", "shape": "Square", "blankSize": "750 Webtron", "cutTo": "2 Ml Metalized Bopp/ 2.5 Mil Liner", "sA": "1.5", "sAr": "3.75", "repeat": "3.875", "nA": "3", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "1.5X3.75"}, {"id": "AG1157", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.3 Ml White Bopp / 40# Liner", "sA": "2.3125", "sAr": "9.25", "repeat": "9.375", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "75", "notes": "2.3125X9.25"}, {"id": "AG1158", "shape": "Rectangle", "blankSize": "13'", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "2.625", "sAr": "13.625", "repeat": "13.75", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "2.625X13.625"}, {"id": "AG1159", "shape": "Perf/ Sheeter", "blankSize": "11\"", "cutTo": "Metal To Metal", "sA": "0", "sAr": "11", "repeat": "11", "nA": "0", "nAr": "1.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "88", "notes": "16"}, {"id": "AG1160", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mil/ 40# Liner", "sA": "2.5", "sAr": "7", "repeat": "7.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "2.5X7"}, {"id": "AG1161", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2 Mil/ 40# Liner", "sA": "1.5", "sAr": "0.375", "repeat": "0.5", "nA": "2", "nAr": "10.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "40", "notes": "1.5X.375"}, {"id": "AG1162", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss/ 40# Liner", "sA": "3.125", "sAr": "14.875", "repeat": "15", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "3.125X14.875"}, {"id": "AG1163", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "40# Liner", "sA": "2.5", "sAr": "0.875", "repeat": "1", "nA": "1", "nAr": "5.0", "gapAr": "0", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "40", "notes": "2.5X.875"}, {"id": "AG1164", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "2.8314", "sAr": "13.2434", "repeat": "13.5", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.2566", "cRad": "0.125", "gearTooth": "108", "notes": "2.8314X13.2434"}, {"id": "AG1165", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1", "sAr": "1", "repeat": "1.125", "nA": "3", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.15625", "gearTooth": "54", "notes": "1X1"}, {"id": "AG1166", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": ".18 Pt", "sA": "2.0625", "sAr": "3.375", "repeat": "3.5", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "56", "notes": "2.0625X3.375"}, {"id": "AG1167", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "10Pt.", "sA": "5.625", "sAr": "3", "repeat": "3.125", "nA": "1", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.25", "gearTooth": "75", "notes": "5.625X3"}, {"id": "AG1168", "shape": "Special Shape", "blankSize": "16\"", "cutTo": "Semi Gloss 40# Liner", "sA": "7.3535", "sAr": "12.8067", "repeat": "13", "nA": "2", "nAr": "1.0", "gapAr": "0.1933", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "104", "notes": "7.3535X12.8067"}, {"id": "AG1169", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mil Metallize / 40#-2.5 Mil", "sA": "4", "sAr": "5.625", "repeat": "5.75", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "92", "notes": "4X5.625"}, {"id": "AG1170", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Semi Gloss", "sA": "0.875", "sAr": "4", "repeat": "4.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0156", "gearTooth": "66", "notes": "0.875X4"}, {"id": "AG1171", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Semi Gloss", "sA": "0.75", "sAr": "3.5", "repeat": "3.625", "nA": "6", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "58", "notes": "0.75X3.5"}, {"id": "AG1172", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40# Semi Gloss", "sA": "0.625", "sAr": "3", "repeat": "3.125", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.78125", "gearTooth": "75", "notes": "0.625X3"}, {"id": "AG1173", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mil Clear / 40#-1.2Mil Clear", "sA": "4.5", "sAr": "7", "repeat": "7.25", "nA": "3", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "4.5X7"}, {"id": "AG1174", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "3 Mil Clear / 40#-1.2Mil Clear", "sA": "6.5", "sAr": "7", "repeat": "7.5", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "6.5X7"}, {"id": "AG1175", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "Semi Gloss 40# Liner", "sA": "3.25", "sAr": "2.25", "repeat": "2.375", "nA": "2", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "76", "notes": "3.25X2.25"}, {"id": "AG1176", "shape": "Special Shape", "blankSize": "750Webtron", "cutTo": "Metal To Metal", "sA": "4.75", "sAr": "6.5", "repeat": "6.5", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "52", "notes": "4.75X6.5"}, {"id": "AG1177", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40 # White Liner", "sA": "2", "sAr": "6", "repeat": "6.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "49", "notes": "2X6"}, {"id": "AG1178", "shape": "Knife Cut", "blankSize": "10\"", "cutTo": "40# Liner", "sA": "10", "sAr": "4.5", "repeat": "4.5", "nA": "0", "nAr": "0.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "72", "notes": "10X4.5"}, {"id": "AG1179", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mil Clear / 40#-1.2Mil Clear", "sA": "6", "sAr": "7", "repeat": "7.25", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "116", "notes": "6X7"}, {"id": "AG1180", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "54# Semmi Gloss / 40# Liner", "sA": "2.434", "sAr": "8", "repeat": "8.125", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "10\"", "notes": "2.434X8"}, {"id": "AG1181", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mil Clea Bopp/1.2 Mil Clear Liner", "sA": "6.5", "sAr": "7.875", "repeat": "8", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "6.5X7.875"}, {"id": "AG1182", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40 # White Liner", "sA": "5.8125", "sAr": "7.5", "repeat": "8", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "64", "notes": "5.8125X7.5"}, {"id": "AG1183", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "Metal To Metal", "sA": "4.9375", "sAr": "4", "repeat": "4.25", "nA": "1", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "68", "notes": "4.9375X4"}, {"id": "AG1184", "shape": "Knife Cut", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40#", "sA": "1.625", "sAr": "0.6875", "repeat": "0.6875", "nA": "1", "nAr": "8.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "44", "notes": "1.625X.6875"}, {"id": "AG1185", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "40 # White Liner", "sA": "1.5", "sAr": "0.5", "repeat": "0.625", "nA": "1", "nAr": "8.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "40", "notes": "1.5X0.5"}, {"id": "AG1186", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40#", "sA": "3.25", "sAr": "9.375", "repeat": "9.625", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "77", "notes": "3.25X9.375"}, {"id": "AG1187", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40#", "sA": "1", "sAr": "3.75", "repeat": "3.875", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "1X3.75"}, {"id": "AG1188", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40#", "sA": "2.7", "sAr": "2.5\"", "repeat": "2.75", "nA": "2", "nAr": "3.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "66", "notes": "2.7X2.5"}, {"id": "AG1189", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "60# Semi Gloss / 40#", "sA": "3.5", "sAr": "2.5\"", "repeat": "2.75", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.015625", "gearTooth": "66", "notes": "3.5X2.5"}, {"id": "AG1190", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "60# Semi Gloss / 40#", "sA": "4.43", "sAr": "4.15", "repeat": "4.3125", "nA": "2", "nAr": "2.0", "gapAr": "0.1625", "gapA": "0.125", "cRad": "0", "gearTooth": "69", "notes": "4.43X4.15"}, {"id": "AG1191", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "60# Semi Gloss / 40#", "sA": "4.43", "sAr": "4.15", "repeat": "4.3125", "nA": "2", "nAr": "2.0", "gapAr": "0.1625", "gapA": "0.125", "cRad": "0.25", "gearTooth": "69", "notes": "4.43X4.15"}, {"id": "AG1192", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "60# Semi Gloss / 40#", "sA": "5.131", "sAr": "4.986", "repeat": "5.125", "nA": "2", "nAr": "2.0", "gapAr": "0.139", "gapA": "0.25", "cRad": "0", "gearTooth": "82", "notes": "5.131X4.986"}, {"id": "AG1193", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3Mil Bopp 40# Sc Liner", "sA": "1.75", "sAr": "4.5", "repeat": "4.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "1.75X4.5"}, {"id": "AG1194", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mil Bopp/ 40# 4.5 Mil Liner", "sA": "4.375", "sAr": "7.125", "repeat": "7.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "59", "notes": "4.375X7.125"}, {"id": "AG1195", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.3Mil Bopp 40# Sc Liner", "sA": "4.92", "sAr": "7.125", "repeat": "7.375", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "59", "notes": "4.92X7.125"}, {"id": "AG1196", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3Mil Bopp 40# Sc Liner", "sA": "2.25", "sAr": "2", "repeat": "2.125", "nA": "2", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "68", "notes": "2.25X2"}, {"id": "AG1197", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mill Bopp/1.2 Mil Pet Liner", "sA": "2", "sAr": "7", "repeat": "7.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "2X7"}, {"id": "AG1198", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "4.75", "sAr": "10.75", "repeat": "11", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "4.75X10.75"}, {"id": "AG1199", "shape": "Sheeter", "blankSize": "10\"", "cutTo": "Metal To Metal", "sA": "8.5", "sAr": "11", "repeat": "11", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "0", "cRad": "Sheeter", "gearTooth": "88", "notes": "8.5X11"}, {"id": "AG1200", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "0.46875", "sAr": "2.375", "repeat": "2.5", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "60", "notes": "0.46875X2.375"}, {"id": "AG1201", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# White Liner", "sA": "0.85", "sAr": "7.38", "repeat": "7.625", "nA": "5", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.245", "cRad": "0.1875", "gearTooth": "61", "notes": ".85X7.38"}, {"id": "AG1202", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "6.5", "sAr": "15", "repeat": "15.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "121", "notes": "6.5X15"}, {"id": "AG1203", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.5", "sAr": "6.25", "repeat": "6.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.25", "gearTooth": "102", "notes": "3.5X6.25"}, {"id": "AG1204", "shape": "Special Shape", "blankSize": "750 Webtron-Journals Must Be 1\"", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "1.4489", "sAr": "4.9303", "repeat": "5.0625", "nA": "3", "nAr": "2.0", "gapAr": "0.1322", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "81", "notes": "1.4489X4.9303"}, {"id": "AG1205", "shape": "Sheeter", "blankSize": "16\"", "cutTo": "Metal To Metal", "sA": "16", "sAr": "15", "repeat": "15", "nA": "1", "nAr": "1.0", "gapAr": "0", "gapA": "0", "cRad": "0.015625", "gearTooth": "120", "notes": "16X15"}, {"id": "AG1206", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3 White Bopp/40# Sc Liner", "sA": "1.625", "sAr": "5.5", "repeat": "5.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "1.625X5.5"}, {"id": "AG1207", "shape": "Rectangle", "blankSize": "751 Webtron", "cutTo": "2.3 White Bopp/40# Sc Liner", "sA": "1.75", "sAr": "4", "repeat": "4.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "1.75X4"}, {"id": "AG1208", "shape": "Special Shape", "blankSize": "10\" Special", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "2.5", "sAr": "4.875", "repeat": "5", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "80", "notes": "2.5X4.875"}, {"id": "AG1209", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.5", "sAr": "7", "repeat": "7.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": "3.5X7"}, {"id": "AG1210", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3", "sAr": "5.25", "repeat": "5.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "86", "notes": "3X5.25"}, {"id": "AG1211", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "2.3Mil White Bopp/ 40# Liner", "sA": "3.875", "sAr": "2.625", "repeat": "2.75", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "66", "notes": "3.875X2.625"}, {"id": "AG1212", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "3.8125\"", "sAr": "2.5\"", "repeat": "2.625\"", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "63", "notes": "3.8125X2.5"}, {"id": "AG1213", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.65", "sAr": "7", "repeat": "7.125", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": "1.65X7"}, {"id": "AG1215", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.5", "sAr": "6.75", "repeat": "7", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "56", "notes": "3.5X6.75"}, {"id": "AG1216", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "0.75\"", "sAr": "4\"", "repeat": "4.125", "nA": "6", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "66", "notes": ".75X4"}, {"id": "AG1217", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# White Liner", "sA": "0.625", "sAr": "1.5625", "repeat": "1.6875", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "54", "notes": "0.625X1.5625"}, {"id": "AG1218", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# White Liner", "sA": "0.75", "sAr": "1.375", "repeat": "1.5", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "60", "notes": "0.75X1.375"}, {"id": "AG1219", "shape": "Rectangle", "blankSize": "751 Webtron", "cutTo": "2 Mil Clear Bopp / 1.2 Mil", "sA": "5.875", "sAr": "8.875", "repeat": "9", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "72", "notes": "5.875X8.875"}, {"id": "AG1220", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "2 Mil Clear Bopp / 1.2 Mil", "sA": "5", "sAr": "7", "repeat": "7.25", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "5X7"}, {"id": "AG1221", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "2.5", "sAr": "3.5", "repeat": "3.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "58", "notes": "2.5X3.5"}, {"id": "AG1222", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "2", "sAr": "8", "repeat": "8.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "2X8"}, {"id": "AG1223", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "54# Semi Gloss/ 40# Liner", "sA": "2.5\"", "sAr": "7.5\"", "repeat": "7.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "61", "notes": "2.5X7.5"}, {"id": "AG1224", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "0.3125", "sAr": "1", "repeat": "1.125", "nA": "2", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.126", "gearTooth": "54", "notes": "0.3125X1"}, {"id": "AG1225", "shape": "Special Shape", "blankSize": "11\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3", "sAr": "6.5", "repeat": "6.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "108", "notes": "3X6.5"}, {"id": "AG1226", "shape": "Special Shape", "blankSize": "10\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "2.6351", "sAr": "7.5", "repeat": "7.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "61", "notes": "2.6351X7.5"}, {"id": "AG1227", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3", "sAr": "6", "repeat": "6.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "3X6"}, {"id": "AG1228", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "104", "notes": "3.25X6.25"}, {"id": "AG1229", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2 Mill Bopp/1.2 Mil Clear Liner", "sA": "6.5", "sAr": "8.75", "repeat": "8.875", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "71", "notes": "6.5X8.75"}, {"id": "AG1230", "shape": "Special Shape", "blankSize": "11\" Modified", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "2.4207", "sAr": "7.5", "repeat": "7.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "61", "notes": "2.4207X7.5"}, {"id": "AG1231", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear", "sA": "5.5", "sAr": "13.25", "repeat": "13.5", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "108", "notes": "5.5X13.25"}, {"id": "AG1232", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "2.4Mil White Bopp / 40# White Liner", "sA": "5", "sAr": "17.375", "repeat": "17.5", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "5X17.375"}, {"id": "AG1233", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2Mil Bopp/1.2Mil Clear Liner", "sA": "4.5", "sAr": "6.75", "repeat": "6.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "4.5X6.75"}, {"id": "AG1234", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4Mil White Bopp / 40# White Liner", "sA": "4.5\"", "sAr": "14.375\"", "repeat": "14.5", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "4.5X14.375"}, {"id": "AG1235", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4Mil White Bopp / 40# White Liner", "sA": "2.125", "sAr": "6.75", "repeat": "7", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "56", "notes": "2.125X6.75"}, {"id": "AG1236", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4Mil White Bopp / 40# White Liner", "sA": "4.5", "sAr": "5.5", "repeat": "5.625", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0", "cRad": "0.125", "gearTooth": "90", "notes": "4.5X5.5"}, {"id": "AG1237", "shape": "Rectangle", "blankSize": "11", "cutTo": "2.3Mil White Bopp / 1.2Mil Clear Liner", "sA": "5.25", "sAr": "6.75", "repeat": "6.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "5.25X6.75"}, {"id": "AG1238", "shape": "Square", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.5", "sAr": "1.5", "repeat": "1.625", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "52", "notes": "1.5X1.5"}, {"id": "AG1239", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4Mil White Bopp / 40# White Liner", "sA": "3.25", "sAr": "11.5", "repeat": "11.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "3.25X11.5"}, {"id": "AG1240", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.25", "sAr": "1.25", "repeat": "1.625", "nA": "3", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "66", "notes": "1.25X1.25"}, {"id": "AG1241", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "6.75", "sAr": "9.875", "repeat": "10", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "6.75X9.875"}, {"id": "AG1242", "shape": "Rectangle", "blankSize": "14\"", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "6.5", "sAr": "8.75", "repeat": "8.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "71", "notes": "6.5X8.75"}, {"id": "AG1243", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "54# Semi Gloss/ 1.2Mil Clear Liner", "sA": "4.25", "sAr": "10.5", "repeat": "10.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "4.25X10.5"}, {"id": "AG1244", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "60# Semi Gloss / 40# White Liner", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3.25X6.25"}, {"id": "AG1245", "shape": "Special Shape", "blankSize": "10\" Ma", "cutTo": "2 Mil Bopp / 4.5 Mil White Kraft Liner", "sA": "6.5", "sAr": "14.72", "repeat": "15", "nA": "1", "nAr": "1.0", "gapAr": "0.28", "gapA": "0", "cRad": "0.015625", "gearTooth": "120", "notes": "6.5X14.72"}, {"id": "AG1246", "shape": "Rectangle", "blankSize": "10\" Comco", "cutTo": "2 Mill Clear Bopp W/1.2 Mill Clear Liner", "sA": "5.25", "sAr": "7.375", "repeat": "7.5", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "60", "notes": "5.25X7.375"}, {"id": "AG1247", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mil Bopp / 40 # Liner", "sA": "1.0277", "sAr": "0.8827", "repeat": "1.0209", "nA": "6", "nAr": "6.0", "gapAr": "0.1382", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "49", "notes": "1.0277X8827"}, {"id": "AG1248", "shape": "Rectangle", "blankSize": "10\" Comco", "cutTo": "2Mil Bopp / 1.2 Mil Clear Liner", "sA": "5", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "57", "notes": "5X7"}, {"id": "AG1249", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4", "sAr": "14.875", "repeat": "15", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "4X14.875"}, {"id": "AG1250", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.875", "sAr": "7.375", "repeat": "7.5", "nA": "6", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "60", "notes": "1.875X7.375"}, {"id": "AG1251", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "2.625", "sAr": "9", "repeat": "9.25", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.015625", "gearTooth": "74", "notes": "2.625X9"}, {"id": "AG1252", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "60# Semi Gloss / 40# White Liner", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3.25X6.25"}, {"id": "AG1253", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "1.25", "sAr": "2.5", "repeat": "2.625", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "63", "notes": "1.25X2.5"}, {"id": "AG1254", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "1.375", "sAr": "2.5", "repeat": "2.625", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "84", "notes": "1.375X2.5"}, {"id": "AG1255", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3 Mill Bopp / 40# Liner", "sA": "2", "sAr": "4", "repeat": "4.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "2X4"}, {"id": "AG1256", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.25", "sAr": "1", "repeat": "1.125", "nA": "2", "nAr": "7.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "63", "notes": "1.25X1"}, {"id": "AG1257", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "2.85", "sAr": "3.75", "repeat": "4", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "2.85X3.75"}, {"id": "AG1258", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "2.75", "sAr": "4.75", "repeat": "4.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "2.75X4.75"}, {"id": "AG1259", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "1.75", "sAr": "4", "repeat": "4.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "1.75X4"}, {"id": "AG1260", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "1.25", "sAr": "5", "repeat": "5.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "41", "notes": "1.25X5"}, {"id": "AG1261", "shape": "Oval", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40#", "sA": "2", "sAr": "4", "repeat": "4.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "66", "notes": "2X4"}, {"id": "AG1262", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2 Mil Clear / 40#-1.2Mil Clear", "sA": "6", "sAr": "7", "repeat": "7.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0", "cRad": "0.015625", "gearTooth": "57", "notes": "6X7"}, {"id": "AG1263", "shape": "Rectangle", "blankSize": "Modified Webtron 750", "cutTo": "60# Semi Gloss / 40#", "sA": "1.1875", "sAr": "2.75", "repeat": "2.875", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "46", "notes": "1.1875X2.75"}, {"id": "AG1264", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3", "sAr": "4", "repeat": "4.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "3X4"}, {"id": "AG1265", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2 Mil Bopp / 40# Liner", "sA": "1.75", "sAr": "11.5", "repeat": "11.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "1.75X11.5"}, {"id": "AG1266", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "2 Mil Bopp / 40# Liner", "sA": "3.25", "sAr": "3.25", "repeat": "3.375", "nA": "1", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "81", "notes": "3.25X3.25"}, {"id": "AG1267", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "5", "sAr": "11.625", "repeat": "11.75", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "94", "notes": "5X11.625"}, {"id": "AG1268", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.5", "sAr": "0.5", "repeat": "0.625", "nA": "1", "nAr": "8.0", "gapAr": "0.125", "gapA": "0", "cRad": "Special Shape", "gearTooth": "40", "notes": "1.5X0.5"}, {"id": "AG1269", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "4.5", "sAr": "11.5", "repeat": "11.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "4.5X11.5"}, {"id": "AG1270", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.5", "sAr": "3", "repeat": "3.125", "nA": "2", "nAr": "3.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "1.5X3"}, {"id": "AG1271", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "2", "sAr": "3.75", "repeat": "3.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "62", "notes": "2X3.75"}, {"id": "AG1272", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4", "sAr": "3", "repeat": "3.125", "nA": "1", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "75", "notes": "4X3"}, {"id": "AG1273", "shape": "Rectangle", "blankSize": "16\" Modified Blank", "cutTo": "2 Mil Clear Bopp / 1.2 Mil", "sA": "5", "sAr": "7", "repeat": "7.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "114", "notes": "5X7"}, {"id": "AG1274", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.3Mil White Bopp / 1.2Mil Clear Liner", "sA": "3.25", "sAr": "11", "repeat": "11.125", "nA": "4", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "3.25X11"}, {"id": "AG1275", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.3Mil White Bopp / 1.2Mil Clear Liner", "sA": "4.065", "sAr": "10.75", "repeat": "11", "nA": "3", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "4.065X10.75"}, {"id": "AG1276", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "1.125", "sAr": "2.125", "repeat": "2.25", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "54", "notes": "1.125X2.125"}, {"id": "AG1277", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2 Mill Bopp/1.2 Mil Clear Liner", "sA": "6.25", "sAr": "7.5", "repeat": "7.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "61", "notes": "6.25X7.5"}, {"id": "AG1278", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.3 White Bopp / 40 # Liner", "sA": "4.5", "sAr": "4.5", "repeat": "4.625", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "74", "notes": "4.5X4.5"}, {"id": "AG1279", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "1.75", "sAr": "4.75", "repeat": "4.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "1.75X4.75"}, {"id": "AG1280", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4Mil White Bopp / 40# Liner", "sA": "1.5", "sAr": "3.5", "repeat": "3.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "1.125", "cRad": "0.125", "gearTooth": "58", "notes": "1.5X3.5"}, {"id": "AG1281", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "543 Semi Gloss / 1.2 Mil Clear", "sA": "3.75", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "3.75X8"}, {"id": "AG1282", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2Mil Clear Bopp / 1.2Mil Clear Liner", "sA": "7.75", "sAr": "8.75", "repeat": "9", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "72", "notes": "7.75X8.75"}, {"id": "AG1283", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2 Mil Metallized / 40# Bg Liner", "sA": "3", "sAr": "4.75", "repeat": "4.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "3X4.75"}, {"id": "AG1284", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.75", "sAr": "4.75", "repeat": "4.875", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "3.75X4.75"}, {"id": "AG1285", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.75", "sAr": "4.75", "repeat": "4.875", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "3.75X4.75"}, {"id": "AG1286", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil Bopp / 40# Liner", "sA": "5", "sAr": "14.875", "repeat": "15", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "5X14.875"}, {"id": "AG1287", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3.25", "sAr": "11.5", "repeat": "11.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "3.25X11.5"}, {"id": "AG1288", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 40# Liner", "sA": "5", "sAr": "14.875", "repeat": "15", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "5X14.875"}, {"id": "AG1289", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4.625", "sAr": "15", "repeat": "15.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "4.625X15"}, {"id": "AG1290", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "8", "sAr": "15", "repeat": "15.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "8X15"}, {"id": "AG1291", "shape": "Perf.", "blankSize": "10\" Mark Andy", "cutTo": "High Shrink Pvc", "sA": "4.625", "sAr": "4.25", "repeat": "4.25", "nA": "1", "nAr": "2.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "68", "notes": "4.625X4.25"}, {"id": "AG1292", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "3", "sAr": "6", "repeat": "6.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "49", "notes": "3X6"}, {"id": "AG1293", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4", "sAr": "9.3125", "repeat": "9.5", "nA": "3", "nAr": "2.0", "gapAr": "1.4687", "gapA": "0.125", "cRad": "0", "gearTooth": "0", "notes": "4X9.3125"}, {"id": "AG1294", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "5.5", "sAr": "1.75", "repeat": "1.875", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "75", "notes": "5.5X1.75"}, {"id": "AG1295", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4", "sAr": "6.75", "repeat": "6.875", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "0", "notes": "4X6.75"}, {"id": "AG1296", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4", "sAr": "7.625", "repeat": "7.75", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "0", "notes": "4X7.625"}, {"id": "AG1297", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2Mil Bopp / 1.2 Mil Clear Liner", "sA": "5.5", "sAr": "1.75", "repeat": "1.875", "nA": "2", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "5.5X1.75"}, {"id": "AG1298", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4.0196", "sAr": "7.25", "repeat": "7.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "0", "notes": "4.0196X7.25"}, {"id": "AG1299", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.5Mil Polyolefin / 40# Liner", "sA": "6", "sAr": "6.375", "repeat": "6.5", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "0", "notes": "6X6.375"}, {"id": "AG1300", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "0.3125", "sAr": "2.8125", "repeat": "2.9375", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "94", "notes": "0.3125X2.8125"}, {"id": "AG1301", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4", "sAr": "6.5", "repeat": "6.625", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "54", "notes": "4X6.5"}, {"id": "AG1302", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 40# Liner", "sA": "6", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "6X7"}, {"id": "AG1303", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 40# Liner", "sA": "6", "sAr": "8.75", "repeat": "8.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "6X8.75"}, {"id": "AG1304", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4Mil White Bopp / 40# White Liner", "sA": "6", "sAr": "8.75", "repeat": "8.875", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.015625", "gearTooth": "71", "notes": "6X8.75"}, {"id": "AG1305", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp / 40# Liner -White Liner", "sA": "1.5", "sAr": "3.5", "repeat": "3.625", "nA": "7", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "87", "notes": "1.5X3.5"}, {"id": "AG1306", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp / 40# Liner", "sA": "3", "sAr": "5", "repeat": "5.125", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "3X5"}, {"id": "AG1307", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ 1.5 Lam", "sA": "2", "sAr": "2", "repeat": "2.25", "nA": "5", "nAr": "5.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "2X2"}, {"id": "AG1308", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Smi Gloss / 40# Liner", "sA": "0.75", "sAr": "3.25", "repeat": "3.375", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "54", "notes": ".75X3.25"}, {"id": "AG1309", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "10Pt C1S Semi Gloss", "sA": "4", "sAr": "3", "repeat": "3", "nA": "1", "nAr": "2.0", "gapAr": "0", "gapA": "0", "cRad": "0", "gearTooth": "48", "notes": "4X3"}, {"id": "AG1310", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4 Mil Bopp / 40 # Liner", "sA": "6", "sAr": "7", "repeat": "7.25", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "116", "notes": "6X7"}, {"id": "AG1311", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mil Clear /1.2Mil Clear", "sA": "6", "sAr": "7", "repeat": "7.25", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "116", "notes": "6X7"}, {"id": "AG1312", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 40# White Liner / .95 Mill Lamination", "sA": "4.375", "sAr": "15", "repeat": "15.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "121", "notes": "4.375X15"}, {"id": "AG1313", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lamination", "sA": "6", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "6X7"}, {"id": "AG1314", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lamination", "sA": "6", "sAr": "8.75", "repeat": "8.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "6X8.75"}, {"id": "AG1315", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /.95Mil Lamination", "sA": "4.3625", "sAr": "6.3125", "repeat": "6.4375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "103", "notes": "4.3625X6.3125"}, {"id": "AG1316", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3.25", "sAr": "7.375", "repeat": "7.5", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "3.25X7.375"}, {"id": "AG1317", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lamination", "sA": "2.75", "sAr": "9.35", "repeat": "9.5", "nA": "4", "nAr": "1.0", "gapAr": "0.15", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "76", "notes": "2.75X9.35"}, {"id": "AG1318", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /.95Mil Lamination", "sA": "5.82", "sAr": "7.5", "repeat": "7.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "122", "notes": "5.82X7.5"}, {"id": "AG1319", "shape": "Rectangle", "blankSize": "16\" Modified Blank", "cutTo": "2.4 Mil White Bopp / 1.2 Mil", "sA": "3", "sAr": "4", "repeat": "4.25", "nA": "5", "nAr": "3.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3X4"}, {"id": "AG1320", "shape": "Rectangle", "blankSize": "16\" Modified Blank", "cutTo": "2.4 Mil White Bopp / 1.2 Mil", "sA": "2.5", "sAr": "7", "repeat": "7.25", "nA": "5", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "2.5X7"}, {"id": "AG1321", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /.95Mil Lamination", "sA": "4.5", "sAr": "8.75", "repeat": "8.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "-", "notes": "4.5X8.75"}, {"id": "AG1322", "shape": "Circle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ .95 Lam", "sA": "2.125", "sAr": "2.125", "repeat": "2.25", "nA": "5", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "90", "notes": "2.125X2.125"}, {"id": "AG1323", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ .95 Lam", "sA": "3", "sAr": "7.5", "repeat": "7.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "122", "notes": "3X7.5"}, {"id": "AG1324", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ .95 Lam", "sA": "1.25", "sAr": "7.5", "repeat": "7.625", "nA": "8", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "122", "notes": "1.25X7.5"}, {"id": "AG1325", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ .95 Lam", "sA": "4", "sAr": "5.5", "repeat": "5.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "4X5.5"}, {"id": "AG1326", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /.95Mil Lam", "sA": "2.5", "sAr": "7", "repeat": "7.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "2.5X7"}, {"id": "AG1327", "shape": "Circle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "1.25", "sAr": "1.25", "repeat": "1.375", "nA": "3", "nAr": "8.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "88", "notes": "1.25X1.25"}, {"id": "AG1328", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /.95Mil Lam", "sA": "3", "sAr": "4", "repeat": "4.125", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "132", "notes": "3X4"}, {"id": "AG1329", "shape": "Rectangle", "blankSize": "16\" Modified", "cutTo": "2 Mill Clear Bopp W/1.2 Mill Clear Liner", "sA": "3", "sAr": "7", "repeat": "7.25", "nA": "4", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "3X7"}, {"id": "AG1330", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4Mil White Bopp/1.2Mill Clear Liner", "sA": "3.25", "sAr": "5", "repeat": "5.125", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "3.25X5"}, {"id": "AG1331", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4Mil White Bopp/1.2Mill Clear Liner", "sA": "3.25", "sAr": "3.75", "repeat": "3.875", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "3.25X3.75"}, {"id": "AG1332", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4Mil White Bopp/1.2Mill Clear Liner", "sA": "2.75", "sAr": "5", "repeat": "5.125", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "2.75X5"}, {"id": "AG1333", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4Mil White Bopp/1.2Mill Clear Liner", "sA": "1.65625", "sAr": "3.75", "repeat": "3.875", "nA": "8", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "1.65625X3.75"}, {"id": "AG1334", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp W/ 1.2Mil /1.5Mil Lam", "sA": "6", "sAr": "6.25", "repeat": "6.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "6X6.25"}, {"id": "AG1335", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ .95 Lam", "sA": "1.125", "sAr": "1.125", "repeat": "1.25", "nA": "2", "nAr": "9.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "1.125X1.125"}, {"id": "AG1336", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "2.75", "sAr": "7", "repeat": "7.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "2.75X7"}, {"id": "AG1337", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 40# Liner .95Mil Lam", "sA": "3", "sAr": "3.5", "repeat": "3.625", "nA": "4", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "145", "notes": "3X3.5"}, {"id": "AG1338", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4 Mill White Bopp / 1.2 Mil Clear Liner", "sA": "2.5", "sAr": "6.75", "repeat": "6.875", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "2.5X6.75"}, {"id": "AG1339", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "5", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": "5X8"}, {"id": "AG1340", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Clear Bopp W/ 1.2Mil /1.5Mil Lam", "sA": "3.25", "sAr": "3.5", "repeat": "3.625", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "3.25X3.5"}, {"id": "AG1341", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp W/ 1.2Mil /1.5Mil Lam", "sA": "2.75", "sAr": "5", "repeat": "5.125", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "2.75X5"}, {"id": "AG1342", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp W/ 1.2Mil /1.5Mil Lam", "sA": "2.8438", "sAr": "3.14", "repeat": "3.275", "nA": "4", "nAr": "5.0", "gapAr": "0.135", "gapA": "0.125", "cRad": "0.34375", "gearTooth": "131", "notes": "2.8438X3.14"}, {"id": "AG1343", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp W/ 1.2Mil /1.5Mil Lam", "sA": "1.125", "sAr": "5.45", "repeat": "5.625", "nA": "8", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.175", "cRad": "0.015625", "gearTooth": "135", "notes": "1.125X5.45"}, {"id": "AG1344", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.4 Mil Bopp / 40 # Liner", "sA": "4.3625", "sAr": "6.3125", "repeat": "6.5", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "104", "notes": "4.3625X6.3125"}, {"id": "AG1345", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Liner / 1.5Mil Sw Matte", "sA": "3.25", "sAr": "11.5", "repeat": "11.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "3.25X11.5"}, {"id": "AG1346", "shape": "Circle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Liner / .95Mil Sw Matte", "sA": "1.125", "sAr": "1.125", "repeat": "1.25", "nA": "3", "nAr": "9.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "93", "notes": "1.125X1.125"}, {"id": "AG1347", "shape": "Retangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp W/ 1.2Mil Liner /1.5Mil Lam", "sA": "2.25", "sAr": "6.25", "repeat": "6.375", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "2.25X6.25"}, {"id": "AG1348", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2 Mil Liner / 1.5 Lam", "sA": "3.5896", "sAr": "7.1692", "repeat": "7.375", "nA": "3", "nAr": "2.0", "gapAr": "0.2058", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "118", "notes": "3.5896X7.1692"}, {"id": "AG1349", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Liner / .95Millam", "sA": "2", "sAr": "4", "repeat": "4.125", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "99", "notes": "2X4"}, {"id": "AG1350", "shape": "Rectangle", "blankSize": "14\"", "cutTo": "2.4 Mil White Bopp / 1.2Mil Liner / 1.5Mil Lam", "sA": "5.82", "sAr": "7.5", "repeat": "7.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "61", "notes": "5.82X7.5"}, {"id": "AG1351", "shape": "Rectangle", "blankSize": "14\"", "cutTo": "2.4 Mil White Bopp / 40# Liner / 1.5Mil Lam", "sA": "3.5", "sAr": "5.4375", "repeat": "5.625", "nA": "3", "nAr": "2.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "3.5X5.4375"}, {"id": "AG1352", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2 Mil Liner / 1.5 Lam", "sA": "3.5", "sAr": "7", "repeat": "7.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "114", "notes": "3.5X7"}, {"id": "AG1353", "shape": "Rectangle", "blankSize": "14\"", "cutTo": "54# Semi Gloss / 40# Liner", "sA": "4.25", "sAr": "8.5", "repeat": "8.75", "nA": "3", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "70", "notes": "4.25X8.5"}, {"id": "AG1354", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "1.625", "sAr": "3.625", "repeat": "3.75", "nA": "6", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "1.625X3.625"}, {"id": "AG1355", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "0.965", "sAr": "8.5", "repeat": "8.625", "nA": "10", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "0.965X8.5"}, {"id": "AG1356", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "0.875", "sAr": "6.75", "repeat": "6.875", "nA": "12", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "0.875X6.75"}, {"id": "AG1357", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss/ 40# Liner", "sA": "3", "sAr": "6.5", "repeat": "6.75", "nA": "3", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "108", "notes": "3X6.5"}, {"id": "AG1358", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "5 Mil White Post Consumer / 44# Poly Kraft", "sA": "1.25", "sAr": "4.5", "repeat": "4.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "1.25X4.5"}, {"id": "AG1359", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mill White Bopp / 1.2 Mill Liner", "sA": "3.875", "sAr": "7.875", "repeat": "8", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "64", "notes": "3.875X7.875"}, {"id": "AG1360", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.3Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "5.5", "sAr": "13.25", "repeat": "13.5", "nA": "2", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "108", "notes": "5.5X13.25"}, {"id": "AG1361", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.5 Mill White Polyolefin / 40# Liner", "sA": "6", "sAr": "6.375", "repeat": "6.5", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "104", "notes": "6X6.375"}, {"id": "AG1362", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner", "sA": "0.5167", "sAr": "1", "repeat": "1.125", "nA": "5", "nAr": "10.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0156", "gearTooth": "90", "notes": "0.5167X1"}, {"id": "AG1363", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "3.5826", "sAr": "2.2047", "repeat": "2.35", "nA": "3", "nAr": "5.0", "gapAr": "0.1453", "gapA": "0.125", "cRad": "0", "gearTooth": "94", "notes": "3.5826X2.2047"}, {"id": "AG1364", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "2", "sAr": "4.375", "repeat": "4.5", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "108", "notes": "2X4.375"}, {"id": "AG1365", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "2.5", "sAr": "5.5", "repeat": "5.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "2.5X5.5"}, {"id": "AG1366", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner-Clear/ .95 Lam", "sA": "1.5", "sAr": "3.5", "repeat": "3.625", "nA": "7", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "87", "notes": "1.5X3.5"}, {"id": "AG1367", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "5", "sAr": "7.75", "repeat": "7.875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "126", "notes": "5X7.75"}, {"id": "AG1368", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner", "sA": "4", "sAr": "5", "repeat": "5.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "82", "notes": "4X5"}, {"id": "AG1369", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3.25X6.25"}, {"id": "AG1370", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3.25X6.25"}, {"id": "AG1337", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "3.375", "sAr": "9.125", "repeat": "0.25", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "3.375X9.125"}, {"id": "AG1372", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "5.25", "sAr": "10.125", "repeat": "10.25", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "82", "notes": "5.25X10.125"}, {"id": "AG1373", "shape": "Rectangle", "blankSize": "13\" Modified", "cutTo": "2.4 Mill White Bopp W/1.2Mil Clear Liner", "sA": "2.875", "sAr": "4.5", "repeat": "4.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "2.875X4.5"}, {"id": "AG1374", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "5.25", "sAr": "12.4375", "repeat": "12.5625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100.5", "notes": "5.25X12.4375"}, {"id": "AG1375", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mill White Bopp W/1.2Mil Clear Liner", "sA": "2.5", "sAr": "6.75", "repeat": "6.875", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "55", "notes": "2.5X6.75"}, {"id": "AG1376", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2Mil Clear Bopp W/1.2Mil Clear Liner", "sA": "2.5", "sAr": "3.75", "repeat": "3.875", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "2.5X3.75"}, {"id": "AG1377", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "4.25", "sAr": "6", "repeat": "6.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "4.25X6"}, {"id": "AG1378", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner", "sA": "4", "sAr": "6", "repeat": "6.125", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "147", "notes": "4X6"}, {"id": "AG1379", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner", "sA": "2.5", "sAr": "4", "repeat": "4.125", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "99", "notes": "2.5X4"}, {"id": "AG1380", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "2.5", "sAr": "6.75", "repeat": "6.875", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "2.5X6.75"}, {"id": "AG1381", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "5", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "5X7"}, {"id": "AG1382", "shape": "Rectangle", "blankSize": "Rectangle", "cutTo": "54# Semi Gloss / 40# White Liner", "sA": "2.8125", "sAr": "10.5", "repeat": "10.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "2.8125X10.5"}, {"id": "AG1383", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ 1.5 Lam", "sA": "3.5", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "130", "notes": "3.5X8"}, {"id": "AG1384", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "1.75", "sAr": "7.625", "repeat": "7.75", "nA": "6", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "124", "notes": "1.75X7.625"}, {"id": "AG1385", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "4.75", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": "4.75X8"}, {"id": "AG1386", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 40# Liner /1.5Mil Lam", "sA": "1.5", "sAr": "3.875", "repeat": "4", "nA": "7", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "128", "notes": "1.5X3.875"}, {"id": "AG1387", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "At20 / 40# Sck", "sA": "4", "sAr": "5.125", "repeat": "5.375", "nA": "1", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "86", "notes": "4X5.125"}, {"id": "AG1388", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "4.5", "sAr": "11.5", "repeat": "11.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "4.5X11.5"}, {"id": "AG1389", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "1.75", "sAr": "3.875", "repeat": "4", "nA": "6", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "128", "notes": "1.75X3.875"}, {"id": "AG1390", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "1.125", "sAr": "2.625", "repeat": "6.125", "nA": "7", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "1.125X2.625"}, {"id": "AG1391", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ .95 Lam", "sA": "2.6619", "sAr": "12.061", "repeat": "12.25", "nA": "4", "nAr": "1.0", "gapAr": "0.189", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "2.6619X12.061"}, {"id": "AG1392", "shape": "Circle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "3.5", "sAr": "3.5", "repeat": "3.625", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0", "gearTooth": "116", "notes": "3.5X3.5"}, {"id": "AG1393", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "2.75", "sAr": "7.5", "repeat": "7.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "122", "notes": "2.75X7.5"}, {"id": "AG1394", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "2.5", "sAr": "6.25", "repeat": "6.375", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "2.5X6.25"}, {"id": "AG1395", "shape": "Circle", "blankSize": "750 Webtron", "cutTo": "2.4 Mill White Bopp W/ 40# Liner", "sA": "2.125", "sAr": "2.125", "repeat": "2.25", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "72", "notes": "2.125X2.125"}, {"id": "AG1396", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mill White Bopp W/ 40# Liner", "sA": "1.25", "sAr": "7.5", "repeat": "7.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "125", "gearTooth": "61", "notes": "1.25X7.5"}, {"id": "AG1397", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "4.5", "sAr": "6", "repeat": "6.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "4.5X6"}, {"id": "AG1398", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "2.375", "sAr": "9.25", "repeat": "9.375", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "150", "notes": "2.375X9.25"}, {"id": "AG1399", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "3.375", "sAr": "9.125", "repeat": "9.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "3.375X9.125"}, {"id": "AG1400", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "3.75", "sAr": "9", "repeat": "9.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "146", "notes": "3.75X9"}, {"id": "AG1401", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "3.5", "sAr": "7.25", "repeat": "7.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "118", "notes": "3.5X7.25"}, {"id": "AG1402", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "2.6619", "sAr": "12.061", "repeat": "12.25", "nA": "4", "nAr": "1.0", "gapAr": "0.189", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "2.6619X12.061"}, {"id": "AG1403", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "3", "sAr": "7", "repeat": "7.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "3X7"}, {"id": "AG1404", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss", "sA": "1.1023", "sAr": "1.875", "repeat": "1.875", "nA": "5", "nAr": "3.0", "gapAr": "0", "gapA": "0.25", "cRad": "Special Shape", "gearTooth": "45", "notes": "1.1023X1.875"}, {"id": "AG1405", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "3.25", "sAr": "8.75", "repeat": "8.875", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "142", "notes": "3.25X8.75"}, {"id": "AG1406", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5 Lam", "sA": "3.875", "sAr": "7.875", "repeat": "8", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "128", "notes": "3.875X7.875"}, {"id": "AG1407", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "5", "sAr": "5.5", "repeat": "5.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "90", "notes": "5X5.5"}, {"id": "AG1408", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "0.3937", "sAr": "1.65625", "repeat": "1.78125", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "57", "notes": ".3937X1.65625"}, {"id": "AG1409", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Clear Bopp / 1.2Mil /1.5Mil Lamination", "sA": "6", "sAr": "7", "repeat": "7.25", "nA": "2", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "6X7"}, {"id": "AG1410", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5Mil Lam", "sA": "3.375", "sAr": "9.125", "repeat": "9.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "3.375X9.125"}, {"id": "AG1411", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5Mil Lam", "sA": "5.75", "sAr": "17", "repeat": "17.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "137", "notes": "5.75X17"}, {"id": "AG1412", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Clear Bopp / 1.2Mil /1.5Mil Lamination", "sA": "2.68", "sAr": "9.125", "repeat": "9.25", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "2.68X9.125"}, {"id": "AG1413", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lamination", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3.25X6.25"}, {"id": "AG1414", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2Mil Bopp / 1.2 Mil Clear Liner", "sA": "3.5", "sAr": "7", "repeat": "7.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "57", "notes": "3.5X7"}, {"id": "AG1415", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "1.9624", "sAr": "8.6632", "repeat": "8.875", "nA": "2", "nAr": "1.0", "gapAr": "0.2118", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "71", "notes": "1.9624X8.6632"}, {"id": "AG1416", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Liner/ 1.5 Lam", "sA": "0.511", "sAr": "8.6788", "repeat": "8.875", "nA": "3", "nAr": "1.0", "gapAr": "0.1962", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "71", "notes": ".511X8.6788"}, {"id": "AG1417", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5Mil Lam", "sA": "1.85", "sAr": "4.5", "repeat": "4.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "1.85X4.5"}, {"id": "AG1418", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.5Mil Polyolefin / 40# Liner / 1.5Mil Lam", "sA": "7", "sAr": "6.125", "repeat": "6.25", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "7X6.125"}, {"id": "AG1419", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5Mil Lam", "sA": "2", "sAr": "4.5", "repeat": "4.625", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "111", "notes": "2X4.5"}, {"id": "AG1420", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "54# Semi Gloss / 40# Linear", "sA": "4", "sAr": "8", "repeat": "8.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "4X8"}, {"id": "AG1421", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2Mil Clear Liner / 1.5 Mill Lamination", "sA": "4.375", "sAr": "15", "repeat": "15.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "121", "notes": "4.375X15"}, {"id": "AG1422", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp/ 1.2 Mil Clear Liner / 1.5Mil Lamination", "sA": "3", "sAr": "5", "repeat": "5.125", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "3X5"}, {"id": "AG1423", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Liner / 1.5 Mil Matte Lam", "sA": "2.5", "sAr": "4.0625", "repeat": "4.1875", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "134", "notes": "2.5X4.0625"}, {"id": "AG1424", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Liner / 1.5 Mil Matte Lam", "sA": "0.875", "sAr": "9", "repeat": "9.125", "nA": "10", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "146", "notes": ".875X9"}, {"id": "AG1425", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Matte Lam", "sA": "2.5", "sAr": "4.0625", "repeat": "4.1875", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "134", "notes": "2.5X4.0625"}, {"id": "AG1426", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Matte Lam", "sA": "0.875", "sAr": "9", "repeat": "9.125", "nA": "10", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "146", "notes": ".875X9"}, {"id": "AG1427", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /.95Mil Lam", "sA": "5", "sAr": "14.5", "repeat": "14.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "117", "notes": "5X14.5"}, {"id": "AG1428", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear / 1.5 Mil Sw", "sA": "0.75", "sAr": "9.47", "repeat": "9.625", "nA": "10", "nAr": "1.0", "gapAr": "0.155", "gapA": "0.125", "cRad": "0.125", "gearTooth": "77", "notes": "0.75X9.475"}, {"id": "AG1429", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2Mil Clear Liner / 1.5 Mill Lamination", "sA": "2", "sAr": "4.625", "repeat": "4.75", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "2X4.625"}, {"id": "AG1430", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / .95 Mil Sw Gloss", "sA": "3.25", "sAr": "7.25", "repeat": "7.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "118", "notes": "3.25X7.25"}, {"id": "AG1431", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill White Bopp / 1.2Mil Clear Liner / .95Mil Sw Matte", "sA": "2.4375", "sAr": "4.0625", "repeat": "4.1875", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "134", "notes": "2.4375X4.0625"}, {"id": "AG1432", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill White Bopp / 1.2Mil Clear Liner /1.5Mil Sw", "sA": "0.875", "sAr": "8", "repeat": "8.125", "nA": "10", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": ".875X8"}, {"id": "AG1433", "shape": "Speical Shape", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner", "sA": "2.5", "sAr": "4.0625", "repeat": "4.1875", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "134", "notes": "2.5X4.0625"}, {"id": "AG1434", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2 Mil Liner / .95 Mil Sw", "sA": "4.25", "sAr": "10.5", "repeat": "10.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "4.25X10.5"}, {"id": "AG1435", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Liner / .95Millam", "sA": "2.8125", "sAr": "10.5", "repeat": "10.625", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "170", "notes": "2.8125X10.5"}, {"id": "AG1436", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Liner / 1.5 Mil Matte Lam", "sA": "5", "sAr": "7.875", "repeat": "8", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "128", "notes": "5X7.875"}, {"id": "AG1437", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Clear Linear/ .95 Mil Sw Gloss", "sA": "2.8125", "sAr": "10.5", "repeat": "10.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "2.8125X10.5"}, {"id": "AG1438", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Clear Linear/ .7 Mil Soft Touch Matte", "sA": "3.875", "sAr": "8.25", "repeat": "8.375", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "134", "notes": "3.875X8.25"}, {"id": "AG1439", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3.25", "sAr": "6.25", "repeat": "6.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "3.25X6.25"}, {"id": "AG1440", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Clear Liner / .95 Mil Sw Matte", "sA": "2.75", "sAr": "5.5", "repeat": "5.625", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "135", "notes": "2.75X5.5"}, {"id": "AG1441", "shape": "Rectangle", "blankSize": "13\" Modified", "cutTo": "2 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "5", "sAr": "7.75", "repeat": "7.875", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "63", "notes": "5X7.75"}, {"id": "AG1442", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / .95 Mil Lam", "sA": "5", "sAr": "11", "repeat": "11.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "89", "notes": "5X11"}, {"id": "AG1443", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill White Bopp / 1.2 Mill Clear Liner / 1.5Mil Sw Matte", "sA": "3", "sAr": "4.75", "repeat": "4.875", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "117", "notes": "3X4.75"}, {"id": "AG1444", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / .95Mil Sw Matte", "sA": "2.75", "sAr": "4.75", "repeat": "4.875", "nA": "4", "nAr": "3.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "-", "notes": "2.75X4.75"}, {"id": "AG1445", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / .95Mil Sw Matte", "sA": "2.75", "sAr": "5.625", "repeat": "5.75", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "138", "notes": "2.75X5.625"}, {"id": "AG1446", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner", "sA": "3.875", "sAr": "8.25", "repeat": "8.5", "nA": "3", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "68", "notes": "3.875X8.25"}, {"id": "AG1447", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / .95Mil Sw Matte", "sA": "2.75", "sAr": "4.75", "repeat": "4.875", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "117", "notes": "2.75X4.75"}, {"id": "AG1448", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / 1.5Mil Sw Matte", "sA": "3.125", "sAr": "15", "repeat": "15.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "121", "notes": "3.125X15"}, {"id": "AG1449", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Clear Liner / .95 Mil Sw Gloss", "sA": "2.25", "sAr": "6.75", "repeat": "6.875", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "2.25X6.75"}, {"id": "AG1450", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp /40# Bg Liner / 1.5Mil Sw Matte", "sA": "0.875", "sAr": "8", "repeat": "8.125", "nA": "10", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": ".875X8"}, {"id": "AG1451", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "3.5", "sAr": "7.25", "repeat": "7.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "118", "notes": "3.5X7.25"}, {"id": "AG1452", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "60# White Paper Semi Gloss Elite", "sA": "1.1023", "sAr": "0.9453125", "repeat": "0.09453125", "nA": "3", "nAr": "16.0", "gapAr": "0", "gapA": "0.25", "cRad": "0", "gearTooth": "121", "notes": "1.1023X.9453125"}, {"id": "AG1453", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Clear Bopp / 1.2Mil /1.5Mil Lamination", "sA": "2.68", "sAr": "9.125", "repeat": "9.25", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "2.68X9.125"}, {"id": "AG1454", "shape": "Rectangle", "blankSize": "10\" Comco", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "2.68", "sAr": "9.125", "repeat": "9.25", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "2.68X9.125"}, {"id": "AG1455", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "1.5", "sAr": "4.5", "repeat": "4.625", "nA": "7", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "176", "notes": "1.5X4.5"}, {"id": "AG1456", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear / 1.5 Mil Sw Matte", "sA": "0.4375", "sAr": "5.5", "repeat": "5.625", "nA": "15", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "135", "notes": ".4375X5.5"}, {"id": "AG1457", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ 1.5 Lam", "sA": "1.625", "sAr": "7.5", "repeat": "7.625", "nA": "7", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "1.625X7.5"}, {"id": "AG1458", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "2.75", "sAr": "4.75", "repeat": "4.875", "nA": "4", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "2.75X4.75"}, {"id": "AG1459", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "1.5", "sAr": "3", "repeat": "3.125", "nA": "7", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "1.5X3"}, {"id": "AG1460", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "1.75", "sAr": "4", "repeat": "4.125", "nA": "6", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "1.75X4"}, {"id": "AG1461", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ 1.5 Lam", "sA": "1.25", "sAr": "5", "repeat": "5.125", "nA": "8", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "1.25X5"}, {"id": "AG1462", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3", "sAr": "7", "repeat": "7.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "3X7"}, {"id": "AG1463", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "2.75", "sAr": "9.5625", "repeat": "9.75", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.1875", "cRad": "0.015625", "gearTooth": "176", "notes": "2.75X9.5625"}, {"id": "AG1464", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "1.75", "sAr": "8.5", "repeat": "8.625", "nA": "6", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "1.75X8.5"}, {"id": "AG1465", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Silver Bopp / 1.2Mil /1.5Mil Lamination", "sA": "3.25", "sAr": "4.875", "repeat": "5", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "120", "notes": "3.25X4.875"}, {"id": "AG1466", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Silver Bopp / 1.2Mil /1.5Mil Lamination", "sA": "3.125", "sAr": "4.625", "repeat": "4.75", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "3.125X4.625"}, {"id": "AG1467", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White / 40# Liner / 1.5 Lam", "sA": "3.375", "sAr": "9.125", "repeat": "9.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "3.375X9.125"}, {"id": "AG1468", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "2.875", "sAr": "4.5", "repeat": "4.625", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "2.875X4.5"}, {"id": "AG1469", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "2.4375", "sAr": "6.25", "repeat": "6.375", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "176", "notes": "2.4375X6.25"}, {"id": "AG1470", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "2.75", "sAr": "4.5", "repeat": "4.625", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "2.75X4.5"}, {"id": "AG1471", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 40# Linear/ 1.5Mil Lamination", "sA": "2.8125", "sAr": "10.5", "repeat": "10.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "2.8125X10.5"}, {"id": "AG1472", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "0.375", "sAr": "2.5", "repeat": "2.625", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "42", "notes": ".375X2.5"}, {"id": "AG1473", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "2.4 Mil White Bopp / 40# Linear/ 1.5Mil Lamination", "sA": "1.25", "sAr": "4", "repeat": "4.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "1.25X4"}, {"id": "AG1474", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mill Clear Bopp W/1.2 Mill Clear Liner", "sA": "6", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "6X7"}, {"id": "AG1475", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "2.0625", "sAr": "6", "repeat": "6.125", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "147", "notes": "2.0625X6"}, {"id": "AG1476", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3.125", "sAr": "8.5", "repeat": "8.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "138", "notes": "3.125X8.5"}, {"id": "AG1477", "shape": "Circle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss /40# Liner/ .95 Lam", "sA": "1.5", "sAr": "1.5", "repeat": "1.625", "nA": "7", "nAr": "7.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "91", "notes": "1.5X1.5"}, {"id": "AG1478", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3.25", "sAr": "4.25", "repeat": "4.375", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "105", "notes": "3.25X4.25"}, {"id": "AG1479", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear/ 1.5Mil Lamination", "sA": "4.45", "sAr": "11.85", "repeat": "12", "nA": "2", "nAr": "1.0", "gapAr": "0.15", "gapA": "0.125", "cRad": "0.125", "gearTooth": "96", "notes": "4.45X11.85"}, {"id": "AG1480", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4 Mil White Bopp / 1.2 Mill Clear Liner", "sA": "2.25", "sAr": "11.5", "repeat": "11.625", "nA": "6", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "2.25X11.5"}, {"id": "AG1481", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4 Mil White Bopp / 1.2 Mill Clear Liner", "sA": "2.25", "sAr": "11.5", "repeat": "11.625", "nA": "6", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "93", "notes": "2.25X11.5"}, {"id": "AG1482", "shape": "Rectangle", "blankSize": "10\" Comco", "cutTo": "2.4 Mill White Bopp / 1.2 Mil Clear Liner", "sA": "2", "sAr": "6.75", "repeat": "6.875", "nA": "5", "nAr": "1.0", "gapAr": "12.5", "gapA": "0.125", "cRad": "0.125", "gearTooth": "55", "notes": "2X6.75"}, {"id": "AG1483", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear/ 1.5Mil Lamination", "sA": "2", "sAr": "5.5", "repeat": "5.625", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "135", "notes": "2Xx5.5"}, {"id": "AG1484", "shape": "Rectangle", "blankSize": "13''", "cutTo": "2Mil Metallized Bopp/1.2Mil Clear Liner", "sA": "6.5", "sAr": "15.125", "repeat": "15.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "123", "notes": "6X15.125"}, {"id": "AG1485", "shape": "Circle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear/ 1.5Mil Lamination", "sA": "3", "sAr": "3", "repeat": "3.125", "nA": "3", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "Circle", "notes": "3X3"}, {"id": "AG1486", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear/ 1.5Mil Lamination", "sA": "4.125", "sAr": "10.875", "repeat": "11", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "4.125X10.875"}, {"id": "AG1487", "shape": "Rectangle", "blankSize": "13'' Ma", "cutTo": "2Mil Wbopp/1.2Mil Clear Liner / 1Mil Lam", "sA": "4.25", "sAr": "11.5", "repeat": "11.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "93", "notes": "4.25X11.5"}, {"id": "AG1488", "shape": "Special Shape", "blankSize": "750 Webtron", "cutTo": "10Pt C1S Semi Gloss", "sA": "7.5 E To E", "sAr": "4", "repeat": "4", "nA": "1", "nAr": "2.0", "gapAr": "0", "gapA": "0", "cRad": "Na", "gearTooth": "64", "notes": "Edge To Edge 7.5X4"}, {"id": "AG1489", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Silver Bopp / 1.2Mil /1.5Mil Lamination", "sA": "6.125", "sAr": "8.25", "repeat": "8.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.0625", "gearTooth": "134", "notes": "6.125X8.25"}, {"id": "AG1490", "shape": "Rectangle", "blankSize": "13'' Ma", "cutTo": "2.4Mil White Bopp Tc / 1.2Mil Clear / 59G Matte Opp", "sA": "3.662", "sAr": "3.23", "repeat": "3.375", "nA": "3", "nAr": "4.0", "gapAr": "0.145", "gapA": "0.125", "cRad": "0.125", "gearTooth": "108", "notes": "3.662X3.23"}, {"id": "AG1491", "shape": "Rectangle", "blankSize": "750 Web", "cutTo": "2.4Mil White Bopp Tc / 1.2Mil Clear / 59G Matte Opp", "sA": "1.81", "sAr": "2.52", "repeat": "2.65625", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.13625", "cRad": "0.125", "gearTooth": "85", "notes": "1.81X2.52"}, {"id": "AG1492", "shape": "Rectangle", "blankSize": "750 Web", "cutTo": "2.4Mil White Bopp Tc / 1.2Mil Clear / 59G Matte Opp", "sA": "1.57", "sAr": "3.662", "repeat": "3.83334", "nA": "4", "nAr": "3.0", "gapAr": "0.17134", "gapA": "0.125", "cRad": "0.125", "gearTooth": "92", "notes": "1.57X3.662"}, {"id": "AG1493", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "4.625", "sAr": "15.25", "repeat": "15.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "4.625X15.25"}, {"id": "AG1494", "shape": "Rectangle", "blankSize": "10\" Comco", "cutTo": "2.4Mil White Bopp Tc / 1.2Mil Clear / 59G Matte Opp", "sA": "3.23", "sAr": "3.662", "repeat": "3.83335", "nA": "3", "nAr": "3.0", "gapAr": "0.17135", "gapA": "0.125", "cRad": "0.125", "gearTooth": "92.0004", "notes": "3.23X3.662"}, {"id": "AG1495", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner", "sA": "1.77", "sAr": "4.33", "repeat": "4.5", "nA": "5", "nAr": "4.0", "gapAr": "0.17", "gapA": "0.125", "cRad": "0.125", "gearTooth": "144", "notes": "1.77X4.33"}, {"id": "AG1496", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "5.25\"", "sAr": "12.375", "repeat": "12.5", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "5.25X12.375"}, {"id": "AG1497", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "2.75", "sAr": "11.5", "repeat": "11.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "2.75X11.5"}, {"id": "AG1498", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear/ 1.5Mil Lamination", "sA": "2.5", "sAr": "3", "repeat": "3.125", "nA": "4", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "125", "notes": "2.5X3"}, {"id": "AG1499", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp Tc / 1.2Mil Clear / 1.5Mil Lamination", "sA": "5.25", "sAr": "2.625", "repeat": "2.75", "nA": "2", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "5.25X2.625"}, {"id": "AG1500", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss/ 40# Liner / 1.5Mil Lamination", "sA": "5.25", "sAr": "2.625", "repeat": "2.75", "nA": "2", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "5.25X2.625"}, {"id": "AG1501", "shape": "Rectangle", "blankSize": "10''", "cutTo": "2Mil Clear Bopp / 1.2Mil Clear Liner", "sA": "6.875", "sAr": "10.625", "repeat": "10.75", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "86", "notes": "6.875X10.625"}, {"id": "AG1502", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner / 1.5 Mill Sw", "sA": "2.125", "sAr": "6.125", "repeat": "6.25", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "2.125X6.125"}, {"id": "AG1503", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner / 1.5 Mill Sw", "sA": "4.375", "sAr": "11.5", "repeat": "11.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "4.375X11.5"}, {"id": "AG1504", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner / 1.5 Mill Sw", "sA": "2.75", "sAr": "9.5625", "repeat": "9.75", "nA": "4", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "78", "notes": "4.375X11.5"}, {"id": "AG1505", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mil Clear Bopp / 1.2 Mil Clear Liner", "sA": "2.68", "sAr": "9.125", "repeat": "9.25", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "74", "notes": "2.68X9.125"}, {"id": "AG1506", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner / 1.5 Mill Sw", "sA": "12.125", "sAr": "12.25", "repeat": "12.375", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "99", "notes": "12.125X12.25"}, {"id": "AG1507", "shape": "Rectangle", "blankSize": "750", "cutTo": "60# White Paper / 1.2Mil Clear Liner", "sA": "2.375", "sAr": "7", "repeat": "2.5", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "57", "notes": "2.375X7"}, {"id": "AG1508", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "2.25", "sAr": "6.75", "repeat": "6.875", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "110", "notes": "2.25X6.75"}, {"id": "AG1509", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "3.75", "sAr": "4.3", "repeat": "4.4375", "nA": "3", "nAr": "4.0", "gapAr": "0.1375", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "142", "notes": "3.75X4.3"}, {"id": "AG1510", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "2.4", "sAr": "4", "repeat": "4.125", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "132", "notes": "2.4X4"}, {"id": "AG1511", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "3.85", "sAr": "5.6", "repeat": "5.75", "nA": "3", "nAr": "3.0", "gapAr": "0.15", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "138", "notes": "3.85X5.6"}, {"id": "AG1512", "shape": "Rectangle", "blankSize": "13\" Ma Modified", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "1.75", "sAr": "8.5", "repeat": "8.625", "nA": "5", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "69", "notes": "1.75X8.5"}, {"id": "AG1513", "shape": "Rectangle", "blankSize": "10''", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear Liner / .95G Matte Lamination", "sA": "2.75", "sAr": "7.5", "repeat": "7.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "61", "notes": "2.75X7.5"}, {"id": "AG1514", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / .95Mil Lamination", "sA": "5.25", "sAr": "4.8", "repeat": "4.95835", "nA": "2", "nAr": "3.0", "gapAr": "0.15835", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "119", "notes": "5.25X4.8"}, {"id": "AG1515", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "2.875", "sAr": "0.875", "repeat": "1", "nA": "4", "nAr": "11.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "88", "notes": "2.875X0.875"}, {"id": "AG1516", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear Liner / 1.5Mil Gloss Lamination", "sA": "6", "sAr": "8", "repeat": "8.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": "6X8"}, {"id": "AG1517", "shape": "Rectangle", "blankSize": "750", "cutTo": "60# White Paper / 1.2Mil Clear Liner", "sA": "2", "sAr": "5.5", "repeat": "5.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "90", "notes": "2X5.5"}, {"id": "AG1518", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / .95Mil Lamination", "sA": "3", "sAr": "8", "repeat": "8.125", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": "3X8"}, {"id": "AG1519", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "3", "sAr": "3", "repeat": "3.125", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "3X3"}, {"id": "AG1520", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5Mil Lamination", "sA": "6", "sAr": "10", "repeat": "10.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "81", "notes": "6X10"}, {"id": "AG1521", "shape": "Rectangle", "blankSize": "10'' Comco Modified", "cutTo": "2Mil Clear Bopp/1.2Mil Clear Liner/.95Mil Sw Gloss", "sA": "2", "sAr": "4.25", "repeat": "4.375", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "70", "notes": "2X4.25"}, {"id": "AG1522", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "1", "sAr": "1.25", "repeat": "1.375", "nA": "5", "nAr": "9.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "99", "notes": "1X1.25"}, {"id": "AG1523", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp / 1.2 Mil Liner / 1.5 Mil Sw Lam", "sA": "2", "sAr": "3.25", "repeat": "3.375", "nA": "5", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "108", "notes": "2X3.25"}, {"id": "AG1524", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp / 1.2 Mil Liner / 1.5 Mil Sw Lam", "sA": "4.46875", "sAr": "2.8125", "repeat": "2.95", "nA": "2", "nAr": "5.0", "gapAr": "0.1375", "gapA": "0.125", "cRad": "0.125", "gearTooth": "118", "notes": "4.46875X2.8125"}, {"id": "AG1525", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Soft Touch Lam", "sA": "0.75", "sAr": "3.875", "repeat": "4", "nA": "6", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "128", "notes": "0.75X3.875"}, {"id": "AG1526", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "2.875", "sAr": "6.875", "repeat": "-", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "22", "notes": "2.875X6.875"}, {"id": "AG1527", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "5.0217", "sAr": "2.3175", "repeat": "2.5", "nA": "2", "nAr": "5.0", "gapAr": "0.1825", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "100", "notes": "5.0217X2.3175"}, {"id": "AG1528", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner/ 1.5 Mil Sw Matte Lam", "sA": "5.5", "sAr": "4.25", "repeat": "4.375", "nA": "2", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "5.5X4.25"}, {"id": "AG1529", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Clear Liner/1.5Mil Sw Gloss Lam", "sA": "4", "sAr": "8", "repeat": "8.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.25", "cRad": "0.125", "gearTooth": "132", "notes": "4X8"}, {"id": "AG1530", "shape": "Rectangle", "blankSize": "Webtron 750", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner", "sA": "3", "sAr": "7.875", "repeat": "8", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "64", "notes": "3X7.875"}, {"id": "AG1531", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear / 1.5 Mil Sw", "sA": "2.9528", "sAr": "7.7165", "repeat": "7.875", "nA": "3", "nAr": "2.0", "gapAr": "0.1585", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "22", "notes": "2.9528X7.7165"}, {"id": "AG1532", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner / .95 Mil Gloss", "sA": "3.25", "sAr": "6.75", "repeat": "6.875", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "3.25X6.75"}, {"id": "AG1533", "shape": "Square", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1Mil Sw Lamination", "sA": "3.9375", "sAr": "3.9375", "repeat": "4.0625", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.6875", "gearTooth": "130", "notes": "3.9375X3.9375"}, {"id": "AG1534", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2 Mil Wbopp / 40# White Liner / .95Mil Gloss Lamination", "sA": "6", "sAr": "8.5", "repeat": "8.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "138", "notes": "6X8.5"}, {"id": "AG1535", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2 Mil Wbopp / 40# White Liner / .95Mil Gloss Lamination", "sA": "6.5", "sAr": "9.125", "repeat": "9.25", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "148", "notes": "6.5X9.125"}, {"id": "AG1536", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mill Lam", "sA": "2.0625", "sAr": "6.125", "repeat": "6.375", "nA": "3", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "51", "notes": "2.0625X9.125"}, {"id": "AG1537", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil Wbopp / 40# White Liner / .95Mil Sw Gloss", "sA": "4.357", "sAr": "7.25", "repeat": "7.325", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "118", "notes": "4.357X7.25"}, {"id": "AG1538", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil Wbopp / 40# White Liner / .95Mil Sw Gloss", "sA": "5.875", "sAr": "12.5", "repeat": "12.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "101", "notes": "5.875X12.5"}, {"id": "AG1539", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil Wbopp / 40# White Liner / .95Mil Sw Gloss", "sA": "4.375", "sAr": "9.625", "repeat": "9.75", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "4.375X9.625"}, {"id": "AG1540", "shape": "Rectangle", "blankSize": "13'' Ma", "cutTo": "2.4 Mil Clear Bopp/1.2Mil Liner / .95Mil Sw", "sA": "4", "sAr": "8", "repeat": "8.25", "nA": "3", "nAr": "1.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "4X8"}, {"id": "AG1541", "shape": "Circle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear Liner / 1.5Mil Sw", "sA": "2.25", "sAr": "2.25", "repeat": "2.375", "nA": "5", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "95", "notes": "2.25X2.25"}, {"id": "AG1542", "shape": "Special Shape", "blankSize": "13'' Ma", "cutTo": "2.3 Mil Clear Bopp / 1.2 Mil Clear Liner / .95 Mil", "sA": "2.9375", "sAr": "10.0625", "repeat": "10.25", "nA": "4", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "82", "notes": "2.9375X10.0625"}, {"id": "AG1543", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp / 1.2 Mil Liner / 1.5 Mil Lam", "sA": "5", "sAr": "10.25", "repeat": "10.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "83", "notes": "5X10.25"}, {"id": "AG1544", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2 Mill Metallized Bopp / 1.2 Mil Clear Liner / 1.5 Mil Lam", "sA": "4.5", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "4.5X7"}, {"id": "AG1545", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "2", "sAr": "5.75", "repeat": "5.875", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "94", "notes": "2X5.75"}, {"id": "AG1546", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "9", "sAr": "12", "repeat": "12.125", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "97", "notes": "9X12"}, {"id": "AG1547", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "2", "sAr": "4", "repeat": "4.125", "nA": "5", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "99", "notes": "2X4"}, {"id": "AG1548", "shape": "Rectangle", "blankSize": "Webtron 750", "cutTo": "2.4 Mil Bopp / 1.2 Mil Clear Liner / .95 Mil Gloss", "sA": "2.211", "sAr": "1.3052", "repeat": "1.45", "nA": "2", "nAr": "5.0", "gapAr": "0.1448", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "58", "notes": "2.211X1.3052"}, {"id": "AG1549", "shape": "Special Shape", "blankSize": "Webtron 750", "cutTo": "60# Semi Gloss/40# Liner/1.5 Mil", "sA": "4.25", "sAr": "7.625", "repeat": "7.875", "nA": "1", "nAr": "1.0", "gapAr": "0.25", "gapA": "0", "cRad": "Special Shape", "gearTooth": "63", "notes": "4.25X7.625"}, {"id": "AG1550", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2 Mil Liner / 1.5 Lam", "sA": "2.75", "sAr": "8.75", "repeat": "8.875", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "2.75X8.75"}, {"id": "AG1551", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "5", "sAr": "10.25", "repeat": "10.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "83", "notes": "5X10.25"}, {"id": "AG1552", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Bopp / 1.2 Mil Liner / 1.5 Lam", "sA": "5.5", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "5.5X7"}, {"id": "AG1553", "shape": "Special Shape", "blankSize": "Webtron 750", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "1.9375", "sAr": "4.0625", "repeat": "4.25", "nA": "3", "nAr": "2.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "68", "notes": "1.9375X4.0625"}, {"id": "AG1554", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill Bopp / 1.2 Mil Liner / 1.5 Mil Lam", "sA": "1.25", "sAr": "2.5", "repeat": "2.635", "nA": "8", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "105", "notes": "1.25X2.5"}, {"id": "AG1555", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "3.5 Mil White Polyolefin / 44# Pk / 1.5 Mil Lam", "sA": "4.46875", "sAr": "2.8125", "repeat": "2.95", "nA": "2", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.1375", "cRad": "Special Shape", "gearTooth": "118", "notes": "4.46875X2.8125"}, {"id": "AG1556", "shape": "Rectangle", "blankSize": "10'' Comco Modified", "cutTo": "54# Semi Gloss / 40# White Liner", "sA": "2.8125", "sAr": "10.5", "repeat": "10.625", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "2.8125X10.5"}, {"id": "AG1557", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear Liner / 1.5Mil Lamination", "sA": "2", "sAr": "6.75", "repeat": "6.875", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "110", "notes": "2X6.75"}, {"id": "AG1558", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4 Mil Bopp / 1.2 Mil Liner", "sA": "3.6875", "sAr": "9.1875", "repeat": "9.375", "nA": "3", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.125", "gearTooth": "75", "notes": "3.6875X9.1875"}, {"id": "AG1559", "shape": "Circle", "blankSize": "Flexible", "cutTo": "2.4Mil Bopp / 1.2Mil Liner / 1.5Mil Lam", "sA": "4.25", "sAr": "4.25", "repeat": "4.375", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "105", "notes": "4.25X4.25"}, {"id": "AG1560", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil Bopp / 1.2Mil Liner / 1.5Mil Lam", "sA": "4.25", "sAr": "15.25", "repeat": "15.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "4.25X15.25"}, {"id": "AG1561", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Liner / 1.5 Mil Lam", "sA": "4.6884", "sAr": "2.8948", "repeat": "3.025", "nA": "2", "nAr": "5.0", "gapAr": "0.1302", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "118", "notes": "4.6684X2.8948"}, {"id": "AG1562", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear Liner / 1.5Mil Lamination", "sA": "5.97", "sAr": "7.38", "repeat": "7.5625", "nA": "2", "nAr": "2.0", "gapAr": "0.1825", "gapA": "0.125", "cRad": "0.125", "gearTooth": "121", "notes": "5.97X7.38"}, {"id": "AG1563", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear Liner / 1.5Mil Lamination", "sA": "4.5", "sAr": "5.5", "repeat": "5.625", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "135", "notes": "4.5X5.5"}, {"id": "AG1564", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil Liner / 1.5Mil Lamination", "sA": "6.5", "sAr": "9.625", "repeat": "9.75", "nA": "1", "nAr": "1.0", "gapAr": "0.125", "gapA": "0", "cRad": "0.125", "gearTooth": "-", "notes": "6.5X9.625"}, {"id": "AG1565", "shape": "Rectangle", "blankSize": "Webtron 750", "cutTo": "60# Semi Gloss / 40# Liner", "sA": "1.25", "sAr": "14", "repeat": "14.125", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "113", "notes": "1.25X14"}, {"id": "AG1566", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill / 40# Liner / 1.5 Mil Lam", "sA": "3.5", "sAr": "10", "repeat": "10.125", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "81", "notes": "3.5X10"}, {"id": "AG1567", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 40# Liner / 1.5 Mil", "sA": "1.75", "sAr": "11", "repeat": "11.1", "nA": "6", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "89", "notes": "1.75X11"}, {"id": "AG1568", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Clear Liner/1.5Mil Gloss Lam", "sA": "5.4375", "sAr": "7.6875", "repeat": "7.8125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "125", "notes": "5.4375X7.6875"}, {"id": "AG1569", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Clear Liner/1.5Mil Gloss Lam", "sA": "4.5", "sAr": "5.44", "repeat": "5.58335", "nA": "2", "nAr": "3.0", "gapAr": "0.1434", "gapA": "0.125", "cRad": "0.125", "gearTooth": "134.004", "notes": "4.5X5.44"}, {"id": "AG1570", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp/1.2Mil Clear Liner/1.5Mil Gloss Lam", "sA": "4.7", "sAr": "5.8", "repeat": "6", "nA": "2", "nAr": "2.0", "gapAr": "0.2", "gapA": "0.125", "cRad": "0.125", "gearTooth": "96", "notes": "4.7X5.8"}, {"id": "AG1571", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2Mil Liner / .85Mil Lam", "sA": "3.5", "sAr": "6.875", "repeat": "7", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "112", "notes": "3.5X6.875"}, {"id": "AG1572", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mill White Bopp / 1.2 Mil Clear Liner / 1.5 Mil Lam", "sA": "1.5", "sAr": "4", "repeat": "4.125", "nA": "7", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "132", "notes": "1.5X4.5"}, {"id": "AG1573", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "3", "sAr": "11.5", "repeat": "11.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "3X11.5"}, {"id": "AG1574", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2Mil Liner / 1.5 Mil Lam", "sA": "3.5", "sAr": "7.5", "repeat": "7.625", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "122", "notes": "3.5X7.5"}, {"id": "AG1575", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss / 1.2Mil Liner / 1.5Mil Lam", "sA": "1.1", "sAr": "4.25", "repeat": "4.375", "nA": "4", "nAr": "4.25", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "105", "notes": "1.1X4.25"}, {"id": "AG1576", "shape": "Special Shape", "blankSize": "13\"", "cutTo": "2.4Mil White Bopp / 1.2Mil Clear Liner", "sA": "4.816", "sAr": "3.334", "repeat": "3.5", "nA": "2", "nAr": "4.0", "gapAr": "0.166", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "112", "notes": "4.816X3.334"}, {"id": "AG1577", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 1.2 Mil Liner / 1.5 Mil Lam", "sA": "2.75", "sAr": "8.625", "repeat": "8.75", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "2.75X8.625"}, {"id": "AG1578", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "1.5", "sAr": "7.25", "repeat": "7.375", "nA": "7", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "118", "notes": "1.5X7.25"}, {"id": "AG1579", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "4.75", "sAr": "10.75", "repeat": "10.875", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "87", "notes": "4.75X10.75"}, {"id": "AG1580", "shape": "Special Shape", "blankSize": "13\"", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "4.7637", "sAr": "3.4645", "repeat": "3.6", "nA": "2", "nAr": "5.0", "gapAr": "0.1355", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "144", "notes": "4.7637X3.4645 (Front)"}, {"id": "AG1581", "shape": "Special Shape", "blankSize": "13\"", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "4.7637", "sAr": "3.4645", "repeat": "3.6", "nA": "2", "nAr": "5.0", "gapAr": "0.1355", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "144", "notes": "4.7637X3.4645 (Back)"}, {"id": "AG1582", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner", "sA": "1.8125", "sAr": "8.75", "repeat": "8.875", "nA": "6", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "142", "notes": "1.8125X8.75"}, {"id": "AG1583", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2 Mil Metallized Bopp / 1.2 Mil Clear Liner / .95 Mil Lam", "sA": "2.5", "sAr": "8", "repeat": "8.125", "nA": "4", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "65", "notes": "2.5X8"}, {"id": "AG1584", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / 1.5Mil Lm", "sA": "2.3125", "sAr": "5.25", "repeat": "5.375", "nA": "5", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "86", "notes": "2.3125X5.25"}, {"id": "AG1585", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "350 Primax / 44Pk Liner / 1.5 Mil Lam", "sA": "1.875", "sAr": "9.6875", "repeat": "9.875", "nA": "6", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "79", "notes": "1.875X9.6875"}, {"id": "AG1586", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / 1.5Mil Lm", "sA": "5.5", "sAr": "5.75", "repeat": "5.875", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "141", "notes": "5.5X5.75"}, {"id": "AG1587", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear Liner / 1.5Mil Lm", "sA": "4.25", "sAr": "11.5", "repeat": "11.625", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "4.25X11.5"}, {"id": "AG1588", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2 Mil Metalized Bopp/40# White Kraft / 1.5Mil Lm", "sA": "2.75", "sAr": "4.25", "repeat": "4.375", "nA": "4", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "140", "notes": "2.75X4.25"}, {"id": "AG1589", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss /40# Liner / 1.5Mil Lm", "sA": "6", "sAr": "6.25", "repeat": "6.375", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "102", "notes": "6X6.25"}, {"id": "AG1590", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mill White Bopp / 1.2Mill Clear Liner / 1.5Mil Lam", "sA": "4.6875", "sAr": "7.5625", "repeat": "7.6875", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "-", "notes": "4.6875X7.5625"}, {"id": "AG1591", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2Mil Clear Bopp / 1.2Mil", "sA": "6.875", "sAr": "9.625", "repeat": "9.75", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "6.875X9.625"}, {"id": "AG1592", "shape": "Rectangle", "blankSize": "Webtron 750", "cutTo": "60# Semi Gloss / 40# Liner / 1 Mil Lam", "sA": "2.625", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "144", "notes": "2.625X7"}, {"id": "AG1593", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mill White Bopp / 1.2Mill Clear Liner / 1.5Mil Lam", "sA": "8", "sAr": "6", "repeat": "6.125", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "8X6"}, {"id": "AG1594", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": ".0015 Gloss Pp / 60# Semi Gloss / 40# Liner", "sA": "4.25", "sAr": "7.625", "repeat": "7.75", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "124", "notes": "4.25X7.625"}, {"id": "AG1595", "shape": "Rectangle", "blankSize": "13\"", "cutTo": "2.4 Mil White Bopp Tc / 1.2 Mil Clear", "sA": "2.75", "sAr": "9.5625", "repeat": "9.75", "nA": "4", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "78", "notes": "2.75X9.5625"}, {"id": "AG1596", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5Mil Lam", "sA": "5.75", "sAr": "17", "repeat": "17.125", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "137", "notes": "5.75X17"}, {"id": "AG1597", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp Tc / 1.2 Mil Clear", "sA": "2.875", "sAr": "7.875", "repeat": "-", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "128", "notes": "2.875X7.875"}, {"id": "AG1598", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Mil Lam", "sA": "4.25", "sAr": "15.25", "repeat": "15.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "123", "notes": "4.25X15.25"}, {"id": "AG1599", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp Tc/ 1.2 Mil Clear Liner", "sA": "3.75", "sAr": "9.375", "repeat": "9.5", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "76", "notes": "3.75X9.375"}, {"id": "AG1600", "shape": "Special Shape", "blankSize": "13\" Ma", "cutTo": "5.5 Mil Natural Kraft Label / 40#Sck Liner", "sA": "2", "sAr": "3.5", "repeat": "3.625", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "56", "notes": "2X3.5"}, {"id": "AG1601", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi Gloss / 40# Liner / 1.5 Lam", "sA": "2.75", "sAr": "7", "repeat": "7.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "2.75X7"}, {"id": "AG1602", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60#Semi Gloss At20 Adhesive / 40# Liner", "sA": "5.3125", "sAr": "2.75", "repeat": "2.875", "nA": "2", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "92", "notes": "5.3125X2.75"}, {"id": "AG1603", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "60#Semi Gloss At20 Adhesive / 40# Liner", "sA": "0.9843", "sAr": "8", "repeat": "8.125", "nA": "11", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "130", "notes": "0.9843X8"}, {"id": "AG1604", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2 Mil Metallized Bopp / 1.2 Mil Clear Liner / .95 Mil Lam", "sA": "2.5", "sAr": "8", "repeat": "8.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "130", "notes": "2.5X8"}, {"id": "AG1605", "shape": "Circle", "blankSize": "Flexible", "cutTo": "60#Semi Gloss At20 Adhesive / 40# Liner / 1.5Mil Lam", "sA": "4.25", "sAr": "4.25", "repeat": "4.375", "nA": "2", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Circle", "gearTooth": "105", "notes": "4.25X4.25"}, {"id": "AG1606", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp/1.2Mil Clear Liner.", "sA": "4.875", "sAr": "10.625", "repeat": "10.75", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "86", "notes": "4.875X10.625"}, {"id": "AG1607", "shape": "Oval", "blankSize": "Flexible", "cutTo": "60# Semigloss/40# Liner", "sA": "1.875", "sAr": "2.875", "repeat": "3", "nA": "6", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Oval", "gearTooth": "96", "notes": "1.875X2.875"}, {"id": "AG1608", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp/ 1.5 Lam", "sA": "5.375", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "5.375X7"}, {"id": "AG1609", "shape": "Oval", "blankSize": "Flexible", "cutTo": "2 Mil Clear Bopp /1.2 Mil Clear Liner / 1.5 Mil Lam", "sA": "1.5", "sAr": "2.5", "repeat": "2.625", "nA": "7", "nAr": "5.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "Oval", "gearTooth": "105", "notes": "1.5X2.5"}, {"id": "AG1610", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semigloss/40# Liner", "sA": "3.4267", "sAr": "9.875", "repeat": "10", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "3.4267X9.875"}, {"id": "AG1611", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear / 1.5 Mil Lam", "sA": "3.25", "sAr": "4.25", "repeat": "4.375", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "105", "notes": "3.25X4.25"}, {"id": "AG1612", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear / 1.5 Mil Lam", "sA": "2.9375", "sAr": "7.75", "repeat": "7.875", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "126", "notes": "2.9375X7.75"}, {"id": "AG1613", "shape": "Special Shape", "blankSize": "13\" Ma", "cutTo": "2 Mil Metallized Bopp / 1.2 Mil Clear Liner / .95 Mil Lam", "sA": "4.6884", "sAr": "2.8948", "repeat": "3.025", "nA": "2", "nAr": "5.0", "gapAr": "0.1302", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "121", "notes": "4.6884X2.8948"}, {"id": "AG1614", "shape": "Rectangle", "blankSize": "14\"", "cutTo": "2 Mill Clear Bopp W/1.2 Mill Clear Liner", "sA": "3.625", "sAr": "7", "repeat": "7.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "114", "notes": "3.625X7"}, {"id": "AG1615", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2 Mill Clear Bopp W/1.2 Mill Clear Liner", "sA": "7", "sAr": "9", "repeat": "9.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "146", "notes": "7X9"}, {"id": "AG1616", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2 Mil Metallized Bopp / 1.2 Mil Clear Liner / .95 Mil Lam", "sA": "2", "sAr": "3.25", "repeat": "3.375", "nA": "3", "nAr": "3.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "81", "notes": "2X3.25"}, {"id": "AG1617", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2 Mil Clear / 1.5 Mil Lam", "sA": "4.92", "sAr": "7.125", "repeat": "7.25", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "4.92X7.125"}, {"id": "AG1618", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semigloss/40# Liner / 1.5 Mil Lam", "sA": "3.125", "sAr": "10.5", "repeat": "10.625", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "85", "notes": "3.125X10.5"}, {"id": "AG1619", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil White Polyester / 50#Sck / 1.5 Mil Lam", "sA": "1.5", "sAr": "16", "repeat": "6.125", "nA": "7", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "129", "notes": "1.5X16"}, {"id": "AG1620", "shape": "Rectangle", "blankSize": "14\"", "cutTo": "2 Mil Metallized Bopp / 1.2 Mil Clear Liner / 1.5 Mil Lam", "sA": "2.5", "sAr": "6", "repeat": "6.125", "nA": "4", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "98", "notes": "2.5X6"}, {"id": "AG1621", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2Mil Clear Bopp / 1.2Mil /1.5Mil Lamination", "sA": "5.375", "sAr": "6.125", "repeat": "6.25", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "5.375X6.125"}, {"id": "AG1622", "shape": "Rectangle", "blankSize": "16\"", "cutTo": "2.4 Mil White Bopp Tc/ 1.2 Mil Clear Liner", "sA": "4.75", "sAr": "7.125", "repeat": "7.25", "nA": "3", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "116", "notes": "4.75X7.125"}, {"id": "AG1623", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4 Mil White Bopp / 1.2Mil Clear/1.5Mil Lamination", "sA": "4.875", "sAr": "9.625", "repeat": "9.75", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "78", "notes": "4.875X9.625"}, {"id": "AG1624", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "3Mil White Mdo / 1.2Mil Clear/1.5Mil Lamination", "sA": "6", "sAr": "6.125", "repeat": "6.25", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "100", "notes": "6X6.125"}, {"id": "AG1625", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss Elite / 40# Liner/1.5Mil Lamination", "sA": "0.375", "sAr": "2.5", "repeat": "2.625", "nA": "5", "nAr": "6.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "126", "notes": "0.375X2.5"}, {"id": "AG1626", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss Elite / 40# Liner/1.5Mil Lamination", "sA": "1.1", "sAr": "4.4", "repeat": "4.5417", "nA": "4", "nAr": "3.0", "gapAr": "0.1417", "gapA": "0.125", "cRad": "0.125", "gearTooth": "109.0008", "notes": "1.1X4.4"}, {"id": "AG1627", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss Elite / 40# Liner/1.5Mil Lamination", "sA": "12", "sAr": "7", "repeat": "7.125", "nA": "1", "nAr": "2.0", "gapAr": "0.125", "gapA": "0", "cRad": "0.125", "gearTooth": "114", "notes": "12X7"}, {"id": "AG1628", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss Elite / 40# Liner/1.5Mil Lamination", "sA": "4", "sAr": "4", "repeat": "4.125", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "66", "notes": "4X4"}, {"id": "AG1629", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "60# Semi Gloss Elite / 40# Liner/1.5Mil Lamination", "sA": "6.5", "sAr": "9.4375", "repeat": "9.625", "nA": "1", "nAr": "1.0", "gapAr": "0.1875", "gapA": "0.125", "cRad": "0.125", "gearTooth": "77", "notes": "6.5X9.4375"}, {"id": "AG1630", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "5.25", "sAr": "16.25", "repeat": "16.375", "nA": "2", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "131", "notes": "5.25X16.25"}, {"id": "AG1631", "shape": "Rectangle", "blankSize": "10\" Comco Or 10\"", "cutTo": "2 Mil Clear Bopp W/1.2 Mil Clear Liner / 1.5Mil Lamination", "sA": "7.25", "sAr": "9.7657", "repeat": "10", "nA": "1", "nAr": "1.0", "gapAr": "0.2343", "gapA": "0.125", "cRad": "0.125", "gearTooth": "80", "notes": "7.25X9.7657"}, {"id": "AG1632", "shape": "Rectangle", "blankSize": "750 Webtron", "cutTo": "72# Silver Lam Foil / 1.2Mil Clear / 1.5Mil Lamination", "sA": "6", "sAr": "3.625", "repeat": "3.875", "nA": "1", "nAr": "3.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.125", "gearTooth": "93", "notes": "6X3.625"}, {"id": "AG1633", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2Mil /1.5Mil Lam", "sA": "4.4513", "sAr": "2.806", "repeat": "2.9375", "nA": "2", "nAr": "4.0", "gapAr": "0.1315", "gapA": "0.125", "cRad": "Special Shape", "gearTooth": "94", "notes": "4.4513X2.806"}, {"id": "AG1634", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi-Gloss / 40# Liner / 1.5Mil Lam", "sA": "2.25", "sAr": "11.375", "repeat": "11.5", "nA": "5", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "92", "notes": "2.25X11.375"}, {"id": "AG1635", "shape": "Rectangle", "blankSize": "11\"", "cutTo": "2 Mil Metallized Bopp / 1.2 Mil Clear Liner", "sA": "3.125", "sAr": "8.375", "repeat": "8.5", "nA": "3", "nAr": "1.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.015625", "gearTooth": "68", "notes": "3.125X8.375"}, {"id": "AG1636", "shape": "Special Shape", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp / 1.2 Mil Clear Liner / 1.5 Mil Lam", "sA": "1.6157", "sAr": "8.75", "repeat": "9", "nA": "6", "nAr": "2.0", "gapAr": "0.25", "gapA": "0.125", "cRad": "0.1875", "gearTooth": "144", "notes": "1.6157X8.75"}, {"id": "AG1637", "shape": "Rectangle", "blankSize": "10\"", "cutTo": "2.4Mil Clear Bopp / 1.2 Mil Clear Liner / 1.5 Mil Lam", "sA": "7.4", "sAr": "7.26", "repeat": "7.5", "nA": "1", "nAr": "2.0", "gapAr": "0.24", "gapA": "0", "cRad": "0.03125", "gearTooth": "120", "notes": "7.4X7.26"}, {"id": "AG1638", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "54# Semi-Gloss /40# Liner/ 1.5 Mil Lam", "sA": "6", "sAr": "7.5", "repeat": "7.625", "nA": "2", "nAr": "2.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "122", "notes": "6X7.5"}, {"id": "AG1639", "shape": "Rectangle", "blankSize": "Flexible", "cutTo": "2.4Mil White Bopp /1.2 Mil Clear Liner/ 1.5 Mil Lam", "sA": "3.35", "sAr": "4", "repeat": "4.125", "nA": "3", "nAr": "4.0", "gapAr": "0.125", "gapA": "0.125", "cRad": "0.125", "gearTooth": "132", "notes": "3.35X4"}];
const SPEC_FILMS=[{"id": "100WPET", "desc": "3.5mil White Cosmetic Web 350 HB"}, {"id": "101WPET", "desc": "White Cosmetic Web Ultra Plus 530 HB"}, {"id": "102WP", "desc": "35#PPFP - White"}, {"id": "103MPET", "desc": "2.1mil Metallized PET/PE"}, {"id": "104WPETSP", "desc": "3.2mil White StickPak w/Metallocene"}, {"id": "105WPETSP", "desc": "2.8 mil White StickPak w/Surlyn"}, {"id": "106WPETSP", "desc": "White Stick Pack Easy Open"}, {"id": "107CMPET", "desc": "2.6mil Clear PET/EVOH/LLDPE-High Barrier"}, {"id": "108WPSP", "desc": "25# PPFP"}, {"id": "109WSPSW", "desc": "Wh Singleply Snack Web"}, {"id": "110WPSP", "desc": "25#PPFP W-Surlyn"}, {"id": "111SPET", "desc": "3.5mil Silver Cosmetic Web 350 HB"}, {"id": "112PMOP", "desc": "White 35#PPMOPP"}, {"id": "113C1SSW", "desc": "C1 Single Snack Web"}, {"id": "114PPMPET", "desc": "25# PPMPET"}, {"id": "115WMPS", "desc": "2.6mil White PET/EVOH/LLDPE-High Barrier"}, {"id": "116MCW", "desc": "Metallized Coffee Web ITC"}, {"id": "117WF", "desc": "Whi Foil 1.5Mil Seal"}, {"id": "118WCWL", "desc": "White Cosmetic Web Light"}, {"id": "119WSSW", "desc": "Wh Sinlepy Snack Web-DUPLICATE USE 109WSPSW"}, {"id": "121SHB", "desc": ".0007 Mil METALLZED Singleply Snack Web"}, {"id": "122SW", "desc": "100 Selfwound .95Mil"}, {"id": "123CMOP", "desc": "Matte .0006 Mil Clear Lam OPP"}, {"id": "124CNP", "desc": "Clear 3Mil Nylonpoly"}, {"id": "125MPET", "desc": "3 Mil Metallized ployester/.002 LDPE"}, {"id": "126CPET", "desc": "3 Mil Clear Polyester/.002 LDPE"}, {"id": "127CLP", "desc": ".00048 Clear Polyester Lam"}, {"id": "128WCWU", "desc": "White Cosmetic Web Ultra"}, {"id": "129MPET", "desc": "Shannon Spec# MET300 - Metallized"}, {"id": "130CPET", "desc": "Shannon Spec# PET300 - Clear"}, {"id": "132SPET", "desc": "Packona Film"}, {"id": "134PP", "desc": "35# C1S/ LDPE"}, {"id": "136GA", "desc": "200 GA BOPP"}, {"id": "138C1S", "desc": "9PT C1S INTEGRITY TT"}, {"id": "139MMP", "desc": "2mil Metallized Heat Sealable Bopp"}, {"id": "140TS", "desc": "40#TRANSLUCENT/S2501/40#SCK"}, {"id": "141KP", "desc": "American Paper"}, {"id": "142CNP5", "desc": "NP500"}, {"id": "143SW", "desc": "Selfwound .95Mil"}, {"id": "145MET300G", "desc": "3mil Gold IN PET/Poly"}, {"id": "146M350PET", "desc": "3.5 mil Brown Matte OPP/PET/PVOH"}, {"id": "147PPET", "desc": "3.5mil Clear PVDC PET/Poly"}, {"id": "150SGR", "desc": "60# White Semi Gloss/No liner"}, {"id": "151WTP8", "desc": "8PT White C2S Tag Paper"}, {"id": "153CMPET", "desc": "2.6 Mil Clear PET/ LLDPE-Low Barrier"}, {"id": "154HSCB", "desc": "1 Mil Clear Heat Sealable Clear Bopp / 100 Gauges"}, {"id": "160CNP", "desc": "SV300X Clear Nylon Poly with EVOH"}, {"id": "161HSCB", "desc": "2 Mil Clear Heat Sealable Clear Bopp / 200 Gauges"}, {"id": "162WP", "desc": "35#PPFP"}, {"id": "163HSCB", "desc": "1.8 Mil Clear Heat Sealable Clear Bopp / 180 Gauges"}, {"id": "164WTFP", "desc": "Ahlstrom Spec# WL116970"}, {"id": "165HSCB", "desc": "Transilwrap Spec# HSCT160GA"}, {"id": "166CBRL", "desc": "48G Gloss OPP for UV Lamination"}, {"id": "168HSCB", "desc": "Transilwrap Spec"}, {"id": "169HSCPET", "desc": "Heat Sealable Clear PET Lidding Material/.00060 Mil"}, {"id": "172HSCB", "desc": "Tranilwrap Spec# HSCT1/140GA"}, {"id": "173SHB", "desc": "1.2 Mil Metalized Heat Sealable BOPP"}, {"id": "174SPET", "desc": "Silver Cosmetic"}, {"id": "175PSF", "desc": "Polyester Shrink Film"}, {"id": "177SBOPP", "desc": "1.4 Mil Metalized Heat Sealable BOPP"}, {"id": "178SPET", "desc": "4mil PFP500"}, {"id": "179SSP", "desc": "Silver Stickpak Suryln"}, {"id": "180WPETSP", "desc": "White stickpack surlyn 280HB"}, {"id": "182HSCB", "desc": "1.2 Mil Clear Heat Sealable Clear Bopp/ 120 Gauges"}, {"id": "184HSCB", "desc": ".0008 Mil Clear Heat Sealable Clear Bopp/ 80Gauges"}, {"id": "185PL", "desc": "10 mil polylith GC2"}, {"id": "186CRPET", "desc": ".92 Mill Clear Raw Polyester"}, {"id": "187HSCB", "desc": ".7 Mil Heat Sealable Clear BOPP/70 Gauges"}, {"id": "188CNP4", "desc": "4 Mil Clear Nylon Poly Coex"}, {"id": "192GCF", "desc": "Gold Cold Foil"}, {"id": "193WPETSP", "desc": "White Stick Pack Easy Open .0029 Gauge"}, {"id": "194CFD", "desc": "Cold Foil"}, {"id": "195CFA", "desc": "Cold Foil"}, {"id": "196CFC", "desc": "Cold Foil"}, {"id": "197CFL", "desc": "Cold Foil"}, {"id": "198CFN", "desc": "Cold Foil"}, {"id": "199CFSBL", "desc": "Cold Foil"}, {"id": "200CFLW", "desc": "Cold Foil"}, {"id": "201SLF", "desc": "Silver Lid with Foil"}, {"id": "202SCFS", "desc": "Standard Cold Foil Silver"}, {"id": "206BKF", "desc": "Natural kraft foil w/ brown PE lamination"}, {"id": "209CSWP", "desc": "2.2 mil clear self wound polypropylene"}, {"id": "210RSF", "desc": "Regular shrink PVC"}, {"id": "211HSF", "desc": "High shrink PVC"}, {"id": "212WPETB", "desc": "Cosmetic web with barex"}, {"id": "220HSCB", "desc": "Heat Sealable Clear BOPP PVDC/2.1 Mill/ 210 ASB-X equivalent"}, {"id": "221HSCB", "desc": "Heat Sealable Clear Bopp PVDC/1Mil/ 100 ASB-X equivalent"}, {"id": "223SW", "desc": "Selfwound 1.1 Mil"}, {"id": "225COPP", "desc": "Oxo-biodegradable OPP film"}, {"id": "226BNP", "desc": "4mil Black BIAX Nylon/Poly laminated barrier film"}, {"id": "227CSS", "desc": "2 mil Clear PVC High Shrink"}, {"id": "230CMHS", "desc": "Metallized, high barrier 80 Gauge"}, {"id": "243WMP", "desc": "2.6mil White PET/LLDPE-Low Barrier"}, {"id": "244WPETSP", "desc": "Silver StickPak w/Metallocene"}, {"id": "245BPF", "desc": "Blister Pack Foil"}, {"id": "246CF", "desc": "Original/Genuine Cold Foil"}, {"id": "247WRB", "desc": "2.6 Mil White BOPP Corona 2S"}, {"id": "249SML", "desc": "1.4 Mil Matte Lam"}, {"id": "250CCHP", "desc": "CelloPlus PVdc Barrier Coating"}, {"id": "251CPLB", "desc": "Clear Polly Low Barrier"}, {"id": "252CPHB", "desc": "Clear PollyHigh Barrier"}, {"id": "253WPET", "desc": "White Cosmetic"}, {"id": "258CMOP", "desc": "1.2 Mil Matte Bopp/ 120 Gauges"}, {"id": "259WRB", "desc": "White Raw Bopp"}, {"id": "260WPMPP", "desc": "25# CIS/7# LDPE/HEAT-SEALABLE MOPP"}, {"id": "261WRSG", "desc": "60# C2S Semi-Gloss-FDA Approved"}, {"id": "262HSCB", "desc": "Heat Sealable Clear Bopp PVDC/ .001/ASB-X evuivalent"}, {"id": "264SW", "desc": "1.5 Mil gloss clear medium coat lam"}, {"id": "267WPET", "desc": "Polyester/White LDPE/FOIL/EAA/LLDPEF 2.5Mil Total"}, {"id": "268SG", "desc": "100# C2S Semi-Gloss"}, {"id": "272SPET", "desc": "5.3 Mil Silver Cosmetic Web Ultra Plus"}, {"id": "273HSCB", "desc": "Heat Sealable Clear Bopp PVDC/ .0016/ASB-X evuivalent"}, {"id": "274WPL", "desc": "6mil White sentetic film"}, {"id": "275WMD", "desc": "3 MIL white flexible opaque"}, {"id": "276CMD", "desc": "3 MIL Clear flexible opaque"}, {"id": "277SHB", "desc": "80Mil Gauge Metalized Heat Sealable BOPP"}, {"id": "278MHSB", "desc": ".7mil Metallized Heat Sealable BOPP-high barrier"}, {"id": "279MHSB", "desc": ".7mil Metallized Heat Sealable BOPP"}, {"id": "283TTS", "desc": "10pt. C1S Carolina Tag Stock"}, {"id": "285PP", "desc": "35#paper BL/5# PE Poly Extrusion Lamination"}, {"id": "288TTS", "desc": "10 Pt. C1S Semi­Gloss"}, {"id": "289MCP", "desc": "120g Metallized Heat Sealable CPP"}, {"id": "290CBRL", "desc": "1 Clear Bopp Raw Lam/100 Gauges"}, {"id": "291CBRL", "desc": "1.2 Clear Bopp Raw Lam/120 Gauges"}, {"id": "292CBRL", "desc": "2 Clear Bopp Raw Lam/200 Gauges"}, {"id": "293CBRL", "desc": "70 Clear Bopp Raw Lam/70 Gauges"}, {"id": "294CCP", "desc": "120g Clear Heat Sealable BOPP"}, {"id": "295GCF", "desc": "Gold Cold Foil"}, {"id": "298SCF", "desc": "Silver Cold Foil / Metallic Cold Foil"}, {"id": "301RGCF", "desc": "Rose Gold Cold Foil"}, {"id": "302MGCF", "desc": "Matte Gold Cold Foil"}, {"id": "305GCF", "desc": "Gold Cold Foil"}, {"id": "306GCF", "desc": "Copper Gold Cold Foil"}, {"id": "312RML", "desc": "59g Matte OPP Lamination Film"}, {"id": "313TTS", "desc": "18 Pt. C1S Tango Reliant"}, {"id": "316WKP", "desc": "4.5mil white Kraft with foil"}, {"id": "317HSB", "desc": "100g Freezer Grade For Popsicles"}, {"id": "318HSB", "desc": "120g Freezer Grade For Popsicles"}, {"id": "319HSB", "desc": "200g Freezer Grade For popsicles"}, {"id": "320CTC", "desc": ".87g Transcello MT33-F/ Clear twist cellophane"}, {"id": "322RML", "desc": ".70mil Raw Matte Lamination"}, {"id": "323CBRL", "desc": "200g (2mil) Clear Bopp Raw Lamination"}, {"id": "324CLP", "desc": "92g (0.92 mil) 2-Side Chemical Treated Clear Lam."}, {"id": "325LLDPE", "desc": "200g Linear Low Density Polyethylene"}, {"id": "326RPP", "desc": "210 ASB-X Reverse Printing Polypropylene"}, {"id": "327RPP", "desc": "170 ASB-X Reverse Printing Polypropylene"}, {"id": "328RPP", "desc": "150 ASB-X Reverse Printing Polypropylene"}, {"id": "329RPP", "desc": "110 AXT Reverse Printing Polypropylene"}, {"id": "330RPP", "desc": "84 AOH Reverse Printing Polypropylene"}, {"id": "331MHSB", "desc": "70 MET HB2-Metallized High Barrier OPP"}, {"id": "334CMOP", "desc": "Matte Selfwound .95Mil"}, {"id": "335WLF", "desc": "200g White Multi-Purpose Lidding Film"}, {"id": "336CLF", "desc": "200g Clear Multi-Purpose Lidding Film"}, {"id": "338SHP", "desc": "110g. Silver Heat Polypropylene"}, {"id": "338SHPD", "desc": "158g. Silver Heat Polypropylene - With 347CBRL Gloss OPP for UV Lamination"}, {"id": "342SW", "desc": "Matte Selfwound 1.5 Mil"}, {"id": "343PP", "desc": "25# BL / 10# PE Paper Poly"}, {"id": "344TTS", "desc": "12pt. C1S Tag"}, {"id": "346WPWB", "desc": "1.6mil White Cavitated Polypropylene Water Bottle"}, {"id": "347CBRL", "desc": "48g Gloss OPP for UV Lamination"}, {"id": "351SW", "desc": "Selfwound 1.5 Mil"}, {"id": "353WSW", "desc": "2.6mil White Snack Web"}, {"id": "354LCF", "desc": "Laser Cold Foil"}, {"id": "355WNP", "desc": "3Mil White Nylon/Poly"}, {"id": "356WPET", "desc": "3.5 Mil White Cosmetic w/Metallocene"}, {"id": "360HSB", "desc": "1 Mil Two-Side Acrylic Heat Sealable Bopp"}, {"id": "361HSB", "desc": ".8 Mil Two-Side Heat Sealable Clear OPP Lam"}, {"id": "362WSF", "desc": "White Shrink Film"}, {"id": "363IRCF", "desc": "Iridescent Rainbow Cold Foil"}, {"id": "364WPP", "desc": "1.4 Mil White Polypropylene (COLD SEAL)"}, {"id": "365WCP", "desc": "1 Mil White Cavitated Polypropylene"}, {"id": "367PSF", "desc": "41SH Polyester Shrink Sleeve 45g( .00180)"}, {"id": "368WPETSP", "desc": "2.85 Mil White Easy Tear Stick Pack"}, {"id": "371WOPP", "desc": "1.7mil White Opaque OPP HS1"}, {"id": "372HSF", "desc": "50 Micron / 1.97 mil Clear High Shrink PETG"}, {"id": "373SW", "desc": ".8 mil Clear Super Thin Lamination"}, {"id": "375CBRL", "desc": "1 Mil Gloss OPP for UV Lamination"}, {"id": "376SSW", "desc": "Silver/Metallized Snack Web 240 HB/ 2.4Mil"}, {"id": "377CNP5", "desc": "Crystal Clear 5 mil Nylon Poly"}, {"id": "378WPET", "desc": "3.1mil White Cosmetic Web"}, {"id": "379LSF", "desc": "3mil Clear PVC"}, {"id": "380CPET", "desc": "2 Mil Clear PET/Cast Poly Prop"}, {"id": "381", "desc": ""}, {"id": "383CMOP", "desc": "1.2 mil Clear Matte BOPP, Raw Lam"}, {"id": "386HSB", "desc": "160g Freezer Grade For Popsicles Two-Side Sealable"}, {"id": "388CPET", "desc": "120g Clear PET Oven Safe / MICROWAVEABLE"}, {"id": "389OPP", "desc": "110g. White OPP-COLD SEAL"}, {"id": "392SFP", "desc": "236g Oriented Polyesterene Film (OPS)"}, {"id": "397CLF", "desc": "2mil Clear Lidding Film"}, {"id": "398HSB", "desc": "140g Freezer Grade For Popsicles"}, {"id": "399CBRL", "desc": "1.2 Mil Gloss OPP for UV Lamination"}, {"id": "400RML", "desc": "70g Matte OPP Lamination Film"}, {"id": "401WPET", "desc": "2.4 Mil White PET/Metallocene"}, {"id": "402CP", "desc": "1.4 mil CelloPhane XS Barrier Coating"}, {"id": "405HPCF", "desc": "Holographic Pattern Cold Foil"}, {"id": "406NFC", "desc": "1.8 Mil NatureFlex Heat-sealable Compostable Film"}, {"id": "407BKP", "desc": "30# Bleach Kraft Paper"}, {"id": "408CMOP", "desc": "1.1 mil Matte BOPP, Raw Lam"}, {"id": "411CBRL", "desc": "mil Clear BOPP, Raw Lam"}, {"id": "412SHP", "desc": "1.1mil Silver/White P.P"}, {"id": "413CSF", "desc": "1.6mil Clear Shrink PVC"}, {"id": "415CRF", "desc": "3.5Mil Clear Recyclable Film"}, {"id": "417METCPP", "desc": "1.4 Metallized Heat Sealable Cast Polypropylene Film"}, {"id": "418CRF", "desc": "4 Mil Clear Recyclable Film"}, {"id": "419HSB", "desc": "70g Freezer Grade For Popsicles"}, {"id": "420SPET", "desc": "3.7 Mil Silver Cosmetic Web Ultra"}, {"id": "421WHB", "desc": "2.5 High Barrier White Flex Pack"}, {"id": "422HSCF", "desc": "50 Heat Sealable Compostable Film"}, {"id": "423PETHB", "desc": "2.5 Clear High Barrier PET"}, {"id": "425PETSF", "desc": "1.8Mil Polyester Shrink Sleeve"}, {"id": "426SW", "desc": ".95Mil Clear Selfwound"}, {"id": "427CMOP", "desc": "1.5Mil Matte Selfwound"}, {"id": "430WRF", "desc": "4 Mil White Recyclable Film"}, {"id": "431LLDPE", "desc": "150g Linear Low Density Polyethylene"}, {"id": "432NPP", "desc": "Natural Kaft Paper Poly"}, {"id": "433MCPET", "desc": "4 mil metalized and clear pet film"}, {"id": "436CNP", "desc": "4 Mil Clear BIAX Nylon Poly Film"}, {"id": "437HICF", "desc": "Holographic Iridescent Cold Foil"}, {"id": "439GCF", "desc": "Gold Cold Foil"}, {"id": "440SCF", "desc": "Silver Cold Foil"}, {"id": "441NFC", "desc": "4.2 Mil NatureFlex Heat-sealable Compostable Film"}, {"id": "443GCF", "desc": "Green Cold Foil"}, {"id": "444STML", "desc": ".7mil Soft Touch Matte Overlaminate Film"}, {"id": "445METCPP", "desc": "1.2 Metallized Heat Sealable Cast Polypropylene Film"}, {"id": "448WHS", "desc": "4.5mil White High Strength SUP"}, {"id": "449WP", "desc": "54# White Paper Semi Gloss"}, {"id": "450WP", "desc": "60# White Paper Semi Gloss Elite"}, {"id": "451CS", "desc": "18 Pt. C1S Carton Stock"}, {"id": "453STML", "desc": "1.5mil Soft Touch Matte Overlaminate Film"}, {"id": "454WPET", "desc": "4 Mil White Metalized PET"}, {"id": "455KPET", "desc": "Black Cosmetic"}, {"id": "457RCF", "desc": "Red Cold Foil"}, {"id": "458PCF", "desc": "Purple Cold Foil"}, {"id": "459CPP", "desc": "1.4 Clear Heat Sealable Cast Polypropylene Film"}, {"id": "462CNFC", "desc": ".75mil NatureFlex Clear HS Compostable Film"}, {"id": "463MNFC", "desc": ".90mil NatureFlex Metalized HS Compostable Film"}, {"id": "464GSCL", "desc": "1.2mil Gloss Thermal Laminate Film"}, {"id": "465GSML", "desc": "1 mil Matte Thermal Laminating Film"}, {"id": "466HSB", "desc": "1.3 Mil Two-Side Acrylic Coated OPP Film"}, {"id": "469CMOP", "desc": ".95 Mil Matte Selfwound"}, {"id": "470MPET", "desc": "3.5 Ultra Metallized Polyester"}, {"id": "473CPP", "desc": "1.2 Metallized Heat Sealable Cast Polypropylene Film"}, {"id": "474CNF", "desc": "3 Mil Clear Nominal Nylon Poly Film COEX Vacuum Barrier Film"}, {"id": "475WCF", "desc": "3.4mil White Metalized SUP Bio Based Film"}, {"id": "478CBRL", "desc": "75g Gloss OPP for UV Lamination"}, {"id": "479GTS", "desc": "80# Gloss Sheets"}, {"id": "480SPET", "desc": "3.1mil Silver Cosmetic Web"}, {"id": "481WE", "desc": "White Envelope"}, {"id": "482MCF", "desc": "3.4mil Metalized SUP Bio Based Film"}, {"id": "483CHB", "desc": "2.5 High Barrier Clear Flex Pack"}, {"id": "484CBRL", "desc": "48g Gloss OPP Lamination"}, {"id": "485SWTT", "desc": "1.1 Mil Clear Selfwound Thermal Transfer Printable"}, {"id": "486CMOP", "desc": ".71 mil Matte BOPP, Raw Lam"}, {"id": "487GCF", "desc": "Gold Cold Foil"}, {"id": "488SBF", "desc": "3mil High Clarity Shrink Bundling Film"}, {"id": "489WOPP", "desc": "1.6 White Polypropylene Film"}, {"id": "490SW", "desc": "1.5 mil Clear Polyester Lamination , Selfwound"}, {"id": "491CLF", "desc": "80g Clear Polyester Lidding Film"}, {"id": "493HRCF", "desc": "Holographic Rainbow Pattern Cold Foil"}, {"id": "494SSCF", "desc": "Silver Shrink Sleeve Cold Foil"}, {"id": "495HSB", "desc": "120g Clear BOPP Film"}, {"id": "497WPET", "desc": "4mil White PET + MPET + PE"}, {"id": "498CPRL", "desc": "1.42g mil Clear Polyester Laminating Film"}, {"id": "499CBRL", "desc": "75g Gloss OPP Lamination"}, {"id": "500CBRL", "desc": "1 mil Clear BOPP Raw Lamination Film"}, {"id": "503HSCB", "desc": ".70g Heat Sealable Clear Bopp PVDC High Barrier"}, {"id": "505CNP", "desc": "5mil Clear BIAX Nylon/EVOH/Poly"}, {"id": "506PETSF", "desc": "1.8Mil Polyester Shrink Sleeve"}, {"id": "507WP", "desc": "25#PPFP"}, {"id": "508CPET", "desc": "4mil Clear PET High Barrier"}, {"id": "509BCF", "desc": "4.3 mil Biogradable Compositing Film"}, {"id": "510CHB", "desc": "3mil Clear laminated extremely high barrier Film"}, {"id": "511CRF", "desc": "5 Mil Clear Recyclable Film"}, {"id": "512CLF", "desc": "176g Clear PP Lidding Film"}, {"id": "513PETSF", "desc": "2mil Clear PETg w/OB"}, {"id": "514MOPP", "desc": "70g Metallized Polypropylene-HB"}, {"id": "517TTS", "desc": "14 Pt. C1S Semi-Gloss"}, {"id": "518SW", "desc": "2.2 Mil Clear Selfwound"}, {"id": "519SW", "desc": "1.3 Mil Clear Selfwound (Premium Extra Clear)"}, {"id": "522SHP", "desc": "1.2g Metal White Heat Polypropylene"}, {"id": "525CRF", "desc": "5 Mil Clear Recyclable Film"}, {"id": "526WRF", "desc": "5 Mil White Recyclable Film"}, {"id": "527WFK", "desc": "35/5 White Freezer Kraft"}, {"id": "528OPP", "desc": "1mil OL PRT PET"}, {"id": "531SW", "desc": "1mil Selfwound Matte"}, {"id": "532CBRL", "desc": "1 Mil Gloss OPP for UV Lamination"}, {"id": "533SHP", "desc": "2.1 mil - 338SHP Silver Heat Polypropylene - With 532CBRL Gloss OPP for UV Lamination"}, {"id": "534GCF", "desc": "Green Cold Foil"}, {"id": "535CPET", "desc": "80g Clear PET Oven Safe / MICROWAVEABLE"}, {"id": "538CPET", "desc": "2.5 Mil Clear HB PET"}, {"id": "539SHP", "desc": "1.1 Mil Silver PP-HS"}, {"id": "539SHPD", "desc": "1.1 Silver PP-HS - With 166CBRL Gloss OPP for UV Lamination"}, {"id": "542CBRL", "desc": "1 Mil Gloss OPP Lamination"}, {"id": "543CBRL", "desc": "60g Matte OPP Lamination"}, {"id": "548WPETSF", "desc": "3.2 Mil White PET-EO"}, {"id": "549SWTT", "desc": "1.1 Mil Clear Selfwound Thermal Transfer Printable"}, {"id": "553WPET", "desc": "5mil White PET + MPET + PE"}, {"id": "554WPET", "desc": "3.6 Mil White Cosmetic Web"}, {"id": "556WPSP", "desc": "25#PPFP"}, {"id": "557SW", "desc": ".71 Mil Selfwound Matte"}, {"id": "558SSCF", "desc": "Silver Sparkle Cold Foil"}, {"id": "559CMOP", "desc": "1 Mil Matte OPP Raw Lamination"}, {"id": "560HSB", "desc": "1.2 Mil Two-Side Acrylic Coated OPP Film"}, {"id": "561HSB", "desc": "1 Mil Low Temperature Sealing Coating OPP Film"}];
const SPEC_LABELS=[{"id": "120SG", "desc": "54# Semi-Gloss"}, {"id": "131CL", "desc": "Classic Linen"}, {"id": "133SG", "desc": "54# SemiGloss"}, {"id": "135TT", "desc": "2.5 Mil White Thermal Transfer"}, {"id": "137CBOPP", "desc": "2 Mil Clear BOPP"}, {"id": "144DT", "desc": "53#White Direct Thermal"}, {"id": "148WBOPP", "desc": "44# White Thermal Transfer BOPP"}, {"id": "149TTR", "desc": "44# White Thermal Transfer"}, {"id": "152SG", "desc": "60# Semi-Gloss Elite"}, {"id": "155TPC2", "desc": "100# C2S Semi-Gloss"}, {"id": "156DTSL", "desc": "51# Direct Thermal"}, {"id": "157PPSG", "desc": "50# Platinum Plus SemiGloss"}, {"id": "158BGF", "desc": "70# Bright Gold Foil"}, {"id": "159BSF", "desc": "70# Bright Silver Foil"}, {"id": "167SG", "desc": "60# Semi-Gloss Elite"}, {"id": "170SG", "desc": "54# Semi Gloss"}, {"id": "171WBOPP", "desc": "2.4 Mil White BOPP"}, {"id": "176SBOPP", "desc": "2 mil Metalized TC BOPP"}, {"id": "181TT", "desc": "Thermal Transfer"}, {"id": "183CSC", "desc": "6 Mil Clear Static Cling TC 8 Pt"}, {"id": "189SG", "desc": "54# Semi Gloss"}, {"id": "190SPF", "desc": "70# Bright Silver Lam Foil"}, {"id": "191TT", "desc": "42# thermal transfer"}, {"id": "203CBCL", "desc": "2 Mil Clear BOPP"}, {"id": "204DT", "desc": "54# Direct Thermal"}, {"id": "205DT", "desc": "Direct Thermal"}, {"id": "207WBOPP", "desc": "2.3 Mil White TC BOPP"}, {"id": "213OSG", "desc": "OPAQUE 60# Semi Gloss"}, {"id": "214OTT", "desc": "47# Opaque Thermal Trasfer"}, {"id": "215SG", "desc": "54# C1S Semi Gloss"}, {"id": "216SG", "desc": "54# C1S Semi Gloss"}, {"id": "217SG", "desc": "54# Semi Gloss"}, {"id": "218TS", "desc": "10 Pt. Tag"}, {"id": "219SG", "desc": "60# Semi Gloss"}, {"id": "222WBOPP", "desc": "2.3 ML WHITE TC BOPP"}, {"id": "224CBOPP", "desc": "2 ML CLEAR TC BOPP"}, {"id": "228SPTE", "desc": "1.5Mil Silver Polyester"}, {"id": "231WV", "desc": "4 Mil White Flexible Vinyl"}, {"id": "235C1S", "desc": ".14pt C1S Carolina"}, {"id": "236WMB", "desc": "2.3 Mil White"}, {"id": "237SGO", "desc": "60# Semi-Gloss Opaque"}, {"id": "238WBOPP", "desc": "2.4 MIL WHITE BOPP"}, {"id": "239OTT", "desc": "47# Opaque Thermal Transfer"}, {"id": "240OTT", "desc": "Opaque Thermal Transfer"}, {"id": "248SG", "desc": "60# Semi-Gloss Elite"}, {"id": "254SG", "desc": "60# Semi-Gloss Elite"}, {"id": "255CA", "desc": "2 Mil Clear Acetate"}, {"id": "256IRC", "desc": "IRC Film Base -Coupon"}, {"id": "257IRC", "desc": "Redeem-A-Label-Coupon"}, {"id": "263WPO", "desc": "White Polyolefin"}, {"id": "265WBOP", "desc": "White BOPP AT20N"}, {"id": "266CBOPP", "desc": "2 mil Clear TC BOPP"}, {"id": "280OTT", "desc": ""}, {"id": "281SG", "desc": "54# Semi Gloss AT20 Adhesive (Non-SF Version)"}, {"id": "282SG", "desc": "54# C1S Semi Gloss"}, {"id": "284CBCL", "desc": "2ml clear tc bopp"}, {"id": "286WBOPP", "desc": "2.3 White Bopp"}, {"id": "287LJ", "desc": "3.4Mil Laser jet Liner"}, {"id": "314WDP", "desc": "2mil Water Disolvable"}, {"id": "315RHB", "desc": "2 mil Totally Seamless Rainbow"}, {"id": "321WBOPP", "desc": "2.6 Mill White TC Bopp"}, {"id": "332SG", "desc": "60# Semi Gloss Elite /C2510/40# CK"}, {"id": "333WBOPP", "desc": "2mil White Bopp TC/S7000/40#BG"}, {"id": "337SBOPP", "desc": "2 ML Metalized TC BOPP"}, {"id": "341HG", "desc": "57# White Hi Gloss"}, {"id": "345SBOPP", "desc": "2Mil Metallized TC BOPP"}, {"id": "348WLP", "desc": "60# White Linen Paper"}, {"id": "349FNP", "desc": "60# White Felt Natural Paper"}, {"id": "350SWV", "desc": "4 Mil White Flexible Vinyl"}, {"id": "352BK", "desc": "66# Brown Kraft"}, {"id": "357CPO", "desc": "2.5 Mil Clear Polyolefin"}, {"id": "358CPO", "desc": "2.5 Mil Clear Polyolefin Matte"}, {"id": "359CPO", "desc": "3 Mil Clear Polyolefin Matte MDO"}, {"id": "369ML", "desc": "60# Matte Litho"}, {"id": "370LC", "desc": "Jet 300"}, {"id": "374WBOPP", "desc": "2.3 Mil White BOPP TC"}, {"id": "382KNL", "desc": "Natural Kraft Label"}, {"id": "384SG", "desc": "54# Semi Gloss AT20N Adhesive"}, {"id": "387SBCL", "desc": "2 Mil Metallized BOPP TC"}, {"id": "390WTT", "desc": "White Thermal Transfer"}, {"id": "391SG", "desc": "58#-Premium Semi Gloss"}, {"id": "393SG", "desc": "60# Semi-Gloss Elite"}, {"id": "394FNP", "desc": "60# White Felt Paper WS"}, {"id": "395WPO", "desc": "2.5mil White Polyolefin"}, {"id": "396WV", "desc": "3.4 mil White Flexible Vinyl"}, {"id": "403WPF", "desc": "3.5 Mil White polyoplefin"}, {"id": "404WPB", "desc": "3 Mil White polyoplefin Blend"}, {"id": "409LC", "desc": "Laser Jet 300"}, {"id": "410ASG", "desc": "60# Semi Gloss- Lay Flat"}, {"id": "414CBOPP", "desc": "2 Mil Clear Bopp"}, {"id": "416WPE", "desc": "PE 85 White Polyethylene"}, {"id": "424CBNL", "desc": "2 Mil Clear Bopp"}, {"id": "428CLPET", "desc": "1 Mil Clear Print-Treated Polyester"}, {"id": "429SPET", "desc": "2 Mil Matte Chrome Polyester"}, {"id": "434WRP", "desc": "5 Mil White Post Consumer"}, {"id": "435WBOPP", "desc": "2.4 MIL WHITE BOPP"}, {"id": "438CWS", "desc": "80# Cotton Wet Strength"}, {"id": "442HGUR", "desc": "60# High Gloss"}, {"id": "446HGIJ", "desc": "60# High Gloss Inkjet"}, {"id": "447HGIJ", "desc": "59# High Gloss Inkjet"}, {"id": "452WE", "desc": "60# White Estate"}, {"id": "456WBOPP", "desc": "2.3Mil White Bopp / Metalized Back"}, {"id": "460BCPET", "desc": "2 Mil Brushed Chrome Polyester"}, {"id": "461WBOPP", "desc": "2.4 Mil White BOPP TC"}, {"id": "467SG", "desc": "60# Semi Gloss AT20 Adhesive"}, {"id": "468SG", "desc": "60# Semi Gloss Elite"}, {"id": "472CBP", "desc": "60# Crush Barley Paper"}, {"id": "476CCWS", "desc": "60# Classic Crest Natural White WS"}, {"id": "477WE", "desc": "60# White Estate Label"}, {"id": "492WBOPP", "desc": "2.6mil PP High Opacit White TC"}, {"id": "496WFP", "desc": "70# Bright White Felt Wet-Strength"}, {"id": "501CBCL", "desc": "1.85mil clear tc bopp"}, {"id": "502CBKL", "desc": "2 Mil Clear Bopp"}, {"id": "504CBCL", "desc": "2 Mil Clear BOPP"}, {"id": "515NKL", "desc": "5.5mil Natural Kraft Label"}, {"id": "516SGO", "desc": "60# Semi-Gloss Opaque (Black)"}, {"id": "520CWS", "desc": "80# Cotton Wet Strength"}, {"id": "521PLA", "desc": "2mil Clear PLA"}, {"id": "523CBOPP", "desc": "2mil Clear BOPP"}, {"id": "524WPET", "desc": "2mil White Polyester"}, {"id": "529WPO", "desc": "3 Mil White MDO"}, {"id": "530WPO", "desc": "8 Mil White Tyvek"}, {"id": "536SWP", "desc": "3 Mil White Synthetic Paper"}, {"id": "537CBOPP", "desc": "2 Mil Clear Bopp Polypropylene"}, {"id": "540FWP", "desc": "Cane Fiber Paper White"}, {"id": "541WBL", "desc": "FSC Certified Paper Label"}, {"id": "544WPO", "desc": "2.5 Mil White Polyolefin"}, {"id": "545CPO", "desc": "Clear Coex Polyolefin"}, {"id": "546WCP", "desc": "White Coex Polyolefin"}, {"id": "547CPO", "desc": "2.5 Mil Clear Polyolefin"}, {"id": "550WPO", "desc": "3 Mil White Polyolefin"}, {"id": "551WPO", "desc": "2 Mil White Polyolefin"}, {"id": "552SF", "desc": "Silver Foil"}, {"id": "555CBOPP", "desc": "2 Mil Clear BOPP"}, {"id": "STD #", "desc": "Face"}];
const SPEC_VARNISHES=["NONE", "GLOSS VARNISH-WB", "UV GLOSS VARNISH", "UV MATTE VARNISH", "UV GLOSS VARNISH-FGP", "UV GLOSS VARNISH-DBV", "SPOT UV GLOSS VARNISH", "SPOT UV MATTE VARNISH", "SPOT FDA APPROVED VARNISH", "SPOT MATTE VARNISH- DBV", "FDA APPROVED VARNISH-DBG", "FDA APPROVED VARNISH-DBM", "FDA APPROVED VARNISH", "Matte Varinsh-DBV", "FDA APPROVED VARNISH/MATTE", "Thermal Imp. Varnish-WB", "CCM134-Matte Varnish", "GLOSS VARNISH-DBV", "UV GLOSS VARNISH-DBV1", "Soft Touch-DBV", "SPOT UV VARNISH/SOFT TOUCH MATTE", "UV Thermal Varnish", "CCM200 / Matte Varnish", "CCM200 / CCM300 Gloss", "CCM200 / UV Gloss Varnish", "CCM110-Matte/SPT Gloss UV Varn.", "Matte /Soft Touch- DBV", "Satin Varnish", "Spot Matte Varnish-CCM110"];

// ═══════════════════════════════════════════════════════════════
// SECTION 6: SPEC LIST MANAGEMENT
// Functions: getSpecList, addSpecItem, removeUserSpecItem, deleteSpec,
//            editSpec, showSpecManager, addNewDie, addNewSpec,
//            addNewVarnish, filterSpecList, pickDieFromModal
// Dependencies: SPEC_DIES/FILMS/LABELS/VARNISHES, localStorage,
//              openModal, closeModal, toast
// ═══════════════════════════════════════════════════════════════

// DATA-01 fix (2026-05-24): Spec overlays now persist to Firestore so
// teammates share material additions. Hard-coded SPEC_DIES/SPEC_FILMS/etc.
// arrays remain the base; this overlay is merged on top.
// Firestore shape: materialsCatalog/{type} = { items: [...], updatedAt, updatedBy }
const SPEC_KEYS={dies:'mfx_spec_dies',films:'mfx_spec_films',labels:'mfx_spec_labels',varnishes:'mfx_spec_varnishes'}; // legacy localStorage keys, kept for one-time migration
const _specOverlay={dies:[],films:[],labels:[],varnishes:[]};
window._specOverlay=_specOverlay;
var _specOverlayListening=false;
function _startSpecOverlayListeners(){
  if(_specOverlayListening||typeof fbDb==='undefined')return;
  _specOverlayListening=true;
  ['dies','films','labels','varnishes'].forEach(function(type){
    _coreListeners.push(fbDb.collection('materialsCatalog').doc(type).onSnapshot(function(doc){
      _specOverlay[type]=(doc.exists&&Array.isArray(doc.data().items))?doc.data().items:[];
    },function(err){console.warn('specOverlay '+type+':',err.message)}));
  });
}
function _migrateLocalSpecOverlayOnce(){
  if(typeof fbDb==='undefined')return;
  if(localStorage.getItem('mfx_spec_migrated_v1')==='1')return;
  Promise.all(['dies','films','labels','varnishes'].map(function(type){
    return fbDb.collection('materialsCatalog').doc(type).get().then(function(doc){
      var serverItems=(doc.exists&&Array.isArray(doc.data().items))?doc.data().items:[];
      try{
        var localItems=JSON.parse(localStorage.getItem(SPEC_KEYS[type])||'[]');
        if(!localItems.length)return;
        if(serverItems.length)return; // server already has data; don't overwrite
        return fbDb.collection('materialsCatalog').doc(type).set({items:localItems,migratedAt:new Date().toISOString(),migratedBy:(typeof getUserName==='function'?getUserName():'unknown')});
      }catch(e){console.warn('spec migrate '+type+':',e)}
    });
  })).then(function(){
    localStorage.setItem('mfx_spec_migrated_v1','1');
    if(window.location.hostname.indexOf('localhost')<0)console.info('[DATA-01] localStorage spec overlay migrated to Firestore');
  }).catch(function(e){console.warn('spec migrate:',e)});
}
function getSpecList(type){
  const base={dies:SPEC_DIES,films:SPEC_FILMS,labels:SPEC_LABELS,varnishes:SPEC_VARNISHES}[type]||[];
  return[...base,...(_specOverlay[type]||[])];
}
function addSpecItem(type,item){
  if(typeof fbDb==='undefined'){console.warn('addSpecItem: no fbDb');return Promise.resolve(false);}
  return fbDb.collection('materialsCatalog').doc(type).set({
    items:firebase.firestore.FieldValue.arrayUnion(item),
    updatedAt:new Date().toISOString(),
    updatedBy:(typeof getUserName==='function'?getUserName():'unknown')
  },{merge:true}).then(function(){
    // Apply locally so the re-render right after .then() sees the new entry
    // without waiting for the snapshot listener round-trip.
    const id=typeof item==='object'?item.id:item;
    const overlay=(_specOverlay[type]||[]).slice();
    if(!overlay.some(function(x){return(typeof x==='object'?x.id:x)===id})){
      overlay.push(item);
      _specOverlay[type]=overlay;
    }
    return true;
  }).catch(function(e){
    console.error('addSpecItem('+type+'):',e);
    if(typeof toast==='function')toast('Save failed: '+(e.message||'check connection / permissions'),'err');
    return false;
  });
}
// Upsert: replace existing entry with matching id, or add if none exists.
// Used by the edit-material flow so SKUs already in the overlay get updated
// in place instead of duplicated via arrayUnion.
//
// IMPORTANT: We also write the new array to the local _specOverlay BEFORE
// resolving the promise. The Firestore snapshot listener will fire later
// and overwrite this with the server-confirmed value, but the local update
// means renders triggered immediately after .then() see the new data
// without waiting for the round-trip. Fixes the "I saved but it didn't
// show up" bug.
window.upsertSpecItem=function(type,item){
  if(typeof fbDb==='undefined'){console.warn('upsertSpecItem: no fbDb');return Promise.resolve(false);}
  const id=typeof item==='object'?item.id:item;
  const overlay=(_specOverlay[type]||[]).slice();
  const filtered=overlay.filter(function(x){return(typeof x==='object'?x.id:x)!==id;});
  filtered.push(item);
  return fbDb.collection('materialsCatalog').doc(type).set({
    items:filtered,
    updatedAt:new Date().toISOString(),
    updatedBy:(typeof getUserName==='function'?getUserName():'unknown')
  },{merge:true}).then(function(){
    // Apply locally so the immediately-following re-render sees the change
    _specOverlay[type]=filtered;
    return true;
  }).catch(function(e){
    console.error('upsertSpecItem('+type+'):',e);
    if(typeof toast==='function')toast('Save failed: '+(e.message||'check connection / permissions'),'err');
    return false;
  });
};
function removeUserSpecItem(type,idx){
  const base={dies:SPEC_DIES,films:SPEC_FILMS,labels:SPEC_LABELS,varnishes:SPEC_VARNISHES}[type]||[];
  const realIdx=idx-base.length;
  if(realIdx<0||realIdx>=(_specOverlay[type]||[]).length)return Promise.resolve(false);
  const item=_specOverlay[type][realIdx];
  return fbDb.collection('materialsCatalog').doc(type).set({
    items:firebase.firestore.FieldValue.arrayRemove(item),
    updatedAt:new Date().toISOString(),
    updatedBy:(typeof getUserName==='function'?getUserName():'unknown')
  },{merge:true}).then(function(){return true;}).catch(function(e){console.error('removeUserSpecItem:',e);return false;});
}
function deleteSpec(type,id){
  if(!confirm('Delete this spec? Other teammates will lose access to it too.'))return;
  const overlay=(_specOverlay[type]||[]).slice();
  const newOverlay=overlay.filter(function(x){return(typeof x==='object'?x.id:x)!==id;});
  return fbDb.collection('materialsCatalog').doc(type).set({
    items:newOverlay,
    updatedAt:new Date().toISOString(),
    updatedBy:(typeof getUserName==='function'?getUserName():'unknown')
  },{merge:true}).then(function(){
    if(typeof toast==='function')toast('Deleted','ok');
    if(typeof showSpecManager==='function')showSpecManager(type);
  }).catch(function(e){
    console.error('deleteSpec:',e);
    if(typeof toast==='function')toast('Delete failed — check connection','err');
  });
}
function editSpec(type,id){
  const list=getSpecList(type);
  const item=list.find(function(x){return(typeof x==='object'?x.id:x)===id;});
  if(!item||typeof item!=='object')return;
  const desc=prompt('Description:',item.desc||item.d||'');
  if(desc!==null)item.desc=desc;
  const notes=prompt('Notes:',item.notes||'');
  if(notes!==null)item.notes=notes;
  const overlay=(_specOverlay[type]||[]).slice();
  const idx=overlay.findIndex(function(x){return x.id===id;});
  if(idx>=0)overlay[idx]=item;else overlay.push(item);
  return fbDb.collection('materialsCatalog').doc(type).set({
    items:overlay,
    updatedAt:new Date().toISOString(),
    updatedBy:(typeof getUserName==='function'?getUserName():'unknown')
  },{merge:true}).then(function(){
    if(typeof toast==='function')toast('Updated','ok');
    if(typeof showSpecManager==='function')showSpecManager(type);
  }).catch(function(e){console.error('editSpec:',e);if(typeof toast==='function')toast('Save failed','err');});
}
function showSpecManager(type){
const titles={dies:'Die List',films:'Flexible Film List',labels:'Label Stock List',varnishes:'Varnish List'};
const list=getSpecList(type);const base={dies:SPEC_DIES,films:SPEC_FILMS,labels:SPEC_LABELS,varnishes:SPEC_VARNISHES}[type]||[];
let h=`<div class="modal-title">${titles[type]} (${list.length})</div><div style="max-height:55vh;overflow-y:auto;margin-bottom:10px">`;
h+=`<input type="text" id="specSearchInput" placeholder="Search..." oninput="filterSpecList()" style="width:100%;padding:6px 8px;margin-bottom:8px;border:1px solid var(--bdr);border-radius:4px;font-size:11px">`;
h+=`<div id="specListItems">`;
if(type==='dies'){
h+=list.map((d,i)=>`<div class="spec-row" data-search="${(d.id+' '+d.shape+' '+d.sA+' '+d.sAr+' '+d.notes).toLowerCase()}" style="padding:8px 4px;border-bottom:1px solid var(--bdr);font-size:11px;display:flex;justify-content:space-between;align-items:center"><div style="cursor:pointer" onclick="pickDieFromModal('${d.id}')"><strong style="color:var(--ac)">${d.id}</strong> ${d.shape} ${d.sA}×${d.sAr}${d.notes?'<div style=font-size:10px;color:var(--tx3)>'+d.notes+'</div>':''}</div><div style="display:flex;gap:3px"><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();editSpec('dies','${d.id}')">✏️</button><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();deleteSpec('dies','${d.id}')">🗑</button></div></div>`).join('');
}else if(type==='varnishes'){
h+=list.map((v,i)=>`<div class="spec-row" data-search="${v.toLowerCase()}" style="padding:6px 4px;border-bottom:1px solid var(--bdr);font-size:11px;display:flex;justify-content:space-between;align-items:center"><div>${v}</div><div style="display:flex;gap:3px"><button class="btn btn-ghost btn-xs" onclick="deleteSpec('varnishes','${v}')">🗑</button></div></div>`).join('');
}else{
h+=list.map((d,i)=>`<div class="spec-row" data-search="${(d.id+' '+d.desc).toLowerCase()}" style="padding:6px 4px;border-bottom:1px solid var(--bdr);font-size:11px;display:flex;justify-content:space-between;align-items:center"><div style="cursor:pointer" onclick="closeModal();openMatProfile('${d.id}')"><strong style="color:var(--ac)">${d.id}</strong> — ${d.desc}</div><div style="display:flex;gap:3px"><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();editSpec('${type}','${d.id}')">✏️</button><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();deleteSpec('${type}','${d.id}')">🗑</button></div></div>`).join('');
}
h+=`</div></div>`;
if(type==='dies')h+=`<button class="btn btn-pr btn-sm" onclick="addNewDie()">+ Add Die</button>`;
else if(type==='varnishes')h+=`<button class="btn btn-pr btn-sm" onclick="addNewVarnish()">+ Add Varnish</button>`;
else h+=`<button class="btn btn-pr btn-sm" onclick="addNewSpec('${type}')">+ Add ${type==='films'?'Film':'Label Stock'}</button>`;
h+=`<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="margin-left:6px">Close</button>`;
openModal(h)}
function addNewDie(){const id=prompt('Die # (e.g. AG1999):');if(!id)return;const shape=prompt('Shape:')||'';const sA=prompt('Size Across:')||'';const sAr=prompt('Size Around:')||'';
Promise.resolve(addSpecItem('dies',{id:id.trim(),shape,blankSize:'',cutTo:'',sA,sAr,repeat:'',nA:'',nAr:'',gapAr:'',gapA:'',cRad:'',gearTooth:'',notes:'User added by '+(typeof getUserName==='function'?getUserName():'unknown'),createdAt:new Date().toISOString()})).then(function(ok){if(ok){toast('Die added','ok');showSpecManager('dies')}})}
// Open a proper modal form for adding a new material spec (label stock / film /
// varnish). Replaces the old chained-prompt() flow. Captures SKU, description,
// vendor, MSI cost, markup MSI, and notes — these get persisted to
// materialsCatalog/{type} and also feed the combobox dropdown going forward.
function addNewSpec(type){
  const isVarn=(type==='varnishes');
  const typeLabel=type==='films'?'Film':(type==='labels'?'Label Stock':(isVarn?'Varnish':type));
  const userName=typeof getUserName==='function'?getUserName():'unknown';
  let h='<div class="modal-title">Add '+typeLabel+'</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Will be added to the materials catalog and available in the combobox.</div>';
  h+='<div class="fg"><label>SKU / ID <span class="req">*</span></label><input id="nspec-id" placeholder="e.g. 539SHP" autocomplete="off"></div>';
  h+='<div class="fg"><label>Description '+(isVarn?'<span style="font-weight:400;color:var(--tx3)">(optional)</span>':'<span class="req">*</span>')+'</label><input id="nspec-desc" placeholder="e.g. White Semi-Gloss Paper, 60lb" autocomplete="off"></div>';
  h+='<div class="row2"><div class="fg"><label>Vendor</label><input id="nspec-vendor" placeholder="e.g. Spinnaker" autocomplete="off"></div><div class="fg"><label>MSI cost <span style="font-weight:400;color:var(--tx3)">($)</span></label><input id="nspec-msi" type="number" step="0.001" min="0" placeholder="0.129"></div></div>';
  h+='<div class="row2"><div class="fg"><label>Markup MSI <span style="font-weight:400;color:var(--tx3)">(optional)</span></label><input id="nspec-mk" type="number" step="0.001" min="0" placeholder="0.155"></div><div class="fg"><label>Notes</label><input id="nspec-notes" placeholder="Internal notes (optional)" autocomplete="off"></div></div>';
  h+='<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-pr btn-sm" id="nspec-save" onclick="_submitNewSpec(\''+type+'\')">Save</button><button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancel</button></div>';
  openModal(h);
  // Autofocus the SKU field
  setTimeout(function(){var el=$('nspec-id');if(el)el.focus();},50);
}
window._submitNewSpec=function(type){
  const idEl=$('nspec-id');const descEl=$('nspec-desc');
  const id=(idEl?idEl.value:'').trim();
  const desc=(descEl?descEl.value:'').trim();
  if(!id){if(typeof toast==='function')toast('SKU is required','err');if(idEl)idEl.focus();return;}
  const isVarn=(type==='varnishes');
  if(!isVarn && !desc){if(typeof toast==='function')toast('Description is required','err');if(descEl)descEl.focus();return;}
  const vendor=(($('nspec-vendor')||{}).value||'').trim();
  const msiRaw=(($('nspec-msi')||{}).value||'').trim();
  const mkRaw=(($('nspec-mk')||{}).value||'').trim();
  const notes=(($('nspec-notes')||{}).value||'').trim();
  const userName=typeof getUserName==='function'?getUserName():'unknown';
  // Disable button while in flight
  const btn=$('nspec-save');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  // Varnish items are still strings in the old shape — preserve compatibility.
  // Object items for label/film carry full metadata.
  let item;
  if(isVarn && !vendor && !msiRaw && !mkRaw && !notes && !desc){
    item=id; // legacy string shape preserved
  } else {
    item={id:id, desc:desc||'', createdAt:new Date().toISOString(), createdBy:userName};
    if(vendor) item.vendor=vendor;
    if(msiRaw!=='' && !isNaN(parseFloat(msiRaw))) item.msi=parseFloat(msiRaw);
    if(mkRaw!=='' && !isNaN(parseFloat(mkRaw))) item.mk=parseFloat(mkRaw);
    if(notes) item.notes=notes;
  }
  // Use upsert so re-saving an existing SKU replaces in place (edit flow);
  // first-time adds work the same way since the filter step is a no-op.
  Promise.resolve(window.upsertSpecItem?upsertSpecItem(type,item):addSpecItem(type,item)).then(function(ok){
    if(ok){
      if(typeof toast==='function')toast('Saved — material details updated','ok');
      // Rebuild combobox datalists so the change shows immediately
      if(typeof buildMS==='function'){
        if(type==='labels')buildMS('ed-fs', (typeof S!=='undefined' && getQ(S.editId))?getQ(S.editId).fields.faceStock:undefined);
        if(type==='films')buildMS('ed-lam', (typeof S!=='undefined' && getQ(S.editId))?getQ(S.editId).fields.lamination:undefined);
      }
      if(type==='varnishes' && typeof buildVarnishSelect==='function'){
        buildVarnishSelect((typeof S!=='undefined' && getQ(S.editId))?getQ(S.editId).fields.coating:undefined);
      }
      // Refresh inline detail card if the editor is open
      if(typeof renderMatDetail==='function'){
        if(type==='labels')renderMatDetail('faceStock');
        if(type==='films')renderMatDetail('lamination');
        if(type==='varnishes')renderMatDetail('coating');
      }
      closeModal();
    } else {
      if(btn){btn.disabled=false;btn.textContent='Save';}
    }
  });
};
// Compat shim — addNewVarnish was a separate function. Route to the new form.
function addNewVarnish(){ addNewSpec('varnishes'); }
function filterSpecList(){const q=($('specSearchInput')||{}).value||'';const rows=document.querySelectorAll('.spec-row');const ql=q.toLowerCase();rows.forEach(r=>{const s=r.getAttribute('data-search')||'';r.style.display=ql===''||s.includes(ql)?'flex':'none'})}

function pickDieFromModal(dieId){closeModal();
const sel=$('ed-die');if(sel){sel.value=dieId;selectDie();toast('Die '+dieId+' selected','ok')}else{
const dies=getSpecList('dies');const d=dies.find(x=>x.id===dieId);if(!d)return;
inspectDie(dieId)}}

// ═══════════════════════════════════════════════════════════════
// SECTION 7: APP STATE & UTILITY FUNCTIONS
// Variables: S (view state), FDEF (field defaults), DEFAULT_TERMS,
//            QDEF (quantity defaults)
// Functions: f5$, fN, fD, uid, toast, genQN, genQNServer,
//            nextRev, togCard, openModal, closeModal
// Dependencies: $, localStorage, getUserName
// ═══════════════════════════════════════════════════════════════

// Lazy module loader — load JS only when view is first accessed
window._loadedModules = {};
window.lazyLoad = function(src) {
  if (window._loadedModules[src]) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function() { window._loadedModules[src] = true; resolve(); };
    s.onerror = function() { reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
};

let S={view:'dashboard',editId:null,profileId:null,etab:0,qFilter:'all',qSearch:'',cSearch:''};
// Round 64 — defaults adjusted per cylinder-math audit:
//   matSetup 3500 → 400 (industry typical 200-500 ft of waste/setup)
//   mrHrs    2    → 0.5 (per-SKU increment; was bundled flat)
//   cuHrs    2    → 0   (per-SKU; was bundled flat)
//   mrBaseHrs NEW 2     (one-time make-ready base hours)
//   cuBaseHrs NEW 2     (one-time clean-up base hours)
//   overagePct NEW 20   (replaces hard-coded 1.2 in 4 places)
//   edgeTrim   NEW 0.875 (replaces hard-coded 0.875 in 3 places)
//   gearTooth/blankSize/repeat seeded so the calc engine can validate fit
// Round 66: Shannon pouch forming fields added.
//   pouchType: 'none' | 'sup' | 'flat'  (default 'none' = label-only)
//   pouchWidthIn: face width for the matrix lookup
//   pouchHeightIn: stored but not yet priced (info only)
//   pouchZipper / pouchCRZipper / pouchGusset: boolean add-ons
//                                              (gusset forces sup)
//   pouchCopies: SKU count for multi-SKU adder; defaults to skuCols.
// Round 67: cartoning (display box + master shipper) fields added.
//   pouchesPerDisplay: # pouches per display box (0 = no displays)
//   cartonCols/Rows/Stacks: master shipper stacking pattern
//   displayCostEa / masterCostEa: $ per display / master (supplier-priced)
//   displayMaterial / displayCoating / displayStyle / displayColors:
//     descriptive only (info for the PO to the carton vendor)
//   masterMaterial / masterStyle: same
const FDEF={estimator:'',jobType:'Flexographic',salesRep:'',payTerms:'Net 30',custCo:'',custAttn:'',custPhone:'',custEmail:'',jobDesc:'',copyPos:'3BOE',shapeType:'Rectangle Label',sA:6,sar:6,nAcross:1,nAround:1,colors:4,gA:0.125,gar:0.125,cRad:0.125,nCopies:1,nPlates:1,offCuts:0,blankSize:'',gearTooth:0,repeat:'',labRoll:'TBD',maxOD:'15"',windDir:'TBD',coreDia:'TBD',faceStock:'539SHP',lamination:'557SW',liner:'NA',adhesive:'NA',coating:'NA',otherMat:'NA',notes:'',msiCost:0.129,stockMgn:2.0,matSetup:400,overagePct:20,edgeTrim:0.875,mkupPct:15,cppPlate:20,plPerSku:1,ccCost:80,nCC:2,mrHrs:0.5,mrBaseHrs:2,mrRate:200,cuHrs:0,cuBaseHrs:2,cuRate:100,dieChg:0,plCost:3,repPct:0,skuCols:1,showMode:'both',qStart:10000,qStep:5000,qRows:1,pouchType:'none',pouchWidthIn:0,pouchHeightIn:0,pouchZipper:false,pouchCRZipper:false,pouchGusset:false,pouchesPerDisplay:0,cartonCols:1,cartonRows:1,cartonStacks:1,displayCostEa:0,masterCostEa:0,displayMaterial:'',displayCoating:'',displayStyle:'',displayColors:'',masterMaterial:'',masterStyle:''};
const DEFAULT_TERMS=[
'Quote valid for 30 days from date of issue.',
'Subject to artwork review and approval.',
'Plates remain property of Microflex Film Corp until paid in full.',
'Lead time is 15 working days from proof sign off.',
'Quantities shipped are ±10% of order quantity.',
'For stand up gusset bags, quantity tolerance is ±20%.',
'Stability testing must be done prior to running order.',
'Material approval form must be signed after testing is concluded.',
'Art will be billed at $90.00/hour if art is not in AI format.'
];
const QDEF=[10000];

// $ and f$ moved to top of file
const f5$=n=>'$'+n.toFixed(5);
const fN=n=>n.toLocaleString();
const fD=d=>{if(!d)return'—';try{var dt=new Date(d);return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}catch(e){return'—'}};
const uid=()=>'q'+Date.now()+Math.random().toString(36).slice(2,6);
function toast(msg,type){const t=$('toast');t.className='toast';t.style.background=type==='ok'?'var(--gn)':type==='err'?'var(--rd)':'var(--ac2)';t.style.color=type==='ok'?'#000':'#fff';t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',3000)}
function genQN(){var d=new Date(),yy=String(d.getFullYear()).slice(2),mm=String(d.getMonth()+1).padStart(2,'0');var r=Math.floor(Math.random()*9000)+1000;return 'MF'+yy+mm+'-T'+r}
// Firestore atomic counter — guarantees unique numbers across all users
function genQNFirestore(){
  if(!window.fbDb){console.error('genQNFirestore: fbDb not ready');return Promise.reject(new Error('fbDb not ready'))}
  var d=new Date(),yy=String(d.getFullYear()).slice(2),mm=String(d.getMonth()+1).padStart(2,'0');
  var prefix='MF'+yy+mm;
  var counterRef=window.fbDb.collection('counters').doc('quoteNumber');
  return window.fbDb.runTransaction(function(tx){
    return tx.get(counterRef).then(function(doc){
      var data=doc.exists?doc.data():{};
      var currentPrefix=data.prefix||'';
      var seq;
      if(!doc.exists||currentPrefix!==prefix){
        // First time or new month — scan existing quotes to find highest seq
        var maxSeq=0;
        try{var qs=DB.quotes();qs.forEach(function(q){if(q.quoteNum&&q.quoteNum.indexOf(prefix+'-')===0){var s=parseInt(q.quoteNum.split('-')[1]);if(!isNaN(s)&&s>maxSeq)maxSeq=s}})}catch(e){}
        seq=maxSeq+1;
      }else{
        seq=(data.seq||0)+1;
      }
      tx.set(counterRef,{prefix:prefix,seq:seq,updatedAt:new Date().toISOString()});
      return prefix+'-'+String(seq).padStart(3,'0');
    });
  });
}
async function genQNServer(){
  // DATA-15 fix (2026-05-24): go straight to requestServerNumber. The old
  // genQNFirestore() path is dead under SEC-10 rules (counters/* is now
  // server-write-only). Kept defined above for back-compat but no longer
  // tried first — that was producing noisy console errors and a wasted RTT.
  if(typeof requestServerNumber==='function'){
    try{return await requestServerNumber('quote',function(){return genQN()})}
    catch(e){console.warn('genQNServer requestServerNumber fail:',e&&e.message)}
  }
  return genQN();
}
function nextRev(r){return r?String.fromCharCode(r.charCodeAt(0)+1):'A'}
function togCard(h){const o=h.classList.toggle('open');h.nextElementSibling.classList.toggle('open',o)}
function openModal(html){$('modalContent').innerHTML=html;$('modalBg').classList.add('open');
window._prevFocus = document.activeElement;
// Focus the first focusable element in the modal
setTimeout(function() {
  var focusable = document.querySelector('#modalContent button, #modalContent input, #modalContent select, #modalContent a');
  if (focusable) focusable.focus();
}, 100);
}
function closeModal(){$('modalBg').classList.remove('open');
if (window._prevFocus) { try { window._prevFocus.focus(); } catch(e) {} }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 8: NAVIGATION
// Functions: goView, openEditor, exitEditor
// Data: renderers map, titles map, tab index map
// Dependencies: S, renderDash, renderQuotes, renderCust, renderTpl,
//              renderEditor, updateAlertStrip, updateBottomBar,
//              MFX_VIEW_RENDERERS, MFX_VIEW_TITLES (external)
// ═══════════════════════════════════════════════════════════════

// ═══ DEPARTMENT COLOR THEMING (must be above goView) ═══
var DEPT_CLASSES=['dept-cs','dept-production','dept-logistics','dept-quality','dept-finance','dept-fsqms','dept-ops','ppd-mode','dept-flexai'];
var VIEW_TO_DEPT={
quotes:'dept-cs',customers:'dept-cs',orders:'dept-cs',templates:'dept-cs',
clientservices:'dept-cs',sales:'dept-cs',vendorpos:'dept-cs',vendorprofile:'dept-cs',
ppd:'ppd-mode',
production:'dept-production',jobtracker:'dept-production',operator:'dept-production',
logistics:'dept-logistics',
quality:'dept-quality',
accounting:'dept-finance',finance:'dept-finance',
gmp:'dept-fsqms',capa:'dept-fsqms',audit:'dept-fsqms',training:'dept-fsqms',
doccontrol:'dept-fsqms',sqfdatalogs:'dept-fsqms',fsqms:'dept-fsqms',records:'dept-fsqms',
operations:'dept-ops',
'dept-cs-home':'dept-cs','dept-pp-home':'ppd-mode','dept-production-home':'dept-production','dept-logistics-home':'dept-logistics',
'dept-quality-home':'dept-quality','dept-finance-home':'dept-finance','dept-operations-home':'dept-ops',
'dept-fsqms-home':'dept-fsqms','dept-flexai-home':null,
'aiops':null,'dept-jt-home':null
};
var VIEW_TO_COLOR={
'dept-cs':'#a855f7','ppd-mode':'#d7ff2f','dept-production':'#4169E1',
'dept-logistics':'#f59e0b','dept-quality':'#ef4444','dept-finance':'#22c55e',
'dept-fsqms':'#FFD700','dept-ops':'#C0C0C0'
};
// View → department info for topbar
var VIEW_DEPT_INFO={
quotes:{dept:'Client Services',pod:'Estimation',short:'CS'},
customers:{dept:'Client Services',pod:'Sales',short:'CS'},
orders:{dept:'Client Services',pod:'Sales',short:'CS'},
templates:{dept:'Client Services',pod:'Estimation',short:'CS'},
clientservices:{dept:'Client Services',pod:'Workspace',short:'CS'},
sales:{dept:'Client Services',pod:'Sales',short:'CS'},
vendorpos:{dept:'Client Services',pod:'Purchasing',short:'CS'},
vendorprofile:{dept:'Client Services',pod:'Purchasing',short:'CS'},
ppd:{dept:'Pre-Press',pod:'Design & Proofing',short:'PP'},
production:{dept:'Production',pod:'Manufacturing',short:'PROD'},
jobtracker:{dept:'Production',pod:'Job Tickets',short:'PROD'},
operator:{dept:'Production',pod:'Operator Station',short:'PROD'},
logistics:{dept:'Logistics & Shipping',pod:'Supply Chain',short:'LOG'},
quality:{dept:'Quality',pod:'Compliance',short:'QA'},
capa:{dept:'Quality',pod:'CAPA / NCR',short:'QA'},
accounting:{dept:'Finance',pod:'Accounting',short:'FIN'},
finance:{dept:'Finance',pod:'Workspace',short:'FIN'},
gmp:{dept:'FSQMS',pod:'GMP & Environmental',short:'SQF'},
audit:{dept:'FSQMS',pod:'SQF Audits',short:'SQF'},
training:{dept:'FSQMS',pod:'Training',short:'SQF'},
doccontrol:{dept:'FSQMS',pod:'Document Control',short:'SQF'},
sqfdatalogs:{dept:'FSQMS',pod:'Data Logs',short:'SQF'},
records:{dept:'FSQMS',pod:'Controlled Records',short:'SQF'},
hr:{dept:'Operations',pod:'HR / People',short:'OPS'},
operations:{dept:'Operations',pod:'Workspace',short:'OPS'},
ceodash:{dept:'FlexAi',pod:'Daily Dash',short:'AI'},
dashboard:{dept:'FlexAi',pod:'Home',short:'AI'},
launchpad:{dept:'FlexAi',pod:'Onboarding',short:'AI'},
datasync:{dept:'FlexAi',pod:'Data Sync',short:'AI'},
'dept-cs-home':{dept:'Client Services',pod:'Workspace',short:'CS'},
'dept-pp-home':{dept:'Pre-Press',pod:'Workspace',short:'PP'},
'dept-production-home':{dept:'Production',pod:'Workspace',short:'PROD'},
'dept-logistics-home':{dept:'Logistics',pod:'Workspace',short:'LOG'},
'dept-quality-home':{dept:'Quality',pod:'Workspace',short:'QA'},
'dept-finance-home':{dept:'Finance',pod:'Workspace',short:'FIN'},
'dept-operations-home':{dept:'Operations',pod:'Workspace',short:'OPS'},
'dept-fsqms-home':{dept:'FSQMS',pod:'Workspace',short:'SQF'},
'dept-flexai-home':{dept:'FlexAi',pod:'Workspace',short:'AI'},
'aiops':{dept:'FlexAi',pod:'AI Operations',short:'AI'}
};

function applyDeptTheme(v){
var body=document.body;
var deptClass=VIEW_TO_DEPT[v]||null;
DEPT_CLASSES.forEach(function(c){body.classList.remove(c)});
if(deptClass)body.classList.add(deptClass);
var color=deptClass?VIEW_TO_COLOR[deptClass]||'#00e5ff':'#00e5ff';
// Bottom bar, time, dot stay cyan always — no dept color override
// Topbar — department name, pod, badge
var info=VIEW_DEPT_INFO[v]||{dept:'MFX OS',pod:'Home',short:'MFX'};
var nameEl=$('topUserName');if(nameEl)nameEl.textContent=info.dept;
var roleEl=$('topUserRole');if(roleEl){roleEl.textContent=info.pod;roleEl.style.color=color}
var badge=$('topDeptBadge');
if(badge){badge.textContent=info.short;badge.style.background=color;badge.style.color=isLightColor(color)?'#000':'#fff'}
}
window.applyDeptTheme=applyDeptTheme;
function isLightColor(hex){if(!hex||hex.charAt(0)!=='#')return true;var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000>150}

function goView(v){
// PERF-09 fix (2026-05-24): lazy-load chunk for views that live in chat/ai bundles.
// _reentry guard prevents infinite recursion if chunk's onload eventually re-calls goView.
if(!goView._reentry){
  var __chunk = (window.VIEW_CHUNK_MAP||{})[v];
  if(__chunk && typeof loadChunk==='function' && !_loadedChunks[__chunk]){
    goView._reentry = true;
    loadChunk(__chunk).then(function(){
      goView._reentry = false;
      goView(v);
    }).catch(function(err){
      goView._reentry = false;
      console.error('Chunk load failed for '+v+':', err);
      if(typeof toast==='function') toast('Failed to load '+v+' module — refresh and retry','err');
    });
    return;
  }
}
goView._reentry = false;
// ═══ DEPARTMENT ACCESS GATE ═══
if(window.CURRENT_USER&&CURRENT_USER.dept&&typeof isViewAllowedForDept==='function'){
  if(!isViewAllowedForDept(v,CURRENT_USER.dept,CURRENT_USER.role)){
    if(typeof toast==='function')toast('Access restricted — '+v+' is not available for your department','err');
    console.warn('[Dept Gate] Blocked: '+v+' not allowed for dept='+CURRENT_USER.dept+' role='+CURRENT_USER.role);
    return;
  }
}
if (window._dashRefreshTimer && v !== 'dashboard') {
  clearInterval(window._dashRefreshTimer);
  window._dashRefreshTimer = null;
}
// Tear down module-specific intervals/listeners when leaving their views
if(v !== 'vendorpos' && v !== 'vendorprofile' && typeof clearVendorWorkspaceIntervals==='function') clearVendorWorkspaceIntervals();
if(v !== 'sqfdatalogs' && v !== 'sqfalerts' && typeof clearSqfAlertIntervals==='function') clearSqfAlertIntervals();
S.view=v;
if($('bottomBar'))$('bottomBar').style.display='flex';
if(typeof updateAlertStrip==='function')updateAlertStrip();
S.editId=null;S.profileId=null;
document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});
var ve=$('v-'+v);if(ve)ve.classList.add('active');
if($('mainTabs'))$('mainTabs').style.display='none';
if($('hdrBack'))$('hdrBack').style.display='none';
if($('hdrBack'))$('hdrBack').onclick=function(){return exitEditor()};
if($('hdrActions'))$('hdrActions').innerHTML='';
var ti=Object.assign({dashboard:0,quotes:1,ceodash:2,orders:3,ppd:4,production:5,jobtracker:6,customers:7,templates:8,clientservices:9,vendorpos:10,logistics:11,datasync:12,sales:-1,vendorprofile:-1,gmp:-1,capa:-1,audit:-1,training:-1,doccontrol:-1,hr:-1,operator:-1,launchpad:-1,sqfdatalogs:-1,fsqms:-1,records:-1},window.MFX_TAB_INDEX||{});
document.querySelectorAll('.tab').forEach(function(t,i){t.classList.toggle('active',i===ti[v])});
var renderers={
  dashboard:renderDash,
  quotes:renderQuotes,
  customers:renderCust,
  orders:typeof renderOrdersView==='function'?renderOrdersView:function(){},
  production:typeof renderProductionView==='function'?renderProductionView:function(){},
  templates:function(){renderTpl();setTimeout(appendRFQToLibrary,200)},
  ceodash:typeof renderCEODash==='function'?renderCEODash:function(){},
  jobtracker:typeof renderJobTracker==='function'?renderJobTracker:function(){},
  datasync:typeof renderDataSync==='function'?renderDataSync:function(){}
};
if(window.MFX_VIEW_RENDERERS)Object.assign(renderers,window.MFX_VIEW_RENDERERS);
// Lazy module map — infrastructure for future on-demand loading
var LAZY_MODULES = {
  logistics: 'js/logistics.js',
  gmp: 'js/gmp.js',
  capa: 'js/capa.js',
  audit: 'js/audit.js',
  training: 'js/training.js',
  doccontrol: 'js/doccontrol.js',
  hr: 'js/hr.js',
  operator: 'js/operator.js',
  launchpad: 'js/launchpad.js',
  sqfdatalogs: 'js/sqf-datalogs.js',
  fsqms: 'js/fsqms-module.js'
};
window._loadedModules = window._loadedModules || {};
if (LAZY_MODULES[v] && !window._loadedModules[LAZY_MODULES[v]] && !renderers[v]) {
  // Module not yet loaded — attempt on-demand load (future use when scripts are deferred)
  lazyLoad(LAZY_MODULES[v]).then(function() {
    if (window.MFX_VIEW_RENDERERS && window.MFX_VIEW_RENDERERS[v]) {
      Object.assign(renderers, window.MFX_VIEW_RENDERERS);
      renderers[v]();
    }
  }).catch(function(e) { if(typeof toast==='function') toast('Module load failed','err'); });
  return;
}
// Merge late-registered renderers (modules that register after core.js parse)
if(window.MFX_VIEW_RENDERERS){Object.keys(window.MFX_VIEW_RENDERERS).forEach(function(k){if(!renderers[k])renderers[k]=window.MFX_VIEW_RENDERERS[k];});}
if(renderers[v]){try{renderers[v]()}catch(e){console.error('Render error ['+v+']:',e);var ve2=$('v-'+v);if(ve2)ve2.innerHTML='<div style="padding:40px;text-align:center;color:var(--rd)"><h3>Module Error</h3><p>'+esc(e.message)+'</p></div>';}}else{var ve3=$('v-'+v);if(ve3)ve3.innerHTML='<div style="padding:40px;text-align:center;color:var(--tx3)"><h3>Module Not Available</h3><p>This view is not yet implemented.</p></div>';}
var titles=Object.assign({dashboard:'Dashboard',quotes:'Quotes',ceodash:'FlexAi',orders:'Orders',ppd:'PPD · PrePress Design',production:'Production',jobtracker:'Job Tracker',customers:'Customers',templates:'Materials & Specs',vendorpos:'Vendor POs · Purchasing',vendorprofile:'Vendor Hub',datasync:'Data Sync',logistics:'Logistics & Shipping',gmp:'GMP & Environmental',capa:'CAPA / NCR',audit:'SQF Audits',training:'Training & Competency',doccontrol:'Document Control',hr:'HR / People',operator:'Operator Station',launchpad:'Launchpad',sqfdatalogs:'SQF Data Logs · Ed.10',clientservices:'Client Services',sales:'Sales',quality:'Quality',operations:'Operations',fsqms:'FSQMS · Food Safety & Quality',records:'SQF Controlled Records'},window.MFX_VIEW_TITLES||{});
if($('hdrTitle'))$('hdrTitle').textContent=titles[v]||'';
if(typeof trackView==='function')trackView(v);
if(typeof updateBottomBar==='function')updateBottomBar(v);
if(typeof applyDeptTheme==='function')applyDeptTheme(v);
if(typeof populateHamUser==='function')populateHamUser();
if(typeof window.MFX_AFTER_GO_VIEW==='function')window.MFX_AFTER_GO_VIEW(v);
// URL routing — update browser URL for back/forward
if (window.history && window.history.pushState && !window._isPopState) {
  var path = v === 'dashboard' ? '/' : '/' + v;
  if (window.location.pathname !== path) {
    window.history.pushState({ view: v }, '', path);
  }
}
}

// Browser back/forward navigation
window.addEventListener('popstate', function(e) {
  window._isPopState = true;
  if (e.state && e.state.view === 'editor' && e.state.editId) {
    openEditor(e.state.editId);
  } else if (e.state && e.state.view) {
    goView(e.state.view);
  } else {
    var path = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
    // Handle /editor/QUOTEID URLs
    if (path.indexOf('editor/') === 0) {
      var qid = path.split('/')[1];
      if (qid) { openEditor(qid); window._isPopState = false; return; }
    }
    goView(path || 'dashboard');
  }
  window._isPopState = false;
});

function openEditor(qid){const prevProfile=S.profileId;S.view='editor';S.editId=qid;if($('bottomBar'))$('bottomBar').style.display='flex';if(typeof applyDeptTheme==='function')applyDeptTheme('quotes');S.etab=0;S.profileId=prevProfile;document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));$('v-editor').classList.add('active');$('mainTabs').style.display='none';if($('hdrBack'))$('hdrBack').style.display='none';
// Update center title with quote info
var _eq=DB.quotes().find(function(q){return q.id===qid});if($('hdrTitle'))$('hdrTitle').textContent=_eq?(_eq.quoteNum||'Quote'):('Quote');
if(typeof trackView==='function')trackView('editor');
// Persist editor state to URL + sessionStorage so navigating away doesn't lose the quote
sessionStorage.setItem('mfx_editId', qid);
if (window.history && window.history.pushState && !window._isPopState) {
  var edPath = '/editor/' + qid;
  if (window.location.pathname !== edPath) {
    window.history.pushState({ view: 'editor', editId: qid }, '', edPath);
  }
}
// Wire dirty detection after render
setTimeout(function(){var edEl=$('v-editor');if(edEl){edEl.addEventListener('input',function(){if(typeof markDirty==='function')markDirty()},{once:false})}},500);
renderEditor();
// Track editing presence
if (window.fbDb && typeof getUserId === 'function') {
  window.fbDb.collection('presence').doc(getUserId()).set({
    user: getUserName(),
    editing: qid,
    view: 'editor',
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(function(e){ console.warn('presenceUpdate:',e) });

  // Watch for other editors on same quote
  if (window._editPresenceUnsub) window._editPresenceUnsub();
  window._editPresenceUnsub = window.fbDb.collection('presence')
    .where('editing', '==', qid)
    .onSnapshot(function(snap) {
      var myId = getUserId();
      var others = snap.docs.filter(function(d) { return d.id !== myId; });
      var indicator = document.getElementById('editPresenceIndicator');
      if (!indicator) {
        var hdrActions = document.getElementById('hdrActions');
        if (hdrActions) {
          hdrActions.insertAdjacentHTML('afterbegin', '<span id="editPresenceIndicator" style="font-size:11px;color:var(--or);margin-right:8px;display:none"></span>');
          indicator = document.getElementById('editPresenceIndicator');
        }
      }
      if (indicator) {
        if (others.length > 0) {
          var names = others.map(function(d) { return d.data().user || 'Someone'; }).join(', ');
          indicator.textContent = 'Also editing: ' + names;
          indicator.style.display = 'inline';
        } else {
          indicator.style.display = 'none';
        }
      }
    }, function() {});
}
}
function saveCurrentWork(){if(S.view==='editor'&&typeof saveQ==='function'){saveQ();if(typeof toast==='function')toast('Saved','ok')}if(typeof markClean==='function')markClean()}
window.saveCurrentWork=saveCurrentWork;
function exitEditor(){if(typeof markClean==='function')markClean();saveQ();sessionStorage.removeItem('mfx_editId');
// Clear editing presence
if (window.fbDb && typeof getUserId === 'function') {
  window.fbDb.collection('presence').doc(getUserId()).update({
    editing: null
  }).catch(function(e){ console.warn('presenceDisconnect:',e) });
}
if (window._editPresenceUnsub) { window._editPresenceUnsub(); window._editPresenceUnsub = null; }
if(S.profileId){openProfile(S.profileId)}else{goView('quotes')}}

// ═══════════════════════════════════════════════════════════════
// SECTION 9: QUOTE ENGINE
// Functions: newQuote, dupQuote, setQStatus, bakePricing,
//            delQuote, getQ, saveQ (editor field capture)
// Constants: VALID_TRANSITIONS (status state machine)
// Dependencies: DB, S, uid, genQN, genQNServer, requestServerNumber,
//              FDEF, QDEF, DEFAULT_TERMS, openEditor, renderEditor,
//              renderQuotes, logQuoteEvent, logClientActivity,
//              updateRegistry (external)
// ═══════════════════════════════════════════════════════════════

function newQuote(tplId){var tempNum=genQN();var q={id:uid(),quoteNum:tempNum,rev:'A',status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sentAt:null,closedAt:null,wonAmount:null,lostReason:'',customerId:null,fields:{...FDEF,quoteDate:new Date().toISOString().split('T')[0],estimator:getUserName()},qtys:[...QDEF],terms:[...DEFAULT_TERMS]};
if(tplId){var t=DB.templates().find(function(x){return x.id===tplId});if(t){Object.assign(q.fields,t.fields);q.fields.notes='';q.qtys=[...t.qtys];if(t.terms)q.terms=[...t.terms]}}
q.createdBy=getUserName();q.createdById=getUserId();
// DATA-15 fix (2026-05-24): get server-assigned quote number via the
// nextSequence Cloud Function. SEC-10 locked the counters/* collection from
// client writes, so the old genQNFirestore() client transaction never
// succeeded — every new quote was stuck with its temporary `-T####`
// placeholder. requestServerNumber routes through /api/nextSequence which
// is auth-gated, rate-limited, and atomic on the server.
(typeof requestServerNumber==='function'
  ? requestServerNumber('quote', genQN)
  : Promise.resolve(genQN())
).then(function(serverNum){
  if(serverNum) q.quoteNum=serverNum;
}).catch(function(e){
  console.error('Quote number failed, using temp:',e);
  toast('Server number pending — using temporary','warn');
}).then(function(){
  var all=DB.quotes();all.unshift(q);DB.saveQ(all,q.id);openEditor(q.id);toast('Draft created','ok');
  DB.logActivity('quote.create',q.quoteNum+' — '+(q.fields.custCo||'New'));
})}
function dupQuote(qid,asRev){var all=DB.quotes();var o=all.find(function(x){return x.id===qid});if(!o)return;var n=JSON.parse(JSON.stringify(o));n.id=uid();n.createdAt=n.updatedAt=new Date().toISOString();n.status='draft';n.sentAt=n.closedAt=n.wonAmount=null;n.lostReason='';n.parentQuoteId=o.id;n.parentRev=o.rev;
function _finishDup(){var all2=DB.quotes();all2.unshift(n);DB.saveQ(all2,n.id);DB.logActivity('quote.'+(asRev?'revise':'duplicate'),n.quoteNum+(asRev?' Rev '+n.rev:''));toast(asRev?'Rev '+n.rev+' created':'Duplicated','ok');MFX.emit('quote.revision',{quoteId:n.id,quoteNum:n.quoteNum,rev:n.rev,parentId:o.id,parentRev:o.rev});openEditor(n.id);
// Cascade revision notification to linked SOs
if(asRev&&typeof getSalesOrders==='function'){try{var linkedSOs=getSalesOrders().filter(function(so){return so.quoteId===o.id||so.quoteNum===o.quoteNum});if(linkedSOs.length>0&&window.fbDb){linkedSOs.forEach(function(so){var soNote='Quote revised to Rev '+n.rev+' — review specs may have changed';window.fbDb.collection('salesOrders').doc(so.id).update({quoteRevised:true,quoteNewRev:n.rev,quoteNewId:n.id,updatedAt:new Date().toISOString(),notes:firebase.firestore.FieldValue.arrayUnion({text:soNote,by:typeof getUserName==='function'?getUserName():'System',at:new Date().toISOString()})}).catch(function(e){console.warn('SO cascade:',e)})});toast(linkedSOs.length+' Sales Order(s) notified of revision','ok')}}catch(e){console.warn('Revision cascade error:',e)}}}
if(asRev){n.rev=nextRev(o.rev);_finishDup()}else{n.rev='A';n.parentQuoteId=null;n.quoteNum=genQN();/* DATA-15 fix: server-assigned dup quote # via nextSequence */(typeof requestServerNumber==='function'?requestServerNumber('quote',genQN):Promise.resolve(genQN())).then(function(sn){if(sn)n.quoteNum=sn}).catch(function(e){console.error('Dup quote number failed:',e);toast('Server number pending — using temporary','warn')}).then(_finishDup)}}
function setQStatus(qid,st,ex){
// Try server-side state machine first
if(window.MFX_API && navigator.onLine !== false) {
  window.MFX_API.postJSON('/api/transitionStatus', {collection:'quotes', docId:qid, newStatus:st}).then(function(res) {
    if(res.success) {
      // Server validated and applied — update local state
      var all=DB.quotes();var q=all.find(function(x){return x.id===qid});
      if(q){
        q.status=st;q.updatedAt=new Date().toISOString();
        if(st==='sent')q.sentAt=new Date().toISOString();
        if(st==='won'||st==='lost'){q.closedAt=new Date().toISOString();if(ex)Object.assign(q,ex)}
        if(st==='ready'||st==='sent'||st==='won'){bakePricing(q)}
        logQuoteEvent(q,'status','Status → '+st);
        DB.logActivity('quote.'+st,q.quoteNum+' → '+st);
        logClientActivity(q.fields.custCo,q.quoteNum+' → '+st);
        S.editId=qid;setTimeout(function(){updateRegistry(qid,'Status → '+st)},500);
        if(S.view==='editor')renderEditor();else renderQuotes();
        MFX.emit('quote.status',{quote:q,status:st,quoteId:qid});
      }
    } else {
      toast(res.error||'Transition denied','err');
    }
  }).catch(function(e) {
    console.warn('Server transition failed, using client validation:', e.message);
    setQStatusClient(qid,st,ex);
  });
  return;
}
setQStatusClient(qid,st,ex);
}
// Client-side fallback (offline or server unavailable)
function setQStatusClient(qid,st,ex){var VALID_TRANSITIONS = {
  'draft': ['approval','ready','archived'],
  'approval': ['ready','rejected','draft','archived'],
  'rejected': ['draft','approval','archived'],
  'ready': ['sent','draft','archived'],
  'sent': ['won','lost','draft','archived'],
  'won': ['archived'],
  'lost': ['draft','archived'],
  'archived': ['draft']
};
const all=DB.quotes();const q=all.find(x=>x.id===qid);if(!q)return;
if(VALID_TRANSITIONS[q.status] && !VALID_TRANSITIONS[q.status].includes(st)) { console.warn('Invalid transition:', q.status, '->', st); if(typeof toast==='function') toast('Cannot change from '+q.status+' to '+st,'err'); return; }
q.status=st;q.updatedAt=new Date().toISOString();if(st==='sent')q.sentAt=new Date().toISOString();if(st==='won'||st==='lost'){q.closedAt=new Date().toISOString();if(ex)Object.assign(q,ex)}
if(st==='ready'||st==='sent'||st==='won'){bakePricing(q)}
logQuoteEvent(q,'status','Status → '+st);DB.saveQ(all,qid);DB.logActivity('quote.'+st,q.quoteNum+' → '+st);logClientActivity(q.fields.custCo,q.quoteNum+' → '+st);S.editId=qid;setTimeout(function(){updateRegistry(qid,'Status → '+st)},500);if(S.view==='editor')renderEditor();else renderQuotes();
MFX.emit('quote.status',{quote:q,status:st,quoteId:qid})}

// 2026-06-01 round 64 cylinder-math audit fix #5: extracted single
// source of truth for the pricing matrix. Used by edCalc (live editor),
// bakePricing (persist on send), edPreview (PDF), and the registry
// export. Returns {fitErr, ww, mww, rp, cy, ..., mtx, ...} OR
// {fitErr:'...message...'} if web/repeat doesn't fit.
//
// Round 64 also implements:
//   - MR/CU split: mrBaseHrs (flat) + mrHrs (per-SKU)
//   - editable overagePct (was hard-coded 1.2)
//   - editable edgeTrim (was hard-coded 0.875)
function computePricingMatrix(fields, qtys){
  var f=fields||{};
  var gv=function(k){return parseFloat(f[k])||0};
  var sA=gv('sA'),sar=gv('sar'),nA=Math.max(1,gv('nAcross')),nAr=Math.max(1,gv('nAround')),gA=gv('gA'),gar=gv('gar'),oc=gv('offCuts');
  var msi=gv('msiCost'),sm=gv('stockMgn'),ms=gv('matSetup'),mu=gv('mkupPct')/100;
  var cpp=gv('cppPlate'),pps=gv('plPerSku'),ccc=gv('ccCost'),ncc=gv('nCC');
  // MR/CU now split into per-SKU (mrHrs) and flat base (mrBaseHrs).
  // Backward compat: when mrBaseHrs is missing, base falls to 0 and
  // mrHrs keeps its old "applied per SKU" semantics.
  var mrH=gv('mrHrs'),mrR=gv('mrRate'),cuH=gv('cuHrs'),cuR=gv('cuRate');
  var mrBaseH=gv('mrBaseHrs'),cuBaseH=gv('cuBaseHrs');
  // Editable edge trim and overage. Default to old hard-coded values
  // when the field is missing or 0 so existing quotes keep their math.
  var edgeTrim=gv('edgeTrim')||0.875;
  var ovPct=gv('overagePct');
  var overage=ovPct>0 ? (1+ovPct/100) : 1.2;
  var ww=sA*nA+(nA-1)*gA+edgeTrim,mww=ww+oc,rp=sar+gar;
  // Cylinder teeth + true repeat (for the repeat-fit guard)
  var gtRaw=gv('gearTooth');
  var cy=gtRaw>0 ? gtRaw : Math.round(rp*nAr*8);
  var trueRepeat=gtRaw>0 ? (gtRaw*0.125)/nAr : 0;
  // Press blank (web max) for web-fit guard
  var blankRaw=String(f.blankSize||'').replace(/["']/g,'').trim();
  var bs=parseFloat(blankRaw)||0;
  // ─── Fit guards ───────────────────────────────────────────────────
  if(bs>0 && ww>bs+0.001){
    return {fitErr:'Web layout '+ww.toFixed(3)+'" exceeds press blank '+bs+'". Reduce # Across, size, or gap.', ww:ww, mww:mww, bs:bs, f:f};
  }
  if(trueRepeat>0 && rp>trueRepeat+0.001){
    return {fitErr:'Repeat '+rp.toFixed(3)+'" exceeds die cylinder repeat '+trueRepeat.toFixed(3)+'" ('+gtRaw+' teeth × 0.125 ÷ '+nAr+' around). Reduce Size Around or Gap Around.', rp:rp, trueRepeat:trueRepeat, f:f};
  }
  // ─── Setup buckets ────────────────────────────────────────────────
  var pl=cpp*pps,cc=ccc*ncc;
  var mrPerSku=mrH*mrR,mrBase=mrBaseH*mrR;
  var cuPerSku=cuH*cuR,cuBase=cuBaseH*cuR;
  var perSkuSetup=pl+cc+mrPerSku+cuPerSku;
  var baseSetup=mrBase+cuBase;
  var setup=perSkuSetup; // legacy name kept for callers; per-SKU portion
  var sc=Math.min(10,Math.max(1,parseInt(f.skuCols)||1));
  var rpct=gv('repPct')/100;
  var qList=(qtys||[]).filter(function(x){return x>0});
  // ─── Round 66: Shannon pouch forming (per-pouch converting cost) ──
  // When pouchType is 'sup' or 'flat', we add per-pouch forming cost
  // to the per-SKU material. The matrix lookup picks the qty bracket
  // per tier so larger orders get the volume discount automatically.
  var pouchType=String(f.pouchType||'none').toLowerCase();
  var pouchActive=(pouchType==='sup'||pouchType==='flat') && typeof window!=='undefined' && typeof window.computePouchForming==='function';
  // ─── Round 67: cartoning (display boxes + master shippers) ────────
  // When pouchesPerDisplay > 0 and ($/display or $/master) > 0, the
  // engine adds qty_of_displays × $/display + qty_of_masters × $/master
  // to each tier. Per-SKU (each SKU gets its own carton run).
  var ppdRaw=gv('pouchesPerDisplay');
  var cartoningActive=ppdRaw>0 && typeof window!=='undefined' && typeof window.computeCartoning==='function' && (gv('displayCostEa')>0 || gv('masterCostEa')>0);
  // ─── Per-tier per-SKU pricing ────────────────────────────────────
  var mtx=qList.map(function(qty){
    var nft=(qty*rp/12)/nA;
    var row={qty:qty,skus:{}};
    for(var sk=1;sk<=sc;sk++){
      var tftSk=nft*overage + sk*ms;
      var matSk=mww*tftSk*0.012*msi*sm;
      // Pouch forming adds per-pouch × qty cost per SKU. The "copies"
      // for multi-SKU adjustment is the current SKU tier (sk).
      var pouchSk=0, pouchPerPouchSk=0;
      if(pouchActive){
        var pf=window.computePouchForming({
          style:pouchType,
          widthIn:gv('pouchWidthIn'),
          qty:qty,
          copies:sk,
          zipper:!!f.pouchZipper,
          crZipper:!!f.pouchCRZipper,
          gusset:!!f.pouchGusset
        });
        if(!pf.fitErr){
          pouchPerPouchSk=pf.perPouch;
          pouchSk=pf.total; // perPouch × qty
        }
      }
      // Cartoning add per SKU. Each SKU's qty needs its own display boxes
      // and master shippers, so we multiply qty by 1 inside computeCartoning
      // (sk multiplier on the total below). Volumes are per-SKU qty since
      // displays/masters are SKU-specific (different artwork = different cartons).
      var cartonSk=0;
      if(cartoningActive){
        var cf=window.computeCartoning({
          qty:qty, pouchWidthIn:gv('pouchWidthIn'), pouchesPerDisplay:ppdRaw,
          cols:gv('cartonCols'), rows:gv('cartonRows'), stacks:gv('cartonStacks'),
          displayCost:gv('displayCostEa'), masterCost:gv('masterCostEa')
        });
        if(cf.active) cartonSk=cf.total;
      }
      var raw=matSk + baseSetup + sk*perSkuSetup + pouchSk + sk*cartonSk;
      var base=raw*(1+mu);
      var tot=base*(1+rpct);
      // 2026-06-01 round 65 audit fix: round tot to 2¢ + ppu to 5 dec
      // at source so all downstream surfaces (editor preview, PDF,
      // registry export, portal display) reconcile.
      var tot2=Math.round(tot*100)/100;
      var ppu5=Math.round((tot2/qty)*100000)/100000;
      row.skus[sk]={tot:tot2,ppu:ppu5,rep:Math.round(base*rpct*100)/100,_matSk:matSk,_tftSk:tftSk,_pouchSk:Math.round(pouchSk*100)/100,_pouchPerPouchSk:pouchPerPouchSk,_cartonSk:Math.round(cartonSk*100)/100};
    }
    return row;
  });
  return {
    ww:ww, mww:mww, oc:oc, rp:rp, cy:cy, trueRepeat:trueRepeat, bs:bs,
    pl:pl, cc:cc, mrPerSku:mrPerSku, mrBase:mrBase, cuPerSku:cuPerSku, cuBase:cuBase,
    perSkuSetup:perSkuSetup, baseSetup:baseSetup, setup:setup,
    mtx:mtx, qtys:qList, sc:sc, f:f, rpct:rpct, nAr:nAr, overage:overage, edgeTrim:edgeTrim,
    pouchType:pouchType, pouchActive:pouchActive,
    cartoningActive:cartoningActive
  };
}
window.computePricingMatrix=computePricingMatrix;

function bakePricing(q){
try{
var c=computePricingMatrix(q.fields, q.qtys);
if(c.fitErr){
  console.warn('[bakePricing] '+q.quoteNum+' has fit error, skipping bake:', c.fitErr);
  return;
}
// Persist legacy + new fields. row.ppu and row.total mirror sk=1 for
// callers that read q.pricedQtys[i].ppu/total directly.
var pricedQtys=c.mtx.map(function(row){
  row.ppu=row.skus[1].ppu;
  row.total=row.skus[1].tot;
  row.setup=c.setup;
  return row;
});
q.pricedQtys=pricedQtys;
q.setupTotal=c.setup;
q.fixedCharges={die:parseFloat(q.fields.dieChg)||0,plates:c.pl,mr:c.mrPerSku+c.mrBase,cu:c.cuPerSku+c.cuBase,shipping:parseFloat(q.fields.shipping)||0};
console.log('💰 Pricing baked into quote:',q.quoteNum,pricedQtys.length,'quantities');
}catch(e){console.warn('bakePricing error:',e)}}
function delQuote(qid) {
  if (!confirm('Delete permanently?')) return;
  var q = DB.quotes().find(function(x){ return x.id === qid; });
  var qnum = q ? q.quoteNum : qid;
  // Remove from local cache immediately
  _cache.quotes = DB.quotes().filter(function(x){ return x.id !== qid; });
  if (S.editId === qid) goView('quotes'); else renderQuotes();
  // Show undo toast
  var undone = false;
  var undoToast = document.getElementById('toast');
  if (undoToast) {
    undoToast.innerHTML = esc(qnum) + ' deleted <button onclick="window._undoDelete()" style="margin-left:8px;background:#fff;color:#000;border:none;padding:2px 10px;border-radius:4px;cursor:pointer;font-weight:700">Undo</button>';
    undoToast.style.background = 'var(--rd)';
    undoToast.style.color = '#fff';
    undoToast.style.display = 'block';
  }
  window._undoDelete = function() {
    undone = true;
    if (q) { var all = DB.quotes(); all.unshift(q); _cache.quotes = all; DB.saveQ(all,q.id); }
    toast('Restored ' + qnum, 'ok');
    renderQuotes();
  };
  // Hard delete after 5 seconds if not undone
  setTimeout(function() {
    if (!undone) {
      DB.logActivity('quote.deleted', qnum + ' deleted by ' + (typeof getUserName === 'function' ? getUserName() : 'Unknown'));
      DB.delDoc('quotes', qid);
    }
    if (undoToast) undoToast.style.display = 'none';
  }, 5000);
}
function getQ(qid){return DB.quotes().find(q=>q.id===qid)}
function saveQ(){if(!S.editId)return;const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;
const el=id=>{const e=document.querySelector('#v-editor [data-field="'+id+'"]');if(!e)return undefined;if(e.type==='checkbox')return e.checked;return e.value};
// PERF-07 fix (2026-05-24): dropped the JSON.stringify(q.fields) before/after
// diff that was used only to decide whether to push an "edit" activity log
// entry. saveQ is user-initiated (the Save button) so we always log it — saves
// the double-stringify of large quote field objects on every save.
for(const k of Object.keys(q.fields)){const v=el(k);if(v!==undefined)q.fields[k]=v}
// Also capture checkbox fields that might not be in FDEF yet
// Round 66: pouch zipper/CR/gusset are booleans, captured here.
['showSetupOnPDF','showShippingOnPDF','showPlateOnPDF','pouchZipper','pouchCRZipper','pouchGusset'].forEach(function(k){const v=el(k);if(v!==undefined)q.fields[k]=v});
const descEl=document.querySelector('#v-editor [data-field="description"]');if(descEl)q.description=descEl.value;
// 2026-05-27: keep poClientEmail (the portal-access lookup key) in sync with
// whatever the rep types into the main editor's email field. Firestore queries
// are exact-case but Firebase Auth lowercases magic-link tokens, so the stored
// value must be lowercase or the client's portal workspace query won't find
// this quote. Mirroring on every save catches edits via any path — Send tab,
// main editor, customer-load autofill, dropdown picker, etc. — without having
// to wire each one individually.
{const _custEmailRaw=String((q.fields&&q.fields.custEmail)||'').trim();const _lowered=_custEmailRaw.toLowerCase();if(_lowered && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_lowered) && q.poClientEmail!==_lowered){q.poClientEmail=_lowered}}
if(!q.activityLog)q.activityLog=[];q.activityLog.push({action:'edit',by:getUserName(),at:new Date().toISOString(),detail:'Fields updated'})
const qe=document.querySelectorAll('#v-editor .qty-row input');if(qe.length&&S.etab===4)q.qtys=[...qe].map(e=>parseInt(e.value)||0).filter(n=>n>0);
q.updatedAt=new Date().toISOString();
// 2026-06-01 round 65 audit fix #15: bidirectional quote↔SO sync.
// Round 50 added SO→quote mirror via saveSOField. The reverse direction
// was missing — typo fixes on the quote never reached the linked SO.
// Now any change to identity/shipping fields on the quote propagates
// to the linked SO doc. Async + fire-and-forget; never blocks save.
try{
  if(typeof window!=='undefined' && window._soCache && Array.isArray(window._soCache) && typeof fbDb!=='undefined'){
    var linkedSO=window._soCache.find(function(s){return s && s.quoteId===q.id;});
    if(linkedSO && linkedSO.id){
      var qf=q.fields||{};
      var soPatch={};
      if(qf.custCo && linkedSO.company!==qf.custCo) soPatch.company=qf.custCo;
      if(qf.custAttn && linkedSO.contact!==qf.custAttn) soPatch.contact=qf.custAttn;
      if(qf.custPhone && linkedSO.phone!==qf.custPhone) soPatch.phone=qf.custPhone;
      if(qf.custEmail){ var _e=String(qf.custEmail).trim().toLowerCase(); if(linkedSO.email!==_e) soPatch.email=_e; }
      var newShipTo=q.poShipTo||qf.shipTo||qf.cityState||'';
      if(newShipTo && linkedSO.shipTo!==newShipTo) soPatch.shipTo=newShipTo;
      if(qf.industry && linkedSO.industry!==qf.industry) soPatch.industry=qf.industry;
      if(Object.keys(soPatch).length){
        soPatch.updatedAt=new Date().toISOString();
        soPatch.updatedBy=getUserName();
        // local mirror first so UI doesn't bounce
        Object.keys(soPatch).forEach(function(k){linkedSO[k]=soPatch[k]});
        fbDb.collection('salesOrders').doc(linkedSO.id).update(soPatch).catch(function(e){
          console.warn('[saveQ→SO mirror] non-fatal:',e.message);
        });
      }
    }
  }
}catch(_e){console.warn('[saveQ→SO mirror] threw',_e.message);}
// 2026-06-01 audit fix #2 (LOW): bake pricing on every save so portal
// + registry never show stale numbers during a sent→draft→edit window.
if(typeof bakePricing==='function'){ try{ bakePricing(q); }catch(_be){} }
DB.saveQ(all,S.editId)}

// ═══════════════════════════════════════════════════════════════
// SECTION 10: CUSTOMER MANAGEMENT
// Functions: saveCust, delCust, showCustForm
// Dependencies: DB, S, openModal, closeModal, toast,
//              renderCust, renderProfile, openProfile (external)
// ═══════════════════════════════════════════════════════════════

function saveCust(c){const all=DB.customers();const i=all.findIndex(x=>x.id===c.id);if(i>=0)all[i]=c;else all.unshift(c);DB.saveC(all,c.id);toast('Saved','ok'); // DATA-14 fix: pass changedId so only one doc is writtenif(S.view==='profile'&&S.profileId===c.id)renderProfile(c.id);else if(S.view==='customers')renderCust();
// Cascade customer updates to open quotes
(function cascadeCustomerUpdate(c) {
  if (!c || !c.company) return;
  var co = c.company.toLowerCase();
  var openQuotes = DB.quotes().filter(function(q) {
    return q.fields && q.fields.custCo && q.fields.custCo.toLowerCase() === co
      && ['draft', 'approval', 'ready'].indexOf(q.status) >= 0;
  });
  if (openQuotes.length === 0) return;
  if (!confirm('Update ' + openQuotes.length + ' open quote(s) with new contact info?')) return;
  var all = DB.quotes();
  var updated = 0;
  openQuotes.forEach(function(oq) {
    var match = all.find(function(x) { return x.id === oq.id; });
    if (!match) return;
    var changed = false;
    if (c.contact && match.fields.custAttn !== c.contact) { match.fields.custAttn = c.contact; changed = true; }
    if (c.phone && match.fields.custPhone !== c.phone) { match.fields.custPhone = c.phone; changed = true; }
    if (c.email && match.fields.custEmail !== c.email) { match.fields.custEmail = c.email; changed = true; }
    if (c.address && match.fields.shipTo !== c.address) { match.fields.shipTo = c.address; changed = true; }
    if (c.cityState && match.fields.cityState !== c.cityState) { match.fields.cityState = c.cityState; changed = true; }
    if (c.defaultTerms && match.fields.payTerms !== c.defaultTerms) { match.fields.payTerms = c.defaultTerms; changed = true; }
    if (changed) { match.updatedAt = new Date().toISOString(); updated++; }
  });
  if (updated > 0) {
    DB.saveQ(all);
    toast(updated + ' quote(s) updated with new customer info', 'ok');
    DB.logActivity('customer.cascade', c.company + ' — updated ' + updated + ' open quotes');
  }
})(c);
}
function delCust(cid) {
  if (!confirm('Delete?')) return;
  var c = DB.customers().find(function(x){ return x.id === cid; });
  var cname = c ? c.company : cid;
  // Remove from local cache immediately
  _cache.customers = DB.customers().filter(function(x){ return x.id !== cid; });
  if (S.view === 'profile') goView('customers'); else renderCust();
  // Show undo toast
  var undone = false;
  var undoToast = document.getElementById('toast');
  if (undoToast) {
    undoToast.innerHTML = esc(cname) + ' deleted <button onclick="window._undoCustDelete()" style="margin-left:8px;background:#fff;color:#000;border:none;padding:2px 10px;border-radius:4px;cursor:pointer;font-weight:700">Undo</button>';
    undoToast.style.background = 'var(--rd)';
    undoToast.style.color = '#fff';
    undoToast.style.display = 'block';
  }
  window._undoCustDelete = function() {
    undone = true;
    if (c) { var all = DB.customers(); all.unshift(c); _cache.customers = all; DB.saveC(all); }
    toast('Restored ' + cname, 'ok');
    renderCust();
  };
  // Hard delete after 5 seconds if not undone
  setTimeout(function() {
    if (!undone) {
      DB.logActivity('customer.deleted', cname + ' deleted by ' + (typeof getUserName === 'function' ? getUserName() : 'Unknown'));
      DB.delDoc('customers', cid);
    }
    if (undoToast) undoToast.style.display = 'none';
  }, 5000);
}
function showCustForm(cid){const c=cid?DB.customers().find(x=>x.id===cid):{id:'c'+Date.now(),company:'',contact:'',phone:'',email:'',industry:'',address:'',notes:[]};
window._cfSave={notes:c.notes||[],zohoId:c.zohoId||''};
openModal(`<div class="modal-title">${cid?'Edit':'New'} Customer</div>
<div class="fg"><label>Company</label><input id="cf-co" value="${c.company}"></div>
<div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label>Contact</label><input id="cf-ct" value="${c.contact||''}"></div><div class="fg" style="flex:1"><label>Title / Role</label><input id="cf-title" value="${c.contactTitle||''}" placeholder="Purchasing Manager"></div></div>
<div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label>Phone</label><input id="cf-ph" value="${c.phone||''}"></div><div class="fg" style="flex:1"><label>Email</label><input id="cf-em" value="${c.email||''}"></div></div>
<div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label>Industry</label><input id="cf-ind" value="${c.industry||''}"></div><div class="fg" style="flex:1"><label>Website</label><input id="cf-web" value="${c.website||''}" placeholder="https://"></div></div>
<div class="fg"><label>Address</label><input id="cf-addr" value="${c.address||''}"></div>
<div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label>City, State</label><input id="cf-city" value="${c.cityState||''}" placeholder="Los Angeles, CA"></div><div class="fg" style="flex:1"><label>Zip</label><input id="cf-zip" value="${c.zip||''}"></div></div>
<div style="border-top:1px solid var(--bdr);margin:8px 0;padding-top:8px">
<div style="font-size:10px;font-weight:700;color:var(--ac);margin-bottom:6px;letter-spacing:.5px">LINKS & BRANDING</div>
<div class="fg"><label>Logo URL</label><input id="cf-logo" value="${c.logoUrl||''}" placeholder="Paste image URL or Google Drive share link"></div>
<div class="fg"><label>Client Folder (Google Drive)</label><input id="cf-drive" value="${c.driveFolder||''}" placeholder="https://drive.google.com/drive/folders/..."></div>
<div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label>Payment Terms</label><input id="cf-terms" value="${c.defaultTerms||''}" placeholder="Net 30"></div><div class="fg" style="flex:1"><label>Account #</label><input id="cf-acct" value="${c.accountNum||''}" placeholder="MFX-000"></div></div>
</div>
<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-gn" style="flex:1" onclick="saveCust({id:'${c.id}',company:$('cf-co').value,contact:$('cf-ct').value,contactTitle:$('cf-title').value,phone:$('cf-ph').value,email:$('cf-em').value,industry:$('cf-ind').value,website:$('cf-web').value,address:$('cf-addr').value,cityState:$('cf-city').value,zip:$('cf-zip').value,logoUrl:$('cf-logo').value,driveFolder:$('cf-drive').value,defaultTerms:$('cf-terms').value,accountNum:$('cf-acct').value,notes:window._cfSave.notes,zohoId:window._cfSave.zohoId});closeModal()">Save</button>${cid?`<button class="btn btn-rd" onclick="delCust('${c.id}');closeModal()">Delete</button>`:''}<button class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>`)}

// ═══════════════════════════════════════════════════════════════
// SECTION 11: TEMPLATES
// Functions: saveTpl, delTpl
// Dependencies: DB, S, getQ, saveQ, DEFAULT_TERMS,
//              renderTpl, toast
// ═══════════════════════════════════════════════════════════════

function saveTpl(){saveQ();const q=getQ(S.editId);if(!q)return;const nm=prompt('Template name:',q.fields.jobDesc||'');if(!nm)return;const t={id:'t'+Date.now(),name:nm,createdAt:new Date().toISOString(),fields:{...q.fields},qtys:[...q.qtys],terms:[...(q.terms||DEFAULT_TERMS)]};const all=DB.templates();all.unshift(t);DB.saveT(all);toast('Template saved','ok')}
function delTpl(tid){if(!confirm('Delete?'))return;DB.saveT(DB.templates().filter(t=>t.id!==tid));toast('Deleted','ok');renderTpl()}

// ═══════════════════════════════════════════════════════════════
// SECTION 12: DASHBOARD & STAFF HUB
// Functions: renderStaffHub (welcome header, status update,
//            score bar, alerts, control panel, tasks, live feed,
//            discussions listener)
// Dependencies: DB, S, getUserName, getMFXProfile, QUOTE_LOGO,
//              calcPoints (external), getSalesOrders (external),
//              getJobTickets (external), getPassports (external),
//              openCEOPortal, openSupportInbox, openFlexZone,
//              openHomeBase, updateDashClock (external)
// ═══════════════════════════════════════════════════════════════

function renderStaffHub(){
var p=getMFXProfile();var me=getUserName();var qs=DB.quotes();
var ptsObj=typeof calcPoints==='function'?calcPoints(me,qs):{pts:0,breakdown:{}};var pts=typeof ptsObj==='object'?ptsObj.pts||0:ptsObj||0;
var myQ=qs.filter(function(q){return q.createdBy===me});
var wonQ=myQ.filter(function(q){return q.status==='won'});
var todayStr=new Date().toISOString().split('T')[0];
var todayQ=myQ.filter(function(q){return q.createdAt&&q.createdAt.startsWith(todayStr)}).length;
var n=new Date();
var winRate=myQ.length>0?Math.round(wonQ.length/Math.max(1,wonQ.length+myQ.filter(function(q){return q.status==='lost'}).length)*100):0;
var tasks=getMfxTasks();
var activeTasks=tasks.filter(function(t){return!t.done}).length;

// ── WELCOME HEADER ──
var h='<div style="text-align:center;padding:16px 0 10px">';
h+='<img src="'+QUOTE_LOGO+'" alt="MFX" style="height:48px;margin-bottom:8px">';
h+='<div style="font-size:10px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Welcome to Microflex</div>';
h+='<div style="font-size:18px;font-weight:700;color:var(--tx)">'+me+'</div>';
h+='<div style="font-size:11px;color:var(--ac);font-weight:600">'+p.flexId+' · '+p.dept+'</div>';
h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+n.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+' · '+n.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+'</div>';
h+='<div style="margin-top:6px"><span style="font-size:24px;cursor:pointer" onclick="hubChangeMood()">'+p.mood+'</span></div>';
h+='</div>';

// ── STATUS UPDATE ──
h+='<div class="hub-card" style="margin-bottom:12px">';
h+='<div style="display:flex;gap:6px">';
h+='<textarea id="hubStatus" placeholder="Update your status or @mention a teammate..." style="flex:1;min-height:36px;padding:8px;border:1px solid var(--bdr);border-radius:8px;background:var(--inp);color:var(--tx);font-size:11px;resize:none"></textarea>';
h+='<button class="btn btn-pr btn-sm" onclick="hubPostStatus()" style="align-self:flex-end;padding:8px 14px">Post</button>';
h+='</div></div>';

// ── SCORE BAR ──
h+='<div style="display:flex;gap:6px;margin-bottom:12px">';
h+='<div class="hub-stat" style="flex:1"><div class="hub-stat-val">'+pts.toFixed(1)+'</div><div class="hub-stat-lbl">MFX Score</div></div>';
h+='<div class="hub-stat" style="flex:1"><div class="hub-stat-val">'+todayQ+'</div><div class="hub-stat-lbl">Today</div></div>';
h+='<div class="hub-stat" style="flex:1"><div class="hub-stat-val" style="color:var(--gn)">'+wonQ.length+'</div><div class="hub-stat-lbl">Won</div></div>';
h+='<div class="hub-stat" style="flex:1"><div class="hub-stat-val" style="color:var(--or)">'+winRate+'%</div><div class="hub-stat-lbl">Win Rate</div></div>';
h+='</div>';

// ── ALERTS ──
var rdCount=qs.filter(function(q){return q.status==='ready'}).length;
if(rdCount||activeTasks){
h+='<div class="hub-card" style="margin-bottom:12px;padding:10px">';
if(rdCount)h+='<div style="font-size:11px;color:#4ade80;padding:3px 0;cursor:pointer" onclick="S.qFilter=\'ready\';goView(\'quotes\')">✅ '+rdCount+' ready to send</div>';
var poCount=qs.filter(function(q){return q.status==='won'&&q.poNumber}).length;
var pendingSOCount=(typeof getSalesOrders==='function')?getSalesOrders().filter(function(s){return s.status==='pending'}).length:0;
if(poCount)h+='<div style="font-size:11px;color:#DAA520;padding:3px 0;cursor:pointer" onclick="goView(\'orders\')">📦 '+poCount+' PO'+(poCount>1?'s':'')+' received</div>';
if(pendingSOCount)h+='<div style="font-size:11px;color:#fb923c;padding:3px 0;cursor:pointer" onclick="S_SO.view=\'sos\';goView(\'orders\')">📋 '+pendingSOCount+' SO'+(pendingSOCount>1?'s':'')+' pending CEO approval</div>';
var ppCount=(typeof getJobTickets==='function')?getJobTickets().filter(function(t){return t.prePressStatus==='pending'}).length:0;
var activeJP=(typeof getPassports==='function')?getPassports().filter(function(p){return p.status!=='complete'}).length:0;
if(ppCount)h+='<div style="font-size:11px;color:#a78bfa;padding:3px 0;cursor:pointer" onclick="S_JP.view=\'prepress\';goView(\'production\')">🎨 '+ppCount+' ticket'+(ppCount>1?'s':'')+' need pre-press</div>';
if(activeJP)h+='<div style="font-size:11px;color:#00e5ff;padding:3px 0;cursor:pointer" onclick="goView(\'production\')">🛂 '+activeJP+' active job passport'+(activeJP>1?'s':'')+'</div>';
var vpoPending=(window._vpoCache||[]).filter(function(v){return v.status==='pending_approval'}).length;
var vpoSent=(window._vpoCache||[]).filter(function(v){return v.status==='sent'}).length;
if(vpoPending)h+='<div style="font-size:11px;color:#fb923c;padding:3px 0;cursor:pointer" onclick="goView(\'vendorpos\')">📦 '+vpoPending+' vendor PO'+(vpoPending>1?'s':'')+' pending approval</div>';
if(vpoSent)h+='<div style="font-size:11px;color:#a78bfa;padding:3px 0;cursor:pointer" onclick="goView(\'vendorpos\')">📤 '+vpoSent+' vendor PO'+(vpoSent>1?'s':'')+' awaiting delivery</div>';
if(activeTasks)h+='<div style="font-size:11px;color:var(--ac);padding:3px 0">📋 '+activeTasks+' open task'+(activeTasks>1?'s':'')+'</div>';
h+='</div>'}

// ══════════════════════════════
// ── DEPARTMENT CONTROL PANEL ──
// ══════════════════════════════
h+='<div style="font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px;padding-left:2px">Control Panel</div>';
h+='<div class="pod-grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px">';

var depts=[
['🤝','Client Services','Quotes, CRM, Pricing','dashboard',true],
['🎨','Pre-Press','Art, Proofs, Plates','',false],
['🏭','Production','Schedules, Press Runs','',false],
['🔍','Quality','SQF, Inspections, HACCP','',false],
['📦','Purchasing','Vendor POs, Materials, SQF','vendorpos',true],
['💰','Accounting','Invoicing, AP/AR','',false],
['⚙️','Operations','KPIs, Planning, SOPs','',false]
];
depts.forEach(function(d){
if(d[4]){h+='<div class="pod-card active" onclick="goView(\''+d[3]+'\')" style="padding:14px"><div class="pod-ico">'+d[0]+'</div><div class="pod-name" style="color:var(--ac);font-size:12px">'+d[1]+'</div><div style="font-size:9px;color:var(--tx3);margin-top:2px">'+d[2]+'</div><div style="margin-top:4px"><span style="font-size:8px;background:var(--ac);color:#000;padding:2px 6px;border-radius:10px;font-weight:600">ENTER</span></div></div>'}
else{h+='<div class="pod-card locked" style="padding:14px"><div class="pod-ico">'+d[0]+'</div><div class="pod-name" style="font-size:12px">'+d[1]+'</div><div style="font-size:9px;color:var(--tx3);margin-top:2px">'+d[2]+'</div><div style="margin-top:4px;font-size:8px;color:var(--tx3)">Coming Soon</div></div>'}
});
h+='</div>';

// ── SUPPORT & FLEX ZONE ──
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
h+='<div class="pod-card active" onclick="openSupportInbox()" style="padding:14px"><div class="pod-ico">📬</div><div class="pod-name" style="color:var(--ac);font-size:12px">Support</div><div style="font-size:9px;color:var(--tx3)">Inbox, @Mentions</div></div>';
h+='<div class="pod-card active" onclick="openFlexZone()" style="padding:14px"><div class="pod-ico">⚡</div><div class="pod-name" style="color:var(--ac);font-size:12px">My Hub</div><div style="font-size:9px;color:var(--tx3)">Feed, Leaderboard, Activity</div></div>';
h+='</div>';

// ── MY TASKS ──
h+='<div class="hub-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:12px;font-weight:600;color:var(--tx)">📋 My Tasks</div><button class="btn btn-ghost btn-xs" onclick="hubAddTask()">+ Add</button></div>';
var taskList=tasks.filter(function(t){return!t.done});
taskList.slice(0,5).forEach(function(t){
h+='<div class="task-item"><input type="checkbox" onchange="hubToggleTask(\''+t.id+'\')"><div style="flex:1">'+t.text+(t.date?' <span style="color:var(--tx3);font-size:9px">'+t.date+'</span>':'')+'</div><span style="cursor:pointer;font-size:9px;color:var(--tx3)" onclick="hubDeleteTask(\''+t.id+'\')">✕</span></div>'});
if(!taskList.length)h+='<div style="color:var(--tx3);font-size:11px;padding:6px">No open tasks</div>';
h+='</div>';

// ── LIVE FEED PREVIEW ──
h+='<div class="hub-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:12px;font-weight:600;color:var(--tx)">📡 Live Feed</div><button class="btn btn-ghost btn-xs" onclick="openSupportModal()">Full Feed</button></div>';
var feedItems=[];qs.forEach(function(q){(q.internalNotes||[]).forEach(function(nn){feedItems.push({by:nn.by,text:nn.text,at:nn.at})})});
feedItems.sort(function(a,b){return new Date(b.at)-new Date(a.at)});
feedItems.slice(0,4).forEach(function(fi){h+='<div class="feed-post"><div class="feed-user">'+esc(fi.by)+'</div><div class="feed-msg">'+esc(fi.text.substring(0,80))+(fi.text.length>80?'...':'')+'</div><div class="feed-meta">'+fD(fi.at)+'</div></div>'});
if(!feedItems.length)h+='<div style="color:var(--tx3);font-size:11px;padding:6px">No activity yet</div>';
h+='</div>';

// ── PROFILE EDIT ──
h+='<div style="text-align:center;padding:8px"><button class="btn btn-ghost btn-sm" onclick="openHomeBase()">⚙️ Edit Profile</button></div>';

$('v-staffhub').innerHTML=h;
setTimeout(updateDashClock,50);
if(fbDb){fbDb.collection('discussions').orderBy('createdAt','desc').limit(5).get().then(function(snap){
var el=document.getElementById('dashDiscussions');if(!el)return;
var items=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var h='';items.forEach(function(d){
var checks=d.checklist||[];var done=checks.filter(function(c){return c.done}).length;
h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);cursor:pointer;font-size:11px" onclick="openTeamChat()"><div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(d.title)+'</strong>'+(checks.length?'<span style="font-size:9px;color:'+(done===checks.length?'var(--gn)':'var(--or)')+'">'+done+'/'+checks.length+'</span>':'')+'</div><div style="color:var(--tx3);font-size:9px;margin-top:2px">'+esc(d.owner||'')+' → '+esc(d.assignedTo||'Unassigned')+(d.dueDate?' · Due '+esc(d.dueDate):'')+'</div></div>'});
if(!items.length)h='<div style="color:var(--tx3);font-size:10px;padding:6px">No discussions yet</div>';
el.innerHTML=h}).catch(function(e){console.warn('op:',e)})}}

// ═══════════════════════════════════════════════════════════════
// SECTION 13: FLEX ZONE
// Functions: openFlexZone, renderFlexZone, switchFlexTab
// Tabs: Feed (microfeed), Leaderboard, Badges, Activity,
//       Scratch Pad (bulletin board)
// Dependencies: DB, S, getUserName, calcPoints (external),
//              fbDb (microfeed/support collections),
//              voteSupport, commentSupport, newSupportTicket,
//              adminReplySupport (external)
// ═══════════════════════════════════════════════════════════════

function openFlexZone(){
S.view='supportboard';document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});$('v-supportboard').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=function(){goView('staffhub')};$('hdrTitle').textContent='My Hub';$('hdrActions').innerHTML='';renderFlexZone()}

function renderFlexZone(){
var qs=DB.quotes();var me=getUserName();
var h='<div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto">';
['📡 Feed','🏆 Leaders','🎖 Badges','👤 Activity','📝 Scratch Pad'].forEach(function(cat,i){h+='<div style="padding:8px 14px;background:'+(i===0?'var(--ac)':'var(--bg3)')+';color:'+(i===0?'#fff':'var(--tx2)')+';border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer" onclick="switchFlexTab('+i+')">'+cat+'</div>'});
h+='</div><div id="flexContent"></div>';
$('v-supportboard').innerHTML=h;
switchFlexTab(0)}

function switchFlexTab(tab){
var qs=DB.quotes();var me=getUserName();var el=$('flexContent');if(!el)return;var h='';

if(tab===0){
// STATUS FEED - mood/status updates from all users
h+='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px">Status Feed</div>';
if(fbDb){fbDb.collection('microfeed').orderBy('timestamp','desc').limit(20).get().then(function(snap){
var posts=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var fh='';posts.forEach(function(p){fh+='<div class="feed-post"><div style="display:flex;justify-content:space-between"><div class="feed-user">'+(p.mood||'💬')+' '+esc(p.user||'Unknown')+'</div><div class="feed-meta">'+(p.timestamp?new Date(p.timestamp.seconds*1000).toLocaleDateString():'')+'</div></div><div class="feed-msg">'+esc(p.text||p.message||'')+'</div><div style="display:flex;gap:8px;font-size:10px;margin-top:4px"><span style="cursor:pointer" onclick="voteSupport(\''+p.id+'\',1)">👍 '+(p.upvotes||0)+'</span><span style="cursor:pointer" onclick="voteSupport(\''+p.id+'\',-1)">👎 '+(p.downvotes||0)+'</span><button class="btn btn-ghost btn-xs" onclick="commentSupport(\''+p.id+'\')">💬</button></div>';
if(p.comments&&p.comments.length){p.comments.forEach(function(c){fh+='<div style="margin:4px 0 4px 16px;padding:4px 8px;background:var(--bg3);border-left:2px solid var(--ac);border-radius:0 4px 4px 0;font-size:10px"><strong style="color:var(--ac)">'+esc(c.by)+'</strong> '+esc(c.text)+'</div>'})}
fh+='</div>'});
if(!posts.length)fh='<div style="color:var(--tx3);text-align:center;padding:20px">No posts yet — share something! 🚀</div>';
el.innerHTML=fh}).catch(function(e){el.innerHTML='<div style="color:var(--tx3);padding:20px">'+esc(e.message)+'</div>'})}
else{el.innerHTML='<div style="color:var(--tx3);padding:20px">Loading...</div>'}}

else if(tab===1){
// LEADERBOARD
var users={};qs.forEach(function(q){var u=q.createdBy||'Unknown';if(!users[u])users[u]={quotes:0,won:0,notes:0,pts:0};users[u].quotes++;if(q.status==='won')users[u].won++;(q.internalNotes||[]).forEach(function(nn){if(nn.by===u)users[u].notes++})});
Object.keys(users).forEach(function(u){var r=typeof calcPoints==='function'?calcPoints(u,qs):{pts:0};users[u].pts=typeof r==='object'?(r.pts||0):(r||0)});
var sorted=Object.entries(users).sort(function(a,b){return b[1].pts-a[1].pts});
h='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px">🏆 MFX Leaderboard</div>';
sorted.forEach(function(entry,i){var name=entry[0],s=entry[1];
h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 8px;border-bottom:1px solid var(--bdr);'+(name===me?'background:var(--bg3);border-radius:6px;border:1px solid var(--ac);':'')+'">';
h+='<div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1))+'</span><div><strong>'+esc(name)+'</strong><div style="font-size:9px;color:var(--tx3)">'+s.quotes+' quotes · '+s.won+' won · '+s.notes+' notes</div></div></div>';
h+='<div style="font-size:14px;font-weight:700;color:var(--ac)">'+s.pts.toFixed(1)+'</div></div>'});
el.innerHTML=h}

else if(tab===2){
// BADGES
var myQc=qs.filter(function(q){return q.createdBy===me});var myWon=myQc.filter(function(q){return q.status==='won'}).length;var myNotes=0;qs.forEach(function(q){(q.internalNotes||[]).forEach(function(nn){if(nn.by===me)myNotes++})});
h='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px">🎖 Your Badges</div>';
var badges=[['🚀','First Quote',myQc.length>=1],['📊','5 Quotes',myQc.length>=5],['💯','10 Quotes',myQc.length>=10],['🏆','First Win',myWon>=1],['⭐','5 Wins',myWon>=5],['👑','10 Wins',myWon>=10],['💬','First Note',myNotes>=1],['📢','10 Notes',myNotes>=10],['🔥','25 Notes',myNotes>=25]];
h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
badges.forEach(function(b){h+='<div style="background:var(--bg3);border:1px solid '+(b[2]?'var(--ac)':'var(--bdr)')+';border-radius:10px;padding:12px;text-align:center;opacity:'+(b[2]?'1':'.3')+';box-shadow:'+(b[2]?'var(--glow)':'none')+'"><div style="font-size:28px">'+b[0]+'</div><div style="font-size:10px;font-weight:600;color:'+(b[2]?'var(--ac)':'var(--tx3)')+';margin-top:4px">'+b[1]+'</div></div>'});
h+='</div>';el.innerHTML=h}

else if(tab===3){
// MY ACTIVITY
h='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px">👤 My Activity</div>';
var acts=[];qs.forEach(function(q){(q.activityLog||[]).forEach(function(a){if(a.by===me)acts.push(Object.assign({qn:q.quoteNum},a))})});
acts.sort(function(a,b){return new Date(b.at)-new Date(a.at)});
acts.slice(0,20).forEach(function(a){h+='<div style="padding:5px 0;border-bottom:1px solid var(--bdr);font-size:11px"><strong style="color:var(--ac)">'+esc(a.qn)+'</strong> — '+esc(a.detail)+'<span style="color:var(--tx3);font-size:9px;margin-left:6px">'+fD(a.at)+'</span></div>'});
if(!acts.length)h+='<div style="color:var(--tx3);padding:12px">No activity yet</div>';
el.innerHTML=h}

else if(tab===4){
// BULLETIN BOARD - post and reply
h='<div style="margin-bottom:10px"><button class="btn" onclick="newSupportTicket()" style="width:100%;background:var(--ac);color:#fff;padding:12px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer">📝 Post to Board</button></div>';
if(fbDb){fbDb.collection('support').orderBy('timestamp','desc').limit(20).get().then(function(snap){
var posts=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var fh='';posts.forEach(function(t){
fh+='<div class="hub-card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(t.user||'Unknown')+'</strong><span style="font-size:9px;color:var(--tx3)">'+(t.timestamp?new Date(t.timestamp.seconds*1000).toLocaleDateString():'')+'</span></div>';
fh+='<div style="font-size:12px;margin:6px 0">'+esc(t.message)+'</div>';
if(t.reply)fh+='<div style="background:var(--bg3);border-left:3px solid var(--ac);padding:6px 8px;margin:4px 0;font-size:11px;border-radius:0 4px 4px 0">📌 '+esc(t.reply)+'</div>';
if(t.comments&&t.comments.length){t.comments.forEach(function(c){fh+='<div style="margin:4px 0 4px 12px;padding:4px 8px;background:var(--bg3);border-left:2px solid var(--gn);border-radius:0 4px 4px 0;font-size:10px"><strong style="color:var(--ac)">'+esc(c.by)+'</strong> '+esc(c.text)+'</div>'})}
fh+='<div style="display:flex;gap:8px;font-size:10px;margin-top:4px"><span style="cursor:pointer" onclick="voteSupport(\''+t.id+'\',1)">👍 '+(t.upvotes||0)+'</span><span style="cursor:pointer" onclick="voteSupport(\''+t.id+'\',-1)">👎 '+(t.downvotes||0)+'</span><button class="btn btn-ghost btn-xs" onclick="commentSupport(\''+t.id+'\')">💬 Reply</button><button class="btn btn-ghost btn-xs" onclick="adminReplySupport(\''+t.id+'\')">📌 Pin</button></div></div>'});
if(!posts.length)fh='<div style="color:var(--tx3);text-align:center;padding:20px">Board is empty — post something! 🎯</div>';
el.innerHTML=fh}).catch(function(e){el.innerHTML='<div style="color:var(--tx3)">'+esc(e.message)+'</div>'})}
else{el.innerHTML='<div style="color:var(--tx3);padding:20px">Loading...</div>'}}}

// ═══════════════════════════════════════════════════════════════
// SECTION 14: HUB HELPERS
// Functions: saveScratchPad, clearScratchPad, hubChangeMood,
//            hubPostStatus, hubAddTask, hubToggleTask, hubDeleteTask
// Dependencies: getUserName, getUserId, getMFXProfile, saveMFXProfile,
//              fbDb (microfeed collection), renderStaffHub,
//              changeMood, updateAlertStrip, toast, localStorage
// ═══════════════════════════════════════════════════════════════

const saveScratchPad = (auto) => {
  const ta = document.getElementById('scratchPad');
  if (!ta) return;
  const padKey = 'mfx_scratch_' + getUserName();
  const ts = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  localStorage.setItem(padKey, ta.value);
  localStorage.setItem(padKey + '_ts', ts);
  const lbl = document.getElementById('padSaved');
  if (lbl) lbl.textContent = 'Saved ' + ts;
  if (!auto) toast('Scratch pad saved', 'ok');
};

const clearScratchPad = () => {
  if (!confirm('Clear scratch pad?')) return;
  const ta = document.getElementById('scratchPad');
  if (ta) ta.value = '';
  const padKey = 'mfx_scratch_' + getUserName();
  localStorage.removeItem(padKey);
  localStorage.removeItem(padKey + '_ts');
  const lbl = document.getElementById('padSaved');
  if (lbl) lbl.textContent = '';
  toast('Cleared', 'ok');
};

function hubChangeMood(){changeMood();renderStaffHub()}
function hubPostStatus(){var el=$('hubStatus');if(!el||!el.value.trim())return;var msg=el.value.trim();var p=getMFXProfile();
if(fbDb){fbDb.collection('microfeed').add({message:msg,user:getUserName(),userId:getUserId(),type:'status',mood:p.mood,timestamp:firebase.firestore.FieldValue.serverTimestamp()}).then(function(){toast('Posted!','ok');el.value='';renderStaffHub()}).catch(function(e){toast('Error: '+e.message,'err')})}
saveMFXProfile('lastStatus',msg);saveMFXProfile('lastStatusAt',new Date().toISOString());if(typeof updateAlertStrip==='function')updateAlertStrip()}
// PERF-08 fix (2026-05-24): module-level cache for mfx_tasks localStorage.
// Before: every renderStaffHub() + every task add/toggle/delete did
//   JSON.parse(localStorage.getItem('mfx_tasks')) — synchronous & blocks main thread.
// After: parse once, keep in memory, invalidate on write.
var _mfxTasksCache=null;
function getMfxTasks(){
  if(_mfxTasksCache!==null)return _mfxTasksCache;
  try{_mfxTasksCache=JSON.parse(localStorage.getItem('mfx_tasks')||'[]');}
  catch(e){_mfxTasksCache=[];}
  if(!Array.isArray(_mfxTasksCache))_mfxTasksCache=[];
  return _mfxTasksCache;
}
function setMfxTasks(arr){
  _mfxTasksCache=Array.isArray(arr)?arr:[];
  try{localStorage.setItem('mfx_tasks',JSON.stringify(_mfxTasksCache));}
  catch(e){console.warn('setMfxTasks failed:',e);}
}
function hubAddTask(){var text=prompt('Task:');if(!text)return;var date=prompt('Due date (YYYY-MM-DD) or leave blank:');var tasks=getMfxTasks().slice();tasks.unshift({id:'t'+Date.now(),text:text.trim(),date:date||'',done:false});setMfxTasks(tasks);renderStaffHub()}
function hubToggleTask(tid){var tasks=getMfxTasks().slice();var t=tasks.find(function(x){return x.id===tid});if(t)t.done=!t.done;setMfxTasks(tasks);renderStaffHub()}
function hubDeleteTask(tid){setMfxTasks(getMfxTasks().filter(function(x){return x.id!==tid}));renderStaffHub()}
window.detachCoreListeners=function(){_coreListeners.forEach(function(fn){fn()});_coreListeners=[];if(window._editPresenceUnsub){window._editPresenceUnsub();window._editPresenceUnsub=null;}};

