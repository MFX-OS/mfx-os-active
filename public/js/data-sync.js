(function(){
  'use strict';

  function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  function dsInit(){
    if(typeof MFX!=='undefined'&&MFX.on){
      MFX.on('view.datasync',function(){ renderDataSync(); });
    }
    var origGoView=window.goView;
    if(typeof origGoView==='function'){
      window.goView=function(v){
        origGoView(v);
        if(v==='datasync'){ renderDataSync(); }
      };
    }
    console.log('✅ MFX Data Sync (iframe loader) initialized');
  }

  function renderDataSync(){
    var el=document.getElementById('v-datasync');
    if(!el) el=typeof $==='function'?$('v-datasync'):null;
    if(!el) return;
    if(el.querySelector('iframe')) return;
    el.innerHTML='<iframe src="/data-sync.html" style="width:100%;height:100%;border:none;background:var(--bg);display:block"></iframe>';
  }

  window.renderDataSync=renderDataSync;
  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_RENDERERS.datasync=renderDataSync;

  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(dsInit,1500);
  }else{
    document.addEventListener('DOMContentLoaded',function(){ setTimeout(dsInit,1500); });
  }
})();
