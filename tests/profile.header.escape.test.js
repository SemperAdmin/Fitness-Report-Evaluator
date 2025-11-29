const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Simulate minimal DOM
const nameEl = { innerHTML: '', textContent: '' };
global.document = {
  getElementById: (id) => (id === 'profileHeaderName' ? nameEl : { textContent: '' }),
  addEventListener: () => {}
};
global.window = global;
global.window.addEventListener = () => {};
// Stub RAFQueue
global.RAFQueue = class {
  add(fn) { try { fn(); } catch (_) {} }
};

function requireScript(relPath) {
  const code = fs.readFileSync(relPath, 'utf8');
  vm.runInThisContext(code, { filename: relPath });
}

// Load utils and profile
requireScript(path.join(__dirname, '..', 'js', 'utils.js'));
requireScript(path.join(__dirname, '..', 'js', 'profile.js'));

// Inject global state
global.currentProfile = { rsRank: 'SGT', rsName: '<img onerror=alert(1)>', rsEmail: 'x@y' };
global.profileEvaluations = [];

// Call renderer
if (typeof global.renderProfileHeader !== 'function') {
  throw new Error('renderProfileHeader not loaded');
}
global.renderProfileHeader();

// When image src path exists, it uses innerHTML with escapeHtml
if (/onerror/.test(nameEl.innerHTML) || /<img onerror/.test(nameEl.innerHTML)) {
  throw new Error('Profile header rendered unescaped HTML');
}

console.log('profile header escape test passed');
