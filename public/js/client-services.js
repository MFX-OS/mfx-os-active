(function(){
  'use strict';
  if(typeof window==='undefined') return;

  // ═══════════════════════════════════════════════════════════════
  //  MFX OS — Client Services Department Homepage
  //  Commercial Hub: Quotes, Orders, CRM, Pipeline, Activity
  // ═══════════════════════════════════════════════════════════════

  var CS={tab:'overview',pipelineFilter:'all',clientSearch:'',actFilter:'all'};
  window.CS=CS;

  window.MFX_VIEW_RENDERERS=window.MFX_VIEW_RENDERERS||{};
  window.MFX_VIEW_TITLES=window.MFX_VIEW_TITLES||{};
  window.MFX_VIEW_RENDERERS.clientservices=renderCSView;
  window.MFX_VIEW_TITLES.clientservices='Client Services';

  // Chain MFX_AFTER_GO_VIEW
  var prevAfterGo=window.MFX_AFTER_GO_VIEW;
  window.MFX_AFTER_GO_VIEW=function(v){
    if(typeof prevAfterGo==='function') prevAfterGo(v);
    syncCSChrome(v==='clientservices');
  };

  // ─── Utilities ───
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function money(n){var v=Number(n||0);if(v>=1e6)return '$'+((v/1e6).toFixed(1))+'M';if(v>=1e3)return '$'+((v/1e3).toFixed(1))+'K';return '$'+v.toFixed(0);}
  function num(n){return Number(n||0).toLocaleString();}
  function fDate(v){if(!v)return '—';try{var d=new Date(v);return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch(e){return '—';}}
  function fDateFull(v){if(!v)return '—';try{var d=new Date(v);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch(e){return '—';}}
  function daysAgo(v){if(!v)return '—';var ms=Date.now()-new Date(v).getTime();var d=Math.floor(ms/86400000);return d<=0?'Today':d===1?'1d ago':d+'d ago';}
  function pct(n,total){return total>0?Math.round((n/total)*100):0;}
  function pillClass(status){var s=String(status||'').toLowerCase().replace(/\s+/g,'-');return 'pill pill-'+(s==='approval'?'approval':s==='ready'?'ready':s==='draft'?'draft':s==='sent'?'sent':s==='won'?'won':s==='lost'?'lost':s==='pending'?'pending':'active');}

  // ─── Chrome sync ───
  function syncCSChrome(active){
    var badge=$('topDeptBadge');
    if(badge&&active){badge.textContent='CS';badge.style.background='#a855f7';badge.style.color='#fff';}
  }

  // ─── Data access ───
  function quotes(){return typeof DB!=='undefined'&&typeof DB.quotes==='function'?DB.quotes():[];}
  function customers(){return typeof DB!=='undefined'&&typeof DB.customers==='function'?DB.customers():[];}
  function salesOrders(){return typeof getSalesOrders==='function'?getSalesOrders():[];}

  // ─── Tab setter ───
  window.setCSTab=function(t){CS.tab=t;renderCSView();};
  window.setCSPipelineFilter=function(f){CS.pipelineFilter=f;renderCSView();};
  window.setCSActFilter=function(f){CS.actFilter=f;renderCSView();};

  // ─── KPI computation ───
  function computeKPIs(qs,cs,sos){
    var now=new Date();var monthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();
    var activeQ=qs.filter(function(q){return !['won','lost','archived'].includes(String(q.status||'').toLowerCase());});
    var wonThisMonth=qs.filter(function(q){return q.status==='won'&&new Date(q.updatedAt||q.closedAt||0).getTime()>=monthStart;});
    var wonAmt=wonThisMonth.reduce(function(s,q){return s+Number(q.wonAmount||0);},0);
    var pipelineVal=activeQ.reduce(function(s,q){
      var qts=q.qtys||[];var best=0;qts.forEach(function(t){if(Number(t.total||0)>best)best=Number(t.total||0);});return s+best;
    },0);
    var openSOs=sos.filter(function(s){return !['closed','complete','fulfilled','cancelled'].includes(String(s.status||'').toLowerCase());});
    var healthScores=cs.filter(function(c){return typeof c.healthScore==='number';});
    var avgHealth=healthScores.length>0?Math.round(healthScores.reduce(function(s,c){return s+c.healthScore;},0)/healthScores.length):0;
    var pendingApproval=qs.filter(function(q){return q.status==='approval';});
    var atRisk=cs.filter(function(c){return (c.healthScore||50)<40;});
    return {
      totalClients:cs.length,activeQuotes:activeQ.length,wonCount:wonThisMonth.length,wonAmt:wonAmt,
      pipelineVal:pipelineVal,openSOs:openSOs.length,avgHealth:avgHealth,
      pendingApproval:pendingApproval.length,atRisk:atRisk.length
    };
  }

  // ─── Metric helper ───
  function csMetric(label,value,sub,color){
    return '<div class="cs-metric"><div class="cs-metric-val"'+(color?' style="color:'+color+'"':'')+'>'+(value)+'</div><div class="cs-metric-lbl">'+esc(label)+'</div>'+(sub?'<div class="cs-metric-sub">'+esc(sub)+'</div>':'')+'</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════════════════════
  function renderCSView(){
    var el=$('v-clientservices');if(!el)return;
    syncCSChrome(true);
    var qs=quotes(),cs=customers(),sos=salesOrders();
    var kpi=computeKPIs(qs,cs,sos);

    var h='<div class="cs-shell fade-in">';

    // ─── HERO ───
    h+='<div class="cs-hero">';
    h+='<div style="flex:1">';
    h+='<div class="cs-kicker">Department Workspace</div>';
    h+='<div class="cs-title">Client Services</div>';
    h+='<div class="cs-sub">Commercial Hub — Quotes, Orders, CRM & Pipeline Intelligence</div>';
    h+='</div>';
    h+='<div class="cs-hero-actions">';
    h+='<button class="btn btn-cs-pr" onclick="newQuote()">＋ New Quote</button>';
    h+='<button class="btn btn-ghost" onclick="if(typeof showCustForm===\'function\')showCustForm()">＋ New Client</button>';
    h+='<button class="btn btn-ghost" onclick="openRFQInbox()">📥 Requests</button>';
    h+='</div>';
    h+='</div>';

    // ─── METRICS ───
    h+='<div class="cs-metrics">';
    h+=csMetric('Total Clients',num(kpi.totalClients),'Active accounts');
    h+=csMetric('Active Quotes',num(kpi.activeQuotes),'In pipeline');
    h+=csMetric('Won This Month',money(kpi.wonAmt),kpi.wonCount+' deal'+(kpi.wonCount!==1?'s':''),'#4ade80');
    h+=csMetric('Pipeline Value',money(kpi.pipelineVal),'Best qty tier sum');
    h+=csMetric('Open SOs',num(kpi.openSOs),'Sales orders in progress');
    h+=csMetric('Avg Health',kpi.avgHealth+'%',kpi.avgHealth>=70?'Strong':kpi.avgHealth>=40?'Moderate':'Needs attention',kpi.avgHealth>=70?'#4ade80':kpi.avgHealth>=40?'#fbbf24':'#f87171');
    h+=csMetric('Pending Approval',num(kpi.pendingApproval),'Awaiting CEO','#fbbf24');
    h+=csMetric('At Risk',num(kpi.atRisk),'Health < 40%','#f87171');
    h+='</div>';

    // ─── TABS ───
    h+='<div class="cs-tabs">';
    [['overview','Overview'],['pipeline','Pipeline'],['clients','Clients'],['orders','Orders'],['activity','Activity']].forEach(function(tab){
      h+='<button class="cs-tab'+(CS.tab===tab[0]?' active':'')+'" onclick="setCSTab(\''+tab[0]+'\')">'+tab[1]+'</button>';
    });
    h+='</div>';

    // ─── TAB CONTENT ───
    if(CS.tab==='overview') h+=renderOverview(qs,cs,sos,kpi);
    if(CS.tab==='pipeline') h+=renderPipeline(qs);
    if(CS.tab==='clients') h+=renderClientsTab(cs,qs);
    if(CS.tab==='orders') h+=renderOrdersTab(sos,qs);
    if(CS.tab==='activity') h+=renderActivityTab();

    h+='</div>';
    el.innerHTML=h;

    // Async: load activity feeds after DOM render
    if(CS.tab==='overview') loadRecentActivity('cs-activity-feed',10);
    if(CS.tab==='activity') loadRecentActivity('cs-full-activity',50);
  }

  // ═══════════════════════════════════════════════════════════════
  //  OVERVIEW TAB
  // ═══════════════════════════════════════════════════════════════
  function renderOverview(qs,cs,sos,kpi){
    var h='<div class="cs-grid-2">';

    // ── LEFT: Pipeline Funnel ──
    h+='<div class="cs-section">';
    h+='<div class="cs-section-title">Quote Pipeline</div>';
    h+='<div class="cs-section-sub">Current distribution across stages</div>';
    var stages=['draft','approval','ready','sent','won','lost'];
    var stageLabels={draft:'Draft',approval:'Approval',ready:'Ready',sent:'Sent',won:'Won',lost:'Lost'};
    var stageColors={draft:'#a78bfa',approval:'#c4b5fd',ready:'#4ade80',sent:'#38bdf8',won:'#22c55e',lost:'#f87171'};
    var totalQ=qs.length||1;
    stages.forEach(function(st){
      var count=qs.filter(function(q){return String(q.status||'').toLowerCase()===st;}).length;
      var w=pct(count,totalQ);
      h+='<div style="display:flex;align-items:center;gap:10px;margin:6px 0">';
      h+='<div style="width:70px;font-size:11px;font-weight:600;color:'+stageColors[st]+'">'+stageLabels[st]+'</div>';
      h+='<div style="flex:1;background:var(--bg2);border-radius:6px;height:24px;overflow:hidden;position:relative">';
      h+='<div style="height:100%;width:'+Math.max(w,2)+'%;background:'+stageColors[st]+'22;border-left:3px solid '+stageColors[st]+';border-radius:6px;transition:width .4s ease"></div>';
      h+='</div>';
      h+='<div style="width:50px;text-align:right;font-size:13px;font-weight:700;color:var(--tx)">'+count+'</div>';
      h+='</div>';
    });
    h+='</div>';

    // ── RIGHT: Recent Wins ──
    h+='<div class="cs-section">';
    h+='<div class="cs-section-title" style="color:#4ade80">Recent Wins</div>';
    h+='<div class="cs-section-sub">Latest closed deals</div>';
    var wins=qs.filter(function(q){return q.status==='won';}).sort(function(a,b){return new Date(b.updatedAt||b.closedAt||0)-new Date(a.updatedAt||a.closedAt||0);}).slice(0,6);
    if(wins.length===0){
      h+='<div class="cs-empty">No won quotes yet</div>';
    } else {
      wins.forEach(function(q){
        h+='<div class="cs-row" onclick="if(typeof openEditor===\'function\')openEditor(\''+esc(q.id)+'\')" style="cursor:pointer">';
        h+='<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(q.fields&&q.fields.custCo||'Client')+'</div><div style="font-size:10px;color:var(--tx3)">'+esc(q.quoteNum||'')+'  ·  '+fDate(q.updatedAt||q.closedAt)+'</div></div>';
        h+='<div style="font-size:14px;font-weight:800;color:#4ade80">'+money(q.wonAmount||0)+'</div>';
        h+='</div>';
      });
    }
    h+='</div>';

    // ── LEFT: Top Clients by Revenue ──
    h+='<div class="cs-section">';
    h+='<div class="cs-section-title">Top Clients by Revenue</div>';
    h+='<div class="cs-section-sub">Lifetime won amount</div>';
    var clientRev={};
    qs.filter(function(q){return q.status==='won';}).forEach(function(q){
      var co=q.fields&&q.fields.custCo||q.customerId||'Unknown';
      clientRev[co]=(clientRev[co]||0)+Number(q.wonAmount||0);
    });
    var topClients=Object.keys(clientRev).map(function(co){return {co:co,rev:clientRev[co]};}).sort(function(a,b){return b.rev-a.rev;}).slice(0,5);
    if(topClients.length===0){
      h+='<div class="cs-empty">No revenue data yet</div>';
    } else {
      var maxRev=topClients[0].rev||1;
      topClients.forEach(function(c,i){
        h+='<div class="cs-row">';
        h+='<div class="cs-rank">'+(i+1)+'</div>';
        h+='<div style="flex:1;font-size:12px;font-weight:600;color:var(--tx)">'+esc(c.co)+'</div>';
        h+='<div style="width:80px"><div style="height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct(c.rev,maxRev)+'%;background:#a855f7;border-radius:3px"></div></div></div>';
        h+='<div style="width:65px;text-align:right;font-size:12px;font-weight:700;color:#a855f7">'+money(c.rev)+'</div>';
        h+='</div>';
      });
    }
    h+='</div>';

    // ── RIGHT: At Risk Clients ──
    h+='<div class="cs-section">';
    h+='<div class="cs-section-title" style="color:#f87171">At Risk Clients</div>';
    h+='<div class="cs-section-sub">Health score below 40%</div>';
    var atRisk=cs.filter(function(c){return (c.healthScore||50)<40;}).sort(function(a,b){return (a.healthScore||0)-(b.healthScore||0);}).slice(0,5);
    if(atRisk.length===0){
      h+='<div class="cs-empty" style="color:#4ade80">All clients healthy</div>';
    } else {
      atRisk.forEach(function(c){
        var score=c.healthScore||0;
        var color=score<20?'#ef4444':'#fbbf24';
        h+='<div class="cs-row" onclick="if(typeof openProfile===\'function\')openProfile(\''+esc(c.id)+'\')" style="cursor:pointer">';
        h+='<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(c.company||c.name||'Client')+'</div>';
        h+='<div style="margin-top:4px;height:5px;background:var(--bg2);border-radius:3px;overflow:hidden;width:100px"><div style="height:100%;width:'+score+'%;background:'+color+';border-radius:3px"></div></div></div>';
        h+='<div style="font-size:14px;font-weight:800;color:'+color+'">'+score+'%</div>';
        h+='</div>';
      });
    }
    h+='</div>';

    // ── FULL WIDTH: Daily Tip ──
    var tips=[
      'Flexible packaging grows ~4% annually worldwide — position MFX as a partner for scaling brands.',
      'Follow up on sent quotes within 48 hours — response rates drop 80% after day 3.',
      'Every won quote is a relationship milestone. Celebrate wins with the team!',
      'Clients with health scores below 50 are 3x more likely to churn. Reach out proactively.',
      'Shrink sleeves are the fastest-growing label format — suggest them for beverage clients.',
      'Net 30 terms with 2% early-pay discount improves cash flow by 15% on average.',
      'Ask existing clients about new SKUs each quarter — expansion revenue is cheaper than acquisition.',
      'A quick "How are things going?" email after delivery builds loyalty more than discounts.',
      'Pouch packaging reduces shipping weight by 30% vs rigid containers — great selling point.',
      'Tag quotes with industry (food, beverage, pharma) to spot trends in your pipeline.'
    ];
    var tipIdx=Math.floor(Date.now()/86400000)%tips.length;
    h+='<div class="cs-section cs-tip" style="grid-column:1/-1">';
    h+='<div style="display:flex;align-items:flex-start;gap:12px">';
    h+='<div style="font-size:20px;line-height:1">💡</div>';
    h+='<div><div style="font-size:10px;font-weight:700;color:#a855f7;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Tip of the Day</div>';
    h+='<div style="font-size:13px;color:var(--tx);line-height:1.6">'+esc(tips[tipIdx])+'</div></div>';
    h+='</div></div>';

    // ── FULL WIDTH: Activity Feed ──
    h+='<div class="cs-section" style="grid-column:1/-1">';
    h+='<div class="cs-section-title">Recent Team Activity</div>';
    h+='<div id="cs-activity-feed" style="min-height:60px"><div class="cs-empty">Loading...</div></div>';
    h+='</div>';

    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PIPELINE TAB
  // ═══════════════════════════════════════════════════════════════
  function renderPipeline(qs){
    var statuses=['all','draft','approval','ready','sent'];
    var statusLabels={all:'All',draft:'Draft',approval:'Approval',ready:'Ready',sent:'Sent'};
    var h='<div class="cs-content">';

    // Filter buttons
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">';
    statuses.forEach(function(st){
      var active=CS.pipelineFilter===st;
      h+='<button class="cs-tab'+(active?' active':'')+'" onclick="setCSPipelineFilter(\''+st+'\')">'+statusLabels[st];
      if(st!=='all'){
        var c=qs.filter(function(q){return String(q.status||'').toLowerCase()===st;}).length;
        h+=' <span style="opacity:.7">('+c+')</span>';
      }
      h+='</button>';
    });
    h+='</div>';

    // Filtered quotes
    var filtered=qs;
    if(CS.pipelineFilter!=='all'){
      filtered=qs.filter(function(q){return String(q.status||'').toLowerCase()===CS.pipelineFilter;});
    } else {
      filtered=qs.filter(function(q){return !['won','lost','archived'].includes(String(q.status||'').toLowerCase());});
    }
    filtered.sort(function(a,b){return new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0);});

    if(filtered.length===0){
      h+='<div class="cs-empty">No quotes matching this filter</div>';
    } else {
      // Summary bar
      h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:12px">Showing '+filtered.length+' quote'+(filtered.length!==1?'s':'')+'</div>';
      h+='<div class="cs-pipeline-grid">';
      filtered.forEach(function(q){
        var co=q.fields&&q.fields.custCo||'Unknown';
        var st=String(q.status||'draft').toLowerCase();
        var age=daysAgo(q.createdAt);
        var bestTotal=0;(q.qtys||[]).forEach(function(t){if(Number(t.total||0)>bestTotal)bestTotal=Number(t.total||0);});
        h+='<div class="cs-quote-card" onclick="if(typeof openEditor===\'function\')openEditor(\''+esc(q.id)+'\')">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h+='<div style="font-size:12px;font-weight:700;color:var(--ac)">'+esc(q.quoteNum||'—')+'</div>';
        h+='<span class="'+pillClass(st)+'">'+esc(st)+'</span>';
        h+='</div>';
        h+='<div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:4px">'+esc(co)+'</div>';
        h+='<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--tx3)">';
        h+='<span>'+esc(q.fields&&q.fields.jobDesc||'')+'</span>';
        h+='<span>'+age+'</span>';
        h+='</div>';
        if(bestTotal>0) h+='<div style="font-size:13px;font-weight:700;color:#a855f7;margin-top:6px">'+money(bestTotal)+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CLIENTS TAB
  // ═══════════════════════════════════════════════════════════════
  function renderClientsTab(cs,qs){
    var h='<div class="cs-content">';

    // Search + actions
    h+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">';
    h+='<input type="text" placeholder="Search clients..." value="'+esc(CS.clientSearch)+'" oninput="CS.clientSearch=this.value;renderCSView()" style="flex:1;min-width:200px;padding:10px 14px;border-radius:8px;background:var(--bg2);border:1px solid var(--bdr);color:var(--tx);font-size:13px;outline:none">';
    h+='<button class="btn btn-cs-pr" onclick="if(typeof showCustForm===\'function\')showCustForm()">＋ Add Client</button>';
    h+='</div>';

    // Filter
    var filtered=cs;
    if(CS.clientSearch){
      var q=CS.clientSearch.toLowerCase();
      filtered=cs.filter(function(c){
        return (c.company||c.name||'').toLowerCase().indexOf(q)>=0 ||
               (c.contact||'').toLowerCase().indexOf(q)>=0 ||
               (c.industry||'').toLowerCase().indexOf(q)>=0 ||
               (c.email||'').toLowerCase().indexOf(q)>=0;
      });
    }

    h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:12px">'+filtered.length+' client'+(filtered.length!==1?'s':'')+(CS.clientSearch?' matching "'+esc(CS.clientSearch)+'"':'')+'</div>';

    if(filtered.length===0){
      h+='<div class="cs-empty">No clients found</div>';
    } else {
      h+='<div class="cs-client-grid">';
      filtered.forEach(function(c){
        var cid=c.id;
        var cqs=qs.filter(function(q){return q.customerId===cid||(q.fields&&q.fields.custCo)===(c.company||c.name);});
        var wonCqs=cqs.filter(function(q){return q.status==='won';});
        var totalRev=wonCqs.reduce(function(s,q){return s+Number(q.wonAmount||0);},0);
        var score=c.healthScore;
        var hasScore=typeof score==='number';
        var scoreColor=hasScore?(score>=70?'#4ade80':score>=40?'#fbbf24':'#f87171'):'#4a6478';

        h+='<div class="cs-client-card" onclick="if(typeof openProfile===\'function\')openProfile(\''+esc(cid)+'\')">';
        h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
        h+='<div><div style="font-size:14px;font-weight:700;color:var(--tx)">'+esc(c.company||c.name||'—')+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+esc(c.contact||'')+(c.industry?' · '+esc(c.industry):'')+'</div></div>';
        if(hasScore){
          h+='<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:'+scoreColor+'"></div><span style="font-size:11px;font-weight:700;color:'+scoreColor+'">'+score+'</span></div>';
        }
        h+='</div>';
        h+='<div style="display:flex;gap:12px;font-size:10px;color:var(--tx3)">';
        h+='<span>Quotes: <b style="color:var(--tx)">'+cqs.length+'</b></span>';
        h+='<span>Won: <b style="color:#4ade80">'+wonCqs.length+'</b></span>';
        if(totalRev>0) h+='<span>Revenue: <b style="color:#a855f7">'+money(totalRev)+'</b></span>';
        h+='</div>';
        if(cqs.length>0){
          h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">';
          var statusCounts={};
          cqs.forEach(function(q){var s=String(q.status||'draft').toLowerCase();statusCounts[s]=(statusCounts[s]||0)+1;});
          Object.keys(statusCounts).forEach(function(s){
            h+='<span class="'+pillClass(s)+'" style="font-size:9px">'+s+' ('+statusCounts[s]+')</span>';
          });
          h+='</div>';
        }
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ORDERS TAB
  // ═══════════════════════════════════════════════════════════════
  function renderOrdersTab(sos,qs){
    var h='<div class="cs-content">';

    // Recent Sales Orders
    h+='<div class="cs-section">';
    h+='<div class="cs-section-title">Sales Orders</div>';
    h+='<div class="cs-section-sub">Recent and active</div>';
    var sorted=sos.slice().sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0);}).slice(0,15);
    if(sorted.length===0){
      h+='<div class="cs-empty">No sales orders yet</div>';
    } else {
      h+='<div style="display:grid;gap:8px">';
      sorted.forEach(function(so){
        var st=String(so.status||'pending').toLowerCase();
        var stColor=st==='approved'||st==='sent'?'#4ade80':st==='pending'?'#fbbf24':st==='rejected'?'#f87171':'#38bdf8';
        h+='<div class="cs-row" onclick="goView(\'orders\')" style="cursor:pointer;border-left:3px solid '+stColor+'">';
        h+='<div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--ac)">'+esc(so.soNum||so.id||'—')+'</div>';
        h+='<div style="font-size:11px;color:var(--tx)">'+esc(so.company||'')+(so.poNumber?' · PO: '+esc(so.poNumber):'')+'</div></div>';
        h+='<div style="text-align:right"><span class="'+pillClass(st)+'" style="font-size:10px">'+esc(st)+'</span>';
        if(so.total) h+='<div style="font-size:12px;font-weight:700;color:#a855f7;margin-top:2px">'+money(so.total)+'</div>';
        h+='</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';

    // PO Receiving — Won quotes with POs
    h+='<div class="cs-section" style="margin-top:16px">';
    h+='<div class="cs-section-title">PO Receiving</div>';
    h+='<div class="cs-section-sub">Won quotes with purchase orders</div>';
    var wonWithPO=qs.filter(function(q){return q.status==='won'&&q.poNumber;}).sort(function(a,b){return new Date(b.poSignedAt||b.updatedAt||0)-new Date(a.poSignedAt||a.updatedAt||0);}).slice(0,10);
    if(wonWithPO.length===0){
      h+='<div class="cs-empty">No POs received yet</div>';
    } else {
      wonWithPO.forEach(function(q){
        var hasSO=sos.some(function(s){return s.quoteId===q.id;});
        h+='<div class="cs-row">';
        h+='<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--tx)">'+esc(q.fields&&q.fields.custCo||'')+'</div>';
        h+='<div style="font-size:10px;color:var(--tx3)">'+esc(q.quoteNum||'')+' · PO: '+esc(q.poNumber)+'</div></div>';
        h+='<span class="pill '+(hasSO?'pill-won':'pill-pending')+'" style="font-size:10px">'+(hasSO?'SO Created':'Needs SO')+'</span>';
        h+='</div>';
      });
    }
    h+='</div>';

    // Monthly Volume mini chart
    h+='<div class="cs-section" style="margin-top:16px">';
    h+='<div class="cs-section-title">Monthly Order Volume</div>';
    var months={};
    sos.forEach(function(so){
      try{var d=new Date(so.createdAt);var key=d.toLocaleDateString('en-US',{month:'short',year:'2-digit'});months[key]=(months[key]||0)+1;}catch(e){}
    });
    var mKeys=Object.keys(months).slice(-6);
    var maxM=Math.max.apply(null,mKeys.map(function(k){return months[k]||0;}))||1;
    if(mKeys.length===0){
      h+='<div class="cs-empty">Not enough data</div>';
    } else {
      h+='<div style="display:flex;align-items:flex-end;gap:8px;height:100px;padding-top:12px">';
      mKeys.forEach(function(k){
        var pctH=Math.round((months[k]/maxM)*80);
        h+='<div style="flex:1;text-align:center">';
        h+='<div style="font-size:11px;font-weight:700;color:#a855f7;margin-bottom:4px">'+months[k]+'</div>';
        h+='<div style="height:'+Math.max(pctH,4)+'px;background:linear-gradient(180deg,#a855f7,#7c3aed);border-radius:4px 4px 0 0;margin:0 auto;width:80%;transition:height .3s ease"></div>';
        h+='<div style="font-size:9px;color:var(--tx3);margin-top:4px">'+k+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';

    h+='</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ACTIVITY TAB
  // ═══════════════════════════════════════════════════════════════
  function renderActivityTab(){
    var filters=['all','quote','customer','order','so'];
    var filterLabels={all:'All',quote:'Quotes',customer:'Clients',order:'Orders',so:'Sales Orders'};
    var h='<div class="cs-content">';
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">';
    filters.forEach(function(f){
      h+='<button class="cs-tab'+(CS.actFilter===f?' active':'')+'" onclick="setCSActFilter(\''+f+'\')">'+filterLabels[f]+'</button>';
    });
    h+='</div>';
    h+='<div id="cs-full-activity" style="min-height:80px"><div class="cs-empty">Loading activity...</div></div>';
    h+='</div>';
    return h;
  }

  // ─── Async activity loader ───
  function loadRecentActivity(containerId,limit){
    if(!window.fbDb||typeof window.fbDb.collection!=='function') return;
    setTimeout(function(){
      var container=$(containerId);if(!container) return;
      window.fbDb.collection('activity').orderBy('timestamp','desc').limit(limit||10).get().then(function(snap){
        if(!container||!document.body.contains(container)) return;
        var items=[];
        snap.forEach(function(doc){items.push(doc.data());});

        // Client-side filter for activity tab
        if(CS.actFilter&&CS.actFilter!=='all'){
          items=items.filter(function(a){
            var action=String(a.action||'').toLowerCase();
            if(CS.actFilter==='quote') return action.indexOf('quote')>=0;
            if(CS.actFilter==='customer') return action.indexOf('customer')>=0||action.indexOf('client')>=0;
            if(CS.actFilter==='order') return action.indexOf('order')>=0||action.indexOf('po')>=0;
            if(CS.actFilter==='so') return action.indexOf('so.')>=0||action.indexOf('salesorder')>=0;
            return true;
          });
        }

        if(items.length===0){
          container.innerHTML='<div class="cs-empty">No recent activity</div>';
          return;
        }
        var h='';
        items.forEach(function(a){
          var actionColor=String(a.action||'').indexOf('won')>=0?'#4ade80':String(a.action||'').indexOf('lost')>=0?'#f87171':'#a855f7';
          h+='<div class="cs-row" style="padding:8px 0;border-bottom:1px solid var(--bg2)">';
          h+='<div style="flex:1"><span style="font-size:11px;font-weight:700;color:'+actionColor+'">'+esc(a.action||'event')+'</span>';
          h+=' <span style="font-size:11px;color:var(--tx)">'+esc(a.detail||'')+'</span></div>';
          h+='<div style="font-size:10px;color:var(--tx3);white-space:nowrap">'+esc(a.user||'')+'  ·  '+fDate(a.timestamp)+'</div>';
          h+='</div>';
        });
        container.innerHTML=h;
      }).catch(function(err){
        if(container&&document.body.contains(container)){
          container.innerHTML='<div class="cs-empty">Activity unavailable</div>';
        }
      });
    },100);
  }

  console.log('✅ MFX Client Services Hub initialized');
})();
