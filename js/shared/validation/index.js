// Isomorphic validation entry: aggregates rules and messages
(function(){
  let ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload;
  try {
    // Browser globals
    const core = (typeof window !== 'undefined' && window.FormValidationCore) || null;
    if (core) ({ ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload } = core);
    // Ensure messages are loaded
    if (typeof window !== 'undefined' && !window.ValidationMessages) {
      console.warn('[validation] ValidationMessages not found; using defaults from core');
    }
  } catch (_) {}

  try {
    // Node/CommonJS
    if (typeof module !== 'undefined') {
      const core = require('../../formValidationCore.js');
      ({ ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload } = core);
      try { require('./messages.js'); } catch (_) {}
      module.exports = { ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload };
    }
  } catch (_) {}
})();

