// ═══════════════════════════════════════════════
// MFX OS GAMIFICATION ENGINE v2.1
// XP, Levels, Streaks, Achievements, Celebrations
// ═══════════════════════════════════════════════

(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ── LEVEL SYSTEM ──
var LEVELS=[
{level:1,title:'Rookie',xp:0,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
{level:2,title:'Operator',xp:5,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'},
{level:3,title:'Specialist',xp:15,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'},
{level:4,title:'Pro',xp:30,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
{level:5,title:'Expert',xp:50,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
{level:6,title:'Master',xp:80,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'},
{level:7,title:'Legend',xp:120,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>'},
{level:8,title:'MFX Elite',xp:175,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>'},
{level:9,title:'Untouchable',xp:250,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'},
{level:10,title:'CEO Mode',xp:500,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>'}
];

// ── ACHIEVEMENT DEFINITIONS ──
var ACHIEVEMENTS=[
{id:'first_quote',title:'First Quote',desc:'Create your first quote',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',check:function(s){return s.quotesCreated>=1}},
{id:'five_quotes',title:'Grinder',desc:'Create 5 quotes',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',check:function(s){return s.quotesCreated>=5}},
{id:'first_win',title:'Closer',desc:'Win your first quote',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',check:function(s){return s.quotesWon>=1}},
{id:'ten_wins',title:'Sales Machine',desc:'Win 10 quotes',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',check:function(s){return s.quotesWon>=10}},
{id:'streak_3',title:'On Fire',desc:'3-day login streak',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',check:function(s){return s.streak>=3}},
{id:'streak_7',title:'Unstoppable',desc:'7-day streak',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',check:function(s){return s.streak>=7}},
{id:'streak_30',title:'Iron Will',desc:'30-day streak',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',check:function(s){return s.streak>=30}},
{id:'speed_demon',title:'Speed Demon',desc:'Create & send a quote in one session',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',check:function(s){return s.speedQuote}},
{id:'team_player',title:'Team Player',desc:'Post 10 mood updates',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',check:function(s){return s.moodPosts>=10}},
{id:'mentor',title:'Mentor',desc:'Comment on 20 posts',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',check:function(s){return s.comments>=20}},
{id:'early_bird',title:'Early Bird',desc:'Log in before 7 AM',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>',check:function(s){return s.earlyLogin}},
{id:'night_owl',title:'Night Owl',desc:'Log in after 9 PM',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',check:function(s){return s.lateLogin}},
{id:'perfectionist',title:'Perfectionist',desc:'Revise a quote 3+ times',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',check:function(s){return s.maxRevisions>=3}},
{id:'multitasker',title:'Multitasker',desc:'Complete 5 tasks in one day',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',check:function(s){return s.tasksToday>=5}},
{id:'client_whisperer',title:'Client Whisperer',desc:'Add 10 customers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',check:function(s){return s.customersAdded>=10}}
];

// ── XP REWARDS ──
var XP_ACTIONS={
'quote.create':0.5,
'quote.submit':1.0,
'quote.approve':0.5,
'quote.send':1.5,
'quote.won':3.0,
'quote.revise':0.25,
'task.complete':0.5,
'task.create':0.25,
'mood.post':0.1,
'comment.post':0.1,
'request.submit':0.5,
'request.complete':1.0,
'customer.add':0.5,
'login.daily':0.5,
'streak.bonus':0.25
};

// ── STORAGE ──
function getGamData(){
var uid=typeof getUserId==='function'?getUserId():'default';
var key='mfx_gam_'+uid;
var d=JSON.parse(localStorage.getItem(key)||'null');
if(!d){
d={xp:0,level:1,streak:0,lastLogin:'',achievements:[],xpLog:[],
quotesCreated:0,quotesWon:0,quotesSent:0,moodPosts:0,comments:0,
tasksCompleted:0,customersAdded:0,maxRevisions:0,speedQuote:false,
earlyLogin:false,lateLogin:false,tasksToday:0,lastTaskDay:'',
totalLogins:0};
}
return d;
}
function saveGamData(d){
var uid=typeof getUserId==='function'?getUserId():'default';
localStorage.setItem('mfx_gam_'+uid,JSON.stringify(d));
}

// ── CORE: AWARD XP ──
function awardXP(action,detail){
var d=getGamData();
var pts=XP_ACTIONS[action]||0;
if(!pts)return;
d.xp+=pts;
d.xpLog.push({action:action,pts:pts,detail:detail||'',at:new Date().toISOString()});
if(d.xpLog.length>200)d.xpLog=d.xpLog.slice(-100);

// Track stats for achievements
if(action==='quote.create')d.quotesCreated++;
if(action==='quote.won')d.quotesWon++;
if(action==='quote.send')d.quotesSent++;
if(action==='mood.post')d.moodPosts++;
if(action==='comment.post')d.comments++;
if(action==='task.complete'){
d.tasksCompleted++;
var today=new Date().toISOString().split('T')[0];
if(d.lastTaskDay===today)d.tasksToday++;
else{d.tasksToday=1;d.lastTaskDay=today}
}

// Check level up
var oldLevel=d.level;
for(var i=LEVELS.length-1;i>=0;i--){
if(d.xp>=LEVELS[i].xp){d.level=LEVELS[i].level;break}
}
var leveled=d.level>oldLevel;

saveGamData(d);

// Show XP popup
showXPToast('+'+pts.toFixed(1)+' XP',action.split('.')[1]);

// Level up celebration
if(leveled){
var lv=LEVELS.find(function(l){return l.level===d.level});
setTimeout(function(){showLevelUp(lv)},800);
}

// Check achievements
setTimeout(function(){checkAchievements(d)},1200);
}

// ── STREAK SYSTEM ──
function updateStreak(){
var d=getGamData();
var today=new Date().toISOString().split('T')[0];
if(d.lastLogin===today)return d.streak;

var yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0];
if(d.lastLogin===yesterday){
d.streak++;
}else if(d.lastLogin!==today){
if(d.streak>0)showXPToast('Streak reset!','😢');
d.streak=d.lastLogin?0:1;
}
d.lastLogin=today;
d.totalLogins++;

// Time-based achievements
var hour=new Date().getHours();
if(hour<7)d.earlyLogin=true;
if(hour>=21)d.lateLogin=true;

// Persist streak data BEFORE awarding XP so awardXP reads fresh state
saveGamData(d);

if(d.streak>1)awardXP('streak.bonus','Day '+d.streak);
awardXP('login.daily','Daily login');

if(d.streak>=3)showStreakBanner(d.streak);
return d.streak;
}

// ── ACHIEVEMENTS ──
function checkAchievements(d){
if(!d)d=getGamData();
var newBadges=[];
ACHIEVEMENTS.forEach(function(a){
if(d.achievements.indexOf(a.id)===-1&&a.check(d)){
d.achievements.push(a.id);
newBadges.push(a);
}
});
if(newBadges.length){
saveGamData(d);
newBadges.forEach(function(b,i){
setTimeout(function(){showAchievement(b)},i*1500);
});
}
}

// ── UI: XP TOAST (disabled — blue dot handles notifications) ──
function showXPToast(text,subtext){ return; }

// ── UI: STREAK BANNER (disabled — blue dot handles notifications) ──
function showStreakBanner(days){ return; }

// ── UI: LEVEL UP ──
function showLevelUp(lv){
if(!lv)return;
var html='<div style="text-align:center;padding:30px">';
html+='<div class="level-up" style="font-size:64px;margin-bottom:12px">'+lv.icon+'</div>';
html+='<div style="font-size:22px;font-weight:800;color:var(--ac);margin-bottom:4px">LEVEL UP!</div>';
html+='<div style="font-size:16px;font-weight:700;color:var(--tx);margin-bottom:8px">Level '+lv.level+' — '+lv.title+'</div>';
html+='<div class="xp-bar" style="width:200px;margin:12px auto"><div class="xp-bar-fill" style="width:100%"></div></div>';
html+='<button class="btn btn-pr" onclick="closeModal()" style="margin-top:16px;padding:12px 40px">Let\'s Go!</button>';
html+='</div>';
if(typeof openModal==='function')openModal(html);
spawnConfetti();
}

// ── UI: ACHIEVEMENT POPUP ──
function showAchievement(badge){
var html='<div style="text-align:center;padding:24px">';
html+='<div class="badge-bounce" style="font-size:56px;margin-bottom:10px">'+badge.icon+'</div>';
html+='<div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Achievement Unlocked</div>';
html+='<div style="font-size:18px;font-weight:800;color:var(--ac);margin-bottom:4px">'+badge.title+'</div>';
html+='<div style="font-size:12px;color:var(--tx2)">'+badge.desc+'</div>';
html+='<button class="btn btn-pr" onclick="closeModal()" style="margin-top:16px;padding:10px 32px">Nice!</button>';
html+='</div>';
if(typeof openModal==='function')openModal(html);
}

// ── CONFETTI ──
function spawnConfetti(){
var colors=['#00e5ff','#38bdf8','#a78bfa','#f472b6','#fbbf24','#fb7185'];
var container=document.createElement('div');
container.style.cssText='position:fixed;inset:0;z-index:500;pointer-events:none;overflow:hidden';
document.body.appendChild(container);
for(var i=0;i<50;i++){
var c=document.createElement('div');
var color=colors[Math.floor(Math.random()*colors.length)];
var size=Math.random()*8+4;
var left=Math.random()*100;
var delay=Math.random()*0.5;
var dur=Math.random()*2+1.5;
c.style.cssText='position:absolute;top:-10px;left:'+left+'%;width:'+size+'px;height:'+size+'px;background:'+color+';border-radius:'+(Math.random()>.5?'50%':'2px')+';animation:confettiFall '+dur+'s '+delay+'s ease-in forwards;opacity:0.8';
container.appendChild(c);
}
setTimeout(function(){container.remove()},4000);
}

// ── PROFILE BADGE RENDERER ──
function renderGamProfile(){
var d=getGamData();
var lv=LEVELS.find(function(l){return l.level===d.level})||LEVELS[0];
var next=LEVELS.find(function(l){return l.level===d.level+1});
var pct=next?Math.min(100,Math.round((d.xp-lv.xp)/(next.xp-lv.xp)*100)):100;

var h='<div style="text-align:center;padding:16px">';
h+='<div style="font-size:48px;margin-bottom:8px">'+lv.icon+'</div>';
h+='<div style="font-size:18px;font-weight:800;color:var(--ac)">Level '+lv.level+' — '+lv.title+'</div>';
h+='<div style="font-size:12px;color:var(--tx2);margin:4px 0">'+d.xp.toFixed(1)+' XP'+(next?' / '+next.xp+' XP':'')+'</div>';
h+='<div class="xp-bar" style="width:80%;margin:8px auto"><div class="xp-bar-fill" style="width:'+pct+'%"></div></div>';
h+='<div style="display:flex;justify-content:center;gap:16px;margin-top:12px;font-size:11px;color:var(--tx3)">';
h+='<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> '+d.streak+' day streak</div>';
h+='<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg> '+d.achievements.length+'/'+ACHIEVEMENTS.length+' badges</div>';
h+='<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> '+d.quotesCreated+' quotes</div>';
h+='</div>';

// Achievement grid
h+='<div style="margin-top:16px;text-align:left"><div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:6px">Achievements</div>';
h+='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">';
ACHIEVEMENTS.forEach(function(a){
var unlocked=d.achievements.indexOf(a.id)!==-1;
h+='<div style="text-align:center;padding:8px 4px;background:'+(unlocked?'var(--bg3)':'var(--bg)')+';border:1px solid '+(unlocked?'var(--ac)':'var(--bdr)')+';border-radius:8px;opacity:'+(unlocked?'1':'.3')+'" title="'+a.title+': '+a.desc+'">';
h+='<div style="font-size:20px">'+a.icon+'</div>';
h+='<div style="font-size:7px;color:'+(unlocked?'var(--ac)':'var(--tx3)')+';margin-top:2px">'+a.title+'</div></div>';
});
h+='</div></div>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="margin-top:16px;width:100%">Close</button></div>';
return h;
}

// ── HOOK INTO EXISTING FUNCTIONS ──
function hookGamification(){
// Hook quote creation
var _origNewQuote=window.newQuote;
if(_origNewQuote){
window.newQuote=function(tplId){
_origNewQuote(tplId);
awardXP('quote.create','New quote');
};
}

// Hook quote status changes
var _origSetQStatus=window.setQStatus;
if(_origSetQStatus){
window.setQStatus=function(qid,st,ex){
_origSetQStatus(qid,st,ex);
if(st==='sent')awardXP('quote.send','Quote sent');
if(st==='won')awardXP('quote.won','Quote won!');
if(st==='approval')awardXP('quote.submit','Submitted for approval');
};
}

// Hook mood posting
var _origPostMood=window.postMood;
if(_origPostMood){
window.postMood=function(){
_origPostMood();
awardXP('mood.post','Mood update');
};
}

// Hook task completion
var _origCompleteTask=window.completeTask;
if(_origCompleteTask){
window.completeTask=function(tid){
_origCompleteTask(tid);
awardXP('task.complete','Task done');
};
}

// Hook customer save
var _origSaveCust=window.saveCust;
if(_origSaveCust){
window.saveCust=function(c){
var isNew=!window.DB||!window.DB.customers().find(function(x){return x.id===c.id});
_origSaveCust(c);
if(isNew){
var d=getGamData();d.customersAdded=(d.customersAdded||0)+1;saveGamData(d);
awardXP('customer.add','New customer');
}
};
}

// Hook submit for approval
var _origSubmitForApproval=window.submitForApproval;
if(_origSubmitForApproval){
window.submitForApproval=function(qid){
_origSubmitForApproval(qid);
awardXP('quote.submit','Submitted');
};
}

// Add Flex Games button to openFlexZone
var _origOpenFlexGames=window.openFlexGames;
if(_origOpenFlexGames){
window.openFlexGames=function(){
_origOpenFlexGames();
// Inject gamification data into the modal
setTimeout(function(){
var mc=document.getElementById('modalContent');
if(mc){
var d=getGamData();
var lv=LEVELS.find(function(l){return l.level===d.level})||LEVELS[0];
var badge=mc.querySelector('.gam-inject');
if(!badge){
var div=document.createElement('div');
div.className='gam-inject';
div.style.cssText='background:var(--bg3);border:1px solid var(--ac);border-radius:8px;padding:10px;margin:8px 0;text-align:center';
div.innerHTML='<div style="font-size:20px">'+lv.icon+'</div><div style="font-size:10px;color:var(--ac);font-weight:700">Level '+lv.level+' — '+lv.title+'</div><div class="xp-bar"><div class="xp-bar-fill" style="width:60%"></div></div>';
mc.insertBefore(div,mc.firstChild.nextSibling);
}
}
},200);
};
}
}

// ── INIT ──
window.initGamification=function(){
hookGamification();
updateStreak();

// Rebuild calcPoints to include XP
var _origCalcPoints=window.calcPoints;
if(_origCalcPoints){
window.calcPoints=function(user,qs){
var r=_origCalcPoints(user,qs);
// If it's the current user, add gamification XP
if(typeof getUserName==='function'&&user===getUserName()){
var d=getGamData();
if(r && typeof r==='object' && typeof r.pts==='number')r.pts+=d.xp;
else if(typeof r==='number')r+=d.xp;
}
return r;
};
}
};

// Expose for Flex Zone profile
window.renderGamProfile=renderGamProfile;
window.awardXP=awardXP;
window.getGamData=getGamData;
window.GAM_LEVELS=LEVELS;
window.GAM_ACHIEVEMENTS=ACHIEVEMENTS;

})();
