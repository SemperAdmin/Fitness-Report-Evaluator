// Feedback Widget with Accessible Modal and Secure Submission
// Implements: XSS-safe DOM creation, input sanitization, privacy warnings,
// keyboard interactions, and POST /api/feedback integration.

(function () {
  'use strict';

  const FEEDBACK_TYPES = [
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'ux', label: 'UX Suggestion' }
  ];

  const state = {
    modalOpen: false,
    lastFocused: null
  };

  const sanitizeString = (str) => {
    if (!str) return '';
    return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  };

  const captureContext = () => {
    try {
      const ua = navigator.userAgent || '';
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const viewport = `${Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)}x${Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)}`;
      const route = location.href;
      const ts = new Date().toISOString();
      // Basic theme detection (heuristic)
      const dark = (() => {
        try {
          return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (_) { return false; }
      })();
      return { userAgent: ua, screen: screenRes, viewport, route, timestamp: ts, theme: dark ? 'dark' : 'light' };
    } catch (_) {
      return { timestamp: new Date().toISOString() };
    }
  };

  function createEl(tag, attrs, text) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const val = attrs[k];
        if (k === 'className') el.className = val;
        else if (k === 'dataset' && val && typeof val === 'object') {
          Object.keys(val).forEach((dk) => { el.dataset[dk] = String(val[dk]); });
        } else if (k === 'style' && val && typeof val === 'object') {
          Object.assign(el.style, val);
        } else {
          el.setAttribute(k, String(val));
        }
      });
    }
    if (text != null) {
      el.textContent = String(text);
    }
    return el;
  }

  // Build modal DOM once and keep references
  const buildFeedbackUI = () => {
    // Floating button
    const btn = createEl('button', {
      id: 'feedbackFloatingBtn',
      class: 'feedback-floating-btn',
      type: 'button',
      'aria-label': 'Open feedback form'
    }, 'Feedback');

    // Backdrop + modal panel
    const wrapper = createEl('div', { id: 'feedbackModalWrapper', class: 'feedback-modal-wrapper', style: { display: 'none' } });
    const backdrop = createEl('div', { class: 'feedback-backdrop' });
    const panel = createEl('div', {
      class: 'feedback-modal',
      role: 'dialog',
      'aria-modal': 'true'
    });

    const titleId = 'feedbackModalTitle';
    const descId = 'feedbackEmailHelp';
    const title = createEl('h2', { id: titleId, class: 'feedback-title' }, 'Submit Feedback');
    panel.setAttribute('aria-labelledby', titleId);

    const closeBtn = createEl('button', { class: 'feedback-close', type: 'button', 'aria-label': 'Close feedback form' }, '×');

    // Form
    const form = createEl('form', { id: 'feedbackForm' });

    const rowType = createEl('div', { class: 'feedback-row' });
    const labelType = createEl('label', { for: 'feedbackType' }, 'Feedback Type');
    const selectType = createEl('select', { id: 'feedbackType', name: 'type', required: 'true' });
    FEEDBACK_TYPES.forEach((opt) => {
      const o = createEl('option', { value: opt.value }, opt.label);
      selectType.appendChild(o);
    });
    rowType.appendChild(labelType);
    rowType.appendChild(selectType);

    const rowTitle = createEl('div', { class: 'feedback-row' });
    const labelTitle = createEl('label', { for: 'feedbackTitle' }, 'Title');
    const inputTitle = createEl('input', { id: 'feedbackTitle', name: 'title', type: 'text', maxlength: '200', required: 'true', placeholder: 'Short summary (max 200 chars)' });
    rowTitle.appendChild(labelTitle);
    rowTitle.appendChild(inputTitle);

    const rowDesc = createEl('div', { class: 'feedback-row' });
    const labelDesc = createEl('label', { for: 'feedbackDescription' }, 'Description');
    const textareaDesc = createEl('textarea', { id: 'feedbackDescription', name: 'description', maxlength: '50000', required: 'true', rows: '6', placeholder: 'Describe the issue or suggestion (max 50,000 chars)' });
    rowDesc.appendChild(labelDesc);
    rowDesc.appendChild(textareaDesc);

    const rowEmail = createEl('div', { class: 'feedback-row' });
    const labelEmail = createEl('label', { for: 'feedbackEmail' }, 'Email (Optional - will be public in GitHub issue)');
    const inputEmail = createEl('input', { id: 'feedbackEmail', name: 'email', type: 'email', placeholder: 'your@email.mil (visible publicly)' });
    const emailHelp = createEl('div', { id: descId, class: 'feedback-help' }, '⚠️ Your email will be visible in the public GitHub issue');
    inputEmail.setAttribute('aria-describedby', descId);
    rowEmail.appendChild(labelEmail);
    rowEmail.appendChild(inputEmail);
    rowEmail.appendChild(emailHelp);

    const status = createEl('div', { id: 'feedbackStatus', class: 'feedback-status', role: 'status', 'aria-live': 'polite' }, '');

    const actions = createEl('div', { class: 'feedback-actions' });
    const submitBtn = createEl('button', { type: 'submit', class: 'feedback-submit' }, 'Submit');
    const cancelBtn = createEl('button', { type: 'button', class: 'feedback-cancel' }, 'Cancel');
    actions.appendChild(submitBtn);
    actions.appendChild(cancelBtn);

    form.appendChild(rowType);
    form.appendChild(rowTitle);
    form.appendChild(rowDesc);
    form.appendChild(rowEmail);
    form.appendChild(actions);

    panel.appendChild(closeBtn);
    panel.appendChild(title);
    panel.appendChild(form);
    panel.appendChild(status);
    wrapper.appendChild(backdrop);
    wrapper.appendChild(panel);

    document.body.appendChild(btn);
    document.body.appendChild(wrapper);

    // Handlers
    btn.addEventListener('click', () => openModal(wrapper, panel));
    closeBtn.addEventListener('click', () => closeModal(wrapper));
    cancelBtn.addEventListener('click', () => closeModal(wrapper));
    backdrop.addEventListener('click', () => closeModal(wrapper));
    document.addEventListener('keydown', (e) => {
      if (!state.modalOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(wrapper);
      }
      if (e.key === 'Tab') {
        trapFocus(panel, e);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = '';

      const type = sanitizeString(selectType.value || '');
      const title = sanitizeString(inputTitle.value || '').substring(0, 200);
      const description = sanitizeString(textareaDesc.value || '').substring(0, 50000);
      const email = sanitizeString(inputEmail.value || '').substring(0, 200);

      if (!type || !title || !description) {
        status.textContent = 'Please complete required fields.';
        return;
      }

      const ctx = captureContext();
      const payload = { type, title, description, email, context: ctx };

      try {
        const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
        const FEEDBACK_ROUTE = (window.CONSTANTS?.ROUTES?.API?.FEEDBACK) || '/api/feedback';
        const url = base ? new URL(FEEDBACK_ROUTE, base).toString() : FEEDBACK_ROUTE;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          status.textContent = 'Submission failed. Please try again later.';
          return;
        }
        const data = await resp.json();
        status.textContent = 'Feedback submitted successfully.';
        // If issue URL provided, append safe link
        if (data && data.issueUrl) {
          const link = createEl('a', { href: String(data.issueUrl), target: '_blank', rel: 'noopener noreferrer' }, 'View GitHub Issue');
          status.appendChild(createEl('span', null, ' '));
          status.appendChild(link);
        }
        // Reset form
        form.reset();
        // Close after a small delay for UX
        setTimeout(() => closeModal(wrapper), 800);
      } catch (_) {
        status.textContent = 'Network error submitting feedback.';
      }
    });
  };

  function openModal(wrapper, panel) {
    state.modalOpen = true;
    state.lastFocused = document.activeElement;
    wrapper.style.display = 'block';
    document.body.classList.add('feedback-modal-open');
    // Focus first input
    const firstInput = panel.querySelector('input, select, textarea, button');
    if (firstInput) firstInput.focus();
  }

  function closeModal(wrapper) {
    state.modalOpen = false;
    wrapper.style.display = 'none';
    document.body.classList.remove('feedback-modal-open');
    try { if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus(); } catch (_) {}
  }

  function trapFocus(container, e) {
    const focusable = container.querySelectorAll('a[href], button, textarea, input, select');
    const focusables = Array.prototype.slice.call(focusable).filter(el => !el.disabled && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Initialize after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildFeedbackUI);
  } else {
    buildFeedbackUI();
  }
})();
