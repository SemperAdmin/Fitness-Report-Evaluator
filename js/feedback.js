// Feedback Button - Navigates to Sentinel Directives Hub
(function () {
  'use strict';

  const FEEDBACK_URL = 'https://semperadmin.github.io/Sentinel/#detail/fitness-report-evaluator/todo';

  function createFeedbackButton() {
    const btn = document.createElement('button');
    btn.id = 'feedbackFloatingBtn';
    btn.className = 'feedback-floating-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Share Feedback');
    btn.title = 'Share Feedback';
    btn.textContent = 'Feedback';

    btn.addEventListener('click', () => {
      window.location.href = FEEDBACK_URL;
    });

    document.body.appendChild(btn);
  }

  // Initialize after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFeedbackButton);
  } else {
    createFeedbackButton();
  }
})();
