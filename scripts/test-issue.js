// Load .env locally if present so you can avoid setting env vars manually
try { require('dotenv').config(); } catch (_) {}

// Single-command local test for GitHub issue creation
// Usage:
//   $env:GITHUB_TOKEN = '<token>'
//   npm run test:issue
// Optional overrides:
//   TEST_EVENT, TEST_TITLE, TEST_BODY, TEST_LABELS, TEST_ASSIGNEES, TEST_LOGS, GITHUB_REPO

const createIssue = require('./render-issue');

/**
 *
 * @param str
 */
function parseCsv(str) {
  return String(str || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

(async () => {
  const event = process.env.TEST_EVENT || 'local-test';
  const title = process.env.TEST_TITLE || '[Local] Single-command issue test';
  const description = process.env.TEST_BODY || 'Verifying local issue creation via npm script.';
  const labels = parseCsv(process.env.TEST_LABELS || 'test');
  const assignees = parseCsv(process.env.TEST_ASSIGNEES || '');
  const logs = process.env.TEST_LOGS || '';

  const res = await createIssue({ event, title, description, labels, assignees, logs });
  if (!res.ok) {
    console.error('[test-issue] Failed:', res);
    process.exit(1);
  }
  console.log('[test-issue] Success:', res);
  process.exit(0);
})();
