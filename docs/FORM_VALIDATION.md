# Form Validation System

This project implements a reusable, accessible, and performant form validation system composed of two modules:

- `js/formValidationCore.js`: Pure validation utilities (rules, parsing, messages). Suitable for unit testing.
- `js/formValidationUI.js`: UI wiring for real-time validation, ARIA updates, inline error messages, success indicators, and submit gating.

## Features

- Real-time validation on `blur` and debounced `input` (default 300ms).
- Inline error messages directly under fields with `role="alert"` and `aria-live="polite"`.
- Clear invalid styling via `.is-invalid` and success indicators via `.is-valid` and `.valid-indicator`.
- Accessible attributes (`aria-invalid`, `aria-describedby`, `aria-live`) maintained automatically.
- Optional server-side validation hooks for critical fields.
- Submit button disabling when form invalid, with `aria-disabled` updates.
- Subtle animations for state transitions and success banners.

## Usage

Add `data-rules` to form inputs using pipe-delimited rules, e.g.:

```
<input class="form-input" id="editRsNameInput" data-rules="required|nameLabel" />
<input class="form-input" id="editRsRankInput" data-rules="required|rankLabel" />
```

Attach validation to a container (e.g., a modal):

```
FormValidationUI.attachToContainer(modalEl, {
  submitButtonSelector: '#saveProfileBtn',
  debounceMs: 300,
  serverValidators: {
    // Optional per-field async validators
    // 'editRsNameInput': async (value) => ({ valid: true, message: '' })
  },
  onFieldValidated: (field, result) => {
    // Optional callback after each validation
  }
});
```

Show a success banner after successful submission:

```
FormValidationUI.showSuccessBanner(containerEl, 'Profile updated successfully');
```

## Validation Rules

- `required`: Non-empty (trimmed).
- `minLength:n`: At least `n` characters.
- `maxLength:n`: At most `n` characters.
- `pattern:regex`: Matches a regular expression.
- `username`: 3–50 characters; letters, numbers, `.`, `_`, `-` only.
- `rankLabel`: 2–20 characters.
- `nameLabel`: 2–100 characters.

## Accessibility

- Error messages use `role="alert"` and `aria-live="polite"` for screen readers.
- Fields set `aria-invalid` and point `aria-describedby` to the message element.
- Success banners use `role="status"` and `aria-live="polite"`.

## Performance

- Debounced input validation to reduce work during typing.
- Minimal DOM writes and reads per validation cycle; UI updates are batched.
- Avoid layout thrashing by limiting style recalculations.

## Background Scroll Prevention

Modal opening applies a body scroll lock that preserves the current scroll position (including mobile) and blocks touch scrolling outside the modal.

## Testing

- Core rules and messages are covered in `tests/formValidationCore.test.js`.
- Modal stacking behavior covered in `tests/modalController.test.js`.

