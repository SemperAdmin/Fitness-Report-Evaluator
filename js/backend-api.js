// Backend API for Fitrep Evaluator
// Dispatches repository workflows for create-user and save-user-data
/**
 *
 */
class BackendAPI {
    /**
     *
     */
    constructor() {
        const cfg = (typeof window !== 'undefined' && window.GITHUB_CONFIG) ? window.GITHUB_CONFIG : {};
        this.owner = cfg.owner || 'SemperAdmin';
        // Target the repo hosting the workflows
        this.repo = cfg.repo || 'Fitness-Report-Evaluator';
        this.apiBase = cfg.apiBase || 'https://api.github.com';
    }

    /**
     *
     * @param eventType
     * @param payload
     */
    async triggerWorkflow(eventType, payload) {
        const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';

        // Get token from GITHUB_CONFIG, with dev-only fallback to assembleToken()
        let token = (typeof window !== 'undefined' && window.GITHUB_CONFIG && window.GITHUB_CONFIG.token)
            ? window.GITHUB_CONFIG.token
            : null;
        if (!token && typeof window !== 'undefined') {
            const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const devEnabled = !!window.DEV_ENABLE_EMBEDDED_TOKEN;
            if (isLocal && devEnabled && typeof window.assembleToken === 'function') {
                try { token = window.assembleToken(); } catch (_) {}
            }
        }

        if (!token) {
            throw new Error('GitHub token not available for workflow trigger');
        }

        try {
            console.log('Triggering workflow:', eventType);
            console.log('Payload size:', JSON.stringify(payload).length, 'bytes');

            // Shape client_payload to match workflow expectations
            let clientPayload;
            if (eventType === 'save-user-data') {
                clientPayload = { userData: payload };
            } else if (eventType === 'create-user') {
                // Accept either {user} or plain user object
                clientPayload = { user: payload.user ? payload.user : payload };
            } else {
                // Default wrapper for other events
                clientPayload = { data: payload, sentAt: Date.now(), source: 'Fitrep-App' };
            }

            const requestBody = {
                event_type: eventType,
                client_payload: clientPayload
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // Try to get error details from response
                let errorMessage = 'Workflow dispatch failed: ' + response.status;
                try {
                    const errorData = await response.json();
                    console.error('GitHub API Error Details:', errorData);
                    errorMessage = errorData.message || errorMessage;
                    if (errorData.errors) {
                        console.error('Validation Errors:', errorData.errors);
                        errorMessage += ' - ' + JSON.stringify(errorData.errors);
                    }
                } catch (parseError) {
                    console.error('Could not parse error response');
                }
                throw new Error(errorMessage);
            }

            console.log('✅ Workflow triggered successfully');
            return { success: true };

        } catch (error) {
            console.error('Workflow trigger error:', error);
            throw error;
        }
    }

    /**
     * Dispatch save-user-data workflow (dev/testing helper)
     * Matches server fallback event_type 'save-user-data'
     * @param {object} userData - user profile and evaluations
     */
    async saveUserDataViaWorkflow(userData) {
        return this.triggerWorkflow('save-user-data', userData);
    }

    /**
     * Dispatch create-user workflow (dev/testing helper)
     * NOTE: Server normally handles hashing; use this only when
     * workflows are designed to hash or when providing a pre-hashed value.
     * @param {object} user - { rsName, rsEmail, rsRank, passwordHash? }
     */
    async createUserViaWorkflow(user) {
        return this.triggerWorkflow('create-user', user);
    }

    // Removed EventCall RSVP and event helpers; Fitrep uses create-user/save-user-data only
}

if (typeof window !== 'undefined') {
    window.BackendAPI = new BackendAPI();
    console.log('Backend API loaded (Secure)');
}

