// Profile Management System
let currentProfile = null;
let profileEvaluations = [];
let syncQueue = [];
// In-memory cache for expanded evaluation details (with automatic size management)
const evaluationDetailsCache = typeof ManagedCache !== 'undefined'
    ? new ManagedCache(100)
    : new Map();

// Performance optimization instances
let tableRenderer = null; // OptimizedTableRenderer instance

let rafQueue = new RAFQueue(); // Request Animation Frame queue for smooth updates

// ============================================================================
// MILITARY DATA HELPERS
// ============================================================================

/**
 * Populate a branch select element with options from MilitaryData
 * @param {string} selectId - ID of the select element
 * @param {string} [selectedValue] - Optional value to select
 */
function populateBranchSelect(selectId, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select || !window.MilitaryData) return;

    // Clear existing options except the first one (placeholder)
    while (select.options.length > 1) {
        select.remove(1);
    }

    window.MilitaryData.branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.value;
        option.textContent = branch.label;
        if (branch.value === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Populate a rank select element based on the selected branch
 * @param {string} branchSelectId - ID of the branch select element
 * @param {string} rankSelectId - ID of the rank select element
 * @param {string} [selectedRank] - Optional rank to select
 */
function populateRankSelect(branchSelectId, rankSelectId, selectedRank) {
    const branchSelect = document.getElementById(branchSelectId);
    const rankSelect = document.getElementById(rankSelectId);

    if (!branchSelect || !rankSelect || !window.MilitaryData) return;

    const branchValue = branchSelect.value;

    // Clear existing options except the first one
    while (rankSelect.options.length > 1) {
        rankSelect.remove(1);
    }

    if (!branchValue) return;

    const ranks = window.MilitaryData.getRanksForBranch(branchValue);

    ranks.forEach(rank => {
        const option = document.createElement('option');
        option.value = rank.value;
        option.textContent = rank.label;
        if (rank.value === selectedRank) {
            option.selected = true;
        }
        rankSelect.appendChild(option);
    });
}

// Expose globally for onchange handlers
window.populateRankSelect = populateRankSelect;

/**
 * Profile Authentication: Local-only login path.
 * Validates input, loads local/IndexedDB evaluations, and updates dashboard.
 *
 * @returns {Promise<void>}
 * @throws {Error} On unexpected storage access errors.
 */
async function profileLogin() {
    const rank = document.getElementById('rsRankInput').value.trim();
    const name = document.getElementById('rsNameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();

    if (!rank || !name || !email) {
        alert('Complete all fields to access your profile.');
        return;
    }

    const profileKey = generateProfileKey(name, email);

    // Load local first
    let profile = loadProfileFromLocal(profileKey);
    // Prefer IndexedDB index for local persistence; fall back to localStorage snapshot
    let localEvaluations = [];
    try {
        if (window.idbStore) {
            localEvaluations = await window.idbStore.getIndex(email);
        }
    } catch (_) { /* ignore */ }
    if (!Array.isArray(localEvaluations) || localEvaluations.length === 0) {
        localEvaluations = loadEvaluationsFromLocal(profileKey);
    }

    // Try remote; merge and persist for offline-first UX
    const { profile: mergedProfile, evaluations: mergedEvaluations } =
        await tryLoadRemoteProfile(email, name, rank, profileKey, profile, localEvaluations);

    profile = mergedProfile;
    localEvaluations = mergedEvaluations;

    // Create new profile if none exists
    if (!profile) {
        profile = {
            full_name: name,
            email: email,
            rank: rank,
            // Legacy fields for compatibility
            rsName: name,
            rsEmail: email,
            rsRank: rank,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalEvaluations: Array.isArray(localEvaluations) ? localEvaluations.length : 0,
            // evaluationFiles removed; evaluations stored as separate files
        };
    }

    currentProfile = profile;
    profileEvaluations = localEvaluations;

    // Persist snapshot for auto-load
    localStorage.setItem('current_profile', JSON.stringify(currentProfile));
    localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
    localStorage.setItem('has_profile', 'true');
    // Persist index to IndexedDB for offline-first
    try { if (window.idbStore) { await window.idbStore.putIndex(email, profileEvaluations); } } catch (_) { }

    // Session-only: mark that the user explicitly logged in this session
    sessionStorage.setItem('login_source', 'form');

    showProfileDashboard();
}

/**
 * Create Account: Sends rank, name, email, and password to backend.
 * Client-side validation mirrors server rules.
 *
 * @returns {Promise<void>}
 */
async function createAccount() {
    const branch = document.getElementById('caBranchInput')?.value;
    const rank = document.getElementById('caRankInput')?.value;
    const name = document.getElementById('caNameInput')?.value.trim();
    const email = document.getElementById('caEmailInput')?.value.trim();
    const password = document.getElementById('caPasswordInput')?.value;
    const confirm = document.getElementById('caPasswordConfirmInput')?.value;

    if (!branch || !rank || !name || !email || !password) {
        alert('Please complete all fields.');
        return;
    }

    // Client-side username format validation (align with server rules)
    if (!isValidUsernameClient(email)) {
        alert('Invalid username format. Use 3–50 chars: letters, numbers, ., _, -');
        return;
    }

    // Client-side rank and name validation (align with server rules)
    if (!isValidRankClient(rank)) {
        alert('Invalid rank. Use 2–20 characters.');
        return;
    }
    if (!isValidNameClient(name)) {
        alert('Invalid name. Use 2–100 characters.');
        return;
    }

    // Client-side password strength validation (align with server rules)
    if (!isStrongPasswordClient(password)) {
        alert('Password must be 8+ chars with upper, lower, and a number.');
        return;
    }

    // Local-only validation: ensure confirm password matches the original
    if (typeof confirm === 'string' && confirm.length > 0 && confirm !== password) {
        alert('Passwords do not match. Please re-enter to confirm.');
        return;
    }

    // Preflight: check username availability
    // Removed availability preflight; rely on server-side uniqueness check during create

    try {
        // Send explicit username for clarity; keep email for compatibility
        const CREATE_ROUTE = (window.CONSTANTS?.ROUTES?.API?.ACCOUNT_CREATE) || '/api/account/create';
        const res = await postJson(CREATE_ROUTE, { branch, rank, name, email, username: email, password });
        if (!res || !res.ok) {
            const msg = res && res.error ? res.error : 'Account creation failed.';
            alert(msg);
            return;
        }

        // Optionally hydrate local profile for immediate UX
        const profileKey = generateProfileKey(name, email);
        const profile = {
            full_name: name,
            email: email,
            rank: rank,
            branch: branch,
            // Legacy fields
            rsName: name,
            rsEmail: email,
            rsRank: rank,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalEvaluations: 0,
            // evaluationFiles removed; evaluations stored as separate files
        };
        saveProfileToLocal(profileKey, profile);
        currentProfile = profile;
        profileEvaluations = [];
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
        localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
        localStorage.setItem('has_profile', 'true');
        sessionStorage.setItem('login_source', 'form');

        alert('Account created. You are now signed in.');
        showProfileDashboard();
    } catch (err) {
        console.error('createAccount error:', err);
        alert('Account creation failed due to a network error.');
    }
}

/**
 * Account Login: username (email) + password.
 * Handles UI state, validates format, and hydrates evaluations.
 *
 * @returns {Promise<void>}
 */
async function accountLogin() {
    const email = document.getElementById('loginEmailInput')?.value.trim();
    const password = document.getElementById('loginPasswordInput')?.value;
    if (!email || !password) {
        alert('Please enter Username and Password.');
        return;
    }

    // Client-side username validation to reduce server round-trips
    if (!isValidUsernameClient(email)) {
        alert('Invalid username format. Use 3–50 chars: letters, numbers, ., _, -');
        return;
    }

    // Show typewriter animation during login, hide input fields
    const loginCard = document.getElementById('profileLoginCard');
    const typewriter = loginCard ? loginCard.querySelector('.typewriter-wrapper') : null;
    const loginFieldsEl = document.getElementById('loginFields');
    if (typewriter) typewriter.style.display = 'flex';
    if (loginFieldsEl) loginFieldsEl.style.display = 'none';

    try {
        // Send explicit username for clarity; keep email for compatibility
        const LOGIN_ROUTE = (window.CONSTANTS?.ROUTES?.API?.ACCOUNT_LOGIN) || '/api/account/login';
        let res = await postJson(LOGIN_ROUTE, { email, username: email, password });
        // If network/CORS failed, retry using URL-encoded to avoid preflight
        if (!res || (!res.ok && res.status === 0)) {
            res = await postForm(LOGIN_ROUTE, { email, username: email, password });
        }
        if (!res || !res.ok) {
            // Restore UI when login fails
            if (typewriter) typewriter.style.display = 'none';
            if (loginFieldsEl) loginFieldsEl.style.display = 'block';
            const status = res && typeof res.status === 'number' ? res.status : 0;
            let msg = res && res.error ? res.error : '';
            if (typeof msg === 'string' && msg.includes('Invalid username format')) {
                msg = 'Invalid username format. Use 3–50 chars: letters, numbers, ., _, -';
            }
            if (!msg) {
                if (status === 401) msg = 'Invalid username or password.';
                else if (status === 403) msg = 'Access denied. Try same-origin login or clear cookies.';
                else if (status === 429) msg = 'Too many attempts. Please wait and retry.';
                else if (status >= 500) msg = 'Service unavailable. Please try again shortly.';
                else msg = 'Login failed. Check credentials or network.';
            }
            showToast(msg, 'error');
            return;
        }

        const user = res.user || {};
        const baseProfile = res.profile || {
            full_name: user.name || user.full_name || res.rsName,
            email: user.contactEmail || user.email || '',
            rank: user.rank || res.rsRank,
            branch: user.branch || 'USMC',
            rsName: user.name || user.full_name || res.rsName,
            rsEmail: user.username || email,
            rsRank: user.rank || res.rsRank,
            lastUpdated: new Date().toISOString()
        };

        // Prefer contactEmail from server user file if available
        try {
            const USER_LOAD_ROUTE = (window.CONSTANTS?.ROUTES?.API?.USER_LOAD) || '/api/user/load';
            const base = window.API_BASE_URL || location.origin;
            const url = new URL(USER_LOAD_ROUTE, base);
            url.searchParams.set('email', email);
            const headers = {};
            try {
                const csrf = (typeof getCsrfToken === 'function') ? getCsrfToken() : (sessionStorage.getItem('fitrep_csrf_token') || '');
                if (csrf) headers['X-CSRF-Token'] = csrf;
            } catch (_) {}
            try {
                const sessTok = sessionStorage.getItem('fitrep_session_token') || '';
                if (sessTok) headers['Authorization'] = `Bearer ${sessTok}`;
            } catch (_) {}
            const resp = await fetch(url.toString(), { method: 'GET', headers, credentials: 'include' });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && data?.data && typeof data.data === 'object') {
                const repoEmail = (data.data.contactEmail || '').trim();
                if (repoEmail) baseProfile.email = repoEmail;
            }
        } catch (e) {
            /* ignore load failures; fall back to existing baseProfile.email */
        }

        // Store CSRF token from login response for cross-origin requests
        // (JavaScript cannot read cross-domain cookies via document.cookie)
        if (res.csrfToken) {
            try {
                sessionStorage.setItem('fitrep_csrf_token', res.csrfToken);
                debugLog('[csrf] Stored CSRF token from login response:', res.csrfToken.substring(0, 8) + '...');
            } catch (_) {
                debugWarn('[csrf] Failed to store CSRF token in sessionStorage');
            }
        } else {
            debugWarn('[csrf] No CSRF token in login response - backend may not have been updated');
        }

        // Store session token for Authorization header fallback (cross-origin)
        if (res.sessionToken) {
            try { sessionStorage.setItem('fitrep_session_token', res.sessionToken); } catch (_) {}
        }

        // Prefer Supabase backend for evaluations list
        let evaluations = [];
        try {
            const LIST_ROUTE = (window.CONSTANTS?.ROUTES?.API?.EVALUATIONS_LIST) || '/api/evaluations/list';
            const base = window.API_BASE_URL || location.origin;
            const url = new URL(LIST_ROUTE, base);
            url.searchParams.set('email', email);
            const headers = {};
            try {
                const csrf = (typeof getCsrfToken === 'function') ? getCsrfToken() : (sessionStorage.getItem('fitrep_csrf_token') || '');
                if (csrf) headers['X-CSRF-Token'] = csrf;
            } catch (_) {}
            try {
                const sessTok = sessionStorage.getItem('fitrep_session_token') || '';
                if (sessTok) headers['Authorization'] = `Bearer ${sessTok}`;
            } catch (_) {}
            const resp = await fetch(url.toString(), { method: 'GET', headers, credentials: 'include' });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && Array.isArray(data?.evaluations)) {
                evaluations = data.evaluations;
            } else {
                console.warn('Backend evaluations list failed; falling back to local');
                evaluations = loadEvaluationsFromLocal(generateProfileKey(baseProfile.rsName, baseProfile.rsEmail)) || [];
            }
        } catch (e) {
            console.error('Backend evaluations list error:', e);
            evaluations = loadEvaluationsFromLocal(generateProfileKey(baseProfile.rsName, baseProfile.rsEmail)) || [];
        }
        const profile = { ...baseProfile, totalEvaluations: Array.isArray(evaluations) ? evaluations.length : 0 };

        const profileKey = generateProfileKey(profile.rsName, profile.rsEmail);
        saveProfileToLocal(profileKey, profile);
        currentProfile = profile;
        profileEvaluations = evaluations;
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
        localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
        localStorage.setItem('has_profile', 'true');
        sessionStorage.setItem('login_source', 'form');

        // Hide animation before transitioning to dashboard
        if (typewriter) typewriter.style.display = 'none';
        showProfileDashboard();

        // Auto-sync any locally pending evaluations after successful login
        try {
            if (typeof hasPendingSyncs === 'function' && hasPendingSyncs()) {
                await syncAllEvaluations();
            }
        } catch (err) {
            console.warn('Background sync attempt failed after login:', err);
        }
    } catch (err) {
        console.error('accountLogin error:', err);
        // Restore UI on network error
        if (typewriter) typewriter.style.display = 'none';
        if (loginFieldsEl) loginFieldsEl.style.display = 'block';
        const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false;
        const msg = offline ? 'Offline: connect to login.' : 'Network error during login. Please retry.';
        showToast(msg, 'error');
    }
}

// Client-side validators mirroring server-side rules
function isValidUsernameClient(username) {
    const u = String(username || '').trim();
    if (u.length < 3 || u.length > 50) return false;
    return /^[a-zA-Z0-9._-]+$/.test(u);
}
function isStrongPasswordClient(pw) {
    const p = String(pw || '');
    if (p.length < 8) return false;
    const hasLower = /[a-z]/.test(p);
    const hasUpper = /[A-Z]/.test(p);
    const hasDigit = /\d/.test(p);
    return hasLower && hasUpper && hasDigit;
}
function isValidNameClient(name) {
    const n = String(name || '').trim();
    return n.length >= 2 && n.length <= 100;
}
function isValidRankClient(rank) {
    const r = String(rank || '').trim();
    return r.length >= 2 && r.length <= 20;
}

// Small helper for backend POST with offline detection and retry
/**
 * POST JSON helper.
 * Sends JSON body to API route and returns normalized result.
 *
 * @param {string} url API route.
 * @param {Object} body JSON serializable payload.
 * @returns {Promise<{ok:boolean,status:number,error?:string,profile?:Object,rsName?:string,rsRank?:string} | null>}
 */
async function postJson(url, body) {
    const base = (typeof window !== 'undefined' && window.API_BASE_URL)
        ? window.API_BASE_URL
        : window.location.origin;

    // Resolve against base and enforce allowlisted origins
    const resolvedUrl = new URL(url, base);
    const baseOrigin = new URL(base).origin;
    const allowedOrigins = Array.isArray(window.API_ALLOWED_ORIGINS)
        ? window.API_ALLOWED_ORIGINS
        : [baseOrigin];
    const endpointOrigin = resolvedUrl.origin;
    const isLocal = (() => { try { const h = new URL(endpointOrigin).hostname.toLowerCase(); return (h === 'localhost' || h === '127.0.0.1' || h === '::1'); } catch (_) { return false; } })();
    const isAllowed = (typeof window !== 'undefined' && typeof window.isOriginAllowed === 'function')
        ? window.isOriginAllowed(endpointOrigin)
        : (isLocal || allowedOrigins.includes(endpointOrigin));
    if (!isAllowed) {
        throw new Error('Requests to untrusted origins are blocked.');
    }
    const endpoint = resolvedUrl.toString();

    // Build headers; include token when enabled
    const headers = { 'Content-Type': 'application/json' };
    // Include CSRF token: try sessionStorage first (for cross-origin), then cookie (for same-origin)
    const csrf = getCsrfToken();
    if (csrf) {
        headers['X-CSRF-Token'] = csrf;
        debugLog('[csrf] Set X-CSRF-Token header:', csrf.substring(0, 16) + '...');
    } else {
        debugWarn('[csrf] No CSRF token available to set in header for endpoint:', endpoint);
    }
    let assembledToken = null;
    try {
        let token = (typeof window !== 'undefined' && window.GITHUB_CONFIG && window.GITHUB_CONFIG.token)
            ? window.GITHUB_CONFIG.token
            : null;
        // Optional: allow using assembleToken in production when explicitly enabled
        if (!token && typeof window !== 'undefined' && typeof window.assembleToken === 'function' && window.USE_ASSEMBLED_TOKEN === true) {
            try { assembledToken = window.assembleToken(); } catch (_) { assembledToken = null; }
            token = assembledToken || token;
        }
        if (token) {
            headers['X-GitHub-Token'] = token;
        }
    } catch (_) { /* no-op */ }

    // Include token in body as a secondary channel accepted by the server
    const payload = (assembledToken && typeof assembledToken === 'string' && assembledToken.length)
        ? { ...body, token: assembledToken }
        : body;

    // Offline fast-fail
    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        return { ok: false, error: 'Offline: no network connection', status: 0 };
    }

    const shouldRetryStatus = (s) => [429, 502, 503, 504].includes(s);
    const maxAttempts = 3;
    let attempt = 0;
    let lastError = null;

    // Use shared credentials logic from githubService to ensure consistent behavior
    // for session cookies sent to allowlisted cross-origin endpoints (e.g., Render backend from GitHub Pages)
    const credentialsMode = (typeof window !== 'undefined' && window.githubService && typeof window.githubService.getFetchCredentials === 'function')
        ? window.githubService.getFetchCredentials(endpoint)
        : 'omit';
    const isCrossOrigin = (typeof window !== 'undefined')
        ? (resolvedUrl.origin !== window.location.origin)
        : false;

    while (attempt < maxAttempts) {
        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers,
                credentials: credentialsMode,
                mode: 'cors',
                cache: 'no-store',
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                let error = `Request failed (${resp.status})`;
                try { const data = await resp.json(); error = data.error || error; } catch (_) { }
                if (attempt < maxAttempts - 1 && shouldRetryStatus(resp.status)) {
                    const backoffMs = 250 * Math.pow(2, attempt); // 250ms, 500ms, 1000ms
                    await new Promise(r => setTimeout(r, backoffMs));
                    attempt++;
                    continue;
                }
                return { ok: false, error, status: resp.status };
            }
            try {
                const data = await resp.json();
                return { ok: true, ...data };
            } catch (_) {
                return { ok: true };
            }
        } catch (e) {
            lastError = e;
            // Classify probable CORS/network issue for diagnostics
            try {
                const pageOrigin = (typeof window !== 'undefined' && window.location?.origin) || '';
                const endpointOrigin = resolvedUrl.origin;
                const probableCors = (
                    isCrossOrigin && (
                        (e && e.name === 'TypeError' && /Failed to fetch|NetworkError/i.test(e.message || '')) ||
                        (e && /CORS/i.test(e.message || ''))
                    )
                );
                if (probableCors && typeof window !== 'undefined') {
                    window.__lastApiError = {
                        type: 'cors',
                        endpoint: endpoint,
                        pageOrigin,
                        endpointOrigin,
                        credentials: credentialsMode
                    };
                } else if (typeof window !== 'undefined') {
                    window.__lastApiError = { type: 'network', message: String(e && e.message || e) };
                }
            } catch (_) { /* best-effort */ }
            const msg = String(e?.message || '').toLowerCase();
            const retryable = /network|timeout|fetch|connection|reset/.test(msg);
            // If we failed on a cross-origin call while including credentials, retry once without credentials
            if (isCrossOrigin && attempt < maxAttempts - 1) {
                try {
                    const resp = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        credentials: 'omit',
                        mode: 'cors',
                        cache: 'no-store',
                        body: JSON.stringify(payload)
                    });
                    if (resp.ok) {
                        try {
                            const data = await resp.json();
                            return { ok: true, ...data };
                        } catch (_) { return { ok: true }; }
                    }
                    let error = `Request failed (${resp.status})`;
                    try { const data = await resp.json(); error = data.error || error; } catch (_) { }
                    if (attempt < maxAttempts - 1 && shouldRetryStatus(resp.status)) {
                        const backoffMs = 250 * Math.pow(2, attempt);
                        await new Promise(r => setTimeout(r, backoffMs));
                        attempt++;
                        continue;
                    }
                    return { ok: false, error, status: resp.status };
                } catch (_) {
                    // Fall through to generic retry logic below
                }
            }
            if (attempt >= maxAttempts - 1 || !retryable) break;
            const backoffMs = 250 * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, backoffMs));
            attempt++;
        }
    }
    return { ok: false, error: lastError?.message || 'Network error', status: 0 };
}

// Cross-origin friendly POST using application/x-www-form-urlencoded to avoid preflight
async function postForm(url, body) {
    const base = (typeof window !== 'undefined' && window.API_BASE_URL)
        ? window.API_BASE_URL
        : window.location.origin;
    const resolvedUrl = new URL(url, base);
    const baseOrigin = new URL(base).origin;
    const allowedOrigins = Array.isArray(window.API_ALLOWED_ORIGINS)
        ? window.API_ALLOWED_ORIGINS
        : [baseOrigin];
    if (!allowedOrigins.includes(resolvedUrl.origin)) {
        throw new Error('Requests to untrusted origins are blocked.');
    }
    const endpoint = resolvedUrl.toString();
    const isCrossOrigin = (typeof window !== 'undefined')
        ? (resolvedUrl.origin !== window.location.origin)
        : false;

    // Build form data; include optional assembled token if present
    let assembledToken = null;
    try {
        if (typeof window !== 'undefined' && typeof window.assembleToken === 'function' && window.USE_ASSEMBLED_TOKEN === true) {
            try { assembledToken = window.assembleToken(); } catch (_) { assembledToken = null; }
        }
    } catch (_) { /* ignore */ }
    const payload = new URLSearchParams();
    Object.entries(assembledToken ? { ...body, token: assembledToken } : body).forEach(([k, v]) => {
        if (v !== undefined && v !== null) payload.append(k, String(v));
    });

    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            credentials: isCrossOrigin ? 'omit' : 'include',
            mode: 'cors',
            cache: 'no-store',
            body: payload.toString()
        });
        if (!resp.ok) {
            let error = `Request failed (${resp.status})`;
            try { const data = await resp.json(); error = data.error || error; } catch (_) { }
            return { ok: false, error, status: resp.status };
        }
        try {
            const data = await resp.json();
            return { ok: true, ...data };
        } catch (_) {
            return { ok: true };
        }
    } catch (err) {
        try {
            const pageOrigin = (typeof window !== 'undefined' && window.location?.origin) || '';
            const endpointOrigin = resolvedUrl.origin;
            const probableCors = (
                isCrossOrigin && (
                    (err && err.name === 'TypeError' && /Failed to fetch|NetworkError/i.test(err.message || '')) ||
                    (err && /CORS/i.test(err.message || ''))
                )
            );
            if (probableCors && typeof window !== 'undefined') {
                window.__lastApiError = {
                    type: 'cors',
                    endpoint: endpoint,
                    pageOrigin,
                    endpointOrigin,
                    credentials: (isCrossOrigin ? 'omit' : 'include')
                };
            } else if (typeof window !== 'undefined') {
                window.__lastApiError = { type: 'network', message: String(err && err.message || err) };
            }
        } catch (_) { /* best-effort */ }
        return { ok: false, error: err?.message || 'Network error', status: 0 };
    }
}

// UI toggles for Create Account
function showCreateAccount() {
    const loginFields = document.getElementById('loginFields');
    const createSection = document.getElementById('createAccountSection');
    if (loginFields) { loginFields.style.display = 'none'; }
    if (createSection) { createSection.style.display = 'block'; }

    // Initialize dropdowns
    populateBranchSelect('caBranchInput', 'USMC'); // Default to USMC
    populateRankSelect('caBranchInput', 'caRankInput');

    // Availability watcher removed per request; rely on server checks at create
    window.scrollTo({ top: 0, behavior: 'auto' });
}

function hideCreateAccount() {
    const loginFields = document.getElementById('loginFields');
    const createSection = document.getElementById('createAccountSection');
    if (createSection) { createSection.style.display = 'none'; }
    if (loginFields) { loginFields.style.display = 'block'; }
    window.scrollTo({ top: 0, behavior: 'auto' });
}

// Skip -> show main app
function skipProfileLogin() {
    currentProfile = null;

    const login = document.getElementById('profileLoginCard');
    if (login) {
        login.classList.remove('active');
        login.style.display = 'none'; // ensure login card is hidden
    }

    // Restore global header chrome when leaving login
    try { document.body.classList.remove('auth-login'); } catch (_) { }
    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = '';
    if (warning) warning.style.display = '';

    const setup = document.getElementById('setupCard');
    if (setup) {
        setup.style.display = 'block';
        setup.classList.add('active');
    }

    // Ensure other cards remain hidden
    ['howItWorksCard', 'evaluationContainer', 'reviewCard', 'sectionIGenerationCard', 'directedCommentsCard', 'summaryCard']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('active'); el.style.display = 'none'; }
        });
}

// Show Dashboard -> keep app chrome hidden
// In showProfileDashboard(), initialize the rank button state to "All"
// State: selected rank on dashboard
let selectedRankFilter = '';

// New function to apply rank filter from summary table and open grid view
function applyRankFromSummary(rank) {
    setRankFilter(rank);
    toggleGridView(true);
}

// Show RS Summary (main page) and clear any active rank filter
function showRankSummaryView() {
    // Clear the selected rank filter
    setRankFilter('');

    // Ensure the list (RS Summary) is shown and grid is hidden
    toggleGridView(false);

    // Re-render the summary list to reflect full dataset
    renderEvaluationsList();

    // Optional: scroll to top for dashboard feel
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show Dashboard -> initialize and hide filters until a rank is chosen
function showProfileDashboard() {
    const login = document.getElementById('profileLoginCard');
    if (login) {
        login.classList.remove('active');
        login.style.display = 'none'; // Hide RS Login after login
    }

    // Ensure mode selection is hidden when entering the dashboard
    const mode = document.getElementById('modeSelectionCard');
    if (mode) {
        mode.classList.remove('active');
        mode.style.display = 'none';
    }

    const dash = document.getElementById('profileDashboardCard');
    if (dash) {
        dash.style.display = 'block';
        dash.classList.add('active');
    }

    // Leaving login/home state; keep header hidden in dashboard but clear login/home classes
    try { document.body.classList.remove('auth-login'); document.body.classList.remove('home-mode'); } catch (_) { }
    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = 'none';
    if (warning) warning.style.display = 'none';

    // Hide all app cards while in Dashboard
    ['setupCard', 'howItWorksCard', 'evaluationContainer', 'reviewCard', 'sectionIGenerationCard', 'directedCommentsCard', 'summaryCard']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('active'); el.style.display = 'none'; }
        });

    renderProfileHeader();
    renderEvaluationsList();
    // Initialize button bar to "All" and update visibility
    setRankFilter('');

    // Make sure we are scrolled to the top of the dashboard
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { }
}

function renderProfileHeader() {
    const nameEl = document.getElementById('profileHeaderName');
    const emailEl = document.getElementById('profileHeaderEmail');
    const totalEl = document.getElementById('totalEvaluations');
    const pendingEl = document.getElementById('pendingSync');

    if (nameEl && currentProfile) {
        const rankNorm = normalizeRankLabel(currentProfile.rsRank || '');
        const rankDisplay = (function (code) {
            const map = {
                'SGT': 'Sgt',
                'SSGT': 'SSgt',
                'GYSGT': 'GySgt',
                'MSGT': 'MSgt',
                '1STSGT': '1stSgt',
                'MGYSGT': 'MGySgt',
                'SGTMAJ': 'SgtMaj',
                'WO': 'WO1',
                'CWO2': 'CWO2',
                'CWO3': 'CWO3',
                'CWO4': 'CWO4',
                'CWO5': 'CWO5',
                '2NDLT': '2ndLt',
                '1STLT': '1stLt',
                'CAPT': 'Capt',
                'MAJ': 'Maj',
                'LTCOL': 'LtCol',
                'COL': 'Col'
            };
            return map[code] || (currentProfile.rsRank || '').trim();
        })(rankNorm);
        const imgSrc = (function (rank) {
            const map = {
                'SGT': 'assets/images/USMC_SGT.png',
                'SSGT': 'assets/images/USMC_SSGT.png',
                'GYSGT': 'assets/images/USMC_GYSGT.png',
                'MSGT': 'assets/images/USMC_MSGT.png',
                '1STSGT': 'assets/images/USMC_1STSGT.png',
                'MGYSGT': 'assets/images/USMC_MGYSGT.png',
                'SGTMAJ': 'assets/images/USMC_SGTMAJ.png',
                'WO': 'assets/images/USMC_WO.png',
                'CWO2': 'assets/images/USMC_CWO2.png',
                'CWO3': 'assets/images/USMC_CWO3.png',
                'CWO4': 'assets/images/USMC_CWO4.png',
                'CWO5': 'assets/images/USMC_CWO5.png',
                '2NDLT': 'assets/images/USMC_2NDLT.png',
                '1STLT': 'assets/images/USMC_1STLT.png',
                'CAPT': 'assets/images/USMC_CAPT.png',
                'MAJ': 'assets/images/USMC_MAJ.png',
                'LTCOL': 'assets/images/USMC_LTCOL.png',
                'COL': 'assets/images/USMC_COL.png'
            };
            return map[rank] || '';
        })(rankNorm);
        if (imgSrc) {
            nameEl.innerHTML = `<img src="${imgSrc}" alt="${escapeHtml(rankDisplay)} insignia" style="width:24px;height:24px;object-fit:contain;margin-right:8px;vertical-align:middle;border-radius:4px"/>${escapeHtml(rankDisplay)} ${escapeHtml(currentProfile.rsName)}`;
        } else {
            nameEl.textContent = `${rankDisplay} ${currentProfile.rsName}`;
        }
    }
    if (emailEl && currentProfile) {
        emailEl.textContent = currentProfile.rsEmail;
    }
    if (totalEl) {
        totalEl.textContent = String(profileEvaluations.length);
    }

    const pending = profileEvaluations.filter(e => e.syncStatus === 'pending').length;
    if (pendingEl) {
        pendingEl.textContent = String(pending);
    }
}

// Edit Profile UI handlers
function openEditProfile() {
    try {
        console.group('ProfileEdit: openEditProfile');
        const modal = document.getElementById('editProfileModal');
        if (!modal) {
            console.error('[Modal] editProfileModal not found');
            console.groupEnd('ProfileEdit: openEditProfile');
            return;
        }
        const nameInput = document.getElementById('editRsNameInput');
        const emailInput = document.getElementById('editRsEmailInput');
        const branchInput = document.getElementById('editRsBranchInput');
        const rankInput = document.getElementById('editRsRankInput');
        const emailAddrInput = document.getElementById('editRsEmailAddrInput');

        console.debug('[Inputs] found', {
            nameFound: !!nameInput,
            emailFound: !!emailInput,
            branchFound: !!branchInput,
            rankFound: !!rankInput,
            emailAddrFound: !!emailAddrInput
        });

        if (currentProfile) {
            if (nameInput) nameInput.value = currentProfile.rsName || '';
            if (emailInput) emailInput.value = currentProfile.rsEmail || '';
            if (emailAddrInput) emailAddrInput.value = (currentProfile.email || currentProfile.rsEmail || '');

            // Initialize branch and rank
            if (branchInput) {
                populateBranchSelect('editRsBranchInput', currentProfile.branch || 'USMC');
            }
            if (rankInput) {
                // Wait for branch population to finish (synchronous but good to be explicit)
                populateRankSelect('editRsBranchInput', 'editRsRankInput', currentProfile.rsRank);
            }
        }

        if (nameInput && currentProfile?.rsName) nameInput.value = currentProfile.rsName;
        if (emailInput && currentProfile?.rsEmail) emailInput.value = currentProfile.rsEmail;
        if (emailAddrInput && (currentProfile?.email || currentProfile?.rsEmail)) emailAddrInput.value = (currentProfile.email || currentProfile.rsEmail);
        if (rankInput && currentProfile?.rsRank) rankInput.value = currentProfile.rsRank;
        console.info('[Prefill] applied from currentProfile', {
            name: currentProfile?.rsName,
            email: currentProfile?.rsEmail,
            rank: currentProfile?.rsRank
        });

        try {
            if (window.ModalController && typeof window.ModalController.openById === 'function') {
                window.ModalController.openById('editProfileModal', { labelledBy: 'editProfileTitle', focusFirst: '#editRsNameInput' });
            } else {
                modal.style.display = 'block';
                modal.classList.add('active');
                try {
                    if (window.A11y && typeof window.A11y.openDialog === 'function') {
                        window.A11y.openDialog(modal, { labelledBy: 'editProfileTitle', focusFirst: '#editRsNameInput' });
                    }
                } catch (_) { }
            }
            console.info('[Modal] opened');
            // Attach real-time validation to modal fields
            try {
                if (window.FormValidationUI) {
                    window.FormValidationUI.attachToContainer(modal, { submitButtonSelector: '#saveProfileBtn' });
                }
            } catch (e) {
                console.warn('FormValidationUI attach failed:', e);
            }
        } catch (e) {
            console.warn('ModalController.openById failed, falling back:', e);
            modal.style.display = 'block';
            modal.classList.add('active');
            try {
                if (window.A11y && typeof window.A11y.openDialog === 'function') {
                    window.A11y.openDialog(modal, { labelledBy: 'editProfileTitle', focusFirst: '#editRsNameInput' });
                }
            } catch (_) { }
        }
        console.groupEnd('ProfileEdit: openEditProfile');
    } catch (err) {
        console.error('openEditProfile error:', err);
        try { console.groupEnd('ProfileEdit: openEditProfile'); } catch (_) { }
    }
}

function closeEditProfileModal() {
    try {
        console.group('ProfileEdit: closeEditProfileModal');
        const modal = document.getElementById('editProfileModal');
        if (!modal) {
            console.error('[Modal] editProfileModal not found');
            console.groupEnd('ProfileEdit: closeEditProfileModal');
            return;
        }
        try {
            if (window.ModalController && typeof window.ModalController.closeById === 'function') {
                window.ModalController.closeById('editProfileModal');
            } else {
                try { if (window.A11y && typeof window.A11y.closeDialog === 'function') window.A11y.closeDialog(modal); } catch (_) { }
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
            console.info('[Modal] closed');
        } catch (e) {
            console.warn('ModalController.closeById failed, falling back:', e);
            try { if (window.A11y && typeof window.A11y.closeDialog === 'function') window.A11y.closeDialog(modal); } catch (_) { }
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        console.groupEnd('ProfileEdit: closeEditProfileModal');
    } catch (err) {
        console.error('closeEditProfileModal error:', err);
        try { console.groupEnd('ProfileEdit: closeEditProfileModal'); } catch (_) { }
    }
}

// Ensure functions are accessible from inline onclick handlers
try {
    window.openEditProfile = openEditProfile;
    window.closeEditProfileModal = closeEditProfileModal;
    window.saveProfileUpdates = saveProfileUpdates;
    // Logout handlers for breadcrumb button
    window.logoutProfile = logoutProfile;
    window.continueLogoutProfile = continueLogoutProfile;
    console.info('profile.js: global handlers bound to window');
} catch (e) {
    console.warn('profile.js: failed to bind handlers to window', e);
}

// Bind click listeners after DOM ready; prefer direct IDs and avoid duplicates when inline handlers exist
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Helper to add event listeners with lifecycle management
        const addManagedListener = (element, event, handler, options) => {
            if (typeof globalLifecycle !== 'undefined') {
                globalLifecycle.addEventListener(element, event, handler, options);
            } else {
                element.addEventListener(event, handler, options);
            }
        };

        // Edit Profile
        const editBtn = document.getElementById('editProfileBtn')
            || document.querySelector('.profile-name-row .editBtn');
        if (editBtn && !editBtn.getAttribute('onclick')) {
            addManagedListener(editBtn, 'click', (evt) => {
                try { openEditProfile(); } catch (err) { console.error('openEditProfile error:', err); }
                evt.preventDefault();
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn')
            || document.querySelector('.breadcrumb-nav .Btn');
        if (logoutBtn && !logoutBtn.getAttribute('onclick')) {
            addManagedListener(logoutBtn, 'click', (evt) => {
                try {
                    const btn = evt.currentTarget || logoutBtn;
                    if (window.UIStates && typeof window.UIStates.withLoading === 'function') {
                        window.UIStates.withLoading(btn, async () => {
                            logoutProfile();
                        });
                    } else {
                        logoutProfile();
                    }
                } catch (err) { console.error('logoutProfile error:', err); }
                evt.preventDefault();
            });
        }

        // Save Changes
        const saveBtn = document.getElementById('saveProfileBtn')
            || document.querySelector('#editProfileModal .btn.btn-meets');
        if (saveBtn && !saveBtn.getAttribute('onclick')) {
            addManagedListener(saveBtn, 'click', (evt) => {
                try {
                    const btn = evt.currentTarget || saveBtn;
                    if (window.UIStates && typeof window.UIStates.withLoading === 'function') {
                        window.UIStates.withLoading(btn, async () => {
                            await saveProfileUpdates();
                        });
                    } else {
                        saveProfileUpdates();
                    }
                } catch (err) { console.error('saveProfileUpdates error:', err); }
                evt.preventDefault();
            });
        }

        // Cancel
        const cancelBtn = document.getElementById('cancelProfileBtn')
            || document.querySelector('#editProfileModal .btn.btn-secondary');
        if (cancelBtn && !cancelBtn.getAttribute('onclick')) {
            addManagedListener(cancelBtn, 'click', (evt) => {
                try { closeEditProfileModal(); } catch (err) { console.error('closeEditProfileModal error:', err); }
                evt.preventDefault();
            });
        }
    } catch (bindErr) {
        console.error('profile.js: error during direct bindings', bindErr);
    }
});

async function saveProfileUpdates() {
    try {
        console.group('ProfileEdit: saveProfileUpdates');
        const nameInput = document.getElementById('editRsNameInput');
        const emailInput = document.getElementById('editRsEmailInput');
        const branchInput = document.getElementById('editRsBranchInput');
        const rankInput = document.getElementById('editRsRankInput');
        const emailAddrInput = document.getElementById('editRsEmailAddrInput');
        const statusText = document.getElementById('editStatusText');

        const newName = (nameInput?.value || '').trim();
        const newEmail = (emailInput?.value || '').trim();
        const newBranch = (branchInput?.value || '').trim();
        const newRank = (rankInput?.value || '').trim();
        const newEmailAddr = (emailAddrInput?.value || '').trim();
        console.info('[Start] Inputs', { newName, newEmail, newBranch, newRank });

        // Final validation gate before submission
        try {
            const container = document.getElementById('editProfileModal');
            let validAll = true;
            if (window.FormValidationUI && container) {
                validAll = window.FormValidationUI.validateForm(container);
            } else {
                validAll = !!(newName && newEmail && newBranch && newRank);
            }
            if (!validAll) {
                console.warn('[Abort] Validation failed: fields invalid');
                alert('Please correct the highlighted fields.');
                console.groupEnd('ProfileEdit: saveProfileUpdates');
                return;
            }
        } catch (e) {
            console.warn('Validation check failed, proceeding cautiously:', e);
        }

        if (!currentProfile) {
            console.error('[Abort] No profile loaded');
            alert('No profile loaded. Please login first.');
            console.groupEnd('ProfileEdit: saveProfileUpdates');
            return;
        }

        const oldName = currentProfile.rsName;
        const oldEmail = currentProfile.rsEmail;
        const oldRank = currentProfile.rsRank;
        const oldKey = generateProfileKey(oldName, oldEmail);
        console.debug('[Prev] Profile', { oldName, oldEmail, oldRank });
        console.debug('[Keys] oldKey', oldKey);

        // Update evaluation rsInfo to reflect RS changes
        console.debug('[Local] evaluations loaded', (profileEvaluations || []).length);
        profileEvaluations = (profileEvaluations || []).map(e => {
            const copy = { ...e };
            copy.rsInfo = {
                ...(e.rsInfo || {}),
                name: newName,
                email: newEmail,
                rank: newRank
            };
            return copy;
        });
        console.debug('[Local] Applied rsInfo updates');

        // Update profile object
        currentProfile.rsName = newName;
        currentProfile.rsEmail = newEmail;
        currentProfile.rsRank = newRank;
        currentProfile.branch = newBranch;
        currentProfile.full_name = newName;
        currentProfile.rank = newRank;
        currentProfile.email = newEmailAddr;
        currentProfile.totalEvaluations = profileEvaluations.length;
        currentProfile.lastUpdated = new Date().toISOString();
        console.info('[Profile] Updated in-memory profile');

        // Migrate local storage keys when name/email changes
        const newKey = generateProfileKey(newName, newEmail);
        console.debug('[Local] Saving to newKey', newKey);
        saveProfileToLocal(newKey, currentProfile);
        saveEvaluationsToLocal(newKey, profileEvaluations);
        console.info('[Local] Saved profile and evaluations under newKey');
        if (oldKey !== newKey) {
            try { localStorage.removeItem(`profile:${oldKey}`); } catch (_) { }
            try { localStorage.removeItem(`evaluations:${oldKey}`); } catch (_) { }
            console.info('[Local] Removed oldKey entries');
        } else {
            console.debug('[Local] Key unchanged; no removal needed');
        }

        // Update session snapshot
        localStorage.setItem('current_profile', JSON.stringify(currentProfile));
        localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
        localStorage.setItem('has_profile', 'true');
        console.debug('[Session] Snapshot updated');

        // Attempt GitHub or backend sync (delete old if email changed)
        let synced = false;
        let statusMsg = '';
        if (navigator.onLine) {
            let token = null;
            try { token = await githubService.getTokenFromEnvironment?.(); } catch (_) { }
            if (!token && typeof window !== 'undefined' && window.GITHUB_CONFIG?.token) {
                token = window.GITHUB_CONFIG.token;
            }
            console.info('[GitHub] Token present:', !!token);
            if (token) {
                try {
                    githubService.initialize(token);
                    const connected = await githubService.verifyConnection?.();
                    console.info('[GitHub] Connected:', connected);
                    if (connected) {
                        // Persist new data
                        const result = await githubService.saveUserData({
                            rsName: currentProfile.rsName,
                            rsEmail: currentProfile.rsEmail,
                            rsRank: currentProfile.rsRank,
                            branch: currentProfile.branch,
                            contactEmail: currentProfile.email,
                            ...(oldEmail !== newEmail ? { previousEmail: oldEmail } : {})
                        });
                        if (result?.success) {
                            synced = true;
                            statusMsg = result?.message || '';
                            console.info('[GitHub] saveUserData success');
                            // If email changed, remove old file
                            if (oldEmail !== newEmail) {
                                console.debug('[GitHub] Email changed; deleting old file for', oldEmail);
                                try {
                                    await githubService.deleteUserFile(oldEmail, `Remove old profile for ${oldName}`);
                                } catch (delErr) {
                                    console.warn('Failed to delete old user file:', delErr);
                                }
                            }
                        } else {
                            console.warn('[GitHub] saveUserData failed', result);
                        }
                    }
                } catch (err) {
                    console.warn('GitHub sync on profile update failed:', err);
                }
            } else {
                // No token but online: attempt backend fallback save for visibility
                try {
                    const result = await githubService.saveUserData({
                        rsName: currentProfile.rsName,
                        rsEmail: currentProfile.rsEmail,
                        rsRank: currentProfile.rsRank,
                        branch: currentProfile.branch,
                        contactEmail: currentProfile.email,
                        ...(oldEmail !== newEmail ? { previousEmail: oldEmail } : {})
                    });
                    if (result?.success) {
                        statusMsg = result?.message || '';
                        try { window.__forceFreshEvaluationsOnce = true; } catch (_) { }
                        console.info('[Backend] saveUserData fallback success', result);
                        try { showToast('Profile saved to server', 'success'); } catch (_) { }
                    } else {
                        console.warn('[Backend] saveUserData fallback failed', result);
                        const reason = (result && (result.message || result.error)) || 'Unknown error';
                        const msg = (result && result.status === 403)
                            ? 'Not authorized. Please log in again.'
                            : `Save failed: ${reason}`;
                        try { showToast(msg, 'error'); } catch (_) { }
                    }
                } catch (e) {
                    console.warn('Backend fallback save error:', e);
                    try { showToast('Save failed due to a network error.', 'error'); } catch (_) { }
                }
            }
        } else {
            console.info('[GitHub] Offline; skipping sync');
        }

        // Update UI
        renderProfileHeader();
        renderEvaluationsList?.();
        closeEditProfileModal();
        console.info('[UI] Header/evaluations updated; modal closed');

        // Status text
        if (statusText) {
            const text = statusMsg
                || (synced
                    ? 'Online - Changes synced to GitHub'
                    : (navigator.onLine
                        ? 'Online - Backend fallback (saved locally on server)'
                        : 'Offline - Changes saved locally'));
            statusText.textContent = text;
            console.info('[UI] Status set', { synced, statusMsg });
        }

        try {
            const container = document.getElementById('editProfileModal');
            if (window.FormValidationUI && typeof window.FormValidationUI.showSuccessBanner === 'function') {
                window.FormValidationUI.showSuccessBanner(container, (container && container.dataset && container.dataset.successMessage) || 'Profile updated successfully');
            } else {
                showToast('Profile updated successfully.', 'success');
            }
        } catch (_) {
            showToast('Profile updated successfully.', 'success');
        }
        console.groupEnd('ProfileEdit: saveProfileUpdates');
    } catch (error) {
        console.error('saveProfileUpdates error:', error);
        alert('Failed to update profile.');
        try { console.groupEnd('ProfileEdit: saveProfileUpdates'); } catch (_) { }
    }
}

// Set rank summary sort preference
function setRankSummarySort(key) {
    window.rankSummarySort = key || 'rank';
    renderEvaluationsList();
}

function renderEvaluationsList() {
    const container = document.getElementById('evaluationsList');

    if (profileEvaluations.length === 0) {
        // Only update if content is different
        const currentContent = container.querySelector('.empty-state');
        if (!currentContent) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No evaluations saved yet.</p>
                    <button class="btn btn-meets" onclick="startNewEvaluation()">
                        Create Your First Evaluation
                    </button>
                </div>
            `;
        }
        return;
    }

    // Aggregate across ALL evaluations by rank
    const rankStats = new Map();
    profileEvaluations.forEach(e => {
        const rawRank = String(e.marineInfo?.rank || '').trim();
        if (!rawRank) return;

        const rank = normalizeRankLabel(rawRank);
        const avgNum = parseFloat(e.fitrepAverage || '0');
        if (!Number.isFinite(avgNum)) return;

        const s = rankStats.get(rank) || { sum: 0, count: 0, high: 0, low: Infinity };
        s.sum += avgNum;
        s.count += 1;
        s.high = Math.max(s.high, avgNum);
        s.low = Math.min(s.low, avgNum);
        rankStats.set(rank, s);
    });

    // Compute global bounds for progress bars
    const allAvgs = [];
    rankStats.forEach(s => {
        if (s.count) allAvgs.push(s.sum / s.count);
    });
    const globalHigh = allAvgs.length ? Math.max(...allAvgs) : 0;
    const globalLow = allAvgs.length ? Math.min(...allAvgs) : 0;
    const spread = Math.max(0.01, globalHigh - globalLow);

    // Only show ranks that have reports
    const orderedRanks = [
        'SGT', 'SSGT', 'GYSGT', 'MSGT', '1STSGT', 'MGYSGT', 'SGTMAJ',
        'WO', 'CWO2', 'CWO3', 'CWO4', 'CWO5',
        '2NDLT', '1STLT', 'CAPT', 'MAJ', 'LTCOL', 'COL'
    ];

    // Prepare rows
    const rows = [];
    orderedRanks.forEach(rank => {
        if (!rankStats.has(rank)) return;
        const s = rankStats.get(rank);
        const avg = s.count ? s.sum / s.count : 0;
        rows.push({
            rank,
            avg,
            count: s.count,
            high: s.count ? s.high : 0,
            low: s.count && Number.isFinite(s.low) ? s.low : 0
        });
    });

    // Sorting
    const key = window.rankSummarySort || 'rank';
    if (key === 'avg') {
        rows.sort((a, b) => b.avg - a.avg || a.rank.localeCompare(b.rank));
    } else if (key === 'rank') {
        const rankOrder = [
            'COL', 'LTCOL', 'MAJ', 'CAPT', '1STLT', '2NDLT',
            'CWO5', 'CWO4', 'CWO3', 'CWO2', 'WO',
            'SGTMAJ', 'MGYSGT', '1STSGT', 'MSGT', 'GYSGT', 'SSGT', 'SGT'
        ];
        rows.sort((a, b) => {
            const ai = rankOrder.indexOf(a.rank);
            const bi = rankOrder.indexOf(b.rank);
            if (ai !== bi) return ai - bi;
            return b.count - a.count || a.rank.localeCompare(b.rank);
        });
    } else {
        rows.sort((a, b) => b.count - a.count || a.rank.localeCompare(b.rank));
    }

    // Use RAF queue for smooth rendering
    rafQueue.add(() => {
        // Build toolbar
        const toolbarHtml = `
            <div class="summary-toolbar" role="toolbar" aria-label="Rank Summary controls">
                <span class="summary-title">Rank Summary</span>
                <div class="toolbar-spacer"></div>
                <span class="sort-label">Sort:</span>
                <button class="btn btn-secondary sort-btn ${key === 'reports' ? 'active' : ''}" onclick="setRankSummarySort('reports')">Reports</button>
                <button class="btn btn-secondary sort-btn ${key === 'avg' ? 'active' : ''}" onclick="setRankSummarySort('avg')">Average</button>
                <button class="btn btn-secondary sort-btn ${key === 'rank' ? 'active' : ''}" onclick="setRankSummarySort('rank')">Rank</button>
            </div>
        `;

        // Build cards using DocumentFragment for better performance
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'rank-summary-grid';

        rows.forEach(r => {
            const pct = Math.round(((r.avg - globalLow) / spread) * 100);

            const card = document.createElement('button');
            card.className = 'rank-summary-card';
            card.onclick = () => applyRankFromSummary(r.rank);
            card.title = `Open ${r.rank} grid`;

            const rankImageMap = {
                '2NDLT': 'assets/images/USMC_2NDLT.png',
                '1STLT': 'assets/images/USMC_1STLT.png',
                'CAPT': 'assets/images/USMC_CAPT.png',
                'MAJ': 'assets/images/USMC_MAJ.png',
                'LTCOL': 'assets/images/USMC_LTCOL.png',
                'COL': 'assets/images/USMC_COL.png',
                'WO': 'assets/images/USMC_WO.png',
                'CWO2': 'assets/images/USMC_CWO2.png',
                'CWO3': 'assets/images/USMC_CWO3.png',
                'CWO4': 'assets/images/USMC_CWO4.png',
                'CWO5': 'assets/images/USMC_CWO5.png',
                'SGT': 'assets/images/USMC_SGT.png',
                'SSGT': 'assets/images/USMC_SSGT.png',
                'GYSGT': 'assets/images/USMC_GYSGT.png',
                'MSGT': 'assets/images/USMC_MSGT.png',
                '1STSGT': 'assets/images/USMC_1STSGT.png',
                'MGYSGT': 'assets/images/USMC_MGYSGT.png',
                'SGTMAJ': 'assets/images/USMC_SGTMAJ.png'
            };
            const imgSrc = rankImageMap[r.rank] || '';
            const imgHtml = imgSrc ? `<img src="${imgSrc}" alt="${r.rank} insignia" style="width:28px;height:28px;object-fit:contain;margin-right:8px;vertical-align:middle;border-radius:4px"/>` : '';
            card.innerHTML = `
                <div class="rank-chip">${imgHtml}${r.rank}</div>
                <div class="metric-group">
                    <div class="metric">
                        <span class="metric-label">Avg</span>
                        <span class="metric-value">${r.avg.toFixed(2)}</span>
                    </div>
                    <div class="metric-bar" aria-label="Average relative bar">
                        <div class="bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="metric-row">
                        <span class="pill">Reports ${r.count}</span>
                        <span class="pill">High ${r.high.toFixed(2)}</span>
                        <span class="pill">Low ${r.low.toFixed(2)}</span>
                    </div>
                </div>
            `;

            cardsContainer.appendChild(card);
        });

        container.innerHTML = toolbarHtml;
        container.appendChild(cardsContainer);
    });
}

function createEvaluationListItem(evaluation) {
    const div = document.createElement('div');
    div.className = 'evaluation-item';
    const evalId = evaluation.evaluationId || evaluation.id;
    div.dataset.evalId = evalId;

    div.innerHTML = `
        <div class="eval-header" onclick="toggleEvaluation(this)">
            <div class="eval-summary">
                <div class="eval-marine-info">
                    <span class="marine-rank">${escapeHtml((evaluation.marineInfo || evaluation.marine || {}).rank || '')}</span>
                    <span class="marine-name">${escapeHtml((evaluation.marineInfo || evaluation.marine || {}).name || '')}</span>
                </div>
                <div class="eval-meta">
                    <span class="eval-occasion">${escapeHtml(evaluation.occasion || '')}</span>
                    <span class="eval-dates">${escapeHtml((((evaluation.marineInfo || evaluation.marine || {}).evaluationPeriod || {}).from || ''))} to ${escapeHtml((((evaluation.marineInfo || evaluation.marine || {}).evaluationPeriod || {}).to || ''))}</span>
                    <span class="eval-average">Avg: ${escapeHtml(String(evaluation.fitrepAverage || ''))}</span>
                </div>
            </div>
            <div class="eval-actions">
                <span class="sync-status ${escapeHtml(evaluation.syncStatus || 'pending')}">
                    ${evaluation.syncStatus === 'synced' ? '✓ Synced' : '⏳ Pending'}
                </span>
                <button class="icon-btn" onclick="event.stopPropagation(); deleteEvaluation('${escapeHtml(evalId)}')">
                    🗑️
                </button>
                <span class="expand-icon">▼</span>
            </div>
        </div>
        <div class="eval-details" style="display: none;" data-loaded="false">
            <div class="loading">Loading details…</div>
        </div>
    `;

    return div;
}

function renderEvaluationDetails(evaluation) {
    let justificationsHTML = '';
    Object.values(evaluation.traitEvaluations).forEach(trait => {
        justificationsHTML += `
            <div class="justification-item">
                <strong>${escapeHtml(trait.trait)} (${escapeHtml(String(trait.grade))}):</strong>
                <p>${trait.justification ? nl2br(escapeHtml(trait.justification)) : '<em>No justification provided</em>'}</p>
            </div>
        `;
    });

    return `
        <div class="eval-details-grid">
            <div class="detail-section">
                <h4>Section I Comments</h4>
                <div class="comments-text">${evaluation.sectionIComments ? nl2br(escapeHtml(evaluation.sectionIComments)) : 'No comments provided'}</div>
            </div>
            <div class="detail-section full-width">
                <h4>Justifications</h4>
                <div class="justifications-list">${justificationsHTML}</div>
            </div>
        </div>
        <div class="eval-detail-actions">
            <button class="btn btn-secondary" onclick="exportEvaluation('${escapeHtml(evaluation.evaluationId)}')">
                Export This Evaluation
            </button>
        </div>
    `;
}

async function toggleEvaluation(header) {
    const item = header.closest('.evaluation-item');
    const details = item.querySelector('.eval-details');

    const isHidden = details.style.display === 'none';
    if (isHidden) {
        details.style.display = 'block';
        item.classList.add('expanded');
        // Lazy-load full details on first expand
        const alreadyLoaded = details.dataset.loaded === 'true';
        if (!alreadyLoaded) {
            const evalId = item.dataset.evalId;
            const email = currentProfile?.rsEmail;
            let evaluation = null;
            // Try in-memory cache
            if (evaluationDetailsCache.has(evalId)) {
                evaluation = evaluationDetailsCache.get(evalId);
            }
            // Try IndexedDB
            if (!evaluation && window.idbStore && email) {
                try { evaluation = await window.idbStore.getDetail(email, evalId); } catch (_) { }
            }
            // Try remote GitHub
            if (!evaluation && typeof githubService !== 'undefined' && navigator.onLine) {
                try {
                    const token = await githubService.getTokenFromEnvironment?.();
                    if (token) {
                        githubService.initialize(token);
                        const ok = await githubService.verifyConnection?.();
                        if (ok) {
                            evaluation = await githubService.getEvaluationDetail(email, evalId);
                        }
                    }
                } catch (e) {
                    console.warn('Lazy detail fetch failed:', e);
                }
            }

            // Merge into existing list item context for rendering
            const indexObj = profileEvaluations.find(e => (e.evaluationId || e.id) === evalId) || {};
            const renderObj = {
                evaluationId: evalId,
                occasion: indexObj.occasion || evaluation?.occasion || '',
                completedDate: indexObj.completedDate || evaluation?.completedDate || '',
                fitrepAverage: indexObj.fitrepAverage || evaluation?.fitrepAverage || '',
                marineInfo: indexObj.marineInfo || indexObj.marine || evaluation?.marineInfo || evaluation?.marine || {},
                rsInfo: indexObj.rsInfo || indexObj.rs || evaluation?.rsInfo || evaluation?.rs || {},
                sectionIComments: evaluation?.sectionIComments || '',
                traitEvaluations: Array.isArray(evaluation?.traitEvaluations) ? evaluation.traitEvaluations : []
            };

            details.innerHTML = renderEvaluationDetails(renderObj);
            details.dataset.loaded = 'true';
            // Cache for future
            evaluationDetailsCache.set(evalId, renderObj);
            if (window.idbStore && email && evaluation) {
                try { await window.idbStore.putDetail(email, evalId, evaluation); } catch (_) { }
            }
        }
    } else {
        details.style.display = 'none';
        item.classList.remove('expanded');
    }
}

// Save Evaluation to Profile
// Removed: showSaveToProfilePrompt (modal no longer used in streamlined flow)

async function confirmSaveToProfile() {
    // Get occasion from evaluationMeta (captured during setup in evaluation.js)
    const occasion = evaluationMeta?.occasionType || '';

    const storedPref = localStorage.getItem('pref_syncGitHub');
    const shouldSyncToGitHub = storedPref === 'true';

    // If not logged in, create a local offline profile to persist the evaluation
    if (!currentProfile) {
        const offlineName = evaluationMeta.evaluatorName || 'Anonymous RS';
        currentProfile = {
            rsName: offlineName,
            rsEmail: 'offline@local',
            rsRank: 'Unknown',
            evaluations: []
        };
        const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
        const existing = loadEvaluationsFromLocal(profileKey) || [];
        profileEvaluations = Array.isArray(existing) ? existing : [];
        saveProfileToLocal(profileKey, currentProfile);
    }

    // Generate a collision-resistant evaluationId that can handle multiple events on the same day
    // Format: eval-YYYYMMDD-<marineRank>-<marineName>-<shortUUID>
    function generateEvaluationId(meta) {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rankPart = String(meta?.marineRank || 'Unknown').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const namePart = String(meta?.marineName || 'Unknown').toLowerCase().replace(/[^a-z0-9]/g, '_');
        let shortId = '';
        try {
            // Use crypto.randomUUID when available for strong uniqueness
            const uuid = (crypto && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : '';
            shortId = uuid ? uuid.split('-')[0] : Math.random().toString(36).slice(2, 10);
        } catch (_) {
            shortId = Math.random().toString(36).slice(2, 10);
        }
        return `eval-${datePart}-${rankPart}-${namePart}-${shortId}`;
    }

    const evaluationId = generateEvaluationId(evaluationMeta);

    const evaluation = {
        evaluationId,
        rsInfo: {
            name: currentProfile ? currentProfile.rsName : evaluationMeta.evaluatorName,
            email: currentProfile ? currentProfile.rsEmail : 'offline@local',
            rank: currentProfile ? currentProfile.rsRank : 'Unknown'
        },
        marineInfo: {
            name: evaluationMeta.marineName,
            rank: evaluationMeta.marineRank || 'Unknown', // use captured rank
            evaluationPeriod: {
                from: evaluationMeta.fromDate,
                to: evaluationMeta.toDate
            }
        },
        occasion,
        completedDate: new Date().toISOString(),
        fitrepAverage: calculateFitrepAverage(),
        traitEvaluations: evaluationResults,
        sectionIComments: evaluationMeta.sectionIComments || '',
        directedComments: evaluationMeta.directedComments || '',
        savedToProfile: true,
        syncStatus: 'pending'
    };

    // Save to localStorage
    const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
    profileEvaluations.push(evaluation);
    saveEvaluationsToLocal(profileKey, profileEvaluations);

    currentProfile.totalEvaluations = profileEvaluations.length;
    currentProfile.lastUpdated = new Date().toISOString();
    saveProfileToLocal(profileKey, currentProfile);

    // NEW: update session snapshot so Dashboard can detect the saved profile
    localStorage.setItem('current_profile', JSON.stringify(currentProfile));
    localStorage.setItem('current_evaluations', JSON.stringify(profileEvaluations));
    localStorage.setItem('has_profile', 'true');
    // IMPORTANT: mark this as an offline save, not a form login
    localStorage.setItem('login_source', 'offline');

    // Persist index/detail to IndexedDB for offline cache
    try {
        if (window.idbStore) {
            await window.idbStore.putIndex(currentProfile.rsEmail, profileEvaluations.map(e => ({
                id: e.evaluationId,
                occasion: e.occasion,
                completedDate: e.completedDate,
                fitrepAverage: e.fitrepAverage,
                marine: { name: e.marineInfo?.name || '', rank: e.marineInfo?.rank || '' },
                rs: { name: e.rsInfo?.name || e.rsInfo?.rsName || '', rank: e.rsInfo?.rank || e.rsInfo?.rsRank || '' },
                file: ''
            })));
            await window.idbStore.putDetail(currentProfile.rsEmail, evaluation.evaluationId, evaluation);
        }
    } catch (_) { /* ignore */ }

    // Optional: try to sync immediately if online
    if (navigator.onLine) {
        const synced = await syncEvaluationToGitHub(evaluation);
        if (synced) {
            evaluation.syncStatus = 'synced';
        }
    }

    // Hide modal safely
    const modal = document.getElementById('saveProfileModal');
    if (modal) {
        try {
            if (window.ModalController && typeof window.ModalController.closeById === 'function') {
                window.ModalController.closeById('saveProfileModal');
            } else {
                modal.classList.remove('active');
                modal.style.display = 'none';
            }
        } catch (_) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }
    alert('Evaluation saved to your profile!');

    // Attempt to sync any pending evaluations in the background
    try {
        if (hasPendingSyncs()) {
            await syncAllEvaluations();
        }
    } catch (err) {
        console.warn('Background sync attempt failed after saving evaluation:', err);
    }
}

function skipSaveToProfile() {
    const modal = document.getElementById('saveProfileModal');
    if (!modal) return;
    try {
        if (window.ModalController && typeof window.ModalController.closeById === 'function') {
            window.ModalController.closeById('saveProfileModal');
        } else {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    } catch (_) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// New: Save and immediately return to RS Dashboard
async function confirmSaveToProfileAndReturn() {
    await confirmSaveToProfile();
    // Navigate to RS Dashboard to view the saved evaluation
    if (typeof showProfileDashboard === 'function') {
        showProfileDashboard();
    }
}

// Sync Operations
async function syncAllEvaluations() {
    if (!navigator.onLine) {
        showToast('Offline: connect to the internet to sync.', 'warning');
        return;
    }

    const pending = profileEvaluations.filter(e => String(e.syncStatus || 'pending') !== 'synced');

    if (pending.length === 0) {
        showToast('All evaluations already synced.', 'info');
        return;
    }

    const btn = document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Syncing...';
    }

    // Helper: retry a single evaluation sync with backoff
    const syncWithRetry = async (evaluation, maxAttempts = 3) => {
        let attempt = 0;
        while (attempt < maxAttempts) {
            const ok = await syncEvaluationToGitHub(evaluation);
            if (ok) return true;
            const backoffMs = 300 * Math.pow(2, attempt); // 300ms, 600ms, 1200ms
            await new Promise(r => setTimeout(r, backoffMs));
            attempt++;
        }
        return false;
    };

    // Global operation feedback with cancellable progress
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
    if (window.UIStates && typeof window.UIStates.showGlobalLoading === 'function') {
        window.UIStates.showGlobalLoading({ text: `Syncing ${pending.length} evaluation(s)…`, determinate: true, cancellable: true, onCancel: () => controller.abort() });
    }
    showToast(`Syncing ${pending.length} evaluation(s)...`, 'info');
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < pending.length; i++) {
        if (controller.signal && controller.signal.aborted) break;
        const evaluation = pending[i];
        const ok = await syncWithRetry(evaluation, 3);
        if (ok) successCount++; else failureCount++;
        try { if (window.UIStates && typeof window.UIStates.updateGlobalProgress === 'function') window.UIStates.updateGlobalProgress(((i + 1) / pending.length) * 100); } catch (_) { }
    }

    const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
    saveEvaluationsToLocal(profileKey, profileEvaluations);

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Sync Data';
    }

    renderEvaluationsList();
    try { if (window.UIStates && typeof window.UIStates.hideGlobalLoading === 'function') window.UIStates.hideGlobalLoading(); } catch (_) { }
    if (failureCount === 0) {
        const msg = controller.signal && controller.signal.aborted ? `Sync canceled: ${successCount} succeeded.` : `Sync complete: ${successCount} succeeded.`;
        showToast(msg, 'success');
    } else {
        const msg = controller.signal && controller.signal.aborted ? `Sync canceled: ${successCount} succeeded, ${failureCount} failed.` : `Sync complete: ${successCount} succeeded, ${failureCount} failed.`;
        showToast(msg, 'warning');
    }
}

// Bulk sync directly to Supabase via backend API
async function syncAllToSupabase() {
    try {
        if (!navigator.onLine) {
            showToast('Offline: connect to the internet to sync.', 'warning');
            return;
        }

        const userEmail = (currentProfile && currentProfile.rsEmail) || '';
        if (!userEmail) {
            alert('No logged-in user detected. Please login first.');
            return;
        }

        const all = Array.isArray(profileEvaluations) ? profileEvaluations.slice() : [];
        if (all.length === 0) {
            showToast('No evaluations to sync.', 'info');
            return;
        }

        const btn = document.activeElement && document.activeElement.tagName === 'BUTTON' ? document.activeElement : null;
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing…'; }

        const endpoint = (window.CONSTANTS?.ROUTES?.API?.EVALUATION_SAVE) || '/api/evaluation/save';
        const base = window.API_BASE_URL || location.origin;
        const url = new URL(endpoint, base).toString();
        const headers = { 'Content-Type': 'application/json' };
        try {
            const csrf = (typeof getCsrfToken === 'function') ? getCsrfToken() : (sessionStorage.getItem('fitrep_csrf_token') || '');
            if (csrf) headers['X-CSRF-Token'] = csrf;
        } catch (_) {}
        try {
            const sessTok = sessionStorage.getItem('fitrep_session_token') || '';
            if (sessTok) headers['Authorization'] = `Bearer ${sessTok}`;
        } catch (_) {}

        let success = 0, failure = 0;
        for (let i = 0; i < all.length; i++) {
            const ev = all[i];
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({ evaluation: ev, userEmail })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data?.ok) {
                    failure++;
                    console.warn('Supabase sync failed:', data);
                } else {
                    success++;
                    ev.syncStatus = 'synced';
                }
            } catch (e) {
                failure++;
                console.error('Supabase sync exception:', e);
            }
        }

        const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
        saveEvaluationsToLocal(profileKey, profileEvaluations);
        renderEvaluationsList();
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync to Supabase'; }
        const msg = `Sync complete: ${success} succeeded${failure ? `, ${failure} failed` : ''}.`;
        showToast(msg, failure ? 'warning' : 'success');
    } catch (err) {
        console.error('Bulk Supabase sync error:', err);
        alert('Bulk sync failed. Please try again.');
    }
}

// Removed: syncAllFromGitHubToSupabase (Supabase integration disabled)

// Pending sync guard helpers
function hasPendingSyncs() {
    try {
        return Array.isArray(window.profileEvaluations) && window.profileEvaluations.some(e => String(e.syncStatus || 'pending') !== 'synced');
    } catch (_) {
        return false;
    }
}

function openPendingSyncModal(nextAction) {
    const modal = document.getElementById('pendingSyncModal');
    const countEl = document.getElementById('pendingSyncCount');
    const nextEl = document.getElementById('pendingSyncNextAction');
    if (!modal) return;
    const count = (window.profileEvaluations || []).filter(e => String(e.syncStatus || 'pending') !== 'synced').length;
    if (countEl) countEl.textContent = String(count);
    if (nextEl) nextEl.value = nextAction || '';
    try {
        if (window.ModalController && typeof window.ModalController.openById === 'function') {
            window.ModalController.openById('pendingSyncModal', { labelledBy: 'pendingSyncTitle' });
        } else {
            modal.style.display = 'block';
            modal.classList.add('active');
            try { if (window.A11y && typeof window.A11y.openDialog === 'function') window.A11y.openDialog(modal, { labelledBy: 'pendingSyncTitle' }); } catch (_) { }
        }
    } catch (_) {
        modal.style.display = 'block';
        modal.classList.add('active');
    }
}

function closePendingSyncModal() {
    const modal = document.getElementById('pendingSyncModal');
    if (!modal) return;
    try {
        if (window.ModalController && typeof window.ModalController.closeById === 'function') {
            window.ModalController.closeById('pendingSyncModal');
        } else {
            try { if (window.A11y && typeof window.A11y.closeDialog === 'function') window.A11y.closeDialog(modal); } catch (_) { }
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    } catch (_) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    const nextEl = document.getElementById('pendingSyncNextAction');
    if (nextEl) nextEl.value = '';
    try {
        document.querySelectorAll('.sa-modal-backdrop').forEach(el => { try { el.remove(); } catch (_) { } });
        document.body.classList.remove('sa-modal-open');
        document.body.style.overflow = '';
    } catch (_) { }
}

async function handlePendingSyncConfirm() {
    try {
        await syncAllEvaluations();
    } catch (e) {
        console.warn('Sync attempt failed:', e);
    }
    const nextEl = document.getElementById('pendingSyncNextAction');
    const next = nextEl ? nextEl.value : '';
    closePendingSyncModal();
    if (next === 'startNewEvaluation') {
        continueStartNewEvaluation();
    } else if (next === 'logoutProfile') {
        continueLogoutProfile();
    }
}

// Utility Functions
function startNewEvaluation() {
    if (hasPendingSyncs()) {
        openPendingSyncModal('startNewEvaluation');
        return;
    }
    continueStartNewEvaluation();
}

function continueStartNewEvaluation() {
    const dash = document.getElementById('profileDashboardCard');
    if (dash) {
        dash.classList.remove('active');
        dash.style.display = 'none';
    }

    // Also hide login card if visible (skip flow)
    const login = document.getElementById('profileLoginCard');
    if (login) {
        login.classList.remove('active');
        login.style.display = 'none';
    }

    // Restore app chrome hidden by the dashboard; ensure login/home classes are cleared
    try { document.body.classList.remove('auth-login'); document.body.classList.remove('home-mode'); } catch (_) { }
    // Restore app chrome hidden by the dashboard
    const header = document.querySelector('.header');
    const warning = document.getElementById('dataWarning');
    if (header) header.style.display = '';
    if (warning) warning.style.display = '';

    // Show setup card
    const setup = document.getElementById('setupCard');
    if (setup) {
        setup.classList.add('active');
        setup.style.display = 'block';
    }

    // Prefill and toggle RS info display/input based on profile context
    try {
        if (typeof updateRSSetupDisplay === 'function') {
            updateRSSetupDisplay();
        } else {
            // Fallback: basic toggle
            const evaluatorInput = document.getElementById('evaluatorNameInput');
            const rsDisplay = document.getElementById('rsProfileDisplay');
            const rsName = window.currentProfile?.rsName || '';
            const rsRank = window.currentProfile?.rsRank || '';
            if (rsDisplay) {
                rsDisplay.textContent = rsName ? `Reporting Senior: ${rsRank ? `${rsRank} ` : ''}${rsName}` : '';
                rsDisplay.style.display = rsName ? 'block' : 'none';
            }
            if (evaluatorInput) {
                evaluatorInput.value = rsName;
                evaluatorInput.style.display = rsName ? 'none' : '';
            }
        }
    } catch (_) { /* noop */ }

    // Align navigation state if available
    try {
        if (typeof jumpToStep === 'function' && typeof STEPS !== 'undefined') {
            jumpToStep(STEPS.setup);
        }
    } catch (e) {
        // no-op if navigation is not initialized
    }
}

function deleteEvaluation(evalId) {
  if (!confirm('Delete this evaluation? This cannot be undone.')) {
    return;
  }
  try {
    const endpoint = (window.CONSTANTS?.ROUTES?.API?.EVALUATION_DELETE_PREFIX) || '/api/evaluation/';
    const urlObj = new URL(endpoint + encodeURIComponent(evalId), window.API_BASE_URL || location.origin);
    try {
      const email = (window.currentProfile?.rsEmail || '').trim();
      if (email) urlObj.searchParams.set('email', email);
    } catch (_) {}
    const url = urlObj.toString();
    const headers = { 'Content-Type': 'application/json' };
    try {
      const csrf = (typeof getCsrfToken === 'function') ? getCsrfToken() : (sessionStorage.getItem('fitrep_csrf_token') || '');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    } catch (_) {}
    try {
      const sessTok = sessionStorage.getItem('fitrep_session_token') || '';
      if (sessTok) headers['Authorization'] = `Bearer ${sessTok}`;
    } catch (_) {}
    const creds = 'include';
    fetch(url, { method: 'DELETE', headers, credentials: creds })
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.error || `Delete failed (${resp.status})`);
        }
        profileEvaluations = profileEvaluations.filter(e => e.evaluationId !== evalId);
        const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
        saveEvaluationsToLocal(profileKey, profileEvaluations);
        renderEvaluationsList();
      })
      .catch((err) => {
        console.error('Delete evaluation error:', err);
        alert('Failed to delete evaluation on server. Your local list may be out of sync.');
      });
  } catch (e) {
    console.error('Delete evaluation exception:', e);
  }
}

function exportEvaluation(evalId) {
    const evaluation = profileEvaluations.find(e => e.evaluationId === evalId);
    if (!evaluation) return;

    const jspdfNS = window.jspdf || {};
    const jsPDF = jspdfNS.jsPDF;
    if (!jsPDF) {
        alert('PDF library not loaded. Please check your internet connection.');
        return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const margin = 40;
    let y = margin;

    // Header: Marine - Rank - Occasion - EndDate (YYYYMMDD)
    doc.setFontSize(18);
    const headerMarine = evaluation.marineInfo?.name ?? '';
    const headerRank = evaluation.marineInfo?.rank ?? '';
    const headerOccasion = evaluation.occasion ?? (evaluation.evaluationMeta?.occasionType ?? 'N/A');
    const endDateRaw = evaluation.marineInfo?.evaluationPeriod?.to ?? '';
    const endDateYYYYMMDD = endDateRaw ? endDateRaw.replaceAll('-', '') : '';
    const pdfTitle = `${headerMarine} - ${headerRank} - ${headerOccasion} - ${endDateYYYYMMDD}`;
    doc.text(pdfTitle, margin, y);
    y += 28;

    // Meta information
    doc.setFontSize(11);
    const rsName = evaluation.rsInfo?.name ?? '';
    const rsRank = evaluation.rsInfo?.rank ?? '';
    const marineName = evaluation.marineInfo?.name ?? '';
    const marineRank = evaluation.marineInfo?.rank ?? '';
    const periodFrom = evaluation.marineInfo?.evaluationPeriod?.from ?? '';
    const periodTo = evaluation.marineInfo?.evaluationPeriod?.to ?? '';
    const occasion = evaluation.occasion ?? (evaluation.evaluationMeta?.occasionType ?? '');
    const metaLines = [
        `Marine: ${marineRank ? marineRank + ' ' : ''}${marineName}`,
        `Period: ${periodFrom} to ${periodTo}`,
        `Reporting Senior: ${rsRank ? rsRank + ' ' : ''}${rsName}`,
        `Occasion: ${occasion || 'N/A'}`,
        `FitRep Score: ${evaluation.fitrepAverage}`
    ];
    metaLines.forEach(line => { doc.text(line, margin, y); y += 16; });

    // Trait evaluations table
    const rows = Object.values(evaluation.traitEvaluations || {}).map(r => [
        r.section || '',
        r.trait || '',
        r.grade || '',
        (r.justification ?? '').trim().replace(/\s+/g, ' ').slice(0, 200)
    ]);

    if (typeof doc.autoTable === 'function') {
        doc.autoTable({
            startY: y + 10,
            head: [['Section', 'Trait', 'Grade', 'Justification']],
            body: rows,
            styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
            columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 220 }, 2: { cellWidth: 60 }, 3: { cellWidth: 'auto' } }
        });
        y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : y + 20;
    } else {
        // Fallback: simple list if autotable is unavailable
        y += 10;
        doc.setFontSize(12);
        doc.text('Trait Evaluations:', margin, y);
        y += 16;
        doc.setFontSize(10);
        rows.forEach(row => {
            const line = `${row[0]} - ${row[1]} | Grade: ${row[2]}`;
            doc.text(line, margin, y);
            y += 14;
            const wrapped = doc.splitTextToSize(row[3], doc.internal.pageSize.getWidth() - margin * 2);
            doc.text(wrapped, margin, y);
            y += Math.max(14, wrapped.length * 12) + 6;
        });
    }

    // Section I comments
    doc.setFontSize(12);
    doc.text('Section I - Narrative Comments', margin, y);
    y += 16;
    doc.setFontSize(10);
    const sectionI = (evaluation.sectionIComments || '').trim() || 'None provided';
    const sectionIWrapped = doc.splitTextToSize(sectionI, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(sectionIWrapped, margin, y);
    y += Math.max(20, sectionIWrapped.length * 12) + 10;

    // Directed comments
    doc.setFontSize(12);
    doc.text('Section I - Directed Comments', margin, y);
    y += 16;
    doc.setFontSize(10);
    const directed = (evaluation.directedComments || '').trim() || 'None provided';
    const directedWrapped = doc.splitTextToSize(directed, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(directedWrapped, margin, y);
    y += Math.max(20, directedWrapped.length * 12) + 10;

    // Footer
    const when = new Date(evaluation.completedDate || Date.now()).toLocaleDateString();
    doc.setFontSize(9);
    doc.text(`Generated on ${when}`, margin, doc.internal.pageSize.getHeight() - margin);

    // Always trigger a direct download to avoid in-page/open-tab behavior
    // This ensures consistent UX across machines/browsers that may open PDFs inline
    doc.save(`${pdfTitle}.pdf`);
}

function exportProfile() {
    const exportData = {
        profile: currentProfile,
        evaluations: profileEvaluations
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-${currentProfile.rsName.replace(/[^a-z0-9]/gi, '-')}.json`;
    a.click();
}

// Manage Data dropdown logic and CSV import/template export
let manageMenuOutsideHandler = null;
function toggleSubMenu() {
    const menu = document.getElementById('subMenu');
    const chevron = document.querySelector('#mainToggleButton .btn-icon-chevron');
    const toggleBtn = document.getElementById('mainToggleButton');
    if (!menu) return;
    const isActive = menu.classList.contains('active');
    if (isActive) {
        menu.classList.remove('active');
        if (chevron) chevron.classList.remove('rotated');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        if (manageMenuOutsideHandler) {
            document.removeEventListener('click', manageMenuOutsideHandler, true);
            manageMenuOutsideHandler = null;
        }
        try { if (window.A11y) A11y.announce('Manage data menu collapsed'); } catch (_) { }
    } else {
        menu.classList.add('active');
        if (chevron) chevron.classList.add('rotated');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        // Focus first actionable item when opening
        const firstItem = menu.querySelector('button');
        try { if (firstItem) firstItem.focus(); } catch (_) { }
        try { if (window.A11y) A11y.announce('Manage data menu expanded'); } catch (_) { }
        manageMenuOutsideHandler = (e) => {
            const withinMenu = menu.contains(e.target);
            const withinToggle = toggleBtn && toggleBtn.contains(e.target);
            if (!withinMenu && !withinToggle) {
                menu.classList.remove('active');
                if (chevron) chevron.classList.remove('rotated');
                if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
                document.removeEventListener('click', manageMenuOutsideHandler, true);
                manageMenuOutsideHandler = null;
                try { if (window.A11y) A11y.announce('Manage data menu collapsed'); } catch (_) { }
            }
        };
        document.addEventListener('click', manageMenuOutsideHandler, true);
    }
}

function exportAllData() {
    // Preserve existing JSON export for full profile + evaluations
    exportProfile();
    // Close menu after action
    const menu = document.getElementById('subMenu');
    if (menu) menu.classList.remove('active');
    const chevron = document.querySelector('#mainToggleButton .btn-icon-chevron');
    if (chevron) chevron.classList.remove('rotated');
}

function initiateUpload() {
    const input = document.getElementById('csvUploadInput');
    if (!input) {
        alert('Upload input not found.');
        return;
    }
    input.value = '';
    input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const { headers, rows } = parseCsv(text);
            const added = importEvaluationsFromRows(headers, rows);
            // Persist to local storage
            const profileKey = generateProfileKey(currentProfile.rsName, currentProfile.rsEmail);
            saveEvaluationsToLocal(profileKey, profileEvaluations);
            currentProfile.totalEvaluations = profileEvaluations.length;
            currentProfile.lastUpdated = new Date().toISOString();
            saveProfileToLocal(profileKey, currentProfile);
            renderEvaluationsList();
            alert(`${added} evaluations imported from CSV.`);
        } catch (err) {
            console.error('CSV import failed:', err);
            alert(`CSV import failed: ${err.message || err}`);
        } finally {
            // Close menu
            const menu = document.getElementById('subMenu');
            if (menu) menu.classList.remove('active');
            const chevron = document.querySelector('#mainToggleButton .btn-icon-chevron');
            if (chevron) chevron.classList.remove('rotated');
        }
    };
    input.click();
}

function downloadTemplate() {
    const headers = [
        'Marine', 'Rank', 'Occasion', 'Ending Date',
        'Performance', 'Proficiency', 'Courage', 'Stress Tolerance', 'Initiative', 'Leading', 'Developing Others',
        'Setting the Example', 'Well-Being/Health', 'Communication Skills', 'Professional Military Education', 'Decision Making', 'Judgement', 'Evals'
    ];
    const csv = headers.map(h => `"${h}"`).join(',') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FITREP_Manage_Data_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
    const menu = document.getElementById('subMenu');
    if (menu) menu.classList.remove('active');
    const chevron = document.querySelector('#mainToggleButton .btn-icon-chevron');
    if (chevron) chevron.classList.remove('rotated');
}

function parseCsv(text) {
    // Simple CSV parser with quote handling
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) throw new Error('CSV is empty');
    const parseLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { // escaped quote
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur += ch;
                }
            } else {
                if (ch === ',') {
                    result.push(cur.trim());
                    cur = '';
                } else if (ch === '"') {
                    inQuotes = true;
                } else {
                    cur += ch;
                }
            }
        }
        result.push(cur.trim());
        return result;
    };
    const headers = parseLine(lines[0]).map(h => h.trim());
    const rows = lines.slice(1).map(parseLine).filter(r => r.some(v => v && v.trim().length));
    return { headers, rows };
}

function importEvaluationsFromRows(headers, rows) {
    const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
    const lookup = {
        marine: idx('Marine'),
        rank: idx('Rank'),
        occasion: idx('Occasion'),
        endDate: idx('Ending Date'),
        Performance: idx('Performance'),
        Proficiency: idx('Proficiency'),
        Courage: idx('Courage'),
        'Stress Tolerance': idx('Stress Tolerance'),
        Initiative: idx('Initiative'),
        Leading: idx('Leading'),
        'Developing Others': idx('Developing Others'),
        'Setting the Example': idx('Setting the Example'),
        'Well-Being/Health': idx('Well-Being/Health'),
        'Communication Skills': idx('Communication Skills'),
        'Professional Military Education': idx('Professional Military Education'),
        'Decision Making': idx('Decision Making'),
        Judgement: idx('Judgement'),
        Evals: idx('Evals')
    };
    const requiredBase = ['marine', 'rank', 'endDate'];
    requiredBase.forEach(k => { if (lookup[k] === -1) throw new Error(`Missing required column: ${k}`); });

    const letterToNumber = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };
    const traitToSection = {
        'Performance': 'Mission Accomplishment',
        'Proficiency': 'Mission Accomplishment',
        'Courage': 'Individual Character',
        'Effectiveness Under Stress': 'Individual Character',
        'Stress Tolerance': 'Individual Character',
        'Initiative': 'Individual Character',
        'Leading Subordinates': 'Leadership',
        'Leading': 'Leadership',
        'Developing Subordinates': 'Leadership',
        'Developing Others': 'Leadership',
        'Setting the Example': 'Leadership',
        'Ensuring Well-being of Subordinates': 'Leadership',
        'Well-Being/Health': 'Leadership',
        'Communication Skills': 'Leadership',
        'Professional Military Education (PME)': 'Intellect and Wisdom',
        'Professional Military Education': 'Intellect and Wisdom',
        'Decision Making Ability': 'Intellect and Wisdom',
        'Decision Making': 'Intellect and Wisdom',
        'Judgment': 'Intellect and Wisdom',
        'Judgement': 'Intellect and Wisdom',
        'Evaluations': 'Fulfillment of Evaluation Responsibilities',
        'Evals': 'Fulfillment of Evaluation Responsibilities'
    };

    let added = 0;
    rows.forEach((row, i) => {
        const getVal = (idx) => idx >= 0 ? String(row[idx] || '').trim() : '';
        const marineName = getVal(lookup.marine);
        const marineRank = getVal(lookup.rank);
        const occasion = lookup.occasion >= 0 ? getVal(lookup.occasion) : '';
        const endDate = getVal(lookup.endDate);
        if (!marineName || !marineRank || !endDate) return; // skip incomplete rows

        const traitItems = [];
        const traitCols = [
            'Performance', 'Proficiency', 'Courage', 'Stress Tolerance', 'Initiative', 'Leading', 'Developing Others',
            'Setting the Example', 'Well-Being/Health', 'Communication Skills', 'Professional Military Education', 'Decision Making', 'Judgement', 'Evals'
        ];
        traitCols.forEach(tc => {
            const letter = getVal(lookup[tc]);
            if (!letter) return;
            const L = letter.toUpperCase();
            const num = letterToNumber[L];
            if (!num) return; // ignore invalid letters
            const traitName = tc;
            const sectionName = traitToSection[tc] || 'Unknown Section';
            traitItems.push({
                section: sectionName,
                trait: traitName,
                grade: L,
                gradeNumber: num,
                justification: ''
            });
        });

        const evaluationId = `bulk-${new Date().toISOString().slice(0, 10)}-${Date.now()}-${i}`;
        const evaluation = {
            evaluationId,
            rsInfo: {
                name: currentProfile ? currentProfile.rsName : 'Reporting Senior',
                email: currentProfile ? currentProfile.rsEmail : 'offline@local',
                rank: currentProfile ? currentProfile.rsRank : 'Unknown'
            },
            marineInfo: {
                name: marineName,
                rank: marineRank,
                evaluationPeriod: { from: endDate, to: endDate }
            },
            occasion,
            completedDate: new Date().toISOString(),
            fitrepAverage: (() => {
                const nums = traitItems.map(t => t.gradeNumber);
                return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '0';
            })(),
            traitEvaluations: traitItems,
            sectionIComments: '',
            directedComments: '',
            savedToProfile: true,
            syncStatus: 'pending'
        };

        profileEvaluations.push(evaluation);
        added += 1;
    });
    return added;
}

function logoutProfile() {
    if (hasPendingSyncs()) {
        openPendingSyncModal('logoutProfile');
        return;
    }
    continueLogoutProfile();
}

function continueLogoutProfile() {
    if (confirm('Log out? Unsaved changes will remain in local storage.')) {
        // Ensure any open modals/overlays are closed so interactions aren't blocked
        try {
            if (window.ModalController && typeof window.ModalController.closeAll === 'function') {
                window.ModalController.closeAll();
            } else {
                document.querySelectorAll('.sa-modal-backdrop').forEach(el => { try { el.remove(); } catch (_) { } });
                document.body.classList.remove('sa-modal-open');
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
            }
            const navOverlay = document.getElementById('navMenuOverlay');
            if (navOverlay) navOverlay.classList.remove('active');
            document.body.style.overflow = '';
        } catch (_) { /* ignore cleanup errors */ }

        // Attempt to clear server-side session cookies
        try {
            const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : window.location.origin;
            const LOGOUT_ROUTE = (window.CONSTANTS?.ROUTES?.API?.ACCOUNT_LOGOUT) || '/api/account/logout';
            const endpoint = new URL(LOGOUT_ROUTE, base).toString();
            fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => { });
        } catch (_) { /* ignore */ }
        currentProfile = null;
        profileEvaluations = [];

        // Clear session snapshot and login flags
        localStorage.removeItem('current_profile');
        localStorage.removeItem('current_evaluations');
        localStorage.removeItem('has_profile');
        localStorage.removeItem('login_source');
        // Also clear the session-scoped login source and CSRF token
        try {
            sessionStorage.removeItem('login_source');
            sessionStorage.removeItem('fitrep_csrf_token');
        } catch (_) { }

        // Hide dashboard
        const dash = document.getElementById('profileDashboardCard');
        if (dash) {
            dash.classList.remove('active');
            dash.style.display = 'none';
        }

        // Route back to the main Mode Selection home page
        const header = document.querySelector('.header');
        const warning = document.getElementById('dataWarning');
        const mode = document.getElementById('modeSelectionCard');
        const login = document.getElementById('profileLoginCard');
        const loginFields = document.getElementById('loginFields');
        const typewriter = document.getElementById('loginTypewriter');

        // Restore app chrome and clear login class; set home-mode
        try {
            document.body.classList.remove('auth-login');
            document.body.classList.add('home-mode');
        } catch (_) { }
        // Restore app chrome
        if (header) header.style.display = '';
        if (warning) warning.style.display = '';

        // Hide all app cards
        const cardsToHide = [
            'profileLoginCard',
            'setupCard',
            'howItWorksCard',
            'evaluationContainer',
            'reviewCard',
            'sectionIGenerationCard',
            'directedCommentsCard',
            'summaryCard'
        ];
        cardsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active');
                el.style.display = 'none';
            }
        });

        // Show the welcome Mode Selection card via centralized exclusive toggle
        // Show RS Login by default after logout
        try {
            if (window.UIStates && typeof window.UIStates.toggleExclusive === 'function') {
                window.UIStates.toggleExclusive('profileLoginCard', 'modeSelectionCard');
            }
        } catch (_) { }
        if (mode) { mode.classList.remove('active'); mode.style.display = 'none'; }
        if (login) { login.classList.add('active'); login.style.display = 'block'; }
        if (loginFields) { loginFields.style.display = 'block'; }
        const createSection = document.getElementById('createAccountSection');
        if (createSection) { createSection.style.display = 'none'; }
        if (typewriter) { typewriter.style.display = 'none'; }

        // Final safety: remove any lingering modal backdrops
        try {
            document.querySelectorAll('.sa-modal-backdrop').forEach(el => { try { el.remove(); } catch (_) { } });
            document.body.classList.remove('sa-modal-open');
            document.body.style.overflow = '';
        } catch (_) { }

        window.scrollTo({ top: 0, behavior: 'auto' });
    }
}

// Expose modal handlers
try {
    window.handlePendingSyncConfirm = handlePendingSyncConfirm;
    window.closePendingSyncModal = closePendingSyncModal;
} catch (_) { /* ignore */ }

// Connection Status
function updateConnectionStatus() {
    const C = (typeof window !== 'undefined' && window.CONSTANTS) || {};
    const STATUS = (C.STATUS_MESSAGES) || { ONLINE: 'Connected - Sync available', OFFLINE: 'Offline - Changes saved locally' };
    const CSS = (C.UI_SETTINGS && C.UI_SETTINGS.CSS) || { ONLINE: 'online', OFFLINE: 'offline' };
    const indicator = document.getElementById('connectionStatus');
    const dot = document.querySelector('.status-dot');

    if (navigator.onLine) {
        indicator.textContent = STATUS.ONLINE;
        dot.classList.add(CSS.ONLINE);
        dot.classList.remove(CSS.OFFLINE);
    } else {
        indicator.textContent = STATUS.OFFLINE;
        dot.classList.add(CSS.OFFLINE);
        dot.classList.remove(CSS.ONLINE);
    }
}

// Connection status event listeners with lifecycle management
if (typeof globalLifecycle !== 'undefined') {
    globalLifecycle.addEventListener(window, 'online', updateConnectionStatus);
    globalLifecycle.addEventListener(window, 'offline', updateConnectionStatus);
    globalLifecycle.addEventListener(window, 'load', updateConnectionStatus);
} else {
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    window.addEventListener('load', updateConnectionStatus);
}

// Helper stubs for functions referenced from evaluation.js
function calculateFitrepAverage() {
    // Excel-style aliases for the 13/14 attributes
    const traitAliases = {
        Perf: ['Performance'],
        Prof: ['Proficiency'],
        Courage: ['Courage'],
        Stress: ['Effectiveness Under Stress', 'Stress Tolerance'],
        Initiative: ['Initiative'],
        Leading: ['Leading Subordinates', 'Leading'],
        Develop: ['Developing Subordinates', 'Developing Others'],
        'Set Exp': ['Setting the Example'],
        'Well Being': ['Ensuring Well-being of Subordinates', 'Well-Being/Health', 'Well Being', 'Well-being'],
        'Comm Skill': ['Communication Skills'],
        PME: ['Professional Military Education (PME)', 'Professional Military Education', 'PME'],
        Decision: ['Decision Making Ability', 'Decision Making'],
        Judgement: ['Judgment', 'Judgement'],
        Evals: ['Evaluations'] // Section H
    };

    const items = Object.values(evaluationResults || {});
    const getGradeNum = (aliases) => {
        const found = items.find(t =>
            aliases.some(a => (t.trait || '').trim().toLowerCase() === a.toLowerCase())
        );
        return found ? (found.gradeNumber || 0) : 0;
    };

    // Sum all 13 core traits + optional Section H (Evals)
    const total =
        getGradeNum(traitAliases['Perf']) +
        getGradeNum(traitAliases['Prof']) +
        getGradeNum(traitAliases['Courage']) +
        getGradeNum(traitAliases['Stress']) +
        getGradeNum(traitAliases['Initiative']) +
        getGradeNum(traitAliases['Leading']) +
        getGradeNum(traitAliases['Develop']) +
        getGradeNum(traitAliases['Set Exp']) +
        getGradeNum(traitAliases['Well Being']) +
        getGradeNum(traitAliases['Comm Skill']) +
        getGradeNum(traitAliases['PME']) +
        getGradeNum(traitAliases['Decision']) +
        getGradeNum(traitAliases['Judgement']) +
        getGradeNum(traitAliases['Evals']);

    // Denominator: 14 if Section H present; else 13
    const hasSectionH =
        items.some(t =>
            (t.trait || '').trim().toLowerCase() === 'evaluations' ||
            (t.section || '').trim().toLowerCase() === 'fulfillment of evaluation responsibilities'
        );

    const denom = hasSectionH ? 14 : 13;
    const avg = denom > 0 ? (total / denom) : 0;

    return avg.toFixed(2);
}



// Add: sorting state and setter
let gridSort = 'DateDesc';

function setGridSort(value) {
    gridSort = value;
    renderProfileGrid();
}


// Helpers for grid view
/* Removed duplicate getTraitGrades (older version). Using the later, refactored version defined further below. */

/* Removed duplicate computeRvValues (older version). Using the later, unified ranking version defined below. */

/* Removed duplicate computeCumulativeRv (older version). Using the later, simplified cumulative average version defined below. */

/* Removed duplicate badgeForRv (older version). Using the later version defined below. */

// New: Rank Summary bar (Excel-style)
// High = MAX(T:T)
// Avg = AVERAGEIF(R:R,"<>H",T:T)  -> average of fitrepAverage where fitrepAverage > 0
// Low = MINIFS(T:T,R:R,"<>H")     -> minimum of fitrepAverage where fitrepAverage > 0
// # Rpts = COUNTA(C:C) - COUNTIF(R:R,"H") - 1 -> total - zeros - 1
function renderRankSummary(evals) {
    const container = document.getElementById('profileGridContainer');
    if (!container) return;

    let summaryEl = document.getElementById('rankSummaryBar');
    if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.id = 'rankSummaryBar';
        summaryEl.style.display = 'flex';
        summaryEl.style.justifyContent = 'flex-end';
        summaryEl.style.gap = '10px';
        summaryEl.style.margin = '8px 0';
        summaryEl.style.padding = '8px';
        summaryEl.style.border = '2px solid #c2185b';
        summaryEl.style.borderRadius = '6px';
        summaryEl.style.background = '#fff';
        summaryEl.style.alignItems = 'center'; // center badges vertically
        // Insert just above the table
        const actions = container.querySelector('.profile-grid-actions');
        if (actions && actions.nextSibling) {
            container.insertBefore(summaryEl, actions.nextSibling);
        } else {
            container.appendChild(summaryEl);
        }
    }

    const scores = (evals || [])
        .map(e => parseFloat(e.fitrepAverage || '0'))
        .filter(n => Number.isFinite(n));
    const nonZero = scores.filter(n => n > 0);
    const high = scores.length ? Math.max(...scores) : 0;
    const avg = nonZero.length ? (nonZero.reduce((s, x) => s + x, 0) / nonZero.length) : 0;
    const low = nonZero.length ? Math.min(...nonZero) : 0;
    const zeroCount = scores.filter(n => n === 0).length;
    const rpts = Math.max(0, scores.length - zeroCount);

    const fmt = (n) => Number.isFinite(n) ? n.toFixed(2) : '0.00';
    const pill = (label, value, color) =>
        `<span style="background:${color};color:#fff;padding:4px 8px;border-radius:14px;font-weight:700;">${label}: ${value}</span>`;

    summaryEl.innerHTML = [
        pill('High', fmt(high), '#2e7d32'),
        pill('Avg', fmt(avg), '#1565c0'),
        pill('Low', fmt(low), '#c62828'),
        pill('# Rpts', rpts, '#6a1b9a')
    ].join(' ');

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('rankHighVal', high.toFixed(2));
    setText('rankAvgVal', avg.toFixed(2));
    setText('rankLowVal', low.toFixed(2));
    setText('rankRptsVal', rpts);
}

// Compute High / Avg / Low / # Rpts from the table's Avg column
function renderRankSummaryFromDom() {
    const tbody = document.querySelector('#profileGrid tbody');
    if (!tbody) return;

    const container = document.getElementById('profileGridContainer');
    if (!container) return;

    let summaryEl = document.getElementById('rankSummaryBar');
    if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.id = 'rankSummaryBar';
        summaryEl.style.display = 'flex';
        summaryEl.style.justifyContent = 'flex-end';
        summaryEl.style.gap = '10px';
        summaryEl.style.margin = '8px 0';
        summaryEl.style.padding = '8px';
        summaryEl.style.border = '2px solid #c2185b';
        summaryEl.style.borderRadius = '6px';
        summaryEl.style.background = '#fff';
        summaryEl.style.alignItems = 'center'; // center badges vertically
        // Insert just above the table
        const actions = container.querySelector('.profile-grid-actions');
        if (actions && actions.nextSibling) {
            container.insertBefore(summaryEl, actions.nextSibling);
        } else {
            container.appendChild(summaryEl);
        }
    }

    const avgCells = Array.from(tbody.querySelectorAll('.avg-cell'));
    const values = avgCells.map(cell => {
        const v = parseFloat((cell.textContent || '').trim().replace(/[^\d.-]/g, ''));
        return Number.isFinite(v) ? v : 0;
    });

    const nonZero = values.filter(n => n > 0);
    const high = values.length ? Math.max(...values) : 0;
    const avg = nonZero.length ? (nonZero.reduce((s, x) => s + x, 0) / nonZero.length) : 0;
    const low = nonZero.length ? Math.min(...nonZero) : 0;
    const zeroCount = values.filter(n => n === 0).length;
    const rpts = Math.max(0, values.length - zeroCount);

    const fmt = (n) => Number.isFinite(n) ? n.toFixed(2) : '0.00';
    const pill = (label, value, color) =>
        `<span style="background:${color};color:#fff;padding:4px 8px;border-radius:14px;font-weight:700;">${label}: ${value}</span>`;

    summaryEl.innerHTML = [
        pill('High', fmt(high), '#2e7d32'),
        pill('Avg', fmt(avg), '#1565c0'),
        pill('Low', fmt(low), '#c62828'),
        pill('# Rpts', rpts, '#6a1b9a')
    ].join(' ');

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('rankHighVal', high.toFixed(2));
    setText('rankAvgVal', avg.toFixed(2));
    setText('rankLowVal', low.toFixed(2));
    setText('rankRptsVal', rpts);

    // Also update alternative element IDs if they exist
    const highEl = document.getElementById('rankHighValue');
    const avgEl = document.getElementById('rankAvgValue');
    const lowEl = document.getElementById('rankLowValue');
    const rptsEl = document.getElementById('rankReportsValue');

    if (highEl) highEl.textContent = high.toFixed(2);
    if (avgEl) avgEl.textContent = avg.toFixed(2);
    if (lowEl) lowEl.textContent = low.toFixed(2);
    if (rptsEl) rptsEl.textContent = String(rpts);
}

/* Removed duplicate capitalize (older version). Using the later version defined below. */

// Add: CSV export based on current render order
/* Removed duplicate exportProfileGridCsv (older version). Using the later version defined below. */


// Auto-open Dashboard on load if a profile exists
function showProfileDashboardOnLoad() {
    const loginCard = document.getElementById('profileLoginCard');
    const dashboardCard = document.getElementById('profileDashboardCard');
    const modeCard = document.getElementById('modeSelectionCard');
    if (!loginCard || !dashboardCard) return;

    // Only auto-open if the user has a saved profile
    const hasProfile = localStorage.getItem('has_profile') === 'true';
    if (!hasProfile) {
        // Default to Mode Selection on initial load
        if (modeCard) {
            modeCard.classList.add('active');
            modeCard.style.display = 'block';
            try { document.body.classList.add('home-mode'); } catch (_) { }
        }
        loginCard.classList.remove('active');
        loginCard.style.display = 'none';
        dashboardCard.classList.remove('active');
        dashboardCard.style.display = 'none';

        const setupCard = document.getElementById('setupCard');
        if (setupCard) {
            setupCard.classList.remove('active');
            setupCard.style.display = 'none';
        }
        return;
    }

    const stored = loadProfileFromStorage();
    if (!stored) return;

    window.currentProfile = {
        rsName: stored.rsName,
        rsEmail: stored.rsEmail,
        rsRank: stored.rsRank,
        totalEvaluations: (stored.evaluations || []).length,
        lastUpdated: stored.lastUpdated || new Date().toISOString()
    };
    window.profileEvaluations = stored.evaluations || [];

    showProfileDashboard();

    // Prefer showing Dashboard instead of login/setup when a profile exists
    loginCard.style.display = 'none';
    dashboardCard.style.display = 'block';

    const setupCard = document.getElementById('setupCard');
    if (setupCard) setupCard.style.display = 'none';
}

// Profile persistence helpers and GitHub stubs (added)
function loadProfileFromStorage() {
    try {
        const profJson = localStorage.getItem('current_profile');
        if (!profJson) return null;
        const evalsJson = localStorage.getItem('current_evaluations');
        const profile = JSON.parse(profJson);
        const evaluations = evalsJson ? JSON.parse(evalsJson) : [];
        return { ...profile, evaluations };
    } catch (e) {
        console.warn('loadProfileFromStorage failed:', e);
        return null;
    }
}

function generateProfileKey(name, email) {
    const n = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const e = String(email || '').toLowerCase().trim();
    return `rs:${n}|${e}`;
}

function loadProfileFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`profile:${profileKey}`) || 'null');
    } catch (err) {
        console.warn('loadProfileFromLocal failed:', err);
        return null;
    }
}

function saveProfileToLocal(profileKey, profile) {
    try {
        localStorage.setItem(`profile:${profileKey}`, JSON.stringify(profile));
    } catch (err) {
        console.warn('saveProfileToLocal failed:', err);
    }
}

function loadEvaluationsFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`evaluations:${profileKey}`) || '[]');
    } catch (err) {
        console.warn('loadEvaluationsFromLocal failed:', err);
        return [];
    }
}

function saveEvaluationsToLocal(profileKey, evaluations) {
    try {
        localStorage.setItem(`evaluations:${profileKey}`, JSON.stringify(evaluations));
    } catch (err) {
        console.warn('saveEvaluationsToLocal failed:', err);
    }
}

// Optional GitHub integration stubs (safe no-ops)
async function fetchProfileFromGitHub(profileKey) {
    // No GitHub configured; return null to keep app fully offline-capable
    return null;
}

function mergeProfiles(local, remote) {
    if (!local) return remote || null;
    if (!remote) return local;
    return {
        ...local,
        ...remote,
        totalEvaluations: Math.max(local.totalEvaluations || 0, remote.totalEvaluations || 0),
        lastUpdated: new Date().toISOString()
    };
}

async function syncEvaluationToGitHub(evaluation) {
    try {
        // Validate username (required for per-user file path)
        const userEmail = (currentProfile && currentProfile.rsEmail) || (evaluation?.rsInfo?.email) || '';
        if (!userEmail || userEmail === 'offline@local') {
            console.warn('GitHub sync skipped: no valid username');
            return false;
        }

        // Obtain token from environment/backend; fallback to optional local dev config
        let token = null;
        try {
            token = await githubService.getTokenFromEnvironment?.();
        } catch (e) {
            console.warn('Token retrieval failed:', e);
        }
        if (!token && typeof window !== 'undefined' && window.GITHUB_CONFIG?.token) {
            token = window.GITHUB_CONFIG.token; // Dev-only fallback
        }
        if (token) {
            // Initialize and (optionally) verify connection when token is available
            githubService.initialize(token);
            const connected = await githubService.verifyConnection?.();
            if (!connected) {
                console.warn('GitHub connection failed; proceeding with backend fallback if available');
            }
        } else {
            console.warn('No token available; attempting backend fallback for evaluation save');
        }

        // Persist evaluation via service
        const result = await githubService.saveEvaluation(evaluation, userEmail);
        if (result?.success) {
            evaluation.syncStatus = 'synced';
            console.log('Evaluation synced to GitHub:', result.message);
            return true;
        }

        evaluation.syncStatus = 'error';
        console.error('GitHub sync failed:', result?.error || result);
        return false;
    } catch (error) {
        console.error('Error during GitHub sync:', error);
        return false;
    }
}

// Helper function to merge evaluations with conflict resolution
function mergeEvaluations(localEvaluations = [], remoteEvaluations = []) {
    const byId = new Map();

    const put = (ev) => {
        if (!ev) return;
        // Use a stronger composite key when evaluationId is missing to reduce collisions
        const id = ev.evaluationId || `composite:${(ev.marineInfo?.name || '').trim()
            }|${(ev.marineInfo?.rank || '').trim()
            }|${(ev.occasion || '').trim()
            }|${(ev.marineInfo?.evaluationPeriod?.from || '').slice(0, 10)
            }|${(ev.marineInfo?.evaluationPeriod?.to || '').slice(0, 10)
            }|${(ev.createdAt || ev.lastUpdated || ev.completedDate || '')
            }`;
        const prev = byId.get(id);
        const ts = new Date(ev.lastUpdated || ev.completedDate || 0).getTime();
        const prevTs = prev ? new Date(prev.lastUpdated || prev.completedDate || 0).getTime() : -1;
        if (!prev || ts >= prevTs) {
            byId.set(id, ev);
        }
    };

    localEvaluations.forEach(put);
    remoteEvaluations.forEach(put);

    return Array.from(byId.values());
}

// Helper function to try loading remote profile data
/**
 * Try loading a remote profile and evaluations, merging with local data.
 *
 * @param {string} email Email address.
 * @param {string} name Marine name.
 * @param {string} rank Rank label.
 * @param {string} profileKey Local profile key.
 * @param {Object|null} localProfile Existing local profile.
 * @param {Array} localEvaluations Local evaluation list.
 * @returns {Promise<{profile:Object|null,evaluations:Array}>}
 */
async function tryLoadRemoteProfile(email, name, rank, profileKey, localProfile, localEvaluations) {
    if (!navigator.onLine || typeof githubService === 'undefined') {
        return { profile: localProfile, evaluations: localEvaluations };
    }

    try {
        const token = await githubService.getTokenFromEnvironment?.();
        if (!token) return { profile: localProfile, evaluations: localEvaluations };

        githubService.initialize(token);
        const connected = await githubService.verifyConnection?.();
        if (!connected) return { profile: localProfile, evaluations: localEvaluations };

        const remote = await githubService.loadUserData(email);
        if (!remote) return { profile: localProfile, evaluations: localEvaluations };

        // Metadata-only profile from data repo
        const remoteProfile = {
            rsName: remote.rsName || name,
            rsEmail: remote.rsEmail || email,
            rsRank: remote.rsRank || rank,
            lastUpdated: new Date().toISOString()
        };

        // Step 2: migrate legacy embedded evaluations to per-file + index.json
        try { await githubService.migrateLegacyProfileEvaluations?.(email); } catch (_) { }

        // Step 3: load evaluations index.json (lightweight summaries)
        let remoteIndex = null;
        try { remoteIndex = await githubService.loadEvaluationIndex(email); } catch (_) { remoteIndex = null; }

        // Fallback: build index from individual files if index.json missing
        if (!Array.isArray(remoteIndex)) {
            let remoteEvaluations = [];
            try {
                remoteEvaluations = await githubService.loadUserEvaluations(email);
                if (remoteEvaluations.length === 0) {
                    console.info('No remote evaluations found - this may be normal for new profiles');
                }
            } catch (e) {
                console.error('Failed to load remote evaluations during sync:', e);
                // Show user-friendly message if this is a CORS/network error
                if (e.message && (e.message.includes('CORS') || e.message.includes('fetch')) && typeof showToast === 'function') {
                    showToast('Unable to sync evaluations due to network issue. Local data preserved.', 'warning');
                }
                remoteEvaluations = [];
            }
            try {
                remoteIndex = remoteEvaluations.map(ev => githubService.buildIndexEntry(ev, email));
                // Best-effort: save index remotely
                await githubService.saveEvaluationIndex(email, remoteIndex);
            } catch (_) { /* ignore */ }
        }

        // Merge metadata and eval count
        const mergedProfile = mergeProfiles(localProfile, {
            ...remoteProfile,
            totalEvaluations: (Array.isArray(remoteIndex) ? remoteIndex.length : 0) || (localProfile?.totalEvaluations || 0)
        });
        const mergedEvaluations = mergeEvaluations(
            Array.isArray(localEvaluations) ? localEvaluations : [],
            Array.isArray(remoteIndex) ? remoteIndex : []
        );

        // Persist merged result locally for offline-first UX
        saveProfileToLocal(profileKey, mergedProfile);
        saveEvaluationsToLocal(profileKey, mergedEvaluations);
        try { if (window.idbStore) { await window.idbStore.putIndex(email, mergedEvaluations); } } catch (_) { }

        return { profile: mergedProfile, evaluations: mergedEvaluations };
    } catch (error) {
        console.warn('GitHub load on login failed; continuing with local data:', error);
        return { profile: localProfile, evaluations: localEvaluations };
    }
}

// Control visibility of dashboard filters and Grid View based on rank selection
function updateDashboardFiltersVisibility() {
    const filters = document.querySelector('.evaluation-filters');
    const gridBtn = document.getElementById('gridViewBtn');
    const rankBar = document.getElementById('rankFilterBar');
    const shouldShow = !!selectedRankFilter;

    // Always show filters for the RS Summary list
    if (filters) {
        filters.style.display = '';
    }

    // RS Summary View button is hidden until a rank is selected
    if (gridBtn) {
        gridBtn.disabled = !shouldShow;
        gridBtn.style.display = shouldShow ? '' : 'none';
        gridBtn.textContent = '📊 RS Summary View';
    }

    // Hide legacy rank filter bar (we use summary Grade buttons now)
    if (rankBar) {
        rankBar.style.display = 'none';
    }
}

// New: rank filter setter wired to button bar and dropdown
function setRankFilter(rank) {
    selectedRankFilter = rank || '';

    // Sync dropdown value (even if hidden)
    const rankSelect = document.getElementById('filterByRank');
    if (rankSelect) rankSelect.value = selectedRankFilter;

    // Update button visual state
    const bar = document.getElementById('rankFilterBar');
    if (bar) {
        bar.querySelectorAll('button').forEach(btn => {
            const isActive = (btn.dataset.rank || '') === selectedRankFilter;
            btn.classList.toggle('btn-meets', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        });
    }

    // Update visibility for filters and Grid View
    updateDashboardFiltersVisibility();

    // Close grid if rank cleared
    const grid = document.getElementById('profileGridContainer');
    if (!selectedRankFilter && grid && grid.style.display === 'block') {
        toggleGridView(false);
    }

    // Re-render list with filters scoped by rank
    renderEvaluationsList();
}

// Only allow opening grid when a rank is selected
function toggleGridView(show) {
    if (show && !selectedRankFilter) {
        alert('Select a rank first to open Grid View.');
        return;
    }
    const list = document.getElementById('evaluationsList');
    const grid = document.getElementById('profileGridContainer');
    if (!list || !grid) return;
    if (show) {
        list.style.display = 'none';
        grid.style.display = 'block';
        renderProfileGrid();
    } else {
        grid.style.display = 'none';
        list.style.display = 'flex';
    }
}

// Apply filters: rank always required to show filters; others applied only when rank selected
function getFilteredEvaluations() {
    const rankVal = selectedRankFilter || '';
    const filtersVisible = !!selectedRankFilter;

    // Base filter by rank (normalize both sides to avoid label mismatches)
    let list = profileEvaluations.filter(e => {
        const evalRankRaw = String(e.marineInfo?.rank || '');
        const evalRank = normalizeRankLabel(evalRankRaw);
        const selected = normalizeRankLabel(rankVal);
        return selected ? evalRank === selected : true;
    });

    if (!filtersVisible) return list;

    // Additional filters (only after a rank is selected)
    const nameVal = (document.getElementById('filterByName')?.value || '').trim().toLowerCase();
    const occasionVal = (document.getElementById('filterByOccasion')?.value || '').trim().toLowerCase();
    const yearVal = (document.getElementById('filterByYear')?.value || '').trim();
    const gradeVal = (document.getElementById('filterByGrade')?.value || '').trim().toUpperCase();

    return list.filter(e => {
        const nameOk = nameVal ? (e.marineInfo?.name || '').toLowerCase().includes(nameVal) : true;
        const occasionOk = occasionVal ? (String(e.occasion || '').toLowerCase() === occasionVal) : true;
        const endDateStr = (e.marineInfo?.evaluationPeriod?.to || '').slice(0, 10);
        const yearOk = yearVal ? (endDateStr && new Date(endDateStr).getFullYear().toString() === yearVal) : true;
        const gradeOk = gradeVal
            ? Object.values(e.traitEvaluations || {}).some(t => String(t.grade || '').toUpperCase() === gradeVal)
            : true;
        return nameOk && occasionOk && yearOk && gradeOk;
    });
}

// Keep renderEvaluationsList and renderProfileGrid using getFilteredEvaluations()
function renderProfileGrid() {
    const tbody = document.querySelector('#profileGrid tbody');
    if (!tbody) return;

    // Initialize table renderer if not exists
    if (!tableRenderer) {
        tableRenderer = new OptimizedTableRenderer(tbody);
    }

    // Define evals, apply filters by current rank, then compute RVs within this subset
    const evals = [...getFilteredEvaluations()];
    const rvMap = computeRvValues(evals);
    const cumRvMap = computeCumulativeRv(evals, rvMap);
    evals.sort((a, b) => {
        const avgA = parseFloat(a.fitrepAverage || '0');
        const avgB = parseFloat(b.fitrepAverage || '0');
        const rvA = rvMap.get(a.evaluationId) ?? 0;
        const rvB = rvMap.get(b.evaluationId) ?? 0;
        const dateA = new Date(a.marineInfo?.evaluationPeriod?.to || 0).getTime();
        const dateB = new Date(b.marineInfo?.evaluationPeriod?.to || 0).getTime();
        switch (gridSort) {
            case 'AvgAsc': return avgA - avgB;
            case 'AvgDesc': return avgB - avgA;
            case 'RvAsc': return rvA - rvB;
            case 'RvDesc': return rvB - rvA;
            case 'DateAsc': return dateA - dateB;
            case 'DateDesc':
            default: return dateB - dateA;
        }
    });

    // Precompute Cum RV list for rank calculation (Excel-style)
    const cumValuesById = new Map(
        evals.map(e => [e.evaluationId, (cumRvMap.get(e.evaluationId) ?? (rvMap.get(e.evaluationId) ?? 0))])
    );
    const cumList = Array.from(cumValuesById.values());

    // Compute column count for details row spanning
    const headerRow = document.querySelector('#profileGrid thead tr');
    const colCount = headerRow ? headerRow.children.length : 20;

    // Prepare evaluation data with computed values
    const evaluationsWithData = evals.map((evaluation, idx) => {
        const traitGrades = getTraitGrades(evaluation);
        const rv = rvMap.get(evaluation.evaluationId) ?? 0;
        const cumRv = cumValuesById.get(evaluation.evaluationId) ?? rv;
        const avg = parseFloat(evaluation.fitrepAverage || '0').toFixed(2);
        const rankPos = 1 + cumList.filter(v => v > cumRv).length;
        const marineRankNorm = normalizeRankLabel(evaluation.marineInfo?.rank || '');

        return {
            ...evaluation,
            rank: rankPos,
            marineRankNorm,
            marineName: evaluation.marineInfo?.name || '-',
            occasion: capitalize(evaluation.occasion || '-'),
            endDate: (evaluation.marineInfo?.evaluationPeriod?.to || '').slice(0, 10) || '-',
            grades: traitGrades,
            average: avg,
            rv,
            cumRv
        };
    });

    // Render row function for OptimizedTableRenderer
    const renderRow = (evaluation, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-eval-id', evaluation.evaluationId);

        // Build row cells using DocumentFragment for better performance
        const fragment = document.createDocumentFragment();

        // Create cells efficiently - include data-label for mobile card view
        const cells = [
            { text: evaluation.rank, className: '', label: '#' },
            { text: evaluation.marineRankNorm || '-', className: '', label: 'Rank' },
            { text: evaluation.marineName, className: '', style: 'text-align: left;', label: 'Marine' },
            { text: evaluation.occasion, className: '', label: 'Occasion' },
            { text: evaluation.endDate, className: '', label: 'End Date' },
            { text: evaluation.grades['Performance'] || '-', className: 'grade-cell', label: 'Performance' },
            { text: evaluation.grades['Proficiency'] || '-', className: 'grade-cell', label: 'Proficiency' },
            { text: evaluation.grades['Courage'] || '-', className: 'grade-cell', label: 'Courage' },
            { text: evaluation.grades['Stress Tolerance'] || '-', className: 'grade-cell', label: 'Stress Tol.' },
            { text: evaluation.grades['Initiative'] || '-', className: 'grade-cell', label: 'Initiative' },
            { text: evaluation.grades['Leading'] || '-', className: 'grade-cell', label: 'Leading' },
            { text: evaluation.grades['Developing Others'] || '-', className: 'grade-cell', label: 'Dev. Others' },
            { text: evaluation.grades['Setting the Example'] || '-', className: 'grade-cell', label: 'Set Example' },
            { text: evaluation.grades['Well-Being/Health'] || '-', className: 'grade-cell', label: 'Well-Being' },
            { text: evaluation.grades['Communication Skills'] || '-', className: 'grade-cell', label: 'Comm Skills' },
            { text: evaluation.grades['Professional Military Education'] || '-', className: 'grade-cell', label: 'PME' },
            { text: evaluation.grades['Decision Making'] || '-', className: 'grade-cell', label: 'Decision' },
            { text: evaluation.grades['Judgement'] || '-', className: 'grade-cell', label: 'Judgement' },
            { text: evaluation.grades['Evals'], className: 'grade-cell', label: 'Eval' },
            { text: evaluation.average, className: 'avg-cell', label: 'FitRep Score' }
        ];

        cells.forEach(cellData => {
            const td = document.createElement('td');
            td.textContent = cellData.text;
            if (cellData.className) td.className = cellData.className;
            if (cellData.style) td.setAttribute('style', cellData.style);
            if (cellData.label) td.setAttribute('data-label', cellData.label);
            fragment.appendChild(td);
        });

        // RV badge cell
        const rvCell = document.createElement('td');
        rvCell.innerHTML = badgeForRv(evaluation.rv);
        rvCell.setAttribute('data-label', 'RV');
        fragment.appendChild(rvCell);

        // Cumulative RV badge cell
        const cumRvCell = document.createElement('td');
        cumRvCell.innerHTML = badgeForRv(evaluation.cumRv);
        cumRvCell.setAttribute('data-label', 'Cum RV');
        fragment.appendChild(cumRvCell);

        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';
        actionsCell.style.textAlign = 'right';
        actionsCell.setAttribute('data-label', 'Actions');

        const syncStatus = document.createElement('span');
        syncStatus.className = `sync-status ${evaluation.syncStatus || 'pending'}`;
        syncStatus.textContent = evaluation.syncStatus === 'synced' ? '✓ Synced' : '⏳ Pending';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = () => deleteEvaluation(evaluation.evaluationId);

        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.textContent = '▼';
        expandIcon.onclick = function () { toggleGridDetails(this); };

        actionsCell.appendChild(syncStatus);
        actionsCell.appendChild(deleteBtn);
        actionsCell.appendChild(expandIcon);
        fragment.appendChild(actionsCell);

        row.appendChild(fragment);

        // Details row (hidden by default)
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'grid-details-row';
        detailsRow.style.display = 'none';
        detailsRow.setAttribute('data-eval-id', evaluation.evaluationId);

        const detailsCell = document.createElement('td');
        detailsCell.setAttribute('colspan', colCount);
        detailsCell.innerHTML = renderEvaluationDetails(evaluation);
        detailsRow.appendChild(detailsCell);

        return { dataRow: row, detailsRow };
    };

    // Use RAF queue for smooth rendering
    rafQueue.add(() => {
        // Use optimized renderer - only updates changed rows
        tableRenderer.updateTable(evaluationsWithData, renderRow);

        // Update summary from the Avg column cells that were just rendered
        renderRankSummaryFromDom();
    });
}

// Helpers for grid view
function getTraitGrades(evaluation) {
    const columnAliases = {
        'Performance': ['Performance'],
        'Proficiency': ['Proficiency'],
        'Courage': ['Courage'],
        'Stress Tolerance': ['Effectiveness Under Stress', 'Stress Tolerance'],
        'Initiative': ['Initiative'],
        'Leading': ['Leading Subordinates', 'Leading'],
        'Developing Others': ['Developing Subordinates', 'Developing Others'],
        'Setting the Example': ['Setting the Example'],
        'Well-Being/Health': [
            'Ensuring Well-being of Subordinates',
            'Ensuring Well-being',
            'Well-Being/Health',
            'Well Being',
            'Well-being'
        ],
        'Communication Skills': ['Communication Skills'],
        'Professional Military Education': [
            'Professional Military Education (PME)',
            'Professional Military Education',
            'PME'
        ],
        'Decision Making': ['Decision Making Ability', 'Decision Making'],
        'Judgement': ['Judgment', 'Judgement'],
        // Section H aliases
        'Evals': [
            'Evaluations',
            'Evaluation',
            'Eval',
            'Evals',
            'Fulfillment of Evaluation Responsibilities',
            'Evaluation Responsibilities',
            'Fulfillment of Eval Responsibilities',
            'Section H'
        ]
    };

    const items = Object.values(evaluation.traitEvaluations || {});
    const map = {};
    Object.keys(columnAliases).forEach(colName => {
        const synonyms = columnAliases[colName].map(s => s.toLowerCase());
        let findPredicate;
        let defaultValue;

        if (colName === 'Evals') {
            findPredicate = t =>
                synonyms.includes((t.trait || '').trim().toLowerCase()) ||
                synonyms.includes((t.section || '').trim().toLowerCase());
            defaultValue = 'H';
        } else {
            findPredicate = t =>
                synonyms.includes((t.trait || '').trim().toLowerCase());
            defaultValue = '-';
        }

        const found = items.find(findPredicate);
        map[colName] = found ? (found.grade || defaultValue) : defaultValue;
    });
    return map;
}

function computeRvValues(evals) {
    // Excel-based RV per row: within evaluations with date <= current row date
    // Formula: RV = MAX(80, 90 + 10 * (score - avgPast) / (maxPast - avgPast)) if countPast >= 3, else 'N/A'
    const rvMap = new Map();
    const byDate = [...evals].sort((a, b) => new Date(a.completedDate || 0) - new Date(b.completedDate || 0));
    byDate.forEach((curr, idx) => {
        const currDate = new Date(curr.completedDate || 0);
        const past = byDate.filter(e => new Date(e.completedDate || 0) <= currDate);
        const scores = past.map(e => parseFloat(e.fitrepAverage || '0')).filter(s => Number.isFinite(s));
        if (scores.length < 3) {
            rvMap.set(curr.evaluationId, 'N/A');
            return;
        }
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const max = Math.max(...scores);
        const denom = max - avg;
        let rv;
        if (!Number.isFinite(denom) || denom <= 0) {
            rv = 90; // avoid divide-by-zero; all scores equal -> baseline
        } else {
            const currScore = parseFloat(curr.fitrepAverage || '0');
            rv = 90 + 10 * ((currScore - avg) / denom);
        }
        rv = Math.max(80, rv);
        rvMap.set(curr.evaluationId, Math.round(rv * 100) / 100);
    });
    return rvMap;
}

function computeCumulativeRv(evals, rvMap) {
    // Excel-based Cum RV per row: use all non-zero FitRep scores in subset
    // Formula: CumRV = if score==0 -> 80
    // else if countNonZero >= 3 -> MAX(80, 90 + 10 * (score - avgNZ) / (maxNZ - avgNZ))
    // else 'N/A'
    const cumMap = new Map();
    const scoresNZ = evals
        .map(e => parseFloat(e.fitrepAverage || '0'))
        .filter(s => Number.isFinite(s) && s > 0);
    const countNZ = scoresNZ.length;
    const avgNZ = countNZ > 0 ? (scoresNZ.reduce((a, b) => a + b, 0) / countNZ) : 0;
    const maxNZ = countNZ > 0 ? Math.max(...scoresNZ) : 0;
    const denomNZ = maxNZ - avgNZ;

    evals.forEach(e => {
        const score = parseFloat(e.fitrepAverage || '0');
        if (!Number.isFinite(score)) {
            cumMap.set(e.evaluationId, 'N/A');
            return;
        }
        if (score === 0) {
            cumMap.set(e.evaluationId, 80);
            return;
        }
        if (countNZ < 3) {
            cumMap.set(e.evaluationId, 'N/A');
            return;
        }
        let rv;
        if (!Number.isFinite(denomNZ) || denomNZ <= 0) {
            rv = 90;
        } else {
            rv = 90 + 10 * ((score - avgNZ) / denomNZ);
        }
        rv = Math.max(80, rv);
        cumMap.set(e.evaluationId, Math.round(rv * 100) / 100);
    });
    return cumMap;
}

function badgeForRv(rv) {
    if (rv === 'N/A' || !Number.isFinite(rv)) {
        return `<span class="rv-badge rv-mid">N/A</span>`;
    }
    const cls = rv >= 90 ? 'rv-high' : rv >= 75 ? 'rv-mid' : 'rv-low';
    const display = Number.isFinite(rv) ? rv.toFixed(2) : 'N/A';
    return `<span class="rv-badge ${cls}">${display}</span>`;
}

function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Add: CSV export based on current render order
function exportProfileGridCsv() {
    // Export based on current filtered subset (rank-specific)
    const evals = [...getFilteredEvaluations()];
    const rvMap = computeRvValues(evals);
    const cumRvMap = computeCumulativeRv(evals, rvMap);
    evals.sort((a, b) => {
        const avgA = parseFloat(a.fitrepAverage || '0');
        const avgB = parseFloat(b.fitrepAverage || '0');
        const rvA = rvMap.get(a.evaluationId) ?? 0;
        const rvB = rvMap.get(b.evaluationId) ?? 0;
        const dateA = new Date(a.marineInfo?.evaluationPeriod?.to || 0).getTime();
        const dateB = new Date(b.marineInfo?.evaluationPeriod?.to || 0).getTime();
        switch (gridSort) {
            case 'AvgAsc': return avgA - avgB;
            case 'AvgDesc': return avgB - avgA;
            case 'RvAsc': return rvA - rvB;
            case 'RvDesc': return rvB - rvA;
            case 'DateAsc': return dateA - dateB;
            case 'DateDesc':
            default: return dateB - dateA;
        }
    });

    const headers = [
        'Rank', 'Marine', 'Occasion', 'Ending Date',
        'Performance', 'Proficiency', 'Courage', 'Stress Tolerance', 'Initiative', 'Leading', 'Developing Others',
        'Setting the Example', 'Well-Being/Health', 'Communication Skills', 'PME', 'Decision Making', 'Judgement', 'Evals',
        'Avg', 'RV', 'Cum RV'
    ];

    const rows = evals.map((e, i) => {
        const traits = getTraitGrades(e);
        const avg = parseFloat(e.fitrepAverage || '0').toFixed(2);
        const rv = (rvMap.get(e.evaluationId) ?? 0);
        const cumRv = (cumRvMap.get(e.evaluationId) ?? rv);
        const endDate = (e.marineInfo?.evaluationPeriod?.to || '').slice(0, 10) || '-';
        return [
            i + 1,
            e.marineInfo?.name || '-',
            capitalize(e.occasion || '-'),
            endDate,
            traits['Performance'] || '-',
            traits['Proficiency'] || '-',
            traits['Courage'] || '-',
            traits['Stress Tolerance'] || '-',
            traits['Initiative'] || '-',
            traits['Leading'] || '-',
            traits['Developing Others'] || '-',
            traits['Setting the Example'] || '-',
            traits['Well-Being/Health'] || '-',
            traits['Communication Skills'] || '-',
            traits['Professional Military Education'] || '-',
            traits['Decision Making'] || '-',
            traits['Judgement'] || '-',
            traits['Evals'],
            avg,
            rv,
            cumRv
        ];
    });

    const csv = [headers, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `RS_Profile_Grid_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleGridDetails(btn) {
    const row = btn.closest('tr');
    if (!row) return;
    const detailsRow = row.nextElementSibling;
    if (!detailsRow || !detailsRow.classList.contains('grid-details-row')) return;

    const isHidden = detailsRow.style.display === 'none' || !detailsRow.style.display;
    detailsRow.style.display = isHidden ? 'table-row' : 'none';
    btn.textContent = isHidden ? 'Details ▲' : 'Details ▼';
}

function normalizeRankLabel(rank) {
    // Map common rank inputs to the desired display labels
    const map = {
        // Enlisted
        'sgt': 'SGT',
        'ssgt': 'SSGT',
        'gysgt': 'GYSGT',
        'msgt': 'MSGT',
        '1stsgt': '1STSGT',
        '1st sgt': '1STSGT',
        'mgysgt': 'MGYSGT',
        'm gy sgt': 'MGYSGT',
        'sgtmaj': 'SGTMAJ',
        'sgt maj': 'SGTMAJ',
        // Warrant
        'wo': 'WO',
        'cwo2': 'CWO2',
        'cwo3': 'CWO3',
        'cwo4': 'CWO4',
        'cwo5': 'CWO5',
        // Officer
        '2ndlt': '2NDLT',
        '2nd lt': '2NDLT',
        '1stlt': '1STLT',
        '1st lt': '1STLT',
        'capt': 'CAPT',
        'maj': 'MAJ',
        'ltcol': 'LTCOL',
        'col': 'COL'
    };
    const key = rank.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();
    return map[key] || rank.toUpperCase();
}

// Show Dashboard directly from the login card
function openProfileDashboardFromLogin() {
    const loginCard = document.getElementById('profileLoginCard');
    const dashboardCard = document.getElementById('profileDashboardCard');

    if (!loginCard || !dashboardCard) {
        console.warn('Profile cards not found in DOM.');
        return;
    }

    const stored = loadProfileFromStorage();
    if (!stored) {
        alert('No saved RS profile found. Please login first or save an evaluation.');
        return;
    }

    // Hydrate session from storage snapshot
    window.currentProfile = {
        rsName: stored.rsName,
        rsEmail: stored.rsEmail,
        rsRank: stored.rsRank,
        totalEvaluations: (stored.evaluations || []).length,
        lastUpdated: stored.lastUpdated || new Date().toISOString()
    };
    window.profileEvaluations = stored.evaluations || [];

    // Render consistently via the dashboard entrypoint
    showProfileDashboard();
}

// Auto-open Dashboard on load if a profile exists
function showProfileDashboardOnLoad() {
    const loginCard = document.getElementById('profileLoginCard');
    const dashboardCard = document.getElementById('profileDashboardCard');
    const modeCard = document.getElementById('modeSelectionCard');
    if (!loginCard || !dashboardCard) return;

    // Only auto-open if the user explicitly logged in in THIS SESSION
    const hasProfile = localStorage.getItem('has_profile') === 'true';
    const loginSource = sessionStorage.getItem('login_source'); // session-scoped, not persistent
    if (!hasProfile || loginSource !== 'form') {
        // Default to Mode Selection on initial load
        if (modeCard) { modeCard.classList.add('active'); modeCard.style.display = 'block'; }
        loginCard.classList.remove('active');
        loginCard.style.display = 'none';
        dashboardCard.classList.remove('active');
        dashboardCard.style.display = 'none';

        const setupCard = document.getElementById('setupCard');
        if (setupCard) {
            setupCard.classList.remove('active');
            setupCard.style.display = 'none';
        }
        return;
    }

    const stored = loadProfileFromStorage();
    if (!stored) return;

    window.currentProfile = {
        rsName: stored.rsName,
        rsEmail: stored.rsEmail,
        rsRank: stored.rsRank,
        totalEvaluations: (stored.evaluations || []).length,
        lastUpdated: stored.lastUpdated || new Date().toISOString()
    };
    window.profileEvaluations = stored.evaluations || [];

    showProfileDashboard();

    // Prefer showing Dashboard instead of login/setup when a profile exists
    loginCard.style.display = 'none';
    dashboardCard.style.display = 'block';

    const setupCard = document.getElementById('setupCard');
    if (setupCard) setupCard.style.display = 'none';
}

// Profile persistence helpers and GitHub stubs (added)
function generateProfileKey(name, email) {
    const n = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const e = String(email || '').toLowerCase().trim();
    return `rs:${n}|${e}`;
}

function loadProfileFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`profile:${profileKey}`) || 'null');
    } catch (err) {
        console.warn('loadProfileFromLocal failed:', err);
        return null;
    }
}

function saveProfileToLocal(profileKey, profile) {
    try {
        localStorage.setItem(`profile:${profileKey}`, JSON.stringify(profile));
    } catch (err) {
        console.warn('saveProfileToLocal failed:', err);
    }
}

function loadEvaluationsFromLocal(profileKey) {
    try {
        return JSON.parse(localStorage.getItem(`evaluations:${profileKey}`) || '[]');
    } catch (err) {
        console.warn('loadEvaluationsFromLocal failed:', err);
        return [];
    }
}

function saveEvaluationsToLocal(profileKey, evaluations) {
    try {
        localStorage.setItem(`evaluations:${profileKey}`, JSON.stringify(evaluations));
    } catch (err) {
        console.warn('saveEvaluationsToLocal failed:', err);
    }
}

// Optional GitHub integration stubs (safe no-ops)
async function fetchProfileFromGitHub(profileKey) {
    // No GitHub configured; return null to keep app fully offline-capable
    return null;
}

function mergeProfiles(local, remote) {
    if (!local) return remote || null;
    if (!remote) return local;
    return {
        ...local,
        ...remote,
        totalEvaluations: Math.max(local.totalEvaluations || 0, remote.totalEvaluations || 0),
        lastUpdated: new Date().toISOString()
    };
}

async function syncEvaluationToGitHub(evaluation) {
    try {
        const userEmail = (currentProfile && currentProfile.rsEmail) || (evaluation?.rsInfo?.email) || '';
        if (!userEmail || userEmail === 'offline@local') return false;
        const endpoint = (window.CONSTANTS?.ROUTES?.API?.EVALUATION_SAVE) || '/api/evaluation/save';
        const base = window.API_BASE_URL || location.origin;
        const url = new URL(endpoint, base).toString();
        const headers = { 'Content-Type': 'application/json' };
        try {
            const csrf = (typeof getCsrfToken === 'function') ? getCsrfToken() : (sessionStorage.getItem('fitrep_csrf_token') || '');
            if (csrf) headers['X-CSRF-Token'] = csrf;
        } catch (_) {}
        try {
            const sessTok = sessionStorage.getItem('fitrep_session_token') || '';
            if (sessTok) headers['Authorization'] = `Bearer ${sessTok}`;
        } catch (_) {}
        const resp = await fetch(url, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ evaluation, userEmail }) });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data?.ok) { evaluation.syncStatus = 'synced'; return true; }
        evaluation.syncStatus = 'error';
        console.error('Supabase sync failed:', data?.error || resp.statusText);
        return false;
    } catch (error) {
        console.error('Error during Supabase sync:', error);
        return false;
    }
}
// Inline availability feedback for Create Account username input
function initUsernameAvailabilityWatcher() {
    // No-op: availability UI removed; server will enforce uniqueness on create
}

// Live validation hint binding (username, password strength, name, rank)
function bindValidationHints() {
    const doc = document;
    const byId = (id) => doc.getElementById(id);
    const setHint = (el, text, className) => {
        if (!el) return;
        el.textContent = text || '';
        el.className = 'input-hint' + (className ? ' ' + className : '');
    };

    // Username hints (login & create)
    const loginUserInput = byId('loginEmailInput');
    const loginUserHint = byId('loginEmailHint');
    const caUserInput = byId('caEmailInput');
    const caUserHint = byId('caEmailHint');
    const updateUsername = (val, hintEl) => {
        if (!hintEl) return;
        if (isValidUsernameClient(val)) {
            setHint(hintEl, 'Valid username.', 'hint-ok');
        } else {
            setHint(hintEl, '3–50 chars; letters, numbers, . _ - only.', 'hint-warn');
        }
    };
    if (loginUserInput) {
        loginUserInput.addEventListener('input', () => updateUsername(loginUserInput.value.trim(), loginUserHint));
        updateUsername(loginUserInput.value.trim(), loginUserHint);
    }
    if (caUserInput) {
        caUserInput.addEventListener('input', () => updateUsername(caUserInput.value.trim(), caUserHint));
        updateUsername(caUserInput.value.trim(), caUserHint);
    }

    // Name and Rank hints (create)
    const caNameInput = byId('caNameInput');
    const caNameHint = byId('caNameHint');
    const caRankInput = byId('caRankInput');
    const caRankHint = byId('caRankHint');
    const updateName = (val) => {
        if (!caNameHint) return;
        const len = String(val || '').trim().length;
        if (len === 0) setHint(caNameHint, '2–100 characters.', 'hint-info');
        else if (isValidNameClient(val)) setHint(caNameHint, 'Looks good.', 'hint-ok');
        else setHint(caNameHint, '2–100 characters required.', 'hint-warn');
    };
    const updateRank = (val) => {
        if (!caRankHint) return;
        const len = String(val || '').trim().length;
        if (len === 0) setHint(caRankHint, '2–20 characters.', 'hint-info');
        else if (isValidRankClient(val)) setHint(caRankHint, 'Looks good.', 'hint-ok');
        else setHint(caRankHint, '2–20 characters required.', 'hint-warn');
    };
    if (caNameInput) {
        caNameInput.addEventListener('input', () => updateName(caNameInput.value));
        updateName(caNameInput.value);
    }
    if (caRankInput) {
        caRankInput.addEventListener('input', () => updateRank(caRankInput.value));
        updateRank(caRankInput.value);
    }

    // Password hints (login & create)
    const loginPwInput = byId('loginPasswordInput');
    const loginPwHint = byId('loginPasswordHint');
    const caPwInput = byId('caPasswordInput');
    const caPwHint = byId('caPasswordHint');
    const caPwConfirmInput = byId('caPasswordConfirmInput');
    const caPwConfirmHint = byId('caPasswordConfirmHint');

    const pwCriteria = (p) => ({
        length8: String(p || '').length >= 8,
        lower: /[a-z]/.test(String(p || '')),
        upper: /[A-Z]/.test(String(p || '')),
        digit: /\d/.test(String(p || '')),
        length12: String(p || '').length >= 12
    });
    const strengthLabel = (c) => {
        const meetsServer = c.length8 && c.lower && c.upper && c.digit;
        if (!c.length8) return { text: 'Strength: very weak', cls: 'strength-weak' };
        if (!meetsServer) return { text: 'Strength: weak', cls: 'strength-weak' };
        if (c.length12) return { text: 'Strength: strong', cls: 'strength-strong' };
        return { text: 'Strength: medium', cls: 'strength-medium' };
    };
    const updateCreatePw = (val) => {
        if (!caPwHint) return;
        const c = pwCriteria(val);
        const s = strengthLabel(c);
        const req = 'Must be 8+ chars with upper, lower, and a number.';
        setHint(caPwHint, `${s.text} • ${req}`, s.cls);
    };
    const updateLoginPw = (val) => {
        if (!loginPwHint) return;
        const c = pwCriteria(val);
        const s = strengthLabel(c);
        setHint(loginPwHint, `${s.text}`, s.cls);
    };
    if (caPwInput) {
        caPwInput.addEventListener('input', () => updateCreatePw(caPwInput.value));
        updateCreatePw(caPwInput.value);
    }
    if (loginPwInput) {
        loginPwInput.addEventListener('input', () => updateLoginPw(loginPwInput.value));
        updateLoginPw(loginPwInput.value);
    }

    const updateConfirmPw = () => {
        if (!caPwConfirmHint) return;
        const p = caPwInput ? caPwInput.value : '';
        const c = caPwConfirmInput ? caPwConfirmInput.value : '';
        if (!c) { setHint(caPwConfirmHint, 'Re-enter your password to confirm.', 'hint-info'); return; }
        if (p && c && p === c) setHint(caPwConfirmHint, 'Passwords match.', 'hint-ok');
        else setHint(caPwConfirmHint, 'Passwords do not match.', 'hint-warn');
    };
    if (caPwConfirmInput) {
        caPwConfirmInput.addEventListener('input', updateConfirmPw);
        if (caPwInput) caPwInput.addEventListener('input', updateConfirmPw);
        updateConfirmPw();
    }
}
