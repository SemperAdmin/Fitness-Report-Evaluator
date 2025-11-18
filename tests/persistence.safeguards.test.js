const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Browser-like globals
global.window = global;
global.document = {
  getElementById: () => null,
  body: { appendChild: () => {} }
};
global.navigator = { onLine: true };
global.fetch = async () => ({ ok: true });
global.showToast = () => {};

// localStorage stub
const _store = new Map();
global.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }
};

function requireScript(relPath) {
  const code = fs.readFileSync(relPath, 'utf8');
  vm.runInThisContext(code, { filename: relPath });
}

// Load ErrorLogger first to ensure logging stubs are present
requireScript(path.join(__dirname, '..', 'js', 'errorLogger.js'));

// Ensure no globals exist to simulate encapsulation migration
if (typeof global.currentTraitIndex !== 'undefined') {
  throw new Error('Test setup: currentTraitIndex should be undefined');
}
if (typeof global.Evaluation !== 'undefined') {
  // Explicitly remove to test fallback behavior
  global.Evaluation = undefined;
}

// Load persistence module
requireScript(path.join(__dirname, '..', 'js', 'persistence.js'));

if (!global.autoSave || typeof global.autoSave.forceSave !== 'function') {
  throw new Error('autoSave API missing');
}

(async () => {
  // Invoke force save to trigger buildSessionData in a no-global state
  const ok = await global.autoSave.forceSave();
  // Should not throw and should return boolean
  if (typeof ok !== 'boolean') {
    throw new Error('forceSave did not return a boolean');
  }

  // Verify an item was stored or queued
  const payloadStr = global.localStorage.getItem('fitrep_current_session');
  if (!payloadStr) {
    // If no payload, persistence may have queued; ensure no crash
    const queued = global.localStorage.getItem('fitrep_save_queue');
    if (!queued) {
      throw new Error('Neither session saved nor queue persisted');
    }
  } else {
    const payload = JSON.parse(payloadStr);
    if (typeof payload.currentTraitIndex !== 'number') {
      throw new Error('Saved payload missing currentTraitIndex number');
    }
  }

  console.log('persistence safeguards tests passed');
})();

