/**
 * Storage Helpers and Validators
 *
 * Provides convenient functions for common storage operations
 * with built-in validation schemas for different data types.
 */

/**
 * Data validators for different entity types
 */
const StorageValidators = {
    /**
     * Validate profile data
     */
    profile: (data) => {
        const schema = {
            type: 'object',
            required: ['rsName', 'rsEmail', 'rsRank'],
            fields: {
                rsName: 'string',
                rsEmail: 'string',
                rsRank: 'string',
                totalEvaluations: 'number'
            }
        };

        return DataIntegrityManager.validateSchema(data, schema);
    },

    /**
     * Validate evaluation data
     */
    evaluation: (data) => {
        const schema = {
            type: 'object',
            required: ['id', 'marineName', 'marineRank'],
            fields: {
                id: 'string',
                marineName: 'string',
                marineRank: 'string',
                fromDate: 'string',
                toDate: 'string',
                fitrepAverage: 'number'
            }
        };

        return DataIntegrityManager.validateSchema(data, schema);
    },

    /**
     * Validate session data
     */
    session: (data) => {
        const schema = {
            type: 'object',
            fields: {
                currentStep: 'string',
                lastModified: 'number'
            }
        };

        return DataIntegrityManager.validateSchema(data, schema);
    },

    /**
     * Validate preferences data
     */
    preferences: (data) => {
        // Preferences are flexible, just ensure it's an object
        return { valid: typeof data === 'object' && data !== null };
    }
};

/**
 * Data repair defaults for different entity types
 */
const StorageRepairDefaults = {
    profile: {
        rsName: '',
        rsEmail: '',
        rsRank: 'Unknown',
        totalEvaluations: 0,
        lastUpdated: new Date().toISOString()
    },

    evaluation: {
        id: 'unknown-' + Date.now(),
        marineName: 'Unknown',
        marineRank: 'Unknown',
        fromDate: '',
        toDate: '',
        fitrepAverage: 0,
        syncStatus: 'pending'
    },

    session: {
        currentStep: 'setup',
        lastModified: Date.now()
    },

    preferences: {}
};

/**
 * Profile Storage Helpers
 */
class ProfileStorage {
    /**
     * Save profile
     */
    static async save(profileKey, profileData) {
        return await window.unifiedStorage.setItem('profiles', profileKey, profileData, {
            type: 'profile',
            email: profileData.rsEmail,
            validator: StorageValidators.profile
        });
    }

    /**
     * Load profile
     */
    static async load(profileKey) {
        return await window.unifiedStorage.getItem('profiles', profileKey, {
            validator: StorageValidators.profile,
            attemptRepair: true,
            repairOptions: {
                defaults: StorageRepairDefaults.profile,
                removeNulls: true
            }
        });
    }

    /**
     * Get all profiles
     */
    static async getAll() {
        return await window.unifiedStorage.getAllItems('profiles', {
            validator: StorageValidators.profile
        });
    }

    /**
     * Delete profile
     */
    static async delete(profileKey) {
        return await window.unifiedStorage.removeItem('profiles', profileKey);
    }

    /**
     * Get profiles by email
     */
    static async getByEmail(email) {
        return await window.unifiedStorage.queryByIndex('profiles', 'email', email, {
            validator: StorageValidators.profile
        });
    }
}

/**
 * Evaluation Storage Helpers
 */
class EvaluationStorage {
    /**
     * Generate evaluation key
     */
    static generateKey(email, evaluationId) {
        return `${email}|${evaluationId}`;
    }

    /**
     * Save evaluation
     */
    static async save(email, evaluationId, evaluationData) {
        const key = this.generateKey(email, evaluationId);

        return await window.unifiedStorage.setItem('evaluations', key, evaluationData, {
            type: 'evaluation',
            email: email,
            syncStatus: evaluationData.syncStatus || 'pending',
            createdAt: evaluationData.createdAt || Date.now(),
            validator: StorageValidators.evaluation
        });
    }

    /**
     * Load evaluation
     */
    static async load(email, evaluationId) {
        const key = this.generateKey(email, evaluationId);

        return await window.unifiedStorage.getItem('evaluations', key, {
            validator: StorageValidators.evaluation,
            attemptRepair: true,
            repairOptions: {
                defaults: StorageRepairDefaults.evaluation,
                removeNulls: true
            }
        });
    }

    /**
     * Get all evaluations for user
     */
    static async getAllForUser(email) {
        return await window.unifiedStorage.queryByIndex('evaluations', 'email', email, {
            validator: StorageValidators.evaluation
        });
    }

    /**
     * Get pending sync evaluations
     */
    static async getPendingSync() {
        return await window.unifiedStorage.queryByIndex('evaluations', 'syncStatus', 'pending', {
            validator: StorageValidators.evaluation
        });
    }

    /**
     * Delete evaluation
     */
    static async delete(email, evaluationId) {
        const key = this.generateKey(email, evaluationId);
        return await window.unifiedStorage.removeItem('evaluations', key);
    }

    /**
     * Save evaluation index (summary list)
     */
    static async saveIndex(email, indexEntries) {
        return await window.unifiedStorage.setItem('evaluationIndexes', email, indexEntries, {
            type: 'evaluationIndex',
            email: email
        });
    }

    /**
     * Load evaluation index
     */
    static async loadIndex(email) {
        return await window.unifiedStorage.getItem('evaluationIndexes', email, {
            attemptRepair: true,
            repairOptions: {
                defaults: { entries: [] }
            }
        });
    }
}

/**
 * Session Storage Helpers
 */
class SessionStorage {
    /**
     * Save session data
     */
    static async save(sessionKey, sessionData) {
        return await window.unifiedStorage.setItem('sessions', sessionKey, sessionData, {
            type: 'session',
            validator: StorageValidators.session
        });
    }

    /**
     * Load session data
     */
    static async load(sessionKey) {
        return await window.unifiedStorage.getItem('sessions', sessionKey, {
            validator: StorageValidators.session,
            attemptRepair: true,
            repairOptions: {
                defaults: StorageRepairDefaults.session
            }
        });
    }

    /**
     * Save current session
     */
    static async saveCurrent(data) {
        return await this.save('current', data);
    }

    /**
     * Load current session
     */
    static async loadCurrent() {
        return await this.load('current');
    }

    /**
     * Clear expired sessions
     */
    static async clearExpired() {
        const allSessions = await window.unifiedStorage.getAllItems('sessions');
        const now = Date.now();
        let cleared = 0;

        for (const session of allSessions) {
            if (session.expiresAt && session.expiresAt < now) {
                await window.unifiedStorage.removeItem('sessions', session.sessionKey);
                cleared++;
            }
        }

        return cleared;
    }
}

/**
 * Preferences Storage Helpers
 */
class PreferencesStorage {
    /**
     * Save preference
     */
    static async save(key, value) {
        return await window.unifiedStorage.setItem('preferences', key, value, {
            type: 'preference'
        });
    }

    /**
     * Load preference
     */
    static async load(key, defaultValue = null) {
        const value = await window.unifiedStorage.getItem('preferences', key);
        return value !== null ? value : defaultValue;
    }

    /**
     * Get all preferences
     */
    static async getAll() {
        return await window.unifiedStorage.getAllItems('preferences');
    }

    /**
     * Delete preference
     */
    static async delete(key) {
        return await window.unifiedStorage.removeItem('preferences', key);
    }
}

/**
 * Migration Helper
 * Migrates data from old localStorage keys to unified storage
 */
class StorageMigration {
    /**
     * Migrate all legacy data
     */
    static async migrateAll() {
        const results = {
            profiles: 0,
            evaluations: 0,
            sessions: 0,
            preferences: 0,
            errors: []
        };

        try {
            // Migrate profiles
            results.profiles = await this.migrateProfiles();

            // Migrate evaluations
            results.evaluations = await this.migrateEvaluations();

            // Migrate session data
            results.sessions = await this.migrateSessions();

            // Migrate preferences
            results.preferences = await this.migratePreferences();

            console.info('[Migration] Complete:', results);

        } catch (error) {
            console.error('[Migration] Failed:', error);
            results.errors.push(error.message);
        }

        return results;
    }

    /**
     * Migrate profiles from localStorage
     */
    static async migrateProfiles() {
        let migrated = 0;

        try {
            // Look for profile keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);

                if (key && key.startsWith('profile_')) {
                    try {
                        const value = localStorage.getItem(key);
                        if (value) {
                            const profile = JSON.parse(value);
                            await ProfileStorage.save(key, profile);
                            migrated++;
                        }
                    } catch (error) {
                        console.warn(`[Migration] Profile migration error for ${key}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('[Migration] Profile migration failed:', error);
        }

        return migrated;
    }

    /**
     * Migrate evaluations from localStorage
     */
    static async migrateEvaluations() {
        let migrated = 0;

        try {
            const currentEvaluations = localStorage.getItem('current_evaluations');

            if (currentEvaluations) {
                try {
                    const evaluations = JSON.parse(currentEvaluations);
                    const currentProfile = localStorage.getItem('current_profile');
                    const profile = currentProfile ? JSON.parse(currentProfile) : null;
                    const email = profile?.rsEmail || 'unknown@example.com';

                    if (Array.isArray(evaluations)) {
                        for (const evaluation of evaluations) {
                            if (evaluation && evaluation.id) {
                                await EvaluationStorage.save(email, evaluation.id, evaluation);
                                migrated++;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[Migration] Evaluations migration error:', error);
                }
            }
        } catch (error) {
            console.error('[Migration] Evaluations migration failed:', error);
        }

        return migrated;
    }

    /**
     * Migrate session data
     */
    static async migrateSessions() {
        let migrated = 0;

        try {
            const sessionData = localStorage.getItem('fitrep_current_session');

            if (sessionData) {
                try {
                    const session = JSON.parse(sessionData);
                    await SessionStorage.saveCurrent(session);
                    migrated++;
                } catch (error) {
                    console.warn('[Migration] Session migration error:', error);
                }
            }
        } catch (error) {
            console.error('[Migration] Session migration failed:', error);
        }

        return migrated;
    }

    /**
     * Migrate preferences
     */
    static async migratePreferences() {
        let migrated = 0;

        try {
            const preferencesData = localStorage.getItem('fitrep_user_preferences');

            if (preferencesData) {
                try {
                    const preferences = JSON.parse(preferencesData);

                    for (const [key, value] of Object.entries(preferences)) {
                        await PreferencesStorage.save(key, value);
                        migrated++;
                    }
                } catch (error) {
                    console.warn('[Migration] Preferences migration error:', error);
                }
            }
        } catch (error) {
            console.error('[Migration] Preferences migration failed:', error);
        }

        return migrated;
    }

    /**
     * Check if migration is needed
     */
    static needsMigration() {
        // Check for legacy localStorage keys
        const legacyKeys = [
            'profile_',
            'current_evaluations',
            'current_profile',
            'fitrep_current_session',
            'fitrep_user_preferences'
        ];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                for (const prefix of legacyKeys) {
                    if (key.startsWith(prefix) || key === prefix) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Run migration if needed
     */
    static async runIfNeeded() {
        if (this.needsMigration()) {
            console.info('[Migration] Legacy data detected, starting migration...');
            const results = await this.migrateAll();
            console.info('[Migration] Results:', results);
            return results;
        }

        console.info('[Migration] No legacy data found');
        return null;
    }
}

// Expose helpers globally
if (typeof window !== 'undefined') {
    window.ProfileStorage = ProfileStorage;
    window.EvaluationStorage = EvaluationStorage;
    window.SessionStorage = SessionStorage;
    window.PreferencesStorage = PreferencesStorage;
    window.StorageMigration = StorageMigration;
    window.StorageValidators = StorageValidators;

    // Auto-run migration on page load (after storage initializes)
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            // Wait for storage to initialize
            await window.unifiedStorage.initialize();

            // Run migration if needed
            const migrationNeeded = StorageMigration.needsMigration();
            if (migrationNeeded) {
                console.info('[Storage] Running automatic migration...');
                await StorageMigration.runIfNeeded();
            }
        } catch (error) {
            console.error('[Storage] Auto-migration failed:', error);
        }
    });
}
