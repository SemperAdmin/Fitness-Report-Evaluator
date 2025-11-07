const assert = require('assert');
const { ModalStack } = require('../js/modals.js');

function run() {
  const stack = new ModalStack();

  // Initially empty
  assert.strictEqual(stack.depth(), 0, 'Initial stack depth should be 0');
  assert.strictEqual(stack.top(), null, 'Initial top should be null');

  // Push modals and verify order and z-index progression
  const a = stack.push('modalA');
  assert.strictEqual(stack.depth(), 1, 'Depth after first push should be 1');
  assert.ok(a.zIndexBackdrop < a.zIndexModal, 'Backdrop z-index should be below modal');
  const b = stack.push('modalB');
  assert.strictEqual(stack.depth(), 2, 'Depth after second push should be 2');
  assert.ok(b.zIndexBackdrop > a.zIndexBackdrop, 'Second backdrop should be higher than first');
  assert.ok(b.zIndexModal > a.zIndexModal, 'Second modal should be higher than first');

  // Topmost should be last pushed
  assert.strictEqual(stack.top().id, 'modalB', 'Top should be modalB');

  // ComputeZForIndex matches stored z-indices
  const calcB = stack.computeZForIndex(1);
  assert.strictEqual(calcB.modal, b.zIndexModal, 'Computed modal z-index should match stored');
  assert.strictEqual(calcB.backdrop, b.zIndexBackdrop, 'Computed backdrop z-index should match stored');

  // Remove a non-top and ensure z-indices recompute
  stack.remove('modalA');
  assert.strictEqual(stack.depth(), 1, 'Depth should decrease after removal');
  const top = stack.top();
  const calcTop = stack.computeZForIndex(0);
  assert.strictEqual(top.zIndexModal, calcTop.modal, 'Top z-index should recompute to base layer');

  // Escape handling closes the topmost
  const c = stack.push('modalC');
  assert.strictEqual(stack.top().id, 'modalC', 'Top should be modalC after push');
  const closedId = stack.handleEscape();
  assert.strictEqual(closedId, 'modalC', 'Escape should close topmost modal');
  assert.strictEqual(stack.top().id, 'modalB', 'Top should fall back to modalB');

  // Pop remaining
  stack.pop();
  assert.strictEqual(stack.depth(), 0, 'Stack should be empty after popping remaining');

  console.log('All ModalStack tests passed.');
}

run();

