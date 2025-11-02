// Load environment variables from .env for local/dev usage
try { require('dotenv').config(); } catch (_) { /* dotenv optional in prod */ }
const express = require('express');
// Support node-fetch v3 in CommonJS via dynamic import wrapper
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
// Serve static files for local preview
app.use(express.static('.'));

// Basic CORS support to allow cross-origin usage when hosted on static origins
// Hardened CORS: allow only configured origins (or default server origin)
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const defaultOrigin = `http://localhost:${process.env.PORT || 5173}`;
  const allowedOrigins = CORS_ORIGINS.length ? CORS_ORIGINS : [defaultOrigin];
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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

    // Prefer direct write with FITREP_DATA if available
    const fitrepToken = process.env.FITREP_DATA;
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
    if (!DISPATCH_TOKEN) {
      console.error('create-account: Missing DISPATCH_TOKEN');
      return res.status(500).json({ error: 'Server missing DISPATCH_TOKEN' });
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
        'Authorization': `Bearer ${DISPATCH_TOKEN}`,
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
    const token = process.env.FITREP_DATA;
    if (!token) {
      console.error('login: Missing FITREP_DATA');
      return res.status(500).json({ error: 'Server missing FITREP_DATA for login' });
    }

    const prefix = sanitizePrefix(email);
    const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
    const resp = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (resp.status === 404) {
      return res.status(401).json({ error: 'Account not found' });
    }
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: `Read failed: ${text}` });
    }
    const data = await resp.json();
    const fileContentBase64 = data.content;
    const jsonStr = Buffer.from(fileContentBase64, 'base64').toString('utf8');
    const user = JSON.parse(jsonStr);

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

    const fitrepToken = process.env.FITREP_DATA;
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
        rsName: userData.rsName || existingUser?.rsName || '',
        rsRank: userData.rsRank || existingUser?.rsRank || '',
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

    console.error('save user: Missing FITREP_DATA and DISPATCH_TOKEN');
    return res.status(500).json({ error: 'Server missing FITREP_DATA or DISPATCH_TOKEN' });
  } catch (err) {
    console.error('save user error:', err);
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
  app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
}

module.exports = app;
