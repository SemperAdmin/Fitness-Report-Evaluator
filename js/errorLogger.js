(function (global) {
  'use strict';

  const memoryLogs = [];
  const breadcrumbs = [];
  let user = null;
  let config = {
    appVersion: 'dev',
    environment: 'development',
    remoteEnabled: false,
  remoteUrl: (window.CONSTANTS?.ROUTES?.API?.FEEDBACK) || '/api/feedback',
    maxStored: 500
  };

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
  }

  function toErrorObject(err) {
    if (!err) return { name: 'UnknownError', message: 'Unknown error', stack: '' };
    if (err instanceof Error) {
      return { name: err.name || 'Error', message: err.message || String(err), stack: err.stack || '' };
    }
    // Non-error rejection or thrown value
    return { name: 'NonError', message: typeof err === 'string' ? err : JSON.stringify(err), stack: '' };
  }

  function consoleSink(payload) {
    try {
      const tag = `[ErrorLogger:${payload.severity}]`;
      console.error(tag, payload.message, { ctx: payload.context, stack: payload.stack });
    } catch (_) {}
  }

  function storageSink(payload) {
    try {
      const key = 'fitrep_error_logs';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift(payload);
      const trimmed = arr.slice(0, config.maxStored);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (_) {}
  }

  async function remoteSink(payload) {
    if (!config.remoteEnabled) return;
    try {
      const body = {
        type: 'client_error',
        severity: payload.severity,
        message: payload.message,
        stack: payload.stack,
        context: payload.context,
        breadcrumbs,
        user,
        appVersion: config.appVersion,
        environment: config.environment,
        timestamp: payload.timestamp
      };
      // Reuse existing feedback endpoint for dev logging
      await fetch(config.remoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'error', message: JSON.stringify(body) })
      }).catch(() => {});
    } catch (_) {}
  }

  async function dispatch(payload) {
    memoryLogs.unshift(payload);
    if (memoryLogs.length > config.maxStored) memoryLogs.length = config.maxStored;
    consoleSink(payload);
    storageSink(payload);
    await remoteSink(payload);
    if (payload.severity === 'critical') showErrorBanner(payload);
  }

  function showErrorBanner(payload) {
    try {
      const existing = document.getElementById('globalErrorBanner');
      const banner = existing || document.createElement('div');
      banner.id = 'globalErrorBanner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b00020;color:#fff;padding:10px 14px;z-index:10000;font-family:system-ui,Arial;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
      banner.innerHTML = `⚠️ An error occurred. Please try again. <span style="opacity:.8">(${payload.message})</span>`;
      if (!existing) document.body.appendChild(banner);
    } catch (_) {}
  }

  const ErrorLogger = {
    init(cfg = {}) {
      config = Object.assign({}, config, cfg || {});
      this.installGlobalHandlers();
      return this;
    },
    installGlobalHandlers() {
      // window.onerror
      try {
        global.addEventListener('error', (evt) => {
          const errObj = toErrorObject(evt.error || evt);
          const payload = {
            timestamp: nowIso(),
            severity: 'critical',
            type: errObj.name,
            message: errObj.message,
            stack: errObj.stack,
            context: { source: 'window.onerror', filename: evt.filename, lineno: evt.lineno, colno: evt.colno }
          };
          dispatch(payload);
        });
      } catch (_) {}
      // unhandledrejection
      try {
        global.addEventListener('unhandledrejection', (evt) => {
          const errObj = toErrorObject(evt.reason);
          const payload = {
            timestamp: nowIso(),
            severity: 'critical',
            type: errObj.name,
            message: errObj.message,
            stack: errObj.stack,
            context: { source: 'window.unhandledrejection' }
          };
          dispatch(payload);
        });
      } catch (_) {}
    },
    logError(error, context = {}, severity = 'error') {
      const e = toErrorObject(error);
      const payload = {
        timestamp: nowIso(),
        severity,
        type: e.name,
        message: e.message,
        stack: e.stack,
        context
      };
      return dispatch(payload);
    },
    captureException(error, context) {
      return this.logError(error, context, 'error');
    },
    wrap(fn, context = {}) {
      const self = this;
      return function wrapped(...args) {
        try { return fn.apply(this, args); }
        catch (err) { self.logError(err, context, 'error'); throw err; }
      };
    },
    addBreadcrumb(crumb) {
      try {
        breadcrumbs.push({ ts: nowIso(), ...crumb });
        if (breadcrumbs.length > 100) breadcrumbs.shift();
      } catch (_) {}
    },
    setUser(u) { user = u || null; },
    setConfig(cfg) { config = Object.assign({}, config, cfg || {}); },
    getLogs() { return memoryLogs.slice(0); }
  };

  global.ErrorLogger = ErrorLogger;
  // Auto-init in browser with defaults
  try { ErrorLogger.init(); } catch (_) {}

})(typeof window !== 'undefined' ? window : globalThis);
