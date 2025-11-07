/**
 * GitHub Service Helper Functions
 *
 * Provides utility functions to reduce boilerplate and eliminate redundant
 * initialization/verification calls throughout the application.
 */

/**
 * Ensure GitHub service is initialized and ready
 * This function handles token retrieval, initialization, and verification
 * with automatic caching and deduplication.
 *
 * @returns {Promise<boolean>} - True if ready, false if not available
 */
async function ensureGitHubReady() {
    if (!githubService) {
        return false;
    }

    try {
        // Get token (cached automatically)
        const token = await githubService.getTokenFromEnvironment?.();

        if (!token) {
            console.warn('No GitHub token available');
            return false;
        }

        // Initialize (cached - won't re-initialize if already done)
        await githubService.initialize(token);

        // Verify connection (cached automatically)
        const connected = await githubService.verifyConnection?.();

        if (!connected) {
            console.warn('GitHub connection unavailable');
            return false;
        }

        return true;

    } catch (error) {
        console.warn('GitHub initialization failed:', error);
        return false;
    }
}

/**
 * Execute a GitHub operation with automatic initialization
 * Reduces boilerplate by handling initialization internally
 *
 * @param {Function} operation - Async function to execute
 * @param {*} fallback - Value to return if GitHub not available
 * @returns {Promise<*>} - Operation result or fallback
 */
async function withGitHub(operation, fallback = null) {
    try {
        const ready = await ensureGitHubReady();

        if (!ready) {
            console.warn('GitHub not ready, using fallback');
            return fallback;
        }

        return await operation();

    } catch (error) {
        console.error('GitHub operation failed:', error);
        return fallback;
    }
}

/**
 * Load user data with automatic initialization and fallback
 *
 * @param {string} userEmail - User email
 * @returns {Promise<Object|null>} - User data or null
 */
async function loadUserDataSafe(userEmail) {
    return withGitHub(
        async () => await githubService.loadUserData(userEmail),
        null
    );
}

/**
 * Load user evaluations with automatic initialization and fallback
 *
 * @param {string} userEmail - User email
 * @returns {Promise<Array>} - Evaluations array (empty if failed)
 */
async function loadUserEvaluationsSafe(userEmail) {
    return withGitHub(
        async () => await githubService.loadUserEvaluations(userEmail),
        []
    );
}

/**
 * Save user data with automatic initialization and cache invalidation
 *
 * @param {Object} userData - User data to save
 * @param {boolean} debounce - Whether to debounce the save (default: true)
 * @returns {Promise<Object|null>} - Save result or null
 */
async function saveUserDataSafe(userData, debounce = true) {
    return withGitHub(
        async () => await githubService.saveUserData(userData, debounce),
        null
    );
}

/**
 * Save evaluation with automatic initialization and cache invalidation
 *
 * @param {Object} evaluation - Evaluation to save
 * @param {string} userEmail - User email
 * @param {boolean} debounce - Whether to debounce the save (default: true)
 * @returns {Promise<Object|null>} - Save result or null
 */
async function saveEvaluationSafe(evaluation, userEmail, debounce = true) {
    return withGitHub(
        async () => await githubService.saveEvaluation(evaluation, userEmail, debounce),
        null
    );
}

/**
 * Get evaluation detail with automatic initialization and caching
 *
 * @param {string} userEmail - User email
 * @param {string} evaluationId - Evaluation ID
 * @returns {Promise<Object|null>} - Evaluation detail or null
 */
async function getEvaluationDetailSafe(userEmail, evaluationId) {
    return withGitHub(
        async () => await githubService.getEvaluationDetail(userEmail, evaluationId),
        null
    );
}

/**
 * Batch load multiple evaluations efficiently
 * Uses Promise.all for parallel loading with caching
 *
 * @param {string} userEmail - User email
 * @param {Array<string>} evaluationIds - Array of evaluation IDs
 * @returns {Promise<Array>} - Array of evaluation details (nulls for failures)
 */
async function batchLoadEvaluations(userEmail, evaluationIds) {
    const ready = await ensureGitHubReady();

    if (!ready) {
        return evaluationIds.map(() => null);
    }

    try {
        // Load all evaluations in parallel (caching/deduplication handles efficiency)
        const promises = evaluationIds.map(id =>
            githubService.getEvaluationDetail(userEmail, id)
                .catch(error => {
                    console.warn(`Failed to load evaluation ${id}:`, error);
                    return null;
                })
        );

        return await Promise.all(promises);

    } catch (error) {
        console.error('Batch load failed:', error);
        return evaluationIds.map(() => null);
    }
}

/**
 * Prefetch user data for improved perceived performance
 * Loads common data in the background
 *
 * @param {string} userEmail - User email
 */
async function prefetchUserData(userEmail) {
    const ready = await ensureGitHubReady();

    if (!ready) {
        return;
    }

    try {
        // Use the cached service's prefetch method if available
        if (typeof githubService.prefetchUserData === 'function') {
            await githubService.prefetchUserData(userEmail);
        } else {
            // Fallback: manually prefetch common data
            await Promise.all([
                githubService.loadUserData(userEmail).catch(() => null),
                githubService.loadUserEvaluations(userEmail).catch(() => null),
                githubService.loadEvaluationIndex?.(userEmail).catch(() => null)
            ]);
        }
    } catch (error) {
        console.warn('Prefetch failed:', error);
    }
}

/**
 * Invalidate cache for a user (useful after updates)
 *
 * @param {string} userEmail - User email
 */
function invalidateUserCache(userEmail) {
    if (typeof githubService.invalidateUserCache === 'function') {
        githubService.invalidateUserCache(userEmail);
    }
}

/**
 * Force refresh user data (bypasses cache)
 *
 * @param {string} userEmail - User email
 * @returns {Promise<Array>} - Fresh evaluations array
 */
async function forceRefreshUserData(userEmail) {
    if (typeof githubService.forceRefreshUserEvaluations === 'function') {
        return await githubService.forceRefreshUserEvaluations(userEmail);
    }

    // Fallback: invalidate and reload
    invalidateUserCache(userEmail);
    return await loadUserEvaluationsSafe(userEmail);
}

/**
 * Get network efficiency statistics
 * Useful for debugging and monitoring
 *
 * @returns {Object} - Statistics object
 */
function getNetworkStats() {
    if (typeof githubService.getCacheStats === 'function') {
        return githubService.getCacheStats();
    }

    if (typeof window.networkEfficiency !== 'undefined') {
        return window.networkEfficiency.getStats();
    }

    return null;
}

/**
 * Log network statistics to console (development only)
 */
function logNetworkStats() {
    if (window.location.hostname !== 'localhost') {
        return;
    }

    const stats = getNetworkStats();
    if (stats) {
        console.group('Network Efficiency Statistics');
        console.table(stats.metrics);
        console.log('Cache:', stats.cache);
        console.log('Deduplication:', stats.deduplication);
        console.groupEnd();
    }
}

// Expose helpers globally
if (typeof window !== 'undefined') {
    window.GitHubHelpers = {
        ensureGitHubReady,
        withGitHub,
        loadUserDataSafe,
        loadUserEvaluationsSafe,
        saveUserDataSafe,
        saveEvaluationSafe,
        getEvaluationDetailSafe,
        batchLoadEvaluations,
        prefetchUserData,
        invalidateUserCache,
        forceRefreshUserData,
        getNetworkStats,
        logNetworkStats
    };

    // Log stats periodically in development
    if (window.location.hostname === 'localhost') {
        setInterval(() => {
            const stats = getNetworkStats();
            if (stats && stats.metrics.totalRequests > 0) {
                console.log('[Network Stats]',
                    `Total: ${stats.metrics.totalRequests},`,
                    `Cached: ${stats.metrics.cachedRequests},`,
                    `Hit Rate: ${stats.cache.hitRate}`
                );
            }
        }, 60000); // Every 60 seconds
    }
}
