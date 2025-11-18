const { spawn } = require('child_process');

function runNodeTest(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err || `Test failed: ${file}`));
    });
  });
}

(async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.test.js'))
      .map(f => path.join(__dirname, f));
    for (const file of files) {
      const out = await runNodeTest(file);
      if (out) console.log(out);
    }
    console.log('All tests completed successfully.');
    process.exit(0);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();

