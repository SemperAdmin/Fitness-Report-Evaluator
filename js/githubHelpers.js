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
 * @returns {Promise<object | null>} - User data or null
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
 * @param {object} userData - User data to save
 * @param {boolean} debounce - Whether to debounce the save (default: true)
 * @returns {Promise<object | null>} - Save result or null
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
 * @param {object} evaluation - Evaluation to save
 * @param {string} userEmail - User email
 * @param {boolean} debounce - Whether to debounce the save (default: true)
 * @returns {Promise<object | null>} - Save result or null
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
 * @returns {Promise<object | null>} - Evaluation detail or null
 */
async function getEvaluationDetailSafe(userEmail, evaluationId) {
    return withGitHub(
        async () => await githubService.getEvaluationDetail(userEmail, evaluationId),
        null
    );
}

/**
 * Execute promises with concurrency limit to avoid overwhelming browser/API
 *
 * @param {Array} items - Array of items to process
 * @param {Function} fn - Async function to execute for each item
 * @param {number} concurrency - Maximum concurrent executions (default: 5)
 * @returns {Promise<Array>} - Array of results in original order
 */
async function batchWithConcurrency(items, fn, concurrency = 5) {
    const results = new Array(items.length);
    let index = 0;

    // Worker function that processes items sequentially
    /**
     *
     */
    async function worker() {
        while (index < items.length) {
            const currentIndex = index++;
            try {
                results[currentIndex] = await fn(items[currentIndex], currentIndex);
            } catch (error) {
                results[currentIndex] = null;
            }
        }
    }

    // Create concurrency-limited workers
    const workers = Array(Math.min(concurrency, items.length))
        .fill(null)
        .map(() => worker());

    await Promise.all(workers);
    return results;
}

/**
 * Batch load multiple evaluations efficiently
 * Uses concurrency-limited parallel loading with caching
 *
 * @param {string} userEmail - User email
 * @param {Array<string>} evaluationIds - Array of evaluation IDs
 * @param {number} concurrency - Maximum concurrent requests (default: 5)
 * @returns {Promise<Array>} - Array of evaluation details (nulls for failures)
 */
async function batchLoadEvaluations(userEmail, evaluationIds, concurrency = 5) {
    const ready = await ensureGitHubReady();

    if (!ready) {
        return evaluationIds.map(() => null);
    }

    try {
        // Load evaluations with concurrency limit to avoid overwhelming browser/API
        return await batchWithConcurrency(
            evaluationIds,
            async (id) => {
                try {
                    return await githubService.getEvaluationDetail(userEmail, id);
                } catch (error) {
                    console.warn(`Failed to load evaluation ${id}:`, error);
                    return null;
                }
            },
            concurrency
        );

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
 * @returns {object} - Statistics object
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
        const managedSetInterval = (typeof globalLifecycle !== 'undefined' && globalLifecycle.setInterval)
            ? globalLifecycle.setInterval.bind(globalLifecycle)
            : setInterval;
        managedSetInterval(() => {
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
