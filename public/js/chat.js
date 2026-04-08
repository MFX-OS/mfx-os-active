// ══════════════════════════════════════════════════════════════════
// MFX OS — FLEX CHAT v1 (Slack-like, Real-time via Firestore)
// Channels, DMs, Threads, Reactions, @Mentions, Read Receipts
// ══════════════════════════════════════════════════════════════════
(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

var CHAT={
  currentChannel:null,
  channels:[],
  listener:null,
  messages:[],
  threadOpen:null,
  threadListener:null,
  emojiPicker:false
};

var DEFAULT_CHANNELS=[
  // Purpose
  {id:'daily-chat',name:'daily-chat',type:'channel',group:'purpose',desc:'Daily team feed — GMs, updates, vibes',dept:null},
  {id:'general',name:'general',type:'channel',group:'purpose',desc:'Company-wide chat',dept:null},
  {id:'announcements',name:'announcements',type:'channel',group:'purpose',desc:'Official announcements',dept:null},
  {id:'wins',name:'wins',type:'channel',group:'purpose',desc:'Celebrate wins and milestones',dept:null},
  {id:'help',name:'help',type:'channel',group:'purpose',desc:'Ask questions, get answers',dept:null},
  // Systems
  {id:'flex-alerts',name:'flex-alerts',type:'channel',group:'systems',desc:'FlexAi system notifications',dept:null},
  {id:'job-tracker',name:'job-tracker',type:'channel',group:'systems',desc:'Job ticket updates',dept:null},
  {id:'sqf-alerts',name:'sqf-alerts',type:'channel',group:'systems',desc:'SQF & compliance alerts',dept:null},
  // Functions
  {id:'quotes-chat',name:'quotes-chat',type:'channel',group:'functions',desc:'Quote discussions & approvals',dept:'Sales'},
  {id:'scheduling',name:'scheduling',type:'channel',group:'functions',desc:'Production scheduling',dept:'Production'},
  {id:'shipping',name:'shipping',type:'channel',group:'functions',desc:'Shipping & delivery coordination',dept:'Operations'},
  {id:'design-review',name:'design-review',type:'channel',group:'functions',desc:'Artwork & proof reviews',dept:'Pre-Press'},
  // Personal
  {id:'watercooler',name:'watercooler',type:'channel',group:'personal',desc:'Off-topic, fun, random',dept:null},
  {id:'food-truck',name:'food-truck',type:'channel',group:'personal',desc:'Food truck schedule & lunch plans',dept:null},
  // Department
  {id:'client-services',name:'client-services',type:'channel',group:'department',desc:'Client Services team',dept:'Sales'},
  {id:'pre-press',name:'pre-press',type:'channel',group:'department',desc:'Pre-Press team',dept:'Pre-Press'},
  {id:'production',name:'production',type:'channel',group:'department',desc:'Production floor',dept:'Production'},
  {id:'logistics',name:'logistics',type:'channel',group:'department',desc:'Logistics & Shipping',dept:'Operations'},
  {id:'quality',name:'quality',type:'channel',group:'department',desc:'Quality team',dept:'Quality'},
  {id:'finance',name:'finance',type:'channel',group:'department',desc:'Finance & Accounting',dept:'Accounting'},
  {id:'operations',name:'operations',type:'channel',group:'department',desc:'Operations team',dept:'Operations'},
  {id:'fsqms',name:'fsqms',type:'channel',group:'department',desc:'FSQMS compliance',dept:'Quality'}
];

var CHANNEL_GROUPS=[
  {key:'purpose',label:'Purpose',color:'#00e5ff'},
  {key:'systems',label:'Systems',color:'#f59e0b'},
  {key:'functions',label:'Functions',color:'#a855f7'},
  {key:'personal',label:'Personal',color:'#22c55e'},
  {key:'department',label:'Department',color:'#C0C0C0'}
];

var DEPT_CHANNEL_COLORS={
  'Sales':'#a855f7','Estimation':'#38bdf8','Pre-Press':'#d7ff2f','Production':'#4169E1',
  'Quality':'#ef4444','Accounting':'#22c55e','Operations':'#C0C0C0','Administration':'#C0C0C0'
};

var EMOJI_REACTIONS=['👍','❤️','🎉','🔥','👀','✅','💯','😂'];

// ── SEED CHANNELS ──
function seedChannels(){
  if(!fbDb)return;
  DEFAULT_CHANNELS.forEach(function(ch){
    fbDb.collection('chat_channels').doc(ch.id).get().then(function(doc){
      if(!doc.exists){
        fbDb.collection('chat_channels').doc(ch.id).set({
          name:ch.name,type:ch.type,group:ch.group||'purpose',desc:ch.desc,dept:ch.dept,
          created:firebase.firestore.FieldValue.serverTimestamp(),
          owner:getUserName(),lastMessage:'',lastMessageAt:null,members:[]
        });
      }
    }).catch(function(e){ console.warn('CHAT get:', e.message); });
  });
}

// ── RENDER MAIN CHAT UI ──
function renderChat(){
  var el=$('v-supportboard');if(!el)return;
  var me=getUserName();
  var deptColors={'Sales':'#a855f7','Pre-Press':'#d7ff2f','Production':'#4169E1','Operations':'#C0C0C0','Quality':'#ef4444','Accounting':'#22c55e'};

  var h='<div id="chatApp" style="display:flex;height:100%;overflow:hidden;font-family:Inter,sans-serif">';

  // ── SIDEBAR ──
  h+='<div id="chatSidebar" style="width:220px;min-width:220px;background:var(--bg2);border-right:1px solid var(--bdr);display:flex;flex-direction:column;overflow-y:auto">';
  // Search
  h+='<div style="padding:10px 12px;border-bottom:1px solid var(--bdr)">';
  h+='<input id="chatSearch" placeholder="Search channels..." style="width:100%;padding:6px 10px;font-size:11px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);outline:none" oninput="filterChatChannels(this.value)">';
  h+='</div>';
  // Grouped channels
  h+='<div id="chatChannelList"></div>';
  // DMs section
  h+='<div style="padding:12px 12px 4px;font-size:9px;font-weight:700;color:var(--tx3);letter-spacing:1.5px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center">Direct Messages <span onclick="showNewDM()" style="cursor:pointer;color:#00e5ff;font-size:12px">+</span></div>';
  h+='<div id="chatDMList"></div>';
  // Online users
  h+='<div style="padding:12px 12px 4px;font-size:9px;font-weight:700;color:var(--tx3);letter-spacing:1.5px;text-transform:uppercase">Online</div>';
  h+='<div id="chatOnlineList" style="padding:0 12px 12px"></div>';
  h+='</div>';

  // ── MAIN AREA ──
  h+='<div style="flex:1;display:flex;flex-direction:column;min-width:0">';
  // Channel header
  h+='<div id="chatHeader" style="padding:10px 16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;background:var(--bg2)">';
  h+='<span id="chatHeaderName" style="font-size:14px;font-weight:700;color:var(--tx)"># general</span>';
  h+='<span id="chatHeaderDesc" style="font-size:10px;color:var(--tx3);flex:1">Company-wide chat</span>';
  h+='<span id="chatHeaderMembers" style="font-size:10px;color:var(--tx3)"></span>';
  h+='</div>';
  // Messages
  h+='<div id="chatMessages" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:2px"></div>';
  // Input
  h+='<div style="padding:8px 16px;border-top:1px solid var(--bdr);background:var(--bg2)">';
  h+='<div style="display:flex;gap:6px;align-items:flex-end">';
  h+='<div style="flex:1;position:relative">';
  h+='<textarea id="chatInput" rows="1" placeholder="Message #general..." style="width:100%;padding:8px 12px;font-size:12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;color:var(--tx);outline:none;resize:none;min-height:36px;max-height:120px;font-family:inherit" onkeydown="chatKeyDown(event)" oninput="chatAutoResize(this);chatCheckMention(this)"></textarea>';
  h+='<div id="chatMentionPicker" style="display:none;position:absolute;bottom:100%;left:0;right:0;background:var(--card);border:1px solid var(--ac);border-radius:8px;max-height:120px;overflow-y:auto;z-index:10;margin-bottom:4px"></div>';
  h+='</div>';
  h+='<button onclick="chatAddImage()" style="background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:var(--tx3)" title="Image / Photo">🖼</button>';
  h+='<button onclick="chatSearchGif()" style="background:none;border:none;cursor:pointer;font-size:11px;padding:4px 6px;color:var(--tx3);font-weight:700;border:1px solid var(--bdr);border-radius:4px" title="GIF">GIF</button>';
  h+='<button onclick="chatAddFileLink()" style="background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:var(--tx3)" title="File Link">📎</button>';
  h+='<button onclick="chatAddOSTag()" style="background:none;border:none;cursor:pointer;font-size:14px;padding:4px;color:#00e5ff" title="OS Link / Tag">🏷</button>';
  h+='<button onclick="chatToggleEmoji()" style="background:none;border:none;cursor:pointer;font-size:18px;padding:4px;color:var(--tx3)" title="Emoji">😊</button>';
  h+='<button onclick="chatSend()" style="background:#00e5ff;border:none;cursor:pointer;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;color:#000">Send</button>';
  h+='</div>';
  h+='<div id="chatAttachPreview" style="display:none;padding:4px 0"></div>';
  h+='<div id="chatEmojiBar" style="display:none;padding:6px 0;flex-wrap:wrap;gap:4px"></div>';
  h+='</div>';
  h+='</div>';

  // ── THREAD PANEL ──
  h+='<div id="chatThreadPanel" style="display:none;width:280px;min-width:280px;background:var(--bg2);border-left:1px solid var(--bdr);flex-direction:column;overflow:hidden">';
  h+='<div style="padding:10px 12px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">';
  h+='<span style="font-size:12px;font-weight:700;color:var(--tx)">Thread</span>';
  h+='<span onclick="closeThread()" style="cursor:pointer;color:var(--tx3);font-size:14px">✕</span>';
  h+='</div>';
  h+='<div id="chatThreadMessages" style="flex:1;overflow-y:auto;padding:8px 12px"></div>';
  h+='<div style="padding:8px 12px;border-top:1px solid var(--bdr)">';
  h+='<div style="display:flex;gap:4px"><textarea id="chatThreadInput" rows="1" placeholder="Reply..." style="flex:1;padding:6px 10px;font-size:11px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;color:var(--tx);outline:none;resize:none;font-family:inherit" onkeydown="threadKeyDown(event)"></textarea>';
  h+='<button onclick="threadSend()" style="background:#00e5ff;border:none;cursor:pointer;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;color:#000">→</button></div>';
  h+='</div></div>';

  h+='</div>';
  el.innerHTML=h;

  // Seed channels then load
  seedChannels();
  setTimeout(function(){loadChannels();loadOnlineUsers()},500);
}

// ── LOAD CHANNELS ──
function loadChannels(){
  if(!fbDb)return;
  fbDb.collection('chat_channels').orderBy('name').get().then(function(snap){
    CHAT.channels=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    renderChannelList();
    // Auto-select general
    if(!CHAT.currentChannel)selectChannel('daily-chat');
  }).catch(function(e){ console.warn('CHAT get:', e.message); });
}

function renderChannelList(filter){
  var el=document.getElementById('chatChannelList');if(!el)return;
  var channels=CHAT.channels.filter(function(c){return c.type==='channel'});
  if(filter)channels=channels.filter(function(c){return c.name.indexOf(filter.toLowerCase())>=0});
  var me=getUserName();
  var h='';
  CHANNEL_GROUPS.forEach(function(g){
    var groupChannels=channels.filter(function(c){return c.group===g.key});
    // Personal: only show channels owned by current user + defaults
    if(g.key==='personal'){groupChannels=groupChannels.filter(function(c){return c.owner===me||c.owner===undefined||DEFAULT_CHANNELS.some(function(d){return d.id===c.id})})}
    var collapsed=window._chatCollapsed&&window._chatCollapsed[g.key];
    h+='<div style="padding:6px 12px 3px;font-size:8px;font-weight:700;color:'+g.color+';letter-spacing:1.2px;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:4px;opacity:.8">';
    h+='<span onclick="toggleChatGroup(\''+g.key+'\')" style="font-size:7px;transition:transform .2s;display:inline-block;transform:'+(collapsed?'':'rotate(90deg)')+'">▸</span>';
    h+='<span onclick="toggleChatGroup(\''+g.key+'\')" style="flex:1">'+g.label+'</span>';
    h+='<span onclick="event.stopPropagation();createChannelInGroup(\''+g.key+'\')" style="font-size:12px;color:'+g.color+';cursor:pointer;padding:0 2px" title="Add channel">+</span>';
    h+='</div>';
    if(!collapsed){
      groupChannels.forEach(function(c){
        var active=CHAT.currentChannel===c.id;
        // Dept channels use their department color
        var tagColor=g.color;
        var nameColor=active?'#00e5ff':'var(--tx2)';
        if(g.key==='department'&&c.dept){tagColor=DEPT_CHANNEL_COLORS[c.dept]||g.color;if(!active)nameColor=tagColor}
        h+='<div onclick="selectChannel(\''+c.id+'\')" style="padding:4px 12px 4px 20px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:11px;color:'+nameColor+';'+(active?'background:rgba(0,229,255,.1);font-weight:600':'')+';transition:background .15s" onmouseover="if(!'+active+')this.style.background=\'rgba(255,255,255,.04)\'" onmouseout="if(!'+active+')this.style.background=\'none\'">';
        h+='<span style="color:'+tagColor+';font-size:9px;font-weight:700">#</span> '+c.name;
        h+='</div>';
      });
    }
  });
  // Show ungrouped channels (from Firestore that don't match any group)
  var ungrouped=channels.filter(function(c){return!CHANNEL_GROUPS.some(function(g){return g.key===c.group})});
  if(ungrouped.length){
    ungrouped.forEach(function(c){
      var active=CHAT.currentChannel===c.id;
      h+='<div onclick="selectChannel(\''+c.id+'\')" style="padding:4px 12px;cursor:pointer;font-size:11px;color:'+(active?'#00e5ff':'var(--tx2)')+'"><span style="color:var(--tx3);font-size:9px">#</span> '+c.name+'</div>';
    });
  }
  el.innerHTML=h;
  // DMs
  var dmEl=document.getElementById('chatDMList');if(!dmEl)return;
  var dms=CHAT.channels.filter(function(c){return c.type==='dm'});
  var me=getUserName();
  var dh='';
  dms.forEach(function(c){
    var other=c.name.replace(me,'').replace('·','').trim()||c.name;
    var active=CHAT.currentChannel===c.id;
    dh+='<div onclick="selectChannel(\''+c.id+'\')" style="padding:5px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:11px;'+(active?'background:rgba(0,229,255,.1);color:#00e5ff;font-weight:600':'color:var(--tx2)')+';transition:background .15s">';
    dh+='<span style="width:6px;height:6px;border-radius:50%;background:var(--gn);display:inline-block"></span>'+esc(other);
    dh+='</div>';
  });
  if(!dms.length)dh='<div style="padding:5px 12px;font-size:10px;color:var(--tx3)">No conversations</div>';
  dmEl.innerHTML=dh;
}

function filterChatChannels(val){renderChannelList(val)}

// ── SELECT CHANNEL ──
function selectChannel(id){
  CHAT.currentChannel=id;
  var ch=CHAT.channels.find(function(c){return c.id===id});
  // Update header
  var nameEl=document.getElementById('chatHeaderName');
  var descEl=document.getElementById('chatHeaderDesc');
  var inputEl=document.getElementById('chatInput');
  if(nameEl)nameEl.textContent=(ch&&ch.type==='dm'?'':'# ')+(ch?ch.name:id);
  if(descEl)descEl.textContent=ch?ch.desc||'':'';
  if(inputEl)inputEl.placeholder='Message '+(ch&&ch.type==='dm'?ch.name:'#'+(ch?ch.name:id))+'...';
  renderChannelList();
  closeThread();
  // Start listening
  listenMessages(id);
}

// ── REAL-TIME MESSAGES ──
function listenMessages(channelId){
  if(CHAT.listener)CHAT.listener();
  var msgEl=document.getElementById('chatMessages');
  if(!msgEl||!fbDb)return;
  msgEl.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:11px">Loading...</div>';
  CHAT.listener=fbDb.collection('chat_messages')
    .where('channelId','==',channelId)
    .orderBy('timestamp','asc')
    .limit(100)
    .onSnapshot(function(snap){
      CHAT.messages=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
      renderMessages();
      // Mark as read
      var uid=getUserId();
      snap.docs.forEach(function(d){
        var data=d.data();
        if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
          fbDb.collection('chat_messages').doc(d.id).update({readBy:firebase.firestore.FieldValue.arrayUnion(uid)}).catch(function(){});
        }
      });
    }, function(err){ console.warn('chat messages listener:', err.message); });
}

function renderMessages(){
  var el=document.getElementById('chatMessages');if(!el)return;
  var deptColors={'Sales':'#a855f7','Estimation':'#38bdf8','Pre-Press':'#d7ff2f','Production':'#4169E1','Quality':'#ef4444','Accounting':'#22c55e','Operations':'#C0C0C0','Administration':'#C0C0C0'};
  if(!CHAT.messages.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:40px;font-size:11px">No messages yet — start the conversation!</div>';return}
  var h='';var lastUser='';var lastDate='';
  CHAT.messages.forEach(function(m){
    var ts=m.timestamp?new Date(m.timestamp.seconds*1000):new Date();
    var dateStr=ts.toLocaleDateString();
    // Date separator
    if(dateStr!==lastDate){
      h+='<div style="text-align:center;padding:8px 0;font-size:9px;color:var(--tx3);display:flex;align-items:center;gap:8px"><div style="flex:1;height:1px;background:var(--bdr)"></div>'+ts.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})+'<div style="flex:1;height:1px;background:var(--bdr)"></div></div>';
      lastDate=dateStr;lastUser='';
    }
    var sameUser=m.user===lastUser;
    var ini=(m.user||'?').split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();
    var userColor=deptColors[m.dept]||'#00e5ff';
    var timeStr=ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    // Read receipts
    var readCount=(m.readBy||[]).length;
    var readIcon=readCount>0?'<span style="color:var(--tx3);font-size:8px;margin-left:4px" title="Read by '+readCount+'">✓✓</span>':'';

    if(!sameUser){
      h+='<div style="display:flex;gap:8px;padding-top:8px;margin-top:4px" data-msgid="'+m.id+'">';
      h+='<div style="width:28px;height:28px;border-radius:50%;background:transparent;border:2px solid '+userColor+';color:'+userColor+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:2px">'+ini+'</div>';
      h+='<div style="flex:1;min-width:0">';
      h+='<div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:12px;font-weight:700;color:var(--tx)">'+esc(m.user)+'</span><span style="font-size:9px;color:var(--tx3)">'+timeStr+readIcon+'</span></div>';
    } else {
      h+='<div style="display:flex;gap:8px;padding-left:36px" data-msgid="'+m.id+'">';
      h+='<div style="flex:1;min-width:0">';
    }
    // Message text with @mention, URL, and OS tag rendering
    var text=esc(m.text||'');
    // OS tags: [[view:id:label]]
    text=text.replace(/\[\[(\w+):([^\]:]+):([^\]]+)\]\]/g,function(_,v,id,label){return'<span onclick="goView(\''+esc(v)+'\');if(\''+esc(id)+'\'!==\'-\')openTaskDetail(\''+esc(id)+'\')" style="cursor:pointer;color:#00e5ff;background:rgba(0,229,255,.1);padding:1px 6px;border-radius:4px;font-weight:600;font-size:11px">🏷 '+esc(label)+'</span>'});
    // @mentions
    text=text.replace(/@(\w+)/g,'<span style="color:#00e5ff;font-weight:600">@$1</span>');
    // URLs → clickable links
    text=text.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" style="color:var(--ac);text-decoration:underline">$1</a>');
    if(text)h+='<div style="font-size:12px;color:var(--tx);line-height:1.5;word-break:break-word">'+esc(text)+'</div>';
    // GIF field (from GIF picker)
    if(m.gif){h+='<div style="margin-top:4px"><img src="'+esc(m.gif)+'" style="max-width:250px;max-height:180px;border-radius:8px;display:block" alt="GIF"></div>'}
    // Inline images / GIFs
    if(m.attachments&&m.attachments.length){m.attachments.forEach(function(a){
      if(a.type==='image'||a.type==='gif'){
        h+='<div style="margin-top:4px"><img src="'+esc(a.url)+'" style="max-width:280px;max-height:200px;border-radius:8px;border:1px solid var(--bdr);cursor:pointer" onclick="window.open(\''+esc(a.url).replace(/'/g,'\\&#39;')+'\',\'_blank\')" alt="'+esc(a.name||'image')+'"></div>';
      } else if(a.type==='os-link'){
        h+='<div onclick="goView(\''+esc(a.view)+'\');if(\''+esc(a.recordId)+'\'!==\'-\')openTaskDetail(\''+esc(a.recordId)+'\')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:8px;font-size:11px;color:#00e5ff;margin-top:4px;cursor:pointer;font-weight:600">🏷 '+esc(a.name||'MFX Record')+'</div>';
      } else {
        h+='<a href="'+a.url+'" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;font-size:10px;color:var(--ac);margin-top:4px;text-decoration:none">📎 '+esc(a.name||'file')+'</a>';
      }
    })}
    // Reactions
    h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">';
    if(m.reactions){Object.keys(m.reactions).forEach(function(emoji){
      var users=m.reactions[emoji]||[];
      if(users.length){
        var myReaction=users.indexOf(getUserId())>=0;
        h+='<span onclick="event.stopPropagation();toggleReaction(\''+m.id+'\',\''+emoji+'\')" style="cursor:pointer;padding:2px 6px;border-radius:10px;font-size:11px;background:'+(myReaction?'rgba(0,229,255,.15)':'var(--bg3)')+';border:1px solid '+(myReaction?'rgba(0,229,255,.3)':'var(--bdr)')+';display:inline-flex;align-items:center;gap:3px">'+emoji+' <span style="font-size:9px;color:var(--tx3)">'+users.length+'</span></span>';
      }
    })}
    // Add reaction button
    h+='<span onclick="event.stopPropagation();showReactionPicker(\''+m.id+'\')" style="cursor:pointer;padding:2px 6px;border-radius:10px;font-size:11px;background:var(--bg3);border:1px solid var(--bdr);opacity:.5;display:inline-flex;align-items:center" title="Add reaction">+</span>';
    h+='</div>';
    // Thread link
    var threadCount=m.threadCount||0;
    h+='<div style="margin-top:2px"><span onclick="openThread(\''+m.id+'\')" style="cursor:pointer;font-size:10px;color:#00e5ff;font-weight:600">'+(threadCount>0?'💬 '+threadCount+' replies':'Reply')+'</span></div>';
    h+='</div></div>';
    lastUser=m.user;
  });
  el.innerHTML=h;
  el.scrollTop=el.scrollHeight;
}

// ── SEND MESSAGE ──
function chatSend(){
  var input=document.getElementById('chatInput');
  if(!input||!input.value.trim()||!fbDb||!CHAT.currentChannel)return;
  var text=input.value.trim();
  var mentions=[];
  var mentionMatch=text.match(/@(\w+)/g);
  if(mentionMatch)mentions=mentionMatch.map(function(m){return m.substring(1)});
  var p=typeof getMFXProfile==='function'?getMFXProfile():{};
  var attachments=(window._chatPendingAttachments||[]).slice();
  window._chatPendingAttachments=[];
  var previewEl=document.getElementById('chatAttachPreview');if(previewEl)previewEl.style.display='none';
  var _ch=CHAT.channels.find(function(c){return c.id===CHAT.currentChannel});
  var _msgData={
    channelId:CHAT.currentChannel,
    text:text,
    user:getUserName(),
    userId:getUserId(),
    dept:p.dept||'Operations',
    timestamp:firebase.firestore.FieldValue.serverTimestamp(),
    reactions:{},
    mentions:mentions,
    attachments:attachments,
    readBy:[getUserId()],
    threadCount:0
  };
  if(_ch&&_ch.type==='dm'){_msgData.channelType='dm';_msgData.participants=_ch.members||[]}
  fbDb.collection('chat_messages').add(_msgData);
  // Update channel last message
  fbDb.collection('chat_channels').doc(CHAT.currentChannel).update({
    lastMessage:text.substring(0,80),
    lastMessageAt:firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(){});
  input.value='';input.style.height='36px';
  // Notify via webhook if mentions
  if(mentions.length&&typeof notifyTeam==='function'){
    notifyTeam('💬 '+getUserName()+' mentioned @'+mentions.join(', @')+' in #'+CHAT.currentChannel+': '+text.substring(0,60));
  }
}

function chatKeyDown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatSend()}
}
function chatAutoResize(el){el.style.height='36px';el.style.height=Math.min(el.scrollHeight,120)+'px'}

// ── @MENTION AUTOCOMPLETE ──
function chatCheckMention(el){
  var val=el.value;var cursor=el.selectionStart;
  var before=val.substring(0,cursor);
  var atMatch=before.match(/@(\w*)$/);
  var picker=document.getElementById('chatMentionPicker');
  if(!picker)return;
  if(!atMatch){picker.style.display='none';return}
  var query=atMatch[1].toLowerCase();
  var users=window._allTeamUsers||[];
  var filtered=users.filter(function(u){return(u.displayName||u.name||'').toLowerCase().indexOf(query)>=0}).slice(0,6);
  if(!filtered.length){picker.style.display='none';return}
  picker.style.display='block';
  picker.innerHTML=filtered.map(function(u){
    var name=u.displayName||u.name||'';
    return'<div onclick="chatInsertMention(\''+name+'\')" style="padding:6px 10px;cursor:pointer;font-size:11px;color:var(--tx);display:flex;align-items:center;gap:6px" onmouseover="this.style.background=\'rgba(0,229,255,.1)\'" onmouseout="this.style.background=\'none\'"><span style="color:#00e5ff">@</span>'+esc(name)+'</div>';
  }).join('');
}

function chatInsertMention(name){
  var el=document.getElementById('chatInput');if(!el)return;
  var val=el.value;var cursor=el.selectionStart;
  var before=val.substring(0,cursor).replace(/@\w*$/,'@'+name+' ');
  el.value=before+val.substring(cursor);
  el.focus();el.selectionStart=el.selectionEnd=before.length;
  document.getElementById('chatMentionPicker').style.display='none';
}

// ── REACTIONS ──
function toggleReaction(msgId,emoji){
  if(!fbDb)return;
  var uid=getUserId();
  var msg=CHAT.messages.find(function(m){return m.id===msgId});
  if(!msg)return;
  var reactions=msg.reactions||{};
  var users=reactions[emoji]||[];
  var update={};
  if(users.indexOf(uid)>=0){
    update['reactions.'+emoji]=firebase.firestore.FieldValue.arrayRemove(uid);
  }else{
    update['reactions.'+emoji]=firebase.firestore.FieldValue.arrayUnion(uid);
  }
  fbDb.collection('chat_messages').doc(msgId).update(update).catch(function(){});
}

function showReactionPicker(msgId){
  var existing=document.getElementById('reactionPicker-'+msgId);
  if(existing){existing.remove();return}
  var msgEl=document.querySelector('[data-msgid="'+msgId+'"]');
  if(!msgEl)return;
  var picker=document.createElement('div');
  picker.id='reactionPicker-'+msgId;
  picker.style.cssText='display:flex;gap:4px;padding:4px 8px;background:var(--card);border:1px solid var(--bdr);border-radius:8px;margin-top:4px;flex-wrap:wrap';
  picker.innerHTML=EMOJI_REACTIONS.map(function(e){
    return'<span onclick="event.stopPropagation();toggleReaction(\''+msgId+'\',\''+e+'\');this.parentElement.remove()" style="cursor:pointer;font-size:16px;padding:2px 4px;border-radius:4px" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'none\'">'+e+'</span>';
  }).join('');
  msgEl.appendChild(picker);
  setTimeout(function(){document.addEventListener('click',function rm(){picker.remove();document.removeEventListener('click',rm)})},100);
}

// ── EMOJI INPUT ──
function chatToggleEmoji(){
  var bar=document.getElementById('chatEmojiBar');if(!bar)return;
  if(bar.style.display==='flex'){bar.style.display='none';return}
  bar.style.display='flex';
  bar.innerHTML=['😊','😂','🔥','❤️','👍','🎉','💪','🚀','⚡','🧠','👀','✅','💯','🙏','😤','☕'].map(function(e){
    return'<span onclick="chatInsertEmoji(\''+e+'\')" style="cursor:pointer;font-size:18px;padding:3px">'+e+'</span>';
  }).join('');
}
function chatInsertEmoji(e){
  var el=document.getElementById('chatInput');if(!el)return;
  el.value+=e;el.focus();
}

// ── IC EMOJI PICKER ──
var IC_EMOJIS=['😊','😂','🤣','😍','🥰','😎','🤔','😴','🔥','❤️','💯','👍','👎','🎉','🙏','💪','🚀','⭐','✅','❌','👀','💬','🧠','⚡','☕','🍕','🎯','💡','📦','🏷'];
function icToggleEmoji(){
  var bar=document.getElementById('icEmojiBar');if(!bar)return;
  if(bar.style.display==='flex'){bar.style.display='none';return}
  bar.style.display='flex';
  bar.innerHTML=IC_EMOJIS.map(function(e){
    return'<span onclick="icInsertEmoji(\''+e+'\')" style="cursor:pointer;font-size:22px;padding:4px;border-radius:6px;transition:background .1s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'none\'">'+e+'</span>';
  }).join('');
}
function icInsertEmoji(e){
  var el=document.getElementById('icInput');if(!el)return;
  el.value+=e;el.focus();
}
window.icToggleEmoji=icToggleEmoji;
window.icInsertEmoji=icInsertEmoji;

// ── TEXT FORMATTING — apply to message text for display ──
function formatChatText(raw){
  var t=esc(raw);
  // Code blocks: ```text```
  t=t.replace(/```([\s\S]*?)```/g,'<pre style="background:rgba(255,255,255,.06);padding:6px 10px;border-radius:8px;font-family:monospace;font-size:11px;margin:4px 0;overflow-x:auto;white-space:pre-wrap">$1</pre>');
  // Inline code: `text`
  t=t.replace(/`([^`]+)`/g,'<code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:11px;color:#f59e0b">$1</code>');
  // Bold: **text**
  t=t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  // Italic: *text*
  t=t.replace(/\*(.+?)\*/g,'<em style="color:rgba(255,255,255,.7)">$1</em>');
  // Strikethrough: ~~text~~
  t=t.replace(/~~(.+?)~~/g,'<del style="opacity:.5">$1</del>');
  // @mentions
  t=t.replace(/@(\w+)/g,'<span style="color:#00e5ff;font-weight:600">@$1</span>');
  // URLs → clickable
  t=t.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" style="color:#00e5ff;text-decoration:underline">$1</a>');
  return t;
}
window.formatChatText=formatChatText;

// ── THREADS ──
function openThread(msgId){
  CHAT.threadOpen=msgId;
  var panel=document.getElementById('chatThreadPanel');if(panel)panel.style.display='flex';
  listenThread(msgId);
}
function closeThread(){
  CHAT.threadOpen=null;
  if(CHAT.threadListener)CHAT.threadListener();
  var panel=document.getElementById('chatThreadPanel');if(panel)panel.style.display='none';
}

function listenThread(msgId){
  if(CHAT.threadListener)CHAT.threadListener();
  var el=document.getElementById('chatThreadMessages');if(!el||!fbDb)return;
  el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px;font-size:10px">Loading...</div>';
  CHAT.threadListener=fbDb.collection('chat_messages').doc(msgId).collection('replies')
    .orderBy('timestamp','asc')
    .onSnapshot(function(snap){
      var replies=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
      // Show parent message first
      var parent=CHAT.messages.find(function(m){return m.id===msgId});
      var h='';
      if(parent){
        h+='<div style="padding:8px;background:var(--bg3);border-radius:8px;margin-bottom:8px;border-left:3px solid #00e5ff">';
        h+='<div style="font-size:10px;font-weight:700;color:var(--tx)">'+esc(parent.user)+'</div>';
        h+='<div style="font-size:11px;color:var(--tx);margin-top:2px">'+esc(parent.text)+'</div></div>';
      }
      replies.forEach(function(r){
        var ts=r.timestamp?new Date(r.timestamp.seconds*1000):new Date();
        h+='<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.03)">';
        h+='<div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:10px;font-weight:700;color:var(--tx)">'+esc(r.user)+'</span><span style="font-size:8px;color:var(--tx3)">'+ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'</span></div>';
        h+='<div style="font-size:11px;color:var(--tx);margin-top:2px;line-height:1.4">'+esc(r.text)+'</div></div>';
      });
      if(!replies.length)h+='<div style="text-align:center;color:var(--tx3);padding:12px;font-size:10px">No replies yet</div>';
      el.innerHTML=h;
      el.scrollTop=el.scrollHeight;
    }, function(err){ console.warn('chat thread listener:', err.message); });
}

function threadSend(){
  var input=document.getElementById('chatThreadInput');
  if(!input||!input.value.trim()||!fbDb||!CHAT.threadOpen)return;
  fbDb.collection('chat_messages').doc(CHAT.threadOpen).collection('replies').add({
    text:input.value.trim(),
    user:getUserName(),
    userId:getUserId(),
    timestamp:firebase.firestore.FieldValue.serverTimestamp()
  });
  // Increment thread count
  fbDb.collection('chat_messages').doc(CHAT.threadOpen).update({
    threadCount:firebase.firestore.FieldValue.increment(1)
  }).catch(function(){});
  input.value='';
}
function threadKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();threadSend()}}

// ── DMs ──
function showNewDM(){
  if(!fbDb)return;
  fbDb.collection('users').get().then(function(snap){
    var me=getUserName();
    var users=[];snap.docs.forEach(function(d){var u=d.data();if(u.displayName&&u.displayName!==me)users.push(u.displayName)});
    var h='<div class="modal-title">New Direct Message</div>';
    h+='<div style="max-height:300px;overflow-y:auto">';
    users.forEach(function(u){
      h+='<div onclick="startDM(\''+u+'\');closeModal()" style="padding:8px 12px;cursor:pointer;font-size:12px;color:var(--tx);border-bottom:1px solid var(--bdr)" onmouseover="this.style.background=\'rgba(0,229,255,.08)\'" onmouseout="this.style.background=\'none\'">'+esc(u)+'</div>';
    });
    h+='</div>';
    openModal(h);
  }).catch(function(e){ console.warn('CHAT get:', e.message); });
}

function startDM(otherUser){
  if(!fbDb)return;
  var me=getUserName();
  var dmId=[me,otherUser].sort().join('_').replace(/\s/g,'-').toLowerCase();
  fbDb.collection('chat_channels').doc(dmId).get().then(function(doc){
    if(!doc.exists){
      fbDb.collection('chat_channels').doc(dmId).set({
        name:me+' · '+otherUser,type:'dm',desc:'',dept:null,
        created:firebase.firestore.FieldValue.serverTimestamp(),
        owner:me,members:[me,otherUser],lastMessage:'',lastMessageAt:null
      }).then(function(){loadChannels();setTimeout(function(){selectChannel(dmId)},500)});
    }else{
      selectChannel(dmId);
    }
  }).catch(function(e){ console.warn('CHAT get:', e.message); });
}

// ── ONLINE USERS ──
function loadOnlineUsers(){
  if(!fbDb)return;
  var cutoff=new Date(Date.now()-5*60*1000);
  fbDb.collection('users').get().then(function(snap){
    var el=document.getElementById('chatOnlineList');if(!el)return;
    var h='';
    snap.docs.forEach(function(d){
      var u=d.data();var name=u.displayName||u.email||'';if(!name)return;
      var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;
      var online=ls&&ls>cutoff;
      if(online){
        h+='<div onclick="startDM(\''+name+'\')" style="padding:3px 0;cursor:pointer;display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx2)"><span style="width:6px;height:6px;border-radius:50%;background:var(--gn);display:inline-block"></span>'+esc(name)+'</div>';
      }
    });
    if(!h)h='<div style="font-size:10px;color:var(--tx3);padding:4px 0">No one online</div>';
    el.innerHTML=h;
  }).catch(function(e){ console.warn('CHAT get:', e.message); });
}

// ── MOBILE SIDEBAR TOGGLE ──
// On mobile, sidebar can be toggled
function toggleChatSidebar(){
  var sb=document.getElementById('chatSidebar');
  if(!sb)return;
  sb.style.display=sb.style.display==='none'?'flex':'none';
}

// ── ATTACHMENTS: IMAGE, GIF, FILE LINK, OS TAG ──
window._chatPendingAttachments=[];

function chatAddImage(){
  var url=prompt('Paste image URL (jpg, png, gif):');
  if(!url||!url.trim())return;
  window._chatPendingAttachments.push({type:'image',url:url.trim(),name:'Image'});
  chatShowAttachPreview();
}

// ── GIF PICKER (GIPHY API) ──
// Set your GIPHY API key: get one free at https://developers.giphy.com/dashboard/
// Store in localStorage or hardcode below
var GIPHY_KEY=localStorage.getItem('mfx_giphy_key')||'GDbNFd3wNVLQwb3bnFRPYinHvy8bskQT';

function chatSearchGif(target){
  // target: 'chat' (main chat) or 'ic' (instant chat)
  target=target||'chat';
  var h='<div style="display:flex;flex-direction:column;height:400px;max-height:70vh">';
  h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:8px;display:flex;align-items:center;gap:6px"><span style="font-size:18px">GIF</span> Search</div>';
  if(!GIPHY_KEY){
    h+='<div style="padding:12px;background:var(--bg3);border-radius:8px;margin-bottom:8px">';
    h+='<div style="font-size:11px;color:var(--or);font-weight:600;margin-bottom:4px">GIPHY API Key Required</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:6px">Get a free key at developers.giphy.com/dashboard</div>';
    h+='<input id="gifApiKeyInput" placeholder="Paste your GIPHY API key..." style="width:100%;padding:6px 8px;font-size:11px;margin-bottom:4px">';
    h+='<button onclick="gifSaveKey()" class="btn btn-pr btn-sm" style="width:100%">Save Key</button>';
    h+='</div>';
  }
  h+='<div style="display:flex;gap:4px;margin-bottom:8px">';
  h+='<input id="gifSearchInput" placeholder="Search GIFs..." style="flex:1;padding:8px 10px;font-size:12px" onkeydown="if(event.key===\'Enter\')gifDoSearch(\''+target+'\')"'+(GIPHY_KEY?'':' disabled')+'>';
  h+='<button onclick="gifDoSearch(\''+target+'\')" class="btn btn-pr btn-sm"'+(GIPHY_KEY?'':' disabled')+'>Search</button>';
  h+='</div>';
  // Trending on load
  h+='<div id="gifGrid" style="flex:1;overflow-y:auto;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start;justify-content:center"></div>';
  h+='<div style="text-align:center;padding:4px;font-size:8px;color:var(--tx3)">Powered by GIPHY</div>';
  h+='</div>';
  openModal(h);
  if(GIPHY_KEY)gifLoadTrending(target);
}

function gifSaveKey(){
  var inp=document.getElementById('gifApiKeyInput');
  if(!inp||!inp.value.trim())return;
  GIPHY_KEY=inp.value.trim();
  localStorage.setItem('mfx_giphy_key',GIPHY_KEY);
  closeModal();
  toast('GIPHY key saved','ok');
  chatSearchGif();
}

function gifLoadTrending(target){
  var grid=document.getElementById('gifGrid');
  if(!grid)return;
  grid.innerHTML='<div style="padding:20px;color:var(--tx3);font-size:10px;width:100%;text-align:center">Loading trending...</div>';
  fetch('https://api.giphy.com/v1/gifs/trending?api_key='+GIPHY_KEY+'&limit=20&rating=pg')
    .then(function(r){return r.json()})
    .then(function(json){gifRenderResults(json.data,target)})
    .catch(function(e){grid.innerHTML='<div style="padding:20px;color:var(--rd);font-size:10px;width:100%;text-align:center">Failed to load — check API key</div>'});
}

function gifDoSearch(target){
  var inp=document.getElementById('gifSearchInput');
  if(!inp||!inp.value.trim()||!GIPHY_KEY)return;
  var q=encodeURIComponent(inp.value.trim());
  var grid=document.getElementById('gifGrid');
  if(!grid)return;
  grid.innerHTML='<div style="padding:20px;color:var(--tx3);font-size:10px;width:100%;text-align:center">Searching...</div>';
  fetch('https://api.giphy.com/v1/gifs/search?api_key='+GIPHY_KEY+'&q='+q+'&limit=24&rating=pg')
    .then(function(r){return r.json()})
    .then(function(json){gifRenderResults(json.data,target)})
    .catch(function(e){grid.innerHTML='<div style="padding:20px;color:var(--rd);font-size:10px;width:100%;text-align:center">Search failed</div>'});
}

function gifRenderResults(gifs,target){
  var grid=document.getElementById('gifGrid');if(!grid)return;
  if(!gifs||!gifs.length){grid.innerHTML='<div style="padding:20px;color:var(--tx3);font-size:10px;width:100%;text-align:center">No GIFs found</div>';return}
  var h='';
  gifs.forEach(function(g){
    var preview=g.images.fixed_height_small.url;
    var full=g.images.fixed_height.url;
    h+='<img src="'+preview+'" onclick="gifSelect(\''+full+'\',\''+target+'\')" style="height:100px;border-radius:6px;cursor:pointer;object-fit:cover;transition:transform .15s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">';
  });
  grid.innerHTML=h;
}

// IC pending GIF and reply state
var _icPendingGif=null;
var _icReplyTo=null; // {id, user, text}

function gifSelect(url,target){
  closeModal();
  if(target==='ic'){
    // Store as pending — show preview, don't send yet
    _icPendingGif=url;
    icShowPreview();
  }else{
    // Main chat — add as attachment
    window._chatPendingAttachments.push({type:'gif',url:url,name:'GIF'});
    chatShowAttachPreview();
  }
}

function icShowPreview(){
  var bar=document.getElementById('icPreviewBar');
  if(!bar){
    // Create preview bar above input
    var inputBar=document.getElementById('icInputBar');
    if(!inputBar)return;
    bar=document.createElement('div');
    bar.id='icPreviewBar';
    bar.style.cssText='padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:6px';
    inputBar.insertBefore(bar,inputBar.firstChild);
  }
  var h='';
  // Reply context
  if(_icReplyTo){
    h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,229,255,.06);border-left:3px solid #00e5ff;border-radius:0 8px 8px 0">';
    h+='<div style="flex:1;min-width:0"><div style="font-size:9px;color:#00e5ff;font-weight:600">Replying to '+esc(_icReplyTo.user)+'</div>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc((_icReplyTo.text||'GIF').substring(0,50))+'</div></div>';
    h+='<span onclick="icClearReply()" style="cursor:pointer;color:rgba(255,255,255,.3);font-size:14px">&times;</span></div>';
  }
  // GIF preview
  if(_icPendingGif){
    h+='<div style="display:flex;align-items:center;gap:8px">';
    h+='<img src="'+esc(_icPendingGif)+'" style="height:60px;border-radius:8px;border:1px solid rgba(255,255,255,.1)">';
    h+='<div style="flex:1"><div style="font-size:10px;color:rgba(255,255,255,.4)">GIF ready to send</div></div>';
    h+='<span onclick="icClearGif()" style="cursor:pointer;color:rgba(255,255,255,.3);font-size:14px">&times;</span></div>';
  }
  // File preview
  if(_icPendingFile){
    h+='<div style="display:flex;align-items:center;gap:8px">';
    if(_icPendingFile.type&&_icPendingFile.type.indexOf('image')===0){
      h+='<img src="'+esc(_icPendingFile.url)+'" style="height:60px;border-radius:8px;border:1px solid rgba(255,255,255,.1)">';
    }else{
      h+='<div style="width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:20px">&#128196;</div>';
    }
    h+='<div style="flex:1;min-width:0"><div style="font-size:10px;color:#00e5ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(_icPendingFile.name)+'</div>';
    h+='<div style="font-size:9px;color:rgba(255,255,255,.3)">'+(_icPendingFile.size?Math.round(_icPendingFile.size/1024)+'KB':'File')+' ready to send</div></div>';
    h+='<span onclick="_icPendingFile=null;icShowPreview()" style="cursor:pointer;color:rgba(255,255,255,.3);font-size:14px">&times;</span></div>';
  }
  if(!h){bar.remove();return}
  bar.innerHTML=h;
  bar.style.display='flex';
}
function icClearGif(){_icPendingGif=null;icShowPreview()}
function icClearReply(){_icReplyTo=null;icShowPreview()}
function icSetReply(msgId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg)return;
  _icReplyTo={id:msgId,user:msg.user,text:msg.text||'GIF'};
  icShowPreview();
  var inp=document.getElementById('icInput');if(inp)inp.focus();
}
window.icClearGif=icClearGif;
window.icClearReply=icClearReply;
window.icSetReply=icSetReply;

window.chatSearchGif=chatSearchGif;
window.gifSaveKey=gifSaveKey;
window.gifDoSearch=gifDoSearch;
window.gifSelect=gifSelect;

function chatAddFileLink(){
  var url=prompt('Paste file/document link:');
  if(!url||!url.trim())return;
  var name=prompt('File name (optional):')||'File';
  window._chatPendingAttachments.push({type:'file',url:url.trim(),name:name});
  chatShowAttachPreview();
}

function chatAddOSTag(){
  // Show OS record/view picker
  var views={
    'quotes':'Quotes','customers':'Clients','orders':'Orders','production':'Production',
    'jobtracker':'Job Tracker','logistics':'Logistics','ppd':'Pre-Press',
    'capa':'CAPA/NCR','training':'Training','hr':'HR','dashboard':'Dashboard'
  };
  var h='<div class="modal-title">Link MFX OS Record</div>';
  h+='<div style="max-height:350px;overflow-y:auto">';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Select a view to link, or paste a record ID</div>';
  Object.keys(views).forEach(function(v){
    h+='<div onclick="chatInsertOSTag(\''+v+'\',\'-\',\''+views[v]+'\')" style="padding:8px 12px;cursor:pointer;font-size:12px;color:var(--tx);border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:6px" onmouseover="this.style.background=\'rgba(0,229,255,.08)\'" onmouseout="this.style.background=\'none\'"><span style="color:#00e5ff">🏷</span>'+views[v]+'</div>';
  });
  h+='<div style="padding:8px 12px;border-top:1px solid var(--bdr)">';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:4px">Or link a specific record:</div>';
  h+='<div style="display:flex;gap:4px"><input id="osTagView" placeholder="View (e.g. quotes)" style="flex:1;padding:4px 8px;font-size:11px"><input id="osTagId" placeholder="Record ID" style="flex:1;padding:4px 8px;font-size:11px"><input id="osTagLabel" placeholder="Label" style="flex:1;padding:4px 8px;font-size:11px"></div>';
  h+='<button class="btn btn-pr btn-sm" onclick="chatInsertOSTagCustom()" style="margin-top:6px;width:100%">Insert Link</button>';
  h+='</div></div>';
  openModal(h);
}

function chatInsertOSTag(view,id,label){
  closeModal();
  var el=document.getElementById('chatInput');if(!el)return;
  el.value+=' [['+view+':'+id+':'+label+']] ';
  el.focus();
}

function chatInsertOSTagCustom(){
  var v=(document.getElementById('osTagView')||{}).value||'dashboard';
  var id=(document.getElementById('osTagId')||{}).value||'-';
  var label=(document.getElementById('osTagLabel')||{}).value||v;
  closeModal();
  var el=document.getElementById('chatInput');if(!el)return;
  el.value+=' [['+v+':'+id+':'+label+']] ';
  el.focus();
}

function chatShowAttachPreview(){
  var el=document.getElementById('chatAttachPreview');if(!el)return;
  if(!window._chatPendingAttachments.length){el.style.display='none';return}
  el.style.display='block';
  el.innerHTML=window._chatPendingAttachments.map(function(a,i){
    var preview='';
    if(a.type==='image'||a.type==='gif')preview='<img src="'+a.url+'" style="height:40px;border-radius:4px;margin-right:4px">';
    return'<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:6px;font-size:10px;color:var(--tx2);margin-right:4px">'+preview+(a.type==='gif'?'GIF':a.type==='image'?'📷':'📎')+' '+esc(a.name)+' <span onclick="chatRemoveAttach('+i+')" style="cursor:pointer;color:var(--rd);margin-left:4px">✕</span></div>';
  }).join('');
}

function chatRemoveAttach(i){
  window._chatPendingAttachments.splice(i,1);
  chatShowAttachPreview();
}

// ── CREATE CHANNEL IN GROUP ──
function createChannelInGroup(groupKey){
  var group=CHANNEL_GROUPS.find(function(g){return g.key===groupKey});
  if(!group)return;
  var deptSelect='';
  if(groupKey==='department'){
    deptSelect='<div class="fg" style="margin-top:6px"><label style="font-size:10px;color:var(--tx3)">Department</label><select id="newChDept" style="width:100%;padding:6px 8px;font-size:11px"><option value="">— Select —</option>';
    ['Sales','Estimation','Pre-Press','Production','Quality','Accounting','Operations','Administration'].forEach(function(d){deptSelect+='<option value="'+d+'">'+d+'</option>'});
    deptSelect+='</select></div>';
  }
  var h='<div class="modal-title" style="color:'+group.color+'">New Channel in '+group.label+'</div>';
  h+='<div class="fg"><label style="font-size:10px;color:var(--tx3)">Channel Name</label><input id="newChName" placeholder="e.g. my-channel" style="width:100%;padding:6px 8px;font-size:11px"></div>';
  h+='<div class="fg" style="margin-top:6px"><label style="font-size:10px;color:var(--tx3)">Description (optional)</label><input id="newChDesc" placeholder="What is this channel for?" style="width:100%;padding:6px 8px;font-size:11px"></div>';
  h+=deptSelect;
  h+='<button class="btn btn-pr" onclick="submitNewChannel(\''+groupKey+'\')" style="width:100%;margin-top:10px">Create Channel</button>';
  h+='<button class="btn btn-ghost" onclick="closeModal()" style="width:100%;margin-top:4px">Cancel</button>';
  openModal(h);
}

function submitNewChannel(groupKey){
  var name=(document.getElementById('newChName')||{}).value||'';
  var desc=(document.getElementById('newChDesc')||{}).value||'';
  var deptEl=document.getElementById('newChDept');
  var dept=deptEl?deptEl.value:'';
  if(!name.trim()){toast('Channel name required','err');return}
  var id=name.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-');
  if(!fbDb){toast('Database not available','err');return}
  fbDb.collection('chat_channels').doc(id).set({
    name:id,type:'channel',group:groupKey,desc:desc,dept:dept||null,
    created:firebase.firestore.FieldValue.serverTimestamp(),
    owner:getUserName(),lastMessage:'',lastMessageAt:null,members:[]
  }).then(function(){
    closeModal();toast('Channel #'+id+' created','ok');
    loadChannels();setTimeout(function(){selectChannel(id)},500);
  }).catch(function(e){toast('Error: '+e.message,'err')});
}

// ── CHANNEL GROUP COLLAPSE ──
if(!window._chatCollapsed)window._chatCollapsed={};
function toggleChatGroup(key){
  if(!window._chatCollapsed)window._chatCollapsed={};
  window._chatCollapsed[key]=!window._chatCollapsed[key];
  renderChannelList();
}

// ── EXPOSE GLOBALLY ──
window.renderChat=renderChat;
window.selectChannel=selectChannel;
window.chatSend=chatSend;
window.chatKeyDown=chatKeyDown;
window.chatAutoResize=chatAutoResize;
window.chatCheckMention=chatCheckMention;
window.chatInsertMention=chatInsertMention;
window.toggleReaction=toggleReaction;
window.showReactionPicker=showReactionPicker;
window.chatToggleEmoji=chatToggleEmoji;
window.chatInsertEmoji=chatInsertEmoji;
window.openThread=openThread;
window.closeThread=closeThread;
window.threadSend=threadSend;
window.threadKeyDown=threadKeyDown;
window.showNewDM=showNewDM;
window.startDM=startDM;
window.filterChatChannels=filterChatChannels;
window.toggleChatSidebar=toggleChatSidebar;
window.chatAddImage=chatAddImage;
window.chatSearchGif=chatSearchGif;
window.chatAddFileLink=chatAddFileLink;
window.chatAddOSTag=chatAddOSTag;
window.chatInsertOSTag=chatInsertOSTag;
window.chatInsertOSTagCustom=chatInsertOSTagCustom;
window.chatRemoveAttach=chatRemoveAttach;
window.toggleChatGroup=toggleChatGroup;
window.createChannelInGroup=createChannelInGroup;
window.submitNewChannel=submitNewChannel;

// Cleanup listeners when leaving chat view
function chatDetachListeners(){
  if(CHAT.listener){CHAT.listener();CHAT.listener=null;}
  if(CHAT.threadListener){CHAT.threadListener();CHAT.threadListener=null;}
}
window.chatDetachListeners=chatDetachListeners;

// Hook into MFX event bus to detach on view change
if(typeof MFX!=='undefined'&&MFX.on){
  MFX.on('view.*',function(data){
    // If navigating away from chat/supportboard, detach listeners
    if(typeof S!=='undefined'&&S.view!=='supportboard'){
      chatDetachListeners();
    }
  });
}
// Also hook into goView if available
var _chatOrigGoView=window.goView;
if(typeof _chatOrigGoView==='function'){
  window.goView=function(v){
    if(v!=='supportboard')chatDetachListeners();
    _chatOrigGoView(v);
  };
}

// ══════════════════════════════════════════════════════════════════
// INSTANT CHAT POPUP — floating chat from bottom bar center button
// ══════════════════════════════════════════════════════════════════

var IC={
  open:false,
  view:'list', // 'list' or 'conversation'
  activeChat:null, // channel id
  listener:null,
  _channelListener:null,
  messages:[],
  unreadCount:0,
  unreadListener:null,
  onlineUsers:[],
  allUsers:[],
  _editingMsgId:null
};

var _icTypingThrottle=0;
var _icTypingTimeout=null;
var _icPendingFile=null;
var _icPriority=false;
var _icMutedChannels=[];

function toggleInstantChat(){
  var popup=document.getElementById('instantChatPopup');
  if(!popup)return;
  IC.open=!IC.open;
  popup.style.display=IC.open?'flex':'none';
  if(IC.open){
    icShowList();
    icStartUnreadListener();
    icLoadOnlineUsers();
    icRenderSpaces();
  }else{
    if(IC.listener){IC.listener();IC.listener=null;}
  }
}

function icShowList(){
  IC.view='list';
  if(IC.listener){IC.listener();IC.listener=null;}
  if(IC._channelListener){IC._channelListener();IC._channelListener=null;}
  var sidebar=document.getElementById('icSidebarList');
  if(!sidebar||!fbDb){return}
  sidebar.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:11px">Loading...</div>';
  // Show welcome in conversation panel if no chat is open
  if(!IC.activeChat){
    var body=document.getElementById('icBody');
    if(body)body.innerHTML='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,.2);padding:40px"><div style="font-size:48px;opacity:.3">💬</div><div style="font-size:14px;font-weight:600">Select a conversation</div><div style="font-size:11px;opacity:.6">Choose from the left panel</div></div>';
    var inputBar=document.getElementById('icInputBar');if(inputBar)inputBar.style.display='none';
    var convoHeader=document.getElementById('icConvoHeader');if(convoHeader)convoHeader.style.display='none';
  }

  // Load channels + recent messages for unread counts
  var uid=getUserId();
  Promise.all([
    fbDb.collection('chat_channels').get(),
    fbDb.collection('chat_messages').orderBy('timestamp','desc').limit(200).get()
  ]).then(function(results){
    var channelSnap=results[0];var msgSnap=results[1];
    var channels=channelSnap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    channels.sort(function(a,b){
      var at=a.lastMessageAt?a.lastMessageAt.seconds:0;
      var bt=b.lastMessageAt?b.lastMessageAt.seconds:0;
      return bt-at;
    });

    // Count unreads per channel
    var unreadByChannel={};
    msgSnap.docs.forEach(function(d){
      var data=d.data();
      if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
        var chId=data.channelId||'';
        unreadByChannel[chId]=(unreadByChannel[chId]||0)+1;
      }
    });

    var me=getUserName();
    var dms=channels.filter(function(c){return c.type==='dm'&&(c.members||[]).indexOf(me)>=0});
    var groups=channels.filter(function(c){return c.type==='channel'});

    // Avatar color palette based on name hash
    var _avatarGradients=[
      'linear-gradient(135deg,#667eea,#764ba2)',
      'linear-gradient(135deg,#f093fb,#f5576c)',
      'linear-gradient(135deg,#4facfe,#00f2fe)',
      'linear-gradient(135deg,#43e97b,#38f9d7)',
      'linear-gradient(135deg,#fa709a,#fee140)',
      'linear-gradient(135deg,#a18cd1,#fbc2eb)',
      'linear-gradient(135deg,#fccb90,#d57eeb)',
      'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
      'linear-gradient(135deg,#f5576c,#ff6a88)',
      'linear-gradient(135deg,#00e5ff,#0099cc)'
    ];
    function _avatarGrad(name){var hash=0;for(var i=0;i<name.length;i++)hash=name.charCodeAt(i)+((hash<<5)-hash);return _avatarGradients[Math.abs(hash)%_avatarGradients.length]}

    // Check which users are online
    var onlineSet={};
    IC.allUsers.forEach(function(u){if(u.online)onlineSet[u.name]=true});

    var h='';

    // ── Online avatars row (iMessage-style circles) ──
    var onlineOthers=IC.allUsers.filter(function(u){return u.name!==me});
    if(onlineOthers.length){
      h+='<div id="icOnlineSection" style="padding:12px 14px 8px;display:flex;gap:10px;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.04)">';
      onlineOthers.forEach(function(u){
        var isOn=onlineSet[u.name];
        h+='<div onclick="icStartDM(\''+esc(u.name)+'\')" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:48px">';
        h+='<div style="position:relative"><div style="width:42px;height:42px;border-radius:50%;background:'+_avatarGrad(u.name)+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;'+(isOn?'box-shadow:0 0 0 2px #0d1117,0 0 0 4px #2ee89e':'opacity:.4')+'">'+icInitials(u.name)+'</div>';
        if(isOn)h+='<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:#2ee89e;border:2px solid #0d1117"></div>';
        h+='</div>';
        h+='<span style="font-size:9px;color:'+(isOn?'#fff':'var(--tx3)')+';max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center">'+esc(u.name.split(' ')[0])+'</span>';
        h+='</div>';
      });
      h+='</div>';
    }

    // ── Search bar ──
    h+='<div style="padding:8px 14px"><input placeholder="Search conversations..." style="width:100%;padding:8px 14px;font-size:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);border-radius:12px;color:#fff;outline:none;font-family:inherit" oninput="icFilterList(this.value)"></div>';

    // ── DMs ──
    h+='<div style="padding:4px 14px 2px;font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center">Messages<span onclick="icNewDM()" style="cursor:pointer;color:#00e5ff;font-size:16px;padding:0 2px;line-height:1">+</span></div>';
    if(dms.length){
      dms.forEach(function(c){
        var other=c.name.replace(me,'').replace('·','').trim()||c.name;
        var lastMsg=c.lastMessage||'';
        var time=c.lastMessageAt?icTimeAgo(c.lastMessageAt):'';
        var unread=unreadByChannel[c.id]||0;
        var isUnread=unread>0;
        var isOn=onlineSet[other];
        h+='<div data-ic-channel="'+c.id+'" onclick="icOpenChat(\''+c.id+'\',\''+esc(other)+'\')" style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .15s;border-radius:10px;margin:1px 4px;'+(isUnread?'background:rgba(0,229,255,.06)':'')+'" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\''+(isUnread?'rgba(0,229,255,.06)':'transparent')+'\'">';
        // Avatar with online dot
        h+='<div style="position:relative;flex-shrink:0"><div style="width:36px;height:36px;border-radius:50%;background:'+_avatarGrad(other)+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff">'+icInitials(other)+'</div>';
        if(isOn)h+='<div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;border-radius:50%;background:#2ee89e;border:2px solid #0d1117"></div>';
        h+='</div>';
        // Content
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center">';
        h+='<span style="font-size:13px;font-weight:'+(isUnread?'700':'500')+';color:'+(isUnread?'#fff':'rgba(255,255,255,.7)')+'">'+esc(other)+'</span>';
        h+='<span style="font-size:10px;color:'+(isUnread?'#00e5ff':'rgba(255,255,255,.25)')+';font-weight:'+(isUnread?'600':'400')+'">'+time+'</span>';
        h+='</div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">';
        h+='<span style="font-size:11px;color:'+(isUnread?'rgba(255,255,255,.6)':'rgba(255,255,255,.25)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;'+(isUnread?'font-weight:500':'')+'">'+esc(lastMsg.substring(0,45))+'</span>';
        if(isUnread)h+='<span style="background:#00e5ff;color:#000;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;min-width:18px;text-align:center;margin-left:8px;flex-shrink:0">'+unread+'</span>';
        h+='</div></div></div>';
      });
    }else{
      h+='<div style="padding:16px 14px;font-size:12px;color:rgba(255,255,255,.3);text-align:center">No conversations yet</div>';
    }

    // ── Group Channels ──
    h+='<div style="padding:10px 14px 2px;font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(255,255,255,.04);margin-top:4px">Channels</div>';
    groups.slice(0,12).forEach(function(c){
      var lastMsg=c.lastMessage||'';
      var time=c.lastMessageAt?icTimeAgo(c.lastMessageAt):'';
      var unread=unreadByChannel[c.id]||0;
      var isUnread=unread>0;
      h+='<div data-ic-channel="'+c.id+'" onclick="icOpenChat(\''+c.id+'\',\'#'+esc(c.name)+'\')" style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .15s;border-radius:10px;margin:1px 4px;'+(isUnread?'background:rgba(0,229,255,.06)':'')+'" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\''+(isUnread?'rgba(0,229,255,.06)':'transparent')+'\'">';
      h+='<div style="width:36px;height:36px;border-radius:10px;background:'+(isUnread?'linear-gradient(135deg,#00e5ff,#0099cc)':'rgba(255,255,255,.06)')+';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:'+(isUnread?'#000':'rgba(255,255,255,.3)')+';flex-shrink:0">#</div>';
      h+='<div style="flex:1;min-width:0">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center">';
      h+='<span style="font-size:13px;font-weight:'+(isUnread?'700':'500')+';color:'+(isUnread?'#fff':'rgba(255,255,255,.7)')+'">'+esc(c.name)+'</span>';
      h+='<span style="font-size:10px;color:'+(isUnread?'#00e5ff':'rgba(255,255,255,.25)')+'">'+time+'</span>';
      h+='</div>';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">';
      h+='<span style="font-size:11px;color:'+(isUnread?'rgba(255,255,255,.6)':'rgba(255,255,255,.25)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">'+esc(lastMsg.substring(0,45))+'</span>';
      if(isUnread)h+='<span style="background:#00e5ff;color:#000;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;min-width:18px;text-align:center;margin-left:8px;flex-shrink:0">'+unread+'</span>';
      h+='</div></div></div>';
    });

    sidebar.innerHTML=h;
  }).catch(function(e){
    sidebar.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11px">Could not load chats</div>';
    console.warn('IC load:',e.message);
  });
}

function icOpenChat(channelId,displayName){
  IC.view='conversation';
  IC.activeChat=channelId;
  // Update conversation header
  var convoHeader=document.getElementById('icConvoHeader');
  if(convoHeader){convoHeader.style.display='flex'}
  var convoTitle=document.getElementById('icConvoTitle');
  if(convoTitle)convoTitle.textContent=displayName;
  // Show member count
  var memberCountEl=document.getElementById('icMemberCount');
  if(memberCountEl&&fbDb){
    fbDb.collection('chat_channels').doc(channelId).get().then(function(doc){
      if(doc.exists){
        var data=doc.data();
        var members=data.members||[];
        if(members.length>0)memberCountEl.textContent=members.length+' members';
        else memberCountEl.textContent='';
      }
    }).catch(function(){});
  }
  // Highlight active in sidebar
  var items=document.querySelectorAll('[data-ic-channel]');
  for(var si=0;si<items.length;si++){
    items[si].style.background=items[si].getAttribute('data-ic-channel')===channelId?'rgba(0,229,255,.1)':'';
  }
  var inputBar=document.getElementById('icInputBar');
  if(inputBar)inputBar.style.display='block';
  var body=document.getElementById('icBody');
  if(!body||!fbDb)return;
  body.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:11px">Loading...</div>';

  if(IC.listener)IC.listener();
  IC.listener=fbDb.collection('chat_messages')
    .where('channelId','==',channelId)
    .orderBy('timestamp','asc')
    .limit(50)
    .onSnapshot(function(snap){
      var serverMsgs=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
      // Merge: keep optimistic messages that haven't arrived from server yet
      var serverIds={};
      serverMsgs.forEach(function(m){serverIds[m.id]=true});
      // Remove optimistic messages whose real version has arrived
      var pending=IC.messages.filter(function(m){
        if(!m._optimistic)return false;
        // Check if server has this message by realId or by matching text+user+timestamp
        if(m._realId&&serverIds[m._realId])return false;
        // Also remove if a server message matches same text+user within last 5s
        for(var i=serverMsgs.length-1;i>=Math.max(0,serverMsgs.length-5);i--){
          var s=serverMsgs[i];
          if(s.user===m.user&&s.text===m.text&&!m._failed)return false;
        }
        return true; // keep — still pending
      });
      IC.messages=serverMsgs.concat(pending);
      if(!IC._editingMsgId)icRenderMessages();
      // Mark as read
      var uid=getUserId();
      var markOps=[];
      snap.docs.forEach(function(d){
        var data=d.data();
        if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
          markOps.push(fbDb.collection('chat_messages').doc(d.id).update({readBy:firebase.firestore.FieldValue.arrayUnion(uid)}).catch(function(e){console.warn('icMarkRead:',e)}));
        }
      });
      // After marking all read, the global unread listener will re-fire and update the badge
    },function(err){console.warn('IC messages:',err.message)});

  // Typing indicator listener on channel doc
  if(IC._channelListener){IC._channelListener();IC._channelListener=null;}
  IC._channelListener=fbDb.collection('chat_channels').doc(channelId).onSnapshot(function(docSnap){
    var data=docSnap.data();if(!data)return;
    var typing=data.typing||{};
    var myUid=getUserId();
    var now=Date.now();
    var typers=[];
    Object.keys(typing).forEach(function(tUid){
      if(tUid===myUid)return;
      var entry=typing[tUid];
      if(!entry||!entry.at)return;
      var atMs=entry.at.seconds?entry.at.seconds*1000:0;
      if(now-atMs>6000)return;
      typers.push(entry.name||'Someone');
    });
    var typingBar=document.getElementById('icTypingBar');
    if(!typingBar){
      var body2=document.getElementById('icBody');
      if(body2){
        typingBar=document.createElement('div');
        typingBar.id='icTypingBar';
        typingBar.style.cssText='padding:2px 14px;font-size:10px;color:rgba(255,255,255,.4);min-height:16px';
        body2.parentNode.insertBefore(typingBar,body2.nextSibling);
      }
    }
    if(typingBar){
      if(typers.length===0){
        typingBar.innerHTML='';
      }else if(typers.length===1){
        typingBar.innerHTML=esc(typers[0])+' is typing<span class="ic-typing-dots"><span>.</span><span>.</span><span>.</span></span>';
      }else{
        typingBar.innerHTML=esc(typers[0])+' and '+esc(typers[1])+' are typing<span class="ic-typing-dots"><span>.</span><span>.</span><span>.</span></span>';
      }
    }
  },function(err){console.warn('IC typing:',err.message)});

  // Setup drag-drop for file sharing
  icSetupDragDrop();

  // Focus input
  setTimeout(function(){var inp=document.getElementById('icInput');if(inp)inp.focus()},300);
}

function icRenderMessages(){
  var body=document.getElementById('icBody');if(!body)return;
  if(!IC.messages.length){body.innerHTML='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,.3);font-size:13px;padding:40px"><div style="font-size:40px;opacity:.3">💬</div>No messages yet<div style="font-size:11px;opacity:.6">Send a message to start the conversation</div></div>';return}
  var me=getUserName();var uid=getUserId();var h='';var lastDate='';var lastUser='';
  IC.messages.forEach(function(m){
    var ts=m.timestamp?new Date(m.timestamp.seconds*1000):new Date();
    var dateStr=ts.toLocaleDateString();
    if(dateStr!==lastDate){
      h+='<div style="text-align:center;padding:10px 0 6px"><span style="font-size:10px;color:rgba(255,255,255,.25);background:rgba(255,255,255,.04);padding:3px 12px;border-radius:10px">'+ts.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</span></div>';
      lastDate=dateStr;lastUser='';
    }
    var isMe=m.user===me;
    var sameUser=m.user===lastUser;
    var timeStr=ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    var bubbleRadius=isMe?'18px 18px 4px 18px':'18px 18px 18px 4px';

    // Deleted message
    if(m.deleted){
      h+='<div class="ic-msg-wrap" style="display:flex;flex-direction:column;align-items:'+(isMe?'flex-end':'flex-start')+';padding:6px 14px 1px;position:relative" data-icmsg="'+esc(m.id)+'">';
      h+='<div style="max-width:78%;padding:8px 14px;border-radius:'+bubbleRadius+';background:rgba(255,255,255,.03);font-size:12px;color:rgba(255,255,255,.25);font-style:italic">This message was deleted</div>';
      h+='</div>';
      lastUser=m.user;
      return;
    }

    // Priority wrapper
    var priorityStyle='';
    if(m.priority==='urgent'){
      priorityStyle='border-left:3px solid #ef4444;padding-left:11px;';
    }

    h+='<div class="ic-msg-wrap" style="display:flex;flex-direction:column;align-items:'+(isMe?'flex-end':'flex-start')+';padding:'+(sameUser?'1px':'6px')+' 14px 1px;position:relative;'+priorityStyle+'" data-icmsg="'+esc(m.id)+'">';

    // Forwarded header
    if(m.forwardedFrom){
      h+='<div style="font-size:9px;color:rgba(255,255,255,.35);margin-bottom:2px;display:flex;align-items:center;gap:3px">';
      h+='<span style="font-size:11px">&#8599;</span> Forwarded from '+esc(m.forwardedFrom.user)+'</div>';
    }

    // Pinned icon
    if(m.pinned){
      h+='<div style="font-size:9px;color:rgba(255,255,255,.3);margin-bottom:1px">&#128204; Pinned</div>';
    }

    // Sender name
    if(!isMe&&!sameUser)h+='<span style="font-size:10px;font-weight:600;color:rgba(255,255,255,.4);margin-bottom:2px;margin-left:4px">'+esc(m.user)+'</span>';

    // Reply context
    if(m.replyTo){
      h+='<div style="max-width:78%;padding:4px 10px;margin-bottom:2px;border-left:2px solid #00e5ff;border-radius:0 8px 8px 0;background:rgba(0,229,255,.04);font-size:10px">';
      h+='<div style="color:#00e5ff;font-weight:600;font-size:9px">'+esc(m.replyTo.user)+'</div>';
      h+='<div style="color:rgba(255,255,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc((m.replyTo.text||'').substring(0,60))+'</div></div>';
    }

    // GIF
    if(m.gif){
      h+='<div style="max-width:75%;border-radius:'+bubbleRadius+';overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2)"><img src="'+esc(m.gif)+'" style="max-width:220px;max-height:160px;display:block"></div>';
    }

    // Attachments
    if(m.attachments&&m.attachments.length){
      m.attachments.forEach(function(att){
        if(att.type==='image'){
          h+='<div style="max-width:75%;border-radius:'+bubbleRadius+';overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2);margin-bottom:4px"><img src="'+esc(att.url)+'" style="max-width:220px;max-height:160px;display:block"></div>';
        }else{
          h+='<a href="'+esc(att.url)+'" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.06);border-radius:10px;text-decoration:none;max-width:75%;margin-bottom:4px">';
          h+='<span style="font-size:20px">&#128196;</span>';
          h+='<div style="flex:1;min-width:0"><div style="font-size:11px;color:#00e5ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(att.name)+'</div>';
          h+='<div style="font-size:9px;color:rgba(255,255,255,.3)">'+(att.size?Math.round(att.size/1024)+'KB':'File')+'</div></div></a>';
        }
      });
    }

    // Text bubble
    if(m.text){
      var editedLabel=m.editedAt?' <span style="font-size:9px;color:rgba(255,255,255,.3);font-style:italic">(edited)</span>':'';
      h+='<div style="max-width:78%;padding:10px 14px;border-radius:'+bubbleRadius+';background:'+(isMe?'linear-gradient(135deg,#00b4d8,#0099cc)':'rgba(255,255,255,.08)')+';font-size:13px;color:'+(isMe?'#fff':'rgba(255,255,255,.85)')+';line-height:1.45;word-wrap:break-word;'+(isMe?'box-shadow:0 2px 8px rgba(0,180,216,.15)':'')+'">'+formatChatText(m.text)+editedLabel+'</div>';
    }

    // Reactions row
    var reactions=m.reactions||{};
    var rKeys=Object.keys(reactions);
    var hasReactions=rKeys.some(function(k){return(reactions[k]||[]).length>0});
    if(hasReactions){
      h+='<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px">';
      rKeys.forEach(function(emoji){
        var users=reactions[emoji]||[];
        if(!users.length)return;
        var isMine=users.indexOf(uid)>=0;
        h+='<span onclick="icToggleReaction(\''+esc(m.id)+'\',\''+esc(emoji)+'\')" style="cursor:pointer;padding:2px 6px;border-radius:10px;font-size:11px;background:'+(isMine?'rgba(0,229,255,.15)':'rgba(255,255,255,.06)')+';border:1px solid '+(isMine?'rgba(0,229,255,.3)':'rgba(255,255,255,.06)')+';display:inline-flex;align-items:center;gap:2px;transition:all .15s">'+emoji+'<span style="font-size:9px;color:rgba(255,255,255,.4)">'+users.length+'</span></span>';
      });
      h+='</div>';
    }

    // Action menu button (⋯) — show on hover
    h+='<div class="ic-msg-actions" style="display:none;position:absolute;'+(isMe?'left:14px':'right:14px')+';top:50%;transform:translateY(-50%)">';
    h+='<span onclick="event.stopPropagation();icShowActionMenu(\''+esc(m.id)+'\',event)" style="cursor:pointer;padding:4px 7px;font-size:14px;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.6);line-height:1" title="More actions">&#8943;</span>';
    h+='</div>';

    // Time + delivery status
    if(!sameUser||dateStr!==lastDate){
      var statusHtml='';
      if(isMe){
        if(m._optimistic&&!m._failed){
          statusHtml=' <span style="color:rgba(255,255,255,.2)">&#10003;</span>';
        }else if(m._failed){
          statusHtml=' <span style="color:#ef4444">&#10007; Failed</span>';
        }else if(m.readBy&&m.readBy.length>1){
          statusHtml=' <span style="color:#00e5ff">&#10003;&#10003;</span>';
        }else{
          statusHtml=' <span style="color:#00e5ff">&#10003;</span>';
        }
      }
      h+='<span style="font-size:8px;color:rgba(255,255,255,.2);margin-top:2px;padding:0 4px">'+timeStr+statusHtml+'</span>';
    }
    h+='</div>';
    lastUser=m.user;
  });
  body.innerHTML=h;
  body.scrollTop=body.scrollHeight;

  // Attach hover listeners for action buttons
  var wraps=body.querySelectorAll('.ic-msg-wrap');
  for(var w=0;w<wraps.length;w++){
    (function(wrap){
      var actions=wrap.querySelector('.ic-msg-actions');
      if(!actions)return;
      wrap.addEventListener('mouseenter',function(){actions.style.display='flex'});
      wrap.addEventListener('mouseleave',function(){actions.style.display='none'});
    })(wraps[w]);
  }
}

// ── IC REACTIONS ──
function icToggleReaction(msgId,emoji){
  if(!fbDb)return;
  var uid=getUserId();
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg)return;
  var reactions=msg.reactions||{};
  var users=reactions[emoji]||[];
  var update={};
  if(users.indexOf(uid)>=0){
    update['reactions.'+emoji]=firebase.firestore.FieldValue.arrayRemove(uid);
  }else{
    update['reactions.'+emoji]=firebase.firestore.FieldValue.arrayUnion(uid);
  }
  fbDb.collection('chat_messages').doc(msgId).update(update).catch(function(e){console.warn('icReaction:',e)});
}

function icShowReactPicker(msgId){
  // Remove any existing picker
  var old=document.getElementById('icReactPicker');if(old)old.remove();
  var msgEl=document.querySelector('[data-icmsg="'+msgId+'"]');
  if(!msgEl)return;
  var picker=document.createElement('div');
  picker.id='icReactPicker';
  picker.style.cssText='display:flex;gap:2px;padding:6px 8px;background:rgba(0,0,0,.85);border:1px solid rgba(255,255,255,.1);border-radius:12px;position:absolute;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  var quickEmojis=['👍','❤️','😂','🔥','😮','😢','🎉','💯'];
  picker.innerHTML=quickEmojis.map(function(e){
    return'<span onclick="event.stopPropagation();icToggleReaction(\''+esc(msgId)+'\',\''+e+'\');document.getElementById(\'icReactPicker\').remove()" style="cursor:pointer;font-size:20px;padding:3px;border-radius:6px;transition:transform .1s" onmouseover="this.style.transform=\'scale(1.3)\'" onmouseout="this.style.transform=\'scale(1)\'">'+e+'</span>';
  }).join('');
  msgEl.style.position='relative';
  msgEl.appendChild(picker);
  // Auto-close on outside click
  setTimeout(function(){
    document.addEventListener('click',function rm(){if(document.getElementById('icReactPicker'))document.getElementById('icReactPicker').remove();document.removeEventListener('click',rm)});
  },100);
}

window.icToggleReaction=icToggleReaction;
window.icShowReactPicker=icShowReactPicker;

function icSendMsg(){
  var input=document.getElementById('icInput');
  var text=input?input.value.trim():'';
  if(!text&&!_icPendingGif&&!_icPendingFile)return;
  if(!fbDb||!IC.activeChat)return;

  var userName=getUserName();
  var userId=getUserId();
  var tempId='_tmp_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);

  // Build local optimistic message (shows instantly)
  var localMsg={
    id:tempId,
    channelId:IC.activeChat,
    text:text,
    user:userName,
    userId:userId,
    dept:window.CURRENT_USER&&window.CURRENT_USER._dept||'',
    timestamp:{seconds:Math.floor(Date.now()/1000)},
    reactions:{},
    readBy:[userId],
    _optimistic:true
  };
  if(_icPendingGif){localMsg.gif=_icPendingGif}
  if(_icReplyTo){localMsg.replyTo={id:_icReplyTo.id,user:_icReplyTo.user,text:(_icReplyTo.text||'').substring(0,80)}}

  // Immediately push to local messages and re-render
  IC.messages.push(localMsg);
  icRenderMessages();

  // Build server data
  var serverData={
    channelId:IC.activeChat,
    text:text,
    user:userName,
    userId:userId,
    dept:localMsg.dept,
    timestamp:firebase.firestore.FieldValue.serverTimestamp(),
    reactions:{},
    readBy:[userId]
  };
  if(localMsg.gif)serverData.gif=localMsg.gif;
  if(localMsg.replyTo)serverData.replyTo=localMsg.replyTo;

  // Mentions
  var mentionMatches=text.match(/@(\w+)/g);
  if(mentionMatches&&mentionMatches.length){
    serverData.mentions=mentionMatches.map(function(mm){return mm.substring(1)});
  }

  // File attachment
  if(_icPendingFile){
    var attType=(_icPendingFile.type&&_icPendingFile.type.indexOf('image')===0)?'image':'file';
    serverData.attachments=[{type:attType,url:_icPendingFile.url,name:_icPendingFile.name,size:_icPendingFile.size}];
    localMsg.attachments=serverData.attachments;
  }

  // Priority
  if(_icPriority){
    serverData.priority='urgent';
    localMsg.priority='urgent';
  }

  // Clear state
  _icPendingGif=null;
  _icReplyTo=null;
  _icPendingFile=null;
  _icPriority=false;
  var prioBtn=document.getElementById('icPriorityBtn');
  if(prioBtn){prioBtn.style.background='';prioBtn.style.color='';}
  if(input){input.value='';input.style.height='auto';input.focus()}
  var bar=document.getElementById('icPreviewBar');if(bar)bar.remove();

  // Write to Firestore — when snapshot arrives, it will replace the optimistic message
  fbDb.collection('chat_messages').add(serverData).then(function(docRef){
    // Mark the optimistic message so snapshot can match it
    for(var i=0;i<IC.messages.length;i++){
      if(IC.messages[i].id===tempId){
        IC.messages[i]._realId=docRef.id;
        break;
      }
    }
  }).catch(function(e){
    console.warn('icSend error:',e);
    // Mark as failed
    for(var i=0;i<IC.messages.length;i++){
      if(IC.messages[i].id===tempId){
        IC.messages[i]._failed=true;
        break;
      }
    }
    icRenderMessages();
    if(typeof toast==='function')toast('Message failed to send','err');
  });

  // Update channel lastMessage
  var preview=text?text.substring(0,100):(serverData.gif?'sent a GIF':'');
  fbDb.collection('chat_channels').doc(IC.activeChat).update({
    lastMessage:preview,
    lastMessageAt:firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(e){console.warn('icLastMsg:',e)});
}

function icKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();icSendMsg()}}

// ── Unread badge + screen glow listener ──
var _icOldestUnread=null; // timestamp (ms) of oldest unread message
var _icGlowTimer=null;

function icStartUnreadListener(){
  if(IC.unreadListener)return; // already running
  if(!fbDb)return;
  var uid=getUserId();if(!uid)return;
  IC.unreadListener=fbDb.collection('chat_messages')
    .orderBy('timestamp','desc')
    .limit(100)
    .onSnapshot(function(snap){
      var count=0;
      var oldest=null;
      snap.docs.forEach(function(d){
        var data=d.data();
        if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
          // Skip muted channels
          if(data.channelId&&_icMutedChannels.indexOf(data.channelId)>=0)return;
          count++;
          var t=data.timestamp?data.timestamp.seconds*1000:0;
          if(t&&(!oldest||t<oldest))oldest=t;
        }
      });
      IC.unreadCount=count;
      _icOldestUnread=oldest;
      icUpdateBadge();
      icUpdateGlow();
    },function(err){console.warn('IC unread:',err.message)});
  // Check glow escalation every 30s
  if(_icGlowTimer)clearInterval(_icGlowTimer);
  _icGlowTimer=setInterval(icUpdateGlow,30000);
}

function icUpdateBadge(){
  var badge=document.getElementById('icUnreadBadge');
  if(!badge)return;
  if(IC.unreadCount>0){
    badge.style.display='flex';
    badge.textContent=IC.unreadCount>99?'99+':IC.unreadCount;
  }else{
    badge.style.display='none';
  }
}

function icUpdateGlow(){
  var body=document.body;
  if(IC.unreadCount<=0){
    body.classList.remove('ic-unread','ic-urgent');
    return;
  }
  // Check if oldest unread is > 15 minutes old
  var elapsed=_icOldestUnread?(Date.now()-_icOldestUnread):0;
  if(elapsed>15*60*1000){
    body.classList.remove('ic-unread');
    body.classList.add('ic-urgent');
  }else{
    body.classList.remove('ic-urgent');
    body.classList.add('ic-unread');
  }
}

// ── Online users ──
function icLoadOnlineUsers(){
  if(!fbDb)return;
  var cutoff=new Date(Date.now()-5*60*1000);
  fbDb.collection('users').get().then(function(snap){
    IC.allUsers=[];IC.onlineUsers=[];
    snap.docs.forEach(function(d){
      var u=d.data();var name=u.displayName||u.email||'';if(!name)return;
      var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;
      var online=ls&&ls>cutoff;
      IC.allUsers.push({name:name,online:online,dept:u.department||u.dept||''});
      if(online)IC.onlineUsers.push(name);
    });
    // Update count in header
    var countEl=document.getElementById('icOnlineCount');
    if(countEl)countEl.textContent=IC.onlineUsers.length+' online';
    // Update online section if visible
    var sec=document.getElementById('icOnlineSection');
    if(sec)sec.innerHTML=icRenderOnlineUsers();
  }).catch(function(e){console.warn('IC users:',e.message)});
}

function icRenderOnlineUsers(){
  var me=getUserName();
  if(!IC.allUsers.length)return'<span style="font-size:10px;color:var(--tx3)">Loading...</span>';
  var h='';
  IC.allUsers.forEach(function(u){
    if(u.name===me)return;
    var dot=u.online?'#2ee89e':'#555';
    h+='<div onclick="icStartDM(\''+esc(u.name)+'\')" style="cursor:pointer;display:flex;align-items:center;gap:4px;padding:3px 8px;background:var(--bg3);border-radius:20px;font-size:10px;color:var(--tx2);white-space:nowrap" title="'+(u.online?'Online':'Offline')+' — '+esc(u.dept)+'">';
    h+='<span style="width:6px;height:6px;border-radius:50%;background:'+dot+';flex-shrink:0"></span>'+esc(u.name)+'</div>';
  });
  if(!h)h='<span style="font-size:10px;color:var(--tx3)">No users found</span>';
  return h;
}

// IC list search filter — hides non-matching rows
function icFilterList(query){
  var body=document.getElementById('icBody');if(!body)return;
  var q=(query||'').toLowerCase();
  var rows=body.querySelectorAll('[onclick*="icOpenChat"]');
  for(var i=0;i<rows.length;i++){
    if(!q){rows[i].style.display='';continue}
    var text=rows[i].textContent.toLowerCase();
    rows[i].style.display=text.indexOf(q)>=0?'':'none';
  }
}
window.icFilterList=icFilterList;

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 1: Action Menu
// ══════════════════════════════════════════════════════════════════
function icShowActionMenu(msgId,evt){
  icCloseActionMenu();
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg)return;
  var me=getUserName();
  var isOwn=msg.user===me;
  var menu=document.createElement('div');
  menu.id='icActionMenu';
  menu.style.cssText='position:fixed;z-index:9999;background:rgba(13,17,23,.96);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:4px;box-shadow:0 8px 32px rgba(0,0,0,.5);min-width:160px';

  var items=[];
  items.push({icon:'\u21A9',label:'Reply',fn:'icSetReply(\''+esc(msgId)+'\')'});
  items.push({icon:'\uD83D\uDE0A',label:'React',fn:'icShowReactPicker(\''+esc(msgId)+'\')'});
  if(isOwn)items.push({icon:'\u270F',label:'Edit',fn:'icStartEdit(\''+esc(msgId)+'\')'});
  if(isOwn)items.push({icon:'\uD83D\uDDD1',label:'Delete',fn:'icDeleteMsg(\''+esc(msgId)+'\')'});
  items.push({icon:'\uD83D\uDCCC',label:(msg.pinned?'Unpin':'Pin'),fn:'icPinMsg(\''+esc(msgId)+'\')'});
  items.push({icon:'\u2197',label:'Forward',fn:'icForwardMsg(\''+esc(msgId)+'\')'});
  items.push({icon:'\uD83D\uDCCB',label:'Copy Text',fn:'icCopyText(\''+esc(msgId)+'\')'});

  var h='';
  items.forEach(function(item){
    h+='<div onclick="event.stopPropagation();icCloseActionMenu();'+item.fn+'" style="padding:7px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:8px;font-size:12px;color:rgba(255,255,255,.8);transition:background .15s" onmouseover="this.style.background=\'rgba(255,255,255,.08)\'" onmouseout="this.style.background=\'none\'">';
    h+='<span style="font-size:14px;width:20px;text-align:center">'+item.icon+'</span>'+item.label+'</div>';
  });
  menu.innerHTML=h;

  document.body.appendChild(menu);

  // Position near the click
  var x=evt.clientX||200;
  var y=evt.clientY||200;
  if(x+menu.offsetWidth>window.innerWidth)x=window.innerWidth-menu.offsetWidth-8;
  if(y+menu.offsetHeight>window.innerHeight)y=window.innerHeight-menu.offsetHeight-8;
  menu.style.left=x+'px';
  menu.style.top=y+'px';

  // Auto-close on outside click
  setTimeout(function(){
    document.addEventListener('click',function _icMenuClose(){
      icCloseActionMenu();
      document.removeEventListener('click',_icMenuClose);
    });
  },50);
}

function icCloseActionMenu(){
  var m=document.getElementById('icActionMenu');
  if(m)m.remove();
}

function icCopyText(msgId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg||!msg.text)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(msg.text).then(function(){
      if(typeof toast==='function')toast('Copied to clipboard','ok');
    });
  }else{
    var ta=document.createElement('textarea');
    ta.value=msg.text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    if(typeof toast==='function')toast('Copied to clipboard','ok');
  }
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 2: Typing Indicators
// ══════════════════════════════════════════════════════════════════
function icSetTyping(){
  if(!fbDb||!IC.activeChat)return;
  var now=Date.now();
  if(now-_icTypingThrottle<3000)return;
  _icTypingThrottle=now;
  var uid=getUserId();
  var update={};
  update['typing.'+uid]={name:getUserName(),at:firebase.firestore.FieldValue.serverTimestamp()};
  fbDb.collection('chat_channels').doc(IC.activeChat).update(update).catch(function(e){console.warn('icTyping:',e)});
  if(_icTypingTimeout)clearTimeout(_icTypingTimeout);
  _icTypingTimeout=setTimeout(function(){icClearTyping()},5000);
}

function icClearTyping(){
  if(!fbDb||!IC.activeChat)return;
  var uid=getUserId();
  var update={};
  update['typing.'+uid]=firebase.firestore.FieldValue.delete();
  fbDb.collection('chat_channels').doc(IC.activeChat).update(update).catch(function(e){console.warn('icClearTyping:',e)});
  if(_icTypingTimeout){clearTimeout(_icTypingTimeout);_icTypingTimeout=null;}
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 3: Message Editing
// ══════════════════════════════════════════════════════════════════
function icStartEdit(msgId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg||msg.user!==getUserName())return;
  IC._editingMsgId=msgId;
  var el=document.querySelector('[data-icmsg="'+msgId+'"]');
  if(!el)return;
  var bubbles=el.querySelectorAll('div');
  var bubble=null;
  for(var i=0;i<bubbles.length;i++){
    if(bubbles[i].style.borderRadius&&bubbles[i].textContent){bubble=bubbles[i];break;}
  }
  if(!bubble)return;
  var currentText=msg.text||'';
  bubble.innerHTML='<textarea id="icEditArea" style="width:100%;min-height:40px;background:rgba(0,0,0,.3);border:1px solid #00e5ff;border-radius:8px;color:#fff;padding:6px 8px;font-size:12px;font-family:inherit;resize:vertical;outline:none">'+esc(currentText)+'</textarea>'
    +'<div style="display:flex;gap:4px;margin-top:4px">'
    +'<button onclick="icSaveEdit(\''+esc(msgId)+'\')" style="padding:3px 10px;background:#00e5ff;color:#000;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">Save</button>'
    +'<button onclick="icCancelEdit()" style="padding:3px 10px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.6);border:none;border-radius:6px;font-size:10px;cursor:pointer">Cancel</button>'
    +'</div>';
  var area=document.getElementById('icEditArea');
  if(area)area.focus();
}

function icSaveEdit(msgId){
  var area=document.getElementById('icEditArea');
  if(!area)return;
  var newText=area.value.trim();
  if(!newText){icCancelEdit();return;}
  if(!fbDb)return;
  fbDb.collection('chat_messages').doc(msgId).update({
    text:newText,
    editedAt:firebase.firestore.FieldValue.serverTimestamp(),
    editedBy:getUserName()
  }).then(function(){
    IC._editingMsgId=null;
    icRenderMessages();
  }).catch(function(e){
    console.warn('icSaveEdit:',e);
    IC._editingMsgId=null;
    icRenderMessages();
  });
}

function icCancelEdit(){
  IC._editingMsgId=null;
  icRenderMessages();
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 4: Message Deletion
// ══════════════════════════════════════════════════════════════════
function icDeleteMsg(msgId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg||msg.user!==getUserName())return;
  if(!confirm('Delete this message?'))return;
  if(!fbDb)return;
  fbDb.collection('chat_messages').doc(msgId).update({
    deleted:true,
    deletedAt:firebase.firestore.FieldValue.serverTimestamp(),
    deletedBy:getUserName(),
    text:''
  }).catch(function(e){console.warn('icDeleteMsg:',e)});
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 5: Pinned Messages
// ══════════════════════════════════════════════════════════════════
function icPinMsg(msgId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg||!fbDb)return;
  if(msg.pinned){
    fbDb.collection('chat_messages').doc(msgId).update({pinned:false,pinnedAt:null,pinnedBy:null}).catch(function(e){console.warn('icUnpin:',e)});
  }else{
    fbDb.collection('chat_messages').doc(msgId).update({
      pinned:true,
      pinnedAt:firebase.firestore.FieldValue.serverTimestamp(),
      pinnedBy:getUserName()
    }).catch(function(e){console.warn('icPin:',e)});
  }
}

function icShowPinnedMessages(){
  var bar=document.getElementById('icPinnedBar');
  if(bar&&bar.style.display!=='none'){
    bar.style.display='none';
    return;
  }
  var pinned=IC.messages.filter(function(m){return m.pinned===true});
  if(!bar){
    var body=document.getElementById('icBody');
    if(!body)return;
    bar=document.createElement('div');
    bar.id='icPinnedBar';
    bar.style.cssText='max-height:200px;overflow-y:auto;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.2)';
    body.parentNode.insertBefore(bar,body);
  }
  if(!pinned.length){
    bar.innerHTML='<div style="padding:12px;text-align:center;font-size:11px;color:rgba(255,255,255,.3)">No pinned messages</div>';
  }else{
    var h='<div style="padding:6px 12px;font-size:10px;font-weight:700;color:rgba(255,255,255,.4)">PINNED MESSAGES ('+pinned.length+')</div>';
    pinned.forEach(function(m){
      h+='<div style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,.03);font-size:11px">';
      h+='<div style="color:#00e5ff;font-size:9px;font-weight:600">'+esc(m.user)+'</div>';
      h+='<div style="color:rgba(255,255,255,.6)">'+esc((m.text||'').substring(0,80))+'</div></div>';
    });
    bar.innerHTML=h;
  }
  bar.style.display='block';
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 6: @Mention Autocomplete
// ══════════════════════════════════════════════════════════════════
function icCheckMention(el){
  var val=el.value||'';
  var cursorPos=el.selectionStart||val.length;
  var textUpToCursor=val.substring(0,cursorPos);
  var match=textUpToCursor.match(/@(\w*)$/);
  var picker=document.getElementById('icMentionPicker');
  if(!match){
    if(picker)picker.style.display='none';
    return;
  }
  var partial=match[1].toLowerCase();
  var users=window._allTeamUsers||[];
  var filtered=users.filter(function(u){
    var name=(typeof u==='string')?u:(u.displayName||u.name||'');
    return name.toLowerCase().indexOf(partial)>=0;
  }).slice(0,8);

  if(!filtered.length){
    if(picker)picker.style.display='none';
    return;
  }

  if(!picker){
    var inputBar=document.getElementById('icInputBar');
    if(!inputBar)return;
    picker=document.createElement('div');
    picker.id='icMentionPicker';
    picker.style.cssText='position:absolute;bottom:100%;left:0;right:0;background:rgba(13,17,23,.96);border:1px solid rgba(255,255,255,.1);border-radius:10px;max-height:180px;overflow-y:auto;z-index:100;box-shadow:0 -4px 16px rgba(0,0,0,.4)';
    inputBar.style.position='relative';
    inputBar.appendChild(picker);
  }
  var h='';
  filtered.forEach(function(u){
    var name=(typeof u==='string')?u:(u.displayName||u.name||'');
    h+='<div onclick="icInsertMention(\''+esc(name)+'\')" style="padding:8px 12px;cursor:pointer;font-size:12px;color:rgba(255,255,255,.8);transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.1)\'" onmouseout="this.style.background=\'none\'">@'+esc(name)+'</div>';
  });
  picker.innerHTML=h;
  picker.style.display='block';
}

function icInsertMention(name){
  var input=document.getElementById('icInput');
  if(!input)return;
  var val=input.value;
  var cursorPos=input.selectionStart||val.length;
  var textBefore=val.substring(0,cursorPos);
  var textAfter=val.substring(cursorPos);
  var replaced=textBefore.replace(/@\w*$/,'@'+name+' ');
  input.value=replaced+textAfter;
  var picker=document.getElementById('icMentionPicker');
  if(picker)picker.style.display='none';
  input.focus();
  input.selectionStart=input.selectionEnd=replaced.length;
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 7: Message Search
// ══════════════════════════════════════════════════════════════════
function icToggleSearch(){
  var bar=document.getElementById('icSearchBar');
  if(bar&&bar.style.display!=='none'){
    icClearSearch();
    return;
  }
  if(!bar){
    var body=document.getElementById('icBody');
    if(!body)return;
    bar=document.createElement('div');
    bar.id='icSearchBar';
    bar.style.cssText='padding:6px 12px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px';
    bar.innerHTML='<input id="icSearchInput" placeholder="Search messages..." oninput="icSearchMessages(this.value)" style="flex:1;padding:6px 10px;font-size:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);border-radius:8px;color:#fff;outline:none;font-family:inherit">'
      +'<span onclick="icClearSearch()" style="cursor:pointer;color:rgba(255,255,255,.3);font-size:14px">&times;</span>';
    body.parentNode.insertBefore(bar,body);
  }
  bar.style.display='flex';
  var inp=document.getElementById('icSearchInput');
  if(inp)inp.focus();
}

function icSearchMessages(query){
  if(!query||!query.trim()){
    icRenderMessages();
    return;
  }
  var q=query.toLowerCase();
  var body=document.getElementById('icBody');if(!body)return;
  var filtered=IC.messages.filter(function(m){
    return m.text&&m.text.toLowerCase().indexOf(q)>=0;
  });
  var me=getUserName();var uid=getUserId();var h='';
  if(!filtered.length){
    h='<div style="padding:30px;text-align:center;font-size:12px;color:rgba(255,255,255,.3)">No messages found</div>';
  }else{
    filtered.forEach(function(m){
      var ts=m.timestamp?new Date(m.timestamp.seconds*1000):new Date();
      var timeStr=ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      var isMe=m.user===me;
      var bubbleRadius=isMe?'18px 18px 4px 18px':'18px 18px 18px 4px';
      // Highlight matches
      var highlightedText=formatChatText(m.text);
      var re=new RegExp('('+query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
      highlightedText=highlightedText.replace(re,'<mark style="background:rgba(0,229,255,.3);color:#fff;border-radius:2px;padding:0 2px">$1</mark>');

      h+='<div style="display:flex;flex-direction:column;align-items:'+(isMe?'flex-end':'flex-start')+';padding:6px 14px 1px">';
      if(!isMe)h+='<span style="font-size:10px;font-weight:600;color:rgba(255,255,255,.4);margin-bottom:2px;margin-left:4px">'+esc(m.user)+'</span>';
      h+='<div style="max-width:78%;padding:10px 14px;border-radius:'+bubbleRadius+';background:'+(isMe?'linear-gradient(135deg,#00b4d8,#0099cc)':'rgba(255,255,255,.08)')+';font-size:13px;color:'+(isMe?'#fff':'rgba(255,255,255,.85)')+';line-height:1.45;word-wrap:break-word">'+highlightedText+'</div>';
      h+='<span style="font-size:8px;color:rgba(255,255,255,.2);margin-top:2px;padding:0 4px">'+timeStr+'</span>';
      h+='</div>';
    });
  }
  body.innerHTML=h;
}

function icClearSearch(){
  var bar=document.getElementById('icSearchBar');
  if(bar){bar.style.display='none';var inp=document.getElementById('icSearchInput');if(inp)inp.value='';}
  icRenderMessages();
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 8: File/Image Sharing
// ══════════════════════════════════════════════════════════════════
function icAddFile(){
  var fi=document.createElement('input');
  fi.type='file';
  fi.accept='image/*,.pdf,.doc,.docx,.xlsx,.txt';
  fi.style.display='none';
  fi.onchange=function(){
    if(fi.files&&fi.files[0])icUploadFile(fi.files[0]);
    fi.remove();
  };
  document.body.appendChild(fi);
  fi.click();
}

function icUploadFile(file){
  if(!file)return;
  if(file.size>10*1024*1024){
    if(typeof toast==='function')toast('File too large (max 10MB)','err');
    return;
  }
  if(!firebase||!firebase.storage){
    if(typeof toast==='function')toast('Storage not available','err');
    return;
  }
  var storageRef=firebase.storage().ref('chat-files/'+IC.activeChat+'/'+Date.now()+'_'+file.name);
  var uploadTask=storageRef.put(file);

  // Show progress in preview
  _icPendingFile={url:'',name:file.name,type:file.type,size:file.size,_uploading:true};
  icShowPreview();

  uploadTask.on('state_changed',function(snapshot){
    var progress=Math.round((snapshot.bytesTransferred/snapshot.totalBytes)*100);
    var bar=document.getElementById('icPreviewBar');
    if(bar){
      var progEl=bar.querySelector('.ic-upload-progress');
      if(!progEl){
        progEl=document.createElement('div');
        progEl.className='ic-upload-progress';
        progEl.style.cssText='height:3px;background:rgba(0,229,255,.2);border-radius:2px;margin-top:4px;overflow:hidden';
        progEl.innerHTML='<div style="height:100%;background:#00e5ff;border-radius:2px;transition:width .3s;width:0%"></div>';
        bar.appendChild(progEl);
      }
      var inner=progEl.querySelector('div');
      if(inner)inner.style.width=progress+'%';
    }
  },function(error){
    console.warn('icUpload error:',error);
    _icPendingFile=null;
    icShowPreview();
    if(typeof toast==='function')toast('Upload failed','err');
  },function(){
    uploadTask.snapshot.ref.getDownloadURL().then(function(url){
      _icPendingFile={url:url,name:file.name,type:file.type,size:file.size};
      icShowPreview();
    });
  });
}

function icSetupDragDrop(){
  var body=document.getElementById('icBody');
  if(!body)return;
  body.addEventListener('dragover',function(e){
    e.preventDefault();
    e.stopPropagation();
    body.style.outline='2px dashed #00e5ff';
    body.style.outlineOffset='-4px';
  });
  body.addEventListener('dragleave',function(e){
    e.preventDefault();
    body.style.outline='none';
  });
  body.addEventListener('drop',function(e){
    e.preventDefault();
    e.stopPropagation();
    body.style.outline='none';
    if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]){
      icUploadFile(e.dataTransfer.files[0]);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 10: Forward Message
// ══════════════════════════════════════════════════════════════════
function icForwardMsg(msgId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg)return;
  if(!fbDb)return;
  // Load all channels for forward picker
  fbDb.collection('chat_channels').get().then(function(snap){
    var channels=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    var h='<div style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px;color:#fff">Forward Message</h3>';
    h+='<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:12px;padding:8px;background:rgba(255,255,255,.04);border-radius:8px;border-left:3px solid #00e5ff">'+esc((msg.text||'').substring(0,100))+'</div>';
    h+='<div style="max-height:300px;overflow-y:auto">';
    channels.forEach(function(c){
      if(c.id===IC.activeChat)return;
      var name=c.name||c.id;
      h+='<div onclick="icDoForward(\''+esc(msgId)+'\',\''+esc(c.id)+'\')" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:8px;transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.08)\'" onmouseout="this.style.background=\'none\'">';
      h+='<span style="font-size:14px">'+(c.type==='dm'?'\uD83D\uDC64':'#')+'</span>';
      h+='<span style="font-size:12px;color:rgba(255,255,255,.8)">'+esc(name)+'</span></div>';
    });
    h+='</div></div>';
    if(typeof openModal==='function')openModal(h);
  }).catch(function(e){console.warn('icForward:',e)});
}

function icDoForward(msgId,targetChannelId){
  var msg=IC.messages.find(function(m){return m.id===msgId});
  if(!msg||!fbDb)return;
  if(typeof closeModal==='function')closeModal();
  fbDb.collection('chat_messages').add({
    channelId:targetChannelId,
    text:msg.text||'',
    user:getUserName(),
    userId:getUserId(),
    dept:window.CURRENT_USER&&window.CURRENT_USER._dept||'',
    timestamp:firebase.firestore.FieldValue.serverTimestamp(),
    reactions:{},
    readBy:[getUserId()],
    forwardedFrom:{
      channelId:IC.activeChat,
      msgId:msgId,
      user:msg.user,
      text:(msg.text||'').substring(0,100)
    }
  }).then(function(){
    if(typeof toast==='function')toast('Message forwarded','ok');
  }).catch(function(e){console.warn('icForward send:',e)});
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 11: Priority/Urgent Messages
// ══════════════════════════════════════════════════════════════════
function icTogglePriority(){
  _icPriority=!_icPriority;
  var btn=document.getElementById('icPriorityBtn');
  if(btn){
    if(_icPriority){
      btn.style.background='rgba(239,68,68,.2)';
      btn.style.color='#ef4444';
    }else{
      btn.style.background='';
      btn.style.color='';
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// IC FEATURE 12: Mute Conversation
// ══════════════════════════════════════════════════════════════════
function icMuteChannel(){
  if(!IC.activeChat||!fbDb)return;
  var uid=getUserId();
  var idx=_icMutedChannels.indexOf(IC.activeChat);
  if(idx>=0){
    _icMutedChannels.splice(idx,1);
    fbDb.collection('users').doc(uid).update({
      mutedChannels:firebase.firestore.FieldValue.arrayRemove(IC.activeChat)
    }).catch(function(e){console.warn('icUnmute:',e)});
  }else{
    _icMutedChannels.push(IC.activeChat);
    fbDb.collection('users').doc(uid).update({
      mutedChannels:firebase.firestore.FieldValue.arrayUnion(IC.activeChat)
    }).catch(function(e){console.warn('icMute:',e)});
  }
  var btn=document.getElementById('icMuteBtn');
  if(btn){
    btn.textContent=_icMutedChannels.indexOf(IC.activeChat)>=0?'\uD83D\uDD15':'\uD83D\uDD14';
  }
  if(typeof toast==='function')toast(_icMutedChannels.indexOf(IC.activeChat)>=0?'Conversation muted':'Conversation unmuted','ok');
}

// Load muted channels from user doc on init
function icLoadMutedChannels(){
  if(!fbDb)return;
  var uid=getUserId();if(!uid)return;
  fbDb.collection('users').doc(uid).get().then(function(doc){
    if(doc.exists&&doc.data().mutedChannels){
      _icMutedChannels=doc.data().mutedChannels;
    }
  }).catch(function(e){console.warn('icLoadMuted:',e)});
}

function icStartDM(otherUser){
  if(!fbDb)return;
  var me=getUserName();
  var dmId=[me,otherUser].sort().join('_').replace(/\s/g,'-').toLowerCase();
  fbDb.collection('chat_channels').doc(dmId).get().then(function(doc){
    if(!doc.exists){
      fbDb.collection('chat_channels').doc(dmId).set({
        name:me+' · '+otherUser,type:'dm',desc:'',dept:null,
        created:firebase.firestore.FieldValue.serverTimestamp(),
        owner:me,members:[me,otherUser],lastMessage:'',lastMessageAt:null
      }).then(function(){icOpenChat(dmId,otherUser)});
    }else{
      icOpenChat(dmId,otherUser);
    }
  }).catch(function(e){console.warn('IC dm:',e.message)});
}

function icNewDM(){
  if(!fbDb)return;
  fbDb.collection('users').get().then(function(snap){
    var me=getUserName();var cutoff=new Date(Date.now()-5*60*1000);
    var body=document.getElementById('icBody');if(!body)return;
    var users=[];snap.docs.forEach(function(d){
      var u=d.data();if(u.displayName&&u.displayName!==me){
        var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;
        users.push({name:u.displayName,online:ls&&ls>cutoff,dept:u.department||u.dept||''});
      }
    });
    // Sort online first
    users.sort(function(a,b){return(b.online?1:0)-(a.online?1:0)});
    var h='<div style="padding:10px 12px;font-size:11px;font-weight:700;color:var(--tx);border-bottom:1px solid var(--bdr)"><span onclick="icShowList()" style="cursor:pointer;margin-right:6px;color:var(--tx3)">←</span>New Message</div>';
    users.forEach(function(u){
      var dot=u.online?'#2ee89e':'#555';
      h+='<div onclick="icStartDM(\''+esc(u.name)+'\')" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'">';
      h+='<span style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0"></span>';
      h+='<span style="font-size:12px;color:var(--tx);flex:1">'+esc(u.name)+'</span>';
      h+='<span style="font-size:9px;color:var(--tx3)">'+esc(u.dept)+'</span></div>';
    });
    body.innerHTML=h;
    var title=document.getElementById('icTitle');if(title)title.textContent='New Message';
    var inputBar=document.getElementById('icInputBar');if(inputBar)inputBar.style.display='none';
  }).catch(function(e){console.warn('IC users:',e.message)});
}

// ── ADD PEOPLE → CREATE GROUP CHAT ──
var _icAddPeopleSelected=[];

function icAddPeople(){
  if(!fbDb||!IC.activeChat)return;
  // Get current channel to know existing members
  fbDb.collection('chat_channels').doc(IC.activeChat).get().then(function(doc){
    var channelData=doc.exists?doc.data():{};
    var existingMembers=channelData.members||[];
    var me=getUserName();
    if(existingMembers.indexOf(me)<0)existingMembers.push(me);
    _icAddPeopleSelected=[];

    // Load all users
    fbDb.collection('users').get().then(function(snap){
      var cutoff=new Date(Date.now()-5*60*1000);
      var users=[];
      snap.docs.forEach(function(d){
        var u=d.data();
        var name=u.displayName||'';
        if(!name)return;
        var ls=u.lastSeen?new Date(u.lastSeen.seconds*1000):null;
        var online=ls&&ls>cutoff;
        // Skip users already in the chat
        var alreadyIn=existingMembers.indexOf(name)>=0;
        users.push({name:name,online:online,dept:u.department||u.dept||'',alreadyIn:alreadyIn});
      });
      users.sort(function(a,b){
        if(a.alreadyIn!==b.alreadyIn)return a.alreadyIn?1:-1;
        return(b.online?1:0)-(a.online?1:0);
      });

      var h='<div class="modal-title" style="display:flex;align-items:center;gap:8px">Add People to Chat</div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Select people to add. A new group chat will be created with everyone.</div>';
      h+='<div id="icAddPeopleSelected" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;min-height:24px"></div>';
      h+='<div style="max-height:250px;overflow-y:auto">';
      users.forEach(function(u){
        if(u.name===me)return;
        var dot=u.online?'#2ee89e':'#555';
        var dim=u.alreadyIn?'opacity:.4;pointer-events:none':'';
        h+='<div onclick="icToggleAddPerson(\''+esc(u.name)+'\')" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s;'+dim+'" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'" data-addperson="'+esc(u.name)+'">';
        h+='<span style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0"></span>';
        h+='<span style="font-size:12px;color:var(--tx);flex:1">'+esc(u.name)+(u.alreadyIn?' <span style="font-size:9px;color:var(--tx3)">(already in chat)</span>':'')+'</span>';
        h+='<span style="font-size:9px;color:var(--tx3)">'+esc(u.dept)+'</span>';
        h+='<span class="icAddCheck" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--bdr);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0"></span>';
        h+='</div>';
      });
      h+='</div>';
      h+='<button id="icCreateGroupBtn" onclick="icCreateGroupChat()" class="btn btn-pr" style="width:100%;margin-top:10px;padding:10px;border-radius:12px;font-size:13px;font-weight:700" disabled>Create Group Chat</button>';
      h+='<button onclick="closeModal()" class="btn btn-ghost" style="width:100%;margin-top:4px;padding:8px;border-radius:12px;font-size:12px">Cancel</button>';
      if(typeof openModal==='function')openModal(h);
    });
  }).catch(function(e){console.warn('icAddPeople:',e)});
}

function icToggleAddPerson(name){
  var idx=_icAddPeopleSelected.indexOf(name);
  if(idx>=0){
    _icAddPeopleSelected.splice(idx,1);
  }else{
    _icAddPeopleSelected.push(name);
  }
  // Update checkmarks
  var rows=document.querySelectorAll('[data-addperson]');
  for(var i=0;i<rows.length;i++){
    var pName=rows[i].getAttribute('data-addperson');
    var check=rows[i].querySelector('.icAddCheck');
    if(!check)continue;
    var selected=_icAddPeopleSelected.indexOf(pName)>=0;
    check.innerHTML=selected?'✓':'';
    check.style.background=selected?'#00e5ff':'transparent';
    check.style.borderColor=selected?'#00e5ff':'var(--bdr)';
    check.style.color=selected?'#000':'';
  }
  // Update selected pills
  var selEl=document.getElementById('icAddPeopleSelected');
  if(selEl){
    selEl.innerHTML=_icAddPeopleSelected.map(function(n){
      return '<span style="padding:3px 10px;background:rgba(0,229,255,.15);border:1px solid rgba(0,229,255,.3);border-radius:20px;font-size:10px;color:#00e5ff;font-weight:600;display:inline-flex;align-items:center;gap:4px">'+esc(n)+' <span onclick="event.stopPropagation();icToggleAddPerson(\''+esc(n)+'\')" style="cursor:pointer;opacity:.6">&times;</span></span>';
    }).join('');
  }
  // Enable/disable button
  var btn=document.getElementById('icCreateGroupBtn');
  if(btn)btn.disabled=_icAddPeopleSelected.length<1;
}

function icCreateGroupChat(){
  if(!fbDb||!_icAddPeopleSelected.length)return;
  var me=getUserName();
  // Get existing members
  fbDb.collection('chat_channels').doc(IC.activeChat).get().then(function(doc){
    var channelData=doc.exists?doc.data():{};
    var existingMembers=channelData.members||[];
    if(existingMembers.indexOf(me)<0)existingMembers.push(me);

    // Merge all members
    var allMembers=existingMembers.slice();
    _icAddPeopleSelected.forEach(function(name){
      if(allMembers.indexOf(name)<0)allMembers.push(name);
    });

    // Create group chat ID
    var groupId='group_'+allMembers.slice().sort().join('_').replace(/\s/g,'-').toLowerCase().substring(0,60)+'_'+Date.now().toString(36);

    // Group name: first names of all members
    var groupName=allMembers.map(function(n){return n.split(' ')[0]}).join(', ');
    if(groupName.length>40)groupName=groupName.substring(0,37)+'...';

    fbDb.collection('chat_channels').doc(groupId).set({
      name:groupName,
      type:'dm',
      group:'personal',
      desc:'Group chat with '+allMembers.length+' people',
      dept:null,
      created:firebase.firestore.FieldValue.serverTimestamp(),
      owner:me,
      members:allMembers,
      lastMessage:'Group chat created',
      lastMessageAt:firebase.firestore.FieldValue.serverTimestamp(),
      isGroup:true
    }).then(function(){
      // Send a system message
      fbDb.collection('chat_messages').add({
        channelId:groupId,
        text:me+' created a group chat with '+_icAddPeopleSelected.join(', '),
        user:'System',
        userId:'system',
        dept:'',
        timestamp:firebase.firestore.FieldValue.serverTimestamp(),
        reactions:{},
        readBy:[]
      });
      if(typeof closeModal==='function')closeModal();
      if(typeof toast==='function')toast('Group chat created!','ok');
      _icAddPeopleSelected=[];
      // Refresh sidebar and open the new group
      icShowList();
      setTimeout(function(){icOpenChat(groupId,groupName)},800);
    });
  }).catch(function(e){
    console.warn('icCreateGroup:',e);
    if(typeof toast==='function')toast('Failed to create group','err');
  });
}

window.icAddPeople=icAddPeople;

// ── COLLABORATIVE SPACES PANEL ──
var DEPT_SPACES=[
  {dept:'Sales',color:'#a855f7',icon:'💼',channels:['quotes-chat','client-services'],desc:'Pipeline, accounts, deals'},
  {dept:'Pre-Press',color:'#d7ff2f',icon:'🎨',channels:['design-review','pre-press'],desc:'Artwork, proofs, plates'},
  {dept:'Production',color:'#4169E1',icon:'⚙️',channels:['scheduling','production'],desc:'Scheduling, floor ops'},
  {dept:'Quality',color:'#ef4444',icon:'🛡',channels:['sqf-alerts','quality','fsqms'],desc:'SQF, CAPA, audits, GMP'},
  {dept:'Operations',color:'#C0C0C0',icon:'📊',channels:['operations','logistics','shipping'],desc:'Logistics, shipping, ops'},
  {dept:'Finance',color:'#22c55e',icon:'💰',channels:['finance'],desc:'AR, AP, invoicing'},
  {dept:'Leadership',color:'#f59e0b',icon:'👑',channels:['announcements','general'],desc:'Company-wide, announcements'}
];

function icRenderSpaces(){
  var el=document.getElementById('icSpacesList');
  if(!el)return;
  var h='';
  DEPT_SPACES.forEach(function(space){
    h+='<div style="padding:6px 12px">';
    // Space header
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    h+='<div style="width:28px;height:28px;border-radius:8px;background:'+space.color+'20;display:flex;align-items:center;justify-content:center;font-size:14px">'+space.icon+'</div>';
    h+='<div><div style="font-size:11px;font-weight:700;color:'+space.color+'">'+esc(space.dept)+'</div>';
    h+='<div style="font-size:9px;color:rgba(255,255,255,.25)">'+esc(space.desc)+'</div></div>';
    h+='</div>';
    // Channel links
    space.channels.forEach(function(chId){
      h+='<div onclick="icOpenChat(\''+esc(chId)+'\',\'#'+esc(chId)+'\')" style="padding:4px 8px 4px 36px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:5px;border-radius:6px;transition:all .12s" onmouseover="this.style.background=\'rgba(255,255,255,.05)\';this.style.color=\''+space.color+'\'" onmouseout="this.style.background=\'none\';this.style.color=\'rgba(255,255,255,.45)\'">';
      h+='<span style="font-size:9px;opacity:.6">#</span>'+esc(chId)+'</div>';
    });
    h+='</div>';
  });

  // Quick actions at bottom
  h+='<div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,.04);margin-top:8px">';
  h+='<div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Quick Actions</div>';
  h+='<div onclick="icNewDM()" style="padding:6px 10px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:6px;border-radius:6px;transition:background .12s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'"><span>✉</span> New Message</div>';
  h+='<div onclick="createChannelInGroup(\'department\')" style="padding:6px 10px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:6px;border-radius:6px;transition:background .12s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'"><span>➕</span> New Channel</div>';
  h+='<div onclick="goView(\'supportboard\');toggleInstantChat()" style="padding:6px 10px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:6px;border-radius:6px;transition:background .12s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'"><span>💬</span> Full Chat View</div>';
  h+='</div>';

  el.innerHTML=h;
}
window.icRenderSpaces=icRenderSpaces;
window.icToggleAddPerson=icToggleAddPerson;
window.icCreateGroupChat=icCreateGroupChat;

// Helpers
function icInitials(name){return(name||'?').split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase()}
function icTimeAgo(ts){
  if(!ts)return'';
  var d=ts.seconds?new Date(ts.seconds*1000):new Date(ts);
  var diff=Date.now()-d.getTime();
  if(diff<60000)return'now';
  if(diff<3600000)return Math.floor(diff/60000)+'m';
  if(diff<86400000)return Math.floor(diff/3600000)+'h';
  return Math.floor(diff/86400000)+'d';
}

window.toggleInstantChat=toggleInstantChat;
window.icShowList=icShowList;
window.icOpenChat=icOpenChat;
window.icSendMsg=icSendMsg;
window.icKeyDown=icKeyDown;
window.icNewDM=icNewDM;
window.icStartDM=icStartDM;
window.icShowActionMenu=icShowActionMenu;
window.icCloseActionMenu=icCloseActionMenu;
window.icCopyText=icCopyText;
window.icSetTyping=icSetTyping;
window.icClearTyping=icClearTyping;
window.icStartEdit=icStartEdit;
window.icSaveEdit=icSaveEdit;
window.icCancelEdit=icCancelEdit;
window.icDeleteMsg=icDeleteMsg;
window.icPinMsg=icPinMsg;
window.icShowPinnedMessages=icShowPinnedMessages;
window.icCheckMention=icCheckMention;
window.icInsertMention=icInsertMention;
window.icToggleSearch=icToggleSearch;
window.icSearchMessages=icSearchMessages;
window.icClearSearch=icClearSearch;
window.icAddFile=icAddFile;
window.icForwardMsg=icForwardMsg;
window.icTogglePriority=icTogglePriority;
window.icMuteChannel=icMuteChannel;
window.icDoForward=icDoForward;

// Auto-start unread listener after auth
var _icAuthCheck=setInterval(function(){
  if(typeof getUserId==='function'&&getUserId()&&typeof fbDb!=='undefined'){
    clearInterval(_icAuthCheck);
    setTimeout(icLoadMutedChannels,2500);
    setTimeout(icStartUnreadListener,3000);
    setTimeout(icLoadOnlineUsers,3500);
  }
},2000);

console.log('✅ MFX Flex Chat v2 initialized (Instant Chat enabled)');
})();
