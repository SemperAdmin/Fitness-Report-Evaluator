window.AdminDashboard = (function() {
  let refreshBtn, lastRefreshEl;
  let tabs;
  /**
   *
   */
  function init() {
    refreshBtn = document.getElementById('refreshDataBtn');
    lastRefreshEl = document.getElementById('lastRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshData);
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    setupTabs();
    showPanels(false);
  }
  /**
   *
   * @param user
   */
  function onLogin(user) {
    showPanels(true);
    try {
      const titleEl = document.querySelector('#overviewPanel h2');
      if (titleEl) {
        const uname = (user && user.username) ? String(user.username).trim() : '';
        titleEl.textContent = uname ? `Overview - ${uname}` : 'Overview';
      }
    } catch (_) { /* ignore */ }
    refreshData();
    try { window.AdminUsers?.load?.(1); } catch (_) {}
  }
  /**
   *
   */
  async function refreshData() {
    const overviewLoading = document.getElementById('overviewLoading');
    const analyticsLoading = document.getElementById('analyticsLoading');
    if (overviewLoading) overviewLoading.style.display = 'block';
    if (analyticsLoading) analyticsLoading.style.display = 'block';
    // Show skeletons for a smoother loading feel
    try {
      ['topUsersSkeleton','recentRegsSkeleton','gradeDistributionSkeleton','performanceTiersSkeleton','sectionAveragesSkeleton','rankDistributionSkeleton']
        .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; });
    } catch (_) {}
    try {
      const overview = await AdminAPI.get('/metrics/overview');
      if (overview && overview.ok) {
        window.AdminMetrics?.renderOverview?.(overview);
      }
      const performance = await AdminAPI.get('/metrics/performance');
      if (performance && performance.ok) {
        window.AdminMetrics?.renderPerformance?.(performance);
      }
      const engagement = await AdminAPI.get('/metrics/engagement');
      if (engagement && engagement.ok) {
        window.AdminMetrics?.renderEngagement?.(engagement);
      }
      const now = new Date().toLocaleTimeString();
      lastRefreshEl.textContent = `Last refresh: ${now}`;
      if (overviewLoading) overviewLoading.style.display = 'none';
      if (analyticsLoading) analyticsLoading.style.display = 'none';
    } catch (_) {
      if (overviewLoading) overviewLoading.style.display = 'none';
      if (analyticsLoading) analyticsLoading.style.display = 'none';
      // Hide skeletons on error so UI doesn't appear frozen
      try {
        ['topUsersSkeleton','recentRegsSkeleton','gradeDistributionSkeleton','performanceTiersSkeleton','sectionAveragesSkeleton','rankDistributionSkeleton']
          .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      } catch (_) {}
    }
  }
  /**
   *
   */
  async function logout() {
    try {
      await AdminAPI.post('/logout');
    } catch (_) { /* ignore */ }
    // Always navigate back to the main app
    window.location.href = 'index.html';
  }
  /**
   *
   * @param authenticated
   */
  function showPanels(authenticated) {
    const authPanel = document.getElementById('authPanel');
    const overviewPanel = document.getElementById('overviewPanel');
    const usersPanel = document.getElementById('usersPanel');
    const analyticsPanel = document.getElementById('analyticsPanel');
    if (authPanel) authPanel.style.display = authenticated ? 'none' : 'block';
    const show = (panelId) => {
      if (!authenticated) {
        if (overviewPanel) overviewPanel.style.display = 'none';
        if (usersPanel) usersPanel.style.display = 'none';
        if (analyticsPanel) analyticsPanel.style.display = 'none';
        return;
      }
      if (overviewPanel) overviewPanel.style.display = panelId === 'overviewPanel' ? 'block' : 'none';
      if (usersPanel) usersPanel.style.display = panelId === 'usersPanel' ? 'block' : 'none';
      if (analyticsPanel) analyticsPanel.style.display = panelId === 'analyticsPanel' ? 'block' : 'none';
    };
    // Default or persisted tab when authenticated
    if (authenticated) {
      const saved = localStorage.getItem('adminActivePanel');
      const valid = saved === 'overviewPanel' || saved === 'usersPanel' || saved === 'analyticsPanel' ? saved : 'overviewPanel';
      show(valid);
      const tabMap = { overviewPanel: 'tabOverview', usersPanel: 'tabUsers', analyticsPanel: 'tabAnalytics' };
      setActiveTab(tabMap[valid]);
    } else {
      show('overviewPanel');
      setActiveTab('tabOverview');
    }
  }

  /**
   *
   */
  function setupTabs() {
    tabs = {
      overview: document.getElementById('tabOverview'),
      users: document.getElementById('tabUsers'),
      analytics: document.getElementById('tabAnalytics')
    };
    const bind = (btn, panelId, tabId) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        const overviewPanel = document.getElementById('overviewPanel');
        const usersPanel = document.getElementById('usersPanel');
        const analyticsPanel = document.getElementById('analyticsPanel');
        if (overviewPanel) overviewPanel.style.display = panelId === 'overviewPanel' ? 'block' : 'none';
        if (usersPanel) usersPanel.style.display = panelId === 'usersPanel' ? 'block' : 'none';
        if (analyticsPanel) analyticsPanel.style.display = panelId === 'analyticsPanel' ? 'block' : 'none';
        setActiveTab(tabId);
        try { localStorage.setItem('adminActivePanel', panelId); } catch (_) {}
      });
    };
    bind(tabs.overview, 'overviewPanel', 'tabOverview');
    bind(tabs.users, 'usersPanel', 'tabUsers');
    bind(tabs.analytics, 'analyticsPanel', 'tabAnalytics');
  }

  /**
   *
   * @param tabId
   */
  function setActiveTab(tabId) {
    const btns = [document.getElementById('tabOverview'), document.getElementById('tabUsers'), document.getElementById('tabAnalytics')];
    btns.forEach(btn => {
      if (!btn) return;
      if (btn.id === tabId) {
        btn.classList.add('active');
        btn.style.borderBottom = '2px solid #2563eb';
      } else {
        btn.classList.remove('active');
        btn.style.borderBottom = 'none';
      }
    });
  }

  return { init, onLogin };
})();
