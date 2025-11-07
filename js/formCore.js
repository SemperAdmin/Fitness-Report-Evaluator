// UMD module exposing form state core: reducer, actions, selectors
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FormCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = 'v1';

  const defaultSteps = [
    { id: 'setup', title: 'Setup' },
    { id: 'details', title: 'Details' },
    { id: 'review', title: 'Review' }
  ];

  function createInitialState(opts = {}) {
    const steps = Array.isArray(opts.steps) && opts.steps.length ? opts.steps : defaultSteps;
    const fieldsByStep = opts.fieldsByStep || {};
    const initStep = steps[0]?.id || 'setup';
    const now = new Date().toISOString();
    const stepsState = steps.map(s => ({
      id: s.id,
      title: s.title || s.id,
      valid: false,
      completed: false,
      fields: Object.fromEntries(Object.entries(fieldsByStep[s.id] || {}).map(([fid, def]) => [fid, {
        value: def?.value ?? '',
        error: '',
        valid: !!def?.valid,
      }]))
    }));
    return {
      version: VERSION,
      steps: stepsState,
      currentStepId: initStep,
      lastSavedAt: null,
      createdAt: now,
      dirty: false,
      reevalTick: 0,
      errors: []
    };
  }

  // Validators and dependencies can be provided at runtime; keep defaults minimal
  const validators = {
    // Example: simple required validator; consumers can override/extend
    required: (val) => (val != null && String(val).trim().length > 0) ? '' : 'This field is required.'
  };

  // Dependency graph structure: { [fieldKey]: [{ target: 'otherFieldKey', compute: (state) => value }] }
  function applyDependencies(state, dependencies) {
    try {
      const current = getCurrentStep(state);
      const fields = current?.fields || {};
      Object.keys(fields).forEach(srcKey => {
        const list = (dependencies && dependencies[srcKey]) || [];
        list.forEach(dep => {
          try {
            const nextVal = dep.compute(state);
            const tgt = dep.target;
            if (tgt && current.fields[tgt] && current.fields[tgt].value !== nextVal) {
              current.fields[tgt].value = nextVal;
              current.fields[tgt].valid = true;
              current.fields[tgt].error = '';
              state.dirty = true;
            }
          } catch (_) {}
        });
      });
    } catch (_) {}
    state.reevalTick++;
    return state;
  }

  function getCurrentStep(state) {
    return state.steps.find(s => s.id === state.currentStepId) || state.steps[0];
  }

  function serializeState(state) {
    return JSON.stringify(state);
  }
  function deserializeState(json) {
    try {
      const obj = JSON.parse(json);
      if (!obj || obj.version !== VERSION) return null;
      return obj;
    } catch (_) {
      return null;
    }
  }

  // Action types
  const types = {
    INIT: 'form/INIT',
    UPDATE_FIELD: 'form/UPDATE_FIELD',
    VALIDATE_STEP: 'form/VALIDATE_STEP',
    GO_TO_STEP: 'form/GO_TO_STEP',
    LOAD_STATE: 'form/LOAD_STATE',
    SAVE_STATE: 'form/SAVE_STATE',
    SET_ERROR: 'form/SET_ERROR',
    CLEAR_ERROR: 'form/CLEAR_ERROR',
    APPLY_DEPENDENCIES: 'form/APPLY_DEPENDENCIES'
  };

  function reducer(state = createInitialState(), action = {}) {
    switch (action.type) {
      case types.INIT: {
        const next = createInitialState(action.payload || {});
        return next;
      }
      case types.LOAD_STATE: {
        const loaded = action.payload;
        if (loaded && loaded.version) return loaded;
        return state;
      }
      case types.UPDATE_FIELD: {
        const { stepId, fieldId, value } = action.payload || {};
        const step = state.steps.find(s => s.id === stepId) || getCurrentStep(state);
        if (!step || !step.fields[fieldId]) return state;
        step.fields[fieldId].value = value;
        step.fields[fieldId].valid = true; // optimistic; validators may adjust
        step.fields[fieldId].error = '';
        state.dirty = true;
        return state;
      }
      case types.VALIDATE_STEP: {
        const { stepId, rules } = action.payload || {};
        const step = state.steps.find(s => s.id === stepId) || getCurrentStep(state);
        if (!step) return state;
        let allValid = true;
        (rules || []).forEach(rule => {
          const f = step.fields[rule.fieldId];
          if (!f) return;
          const err = (typeof rule.validate === 'function') ? rule.validate(f.value, state) : '';
          f.error = err || '';
          f.valid = !err;
          if (err) allValid = false;
        });
        step.valid = allValid;
        step.completed = allValid ? step.completed || true : false;
        return state;
      }
      case types.GO_TO_STEP: {
        const { stepId } = action.payload || {};
        if (!state.steps.some(s => s.id === stepId)) return state;
        state.currentStepId = stepId;
        return state;
      }
      case types.SAVE_STATE: {
        state.lastSavedAt = new Date().toISOString();
        state.dirty = false;
        return state;
      }
      case types.SET_ERROR: {
        const msg = action.payload && action.payload.message ? String(action.payload.message) : 'Invalid state';
        state.errors = Array.isArray(state.errors) ? [...state.errors, msg] : [msg];
        return state;
      }
      case types.CLEAR_ERROR: {
        state.errors = [];
        return state;
      }
      case types.APPLY_DEPENDENCIES: {
        const deps = action.payload && action.payload.dependencies ? action.payload.dependencies : {};
        return applyDependencies(state, deps);
      }
      default:
        return state;
    }
  }

  const selectors = {
    getCurrentStep,
    getProgressPercent: (state) => {
      const total = state.steps.length || 1;
      const completed = state.steps.filter(s => s.completed).length;
      return Math.round((completed / total) * 100);
    },
    isDirty: (state) => !!state.dirty,
    getErrors: (state) => state.errors || []
  };

  return {
    VERSION,
    createInitialState,
    reducer,
    types,
    selectors,
    validators,
    serializeState,
    deserializeState
  };
});
