const assert = require('assert');
const FormCore = require('../js/formCore.js');

function makeState() {
  return FormCore.createInitialState({
    steps: [
      { id: 'setup', title: 'Setup' },
      { id: 'details', title: 'Details' },
      { id: 'review', title: 'Review' }
    ],
    fieldsByStep: {
      setup: { marine: { value: '' } },
      details: { height: { value: 70 }, weight: { value: 180 }, bmi: { value: '' } },
      review: {}
    }
  });
}

function run() {
  // INIT
  let state = makeState();
  assert.strictEqual(state.currentStepId, 'setup', 'Initial step should be setup');

  // UPDATE_FIELD
  state = FormCore.reducer(state, { type: FormCore.types.UPDATE_FIELD, payload: { stepId: 'setup', fieldId: 'marine', value: 'Doe, John' } });
  assert.strictEqual(state.steps.find(s => s.id === 'setup').fields.marine.value, 'Doe, John', 'Field update should apply');
  assert.strictEqual(state.dirty, true, 'Dirty should be set after update');

  // VALIDATE_STEP
  state = FormCore.reducer(state, {
    type: FormCore.types.VALIDATE_STEP,
    payload: { stepId: 'setup', rules: [{ fieldId: 'marine', validate: FormCore.validators.required }] }
  });
  assert.strictEqual(state.steps.find(s => s.id === 'setup').valid, true, 'Step should be valid after correct data');

  // GO_TO_STEP
  state = FormCore.reducer(state, { type: FormCore.types.GO_TO_STEP, payload: { stepId: 'details' } });
  assert.strictEqual(state.currentStepId, 'details', 'Should move to details');

  // APPLY_DEPENDENCIES - compute BMI = weight / (height in meters)^2
  const deps = {
    weight: [{ target: 'bmi', compute: (st) => {
      const d = st.steps.find(s => s.id === 'details');
      const hInM = Number(d.fields.height.value) * 0.0254;
      const w = Number(d.fields.weight.value);
      return hInM ? Number((w / (hInM * hInM)).toFixed(1)) : '';
    }}],
    height: [{ target: 'bmi', compute: (st) => {
      const d = st.steps.find(s => s.id === 'details');
      const hInM = Number(d.fields.height.value) * 0.0254;
      const w = Number(d.fields.weight.value);
      return hInM ? Number((w / (hInM * hInM)).toFixed(1)) : '';
    }}]
  };
  state = FormCore.reducer(state, { type: FormCore.types.APPLY_DEPENDENCIES, payload: { dependencies: deps } });
  const bmiVal = state.steps.find(s => s.id === 'details').fields.bmi.value;
  assert.ok(bmiVal && bmiVal > 0, 'BMI should be computed');

  // SERIALIZE/DESERIALIZE
  const json = FormCore.serializeState(state);
  const restored = FormCore.deserializeState(json);
  assert.ok(restored && restored.version === FormCore.VERSION, 'Restored state should match version');
  assert.strictEqual(restored.currentStepId, 'details', 'Restored step should be details');

  // Invalid step navigation should be ignored
  const before = JSON.stringify(state);
  state = FormCore.reducer(state, { type: FormCore.types.GO_TO_STEP, payload: { stepId: 'nonexistent' } });
  const after = JSON.stringify(state);
  assert.strictEqual(before, after, 'Invalid step id should not change state');

  console.log('All FormCore tests passed.');
}

run();

