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

// Verify encapsulation: internal variables should not leak
// Note: evaluationResults, evaluationMeta, and allTraits are intentionally global
// (mutable state objects shared across modules)
if (typeof global.currentTraitIndex !== 'undefined') {
  throw new Error('Global variable pollution: currentTraitIndex leaked to global scope');
}
if (typeof global.currentEvaluationLevel !== 'undefined') {
  throw new Error('Global variable pollution: currentEvaluationLevel leaked to global scope');
}
if (typeof global.pendingEvaluation !== 'undefined') {
  throw new Error('Global variable pollution: pendingEvaluation leaked to global scope');
}

// Verify intentional globals exist
if (typeof global.evaluationResults !== 'object') {
  throw new Error('evaluationResults should be exposed as global');
}
if (typeof global.evaluationMeta !== 'object') {
  throw new Error('evaluationMeta should be exposed as global');
}
if (!Array.isArray(global.allTraits)) {
  throw new Error('allTraits should be exposed as global array');
}

// Verify namespace exists
if (typeof global.Evaluation !== 'object') {
  throw new Error('Evaluation namespace missing');
}

// Verify backward-compat shim functions are present
// Note: showSectionIGeneration is defined in sectionI.js, not evaluation.js
const shims = [
  'startEvaluation',
  'goBackToLastTrait',
  'proceedToDirectedComments',
  'saveJustification',
  'cancelJustification',
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
