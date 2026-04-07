// ═══════════════════════════════════════════════
// MFX OS FEATURES v1.0
// Team DMs, Daily Challenges, Power-Ups,
// Smart Notifications, Easter Eggs
// ═══════════════════════════════════════════════

(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ══════════════════════════════
// 1. TEAM DIRECT MESSAGES
// ══════════════════════════════

window.openDMs=function(){
var me=getUserName();
var h='<div class="modal-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Messages</div>';
h+='<div id="dmThreads" style="margin-bottom:10px"><div style="color:var(--tx3);font-size:10px;text-align:center;padding:10px">Loading...</div></div>';
h+='<button class="btn btn-pr" onclick="newDM()" style="width:100%;margin-bottom:6px">+ New Message</button>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%">Close</button>';
openModal(h);
loadDMThreads(me);
};

function loadDMThreads(me){
var el=document.getElementById('dmThreads');if(!el||!fbDb)return;
fbDb.collection('dms').where('participants','array-contains',me).orderBy('lastMessageAt','desc').limit(20).get().then(function(snap){
var threads=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
if(!threads.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--tx3)"><div style="font-size:32px;margin-bottom:8px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div style="font-size:11px">No messages yet</div><div style="font-size:10px;margin-top:4px">Start a conversation!</div></div>';return}
var h='';
threads.forEach(function(t){
var other=t.participants.filter(function(p){return p!==me})[0]||'Unknown';
var unread=t.lastSender!==me&&!t.readBy?.includes(me);
h+='<div class="card'+(unread?' glow-pulse':'')+'" style="padding:10px;cursor:pointer;'+(unread?'border-left:3px solid var(--ac)':'')+'" onclick="openDMThread(\''+t.id+'\')">';
h+='<div style="display:flex;justify-content:space-between;align-items:center">';
h+='<strong style="color:'+(unread?'var(--ac)':'var(--tx)')+';font-size:12px">'+other+'</strong>';
h+='<span style="font-size:8px;color:var(--tx3)">'+(t.lastMessageAt?fD(t.lastMessageAt.toDate?t.lastMessageAt.toDate().toISOString():t.lastMessageAt):'')+'</span>';
h+='</div>';
h+='<div style="font-size:10px;color:var(--tx2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(t.lastMessage||'')+'</div>';
if(unread)h+='<div style="width:8px;height:8px;background:var(--ac);border-radius:50%;position:absolute;top:8px;right:8px"></div>';
h+='</div>';
});
el.innerHTML=h;
}).catch(function(e){el.innerHTML='<div style="color:var(--rd);font-size:10px">'+e.message+'</div>'});
}

window.newDM=function(){
var h='<div class="modal-title">New Message</div>';
h+='<div class="fg"><label>To</label><select id="dm-to"><option value="">Loading...</option></select></div>';
// Fetch users from Firestore or getTeamUsers
var fetchUsers = typeof getTeamUsers === 'function' ? Promise.resolve(getTeamUsers()) :
  (typeof fbDb !== 'undefined' ? fbDb.collection('users').get().then(function(snap){ return snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); }); }).catch(function(e){ console.warn('FEATURES get:', e.message); }) : Promise.resolve([]));
fetchUsers.then(function(users){
  var sel=document.getElementById('dm-to');if(!sel)return;
  var me=getUserName();
  sel.innerHTML='';
  (users||[]).forEach(function(u){
    var name=u.name||u.displayName||u.email||'';
    var uid=u.id||u.uid||name;
    if(name&&name!==me){sel.innerHTML+='<option value="'+uid+'" data-name="'+name+'">'+name+'</option>';}
  });
  if(!sel.innerHTML)sel.innerHTML='<option value="">No users found</option>';
}).catch(function(){
  var sel=document.getElementById('dm-to');if(sel)sel.innerHTML='<option value="">Could not load users</option>';
});
h+='<div class="fg"><label>Message</label><textarea id="dm-msg" placeholder="Type your message..." style="min-height:80px"></textarea></div>';
h+='<button class="btn btn-pr" onclick="sendDM()" style="width:100%">Send</button>';
h+='<button class="btn btn-ghost" onclick="openDMs()" style="width:100%;margin-top:6px">Cancel</button>';
openModal(h);
};

window.sendDM=function(){
var sel=document.getElementById('dm-to');
var to=sel?sel.value:'';
var toName=sel&&sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].getAttribute('data-name')||sel.options[sel.selectedIndex].text:'';
var msg=(document.getElementById('dm-msg')||{}).value;
if(!to||!msg||!msg.trim())return toast('Write a message','err');
var me=getUserName();
var meUid=typeof getUserId==='function'?getUserId():me;
var threadId=[me,toName].sort().join('_').replace(/[^a-zA-Z0-9_]/g,'');

fbDb.collection('dms').doc(threadId).set({
participants:[me,toName].sort(),
lastMessage:msg.trim().substring(0,100),
lastSender:me,
lastMessageAt:firebase.firestore.FieldValue.serverTimestamp(),
readBy:[me]
},{merge:true}).then(function(){
return fbDb.collection('dms').doc(threadId).collection('messages').add({
text:msg.trim(),
from:me,
to:toName,
timestamp:firebase.firestore.FieldValue.serverTimestamp()
});
}).then(function(){
toast('Sent!','ok');
if(typeof MFX_SFX!=='undefined')MFX_SFX.send();
if(typeof awardXP==='function')awardXP('comment.post','DM sent');
openDMThread(threadId);
}).catch(function(e){toast(e.message,'err')});
};

window.openDMThread=function(threadId){
var me=getUserName();
// Mark as read
fbDb.collection('dms').doc(threadId).update({
readBy:firebase.firestore.FieldValue.arrayUnion(me)
}).catch(function(){});

fbDb.collection('dms').doc(threadId).collection('messages').orderBy('timestamp','desc').limit(50).get().then(function(snap){
var msgs=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())}).reverse();
var h='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="cursor:pointer;font-size:16px" onclick="openDMs()">←</span><div class="modal-title" style="margin:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Conversation</div></div>';
h+='<div id="dmMsgs" style="max-height:300px;overflow-y:auto;margin-bottom:10px;padding:4px">';
msgs.forEach(function(m){
var isMe=m.from===me;
h+='<div style="display:flex;justify-content:'+(isMe?'flex-end':'flex-start')+';margin-bottom:6px">';
h+='<div style="max-width:80%;padding:8px 12px;border-radius:'+(isMe?'12px 12px 0 12px':'12px 12px 12px 0')+';background:'+(isMe?'linear-gradient(135deg,var(--ac),#0891b2)':'var(--bg3)')+';color:'+(isMe?'#000':'var(--tx)')+';font-size:12px;line-height:1.4">';
h+=m.text;
h+='<div style="font-size:8px;opacity:.6;margin-top:2px;text-align:right">'+(m.timestamp?fD(m.timestamp.toDate?m.timestamp.toDate().toISOString():m.timestamp):'now')+'</div>';
h+='</div></div>';
});
if(!msgs.length)h+='<div style="text-align:center;color:var(--tx3);font-size:11px;padding:20px">Start the conversation...</div>';
h+='</div>';
h+='<div style="display:flex;gap:6px"><textarea id="dm-reply" placeholder="Type..." style="flex:1;min-height:36px;padding:8px;border:1px solid var(--bdr);border-radius:10px;background:var(--inp);color:var(--tx);font-size:12px;resize:none"></textarea>';
h+='<button class="btn btn-pr" onclick="replyDM(\''+threadId+'\')" style="align-self:flex-end;padding:10px 16px">Send</button></div>';
openModal(h);
var el=document.getElementById('dmMsgs');
if(el)el.scrollTop=el.scrollHeight;
}).catch(function(e){toast(e.message,'err')});
};

window.replyDM=function(threadId){
var el=document.getElementById('dm-reply');
if(!el||!el.value.trim())return;
var me=getUserName();
var msg=el.value.trim();

fbDb.collection('dms').doc(threadId).collection('messages').add({
text:msg,from:me,timestamp:firebase.firestore.FieldValue.serverTimestamp()
}).then(function(){
return fbDb.collection('dms').doc(threadId).update({
lastMessage:msg.substring(0,100),lastSender:me,
lastMessageAt:firebase.firestore.FieldValue.serverTimestamp(),
readBy:[me]
});
}).then(function(){
if(typeof MFX_SFX!=='undefined')MFX_SFX.message();
openDMThread(threadId);
}).catch(function(e){toast(e.message,'err')});
};


// ══════════════════════════════
// 2. DAILY CHALLENGES
// ══════════════════════════════

var DAILY_CHALLENGES=[
{id:'quote_3',title:'Triple Threat',desc:'Create 3 quotes today',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',target:3,stat:'quotesToday',xp:2},
{id:'speed_quote',title:'Speed Run',desc:'Create & submit a quote in under 5 min',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',target:1,stat:'speedQuotes',xp:3},
{id:'social_3',title:'Social Butterfly',desc:'Post 3 mood updates',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',target:3,stat:'moodsToday',xp:1.5},
{id:'task_5',title:'Task Master',desc:'Complete 5 tasks',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',target:5,stat:'tasksToday',xp:2.5},
{id:'comment_5',title:'Hype Squad',desc:'Comment on 5 posts',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',target:5,stat:'commentsToday',xp:2},
{id:'early_start',title:'Early Bird',desc:'Log in before 8 AM',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',target:1,stat:'earlyLogin',xp:1},
{id:'client_touch',title:'Relationship Builder',desc:'Update 2 customer records',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',target:2,stat:'clientUpdates',xp:2},
{id:'zero_inbox',title:'Inbox Zero',desc:'Clear all pending requests',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>',target:1,stat:'inboxZero',xp:3},
{id:'mentor_mode',title:'Mentor Mode',desc:'Reply to 3 team posts',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',target:3,stat:'repliesToday',xp:2},
{id:'streak_keeper',title:'Keep It Alive',desc:'Maintain your login streak',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',target:1,stat:'streakKept',xp:1}
];

function getDailyChallenge(){
var today=new Date().toISOString().split('T')[0];
var stored=JSON.parse(localStorage.getItem('mfx_daily_challenge')||'{}');
if(stored.date===today)return stored;
// Pick 3 random challenges for today
var shuffled=DAILY_CHALLENGES.slice().sort(function(){return Math.random()-0.5});
var picks=shuffled.slice(0,3);
var challenge={date:today,challenges:picks.map(function(c){return{...c,progress:0,completed:false}}),claimedXP:false};
localStorage.setItem('mfx_daily_challenge',JSON.stringify(challenge));
return challenge;
}

function updateChallengeProgress(stat,amount){
var dc=getDailyChallenge();
var changed=false;
dc.challenges.forEach(function(c){
if(c.stat===stat&&!c.completed){
c.progress=Math.min(c.target,(c.progress||0)+(amount||1));
if(c.progress>=c.target){
c.completed=true;
changed=true;
setTimeout(function(){
showChallengeComplete(c);
},500);
}
}
});
localStorage.setItem('mfx_daily_challenge',JSON.stringify(dc));
// Check if all 3 done
var allDone=dc.challenges.every(function(c){return c.completed});
if(allDone&&!dc.claimedXP){
dc.claimedXP=true;
localStorage.setItem('mfx_daily_challenge',JSON.stringify(dc));
setTimeout(function(){showDailyComplete()},1500);
}
}

function showChallengeComplete(c){
if(typeof MFX_SFX!=='undefined')MFX_SFX.achievement();
// Use toast instead of modal to avoid conflicts with other modals
if(typeof toast==='function')toast(c.icon+' '+c.title+' complete! +'+c.xp+' XP','ok');
if(typeof awardXP==='function')awardXP('task.complete','Challenge: '+c.title);
}

function showDailyComplete(){
if(typeof MFX_SFX!=='undefined')MFX_SFX.levelUp();
var html='<div style="text-align:center;padding:24px">';
html+='<div class="level-up" style="font-size:64px;margin-bottom:8px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg></div>';
html+='<div style="font-size:20px;font-weight:800;color:var(--ac)">ALL CHALLENGES COMPLETE!</div>';
html+='<div style="font-size:13px;color:var(--tx2);margin:6px 0">Bonus +5 XP</div>';
html+='<button class="btn btn-pr" onclick="closeModal()" style="margin-top:12px;padding:12px 32px">Let\'s Go!</button></div>';
openModal(html);
if(typeof awardXP==='function')awardXP('quote.won','Daily challenge bonus');
if(typeof spawnConfetti==='function')spawnConfetti();
}

window.openDailyChallenges=function(){
var dc=getDailyChallenge();
var h='<div class="modal-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Daily Challenges</div>';
h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Refresh every day at midnight. Complete all 3 for a bonus!</div>';
dc.challenges.forEach(function(c){
var pct=Math.min(100,Math.round((c.progress||0)/c.target*100));
h+='<div class="card" style="padding:12px;margin-bottom:8px;'+(c.completed?'border-color:var(--gn);opacity:.7':'')+'">';
h+='<div style="display:flex;align-items:center;gap:10px">';
h+='<div style="font-size:28px">'+(c.completed?'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>':c.icon)+'</div>';
h+='<div style="flex:1">';
h+='<div style="font-size:12px;font-weight:700;color:'+(c.completed?'var(--gn)':'var(--tx)')+'">'+c.title+'</div>';
h+='<div style="font-size:10px;color:var(--tx3)">'+c.desc+'</div>';
h+='<div class="xp-bar" style="margin-top:4px"><div class="xp-bar-fill" style="width:'+pct+'%;background:'+(c.completed?'var(--gn)':'')+'"></div></div>';
h+='<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+(c.progress||0)+'/'+c.target+(c.completed?' · Done!':' · +'+c.xp+' XP')+'</div>';
h+='</div></div></div>';
});
var allDone=dc.challenges.every(function(c){return c.completed});
if(allDone)h+='<div style="text-align:center;padding:10px;font-size:14px;color:var(--ac);font-weight:700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg> All Complete! +5 Bonus XP</div>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:8px">Close</button>';
openModal(h);
};


// ══════════════════════════════
// 3. POWER-UPS & FOCUS MODE
// ══════════════════════════════

window.openPowerUps=function(){
var h='<div class="modal-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Power-Ups</div>';
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';

var pups=[
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',name:'Focus Mode',desc:'Hide distractions, show only your tasks',fn:'activateFocusMode()'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',name:'Speed Round',desc:'5-min quote sprint timer',fn:'startSpeedRound()'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',name:'Stats Deep Dive',desc:'Your full analytics breakdown',fn:'typeof renderGamProfile===\"function\"?openModal(renderGamProfile()):toast(\"Coming soon\",\"ok\")'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',name:'Sound: '+(localStorage.getItem('mfx_sound')==='0'?'OFF':'ON'),desc:'Toggle sound effects',fn:'toggleSound();closeModal();setTimeout(openPowerUps,300)'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',name:'Messages',desc:'Direct messages with your team',fn:'openDMs()'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',name:'Daily Challenge',desc:'Today\'s challenges',fn:'openDailyChallenges()'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',name:'Random Quote',desc:'Motivational quote for the day',fn:'showRandomQuote()'},
{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',name:'Leaderboard',desc:'See who\'s winning',fn:'typeof openFlexGames===\"function\"?openFlexGames():toast(\"Coming soon\",\"ok\")'}
];

pups.forEach(function(p){
h+='<div class="card" style="padding:14px;text-align:center;cursor:pointer" onclick="'+p.fn+'">';
h+='<div style="font-size:28px;margin-bottom:4px">'+p.icon+'</div>';
h+='<div style="font-size:11px;font-weight:700;color:var(--ac)">'+p.name+'</div>';
h+='<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+p.desc+'</div></div>';
});
h+='</div>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%">Close</button>';
openModal(h);
};

window.activateFocusMode=function(){
closeModal();
document.body.classList.toggle('focus-mode');
var active=document.body.classList.contains('focus-mode');
toast(active?'🎯 Focus Mode ON — distractions hidden':'Focus Mode OFF','ok');
if(typeof MFX_SFX!=='undefined')MFX_SFX[active?'powerUp':'close']();
};

window.startSpeedRound=function(){
closeModal();
var end=Date.now()+5*60*1000;
window._speedRoundEnd=end;
toast('⚡ Speed Round! 5:00 on the clock!','ok');
if(typeof MFX_SFX!=='undefined')MFX_SFX.powerUp();

var timer=document.createElement('div');
timer.id='speedTimer';
timer.style.cssText='position:fixed;bottom:62px;right:12px;z-index:200;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;padding:8px 14px;border-radius:10px;font-size:14px;font-weight:800;box-shadow:0 4px 15px rgba(245,158,11,.3);cursor:pointer';
timer.onclick=function(){
clearInterval(window._speedInterval);
timer.remove();
toast('Speed Round ended','ok');
};
document.body.appendChild(timer);

window._speedInterval=setInterval(function(){
var left=Math.max(0,end-Date.now());
if(left<=0){
clearInterval(window._speedInterval);
timer.remove();
if(typeof MFX_SFX!=='undefined')MFX_SFX.achievement();
toast('⏱ Time\'s up! How\'d you do?','ok');
updateChallengeProgress('speedQuotes',1);
return;
}
var m=Math.floor(left/60000);
var s=Math.floor((left%60000)/1000);
timer.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> '+m+':'+(s<10?'0':'')+s;
if(left<30000)timer.style.background='linear-gradient(135deg,#ef4444,#dc2626)';
},1000);
};


// ══════════════════════════════
// 4. MOTIVATIONAL QUOTES
// ══════════════════════════════

var MOTIV_QUOTES=[
{q:'The only way to do great work is to love what you do.',a:'Steve Jobs'},
{q:'Success is not final, failure is not fatal: it is the courage to continue that counts.',a:'Winston Churchill'},
{q:'Done is better than perfect.',a:'Sheryl Sandberg'},
{q:'The best time to plant a tree was 20 years ago. The second best time is now.',a:'Chinese Proverb'},
{q:'Hustle in silence and let your success be your noise.',a:'Frank Ocean'},
{q:'You don\'t have to be great to start, but you have to start to be great.',a:'Zig Ziglar'},
{q:'Every expert was once a beginner.',a:'Helen Hayes'},
{q:'Small daily improvements are the key to staggering long-term results.',a:'Unknown'},
{q:'The harder you work, the luckier you get.',a:'Gary Player'},
{q:'Discipline is choosing between what you want now and what you want most.',a:'Abraham Lincoln'},
{q:'Your only limit is your mind.',a:'Unknown'},
{q:'Grind now. Shine later.',a:'Unknown'},
{q:'The secret to getting ahead is getting started.',a:'Mark Twain'},
{q:'It always seems impossible until it\'s done.',a:'Nelson Mandela'},
{q:'Ship it.',a:'Every great engineer'}
];

window.showRandomQuote=function(){
var q=MOTIV_QUOTES[Math.floor(Math.random()*MOTIV_QUOTES.length)];
var h='<div style="text-align:center;padding:24px">';
h+='<div style="font-size:32px;margin-bottom:12px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg></div>';
h+='<div style="font-size:15px;color:var(--tx);line-height:1.6;font-style:italic;margin-bottom:10px">"'+q.q+'"</div>';
h+='<div style="font-size:11px;color:var(--ac);font-weight:600">— '+q.a+'</div>';
h+='<button class="btn btn-ghost" onclick="closeModal()" style="margin-top:16px">Inspired!</button></div>';
openModal(h);
};


// ══════════════════════════════
// 5. EASTER EGGS
// ══════════════════════════════

var konamiCode=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
var konamiIdx=0;

document.addEventListener('keydown',function(e){
if(e.key===konamiCode[konamiIdx]){
konamiIdx++;
if(konamiIdx===konamiCode.length){
konamiIdx=0;
activateEasterEgg();
}
}else{
konamiIdx=0;
}
});

function activateEasterEgg(){
if(typeof MFX_SFX!=='undefined')MFX_SFX.levelUp();
if(typeof spawnConfetti==='function')spawnConfetti();
var h='<div style="text-align:center;padding:24px">';
h+='<div style="font-size:64px;margin-bottom:8px" class="level-up"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg></div>';
h+='<div style="font-size:20px;font-weight:800;color:var(--ac)">KONAMI CODE!</div>';
h+='<div style="font-size:12px;color:var(--tx2);margin:8px 0">You found the secret! +10 XP</div>';
h+='<div style="font-size:10px;color:var(--tx3)">↑↑↓↓←→←→BA</div>';
h+='<button class="btn btn-pr" onclick="closeModal()" style="margin-top:12px">Epic!</button></div>';
openModal(h);
if(typeof awardXP==='function'){awardXP('quote.won','Konami Code');awardXP('quote.won','Easter egg bonus')}
}

// Secret: type "mfx" quickly anywhere
var secretBuf='';
var secretTimer=null;
document.addEventListener('keypress',function(e){
if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
secretBuf+=e.key;
clearTimeout(secretTimer);
secretTimer=setTimeout(function(){secretBuf=''},1500);
if(secretBuf.includes('mfx')){
secretBuf='';
if(typeof MFX_SFX!=='undefined')MFX_SFX.coin();
toast('🎮 MFX Mode Activated!','ok');
document.querySelector('.topbar').style.background='linear-gradient(90deg,#7c3aed,#6d28d9,#7c3aed)';
setTimeout(function(){document.querySelector('.topbar').style.background=''},3000);
}
});


// ══════════════════════════════
// 6. SMART NOTIFICATION CENTER
// ══════════════════════════════

window.openNotifications=function(){
var me=getUserName();
var qs=DB.quotes();
var h='<div class="modal-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Notifications</div>';
var notifs=[];

// Quote status changes
qs.forEach(function(q){
if(q.status==='approval'&&q.createdBy===me)
notifs.push({icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',text:q.quoteNum+' awaiting approval',time:q.updatedAt,action:"openEditor('"+q.id+"')"});
if(q.status==='rejected'&&q.createdBy===me)
notifs.push({icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',text:q.quoteNum+' was rejected'+(q.rejectionNote?' — '+q.rejectionNote:''),time:q.updatedAt,action:"openEditor('"+q.id+"')"});
if(q.status==='won'&&q.createdBy===me)
notifs.push({icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',text:q.quoteNum+' — WON!'+(q.wonAmount?' '+f$(q.wonAmount):''),time:q.closedAt||q.updatedAt,action:"openEditor('"+q.id+"')"});

// @mentions
(q.internalNotes||[]).forEach(function(n){
if(n.text&&n.text.includes('@'+me)&&n.by!==me)
notifs.push({icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',text:n.by+' mentioned you in '+q.quoteNum,time:n.at,action:"openEditor('"+q.id+"')"});
});
});

notifs.sort(function(a,b){return new Date(b.time||0)-new Date(a.time||0)});

if(notifs.length){
notifs.slice(0,15).forEach(function(n){
h+='<div class="card" style="padding:8px 10px;cursor:pointer" onclick="closeModal();'+n.action+'">';
h+='<div style="display:flex;align-items:center;gap:8px">';
h+='<span style="font-size:16px">'+n.icon+'</span>';
h+='<div style="flex:1"><div style="font-size:11px;color:var(--tx)">'+n.text+'</div>';
h+='<div style="font-size:8px;color:var(--tx3)">'+fD(n.time)+'</div></div></div></div>';
});
}else{
h+='<div style="text-align:center;padding:20px;color:var(--tx3)"><div style="font-size:32px;margin-bottom:8px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div style="font-size:11px">All caught up!</div></div>';
}
h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:8px">Close</button>';
openModal(h);
};


// ══════════════════════════════
// 7. HOOK INTO EXISTING ACTIONS
// ══════════════════════════════

function hookChallenges(){
// Hook quote creation for daily challenges
var _nq=window.newQuote;
if(_nq){
window.newQuote=function(tplId){
_nq(tplId);
updateChallengeProgress('quotesToday',1);
};
}

// Hook mood post
var _pm=window.postMood;
if(_pm){
window.postMood=function(){
_pm();
updateChallengeProgress('moodsToday',1);
};
}

// Hook task complete
var _ct=window.completeTask;
if(_ct){
window.completeTask=function(tid){
_ct(tid);
updateChallengeProgress('tasksToday',1);
};
}

// Hook comments
var _cm=window.commentMoodPost;
if(_cm){
window.commentMoodPost=function(id){
_cm(id);
updateChallengeProgress('commentsToday',1);
updateChallengeProgress('repliesToday',1);
};
}

// Hook customer save
var _sc=window.saveCust;
if(_sc){
window.saveCust=function(c){
_sc(c);
updateChallengeProgress('clientUpdates',1);
};
}

// Early bird check
var hour=new Date().getHours();
if(hour<8)updateChallengeProgress('earlyLogin',1);

// Streak keeper
var gd=typeof getGamData==='function'?getGamData():null;
if(gd&&gd.streak>0)updateChallengeProgress('streakKept',1);
}


// ══════════════════════════════
// INIT
// ══════════════════════════════

window.initFeatures=function(){
hookChallenges();
// Show daily challenge reminder on dashboard
setTimeout(function(){
var dc=getDailyChallenge();
var incomplete=dc.challenges.filter(function(c){return!c.completed}).length;
if(incomplete>0&&S.view==='dashboard'){
// Subtle reminder in alert reel
var reel=document.getElementById('alertReel');
if(reel&&reel.style.display==='none'){
reel.style.display='block';
reel.style.background='linear-gradient(90deg,#7c3aed,#6d28d9,#7c3aed)';
reel.style.color='#c4b5fd';
reel.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> '+incomplete+' daily challenge'+(incomplete>1?'s':'')+' remaining — <span style="cursor:pointer;text-decoration:underline" onclick="openDailyChallenges()">View</span>';
}
}
},2000);
};

})();
