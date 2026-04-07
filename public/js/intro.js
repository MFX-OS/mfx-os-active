// ═══════════════════════════════════════════════════════
// MFX OS — UNIFIED BOOT + LOGIN v6.0
// One screen: fades from black → logo → clock → login form
// Sound fades in with screen. No separate login page.
// ═══════════════════════════════════════════════════════
(function(){
'use strict';

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

var intro  = document.getElementById('introScreen');
var appEl  = document.getElementById('app');
var loginEl = document.getElementById('loginScreen');

if (!intro) return;

// Already signed in — skip entirely
if (appEl && appEl.style.display === 'block') {
  intro.style.display = 'none';
  return;
}

// Hide the old separate login screen — we own it now
if (loginEl) loginEl.style.display = 'none';

// ── KEYFRAMES ──
if (!document.getElementById('mfx-kf')) {
  var kf = document.createElement('style');
  kf.id = 'mfx-kf';
  kf.textContent = [
    '@keyframes mfx-scan{0%{top:-2px}100%{top:102%}}',
    '@keyframes mfx-glow{0%,100%{text-shadow:0 0 20px rgba(0,229,255,.4),0 0 50px rgba(0,229,255,.12)}50%{text-shadow:0 0 35px rgba(0,229,255,.7),0 0 80px rgba(0,229,255,.28)}}',
    '@keyframes mfx-flicker{0%,88%,90%,95%,100%{opacity:1}89%{opacity:.72}96%{opacity:.86}}',
    '@keyframes mfx-blink{0%,49%,100%{opacity:1}50%,99%{opacity:0}}',
    '@keyframes mfx-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.08);opacity:1}}',
    '@keyframes mfx-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes mfx-fade{from{opacity:0}to{opacity:1}}'
  ].join('');
  document.head.appendChild(kf);
}

// ── SHELL — starts fully black ──
intro.style.cssText = 'position:fixed;inset:0;z-index:9500;background:#000;overflow:hidden;font-family:Inter,-apple-system,sans-serif;opacity:0;transition:opacity 1.2s ease';

// Fade screen in from black
requestAnimationFrame(function(){ requestAnimationFrame(function(){
  intro.style.opacity = '1';
}); });

// ── CANVAS (grid + particles) ──
var cv = document.createElement('canvas');
cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
intro.appendChild(cv);
var ctx = cv.getContext('2d');
var W, H;
function rsz(){ W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
rsz(); window.addEventListener('resize', rsz);

// ── SCANLINE ──
var sl = document.createElement('div');
sl.style.cssText = 'position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,229,255,.45),transparent);animation:mfx-scan 2.8s linear infinite;z-index:4;pointer-events:none';
intro.appendChild(sl);

// ── CORNER BRACKETS ──
['top:18px;left:18px;border-top:1px solid;border-left:1px solid',
 'top:18px;right:18px;border-top:1px solid;border-right:1px solid',
 'bottom:18px;left:18px;border-bottom:1px solid;border-left:1px solid',
 'bottom:18px;right:18px;border-bottom:1px solid;border-right:1px solid'
].forEach(function(s){
  var d = document.createElement('div');
  d.style.cssText = 'position:absolute;width:24px;height:24px;border-color:rgba(0,229,255,.22);' + s;
  intro.appendChild(d);
});

// ── TOP META BAR ──
var metaBar = document.createElement('div');
metaBar.style.cssText = 'position:absolute;top:18px;left:0;right:0;display:flex;justify-content:space-between;padding:0 54px;z-index:5;opacity:0;transition:opacity .6s ease';
metaBar.innerHTML =
  '<div id="iStatus" style="font-size:7px;font-weight:500;color:rgba(0,229,255,.3);letter-spacing:2.5px;text-transform:uppercase">SYSTEM INITIALIZING</div>' +
  '<div style="font-size:7px;color:rgba(0,229,255,.18);letter-spacing:2px;text-transform:uppercase">MFX OS · v2.1</div>';
intro.appendChild(metaBar);

// ── MAIN CENTER COLUMN ──
var col = document.createElement('div');
col.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:3;padding:0 24px';
intro.appendChild(col);

// ── WORDMARK ──
var wmWrap = document.createElement('div');
wmWrap.style.cssText = 'text-align:center;opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s cubic-bezier(.22,1,.36,1)';
wmWrap.innerHTML =
  '<div id="iTitle" style="font-family:Outfit,Inter,sans-serif;font-size:clamp(56px,10vw,92px);font-weight:900;color:#e0f2fe;letter-spacing:-2px;line-height:1;animation:mfx-glow 3s ease-in-out 1s infinite,mfx-flicker 6s ease-in-out 2s infinite"></div>' +
  '<div id="iBar" style="overflow:hidden;height:3px;margin:12px auto 13px;width:0;transition:width .7s cubic-bezier(.4,0,.2,1)"><div style="height:100%;background:linear-gradient(90deg,transparent,#00e5ff 30%,#00e5ff 70%,transparent);width:100%"></div></div>' +
  '<div id="iSub" style="font-family:Outfit,Inter,sans-serif;font-size:clamp(9px,1.4vw,13px);font-weight:300;color:#00838f;letter-spacing:7px;text-transform:uppercase;opacity:0;transition:opacity .5s ease"></div>';
col.appendChild(wmWrap);

// ── CLOCK BLOCK ──
var clockWrap = document.createElement('div');
clockWrap.style.cssText = 'margin-top:28px;text-align:center;opacity:0;transition:opacity .6s ease';
clockWrap.innerHTML =
  '<div id="iClock" style="font-family:Outfit,Inter,sans-serif;font-size:clamp(40px,6vw,62px);font-weight:200;color:#e0f2fe;letter-spacing:3px;line-height:1"></div>' +
  '<div id="iDate" style="font-size:10px;font-weight:400;color:#1e6a7a;letter-spacing:3px;text-transform:uppercase;margin-top:7px"></div>' +
  '<div id="iGreet" style="font-size:9px;font-weight:300;color:rgba(0,229,255,.3);letter-spacing:2px;margin-top:7px"></div>';
col.appendChild(clockWrap);

// ── DIVIDER BETWEEN CLOCK AND FORM ──
var midLine = document.createElement('div');
midLine.style.cssText = 'width:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,229,255,.3),transparent);margin:28px 0;transition:width .7s cubic-bezier(.4,0,.2,1)';
col.appendChild(midLine);

// ── LOGIN FORM (inline, below logo) ──
var formWrap = document.createElement('div');
formWrap.style.cssText = 'width:100%;max-width:300px;opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s cubic-bezier(.22,1,.36,1)';
formWrap.innerHTML =
  '<div style="text-align:center;font-size:9px;font-weight:600;color:rgba(0,229,255,.4);letter-spacing:3px;text-transform:uppercase;margin-bottom:18px">Sign In to Continue</div>' +
  '<button id="iGoogleBtn" onclick="signInWithGoogle()" style="width:100%;background:linear-gradient(135deg,#00e5ff,#0891b2);color:#000;padding:13px;border-radius:10px;font-size:13px;font-weight:700;border:none;cursor:pointer;letter-spacing:.3px;margin-bottom:14px;box-shadow:0 0 20px rgba(0,229,255,.18);transition:box-shadow .2s" onmouseover="this.style.boxShadow=\'0 0 40px rgba(0,229,255,.4)\'" onmouseout="this.style.boxShadow=\'0 0 20px rgba(0,229,255,.18)\'">Sign in with Google</button>' +
  '<div style="text-align:center;color:rgba(100,116,139,.4);font-size:9px;letter-spacing:2px;margin-bottom:12px">— or —</div>' +
  '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<input id="loginEmail" placeholder="Email" autocomplete="email" style="padding:11px 14px;border-radius:8px;background:rgba(10,21,32,.9);border:1px solid #1e3a4f;color:#e0f2fe;font-size:12px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s" onfocus="this.style.borderColor=\'#00e5ff\'" onblur="this.style.borderColor=\'#1e3a4f\'">' +
    '<input id="loginPass" type="password" placeholder="Password" autocomplete="current-password" style="padding:11px 14px;border-radius:8px;background:rgba(10,21,32,.9);border:1px solid #1e3a4f;color:#e0f2fe;font-size:12px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s" onfocus="this.style.borderColor=\'#00e5ff\'" onblur="this.style.borderColor=\'#1e3a4f\'">' +
    '<button onclick="signInWithEmail()" id="iEmailBtn" style="background:rgba(10,21,32,.9);color:#00e5ff;padding:11px;border-radius:8px;border:1px solid #1e3a4f;font-size:12px;font-weight:600;cursor:pointer;width:100%;transition:border-color .2s" onmouseover="this.style.borderColor=\'#00e5ff\'" onmouseout="this.style.borderColor=\'#1e3a4f\'">Sign In</button>' +
  '</div>';
col.appendChild(formWrap);

// ── PRODUCT STRIP (bottom) ──
var strip = document.createElement('div');
strip.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:9px 0;background:rgba(6,13,20,.85);border-top:1px solid rgba(0,229,255,.07);text-align:center;opacity:0;transition:opacity .6s ease;z-index:5';
strip.innerHTML = '<div style="font-size:7px;font-weight:500;color:rgba(0,131,143,.6);letter-spacing:2.5px;text-transform:uppercase">FLEXIBLE PACKAGING · LABELS · POUCHES · SHRINK SLEEVES · SACHETS · STICK PACKS</div>';
intro.appendChild(strip);

// ── BOOT PROGRESS ──
var bootWrap = document.createElement('div');
bootWrap.style.cssText = 'position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:140px;opacity:0;transition:opacity .4s ease;z-index:5';
bootWrap.innerHTML =
  '<div style="height:1px;background:rgba(0,229,255,.08);border-radius:1px;overflow:hidden"><div id="iBoot" style="height:100%;width:0;background:linear-gradient(90deg,rgba(0,229,255,.3),#00e5ff);transition:width .4s ease"></div></div>' +
  '<div id="iBootLbl" style="font-size:7px;color:rgba(0,229,255,.25);letter-spacing:2px;text-align:center;margin-top:5px;text-transform:uppercase">Booting</div>';
intro.appendChild(bootWrap);

// ── TYPEWRITER ──
function type(el, text, spd, cb){
  el.textContent = '';
  var i = 0;
  var t = setInterval(function(){
    el.textContent += text[i++];
    if(i >= text.length){ clearInterval(t); if(cb) cb(); }
  }, spd || 45);
}

// ── LIVE CLOCK ──
var clockIv;
function startClock(){
  function tick(){
    var n = new Date(), h = n.getHours(), m = n.getMinutes();
    var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    var p = function(x){ return x < 10 ? '0'+x : ''+x; };
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var cl = document.getElementById('iClock');
    var dt = document.getElementById('iDate');
    var gr = document.getElementById('iGreet');
    if(cl) cl.innerHTML =
      '<span>' + p(h12) + '</span>' +
      '<span style="color:rgba(0,229,255,.45);animation:mfx-blink 1s step-end infinite">:</span>' +
      '<span>' + p(m) + '</span>' +
      '<span style="font-size:.42em;color:rgba(0,229,255,.45);margin-left:8px;letter-spacing:1px">' + ap + '</span>';
    if(dt) dt.textContent = DAYS[n.getDay()] + '  ·  ' + MONTHS[n.getMonth()] + ' ' + n.getDate() + ', ' + n.getFullYear();
    if(gr && !gr.textContent){
      gr.textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', Microflex';
    }
  }
  tick();
  clockIv = setInterval(tick, 1000);
}

// ── GRID DRAW ──
var ga = 0, raf;
function drawGrid(){
  ctx.clearRect(0,0,W,H);
  ga = Math.min(1, ga + 0.01);
  ctx.strokeStyle = 'rgba(0,229,255,' + ga * 0.065 + ')';
  ctx.lineWidth = 0.5;
  var sp = 48;
  for(var x=0;x<W;x+=sp){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(var y=0;y<H;y+=sp){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
  var gr = ctx.createRadialGradient(W/2,H*.45,0,W/2,H*.45,Math.max(W,H)*.6);
  gr.addColorStop(0,'rgba(0,229,255,' + ga*.035 + ')');
  gr.addColorStop(.45,'rgba(0,10,30,0)');
  gr.addColorStop(1,'rgba(0,0,0,' + ga*.9 + ')');
  ctx.fillStyle = gr; ctx.fillRect(0,0,W,H);
  raf = requestAnimationFrame(drawGrid);
}
drawGrid();

// ── BOOT STEPS ──
var STEPS = ['Authenticating','Loading quote engine','Syncing Firebase','Connecting APIs','Ready'];
var si = 0;
function nextStep(){
  var b = document.getElementById('iBoot'), l = document.getElementById('iBootLbl');
  if(si >= STEPS.length) return;
  if(b) b.style.width = Math.round((si+1)/STEPS.length*100)+'%';
  if(l) l.textContent = STEPS[si];
  si++;
}

// ── SOUND — fade in with screen ──
// Delay until first user gesture or 400ms whichever is first
var soundFired = false;
function fireSound(){
  if(soundFired) return; soundFired = true;
  if(typeof window.playBootMusic === 'function') window.playBootMusic();
}
document.addEventListener('click', fireSound, {once:true});
document.addEventListener('touchstart', fireSound, {once:true});
setTimeout(fireSound, 400);

// ── TIMELINE ──
var T0 = Date.now(), gone = false;

// 200ms — meta bar + boot bar
setTimeout(function(){
  metaBar.style.opacity = '1';
  bootWrap.style.opacity = '1';
  nextStep();
}, 200);

// 500ms — wordmark rises
setTimeout(function(){
  wmWrap.style.opacity = '1';
  wmWrap.style.transform = 'translateY(0)';
  var el = document.getElementById('iTitle');
  if(el) type(el, 'Microflex', 52, function(){
    var bar = document.getElementById('iBar');
    if(bar) bar.style.width = '300px';
    setTimeout(function(){
      var sub = document.getElementById('iSub');
      if(sub){ sub.textContent = 'Film Corporation'; sub.style.opacity = '1'; }
      nextStep();
    }, 350);
  });
}, 500);

// 1300ms — status flips
setTimeout(function(){
  var s = document.getElementById('iStatus');
  if(s){ s.textContent = 'SYSTEM ONLINE'; s.style.color = 'rgba(0,229,255,.5)'; }
  nextStep();
}, 1300);

// 1600ms — clock appears
setTimeout(function(){
  clockWrap.style.opacity = '1';
  startClock();
  nextStep();
}, 1600);

// 2100ms — divider line sweeps
setTimeout(function(){
  midLine.style.width = '300px';
}, 2100);

// 2500ms — form rises in
setTimeout(function(){
  formWrap.style.opacity = '1';
  formWrap.style.transform = 'translateY(0)';
  nextStep();
  // strip
  setTimeout(function(){ strip.style.opacity = '1'; bootWrap.style.opacity = '0'; }, 300);
}, 2500);

// ── DISMISS — called after successful login ──
window.dismissIntroAfterLogin = function(){
  if(gone) return; gone = true;
  clearInterval(clockIv);
  cancelAnimationFrame(raf);
  intro.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.4,0,.2,1)';
  intro.style.opacity = '0';
  intro.style.transform = 'translateY(-20px)';
  setTimeout(function(){ intro.style.display = 'none'; }, 520);
};

// Tap to skip intro animation (but keep form visible)
intro.addEventListener('click', function(e){
  // Don't intercept clicks on buttons/inputs
  if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
  if(Date.now() - T0 < 800) return;
  // Snap all elements to final state immediately
  metaBar.style.opacity = '1';
  wmWrap.style.opacity = '1'; wmWrap.style.transform = 'translateY(0)';
  var el = document.getElementById('iTitle'); if(el && !el.textContent) el.textContent = 'Microflex';
  var bar = document.getElementById('iBar'); if(bar) bar.style.width = '300px';
  var sub = document.getElementById('iSub'); if(sub){ sub.textContent = 'Film Corporation'; sub.style.opacity = '1'; }
  clockWrap.style.opacity = '1'; if(!clockIv) startClock();
  midLine.style.width = '300px';
  formWrap.style.opacity = '1'; formWrap.style.transform = 'translateY(0)';
  strip.style.opacity = '1'; bootWrap.style.opacity = '0';
});

})();
