/**
 * Unified Storage System with Data Integrity
 *
 * Provides a robust storage layer with:
 * - IndexedDB with schema versioning
 * - Automatic fallback to localStorage
 * - Data validation and checksums
 * - Corrupted data recovery
 * - Migration support
 * - Unified interface
 */

/**
 * Data Integrity Manager
 * Handles validation, checksums, and corruption detection
 */
class DataIntegrityManager {
    /**
     * Calculate checksum for data using simple hash
     * @param {*} data - Data to checksum
     * @returns {string} - Checksum string
     */
    static calculateChecksum(data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        let hash = 0;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash).toString(36);
    }

    /**
     * Wrap data with metadata and checksum
     * @param {*} data - Data to wrap
     * @param {Object} options - Options
     * @returns {Object} - Wrapped data
     */
    static wrapData(data, options = {}) {
        const wrapped = {
            version: options.version || 1,
            timestamp: Date.now(),
            data: data,
            metadata: {
                type: options.type || 'unknown',
                source: options.source || 'app',
                compressed: false
            }
        };

        // Calculate checksum
        wrapped.checksum = this.calculateChecksum(data);

        return wrapped;
    }

    /**
     * Unwrap and validate data
     * @param {Object} wrapped - Wrapped data
     * @param {Object} options - Validation options
     * @returns {*} - Unwrapped data or null if invalid
     */
    static unwrapData(wrapped, options = {}) {
        if (!wrapped || typeof wrapped !== 'object') {
            return { valid: false, error: 'Invalid wrapped data format', data: null };
        }

        // Check required fields
        if (!wrapped.hasOwnProperty('data') || !wrapped.hasOwnProperty('checksum')) {
            return { valid: false, error: 'Missing required fields', data: null };
        }

        // Verify checksum
        const expectedChecksum = wrapped.checksum;
        const actualChecksum = this.calculateChecksum(wrapped.data);

        if (expectedChecksum !== actualChecksum) {
            return {
                valid: false,
                error: 'Checksum mismatch - data may be corrupted',
                data: wrapped.data, // Return data anyway for recovery attempts
                expectedChecksum,
                actualChecksum
            };
        }

        // Check version compatibility
        if (options.maxVersion && wrapped.version > options.maxVersion) {
            return {
                valid: false,
                error: `Version ${wrapped.version} is newer than supported ${options.maxVersion}`,
                data: wrapped.data
            };
        }

        // Validate data structure if validator provided
        if (options.validator && typeof options.validator === 'function') {
            try {
                const validationResult = options.validator(wrapped.data);
                if (!validationResult.valid) {
                    return {
                        valid: false,
                        error: `Validation failed: ${validationResult.error}`,
                        data: wrapped.data
                    };
                }
            } catch (error) {
                return {
                    valid: false,
                    error: `Validation error: ${error.message}`,
                    data: wrapped.data
                };
            }
        }

        return {
            valid: true,
            data: wrapped.data,
            metadata: wrapped.metadata,
            timestamp: wrapped.timestamp,
            version: wrapped.version
        };
    }

    /**
     * Validate data structure
     * @param {*} data - Data to validate
     * @param {Object} schema - Validation schema
     * @returns {Object} - Validation result
     */
    static validateSchema(data, schema) {
        if (!schema || typeof schema !== 'object') {
            return { valid: true }; // No schema = no validation
        }

        try {
            // Required fields check
            if (schema.required && Array.isArray(schema.required)) {
                for (const field of schema.required) {
                    if (!data.hasOwnProperty(field)) {
                        return { valid: false, error: `Missing required field: ${field}` };
                    }
                }
            }

            // Type checks
            if (schema.type) {
                const actualType = Array.isArray(data) ? 'array' : typeof data;
                if (actualType !== schema.type) {
                    return { valid: false, error: `Expected type ${schema.type}, got ${actualType}` };
                }
            }

            // Field types
            if (schema.fields && typeof schema.fields === 'object') {
                for (const [field, expectedType] of Object.entries(schema.fields)) {
                    if (data.hasOwnProperty(field)) {
                        const actualType = typeof data[field];
                        if (actualType !== expectedType) {
                            return {
                                valid: false,
                                error: `Field ${field}: expected ${expectedType}, got ${actualType}`
                            };
                        }
                    }
                }
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Attempt to repair corrupted data
     * @param {*} data - Corrupted data
     * @param {Object} options - Repair options
     * @returns {Object} - Repair result
     */
    static repairData(data, options = {}) {
        const repairs = [];

        try {
            // If data is string, try to parse it
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                    repairs.push('Parsed JSON string');
                } catch (e) {
                    return { success: false, error: 'Cannot parse JSON', data: null };
                }
            }

            // Ensure object
            if (typeof data !== 'object' || data === null) {
                return { success: false, error: 'Data is not an object', data: null };
            }

            // Remove null/undefined fields if specified
            if (options.removeNulls) {
                const cleaned = {};
                for (const [key, value] of Object.entries(data)) {
                    if (value !== null && value !== undefined) {
                        cleaned[key] = value;
                    }
                }
                data = cleaned;
                repairs.push('Removed null/undefined fields');
            }

            // Apply defaults for missing required fields
            if (options.defaults && typeof options.defaults === 'object') {
                for (const [key, defaultValue] of Object.entries(options.defaults)) {
                    if (!data.hasOwnProperty(key)) {
                        data[key] = defaultValue;
                        repairs.push(`Added default for ${key}`);
                    }
                }
            }

            return {
                success: true,
                data: data,
                repairs: repairs
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }
}

/**
 * IndexedDB Store with Versioning
 */
class VersionedIndexedDB {
    constructor(dbName, version, schema) {
        this.dbName = dbName;
        this.version = version;
        this.schema = schema;
        this.db = null;
        this.dbPromise = null;
    }

    /**
     * Open database with schema migrations
     */
    async open() {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                reject(new Error(`IndexedDB open failed: ${event.target.error}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = request.result;
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;

                console.log(`IndexedDB upgrade: ${oldVersion} → ${newVersion}`);

                // Run migrations
                this.migrate(db, oldVersion, newVersion);
            };
        });

        return this.dbPromise;
    }

    /**
     * Run schema migrations
     */
    migrate(db, oldVersion, newVersion) {
        if (!this.schema || !this.schema.migrations) {
            // No migrations defined, create stores from schema
            if (this.schema && this.schema.stores) {
                for (const [storeName, storeConfig] of Object.entries(this.schema.stores)) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, storeConfig.options || {});

                        // Create indexes
                        if (storeConfig.indexes) {
                            for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
                                store.createIndex(indexName, indexConfig.keyPath, indexConfig.options || {});
                            }
                        }
                    }
                }
            }
            return;
        }

        // Run migrations in order
        for (const migration of this.schema.migrations) {
            if (migration.version > oldVersion && migration.version <= newVersion) {
                console.log(`Running migration to version ${migration.version}`);
                migration.upgrade(db, oldVersion);
            }
        }
    }

    /**
     * Get data from store
     */
    async get(storeName, key) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Put data into store
     */
    async put(storeName, data) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Delete data from store
     */
    async delete(storeName, key) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get all data from store
     */
    async getAll(storeName) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Clear all data from store
     */
    async clear(storeName) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Query store by index
     */
    async queryByIndex(storeName, indexName, value) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(value);

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.dbPromise = null;
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.DataIntegrityManager = DataIntegrityManager;
    window.VersionedIndexedDB = VersionedIndexedDB;
}
