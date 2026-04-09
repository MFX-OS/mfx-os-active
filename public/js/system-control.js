// ══════════════════════════════════════════════════════════════════
// MFX OS — System Control (Admin Panel)
// Centralized user, department, task, deliverable & system management
// ══════════════════════════════════════════════════════════════════

(function(){'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function fmtDate(d){if(!d)return'---';var dt=d.toDate?d.toDate():(d.seconds?new Date(d.seconds*1000):new Date(d));return isNaN(dt)?String(d):dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
function fmtShort(d){if(!d)return'---';var dt=d.toDate?d.toDate():(d.seconds?new Date(d.seconds*1000):new Date(d));return isNaN(dt)?String(d):dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function timeAgo(d){if(!d)return'---';var dt=d.toDate?d.toDate():(d.seconds?new Date(d.seconds*1000):new Date(d));var s=Math.floor((Date.now()-dt.getTime())/1000);if(s<60)return s+'s ago';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function avatar(name,sz){var n=name||'?';var c='#'+('000000'+((n.charCodeAt(0)*2654435761)>>>0).toString(16)).slice(-6);return'<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+c+';display:inline-flex;align-items:center;justify-content:center;font-size:'+(sz*0.42)+'px;font-weight:700;color:#fff;flex-shrink:0">'+esc(n.charAt(0).toUpperCase())+'</div>'}

var ADMIN_ROLES=['ceo','admin','administrator','owner','operations manager'];
var DEPARTMENTS=['Leadership','Operations & Support','Client Services','Pre-Press Design','Production','QA/SQF','Logistics','Maintenance','Finance','HR'];
var DEPT_COLORS={Leadership:'#6366f1','Operations & Support':'#f59e0b','Client Services':'#ec4899','Pre-Press Design':'#8b5cf6',Production:'#22c55e','QA/SQF':'#06b6d4',Logistics:'#f97316',Maintenance:'#64748b',Finance:'#eab308',HR:'#a855f7'};

// ─── State ───
var state={
  tab:'system',
  selectedUserId:null,
  editUserId:null,
  userSubTab:'profile',
  search:'',
  filterDept:'All',
  filterRole:'All',
  taskFilter:{assignee:'All',status:'All',priority:'All'},
  activityFilter:{user:'All',action:'All',days:7},
  delivSubTab:'quotes',
  expandedDept:null,
  expandedTask:null
};

var cache={users:[],activity:[],tasks:[],presence:{},loaded:{}};

var TABS=[
  {id:'system',label:'System'},
  {id:'functions',label:'Functions'},
  {id:'users',label:'Users'},
  {id:'departments',label:'Departments'},
  {id:'tasks',label:'Tasks'},
  {id:'deliverables',label:'Deliverables'},
  {id:'activity',label:'Activity Log'}
];

// ─── Styles ───
var S={
  wrap:'display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--tx);',
  topBar:'background:var(--bg2);padding:8px 16px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--bdr);align-items:center;',
  content:'flex:1;overflow-y:auto;padding:16px;',
  card:'background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:16px;',
  kpi:'background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px;text-align:center;min-width:120px;flex:1;',
  table:'width:100%;border-collapse:collapse;font-size:12px;',
  th:'padding:10px 12px;text-align:left;font-size:9px;color:var(--ac);letter-spacing:1.5px;font-weight:700;border-bottom:2px solid var(--bdr);text-transform:uppercase;',
  td:'padding:8px 12px;border-bottom:1px solid var(--bdr);color:var(--tx);',
  btn:'padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;',
  input:'background:var(--bg);border:1px solid var(--bdr);border-radius:6px;padding:8px 12px;color:var(--tx);font-size:12px;outline:none;',
  badge:'display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;'
};

// ═══════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════
function renderSystemControl(){
  var el=document.getElementById('v-systemcontrol');if(!el)return;
  var p=typeof getMFXProfile==='function'?getMFXProfile():{};
  var userRole=(p.role||'').toLowerCase();
  if(!ADMIN_ROLES.includes(userRole)){
    el.innerHTML='<div style="padding:60px;text-align:center"><div style="font-size:48px;margin-bottom:16px">🔒</div><div style="font-size:16px;font-weight:700;color:var(--tx)">Access Denied</div><div style="font-size:12px;color:var(--tx3);margin-top:8px">System Control requires CEO or Admin role</div></div>';
    return;
  }

  var h='<div style="'+S.wrap+'">';
  // Tab bar
  h+='<div style="'+S.topBar+'">';
  h+='<div style="font-size:13px;font-weight:800;color:var(--ac);letter-spacing:1px;margin-right:12px">SYSTEM CONTROL</div>';
  TABS.forEach(function(t){
    var act=state.tab===t.id&&!state.selectedUserId&&!state.editUserId;
    h+='<button onclick="MFX.SC.setTab(\''+t.id+'\')" style="'+S.btn+(act?'background:var(--ac);color:#000;':'background:transparent;color:var(--tx2);border:1px solid var(--bdr);')+'">'+t.label+'</button>';
  });
  h+='</div>';
  h+='<div id="sc-content" style="'+S.content+'"></div>';
  h+='</div>';
  el.innerHTML=h;
  setTimeout(renderContent,0);
}

function renderContent(){
  var c=document.getElementById('sc-content');if(!c)return;
  if(state.editUserId){renderUserEditForm(c);return;}
  if(state.selectedUserId){renderUserDetail(c);return;}
  switch(state.tab){
    case'system':renderSystemTab(c);break;
    case'functions':renderFunctionsTab(c);break;
    case'users':renderUsersTab(c);break;
    case'departments':renderDepartmentsTab(c);break;
    case'tasks':renderTasksTab(c);break;
    case'deliverables':renderDeliverablesTab(c);break;
    case'activity':renderActivityTab(c);break;
  }
}

function setTab(t){state.tab=t;state.selectedUserId=null;state.editUserId=null;renderContent()}

// ═══════════════════════════════════════
// TAB 1: SYSTEM
// ═══════════════════════════════════════
function renderSystemTab(c){
  c.innerHTML='<div style="text-align:center;padding:40px;color:var(--tx3)">Loading system stats...</div>';
  loadSystemStats().then(function(stats){
    var h='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">';
    h+=kpiCard('Online Now',stats.online,'#22c55e');
    h+=kpiCard('Total Users',stats.totalUsers,'#6366f1');
    h+=kpiCard('Active Listeners',stats.listeners,'#f59e0b');
    h+=kpiCard('Last Activity',stats.lastActivity,'#00e5ff');
    h+=kpiCard('App Version','v2.0','#ec4899');
    h+='</div>';

    // Environment
    h+='<div style="'+S.card+';margin-bottom:16px">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:10px">ENVIRONMENT</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">';
    var fbApp=typeof firebase!=='undefined'&&firebase.app?firebase.app():{options:{}};
    var opts=fbApp.options||{};
    h+='<div><span style="color:var(--tx3)">Project:</span> <span style="color:var(--tx)">'+esc(opts.projectId||'—')+'</span></div>';
    h+='<div><span style="color:var(--tx3)">Auth Domain:</span> <span style="color:var(--tx)">'+esc(opts.authDomain||'—')+'</span></div>';
    h+='<div><span style="color:var(--tx3)">Platform:</span> <span style="color:var(--tx)">'+navigator.platform+'</span></div>';
    h+='<div><span style="color:var(--tx3)">SW Status:</span> <span style="color:var(--tx)">'+(navigator.serviceWorker&&navigator.serviceWorker.controller?'Active':'None')+'</span></div>';
    h+='<div><span style="color:var(--tx3)">Connection:</span> <span style="color:'+(navigator.onLine?'#22c55e':'#ef4444')+'">'+( navigator.onLine?'Online':'Offline')+'</span></div>';
    h+='<div><span style="color:var(--tx3)">Page Load:</span> <span style="color:var(--tx)">'+new Date().toLocaleTimeString()+'</span></div>';
    h+='</div></div>';

    // Feature Flags
    h+='<div style="'+S.card+'">';
    h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:10px">FEATURE FLAGS</div>';
    h+='<div id="sc-flags" style="font-size:11px;color:var(--tx3)">Loading flags...</div>';
    h+='</div>';

    c.innerHTML=h;
    loadFeatureFlags();
  });
}

function kpiCard(label,value,color){
  return'<div style="'+S.kpi+'"><div style="font-size:22px;font-weight:900;color:'+color+'">'+esc(String(value))+'</div><div style="font-size:9px;color:var(--tx3);margin-top:4px;letter-spacing:1px;text-transform:uppercase">'+esc(label)+'</div></div>';
}

function loadSystemStats(){
  var stats={online:0,totalUsers:0,listeners:0,lastActivity:'—'};
  var promises=[];
  if(typeof fbDb!=='undefined'){
    promises.push(fbDb.collection('users').get().then(function(snap){
      stats.totalUsers=snap.size;
      var now=Date.now();
      snap.docs.forEach(function(d){
        var u=d.data();
        if(u.lastSeen){
          var ls=u.lastSeen.toDate?u.lastSeen.toDate():new Date(u.lastSeen);
          if((now-ls.getTime())<300000)stats.online++;
        }
      });
    }));
    promises.push(fbDb.collection('activity').orderBy('timestamp','desc').limit(1).get().then(function(snap){
      if(snap.docs.length){var d=snap.docs[0].data();stats.lastActivity=timeAgo(d.timestamp||d.at)}
    }));
  }
  stats.listeners=Object.keys(window._mfxGlobalListeners||{}).length;
  return Promise.all(promises).then(function(){return stats}).catch(function(){return stats});
}

function loadFeatureFlags(){
  var el=document.getElementById('sc-flags');if(!el)return;
  if(typeof fbDb==='undefined'){el.innerHTML='Firestore not available';return}
  fbDb.collection('controlConfigs').doc('moduleToggles').get().then(function(doc){
    var flags=doc.exists?doc.data():{};
    var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    var allKeys=Object.keys(flags);
    if(!allKeys.length){
      h+='<div style="color:var(--tx3);grid-column:1/-1">No feature flags configured yet. Toggling modules in the Functions tab will create them.</div>';
    }
    allKeys.forEach(function(k){
      var on=!!flags[k];
      h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:6px">';
      h+='<span style="color:var(--tx)">'+esc(k)+'</span>';
      h+='<span style="color:'+(on?'#22c55e':'#ef4444')+';font-weight:700">'+(on?'ON':'OFF')+'</span>';
      h+='</div>';
    });
    h+='</div>';
    el.innerHTML=h;
  }).catch(function(){el.innerHTML='Error loading flags'});
}

// ═══════════════════════════════════════
// TAB 2: FUNCTIONS
// ═══════════════════════════════════════
function renderFunctionsTab(c){
  var renderers=window.MFX_VIEW_RENDERERS||{};
  var titles=window.MFX_VIEW_TITLES||{};
  var keys=Object.keys(renderers).sort();

  var h='<div style="'+S.card+';margin-bottom:16px">';
  h+='<div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;margin-bottom:10px">REGISTERED MODULES ('+keys.length+')</div>';
  h+='<table style="'+S.table+'">';
  h+='<thead><tr><th style="'+S.th+'">Module</th><th style="'+S.th+'">View Key</th><th style="'+S.th+'">Status</th><th style="'+S.th+'">Toggle</th></tr></thead><tbody>';
  keys.forEach(function(k,i){
    var loaded=typeof renderers[k]==='function';
    var title=titles[k]||k;
    var bg=i%2===0?'transparent':'var(--bg3)';
    h+='<tr style="background:'+bg+'">';
    h+='<td style="'+S.td+'"><span style="font-weight:600">'+esc(title)+'</span></td>';
    h+='<td style="'+S.td+'"><code style="font-size:10px;color:var(--tx3)">'+esc(k)+'</code></td>';
    h+='<td style="'+S.td+'"><span style="'+S.badge+'background:'+(loaded?'rgba(34,197,94,.15);color:#22c55e':'rgba(239,68,68,.15);color:#ef4444')+'">'+(loaded?'Loaded':'Not loaded')+'</span></td>';
    h+='<td style="'+S.td+'"><button onclick="MFX.SC.toggleModule(\''+esc(k)+'\')" style="'+S.btn+'background:var(--bg);color:var(--tx2);border:1px solid var(--bdr);font-size:10px">Toggle</button></td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  c.innerHTML=h;
}

function toggleModule(viewKey){
  if(typeof fbDb==='undefined')return;
  fbDb.collection('controlConfigs').doc('moduleToggles').get().then(function(doc){
    var flags=doc.exists?doc.data():{};
    flags[viewKey]=!flags[viewKey];
    return fbDb.collection('controlConfigs').doc('moduleToggles').set(flags,{merge:true});
  }).then(function(){
    toast('Module toggle saved for '+viewKey,'ok');
    renderContent();
  }).catch(function(e){toast('Error: '+e.message,'err')});
}

// ═══════════════════════════════════════
// TAB 3: USERS
// ═══════════════════════════════════════
function renderUsersTab(c){
  c.innerHTML='<div style="text-align:center;padding:40px;color:var(--tx3)">Loading users...</div>';
  loadUsers().then(function(){
    var h='';
    // Filters
    h+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';
    h+='<input placeholder="Search users..." value="'+esc(state.search)+'" oninput="MFX.SC.onSearch(this.value)" style="'+S.input+'flex:1;min-width:180px">';
    h+='<select onchange="MFX.SC.onDeptFilter(this.value)" style="'+S.input+'">';
    h+='<option value="All">All Departments</option>';
    DEPARTMENTS.forEach(function(d){h+='<option'+(state.filterDept===d?' selected':'')+'>'+esc(d)+'</option>'});
    h+='</select>';
    h+='<span style="font-size:11px;color:var(--tx3)">'+cache.users.length+' users</span>';
    h+='</div>';

    // Filter
    var filtered=cache.users.filter(function(u){
      if(state.filterDept!=='All'&&(u.dept||'')!==state.filterDept)return false;
      if(state.search){
        var q=state.search.toLowerCase();
        if((u.displayName||'').toLowerCase().indexOf(q)===-1&&(u.email||'').toLowerCase().indexOf(q)===-1&&(u.role||'').toLowerCase().indexOf(q)===-1)return false;
      }
      return true;
    });

    // Table
    h+='<table style="'+S.table+'">';
    h+='<thead><tr><th style="'+S.th+'"></th><th style="'+S.th+'">Name</th><th style="'+S.th+'">Email</th><th style="'+S.th+'">Dept</th><th style="'+S.th+'">Role</th><th style="'+S.th+'">Last Seen</th><th style="'+S.th+'">Status</th></tr></thead><tbody>';
    filtered.forEach(function(u,i){
      var bg=i%2===0?'transparent':'var(--bg3)';
      var online=isOnline(u);
      h+='<tr style="background:'+bg+';cursor:pointer" onclick="MFX.SC.selectUser(\''+esc(u.uid)+'\')">';
      h+='<td style="'+S.td+'">'+avatar(u.displayName,28)+'</td>';
      h+='<td style="'+S.td+'font-weight:600;">'+esc(u.displayName||'—')+'</td>';
      h+='<td style="'+S.td+'font-size:11px;color:var(--tx3)">'+esc(u.email||'—')+'</td>';
      h+='<td style="'+S.td+'">'+deptBadge(u.dept)+'</td>';
      h+='<td style="'+S.td+'font-size:11px">'+esc(u.role||'—')+'</td>';
      h+='<td style="'+S.td+'font-size:10px;color:var(--tx3)">'+timeAgo(u.lastSeen)+'</td>';
      h+='<td style="'+S.td+'"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+(online?'#22c55e':'#64748b')+'"></span></td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
    c.innerHTML=h;
  });
}

function isOnline(u){
  if(!u.lastSeen)return false;
  var dt=u.lastSeen.toDate?u.lastSeen.toDate():(u.lastSeen.seconds?new Date(u.lastSeen.seconds*1000):new Date(u.lastSeen));
  return(Date.now()-dt.getTime())<300000;
}

function deptBadge(d){
  if(!d)return'<span style="font-size:10px;color:var(--tx3)">—</span>';
  var col=DEPT_COLORS[d]||'#64748b';
  return'<span style="'+S.badge+'background:'+col+'20;color:'+col+'">'+esc(d)+'</span>';
}

function loadUsers(){
  if(cache.loaded.users)return Promise.resolve();
  if(typeof fbDb==='undefined')return Promise.resolve();
  return fbDb.collection('users').get().then(function(snap){
    cache.users=snap.docs.map(function(d){var u=d.data();u.uid=d.id;return u});
    cache.loaded.users=true;
  }).catch(function(e){console.warn('SC loadUsers:',e.message)});
}

// ─── User Detail ───
function renderUserDetail(c){
  var u=cache.users.find(function(x){return x.uid===state.selectedUserId});
  if(!u){c.innerHTML='User not found';return}

  var h='<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">';
  h+='<button onclick="MFX.SC.back()" style="'+S.btn+'background:var(--bg2);color:var(--tx2);border:1px solid var(--bdr)">← Back</button>';
  h+=avatar(u.displayName,40);
  h+='<div><div style="font-size:16px;font-weight:800;color:var(--tx)">'+esc(u.displayName||'Unknown')+'</div>';
  h+='<div style="font-size:11px;color:var(--tx3)">'+esc(u.email)+' · '+esc(u.role||'No role')+' · '+deptBadge(u.dept)+'</div></div>';
  h+='<div style="flex:1"></div>';
  h+='<button onclick="MFX.SC.editUser(\''+esc(u.uid)+'\')" style="'+S.btn+'background:var(--ac);color:#000">Edit User</button>';
  h+='</div>';

  // Sub-tabs
  var subs=['profile','activity','tasks','stats','messages'];
  h+='<div style="display:flex;gap:4px;margin-bottom:14px">';
  subs.forEach(function(s){
    var act=state.userSubTab===s;
    h+='<button onclick="MFX.SC.userSubTab(\''+s+'\')" style="'+S.btn+(act?'background:var(--ac);color:#000;':'background:transparent;color:var(--tx2);border:1px solid var(--bdr);')+'text-transform:capitalize">'+s+'</button>';
  });
  h+='</div>';

  h+='<div id="sc-user-content"></div>';
  c.innerHTML=h;
  setTimeout(function(){renderUserSubContent(u)},0);
}

function renderUserSubContent(u){
  var c=document.getElementById('sc-user-content');if(!c)return;
  switch(state.userSubTab){
    case'profile':renderUserProfile(c,u);break;
    case'activity':renderUserActivity(c,u);break;
    case'tasks':renderUserTasks(c,u);break;
    case'stats':renderUserStats(c,u);break;
    case'messages':renderUserMessages(c,u);break;
  }
}

function renderUserProfile(c,u){
  var h='<div style="'+S.card+'">';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:12px">';
  var fields=[
    ['Display Name',u.displayName],['Email',u.email],['UID',u.uid],
    ['Department',u.dept],['Role',u.role],['Flex ID',u.flexId],
    ['Pods',u.pods],['Year Joined',u.yearJoined],['Last Login',fmtDate(u.lastLogin)],
    ['Last Seen',fmtDate(u.lastSeen)],['PPD Access',u.permissions&&u.permissions.ppd?'Yes':'No'],
    ['Commercial Access',u.permissions&&u.permissions.commercial?'Yes':'No']
  ];
  fields.forEach(function(f){
    h+='<div><div style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;margin-bottom:2px">'+esc(f[0].toUpperCase())+'</div>';
    h+='<div style="color:var(--tx)">'+esc(String(f[1]||'—'))+'</div></div>';
  });
  h+='</div></div>';
  c.innerHTML=h;
}

function renderUserActivity(c,u){
  c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading activity...</div>';
  if(typeof fbDb==='undefined')return;
  fbDb.collection('activity').where('userId','==',u.uid).orderBy('timestamp','desc').limit(50).get().then(function(snap){
    if(!snap.docs.length){c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">No activity recorded</div>';return}
    var h='<table style="'+S.table+'">';
    h+='<thead><tr><th style="'+S.th+'">Time</th><th style="'+S.th+'">Action</th><th style="'+S.th+'">Detail</th></tr></thead><tbody>';
    snap.docs.forEach(function(d,i){
      var a=d.data();var bg=i%2===0?'transparent':'var(--bg3)';
      h+='<tr style="background:'+bg+'"><td style="'+S.td+'font-size:10px;color:var(--tx3);white-space:nowrap">'+fmtDate(a.timestamp)+'</td>';
      h+='<td style="'+S.td+'"><span style="'+S.badge+'background:rgba(0,229,255,.1);color:#00e5ff">'+esc(a.action)+'</span></td>';
      h+='<td style="'+S.td+'font-size:11px">'+esc(a.detail||'')+'</td></tr>';
    });
    h+='</tbody></table>';
    c.innerHTML=h;
  }).catch(function(e){c.innerHTML='<div style="color:var(--rd);padding:20px">Error: '+esc(e.message)+'</div>'});
}

function renderUserTasks(c,u){
  c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading tasks...</div>';
  if(typeof fbDb==='undefined')return;
  fbDb.collection('tasks').where('assignedTo','==',u.displayName||'').orderBy('createdAt','desc').limit(50).get().then(function(snap){
    if(!snap.docs.length){c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">No tasks assigned</div>';return}
    var h='<table style="'+S.table+'">';
    h+='<thead><tr><th style="'+S.th+'">Title</th><th style="'+S.th+'">Priority</th><th style="'+S.th+'">Status</th><th style="'+S.th+'">Time</th><th style="'+S.th+'">Due</th></tr></thead><tbody>';
    snap.docs.forEach(function(d,i){
      var t=d.data();var bg=i%2===0?'transparent':'var(--bg3)';
      var statusCol=t.completed?'#22c55e':'#f59e0b';
      h+='<tr style="background:'+bg+'">';
      h+='<td style="'+S.td+'font-weight:600">'+esc(t.title||'—')+'</td>';
      h+='<td style="'+S.td+'"><span style="'+S.badge+'background:'+(t.priority==='Urgent'?'rgba(239,68,68,.15);color:#ef4444':t.priority==='High'?'rgba(249,115,22,.15);color:#f97316':'rgba(100,116,139,.15);color:#94a3b8')+'">'+esc(t.priority||'Normal')+'</span></td>';
      h+='<td style="'+S.td+'"><span style="color:'+statusCol+';font-weight:600">'+(t.completed?'Done':'Open')+'</span></td>';
      h+='<td style="'+S.td+'font-size:10px">'+(t.timeSpent?t.timeSpent+'m':'—')+'</td>';
      h+='<td style="'+S.td+'font-size:10px;color:var(--tx3)">'+fmtShort(t.date)+'</td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
    c.innerHTML=h;
  }).catch(function(e){c.innerHTML='<div style="color:var(--rd);padding:20px">Error: '+esc(e.message)+'</div>'});
}

function renderUserStats(c,u){
  var h='<div style="display:flex;gap:12px;flex-wrap:wrap">';
  // Get gamification data from quotes
  var qs=typeof DB!=='undefined'&&DB.quotes?DB.quotes():[];
  var userQs=qs.filter(function(q){return(q.fields&&q.fields.estimator)===(u.displayName||'_none_')});
  var won=userQs.filter(function(q){return q.status==='won'}).length;
  var sent=userQs.filter(function(q){return q.status==='sent'||q.status==='won'||q.status==='lost'}).length;
  var total=userQs.length;

  h+=kpiCard('Quotes Created',total,'#6366f1');
  h+=kpiCard('Quotes Sent',sent,'#00e5ff');
  h+=kpiCard('Quotes Won',won,'#22c55e');
  h+=kpiCard('Win Rate',total>0?Math.round(won/total*100)+'%':'—','#f59e0b');
  h+=kpiCard('Online',isOnline(u)?'Yes':'No',isOnline(u)?'#22c55e':'#64748b');
  h+='</div>';
  c.innerHTML=h;
}

function renderUserMessages(c,u){
  c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading notifications...</div>';
  if(typeof fbDb==='undefined')return;
  fbDb.collection('notifications').where('userId','==',u.uid).orderBy('timestamp','desc').limit(30).get().then(function(snap){
    if(!snap.docs.length){c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">No notifications</div>';return}
    var h='<div style="display:flex;flex-direction:column;gap:6px">';
    snap.docs.forEach(function(d){
      var n=d.data();
      h+='<div style="'+S.card+'padding:10px">';
      h+='<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(n.title||'—')+'</span>';
      h+='<span style="font-size:10px;color:var(--tx3)">'+fmtDate(n.timestamp)+'</span></div>';
      h+='<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+esc(n.body||'')+'</div>';
      h+='</div>';
    });
    h+='</div>';
    c.innerHTML=h;
  }).catch(function(e){c.innerHTML='<div style="color:var(--rd);padding:20px">Error: '+esc(e.message)+'</div>'});
}

// ─── User Edit Form ───
function renderUserEditForm(c){
  var u=cache.users.find(function(x){return x.uid===state.editUserId});
  if(!u){c.innerHTML='User not found';return}

  var h='<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">';
  h+='<button onclick="MFX.SC.cancelEdit()" style="'+S.btn+'background:var(--bg2);color:var(--tx2);border:1px solid var(--bdr)">← Cancel</button>';
  h+='<div style="font-size:16px;font-weight:800;color:var(--tx)">Edit User: '+esc(u.displayName||u.email)+'</div></div>';

  h+='<div style="'+S.card+'">';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">';

  function field(lbl,id,val,type){
    h+='<div><label style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;display:block;margin-bottom:4px">'+esc(lbl.toUpperCase())+'</label>';
    h+='<input id="scf-'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'" style="'+S.input+'width:100%;box-sizing:border-box"></div>';
  }

  field('Display Name','displayName',u.displayName);
  field('Email','email',u.email,'email');
  field('Flex ID','flexId',u.flexId);

  // Department dropdown
  h+='<div><label style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;display:block;margin-bottom:4px">DEPARTMENT</label>';
  h+='<select id="scf-dept" style="'+S.input+'width:100%;box-sizing:border-box">';
  h+='<option value="">— None —</option>';
  DEPARTMENTS.forEach(function(d){h+='<option'+(u.dept===d?' selected':'')+'>'+esc(d)+'</option>'});
  h+='</select></div>';

  field('Role','role',u.role);
  field('Pods','pods',u.pods);
  field('Year Joined','yearJoined',u.yearJoined);

  // Permissions
  h+='<div><label style="font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1px;display:block;margin-bottom:4px">PERMISSIONS</label>';
  h+='<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">';
  h+='<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx)"><input type="checkbox" id="scf-ppd" '+(u.permissions&&u.permissions.ppd?'checked':'')+' style="accent-color:var(--ac)"> PPD Access</label>';
  h+='<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx)"><input type="checkbox" id="scf-commercial" '+(u.permissions&&u.permissions.commercial?'checked':'')+' style="accent-color:var(--ac)"> Commercial Access</label>';
  h+='</div></div>';

  h+='</div>';
  h+='<div style="display:flex;gap:8px;margin-top:16px">';
  h+='<button onclick="MFX.SC.saveUser()" style="'+S.btn+'background:var(--ac);color:#000">Save Changes</button>';
  h+='<button onclick="MFX.SC.cancelEdit()" style="'+S.btn+'background:transparent;color:var(--tx2);border:1px solid var(--bdr)">Cancel</button>';
  h+='</div></div>';
  c.innerHTML=h;
}

function saveUser(){
  var uid=state.editUserId;if(!uid)return;
  var gv=function(id){var el=document.getElementById(id);return el?el.value.trim():''};
  var gc=function(id){var el=document.getElementById(id);return el?el.checked:false};

  var payload={
    displayName:gv('scf-displayName'),
    dept:gv('scf-dept'),
    role:gv('scf-role'),
    flexId:gv('scf-flexId'),
    pods:gv('scf-pods'),
    yearJoined:gv('scf-yearJoined'),
    permissions:{ppd:gc('scf-ppd'),commercial:gc('scf-commercial')},
    lastUpdated:new Date().toISOString()
  };

  if(typeof fbDb==='undefined'){toast('Firestore not available','err');return}
  fbDb.collection('users').doc(uid).set(payload,{merge:true}).then(function(){
    toast('User updated successfully','ok');
    // Update cache
    var u=cache.users.find(function(x){return x.uid===uid});
    if(u)Object.assign(u,payload);
    if(typeof DB!=='undefined'&&DB.logActivity)DB.logActivity('admin.user_edit','Edited user '+payload.displayName+' ('+uid+')');
    state.editUserId=null;
    state.selectedUserId=uid;
    renderContent();
  }).catch(function(e){toast('Save failed: '+e.message,'err')});
}

// ═══════════════════════════════════════
// TAB 4: DEPARTMENTS
// ═══════════════════════════════════════
function renderDepartmentsTab(c){
  c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading...</div>';
  loadUsers().then(function(){
    var deptMap={};
    DEPARTMENTS.forEach(function(d){deptMap[d]={name:d,members:[],tasks:0,completed:0}});
    cache.users.forEach(function(u){
      var d=u.dept||'Unassigned';
      if(!deptMap[d])deptMap[d]={name:d,members:[],tasks:0,completed:0};
      deptMap[d].members.push(u);
    });

    var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    Object.keys(deptMap).forEach(function(dk){
      var dept=deptMap[dk];
      if(!dept.members.length&&dk!=='Unassigned')return;
      var col=DEPT_COLORS[dk]||'#64748b';
      var expanded=state.expandedDept===dk;
      h+='<div style="'+S.card+(expanded?'grid-column:1/-1;':'')+'border-left:3px solid '+col+'">';
      h+='<div onclick="MFX.SC.toggleDept(\''+esc(dk)+'\')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">';
      h+='<div><div style="font-size:13px;font-weight:700;color:'+col+'">'+esc(dk)+'</div>';
      h+='<div style="font-size:11px;color:var(--tx3)">'+dept.members.length+' member'+(dept.members.length!==1?'s':'')+'</div></div>';
      h+='<span style="font-size:14px;color:var(--tx3);transition:transform .2s;transform:rotate('+(expanded?'90':'0')+'deg)">&#9656;</span>';
      h+='</div>';

      if(expanded){
        h+='<div style="margin-top:12px;border-top:1px solid var(--bdr);padding-top:10px">';
        if(!dept.members.length){h+='<div style="font-size:11px;color:var(--tx3)">No members</div>';}
        else{
          dept.members.forEach(function(u){
            var online=isOnline(u);
            h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)" onclick="MFX.SC.selectUser(\''+esc(u.uid)+'\')" style="cursor:pointer">';
            h+=avatar(u.displayName,24);
            h+='<div style="flex:1"><span style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(u.displayName||'—')+'</span>';
            h+=' <span style="font-size:10px;color:var(--tx3)">'+esc(u.role||'')+'</span></div>';
            h+='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+(online?'#22c55e':'#64748b')+'"></span>';
            h+='</div>';
          });
        }
        h+='</div>';
      }
      h+='</div>';
    });
    h+='</div>';
    c.innerHTML=h;
  });
}

// ═══════════════════════════════════════
// TAB 5: TASKS
// ═══════════════════════════════════════
function renderTasksTab(c){
  c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading tasks...</div>';
  loadTasks().then(function(){
    var h='';
    // Filters
    h+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';
    h+='<select onchange="MFX.SC.taskFilterStatus(this.value)" style="'+S.input+'">';
    ['All','Open','Completed'].forEach(function(s){h+='<option'+(state.taskFilter.status===s?' selected':'')+'>'+s+'</option>'});
    h+='</select>';
    h+='<select onchange="MFX.SC.taskFilterPriority(this.value)" style="'+S.input+'">';
    ['All','Urgent','High','Normal'].forEach(function(s){h+='<option'+(state.taskFilter.priority===s?' selected':'')+'>'+s+'</option>'});
    h+='</select>';
    h+='<span style="font-size:11px;color:var(--tx3)">'+cache.tasks.length+' tasks loaded</span>';
    h+='</div>';

    var filtered=cache.tasks.filter(function(t){
      if(state.taskFilter.status==='Open'&&t.completed)return false;
      if(state.taskFilter.status==='Completed'&&!t.completed)return false;
      if(state.taskFilter.priority!=='All'&&(t.priority||'Normal')!==state.taskFilter.priority)return false;
      return true;
    });

    h+='<table style="'+S.table+'">';
    h+='<thead><tr><th style="'+S.th+'">Title</th><th style="'+S.th+'">Assigned To</th><th style="'+S.th+'">Priority</th><th style="'+S.th+'">Status</th><th style="'+S.th+'">Time</th><th style="'+S.th+'">Due</th></tr></thead><tbody>';
    filtered.forEach(function(t,i){
      var bg=i%2===0?'transparent':'var(--bg3)';
      var statusCol=t.completed?'#22c55e':'#f59e0b';
      var expanded=state.expandedTask===t.id;
      h+='<tr style="background:'+bg+';cursor:pointer" onclick="MFX.SC.toggleTask(\''+esc(t.id)+'\')">';
      h+='<td style="'+S.td+'font-weight:600">'+esc(t.title||'—')+'</td>';
      h+='<td style="'+S.td+'font-size:11px">'+esc(t.assignedTo||'—')+'</td>';
      h+='<td style="'+S.td+'"><span style="'+S.badge+'background:'+(t.priority==='Urgent'?'rgba(239,68,68,.15);color:#ef4444':t.priority==='High'?'rgba(249,115,22,.15);color:#f97316':'rgba(100,116,139,.15);color:#94a3b8')+'">'+esc(t.priority||'Normal')+'</span></td>';
      h+='<td style="'+S.td+'"><span style="color:'+statusCol+';font-weight:600">'+(t.completed?'Done':'Open')+'</span></td>';
      h+='<td style="'+S.td+'font-size:10px">'+(t.timeSpent?t.timeSpent+'m':'—')+'</td>';
      h+='<td style="'+S.td+'font-size:10px;color:var(--tx3)">'+fmtShort(t.date)+'</td>';
      h+='</tr>';
      if(expanded){
        h+='<tr style="background:var(--bg2)"><td colspan="6" style="padding:12px">';
        h+='<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">'+esc(t.description||'No description')+'</div>';
        if(t.subtasks&&t.subtasks.length){
          h+='<div style="font-size:10px;color:var(--ac);font-weight:700;margin-bottom:4px">SUBTASKS</div>';
          t.subtasks.forEach(function(st){
            h+='<div style="font-size:11px;color:var(--tx);padding:2px 0">'+(st.done?'✅':'⬜')+' '+esc(st.text)+'</div>';
          });
        }
        if(t.notes&&t.notes.length){
          h+='<div style="font-size:10px;color:var(--ac);font-weight:700;margin-top:8px;margin-bottom:4px">NOTES</div>';
          t.notes.forEach(function(n){
            h+='<div style="font-size:11px;color:var(--tx2);padding:2px 0">'+esc(n.by)+': '+esc(n.text)+'</div>';
          });
        }
        h+='</td></tr>';
      }
    });
    h+='</tbody></table>';
    c.innerHTML=h;
  });
}

function loadTasks(){
  if(cache.loaded.tasks)return Promise.resolve();
  if(typeof fbDb==='undefined')return Promise.resolve();
  return fbDb.collection('tasks').orderBy('createdAt','desc').limit(200).get().then(function(snap){
    cache.tasks=snap.docs.map(function(d){var t=d.data();t.id=d.id;return t});
    cache.loaded.tasks=true;
  }).catch(function(e){console.warn('SC loadTasks:',e.message)});
}

// ═══════════════════════════════════════
// TAB 6: DELIVERABLES
// ═══════════════════════════════════════
function renderDeliverablesTab(c){
  var h='';
  // Sub-tabs
  h+='<div style="display:flex;gap:6px;margin-bottom:14px">';
  ['quotes','salesorders'].forEach(function(st){
    var act=state.delivSubTab===st;
    var lbl=st==='quotes'?'Quotes':'Sales Orders';
    h+='<button onclick="MFX.SC.delivSubTab(\''+st+'\')" style="'+S.btn+(act?'background:var(--ac);color:#000;':'background:transparent;color:var(--tx2);border:1px solid var(--bdr);')+'">'+lbl+'</button>';
  });
  h+='</div>';
  h+='<div id="sc-deliv-content"></div>';
  c.innerHTML=h;
  setTimeout(renderDelivContent,0);
}

function renderDelivContent(){
  var c=document.getElementById('sc-deliv-content');if(!c)return;
  if(state.delivSubTab==='quotes')renderDelivQuotes(c);
  else renderDelivSOs(c);
}

function renderDelivQuotes(c){
  var qs=typeof DB!=='undefined'&&DB.quotes?DB.quotes():[];
  if(!qs.length){c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">No quotes loaded</div>';return}

  var statusColors={draft:'#64748b',approval:'#f59e0b',ready:'#6366f1',sent:'#00e5ff',won:'#22c55e',lost:'#ef4444',archived:'#475569'};
  var h='<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">'+qs.length+' quotes</div>';
  h+='<table style="'+S.table+'">';
  h+='<thead><tr><th style="'+S.th+'">Quote #</th><th style="'+S.th+'">Company</th><th style="'+S.th+'">Status</th><th style="'+S.th+'">Estimator</th><th style="'+S.th+'">Total</th><th style="'+S.th+'">Date</th></tr></thead><tbody>';
  qs.slice(0,100).forEach(function(q,i){
    var bg=i%2===0?'transparent':'var(--bg3)';
    var f=q.fields||{};
    var sc=statusColors[q.status]||'#64748b';
    var total=q.qtys&&q.qtys.length?q.qtys[0].total:0;
    h+='<tr style="background:'+bg+';cursor:pointer" onclick="if(typeof openEditor===\'function\'){openEditor(\''+esc(q.id)+'\');}">';
    h+='<td style="'+S.td+'font-weight:700;color:var(--ac)">'+esc(q.quoteNum||'—')+'</td>';
    h+='<td style="'+S.td+'">'+esc(f.custCo||'—')+'</td>';
    h+='<td style="'+S.td+'"><span style="'+S.badge+'background:'+sc+'20;color:'+sc+'">'+esc(q.status||'draft')+'</span></td>';
    h+='<td style="'+S.td+'font-size:11px">'+esc(f.estimator||'—')+'</td>';
    h+='<td style="'+S.td+'font-weight:600">$'+Number(total).toLocaleString(undefined,{minimumFractionDigits:2})+'</td>';
    h+='<td style="'+S.td+'font-size:10px;color:var(--tx3)">'+fmtShort(q.createdAt)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  c.innerHTML=h;
}

function renderDelivSOs(c){
  var sos=typeof getSalesOrders==='function'?getSalesOrders():[];
  if(!sos.length){c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">No sales orders</div>';return}

  var statusColors={pending:'#f59e0b',approved:'#6366f1',sent:'#00e5ff',fulfilled:'#22c55e',closed:'#64748b'};
  var h='<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">'+sos.length+' sales orders</div>';
  h+='<table style="'+S.table+'">';
  h+='<thead><tr><th style="'+S.th+'">SO #</th><th style="'+S.th+'">Company</th><th style="'+S.th+'">Status</th><th style="'+S.th+'">PO #</th><th style="'+S.th+'">Total</th><th style="'+S.th+'">Date</th></tr></thead><tbody>';
  sos.forEach(function(so,i){
    var bg=i%2===0?'transparent':'var(--bg3)';
    var sc=statusColors[so.status]||'#64748b';
    h+='<tr style="background:'+bg+';cursor:pointer" onclick="if(typeof openSODetail===\'function\')openSODetail(\''+esc(so.id)+'\')">';
    h+='<td style="'+S.td+'font-weight:700;color:var(--ac)">'+esc(so.soNum||'—')+'</td>';
    h+='<td style="'+S.td+'">'+esc(so.company||'—')+'</td>';
    h+='<td style="'+S.td+'"><span style="'+S.badge+'background:'+sc+'20;color:'+sc+'">'+esc(so.status||'pending')+'</span></td>';
    h+='<td style="'+S.td+'font-size:11px">'+esc(so.poNumber||'—')+'</td>';
    h+='<td style="'+S.td+'font-weight:600">$'+Number(so.total||0).toLocaleString(undefined,{minimumFractionDigits:2})+'</td>';
    h+='<td style="'+S.td+'font-size:10px;color:var(--tx3)">'+fmtShort(so.createdAt)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  c.innerHTML=h;
}

// ═══════════════════════════════════════
// TAB 7: ACTIVITY LOG
// ═══════════════════════════════════════
function renderActivityTab(c){
  c.innerHTML='<div style="color:var(--tx3);padding:20px;text-align:center">Loading activity log...</div>';
  loadActivityLog().then(function(){
    var h='';
    // Filters
    h+='<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';
    h+='<select onchange="MFX.SC.activityFilterUser(this.value)" style="'+S.input+'">';
    h+='<option value="All">All Users</option>';
    var userNames=[]; cache.users.forEach(function(u){if(u.displayName)userNames.push(u.displayName)});
    userNames.sort().forEach(function(n){h+='<option'+(state.activityFilter.user===n?' selected':'')+'>'+esc(n)+'</option>'});
    h+='</select>';
    h+='<select onchange="MFX.SC.activityFilterAction(this.value)" style="'+S.input+'">';
    h+='<option value="All">All Actions</option>';
    var actions={};cache.activity.forEach(function(a){if(a.action)actions[a.action]=true});
    Object.keys(actions).sort().forEach(function(a){h+='<option'+(state.activityFilter.action===a?' selected':'')+'>'+esc(a)+'</option>'});
    h+='</select>';
    h+='<select onchange="MFX.SC.activityFilterDays(this.value)" style="'+S.input+'">';
    [1,7,30,90].forEach(function(d){h+='<option value="'+d+'"'+(state.activityFilter.days===d?' selected':'')+'>Last '+d+' day'+(d>1?'s':'')+'</option>'});
    h+='</select>';
    h+='<button onclick="MFX.SC.exportCSV()" style="'+S.btn+'background:transparent;color:var(--tx2);border:1px solid var(--bdr)">Export CSV</button>';
    h+='<span style="font-size:11px;color:var(--tx3)">'+cache.activity.length+' entries</span>';
    h+='</div>';

    // Filter
    var cutoff=Date.now()-(state.activityFilter.days*86400000);
    var filtered=cache.activity.filter(function(a){
      if(state.activityFilter.user!=='All'&&a.user!==state.activityFilter.user)return false;
      if(state.activityFilter.action!=='All'&&a.action!==state.activityFilter.action)return false;
      var ts=a.timestamp;if(ts){
        var dt=ts.toDate?ts.toDate():(ts.seconds?new Date(ts.seconds*1000):new Date(ts));
        if(dt.getTime()<cutoff)return false;
      }
      return true;
    });

    h+='<table style="'+S.table+'">';
    h+='<thead><tr><th style="'+S.th+'">Time</th><th style="'+S.th+'">User</th><th style="'+S.th+'">Action</th><th style="'+S.th+'">Detail</th></tr></thead><tbody>';
    filtered.forEach(function(a,i){
      var bg=i%2===0?'transparent':'var(--bg3)';
      h+='<tr style="background:'+bg+'">';
      h+='<td style="'+S.td+'font-size:10px;color:var(--tx3);white-space:nowrap">'+fmtDate(a.timestamp)+'</td>';
      h+='<td style="'+S.td+'font-size:11px;font-weight:600">'+esc(a.user||'—')+'</td>';
      h+='<td style="'+S.td+'"><span style="'+S.badge+'background:rgba(0,229,255,.1);color:#00e5ff">'+esc(a.action||'—')+'</span></td>';
      h+='<td style="'+S.td+'font-size:11px">'+esc(a.detail||'')+'</td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
    c.innerHTML=h;
  });
}

function loadActivityLog(){
  if(cache.loaded.activity)return Promise.resolve();
  if(typeof fbDb==='undefined')return Promise.resolve();
  return Promise.all([
    loadUsers(),
    fbDb.collection('activity').orderBy('timestamp','desc').limit(500).get().then(function(snap){
      cache.activity=snap.docs.map(function(d){return d.data()});
      cache.loaded.activity=true;
    })
  ]).catch(function(e){console.warn('SC loadActivity:',e.message)});
}

function exportCSV(){
  var rows=[['Time','User','Action','Detail']];
  cache.activity.forEach(function(a){
    rows.push([fmtDate(a.timestamp),a.user||'',a.action||'','"'+(a.detail||'').replace(/"/g,'""')+'"']);
  });
  var csv=rows.map(function(r){return r.join(',')}).join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='mfx-activity-log-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Activity log exported','ok');
}

// ═══════════════════════════════════════
// GLOBAL API & REGISTRATION
// ═══════════════════════════════════════
window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
window.MFX_VIEW_RENDERERS.systemcontrol=renderSystemControl;
window.MFX_VIEW_TITLES=window.MFX_VIEW_TITLES||{};
window.MFX_VIEW_TITLES.systemcontrol='System Control';

window.MFX=window.MFX||{};
window.MFX.SC={
  setTab:setTab,
  selectUser:function(uid){state.selectedUserId=uid;state.userSubTab='profile';state.tab='users';renderContent()},
  editUser:function(uid){state.editUserId=uid;renderContent()},
  saveUser:saveUser,
  cancelEdit:function(){state.editUserId=null;renderContent()},
  back:function(){state.selectedUserId=null;state.editUserId=null;renderContent()},
  userSubTab:function(t){state.userSubTab=t;var u=cache.users.find(function(x){return x.uid===state.selectedUserId});if(u){var c=document.getElementById('sc-user-content');if(c)renderUserSubContent(u)}},
  onSearch:function(v){state.search=v;renderContent()},
  onDeptFilter:function(v){state.filterDept=v;renderContent()},
  toggleDept:function(d){state.expandedDept=state.expandedDept===d?null:d;renderContent()},
  toggleTask:function(tid){state.expandedTask=state.expandedTask===tid?null:tid;renderContent()},
  taskFilterStatus:function(v){state.taskFilter.status=v;renderContent()},
  taskFilterPriority:function(v){state.taskFilter.priority=v;renderContent()},
  delivSubTab:function(t){state.delivSubTab=t;renderDelivContent()},
  activityFilterUser:function(v){state.activityFilter.user=v;renderContent()},
  activityFilterAction:function(v){state.activityFilter.action=v;renderContent()},
  activityFilterDays:function(v){state.activityFilter.days=parseInt(v)||7;renderContent()},
  toggleModule:toggleModule,
  exportCSV:exportCSV
};

console.log('System Control module loaded');
})();
