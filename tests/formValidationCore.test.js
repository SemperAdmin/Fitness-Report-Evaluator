const assert = require('assert');
const path = require('path');

// Load core via CommonJS export
const core = require(path.join('..', 'js', 'formValidationCore.js'));

function run() {
  // parseRules
  const rules = core.parseRules('required|minLength:2|maxLength:5');
  assert.strictEqual(Array.isArray(rules), true, 'rules should be array');
  assert.strictEqual(rules.length, 3, 'three rules parsed');
  assert.strictEqual(rules[1].name, 'minLength');
  assert.strictEqual(rules[1].params[0], '2');

  // validateValue success
  let res = core.validateValue('abc', rules);
  assert.strictEqual(res.isValid, true, 'valid value passes rules');

  // validateValue minLength fail
  res = core.validateValue('a', rules);
  assert.strictEqual(res.isValid, false, 'too short fails');
  assert.strictEqual(res.failedRule.name, 'minLength');

  // field-level validation and message
  let vf = core.validateField({ value: '', label: 'Name', dataRules: rules });
  assert.strictEqual(vf.valid, false, 'required fails on empty');
  assert.ok(vf.message.includes('Name is required'));

  vf = core.validateField({ value: 'Captain', label: 'Rank', dataRules: core.parseRules('rankLabel') });
  assert.strictEqual(vf.valid, true, 'rank label ok');

  vf = core.validateField({ value: 'X', label: 'Rank', dataRules: core.parseRules('rankLabel') });
  assert.strictEqual(vf.valid, false, 'rank too short invalid');
  assert.ok(/2–20/.test(vf.message), 'rank error message shows range');

  // username rule
  vf = core.validateField({ value: 'us', label: 'Username', dataRules: core.parseRules('username') });
  assert.strictEqual(vf.valid, false, 'username length rule enforced');
  vf = core.validateField({ value: 'valid.user-01', label: 'Username', dataRules: core.parseRules('username') });
  assert.strictEqual(vf.valid, true, 'username pattern passes');

  // form payload aggregate
  const payload = {
    name: { value: 'John Doe', label: 'Name', dataRules: core.parseRules('required|nameLabel') },
    rank: { value: '', label: 'Rank', dataRules: core.parseRules('required|rankLabel') },
    username: { value: 'bad name', label: 'Username', dataRules: core.parseRules('required|username') },
  };
  const agg = core.validateFormPayload(payload);
  assert.strictEqual(agg.valid, false, 'aggregate invalid when fields invalid');
  assert.strictEqual(agg.messages.length, 2, 'two messages for two invalid fields');

  console.log('formValidationCore.test.js passed');
}

run();

