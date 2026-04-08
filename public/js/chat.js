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
  // @channel / @here mentions
  t=t.replace(/@channel/g,'<span style="color:#ef4444;font-weight:700;background:rgba(239,68,68,.1);padding:1px 4px;border-radius:3px">@channel</span>');
  t=t.replace(/@here/g,'<span style="color:#22c55e;font-weight:700;background:rgba(34,197,94,.1);padding:1px 4px;border-radius:3px">@here</span>');
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
    icStartStatusReel();
    setTimeout(icInitContextMenu,600);
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
    var dms=channels.filter(function(c){return c.type==='dm'&&!c.isGroup&&(c.members||[]).indexOf(me)>=0});
    var groupChats=channels.filter(function(c){return c.type==='dm'&&c.isGroup&&(c.members||[]).indexOf(me)>=0});
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

    // Build presence lookup from all users
    var onlineSet={};
    var presenceMap={};
    IC.allUsers.forEach(function(u){
      if(u.online)onlineSet[u.name]=true;
      presenceMap[u.name]={online:u.online,presence:u.presence||'offline',color:u.presenceColor||'#555',email:u.email||'',dept:u.dept||''};
    });

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
        var pres=presenceMap[other]||{};
        var dotColor=pres.color||'#555';
        var userEmail=pres.email||'';
        h+='<div data-ic-channel="'+c.id+'" class="ic-dm-row" style="padding:8px 10px;display:flex;align-items:center;gap:10px;transition:all .15s;border-radius:10px;margin:1px 4px;'+(isUnread?'background:rgba(0,229,255,.06)':'')+'">';
        // Avatar with presence dot
        h+='<div onclick="icOpenChat(\''+c.id+'\',\''+esc(other)+'\')" style="position:relative;flex-shrink:0;cursor:pointer"><div style="width:36px;height:36px;border-radius:50%;background:'+_avatarGrad(other)+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff">'+icInitials(other)+'</div>';
        h+='<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:'+dotColor+';border:2px solid #0d1117" title="'+(pres.presence||'offline')+'"></div>';
        h+='</div>';
        // Name + message preview
        h+='<div onclick="icOpenChat(\''+c.id+'\',\''+esc(other)+'\')" style="flex:1;min-width:0;cursor:pointer">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center">';
        h+='<span style="font-size:12px;font-weight:'+(isUnread?'700':'500')+';color:'+(isUnread?'#fff':'rgba(255,255,255,.7)')+'">'+esc(other)+'</span>';
        h+='<span style="font-size:9px;color:'+(isUnread?'#00e5ff':'rgba(255,255,255,.2)')+'">'+time+'</span>';
        h+='</div>';
        h+='<div style="font-size:10px;color:'+(isUnread?'rgba(255,255,255,.5)':'rgba(255,255,255,.2)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">'+esc(lastMsg.substring(0,35))+'</div>';
        h+='</div>';
        // Action buttons — video, audio, message, email
        h+='<div class="ic-dm-actions" style="display:flex;gap:2px;flex-shrink:0;opacity:0;transition:opacity .15s">';
        h+='<span onclick="event.stopPropagation();icVideoCall(\''+esc(other)+'\')" style="cursor:pointer;padding:4px;border-radius:6px;font-size:13px;transition:background .1s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'none\'" title="Video call">📹</span>';
        h+='<span onclick="event.stopPropagation();icAudioCall(\''+esc(other)+'\')" style="cursor:pointer;padding:4px;border-radius:6px;font-size:13px;transition:background .1s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'none\'" title="Audio call">📞</span>';
        h+='<span onclick="event.stopPropagation();icOpenChat(\''+c.id+'\',\''+esc(other)+'\')" style="cursor:pointer;padding:4px;border-radius:6px;font-size:13px;transition:background .1s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'none\'" title="Message">💬</span>';
        if(userEmail)h+='<span onclick="event.stopPropagation();icSendEmail(\''+esc(userEmail)+'\')" style="cursor:pointer;padding:4px;border-radius:6px;font-size:13px;transition:background .1s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\'" onmouseout="this.style.background=\'none\'" title="Email">✉️</span>';
        h+='</div>';
        // Unread badge
        if(isUnread)h+='<span style="background:#00e5ff;color:#000;font-size:9px;font-weight:800;padding:2px 6px;border-radius:10px;min-width:16px;text-align:center;flex-shrink:0">'+unread+'</span>';
        h+='</div>';
      });
    }else{
      h+='<div style="padding:16px 14px;font-size:12px;color:rgba(255,255,255,.3);text-align:center">No conversations yet</div>';
    }

    // ── Group Chats ──
    if(groupChats.length){
      h+='<div style="padding:4px 14px 2px;font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(255,255,255,.04);margin-top:4px">Group Chats</div>';
      groupChats.forEach(function(c){
        var lastMsg=c.lastMessage||'';
        var time=c.lastMessageAt?icTimeAgo(c.lastMessageAt):'';
        var unread=unreadByChannel[c.id]||0;
        var isUnread=unread>0;
        var memberCount=(c.members||[]).length;
        h+='<div data-ic-channel="'+c.id+'" onclick="icOpenChat(\''+c.id+'\',\''+esc(c.name)+'\')" style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .15s;border-radius:10px;margin:1px 4px;'+(isUnread?'background:rgba(0,229,255,.06)':'')+'" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\''+(isUnread?'rgba(0,229,255,.06)':'transparent')+'\'">';
        h+='<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">👥</div>';
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center">';
        h+='<span style="font-size:12px;font-weight:'+(isUnread?'700':'500')+';color:'+(isUnread?'#fff':'rgba(255,255,255,.7)')+'">'+esc(c.name)+'</span>';
        h+='<span style="font-size:9px;color:rgba(255,255,255,.2)">'+time+'</span></div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px">';
        h+='<span style="font-size:10px;color:rgba(255,255,255,.2)">'+memberCount+' members · '+esc(lastMsg.substring(0,30))+'</span>';
        if(isUnread)h+='<span style="background:#00e5ff;color:#000;font-size:9px;font-weight:800;padding:2px 6px;border-radius:10px;min-width:16px;text-align:center;flex-shrink:0">'+unread+'</span>';
        h+='</div></div></div>';
      });
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
    if(m.priority==='urgent'||m.priority==='critical'){
      priorityStyle='border-left:3px solid #ef4444;padding-left:11px;';
    }else if(m.priority==='action'){
      priorityStyle='border-left:3px solid #f59e0b;padding-left:11px;';
    }else if(m.priority==='fyi'){
      priorityStyle='border-left:3px solid #3b82f6;padding-left:11px;';
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
      IC.allUsers.push({name:name,online:online,dept:u.department||u.dept||'',email:u.email||'',presence:u.presence||(online?'online':'offline'),presenceColor:u.presenceColor||(online?'#2ee89e':'#555'),mood:u.mood||''});
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
  h+='<div onclick="icAnonymousFeedback()" style="padding:6px 10px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:6px;border-radius:6px;transition:background .12s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'"><span>&#128238;</span> Anonymous Feedback</div>';
  h+='<div onclick="icScheduleStandup()" style="padding:6px 10px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:6px;border-radius:6px;transition:background .12s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'"><span>&#127749;</span> Daily Standup</div>';
  h+='</div>';

  el.innerHTML=h;
}
window.icRenderSpaces=icRenderSpaces;

// ══════════════════════════════════════════════════════════════════
// STATUS REEL — scrolling news ticker with likes, replies, @mentions
// Firestore collection: 'statusReel'
// Auto-expires: 24hrs or after user has 2 newer statuses
// ══════════════════════════════════════════════════════════════════

var _statusReelListener=null;
var _statusReelData=[];

function icStartStatusReel(){
  if(_statusReelListener)return;
  if(!fbDb)return;
  // Listen to recent statuses (last 24hrs)
  var cutoff=new Date(Date.now()-24*60*60*1000);
  _statusReelListener=fbDb.collection('statusReel')
    .where('createdAt','>',cutoff)
    .orderBy('createdAt','desc')
    .limit(50)
    .onSnapshot(function(snap){
      _statusReelData=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
      // Auto-cleanup: if a user has more than 2 statuses, hide older ones
      var byUser={};
      _statusReelData.forEach(function(s){
        if(!byUser[s.userId])byUser[s.userId]=[];
        byUser[s.userId].push(s);
      });
      var visible=[];
      Object.keys(byUser).forEach(function(uid){
        var userStatuses=byUser[uid].slice(0,2); // keep only latest 2
        userStatuses.forEach(function(s){visible.push(s)});
        // Delete old ones server-side (3+ per user)
        if(byUser[uid].length>2){
          for(var i=2;i<byUser[uid].length;i++){
            fbDb.collection('statusReel').doc(byUser[uid][i].id).delete().catch(function(){});
          }
        }
      });
      // Sort by time
      visible.sort(function(a,b){
        var at=a.createdAt?a.createdAt.seconds:0;
        var bt=b.createdAt?b.createdAt.seconds:0;
        return bt-at;
      });
      _statusReelData=visible;
      icRenderStatusReel();
    },function(err){console.warn('statusReel:',err.message)});
}

function icRenderStatusReel(){
  var scroller=document.getElementById('icStatusScroller');
  if(!scroller)return;
  if(!_statusReelData.length){
    scroller.innerHTML='<span style="color:rgba(255,255,255,.2);font-size:11px;padding:0 12px">No status updates — click ✏️ to post one</span>';
    scroller.style.animation='none';
    return;
  }
  var uid=getUserId();
  var me=getUserName();
  var isAdmin=false;
  try{var p=getMFXProfile();var r=(p.role||'').toLowerCase();isAdmin=['ceo','admin','administrator','owner','operations manager','manager'].indexOf(r)>=0}catch(e){}

  var h='';
  var items=_statusReelData;
  items.forEach(function(s){
    var isAnnouncement=s.announcement===true;
    var isOwn=s.userId===uid;
    var likes=(s.likes||[]).length;
    var myLike=(s.likes||[]).indexOf(uid)>=0;
    var replies=s.replyCount||0;
    var timeAgo=s.createdAt?icTimeAgo(s.createdAt):'';

    h+='<div class="ic-status-item'+(isAnnouncement?' ic-status-announcement':'')+'" onclick="icExpandStatus(\''+esc(s.id)+'\')">';
    // Avatar
    h+='<div class="ic-status-avatar" style="background:'+_avatarGrad(s.user||'?')+'">'+icInitials(s.user||'?')+'</div>';
    // Emoji/GIF
    if(s.emoji)h+='<span class="ic-status-emoji">'+s.emoji+'</span>';
    if(s.gif)h+='<img class="ic-status-gif" src="'+esc(s.gif)+'">';
    // Text with @mentions highlighted
    var text=esc(s.text||'');
    text=text.replace(/@(\w+)/g,'<span style="color:#00e5ff;font-weight:600">@$1</span>');
    h+='<span class="ic-status-text">'+(isAnnouncement?'📢 ':'')+text+'</span>';
    // Time
    h+='<span class="ic-status-time">'+timeAgo+'</span>';
    // Actions
    h+='<span class="ic-status-actions" onclick="event.stopPropagation()">';
    h+='<span onclick="icLikeStatus(\''+esc(s.id)+'\')" title="Like" style="'+(myLike?'color:#00e5ff':'')+'">♥</span>';
    if(likes>0)h+='<span class="ic-status-likes">'+likes+'</span>';
    h+='<span onclick="icReplyStatus(\''+esc(s.id)+'\')" title="Reply">💬</span>';
    if(replies>0)h+='<span class="ic-status-likes">'+replies+'</span>';
    if(isOwn||isAdmin)h+='<span onclick="icDeleteStatus(\''+esc(s.id)+'\')" title="Delete" style="color:rgba(239,68,68,.5)">✕</span>';
    h+='</span>';
    h+='</div>';
  });
  scroller.innerHTML=h;
  // Set animation speed based on item count (more items = slower scroll)
  var dur=Math.max(20,_statusReelData.length*8);
  scroller.style.animation='icScrollStatus '+dur+'s linear infinite';
  // Mirror to IC reel
  var scroller2=document.getElementById('icReelScroller2');
  if(scroller2){
    scroller2.innerHTML=h;
    scroller2.style.animation='icScrollStatus '+dur+'s linear infinite';
  }
}

// Post a new status
function icPostStatus(){
  var h='<div class="modal-title">Post a Status</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Share a quick update with the team. Visible for 24 hours.</div>';
  h+='<textarea id="statusText" placeholder="What\'s happening? @mention anyone..." style="width:100%;min-height:60px;padding:10px;font-size:13px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;outline:none;resize:none;font-family:inherit;margin-bottom:8px"></textarea>';
  h+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">';
  h+='<div style="flex:1">';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:4px">Add an emoji</div>';
  h+='<div id="statusEmojiPick" style="display:flex;gap:4px;flex-wrap:wrap">';
  var statusEmojis=['🔥','🚀','✅','🎉','💪','⚡','🎯','💡','☕','🏆','📢','❤️','👀','🧠','💬','⭐'];
  statusEmojis.forEach(function(e){
    h+='<span onclick="document.getElementById(\'statusEmojiSelected\').value=\''+e+'\';document.querySelectorAll(\'#statusEmojiPick span\').forEach(function(s){s.style.background=\'none\'});this.style.background=\'rgba(0,229,255,.15)\';this.style.borderRadius=\'6px\'" style="cursor:pointer;font-size:18px;padding:3px;border-radius:6px;transition:background .1s">'+e+'</span>';
  });
  h+='</div>';
  h+='<input type="hidden" id="statusEmojiSelected" value="">';
  h+='</div>';
  h+='</div>';
  // GIF option
  h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
  h+='<button onclick="icStatusSearchGif()" class="btn btn-ghost btn-sm" style="flex:1;border-radius:10px">🖼 Add GIF</button>';
  h+='<div id="statusGifPreview" style="display:none;position:relative"><img id="statusGifImg" style="height:40px;border-radius:6px"><span onclick="document.getElementById(\'statusGifPreview\').style.display=\'none\';document.getElementById(\'statusGifUrl\').value=\'\'" style="position:absolute;top:-4px;right:-4px;cursor:pointer;background:rgba(0,0,0,.7);border-radius:50%;width:14px;height:14px;font-size:8px;display:flex;align-items:center;justify-content:center;color:#fff">&times;</span></div>';
  h+='<input type="hidden" id="statusGifUrl" value="">';
  h+='</div>';
  // Admin announcement toggle
  var isAdmin=false;
  try{var p=getMFXProfile();var r=(p.role||'').toLowerCase();isAdmin=['ceo','admin','administrator','owner','operations manager','manager'].indexOf(r)>=0}catch(e){}
  if(isAdmin){
    h+='<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--tx3);cursor:pointer;margin-bottom:12px;padding:8px 10px;background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.1);border-radius:10px"><input type="checkbox" id="statusAnnounce" style="accent-color:#f59e0b"> 📢 Make this an official announcement</label>';
  }
  h+='<button onclick="icSubmitStatus()" class="btn btn-pr" style="width:100%;padding:12px;border-radius:12px;font-size:13px;font-weight:700">Post Status</button>';
  h+='<button onclick="closeModal()" class="btn btn-ghost" style="width:100%;margin-top:4px;padding:8px;border-radius:12px">Cancel</button>';
  if(typeof openModal==='function')openModal(h);
}

function icStatusSearchGif(){
  // Use GIPHY search inline
  var h2='<div class="modal-title">Pick a GIF for Status</div>';
  h2+='<div style="display:flex;gap:4px;margin-bottom:8px"><input id="statusGifSearch" placeholder="Search GIFs..." style="flex:1;padding:8px 10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;outline:none" onkeydown="if(event.key===\'Enter\')icStatusGifDoSearch()"><button onclick="icStatusGifDoSearch()" class="btn btn-pr btn-sm" style="border-radius:10px">Search</button></div>';
  h2+='<div id="statusGifGrid" style="display:flex;flex-wrap:wrap;gap:4px;max-height:250px;overflow-y:auto;justify-content:center"></div>';
  if(typeof openModal==='function')openModal(h2);
  // Load trending
  fetch('https://api.giphy.com/v1/gifs/trending?api_key='+GIPHY_KEY+'&limit=16&rating=pg').then(function(r){return r.json()}).then(function(json){
    icStatusGifRender(json.data||[]);
  }).catch(function(){});
}

function icStatusGifDoSearch(){
  var inp=document.getElementById('statusGifSearch');
  if(!inp||!inp.value.trim())return;
  fetch('https://api.giphy.com/v1/gifs/search?api_key='+GIPHY_KEY+'&q='+encodeURIComponent(inp.value.trim())+'&limit=16&rating=pg').then(function(r){return r.json()}).then(function(json){
    icStatusGifRender(json.data||[]);
  }).catch(function(){});
}

function icStatusGifRender(gifs){
  var el=document.getElementById('statusGifGrid');if(!el)return;
  if(!gifs.length){el.innerHTML='<div style="padding:20px;color:var(--tx3);font-size:10px">No GIFs found</div>';return}
  var h='';
  gifs.forEach(function(g){
    var preview=g.images.fixed_height_small.url;
    var full=g.images.fixed_height.url;
    h+='<img src="'+esc(preview)+'" onclick="icStatusPickGif(\''+esc(full)+'\')" style="height:80px;border-radius:6px;cursor:pointer;object-fit:cover;transition:transform .1s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">';
  });
  el.innerHTML=h;
}

function icStatusPickGif(url){
  // Go back to post modal with the GIF attached
  if(typeof closeModal==='function')closeModal();
  // Re-open post status
  setTimeout(function(){
    icPostStatus();
    setTimeout(function(){
      var gifUrl=document.getElementById('statusGifUrl');
      var gifPreview=document.getElementById('statusGifPreview');
      var gifImg=document.getElementById('statusGifImg');
      if(gifUrl)gifUrl.value=url;
      if(gifImg)gifImg.src=url;
      if(gifPreview)gifPreview.style.display='block';
    },100);
  },200);
}

function icSubmitStatus(){
  var textEl=document.getElementById('statusText');
  var text=textEl?textEl.value.trim():'';
  var emoji=(document.getElementById('statusEmojiSelected')||{}).value||'';
  var gif=(document.getElementById('statusGifUrl')||{}).value||'';
  var announce=document.getElementById('statusAnnounce');
  var isAnnounce=announce?announce.checked:false;

  if(!text&&!emoji&&!gif){if(typeof toast==='function')toast('Write something first','err');return}
  if(!fbDb)return;

  // Extract @mentions
  var mentions=[];
  var mentionMatch=text.match(/@(\w+)/g);
  if(mentionMatch)mentions=mentionMatch.map(function(m){return m.substring(1)});

  fbDb.collection('statusReel').add({
    text:text,
    emoji:emoji,
    gif:gif||null,
    user:getUserName(),
    userId:getUserId(),
    dept:(getMFXProfile().dept||''),
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    announcement:isAnnounce,
    likes:[],
    replyCount:0,
    mentions:mentions,
    replies:[]
  }).then(function(){
    if(typeof closeModal==='function')closeModal();
    if(typeof toast==='function')toast(isAnnounce?'Announcement posted!':'Status posted!','ok');
  }).catch(function(e){
    console.warn('statusPost:',e);
    if(typeof toast==='function')toast('Failed to post','err');
  });
}

function icLikeStatus(statusId){
  if(!fbDb)return;
  var uid=getUserId();
  var status=_statusReelData.find(function(s){return s.id===statusId});
  if(!status)return;
  var likes=status.likes||[];
  var update={};
  if(likes.indexOf(uid)>=0){
    update.likes=firebase.firestore.FieldValue.arrayRemove(uid);
  }else{
    update.likes=firebase.firestore.FieldValue.arrayUnion(uid);
  }
  fbDb.collection('statusReel').doc(statusId).update(update).catch(function(e){console.warn('statusLike:',e)});
}

function icDeleteStatus(statusId){
  if(!fbDb)return;
  if(!confirm('Delete this status?'))return;
  fbDb.collection('statusReel').doc(statusId).delete().then(function(){
    if(typeof toast==='function')toast('Status deleted','ok');
  }).catch(function(e){console.warn('statusDelete:',e)});
}

function icReplyStatus(statusId){
  var status=_statusReelData.find(function(s){return s.id===statusId});
  if(!status)return;
  var reply=prompt('Reply to '+status.user+':');
  if(!reply||!reply.trim())return;
  if(!fbDb)return;
  // Add reply to subcollection and increment count
  fbDb.collection('statusReel').doc(statusId).collection('replies').add({
    text:reply.trim(),
    user:getUserName(),
    userId:getUserId(),
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  fbDb.collection('statusReel').doc(statusId).update({
    replyCount:firebase.firestore.FieldValue.increment(1)
  }).catch(function(e){console.warn('statusReply:',e)});
  if(typeof toast==='function')toast('Reply sent','ok');
}

function icExpandStatus(statusId){
  var status=_statusReelData.find(function(s){return s.id===statusId});
  if(!status)return;
  // Show expanded view in modal with full text, replies, etc.
  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">';
  h+='<div style="width:36px;height:36px;border-radius:50%;background:'+_avatarGrad(status.user||'?')+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">'+icInitials(status.user||'?')+'</div>';
  h+='<div><div style="font-size:13px;font-weight:700;color:var(--tx)">'+esc(status.user)+'</div>';
  h+='<div style="font-size:9px;color:var(--tx3)">'+esc(status.dept||'')+(status.createdAt?' · '+icTimeAgo(status.createdAt):'')+'</div></div>';
  if(status.announcement)h+='<span style="background:rgba(245,158,11,.15);color:#f59e0b;font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px;margin-left:auto">ANNOUNCEMENT</span>';
  h+='</div>';
  if(status.emoji)h+='<div style="font-size:32px;margin-bottom:8px">'+status.emoji+'</div>';
  var text=esc(status.text||'');
  text=text.replace(/@(\w+)/g,'<span style="color:#00e5ff;font-weight:600">@$1</span>');
  h+='<div style="font-size:14px;color:var(--tx);line-height:1.6;margin-bottom:12px">'+text+'</div>';
  if(status.gif)h+='<div style="margin-bottom:12px"><img src="'+esc(status.gif)+'" style="max-width:100%;max-height:200px;border-radius:12px"></div>';
  // Likes
  var likes=(status.likes||[]).length;
  h+='<div style="display:flex;gap:12px;padding:8px 0;border-top:1px solid var(--bdr);border-bottom:1px solid var(--bdr);margin-bottom:12px">';
  h+='<span onclick="icLikeStatus(\''+esc(status.id)+'\')" style="cursor:pointer;font-size:12px;color:var(--tx3);display:flex;align-items:center;gap:4px">♥ '+likes+' likes</span>';
  h+='<span style="font-size:12px;color:var(--tx3);display:flex;align-items:center;gap:4px">💬 '+(status.replyCount||0)+' replies</span>';
  h+='</div>';
  // Load replies
  h+='<div id="statusRepliesContainer" style="max-height:200px;overflow-y:auto"><div style="text-align:center;color:var(--tx3);font-size:10px;padding:8px">Loading replies...</div></div>';
  h+='<div style="display:flex;gap:6px;margin-top:8px"><input id="statusReplyInput" placeholder="Write a reply..." style="flex:1;padding:8px 12px;font-size:12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);outline:none"><button onclick="icSubmitExpandedReply(\''+esc(status.id)+'\')" class="btn btn-pr btn-sm" style="border-radius:10px">Reply</button></div>';
  if(typeof openModal==='function')openModal(h);
  // Load replies from subcollection
  if(fbDb){
    fbDb.collection('statusReel').doc(statusId).collection('replies').orderBy('createdAt','asc').limit(50).get().then(function(snap){
      var container=document.getElementById('statusRepliesContainer');if(!container)return;
      if(!snap.docs.length){container.innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:8px">No replies yet</div>';return}
      var rh='';
      snap.docs.forEach(function(d){
        var r=d.data();
        var rt=r.createdAt?icTimeAgo(r.createdAt):'';
        rh+='<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.03)">';
        rh+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;color:var(--tx)">'+esc(r.user)+'</span><span style="font-size:8px;color:var(--tx3)">'+rt+'</span></div>';
        rh+='<div style="font-size:12px;color:var(--tx2);margin-top:2px">'+esc(r.text)+'</div></div>';
      });
      container.innerHTML=rh;
    }).catch(function(){});
  }
}

function icSubmitExpandedReply(statusId){
  var inp=document.getElementById('statusReplyInput');
  if(!inp||!inp.value.trim()||!fbDb)return;
  fbDb.collection('statusReel').doc(statusId).collection('replies').add({
    text:inp.value.trim(),
    user:getUserName(),
    userId:getUserId(),
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  fbDb.collection('statusReel').doc(statusId).update({
    replyCount:firebase.firestore.FieldValue.increment(1)
  }).catch(function(){});
  inp.value='';
  if(typeof toast==='function')toast('Reply sent','ok');
  // Refresh replies
  setTimeout(function(){icExpandStatus(statusId)},500);
}

// Avatar gradient helper (reuse from icShowList)
function _avatarGrad(name){
  var gradients=['linear-gradient(135deg,#667eea,#764ba2)','linear-gradient(135deg,#f093fb,#f5576c)','linear-gradient(135deg,#4facfe,#00f2fe)','linear-gradient(135deg,#43e97b,#38f9d7)','linear-gradient(135deg,#fa709a,#fee140)','linear-gradient(135deg,#a18cd1,#fbc2eb)','linear-gradient(135deg,#fccb90,#d57eeb)','linear-gradient(135deg,#e0c3fc,#8ec5fc)','linear-gradient(135deg,#f5576c,#ff6a88)','linear-gradient(135deg,#00e5ff,#0099cc)'];
  var hash=0;for(var i=0;i<name.length;i++)hash=name.charCodeAt(i)+((hash<<5)-hash);
  return gradients[Math.abs(hash)%gradients.length];
}

// Start reel when IC opens
var _origToggleIC=toggleInstantChat;

window.icPostStatus=icPostStatus;
window.icSubmitStatus=icSubmitStatus;
window.icLikeStatus=icLikeStatus;
window.icDeleteStatus=icDeleteStatus;
window.icReplyStatus=icReplyStatus;
window.icExpandStatus=icExpandStatus;
window.icSubmitExpandedReply=icSubmitExpandedReply;
window.icStatusSearchGif=icStatusSearchGif;
window.icStatusGifDoSearch=icStatusGifDoSearch;
window.icStatusPickGif=icStatusPickGif;

// ══════════════════════════════════════════════════════════════════
// PRESENCE BAR — status, mood, custom message, team presence
// ══════════════════════════════════════════════════════════════════

var PRESENCE_STATES=[
  {key:'online',label:'Online',color:'#2ee89e',emoji:'🟢'},
  {key:'away',label:'Away',color:'#f59e0b',emoji:'🟡'},
  {key:'break',label:'On Break',color:'#a855f7',emoji:'☕'},
  {key:'lunch',label:'At Lunch',color:'#f97316',emoji:'🍕'},
  {key:'wrapping',label:'Wrapping Up',color:'#3b82f6',emoji:'📦'},
  {key:'offline',label:'Offline',color:'#555',emoji:'🔴'}
];

var _myPresenceIdx=0;
var _presenceListener=null;

var _reelPinned=localStorage.getItem('mfx_reel_pinned')==='true';
var _reelHoverTimer=null;

function showReel(){
  var reel=document.getElementById('statusReelBar');
  var views=document.querySelector('.views');
  if(!reel)return;
  reel.style.height='44px';
  reel.style.opacity='1';
  if(views)views.classList.add('reel-open');
}
function hideReel(){
  if(_reelPinned)return;
  var reel=document.getElementById('statusReelBar');
  var views=document.querySelector('.views');
  if(!reel)return;
  reel.style.height='0';
  reel.style.opacity='0';
  if(views)views.classList.remove('reel-open');
}
function togglePinReel(){
  _reelPinned=!_reelPinned;
  localStorage.setItem('mfx_reel_pinned',_reelPinned?'true':'false');
  var btn=document.getElementById('pinReelBtn');
  if(btn){
    btn.style.background=_reelPinned?'rgba(0,229,255,.15)':'rgba(255,255,255,.04)';
    btn.style.color=_reelPinned?'#00e5ff':'var(--tx3)';
  }
  if(_reelPinned){showReel()}else{hideReel()}
}
window.togglePinReel=togglePinReel;

function initPresenceBar(){
  var bar=document.getElementById('presenceBar');
  var reel=document.getElementById('statusReelBar');
  if(bar)bar.style.display='flex';
  // Reel: hover to show, pin to keep open
  if(bar&&reel){
    bar.addEventListener('mouseenter',function(){
      clearTimeout(_reelHoverTimer);
      showReel();
    });
    bar.addEventListener('mouseleave',function(){
      _reelHoverTimer=setTimeout(hideReel,400);
    });
    reel.addEventListener('mouseenter',function(){
      clearTimeout(_reelHoverTimer);
    });
    reel.addEventListener('mouseleave',function(){
      _reelHoverTimer=setTimeout(hideReel,400);
    });
    // If pinned, show immediately
    if(_reelPinned){
      showReel();
      var btn=document.getElementById('pinReelBtn');
      if(btn){btn.style.background='rgba(0,229,255,.15)';btn.style.color='#00e5ff'}
    }
  }
  // Load my saved presence
  var saved=localStorage.getItem('mfx_presence');
  if(saved){
    for(var i=0;i<PRESENCE_STATES.length;i++){
      if(PRESENCE_STATES[i].key===saved){_myPresenceIdx=i;break}
    }
  }
  updateMyPresenceUI();
  // Load my mood + custom status
  var mood=localStorage.getItem('mfx_mood')||'😊';
  var status=localStorage.getItem('mfx_custom_status')||'';
  var moodEl=document.getElementById('myMood');
  var statusEl=document.getElementById('myCustomStatus');
  if(moodEl)moodEl.textContent=mood;
  if(statusEl)statusEl.textContent=status||'Set a status...';
  // Write presence to Firestore
  writePresenceToFirestore();
  // Listen for team presence
  startTeamPresenceListener();
  // Start status reel
  icStartStatusReel();
}

function cycleMyPresence(){
  _myPresenceIdx=(_myPresenceIdx+1)%PRESENCE_STATES.length;
  var state=PRESENCE_STATES[_myPresenceIdx];
  localStorage.setItem('mfx_presence',state.key);
  updateMyPresenceUI();
  writePresenceToFirestore();
  // Post to status reel
  if(typeof fbDb!=='undefined'&&state.key!=='online'){
    var name=typeof getUserName==='function'?getUserName():'User';
    fbDb.collection('statusReel').add({
      text:name+' is '+state.label.toLowerCase(),
      emoji:state.emoji,gif:null,user:'Flex Ai',userId:'system-flexai',dept:'System',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      announcement:false,likes:[],replyCount:0,mentions:[],replies:[]
    }).catch(function(){});
  }
}

function updateMyPresenceUI(){
  var state=PRESENCE_STATES[_myPresenceIdx];
  // Main bar
  var dot=document.getElementById('myPresenceDot');
  var label=document.getElementById('myPresenceLabel');
  if(dot)dot.style.background=state.color;
  if(label){label.textContent=state.label;label.style.color=state.color}
  // IC bar mirror
  var dot2=document.getElementById('icMyDot');
  var label2=document.getElementById('icMyPresence');
  if(dot2)dot2.style.background=state.color;
  if(label2){label2.textContent=state.label;label2.style.color=state.color}
  // IC mood + status
  var mood=localStorage.getItem('mfx_mood')||'😊';
  var status=localStorage.getItem('mfx_custom_status')||'';
  var m2=document.getElementById('icMyMood');if(m2)m2.textContent=mood;
  var s2=document.getElementById('icMyStatus');if(s2)s2.textContent=status||'Set status...';
}

function writePresenceToFirestore(){
  if(typeof fbDb==='undefined')return;
  var uid=typeof getUserId==='function'?getUserId():'';
  if(!uid)return;
  var state=PRESENCE_STATES[_myPresenceIdx];
  var mood=localStorage.getItem('mfx_mood')||'😊';
  var status=localStorage.getItem('mfx_custom_status')||'';
  fbDb.collection('users').doc(uid).update({
    presence:state.key,
    presenceColor:state.color,
    presenceLabel:state.label,
    mood:mood,
    customStatus:status,
    lastSeen:firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(e){console.warn('presenceWrite:',e)});
}

function pickMood(){
  var moods=['😊','😎','🔥','💪','🚀','🧠','😴','🤔','😤','☕','🎯','❤️','🎉','⭐','👀','💬'];
  var h='<div class="modal-title">How are you feeling?</div>';
  h+='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:12px 0">';
  moods.forEach(function(m){
    h+='<span onclick="setMood(\''+m+'\')" style="cursor:pointer;font-size:32px;padding:8px;border-radius:12px;transition:all .15s" onmouseover="this.style.background=\'rgba(255,255,255,.1)\';this.style.transform=\'scale(1.2)\'" onmouseout="this.style.background=\'none\';this.style.transform=\'scale(1)\'">'+m+'</span>';
  });
  h+='</div>';
  h+='<div style="margin-top:8px"><input id="moodComment" placeholder="Comment of the day..." style="width:100%;padding:10px 14px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#fff;outline:none;font-family:inherit" value="'+(localStorage.getItem('mfx_custom_status')||'')+'"></div>';
  h+='<button onclick="saveMoodComment()" class="btn btn-pr" style="width:100%;margin-top:10px;padding:10px;border-radius:12px;font-size:13px">Save</button>';
  if(typeof openModal==='function')openModal(h);
}

function setMood(emoji){
  localStorage.setItem('mfx_mood',emoji);
  var el=document.getElementById('myMood');if(el)el.textContent=emoji;
  writePresenceToFirestore();
  if(typeof closeModal==='function')closeModal();
}

function saveMoodComment(){
  var inp=document.getElementById('moodComment');
  var comment=inp?inp.value.trim():'';
  localStorage.setItem('mfx_custom_status',comment);
  var el=document.getElementById('myCustomStatus');
  if(el)el.textContent=comment||'Set a status...';
  writePresenceToFirestore();
  if(typeof closeModal==='function')closeModal();
}

function editMyStatus(){
  var current=localStorage.getItem('mfx_custom_status')||'';
  var h='<div class="modal-title">Set Your Status</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">Let your team know what you\'re up to</div>';
  // Quick status presets
  var presets=[
    {emoji:'💻',text:'Focused — do not disturb'},
    {emoji:'📞',text:'In a meeting'},
    {emoji:'🏠',text:'Working from home'},
    {emoji:'🚗',text:'Commuting'},
    {emoji:'🏥',text:'Out sick'},
    {emoji:'🌴',text:'On vacation'},
    {emoji:'📦',text:'Wrapping up for the day'},
    {emoji:'🔙',text:'Be right back'}
  ];
  h+='<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">';
  presets.forEach(function(p){
    h+='<div onclick="setQuickStatus(\''+p.emoji+'\',\''+esc(p.text)+'\')" style="padding:8px 12px;cursor:pointer;font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px;border-radius:8px;transition:background .1s" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\'none\'">'+p.emoji+' '+esc(p.text)+'</div>';
  });
  h+='</div>';
  h+='<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px"><input id="customStatusInput" placeholder="Or type your own..." value="'+esc(current)+'" style="width:100%;padding:10px 14px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#fff;outline:none;font-family:inherit"></div>';
  h+='<button onclick="saveCustomStatus()" class="btn btn-pr" style="width:100%;margin-top:8px;padding:10px;border-radius:12px">Save Status</button>';
  h+='<button onclick="clearCustomStatus()" class="btn btn-ghost" style="width:100%;margin-top:4px;padding:8px;border-radius:12px;font-size:11px">Clear Status</button>';
  if(typeof openModal==='function')openModal(h);
}

function setQuickStatus(emoji,text){
  localStorage.setItem('mfx_mood',emoji);
  localStorage.setItem('mfx_custom_status',text);
  var moodEl=document.getElementById('myMood');if(moodEl)moodEl.textContent=emoji;
  var statusEl=document.getElementById('myCustomStatus');if(statusEl)statusEl.textContent=text;
  writePresenceToFirestore();
  if(typeof closeModal==='function')closeModal();
}

function saveCustomStatus(){
  var inp=document.getElementById('customStatusInput');
  var text=inp?inp.value.trim():'';
  localStorage.setItem('mfx_custom_status',text);
  var el=document.getElementById('myCustomStatus');if(el)el.textContent=text||'Set a status...';
  writePresenceToFirestore();
  if(typeof closeModal==='function')closeModal();
}

function clearCustomStatus(){
  localStorage.removeItem('mfx_custom_status');
  var el=document.getElementById('myCustomStatus');if(el)el.textContent='Set a status...';
  writePresenceToFirestore();
  if(typeof closeModal==='function')closeModal();
}

// Team presence — show other users' status
function startTeamPresenceListener(){
  if(_presenceListener)return;
  if(typeof fbDb==='undefined')return;
  _presenceListener=fbDb.collection('users').onSnapshot(function(snap){
    var me=typeof getUserName==='function'?getUserName():'';
    var el=document.getElementById('teamPresenceList');if(!el)return;
    var users=[];
    snap.docs.forEach(function(d){
      var u=d.data();
      var name=u.displayName||'';if(!name||name===me)return;
      users.push({name:name,presence:u.presence||'offline',color:u.presenceColor||'#555',label:u.presenceLabel||'Offline',mood:u.mood||'',status:u.customStatus||'',dept:u.department||u.dept||''});
    });
    // Sort: online first, then by presence priority
    var order={online:0,away:1,'break':2,lunch:3,wrapping:4,offline:5};
    users.sort(function(a,b){return(order[a.presence]||5)-(order[b.presence]||5)});
    var h='';
    users.forEach(function(u){
      h+='<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,.03);cursor:default" title="'+esc(u.name)+' — '+esc(u.label)+(u.status?' · '+esc(u.status):'')+'">';
      h+='<span style="width:6px;height:6px;border-radius:50%;background:'+u.color+';flex-shrink:0"></span>';
      if(u.mood)h+='<span style="font-size:11px">'+u.mood+'</span>';
      h+='<span style="font-size:10px;color:'+u.color+';font-weight:600;max-width:80px;overflow:hidden;text-overflow:ellipsis">'+esc(u.name.split(' ')[0])+'</span>';
      if(u.status)h+='<span style="font-size:9px;color:rgba(255,255,255,.25);max-width:100px;overflow:hidden;text-overflow:ellipsis">'+esc(u.status)+'</span>';
      h+='</div>';
    });
    el.innerHTML=h;
    // Mirror to IC presence bar
    var icDots=document.getElementById('icTeamDots');
    if(icDots){
      var ih='';
      users.slice(0,12).forEach(function(u){
        ih+='<div style="display:flex;align-items:center;gap:3px;flex-shrink:0" title="'+esc(u.name)+' — '+esc(u.label)+'">';
        ih+='<span style="width:5px;height:5px;border-radius:50%;background:'+u.color+'"></span>';
        if(u.mood)ih+='<span style="font-size:9px">'+u.mood+'</span>';
        ih+='<span style="font-size:9px;color:'+u.color+';font-weight:600">'+esc(u.name.split(' ')[0])+'</span>';
        ih+='</div>';
      });
      icDots.innerHTML=ih;
    }
  },function(err){console.warn('teamPresence:',err.message)});
}

window.cycleMyPresence=cycleMyPresence;
window.pickMood=pickMood;
window.setMood=setMood;
window.saveMoodComment=saveMoodComment;
window.editMyStatus=editMyStatus;
window.setQuickStatus=setQuickStatus;
window.saveCustomStatus=saveCustomStatus;
window.clearCustomStatus=clearCustomStatus;
window.initPresenceBar=initPresenceBar;
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

// ══════════════════════════════════════════════════════════════════
// FEATURE 1: KUDOS / SHOUTOUT SYSTEM
// ══════════════════════════════════════════════════════════════════
var KUDOS_TYPES=[
  {key:'great',emoji:'\u2B50',label:'Great Work'},
  {key:'beyond',emoji:'\uD83D\uDD25',label:'Above & Beyond'},
  {key:'team',emoji:'\uD83D\uDCAA',label:'Team Player'},
  {key:'solver',emoji:'\uD83E\uDDE0',label:'Problem Solver'},
  {key:'goal',emoji:'\uD83C\uDFAF',label:'Goal Crusher'},
  {key:'innovation',emoji:'\uD83D\uDE80',label:'Innovation'}
];

function icSendKudos(){
  if(typeof fbDb==='undefined')return;
  var name=typeof getUserName==='function'?getUserName():'User';
  // Build team member list from Firestore users
  fbDb.collection('users').get().then(function(snap){
    var members=[];
    snap.docs.forEach(function(d){
      var u=d.data();
      var n=u.displayName||'';
      if(n&&n!==name)members.push({id:d.id,name:n});
    });
    var h='<div class="modal-title">\u2B50 Send a Kudos</div>';
    h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Recognize a teammate\'s great work</div>';
    h+='<select id="kudosTo" style="width:100%;padding:10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;margin-bottom:8px;outline:none">';
    h+='<option value="">Select team member...</option>';
    members.forEach(function(m){
      h+='<option value="'+esc(m.id)+'|'+esc(m.name)+'">'+esc(m.name)+'</option>';
    });
    h+='</select>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    KUDOS_TYPES.forEach(function(k,i){
      h+='<label style="display:flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:8px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.7)">';
      h+='<input type="radio" name="kudosType" value="'+i+'" style="accent-color:#00e5ff"'+(i===0?' checked':'')+'>'+k.emoji+' '+esc(k.label)+'</label>';
    });
    h+='</div>';
    h+='<textarea id="kudosMsg" placeholder="What did they do great?" rows="3" style="width:100%;padding:10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;resize:none;outline:none;font-family:inherit;margin-bottom:8px"></textarea>';
    h+='<button onclick="_submitKudos()" class="btn btn-pr" style="width:100%;padding:10px;border-radius:12px;font-size:13px">Send Kudos \u2B50</button>';
    if(typeof openModal==='function')openModal(h);
  }).catch(function(e){console.warn('kudos:',e)});
}

function _submitKudos(){
  var sel=document.getElementById('kudosTo');
  var msg=document.getElementById('kudosMsg');
  if(!sel||!sel.value){if(typeof toast==='function')toast('Pick a team member');return;}
  var parts=sel.value.split('|');
  var toId=parts[0];var toName=parts[1];
  var radios=document.getElementsByName('kudosType');
  var typeIdx=0;
  for(var i=0;i<radios.length;i++){if(radios[i].checked){typeIdx=parseInt(radios[i].value);break;}}
  var kudosType=KUDOS_TYPES[typeIdx];
  var text=msg?msg.value.trim():'';
  var fromName=typeof getUserName==='function'?getUserName():'User';
  var fromId=typeof getUserId==='function'?getUserId():'';
  if(typeof fbDb==='undefined')return;
  fbDb.collection('kudos').add({
    from:fromName,fromId:fromId,to:toName,toId:toId,
    type:kudosType.key,emoji:kudosType.emoji,
    message:text,createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    likes:[]
  }).then(function(){
    // Post to status reel
    var reelText=kudosType.emoji+' '+fromName+' gave '+toName+' a shoutout: '+(text||kudosType.label+'!');
    fbDb.collection('statusReel').add({
      text:reelText,emoji:kudosType.emoji,gif:null,
      user:'Flex Ai',userId:'system-flexai',dept:'System',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      announcement:false,likes:[],replyCount:0,mentions:[],replies:[]
    }).catch(function(){});
    // Award XP
    if(typeof awardXP==='function')awardXP(toName,10,'kudos');
    if(typeof toast==='function')toast('Kudos sent to '+toName+'!');
    if(typeof closeModal==='function')closeModal();
  }).catch(function(e){console.warn('kudos save:',e)});
}
window._submitKudos=_submitKudos;

// ══════════════════════════════════════════════════════════════════
// FEATURE 2: QUICK POLLS
// ══════════════════════════════════════════════════════════════════
function icCreatePoll(){
  var h='<div class="modal-title">\uD83D\uDCCA Create a Poll</div>';
  h+='<input id="pollQ" placeholder="Ask a question..." style="width:100%;padding:10px;font-size:13px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;outline:none;margin-bottom:8px">';
  h+='<div id="pollOpts">';
  for(var i=0;i<2;i++){
    h+='<input class="poll-opt-input" placeholder="Option '+(i+1)+'" style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:8px;color:#fff;outline:none;margin-bottom:4px">';
  }
  h+='</div>';
  h+='<button onclick="_addPollOption()" style="background:none;border:none;color:#00e5ff;font-size:11px;cursor:pointer;padding:4px 0;margin-bottom:8px">+ Add option (max 4)</button>';
  h+='<select id="pollDuration" style="width:100%;padding:8px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;outline:none;margin-bottom:10px">';
  h+='<option value="3600000">1 hour</option><option value="14400000">4 hours</option><option value="86400000" selected>24 hours</option><option value="604800000">1 week</option>';
  h+='</select>';
  h+='<button onclick="_submitPoll()" class="btn btn-pr" style="width:100%;padding:10px;border-radius:12px;font-size:13px">Create Poll \uD83D\uDCCA</button>';
  if(typeof openModal==='function')openModal(h);
}

function _addPollOption(){
  var container=document.getElementById('pollOpts');
  if(!container)return;
  var existing=container.querySelectorAll('.poll-opt-input');
  if(existing.length>=4){if(typeof toast==='function')toast('Max 4 options');return;}
  var inp=document.createElement('input');
  inp.className='poll-opt-input';
  inp.placeholder='Option '+(existing.length+1);
  inp.style.cssText='width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:8px;color:#fff;outline:none;margin-bottom:4px';
  container.appendChild(inp);
}
window._addPollOption=_addPollOption;

function _submitPoll(){
  var q=document.getElementById('pollQ');
  var question=q?q.value.trim():'';
  if(!question){if(typeof toast==='function')toast('Enter a question');return;}
  var inputs=document.querySelectorAll('.poll-opt-input');
  var options=[];
  for(var i=0;i<inputs.length;i++){
    var v=inputs[i].value.trim();
    if(v)options.push({text:v,votes:[]});
  }
  if(options.length<2){if(typeof toast==='function')toast('Need at least 2 options');return;}
  var dur=document.getElementById('pollDuration');
  var duration=dur?parseInt(dur.value):86400000;
  var now=Date.now();
  var name=typeof getUserName==='function'?getUserName():'User';
  var uid=typeof getUserId==='function'?getUserId():'';
  if(typeof fbDb==='undefined')return;
  fbDb.collection('polls').add({
    question:question,options:options,
    createdBy:name,createdById:uid,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt:new Date(now+duration),
    channelId:IC.activeChat||'general',
    closed:false
  }).then(function(ref){
    // Post poll to status reel
    var optText=options.map(function(o){return o.text}).join(' / ');
    fbDb.collection('statusReel').add({
      text:'\uD83D\uDCCA Poll: '+question+' ('+optText+')',
      emoji:'\uD83D\uDCCA',gif:null,
      user:'Flex Ai',userId:'system-flexai',dept:'System',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      announcement:false,likes:[],replyCount:0,mentions:[],replies:[],
      pollId:ref.id
    }).catch(function(){});
    if(typeof toast==='function')toast('Poll created!');
    if(typeof closeModal==='function')closeModal();
  }).catch(function(e){console.warn('poll:',e)});
}
window._submitPoll=_submitPoll;

function icRenderPoll(poll){
  if(!poll)return'';
  var totalVotes=0;
  poll.options.forEach(function(o){totalVotes+=(o.votes||[]).length;});
  var expired=poll.closed||(poll.expiresAt&&(poll.expiresAt.seconds?poll.expiresAt.seconds*1000:new Date(poll.expiresAt).getTime())<Date.now());
  var h='<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px;margin:6px 0;max-width:320px">';
  h+='<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:8px">\uD83D\uDCCA '+esc(poll.question)+'</div>';
  poll.options.forEach(function(opt,idx){
    var count=(opt.votes||[]).length;
    var pct=totalVotes>0?Math.round(count/totalVotes*100):0;
    var uid=typeof getUserId==='function'?getUserId():'';
    var voted=(opt.votes||[]).indexOf(uid)!==-1;
    h+='<div onclick="'+(expired?'':'icVotePoll(\''+esc(poll.id)+'\','+idx+')')+'" style="margin-bottom:4px;cursor:'+(expired?'default':'pointer')+';padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.03);position:relative;overflow:hidden;border:1px solid '+(voted?'rgba(0,229,255,.3)':'rgba(255,255,255,.04)')+'">';
    h+='<div style="position:absolute;top:0;left:0;height:100%;width:'+pct+'%;background:'+(voted?'rgba(0,229,255,.12)':'rgba(255,255,255,.04)')+';border-radius:8px;transition:width .3s"></div>';
    h+='<div style="position:relative;display:flex;justify-content:space-between;align-items:center">';
    h+='<span style="font-size:11px;color:'+(voted?'#00e5ff':'rgba(255,255,255,.7)')+'">'+esc(opt.text)+'</span>';
    h+='<span style="font-size:10px;color:rgba(255,255,255,.4)">'+count+' ('+pct+'%)</span>';
    h+='</div></div>';
  });
  h+='<div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:4px">'+totalVotes+' vote'+(totalVotes!==1?'s':'')+''+(expired?' \u00B7 Closed':'')+'</div>';
  h+='</div>';
  return h;
}

function icVotePoll(pollId,optionIdx){
  if(typeof fbDb==='undefined')return;
  var uid=typeof getUserId==='function'?getUserId():'';
  if(!uid)return;
  var ref=fbDb.collection('polls').doc(pollId);
  ref.get().then(function(snap){
    if(!snap.exists)return;
    var data=snap.data();
    if(data.closed)return;
    // Remove from all options first, then add to selected
    var batch=fbDb.batch();
    var updates={};
    data.options.forEach(function(opt,i){
      updates['options.'+i+'.votes']=firebase.firestore.FieldValue.arrayRemove(uid);
    });
    ref.update(updates).then(function(){
      ref.update({
        ['options.'+optionIdx+'.votes']:firebase.firestore.FieldValue.arrayUnion(uid)
      }).then(function(){
        if(typeof toast==='function')toast('Vote recorded!');
      });
    });
  }).catch(function(e){console.warn('vote:',e)});
}

function icClosePoll(pollId){
  if(typeof fbDb==='undefined')return;
  var name=typeof getUserName==='function'?getUserName():'';
  fbDb.collection('polls').doc(pollId).get().then(function(snap){
    if(!snap.exists)return;
    var data=snap.data();
    if(data.createdBy!==name){
      var profile=typeof getMFXProfile==='function'?getMFXProfile():null;
      if(!profile||profile.role!=='admin'){
        if(typeof toast==='function')toast('Only the creator or admin can close polls');return;
      }
    }
    fbDb.collection('polls').doc(pollId).update({closed:true}).then(function(){
      if(typeof toast==='function')toast('Poll closed');
    });
  }).catch(function(e){console.warn('closePoll:',e)});
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 3: DAILY STANDUP BOT
// ══════════════════════════════════════════════════════════════════
function icScheduleStandup(){
  var today=new Date();
  var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  if(localStorage.getItem('mfx_standup_'+todayStr)){
    if(typeof toast==='function')toast('You already submitted your standup today!');
    return;
  }
  var h='<div class="modal-title">\uD83C\uDF05 Daily Standup</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">What\'s on your plate today?</div>';
  h+='<label style="font-size:10px;color:rgba(255,255,255,.4);display:block;margin-bottom:2px">What are you working on today?</label>';
  h+='<textarea id="standupWork" rows="2" placeholder="Main tasks for today..." style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;resize:none;outline:none;font-family:inherit;margin-bottom:8px"></textarea>';
  h+='<label style="font-size:10px;color:rgba(255,255,255,.4);display:block;margin-bottom:2px">Any blockers?</label>';
  h+='<textarea id="standupBlockers" rows="2" placeholder="Anything blocking you..." style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;resize:none;outline:none;font-family:inherit;margin-bottom:8px"></textarea>';
  h+='<label style="font-size:10px;color:rgba(255,255,255,.4);display:block;margin-bottom:2px">Need help with anything?</label>';
  h+='<textarea id="standupHelp" rows="2" placeholder="Any support needed..." style="width:100%;padding:8px 10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;resize:none;outline:none;font-family:inherit;margin-bottom:10px"></textarea>';
  h+='<button onclick="_submitStandup()" class="btn btn-pr" style="width:100%;padding:10px;border-radius:12px;font-size:13px">Submit Standup \uD83C\uDF05</button>';
  if(typeof openModal==='function')openModal(h);
}

function _submitStandup(){
  var work=document.getElementById('standupWork');
  var blockers=document.getElementById('standupBlockers');
  var help=document.getElementById('standupHelp');
  var workText=work?work.value.trim():'';
  if(!workText){if(typeof toast==='function')toast('Tell us what you\'re working on');return;}
  var blockersText=blockers?blockers.value.trim():'';
  var helpText=help?help.value.trim():'';
  var name=typeof getUserName==='function'?getUserName():'User';
  var uid=typeof getUserId==='function'?getUserId():'';
  var today=new Date();
  var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  if(typeof fbDb!=='undefined'){
    fbDb.collection('standups').add({
      user:name,userId:uid,date:todayStr,
      workingOn:workText,blockers:blockersText,needHelp:helpText,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
      // Post to status reel
      var reelText='\uD83C\uDF05 '+name+'\'s standup: Working on: '+workText;
      if(blockersText)reelText+=' | Blockers: '+blockersText;
      fbDb.collection('statusReel').add({
        text:reelText,emoji:'\uD83C\uDF05',gif:null,
        user:name,userId:uid,dept:'',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        announcement:false,likes:[],replyCount:0,mentions:[],replies:[]
      }).catch(function(){});
      localStorage.setItem('mfx_standup_'+todayStr,'1');
      if(typeof toast==='function')toast('Standup submitted!');
      if(typeof closeModal==='function')closeModal();
    }).catch(function(e){console.warn('standup:',e)});
  }
}
window._submitStandup=_submitStandup;

function _postMorningPrompt(){
  var today=new Date();
  var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  if(localStorage.getItem('mfx_morning_prompt_'+todayStr))return;
  if(typeof fbDb==='undefined')return;
  fbDb.collection('statusReel').add({
    text:'Good morning team! What\'s everyone working on today? \uD83C\uDF05',
    emoji:'\uD83C\uDF05',gif:null,
    user:'Flex Ai',userId:'system-flexai',dept:'System',
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    announcement:true,likes:[],replyCount:0,mentions:[],replies:[]
  }).then(function(){
    localStorage.setItem('mfx_morning_prompt_'+todayStr,'1');
  }).catch(function(){});
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 4: SMART NOTIFICATION PRIORITY
// ══════════════════════════════════════════════════════════════════
var _notifPriorityLevel='normal';

function icSetNotifPriority(level){
  // level: 'critical', 'action', 'fyi', 'normal'
  _notifPriorityLevel=level||'normal';
  var btn=document.getElementById('icPriorityBtn');
  if(btn){
    if(level==='critical'){btn.textContent='\uD83D\uDD34';btn.title='Priority: Critical';}
    else if(level==='action'){btn.textContent='\uD83D\uDFE1';btn.title='Priority: Action Needed';}
    else if(level==='fyi'){btn.textContent='\uD83D\uDD35';btn.title='Priority: FYI';}
    else{btn.textContent='\u2757';btn.title='Mark urgent';}
  }
}

function icCycleNotifPriority(){
  var order=['normal','critical','action','fyi'];
  var idx=order.indexOf(_notifPriorityLevel);
  idx=(idx+1)%order.length;
  icSetNotifPriority(order[idx]);
  if(typeof toast==='function'){
    var labels={normal:'Normal',critical:'\uD83D\uDD34 Critical',action:'\uD83D\uDFE1 Action Needed',fyi:'\uD83D\uDD35 FYI'};
    toast('Priority: '+(labels[order[idx]]||'Normal'));
  }
}
window.icCycleNotifPriority=icCycleNotifPriority;

function icSetQuietHours(start,end){
  localStorage.setItem('mfx_quiet_start',start||'22:00');
  localStorage.setItem('mfx_quiet_end',end||'07:00');
  if(typeof toast==='function')toast('Quiet hours set: '+start+' - '+end);
}

function _isQuietHours(){
  var start=localStorage.getItem('mfx_quiet_start');
  var end=localStorage.getItem('mfx_quiet_end');
  if(!start||!end)return false;
  var now=new Date();
  var h=now.getHours();var m=now.getMinutes();
  var nowMin=h*60+m;
  var sParts=start.split(':');var startMin=parseInt(sParts[0])*60+parseInt(sParts[1]);
  var eParts=end.split(':');var endMin=parseInt(eParts[0])*60+parseInt(eParts[1]);
  if(startMin>endMin){
    return nowMin>=startMin||nowMin<endMin;
  }
  return nowMin>=startMin&&nowMin<endMin;
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 5: WORKFLOW AUTO-ALERTS
// ══════════════════════════════════════════════════════════════════
function icCheckWorkflowAlerts(){
  if(typeof fbDb==='undefined')return;
  var today=new Date();
  var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  var alertsKey='mfx_workflow_alerts_'+todayStr;
  var posted=JSON.parse(localStorage.getItem(alertsKey)||'{}');
  var twoHoursAgo=new Date(Date.now()-2*60*60*1000);
  var twentyFourHoursAgo=new Date(Date.now()-24*60*60*1000);
  var sevenDaysFromNow=new Date(Date.now()+7*24*60*60*1000);

  function postAlert(key,text){
    if(posted[key])return;
    posted[key]=1;
    localStorage.setItem(alertsKey,JSON.stringify(posted));
    fbDb.collection('statusReel').add({
      text:text,emoji:'\u26A0\uFE0F',gif:null,
      user:'Flex Ai',userId:'system-flexai',dept:'System',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      announcement:false,likes:[],replyCount:0,mentions:[],replies:[]
    }).catch(function(){});
  }

  // Quotes pending approval > 2 hours
  fbDb.collection('quotes').where('status','==','approval')
    .get().then(function(snap){
      snap.docs.forEach(function(d){
        var q=d.data();
        var created=q.createdAt;
        if(!created)return;
        var cDate=created.seconds?new Date(created.seconds*1000):new Date(created);
        if(cDate<twoHoursAgo){
          var hrs=Math.round((Date.now()-cDate.getTime())/3600000);
          postAlert('quote_'+d.id,'\u23F0 Quote '+(q.quoteNumber||d.id)+' pending approval for '+hrs+' hours');
        }
      });
    }).catch(function(){});

  // Job tickets stuck in same stage > 24 hours
  fbDb.collection('jobTickets').get().then(function(snap){
    snap.docs.forEach(function(d){
      var j=d.data();
      var updated=j.stageUpdatedAt||j.updatedAt;
      if(!updated)return;
      var uDate=updated.seconds?new Date(updated.seconds*1000):new Date(updated);
      if(uDate<twentyFourHoursAgo){
        var days=Math.round((Date.now()-uDate.getTime())/86400000);
        postAlert('job_'+d.id,'\uD83D\uDEA7 Job '+(j.jobNumber||d.id)+' stuck in '+(j.stage||'unknown')+' for '+days+' day'+(days!==1?'s':''));
      }
    });
  }).catch(function(){});

  // Training records expiring < 7 days
  fbDb.collection('trainingRecords').get().then(function(snap){
    snap.docs.forEach(function(d){
      var t=d.data();
      if(!t.expiresAt)return;
      var eDate=t.expiresAt.seconds?new Date(t.expiresAt.seconds*1000):new Date(t.expiresAt);
      if(eDate>today&&eDate<sevenDaysFromNow){
        var daysLeft=Math.round((eDate.getTime()-Date.now())/86400000);
        postAlert('train_'+d.id,'\uD83D\uDCCB '+(t.userName||'Employee')+'\'s '+(t.trainingName||'training')+' expires in '+daysLeft+' day'+(daysLeft!==1?'s':''));
      }
    });
  }).catch(function(){});

  // Vendor POs overdue
  fbDb.collection('vendorPOs').where('status','==','sent')
    .get().then(function(snap){
      snap.docs.forEach(function(d){
        var po=d.data();
        if(!po.eta)return;
        var eta=po.eta.seconds?new Date(po.eta.seconds*1000):new Date(po.eta);
        if(eta<today){
          postAlert('vpo_'+d.id,'\uD83D\uDCE6 '+(po.poNumber||d.id)+' is overdue from '+(po.vendorName||'vendor'));
        }
      });
    }).catch(function(){});
}

// Run workflow alerts every 5 minutes
var _workflowAlertTimer=setInterval(function(){
  if(typeof getUserId==='function'&&getUserId())icCheckWorkflowAlerts();
},300000);

// ══════════════════════════════════════════════════════════════════
// FEATURE 6: DAILY DIGEST
// ══════════════════════════════════════════════════════════════════
function icPostDailyDigest(){
  if(typeof fbDb==='undefined')return;
  var today=new Date();
  var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  if(localStorage.getItem('mfx_digest_'+todayStr))return;
  var startOfDay=new Date(today.getFullYear(),today.getMonth(),today.getDate());

  var stats={quotes:0,jobs:0,messages:0,ncrs:0};
  var promises=[];

  promises.push(
    fbDb.collection('quotes').where('createdAt','>=',startOfDay)
      .get().then(function(s){stats.quotes=s.size;}).catch(function(){})
  );
  promises.push(
    fbDb.collection('jobTickets').where('status','==','completed')
      .where('completedAt','>=',startOfDay)
      .get().then(function(s){stats.jobs=s.size;}).catch(function(){stats.jobs=0;})
  );
  promises.push(
    fbDb.collection('messages').where('createdAt','>=',startOfDay)
      .get().then(function(s){stats.messages=s.size;}).catch(function(){})
  );
  promises.push(
    fbDb.collection('ncrs').where('createdAt','>=',startOfDay)
      .get().then(function(s){stats.ncrs=s.size;}).catch(function(){})
  );

  Promise.all(promises).then(function(){
    var text='\uD83D\uDCCA Today: '+stats.quotes+' quotes sent, '+stats.jobs+' jobs completed, '+stats.messages+' messages, '+stats.ncrs+' new NCRs';
    fbDb.collection('statusReel').add({
      text:text,emoji:'\uD83D\uDCCA',gif:null,
      user:'Flex Ai',userId:'system-flexai',dept:'System',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      announcement:true,likes:[],replyCount:0,mentions:[],replies:[]
    }).then(function(){
      localStorage.setItem('mfx_digest_'+todayStr,'1');
    }).catch(function(){});
  });
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 7: @CHANNEL / @HERE MENTIONS (send-side logic)
// ══════════════════════════════════════════════════════════════════
function _handleChannelMentions(text,channelId){
  if(typeof fbDb==='undefined')return;
  if(!text)return;
  var hasChannel=text.indexOf('@channel')!==-1;
  var hasHere=text.indexOf('@here')!==-1;
  if(!hasChannel&&!hasHere)return;
  var fromName=typeof getUserName==='function'?getUserName():'User';
  // Get all users
  fbDb.collection('users').get().then(function(snap){
    snap.docs.forEach(function(d){
      var u=d.data();
      if(!u.displayName)return;
      if(hasHere&&u.presence!=='online')return;
      // Write notification
      fbDb.collection('notifications').add({
        userId:d.id,
        type:hasChannel?'channel_mention':'here_mention',
        text:fromName+' mentioned '+(hasChannel?'@channel':'@here')+' in '+(channelId||'chat'),
        channelId:channelId||'',
        read:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
    });
  }).catch(function(){});
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 8: ANONYMOUS FEEDBACK BOX
// ══════════════════════════════════════════════════════════════════
function icAnonymousFeedback(){
  var h='<div class="modal-title">\uD83D\uDCEE Anonymous Feedback</div>';
  h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:10px">Your identity will NOT be recorded. Be honest!</div>';
  h+='<select id="feedbackCat" style="width:100%;padding:10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;outline:none;margin-bottom:8px">';
  h+='<option value="suggestion">Suggestion</option><option value="concern">Concern</option><option value="praise">Praise</option><option value="question">Question</option>';
  h+='</select>';
  h+='<textarea id="feedbackText" rows="4" placeholder="Share your feedback..." style="width:100%;padding:10px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;resize:none;outline:none;font-family:inherit;margin-bottom:10px"></textarea>';
  h+='<button onclick="_submitFeedback()" class="btn btn-pr" style="width:100%;padding:10px;border-radius:12px;font-size:13px">Submit Anonymously \uD83D\uDCEE</button>';
  if(typeof openModal==='function')openModal(h);
}

function _submitFeedback(){
  var cat=document.getElementById('feedbackCat');
  var text=document.getElementById('feedbackText');
  var feedbackText=text?text.value.trim():'';
  if(!feedbackText){if(typeof toast==='function')toast('Please write your feedback');return;}
  var category=cat?cat.value:'suggestion';
  if(typeof fbDb==='undefined')return;
  // No userId — truly anonymous
  fbDb.collection('anonymousFeedback').add({
    text:feedbackText,
    category:category,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    resolved:false
  }).then(function(){
    if(typeof toast==='function')toast('Feedback submitted anonymously. Thank you!');
    if(typeof closeModal==='function')closeModal();
  }).catch(function(e){console.warn('feedback:',e)});
}
window._submitFeedback=_submitFeedback;

// ══════════════════════════════════════════════════════════════════
// FEATURE 9: CONVERSATION STARTERS
// ══════════════════════════════════════════════════════════════════
var CONVO_STARTERS=[
  'What\'s your favorite thing about working here?',
  'If you could automate one task, what would it be?',
  'What\'s the best lunch spot near the office?',
  'Share a win from this week!',
  'What podcast are you listening to?',
  'Coffee or tea today?',
  'What\'s your hot take on the industry?',
  'Teach us something in 1 sentence',
  'What tool can\'t you live without?',
  'Rate your Monday 1-10',
  'What\'s one thing you learned this week?',
  'If you could swap roles for a day, whose would you pick?',
  'What keeps you motivated on tough days?',
  'Best book or article you read recently?',
  'What\'s your go-to productivity hack?',
  'Describe your workday in 3 emojis',
  'What\'s a skill you\'re working on improving?',
  'What would your dream project look like?',
  'Early bird or night owl?',
  'What\'s one thing you appreciate about a coworker?',
  'What song gets you pumped up for work?',
  'If you could add one perk to the office, what would it be?'
];

function icConversationStarter(){
  var today=new Date();
  var todayStr=today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  if(localStorage.getItem('mfx_convo_starter_'+todayStr))return;
  if(typeof fbDb==='undefined')return;
  var idx=Math.floor(Math.random()*CONVO_STARTERS.length);
  var prompt=CONVO_STARTERS[idx];
  // Delay randomly within first 2 hours (0-120 min)
  var delay=Math.floor(Math.random()*120*60*1000);
  setTimeout(function(){
    if(localStorage.getItem('mfx_convo_starter_'+todayStr))return;
    fbDb.collection('statusReel').add({
      text:'\uD83D\uDCAC '+prompt,
      emoji:'\uD83D\uDCAC',gif:null,
      user:'Flex Ai',userId:'system-flexai',dept:'System',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      announcement:false,likes:[],replyCount:0,mentions:[],replies:[]
    }).then(function(){
      localStorage.setItem('mfx_convo_starter_'+todayStr,'1');
    }).catch(function(){});
  },delay);
}

// ══════════════════════════════════════════════════════════════════
// FEATURE 10: TEAM MOOD HEATMAP (lightweight)
// ══════════════════════════════════════════════════════════════════
function icTeamMoodSummary(){
  if(typeof fbDb==='undefined')return'';
  var counts={};
  // Read from last presence snapshot if available
  var dots=document.getElementById('icTeamDots');
  // Use Firestore users collection snapshot
  return new Promise(function(resolve){
    fbDb.collection('users').get().then(function(snap){
      snap.docs.forEach(function(d){
        var u=d.data();
        var mood=u.mood||'';
        if(mood){
          counts[mood]=(counts[mood]||0)+1;
        }
      });
      var parts=[];
      var sorted=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]});
      sorted.forEach(function(emoji){
        parts.push(emoji+'\u00D7'+counts[emoji]);
      });
      var summary=parts.length>0?'Team vibe: '+parts.join(' '):'';
      resolve(summary);
      // Display in presence bar
      _displayMoodSummary(summary);
    }).catch(function(){resolve('')});
  });
}

function _displayMoodSummary(summary){
  var el=document.getElementById('icTeamMoodSummary');
  if(!el){
    // Try to inject into the presence bar next to team dots
    var dotsEl=document.getElementById('icTeamDots');
    if(dotsEl&&dotsEl.parentNode){
      var span=document.createElement('span');
      span.id='icTeamMoodSummary';
      span.style.cssText='font-size:9px;color:rgba(255,255,255,.4);margin-left:6px;white-space:nowrap';
      dotsEl.parentNode.insertBefore(span,dotsEl.nextSibling);
      el=span;
    }
  }
  if(el)el.textContent=summary;
}

// Update mood summary when team presence updates
var _origTeamPresenceListener=startTeamPresenceListener;
startTeamPresenceListener=function(){
  _origTeamPresenceListener();
  // Also refresh mood summary on presence changes
  setTimeout(function(){icTeamMoodSummary()},2000);
};

// ══════════════════════════════════════════════════════════════════
// AUTO-START: morning prompt, conversation starter, standup check
// ══════════════════════════════════════════════════════════════════
var _engagementBootCheck=setInterval(function(){
  if(typeof getUserId==='function'&&getUserId()&&typeof fbDb!=='undefined'){
    clearInterval(_engagementBootCheck);
    setTimeout(_postMorningPrompt,5000);
    setTimeout(icConversationStarter,8000);
    setTimeout(icCheckWorkflowAlerts,15000);
  }
},3000);

// ══════════════════════════════════════════════════════════════════
// WINDOW EXPORTS — Communication & Engagement Features
// ══════════════════════════════════════════════════════════════════
window.icSendKudos=icSendKudos;

// ── CONTACT ACTION BUTTONS ──
var _callRingtoneInterval=null;

function _playRingtone(){
  if(typeof playSound==='function')playSound('notify');
}
function _stopRingtone(){
  if(_callRingtoneInterval){clearInterval(_callRingtoneInterval);_callRingtoneInterval=null}
}

function icVideoCall(userName){
  _stopRingtone();
  // Play ringtone sound
  _playRingtone();
  _callRingtoneInterval=setInterval(_playRingtone,3000);
  // Show calling UI
  var h='<div style="text-align:center;padding:20px">';
  h+='<div style="width:72px;height:72px;border-radius:50%;background:'+_avatarGrad(userName)+';display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;margin:0 auto 16px">'+icInitials(userName)+'</div>';
  h+='<div style="font-size:18px;font-weight:700;color:var(--tx);margin-bottom:4px">'+esc(userName)+'</div>';
  h+='<div style="font-size:12px;color:var(--tx3);margin-bottom:20px">📹 Video Calling...</div>';
  h+='<div style="display:flex;justify-content:center;gap:16px">';
  h+='<button onclick="_stopRingtone();window.open(\'https://meet.google.com/new\',\'_blank\',\'noopener\');closeModal()" style="background:#2ee89e;border:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:700;color:#000;cursor:pointer;box-shadow:0 4px 16px rgba(46,232,158,.3)">📹 Join Call</button>';
  h+='<button onclick="_stopRingtone();closeModal()" style="background:#ef4444;border:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(239,68,68,.3)">✕ Cancel</button>';
  h+='</div></div>';
  if(typeof openModal==='function')openModal(h);
  // Send call notification to recipient
  if(fbDb){
    var allUsers=window._allTeamUsers||[];
    var target=allUsers.find(function(u){return(u.displayName||u.name||'')===userName});
    if(target&&target.uid){
      fbDb.collection('notifications').add({
        type:'call',title:'📹 Video Call from '+getUserName(),body:getUserName()+' is calling you',
        icon:'📹',from:getUserName(),userId:target.uid,sourceView:'supportboard',
        read:false,dismissed:false,priority:'critical',
        timestamp:firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
    }
  }
}

function icAudioCall(userName){
  _stopRingtone();
  _playRingtone();
  _callRingtoneInterval=setInterval(_playRingtone,3000);
  var h='<div style="text-align:center;padding:20px">';
  h+='<div style="width:72px;height:72px;border-radius:50%;background:'+_avatarGrad(userName)+';display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;margin:0 auto 16px">'+icInitials(userName)+'</div>';
  h+='<div style="font-size:18px;font-weight:700;color:var(--tx);margin-bottom:4px">'+esc(userName)+'</div>';
  h+='<div style="font-size:12px;color:var(--tx3);margin-bottom:20px">📞 Audio Calling...</div>';
  h+='<div style="display:flex;justify-content:center;gap:16px">';
  h+='<button onclick="_stopRingtone();window.open(\'https://meet.google.com/new\',\'_blank\',\'noopener\');closeModal()" style="background:#2ee89e;border:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:700;color:#000;cursor:pointer;box-shadow:0 4px 16px rgba(46,232,158,.3)">📞 Join Call</button>';
  h+='<button onclick="_stopRingtone();closeModal()" style="background:#ef4444;border:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(239,68,68,.3)">✕ Cancel</button>';
  h+='</div></div>';
  if(typeof openModal==='function')openModal(h);
  if(fbDb){
    var allUsers=window._allTeamUsers||[];
    var target=allUsers.find(function(u){return(u.displayName||u.name||'')===userName});
    if(target&&target.uid){
      fbDb.collection('notifications').add({
        type:'call',title:'📞 Audio Call from '+getUserName(),body:getUserName()+' is calling you',
        icon:'📞',from:getUserName(),userId:target.uid,sourceView:'supportboard',
        read:false,dismissed:false,priority:'critical',
        timestamp:firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
    }
  }
}

function icSendEmail(email){
  window.open('mailto:'+email,'_blank');
}
window.icVideoCall=icVideoCall;
window.icAudioCall=icAudioCall;
window.icSendEmail=icSendEmail;

// ══════════════════════════════════════════════════════════════════
// RIGHT-CLICK CONTEXT MENU — delete chats, channels, spaces
// ══════════════════════════════════════════════════════════════════

function icInitContextMenu(){
  // Attach to sidebar and spaces panel
  var sidebar=document.getElementById('icSidebarList');
  var spaces=document.getElementById('icSpacesList');
  if(sidebar){sidebar.addEventListener('contextmenu',_icHandleRightClick);sidebar.addEventListener('click',_icSelectModeClickHandler,true)}
  if(spaces)spaces.addEventListener('contextmenu',_icHandleRightClick);
}

function _icHandleRightClick(e){
  e.preventDefault();
  _icCloseContextMenu();
  // Find the closest item with data-ic-channel
  var target=e.target.closest('[data-ic-channel]');
  var spaceTarget=e.target.closest('[onclick*="icOpenChat"]');
  var channelId=null;
  var channelName='';

  if(target){
    channelId=target.getAttribute('data-ic-channel');
    // Get name from the text content
    var nameEl=target.querySelector('span[style*="font-weight"]');
    channelName=nameEl?nameEl.textContent:'';
  }else if(spaceTarget){
    var onclick=spaceTarget.getAttribute('onclick')||'';
    var match=onclick.match(/icOpenChat\('([^']+)'/);
    if(match)channelId=match[1];
    channelName=spaceTarget.textContent.trim();
  }
  if(!channelId)return;

  // Check if user is admin
  var isAdmin=false;
  try{var p=getMFXProfile();var r=(p.role||'').toLowerCase();isAdmin=['ceo','admin','administrator','owner','operations manager','manager'].indexOf(r)>=0}catch(ex){}
  var isOwner=false;

  // Build context menu
  var menu=document.createElement('div');
  menu.id='icCtxMenu';
  menu.style.cssText='position:fixed;z-index:300;background:rgba(13,17,23,.95);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:4px 0;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,.5);backdrop-filter:blur(12px)';
  menu.style.left=Math.min(e.clientX,window.innerWidth-180)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-200)+'px';

  var items=[];
  items.push({icon:'💬',label:'Open',action:function(){
    var el=document.querySelector('[data-ic-channel="'+channelId+'"]');
    if(el)el.click();
  }});
  items.push({icon:'☑️',label:'Select (multi-delete)',action:function(){
    icToggleSelect(channelId);
  }});
  items.push({icon:'📌',label:'Pin to top',action:function(){
    if(typeof toast==='function')toast('Pinned '+channelName,'ok');
  }});
  items.push({icon:'🔕',label:'Mute',action:function(){
    IC.activeChat=channelId;
    if(typeof icMuteChannel==='function')icMuteChannel();
  }});
  items.push({sep:true});
  items.push({icon:'🗑',label:'Delete chat',danger:true,action:function(){
    icDeleteChannel(channelId,channelName,isAdmin);
  }});

  var h='';
  items.forEach(function(item){
    if(item.sep){
      h+='<div style="height:1px;background:rgba(255,255,255,.06);margin:4px 0"></div>';
      return;
    }
    h+='<div onclick="event.stopPropagation()" data-ctx-action="'+esc(item.label)+'" style="padding:8px 14px;font-size:12px;color:'+(item.danger?'#ef4444':'rgba(255,255,255,.8)')+';cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .1s" onmouseover="this.style.background=\'rgba('+(item.danger?'239,68,68':'255,255,255')+',.08)\'" onmouseout="this.style.background=\'none\'">'+item.icon+' '+item.label+'</div>';
  });
  menu.innerHTML=h;

  // Attach click handlers
  document.body.appendChild(menu);
  var menuItems=menu.querySelectorAll('[data-ctx-action]');
  for(var i=0;i<menuItems.length;i++){
    (function(idx){
      menuItems[idx].addEventListener('click',function(){
        _icCloseContextMenu();
        items.filter(function(it){return!it.sep})[idx].action();
      });
    })(i);
  }

  // Close on outside click
  setTimeout(function(){
    document.addEventListener('click',_icCloseContextMenu);
    document.addEventListener('contextmenu',_icCloseContextMenu);
  },50);
}

function _icCloseContextMenu(){
  var menu=document.getElementById('icCtxMenu');
  if(menu)menu.remove();
  document.removeEventListener('click',_icCloseContextMenu);
  document.removeEventListener('contextmenu',_icCloseContextMenu);
}

function icDeleteChannel(channelId,channelName,isAdmin){
  var label=channelName||channelId;
  if(!confirm('Delete "'+label+'"?'))return;
  _icInstantRemove(channelId);
  // Background Firestore cleanup
  _icBackgroundDelete(channelId);
  if(typeof toast==='function')toast('"'+label+'" deleted','ok');
}

function _icInstantRemove(channelId){
  // Immediately remove from DOM
  var el=document.querySelector('[data-ic-channel="'+channelId+'"]');
  if(el){el.style.transition='opacity .2s,height .2s';el.style.opacity='0';el.style.height='0';el.style.overflow='hidden';el.style.padding='0';setTimeout(function(){el.remove()},250)}
  // Clear conversation if viewing this chat
  if(IC.activeChat===channelId){
    IC.activeChat=null;
    var body=document.getElementById('icBody');
    if(body)body.innerHTML='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,.2);padding:40px"><div style="font-size:48px;opacity:.3">💬</div><div style="font-size:14px;font-weight:600">Select a conversation</div></div>';
    var convoHeader=document.getElementById('icConvoHeader');if(convoHeader)convoHeader.style.display='none';
    var inputBar=document.getElementById('icInputBar');if(inputBar)inputBar.style.display='none';
  }
}

function _icBackgroundDelete(channelId){
  if(!fbDb)return;
  // Delete messages in batches of 500 (Firestore limit)
  function deleteBatch(){
    fbDb.collection('chat_messages').where('channelId','==',channelId).limit(500).get().then(function(snap){
      if(!snap.docs.length){
        // All messages deleted, now delete the channel
        fbDb.collection('chat_channels').doc(channelId).delete().catch(function(){});
        return;
      }
      var batch=fbDb.batch();
      snap.docs.forEach(function(d){batch.delete(d.ref)});
      batch.commit().then(deleteBatch).catch(function(e){console.warn('batchDelete:',e)});
    }).catch(function(e){console.warn('deleteQuery:',e)});
  }
  deleteBatch();
}

// ── MULTI-SELECT MODE ──
var _icSelectedChannels=[];
var _icSelectMode=false;

function icToggleSelect(channelId){
  if(!_icSelectMode){
    _icSelectMode=true;
    _icSelectedChannels=[channelId];
    _icShowSelectBar();
  }else{
    var idx=_icSelectedChannels.indexOf(channelId);
    if(idx>=0){_icSelectedChannels.splice(idx,1)}
    else{_icSelectedChannels.push(channelId)}
    if(!_icSelectedChannels.length){icCancelSelect();return}
  }
  _icUpdateSelectUI();
}

function _icShowSelectBar(){
  var existing=document.getElementById('icSelectBar');
  if(existing)return;
  var sidebar=document.getElementById('icSidebar');
  if(!sidebar)return;
  var bar=document.createElement('div');
  bar.id='icSelectBar';
  bar.style.cssText='padding:8px 10px;background:rgba(239,68,68,.1);border-bottom:1px solid rgba(239,68,68,.2);display:flex;align-items:center;gap:8px;flex-shrink:0';
  bar.innerHTML='<span id="icSelectCount" style="font-size:11px;font-weight:700;color:#ef4444;flex:1">1 selected</span>'
    +'<button onclick="icDeleteSelected()" style="background:#ef4444;border:none;padding:4px 12px;border-radius:8px;font-size:10px;font-weight:700;color:#fff;cursor:pointer">🗑 Delete</button>'
    +'<button onclick="icCancelSelect()" style="background:rgba(255,255,255,.06);border:none;padding:4px 10px;border-radius:8px;font-size:10px;color:rgba(255,255,255,.5);cursor:pointer">Cancel</button>';
  sidebar.insertBefore(bar,sidebar.children[1]||null);
}

function _icUpdateSelectUI(){
  // Update count
  var countEl=document.getElementById('icSelectCount');
  if(countEl)countEl.textContent=_icSelectedChannels.length+' selected';
  // Highlight selected items
  var items=document.querySelectorAll('[data-ic-channel]');
  for(var i=0;i<items.length;i++){
    var chId=items[i].getAttribute('data-ic-channel');
    var selected=_icSelectedChannels.indexOf(chId)>=0;
    items[i].style.outline=selected?'2px solid #ef4444':'none';
    items[i].style.outlineOffset=selected?'-2px':'0';
  }
}

function icCancelSelect(){
  _icSelectMode=false;
  _icSelectedChannels=[];
  var bar=document.getElementById('icSelectBar');if(bar)bar.remove();
  // Clear highlights
  var items=document.querySelectorAll('[data-ic-channel]');
  for(var i=0;i<items.length;i++){items[i].style.outline='none'}
}

function icDeleteSelected(){
  if(!_icSelectedChannels.length)return;
  var count=_icSelectedChannels.length;
  if(!confirm('Delete '+count+' chat'+(count>1?'s':'')+'? This cannot be undone.'))return;
  // Instant remove all from DOM
  _icSelectedChannels.forEach(function(chId){
    _icInstantRemove(chId);
    _icBackgroundDelete(chId);
  });
  if(typeof toast==='function')toast(count+' chat'+(count>1?'s':'')+' deleted','ok');
  icCancelSelect();
}

// Allow clicking items to toggle selection when in select mode
function _icSelectModeClickHandler(e){
  if(!_icSelectMode)return;
  var target=e.target.closest('[data-ic-channel]');
  if(!target)return;
  e.preventDefault();
  e.stopPropagation();
  icToggleSelect(target.getAttribute('data-ic-channel'));
}

window.icDeleteChannel=icDeleteChannel;
window.icToggleSelect=icToggleSelect;
window.icCancelSelect=icCancelSelect;
window.icDeleteSelected=icDeleteSelected;
window.icCreatePoll=icCreatePoll;
window.icRenderPoll=icRenderPoll;
window.icVotePoll=icVotePoll;
window.icClosePoll=icClosePoll;
window.icScheduleStandup=icScheduleStandup;
window.icSetNotifPriority=icSetNotifPriority;
window.icSetQuietHours=icSetQuietHours;
window.icCheckWorkflowAlerts=icCheckWorkflowAlerts;
window.icPostDailyDigest=icPostDailyDigest;
window.icAnonymousFeedback=icAnonymousFeedback;
window.icConversationStarter=icConversationStarter;
window.icTeamMoodSummary=icTeamMoodSummary;
window.icCycleNotifPriority=icCycleNotifPriority;

console.log('✅ MFX Flex Chat v2 initialized (Instant Chat enabled)');
console.log('✅ MFX Communication & Engagement features loaded (10 modules)');
})();
