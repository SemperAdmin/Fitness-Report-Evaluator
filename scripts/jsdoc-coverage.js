/*
 * Simple JSDoc coverage scanner
 *
 * Scans JS files under `js/` and `server/` to estimate JSDoc coverage
 * by counting function-like declarations and preceding JSDoc blocks.
 *
 * Usage:
 *   node scripts/jsdoc-coverage.js [--strict]
 *
 * Exit code:
 *   0  success
 *   1  strict mode: coverage < 0.90
 */
const fs = require('fs');
const path = require('path');

const roots = [path.join(__dirname, '..', 'js'), path.join(__dirname, '..', 'server')];
let totalFunctions = 0;
let documented = 0;

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Rough detection of function-like declarations
    const isFunc = /^(async\s+)?function\s+[a-zA-Z0-9_]+\s*\(/.test(line)
      || /^(const|let|var)\s+[a-zA-Z0-9_]+\s*=\s*(async\s*)?\([^)]*\)\s*=>/.test(line)
      || /^class\s+[A-Za-z0-9_]+/.test(line)
      || /^[A-Za-z0-9_]+\s*\([^)]*\)\s*{\s*$/.test(line) // method in class (best-effort)
      ;
    if (!isFunc) continue;
    totalFunctions++;

    // Look back up to 5 lines for JSDoc block start
    let hasDoc = false;
    for (let j = i - 1; j >= 0 && i - j <= 6; j--) {
      const prev = lines[j].trim();
      if (prev.startsWith('/**')) { hasDoc = true; break; }
      if (prev && !prev.startsWith('*') && !prev.startsWith('//') && !prev.startsWith('/*')) break;
    }
    if (hasDoc) documented++;
  }
}

function walk(dir) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Skip third-party or build directories
      if (['node_modules', '.tmp_sri', '.github'].includes(ent.name)) continue;
      walk(p);
    } else if (ent.isFile() && p.endsWith('.js')) {
      scanFile(p);
    }
  }
}

roots.forEach(walk);

const coverage = totalFunctions ? documented / totalFunctions : 1;
const pct = (coverage * 100).toFixed(2);
console.log(`JSDoc coverage: ${pct}% (${documented}/${totalFunctions})`);

const strict = process.argv.includes('--strict');
if (strict && coverage < 0.90) {
  console.error('Coverage below 90% in strict mode.');
  process.exit(1);
}

