const express = require('express');
const router = express.Router();
const path = require('path');
const fsp = require('fs/promises');
// Support node-fetch v3 in CommonJS via dynamic import wrapper (same as server.js)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Config constants (align with server.js defaults)
const DATA_REPO = process.env.DATA_REPO || 'SemperAdmin/Fitness-Report-Evaluator-Data';
// Align local data dir with server.js behavior: allow env override
const LOCAL_BASE_DIR = process.env.LOCAL_DATA_DIR || path.join(__dirname, 'local-data');
const LOCAL_DATA_DIR = path.join(LOCAL_BASE_DIR, 'users');
// Server data token for GitHub API access
const SERVER_DATA_TOKEN = process.env.FITREP_DATA || process.env.FITREP_DATA_ADMIN || '';

// ===== RATE LIMITING =====
// Lightweight per-IP rate limiter for admin endpoints
// Uses in-memory map with periodic cleanup; suitable for single-node deployments
function createRateLimiter({ windowMs, limit, name }) {
  const hits = new Map();

  // Periodic cleanup to prevent memory leaks
  // Run every half-window for better memory efficiency
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits.entries()) {
      if (now > entry.reset) {
        hits.delete(ip);
      }
    }
  }, windowMs / 2);

  cleanupInterval.unref(); // Don't keep process alive

  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.reset) {
      hits.set(ip, { count: 1, reset: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > limit) {
      console.warn(`[admin-ratelimit] ${name}: IP ${ip} exceeded limit (${entry.count}/${limit})`);
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.reset - now) / 1000)
      });
    }

    next();
  };
}

// Rate limiters for different admin endpoint types
const adminAuthRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 10,
  name: 'admin-auth'
});
const adminReadRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 60,
  name: 'admin-read'
});
const adminWriteRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 20,
  name: 'admin-write'
});

// ===== INPUT VALIDATION =====
// Security helpers for validating and sanitizing user inputs

/**
 * Sanitize a string by removing control characters and limiting length
 * @param {string} str - Input string
 * @param {number} [maxLen=200] - Maximum allowed length
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLen = 200) {
  const s = String(str || '').trim();
  // Remove control characters (0x00-0x1F, 0x7F)
  const cleaned = s.replace(/[\x00-\x1F\x7F]/g, '');
  return cleaned.substring(0, maxLen);
}

/**
 * Validate username format (3-50 chars, alphanumeric + ._-)
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
function isValidUsername(username) {
  const u = String(username || '').trim();
  if (u.length < 3 || u.length > 50) return false;
  return /^[a-zA-Z0-9._-]+$/.test(u);
}

/**
 * Validate and sanitize search query (prevent injection)
 * @param {string} query - Search query
 * @returns {string} Sanitized query
 */
function sanitizeSearchQuery(query) {
  const q = sanitizeString(query, 100);
  // Remove potentially dangerous characters for SQL/NoSQL injection
  // Allow alphanumeric, spaces, and basic punctuation
  return q.replace(/[^\w\s@._-]/gi, '');
}

/**
 * Validate sort field against whitelist
 * @param {string} field - Sort field name
 * @param {string[]} allowedFields - Whitelist of allowed fields
 * @returns {string} Valid field or default
 */
function validateSortField(field, allowedFields) {
  const f = String(field || '').trim().toLowerCase();
  return allowedFields.includes(f) ? f : allowedFields[0];
}

/**
 * Validate and clamp pagination parameters
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @returns {Object} Validated { page, pageSize }
 */
function validatePagination(page, pageSize) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  return { page: p, pageSize: ps };
}

// ===== AUDIT LOGGING =====
// Audit log for tracking admin actions with timestamps, user, action, target, and IP
const os = require('os');
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || path.join(os.tmpdir(), 'fitrep-audit');

// Ensure audit log directory exists
async function ensureAuditLogDir() {
  try {
    await fsp.mkdir(AUDIT_LOG_DIR, { recursive: true });
  } catch (_) { /* ignore */ }
}

/**
 * Log an admin action for security audit trail
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - Action performed (e.g., 'user_delete', 'user_hard_delete')
 * @param {string} params.admin - Admin username who performed the action
 * @param {string} [params.target] - Target user/resource affected
 * @param {string} [params.ip] - IP address of the admin
 * @param {Object} [params.metadata] - Additional context (optional)
 * @param {string} [params.severity] - Severity level: 'info', 'warning', 'critical'
 */
async function auditLog({ action, admin, target, ip, metadata, severity = 'info' }) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    admin,
    target: target || null,
    ip: ip || 'unknown',
    severity,
    metadata: metadata || {}
  };

  // Always log to console as structured JSON for better observability
  console.log(JSON.stringify({ ...logEntry, component: 'admin-audit' }));

  // Write to daily log file in production
  if (process.env.NODE_ENV === 'production' || process.env.AUDIT_LOG_FILE === 'true') {
    try {
      await ensureAuditLogDir();
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(AUDIT_LOG_DIR, `admin-audit-${dateStr}.jsonl`);
      const logLine = JSON.stringify(logEntry) + '\n';
      await fsp.appendFile(logFile, logLine, 'utf8');
    } catch (err) {
      console.error('[admin-audit] Failed to write to log file:', err?.message || err);
    }
  }

  // Create GitHub issue for critical actions (hard delete, security events)
  if (severity === 'critical') {
    try {
      const token = process.env.GITHUB_TOKEN || process.env.DISPATCH_TOKEN || '';
      const repo = process.env.GITHUB_REPO || process.env.MAIN_REPO;
      if (token && repo) {
        const issueTitle = `[Admin Audit] Critical Action: ${action}`;
        const issueBody = [
          '## Critical Admin Action Alert',
          '',
          `**Action:** ${action}`,
          `**Admin:** ${admin}`,
          `**Target:** ${target || 'n/a'}`,
          `**Timestamp:** ${timestamp}`,
          `**IP Address:** ${ip || 'unknown'}`,
          '',
          '### Metadata',
          '```json',
          JSON.stringify(metadata || {}, null, 2),
          '```',
          '',
          '---',
          '*This issue was automatically created by the admin audit system.*'
        ].join('\n');

        const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
            labels: ['admin-audit', 'critical', 'security']
          })
        });

        if (resp.ok) {
          const issue = await resp.json();
          console.log(`[admin-audit] GitHub issue created: ${issue.html_url}`);
        } else {
          const text = await resp.text();
          console.warn('[admin-audit] Failed to create GitHub issue:', text);
        }
      }
    } catch (err) {
      console.error('[admin-audit] Failed to create GitHub issue for critical action:', err?.message || err);
    }
  }
}

// Admin guard: requires authenticated session and admin privileges
// Uses existing HMAC token authentication from server.js (req.sessionUser)
// Checks username against ADMIN_USERNAME environment variable
async function requireAdmin(req, res, next) {
  try {
    // Check if user is authenticated via session token
    if (!req.sessionUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get admin username from environment (default: semperadmin)
    const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'semperadmin').toLowerCase();
    const currentUser = String(req.sessionUser || '').toLowerCase();

    // Check if current user matches admin username
    if (currentUser !== ADMIN_USERNAME) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Optional: Verify isAdmin flag in user profile for additional security
    // This provides defense-in-depth by checking both env var and profile flag
    const token = process.env.FITREP_DATA || '';
    if (token) {
      try {
        const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${currentUser}.json`;
        const resp = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (resp.ok) {
          const data = await resp.json();
          const jsonStr = Buffer.from(data.content || '', 'base64').toString('utf8');
          const profile = JSON.parse(jsonStr);
          // If profile exists and explicitly sets isAdmin: false, deny access
          if (profile && profile.isAdmin === false) {
            return res.status(403).json({ error: 'Forbidden: Admin privileges revoked' });
          }
        }
      } catch (e) {
        // Non-fatal: if profile check fails, still allow based on ADMIN_USERNAME match
        console.warn('Admin profile verification failed (non-blocking):', e?.message || e);
      }
    }

    return next();
  } catch (err) {
    console.error('requireAdmin middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

router.get('/ping', adminReadRateLimit, requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'admin pong' });
});

// Return current admin session information (username, name, rank)
// Fetches real user profile from GitHub data repository
router.get('/session', adminAuthRateLimit, requireAdmin, async (req, res) => {
  try {
    const username = String(req.sessionUser || '').toLowerCase();
    const token = SERVER_DATA_TOKEN;

    let profile = {
      username: username,
      name: '',
      rank: ''
    };

    // Try to fetch user profile from GitHub
    if (token && username) {
      try {
        const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${username}.json`;
        const resp = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (resp.ok) {
          const data = await resp.json();
          const jsonStr = Buffer.from(data.content || '', 'base64').toString('utf8');
          const userObj = JSON.parse(jsonStr);
          profile.name = userObj.rsName || userObj.name || '';
          profile.rank = userObj.rsRank || userObj.rank || '';
        }
      } catch (e) {
        console.warn('Failed to fetch user profile for session endpoint:', e?.message || e);
        // Non-fatal: continue with basic profile
      }
    }

    // Fallback: try local filesystem if GitHub fetch failed or no token
    if (!profile.name && username) {
      try {
        const fp = path.join(LOCAL_DATA_DIR, `${username}.json`);
        const str = await fsp.readFile(fp, 'utf8');
        const userObj = JSON.parse(str);
        profile.name = userObj.rsName || userObj.name || '';
        profile.rank = userObj.rsRank || userObj.rank || '';
      } catch (_) {
        // Non-fatal: use username as fallback name
        profile.name = username;
      }
    }

    // Audit log: admin session access
    await auditLog({
      action: 'admin_session_access',
      admin: username,
      ip: req.ip || req.connection?.remoteAddress,
      severity: 'info'
    });

    return res.json({
      ok: true,
      user: profile,
      isAdmin: true
    });
  } catch (err) {
    console.error('admin session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin logout: destroy session and return ok
router.post('/logout', adminAuthRateLimit, async (req, res) => {
  try {
    const username = String(req.sessionUser || '').toLowerCase();
    req.session?.destroy?.(() => {});

    // Audit log: admin logout
    if (username) {
      await auditLog({
        action: 'admin_logout',
        admin: username,
        ip: req.ip || req.connection?.remoteAddress,
        severity: 'info'
      });
    }
  } catch (_) { /* ignore */ }
  res.json({ ok: true });
});

// Admin metrics: overview counts
router.get('/metrics/overview', adminReadRateLimit, requireAdmin, async (req, res) => {
  try {
    const token = SERVER_DATA_TOKEN;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const window24h = now - DAY;
    const window7d = now - (7 * DAY);
    const window30d = now - (30 * DAY);

    let totalUsers = 0;
    let totalEvaluations = 0;
    let eval24h = 0;
    let eval7d = 0;
    let eval30d = 0;

    // Prefer GitHub-backed aggregation (works for public repos without token; uses token when provided)
    try {
      const listUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users`;
      const resp = await fetch(listUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.warn('admin metrics: users list failed:', text);
        throw new Error('GitHub list failed');
      }
      const items = await resp.json();
      const files = Array.isArray(items) ? items.filter(i => i.type === 'file' && String(i.name || '').toLowerCase().endsWith('.json')) : [];
      const dirs = Array.isArray(items) ? items.filter(i => i.type === 'dir') : [];
      totalUsers = files.length;
      // Count evaluations by iterating directories
      for (const d of dirs) {
        try {
          const evalDirUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${d.path}/evaluations`;
          const evalResp = await fetch(evalDirUrl, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          });
          if (evalResp.status === 404) continue;
          if (!evalResp.ok) continue;
          const evalItems = await evalResp.json();
          const evalFiles = Array.isArray(evalItems) ? evalItems.filter(e => e.type === 'file') : [];
          for (const f of evalFiles) {
            try {
              const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${f.path}`;
              const fileResp = await fetch(fileApi, {
                headers: {
                  'Accept': 'application/vnd.github.v3+json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
              });
              if (!fileResp.ok) continue;
              const fileData = await fileResp.json();
              const contentStr = Buffer.from(fileData.content || '', 'base64').toString('utf8');
              let savedAtTs = 0;
              try {
                const obj = JSON.parse(contentStr);
                const savedAt = obj && obj.savedAt ? Date.parse(obj.savedAt) : (obj && obj.evaluation && obj.evaluation.completedDate ? Date.parse(obj.evaluation.completedDate) : 0);
                if (Number.isFinite(savedAt)) savedAtTs = savedAt;
              } catch (_) {
                savedAtTs = 0;
              }
              totalEvaluations += 1;
              if (savedAtTs >= window24h) eval24h += 1;
              if (savedAtTs >= window7d) eval7d += 1;
              if (savedAtTs >= window30d) eval30d += 1;
            } catch (_) { /* ignore */ }
          }
        } catch (_) { /* ignore */ }
      }
    } catch (e) {
      console.warn('admin metrics: GitHub aggregation failed, falling back to local if available:', e?.message || e);
      // Fall through to local
      totalUsers = 0; totalEvaluations = 0; eval24h = 0; eval7d = 0; eval30d = 0;
    }

    if (!token) {
      // Local aggregation from filesystem
      try {
        let entries = [];
        try {
          entries = await fsp.readdir(LOCAL_DATA_DIR, { withFileTypes: true });
        } catch (_) {
          entries = [];
        }
        // Count user files
        const userFiles = entries.filter(e => e.isFile() && String(e.name || '').toLowerCase().endsWith('.json'));
        totalUsers = userFiles.length;
        // For each directory (prefix), count evaluations
        const userDirs = entries.filter(e => e.isDirectory());
        for (const dir of userDirs) {
          const evalDir = path.join(LOCAL_DATA_DIR, dir.name, 'evaluations');
          let evalEntries = [];
          try { evalEntries = await fsp.readdir(evalDir, { withFileTypes: true }); } catch (_) { evalEntries = []; }
          for (const ent of evalEntries) {
            if (!ent.isFile()) continue;
            const name = ent.name || '';
            if (!name.toLowerCase().endsWith('.json')) continue;
            const fp = path.join(evalDir, name);
            let savedAtTs = 0;
            try {
              const str = await fsp.readFile(fp, 'utf8');
              const obj = JSON.parse(str);
              const savedAt = obj && obj.savedAt ? Date.parse(obj.savedAt) : (obj && obj.evaluation && obj.evaluation.completedDate ? Date.parse(obj.evaluation.completedDate) : 0);
              if (Number.isFinite(savedAt)) savedAtTs = savedAt;
            } catch (_) { savedAtTs = 0; }
            totalEvaluations += 1;
            if (savedAtTs >= window24h) eval24h += 1;
            if (savedAtTs >= window7d) eval7d += 1;
            if (savedAtTs >= window30d) eval30d += 1;
          }
        }
      } catch (e) {
        console.warn('admin metrics: local aggregation failed:', e?.message || e);
      }
    }

    const avgPerUser = totalUsers > 0 ? (totalEvaluations / totalUsers) : 0;
    return res.json({
      ok: true,
      totalUsers,
      totalEvaluations,
      eval24h,
      eval7d,
      eval30d,
      avgPerUser
    });
  } catch (err) {
    console.error('admin metrics overview error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin metrics: performance analytics
router.get('/metrics/performance', adminReadRateLimit, requireAdmin, async (req, res) => {
  try {
    const token = SERVER_DATA_TOKEN || '';

    // Aggregates
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
    const performanceTiers = { top: 0, middle: 0, developing: 0 };
    const gradeValues = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };
    const bySectionValues = { D: [], E: [], F: [], G: [] };

    async function processEvaluationObject(obj) {
      try {
        const ev = obj && obj.evaluation ? obj.evaluation : obj;
        const traits = ev?.traitEvaluations || {};
        const avgStr = ev?.fitrepAverage;
        const avgNum = avgStr !== undefined ? parseFloat(avgStr) : NaN;
        if (Number.isFinite(avgNum)) {
          if (avgNum >= 4.5) performanceTiers.top += 1;
          else if (avgNum >= 3.5) performanceTiers.middle += 1;
          else performanceTiers.developing += 1;
        }
        Object.values(traits).forEach(t => {
          const g = String(t?.grade || '').trim().toUpperCase();
          if (gradeDistribution[g] !== undefined) gradeDistribution[g] += 1;
          const sec = String(t?.section || '').trim().toUpperCase();
          const val = gradeValues[g];
          if (['D','E','F','G'].includes(sec) && Number.isFinite(val)) {
            bySectionValues[sec].push(val);
          }
        });
      } catch (_) { /* ignore */ }
    }

    // Prefer GitHub-backed aggregation (attempt without token for public repos; include token when provided)
    try {
      const listUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users`;
      const resp = await fetch(listUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (resp.ok) {
        const items = await resp.json();
        const dirs = Array.isArray(items) ? items.filter(i => i.type === 'dir') : [];
        for (const d of dirs) {
          try {
            const evalDirUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${d.path}/evaluations`;
            const evalResp = await fetch(evalDirUrl, {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              }
            });
            if (evalResp.status === 404) continue;
            if (!evalResp.ok) continue;
            const evalItems = await evalResp.json();
            const evalFiles = Array.isArray(evalItems) ? evalItems.filter(e => e.type === 'file') : [];
            for (const f of evalFiles) {
              try {
                const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${f.path}`;
                const fileResp = await fetch(fileApi, {
                  headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                  }
                });
                if (!fileResp.ok) continue;
                const fileData = await fileResp.json();
                const contentStr = Buffer.from(fileData.content || '', 'base64').toString('utf8');
                let obj = {};
                try { obj = JSON.parse(contentStr); } catch (_) { obj = {}; }
                await processEvaluationObject(obj);
              } catch (_) { /* ignore */ }
            }
          } catch (_) { /* ignore */ }
        }
      } else {
        const txt = await resp.text();
        throw new Error(`GitHub users list failed: ${txt}`);
      }
    } catch (e) {
      console.warn('admin metrics performance: GitHub aggregation failed:', e?.message || e);
    }

    if (!token) {
      // Local filesystem aggregation
      try {
        let entries = [];
        try { entries = await fsp.readdir(LOCAL_DATA_DIR, { withFileTypes: true }); } catch (_) { entries = []; }
        const userDirs = entries.filter(e => e.isDirectory());
        for (const dir of userDirs) {
          const evalDir = path.join(LOCAL_DATA_DIR, dir.name, 'evaluations');
          let evalEntries = [];
          try { evalEntries = await fsp.readdir(evalDir, { withFileTypes: true }); } catch (_) { evalEntries = []; }
          for (const ent of evalEntries) {
            if (!ent.isFile()) continue;
            const name = ent.name || '';
            if (!name.toLowerCase().endsWith('.json')) continue;
            const fp = path.join(evalDir, name);
            try {
              const str = await fsp.readFile(fp, 'utf8');
              let obj = {};
              try { obj = JSON.parse(str); } catch (_) { obj = {}; }
              await processEvaluationObject(obj);
            } catch (_) { /* ignore */ }
          }
        }
      } catch (e) {
        console.warn('admin metrics performance: local aggregation failed:', e?.message || e);
      }
    }

    const totalTraits = Object.values(gradeDistribution).reduce((a,b)=>a+b,0);
    const highCount = (gradeDistribution.A + gradeDistribution.B);
    const lowCount = (gradeDistribution.F + gradeDistribution.G);
    const highGradePercent = totalTraits > 0 ? parseFloat(((highCount / totalTraits) * 100).toFixed(2)) : 0;
    const lowGradePercent = totalTraits > 0 ? parseFloat(((lowCount / totalTraits) * 100).toFixed(2)) : 0;

    function mean(arr) { return arr.length ? parseFloat((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : 0; }
    const avgGradeBySection = {
      D_mission: mean(bySectionValues.D),
      E_character: mean(bySectionValues.E),
      F_leadership: mean(bySectionValues.F),
      G_intellect: mean(bySectionValues.G)
    };

    return res.json({
      ok: true,
      gradeDistribution,
      performanceTiers,
      avgGradeBySection,
      highGradePercent,
      lowGradePercent
    });
  } catch (err) {
    console.error('admin metrics performance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin metrics: engagement analytics
router.get('/metrics/engagement', adminReadRateLimit, requireAdmin, async (req, res) => {
  try {
    const token = SERVER_DATA_TOKEN || '';
    const topUsers = [];
    const recentRegistrations = [];
    const userRankDistribution = {};

    function pushRecent(profile) {
      try {
        recentRegistrations.push({
          email: profile.rsEmail || profile.email || '',
          name: profile.rsName || profile.name || '',
          rank: profile.rsRank || profile.rank || '',
          createdDate: profile.createdDate || profile.created || ''
        });
      } catch (_) { /* ignore */ }
    }

    function addRank(rank) {
      const r = String(rank || '').trim();
      if (!r) return;
      userRankDistribution[r] = (userRankDistribution[r] || 0) + 1;
    }

    // Prefer GitHub-backed aggregation (attempt without token for public repos; include token when provided)
    try {
      const listUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users`;
      const resp = await fetch(listUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (resp.ok) {
        const items = await resp.json();
        const files = Array.isArray(items) ? items.filter(i => i.type === 'file' && String(i.name || '').toLowerCase().endsWith('.json')) : [];
        const dirs = Array.isArray(items) ? items.filter(i => i.type === 'dir') : [];

        // Map prefix to dir path for evaluations
        const dirMap = new Map();
        for (const d of dirs) { const name = String(d.name || '').trim().toLowerCase(); if (name) dirMap.set(name, d.path); }

        for (const f of files) {
          const fname = String(f.name || '');
          const prefix = fname.replace(/\.json$/i, '').toLowerCase();
          let profileObj = {};
          try {
            const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${f.path}`;
            const fileResp = await fetch(fileApi, {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              }
            });
            if (fileResp.ok) {
              const fileData = await fileResp.json();
              const contentStr = Buffer.from(fileData.content || '', 'base64').toString('utf8');
              try { profileObj = JSON.parse(contentStr); } catch (_) { profileObj = {}; }
            }
          } catch (_) { profileObj = {}; }

          addRank(profileObj?.rsRank || profileObj?.rank);
          pushRecent(profileObj);

          // Collect evaluations
          let evalCount = 0;
          let avgSum = 0;
          let avgCount = 0;
          const dirPath = dirMap.get(prefix);
          if (dirPath) {
            try {
              const evalDirUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${dirPath}/evaluations`;
              const evalResp = await fetch(evalDirUrl, {
                headers: {
                  'Accept': 'application/vnd.github.v3+json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
              });
              if (evalResp.ok) {
                const evalItems = await evalResp.json();
                const evalFiles = Array.isArray(evalItems) ? evalItems.filter(e => e.type === 'file') : [];
                for (const ef of evalFiles) {
                  try {
                    const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${ef.path}`;
                    const fileResp = await fetch(fileApi, {
                      headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                      }
                    });
                    if (!fileResp.ok) continue;
                    const fileData = await fileResp.json();
                    const contentStr = Buffer.from(fileData.content || '', 'base64').toString('utf8');
                    let obj = {};
                    try { obj = JSON.parse(contentStr); } catch (_) { obj = {}; }
                    const ev = obj && obj.evaluation ? obj.evaluation : obj;
                    const avgStr = ev?.fitrepAverage;
                    const avgNum = avgStr !== undefined ? parseFloat(avgStr) : NaN;
                    if (Number.isFinite(avgNum)) { avgSum += avgNum; avgCount += 1; }
                    evalCount += 1;
                  } catch (_) { /* ignore */ }
                }
              }
            } catch (_) { /* ignore */ }
          }

          topUsers.push({
            email: profileObj?.rsEmail || profileObj?.email || '',
            name: profileObj?.rsName || profileObj?.name || prefix,
            rank: profileObj?.rsRank || profileObj?.rank || '',
            evaluationCount: evalCount,
            avgScore: (avgCount > 0 ? parseFloat((avgSum / avgCount).toFixed(2)) : 0)
          });
        }
      } else {
        const txt = await resp.text();
        throw new Error(`GitHub users list failed: ${txt}`);
      }
    } catch (e) {
      console.warn('admin metrics engagement: GitHub aggregation failed:', e?.message || e);
    }

    if (!token) {
      try {
        let entries = [];
        try { entries = await fsp.readdir(LOCAL_DATA_DIR, { withFileTypes: true }); } catch (_) { entries = []; }

        const userFiles = entries.filter(e => e.isFile() && String(e.name || '').toLowerCase().endsWith('.json'));
        const userDirs = entries.filter(e => e.isDirectory());
        const dirSet = new Set(userDirs.map(d => d.name.toLowerCase()));

        for (const uf of userFiles) {
          const prefix = uf.name.replace(/\.json$/i, '').toLowerCase();
          let profileObj = {};
          try {
            const fp = path.join(LOCAL_DATA_DIR, uf.name);
            const str = await fsp.readFile(fp, 'utf8');
            try { profileObj = JSON.parse(str); } catch (_) { profileObj = {}; }
          } catch (_) { profileObj = {}; }

          addRank(profileObj?.rsRank || profileObj?.rank);
          pushRecent(profileObj);

          let evalCount = 0;
          let avgSum = 0;
          let avgCount = 0;
          if (dirSet.has(prefix)) {
            const evalDir = path.join(LOCAL_DATA_DIR, prefix, 'evaluations');
            let evalEntries = [];
            try { evalEntries = await fsp.readdir(evalDir, { withFileTypes: true }); } catch (_) { evalEntries = []; }
            for (const ent of evalEntries) {
              if (!ent.isFile()) continue;
              const name = ent.name || '';
              if (!name.toLowerCase().endsWith('.json')) continue;
              const efp = path.join(evalDir, name);
              try {
                const estr = await fsp.readFile(efp, 'utf8');
                let obj = {};
                try { obj = JSON.parse(estr); } catch (_) { obj = {}; }
                const ev = obj && obj.evaluation ? obj.evaluation : obj;
                const avgStr = ev?.fitrepAverage;
                const avgNum = avgStr !== undefined ? parseFloat(avgStr) : NaN;
                if (Number.isFinite(avgNum)) { avgSum += avgNum; avgCount += 1; }
                evalCount += 1;
              } catch (_) { /* ignore */ }
            }
          }

          topUsers.push({
            email: profileObj?.rsEmail || profileObj?.email || '',
            name: profileObj?.rsName || profileObj?.name || prefix,
            rank: profileObj?.rsRank || profileObj?.rank || '',
            evaluationCount: evalCount,
            avgScore: (avgCount > 0 ? parseFloat((avgSum / avgCount).toFixed(2)) : 0)
          });
        }
      } catch (e) {
        console.warn('admin metrics engagement: local aggregation failed:', e?.message || e);
      }
    }

    // Post-process: sort and limit lists
    topUsers.sort((a,b) => (b.evaluationCount - a.evaluationCount) || (b.avgScore - a.avgScore));
    const topUsersLimited = topUsers.slice(0, 5);

    recentRegistrations.sort((a,b) => {
      const at = Date.parse(a.createdDate || '') || 0;
      const bt = Date.parse(b.createdDate || '') || 0;
      return bt - at;
    });
    const recentLimited = recentRegistrations.slice(0, 5);

    return res.json({
      ok: true,
      topUsers: topUsersLimited,
      recentRegistrations: recentLimited,
      userRankDistribution
    });
  } catch (err) {
    console.error('admin metrics engagement error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List users with minimal fields and evaluation counts
router.get('/users/list', adminReadRateLimit, requireAdmin, async (req, res) => {
  try {
    const token = SERVER_DATA_TOKEN || '';

    // Validate and sanitize input parameters
    const pagination = validatePagination(req.query.page, req.query.pageSize);
    const page = pagination.page;
    const pageSize = pagination.pageSize;

    const q = sanitizeSearchQuery(req.query.q || '').toLowerCase();
    const rankFilter = sanitizeString(req.query.rank || '', 50).toLowerCase();
    const sort = validateSortField(req.query.sort, ['name', 'username', 'email', 'evalCount', 'created']);

    // Helper to normalize a user record
    const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || 'semperadmin').trim().toLowerCase();
    function normalizeUser(prefix, obj) {
      const name = obj?.rsName || obj?.name || '';
      const email = obj?.rsEmail || obj?.email || '';
      const rank = obj?.rsRank || obj?.rank || '';
      const created = obj?.createdDate || obj?.created || '';
      const lastUpdated = obj?.lastUpdated || '';
      const isAdmin = obj?.isAdmin === true || prefix === ADMIN_USERNAME;
      const type = isAdmin ? 'Admin' : 'User';
      const deleted = obj?.deleted === true;
      return { username: prefix, name, email, rank, created, lastUpdated, evalCount: 0, status: obj?.status || '', isAdmin, type, deleted };
    }

    // Aggregate users either from GitHub or local filesystem
    let users = [];
    // Prefer GitHub-backed aggregation (attempt without token for public repos; include token when provided)
    try {
      const listUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users`;
      const resp = await fetch(listUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.warn('admin users list: users root failed:', text);
        throw new Error('GitHub list failed');
      }
      const items = await resp.json();
      const files = Array.isArray(items) ? items.filter(i => i.type === 'file' && String(i.name || '').toLowerCase().endsWith('.json')) : [];
      const dirs = Array.isArray(items) ? items.filter(i => i.type === 'dir') : [];

      // Map of prefix -> dir path to check evaluations
      const dirMap = new Map();
      for (const d of dirs) {
        const name = String(d.name || '').trim();
        if (name) dirMap.set(name.toLowerCase(), d.path);
      }

      for (const f of files) {
        const fname = String(f.name || '');
        const prefix = fname.replace(/\.json$/i, '').toLowerCase();
        try {
          const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${f.path}`;
          const fileResp = await fetch(fileApi, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          });
          if (!fileResp.ok) continue;
          const fileData = await fileResp.json();
          const contentStr = Buffer.from(fileData.content || '', 'base64').toString('utf8');
          let obj = {};
          try { obj = JSON.parse(contentStr); } catch (_) { obj = {}; }
          // Skip soft-deleted accounts
          if (obj && obj.deleted === true) {
            continue;
          }
          const u = normalizeUser(prefix, obj);
          // Count evaluations if directory exists
          const dpath = dirMap.get(prefix);
          if (dpath) {
            try {
              const evalDirUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${dpath}/evaluations`;
              const evalResp = await fetch(evalDirUrl, {
                headers: {
                  'Accept': 'application/vnd.github.v3+json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
              });
              if (evalResp.ok) {
                const evalItems = await evalResp.json();
                const evalFiles = Array.isArray(evalItems) ? evalItems.filter(e => e.type === 'file') : [];
                u.evalCount = evalFiles.length;
              }
            } catch (_) { /* ignore */ }
          }
          users.push(u);
        } catch (_) { /* ignore */ }
      }
    } catch (e) {
      console.warn('admin users list: GitHub aggregation failed, falling back to local if available:', e?.message || e);
      users = [];
    }

    if (!token) {
      try {
        let entries = [];
        try {
          entries = await fsp.readdir(LOCAL_DATA_DIR, { withFileTypes: true });
        } catch (_) {
          entries = [];
        }
        const userFiles = entries.filter(e => e.isFile() && String(e.name || '').toLowerCase().endsWith('.json'));
        const userDirs = entries.filter(e => e.isDirectory());
        const dirSet = new Set(userDirs.map(d => String(d.name || '').toLowerCase()));
        for (const ent of userFiles) {
          const fname = String(ent.name || '');
          const prefix = fname.replace(/\.json$/i, '').toLowerCase();
          const fp = path.join(LOCAL_DATA_DIR, fname);
          let obj = {};
          try {
            const str = await fsp.readFile(fp, 'utf8');
            obj = JSON.parse(str);
          } catch (_) { obj = {}; }
          // Skip soft-deleted accounts
          if (obj && obj.deleted === true) {
            continue;
          }
          const u = normalizeUser(prefix, obj);
          if (dirSet.has(prefix)) {
            const evalDir = path.join(LOCAL_DATA_DIR, prefix, 'evaluations');
            try {
              const evalEntries = await fsp.readdir(evalDir, { withFileTypes: true });
              const evalFiles = evalEntries.filter(e => e.isFile() && String(e.name || '').toLowerCase().endsWith('.json'));
              u.evalCount = evalFiles.length;
            } catch (_) { /* ignore */ }
          }
          users.push(u);
        }
      } catch (e) {
        console.warn('admin users list: local aggregation failed:', e?.message || e);
      }
    }

    // Filter by query
    if (q) {
      users = users.filter(u => (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q)
      ));
    }
    // Filter by rank (exact match, case-insensitive)
    if (rankFilter) {
      users = users.filter(u => String(u.rank || '').trim().toLowerCase() === rankFilter);
    }

    // Sort
    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    users.sort((a, b) => {
      switch (sort) {
        case 'username':
          return collator.compare(String(a.username || ''), String(b.username || ''));
        case 'email':
          return collator.compare(String(a.email || ''), String(b.email || ''));
        case 'evalCount':
          return (b.evalCount || 0) - (a.evalCount || 0);
        case 'created': {
          const ax = Date.parse(a.created || '') || 0;
          const bx = Date.parse(b.created || '') || 0;
          return bx - ax;
        }
        case 'name':
        default:
          return collator.compare(String(a.name || ''), String(b.name || ''));
      }
    });

    const total = users.length;
    const start = (page - 1) * pageSize;
    const end = Math.min(total, start + pageSize);
    const pageUsers = users.slice(start, end);

    return res.json({ ok: true, users: pageUsers, total, page, pageSize });
  } catch (err) {
    console.error('admin users list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft-delete a user account by setting deleted: true in their profile JSON
router.delete('/users/:username', adminWriteRateLimit, requireAdmin, async (req, res) => {
  try {
    const usernameRaw = sanitizeString(req.params.username || '', 50);
    if (!usernameRaw) return res.status(400).json({ error: 'Missing username' });
    if (!isValidUsername(usernameRaw)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    const prefix = usernameRaw.toLowerCase();
    const token = SERVER_DATA_TOKEN || '';
    const now = new Date().toISOString();

    if (token) {
      try {
        const filePath = `users/${prefix}.json`;
        const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${filePath}`;
        const getResp = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (getResp.status === 404) return res.status(404).json({ error: 'User not found' });
        if (!getResp.ok) {
          const text = await getResp.text();
          return res.status(502).json({ error: `Read failed: ${text}` });
        }
        const data = await getResp.json();
        const jsonStr = Buffer.from(data.content || '', 'base64').toString('utf8');
        let obj = {};
        try { obj = JSON.parse(jsonStr); } catch (_) { obj = {}; }
        obj.deleted = true;
        obj.lastUpdated = now;
        const bodyStr = JSON.stringify(obj, null, 2);
        const bodyB64 = Buffer.from(bodyStr, 'utf8').toString('base64');
        const putResp = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: `Soft-delete user via Admin - ${now}`, content: bodyB64, branch: 'main', sha: data.sha })
        });
        if (!putResp.ok) {
          const text = await putResp.text();
          return res.status(502).json({ error: `Write failed: ${text}` });
        }

        // Audit log: soft delete
        await auditLog({
          action: 'user_soft_delete',
          admin: String(req.sessionUser || ''),
          target: usernameRaw,
          ip: req.ip || req.connection?.remoteAddress,
          severity: 'warning',
          metadata: { method: 'github' }
        });

        return res.json({ ok: true, deleted: true, method: 'github' });
      } catch (e) {
        console.warn('admin delete: github path failed, falling back to local if available:', e?.message || e);
        // Fall through to local
      }
    }

    // Local filesystem fallback
    try {
      const fp = path.join(LOCAL_DATA_DIR, `${prefix}.json`);
      let obj = null;
      try {
        const str = await fsp.readFile(fp, 'utf8');
        obj = JSON.parse(str);
      } catch (_) {
        return res.status(404).json({ error: 'User not found' });
      }
      obj = { ...(obj || {}), deleted: true, lastUpdated: now };
      await fsp.writeFile(fp, JSON.stringify(obj, null, 2), 'utf8');

      // Audit log: soft delete (local)
      await auditLog({
        action: 'user_soft_delete',
        admin: String(req.sessionUser || ''),
        target: usernameRaw,
        ip: req.ip || req.connection?.remoteAddress,
        severity: 'warning',
        metadata: { method: 'local' }
      });

      return res.json({ ok: true, deleted: true, method: 'local' });
    } catch (err) {
      console.error('admin delete: local write failed:', err);
      return res.status(500).json({ error: 'Local write failed' });
    }
  } catch (err) {
    console.error('admin delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Hard-delete a user account: remove profile file and all evaluations (permanent)
router.delete('/users/:username/hard', adminWriteRateLimit, requireAdmin, async (req, res) => {
  try {
    const usernameRaw = sanitizeString(req.params.username || '', 50);
    if (!usernameRaw) return res.status(400).json({ error: 'Missing username' });
    if (!isValidUsername(usernameRaw)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // Prevent deleting primary admin account
    const adminUser = (process.env.ADMIN_USERNAME || 'semperadmin').toLowerCase();
    if (usernameRaw.toLowerCase() === adminUser) {
      return res.status(403).json({ error: 'Cannot hard-delete primary admin account' });
    }
    const prefix = usernameRaw.toLowerCase();
    const token = SERVER_DATA_TOKEN || '';
    const now = new Date().toISOString();

    if (token) {
      try {
        // Delete aggregate user file
        const userPath = `users/${prefix}.json`;
        const userApi = `https://api.github.com/repos/${DATA_REPO}/contents/${userPath}`;
        const userGet = await fetch(userApi, {
          headers: { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `Bearer ${token}` }
        });
        if (userGet.ok) {
          const meta = await userGet.json();
          const delResp = await fetch(userApi, {
            method: 'DELETE',
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: `Hard-delete user via Admin - ${now}`, branch: 'main', sha: meta.sha })
          });
          if (!delResp.ok) {
            const text = await delResp.text();
            return res.status(502).json({ error: `Delete user file failed: ${text}` });
          }
        }

        // Delete evaluations files (if present)
        let removedFiles = 0;
        const evalDirApi = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}/evaluations`;
        const evalList = await fetch(evalDirApi, { headers: { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `Bearer ${token}` } });
        if (evalList.ok) {
          const items = await evalList.json();
          const files = Array.isArray(items) ? items.filter(i => i.type === 'file') : [];
          for (const f of files) {
            try {
              const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${f.path}`;
              const delFile = await fetch(fileApi, {
                method: 'DELETE',
                headers: {
                  'Accept': 'application/vnd.github.v3+json',
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: `Hard-delete evaluation via Admin - ${now}`, branch: 'main', sha: f.sha })
              });
              if (delFile.ok) removedFiles += 1;
            } catch (_) { /* ignore per-file errors */ }
          }
        }

        // Audit log: CRITICAL - hard delete (GitHub)
        await auditLog({
          action: 'user_hard_delete',
          admin: String(req.sessionUser || ''),
          target: usernameRaw,
          ip: req.ip || req.connection?.remoteAddress,
          severity: 'critical',
          metadata: { method: 'github', removedFiles }
        });

        return res.json({ ok: true, deleted: true, hard: true, method: 'github' });
      } catch (e) {
        console.warn('admin hard-delete: github path failed, falling back to local if available:', e?.message || e);
        // Fall through to local
      }
    }

    // Local filesystem: remove file and directory recursively
    try {
      const fp = path.join(LOCAL_DATA_DIR, `${prefix}.json`);
      try { await fsp.unlink(fp); } catch (_) { /* ignore missing file */ }
      const userDir = path.join(LOCAL_DATA_DIR, prefix);
      try { await fsp.rm(userDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }

      // Audit log: CRITICAL - hard delete (local)
      await auditLog({
        action: 'user_hard_delete',
        admin: String(req.sessionUser || ''),
        target: usernameRaw,
        ip: req.ip || req.connection?.remoteAddress,
        severity: 'critical',
        metadata: { method: 'local' }
      });

      return res.json({ ok: true, deleted: true, hard: true, method: 'local' });
    } catch (err) {
      console.error('admin hard-delete: local removal failed:', err);
      return res.status(500).json({ error: 'Local removal failed' });
    }
  } catch (err) {
    console.error('admin hard-delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
