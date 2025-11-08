const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Simulate browser globals
global.window = global;
global.document = {};

function requireScript(relPath) {
  const code = fs.readFileSync(relPath, 'utf8');
  vm.runInThisContext(code, { filename: relPath });
}

// Ensure no pre-existing globals
if (typeof global.currentTraitIndex !== 'undefined') {
  throw new Error('currentTraitIndex should not exist before load');
}

// Load evaluation script
requireScript(path.join(__dirname, '..', 'js', 'evaluation.js'));

// Verify encapsulation: top-level globals should not leak
if (typeof global.currentTraitIndex !== 'undefined') {
  throw new Error('Global variable pollution: currentTraitIndex leaked to global scope');
}
if (typeof global.allTraits !== 'undefined') {
  throw new Error('Global variable pollution: allTraits leaked to global scope');
}

// Verify namespace exists
if (typeof global.Evaluation !== 'object') {
  throw new Error('Evaluation namespace missing');
}

// Verify backward-compat shim functions are present
const shims = [
  'startEvaluation',
  'goBackToLastTrait',
  'proceedToDirectedComments',
  'saveJustification',
  'cancelReevaluation',
  'startReevaluation',
  'editTrait',
  'editJustification',
  'evaluationShowSummary'
];
for (const fn of shims) {
  if (typeof global[fn] !== 'function') {
    throw new Error(`Backward compat shim missing: ${fn}`);
  }
}

console.log('evaluation encapsulation tests passed');
