window.AdminAPI = (function() {
  const base = '/api/admin';
  async function get(path) {
    const resp = await fetch(`${base}${path}`, { credentials: 'include' });
    if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
    return resp.json();
  }
  async function post(path, body) {
    const resp = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body || {})
    });
    if (!resp.ok) throw new Error(`POST ${path} failed: ${resp.status}`);
    return resp.json();
  }
  return { get, post };
})();
