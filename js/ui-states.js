// Simple button state utilities with accessible attributes
// Provides loading/disabled state management with visual hooks

(function () {
  // Button state helpers
  function setLoading(btn, loading) {
    if (!btn) return;
    const isLoading = Boolean(loading);
    btn.classList.toggle('is-loading', isLoading);
    btn.setAttribute('aria-busy', String(isLoading));
    // Prevent accidental double clicks when loading
    btn.disabled = isLoading || btn.dataset.forceDisabled === 'true';
  }

  function setDisabled(btn, disabled) {
    if (!btn) return;
    const isDisabled = Boolean(disabled);
    btn.classList.toggle('is-disabled', isDisabled);
    btn.disabled = isDisabled;
    btn.setAttribute('aria-disabled', String(isDisabled));
  }

  // Helper to wrap async actions with loading state
  async function withLoading(btn, fn) {
    try {
      setLoading(btn, true);
      return await fn();
    } finally {
      setLoading(btn, false);
    }
  }

  // (Removed global overlay and skeleton helpers to revert to original minimal utilities)

  // Unsaved changes tracking (lightweight fallback if FormStore/FormCore are absent)
  let dirty = false;
  function markDirty() { dirty = true; document.body.classList.add('has-unsaved'); }
  function clearDirty() { dirty = false; document.body.classList.remove('has-unsaved'); }
  function hasUnsavedChanges() {
    try {
      if (window.FormStore && window.FormCore) {
        const state = window.FormStore.store.getState();
        return window.FormCore.selectors.isDirty(state);
      }
    } catch (_) {}
    return dirty;
  }

  function initDirtyTracking(root = document) {
    const fields = root.querySelectorAll('input, textarea, select');
    fields.forEach(el => {
      el.addEventListener('input', markDirty, { passive: true });
      el.addEventListener('change', markDirty, { passive: true });
    });
  }

  function guardNavigation() {
    try {
      if (window.FormNav && typeof window.FormNav.confirmLeave === 'function') {
        return window.FormNav.confirmLeave();
      }
    } catch (_) {}
    if (hasUnsavedChanges()) {
      return window.confirm('You have unsaved changes. Navigate anyway?');
    }
    return true;
  }

  // Expose globally
  window.UIStates = {
    setLoading, setDisabled, withLoading,
    initDirtyTracking, markDirty, clearDirty, hasUnsavedChanges, guardNavigation
  };
})();
