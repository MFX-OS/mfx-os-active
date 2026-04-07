// ══════════════════════════════════════════════════════════════════
// MFX OS — CEO DAILY DASH (iframe loader)
// Loads the standalone CEO Dashboard React app inside MFX OS
// Drop-in: <script src="js/ceo-dash.js"></script>
// ══════════════════════════════════════════════════════════════════
(function(){
  'use strict';

  function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  function ceoDashInit(){
    // Hook into MFX event bus
    if(typeof MFX!=='undefined'&&MFX.on){
      MFX.on('view.ceodash',function(){
        renderCEODash();
      });
    }

    // Wrap goView so clicking "CEO Dash" triggers our render
    var origGoView=window.goView;
    if(typeof origGoView==='function'){
      window.goView=function(v){
        origGoView(v);
        if(v==='ceodash'){
          renderCEODash();
        }
      };
    }

    console.log('✅ MFX CEO Daily Dash (iframe loader) initialized');
  }

  function renderCEODash(){
    var el=document.getElementById('v-ceodash');
    if(!el) el=typeof $==='function'?$('v-ceodash'):null;
    if(!el) return;

    // Only create iframe once
    if(el.querySelector('iframe')) return;

    el.innerHTML='<iframe src="/ceo-dash.html" style="width:100%;height:100%;border:none;background:var(--bg);display:block"></iframe>';
  }

  // Expose globally
  window.renderCEODash=renderCEODash;

  // Init after DOM + Firebase ready
  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(ceoDashInit,1500);
  }else{
    document.addEventListener('DOMContentLoaded',function(){
      setTimeout(ceoDashInit,1500);
    });
  }
})();
