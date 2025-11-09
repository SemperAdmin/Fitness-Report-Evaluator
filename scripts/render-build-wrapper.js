// Render build wrapper: runs the build/install step and reports failures/successes to GitHub issues
// Configure with env vars:
// - RENDER_BUILD_CMD: shell command to run (default: npm ci)
// - CREATE_ISSUE_ON_DEPLOY_SUCCESS: 'true' to create an issue on success
// - ISSUE_ASSIGNEES: comma-separated GitHub usernames to assign

const { spawn } = require('child_process');
const createIssue = require('./render-issue');

function runCommand(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true, stdio: 'pipe', ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
    child.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

(async () => {
  const buildCmd = process.env.RENDER_BUILD_CMD || 'npm ci';
  console.log('[render-build] Running build command:', buildCmd);
  const result = await runCommand(buildCmd);

  if (result.code !== 0) {
    console.error('[render-build] Build failed with code', result.code);
    const logs = (result.stderr || result.stdout || '').slice(0, 20000);
    await createIssue({
      event: 'build-failure',
      title: '[CD] Build failed on Render',
      description: 'The build process failed during continuous deployment.',
      labels: [ 'build', 'failure' ],
      assignees: (process.env.ISSUE_ASSIGNEES || '').split(',').map(s => s.trim()).filter(Boolean),
      logs
    });
    process.exit(result.code || 1);
    return;
  }

  console.log('[render-build] Build succeeded');
  const shouldCreateSuccess = String(process.env.CREATE_ISSUE_ON_DEPLOY_SUCCESS || '').toLowerCase() === 'true';
  if (shouldCreateSuccess) {
    await createIssue({
      event: 'build-success',
      title: '[CD] Build succeeded on Render',
      description: 'The build completed successfully during continuous deployment.',
      labels: [ 'build', 'success' ],
      assignees: (process.env.ISSUE_ASSIGNEES || '').split(',').map(s => s.trim()).filter(Boolean),
      logs: (result.stdout || '').slice(0, 10000)
    });
  }
  // Exit 0 so Render proceeds to start command
  process.exit(0);
})();

