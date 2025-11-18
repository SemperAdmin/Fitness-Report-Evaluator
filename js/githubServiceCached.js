/**
 * Cached GitHub Service Wrapper
 *
 * Wraps GitHubDataService with intelligent caching, deduplication, and debouncing
 * to reduce redundant API calls and improve performance.
 *
 * Key Features:
 * - Request caching with TTL
 * - Automatic deduplication of in-flight requests
 * - Debouncing for user-triggered operations
 * - Smart cache invalidation
 * - Reduced API rate limit usage
 */

class CachedGitHubService {
    constructor(githubService) {
        this.service = githubService;
        this.network = window.networkEfficiency;

        // Cache TTL configurations (in milliseconds)
        this.ttl = {
            token: 30 * 60 * 1000,      // 30 minutes - token rarely changes
            connection: 2 * 60 * 1000,   // 2 minutes - connection status
            userEvaluations: 5 * 60 * 1000, // 5 minutes - evaluation list
            evaluationDetail: 10 * 60 * 1000, // 10 minutes - individual evaluation
            userData: 5 * 60 * 1000,     // 5 minutes - user profile data
            fileSha: 1 * 60 * 1000,      // 1 minute - file SHA
            fileContent: 5 * 60 * 1000   // 5 minutes - file content
        };

        // Debounce delays (in milliseconds)
        this.debounceDelay = {
            save: 1000,                  // 1 second for save operations
            search: 300,                 // 300ms for search/filter
            validation: 500              // 500ms for validation checks
        };

        // Track initialization state
        this.initializationPromise = null;
        this.tokenCache = null;
    }

    /**
     * Initialize service with caching
     * Ensures only one initialization happens even if called multiple times
     */
    async initialize(token) {
        // If already initialized with this token, return immediately
        if (this.service.initialized && this.tokenCache === token) {
            return true;
        }

        // If initialization is in progress, wait for it
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Start new initialization
        this.initializationPromise = (async () => {
            try {
                this.service.initialize(token);
                this.tokenCache = token;
                return true;
            } finally {
                this.initializationPromise = null;
            }
        })();

        return this.initializationPromise;
    }

    /**
     * Get token from environment with caching
     */
    async getTokenFromEnvironment() {
        return this.network.request({
            method: 'GET',
            url: 'token://environment',
            requestFn: async () => {
                return await this.service.getTokenFromEnvironment?.();
            },
            ttl: this.ttl.token,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Verify connection with caching
     */
    async verifyConnection() {
        return this.network.request({
            method: 'GET',
            url: 'github://verify-connection',
            requestFn: async () => {
                return await this.service.verifyConnection?.();
            },
            ttl: this.ttl.connection,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Load user evaluations with caching
     */
    async loadUserEvaluations(userEmail) {
        return this.network.request({
            method: 'GET',
            url: `github://evaluations/${userEmail}`,
            requestFn: async () => {
                return await this.service.loadUserEvaluations(userEmail);
            },
            ttl: this.ttl.userEvaluations,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Load user data with caching
     */
    async loadUserData(userEmail) {
        return this.network.request({
            method: 'GET',
            url: `github://user-data/${userEmail}`,
            requestFn: async () => {
                return await this.service.loadUserData(userEmail);
            },
            ttl: this.ttl.userData,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Get evaluation detail with caching
     */
    async getEvaluationDetail(userEmail, evaluationId) {
        return this.network.request({
            method: 'GET',
            url: `github://evaluation/${userEmail}/${evaluationId}`,
            requestFn: async () => {
                return await this.service.getEvaluationDetail(userEmail, evaluationId);
            },
            ttl: this.ttl.evaluationDetail,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Load evaluation index with caching
     */
    async loadEvaluationIndex(userEmail) {
        return this.network.request({
            method: 'GET',
            url: `github://evaluation-index/${userEmail}`,
            requestFn: async () => {
                return await this.service.loadEvaluationIndex(userEmail);
            },
            ttl: this.ttl.userEvaluations,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Get file SHA with caching
     */
    async getFileSha(filePath) {
        return this.network.request({
            method: 'GET',
            url: `github://file-sha/${filePath}`,
            requestFn: async () => {
                return await this.service.getFileSha(filePath);
            },
            ttl: this.ttl.fileSha,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Get file content with caching
     */
    async getFileContent(filePath) {
        return this.network.request({
            method: 'GET',
            url: `github://file-content/${filePath}`,
            requestFn: async () => {
                return await this.service.getFileContent(filePath);
            },
            ttl: this.ttl.fileContent,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Get raw file content with caching
     */
    async getRawFileContent(filePath) {
        return this.network.request({
            method: 'GET',
            url: `github://raw-content/${filePath}`,
            requestFn: async () => {
                return await this.service.getRawFileContent(filePath);
            },
            ttl: this.ttl.fileContent,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * List directory with caching
     */
    async listDirectory(dirPath) {
        return this.network.request({
            method: 'GET',
            url: `github://list/${dirPath}`,
            requestFn: async () => {
                return await this.service.listDirectory(dirPath);
            },
            ttl: this.ttl.fileContent,
            cache: true,
            deduplicate: true
        });
    }

    /**
     * Save user data with debouncing and cache invalidation
     */
    async saveUserData(userData, debounce = true) {
        const userEmail = userData.email;

        // Invalidate related caches
        this.invalidateUserCache(userEmail);

        const saveFn = async () => {
            return await this.service.saveUserData(userData);
        };

        if (debounce) {
            return this.network.debouncedRequest(
                `save-user-${userEmail}`,
                saveFn,
                this.debounceDelay.save
            );
        }

        return saveFn();
    }

    /**
     * Save evaluation with debouncing and cache invalidation
     */
    async saveEvaluation(evaluation, userEmail, debounce = true) {
        // Invalidate related caches
        this.invalidateUserCache(userEmail);
        if (evaluation.id) {
            this.invalidateEvaluationCache(userEmail, evaluation.id);
        }

        const saveFn = async () => {
            return await this.service.saveEvaluation(evaluation, userEmail);
        };

        if (debounce) {
            return this.network.debouncedRequest(
                `save-eval-${userEmail}-${evaluation.id}`,
                saveFn,
                this.debounceDelay.save
            );
        }

        return saveFn();
    }

    /**
     * Save evaluation to unique file with debouncing and cache invalidation
     */
    async saveEvaluationUniqueFile(evaluation, userEmail, debounce = true) {
        // Invalidate related caches
        this.invalidateUserCache(userEmail);
        if (evaluation.id) {
            this.invalidateEvaluationCache(userEmail, evaluation.id);
        }

        const saveFn = async () => {
            return await this.service.saveEvaluationUniqueFile(evaluation, userEmail);
        };

        if (debounce) {
            return this.network.debouncedRequest(
                `save-eval-file-${userEmail}-${evaluation.id}`,
                saveFn,
                this.debounceDelay.save
            );
        }

        return saveFn();
    }

    /**
     * Save evaluation index with cache invalidation
     */
    async saveEvaluationIndex(userEmail, entries) {
        // Invalidate related caches
        this.network.invalidateCache(`github://evaluation-index/${userEmail}`);
        this.network.invalidateCache(`github://evaluations/${userEmail}`);

        return await this.service.saveEvaluationIndex(userEmail, entries);
    }

    /**
     * Upsert evaluation index with cache invalidation
     */
    async upsertEvaluationIndex(userEmail, evaluation) {
        // Invalidate related caches
        this.network.invalidateCache(`github://evaluation-index/${userEmail}`);
        this.network.invalidateCache(`github://evaluations/${userEmail}`);

        return await this.service.upsertEvaluationIndex(userEmail, evaluation);
    }

    /**
     * Create or update file with cache invalidation
     */
    async createOrUpdateFile(filePath, content, commitMessage, sha = null) {
        // Invalidate file caches
        this.network.invalidateCache(`github://file-sha/${filePath}`);
        this.network.invalidateCache(`github://file-content/${filePath}`);
        this.network.invalidateCache(`github://raw-content/${filePath}`);

        return await this.service.createOrUpdateFile(filePath, content, commitMessage, sha);
    }

    /**
     * Delete file with cache invalidation
     */
    async deleteFile(filePath, commitMessage) {
        // Invalidate file caches
        this.network.invalidateCache(`github://file-sha/${filePath}`);
        this.network.invalidateCache(`github://file-content/${filePath}`);
        this.network.invalidateCache(`github://raw-content/${filePath}`);

        return await this.service.deleteFile(filePath, commitMessage);
    }

    /**
     * Delete user file with cache invalidation
     */
    async deleteUserFile(userEmail, commitMessage) {
        // Invalidate all user-related caches
        this.invalidateUserCache(userEmail);

        return await this.service.deleteUserFile(userEmail, commitMessage);
    }

    /**
     * Migrate legacy profile evaluations (no caching)
     */
    async migrateLegacyProfileEvaluations(userEmail) {
        // Invalidate caches after migration
        this.invalidateUserCache(userEmail);

        return await this.service.migrateLegacyProfileEvaluations?.(userEmail);
    }

    /**
     * Build index entry (no network call, pass through)
     */
    buildIndexEntry(evaluation, userEmail) {
        return this.service.buildIndexEntry?.(evaluation, userEmail);
    }

    /**
     * Invalidate all caches for a user
     */
    invalidateUserCache(userEmail) {
        this.network.invalidateCache(`github://user-data/${userEmail}`);
        this.network.invalidateCache(`github://evaluations/${userEmail}`);
        this.network.invalidateCache(`github://evaluation-index/${userEmail}`);
        this.network.invalidateCache(`github://evaluation/${userEmail}/`);
    }

    /**
     * Invalidate cache for specific evaluation
     */
    invalidateEvaluationCache(userEmail, evaluationId) {
        this.network.invalidateCache(`github://evaluation/${userEmail}/${evaluationId}`);
    }

    /**
     * Invalidate all caches
     */
    invalidateAllCaches() {
        this.network.clearCache();
    }

    /**
     * Force refresh - clear cache and fetch fresh data
     */
    async forceRefreshUserEvaluations(userEmail) {
        this.invalidateUserCache(userEmail);
        return await this.loadUserEvaluations(userEmail);
    }

    /**
     * Get caching statistics
     */
    getCacheStats() {
        return this.network.getStats();
    }

    /**
     * Prefetch common data
     */
    async prefetchUserData(userEmail) {
        try {
            // Fire off prefetch requests in parallel
            await Promise.all([
                this.loadUserData(userEmail).catch(() => null),
                this.loadUserEvaluations(userEmail).catch(() => null),
                this.loadEvaluationIndex(userEmail).catch(() => null)
            ]);
        } catch (error) {
            console.warn('Prefetch failed:', error);
        }
    }
}

// Create cached wrapper around existing githubService
if (typeof githubService !== 'undefined') {
    window.cachedGithubService = new CachedGitHubService(githubService);

    // Make it available as default
    // Keep original as githubService for backward compatibility
    window.githubServiceOriginal = window.githubService;
    window.githubService = window.cachedGithubService;

    console.info('[Network Cache] GitHub Service wrapped with caching layer');
}

// Expose for debugging
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.debugGithubCache = () => {
        if (window.cachedGithubService) {
            const stats = window.cachedGithubService.getCacheStats();
            console.group('GitHub Service Cache Stats');
            console.table(stats.metrics);
            console.log('Cache:', stats.cache);
            console.log('Deduplication:', stats.deduplication);
            console.groupEnd();
            return stats;
        }
        return null;
    };
}
