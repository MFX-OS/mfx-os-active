// ═══════════════════════════════════════════════
// MFX OS SOUND ENGINE v2.0
// Pure Web Audio API — zero external files
// Boot music + UI sounds. No voice.
// ═══════════════════════════════════════════════
(function(){
'use strict';

var ctx = null;
var enabled = true;
var volume = 0.3;

function getCtx(){
  if(!ctx){try{ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){enabled=false}}
  return ctx;
}

function resumeAudio(){
  var c=getCtx();
  if(c&&c.state==='suspended')c.resume();
}
document.addEventListener('click',resumeAudio,{once:false});
document.addEventListener('touchstart',resumeAudio,{once:false});

// ── REVERB ──
var reverbNode=null;
function getReverb(){
  var a=getCtx();if(!a)return null;
  if(reverbNode)return reverbNode;
  reverbNode=a.createConvolver();
  var rate=a.sampleRate,len=rate*2;
  var buf=a.createBuffer(2,len,rate);
  for(var ch=0;ch<2;ch++){
    var d=buf.getChannelData(ch);
    for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(rate*0.5))*0.3;
  }
  reverbNode.buffer=buf;
  reverbNode.connect(a.destination);
  return reverbNode;
}

function reverbSend(src,dry,wet){
  var a=getCtx();if(!a)return;
  var dG=a.createGain();dG.gain.value=dry;dG.connect(a.destination);
  var wG=a.createGain();wG.gain.value=wet;
  var rv=getReverb();if(rv)wG.connect(rv);else wG.connect(a.destination);
  src.connect(dG);src.connect(wG);
}

// ── CORE OSCILLATOR ──
function playTone(freq,type,dur,vol,delay){
  if(!enabled)return;
  var c=getCtx();if(!c)return;
  var osc=c.createOscillator();var gain=c.createGain();
  osc.connect(gain);gain.connect(c.destination);
  osc.type=type||'sine';osc.frequency.value=freq;
  var v=(vol||volume)*0.4,t=c.currentTime+(delay||0);
  gain.gain.setValueAtTime(0,t);
  gain.gain.linearRampToValueAtTime(v,t+0.01);
  gain.gain.exponentialRampToValueAtTime(0.001,t+(dur||0.15));
  osc.start(t);osc.stop(t+(dur||0.15)+0.01);
}

// ── NOISE ──
function playNoise(dur,vol){
  if(!enabled)return;
  var c=getCtx();if(!c)return;
  var bufSize=c.sampleRate*(dur||0.05);
  var buf=c.createBuffer(1,bufSize,c.sampleRate);
  var data=buf.getChannelData(0);
  for(var i=0;i<bufSize;i++)data[i]=(Math.random()*2-1)*0.3;
  var src=c.createBufferSource();var gain=c.createGain();var filter=c.createBiquadFilter();
  src.buffer=buf;filter.type='highpass';filter.frequency.value=3000;
  src.connect(filter);filter.connect(gain);gain.connect(c.destination);
  gain.gain.setValueAtTime((vol||volume)*0.2,c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+(dur||0.05));
  src.start();
}

// ── BOOT MUSIC — Punchy, fast, branded ──
// Called by intro.js on first user interaction or auto after 200ms
window.playBootMusic = function(){
  if(!enabled)return;
  var a=getCtx();if(!a)return;
  try{a.resume()}catch(e){}
  var t=a.currentTime+0.05;

  // Sub kick — deep impact
  var kick=a.createOscillator();var kickG=a.createGain();
  kick.type='sine';kick.frequency.setValueAtTime(180,t);
  kick.frequency.exponentialRampToValueAtTime(40,t+0.12);
  kickG.gain.setValueAtTime(0,t);kickG.gain.linearRampToValueAtTime(0.5,t+0.005);
  kickG.gain.exponentialRampToValueAtTime(0.001,t+0.25);
  kick.connect(kickG);kickG.connect(a.destination);
  kick.start(t);kick.stop(t+0.3);

  // Second kick punch at beat 2
  var k2=a.createOscillator();var k2G=a.createGain();
  k2.type='sine';k2.frequency.setValueAtTime(160,t+0.22);
  k2.frequency.exponentialRampToValueAtTime(38,t+0.34);
  k2G.gain.setValueAtTime(0,t+0.22);k2G.gain.linearRampToValueAtTime(0.35,t+0.225);
  k2G.gain.exponentialRampToValueAtTime(0.001,t+0.45);
  k2.connect(k2G);k2G.connect(a.destination);
  k2.start(t+0.22);k2.stop(t+0.5);

  // Ascending chord — C E G (major, energetic)
  [[261.6,0],[329.6,0.08],[392,0.16],[523.2,0.28]].forEach(function(n){
    var o=a.createOscillator();var g=a.createGain();
    o.type='triangle';o.frequency.value=n[0];
    g.gain.setValueAtTime(0,t+n[1]);
    g.gain.linearRampToValueAtTime(0.06,t+n[1]+0.04);
    g.gain.exponentialRampToValueAtTime(0.001,t+n[1]+0.55);
    o.connect(g);reverbSend(g,0.4,0.3);
    o.start(t+n[1]);o.stop(t+n[1]+0.7);
  });

  // High shimmer sweep — cyan feel
  var shim=a.createOscillator();var shimG=a.createGain();var shimF=a.createBiquadFilter();
  shim.type='sine';shim.frequency.setValueAtTime(1800,t+0.1);
  shim.frequency.linearRampToValueAtTime(2400,t+0.5);
  shimF.type='bandpass';shimF.frequency.value=2000;shimF.Q.value=8;
  shimG.gain.setValueAtTime(0,t+0.1);shimG.gain.linearRampToValueAtTime(0.025,t+0.2);
  shimG.gain.exponentialRampToValueAtTime(0.001,t+0.7);
  shim.connect(shimF);shimF.connect(shimG);reverbSend(shimG,0.2,0.5);
  shim.start(t+0.1);shim.stop(t+0.8);

  // Final resolution tone — confident single note
  var res=a.createOscillator();var resG=a.createGain();
  res.type='sine';res.frequency.value=523.25;
  resG.gain.setValueAtTime(0,t+0.45);resG.gain.linearRampToValueAtTime(0.07,t+0.5);
  resG.gain.exponentialRampToValueAtTime(0.001,t+1.1);
  res.connect(resG);reverbSend(resG,0.3,0.4);
  res.start(t+0.45);res.stop(t+1.2);
};

// ── UI SOUNDS ──
window.initSounds = function(){};

window.playSound = function(type){
  if(!enabled)return;
  if(type==='click')    playTone(800,'sine',0.06,0.15);
  if(type==='success')  {playTone(523,'sine',0.12,0.2);playTone(659,'sine',0.12,0.18,0.1);playTone(784,'sine',0.2,0.15,0.2);}
  if(type==='error')    {playTone(200,'sawtooth',0.12,0.2);playTone(180,'sawtooth',0.18,0.15,0.1);}
  if(type==='notify')   {playTone(880,'sine',0.08,0.12);playTone(1100,'sine',0.1,0.1,0.09);}
  if(type==='save')     playTone(660,'sine',0.1,0.12);
  if(type==='modal')    playTone(440,'triangle',0.08,0.1);
  if(type==='quote')    {playTone(392,'sine',0.15,0.2);playTone(494,'sine',0.15,0.18,0.12);}
};

var soundOn = localStorage.getItem('mfx_sound') !== '0';
window.toggleSound = function(){
  soundOn=!soundOn;enabled=soundOn;
  localStorage.setItem('mfx_sound',soundOn?'1':'0');
  if(typeof toast==='function')toast(soundOn?'Sound on':'Sound off','ok');
};

// Restore setting on load
if(localStorage.getItem('mfx_sound')==='0')enabled=false;

})();
