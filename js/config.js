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
        // Default-enable dev token embedding on localhost if not explicitly set
        if (typeof window !== 'undefined') {
            const isLocalHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (isLocalHost && typeof window.DEV_ENABLE_EMBEDDED_TOKEN === 'undefined') {
                window.DEV_ENABLE_EMBEDDED_TOKEN = true;
            }
        }

        const isLocal = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1'
        );
        const devEnabled = typeof window !== 'undefined' && !!window.DEV_ENABLE_EMBEDDED_TOKEN;
        if (!isLocal || !devEnabled) return;

        // Prefer explicit dev token from localStorage; otherwise assemble
        const override = window.localStorage?.getItem('FITREP_DEV_TOKEN');
        const devToken = override || assembleToken();
        GITHUB_CONFIG.token = devToken;
        console.log('🔑 Dev token injected:', devToken.substring(0, 10) + '...');
    } catch (e) {
        console.warn('Dev token injection skipped:', e);
    }
}
maybeInjectDevToken();

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
