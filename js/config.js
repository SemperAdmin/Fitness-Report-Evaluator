// Lightweight client-side API base configuration.
// Defaults to current origin if http(s); otherwise falls back to local server.
(function () {
  try {
    const origin = window.location.origin || '';
    const override = window.API_BASE_URL_OVERRIDE || '';
    const isHttp = (u) => typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'));
    const trusted = Array.isArray(window.TRUSTED_API_ORIGINS) ? window.TRUSTED_API_ORIGINS : [];
    let base = isHttp(origin) ? origin : 'http://127.0.0.1:5173';
    if (override && isHttp(override)) {
      const baseOrigin = new URL(base).origin;
      const overrideOrigin = new URL(override).origin;
      const isAllowedOverride = overrideOrigin === baseOrigin || trusted.includes(overrideOrigin);
      if (isAllowedOverride) {
        base = override;
      }
    }
    // Normalize by removing trailing slash
    if (base.endsWith('/')) {
      base = base.slice(0, -1);
    }
    window.API_BASE_URL = base;
    const allowed = [new URL(base).origin].concat(trusted.filter(Boolean));
    window.API_ALLOWED_ORIGINS = allowed;
  } catch (e) {
    window.API_BASE_URL = 'http://127.0.0.1:5173';
    try {
      window.API_ALLOWED_ORIGINS = [new URL(window.API_BASE_URL).origin];
    } catch (_) {
      window.API_ALLOWED_ORIGINS = ['http://127.0.0.1:5173'];
    }
  }
})();
