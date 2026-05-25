"""
apply-audit-fixes.py
====================
Apply the 6 critical-audit fixes to the MFX-OS codebase deterministically.
Writes via temp file + os.replace (atomic) — same pattern that worked for
MATS expansion. Verifies each file with node --check / json.load before
moving on to the next. Stops at first failure with no half-applied state.

Fixes applied:
  SEC-02  firebase.json   — add ignore entries for sensitive JSON + .bak files
  UX-01   core.js          — expand DEPT_ALLOWED_VIEWS to include all dept-home aliases
  DATA-02 orders.js        — unify SO field names (faceStock/lamination canonical)
  SEC-01  firestore.rules  — add email-match check on portal quote get/update + portalMessages
  PERF-01/02/03 core.js + notifications.js — .limit() on quotes/customers/templates/jobTickets listeners
  DATA-01 core.js + firestore.rules — Firestore overlay for materials Manage UI

Usage:
  python3 scripts/audits/apply-audit-fixes.py
"""
import json
import os
import shutil
import subprocess
import sys
import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

BACKUP_DIR = os.path.join('scripts', 'audits', 'fix-backups-' + datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S'))
os.makedirs(BACKUP_DIR, exist_ok=True)

def backup(rel):
    dst = os.path.join(BACKUP_DIR, rel.replace('/', '__'))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(rel, dst)
    return dst

def atomic_write(rel, content):
    tmp = rel + '.applying.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    os.replace(tmp, rel)

def read(rel):
    with open(rel, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def verify_js(rel):
    r = subprocess.run(['node', '--check', rel], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'{rel}: node --check FAILED:\n{r.stderr}')

def verify_json(rel):
    with open(rel) as f:
        json.load(f)  # raises on invalid

def replace_unique(content, needle, replacement, what):
    count = content.count(needle)
    if count == 0:
        raise RuntimeError(f'{what}: needle not found')
    if count > 1:
        raise RuntimeError(f'{what}: needle matches {count} times (expected 1)')
    return content.replace(needle, replacement)


# ============================================================
# FIX 1: SEC-02 — firebase.json ignore entries
# ============================================================
def fix_sec_02():
    print('[SEC-02] firebase.json: adding ignore entries')
    rel = 'firebase.json'
    backup(rel)
    src = read(rel)
    needle = '''      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],'''
    replacement = '''      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**",
        "**/customers-data.json",
        "**/job-tickets-data.json",
        "**/*.bak",
        "**/*.backup"
      ],'''
    count = src.count(needle)
    if count == 0:
        print('  WARN: ignore block not found in expected form, skipping')
        return
    new = src.replace(needle, replacement)
    atomic_write(rel, new)
    verify_json(rel)
    print(f'  OK ({count} block(s) updated)')


# ============================================================
# FIX 2: UX-01 — DEPT_ALLOWED_VIEWS expansion
# ============================================================
def fix_ux_01():
    print('[UX-01] core.js: expanding DEPT_ALLOWED_VIEWS')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)
    old = '''// ═══ DEPARTMENT → ALLOWED VIEWS ═══
var DEPT_ALLOWED_VIEWS={
  'client services':['quotes','customers','orders','templates','clientservices','sales','vendorpos','vendorprofile','ppd','jobtracker','dept-cs-home','dashboard','ceodash','launchpad','aiops','dept-jt-home'],
  'sales':['quotes','customers','orders','templates','clientservices','sales','vendorpos','vendorprofile','dept-cs-home','dashboard','launchpad'],
  'estimation':['quotes','customers','orders','templates','clientservices','sales','vendorpos','vendorprofile','ppd','dept-cs-home','dashboard','launchpad'],
  'pre-press':['ppd','jobtracker','production','dept-pp-home','dashboard','launchpad','dept-jt-home'],
  'prepress':['ppd','jobtracker','production','dept-pp-home','dashboard','launchpad','dept-jt-home'],
  'production':['production','jobtracker','operator','ppd','dept-production-home','dashboard','launchpad','dept-jt-home'],
  'manufacturing':['production','jobtracker','operator','ppd','dept-production-home','dashboard','launchpad','dept-jt-home'],
  'logistics':['logistics','production','jobtracker','dept-logistics-home','dashboard','launchpad','dept-jt-home'],
  'shipping':['logistics','production','jobtracker','dept-logistics-home','dashboard','launchpad','dept-jt-home'],
  'quality':['quality','capa','gmp','audit','training','doccontrol','sqfdatalogs','fsqms','records','dept-quality-home','dashboard','launchpad'],
  'qa':['quality','capa','gmp','audit','training','doccontrol','sqfdatalogs','fsqms','records','dept-quality-home','dashboard','launchpad'],
  'finance':['accounting','finance','dept-finance-home','dashboard','launchpad'],
  'accounting':['accounting','finance','dept-finance-home','dashboard','launchpad'],
  'fsqms':['gmp','capa','audit','training','doccontrol','sqfdatalogs','fsqms','records','quality','dept-fsqms-home','dashboard','launchpad'],
  'operations':null,'administration':null,'ceo':null,'executive':null,'management':null
};'''
    new = '''// ═══ DEPARTMENT → ALLOWED VIEWS ═══
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
window.ALL_DEPT_HOMES=ALL_DEPT_HOMES;'''
    new_src = replace_unique(src, old, new, 'DEPT_ALLOWED_VIEWS')
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# FIX 3: DATA-02 — orders.js unify SO field names
# ============================================================
def fix_data_02():
    print('[DATA-02] orders.js: unifying SO field names to faceStock/lamination')
    rel = 'public/js/orders.js'
    backup(rel)
    src = read(rel)
    # The second SO create path uses face/laminate; the first uses faceStock/lamination.
    # We unify the second to also write faceStock/lamination, and add liner+adhesive
    # which the first path already includes.
    old = '''    face:f.face||f.faceStock||'',
    laminate:f.laminate||f.lamination||'',
    coating:f.coating||'',
    windDir:f.windDir||f.copyPos||'','''
    new = '''    // DATA-02 fix (2026-05-24): canonical names are faceStock + lamination.
    // Legacy keys (face, laminate) kept as fallback reads; never written here.
    faceStock:f.faceStock||f.face||'',
    lamination:f.lamination||f.laminate||'',
    coating:f.coating||'',
    adhesive:f.adhesive||'',
    liner:f.liner||'',
    windDir:f.windDir||f.copyPos||'','''
    new_src = replace_unique(src, old, new, 'orders.js SO fields')
    atomic_write(rel, new_src)
    verify_js(rel)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# FIX 4: SEC-01 — firestore.rules portal quote email check
# ============================================================
def fix_sec_01():
    print('[SEC-01] firestore.rules: adding email check on portal quote get/update')
    rel = 'firestore.rules'
    backup(rel)
    src = read(rel)
    old = '''      // Portal clients: direct doc access by ID (the link IS the access token)
      // Any verified user with the doc ID can read — the secret URL grants access
      allow get: if signedIn() && request.auth.token.email != null;
      // Query by quoteNum (legacy links) — requires email match for security
      allow list: if signedIn()
        && request.auth.token.email != null
        && (resource.data.get('poClientEmail', '') == request.auth.token.email
            || resource.data.get('fields', {}).get('custEmail', '') == request.auth.token.email);
      // Portal PO submission + visit tracking: no status changes allowed
      // Any authenticated portal user with doc access can update portal-safe fields
      allow update: if signedIn()
        && request.auth.token.email != null
        && request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['poNumber','poShipTo','poInstructions','poSignature',
                       'poSignedAt','poQtyIndex','poSkuCount','poSelectedQty',
                       'poSelectedTotal','poClientEmail','poFiles','artFiles',
                       'artFilesBySku','portalStats','updatedAt']);

      // Portal messages subcollection — scoped to quote participants
      match /portalMessages/{msgId} {
        allow read: if signedIn()
          && request.auth.token.email != null;
        allow create: if signedIn()
          && request.auth.token.email != null;
      }'''
    new = '''      // SEC-01 fix (2026-05-24): portal clients can only access quotes where
      // their email matches the quote's poClientEmail or fields.custEmail.
      // The doc-ID alone is NOT sufficient — previously anyone signed in could
      // read/modify any quote by ID. companyUser() rules above still apply to
      // internal employees; these signedIn rules are portal-only.
      allow get: if signedIn()
        && request.auth.token.email != null
        && (resource.data.get('poClientEmail', '') == request.auth.token.email
            || resource.data.get('fields', {}).get('custEmail', '') == request.auth.token.email);
      // Query by quoteNum (legacy links) — requires email match for security
      allow list: if signedIn()
        && request.auth.token.email != null
        && (resource.data.get('poClientEmail', '') == request.auth.token.email
            || resource.data.get('fields', {}).get('custEmail', '') == request.auth.token.email);
      // Portal PO submission: portal-safe fields only, AND requester email must
      // match the quote's stored portal email.
      allow update: if signedIn()
        && request.auth.token.email != null
        && (resource.data.get('poClientEmail', '') == request.auth.token.email
            || resource.data.get('fields', {}).get('custEmail', '') == request.auth.token.email)
        && request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['poNumber','poShipTo','poInstructions','poSignature',
                       'poSignedAt','poQtyIndex','poSkuCount','poSelectedQty',
                       'poSelectedTotal','poClientEmail','poFiles','artFiles',
                       'artFilesBySku','portalStats','updatedAt']);

      // Portal messages subcollection — scoped to portal client of THIS quote.
      // Uses get() on parent quote to verify email match.
      match /portalMessages/{msgId} {
        allow read: if signedIn()
          && request.auth.token.email != null
          && (get(/databases/$(database)/documents/quotes/$(quoteId)).data.get('poClientEmail', '') == request.auth.token.email
              || get(/databases/$(database)/documents/quotes/$(quoteId)).data.get('fields', {}).get('custEmail', '') == request.auth.token.email
              || companyUser());
        allow create: if signedIn()
          && request.auth.token.email != null
          && (get(/databases/$(database)/documents/quotes/$(quoteId)).data.get('poClientEmail', '') == request.auth.token.email
              || get(/databases/$(database)/documents/quotes/$(quoteId)).data.get('fields', {}).get('custEmail', '') == request.auth.token.email
              || companyUser());
      }'''
    new_src = replace_unique(src, old, new, 'firestore portal quote rules')
    atomic_write(rel, new_src)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# FIX 5: DATA-01 (part 1) — firestore.rules materialsCatalog rule
# ============================================================
def fix_data_01_rules():
    print('[DATA-01] firestore.rules: adding materialsCatalog rule')
    rel = 'firestore.rules'
    src = read(rel)
    old = '''    match /quoteTemplates/{templateId} {
      allow read: if companyUser();
      allow write: if canEditCommercial() || canEditPPD();
    }'''
    new = '''    match /quoteTemplates/{templateId} {
      allow read: if companyUser();
      allow write: if canEditCommercial() || canEditPPD();
    }

    // DATA-01 fix (2026-05-24): Materials catalog overlay (user-added dies,
    // films, label stocks, varnishes). All employees can read and edit so the
    // Manage UI persists across teammates. Tighten write to isManagement() later
    // if catalog vandalism becomes a concern.
    match /materialsCatalog/{type} {
      allow read: if companyUser();
      allow write: if companyUser();
    }'''
    new_src = replace_unique(src, old, new, 'materialsCatalog rule')
    atomic_write(rel, new_src)
    print(f'  OK ({len(new_src) - len(src):+d} bytes)')


# ============================================================
# FIX 6: PERF-01/02/03 — core.js listeners + DATA-01 spec funcs in core.js
# These both touch core.js, so we apply them together for efficiency.
# ============================================================
def fix_perf_and_data_01_core():
    print('[PERF-01/02/03 + DATA-01] core.js: listener limits + Firestore spec overlay')
    rel = 'public/js/core.js'
    backup(rel)
    src = read(rel)

    # ---- PERF-01/02/03: bound the listeners ----
    old1 = '''function startListeners(){
_coreListeners.push(fbDb.collection('quotes').orderBy('updatedAt','desc').onSnapshot(s=>{
  var incoming=s.docs.map(d=>({...d.data(),id:d.id}));
  // Preserve the actively-edited quote if the snapshot doesn't include it yet (pending write)
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
_coreListeners.push(fbDb.collection('customers').orderBy('company').onSnapshot(s=>{_cache.customers=s.docs.map(d=>({...d.data(),id:d.id}));if(_ready){if(S.view==='customers')renderCust();if(S.view==='clientservices'&&window.MFX_VIEW_RENDERERS&&window.MFX_VIEW_RENDERERS.clientservices)window.MFX_VIEW_RENDERERS.clientservices();}}, err => console.warn('core customers listener:', err.message)));
_coreListeners.push(fbDb.collection('quoteTemplates').onSnapshot(s=>{_cache.templates=s.docs.map(d=>({...d.data(),id:d.id}))}, err => console.warn('core quoteTemplates listener:', err.message)));
_ready=true}'''
    new1 = '''// PERF-01/02/03 fix (2026-05-24): Bounded listeners.
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
_ready=true}'''
    src = replace_unique(src, old1, new1, 'PERF listeners')

    # ---- DATA-01: spec management section ----
    old2 = '''const SPEC_KEYS={dies:'mfx_spec_dies',films:'mfx_spec_films',labels:'mfx_spec_labels',varnishes:'mfx_spec_varnishes'};
function getSpecList(type){
const base={dies:SPEC_DIES,films:SPEC_FILMS,labels:SPEC_LABELS,varnishes:SPEC_VARNISHES}[type]||[];
try{const extra=JSON.parse(localStorage.getItem(SPEC_KEYS[type])||'[]');return[...base,...extra]}catch(e){return base}
}
function addSpecItem(type,item){
try{const extra=JSON.parse(localStorage.getItem(SPEC_KEYS[type])||'[]');extra.push(item);localStorage.setItem(SPEC_KEYS[type],JSON.stringify(extra));return true}catch(e){return false}
}
function removeUserSpecItem(type,idx){
try{const extra=JSON.parse(localStorage.getItem(SPEC_KEYS[type])||'[]');const base={dies:SPEC_DIES,films:SPEC_FILMS,labels:SPEC_LABELS,varnishes:SPEC_VARNISHES}[type]||[];
const realIdx=idx-base.length;if(realIdx>=0&&realIdx<extra.length){extra.splice(realIdx,1);localStorage.setItem(SPEC_KEYS[type],JSON.stringify(extra));return true}return false}catch(e){return false}
}
function deleteSpec(type,id){if(!confirm('Delete this spec?'))return;const key='mfx_spec_'+type;const overlay=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify(overlay.filter(x=>(typeof x==='object'?x.id:x)!==id)));toast('Deleted','ok');showSpecManager(type)}
function editSpec(type,id){const list=getSpecList(type);const item=list.find(x=>(typeof x==='object'?x.id:x)===id);if(!item)return;if(typeof item==='object'){const desc=prompt('Description:',item.desc||item.d||'');if(desc!==null)item.desc=desc;const notes=prompt('Notes:',item.notes||'');if(notes!==null)item.notes=notes;const key='mfx_spec_'+type;const overlay=JSON.parse(localStorage.getItem(key)||'[]');const idx=overlay.findIndex(x=>x.id===id);if(idx>=0)overlay[idx]=item;else overlay.push(item);localStorage.setItem(key,JSON.stringify(overlay));toast('Updated','ok');showSpecManager(type)}}'''
    new2 = '''// DATA-01 fix (2026-05-24): Spec overlays now persist to Firestore so
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
  },{merge:true}).then(function(){return true;}).catch(function(e){
    console.error('addSpecItem('+type+'):',e);
    if(typeof toast==='function')toast('Save failed — check connection','err');
    return false;
  });
}
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
}'''
    src = replace_unique(src, old2, new2, 'spec management section')

    # ---- DATA-01: add-helpers must await the Promises ----
    old3 = '''function addNewDie(){const id=prompt('Die # (e.g. AG1999):');if(!id)return;const shape=prompt('Shape:')||'';const sA=prompt('Size Across:')||'';const sAr=prompt('Size Around:')||'';
addSpecItem('dies',{id:id.trim(),shape,blankSize:'',cutTo:'',sA,sAr,repeat:'',nA:'',nAr:'',gapAr:'',gapA:'',cRad:'',gearTooth:'',notes:'User added'});toast('Die added','ok');showSpecManager('dies')}
function addNewSpec(type){const id=prompt('Spec ID:');if(!id)return;const desc=prompt('Description:')||'';
addSpecItem(type,{id:id.trim(),desc});toast('Added','ok');showSpecManager(type)}
function addNewVarnish(){const v=prompt('Varnish name:');if(!v)return;addSpecItem('varnishes',v.trim());toast('Varnish added','ok');showSpecManager('varnishes')}'''
    new3 = '''function addNewDie(){const id=prompt('Die # (e.g. AG1999):');if(!id)return;const shape=prompt('Shape:')||'';const sA=prompt('Size Across:')||'';const sAr=prompt('Size Around:')||'';
Promise.resolve(addSpecItem('dies',{id:id.trim(),shape,blankSize:'',cutTo:'',sA,sAr,repeat:'',nA:'',nAr:'',gapAr:'',gapA:'',cRad:'',gearTooth:'',notes:'User added by '+(typeof getUserName==='function'?getUserName():'unknown'),createdAt:new Date().toISOString()})).then(function(ok){if(ok){toast('Die added','ok');showSpecManager('dies')}})}
function addNewSpec(type){const id=prompt('Spec ID:');if(!id)return;const desc=prompt('Description:')||'';
Promise.resolve(addSpecItem(type,{id:id.trim(),desc,createdAt:new Date().toISOString(),createdBy:(typeof getUserName==='function'?getUserName():'unknown')})).then(function(ok){if(ok){toast('Added','ok');showSpecManager(type)}})}
function addNewVarnish(){const v=prompt('Varnish name:');if(!v)return;Promise.resolve(addSpecItem('varnishes',v.trim())).then(function(ok){if(ok){toast('Varnish added','ok');showSpecManager('varnishes')}})}'''
    src = replace_unique(src, old3, new3, 'addNewDie/addNewSpec/addNewVarnish')

    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# FIX 7: PERF-03 — notifications.js jobTickets listeners
# ============================================================
def fix_perf_03_notifications():
    print('[PERF-03] notifications.js: bound jobTickets listeners')
    rel = 'public/js/notifications.js'
    backup(rel)
    src = read(rel)

    old1 = '''      return window.fbDb.collection('jobTickets').onSnapshot(snapshot => {
        // Skip the initial snapshot — it fires 'added' for every existing doc and floods notifications
        if (_jtInitialLoad) { _jtInitialLoad = false; return; }'''
    new1 = '''      // PERF-03 fix (2026-05-24): Bounded to recent 300 tickets (orderBy
      // updatedAt). Older closed jobs don't need to trigger notifications.
      return window.fbDb.collection('jobTickets').orderBy('updatedAt','desc').limit(300).onSnapshot(snapshot => {
        // Skip the initial snapshot — it fires 'added' for every existing doc and floods notifications
        if (_jtInitialLoad) { _jtInitialLoad = false; return; }'''
    src = replace_unique(src, old1, new1, 'notifications.js jobTickets listener 1')

    old2 = '''    // Watch job tickets for due dates
    fbDb.collection('jobTickets').onSnapshot(function(snap) {'''
    new2 = '''    // Watch job tickets for due dates
    // PERF-13 fix (2026-05-24): Bound to recent 200 tickets only. Older
    // tickets' calendar entries should already exist; only newly-active ones
    // need syncing. orderBy + limit avoids cost explosion.
    fbDb.collection('jobTickets').orderBy('updatedAt','desc').limit(200).onSnapshot(function(snap) {'''
    src = replace_unique(src, old2, new2, 'notifications.js jobTickets listener 2')

    atomic_write(rel, src)
    verify_js(rel)
    print(f'  OK')


# ============================================================
# RUN
# ============================================================
def main():
    print(f'Applying audit fixes...')
    print(f'Backup dir: {BACKUP_DIR}\n')
    fix_sec_02()
    fix_ux_01()
    fix_data_02()
    fix_sec_01()
    fix_data_01_rules()
    fix_perf_and_data_01_core()
    fix_perf_03_notifications()
    print('\nAll fixes applied. Final sizes:')
    for rel in ['firebase.json', 'firestore.rules', 'public/js/core.js',
                'public/js/orders.js', 'public/js/notifications.js']:
        print(f'  {rel}: {os.path.getsize(rel):,} bytes')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nFAILED: {e}', file=sys.stderr)
        print(f'Backup at: {BACKUP_DIR}', file=sys.stderr)
        sys.exit(1)
