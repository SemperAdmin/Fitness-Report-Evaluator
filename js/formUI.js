// Minimal UI bindings: progress indicator, step nav, re-evaluation feedback
(function () {
  if (!window.FormStore || !window.FormCore) return;

  /**
   *
   * @param id
   */
  function qs(id) { return document.getElementById(id); }
  const progressFill = qs('progressFill');
  const progressText = qs('progressText');
  const autoSaveIndicator = qs('autoSaveIndicator');

  /**
   *
   * @param state
   */
  function renderState(state) {
    const percent = FormCore.selectors.getProgressPercent(state);
    if (progressFill) {
      progressFill.style.width = percent + '%';
    }
    if (progressText) {
      const cur = FormCore.selectors.getCurrentStep(state);
      const label = (cur && cur.title) ? cur.title : 'Step';
      progressText.textContent = label + ' - ' + percent + '%';
    }
    if (autoSaveIndicator) {
      // If persistence manages indicator, only update last saved text subtly
      if (autoSaveIndicator.classList && autoSaveIndicator.classList.contains('managed')) {
        const textEl = autoSaveIndicator.querySelector('.text');
        if (textEl && state.lastSavedAt) {
          try {
            const when = new Date(state.lastSavedAt);
            textEl.textContent = 'Saved ' + when.toLocaleTimeString();
            autoSaveIndicator.classList.remove('unsaved', 'saving', 'error');
            autoSaveIndicator.classList.add('saved');
          } catch (_) {}
        }
      } else {
        autoSaveIndicator.style.visibility = state.lastSavedAt ? 'visible' : 'hidden';
        autoSaveIndicator.textContent = state.lastSavedAt ? '✓ Auto-saved' : 'Saving…';
      }
    }
  }

  window.addEventListener('form:state', (e) => {
    renderState(e.detail);
  });

  // Expose navigation helpers for critical confirmations and validation gating
  window.FormNav = {
    canNavigate(targetStepId) {
      const state = FormStore.store.getState();
      const cur = FormCore.selectors.getCurrentStep(state);
      const hasErrors = Object.values(cur.fields || {}).some(f => !!f.error);
      if (hasErrors) {
        if (typeof showToast === 'function') showToast('Please fix errors before navigating.', 'warning');
        return false;
      }
      return true;
    },
    confirmLeave() {
      const state = FormStore.store.getState();
      if (FormCore.selectors.isDirty(state)) {
        return window.confirm('You have unsaved changes. Navigate anyway?');
      }
      return true;
    }
  };

  // Initial render
  renderState(FormStore.store.getState());
})();
