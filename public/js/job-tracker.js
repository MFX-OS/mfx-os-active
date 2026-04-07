// ══════════════════════════════════════════════════════════════════
// MFX OS — JOB TICKET MANAGER v3 (iframe loader)
// Loads the standalone Job Tracker v3 React app inside MFX OS
// Drop-in: <script src="js/job-tracker.js"></script>
// ══════════════════════════════════════════════════════════════════
(function(){
  'use strict';

  function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  function jtInit(){
    // Hook into MFX event bus
    if(typeof MFX!=='undefined'&&MFX.on){
      MFX.on('view.jobtracker',function(){
        renderJobTracker();
      });
    }

    // Wrap goView so clicking "Job Tracker" triggers our render
    var origGoView=window.goView;
    if(typeof origGoView==='function'){
      window.goView=function(v){
        origGoView(v);
        if(v==='jobtracker'){
          renderJobTracker();
        }
      };
    }

    console.log('✅ MFX Job Tracker v3 (iframe loader) initialized');
  }

  function renderJobTracker(){
    var el=document.getElementById('v-jobtracker');
    if(!el) el=typeof $==='function'?$('v-jobtracker'):null;
    if(!el) return;

    // Only create iframe once
    if(el.querySelector('iframe')) return;

    el.innerHTML='<iframe id="jtIframe" src="/job-tracker-v3.html" style="width:100%;height:100%;border:none;background:#061e2a;display:block"></iframe>';
    // Pass dept label to iframe
    var iframe=el.querySelector('iframe');
    if(iframe){iframe.addEventListener('load',function(){try{var p=typeof getMFXProfile==='function'?getMFXProfile():{};var dept=p.dept||'Production';var deptShort={Operations:'OPS',Estimation:'EST','Pre-Press':'PP',Production:'PROD',Quality:'QA',Accounting:'ACCT',Sales:'SALES',Administration:'ADMIN'};var short=deptShort[dept]||dept.substring(0,4).toUpperCase();iframe.contentWindow.__mfxDeptLabel=short+' · '+dept}catch(e){}})}
  }

  // Expose globally so it can be called manually too
  window.renderJobTracker=renderJobTracker;

  // Init after DOM + Firebase ready
  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(jtInit,1500);
  }else{
    document.addEventListener('DOMContentLoaded',function(){
      setTimeout(jtInit,1500);
    });
  }
})();
