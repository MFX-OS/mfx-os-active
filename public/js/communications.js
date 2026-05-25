// MFX OS Communications Hub - per-quote unified composer + timeline + status bar
// 2026-05-24 v2: auto-internal always, datalist dropdowns, status bar
// Routes through existing _doSendWithOverride for actual Gmail/PDF/Drive plumbing.

(function(){
  'use strict';
  var MFX_COMMS = {};
  window.MFX_COMMS = MFX_COMMS;

  var state = { qid: null, template: 'portal', lastSend: null };

  function esc(s){
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function userName(){ return (typeof getUserName === 'function') ? getUserName() : 'MFX User'; }
  function userEmail(){ return (typeof getUserEmail === 'function') ? getUserEmail() : ''; }

  // Team + common addresses (centralized — easy to maintain)
  var TEAM_EMAILS = [
    { email: 'quotes@microflexfilm.com',  label: 'Quotes (BCC default)' },
    { email: 'sales@microflexfilm.com',   label: 'Sales team' },
    { email: 'team@microflexfilm.com',    label: 'Whole team' },
    { email: 'ceo@microflexfilm.com',     label: 'CEO' },
    { email: 'ops@microflexfilm.com',     label: 'Operations' },
    { email: 'accounting@microflexfilm.com', label: 'Accounting' }
  ];

  MFX_COMMS.TEMPLATES = {
    portal: {
      label: 'Portal Invite',
      attachPDF: false,
      build: function(q){
        var qn = q.quoteNum || '';
        var co = (q.fields && q.fields.custCo) || '';
        var nm = (q.fields && q.fields.custAttn) || 'there';
        var link = 'https://os.microflexfilm.com/portal?id=' + q.id + '&q=' + encodeURIComponent(qn);
        return {
          to: (q.fields && q.fields.custEmail) || '',
          from: '', cc: '', bcc: 'quotes@microflexfilm.com',
          subject: 'Microflex - Your quote ' + qn + ' is ready to view',
          body: 'Hi ' + nm + ',\n\nYour quote ' + qn + ' for ' + co + ' is ready in our online portal.\n\nUse the link below to view pricing, upload artwork, chat with us, and submit your PO:\n' + link + '\n\nLet me know if you have any questions.\n\nThanks,\n' + userName()
        };
      }
    },
    quote: {
      label: 'Quote Email with PDF',
      attachPDF: true,
      build: function(q){
        var qn = q.quoteNum || '';
        var co = (q.fields && q.fields.custCo) || '';
        var nm = (q.fields && q.fields.custAttn) || 'there';
        return {
          to: (q.fields && q.fields.custEmail) || '',
          from: '', cc: '', bcc: 'quotes@microflexfilm.com',
          subject: 'Microflex Quote ' + qn + (q.rev && q.rev !== 'A' ? ' Rev ' + q.rev : '') + ' - ' + co,
          body: 'Hi ' + nm + ',\n\nPlease find attached our quote ' + qn + ' for ' + co + '.\n\nYou can also view, approve, and submit your PO online through our portal - link in the email below.\n\nLead time is 15 working days from proof sign-off. Quantities ship +/- 10% of order.\n\nLet me know if you would like any adjustments.\n\nThanks,\n' + userName()
        };
      }
    },
    revision: {
      label: 'Revision Notice',
      attachPDF: true,
      build: function(q){
        var qn = q.quoteNum || '';
        var co = (q.fields && q.fields.custCo) || '';
        var nm = (q.fields && q.fields.custAttn) || 'there';
        var rev = q.rev || 'A';
        return {
          to: (q.fields && q.fields.custEmail) || '',
          from: '', cc: '', bcc: 'quotes@microflexfilm.com',
          subject: 'Microflex Quote ' + qn + ' Rev ' + rev + ' - REVISED',
          body: 'Hi ' + nm + ',\n\nWe have revised your quote ' + qn + ' (now Rev ' + rev + ') for ' + co + '.\n\nPlease review the updated pricing and specs in the attached PDF.\n\nLet me know if the revision works for you.\n\nThanks,\n' + userName()
        };
      }
    },
    internal_ready: {
      label: 'Internal Only: Ready to Send',
      attachPDF: false,
      internalOnly: true,
      build: function(q){
        var qn = q.quoteNum || '';
        var co = (q.fields && q.fields.custCo) || '';
        return {
          to: 'team@microflexfilm.com',
          from: '', cc: '', bcc: '',
          subject: '[Internal] ' + qn + ' (' + co + ') ready to send to client',
          body: 'Quote ' + qn + ' Rev ' + (q.rev||'A') + ' for ' + co + ' is READY.\n\nPrepared by: ' + userName() + '\nEstimator: ' + ((q.fields && q.fields.estimator) || '-') + '\nCustomer contact: ' + ((q.fields && q.fields.custAttn) || '-') + ' <' + ((q.fields && q.fields.custEmail) || '-') + '>\n\nPlease review.'
        };
      }
    }
  };

  function applyTemplate(tplKey, q){
    var tpl = MFX_COMMS.TEMPLATES[tplKey];
    if (!tpl || !q) return;
    var d = tpl.build(q);
    var setF = function(id, v){ var el = document.getElementById(id); if(el) el.value = v == null ? '' : v; };
    setF('comms-to', d.to);
    setF('comms-from', d.from);
    setF('comms-cc', d.cc);
    setF('comms-bcc', d.bcc);
    setF('comms-subject', d.subject);
    setF('comms-body', d.body);
    var att = document.getElementById('comms-attach-pdf');
    if (att) att.checked = !!tpl.attachPDF;
  }
  MFX_COMMS.applyTemplate = applyTemplate;

  function statusBadge(st){
    var colors = { draft:'#64748b', ready:'#0ea5e9', sent:'#16a34a', won:'#16a34a', lost:'#dc2626', rejected:'#dc2626', approval:'#a855f7' };
    var labels = { draft:'DRAFT', ready:'READY TO SEND', sent:'SENT', won:'WON', lost:'LOST', rejected:'REJECTED', approval:'PENDING' };
    var c = colors[st] || '#64748b';
    var lbl = labels[st] || (st || '').toUpperCase();
    return '<span style="font-size:10px;font-weight:800;letter-spacing:1px;padding:5px 10px;border-radius:999px;background:' + c + '20;color:' + c + ';border:1px solid ' + c + '">' + lbl + '</span>';
  }

  function renderStatusBar(q){
    var st = q.status || 'draft';
    var lastNote = '';
    var lastWhen = '';
    var lastTo = '';
    var lastKind = '';
    // Find most-recent comm from internalNotes (quick local source; full sources in timeline)
    if (Array.isArray(q.internalNotes)) {
      for (var i = q.internalNotes.length - 1; i >= 0; i--) {
        var n = q.internalNotes[i];
        if (n && n.text && (n.text.indexOf('Emailed') >= 0 || n.text.indexOf('Sent') >= 0 || n.text.indexOf('email') >= 0)) {
          lastNote = n.text;
          lastWhen = n.at ? new Date(n.at).toLocaleString() : '';
          break;
        }
      }
    }
    var h = '';
    // ── Top bar with quote info + status badge
    h += '<div style="padding:12px 14px;background:var(--srf);border:1px solid var(--bdr);border-radius:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px">';
    h += '<div><div style="font-size:14px;font-weight:700;color:var(--tx)">' + esc(q.quoteNum||'') + ' &middot; Rev ' + esc(q.rev||'A') + '</div>';
    h += '<div style="font-size:11px;color:var(--tx3);margin-top:2px">' + esc((q.fields && q.fields.custCo) || '-') + (q.fields && q.fields.custAttn ? ' &middot; ' + esc(q.fields.custAttn) : '') + '</div></div>';
    h += statusBadge(st) + '</div>';
    // ── Communications status bar (state-of-the-world for this quote)
    var emailGuardOn = window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.isBlocked();
    var indicatorColor = emailGuardOn ? '#dc2626' : (lastNote ? '#16a34a' : '#64748b');
    var indicatorLabel = emailGuardOn ? 'EMAILS BLOCKED' : (lastNote ? 'COMMS ACTIVE' : 'NO COMMS YET');
    h += '<div style="padding:10px 14px;background:linear-gradient(135deg,var(--bg3) 0%,var(--srf) 100%);border:1px solid var(--bdr);border-left:3px solid ' + indicatorColor + ';border-radius:8px;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">';
    h += '<div style="font-size:10px;font-weight:800;letter-spacing:1px;color:' + indicatorColor + '">' + indicatorLabel + '</div>';
    if (lastNote) {
      h += '<button onclick="MFX_COMMS.resendLast()" style="font-size:10px;font-weight:700;background:var(--ac);color:#000;border:none;padding:4px 10px;border-radius:6px;cursor:pointer">&#8635; Resend</button>';
    }
    h += '</div>';
    if (lastNote) {
      h += '<div style="font-size:11px;color:var(--tx2);line-height:1.4">' + esc(lastNote.substring(0, 140)) + (lastNote.length > 140 ? '&hellip;' : '') + '</div>';
      if (lastWhen) h += '<div style="font-size:10px;color:var(--tx3);margin-top:3px">' + esc(lastWhen) + '</div>';
    } else {
      h += '<div style="font-size:11px;color:var(--tx3)">No emails sent yet. Use the composer below.</div>';
    }
    h += '</div>';
    // ── Draft nudge
    if (st === 'draft') {
      h += '<div style="padding:10px 12px;background:rgba(14,165,233,.08);border:1px solid rgba(14,165,233,.3);border-radius:8px;margin-bottom:14px;font-size:11px;color:#7dd3fc">';
      h += '&#128161; DRAFT status &mdash; you can send anyway, or <a onclick="markReadyDirect(\'' + q.id + '\')" style="color:#0ea5e9;cursor:pointer;text-decoration:underline">mark Ready first</a>.</div>';
    }
    return h;
  }

  // Build datalist options from quote + team data
  function buildAddressOptions(q){
    var custEmail = (q.fields && q.fields.custEmail) || '';
    var custAttn  = (q.fields && q.fields.custAttn)  || '';
    var custCo    = (q.fields && q.fields.custCo)    || '';
    var me        = userEmail();
    var meName    = userName();
    var estimator = (q.fields && q.fields.estimator) || '';
    var salesRep  = (q.fields && q.fields.salesRep)  || '';
    var createdBy = q.createdBy || '';
    var lists = {
      to: [], from: [], cc: [], bcc: []
    };
    if (custEmail) {
      lists.to.push({ value: custEmail, label: 'Customer: ' + (custAttn || custCo) });
      lists.cc.push({ value: custEmail, label: 'Customer: ' + (custAttn || custCo) });
    }
    if (me) {
      lists.from.push({ value: me, label: 'You (' + meName + ')' });
      lists.cc.push({ value: me, label: 'You (' + meName + ')' });
    }
    for (var i = 0; i < TEAM_EMAILS.length; i++) {
      var t = TEAM_EMAILS[i];
      lists.from.push({ value: t.email, label: t.label });
      lists.cc.push({ value: t.email, label: t.label });
      lists.bcc.push({ value: t.email, label: t.label });
    }
    if (createdBy && createdBy !== meName) {
      lists.cc.push({ value: '', label: 'Creator: ' + createdBy + ' (no email on file)' });
    }
    return lists;
  }

  function datalistHTML(id, opts){
    var h = '<datalist id="' + id + '">';
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value) {
        h += '<option value="' + esc(opts[i].value) + '">' + esc(opts[i].label) + '</option>';
      }
    }
    h += '</datalist>';
    return h;
  }

  function renderComposer(q){
    var keys = Object.keys(MFX_COMMS.TEMPLATES);
    var opts = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      opts += '<option value="' + k + '"' + (k === state.template ? ' selected' : '') + '>' + esc(MFX_COMMS.TEMPLATES[k].label) + '</option>';
    }
    var addr = buildAddressOptions(q);
    var inp = 'width:100%;padding:8px 10px;border:1px solid var(--bdr);border-radius:6px;background:var(--inp);color:var(--tx);font-size:12px;box-sizing:border-box';
    var lab = 'font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;display:block;margin-bottom:4px';

    var h = '<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:10px;padding:14px;margin-bottom:14px">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:10px">COMPOSE</div>';

    // Template selector
    h += '<div style="margin-bottom:10px"><label style="' + lab + '">Template</label><select id="comms-template" style="' + inp + '">' + opts + '</select></div>';

    // Workflow notice — Process always runs internal-only; Send Email is OPTIONAL
    h += '<div style="padding:8px 10px;margin-bottom:10px;background:rgba(14,165,233,.08);border:1px solid rgba(14,165,233,.25);border-radius:6px;font-size:11px;color:#7dd3fc">';
    h += '<strong>&#9881;&#65039; Workflow:</strong> <em>Process</em> generates PDF, saves to Drive, updates registry &amp; portal, and notifies the team &mdash; <strong>no customer email</strong>. <em>Send Email</em> is optional and can be done any time after.';
    h += '</div>';

    // To
    h += '<div style="margin-bottom:8px"><label style="' + lab + '">To</label>';
    h += '<input id="comms-to" list="opts-to" placeholder="recipient@example.com" style="' + inp + '">';
    h += datalistHTML('opts-to', addr.to) + '</div>';

    // From
    h += '<div style="margin-bottom:8px"><label style="' + lab + '">From (leave blank for default)</label>';
    h += '<input id="comms-from" list="opts-from" placeholder="default Gmail account" style="' + inp + '">';
    h += datalistHTML('opts-from', addr.from) + '</div>';

    // CC / BCC row
    h += '<div style="display:flex;gap:8px;margin-bottom:8px">';
    h += '<div style="flex:1"><label style="' + lab + '">CC</label>';
    h += '<input id="comms-cc" list="opts-cc" style="' + inp + '">';
    h += datalistHTML('opts-cc', addr.cc) + '</div>';
    h += '<div style="flex:1"><label style="' + lab + '">BCC</label>';
    h += '<input id="comms-bcc" list="opts-bcc" style="' + inp + '">';
    h += datalistHTML('opts-bcc', addr.bcc) + '</div></div>';

    // Subject
    h += '<div style="margin-bottom:8px"><label style="' + lab + '">Subject</label><input id="comms-subject" style="' + inp + '"></div>';

    // Body
    h += '<div style="margin-bottom:10px"><label style="' + lab + '">Message</label><textarea id="comms-body" rows="10" style="' + inp + ';resize:vertical;font-family:inherit;line-height:1.5"></textarea></div>';

    // Attach PDF
    h += '<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--tx2)"><input type="checkbox" id="comms-attach-pdf" style="cursor:pointer"> &#128206; Attach quote PDF (regenerates on send)</div>';

    // Action buttons - Process (primary, no email) and Send Email (optional)
    h += '<div style="display:flex;flex-direction:column;gap:8px">';
    h += '<button onclick="MFX_COMMS.process()" style="width:100%;padding:14px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;border-radius:10px;cursor:pointer">&#9881;&#65039; Process &mdash; PDF + Drive + Registry + Portal + Internal Notify</button>';
    h += '<div style="display:flex;gap:8px">';
    h += '<button onclick="MFX_COMMS.send()" style="flex:2;padding:12px;font-size:12px;font-weight:600;background:var(--bg3);color:var(--ac);border:1px solid var(--ac);border-radius:10px;cursor:pointer">&#9993;&#65039; Send Email to Client (optional)</button>';
    h += '<button onclick="MFX_COMMS.sendInternalOnly()" style="flex:1;padding:12px;font-size:11px;font-weight:600;background:var(--bg3);color:var(--tx2);border:1px solid var(--bdr);border-radius:10px;cursor:pointer">&#127970; Note Team</button>';
    h += '</div></div>';

    h += '</div>';
    return h;
  }

  function renderTimeline(q){
    return '<div style="background:var(--srf);border:1px solid var(--bdr);border-radius:10px;padding:14px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:10px">COMMUNICATIONS HISTORY</div>' +
      '<div id="comms-timeline-list" style="font-size:11px;color:var(--tx3)">Loading...</div></div>';
  }

  function loadTimeline(qid){
    var el = document.getElementById('comms-timeline-list');
    if (!el) return;
    var items = [];
    var q = (typeof getQ === 'function') ? getQ(qid) : null;
    if (q && Array.isArray(q.internalNotes)) {
      q.internalNotes.forEach(function(n){
        items.push({ at: n.at, type: 'note', by: n.by, text: n.text, kind: 'Internal Note' });
      });
    }
    if (!window.fbDb) { renderItems(el, items); return; }
    var p1 = window.fbDb.collection('quotes').doc(qid).collection('quoteComms').orderBy('at','desc').limit(50).get()
      .then(function(snap){
        snap.forEach(function(d){
          var x = d.data();
          items.push({ at: x.at, type: x.type || 'email', by: x.by || '-', text: (x.subject || '') + ' -> ' + (x.to || ''), kind: x.kind || 'Email Sent', target: x.target });
        });
      }).catch(function(e){ console.warn('quoteComms:', e.message); });
    var p2 = window.fbDb.collection('quotes').doc(qid).collection('portalMessages').orderBy('timestamp','desc').limit(50).get()
      .then(function(snap){
        snap.forEach(function(d){
          var x = d.data();
          var when = x.timestamp && x.timestamp.toDate ? x.timestamp.toDate().toISOString() : (x.timestamp || '');
          items.push({ at: when, type: 'portal', by: x.name || x.sender || x.from || 'Customer', text: x.text || x.message || '', kind: 'Portal Chat' });
        });
      }).catch(function(e){ console.warn('portalMessages:', e.message); });
    Promise.all([p1, p2]).then(function(){ renderItems(el, items); });
  }

  function renderItems(el, items){
    items.sort(function(a,b){ return (new Date(b.at||0)) - (new Date(a.at||0)); });
    if (!items.length) { el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--tx3)">No communications yet</div>'; return; }
    var iconFor = { 'Email Sent':'&#9993;&#65039;', 'Portal Chat':'&#128172;', 'Internal Note':'&#128221;', 'BLOCKED (kill-switch on)':'&#128683;' };
    var h = '';
    items.forEach(function(it){
      var icon = iconFor[it.kind] || '&#8226;';
      var when = it.at ? new Date(it.at).toLocaleString() : '-';
      h += '<div style="padding:10px 0;border-bottom:1px solid var(--bdr)">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      h += '<span style="font-size:11px;font-weight:700;color:var(--tx)">' + icon + ' ' + esc(it.kind) + (it.target ? ' &rarr; ' + esc(it.target) : '') + '</span>';
      h += '<span style="font-size:10px;color:var(--tx3)">' + esc(when) + '</span></div>';
      h += '<div style="font-size:11px;color:var(--tx2);line-height:1.4">' + esc((it.text || '').substring(0, 200)) + ((it.text||'').length > 200 ? '&hellip;' : '') + '</div>';
      h += '<div style="font-size:9px;color:var(--tx3);margin-top:3px">by ' + esc(it.by || '-') + '</div></div>';
    });
    el.innerHTML = h;
  }
  MFX_COMMS.loadTimeline = loadTimeline;

  function logComm(qid, payload){
    var p = Object.assign({ at: new Date().toISOString(), by: userName() }, payload);
    if (window.fbDb) {
      window.fbDb.collection('quotes').doc(qid).collection('quoteComms').add(p)
        .catch(function(e){ console.warn('logComm:', e.message); });
    }
    if (window.DB && typeof window.DB.logActivity === 'function') {
      var label = (p.kind || 'comm') + ': ' + (p.subject || '') + ' -> ' + (p.to || '');
      window.DB.logActivity('quote.comm', label);
    }
  }
  MFX_COMMS.logComm = logComm;

  function readComposer(){
    return {
      to:      (document.getElementById('comms-to')||{}).value || '',
      from:    (document.getElementById('comms-from')||{}).value || '',
      cc:      (document.getElementById('comms-cc')||{}).value || '',
      bcc:     (document.getElementById('comms-bcc')||{}).value || '',
      subject: (document.getElementById('comms-subject')||{}).value || '',
      body:    (document.getElementById('comms-body')||{}).value || '',
      attach:  !!(document.getElementById('comms-attach-pdf')||{}).checked
    };
  }

  function validEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||'').trim()); }


  // Process: generate PDF, save to Drive, update registry, sync portal,
  // notify team internally. Does NOT send a client email. Can be re-run any
  // time. Send Email can be fired separately, before OR after, in any order.
  MFX_COMMS.process = function(){
    var qid = state.qid;
    if (!qid) return toast('No quote loaded', 'err');
    var q = getQ(qid);
    if (!q) return toast('Quote not found', 'err');
    var c = readComposer();
    toast('Processing quote: generating PDF, syncing Drive...', 'ok');
    // 1) Save to Drive (existing function handles PDF gen + Drive upload + registry + activity log)
    if (typeof window.saveQuoteToDrive === 'function') {
      try { window.saveQuoteToDrive(); }
      catch (e) { console.warn('process saveQuoteToDrive:', e.message); }
    }
    // 2) Update workflow flags so other tabs reflect processed state
    q.workflow = q.workflow || {};
    q.workflow.processed = true;
    q.workflow.processedAt = new Date().toISOString();
    q.workflow.processedBy = userName();
    q.workflow.pdfReady = true;
    q.workflow.registryUpdated = true;
    q.workflow.portalReady = true;
    // 3) Log to quoteComms subcollection so it shows in the timeline
    logComm(qid, {
      kind: 'Processed (no email)',
      type: 'process',
      to: '(internal only)',
      from: userEmail(),
      subject: 'Processed: ' + (q.quoteNum || ''),
      body: 'Quote processed: PDF generated and saved to MFX Master Quotes on Drive, registry updated, portal data synced. Customer email NOT sent.',
      target: 'internal'
    });
    // 4) Fire internal notification (silent fire-and-forget)
    MFX_COMMS._fireInternalNotification(q, c, { source: 'process' });
    // 5) Persist workflow updates
    try {
      var all = (typeof DB !== 'undefined' && DB.quotes) ? DB.quotes() : null;
      if (all && typeof DB.saveQ === 'function') DB.saveQ(all, q.id);
    } catch (e) { console.warn('process saveQ:', e.message); }
    // 6) Emit event for downstream listeners (drive-listener, etc.)
    if (window.MFX && typeof window.MFX.emit === 'function') {
      try { window.MFX.emit('quote.processed', { quote: q, by: userName() }); } catch (e) {}
    }
    // 7) Refresh UI shortly so user sees status bar + timeline update
    setTimeout(function(){
      MFX_COMMS.loadTimeline(qid);
      // Soft re-render of the status bar only (keep composer state)
      if (typeof MFX_COMMS.renderPane === 'function') {
        // Re-render whole pane so the status bar reflects the new state
        MFX_COMMS.renderPane(qid);
      }
    }, 1200);
  };

  // Send to client, then auto-fire-and-forget internal notification
  MFX_COMMS.send = function(){
    var qid = state.qid;
    if (!qid) return toast('No quote loaded', 'err');
    var q = getQ(qid);
    if (!q) return toast('Quote not found', 'err');
    var c = readComposer();
    if (!c.to) return toast('To: address required', 'err');
    if (!validEmail(c.to.split(',')[0])) return toast('Invalid To: ' + c.to, 'err');

    // Email guard short-circuit (logs the attempt so user sees what was blocked)
    if (window.MFX_EMAIL_GUARD && window.MFX_EMAIL_GUARD.isBlocked()) {
      logComm(qid, { kind: 'BLOCKED (kill-switch on)', type: 'email', to: c.to, from: c.from, cc: c.cc, bcc: c.bcc, subject: c.subject, body: c.body, target: 'client', attach: c.attach, blocked: true });
      window.MFX_EMAIL_GUARD.blockIfDisabled('MFX_COMMS.send', c.to);
      setTimeout(function(){ MFX_COMMS.loadTimeline(qid); }, 300);
      return;
    }

    state.lastSend = { c: c, target: 'client', at: Date.now() };
    // 1) Send to client
    window._sendOverride = { to: c.to, from: c.from || '', cc: c.cc, bcc: c.bcc || '', subject: c.subject, body: c.body };
    logComm(qid, { kind: 'Email Sent (Client)', type: 'email', to: c.to, from: c.from, cc: c.cc, bcc: c.bcc, subject: c.subject, body: c.body, target: 'client', attachPDF: c.attach });
    if (typeof _doSendWithOverride === 'function') {
      _doSendWithOverride();
    } else {
      toast('Send helper missing - refresh page', 'err');
      return;
    }
    // 2) Auto-internal team ping (silent, fire-and-forget)
    setTimeout(function(){
      MFX_COMMS._fireInternalNotification(q, c);
      MFX_COMMS.loadTimeline(qid);
      // Re-render status bar to show latest
      var pane = document.getElementById('sendPaneContent');
      if (pane && typeof MFX_COMMS.renderPane === 'function') {
        // Soft refresh: just update the status bar without rebuilding composer
        var sbMount = document.querySelector('#sendPaneContent > div:first-child');
      }
    }, 1500);
  };

  // Internal-only path: no client send, just team notification
  MFX_COMMS.sendInternalOnly = function(){
    var qid = state.qid;
    if (!qid) return toast('No quote loaded', 'err');
    var q = getQ(qid);
    if (!q) return toast('Quote not found', 'err');
    var c = readComposer();
    MFX_COMMS._fireInternalNotification(q, c, { source: 'manual' });
    toast('Internal team notified', 'ok');
    setTimeout(function(){ MFX_COMMS.loadTimeline(qid); }, 500);
  };

  // Auto-internal: posts via notifyTeam if available, falls back to log+toast
  MFX_COMMS._fireInternalNotification = function(q, c, opts){
    opts = opts || {};
    var qn = q.quoteNum || '';
    var co = (q.fields && q.fields.custCo) || '-';
    var who = userName();
    var summary = '[' + qn + '] ' + (c.subject || 'email sent') + ' to ' + (c.to || '-') + ' by ' + who + (opts.source === 'manual' ? ' (internal-only)' : '');
    if (typeof window.notifyTeam === 'function') {
      try { window.notifyTeam('&#9993; ' + summary); } catch (e) { console.warn('notifyTeam:', e.message); }
    }
    logComm(q.id, { kind: 'Internal Notification', type: 'internal', to: 'team@microflexfilm.com', subject: 'auto-notify: ' + (c.subject || ''), body: summary, target: 'internal', auto: !opts.source });
  };

  // Resend the last send (re-runs with same composer state)
  MFX_COMMS.resendLast = function(){
    if (!state.lastSend) {
      toast('No previous send to resend', 'err');
      return;
    }
    if (!confirm('Resend last email to ' + (state.lastSend.c.to || '?') + '?')) return;
    MFX_COMMS.send();
  };

  // ENTRY POINT used by modules.js delegate
  MFX_COMMS.renderPane = function(qid){
    var el = document.getElementById('sendPaneContent');
    if (!el) return;
    var q = (typeof getQ === 'function') ? getQ(qid || (window.S && S.editId)) : null;
    if (!q) { el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--tx3)">No quote loaded</div>'; return; }
    state.qid = q.id;
    if (q.rev && q.rev !== 'A') state.template = 'revision';
    else if (q.status === 'ready' || q.status === 'sent') state.template = 'quote';
    else state.template = 'portal';
    el.innerHTML = renderStatusBar(q) + renderComposer(q) + renderTimeline(q);
    var sel = document.getElementById('comms-template');
    if (sel) sel.onchange = function(){ state.template = sel.value; applyTemplate(state.template, q); };
    applyTemplate(state.template, q);
    loadTimeline(q.id);
  };

})();
