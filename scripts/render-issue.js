// Render CD: GitHub issue creation helper
// Creates issues in the repository specified by env GITHUB_REPO using GITHUB_TOKEN.
// Usage: require('./render-issue')({ event, title, body, labels, assignees })

// node-fetch v3 is ESM-only; use dynamic import to stay compatible in CJS
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 *
 * @param extra
 */
function buildEnvContext(extra = {}) {
  const env = process.env || {};
  const ctx = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    renderExternalUrl: env.RENDER_EXTERNAL_URL || '',
    renderGitCommit: env.RENDER_GIT_COMMIT || env.COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || '',
    serviceName: env.RENDER_SERVICE_NAME || env.SERVICE_NAME || '',
    port: env.PORT || '',
    nodeEnv: env.NODE_ENV || '',
    ...extra
  };
  return ctx;
}

/**
 *
 * @param title
 * @param description
 * @param envContext
 * @param logs
 */
function formatBody(title, description, envContext, logs) {
  const lines = [
    `Title: ${title}`,
    '',
    'Description:',
    description || '',
    '',
    'Context:',
    `- Timestamp: ${envContext.timestamp}`,
    `- Service: ${envContext.serviceName}`,
    `- Environment: ${envContext.nodeEnv}`,
    `- External URL: ${envContext.renderExternalUrl}`,
    `- Commit: ${envContext.renderGitCommit}`,
    `- Node: ${envContext.nodeVersion} (${envContext.platform}/${envContext.arch})`,
  ];
  if (envContext.port) lines.push(`- Port: ${envContext.port}`);
  if (logs) {
    const truncated = String(logs).slice(0, 10000); // cap to 10k chars to avoid API rejection
    lines.push('', 'Logs (truncated):', '```', truncated, '```');
  }
  return lines.join('\n');
}

/**
 *
 * @param root0
 * @param root0.event
 * @param root0.title
 * @param root0.description
 * @param root0.labels
 * @param root0.assignees
 * @param root0.logs
 * @param root0.extraContext
 */
async function createIssue({ event, title, description, labels = [], assignees = [], logs, extraContext = {} }) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'SemperAdmin/Fitness-Report-Evaluator';

  if (!token) {
    console.warn('[render-issue] GITHUB_TOKEN not set; skipping issue creation.');
    return { ok: false, reason: 'missing_token' };
  }

  const envCtx = buildEnvContext(extraContext);
  const issueTitle = title || `[CD] ${event || 'event'} notification`;
  const body = formatBody(issueTitle, description, envCtx, logs);
  const url = `https://api.github.com/repos/${repo}/issues`;

  const payload = {
    title: issueTitle,
    body,
    labels: Array.from(new Set([ 'feedback', event || 'cd-event', ...labels ].filter(Boolean))),
    assignees: Array.isArray(assignees) ? assignees : []
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error('[render-issue] GitHub issue creation failed:', text);
      return { ok: false, status: resp.status, error: text };
    }
    let data;
    try { data = JSON.parse(text); } catch (_) { data = {}; }
    console.log('[render-issue] Issue created:', data.html_url || 'unknown url');
    return { ok: true, url: data.html_url, number: data.number };
  } catch (err) {
    console.error('[render-issue] Issue creation error:', err);
    return { ok: false, error: String(err && err.stack || err) };
  }
}

module.exports = createIssue;
