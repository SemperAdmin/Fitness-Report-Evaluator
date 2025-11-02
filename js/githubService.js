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
 */
class GitHubDataService {
    constructor() {
        this.token = null;
        this.initialized = false;
    }

    /**
     * Resolve configuration from global app config
     * Uses dataRepo for contents operations; falls back to workflows repo
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
     * Initialize the service with authentication token
     *
     * IMPORTANT: In production, this should be called with a token from:
     * - Environment variable (server-side)
     * - Secure backend API endpoint
     * - GitHub OAuth flow
     *
     * @param {string} token - GitHub Personal Access Token
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
     * Get authentication token from environment
     *
     * This is a placeholder that demonstrates different approaches:
     * - Client-side: Would need to call a backend API
     * - Server-side: Would read from process.env.FITREP_DATA
     * - GitHub Actions: Available as secrets.FITREP_DATA
     *
     * @returns {Promise<string|null>}
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
        if (typeof window !== 'undefined') {
            try {
                const response = await fetch('/api/github-token', {
                    method: 'GET',
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.token;
                }
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
     * Serialize evaluation data to JSON string
     *
     * @param {Object} userData - User profile and evaluation data
     * @returns {string} JSON string
     */
    serializeData(userData) {
        const dataToSave = {
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            profile: {
                rsName: userData.rsName,
                rsEmail: userData.rsEmail,
                rsRank: userData.rsRank,
                totalEvaluations: userData.evaluations?.length || 0
            },
            evaluations: userData.evaluations || [],
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
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

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
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

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
                        const retryResp = await fetch(url, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${this.token}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(retryBody)
                        });
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
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

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
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

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
        // If no token available, attempt backend save endpoint as a secure fallback
        if (!this.initialized || !this.token) {
            try {
                const resp = await fetch('/api/user/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userData })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    return {
                        success: true,
                        filePath: data.path || null,
                        commitSha: data.commit || null,
                        message: data.method === 'direct' ? 'Profile saved via server' : 'Profile dispatched to workflow'
                    };
                }
                const text = await resp.text();
                return { success: false, error: text, message: 'Backend save failed' };
            } catch (err) {
                return { success: false, error: err.message, message: 'Backend save error' };
            }
        }

        try {
            // Validate input
            if (!userData.rsEmail) {
                throw new Error('User email is required');
            }

            const fileName = this.generateUserFileName(userData.rsEmail);
            const filePath = `users/${fileName}`;
            const maxRetries = 3;

            // Serialize data to JSON
            const jsonContent = this.serializeData(userData);

            // Retry loop to handle race conditions (409 Conflict)
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {

                    // Check if file exists (get SHA for update)
                    const existingSha = await this.getFileSha(filePath);

                    // Create commit message
                    const commitMessage = existingSha
                        ? `Update profile for ${userData.rsName} - ${new Date().toISOString()}`
                        : `Create profile for ${userData.rsName} - ${new Date().toISOString()}`;

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
                const resp = await fetch(`/api/user/load?email=${encodeURIComponent(userEmail)}`);
                if (resp.ok) {
                    const data = await resp.json();
                    return data.data || null;
                }
                return null;
            } catch (_) {
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
            // Load existing data
            let userData = await this.loadUserData(userEmail);

            if (!userData) {
                // Create new user data structure
                userData = {
                    rsName: evaluation.rsInfo.name,
                    rsEmail: userEmail,
                    rsRank: evaluation.rsInfo.rank,
                    evaluations: []
                };
            }

            // Add or update evaluation
            const existingIndex = userData.evaluations.findIndex(
                e => e.evaluationId === evaluation.evaluationId
            );

            if (existingIndex >= 0) {
                userData.evaluations[existingIndex] = evaluation;
            } else {
                userData.evaluations.push(evaluation);
            }

            // Save updated aggregate user file
            const aggregateResult = await this.saveUserData(userData);

            // Also persist a unique per-evaluation file under the member's directory
            try {
                const evalResult = await this.saveEvaluationUniqueFile(evaluation, userEmail);
                return {
                    success: !!(aggregateResult?.success && evalResult?.success),
                    message: 'Evaluation saved (aggregate and unique file) successfully',
                    aggregate: aggregateResult,
                    unique: evalResult
                };
            } catch (e) {
                // If unique-file save fails, still return aggregate result but note error
                return {
                    success: !!aggregateResult?.success,
                    message: 'Evaluation saved to aggregate file; unique file save failed',
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
        if (!this.initialized) {
            throw new Error('GitHubDataService not initialized. Call initialize() first.');
        }

        if (!evaluation?.evaluationId) {
            throw new Error('evaluationId is required to save unique evaluation file');
        }

        if (!userEmail) {
            throw new Error('User email is required');
        }

        const cfg = this.getConfig();

        // Normalize email local-part for directory naming
        const localPart = userEmail.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const evalIdSafe = String(evaluation.evaluationId).replace(/[^a-zA-Z0-9\-_]/g, '_');
        const dirPath = `users/${localPart}/evaluations`;
        const filePath = `${dirPath}/${evalIdSafe}.json`;

        // Build content: store the evaluation object with minimal metadata
        const content = this.serializeData({
            version: '1.0',
            savedAt: new Date().toISOString(),
            rsEmail: userEmail,
            rsName: evaluation?.rsInfo?.name || '',
            rsRank: evaluation?.rsInfo?.rank || '',
            evaluation
        });

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
            message: existingSha ? 'Unique evaluation updated' : 'Unique evaluation created'
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
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

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
