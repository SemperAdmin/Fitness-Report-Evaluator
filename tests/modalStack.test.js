const assert = require('assert');
const { ModalStack } = require('../js/modals.js');

// Minimal polyfill for test runner environments without Mocha/Jest.
if (typeof global.describe !== 'function') {
  global.describe = (name, fn) => { fn(); };
}
if (typeof global.it !== 'function') {
  global.it = (name, fn) => {
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        res.then(() => {}).catch(e => { console.error(e); process.exit(1); });
      }
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  };
}

describe('ModalStack', () => {
  it('push/pop maintains order and z-indices', () => {
    const s = new ModalStack();
    const a = s.push('a');
    const b = s.push('b');
    assert.strictEqual(s.depth(), 2);
    assert.ok(b.zIndexModal > a.zIndexModal);
    const top = s.pop();
    assert.strictEqual(top.id, 'b');
    assert.strictEqual(s.top().id, 'a');
  });
  it('remove re-layers remaining entries', () => {
    const s = new ModalStack();
    const a = s.push('a');
    const b = s.push('b');
    const c = s.push('c');
    s.remove('b');
    assert.strictEqual(s.depth(), 2);
    // Ensure z-indices recomputed monotonically
    const z = s.stack.map(e => e.zIndexModal);
    assert.ok(z[0] < z[1]);
  });
});
