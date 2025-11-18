/**
 * GitHub API Service for Secure Data Persistence
 *
 * This module provides secure integration with GitHub for storing user profile
 * and evaluation data in a private repository.
 *
 * SECURITY NOTE:
 * - In production, the GitHub PAT (FITREP_DATA) should NEVER be stored in client-side code
 * - This implementation assumes one of the following secure approaches:
 *   1. Backend proxy server that handles GitHub API calls
 *   2. GitHub Actions workflow triggered by the application
 *   3. Serverless function (AWS Lambda, Netlify Functions, etc.)
 *
 * Repository: https://github.com/SemperAdmin/Fitness-Report-Evaluator-Data
 * Secret Name: FITREP_DATA
 */

// Configuration is provided by global app config (js/config.js)
// Avoid redeclaring GITHUB_CONFIG; derive data repo settings from window.GITHUB_CONFIG

/**
 * GitHub API Service Class
 *
 * Provides methods for reading/writing user data and evaluations
 * to a GitHub repository via the REST API. Uses backend endpoints
 * when available and respects CORS/credentials constraints.
 *
 * @class GitHubDataService
 */
class GitHubDataService {
    constructor() {
        this.token = null;
        this.initialized = false;
    }

    /**
     * Resolve API base URL for backend endpoints.
     * Returns `null` when not determinable (non-browser or missing config).
     *
     * @returns {string|null} Origin/base URL for backend API or null.
     */
    getApiBase() {
        try {
            if (typeof window !== 'undefined' && window.API_BASE_URL) {
                return window.API_BASE_URL;
            }
            if (typeof location !== 'undefined' && location.origin) {
                return location.origin;
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Build a backend endpoint URL and check against allowed origins.
     *
     * @param {string} path Path like `/api/user/save`.
     * @returns {null | {url: string, origin: string} | {blocked: true, url: string, origin: string}}
     */
    resolveBackendEndpoint(path) {
        const base = this.getApiBase();
        if (!base) return null;
        let endpointUrl;
        try {
            endpointUrl = new URL(path, base);
        } catch (_) {
            return null;
        }
        const origin = endpointUrl.origin;
        try {
            const allowed = Array.isArray(typeof window !== 'undefined' ? window.API_ALLOWED_ORIGINS : null)
                ? window.API_ALLOWED_ORIGINS
                : [origin];
            const isLocal = (() => { try { const h = new URL(origin).hostname.toLowerCase(); return (h === 'localhost' || h === '127.0.0.1' || h === '::1'); } catch (_) { return false; } })();
            const isAllowed = (typeof window !== 'undefined' && typeof window.isOriginAllowed === 'function')
                ? window.isOriginAllowed(origin)
                : (isLocal || allowed.includes(origin));
            if (!isAllowed) {
                return { blocked: true, url: endpointUrl.toString(), origin };
            }
        } catch (_) {
            // If allowlist resolution fails, proceed conservatively and block
            return { blocked: true, url: endpointUrl.toString(), origin };
        }
        return { url: endpointUrl.toString(), origin };
    }

    /**
     * Resolve configuration from global app config.
     * Uses `dataRepo` for content operations; falls back to workflows repo.
     *
     * @returns {{owner:string,repo:string,branch:string,apiBase:string}} Config object.
     */
    getConfig() {
        const cfg = (typeof window !== 'undefined' && window.GITHUB_CONFIG) ? window.GITHUB_CONFIG : {};
        return {
            owner: cfg.owner || 'SemperAdmin',
            repo: cfg.dataRepo || 'Fitness-Report-Evaluator-Data',
            branch: cfg.branch || 'main',
            apiBase: cfg.apiBase || 'https://api.github.com'
        };
    }

    /**
     * Initialize the service with authentication token.
     *
     * IMPORTANT: In production, this should be called with a token from:
     * - Environment variable (server-side)
     * - Secure backend API endpoint
     * - GitHub OAuth flow
     *
     * @param {string} token GitHub Personal Access Token.
     * @returns {boolean} `true` when initialized; `false` when token missing.
     */
    initialize(token) {
        if (!token) {
            console.warn('GitHubDataService: No token provided. GitHub sync will not be available.');
            return false;
        }
        this.token = token;
        this.initialized = true;
        console.log('GitHubDataService: Initialized successfully');
        return true;
    }

    /**
     * Determine fetch credentials based on origin detection.
     * Mobile browsers enforce strict CORS; use credentials for same-origin
     * and HTTPS allowlisted cross-origins.
     *
     * @private
     * @param {string} endpointUrl Full URL of the endpoint.
     * @returns {('include'|'omit')} Credentials mode.
     */
    _getFetchCredentials(endpointUrl) {
        try {
            const pageOrigin = (typeof window !== 'undefined' && window.location?.origin) || '';
            const pageProtocol = (typeof window !== 'undefined' && window.location?.protocol) || '';
            const endpointOrigin = new URL(endpointUrl).origin;
            const endpointProtocol = new URL(endpointUrl).protocol;

            // Include credentials for same-origin
            if (pageOrigin && endpointOrigin === pageOrigin) {
                return 'include';
            }

            // Allow credentials for allowlisted cross-origin endpoints ONLY in secure (HTTPS) contexts
            // Browsers block cross-site cookies on insecure HTTP; avoid 'include' to prevent CORS failures
            const allowlist = Array.isArray(typeof window !== 'undefined' ? window.API_ALLOWED_ORIGINS : null)
                ? window.API_ALLOWED_ORIGINS
                : [];
            const isSecureContext = (pageProtocol === 'https:' && endpointProtocol === 'https:');
            if (allowlist.includes(endpointOrigin) && isSecureContext) {
                return 'include';
            }

            // Default to omit to avoid unintended CORS issues
            return 'omit';
        } catch (_) {
            // Fallback for invalid URLs or non-browser environments
            // Use 'omit' as the safe default to avoid CORS issues
            return 'omit';
        }
    }

    /**
     * Construct GitHub API request options.
     * Centralizes common headers and credentials handling.
     *
     * @private
     * @param {string} [method='GET'] HTTP method.
     * @param {Object|null} [body=null] JSON body.
     * @returns {Object} Fetch options object.
     */
    _getGitHubApiRequestOptions(method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            // Mobile CORS: omit credentials for cross-origin GitHub API calls with Authorization header
            credentials: 'omit'
        };

        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        return options;
    }

    /**
     * Get authentication token from environment.
     * Demonstrates client and server approaches.
     *
     * @returns {Promise<string|null>} Token or null when unavailable.
     * @throws {Error} On unexpected failures during backend fetch.
     */
    async getTokenFromEnvironment() {
        if (typeof window !== 'undefined') {
            // Approach 0: Dev-only global config (if explicitly injected)
            if (window.GITHUB_CONFIG?.token) {
                return window.GITHUB_CONFIG.token;
            }

            // Approach 0b: Dev-only localStorage to avoid editing files
            try {
                const devToken = window.localStorage.getItem('FITREP_DEV_TOKEN');
                if (devToken) return devToken;
            } catch (_) { /* ignore */ }

            // Approach 0c: Assembled token when explicitly enabled (dev or temporary prod)
            try {
                const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                const devEnabled = !!window.DEV_ENABLE_EMBEDDED_TOKEN;
                const prodFlag = window.USE_ASSEMBLED_TOKEN === true;
                if (typeof window.assembleToken === 'function' && ( (isLocal && devEnabled) || prodFlag ) ) {
                    const assembled = window.assembleToken();
                    if (assembled) return assembled;
                }
            } catch (_) { /* ignore */ }
        }

        // Approach 1: Backend API proxy (RECOMMENDED for client-side apps)
        // In production, skip calling this endpoint unless explicitly enabled.
        if (typeof window !== 'undefined') {
            try {
                const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                const prodFlag = window.USE_ASSEMBLED_TOKEN === true;
                // If not local and no explicit prod flag, do not attempt backend token fetch
                if (!isLocal && !prodFlag) {
                    return null;
                }
                const ROUTE = (window.CONSTANTS?.ROUTES?.API?.GITHUB_TOKEN) || '/api/github-token';
                const ep = this.resolveBackendEndpoint(ROUTE);
                if (!ep || ('blocked' in ep && ep.blocked)) {
                    // No configured base or origin not allowed; skip backend token retrieval
                    // In production, tokens should be managed server-side, so this is safe to ignore
                    return null;
                }
                // Use credentials only for same-origin; omit for cross-origin to avoid CORS
                const epOrigin = (() => { try { return new URL(ep.url).origin; } catch (_) { return ''; } })();
                const pageOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                const sameOrigin = epOrigin && pageOrigin && epOrigin === pageOrigin;
                const response = await fetch(ep.url, {
                    method: 'GET',
                    credentials: sameOrigin ? 'include' : 'omit'
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.token;
                }
                // Non-OK responses are expected in production when ALLOW_DEV_TOKEN is disabled
                return null;
            } catch (error) {
                // Only warn when no other dev token is present
                console.warn('Could not fetch token from backend:', error);
            }
        }

        // Approach 2: Server-side environment variable
        if (typeof process !== 'undefined' && process.env) {
            return process.env.FITREP_DATA || null;
        }

        // Approach 3: GitHub Actions context
        if (typeof process !== 'undefined' && process.env && process.env.GITHUB_ACTIONS) {
            return process.env.FITREP_DATA || null;
        }

        return null;
    }

    /**
     * Serialize profile metadata to JSON string
     *
     * @param {Object} userData - User profile metadata
     * @returns {string} JSON string
     */
    serializeData(userData) {
        const dataToSave = {
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            profile: {
                rsName: userData.rsName,
                rsEmail: userData.rsEmail,
                rsRank: userData.rsRank
            },
            metadata: {
                exportedAt: new Date().toISOString(),
                exportedBy: userData.rsName,
                applicationVersion: '1.0'
            }
        };

        return JSON.stringify(dataToSave, null, 2);
    }

    /**
     * Encode string content to Base64
     * Required by GitHub Contents API
     * Uses modern TextEncoder API for robust Unicode support
     *
     * @param {string} content - Content to encode
     * @returns {string} Base64 encoded string
     */
    encodeToBase64(content) {
        // Browser environment with modern APIs
        if (typeof TextEncoder !== 'undefined' && typeof btoa !== 'undefined') {
            const bytes = new TextEncoder().encode(content);
            const binaryString = Array.from(bytes, byte => String.fromCodePoint(byte)).join('');
            return btoa(binaryString);
        }

        // Node.js environment
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(content, 'utf-8').toString('base64');
        }

        throw new Error('No Base64 encoding method available');
    }

    /**
     * Build YAML content for a single evaluation mirroring save-evaluation.yml schema
     * @param {Object} evaluation
     * @param {string} userEmail
     * @param {Object} createdBy - { name, email, rank }
     * @returns {string} YAML string
     */
    buildEvaluationYaml(evaluation, userEmail, createdBy = {}) {
        const prefix = (userEmail.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const now = new Date().toISOString();
        // Normalize trait evaluations to an array; UI stores them as an object map
        let traitList = [];
        try {
            if (Array.isArray(evaluation?.traitEvaluations)) {
                traitList = evaluation.traitEvaluations;
            } else if (evaluation?.traitEvaluations && typeof evaluation.traitEvaluations === 'object') {
                traitList = Object.values(evaluation.traitEvaluations);
            }
        } catch (_) { /* ignore */ }
        const doc = {
            version: '1.0',
            id: evaluation.evaluationId,
            occasion: evaluation.occasion || null,
            completedDate: evaluation.completedDate || null,
            fitrepAverage: (typeof evaluation.fitrepAverage !== 'undefined') ? evaluation.fitrepAverage : null,
            marine: {
                name: evaluation?.marineInfo?.name || null,
                rank: evaluation?.marineInfo?.rank || null,
                evaluationPeriod: evaluation?.marineInfo?.evaluationPeriod || null
            },
            rs: {
                name: evaluation?.rsInfo?.rsName || evaluation?.rsInfo?.name || createdBy.name || null,
                email: evaluation?.rsInfo?.rsEmail || evaluation?.rsInfo?.email || createdBy.email || userEmail || null,
                rank: evaluation?.rsInfo?.rsRank || evaluation?.rsInfo?.rank || createdBy.rank || null
            },
            sectionIComments: evaluation?.sectionIComments || null,
            directedComments: evaluation?.directedComments || null,
            traitEvaluations: traitList,
            createdAt: now,
            createdBy: {
                name: createdBy.name || null,
                email: createdBy.email || userEmail || null,
                rank: createdBy.rank || null
            },
            profileRef: `users/${prefix}.json`,
            source: {
                application: 'Fitness-Report-Evaluator',
                workflow: 'save-evaluation'
            }
        };

        // Minimal YAML stringifier for our known schema
        const quote = v => {
            if (v === null || v === undefined) return 'null';
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            if (typeof v === 'number') return String(v);
            return JSON.stringify(String(v));
        };
        const indent = n => '  '.repeat(n);
        const toYaml = (obj, level = 0) => {
            if (obj === null || obj === undefined) return 'null';
            if (Array.isArray(obj)) {
                if (!obj.length) return '[]';
                return obj.map(item => {
                    if (item && typeof item === 'object') {
                        return `${indent(level)}-\n${toYaml(item, level + 1)}`;
                    }
                    return `${indent(level)}- ${quote(item)}`;
                }).join('\n');
            }
            if (typeof obj === 'object') {
                return Object.entries(obj).map(([k, v]) => {
                    if (v && typeof v === 'object') {
                        return `${indent(level)}${k}:\n${toYaml(v, level + 1)}`;
                    }
                    return `${indent(level)}${k}: ${quote(v)}`;
                }).join('\n');
            }
            return quote(obj);
        };

        return `---\n${toYaml(doc)}\n`;
    }

    /**
     * Get raw file content (decoded string) from repository
     * @param {string} filePath
     * @returns {Promise<string|null>} Raw decoded content or null if not found
     */
    async getRawFileContent(filePath) {
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }
        const cfg = this.getConfig();
        const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

        const response = await fetch(url, this._getGitHubApiRequestOptions('GET'));
        if (response.status === 404) return null;
        if (!response.ok) {
            let msg = response.statusText;
            try { const e = await response.json(); msg = e.message || msg; } catch (_) {}
            const error = new Error(`GitHub API error: ${msg}`);
            error.status = response.status;
            throw error;
        }
        const data = await response.json();
        const decodedContent = this.decodeFromBase64(data.content);
        return decodedContent;
    }

    /**
     * List directory contents via GitHub Contents API
     * @param {string} dirPath - e.g., "users/john_doe/evaluations"
     * @returns {Promise<Array>} Array of content items (files)
     */
    async listDirectory(dirPath) {
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }
        const cfg = this.getConfig();
        const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${dirPath}`;
        const response = await fetch(url, this._getGitHubApiRequestOptions('GET'));
        if (response.status === 404) return [];
        if (!response.ok) {
            let msg = response.statusText;
            try { const e = await response.json(); msg = e.message || msg; } catch (_) {}
            const error = new Error(`GitHub API error: ${msg}`);
            error.status = response.status;
            throw error;
        }
        const items = await response.json();
        return Array.isArray(items) ? items : [];
    }

    /**
     * Minimal YAML parser for evaluation files we generate
     * Extracts key fields needed by the UI without a full YAML dependency
     * @param {string} yamlStr
     * @returns {Object} Evaluation-like object
     */
    parseEvaluationYamlMinimal(yamlStr) {
        const get = (re) => {
            const m = yamlStr.match(re);
            return m ? m[1] : null;
        };
        const id = get(/\bid:\s*"([^"]+)"/);
        const occasion = get(/\boccasion:\s*"([^"]+)"/);
        const completedDate = get(/\bcompletedDate:\s*"([^"]+)"/);
        const fitrepAverageStr = get(/\bfitrepAverage:\s*"?([0-9.]+)"?/);
        const fitrepAverage = fitrepAverageStr ? parseFloat(fitrepAverageStr) : null;
        const sectionIComments = get(/\bsectionIComments:\s*"([\s\S]*?)"\s*(?:\n|$)/);
        // Marine block
        const marineName = get(/\bmarine:\s*[\r\n]+\s{2}name:\s*"([^"]+)"/);
        const marineRank = get(/\bmarine:[\s\S]*?\n\s{2}rank:\s*"([^"]+)"/);
        const periodFrom = get(/\bevaluationPeriod:\s*[\r\n]+\s{4}from:\s*"([^"]+)"/);
        const periodTo = get(/\bevaluationPeriod:[\s\S]*?\n\s{4}to:\s*"([^"]+)"/);
        // RS block
        const rsName = get(/\brs:\s*[\r\n]+\s{2}name:\s*"([^"]+)"/);
        const rsEmail = get(/\brs:[\s\S]*?\n\s{2}email:\s*"([^"]+)"/);
        const rsRank = get(/\brs:[\s\S]*?\n\s{2}rank:\s*"([^"]+)"/);

        // Parse trait evaluations (minimal, regex-based)
        let traits = [];
        try {
            const afterHeader = yamlStr.split('traitEvaluations:')[1] || '';
            const itemRe = /-\s*\r?\n(?:\s{2,}section:\s*"([^"]+)")\s*\r?\n(?:\s{2,}trait:\s*"([^"]+)")\s*\r?\n(?:\s{2,}grade:\s*"([A-G])")\s*\r?\n(?:\s{2,}gradeNumber:\s*([0-9]+))\s*\r?\n(?:\s{2,}justification:\s*"([^\"]*)")/g;
            let m;
            while ((m = itemRe.exec(afterHeader)) !== null) {
                traits.push({
                    section: m[1] || '',
                    trait: m[2] || '',
                    grade: m[3] || '',
                    gradeNumber: parseInt(m[4] || '0', 10),
                    justification: m[5] || ''
                });
            }
        } catch (_) { /* ignore parse errors */ }

        const evaluation = {
            evaluationId: id || `eval-${Date.now()}`,
            occasion: occasion || null,
            completedDate: completedDate || null,
            fitrepAverage: Number.isFinite(fitrepAverage) ? String(fitrepAverage) : null,
            marineInfo: {
                name: marineName || '',
                rank: marineRank || '',
                evaluationPeriod: { from: periodFrom || '', to: periodTo || '' }
            },
            rsInfo: { name: rsName || '', email: rsEmail || '', rank: rsRank || '' },
            sectionIComments: sectionIComments || '',
            traitEvaluations: traits,
            syncStatus: 'synced'
        };
        return evaluation;
    }

    /**
     * Build a lightweight index entry from an evaluation
     * Used for evaluations/index.json listing
     * @param {Object} evaluation
     * @param {string} userEmail
     * @returns {Object}
     */
    buildIndexEntry(evaluation, userEmail) {
        const localPart = (userEmail.split('@')[0] || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const evalIdSafe = String(evaluation.evaluationId || '').replace(/[^a-zA-Z0-9\-_.]/g, '_');
        return {
            id: evaluation.evaluationId,
            occasion: evaluation.occasion || null,
            completedDate: evaluation.completedDate || null,
            fitrepAverage: evaluation.fitrepAverage || null,
            marine: {
                name: evaluation?.marineInfo?.name || '',
                rank: evaluation?.marineInfo?.rank || ''
            },
            rs: {
                name: evaluation?.rsInfo?.name || evaluation?.rsInfo?.rsName || '',
                rank: evaluation?.rsInfo?.rank || evaluation?.rsInfo?.rsRank || ''
            },
            file: `users/${localPart}/evaluations/${evalIdSafe}.yml`
        };
    }

    /**
     * Load evaluations index.json if present
     * @param {string} userEmail
     * @returns {Promise<Array|null>} Array of index entries or null if not found
     */
    async loadEvaluationIndex(userEmail) {
        try {
            const localPart = (userEmail.split('@')[0] || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
            const path = `users/${localPart}/evaluations/index.json`;
            const data = await this.getFileContent(path);
            if (!data) return null;
            const list = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data) ? data : []);
            return list;
        } catch (e) {
            return null;
        }
    }

    /**
     * Save evaluations index.json
     * @param {string} userEmail
     * @param {Array} entries
     * @returns {Promise<boolean>}
     */
    async saveEvaluationIndex(userEmail, entries) {
        // If not initialized, skip remote write (handled by server/local or IndexedDB by caller)
        if (!this.initialized || !this.token) {
            return false;
        }
        const localPart = (userEmail.split('@')[0] || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const filePath = `users/${localPart}/evaluations/index.json`;
        const content = JSON.stringify({ entries, updatedAt: new Date().toISOString() }, null, 2);
        const existingSha = await this.getFileSha(filePath);
        const message = existingSha ? `Update evaluations index for ${userEmail}` : `Create evaluations index for ${userEmail}`;
        const result = await this.createOrUpdateFile(filePath, content, message, existingSha);
        return !!result;
    }

    /**
     * Upsert a single entry into index.json
     * @param {string} userEmail
     * @param {Object} evaluation
     */
    async upsertEvaluationIndex(userEmail, evaluation) {
        try {
            const current = await this.loadEvaluationIndex(userEmail) || [];
            const entry = this.buildIndexEntry(evaluation, userEmail);
            const idx = current.findIndex(e => String(e.id) === String(entry.id));
            if (idx >= 0) {
                current[idx] = entry;
            } else {
                current.push(entry);
            }
            await this.saveEvaluationIndex(userEmail, current);
            return true;
        } catch (e) {
            console.warn('Upsert index failed:', e);
            return false;
        }
    }

    /**
     * Fetch full evaluation detail by ID (JSON or YAML)
     * @param {string} userEmail
     * @param {string} evaluationId
     * @returns {Promise<Object|null>}
     */
    async getEvaluationDetail(userEmail, evaluationId) {
        try {
            const localPart = (userEmail.split('@')[0] || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
            const evalIdSafe = String(evaluationId).replace(/[^a-zA-Z0-9\-_.]/g, '_');
            const base = `users/${localPart}/evaluations/${evalIdSafe}`;
            // Try JSON then YAML
            let data = null;
            try { data = await this.getFileContent(`${base}.json`); } catch (_) {}
            if (data && (data.evaluation || data.id)) {
                return data.evaluation ? data.evaluation : {
                    evaluationId: data.id,
                    occasion: data.occasion || null,
                    completedDate: data.completedDate || null,
                    fitrepAverage: data.fitrepAverage || null,
                    marineInfo: data.marine || {},
                    rsInfo: data.rs || {},
                    sectionIComments: data.sectionIComments || '',
                    directedComments: data.directedComments || '',
                    traitEvaluations: Array.isArray(data.traitEvaluations) ? data.traitEvaluations : []
                };
            }

            const raw = await this.getRawFileContent(`${base}.yml`);
            if (!raw) return null;
            // Minimal parse (no external YAML lib). This returns core fields.
            const ev = this.parseEvaluationYamlMinimal(raw);
            return ev;
        } catch (e) {
            console.warn('getEvaluationDetail failed:', e);
            return null;
        }
    }

    /**
     * Migrate legacy aggregate user file that contains embedded evaluations array
     * Extract each evaluation to per-file and build evaluations/index.json
     * Then rewrite aggregate user file to metadata-only
     * @param {string} userEmail
     * @returns {Promise<{migrated:number, index:boolean}>}
     */
    async migrateLegacyProfileEvaluations(userEmail) {
        try {
            const legacy = await this.loadUserData(userEmail);
            const evals = Array.isArray(legacy?.evaluations) ? legacy.evaluations : [];
            if (!evals.length) {
                return { migrated: 0, index: false };
            }

            let migrated = 0;
            const indexEntries = [];
            for (const ev of evals) {
                try {
                    await this.saveEvaluationUniqueFile(ev, userEmail);
                    migrated += 1;
                    indexEntries.push(this.buildIndexEntry(ev, userEmail));
                } catch (e) {
                    console.warn('Failed to migrate evaluation', ev?.evaluationId, e);
                }
            }

            // Save index.json
            const indexOk = await this.saveEvaluationIndex(userEmail, indexEntries);

            // Rewrite aggregate user file to metadata-only
            const userData = {
                rsName: legacy?.rsName || legacy?.profile?.rsName || '',
                rsEmail: legacy?.rsEmail || legacy?.profile?.rsEmail || userEmail,
                rsRank: legacy?.rsRank || legacy?.profile?.rsRank || ''
            };
            try { await this.saveUserData(userData); } catch (_) {}

            return { migrated, index: indexOk };
        } catch (e) {
            console.warn('Legacy migration failed:', e);
            return { migrated: 0, index: false };
        }
    }

    /**
     * Load per-user evaluation files from the data repo
     * Supports both JSON (server) and YAML (client) formats
     * @param {string} userEmail
     * @returns {Promise<Array>} Array of evaluation objects suitable for UI
     */
    /**
     * Load evaluations for a user.
     * Fetches index and detail files; normalizes YAML to JSON.
     *
     * Complexity: O(n) requests for n evaluations; O(n) space.
     *
     * @param {string} userEmail Email (used to derive file prefix).
     * @returns {Promise<Array<Object>>} List of evaluations.
     */
    async loadUserEvaluations(userEmail) {
        // Backend fallback when not initialized with a token
        if (!this.initialized || !this.token) {
            try {
                // Allow a one-time fresh fetch after a save to avoid 304/ETag cache reuse
                let forceFresh = false;
                try { if (typeof window !== 'undefined' && window.__forceFreshEvaluationsOnce) forceFresh = true; } catch (_) {}

                const LIST_ROUTE = (window.CONSTANTS?.ROUTES?.API?.EVALUATIONS_LIST) || '/api/evaluations/list';
                const endpoint = this.resolveBackendEndpoint(`${LIST_ROUTE}?email=${encodeURIComponent(userEmail)}${forceFresh ? `&t=${Date.now()}` : ''}`);
                if (!endpoint || ('blocked' in endpoint && endpoint.blocked)) {
                    console.warn('Backend endpoint blocked or unavailable for evaluation list');
                    return [];
                }

                const fetchOpts = forceFresh
                    ? { method: 'GET', cache: 'no-store', credentials: 'include', mode: 'cors' }
                    : { method: 'GET', credentials: 'include', mode: 'cors' };

                const resp = await fetch(endpoint.url, fetchOpts);
                if (!resp.ok) {
                    // Log detailed error for debugging (especially CORS failures on mobile)
                    console.error(`Failed to fetch evaluations: ${resp.status} ${resp.statusText} from ${endpoint.url}`);
                    console.error(`Credentials mode: include`);
                    try {
                        const acao = resp.headers?.get?.('access-control-allow-origin');
                        if (acao) console.error(`Response ACAO: ${acao}`);
                    } catch (_) { /* header read best-effort */ }
                    return [];
                }
                const data = await resp.json().catch(() => ({}));
                const list = Array.isArray(data?.evaluations) ? data.evaluations : [];
                // Reset the one-time fresh flag
                try { if (forceFresh && typeof window !== 'undefined') window.__forceFreshEvaluationsOnce = false; } catch (_) {}
                return list.map(ev => ({ ...ev, syncStatus: 'synced' }));
            } catch (err) {
                console.error('Backend evaluation list failed:', err);
                // Provide more context for mobile debugging
                try {
                    const pageOrigin = (typeof window !== 'undefined' && window.location?.origin) || '';
                    const endpointOrigin = new URL((typeof endpoint !== 'undefined' ? endpoint.url : 'about:blank')).origin;
                    const isCrossOrigin = pageOrigin && endpointOrigin && pageOrigin !== endpointOrigin;
                    const probableCors = (
                        isCrossOrigin && (
                            (err && err.name === 'TypeError' && /Failed to fetch|NetworkError/i.test(err.message || '')) ||
                            (err && /CORS/i.test(err.message || ''))
                        )
                    );
                    if (probableCors) {
                        console.error('Probable CORS blockage: cross-origin request with credentials from insecure context or disallowed origin');
                        if (typeof window !== 'undefined') {
                            window.__lastApiError = {
                                type: 'cors',
                                endpoint: (typeof endpoint !== 'undefined' ? endpoint.url : ''),
                                pageOrigin,
                                endpointOrigin,
                                credentials: (typeof credentials !== 'undefined' ? credentials : 'unknown')
                            };
                        }
                    } else if (typeof window !== 'undefined') {
                        window.__lastApiError = { type: 'network', message: String(err && err.message || err) };
                    }
                } catch (_) { /* best-effort classification */ }
                return [];
            }
        }

        // Token-based GitHub API path
        const localPart = (userEmail.split('@')[0] || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const dirPath = `users/${localPart}/evaluations`;
        const items = await this.listDirectory(dirPath);
        const files = items.filter(i => i.type === 'file');
        const evaluations = [];
        for (const f of files) {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            const path = f.path;
            try {
                if (ext === 'json') {
                    const data = await this.getFileContent(path);
                    if (data && data.evaluation) {
                        const ev = { ...data.evaluation, syncStatus: 'synced' };
                        evaluations.push(ev);
                    } else if (data && data.id) {
                        const ev = {
                            evaluationId: data.id,
                            occasion: data.occasion || null,
                            completedDate: data.completedDate || null,
                            fitrepAverage: data.fitrepAverage || null,
                            marineInfo: data.marine || {},
                            rsInfo: data.rs || {},
                            sectionIComments: data.sectionIComments || '',
                            traitEvaluations: Array.isArray(data.traitEvaluations) ? data.traitEvaluations : [],
                            syncStatus: 'synced'
                        };
                        evaluations.push(ev);
                    }
                } else if (ext === 'yml' || ext === 'yaml') {
                    const raw = await this.getRawFileContent(path);
                    const ev = this.parseEvaluationYamlMinimal(raw || '');
                    evaluations.push(ev);
                }
            } catch (err) {
                console.warn('Failed to parse evaluation file:', path, err);
            }
        }
        return evaluations;
    }
    /**
     * Decode Base64 string to regular string
     * Uses modern TextDecoder API for robust Unicode support
     *
     * @param {string} base64Content - Base64 encoded string
     * @returns {string} Decoded string
     */
    decodeFromBase64(base64Content) {
        // Browser environment with modern APIs
        if (typeof TextDecoder !== 'undefined' && typeof atob !== 'undefined') {
            const binaryString = atob(base64Content);
            const bytes = Uint8Array.from(binaryString, m => m.codePointAt(0));
            return new TextDecoder().decode(bytes);
        }

        // Node.js environment
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(base64Content, 'base64').toString('utf-8');
        }

        throw new Error('No Base64 decoding method available');
    }

    /**
     * Generate consistent filename based on user identifier
     * Format: [user_id].json where user_id is derived from email
     *
     * @param {string} userEmail - User's email address
     * @returns {string} Filename
     */
    generateUserFileName(userEmail) {
        // Normalize to lowercase to avoid case-sensitive path mismatches
        const localPart = userEmail.split('@')[0];
        const normalized = localPart.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        return `${normalized}.json`;
    }

    /**
     * Get existing file SHA (required for updates)
     *
     * @param {string} filePath - Path to file in repository
     * @returns {Promise<string|null>} File SHA or null if not found
     */
    async getFileSha(filePath) {
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }
        const cfg = this.getConfig();
        const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

        try {
            const response = await fetch(url, this._getGitHubApiRequestOptions('GET'));

            if (response.status === 404) {
                return null; // File doesn't exist
            }

            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error(`GitHub API error: ${errorData.message || response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            const data = await response.json();
            return data.sha;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Create or update a file in the GitHub repository
     * Uses GitHub Contents API: PUT /repos/{owner}/{repo}/contents/{path}
     *
     * @param {string} filePath - Path where file should be stored (e.g., "users/john_doe.json")
     * @param {string} content - File content (will be Base64 encoded)
     * @param {string} commitMessage - Git commit message
     * @param {string|null} sha - File SHA (required for updates, null for new files)
     * @returns {Promise<Object>} GitHub API response
     */
    async createOrUpdateFile(filePath, content, commitMessage, sha = null) {
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }

        const cfg = this.getConfig();
        const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

        // Encode content to Base64
        const base64Content = this.encodeToBase64(content);

        // Prepare request body
        const body = {
            message: commitMessage,
            content: base64Content,
            branch: this.getConfig().branch
        };

        // Always resolve current SHA to avoid stale updates
        // If the file exists, GitHub requires the latest SHA for updates
        try {
            const currentSha = await this.getFileSha(filePath);
            if (currentSha) {
                body.sha = currentSha;
            }
        } catch (e) {
            // If GET fails for reasons other than 404, surface later; proceed without sha
        }

        try {
            const response = await fetch(url, this._getGitHubApiRequestOptions('PUT', body));

            if (!response.ok) {
                // Handle stale SHA: refetch latest SHA and retry once
                let errorText = '';
                try {
                    const errorData = await response.json();
                    errorText = errorData.message || response.statusText;
                } catch (_) {
                    errorText = response.statusText;
                }

                const isShaConflict = response.status === 409 || /expected/i.test(errorText);
                if (isShaConflict) {
                    try {
                        const latestSha = await this.getFileSha(filePath);
                        const retryBody = { ...body, ...(latestSha ? { sha: latestSha } : {}) };
                        const retryResp = await fetch(url, this._getGitHubApiRequestOptions('PUT', retryBody));
                        if (!retryResp.ok) {
                            let retryMsg = '';
                            try { const d = await retryResp.json(); retryMsg = d.message || retryResp.statusText; } catch (_) { retryMsg = retryResp.statusText; }
                            const err = new Error(`GitHub API error (after retry): ${retryMsg}`);
                            err.status = retryResp.status;
                            err.response = retryResp;
                            throw err;
                        }
                        const retryResult = await retryResp.json();
                        console.log('File created/updated successfully (after retry):', retryResult.content.path);
                        return retryResult;
                    } catch (retryError) {
                        console.error('Retry after SHA conflict failed:', retryError);
                        throw retryError;
                    }
                }

                const error = new Error(`GitHub API error: ${errorText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            const result = await response.json();
            console.log('File created/updated successfully:', result.content.path);
            return result;

        } catch (error) {
            console.error('Failed to create/update file:', error);
            throw error;
        }
    }

    /**
     * Delete a file in the GitHub repository
     * Uses GitHub Contents API: DELETE /repos/{owner}/{repo}/contents/{path}
     *
     * @param {string} filePath - Path to file in repository
     * @param {string} commitMessage - Commit message for deletion
     * @returns {Promise<Object>} GitHub API response
     */
    async deleteFile(filePath, commitMessage) {
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }

        const cfg = this.getConfig();
        const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

        // Need current file SHA to delete
        const sha = await this.getFileSha(filePath);
        if (!sha) {
            // Nothing to delete
            return { ok: true, deleted: false, message: 'File not found' };
        }

        const body = {
            message: commitMessage || `Delete ${filePath}`,
            sha,
            branch: cfg.branch
        };

        try {
            const response = await fetch(url, this._getGitHubApiRequestOptions('DELETE', body));

            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error(`GitHub API error: ${errorData.message || response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            const result = await response.json();
            console.log('File deleted successfully:', filePath);
            return result;
        } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
        }
    }

    /**
     * Convenience: delete user data file by email
     * @param {string} userEmail
     * @param {string} commitMessage
     */
    async deleteUserFile(userEmail, commitMessage) {
        const fileName = this.generateUserFileName(userEmail);
        const filePath = `users/${fileName}`;
        return this.deleteFile(filePath, commitMessage);
    }

    /**
     * Get file content from repository
     *
     * @param {string} filePath - Path to file in repository
     * @returns {Promise<Object|null>} Parsed JSON content or null if not found
     */
    async getFileContent(filePath) {
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }

        const cfg = this.getConfig();
        const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

        try {
            const response = await fetch(url, this._getGitHubApiRequestOptions('GET'));

            if (response.status === 404) {
                return null; // File doesn't exist
            }

            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error(`GitHub API error: ${errorData.message || response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            const data = await response.json();
            const decodedContent = this.decodeFromBase64(data.content);
            return JSON.parse(decodedContent);

        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            console.error('Failed to get file content:', error);
            throw error;
        }
    }

    /**
     * Save user profile and evaluations to GitHub
     * Main method to persist data with retry logic for race conditions
     *
     * @param {Object} userData - User profile and evaluation data
     * @param {string} userData.rsName - Reporting Senior name
     * @param {string} userData.rsEmail - Reporting Senior email
     * @param {string} userData.rsRank - Reporting Senior rank
     * @param {Array} userData.evaluations - Array of evaluation objects
     * @returns {Promise<Object>} Result object with success status
     */
    async saveUserData(userData) {
        // Normalize input shape to support both legacy flat and nested { profile, evaluations }
        const normalized = (() => {
            try {
                if (userData && userData.profile) {
                    const p = userData.profile || {};
                    return {
                        rsName: p.rsName || userData.rsName || '',
                        rsEmail: p.rsEmail || userData.rsEmail || '',
                        rsRank: p.rsRank || userData.rsRank || '',
                        // Carry previousEmail if provided for passwordHash migration on backend
                        ...(userData.previousEmail ? { previousEmail: userData.previousEmail } : {})
                    };
                }
            } catch (_) { /* ignore */ }
            return {
                rsName: userData?.rsName || '',
                rsEmail: userData?.rsEmail || '',
                rsRank: userData?.rsRank || '',
                ...(userData?.previousEmail ? { previousEmail: userData.previousEmail } : {})
            };
        })();

        // If no token available, attempt backend save endpoint as a secure fallback
        if (!this.initialized || !this.token) {
            try {
                const SAVE_ROUTE = (window.CONSTANTS?.ROUTES?.API?.USER_SAVE) || '/api/user/save';
                const endpoint = this.resolveBackendEndpoint(SAVE_ROUTE);
                if (!endpoint) {
                    return { success: false, error: 'Configuration error', message: 'API base URL is not configured for backend fallback.' };
                }
                if ('blocked' in endpoint && endpoint.blocked) {
                    return { success: false, error: 'Untrusted origin', message: 'Backend save blocked' };
                }

                // Build headers; include CSRF token and optionally assembled token when enabled
                const headers = { 'Content-Type': 'application/json' };
                try {
                    const m = (typeof document !== 'undefined') ? document.cookie.match(/(?:^|; )fitrep_csrf=([^;]*)/) : null;
                    const csrf = m ? decodeURIComponent(m[1]) : '';
                    if (csrf) headers['X-CSRF-Token'] = csrf;
                } catch (_) {}
                let assembledToken = null;
                try {
                    if (typeof window !== 'undefined' && typeof window.assembleToken === 'function' && window.USE_ASSEMBLED_TOKEN === true) {
                        assembledToken = window.assembleToken();
                    }
                } catch (_) { /* ignore */ }
                if (assembledToken) {
                    headers['X-GitHub-Token'] = assembledToken;
                }

                const payload = assembledToken
                    ? { userData: normalized, token: assembledToken }
                    : { userData: normalized };

                // Use credentials only for same-origin; omit for cross-origin to avoid CORS issues on mobile
                const credentials = this._getFetchCredentials(endpoint.url);

                // Simple retry/backoff for transient failures
                const shouldRetryStatus = (s) => [429, 502, 503, 504].includes(Number(s));
                const doRequest = async () => {
                    return fetch(endpoint.url, {
                        method: 'POST',
                        headers,
                        credentials,
                        body: JSON.stringify(payload)
                    });
                };
                let resp = await doRequest();
                if (!resp.ok && shouldRetryStatus(resp.status)) {
                    await new Promise(r => setTimeout(r, 500));
                    resp = await doRequest();
                    if (!resp.ok && shouldRetryStatus(resp.status)) {
                        await new Promise(r => setTimeout(r, 1000));
                        resp = await doRequest();
                    }
                }
                if (resp.ok) {
                    const data = await resp.json();
                    let msg = 'Profile saved via server';
                    if (data && data.method) {
                        if (data.method === 'direct') msg = 'Profile saved via server';
                        else if (data.method === 'dispatch') msg = 'Profile dispatched to workflow';
                        else if (data.method === 'local') msg = 'Profile saved locally on server (temporary)';
                    }
                    try { if (typeof window !== 'undefined') window.__forceFreshEvaluationsOnce = true; } catch (_) {}
                    return {
                        success: true,
                        filePath: data.path || null,
                        commitSha: data.commit || null,
                        message: msg,
                        serverMethod: data.method || null
                    };
                }
                let text = '';
                try { text = await resp.text(); } catch (_) { text = ''; }
                return {
                    success: false,
                    error: text || resp.statusText,
                    status: resp.status,
                    message: `Backend save failed (${resp.status})`
                };
            } catch (err) {
                return { success: false, error: err.message, message: 'Backend save error' };
            }
        }

        try {
            // Validate input (use normalized shape)
            if (!normalized.rsEmail) {
                throw new Error('Username is required');
            }

            const fileName = this.generateUserFileName(normalized.rsEmail);
            const filePath = `users/${fileName}`;
            const maxRetries = 3;

            // Build FLAT JSON structure, preserving passwordHash and metadata if present
            let existingUser = null;
            try {
                existingUser = await this.getFileContent(filePath);
            } catch (_) { existingUser = null; }
            const now = new Date().toISOString();
            const flatBody = {
                rsEmail: normalized.rsEmail,
                rsName: normalized.rsName ?? (existingUser?.rsName || ''),
                rsRank: normalized.rsRank ?? (existingUser?.rsRank || ''),
                createdDate: existingUser?.createdDate || now,
                lastUpdated: now
            };
            if (existingUser?.passwordHash) {
                flatBody.passwordHash = existingUser.passwordHash;
            }
            const jsonContent = JSON.stringify(flatBody, null, 2);

            // Retry loop to handle race conditions (409 Conflict)
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {

                    // Check if file exists (get SHA for update)
                    const existingSha = await this.getFileSha(filePath);

                    // Create commit message
                    const commitMessage = existingSha
                        ? `Update profile via Client - ${new Date().toISOString()}`
                        : `Create profile via Client - ${new Date().toISOString()}`;

                    // Create or update file
                    const result = await this.createOrUpdateFile(
                        filePath,
                        jsonContent,
                        commitMessage,
                        existingSha
                    );

                    return {
                        success: true,
                        filePath: filePath,
                        fileName: fileName,
                        isUpdate: !!existingSha,
                        commitSha: result.commit.sha,
                        message: existingSha ? 'Profile updated successfully' : 'Profile created successfully',
                        retries: attempt
                    };

                } catch (error) {
                    // Handle 409 Conflict (file was updated between SHA fetch and write)
                    if (error.status === 409 && attempt < maxRetries - 1) {
                        console.warn(`GitHub save conflict detected (attempt ${attempt + 1}/${maxRetries}). Retrying...`);
                        // Exponential backoff: 100ms, 200ms, 400ms
                        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
                        continue; // Retry with fresh SHA
                    }
                    // Re-throw if not a 409 or retries exhausted
                    throw error;
                }
            }

        } catch (error) {
            console.error('Error saving user data to GitHub:', error);
            return {
                success: false,
                error: error.message,
                message: `Failed to save data: ${error.message}`,
                status: error.status
            };
        }
    }

    /**
     * Load user profile and evaluations from GitHub
     *
     * @param {string} userEmail - User's email address
     * @returns {Promise<Object|null>} User data or null if not found
     */
    async loadUserData(userEmail) {
        // If no token available, attempt backend load endpoint as a secure fallback
        if (!this.initialized || !this.token) {
            try {
                const LOAD_ROUTE = (window.CONSTANTS?.ROUTES?.API?.USER_LOAD) || '/api/user/load';
                const endpoint = this.resolveBackendEndpoint(LOAD_ROUTE);
                if (!endpoint || ('blocked' in endpoint && endpoint.blocked)) {
                    // API base URL is not configured or origin blocked; cannot load user data.
                    console.warn('Backend endpoint blocked or unavailable for user data load');
                    return null;
                }
                const urlObj = new URL(endpoint.url);
                urlObj.searchParams.set('email', userEmail);

                // Use credentials only for same-origin; omit for cross-origin to avoid CORS issues on mobile
                const credentials = this._getFetchCredentials(urlObj.toString());
                const resp = await fetch(urlObj.toString(), { credentials });
                if (resp.ok) {
                    const data = await resp.json();
                    return data.data || null;
                }
                console.error(`Failed to load user data: ${resp.status} ${resp.statusText}`);
                return null;
            } catch (err) {
                console.error('Backend user data load failed:', err);
                return null;
            }
        }

        try {
            // Try normalized lowercase filename first
            const normalizedFileName = this.generateUserFileName(userEmail);
            const normalizedPath = `users/${normalizedFileName}`;
            let content = await this.getFileContent(normalizedPath);

            // Backward compatibility: try legacy case-preserving filename if not found
            if (!content) {
                const legacyLocal = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
                const legacyPath = `users/${legacyLocal}.json`;
                content = await this.getFileContent(legacyPath);
            }

            return content;

        } catch (error) {
            console.error('Error loading user data from GitHub:', error);
            return null;
        }
    }

    /**
     * Save a single evaluation to GitHub
     * Appends to existing user data file
     *
     * @param {Object} evaluation - Evaluation object
     * @param {string} userEmail - User's email address
     * @returns {Promise<Object>} Result object
     */
    async saveEvaluation(evaluation, userEmail) {
        try {
            // Build minimal aggregate profile (no evaluations array)
            const userData = {
                rsName: evaluation?.rsInfo?.name || '',
                rsEmail: userEmail,
                rsRank: evaluation?.rsInfo?.rank || ''
            };

            // Save updated aggregate user file (metadata only)
            const aggregateResult = await this.saveUserData(userData);

            // Also persist a unique per-evaluation file under the member's directory
            try {
                const evalResult = await this.saveEvaluationUniqueFile(evaluation, userEmail);
                // Attempt to upsert index.json (best-effort; does not block save)
                try { await this.upsertEvaluationIndex(userEmail, evaluation); } catch (_) {}
                // Mark that the next evaluations list request should bypass cache once
                try { if (evalResult?.success && typeof window !== 'undefined') window.__forceFreshEvaluationsOnce = true; } catch (_) {}
                const bothOk = !!(aggregateResult?.success && evalResult?.success);
                const msg = bothOk
                    ? 'Evaluation saved (profile metadata and unique file) successfully'
                    : aggregateResult?.success && !evalResult?.success
                        ? 'Profile metadata saved; unique file save failed'
                        : !aggregateResult?.success && evalResult?.success
                            ? 'Unique file saved; profile metadata save failed'
                            : 'Saving evaluation failed';
                return {
                    success: bothOk,
                    message: msg,
                    aggregate: aggregateResult,
                    unique: evalResult
                };
            } catch (e) {
                // If unique-file save fails, still return aggregate result but note error
                const ok = !!aggregateResult?.success;
                const msg = ok
                    ? 'Profile metadata saved; unique file save failed'
                    : 'Saving evaluation failed';
                return {
                    success: ok,
                    message: msg,
                    aggregate: aggregateResult,
                    unique: { success: false, error: e.message }
                };
            }

        } catch (error) {
            console.error('Error saving evaluation:', error);
            return {
                success: false,
                error: error.message,
                message: `Failed to save evaluation: ${error.message}`
            };
        }
    }

    /**
     * Save a unique file for a single evaluation under the member's directory
     * Path: users/{email_normalized}/evaluations/{evaluationId}.json
     * @param {Object} evaluation
     * @param {string} userEmail
     * @returns {Promise<Object>} Result object
     */
    async saveEvaluationUniqueFile(evaluation, userEmail) {
        if (!evaluation?.evaluationId) {
            throw new Error('evaluationId is required to save unique evaluation file');
        }

        if (!userEmail) {
            throw new Error('Username is required');
        }

        // Backend fallback path when no client token is available
        if (!this.initialized || !this.token) {
            const EVAL_SAVE_ROUTE = (window.CONSTANTS?.ROUTES?.API?.EVALUATION_SAVE) || '/api/evaluation/save';
            const ep = this.resolveBackendEndpoint(EVAL_SAVE_ROUTE);
            if (!ep) {
                throw new Error('Backend API base URL is not configured');
            }
            if ('blocked' in ep && ep.blocked) {
                throw new Error('Backend evaluation save blocked by origin allowlist');
            }

            const headers = { 'Content-Type': 'application/json' };
            try {
                const m = (typeof document !== 'undefined') ? document.cookie.match(/(?:^|; )fitrep_csrf=([^;]*)/) : null;
                const csrf = m ? decodeURIComponent(m[1]) : '';
                if (csrf) headers['X-CSRF-Token'] = csrf;
            } catch (_) {}
            // Dev-only optional header token if present and explicitly allowed
            let assembledToken = null;
            try {
                if (typeof window !== 'undefined' && window.USE_ASSEMBLED_TOKEN && window.GITHUB_CONFIG?.token) {
                    assembledToken = window.GITHUB_CONFIG.token;
                }
            } catch (_) {}
            if (assembledToken) {
                headers['X-GitHub-Token'] = assembledToken;
            }

            const resp = await fetch(ep.url, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ evaluation, userEmail })
            });
            const data = await resp.json().catch(() => { throw new Error('Backend returned an invalid JSON response'); });
            if (!resp.ok || !data?.ok) {
                throw new Error(data?.error || 'Backend evaluation save failed');
            }
            return {
                success: true,
                filePath: data.path,
                commitSha: data.commit || null,
                message: data.method === 'direct' ? 'Unique evaluation saved via server' : 'Unique evaluation saved locally'
            };
        }

        const cfg = this.getConfig();

        // Normalize email local-part for directory naming and file name
        const localPart = userEmail.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const evalIdSafe = String(evaluation.evaluationId).replace(/[^a-zA-Z0-9\-_.]/g, '_');
        const dirPath = `users/${localPart}/evaluations`;
        const filePath = `${dirPath}/${evalIdSafe}.yml`;

        // Build YAML content based on workflow schema
        const createdBy = { name: evaluation?.rsInfo?.name || '', email: userEmail, rank: evaluation?.rsInfo?.rank || '' };
        const content = this.buildEvaluationYaml(evaluation, userEmail, createdBy);

        // Check if file exists to include SHA for updates
        const existingSha = await this.getFileSha(filePath);
        const commitMessage = existingSha
            ? `Update evaluation ${evaluation.evaluationId} for ${userEmail}`
            : `Create evaluation ${evaluation.evaluationId} for ${userEmail}`;

        // Create or update file
        const result = await this.createOrUpdateFile(filePath, content, commitMessage, existingSha);
        return {
            success: true,
            filePath,
            isUpdate: !!existingSha,
            commitSha: result?.commit?.sha || null,
            message: existingSha ? 'Unique evaluation updated (YAML)' : 'Unique evaluation created (YAML)'
        };
    }

    /**
     * Check if service is properly configured and authenticated
     *
     * @returns {Promise<boolean>}
     */
    async verifyConnection() {
        if (!this.initialized) {
            return false;
        }

        try {
            // Try to access the repository
            const cfg = this.getConfig();
            const url = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repo}`;
            const response = await fetch(url, this._getGitHubApiRequestOptions('GET'));

            return response.ok;

        } catch (error) {
            console.error('Failed to verify GitHub connection:', error);
            return false;
        }
    }
}

// Create singleton instance
const githubService = new GitHubDataService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GitHubDataService, githubService, GITHUB_CONFIG };
}
