const path = require('path');
const fs = require('fs');
const vm = require('vm');

function requireScript(relPath) {
  const code = fs.readFileSync(relPath, 'utf8');
  vm.runInThisContext(code, { filename: relPath });
}

// Load utils
requireScript(path.join(__dirname, '..', 'js', 'utils.js'));

if (typeof global.escapeHtml !== 'function') {
  throw new Error('escapeHtml not loaded');
}

const raw = '<script>alert(1)</script> & "\'';
const escaped = global.escapeHtml(raw);
if (/</.test(escaped) || />/.test(escaped)) {
  throw new Error('escapeHtml did not escape angle brackets');
}
if (!escaped.includes('&lt;') || !escaped.includes('&gt;') || !escaped.includes('&quot;') || !escaped.includes('&#39;')) {
  throw new Error('escapeHtml did not encode special characters');
}

console.log('escapeHtml test passed');
