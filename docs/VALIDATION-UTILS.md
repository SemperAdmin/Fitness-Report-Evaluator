# Validation Utilities (Isomorphic)

Validation logic is centralized under `FormValidationCore` with shared messages to ensure consistency across client and server.

## Modules

- `js/formValidationCore.js`
  - Pure functions: `ValidationRules`, `parseRules`, `validateValue`, `errorMessageFor`, `validateField`, `validateFormPayload`.
  - UMD exports (`window.FormValidationCore` and `module.exports`).

- `js/shared/validation/messages.js`
  - Centralized error message generators used by `errorMessageFor` when present.

- `js/shared/validation/index.js`
  - Isomorphic entry that aggregates rules and messages for Node tests and server usage.

## Client Usage

```js
FormValidationUI.attachToContainer(modalEl, { submitButtonSelector: '#saveBtn' });
```

## Server/Tests Usage

```js
const { parseRules, validateField } = require('../js/shared/validation');
const rules = parseRules('required|minLength:3');
const res = validateField({ value: 'abc', label: 'Username', dataRules: rules });
```

## Consistent Messages

`FormValidationCore.errorMessageFor` prefers `window.ValidationMessages` to ensure consistent strings across implementations. If not present, it falls back to its built-in defaults.

