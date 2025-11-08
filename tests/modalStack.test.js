const assert = require('assert');
const { ModalStack } = require('../js/modals.js');

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

