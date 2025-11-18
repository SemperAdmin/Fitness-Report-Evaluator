// Core form validation utilities: pure functions suitable for unit testing
// Provides rule parsing, validators, and error message generation.

// UMD-style export: attach to window and CommonJS for tests
(function(){
  const ValidationRules = {
  required: (value) => {
    const v = String(value ?? '').trim();
    return v.length > 0;
  },
  minLength: (value, len) => {
    const v = String(value ?? '');
    const n = Number(len) || 0;
    return v.trim().length >= n;
  },
  maxLength: (value, len) => {
    const v = String(value ?? '');
    const n = Number(len) || Infinity;
    return v.trim().length <= n;
  },
  pattern: (value, regexSource) => {
    try {
      const re = new RegExp(regexSource);
      return re.test(String(value ?? ''));
    } catch (_) {
      return true; // ignore bad patterns
    }
  },
  username: (value) => {
    const v = String(value ?? '').trim();
    if (v.length < 3 || v.length > 50) return false;
    return /^[a-zA-Z0-9._-]+$/.test(v);
  },
  rankLabel: (value) => {
    const v = String(value ?? '').trim();
    return v.length >= 2 && v.length <= 20;
  },
  nameLabel: (value) => {
    const v = String(value ?? '').trim();
    return v.length >= 2 && v.length <= 100;
  }
  };

  function parseRules(dataRules) {
  // data-rules="required|minLength:2|maxLength:20"
  if (!dataRules) return [];
  return String(dataRules)
    .split('|')
    .map(r => r.trim())
    .filter(Boolean)
    .map(rule => {
      const [name, ...rest] = rule.split(':');
      const params = rest.length ? rest.join(':').split(',') : [];
      return { name, params };
    });
  }

  function validateValue(value, rules = []) {
  let isValid = true;
  let failedRule = null;
  for (const r of rules) {
    const fn = ValidationRules[r.name];
    if (typeof fn === 'function') {
      const ok = fn(value, ...(r.params || []));
      if (!ok) { isValid = false; failedRule = r; break; }
    }
  }
  return { isValid, failedRule };
  }

  function errorMessageFor(fieldLabel, rule) {
  const label = String(fieldLabel || 'Field');
  const name = rule?.name || 'required';
  const p = rule?.params || [];
  // Prefer centralized messages when available
  const messages = (typeof window !== 'undefined' && window.ValidationMessages) || null;
  if (messages) {
    try {
      switch (name) {
        case 'required': return messages.required(label);
        case 'minLength': return messages.minLength(label, Number(p[0] || 0));
        case 'maxLength': return messages.maxLength(label, Number(p[0] || 0));
        case 'username': return messages.username(label);
        case 'rankLabel': return messages.rankLabel(label);
        case 'nameLabel': return messages.nameLabel(label);
        case 'pattern': return messages.pattern(label);
        default: return messages.default(label);
      }
    } catch (_) {}
  }
  // Fallback to built-in messages
  switch (name) {
    case 'required':
      return `${label} is required.`;
    case 'minLength': {
      const n = Number(p[0] || 0);
      return `${label} must be at least ${n} characters.`;
    }
    case 'maxLength': {
      const n = Number(p[0] || 0);
      return `${label} must be at most ${n} characters.`;
    }
    case 'username':
      return `${label} must be 3–50 chars; letters, numbers, . _ - only.`;
    case 'rankLabel':
      return `${label} must be 2–20 characters.`;
    case 'nameLabel':
      return `${label} must be 2–100 characters.`;
    case 'pattern':
      return `${label} has an invalid format.`;
    default:
      return `${label} is invalid.`;
  }
  }

// Validate a single field value with labeled rules
  function validateField({ value, label, dataRules }) {
  const rules = Array.isArray(dataRules) ? dataRules : parseRules(dataRules);
  const { isValid, failedRule } = validateValue(value, rules);
  return {
    valid: isValid,
    message: isValid ? '' : errorMessageFor(label, failedRule)
  };
  }

// Validate all fields in a payload object: { fieldName: { value, label, dataRules } }
  function validateFormPayload(payload) {
  const result = { valid: true, fields: {}, messages: [] };
  for (const [key, meta] of Object.entries(payload || {})) {
    const v = validateField(meta);
    result.fields[key] = v;
    if (!v.valid) { result.valid = false; result.messages.push(v.message); }
  }
  return result;
  }

  // Export
  try { window.FormValidationCore = { ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload }; } catch (_) {}
  if (typeof module !== 'undefined') {
    module.exports = { ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload };
  }
})();
