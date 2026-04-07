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
    text=text.replace(/\[\[(\w+):([^\]:]+):([^\]]+)\]\]/g,function(_,v,id,label){return'<span onclick="goView(\''+v+'\');if(\''+id+'\'!==\'-\')openTaskDetail(\''+id+'\')" style="cursor:pointer;color:#00e5ff;background:rgba(0,229,255,.1);padding:1px 6px;border-radius:4px;font-weight:600;font-size:11px">🏷 '+esc(label)+'</span>'});
    // @mentions
    text=text.replace(/@(\w+)/g,'<span style="color:#00e5ff;font-weight:600">@$1</span>');
    // URLs → clickable links
    text=text.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" style="color:var(--ac);text-decoration:underline">$1</a>');
    if(text)h+='<div style="font-size:12px;color:var(--tx);line-height:1.5;word-break:break-word">'+text+'</div>';
    // GIF field (from GIF picker)
    if(m.gif){h+='<div style="margin-top:4px"><img src="'+esc(m.gif)+'" style="max-width:250px;max-height:180px;border-radius:8px;display:block" alt="GIF"></div>'}
    // Inline images / GIFs
    if(m.attachments&&m.attachments.length){m.attachments.forEach(function(a){
      if(a.type==='image'||a.type==='gif'){
        h+='<div style="margin-top:4px"><img src="'+a.url+'" style="max-width:280px;max-height:200px;border-radius:8px;border:1px solid var(--bdr);cursor:pointer" onclick="window.open(\''+a.url+'\',\'_blank\')" alt="'+esc(a.name||'image')+'"></div>';
      } else if(a.type==='os-link'){
        h+='<div onclick="goView(\''+a.view+'\');if(\''+a.recordId+'\'!==\'-\')openTaskDetail(\''+a.recordId+'\')" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:8px;font-size:11px;color:#00e5ff;margin-top:4px;cursor:pointer;font-weight:600">🏷 '+esc(a.name||'MFX Record')+'</div>';
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
var GIPHY_KEY=localStorage.getItem('mfx_giphy_key')||'RtPk8UKMXp3VRu8OQjWhyM0IP1jHn3rK';

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

function gifSelect(url,target){
  closeModal();
  if(target==='ic'){
    // Insert GIF into instant chat
    if(!fbDb||!IC.activeChat)return;
    fbDb.collection('chat_messages').add({
      channelId:IC.activeChat,
      text:'',
      gif:url,
      user:getUserName(),
      userId:getUserId(),
      dept:window.CURRENT_USER&&window.CURRENT_USER._dept||'',
      timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      readBy:[getUserId()]
    });
    fbDb.collection('chat_channels').doc(IC.activeChat).update({
      lastMessage:'sent a GIF',
      lastMessageAt:firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(){});
  }else{
    // Main chat — add as attachment
    window._chatPendingAttachments.push({type:'gif',url:url,name:'GIF'});
    chatShowAttachPreview();
  }
}

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
  messages:[],
  unreadCount:0,
  unreadListener:null,
  onlineUsers:[],
  allUsers:[]
};

function toggleInstantChat(){
  var popup=document.getElementById('instantChatPopup');
  if(!popup)return;
  IC.open=!IC.open;
  popup.style.display=IC.open?'flex':'none';
  if(IC.open){
    icShowList();
    icStartUnreadListener();
    icLoadOnlineUsers();
  }else{
    if(IC.listener){IC.listener();IC.listener=null;}
  }
}

function icShowList(){
  IC.view='list';
  IC.activeChat=null;
  if(IC.listener){IC.listener();IC.listener=null;}
  var title=document.getElementById('icTitle');
  if(title)title.textContent='Instant Chat';
  var inputBar=document.getElementById('icInputBar');
  if(inputBar)inputBar.style.display='none';
  var body=document.getElementById('icBody');
  if(!body||!fbDb)return;
  body.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:11px">Loading chats...</div>';

  // Load channels + DMs (no orderBy — lastMessageAt can be null on seeded channels)
  fbDb.collection('chat_channels').get().then(function(snap){
    var channels=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    // Sort client-side: most recent activity first, nulls last
    channels.sort(function(a,b){
      var at=a.lastMessageAt?a.lastMessageAt.seconds:0;
      var bt=b.lastMessageAt?b.lastMessageAt.seconds:0;
      return bt-at;
    });
    var me=getUserName();var uid=getUserId();
    // Split into DMs and group channels
    var dms=channels.filter(function(c){return c.type==='dm'&&(c.members||[]).indexOf(me)>=0});
    var groups=channels.filter(function(c){return c.type==='channel'});

    var h='';
    // Online users section
    h+='<div style="padding:8px 12px 4px;font-size:9px;font-weight:700;color:var(--gn);text-transform:uppercase;letter-spacing:.5px">Online Now</div>';
    h+='<div id="icOnlineSection" style="padding:0 8px 8px;display:flex;gap:6px;flex-wrap:wrap;min-height:28px">';
    h+=icRenderOnlineUsers();
    h+='</div>';

    // DMs
    h+='<div style="padding:8px 12px 2px;font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center">Direct Messages<span onclick="icNewDM()" style="cursor:pointer;color:#00e5ff;font-size:14px;padding:0 4px">+</span></div>';
    if(dms.length){
      dms.forEach(function(c){
        var other=c.name.replace(me,'').replace('·','').trim()||c.name;
        var lastMsg=c.lastMessage||'';
        var time=c.lastMessageAt?icTimeAgo(c.lastMessageAt):'';
        h+='<div onclick="icOpenChat(\''+c.id+'\',\''+esc(other)+'\')" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'">';
        h+='<div style="width:32px;height:32px;border-radius:50%;border:2px solid #00e5ff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#00e5ff;flex-shrink:0">'+icInitials(other)+'</div>';
        h+='<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(other)+'</span><span style="font-size:8px;color:var(--tx3)">'+time+'</span></div>';
        h+='<div style="font-size:10px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">'+esc(lastMsg.substring(0,50))+'</div></div></div>';
      });
    }else{
      h+='<div style="padding:8px 12px;font-size:10px;color:var(--tx3)">No conversations yet</div>';
    }

    // Group channels
    h+='<div style="padding:8px 12px 2px;font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--bdr);margin-top:4px">Group Channels</div>';
    groups.slice(0,15).forEach(function(c){
      var lastMsg=c.lastMessage||'';
      var time=c.lastMessageAt?icTimeAgo(c.lastMessageAt):'';
      h+='<div onclick="icOpenChat(\''+c.id+'\',\'#'+esc(c.name)+'\')" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .15s" onmouseover="this.style.background=\'rgba(0,229,255,.06)\'" onmouseout="this.style.background=\'none\'">';
      h+='<div style="width:32px;height:32px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--cy);flex-shrink:0">#</div>';
      h+='<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12px;font-weight:600;color:var(--tx)">#'+esc(c.name)+'</span><span style="font-size:8px;color:var(--tx3)">'+time+'</span></div>';
      h+='<div style="font-size:10px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">'+esc(lastMsg.substring(0,50))+'</div></div></div>';
    });

    body.innerHTML=h;
  }).catch(function(e){
    body.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11px">Could not load chats</div>';
    console.warn('IC load:',e.message);
  });
}

function icOpenChat(channelId,displayName){
  IC.view='conversation';
  IC.activeChat=channelId;
  var title=document.getElementById('icTitle');
  if(title)title.innerHTML='<span onclick="icShowList()" style="cursor:pointer;margin-right:6px;color:var(--tx3)">←</span>'+displayName;
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
      IC.messages=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
      icRenderMessages();
      // Mark as read
      var uid=getUserId();
      snap.docs.forEach(function(d){
        var data=d.data();
        if(data.userId!==uid&&(!data.readBy||data.readBy.indexOf(uid)<0)){
          fbDb.collection('chat_messages').doc(d.id).update({readBy:firebase.firestore.FieldValue.arrayUnion(uid)}).catch(function(){});
        }
      });
    },function(err){console.warn('IC messages:',err.message)});

  // Focus input
  setTimeout(function(){var inp=document.getElementById('icInput');if(inp)inp.focus()},300);
}

function icRenderMessages(){
  var body=document.getElementById('icBody');if(!body)return;
  if(!IC.messages.length){body.innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:11px">No messages yet — say hi!</div>';return}
  var me=getUserName();var h='';var lastDate='';
  IC.messages.forEach(function(m){
    var ts=m.timestamp?new Date(m.timestamp.seconds*1000):new Date();
    var dateStr=ts.toLocaleDateString();
    if(dateStr!==lastDate){
      h+='<div style="text-align:center;padding:6px 0;font-size:8px;color:var(--tx3)">'+ts.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</div>';
      lastDate=dateStr;
    }
    var isMe=m.user===me;
    var timeStr=ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    h+='<div style="display:flex;flex-direction:column;align-items:'+(isMe?'flex-end':'flex-start')+';padding:2px 12px">';
    if(!isMe)h+='<span style="font-size:8px;font-weight:600;color:var(--cy);margin-bottom:1px">'+esc(m.user)+'</span>';
    if(m.gif){
      h+='<div style="max-width:80%;border-radius:'+(isMe?'12px 12px 2px 12px':'12px 12px 12px 2px')+';overflow:hidden"><img src="'+esc(m.gif)+'" style="max-width:200px;max-height:150px;border-radius:inherit;display:block"></div>';
    }
    if(m.text){
      h+='<div style="max-width:80%;padding:8px 12px;border-radius:'+(isMe?'12px 12px 2px 12px':'12px 12px 12px 2px')+';background:'+(isMe?'rgba(0,229,255,.15)':'var(--bg3)')+';font-size:12px;color:var(--tx);line-height:1.4;word-wrap:break-word">'+esc(m.text)+'</div>';
    }
    h+='<span style="font-size:7px;color:var(--tx3);margin-top:1px">'+timeStr+'</span>';
    h+='</div>';
  });
  body.innerHTML=h;
  body.scrollTop=body.scrollHeight;
}

function icSendMsg(){
  var input=document.getElementById('icInput');
  if(!input||!input.value.trim()||!fbDb||!IC.activeChat)return;
  var text=input.value.trim();
  fbDb.collection('chat_messages').add({
    channelId:IC.activeChat,
    text:text,
    user:getUserName(),
    userId:getUserId(),
    dept:window.CURRENT_USER&&window.CURRENT_USER._dept||'',
    timestamp:firebase.firestore.FieldValue.serverTimestamp(),
    readBy:[getUserId()]
  });
  // Update channel lastMessage
  fbDb.collection('chat_channels').doc(IC.activeChat).update({
    lastMessage:text.substring(0,100),
    lastMessageAt:firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(){});
  input.value='';input.style.height='auto';
  input.focus();
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

// Auto-start unread listener after auth
var _icAuthCheck=setInterval(function(){
  if(typeof getUserId==='function'&&getUserId()&&typeof fbDb!=='undefined'){
    clearInterval(_icAuthCheck);
    setTimeout(icStartUnreadListener,3000);
    setTimeout(icLoadOnlineUsers,3500);
  }
},2000);

console.log('✅ MFX Flex Chat v2 initialized (Instant Chat enabled)');
})();
