const assert = require('assert');
const { ValidationRules, parseRules, validateValue, errorMessageFor, validateField, validateFormPayload } = require('../js/formValidationCore.js');

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

describe('FormValidationCore', () => {
  it('parseRules parses rule strings', () => {
    const rules = parseRules('required|minLength:2|maxLength:10');
    assert.strictEqual(rules.length, 3);
    assert.strictEqual(rules[0].name, 'required');
    assert.strictEqual(rules[1].name, 'minLength');
    assert.strictEqual(rules[1].params[0], '2');
  });

  it('validateValue applies rules and returns first failure', () => {
    const rules = parseRules('required|minLength:5');
    const res1 = validateValue('abc', rules);
    assert.strictEqual(res1.isValid, false);
    assert.strictEqual(res1.failedRule.name, 'minLength');
    const res2 = validateValue('abcdef', rules);
    assert.strictEqual(res2.isValid, true);
  });

  it('validateField returns consistent messages', () => {
    const res = validateField({ value: '', label: 'Username', dataRules: parseRules('required|minLength:3') });
    assert.strictEqual(res.valid, false);
    assert.ok(/required/i.test(res.message));
  });

  it('validateFormPayload aggregates field messages', () => {
    const payload = {
      a: { value: '', label: 'A', dataRules: parseRules('required') },
      b: { value: 'ok', label: 'B', dataRules: parseRules('minLength:2') },
    };
    const res = validateFormPayload(payload);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.messages.length, 1);
    assert.strictEqual(res.fields.a.valid, false);
    assert.strictEqual(res.fields.b.valid, true);
  });
});
