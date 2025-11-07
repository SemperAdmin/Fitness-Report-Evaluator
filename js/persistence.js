// Enhanced Data Persistence and Auto-save System
let autoSaveInterval;
let lastSaveTime = null;
let hasUnsavedChanges = false;
let debouncedSaveTimer = null;
let activityEvents = [];
let lastSavedSnapshot = null;
let saveQueue = [];

// Ensure global currentStep exists even if navigation system is not loaded yet
try { if (typeof window.currentStep === 'undefined') { window.currentStep = 'setup'; } } catch (_) { /* noop */ }

const BASE_INTERVAL_MS = 10000; // default 10s
const MIN_INTERVAL_MS = 3000;   // adaptive lower bound
const MAX_INTERVAL_MS = 15000;  // adaptive upper bound
const DEBOUNCE_MS = 1200;       // immediate save when idle

const STORAGE_KEYS = {
    currentSession: 'fitrep_current_session',
    evaluationData: 'fitrep_evaluation_data',
    preferences: 'fitrep_user_preferences',
    sessionHistory: 'fitrep_session_history'
};

// Auto-save functionality
function initializeAutoSave() {
    // Auto-save baseline every 10 seconds, adapt to activity
    const startInterval = (ms) => {
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        autoSaveInterval = setInterval(() => {
            if (hasUnsavedChanges) {
                performSaveWithRetry();
            }
        }, ms);
    };
    startInterval(BASE_INTERVAL_MS);
    
    // Save and warn on page unload when there are unsaved changes or pending syncs
    window.addEventListener('beforeunload', function(e) {
        // Evaluate pending syncs from profile context if available
        let hasPendingSyncs = false;
        try {
            const evals = (window.profileEvaluations || []);
            hasPendingSyncs = Array.isArray(evals) && evals.some(ev => ev && ev.syncStatus === 'pending');
        } catch (_) { /* ignore */ }

        if (hasUnsavedChanges || hasPendingSyncs) {
            try { saveProgressToStorage(); } catch (_) {}
            e.preventDefault();
            e.returnValue = 'You have unsaved changes or pending syncs. Sync/export first?';
            return e.returnValue;
        }
    });
    
    // Mark changes when user interacts with form
    document.addEventListener('input', markUnsavedChanges);
    document.addEventListener('change', markUnsavedChanges);

    // Flush queued saves when connection is restored
    window.addEventListener('online', flushSaveQueue);

    // Adaptive timer recalibration every 5 seconds based on recent activity
    setInterval(() => {
        const now = Date.now();
        activityEvents = activityEvents.filter(t => now - t < 20000); // keep last 20s
        const activityRate = activityEvents.length; // events in 20s
        let next = BASE_INTERVAL_MS;
        if (activityRate >= 12) next = MIN_INTERVAL_MS; // very high activity
        else if (activityRate >= 6) next = 5000;        // moderate activity
        else next = BASE_INTERVAL_MS;
        const currentMs = (autoSaveInterval && autoSaveInterval._ms) || null;
        if (currentMs !== next) {
            startInterval(next);
            // attach ms for introspection
            if (autoSaveInterval) autoSaveInterval._ms = next;
        }
    }, 5000);
}

function markUnsavedChanges() {
    hasUnsavedChanges = true;
    activityEvents.push(Date.now());
    updateAutoSaveIndicator('unsaved');
    // Debounce immediate save after user pauses typing
    clearTimeout(debouncedSaveTimer);
    debouncedSaveTimer = setTimeout(() => {
        if (hasUnsavedChanges) {
            performSaveWithRetry();
        }
    }, DEBOUNCE_MS);
}

function markChangesSaved() {
    hasUnsavedChanges = false;
    lastSaveTime = new Date();
    updateAutoSaveIndicator('saved');
}

function updateAutoSaveIndicator(status) {
    const indicator = document.getElementById('autoSaveIndicator');
    if (!indicator) return;
    const icon = indicator.querySelector('.icon');
    const text = indicator.querySelector('.text');
    const retryBtn = document.getElementById('retrySaveBtn');

    indicator.classList.remove('saved', 'unsaved', 'saving', 'error');
    indicator.classList.add(status);
    if (retryBtn) retryBtn.style.display = status === 'error' ? 'inline' : 'none';

    if (status === 'saved') {
        const when = lastSaveTime ? formatTime(lastSaveTime) : formatTime(new Date());
        if (text) text.textContent = `Saved ${when}`;
        if (icon) icon.style.display = 'none';
        // Show success briefly; keep visible but green
        setTimeout(() => {
            // No-op: keep indicator visible for continuity
        }, 2000);
    } else if (status === 'saving') {
        if (text) text.textContent = 'Saving…';
        if (icon) icon.style.display = 'inline-block';
    } else if (status === 'unsaved') {
        if (text) text.textContent = 'Unsaved changes';
        if (icon) icon.style.display = 'none';
    } else if (status === 'error') {
        if (text) text.textContent = 'Save failed';
        if (icon) icon.style.display = 'none';
    }
}

function formatTime(date) {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Enhanced save/load functions
function saveProgressToStorage() {
    updateAutoSaveIndicator('saving');

    // Build session payload; support compact mode to reduce size on quota errors
    const buildSessionData = (compact = false) => ({
        timestamp: new Date().toISOString(),
        currentStep: ((typeof window !== 'undefined' && typeof window.currentStep !== 'undefined') ? window.currentStep : 'setup'),
        currentTraitIndex: currentTraitIndex,
        currentEvaluationLevel: currentEvaluationLevel,
        evaluationResults: evaluationResults,
        evaluationMeta: evaluationMeta,
        selectedDirectedComments: selectedDirectedComments,
        // Omit large blobs when compacting to fit quota
        directedCommentsData: compact ? {} : directedCommentsData,
        generatedSectionI: compact ? '' : generatedSectionI,
        navigationHistory: navigationHistory,
        isReportingSenior: isReportingSenior,
        allTraits: allTraits
    });

    try {
        const sessionData = buildSessionData(false);
        localStorage.setItem(STORAGE_KEYS.currentSession, JSON.stringify(sessionData));
        // Also save to session history
        saveToSessionHistory(sessionData);
        markChangesSaved();
        lastSavedSnapshot = sessionData;
        return true;
    } catch (error) {
        // Detect quota exceeded and attempt compact fallback
        const isQuota = (() => {
            try {
                return (
                    error && (
                        error.name === 'QuotaExceededError' ||
                        error.code === 22 ||
                        /quota/i.test(String(error.message || ''))
                    )
                );
            } catch (_) { return false; }
        })();
        if (isQuota) {
            try {
                const compact = buildSessionData(true);
                localStorage.setItem(STORAGE_KEYS.currentSession, JSON.stringify(compact));
                // Do not store full history when compacting
                markChangesSaved();
                showToast('Storage is full. Saved a compact snapshot; export recommended.', 'warning');
                return true;
            } catch (e2) {
                console.error('Compact save failed:', e2);
            }
        }
        console.error('Failed to save progress:', error);
        // Cache for recovery and queue if offline
        try { saveQueue.push({ ts: Date.now(), data: buildSessionData(true) }); } catch(_){}
        persistQueue();
        updateAutoSaveIndicator('error');
        showToast('Save failed. Try clearing old sessions or exporting.', 'error');
        return false;
    }
}

function loadProgressFromStorage() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEYS.currentSession);
        if (!savedData) return null;
        
        const sessionData = JSON.parse(savedData);
        
        // Validate data structure
        if (!sessionData.timestamp || !sessionData.evaluationMeta) {
            return null;
        }
        
        return sessionData;
    } catch (error) {
        console.error('Failed to load progress:', error);
        return null;
    }
}

function restoreSession(sessionData) {
    try {
        // Restore application state
        currentStep = sessionData.currentStep || 'setup';
        currentTraitIndex = sessionData.currentTraitIndex || 0;
        currentEvaluationLevel = sessionData.currentEvaluationLevel || 'B';
        evaluationResults = sessionData.evaluationResults || {};
        evaluationMeta = sessionData.evaluationMeta || {};
        selectedDirectedComments = sessionData.selectedDirectedComments || [];
        directedCommentsData = sessionData.directedCommentsData || {};
        generatedSectionI = sessionData.generatedSectionI || '';
        navigationHistory = sessionData.navigationHistory || ['setup'];
        isReportingSenior = sessionData.isReportingSenior || false;
        allTraits = sessionData.allTraits || [];
        validationState = sessionData.validationState || {};
        
        // Restore form fields
        if (evaluationMeta.marineName) {
            document.getElementById('marineNameInput').value = evaluationMeta.marineName;
        }
        if (evaluationMeta.fromDate) {
            document.getElementById('fromDateInput').value = evaluationMeta.fromDate;
        }
        if (evaluationMeta.toDate) {
            document.getElementById('toDateInput').value = evaluationMeta.toDate;
        }
        if (evaluationMeta.evaluatorName) {
            document.getElementById('evaluatorNameInput').value = evaluationMeta.evaluatorName;
        }
        if (isReportingSenior !== undefined) {
            document.getElementById('reportingSeniorSelect').value = isReportingSenior ? 'yes' : 'no';
        }
        
        // Restore Section I textarea
        if (evaluationMeta.sectionIComments) {
            const textarea = document.getElementById('sectionITextarea');
            if (textarea) {
                textarea.value = evaluationMeta.sectionIComments;
            }
        }
        
        // Navigate to current step (guard if navigation system is not loaded)
        if (typeof jumpToStep === 'function') {
            jumpToStep(currentStep);
        } else {
            try {
                // Fallback: show the appropriate card by id if available
                const map = {
                    setup: 'setupCard',
                    evaluation: 'evaluationContainer',
                    comments: 'directedCommentsCard',
                    sectionI: 'sectionIGenerationCard',
                    summary: 'summaryCard'
                };
                const targetId = map[currentStep] || 'setupCard';
                const cards = [
                    'setupCard','howItWorksCard','evaluationContainer',
                    'directedCommentsCard','sectionIGenerationCard','summaryCard'
                ];
                cards.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('active'); el.style.display = 'none'; } });
                const tgt = document.getElementById(targetId);
                if (tgt) { tgt.classList.add('active'); tgt.style.display = 'block'; }
            } catch (_) {}
        }
        
        // Update validation
        updateFormValidation();
        
        showToast('Session restored successfully!', 'success');
        markChangesSaved();
        
        return true;
    } catch (error) {
        console.error('Failed to restore session:', error);
        showToast('Failed to restore session. Starting fresh.', 'error');
        return false;
    }
}

function saveToSessionHistory(sessionData) {
    try {
        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionHistory) || '[]');
        
        // Add current session to history
        const historyEntry = {
            id: Date.now(),
            timestamp: sessionData.timestamp,
            marineName: sessionData.evaluationMeta?.marineName || 'Unknown',
            step: sessionData.currentStep,
            traitCount: Object.keys(sessionData.evaluationResults || {}).length,
            data: sessionData
        };
        
        history.unshift(historyEntry);
        
        // Keep only last 10 sessions
        history = history.slice(0, 10);
        
        localStorage.setItem(STORAGE_KEYS.sessionHistory, JSON.stringify(history));
    } catch (error) {
        console.error('Failed to save to session history:', error);
    }
}

function getSessionHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionHistory) || '[]');
    } catch (error) {
        console.error('Failed to load session history:', error);
        return [];
    }
}

// Session recovery
function checkForPreviousSession() {
    const savedSession = loadProgressFromStorage();
    
    if (savedSession) {
        const sessionTime = new Date(savedSession.timestamp);
        const now = new Date();
        const hoursSince = (now - sessionTime) / (1000 * 60 * 60);
        
        // Only offer recovery if session is less than 24 hours old
        if (hoursSince < 24) {
            showSessionRecoveryBanner(savedSession);
            return true;
        }
    }
    
    return false;
}

function showSessionRecoveryBanner(sessionData) {
    const banner = document.getElementById('sessionRecoveryBanner');
    if (!banner) return;
    
    const sessionTime = new Date(sessionData.timestamp).toLocaleString();
    const marineName = sessionData.evaluationMeta?.marineName || 'Unknown Marine';
    
    banner.querySelector('.recovery-text p').textContent = 
        `Found session for ${marineName} from ${sessionTime}`;
    
    banner.style.display = 'flex';
    
    // Store session data for recovery
    window.pendingSessionRestore = sessionData;
}

function recoverSession() {
    if (window.pendingSessionRestore) {
        restoreSession(window.pendingSessionRestore);
        dismissRecovery();
    }
}

function dismissRecovery() {
    const banner = document.getElementById('sessionRecoveryBanner');
    if (banner) {
        banner.style.display = 'none';
    }
    window.pendingSessionRestore = null;
}

// Export/Import functions
function exportToJSON() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        evaluationData: {
            evaluationMeta: evaluationMeta,
            evaluationResults: evaluationResults,
            selectedDirectedComments: selectedDirectedComments,
            directedCommentsData: directedCommentsData,
            generatedSectionI: generatedSectionI,
            isReportingSenior: isReportingSenior
        }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `fitrep_${evaluationMeta.marineName?.replace(/[^a-zA-Z0-9]/g, '_') || 'evaluation'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showToast('Evaluation data exported successfully!', 'success');
}

function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            if (importData.version && importData.evaluationData) {
                const data = importData.evaluationData;
                
                // Restore data
                evaluationMeta = data.evaluationMeta || {};
                evaluationResults = data.evaluationResults || {};
                selectedDirectedComments = data.selectedDirectedComments || [];
                directedCommentsData = data.directedCommentsData || {};
                generatedSectionI = data.generatedSectionI || '';
                isReportingSenior = data.isReportingSenior || false;
                
                // Restore UI
                restoreSession({
                    evaluationMeta: data.evaluationMeta,
                    currentStep: 'summary',
                    navigationHistory: ['setup', 'evaluation', 'comments', 'sectionI', 'summary']
                });
                
                showToast('Evaluation data imported successfully!', 'success');
            } else {
                throw new Error('Invalid file format');
            }
        } catch (error) {
            console.error('Import failed:', error);
            showToast('Failed to import file. Please check the file format.', 'error');
        }
    };
    
    reader.readAsText(file);
}

// Manual save/load functions
function saveProgress() {
    return performSaveWithRetry();
}

function loadProgress() {
    const savedSession = loadProgressFromStorage();
    if (savedSession) {
        if (confirm('This will replace your current progress. Continue?')) {
            restoreSession(savedSession);
        }
    } else {
        showToast('No saved progress found.', 'info');
    }
}

// Clear all data
function clearAllData() {
    if (confirm('This clears local data. Sync/export first? Continue?')) {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        showToast('All data cleared successfully.', 'success');
        location.reload();
    }
}

// Initialize persistence system
function initializePersistence() {
    initializeAutoSave();
    
    // Check for previous session on load
    setTimeout(() => {
        if (!checkForPreviousSession()) {
            // No previous session, hide loading overlay if present
            try {
                if (typeof hideLoadingOverlay === 'function') {
                    hideLoadingOverlay();
                } else {
                    const el = document.getElementById('loadingOverlay');
                    if (el) el.style.display = 'none';
                }
            } catch (_) {}
        }
    }, 1000);
}

// Expose manual retry/force save API
window.autoSave = {
    retryNow: () => performSaveWithRetry(),
    forceSave: () => { hasUnsavedChanges = true; return performSaveWithRetry(); }
};
function diffSession(prev, next) {
    const changed = {};
    Object.keys(next || {}).forEach(k => {
        const a = prev ? prev[k] : undefined;
        const b = next[k];
        const same = (() => {
            try { return JSON.stringify(a) === JSON.stringify(b); } catch(_) { return a === b; }
        })();
        if (!same) changed[k] = b;
    });
    return changed;
}

function persistQueue() {
    try { localStorage.setItem('fitrep_save_queue', JSON.stringify(saveQueue)); } catch(_){}
}

function loadQueue() {
    try { saveQueue = JSON.parse(localStorage.getItem('fitrep_save_queue')||'[]'); } catch(_) { saveQueue = []; }
}

async function flushSaveQueue() {
    loadQueue();
    if (!navigator.onLine || !saveQueue.length) return;
    const pending = [...saveQueue];
    saveQueue = [];
    for (const item of pending) {
        try {
            localStorage.setItem(STORAGE_KEYS.currentSession, JSON.stringify(item.data));
        } catch (e) {
            console.warn('Queue flush failed; requeue', e);
            saveQueue.push(item);
        }
    }
    persistQueue();
}

async function performSaveWithRetry(attempts = 3, baseDelayMs = 400) {
    let tryCount = 0;
    updateAutoSaveIndicator('saving');
    while (tryCount < attempts) {
        tryCount++;
        const ok = saveProgressToStorage();
        if (ok) return true;
        await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, tryCount-1)));
    }
    updateAutoSaveIndicator('error');
    return false;
}
