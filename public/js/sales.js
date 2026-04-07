(function(){
  'use strict';
  if(typeof window==='undefined') return;

  // ═══════════════════════════════════════════════════════════════
  //  MFX OS — Sales Department Dashboard
  //  Deals, Pipeline, Rep Race, Forecasting
  //  Color: Goldenrod #DAA520
  // ═══════════════════════════════════════════════════════════════

  var SL={tab:'overview',pipeFilter:'all',wonFilter:'month',search:''};
  window.SL=SL;

  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_TITLES=window.MFX_VIEW_TITLES||{};
  window.MFX_VIEW_RENDERERS.sales=renderSalesView;
  window.MFX_VIEW_TITLES.sales='Sales';

  var prevAfterGo=window.MFX_AFTER_GO_VIEW;
  window.MFX_AFTER_GO_VIEW=function(v){
    if(typeof prevAfterGo==='function') prevAfterGo(v);
    syncSalesChrome(v==='sales');
  };

  // ─── Utilities ───
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function money(n){var v=Number(n||0);if(v>=1e6)return '$'+((v/1e6).toFixed(1))+'M';if(v>=1e3)return '$'+((v/1e3).toFixed(1))+'K';return '$'+v.toFixed(0);}
  function num(n){return Number(n||0).toLocaleString();}
  function fDate(v){if(!v)return '—';try{return new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch(e){return '—';}}
  function daysAgo(v){if(!v)return '—';var d=Math.floor((Date.now()-new Date(v).getTime())/86400000);return d<=0?'Today':d===1?'1d':d+'d';}
  function pct(n,t){return t>0?Math.round((n/t)*100):0;}
  function pillClass(s){var st=String(s||'').toLowerCase();return 'pill pill-'+(st==='approval'?'approval':st==='ready'?'ready':st==='draft'?'draft':st==='sent'?'sent':st==='won'?'won':st==='lost'?'lost':'active');}

  // ─── Data ───
  function quotes(){return typeof DB!=='undefined'&&typeof DB.quotes==='function'?DB.quotes():[];}
  function customers(){return typeof DB!=='undefined'&&typeof DB.customers==='function'?DB.customers():[];}
  function salesOrders(){return typeof getSalesOrders==='function'?getSalesOrders():[];}

  // ─── Chrome ───
  function syncSalesChrome(active){
    var badge=$('topDeptBadge');
    if(badge&&active){badge.textContent='SLS';badge.style.background='#daa520';badge.style.color='#000';}
  }

  // ─── Tab setters ───
  window.setSalesTab=function(t){SL.tab=t;renderSalesView();};
  window.setSalesPipeFilter=function(f){SL.pipeFilter=f;renderSalesView();};
  window.setSalesWonFilter=function(f){SL.wonFilter=f;renderSalesView();};

  // ─── Metric ───
  function slMetric(label,value,sub,color){
    return '<div class="sl-metric"><div class="sl-metric-val"'+(color?' style="color:'+color+'"':'')+'>'+(value)+'</div><div class="sl-metric-lbl">'+esc(label)+'</div>'+(sub?'<div class="sl-metric-sub">'+esc(sub)+'</div>':'')+'</div>';
  }

  // ─── KPIs ───
  function computeKPIs(qs){
    var now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime(),qtrStart=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).getTime();
    var active=qs.filter(function(q){return !['won','lost','archived'].includes(String(q.status||'').toLowerCase());});
    var inProgress=qs.filter(function(q){return ['approval','ready','sent'].includes(String(q.status||'').toLowerCase());});
    var wonAll=qs.filter(function(q){return q.status==='won';});
    var wonMonth=wonAll.filter(function(q){return new Date(q.updatedAt||q.closedAt||0).getTime()>=monthStart;});
    var wonQtr=wonAll.filter(function(q){return new Date(q.updatedAt||q.closedAt||0).getTime()>=qtrStart;});
    var lostMonth=qs.filter(function(q){return q.status==='lost'&&new Date(q.updatedAt||0).getTime()>=monthStart;});
    var wonAmt=wonMonth.reduce(function(s,q){return s+Number(q.wonAmount||0);},0);
    var wonQtrAmt=wonQtr.reduce(function(s,q){return s+Number(q.wonAmount||0);},0);
    var pipeVal=active.reduce(function(s,q){var b=0;(q.qtys||[]).forEach(function(t){if(Number(t.total||0)>b)b=Number(t.total||0);});return s+b;},0);
    var winRate=wonAll.length+qs.filter(function(q){return q.status==='lost';}).length;
    winRate=winRate>0?Math.round((wonAll.length/winRate)*100):0;
    return {active:active.length,inProgress:inProgress.length,wonMonth:wonMonth.length,wonAmt:wonAmt,wonQtr:wonQtr.length,wonQtrAmt:wonQtrAmt,lostMonth:lostMonth.length,pipeVal:pipeVal,winRate:winRate,totalDeals:qs.length};
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════════════════════
  function renderSalesView(){
    var el=$('v-sales');if(!el)return;
    syncSalesChrome(true);
    var qs=quotes(),cs=customers(),sos=salesOrders();
    var kpi=computeKPIs(qs);

    var h='<div class="sl-shell fade-in">';

    // ─── HERO ───
    h+='<div class="sl-hero">';
    h+='<div style="flex:1">';
    h+='<div class="sl-kicker">Department Workspace</div>';
    h+='<div class="sl-title">Sales</div>';
    h+='<div class="sl-sub">Deals, Pipeline, Rep Performance & Revenue Intelligence</div>';
    h+='</div>';
    h+='<div class="sl-hero-actions">';
    h+='<button class="btn btn-sl-pr" onclick="newQuote()">＋ New Deal</button>';
    h+='<button class="btn btn-ghost" style="border-color:#daa52040;color:#daa520" onclick="goView(\'quotes\')">Quote Engine</button>';
    h+='<button class="btn btn-ghost" style="border-color:#daa52040;color:#daa520" onclick="goView(\'orders\')">Orders</button>';
    h+='</div>';
    h+='</div>';

    // ─── METRICS ───
    h+='<div class="sl-metrics">';
    h+=slMetric('Active Deals',num(kpi.active),'In pipeline');
    h+=slMetric('In Progress',num(kpi.inProgress),'Approval + Ready + Sent');
    h+=slMetric('Won This Month',money(kpi.wonAmt),kpi.wonMonth+' deal'+(kpi.wonMonth!==1?'s':''),'#4ade80');
    h+=slMetric('Pipeline Value',money(kpi.pipeVal),'Best qty estimate');
    h+=slMetric('Won QTD',money(kpi.wonQtrAmt),kpi.wonQtr+' deal'+(kpi.wonQtr!==1?'s':''),'#4ade80');
    h+=slMetric('Lost This Month',num(kpi.lostMonth),'Deals lost','#f87171');
    h+=slMetric('Win Rate',kpi.winRate+'%',kpi.winRate>=50?'Strong':'Needs improvement',kpi.winRate>=50?'#4ade80':'#fbbf24');
    h+=slMetric('Total Deals',num(kpi.totalDeals),'All time');
    h+='</div>';

    // ─── TABS ───
    h+='<div class="sl-tabs">';
    [['overview','Overview'],['pipeline','Deals in Progress'],['won','Deals Won'],['planned','Deals Planned'],['race','Rep Race'],['activity','Activity']].forEach(function(tab){
      h+='<button class="sl-tab'+(SL.tab===tab[0]?' active':'')+'" onclick="setSalesTab(\''+tab[0]+'\')">'+tab[1]+'</button>';
    });
    h+='</div>';

    if(SL.tab==='overview') h+=renderOverview(qs,cs,sos,kpi);
    if(SL.tab==='pipeline') h+=renderPipeline(qs);
    if(SL.tab==='won') h+=renderWon(qs);
    if(SL.tab==='planned') h+=renderPlanned(qs);
    if(SL.tab==='race') h+=renderRepRace(qs);
    if(SL.tab==='activity') h+=renderActivity();

    h+='</div>';
    el.innerHTML=h;

    if(SL.tab==='overview') loadSalesActivity('sl-act-feed',8);
    if(SL.tab==='activity') loadSalesActivity('sl-full-act',50);
  }

  // ═══════════════════════════════════════════════════════════════
  //  OVERVIEW
  // ═══════════════════════════════════════════════════════════════
  function renderOverview(qs,cs,sos,kpi){
    var h='<div class="sl-grid-2">';

    // ── Deal Velocity Funnel ──
    h+='<div class="sl-section">';
    h+='<div class="sl-section-title">Deal Velocity</div>';
    h+='<div class="sl-section-sub">Current pipeline by stage</div>';
    var stages=['draft','approval','ready','sent'];
    var stageLabels={draft:'Draft',approval:'Approval',ready:'Approved',sent:'Sent to Client'};
    var stageColors={draft:'#a78bfa',approval:'#fbbf24',ready:'#4ade80',sent:'#38bdf8'};
    var totalQ=qs.length||1;
    stages.forEach(function(st){
      var count=qs.filter(function(q){return String(q.status||'').toLowerCase()===st;}).length;
      var w=pct(count,totalQ);
      h+='<div style="display:flex;align-items:center;gap:10px;margin:8px 0">';
      h+='<div style="width:90px;font-size:11px;font-weight:600;color:'+stageColors[st]+'">'+stageLabels[st]+'</div>';
      h+='<div style="flex:1;background:var(--bg2);border-radius:6px;height:28px;overflow:hidden;position:relative">';
      h+='<div style="height:100%;width:'+Math.max(w,3)+'%;background:linear-gradient(90deg,'+stageColors[st]+'44,'+stageColors[st]+'22);border-left:3px solid '+stageColors[st]+';border-radius:6px;transition:width .4s"></div>';
      h+='</div>';
      h+='<div style="width:40px;text-align:right;font-size:14px;font-weight:800;color:var(--tx)">'+count+'</div>';
      h+='</div>';
    });
    h+='</div>';

    // ── Recent Wins ──
    h+='<div class="sl-section">';
    h+='<div class="sl-section-title" style="color:#4ade80">Recent Wins</div>';
    var wins=qs.filter(function(q){return q.status==='won';}).sort(function(a,b){return new Date(b.updatedAt||0)-new Date(a.updatedAt||0);}).slice(0,5);
    if(!wins.length){ h+='<div class="sl-empty">No wins yet — go close a deal!</div>'; }
    else { wins.forEach(function(q){
      h+='<div class="sl-row" onclick="if(typeof openEditor===\'function\')openEditor(\''+esc(q.id)+'\')" style="cursor:pointer">';
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--tx)">'+esc(q.fields&&q.fields.custCo||'Client')+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3)">'+esc(q.quoteNum||'')+'  ·  '+fDate(q.updatedAt)+'  ·  '+esc(q.fields&&q.fields.estimator||'')+'</div></div>';
      h+='<div style="font-size:16px;font-weight:900;color:#4ade80">'+money(q.wonAmount||0)+'</div>';
      h+='</div>';
    }); }
    h+='</div>';

    // ── Win/Loss Ratio ──
    h+='<div class="sl-section">';
    h+='<div class="sl-section-title">Win / Loss Ratio</div>';
    var won=qs.filter(function(q){return q.status==='won';}).length;
    var lost=qs.filter(function(q){return q.status==='lost';}).length;
    var total=won+lost||1;
    h+='<div style="display:flex;gap:4px;height:32px;border-radius:8px;overflow:hidden;margin:12px 0">';
    h+='<div style="width:'+pct(won,total)+'%;background:linear-gradient(90deg,#22c55e,#4ade80);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000;min-width:30px">'+won+' W</div>';
    h+='<div style="width:'+pct(lost,total)+'%;background:linear-gradient(90deg,#ef4444,#f87171);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;min-width:30px">'+lost+' L</div>';
    h+='</div>';
    h+='<div style="text-align:center;font-size:24px;font-weight:900;color:#daa520">'+pct(won,total)+'%</div>';
    h+='<div style="text-align:center;font-size:10px;color:var(--tx3)">Overall win rate</div>';
    h+='</div>';

    // ── Top Reps ──
    h+='<div class="sl-section">';
    h+='<div class="sl-section-title" style="color:#daa520">Top Performers</div>';
    var repWins={};
    qs.filter(function(q){return q.status==='won';}).forEach(function(q){
      var rep=q.fields&&q.fields.estimator||q.createdBy||'Unknown';
      if(!repWins[rep]) repWins[rep]={count:0,amt:0};
      repWins[rep].count++;
      repWins[rep].amt+=Number(q.wonAmount||0);
    });
    var reps=Object.keys(repWins).map(function(r){return {name:r,count:repWins[r].count,amt:repWins[r].amt};}).sort(function(a,b){return b.amt-a.amt;}).slice(0,5);
    if(!reps.length){ h+='<div class="sl-empty">No data yet</div>'; }
    else { var maxAmt=reps[0].amt||1;
      reps.forEach(function(r,i){
        h+='<div class="sl-row">';
        h+='<div class="sl-rank">'+(i+1)+'</div>';
        h+='<div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--tx)">'+esc(r.name)+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3)">'+r.count+' won</div></div>';
        h+='<div style="width:80px"><div style="height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct(r.amt,maxAmt)+'%;background:#daa520;border-radius:3px"></div></div></div>';
        h+='<div style="width:65px;text-align:right;font-size:13px;font-weight:800;color:#daa520">'+money(r.amt)+'</div>';
        h+='</div>';
      });
    }
    h+='</div>';

    // ── Sales Tip ──
    var tips=[
      'Follow up within 24 hours — speed kills in sales. The first to respond wins 78% of deals.',
      'Know your client\'s packaging line before the call. Mentioning their SKU shows you did homework.',
      'Flexible pouches are growing 6% YoY — lead with pouch options for CPG brands.',
      'Ask "What\'s your timeline?" early — it qualifies urgency and sets your follow-up cadence.',
      'Shrink sleeves offer 360-degree branding. Suggest them for beverage and nutraceutical clients.',
      'Send a 60-second Loom video walkthrough of the quote — response rates jump 3x over email.',
      'Cross-sell print finishes: matte laminate, spot UV, soft-touch. Higher margins, same press run.',
      'Lost a deal? Ask why within 48 hours. The intel is worth more than the deal itself.',
      'Renewal quotes should go out 90 days before reorder date. Don\'t wait for the client to call.',
      'Tag every quote with client industry — it powers the pipeline analytics you\'re looking at right now.'
    ];
    var tipIdx=Math.floor(Date.now()/86400000)%tips.length;
    h+='<div class="sl-section sl-tip" style="grid-column:1/-1">';
    h+='<div style="display:flex;align-items:flex-start;gap:12px">';
    h+='<div style="font-size:20px;line-height:1">🎯</div>';
    h+='<div><div style="font-size:10px;font-weight:700;color:#daa520;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Sales Tip of the Day</div>';
    h+='<div style="font-size:13px;color:var(--tx);line-height:1.6">'+esc(tips[tipIdx])+'</div></div>';
    h+='</div></div>';

    // ── Activity ──
    h+='<div class="sl-section" style="grid-column:1/-1">';
    h+='<div class="sl-section-title">Recent Sales Activity</div>';
    h+='<div id="sl-act-feed" style="min-height:60px"><div class="sl-empty">Loading...</div></div>';
    h+='</div>';

    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DEALS IN PROGRESS
  // ═══════════════════════════════════════════════════════════════
  function renderPipeline(qs){
    var statuses=['all','draft','approval','ready','sent'];
    var labels={all:'All Active',draft:'Draft',approval:'Awaiting Approval',ready:'Approved',sent:'Sent'};
    var h='<div class="sl-content">';
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">';
    statuses.forEach(function(st){
      var c=st==='all'?qs.filter(function(q){return !['won','lost','archived'].includes(String(q.status||'').toLowerCase());}).length:qs.filter(function(q){return q.status===st;}).length;
      h+='<button class="sl-tab'+(SL.pipeFilter===st?' active':'')+'" onclick="setSalesPipeFilter(\''+st+'\')">'+labels[st]+' <span style="opacity:.7">('+c+')</span></button>';
    });
    h+='</div>';

    var filtered=SL.pipeFilter==='all'?qs.filter(function(q){return !['won','lost','archived'].includes(String(q.status||'').toLowerCase());}):qs.filter(function(q){return q.status===SL.pipeFilter;});
    filtered.sort(function(a,b){return new Date(b.updatedAt||0)-new Date(a.updatedAt||0);});

    if(!filtered.length){ h+='<div class="sl-empty">No deals matching this filter</div>'; }
    else {
      h+='<div class="sl-deal-grid">';
      filtered.forEach(function(q){
        var co=q.fields&&q.fields.custCo||'Unknown';
        var st=String(q.status||'draft').toLowerCase();
        var bestTotal=0;(q.qtys||[]).forEach(function(t){if(Number(t.total||0)>bestTotal)bestTotal=Number(t.total||0);});
        h+='<div class="sl-deal-card" onclick="if(typeof openEditor===\'function\')openEditor(\''+esc(q.id)+'\')">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h+='<span style="font-size:12px;font-weight:700;color:#daa520">'+esc(q.quoteNum||'—')+'</span>';
        h+='<span class="'+pillClass(st)+'">'+esc(st)+'</span></div>';
        h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:2px">'+esc(co)+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:6px">'+esc(q.fields&&q.fields.jobDesc||'')+'</div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center">';
        if(bestTotal>0) h+='<span style="font-size:14px;font-weight:800;color:#daa520">'+money(bestTotal)+'</span>';
        else h+='<span></span>';
        h+='<span style="font-size:10px;color:var(--tx3)">'+daysAgo(q.createdAt)+' old  ·  '+esc(q.fields&&q.fields.estimator||'')+'</span>';
        h+='</div></div>';
      });
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DEALS WON
  // ═══════════════════════════════════════════════════════════════
  function renderWon(qs){
    var now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime(),qtrStart=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).getTime(),yearStart=new Date(now.getFullYear(),0,1).getTime();
    var filters={month:'This Month',quarter:'This Quarter',year:'This Year',all:'All Time'};
    var h='<div class="sl-content">';
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">';
    Object.keys(filters).forEach(function(f){
      h+='<button class="sl-tab'+(SL.wonFilter===f?' active':'')+'" onclick="setSalesWonFilter(\''+f+'\')">'+filters[f]+'</button>';
    });
    h+='</div>';

    var cutoff=SL.wonFilter==='month'?monthStart:SL.wonFilter==='quarter'?qtrStart:SL.wonFilter==='year'?yearStart:0;
    var won=qs.filter(function(q){return q.status==='won'&&new Date(q.updatedAt||q.closedAt||0).getTime()>=cutoff;}).sort(function(a,b){return new Date(b.updatedAt||0)-new Date(a.updatedAt||0);});
    var totalAmt=won.reduce(function(s,q){return s+Number(q.wonAmount||0);},0);

    h+='<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">';
    h+='<div class="sl-metric" style="flex:1;min-width:120px;background:linear-gradient(135deg,rgba(74,222,128,.1),rgba(74,222,128,.03))"><div class="sl-metric-val" style="color:#4ade80;font-size:28px">'+won.length+'</div><div class="sl-metric-lbl">Deals Won</div></div>';
    h+='<div class="sl-metric" style="flex:1;min-width:120px;background:linear-gradient(135deg,rgba(74,222,128,.1),rgba(74,222,128,.03))"><div class="sl-metric-val" style="color:#4ade80;font-size:28px">'+money(totalAmt)+'</div><div class="sl-metric-lbl">Revenue</div></div>';
    h+='</div>';

    if(!won.length){ h+='<div class="sl-empty">No won deals in this period</div>'; }
    else {
      h+='<div style="display:grid;gap:8px">';
      won.forEach(function(q){
        h+='<div class="sl-row" style="border-left:3px solid #4ade80;cursor:pointer" onclick="if(typeof openEditor===\'function\')openEditor(\''+esc(q.id)+'\')">';
        h+='<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--tx)">'+esc(q.fields&&q.fields.custCo||'')+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3)">'+esc(q.quoteNum||'')+' · '+esc(q.fields&&q.fields.estimator||'')+' · '+fDate(q.updatedAt)+'</div></div>';
        h+='<div style="font-size:15px;font-weight:900;color:#4ade80">'+money(q.wonAmount||0)+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DEALS PLANNED (Drafts)
  // ═══════════════════════════════════════════════════════════════
  function renderPlanned(qs){
    var drafts=qs.filter(function(q){return q.status==='draft';}).sort(function(a,b){return new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0);});
    var h='<div class="sl-content">';
    h+='<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">';
    h+='<div><div class="sl-section-title">Deals in Draft</div><div class="sl-section-sub">Planned quotes not yet submitted</div></div>';
    h+='<button class="btn btn-sl-pr" onclick="newQuote()">＋ New Deal</button>';
    h+='</div>';

    if(!drafts.length){ h+='<div class="sl-empty">No drafts — start a new deal!</div>'; }
    else {
      h+='<div class="sl-deal-grid">';
      drafts.forEach(function(q){
        var co=q.fields&&q.fields.custCo||'New Client';
        h+='<div class="sl-deal-card" onclick="if(typeof openEditor===\'function\')openEditor(\''+esc(q.id)+'\')">';
        h+='<div style="font-size:12px;font-weight:700;color:#daa520;margin-bottom:4px">'+esc(q.quoteNum||'Draft')+'</div>';
        h+='<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:2px">'+esc(co)+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3)">'+esc(q.fields&&q.fields.jobDesc||'No description yet')+'</div>';
        h+='<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--tx3)">';
        h+='<span>Created '+daysAgo(q.createdAt)+'</span>';
        h+='<span>'+esc(q.fields&&q.fields.estimator||'')+'</span>';
        h+='</div></div>';
      });
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REP RACE (Leaderboard)
  // ═══════════════════════════════════════════════════════════════
  function renderRepRace(qs){
    var reps={};
    qs.forEach(function(q){
      var rep=q.fields&&q.fields.estimator||q.createdBy||'Unknown';
      if(!reps[rep]) reps[rep]={won:0,wonAmt:0,lost:0,active:0,sent:0,total:0};
      reps[rep].total++;
      var st=String(q.status||'').toLowerCase();
      if(st==='won'){reps[rep].won++;reps[rep].wonAmt+=Number(q.wonAmount||0);}
      else if(st==='lost') reps[rep].lost++;
      else if(st==='sent') reps[rep].sent++;
      else if(!['archived'].includes(st)) reps[rep].active++;
    });

    var board=Object.keys(reps).map(function(r){var d=reps[r];d.name=r;d.winRate=(d.won+d.lost)>0?Math.round((d.won/(d.won+d.lost))*100):0;return d;}).sort(function(a,b){return b.wonAmt-a.wonAmt;});

    var h='<div class="sl-content">';
    h+='<div class="sl-section-title" style="color:#daa520;font-size:16px;margin-bottom:12px">Sales Rep Leaderboard</div>';

    if(!board.length){ h+='<div class="sl-empty">No rep data yet</div>'; }
    else {
      // Podium (top 3)
      h+='<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">';
      board.slice(0,3).forEach(function(r,i){
        var medals=['🥇','🥈','🥉'];
        var sizes=['44px','36px','32px'];
        h+='<div class="sl-section" style="flex:1;min-width:160px;text-align:center;'+(i===0?'border:1px solid #daa52040;box-shadow:0 0 20px #daa52015;':'')+'padding:20px 16px">';
        h+='<div style="font-size:'+sizes[i]+'">'+medals[i]+'</div>';
        h+='<div style="font-size:15px;font-weight:800;color:var(--tx);margin:8px 0 2px">'+esc(r.name)+'</div>';
        h+='<div style="font-size:22px;font-weight:900;color:#daa520">'+money(r.wonAmt)+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+r.won+' won · '+r.winRate+'% rate · '+r.active+' active</div>';
        h+='</div>';
      });
      h+='</div>';

      // Full table
      h+='<div class="sl-section">';
      h+='<table style="width:100%;border-collapse:collapse;font-size:12px">';
      h+='<thead><tr style="border-bottom:1px solid var(--bdr);color:var(--tx3);font-size:10px;text-transform:uppercase;letter-spacing:.5px">';
      h+='<th style="text-align:left;padding:8px 6px">#</th><th style="text-align:left;padding:8px 6px">Rep</th>';
      h+='<th style="text-align:center;padding:8px 6px">Won</th><th style="text-align:center;padding:8px 6px">Lost</th>';
      h+='<th style="text-align:center;padding:8px 6px">Active</th><th style="text-align:center;padding:8px 6px">Win %</th>';
      h+='<th style="text-align:right;padding:8px 6px">Revenue</th></tr></thead><tbody>';
      board.forEach(function(r,i){
        h+='<tr style="border-bottom:1px solid var(--bg2)">';
        h+='<td style="padding:8px 6px;color:var(--tx3)">'+(i+1)+'</td>';
        h+='<td style="padding:8px 6px;font-weight:700;color:var(--tx)">'+esc(r.name)+'</td>';
        h+='<td style="text-align:center;padding:8px 6px;color:#4ade80;font-weight:700">'+r.won+'</td>';
        h+='<td style="text-align:center;padding:8px 6px;color:#f87171">'+r.lost+'</td>';
        h+='<td style="text-align:center;padding:8px 6px;color:#38bdf8">'+r.active+'</td>';
        h+='<td style="text-align:center;padding:8px 6px;font-weight:700;color:'+(r.winRate>=50?'#4ade80':'#fbbf24')+'">'+r.winRate+'%</td>';
        h+='<td style="text-align:right;padding:8px 6px;font-weight:800;color:#daa520">'+money(r.wonAmt)+'</td>';
        h+='</tr>';
      });
      h+='</tbody></table></div>';
    }
    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ACTIVITY
  // ═══════════════════════════════════════════════════════════════
  function renderActivity(){
    var h='<div class="sl-content">';
    h+='<div class="sl-section-title">Sales Activity Feed</div>';
    h+='<div id="sl-full-act" style="min-height:80px"><div class="sl-empty">Loading...</div></div>';
    h+='</div>';
    return h;
  }

  function loadSalesActivity(containerId,limit){
    if(!window.fbDb||typeof window.fbDb.collection!=='function') return;
    setTimeout(function(){
      var el=$(containerId);if(!el) return;
      window.fbDb.collection('activity').orderBy('timestamp','desc').limit(limit||10).get().then(function(snap){
        if(!el||!document.body.contains(el)) return;
        var items=[];
        snap.forEach(function(doc){var d=doc.data();var a=String(d.action||'').toLowerCase();if(a.indexOf('quote')>=0||a.indexOf('so.')>=0||a.indexOf('order')>=0||a.indexOf('won')>=0||a.indexOf('lost')>=0||a.indexOf('sent')>=0) items.push(d);});
        if(!items.length){el.innerHTML='<div class="sl-empty">No sales activity yet</div>';return;}
        var h='';
        items.slice(0,limit).forEach(function(a){
          var color=String(a.action||'').indexOf('won')>=0?'#4ade80':String(a.action||'').indexOf('lost')>=0?'#f87171':'#daa520';
          h+='<div class="sl-row" style="padding:8px 0;border-bottom:1px solid var(--bg2)">';
          h+='<div style="flex:1"><span style="font-size:11px;font-weight:700;color:'+color+'">'+esc(a.action||'')+'</span>';
          h+=' <span style="font-size:11px;color:var(--tx)">'+esc(a.detail||'')+'</span></div>';
          h+='<div style="font-size:10px;color:var(--tx3);white-space:nowrap">'+esc(a.user||'')+' · '+fDate(a.timestamp)+'</div>';
          h+='</div>';
        });
        el.innerHTML=h;
      }).catch(function(){if(el&&document.body.contains(el))el.innerHTML='<div class="sl-empty">Activity unavailable</div>';});
    },100);
  }

  console.log('✅ MFX Sales Dashboard initialized');
})();
