// ======================================================================
// MFX OS -- SQF EVIDENCE CAPTURE LIBRARY
// Photo attachments, e-signatures, retention policies, mgmt-review packets
// Shared infrastructure for all SQF-facing modules
// Drop-in: <script src="js/sqf-evidence.js"></script>
// ======================================================================

(function(){
  'use strict';

  // ─── STATE ────────────────────────────────────────────────────
  // Per-form evidence stash keyed by formId
  var _stash = {};
  // Active signature pads
  var _pads = {};

  // ─── RETENTION POLICY TABLE ───────────────────────────────────
  var RETENTION = {
    'sanitation':      { years:3, clause:'13.3.1', label:'Sanitation',        attachDrive:'Quality System/Sanitation/' },
    'qc':              { years:7, clause:'2.5.2',  label:'QC Inspection',     attachDrive:'Quality System/Inspections/' },
    'hold':            { years:7, clause:'2.5.4',  label:'Hold Tag',          attachDrive:'Quality System/Hold Tags/' },
    'release':         { years:7, clause:'2.4.4',  label:'Product Release',   attachDrive:'Quality System/Release/' },
    'receiving':       { years:3, clause:'13.8.1', label:'Material Receiving',attachDrive:'Quality System/Receiving/' },
    'gmpInspection':   { years:3, clause:'11.2',   label:'GMP Inspection',    attachDrive:'Quality System/GMP/' },
    'temperature':     { years:3, clause:'11.2.4', label:'Temperature Log',   attachDrive:'Quality System/Temperature/' },
    'swab':            { years:3, clause:'11.4',   label:'Environmental Swab',attachDrive:'Quality System/Swabs/' },
    'water':           { years:3, clause:'11.6',   label:'Water Test',        attachDrive:'Quality System/Water/' },
    'pest':            { years:3, clause:'11.3',   label:'Pest Control',      attachDrive:'Quality System/Pest/' },
    'ncr':             { years:7, clause:'2.5.4',  label:'NCR / CAPA',        attachDrive:'Quality System/NCR-CAPA/' },
    'audit':           { years:7, clause:'2.5.1',  label:'Internal Audit',    attachDrive:'Quality System/Audits/' },
    'managementReview':{ years:7, clause:'2.1.4',  label:'Management Review', attachDrive:'Quality System/Management Reviews/' },
    'training':        { years:5, clause:'2.9',    label:'Training Record',   attachDrive:'Quality System/Training/' },
    'corrective':      { years:7, clause:'2.5.4',  label:'Corrective Action', attachDrive:'Quality System/NCR-CAPA/' },
    'default':         { years:3, clause:'—',      label:'General Record',    attachDrive:'Quality System/General/' }
  };

  // ─── HELPERS ──────────────────────────────────────────────────
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]; }); }
  function uid(){ return 'ev_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function fmtSize(b){ return b<1024?(b+'B'):b<1048576?((b/1024).toFixed(1)+'KB'):((b/1048576).toFixed(1)+'MB'); }
  function getUser(){ return typeof getUserName==='function'?getUserName():'Unknown'; }
  function getUserID(){ return typeof getUserId==='function'?getUserId():''; }
  function nowISO(){ return new Date().toISOString(); }

  function getStash(formId){
    if(!_stash[formId]) _stash[formId]={ photos:[], files:[], signature:null, signedAt:null, signedBy:null, signedById:null };
    return _stash[formId];
  }

  // ─── PHOTO ATTACHMENT ─────────────────────────────────────────

  // Returns HTML for the photo/file attachment zone
  function renderAttachmentZone(formId, recordType){
    var stash = getStash(formId);
    var policy = RETENTION[recordType] || RETENTION['default'];
    var h = '';

    h += '<div class="ev-zone" id="ev-zone-'+esc(formId)+'">';
    h += '<div class="ev-zone-label">Evidence Attachments</div>';

    // Retention policy tag
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    h += '<div style="font-size:10px;color:var(--tx2)">Photos, documents, and files for this record</div>';
    h += '<span class="ev-retention">SQF '+esc(policy.clause)+' · '+policy.years+'yr retention</span>';
    h += '</div>';

    // Buttons
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h += '<label class="ev-attach-btn ev-camera-btn">';
    h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    h += ' Camera';
    h += '<input type="file" accept="image/*" capture="environment" style="display:none" onchange="window.SQF_EV.addPhoto(\''+esc(formId)+'\',this)">';
    h += '</label>';
    h += '<label class="ev-attach-btn">';
    h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
    h += ' Attach File';
    h += '<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style="display:none" onchange="window.SQF_EV.addFiles(\''+esc(formId)+'\',this)">';
    h += '</label>';
    h += '<label class="ev-attach-btn">';
    h += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    h += ' Gallery';
    h += '<input type="file" accept="image/*" multiple style="display:none" onchange="window.SQF_EV.addFiles(\''+esc(formId)+'\',this)">';
    h += '</label>';
    h += '</div>';

    // Photo thumbnails
    h += '<div class="ev-photo-grid" id="ev-photos-'+esc(formId)+'">';
    stash.photos.forEach(function(p, i){
      h += '<div style="position:relative">';
      h += '<img class="ev-thumb" src="'+esc(p.dataUrl)+'" alt="'+esc(p.name)+'" onclick="window.SQF_EV.previewPhoto(\''+esc(formId)+'\','+i+')">';
      h += '<div onclick="window.SQF_EV.removePhoto(\''+esc(formId)+'\','+i+')" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:var(--rd);color:#fff;border-radius:50%;font-size:10px;line-height:16px;text-align:center;cursor:pointer;font-weight:700">&times;</div>';
      h += '</div>';
    });
    h += '</div>';

    // File list
    if(stash.files.length){
      h += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px" id="ev-files-'+esc(formId)+'">';
      stash.files.forEach(function(f, i){
        h += '<span class="ev-file-chip">'+esc(f.name)+' ('+fmtSize(f.size)+') <span class="ev-remove" onclick="window.SQF_EV.removeFile(\''+esc(formId)+'\','+i+')">&times;</span></span>';
      });
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  function addPhotoFromInput(formId, input){
    if(!input.files||!input.files.length) return;
    var file = input.files[0];
    if(file.size > 10*1024*1024){ if(typeof toast==='function') toast('Photo too large (max 10MB)','err'); return; }
    var reader = new FileReader();
    reader.onload = function(e){
      var stash = getStash(formId);
      // Compress if over 2MB
      if(file.size > 2*1024*1024){
        compressImage(e.target.result, 1200, 0.8, function(compressed){
          stash.photos.push({ name:file.name, dataUrl:compressed, size:compressed.length, mime:file.type, capturedAt:nowISO(), capturedBy:getUser() });
          refreshAttachmentUI(formId);
        });
      } else {
        stash.photos.push({ name:file.name, dataUrl:e.target.result, size:file.size, mime:file.type, capturedAt:nowISO(), capturedBy:getUser() });
        refreshAttachmentUI(formId);
      }
    };
    reader.readAsDataURL(file);
    input.value='';
  }

  function addFilesFromInput(formId, input){
    if(!input.files||!input.files.length) return;
    var stash = getStash(formId);
    for(var i=0;i<input.files.length;i++){
      var f=input.files[i];
      if(f.size > 25*1024*1024){ if(typeof toast==='function') toast(f.name+' too large (max 25MB)','err'); continue; }
      if(/^image\//i.test(f.type)){
        (function(file){
          var reader=new FileReader();
          reader.onload=function(e){
            stash.photos.push({ name:file.name, dataUrl:e.target.result, size:file.size, mime:file.type, capturedAt:nowISO(), capturedBy:getUser() });
            refreshAttachmentUI(formId);
          };
          reader.readAsDataURL(file);
        })(f);
      } else {
        stash.files.push({ name:f.name, size:f.size, mime:f.type, blob:f, addedAt:nowISO(), addedBy:getUser() });
        refreshAttachmentUI(formId);
      }
    }
    input.value='';
  }

  function removePhoto(formId, idx){
    var stash=getStash(formId);
    stash.photos.splice(idx,1);
    refreshAttachmentUI(formId);
  }

  function removeFile(formId, idx){
    var stash=getStash(formId);
    stash.files.splice(idx,1);
    refreshAttachmentUI(formId);
  }

  function previewPhoto(formId, idx){
    var stash=getStash(formId);
    var photo=stash.photos[idx];
    if(!photo) return;
    if(typeof openModal==='function'){
      var h='<div style="text-align:center">';
      h+='<img src="'+esc(photo.dataUrl)+'" style="max-width:100%;max-height:70vh;border-radius:8px;border:2px solid var(--bdr)">';
      h+='<div style="margin-top:8px;font-size:10px;color:var(--tx3)">'+esc(photo.name)+' · '+fmtSize(photo.size)+' · '+esc(photo.capturedBy)+' · '+esc(photo.capturedAt)+'</div>';
      h+='</div>';
      openModal(h);
    }
  }

  function compressImage(dataUrl, maxDim, quality, cb){
    var img=new Image();
    img.onload=function(){
      var w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){
        var ratio=Math.min(maxDim/w,maxDim/h);
        w=Math.round(w*ratio);h=Math.round(h*ratio);
      }
      var canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',quality||0.8));
    };
    img.src=dataUrl;
  }

  function refreshAttachmentUI(formId){
    // Re-render just the attachment zone
    var zone=document.getElementById('ev-zone-'+formId);
    if(!zone) return;
    // Find parent and figure out record type from data attribute
    var recordType=zone.getAttribute('data-record-type')||'default';
    var parent=zone.parentNode;
    if(parent){
      var newHtml=renderAttachmentZone(formId, recordType);
      var temp=document.createElement('div');
      temp.innerHTML=newHtml;
      var newZone=temp.firstElementChild;
      if(newZone) parent.replaceChild(newZone, zone);
      // Preserve data attribute
      var replaced=document.getElementById('ev-zone-'+formId);
      if(replaced) replaced.setAttribute('data-record-type', recordType);
    }
  }


  // ─── E-SIGNATURE PAD ─────────────────────────────────────────

  function renderSignaturePad(formId, label){
    var stash=getStash(formId);
    var h='';
    h+='<div class="ev-sig-wrap" id="ev-sig-wrap-'+esc(formId)+'">';
    h+='<div style="font-size:10px;font-weight:700;color:var(--tx);margin-bottom:4px">'+(label||'E-Signature — Sign Below')+'</div>';

    if(stash.signature){
      // Show signed state
      h+='<div style="position:relative">';
      h+='<img src="'+esc(stash.signature)+'" style="width:100%;height:100px;border:2px solid var(--gn);border-radius:8px;background:var(--bg);object-fit:contain">';
      h+='<div class="ev-sig-meta">';
      h+='<span class="ev-sig-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Signed</span>';
      h+='<span>'+esc(stash.signedBy)+' · '+esc(new Date(stash.signedAt).toLocaleString())+'</span>';
      h+='</div>';
      h+='<button onclick="window.SQF_EV.clearSignature(\''+esc(formId)+'\')" style="position:absolute;top:4px;right:4px;padding:2px 8px;font-size:9px;background:rgba(239,68,68,.1);color:var(--rd);border:1px solid rgba(239,68,68,.3);border-radius:4px;cursor:pointer">Clear</button>';
      h+='</div>';
    } else {
      h+='<canvas id="ev-sig-canvas-'+esc(formId)+'" class="ev-sig-canvas" width="600" height="100"></canvas>';
      h+='<div class="ev-sig-meta">';
      h+='<span style="color:var(--tx3)">Draw your signature above</span>';
      h+='<div style="display:flex;gap:4px">';
      h+='<button onclick="window.SQF_EV.clearPad(\''+esc(formId)+'\')" style="padding:2px 8px;font-size:9px;background:var(--bg2);color:var(--tx3);border:1px solid var(--bdr);border-radius:4px;cursor:pointer">Clear</button>';
      h+='<button onclick="window.SQF_EV.acceptSignature(\''+esc(formId)+'\')" class="btn btn-signoff" style="padding:3px 10px;font-size:9px">Accept Signature</button>';
      h+='</div></div>';
    }
    h+='</div>';
    return h;
  }

  function initSignaturePad(formId){
    var canvas=document.getElementById('ev-sig-canvas-'+formId);
    if(!canvas) return;
    var ctx=canvas.getContext('2d');
    var drawing=false;
    var hasStrokes=false;
    var rect;

    function getPos(e){
      rect=canvas.getBoundingClientRect();
      var scaleX=canvas.width/rect.width;
      var scaleY=canvas.height/rect.height;
      if(e.touches&&e.touches.length){
        return { x:(e.touches[0].clientX-rect.left)*scaleX, y:(e.touches[0].clientY-rect.top)*scaleY };
      }
      return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
    }

    function startDraw(e){
      e.preventDefault();
      drawing=true;
      var pos=getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x,pos.y);
    }
    function draw(e){
      if(!drawing)return;
      e.preventDefault();
      var pos=getPos(e);
      ctx.lineWidth=2.5;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.strokeStyle='#e0f2fe';
      ctx.lineTo(pos.x,pos.y);
      ctx.stroke();
      hasStrokes=true;
    }
    function endDraw(e){
      if(e)e.preventDefault();
      drawing=false;
    }

    canvas.addEventListener('mousedown',startDraw);
    canvas.addEventListener('mousemove',draw);
    canvas.addEventListener('mouseup',endDraw);
    canvas.addEventListener('mouseleave',endDraw);
    canvas.addEventListener('touchstart',startDraw,{passive:false});
    canvas.addEventListener('touchmove',draw,{passive:false});
    canvas.addEventListener('touchend',endDraw,{passive:false});

    _pads[formId]={
      canvas:canvas, ctx:ctx, _cleared:false,
      hasStrokes:function(){return hasStrokes&&!this._cleared},
      _handlers:{startDraw:startDraw, draw:draw, endDraw:endDraw}
    };
  }

  function clearPad(formId){
    var pad=_pads[formId];
    if(!pad) return;
    pad.ctx.clearRect(0,0,pad.canvas.width,pad.canvas.height);
    pad._cleared=true;
  }

  function acceptSignature(formId){
    var pad=_pads[formId];
    if(!pad||!pad.hasStrokes()){
      if(typeof toast==='function') toast('Draw your signature first','err');
      return;
    }
    var stash=getStash(formId);
    stash.signature=pad.canvas.toDataURL('image/png');
    stash.signedAt=nowISO();
    stash.signedBy=getUser();
    stash.signedById=getUserID();
    // Re-render the signature area
    var wrap=document.getElementById('ev-sig-wrap-'+formId);
    if(wrap){
      var temp=document.createElement('div');
      temp.innerHTML=renderSignaturePad(formId);
      wrap.parentNode.replaceChild(temp.firstElementChild,wrap);
    }
    if(typeof toast==='function') toast('Signature captured','ok');
  }

  function clearSignature(formId){
    var stash=getStash(formId);
    stash.signature=null;
    stash.signedAt=null;
    stash.signedBy=null;
    stash.signedById=null;
    // Re-render
    var wrap=document.getElementById('ev-sig-wrap-'+formId);
    if(wrap){
      var temp=document.createElement('div');
      temp.innerHTML=renderSignaturePad(formId);
      wrap.parentNode.replaceChild(temp.firstElementChild,wrap);
      setTimeout(function(){ initSignaturePad(formId); },50);
    }
  }


  // ─── UPLOAD TO DRIVE ──────────────────────────────────────────

  // Upload all attachments for a record to MFX-CORE shared drive
  function uploadEvidence(formId, recordType, meta){
    var stash=getStash(formId);
    if(!stash.photos.length && !stash.files.length && !stash.signature) return Promise.resolve({ uploaded:0 });

    var policy=RETENTION[recordType]||RETENTION['default'];
    var uploads=[];

    // Upload photos
    stash.photos.forEach(function(p,i){
      uploads.push({
        type:'photo',
        name:p.name||('photo_'+(i+1)+'.jpg'),
        dataUrl:p.dataUrl,
        mime:p.mime||'image/jpeg'
      });
    });

    // Upload signature
    if(stash.signature){
      uploads.push({
        type:'signature',
        name:'esignature_'+getUser().replace(/\s/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.png',
        dataUrl:stash.signature,
        mime:'image/png'
      });
    }

    // Meta for the upload
    var company=meta&&meta.company?meta.company:'Microflex Film';
    var recordNum=meta&&meta.recordNum?meta.recordNum:(recordType+'_'+new Date().toISOString().slice(0,10));

    var results=[];
    var chain=Promise.resolve();

    uploads.forEach(function(item){
      chain=chain.then(function(){
        return dataUrlToBlob(item.dataUrl).then(function(blob){
          var form=new FormData();
          form.append('company', company);
          form.append('quoteNum', recordNum);
          form.append('fileType', policy.label.replace(/\s/g,'_'));
          form.append('file', blob, item.name);

          var getToken=(typeof fbAuth!=='undefined'&&fbAuth.currentUser&&fbAuth.currentUser.getIdToken)?fbAuth.currentUser.getIdToken():Promise.resolve('');
          return getToken.then(function(token){
            var headers={};
            if(token) headers.Authorization='Bearer '+token;
            return fetch('/api/uploadToDrive',{method:'POST',headers:headers,body:form});
          }).then(function(r){ return r.json(); }).then(function(data){
            results.push({ name:item.name, type:item.type, driveLink:data.driveLink||'', driveId:data.driveId||'', success:!!data.success });
          }).catch(function(err){
            results.push({ name:item.name, type:item.type, error:err.message, success:false });
          });
        });
      });
    });

    // Upload non-image files
    stash.files.forEach(function(f){
      chain=chain.then(function(){
        var form=new FormData();
        form.append('company', company);
        form.append('quoteNum', recordNum);
        form.append('fileType', policy.label.replace(/\s/g,'_'));
        form.append('file', f.blob, f.name);

        return authFetch('/api/uploadToDrive', form).then(function(data){
          results.push({ name:f.name, type:'file', driveLink:data.driveLink||'', success:!!data.success });
        }).catch(function(err){
          results.push({ name:f.name, type:'file', error:err.message, success:false });
        });
      });
    });

    return chain.then(function(){ return { uploaded:results.length, results:results }; });
  }

  function authFetch(path, formData){
    var getToken=typeof fbAuth!=='undefined'&&fbAuth.currentUser&&fbAuth.currentUser.getIdToken
      ? fbAuth.currentUser.getIdToken() : Promise.resolve('');
    return getToken.then(function(token){
      var headers={};
      if(token) headers.Authorization='Bearer '+token;
      return fetch(path,{ method:'POST', headers:headers, body:formData });
    }).then(function(r){ return r.json(); });
  }

  function dataUrlToBlob(dataUrl){
    return new Promise(function(resolve){
      var parts=dataUrl.split(',');
      var mime=(parts[0].match(/:(.*?);/)||[])[1]||'image/png';
      var raw=atob(parts[1]);
      var arr=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
      resolve(new Blob([arr],{type:mime}));
    });
  }


  // ─── COLLECT EVIDENCE FOR RECORD ──────────────────────────────

  // Returns a plain object to merge into any Firestore record
  function collectEvidence(formId){
    var stash=getStash(formId);
    var evidence={
      hasEvidence: stash.photos.length>0 || stash.files.length>0 || !!stash.signature,
      photoCount: stash.photos.length,
      fileCount: stash.files.length,
      hasSigned: !!stash.signature,
      attachments:[]
    };

    // Store photo metadata (not full data URLs — those go to Drive)
    stash.photos.forEach(function(p){
      evidence.attachments.push({
        type:'photo', name:p.name, size:p.size, mime:p.mime,
        capturedAt:p.capturedAt, capturedBy:p.capturedBy
      });
    });
    stash.files.forEach(function(f){
      evidence.attachments.push({
        type:'file', name:f.name, size:f.size, mime:f.mime,
        addedAt:f.addedAt, addedBy:f.addedBy
      });
    });

    if(stash.signature){
      evidence.signature={
        signedAt:stash.signedAt,
        signedBy:stash.signedBy,
        signedById:stash.signedById,
        // Store compact hash, not full PNG — full PNG goes to Drive
        dataLength:stash.signature.length
      };
    }

    return evidence;
  }

  // Remove canvas event listeners for a given form's signature pad
  function cleanupPadListeners(formId){
    var pad=_pads[formId];
    if(!pad||!pad.canvas||!pad._handlers) return;
    var c=pad.canvas, h=pad._handlers;
    c.removeEventListener('mousedown',h.startDraw);
    c.removeEventListener('mousemove',h.draw);
    c.removeEventListener('mouseup',h.endDraw);
    c.removeEventListener('mouseleave',h.endDraw);
    c.removeEventListener('touchstart',h.startDraw);
    c.removeEventListener('touchmove',h.draw);
    c.removeEventListener('touchend',h.endDraw);
  }

  // Clean up all active signature pad listeners
  function cleanupAllEvidenceListeners(){
    for(var id in _pads){
      if(_pads.hasOwnProperty(id)) cleanupPadListeners(id);
    }
  }

  // Clear a form's evidence stash after save
  function clearStash(formId){
    cleanupPadListeners(formId);
    delete _stash[formId];
    delete _pads[formId];
  }


  // ─── MANAGEMENT REVIEW PACKET ─────────────────────────────────

  function renderManagementReviewPacket(formId){
    var h='';
    h+='<div class="ev-packet">';
    h+='<div class="ev-packet-title">Management Review Packet</div>';
    h+='<div class="ev-packet-sub">SQF Ed.10 Clause 2.1.4 — Quarterly review of food safety system performance</div>';

    // Attendees
    h+='<div class="ev-packet-section">';
    h+='<div class="ev-packet-section-title">Meeting Details</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    h+='<div><label style="font-size:10px;color:var(--tx3);display:block;margin-bottom:2px">Date</label>';
    h+='<input type="date" id="mr-date-'+esc(formId)+'" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px"></div>';
    h+='<div><label style="font-size:10px;color:var(--tx3);display:block;margin-bottom:2px">Quarter</label>';
    h+='<select id="mr-quarter-'+esc(formId)+'" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px">';
    h+='<option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select></div>';
    h+='</div>';
    h+='<div style="margin-top:6px"><label style="font-size:10px;color:var(--tx3);display:block;margin-bottom:2px">Attendees (one per line)</label>';
    h+='<textarea id="mr-attendees-'+esc(formId)+'" rows="3" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px;resize:vertical" placeholder="Randy Smith - CEO&#10;Maria Rodriguez - QA Manager&#10;James Chen - Production Supervisor"></textarea></div>';
    h+='</div>';

    // Agenda sections per SQF 2.1.4
    var sections=[
      {id:'complaints',label:'Customer Complaints Review',placeholder:'Summary of complaints received, root causes, corrective actions taken...'},
      {id:'audits',label:'Internal / External Audit Results',placeholder:'Audit scores, findings, closure status of CARs...'},
      {id:'ncr',label:'NCR / CAPA Effectiveness',placeholder:'Open NCRs, CAPA completion rates, effectiveness verification results...'},
      {id:'food_safety',label:'Food Safety Plan Review',placeholder:'HACCP plan updates, CCP monitoring results, critical limit deviations...'},
      {id:'supplier',label:'Supplier Performance',placeholder:'Supplier audit results, CoA compliance, delivery performance...'},
      {id:'training',label:'Training & Competency',placeholder:'Training completion rates, new hire onboarding, competency gaps...'},
      {id:'kpi',label:'Quality KPIs & Trends',placeholder:'Defect rates, rejection rates, first-pass yield, customer returns...'},
      {id:'regulatory',label:'Regulatory & Standard Changes',placeholder:'New regulations, SQF code updates, customer specification changes...'},
      {id:'resources',label:'Resource Allocation',placeholder:'Equipment needs, staffing, budget for food safety program...'},
      {id:'decisions',label:'Decisions & Action Items',placeholder:'Key decisions made, assigned action items with owners and deadlines...'}
    ];

    sections.forEach(function(sec){
      h+='<div class="ev-packet-section">';
      h+='<div class="ev-packet-section-title">'+esc(sec.label)+'</div>';
      h+='<textarea id="mr-'+sec.id+'-'+esc(formId)+'" rows="3" style="width:100%;padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:11px;resize:vertical" placeholder="'+esc(sec.placeholder)+'"></textarea>';
      h+='</div>';
    });

    // Photo evidence
    h+=renderAttachmentZone(formId+'_mr', 'managementReview');

    // Signature block — chair + QA Manager
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">';
    h+='<div>';
    h+=renderSignaturePad(formId+'_chair', 'Meeting Chair Signature');
    h+='</div>';
    h+='<div>';
    h+=renderSignaturePad(formId+'_qa', 'QA Manager Signature');
    h+='</div>';
    h+='</div>';

    // Save button
    h+='<div class="compliance-boundary" style="margin-top:12px"></div>';
    h+='<button class="btn btn-signoff" onclick="window.SQF_EV.saveManagementReview(\''+esc(formId)+'\')">';
    h+='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Save Management Review</button>';
    h+='<span class="ev-retention" style="margin-left:8px">7yr retention · SQF 2.1.4</span>';

    h+='</div>';
    return h;
  }

  function saveManagementReview(formId){
    var gv=function(id){ var el=document.getElementById(id); return el?el.value:''; };
    var date=gv('mr-date-'+formId);
    var quarter=gv('mr-quarter-'+formId);
    var attendees=gv('mr-attendees-'+formId);

    if(!date||!attendees.trim()){
      if(typeof toast==='function') toast('Date and Attendees are required','err');
      return;
    }

    // Check for at least one signature
    var chairStash=getStash(formId+'_chair');
    var qaStash=getStash(formId+'_qa');
    if(!chairStash.signature && !qaStash.signature){
      if(typeof toast==='function') toast('At least one signature required for management review','err');
      return;
    }

    var sections=['complaints','audits','ncr','food_safety','supplier','training','kpi','regulatory','resources','decisions'];
    var content={};
    sections.forEach(function(s){ content[s]=gv('mr-'+s+'-'+formId); });

    var record={
      type:'managementReview',
      date:date,
      quarter:quarter,
      attendees:attendees,
      content:content,
      chairSignature: chairStash.signature ? { signedAt:chairStash.signedAt, signedBy:chairStash.signedBy, signedById:chairStash.signedById } : null,
      qaSignature: qaStash.signature ? { signedAt:qaStash.signedAt, signedBy:qaStash.signedBy, signedById:qaStash.signedById } : null,
      evidence: collectEvidence(formId+'_mr'),
      retentionYears: 7,
      sqfClause: '2.1.4',
      createdAt: nowISO(),
      createdBy: getUser(),
      createdById: getUserID()
    };

    // Save to Firestore
    if(typeof fbDb!=='undefined'){
      fbDb.collection('managementReviews').add(record).then(function(docRef){
        if(typeof toast==='function') toast('Management Review saved ('+docRef.id+')','ok');
        // Upload evidence to Drive in background
        uploadEvidence(formId+'_mr','managementReview',{ company:'Microflex Film', recordNum:'MR_'+date+'_'+quarter });
        // Upload signatures
        if(chairStash.signature){
          dataUrlToBlob(chairStash.signature).then(function(blob){
            var form=new FormData();
            form.append('company','Microflex Film');
            form.append('quoteNum','MR_'+date+'_'+quarter);
            form.append('fileType','Signatures');
            form.append('file',blob,'chair_signature_'+date+'.png');
            authFetch('/api/uploadToDrive',form).catch(function(e){ console.warn('sqfEvidenceUpload', e); });
          });
        }
        if(qaStash.signature){
          dataUrlToBlob(qaStash.signature).then(function(blob){
            var form=new FormData();
            form.append('company','Microflex Film');
            form.append('quoteNum','MR_'+date+'_'+quarter);
            form.append('fileType','Signatures');
            form.append('file',blob,'qa_manager_signature_'+date+'.png');
            authFetch('/api/uploadToDrive',form).catch(function(e){ console.warn('sqfEvidenceUpload', e); });
          });
        }
        // Clear stashes
        clearStash(formId+'_mr');
        clearStash(formId+'_chair');
        clearStash(formId+'_qa');
      }).catch(function(err){
        if(typeof toast==='function') toast('Save failed: '+(err.message||err),'err');
      });
    }
  }


  // ─── EVIDENCE DISPLAY FOR EXISTING RECORDS ────────────────────

  function renderEvidenceSummary(record){
    if(!record||!record.evidence||!record.evidence.hasEvidence) return '';
    var ev=record.evidence;
    var h='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px">';
    if(ev.photoCount) h+='<span style="font-size:9px;padding:2px 6px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:3px;color:var(--gn)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> '+ev.photoCount+' photo'+(ev.photoCount>1?'s':'')+'</span>';
    if(ev.fileCount) h+='<span style="font-size:9px;padding:2px 6px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:3px;color:var(--ac)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> '+ev.fileCount+' file'+(ev.fileCount>1?'s':'')+'</span>';
    if(ev.hasSigned) h+='<span class="ev-sig-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Signed</span>';
    h+='</div>';
    return h;
  }


  // ─── INIT PADS AFTER DOM RENDER ───────────────────────────────

  function initAllPads(){
    // Auto-init any signature canvases on the page
    var canvases=document.querySelectorAll('.ev-sig-canvas');
    canvases.forEach(function(c){
      var id=c.id.replace('ev-sig-canvas-','');
      if(id && !_pads[id]) initSignaturePad(id);
    });
  }


  // ─── PUBLIC API ───────────────────────────────────────────────

  window.SQF_EV = {
    // Rendering
    renderAttachmentZone: renderAttachmentZone,
    renderSignaturePad: renderSignaturePad,
    renderManagementReviewPacket: renderManagementReviewPacket,
    renderEvidenceSummary: renderEvidenceSummary,

    // Photo/file actions
    addPhoto: addPhotoFromInput,
    addFiles: addFilesFromInput,
    removePhoto: removePhoto,
    removeFile: removeFile,
    previewPhoto: previewPhoto,

    // Signature actions
    initSignaturePad: initSignaturePad,
    initAllPads: initAllPads,
    clearPad: clearPad,
    acceptSignature: acceptSignature,
    clearSignature: clearSignature,

    // Data collection
    collectEvidence: collectEvidence,
    uploadEvidence: uploadEvidence,
    clearStash: clearStash,
    getStash: getStash,

    // Management review
    saveManagementReview: saveManagementReview,

    // Cleanup
    cleanupPadListeners: cleanupPadListeners,
    cleanupAllListeners: cleanupAllEvidenceListeners,

    // Constants
    RETENTION: RETENTION
  };

  window.cleanupEvidenceListeners = cleanupAllEvidenceListeners;

})();
