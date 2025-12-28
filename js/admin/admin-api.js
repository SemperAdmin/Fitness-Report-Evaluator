window.AdminAPI = (function() {
  function getBase() {
    // Use API_BASE_URL if set (for cross-origin), otherwise relative path
    const override = window.API_BASE_URL || window.API_BASE_URL_OVERRIDE;
    const adminBase = (window.CONSTANTS?.ROUTES?.API?.ADMIN_BASE) || '/api/admin';
    return override ? `${override}${adminBase}` : adminBase;
  }

  function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    // Include session token for cross-origin requests
    try {
      const sessionToken = sessionStorage.getItem('fitrep_session_token');
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const csrfToken = sessionStorage.getItem('fitrep_csrf_token');
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    } catch (_) {}
    return headers;
  }

  async function get(path) {
    const headers = getHeaders();
    delete headers['Content-Type']; // Not needed for GET
    const resp = await fetch(`${getBase()}${path}`, {
      credentials: 'include',
      headers
    });
    if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
    return resp.json();
  }

  async function post(path, body) {
    const resp = await fetch(`${getBase()}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(body || {})
    });
    if (!resp.ok) throw new Error(`POST ${path} failed: ${resp.status}`);
    return resp.json();
  }

  return { get, post };
})();
