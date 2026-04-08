'use strict';

// ═══ VIEW NAVIGATION HISTORY + UNSAVED CHANGES GUARD ═══
window._viewHistory=[];window._viewHistoryIdx=-1;window._viewDirty=false;window._navLocked=false;

function trackView(v){
if(window._navLocked)return;
// Trim forward history
if(window._viewHistoryIdx<window._viewHistory.length-1)window._viewHistory=window._viewHistory.slice(0,window._viewHistoryIdx+1);
window._viewHistory.push(v);
window._viewHistoryIdx=window._viewHistory.length-1;
updateNavArrows()}

function updateNavArrows(){
var back=$('hdrNavBack');var fwd=$('hdrNavFwd');
if(back)back.style.display=window._viewHistoryIdx>0?'inline':'none';
if(fwd)fwd.style.display=window._viewHistoryIdx<window._viewHistory.length-1?'inline':'none'}

function navBack(){
if(window._viewHistoryIdx<=0)return;
if(window._viewDirty){showUnsavedModal(function(){window._viewDirty=false;navBack()});return}
window._navLocked=true;
window._viewHistoryIdx--;
var v=window._viewHistory[window._viewHistoryIdx];
goView(v);
window._navLocked=false;
updateNavArrows()}

function navForward(){
if(window._viewHistoryIdx>=window._viewHistory.length-1)return;
if(window._viewDirty){showUnsavedModal(function(){window._viewDirty=false;navForward()});return}
window._navLocked=true;
window._viewHistoryIdx++;
var v=window._viewHistory[window._viewHistoryIdx];
goView(v);
window._navLocked=false;
updateNavArrows()}

function markDirty(){window._viewDirty=true;var si=$('saveIndicator');if(si){si.style.display='block';si.textContent='● unsaved'}}
function markClean(){window._viewDirty=false;var si=$('saveIndicator');if(si)si.style.display='none'}
window.markDirty=markDirty;window.markClean=markClean;

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

function showUnsavedModal(onDiscard){
var h='<div style="text-align:center;padding:10px">';
h+='<div style="font-size:18px;margin-bottom:8px">⚠</div>';
h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:6px">Unsaved Changes</div>';
h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:16px">You have work in progress. Leaving will discard your changes.</div>';
h+='<div style="display:flex;gap:8px;justify-content:center">';
h+='<button class="btn btn-pr" onclick="closeModal();if(typeof saveCurrentWork===\'function\')saveCurrentWork();markClean()">Save</button>';
h+='<button class="btn btn-ghost" onclick="closeModal();markClean();('+(onDiscard?'window._unsavedCb':'function(){}')+')()" id="unsavedDiscardBtn">Discard & Leave</button>';
h+='<button class="btn btn-ghost" onclick="closeModal()">Stay</button>';
h+='</div></div>';
window._unsavedCb=onDiscard||function(){};
openModal(h)}

// Guard goView against unsaved changes
var _origGoViewGuard=null;
function installGoViewGuard(){
if(_origGoViewGuard)return;
var realGoView=window.goView;
_origGoViewGuard=realGoView;
// Note: guard is checked in navBack/navForward, not in goView itself
// to avoid blocking programmatic navigation
}

// ═══════════════════════════════════════════════
// SMART ALERT STRIP — color-coded flag above bottom bar
// ═══════════════════════════════════════════════
const updateAlertStrip = () => {
  const me = getUserName();
  const qs = DB.quotes();
  const now = new Date();
  const alerts = [];

  // 1. Quote alerts from local DB
  qs.forEach(function(q) {
    if (q.createdBy !== me) return;
    if (q.status === 'approval') alerts.push({level:'warn', flag:'🟡', text:'Quote '+esc(q.quoteNum)+' waiting for CEO approval', action:'openEditor', id:q.id});
    if (q.status === 'ready')   alerts.push({level:'ok',   flag:'🟢', text:'Quote '+esc(q.quoteNum)+' approved — ready to send', action:'openEditor', id:q.id});
    if (q.status === 'sent') {
      var sentDays = q.sentAt ? Math.floor((now - new Date(q.sentAt)) / 86400000) : 0;
      if (sentDays >= 7) alerts.push({level:'warn', flag:'🟠', text:'Quote '+esc(q.quoteNum)+' sent '+sentDays+'d ago — follow up', action:'openEditor', id:q.id});
    }
  });

  // 2. Overdue requests — read from consolidated _rfqData listener (no extra Firestore query)
  var overdue = window._rfqData ? window._rfqData.overdue || [] : [];
  overdue.forEach(function(r) {
    alerts.push({level: overdue.length >= 5 ? 'crit' : 'err', flag: overdue.length >= 5 ? '🔴' : '🟠', text: r.requestType+' request overdue: '+r.company, action:'openSubmittedRequests', id:r.id});
  });
  if (overdue.length >= 5) document.body.classList.add('overdue-border');
  else document.body.classList.remove('overdue-border');
  _renderAlertStrip(alerts);
};

const _renderAlertStrip = (alerts) => {
  window._currentAlerts = alerts;
  // Route alerts to bell badge instead of banner strip
  _updateNotifBadge(alerts.length);
  // Hide the banner reel — alerts go to bell now
  var reel = document.getElementById('alertReel');
  if(reel) { reel.style.display = 'none'; }
  document.body.classList.remove('has-alert');
};

function _updateNotifBadge(alertCount) {
  var dot = document.getElementById('mfx-notif-dot');
  var total = (alertCount || 0) + ((window.NOTIF_STATE && window.NOTIF_STATE.unreadCount) || 0);
  if (dot) {
    var panelOpen = (window.MFXNotifications && window.MFXNotifications.STATE && window.MFXNotifications.STATE.panelOpen) || window._calDropdownOpen;
    if (total > 0 && !panelOpen) { dot.style.animation = 'pulse 1.5s infinite'; }
    else { dot.style.animation = 'none'; }
  }
}
window._updateNotifBadge = _updateNotifBadge;

window.showAlertReel = function(type, message, color) {
  // Add to alerts array and update bell badge — no banner
  if(!window._currentAlerts) window._currentAlerts = [];
  window._currentAlerts.push({level: color==='rd'?'crit':(color==='or'?'err':'warn'), flag: type, text: message});
};

window.openNotifPanel = function() {
  if (window.MFXNotifications && window.MFXNotifications.toggleNotifDropdown) {
    window.MFXNotifications.toggleNotifDropdown();
  } else {
    goView('notifications');
  }
};

const openAlertDetail = () => {
  const alerts = window._currentAlerts || [];
  if (!alerts.length) return;
  const colors = {
    crit: {bg:'#450a0a', border:'#dc2626', text:'#fca5a5', label:'Critical'},
    err:  {bg:'#431407', border:'#ea580c', text:'#fdba74', label:'Overdue'},
    warn: {bg:'#422006', border:'#d97706', text:'#fcd34d', label:'Attention'},
    ok:   {bg:'#052e16', border:'#16a34a', text:'#86efac', label:'Ready'}
  };
  var h = '<div class="modal-title">⚑ Alerts</div>';
  alerts.forEach(function(a) {
    var c = colors[a.level] || colors.warn;
    h += '<div style="background:'+c.bg+';border:1px solid '+c.border+';border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="closeModal();'+(a.action==='openEditor'?'openEditor(\''+a.id+'\')':'openSubmittedRequests()')+'">';
    h += '<span style="font-size:18px">'+a.flag+'</span>';
    h += '<div style="flex:1"><div style="font-size:11px;font-weight:700;color:'+c.text+'">'+c.label+'</div>';
    h += '<div style="font-size:11px;color:'+c.text+';opacity:.85;margin-top:1px">'+a.text+'</div></div>';
    h += '<span style="font-size:10px;color:'+c.text+';opacity:.6">tap →</span></div>';
  });
  h += '<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Close</button>';
  openModal(h);
};

// ═══ FLEXFEED & UPDATES CAROUSEL ═══
window._hamFeedData=[];window._hamFeedFilter='all';window._hamFeedPage=0;

function loadHamFeed(){
var feed=[];var now=new Date();var me=typeof getUserName==='function'?getUserName():'';
var p=typeof getMFXProfile==='function'?getMFXProfile():{};
var dept=p.dept||'Operations';
var qs=typeof DB!=='undefined'?DB.quotes():[];

// ── CULTURE: People, Culture, Production Wins ──
var wonCount=qs.filter(function(q){return q.status==='won'}).length;
if(wonCount)feed.push({cat:'culture',ico:'🏆',title:'Production Win: '+wonCount+' deals closed!',sub:'FlexAi',tag:'culture'});
feed.push({cat:'culture',ico:'🌟',title:'Culture Spotlight: Team collaboration is up this week',sub:'FlexAi',tag:'culture'});
feed.push({cat:'culture',ico:'🧠',title:'SQF Trivia: What does HACCP stand for?',sub:'FlexAi · tap to answer',tag:'culture'});

// ── PRODUCTION: Dept updates by FlexAi ──
var inProd=qs.filter(function(q){return q.status==='production'||q.status==='ready'}).length;
feed.push({cat:'production',ico:'🏭',title:dept+' Update: '+inProd+' jobs active in pipeline',sub:'FlexAi · Department Brief',tag:'production'});
var approvals=qs.filter(function(q){return q.status==='approval'}).length;
if(approvals)feed.push({cat:'production',ico:'🔒',title:approvals+' quotes pending approval',sub:'FlexAi · Needs Attention',tag:'production'});
feed.push({cat:'production',ico:'📊',title:'Weekly output trending above target',sub:'FlexAi · Production Analytics',tag:'production'});

// ── STAFF: Mood, check-in/out, daily status ──
feed.push({cat:'staff',ico:'😊',title:'Daily Mood Check: How is the team feeling today?',sub:'FlexAi · Staff Wellness',tag:'staff'});
feed.push({cat:'staff',ico:'🟢',title:me+' checked in on MFX OS',sub:'Just now',tag:'staff'});
feed.push({cat:'staff',ico:'📋',title:'Staff Status: All team leads checked in today',sub:'FlexAi · Attendance',tag:'staff'});

// ── ORG: Leadership updates ──
feed.push({cat:'org',ico:'📢',title:'Director Update: Q2 goals published',sub:'Leadership · Org Comms',tag:'org'});
feed.push({cat:'org',ico:'🏢',title:'CEO Brief: Company milestone reached this month',sub:'Leadership · Company Update',tag:'org'});
feed.push({cat:'org',ico:'📣',title:'HR Announcement: Benefits enrollment open',sub:'HR · Action Required',tag:'org'});
feed.push({cat:'org',ico:'⚙',title:'Operations: New SOP rollout next week',sub:'Operations · Announcement',tag:'org'});

// ── GAMES: FlexGames scores ──
var pts=p.score;var pv=typeof pts==='object'?pts.pts:(pts||0);
feed.push({cat:'games',ico:'🎮',title:'FlexGames: Your score is '+Number(pv).toFixed(1)+' pts',sub:'FlexAi · Leaderboard',tag:'games'});
feed.push({cat:'games',ico:'🥇',title:'Top performer this week — check the leaderboard!',sub:'FlexAi · Games Update',tag:'games'});
feed.push({cat:'games',ico:'🔥',title:'Streak challenge: Log in 5 days straight for bonus pts',sub:'FlexAi · Challenge',tag:'games'});

// ── ALERTS: System alerts ──
var alerts=window._currentAlerts||[];
alerts.forEach(function(a){feed.push({cat:'reminders',ico:'⚠',title:a.text,sub:'FlexAi · Reminder',tag:'alerts'})});
if(!alerts.length)feed.push({cat:'reminders',ico:'✅',title:'No active reminders — you\'re all caught up',sub:'FlexAi · Reminders',tag:'alerts'});

window._hamFeedData=feed;
renderHamFeedSlides()}

function filterHamFeed(f){
window._hamFeedFilter=f;window._hamFeedPage=0;
document.querySelectorAll('.ham-feed-tab').forEach(function(t){
if(t.dataset.feed===f){t.style.background='var(--ac)';t.style.color='#000'}
else{t.style.background='var(--bg3)';t.style.color='var(--tx3)'}});
renderHamFeedSlides()}

function hamFeedNav(dir){
var filtered=getFilteredFeed();var pages=Math.ceil(filtered.length/3)||1;
window._hamFeedPage=Math.max(0,Math.min(pages-1,window._hamFeedPage+dir));
renderHamFeedSlides()}

function getFilteredFeed(){
var f=window._hamFeedFilter;var items=window._hamFeedData||[];
if(f==='all')return items;
return items.filter(function(i){return i.cat===f})}

function renderHamFeedSlides(){
var el=document.getElementById('hamFeedSlides');
var pageEl=document.getElementById('hamFeedPage');
if(!el)return;
var filtered=getFilteredFeed();
var perPage=3;var pages=Math.ceil(filtered.length/perPage)||1;
var page=window._hamFeedPage;
var start=page*perPage;var slice=filtered.slice(start,start+perPage);
if(pageEl)pageEl.textContent=(page+1)+' / '+pages;
if(!slice.length){el.innerHTML='<div style="width:100%;padding:12px;text-align:center;font-size:10px;color:var(--tx3)">No updates yet</div>';return}
var h='';
slice.forEach(function(it){
h+='<div style="width:100%;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:8px;align-items:flex-start">';
h+='<span style="font-size:14px;flex-shrink:0;margin-top:1px">'+it.ico+'</span>';
h+='<div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--tx);line-height:1.3">'+esc(it.title)+'</div>';
h+='<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+esc(it.sub)+'</div>';
h+='</div></div>'});
el.innerHTML=h}

function getTimeAgo(d){var s=Math.floor((Date.now()-d.getTime())/1000);if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}

// Signal Command placeholder view
function openSignalCommand(){S.view='supportinbox';document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});$('v-supportinbox').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=function(){goView('dashboard')};$('hdrTitle').textContent='Signal Command';$('hdrActions').innerHTML='';if(typeof applyDeptTheme==='function')applyDeptTheme('ceodash');var el=$('v-supportinbox');if(el)el.innerHTML='<div style="padding:20px;text-align:center"><div style="font-size:24px;margin-bottom:8px">📡</div><div style="font-size:14px;font-weight:700;color:var(--ac);margin-bottom:4px">Signal Command</div><div style="font-size:11px;color:var(--tx3)">Real-time signals, alerts, and intelligence from across MFX OS.<br>Coming soon.</div></div>'}

// Load feed when hamburger opens
window._hamFeedLoaded=false;
(function(){var origRender=window.updateHamMenu;if(typeof origRender==='function'){window.updateHamMenu=function(){origRender.apply(this,arguments);if(!window._hamFeedLoaded||window._hamFeedData.length===0){window._hamFeedLoaded=true;loadHamFeed()}}}})();

// ═══ JOB TICKET TRACKER — DAILY DASH ═══
function openJTDailyDash(){
S.view='supportinbox';
document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});
$('v-supportinbox').classList.add('active');
$('mainTabs').style.display='none';
$('hdrBack').style.display='block';
$('hdrBack').onclick=function(){goView('dashboard')};
$('hdrTitle').textContent='Job Tracker · Daily Dash';
$('hdrActions').innerHTML='<button class="btn btn-pr btn-sm" onclick="goView(\'jobtracker\')">Open Kanban</button>';
if(typeof applyDeptTheme==='function')applyDeptTheme('jobtracker');
var el=$('v-supportinbox');if(!el)return;
var me=getUserName();
var c='#4169E1';

var h='<div style="padding:0 4px">';
// Hero
h+='<div style="background:rgba(255,255,255,.92);border:2px solid #fff;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 0 18px rgba(255,255,255,.2)">';
h+='<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#00e5ff;margin-bottom:4px">Daily Dash</div>';
h+='<div style="font-size:22px;font-weight:800;color:#0a1520;line-height:1.1">Job Ticket Tracker</div>';
h+='<div style="font-size:11px;color:#64748b;margin-top:4px">Live view — staff, active tickets, pods & production status</div>';
h+='</div>';

h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';

// ── Staff In Today ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">👥 Staff In Today</div>';
h+='<div id="jtStaff" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Active Tickets ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">🎫 Active Tickets</div>';
h+='<div id="jtTickets" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Pods Working Together ──
h+='<div class="card" style="border-left:3px solid '+c+';grid-column:1/-1">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">🔗 Pods & Teams Active</div>';
h+='<div id="jtPods" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Today's Schedule ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">📅 Today\'s Schedule</div>';
h+='<div id="jtSchedule" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Production Status ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">🏭 Production Status</div>';
h+='<div id="jtProdStatus" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Recent Activity ──
h+='<div class="card" style="border-left:3px solid '+c+';grid-column:1/-1">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">📋 Recent Activity</div>';
h+='<div id="jtFeed" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

h+='</div></div>';
el.innerHTML=h;

// ── Async: Staff In Today ──
if(fbDb){var cutoff=new Date(Date.now()-8*60*60*1000);
fbDb.collection('users').get().then(function(snap){
var sEl=document.getElementById('jtStaff');if(!sEl)return;
var online=[];snap.docs.forEach(function(d){var u=d.data();var nm=u.displayName||u.email||'';if(!nm)return;var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;if(ls&&ls>cutoff)online.push(nm)});
if(online.length){sEl.innerHTML='<div style="margin-bottom:4px;font-weight:600;color:'+c+'">'+online.length+' checked in</div>'+online.map(function(n){return'<div style="padding:2px 0;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:var(--gn);display:inline-block"></span>'+esc(n)+'</div>'}).join('')}
else{sEl.innerHTML='<div style="color:var(--tx3)">No staff checked in yet</div>'}}).catch(function(e){console.warn('staffCheckin:',e)})}

// ── Async: Active Tickets + Pods + Schedule ──
if(typeof loadAllTasks==='function'){loadAllTasks(function(items){
var today=new Date().toISOString().split('T')[0];
// Active tickets
var tEl=document.getElementById('jtTickets');
if(tEl){var tickets=items.filter(function(t){return!t.completed&&t.type==='task'});
if(tickets.length){tEl.innerHTML='<div style="margin-bottom:4px;font-weight:600;color:'+c+'">'+tickets.length+' open</div>'+tickets.slice(0,8).map(function(t){
var pri=t.priority?'<span style="color:'+(t.priority==='urgent'?'var(--rd)':t.priority==='high'?'var(--or)':'var(--tx3)')+';font-size:8px;font-weight:700">'+t.priority.toUpperCase()+' </span>':'';
return'<div style="padding:3px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="openTaskDetail(\''+esc(t.id)+'\')">'+pri+esc(t.title)+'</div>'}).join('')}
else{tEl.innerHTML='<div style="color:var(--tx3)">No open tickets</div>'}}

// Pods — group by assignee
var pEl=document.getElementById('jtPods');
if(pEl){var pods={};items.filter(function(t){return!t.completed}).forEach(function(t){var a=t.assignedTo||'Unassigned';if(!pods[a])pods[a]=[];pods[a].push(t)});
var podKeys=Object.keys(pods).sort(function(a,b){return pods[b].length-pods[a].length});
if(podKeys.length){pEl.innerHTML=podKeys.slice(0,6).map(function(k){return'<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;margin:2px;background:rgba(65,105,225,.1);border:1px solid rgba(65,105,225,.2);border-radius:8px"><span style="font-weight:600">'+esc(k)+'</span><span style="font-size:9px;color:'+c+'">'+pods[k].length+' tasks</span></div>'}).join('')}
else{pEl.innerHTML='<div style="color:var(--tx3)">No active pods</div>'}}

// Today's schedule
var sEl=document.getElementById('jtSchedule');
if(sEl){var todayItems=items.filter(function(t){return t.date===today}).sort(function(a,b){return(a.time||'zz').localeCompare(b.time||'zz')});
if(todayItems.length){sEl.innerHTML=todayItems.slice(0,6).map(function(t){return'<div style="padding:3px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="openTaskDetail(\''+t.id+'\')"><span style="color:'+c+';font-size:9px;min-width:36px;display:inline-block">'+(t.time||'—')+'</span>'+esc(t.title)+'</div>'}).join('')}
else{sEl.innerHTML='<div style="color:var(--tx3)">Nothing scheduled today</div>'}}

// Production status
var psEl=document.getElementById('jtProdStatus');
if(psEl){var qs=DB.quotes();var inProd=qs.filter(function(q){return q.status==='production'||q.status==='ready'}).length;
var sent=qs.filter(function(q){return q.status==='sent'}).length;
var won=qs.filter(function(q){return q.status==='won'}).length;
psEl.innerHTML='<div style="display:flex;gap:12px"><div><div style="font-size:18px;font-weight:800;color:'+c+'">'+inProd+'</div><div style="font-size:8px;color:var(--tx3)">IN PROD</div></div><div><div style="font-size:18px;font-weight:800;color:var(--or)">'+sent+'</div><div style="font-size:8px;color:var(--tx3)">SENT</div></div><div><div style="font-size:18px;font-weight:800;color:var(--gn)">'+won+'</div><div style="font-size:8px;color:var(--tx3)">WON</div></div></div>'}
})}

// ── Async: Recent Activity ──
if(fbDb){fbDb.collection('activity').orderBy('timestamp','desc').limit(8).get().then(function(snap){
var fEl=document.getElementById('jtFeed');if(!fEl)return;
var acts=snap.docs.map(function(d){return d.data()});
if(acts.length){fEl.innerHTML=acts.map(function(a){var ts=a.timestamp?new Date(a.timestamp):new Date();return'<div style="padding:3px 0;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between"><span>'+esc(a.detail||a.action)+'</span><span style="color:var(--tx3);font-size:9px">'+getTimeAgo(ts)+'</span></div>'}).join('')}
else{fEl.innerHTML='<div style="color:var(--tx3)">No recent activity</div>'}}).catch(function(e){console.warn('dashActivity:',e)})}
}

// ═══ DEPARTMENT HOME PAGES ═══
var DEPT_CONFIG={
'cs':{name:'Client Services',sub:'Commercial Hub — Quotes, Orders, CRM & Pipeline Intelligence',color:'#a855f7',views:['quotes','customers','orders','clientservices','sales'],deptKey:'Sales'},
'pp':{name:'Pre-Press',sub:'Artwork, Proofs, Plates, Die Management & Release Workflow',color:'#d7ff2f',views:['ppd'],deptKey:'Pre-Press'},
'production':{name:'Production',sub:'Manufacturing Floor — Job Passports, Blueprints, Press Schedules & Output Tracking',color:'#4169E1',views:['production','jobtracker','operator'],deptKey:'Production'},
'jt':{name:'Job Ticket Tracker',sub:'Live view — staff, active tickets, pods & production status',color:'#00e5ff',views:['jobtracker'],deptKey:'Production'},
'logistics':{name:'Logistics & Shipping',sub:'Supply Chain — Materials, Ink Room, QC, Packaging, Deliveries & Spoilage',color:'#f59e0b',views:['logistics'],deptKey:'Operations'},
'quality':{name:'Quality',sub:'Compliance Hub — CAPA/NCR, Inspections, Hold Management & Corrective Actions',color:'#ef4444',views:['quality','capa'],deptKey:'Quality'},
'finance':{name:'Finance',sub:'Financial Operations — Accounting, Billing, Invoicing, Budgets & Reporting',color:'#22c55e',views:['accounting','finance'],deptKey:'Accounting'},
'operations':{name:'Operations',sub:'Business Operations — HR, Vendor Management, Accounting & Administration',color:'#C0C0C0',views:['hr','vendorpos','vendorprofile','operator'],deptKey:'Operations'},
'fsqms':{name:'FSQMS',sub:'Food Safety & Quality Management — SQF, GMP, Audits, Training & Document Control',color:'#FFD700',views:['fsqms','sqfdatalogs','gmp','capa','audit','training','doccontrol'],deptKey:'Quality'},
'flexai':{name:'FlexAi',sub:'Intelligence Hub — Dashboard, Analytics, Signal Command & Employee Insights',color:'#00e5ff',views:['ceodash','hr','dashboard','launchpad','datasync'],deptKey:'Administration'}
};

function renderDeptHome(key){
var cfg=DEPT_CONFIG[key];if(!cfg)return;
var vk='dept-'+key+'-home';
var el=$('v-'+vk)||$('v-supportinbox');if(!el)return;
$('hdrActions').innerHTML='';
if(typeof applyDeptTheme==='function'){
var themeView=cfg.views[0]||'dashboard';
applyDeptTheme(themeView)}

var me=getUserName();var p=getMFXProfile();var qs=DB.quotes();
var c=cfg.color;
var h='<div style="padding:0 4px">';

// Hero
h+='<div style="background:linear-gradient(135deg,'+c+'14,'+c+'06);border:1px solid '+c+'30;border-radius:16px;padding:16px;margin-bottom:12px">';
h+='<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:'+c+';opacity:.7;margin-bottom:4px">Department Workspace</div>';
h+='<div style="font-size:22px;font-weight:800;color:var(--tx);line-height:1.1">'+cfg.name+'</div>';
h+='<div style="font-size:11px;color:var(--tx2);margin-top:4px;line-height:1.4">'+cfg.sub+'</div>';
h+='</div>';

// Quick-nav buttons for JT dept home
if(key==='jt'){
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
h+='<button class="btn btn-pr" onclick="openJTDailyDash()" style="padding:12px;font-size:12px;font-weight:700;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> Daily Dash</button>';
h+='<button class="btn btn-ghost" onclick="goView(\'jobtracker\')" style="padding:12px;font-size:12px;font-weight:700;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Kanban Board</button>';
h+='</div>';
}

// Grid sections
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';

// ── Staff In Today ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">👥 Staff In Today</div>';
h+='<div id="deptHomeStaff" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Department Calendar ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">📅 Calendar</div>';
h+='<div id="deptHomeCal" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Tasks In Progress ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">✅ Tasks In Progress</div>';
h+='<div id="deptHomeTasks" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Incoming / Request Intake ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">📥 Incoming Requests</div>';
h+='<div id="deptHomeRequests" style="font-size:10px;color:var(--tx2)">';
var rfq=window._rfqData?window._rfqData.pending||[]:[];
if(rfq.length){rfq.slice(0,5).forEach(function(r){h+='<div style="padding:3px 0;border-bottom:1px solid var(--bdr)">'+r.requestType+' — '+(r.company||'Unknown')+'</div>'})}
else{h+='<div style="color:var(--tx3)">No pending requests</div>'}
h+='</div></div>';

// ── Department Bulletin Board ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">📌 Bulletin Board</div>';
h+='<div style="font-size:10px;color:var(--tx3);padding:8px 0;text-align:center">Post announcements and updates for your team</div>';
h+='<div style="text-align:center"><button class="btn btn-ghost btn-xs" onclick="deptBulletinPost(\''+key+'\')">+ Post Update</button></div>';
h+='</div>';

// ── Department Feed ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">📋 Department Feed</div>';
h+='<div id="deptHomeFeed" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Team Org Chart ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">🏢 Team Org Chart</div>';
h+='<div id="deptHomeOrg" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

// ── Points & Leaderboard ──
h+='<div class="card" style="border-left:3px solid '+c+'">';
h+='<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">🏆 Points & Leaderboard</div>';
h+='<div id="deptHomeLeaderboard" style="font-size:10px;color:var(--tx2)">Loading...</div>';
h+='</div>';

h+='</div></div>';
el.innerHTML=h;

// ── Async populate sections ──
// Staff In Today
if(fbDb){var cutoff=new Date(Date.now()-8*60*60*1000);
fbDb.collection('users').get().then(function(snap){
var sEl=document.getElementById('deptHomeStaff');if(!sEl)return;
var online=[];snap.docs.forEach(function(d){var u=d.data();var nm=u.displayName||u.email||'';if(!nm)return;var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;if(ls&&ls>cutoff)online.push(nm)});
if(online.length){sEl.innerHTML=online.map(function(n){return'<div style="padding:2px 0;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:var(--gn);display:inline-block"></span>'+esc(n)+'</div>'}).join('')}
else{sEl.innerHTML='<div style="color:var(--tx3)">No staff checked in yet</div>'}}).catch(function(){var sEl=document.getElementById('deptHomeStaff');if(sEl)sEl.innerHTML='<div style="color:var(--tx3)">Unavailable</div>'})}

// Calendar — show today + next 3 days
if(typeof loadAllTasks==='function'){loadAllTasks(function(items){
var cEl=document.getElementById('deptHomeCal');if(!cEl)return;
var today=new Date();var ch='';
for(var i=0;i<4;i++){var d=new Date(today);d.setDate(today.getDate()+i);var ds=d.toISOString().split('T')[0];
var dayItems=items.filter(function(t){return t.date===ds&&(t.assignedTo===me||t.createdBy===me)});
ch+='<div style="margin-bottom:4px"><div style="font-size:9px;font-weight:700;color:'+(i===0?c:'var(--tx3)')+'">'+d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(i===0?' — Today':'')+'</div>';
if(dayItems.length){dayItems.forEach(function(t){ch+='<div style="padding:2px 0;padding-left:8px;cursor:pointer" onclick="openTaskDetail(\''+t.id+'\')">'+(t.time||'—')+' '+esc(t.title)+'</div>'})}
else{ch+='<div style="padding:2px 8px;color:var(--tx3)">—</div>'}
ch+='</div>'}
cEl.innerHTML=ch;

// Tasks In Progress
var tEl=document.getElementById('deptHomeTasks');if(tEl){
var myTasks=items.filter(function(t){return t.type==='task'&&!t.completed&&(t.assignedTo===me||t.createdBy===me)});
if(myTasks.length){tEl.innerHTML=myTasks.slice(0,6).map(function(t){return'<div style="padding:3px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="openTaskDetail(\''+t.id+'\')"><span style="color:'+c+';font-size:9px">'+(esc(t.priority)||'')+'</span> '+esc(t.title)+'</div>'}).join('')}
else{tEl.innerHTML='<div style="color:var(--tx3)">No active tasks</div>'}}
})}

// Department Feed — from activity log
if(fbDb){fbDb.collection('activity').orderBy('timestamp','desc').limit(10).get().then(function(snap){
var fEl=document.getElementById('deptHomeFeed');if(!fEl)return;
var acts=snap.docs.map(function(d){return d.data()});
if(acts.length){fEl.innerHTML=acts.slice(0,6).map(function(a){var ts=a.timestamp?new Date(a.timestamp):new Date();return'<div style="padding:3px 0;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between"><span>'+esc(a.detail||a.action)+'</span><span style="color:var(--tx3);font-size:9px">'+getTimeAgo(ts)+'</span></div>'}).join('')}
else{fEl.innerHTML='<div style="color:var(--tx3)">No recent activity</div>'}}).catch(function(e){console.warn('deptActivity:',e)})}

// Team Org Chart
if(fbDb){fbDb.collection('users').get().then(function(snap){
var oEl=document.getElementById('deptHomeOrg');if(!oEl)return;
var members=[];snap.docs.forEach(function(d){var u=d.data();if(u.displayName)members.push({name:u.displayName,email:u.email||''})});
if(members.length){oEl.innerHTML=members.map(function(m){var ini=m.name.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();return'<div style="display:flex;align-items:center;gap:6px;padding:3px 0"><div style="width:22px;height:22px;border-radius:50%;background:'+c+';color:#000;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700">'+esc(ini)+'</div><div><div style="font-size:10px;font-weight:600;color:var(--tx)">'+esc(m.name)+'</div></div></div>'}).join('')}
else{oEl.innerHTML='<div style="color:var(--tx3)">No team data</div>'}}).catch(function(e){console.warn('deptTeam:',e)})}

// Points & Leaderboard
if(typeof calcPoints==='function'){
var leaders=[];var allUsers=[];
var allQs=DB.quotes();
if(fbDb){fbDb.collection('users').get().then(function(snap){
var lEl=document.getElementById('deptHomeLeaderboard');if(!lEl)return;
snap.docs.forEach(function(d){var u=d.data();if(u.displayName){var r=calcPoints(u.displayName,allQs);allUsers.push({name:u.displayName,pts:r.pts})}});
allUsers.sort(function(a,b){return b.pts-a.pts});
if(allUsers.length){lEl.innerHTML=allUsers.slice(0,6).map(function(u,i){var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';return'<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--bdr)"><span>'+medal+' '+esc(u.name)+'</span><span style="color:'+c+';font-weight:700">'+u.pts.toFixed(1)+' pts</span></div>'}).join('')}
else{lEl.innerHTML='<div style="color:var(--tx3)">No scores yet</div>'}}).catch(function(e){console.warn('deptScores:',e)})}}
}

function deptBulletinPost(key){toast('Bulletin board coming soon','ok')}

// Register dept home views
if(!window.MFX_VIEW_RENDERERS)window.MFX_VIEW_RENDERERS={};
if(!window.MFX_VIEW_TITLES)window.MFX_VIEW_TITLES={};
['jt','cs','pp','production','logistics','quality','finance','operations','fsqms','flexai'].forEach(function(k){
var vk='dept-'+k+'-home';
window.MFX_VIEW_RENDERERS[vk]=function(){renderDeptHome(k)};
window.MFX_VIEW_TITLES[vk]=DEPT_CONFIG[k]?DEPT_CONFIG[k].name:'Department';
});

function renderDash(){
var el=$('v-dashboard');if(!el)return;
var me=getUserName();var p=getMFXProfile();
var qs=DB.quotes();var now=new Date();
var today=now.toISOString().split('T')[0];

// Update topbar + keep clock ticking
updateTopBar();
if(!window._topbarClockTimer){window._topbarClockTimer=setInterval(function(){var n=new Date();var te=$('topTime');if(te)te.textContent=n.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})},30000)}
initCalendarDropdown();

var h='';

// Personalized greeting
var hour = now.getHours();
var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
var firstName = (me || 'there').split(' ')[0];
h += '<div style="font-size:16px;font-weight:800;color:var(--tx);margin-bottom:2px">' + greeting + ', ' + firstName + '</div>';
h += '<div style="font-size:11px;color:var(--tx3);margin-bottom:12px">' + now.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'}) + '</div>';

// ═══ SMART ALERT STRIP ═══
updateAlertStrip();

// ═══ MOOD FEED MOVED TO BOARD TAB ═══

// ═══ MY QUOTES SNAPSHOT ═══
var myQ=qs.filter(function(q){return q.createdBy===me});
var qDraft=myQ.filter(function(q){return q.status==='draft'}).length;
var qReady=myQ.filter(function(q){return q.status==='ready'}).length;
var qSent=myQ.filter(function(q){return q.status==='sent'}).length;
var qWon=myQ.filter(function(q){return q.status==='won'}).length;
h+='<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>My Quotes</div>';
h+='<div style="display:flex;gap:4px;margin-bottom:10px">';
h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center;cursor:pointer" onclick="goView(\'quotes\')"><div style="font-size:16px;font-weight:800;color:var(--neon-purple)">'+qDraft+'</div><div style="font-size:8px;color:var(--tx3)">Drafts</div></div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center;cursor:pointer" onclick="goView(\'quotes\')"><div style="font-size:16px;font-weight:800;color:var(--neon-blue)">'+qReady+'</div><div style="font-size:8px;color:var(--tx3)">Ready</div></div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center;cursor:pointer" onclick="goView(\'quotes\')"><div style="font-size:16px;font-weight:800;color:var(--neon-cyan)">'+qSent+'</div><div style="font-size:8px;color:var(--tx3)">Sent</div></div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center;cursor:pointer" onclick="goView(\'quotes\')"><div style="font-size:16px;font-weight:800;color:var(--gn)">'+qWon+'</div><div style="font-size:8px;color:var(--tx3)">Won</div></div></div>';

// Pipeline Funnel
var allDrafts = qs.filter(function(q){return q.status==='draft'}).length;
var allApproval = qs.filter(function(q){return q.status==='approval'}).length;
var allReady = qs.filter(function(q){return q.status==='ready'}).length;
var allSent = qs.filter(function(q){return q.status==='sent'}).length;
var allWon = qs.filter(function(q){return q.status==='won'}).length;
var funnelMax = Math.max(allDrafts, allApproval, allReady, allSent, allWon, 1);
h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin:10px 0 6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Pipeline</div>';
var stages = [['Draft',allDrafts,'#8b5cf6'],['Approval',allApproval,'#f59e0b'],['Ready',allReady,'#06b6d4'],['Sent',allSent,'#00e5ff'],['Won',allWon,'#16a34a']];
h += '<div style="margin-bottom:12px">';
stages.forEach(function(s) {
  var pct = Math.round(s[1] / funnelMax * 100);
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">';
  h += '<div style="width:55px;font-size:11px;color:var(--tx3);text-align:right">' + s[0] + '</div>';
  h += '<div style="flex:1;height:16px;background:var(--bg3);border-radius:4px;overflow:hidden">';
  h += '<div style="width:' + pct + '%;height:100%;background:' + s[2] + ';border-radius:4px;transition:width .5s;min-width:' + (s[1]>0?'2px':'0') + '"></div>';
  h += '</div>';
  h += '<div style="width:28px;font-size:11px;font-weight:700;color:var(--tx)">' + s[1] + '</div>';
  h += '</div>';
});
h += '</div>';

// Revenue KPI
var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
var wonThisMonth = qs.filter(function(q) {
  var ca = q.closedAt || q.wonDate || q.updatedAt || '';
  if (typeof ca !== 'string') ca = ca.toDate ? ca.toDate().toISOString() : String(ca);
  return q.status === 'won' && ca.startsWith(thisMonth);
});
var revenue = wonThisMonth.reduce(function(s, q) { return s + (parseFloat(q.wonAmount) || 0); }, 0);
h += '<div style="display:flex;gap:6px;margin-bottom:12px">';
h += '<div style="flex:1;background:linear-gradient(135deg,#052e16,#0a3622);border:1px solid #16a34a40;border-radius:10px;padding:10px;text-align:center">';
h += '<div style="font-size:18px;font-weight:800;color:#4ade80">$' + revenue.toLocaleString() + '</div>';
h += '<div style="font-size:11px;color:#86efac">Won This Month</div></div>';
h += '<div style="flex:1;background:linear-gradient(135deg,#1e1b4b,#2e1065);border:1px solid #7c3aed40;border-radius:10px;padding:10px;text-align:center">';
h += '<div style="font-size:18px;font-weight:800;color:#a78bfa">' + wonThisMonth.length + '</div>';
h += '<div style="font-size:11px;color:#c4b5fd">Deals Closed</div></div>';
h += '</div>';

// ═══ TODAY'S TO-DO ═══
h+='<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Today\'s To-Do<button class="btn btn-ghost btn-xs" onclick="openMeetings()">View All →</button></div>';
h+='<div id="dashTodoList" style="margin-bottom:10px"><div class="skeleton skeleton-card" style="height:40px"></div></div>';

// ═══ ALERTS ═══
h+='<div id="dashAlerts" style="margin-bottom:10px"></div>';

// Activity Feed
h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Recent Activity</div>';
h += '<div id="dashActivityFeed" style="margin-bottom:12px"><div class="skeleton skeleton-card" style="height:60px"></div></div>';

// ═══ ACTION BUTTONS ═══
h+='<div style="display:flex;gap:6px;margin-bottom:10px"><button class="btn btn-pr btn-sm" style="flex:1" onclick="newQuote()">+ New Quote</button><button class="btn btn-ghost btn-sm" style="flex:1" onclick="openFlexZone()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> My Hub</button></div>';

// ═══ DEPARTMENT LAUNCHER ═══
h+='<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Departments</div>';
var ico=function(d){return'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+d+'</svg>'};
var si=function(d){return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+d+'</svg>'};
var depts=[
{name:'FlexAi',color:'#00e5ff',glow:'rgba(0,229,255,.25)',icon:ico('<path d="M18 20V10M12 20V4M6 20v-6"/>'),items:[
  {icon:si('<path d="M18 20V10M12 20V4M6 20v-6"/>'),name:'Daily Dash',fn:"goView('ceodash')"},
  {icon:si('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),name:'Approvals',fn:'openCEOPortal()'},
  {icon:si('<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'),name:'On Production',fn:"goView('production')"},
  {icon:si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),name:'Employee Snapshot',fn:"goView('hr')"}
]},
{name:'Sales',color:'#daa520',glow:'rgba(218,165,32,.25)',icon:ico('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),items:[
  {icon:si('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),name:'Sales Home',fn:"goView('sales')"},
  {icon:si('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),name:'Quotes & Estimating',fn:"goView('quotes')"},
  {icon:si('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),name:'Quote / Deal Request',fn:'openRFQInbox()'},
  {icon:si('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),name:'Deals in Progress',fn:"goView('sales');setTimeout(function(){if(typeof setSalesTab==='function')setSalesTab('pipeline')},100)"},
  {icon:si('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.3 4 6 4.7 6 5.5V17a3 3 0 0 0 6 0 3 3 0 0 0 6 0V5.5C18 4.7 18.7 4 19.5 4a2.5 2.5 0 0 1 0 5H18"/>'),name:'Deals Won',fn:"goView('sales');setTimeout(function(){if(typeof setSalesTab==='function')setSalesTab('won')},100)"},
  {icon:si('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),name:'POs / Sales Orders',fn:"goView('orders')"},
  {icon:si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),name:'Rep Race',fn:"goView('sales');setTimeout(function(){if(typeof setSalesTab==='function')setSalesTab('race')},100)"}
]},
{name:'Client Services',color:'#a855f7',glow:'rgba(168,85,247,.25)',icon:ico('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),items:[
  {icon:si('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),name:'CS Home',fn:"goView('clientservices')"},
  {icon:si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'),name:'Clients / CRM',fn:"goView('customers')"},
  {icon:si('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),name:'Specs & Materials',fn:"goView('templates')"}
]},
{name:'Pre-Press',color:'#c4ff2a',glow:'rgba(196,255,42,.25)',icon:ico('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),items:[
  {icon:si('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),name:'PPD Workspace',fn:"goView('ppd')"},
  {icon:si('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),name:'Document Control',fn:"goView('doccontrol')"}
]},
{name:'Logistics',color:'#f97316',glow:'rgba(249,115,22,.25)',icon:ico('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),items:[
  {icon:si('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>'),name:'Inventory',fn:"goView('logistics')"},
  {icon:si('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),name:'Purchasing',fn:"goView('vendorpos')"},
  {icon:si('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),name:'Receiving',fn:"goView('logistics')"},
  {icon:si('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),name:'Vendor POs',fn:"goView('vendorpos')"},
  {icon:si('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),name:'Vendor Hub',fn:"goView('vendors')"},
  {icon:si('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),name:'Shipping',fn:"goView('logistics')"}
]},
{name:'Production',color:'#4169e1',glow:'rgba(65,105,225,.25)',icon:ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09"/>'),items:[
  {icon:si('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82"/>'),name:'Production Floor',fn:"goView('production')"},
  {icon:si('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),name:'Job Tracker',fn:"goView('jobtracker')"},
  {icon:si('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),name:'Operator Station',fn:"goView('operator')"}
]},
{name:'Finance',color:'#50C878',glow:'rgba(80,200,120,.25)',icon:ico('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),items:[
  {icon:si('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),name:'Finance Portal',fn:"window.open('https://mfx-2026-finance.web.app','_blank')"},
  {icon:si('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),name:'Analytics',fn:'openAnalytics()'}
]},
{name:'Quality',color:'#ec4899',glow:'rgba(236,72,153,.25)',icon:ico('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),items:[
  {icon:si('<path d="M18 20V10M12 20V4M6 20v-6"/>'),name:'SQF Data Logs',fn:"goView('sqfdatalogs')"},
  {icon:si('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),name:'GMP & Environmental',fn:"goView('gmp')"},
  {icon:si('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),name:'SQF Audits',fn:"goView('audit')"},
  {icon:si('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),name:'CAPA / NCR',fn:"goView('capa')"},
  {icon:si('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),name:'HACCP Plan',fn:"window.open('/haccp.html','_blank')"},
  {icon:si('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'),name:'Mock Recall',fn:"window.open('/mockrecall.html','_blank')"}
]},
{name:'Operations',color:'#ef4444',glow:'rgba(239,68,68,.25)',icon:ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82"/>'),items:[
  {icon:si('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),name:'HR / People',fn:"goView('hr')"},
  {icon:si('<path d="M18 20V10M12 20V4M6 20v-6"/>'),name:'SQF Compliance',fn:"goView('sqfdatalogs')"},
  {icon:si('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),name:'IT Systems',fn:"goView('datasync')"},
  {icon:si('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),name:'Facilities',fn:"goView('gmp')"},
  {icon:si('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),name:'Systems / Workflows',fn:"goView('datasync')"},
  {icon:si('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>'),name:'Master Automation',fn:"goView('masterauto')"},
  {icon:si('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>'),name:'Controlled Records',fn:"goView('records')"},
  {icon:si('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),name:'Legal / Compliance',fn:"goView('doccontrol')"},
  {icon:si('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),name:'Training',fn:"goView('training')"}
]}
];
h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px" id="deptLauncher">';
depts.forEach(function(d,di){
h+='<div class="dept-card" id="dept-'+di+'" style="background:var(--bg3);border:1px solid '+d.color+'33;border-radius:12px;overflow:hidden;transition:all .2s">';
h+='<div onclick="toggleDept('+di+')" style="padding:10px 8px;cursor:pointer;display:flex;align-items:center;gap:8px;border-left:3px solid '+d.color+'">';
h+='<span style="font-size:18px">'+d.icon+'</span>';
h+='<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:800;color:'+d.color+';text-shadow:0 0 12px '+d.glow+'">'+d.name+'</div></div>';
h+='<span id="deptArr-'+di+'" style="font-size:9px;color:var(--tx3);transition:transform .2s">▸</span>';
h+='</div>';
h+='<div id="deptSub-'+di+'" style="display:none;padding:0 6px 8px 6px">';
d.items.forEach(function(it){
h+='<div onclick="'+it.fn+'" style="padding:6px 8px;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:6px;margin-top:2px;transition:background .15s" onmouseover="this.style.background=\''+d.color+'15\'" onmouseout="this.style.background=\'\'">';
h+='<span style="font-size:14px">'+it.icon+'</span><span style="font-size:10px;color:var(--tx2);font-weight:600">'+it.name+'</span></div>'});
h+='</div></div>'});
h+='</div>';
// Communication row matching hamburger
h+='<div style="display:flex;gap:6px;margin-bottom:8px">';
h+='<div onclick="openRFQInbox()" style="flex:1;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:8px;text-align:center;cursor:pointer;font-size:10px;color:var(--tx2);font-weight:600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2" style="display:block;margin:0 auto 3px"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>Tasks & Requests</div>';
h+='<div onclick="goView(\'notifications\')" style="flex:1;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:8px;text-align:center;cursor:pointer;font-size:10px;color:var(--tx2);font-weight:600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2" style="display:block;margin:0 auto 3px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Inbox & Chat</div>';
h+='<div onclick="openMeetings()" style="flex:1;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:8px;text-align:center;cursor:pointer;font-size:10px;color:var(--tx2);font-weight:600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2" style="display:block;margin:0 auto 3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Calendar</div>';
h+='</div>';

el.innerHTML=h;

// Load activity feed
if (typeof fbDb !== 'undefined' && fbDb) {
  fbDb.collection('activity').orderBy('timestamp', 'desc').limit(8)
    .get().then(function(snap) {
      var feed = document.getElementById('dashActivityFeed');
      if (!feed) return;
      if (snap.empty) { feed.innerHTML = '<div style="font-size:11px;color:var(--tx3);padding:6px">No recent activity</div>'; return; }
      feed.innerHTML = snap.docs.map(function(d) {
        var a = d.data();
        return '<div style="padding:5px 0;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">' +
          '<div style="flex:1;min-width:0"><span style="font-size:11px;color:var(--ac);font-weight:600">' + esc(a.user || '?') + '</span> ' +
          '<span style="font-size:11px;color:var(--tx2)">' + esc(a.action || a.detail || '') + '</span></div>' +
          '<div style="font-size:11px;color:var(--tx3);white-space:nowrap;margin-left:8px">' + (typeof fD === 'function' ? fD(a.timestamp) : '') + '</div></div>';
      }).join('');
    }).catch(function(e) {console.warn('dashFeedLoad:',e)});
}

// Load today's tasks
loadDashTodo(me,today);
// Load alerts
loadDashAlerts(me,qs);

// Auto-refresh every 60s
if (window._dashRefreshTimer) clearInterval(window._dashRefreshTimer);
window._dashRefreshTimer = setInterval(function() {
  if (S.view === 'dashboard') renderDash();
}, 60000);
}

window.toggleDept=function(i){
var sub=document.getElementById('deptSub-'+i);
var arr=document.getElementById('deptArr-'+i);
if(!sub)return;
var open=sub.style.display!=='none';
// Close all others
for(var j=0;j<10;j++){var s=document.getElementById('deptSub-'+j);var a=document.getElementById('deptArr-'+j);if(s&&j!==i){s.style.display='none';if(a)a.style.transform=''}}
sub.style.display=open?'none':'block';
if(arr)arr.style.transform=open?'':'rotate(90deg)';
};

// ═══ CALENDAR DROPDOWN ═══
function initCalendarDropdown(){
if(document.getElementById('mfx-cal-dropdown'))return;
var dd=document.createElement('div');
dd.id='mfx-cal-dropdown';
dd.className='mfx-cal-dropdown hidden';
document.body.appendChild(dd);
document.addEventListener('click',function(e){
if(window._calDropdownOpen){
var el=document.getElementById('mfx-cal-dropdown');
var dt=document.getElementById('topDateTime');
if(el&&!el.contains(e.target)&&dt&&!dt.contains(e.target)){el.classList.add('hidden');window._calDropdownOpen=false}}
})}

function toggleCalendarDropdown(e){
if(e)e.stopPropagation();
var dd=document.getElementById('mfx-cal-dropdown');
if(!dd)return;
if(window._calDropdownOpen){dd.classList.add('hidden');window._calDropdownOpen=false;return}
// Close notification dropdown if open
if(window.MFXNotifications&&window.MFXNotifications.STATE&&window.MFXNotifications.STATE.panelOpen){
var np=document.getElementById('mfx-notif-panel');if(np)np.classList.add('hidden');window.MFXNotifications.STATE.panelOpen=false}
// Position below topDateTime
var anchor=document.getElementById('topDateTime');
if(anchor){var r=anchor.getBoundingClientRect();dd.style.top=(r.bottom+4)+'px';dd.style.right=Math.max(8,window.innerWidth-r.right)+'px'}
dd.innerHTML='<div style="color:var(--tx3);padding:16px;text-align:center;font-size:11px">Loading...</div>';
dd.classList.remove('hidden');
window._calDropdownOpen=true;
// Stop dot pulse — user is viewing notifications
var dot=document.getElementById('mfx-notif-dot');
if(dot)dot.style.animation='none';
window._calDDMonth=new Date().getMonth();
window._calDDYear=new Date().getFullYear();
window._calDDItems=null;
if(typeof loadAllTasks==='function'){loadAllTasks(function(items){window._calDDItems=items;renderCalDropdownGrid()})}
else{dd.innerHTML='<div style="color:var(--tx3);padding:16px;text-align:center;font-size:11px">No tasks available</div>'}}

function calDDNav(dir){window._calDDMonth+=dir;if(window._calDDMonth>11){window._calDDMonth=0;window._calDDYear++}else if(window._calDDMonth<0){window._calDDMonth=11;window._calDDYear--}renderCalDropdownGrid()}

function renderCalDropdownGrid(){
var dd=document.getElementById('mfx-cal-dropdown');if(!dd)return;
var items=window._calDDItems||[];
var me=typeof getUserName==='function'?getUserName():'';
var cm=window._calDDMonth;var cy=window._calDDYear;
var today=new Date();var todayStr=today.getFullYear()+'-'+(today.getMonth()+1<10?'0':'')+(today.getMonth()+1)+'-'+(today.getDate()<10?'0':'')+today.getDate();
var monthName=new Date(cy,cm,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
var fd=new Date(cy,cm,1).getDay();var dim=new Date(cy,cm+1,0).getDate();
// Previous month fill
var prevDim=new Date(cy,cm,0).getDate();

var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
h+='<div style="font-size:13px;font-weight:700;color:var(--tx)">'+monthName+'</div>';
h+='<div style="display:flex;gap:8px">';
h+='<span style="cursor:pointer;color:var(--tx3);font-size:12px;padding:2px 6px;border-radius:4px" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\'none\'" onclick="event.stopPropagation();calDDNav(-1)">‹</span>';
h+='<span style="cursor:pointer;color:var(--tx3);font-size:12px;padding:2px 6px;border-radius:4px" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\'none\'" onclick="event.stopPropagation();calDDNav(1)">›</span>';
h+='</div></div>';

// Day headers
h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:4px">';
['S','M','T','W','T','F','S'].forEach(function(d){h+='<div style="text-align:center;font-size:10px;color:var(--tx3);padding:2px;font-weight:600">'+d+'</div>'});
h+='</div>';

// Calendar grid
h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">';
// Previous month days
for(var p=fd-1;p>=0;p--){h+='<div style="text-align:center;padding:5px 2px;font-size:11px;color:var(--tx3);opacity:.3">'+(prevDim-p)+'</div>'}
// Current month days
for(var d=1;d<=dim;d++){
var ds=cy+'-'+(cm+1<10?'0':'')+(cm+1)+'-'+(d<10?'0':'')+d;
var isT=ds===todayStr;
var dayItemCount=items.filter(function(t){return t.date===ds&&(t.assignedTo===me||t.createdBy===me)}).length;
var sel=window._calDDSelectedDate===ds;
h+='<div style="text-align:center;padding:4px 2px;cursor:pointer;border-radius:50%;position:relative;';
if(isT) h+='background:#4285f4;color:#fff;font-weight:700;';
else if(sel) h+='background:rgba(66,133,244,.2);color:var(--tx);font-weight:600;';
else h+='color:var(--tx);';
h+='font-size:11px" onmouseover="if(!'+isT+')this.style.background=\'rgba(255,255,255,.08)\'" onmouseout="if(!'+isT+'&&!'+sel+')this.style.background=\'none\'" onclick="event.stopPropagation();showCalDDDay(\''+ds+'\')">';
h+=d;
if(dayItemCount>0&&!isT){h+='<div style="width:4px;height:4px;border-radius:50%;background:var(--ac);margin:1px auto 0"></div>'}
h+='</div>'}
// Next month fill
var totalCells=fd+dim;var rem=totalCells%7;
if(rem>0){for(var n=1;n<=7-rem;n++){h+='<div style="text-align:center;padding:5px 2px;font-size:11px;color:var(--tx3);opacity:.3">'+n+'</div>'}}
h+='</div>';

// Selected day entries
h+='<div id="calDDDayList" style="margin-top:8px;border-top:1px solid var(--bdr);padding-top:6px;max-height:120px;overflow-y:auto"></div>';

// ── FlexFeed & Updates (middle section) ──
h+='<div style="margin-top:8px;border-top:1px solid var(--bdr);padding-top:8px">';
h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
h+='<span style="font-size:11px;font-weight:700;color:var(--ac)">FlexFeed & Updates</span>';
h+='</div>';
h+='<div id="calDDFeedTabs" style="display:flex;gap:3px;margin-bottom:6px;overflow-x:auto;scrollbar-width:none">';
['All','Culture','Production','Staff','Org','Games','Reminders'].forEach(function(t){
var key=t.toLowerCase();
h+='<span class="caldd-ftab" data-feed="'+key+'" style="padding:2px 7px;font-size:8px;font-weight:600;border-radius:10px;cursor:pointer;white-space:nowrap;'+(key==='all'?'background:var(--ac);color:#000':'background:var(--bg3);color:var(--tx3)')+'" onclick="event.stopPropagation();filterCalDDFeed(\''+key+'\')">'+t+'</span>'});
h+='</div>';
h+='<div id="calDDFeedList" style="max-height:130px;overflow-y:auto"></div>';
h+='<div style="display:flex;justify-content:center;gap:4px;margin-top:4px">';
h+='<span onclick="event.stopPropagation();calDDFeedNav(-1)" style="cursor:pointer;font-size:9px;color:var(--tx3);padding:1px 6px;border-radius:4px;background:var(--bg3)">‹</span>';
h+='<span id="calDDFeedPage" style="font-size:8px;color:var(--tx3);padding:2px 0">1 / 1</span>';
h+='<span onclick="event.stopPropagation();calDDFeedNav(1)" style="cursor:pointer;font-size:9px;color:var(--tx3);padding:1px 6px;border-radius:4px;background:var(--bg3)">›</span>';
h+='</div></div>';

// ── Notifications section ──
h+='<div style="margin-top:8px;border-top:1px solid var(--bdr);padding-top:8px">';
h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
h+='<span style="font-size:11px;font-weight:700;color:var(--tx)">Notifications</span>';
h+='<span id="calDDNotifCount" style="font-size:9px;color:var(--tx3)"></span>';
h+='</div>';
h+='<div id="calDDNotifTabs" style="display:flex;gap:4px;margin-bottom:6px;overflow-x:auto;scrollbar-width:none">';
['All','Alerts','Mentions','Tasks','Jobs'].forEach(function(t){
var key=t.toLowerCase();
h+='<span class="caldd-ntab" data-filter="'+key+'" style="padding:2px 8px;font-size:9px;font-weight:600;border-radius:10px;cursor:pointer;white-space:nowrap;'+(key==='all'?'background:var(--ac);color:#000':'background:var(--bg3);color:var(--tx3)')+'" onclick="event.stopPropagation();filterCalDDNotifs(\''+key+'\')">'+t+'</span>'});
h+='</div>';
h+='<div id="calDDNotifList" style="max-height:140px;overflow-y:auto"></div>';
h+='</div>';

// Footer
h+='<div style="text-align:center;padding:6px 0 2px"><span style="font-size:10px;color:var(--ac);cursor:pointer;font-weight:600" onclick="document.getElementById(\'mfx-cal-dropdown\').classList.add(\'hidden\');window._calDropdownOpen=false;openMeetings()">Open Full Calendar →</span></div>';
dd.innerHTML=h;
// Auto-show today's entries
showCalDDDay(todayStr);
// Render FlexFeed
window._calDDFeedFilter='all';window._calDDFeedPage=0;
loadHamFeed();renderCalDDFeedSlides();
// Render notifications
renderCalDDNotifs('all')}

function showCalDDDay(ds){
window._calDDSelectedDate=ds;
var el=document.getElementById('calDDDayList');
if(!el)return renderCalDropdownGrid();
var items=window._calDDItems||[];
var me=typeof getUserName==='function'?getUserName():'';
var dayItems=items.filter(function(t){return t.date===ds&&(t.assignedTo===me||t.createdBy===me)}).sort(function(a,b){return(a.time||'zz').localeCompare(b.time||'zz')});
var d=new Date(ds+'T12:00:00');
var label=d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
var h='<div style="font-size:10px;font-weight:700;color:var(--tx2);margin-bottom:4px">'+label+'</div>';
if(dayItems.length){dayItems.forEach(function(t){
h+='<div style="display:flex;gap:6px;align-items:center;padding:4px 6px;border-radius:6px;cursor:pointer;transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.08)\'" onmouseout="this.style.background=\'none\'" onclick="document.getElementById(\'mfx-cal-dropdown\').classList.add(\'hidden\');window._calDropdownOpen=false;openTaskDetail(\''+t.id+'\')">';
h+='<span style="font-size:9px;color:var(--ac);min-width:38px;font-weight:600">'+(t.time||'All day')+'</span>';
h+='<span style="font-size:10px;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(t.completed?'<s style="color:var(--tx3)">'+esc(t.title)+'</s>':esc(t.title))+'</span></div>'})}
else{h+='<div style="font-size:10px;color:var(--tx3);padding:4px 6px">No entries</div>'}
el.innerHTML=h}

// ── CalDD FlexFeed functions ──
function filterCalDDFeed(f){
window._calDDFeedFilter=f;window._calDDFeedPage=0;
document.querySelectorAll('.caldd-ftab').forEach(function(t){
if(t.dataset.feed===f){t.style.background='var(--ac)';t.style.color='#000'}
else{t.style.background='var(--bg3)';t.style.color='var(--tx3)'}});
renderCalDDFeedSlides()}

function calDDFeedNav(dir){
var filtered=getCalDDFilteredFeed();var pages=Math.ceil(filtered.length/3)||1;
window._calDDFeedPage=Math.max(0,Math.min(pages-1,(window._calDDFeedPage||0)+dir));
renderCalDDFeedSlides()}

function getCalDDFilteredFeed(){
var f=window._calDDFeedFilter||'all';var items=window._hamFeedData||[];
if(f==='all')return items;
return items.filter(function(i){return i.cat===f})}

function renderCalDDFeedSlides(){
var el=document.getElementById('calDDFeedList');
var pageEl=document.getElementById('calDDFeedPage');
if(!el)return;
var filtered=getCalDDFilteredFeed();
var perPage=3;var pages=Math.ceil(filtered.length/perPage)||1;
var page=window._calDDFeedPage||0;
var start=page*perPage;var slice=filtered.slice(start,start+perPage);
if(pageEl)pageEl.textContent=(page+1)+' / '+pages;
if(!slice.length){el.innerHTML='<div style="padding:8px;text-align:center;font-size:9px;color:var(--tx3)">No updates</div>';return}
var h='';
slice.forEach(function(it){
h+='<div style="padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:6px;align-items:flex-start">';
h+='<span style="font-size:12px;flex-shrink:0;margin-top:1px">'+it.ico+'</span>';
h+='<div style="flex:1;min-width:0"><div style="font-size:9px;color:var(--tx);line-height:1.3">'+esc(it.title)+'</div>';
h+='<div style="font-size:8px;color:var(--tx3);margin-top:1px">'+esc(it.sub)+'</div>';
h+='</div></div>'});
el.innerHTML=h}

function filterCalDDNotifs(filter){
window._calDDNotifFilter=filter;
document.querySelectorAll('.caldd-ntab').forEach(function(t){
if(t.dataset.filter===filter){t.style.background='var(--ac)';t.style.color='#000'}
else{t.style.background='var(--bg3)';t.style.color='var(--tx3)'}});
renderCalDDNotifs(filter)}

function renderCalDDNotifs(filter){
var el=document.getElementById('calDDNotifList');
var countEl=document.getElementById('calDDNotifCount');
if(!el)return;
var notifs=[];
if(window.MFXNotifications&&window.MFXNotifications.STATE){notifs=window.MFXNotifications.STATE.notifications.slice()}
// Also add system alerts
if(window._currentAlerts){window._currentAlerts.forEach(function(a,i){
notifs.push({id:'alert_'+i,title:a.text,type:'alerts',time:new Date().toISOString(),sourceView:'dashboard'})})}
// Filter
if(filter&&filter!=='all'){notifs=notifs.filter(function(n){return n.type===filter})}
// Sort newest first
notifs.sort(function(a,b){return(b.time||'').localeCompare(a.time||'')});
if(countEl)countEl.textContent=notifs.length?notifs.length+' total':'';
if(!notifs.length){el.innerHTML='<div style="font-size:10px;color:var(--tx3);padding:8px;text-align:center">No notifications</div>';return}
var h='';
notifs.slice(0,15).forEach(function(n){
var icons={alerts:'⚠',mentions:'@',tasks:'✓',reminders:'⏰',jobs:'🎫'};
var icon=icons[n.type]||'•';
h+='<div style="display:flex;gap:6px;align-items:flex-start;padding:5px 6px;border-radius:6px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.03);transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'" onclick="event.stopPropagation();calDDNotifClick(\''+n.id+'\',\''+n.sourceView+'\',\''+(n.sourceId||'')+'\')">';
h+='<span style="font-size:11px;min-width:16px;text-align:center;margin-top:1px">'+icon+'</span>';
h+='<div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(n.title)+'</div>';
if(n.body){h+='<div style="font-size:9px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(n.body)+'</div>'}
h+='</div></div>'});
el.innerHTML=h}

function calDDNotifClick(id,view,sourceId){
document.getElementById('mfx-cal-dropdown').classList.add('hidden');
window._calDropdownOpen=false;
// Mark as seen — stop dot pulse
var dot=document.getElementById('mfx-notif-dot');
if(dot)dot.style.animation='none';
if(window.MFXNotifications&&window.MFXNotifications.dismissNotification)window.MFXNotifications.dismissNotification(id);
if(view==='editor'&&sourceId&&typeof openEditor==='function'){openEditor(sourceId)}
else if(view&&typeof goView==='function'){goView(view)}}

function updateTopBar(){
var me=getUserName();var p=getMFXProfile();
var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var now=new Date();
var dayEl=$('topDayOfWeek');if(dayEl)dayEl.textContent=days[now.getDay()].substring(0,3)+' '+now.toLocaleDateString('en-US',{month:'short',day:'numeric'});
var timeEl=$('topTime');if(timeEl)timeEl.textContent=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
// topUserName, topUserRole, topDeptBadge now set by applyDeptTheme based on current view
}

function selectMood(emoji){
window._selectedMood=emoji;
document.querySelectorAll('[id^="mood_"]').forEach(function(el){el.style.transform=''});
var el=$('mood_'+emoji);if(el)el.style.transform='scale(1.4)'}

function postMood(){
var msg=($('moodInput')||{}).value;var mood=window._selectedMood||'';
if(!msg&&!mood)return toast('Choose an emoji or write something','err');
if(!msg)msg=mood;
fbDb.collection('microfeed').add({
text:msg,mood:mood,user:getUserName(),
timestamp:firebase.firestore.FieldValue.serverTimestamp(),
likes:0,comments:[],edited:false
}).then(function(){
$('moodInput').value='';window._selectedMood='';
document.querySelectorAll('[id^="mood_"]').forEach(function(el){el.style.transform=''});
toast('Posted!','ok');loadMoodFeed()}).catch(function(e){toast(e.message,'err')})}

function loadMoodFeed(showAll){
var el=$('moodFeed');if(!el||!fbDb)return;
var cutoff=new Date(Date.now()-7*24*60*60*1000);
fbDb.collection('microfeed').orderBy('timestamp','desc').limit(30).get().then(function(snap){
var posts=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())}).filter(function(p){
if(!p.timestamp)return true;
return new Date(p.timestamp.seconds*1000)>cutoff});
var h='';var limit=showAll?posts.length:3;
posts.slice(0,limit).forEach(function(p){
var ts=p.timestamp?new Date(p.timestamp.seconds*1000):new Date();
var ago=getTimeAgo(ts);
h+='<div class="mood-card fade-in">';
h+='<div style="display:flex;justify-content:space-between;align-items:center">';
h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:16px">'+(p.mood||'💭')+'</span><strong style="color:var(--ac);font-size:11px">'+esc(p.user)+'</strong></div>';
h+='<span style="font-size:8px;color:var(--tx3)">'+ago+'</span></div>';
h+='<div style="font-size:12px;color:var(--tx);margin:4px 0;line-height:1.4">'+esc(p.text).replace(/@(\w+)/g,'<span style="color:var(--ac)">@$1</span>')+'</div>';
if(p.comments&&p.comments.length){p.comments.forEach(function(c){
h+='<div style="margin:2px 0 2px 20px;padding:2px 8px;background:var(--bg3);border-left:2px solid var(--ac);border-radius:0 4px 4px 0;font-size:9px"><strong style="color:var(--ac)">'+esc(c.by)+'</strong> '+esc(c.text)+'</div>'})}
h+='<div style="display:flex;gap:10px;font-size:9px;margin-top:4px">';
h+='<span style="cursor:pointer" onclick="likeMoodPost(\''+p.id+'\')">👍 '+(p.likes||0)+'</span>';
h+='<span style="cursor:pointer" onclick="commentMoodPost(\''+p.id+'\')">💬 '+(p.comments?p.comments.length:0)+'</span>';
if(p.user===getUserName())h+='<span style="cursor:pointer" onclick="editMoodPost(\''+p.id+'\')">✏ Edit</span>';
h+='</div></div>'});
if(!showAll&&posts.length>3)h+='<div style="text-align:center;padding:8px"><button class="btn btn-ghost btn-sm" onclick="loadMoodFeed(true)" style="font-size:10px">See More ('+posts.length+' total)</button></div>';
if(showAll&&posts.length>3)h+='<div style="text-align:center;padding:8px"><button class="btn btn-ghost btn-sm" onclick="loadMoodFeed(false)" style="font-size:10px">Show Less</button></div>';
if(!posts.length)h='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">No posts yet - drop a vibe!</div>';
el.innerHTML=h}).catch(function(e){el.innerHTML=esc(e.message)})}

// getTimeAgo — defined earlier in this file (line ~238)

function likeMoodPost(id){fbDb.collection('microfeed').doc(id).update({likes:firebase.firestore.FieldValue.increment(1)}).then(function(){loadMoodFeed()})}

function commentMoodPost(id){var text=prompt('Comment:');if(!text)return;
fbDb.collection('microfeed').doc(id).get().then(function(doc){var d=doc.data();var c=d.comments||[];
c.push({by:getUserName(),text:text.trim(),at:fD(new Date().toISOString())});
fbDb.collection('microfeed').doc(id).update({comments:c}).then(function(){loadMoodFeed()})}).catch(function(e){ console.warn('APP get:', e.message); })}

function editMoodPost(id){fbDb.collection('microfeed').doc(id).get().then(function(doc){var d=doc.data();
if(d.user!==getUserName())return toast('Not yours','err');
var newText=prompt('Edit:',d.text);if(!newText)return;
fbDb.collection('microfeed').doc(id).update({text:newText,edited:true}).then(function(){loadMoodFeed();toast('Updated','ok')})}).catch(function(e){ console.warn('APP get:', e.message); })}

function loadDashTodo(me,today){
var el=$('dashTodoList');if(!el||!fbDb)return;
fbDb.collection('tasks').where('assignedTo','==',me).where('completed','==',false).limit(10).get().then(function(snap){
var tasks=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())}).filter(function(t){return!t.completed});
var todayTasks=tasks.filter(function(t){return t.date===today});
var overdue=tasks.filter(function(t){return t.date&&t.date<today});
var h='';
if(overdue.length){overdue.forEach(function(t){
h+='<div class="card blink-danger" style="padding:6px 10px;cursor:pointer" onclick="openTaskDetail(\''+t.id+'\')"><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:var(--rd)">'+(t.type==='task'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>')+' '+esc(t.title)+'</span><span style="font-size:8px;color:var(--rd)">OVERDUE</span></div></div>'})}
if(todayTasks.length){todayTasks.forEach(function(t){
h+='<div class="card" style="padding:6px 10px;border-left:3px solid var(--ac);cursor:pointer" onclick="openTaskDetail(\''+t.id+'\')"><span style="font-size:11px">'+(t.type==='task'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>')+' '+esc(t.title)+'</span></div>'})}
if(!overdue.length&&!todayTasks.length)h='<div style="color:var(--tx3);font-size:10px;padding:6px">All clear - nothing due today 🎉</div>';
el.innerHTML=h}).catch(function(e){console.warn('dashTodoLoad:',e);el.innerHTML=''})}

function loadDashAlerts(me,qs){
var el=$('dashAlerts');if(!el)return;
var h='';
var stale=qs.filter(function(q){return q.status==='draft'&&q.createdBy===me&&q.updatedAt&&(new Date()-new Date(q.updatedAt))>3*86400000});
if(stale.length){h+='<div class="card blink-warn" style="padding:8px;border-left:3px solid var(--or)"><div style="font-size:10px;color:var(--or);font-weight:600">⚠ '+stale.length+' stale draft'+(stale.length>1?'s':'')+' - update or submit</div></div>'}
var unanswered=qs.filter(function(q){return q.status==='sent'&&q.createdBy===me&&q.sentAt&&(new Date()-new Date(q.sentAt))>7*86400000});
if(unanswered.length){h+='<div class="card" style="padding:8px;border-left:3px solid var(--neon-blue)"><div style="font-size:10px;color:var(--neon-blue);font-weight:600">📨 '+unanswered.length+' quote'+(unanswered.length>1?'s':'')+' sent 7+ days ago - follow up</div></div>'}
el.innerHTML=h}


function renderQuotes(){
var qs=DB.quotes();var an=getQuoteAnalytics(qs);
var drafts=qs.filter(function(q){return q.status==='draft'});
var sent=qs.filter(function(q){return q.status==='sent'});
var pending=qs.filter(function(q){return q.status==='ready'});
var approval=qs.filter(function(q){return q.status==='approval'});
var won=qs.filter(function(q){return q.status==='won'});
var lost=qs.filter(function(q){return q.status==='lost'});

function miniList(arr,max,emptyMsg,showApproveBtn){
  if(!arr.length)return '<div style="color:var(--tx3);font-size:11px;padding:8px 0;text-align:center">'+emptyMsg+'</div>';
  var h='';arr.slice(0,max||5).forEach(function(q){
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid var(--bdr);font-size:11px;transition:background .15s" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'transparent\'">';
    h+='<div onclick="openEditor(\''+q.id+'\')" style="flex:1;min-width:0;cursor:pointer"><strong style="color:var(--ac)">'+esc(q.quoteNum)+'</strong> <span style="color:var(--tx2)">'+esc(q.fields.custCo||'-')+'</span>';
    if(q.createdBy)h+='<div style="color:var(--tx3);font-size:9px">'+esc(q.createdBy)+' · '+fD(q.updatedAt)+'</div>';
    h+='</div>';
    if(showApproveBtn)h+='<div style="display:flex;gap:4px;flex-shrink:0"><button onclick="event.stopPropagation();quickApprove(\''+q.id+'\')" style="background:#16a34a;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">✓ Approve</button><button onclick="event.stopPropagation();setQStatus(\''+q.id+'\',\'rejected\')" style="background:transparent;color:var(--rd);border:1px solid var(--rd);padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">✕</button></div>';
    h+='</div>';
  });
  if(arr.length>max)h+='<div style="text-align:center;padding:4px;font-size:10px;color:var(--ac);cursor:pointer" onclick="S.qFilter=\''+arr[0].status+'\';renderQuotes()">View all '+arr.length+'</div>';
  return h;
}

var qtop='<div style="display:flex;gap:8px;margin-bottom:12px"><button onclick="newQuote()" style="flex:1;background:var(--ac);color:#fff;padding:12px;font-size:13px;font-weight:700;border:none;border-radius:8px;cursor:pointer">+ New Quote</button><button onclick="openRFQRequest()" style="flex:1;background:var(--bg3);color:var(--ac);padding:12px;font-size:13px;font-weight:700;border:1px solid var(--ac);border-radius:8px;cursor:pointer">Request</button></div>';

// Stats row
qtop+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:12px">';
qtop+='<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700">'+qs.length+'</div><div style="font-size:9px;color:var(--tx3)">Total</div></div>';
qtop+='<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gn)">'+an.winRate+'%</div><div style="font-size:9px;color:var(--tx3)">Win Rate</div></div>';
qtop+='<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700">'+an.weekTotal+'</div><div style="font-size:9px;color:var(--tx3)">This Week</div></div>';
qtop+='<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gn)">'+won.length+'</div><div style="font-size:9px;color:var(--tx3)">Won</div></div></div>';

// Pending Approval box (full width, prominent if any)
if(approval.length){
qtop+='<div style="background:var(--srf);border:2px solid #c4b5fd;border-radius:10px;overflow:hidden;margin-bottom:12px">';
qtop+='<div onclick="S.qFilter=\'approval\';renderQuotes()" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid #c4b5fd;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#2d1f5e,#1a1040)"><span style="font-weight:700;font-size:13px;color:#c4b5fd">🔒 Pending Approval</span><span style="background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px">'+approval.length+'</span></div>';
qtop+=miniList(approval,5,'No quotes pending',true);
qtop+='</div>';
}

// Dashboard boxes
qtop+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
// Drafts box
qtop+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:10px;overflow:hidden">';
qtop+='<div onclick="S.qFilter=\'draft\';renderQuotes()" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;background:var(--bg3)"><span style="font-weight:700;font-size:12px;color:var(--tx)">Drafts</span><span style="background:var(--or);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+drafts.length+'</span></div>';
qtop+=miniList(drafts,4,'No drafts');
qtop+='</div>';
// Sent box
qtop+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:10px;overflow:hidden">';
qtop+='<div onclick="S.qFilter=\'sent\';renderQuotes()" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;background:var(--bg3)"><span style="font-weight:700;font-size:12px;color:var(--tx)">Sent</span><span style="background:#3b82f6;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+sent.length+'</span></div>';
qtop+=miniList(sent,4,'No sent quotes');
qtop+='</div></div>';

// Ready to Send box (full width)
qtop+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:10px;overflow:hidden;margin-bottom:12px">';
qtop+='<div onclick="S.qFilter=\'ready\';renderQuotes()" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;background:var(--bg3)"><span style="font-weight:700;font-size:12px;color:var(--tx)">Ready to Send</span><span style="background:var(--gn);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+pending.length+'</span></div>';
qtop+=miniList(pending,3,'No quotes ready');
qtop+='</div>';

window._quoteTopHTML=qtop;
_origRenderQuotes();}
function _origRenderQuotes(){const qs=DB.quotes();const filt=S.qFilter==='all'?qs:qs.filter(q=>q.status===S.qFilter);
var searchVal=(S.qSearch||'').toLowerCase();
const sr=searchVal?filt.filter(function(q){var haystack=(q.quoteNum+' '+q.fields.custCo+' '+q.fields.jobDesc+' '+(q.description||'')+' '+(q.createdBy||'')+' '+(q.fields.estimator||'')).toLowerCase();return haystack.includes(searchVal)}):filt;
var newHash=sr.map(function(q){return q.id+q.status+q.updatedAt;}).join('|');if(window._lastQuoteHash===newHash&&$('v-quotes').innerHTML.length>0)return;window._lastQuoteHash=newHash;
const ct=st=>qs.filter(q=>q.status===st).length;
$('v-quotes').innerHTML=(window._quoteTopHTML||'')+`<div class="search-bar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input placeholder="Search by name, company, creator..." value="${S.qSearch}" oninput="S.qSearch=this.value;renderQuotes()"></div>
<div class="filters">${['all','draft','approval','ready','sent','won','lost','archived'].map(f=>`<div class="fbtn ${S.qFilter===f?'active':''}" onclick="S.qFilter='${f}';renderQuotes()">${f==='ready'?'Ready':f==='approval'?'Pending':f[0].toUpperCase()+f.slice(1)} (${f==='all'?qs.length:ct(f)})</div>`).join('')}</div>
${sr.length?sr.map(q=>`<div class="qcard" onclick="openEditor('${q.id}')"><div class="qcard-top"><div><span class="qcard-num">${esc(q.quoteNum)}</span><span class="qcard-rev">Rev ${esc(q.rev)}</span></div><span class="pill pill-${esc(q.status)}">${esc(q.status)}</span></div><div class="qcard-co">${esc(q.fields.custCo)||'-'}${q.description?' <span style="color:var(--or);font-weight:400;font-size:11px">— '+esc(q.description)+'</span>':''}</div><div class="qcard-desc">${esc(q.fields.jobDesc)||'-'}</div><div style="font-size:10px;color:var(--tx3);margin:2px 0;display:flex;gap:6px;flex-wrap:wrap">${q.fields.shapeType?'<span>'+esc(q.fields.shapeType)+'</span>':''}${q.fields.sA?'<span>'+esc(q.fields.sA)+'×'+esc(q.fields.sar)+'"</span>':''}${q.fields.colors?'<span>'+esc(q.fields.colors)+'c</span>':''}${q.qtys?'<span>'+q.qtys.length+' qty</span>':''}</div><div class="qcard-bot"><span class="qcard-date">${fD(q.updatedAt)}${q.createdBy?' · '+esc(q.createdBy):''}</span><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();showQA('${q.id}')">⋯</button></div></div>`).join(''):'<div class="empty-state"><div class="ico">📁</div><p>No quotes</p><button class="btn btn-pr" onclick="newQuote()">+ New</button></div>'}`}

function showQA(qid){const q=getQ(qid);if(!q)return;
openModal(`<div class="modal-title">${esc(q.quoteNum)} Rev ${esc(q.rev)}</div>
<button class="btn btn-pr" onclick="closeModal();openEditor('${qid}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
<button class="btn btn-ghost" onclick="closeModal();dupQuote('${qid}',true)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> New Revision</button>
<button class="btn btn-ghost" onclick="closeModal();dupQuote('${qid}',false)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Duplicate</button>
${q.status==='draft'?`<button class="btn btn-ghost" style="border:1px solid #c4b5fd;color:#c4b5fd" onclick="closeModal();submitForApproval('${qid}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Submit for Approval</button><button class="btn btn-pr" onclick="closeModal();markReadyDirect('${qid}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Mark Ready (Skip Approval)</button>`:''}
${q.status==='approval'?`<button class="btn btn-pr" onclick="closeModal();ceoApprove('${qid}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve</button><button class="btn btn-rd" onclick="closeModal();setQStatus('${qid}','rejected')">✕ Reject</button>`:''}
${q.status==='ready'?`<button class="btn btn-pr" onclick="closeModal();S.editId='${qid}';emailQuoteWithPDF()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Email Quote</button>`:``}
${q.status==='sent'?`<button class="btn btn-gn" onclick="closeModal();showWon('${qid}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg> Won</button><button class="btn btn-rd" onclick="closeModal();showLost('${qid}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Lost</button>`:''}
${q.status!=='archived'?`<button class="btn btn-ghost" onclick="closeModal();setQStatus('${qid}','archived')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Archive</button>`:`<button class="btn btn-ghost" onclick="closeModal();setQStatus('${qid}','draft')">↩ Unarchive</button>`}
<button class="btn btn-rd" onclick="closeModal();delQuote('${qid}')">🗑 Delete</button>
<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`)}

function showWon(qid){var q=DB.quotes().find(function(x){return x.id===qid});var qtys=q?(q.qtys||[]):[];openModal(`<div class="modal-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg> Mark Won</div><div class="fg" style="margin-bottom:8px"><label>Order Amount ($) <span class="req">*</span></label><input id="wonAmt" type="number" placeholder="Total order value" style="width:100%;padding:6px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx)"></div><div class="fg" style="margin-bottom:8px"><label>PO Number <span class="req">*</span></label><input id="wonPO" placeholder="Purchase order #" style="width:100%;padding:6px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx)"></div><div class="fg" style="margin-bottom:8px"><label>Number of SKUs</label><input id="wonSKUs" type="number" placeholder="e.g. 1, 3, 5" value="1" style="width:100%;padding:6px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx)"></div><div class="fg" style="margin-bottom:8px"><label>Quantity Chosen</label><select id="wonQty" style="width:100%;padding:6px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx)">${qtys.map(function(q2){return'<option value="'+q2+'">'+Number(q2).toLocaleString()+'</option>'}).join('')}<option value="custom">Custom...</option></select></div><div class="fg" style="margin-bottom:8px"><label>Date Received <span class="req">*</span></label><input id="wonDate" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:6px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx)"></div><div class="fg" style="margin-bottom:8px"><label>Expected Delivery Date</label><input id="wonDelivery" type="date" style="width:100%;padding:6px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx)"></div><button class="btn btn-gn" onclick="confirmWon('${qid}')" style="width:100%">✅ Confirm Won</button><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>`)}
function confirmWon(qid){const amt=parseFloat($('wonAmt').value);const po=$('wonPO').value.trim();const dt=$('wonDate').value;if(!amt||amt<=0)return toast('Enter order amount','err');if(!po)return toast('Enter PO number','err');if(!dt)return toast('Enter date received','err');var qtyVal=$('wonQty').value;if(qtyVal==='custom')qtyVal=prompt('Enter quantity:')||'';var skus=parseInt(($('wonSKUs')||{}).value)||1;var delivery=($('wonDelivery')||{}).value||'';setQStatus(qid,'won',{wonAmount:amt,poNumber:po,wonDate:dt,wonSKUs:skus,wonQty:qtyVal,expectedDelivery:delivery});closeModal();
// Auto-suggest creating SO after winning
setTimeout(function() {
  if (confirm('Quote won! Create a Sales Order from this quote now?')) {
    if (typeof createSOFromPO === 'function') {
      createSOFromPO(qid);
    } else {
      goView('orders');
    }
  }
}, 1000)}
function showLost(qid){openModal(`<div class="modal-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Mark Lost</div><div class="fg"><label>Reason</label><input id="lostR" placeholder="Price, lead time..."></div><button class="btn btn-rd" onclick="setQStatus('${qid}','lost',{lostReason:$('lostR').value});closeModal()">Confirm</button><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`)}

// CUSTOMERS
function renderCust(){const cs=DB.customers();const sr=S.cSearch?cs.filter(c=>(c.company+' '+c.contact+' '+(c.industry||'')+' '+(c.email||'')).toLowerCase().includes(S.cSearch.toLowerCase())):cs;
const aq=DB.quotes();const withQ=cs.filter(c=>aq.some(q=>q.customerId===c.id||q.fields.custCo===c.company)).length;
$('v-customers').innerHTML=`<div style="display:flex;gap:6px;margin-bottom:8px;font-size:11px"><div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--ac)">${cs.length}</div>Total</div><div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gn)">${withQ}</div>With Quotes</div><div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:700">${sr.length}</div>Showing</div></div>
<div style="display:flex;gap:8px;margin-bottom:10px"><div class="search-bar" style="flex:1;margin:0"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input placeholder="Search..." value="${S.cSearch}" oninput="S.cSearch=this.value;renderCust()"></div><button class="btn btn-pr btn-sm" onclick="showCustForm()">+ Add</button></div>
${sr.length?sr.map(c=>{const cq=DB.quotes().filter(q=>q.customerId===c.id||q.fields.custCo===c.company);const dr=cq.filter(q=>q.status==='draft').length;const ap2=cq.filter(q=>q.status==='approval').length;const se=cq.filter(q=>q.status==='sent').length;const wn=cq.filter(q=>q.status==='won').length;const lo=cq.filter(q=>q.status==='lost').length;const tw2=wn?cq.filter(q=>q.status==='won').reduce((a,q)=>a+(q.wonAmount||0),0):0;return`<div class="qcard" onclick="openProfile('${c.id}')"><div style="display:flex;justify-content:space-between;align-items:center"><div class="qcard-co">${esc(c.company)}</div><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();showCustForm('${c.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div><div class="qcard-desc">${esc(c.contact)||''} ${c.phone?'· '+esc(c.phone):''} ${c.industry?'· <em>'+esc(c.industry)+'</em>':''}</div><div style="font-size:10px;color:var(--tx2);margin:2px 0">${cq.length} quotes${wn?' · <span style=color:var(--gn)>'+wn+' won</span>':''}${tw2?' · <span style=color:var(--gn)>'+f$(tw2)+'</span>':''}${ap2?' · <span style=color:#c4b5fd>'+ap2+' pending</span>':''}</div>${cq.length?'<div style="display:flex;gap:3px;margin-top:4px;flex-wrap:wrap">'+(dr?'<span class="pill pill-draft" style="font-size:8px;padding:1px 5px">'+dr+' draft</span>':'')+(ap2?'<span class="pill pill-approval" style="font-size:8px;padding:1px 5px">'+ap2+' pending</span>':'')+(se?'<span class="pill pill-sent" style="font-size:8px;padding:1px 5px">'+se+' sent</span>':'')+(wn?'<span class="pill pill-won" style="font-size:8px;padding:1px 5px">'+wn+' won</span>':'')+(lo?'<span class="pill pill-lost" style="font-size:8px;padding:1px 5px">'+lo+' lost</span>':'')+'</div>':''}</div>`}).join(''):'<div class="empty-state"><div class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><p>No customers</p><button class="btn btn-pr" onclick="showCustForm()">+ Add</button></div>'}`}

// TEMPLATES
function renderTpl(){
const dies=getSpecList('dies');const films=getSpecList('films');const labels=getSpecList('labels');const varnishes=getSpecList('varnishes');
const baseDies=SPEC_DIES.length;const baseFilms=SPEC_FILMS.length;const baseLabels=SPEC_LABELS.length;const baseVarn=SPEC_VARNISHES.length;
$('v-templates').innerHTML=`
<div style="padding:2px 0 8px"><input id="specGlobalSearch" type="text" placeholder="Search all specs..." oninput="specGlobalFilter()" style="width:100%;padding:8px 12px;border:1px solid var(--bdr);border-radius:8px;background:var(--inp);color:var(--tx);font-size:13px"></div>

<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">🔧</span><span class="ttl">Die List (${dies.length})</span><span class="arr">▾</span></div><div class="scard-b open">
<div id="specDiesList" style="max-height:400px;overflow-y:auto">
${dies.map((d,i)=>`<div class="spec-item spec-global-row" data-gsearch="${(d.id+' '+d.shape+' '+d.sA+' '+d.sAr+' '+d.notes).toLowerCase()}" onclick="inspectDie('${d.id}')" style="padding:8px 6px;border-bottom:1px solid var(--bdr);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
<div><strong style="color:var(--ac)">${d.id}</strong> <span style="color:var(--tx2);font-size:11px">${d.shape} ${d.sA}×${d.sAr}</span>${d.notes?'<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+esc(d.notes)+'</div>':''}</div>
${i>=baseDies?'<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();removeUserSpecItem(\'dies\','+i+');renderTpl()">✕</button>':''}
</div>`).join('')}
</div>
<button class="btn btn-pr btn-sm" onclick="addNewDie();renderTpl()" style="margin-top:8px;width:100%">+ Add New Die</button>
</div></div>

<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico">🎞️</span><span class="ttl">Flexible Film List (${films.length})</span><span class="arr">▾</span></div><div class="scard-b">
<div id="specFilmsList" style="max-height:400px;overflow-y:auto">
${films.map((d,i)=>`<div class="spec-item spec-global-row" data-gsearch="${(d.id+' '+d.desc).toLowerCase()}" style="padding:8px 6px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">
<div><strong style="color:var(--ac)">${d.id}</strong> <span style="font-size:11px;color:var(--tx2)">- ${d.desc}</span></div>
${i>=baseFilms?'<button class="btn btn-ghost btn-xs" onclick="removeUserSpecItem(\'films\','+i+');renderTpl()">✕</button>':''}
</div>`).join('')}
</div>
<button class="btn btn-pr btn-sm" onclick="addNewSpec('films');renderTpl()" style="margin-top:8px;width:100%">+ Add New Film</button>
</div></div>

<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico">🏷️</span><span class="ttl">Label Stock List (${labels.length})</span><span class="arr">▾</span></div><div class="scard-b">
<div id="specLabelsList" style="max-height:400px;overflow-y:auto">
${labels.map((d,i)=>`<div class="spec-item spec-global-row" data-gsearch="${(d.id+' '+d.desc).toLowerCase()}" style="padding:8px 6px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">
<div><strong style="color:var(--ac)">${d.id}</strong> <span style="font-size:11px;color:var(--tx2)">- ${d.desc}</span></div>
${i>=baseLabels?'<button class="btn btn-ghost btn-xs" onclick="removeUserSpecItem(\'labels\','+i+');renderTpl()">✕</button>':''}
</div>`).join('')}
</div>
<button class="btn btn-pr btn-sm" onclick="addNewSpec('labels');renderTpl()" style="margin-top:8px;width:100%">+ Add New Label Stock</button>
</div></div>

<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico">✨</span><span class="ttl">Varnish List (${varnishes.length})</span><span class="arr">▾</span></div><div class="scard-b">
<div id="specVarnishList" style="max-height:400px;overflow-y:auto">
${varnishes.map((v,i)=>`<div class="spec-item spec-global-row" data-gsearch="${v.toLowerCase()}" style="padding:8px 6px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">
<div><strong>${v}</strong></div>
${i>=baseVarn?'<button class="btn btn-ghost btn-xs" onclick="removeUserSpecItem(\'varnishes\','+i+');renderTpl()">✕</button>':''}
</div>`).join('')}
</div>
<button class="btn btn-pr btn-sm" onclick="addNewVarnish();renderTpl()" style="margin-top:8px;width:100%">+ Add New Varnish</button>
</div></div>
<div style="height:80px"></div>`}


function appendRFQToLibrary(){
var tpl=$('v-templates');if(!tpl)return;
var rDiv=document.createElement('div');
rDiv.className='scard';rDiv.style.marginTop='10px';
rDiv.innerHTML='<div class="scard-h" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span><span class="ttl">RFQ Requests</span><span class="arr">▾</span></div><div class="scard-b"><div id="libRfqList">Loading...</div></div>';
tpl.appendChild(rDiv);
if(fbDb){fbDb.collection('requests').orderBy('submittedAt','desc').limit(20).get().then(function(snap){
var reqs=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var h='';reqs.forEach(function(r){
var sc={pending:'or',approved:'gn',in_progress:'#60a5fa',completed:'var(--gn)'};
h+='<div style="padding:6px;border-bottom:1px solid var(--bdr);cursor:pointer;font-size:11px" onclick="openRFQDetail(\''+r.id+'\')">';
h+='<div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(r.company||'-')+'</strong><span class="pill pill-'+(r.status==='pending'?'proposal':r.status==='approved'?'qualified':'won')+'">'+esc(r.status||'pending')+'</span></div>';
h+='<div style="color:var(--tx3);margin-top:2px">'+esc(r.requestType||'Quote')+' · '+esc(r.submittedBy||'')+' · '+(r.submittedAt?new Date(r.submittedAt.seconds*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+new Date(r.submittedAt.seconds*1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):'')+'</div></div>'});
if(!reqs.length)h='<div style="color:var(--tx3);padding:8px;text-align:center">No requests yet</div>';
var el=document.getElementById('libRfqList');if(el)el.innerHTML=h}).catch(function(e){var el=document.getElementById('libRfqList');if(el)el.innerHTML=esc(e.message)})}}

function specGlobalFilter(){const q=($('specGlobalSearch')||{}).value||'';const ql=q.toLowerCase();document.querySelectorAll('.spec-global-row').forEach(r=>{const s=r.getAttribute('data-gsearch')||'';r.style.display=ql===''||s.includes(ql)?'flex':'none'})}

function inspectDie(dieId){const dies=getSpecList('dies');const d=dies.find(x=>x.id===dieId);if(!d)return;
openModal('<div class="modal-title">'+d.id+' - '+d.shape+'</div>'+
'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px;margin-bottom:12px">'+
[['Shape',d.shape],['Size Across',d.sA||'-'],['Size Around',d.sAr||'-'],['Repeat',d.repeat||'-'],['# Across',d.nA||'-'],['# Around',d.nAr||'-'],['Gap Across',d.gapA||'-'],['Gap Around',d.gapAr||'-'],['Corner Radius',d.cRad||'-']].map(([l,v])=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--tx2)">'+l+'</span><strong>'+v+'</strong></div>').join('')+
'</div>'+(d.notes?'<div style="font-size:11px;color:var(--tx3);font-style:italic;margin-bottom:12px">'+esc(d.notes)+'</div>':'')+
'<button class="btn btn-pr btn-sm" onclick="closeModal()">Close</button>')}

// EDITOR
function renderEditor(){const q=getQ(S.editId);if(!q)return goView('quotes');
$('hdrTitle').textContent=q.quoteNum+' Rev '+q.rev+(q.description?' — '+q.description:'');
$('hdrActions').innerHTML=`<span class="pill pill-${q.status}">${q.status}</span>${q.collaborators&&q.collaborators.length?'<span style="font-size:9px;color:var(--ac)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> '+q.collaborators.length+'</span>':''}<button class="btn btn-pr btn-sm" onclick="edActions()">⋯</button>`;
const f=q.fields;
const mkOpts=(opts,cur)=>opts.map(o=>`<option ${cur===o?'selected':''}>${o}</option>`).join('');
const mkOptV=(opts,cur)=>opts.map(([v,l])=>`<option value="${v}" ${cur===v?'selected':''}>${l||v}</option>`).join('');

$('v-editor').innerHTML=`<div class="etabs">${['Info','Specs','Materials','Pricing','Matrix','Preview',(function(){var qq=getQ(S.editId);if(!qq)return'Send';if(qq.status==='draft')return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit';if(qq.status==='approval')return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pending';if(qq.status==='rejected')return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Rejected';if(qq.status==='ready'||qq.status==='sent')return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Comms';return'Send'})(),'Timeline'].map((t,i)=>`<div class="etab ${i===S.etab?'active':''}" onclick="switchET(${i})">${t}</div>`).join('')}<div style="margin-left:auto;padding:0 6px;display:flex;align-items:center;gap:6px;overflow:hidden" id="statusBar">${(function(){var qq=getQ(S.editId);if(!qq)return'';var sc={'draft':'var(--tx3)','approval':'#c4b5fd','ready':'var(--ac)','sent':'var(--ac)','won':'var(--gn)','lost':'var(--rd)','rejected':'var(--rd)','archived':'var(--tx3)'}[qq.status]||'var(--tx3)';var ns='—';if(qq.status==='draft')ns='Submit for approval';else if(qq.status==='approval')ns='Awaiting CEO';else if(qq.status==='ready')ns='Send to client';else if(qq.status==='sent')ns=qq.poNumber?'Create SO':'Awaiting client';else if(qq.status==='won')ns='Create Sales Order';var la=qq.updatedAt?fD(qq.updatedAt):'—';return'<div style="display:flex;align-items:center;gap:4px;min-width:0"><div style="width:8px;height:8px;border-radius:50%;background:'+sc+';flex-shrink:0;animation:pulse 2s ease infinite"></div><div style="font-size:8px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:'+sc+';font-weight:700">'+qq.status.toUpperCase()+'</span> · Next: '+ns+'</div></div>'})()}</div></div>
<style>#statusBar{max-width:250px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style>

<div class="epane ${S.etab===0?'active':''}" id="ep-info">
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span><span class="ttl">Quote</span><span class="arr">▾</span></div><div class="scard-b open">
<div style="display:grid;grid-template-columns:1fr 56px 130px;gap:8px;align-items:end">
<div class="fg"><label>Quote #</label><input data-field="quoteNum" value="${q.quoteNum}" readonly style="color:var(--ac);font-family:'JetBrains Mono',monospace"></div>
<div class="fg"><label style="text-align:center">Rev</label><div style="color:var(--or);font-family:'JetBrains Mono',monospace;text-align:center;font-size:18px;font-weight:800;padding:5px 0;background:var(--bg3);border-radius:6px;border:1px solid var(--or);line-height:1">${q.rev}</div></div>
<div class="fg"><label>Date</label><input data-field="quoteDate" type="date" value="${f.quoteDate||''}" oninput="asave()"></div>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><label style="font-size:9px;font-weight:700;color:var(--or);white-space:nowrap;letter-spacing:.5px;margin:0">DESC</label><input data-field="description" value="${q.description||''}" placeholder="e.g. 4x6 Nutrition Label" oninput="asave()" style="flex:1;border-color:var(--bdr);font-size:11px;padding:5px 8px"></div>
<div class="row2" style="margin-top:6px"><div class="fg"><label>Estimator <span class="req">*</span></label><input data-field="estimator" value="${f.estimator}" oninput="asave()"></div><div class="fg"><label>Job Type</label><select data-field="jobType" oninput="asave()" onchange="suggestMaterials(this.value)">${mkOpts(['Flexographic','Digital','Offset'],f.jobType)}</select></div></div>
<div class="row2"><div class="fg"><label>Sales Rep</label><input data-field="salesRep" value="${f.salesRep}" oninput="asave()"></div><div class="fg"><label>Payment Terms</label><select data-field="payTerms" onchange="if(this.value==='__add__'){this.value='${f.payTerms||''}';addPaymentTerm();return}asave()">${mkOpts(getPayTerms(),f.payTerms)}<option value="__add__" style="color:#00e5ff">+ Add New Term...</option></select></div></div>
</div></div>
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">🏢</span><span class="ttl">Customer</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="fg"><label>Load Saved Customer</label><input id="custSearch" placeholder="Type to search 400+ clients..." oninput="filterCustDD(this.value)" onfocus="$('custDD').style.display='block'" autocomplete="off"><div id="custDD" style="display:none;max-height:180px;overflow-y:auto;background:var(--inp);border:1px solid var(--ac3);border-radius:0 0 8px 8px;margin-top:-4px"></div></div>
<div class="fg"><label>Company</label><input data-field="custCo" value="${f.custCo}" oninput="asave()"></div>
<div class="fg"><label>Attention</label><input data-field="custAttn" value="${f.custAttn}" oninput="asave()"></div>
<div class="fg"><label>Phone/Email</label><input data-field="custPhone" value="${f.custPhone}" oninput="asave()"></div>
<div class="fg"><label>Email</label><input data-field="custEmail" value="${f.custEmail||''}" oninput="asave()"></div>
<div class="row2"><div class="fg"><label>Client Code</label><input data-field="clientCode" value="${f.clientCode||''}" placeholder="MFX-000-00" oninput="asave()"></div><div class="fg"><label>Industry</label><input data-field="industry" value="${f.industry||''}" placeholder="Food & Beverage" oninput="asave()"></div></div>
<div class="row2"><div class="fg"><label>City, State</label><input data-field="cityState" value="${f.cityState||''}" placeholder="Los Angeles, CA" oninput="asave()"></div><div class="fg"><label>Ship To</label><input data-field="shipTo" value="${f.shipTo||''}" placeholder="Ship to address" oninput="asave()"></div></div>
<div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" onclick="saveCustFromQ()" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Customer</button><button class="btn btn-ghost btn-sm" onclick="viewCustFromQ()" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> View Profile</button></div>
<div id="clientMiniDash"></div>
</div></div></div>

<div class="epane ${S.etab===1?'active':''}" id="ep-specs">
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">🏷️</span><span class="ttl">Product</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="row2"><div class="fg"><label>Shape</label><select data-field="shapeType" oninput="asave()">${mkOpts(['Rectangle Label','Circle Label','Oval Label','Square Label','Special Shape','Flexible Film','Flexible Film Pouch','Stick Pack','Sheets'],f.shapeType)}</select></div></div>
</div></div>
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">📐</span><span class="ttl">Dimensions</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="fg"><label>Die # <button class="btn btn-ghost btn-xs" onclick="showSpecManager('dies')" style="float:right;font-size:9px">⚙ Manage</button></label><select id="ed-die" onchange="selectDie()"><option value="">- Select Die -</option></select></div>
<div id="dieSpecPanel" style="display:none;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px 10px;margin-bottom:10px">
<div style="font-weight:600;font-size:12px;margin-bottom:6px;color:var(--pr)">Selected Die Specs</div>
<div id="dieSpecGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px"></div>
<div id="dieSpecNotes" style="margin-top:6px;font-size:10px;color:var(--tx3);font-style:italic"></div>
</div>
<div class="row2"><div class="fg"><label>Size Across</label><input data-field="sA" type="number" value="${f.sA}" step=".125" oninput="asave()"></div><div class="fg"><label>Size Around</label><input data-field="sar" type="number" value="${f.sar}" step=".125" oninput="asave()"></div></div>
<div class="row3"><div class="fg"><label># Across</label><input data-field="nAcross" type="number" value="${f.nAcross}" min="1" oninput="asave()"></div><div class="fg"><label># Around</label><input data-field="nAround" type="number" value="${f.nAround}" min="1" oninput="asave()"></div><div class="fg"><label>Colors</label><input data-field="colors" type="number" value="${f.colors}" oninput="asave()"></div></div>
<div class="row3"><div class="fg"><label>Gap Across</label><input data-field="gA" type="number" value="${f.gA}" step=".0625" oninput="asave()"></div><div class="fg"><label>Gap Around</label><input data-field="gar" type="number" value="${f.gar}" step=".0625" oninput="asave()"></div><div class="fg"><label>Off Cuts</label><input data-field="offCuts" type="number" value="${f.offCuts}" step=".0625" oninput="asave()"></div></div>
<div class="row3"><div class="fg"><label># Copies</label><input data-field="nCopies" type="number" value="${f.nCopies}" oninput="asave()"></div><div class="fg"><label># Plates</label><input data-field="nPlates" type="number" value="${f.nPlates}" oninput="asave()"></div><div class="fg"><label>Radius</label><input data-field="cRad" type="number" value="${f.cRad}" step=".0625" oninput="asave()"></div></div>
</div></div>
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">🔄</span><span class="ttl">Roll</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="row2"><div class="fg"><label>Labels/Roll</label><input data-field="labRoll" value="${f.labRoll}" oninput="asave()"></div><div class="fg"><label>Max OD</label><input data-field="maxOD" value="${f.maxOD}" oninput="asave()"></div></div>
<div class="row2"><div class="fg"><label>Wind Dir/Copy Pos</label><select data-field="windDir" oninput="asave()">${mkOpts(['TBD','1','2','3','4','5','6','7','8','3BOE','4BOE','5BOE','6BOE','7BOE','8BOE','1Color','2Color','Blank'],f.windDir)}</select></div><div class="fg"><label>Core Dia</label><input data-field="coreDia" value="${f.coreDia}" oninput="asave()"></div></div>
</div></div><div class="cbox" id="specBox"></div></div>

<div class="epane ${S.etab===2?'active':''}" id="ep-mats">
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">🧱</span><span class="ttl">Materials</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="fg"><label>Face Stock <button class="btn btn-ghost btn-xs" onclick="showSpecManager('labels')" style="float:right;font-size:9px">⚙ Manage</button><button class="btn btn-ghost btn-xs" onclick="openMatProfile(document.querySelector('[data-field=faceStock]').value)" style="float:right;font-size:9px;margin-right:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></button></label><div class="mat-wrap"><select data-field="faceStock" id="ed-fs" onchange="edMat('faceStock',true)"></select><span class="mat-msi" id="msi-faceStock"></span></div></div>
<div class="fg"><label>Lamination <button class="btn btn-ghost btn-xs" onclick="showSpecManager('films')" style="float:right;font-size:9px">⚙ Manage</button><button class="btn btn-ghost btn-xs" onclick="openMatProfile(document.querySelector('[data-field=lamination]').value)" style="float:right;font-size:9px;margin-right:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></button></label><div class="mat-wrap"><select data-field="lamination" id="ed-lam" onchange="edMat('lamination')"></select><span class="mat-msi" id="msi-lamination"></span></div></div>
<div class="row2"><div class="fg"><label>Liner</label><select data-field="liner" oninput="asave()">${mkOpts(['NA','40# Liner','40# CK Liner','50# Liner','Kraft Liner','CUSTOM'],f.liner)}</select></div><div class="fg"><label>Adhesive</label><select data-field="adhesive" oninput="asave()">${mkOpts(['NA','C2500','S100R Permanent','AT20 All-Temp','751 Permanent','531 Removable','CUSTOM'],f.adhesive)}</select></div></div>
<div class="row2"><div class="fg"><label>Coating / Varnish <button class="btn btn-ghost btn-xs" onclick="showSpecManager('varnishes')" style="float:right;font-size:9px">⚙ Manage</button></label><select data-field="coating" id="ed-coat" oninput="asave()"></select></div><div class="fg"><label>Other</label><select data-field="otherMat" oninput="asave()">${mkOpts(['NA','CUSTOM'],f.otherMat)}</select></div></div>
<div class="fg"><label>Notes <span style="font-weight:400;color:var(--tx3)">(custom per quote)</span></label><textarea data-field="notes" placeholder="Add any job-specific notes here..." oninput="asave()">${f.notes}</textarea></div>
<div class="fg"><label>Custom Note for PDF <span style="font-weight:400;color:var(--tx3)">(shown on quote)</span></label><textarea data-field="customNote" placeholder="Customer requested expedited delivery..." oninput="asave()">${f.customNote||''}</textarea></div>
<div class="fg"><label>Note Tags <span style="font-weight:400;color:var(--tx3)">(shown on quote)</span></label>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${['Print-Ready Art','Digital Proof','Roll Pack-Out','FDA Compliant','Press Proof','Custom Core','PMS Match','Stability Test'].map(function(t){return '<label style="display:flex;align-items:center;gap:3px;padding:4px 8px;background:var(--bg3);border-radius:4px;font-size:10px;cursor:pointer"><input type="checkbox" data-tag="'+t+'" '+(((f.notesTags||[]).indexOf(t)>-1)?'checked':'')+' onchange="toggleNoteTag(this)">'+t+'</label>'}).join('')}</div></div>
</div></div></div>

<div class="epane ${S.etab===3?'active':''}" id="ep-pricing">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px 8px;background:var(--bg3);border-radius:6px;border:1px solid var(--bdr)">
<span style="font-size:11px;color:var(--tx2)">Pricing fields ${q.pricingLocked?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> LOCKED - values saved':'🔓 Unlocked - edit to adjust'}</span>
<button class="btn btn-ghost btn-xs" onclick="togglePriceLock()" style="font-size:10px">${q.pricingLocked?'🔓 Unlock':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Lock Prices'}</button>
</div>
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><span class="ttl">Pricing</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="vsec">Material Cost <span style="font-size:8px;color:var(--tx3)">Formula: MatCost = MatWW × TotalFt × 0.012 × MSI × Margin</span></div>
<div class="var-row"><span class="var-lbl">MSI Cost <span style="font-size:8px;color:var(--tx3)">(auto from material, editable)</span></span><input class="var-inp hi" data-field="msiCost" type="number" value="${f.msiCost}" step="0.001" oninput="asave()"><span class="var-unit">$/MSI</span></div>
<div class="var-row"><span class="var-lbl">Stock Margin</span><input class="var-inp" data-field="stockMgn" type="number" value="${f.stockMgn}" step="0.1" oninput="asave()"><span class="var-unit">×</span></div>
<div class="var-row"><span class="var-lbl">Setup/Waste</span><input class="var-inp" data-field="matSetup" type="number" value="${f.matSetup}" step="100" oninput="asave()"><span class="var-unit">ft</span></div>
<div class="vsec">Markup <span style="font-size:8px;color:var(--tx3)">Applied after material + setup costs</span></div>
<div class="var-row"><span class="var-lbl">MFX Markup</span><input class="var-inp hi" data-field="mkupPct" type="number" value="${f.mkupPct}" step="0.5" oninput="asave()"><span class="var-unit">%</span></div>
<div class="vsec">Plate/Color Corrections <span style="font-size:8px;color:var(--tx3)">Fixed per SKU: plates + color changes + MR + CU</span></div>
<div class="var-row"><span class="var-lbl">$/Plate</span><input class="var-inp hi" data-field="cppPlate" type="number" value="${f.cppPlate}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="var-row"><span class="var-lbl">Plates/SKU</span><input class="var-inp" data-field="plPerSku" type="number" value="${f.plPerSku}" oninput="asave()"><span class="var-unit">#</span></div>
<div class="var-row"><span class="var-lbl">CC Cost</span><input class="var-inp" data-field="ccCost" type="number" value="${f.ccCost}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="var-row"><span class="var-lbl"># CC</span><input class="var-inp" data-field="nCC" type="number" value="${f.nCC}" oninput="asave()"><span class="var-unit">#</span></div>
<div class="vsec">MR & Clean-Up <span style="font-size:8px;color:var(--tx3)">Labor: hours × rate per job</span></div>
<div class="var-row"><span class="var-lbl">MR Hours</span><input class="var-inp" data-field="mrHrs" type="number" value="${f.mrHrs}" step=".5" oninput="asave()"><span class="var-unit">hrs</span></div>
<div class="var-row"><span class="var-lbl">MR Rate</span><input class="var-inp hi" data-field="mrRate" type="number" value="${f.mrRate}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="var-row"><span class="var-lbl">CU Hours</span><input class="var-inp" data-field="cuHrs" type="number" value="${f.cuHrs}" step=".5" oninput="asave()"><span class="var-unit">hrs</span></div>
<div class="var-row"><span class="var-lbl">CU Rate</span><input class="var-inp" data-field="cuRate" type="number" value="${f.cuRate}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="vsec">Charges <span style="font-size:8px;color:var(--tx3)">One-time costs per job</span></div>
<div class="var-row"><span class="var-lbl">Die Charge</span><input class="var-inp" data-field="dieChg" type="number" value="${f.dieChg}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="var-row"><span class="var-lbl">Shipping (Est.)</span><input class="var-inp" data-field="shipping" type="number" value="${f.shipping||''}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="var-row"><span class="var-lbl">Plate Cost</span><input class="var-inp" data-field="plCost" type="number" value="${f.plCost}" oninput="asave()"><span class="var-unit">$</span></div>
<div class="vsec">PDF Display Options <span style="font-size:8px;color:var(--tx3)">Toggle what clients see on quote — all data still recorded internally</span></div>
<div class="var-row"><span class="var-lbl">Show Setup Costs</span><label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" data-field="showSetupOnPDF" ${f.showSetupOnPDF?'checked':''} onchange="asave()"><span style="font-size:10px;color:var(--tx3)">Include per-SKU setup breakdown on PDF</span></label></div>
<div class="var-row"><span class="var-lbl">Show Shipping</span><label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" data-field="showShippingOnPDF" ${f.showShippingOnPDF?'checked':''} onchange="asave()"><span style="font-size:10px;color:var(--tx3)">Show shipping estimate on PDF</span></label></div>
<div class="var-row"><span class="var-lbl">Show Plate Cost</span><label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" data-field="showPlateOnPDF" ${f.showPlateOnPDF?'checked':''} onchange="asave()"><span style="font-size:10px;color:var(--tx3)">Show plate/die charges on PDF</span></label></div>
<div class="vsec">Sales Commission</div>
<div class="var-row"><span class="var-lbl">Rep %</span><input class="var-inp hi" data-field="repPct" type="number" value="${f.repPct||0}" step="0.5" oninput="asave()"><span class="var-unit">%</span></div>
<div class="cbox" id="priceBox"></div></div></div>
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">📜</span><span class="ttl">Terms & Conditions</span><span class="arr">▾</span></div><div class="scard-b open">
<div id="termsEditor"></div>
<div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="addCustomTerm()" style="flex:1">+ Add Custom Term</button><button class="btn btn-ghost btn-sm" onclick="resetTerms()">↺ Reset</button></div>
</div></div></div>

<div class="epane ${S.etab===4?'active':''}" id="ep-matrix">
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></span><span class="ttl">Quantities & Pricing Matrix</span><span class="arr">▾</span></div><div class="scard-b open">
<div class="qty-list" id="edQL"></div>
<div style="display:flex;gap:6px;margin-top:8px">
<button class="btn btn-pr btn-sm" onclick="edAddQ()" style="flex:1">+ Add Qty</button>
<button class="btn btn-ghost btn-sm" onclick="edAddCommonQtys()" style="flex:1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Common Qtys</button>
<button class="btn btn-ghost btn-sm" onclick="edClearQtys()" style="flex:0.5">✕ Clear</button>
</div>
<div style="margin-top:10px;background:var(--bg3);border-radius:8px;overflow:hidden;border:1px solid var(--bdr)">
<div style="padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--bdr);font-size:9px;font-weight:700;color:var(--ac);letter-spacing:1px">PRICING PREVIEW</div>
<div id="matrixPreview" style="padding:8px 10px;font-size:10px;color:var(--tx3)">Add quantities above to see pricing preview</div>
</div>
</div></div>
<div class="row2"><div class="fg"><label>SKU Cols</label><select data-field="skuCols" oninput="asave()">${[1,2,3,4,5,6,7,8,9,10].map(function(n){return'<option value="'+n+'"'+(parseInt(f.skuCols)===n?' selected':'')+'>'+n+' SKU'+(n>1?'s':'')+'</option>'}).join('')}</select></div><div class="fg"><label>Show</label><select data-field="showMode" oninput="asave()">${mkOptV([['both','Unit & Total'],['unit','Unit Only'],['total','Total Only']],f.showMode)}</select></div></div>
<div class="scard" style="margin-top:8px"><div class="scard-h" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span><span class="ttl">Client Quote History</span><span class="arr">▾</span></div><div class="scard-b">
<div id="clientMatrixHistory" style="font-size:10px;color:var(--tx3)">Select a client to see their quote history and preferences.</div>
</div></div>
</div>

<div class="epane ${S.etab===5?'active':''}" id="ep-preview">
<div style="display:flex;gap:0;margin-bottom:8px;border:1px solid var(--bdr);border-radius:8px;overflow:hidden" class="no-print">
<button id="pvExtBtn" onclick="window._quotePreviewMode='external';edPreview();document.getElementById('pvExtBtn').style.background='var(--ac)';document.getElementById('pvExtBtn').style.color='#fff';document.getElementById('pvIntBtn').style.background='var(--bg3)';document.getElementById('pvIntBtn').style.color='var(--tx)'" style="flex:1;padding:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:var(--ac);color:#fff">External (Client)</button>
<button id="pvIntBtn" onclick="window._quotePreviewMode='internal';edPreview();document.getElementById('pvIntBtn').style.background='var(--ac)';document.getElementById('pvIntBtn').style.color='#fff';document.getElementById('pvExtBtn').style.background='var(--bg3)';document.getElementById('pvExtBtn').style.color='var(--tx)'" style="flex:1;padding:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:var(--bg3);color:var(--tx)">Internal (Full Details)</button>
</div>
<div class="qp" id="quotePage" style="overflow-y:auto;-webkit-overflow-scrolling:touch"></div>
<div style="text-align:center;margin-top:12px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap" class="no-print">
<select id="printOrientation" style="padding:4px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select>
<button class="btn btn-pr btn-sm" onclick="doPrint()">🖨 Print / Save PDF</button>
<button class="btn btn-ghost btn-sm" onclick="saveQuoteToDrive()">☁ Save to Drive</button>
<button class="btn btn-ghost btn-sm" onclick="printQuoteOnly()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Print Preview</button>
</div></div>

<div class="epane ${S.etab===6?'active':''}" id="ep-send">
<div id="sendPaneContent"></div>
</div>

<div class="epane ${S.etab===7?'active':''}" id="ep-timeline">
<div style="display:flex;gap:0;border-bottom:2px solid var(--bdr);margin-bottom:8px">
<div class="tl-sub ${!window._tlSub||window._tlSub==='activity'?'active':''}" onclick="switchTLSub('activity')" style="padding:6px 12px;font-size:10px;font-weight:700;cursor:pointer;border-bottom:2px solid ${!window._tlSub||window._tlSub==='activity'?'var(--ac)':'transparent'};color:${!window._tlSub||window._tlSub==='activity'?'var(--ac)':'var(--tx3)'}">Activity</div>
<div class="tl-sub ${window._tlSub==='notes'?'active':''}" onclick="switchTLSub('notes')" style="padding:6px 12px;font-size:10px;font-weight:700;cursor:pointer;border-bottom:2px solid ${window._tlSub==='notes'?'var(--ac)':'transparent'};color:${window._tlSub==='notes'?'var(--ac)':'var(--tx3)'}">Notes</div>
<div class="tl-sub ${window._tlSub==='workflow'?'active':''}" onclick="switchTLSub('workflow')" style="padding:6px 12px;font-size:10px;font-weight:700;cursor:pointer;border-bottom:2px solid ${window._tlSub==='workflow'?'var(--ac)':'transparent'};color:${window._tlSub==='workflow'?'var(--ac)':'var(--tx3)'}">Workflow</div>
<div class="tl-sub ${window._tlSub==='connections'?'active':''}" onclick="switchTLSub('connections')" style="padding:6px 12px;font-size:10px;font-weight:700;cursor:pointer;border-bottom:2px solid ${window._tlSub==='connections'?'var(--ac)':'transparent'};color:${window._tlSub==='connections'?'var(--ac)':'var(--tx3)'}">Links</div>
</div>
<div id="tlActivity" style="display:${!window._tlSub||window._tlSub==='activity'?'block':'none'}">
<div id="activityLog" style="max-height:500px;overflow-y:auto"></div>
</div>
<div id="tlNotes" style="display:${window._tlSub==='notes'?'block':'none'}">
<div id="internalNotes" style="max-height:300px;overflow-y:auto;margin-bottom:8px"></div>
<div style="position:relative">
<textarea id="noteInput" placeholder="Type @ to mention a team member..." oninput="checkAtMention(this)" style="width:100%;min-height:60px;padding:8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:12px;box-sizing:border-box"></textarea>
<div id="mentionDropdown" style="display:none;position:absolute;bottom:100%;left:0;width:100%;max-height:150px;overflow-y:auto;background:var(--card);border:1px solid var(--ac);border-radius:6px;z-index:100"></div>
</div>
<button class="btn btn-pr btn-sm" onclick="addInternalNote()" style="margin-top:6px;width:100%">+ Add Note</button>
</div>
<div id="tlWorkflow" style="display:${window._tlSub==='workflow'?'block':'none'}">
<div id="workflowContent"></div>
</div>
<div id="tlConnections" style="display:${window._tlSub==='connections'?'block':'none'}">
<div id="connectionsContent"></div>
</div>
</div>`;

buildMS('ed-fs',f.faceStock);buildMS('ed-lam',f.lamination);buildDieSelect(f);buildVarnishSelect(f.coating);edMat('faceStock');edMat('lamination');edRQ();renderTermsEditor();edCalcAll();renderInternalNotes();renderActivityLog();if(S.etab===6)setTimeout(renderSendPane,100);if(S.etab===7){setTimeout(renderWorkflow,100);setTimeout(renderConnections,150)}
if(f.custCo){var _mc=DB.customers().find(function(x){return x.company&&x.company.toLowerCase()===f.custCo.toLowerCase()});if(_mc)setTimeout(function(){renderClientMiniDash(_mc)},200)}
// Inject Next/Prev navigation buttons into each pane
var _tabNames=['Info','Specs','Materials','Pricing','Matrix','Preview','Send','Timeline'];
var _paneIds=['ep-info','ep-specs','ep-mats','ep-pricing','ep-matrix','ep-preview','ep-send','ep-timeline'];
_paneIds.forEach(function(pid,i){var pane=$(pid);if(!pane)return;var nav=document.createElement('div');nav.style.cssText='display:flex;gap:8px;margin-top:16px;padding:12px 0;border-top:1px solid var(--bdr)';if(i>0){var prev=document.createElement('button');prev.className='btn btn-ghost btn-sm';prev.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;gap:6px';prev.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> '+_tabNames[i-1];prev.onclick=function(){switchET(i-1)};nav.appendChild(prev)}if(i<_paneIds.length-1){var next=document.createElement('button');next.className='btn btn-pr btn-sm';next.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;gap:6px;margin-left:auto';next.innerHTML=_tabNames[i+1]+' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';next.onclick=function(){switchET(i+1)};nav.appendChild(next)}pane.appendChild(nav)})}

function buildDieSelect(f){const sel=$('ed-die');if(!sel)return;const dies=getSpecList('dies');sel.innerHTML='<option value="">- Select Die -</option>';
dies.forEach(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=d.id+' - '+d.shape+' '+d.sA+'×'+d.sAr;sel.appendChild(o)});
sel.value=''}

window.suggestMaterials = function(jobType) {
  var defaults = {
    'Flexographic': { faceStock: '539SHP', lamination: '557SW' },
    'Digital': { faceStock: 'Digital White BOPP', lamination: 'Gloss Lam' },
    'Offset': { faceStock: 'C1S Label Stock', lamination: 'Matte Lam' }
  };
  var d = defaults[jobType];
  if (!d) return;
  var fs = document.querySelector('[data-field="faceStock"]');
  var lam = document.querySelector('[data-field="lamination"]');
  // Only auto-fill if fields are at defaults or empty
  if (fs && (!fs.value || fs.value === '539SHP' || fs.value === '')) {
    fs.value = d.faceStock;
  }
  if (lam && (!lam.value || lam.value === '557SW' || lam.value === '')) {
    lam.value = d.lamination;
  }
  asave();
};

function selectDie(){const sel=$('ed-die');const panel=$('dieSpecPanel');const grid=$('dieSpecGrid');const notesEl=$('dieSpecNotes');
if(!sel||!sel.value){if(panel)panel.style.display='none';return}
const dies=getSpecList('dies');const d=dies.find(x=>x.id===sel.value);if(!d){if(panel)panel.style.display='none';return}
const fields={sA:'sA',sar:'sAr',nAcross:'nA',nAround:'nAr',gA:'gapA',gar:'gapAr',cRad:'cRad',shapeType:'shape'};
for(const[field,key]of Object.entries(fields)){const v=d[key];if(!v||v==='-')continue;
const inp=document.querySelector('[data-field="'+field+'"]');if(inp){if(field==='shapeType'){const found=[...inp.options].find(o=>o.value.toLowerCase().includes(v.toLowerCase()));if(found)inp.value=found.value}else{const n=parseFloat(v);if(!isNaN(n))inp.value=n}}}
if(panel&&grid){panel.style.display='block';
const specs=[['Die #',d.id],['Shape',d.shape],['Size Across',d.sA||'-'],['Size Around',d.sAr||'-'],['Repeat',d.repeat||'-'],['# Across',d.nA||'-'],['# Around',d.nAr||'-'],['Gap Across',d.gapA||'-'],['Gap Around',d.gapAr||'-'],['Corner Radius',d.cRad||'-']];
grid.innerHTML=specs.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--tx2)">${l}</span><strong>${v}</strong></div>`).join('');
notesEl.textContent=d.notes?'Notes: '+d.notes:''}
if(d.notes){toast(d.id+': '+d.notes,'info')}
// Auto-calculate copies from nAcross * nAround
var nA = parseInt(document.querySelector('[data-field="nAcross"]')?.value) || 1;
var nAr = parseInt(document.querySelector('[data-field="nAround"]')?.value) || 1;
var copiesEl = document.querySelector('[data-field="nCopies"]');
if (copiesEl) { copiesEl.value = nA * nAr; }
// Auto-calculate plates from colors * copies
var colors = parseInt(document.querySelector('[data-field="colors"]')?.value) || 0;
var platesEl = document.querySelector('[data-field="nPlates"]');
if (platesEl && colors > 0) { platesEl.value = colors; }
asave()}

function buildVarnishSelect(def){const sel=$('ed-coat');if(!sel)return;const list=getSpecList('varnishes');sel.innerHTML='<option value="NA">NA</option>';
list.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===def)o.selected=true;sel.appendChild(o)});
const oC=document.createElement('option');oC.value='CUSTOM';oC.textContent='- Custom -';sel.appendChild(oC);
if(def&&def!=='NA'&&!list.includes(def)){const oD=document.createElement('option');oD.value=def;oD.textContent=def;oD.selected=true;sel.appendChild(oD)}}

function renderTermsEditor(){const q=getQ(S.editId);if(!q)return;
if(!q.terms)q.terms=[...DEFAULT_TERMS];
const el=$('termsEditor');if(!el)return;
const allTerms=[...new Set([...DEFAULT_TERMS,...q.terms])];
el.innerHTML=allTerms.map((t,i)=>{const checked=q.terms.includes(t);const isCustom=!DEFAULT_TERMS.includes(t);
return`<div class="term-item"><input type="checkbox" class="term-cb" ${checked?'checked':''} onchange="toggleTerm('${btoa(unescape(encodeURIComponent(t)))}',this.checked)"><div class="term-txt">${t}</div>${isCustom?`<button class="term-del" onclick="removeTerm('${btoa(unescape(encodeURIComponent(t)))}')">✕</button>`:''}</div>`}).join('')}

function toggleTerm(b64,on){const t=decodeURIComponent(escape(atob(b64)));const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;
if(!q.terms)q.terms=[...DEFAULT_TERMS];
if(on&&!q.terms.includes(t))q.terms.push(t);
if(!on)q.terms=q.terms.filter(x=>x!==t);
DB.saveQ(all,S.editId);edCalcAll()}

function addCustomTerm(){const t=prompt('Enter custom term:');if(!t||!t.trim())return;
const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;
if(!q.terms)q.terms=[...DEFAULT_TERMS];
q.terms.push(t.trim());DB.saveQ(all,S.editId);renderTermsEditor();edCalcAll()}

function removeTerm(b64){const t=decodeURIComponent(escape(atob(b64)));
const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;
q.terms=q.terms.filter(x=>x!==t);DB.saveQ(all,S.editId);renderTermsEditor();edCalcAll()}

function resetTerms(){if(!confirm('Reset to default terms?'))return;
const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;
q.terms=[...DEFAULT_TERMS];DB.saveQ(all,S.editId);renderTermsEditor();edCalcAll()}

function switchET(n){S.etab=n;saveQ();renderEditor();if(n===6)setTimeout(renderSendPane,100);if(n===7){setTimeout(renderWorkflow,100);setTimeout(renderConnections,150)}$('vc').scrollTop=0}
function switchTLSub(sub){window._tlSub=sub;var tabs=['activity','notes','workflow','connections'];tabs.forEach(function(t){var el=$('tl'+t.charAt(0).toUpperCase()+t.slice(1));if(el)el.style.display=t===sub?'block':'none'});if(sub==='workflow')renderWorkflow();if(sub==='connections')renderConnections();S.etab=7;renderEditor()}
function _validateQuoteForSubmit(q){
if(!q.fields.custCo || !q.fields.custCo.trim()) { toast('Customer company is required','err'); return false; }
if(!q.fields.estimator || !q.fields.estimator.trim()) { toast('Estimator is required','err'); return false; }
if(!q.qtys || q.qtys.length === 0) { toast('Add at least one quantity','err'); return false; }
if(!q.fields.sA && !q.fields.sar) { toast('Product dimensions required','err'); return false; }
return true;}
function submitForApproval(qid){const all=DB.quotes();const q=all.find(x=>x.id===qid);if(!q)return;
if(!_validateQuoteForSubmit(q))return;
q.status='approval';q.updatedAt=new Date().toISOString();q.submittedBy=getUserName();q.submittedAt=new Date().toISOString();
logQuoteEvent(q,'status','Submitted for approval');DB.saveQ(all,qid);DB.logActivity('quote.approval',q.quoteNum+' submitted for approval by '+getUserName());toast('Submitted for approval!','ok');notifyTeam('🔒 '+q.quoteNum+' needs approval — submitted by '+getUserName());if(S.view==='editor'){S.etab=6;renderEditor();setTimeout(renderSendPane,100)}else{renderQuotes()}}
function markReadyDirect(qid){const all=DB.quotes();const q=all.find(x=>x.id===qid);if(!q)return;
if(!_validateQuoteForSubmit(q))return;
q.status='ready';q.approvedBy=getUserName();q.approvedAt=new Date().toISOString();q.updatedAt=new Date().toISOString();if(typeof bakePricing==='function')bakePricing(q);logQuoteEvent(q,'status','Marked ready (skipped approval)');DB.saveQ(all,qid);DB.logActivity('quote.ready',q.quoteNum+' marked ready by '+getUserName());toast('Quote is Ready!','ok');notifyTeam('✅ '+q.quoteNum+' ready — '+getUserName());if(S.view==='editor'){S.etab=6;renderEditor();setTimeout(renderSendPane,100)}else{renderQuotes()}}
function quickApprove(qid){const all=DB.quotes();const q=all.find(x=>x.id===qid);if(!q)return;
q.status='ready';q.approvedBy=getUserName();q.approvedAt=new Date().toISOString();q.updatedAt=new Date().toISOString();
if(typeof bakePricing==='function')bakePricing(q);
logQuoteEvent(q,'status','Approved by '+getUserName());DB.saveQ(all,qid);DB.logActivity('quote.approved',q.quoteNum+' approved by '+getUserName());toast('Approved! → Ready','ok');notifyTeam('✅ '+q.quoteNum+' approved by '+getUserName());renderQuotes()}
function ceoApprove(qid){var _p=getMFXProfile();var _r=(_p.role||'').toLowerCase();var _allowed=['ceo','admin','administrator','owner','operations manager','manager'];if(!_allowed.includes(_r)){toast('Unauthorized — CEO or admin role required','err');return}var _confirm=confirm('Approve this quote as '+(_p.role||'Admin')+'?');if(!_confirm)return;{const all=DB.quotes();const q=all.find(x=>x.id===qid);if(!q)return;
var ceoNote=prompt('CEO notes (optional — shown to team):','');
q.status='ready';q.approvedBy='CEO';q.approvedAt=new Date().toISOString();q.updatedAt=new Date().toISOString();
if(typeof bakePricing==='function')bakePricing(q);
if(!q.internalNotes)q.internalNotes=[];
q.internalNotes.push({id:'n'+Date.now(),text:'✅ CEO APPROVED - Quote is READY to send'+(ceoNote?' — Note: '+ceoNote:''),by:'CEO',at:new Date().toISOString(),mentions:[],replies:[]});
DB.saveQ(all,qid);DB.logActivity('quote.approved',q.quoteNum+' Rev '+q.rev+' CEO approved → Ready');toast('Approved → Ready!','ok');
logClientActivity(q.fields.custCo,'✅ '+q.quoteNum+' Rev '+q.rev+' CEO approved');
MFX.track('quote.approved',{quoteId:qid,quoteNum:q.quoteNum,rev:q.rev,company:q.fields.custCo,ceoNote:ceoNote});
notifyTeam('✅ CEO APPROVED: '+q.quoteNum+' Rev '+q.rev+' — '+(q.fields.custCo||'')+(ceoNote?' | Note: '+ceoNote:''));
// Notify requestor
if(q.createdBy){notifyTeam('📩 @'+q.createdBy.replace(/\s/g,'')+': Your quote '+q.quoteNum+' Rev '+q.rev+' was APPROVED by CEO'+(ceoNote?' — '+ceoNote:''))}
// Auto-send option
var autoSend=confirm('Quote approved! Do you want to auto-send to client now?\n\nClient: '+(q.fields.custCo||'—')+'\nEmail: '+(q.fields.custEmail||'not set'));
S.editId=qid;
if(autoSend&&q.fields.custEmail){S.etab=6;renderEditor();setTimeout(function(){renderSendPane();setTimeout(sendFromTab,500)},200)}
else{setTimeout(function(){autoSaveApproved(qid)},500);S.etab=6;renderEditor();setTimeout(renderSendPane,200)}
}}

function autoSaveApproved(qid){
var q=getQ(qid);if(!q)return;
// Save to Drive
if(typeof saveQuoteToDrive==='function'&&typeof getGoogleToken==='function'){
toast('Saving to Drive...','ok');
saveQuoteToDrive();}
// Add to Registry
setTimeout(function(){
if(typeof addToRegistry==='function'){
toast('Adding to Registry...','ok');
addToRegistry();}
},2000);
notifyTeam('✅ Quote '+q.quoteNum+' approved by CEO - saved to Drive + Registry')}
function edActions(){const q=getQ(S.editId);openModal(`<div class="modal-title">Actions</div>${q.status==='ready'?`<div style="background:#052e16;border:1px solid #16a34a;border-radius:8px;padding:10px;margin-bottom:10px;font-size:11px;color:#4ade80;text-align:center">✅ CEO Approved - Ready to Send</div><button class="btn btn-pr" onclick="closeModal();emailQuoteWithPDF()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Email Quote to Client</button><button class="btn btn-ghost" onclick="closeModal();openQuoteSendMenu()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> All Send Options</button>`:``}${q.status==='approval'?`<button class="btn btn-pr" onclick="closeModal();ceoApprove('${q.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> CEO Approve</button>`:``}${q.status==='draft'?`<button class="btn btn-ghost" style="border:1px solid #c4b5fd;color:#c4b5fd" onclick="closeModal();submitForApproval('${q.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Submit for Approval</button><button class="btn btn-pr" onclick="closeModal();markReadyDirect('${q.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Mark Ready (Skip Approval)</button>`:''}${q.status==='approval'?`<button class="btn btn-pr" onclick="closeModal();quickApprove('${q.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Approve</button><button class="btn btn-rd" onclick="closeModal();setQStatus('${q.id}','rejected')">✕ Reject</button>`:''}<button class="btn btn-ghost" onclick="closeModal();dupQuote('${q.id}',true)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> New Revision</button><button class="btn btn-ghost" onclick="closeModal();dupQuote('${q.id}',false)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Duplicate</button><button class="btn btn-ghost" onclick="closeModal();inviteCollaborator()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Invite Collaborator</button><button class="btn btn-ghost" onclick="closeModal();scheduleMeeting(S.editId)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Schedule Meeting</button><button class="btn btn-or" onclick="closeModal();saveTpl()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Save Template</button><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`)}
function loadCust(cid){if(!cid)return;const c=DB.customers().find(x=>x.id===cid);if(!c)return;
const s=(f,v)=>{const e=document.querySelector('[data-field="'+f+'"]');if(e)e.value=v||''};
// Auto-fill ALL customer fields
s('custCo',c.company);s('custAttn',c.contact);s('custPhone',c.phone||c.email);s('custEmail',c.email||'');
s('industry',c.industry||'');s('cityState',c.address?c.address.split(',').slice(-2).join(',').trim():'');
s('shipTo',c.address||'');s('clientCode',c.zohoId?'MFX-'+c.id.replace('c',''):'');
// Auto-fill payment terms from customer defaults
if (c.defaultTerms) {
  var payEl = document.querySelector('[data-field="payTerms"]');
  if (payEl) { payEl.value = c.defaultTerms; }
}
// Auto-fill account number
if (c.accountNum) {
  var acctEl = document.querySelector('[data-field="clientCode"]');
  if (acctEl && (!acctEl.value || acctEl.value === 'MFX-000-00')) { acctEl.value = c.accountNum; }
}
const si=$('custSearch');if(si)si.value=c.company;const dd=$('custDD');if(dd)dd.style.display='none';asave();
// Check data completeness and prompt for points
var filled=0;var total=7;
if(c.company)filled++;if(c.contact)filled++;if(c.phone)filled++;if(c.email)filled++;if(c.industry)filled++;if(c.address)filled++;if(c.zohoId)filled++;
if(filled<total){var missing=[];if(!c.contact)missing.push('Contact');if(!c.phone)missing.push('Phone');if(!c.email)missing.push('Email');if(!c.industry)missing.push('Industry');if(!c.address)missing.push('Address');
toast('⚡ Complete '+missing.join(', ')+' to earn +0.5 pts!','info')}
// Render mini client dashboard
renderClientMiniDash(c)}

function renderClientMiniDash(c){
var el=$('clientMiniDash');if(!el)return;
var co=c.company.toLowerCase();
var qs=DB.quotes().filter(function(q){return q.fields.custCo&&q.fields.custCo.toLowerCase()===co});
var won=qs.filter(function(q){return q.status==='won'}).length;
var sent=qs.filter(function(q){return q.status==='sent'}).length;
var lost=qs.filter(function(q){return q.status==='lost'}).length;
var total=qs.length;
var revenue=qs.filter(function(q){return q.status==='won'}).reduce(function(s,q){return s+(q.wonAmount||0)},0);
var sos=(typeof getSalesOrders==='function')?getSalesOrders().filter(function(s){return s.company&&s.company.toLowerCase()===co}):[];
var jps=(typeof getPassports==='function')?getPassports().filter(function(p){return p.company&&p.company.toLowerCase()===co}):[];

// Client health score (0-100)
var score=50;
if(won>0)score+=won*8;
if(lost>0)score-=lost*5;
if(total>3)score+=5;
if(sos.length)score+=10;
if(jps.length)score+=5;
// Check client feedback/ratings stored on customer
if(c.healthScore)score=c.healthScore;
score=Math.max(0,Math.min(100,score));
var meterColor=score>=70?'var(--gn)':score>=40?'var(--or)':'var(--rd)';
var meterLabel=score>=70?'Strong':score>=40?'Needs Attention':'At Risk';

// Last activity
var lastActivity='No activity';
if(qs.length){var latest=qs.sort(function(a,b){return(b.updatedAt||'').localeCompare(a.updatedAt||'')})[0];lastActivity=fD(latest.updatedAt)+' — '+esc(latest.quoteNum)+' ('+esc(latest.status)+')'}

// Last communication
var lastComm='No communications';
qs.forEach(function(q){(q.internalNotes||[]).forEach(function(n){if(n.text&&n.text.indexOf('📧')>=0&&n.at>lastComm)lastComm=fD(n.at)+' — '+n.text.substring(0,60)})});

// Bulletin entries
var bulletins=c.bulletins||[];

var h='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:12px;margin-top:10px">';
h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700;color:var(--ac)">'+esc(c.company)+' — Client Dashboard</span><button class="btn btn-ghost btn-xs" onclick="viewCustFromQ()">Full Profile →</button></div>';

// Stats row
h+='<div style="display:flex;gap:6px;margin-bottom:8px">';
h+='<div style="flex:1;background:var(--bg2);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--tx)">'+total+'</div><div style="font-size:8px;color:var(--tx3)">Quotes</div></div>';
h+='<div style="flex:1;background:var(--bg2);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--neon-cyan)">'+sent+'</div><div style="font-size:8px;color:var(--tx3)">Sent</div></div>';
h+='<div style="flex:1;background:var(--bg2);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--gn)">'+won+'</div><div style="font-size:8px;color:var(--tx3)">Won</div></div>';
h+='<div style="flex:1;background:var(--bg2);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--gn)">$'+revenue.toLocaleString()+'</div><div style="font-size:8px;color:var(--tx3)">Revenue</div></div>';
h+='<div style="flex:1;background:var(--bg2);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:'+meterColor+'">'+score+'</div><div style="font-size:8px;color:var(--tx3)">Health</div></div>';
h+='</div>';

// Health meter bar
h+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px"><span style="color:var(--tx3)">Client Health</span><span style="color:'+meterColor+';font-weight:700">'+meterLabel+' ('+score+')</span></div>';
h+='<div style="height:4px;background:var(--bdr);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+score+'%;background:'+meterColor+';border-radius:2px;transition:width .3s"></div></div>';
h+='<div style="display:flex;gap:4px;margin-top:4px"><button class="btn btn-ghost btn-xs" onclick="setClientHealth(\''+c.id+'\',\'up\')" style="font-size:9px">👍 +5</button><button class="btn btn-ghost btn-xs" onclick="setClientHealth(\''+c.id+'\',\'down\')" style="font-size:9px">👎 -5</button></div></div>';

// Last activity & comms
h+='<div style="font-size:10px;padding:4px 0;border-top:1px solid var(--bdr)"><span style="color:var(--tx3)">Last Activity:</span> <span style="color:var(--tx)">'+lastActivity+'</span></div>';
h+='<div style="font-size:10px;padding:4px 0;border-bottom:1px solid var(--bdr)"><span style="color:var(--tx3)">Last Comm:</span> <span style="color:var(--tx)">'+lastComm+'</span></div>';

// CEO Notes
h+='<div style="margin-top:8px"><div style="font-size:9px;font-weight:700;color:var(--or);letter-spacing:1px;margin-bottom:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> CEO NOTES</div>';
if(c.ceoNotes&&c.ceoNotes.length){c.ceoNotes.slice(0,3).forEach(function(n){h+='<div style="font-size:10px;color:var(--tx);padding:2px 0;border-bottom:1px solid var(--bdr)">'+esc(n.text)+' <span style="font-size:8px;color:var(--tx3)">'+fD(n.at)+'</span></div>'})}
h+='<button class="btn btn-ghost btn-xs" onclick="addCEONote(\''+c.id+'\')" style="margin-top:4px;font-size:9px">+ CEO Note</button></div>';

// Bulletin Board
h+='<div style="margin-top:8px;border-top:1px solid var(--bdr);padding-top:8px"><div style="font-size:9px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg> BULLETIN BOARD</div>';
if(bulletins.length){bulletins.slice(0,5).forEach(function(b){
  h+='<div style="background:var(--bg2);border-radius:4px;padding:6px;margin-bottom:4px;border-left:2px solid '+(b.priority==='high'?'var(--rd)':b.priority==='medium'?'var(--or)':'var(--ac)')+'">';
  h+='<div style="font-size:10px;font-weight:600;color:var(--tx)">'+esc(b.title)+'</div>';
  h+='<div style="font-size:9px;color:var(--tx2)">'+esc(b.text)+'</div>';
  h+='<div style="font-size:8px;color:var(--tx3);margin-top:2px">'+esc(b.by)+' · '+fD(b.at)+(b.related?' · Re: '+esc(b.related):'')+(b.mentions?' · '+esc(b.mentions):'')+'</div>';
  h+='</div>';
})}
h+='<button class="btn btn-ghost btn-xs" onclick="addBulletinEntry(\''+c.id+'\')" style="margin-top:4px;font-size:9px">+ Post to Bulletin</button>';
h+='</div></div>';

el.innerHTML=h}

function setClientHealth(cid,dir){
  var _p2=getMFXProfile();var _r2=(_p2.role||'').toLowerCase();if(!['ceo','admin','administrator','owner','operations manager','manager'].includes(_r2)){toast('Unauthorized — admin role required','err');return}
  var all=DB.customers();var c=all.find(function(x){return x.id===cid});if(!c)return;
  c.healthScore=Math.max(0,Math.min(100,(c.healthScore||50)+(dir==='up'?5:-5)));
  DB.saveC(all);toast('Health → '+c.healthScore,'ok');
  renderClientMiniDash(c)}

function addCEONote(cid){
  var _p3=getMFXProfile();var _r3=(_p3.role||'').toLowerCase();if(!['ceo','admin','administrator','owner','operations manager','manager'].includes(_r3))return toast('Unauthorized — CEO or admin role required','err');
  var text=prompt('CEO note for this client:');if(!text)return;
  var all=DB.customers();var c=all.find(function(x){return x.id===cid});if(!c)return;
  if(!c.ceoNotes)c.ceoNotes=[];
  c.ceoNotes.unshift({text:text,at:new Date().toISOString(),by:'CEO'});
  DB.saveC(all);toast('CEO note added','ok');renderClientMiniDash(c)}

function addBulletinEntry(cid){
  var q=getQ(S.editId);
  var h2='<div class="modal-title">Post to Client Bulletin</div>';
  h2+='<div class="fg"><label>Title</label><input id="bb-title" placeholder="Meeting follow-up, pricing note, etc."></div>';
  h2+='<div class="fg"><label>@ Tag Team Member</label><input id="bb-mentions" placeholder="@randy @maria"></div>';
  h2+='<div class="fg"><label>Related To</label><select id="bb-related"><option value="">General</option>';
  if(q)h2+='<option value="'+esc(q.quoteNum)+'" selected>'+esc(q.quoteNum)+'</option>';
  var co=(q&&q.fields.custCo)?q.fields.custCo.toLowerCase():'';
  DB.quotes().filter(function(qq){return qq.fields.custCo&&qq.fields.custCo.toLowerCase()===co&&qq.id!==(q?q.id:'')}).slice(0,10).forEach(function(qq){
    h2+='<option value="'+esc(qq.quoteNum)+'">'+esc(qq.quoteNum)+' ('+esc(qq.status)+')</option>';
  });
  h2+='</select></div>';
  h2+='<div class="fg"><label>Priority</label><select id="bb-priority"><option value="normal">Normal</option><option value="medium">Medium</option><option value="high">High</option></select></div>';
  h2+='<div class="fg"><label>Message</label><textarea id="bb-text" placeholder="Share context, instructions, updates..." style="min-height:80px"></textarea></div>';
  h2+='<button class="btn btn-pr" onclick="saveBulletinEntry(\''+cid+'\')" style="width:100%">Post</button>';
  h2+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h2)}

function saveBulletinEntry(cid){
  var title=($('bb-title')||{}).value;var text=($('bb-text')||{}).value;
  if(!title||!text)return toast('Title and message required','err');
  var mentions=($('bb-mentions')||{}).value;var related=($('bb-related')||{}).value;var priority=($('bb-priority')||{}).value;
  var all=DB.customers();var c=all.find(function(x){return x.id===cid});if(!c)return;
  if(!c.bulletins)c.bulletins=[];
  c.bulletins.unshift({title:title,text:text,mentions:mentions,related:related,priority:priority,by:getUserName(),at:new Date().toISOString()});
  DB.saveC(all);closeModal();toast('Posted to bulletin','ok');
  if(mentions)notifyTeam('📌 '+getUserName()+' posted about '+c.company+': '+title+(mentions?' '+mentions:''));
  renderClientMiniDash(c)}
function filterCustDD(q){const dd=$('custDD');if(!dd)return;const cs=DB.customers();const f=q?cs.filter(c=>(c.company+' '+c.contact+' '+(c.industry||'')).toLowerCase().includes(q.toLowerCase())).slice(0,20):cs.slice(0,20);dd.innerHTML=f.map(c=>`<div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--bdr);font-size:12px" onmousedown="loadCust('${c.id}')"><strong>${esc(c.company)}</strong><br><span style="color:var(--tx3);font-size:10px">${esc(c.contact)||''} ${c.industry?'· '+esc(c.industry):''}</span></div>`).join('')+(f.length>=20?'<div style="padding:6px 12px;color:var(--tx3);font-size:10px;text-align:center">Type more to narrow results...</div>':'');dd.style.display='block'}
document.addEventListener('click',e=>{const dd=$('custDD');const si=$('custSearch');if(dd&&si&&!dd.contains(e.target)&&e.target!==si)dd.style.display='none'})
function saveCustFromQ(){saveQ();const q=getQ(S.editId);if(!q||!q.fields.custCo){toast('Enter company first','err');return}
var existing=DB.customers().find(function(x){return x.company.toLowerCase()===q.fields.custCo.toLowerCase()});
if(existing){existing.contact=q.fields.custAttn||existing.contact;existing.phone=q.fields.custPhone||existing.phone;existing.email=q.fields.custEmail||existing.email;existing.industry=q.fields.industry||existing.industry;saveCust(existing);toast('Customer updated','ok')}
else{saveCust({id:'c'+Date.now(),company:q.fields.custCo,contact:q.fields.custAttn||'',phone:q.fields.custPhone||'',email:q.fields.custEmail||'',industry:q.fields.industry||'',address:q.fields.cityState||'',notes:[],zohoId:''})}}
function viewCustFromQ(){saveQ();const q=getQ(S.editId);if(!q||!q.fields.custCo)return toast('No customer','err');const c=DB.customers().find(x=>x.company.toLowerCase()===q.fields.custCo.toLowerCase());if(c){S.profileId=c.id;openProfile(c.id)}else{toast('Customer not saved yet','err')}}
// MATERIALS
function buildMS(id,def){const sel=$(id);if(!sel)return;sel.innerHTML='';const oC=document.createElement('option');oC.value='CUSTOM';oC.textContent='- Custom -';sel.appendChild(oC);const oN=document.createElement('option');oN.value='NA';oN.textContent='NA';sel.appendChild(oN);
const vs=[...new Set(MATS.map(m=>m.v))];for(const v of vs){const og=document.createElement('optgroup');og.label=v;MATS.filter(m=>m.v===v).forEach(m=>{const o=document.createElement('option');o.value=m.s;o.textContent=m.s+' - '+m.d;if(m.m!=null)o.dataset.m=m.m;if(m.mk!=null)o.dataset.mk=m.mk;if(m.s===def)o.selected=true;og.appendChild(o)});sel.appendChild(og)}}
function edMat(field,fromChange){const selId=field==='faceStock'?'ed-fs':'ed-lam';const sel=$(selId);if(!sel)return;const opt=sel.options[sel.selectedIndex];const badge=$('msi-'+field);
const q=getQ(S.editId);
if(opt&&opt.dataset.m){const msi=parseFloat(opt.dataset.m);badge.textContent='MSI $'+msi.toFixed(3);badge.style.display='inline';if(field==='faceStock'&&fromChange&&!(q&&q.pricingLocked)){const mf=document.querySelector('[data-field="msiCost"]');if(mf)mf.value=msi.toFixed(4);if(opt.dataset.mk){const mk=document.querySelector('[data-field="mkupPct"]');if(mk)mk.value=(parseFloat(opt.dataset.mk)*100).toFixed(1)}}}else{badge.style.display='none'}asave()}


function emailQuote(){var q=getQ(S.editId);if(!q)return;
var tpls=[
{name:'Send Quote',subject:'Your Microflex Quote: {quoteNum} REV {rev} is ready!',body:'Dear {contact},\n\nPlease find your quote details below:\n\nQuote: {quoteNum} Rev {rev}\nJob: {jobDesc}\nType: {jobType}\nEstimator: {estimator}\n\nPlease review and let us know if you have any questions or would like to proceed.\n\nBest regards,\n{estimator}\nMicroflex Film Corporation\n909-360-9066 · Quotes@MicroflexFilm.com'},
{name:'Follow Up (7 Day)',subject:'Following up on your Microflex Quote: {quoteNum} REV {rev}',body:'Dear {contact},\n\nI wanted to follow up on Quote {quoteNum} sent for {company}.\n\nPlease let us know if you have any questions or need any revisions.\n\nBest regards,\n{estimator}\nMicroflex Film Corporation\n909-360-9066'},
{name:'Request Info',subject:'Additional info needed for Microflex Quote: {quoteNum} REV {rev}',body:'Dear {contact},\n\nThank you for your quote request. To proceed with {quoteNum}, we need some additional information:\n\n- [specify what you need]\n\nPlease send this at your earliest convenience.\n\nBest regards,\n{estimator}\nMicroflex Film Corporation'}
];
var vars={'{quoteNum}':q.quoteNum,'{rev}':q.rev,'{contact}':q.fields.custAttn||'Customer','{company}':q.fields.custCo||'','{jobDesc}':q.fields.jobDesc||'','{jobType}':q.fields.jobType||'','{estimator}':q.fields.estimator||getUserName(),'{email}':q.fields.custEmail||'','{date}':new Date().toLocaleDateString()};
function fillTpl(s){Object.keys(vars).forEach(function(k){s=s.split(k).join(vars[k])});return s}
var h='<div class="modal-title">Email Quote</div>';
h+='<div class="fg"><label>To</label><input id="em-to" value="'+esc(q.fields.custEmail||'')+'"></div>';
h+='<div class="fg"><label>Template</label><select id="em-tpl" onchange="fillEmailTpl()">';
tpls.forEach(function(t,i){h+='<option value="'+i+'">'+t.name+'</option>'});
h+='</select></div>';
h+='<div class="fg"><label>Subject</label><input id="em-subj" value="'+fillTpl(tpls[0].subject)+'"></div>';
h+='<div class="fg"><label>Message</label><textarea id="em-body" style="min-height:120px">'+fillTpl(tpls[0].body)+'</textarea></div>';
h+='<button class="btn btn-pr" onclick="sendQuoteEmail()" style="width:100%;margin-top:8px">Send via Gmail</button>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
window._emailTpls=tpls;window._emailVars=vars;window._emailFill=fillTpl;
openModal(h);return}
function fillEmailTpl(){var i=parseInt(($('em-tpl')||{}).value||0);var t=window._emailTpls[i];if(!t)return;$('em-subj').value=window._emailFill(t.subject);$('em-body').value=window._emailFill(t.body)}
// _oldSendQuoteEmail removed - dead code
function sendQuoteEmail(){
var to=($('em-to')||{}).value;var subj=($('em-subj')||{}).value;var body=($('em-body')||{}).value;
if(!to)return toast('Email required','err');
var q=getQ(S.editId);
toast('Generating PDF for attachment...','ok');
generateQuotePDF(q).then(function(pdf){
// Build MIME multipart message with PDF attachment
var boundary='mfx_boundary_'+Date.now();
var htmlBody='<table cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;margin:0 auto;font-family:Arial,sans-serif;background:#060d14"><tr><td style="height:3px;background:#00e5ff;font-size:0">&nbsp;</td></tr><tr><td style="padding:16px 24px;text-align:center;border-bottom:1px solid #0f1d2b"><div style="font-size:24px;font-weight:900;color:#e0f2fe">Microflex</div><div style="width:70px;height:2px;background:#00e5ff;margin:4px auto"></div><div style="font-size:8px;color:#00838f;letter-spacing:4px">FILM CORPORATION</div></td></tr><tr><td style="padding:5px 24px;background:#0a2e3e;text-align:center;font-size:7px;color:#00e5ff;letter-spacing:1px;border-bottom:1px solid #0f1d2b">FLEXIBLE PACKAGING &nbsp;|&nbsp; LABELS &nbsp;|&nbsp; POUCHES &nbsp;|&nbsp; SHRINK SLEEVES</td></tr><tr><td style="padding:16px 24px;font-size:14px;color:#94a3b8;line-height:1.6">'+body.replace(/\n/g,'<br>')+'</td></tr><tr><td style="padding:12px 24px;text-align:center"><a href="https://mfx-2026.web.app/portal?q='+q.quoteNum+'" style="display:block;text-align:center;padding:14px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;background-color:#00e5ff;color:#060d14">Approve Quote &amp; Submit PO</a></td></tr><tr><td style="padding:10px 24px;text-align:center;font-size:9px;color:#3a5060;border-top:1px solid #0f1d2b">Microflex Film Corporation &middot; 4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 &middot; Quotes@MicroflexFilm.com<br>SQF Certified | Made in USA</td></tr></table>';
var raw='Content-Type: multipart/mixed; boundary="'+boundary+'"\r\n';
raw+='To: '+to+'\r\nSubject: '+subj+'\r\nMIME-Version: 1.0\r\n\r\n';
raw+='--'+boundary+'\r\n';
raw+='Content-Type: text/html; charset=utf-8\r\n\r\n';
raw+=htmlBody+'\r\n\r\n';
raw+='--'+boundary+'\r\n';
raw+='Content-Type: application/pdf; name="'+pdf.filename+'"\r\n';
raw+='Content-Disposition: attachment; filename="'+pdf.filename+'"\r\n';
raw+='Content-Transfer-Encoding: base64\r\n\r\n';
raw+=pdf.base64+'\r\n';
raw+='--'+boundary+'--';
var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
getGoogleToken().then(function(token){if(!token)return toast('Gmail not connected','err');
fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({raw:encoded})
}).then(function(r){return r.json()}).then(function(data){
if(data.id){toast('Email sent with PDF!','ok');closeModal();updateRegistry(S.editId,'Emailed');
if(q){q.sentAt=q.sentAt||new Date().toISOString();if(!q.workflow)q.workflow={};q.workflow.emailSent=true;q.workflow.registryUpdated=true;if(!q.internalNotes)q.internalNotes=[];q.internalNotes.push({id:'n'+Date.now(),text:'📧 Emailed to '+to+' with PDF attached - '+subj,by:getUserName(),at:new Date().toISOString(),mentions:[],replies:[]});var all=DB.quotes();DB.saveQ(all,q.id);if(typeof renderWorkflow==='function')renderWorkflow()}}
else{toast('Email error','err')}
}).catch(function(e){toast('Error: '+e.message,'err')})}
)}).catch(function(e){toast('PDF error: '+e,'err')})}

function sendAndSaveToDrive(){
sendQuoteEmail();
setTimeout(function(){saveQuoteToDrive()},1000)}

function saveAndEmail(){
saveQuoteToDrive();
setTimeout(function(){emailQuoteWithPDF()},1500)}

function addToRegistry(){
upsertRegistryRow(S.editId,'Manual add/update')}

function upsertRegistryRow(qid,action){
var q=getQ(qid);if(!q)return;var f=q.fields;
getGoogleToken().then(function(token){if(!token)return toast('Sign out and back in','err');
findOrCreateRegistry(token).then(function(sheetId){
if(!sheetId)return toast('Could not access registry','err');
// ALWAYS search for existing row by quote number first
fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/Sheet1!A:A',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(data){
var rowIdx=-1;
if(data.values){data.values.forEach(function(r,i){if(r[0]===q.quoteNum&&r[1]===q.rev)rowIdx=i})}
var pricing=getQuotePricingForRegistry(q);
var row=[
q.quoteNum,q.rev,q.status,f.quoteDate||'',f.estimator||'',f.salesRep||'',f.jobType||'',
f.custCo||'',f.custAttn||'',f.custPhone||'',f.custEmail||'',f.jobDesc||'',
f.copyPos||'',f.shapeType||'',f.sA||'',f.sar||'',f.nAcross||'',f.nAround||'',f.colors||'',
f.gA||'',f.gar||'',f.cRad||'',f.nCopies||'',f.nPlates||'',f.offCuts||'',
f.labRoll||'',f.maxOD||'',f.windDir||'',f.coreDia||'',
f.faceStock||'',f.lamination||'',f.liner||'',f.adhesive||'',f.coating||'',f.otherMat||'',
f.msiCost||'',f.stockMgn||'',f.matSetup||'',f.mkupPct||'',f.cppPlate||'',f.plPerSku||'',
f.ccCost||'',f.nCC||'',f.mrHrs||'',f.mrRate||'',f.cuHrs||'',f.cuRate||'',
f.dieChg||'',f.plCost||'',f.repPct||'',f.payTerms||'',f.notes||'',
(q.qtys||[]).join(', '),q.wonAmount||'',q.lostReason||'',
q.createdBy||'',q.createdAt||'',q.updatedAt||'',q.sentAt||'',
q.approvedBy||'',q.approvedAt||'',new Date().toISOString(),action||'',
q.poNumber||'',q.wonSKUs||'',q.wonQty||'',q.expectedDelivery||'',
pricing.qtyBreakdown,pricing.totalPerQty,pricing.ppuPerQty,pricing.setupTotal,pricing.materialWW];

if(rowIdx>0){
// UPDATE existing row - same quote number
var range='Sheet1!A'+(rowIdx+1);
fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/'+range+'?valueInputOption=USER_ENTERED',{
method:'PUT',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({values:[row]})
}).then(function(r){return r.json()}).then(function(res){
// console.log('Registry row UPDATED at row '+(rowIdx+1));
toast('Registry updated (row '+(rowIdx+1)+')','ok');
logRegistryActivity(q,'Updated',action)
}).catch(function(e){ /* Registry update err */ })}
else{
// APPEND new row - first time for this quote number
fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/Sheet1:append?valueInputOption=USER_ENTERED',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({values:[row]})
}).then(function(r){return r.json()}).then(function(res){
// console.log('Registry row APPENDED');
toast('Added to registry','ok');
logRegistryActivity(q,'Created',action)
}).catch(function(e){ /* Registry append err */ })}
}).catch(function(e){ /* Registry search err */ })})}).catch(function(){toast('Token error','err')})}

function logRegistryActivity(q,type,action){
if(!q)return;if(!q.internalNotes)q.internalNotes=[];
q.internalNotes.push({id:'n'+Date.now(),text:'📊 Registry '+type+': '+(action||'updated')+' - '+q.quoteNum+' Rev '+q.rev,by:getUserName(),at:new Date().toISOString(),mentions:[],replies:[]});
logQuoteEvent(q,'registry',type+': '+action);
var all=DB.quotes();DB.saveQ(all,q.id)}

function findOrCreateRegistry(token){
// console.log('Finding registry in MFX-CORE/Quotes...');
return findQuotesFolder(token).then(function(quotesFolder){
// Search for MFX Quote Registry inside Quotes folder
var q='name=\'MFX Quote Registry\' and mimeType=\'application/vnd.google-apps.spreadsheet\' and trashed=false';
if(quotesFolder)q+=' and \''+quotesFolder+'\' in parents';
return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(data){
if(data.files&&data.files.length>0){ /* Found registry */
return data.files[0].id}
// Create new sheet with headers inside Quotes folder
var sheetMeta={properties:{title:'MFX Quote Registry'},sheets:[{data:[{rowData:[{values:['Quote #','Rev','Status','Quote Date','Estimator','Sales Rep','Job Type','Company','Contact','Phone','Email','Job Description','Copy Position','Shape','Size Across','Size Around','# Across','# Around','Colors','Gap Across','Gap Around','Corner Radius','# Copies','# Plates','Off Cuts','Labels/Roll','Max OD','Wind Dir','Core Dia','Face Stock','Lamination','Liner','Adhesive','Coating','Other Material','MSI Cost','Stock Margin','Material Setup','Markup %','CPP Plate','Plates/SKU','CC Cost','# Color Changes','Makeready Hrs','Makeready Rate','CU Hrs','CU Rate','Die Charge','Plate Cost','Reprint %','Pay Terms','Notes','Quantities','Won Amount','Lost Reason','Created By','Created At','Updated At','Sent At','Approved By','Approved At','Registry Date','Last Action','PO Number','# SKUs','Qty Chosen','Expected Delivery','Qty Breakdown','Total per Qty (1 SKU)','Price per Unit','Setup Total','Material WW'].map(function(h){return{userEnteredValue:{stringValue:h}}})}]}]}]};
return fetch('https://sheets.googleapis.com/v4/spreadsheets',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify(sheetMeta)
}).then(function(r){return r.json()}).then(function(s){
if(s.spreadsheetId&&quotesFolder){
// Move sheet into Quotes folder
fetch('https://www.googleapis.com/drive/v3/files/'+s.spreadsheetId+'?addParents='+quotesFolder+'&supportsAllDrives=true',{
method:'PATCH',headers:{'Authorization':'Bearer '+token}}).catch(function(e){console.warn('op:',e)})}
/* Created registry */ return s.spreadsheetId||null})
})}).catch(function(e){ /* Registry err */ return null})}

function getQuoteFileName(q){var n=new Date();var mm=(n.getMonth()+1<10?'0':'')+(n.getMonth()+1);var dd=(n.getDate()<10?'0':'')+n.getDate();var co=(q.fields.custCo||'Quote').replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,' ').trim().replace(/\s/g,'-');var desc=q.description?(q.description.replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,' ').trim().replace(/\s/g,'-').substring(0,50)):'';return q.quoteNum+'-'+q.rev+'-'+co+(desc?'-'+desc:'')+'-'+mm+'-'+dd}

function generateQuotePDF(q){
if(typeof edPreview==='function') edPreview();
return new Promise(function(resolve,reject){
var pg=document.getElementById('quotePage');if(!pg){reject('No quote page');return}
var container=document.createElement('div');
container.style.cssText='position:fixed;top:-9999px;left:-9999px;width:800px;background:#fff;padding:20px;color:#000;font-family:Arial,sans-serif';
container.innerHTML=pg.innerHTML.replace(/color:var\(--[^)]+\)/g,'color:#333').replace(/background:var\(--[^)]+\)/g,'background:#fff').replace(/class="qsig"[^<]*<[^>]*>.*?<\/div><\/div>/g,'');
document.body.appendChild(container);
html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then(function(canvas){
document.body.removeChild(container);
var imgData=canvas.toDataURL('image/jpeg',0.95);
var pdf=new jspdf.jsPDF('p','mm','letter');
var pdfW=pdf.internal.pageSize.getWidth();
var imgW=pdfW-20;var imgH=(canvas.height*imgW)/canvas.width;
pdf.addImage(imgData,'JPEG',10,10,imgW,imgH);
var pdfBlob=pdf.output('blob');var pdfBase64=pdf.output('datauristring').split(',')[1];
resolve({blob:pdfBlob,base64:pdfBase64,filename:getQuoteFileName(q)+'.pdf'})
}).catch(function(e){document.body.removeChild(container);reject(e)})})}

function findOrCreateSharedFolder(token,folderName){
// Search for MFX-CORE shared drive first
return fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(drives){
var mfxDrive=null;
if(drives.drives){drives.drives.forEach(function(d){if(d.name.indexOf('MFX')>=0)if(!mfxDrive)mfxDrive=d.id})}
console.log('[Drive] Shared drive:',mfxDrive,drives.drives?drives.drives.map(function(d){return d.name}):[]);
if(!mfxDrive){toast('MFX shared drive not found — saving to My Drive','warn');console.warn('[Drive] No MFX shared drive found')}
// Search for Quotes folder
var q='name=\'Quotes\' and mimeType=\'application/vnd.google-apps.folder\' and trashed=false';
if(mfxDrive)q+=' and \''+mfxDrive+'\' in parents';
return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(qData){
var quotesFolder=(qData.files&&qData.files.length)?qData.files[0].id:null;
console.log('[Drive] Quotes folder:',quotesFolder);
if(!quotesFolder&&mfxDrive){
// Create Quotes folder in shared drive root
console.log('[Drive] Creating Quotes folder in shared drive...');
return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({name:'Quotes',mimeType:'application/vnd.google-apps.folder',parents:[mfxDrive]})
}).then(function(r){return r.json()}).then(function(cf){
console.log('[Drive] Created Quotes folder:',cf.id);
if(!cf.id){console.error('[Drive] Failed to create Quotes folder:',cf);return null}
// Now create subfolder inside Quotes
return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({name:folderName,mimeType:'application/vnd.google-apps.folder',parents:[cf.id]})
}).then(function(r2){return r2.json()}).then(function(sf){console.log('[Drive] Created '+folderName+':',sf.id);return sf.id||null})
})}
if(!quotesFolder){console.warn('[Drive] No Quotes folder found and no shared drive to create in');return null}
// Search for MFX Master Quotes inside Quotes folder
return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent('name=\''+folderName+'\' and mimeType=\'application/vnd.google-apps.folder\' and \''+quotesFolder+'\' in parents and trashed=false')+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(mData){
if(mData.files&&mData.files.length){console.log('[Drive] Found '+folderName+':',mData.files[0].id);return mData.files[0].id}
// Create MFX Master Quotes inside Quotes
console.log('[Drive] Creating '+folderName+' inside Quotes...');
return fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({name:folderName,mimeType:'application/vnd.google-apps.folder',parents:[quotesFolder]})
}).then(function(r){return r.json()}).then(function(f){console.log('[Drive] Created '+folderName+':',f.id);return f.id||null})
})})}).catch(function(e){console.error('[Drive] Folder search error:',e);toast('Drive folder error: '+e.message,'err');return null})}

function findQuotesFolder(token){
return fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(drives){
var mfxDrive=null;
if(drives.drives){drives.drives.forEach(function(d){if(d.name==='MFX-CORE')mfxDrive=d.id})}
var q='name=\'Quotes\' and mimeType=\'application/vnd.google-apps.folder\' and trashed=false';
if(mfxDrive)q+=' and \''+mfxDrive+'\' in parents';
return fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(data){
return(data.files&&data.files.length)?data.files[0].id:null})
}).catch(function(e){console.warn('findQuotesFolder:',e);return null})}

function saveQuoteToDrive(){
var q=getQ(S.editId);if(!q)return;
toast('Generating PDF...','ok');
generateQuotePDF(q).then(function(pdf){
getGoogleToken().then(function(token){if(!token)return toast('Sign out and back in','err');
findOrCreateSharedFolder(token,'MFX Master Quotes').then(function(folderId){
if(!folderId)console.warn('[Drive] No shared folder found — will save to My Drive root');
// Search for existing file with same quote number to replace
var searchQ='name contains \''+q.quoteNum+'\' and trashed=false';
if(folderId)searchQ+=' and \''+folderId+'\' in parents';
fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(searchQ)+'&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(searchData){
var existingId=(searchData.files&&searchData.files.length>0)?searchData.files[0].id:null;

if(existingId){
// UPDATE existing file
var form=new FormData();
form.append('metadata',new Blob([JSON.stringify({name:pdf.filename,mimeType:'application/pdf'})],{type:'application/json'}));
form.append('file',pdf.blob,'application/pdf');
fetch('https://www.googleapis.com/upload/drive/v3/files/'+existingId+'?uploadType=multipart&supportsAllDrives=true',{
method:'PATCH',headers:{'Authorization':'Bearer '+token},body:form
}).then(function(r){return r.json()}).then(function(data){
if(data.id){toast('PDF updated in MFX Master Quotes!','ok');
upsertRegistryRow(S.editId,'PDF updated on Drive');
logDriveActivity(q,pdf.filename,'Updated');logClientActivity(q.fields.custCo,'☁ PDF saved: '+pdf.filename)}
else{toast('Drive update error','err')}}).catch(function(e){toast(e.message,'err')})}

else{
// CREATE new file
var metadata={name:pdf.filename,mimeType:'application/pdf'};
if(folderId)metadata.parents=[folderId];
var form=new FormData();
form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
form.append('file',pdf.blob,'application/pdf');
fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{
method:'POST',headers:{'Authorization':'Bearer '+token},body:form
}).then(function(r){return r.json()}).then(function(data){
if(data.id){toast('PDF saved to MFX Master Quotes!','ok');
upsertRegistryRow(S.editId,'PDF saved to Drive');
logDriveActivity(q,pdf.filename,'Created');logClientActivity(q.fields.custCo,'☁ PDF saved: '+pdf.filename)}
else{toast('Drive error','err')}}).catch(function(e){toast(e.message,'err')})}
}).catch(function(e){toast(e.message,'err')})})})
}).catch(function(e){toast('PDF error: '+e,'err')})}

function logDriveActivity(q,filename,type){
if(!q)return;if(!q.internalNotes)q.internalNotes=[];
q.internalNotes.push({id:'n'+Date.now(),text:'☁ Drive '+type+': '+filename,by:getUserName(),at:new Date().toISOString(),mentions:[],replies:[]});
logQuoteEvent(q,'drive',type+': '+filename);
var all=DB.quotes();DB.saveQ(all,q.id)}

function updateRegistry(qid,action){
upsertRegistryRow(qid,action)}

// ═══════ RESTORED FUNCTIONS ═══════

function openRFQRequest(){
var cs=DB.customers();
var h='<div class="modal-title">New Request</div>';
h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Submit a quote request to the Estimation team</div>';
h+='<div class="fg"><label>Client *</label><select id="rfq-co" onchange="rfqFillClient()"><option value="">- Select Client -</option>';
cs.forEach(function(c){h+='<option value="'+esc(c.company)+'">'+esc(c.company)+'</option>'});
h+='</select></div>';
h+='<div class="fg"><label>Or New Client</label><input id="rfq-newco" placeholder="New client name"></div>';
h+='<div class="fg"><label>Contact</label><input id="rfq-ct"></div>';
h+='<div class="fg"><label>Email</label><input id="rfq-em"></div>';
h+='<div class="fg"><label>Phone</label><input id="rfq-ph"></div>';
h+='<div id="rfq-client-info" style="font-size:10px;color:var(--tx3);margin-bottom:6px"><span id="rfq-industry"></span> <span id="rfq-addr"></span></div>';
h+='<div class="fg"><label>Request Type</label><select id="rfq-type"><option>Quote</option><option>Sample</option><option>Proof</option><option>R&D</option><option>Reorder</option></select></div>';
h+='<div class="fg"><label>Job Type</label><select id="rfq-job"><option>Flexographic</option><option>Digital</option><option>Stock</option></select></div>';
h+='<div class="fg"><label>Description *</label><textarea id="rfq-desc"></textarea></div>';
h+='<div class="fg"><label>Quantity</label><input id="rfq-qty" placeholder="e.g. 10000"></div>';
h+='<div class="fg"><label>Target Date</label><input id="rfq-date" type="date"></div>';
h+='<div class="fg"><label>Owner</label><input id="rfq-owner" value="'+getUserName()+'"></div>';
h+='<div class="fg"><label>Collaborators</label><div id="rfq-collabs-list"></div><select id="rfq-collab-add" onchange="addRFQCollab()"><option value="">+ Add collaborator</option>';
var users2=typeof getTeamUsers==='function'?getTeamUsers():['Randy','Marco R.','Alex M.','Chris W.'];
users2.forEach(function(u){h+='<option value="'+u+'">'+u+'</option>'});
h+='</select></div>';
window._rfqCollabs=[];
h+='<div class="fg"><label>Notes</label><textarea id="rfq-notes"></textarea></div>';
h+='<button class="btn btn-pr" onclick="submitRFQRequest()" style="width:100%;margin-top:8px">Submit Request</button>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
openModal(h)}

function addRFQCollab(){var sel=document.getElementById('rfq-collab-add');if(!sel||!sel.value)return;var name=sel.value;if(!window._rfqCollabs)window._rfqCollabs=[];if(window._rfqCollabs.indexOf(name)!==-1){sel.value='';return}window._rfqCollabs.push(name);sel.value='';var list=document.getElementById('rfq-collabs-list');if(list){list.innerHTML=window._rfqCollabs.map(function(c){return'<span style="display:inline-block;background:var(--bg3);color:var(--tx2);padding:2px 8px;border-radius:12px;font-size:10px;margin:2px 4px 2px 0">'+c+' <span style="cursor:pointer;color:var(--rd);font-weight:700" onclick="removeRFQCollab(\''+c+'\')">×</span></span>'}).join('')}}
function removeRFQCollab(name){if(!window._rfqCollabs)return;window._rfqCollabs=window._rfqCollabs.filter(function(c){return c!==name});addRFQCollab()}
function rfqFillClient(){var sel=$('rfq-co');if(!sel)return;var co=sel.value;if(!co)return;var cs=DB.customers();var c=cs.find(function(x){return x.company===co});if(c){if($('rfq-ct'))$('rfq-ct').value=c.contact||'';if($('rfq-em'))$('rfq-em').value=c.email||'';if($('rfq-ph'))$('rfq-ph').value=c.phone||'';if($('rfq-industry'))$('rfq-industry').textContent=c.industry||'';if($('rfq-addr'))$('rfq-addr').textContent=c.address||''}}

function submitRFQRequest(){var co=($('rfq-co')||{}).value||($('rfq-newco')||{}).value||'';if(!co)return toast('Client required','err');var desc=($('rfq-desc')||{}).value||'';if(!desc)return toast('Description required','err');var owner=($('rfq-owner')||{}).value||getUserName();var collabs=window._rfqCollabs||[];var rfq={company:co,contact:($('rfq-ct')||{}).value||'',email:($('rfq-em')||{}).value||'',phone:($('rfq-ph')||{}).value||'',requestType:($('rfq-type')||{}).value||'Quote',jobType:($('rfq-job')||{}).value||'Flexographic',description:desc,quantity:($('rfq-qty')||{}).value||'',targetDate:($('rfq-date')||{}).value||'',notes:($('rfq-notes')||{}).value||'',owner:owner,collaborators:collabs,submittedBy:getUserName(),status:'pending'};if(fbDb){fbDb.collection('requests').add(Object.assign(rfq,{submittedAt:firebase.firestore.FieldValue.serverTimestamp()})).then(function(){closeModal();toast('Request submitted!','ok');notifyTeam('📋 New request from '+getUserName()+': '+co);if(collabs.length)notifyTeam('👥 '+collabs.join(', ')+' added as collaborators on: '+co);if(rfq.targetDate&&typeof createCalendarEvent==='function')createCalendarEvent('📋 Request: '+co+' ('+rfq.requestType+')',desc,rfq.targetDate,'09:00',60)}).catch(function(e){toast(e.message,'err')})}}

function openRFQInbox(){
S.view='supportinbox';document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});$('v-supportinbox').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=function(){goView('dashboard')};$('hdrTitle').textContent='Request Hub';$('hdrActions').innerHTML='';if(typeof applyDeptTheme==='function')applyDeptTheme('clientservices');renderRequestHub()}

function renderRequestHub(){
var el=$('v-supportinbox');if(!el)return;
var h='<div style="text-align:center;margin-bottom:12px"><div style="font-size:22px;font-weight:800;color:var(--ac)">Request Hub</div><div style="font-size:10px;color:var(--tx3)">Tap a department to see available requests</div></div>';

var cats=[
{id:'client',icon:'🤝',name:'Client Relations',color:'#7c3aed',desc:'Quoting, sampling & new business',forms:[
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',name:'RFQ',desc:'Request for Quote',use:'Client needs pricing on a label or packaging job'},
{icon:'🧪',name:'Sampling',desc:'Sample Request',use:'Client wants printed samples before committing to an order'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',name:'Discovery',desc:'Pre-Quote Discovery',use:'Product doesn\'t exist yet - exploratory conversation with client'}]},

{id:'prepress',icon:'🎨',name:'Pre-Press',color:'#ec4899',desc:'Design, dielines, artwork & proofing',forms:[
{icon:'📐',name:'Dieline',desc:'Structural Design',use:'Need a new dieline, die layout, or structural design for a label'},
{icon:'⚙️',name:'Engineering',desc:'Technical / Product',use:'Material testing, adhesive compatibility, print feasibility study'},
{icon:'🖌',name:'Artwork',desc:'Creative Request',use:'Need artwork designed, revised, color separated, or preflighted'},
{icon:'🖨',name:'Proof',desc:'Proofing Request',use:'Need a digital, hard copy, or press proof sent to client'}]},

{id:'logistics',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',name:'Logistics',color:'#f59e0b',desc:'Inventory & purchasing',forms:[
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',name:'Inventory',desc:'Stock Check',use:'Check material availability, stock levels, or reorder status'},
{icon:'🛒',name:'Purchasing',desc:'Purchase Request',use:'Need to order materials, supplies, or equipment from a vendor'}]},

{id:'production',icon:'🏭',name:'Production',color:'#10b981',desc:'Status, quality & compliance',forms:[
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',name:'Status Report',desc:'Job Status',use:'Need an update on where a job is in the production process'},
{icon:'✅',name:'Quality',desc:'Quality Report',use:'Print defect, material issue, or quality inspection needed'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',name:'CAPA',desc:'Corrective Action',use:'Root cause analysis and corrective or preventive action needed'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',name:'SQF',desc:'Food Safety / Compliance',use:'SQF audit finding, HACCP issue, or GMP compliance concern'}]},

{id:'finance',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',name:'Finance',color:'#6366f1',desc:'A/R, POs & invoices',forms:[
{icon:'📑',name:'AR Report',desc:'Accounts Receivable',use:'Need aging report, payment status, or credit check on a client'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',name:'PO Check',desc:'Purchase Order',use:'Verify PO status, delivery date, or vendor confirmation'},
{icon:'🧾',name:'Invoice',desc:'Invoice Issue',use:'Amount discrepancy, missing invoice, or payment question'}]},

{id:'hr',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',name:'HR / Attendance',color:'#ef4444',desc:'Time off, sick days & corrections',forms:[
{icon:'🤒',name:'Sick Day',desc:'Call In Sick',use:'Reporting a sick day - notifies your supervisor immediately'},
{icon:'🏖',name:'Time Off',desc:'PTO / Vacation',use:'Requesting paid time off, personal day, bereavement, or jury duty'},
{icon:'⏰',name:'Late Notice',desc:'Late / Absent',use:'Running late, leaving early, or absent - notify your team'},
{icon:'🔧',name:'Clock Correction',desc:'Time Edit',use:'Missed punch, wrong time, or system error on your time clock'}]},

{id:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',name:'General',color:'#8b5cf6',desc:'Questions, training & access',forms:[
{icon:'❓',name:'Leadership Q',desc:'Ask Leadership',use:'Private or public question for CEO, Director, or a Lead'},
{icon:'📚',name:'Training',desc:'Request Training',use:'Need training on a machine, process, software, or procedure'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',name:'Meeting Request',desc:'Schedule Meeting',use:'Book time with someone - sets up calendar event automatically'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',name:'Access Request',desc:'System Access',use:'Need login, permissions, or content access to a tool or drive'},
{icon:'💡',name:'Suggestion',desc:'Ideas & Feedback',use:'Share a question, concern, suggestion, or compliment (can be anonymous)'}]}
];

cats.forEach(function(cat){
h+='<div style="margin-bottom:6px">';
h+='<div style="background:linear-gradient(135deg,'+cat.color+'15,'+cat.color+'08);border:1px solid '+cat.color+'40;border-radius:12px;padding:14px 16px;cursor:pointer;transition:all .2s" onclick="toggleReqCat(\'rq-'+cat.id+'\')">';
h+='<div style="display:flex;align-items:center;gap:12px"><div style="width:44px;height:44px;border-radius:12px;background:'+cat.color+'25;display:flex;align-items:center;justify-content:center;font-size:22px">'+cat.icon+'</div>';
h+='<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--tx)">'+cat.name+'</div><div style="font-size:10px;color:var(--tx3);margin-top:1px">'+cat.desc+'</div></div>';
h+='<div style="font-size:12px;color:var(--tx3);background:'+cat.color+'20;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center" id="rq-'+cat.id+'-arr">'+cat.forms.length+'</div></div></div>';

// Sub-forms
h+='<div id="rq-'+cat.id+'" style="display:none;padding:4px 0 0 56px">';
cat.forms.forEach(function(f){
h+='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;margin:4px 0;background:var(--bg3);border-radius:10px;border-left:3px solid '+cat.color+';cursor:pointer;transition:all .15s" onclick="openTypedRequest(\''+f.name+'\')" onmousedown="this.style.transform=\'scale(0.98)\'" onmouseup="this.style.transform=\'scale(1)\'">';
h+='<div style="width:32px;height:32px;border-radius:8px;background:'+cat.color+'20;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">'+f.icon+'</div>';
h+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--tx)">'+f.name+'</div>';
h+='<div style="font-size:10px;color:var(--ac);margin-top:1px">'+f.desc+'</div>';
h+='<div style="font-size:9px;color:var(--tx3);margin-top:3px;line-height:1.3">'+f.use+'</div></div>';
h+='<div style="color:'+cat.color+';font-size:14px;flex-shrink:0;margin-top:4px">›</div></div>'});
h+='</div></div>'});

h+='<div style="margin-top:14px"><button class="btn btn-ghost" onclick="openSubmittedRequests()" style="width:100%;padding:12px;border:1px dashed var(--bdr);border-radius:10px"><span style="font-size:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg></span> View My Submitted Requests</button></div>';
el.innerHTML=h}

function reqBtn(icon,title,desc,type){
return'<div style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="openTypedRequest(\''+type+'\')">'
+'<span style="font-size:18px">'+icon+'</span>'
+'<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">'+title+'</div>'
+'<div style="font-size:9px;color:var(--tx3)">'+desc+'</div></div>'
+'<span style="color:var(--tx3)">›</span></div>'}

function toggleReqCat(id){
var el=$(id);if(!el)return;
if(el.style.display==='none'){el.style.display='block';el.style.animation='fadeIn .2s'}
else{el.style.display='none'}}

function openTypedRequest(reqType){
var cs=DB.customers();
var users=typeof getTeamUsers==='function'?getTeamUsers():['Randy','Marco R.','Alex M.','Chris W.'];
var h='<div class="modal-title">'+reqType+' Request</div>';

// ═══ CLIENT RELATIONS ═══
if(reqType==='Quote'){
h+=clientFields(cs);
h+=fg('Job Type','<select id="rfq-job"><option>Flexographic</option><option>Digital</option><option>Stock</option><option>Lamination</option></select>');
h+=fg('Label Shape','<select id="rfq-shape"><option>Rectangle</option><option>Oval</option><option>Circle</option><option>Die-Cut</option><option>Custom</option></select>');
h+=fg('Estimated Size','<input id="rfq-size" placeholder="e.g. 4x6 inches">');
h+=fg('Number of Colors','<input id="rfq-colors" type="number" placeholder="e.g. 4">');
h+=fg('Substrate / Material','<input id="rfq-material" placeholder="e.g. White BOPP, Clear PE">');
h+=fg('Quantity Needed','<input id="rfq-qty" placeholder="e.g. 10000, 25000, 50000">');
h+=fg('Artwork Ready?','<select id="rfq-artready"><option>Yes</option><option>No - needs design</option><option>Partial</option></select>');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:50px" placeholder="Job details, special finishes, coatings..."></textarea>');
h+=dateAssignFields(users)}

else if(reqType==='Sample'){
h+=clientFields(cs);
h+=fg('Sample Type','<select id="rfq-stype"><option>Printed Sample</option><option>Blank Material</option><option>Finished Product</option><option>Color Match</option></select>');
h+=fg('Reference Quote #','<input id="rfq-refq" placeholder="If reprint or revision">');
h+=fg('Quantity of Samples','<input id="rfq-qty" placeholder="e.g. 50, 100">');
h+=fg('Ship To','<textarea id="rfq-shipto" placeholder="Address to ship samples"></textarea>');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:50px" placeholder="What samples are needed and why..."></textarea>');
h+=dateAssignFields(users)}

else if(reqType==='Discovery'){
h+=clientFields(cs);
h+=fg('Product Category','<select id="rfq-pcat"><option>Labels</option><option>Shrink Sleeves</option><option>Flexible Packaging</option><option>Pouches</option><option>Other</option></select>');
h+=fg('Target Market','<input id="rfq-market" placeholder="e.g. Food & Bev, Cannabis, Health">');
h+=fg('Estimated Volume','<input id="rfq-qty" placeholder="Annual or per-run estimate">');
h+=fg('Budget Range','<input id="rfq-budget" placeholder="e.g. $5K-$10K per run">');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:60px" placeholder="What product is this for? What doesn\'t exist yet? What are they trying to achieve?"></textarea>');
h+=dateAssignFields(users)}

// ═══ PRE-PRESS ═══
else if(reqType==='Dieline'){
h+=fg('Client / Job','<input id="rfq-co" placeholder="Client or internal project">');
h+=fg('Label Dimensions','<input id="rfq-size" placeholder="Width x Height (e.g. 4 x 6)">');
h+=fg('Shape','<select id="rfq-shape"><option>Rectangle</option><option>Oval</option><option>Circle</option><option>Custom Die-Cut</option><option>Wrap-Around</option></select>');
h+=fg('Corner Radius','<input id="rfq-corners" placeholder="e.g. 0.125 inches">');
h+=fg('Application Surface','<input id="rfq-surface" placeholder="e.g. Bottle, Jar, Box, Pouch">');
h+=fg('Reference Files','<input id="rfq-files" placeholder="Link to Drive folder or files">');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:50px" placeholder="Structural requirements, bleed, perforation, tabs..."></textarea>');
h+=dateAssignFields(users)}

else if(reqType==='Engineering'){
h+=fg('Client / Job','<input id="rfq-co" placeholder="Client or internal">');
h+=fg('Engineering Type','<select id="rfq-engtype"><option>Material Testing</option><option>Adhesive Compatibility</option><option>Print Feasibility</option><option>Die Design</option><option>Substrate R&D</option></select>');
h+=fg('Current Material','<input id="rfq-material" placeholder="What\'s being used now">');
h+=fg('Problem / Goal','<textarea id="rfq-desc" style="min-height:60px" placeholder="What technical challenge needs solving?"></textarea>');
h+=fg('Reference Files','<input id="rfq-files" placeholder="Link to specs, test results">');
h+=dateAssignFields(users)}

else if(reqType==='Artwork'){
h+=fg('Client / Job','<input id="rfq-co" placeholder="Client name">');
h+=fg('Artwork Type','<select id="rfq-arttype"><option>New Design</option><option>Revision / Edit</option><option>File Conversion</option><option>Color Separation</option><option>Trap & Pre-Flight</option></select>');
h+=fg('Dieline Available?','<select id="rfq-dieline"><option>Yes</option><option>No - needs creation</option></select>');
h+=fg('Brand Colors (PMS)','<input id="rfq-pms" placeholder="e.g. PMS 286, PMS 485">');
h+=fg('Reference Files','<input id="rfq-files" placeholder="Link to artwork, logos, brand guide">');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:50px" placeholder="What needs to be designed or changed?"></textarea>');
h+=dateAssignFields(users)}

else if(reqType==='Proof'){
h+=fg('Client','<input id="rfq-co" placeholder="Client name">');
h+=fg('Quote / Job #','<input id="rfq-refq" placeholder="Reference quote number">');
h+=fg('Proof Type','<select id="rfq-prooftype"><option>Digital Proof (PDF)</option><option>Printed Hard Proof</option><option>Press Proof</option><option>Color Match Proof</option></select>');
h+=fg('Ship Proof To','<textarea id="rfq-shipto" placeholder="Address if physical proof"></textarea>');
h+=fg('Description *','<textarea id="rfq-desc" placeholder="Special instructions, revisions from last proof..."></textarea>');
h+=dateAssignFields(users)}

// ═══ LOGISTICS ═══
else if(reqType==='Inventory'){
h+=fg('Material / Item','<input id="rfq-material" placeholder="What needs checking?">');
h+=fg('Part # / SKU','<input id="rfq-sku" placeholder="If known">');
h+=fg('Quantity Needed','<input id="rfq-qty" placeholder="How much do you need?">');
h+=fg('Needed By','<input id="rfq-date" type="date">');
h+=fg('Description *','<textarea id="rfq-desc" placeholder="Why is this needed? What job is it for?"></textarea>');
h+=assignField(users)}

else if(reqType==='Purchasing'){
h+=fg('Item / Material','<input id="rfq-material" placeholder="What to purchase">');
h+=fg('Vendor','<input id="rfq-vendor" placeholder="Preferred vendor if known">');
h+=fg('Quantity','<input id="rfq-qty">');
h+=fg('Estimated Cost','<input id="rfq-cost" placeholder="$">');
h+=fg('Needed By','<input id="rfq-date" type="date">');
h+=fg('Reason / Job #','<textarea id="rfq-desc" placeholder="What is this for?"></textarea>');
h+=assignField(users)}

// ═══ PRODUCTION ═══
else if(reqType==='Status Report'){
h+=fg('Job / Quote #','<input id="rfq-refq" placeholder="Which job?">');
h+=fg('Client','<input id="rfq-co">');
h+=fg('What info needed?','<textarea id="rfq-desc" placeholder="e.g. ETA, current stage, issues..."></textarea>');
h+=assignField(users)}

else if(reqType==='Quality'){
h+=fg('Job / Quote #','<input id="rfq-refq">');
h+=fg('Issue Type','<select id="rfq-qtype"><option>Print Defect</option><option>Material Issue</option><option>Color Mismatch</option><option>Die Cut Problem</option><option>Registration</option><option>Other</option></select>');
h+=fg('Severity','<select id="rfq-sev"><option>Minor</option><option>Major</option><option>Critical - Stop Production</option></select>');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:60px" placeholder="Describe the quality issue in detail"></textarea>');
h+=fg('Photos / Evidence','<input id="rfq-files" placeholder="Link to photos">');
h+=dateAssignFields(users)}

else if(reqType==='CAPA'){
h+=fg('Related Job #','<input id="rfq-refq">');
h+=fg('CAPA Type','<select id="rfq-capatype"><option>Corrective Action</option><option>Preventive Action</option></select>');
h+=fg('Root Cause','<textarea id="rfq-rootcause" placeholder="What caused the issue?"></textarea>');
h+=fg('Proposed Action','<textarea id="rfq-desc" style="min-height:60px" placeholder="What corrective/preventive steps are proposed?"></textarea>');
h+=dateAssignFields(users)}

else if(reqType==='SQF'){
h+=fg('SQF Category','<select id="rfq-sqfcat"><option>Food Safety</option><option>HACCP</option><option>GMP</option><option>Pest Control</option><option>Allergen</option><option>Audit Finding</option><option>Other</option></select>');
h+=fg('Urgency','<select id="rfq-sev"><option>Routine</option><option>Urgent</option><option>Critical - Immediate Action</option></select>');
h+=fg('Description *','<textarea id="rfq-desc" style="min-height:60px" placeholder="Describe the compliance issue or requirement"></textarea>');
h+=fg('Evidence / Docs','<input id="rfq-files" placeholder="Link to documents">');
h+=dateAssignFields(users)}

// ═══ FINANCE ═══
else if(reqType==='AR Report'){
h+=fg('Client','<input id="rfq-co" placeholder="Which client?">');
h+=fg('Report Type','<select id="rfq-artype"><option>Aging Report</option><option>Payment Status</option><option>Credit Check</option><option>Collection Follow-Up</option></select>');
h+=fg('Invoice #','<input id="rfq-refq" placeholder="If specific invoice">');
h+=fg('Description','<textarea id="rfq-desc" placeholder="What do you need to know?"></textarea>');
h+=assignField(users)}

else if(reqType==='PO Check'){
h+=fg('PO Number','<input id="rfq-refq" placeholder="Purchase order #">');
h+=fg('Vendor','<input id="rfq-vendor">');
h+=fg('Question','<textarea id="rfq-desc" placeholder="What about this PO?"></textarea>');
h+=assignField(users)}

else if(reqType==='Invoice'){
h+=fg('Invoice #','<input id="rfq-refq">');
h+=fg('Client / Vendor','<input id="rfq-co">');
h+=fg('Issue Type','<select id="rfq-invtype"><option>Amount Discrepancy</option><option>Missing Invoice</option><option>Duplicate Charge</option><option>Payment Status</option></select>');
h+=fg('Description','<textarea id="rfq-desc" placeholder="Describe the issue"></textarea>');
h+=assignField(users)}

// ═══ HR ═══
else if(reqType==='Sick Day'){
h+=fg('Date','<input id="rfq-date" type="date" value="'+new Date().toISOString().split('T')[0]+'">');
h+=fg('Expected Return','<input id="rfq-date2" type="date">');
h+=fg('Notes','<textarea id="rfq-desc" placeholder="Optional - any context for your supervisor"></textarea>')}

else if(reqType==='Time Off'){
h+=fg('Start Date','<input id="rfq-date" type="date">');
h+=fg('End Date','<input id="rfq-date2" type="date">');
h+=fg('Type','<select id="rfq-ptoType"><option>PTO / Vacation</option><option>Personal Day</option><option>Bereavement</option><option>Jury Duty</option><option>Other</option></select>');
h+=fg('Notes','<textarea id="rfq-desc" placeholder="Reason or context"></textarea>')}

else if(reqType==='Late Notice'){
h+=fg('Date','<input id="rfq-date" type="date" value="'+new Date().toISOString().split('T')[0]+'">');
h+=fg('Expected Arrival','<input id="rfq-time" type="time">');
h+=fg('Type','<select id="rfq-lateType"><option>Running Late</option><option>Absent Today</option><option>Leaving Early</option></select>');
h+=fg('Reason','<textarea id="rfq-desc" placeholder="Brief explanation"></textarea>')}

else if(reqType==='Clock Correction'){
h+=fg('Date of Error','<input id="rfq-date" type="date">');
h+=fg('Incorrect Time','<input id="rfq-time" type="time">');
h+=fg('Correct Time','<input id="rfq-time2" type="time">');
h+=fg('Type','<select id="rfq-clockType"><option>Missed Clock-In</option><option>Missed Clock-Out</option><option>Wrong Time</option><option>System Error</option></select>');
h+=fg('Explanation *','<textarea id="rfq-desc" placeholder="What happened?"></textarea>')}

// ═══ GENERAL ═══
else if(reqType==='Leadership Q'){
var toOpts='<select id="rfq-assign"><option>CEO</option><option>Director</option><option>Lead</option>';users.forEach(function(u){toOpts+='<option>'+u+'</option>'});toOpts+='</select>';h+=fg('To',toOpts);
h+=fg('Subject','<input id="rfq-subject" placeholder="Brief subject line">');
h+=fg('Question *','<textarea id="rfq-desc" style="min-height:80px" placeholder="Your question..."></textarea>');
h+=fg('Confidential?','<select id="rfq-conf"><option>No</option><option>Yes</option></select>')}

else if(reqType==='Training'){
h+=fg('Training Topic','<input id="rfq-subject" placeholder="What do you need training on?">');
h+=fg('Department','<select id="rfq-dept"><option>Operations</option><option>Pre-Press</option><option>Production</option><option>Quality</option><option>Sales</option><option>All</option></select>');
h+=fg('Preferred Format','<select id="rfq-format"><option>In-Person</option><option>Video Call</option><option>Written Guide</option><option>Shadow / Ride-Along</option></select>');
h+=fg('Details *','<textarea id="rfq-desc" placeholder="What specifically do you need to learn?"></textarea>');
h+=dateAssignFields(users)}

else if(reqType==='Meeting Request'){
var withOpts='<select id="rfq-assign"><option value="">Select person</option>';users.forEach(function(u){withOpts+='<option>'+u+'</option>'});withOpts+='</select>';h+=fg('With',withOpts);
h+=fg('Date','<input id="rfq-date" type="date">');
h+=fg('Time','<input id="rfq-time" type="time" value="10:00">');
h+=fg('Duration','<select id="rfq-dur"><option>15 min</option><option>30 min</option><option selected>60 min</option><option>90 min</option></select>');
h+=fg('Topic *','<textarea id="rfq-desc" placeholder="What is this meeting about?"></textarea>')}

else if(reqType==='Access Request'){
h+=fg('System / Tool','<input id="rfq-subject" placeholder="e.g. Google Drive, Zoho, MFX OS">');
h+=fg('Access Level','<select id="rfq-access"><option>View Only</option><option>Edit</option><option>Admin</option></select>');
h+=fg('Reason *','<textarea id="rfq-desc" placeholder="Why do you need access?"></textarea>');
h+=assignField(users)}

else{
// Suggestion / Generic
h+=fg('Subject','<input id="rfq-subject" placeholder="Brief subject">');
h+=fg('Category','<select id="rfq-sugcat"><option>Question</option><option>Concern</option><option>Suggestion</option><option>Compliment</option><option>Other</option></select>');
h+=fg('Details *','<textarea id="rfq-desc" style="min-height:80px" placeholder="Share your thoughts..."></textarea>');
h+=fg('Anonymous?','<select id="rfq-anon"><option>No</option><option>Yes</option></select>')}

h+='<button class="btn btn-pr" onclick="submitTypedRequest(\''+reqType+'\')" style="width:100%;margin-top:10px">Submit '+reqType+'</button>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
openModal(h)}

function fg(label,input){return'<div class="fg"><label>'+label+'</label>'+input+'</div>'}
function clientFields(cs){var h=fg('Client','<select id="rfq-co" onchange="rfqFillClient()"><option value="">- Select -</option>'+cs.map(function(c){return'<option value="'+c.company+'">'+c.company+'</option>'}).join('')+'</select>');h+=fg('Or New Client','<input id="rfq-newco">');h+=fg('Contact','<input id="rfq-ct">');h+=fg('Email','<input id="rfq-em">');h+=fg('Phone','<input id="rfq-ph">');h+='<div id="rfq-client-info" style="font-size:10px;color:var(--tx3);margin-bottom:4px"><span id="rfq-industry"></span></div>';return h}
function assignField(users){return fg('Assign To','<select id="rfq-assign"><option value="">Auto-route</option>'+users.map(function(u){return'<option>'+u+'</option>'}).join('')+'</select>')+fg('Priority','<select id="rfq-pri"><option>Normal</option><option>High</option><option>Urgent</option></select>')}
function dateAssignFields(users){return fg('Target Date','<input id="rfq-date" type="date">')+assignField(users)+fg('Notes','<textarea id="rfq-notes" placeholder="Additional notes..."></textarea>')}

function submitTypedRequest(reqType){
var desc=($('rfq-desc')||{}).value;if(!desc)return toast('Required field missing','err');
var co=($('rfq-co')||{}).value||($('rfq-newco')||{}).value||'';
var rfq={
requestType:reqType,
company:co,contact:($('rfq-ct')||{}).value||'',email:($('rfq-em')||{}).value||'',phone:($('rfq-ph')||{}).value||'',
description:desc,
subject:($('rfq-subject')||{}).value||'',
jobType:($('rfq-job')||{}).value||'',
shape:($('rfq-shape')||{}).value||'',size:($('rfq-size')||{}).value||'',
colors:($('rfq-colors')||{}).value||'',material:($('rfq-material')||{}).value||'',
quantity:($('rfq-qty')||{}).value||'',
artworkReady:($('rfq-artready')||{}).value||'',
sampleType:($('rfq-stype')||{}).value||'',
referenceQuote:($('rfq-refq')||{}).value||'',
shipTo:($('rfq-shipto')||{}).value||'',
productCategory:($('rfq-pcat')||{}).value||'',
targetMarket:($('rfq-market')||{}).value||'',
budget:($('rfq-budget')||{}).value||'',
corners:($('rfq-corners')||{}).value||'',
surface:($('rfq-surface')||{}).value||'',
engineeringType:($('rfq-engtype')||{}).value||'',
artworkType:($('rfq-arttype')||{}).value||'',
dielineReady:($('rfq-dieline')||{}).value||'',
pmsColors:($('rfq-pms')||{}).value||'',
proofType:($('rfq-prooftype')||{}).value||'',
vendor:($('rfq-vendor')||{}).value||'',
estimatedCost:($('rfq-cost')||{}).value||'',
sku:($('rfq-sku')||{}).value||'',
issueType:($('rfq-qtype')||{}).value||($('rfq-invtype')||{}).value||'',
severity:($('rfq-sev')||{}).value||'',
capaType:($('rfq-capatype')||{}).value||'',
rootCause:($('rfq-rootcause')||{}).value||'',
sqfCategory:($('rfq-sqfcat')||{}).value||'',
arType:($('rfq-artype')||{}).value||'',
files:($('rfq-files')||{}).value||'',
department:($('rfq-dept')||{}).value||'',
format:($('rfq-format')||{}).value||'',
accessLevel:($('rfq-access')||{}).value||'',
confidential:($('rfq-conf')||{}).value||'',
anonymous:($('rfq-anon')||{}).value||'',
category:($('rfq-sugcat')||{}).value||'',
ptoType:($('rfq-ptoType')||{}).value||'',
lateType:($('rfq-lateType')||{}).value||'',
clockType:($('rfq-clockType')||{}).value||'',
duration:($('rfq-dur')||{}).value||'',
meetingTime:($('rfq-time')||{}).value||'',
correctTime:($('rfq-time2')||{}).value||'',
targetDate:($('rfq-date')||{}).value||'',
endDate:($('rfq-date2')||{}).value||'',
assignedTo:($('rfq-assign')||{}).value||'',
priority:($('rfq-pri')||{}).value||'Normal',
notes:($('rfq-notes')||{}).value||'',
submittedBy:getUserName(),owner:getUserName(),status:'pending'};
// Clean empty fields
Object.keys(rfq).forEach(function(k){if(rfq[k]==='')delete rfq[k]});
rfq.submittedAt=firebase.firestore.FieldValue.serverTimestamp();
rfq.status='pending';rfq.submittedBy=getUserName();rfq.owner=getUserName();
rfq.requestType=reqType;

fbDb.collection('requests').add(rfq).then(function(){
closeModal();toast(reqType+' submitted!','ok');
notifyTeam('📨 New '+reqType+' from '+getUserName()+(co?' - '+co:''));
if(rfq.targetDate&&typeof createCalendarEvent==='function'){
createCalendarEvent('📨 '+reqType+': '+(co||desc.substring(0,30)),desc,rfq.targetDate,'09:00',60)}
}).catch(function(e){toast(e.message,'err')})}

function openSubmittedRequests(){
$('hdrTitle').textContent='Request Dashboard';$('hdrActions').innerHTML='<button class="btn btn-pr btn-xs" onclick="renderRequestHub()">+ New</button>';
var el=$('v-supportinbox');if(!el)return;
el.innerHTML='<div id="reqDash">Loading...</div>';
var me=getUserName();
fbDb.collection('requests').orderBy('submittedAt','desc').limit(60).get().then(function(snap){
var all=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var filter=window._reqDashFilter||'all';
var h='';

// Overdue alert banner
var now=new Date();var overdue=all.filter(function(r){return r.targetDate&&new Date(r.targetDate)<now&&r.status!=='closed'&&r.status!=='completed'});
if(overdue.length>=5){h+='<div style="background:#7f1d1d;border:2px solid #ef4444;border-radius:8px;padding:10px;margin-bottom:10px;text-align:center;animation:pulse 1s infinite"><div style="font-size:13px;font-weight:700;color:#fca5a5">⚠ '+overdue.length+' OVERDUE REQUESTS</div><div style="font-size:10px;color:#fca5a5">Complete these before write-up</div></div>';
h+='<style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style>'}
else if(overdue.length>0){h+='<div style="background:#451a03;border:1px solid #f59e0b;border-radius:8px;padding:8px;margin-bottom:10px;font-size:11px;color:#fbbf24;text-align:center">⚠ '+overdue.length+' overdue request'+(overdue.length>1?'s':'')+'</div>'}

// Stats
var pending=all.filter(function(r){return r.status==='pending'}).length;
var active=all.filter(function(r){return r.status==='accepted'||r.status==='in_progress'}).length;
var done=all.filter(function(r){return r.status==='completed'||r.status==='closed'}).length;
h+='<div style="display:flex;gap:4px;margin-bottom:8px">';
h+='<div style="flex:1;background:var(--bg3);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--or)">'+pending+'</div><div style="font-size:8px;color:var(--tx3)">Pending</div></div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--ac)">'+active+'</div><div style="font-size:8px;color:var(--tx3)">Active</div></div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--rd)">'+overdue.length+'</div><div style="font-size:8px;color:var(--tx3)">Overdue</div></div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--gn)">'+done+'</div><div style="font-size:8px;color:var(--tx3)">Done</div></div></div>';

// Filters
h+='<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
['all','mine','assigned','pending','active','overdue','completed','closed'].forEach(function(f){
var cnt=f==='all'?all.length:f==='mine'?all.filter(function(r){return r.submittedBy===me}).length:f==='assigned'?all.filter(function(r){return r.assignedTo===me}).length:f==='pending'?pending:f==='active'?active:f==='overdue'?overdue.length:f==='completed'?all.filter(function(r){return r.status==='completed'}).length:all.filter(function(r){return r.status==='closed'}).length;
h+='<span style="padding:3px 8px;background:'+(filter===f?'var(--ac)':'var(--bg3)')+';color:'+(filter===f?'#fff':'var(--tx2)')+';border-radius:12px;font-size:9px;cursor:pointer" onclick="window._reqDashFilter=\''+f+'\';openSubmittedRequests()">'+f+' ('+cnt+')</span>'});
h+='</div>';

// Filter items
var filtered=all;
if(filter==='mine')filtered=all.filter(function(r){return r.submittedBy===me||r.owner===me});
if(filter==='assigned')filtered=all.filter(function(r){return r.assignedTo===me});
if(filter==='pending')filtered=all.filter(function(r){return r.status==='pending'});
if(filter==='active')filtered=all.filter(function(r){return r.status==='accepted'||r.status==='in_progress'});
if(filter==='overdue')filtered=overdue;
if(filter==='completed')filtered=all.filter(function(r){return r.status==='completed'});
if(filter==='closed')filtered=all.filter(function(r){return r.status==='closed'});

// Table
filtered.forEach(function(r){
var daysUntil='-';var riskColor='var(--gn)';var riskText='OK';
if(r.targetDate){var due=new Date(r.targetDate);var diff=Math.ceil((due-now)/86400000);daysUntil=diff+'d';
if(diff<0){riskColor='var(--rd)';riskText='OVERDUE';daysUntil=Math.abs(diff)+'d over'}
else if(diff<=1){riskColor='var(--rd)';riskText='DUE TODAY'}
else if(diff<=3){riskColor='var(--or)';riskText='AT RISK'}
else{riskColor='var(--gn)';riskText='OK'}}
var lastNote='-';if(r.comments&&r.comments.length){var ln=r.comments[r.comments.length-1];lastNote=(ln.by||'')+': '+(ln.text||'').substring(0,30)}
var priColor=r.priority==='Urgent'?'var(--rd)':r.priority==='High'?'var(--or)':'var(--tx3)';
var stColor={pending:'var(--or)',accepted:'var(--ac)',in_progress:'var(--ac)',completed:'var(--gn)',closed:'var(--tx3)'}[r.status]||'var(--bdr)';

// Progress bar width
var pct=r.status==='closed'?100:r.status==='completed'?90:r.status==='in_progress'?50:r.status==='accepted'?25:10;
var barColor=riskText==='OVERDUE'?'var(--rd)':riskText==='AT RISK'?'var(--or)':pct>=90?'var(--gn)':'var(--ac)';
var blink=riskText==='OVERDUE'?';animation:pulse 1.5s infinite':'';

h+='<div class="card" style="margin-bottom:4px;padding:0;overflow:hidden;cursor:pointer;position:relative" onclick="openReqProfile(\''+r.id+'\')">';
// Progress bar background
h+='<div style="position:absolute;top:0;left:0;height:100%;width:'+pct+'%;background:'+barColor+'10;z-index:0'+blink+'"></div>';
h+='<div style="position:relative;z-index:1;padding:8px 10px">';
// Row 1: subject + priority + status
h+='<div style="display:flex;justify-content:space-between;align-items:center">';
h+='<strong style="color:var(--ac);font-size:11px">'+esc(r.subject||r.company||r.requestType)+'</strong>';
h+='<div style="display:flex;gap:3px"><span style="font-size:7px;padding:1px 4px;border-radius:3px;background:'+priColor+'20;color:'+priColor+';border:1px solid '+priColor+'">'+esc(r.priority)+'</span>';
h+='<span style="font-size:7px;padding:1px 4px;border-radius:3px;background:'+stColor+'20;color:'+stColor+';border:1px solid '+stColor+'">'+esc(r.status)+'</span></div></div>';
// Row 2: meta
h+='<div style="display:flex;justify-content:space-between;font-size:8px;color:var(--tx3);margin-top:3px">';
h+='<span>'+esc(r.requestType)+' · '+esc(r.submittedBy||'')+'→'+esc(r.assignedTo||'?')+'</span>';
h+='<span style="color:'+riskColor+';font-weight:600">'+daysUntil+' '+riskText+'</span></div>';
// Row 3: last note
h+='<div style="font-size:8px;color:var(--tx3);margin-top:2px">💬 '+lastNote+'</div>';
h+='</div></div>'});

if(!filtered.length)h+='<div style="color:var(--tx3);padding:20px;text-align:center">No requests</div>';
$('reqDash').innerHTML=h}).catch(function(e){$('reqDash').innerHTML=esc(e.message)})}

function openReqProfile(rid){
fbDb.collection('requests').doc(rid).get().then(function(doc){
if(!doc.exists)return;var r=Object.assign({id:doc.id},doc.data());
var me=getUserName();var isAssignee=r.assignedTo===me;var isOwner=r.submittedBy===me||r.owner===me;
var now=new Date();var daysUntil='-';var riskText='OK';
if(r.targetDate){var diff=Math.ceil((new Date(r.targetDate)-now)/86400000);daysUntil=diff;riskText=diff<0?'OVERDUE':diff<=1?'DUE TODAY':diff<=3?'AT RISK':'OK'}

var h='<div class="modal-title" style="font-size:13px">'+esc(r.subject||r.company||r.requestType)+'</div>';

// Status + risk
var stColor={pending:'var(--or)',accepted:'var(--ac)',in_progress:'var(--ac)',completed:'var(--gn)',closed:'var(--tx3)'}[r.status]||'var(--bdr)';
h+='<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
h+='<span style="padding:3px 8px;border-radius:6px;font-size:10px;background:'+stColor+'20;color:'+stColor+';border:1px solid '+stColor+'">'+esc(r.status)+'</span>';
h+='<span style="padding:3px 8px;border-radius:6px;font-size:10px;background:var(--bg4);color:var(--ac)">'+esc(r.requestType)+'</span>';
if(r.priority==='Urgent')h+='<span style="padding:3px 8px;border-radius:6px;font-size:10px;background:#3b1010;color:var(--rd);border:1px solid var(--rd)">URGENT</span>';
if(riskText==='OVERDUE')h+='<span style="padding:3px 8px;border-radius:6px;font-size:10px;background:#7f1d1d;color:#fca5a5;animation:pulse 1s infinite">'+Math.abs(daysUntil)+'d OVERDUE</span>';
h+='</div>';

// Key details
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:9px;color:var(--tx3);margin-bottom:6px;line-height:1.8">';
if(r.company)h+='<div><b>Client:</b> '+esc(r.company)+'</div>';
if(r.contact)h+='<div><b>Contact:</b> '+esc(r.contact)+'</div>';
if(r.dept||r.department)h+='<div><b>Dept:</b> '+esc(r.dept||r.department)+'</div>';
h+='<div><b>Priority:</b> '+esc(r.priority)+'</div>';
h+='<div><b>Submitted:</b> '+(r.submittedAt?fD(new Date(r.submittedAt.seconds*1000).toISOString()):'-')+'</div>';
if(r.targetDate)h+='<div><b>Due:</b> <span style="color:'+(riskText==='OVERDUE'?'var(--rd)':'var(--or)')+'">'+r.targetDate+'</span></div>';
h+='<div><b>By:</b> '+esc(r.submittedBy)+'</div>';
h+='<div><b>Assigned:</b> <span style="color:var(--ac)">'+esc(r.assignedTo||'Unassigned')+'</span></div>';
h+='</div>';

if(r.description)h+='<div style="font-size:10px;color:var(--tx2);background:var(--bg3);padding:6px;border-radius:6px;margin-bottom:6px;line-height:1.4">'+esc(r.description)+'</div>';

// Deliverables / links
if(r.files)h+='<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:600;margin-bottom:2px">📎 Deliverables</div><a href="'+r.files+'" target="_blank" style="font-size:10px;color:var(--ac)">View Files →</a></div>';

// Activity + Comments thread
h+='<div style="font-size:9px;font-weight:600;margin-bottom:3px">💬 Activity & Notes ('+(r.comments||[]).length+')</div>';
h+='<div style="max-height:130px;overflow-y:auto">';
(r.comments||[]).forEach(function(c,ci){
h+='<div style="padding:3px 0;border-bottom:1px solid var(--bdr);font-size:9px">';
h+='<div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(c.by)+'</strong><div><span style="cursor:pointer;font-size:8px" onclick="event.stopPropagation();likeReqComment(\''+rid+'\','+ci+')">👍'+(c.likes||0)+'</span> <span style="color:var(--tx3)">'+esc(c.at)+'</span></div></div>';
h+='<div style="color:var(--tx2)">'+esc(c.text)+'</div>';
if(c.replies&&c.replies.length){c.replies.forEach(function(rp){h+='<div style="margin:1px 0 1px 10px;padding:2px 6px;background:var(--bg3);border-left:2px solid var(--ac);border-radius:0 3px 3px 0;font-size:8px"><strong style="color:var(--ac)">'+esc(rp.by)+'</strong> '+esc(rp.text)+'</div>'})}
h+='<button class="btn btn-ghost" style="font-size:7px;padding:1px 4px" onclick="event.stopPropagation();replyReqComment(\''+rid+'\','+ci+')">↩</button></div>'});
h+='</div>';
h+='<textarea id="req-comment" placeholder="Add note... @name to tag" style="width:100%;min-height:28px;padding:5px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:10px;margin:4px 0"></textarea>';
h+='<button class="btn btn-ghost btn-xs" onclick="addReqComment(\''+rid+'\')" style="width:100%;margin-bottom:6px">Post Note</button>';

// Action buttons
h+='<div style="display:flex;flex-direction:column;gap:3px">';
if(isAssignee&&r.status==='pending')h+='<button class="btn btn-gn btn-sm" onclick="acceptRequest(\''+rid+'\')">✅ Accept</button><button class="btn btn-ghost btn-sm" style="color:var(--rd)" onclick="declineRequest(\''+rid+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Decline</button>';
if(isAssignee&&r.status==='accepted')h+='<button class="btn btn-pr btn-sm" onclick="startRequest(\''+rid+'\')">🚀 Start</button>';
if(isAssignee&&(r.status==='accepted'||r.status==='in_progress'))h+='<button class="btn btn-gn btn-sm" onclick="completeRequest(\''+rid+'\')">✅ Complete</button>';
if(isOwner&&r.status==='completed')h+='<button class="btn btn-gn btn-sm" onclick="closeRequest(\''+rid+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Close + Rate</button>';
// Follow up / remind / reassign
h+='<div style="display:flex;gap:3px">';
h+='<button class="btn btn-ghost btn-xs" onclick="pingAssignee(\''+rid+'\')" style="flex:1">🔔 Ping</button>';
h+='<button class="btn btn-ghost btn-xs" onclick="reassignRequest(\''+rid+'\')" style="flex:1">🔄 Reassign</button>';
h+='<button class="btn btn-ghost btn-xs" onclick="closeModal()" style="flex:1">Close</button></div>';
h+='</div>';
openModal(h)}).catch(function(e){ console.warn('APP get:', e.message); })}

function pingAssignee(rid){
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();
if(!r.assignedTo)return toast('No assignee','err');
notifyTeam('🔔 REMINDER: '+getUserName()+' pinged '+r.assignedTo+' on: '+r.requestType+' - '+(r.subject||r.company||''));
var c=r.comments||[];c.push({by:'System',text:'🔔 '+getUserName()+' sent a reminder ping to '+r.assignedTo,at:fD(new Date().toISOString()),likes:0,replies:[]});
fbDb.collection('requests').doc(rid).update({comments:c}).then(function(){toast('Pinged '+r.assignedTo,'ok')})}).catch(function(e){ console.warn('APP get:', e.message); })}

function reassignRequest(rid){
var users=typeof getTeamUsers==='function'?getTeamUsers():[];
var to=prompt('Reassign to? ('+users.join(', ')+')');if(!to)return;
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();
var c=r.comments||[];c.push({by:getUserName(),text:'🔄 Reassigned from '+(r.assignedTo||'nobody')+' to '+to,at:fD(new Date().toISOString()),likes:0,replies:[]});
fbDb.collection('requests').doc(rid).update({assignedTo:to,comments:c}).then(function(){
closeModal();toast('Reassigned to '+to,'ok');notifyTeam('🔄 '+r.requestType+' reassigned to '+to+' by '+getUserName());openSubmittedRequests()})}).catch(function(e){ console.warn('APP get:', e.message); })}

function openMeetings(){S.view='supportinbox';document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});$('v-supportinbox').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=function(){goView('dashboard')};$('hdrTitle').textContent='Calendar';$('hdrActions').innerHTML='<button class="btn btn-pr btn-sm" onclick="newMeetingTask()">+ New</button>';if(typeof applyDeptTheme==='function')applyDeptTheme('dashboard');renderMeetingsView()}

function renderMeetingsView(){var el=$('v-supportinbox');if(!el)return;el.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading...</div>';loadAllTasks(function(items){var vt=window._calViewTab||0;var h='<div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto">';['<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Daily','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Weekly','📆 Monthly','🗓 Planning'].forEach(function(t,i){h+='<div style="padding:5px 10px;background:'+(vt===i?'var(--ac)':'var(--bg3)')+';color:'+(vt===i?'#fff':'var(--tx2)')+';border-radius:20px;font-size:9px;font-weight:600;cursor:pointer;white-space:nowrap" onclick="window._calViewTab='+i+';renderMeetingsView()">'+t+'</div>'});h+='</div>';if(vt===0)h+=renderDailyView(items);else if(vt===1)h+=renderWeeklyView(items);else if(vt===2)h+=renderCalendarGrid(items);else h+=renderPlanningView(items);el.innerHTML=h})}

function openTasksView(){S.view='supportinbox';document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});$('v-supportinbox').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=function(){goView('dashboard')};$('hdrTitle').textContent='Tasks';$('hdrActions').innerHTML='<button class="btn btn-pr btn-sm" onclick="newMeetingTask()">+ New</button>';if(typeof applyDeptTheme==='function')applyDeptTheme('dashboard');renderTasksListView()}
function renderTasksListView(){var el=$('v-supportinbox');if(!el)return;el.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading...</div>';loadAllTasks(function(items){var me=getUserName();var myTasks=items.filter(function(t){return t.type==='task'&&(t.assignedTo===me||t.createdBy===me)});var open=myTasks.filter(function(t){return!t.completed});var done=myTasks.filter(function(t){return t.completed});var h='<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--ac)">Open Tasks ('+open.length+')</div>';if(open.length){open.forEach(function(t){h+=taskCard(t)})}else{h+='<div style="color:var(--tx3);padding:12px;text-align:center;font-size:11px">No open tasks</div>'}h+='<div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:var(--tx3)">Completed ('+done.length+')</div>';done.slice(0,10).forEach(function(t){h+=taskCard(t)});el.innerHTML=h})}

function loadAllTasks(cb){var items=[];if(!fbDb){cb(items);return}fbDb.collection('tasks').orderBy('createdAt','desc').limit(100).get().then(function(snap){items=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});cb(items)}).catch(function(e){console.warn('loadAllTasks:',e);cb(items)})}

function renderCalendarGrid(items){var cm=window._calMonth!==undefined?window._calMonth:new Date().getMonth();var cy=window._calYear||new Date().getFullYear();window._calMonth=cm;window._calYear=cy;var today=new Date();var fd=new Date(cy,cm,1).getDay();var dim=new Date(cy,cm+1,0).getDate();var mn=new Date(cy,cm,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><button class="btn btn-ghost btn-xs" onclick="calNav(-1)">◀</button><div style="font-size:14px;font-weight:700;color:var(--tx)">'+mn+'</div><button class="btn btn-ghost btn-xs" onclick="calNav(1)">▶</button></div>';h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:12px">';['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d){h+='<div style="text-align:center;font-size:9px;color:var(--tx3);padding:4px">'+d+'</div>'});for(var i=0;i<fd;i++)h+='<div></div>';for(var d=1;d<=dim;d++){var ds=cy+'-'+(cm+1<10?'0':'')+(cm+1)+'-'+(d<10?'0':'')+d;var di=items.filter(function(m){return m.date===ds});var isT=d===today.getDate()&&cm===today.getMonth()&&cy===today.getFullYear();h+='<div style="text-align:center;padding:4px 2px;background:'+(isT?'var(--ac2)':di.length?'var(--bg4)':'var(--bg3)')+';border:1px solid '+(isT?'var(--ac)':'var(--bdr)')+';border-radius:6px;cursor:pointer;min-height:36px" onclick="showDayTasks(\''+ds+'\')"><div style="font-size:12px;font-weight:'+(isT?'700':'400')+';color:'+(isT?'#fff':'var(--tx)')+'">'+d+'</div>'+(di.length?'<div style="font-size:7px;color:var(--ac)">'+di.length+'</div>':'')+'</div>'}h+='</div>';var up=items.filter(function(m){return m.date>=today.toISOString().split('T')[0]&&!m.completed}).sort(function(a,b){return(a.date||'').localeCompare(b.date||'')});h+='<div style="font-size:12px;font-weight:600;margin-bottom:6px">Upcoming ('+up.length+')</div>';up.slice(0,10).forEach(function(m){h+=taskCard(m)});if(!up.length)h+='<div style="color:var(--tx3);padding:12px;text-align:center">Nothing scheduled</div>';return h}

function renderMyTasks(items){var me=getUserName();var mine=items.filter(function(t){return t.assignedTo===me||t.createdBy===me});var active=mine.filter(function(t){return!t.completed});var done=mine.filter(function(t){return t.completed});var h='<div style="font-size:11px;font-weight:600;margin-bottom:4px">Active ('+active.length+')</div>';active.forEach(function(t){h+=taskCard(t)});if(done.length){h+='<div style="font-size:11px;font-weight:600;color:var(--gn);margin:8px 0 4px">Done ('+done.length+')</div>';done.slice(0,8).forEach(function(t){h+=taskCard(t)})}return h}

function renderDailyView(items){
var d=window._calDailyDate||new Date().toISOString().split('T')[0];window._calDailyDate=d;
var dObj=new Date(d+'T12:00:00');var dLabel=dObj.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><button class="btn btn-ghost btn-xs" onclick="calDayNav(-1)">◀ Prev</button><div style="font-size:14px;font-weight:700;color:var(--tx)">'+dLabel+'</div><button class="btn btn-ghost btn-xs" onclick="calDayNav(1)">Next ▶</button></div>';
var me=getUserName();var dayItems=items.filter(function(t){return t.date===d&&(t.assignedTo===me||t.createdBy===me)});
var allDay=dayItems.filter(function(t){return!t.time});var timed=dayItems.filter(function(t){return t.time}).sort(function(a,b){return(a.time||'').localeCompare(b.time||'')});
if(timed.length){h+='<div style="font-size:10px;font-weight:600;color:var(--ac);margin-bottom:4px">Scheduled</div>';timed.forEach(function(t){h+='<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><div style="font-size:11px;font-weight:600;color:var(--ac);min-width:50px;padding-top:8px">'+t.time+'</div><div style="flex:1">'+taskCard(t)+'</div></div>'})}
if(allDay.length){h+='<div style="font-size:10px;font-weight:600;color:var(--tx2);margin:6px 0 4px">Tasks</div>';allDay.forEach(function(t){h+=taskCard(t)})}
if(!dayItems.length)h+='<div style="color:var(--tx3);padding:20px;text-align:center;font-size:11px">Nothing scheduled - enjoy the open space</div>';
return h}
function calDayNav(dir){var d=window._calDailyDate||new Date().toISOString().split('T')[0];var dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()+dir);window._calDailyDate=dt.toISOString().split('T')[0];renderMeetingsView()}

function renderWeeklyView(items){
var today=new Date();var sd=window._calWeekStart?new Date(window._calWeekStart+'T12:00:00'):new Date(today);
sd.setDate(sd.getDate()-sd.getDay());window._calWeekStart=sd.toISOString().split('T')[0];
var me=getUserName();
var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><button class="btn btn-ghost btn-xs" onclick="calWeekNav(-1)">◀ Prev</button><div style="font-size:13px;font-weight:700;color:var(--tx)">Week of '+sd.toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</div><button class="btn btn-ghost btn-xs" onclick="calWeekNav(1)">Next ▶</button></div>';
for(var i=0;i<7;i++){var dd=new Date(sd);dd.setDate(sd.getDate()+i);var ds=dd.toISOString().split('T')[0];var isToday=ds===today.toISOString().split('T')[0];
var dayItems=items.filter(function(t){return t.date===ds&&(t.assignedTo===me||t.createdBy===me)});
h+='<div style="margin-bottom:8px;border-left:3px solid '+(isToday?'var(--ac)':'var(--bdr)')+';padding-left:8px">';
h+='<div style="font-size:11px;font-weight:600;color:'+(isToday?'var(--ac)':'var(--tx2)')+';margin-bottom:3px">'+dd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(isToday?' - Today':'')+'</div>';
if(dayItems.length){dayItems.sort(function(a,b){return(a.time||'zz').localeCompare(b.time||'zz')}).forEach(function(t){h+='<div style="display:flex;gap:6px;align-items:center;padding:3px 0"><span style="font-size:9px;color:var(--ac);min-width:40px">'+(t.time||'-')+'</span><span style="font-size:11px;color:var(--tx);cursor:pointer" onclick="openTaskDetail(\''+t.id+'\')">'+(t.type==='task'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>')+' '+(t.completed?'<s style="color:var(--tx3)">'+esc(t.title)+'</s>':esc(t.title))+'</span></div>'})}
else h+='<div style="font-size:10px;color:var(--tx3);padding:2px 0">-</div>';
h+='</div>'}return h}
function calWeekNav(dir){var s=new Date((window._calWeekStart||new Date().toISOString().split('T')[0])+'T12:00:00');s.setDate(s.getDate()+dir*7);window._calWeekStart=s.toISOString().split('T')[0];renderMeetingsView()}

function renderPlanningView(items){
var me=getUserName();var mine=items.filter(function(t){return(t.assignedTo===me||t.createdBy===me)&&!t.completed});
var overdue=mine.filter(function(t){return t.date&&t.date<new Date().toISOString().split('T')[0]});
var thisWeek=[];var nextWeek=[];var later=[];var unscheduled=[];
var today=new Date();var sun=new Date(today);sun.setDate(today.getDate()-today.getDay());var endOfWeek=new Date(sun);endOfWeek.setDate(sun.getDate()+6);
var nextSun=new Date(sun);nextSun.setDate(sun.getDate()+7);var endNextWeek=new Date(nextSun);endNextWeek.setDate(nextSun.getDate()+6);
mine.forEach(function(t){if(!t.date){unscheduled.push(t);return}var td=t.date;var todayS=today.toISOString().split('T')[0];if(td<todayS)return;if(td<=endOfWeek.toISOString().split('T')[0])thisWeek.push(t);else if(td<=endNextWeek.toISOString().split('T')[0])nextWeek.push(t);else later.push(t)});
var h='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Planning Workspace</div>';
if(overdue.length){h+='<div style="font-size:11px;font-weight:600;color:var(--rd);margin-bottom:4px">🔴 Overdue ('+overdue.length+')</div>';overdue.forEach(function(t){h+=taskCard(t)})}
h+='<div style="font-size:11px;font-weight:600;color:var(--ac);margin:8px 0 4px">This Week ('+thisWeek.length+')</div>';
if(thisWeek.length)thisWeek.forEach(function(t){h+=taskCard(t)});else h+='<div style="color:var(--tx3);font-size:10px;padding:4px">Clear!</div>';
h+='<div style="font-size:11px;font-weight:600;color:var(--neon-blue);margin:8px 0 4px">Next Week ('+nextWeek.length+')</div>';
if(nextWeek.length)nextWeek.forEach(function(t){h+=taskCard(t)});else h+='<div style="color:var(--tx3);font-size:10px;padding:4px">Nothing yet</div>';
if(later.length){h+='<div style="font-size:11px;font-weight:600;color:var(--neon-purple);margin:8px 0 4px">Later ('+later.length+')</div>';later.forEach(function(t){h+=taskCard(t)})}
if(unscheduled.length){h+='<div style="font-size:11px;font-weight:600;color:var(--or);margin:8px 0 4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg> Unscheduled ('+unscheduled.length+')</div>';unscheduled.forEach(function(t){h+=taskCard(t)})}
var completed=items.filter(function(t){return(t.assignedTo===me||t.createdBy===me)&&t.completed});
h+='<div style="font-size:11px;font-weight:600;color:var(--gn);margin:10px 0 4px">✅ Completed ('+completed.length+')</div>';
completed.slice(0,5).forEach(function(t){h+=taskCard(t)});
return h}

function taskCard(m){var ico=m.type==='task'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';var od=m.date&&new Date(m.date)<new Date()&&!m.completed;return'<div class="card" style="padding:10px;cursor:pointer;border-left:3px solid '+(m.completed?'var(--gn)':od?'var(--rd)':'var(--ac)')+'" onclick="openTaskDetail(\''+m.id+'\')"><div style="display:flex;justify-content:space-between"><strong style="color:'+(m.completed?'var(--tx3)':'var(--ac)')+';font-size:12px">'+ico+' '+esc(m.title)+'</strong><span style="font-size:9px;color:var(--tx3)">'+(m.date||'')+'</span></div><div style="font-size:9px;color:var(--tx3)">'+(m.assignedTo?'→'+esc(m.assignedTo):'')+(m.linkedClient?' · <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+esc(m.linkedClient):'')+'</div></div>'}

function calNav(dir){window._calMonth=(window._calMonth||new Date().getMonth())+dir;if(window._calMonth>11){window._calMonth=0;window._calYear=(window._calYear||new Date().getFullYear())+1}if(window._calMonth<0){window._calMonth=11;window._calYear=(window._calYear||new Date().getFullYear())-1}renderMeetingsView()}

function newMeetingTask(){var qs=DB.quotes();var cs=DB.customers();var teamUsers=typeof getTeamUsers==='function'?getTeamUsers():['Randy','Marco R.','Alex M.','Chris W.'];var h='<div class="modal-title">New Task / Meeting</div><div class="fg"><label>Type</label><select id="mt-type"><option value="task"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Task</option><option value="meeting"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Meeting</option></select></div><div class="fg"><label>Title *</label><input id="mt-title"></div><div class="fg"><label>Description</label><textarea id="mt-desc" style="min-height:40px"></textarea></div><div class="fg"><label>Assign To</label><select id="mt-assign"><option value="'+getUserName()+'">Me</option>';teamUsers.forEach(function(u){if(u!==getUserName())h+='<option>'+u+'</option>'});h+='</select></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div class="fg"><label>Date</label><input id="mt-date" type="date" value="'+new Date().toISOString().split('T')[0]+'"></div><div class="fg"><label>Time</label><input id="mt-time" type="time" value="10:00"></div></div><div class="fg"><label>Link Quote</label><select id="mt-lq"><option value="">None</option>';qs.slice(0,20).forEach(function(q){h+='<option value="'+esc(q.quoteNum)+'">'+esc(q.quoteNum)+'</option>'});h+='</select></div><div class="fg"><label>Link Client</label><select id="mt-lc"><option value="">None</option>';cs.slice(0,20).forEach(function(c){h+='<option value="'+esc(c.company)+'">'+esc(c.company)+'</option>'});h+='</select></div><div class="fg"><label>Priority</label><select id="mt-pri"><option>Normal</option><option>High</option><option>Urgent</option></select></div><button class="btn btn-pr" onclick="saveTask()" style="width:100%;margin-top:8px">Save</button><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';openModal(h)}

function saveTask(){var title=($('mt-title')||{}).value;if(!title)return toast('Title required','err');var t={type:($('mt-type')||{}).value||'task',title:title.trim(),description:($('mt-desc')||{}).value||'',assignedTo:($('mt-assign')||{}).value||getUserName(),date:($('mt-date')||{}).value||'',time:($('mt-time')||{}).value||'',estTime:60,timeSpent:0,linkedQuote:($('mt-lq')||{}).value||'',linkedClient:($('mt-lc')||{}).value||'',priority:($('mt-pri')||{}).value||'Normal',completed:false,pointsEarned:0,notes:[],subtasks:[],links:[],createdBy:getUserName(),createdAt:new Date().toISOString()};fbDb.collection('tasks').add(t).then(function(){closeModal();toast('Saved!','ok');renderMeetingsView();if(t.date&&typeof createCalendarEvent==='function')createCalendarEvent((t.type==='task'?'📋 ':'📅 ')+t.title,t.description,t.date,t.time,60)}).catch(function(e){toast(e.message,'err')})}

function scheduleMeeting(qid){newMeetingTask();var q=qid?getQ(qid):null;if(q)setTimeout(function(){if($('mt-title'))$('mt-title').value=q.quoteNum+' - '+(q.fields.custCo||'');if($('mt-lq'))$('mt-lq').value=q.quoteNum;if($('mt-type'))$('mt-type').value='meeting'},200)}

function openTaskDetail(tid){fbDb.collection('tasks').doc(tid).get().then(function(doc){if(!doc.exists)return;var t=Object.assign({id:doc.id},doc.data());var h='<div class="modal-title">'+(t.type==='task'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>')+' '+esc(t.title)+'</div>';if(t.completed)h+='<div style="background:var(--gn2);border:1px solid var(--gn);border-radius:6px;padding:6px;margin-bottom:6px;font-size:10px;color:var(--gn)">✅ Completed</div>';h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:8px;line-height:1.7"><b>Date:</b> '+(t.date||'-')+' · <b>Assigned:</b> '+esc(t.assignedTo||'-')+' · <b>Priority:</b> '+esc(t.priority)+'</div>';if(t.description)h+='<div style="font-size:11px;color:var(--tx2);background:var(--bg3);padding:6px;border-radius:6px;margin-bottom:6px">'+esc(t.description)+'</div>';var subs=t.subtasks||[];if(subs.length){h+='<div style="font-size:10px;font-weight:600;margin-bottom:3px">Subtasks</div>';subs.forEach(function(s,i){h+='<div style="font-size:10px;padding:2px 0;cursor:pointer" onclick="toggleSubtask(\''+tid+'\','+i+')">'+(s.done?'✅':'☐')+' '+esc(s.text)+'</div>'})}h+='<div style="display:flex;gap:4px;margin:4px 0"><input id="task-sub" placeholder="Add subtask" style="flex:1;padding:3px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:10px"><button class="btn btn-ghost btn-xs" onclick="addSubtask(\''+tid+'\')">+</button></div>';h+='<div style="font-size:10px;font-weight:600;margin:6px 0 3px">Notes ('+(t.notes||[]).length+')</div>';(t.notes||[]).forEach(function(n){h+='<div style="padding:3px 0;border-bottom:1px solid var(--bdr);font-size:10px"><strong style="color:var(--ac)">'+esc(n.by)+'</strong> '+esc(n.text)+'</div>'});h+='<textarea id="task-note" placeholder="Add note..." style="width:100%;min-height:30px;padding:4px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:10px;margin:4px 0"></textarea><button class="btn btn-ghost btn-xs" onclick="addTaskNote(\''+tid+'\')" style="width:100%;margin-bottom:6px">Post</button>';h+='<div style="display:flex;gap:4px">';if(!t.completed)h+='<button class="btn btn-gn btn-sm" onclick="completeTask(\''+tid+'\')" style="flex:1">✅ Done</button>';else h+='<button class="btn btn-ghost btn-sm" onclick="reopenTask(\''+tid+'\')" style="flex:1">↩ Reopen</button>';h+='<button class="btn btn-ghost btn-sm" onclick="deleteTask(\''+tid+'\')" style="flex:1;color:var(--rd)">🗑</button><button class="btn btn-ghost btn-sm" onclick="closeModal()" style="flex:1">Close</button></div>';openModal(h)}).catch(function(e){ console.warn('APP get:', e.message); })}

function addSubtask(tid){var el=$('task-sub');if(!el||!el.value.trim())return;fbDb.collection('tasks').doc(tid).get().then(function(doc){var t=doc.data();var s=t.subtasks||[];s.push({text:el.value.trim(),done:false});fbDb.collection('tasks').doc(tid).update({subtasks:s}).then(function(){closeModal();openTaskDetail(tid)})}).catch(function(e){ console.warn('APP get:', e.message); })}
function toggleSubtask(tid,idx){fbDb.collection('tasks').doc(tid).get().then(function(doc){var t=doc.data();var s=t.subtasks||[];if(s[idx]){s[idx].done=!s[idx].done;s[idx].completedAt=s[idx].done?new Date().toISOString():null}fbDb.collection('tasks').doc(tid).update({subtasks:s}).then(function(){closeModal();openTaskDetail(tid)})}).catch(function(e){ console.warn('APP get:', e.message); })}
function addTaskNote(tid){var el=$('task-note');if(!el||!el.value.trim())return;fbDb.collection('tasks').doc(tid).get().then(function(doc){var t=doc.data();var n=t.notes||[];n.push({by:getUserName(),text:el.value.trim(),at:fD(new Date().toISOString())});fbDb.collection('tasks').doc(tid).update({notes:n}).then(function(){closeModal();openTaskDetail(tid)})}).catch(function(e){ console.warn('APP get:', e.message); })}
function logTaskTime(tid){var m=parseInt(($('task-time')||{}).value);if(!m)return;fbDb.collection('tasks').doc(tid).get().then(function(doc){var t=doc.data();fbDb.collection('tasks').doc(tid).update({timeSpent:(t.timeSpent||0)+m}).then(function(){closeModal();openTaskDetail(tid);toast(m+'m logged','ok')})}).catch(function(e){ console.warn('APP get:', e.message); })}
function completeTask(tid){fbDb.collection('tasks').doc(tid).update({completed:true,completedAt:new Date().toISOString(),pointsEarned:firebase.firestore.FieldValue.increment(0.5)}).then(function(){closeModal();toast('Done! +0.5 pts','ok');renderMeetingsView()})}
function reopenTask(tid){fbDb.collection('tasks').doc(tid).update({completed:false,completedAt:null}).then(function(){closeModal();toast('Reopened','ok');renderMeetingsView()})}
function deleteTask(tid){if(!confirm('Delete?'))return;fbDb.collection('tasks').doc(tid).delete().then(function(){closeModal();toast('Deleted','ok');renderMeetingsView()})}
function showDayTasks(ds){fbDb.collection('tasks').where('date','==',ds).get().then(function(snap){var items=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});var h='<div class="modal-title">'+new Date(ds+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+'</div>';items.forEach(function(m){h+='<div class="card" style="padding:8px;margin-bottom:6px;cursor:pointer" onclick="closeModal();openTaskDetail(\''+m.id+'\')"><strong style="color:var(--ac)">'+(m.type==='task'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>')+' '+esc(m.title)+'</strong></div>'});if(!items.length)h+='<div style="color:var(--tx3);padding:12px;text-align:center">No items</div>';h+='<button class="btn btn-pr" onclick="closeModal();newMeetingTask()" style="width:100%;margin-top:8px">+ New</button><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Close</button>';openModal(h)}).catch(function(e){ console.warn('APP get:', e.message); })}

