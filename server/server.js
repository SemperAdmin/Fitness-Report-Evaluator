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
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
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

function emailPrefix(email) {
  return String(email || '').trim().toLowerCase().split('@')[0];
}

app.post('/api/account/create', async (req, res) => {
  try {
    const { rank, name, email, password } = req.body || {};
    if (!rank || !name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields: rank, name, email, password' });
    }
    if (!DISPATCH_TOKEN) {
      console.error('create-account: Missing DISPATCH_TOKEN');
      return res.status(500).json({ error: 'Server missing DISPATCH_TOKEN' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
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

    return res.json({ ok: true });
  } catch (err) {
    console.error('create account error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/account/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields: email, password' });
    }
    const token = process.env.FITREP_DATA;
    if (!token) {
      console.error('login: Missing FITREP_DATA');
      return res.status(500).json({ error: 'Server missing FITREP_DATA for login' });
    }

    const prefix = emailPrefix(email);
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

// Start server if executed directly
if (require.main === module) {
  const port = process.env.PORT || 5173;
  app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
}

module.exports = app;
