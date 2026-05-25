'use strict';
var MFX_SHARED_CALENDAR = 'primary';
var _moduleInterval1 = null; // updateHamNotifs
var _moduleInterval2 = null; // updateActiveUsers
var _moduleInterval3 = null; // checkAlerts
var _moduleInterval4 = null; // updateDashClock

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

function openTeamChat(){S.view='supportboard';document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});$('v-supportboard').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='none';$('hdrTitle').textContent='Flex Chat';$('hdrActions').innerHTML='<button class="btn btn-ghost btn-sm" onclick="window.open(\'https://chat.google.com\',\'_blank\')" style="font-size:10px">Google Chat ↗</button>';if(typeof applyDeptTheme==='function')applyDeptTheme('dashboard');if(typeof trackView==='function')trackView('chat');if(typeof renderChat==='function')renderChat();else renderDiscussionBoard()}

function renderDiscussionBoard(){var el=$('v-supportboard');if(!el)return;var bt=window._boardTab||0;var h='<div style="display:flex;gap:4px;margin-bottom:10px;overflow-x:auto">';['😊 Moods','🎯 CEO','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 22v-4h6v4"/></svg> Dept','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Tasks','💬 Threads','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Requests','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Flex'].forEach(function(t,i){h+='<div style="padding:5px 10px;background:'+(bt===i?'var(--ac)':'var(--bg3)')+';color:'+(bt===i?'#fff':'var(--tx2)')+';border-radius:20px;font-size:9px;font-weight:600;cursor:pointer" onclick="window._boardTab='+i+';renderDiscussionBoard()">'+t+'</div>'});h+='</div><div id="boardContent"></div>';el.innerHTML=h;renderBoardTab(bt)}

function renderBoardTab(tab){var el=$('boardContent');if(!el)return;if(tab===0)renderMoodBoard(el);else if(tab===1)renderCEOBoard(el);else if(tab===2)renderDeptBoard2(el);else if(tab===3)renderTaskBoard(el);else if(tab===4)renderThreadBoard(el);else if(tab===5)renderRequestBoard(el);else renderFlexBoard(el)}
function renderMoodBoard(el){var h='<div class="card" style="border:1px solid var(--ac);background:linear-gradient(135deg,var(--bg3),var(--bg2));margin-bottom:10px">';h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';['😊','🔥','💪','🎯','😤','☕','🚀','💜','⚡','🧠'].forEach(function(m){h+='<span style="font-size:20px;cursor:pointer;transition:transform .1s" onclick="selectMood(\''+m+'\')" id="mood_'+m+'">'+m+'</span>'});h+='</div>';h+='<div style="display:flex;gap:6px"><textarea id="moodInput" placeholder="What\'s on your mind? Share a vibe, shoutout, update..." style="flex:1;min-height:36px;padding:8px;background:var(--inp);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:11px;resize:none"></textarea>';h+='<button class="btn btn-pr btn-sm" onclick="postMood()" style="align-self:flex-end;padding:8px 14px">Post</button></div></div>';h+='<div id="moodFeed"><div style="color:var(--tx3);font-size:10px;text-align:center;padding:10px">Loading feed...</div></div>';el.innerHTML=h;loadMoodFeed()}
function renderCEOBoard(el){el.innerHTML='<div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>🎯 CEO Priority</strong><button class="btn btn-pr btn-xs" onclick="newProject(\'ceo\')">+ New</button></div><div id="ceoBL">Loading...</div>';if(!fbDb)return;fbDb.collection('projects').where('board','==','ceo').orderBy('createdAt','desc').limit(20).get().then(function(s){var h='';s.docs.forEach(function(d){var p=Object.assign({id:d.id},d.data());h+=projectCard(p)});if(!s.docs.length)h='<div style="color:var(--tx3);padding:20px;text-align:center">No projects</div>';$('ceoBL').innerHTML=h}).catch(function(e){$('ceoBL').innerHTML=esc(e.message)})}
function renderDeptBoard2(el){el.innerHTML='<div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 22v-4h6v4"/></svg> Department</strong><button class="btn btn-pr btn-xs" onclick="newProject(\'dept\')">+ New</button></div><div id="deptBL">Loading...</div>';if(!fbDb)return;fbDb.collection('projects').where('board','==','dept').orderBy('createdAt','desc').limit(20).get().then(function(s){var h='';s.docs.forEach(function(d){var p=Object.assign({id:d.id},d.data());h+=projectCard(p)});if(!s.docs.length)h='<div style="color:var(--tx3);padding:20px;text-align:center">No projects</div>';$('deptBL').innerHTML=h}).catch(function(e){$('deptBL').innerHTML=esc(e.message)})}
function renderTaskBoard(el){el.innerHTML='<strong><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Tasks</strong><div id="taskBL" style="margin-top:6px">Loading...</div>';if(!fbDb)return;fbDb.collection('tasks').orderBy('createdAt','desc').limit(30).get().then(function(s){var h='';s.docs.forEach(function(d){h+=taskCard(Object.assign({id:d.id},d.data()))});if(!s.docs.length)h='<div style="color:var(--tx3);padding:20px;text-align:center">No tasks</div>';$('taskBL').innerHTML=h}).catch(function(e){$('taskBL').innerHTML=esc(e.message)})}
function renderThreadBoard(el){el.innerHTML='<strong>💬 Threads</strong><div style="display:flex;gap:6px;margin:8px 0"><textarea id="threadMsg" placeholder="Ask or share..." style="flex:1;min-height:36px;padding:6px;border:1px solid var(--bdr);border-radius:8px;background:var(--inp);color:var(--tx);font-size:11px"></textarea><button class="btn btn-pr btn-sm" onclick="postThread()">Post</button></div><div id="threadBL">Loading...</div>';if(!fbDb)return;fbDb.collection('threads').orderBy('timestamp','desc').limit(20).get().then(function(s){var h='';s.docs.forEach(function(d){var t=Object.assign({id:d.id},d.data());h+='<div class="card" style="margin-bottom:6px"><strong style="color:var(--ac);font-size:11px">'+esc(t.user)+'</strong><div style="font-size:12px;margin:4px 0">'+esc(t.message)+'</div><div style="font-size:9px"><span style="cursor:pointer" onclick="likePost(\'threads\',\''+t.id+'\')">👍'+(t.likes||0)+'</span> <button class="btn btn-ghost btn-xs" onclick="replyToPost(\'threads\',\''+t.id+'\')">💬</button></div></div>'});$('threadBL').innerHTML=h||'<div style="color:var(--tx3);padding:20px;text-align:center">Start a thread!</div>'}).catch(function(e){$('threadBL').innerHTML=esc(e.message)})}
function renderRequestBoard(el){el.innerHTML='<div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Requests</strong><button class="btn btn-pr btn-xs" onclick="openRFQRequest()">+ New</button></div><div id="reqBL">Loading...</div>';if(!fbDb)return;fbDb.collection('requests').orderBy('submittedAt','desc').limit(20).get().then(function(s){var h='';s.docs.forEach(function(d){var r=Object.assign({id:d.id},d.data());h+='<div class="card" style="cursor:pointer;border-left:3px solid '+(r.status==='pending'?'var(--or)':'var(--ac)')+'" onclick="openRequestDetail(\''+r.id+'\')"><div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(r.company||r.requestType)+'</strong><span style="font-size:8px;padding:2px 6px;background:var(--bg4);border-radius:4px;color:var(--ac)">'+esc(r.requestType)+'</span></div><div style="font-size:9px;color:var(--tx3)">'+esc(r.submittedBy||'')+' · '+esc(r.status)+'</div></div>'});$('reqBL').innerHTML=h||'No requests'}).catch(function(e){$('reqBL').innerHTML=esc(e.message)})}
function renderFlexBoard(el){el.innerHTML='<strong><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Flex</strong><div style="display:flex;gap:6px;margin:8px 0"><textarea id="flexMsg" placeholder="Drop a vibe..." style="flex:1;min-height:36px;padding:6px;border:1px solid var(--bdr);border-radius:8px;background:var(--inp);color:var(--tx);font-size:11px"></textarea><button class="btn btn-pr btn-sm" onclick="postFlex()">Post</button></div><div id="flexBL">Loading...</div>';if(!fbDb)return;fbDb.collection('support').orderBy('timestamp','desc').limit(20).get().then(function(s){var h='';s.docs.forEach(function(d){var t=Object.assign({id:d.id},d.data());h+='<div class="card" style="margin-bottom:6px"><strong style="color:var(--ac);font-size:11px">'+esc(t.user)+'</strong><div style="font-size:12px;margin:4px 0">'+esc(t.message)+'</div><div style="font-size:9px"><span style="cursor:pointer" onclick="likePost(\'support\',\''+t.id+'\')">👍'+(t.likes||0)+'</span> <button class="btn btn-ghost btn-xs" onclick="replyToPost(\'support\',\''+t.id+'\')">💬</button></div></div>'});$('flexBL').innerHTML=h||'Drop a vibe!'}).catch(function(e){$('flexBL').innerHTML=esc(e.message)})}

function projectCard(p){var cl=p.checklist||[];var dn=cl.filter(function(c){return c.done}).length;return'<div class="card" style="margin-bottom:6px;border-left:3px solid '+(p.status==='closed'?'var(--gn)':'var(--ac)')+';cursor:pointer" onclick="openProjectDetail(\''+p.id+'\')"><div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(p.title)+'</strong><span style="font-size:9px;color:var(--tx3)">'+esc(p.status)+'</span></div><div style="font-size:9px;color:var(--tx3)">'+esc(p.dept||'Open')+' · '+esc(p.assignedTo||'Unassigned')+(cl.length?' · '+dn+'/'+cl.length:'')+'</div></div>'}
function newProject(board){var users=['Randy','Marco R.','Alex M.','Chris W.'];var h='<div class="modal-title">'+(board==='ceo'?'🎯 CEO':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 22v-4h6v4"/></svg> Dept')+' Project</div><div class="fg"><label>Title *</label><input id="pj-title"></div><div class="fg"><label>Description</label><textarea id="pj-desc" style="min-height:50px"></textarea></div><div class="fg"><label>Dept</label><select id="pj-dept"><option value="">Open</option>';['Operations','Estimation','Pre-Press','Production','Quality','Sales'].forEach(function(d){h+='<option>'+d+'</option>'});h+='</select></div><div class="fg"><label>Assign To</label><select id="pj-assign"><option value="">Open</option>';users.forEach(function(u){h+='<option>'+u+'</option>'});h+='</select></div><div class="fg"><label>Due Date</label><input id="pj-due" type="date"></div><button class="btn btn-pr" onclick="saveProject(\''+board+'\')" style="width:100%;margin-top:8px">Create</button><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';openModal(h)}
function saveProject(board){var title=($('pj-title')||{}).value;if(!title)return toast('Title required','err');fbDb.collection('projects').add({board:board,title:title.trim(),description:($('pj-desc')||{}).value||'',dept:($('pj-dept')||{}).value||'',assignedTo:($('pj-assign')||{}).value||'',dueDate:($('pj-due')||{}).value||'',status:'open',checklist:[],comments:[],collaborators:[],createdBy:getUserName(),createdAt:firebase.firestore.FieldValue.serverTimestamp()}).then(function(){closeModal();toast('Created!','ok');renderBoardTab(window._boardTab||0)})}
function openProjectDetail(pid){fbDb.collection('projects').doc(pid).get().then(function(doc){if(!doc.exists)return;var p=Object.assign({id:doc.id},doc.data());var h='<div class="modal-title">'+esc(p.title)+'</div><div style="font-size:10px;color:var(--tx3);margin-bottom:8px"><b>Dept:</b> '+esc(p.dept||'Open')+' · <b>Assigned:</b> '+esc(p.assignedTo||'Open')+' · <b>Status:</b> '+esc(p.status)+'</div>';if(p.description)h+='<div style="font-size:11px;color:var(--tx2);background:var(--bg3);padding:6px;border-radius:6px;margin-bottom:6px">'+esc(p.description)+'</div>';var cl=p.checklist||[];h+='<div style="font-size:10px;font-weight:600;margin-bottom:3px">Checklist ('+cl.filter(function(c){return c.done}).length+'/'+cl.length+')</div>';cl.forEach(function(c,i){h+='<div style="font-size:10px;padding:2px 0;cursor:pointer" onclick="toggleProjectCheck(\''+pid+'\','+i+')">'+(c.done?'✅':'☐')+' '+esc(c.text)+'</div>'});h+='<div style="display:flex;gap:4px;margin:4px 0"><input id="pj-sub" placeholder="Add item" style="flex:1;padding:3px;border:1px solid var(--bdr);border-radius:4px;background:var(--inp);color:var(--tx);font-size:10px"><button class="btn btn-ghost btn-xs" onclick="addProjectCheck(\''+pid+'\')">+</button></div>';h+='<div style="font-size:10px;font-weight:600;margin:6px 0 3px">Comments ('+(p.comments||[]).length+')</div>';(p.comments||[]).forEach(function(c){h+='<div style="padding:3px 0;border-bottom:1px solid var(--bdr);font-size:10px"><strong style="color:var(--ac)">'+esc(c.by)+'</strong> '+esc(c.text)+'</div>'});h+='<textarea id="pj-comment" placeholder="Comment..." style="width:100%;min-height:30px;padding:4px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:10px;margin:4px 0"></textarea><button class="btn btn-ghost btn-xs" onclick="addProjectComment(\''+pid+'\')" style="width:100%;margin-bottom:6px">Post</button>';if(p.status==='open')h+='<button class="btn btn-gn btn-sm" onclick="closeProject(\''+pid+'\')" style="width:100%;margin-bottom:4px">✅ Close</button>';h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%">Close</button>';openModal(h)}).catch(function(e){ console.warn('MODULES get:', e.message); })}
function toggleProjectCheck(pid,idx){fbDb.collection('projects').doc(pid).get().then(function(doc){var p=doc.data();var cl=p.checklist||[];if(cl[idx]){cl[idx].done=!cl[idx].done;cl[idx].completedAt=cl[idx].done?new Date().toISOString():null}fbDb.collection('projects').doc(pid).update({checklist:cl}).then(function(){closeModal();openProjectDetail(pid)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}
function addProjectCheck(pid){var el=$('pj-sub');if(!el||!el.value.trim())return;fbDb.collection('projects').doc(pid).get().then(function(doc){var p=doc.data();var cl=p.checklist||[];cl.push({text:el.value.trim(),done:false});fbDb.collection('projects').doc(pid).update({checklist:cl}).then(function(){closeModal();openProjectDetail(pid)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}
function addProjectComment(pid){var el=$('pj-comment');if(!el||!el.value.trim())return;fbDb.collection('projects').doc(pid).get().then(function(doc){var p=doc.data();var c=p.comments||[];c.push({by:getUserName(),text:el.value.trim(),at:fD(new Date().toISOString())});fbDb.collection('projects').doc(pid).update({comments:c}).then(function(){closeModal();openProjectDetail(pid)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}
function closeProject(pid){
if(!window.MFX_API||navigator.onLine===false){return toast('Closing a project requires server connection','err')}
window.MFX_API.postJSON('/api/transitionStatus',{collection:'projects',docId:pid,newStatus:'closed'}).then(function(res){
  if(res.success){closeModal();toast('Closed!','ok');renderBoardTab(window._boardTab||0)}
  else{toast(res.error||'Close failed','err')}
}).catch(function(e){console.warn('closeProject:',e);toast('Close failed — server error','err')})}

function postThread(){var el=$('threadMsg');if(!el||!el.value.trim())return;fbDb.collection('threads').add({message:el.value.trim(),user:getUserName(),timestamp:firebase.firestore.FieldValue.serverTimestamp(),likes:0,comments:[]}).then(function(){el.value='';renderBoardTab(3)})}
function postFlex(){var el=$('flexMsg');if(!el||!el.value.trim())return;fbDb.collection('support').add({message:el.value.trim(),user:getUserName(),timestamp:firebase.firestore.FieldValue.serverTimestamp(),likes:0,comments:[]}).then(function(){el.value='';renderBoardTab(5)})}
function likePost(col,id){var uid=getUserId();var likeKey='mfx_liked_'+col+'_'+id+'_'+uid;if(localStorage.getItem(likeKey)){toast('Already liked','err');return}localStorage.setItem(likeKey,'1');fbDb.collection(col).doc(id).update({likes:firebase.firestore.FieldValue.increment(1)}).then(function(){renderBoardTab(window._boardTab||0)})}
function replyToPost(col,id){var t=prompt('Reply:');if(!t)return;fbDb.collection(col).doc(id).get().then(function(doc){var d=doc.data();var c=d.comments||[];c.push({by:getUserName(),text:t.trim(),at:fD(new Date().toISOString())});fbDb.collection(col).doc(id).update({comments:c}).then(function(){renderBoardTab(window._boardTab||0)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}

function renderFlexTab(tab){renderFlexZone()}

function newDiscussion(){var h='<div class="modal-title">New Discussion</div><div class="fg"><label>Title *</label><input id="disc-title"></div><div class="fg"><label>Description</label><textarea id="disc-desc" style="min-height:50px"></textarea></div><div class="fg"><label>Assign To</label><select id="disc-assign"><option value="">Unassigned</option><option>Randy</option><option>Marco R.</option><option>Alex M.</option><option>Chris W.</option></select></div><div class="fg"><label>Due Date</label><input id="disc-due" type="date"></div><button class="btn btn-pr" onclick="saveDiscussion()" style="width:100%;margin-top:8px">Create</button><button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';openModal(h)}
function saveDiscussion(){var title=($('disc-title')||{}).value;if(!title)return toast('Title required','err');fbDb.collection('discussions').add({title:title.trim(),description:($('disc-desc')||{}).value||'',owner:getUserName(),assignedTo:($('disc-assign')||{}).value||'',dueDate:($('disc-due')||{}).value||'',checklist:[],comments:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()}).then(function(){closeModal();toast('Created!','ok')})}
function openDiscussion(did){fbDb.collection('discussions').doc(did).get().then(function(doc){if(!doc.exists)return;var d=Object.assign({id:doc.id},doc.data());var h='<div class="modal-title">'+esc(d.title)+'</div><div style="font-size:10px;color:var(--tx3);margin-bottom:6px">'+esc(d.owner)+' → '+esc(d.assignedTo||'—')+'</div>';if(d.description)h+='<div style="font-size:11px;background:var(--bg3);padding:6px;border-radius:6px;margin-bottom:6px">'+esc(d.description)+'</div>';h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%">Close</button>';openModal(h)}).catch(function(e){ console.warn('MODULES get:', e.message); })}


function getQuotePricingForRegistry(q){
if(!q)return{qtyBreakdown:'',totalPerQty:'',ppuPerQty:'',setupTotal:'',materialWW:''};
var f=q.fields;var gv=function(k){return parseFloat(f[k])||0};
var sA=gv('sA'),nA=Math.max(1,gv('nAcross')),gA=gv('gA'),oc=gv('offCuts');
var msi=gv('msiCost'),sm=gv('stockMgn'),ms=gv('matSetup'),mu=gv('mkupPct')/100;
var cpp=gv('cppPlate'),pps=gv('plPerSku'),ccc=gv('ccCost'),ncc=gv('nCC');
var mrH=gv('mrHrs'),mrR=gv('mrRate'),cuH=gv('cuHrs'),cuR=gv('cuRate');
var ww=sA*nA+(nA-1)*gA+0.875,mww=ww+oc,rp=(gv('sar')||0)+(gv('gar')||0);
var pl=cpp*pps,cc=ccc*ncc,mr=mrH*mrR,cu=cuH*cuR,setup=pl+cc+mr+cu;
var rpct=gv('repPct')/100;var qtys=(q.qtys||[]).filter(function(x){return x>0});
var bd=[],tt=[],pp=[];
qtys.forEach(function(qty){var nft=(qty*rp/12)/nA;var tft=nft*1.2+ms;var matCost=mww*tft*0.012*msi*sm;
var raw=matCost+1*setup;var base=raw*(1+mu);var tot=base*(1+rpct);var ppu=tot/qty;
bd.push(qty.toLocaleString());tt.push('$'+tot.toFixed(2));pp.push('$'+ppu.toFixed(4))});
return{qtyBreakdown:bd.join(' | '),totalPerQty:tt.join(' | '),ppuPerQty:pp.join(' | '),setupTotal:'$'+setup.toFixed(2),materialWW:mww.toFixed(4)}}

function createGoogleTask(title,notes,dueDate){
getGoogleToken().then(function(token){if(!token)return;
fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({title:title,notes:notes||'',due:dueDate?dueDate+'T00:00:00.000Z':undefined,status:'needsAction'})
}).then(function(r){return r.json()}).then(function(d){console.log('Task:',d.id)}).catch(function(e){console.warn('op:',e)})})}

function fetchGoogleTasks(callback){
getGoogleToken().then(function(token){if(!token){callback([]);return}
fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=50&showCompleted=true',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(data){
callback((data.items||[]).map(function(t){return{id:'gtask_'+t.id,title:'☑ '+t.title,date:(t.due||'').substring(0,10),time:'',notes:t.notes||'',isGTask:true,completed:t.status==='completed'}}))
}).catch(function(e){console.warn('calTasksLoad:',e);callback([])})}).catch(function(e){console.warn('calTasksLoad:',e);callback([])})}

function completeGoogleTask(taskId){
getGoogleToken().then(function(token){if(!token)return;
fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks/'+taskId,{
method:'PATCH',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({status:'completed'})}).catch(function(e){console.warn('op:',e)})})}

function fetchGoogleCalEvents(callback){
if(!MFX_SHARED_CALENDAR){console.warn('Calendar ID not configured');callback([]);return}
getGoogleToken().then(function(token){if(!token){callback([]);return}
var now=new Date();var start=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
var end=new Date(now.getFullYear(),now.getMonth()+2,0).toISOString();
fetch('https://www.googleapis.com/calendar/v3/calendars/'+MFX_SHARED_CALENDAR+'/events?timeMin='+encodeURIComponent(start)+'&timeMax='+encodeURIComponent(end)+'&maxResults=50&singleEvents=true&orderBy=startTime',{
headers:{'Authorization':'Bearer '+token}
}).then(function(r){return r.json()}).then(function(data){
callback((data.items||[]).map(function(e){var dt=e.start.dateTime||e.start.date||'';
return{id:'gcal_'+e.id,title:e.summary||'',date:dt.substring(0,10),time:dt.length>10?dt.substring(11,16):'',type:'meeting',isGcal:true,notes:[],completed:false}}))
}).catch(function(e){console.warn('calEventsLoad:',e);callback([])})}).catch(function(e){console.warn('calEventsLoad:',e);callback([])})}

function getFlexData(){
var qs=DB.quotes();var me=getUserName();
var users={};qs.forEach(function(q){var u=q.createdBy||'Unknown';if(!users[u])users[u]={quotes:0,won:0,lost:0,notes:0,sent:0,pts:0};users[u].quotes++;if(q.status==='won')users[u].won++;if(q.status==='lost')users[u].lost++;if(q.status==='sent')users[u].sent++;(q.internalNotes||[]).forEach(function(n){if(n.by===u)users[u].notes++})});
Object.keys(users).forEach(function(u){var p=calcPoints(u,qs);users[u].pts=typeof p==='object'?p.pts:(p||0)});
return{qs:qs,me:me,users:users}}

var _mentionUsers=['Randy','Marco','Alex','Chris'];
document.addEventListener('input',function(e){
if(e.target.tagName==='TEXTAREA'){var id=e.target.id;if(!id){id='_ta_'+Date.now();e.target.id=id}
var val=e.target.value;var cp=e.target.selectionStart;var before=val.substring(0,cp);
var atIdx=before.lastIndexOf('@');
if(atIdx>-1){var query=before.substring(atIdx+1).toLowerCase();
var matches=_mentionUsers.filter(function(u){return u.toLowerCase().startsWith(query)});
if(matches.length){showMentionPicker(id,matches)}else{hideMentionPicker()}}
else{hideMentionPicker()}}},true);
document.addEventListener('blur',function(e){if(e.target.tagName==='TEXTAREA')setTimeout(hideMentionPicker,200)},true);

function showMentionPicker(inputId,matches){
var picker=$('mentionPicker');
if(!picker){picker=document.createElement('div');picker.id='mentionPicker';picker.style.cssText='position:fixed;bottom:60px;left:12px;right:12px;background:var(--card);border:1px solid var(--ac);border-radius:8px;z-index:300;max-height:150px;overflow-y:auto;box-shadow:0 0 20px rgba(180,77,255,.3)';document.body.appendChild(picker)}
picker.style.display='block';
picker.innerHTML=matches.map(function(u){return'<div style="padding:10px 14px;cursor:pointer;font-size:12px;color:var(--tx);border-bottom:1px solid var(--bdr)" onmousedown="insertMention(\''+inputId+'\',\''+u+'\')"><strong style="color:var(--ac)">@'+u+'</strong></div>'}).join('')}

function hideMentionPicker(){var p=$('mentionPicker');if(p)p.style.display='none'}

function insertMention(inputId,user){var el=$(inputId);if(!el)return;var val=el.value;var cp=el.selectionStart;var before=val.substring(0,cp);var after=val.substring(cp);var atIdx=before.lastIndexOf('@');el.value=before.substring(0,atIdx)+'@'+user+' '+after;el.focus();el.selectionStart=el.selectionEnd=atIdx+user.length+2;hideMentionPicker();if(typeof notifyTeam==='function')notifyTeam('🔔 '+getUserName()+' mentioned @'+user)}


function getQuoteAlerts(qs){
var alerts=[];var now=new Date();var td=new Date(now-3*86400000);
qs.forEach(function(q){
if(q.status==='draft'&&q.updatedAt&&new Date(q.updatedAt)<td)alerts.push({type:'stale',icon:'⚠',text:q.quoteNum+' draft untouched 3+ days',qid:q.id,color:'var(--or)'});
if(q.status==='sent'&&q.sentAt&&new Date(q.sentAt)<td)alerts.push({type:'followup',icon:'📤',text:q.quoteNum+' sent no response',qid:q.id,color:'var(--rd)'});
if(q.status==='approval'&&q.updatedAt&&new Date(q.updatedAt)<td)alerts.push({type:'approval',icon:'🔒',text:q.quoteNum+' pending 3+ days',qid:q.id,color:'var(--or)'})});
return alerts}

function getQuoteAnalytics(qs){
var now=new Date();var wa=new Date(now-7*86400000);
var tw=qs.filter(function(q){return new Date(q.createdAt)>wa});
var won=qs.filter(function(q){return q.status==='won'});var lost=qs.filter(function(q){return q.status==='lost'});
var wr=won.length+lost.length>0?Math.round(won.length/(won.length+lost.length)*100):0;
var ad=0;won.forEach(function(q){if(q.createdAt&&q.closedAt)ad+=Math.round((new Date(q.closedAt)-new Date(q.createdAt))/86400000)});
if(won.length)ad=Math.round(ad/won.length);
return{weekTotal:tw.length,weekWon:tw.filter(function(q){return q.status==='won'}).length,weekLost:tw.filter(function(q){return q.status==='lost'}).length,winRate:wr,avgDaysToWin:ad}}

// getQuotePricingForRegistry — defined once above (line ~34), duplicate removed

function logClientActivity(company,text){
if(!company||!fbDb)return;
var cs=DB.customers();var c=cs.find(function(x){return x.company===company});
if(c){if(!c.notes)c.notes=[];c.notes.unshift({text:text,by:getUserName(),at:new Date().toISOString()});DB.saveC(cs)}}

// emailViaMailto — defined once below (line ~816), duplicate removed


function toggleHamUserMenu(){var sub=$('hamUserSub');var arrow=$('hamUserArrow');if(!sub||!arrow)return;if(sub.style.display==='none'){sub.style.display='block';arrow.textContent='▴'}else{sub.style.display='none';arrow.textContent='▾'}}

function openRequestDetail(rid){openReqProfile(rid)}
function openRFQDetail(rid){openReqProfile(rid)}

function addReqComment(rid){var el=$('req-comment');if(!el||!el.value.trim())return;
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();var c=r.comments||[];
c.push({by:getUserName(),text:el.value.trim(),at:fD(new Date().toISOString()),likes:0,replies:[]});
fbDb.collection('requests').doc(rid).update({comments:c}).then(function(){closeModal();openReqProfile(rid);toast('Posted','ok')})}).catch(function(e){ console.warn('MODULES get:', e.message); })}

function replyReqComment(rid,ci){var text=prompt('Reply:');if(!text)return;
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();var c=r.comments||[];
if(c[ci]){if(!c[ci].replies)c[ci].replies=[];c[ci].replies.push({by:getUserName(),text:text.trim(),at:fD(new Date().toISOString())})}
fbDb.collection('requests').doc(rid).update({comments:c}).then(function(){closeModal();openReqProfile(rid)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}

function likeReqComment(rid,ci){fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();var c=r.comments||[];
if(c[ci])c[ci].likes=(c[ci].likes||0)+1;
fbDb.collection('requests').doc(rid).update({comments:c}).then(function(){closeModal();openReqProfile(rid)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}

function acceptRequest(rid){
fbDb.collection('requests').doc(rid).update({status:'accepted',acceptedBy:getUserName(),acceptedAt:new Date().toISOString()}).then(function(){
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();
notifyTeam('✅ '+getUserName()+' accepted: '+r.requestType+' from '+r.submittedBy);
fbDb.collection('tasks').add({type:'task',title:'📨 '+r.requestType+': '+(r.company||r.subject||''),description:r.description||'',assignedTo:getUserName(),date:r.targetDate||'',priority:r.priority||'Normal',completed:false,pointsEarned:0,notes:[],subtasks:[],fromRequest:rid,createdBy:getUserName(),createdAt:new Date().toISOString()});
if(r.targetDate&&typeof createCalendarEvent==='function')createCalendarEvent('📨 '+r.requestType+': '+(r.company||''),r.description||'',r.targetDate,'09:00',60);
closeModal();toast('Accepted!','ok')}).catch(function(e){ console.warn('MODULES get:', e.message); })})}

function declineRequest(rid){var reason=prompt('Reason:');if(!reason)return;
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();
var c=r.comments||[];c.push({by:getUserName(),text:'❌ Declined: '+reason,at:fD(new Date().toISOString()),likes:0,replies:[]});
fbDb.collection('requests').doc(rid).update({status:'pending',assignedTo:'',comments:c}).then(function(){
closeModal();toast('Declined','ok');notifyTeam('❌ '+getUserName()+' declined: '+r.requestType)})}).catch(function(e){ console.warn('MODULES get:', e.message); })}

function startRequest(rid){fbDb.collection('requests').doc(rid).update({status:'in_progress',startedAt:new Date().toISOString()}).then(function(){
closeModal();toast('Started!','ok');openReqProfile(rid)})}

function completeRequest(rid){fbDb.collection('requests').doc(rid).update({status:'completed',completedAt:new Date().toISOString(),completedBy:getUserName()}).then(function(){
closeModal();toast('Complete!','ok');openReqProfile(rid);
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();notifyTeam('✅ '+r.requestType+' done — '+r.submittedBy+' to close')}).catch(function(e){ console.warn('MODULES get:', e.message); })})}

function closeRequest(rid){var feedback=prompt('Feedback:');var rating=prompt('Rate 1-5:');rating=Math.min(5,Math.max(1,parseInt(rating)||3));
fbDb.collection('requests').doc(rid).get().then(function(doc){var r=doc.data();
var c=r.comments||[];c.push({by:getUserName(),text:'🔒 Closed '+('⭐').repeat(rating)+' '+(feedback||''),at:fD(new Date().toISOString()),likes:0,replies:[]});
fbDb.collection('requests').doc(rid).update({status:'closed',closedAt:new Date().toISOString(),feedback:feedback||'',rating:rating,comments:c}).then(function(){
closeModal();toast('Closed!','ok')})}).catch(function(e){ console.warn('MODULES get:', e.message); })}

function assignRequest(rid){var to=($('req-assign-to')||{}).value;if(!to)return toast('Select someone','err');
fbDb.collection('requests').doc(rid).update({assignedTo:to}).then(function(){closeModal();toast('Assigned','ok');openReqProfile(rid)})}

function togglePriceLock(){const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;saveQ();q.pricingLocked=!q.pricingLocked;q.updatedAt=new Date().toISOString();logQuoteEvent(q,'lock',q.pricingLocked?'Pricing locked':'Pricing unlocked');DB.saveQ(all,S.editId);toast(q.pricingLocked?'Prices locked':'Prices unlocked','ok');renderEditor()}

// QTYS
function edRQ(){const q=getQ(S.editId);if(!q)return;const el=$('edQL');if(!el)return;el.innerHTML=q.qtys.map((v,i)=>`<div class="qty-row"><span class="qty-idx">${i+1}.</span><input type="number" value="${v}" min="1" step="1000" oninput="edUQ(${i},this.value)"><button class="qty-del" onclick="edDQ(${i})">×</button></div>`).join('')}
function edUQ(i,val){const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;const n=parseInt(val);if(!isNaN(n)&&n>0)q.qtys[i]=n;DB.saveQ(all,S.editId);edCalcAll()}
function edAddQ(){const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q||q.qtys.length>=20)return;const last=q.qtys[q.qtys.length-1]||10000;const step=parseInt(document.querySelector('[data-field="qStep"]')?.value)||5000;q.qtys.push(last+step);DB.saveQ(all,S.editId);edRQ();edCalcAll();updateMatrixPreview()}

function edAddCommonQtys(){const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;q.qtys=[5000,10000,25000,50000,100000];DB.saveQ(all,S.editId);edRQ();edCalcAll();updateMatrixPreview();toast('Common quantities loaded','ok')}

function edClearQtys(){if(!confirm('Clear all quantities?'))return;const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;q.qtys=[];DB.saveQ(all,S.editId);edRQ();edCalcAll();updateMatrixPreview()}

function updateMatrixPreview(){var el=$('matrixPreview');if(!el)return;var c=edCalc();if(!c||!c.mtx||!c.mtx.length){el.innerHTML='<div style="color:var(--tx3);font-size:10px">Add quantities to see pricing</div>';return}
var h='<table style="width:100%;border-collapse:collapse;font-size:10px">';
h+='<tr style="border-bottom:1px solid var(--bdr)"><th style="text-align:left;padding:4px 6px;color:var(--ac);font-weight:700">Qty</th><th style="text-align:right;padding:4px 6px;color:var(--ac);font-weight:700">Unit</th><th style="text-align:right;padding:4px 6px;color:var(--ac);font-weight:700">Total (1 SKU)</th></tr>';
c.mtx.forEach(function(r){
  h+='<tr style="border-bottom:1px solid var(--bdr)"><td style="padding:4px 6px;color:var(--tx)">'+fN(r.qty)+'</td>';
  h+='<td style="text-align:right;padding:4px 6px;color:var(--tx)">'+f$(r.skus[1]?r.skus[1].ppu:0)+'</td>';
  h+='<td style="text-align:right;padding:4px 6px;color:var(--ac);font-weight:700">'+f$(r.skus[1]?r.skus[1].tot:0)+'</td></tr>';
});
h+='</table>';el.innerHTML=h}
function edDQ(i){const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q||q.qtys.length<=1)return;q.qtys.splice(i,1);DB.saveQ(all,S.editId);edRQ();edCalcAll()}
function edSeedQ(){saveQ();const q=getQ(S.editId);if(!q)return;const f=q.fields;const qs=Math.max(1,parseInt(f.qStart)||10000),qst=Math.max(1,parseInt(f.qStep)||1000),qr=Math.min(20,Math.max(1,parseInt(f.qRows)||10));const all=DB.quotes();const qx=all.find(x=>x.id===S.editId);qx.qtys=[];for(let i=0;i<qr;i++)qx.qtys.push(qs+i*qst);DB.saveQ(all,S.editId);edRQ();edCalcAll()}

// CALC
function edCalc(){const q=getQ(S.editId);if(!q)return null;const f=q.fields;const gv=k=>parseFloat(f[k])||0;
const sA=gv('sA'),sar=gv('sar'),nA=Math.max(1,gv('nAcross')),gA=gv('gA'),gar=gv('gar'),oc=gv('offCuts');
const msi=gv('msiCost'),sm=gv('stockMgn'),ms=gv('matSetup'),mu=gv('mkupPct')/100;
const cpp=gv('cppPlate'),pps=gv('plPerSku'),ccc=gv('ccCost'),ncc=gv('nCC');
const mrH=gv('mrHrs'),mrR=gv('mrRate'),cuH=gv('cuHrs'),cuR=gv('cuRate');
const ww=sA*nA+(nA-1)*gA+0.875,mww=ww+oc,rp=sar+gar,cy=rp*nA*8;
const pl=cpp*pps,cc=ccc*ncc,mr=mrH*mrR,cu=cuH*cuR,setup=pl+cc+mr+cu;
const sc=Math.min(10,Math.max(1,parseInt(f.skuCols)||1));
const rpct=gv('repPct')/100;
const qtys=q.qtys.filter(x=>x>0);
const mtx=qtys.map(qty=>{const row={qty,skus:{}};const nft=(qty*rp/12)/nA,tft=nft*1.2+ms,sc_=mww*tft*0.012*msi*sm;for(let sk=1;sk<=sc;sk++){const raw=sc_+sk*setup;const base=raw*(1+mu);const tot=base*(1+rpct);row.skus[sk]={tot,ppu:tot/qty,rep:base*rpct}}return row});
return{ww,mww,oc,rp,cy,pl,cc,mr,cu,setup,mtx,qtys,sc,f,rpct}}

function edCalcAll(){const c=edCalc();if(!c)return;
const sb=$('specBox');if(sb)sb.innerHTML=`<div class="cbox-t">Computed</div><div class="crow"><span class="clbl">Print WW</span><span class="cval">${c.ww.toFixed(4)}"</span></div><div class="crow"><span class="clbl">Off-Cut</span><span class="cval" style="color:var(--or)">${c.oc>0?'+'+c.oc.toFixed(4)+'"':'0"'}</span></div><div class="cdiv"></div><div class="crow"><span class="clbl" style="color:var(--ac);font-weight:700">Material WW</span><span class="cval" style="color:#fff;font-weight:700">${c.mww.toFixed(4)}"</span></div><div class="crow"><span class="clbl">Repeat</span><span class="cval">${c.rp.toFixed(4)}"</span></div><div class="crow"><span class="clbl">Cylinder</span><span class="cval">${c.cy.toFixed(0)} tooth</span></div>`;
const pb=$('priceBox');if(pb)pb.innerHTML=`<div class="cbox-t">Pricing Formula</div><div style="font-size:9px;color:var(--tx3);padding:4px 0;line-height:1.5">WW = sA×nA + (nA-1)×gA + 0.875<br>MatWW = WW + offCuts<br>NeedFt = (qty×repeat/12)/nA<br>TotalFt = NeedFt×1.2 + setup<br>MatCost = MatWW×TotalFt×0.012×MSI×margin<br>Total = (MatCost + SKU×setup) × (1+MFX%) × (1+Rep%)</div><div class="cdiv"></div><div class="cbox-t">Per-SKU Setup</div><div class="crow"><span class="clbl">Plates</span><span class="cval">${f$(c.pl)}</span></div><div class="crow"><span class="clbl">Color Chg</span><span class="cval">${f$(c.cc)}</span></div><div class="crow"><span class="clbl">MR</span><span class="cval">${f$(c.mr)}</span></div><div class="crow"><span class="clbl">CU</span><span class="cval">${f$(c.cu)}</span></div><div class="cdiv"></div><div class="crow"><span class="clbl" style="color:var(--ac);font-weight:700">Total Setup</span><span class="cval" style="color:#fff;font-weight:700">${f$(c.setup)}</span></div>${c.rpct>0?'<div class="crow"><span class="clbl" style="color:var(--or)">Rep Commission</span><span class="cval" style="color:var(--or)">'+(c.rpct*100).toFixed(1)+'%</span></div>':''}`;
edPreview(c)}


function generateMFXQR(){
// Method 1: Use qrcode-generator CDN library
try{
if(typeof qrcode==='function'){
var qr=qrcode(0,'M');
qr.addData('https://www.microflexfilm.com');
qr.make();
var count=qr.getModuleCount();
var cell=Math.max(1,Math.floor(52/count));
var size=count*cell;
var pad=4;
var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(size+pad*2)+' '+(size+pad*2)+'" width="52" height="52">';
svg+='<rect width="'+(size+pad*2)+'" height="'+(size+pad*2)+'" fill="white"/>';
for(var r=0;r<count;r++){for(var c=0;c<count;c++){
if(qr.isDark(r,c)){svg+='<rect x="'+(pad+c*cell)+'" y="'+(pad+r*cell)+'" width="'+cell+'" height="'+cell+'" fill="#0a1628"/>'}}}
svg+='</svg>';
return svg}}catch(e){console.log('QR lib error:',e)}
// Method 2: Use external QR API as img tag
return '<img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=https%3A%2F%2Fwww.microflexfilm.com&bgcolor=FFFFFF&color=0a1628&format=svg" crossorigin="anonymous" width="70" height="70" style="border-radius:3px" onerror="this.parentElement.style.display=\'none\'">'}



function edPreview(c){if(!c)c=edCalc();if(!c)return;var _pvMode=window._quotePreviewMode||'external';const f=c.f;const q=getQ(S.editId);
const dt=f.quoteDate?new Date(f.quoteDate+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
const die=parseFloat(f.dieChg)||0,np=parseFloat(f.nPlates)||0,pp=parseFloat(f.plCost)||0;
const mrH=parseFloat(f.mrHrs)||0,mrR=parseFloat(f.mrRate)||0,cuH=parseFloat(f.cuHrs)||0,cuR=parseFloat(f.cuRate)||0;
const plTotal=np*pp,mrTotal=mrH*mrR,cuTotal=cuH*cuR;
const ship=parseFloat(f.shipping)||0;
const tfix=die+plTotal+mrTotal+cuTotal+ship;
const sm=f.showMode||'both';
var validUntil='—';
try{var vd=new Date(f.quoteDate+'T12:00');vd.setDate(vd.getDate()+30);validUntil=vd.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch(e){}
var jobDesc=(f.sA||'?')+'\"×'+(f.sar||'?')+'\" '+(f.shapeType||'')+' — '+(f.colors||'?')+'C '+(f.jobType||'Flexo');
var clientCode=f.clientCode||'MFX-000-00';
var salesRep=f.salesRep||f.estimator||'—';

// Build pricing table — compute material per qty × SKU
var _nA=Math.max(1,parseFloat(f.nAcross)||1);
var _ms=parseFloat(f.matSetup)||0;
var tbl='<table style="width:100%;border-collapse:collapse"><thead><tr>';
tbl+='<th style="background:#0a2e3e;color:#00e5ff;padding:5px 8px;font-size:8px;font-weight:800;text-align:center;border:1px solid #0d3a4f;width:22%">QTY</th>';
for(var sk=1;sk<=c.sc;sk++)tbl+='<th style="background:#0a2e3e;color:#00e5ff;padding:5px 8px;font-size:8px;font-weight:800;text-align:center;border:1px solid #0d3a4f">'+sk+' SKU'+(sk>1?'s':'')+'</th>';
tbl+='</tr></thead><tbody>';
for(var ri=0;ri<c.mtx.length;ri++){var r=c.mtx[ri];
var bg=ri%2===0?'#fff':'#f8fafb';
var _nft=(r.qty*c.rp/12)/_nA;
var _tft=_nft*1.2+_ms;
tbl+='<tr><td style="background:#edf1f5;padding:6px 8px;text-align:center;font-size:13px;font-weight:800;color:#0a2030;border:1px solid #e0e4ea;vertical-align:middle">'+fN(r.qty)+'</td>';
for(var sk=1;sk<=c.sc;sk++){var _skuFt=_tft*sk;tbl+='<td style="background:'+bg+';padding:5px 6px;text-align:center;border:1px solid #e8ecf0"><div style="font-size:11px;font-weight:800;color:#0a2030">'+f5$(r.skus[sk].ppu)+'</div><div style="font-size:7px;color:#00838f;font-weight:600;margin-top:1px;background:#e8f8fa;display:inline-block;padding:1px 5px;border-radius:2px">'+f$(r.skus[sk].tot)+'</div>'+(_pvMode==='internal'?'<div style="font-size:6px;color:#7c3aed;font-weight:600;margin-top:2px">'+fN(Math.round(_skuFt))+' ft</div>':'')+'</td>'}
tbl+='</tr>'}
tbl+='</tbody></table>';

// Note tags - only show if explicitly set
var noteTags='';
var tags=f.notesTags||[];
tags.forEach(function(t){noteTags+='<span style="display:inline-block;background:#b2ebf2;color:#00695c;font-size:6px;font-weight:700;padding:2px 6px;border-radius:2px">'+t+'</span>'});

var pg=$('quotePage');if(!pg)return;
pg.innerHTML=
// ═══ HEADER ═══
'<div style="padding:14px 24px 10px;display:flex;justify-content:space-between;align-items:center">'
+'<div style="line-height:1"><span style="font-family:Outfit,sans-serif;font-size:34px;font-weight:900;color:#0a2e3e;letter-spacing:-.5px;display:block">Microflex</span><div style="width:100%;height:2.5px;background:#00e5ff;margin:3px 0 4px;border-radius:1px"></div><span style="font-family:Outfit,sans-serif;font-size:10px;font-weight:300;color:#00838f;letter-spacing:5px;text-transform:uppercase;display:block">Film Corporation</span></div>'
+'<div style="text-align:center;flex-shrink:0;padding:0 16px"><div style="display:inline-block;padding:4px;border:1.5px solid #e0e8ee;border-radius:5px;line-height:0;background:#fafcfd">'+generateMFXQR()+'</div><div style="font-size:5px;color:#00838f;letter-spacing:1.2px;font-weight:700;margin-top:3px">SCAN · CONNECT</div></div>'
+'<div style="text-align:right"><div style="font-size:10px;font-weight:800;color:#0a2e3e">MicroflexFilm.com</div><div style="font-size:7px;color:#7a8a98;line-height:1.5;margin-top:2px;font-weight:500">4130 Garner Rd · Riverside, CA 92501<br>(909) 360-9066 · Quotes@MicroflexFilm.com</div><div style="font-size:7px;color:#00BCD4;font-weight:700;letter-spacing:1px;margin-top:3px">SQF Certified | Made in USA</div></div></div>'

// ═══ NAVY BAR ═══
+'<div style="padding:5px 24px;background:#0a2e3e;text-align:center"><span style="font-size:6.5px;color:#00e5ff;font-weight:600;letter-spacing:1px">FLEXIBLE PACKAGING</span><span style="font-size:6.5px;color:#0a5a6a;margin:0 5px">│</span><span style="font-size:6.5px;color:#00e5ff;font-weight:600;letter-spacing:1px">LABELS</span><span style="font-size:6.5px;color:#0a5a6a;margin:0 5px">│</span><span style="font-size:6.5px;color:#00e5ff;font-weight:600;letter-spacing:1px">POUCHES</span><span style="font-size:6.5px;color:#0a5a6a;margin:0 5px">│</span><span style="font-size:6.5px;color:#00e5ff;font-weight:600;letter-spacing:1px">SHRINK SLEEVES</span><span style="font-size:6.5px;color:#0a5a6a;margin:0 5px">│</span><span style="font-size:6.5px;color:#00e5ff;font-weight:600;letter-spacing:1px">SACHETS</span><span style="font-size:6.5px;color:#0a5a6a;margin:0 5px">│</span><span style="font-size:6.5px;color:#00e5ff;font-weight:600;letter-spacing:1px">STICK PACKS</span></div>'
+(_pvMode==='internal'?'<div style="padding:3px 24px;background:#fef2f2;border-bottom:2px solid #ef4444;text-align:center"><span style="font-size:8px;font-weight:900;color:#dc2626;letter-spacing:3px;text-transform:uppercase">⚠ INTERNAL USE ONLY — NOT FOR CLIENT ⚠</span></div>':'')

// ═══ TICKET ═══
+'<div style="display:flex;border-bottom:1px solid #e8ecf0">'
// Client side with vertical barcode
+'<div style="flex:1;display:flex;border-right:1px solid #edf0f2">'
+'<div style="width:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#fafcfd;border-right:1px solid #edf0f2"><div style="transform:rotate(-90deg);transform-origin:center center;white-space:nowrap">'+genBarcodeSVG(clientCode,150,35,'#4a5a68')+'</div></div>'
+'<div style="flex:1;padding:10px 14px 10px 8px">'
+'<div style="font-size:6px;color:#00BCD4;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:5px">Client</div>'
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">'
+'<div style="grid-column:1/-1"><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Company</div><div style="font-size:12px;font-weight:800;color:#0a2030">'+(f.custCo||'—')+'</div></div>'
+'<div><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Contact</div><div style="font-size:10px;font-weight:700;color:#0a2030">'+(f.custAttn||'—')+'</div></div>'
+'<div><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Email</div><div style="font-size:9px;font-weight:700;color:#0a2030">'+(f.custEmail||'—')+'</div></div>'
+'<div style="grid-column:1/-1;height:1px;background:#edf0f2;margin:2px 0"></div>'
+'<div><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Client Code</div><div style="font-size:10px;font-weight:700;color:#0a2030">'+clientCode+'</div></div>'
+'<div><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Industry</div><div style="font-size:10px;font-weight:700;color:#0a2030">'+(f.industry||'—')+'</div></div>'
+'<div><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">City, State</div><div style="font-size:10px;font-weight:700;color:#0a2030">'+(f.cityState||'—')+'</div></div>'
+'<div><div style="font-size:6px;color:#94a3b0;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Terms</div><div style="font-size:10px;font-weight:700;color:#0a2030">'+(f.payTerms||'Net 30')+'</div></div>'
+'<div style="grid-column:1/-1;height:1px;background:#edf0f2;margin:2px 0"></div>'
// Notes
+'<div style="grid-column:1/-1"><div style="background:#e0f7fa;border-left:2.5px solid #00e5ff;border-radius:0 4px 4px 0;padding:5px 8px"><div style="font-size:6px;color:#00838f;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Notes & Special Instructions</div><div style="font-size:7.5px;color:#0a3040;line-height:1.5;font-weight:500">'+(f.notes||'—')+'</div>'+(noteTags?'<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:3px">'+noteTags+'</div>':'')+'</div></div>'
+'<div style="grid-column:1/-1;height:1px;background:#edf0f2;margin:2px 0"></div>'
// Specs with color-coded tags
+'<div style="grid-column:1/-1"><div style="font-size:6px;color:#00BCD4;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Specifications</div><div style="display:flex;flex-direction:column;gap:4px">'
+'<div style="padding:5px 8px;background:#f7fee7;border-left:2.5px solid #84cc16;border-radius:0 4px 4px 0"><div style="font-size:6px;font-weight:700;color:#4d7c0f;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Dimensions</div><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center"><span style="font-size:6.5px;color:#3a5a10;font-weight:600">Size</span><span style="background:#d9f99d;color:#365314;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.sA||'?')+'" × '+(f.sar||'?')+'"</span><span style="font-size:6.5px;color:#3a5a10;font-weight:600">Shape</span><span style="background:#d9f99d;color:#365314;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.shapeType||'—')+'</span><span style="font-size:6.5px;color:#3a5a10;font-weight:600">Colors</span><span style="background:#d9f99d;color:#365314;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.colors||'—')+'</span><span style="font-size:6.5px;color:#3a5a10;font-weight:600">Copy Pos</span><span style="background:#d9f99d;color:#365314;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.windDir||f.copyPos||'—')+'</span></div></div>'
+(_pvMode==='internal'?'<div style="padding:5px 8px;background:#eff6ff;border-left:2.5px solid #2563eb;border-radius:0 4px 4px 0"><div style="font-size:6px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Web & Repeat</div><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center"><span style="font-size:6.5px;color:#1e3a8a;font-weight:600">Print WW</span><span style="background:#bfdbfe;color:#1e3a8a;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+c.ww.toFixed(3)+'"</span><span style="font-size:6.5px;color:#1e3a8a;font-weight:600">Material WW</span><span style="background:#bfdbfe;color:#1e3a8a;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+c.mww.toFixed(3)+'"</span><span style="font-size:6.5px;color:#1e3a8a;font-weight:600">Repeat</span><span style="background:#bfdbfe;color:#1e3a8a;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+c.rp.toFixed(3)+'"</span></div></div>':'')
+'<div style="padding:5px 8px;background:#f0fdf4;border-left:2.5px solid #16a34a;border-radius:0 4px 4px 0"><div style="font-size:6px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Finishing Specs</div><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center"><span style="font-size:6.5px;color:#14532d;font-weight:600">Impressions/Roll</span><span style="background:#bbf7d0;color:#14532d;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.labRoll||'—')+'</span><span style="font-size:6.5px;color:#14532d;font-weight:600">Copy Position</span><span style="background:#bbf7d0;color:#14532d;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.windDir||f.copyPos||'—')+'</span><span style="font-size:6.5px;color:#14532d;font-weight:600">Max OD</span><span style="background:#bbf7d0;color:#14532d;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.maxOD||'—')+'</span><span style="font-size:6.5px;color:#14532d;font-weight:600">Core Diameter</span><span style="background:#bbf7d0;color:#14532d;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.coreDia||'—')+'</span></div></div>'
+'<div style="padding:5px 8px;background:#fff7ed;border-left:2.5px solid #ea580c;border-radius:0 4px 4px 0"><div style="font-size:6px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Materials</div><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center"><span style="font-size:6.5px;color:#7c2d12;font-weight:600">Face</span><span style="background:#fed7aa;color:#7c2d12;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.faceStock||'—')+'</span><span style="font-size:6.5px;color:#7c2d12;font-weight:600">Lam</span><span style="background:#fed7aa;color:#7c2d12;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.lamination||'NA')+'</span><span style="font-size:6.5px;color:#7c2d12;font-weight:600">Liner</span><span style="background:#fed7aa;color:#7c2d12;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.liner||'NA')+'</span><span style="font-size:6.5px;color:#7c2d12;font-weight:600">Adhesive</span><span style="background:#fed7aa;color:#7c2d12;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.adhesive||'NA')+'</span><span style="font-size:6.5px;color:#7c2d12;font-weight:600">Coating</span><span style="background:#fed7aa;color:#7c2d12;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:2px">'+(f.coating||'NA')+'</span></div></div>'
+'</div></div></div></div></div>'

// Quote side
+'<div style="flex:1;padding:10px 20px 10px 14px;display:flex;flex-direction:column">'
+'<div style="text-align:center;margin-bottom:4px">'+genBarcodeSVG(q.quoteNum,130,30)+'</div>'
+'<div style="font-size:30px;font-weight:900;color:#0a2e3e;text-align:center;line-height:1;letter-spacing:-1px">'+q.quoteNum+'</div>'
+'<div style="text-align:center;margin-top:4px"><span style="display:inline-block;font-size:8px;font-weight:700;color:#fff;background:#00BCD4;padding:2px 10px;border-radius:3px;letter-spacing:.5px">REV '+q.rev+'</span></div>'
+'<div style="border:1.5px solid #dce2e8;border-radius:5px;padding:6px 10px;margin-top:8px">'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">Date</span><span style="color:#0a2030;font-weight:700">'+dt+'</span></div><div style="height:1px;background:#edf0f2;margin:1px 0"></div>'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">Job Description</span><span style="color:#0a2030;font-weight:700">'+jobDesc+'</span></div><div style="height:1px;background:#edf0f2;margin:1px 0"></div>'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">SKUs</span><span style="color:#0a2030;font-weight:700">'+c.sc+'</span></div><div style="height:1px;background:#edf0f2;margin:1px 0"></div>'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">Qty Recommendation</span><span style="color:#0a2030;font-weight:700">'+(c.mtx && c.mtx.length ? fN(c.mtx[c.mtx.length-1].qty) + ' (best value)' : 'N/A')+'</span></div><div style="height:1px;background:#edf0f2;margin:1px 0"></div>'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">Ship To</span><span style="color:#0a2030;font-weight:700">'+(f.shipTo||f.cityState||'—')+'</span></div><div style="height:1px;background:#edf0f2;margin:1px 0"></div>'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">Lead Time</span><span style="color:#0a2030;font-weight:700">15 working days</span></div><div style="height:1px;background:#edf0f2;margin:1px 0"></div>'
+'<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:8px"><span style="color:#94a3b0;font-weight:600">Valid Until</span><span style="color:#0a2030;font-weight:700">'+validUntil+'</span></div>'
+'</div>'
// Purple Flex Team
+'<div style="background:#f3e8ff;border:1.5px solid #d8b4fe;border-radius:5px;padding:6px 10px;margin-top:6px">'
+'<div style="font-size:6px;color:#7c3aed;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Flex Team</div>'
+'<div style="display:flex;justify-content:space-between;font-size:8px;padding:1px 0"><span style="color:#7c3aed;font-weight:600">Estimator</span><span style="color:#4c1d95;font-weight:700">'+(f.estimator||'—')+'</span></div>'
+'<div style="display:flex;justify-content:space-between;font-size:8px;padding:1px 0"><span style="color:#7c3aed;font-weight:600">Sales Rep</span><span style="color:#4c1d95;font-weight:700">'+salesRep+'</span></div>'
+'</div></div></div>'

// ═══ PRICING ═══
+'<div style="padding:6px 20px;background:#f5f7f9;border-bottom:1px solid #e8ecf0"><div style="font-size:6px;color:#00BCD4;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:5px">Pricing</div>'+tbl+'</div>'

// ═══ CHARGES + TERMS ═══
+'<div style="padding:6px 20px;border-bottom:1px solid #e8ecf0;display:flex;gap:10px">'
+(f.showSetupOnPDF?'<div style="flex:1;border:1.5px solid #DAA520;border-radius:5px;overflow:hidden"><div style="padding:4px 8px;background:#fdf8e8;border-bottom:1px solid #e8d8a0;font-size:6px;font-weight:800;color:#8B6914;letter-spacing:1.5px;text-transform:uppercase">Fixed Charges (per SKU)</div><div style="padding:3px 8px">'
+'<div style="display:flex;justify-content:space-between;padding:2.5px 0;font-size:8px;border-bottom:1px dashed #f0e8d0"><span style="color:#5a4a28">Die Charge</span><span style="color:#2a1a00;font-weight:800">'+f$(die)+'</span></div>'
+(f.showPlateOnPDF?'<div style="display:flex;justify-content:space-between;padding:2.5px 0;font-size:8px;border-bottom:1px dashed #f0e8d0"><span style="color:#5a4a28">Plates ('+np+' × '+f$(pp)+')</span><span style="color:#2a1a00;font-weight:800">'+f$(plTotal)+'</span></div>':'')
+'<div style="display:flex;justify-content:space-between;padding:2.5px 0;font-size:8px;border-bottom:1px dashed #f0e8d0"><span style="color:#5a4a28">Make-Ready ('+mrH+'h × $'+mrR+')</span><span style="color:#2a1a00;font-weight:800">'+f$(mrTotal)+'</span></div>'
+'<div style="display:flex;justify-content:space-between;padding:2.5px 0;font-size:8px;border-bottom:1px dashed #f0e8d0"><span style="color:#5a4a28">Clean-Up ('+cuH+'h × $'+cuR+')</span><span style="color:#2a1a00;font-weight:800">'+f$(cuTotal)+'</span></div>'
+(f.showShippingOnPDF?'<div style="display:flex;justify-content:space-between;padding:2.5px 0;font-size:8px"><span style="color:#5a4a28">Shipping (Est.)</span><span style="color:#2a1a00;font-weight:800">'+f$(ship)+'</span></div>':'')
+'</div><div style="background:#DAA520;padding:5px 8px;display:flex;justify-content:space-between;font-size:11px;font-weight:900;color:#fff"><span>Total Fixed / SKU</span><span>'+f$(tfix)+'</span></div></div>':'')
+'<div style="flex:1;border:1.5px solid #d0d8e0;border-radius:5px;overflow:hidden;display:flex;flex-direction:column"><div style="padding:4px 8px;background:#f5f7f9;border-bottom:1px solid #d0d8e0;display:flex;justify-content:space-between;align-items:center"><span style="font-size:6px;font-weight:800;color:#2a3a4a;letter-spacing:1.5px;text-transform:uppercase">Terms & Conditions</span><span style="font-size:11px;font-weight:900;color:#0a2e3e">'+(f.payTerms||'Net 30')+'</span></div>'
+'<div style="padding:4px 8px;flex:1;font-size:7px;color:#4a5a68;line-height:1.45">'+(q.terms||DEFAULT_TERMS).map(function(t){return'<div style="display:flex;align-items:flex-start;gap:4px;padding:1.5px 0"><div style="width:4px;height:4px;border:1.5px solid #00BCD4;border-radius:50%;flex-shrink:0;margin-top:2px"></div>'+t+'</div>'}).join('')+'</div></div></div>'

// ═══ NOTE BOX ═══
+(f.customNote?'<div style="padding:5px 20px;border-bottom:1px solid #e8ecf0"><div style="border:1.5px solid #00BCD4;border-radius:5px;background:#fff;padding:5px 10px"><div style="font-size:6px;font-weight:700;color:#00BCD4;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Note</div><div style="font-size:8px;color:#3a4a58;line-height:1.5;font-weight:500">'+f.customNote+'</div></div></div>':'')

// ═══ CTA BAR ═══
+'<div style="padding:8px 24px;background:#0a2e3e;text-align:center"><div style="font-family:Outfit,sans-serif;font-size:14px;font-weight:900;color:#fff">Ready to get started?</div><div style="font-size:8px;color:#00e5ff;font-weight:500;margin:2px 0 5px">Claim this pricing — contact us or scan the QR code above</div><div style="font-size:8.5px;font-weight:600;display:flex;justify-content:center;gap:8px;align-items:center"><span style="color:#fff;font-weight:800">MicroflexFilm.com</span><span style="color:#0a5a6a">│</span><span style="color:#fff;font-weight:800">(909) 360-9066</span><span style="color:#0a5a6a">│</span><span style="color:#fff;font-weight:800">Quotes@MicroflexFilm.com</span></div></div>'

// ═══ FINE PRINT ═══
+'<div style="padding:5px 24px;background:#fafbfc;border-bottom:1px solid #e8ecf0"><div style="font-size:7px;color:#6a7a88;line-height:1.4"><b style="color:#0a2e3e;font-weight:800">Microflex Film Corporation - Standard Terms:</b> Lead time is 15 working days from proof sign off. Quantities shipped are ±10% of order quantity; stand up gusset bags ±20%. Stability testing must be completed prior to running order. Art will be billed at $90.00/hour if not in AI format. Plates, dies, and tooling remain property of Microflex Film Corp until paid in full. Microflex makes no representations, warranties, or guarantees regarding the use of any particular material for any particular purpose. In the event of a printing error, liability is expressly limited to replacement of the defective job. All finished goods comply with FDA Title 21 CFR Sections 174–178 for food contact.</div><div style="margin-top:4px;font-size:7px;font-weight:700;color:#0a2e3e">For complete terms and conditions visit: <span style="text-decoration:underline">MicroflexFilm.com/Terms</span></div></div>'

// ═══ FOOTER ═══
+'<div style="padding:5px 24px;background:#f5f7f9;display:flex;justify-content:space-between;align-items:center"><div style="font-size:7px;color:#7a8a98;font-weight:600"><b style="color:#0a2e3e;font-weight:800">'+clientCode+'</b><br>'+(f.custCo||'')+'</div><div style="text-align:center;flex:1"><div style="font-family:Outfit,sans-serif;font-size:9px"><b style="font-weight:900;color:#0a2e3e">Microflex</b> <span style="font-weight:200;color:#5a7888">Film Corporation</span></div><div style="font-size:5px;color:#94a3b0">4130 Garner Rd · Riverside, CA 92501 · (909) 360-9066 · MicroflexFilm.com</div></div><div style="font-size:7px;color:#7a8a98;font-weight:600;text-align:right"><b style="color:#0a2e3e;font-weight:800">'+q.quoteNum+'</b><br>Rev '+q.rev+'</div></div>'}

let _st=null;function asave(){if(window.setSaveState)window.setSaveState('dirty');clearTimeout(_st);_st=setTimeout(()=>{saveQ();edCalcAll()},300)}
function doPrint(){saveQ();const q=getQ(S.editId);if(!q||!q.fields.estimator){toast('Estimator required','err');return}S.etab=5;renderEditor();
const orient=$('printOrientation')?$('printOrientation').value:'landscape';
document.body.className='print-'+orient;
const d=new Date();const mm=String(d.getMonth()+1).padStart(2,'0');const dd=String(d.getDate()).padStart(2,'0');
const client=(q.fields.custCo||'NoClient').replace(/[^a-zA-Z0-9]/g,'_').substring(0,30);
document.title=q.quoteNum+'_'+client+'_'+mm+'-'+dd;
setTimeout(()=>{toast('Select "Save as PDF"','info');setTimeout(()=>{window.print();document.title='Microflex Quote System';document.body.className=''},500)},200)}

// CODE 128 BARCODE SVG GENERATOR
function genBarcodeSVG(text,_svgW,_svgH,_barColor){
_barColor=_barColor||'black';const C128={' ':0,'!':1,'"':2,'#':3,'$':4,'%':5,'&':6,"'":7,'(':8,')':9,'*':10,'+':11,',':12,'-':13,'.':14,'/':15,'0':16,'1':17,'2':18,'3':19,'4':20,'5':21,'6':22,'7':23,'8':24,'9':25,':':26,';':27,'<':28,'=':29,'>':30,'?':31,'@':32,'A':33,'B':34,'C':35,'D':36,'E':37,'F':38,'G':39,'H':40,'I':41,'J':42,'K':43,'L':44,'M':45,'N':46,'O':47,'P':48,'Q':49,'R':50,'S':51,'T':52,'U':53,'V':54,'W':55,'X':56,'Y':57,'Z':58};
const PAT=['11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100','11001001110','11011100100','11001110100','11001110010','11010001110','11000101110','11011101000','11011100010','11011101110','11010001000','11010000100','11000101000','10000101100','10000100110','10110010000','10000110100','10000110010','11000010010','11001010000','11110111010','11010111000','11010001110','10111011000','10111000110','10001011100','10100011000','10001011000','10100001100','11010000100'];
const START_B=104;let sum=START_B;let idxs=[START_B];
for(let i=0;i<text.length;i++){const c=text.charCodeAt(i)-32;idxs.push(c);sum+=c*(i+1)}
idxs.push(sum%103);idxs.push(106);
let bars='';idxs.forEach(idx=>{if(idx>=0&&idx<PAT.length)bars+=PAT[idx];else bars+='11011001100'});
const w=bars.length;const bw=_svgW?(_svgW/(w+6)):1.5;const h=_svgH?(_svgH-14):40;
let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(w*bw+10)+' '+(h+14)+'" width="'+(_svgW||(w*bw+10))+'" height="'+(_svgH||(h+14))+'">';
svg+='<rect width="100%" height="100%" fill="white"/>';
for(let i=0;i<bars.length;i++){if(bars[i]==='1')svg+='<rect x="'+(5+i*bw)+'" y="2" width="'+bw+'" height="'+h+'" fill="'+_barColor+'"/>';}
svg+='<text x="'+((w*bw+10)/2)+'" y="'+(h+12)+'" text-anchor="middle" font-family="monospace" font-size="9" fill="#94a3b0">'+text+'</text>';
svg+='</svg>';return svg}

function openCEOPortal(){
S.view='ceoportal';document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));$('v-ceoportal').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=()=>goView('dashboard');$('hdrTitle').textContent='Approvals';$('hdrActions').innerHTML='';renderCEOPortal()}

function renderCEOPortal(){const qs=DB.quotes();const pending=qs.filter(q=>q.status==='approval');const approved=qs.filter(q=>q.approvedBy==='CEO');const rejected=qs.filter(q=>q.status==='rejected');const all=qs;const tw=qs.filter(q=>q.status==='won').reduce((a,q)=>a+(q.wonAmount||0),0);
$('v-ceoportal').innerHTML=`
<div style="display:flex;gap:6px;margin-bottom:10px;font-size:11px">
<div style="flex:1;background:#2d1f5e;border:1px solid #7c3aed;border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:#c4b5fd">${pending.length}</div><div style="color:#c4b5fd">Pending</div></div>
<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--gn)">${approved.length}</div><div style="color:var(--tx2)">Approved</div></div>
<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--or)">${rejected.length}</div><div style="color:var(--tx2)">Rejected</div></div>
<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--ac)">${f$(tw)}</div><div style="color:var(--tx2)">Revenue</div></div>
</div>
<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><span class="ttl">Pending Approval (${pending.length})</span><span class="arr">▾</span></div><div class="scard-b open">
${pending.length?pending.map(q=>`<div class="qcard" style="margin-bottom:8px">
<div class="qcard-top"><div><span class="qcard-num">${q.quoteNum}</span><span class="qcard-rev">Rev ${q.rev}</span></div><span class="pill pill-approval">approval</span></div>
<div class="qcard-co">${q.fields.custCo||'—'}</div>
<div class="qcard-desc">${q.fields.jobDesc||'—'} · ${q.fields.shapeType} · ${q.fields.sA}×${q.fields.sar}" · ${q.qtys?q.qtys.length+' qty':''}</div>
<div style="font-size:10px;color:var(--tx3);margin:4px 0">Created by ${q.createdBy||'Unknown'} · ${fD(q.createdAt)}</div>
<div style="display:flex;gap:6px;margin-top:6px">
<div class="compliance-boundary"></div>
<button class="btn btn-approve btn-sm" onclick="ceoAction('${q.id}','approve')" style="flex:1">🛡 Approve</button>
<button class="btn btn-reject btn-sm" onclick="ceoAction('${q.id}','reject')" style="flex:1">✕ Reject</button>
<button class="btn btn-ghost btn-sm" onclick="openEditor('${q.id}')">👁 View</button>
</div></div>`).join(''):'<div style="color:var(--tx3);padding:12px;text-align:center">No pending approvals</div>'}
</div></div>
<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico">✅</span><span class="ttl">Recently Approved</span><span class="arr">▾</span></div><div class="scard-b">
${approved.slice(0,10).map(q=>`<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;display:flex;justify-content:space-between"><div><strong>${q.quoteNum}</strong> — ${q.fields.custCo||'—'}</div><span style="color:var(--gn)">${fD(q.approvedAt)}</span></div>`).join('')||'<div style="color:var(--tx3);padding:8px">None yet</div>'}
</div></div>
<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></span><span class="ttl">All Quotes Overview</span><span class="arr">▾</span></div><div class="scard-b">
<div style="font-size:11px;color:var(--tx2);line-height:2">Total: <strong>${all.length}</strong> · Draft: <strong>${all.filter(q=>q.status==='draft').length}</strong> · Pending: <strong>${pending.length}</strong> · Sent: <strong>${all.filter(q=>q.status==='sent').length}</strong> · Won: <strong>${all.filter(q=>q.status==='won').length}</strong> · Lost: <strong>${all.filter(q=>q.status==='lost').length}</strong></div>
</div></div>`}

function ceoAction(qid,action,btnEl){
if(!window.MFX_API||navigator.onLine===false){return toast('Approval requires server connection — go online and retry','err')}
// Capture click event target as fallback so onclick="ceoAction(...)" without an explicit
// button arg still gets the spinner.
var btn = btnEl || (window.event && window.event.target);
var ceoNote = action==='approve' ? prompt('Approval notes (optional):') : prompt('Rejection reason:');
if(ceoNote === null && action==='reject') return;
window.MFX_API.postJSON('/api/ceoApprove',{docId:qid,collection:'quotes',action:action,note:ceoNote||''}, btn).then(function(res){
  if(res.success){
    toast(action==='approve'?'Approved → Ready!':'Rejected','ok');
    DB.logActivity('ceo.'+action,(DB.quotes().find(function(q){return q.id===qid})||{}).quoteNum+' '+action+' by server');
    if(action==='approve'){S.editId=qid;setTimeout(function(){if(typeof autoSaveApproved==='function')autoSaveApproved(qid)},500)}
    renderCEOPortal();
  } else { toast(res.error||'Approval failed','err'); }
}).catch(function(e){console.warn('ceoApprove:',e);toast('Approval failed — server error','err')});
}

function openSupportInbox(){
S.view='supportinbox';document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));$('v-supportinbox').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=()=>goView('dashboard');$('hdrTitle').textContent='My Inbox';$('hdrActions').innerHTML='';renderPersonalInbox()}

function renderPersonalInbox(){const me=getUserName();const qs=DB.quotes();
let myMentions=[];let myApprovals=[];let myDrafts=[];let myWon=[];
qs.forEach(q=>{if(q.status==='draft'&&q.createdBy===me)myDrafts.push(q);if(q.status==='approval'&&q.createdBy===me)myApprovals.push(q);if(q.status==='won'&&q.createdBy===me)myWon.push(q);
(q.internalNotes||[]).forEach(n=>{if(n.text&&n.text.includes('@'+me))myMentions.push({q,n});(n.replies||[]).forEach(r=>{if(r.text&&r.text.includes('@'+me))myMentions.push({q,n:r})})})});
let h='<div style="display:flex;gap:6px;margin-bottom:10px;font-size:11px">';
h+='<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--ac)">'+myMentions.length+'</div>@Mentions</div>';
h+='<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#c4b5fd">'+myApprovals.length+'</div>Pending</div>';
h+='<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--or)">'+myDrafts.length+'</div>Drafts</div>';
h+='<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:var(--gn)">'+myWon.length+'</div>Won</div></div>';
if(myMentions.length){h+='<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span><span class="ttl">@Mentions ('+myMentions.length+')</span><span class="arr">▾</span></div><div class="scard-b open">';
myMentions.forEach(m=>{h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;cursor:pointer" onclick="openEditor(\''+m.q.id+'\');setTimeout(()=>{S.etab=13;renderEditor()},100)"><strong style="color:var(--ac)">'+m.q.quoteNum+'</strong> — <span style="color:var(--tx2)">'+m.n.by+'</span>: '+m.n.text.substring(0,80)+(m.n.text.length>80?'...':'')+'</div>'});h+='</div></div>'}
if(myApprovals.length){h+='<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><span class="ttl">Submitted for Approval</span><span class="arr">▾</span></div><div class="scard-b open">';
myApprovals.forEach(q=>{h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;cursor:pointer" onclick="openEditor(\''+q.id+'\')"><strong>'+q.quoteNum+'</strong> — '+(q.fields.custCo||'—')+' <span class="pill pill-approval" style="font-size:8px;padding:0 4px">pending</span></div>'});h+='</div></div>'}
h+='<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span><span class="ttl">My Drafts ('+myDrafts.length+')</span><span class="arr">▾</span></div><div class="scard-b">';
myDrafts.slice(0,10).forEach(q=>{h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;cursor:pointer" onclick="openEditor(\''+q.id+'\')"><strong>'+q.quoteNum+'</strong> — '+(q.fields.custCo||'—')+'</div>'});
h+='</div></div>';
h+='<div class="scard"><div class="scard-h" onclick="togCard(this)"><span class="ico">🏆</span><span class="ttl">Won History ('+myWon.length+')</span><span class="arr">▾</span></div><div class="scard-b">';
myWon.forEach(q=>{h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px"><strong style="color:var(--gn)">'+q.quoteNum+'</strong> — '+(q.fields.custCo||'—')+(q.wonAmount?' · '+f$(q.wonAmount):'')+'</div>'});
h+='</div></div>';
h+='<div id="inboxReqList"></div>';
$('v-supportinbox').innerHTML=h;
loadInboxRequests(me)}

function renderSupportBoard(){
var qs=DB.quotes();var me=getUserName();
var h='<div style="margin-bottom:10px"><button class="btn" onclick="newSupportTicket()" style="width:100%;background:var(--ac);color:#fff;padding:12px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer">📡 Post to MicroFeed</button></div>';

h+='<div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto">';
['📡 Feed','🏆 Leaders','🎖 Badges','👤 My Activity'].forEach(function(cat,i){h+='<div style="padding:6px 12px;background:'+(i===0?'var(--ac)':'var(--bg3)')+';color:'+(i===0?'#fff':'var(--tx2)')+';border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap;cursor:pointer" onclick="switchFeedTab('+i+')">'+cat+'</div>'});
h+='</div><div id="feedContent"></div>';
$('v-supportboard').innerHTML=h;
switchFeedTab(0)}

function switchFeedTab(tab){var qs=DB.quotes();var me=getUserName();var el=$('feedContent');if(!el)return;var h='';
if(tab===0){
if(fbDb){fbDb.collection('support').orderBy('timestamp','desc').limit(30).get().then(function(snap){
var tickets=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var fh='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:6px">Latest Posts</div>';
tickets.forEach(function(t){
fh+='<div class="qcard" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="color:var(--ac)">'+esc(t.user||'Unknown')+'</strong><span style="font-size:9px;color:var(--tx3)">'+(t.timestamp?new Date(t.timestamp.seconds*1000).toLocaleDateString():'')+'</span></div>';
fh+='<div style="font-size:12px;color:var(--tx);margin:6px 0;line-height:1.5">'+esc(t.message)+'</div>';
if(t.reply)fh+='<div style="background:var(--bg3);border-left:3px solid var(--ac);padding:6px 8px;margin:4px 0;font-size:11px;border-radius:0 4px 4px 0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg> '+esc(t.reply)+'</div>';
if(t.comments&&t.comments.length){t.comments.forEach(function(c){fh+='<div style="background:var(--bg3);border-left:3px solid var(--gn);padding:6px 8px;margin:4px 0 4px 12px;font-size:11px;border-radius:0 4px 4px 0"><strong style="color:var(--ac)">'+esc(c.by)+'</strong>: '+esc(c.text)+'</div>'})}
fh+='<div style="display:flex;gap:8px;font-size:10px;margin-top:4px"><span style="cursor:pointer" onclick="voteSupport(\''+t.id+'\',1)">👍 '+(t.upvotes||0)+'</span><span style="cursor:pointer" onclick="voteSupport(\''+t.id+'\',-1)">👎 '+(t.downvotes||0)+'</span><button class="btn btn-ghost btn-xs" onclick="commentSupport(\''+t.id+'\')">💬 Reply</button><button class="btn btn-ghost btn-xs" onclick="adminReplySupport(\''+t.id+'\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg> Pin Reply</button></div></div>'});
if(!tickets.length)fh+='<div style="color:var(--tx3);padding:20px;text-align:center">No posts yet — be the first! 🚀</div>';
el.innerHTML=fh}).catch(function(e){el.innerHTML='<div style="color:var(--tx3);padding:20px">'+e.message+'</div>'})}
else{el.innerHTML='<div style="color:var(--tx3);padding:20px">Loading...</div>'}}
else if(tab===1){
var users={};qs.forEach(function(q){var u=q.createdBy||'Unknown';if(!users[u])users[u]={quotes:0,won:0,notes:0,pts:0};users[u].quotes++;if(q.status==='won')users[u].won++;(q.internalNotes||[]).forEach(function(n){if(n.by===u)users[u].notes++})});
Object.keys(users).forEach(function(u){users[u].pts=typeof calcPoints==='function'?calcPoints(u,qs):0});
var sorted=Object.entries(users).sort(function(a,b){return b[1].pts-a[1].pts});
h='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:6px">🏆 Leaderboard</div>';
sorted.forEach(function(entry,i){var name=entry[0],s=entry[1];h+='<div style="padding:8px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center"><div><span style="font-size:16px;margin-right:6px">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1))+'</span><strong>'+esc(name)+'</strong></div><div style="font-size:11px;color:var(--tx2)">'+s.pts.toFixed(2)+' pts · '+s.quotes+' quotes · '+s.won+' won</div></div>'});
el.innerHTML=h}
else if(tab===2){
h='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px">🎖 Badges</div>';
var myQ=qs.filter(function(q){return q.createdBy===me});var myWon=myQ.filter(function(q){return q.status==='won'}).length;var myNotes=0;qs.forEach(function(q){(q.internalNotes||[]).forEach(function(n){if(n.by===me)myNotes++})});
var badges=[
['🚀','First Quote',myQ.length>=1],['<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>','5 Quotes',myQ.length>=5],['💯','10 Quotes',myQ.length>=10],
['🏆','First Win',myWon>=1],['⭐','5 Wins',myWon>=5],['👑','10 Wins',myWon>=10],
['💬','First Note',myNotes>=1],['📢','10 Notes',myNotes>=10],['🔥','25 Notes',myNotes>=25]
];
h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
badges.forEach(function(b){h+='<div style="background:var(--bg3);border:1px solid '+(b[2]?'var(--ac)':'var(--bdr)')+';border-radius:8px;padding:10px;text-align:center;opacity:'+(b[2]?'1':'.3')+';box-shadow:'+(b[2]?'var(--glow)':'none')+'"><div style="font-size:24px">'+b[0]+'</div><div style="font-size:9px;font-weight:600;color:'+(b[2]?'var(--ac)':'var(--tx3)')+';margin-top:4px">'+b[1]+'</div></div>'});
h+='</div>';el.innerHTML=h}
else if(tab===3){
h='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:6px">👤 My Activity</div>';
var acts=[];qs.forEach(function(q){(q.activityLog||[]).forEach(function(a){if(a.by===me)acts.push(Object.assign({qn:q.quoteNum},a))})});
acts.sort(function(a,b){return new Date(b.at)-new Date(a.at)});
acts.slice(0,20).forEach(function(a){h+='<div style="padding:4px 0;border-bottom:1px solid var(--bdr);font-size:10px"><strong style="color:var(--ac)">'+esc(a.qn)+'</strong> — '+esc(a.detail)+'<span style="color:var(--tx3);font-size:8px;margin-left:4px">'+fD(a.at)+'</span></div>'});
if(!acts.length)h+='<div style="color:var(--tx3);padding:12px">No activity yet</div>';
el.innerHTML=h}}

function voteSupport(tid,dir){fbDb.collection('support').doc(tid).get().then(doc=>{const d=doc.data();const up={upvotes:(d.upvotes||0)+(dir>0?1:0),downvotes:(d.downvotes||0)+(dir<0?1:0)};fbDb.collection('support').doc(tid).update(up).then(()=>renderBoardTab(window._boardTab||0))}).catch(e => console.warn('MODULES get:', e.message))}
function voteComment(tid,ci,dir){fbDb.collection('support').doc(tid).get().then(doc=>{const d=doc.data();const comments=d.comments||[];if(comments[ci]){if(dir>0)comments[ci].up=(comments[ci].up||0)+1;else comments[ci].down=(comments[ci].down||0)+1;fbDb.collection('support').doc(tid).update({comments}).then(()=>renderBoardTab(window._boardTab||0))}}).catch(e => console.warn('MODULES get:', e.message))}
function commentSupport(tid){const text=prompt('Your reply:');if(!text)return;fbDb.collection('support').doc(tid).get().then(doc=>{const d=doc.data();const comments=d.comments||[];comments.push({text:text.trim(),by:getUserName(),at:new Date().toISOString(),up:0,down:0});fbDb.collection('support').doc(tid).update({comments}).then(()=>{toast('Posted','ok');renderBoardTab(window._boardTab||0)})}).catch(e=>toast('Error: '+e.message,'err'))}
function adminReplySupport(tid){const reply=prompt('Your reply:');if(!reply)return;fbDb.collection('support').doc(tid).update({reply:reply.trim(),status:'answered',repliedBy:getUserName(),repliedAt:firebase.firestore.FieldValue.serverTimestamp()}).then(()=>{toast('Replied','ok');renderBoardTab(window._boardTab||0)}).catch(e=>toast('Error: '+e.message,'err'))}
function closeTicket(tid){fbDb.collection('support').doc(tid).update({status:'closed'}).then(()=>{toast('Closed','ok');renderBoardTab(window._boardTab||0)})}



function openVendors(){S.view='vendors';document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));$('v-vendors').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=()=>goView('templates');$('hdrTitle').textContent='Vendors';$('hdrActions').innerHTML='<button class="btn btn-pr btn-sm" onclick="addVendor()">+ Add</button>';renderVendors()}

function renderVendors(){/* PERF-15 fix: ensure mats chunk loaded before rendering vendor catalog */ if((!MATS||!MATS.length)&&typeof loadChunk==='function'){loadChunk('mats').then(function(){renderVendors()}).catch(function(e){console.warn('mats chunk load:',e&&e.message)});return} const vendors=JSON.parse(localStorage.getItem('mfx_vendors')||'[]');
const mats=MATS||[];const vendorNames=[...new Set(mats.map(m=>m.v))];const qs=DB.quotes();
const vRatings=JSON.parse(localStorage.getItem('mfx_vendor_ratings')||'{}');
let h='<div style="display:flex;gap:6px;margin-bottom:10px;font-size:11px">';
h+='<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700;color:var(--ac)">'+(vendorNames.length+vendors.length)+'</div>Vendors</div>';
h+='<div style="flex:1;background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;text-align:center"><div style="font-size:20px;font-weight:700">'+mats.length+'</div>Materials</div></div>';
h+='<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg></span><span class="ttl">Material Vendors</span><span class="arr">▾</span></div><div class="scard-b open">';
vendorNames.forEach(v=>{const vm=mats.filter(m=>m.v===v);const vq=qs.filter(q=>vm.some(m=>q.fields.faceStock===m.s||q.fields.lamination===m.s));const r=vRatings[v]||{grade:'—',comments:[]};
h+='<div class="qcard" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><div class="qcard-co">'+v+'</div><div style="display:flex;gap:4px"><span style="font-size:10px;background:var(--ac);color:#fff;padding:2px 6px;border-radius:4px">Grade: '+r.grade+'</span><button class="btn btn-ghost btn-xs" onclick="rateVendor(\''+v+'\')">⭐ Rate</button></div></div>';
h+='<div class="qcard-desc">'+vm.length+' materials · '+vq.length+' quotes · MSI: $'+Math.min(...vm.map(m=>m.m)).toFixed(3)+' — $'+Math.max(...vm.map(m=>m.m)).toFixed(3)+'</div>';
h+='<div style="display:flex;gap:3px;margin-top:4px;flex-wrap:wrap">';vm.slice(0,10).forEach(m=>{h+='<span style="font-size:9px;background:var(--bg3);border:1px solid var(--bdr);border-radius:4px;padding:1px 5px;cursor:pointer" onclick="openMatProfile(\''+m.s+'\')">'+m.s+'</span>'});
if(vm.length>10)h+='<span style="font-size:9px;color:var(--tx3)">+'+(vm.length-10)+' more</span>';h+='</div>';
if(r.comments.length){h+='<div style="margin-top:6px;border-top:1px solid var(--bdr);padding-top:4px">';r.comments.slice(-3).forEach(c=>{h+='<div style="font-size:10px;color:var(--tx2);padding:2px 0"><strong style="color:var(--ac)">'+esc(c.by)+'</strong>: '+esc(c.text)+' <span style="color:var(--tx3);font-size:8px">'+new Date(c.at).toLocaleDateString()+'</span></div>'});h+='</div>'}
h+='</div>'});
vendors.forEach(v=>{h+='<div class="qcard" style="margin-bottom:6px"><div style="display:flex;justify-content:space-between"><div class="qcard-co">'+esc(v.name)+'</div><div><button class="btn btn-ghost btn-xs" onclick="editVendor(\''+v.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-xs" onclick="delVendor(\''+v.id+'\')">🗑</button></div></div><div class="qcard-desc">'+esc(v.contact||'')+' '+(v.phone?'· '+esc(v.phone):'')+'</div>'+(v.notes?'<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+esc(v.notes)+'</div>':'')+'</div>'});
h+='</div></div>';$('v-vendors').innerHTML=h}

function rateVendor(vname){const vRatings=JSON.parse(localStorage.getItem('mfx_vendor_ratings')||'{}');if(!vRatings[vname])vRatings[vname]={grade:'—',comments:[]};
const grade=prompt('Grade (A/B/C/D/F):',vRatings[vname].grade);if(grade)vRatings[vname].grade=grade.toUpperCase().charAt(0);
const comment=prompt('Comment (optional):');if(comment)vRatings[vname].comments.push({text:comment,by:getUserName(),at:new Date().toISOString()});
localStorage.setItem('mfx_vendor_ratings',JSON.stringify(vRatings));renderVendors();toast('Rated','ok')}

function delVendor(vid){if(!confirm('Delete vendor?'))return;const vendors=JSON.parse(localStorage.getItem('mfx_vendors')||'[]');localStorage.setItem('mfx_vendors',JSON.stringify(vendors.filter(v=>v.id!==vid)));renderVendors();toast('Deleted','ok')}

function addVendor(){const name=prompt('Vendor name:');if(!name)return;const vendors=JSON.parse(localStorage.getItem('mfx_vendors')||'[]');vendors.push({id:'vn'+Date.now(),name:name.trim(),contact:'',phone:'',notes:''});localStorage.setItem('mfx_vendors',JSON.stringify(vendors));renderVendors();toast('Added','ok')}
function editVendor(vid){const vendors=JSON.parse(localStorage.getItem('mfx_vendors')||'[]');const v=vendors.find(x=>x.id===vid);if(!v)return;const name=prompt('Name:',v.name);if(name)v.name=name;v.contact=prompt('Contact:',v.contact)||'';v.phone=prompt('Phone:',v.phone)||'';v.notes=prompt('Notes:',v.notes)||'';localStorage.setItem('mfx_vendors',JSON.stringify(vendors));renderVendors();toast('Updated','ok')}

function openMatProfile(specId){/* PERF-15 fix: ensure mats chunk loaded before profile lookup */ if((!MATS||!MATS.length)&&typeof loadChunk==='function'){loadChunk('mats').then(function(){openMatProfile(specId)}).catch(function(e){console.warn('mats chunk load:',e&&e.message)});return} const mat=MATS.find(m=>m.s===specId);
if(!mat)return toast('Material not found','err');
const qs=DB.quotes();const used=qs.filter(q=>q.fields.faceStock===specId||q.fields.lamination===specId);
const wonUsed=used.filter(q=>q.status==='won');const totalFt=used.reduce((a,q)=>{const f=q.fields;const rp=(parseFloat(f.sar)||0)+(parseFloat(f.gar)||0);return a+q.qtys.reduce((s,qty)=>s+(qty*rp/12),0)},0);
const matNotes=JSON.parse(localStorage.getItem('mfx_mat_notes')||'{}');const notes=matNotes[specId]||[];
let h='<div class="modal-title">'+mat.s+' — '+mat.d+'</div>';
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:11px">';
h+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--ac)">'+f$(mat.m)+'/MSI</div>Cost</div>';
h+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700">'+used.length+'</div>Quotes</div>';
h+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700;color:var(--gn)">'+wonUsed.length+'</div>Won</div>';
h+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:700">'+Math.round(totalFt).toLocaleString()+' ft</div>Est. Footage</div></div>';
h+='<div style="font-size:11px;margin-bottom:8px"><b>Vendor:</b> '+mat.v+'<br><b>Markup MSI:</b> '+(mat.mk?'$'+mat.mk:'—')+'</div>';
h+='<div style="font-size:10px;color:var(--tx2);margin-bottom:4px"><b>Recent quotes:</b></div>';
h+='<div style="max-height:120px;overflow-y:auto;margin-bottom:8px">';used.slice(0,8).forEach(q=>{h+='<div style="padding:3px 0;border-bottom:1px solid var(--bdr);font-size:10px"><strong>'+esc(q.quoteNum)+'</strong> — '+esc(q.fields.custCo||'—')+' <span class="pill pill-'+q.status+'" style="font-size:8px;padding:0 4px">'+esc(q.status)+'</span></div>'});
if(!used.length)h+='<div style="color:var(--tx3)">Not used yet</div>';h+='</div>';
if(notes.length){h+='<div style="font-size:10px;color:var(--tx2);margin-bottom:4px"><b>Notes:</b></div>';notes.forEach(n=>{h+='<div style="font-size:10px;padding:2px 0;border-bottom:1px solid var(--bdr)"><strong style="color:var(--ac)">'+esc(n.by)+'</strong>: '+esc(n.text)+'</div>'});}
h+='<div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="addMatNote(\''+specId+'\')">+ Note</button><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div>';
openModal(h)}

function addMatNote(specId){const text=prompt('Note for '+specId+':');if(!text)return;const matNotes=JSON.parse(localStorage.getItem('mfx_mat_notes')||'{}');if(!matNotes[specId])matNotes[specId]=[];matNotes[specId].push({text:text.trim(),by:getUserName(),at:new Date().toISOString()});localStorage.setItem('mfx_mat_notes',JSON.stringify(matNotes));closeModal();openMatProfile(specId);toast('Note added','ok')}

function openSpecProfile(type,specId){
const list=getSpecList(type);const item=list.find(x=>x.id===specId||(typeof x==='string'&&x===specId));
if(!item)return;
const qs=DB.quotes();let used=[];
if(type==='dies')used=qs.filter(q=>q.fields&&q.fields.dieId===specId);
const isObj=typeof item==='object';
const title=isObj?(item.id+(item.desc?' — '+item.desc:item.shape?' — '+item.shape:'')):item;

openModal(`<div class="modal-title">${title}</div>
<div style="font-size:11px;margin-bottom:10px">
${isObj&&item.shape?'<div><b>Shape:</b> '+item.shape+'</div>':''}
${isObj&&item.sA?'<div><b>Size:</b> '+item.sA+' × '+(item.sAr||'—')+'</div>':''}
${isObj&&item.repeat?'<div><b>Repeat:</b> '+item.repeat+'</div>':''}
${isObj&&item.nA?'<div><b># Across:</b> '+item.nA+' · <b># Around:</b> '+(item.nAr||'—')+'</div>':''}
${isObj&&item.notes?'<div style="color:var(--tx3);font-style:italic;margin-top:4px">'+esc(item.notes)+'</div>':''}
${isObj&&item.desc?'<div><b>Description:</b> '+item.desc+'</div>':''}
</div>
<div style="font-size:10px;color:var(--tx2);margin-bottom:4px"><b>Type:</b> ${type}</div>
<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%;margin-top:8px">Close</button>`)}

// INTERNAL NOTES
function addInternalNote(){const txt=$('noteInput');if(!txt||!txt.value.trim())return;const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;if(!q.internalNotes)q.internalNotes=[];const text=txt.value.trim();const mentions=text.match(/@(\w+)/g)||[];q.internalNotes.push({id:'n'+Date.now(),text,by:getUserName(),at:new Date().toISOString(),mentions,replies:[]});DB.saveQ(all);txt.value='';$('mentionDropdown').style.display='none';renderInternalNotes();DB.logActivity('note.add',q.quoteNum+' note added'+(mentions.length?' @'+mentions.join(' @'):''))}

function getTeamUsers(){const users=new Set();
// Pull from cached Firestore users collection
if(window._allTeamUsers&&window._allTeamUsers.length){window._allTeamUsers.forEach(u=>users.add(u))}
// Also pull from quotes (covers historical users)
const qs=DB.quotes();qs.forEach(q=>{if(q.createdBy)users.add(q.createdBy);(q.internalNotes||[]).forEach(n=>{if(n.by)users.add(n.by);(n.replies||[]).forEach(r=>{if(r.by)users.add(r.by)})})});return[...users].sort()}
// Listen for all authenticated users in Firestore
if(fbDb){/* PERF-04 fix (2026-05-24): bound to 200 users — team cache doesn't need all-of-time */ fbDb.collection('users').limit(200).onSnapshot(function(snap){window._allTeamUsers=snap.docs.map(function(d){var data=d.data();return data.displayName||data.email||''}).filter(Boolean)}, function(err){ console.warn('modules users listener:', err.message); })}

function checkAtMention(el){const dd=$('mentionDropdown');if(!dd)return;const val=el.value;const cursor=el.selectionStart;const before=val.substring(0,cursor);const atMatch=before.match(/@(\w*)$/);if(atMatch){const partial=atMatch[1].toLowerCase();const users=getTeamUsers().filter(u=>u.toLowerCase().includes(partial));if(users.length){dd.style.display='block';dd.innerHTML=users.map(u=>'<div style="padding:8px 12px;cursor:pointer;font-size:12px;color:var(--tx);border-bottom:1px solid var(--bdr)" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'none\'" onclick="insertNoteMention(\''+u+'\')"><span style="color:var(--ac);font-weight:600">@'+u+'</span></div>').join('')}else{dd.style.display='none'}}else{dd.style.display='none'}}

function insertNoteMention(user){const el=$('noteInput');if(!el)return;const val=el.value;const cursor=el.selectionStart;const before=val.substring(0,cursor);const after=val.substring(cursor);const newBefore=before.replace(/@(\w*)$/,'@'+user+' ');el.value=newBefore+after;el.focus();el.selectionStart=el.selectionEnd=newBefore.length;$('mentionDropdown').style.display='none'}
function replyToNote(noteId){const reply=prompt('Reply:');if(!reply)return;const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;const note=q.internalNotes.find(n=>n.id===noteId);if(!note)return;if(!note.replies)note.replies=[];note.replies.push({text:reply.trim(),by:getUserName(),at:new Date().toISOString()});logQuoteEvent(q,'reply','Replied to note by '+note.by);DB.saveQ(all);renderInternalNotes()}

function logQuoteEvent(q,action,detail){if(!q)return;if(!q.activityLog)q.activityLog=[];q.activityLog.push({action,by:getUserName(),at:new Date().toISOString(),detail})}

function renderActivityLog(){const q=getQ(S.editId);const el=$('activityLog');if(!el||!q)return;
const log=q.activityLog||[];const notes=(q.internalNotes||[]).map(n=>({action:'note',by:n.by,at:n.at,detail:n.text.substring(0,60)+(n.text.length>60?'...':'')}));
const statusEvents=[];if(q.approvedAt)statusEvents.push({action:'approved',by:q.approvedBy||'CEO',at:q.approvedAt,detail:'Quote approved'});if(q.rejectedAt)statusEvents.push({action:'rejected',by:q.rejectedBy||'CEO',at:q.rejectedAt,detail:'Quote rejected'+(q.rejectionReason?' — '+q.rejectionReason:'')});if(q.sentAt)statusEvents.push({action:'sent',by:'System',at:q.sentAt,detail:'Quote sent'});if(q.closedAt)statusEvents.push({action:'closed',by:'System',at:q.closedAt,detail:'Quote closed'+(q.wonAmount?' — Won '+f$(q.wonAmount):'')});
const all=[...log,...notes,...statusEvents,{action:'created',by:q.createdBy||'Unknown',at:q.createdAt,detail:'Quote created '+q.quoteNum}];
all.sort((a,b)=>new Date(b.at)-new Date(a.at));
const icons={edit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',note:'💬',reply:'↩️',approved:'✅',rejected:'❌',sent:'📤',closed:'🏁',created:'🆕',status:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',invite:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',lock:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'};
el.innerHTML=all.length?all.map(e=>'<div style="padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px;display:flex;gap:8px"><span style="font-size:14px">'+(icons[e.action]||'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>')+'</span><div style="flex:1"><div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(e.by||'System')+'</strong><span style="color:var(--tx3);font-size:9px">'+fD(e.at)+'</span></div><div style="color:var(--tx2)">'+esc(e.detail)+'</div></div></div>').join(''):'<div style="color:var(--tx3);padding:12px">No activity yet</div>'}

function renderInternalNotes(){const q=getQ(S.editId);const el=$('internalNotes');if(!el||!q)return;const notes=q.internalNotes||[];el.innerHTML=notes.length?notes.slice().reverse().map(n=>{let h='<div style="padding:8px;border-bottom:1px solid var(--bdr);font-size:11px">';
h+='<div style="display:flex;justify-content:space-between"><strong style="color:var(--ac)">'+esc(n.by)+'</strong><span style="color:var(--tx3);font-size:9px">'+fD(n.at)+'</span></div>';
h+='<div style="margin-top:4px;color:var(--tx)">'+esc(n.text).replace(/@(\w+)/g,'<span style="color:var(--ac);font-weight:600">@$1</span>')+'</div>';
if(n.replies&&n.replies.length){h+='<div style="margin-left:12px;border-left:2px solid var(--ac3);padding-left:8px;margin-top:6px">';
n.replies.forEach(r=>{h+='<div style="padding:3px 0;font-size:10px"><strong style="color:var(--ac)">'+esc(r.by)+'</strong> <span style="color:var(--tx3)">'+fD(r.at)+'</span><div style="color:var(--tx)">'+esc(r.text).replace(/@(\w+)/g,'<span style="color:var(--ac);font-weight:600">@$1</span>')+'</div></div>'});h+='</div>'}
h+='<button class="btn btn-ghost btn-xs" onclick="replyToNote(\''+n.id+'\')" style="margin-top:4px;font-size:9px">↩ Reply</button></div>';return h}).join(''):'<div style="color:var(--tx3);font-size:11px;padding:12px">No notes yet. Use @name to mention team members.</div>'}

function renderWorkflow(){
var el=$('workflowContent');if(!el)return;
var q=getQ(S.editId);if(!q)return;
var f=q.fields||{};
var portalLink='https://os.microflexfilm.com/portal?id='+q.id+'&q='+(q.quoteNum||'');
var steps=[
  {label:'Quote Created',done:!!q.createdAt,det:q.createdAt?fD(q.createdAt)+' by '+(q.createdBy||'—'):''},
  {label:'Specs Complete',done:!!(f.sA&&f.sar&&f.shapeType&&f.colors),det:f.sA?f.sA+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' '+(f.colors||'?')+'C':'Missing specs'},
  {label:'Pricing Complete',done:q.qtys&&q.qtys.length>0,det:q.qtys&&q.qtys.length?q.qtys.length+' quantities':'No quantities entered'},
  {label:'CEO Approved',done:q.status==='ready'||q.status==='sent'||q.status==='won',det:q.approvedAt?fD(q.approvedAt)+' by '+(q.approvedBy||'CEO'):(q.status==='approval'?'Pending approval':'Not submitted')},
  {label:'Email Sent',done:!!q.sentAt,det:q.sentAt?fD(q.sentAt):'Not sent'},
  {label:'PDF on Drive',done:!!(q.driveLink||q.workflow&&q.workflow.driveSaved),det:q.driveLink?'<a href="'+q.driveLink+'" target="_blank" style="color:var(--ac)">Open PDF ↗</a>':'Saves automatically on send'},
  {label:'Registry Updated',done:!!(q.workflow&&q.workflow.registryUpdated),det:'Auto-updates on send and status change',link:'registry'},
  {label:'Client Portal',done:!!q.poSignature||q.status==='won',det:q.poSignature?'Signed by '+q.poSignature+' · '+fD(q.poSignedAt):'Waiting for client',link:'portal'},
  {label:'PO Received',done:!!q.poNumber,det:q.poNumber?'PO# '+q.poNumber:'—',link:'po'},
  {label:'Art Files Received',done:q.artFiles&&q.artFiles.length>0,det:q.artFiles&&q.artFiles.length?q.artFiles.length+' file(s)':'—',link:'art'},
  {label:'Sales Order',done:typeof getSalesOrders==='function'&&getSalesOrders().some(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum}),det:(function(){var _so=typeof getSalesOrders==='function'&&getSalesOrders().find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});return _so?_so.soNum+' ('+_so.status+')':'Created from approved PO'})(),link:'so',soId:(function(){var _so2=typeof getSalesOrders==='function'&&getSalesOrders().find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});return _so2?_so2.id:null})()},
  {label:'Job Passport',done:typeof getPassports==='function'&&getPassports().some(function(p){return p.quoteId===q.id||p.quoteNum===q.quoteNum}),det:'Created from approved SO'},
  {label:'Job Tickets',done:typeof getJobTickets==='function'&&getJobTickets().some(function(t2){return t2.quoteNum===q.quoteNum}),det:'Generated from confirmed blueprints'}
];
var completed=steps.filter(function(s){return s.done}).length;
var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;color:var(--ac)">Workflow — '+q.quoteNum+' Rev '+q.rev+'</span><span style="font-size:10px;color:var(--tx3)">'+completed+'/'+steps.length+'</span></div>';
h+='<div style="height:4px;background:var(--bdr);border-radius:2px;margin-bottom:10px;overflow:hidden"><div style="height:100%;width:'+Math.round(completed/steps.length*100)+'%;background:var(--gn);border-radius:2px;transition:width .3s"></div></div>';
steps.forEach(function(step){
  var icon=step.done?'🟢':'⚪';
  var color=step.done?'var(--gn)':'var(--tx3)';
  h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">';
  h+='<span style="font-size:13px">'+icon+'</span>';
  h+='<div style="flex:1"><div style="font-size:11px;font-weight:600;color:'+color+'">'+step.label+'</div>';
  h+='<div style="font-size:9px;color:var(--tx3)">'+step.det+'</div></div>';
  // Action link buttons
  if(step.link){
    if(step.link==='registry')h+='<a href="#" onclick="openRegistrySheet();return false" style="font-size:9px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--ac);border-radius:4px;white-space:nowrap">Open ↗</a>';
    if(step.link==='portal')h+='<a href="'+portalLink+'" target="_blank" style="font-size:9px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--ac);border-radius:4px;white-space:nowrap">Portal ↗</a>';
    if(step.link==='po')h+='<a href="#" onclick="scrollToFiles(\'po\');return false" style="font-size:9px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--ac);border-radius:4px;white-space:nowrap">View ↗</a>';
    if(step.link==='art')h+='<a href="#" onclick="scrollToFiles(\'art\');return false" style="font-size:9px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--ac);border-radius:4px;white-space:nowrap">View ↗</a>';
    if(step.link==='so'){
      if(step.soId){h+='<a href="#" onclick="if(typeof openSODetail===\'function\')openSODetail(\''+step.soId+'\');return false" style="font-size:9px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--ac);border-radius:4px;white-space:nowrap">View SO ↗</a>';}
      else if(q.poNumber){h+='<a href="#" onclick="if(typeof createSOFromPO===\'function\')createSOFromPO(\''+q.id+'\');return false" style="font-size:9px;color:#22c55e;text-decoration:none;padding:3px 8px;border:1px solid #22c55e;border-radius:4px;white-space:nowrap;font-weight:700">+ Generate SO</a>';}
    }
  }
  h+='</div>';
});

// ═══ QUICK LINKS BAR ═══
h+='<div style="margin-top:12px;padding:10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px">';
h+='<div style="font-size:9px;font-weight:700;color:var(--ac);letter-spacing:1.5px;margin-bottom:8px">QUICK LINKS</div>';
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
// Registry
h+='<a href="#" onclick="openRegistrySheet();return false" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;text-decoration:none;color:var(--tx);font-size:10px;font-weight:600"><span style="font-size:14px">📊</span><span>Quote Registry</span></a>';
// Portal
h+='<a href="'+portalLink+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;text-decoration:none;color:var(--tx);font-size:10px;font-weight:600"><span style="font-size:14px">🌐</span><span>Client Portal</span></a>';
// Drive PDF
h+='<a href="'+(q.driveLink||'#')+'" '+(q.driveLink?'target="_blank"':'onclick="saveQuoteToDrive();return false"')+' style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;text-decoration:none;color:var(--tx);font-size:10px;font-weight:600"><span style="font-size:14px">📄</span><span>'+(q.driveLink?'PDF on Drive':'Save PDF to Drive')+'</span></a>';
// Copy portal link
h+='<a href="#" onclick="navigator.clipboard.writeText(\''+portalLink+'\');toast(\'Portal link copied\',\'ok\');return false" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;text-decoration:none;color:var(--tx);font-size:10px;font-weight:600"><span style="font-size:14px">📋</span><span>Copy Portal Link</span></a>';
// Sales Order link or generate button
var _linkedSO=typeof getSalesOrders==='function'&&getSalesOrders().find(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum});
if(_linkedSO){
h+='<a href="#" onclick="if(typeof openSODetail===\'function\')openSODetail(\''+_linkedSO.id+'\');return false" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;text-decoration:none;color:var(--tx);font-size:10px;font-weight:600"><span style="font-size:14px">📋</span><span>'+_linkedSO.soNum+' ('+_linkedSO.status+')</span></a>';
}else if(q.poNumber){
h+='<a href="#" onclick="if(typeof createSOFromPO===\'function\')createSOFromPO(\''+q.id+'\');return false" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#0a2e3e;border:1px solid #22c55e;border-radius:6px;text-decoration:none;color:#22c55e;font-size:10px;font-weight:700"><span style="font-size:14px">📝</span><span>Generate Sales Order</span></a>';
}
h+='</div></div>';

// ═══ CLIENT FILES ═══
h+='<div id="wfClientFiles" style="margin-top:10px">';
var poFiles=q.poDriveFiles&&q.poDriveFiles.length?q.poDriveFiles:q.poFiles;
var artFiles=q.artDriveFiles&&q.artDriveFiles.length?q.artDriveFiles:q.artFiles;
if((poFiles&&poFiles.length)||(artFiles&&artFiles.length)){
  h+='<div style="padding:10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px">';
  h+='<div style="font-size:9px;font-weight:700;color:#DAA520;letter-spacing:1.5px;margin-bottom:8px">CLIENT FILES</div>';
  // PO files
  if(poFiles&&poFiles.length){
    h+='<div id="wfPoFiles" style="margin-bottom:8px"><div style="font-size:10px;color:var(--tx);font-weight:700;margin-bottom:4px">📎 PO Documents ('+poFiles.length+')</div>';
    poFiles.forEach(function(pf){var url=pf.driveLink||pf.url||'';var name=pf.name||'file';
      h+='<a href="'+url+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:3px;background:var(--bg2);border:1px solid var(--bdr);border-radius:5px;text-decoration:none">';
      h+='<span style="font-size:11px">📄</span><span style="flex:1;font-size:10px;color:var(--ac);font-weight:600">'+name+'</span>';
      if(pf.uploadedAt)h+='<span style="font-size:8px;color:var(--tx3)">'+fD(pf.uploadedAt)+'</span>';
      h+='</a>';
    });
    h+='</div>';
  }
  // Art files
  if(artFiles&&artFiles.length){
    h+='<div id="wfArtFiles"><div style="font-size:10px;color:var(--tx);font-weight:700;margin-bottom:4px">🎨 Art Files ('+artFiles.length+')</div>';
    artFiles.forEach(function(af){var url=af.driveLink||af.url||'';var name=af.name||'file';
      h+='<a href="'+url+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:3px;background:var(--bg2);border:1px solid var(--bdr);border-radius:5px;text-decoration:none">';
      h+='<span style="font-size:11px">🎨</span><span style="flex:1;font-size:10px;color:var(--ac);font-weight:600">'+name+'</span>';
      if(af.uploadedAt)h+='<span style="font-size:8px;color:var(--tx3)">'+fD(af.uploadedAt)+'</span>';
      h+='</a>';
    });
    h+='</div>';
  }
  h+='</div>';
}else{
  h+='<div style="padding:10px;background:var(--bg3);border:1px dashed var(--bdr);border-radius:8px;text-align:center">';
  h+='<div style="font-size:10px;color:var(--tx3)">No client files received yet</div>';
  h+='<div style="font-size:9px;color:var(--tx3);margin-top:2px">PO documents and art files will appear here when the client uploads them via the portal</div>';
  h+='</div>';
}
h+='</div>';

// ═══ PORTAL MESSAGES ═══
h+='<div id="wfPortalMessages" style="margin-top:10px">';
h+='<div style="padding:10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px">';
h+='<div style="font-size:9px;font-weight:700;color:var(--ac);letter-spacing:1.5px;margin-bottom:8px">💬 PORTAL MESSAGES</div>';
h+='<div id="wfMsgThread" style="max-height:200px;overflow-y:auto;margin-bottom:8px"><div style="font-size:10px;color:var(--tx3);text-align:center;padding:6px">Loading messages...</div></div>';
h+='<div style="display:flex;gap:6px"><input id="wfMsgInput" placeholder="Reply to client..." style="flex:1;padding:6px 8px;background:var(--inp);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);font-size:10px">';
h+='<button class="btn btn-pr btn-sm" onclick="sendWorkflowReply()" style="padding:6px 12px;font-size:10px">Send</button></div>';
h+='</div></div>';

el.innerHTML=h;

// Load portal messages in real-time
_loadWorkflowMessages(q.id);
}

function _loadWorkflowMessages(quoteId){
  if(!window.fbDb||!quoteId)return;
  if(window._wfMsgUnsub)window._wfMsgUnsub();
  window._wfMsgUnsub=window.fbDb.collection('quotes').doc(quoteId).collection('portalMessages')
    .orderBy('timestamp','asc').limit(50)
    .onSnapshot(function(snap){
      var el=document.getElementById('wfMsgThread');if(!el)return;
      if(!snap.docs.length){el.innerHTML='<div style="font-size:10px;color:var(--tx3);text-align:center;padding:6px">No messages yet. The client can send messages through the portal.</div>';return}
      var h='';
      snap.docs.forEach(function(doc){
        var m=doc.data();
        var isClient=m.from==='client';
        var ts=m.timestamp?new Date(m.timestamp.toDate?m.timestamp.toDate():m.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
        h+='<div style="display:flex;flex-direction:column;align-items:'+(isClient?'flex-start':'flex-end')+';margin-bottom:6px">';
        h+='<div style="max-width:85%;padding:6px 10px;border-radius:'+(isClient?'2px 8px 8px 8px':'8px 2px 8px 8px')+';background:'+(isClient?'var(--bg2)':'var(--ac)')+';color:'+(isClient?'var(--tx)':'#fff')+';font-size:11px">'+esc(m.text)+'</div>';
        h+='<div style="font-size:8px;color:var(--tx3);margin-top:1px">'+(isClient?'🔵 ':'🟢 ')+esc(m.name||'Unknown')+' · '+ts+'</div>';
        h+='</div>';
      });
      el.innerHTML=h;
      el.scrollTop=el.scrollHeight;
    }, function(err){
      var el=document.getElementById('wfMsgThread');
      if(el)el.innerHTML='<div style="font-size:10px;color:var(--tx3);text-align:center">Could not load messages</div>';
    });
}

function sendWorkflowReply(){
  var input=document.getElementById('wfMsgInput');
  if(!input||!input.value.trim())return;
  var q=getQ(S.editId);if(!q)return;
  window.fbDb.collection('quotes').doc(q.id).collection('portalMessages').add({
    text:input.value.trim(),
    name:getUserName()||'Microflex',
    from:'mfx',
    timestamp:firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){input.value='';toast('Message sent','ok')}).catch(function(e){toast('Failed: '+e.message,'err')});
}

// Open the Google Sheets registry
function openRegistrySheet(){
  getGoogleToken().then(function(token){
    if(!token)return toast('Sign out and back in','err');
    findOrCreateRegistry(token).then(function(sheetId){
      if(sheetId)window.open('https://docs.google.com/spreadsheets/d/'+sheetId,'_blank');
      else toast('Registry not found','err');
    });
  });
}
// Scroll to files section
function scrollToFiles(type){
  var id=type==='po'?'wfPoFiles':'wfArtFiles';
  var el=document.getElementById(id);
  if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
  else toast('No '+type.toUpperCase()+' files yet','err');
}


function renderConnections(){
var el=$('connectionsContent');if(!el)return;
var q=getQ(S.editId);if(!q)return;
var co=(q.fields.custCo||'').toLowerCase();
var h='<div style="font-size:11px;font-weight:700;color:var(--ac);margin-bottom:8px">Connected Records</div>';
var conn=[];
// Revisions
DB.quotes().filter(function(qq){return qq.quoteNum===q.quoteNum&&qq.id!==q.id}).forEach(function(qq){conn.push({t:'Revision',l:qq.quoteNum+' Rev '+qq.rev+' ('+qq.status+')',a:'openEditor(\''+qq.id+'\')',c:qq.status==='won'?'var(--gn)':qq.status==='sent'?'var(--ac)':'var(--tx3)'})});
if(q.parentQuoteId){var pq=getQ(q.parentQuoteId);if(pq)conn.push({t:'Parent Quote',l:pq.quoteNum+' Rev '+pq.rev,a:'openEditor(\''+q.parentQuoteId+'\')',c:'var(--or)'})}
if(typeof getSalesOrders==='function'){getSalesOrders().filter(function(s){return s.quoteId===q.id||s.quoteNum===q.quoteNum}).forEach(function(s){conn.push({t:'Sales Order',l:s.soNum+' ('+s.status+')',a:'typeof openSODetail===\'function\'&&openSODetail(\''+s.id+'\')',c:'var(--ac)'})})}
if(typeof getPassports==='function'){getPassports().filter(function(p){return p.quoteId===q.id||p.quoteNum===q.quoteNum}).forEach(function(p){conn.push({t:'Job Passport',l:p.jpNum+' ('+p.status+')',a:'typeof openPassportDetail===\'function\'&&openPassportDetail(\''+p.id+'\')',c:'#a78bfa'})})}
if(typeof getJobTickets==='function'){getJobTickets().filter(function(t2){return t2.quoteNum===q.quoteNum}).forEach(function(t2){conn.push({t:'Job Ticket',l:t2.jtNum+' ('+t2.status+')',a:'goView(\'production\')',c:'var(--gn)'})})}
if(co){var cl=DB.customers().find(function(c){return c.company&&c.company.toLowerCase()===co});if(cl)conn.push({t:'Client',l:cl.company,a:'openProfile(\''+cl.id+'\')',c:'var(--ac)'})}
if(conn.length){conn.forEach(function(c){
  h+='<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;background:var(--bg2);border-radius:6px;border-left:3px solid '+c.c+';cursor:pointer" onclick="'+c.a+'">';
  h+='<div style="flex:1"><div style="font-size:9px;color:var(--tx3);font-weight:600;letter-spacing:.5px">'+esc(c.t).toUpperCase()+'</div><div style="font-size:11px;color:var(--tx);font-weight:600">'+esc(c.l)+'</div></div>';
  h+='<span style="font-size:10px;color:var(--ac)">→</span></div>';
})}else{h+='<div style="color:var(--tx3);font-size:11px;padding:8px">No connected records yet. Records are linked as the quote progresses through the workflow.</div>'}
el.innerHTML=h;
}

// GLOBAL SEARCH
function globalSearchFn(v){if(S.view==='quotes'){S.qSearch=v;renderQuotes()}else if(S.view==='customers'){S.cSearch=v;renderCust()}}

// PAYMENT TERMS MANAGEMENT
function getPayTerms(){const base=['Net 30','Net 45','Net 60','COD','Credit Card','Prepaid','Due on Receipt'];const custom=JSON.parse(localStorage.getItem('mfx_payterms')||'[]');return[...base,...custom]}
function addPaymentTerm(){const t=prompt('New payment term:');if(!t||!t.trim())return;const custom=JSON.parse(localStorage.getItem('mfx_payterms')||'[]');if(!custom.includes(t.trim())){custom.push(t.trim());localStorage.setItem('mfx_payterms',JSON.stringify(custom));toast('Added: '+t.trim(),'ok');renderEditor()}}

// INVITE COLLABORATOR
function inviteCollaborator(){const users=getTeamUsers();if(!users.length)return toast('No team members found','err');const pick=prompt('Invite collaborator (enter name):\n'+users.join(', '));if(!pick)return;const all=DB.quotes();const q=all.find(x=>x.id===S.editId);if(!q)return;if(!q.collaborators)q.collaborators=[];if(!q.collaborators.includes(pick.trim())){q.collaborators.push(pick.trim());if(!q.internalNotes)q.internalNotes=[];q.internalNotes.push({id:'n'+Date.now(),text:'👥 Invited @'+pick.trim()+' as collaborator',by:getUserName(),at:new Date().toISOString(),mentions:['@'+pick.trim()],replies:[]});logQuoteEvent(q,'invite','Invited '+pick.trim()+' as collaborator');DB.saveQ(all);toast(pick.trim()+' invited','ok');renderEditor()}else{toast('Already a collaborator','err')}}

// HAMBURGER MENU

function getMFXProfile(){var profileKey='mfx_profile_'+(CURRENT_USER?CURRENT_USER.uid:'default');const stored=JSON.parse(localStorage.getItem(profileKey)||'{}');const me=getUserName();const qs=DB.quotes();const pts=typeof calcPoints==='function'?calcPoints(me,qs):0;return{name:me,flexId:stored.flexId||'—',role:stored.role||'—',dept:stored.dept||'—',position:stored.position||'',pods:stored.pods||'—',mood:stored.mood||'😊',yearJoined:stored.yearJoined||'—',lastUpdated:stored.lastUpdated||'—',score:typeof pts==='object'?(pts.pts||0):(pts||0)}}

function saveMFXProfile(field,val){var profileKey='mfx_profile_'+(CURRENT_USER?CURRENT_USER.uid:'default');const stored=JSON.parse(localStorage.getItem(profileKey)||'{}');stored[field]=val;stored.lastUpdated=new Date().toISOString();localStorage.setItem(profileKey,JSON.stringify(stored));if(typeof syncUserAccessProfile==='function')syncUserAccessProfile()}

function openHomeBase(){var p=getMFXProfile();var qs=DB.quotes();var todayQ=qs.filter(function(q){return q.createdAt&&q.createdAt.startsWith(new Date().toISOString().split('T')[0])}).length;var totalWon=qs.filter(function(q){return q.status==='won'}).length;var totalLost=qs.filter(function(q){return q.status==='lost'}).length;var avgScore=totalWon+totalLost>0?Math.round(totalWon/(totalWon+totalLost)*100):0;
var h='<div style="text-align:center;padding:10px 0">';
h+='<img src="'+QUOTE_LOGO+'" alt="MFX" style="height:50px;margin-bottom:6px">';
h+='<div style="font-size:16px;font-weight:700;color:var(--ac)">MFX HomeBase</div>';
h+='<span class="dept-badge">Client Services</span></div>';
h+='<div style="background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:10px;box-shadow:var(--glow)">';
h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
h+='<div style="font-size:15px;font-weight:700;color:var(--tx)">'+esc(p.name)+'</div>';
h+='<span style="font-size:20px;cursor:pointer" onclick="changeMood()">'+p.mood+'</span></div>';
h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;color:var(--tx2);line-height:1.8">';
h+='<div><b style="color:var(--ac)">Flex ID:</b> <span onclick="editProfile(\'flexId\')" style="cursor:pointer;text-decoration:underline dotted">'+esc(p.flexId)+'</span></div>';
h+='<div><b style="color:var(--ac)">Role:</b> <span onclick="editProfile(\'role\')" style="cursor:pointer;text-decoration:underline dotted">'+esc(p.role)+'</span></div>';
h+='<div><b style="color:var(--ac)">Dept:</b> <span onclick="editProfile(\'dept\')" style="cursor:pointer;text-decoration:underline dotted">'+esc(p.dept)+'</span></div>';
h+='<div><b style="color:var(--ac)">Pods:</b> <span onclick="editProfile(\'pods\')" style="cursor:pointer;text-decoration:underline dotted">'+esc(p.pods)+'</span></div>';
h+='<div><b style="color:var(--ac)">Joined:</b> <span onclick="editProfile(\'yearJoined\')" style="cursor:pointer;text-decoration:underline dotted">'+esc(p.yearJoined)+'</span></div>';
h+='<div><b style="color:var(--ac)">Updated:</b> '+(p.lastUpdated!=='—'?new Date(p.lastUpdated).toLocaleDateString():'—')+'</div>';
h+='</div>';
h+='<div style="display:flex;gap:6px;margin-top:8px">';
h+='<div style="flex:1;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--ac)">'+p.score.toFixed(2)+'</div><div style="font-size:8px;color:var(--tx3)">Score</div></div>';
h+='<div style="flex:1;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gn)">'+todayQ+'</div><div style="font-size:8px;color:var(--tx3)">Today</div></div>';
h+='<div style="flex:1;background:var(--bg2);border:1px solid var(--bdr);border-radius:6px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--or)">'+avgScore+'%</div><div style="font-size:8px;color:var(--tx3)">Win Rate</div></div>';
h+='</div></div>';
h+='<div style="margin-bottom:10px"><textarea id="homeStatusMsg" placeholder="Post a status update..." style="width:100%;min-height:40px;padding:8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px;margin-bottom:4px"></textarea>';
h+='<button class="btn btn-pr btn-sm" onclick="postStatusUpdate()" style="width:100%">Post Update</button></div>';
h+='<div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:6px">Departments</div>';
h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">';
var depts=[['🤝','Client Svc',true],['<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>','Pre-Press',false],['🚚','Logistics',false],['<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg>','Production',false],['💰','Accounting',false],['⚙️','Operations',false]];
depts.forEach(function(d){h+='<div style="background:var(--bg3);border:1px solid '+(d[2]?'var(--ac)':'var(--bdr)')+';border-radius:8px;padding:10px;text-align:center;opacity:'+(d[2]?'1':'.5')+'"><div style="font-size:16px">'+d[0]+'</div><div style="font-size:9px;margin-top:3px;color:'+(d[2]?'var(--ac)':'var(--tx3)')+'">'+d[1]+'</div></div>'});
h+='</div>';
h+='<div style="text-align:center;font-size:9px;color:var(--tx3)">'+new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+' · '+new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})+'</div>';
h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%;margin-top:8px">Close</button>';
openModal(h)}

function postStatusUpdate(){var el=$('homeStatusMsg');if(!el||!el.value.trim())return;var msg=el.value.trim();if(fbDb){fbDb.collection('microfeed').add({message:msg,user:getUserName(),userId:getUserId(),type:'status',mood:getMFXProfile().mood,timestamp:firebase.firestore.FieldValue.serverTimestamp()}).then(function(){closeModal();toast('Posted!','ok')}).catch(function(e){toast('Error: '+e.message,'err')})}else{toast('Requires Firebase','err')}}

function editProfile(field){const labels={flexId:'Flex ID (e.g. OPS-001)',role:'Role/Title',dept:'Department',pods:'Pods (comma separated)',yearJoined:'Year Joined (e.g. April 2025)',gchatWebhook:'Google Chat Webhook URL'};const cur=JSON.parse(localStorage.getItem('mfx_user_profile')||'{}');const val=prompt(labels[field]+':',cur[field]||'');if(val!==null){saveMFXProfile(field,val);closeModal();openHomeBase()}}

function changeMood(){const moods=['😊','🔥','💪','🎯','😎','🤔','😴','🚀','⭐','💜'];const cur=JSON.parse(localStorage.getItem('mfx_user_profile')||'{}');const idx=moods.indexOf(cur.mood||'😊');const next=moods[(idx+1)%moods.length];saveMFXProfile('mood',next);closeModal();openHomeBase()}

window.hamToggleSec=function(key){
var secs=['jt','ceo','cs','pp','lg','pr','ql','fn','op','fs','prod','qa','fin','ops','fsq','fai'];
secs.forEach(function(k){
  var sub=document.getElementById('hamSub-'+k);
  var arr=document.getElementById('hamArr-'+k);
  if(!sub)return;
  if(k===key){
    var open=sub.style.display!=='none';
    sub.style.display=open?'none':'block';
    if(arr)arr.style.transform=open?'':'rotate(90deg)';
  } else {
    sub.style.display='none';
    if(arr)arr.style.transform='';
  }
});
};
window.hamUnlockCEO=function(){
var sub=document.getElementById('hamCeoSub');
if(sub&&sub.style.display!=='none'){sub.style.display='none';document.getElementById('hamCeoArr').style.transform='';return}
var p = getMFXProfile();
var allowedRoles = ['ceo','admin','administrator','owner','operations manager'];
var userRole = (p.role || '').toLowerCase();
if (!allowedRoles.includes(userRole)) {
  toast('Unauthorized — CEO or admin role required','err');return;
}
if(sub){sub.style.display='block';document.getElementById('hamCeoArr').style.transform='rotate(90deg)';document.getElementById('hamCeoBtn').querySelector('span').textContent='🔓'}
};

function toggleHamburger(){if(typeof populateHamUser==='function')populateHamUser();var m=$('hamMenu');var o=$('hamOverlay');if(m.classList.contains('open')){m.classList.remove('open');o.classList.remove('open')}else{m.classList.add('open');o.classList.add('open');if(typeof _mfxApplyUnlock==='function')_mfxApplyUnlock();updateHamMenu()}}
function updateHamMenu(){const me=getUserName();const qs=DB.quotes();
const hu=$('hamUser');if(hu&&me){const r=calcPoints(me,qs);var _p=getMFXProfile();var _deptC={Operations:'#C0C0C0',Estimation:'#38bdf8','Pre-Press':'#d7ff2f',Production:'#4169E1',Quality:'#ef4444',Accounting:'#22c55e',Sales:'#a855f7',Administration:'#C0C0C0'};var _ac=_deptC[_p.dept||'Operations']||'#C0C0C0';hu.innerHTML='<div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:50%;background:'+_ac+';color:#000;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">'+me.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()+'</div><div><div style="font-weight:600;color:var(--tx)">'+me+'</div><div style="font-size:11px;color:'+_ac+'">'+r.pts.toFixed(2)+' pts</div></div></div>'}
const ap=qs.filter(q=>q.status==='approval').length;
const rfqCount=window._rfqPending||0;const ab=$('hamApprovalBadge');if(ab){if(ap>0){ab.style.display='inline';ab.textContent=ap}else{ab.style.display='none'}}
let mentionCount=0;qs.forEach(q=>{(q.internalNotes||[]).forEach(n=>{if(n.text&&n.text.includes('@'+me))mentionCount++;(n.replies||[]).forEach(r=>{if(r.text&&r.text.includes('@'+me))mentionCount++})})});const ib=$('hamInboxBadge');if(ib){if(mentionCount>0){ib.style.display='inline';ib.textContent=mentionCount}else{ib.style.display='none'}}
const hp=$('hamPoints');if(hp){const r=calcPoints(me,qs);hp.innerHTML='<div style="font-size:10px;color:var(--tx3)">📤 '+r.breakdown.submitted+' submitted · 🏆 '+r.breakdown.won+' won · <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> '+r.breakdown.notes+' notes · Total: <strong style="color:var(--ac)">'+r.pts.toFixed(2)+' pts</strong></div>'}}

// ═══ HAM NOTIFICATIONS (inline) ═══
function updateHamNotifs(){var me=getUserName();if(!me)return;var qs=DB.quotes();var notifs=[];
qs.forEach(function(q){(q.internalNotes||[]).forEach(function(n){if(n.text&&n.text.includes('@'+me))notifs.push({type:'mention',text:n.by+' mentioned you in '+q.quoteNum,at:n.at||''});(n.replies||[]).forEach(function(r){if(r.text&&r.text.includes('@'+me))notifs.push({type:'mention',text:r.by+' replied to you in '+q.quoteNum,at:r.at||''})})})});
var ap=qs.filter(function(q){return q.status==='approval'});ap.forEach(function(q){notifs.push({type:'approval',text:q.quoteNum+' pending approval',at:''})});
var el=$('hamNotifList');var ct=$('hamNotifCount');
if(ct)ct.textContent=notifs.length?notifs.length+' new':'';
if(el){if(!notifs.length){el.innerHTML='<div style="color:var(--tx3);padding:6px 0">All clear!</div>'}else{var h='';notifs.slice(0,10).forEach(function(n){h+='<div style="padding:4px 0;border-bottom:1px solid var(--bdr);display:flex;gap:6px;align-items:center"><span>'+(n.type==='mention'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>')+'</span><span>'+esc(n.text)+'</span></div>'});el.innerHTML=h}}}
_moduleInterval1 = setInterval(updateHamNotifs,5000);

// ═══ ACTIVE USERS ═══
function updateActiveUsers(){var el=$('hamActiveUsers');if(!el||!fbDb)return;
var me=getUserName();if(me&&fbAuth.currentUser){fbDb.collection('users').doc(fbAuth.currentUser.uid).set({displayName:me,email:fbAuth.currentUser.email||'',lastSeen:firebase.firestore.FieldValue.serverTimestamp(),online:true},{merge:true})}
var cutoff=new Date(Date.now()-5*60*1000);
fbDb.collection('users').get().then(function(snap){var h='';var count=0;snap.docs.forEach(function(d){var u=d.data();var name=u.displayName||u.email||'';if(!name)return;var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;var isOnline=ls&&ls>cutoff;if(isOnline)count++;h+='<div style="display:flex;align-items:center;gap:6px;padding:3px 0"><span style="width:8px;height:8px;border-radius:50%;background:'+(isOnline?'var(--gn)':'var(--tx3)')+';display:inline-block;flex-shrink:0"></span><span style="color:'+(isOnline?'var(--tx)':'var(--tx3)')+'">'+esc(name)+'</span></div>'});if(!h)h='<div style="color:var(--tx3)">No users found</div>';el.innerHTML=h}).catch(function(e){console.warn('activeUsersLoad:',e);el.innerHTML='<div style="color:var(--tx3)">Unavailable</div>'})}
_moduleInterval2 = setInterval(updateActiveUsers,30000);
setTimeout(updateActiveUsers,2000);
setTimeout(updateHamNotifs,2000);

// ALERT BANNER (replaces mentionBanner)
function checkAlerts(){const me=getUserName();if(!me)return;const qs=DB.quotes();let alerts=[];let mentionCount=0;let qids=[];
qs.forEach(q=>{(q.internalNotes||[]).forEach(n=>{if(n.text&&n.text.includes('@'+me)){mentionCount++;if(!qids.includes(q.id))qids.push(q.id)}(n.replies||[]).forEach(r=>{if(r.text&&r.text.includes('@'+me)){mentionCount++;if(!qids.includes(q.id))qids.push(q.id)}})})});
const ap=qs.filter(q=>q.status==='approval').length;
const rfqCount=window._rfqPending||0;
const el=$('alertBanner');if(el){const parts=[];if(mentionCount>0)parts.push('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> '+mentionCount+' @mention'+(mentionCount>1?'s':''));if(ap>0)parts.push('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> '+ap+' pending approval'+(ap>1?'s':''));if(parts.length){el.className='alert-banner show';el.innerHTML=parts.join(' · ')+' — tap to view';el.dataset.qids=JSON.stringify(qids)}else{el.className='alert-banner'}}}
function goToMentions(){const el=$('alertBanner');if(!el)return;el.className='alert-banner';try{const qids=JSON.parse(el.dataset.qids||'[]');if(qids.length>0){openEditor(qids[0]);setTimeout(()=>{S.etab=13;renderEditor()},100)}else{openCEOPortal()}}catch(e){}}
_moduleInterval3 = setInterval(checkAlerts,5000);

function updateBottomBar(view){const bar=$('bottomBar');if(!bar)return;bar.style.display='flex';const map={chat:0,supportboard:0,notifications:1,dashboard:3,quotes:3,calendar:4};bar.querySelectorAll('.bb-btn').forEach((b,i)=>{b.classList.toggle('active',i===(map[view]!==undefined?map[view]:-1))})}
function updateDashClock(){const dt=$('dashTime');const dd=$('dashDate');if(dt&&dd){const n=new Date();dt.textContent=n.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});dd.textContent=n.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
const ht=$('hdrTime');const hu=$('hdrUser');if(ht){const n=new Date();ht.textContent=n.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+' · '+n.toLocaleDateString('en-US',{month:'short',day:'numeric'})}if(hu)hu.textContent=getUserName();
updateAlertReel()}
function updateAlertReel(){const el=$('alertReelInner');if(!el)return;const qs=DB.quotes();const ap=qs.filter(q=>q.status==='approval').length;
const rfqCount=window._rfqPending||0;const rd=qs.filter(q=>q.status==='ready').length;const won=qs.filter(q=>q.status==='won').length;const pts=typeof calcPoints==='function'?calcPoints(getUserName(),qs):0;
const msgs=[];if(ap)msgs.push('🔒 '+ap+' quotes pending approval');if(rd)msgs.push('✅ '+rd+' ready to send');var ptsVal=(typeof pts==='object'&&pts!==null)?pts.pts:(typeof pts==='number'?pts:0);msgs.push('🏆 Your score: '+(ptsVal||0).toFixed(2)+' pts');msgs.push('📊 '+qs.length+' total quotes');if(won)msgs.push('🎉 '+won+' won');var lp=JSON.parse(localStorage.getItem('mfx_user_profile')||'{}');if(lp.lastStatus)msgs.push(lp.mood+' '+(lp.lastStatus||''));msgs.push('💜 Client Services Department');
el.textContent=msgs.join('    ·    ')}
_moduleInterval4 = setInterval(updateDashClock,1000);

// ═══ PAGE VISIBILITY — pause intervals when tab is hidden to save battery ═══
(function(){
  var _pausedIntervals = [];
  var _intervalRegistry = function() {
    return [
      {ref:'_moduleInterval1', fn:updateHamNotifs, ms:5000},
      {ref:'_moduleInterval2', fn:updateActiveUsers, ms:30000},
      {ref:'_moduleInterval3', fn:checkAlerts, ms:5000},
      {ref:'_moduleInterval4', fn:updateDashClock, ms:1000}
    ];
  };
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Pause: clear all tracked intervals
      _intervalRegistry().forEach(function(item) {
        if (window[item.ref]) { clearInterval(window[item.ref]); window[item.ref] = null; }
      });
      // Also pause realtime presence
      if (typeof MFX_LISTENERS !== 'undefined' && MFX_LISTENERS._presenceInterval) {
        clearInterval(MFX_LISTENERS._presenceInterval);
        MFX_LISTENERS._presenceInterval = null;
      }
    } else {
      // Resume: restart all intervals
      _intervalRegistry().forEach(function(item) {
        if (!window[item.ref]) { window[item.ref] = setInterval(item.fn, item.ms); item.fn(); }
      });
      // Restart presence
      if (typeof updatePresence === 'function' && typeof MFX_LISTENERS !== 'undefined' && !MFX_LISTENERS._presenceInterval) {
        updatePresence();
        MFX_LISTENERS._presenceInterval = setInterval(updatePresence, 60000);
      }
    }
  });
})();

// duplicate removed


// ═══════ GOOGLE API HELPERS ═══════
function getGoogleToken(){return new Promise(function(resolve){
var user=fbAuth.currentUser;if(!user)return resolve(null);
var exp=parseInt(sessionStorage.getItem('mfx_gtoken_exp')||'0');
if(window.GTOKEN&&Date.now()<exp){resolve(window.GTOKEN);return}
// Token missing or expired — clear stale and try sessionStorage
window.GTOKEN=null;sessionStorage.removeItem('mfx_gtoken');
// Force reauth to get fresh OAuth token
var provider=new firebase.auth.GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/tasks');
console.log('Reauthing for Google token...');
user.reauthenticateWithPopup(provider).then(function(result){
var cred=result.credential||firebase.auth.GoogleAuthProvider.credentialFromResult(result);
if(cred&&cred.accessToken){window.GTOKEN=cred.accessToken;sessionStorage.setItem('mfx_gtoken',cred.accessToken);sessionStorage.setItem('mfx_gtoken_exp',String(Date.now()+3500000));console.log('✅ Got token via reauth');resolve(window.GTOKEN)}
else{console.log('❌ Still no token');resolve(null)}
}).catch(function(e){console.log('Reauth failed:',e.message);resolve(null)})})}

function createCalendarEvent(title,description,startDate,startTime,durationMins){
if(!MFX_SHARED_CALENDAR){console.warn('Calendar ID not configured');return}
console.log('Creating calendar event:',title,startDate);
getGoogleToken().then(function(token){if(!token){toast('Google auth needed — try again','err');return}
var start=new Date(startDate+'T'+(startTime||'10:00')+':00');
var end=new Date(start.getTime()+(durationMins||60)*60000);

fetch('https://www.googleapis.com/calendar/v3/calendars/'+MFX_SHARED_CALENDAR+'/events',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({summary:title,description:description||'',start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()},reminders:{useDefault:true}})
}).then(function(r){return r.json()}).then(function(data){
if(data.id){toast('Calendar event created!','ok')}else{toast('Calendar error: '+(data.error?data.error.message:'unknown'),'err')}
}).catch(function(e){toast('Calendar error: '+e.message,'err')})})}

function sendGmail(to,subject,bodyHtml,fromAddr){
/* EMAIL_GUARD wrap (2026-05-24): bail if customer emails are blocked */
if(window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.blockIfDisabled('sendGmail', to)) return;
getGoogleToken().then(function(token){if(!token)return toast('Google auth required','err');
var raw=(fromAddr?'From: '+fromAddr+'\r\n':'')+'To: '+to+'\r\nSubject: '+subject+'\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'+bodyHtml;
var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{
method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
body:JSON.stringify({raw:encoded})
}).then(function(r){return r.json()}).then(function(data){
if(data.id){toast('Email sent!','ok')}else{toast('Email error','err')}
}).catch(function(e){toast('Email error: '+e.message,'err')})})}

function saveToDrive(fileName,content,mimeType){
getGoogleToken().then(function(token){if(!token)return toast('Google auth required','err');
var metadata={name:fileName,mimeType:mimeType||'text/html'};
var form=new FormData();
form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
form.append('file',new Blob([content],{type:mimeType||'text/html'}));
fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
method:'POST',headers:{'Authorization':'Bearer '+token},body:form
}).then(function(r){return r.json()}).then(function(data){
if(data.id){toast('Saved to Google Drive!','ok')}else{toast('Drive error','err')}
}).catch(function(e){toast('Drive error: '+e.message,'err')})})}


function sendGoogleChatNotification(webhookUrl,message){
if(!webhookUrl)return;
fetch(webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({text:message})}).catch(function(e){console.log('Chat notify error:',e)})}

function notifyTeam(message){
var webhook=localStorage.getItem('mfx_gchat_webhook')||'';
if(webhook)sendGoogleChatNotification(webhook,message);
}

// @MENTION NOTIFICATIONS


// MFX SUPPORT
function openSupportModal(){
S.view='supportboard';document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));$('v-supportboard').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=()=>goView('dashboard');$('hdrTitle').textContent='MicroFeed';$('hdrActions').innerHTML='';renderSupportBoard()}
function newSupportTicket(){openModal('<div class="modal-title">Share with the Team</div><div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Visible to all team members — Ideas, shoutouts, questions, feedback — your team is listening!</div><textarea id="supportMsg" placeholder="Share an idea, give a shoutout, ask a question..." style="width:100%;min-height:80px;padding:8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:12px;margin-bottom:8px"></textarea><button class="btn btn-pr btn-sm" onclick="submitSupport()" style="width:100%">Post</button><button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>')}
function submitSupport(){const msg=$('supportMsg');if(!msg||!msg.value.trim())return;fbDb.collection('support').add({message:msg.value.trim(),user:getUserName(),userId:getUserId(),timestamp:firebase.firestore.FieldValue.serverTimestamp(),status:'posted',upvotes:0,downvotes:0,comments:[]});closeModal();toast('Posted to MicroFeed!','ok');notifyTeam('📡 '+getUserName()+': '+msg.value.trim().substring(0,80))}

// FLEX GAMES LEADERBOARD
function calcPoints(user,qs){let pts=0;let breakdown={submitted:0,won:0,notes:0,mentions:0,replies:0,rfq:0};qs.forEach(q=>{if(q.createdBy===user){if(q.status!=='draft'){pts+=0.25;breakdown.submitted++}if(q.status==='won'){pts+=0.75;breakdown.won++}if(q.rfqId){pts+=0.25;breakdown.rfq++}}(q.internalNotes||[]).forEach(n=>{if(n.by===user){pts+=0.25;breakdown.notes++;if(n.mentions&&n.mentions.length){pts+=n.mentions.length*0.1;breakdown.mentions+=n.mentions.length}}(n.replies||[]).forEach(r=>{if(r.by===user){pts+=0.1;breakdown.replies++}})})});return{pts:Math.round(pts*100)/100,breakdown}}
function openFlexGames(){const qs=DB.quotes();const me=getUserName();const users={};qs.forEach(q=>{const u=q.createdBy||'Unknown';if(!users[u])users[u]={quotes:0,won:0,sent:0,notes:0,pts:0,bd:{}};users[u].quotes++;if(q.status==='won')users[u].won++;if(q.status==='sent')users[u].sent++;(q.internalNotes||[]).forEach(n=>{if(n.by===u)users[u].notes++})});Object.keys(users).forEach(u=>{const r=calcPoints(u,qs);users[u].pts=r.pts;users[u].bd=r.breakdown});const sorted=Object.entries(users).sort((a,b)=>b[1].pts-a[1].pts);
const myData=users[me]||{pts:0,quotes:0,won:0,notes:0,bd:{submitted:0,won:0,notes:0,mentions:0,replies:0}};const myRank=sorted.findIndex(([n])=>n===me)+1;
const challenges=JSON.parse(localStorage.getItem('mfx_challenges')||'[]');
let h='<div class="modal-title">🎮 Flex Games</div>';
h+='<div style="display:flex;gap:10px;margin-bottom:10px">';
h+='<div style="flex:1">';
h+='<div style="font-size:10px;color:var(--tx3);font-weight:600;margin-bottom:4px">LEADERBOARD</div>';
sorted.forEach(([name,s],i)=>{const isMe=name===me;h+='<div style="padding:6px 4px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;'+(isMe?'background:var(--bg3);border-radius:4px':'')+'"><div><span style="font-size:14px;margin-right:4px">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1))+'</span><strong'+(isMe?' style="color:var(--ac)"':'')+'>'+(isMe?'★ ':'')+name+'</strong></div><div style="font-size:10px;color:var(--tx2)"><strong style="color:var(--ac)">'+s.pts.toFixed(2)+'</strong> pts · '+s.won+'W</div></div>'});
h+='</div>';
h+='<div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px">';
h+='<div style="font-size:10px;color:var(--tx3);font-weight:600;margin-bottom:6px">YOUR PROFILE — #'+myRank+'</div>';
h+='<div style="text-align:center;margin-bottom:8px"><div style="font-size:28px;font-weight:700;color:var(--ac)">'+myData.pts.toFixed(2)+'</div><div style="font-size:10px;color:var(--tx3)">Total Points</div></div>';
h+='<div style="font-size:10px;color:var(--tx2);line-height:2">';
h+='📤 Submitted: <strong>'+myData.bd.submitted+'</strong> × 0.25 = '+(myData.bd.submitted*0.25).toFixed(2)+'<br>';
h+='🏆 Won: <strong>'+myData.bd.won+'</strong> × 0.75 = '+(myData.bd.won*0.75).toFixed(2)+'<br>';
h+='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Notes: <strong>'+myData.bd.notes+'</strong> × 0.25 = '+(myData.bd.notes*0.25).toFixed(2)+'<br>';
h+='@ Mentions: <strong>'+myData.bd.mentions+'</strong> × 0.10 = '+(myData.bd.mentions*0.1).toFixed(2)+'<br>';
h+='↩ Replies: <strong>'+myData.bd.replies+'</strong> × 0.10 = '+(myData.bd.replies*0.1).toFixed(2)+'</div>';
h+='<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--bdr)">';
h+='<div style="font-size:10px;color:var(--tx3);font-weight:600;margin-bottom:4px">COMPETE</div>';
h+='<button class="btn btn-ghost btn-xs" onclick="sendChallenge()" style="width:100%">⚔️ Challenge a User</button>';
if(challenges.length){challenges.slice(-3).forEach(c=>{h+='<div style="font-size:9px;color:var(--tx3);margin-top:3px">'+c.from+' → '+c.to+' ('+new Date(c.at).toLocaleDateString()+')</div>'})}
h+='</div></div></div>';
h+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:6px;padding:8px;margin-bottom:8px;font-size:9px;color:var(--tx3)"><b>Points Scale:</b> Submit .25 · Won .75 · Notes .25 · @Mentions .10 · Replies .10 · Edits/Additions .10</div>';
h+='<button class="btn btn-ghost btn-sm" onclick="closeModal()" style="width:100%">Close</button>';
openModal(h)}
function sendChallenge(){const users=getTeamUsers();const me=getUserName();const target=prompt('Challenge who?\n'+users.filter(u=>u!==me).join(', '));if(!target)return;const challenges=JSON.parse(localStorage.getItem('mfx_challenges')||'[]');challenges.push({from:me,to:target.trim(),at:new Date().toISOString()});localStorage.setItem('mfx_challenges',JSON.stringify(challenges));toast('Challenge sent to '+target.trim()+'!','ok');closeModal();openFlexGames()}

// CUSTOMER PROFILE
function openProfile(cid){S.view='profile';S.profileId=cid;document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));$('v-profile').classList.add('active');$('mainTabs').style.display='none';$('hdrBack').style.display='block';$('hdrBack').onclick=()=>{if(S.editId){openEditor(S.editId)}else{goView('customers')}};renderProfile(cid)}

function renderProfile(cid){
const c=DB.customers().find(x=>x.id===cid);if(!c){goView('customers');return}
const co=c.company.toLowerCase();
const qs=DB.quotes().filter(q=>(q.fields.custCo&&q.fields.custCo.toLowerCase()===co)||q.customerId===cid);
const drafts=qs.filter(q=>q.status==='draft');
const approvals=qs.filter(q=>q.status==='approval');
const sent=qs.filter(q=>q.status==='sent');
const won=qs.filter(q=>q.status==='won');
const lost=qs.filter(q=>q.status==='lost');
const arch=qs.filter(q=>q.status==='archived');
const totalWon=won.reduce((s,q)=>s+(q.wonAmount||0),0);
const winRate=won.length+lost.length>0?Math.round(won.length/(won.length+lost.length)*100):0;
const notes=c.notes||[];

// Cross-module data
const pos=qs.filter(q=>q.status==='won'&&q.poNumber);
const sos=(typeof getSalesOrders==='function')?getSalesOrders().filter(function(s){return s.company&&s.company.toLowerCase()===co}):[];
const jps=(typeof getPassports==='function')?getPassports().filter(function(p){return p.company&&p.company.toLowerCase()===co}):[];
const jts=(typeof getJobTickets==='function')?getJobTickets().filter(function(t){return t.company&&t.company.toLowerCase()===co}):[];
const bps=(typeof getBlueprints==='function')?getBlueprints().filter(function(b){return b.company&&b.company.toLowerCase()===co}):[];

// Communications from quote internal notes
var comms=[];
qs.forEach(function(q){(q.internalNotes||[]).forEach(function(n){
  if(n.text&&(n.text.indexOf('📧')>=0||n.text.indexOf('Emailed')>=0||n.text.indexOf('email')>=0||n.text.indexOf('☁')>=0))
    comms.push({quoteNum:q.quoteNum,text:n.text,by:n.by,at:n.at});
})});
comms.sort(function(a,b){return(b.at||'').localeCompare(a.at||'')});

// Materials used
const matsUsed={};qs.forEach(q=>{const f=q.fields;[f.faceStock,f.lamination,f.liner,f.adhesive,f.coating].forEach(m=>{if(m&&m!=='NA'&&m!=='CUSTOM')matsUsed[m]=(matsUsed[m]||0)+1})});
const matTags=Object.entries(matsUsed).sort((a,b)=>b[1]-a[1]).slice(0,12);

// Profile sub-tab state
if(!window._profTab)window._profTab='overview';
var pt=window._profTab;

$('hdrTitle').textContent=c.company;
$('hdrActions').innerHTML='<button class="btn btn-ghost btn-sm" onclick="showCustForm(\''+cid+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';

var h='<div class="prof-hdr" style="display:flex;gap:14px;align-items:flex-start">';
// Logo
if(c.logoUrl){h+='<div style="flex-shrink:0;width:64px;height:64px;border-radius:10px;border:1px solid var(--bdr);overflow:hidden;background:var(--bg3);display:flex;align-items:center;justify-content:center"><img src="'+c.logoUrl+'" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.parentElement.innerHTML=\'<svg width=\\&quot;14\\&quot; height=\\&quot;14\\&quot; viewBox=\\&quot;0 0 24 24\\&quot; fill=\\&quot;none\\&quot; stroke=\\&quot;currentColor\\&quot; stroke-width=\\&quot;2\\&quot;><rect x=\\&quot;4\\&quot; y=\\&quot;2\\&quot; width=\\&quot;16\\&quot; height=\\&quot;20\\&quot; rx=\\&quot;2\\&quot;/><line x1=\\&quot;9\\&quot; y1=\\&quot;6\\&quot; x2=\\&quot;9\\&quot; y2=\\&quot;6.01\\&quot;/><line x1=\\&quot;15\\&quot; y1=\\&quot;6\\&quot; x2=\\&quot;15\\&quot; y2=\\&quot;6.01\\&quot;/><line x1=\\&quot;9\\&quot; y1=\\&quot;10\\&quot; x2=\\&quot;9\\&quot; y2=\\&quot;10.01\\&quot;/><line x1=\\&quot;15\\&quot; y1=\\&quot;10\\&quot; x2=\\&quot;15\\&quot; y2=\\&quot;10.01\\&quot;/><line x1=\\&quot;9\\&quot; y1=\\&quot;14\\&quot; x2=\\&quot;9\\&quot; y2=\\&quot;14.01\\&quot;/><line x1=\\&quot;15\\&quot; y1=\\&quot;14\\&quot; x2=\\&quot;15\\&quot; y2=\\&quot;14.01\\&quot;/><path d=\\&quot;M9 22v-4h6v4\\&quot;/></svg>\'"></div>';}
else{h+='<div style="flex-shrink:0;width:64px;height:64px;border-radius:10px;border:1px solid var(--bdr);background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:28px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 22v-4h6v4"/></svg></div>';}
h+='<div style="flex:1;min-width:0"><div class="prof-co">'+esc(c.company)+'</div>';
h+='<div class="prof-contact">'+esc(c.contact||'No contact')+(c.contactTitle?' <span style="color:var(--tx3);font-weight:400"> · '+esc(c.contactTitle)+'</span>':'')+'</div>';
h+='<div class="prof-meta" style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px;font-size:11px">';
if(c.phone)h+='<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> '+esc(c.phone)+'</span>';
if(c.email)h+='<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> '+esc(c.email)+'</span>';
if(c.industry)h+='<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg> '+esc(c.industry)+'</span>';
if(c.website)h+='<span>🌐 <a href="'+c.website+'" target="_blank" style="color:var(--ac)">Website</a></span>';
if(c.address)h+='<span>📍 '+esc(c.address)+(c.cityState?' '+esc(c.cityState):'')+(c.zip?' '+esc(c.zip):'')+'</span>';
if(c.accountNum)h+='<span style="color:var(--or)">Acct: '+esc(c.accountNum)+'</span>';
if(c.defaultTerms)h+='<span style="color:var(--gn)">Terms: '+esc(c.defaultTerms)+'</span>';
h+='</div>';
// Links row
h+='<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
h+='<button class="btn btn-pr btn-sm" onclick="newQuoteForCust(\''+cid+'\')">+ New Quote</button>';
h+='<button class="btn btn-ghost btn-sm" onclick="showCustForm(\''+cid+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
if(c.driveFolder)h+='<a href="'+c.driveFolder+'" target="_blank" class="btn btn-ghost btn-sm" style="text-decoration:none">📁 Drive Folder</a>';
if(c.zohoId)h+='<span style="font-size:10px;color:var(--tx3);padding:6px;align-self:center">Zoho: '+c.zohoId.slice(-8)+'</span>';
h+='</div></div></div>';

// Stats bar
h+='<div class="prof-stats"><div class="ps"><div class="ps-v">'+qs.length+'</div><div class="ps-l">Quotes</div></div>';
h+='<div class="ps"><div class="ps-v gn">'+won.length+'</div><div class="ps-l">Won</div></div>';
h+='<div class="ps"><div class="ps-v gn">'+f$(totalWon)+'</div><div class="ps-l">Revenue</div></div>';
h+='<div class="ps"><div class="ps-v '+(winRate>=50?'gn':'rd')+'">'+winRate+'%</div><div class="ps-l">Win Rate</div></div>';
h+='<div class="ps"><div class="ps-v" style="color:#DAA520">'+pos.length+'</div><div class="ps-l">POs</div></div>';
h+='<div class="ps"><div class="ps-v bl">'+jps.length+'</div><div class="ps-l">Jobs</div></div></div>';

// Sub-tabs
var tabs=[
  {key:'overview',label:'Overview',count:null},
  {key:'quotes',label:'Quotes',count:qs.length},
  {key:'orders',label:'POs & SOs',count:pos.length+sos.length},
  {key:'production',label:'Jobs & Tickets',count:jps.length+jts.length},
  {key:'blueprints',label:'SKUs',count:bps.length},
  {key:'comms',label:'Communications',count:comms.length},
  {key:'notes',label:'Notes',count:notes.length}
];
h+='<div style="display:flex;gap:0;margin:12px 0 0;border-bottom:2px solid var(--bdr);overflow-x:auto">';
tabs.forEach(function(t){
  h+='<div style="padding:8px 12px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid '+(pt===t.key?'var(--ac)':'transparent')+';color:'+(pt===t.key?'var(--ac)':'var(--tx3)')+'" onclick="window._profTab=\''+t.key+'\';renderProfile(\''+cid+'\')">'+t.label+(t.count!==null?' <span style=\\"font-size:9px;background:var(--bg3);padding:1px 5px;border-radius:8px\\">'+t.count+'</span>':'')+'</div>';
});
h+='</div><div style="padding:12px 0">';

// ─── OVERVIEW TAB ───
if(pt==='overview'){
  if(matTags.length){h+='<div class="prof-sec"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Materials Used</div><div style="margin-bottom:12px">'+matTags.map(function(m){return'<span class="prof-mat-tag">'+m[0]+' <span style="color:var(--ac);font-size:9px">×'+m[1]+'</span></span>'}).join('')+'</div>'}
  // Recent activity summary
  h+='<div class="prof-sec"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> Recent Activity</div>';
  if(pos.length){h+='<div style="font-size:11px;color:#DAA520;padding:4px 0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> '+pos.length+' PO'+(pos.length>1?'s':'')+' submitted</div>'}
  if(sos.length){var pendSO=sos.filter(function(s){return s.status==='pending'}).length;var appSO=sos.filter(function(s){return s.status==='approved'||s.status==='sent'}).length;h+='<div style="font-size:11px;color:var(--ac);padding:4px 0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> '+sos.length+' Sales Order'+(sos.length>1?'s':'')+(pendSO?' ('+pendSO+' pending)':'')+(appSO?' ('+appSO+' active)':'')+'</div>'}
  if(jps.length){var activeJP2=jps.filter(function(p){return p.status!=='complete'}).length;h+='<div style="font-size:11px;color:var(--ac);padding:4px 0">🛂 '+jps.length+' Job Passport'+(jps.length>1?'s':'')+(activeJP2?' ('+activeJP2+' active)':'')+'</div>'}
  if(jts.length){var openJT=jts.filter(function(t){return t.status!=='closed'}).length;h+='<div style="font-size:11px;color:var(--ac);padding:4px 0">🎫 '+jts.length+' Job Ticket'+(jts.length>1?'s':'')+(openJT?' ('+openJT+' open)':'')+'</div>'}
  if(lost.length){h+='<div class="prof-sec" style="margin-top:12px">❌ Lost Reasons</div>';lost.filter(function(q){return q.lostReason}).forEach(function(q){h+='<div style="font-size:11px;color:var(--tx2);padding:4px 0;border-bottom:1px solid var(--bdr)"><strong>'+q.quoteNum+'</strong> — '+q.lostReason+' <span style="color:var(--tx3);font-size:10px">'+fD(q.closedAt)+'</span></div>'});}
}

// ─── QUOTES TAB ───
else if(pt==='quotes'){
  h+='<div class="filters" style="padding-bottom:8px"><div class="fbtn active" onclick="profFilter(this,\'all\',\''+cid+'\')">All ('+qs.length+')</div>';
  if(drafts.length)h+='<div class="fbtn" onclick="profFilter(this,\'draft\',\''+cid+'\')">Draft ('+drafts.length+')</div>';
  if(approvals.length)h+='<div class="fbtn" onclick="profFilter(this,\'approval\',\''+cid+'\')">Pending ('+approvals.length+')</div>';
  if(sent.length)h+='<div class="fbtn" onclick="profFilter(this,\'sent\',\''+cid+'\')">Sent ('+sent.length+')</div>';
  if(won.length)h+='<div class="fbtn" onclick="profFilter(this,\'won\',\''+cid+'\')">Won ('+won.length+')</div>';
  if(lost.length)h+='<div class="fbtn" onclick="profFilter(this,\'lost\',\''+cid+'\')">Lost ('+lost.length+')</div>';
  h+='</div><div id="profQuotes">'+renderProfQuotes(qs,'all')+'</div>';
}

// ─── POs & SOs TAB ───
else if(pt==='orders'){
  if(pos.length){
    h+='<div style="font-size:10px;font-weight:700;color:#DAA520;letter-spacing:1px;margin-bottom:6px">PURCHASE ORDERS ('+pos.length+')</div>';
    pos.forEach(function(q){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid #DAA520;border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px;cursor:pointer" onclick="openEditor(\''+q.id+'\')">';
      h+='<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:var(--tx)">'+q.quoteNum+'</span><span class="pill pill-won">WON</span></div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">PO# '+esc(q.poNumber||'—')+' · Signed: '+esc(q.poSignature||'—')+' · '+(q.poSignedAt?fD(q.poSignedAt):'—')+'</div>';
      if(q.poFiles&&q.poFiles.length){h+='<div style="margin-top:4px">'; q.poFiles.forEach(function(f){h+='<a href="'+f.url+'" target="_blank" style="font-size:9px;color:var(--ac);margin-right:8px" onclick="event.stopPropagation()">📎 '+esc(f.name)+'</a>'}); h+='</div>'}
      h+='</div>';
    });
  }
  if(sos.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin:12px 0 6px">SALES ORDERS ('+sos.length+')</div>';
    sos.forEach(function(so){
      var sc={pending:'var(--or)',approved:'var(--gn)',sent:'var(--ac)'}[so.status]||'var(--tx3)';
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+sc+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px;cursor:pointer" onclick="if(typeof openSODetail===\'function\')openSODetail(\''+so.id+'\')">';
      h+='<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:var(--tx)">'+esc(so.soNum)+'</span><span style="font-size:9px;font-weight:700;color:'+sc+'">'+esc(so.status)+'</span></div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">From '+esc(so.quoteNum)+' · PO# '+esc(so.poNumber)+' · $'+Number(so.total||0).toLocaleString(undefined,{minimumFractionDigits:2})+'</div>';
      if(so.driveLink)h+='<a href="'+so.driveLink+'" target="_blank" style="font-size:9px;color:var(--ac);margin-top:4px;display:inline-block" onclick="event.stopPropagation()">☁ View on Drive</a>';
      h+='</div>';
    });
  }
  if(!pos.length&&!sos.length)h+='<div style="color:var(--tx3);font-size:12px;padding:8px 0">No purchase orders or sales orders yet.</div>';
}

// ─── JOBS & TICKETS TAB ───
else if(pt==='production'){
  if(jps.length){
    h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:6px">JOB PASSPORTS ('+jps.length+')</div>';
    jps.forEach(function(jp){
      var sc2={active:'var(--ac)',prepress:'#a78bfa',production:'var(--gn)',shipping:'var(--or)',complete:'var(--tx3)'}[jp.status]||'var(--tx3)';
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+sc2+';border-radius:0 8px 8px 0;padding:10px;margin-bottom:6px;cursor:pointer" onclick="if(typeof openPassportDetail===\'function\')openPassportDetail(\''+jp.id+'\')">';
      h+='<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:var(--tx)">'+esc(jp.jpNum)+'</span><span style="font-size:9px;font-weight:700;color:'+sc2+'">'+esc(jp.status)+'</span></div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+esc(jp.jobDesc)+' · SKUs: '+(jp.skus?jp.skus.length:0)+' · Qty: '+Number(jp.selectedQty||0).toLocaleString()+'</div>';
      h+='</div>';
    });
  }
  if(jts.length){
    h+='<div style="font-size:10px;font-weight:700;color:#a78bfa;letter-spacing:1px;margin:12px 0 6px">JOB TICKETS ('+jts.length+')</div>';
    jts.forEach(function(jt){
      var sc3={open:'var(--ac)',prepress:'#a78bfa',running:'var(--gn)',qa:'var(--or)',closed:'var(--tx3)'}[jt.status]||'var(--tx3)';
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-left:3px solid '+sc3+';border-radius:0 8px 8px 0;padding:8px 10px;margin-bottom:4px">';
      h+='<div style="display:flex;justify-content:space-between"><span style="font-size:11px;font-weight:600;color:var(--tx)">'+esc(jt.jtNum)+' · '+esc(jt.skuName)+'</span><span style="font-size:8px;font-weight:700;color:'+sc3+'">'+esc(jt.status)+'</span></div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+(jt.sizeA||'?')+'x'+(jt.sizeB||'?')+'" · '+(jt.colors||'?')+'C · Qty: '+Number(jt.qty||0).toLocaleString()+'</div>';
      h+='</div>';
    });
  }
  if(!jps.length&&!jts.length)h+='<div style="color:var(--tx3);font-size:12px;padding:8px 0">No jobs or tickets yet.</div>';
}

// ─── SKU BLUEPRINTS TAB ───
else if(pt==='blueprints'){
  if(bps.length){
    bps.forEach(function(bp){
      h+='<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:10px;margin-bottom:6px;cursor:pointer" onclick="if(typeof openBlueprintDetail===\'function\')openBlueprintDetail(\''+bp.id+'\')">';
      h+='<div style="display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:var(--ac)">'+esc(bp.bpId)+'</span><span style="font-size:9px;color:var(--tx3)">Used '+bp.useCount+'x</span></div>';
      h+='<div style="font-size:11px;font-weight:600;color:var(--tx)">'+esc(bp.bpName)+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+(bp.sizeA||'?')+'x'+(bp.sizeB||'?')+'" '+(bp.shapeType||'')+' · '+(bp.colors||'?')+'C '+(bp.jobType||'')+' · '+(bp.face||'—')+' / '+(bp.laminate||'—')+'</div>';
      if(bp.productionHistory&&bp.productionHistory.length){h+='<div style="font-size:9px;color:var(--tx3);margin-top:4px">Last run: '+fD(bp.productionHistory[bp.productionHistory.length-1].at)+'</div>'}
      h+='</div>';
    });
  }else{h+='<div style="color:var(--tx3);font-size:12px;padding:8px 0">No SKU blueprints for this client yet. Blueprints are created when linking SKUs in Job Passports.</div>'}
}

// ─── COMMUNICATIONS TAB ───
else if(pt==='comms'){
  if(comms.length){
    comms.slice(0,30).forEach(function(cm){
      h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr)">';
      h+='<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--tx3)"><span>'+cm.quoteNum+'</span><span>'+fD(cm.at)+'</span></div>';
      h+='<div style="font-size:11px;color:var(--tx);margin-top:2px">'+esc(cm.text)+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3)">by '+esc(cm.by)+'</div>';
      h+='</div>';
    });
  }else{h+='<div style="color:var(--tx3);font-size:12px;padding:8px 0">No email communications tracked yet. Emails are logged when quotes are sent.</div>'}
  // Add comment
  h+='<div style="margin-top:12px"><textarea id="profComment" placeholder="Add a comment about this client..." style="width:100%;min-height:60px;padding:8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px;box-sizing:border-box"></textarea>';
  h+='<button class="btn btn-pr btn-xs" onclick="addClientComment(\''+cid+'\')" style="margin-top:4px">Add Comment</button></div>';
}

// ─── NOTES TAB ───
else if(pt==='notes'){
  h+='<button class="btn btn-ghost btn-xs" onclick="addCustNote(\''+cid+'\')" style="margin-bottom:8px">+ Add Note</button>';
  if(notes.length){notes.forEach(function(n,i){
    h+='<div class="prof-note"><div class="prof-note-hd"><span class="prof-note-dt">'+fD(n.date)+'</span>'+(n.by?'<span style="font-size:9px;color:var(--tx3)">'+esc(n.by)+'</span>':'')+'<button class="btn btn-ghost btn-xs" onclick="delCustNote(\''+cid+'\','+i+')">✕</button></div><div class="prof-note-tx">'+esc(n.text)+'</div></div>';
  })}else{h+='<div style="color:var(--tx3);font-size:12px;padding:8px 0">No notes yet.</div>'}
}

h+='</div>';
$('v-profile').innerHTML=h;
}

function addClientComment(cid){
  var text=($('profComment')||{}).value;if(!text||!text.trim())return toast('Enter a comment','err');
  var all=DB.customers();var c=all.find(function(x){return x.id===cid});if(!c)return;
  if(!c.notes)c.notes=[];
  c.notes.unshift({date:new Date().toISOString(),text:text.trim(),by:getUserName(),type:'comment'});
  DB.saveC(all);toast('Comment added','ok');renderProfile(cid);
}

function renderProfQuotes(qs,filter){
const fq=filter==='all'?qs:qs.filter(q=>q.status===filter);
return fq.map(q=>`<div class="qcard" onclick="openEditor('${q.id}')">
<div class="qcard-top"><div><span class="qcard-num">${q.quoteNum}</span><span class="qcard-rev">Rev ${q.rev}</span></div><span class="pill pill-${q.status}">${q.status}</span></div>
<div class="qcard-desc">${q.fields.jobDesc||'No description'} · ${q.fields.jobType}</div>
<div class="qcard-bot"><span class="qcard-date">${fD(q.updatedAt)}${q.status==='won'&&q.wonAmount?' · '+f$(q.wonAmount):''}</span>
<div style="display:flex;gap:4px">
<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();dupQuote('${q.id}',false)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Reorder</button>
<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();dupQuote('${q.id}',true)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Revise</button>
<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();showQA('${q.id}')">⋯</button>
</div></div></div>`).join('')}

function profFilter(el,filter,cid){
const c=DB.customers().find(x=>x.id===cid);if(!c)return;
const qs=DB.quotes().filter(q=>(q.fields.custCo&&q.fields.custCo.toLowerCase()===c.company.toLowerCase())||q.customerId===cid);
el.parentElement.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');
$('profQuotes').innerHTML=renderProfQuotes(qs,filter)}

function newQuoteForCust(cid){
const c=DB.customers().find(x=>x.id===cid);if(!c)return;
newQuote();
// After creating, fill customer fields
setTimeout(()=>{
  const q=getQ(S.editId);if(!q)return;
  q.fields.custCo=c.company;q.fields.custAttn=c.contact||'';q.fields.custPhone=c.phone||c.email||'';q.customerId=cid;
  DB.saveQ(DB.quotes());renderEditor();
},50)}

function addCustNote(cid){
const text=prompt('Add note:');if(!text)return;
const all=DB.customers();const c=all.find(x=>x.id===cid);if(!c)return;
if(!c.notes)c.notes=[];
c.notes.unshift({date:new Date().toISOString(),text,by:getUserName()});
DB.saveC(all);renderProfile(cid)}

function delCustNote(cid,idx){
if(!confirm('Delete this note?'))return;
const all=DB.customers();const c=all.find(x=>x.id===cid);if(!c||!c.notes)return;
c.notes.splice(idx,1);DB.saveC(all);renderProfile(cid)}

// SEED CLIENTS FROM ZOHO CRM EXPORT
const SEED_CLIENTS=[{"id": "c1000", "company": "Plus Brand Industries", "contact": "Adam Gauer", "phone": "18006976700", "email": "adam@plusbrand.com", "industry": "Food/Beverage", "address": "30 N. Gould Street STE 3602, Sheridan, WY 82801", "zohoId": "zcrm_6566137000000665239"}, {"id": "c1001", "company": "Weston Graphics", "contact": "Adam Weston", "phone": "8187015949", "email": "adam@westongraphicsinc.com", "industry": "Broker", "address": "9320 Lurline Avenue, Chatsworth, CA 91311", "zohoId": "zcrm_6566137000000665257"}, {"id": "c1002", "company": "Namar", "contact": "Adrianna Ibarra", "phone": "562-531-2744 ext 212", "email": "purchasing@namar.com", "industry": "Co-packer", "address": "6830 Walthall Way, Paramount, CA 90723", "zohoId": "zcrm_6566137000000665234"}, {"id": "c1003", "company": "Reshma Beauty Inc", "contact": "Andrea Aguiar", "phone": "818-817-2703", "email": "andrea@reshmabeauty.com", "industry": "Beauty / Cosmetics / haircare", "address": "13223 Ventura Blvd Ste J, Studio City, CA 91604", "zohoId": "zcrm_6566137000000665245"}, {"id": "c1004", "company": "Creative Manufacturing LLC", "contact": "Andrew Robinson", "phone": "657-274-8503", "email": "andrew@creativemanufacturing.co", "industry": "Pharmaceutical / Supplements", "address": "8249 E Blackwillow Cir #100, Anaheim, California 92808", "zohoId": "zcrm_6566137000000665219"}, {"id": "c1005", "company": "FlavCity HQ", "contact": "Ashley Zager", "phone": "339.933.0528", "email": "ashley@shopflavcity.com", "industry": "Pharmaceutical / Supplements", "address": "6586 West Atlantic Avenue #1008, Delray Beach, FL 33446", "zohoId": "zcrm_6566137000000665224"}, {"id": "c1006", "company": "Super Mouth LLC", "contact": "Bella Evangelho", "phone": "34 640.236.574", "email": "", "industry": "Pharmaceutical / Supplements", "address": "9737 Aero Dr., San Diego, CA 92123", "zohoId": "zcrm_6566137000000665251"}, {"id": "c1007", "company": "Custom Architectural Signage", "contact": "Christian Esquivel", "phone": "", "email": "", "industry": "Manufacturing", "address": "10280 Glenoaks Blvd, Pacoima, CA 91331", "zohoId": "zcrm_6566137000000665221"}, {"id": "c1008", "company": "timeless SKIN CARE", "contact": "Christian Munoz", "phone": "832-944-6750", "email": "", "industry": "Beauty / Cosmetics / haircare", "address": "4000 Greenbriar Dr Suite 400, Stafford, TX 77477", "zohoId": "zcrm_6566137000000665252"}, {"id": "c1009", "company": "5 Star Packaging Inc.", "contact": "Colby Tibbets", "phone": "714 221-0730", "email": "", "industry": "Broker", "address": "960 N. Tustin Ave. #322, Orange, CA 92867", "zohoId": "zcrm_6566137000000665214"}, {"id": "c1010", "company": "West Coast Commerce, LLC", "contact": "Crystal Hall", "phone": "619-476-1090", "email": "", "industry": "Broker", "address": "573 Twin Oaks Avenue, Chula Vista, CA 91910", "zohoId": "zcrm_6566137000000665256"}, {"id": "c1011", "company": "Shannon Packaging Company", "contact": "Damien Aldama", "phone": "909-591-8768", "email": "", "industry": "Broker", "address": "14375 Telephone Ave., Chino, CA 91710-5777", "zohoId": "zcrm_6566137000000665248"}, {"id": "c1012", "company": "Brain MD / Amen Clinics", "contact": "Daniel Pizeno", "phone": "949-556-4724 ext. 4727", "email": "", "industry": "Pharmaceutical / Supplements", "address": "959 South Coast Drive Suite 100, Costa Mesa, CA 92626", "zohoId": "zcrm_6566137000000665217"}, {"id": "c1013", "company": "Compass Business Solutions", "contact": "David Coronado", "phone": "909.556.8354", "email": "", "industry": "Other", "address": "1042 N. Mountain Ave. Suite B-606, Upland, CA 91786", "zohoId": "zcrm_6566137000000665218"}, {"id": "c1014", "company": "Nupla", "contact": "Ella Evans", "phone": "(601) 693-3482 ex.3603", "email": "", "industry": "Manufacturing", "address": "29 E Madison St. Ste 900, Chicago, IL 60602", "zohoId": "zcrm_6566137000000665237"}, {"id": "c1015", "company": "NuFYX", "contact": "Emily Smith", "phone": "(310) 940-1140", "email": "", "industry": "Pharmaceutical / Supplements", "address": "1901 Avenue of the Stars Suite 200, Los Angeles, CA 90067", "zohoId": "zcrm_6566137000000665236"}, {"id": "c1016", "company": "Hiya Health", "contact": "Evan Lynam", "phone": "332-239-2809", "email": "", "industry": "Pharmaceutical / Supplements", "address": "6454 E. Rogers Circle, Boca Raton, FL 33487", "zohoId": "zcrm_6566137000000665226"}, {"id": "c1017", "company": "SnackFarm", "contact": "Hardeep Sandhu", "phone": "(951)900-7450", "email": "", "industry": "Food/Beverage", "address": "1900 E Alessandro Blvd Unit 106, Riverside, CA 92508", "zohoId": "zcrm_6566137000000665249"}, {"id": "c1018", "company": "PACKAGING MADE EASY INC.", "contact": "Herbert Moosakanian", "phone": "", "email": "", "industry": "Broker", "address": "902 E Meda Ave, Glendora, CA 91741", "zohoId": "zcrm_6566137000000665238"}, {"id": "c1019", "company": "Box Printing Inc.", "contact": "Jack", "phone": "714-836-6881", "email": "", "industry": "Manufacturing", "address": "1701 E. Edinger Ave. Suite #E3, Santa Ana, CA 92705", "zohoId": "zcrm_6566137000000665216"}, {"id": "c1020", "company": "Delori-Nutifood Products Inc", "contact": "Jaime Brown", "phone": "", "email": "", "industry": "Food/Beverage", "address": "17043 Green Drive, City of Industry, CA 91745", "zohoId": "zcrm_6566137000000665222"}, {"id": "c1021", "company": "iMPAK Corporation", "contact": "Jennifer Torres", "phone": "(310) 715-6600 x214", "email": "", "industry": "Broker", "address": "13700 S Broadway, Los Angeles, CA 90061", "zohoId": "zcrm_6566137000000665227"}, {"id": "c1022", "company": "Red-Dot Packaging", "contact": "Jesse Alexander", "phone": "909-476-3545", "email": "", "industry": "Broker", "address": "3400 Inland Empire Blvd Ste 101, Ontario, CA 91764", "zohoId": "zcrm_6566137000000665244"}, {"id": "c1023", "company": "MatchaBar Bottling LLC", "contact": "Jose yulfo", "phone": "", "email": "", "industry": "Food/Beverage", "address": "79 West Street Suite 104, Brooklyn, NY 11222", "zohoId": "zcrm_6566137000000665232"}, {"id": "c1024", "company": "Precise Nutrition Int.", "contact": "Joseph Rodriguez", "phone": "760-347-4645 ext 2", "email": "", "industry": "Pharmaceutical / Supplements", "address": "44-300 Sun Gold St., Indio, CA 92201", "zohoId": "zcrm_6566137000000665240"}, {"id": "c1025", "company": "AOI Tea Company", "contact": "Kevin That", "phone": "714-841-2716 Ext. 405", "email": "", "industry": "Food/Beverage", "address": "16651 Gothard St. Unit M, Huntington Beach, CA 92647", "zohoId": "zcrm_6566137000000665215"}, {"id": "c1026", "company": "Kleen Concepts", "contact": "Leo Simpson", "phone": "480-515-5576", "email": "", "industry": "Broker", "address": "8388 E Hartford Dr Suite 105, Scottsdale, AZ 85255", "zohoId": "zcrm_6566137000000665229"}, {"id": "c1027", "company": "Keicha Tea World, Inc", "contact": "Mai Tran", "phone": "714-907-0030", "email": "", "industry": "Food/Beverage", "address": "18281 Gothard St. Unit 109, Huntington Beach, CA 92648", "zohoId": "zcrm_6566137000000665228"}, {"id": "c1028", "company": "Landsberg", "contact": "Matt Traynor", "phone": "9097705400", "email": "", "industry": "Broker", "address": "13397 Marlay Ave Ste A, Fontana, CA 92337", "zohoId": "zcrm_6566137000000665230"}, {"id": "c1029", "company": "Nature's Jeannie Inc.", "contact": "Michael Tataosian", "phone": "818.405.6914", "email": "", "industry": "Pharmaceutical / Supplements", "address": "2029 Verdugo Blvd. Suite #280, Montrose, CA 91020", "zohoId": "zcrm_6566137000000665235"}, {"id": "c1030", "company": "SOS CoPacking Solutions", "contact": "Michele Mullen", "phone": "562.408-4997", "email": "", "industry": "Co-packer", "address": "16386 Downey Ave, Paramount, CA 90723", "zohoId": "zcrm_6566137000000665250"}, {"id": "c1031", "company": "Multi Bag Manufacturing", "contact": "Mike Minami", "phone": "626-331-4500", "email": "", "industry": "Broker", "address": "864 E Edna Pl, Covina, CA 91723", "zohoId": "zcrm_6566137000000665233"}, {"id": "c1032", "company": "PSOURCE INTERNATIONAL, INC.", "contact": "Monchet Santos", "phone": "19096708662", "email": "", "industry": "Food/Beverage", "address": "4200 Chino Hills Parkway Suite 135, Chino Hills, CA 91709", "zohoId": "zcrm_6566137000000665242"}, {"id": "c1033", "company": "Green Revolution", "contact": "Nick Baccetti", "phone": "360-674-0176", "email": "", "industry": "Cannabis", "address": "22277 Stottlemeyer Road Northeast, Poulsbo, WA 98370", "zohoId": "zcrm_6566137000000665225"}, {"id": "c1034", "company": "Logical Resources", "contact": "Randy Ballou", "phone": "(760) 497-9690", "email": "", "industry": "Manufacturing", "address": "19925 Katy Way, Corona, CA 92881", "zohoId": "zcrm_6566137000000665231"}, {"id": "c1035", "company": "ROTO-LITHO SOUTH", "contact": "Richard Burkett", "phone": "213-810-3907", "email": "", "industry": "Broker", "address": "1415 San Marcos Road, Paso Robles, CA 93446", "zohoId": "zcrm_6566137000000665247"}, {"id": "c1036", "company": "Riverdale Investments, LLC", "contact": "Rusty Burkett", "phone": "(775) 225.4884", "email": "", "industry": "Broker", "address": "P. O. BOX 1099 - 155 RIVERDALE CR., Verdi, NV 89439", "zohoId": "zcrm_6566137000000665246"}, {"id": "c1037", "company": "Water For Living", "contact": "Sean McDonald", "phone": "800-940-3660", "email": "", "industry": "Food/Beverage", "address": "226 N Maple St, Corona, CA 92878", "zohoId": "zcrm_6566137000000665255"}, {"id": "c1038", "company": "Creative Packaging Group | Kelly Spicers Packaging", "contact": "Shavon Melendez", "phone": "714.403.9172", "email": "", "industry": "Broker", "address": "9111 E 47th Ave, Denver, Colorado 80238", "zohoId": "zcrm_6566137000000665220"}, {"id": "c1039", "company": "Proboost / Eastman Naturals", "contact": "Steve Paterson", "phone": "951-319-3105", "email": "", "industry": "Pharmaceutical / Supplements", "address": "41718 Eastman Dr., Murrieta, CA 92562", "zohoId": "zcrm_6566137000000665241"}, {"id": "c1040", "company": "Vinny NguyenDa Vien Coffee", "contact": "Tram Luu", "phone": "714-307-5618", "email": "", "industry": "Food/Beverage", "address": "9731 Bolsa Ave, Westminster, CA 92683", "zohoId": "zcrm_6566137000000665254"}, {"id": "c1041", "company": "DeveloPlus, Inc.", "contact": "Vicki Garrido", "phone": "951.738.8595 Ext. 209", "email": "", "industry": "Beauty / Cosmetics / haircare", "address": "1575 Magnolia Avenue, Corona, CA 92879", "zohoId": "zcrm_6566137000000665223"}, {"id": "c1042", "company": "Vaxa Technologies, Ltd.", "contact": "Yael Dvori", "phone": "1-831-419-9500", "email": "", "industry": "Pharmaceutical / Supplements", "address": "ZHR Industrial Zone, Rosh Pina, Israel 12000", "zohoId": "zcrm_6566137000000665253"}, {"id": "c1043", "company": "RDCL Superfoods, Inc.", "contact": "Zak Zaidman", "phone": "(310) 770-2785", "email": "", "industry": "Food/Beverage, Pharmaceutical / Supplements", "address": "10880 Wilshire Blvd. Suite 1101, Los Angeles, CA 90024", "zohoId": "zcrm_6566137000000665243"}, {"id": "c1047", "company": "VINCERO COLLECTIVE", "contact": "", "phone": "7276782797", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001534001"}, {"id": "c1048", "company": "Harmony Leaf", "contact": "", "phone": "516-864-6030", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001547001"}, {"id": "c1049", "company": "Type 7", "contact": "", "phone": "415-676-7419", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001547047"}, {"id": "c1050", "company": "Westridge Laboratories, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "1671 E Saint Andrew Pl, Santa Ana, California 92705", "zohoId": "zcrm_6566137000001555001"}, {"id": "c1051", "company": "Troov Energy", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001575162"}, {"id": "c1052", "company": "Hudson Valley Seed Company", "contact": "", "phone": "", "email": "", "industry": "", "address": "484 Mettacahonts Rd, Accord, New York 12404", "zohoId": "zcrm_6566137000001603003"}, {"id": "c1053", "company": "Arya Outrigger Strategy", "contact": "", "phone": "", "email": "", "industry": "", "address": "7700 Irvine Center Dr., Irvine, California 92618", "zohoId": "zcrm_6566137000001603017"}, {"id": "c1054", "company": "2 Soles, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "10250 Freeman Ave, Santa Fe Springs, California 90670", "zohoId": "zcrm_6566137000001603022"}, {"id": "c1055", "company": "360 Labs, Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "1101 Monterey Pass Rd, Monterey, California 91754", "zohoId": "zcrm_6566137000001603030"}, {"id": "c1056", "company": "4 and 1 Nutrition, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "12100 Wilshire Blvd, Los Angeles, California 90025", "zohoId": "zcrm_6566137000001603035"}, {"id": "c1057", "company": "420 Consulting", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603041"}, {"id": "c1058", "company": "4Excelsior", "contact": "", "phone": "", "email": "", "industry": "", "address": "1206 N Miller St. #D, Anaheim, California 92806", "zohoId": "zcrm_6566137000001603046"}, {"id": "c1059", "company": "91 and UP LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "2372 Morse Ave STE 533, Irvine, California 92614", "zohoId": "zcrm_6566137000001603070"}, {"id": "c1060", "company": "Aaron Thomas Company Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "7421 Chapman Ave, Garden Grove, California 92841", "zohoId": "zcrm_6566137000001603075"}, {"id": "c1061", "company": "ABC Hammers Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "7216 21st St. E, Sarasota, Florida 34243", "zohoId": "zcrm_6566137000001603083"}, {"id": "c1062", "company": "Acapulco's Ice Cream", "contact": "", "phone": "", "email": "", "industry": "", "address": "P.O. Box 206, Hawthorne, California 90251", "zohoId": "zcrm_6566137000001603088"}, {"id": "c1063", "company": "Action Nutraceuticals", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603093"}, {"id": "c1064", "company": "Action Point", "contact": "", "phone": "909-598-7844", "email": "", "industry": "", "address": "19310 San Jose Ave., City of Industry, California 91748", "zohoId": "zcrm_6566137000001603098"}, {"id": "c1065", "company": "Adcraft Labels", "contact": "", "phone": "714-776-1230", "email": "", "industry": "", "address": "1230 S. Sherman Ave, Anaheim, California 92805", "zohoId": "zcrm_6566137000001603109"}, {"id": "c1066", "company": "Advanced Aquaduck Systems", "contact": "", "phone": "", "email": "", "industry": "", "address": "6481 Boxsprings Blvd, Riverside, 92507 California", "zohoId": "zcrm_6566137000001603114"}, {"id": "c1067", "company": "Advanced Comestic Research Labs", "contact": "", "phone": "818-709-9945", "email": "", "industry": "", "address": "20550 Prairie St, Chatsworth, California 91311", "zohoId": "zcrm_6566137000001603119"}, {"id": "c1068", "company": "Aegle Nutrition", "contact": "", "phone": "", "email": "", "industry": "", "address": "1300 Hutton Dr., Suite 110, Carrolton, Texas 75006", "zohoId": "zcrm_6566137000001603127"}, {"id": "c1069", "company": "Aethics (Camos Medical)", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603132"}, {"id": "c1070", "company": "Aiya America", "contact": "", "phone": "", "email": "", "industry": "", "address": "386 Beech Ave. Unit B3, Torrance, California 92501", "zohoId": "zcrm_6566137000001603137"}, {"id": "c1071", "company": "AL Gusto Distribution", "contact": "", "phone": "", "email": "", "industry": "", "address": "7300 Scout Ave Unit B, Bell Gardens, California 90201", "zohoId": "zcrm_6566137000001603145"}, {"id": "c1072", "company": "Alpha Logistics", "contact": "", "phone": "", "email": "", "industry": "", "address": "28910 Sherman Ave, Valencia, California 91355", "zohoId": "zcrm_6566137000001603150"}, {"id": "c1073", "company": "Alpine Falls", "contact": "", "phone": "", "email": "", "industry": "", "address": "417 S. Associated Rd Suite 309, Brea, Calfornia 92821", "zohoId": "zcrm_6566137000001603155"}, {"id": "c1074", "company": "Alternative Labs", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Brain Gear Enterprises 2190 Kirkwood Ave, Naples, Florida 34112", "zohoId": "zcrm_6566137000001603160"}, {"id": "c1075", "company": "Alto Drink Co.", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603165"}, {"id": "c1076", "company": "Amaris Enterprise, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603170"}, {"id": "c1077", "company": "Ambary Gardens", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603175"}, {"id": "c1078", "company": "American Gourment Brands Corp", "contact": "", "phone": "", "email": "", "industry": "", "address": "103 Exchange Pl, Pomona, California 91768", "zohoId": "zcrm_6566137000001603180"}, {"id": "c1079", "company": "American Moda", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603185"}, {"id": "c1080", "company": "American Spraytech, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Tamelka Evans 205 Meister Ave, North Branch, New Jersey 8876", "zohoId": "zcrm_6566137000001603190"}, {"id": "c1081", "company": "Amethyst Beverage", "contact": "", "phone": "", "email": "", "industry": "", "address": "9120 Double Diamond Pkwy Suite 2070, Reno, Nevada 89251", "zohoId": "zcrm_6566137000001603195"}, {"id": "c1082", "company": "AMLU", "contact": "", "phone": "", "email": "", "industry": "", "address": "1200 S Lemon Ave, Walnut, Calfornia 91789", "zohoId": "zcrm_6566137000001603200"}, {"id": "c1083", "company": "Amy Tang Sir Owlverick's", "contact": "", "phone": "", "email": "", "industry": "", "address": "230 N Crescent Way, Unit D, Anaheim, California 92801", "zohoId": "zcrm_6566137000001603205"}, {"id": "c1084", "company": "Antidote Drinks", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603210"}, {"id": "c1085", "company": "APC", "contact": "", "phone": "", "email": "", "industry": "", "address": "3030 Flecther Dr, Los Angeles, Calfornia 90065", "zohoId": "zcrm_6566137000001603220"}, {"id": "c1086", "company": "APX Sport Drink", "contact": "", "phone": "", "email": "", "industry": "", "address": "PO Box 421212, San Diego, California 92142", "zohoId": "zcrm_6566137000001603225"}, {"id": "c1087", "company": "Aquablis Beverage", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603230"}, {"id": "c1088", "company": "Armada Nutrition", "contact": "", "phone": "", "email": "", "industry": "", "address": "4637 Port Royal Rd Melissa Tankerlsy, Spring Hill, Tennesee 37174", "zohoId": "zcrm_6566137000001603235"}, {"id": "c1089", "company": "Arminak Solutions DBA KBL", "contact": "", "phone": "", "email": "", "industry": "", "address": "475 N Sheridan St, Corona, Calfornia 92880", "zohoId": "zcrm_6566137000001603240"}, {"id": "c1090", "company": "Askinosie Chocolate", "contact": "", "phone": "", "email": "", "industry": "", "address": "514 E. Commerical St, Springfield, Missouri 65803", "zohoId": "zcrm_6566137000001603245"}, {"id": "c1091", "company": "Assemblies Unlimited", "contact": "", "phone": "", "email": "", "industry": "", "address": "143 Covington Dr, Blomingdale, Illinois 60108", "zohoId": "zcrm_6566137000001603250"}, {"id": "c1092", "company": "Full Spectrum", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Darren 490 3rd St, Lake Elsinore, California 92350", "zohoId": "zcrm_6566137000001603255"}, {"id": "c1093", "company": "Citragen Pharmaceuticals, INC", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Sathish Pattipati 3789 Spinnaker Court, Fremont, California 94538", "zohoId": "zcrm_6566137000001603260"}, {"id": "c1094", "company": "Avanza Skin", "contact": "", "phone": "", "email": "", "industry": "", "address": "242 W 61st 4A, New York, New York 10023", "zohoId": "zcrm_6566137000001603275"}, {"id": "c1095", "company": "Avenza", "contact": "", "phone": "", "email": "", "industry": "", "address": "83 Clemenceau Ave #10-01 UE SQUARE, Singapore,  239920", "zohoId": "zcrm_6566137000001603280"}, {"id": "c1096", "company": "B&C Skin Tight", "contact": "", "phone": "", "email": "", "industry": "", "address": "8459 White Oak Ave #101, Rancho Cucamonga, California 91730", "zohoId": "zcrm_6566137000001603288"}, {"id": "c1097", "company": "Balance Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "5743 Smithway Street, STE 103, Commerce, California 90040", "zohoId": "zcrm_6566137000001603293"}, {"id": "c1098", "company": "Banu Beverages, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "26565 Agora Road Suite 205, Calabasas, Calfornia 91302", "zohoId": "zcrm_6566137000001603298"}, {"id": "c1099", "company": "Baps Shayona", "contact": "", "phone": "", "email": "", "industry": "", "address": "15100 Fairfield Ranch Rd, Chino Hills, California 91709", "zohoId": "zcrm_6566137000001603303"}, {"id": "c1100", "company": "Barana", "contact": "", "phone": "", "email": "", "industry": "", "address": "302 Washington St Suite # 150-2979, San Diego, California 92013", "zohoId": "zcrm_6566137000001603308"}, {"id": "c1101", "company": "Barracuda Fitness", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603313"}, {"id": "c1102", "company": "Barrel of Fun Southwest", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attention: Jay Anderson, 7330 West Sherman St, Phoenix Arizona", "zohoId": "zcrm_6566137000001603318"}, {"id": "c1103", "company": "Bath Bomb Co.", "contact": "", "phone": "", "email": "", "industry": "", "address": "155 W Washington Blvd Stuie 728, Los Angeles, California 90015", "zohoId": "zcrm_6566137000001603323"}, {"id": "c1104", "company": "Bazaar Printing", "contact": "", "phone": "", "email": "", "industry": "", "address": "306 Boyd St, Los Angeles, California 90013", "zohoId": "zcrm_6566137000001603328"}, {"id": "c1105", "company": "BC Nutrition", "contact": "", "phone": "", "email": "", "industry": "", "address": "1100 W Town and Country Rd, STE 1250, Orange, California 92868", "zohoId": "zcrm_6566137000001603333"}, {"id": "c1106", "company": "Beachbody, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "3301 Exposition Blvd, Santa Monica, California 90404", "zohoId": "zcrm_6566137000001603341"}, {"id": "c1107", "company": "Bengal Fox", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603346"}, {"id": "c1108", "company": "Berkely International", "contact": "", "phone": "", "email": "", "industry": "", "address": "2725 East El Presidio St, Carson, California 90810", "zohoId": "zcrm_6566137000001603351"}, {"id": "c1109", "company": "Besame Comestics, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "3001 N San Fernando Blvd, Burbank, California 91504", "zohoId": "zcrm_6566137000001603356"}, {"id": "c1110", "company": "Best Formulations Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "17775 Rowland St, City of Industry, California 91748", "zohoId": "zcrm_6566137000001603361"}, {"id": "c1111", "company": "Beverage of West Coast", "contact": "", "phone": "", "email": "", "industry": "", "address": "813 Palmyrita CT, Riverside, California 92507", "zohoId": "zcrm_6566137000001603366"}, {"id": "c1112", "company": "BIC", "contact": "", "phone": "", "email": "", "industry": "", "address": "28481 Rancho California Rd #109, Temecula, California 92590", "zohoId": "zcrm_6566137000001603371"}, {"id": "c1113", "company": "Big Tree Farm Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "2305 Ashland Street, PMB 506 Ste C, Ashland, Oregon 97520", "zohoId": "zcrm_6566137000001603376"}, {"id": "c1114", "company": "Bikini Cleanse", "contact": "", "phone": "", "email": "", "industry": "", "address": "13127 Sherry Lane, Los Angeles, California 90049", "zohoId": "zcrm_6566137000001603381"}, {"id": "c1115", "company": "Blazing Beverages LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "230 E. Flamingo Rd Suite 109, Las Vegas, Nevada 89169", "zohoId": "zcrm_6566137000001603386"}, {"id": "c1116", "company": "Bluemark", "contact": "", "phone": "", "email": "", "industry": "", "address": "7400 Beverly Blvd, Los Angeles, California 90036", "zohoId": "zcrm_6566137000001603391"}, {"id": "c1117", "company": "BMA USA Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "7923 Gloria Ave, Van Nuys, California 91406", "zohoId": "zcrm_6566137000001603396"}, {"id": "c1118", "company": "BNC", "contact": "", "phone": "", "email": "", "industry": "", "address": "499 Canon Dr Suite 308/310, Beverly Hills, California 90210", "zohoId": "zcrm_6566137000001603404"}, {"id": "c1119", "company": "Boba Guys", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Mark Ifurung 245 Visitacion Ave, Brisbane, California 94005", "zohoId": "zcrm_6566137000001603409"}, {"id": "c1120", "company": "Bogg's Trail Foods, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "PO Box 11073, Portland, Oregon 97211", "zohoId": "zcrm_6566137000001603414"}, {"id": "c1121", "company": "Botan", "contact": "", "phone": "", "email": "", "industry": "", "address": "4470 W Sunset Blvd 107 #476, Los Angeles, California 90027", "zohoId": "zcrm_6566137000001603419"}, {"id": "c1122", "company": "Botoan", "contact": "", "phone": "", "email": "", "industry": "", "address": "2815 Back B Colorado Ave, Santa Monica, California 90404", "zohoId": "zcrm_6566137000001603424"}, {"id": "c1123", "company": "Boulder Botanical & BioScience Labs, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "1150 Catamount Dr, Golden, Colorado 90403", "zohoId": "zcrm_6566137000001603429"}, {"id": "c1124", "company": "Boundless", "contact": "", "phone": "", "email": "", "industry": "", "address": "7455 Arroyo Crossing, Las Vegas, Nevada 89113", "zohoId": "zcrm_6566137000001603434"}, {"id": "c1125", "company": "Brad Berry Company", "contact": "", "phone": "", "email": "", "industry": "", "address": "14020 Central Ave #580, Chino, California 91710", "zohoId": "zcrm_6566137000001603444"}, {"id": "c1126", "company": "Bragg Live Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "199 Winchester Dr, Santa Barbara, California 93117", "zohoId": "zcrm_6566137000001603452"}, {"id": "c1127", "company": "Brain Gear", "contact": "", "phone": "", "email": "", "industry": "", "address": "3035 Van Ness Ave, San Francisco, California 94109", "zohoId": "zcrm_6566137000001603457"}, {"id": "c1128", "company": "BrainGear/ Hakan Johanson US Natural Manufacturing Group, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "2151 Logan St, Clearwater, Florida 33765", "zohoId": "zcrm_6566137000001603462"}, {"id": "c1129", "company": "BrainMD", "contact": "", "phone": "", "email": "", "industry": "", "address": "1929 Main St. Suite 106, Irvine, California 92614", "zohoId": "zcrm_6566137000001603467"}, {"id": "c1130", "company": "Breakaway Matcha, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "128 San Anselmo Ave, San Anselmo, California 94960", "zohoId": "zcrm_6566137000001603472"}, {"id": "c1131", "company": "Brick and Mortat District", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Protec Labs 4300 FM2225, Quitman, Texas 75783", "zohoId": "zcrm_6566137000001603477"}, {"id": "c1132", "company": "Brite and Clean", "contact": "", "phone": "", "email": "", "industry": "", "address": "69930 Highway 111, Suite 209, Rancho Mirage, California 92270", "zohoId": "zcrm_6566137000001603482"}, {"id": "c1133", "company": "Bubble Universe, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "149 S Barrington 502, Brentwood, California 90049", "zohoId": "zcrm_6566137000001603487"}, {"id": "c1134", "company": "Buddy's Nut Butter", "contact": "", "phone": "", "email": "", "industry": "", "address": "2400 N 2nd Suite 400, Minneapolis, Minnesota 5541", "zohoId": "zcrm_6566137000001603492"}, {"id": "c1135", "company": "Built in China", "contact": "", "phone": "", "email": "", "industry": "", "address": "28481 Rancho California Rd Suite 109, Temecula, California 92590", "zohoId": "zcrm_6566137000001603497"}, {"id": "c1136", "company": "Bulletproof Digital", "contact": "", "phone": "", "email": "", "industry": "", "address": "1750 112th Avenue, NE Suite C-242, Bellevue, California 98004", "zohoId": "zcrm_6566137000001603502"}, {"id": "c1137", "company": "Burkett Services", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603507"}, {"id": "c1138", "company": "Buff Bake LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "21 Musick, Irvine, California 92618", "zohoId": "zcrm_6566137000001603512"}, {"id": "c1139", "company": "CAF LABS", "contact": "", "phone": "", "email": "", "industry": "", "address": "110 SE 6th STE 1700, Fort Lauderdale, Florida 33301", "zohoId": "zcrm_6566137000001603532"}, {"id": "c1140", "company": "Cafe Zal", "contact": "", "phone": "", "email": "", "industry": "", "address": "6000 S. Eastern Ave Ste # 11E, Las Vegas, Nevada 89119", "zohoId": "zcrm_6566137000001603537"}, {"id": "c1141", "company": "Calabasas Beauty Group", "contact": "", "phone": "", "email": "", "industry": "", "address": "23679 Calabasas Road Suite 953, Calabasas, California 91302", "zohoId": "zcrm_6566137000001603543"}, {"id": "c1142", "company": "California Custom Bottle", "contact": "", "phone": "", "email": "", "industry": "", "address": "813 Palmyrita Ave, Riverside, California 92507", "zohoId": "zcrm_6566137000001603548"}, {"id": "c1143", "company": "California Packaging Centers", "contact": "", "phone": "", "email": "", "industry": "", "address": "1140 South Rockefeller Ave, Ontario, California 91761", "zohoId": "zcrm_6566137000001603553"}, {"id": "c1144", "company": "California Snack Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "2131 N. Tyler Ave, South El Monte, California 91733", "zohoId": "zcrm_6566137000001603558"}, {"id": "c1145", "company": "California Unified", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603563"}, {"id": "c1146", "company": "CALO4NIA BEVERAGES", "contact": "", "phone": "", "email": "", "industry": "", "address": "321 S. Beverly Hills Dr, Beverly Hills, California 90212", "zohoId": "zcrm_6566137000001603568"}, {"id": "c1147", "company": "Canbest Botanik", "contact": "", "phone": "", "email": "", "industry": "", "address": "20885 Currier Road, Walnut, California 92501", "zohoId": "zcrm_6566137000001603573"}, {"id": "c1148", "company": "Candid Holdings LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "1507 7th St #64, Santa Monica, California 90401", "zohoId": "zcrm_6566137000001603578"}, {"id": "c1149", "company": "Canna Nano CBD", "contact": "", "phone": "", "email": "", "industry": "", "address": "13217 Jamboree Rd Suite 423, Tustin, California 92782", "zohoId": "zcrm_6566137000001603583"}, {"id": "c1150", "company": "Cannabis Global Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603588"}, {"id": "c1151", "company": "Capco Custom Packaging", "contact": "", "phone": "", "email": "", "industry": "", "address": "1530 W. 10th Place, Tempe, Arizona 85281", "zohoId": "zcrm_6566137000001603593"}, {"id": "c1152", "company": "Capco Labs", "contact": "", "phone": "", "email": "", "industry": "", "address": "10225 Greenleaf Ave, Sante Fe Springs, California 90670", "zohoId": "zcrm_6566137000001603598"}, {"id": "c1153", "company": "Captek Softgel International, Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "Natutac Corp. 16218 Arthur St, Cerritos, California 90703", "zohoId": "zcrm_6566137000001603603"}, {"id": "c1154", "company": "Cardenas", "contact": "", "phone": "", "email": "", "industry": "", "address": "2501 E Guasti Rd, Ontario, California 91761", "zohoId": "zcrm_6566137000001603608"}, {"id": "c1155", "company": "Caro-Nut Fresno HQ", "contact": "", "phone": "", "email": "", "industry": "", "address": "(West/Cherry Street) 2585 S Cherry Ave, Fresno, California 93760", "zohoId": "zcrm_6566137000001603613"}, {"id": "c1156", "company": "Carrington Farms", "contact": "", "phone": "", "email": "", "industry": "", "address": "7 Reuten Dr Building A, Closter, New Jersey 7624", "zohoId": "zcrm_6566137000001603618"}, {"id": "c1157", "company": "Catridgeus LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603623"}, {"id": "c1158", "company": "CBD Rehydrate", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001603628"}, {"id": "c1159", "company": "Consolidated Design West", "contact": "", "phone": "", "email": "", "industry": "", "address": "345 S. Lewis St, Anaheim, California 92805", "zohoId": "zcrm_6566137000001603633"}, {"id": "c1160", "company": "Adonis, INC", "contact": "", "phone": "951-432-3960", "email": "", "industry": "", "address": "475 N. Sheridan St, Corona, California 92880", "zohoId": "zcrm_6566137000001610083"}, {"id": "c1161", "company": "LAB3 Cometics", "contact": "", "phone": "818-581-5807", "email": "", "industry": "", "address": "9655 Irondale Ave, Chatsworth, California 91311", "zohoId": "zcrm_6566137000001610088"}, {"id": "c1162", "company": "All In Nutrition LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "21 Fairway Dr, Amherst, New Hampshire 3031", "zohoId": "zcrm_6566137000001610100"}, {"id": "c1163", "company": "Aqueous Labs", "contact": "", "phone": "", "email": "", "industry": "", "address": "3270 Post Rd, Las Vegas, Nevada 89118", "zohoId": "zcrm_6566137000001610105"}, {"id": "c1164", "company": "Arizona Granulation Tech", "contact": "", "phone": "", "email": "", "industry": "", "address": "156 N. Highley Ave, Mesa, Arizona 85205", "zohoId": "zcrm_6566137000001610110"}, {"id": "c1165", "company": "ATCO Chem Pack", "contact": "", "phone": "", "email": "", "industry": "", "address": "14102 Willow Lane, Westminster, California 92683", "zohoId": "zcrm_6566137000001610115"}, {"id": "c1166", "company": "Axon", "contact": "", "phone": "", "email": "", "industry": "", "address": "3080 Business Park Drive Suite 103, Raleigh, North Carolina 27610", "zohoId": "zcrm_6566137000001610120"}, {"id": "c1167", "company": "Bakery Barn, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "111 Terence Dr, Pittsburgh, Pennsylvania 15236", "zohoId": "zcrm_6566137000001610125"}, {"id": "c1168", "company": "Baxco Pharmaceutical", "contact": "", "phone": "", "email": "", "industry": "", "address": "2393 Bateman Ave, Irwindale, California 91010", "zohoId": "zcrm_6566137000001610130"}, {"id": "c1169", "company": "BBC Wellness", "contact": "", "phone": "", "email": "", "industry": "", "address": "482 W. San Ysidro Blvd #910, San Ysidro, California 92173", "zohoId": "zcrm_6566137000001610135"}, {"id": "c1170", "company": "BC Nutrition, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "1407 N. Batavia St, Ste. 115, Orange, California 92687", "zohoId": "zcrm_6566137000001610140"}, {"id": "c1171", "company": "Belmont Confections", "contact": "", "phone": "", "email": "", "industry": "", "address": "1598 Motor Inn Dr, Girard, Ohio 44420", "zohoId": "zcrm_6566137000001610145"}, {"id": "c1174", "company": "Ben Szilagyi", "contact": "", "phone": "", "email": "", "industry": "", "address": "627 California Ave Front Unit, Venice, California 90291", "zohoId": "zcrm_6566137000001610196"}, {"id": "c1175", "company": "BLK International LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "26565 West Agoura Rd, Calabasa, California 91302", "zohoId": "zcrm_6566137000001610201"}, {"id": "c1176", "company": "Body Nutrition", "contact": "", "phone": "", "email": "", "industry": "", "address": "2950 47th Ave N, St. Petersburg, Florida 33714", "zohoId": "zcrm_6566137000001610206"}, {"id": "c1177", "company": "Boyd Specialties, LLC", "contact": "", "phone": "909-219-5120", "email": "", "industry": "", "address": "Attn: Paleo Ranch 1016 East Cooley Dr, Suite N, Colton, California 92324", "zohoId": "zcrm_6566137000001610211"}, {"id": "c1178", "company": "Brooks Norris", "contact": "", "phone": "", "email": "", "industry": "", "address": "2301 Via Platillo, Carlsbad, California 92009", "zohoId": "zcrm_6566137000001610216"}, {"id": "c1179", "company": "Buff Bake", "contact": "", "phone": "", "email": "", "industry": "", "address": "3643 E. Post Rd, Las Vegas, Nevada 89120", "zohoId": "zcrm_6566137000001610224"}, {"id": "c1183", "company": "CA Signs", "contact": "", "phone": "", "email": "", "industry": "", "address": "10280 Glenoaks Blvd, Pacoima, California 91331", "zohoId": "zcrm_6566137000001610251"}, {"id": "c1184", "company": "Cali Kush", "contact": "", "phone": "", "email": "", "industry": "", "address": "15759 Strathern St, Van Nuys, California 91406", "zohoId": "zcrm_6566137000001610256"}, {"id": "c1185", "company": "Canyon Plastics, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "284 Livingston Ave, Valencia, California 91355", "zohoId": "zcrm_6566137000001610261"}, {"id": "c1186", "company": "Carboy, Angelos Taverna & Carboy Winery LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "6885 S Santa Fe Dr, Littleton, Colorado 80120", "zohoId": "zcrm_6566137000001610269"}, {"id": "c1187", "company": "Carnivore Bar Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Phillip Meece 1780 Lindberg Dr, Columbia, Misourri 65201", "zohoId": "zcrm_6566137000001610274"}, {"id": "c1188", "company": "Casestack-Ontario, CA", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ States Logistics 5590 E Francis St, Ontario, California 91761", "zohoId": "zcrm_6566137000001610289"}, {"id": "c1189", "company": "Castle and Cook Cold Storage", "contact": "", "phone": "", "email": "", "industry": "", "address": "2323 Port Road A, Stockton, California 95201", "zohoId": "zcrm_6566137000001610294"}, {"id": "c1190", "company": "CBD Nationwide", "contact": "", "phone": "", "email": "", "industry": "", "address": "1275 Linda Vista Dr, San Marcos, California 92078", "zohoId": "zcrm_6566137000001610299"}, {"id": "c1191", "company": "Chalice Farms/ Golden Leaf", "contact": "", "phone": "", "email": "", "industry": "", "address": "ATTN: Major Sample Material 13339 NE Airport Way Suite 400, Portland, Oregon 97230", "zohoId": "zcrm_6566137000001610304"}, {"id": "c1192", "company": "Chalyce LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "1479 Los Amigos, Fallbrook, California 92028", "zohoId": "zcrm_6566137000001610309"}, {"id": "c1193", "company": "Chef Jay", "contact": "", "phone": "", "email": "", "industry": "", "address": "3642 E Post Rd, Las Vegas, Nevada 89120", "zohoId": "zcrm_6566137000001610314"}, {"id": "c1194", "company": "Chill Water", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610319"}, {"id": "c1195", "company": "Choice Laboratories", "contact": "", "phone": "", "email": "", "industry": "", "address": "4499 Phelps Dr, Jackson, Michigan 49201", "zohoId": "zcrm_6566137000001610324"}, {"id": "c1196", "company": "Chosen Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "453 54th St Suite 102, San Diego, California 92114", "zohoId": "zcrm_6566137000001610329"}, {"id": "c1197", "company": "Circular Centric Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "12080 Magnolia Ave, Riverside, California 92503", "zohoId": "zcrm_6566137000001610334"}, {"id": "c1198", "company": "Citrisco International Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "PO Box 90723, Industry, California 91715", "zohoId": "zcrm_6566137000001610339"}, {"id": "c1199", "company": "Citrus Plus Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "7209 Jurupa Ave, Riverside, California 92504", "zohoId": "zcrm_6566137000001610344"}, {"id": "c1200", "company": "Classic Cosmestics, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "9520 De Soto Ave, Chatsworth, California 91311", "zohoId": "zcrm_6566137000001610349"}, {"id": "c1201", "company": "Clean Hands Partners", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610354"}, {"id": "c1202", "company": "Cloudpen", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610366"}, {"id": "c1203", "company": "CLS", "contact": "", "phone": "", "email": "", "industry": "", "address": "4881 E. Airport Dr, Ontario, California 91761", "zohoId": "zcrm_6566137000001610371"}, {"id": "c1204", "company": "Colonial Enterprises", "contact": "", "phone": "", "email": "", "industry": "", "address": "1645 West Park Ave, Redlands, California 92373", "zohoId": "zcrm_6566137000001610376"}, {"id": "c1205", "company": "Coastal California Bottling, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610381"}, {"id": "c1206", "company": "Colorado Kitchen Share", "contact": "", "phone": "", "email": "", "industry": "", "address": "12189 Pennsylvania St, Thornton, Colorado 80241", "zohoId": "zcrm_6566137000001610386"}, {"id": "c1207", "company": "Coconut Girl", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Evolving Kneads Bakery 7432 Fulton Ave, North Hollywood, California 91605", "zohoId": "zcrm_6566137000001610391"}, {"id": "c1208", "company": "ColourPop Comestics, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "1600 Westar Dr, Oxnard, California 93033", "zohoId": "zcrm_6566137000001610396"}, {"id": "c1209", "company": "Coffee Blocks", "contact": "", "phone": "", "email": "", "industry": "", "address": "350 N Glenoaks #306, Burbank, California 91502", "zohoId": "zcrm_6566137000001610401"}, {"id": "c1210", "company": "Concord City Corp", "contact": "", "phone": "", "email": "", "industry": "", "address": "623 Doubleday Ave, Ontario, California 91761", "zohoId": "zcrm_6566137000001610409"}, {"id": "c1211", "company": "Contract Label Services", "contact": "", "phone": "", "email": "", "industry": "", "address": "4881 E Airport Dr, Ontario, California 91761", "zohoId": "zcrm_6566137000001610414"}, {"id": "c1212", "company": "CosmoBeauti Lab", "contact": "", "phone": "909-971-9832", "email": "", "industry": "", "address": "480 E Arrow Highway, San Dimas, California 91773", "zohoId": "zcrm_6566137000001610419"}, {"id": "c1213", "company": "Coupang", "contact": "", "phone": "", "email": "", "industry": "", "address": "1560 Sierra Ridge, Riverside, California 92507", "zohoId": "zcrm_6566137000001610424"}, {"id": "c1214", "company": "Covenance Manufacturing", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Barfections, LLC Attn: Scott Elliot 970 Hwy 127 N, Owenton, Kentucky 40359", "zohoId": "zcrm_6566137000001610429"}, {"id": "c1215", "company": "Comfort Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "9900 Montgomery Blvd NE, Albuquerque, New Mexico 87111", "zohoId": "zcrm_6566137000001610441"}, {"id": "c1216", "company": "Commtech", "contact": "", "phone": "", "email": "", "industry": "", "address": "6375 S Pecos Rd Suite 216, Las Vegas, Nevada 89120", "zohoId": "zcrm_6566137000001610446"}, {"id": "c1217", "company": "Custom Co-Pak, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "3737-39 Frankford Ave, Philadelphia, Pennsylvania 19124", "zohoId": "zcrm_6566137000001610454"}, {"id": "c1218", "company": "CultSkin Apothecary Inc. (DBA Dieux)", "contact": "", "phone": "", "email": "", "industry": "", "address": "10 Suydam Street Apt 1, Brooklyn, New York 11221", "zohoId": "zcrm_6566137000001610462"}, {"id": "c1219", "company": "Cymbiotika", "contact": "", "phone": "", "email": "", "industry": "", "address": "3394 Carmel Mountain R Suite 140, San Diego, California 92121", "zohoId": "zcrm_6566137000001610467"}, {"id": "c1220", "company": "D's Naturals", "contact": "", "phone": "", "email": "", "industry": "", "address": "6125 East Kemper Road Suite 100, Cincinnati, Ohio 45241", "zohoId": "zcrm_6566137000001610472"}, {"id": "c1221", "company": "Dal-Tile Corporation", "contact": "", "phone": "", "email": "", "industry": "", "address": "3625 E Jurupa St, Ontario, California 91761", "zohoId": "zcrm_6566137000001610480"}, {"id": "c1222", "company": "Dang Foods LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "3254 Adeline Street Suite 210, Berkeley, California 94730", "zohoId": "zcrm_6566137000001610485"}, {"id": "c1223", "company": "Dar Chocolate", "contact": "", "phone": "", "email": "", "industry": "", "address": "12189 Pennsylvania St, Denver, Colorado 80241-3115", "zohoId": "zcrm_6566137000001610490"}, {"id": "c1224", "company": "Continental Chemical", "contact": "", "phone": "", "email": "", "industry": "", "address": "4920 E Washington Blvd, City of Commerce, California 90040", "zohoId": "zcrm_6566137000001610495"}, {"id": "c1225", "company": "Dardimans", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610508"}, {"id": "c1226", "company": "Derma E", "contact": "", "phone": "800-521-3342", "email": "", "industry": "", "address": "2130 Ward Ave, Simi Valley, California 93065", "zohoId": "zcrm_6566137000001610520"}, {"id": "c1227", "company": "Diamond Wipes", "contact": "", "phone": "", "email": "", "industry": "", "address": "4651 Schaefer Ave, Chino, California 91710", "zohoId": "zcrm_6566137000001610528"}, {"id": "c1228", "company": "Distinctive Manufacturing", "contact": "", "phone": "", "email": "", "industry": "", "address": "Light Up The World 4140 Garner Rd, Riverside, California 92501", "zohoId": "zcrm_6566137000001610533"}, {"id": "c1229", "company": "DIXIE Brands, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "20 Quail Run Circle, Salinas, California 93907", "zohoId": "zcrm_6566137000001610538"}, {"id": "c1230", "company": "DM Natural Products, Inc. /dba Huo Naturals", "contact": "", "phone": "", "email": "", "industry": "", "address": "21800 Nordhoff St, Chatsworth, California 91311-5913", "zohoId": "zcrm_6566137000001610546"}, {"id": "c1231", "company": "Don Picoso", "contact": "", "phone": "", "email": "", "industry": "", "address": "679 Anita St Suite C, Chula Vista, California 91911", "zohoId": "zcrm_6566137000001610551"}, {"id": "c1232", "company": "Dope Packaging, Ltd", "contact": "", "phone": "", "email": "", "industry": "", "address": "306 S Lookout Mountain Road Ste C, Golden, Colorado 80401", "zohoId": "zcrm_6566137000001610556"}, {"id": "c1233", "company": "Donny Makower", "contact": "", "phone": "", "email": "", "industry": "", "address": "1902 Midvale Ave, Los Angeles, California 90025", "zohoId": "zcrm_6566137000001610561"}, {"id": "c1234", "company": "DG Packaging", "contact": "", "phone": "", "email": "", "industry": "", "address": "11374 Industrial Way, Forney, Texas 75126", "zohoId": "zcrm_6566137000001610566"}, {"id": "c1235", "company": "Divine Bovine", "contact": "", "phone": "760-202-3015", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610571"}, {"id": "c1236", "company": "Dhaliwal Labs", "contact": "", "phone": "", "email": "", "industry": "", "address": "5202 W. 70th Place, Chicago, Illinois 60638", "zohoId": "zcrm_6566137000001610576"}, {"id": "c1237", "company": "Diasan Corporation", "contact": "", "phone": "", "email": "", "industry": "", "address": "119 S 1680 W, Orem, Utah 84058", "zohoId": "zcrm_6566137000001610581"}, {"id": "c1238", "company": "Drews LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: John Cummings 926 Vermont RT 103 South, Chester, Vermont 5143", "zohoId": "zcrm_6566137000001610586"}, {"id": "c1239", "company": "Drink Hab, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "4080 Glencoe Ave Unit 410, Marina Del Rey, California 90292", "zohoId": "zcrm_6566137000001610603"}, {"id": "c1240", "company": "Zero Day Nutrition", "contact": "", "phone": "", "email": "", "industry": "", "address": "12502 Exchange Dr Ste 448, Stafford, Texas 77477", "zohoId": "zcrm_6566137000001610608"}, {"id": "c1241", "company": "Dynapack Co", "contact": "", "phone": "442-222-6045", "email": "", "industry": "", "address": "960 Camino La Paz, Chula Vista, California 91910", "zohoId": "zcrm_6566137000001610613"}, {"id": "c1242", "company": "Eden Equipment / PO20001352", "contact": "", "phone": "", "email": "", "industry": "", "address": "6231 E. Stassney Lane Bldg 12 Unit 100, Austin, Texas 78744", "zohoId": "zcrm_6566137000001610618"}, {"id": "c1243", "company": "Edibiology", "contact": "", "phone": "", "email": "", "industry": "", "address": "8640 SE Causey Ave, L304, Happy Valley, Oregon 97086", "zohoId": "zcrm_6566137000001610623"}, {"id": "c1244", "company": "EFFI Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "11260 Wilshire Blvd Suite #900, Los Angeles, California 90025", "zohoId": "zcrm_6566137000001610628"}, {"id": "c1245", "company": "EFX Performance Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "26022 Pala Ave, Mission Viejo, California 92961", "zohoId": "zcrm_6566137000001610633"}, {"id": "c1246", "company": "Empowered Products", "contact": "", "phone": "", "email": "", "industry": "", "address": "3367 Oquendo Road, Las Vegas, Nevada 89118", "zohoId": "zcrm_6566137000001610638"}, {"id": "c1247", "company": "Everson Spice Co.", "contact": "", "phone": "", "email": "", "industry": "", "address": "2667 Gundry Ave, Signal Hill, California 90755", "zohoId": "zcrm_6566137000001610643"}, {"id": "c1248", "company": "EXPRESS LINE for Nutrition International Co", "contact": "", "phone": "", "email": "", "industry": "", "address": "901 W Arbor Vitae St, Inglewood, California 90301", "zohoId": "zcrm_6566137000001610648"}, {"id": "c1249", "company": "EHK Printing Solutions", "contact": "", "phone": "", "email": "", "industry": "", "address": "2020 Huntington Lane, Redondo Beach, California 90278", "zohoId": "zcrm_6566137000001610653"}, {"id": "c1250", "company": "Elite Ops", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Saraya Canada 400 E Highway 6, Spanish Fork, Utah 84660", "zohoId": "zcrm_6566137000001610658"}, {"id": "c1251", "company": "Edward & Sons", "contact": "", "phone": "", "email": "", "industry": "", "address": "P.O. Box 1326, Carpinteria, California 93014", "zohoId": "zcrm_6566137000001610663"}, {"id": "c1252", "company": "Ed Padel", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610668"}, {"id": "c1253", "company": "Eat Play Crush, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "4572 Via Marina #310, Marina Del Rey, California 90292", "zohoId": "zcrm_6566137000001610673"}, {"id": "c1254", "company": "Essential Beverage", "contact": "", "phone": "", "email": "", "industry": "", "address": "PO Box 568, Southeastern, Pennsylvania 19399", "zohoId": "zcrm_6566137000001610678"}, {"id": "c1255", "company": "Essential Beverage Company", "contact": "", "phone": "", "email": "", "industry": "", "address": "3651 Lindell Road Suite D533, Las Vegas, Nevada 89103", "zohoId": "zcrm_6566137000001610683"}, {"id": "c1256", "company": "Everly, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "105 Broadway Suite 200, Nashville, Tennesee 37201", "zohoId": "zcrm_6566137000001610688"}, {"id": "c1257", "company": "Evolve Biosystems INC", "contact": "", "phone": "", "email": "", "industry": "", "address": "2121 2nd St Suite B107, Davis, California 95618", "zohoId": "zcrm_6566137000001610693"}, {"id": "c1258", "company": "Famous Ramona Water", "contact": "", "phone": "", "email": "", "industry": "", "address": "250 Aqua Lane, Ramona, California 92065", "zohoId": "zcrm_6566137000001610698"}, {"id": "c1259", "company": "Nutrition Int'l Co", "contact": "", "phone": "562-633-3777", "email": "", "industry": "", "address": "P.O Box 50632, Irvine, California 92619", "zohoId": "zcrm_6566137000001610703"}, {"id": "c1260", "company": "Fermalife", "contact": "", "phone": "", "email": "", "industry": "", "address": "21660 Copley Drive #180, Diamond Bar, California 91765", "zohoId": "zcrm_6566137000001610714"}, {"id": "c1261", "company": "Fantasy Cookie Corp", "contact": "", "phone": "", "email": "", "industry": "", "address": "12400 Gladstone Ave, Slymar, California 91342", "zohoId": "zcrm_6566137000001610722"}, {"id": "c1262", "company": "Fat Molly's Kitchen", "contact": "", "phone": "", "email": "", "industry": "", "address": "780 Hollister St, San Diego, California 92154", "zohoId": "zcrm_6566137000001610727"}, {"id": "c1263", "company": "Flora + Bast", "contact": "", "phone": "310-387-9292", "email": "", "industry": "", "address": "Attn: Derek Chase 9615 Brighton Way #301, Beverly Hills, California 90210", "zohoId": "zcrm_6566137000001610732"}, {"id": "c1264", "company": "Four Season Beverage", "contact": "", "phone": "", "email": "", "industry": "", "address": "4130 Garner Road, Riverside, California 92501", "zohoId": "zcrm_6566137000001610750"}, {"id": "c1265", "company": "FoxFire Organics", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001610755"}, {"id": "c1266", "company": "Fresca Foods Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "195 CTC Blvd, Louisville, Colorado 80027-31440", "zohoId": "zcrm_6566137000001610760"}, {"id": "c1267", "company": "Funguy Fungtional, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "333 Washington Blvd #228, Marina Del Rey, California 90292", "zohoId": "zcrm_6566137000001610774"}, {"id": "c1268", "company": "Funrise Distribution Company", "contact": "", "phone": "", "email": "", "industry": "", "address": "1450 E Mission Blvd, Ontario, California 91761", "zohoId": "zcrm_6566137000001610779"}, {"id": "c1269", "company": "Folona LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "675 North Euclid St Ste 472, Anaheim, California 92801", "zohoId": "zcrm_6566137000001610787"}, {"id": "c1270", "company": "Frankly Natural", "contact": "", "phone": "", "email": "", "industry": "", "address": "7740 Formula Place, San Diego, California 92121", "zohoId": "zcrm_6566137000001610792"}, {"id": "c1271", "company": "Freedom Free Brands LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "4350 Arville St Suite 400, Las Vegas, Nevada 89103", "zohoId": "zcrm_6566137000001610797"}, {"id": "c1272", "company": "Fresh Gourmet Cuisine", "contact": "", "phone": "", "email": "", "industry": "", "address": "19431 Business Center Dr #35, Northridge, California 91324", "zohoId": "zcrm_6566137000001610802"}, {"id": "c1273", "company": "Funnel Energy", "contact": "", "phone": "", "email": "", "industry": "", "address": "1760 Avenida Del Mundo #803, Coronado, California 92118", "zohoId": "zcrm_6566137000001610807"}, {"id": "c1274", "company": "Galaxy Deserts", "contact": "", "phone": "510-439-3160", "email": "", "industry": "", "address": "1100 Marina Way South ste D, Richmond, California 94804", "zohoId": "zcrm_6566137000001610812"}, {"id": "c1275", "company": "Nufyx Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "1901 Avenue of the Stars ste 200, Los Angeles, California 90067", "zohoId": "zcrm_6566137000001612171"}, {"id": "c1276", "company": "Vibe CPG", "contact": "", "phone": "201-463-0846", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001612193"}, {"id": "c1277", "company": "Gallany", "contact": "", "phone": "818-773-9042", "email": "", "industry": "", "address": "9533 Irondale Ave, C, California 91311", "zohoId": "zcrm_6566137000001635007"}, {"id": "c1278", "company": "GAR Labs Inc Gar Labs, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "1844 Massachusetts Ave, Riverside, California 92507", "zohoId": "zcrm_6566137000001635024"}, {"id": "c1279", "company": "Gargo Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "2434 Seaman Ave, South El Monte, California 91733", "zohoId": "zcrm_6566137000001635035"}, {"id": "c1280", "company": "Gen Labs", "contact": "", "phone": "", "email": "", "industry": "", "address": "5568 Schaefer Ave, Chino, California 91710", "zohoId": "zcrm_6566137000001635040"}, {"id": "c1281", "company": "Geoff Harmann, Critical Mass Group", "contact": "", "phone": "", "email": "", "industry": "", "address": "215 Pier Ave Ste. C, Hermosa Beach, California 90254", "zohoId": "zcrm_6566137000001635045"}, {"id": "c1282", "company": "Golden Specialty Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "1460 Best Avenue, Norwalk, California 90650", "zohoId": "zcrm_6566137000001635050"}, {"id": "c1283", "company": "Gopal's Health Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "800 CR 125, Sidney, Texas 76474", "zohoId": "zcrm_6566137000001635055"}, {"id": "c1284", "company": "Gramercy Bakery", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Tone It Up 20405 B Gramercy Pl, Torrance, California 90501-1514", "zohoId": "zcrm_6566137000001635060"}, {"id": "c1285", "company": "Genco Pura Oil Company, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "150 Wappoo Creek Dr Ste # 3, Charleston, South Carolina 29412", "zohoId": "zcrm_6566137000001635076"}, {"id": "c1286", "company": "Go Lo Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "14662 Franklin Ave Suite A, Tustin, California 92780", "zohoId": "zcrm_6566137000001635081"}, {"id": "c1287", "company": "GoBox", "contact": "", "phone": "", "email": "", "industry": "", "address": "848 Rainbow Blvd #1072, Las Vegas, Nevada 89103", "zohoId": "zcrm_6566137000001635086"}, {"id": "c1288", "company": "GOHYDR8", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001635091"}, {"id": "c1289", "company": "GPS Associates, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "614 Elmhurst Ct, Sugar Land, Texas 77479", "zohoId": "zcrm_6566137000001635096"}, {"id": "c1290", "company": "Great West Water", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001635101"}, {"id": "c1291", "company": "Green Earth Labs, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "15131 Woodlawn Ave, Tustin, California 92780", "zohoId": "zcrm_6566137000001635106"}, {"id": "c1292", "company": "Green Foods Corp", "contact": "", "phone": "", "email": "", "industry": "", "address": "PO Box 2069, Rancho Cucamonga, California 91729", "zohoId": "zcrm_6566137000001635111"}, {"id": "c1293", "company": "Green Guru Nutrition", "contact": "", "phone": "", "email": "", "industry": "", "address": "340 S. Lemon Ave #9474, Walnut, California 91789", "zohoId": "zcrm_6566137000001635116"}, {"id": "c1294", "company": "Green Planet", "contact": "", "phone": "", "email": "", "industry": "", "address": "7260 Sycamore Canyon Blvd, Riverside, California 92508", "zohoId": "zcrm_6566137000001642014"}, {"id": "c1295", "company": "GT System", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001642019"}, {"id": "c1296", "company": "Hai Tea Co", "contact": "", "phone": "", "email": "", "industry": "", "address": "887 W Marietta St NW Unit S-108, Atlanta, Goergia 30318", "zohoId": "zcrm_6566137000001642024"}, {"id": "c1297", "company": "Handcart Studios LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "2385 Precision Dr, Arroyo Grande, California 93420", "zohoId": "zcrm_6566137000001642029"}, {"id": "c1298", "company": "Hans Drake International", "contact": "", "phone": "", "email": "", "industry": "", "address": "17742 Mitchell Suite B, Irvine, Calfornia 92614", "zohoId": "zcrm_6566137000001642034"}, {"id": "c1299", "company": "HealthSource International, Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "1785 Erika Way, Upland, California 91784", "zohoId": "zcrm_6566137000001642039"}, {"id": "c1300", "company": "Heartland Label Printers LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "9817 7TH Suite 703, Rancho Cucamonga, California 91730-7802", "zohoId": "zcrm_6566137000001642047"}, {"id": "c1301", "company": "Helias LLC/OYA", "contact": "", "phone": "", "email": "", "industry": "", "address": "5701 Buckingham Pkwy Suite F, Culver City, California 90230", "zohoId": "zcrm_6566137000001642052"}, {"id": "c1302", "company": "Hemp Hydrate International Holdings Ltd.", "contact": "", "phone": "", "email": "", "industry": "", "address": "102-2071 Kingsway Ave, Port Coquitlam BC, V3C6N2", "zohoId": "zcrm_6566137000001642057"}, {"id": "c1303", "company": "Hemp White Label Co.", "contact": "", "phone": "", "email": "", "industry": "", "address": "3303 Harbor Blvd, Suite F, Costa Mesa, California 92626", "zohoId": "zcrm_6566137000001642065"}, {"id": "c1304", "company": "Hempistry", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001642070"}, {"id": "c1305", "company": "Hemplify", "contact": "", "phone": "310-943-9811", "email": "", "industry": "", "address": "3435 Ocean park Blvd #107-701, Santa Monica, California 90405", "zohoId": "zcrm_6566137000001642075"}, {"id": "c1306", "company": "Herbal Cup", "contact": "", "phone": "310-562-1106", "email": "", "industry": "", "address": "12815 Halldale Ave, Gardena, California 90249", "zohoId": "zcrm_6566137000001642080"}, {"id": "c1307", "company": "Herbal Groups Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "9413 Vanalden Ave, Northridge, California 91324", "zohoId": "zcrm_6566137000001642085"}, {"id": "c1308", "company": "Herbal Pro Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "6185 Magnolia Ave #356, RIverside, California 92506", "zohoId": "zcrm_6566137000001642090"}, {"id": "c1309", "company": "Hoyu America Co.", "contact": "", "phone": "", "email": "", "industry": "", "address": "6265 Phyllis Dr, Cypress, California 90630", "zohoId": "zcrm_6566137000001642095"}, {"id": "c1311", "company": "Hydrant Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "205 Hydson St Floor 7, New York, New York 10013", "zohoId": "zcrm_6566137000001642108"}, {"id": "c1312", "company": "Hampton Farms Added Value West", "contact": "", "phone": "", "email": "", "industry": "", "address": "42593 UA HWY 70, Portales, New Mexico 88130", "zohoId": "zcrm_6566137000001642113"}, {"id": "c1313", "company": "Healthy Coffee", "contact": "", "phone": "925-250-2620", "email": "", "industry": "", "address": "6902 Pattersonpass Rd Suite H, Livermore, California 94550", "zohoId": "zcrm_6566137000001642118"}, {"id": "c1314", "company": "Health Cup", "contact": "", "phone": "", "email": "", "industry": "", "address": "12815 Halldale Ave, Gardena, 90249 California", "zohoId": "zcrm_6566137000001642123"}, {"id": "c1315", "company": "Hope Science", "contact": "", "phone": "", "email": "", "industry": "", "address": "1313 Ynex Place, Coronado, California 92118", "zohoId": "zcrm_6566137000001642128"}, {"id": "c1316", "company": "Houwellings Nursuries", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Jose Quiroz 645 West Laguna Road, Camarillo, California 93012", "zohoId": "zcrm_6566137000001642133"}, {"id": "c1317", "company": "Hugh & Grace, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "3755 E Post Rd Ste 100, Las Vegas, California 89120", "zohoId": "zcrm_6566137000001642138"}, {"id": "c1318", "company": "Hunter Project Facilities", "contact": "", "phone": "", "email": "", "industry": "", "address": "2428 Hunter Street, Los Angeles, California 90021", "zohoId": "zcrm_6566137000001642143"}, {"id": "c1319", "company": "Ingennus Healthcare Nutrition", "contact": "", "phone": "4.41223E+11", "email": "", "industry": "", "address": "St. Johns Innovation Center, Cambride,  CB40WS", "zohoId": "zcrm_6566137000001642148"}, {"id": "c1320", "company": "Ikeda Tea World, Inc.", "contact": "", "phone": "714-907-0030", "email": "", "industry": "", "address": "18281 Gothard St. Unit 109, Huntington Beach, California 92648", "zohoId": "zcrm_6566137000001642156"}, {"id": "c1321", "company": "Ikeda Seicha Co. Ltd", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Nobuaki Kagohara 3-11 Nanei, Kagoshima City, Kagoshima Prefecture 891-0122", "zohoId": "zcrm_6566137000001642162"}, {"id": "c1322", "company": "IMPAK", "contact": "", "phone": "", "email": "", "industry": "", "address": "13700 S Broadway, Los Angeles, California 90061", "zohoId": "zcrm_6566137000001642167"}, {"id": "c1323", "company": "Indian Groceries & Spices", "contact": "", "phone": "", "email": "", "industry": "", "address": "5910 Corvette St., Corona, California 90040", "zohoId": "zcrm_6566137000001642172"}, {"id": "c1324", "company": "Innomark Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "Nadia Anguiano 982 East Factory Dr, St. George, Utah 84790", "zohoId": "zcrm_6566137000001642177"}, {"id": "c1325", "company": "Innovative Skincare", "contact": "", "phone": "818-638-8758", "email": "", "industry": "", "address": "3333 N. San Fernando Blvd, Burbank, California 91504", "zohoId": "zcrm_6566137000001642185"}, {"id": "c1326", "company": "Infuzionz", "contact": "", "phone": "", "email": "", "industry": "", "address": "4410 Washington St, Denver, Colorado 80216", "zohoId": "zcrm_6566137000001642193"}, {"id": "c1327", "company": "Innovix Pharmacy, Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "3994 Leighton Point Rd, Calabasas, California 91301", "zohoId": "zcrm_6566137000001642198"}, {"id": "c1328", "company": "Inosip Solutions LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001642203"}, {"id": "c1329", "company": "InstaPro", "contact": "", "phone": "", "email": "", "industry": "", "address": "1130 2nd Ave, Blackwood, New Jersey 8012", "zohoId": "zcrm_6566137000001642208"}, {"id": "c1330", "company": "InStyler", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001642213"}, {"id": "c1331", "company": "Intergrated Healthcare Solutions", "contact": "", "phone": "", "email": "", "industry": "", "address": "18011 Mitchell South Suite A, Irvine, California 92614", "zohoId": "zcrm_6566137000001642221"}, {"id": "c1332", "company": "InvaPharma Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "1320 W Mission Blvd, Ontario, California 91762", "zohoId": "zcrm_6566137000001642226"}, {"id": "c1333", "company": "Invention Depot", "contact": "", "phone": "", "email": "", "industry": "", "address": "5190 E Colorado St #305, Long B each, California 90814", "zohoId": "zcrm_6566137000001642231"}, {"id": "c1334", "company": "Inventure Foods", "contact": "", "phone": "260-846-1882", "email": "", "industry": "", "address": "Attn: Adam Johnson 705 West Dunham Rd, Bluffton, Indiana 46714", "zohoId": "zcrm_6566137000001642236"}, {"id": "c1335", "company": "Ion Labs, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "8031 114th Ave Suite 4000, Largo, Florida 33773", "zohoId": "zcrm_6566137000001642241"}, {"id": "c1336", "company": "IPS, Inc", "contact": "", "phone": "951-693-5580", "email": "", "industry": "", "address": "27375 Via Industria, Temecula, California 92590", "zohoId": "zcrm_6566137000001642246"}, {"id": "c1337", "company": "IPS: All Natural, LLC", "contact": "", "phone": "424-273-1207", "email": "", "industry": "", "address": "Attn: Paul Sheppard 1100 Glendon Ave Suite 1700, Los Angeles, California 90024", "zohoId": "zcrm_6566137000001642251"}, {"id": "c1338", "company": "Iso International LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "2215 Auto Park Way, Escondido, California 92029", "zohoId": "zcrm_6566137000001642256"}, {"id": "c1339", "company": "ITO EN (North America) Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "20 Jay Street Suite 530, Brooklyn, New York 11201", "zohoId": "zcrm_6566137000001642264"}, {"id": "c1340", "company": "Iwhey", "contact": "", "phone": "", "email": "", "industry": "", "address": "1120 Broadway St Suite 2743, Pearland, Texas 77584", "zohoId": "zcrm_6566137000001642269"}, {"id": "c1341", "company": "JagRma (Nuttzo Brand)", "contact": "", "phone": "", "email": "", "industry": "", "address": "3525 Del Mar Heights Road #728, San Diego, California 91230", "zohoId": "zcrm_6566137000001642274"}, {"id": "c1342", "company": "Jackson Ferguson", "contact": "", "phone": "", "email": "", "industry": "", "address": "1626 Grey Fox Run, Oklahoma City, Oklahoma 73131", "zohoId": "zcrm_6566137000001642279"}, {"id": "c1343", "company": "Jarrow Formulas", "contact": "", "phone": "", "email": "", "industry": "", "address": "1824 S Robertson Blvd, Los Angeles, California 90035", "zohoId": "zcrm_6566137000001642284"}, {"id": "c1344", "company": "Jay Bang", "contact": "", "phone": "", "email": "", "industry": "", "address": "728 Whispering Trail, Irvine, California 92602", "zohoId": "zcrm_6566137000001642289"}, {"id": "c1345", "company": "John's Killer Protein", "contact": "", "phone": "949-478-0181", "email": "", "industry": "", "address": "200 Spectrum Center Drive Suite 300, Irvine, California 92618", "zohoId": "zcrm_6566137000001642299"}, {"id": "c1346", "company": "Jennifer - PiePops", "contact": "", "phone": "", "email": "", "industry": "", "address": "20436 Corisco St, Chatsworth, California 91311", "zohoId": "zcrm_6566137000001642320"}, {"id": "c1347", "company": "Jouer Comestics, LLC", "contact": "", "phone": "310-312-0500", "email": "", "industry": "", "address": "1929 Pontius Ave, Los Angeles, California 90025", "zohoId": "zcrm_6566137000001642325"}, {"id": "c1348", "company": "Joyful Journey LLC DBA Nice Cream Sammies", "contact": "", "phone": "", "email": "", "industry": "", "address": "PO BOX 265, Jamestown, Colorado 80455", "zohoId": "zcrm_6566137000001642330"}, {"id": "c1349", "company": "Joje's Bar", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ Bake Works 5600 NE 121st Ave Suite T1, Vancouver, Washington 98682", "zohoId": "zcrm_6566137000001642335"}, {"id": "c1350", "company": "Josh Roush", "contact": "", "phone": "", "email": "", "industry": "", "address": "328 WInsome Pl, Encinitas, California 92924", "zohoId": "zcrm_6566137000001642341"}, {"id": "c1351", "company": "JSL Foods Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "3550 Pasadena Ave, Los Angeles, Los Angeles 90031", "zohoId": "zcrm_6566137000001642346"}, {"id": "c1352", "company": "JSZ International Inc DBA of Alternative", "contact": "", "phone": "909-931-1267", "email": "", "industry": "", "address": "1665 W Lisbon St, Upland, California 91784", "zohoId": "zcrm_6566137000001642351"}, {"id": "c1353", "company": "Just Jan's", "contact": "", "phone": "", "email": "", "industry": "", "address": "22287 Mulholland Hwy #90, Calabasas, California 91302-1218", "zohoId": "zcrm_6566137000001642356"}, {"id": "c1354", "company": "Julie & Kate Baked Goods", "contact": "", "phone": "", "email": "", "industry": "", "address": "8070 E 40th Ave, Denver, Colorado 80207", "zohoId": "zcrm_6566137000001642361"}, {"id": "c1355", "company": "JW Nutritional", "contact": "", "phone": "214-221-0404", "email": "", "industry": "", "address": "Attn: ALAM/VICTOR 11370 Pagemill Rd, Dallas, Texas 72543", "zohoId": "zcrm_6566137000001642366"}, {"id": "c1356", "company": "K1 Packaging Group", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001642371"}, {"id": "c1357", "company": "Kaibae", "contact": "", "phone": "805-738-3005", "email": "", "industry": "", "address": "9 East Mission St, Santa Barbara, California 93101", "zohoId": "zcrm_6566137000001642376"}, {"id": "c1358", "company": "Kalot Superfood", "contact": "", "phone": "", "email": "", "industry": "", "address": "Jessica Weiswasser 1182 S Washington St, Denver, Colorado 80210", "zohoId": "zcrm_6566137000001642381"}, {"id": "c1359", "company": "KARMAGANICS", "contact": "", "phone": "", "email": "", "industry": "", "address": "1507 7th St, Santa Monica, California 90401", "zohoId": "zcrm_6566137000001642386"}, {"id": "c1360", "company": "Katzke Packaging Co", "contact": "", "phone": "303-744-3546", "email": "", "industry": "", "address": "3250 Abilene St Unit D, Aurora, Colorado 80011", "zohoId": "zcrm_6566137000001644004"}, {"id": "c1361", "company": "KAV America ( For Tea Drops)", "contact": "", "phone": "", "email": "", "industry": "", "address": "422 East Commerical Rd, San Bernardino, California 92408", "zohoId": "zcrm_6566137000001644009"}, {"id": "c1362", "company": "Kester Foods LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "279 Kester Rd, Roseburg, Oregon 97470", "zohoId": "zcrm_6566137000001644014"}, {"id": "c1363", "company": "Kinchies LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "610 SE 9th St Unit 106, Minneapolis, Minnesota 55414", "zohoId": "zcrm_6566137000001644019"}, {"id": "c1364", "company": "Kirei Healthy Food Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "112 N Curry St, Carson City, Nevada 89703", "zohoId": "zcrm_6566137000001644024"}, {"id": "c1365", "company": "Kokua Sun Care, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "804 Kainoa Pl, Honolulu, Hawaii 96821", "zohoId": "zcrm_6566137000001644029"}, {"id": "c1366", "company": "Kava & Co. LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "6300 Riverside Plz Ln NW 100-3010, Albuquerque, New Mexico 92154", "zohoId": "zcrm_6566137000001644034"}, {"id": "c1367", "company": "Keep Healthy Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "Attn: Jenson Adoni 1019 Fort Salonga Rd Suite 112, Northport, New York 11768", "zohoId": "zcrm_6566137000001644039"}, {"id": "c1368", "company": "Keller Pharma", "contact": "", "phone": "", "email": "", "industry": "", "address": "6975 Arlington Ave, Riverside, California 92503", "zohoId": "zcrm_6566137000001644044"}, {"id": "c1369", "company": "Kelker Warehouse Irene Bolesworth", "contact": "", "phone": "", "email": "", "industry": "", "address": "6600 Doolittle Ave, Riverside, California 92503", "zohoId": "zcrm_6566137000001644049"}, {"id": "c1370", "company": "Kellie Lee", "contact": "", "phone": "", "email": "", "industry": "", "address": "600 Gleeson Way, Sparks, Nevada 89431", "zohoId": "zcrm_6566137000001644054"}, {"id": "c1371", "company": "Kize Concepts Jeff Ragan", "contact": "", "phone": "", "email": "", "industry": "", "address": "1740 NW 3rd St, Oklahoma City, Oklahoma 73106", "zohoId": "zcrm_6566137000001644059"}, {"id": "c1372", "company": "Krabots", "contact": "", "phone": "626-453-6081", "email": "", "industry": "", "address": "3185 Palisades Dr, Corona, California 92878", "zohoId": "zcrm_6566137000001644064"}, {"id": "c1373", "company": "Kraft - Heinz- Campaign", "contact": "", "phone": "", "email": "", "industry": "", "address": "702 N Mattis Ave, Champaign, Illinois 61821", "zohoId": "zcrm_6566137000001644079"}, {"id": "c1374", "company": "La Dona, Inc", "contact": "", "phone": "619-424-9799", "email": "", "industry": "", "address": "679 Anita St \"C\", Chula Vista, California 91911", "zohoId": "zcrm_6566137000001644084"}, {"id": "c1375", "company": "Hunnee", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001650001"}, {"id": "c1376", "company": "La Mixteca", "contact": "", "phone": "760-802-3989", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000001670016"}, {"id": "c1377", "company": "Lancer Skincare", "contact": "", "phone": "", "email": "", "industry": "", "address": "℅ AMS Fullfillment, 27801 Avenue Scott, Valencia California", "zohoId": "zcrm_6566137000001670028"}, {"id": "c1378", "company": "Landsberg Orora Business Solutions", "contact": "", "phone": "", "email": "", "industry": "", "address": "1900 W University Dr Ste 101, Tempe, Arizona 85281", "zohoId": "zcrm_6566137000001670041"}, {"id": "c1379", "company": "Langlade Springs", "contact": "", "phone": "", "email": "", "industry": "", "address": "W6933 State Hwy 64, Polar, Wisconsin 54418", "zohoId": "zcrm_6566137000001670049"}, {"id": "c1380", "company": "Lather, Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "76 N. Fair Oaks Ave, Pasadena, California 91103", "zohoId": "zcrm_6566137000001670054"}, {"id": "c1381", "company": "Lark Ellen Farm", "contact": "", "phone": "", "email": "", "industry": "", "address": "420 Bryant Circle, Suite B, Ojai, California 93023", "zohoId": "zcrm_6566137000001670059"}, {"id": "c1382", "company": "Legend Packaging Group", "contact": "", "phone": "", "email": "", "industry": "", "address": "1840 Arrow Highway, La Verne, California 91750", "zohoId": "zcrm_6566137000001670068"}, {"id": "c1383", "company": "Laura's Original Boston Brownies", "contact": "", "phone": "", "email": "", "industry": "", "address": "1022 W Morena Blvd. #F & G, San Diego, California 92110", "zohoId": "zcrm_6566137000001670073"}, {"id": "c1384", "company": "Level Up Life", "contact": "", "phone": "", "email": "", "industry": "", "address": "27762 Antonia Parkway STE L1-600, Ladera Ranch, California 92624", "zohoId": "zcrm_6566137000001670078"}, {"id": "c1385", "company": "Liberty Label, Inc.", "contact": "", "phone": "", "email": "", "industry": "", "address": "40575 California Oaks Rd Suite D-2, #136, Murrieta, California 92562", "zohoId": "zcrm_6566137000001670086"}, {"id": "c1387", "company": "Colonial Natural Products", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002446001"}, {"id": "c1388", "company": "Kelly Spicers", "contact": "", "phone": "562-698-1199", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002465011"}, {"id": "c1389", "company": "Paradise Drinking Waters", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002562070"}, {"id": "c1390", "company": "Chris Christensen Systems", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002562105"}, {"id": "c1392", "company": "Leaven Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002585034"}, {"id": "c1393", "company": "Trisoft", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002720022"}, {"id": "c1395", "company": "Veritiv Landsberg Solutions", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000002808079"}, {"id": "c1396", "company": "MPK Foods", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000003164250"}, {"id": "c1397", "company": "YouBar Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000003164270"}, {"id": "c1399", "company": "Universal Plastic Bag MFG CO, INC.", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000003709016"}, {"id": "c1400", "company": "Mindworks Innovations/Amen Clinics", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000003802039"}, {"id": "c1401", "company": "Virun Manufacturing", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000003866001"}, {"id": "c1402", "company": "Schlotterbeck & Foss, LLC", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004012001"}, {"id": "c1403", "company": "Vital Pack", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004015159"}, {"id": "c1404", "company": "Carnivore Bar", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004174033"}, {"id": "c1405", "company": "Codeage", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004199002"}, {"id": "c1406", "company": "Five Star Gourmet", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004301037"}, {"id": "c1407", "company": "Art of Tea", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004360010"}, {"id": "c1408", "company": "Goldmind Printers", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004508023"}, {"id": "c1409", "company": "Product Society", "contact": "", "phone": "323-248-9623", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004623102"}, {"id": "c1410", "company": "Puretek", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004623175"}, {"id": "c1413", "company": "Gold Mind Printers", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004673005"}, {"id": "c1415", "company": "United Chemical, Inc", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004828037"}, {"id": "c1416", "company": "Leo Ghazalian", "contact": "", "phone": "", "email": "", "industry": "", "address": "", "zohoId": "zcrm_6566137000004878044"}];

// Seed handled by checkAndSeedData() on auth

goView('dashboard');


// ═══ RESTORED MISSING FUNCTIONS ═══
function emailQuoteWithPDF(){var q=getQ(S.editId);if(!q)return;S.etab=6;renderEditor();setTimeout(renderSendPane,100)}
function openQuoteSendMenu(){var q=getQ(S.editId);if(!q)return;S.etab=6;renderEditor();setTimeout(renderSendPane,100)}
function printQuoteOnly(){var pg=$('quotePage');if(!pg)return;var w=window.open('','_blank');w.document.write('<html><head><style>body{font-family:Arial;margin:0;padding:20px;color:#333}table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border:1px solid #ddd;font-size:11px}</style></head><body>'+pg.innerHTML+'</body></html>');w.document.close();w.focus();setTimeout(function(){w.print()},500)}

function populateHamUser(){var name=getUserName();var p=getMFXProfile();
// Department color map for avatar
var deptAvatarColors={Operations:'#C0C0C0',Estimation:'#38bdf8','Pre-Press':'#d7ff2f',Production:'#4169E1',Quality:'#ef4444',Accounting:'#22c55e',Sales:'#a855f7',Administration:'#C0C0C0'};
var userDept=p.dept||'Operations';
var avatarColor=deptAvatarColors[userDept]||'#C0C0C0';
// Role trim colors — leadership gets cyan ring
var role=p.role||'Team Member';
var isLeadership=/director|ceo|vp|president|lead|manager|supervisor/i.test(role);
var trimColor=isLeadership?'#00e5ff':'transparent';
var el=$('hamAvatar');
if(el){el.textContent=name.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();
el.style.background='transparent';el.style.color=avatarColor;
el.style.border='2px solid '+avatarColor;
el.style.boxShadow=isLeadership?'0 0 10px rgba(0,229,255,.5),0 0 20px rgba(0,229,255,.2)':'0 0 8px '+avatarColor+'50';
if(isLeadership){el.style.outline='2px solid #00e5ff';el.style.outlineOffset='2px'}else{el.style.outline='none'}}
var nm=$('hamUserName');if(nm)nm.textContent=name;
// Position tag
var posEl=$('hamUserPosition');
if(posEl){var pos=p.position||p.title||'';
if(pos){posEl.style.display='inline-block';posEl.innerHTML='<span style="font-size:8px;font-weight:600;color:'+(isLeadership?'#00e5ff':avatarColor)+';background:'+(isLeadership?'rgba(0,229,255,.1)':'rgba(192,192,192,.1)')+';border:1px solid '+(isLeadership?'rgba(0,229,255,.2)':'rgba(192,192,192,.15)')+';padding:1px 7px;border-radius:10px;letter-spacing:.3px">'+esc(pos)+'</span>'}
else{posEl.style.display='none'}}
var rl=$('hamUserRole');if(rl){var pts=p.score;var pv=typeof pts==='object'?pts.pts:pts;
rl.innerHTML='<span style="color:'+(isLeadership?'#00e5ff':'var(--tx3)')+'">'+role+'</span> · <span style="color:'+avatarColor+'">'+userDept+'</span> · '+(pv||0).toFixed(1)+' pts'}}

function openUserProfile(){
  // UX-05 fix (2026-05-24): unlock buttons (🔓) are now only rendered for users
  // whose role is in the admin set. Non-admins see plain locked inputs without
  // a frustrating "unlock then deny" interaction. Firestore rules also block
  // self-update of role/dept regardless (users/{userId} rule), so this is UI
  // polish on top of an already-enforced server constraint.
  var p=getMFXProfile();
  var me=getUserName();
  var fn=p.displayName||me.split(' ')[0];
  var _isAdmin=['ceo','admin','administrator','owner','operations manager','manager'].includes((p.role||'').toLowerCase());
  function lockBtn(id){return _isAdmin?'<button class="btn btn-ghost btn-xs" onclick="unlockField(\''+id+'\')" style="margin-top:4px">🔓</button>':'';}
  function adminTag(){return _isAdmin?'<span style="color:var(--or)">Admin</span>':'<span style="color:var(--tx3)" title="Locked — request admin to change">Locked</span>';}
  var h='<div class="modal-title">My Profile</div>'+
    '<div style="text-align:center;margin-bottom:12px"><div style="width:56px;height:56px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#000;margin:0 auto">'+me.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase()+'</div><div style="font-size:14px;font-weight:700;color:var(--tx);margin-top:6px">'+me+'</div><div style="font-size:10px;color:var(--tx3)">'+(CURRENT_USER?CURRENT_USER.email:'')+'</div></div>'+
    '<div class="fg"><label>Full Name (locked)</label><input value="'+me+'" disabled style="opacity:.5"></div>'+
    '<div class="fg"><label>Email (locked)</label><input value="'+(CURRENT_USER?CURRENT_USER.email:'')+'" disabled style="opacity:.5"></div>'+
    '<div class="fg"><label>Display Name (@ tag) '+adminTag()+'</label><input id="up-name" value="'+fn+'" disabled style="opacity:.5">'+lockBtn('up-name')+'</div>'+
    '<div class="fg"><label>Flex ID '+adminTag()+'</label><input id="up-flexid" value="'+(p.flexId||'')+'" disabled style="opacity:.5">'+lockBtn('up-flexid')+'</div>'+
    '<div class="fg"><label>Position / Title '+adminTag()+'</label><input id="up-position" value="'+(p.position||'')+'" disabled style="opacity:.5" placeholder="e.g. Director of Digital & Operations">'+lockBtn('up-position')+'</div>'+
    '<div class="fg"><label>Role '+adminTag()+'</label><input id="up-role" value="'+(p.role||'')+'" disabled style="opacity:.5">'+lockBtn('up-role')+'</div>'+
    '<div class="fg"><label>Department '+adminTag()+'</label><select id="up-dept" disabled style="opacity:.5"><option value="">—</option>';
  ['Operations','Estimation','Pre-Press','Production','Quality','Accounting','Sales','Administration'].forEach(function(d){h+='<option'+(p.dept===d?' selected':'')+'>'+d+'</option>'});
  h+='</select>'+lockBtn('up-dept')+'</div>'+
    '<button class="btn btn-pr" onclick="saveUserProfile()" style="width:100%;margin-top:10px">Save</button>'+
    '<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:6px">Cancel</button>';
  openModal(h);
}
// unlockField: UI-only gate. Firestore rules enforce that non-management users
// cannot write role/dept fields (see users/{userId} rule — self-update blocked).
function unlockField(id){
  // UX-16 fix (2026-05-24): also un-mute the parent .fg wrapper (which has its
  // own inline opacity), focus the input, and add a subtle 'unlocked' style so
  // the change is visually obvious. Server-side rule still gates the write.
  var _pu=getMFXProfile();
  var _ru=(_pu.role||'').toLowerCase();
  if(!['ceo','admin','administrator','owner','operations manager','manager'].includes(_ru)){
    toast('Unauthorized — admin role required','err');
    return;
  }
  var el=$(id);
  if(!el) return;
  el.disabled=false;
  el.style.opacity='1';
  el.style.borderColor='var(--ac)';
  // Walk up to the .fg wrapper and reset its opacity
  var parent = el.parentElement;
  while(parent && parent !== document.body){
    if(parent.classList && parent.classList.contains('fg')){
      parent.style.opacity='1';
      break;
    }
    parent = parent.parentElement;
  }
  try { el.focus(); el.select && el.select(); } catch(e){}
}
function saveUserProfile(){var f={displayName:($('up-name')||{}).value||'',flexId:($('up-flexid')||{}).value||'',position:($('up-position')||{}).value||'',role:($('up-role')||{}).value||'',dept:($('up-dept')||{}).value||''};Object.keys(f).forEach(function(k){saveMFXProfile(k,f[k])});if(typeof syncUserAccessProfile==='function')syncUserAccessProfile();closeModal();toast('Saved!','ok');populateHamUser()}

// Send-as email aliases for the org
var MFX_SEND_AS=['quotes@microflexfilm.com','info@microflexfilm.com'];

// Email templates for quote sending
function getSendTemplates(q){
var co=q.fields.custCo||'Customer';var attn=q.fields.custAttn||'';var qn=q.quoteNum||'';var user=getUserName();var portalLink='https://os.microflexfilm.com/portal?id='+q.id+'&q='+qn;
return[
{label:'Send Quote',subject:qn+' - Quote from Microflex Film Corp',body:'Hi '+(attn||co)+',\n\nPlease see the attached quote '+qn+' for your review.\n\nYou can review, approve, and submit your PO directly here:\n'+portalLink+'\n\nIf you have any questions, feel free to contact us.\n\nBest regards,\n'+user+'\nMicroflex Film Corporation\n(909) 360-9066\nQuotes@MicroflexFilm.com'},
{label:'Follow Up',subject:'Following Up — '+qn,body:'Hi '+(attn||co)+',\n\nJust following up on quote '+qn+' we sent over. Wanted to make sure you received it and see if you have any questions.\n\nYou can review and approve directly here:\n'+portalLink+'\n\nLet me know how you\'d like to proceed.\n\nBest,\n'+user},
{label:'Info Needed',subject:'Additional Info Needed — '+qn,body:'Hi '+(attn||co)+',\n\nRegarding quote '+qn+', we need a few more details before we can finalize:\n\n- [Detail needed]\n- [Detail needed]\n\nPlease let us know at your earliest convenience.\n\nThanks,\n'+user},
{label:'Revised Quote',subject:'Revised Quote — '+qn+' Rev '+(q.rev||'A'),body:'Hi '+(attn||co)+',\n\nWe\'ve updated your quote based on your feedback. Please find the revised quote '+qn+' Rev '+(q.rev||'A')+' attached.\n\nReview and approve here:\n'+portalLink+'\n\nPlease let us know if this looks good or if you need further changes.\n\nBest regards,\n'+user},
{label:'Price Hold Reminder',subject:'Pricing Expiring Soon — '+qn,body:'Hi '+(attn||co)+',\n\nJust a friendly reminder that the pricing on quote '+qn+' is valid for 30 days from the quote date. We\'d love to lock in these rates for you.\n\nApprove and submit your PO here:\n'+portalLink+'\n\nLet me know if you have any questions.\n\nBest,\n'+user},
{label:'Ready to Start',subject:'Ready When You Are — '+qn,body:'Hi '+(attn||co)+',\n\nYour quote '+qn+' has been approved on our end and we\'re ready to move forward as soon as you are.\n\nSubmit your PO and upload art files here:\n'+portalLink+'\n\nOnce we receive your PO and print-ready files, we\'ll get your job into the production schedule right away.\n\nBest regards,\n'+user},
{label:'Thank You / Won',subject:'Thank You! — Order '+qn,body:'Hi '+(attn||co)+',\n\nThank you for your order! We\'ve received your PO for quote '+qn+' and your job is being processed.\n\nYou can track your order and upload any additional files through your portal:\n'+portalLink+'\n\nOur team will be in touch with proof timelines shortly.\n\nBest regards,\n'+user},
{label:'Custom',subject:'',body:''}
]}

function fillSendTpl(){var i=parseInt(($('send-tpl')||{}).value||0);var q=getQ(S.editId);if(!q)return;var tpls=getSendTemplates(q);if(tpls[i]){if($('send-subj'))$('send-subj').value=tpls[i].subject;if($('send-body'))$('send-body').value=tpls[i].body}}

function renderSendPane(){
// 2026-05-24: New Communications hub takes over this pane when available.
// MFX_COMMS provides full composer + templates + history timeline.
if(window.MFX_COMMS && typeof MFX_COMMS.renderPane==='function'){
  return MFX_COMMS.renderPane(S.editId);
}
// Legacy fallback (kept for any boot-race where comms module hasn't loaded)
var el=$('sendPaneContent');if(!el)return;var q=getQ(S.editId);if(!q)return;var h='';
// Status-specific header
if(q.status==='draft'){
h+='<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:10px">📤</div><div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:6px">Submit Quote</div><div style="font-size:11px;color:var(--tx3);margin-bottom:16px">'+q.quoteNum+' Rev '+q.rev+'</div>';
/* APPROVAL REMOVAL (2026-05-24): purple Submit-for-Approval button removed */
h+='<button onclick="markReadyDirect(\''+q.id+'\')" style="width:100%;padding:14px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;border-radius:10px;cursor:pointer">✓ Mark Ready to Send</button></div>';
}else if(q.status==='approval'){
h+='<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:10px">⏳</div><div style="font-size:14px;font-weight:700;color:#c4b5fd">Pending Approval</div><div style="font-size:11px;color:var(--tx3);margin:6px 0 16px">Waiting for CEO approval</div>';
h+='<button onclick="quickApprove(\''+q.id+'\')" style="width:100%;padding:14px;font-size:13px;font-weight:700;background:#16a34a;color:#fff;border:none;border-radius:10px;cursor:pointer;margin-bottom:8px">✓ Approve</button>';
h+='<button onclick="setQStatus(\''+q.id+'\',\'rejected\')" style="width:100%;padding:12px;font-size:12px;font-weight:600;background:transparent;color:var(--rd);border:1px solid var(--rd);border-radius:10px;cursor:pointer">✕ Reject</button></div>';
}else if(q.status==='rejected'){
h+='<div style="text-align:center;padding:20px"><div style="font-size:40px">❌</div><div style="color:var(--rd);font-weight:700;margin:8px 0">Rejected</div>';
/* APPROVAL REMOVAL (2026-05-24): Resubmit-for-Approval re-routed to Mark Ready */
h+='<button onclick="markReadyDirect(\''+q.id+'\')" style="width:100%;padding:12px;font-size:12px;font-weight:600;background:var(--bg3);color:var(--ac);border:1px solid var(--ac);border-radius:10px;cursor:pointer">✓ Mark Ready to Send</button></div>';
}else if(q.status==='ready'||q.status==='sent'){
// Verify customer email
var custEmail=q.fields.custEmail||'';
var myEmail=getUserEmail()||'';
var emailValid=custEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail);

if(window._lastSentDriveLink){
h+='<div style="background:#052e16;border:1px solid #16a34a;border-radius:10px;padding:14px;margin-bottom:12px;text-align:center"><div style="font-size:16px;color:#4ade80;font-weight:700">✅ Sent!</div><div style="font-size:11px;color:#86efac;margin:4px 0">Sent to '+(window._lastSentTo||'')+'</div></div>';
}

// Email verification
h+='<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:10px;padding:14px;margin-bottom:12px">';
h+='<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:10px">VERIFY EMAIL</div>';
h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:10px;color:var(--tx3);width:60px">Customer:</span>';
if(emailValid){
h+='<span style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(custEmail)+'</span><span style="color:var(--gn);font-size:10px">✓</span>';
}else{
h+='<input id="send-cust-email" placeholder="Enter customer email" value="'+esc(custEmail)+'" style="flex:1;padding:6px 8px;border:1px solid var(--or);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px" oninput="var q=getQ(S.editId);if(q)q.fields.custEmail=this.value">';
}
h+='</div>';
h+='<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;color:var(--tx3);width:60px">My Email:</span><span style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(myEmail)+'</span><span style="color:var(--gn);font-size:10px">✓</span></div>';
h+='</div>';

// 3 action buttons
h+='<div style="display:flex;flex-direction:column;gap:8px">';

// Save to Drive
h+='<button onclick="saveQuoteToDrive()" style="width:100%;padding:14px;font-size:13px;font-weight:700;background:var(--bg3);color:var(--tx);border:1px solid var(--bdr);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Save to Drive Only</button>';

// Send to Me
h+='<button onclick="sendQuoteToMe()" style="width:100%;padding:14px;font-size:13px;font-weight:700;background:var(--srf);color:var(--ac);border:1px solid var(--ac);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg> Send to Me</button>';

// Send to Customer
h+='<button onclick="sendQuoteToCustomer()" style="width:100%;padding:14px;font-size:13px;font-weight:700;background:var(--ac);color:#000;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"'+(emailValid?'':' disabled title="Enter a valid customer email first"')+(!emailValid?' style="width:100%;padding:14px;font-size:13px;font-weight:700;background:var(--bg3);color:var(--tx3);border:1px solid var(--bdr);border-radius:10px;cursor:not-allowed;display:flex;align-items:center;justify-content:center;gap:8px;opacity:.5"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send to Customer'+(emailValid?' ('+esc(custEmail)+')':'')+'</button>';

h+='</div>';

// Communication log
var commsLog=[];
(q.internalNotes||[]).forEach(function(n){if(n.text&&(n.text.indexOf('📧')>=0||n.text.indexOf('Emailed')>=0)){commsLog.push(n)}});
if(commsLog.length){
h+='<div style="margin-top:14px;border-top:1px solid var(--bdr);padding-top:10px"><div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:6px">SENT HISTORY</div>';
commsLog.slice().reverse().forEach(function(n){
  h+='<div style="padding:6px 0;border-bottom:1px solid var(--bdr)">';
  h+='<div style="display:flex;justify-content:space-between;font-size:9px"><span style="color:var(--tx)">'+n.text.replace('📧 ','')+'</span><span style="color:var(--tx3)">'+fD(n.at)+'</span></div>';
  h+='<div style="font-size:9px;color:var(--tx3)">by '+esc(n.by)+'</div></div>';
});
h+='</div>';}
}el.innerHTML=h}

// Send to Me helper — sends quote PDF to the logged-in user's email
function sendQuoteToMe(){
// UX-10 fix (2026-05-24): guard on missing deps so the button can't silently throw
if(typeof _doSendWithOverride!=='function'||typeof getSendTemplates!=='function'){
  return toast('Send helper not loaded — refresh the page and retry','err');
}
var q=getQ(S.editId);if(!q)return;
var myEmail=getUserEmail();if(!myEmail)return toast('No email found — sign out and back in','err');
// Set up hidden send fields for sendFromTab
var tpls=getSendTemplates(q);
window._sendOverride={to:myEmail,from:'',subject:tpls[0].subject,body:tpls[0].body,cc:'',bcc:''};
_doSendWithOverride();
}

// Send to Customer helper
function sendQuoteToCustomer(){
// UX-10 fix (2026-05-24): guard on missing deps so the button can't silently throw
if(typeof _doSendWithOverride!=='function'||typeof getSendTemplates!=='function'){
  return toast('Send helper not loaded — refresh the page and retry','err');
}
var q=getQ(S.editId);if(!q)return;
var custEmail=(document.getElementById('send-cust-email')||{}).value||q.fields.custEmail||'';
if(!custEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail))return toast('Enter a valid customer email','err');
q.fields.custEmail=custEmail;
var tpls=getSendTemplates(q);
// BCC the internal distro AND the quotes archive — team@ gets every client send for visibility.
window._sendOverride={to:custEmail,from:'',subject:tpls[0].subject,body:tpls[0].body,cc:'',bcc:'team@microflexfilm.com, quotes@microflexfilm.com'};
_doSendWithOverride();
}

function _doSendWithOverride(){
var q=getQ(S.editId);if(!q)return;
if(q.status!=='ready'&&q.status!=='sent'){toast('Quote must be ready before sending','err');return}
if(window._mfxSending){toast('Already sending...','err');return}
var ov=window._sendOverride;if(!ov||!ov.to)return;
// Render external preview for PDF
var _prevMode=window._quotePreviewMode;window._quotePreviewMode='external';
if(typeof edPreview==='function')edPreview();
window._quotePreviewMode=_prevMode;
window._mfxSending=true;toast('Generating PDF & sending to '+ov.to+'...','ok');
setTimeout(function(){
generateQuotePDF(q).then(function(pdf){getGoogleToken().then(function(token){if(!token){window._mfxSending=false;return toast('Sign out & back in','err')}
var boundary='mfx'+Date.now();
var qn=q.quoteNum||'';var portalLink='https://os.microflexfilm.com/portal?id='+q.id+'&q='+qn;
var htmlBody='<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#060d14;border-radius:8px;overflow:hidden">'
+'<div style="padding:20px 30px;background:#0a1520;border-bottom:1px solid #1a2d40;display:flex;align-items:center">'
+'<div><span style="font-family:Outfit,Arial,sans-serif;font-size:22px;font-weight:900;color:#e0f2fe">Microflex</span> <span style="font-family:Outfit,Arial,sans-serif;font-size:22px;font-weight:200;color:#5a7888">Film Corp</span>'
+'<div style="width:50px;height:2px;background:#00e5ff;border-radius:1px;margin-top:4px"></div></div></div>'
+'<div style="padding:24px 30px;font-size:14px;color:#94a3b8;line-height:1.7">'+ov.body.replace(/\n/g,'<br>')+'</div>'
+'<div style="padding:16px 30px;text-align:center"><a href="'+portalLink+'" style="display:inline-block;padding:14px 40px;background:#00e5ff;color:#060d14;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:.5px">View Quote &amp; Submit PO</a></div>'
+'<div style="padding:12px 30px;font-size:11px;color:#64748b;border-top:1px solid #1a2d40">PDF quote attached. You can also review and approve online using the button above.</div>'
+'<div style="padding:16px 30px;background:#0a1520;border-top:1px solid #1a2d40;font-size:11px;color:#475569;line-height:1.6"><strong style="color:#e0f2fe">Microflex Film Corporation</strong><br>4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · <a href="mailto:Quotes@MicroflexFilm.com" style="color:#00e5ff;text-decoration:none">Quotes@MicroflexFilm.com</a> · <a href="https://www.microflexfilm.com" style="color:#00e5ff;text-decoration:none">MicroflexFilm.com</a><br><span style="font-size:10px;color:#334155">SQF Certified | Made in USA</span></div></div>';
var raw='Content-Type: multipart/mixed; boundary="'+boundary+'"\r\nMIME-Version: 1.0\r\n';
raw+='To: '+ov.to+'\r\n';
if(ov.from)raw+='From: '+ov.from+'\r\n';
if(ov.cc)raw+='Cc: '+ov.cc+'\r\n';
if(ov.bcc)raw+='Bcc: '+ov.bcc+'\r\n';
raw+='Subject: '+ov.subject+'\r\n\r\n';
raw+='--'+boundary+'\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n'+htmlBody+'\r\n';
raw+='--'+boundary+'\r\nContent-Type: application/pdf; name="'+pdf.filename+'"\r\nContent-Disposition: attachment; filename="'+pdf.filename+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+pdf.base64+'\r\n';
raw+='--'+boundary+'--';
var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
// Dual-send strategy: send the client email and the internal notification as
// TWO separate Gmail API calls. Eliminates any chance of Gmail silently
// dropping the BCC. Each send has its own visible success/failure toast and
// shows up independently in the user's Sent folder.
//
// Helper — build a complete MIME multipart raw payload with the same PDF
// attachment but configurable headers (so we can reuse it for both sends).
function _buildSendRaw(opts){
  // opts: {to, cc, subject, bodyHtml, pdfFilename, pdfBase64, from}
  var b='mfx'+Date.now()+Math.random().toString(36).slice(2,8);
  var r='Content-Type: multipart/mixed; boundary="'+b+'"\r\nMIME-Version: 1.0\r\n';
  r+='To: '+opts.to+'\r\n';
  if(opts.from)r+='From: '+opts.from+'\r\n';
  if(opts.cc)r+='Cc: '+opts.cc+'\r\n';
  r+='Subject: '+opts.subject+'\r\n\r\n';
  r+='--'+b+'\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n'+opts.bodyHtml+'\r\n';
  r+='--'+b+'\r\nContent-Type: application/pdf; name="'+opts.pdfFilename+'"\r\nContent-Disposition: attachment; filename="'+opts.pdfFilename+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+opts.pdfBase64+'\r\n';
  r+='--'+b+'--';
  return btoa(unescape(encodeURIComponent(r))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _gmailSend(rawEncoded, token, label){
  // Returns a Promise resolving to {ok, status, data, label}
  console.log('[Gmail send] '+label+' — POST to API');
  return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',
    headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({raw:rawEncoded})
  }).then(function(r){
    return r.json().then(function(data){
      var result={ok:r.ok, status:r.status, data:data, label:label};
      if(!r.ok || !(data && data.id)){
        console.error('[Gmail send] '+label+' FAILED', result);
      } else {
        console.log('[Gmail send] '+label+' OK — message id', data.id);
      }
      return result;
    });
  });
}

// SEND #1 — client email
var clientRaw=_buildSendRaw({
  to:ov.to,
  cc:ov.cc||'',
  subject:ov.subject,
  bodyHtml:htmlBody,
  pdfFilename:pdf.filename,
  pdfBase64:pdf.base64,
  from:ov.from||''
});
console.log('[Gmail send] To client:', ov.to, '| signed-in as:', firebase.auth().currentUser&&firebase.auth().currentUser.email);

_gmailSend(clientRaw, token, 'client').then(function(clientResp){
  window._mfxSending=false;
  if(!(clientResp.ok && clientResp.data && clientResp.data.id)){
    var em=(clientResp.data&&clientResp.data.error&&clientResp.data.error.message)||('HTTP '+clientResp.status);
    toast('Email to client failed: '+em+' — see browser console','err');
    return;
  }
  // Client send succeeded — update quote + registry
  toast('Email sent to '+ov.to+' ✓','ok');
  window._lastSentTo=ov.to;
  if(q){
    setQStatus(q.id,'sent');
    q=getQ(S.editId);
    if(q){
      q.sentAt=q.sentAt||new Date().toISOString();
      if(!q.workflow)q.workflow={};
      q.workflow.emailSent=true;
      q.workflow.registryUpdated=true;
      if(!q.internalNotes)q.internalNotes=[];
      q.internalNotes.push({id:'n'+Date.now(),text:'📧 Emailed to '+ov.to+' with PDF attached',by:getUserName(),at:new Date().toISOString(),mentions:[],replies:[]});
      logQuoteEvent(q,'email','Emailed to '+ov.to);
      upsertRegistryRow(q.id,'Emailed to '+ov.to);
      var all=DB.quotes();DB.saveQ(all,q.id);
      MFX.emit('quote.sent',{quote:q,pdf:pdf,token:token,to:ov.to,cc:ov.cc||'',bcc:ov.bcc||'',from:ov.from||''});
      // Archive the EXTERNAL (client-facing) PDF that matches what the client just received in email.
      setTimeout(function(){if(typeof saveQuoteToDrive==='function')saveQuoteToDrive('external')},500);
    }
  }
  renderSendPane();
  if(typeof renderWorkflow==='function')renderWorkflow();
  // SEND #2 — internal team notification (only if bcc was requested)
  // No BCC field used; team@ goes in To, quotes@ goes in Cc — both visible,
  // both guaranteed delivery, both show up in the Sent folder as their own row.
  if(ov.bcc){
    var internalSubject='[INTERNAL COPY] '+ov.subject+' — sent to '+ov.to;
    var internalIntro='<div style="padding:14px 18px;background:#f59e0b;color:#000;font-weight:700;font-size:13px;font-family:Arial,sans-serif">FYI — INTERNAL COPY · Original sent to '+esc(ov.to)+' by '+esc(getUserName())+' at '+new Date().toLocaleString()+'</div>';
    var internalRaw=_buildSendRaw({
      to:'team@microflexfilm.com',
      cc:'quotes@microflexfilm.com',
      subject:internalSubject,
      bodyHtml:internalIntro+htmlBody,
      pdfFilename:pdf.filename,
      pdfBase64:pdf.base64,
      from:ov.from||''
    });
    _gmailSend(internalRaw, token, 'internal').then(function(intResp){
      if(intResp.ok && intResp.data && intResp.data.id){
        toast('Internal copy sent to team@ + quotes@ ✓','ok');
        if(q && q.internalNotes){
          q.internalNotes.push({id:'n'+Date.now(),text:'📧 Internal copy sent to team@ + quotes@',by:'System',at:new Date().toISOString(),mentions:[],replies:[]});
          DB.saveQ(DB.quotes(),q.id);
        }
      } else {
        var em2=(intResp.data&&intResp.data.error&&intResp.data.error.message)||('HTTP '+intResp.status);
        toast('Internal copy FAILED: '+em2+' — client email was sent OK, but team@/quotes@ did not receive a copy. See console.','err');
      }
    }).catch(function(e){
      console.error('[Gmail send] internal network error:',e);
      toast('Internal copy network error: '+e.message,'err');
    });
  }
}).catch(function(e){
  window._mfxSending=false;
  console.error('[Gmail send] client network error:',e);
  toast('Send failed: '+e.message,'err');
})
}).catch(function(e){window._mfxSending=false;toast('Token error','err')})}).catch(function(e){window._mfxSending=false;toast('PDF error: '+e.message,'err')})
},200);
window._sendOverride=null;
}

function sendFromTab(){
var q = getQ(S.editId); if(!q) return;
if(q.status !== 'ready' && q.status !== 'sent') { toast('Quote must be approved before sending','err'); return; }
// Ensure preview is rendered as external (client-facing) for PDF
var _prevMode=window._quotePreviewMode;window._quotePreviewMode='external';
if(typeof edPreview==='function') edPreview();
window._quotePreviewMode=_prevMode;
// Send lock — prevent double clicks
if(window._mfxSending){toast('Already sending...','err');return}
var to=($('send-to')||{}).value;if(to==='custom')to=prompt('Email:');if(!to)return toast('Email required','err');
var extraTo=(($('send-to-extra')||{}).value||'').split(',').map(function(e){return e.trim()}).filter(function(e){return e});
var allTo=[to].concat(extraTo).join(',');
var cc=($('send-cc')||{}).value||'';
var bcc=($('send-bcc')||{}).value||'';
var subj=($('send-subj')||{}).value;var body=($('send-body')||{}).value;var fromAddr=($('send-from')||{}).value;var q=getQ(S.editId);
// Check if already sent to this recipient
var alreadySent=false;
(q.internalNotes||[]).forEach(function(n){if(n.text&&n.text.indexOf('📧')>=0&&n.text.indexOf(to)>=0)alreadySent=true});
var confirmMsg='Are you sure you want to send this email?'+(alreadySent?'\n\n⚠️ WARNING: This quote was already sent to '+to+'. Send again?':'')+'\n\nTo: '+allTo+(cc?'\nCC: '+cc:'')+(bcc?'\nBCC: '+bcc:'')+'\nSubject: '+subj+'\nQuote: '+q.quoteNum+' Rev '+q.rev+'\nClient: '+(q.fields.custCo||'—');
if(!confirm(confirmMsg))return;
window._mfxSending=true;
toast('Generating PDF & sending...','ok');
// Ensure preview DOM is fully rendered as external (client-facing) before capturing
var _prevMode2=window._quotePreviewMode;window._quotePreviewMode='external';
if(typeof edPreview==='function')edPreview();
window._quotePreviewMode=_prevMode2;
setTimeout(function(){
generateQuotePDF(q).then(function(pdf){getGoogleToken().then(function(token){if(!token){window._mfxSending=false;return toast('Sign out & back in','err')}
var boundary='mfx'+Date.now();var pRows='';var c_mtx=edCalc();var f=q.fields||{};
var jobDesc=(f.sA||'?')+'x'+(f.sar||'?')+'" '+(f.shapeType||'')+' - '+(f.colors||'?')+'C '+(f.jobType||'Flexo');
if(c_mtx&&c_mtx.mtx){c_mtx.mtx.forEach(function(r){pRows+='<tr><td style="padding:8px 14px;font-size:13px;color:#94a3b8;border-bottom:1px solid #0f1d2b">'+fN(r.qty)+' units</td><td style="padding:8px 14px;font-size:13px;color:#e0f2fe;font-weight:700;text-align:right;border-bottom:1px solid #0f1d2b">'+f$(r.skus[1].tot)+'</td></tr>'})}
var _portalLink2='https://os.microflexfilm.com/portal?id='+q.id+'&q='+q.quoteNum;
var htmlBody='<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#060d14;border-radius:8px;overflow:hidden">'
+'<div style="padding:20px 30px;background:#0a1520;border-bottom:1px solid #1a2d40">'
+'<span style="font-family:Outfit,Arial,sans-serif;font-size:22px;font-weight:900;color:#e0f2fe">Microflex</span> <span style="font-family:Outfit,Arial,sans-serif;font-size:22px;font-weight:200;color:#5a7888">Film Corp</span>'
+'<div style="width:50px;height:2px;background:#00e5ff;border-radius:1px;margin-top:4px"></div></div>'
+'<div style="padding:24px 30px;font-size:14px;color:#94a3b8;line-height:1.7">'+body.replace(/\n/g,'<br>')+'</div>'
+'<div style="padding:16px 30px;text-align:center"><a href="'+_portalLink2+'" style="display:inline-block;padding:14px 40px;background:#00e5ff;color:#060d14;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:.5px">View Quote &amp; Submit PO</a></div>'
+'<div style="padding:12px 30px;font-size:11px;color:#64748b;border-top:1px solid #1a2d40">PDF quote attached. You can also review and approve online using the button above.</div>'
+'<div style="padding:16px 30px;background:#0a1520;border-top:1px solid #1a2d40;font-size:11px;color:#475569;line-height:1.6"><strong style="color:#e0f2fe">Microflex Film Corporation</strong><br>4130 Garner Rd, Riverside CA 92501<br>(909) 360-9066 · <a href="mailto:Quotes@MicroflexFilm.com" style="color:#00e5ff;text-decoration:none">Quotes@MicroflexFilm.com</a> · <a href="https://www.microflexfilm.com" style="color:#00e5ff;text-decoration:none">MicroflexFilm.com</a><br><span style="font-size:10px;color:#334155">SQF Certified | Made in USA</span></div></div>';
// Build MIME with CC/BCC
var raw='Content-Type: multipart/mixed; boundary="'+boundary+'"\r\n';
if(fromAddr)raw+='From: '+fromAddr+'\r\n';
raw+='To: '+allTo+'\r\n';
if(cc)raw+='Cc: '+cc+'\r\n';
if(bcc)raw+='Bcc: '+bcc+'\r\n';
raw+='Subject: '+subj+'\r\nMIME-Version: 1.0\r\n\r\n';
raw+='--'+boundary+'\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'+htmlBody+'\r\n\r\n';
raw+='--'+boundary+'\r\nContent-Type: application/pdf; name="'+pdf.filename+'"\r\nContent-Disposition: attachment; filename="'+pdf.filename+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+pdf.base64+'\r\n--'+boundary+'--';
var encoded=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:encoded})}).then(function(r){return r.json()}).then(function(data){
if(data.id){
toast('Sent with PDF to '+allTo+'!','ok');
window._mfxSending=false;
setQStatus(q.id,'sent');
q = getQ(S.editId); if(!q) return;
// Explicitly set sentAt + workflow flags in case setQStatus async hasn't completed
q.sentAt=q.sentAt||new Date().toISOString();
if(!q.workflow)q.workflow={};
q.workflow.emailSent=true;
upsertRegistryRow(q.id,'Emailed to '+allTo+(cc?' cc:'+cc:''));
q.workflow.registryUpdated=true;
if(!q.internalNotes)q.internalNotes=[];
q.internalNotes.push({id:'n'+Date.now(),text:'📧 Emailed to '+allTo+(cc?' CC:'+cc:'')+(bcc?' BCC:'+bcc:'')+(fromAddr?' from '+fromAddr:''),by:getUserName(),at:new Date().toISOString(),mentions:[],replies:[]});
logQuoteEvent(q,'email','Emailed to '+allTo);
var all=DB.quotes();DB.saveQ(all);
window._lastSentDriveLink='';window._lastSentTo=allTo;
renderSendPane();
if(typeof renderWorkflow==='function')renderWorkflow();
// Emit event — listeners handle Drive save, client folder, etc.
MFX.emit('quote.sent',{quote:q,pdf:pdf,token:token,to:allTo,cc:cc,bcc:bcc,from:fromAddr});
}else{window._mfxSending=false;toast('Error: '+(data.error?data.error.message:''),'err')}
}).catch(function(e){window._mfxSending=false;toast(e.message,'err')})})}).catch(function(e){window._mfxSending=false;toast('PDF: '+e,'err')})},500)}

function emailViaMailto(){var to=($('send-to')||{}).value||'';if(to==='custom')to=prompt('Email:');
/* EMAIL_GUARD wrap (2026-05-24): bail if customer emails are blocked */
if(window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.blockIfDisabled('emailViaMailto', to)) return;var subj=encodeURIComponent(($('send-subj')||{}).value||'');var body=encodeURIComponent(($('send-body')||{}).value||'');window.open('https://mail.google.com/mail/?view=cm&to='+encodeURIComponent(to)+'&su='+subj+'&body='+body,'_blank')}

// ═══════════════════════════════════════
// MISSING GLOBALS & FUNCTIONS
// ═══════════════════════════════════════

// Load inbox requests from Firestore
function loadInboxRequests(me){
if(!fbDb)return;
var el=document.getElementById('inboxReqList');
fbDb.collection('requests').where('assignedTo','==',me).orderBy('createdAt','desc').limit(20).get().then(function(snap){
if(!el)return;
var items=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
var pending=items.filter(function(r){return r.status==='pending'||r.status==='in_progress'});
if(!pending.length){el.innerHTML='';return}
var h='<div class="scard"><div class="scard-h open" onclick="togCard(this)"><span class="ico">📥</span><span class="ttl">Assigned Requests ('+pending.length+')</span><span class="arr">▾</span></div><div class="scard-b open">';
pending.forEach(function(r){
var od=r.targetDate&&new Date(r.targetDate)<new Date();
h+='<div class="card '+(od?'blink-warn':'')+'" style="padding:8px;cursor:pointer" onclick="openReqProfile(\''+r.id+'\')">';
h+='<div style="display:flex;justify-content:space-between"><strong style="font-size:11px;color:var(--ac)">'+esc(r.title)+'</strong>';
h+='<span class="pill pill-'+(r.status==='in_progress'?'active':'pending')+'">'+esc(r.status)+'</span></div>';
h+='<div style="font-size:9px;color:var(--tx3)">From: '+esc(r.requestedBy||'—')+' · '+(r.targetDate||'No date')+'</div></div>'});
h+='</div></div>';
el.innerHTML=h}).catch(function(e){console.warn('op:',e)})}

// CEO approve/reject shortcuts
// ceoApprove — defined in app.js with auto-save logic; CEO Portal uses ceoAction() directly
function rejectQuote(qid){var note=prompt('Rejection reason:');if(!note)return;var all=DB.quotes();var q=all.find(function(x){return x.id===qid});if(!q)return;q.status='rejected';q.rejectionNote=note;q.updatedAt=new Date().toISOString();logQuoteEvent(q,'status','Rejected: '+note);DB.saveQ(all);toast('Rejected','ok');if(S.view==='editor')renderEditor()}
function resubmitQuote(qid){var all=DB.quotes();var q=all.find(function(x){return x.id===qid});if(!q)return;q.status='approval';q.rejectionNote='';q.updatedAt=new Date().toISOString();logQuoteEvent(q,'status','Resubmitted for approval');DB.saveQ(all);toast('Resubmitted','ok');if(S.view==='editor')renderEditor()}


function openDMs(){toast('DMs coming soon','ok')}
function openDailyChallenges(){toast('Daily Challenges coming soon','ok')}
function openPowerUps(){toast('Power-Ups coming soon','ok')}
function toggleSound(){var stored=localStorage.getItem('mfx_sound');window._soundOn=stored==='off'?true:stored==='on'?false:!window._soundOn;localStorage.setItem('mfx_sound',window._soundOn?'on':'off');toast(window._soundOn?'Sound ON':'Sound OFF','ok')}


function renderDeptTasks(items){var depts={};items.forEach(function(t){var d=t.dept||'Other';if(!depts[d])depts[d]={a:0,d:0};if(t.completed)depts[d].d++;else depts[d].a++});var h='';Object.entries(depts).forEach(function(e){h+='<div class="card" style="margin-bottom:6px"><strong>'+e[0]+'</strong><div style="font-size:9px;color:var(--tx3)">'+e[1].a+' active · '+e[1].d+' done</div></div>'});return h}
function renderLeadershipTasks(items){var users={};items.forEach(function(t){var u=t.assignedTo||t.createdBy||'?';if(!users[u])users[u]={a:0,d:0,o:0};if(t.completed)users[u].d++;else{users[u].a++;if(t.date&&new Date(t.date)<new Date())users[u].o++}});var h='';Object.entries(users).sort(function(a,b){return b[1].a-a[1].a}).forEach(function(e){h+='<div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid var(--bdr);font-size:11px"><strong>'+e[0]+'</strong><span>'+e[1].a+' active'+(e[1].o?' · <span style=color:var(--rd)>'+e[1].o+' overdue</span>':'')+'</span></div>'});return h}

function toggleNoteTag(el){var q=getQ(S.editId);if(!q)return;if(!q.fields.notesTags)q.fields.notesTags=[];var tag=el.dataset.tag;if(el.checked){if(q.fields.notesTags.indexOf(tag)===-1)q.fields.notesTags.push(tag)}else{q.fields.notesTags=q.fields.notesTags.filter(function(t){return t!==tag})}var all=DB.quotes();DB.saveQ(all)}

// ═══ INTERVAL CLEANUP ═══
function clearModuleIntervals(){
  if(_moduleInterval1){clearInterval(_moduleInterval1);_moduleInterval1=null;}
  if(_moduleInterval2){clearInterval(_moduleInterval2);_moduleInterval2=null;}
  if(_moduleInterval3){clearInterval(_moduleInterval3);_moduleInterval3=null;}
  if(_moduleInterval4){clearInterval(_moduleInterval4);_moduleInterval4=null;}
}
window.clearModuleIntervals = clearModuleIntervals;
