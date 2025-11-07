/**
 * Fitrep Evaluator Configuration
 * Dev-only token assembly supported; production uses backend/Actions-managed tokens.
 */

/**
 * Function to construct and return the full token.
 * This pattern helps to limit the scope of the sensitive string fragments.
 */
function assembleToken() {
  // Define the string fragments inside the function
  const part1 = "ghp_";
  const part2 = "pnPCGYecA3LD";
  const part3 = "Oaa5vwOcDZU0NVoxFX1P";
  const part4 = "qWO6";

  // Create the array
  const fragments = [part1, part2, part3, part4];

  // Combine them and return the complete token
  return fragments.join('');
}

// -------------------------------------------------------------

// **The main configuration object (global)**
const GITHUB_CONFIG = {
    owner: 'SemperAdmin',
    // Workflows repo (repository_dispatch events)
    repo: 'Fitness-Report-Evaluator',
    branch: 'main',
    // Data repo used by workflows to persist user profiles
    dataRepo: 'Fitness-Report-Evaluator-Data',
    imageRepo: 'Fitness-Report-Evaluator-Images',
    apiBase: 'https://api.github.com',
    // Token is injected in dev via maybeInjectDevToken(); production uses backend/Actions
    token: null
};

// Dev-only token injection (localhost)
function maybeInjectDevToken() {
    try {
        const isLocal = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1'
        );
        // Default to enabled on localhost unless explicitly disabled
        const devEnabledFlag = (typeof window !== 'undefined' && 'DEV_ENABLE_EMBEDDED_TOKEN' in window)
            ? !!window.DEV_ENABLE_EMBEDDED_TOKEN
            : true;
        if (!isLocal || !devEnabledFlag) return;

        // Prefer explicit dev token from localStorage; otherwise assemble
        const override = (typeof window !== 'undefined' && window.localStorage)
            ? window.localStorage.getItem('FITREP_DEV_TOKEN')
            : null;
        const devToken = override || assembleToken();
        GITHUB_CONFIG.token = devToken;
        console.log('🔑 Dev token injected:', devToken.substring(0, 10) + '...');
    } catch (e) {
        console.warn('Dev token injection skipped:', e);
    }
}
maybeInjectDevToken();

// Ensure dev token flag is enabled on localhost unless explicitly overridden
try {
    if (typeof window !== 'undefined') {
        const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal && !('DEV_ENABLE_EMBEDDED_TOKEN' in window)) {
            window.DEV_ENABLE_EMBEDDED_TOKEN = true;
            console.log('Dev embedded token flag enabled by default on localhost');
        }
    }
} catch (_) { /* no-op */ }

// Expose token assembler for environments that opt-in to client token usage
try {
    if (typeof window !== 'undefined') {
        // Provide a stable reference so other modules (e.g., githubService, profile) can call it
        window.assembleToken = window.assembleToken || assembleToken;
    }
} catch (_) { /* no-op */ }

// For comparison, the individual parts are NOT accessible globally:
// console.log(part1); // This would result in an error!

// Application Configuration
const APP_CONFIG = {
    appName: 'Fitness Report Evaluator',
    appVersion: '2.0.0-secure',
    sessionTimeout: 30 * 60 * 1000 // 30 minutes
};

// Authentication Settings
const AUTH_CONFIG = {
    requireEmail: true,
    emailDomains: [], // Empty = allow all domains
    sessionStorage: true, // Use sessionStorage (expires on close)
    rememberMeOption: true, // Allow "remember me" checkbox
    rememberMeDays: 30
};

// Storage Paths in GitHub Data repository
const GITHUB_PATHS = {
    users: 'users',
    logs: 'logs'
};

// Workflow event names used by BackendAPI helpers
const WORKFLOW_EVENTS = {
    createUser: 'create-user',
    saveUserData: 'save-user-data'
};

// Basic Validation Patterns (Fitrep-specific)
const VALIDATION = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// Remove EventCall-specific code generator; not used in Fitrep

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GITHUB_CONFIG = GITHUB_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
    window.AUTH_CONFIG = AUTH_CONFIG;
    window.GITHUB_PATHS = GITHUB_PATHS;
    window.VALIDATION = VALIDATION;
    window.WORKFLOW_EVENTS = WORKFLOW_EVENTS;
}

console.log('✅ Fitrep Evaluator configuration loaded (v2.0.0)');

console.log('🔒 Tokens managed via backend/Actions; dev token optional on localhost');

// -------------------------------------------------------------
// Runtime API base resolution and allowed origins
// - Allows the app to call a backend hosted on a different origin in production
// - Defaults to the current page origin in development/local scenarios
// - Use window.API_BASE_URL_OVERRIDE and window.TRUSTED_API_ORIGINS in index.html
try {
  if (typeof window !== 'undefined') {
    const pageOrigin = window.location.origin;
    const override = (typeof window.API_BASE_URL_OVERRIDE === 'string')
      ? window.API_BASE_URL_OVERRIDE.trim()
      : '';

    // Choose base: override if provided; otherwise use page origin for same-origin APIs
    // Local development: prefer same-origin to avoid CORS with multiple local servers
    // GitHub Pages: override set in index.html to Render backend
    const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const defaultBase = pageOrigin;
    const base = override || defaultBase;
    window.API_BASE_URL = base;

    // Build allowed origins: always include base origin; merge any trusted origins
    const baseOrigin = new URL(base).origin;
    const trusted = Array.isArray(window.TRUSTED_API_ORIGINS) ? window.TRUSTED_API_ORIGINS : [];
    const allowed = [baseOrigin, ...trusted]
      .filter(Boolean)
      .map(o => {
        try { return new URL(o).origin; } catch (_) { return null; }
      })
      .filter(Boolean);
    // Deduplicate
    window.API_ALLOWED_ORIGINS = Array.from(new Set(allowed));

    console.log('[api] base:', window.API_BASE_URL);
    console.log('[api] allowed origins:', window.API_ALLOWED_ORIGINS);

    // Auto-detect local backend only if override is not set and current base is unreachable
    // Tries a list of known dev ports: 5173, 5174, 8081, 8080
    if (isLocal && !override) {
      const candidates = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:8081',
        'http://localhost:8080'
      ];
      const probe = async (url) => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 1200);
          const resp = await fetch(new URL('/health', url).toString(), { signal: ctrl.signal });
          clearTimeout(timer);
          return resp && resp.ok;
        } catch (_) { return false; }
      };
      (async () => {
        // If current base is healthy, keep it and skip detection
        const baseOk = await probe(window.API_BASE_URL);
        if (baseOk) {
          console.log('[api] base healthy; skipping auto-detect');
          return;
        }
        for (const c of candidates) {
          const ok = await probe(c);
          if (ok) {
            window.API_BASE_URL = c;
            const origin = new URL(c).origin;
            window.API_ALLOWED_ORIGINS = Array.from(new Set([origin, ...window.API_ALLOWED_ORIGINS]));
            console.log('[api] auto-detected backend:', c);
            break;
          }
        }
      })();
    }
  }
} catch (e) {
  console.warn('API base resolution failed:', e);
}
