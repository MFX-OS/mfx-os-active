'use strict';
// ═══ MFX OS — ANALYTICS DASHBOARD MODULE ═══
// CEO pipeline, revenue, win rates, department productivity

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

function openAnalytics() {
  S.view = 'analytics';
  document.querySelectorAll('.view').forEach(function(el) { el.classList.remove('active') });
  var target = $('v-analytics');
  if (!target) {
    target = document.createElement('div');
    target.id = 'v-analytics';
    target.className = 'view';
    var container = document.getElementById('viewContainer') || document.querySelector('.views') || document.body;
    container.appendChild(target);
  }
  target.classList.add('active');
  $('mainTabs') && ($('mainTabs').style.display = 'none');
  $('hdrBack') && ($('hdrBack').style.display = 'block');
  if ($('hdrBack')) $('hdrBack').onclick = function() { goView('dashboard') };
  $('hdrTitle') && ($('hdrTitle').textContent = 'Analytics');
  $('hdrActions') && ($('hdrActions').innerHTML = '');
  renderAnalytics();
}

function renderAnalytics() {
  var el = $('v-analytics'); if (!el) return;
  var qs = DB.quotes();
  var me = getUserName();
  var now = new Date();
  var thisMonth = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1);

  // ═══ PIPELINE STATS ═══
  var draft = qs.filter(function(q) { return q.status === 'draft' });
  var approval = qs.filter(function(q) { return q.status === 'approval' });
  var ready = qs.filter(function(q) { return q.status === 'ready' });
  var sent = qs.filter(function(q) { return q.status === 'sent' });
  var won = qs.filter(function(q) { return q.status === 'won' });
  var lost = qs.filter(function(q) { return q.status === 'lost' });
  var totalRev = won.reduce(function(s, q) { return s + (parseFloat(q.wonAmount) || 0) }, 0);
  var winRate = (won.length + lost.length) > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0;

  var h = '';

  // ═══ REVENUE HERO ═══
  h += '<div style="background:linear-gradient(135deg,#052e16,#0a1520);border:1px solid var(--gn);border-radius:12px;padding:16px;margin-bottom:10px;text-align:center">';
  h += '<div style="font-size:10px;color:var(--gn);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Revenue Won</div>';
  h += '<div style="font-size:28px;font-weight:800;color:#4ade80">$' + totalRev.toLocaleString('en-US', {minimumFractionDigits: 2}) + '</div>';
  h += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">' + won.length + ' won · ' + lost.length + ' lost · ' + winRate + '% win rate</div></div>';

  // ═══ PIPELINE FUNNEL ═══
  h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px">📊 Quote Pipeline</div>';
  var stages = [
    { name: 'Draft', count: draft.length, color: 'var(--neon-purple)', pct: 100 },
    { name: 'Approval', count: approval.length, color: '#f59e0b', pct: 85 },
    { name: 'Ready', count: ready.length, color: 'var(--neon-blue)', pct: 70 },
    { name: 'Sent', count: sent.length, color: 'var(--ac)', pct: 55 },
    { name: 'Won', count: won.length, color: 'var(--gn)', pct: 40 },
    { name: 'Lost', count: lost.length, color: 'var(--rd)', pct: 25 }
  ];
  h += '<div style="margin-bottom:12px">';
  stages.forEach(function(s) {
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    h += '<div style="width:60px;font-size:9px;color:var(--tx3);text-align:right">' + s.name + '</div>';
    h += '<div style="flex:1;height:20px;background:var(--bg3);border-radius:4px;overflow:hidden;position:relative">';
    var barW = s.count > 0 ? Math.max(8, Math.min(100, s.count / Math.max(1, draft.length) * 100)) : 0;
    h += '<div style="height:100%;width:' + barW + '%;background:' + s.color + ';border-radius:4px;transition:width .5s"></div>';
    h += '</div>';
    h += '<div style="width:30px;font-size:12px;font-weight:700;color:' + s.color + '">' + s.count + '</div></div>';
  });
  h += '</div>';

  // ═══ THIS MONTH ACTIVITY ═══
  var monthQuotes = qs.filter(function(q) { var ca = typeof q.createdAt === 'string' ? q.createdAt : (q.createdAt && q.createdAt.toDate ? q.createdAt.toDate().toISOString() : ''); return ca && ca.startsWith(thisMonth) });
  var monthWon = qs.filter(function(q) { var wd = typeof q.wonDate === 'string' ? q.wonDate : (q.wonDate && q.wonDate.toDate ? q.wonDate.toDate().toISOString() : ''); return q.status === 'won' && wd && wd.startsWith(thisMonth) });
  var monthSent = qs.filter(function(q) { var sa = typeof q.sentAt === 'string' ? q.sentAt : (q.sentAt && q.sentAt.toDate ? q.sentAt.toDate().toISOString() : ''); return q.status === 'sent' && sa && sa.startsWith(thisMonth) });
  var monthRev = monthWon.reduce(function(s, q) { return s + (parseFloat(q.wonAmount) || 0) }, 0);

  h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px">📅 This Month</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:12px">';
  h += '<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--neon-purple)">' + monthQuotes.length + '</div><div style="font-size:7px;color:var(--tx3)">Created</div></div>';
  h += '<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--ac)">' + monthSent.length + '</div><div style="font-size:7px;color:var(--tx3)">Sent</div></div>';
  h += '<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--gn)">' + monthWon.length + '</div><div style="font-size:7px;color:var(--tx3)">Won</div></div>';
  h += '<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--gn)">$' + (monthRev > 999 ? Math.round(monthRev / 1000) + 'K' : Math.round(monthRev)) + '</div><div style="font-size:7px;color:var(--tx3)">Revenue</div></div></div>';

  // ═══ ESTIMATOR LEADERBOARD ═══
  h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px">👤 Estimator Performance</div>';
  var estimators = {};
  qs.forEach(function(q) {
    var u = q.createdBy || (q.fields && q.fields.estimator) || 'Unknown';
    if (!estimators[u]) estimators[u] = { total: 0, won: 0, lost: 0, sent: 0, rev: 0 };
    estimators[u].total++;
    if (q.status === 'won') { estimators[u].won++; estimators[u].rev += (parseFloat(q.wonAmount) || 0) }
    if (q.status === 'lost') estimators[u].lost++;
    if (q.status === 'sent') estimators[u].sent++;
  });

  var sortedEst = Object.entries(estimators).sort(function(a, b) { return b[1].rev - a[1].rev });
  sortedEst.forEach(function(e, i) {
    var u = e[0], d = e[1];
    var wr = (d.won + d.lost) > 0 ? Math.round(d.won / (d.won + d.lost) * 100) : 0;
    h += '<div class="card" style="padding:8px 10px;display:flex;align-items:center;gap:8px">';
    h += '<div style="width:20px;height:20px;border-radius:50%;background:' + (i === 0 ? 'var(--gn)' : i === 1 ? 'var(--ac)' : 'var(--bg4)') + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:' + (i < 2 ? '#000' : 'var(--tx3)') + '">' + (i + 1) + '</div>';
    h += '<div style="flex:1"><div style="font-size:11px;font-weight:600;color:var(--tx)">' + u + '</div>';
    h += '<div style="font-size:8px;color:var(--tx3)">' + d.total + ' quotes · ' + d.won + ' won · ' + wr + '% win</div></div>';
    h += '<div style="text-align:right"><div style="font-size:12px;font-weight:700;color:var(--gn)">$' + (d.rev > 999 ? Math.round(d.rev / 1000) + 'K' : Math.round(d.rev)) + '</div>';
    h += '<div style="font-size:8px;color:var(--tx3)">revenue</div></div></div>';
  });

  // ═══ TIME-TO-CLOSE ═══
  var closeTimes = won.filter(function(q) { return q.createdAt && q.wonDate }).map(function(q) {
    return Math.ceil((new Date(q.wonDate) - new Date(q.createdAt)) / 86400000);
  }).filter(function(d) { return d > 0 && d < 365 });
  var avgClose = closeTimes.length ? Math.round(closeTimes.reduce(function(a, b) { return a + b }, 0) / closeTimes.length) : 0;

  h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin:10px 0 6px">⏱ Metrics</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px">';
  h += '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--ac)">' + avgClose + '</div><div style="font-size:8px;color:var(--tx3)">Avg Days to Close</div></div>';
  h += '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:' + (winRate >= 50 ? 'var(--gn)' : 'var(--or)') + '">' + winRate + '%</div><div style="font-size:8px;color:var(--tx3)">Win Rate</div></div>';
  var avgDeal = won.length ? Math.round(totalRev / won.length) : 0;
  h += '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--gn)">$' + (avgDeal > 999 ? Math.round(avgDeal / 1000) + 'K' : avgDeal) + '</div><div style="font-size:8px;color:var(--tx3)">Avg Deal Size</div></div></div>';

  // ═══ TOP CLIENTS BY REVENUE ═══
  h += '<div style="font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px">🏢 Top Clients</div>';
  var clients = {};
  won.forEach(function(q) {
    var co = (q.fields && q.fields.custCo) || 'Unknown';
    if (!clients[co]) clients[co] = { rev: 0, count: 0 };
    clients[co].rev += (parseFloat(q.wonAmount) || 0);
    clients[co].count++;
  });
  var sortedClients = Object.entries(clients).sort(function(a, b) { return b[1].rev - a[1].rev }).slice(0, 5);
  sortedClients.forEach(function(e) {
    h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bdr);font-size:11px">';
    h += '<span style="color:var(--ac)">' + e[0] + ' <span style="color:var(--tx3);font-size:9px">(' + e[1].count + ' orders)</span></span>';
    h += '<span style="color:var(--gn);font-weight:600">$' + e[1].rev.toLocaleString() + '</span></div>';
  });

  el.innerHTML = h;
}
