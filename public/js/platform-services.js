
(function(){
  'use strict';
  if(typeof window === 'undefined') return;

  function postJSON(path, body){
    return Promise.resolve().then(function(){
      if(typeof fbAuth!=='undefined' && fbAuth.currentUser && typeof fbAuth.currentUser.getIdToken==='function'){
        return fbAuth.currentUser.getIdToken().catch(function(){ return ''; });
      }
      return '';
    }).then(function(token){
      var headers={ 'Content-Type':'application/json' };
      if(token) headers.Authorization='Bearer '+token;
      return fetch(path, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body || {})
      });
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if(!r.ok || data.ok === false || data.success === false) throw new Error(data.error || data.message || ('HTTP '+r.status));
        return data;
      });
    });
  }

  function onceReady(fn){
    if(document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn, { once:true });
  }

  var MFXApi = {
    postJSON: postJSON,
    nextNumber: function(type, fallbackFn){
      var kindMap={so:'salesOrder',jp:'jobPassport',jt:'jobTicket'};
      return postJSON('/api/nextSequence', { kind: kindMap[type] || type }).then(function(d){ return d.formatted; }).catch(function(){ return typeof fallbackFn === 'function' ? fallbackFn() : null; });
    },
    nextNumbers: function(type, count, fallbackFn){
      var list=new Array(count); var tasks=[];
      for(var i=0;i<count;i++){ (function(idx){ tasks.push(MFXApi.nextNumber(type, null).then(function(n){ list[idx]=n; })); })(i); }
      return Promise.all(tasks).then(function(){ return list; }).catch(function(){ return typeof fallbackFn === 'function' ? fallbackFn() : []; });
    },
    provisionPPDFolders: function(payload){ return postJSON('/api/provisionPPDWorkspace', payload); },
    syncSharedInbox: function(payload){ return postJSON('/api/ingestSharedInbox', payload); },
    // New v2 endpoints
    saveQuotePDF: function(payload){ return postJSON('/api/saveQuotePDF', payload); },
    processVPOApproval: function(payload){ return postJSON('/api/processVPOApproval', payload); },
    checkOverdueVPOs: function(){ return postJSON('/api/checkOverdueVPOs', {}); },
    createPassport: function(payload){ return postJSON('/api/createPassport', payload); },
    ppdHealthCheck: function(payload){ return postJSON('/api/ppdHealthCheck', payload); },
    scheduledInboxIngest: function(payload){ return postJSON('/api/scheduledInboxIngest', payload); },
    // v3 — controlled records
    getControlledRecordsRegister: function(){ return postJSON('/api/getControlledRecordsRegister', {}); },
    assembleJobPacket: function(payload){ return postJSON('/api/assembleJobPacket', payload); }
  };
  window.MFXApi = Object.assign(window.MFXApi || {}, MFXApi);

  function toastMsg(msg, kind){ if(typeof window.toast === 'function') window.toast(msg, kind || 'ok'); }

  window.MFXPPDService = window.MFXPPDService || {
    provisionTicketFolders: function(ticketId){
      if(typeof fbDb === 'undefined') return Promise.reject(new Error('Firestore unavailable'));
      return fbDb.collection('jobTickets').doc(ticketId).get().then(function(doc){
        if(!doc.exists) throw new Error('Job not found');
        var jt = Object.assign({id:doc.id}, doc.data() || {});
        // Idempotent: if already provisioned, run health check instead
        if(jt.ppd && jt.ppd.driveFolderId){
          return MFXApi.ppdHealthCheck({ jobTicketId: ticketId }).then(function(report){
            if(report.status === 'healthy' || report.status === 'repaired'){
              toastMsg('PPD folders verified' + (report.repairedFolders && report.repairedFolders.length ? ' (' + report.repairedFolders.length + ' repaired)' : ''), (report.status === 'repaired' ? 'err' : 'ok'));
              return { rootFolderId: jt.ppd.driveFolderId, rootFolderUrl: jt.ppd.driveFolderUrl, folders: report.subfolders || {}, healthCheck: report };
            }
            // If broken, re-provision
            return MFXApi.provisionPPDFolders({
              company: jt.company, skuName: jt.skuName, jobTicketNum: jt.jtNum,
              jobTicketId: jt.id, quoteNum: jt.quoteNum, blueprintId: jt.blueprintId || ''
            });
          }).catch(function(err){
            console.warn('Health check failed, re-provisioning:', err.message);
            return MFXApi.provisionPPDFolders({
              company: jt.company, skuName: jt.skuName, jobTicketNum: jt.jtNum,
              jobTicketId: jt.id, quoteNum: jt.quoteNum, blueprintId: jt.blueprintId || ''
            });
          });
        }
        return MFXApi.provisionPPDFolders({
          company: jt.company,
          skuName: jt.skuName,
          jobTicketNum: jt.jtNum,
          jobTicketId: jt.id,
          quoteNum: jt.quoteNum,
          blueprintId: jt.blueprintId || ''
        }).then(function(folderData){
          return fbDb.collection('jobTickets').doc(jt.id).set({
            updatedAt: new Date().toISOString(),
            updatedBy: typeof getUserName === 'function' ? getUserName() : 'System',
            ppd: {
              driveFolderUrl: folderData.rootFolderUrl || '',
              driveFolderId: folderData.rootFolderId || '',
              folders: folderData.folders || {},
              folderProvisionedAt: new Date().toISOString()
            }
          }, { merge:true }).then(function(){ return folderData; });
        });
      }).catch(function(e){ console.warn('PLATFORM_SERVICES get:', e.message); });
    },
    healthCheck: function(ticketId){
      return MFXApi.ppdHealthCheck({ jobTicketId: ticketId, repair: true });
    },
    provisionMissingForPassport: function(jpId){
      if(typeof getJobTickets !== 'function') return Promise.resolve([]);
      var tickets = (getJobTickets() || []).filter(function(t){ return t.passportId === jpId; });
      var pending = tickets.filter(function(t){ return !(t.ppd && t.ppd.driveFolderUrl); });
      var existing = tickets.filter(function(t){ return t.ppd && t.ppd.driveFolderUrl; });
      // Provision missing + health-check existing
      var tasks = pending.map(function(t){ return window.MFXPPDService.provisionTicketFolders(t.id).catch(function(err){ console.warn('PPD folder provision:', err.message); return null; }); });
      var checks = existing.map(function(t){ return window.MFXPPDService.healthCheck(t.id).catch(function(){ return null; }); });
      return Promise.all(tasks.concat(checks));
    }
  };

  function withTemporaryGenerator(name, values, fn, args){
    var original = window[name];
    var queue = Array.isArray(values) ? values.slice() : [values];
    window[name] = function(){ return queue.length ? queue.shift() : (typeof original === 'function' ? original() : null); };
    return Promise.resolve().then(function(){ return fn.apply(window, args || []); }).finally(function(){ window[name] = original; });
  }

  function installWrappers(){
    if(typeof window.createSOFromPO === 'function' && !window.createSOFromPO.__mfxWrapped){
      var originalSO = window.createSOFromPO;
      window.createSOFromPO = function(){
        var args = arguments;
        return MFXApi.nextNumber('so', typeof window.genSONUM === 'function' ? window.genSONUM : null).then(function(num){
          return withTemporaryGenerator('genSONUM', num, originalSO, args);
        });
      };
      window.createSOFromPO.__mfxWrapped = true;
    }

    if(typeof window.createPassportFromSO === 'function' && !window.createPassportFromSO.__mfxWrapped){
      var originalJP = window.createPassportFromSO;
      window.createPassportFromSO = function(){
        var args = arguments;
        return MFXApi.nextNumber('jp', typeof window.genJPNum === 'function' ? window.genJPNum : null).then(function(num){
          return withTemporaryGenerator('genJPNum', num, originalJP, args);
        });
      };
      window.createPassportFromSO.__mfxWrapped = true;
    }

    if(typeof window.generateJobTickets === 'function' && !window.generateJobTickets.__mfxWrapped){
      var originalJT = window.generateJobTickets;
      window.generateJobTickets = function(jpId){
        var args = arguments;
        var jp = typeof getPassport === 'function' ? getPassport(jpId) : null;
        var count = Math.max(1, ((jp && jp.skus) || []).length || 1);
        var fallback = function(){
          var list = [];
          for(var i=0;i<count;i++) list.push(typeof window.genJTNum === 'function' ? window.genJTNum() : ('JT'+Date.now()+i));
          return list;
        };
        return MFXApi.nextNumbers('jt', count, fallback).then(function(nums){
          return withTemporaryGenerator('genJTNum', nums, originalJT, args);
        }).then(function(){
          setTimeout(function(){ window.MFXPPDService.provisionMissingForPassport(jpId); }, 1600);
        });
      };
      window.generateJobTickets.__mfxWrapped = true;
    }
  }

  onceReady(installWrappers);
})();
