// Form store wiring using Redux (UMD via jsDelivr) and FormCore
(function () {
  const STORAGE_KEY = 'FORM_STATE_V1';
  const SESSION_KEY = 'FORM_STATE_SESSION_V1';

  function safeShowToast(msg, type) {
    try { if (typeof window.showToast === 'function') window.showToast(msg, type || 'info'); } catch (_) {}
  }

  function getRedux() {
    if (typeof Redux !== 'undefined' && Redux && typeof Redux.createStore === 'function') return Redux;
    console.error('Redux global not found. Ensure CDN script is loaded.');
    return null;
  }

  function loadPersisted() {
    try {
      const json = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!json) return null;
      return FormCore && typeof FormCore.deserializeState === 'function' ? FormCore.deserializeState(json) : JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function serialize(state) {
    try { return FormCore.serializeState(state); } catch (_) { return JSON.stringify(state); }
  }

  function persistState(state) {
    const payload = serialize(state);
    try {
      localStorage.setItem(STORAGE_KEY, payload);
      sessionStorage.setItem(SESSION_KEY, payload);
      return true;
    } catch (err) {
      if (err && err.name === 'QuotaExceededError') {
        // Try compact save: omit big blobs if any
        const compact = JSON.stringify({
          version: state.version,
          steps: state.steps.map(s => ({ id: s.id, valid: s.valid, completed: s.completed })),
          currentStepId: state.currentStepId,
          lastSavedAt: new Date().toISOString(),
          dirty: false
        });
        try {
          localStorage.setItem(STORAGE_KEY, compact);
          sessionStorage.setItem(SESSION_KEY, compact);
          safeShowToast('Saved a compact version due to storage limits.', 'warning');
          return true;
        } catch (err2) {
          safeShowToast('Unable to save progress. Consider clearing storage.', 'error');
          return false;
        }
      }
      safeShowToast('Save error: ' + (err?.message || 'Unknown'), 'error');
      return false;
    }
  }

  function createStore() {
    const redux = getRedux();
    if (!redux || !FormCore) return null;
    const preloaded = loadPersisted();
    const store = redux.createStore(FormCore.reducer, preloaded || FormCore.createInitialState());
    let saveTimer = null;
    store.subscribe(() => {
      const state = store.getState();
      // Update UI and autosave throttled
      if (state.dirty) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          if (persistState(state)) {
            store.dispatch({ type: FormCore.types.SAVE_STATE });
            safeShowToast('Progress saved', 'success');
          }
        }, 1200);
      }
      // Broadcast for UI layer
      try { window.dispatchEvent(new CustomEvent('form:state', { detail: state })); } catch (_) {}
    });
    // Expose helpers
    const api = {
      store,
      updateField(stepId, fieldId, value, deps) {
        store.dispatch({ type: FormCore.types.UPDATE_FIELD, payload: { stepId, fieldId, value } });
        store.dispatch({ type: FormCore.types.APPLY_DEPENDENCIES, payload: { dependencies: deps || {} } });
      },
      validateStep(stepId, rules) {
        store.dispatch({ type: FormCore.types.VALIDATE_STEP, payload: { stepId, rules: rules || [] } });
      },
      goToStep(stepId) {
        store.dispatch({ type: FormCore.types.GO_TO_STEP, payload: { stepId } });
      },
      restore() {
        const loaded = loadPersisted();
        if (loaded) {
          store.dispatch({ type: FormCore.types.LOAD_STATE, payload: loaded });
          safeShowToast('Restored previous progress', 'info');
        }
      }
    };
    return api;
  }

  // Initialize immediately
  window.FormStore = createStore();
})();

