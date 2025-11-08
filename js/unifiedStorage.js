/**
 * Unified Storage Manager
 *
 * Provides a single interface for data storage with:
 * - Automatic selection of best storage (IndexedDB → localStorage)
 * - Data integrity validation
 * - Transparent fallback handling
 * - Migration support
 * - Consistent API across storage types
 */

class UnifiedStorageManager {
    constructor(options = {}) {
        this.dbName = options.dbName || 'fitrep-unified-db';
        this.version = options.version || 2;
        this.schema = options.schema || this.getDefaultSchema();
        this.useCompression = options.useCompression || false;

        this.idb = null;
        this.idbAvailable = false;
        this.initPromise = null;

        // Storage type tracking
        this.storageType = null;

        // Statistics
        this.stats = {
            reads: 0,
            writes: 0,
            errors: 0,
            corrupted: 0,
            repaired: 0
        };
    }

    /**
     * Default schema definition
     */
    getDefaultSchema() {
        return {
            stores: {
                // User profiles
                profiles: {
                    options: { keyPath: 'profileKey' },
                    indexes: {
                        email: { keyPath: 'email', options: { unique: false } },
                        updatedAt: { keyPath: 'updatedAt', options: { unique: false } }
                    }
                },
                // Evaluations
                evaluations: {
                    options: { keyPath: 'key' }, // email|id
                    indexes: {
                        email: { keyPath: 'email', options: { unique: false } },
                        syncStatus: { keyPath: 'syncStatus', options: { unique: false } },
                        createdAt: { keyPath: 'createdAt', options: { unique: false } }
                    }
                },
                // Evaluation indexes (summaries)
                evaluationIndexes: {
                    options: { keyPath: 'email' },
                    indexes: {
                        updatedAt: { keyPath: 'updatedAt', options: { unique: false } }
                    }
                },
                // Session data
                sessions: {
                    options: { keyPath: 'sessionKey' },
                    indexes: {
                        expiresAt: { keyPath: 'expiresAt', options: { unique: false } }
                    }
                },
                // Preferences
                preferences: {
                    options: { keyPath: 'key' }
                }
            },
            migrations: [
                {
                    version: 2,
                    upgrade: (db, oldVersion) => {
                        // Migration from v1 to v2
                        if (oldVersion < 2) {
                            // Add new indexes to evaluations store
                            if (db.objectStoreNames.contains('evaluations')) {
                                // Note: Can't modify stores during upgrade, this is handled by schema
                                console.log('Migration v2: Updated evaluation indexes');
                            }
                        }
                    }
                }
            ]
        };
    }

    /**
     * Initialize storage (auto-detect best option)
     */
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            // Try IndexedDB first
            try {
                if (typeof indexedDB !== 'undefined') {
                    this.idb = new VersionedIndexedDB(this.dbName, this.version, this.schema);
                    await this.idb.open();
                    this.idbAvailable = true;
                    this.storageType = 'indexeddb';
                    console.info('[Storage] Using IndexedDB');
                    return true;
                }
            } catch (error) {
                console.warn('[Storage] IndexedDB unavailable:', error);
            }

            // Fallback to localStorage
            if (typeof localStorage !== 'undefined') {
                this.idbAvailable = false;
                this.storageType = 'localstorage';
                console.info('[Storage] Using localStorage fallback');
                return true;
            }

            // No storage available
            this.storageType = 'memory';
            console.warn('[Storage] No persistent storage available, using memory');
            this.memoryStore = new Map();
            return false;
        })();

        return this.initPromise;
    }

    /**
     * Set item with data integrity
     */
    async setItem(storeName, key, value, options = {}) {
        await this.initialize();
        this.stats.writes++;

        try {
            // Wrap data with integrity checks
            const wrapped = DataIntegrityManager.wrapData(value, {
                type: options.type || storeName,
                source: options.source || 'app',
                version: options.version || 1
            });

            if (this.idbAvailable) {
                // IndexedDB storage
                const data = {
                    [this.schema.stores[storeName]?.options?.keyPath || 'key']: key,
                    ...wrapped,
                    // Add any additional indexed fields
                    email: options.email || null,
                    syncStatus: options.syncStatus || null,
                    createdAt: options.createdAt || wrapped.timestamp,
                    updatedAt: Date.now()
                };

                await this.idb.put(storeName, data);
            } else if (this.storageType === 'localstorage') {
                // localStorage fallback
                const lsKey = `${this.dbName}:${storeName}:${key}`;
                localStorage.setItem(lsKey, JSON.stringify(wrapped));
            } else {
                // Memory fallback
                const memKey = `${storeName}:${key}`;
                this.memoryStore.set(memKey, wrapped);
            }

            return true;

        } catch (error) {
            this.stats.errors++;
            console.error(`[Storage] setItem failed for ${storeName}/${key}:`, error);
            throw error;
        }
    }

    /**
     * Get item with data integrity validation
     */
    async getItem(storeName, key, options = {}) {
        await this.initialize();
        this.stats.reads++;

        try {
            let wrapped = null;

            if (this.idbAvailable) {
                // IndexedDB storage
                const keyPath = this.schema.stores[storeName]?.options?.keyPath || 'key';
                wrapped = await this.idb.get(storeName, key);
            } else if (this.storageType === 'localstorage') {
                // localStorage fallback
                const lsKey = `${this.dbName}:${storeName}:${key}`;
                const stored = localStorage.getItem(lsKey);
                if (stored) {
                    wrapped = JSON.parse(stored);
                }
            } else {
                // Memory fallback
                const memKey = `${storeName}:${key}`;
                wrapped = this.memoryStore.get(memKey);
            }

            if (!wrapped) {
                return null;
            }

            // Validate and unwrap
            const result = DataIntegrityManager.unwrapData(wrapped, {
                validator: options.validator,
                maxVersion: options.maxVersion
            });

            if (!result.valid) {
                this.stats.corrupted++;
                console.warn(`[Storage] Data corruption detected for ${storeName}/${key}:`, result.error);

                // Attempt repair if enabled
                if (options.attemptRepair !== false) {
                    const repaired = DataIntegrityManager.repairData(result.data, options.repairOptions);

                    if (repaired.success) {
                        this.stats.repaired++;
                        console.info(`[Storage] Data repaired for ${storeName}/${key}:`, repaired.repairs);

                        // Re-save repaired data
                        await this.setItem(storeName, key, repaired.data, options);

                        return repaired.data;
                    }
                }

                // Return corrupted data if configured to do so
                if (options.returnCorrupted) {
                    return result.data;
                }

                return null;
            }

            return result.data;

        } catch (error) {
            this.stats.errors++;
            console.error(`[Storage] getItem failed for ${storeName}/${key}:`, error);
            return null;
        }
    }

    /**
     * Remove item
     */
    async removeItem(storeName, key) {
        await this.initialize();

        try {
            if (this.idbAvailable) {
                await this.idb.delete(storeName, key);
            } else if (this.storageType === 'localstorage') {
                const lsKey = `${this.dbName}:${storeName}:${key}`;
                localStorage.removeItem(lsKey);
            } else {
                const memKey = `${storeName}:${key}`;
                this.memoryStore.delete(memKey);
            }

            return true;

        } catch (error) {
            this.stats.errors++;
            console.error(`[Storage] removeItem failed for ${storeName}/${key}:`, error);
            return false;
        }
    }

    /**
     * Get all items from store
     */
    async getAllItems(storeName, options = {}) {
        await this.initialize();

        try {
            let items = [];

            if (this.idbAvailable) {
                items = await this.idb.getAll(storeName);
            } else if (this.storageType === 'localstorage') {
                const prefix = `${this.dbName}:${storeName}:`;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        const value = localStorage.getItem(key);
                        if (value) {
                            items.push(JSON.parse(value));
                        }
                    }
                }
            } else {
                const prefix = `${storeName}:`;
                for (const [key, value] of this.memoryStore.entries()) {
                    if (key.startsWith(prefix)) {
                        items.push(value);
                    }
                }
            }

            // Unwrap and validate all items
            const results = [];
            for (const wrapped of items) {
                const result = DataIntegrityManager.unwrapData(wrapped, options);
                if (result.valid || options.includeInvalid) {
                    results.push(result.valid ? result.data : {
                        __corrupted: true,
                        __error: result.error,
                        ...result.data
                    });
                }
            }

            return results;

        } catch (error) {
            this.stats.errors++;
            console.error(`[Storage] getAllItems failed for ${storeName}:`, error);
            return [];
        }
    }

    /**
     * Clear store
     */
    async clearStore(storeName) {
        await this.initialize();

        try {
            if (this.idbAvailable) {
                await this.idb.clear(storeName);
            } else if (this.storageType === 'localstorage') {
                const prefix = `${this.dbName}:${storeName}:`;
                const keysToRemove = [];

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keysToRemove.push(key);
                    }
                }

                keysToRemove.forEach(key => localStorage.removeItem(key));
            } else {
                const prefix = `${storeName}:`;
                for (const key of this.memoryStore.keys()) {
                    if (key.startsWith(prefix)) {
                        this.memoryStore.delete(key);
                    }
                }
            }

            return true;

        } catch (error) {
            this.stats.errors++;
            console.error(`[Storage] clearStore failed for ${storeName}:`, error);
            return false;
        }
    }

    /**
     * Query items by index (IndexedDB only, fallback to filter)
     */
    async queryByIndex(storeName, indexName, value, options = {}) {
        await this.initialize();

        try {
            if (this.idbAvailable) {
                const items = await this.idb.queryByIndex(storeName, indexName, value);

                // Unwrap items
                const results = [];
                for (const wrapped of items) {
                    const result = DataIntegrityManager.unwrapData(wrapped, options);
                    if (result.valid) {
                        results.push(result.data);
                    }
                }

                return results;

            } else {
                // Fallback: get all and filter
                const allItems = await this.getAllItems(storeName, options);
                return allItems.filter(item => item && item[indexName] === value);
            }

        } catch (error) {
            this.stats.errors++;
            console.error(`[Storage] queryByIndex failed:`, error);
            return [];
        }
    }

    /**
     * Get storage statistics
     */
    getStats() {
        return {
            storageType: this.storageType,
            idbAvailable: this.idbAvailable,
            stats: this.stats,
            errorRate: this.stats.reads + this.stats.writes > 0
                ? ((this.stats.errors / (this.stats.reads + this.stats.writes)) * 100).toFixed(2) + '%'
                : '0%',
            corruptionRate: this.stats.reads > 0
                ? ((this.stats.corrupted / this.stats.reads) * 100).toFixed(2) + '%'
                : '0%',
            repairRate: this.stats.corrupted > 0
                ? ((this.stats.repaired / this.stats.corrupted) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Close storage
     */
    close() {
        if (this.idb) {
            this.idb.close();
        }
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.unifiedStorage = new UnifiedStorageManager({
        dbName: 'fitrep-unified-db',
        version: 2
    });

    // Auto-initialize on page load
    window.unifiedStorage.initialize().catch(error => {
        console.error('[Storage] Initialization failed:', error);
    });

    // Cleanup on page unload
    if (typeof globalLifecycle !== 'undefined') {
        globalLifecycle.addEventListener(window, 'beforeunload', () => {
            window.unifiedStorage.close();
        });
    } else {
        window.addEventListener('beforeunload', () => {
            window.unifiedStorage.close();
        });
    }

    // Expose for debugging
    if (window.location.hostname === 'localhost') {
        window.debugStorage = () => {
            const stats = window.unifiedStorage.getStats();
            console.group('Storage Statistics');
            console.table(stats);
            console.groupEnd();
            return stats;
        };
    }
}
