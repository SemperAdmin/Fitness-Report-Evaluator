window.AdminAuth = (function() {
  let sessionInfoEl;
  function init() {
    sessionInfoEl = document.getElementById('sessionInfo');
    // On load, attempt to detect an existing admin session created via normal login
    checkSession();
  }
  async function checkSession() {
    try {
      const res = await window.AdminAPI?.get?.('/session');
      if (res && res.ok) {
        const username = res?.user?.username || '';
        if (sessionInfoEl) sessionInfoEl.textContent = username ? `Authenticated (admin) — ${username}` : 'Authenticated (admin)';
        window.AdminDashboard?.onLogin?.(res.user || {});
        return;
      }
    } catch (_) { /* ignore */ }
    // Not authenticated or not admin; instruct user to sign in via main app
    if (sessionInfoEl) sessionInfoEl.textContent = 'Not authenticated — sign in on main app';
  }
  return { init };
})();
