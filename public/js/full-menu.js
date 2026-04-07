/* ======================================================================
   MFX OS — Full Hamburger Menu Builder
   Unlocked via password "2057". Returns complete colored department HTML.
   ====================================================================== */

window._buildFullHamMenu = function _buildFullHamMenu() {
  var h = '';

  /* ── 1. Job Ticket Tracker ─────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-jt\').style.display!==\'none\'){goView(\'dept-jt-home\');toggleHamburger();}else{hamToggleSec(\'jt\');}" style="background:linear-gradient(135deg,#0a1e2e,#0c3347);border:1px solid #00e5ff30;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #00e5ff10">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#fff;text-shadow:0 0 10px #00e5ff40;flex:1;letter-spacing:.5px">Job Ticket Tracker</span><span id="hamArr-jt" style="font-size:9px;color:#00e5ff60;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-jt" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="openJTDailyDash();toggleHamburger()" style="color:#00e5ff;font-weight:700"><span class="hi-ico" style="color:#00e5ff"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';
  h += '</div></div>';

  /* ── 2. Client Services ────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-cs\').style.display!==\'none\'){goView(\'dept-cs-home\');toggleHamburger();}else{hamToggleSec(\'cs\');}" style="background:linear-gradient(135deg,#1a0e2e,#2d1654);border:1px solid #a855f730;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #a855f710">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#a855f7;text-shadow:0 0 10px #a855f740;flex:1;letter-spacing:.5px">Client Services</span><span id="hamArr-cs" style="font-size:9px;color:#a855f760;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-cs" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'clientservices\');toggleHamburger()"><span class="hi-ico" style="color:#a855f7"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';

  // Sales
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-sl\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-sl\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#c084fc;flex:1">Sales</span>';
  h += '<span id="hamArr-sl" style="font-size:9px;color:#c084fc60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-sl" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'customers\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>Clients / Accounts</div>';
  h += '<div class="ham-item" onclick="goView(\'customers\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>Account Health</div>';
  h += '<div class="ham-item" onclick="goView(\'sales\');if(typeof setSalesTab===\'function\')setSalesTab(\'pipeline\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>Deals</div>';
  h += '</div>';

  // Estimation
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-est\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-est\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M10 4v16"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#c084fc;flex:1">Estimation</span>';
  h += '<span id="hamArr-est" style="font-size:9px;color:#c084fc60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-est" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'quotes\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>Quotes</div>';
  h += '</div>';

  // CSR / Account Mgmt
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-csr\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-csr\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#c084fc;flex:1">CSR / Account Mgmt</span>';
  h += '<span id="hamArr-csr" style="font-size:9px;color:#c084fc60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-csr" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'orders\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>Active Orders</div>';
  h += '<div class="ham-item" onclick="goView(\'jobtracker\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>Job Lifecycle</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>Blueprint Library</div>';
  h += '</div>';

  // Incoming Requests
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-rq\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-rq\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#c084fc;flex:1">Incoming Requests</span>';
  h += '<span id="hamArr-rq" style="font-size:9px;color:#c084fc60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-rq" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span>Status</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>Quote Requests</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></span>Samples</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg></span>Design</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/></svg></span>Engineering</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>Quality</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>R&amp;D</div>';
  h += '<div class="ham-item" onclick="openRFQInbox();toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>Escalation</div>';
  h += '</div>';

  // Escalation
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-esc\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-esc\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#c084fc;flex:1">Escalation</span>';
  h += '<span id="hamArr-esc" style="font-size:9px;color:#c084fc60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-esc" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>Corrections</div>';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></span>Revisions</div>';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#c084fc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Complaints</div>';
  h += '</div>';

  h += '</div></div>';

  /* ── 3. Pre-Press ──────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-pp\').style.display!==\'none\'){goView(\'dept-pp-home\');toggleHamburger();}else{hamToggleSec(\'pp\');}" style="background:linear-gradient(135deg,#1a1e0a,#2d3a10);border:1px solid #c4ff2a30;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #c4ff2a10">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4ff2a" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#c4ff2a;text-shadow:0 0 10px #c4ff2a40;flex:1;letter-spacing:.5px">Pre-Press</span><span id="hamArr-pp" style="font-size:9px;color:#c4ff2a60;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-pp" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#c4ff2a"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';

  // Asset Control
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(196,255,42,.06);border:1px solid rgba(196,255,42,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-ppac\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-ppac\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff66" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d9ff66;flex:1">Asset Control</span>';
  h += '<span id="hamArr-ppac" style="font-size:9px;color:#d9ff6660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-ppac" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>Artwork / File Intake</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>Client Asset Library</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>Preflight</div>';
  h += '</div>';

  // Design
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(196,255,42,.06);border:1px solid rgba(196,255,42,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-ppds\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-ppds\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff66" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d9ff66;flex:1">Design</span>';
  h += '<span id="hamArr-ppds" style="font-size:9px;color:#d9ff6660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-ppds" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>Blueprints</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg></span>Dielines</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></span>Branding Fidelity</div>';
  h += '</div>';

  // Engineering
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(196,255,42,.06);border:1px solid rgba(196,255,42,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-ppeg\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-ppeg\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff66" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d9ff66;flex:1">Engineering</span>';
  h += '<span id="hamArr-ppeg" style="font-size:9px;color:#d9ff6660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-ppeg" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></span>Step &amp; Repeat</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M2 12h20"/></svg></span>Trapping</div>';
  h += '<div class="ham-item" onclick="goView(\'templates\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>Print / Press Specs</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span>Distortion / Compensation</div>';
  h += '</div>';

  // Color Science & Proofing
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(196,255,42,.06);border:1px solid rgba(196,255,42,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-ppcp\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-ppcp\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff66" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d9ff66;flex:1">Color Science &amp; Proofing</span>';
  h += '<span id="hamArr-ppcp" style="font-size:9px;color:#d9ff6660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-ppcp" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>Color Profiles</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>Color Correction</div>';
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>Proofing</div>';
  h += '</div>';

  // Plate / Cylinder Mgmt (direct click, no sub-toggle)
  h += '<div class="ham-item" onclick="goView(\'ppd\');toggleHamburger()" style="margin:4px 0 2px;padding:7px 10px"><span class="hi-ico" style="color:#d9ff66"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="10" ry="4"/></svg></span>Plate / Cylinder Mgmt</div>';

  h += '</div></div>';

  /* ── 4. Logistics ──────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-lg\').style.display!==\'none\'){goView(\'dept-lg-home\');toggleHamburger();}else{hamToggleSec(\'lg\');}" style="background:linear-gradient(135deg,#1e150a,#3d2510);border:1px solid #f9731630;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #f9731610">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#f97316;text-shadow:0 0 10px #f9731640;flex:1;letter-spacing:.5px">Logistics</span><span id="hamArr-lg" style="font-size:9px;color:#f9731660;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-lg" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#f97316"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';

  // Shipping
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-lgsh\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-lgsh\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#fb923c;flex:1">Shipping</span>';
  h += '<span id="hamArr-lgsh" style="font-size:9px;color:#fb923c60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-lgsh" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>Shipment Tracker</div>';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>BOL Generator</div>';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Carrier Management</div>';
  h += '</div>';

  // Receiving
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-lgrc\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-lgrc\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#fb923c;flex:1">Receiving</span>';
  h += '<span id="hamArr-lgrc" style="font-size:9px;color:#fb923c60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-lgrc" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>Inbound Log</div>';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></span>PO Receiving</div>';
  h += '</div>';

  // Inventory
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-lginv\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-lginv\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#fb923c;flex:1">Inventory</span>';
  h += '<span id="hamArr-lginv" style="font-size:9px;color:#fb923c60;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-lginv" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></span>Raw Materials</div>';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg></span>Finished Goods</div>';
  h += '<div class="ham-item" onclick="goView(\'logistics\');toggleHamburger()"><span class="hi-ico" style="color:#fb923c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span>Warehouse Map</div>';
  h += '</div>';

  h += '</div></div>';

  /* ── 5. Production ─────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-prod\').style.display!==\'none\'){goView(\'dept-prod-home\');toggleHamburger();}else{hamToggleSec(\'prod\');}" style="background:linear-gradient(135deg,#0a0e1e,#10173d);border:1px solid #6384e630;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #6384e610">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6384e6" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#6384e6;text-shadow:0 0 10px #6384e640;flex:1;letter-spacing:.5px">Production</span><span id="hamArr-prod" style="font-size:9px;color:#6384e660;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-prod" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'production\');toggleHamburger()"><span class="hi-ico" style="color:#6384e6"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';

  // Production Board
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(99,132,230,.06);border:1px solid rgba(99,132,230,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-prbd\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-prbd\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ba4f0" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#8ba4f0;flex:1">Production Board</span>';
  h += '<span id="hamArr-prbd" style="font-size:9px;color:#8ba4f060;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-prbd" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'production\');toggleHamburger()"><span class="hi-ico" style="color:#8ba4f0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>Press Schedules</div>';
  h += '<div class="ham-item" onclick="goView(\'jobtracker\');toggleHamburger()"><span class="hi-ico" style="color:#8ba4f0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span>Job Passports</div>';
  h += '<div class="ham-item" onclick="goView(\'production\');toggleHamburger()"><span class="hi-ico" style="color:#8ba4f0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></span>Output Tracking</div>';
  h += '</div>';

  // Operator
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(99,132,230,.06);border:1px solid rgba(99,132,230,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-prop\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-prop\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ba4f0" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#8ba4f0;flex:1">Operator</span>';
  h += '<span id="hamArr-prop" style="font-size:9px;color:#8ba4f060;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-prop" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'operator\');toggleHamburger()"><span class="hi-ico" style="color:#8ba4f0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>Operator Station</div>';
  h += '<div class="ham-item" onclick="goView(\'production\');toggleHamburger()"><span class="hi-ico" style="color:#8ba4f0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>Machine Status</div>';
  h += '</div>';

  h += '</div></div>';

  /* ── 6. Quality ────────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-qa\').style.display!==\'none\'){goView(\'dept-qa-home\');toggleHamburger();}else{hamToggleSec(\'qa\');}" style="background:linear-gradient(135deg,#1e0a0a,#3d1010);border:1px solid #ff444430;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #ff444410">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#ff4444;text-shadow:0 0 10px #ff444440;flex:1;letter-spacing:.5px">Quality</span><span id="hamArr-qa" style="font-size:9px;color:#ff444460;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-qa" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'quality\');toggleHamburger()"><span class="hi-ico" style="color:#ff4444"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';

  // CAPA / NCR
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-qacapa\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-qacapa\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6666" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#ff6666;flex:1">CAPA / NCR</span>';
  h += '<span id="hamArr-qacapa" style="font-size:9px;color:#ff666660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-qacapa" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>CAPA Log</div>';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>NCR Tracker</div>';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>Root Cause Analysis</div>';
  h += '</div>';

  // Audits
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-qaaud\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-qaaud\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6666" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#ff6666;flex:1">Audits</span>';
  h += '<span id="hamArr-qaaud" style="font-size:9px;color:#ff666660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-qaaud" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'audit\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span>Internal Audits</div>';
  h += '<div class="ham-item" onclick="goView(\'audit\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>SQF Audits</div>';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>Corrective Actions</div>';
  h += '</div>';

  // Training
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-qatr\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-qatr\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6666" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#ff6666;flex:1">Training</span>';
  h += '<span id="hamArr-qatr" style="font-size:9px;color:#ff666660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-qatr" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'training\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></span>Training Matrix</div>';
  h += '<div class="ham-item" onclick="goView(\'training\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>Competency Records</div>';
  h += '</div>';

  // Document Control
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-qadc\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-qadc\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6666" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#ff6666;flex:1">Document Control</span>';
  h += '<span id="hamArr-qadc" style="font-size:9px;color:#ff666660;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-qadc" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'records\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg></span>Controlled Records</div>';
  h += '<div class="ham-item" onclick="goView(\'doccontrol\');toggleHamburger()"><span class="hi-ico" style="color:#ff6666"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>Document Library</div>';
  h += '</div>';

  h += '</div></div>';

  /* ── 7. Finance+ ───────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-fin\').style.display!==\'none\'){goView(\'dept-fin-home\');toggleHamburger();}else{hamToggleSec(\'fin\');}" style="background:linear-gradient(135deg,#0a1e10,#103d1a);border:1px solid #6ee7a030;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #6ee7a010">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7a0" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#6ee7a0;text-shadow:0 0 10px #6ee7a040;flex:1;letter-spacing:.5px">Finance+</span><span id="hamArr-fin" style="font-size:9px;color:#6ee7a060;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-fin" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="openAnalytics();toggleHamburger()"><span class="hi-ico" style="color:#6ee7a0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg></span>Revenue Dashboard</div>';
  h += '<div class="ham-item" onclick="openAnalytics();toggleHamburger()"><span class="hi-ico" style="color:#6ee7a0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>Profitability Dashboard</div>';
  h += '<div class="ham-item" onclick="goView(\'vendorpos\');toggleHamburger()"><span class="hi-ico" style="color:#6ee7a0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>Vendor POs</div>';
  h += '<div class="ham-item" onclick="openAnalytics();toggleHamburger()"><span class="hi-ico" style="color:#6ee7a0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>Cash Flow Dashboard</div>';
  h += '</div></div>';

  /* ── 8. Operations ─────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-ops\').style.display!==\'none\'){goView(\'dept-ops-home\');toggleHamburger();}else{hamToggleSec(\'ops\');}" style="background:linear-gradient(135deg,#1a1a1a,#2a2a2a);border:1px solid #c0c0c030;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #c0c0c010">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0c0c0" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#c0c0c0;text-shadow:0 0 10px #c0c0c040;flex:1;letter-spacing:.5px">Operations</span><span id="hamArr-ops" style="font-size:9px;color:#c0c0c060;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-ops" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'dashboard\');toggleHamburger()"><span class="hi-ico" style="color:#c0c0c0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Daily Dash</div>';

  // HR / People
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(192,192,192,.06);border:1px solid rgba(192,192,192,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-opshr\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-opshr\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d0d0d0;flex:1">HR / People</span>';
  h += '<span id="hamArr-opshr" style="font-size:9px;color:#d0d0d060;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-opshr" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'hr\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Employee Snapshot</div>';
  h += '<div class="ham-item" onclick="goView(\'launchpad\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>Launchpad / Onboarding</div>';
  h += '<div class="ham-item" onclick="goView(\'training\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>Training & Competency</div>';
  h += '</div>';

  // Vendor Management
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(192,192,192,.06);border:1px solid rgba(192,192,192,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-opsvm\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-opsvm\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d0d0d0;flex:1">Vendor Management</span>';
  h += '<span id="hamArr-opsvm" style="font-size:9px;color:#d0d0d060;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-opsvm" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'vendorpos\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>Vendor POs</div>';
  h += '<div class="ham-item" onclick="goView(\'vendorprofile\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Vendor Hub</div>';
  h += '</div>';

  // Production Floor
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(192,192,192,.06);border:1px solid rgba(192,192,192,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-opspf\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-opspf\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d0d0d0;flex:1">Production Floor</span>';
  h += '<span id="hamArr-opspf" style="font-size:9px;color:#d0d0d060;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-opspf" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'operator\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>Operator Station</div>';
  h += '<div class="ham-item" onclick="goView(\'production\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>Press Schedules</div>';
  h += '<div class="ham-item" onclick="goView(\'jobtracker\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span>Job Passports</div>';
  h += '</div>';

  // Administration
  h += '<div class="ham-subcat" style="margin:4px 0 2px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(192,192,192,.06);border:1px solid rgba(192,192,192,.12);transition:all .2s" onclick="var s=document.getElementById(\'hamSub-opsadm\');if(s){s.style.display=s.style.display===\'none\'?\'block\':\'none\';var a=document.getElementById(\'hamArr-opsadm\');if(a)a.style.transform=s.style.display===\'none\'?\'\':\'rotate(90deg)\';}">';
  h += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  h += '<span style="font-size:11px;font-weight:700;color:#d0d0d0;flex:1">Administration</span>';
  h += '<span id="hamArr-opsadm" style="font-size:9px;color:#d0d0d060;transition:transform .2s">&#9656;</span></div>';
  h += '<div id="hamSub-opsadm" style="display:none;padding:2px 0 0 16px">';
  h += '<div class="ham-item" onclick="goView(\'datasync\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>Data Sync</div>';
  h += '<div class="ham-item" onclick="goView(\'doccontrol\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>Document Control</div>';
  h += '<div class="ham-item" onclick="goView(\'masterauto\');toggleHamburger()"><span class="hi-ico" style="color:#d0d0d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>Master Automation</div>';
  h += '</div>';

  h += '</div></div>';

  /* ── 9. FSQMS — Food Safety & Quality ──────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-fsq\').style.display!==\'none\'){goView(\'dept-fsq-home\');toggleHamburger();}else{hamToggleSec(\'fsq\');}" style="background:linear-gradient(135deg,#1e1a0a,#3d3510);border:1px solid #ffe06630;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #ffe06610">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffe066" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#ffe066;text-shadow:0 0 10px #ffe06640;flex:1;letter-spacing:.5px">FSQMS &middot; Food Safety &amp; Quality</span><span id="hamArr-fsq" style="font-size:9px;color:#ffe06660;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-fsq" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'sqfdatalogs\');toggleHamburger()"><span class="hi-ico" style="color:#ffe066"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Dashboard / Overview</div>';
  h += '<div class="ham-item" onclick="goView(\'sqfdatalogs\');toggleHamburger()"><span class="hi-ico" style="color:#ffe066"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>SQF Data Logs</div>';
  h += '<div class="ham-item" onclick="goView(\'gmp\');toggleHamburger()"><span class="hi-ico" style="color:#ffe066"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>GMP Dashboard</div>';
  h += '<div class="ham-item" onclick="goView(\'capa\');toggleHamburger()"><span class="hi-ico" style="color:#ffe066"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>CAPA</div>';
  h += '<div class="ham-item" onclick="goView(\'records\');toggleHamburger()"><span class="hi-ico" style="color:#ffe066"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg></span>Controlled Records</div>';
  h += '</div></div>';

  /* ── 10. FlexAi ────────────────────────────────────────────────────── */
  h += '<div style="padding:2px 12px">';
  h += '<div class="ham-dept-btn" tabindex="0" role="button" onclick="if(document.getElementById(\'hamSub-fai\').style.display!==\'none\'){goView(\'dept-fai-home\');toggleHamburger();}else{hamToggleSec(\'fai\');}" style="background:linear-gradient(135deg,#0a1a1e,#10303d);border:1px solid #67e8f930;border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s;box-shadow:0 0 15px #67e8f910">';
  h += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  h += '<span style="font-size:11px;font-weight:800;color:#67e8f9;text-shadow:0 0 10px #67e8f940;flex:1;letter-spacing:.5px">FlexAi &middot; Intelligence</span><span id="hamArr-fai" style="font-size:9px;color:#67e8f960;transition:transform .2s">&#9656;</span>';
  h += '</div>';
  h += '<div id="hamSub-fai" style="display:none;padding:4px 0 0 12px">';
  h += '<div class="ham-item" onclick="goView(\'ceodash\');toggleHamburger()"><span class="hi-ico" style="color:#67e8f9"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg></span>Dashboard</div>';
  h += '<div class="ham-item" onclick="openSignalCommand();toggleHamburger()"><span class="hi-ico" style="color:#67e8f9"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>Signal Command</div>';
  h += '</div></div>';

  return h;
};

// Always show full menu on load
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){ _mfxApplyUnlock(); });
}else{
  _mfxApplyUnlock();
}
