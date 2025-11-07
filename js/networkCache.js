/**
 * Network Efficiency System
 *
 * Provides request caching, debouncing, and deduplication to:
 * - Reduce redundant GitHub API calls
 * - Improve performance
 * - Minimize API rate limit usage
 * - Enhance offline experience
 */

/**
 * Request Cache with TTL and invalidation
 */
class RequestCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
        this.cache = new Map();
        this.accessOrder = [];
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    /**
     * Generate cache key from request parameters
     */
    generateKey(method, url, body = null) {
        const parts = [method, url];
        if (body) {
            parts.push(JSON.stringify(body));
        }
        return parts.join('::');
    }

    /**
     * Get cached response if valid
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        // Update access order (LRU)
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);

        this.stats.hits++;
        return entry.response;
    }

    /**
     * Set cached response
     */
    set(key, response, ttl = null) {
        const expiresAt = Date.now() + (ttl || this.defaultTTL);

        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.accessOrder.shift();
            if (oldestKey) {
                this.cache.delete(oldestKey);
                this.stats.evictions++;
            }
        }

        this.cache.set(key, {
            response: response,
            expiresAt: expiresAt,
            cachedAt: Date.now()
        });

        // Update access order
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }

    /**
     * Invalidate cache entries matching pattern
     */
    invalidate(pattern) {
        let count = 0;
        const regex = new RegExp(pattern);

        for (const [key, _] of this.cache.entries()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                const index = this.accessOrder.indexOf(key);
                if (index > -1) {
                    this.accessOrder.splice(index, 1);
                }
                count++;
            }
        }

        return count;
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0
            ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
            : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * Prune expired entries
     */
    prune() {
        const now = Date.now();
        let pruned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                const index = this.accessOrder.indexOf(key);
                if (index > -1) {
                    this.accessOrder.splice(index, 1);
                }
                pruned++;
            }
        }

        return pruned;
    }
}

/**
 * Request Deduplicator - prevents duplicate in-flight requests
 */
class RequestDeduplicator {
    constructor() {
        this.inFlight = new Map();
        this.stats = {
            deduplicated: 0,
            unique: 0
        };
    }

    /**
     * Execute request with deduplication
     * If same request is already in-flight, wait for it instead of making duplicate
     */
    async execute(key, requestFn) {
        // Check if request already in-flight
        if (this.inFlight.has(key)) {
            this.stats.deduplicated++;
            return this.inFlight.get(key);
        }

        // Execute new request
        this.stats.unique++;
        const promise = requestFn()
            .finally(() => {
                // Remove from in-flight when done
                this.inFlight.delete(key);
            });

        this.inFlight.set(key, promise);
        return promise;
    }

    /**
     * Get deduplication statistics
     */
    getStats() {
        const total = this.stats.unique + this.stats.deduplicated;
        const dedupeRate = total > 0
            ? ((this.stats.deduplicated / total) * 100).toFixed(2)
            : 0;

        return {
            inFlight: this.inFlight.size,
            unique: this.stats.unique,
            deduplicated: this.stats.deduplicated,
            deduplicationRate: `${dedupeRate}%`
        };
    }
}

/**
 * Debouncer - delays execution until no more calls
 */
class Debouncer {
    constructor() {
        this.timers = new Map();
    }

    /**
     * Debounce a function call
     * @param {string} key - Unique identifier for this debounce
     * @param {Function} fn - Function to execute
     * @param {number} delay - Delay in milliseconds
     */
    debounce(key, fn, delay = 300) {
        // Clear existing timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.timers.delete(key);
            fn();
        }, delay);

        this.timers.set(key, timer);
    }

    /**
     * Cancel debounced function
     */
    cancel(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
    }

    /**
     * Cancel all debounced functions
     */
    cancelAll() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
}

/**
 * Throttler - limits execution to once per time period
 */
class Throttler {
    constructor() {
        this.lastExecution = new Map();
    }

    /**
     * Throttle a function call
     * @param {string} key - Unique identifier
     * @param {Function} fn - Function to execute
     * @param {number} limit - Minimum time between executions (ms)
     * @returns {boolean} - Whether function was executed
     */
    throttle(key, fn, limit = 1000) {
        const now = Date.now();
        const lastTime = this.lastExecution.get(key) || 0;

        if (now - lastTime >= limit) {
            this.lastExecution.set(key, now);
            fn();
            return true;
        }

        return false;
    }

    /**
     * Reset throttle for a key
     */
    reset(key) {
        this.lastExecution.delete(key);
    }

    /**
     * Reset all throttles
     */
    resetAll() {
        this.lastExecution.clear();
    }
}

/**
 * Network Efficiency Manager
 * Combines caching, deduplication, debouncing, and throttling
 */
class NetworkEfficiencyManager {
    constructor(options = {}) {
        this.cache = new RequestCache({
            maxSize: options.cacheMaxSize || 100,
            defaultTTL: options.cacheTTL || 5 * 60 * 1000
        });
        this.deduplicator = new RequestDeduplicator();
        this.debouncer = new Debouncer();
        this.throttler = new Throttler();

        // Auto-prune expired cache entries every 60 seconds
        this.pruneInterval = setInterval(() => {
            this.cache.prune();
        }, 60000);

        // Track metrics
        this.metrics = {
            totalRequests: 0,
            cachedRequests: 0,
            networkRequests: 0,
            failedRequests: 0
        };
    }

    /**
     * Execute a cached request with deduplication
     * @param {Object} options - Request options
     * @param {string} options.method - HTTP method
     * @param {string} options.url - Request URL
     * @param {Object} options.body - Request body (optional)
     * @param {Function} options.requestFn - Function that returns a Promise
     * @param {number} options.ttl - Cache TTL in ms (optional)
     * @param {boolean} options.cache - Whether to cache (default: true)
     * @param {boolean} options.deduplicate - Whether to deduplicate (default: true)
     */
    async request(options) {
        this.metrics.totalRequests++;

        const {
            method,
            url,
            body = null,
            requestFn,
            ttl = null,
            cache = true,
            deduplicate = true
        } = options;

        const cacheKey = this.cache.generateKey(method, url, body);

        // Check cache first
        if (cache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                this.metrics.cachedRequests++;
                return JSON.parse(JSON.stringify(cached)); // Deep clone
            }
        }

        // Execute with deduplication if enabled
        try {
            let response;
            if (deduplicate) {
                response = await this.deduplicator.execute(cacheKey, requestFn);
            } else {
                response = await requestFn();
            }

            this.metrics.networkRequests++;

            // Cache the response if caching is enabled
            if (cache && response) {
                this.cache.set(cacheKey, response, ttl);
            }

            return response;

        } catch (error) {
            this.metrics.failedRequests++;
            throw error;
        }
    }

    /**
     * Debounced request - delays execution until calls stop
     */
    debouncedRequest(key, requestFn, delay = 300) {
        return new Promise((resolve, reject) => {
            this.debouncer.debounce(key, async () => {
                try {
                    const result = await requestFn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, delay);
        });
    }

    /**
     * Throttled request - limits execution frequency
     */
    throttledRequest(key, requestFn, limit = 1000) {
        return new Promise((resolve, reject) => {
            const executed = this.throttler.throttle(key, async () => {
                try {
                    const result = await requestFn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, limit);

            if (!executed) {
                resolve(null); // Return null if throttled
            }
        });
    }

    /**
     * Invalidate cache entries
     */
    invalidateCache(pattern) {
        return this.cache.invalidate(pattern);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const cacheStats = this.cache.getStats();
        const dedupeStats = this.deduplicator.getStats();

        return {
            metrics: this.metrics,
            cache: cacheStats,
            deduplication: dedupeStats
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
        }
        this.debouncer.cancelAll();
        this.throttler.resetAll();
        this.cache.clear();
    }
}

// Global instance
window.networkEfficiency = new NetworkEfficiencyManager({
    cacheMaxSize: 200,
    cacheTTL: 5 * 60 * 1000 // 5 minutes
});

// Cleanup on page unload
if (typeof globalLifecycle !== 'undefined') {
    globalLifecycle.addEventListener(window, 'beforeunload', () => {
        window.networkEfficiency.destroy();
    });
} else {
    window.addEventListener('beforeunload', () => {
        window.networkEfficiency.destroy();
    });
}

// Expose for debugging
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.debugNetworkEfficiency = () => {
        const stats = window.networkEfficiency.getStats();
        console.group('Network Efficiency Stats');
        console.table(stats.metrics);
        console.log('Cache:', stats.cache);
        console.log('Deduplication:', stats.deduplication);
        console.groupEnd();
        return stats;
    };
}
