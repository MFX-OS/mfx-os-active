'use strict';
// ══════════════════════════════════════════════════════════════
// MFX OS — Event Listeners & Post-Send Automation
// v2.0 — Drive operations routed to backend service account
// ══════════════════════════════════════════════════════════════

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// ─── quote.sent → save PDF to Drive via backend + update workflow UI ───
MFX.on('quote.sent', function(d) {
  if (!d || !d.quote) return;
  if(window._quoteSentProcessing) return;
  window._quoteSentProcessing = true;
  setTimeout(function(){ window._quoteSentProcessing = false; }, 10000);
  var q = d.quote;
  var pdf = d.pdf;
  var company = (q.fields && q.fields.custCo) || 'Unknown';

  // 1. Save PDF to Drive via backend (service account — no user token needed)
  setTimeout(function() {
    if (typeof MFX_API !== 'undefined' && MFX_API.postJSON) {
      MFX_API.postJSON('/api/saveQuotePDF', {
        quoteId: q.id,
        quoteNum: q.quoteNum,
        company: company,
        filename: pdf && pdf.filename ? pdf.filename : (typeof getQuoteFileName==='function' ? getQuoteFileName(q)+'.pdf' : q.quoteNum+'.pdf'),
        recipient: d.to || '',
        registryNote: 'Sent to ' + (d.to || 'client')
      }).then(function(result) {
        if (result && result.masterLink) {
          window._lastSentDriveLink = result.masterLink;
          toast('☁ PDF saved to Drive (server)', 'ok');
          // Update local cache
          var qq = typeof getQ === 'function' ? getQ(q.id) : null;
          if (qq) {
            if (!qq.workflow) qq.workflow = {};
            qq.workflow.driveSaved = true;
            qq.workflow.registryUpdated = true;
            qq.driveLink = result.masterLink;
            qq.clientFolderLink = result.clientLink;
            qq.driveSavedAt = new Date().toISOString();
            if (typeof DB !== 'undefined' && DB.saveQ) DB.saveQ(DB.quotes());
            if (typeof S !== 'undefined' && S.etab === 14 && typeof renderWorkflow === 'function') renderWorkflow();
          }
        }
      }).catch(function(err) {
        console.warn('Backend PDF save failed, attempting client fallback:', err.message);
        // Fallback to client-side Drive save if backend fails
        if (pdf && pdf.blob && d.token) {
          _clientSideDriveSave(q, pdf, d.token, company);
        } else {
          toast('Drive save failed — retry manually', 'err');
        }
      });
    } else if (pdf && pdf.blob && d.token) {
      // No backend available — use legacy client-side save
      _clientSideDriveSave(q, pdf, d.token, company);
    }
  }, 800);

  // 2. Auto registry update (client-side — Google Sheets direct)
  setTimeout(function() {
    if (typeof upsertRegistryRow === 'function') {
      upsertRegistryRow(q.id, 'Sent to ' + d.to);
      var qq = typeof getQ === 'function' ? getQ(q.id) : null;
      if (qq) {
        if (!qq.workflow) qq.workflow = {};
        qq.workflow.registryUpdated = true;
        if (typeof DB !== 'undefined' && DB.saveQ) DB.saveQ(DB.quotes());
        if (typeof S !== 'undefined' && S.etab === 14 && typeof renderWorkflow === 'function') renderWorkflow();
      }
    }
  }, 2500);
});

// ─── Client-side Drive save fallback (legacy path) ───
function _clientSideDriveSave(q, pdf, token, company) {
  if (typeof findOrCreateSharedFolder !== 'function') return;
  findOrCreateSharedFolder(token, 'MFX Master Quotes').then(function(folderId) {
    if (!folderId) { console.warn('[Drive] No folder found for save'); if(typeof toast==='function')toast('Drive folder not found — check shared drive access','err'); return; }
    var searchQ = "name contains '" + q.quoteNum + "' and trashed=false and '" + folderId + "' in parents";
    fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(searchQ) + '&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(r) { return r.json() }).then(function(sr) {
      var existId = (sr.files && sr.files.length) ? sr.files[0].id : null;
      var form = new FormData();
      var meta = { name: pdf.filename, mimeType: 'application/pdf' };
      if (!existId) meta.parents = [folderId];
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', pdf.blob, 'application/pdf');
      fetch(existId
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + existId + '?uploadType=multipart&supportsAllDrives=true'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: existId ? 'PATCH' : 'POST',
        headers: { 'Authorization': 'Bearer ' + token }, body: form
      }).then(function(r) { return r.json() }).then(function(fd) {
        if (fd.id) {
          var link = 'https://drive.google.com/file/d/' + fd.id;
          window._lastSentDriveLink = link;
          toast('☁ PDF saved to Master Quotes (client)', 'ok');
          var qq = typeof getQ === 'function' ? getQ(q.id) : null;
          if (qq) {
            if (!qq.workflow) qq.workflow = {};
            qq.workflow.driveSaved = true;
            qq.driveLink = link;
            qq.driveSavedAt = new Date().toISOString();
            if (typeof DB !== 'undefined' && DB.saveQ) DB.saveQ(DB.quotes());
          }
        }
      }).catch(function(e) { console.error('Drive save error:', e); toast('Drive save failed', 'err'); });
    }).catch(function(e) { console.error('Drive save error:', e); toast('Drive save failed', 'err'); });
  }).catch(function(e) { console.error('Drive save error:', e); toast('Drive save failed', 'err'); });
}

// ─── Watch ALL quote changes from Firestore (portal file uploads, PO submissions) ───
// Portal sync stays client-side for real-time UX, but authoritative transitions
// go through transitionStatus server endpoint
if (typeof fbDb !== 'undefined') {
  var _portalSyncReady = false;
  var _driveQuoteUnsub = fbDb.collection('quotes')
    .onSnapshot(function(snap) {
      if (!_portalSyncReady) { _portalSyncReady = true; return; }
      snap.docChanges().forEach(function(change) {
        if (change.type !== 'modified') return;
        var fsDoc = change.doc.data();
        var qid = change.doc.id;

        if (typeof S === 'undefined' || S.editId !== qid) return;

        var localQ = typeof DB !== 'undefined' && DB.quotes ? DB.quotes().find(function(q) { return q.id === qid }) : null;
        if (!localQ) return;

        var changed = false;

        // Sync poFiles from portal
        if (fsDoc.poFiles && fsDoc.poFiles.length && JSON.stringify(fsDoc.poFiles) !== JSON.stringify(localQ.poFiles)) {
          localQ.poFiles = fsDoc.poFiles;
          changed = true;
          console.log('📎 PO files synced:', fsDoc.poFiles.length, 'files');
        }

        // Sync artFiles from portal
        if (fsDoc.artFiles && fsDoc.artFiles.length && JSON.stringify(fsDoc.artFiles) !== JSON.stringify(localQ.artFiles)) {
          localQ.artFiles = fsDoc.artFiles;
          changed = true;
          console.log('🎨 Art files synced:', fsDoc.artFiles.length, 'files');
        }

        // Sync PO data from portal
        if (fsDoc.poNumber && !localQ.poNumber) {
          localQ.poNumber = fsDoc.poNumber;
          localQ.poSignature = fsDoc.poSignature || '';
          localQ.poSignedAt = fsDoc.poSignedAt || '';
          localQ.poClientEmail = fsDoc.poClientEmail || '';
          localQ.poInstructions = fsDoc.poInstructions || '';
          localQ.poShipTo = fsDoc.poShipTo || '';
          changed = true;
          console.log('📋 PO data synced: PO#', fsDoc.poNumber);
          toast('🎉 Client submitted PO#' + fsDoc.poNumber + '!', 'ok');
        }

        // Sync status change from portal — use server transition for 'won'
        if (fsDoc.status === 'won' && localQ.status !== 'won') {
          // Route authoritative transition through server
          if (typeof MFX_API !== 'undefined' && MFX_API.postJSON) {
            MFX_API.postJSON('/api/transitionStatus', {
              collection: 'quotes',
              docId: qid,
              newStatus: 'won',
              note: 'Won via client portal PO submission'
            }).then(function() {
              localQ.status = 'won';
              localQ.closedAt = new Date().toISOString();
              localQ.wonDate = new Date().toISOString();
              if (typeof DB !== 'undefined' && DB.saveQ) DB.saveQ(DB.quotes());
              toast('🎉 Quote ' + localQ.quoteNum + ' → WON!', 'ok');
              if (typeof renderWorkflow === 'function') renderWorkflow();
            }).catch(function(err) {
              // Fallback: accept the Firestore value directly
              console.warn('Server transition failed, accepting Firestore value:', err.message);
              localQ.status = 'won';
              localQ.closedAt = new Date().toISOString();
              changed = true;
            });
          } else {
            localQ.status = 'won';
            localQ.closedAt = new Date().toISOString();
            localQ.wonDate = new Date().toISOString();
            changed = true;
            toast('🎉 Quote ' + localQ.quoteNum + ' → WON!', 'ok');
          }
        }

        if (changed) {
          if (typeof DB !== 'undefined' && DB.saveQ) DB.saveQ(DB.quotes());
          if (typeof S !== 'undefined' && S.view === 'editor' && S.etab === 14) {
            if (typeof renderWorkflow === 'function') renderWorkflow();
            if (typeof renderConnections === 'function') renderConnections();
          }
          if (typeof S !== 'undefined' && S.view === 'editor' && typeof renderActivityLog === 'function') renderActivityLog();
        }
      });
    }, function(err){ console.warn('drive-listener listener:', err.message); });
}

// ─── so.approved → auto-create Job Passport + Job Tickets + provision PPD folders ───
// Prefer the client-side path because it populates SKUs, auto-confirms, generates
// tickets, and calls provisionPPDWorkspace. Backend createPassport is kept as a
// fallback (it creates the passport doc but no tickets).
MFX.on('so.approved', function(d) {
  if (!d || !d.soId) return;
  // Guard against double-fires (event bus + manual trigger)
  if (window._passportCreationInFlight && window._passportCreationInFlight[d.soId]) return;
  window._passportCreationInFlight = window._passportCreationInFlight || {};
  window._passportCreationInFlight[d.soId] = true;
  setTimeout(function(){ delete window._passportCreationInFlight[d.soId]; }, 15000);

  setTimeout(function() {
    if (typeof createPassportFromSO === 'function') {
      try {
        createPassportFromSO(d.soId, { autoTickets: true });
      } catch (err) {
        console.warn('createPassportFromSO failed, trying backend:', err && err.message);
        if (typeof MFX_API !== 'undefined' && MFX_API.postJSON) {
          MFX_API.postJSON('/api/createPassport', { soId: d.soId }).then(function(result) {
            if (result && result.jpNum && typeof toast === 'function') {
              toast('📋 Job Passport ' + result.jpNum + ' created', 'ok');
            }
            if (result && typeof MFX !== 'undefined' && MFX.emit) {
              MFX.emit('passport.created', { passportId: result.passportId, jpNum: result.jpNum, soId: d.soId });
            }
          }).catch(function(e){ console.warn('Backend createPassport failed:', e.message); });
        }
      }
    } else if (typeof MFX_API !== 'undefined' && MFX_API.postJSON) {
      MFX_API.postJSON('/api/createPassport', { soId: d.soId }).then(function(result) {
        if (result && result.jpNum && typeof toast === 'function') {
          toast('📋 Job Passport ' + result.jpNum + ' created', 'ok');
        }
      }).catch(function(e){ console.warn('Backend createPassport failed:', e.message); });
    }
  }, 1200);
});

// Store unsub for cleanup on logout
if(typeof _driveQuoteUnsub==='function'){
  if(typeof MFX_LISTENERS!=='undefined') MFX_LISTENERS._driveQuoteSync=_driveQuoteUnsub;
}
console.log('✅ Event listeners v2 loaded — Drive ops routed to backend');
