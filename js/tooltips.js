// Custom tooltip system with ARIA, keyboard support, and smart positioning
// Usage: add data-tooltip="Your text" to any focusable/hoverable element.
(function () {
  const STATE = {
    activeTrigger: null,
    showTimer: null,
    hideTimer: null,
    scrollHandler: null,
    outsideHandler: null,
    escapeHandler: null
  };

  const DEFAULTS = {
    showDelay: 200,
    hideDelay: 120,
    maxWidth: 280,
    position: 'auto' // top | bottom | left | right | auto
  };

  let tooltipEl = null;
  const TIP_ID = 'sa-tooltip';

  /**
   *
   */
  function ensureEl() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.id = TIP_ID;
    tooltipEl.className = 'sa-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.setAttribute('tabindex', '0');
    const inner = document.createElement('div');
    inner.className = 'sa-tooltip-inner';
    tooltipEl.appendChild(inner);
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  /**
   *
   * @param trigger
   */
  function getConfig(trigger) {
    const cfg = { ...DEFAULTS };
    const sd = parseInt(trigger.getAttribute('data-tooltip-delay') || '', 10);
    const hd = parseInt(trigger.getAttribute('data-tooltip-hide-delay') || '', 10);
    const mw = parseInt(trigger.getAttribute('data-tooltip-max-width') || '', 10);
    const pos = trigger.getAttribute('data-tooltip-pos');
    if (!Number.isNaN(sd)) cfg.showDelay = sd;
    if (!Number.isNaN(hd)) cfg.hideDelay = hd;
    if (!Number.isNaN(mw)) cfg.maxWidth = mw;
    if (pos) cfg.position = pos;
    return cfg;
  }

  /**
   *
   * @param trigger
   * @param cfg
   */
  function place(trigger, cfg) {
    const tip = ensureEl();
    const rect = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const margin = 8;
    let top = 0, left = 0;
    let chosen = cfg.position;

    if (cfg.position === 'auto') {
      const hasSpaceAbove = rect.top >= tipRect.height + margin;
      const hasSpaceBelow = (window.innerHeight - rect.bottom) >= tipRect.height + margin;
      chosen = hasSpaceAbove ? 'top' : (hasSpaceBelow ? 'bottom' : 'top');
    }

    if (chosen === 'top') {
      top = rect.top - tipRect.height - margin;
      left = rect.left + (rect.width - tipRect.width) / 2;
    } else if (chosen === 'bottom') {
      top = rect.bottom + margin;
      left = rect.left + (rect.width - tipRect.width) / 2;
    } else if (chosen === 'left') {
      top = rect.top + (rect.height - tipRect.height) / 2;
      left = rect.left - tipRect.width - margin;
    } else if (chosen === 'right') {
      top = rect.top + (rect.height - tipRect.height) / 2;
      left = rect.right + margin;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));

    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  /**
   *
   * @param trigger
   */
  function show(trigger) {
    const text = trigger.getAttribute('data-tooltip');
    if (!text) return;
    const tip = ensureEl();
    const inner = tip.querySelector('.sa-tooltip-inner');
    const cfg = getConfig(trigger);
    inner.textContent = text;
    tip.style.maxWidth = cfg.maxWidth + 'px';

    // Link ARIA
    trigger.setAttribute('aria-describedby', TIP_ID);

    // Animate with rAF to avoid layout thrash
    tip.classList.remove('hide');
    tip.classList.add('show');
    requestAnimationFrame(() => {
      place(trigger, cfg);
      tip.focus({ preventScroll: true });
    });

    // Bind dismissal handlers once
    STATE.scrollHandler = () => hide(trigger);
    STATE.outsideHandler = (e) => {
      if (!tip.contains(e.target) && e.target !== trigger) hide(trigger);
    };
    STATE.escapeHandler = (e) => { if (e.key === 'Escape') hide(trigger); };
    window.addEventListener('scroll', STATE.scrollHandler, { passive: true });
    document.addEventListener('click', STATE.outsideHandler, { capture: true });
    document.addEventListener('keydown', STATE.escapeHandler);
    STATE.activeTrigger = trigger;
  }

  /**
   *
   * @param trigger
   */
  function hide(trigger) {
    const tip = ensureEl();
    tip.classList.remove('show');
    tip.classList.add('hide');
    if (trigger) trigger.removeAttribute('aria-describedby');

    // Cleanup listeners to avoid leaks
    window.removeEventListener('scroll', STATE.scrollHandler);
    document.removeEventListener('click', STATE.outsideHandler, { capture: true });
    document.removeEventListener('keydown', STATE.escapeHandler);
    STATE.scrollHandler = STATE.outsideHandler = STATE.escapeHandler = null;
    STATE.activeTrigger = null;
  }

  /**
   *
   * @param trigger
   */
  function scheduleShow(trigger) {
    clearTimeout(STATE.showTimer);
    const cfg = getConfig(trigger);
    STATE.showTimer = setTimeout(() => show(trigger), cfg.showDelay);
  }

  /**
   *
   * @param trigger
   */
  function scheduleHide(trigger) {
    clearTimeout(STATE.hideTimer);
    const cfg = getConfig(trigger);
    STATE.hideTimer = setTimeout(() => hide(trigger), cfg.hideDelay);
  }

  // Delegated listeners for efficiency
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tooltip]');
    if (!t) return;
    scheduleShow(t);
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest('[data-tooltip]');
    if (!t) return;
    scheduleShow(t);
  });
  document.addEventListener('mouseout', (e) => {
    const t = e.target.closest('[data-tooltip]');
    if (!t) return;
    scheduleHide(t);
  });
  document.addEventListener('focusout', (e) => {
    const t = e.target.closest('[data-tooltip]');
    if (!t) return;
    scheduleHide(t);
  });

  // Expose minimal API if needed
  window.SATooltips = { show, hide };
})();

