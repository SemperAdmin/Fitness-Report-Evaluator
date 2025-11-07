// Simple button state utilities with accessible attributes
// Provides loading/disabled state management with visual hooks

(function () {
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

  // Expose globally
  window.UIStates = { setLoading, setDisabled, withLoading };
})();

