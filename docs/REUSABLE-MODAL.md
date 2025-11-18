# Reusable Modal Component and Manager

This project now uses a centralized modal manager with a reusable factory to eliminate duplicated modal implementations and standardize behavior.

## API

- `ModalController.register(id, config)`
  - Stores default options for a modal: `{ labelledBy, describedBy, focusFirst, closeOnBackdrop }`.

- `ModalController.create(opts)`
  - Creates a standard modal structure and appends it to `document.body`.
  - Options: `{ id, title, content, closeLabel, className, labelledBy, describedBy, focusFirst, attributes }`.

- `ModalController.openById(id, options?)`
  - Opens a modal by `id`, merges `options` with registered defaults, applies backdrop, focus, ARIA, and body lock.

- `ModalController.closeById(id)`
  - Closes modal, removes its backdrop, restores focus and body lock when none remain.

- `ModalController.closeAll()`
  - Closes all modals, removes orphaned backdrops, and resets body lock.

## Usage

```js
// Register semantics for an existing modal markup
ModalController.register('helpModal', { labelledBy: 'helpModalTitle', focusFirst: '.help-close' });

// Open/Close
ModalController.openById('helpModal');
ModalController.closeById('helpModal');

// Create a new reusable modal
ModalController.create({
  id: 'myModal',
  title: 'Example',
  content: '<p>Hello</p>',
  focusFirst: 'button.sa-modal-close'
});
ModalController.openById('myModal');
```

## Backward Compatibility

- Existing calls such as `openHelpModal()` and manual class toggles continue to work through shims.
- If `ModalController` is unavailable, functions gracefully fall back to previous behaviors.

