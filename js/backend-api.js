// Backend API for Fitrep Evaluator
// Dispatches repository workflows for create-user and save-user-data
class BackendAPI {
    constructor() {
        const cfg = (typeof window !== 'undefined' && window.GITHUB_CONFIG) ? window.GITHUB_CONFIG : {};
        this.owner = cfg.owner || 'SemperAdmin';
        // Target the repo hosting the workflows
        this.repo = cfg.repo || 'Fitness-Report-Evaluator';
        this.apiBase = cfg.apiBase || 'https://api.github.com';
    }

    async triggerWorkflow(eventType, payload) {
        const url = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/dispatches';

        // Client-side PAT usage disabled

        throw new Error('Client-side workflow dispatch disabled');
    }

    /**
     * Dispatch save-user-data workflow (dev/testing helper)
     * Matches server fallback event_type 'save-user-data'
     * @param {Object} userData - user profile and evaluations
     */
    async saveUserDataViaWorkflow(userData) {
        return this.triggerWorkflow('save-user-data', userData);
    }

    /**
     * Dispatch create-user workflow (dev/testing helper)
     * NOTE: Server normally handles hashing; use this only when
     * workflows are designed to hash or when providing a pre-hashed value.
     * @param {Object} user - { rsName, rsEmail, rsRank, passwordHash? }
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
