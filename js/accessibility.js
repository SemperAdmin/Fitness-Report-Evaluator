// Accessibility and form helpers: required indicators and focus management
(function () {
  function initRequiredIndicators(root = document) {
    const groups = root.querySelectorAll('.form-group');
    groups.forEach(group => {
      const label = group.querySelector('.form-label');
      const field = group.querySelector('input, select, textarea');
      if (!label || !field) return;
      const isRequired = field.hasAttribute('required') || field.getAttribute('aria-required') === 'true' || group.classList.contains('required');
      if (!isRequired) return;
      if (!label.querySelector('.required-indicator')) {
        const span = document.createElement('span');
        span.className = 'required-indicator';
        span.textContent = '*';
        label.appendChild(span);
      }
      group.classList.add('required');
      field.setAttribute('aria-required', 'true');
    });
  }

  function focusFirstInteractive(root) {
    const sel = 'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';
    const el = root.querySelector(sel);
    if (el) { try { el.focus(); } catch (_) {} }
  }

  // Auto-init on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    initRequiredIndicators(document);
    if (window.UIStates && typeof window.UIStates.initDirtyTracking === 'function') {
      try { window.UIStates.initDirtyTracking(document); } catch (_) {}
    }
  });

  window.A11y = { initRequiredIndicators, focusFirstInteractive };
})();

