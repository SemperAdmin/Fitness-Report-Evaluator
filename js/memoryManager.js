/**
 * Memory Management Module
 * Prevents memory leaks by managing event listeners, timers, and large objects
 */

/**
 * LifecycleManager - Centralized cleanup system
 */
class LifecycleManager {
    /**
     *
     */
    constructor() {
        this.listeners = [];
        this.timers = [];
        this.intervals = [];
        this.objects = new Set();
        this.cleanupCallbacks = [];
    }

    /**
     * Register an event listener for automatic cleanup
     * @param target
     * @param event
     * @param handler
     * @param options
     */
    addEventListener(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        this.listeners.push({ target, event, handler, options });
        return () => this.removeEventListener(target, event, handler);
    }

    /**
     * Remove a specific event listener
     * @param target
     * @param event
     * @param handler
     */
    removeEventListener(target, event, handler) {
        target.removeEventListener(event, handler);
        this.listeners = this.listeners.filter(
            l => !(l.target === target && l.event === event && l.handler === handler)
        );
    }

    /**
     * Register a setTimeout for automatic cleanup
     * @param callback
     * @param delay
     * @param {...any} args
     */
    setTimeout(callback, delay, ...args) {
        const id = setTimeout(() => {
            callback(...args);
            this.clearTimeout(id);
        }, delay);
        this.timers.push(id);
        return id;
    }

    /**
     * Clear a specific timeout
     * @param id
     */
    clearTimeout(id) {
        clearTimeout(id);
        this.timers = this.timers.filter(t => t !== id);
    }

    /**
     * Register a setInterval for automatic cleanup
     * @param callback
     * @param delay
     * @param {...any} args
     */
    setInterval(callback, delay, ...args) {
        const id = setInterval(callback, delay, ...args);
        this.intervals.push(id);
        return id;
    }

    /**
     * Clear a specific interval
     * @param id
     */
    clearInterval(id) {
        clearInterval(id);
        this.intervals = this.intervals.filter(i => i !== id);
    }

    /**
     * Track large objects for cleanup
     * @param obj
     * @param cleanupFn
     */
    trackObject(obj, cleanupFn) {
        this.objects.add(obj);
        if (cleanupFn) {
            this.cleanupCallbacks.push({ obj, cleanupFn });
        }
    }

    /**
     * Untrack an object
     * @param obj
     */
    untrackObject(obj) {
        this.objects.delete(obj);
        this.cleanupCallbacks = this.cleanupCallbacks.filter(c => c.obj !== obj);
    }

    /**
     * Cleanup all tracked resources
     */
    cleanup() {
        // Remove all event listeners
        this.listeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this.listeners = [];

        // Clear all timers
        this.timers.forEach(id => clearTimeout(id));
        this.timers = [];

        // Clear all intervals
        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];

        // Run cleanup callbacks for tracked objects
        this.cleanupCallbacks.forEach(({ obj, cleanupFn }) => {
            try {
                cleanupFn(obj);
            } catch (e) {
                console.error('Cleanup callback failed:', e);
            }
        });
        this.cleanupCallbacks = [];

        // Clear object references
        this.objects.clear();
    }

    /**
     * Get memory usage info
     */
    getInfo() {
        return {
            listeners: this.listeners.length,
            timers: this.timers.length,
            intervals: this.intervals.length,
            objects: this.objects.size,
            cleanupCallbacks: this.cleanupCallbacks.length
        };
    }
}

/**
 * Global lifecycle manager instance
 */
const globalLifecycle = new LifecycleManager();

/**
 * WeakMap-based cache with automatic cleanup
 */
class ManagedCache {
    /**
     *
     * @param maxSize
     */
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.accessOrder = [];
    }

    /**
     *
     * @param key
     * @param value
     */
    set(key, value) {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const oldest = this.accessOrder.shift();
            this.cache.delete(oldest);
        }

        this.cache.set(key, value);

        // Update access order
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }

    /**
     *
     * @param key
     */
    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Update access order
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);

        return this.cache.get(key);
    }

    /**
     *
     * @param key
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     *
     * @param key
     */
    delete(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        return this.cache.delete(key);
    }

    /**
     *
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     *
     */
    size() {
        return this.cache.size;
    }

    /**
     * Prune cache to remove old entries
     * @param keepCount
     */
    prune(keepCount = Math.floor(this.maxSize / 2)) {
        const toRemove = this.accessOrder.length - keepCount;
        if (toRemove > 0) {
            const removed = this.accessOrder.splice(0, toRemove);
            removed.forEach(key => this.cache.delete(key));
        }
    }
}

/**
 * Component with lifecycle hooks
 */
class ManagedComponent {
    /**
     *
     * @param name
     */
    constructor(name) {
        this.name = name;
        this.lifecycle = new LifecycleManager();
        this.isDestroyed = false;
    }

    /**
     * Add event listener with automatic cleanup
     * @param target
     * @param event
     * @param handler
     * @param options
     */
    addEventListener(target, event, handler, options) {
        return this.lifecycle.addEventListener(target, event, handler, options);
    }

    /**
     * Set timeout with automatic cleanup
     * @param callback
     * @param delay
     * @param {...any} args
     */
    setTimeout(callback, delay, ...args) {
        return this.lifecycle.setTimeout(callback, delay, ...args);
    }

    /**
     * Set interval with automatic cleanup
     * @param callback
     * @param delay
     * @param {...any} args
     */
    setInterval(callback, delay, ...args) {
        return this.lifecycle.setInterval(callback, delay, ...args);
    }

    /**
     * Track object for cleanup
     * @param obj
     * @param cleanupFn
     */
    trackObject(obj, cleanupFn) {
        this.lifecycle.trackObject(obj, cleanupFn);
    }

    /**
     * Called when component is destroyed
     */
    destroy() {
        if (this.isDestroyed) {
            console.warn(`Component ${this.name} already destroyed`);
            return;
        }

        this.lifecycle.cleanup();
        this.isDestroyed = true;
        this.onDestroy();
    }

    /**
     * Override in subclass for custom cleanup
     */
    onDestroy() {
        // Subclasses can implement
    }

    /**
     * Check if component is destroyed
     */
    checkDestroyed() {
        if (this.isDestroyed) {
            throw new Error(`Cannot use destroyed component: ${this.name}`);
        }
    }
}

/**
 * Memory monitor for debugging
 */
class MemoryMonitor {
    /**
     *
     */
    constructor() {
        this.snapshots = [];
        this.maxSnapshots = 50;
    }

    /**
     * Take memory snapshot
     * @param label
     */
    snapshot(label = 'unnamed') {
        const snapshot = {
            label,
            timestamp: Date.now(),
            heap: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            lifecycle: globalLifecycle.getInfo()
        };

        this.snapshots.push(snapshot);

        // Keep only recent snapshots
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    /**
     * Compare two snapshots
     * @param label1
     * @param label2
     */
    compare(label1, label2) {
        const snap1 = this.snapshots.find(s => s.label === label1);
        const snap2 = this.snapshots.find(s => s.label === label2);

        if (!snap1 || !snap2) {
            console.warn('Snapshot not found');
            return null;
        }

        return {
            timeDiff: snap2.timestamp - snap1.timestamp,
            heapDiff: snap2.heap && snap1.heap ? {
                used: snap2.heap.used - snap1.heap.used,
                total: snap2.heap.total - snap1.heap.total
            } : null,
            lifecycleDiff: {
                listeners: snap2.lifecycle.listeners - snap1.lifecycle.listeners,
                timers: snap2.lifecycle.timers - snap1.lifecycle.timers,
                intervals: snap2.lifecycle.intervals - snap1.lifecycle.intervals,
                objects: snap2.lifecycle.objects - snap1.lifecycle.objects
            }
        };
    }

    /**
     * Get current memory usage
     */
    current() {
        if (!performance.memory) {
            return null;
        }

        return {
            used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
            total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
            limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
            percentage: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1) + '%'
        };
    }

    /**
     * Check for potential memory leaks
     */
    checkLeaks() {
        const info = globalLifecycle.getInfo();
        const warnings = [];

        if (info.listeners > 50) {
            warnings.push(`High listener count: ${info.listeners} (potential leak)`);
        }

        if (info.timers > 20) {
            warnings.push(`High timer count: ${info.timers} (potential leak)`);
        }

        if (info.intervals > 5) {
            warnings.push(`High interval count: ${info.intervals} (should be < 5)`);
        }

        if (performance.memory) {
            const usedPercent = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
            if (usedPercent > 90) {
                warnings.push(`Memory usage critical: ${usedPercent.toFixed(1)}%`);
            } else if (usedPercent > 75) {
                warnings.push(`Memory usage high: ${usedPercent.toFixed(1)}%`);
            }
        }

        return {
            hasLeaks: warnings.length > 0,
            warnings,
            info
        };
    }

    /**
     * Log memory status
     */
    log() {
        const current = this.current();
        const lifecycle = globalLifecycle.getInfo();

        console.group('Memory Status');
        if (current) {
            console.log('Heap Used:', current.used);
            console.log('Heap Total:', current.total);
            console.log('Heap Limit:', current.limit);
            console.log('Usage:', current.percentage);
        }
        console.log('Event Listeners:', lifecycle.listeners);
        console.log('Timers:', lifecycle.timers);
        console.log('Intervals:', lifecycle.intervals);
        console.log('Tracked Objects:', lifecycle.objects);
        console.groupEnd();
    }
}

/**
 * Automatic cleanup on page unload
 */
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        globalLifecycle.cleanup();
    });

    // Periodic leak check in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const monitor = new MemoryMonitor();
        globalLifecycle.setInterval(() => {
            const leakCheck = monitor.checkLeaks();
            if (leakCheck.hasLeaks) {
                console.warn('Potential memory leaks detected:', leakCheck.warnings);
            }
        }, 60000); // Check every minute
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.LifecycleManager = LifecycleManager;
    window.ManagedCache = ManagedCache;
    window.ManagedComponent = ManagedComponent;
    window.MemoryMonitor = MemoryMonitor;
    window.globalLifecycle = globalLifecycle;
    window.memoryMonitor = new MemoryMonitor();
}
