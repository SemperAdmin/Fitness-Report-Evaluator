// Load environment variables from .env for local/dev usage
try { require('dotenv').config(); } catch (_) { /* dotenv optional in prod */ }
const express = require('express');
// Support node-fetch v3 in CommonJS via dynamic import wrapper
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const fsp = fs.promises;

const app = express();
app.use(express.json());

// Debug request logger (temporary)
app.use((req, res, next) => {
  try {
    console.log(`[req] ${req.method} ${req.url}`);
  } catch (_) { /* no-op */ }
  next();
});

// Basic CORS support to allow cross-origin usage when hosted on static origins
// Hardened CORS: allow only configured origins (or default server origin)
// If CORS_ORIGINS is unset or empty, default to allowing all origins ('*')
const CORS_ORIGINS_RAW = (process.env.CORS_ORIGINS || '');
const CORS_ORIGINS = CORS_ORIGINS_RAW
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
// Allow all origins when '*' specified OR when no origins configured
const CORS_ALLOW_ALL = CORS_ORIGINS.includes('*') || CORS_ORIGINS.length === 0;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const defaultOrigin = `http://localhost:${process.env.PORT || 5173}`;
  // Include GitHub Pages origin by default to support static hosting
  const pagesOrigin = 'https://semperadmin.github.io';
  const allowedOrigins = CORS_ALLOW_ALL
    ? ['*']
    : (CORS_ORIGINS.length ? CORS_ORIGINS : [defaultOrigin, pagesOrigin]);

  const isAllowed = !CORS_ALLOW_ALL && (origin && allowedOrigins.includes(origin));

  // Always set standard CORS method allowances
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  // Build allowed headers dynamically, echoing requested headers when present
  const requestedHeaders = req.headers['access-control-request-headers'];
  const baseAllowed = ['Content-Type', 'Accept', 'X-GitHub-Token'];
  const allowHeaderValue = requestedHeaders
    ? Array.from(new Set([...baseAllowed, ...requestedHeaders.split(',').map(h => h.trim()).filter(Boolean)])).join(', ')
    : baseAllowed.join(', ');
  res.header('Access-Control-Allow-Headers', allowHeaderValue);

  // Prefer explicit allowlist, but ensure preflight never fails due to missing ACAO
  if (origin) {
    if (CORS_ALLOW_ALL) {
      // Explicitly allow all origins when no CORS_ORIGINS configured or '*' provided
      res.header('Access-Control-Allow-Origin', '*');
    } else if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else if (req.method === 'OPTIONS') {
      // Be permissive for preflight so the browser proceeds to the actual request,
      // where origin enforcement will apply via missing ACAO on non-allowed origins.
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
  } else if (CORS_ALLOW_ALL) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Note: do NOT serve static files before API routes, or POSTs to /api/*
// may get intercepted and return 405 from the static middleware. We'll
// mount static at the end after defining API routes.

// Environment variables:
// - DISPATCH_TOKEN: PAT with repo:dispatch permission to trigger repository_dispatch
// - FITREP_DATA (optional, for login): PAT with repo read access to the data repository
// - DATA_REPO: owner/repo for data storage, default: SemperAdmin/Fitness-Report-Evaluator-Data
// - MAIN_REPO: owner/repo to dispatch events to, default: SemperAdmin/Fitness-Report-Evaluator

const DISPATCH_TOKEN = process.env.DISPATCH_TOKEN;
const DATA_REPO = process.env.DATA_REPO || 'SemperAdmin/Fitness-Report-Evaluator-Data';
const MAIN_REPO = process.env.MAIN_REPO || 'SemperAdmin/Fitness-Report-Evaluator';

console.log('[env] MAIN_REPO:', MAIN_REPO);
console.log('[env] DATA_REPO:', DATA_REPO);
console.log('[env] DISPATCH_TOKEN set:', Boolean(DISPATCH_TOKEN));
console.log('[env] FITREP_DATA set:', Boolean(process.env.FITREP_DATA));
console.log('[env] ALLOW_DEV_TOKEN:', process.env.ALLOW_DEV_TOKEN === 'true');
console.log('[env] CORS_ORIGINS:', (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));

function emailPrefix(email) {
  return String(email || '').trim().toLowerCase().split('@')[0];
}

// --- Local filesystem fallback storage (no-env/dev friendly) ---
const LOCAL_DATA_DIR = path.join(__dirname, 'local-data', 'users');
async function ensureLocalDir() {
  try { await fsp.mkdir(LOCAL_DATA_DIR, { recursive: true }); } catch (_) {}
}
function localUserPath(prefix) {
  return path.join(LOCAL_DATA_DIR, `${prefix}.json`);
}
async function readLocalUser(prefix) {
  try {
    const p = localUserPath(prefix);
    const buf = await fsp.readFile(p);
    return JSON.parse(buf.toString('utf8'));
  } catch (_) {
    return null;
  }
}
async function writeLocalUser(prefix, userObj) {
  await ensureLocalDir();
  const p = localUserPath(prefix);
  const str = JSON.stringify(userObj, null, 2);
  await fsp.writeFile(p, str, 'utf8');
}

// Lightweight rate limiter per IP
function rateLimit({ windowMs, limit }) {
  const hits = new Map();

  // Periodically clean up expired entries to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits.entries()) {
      if (now > entry.reset) {
        hits.delete(ip);
      }
    }
  }, windowMs * 2); // Run cleanup every 2 windows

  // Ensure interval doesn't keep Node.js process alive if it's the only thing running
  cleanupInterval.unref();

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
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}
const authRateLimit = rateLimit({ windowMs: 60_000, limit: 30 });
const saveRateLimit = rateLimit({ windowMs: 60_000, limit: 60 });

app.post('/api/account/create', authRateLimit, async (req, res) => {
  try {
    const { rank, name, email, password } = req.body || {};
    if (!rank || !name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields: rank, name, email, password' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!isValidRank(rank) || !isValidName(name)) {
      return res.status(400).json({ error: 'Invalid rank or name' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with upper, lower, and number' });
    }
    const passwordHash = await bcrypt.hash(password, 12);

    // Prefer direct write with FITREP_DATA when available
    // Prefer server token; otherwise accept client-provided token via header/body for dev/no-env usage
    const fitrepToken = process.env.FITREP_DATA || req.headers['x-github-token'] || req.body?.token || '';
    if (fitrepToken) {
      try {
        const prefix = sanitizePrefix(email);
        const filePath = `users/${prefix}.json`;
        const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${filePath}`;

        // Get existing SHA if present
        let sha = '';
        const getResp = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${fitrepToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (getResp.status === 200) {
          const existing = await getResp.json();
          sha = existing.sha || '';
        } else if (getResp.status !== 404 && !getResp.ok) {
          const text = await getResp.text();
          console.error('create-account: get SHA failed:', text);
          return res.status(502).json({ error: `Read failed: ${text}` });
        }

        const now = new Date().toISOString();
        const userJson = {
          rsEmail: email,
          rsName: name,
          rsRank: rank,
          passwordHash,
          evaluationFiles: [],
          evaluations: [],
          createdDate: now,
          lastUpdated: now
        };

        const contentStr = JSON.stringify(userJson, null, 2);
        const contentB64 = Buffer.from(contentStr, 'utf8').toString('base64');
        const msg = sha ? `Update user via Server - ${now}` : `Create user via Server - ${now}`;
        const body = { message: msg, content: contentB64, branch: 'main', ...(sha && { sha }) };

        const putResp = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${fitrepToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        if (!putResp.ok) {
          const text = await putResp.text();
          console.error('create-account: put failed:', text);
          return res.status(502).json({ error: `Write failed: ${text}` });
        }
        const result = await putResp.json();
        return res.json({ ok: true, path: result?.content?.path || filePath, commit: result?.commit?.sha || null, method: 'direct' });
      } catch (err) {
        console.error('create-account direct write error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // Fallback: repository_dispatch when direct write not possible
    const dispatchToken = DISPATCH_TOKEN;
    if (!dispatchToken) {
      // No dispatch flow available, and no server token: we already tried client token above.
      // If none provided, fallback to local filesystem for dev/no-env usage.
      try {
        const prefix = sanitizePrefix(email);
        const now = new Date().toISOString();
        const userJson = {
          rsEmail: email,
          rsName: name,
          rsRank: rank,
          passwordHash,
          evaluationFiles: [],
          evaluations: [],
          createdDate: now,
          lastUpdated: now
        };
        await writeLocalUser(prefix, userJson);
        return res.json({ ok: true, path: `local:${prefix}.json`, method: 'local' });
      } catch (err) {
        console.error('create-account: local write error:', err);
        return res.status(500).json({ error: 'Local write failed' });
      }
    }

    const payload = {
      event_type: 'create-user',
      client_payload: {
        user: { rsRank: rank, rsName: name, rsEmail: email, passwordHash }
      }
    };

    const resp = await fetch(`https://api.github.com/repos/${MAIN_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dispatchToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('create-account: dispatch failed:', text);
      return res.status(502).json({ error: `Dispatch failed: ${text}` });
    }

    return res.json({ ok: true, dispatched: true, method: 'dispatch' });
  } catch (err) {
    console.error('create account error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/account/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields: email, password' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const prefix = sanitizePrefix(email);
    // Try GitHub first. Use server token if present; otherwise accept client-provided token; else anonymous for public.
    let user = null;
    try {
      const token = process.env.FITREP_DATA || req.headers['x-github-token'] || req.body?.token || '';
      const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
      const headers = { 'Accept': 'application/vnd.github+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(apiUrl, { headers });
      if (resp.status === 200) {
        const data = await resp.json();
        const fileContentBase64 = data.content;
        const jsonStr = Buffer.from(fileContentBase64, 'base64').toString('utf8');
        user = JSON.parse(jsonStr);
      } else if (resp.status !== 404 && !resp.ok) {
        const text = await resp.text();
        console.error('login: github read failed:', text);
      }
    } catch (err) {
      console.error('login: github fetch error:', err);
    }
  // If not found on GitHub, try local filesystem fallback
  if (!user) {
    user = await readLocalUser(prefix);
  }
  if (!user) {
    return res.status(401).json({ error: 'Account not found' });
  }
  // Guard against missing or invalid password hash (e.g., accounts created without backend)
  if (!user.passwordHash || typeof user.passwordHash !== 'string' || !user.passwordHash.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

    return res.json({
      ok: true,
      profile: {
        rsName: user.rsName,
        rsEmail: user.rsEmail,
        rsRank: user.rsRank,
        lastUpdated: user.lastUpdated || new Date().toISOString(),
        totalEvaluations: (user.evaluations || []).length,
        evaluationFiles: user.evaluationFiles || []
      },
      evaluations: user.evaluations || []
    });
  } catch (err) {
    console.error('account login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple health endpoint for debugging env and basic readiness
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    MAIN_REPO,
    DATA_REPO,
    hasDispatchToken: Boolean(DISPATCH_TOKEN),
    hasFitrepData: Boolean(process.env.FITREP_DATA),
    allowDevToken: process.env.ALLOW_DEV_TOKEN === 'true'
  });
});

// Development-only endpoint to provide a GitHub token to the client.
// This should NEVER be enabled in production.
app.get('/api/github-token', (req, res) => {
  try {
    const allow = process.env.ALLOW_DEV_TOKEN === 'true';
    const token = process.env.FITREP_DATA || '';
    if (!allow) {
      return res.status(403).json({ error: 'Token exposure disabled. Set ALLOW_DEV_TOKEN=true for local dev only.' });
    }
    if (!token) {
      return res.status(500).json({ error: 'Server missing FITREP_DATA token' });
    }
    return res.json({ token });
  } catch (err) {
    console.error('github-token error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: build data JSON compatible with data repo schema
function buildUserDataJson(userData) {
  const now = new Date().toISOString();
  const evaluations = Array.isArray(userData.evaluations) ? userData.evaluations : [];
  return {
    version: '1.0',
    lastUpdated: now,
    profile: {
      rsName: userData.rsName || '',
      rsEmail: userData.rsEmail || '',
      rsRank: userData.rsRank || '',
      totalEvaluations: evaluations.length
    },
    evaluations,
    metadata: {
      exportedAt: now,
      exportedBy: userData.rsName || '',
      applicationVersion: '1.0'
    }
  };
}

function sanitizePrefix(email) {
  const prefix = String(email || '').trim().toLowerCase().split('@')[0];
  return prefix.replace(/[^a-z0-9]/gi, '_');
}

// Simple input validation helpers
function isValidEmail(email) {
  const e = String(email || '').trim();
  if (e.length < 5 || e.length > 254) return false;
  // More strict regex that disallows whitespace and requires proper email format
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function isStrongPassword(pw) {
  const p = String(pw || '');
  if (p.length < 8) return false;
  const hasLower = /[a-z]/.test(p);
  const hasUpper = /[A-Z]/.test(p);
  const hasDigit = /\d/.test(p);
  return hasLower && hasUpper && hasDigit;
}
function isValidName(name) {
  const n = String(name || '').trim();
  return n.length >= 2 && n.length <= 100;
}
function isValidRank(rank) {
  const r = String(rank || '').trim();
  return r.length >= 2 && r.length <= 20;
}

// Build updated aggregate user object by merging a new evaluation
// Preserves passwordHash and createdDate from existing user when present
function buildUpdatedUserAggregate(userEmail, evaluation, existingUser, newEvaluationFilePath, now) {
  const base = {
    rsEmail: userEmail,
    rsName: evaluation?.rsInfo?.name ?? existingUser?.rsName ?? '',
    rsRank: evaluation?.rsInfo?.rank ?? existingUser?.rsRank ?? '',
    evaluations: Array.isArray(existingUser?.evaluations) ? existingUser.evaluations.slice() : []
  };
  const idx = base.evaluations.findIndex(e => e && e.evaluationId === evaluation.evaluationId);
  if (idx >= 0) {
    base.evaluations[idx] = evaluation;
  } else {
    base.evaluations.push(evaluation);
  }
  const obj = {
    rsEmail: base.rsEmail,
    rsName: base.rsName,
    rsRank: base.rsRank,
    evaluations: base.evaluations,
    evaluationFiles: Array.isArray(existingUser?.evaluationFiles)
      ? Array.from(new Set([...existingUser.evaluationFiles, newEvaluationFilePath]))
      : [newEvaluationFilePath],
    createdDate: existingUser?.createdDate || now,
    lastUpdated: now
  };
  if (existingUser?.passwordHash) {
    obj.passwordHash = existingUser.passwordHash;
  }
  return obj;
}

// Save user data: either direct write via FITREP_DATA or dispatch workflow via DISPATCH_TOKEN
app.post('/api/user/save', saveRateLimit, async (req, res) => {
  try {
    const { userData } = req.body || {};
    if (!userData || !userData.rsEmail) {
      return res.status(400).json({ error: 'Missing userData.rsEmail' });
    }
    if (!isValidEmail(userData.rsEmail)) {
      return res.status(400).json({ error: 'Invalid rsEmail format' });
    }

    const fitrepToken = process.env.FITREP_DATA || req.headers['x-github-token'] || req.body?.token || '';
    const dispatchToken = DISPATCH_TOKEN;

    // Prefer direct write when FITREP_DATA is available
    if (fitrepToken) {
      const prefix = sanitizePrefix(userData.rsEmail);
      const filePath = `users/${prefix}.json`;
      const apiBase = `https://api.github.com/repos/${DATA_REPO}/contents/${filePath}`;

      // Try to get existing SHA and existing file for preserving fields like passwordHash
      let sha = '';
      let existingUser = null;
      const getResp = await fetch(apiBase, {
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getResp.status === 200) {
        const existing = await getResp.json();
        sha = existing.sha || '';
        try {
          const existingStr = Buffer.from(existing.content || '', 'base64').toString('utf8');
          existingUser = existingStr ? JSON.parse(existingStr) : null;
        } catch (_) {
          existingUser = null;
        }
      } else if (getResp.status !== 404 && !getResp.ok) {
        const text = await getResp.text();
        console.error('save user: get SHA failed:', text);
        return res.status(502).json({ error: `Read failed: ${text}` });
      }

      // Build new data preserving flat structure and critical fields
      const now = new Date().toISOString();
      const bodyObj = {
        rsEmail: userData.rsEmail,
        rsName: userData.rsName ?? existingUser?.rsName ?? '',
        rsRank: userData.rsRank ?? existingUser?.rsRank ?? '',
        evaluations: Array.isArray(userData.evaluations) ? userData.evaluations : (existingUser?.evaluations || []),
        evaluationFiles: existingUser?.evaluationFiles || [],
        createdDate: existingUser?.createdDate || now,
        lastUpdated: now
      };

      // SECURITY: Only preserve passwordHash from existing user, never from client input
      if (existingUser?.passwordHash) {
        bodyObj.passwordHash = existingUser.passwordHash;
      }

      const contentStr = JSON.stringify(bodyObj, null, 2);
      const contentB64 = Buffer.from(contentStr, 'utf8').toString('base64');
      const msg = sha ? `Update profile via Server - ${new Date().toISOString()}` : `Create profile via Server - ${new Date().toISOString()}`;
      const putBody = { message: msg, content: contentB64, branch: 'main', ...(sha && { sha }) };

      const putResp = await fetch(apiBase, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });
      if (!putResp.ok) {
        const text = await putResp.text();
        console.error('save user: put failed:', text);
        return res.status(502).json({ error: `Write failed: ${text}` });
      }
      const result = await putResp.json();
      return res.json({ ok: true, path: result?.content?.path || filePath, commit: result?.commit?.sha || null, method: 'direct' });
    }

    // Fallback: dispatch workflow when direct write is not possible
    if (dispatchToken) {
      const payload = {
        event_type: 'save-user-data',
        client_payload: { userData }
      };
      const resp = await fetch(`https://api.github.com/repos/${MAIN_REPO}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dispatchToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error('save user: dispatch failed:', text);
        return res.status(502).json({ error: `Dispatch failed: ${text}` });
      }
      return res.json({ ok: true, dispatched: true, method: 'dispatch' });
    }

    // Local filesystem fallback when no tokens are available
    try {
      const prefix = sanitizePrefix(userData.rsEmail);
      // Merge with existing local user to preserve passwordHash
      const existingUser = await readLocalUser(prefix);
      const now = new Date().toISOString();
      const bodyObj = {
        rsEmail: userData.rsEmail,
        rsName: userData.rsName ?? existingUser?.rsName ?? '',
        rsRank: userData.rsRank ?? existingUser?.rsRank ?? '',
        evaluations: Array.isArray(userData.evaluations) ? userData.evaluations : (existingUser?.evaluations || []),
        evaluationFiles: existingUser?.evaluationFiles || [],
        createdDate: existingUser?.createdDate || now,
        lastUpdated: now
      };
      if (existingUser?.passwordHash) {
        bodyObj.passwordHash = existingUser.passwordHash;
      }
      await writeLocalUser(prefix, bodyObj);
      return res.json({ ok: true, path: `local:${prefix}.json`, method: 'local' });
    } catch (err) {
      console.error('save user: local write failed:', err);
      return res.status(500).json({ error: 'Local write failed' });
    }
  } catch (err) {
    console.error('save user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Save a single evaluation as a unique file and update aggregate user file
// Path: users/{email_local}/evaluations/{evaluationId}.json
app.post('/api/evaluation/save', saveRateLimit, async (req, res) => {
  try {
    const { evaluation, userEmail } = req.body || {};
    if (!evaluation || !evaluation.evaluationId) {
      return res.status(400).json({ error: 'Missing evaluation.evaluationId' });
    }
    if (!userEmail || !isValidEmail(userEmail)) {
      return res.status(400).json({ error: 'Invalid or missing userEmail' });
    }

    const fitrepToken = process.env.FITREP_DATA || req.headers['x-github-token'] || req.body?.token || '';

    // Helper: safe local-part for directory naming and file names
    const prefix = sanitizePrefix(userEmail);
    const evalIdSafe = String(evaluation.evaluationId).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filePath = `users/${prefix}/evaluations/${evalIdSafe}.json`;

    // Attempt direct write via GitHub Contents API when token available
    if (fitrepToken) {
      const apiBase = `https://api.github.com/repos/${DATA_REPO}/contents/${filePath}`;

      // Check for existing file SHA
      let existingSha = '';
      const getResp = await fetch(apiBase, {
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getResp.status === 200) {
        const existing = await getResp.json();
        existingSha = existing.sha || '';
      } else if (getResp.status !== 404 && !getResp.ok) {
        const text = await getResp.text();
        console.error('save evaluation: get SHA failed:', text);
        return res.status(502).json({ error: `Read failed: ${text}` });
      }

      // Build content payload with minimal metadata + evaluation
      const contentStr = JSON.stringify({
        version: '1.0',
        savedAt: new Date().toISOString(),
        rsEmail: userEmail,
        rsName: evaluation?.rsInfo?.name || '',
        rsRank: evaluation?.rsInfo?.rank || '',
        evaluation
      }, null, 2);
      const contentB64 = Buffer.from(contentStr, 'utf8').toString('base64');
      const msg = existingSha
        ? `Update evaluation ${evaluation.evaluationId} for ${userEmail}`
        : `Create evaluation ${evaluation.evaluationId} for ${userEmail}`;
      const putBody = { message: msg, content: contentB64, branch: 'main', ...(existingSha && { sha: existingSha }) };

      const putResp = await fetch(apiBase, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      });
      if (!putResp.ok) {
        const text = await putResp.text();
        console.error('save evaluation: put failed:', text);
        return res.status(502).json({ error: `Write failed: ${text}` });
      }
      const putResult = await putResp.json();

      // Also update aggregate user file to include/merge this evaluation
      const userApi = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
      let userSha = '';
      let existingUser = null;
      const userGet = await fetch(userApi, {
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (userGet.status === 200) {
        const existing = await userGet.json();
        userSha = existing.sha || '';
        try {
          const existingStr = Buffer.from(existing.content || '', 'base64').toString('utf8');
          existingUser = existingStr ? JSON.parse(existingStr) : null;
        } catch (_) {
          existingUser = null;
        }
      } else if (userGet.status !== 404 && !userGet.ok) {
        const text = await userGet.text();
        console.warn('save evaluation: read aggregate failed:', text);
        // Continue without blocking unique file save
      }

      const bodyObj = buildUpdatedUserAggregate(userEmail, evaluation, existingUser, filePath);
      const now = new Date().toISOString();
      const bodyStr = JSON.stringify(bodyObj, null, 2);
      const bodyB64 = Buffer.from(bodyStr, 'utf8').toString('base64');
      const aggMsg = userSha ? `Update profile via Server - ${now}` : `Create profile via Server - ${now}`;
      const userPutBody = { message: aggMsg, content: bodyB64, branch: 'main', ...(userSha && { sha: userSha }) };

      const userPut = await fetch(userApi, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userPutBody)
      });
      if (!userPut.ok) {
        const text = await userPut.text();
        console.warn('save evaluation: aggregate put failed (non-blocking):', text);
      }

      return res.json({ ok: true, path: putResult?.content?.path || filePath, commit: putResult?.commit?.sha || null, method: 'direct' });
    }

    // Local filesystem fallback when no tokens are available
    try {
      const now = new Date().toISOString();
      const evalDir = path.join(LOCAL_DATA_DIR, prefix, 'evaluations');
      try { await fsp.mkdir(evalDir, { recursive: true }); } catch (err) { console.warn('Could not create local eval directory, may fail if it does not exist:', err); }
      const evalPath = path.join(evalDir, `${evalIdSafe}.json`);
      const evalStr = JSON.stringify({
        version: '1.0',
        savedAt: now,
        rsEmail: userEmail,
        rsName: evaluation?.rsInfo?.name || '',
        rsRank: evaluation?.rsInfo?.rank || '',
        evaluation
      }, null, 2);
      await fsp.writeFile(evalPath, evalStr, 'utf8');

      // Update aggregate local user file
      const existingUser = await readLocalUser(prefix);
      const localEvalPath = `local:${prefix}/evaluations/${evalIdSafe}.json`;
      const bodyObj = buildUpdatedUserAggregate(userEmail, evaluation, existingUser, localEvalPath);
      await writeLocalUser(prefix, bodyObj);

      return res.json({ ok: true, path: `local:${prefix}/evaluations/${evalIdSafe}.json`, method: 'local' });
    } catch (err) {
      console.error('save evaluation: local write failed:', err);
      return res.status(500).json({ error: 'Local write failed' });
    }
  } catch (err) {
    console.error('save evaluation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Load user data via server using FITREP_DATA
app.get('/api/user/load', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ error: 'Missing email query param' });
    const token = process.env.FITREP_DATA;
    if (!token) return res.status(500).json({ error: 'Server missing FITREP_DATA' });

    const prefix = sanitizePrefix(email);
    const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
    const resp = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (resp.status === 404) return res.status(404).json({ error: 'Not found' });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: `Read failed: ${text}` });
    }
    const data = await resp.json();
    const jsonStr = Buffer.from(data.content, 'base64').toString('utf8');
    const obj = JSON.parse(jsonStr);
    return res.json({ ok: true, data: obj });
  } catch (err) {
    console.error('load user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server if executed directly
if (require.main === module) {
  const port = process.env.PORT || 5173;
  // Serve static files for local preview after all API routes
  app.use(express.static('.'));
  app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
}

module.exports = app;
