const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Simulate browser-like globals
global.window = global;
global.fetch = async () => ({ ok: true });
// Minimal document for banner operations
global.document = {
  body: { appendChild: () => {} },
  createElement: () => ({ id: '', style: {}, innerHTML: '' }),
  getElementById: () => null
};
// Minimal localStorage stub
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

// Load logger
requireScript(path.join(__dirname, '..', 'js', 'errorLogger.js'));

if (typeof global.ErrorLogger !== 'object') {
  throw new Error('ErrorLogger module not loaded');
}

// Configure to ensure remote is disabled for tests
global.ErrorLogger.setConfig({ remoteEnabled: false, maxStored: 50 });

// Test: basic log capture
global.ErrorLogger.logError(new Error('Test error'), { module: 'tests', action: 'basic' }, 'error');
const logs1 = global.ErrorLogger.getLogs();
if (!Array.isArray(logs1) || logs1.length < 1) {
  throw new Error('ErrorLogger did not capture logs');
}
const last = logs1[0];
if (!last.message || !last.stack || last.severity !== 'error') {
  throw new Error('Captured log missing required fields');
}

// Test: storage sink writes
const stored = JSON.parse(global.localStorage.getItem('fitrep_error_logs') || '[]');
if (!Array.isArray(stored) || stored.length < 1) {
  throw new Error('Storage sink did not persist logs');
}

// Test: wrap rethrows and logs
let threw = false;
function boom() { throw new Error('Boom'); }
const wrapped = global.ErrorLogger.wrap(boom, { module: 'tests', action: 'wrap' });
try { wrapped(); } catch (e) { threw = true; }
if (!threw) throw new Error('Wrapped function did not rethrow');
const logs2 = global.ErrorLogger.getLogs();
if (logs2.length < logs1.length + 1) {
  throw new Error('Wrap did not log error on exception');
}

console.log('ErrorLogger tests passed');

