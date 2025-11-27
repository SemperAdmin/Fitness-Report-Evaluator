// Render start wrapper: optionally creates a success issue, then starts the server
// Configure with env vars:
// - START_CMD: server start command (default: node server/server.js)
// - CREATE_ISSUE_ON_DEPLOY_SUCCESS: 'true' to create an issue when starting
// - ISSUE_ASSIGNEES: comma-separated GitHub usernames

const { spawn } = require('child_process');
const createIssue = require('./render-issue');

/**
 *
 */
async function maybeCreateSuccessIssue() {
  const should = String(process.env.CREATE_ISSUE_ON_DEPLOY_SUCCESS || '').toLowerCase() === 'true';
  if (!should) return;
  await createIssue({
    event: 'deploy-success',
    title: '[CD] Deployment started successfully on Render',
    description: 'Service start initiated after successful build.',
    labels: [ 'deploy', 'success' ],
    assignees: (process.env.ISSUE_ASSIGNEES || '').split(',').map(s => s.trim()).filter(Boolean)
  });
}

(async () => {
  await maybeCreateSuccessIssue();
  const startCmd = process.env.START_CMD || 'node server/server.js';
  console.log('[render-start] Starting service with:', startCmd);
  const child = spawn(startCmd, { shell: true, stdio: 'inherit' });
  child.on('close', (code) => {
    console.log('[render-start] Service exited with code', code);
    process.exit(code);
  });
})();

