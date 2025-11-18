// Centralized validation messages for consistency across implementations
// UMD-style export to support both browser and Node
(function(){
  const ValidationMessages = {
    required: (label) => `${label} is required.`,
    minLength: (label, n) => `${label} must be at least ${n} characters.`,
    maxLength: (label, n) => `${label} must be at most ${n} characters.`,
    username: (label) => `${label} must be 3–50 chars; letters, numbers, . _ - only.`,
    rankLabel: (label) => `${label} must be 2–20 characters.`,
    nameLabel: (label) => `${label} must be 2–100 characters.`,
    pattern: (label) => `${label} has an invalid format.`,
    default: (label) => `${label} is invalid.`,
  };

  try { window.ValidationMessages = ValidationMessages; } catch (_) {}
  if (typeof module !== 'undefined') {
    module.exports = { ValidationMessages };
  }
})();

