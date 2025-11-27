window.AdminMetrics = (function() {
  /**
   *
   * @param n
   */
  function formatCount(n) { return typeof n === 'number' ? n.toLocaleString() : '—'; }
  /**
   *
   * @param metrics
   */
  function renderOverview(metrics) {
    const m = metrics || {};
    setText('metricTotalUsers', formatCount(m.totalUsers));
    setText('metricTotalEvaluations', formatCount(m.totalEvaluations));
    setText('metricEval24h', formatCount(m.eval24h));
    setText('metricEval7d', formatCount(m.eval7d));
    setText('metricEval30d', formatCount(m.eval30d));
    setText('metricAvgPerUser', formatCount(m.avgPerUser));
  }
  /**
   *
   * @param perf
   */
  function renderPerformance(perf) {
    const p = perf || {};
    // Grade distribution bar
    try {
      const gd = p.gradeDistribution || {};
      const labels = ['A','B','C','D','E','F','G'];
      const values = labels.map(l => gd[l] || 0);
      window.AdminCharts?.renderGradeDistribution?.('gradeDistributionChart', { labels, values });
      const s = document.getElementById('gradeDistributionSkeleton'); if (s) s.style.display = 'none';
    } catch (_) {}
    // Performance tiers doughnut
    try {
      const tiers = p.performanceTiers || { top: 0, middle: 0, developing: 0 };
      window.AdminCharts?.renderPerformanceTiers?.('performanceTiersChart', tiers);
      const s = document.getElementById('performanceTiersSkeleton'); if (s) s.style.display = 'none';
    } catch (_) {}
    // Section averages bar
    try {
      const avg = p.avgGradeBySection || {};
      const secLabels = Object.keys(avg);
      const secValues = secLabels.map(k => avg[k] ?? 0);
      if (secLabels.length) {
        window.AdminCharts?.renderSectionAverages?.('sectionAveragesChart', secLabels, secValues);
      }
      const s = document.getElementById('sectionAveragesSkeleton'); if (s) s.style.display = 'none';
    } catch (_) {}
  }
  /**
   *
   * @param eng
   */
  function renderEngagement(eng) {
    const e = eng || {};
    // Top Users table
    try {
      const tbody = document.getElementById('topUsersTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        const items = Array.isArray(e.topUsers) ? e.topUsers : [];
        if (!items.length) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 4;
          td.style.color = '#9aa7b8';
          td.textContent = 'No data';
          tr.appendChild(td);
          tbody.appendChild(tr);
        } else {
          items.forEach(u => {
            const tr = document.createElement('tr');
            const name = u.name || u.email || '—';
            const rank = u.rank || '';
            const evals = typeof u.evaluationCount === 'number' ? u.evaluationCount : 0;
            const avg = typeof u.avgScore === 'number' ? u.avgScore.toFixed(2) : '0.00';
            [name, rank, String(evals), String(avg)].forEach(text => {
              const td = document.createElement('td');
              td.textContent = text;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
        }
        const s = document.getElementById('topUsersSkeleton'); if (s) s.style.display = 'none';
      }
    } catch (_) {}
    // Recent Registrations table
    try {
      const tbody = document.getElementById('recentRegsTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        const items = Array.isArray(e.recentRegistrations) ? e.recentRegistrations : [];
        if (!items.length) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 3;
          td.style.color = '#9aa7b8';
          td.textContent = 'No data';
          tr.appendChild(td);
          tbody.appendChild(tr);
        } else {
          items.forEach(r => {
            const tr = document.createElement('tr');
            const name = r.name || r.email || '—';
            const rank = r.rank || '';
            const created = r.createdDate ? new Date(r.createdDate).toLocaleDateString() : '—';
            [name, rank, created].forEach(text => {
              const td = document.createElement('td');
              td.textContent = text;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
        }
        const s = document.getElementById('recentRegsSkeleton'); if (s) s.style.display = 'none';
      }
    } catch (_) {}
    // Rank distribution doughnut
    try {
      const dist = e.userRankDistribution || {};
      const labels = Object.keys(dist);
      const values = labels.map(k => dist[k] ?? 0);
      if (labels.length) {
        window.AdminCharts?.renderRankDistribution?.('rankDistributionChart', labels, values);
        // Build filter controls
        const controls = document.getElementById('rankFilterControls');
        if (controls) {
          controls.innerHTML = '';
          labels.forEach((label) => {
            const id = `rankChk_${label.replace(/\W+/g,'_')}`;
            const wrap = document.createElement('label');
            wrap.style.display = 'inline-flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '4px';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = id;
            cb.checked = true;
            cb.addEventListener('change', () => {
              const selected = labels.filter(l => {
                const el = document.getElementById(`rankChk_${l.replace(/\W+/g,'_')}`);
                return el && el.checked;
              });
              const selValues = selected.map(l => dist[l] ?? 0);
              window.AdminCharts?.renderRankDistribution?.('rankDistributionChart', selected, selValues);
            });
            const text = document.createElement('span');
            text.textContent = label;
            wrap.appendChild(cb);
            wrap.appendChild(text);
            controls.appendChild(wrap);
          });
          // Add quick actions
          const actions = document.createElement('div');
          actions.style.marginTop = '4px';
          const allBtn = document.createElement('button');
          allBtn.textContent = 'All';
          allBtn.addEventListener('click', () => {
            labels.forEach(l => {
              const el = document.getElementById(`rankChk_${l.replace(/\W+/g,'_')}`);
              if (el) el.checked = true;
            });
            window.AdminCharts?.renderRankDistribution?.('rankDistributionChart', labels, values);
          });
          const noneBtn = document.createElement('button');
          noneBtn.textContent = 'None';
          noneBtn.style.marginLeft = '6px';
          noneBtn.addEventListener('click', () => {
            labels.forEach(l => {
              const el = document.getElementById(`rankChk_${l.replace(/\W+/g,'_')}`);
              if (el) el.checked = false;
            });
            window.AdminCharts?.renderRankDistribution?.('rankDistributionChart', [], []);
          });
          actions.appendChild(allBtn);
          actions.appendChild(noneBtn);
          controls.appendChild(actions);
        }
      }
      const s = document.getElementById('rankDistributionSkeleton'); if (s) s.style.display = 'none';
    } catch (_) {}
  }
  /**
   *
   * @param id
   * @param text
   */
  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  return { renderOverview, renderPerformance, renderEngagement };
})();
