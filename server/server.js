// Load environment variables from .env for local/dev usage
try { require('dotenv').config(); } catch (_) { /* dotenv optional in prod */ }
const express = require('express');
// Support node-fetch v3 in CommonJS via dynamic import wrapper
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const bcrypt = require('bcryptjs');
const yaml = require('js-yaml');
const fs = require('fs');
const os = require('os');
const path = require('path');
const fsp = fs.promises;
const crypto = require('crypto');
// Centralized constants (isomorphic: shared with frontend)
let CONSTANTS;
try { CONSTANTS = require('../js/constants.js'); } catch (_) { CONSTANTS = null; }

const app = express();
app.use(express.json());
// Accept URL-encoded bodies to enable simple cross-origin POST without preflight
// This helps login work even if the browser blocks preflight on some devices/networks.
app.use(express.urlencoded({ extended: true }));

// Basic CORS support to allow cross-origin usage when hosted on static origins
// Hardened CORS: allow only configured origins (or default server origin)
// If CORS_ORIGINS is unset or empty, default to allowing all origins ('*')
const CORS_ORIGINS_RAW = (process.env.CORS_ORIGINS || '');
// Sanitize configured origins: remove surrounding quotes/backticks and trailing slashes
const CORS_ORIGINS = CORS_ORIGINS_RAW
  .split(',')
  .map(s => s.trim())
  .map(s => s.replace(/^['"`]+|['"`]+$/g, ''))
  .map(s => s.replace(/\/$/, ''))
  .filter(Boolean);
// Allow all origins when '*' specified OR when no origins configured
const CORS_ALLOW_ALL = CORS_ORIGINS.includes('*') || CORS_ORIGINS.length === 0;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const defaultOrigin = `http://localhost:${process.env.PORT || (CONSTANTS && CONSTANTS.API_CONFIG && CONSTANTS.API_CONFIG.DEFAULT_LOCAL_PORT) || 5173}`;
  // Include common static hosting origins by default when an allowlist is present
  const allowedOrigins = CORS_ALLOW_ALL
    ? ['*']
    : (CORS_ORIGINS.length ? Array.from(new Set([...CORS_ORIGINS, defaultOrigin])) : [defaultOrigin]);

  // Treat any *.github.io and any localhost as explicitly allowed for credentialed requests
  const pagesOrigin = 'https://semperadmin.github.io';
  let originIsGhPages = false;
  let originIsLocalhost = false;
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    originIsLocalhost = (h === 'localhost' || h === '127.0.0.1' || h === '::1');
    originIsGhPages = (u.origin === pagesOrigin);
  } catch (_) { originIsLocalhost = false; originIsGhPages = false; }
  const isAllowed = originIsLocalhost || originIsGhPages || (!CORS_ALLOW_ALL && (origin && allowedOrigins.includes(origin)));

  // Always set standard CORS method allowances
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

  // Build allowed headers dynamically, echoing requested headers when present
  const requestedHeaders = req.headers['access-control-request-headers'];
  const baseAllowed = ['Content-Type', 'Accept', 'X-GitHub-Token', 'Authorization', 'X-CSRF-Token'];
  const allowHeaderValue = requestedHeaders
    ? Array.from(new Set([...baseAllowed, ...requestedHeaders.split(',').map(h => h.trim()).filter(Boolean)])).join(', ')
    : baseAllowed.join(', ');
  res.header('Access-Control-Allow-Headers', allowHeaderValue);

  // Include Vary: Origin so caches consider origin differences
  if (origin) {
    res.header('Vary', 'Origin');
  }

  // Prefer explicit allowlist, but ensure preflight never fails due to missing ACAO
  if (origin) {
    if (isAllowed) {
      // When origin is explicitly allowed (incl. GitHub Pages), echo origin and allow credentials
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else if (CORS_ALLOW_ALL) {
      // Allow all origins for non-credentialed requests
      res.header('Access-Control-Allow-Origin', '*');
      // Do NOT set credentials with '*'
    } else if (req.method === 'OPTIONS') {
      // Be permissive for preflight so the browser proceeds to the actual request,
      // where origin enforcement will apply via missing ACAO on non-allowed origins.
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  } else if (CORS_ALLOW_ALL) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  // Improve UX: provide a small max-age for preflight caching
  res.header('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Minimal cookie/session helpers ---
/**
 * Parse an HTTP `Cookie` header into a key–value map.
 *
 * @param {string} cookieHeader - Raw `Cookie` header value.
 * @returns {Object<string,string>} Map of cookie names to decoded values.
 * @throws {never} Decoding errors are swallowed; this function does not throw.
 * @example
 * // "a=1; b=hello" -> { a: "1", b: "hello" }
 */
function parseCookies(cookieHeader) {
  const out = {};
  const str = String(cookieHeader || '');
  if (!str) return out;
  const parts = str.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch (_) { out[k] = v; }
  }
  return out;
}
/**
 * Serialize a cookie name/value pair with options into a `Set-Cookie` string.
 *
 * @param {string} name - Cookie name.
 * @param {string} value - Cookie value (will be URI encoded).
 * @param {Object} [opts] - Optional attributes for the cookie.
 * @param {number} [opts.maxAge] - Max age in seconds.
 * @param {Date} [opts.expires] - Absolute expiration date.
 * @param {string} [opts.path] - Cookie path. Defaults to "/".
 * @param {('Lax'|'Strict'|'None')} [opts.sameSite] - SameSite policy.
 * @param {boolean} [opts.httpOnly] - When true, hides cookie from JS.
 * @param {boolean} [opts.secure] - When true, sends only over HTTPS.
 * @returns {string} A valid `Set-Cookie` header value.
 */
function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  parts.push(`Path=${opts.path || '/'}`);
  const same = (opts.sameSite || 'Lax');
  parts.push(`SameSite=${same}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-weak-secret-change-in-prod';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 60 * 60 * 1000);
const SESSION_REMEMBER_TTL_MS = Number(process.env.SESSION_REMEMBER_TTL_MS || 30 * 24 * 60 * 60 * 1000);
// Prefer secure cookies in hosted environments; allow explicit override via env.
const inferredHostedSecure = (
  process.env.COOKIE_SECURE === 'true' ||
  process.env.NODE_ENV === 'production' ||
  (process.env.RENDER_EXTERNAL_URL && String(process.env.RENDER_EXTERNAL_URL).startsWith('https')) ||
  (process.env.VERCEL && process.env.VERCEL === '1')
);
const COOKIE_SECURE = inferredHostedSecure;
// Dynamic SameSite: use 'None' with Secure cookies (cross-site), otherwise 'Lax' for local/dev.
const COOKIE_SAMESITE = COOKIE_SECURE ? 'None' : 'Lax';
/**
 * Sign a session payload using HMAC SHA-256 and a server secret.
 * Produces a compact token: `base64(json).hex(hmac)`.
 *
 * @param {Object} payload - Session data including `u` and optional `exp`.
 * @returns {string} Token suitable for a cookie or header.
 */
function signSessionPayload(payload) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const h = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  return `${data}.${h}`;
}
/**
 * Verify a session token produced by {@link signSessionPayload}.
 * Validates signature and expiration. Returns parsed object or `null`.
 *
 * @param {string} token - Token in `data.signature` format.
 * @returns {Object|null} Parsed session data `{ u, exp }` or `null`.
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const data = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const obj = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (!obj || typeof obj !== 'object') return null;
    if (obj.exp && Date.now() > Number(obj.exp)) return null;
    return obj;
  } catch (_) {
    return null;
  }
}
// Attach parsed cookies and session user (if valid)
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie || '');
  const tok = req.cookies['fitrep_session'] || '';
  const sess = verifySessionToken(tok);
  if (sess && sess.u) {
    req.sessionUser = String(sess.u);
  }
  next();
});

// CSRF protection: double-submit cookie (skip admin API)
app.use((req, res, next) => {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
    const path = String(req.path || req.url || '');
    if (path.startsWith('/api/admin')) return next();
  if (path === ((CONSTANTS && CONSTANTS.ROUTES && CONSTANTS.ROUTES.API && CONSTANTS.ROUTES.API.ACCOUNT_LOGIN) || '/api/account/login')) return next();
    // Only enforce when a session exists
    if (!req.sessionUser) return next();
    const headerToken = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'] || '';
    const cookieToken = req.cookies['fitrep_csrf'] || '';
    if (!headerToken || !cookieToken || String(headerToken) !== String(cookieToken)) {
      return res.status(403).json({ error: 'CSRF token invalid' });
    }
    next();
  } catch (e) {
    return res.status(403).json({ error: 'CSRF check failed' });
  }
});

/**
 * Express middleware that enforces authentication via `req.sessionUser`.
 * Responds with `401` and `{ error: 'Not authenticated' }` when absent.
 *
 * @param {import('express').Request} req - HTTP request.
 * @param {import('express').Response} res - HTTP response.
 * @param {Function} next - Next middleware function.
 */
function requireAuth(req, res, next) {
  if (!req.sessionUser) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Security headers middleware
// Adds baseline protections: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
app.use((req, res, next) => {
  try {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      // Inline scripts/styles used by the app; consider migrating to nonce/hash in future
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      // Allow images from self and data URLs; https for external icons if any
      "img-src 'self' data: https:",
      // Allow API calls to same-origin, GitHub API, Render backend, and jsDelivr (source maps, optional fetches)
      "connect-src 'self' https://api.github.com https://fitness-report-evaluator.onrender.com https://cdn.jsdelivr.net",
      // Encourage HTTPS when available; harmless in HTTP during local dev
      'upgrade-insecure-requests'
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  } catch (_) { /* ignore header errors */ }
  next();
});

// Debug request logger (temporary)
app.use((req, res, next) => {
  try {
    console.log(`[req] ${req.method} ${req.url}`);
  } catch (_) { /* no-op */ }
  next();
});

// Note: do NOT serve static files before API routes, or POSTs to /api/*
// may get intercepted and return 405 from the static middleware. We'll
// mount static at the end after defining API routes.

// Serve favicon to avoid default /favicon.ico 404s
// Uses existing PNG logo; returns 200 with image/png
app.get('/favicon.ico', (req, res) => {
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'images', 'Logo.png');
    if (fs.existsSync(iconPath)) {
      res.type('image/png');
      return res.sendFile(iconPath);
    }
  } catch (_) { /* no-op */ }
  // If logo isn't present, return 204 (no content) instead of 404
  return res.status(204).end();
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
console.log('[env] CORS_ORIGINS:', CORS_ORIGINS);

function emailPrefix(email) {
  return String(email || '').trim().toLowerCase().split('@')[0];
}

// --- Local filesystem fallback storage (no-env/dev friendly) ---
// Use OS temp dir by default to ensure writeability on platforms like Render
// Allow override via LOCAL_DATA_DIR env var
const LOCAL_BASE_DIR = process.env.LOCAL_DATA_DIR || path.join(os.tmpdir(), 'fitrep-local');
const LOCAL_DATA_DIR = path.join(LOCAL_BASE_DIR, 'users');
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

/**
 * Parse YAML evaluation files produced by CI workflows.
 * Normalizes trait evaluations from array or object form into an array.
 *
 * Performance: O(n) over trait entries; memory O(n) for normalized list.
 *
 * Rationale: Use `js-yaml` for tolerant parsing across formatting variants
 * and fall back to a minimal valid structure on errors.
 *
 * @param {string} yamlStr - Raw YAML content.
 * @returns {Object} Minimal normalized evaluation object.
 * @example
 * // Returns object with `traitEvaluations: [{ section, trait, grade, ...}]`
 */
function parseEvaluationYamlMinimal(yamlStr) {
  try {
    // Parse YAML with js-yaml for robustness
    const parsed = yaml.load(yamlStr);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML structure');
    }

    // Extract fields with safe defaults
    const id = parsed.id || `eval-${crypto.randomBytes(8).toString('hex')}`;
    const occasion = parsed.occasion || null;
    const completedDate = parsed.completedDate || null;

    // Parse and validate fitrepAverage (parseFloat handles undefined/null by returning NaN)
    const numFitrep = parseFloat(parsed.fitrepAverage);
    const fitrepAverage = Number.isFinite(numFitrep) ? String(numFitrep) : null;

    const sectionIComments = parsed.sectionIComments || '';

    // Marine info
    const marine = parsed.marine || {};
    const evaluationPeriod = marine.evaluationPeriod || {};
    const marineInfo = {
      name: marine.name || '',
      rank: marine.rank || '',
      evaluationPeriod: {
        from: evaluationPeriod.from || '',
        to: evaluationPeriod.to || ''
      }
    };

    // RS info
    const rs = parsed.rs || {};
    const rsInfo = {
      name: rs.name || '',
      email: rs.email || '',
      rank: rs.rank || ''
    };

    // Trait evaluations - handle both array and object formats
    const traits = [];
    const rawTraits = parsed.traitEvaluations;

    // Normalize to array: handle both array and object (keyed by trait name) formats
    const traitsList = Array.isArray(rawTraits)
      ? rawTraits
      : (rawTraits && typeof rawTraits === 'object' ? Object.values(rawTraits) : []);

    for (const trait of traitsList) {
      if (trait && typeof trait === 'object') {
        traits.push({
          section: trait.section || '',
          trait: trait.trait || '',
          grade: trait.grade || '',
          gradeNumber: Number(trait.gradeNumber) || 0
        });
      }
    }

    return {
      evaluationId: id,
      occasion,
      completedDate,
      fitrepAverage,
      marineInfo,
      rsInfo,
      sectionIComments,
      traitEvaluations: traits,
      syncStatus: 'synced'
    };

  } catch (error) {
    console.error('YAML parsing error:', error.message);
    // Return minimal valid structure on parse failure
    return {
      evaluationId: `eval-${crypto.randomBytes(8).toString('hex')}`,
      occasion: null,
      completedDate: null,
      fitrepAverage: null,
      marineInfo: {
        name: '',
        rank: '',
        evaluationPeriod: { from: '', to: '' }
      },
      rsInfo: { name: '', email: '', rank: '' },
      sectionIComments: '',
      traitEvaluations: [],
      syncStatus: 'synced'
    };
  }
}

/**
 * Factory for a lightweight, per-IP rate limiter middleware.
 * Uses an in-memory map with periodic cleanup; suitable for small apps.
 *
 * Time complexity: O(1) per request. Space: O(N) for distinct IPs.
 *
 * @param {Object} params - Configuration options.
 * @param {number} params.windowMs - Time window in milliseconds.
 * @param {number} params.limit - Max requests allowed per window per IP.
 * @returns {import('express').RequestHandler} Express middleware.
 * @example
 * app.post('/login', rateLimit({ windowMs: 60_000, limit: 30 }), handler);
 */
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
const feedbackRateLimit = rateLimit({ windowMs: 60_000, limit: 20 });
const validationRateLimit = rateLimit({ windowMs: 60_000, limit: 120 });

// Lightweight in-memory LRU cache for validation responses
/**
 * Simple in-memory LRU cache with TTL for validation responses.
 * Not distributed; intended for single-node deployments.
 *
 * @example
 * const cache = new ValidationCache(512, 90_000);
 */
class ValidationCache {
  /**
   * @param {number} [maxEntries=512] - Max cached entries before eviction.
   * @param {number} [ttlMs=60000] - Time-to-live for each entry in ms.
   */
  constructor(maxEntries = 512, ttlMs = 60_000) {
    this.max = maxEntries;
    this.ttl = ttlMs;
    this.map = new Map(); // key -> { value, expires }
  }
  _now() { return Date.now(); }
  /**
   * Get a cached value by key, touching entry for LRU behavior.
   *
   * @param {string} key - Cache key.
   * @returns {*} Cached value or `null` if missing/expired.
   */
  get(key) {
    const ent = this.map.get(key);
    if (!ent) return null;
    if (ent.expires < this._now()) { this.map.delete(key); return null; }
    // touch for LRU
    this.map.delete(key);
    this.map.set(key, ent);
    return ent.value;
  }
  /**
   * Insert or update a cache entry; evicts oldest when above `max`.
   *
   * @param {string} key - Cache key.
   * @param {*} value - Any serializable value.
   * @returns {void}
   */
  set(key, value) {
    const expires = this._now() + this.ttl;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires });
    if (this.map.size > this.max) {
      // Evict oldest
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }
  }
}
const validationCache = new ValidationCache(512, 90_000);

// Reserved labels that should not be used by users
const RESERVED_LABELS = new Set(['admin','system','null','undefined','root','owner','support','staff']);

app.post(((CONSTANTS && CONSTANTS.ROUTES && CONSTANTS.ROUTES.API && CONSTANTS.ROUTES.API.ACCOUNT_CREATE) || '/api/account/create'), authRateLimit, async (req, res) => {
  try {
    const { rank, name, email, password, username: rawUsername } = req.body || {};
    const username = String(rawUsername || email || '').trim();
    if (!rank || !name || !username || !password) {
      return res.status(400).json({ error: 'Missing fields: rank, name, username, password' });
    }
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
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
    const previousEmail = (req.body?.userData?.previousEmail || '').trim();
    if (fitrepToken) {
      try {
        const prefix = sanitizePrefix(username);
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
          // Username already exists; prevent account overwrite
          return res.status(409).json({ error: 'Username already exists' });
        } else if (getResp.status !== 404 && !getResp.ok) {
          const text = await getResp.text();
          console.error('create-account: get SHA failed:', text);
          return res.status(502).json({ error: `Read failed: ${text}` });
        }

        const now = new Date().toISOString();
        const userJson = {
          rsEmail: username,
          rsName: name,
          rsRank: rank,
          passwordHash,
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
        // Prevent duplicate username locally
        const existingLocal = await readLocalUser(prefix);
        if (existingLocal) {
          return res.status(409).json({ error: 'Username already exists' });
        }
        const now = new Date().toISOString();
        const userJson = {
          rsEmail: email,
          rsName: name,
          rsRank: rank,
          passwordHash,
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

    // If dispatch is available, attempt a remote existence check before dispatching
    try {
      const prefix = sanitizePrefix(username);
      const checkUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
      const checkResp = await fetch(checkUrl, {
        headers: {
          'Authorization': `Bearer ${dispatchToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (checkResp.status === 200) {
        return res.status(409).json({ error: 'Username already exists' });
      }
    } catch (e) {
      // Non-fatal; proceed to dispatch
      console.warn('create-account: dispatch pre-check failed:', e?.message || e);
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

app.post(((CONSTANTS && CONSTANTS.ROUTES && CONSTANTS.ROUTES.API && CONSTANTS.ROUTES.API.ACCOUNT_LOGIN) || '/api/account/login'), authRateLimit, async (req, res) => {
  try {
    const { email, password, username: rawUsername } = req.body || {};
    const remember = String((req.body && req.body.remember) || '').toLowerCase();
    const rememberFlag = (remember === 'true' || remember === '1' || remember === 'yes' || remember === 'on');
    const username = String(rawUsername || email || '').trim();
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields: username, password' });
    }
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    const prefix = sanitizePrefix(username);
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
    // Issue HttpOnly session cookie and CSRF cookie
    try {
      const now = Date.now();
      const ttlMs = rememberFlag ? SESSION_REMEMBER_TTL_MS : SESSION_TTL_MS;
      const payload = { u: sanitizePrefix(username), iat: now, exp: now + ttlMs };
      const sessionToken = signSessionPayload(payload);
      const csrfToken = crypto.randomBytes(32).toString('hex');
      const cookies = [
        // SameSite dynamically chosen: 'None' in prod (Secure=true), 'Lax' in local/dev
        serializeCookie('fitrep_session', sessionToken, { httpOnly: true, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: ttlMs / 1000 }),
        serializeCookie('fitrep_csrf', csrfToken, { httpOnly: false, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: ttlMs / 1000 })
      ];
      // Append cookies without clobbering existing headers
      res.setHeader('Set-Cookie', cookies);
    } catch (_) { /* cookie setting best-effort */ }

    return res.json({
      ok: true,
      profile: {
        rsName: user.rsName,
        rsEmail: user.rsEmail,
        rsRank: user.rsRank,
        lastUpdated: user.lastUpdated || new Date().toISOString()
      },
      // evaluations removed; per-evaluation files are now used
    });
  } catch (err) {
    console.error('account login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout: clear session and CSRF cookies
app.post('/api/account/logout', (req, res) => {
  try {
    const expired = new Date(0);
    const cookies = [
      serializeCookie('fitrep_session', '', { httpOnly: true, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, expires: expired }),
      serializeCookie('fitrep_csrf', '', { httpOnly: false, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, expires: expired })
    ];
    res.setHeader('Set-Cookie', cookies);
  } catch (_) { /* ignore */ }
  return res.json({ ok: true });
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

// Check if a username is available (not already taken)
app.get('/api/account/available', async (req, res) => {
  try {
    const username = String((req.query.username || req.query.email || '')).trim();
    if (!username) return res.status(400).json({ error: 'Missing username query param' });
    if (!isValidUsername(username)) return res.status(400).json({ error: 'Invalid username format' });

    const prefix = sanitizePrefix(username);
    const token = process.env.FITREP_DATA || DISPATCH_TOKEN || '';
    if (token) {
      try {
        const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
        const resp = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
          }
        });
        if (resp.status === 200) {
          return res.json({ ok: true, available: false });
        }
        if (resp.status === 404) {
          return res.json({ ok: true, available: true });
        }
        const text = await resp.text();
        console.warn('availability check: github read unexpected:', text);
        // Fallback to local check
      } catch (e) {
        console.warn('availability check: github read failed:', e?.message || e);
      }
    }

    // Local filesystem fallback
    try {
      const existing = await readLocalUser(prefix);
      return res.json({ ok: true, available: !existing });
    } catch (_) {
      // If local read fails, assume available to avoid blocking legitimate users
      return res.json({ ok: true, available: true });
    }
  } catch (err) {
    console.error('availability check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Development-only endpoint to provide a GitHub token to the client.
// This should NEVER be enabled in production.
app.get(((CONSTANTS && CONSTANTS.ROUTES && CONSTANTS.ROUTES.API && CONSTANTS.ROUTES.API.GITHUB_TOKEN) || '/api/github-token'), (req, res) => {
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

/**
 * Build data JSON compatible with the data repository schema.
 *
 * @param {Object} userData - Minimal user profile info.
 * @param {string} [userData.rsName] - Reporting senior name.
 * @param {string} [userData.rsEmail] - Reporting senior username/email.
 * @param {string} [userData.rsRank] - Reporting senior rank.
 * @returns {Object} Structured JSON used for export.
 */
function buildUserDataJson(userData) {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    lastUpdated: now,
    profile: {
      rsName: userData.rsName || '',
      rsEmail: userData.rsEmail || '',
      rsRank: userData.rsRank || ''
    },
    metadata: {
      exportedAt: now,
      exportedBy: userData.rsName || '',
      applicationVersion: '1.0'
    }
  };
}

/**
 * Normalize a username to a safe filesystem prefix.
 *
 * @param {string} username - Raw username or email-like identifier.
 * @returns {string} Lowercased, sanitized prefix (alnum, dot, underscore,
 * hyphen). Other characters become `_`.
 */
function sanitizePrefix(username) {
  const prefix = String(username || '').trim().toLowerCase();
  return prefix.replace(/[^a-z0-9._-]/gi, '_');
}

/**
 * Sanitize a general string by removing control characters.
 *
 * @param {string} str - Arbitrary string input.
 * @returns {string} Cleaned string safe for logs or storage.
 */
function sanitizeString(str) {
  const s = String(str || '');
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Simple input validation helpers
/**
 * Basic email validation (deprecated; retained for compatibility).
 *
 * @param {string} email - Candidate email.
 * @returns {boolean} True when the format looks valid.
 */
function isValidEmail(email) {
  // Deprecated: retained for backward compatibility with older clients
  const e = String(email || '').trim();
  if (e.length < 3 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
/**
 * Validate usernames: 3–50 chars, letters/numbers/._- only.
 *
 * @param {string} username - Candidate username.
 * @returns {boolean} True when format passes constraints.
 */
function isValidUsername(username) {
  const u = String(username || '').trim();
  if (u.length < 3 || u.length > 50) return false;
  // Allow letters, numbers, underscore, dot, hyphen; no spaces or @
  return /^[a-zA-Z0-9._-]+$/.test(u);
}
/**
 * Check password strength: ≥8 chars, includes upper, lower, and digit.
 *
 * @param {string} pw - Password candidate.
 * @returns {boolean} True when all criteria are satisfied.
 */
function isStrongPassword(pw) {
  const p = String(pw || '');
  if (p.length < 8) return false;
  const hasLower = /[a-z]/.test(p);
  const hasUpper = /[A-Z]/.test(p);
  const hasDigit = /\d/.test(p);
  return hasLower && hasUpper && hasDigit;
}
/**
 * Validate display name length (2–100 characters).
 *
 * @param {string} name - Display name.
 * @returns {boolean} True when within allowed length.
 */
function isValidName(name) {
  const n = String(name || '').trim();
  return n.length >= 2 && n.length <= 100;
}
/**
 * Validate rank field length (2–20 characters).
 *
 * @param {string} rank - Rank value.
 * @returns {boolean} True when within allowed length.
 */
function isValidRank(rank) {
  const r = String(rank || '').trim();
  return r.length >= 2 && r.length <= 20;
}

/**
 * Merge a new evaluation into the aggregate user object while preserving
 * immutable fields from an existing record.
 *
 * @param {string} userEmail - Reporting senior username/email.
 * @param {Object} evaluation - Parsed evaluation object.
 * @param {Object|null} existingUser - Current stored user (if present).
 * @param {string} _newEvaluationFilePath - Path hint (unused; kept for API).
 * @param {string} now - ISO timestamp for `lastUpdated`.
 * @returns {Object} Updated aggregate user object.
 */
function buildUpdatedUserAggregate(userEmail, evaluation, existingUser, _newEvaluationFilePath, now) {
  const obj = {
    rsEmail: userEmail,
    rsName: evaluation?.rsInfo?.name ?? existingUser?.rsName ?? '',
    rsRank: evaluation?.rsInfo?.rank ?? existingUser?.rsRank ?? '',
    createdDate: existingUser?.createdDate || now,
    lastUpdated: now
  };
  if (existingUser?.passwordHash) {
    obj.passwordHash = existingUser.passwordHash;
  }
  return obj;
}

// Save user data: either direct write via FITREP_DATA or dispatch workflow via DISPATCH_TOKEN
app.post('/api/user/save', saveRateLimit, requireAuth, async (req, res) => {
  try {
    const { userData } = req.body || {};
    if (!userData || !userData.rsEmail) {
      return res.status(400).json({ error: 'Missing userData.rsEmail' });
    }
    if (!isValidUsername(userData.rsEmail)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    // Enforce that the request user matches the authenticated session
    try {
      const reqUser = sanitizePrefix(userData.rsEmail);
      const sessUser = sanitizePrefix(req.sessionUser || '');
      const prevUser = userData.previousEmail ? sanitizePrefix(userData.previousEmail) : null;
      // Allow save when session matches either current email or previousEmail (for migrations)
      const sessionMatches = !!sessUser && (reqUser === sessUser || (prevUser && prevUser === sessUser));
      if (!sessionMatches) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }
    } catch (_) { return res.status(403).json({ error: 'Forbidden' }); }

    // Optional: previousEmail used only for migrating preserved fields
    const previousEmail = userData.previousEmail || null;

    const fitrepToken = process.env.FITREP_DATA || req.headers['x-github-token'] || req.body?.token || '';
    const dispatchToken = DISPATCH_TOKEN;

    // Prefer direct write when FITREP_DATA is available
    if (fitrepToken) {
      // Always write to the new email path; use previousEmail only to migrate fields
      const writePrefix = sanitizePrefix(userData.rsEmail);
      const filePath = `users/${writePrefix}.json`;
      const apiBase = `https://api.github.com/repos/${DATA_REPO}/contents/${filePath}`;

      // Try to get existing SHA and existing file for preserving fields like passwordHash
      let sha = '';
      let existingUser = null;
      let previousUser = null;
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
        // Do not hard-fail on read errors; continue without sha so we can attempt PUT
        let text = '';
        try { text = await getResp.text(); } catch (_) { /* ignore */ }
        console.error('save user: get SHA failed, continuing without sha:', text);
        sha = '';
        existingUser = null;
      }

      // If creating a new file (or missing hash) and previousEmail is provided, try to migrate passwordHash
      if ((!existingUser || !existingUser.passwordHash) && previousEmail && isValidUsername(previousEmail)) {
        try {
          const prevPrefix = sanitizePrefix(previousEmail);
          const prevFilePath = `users/${prevPrefix}.json`;
          const prevApiBase = `https://api.github.com/repos/${DATA_REPO}/contents/${prevFilePath}`;
          const prevResp = await fetch(prevApiBase, {
            headers: {
              'Authorization': `Bearer ${fitrepToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (prevResp.status === 200) {
            const prev = await prevResp.json();
            try {
              const prevStr = Buffer.from(prev.content || '', 'base64').toString('utf8');
              previousUser = prevStr ? JSON.parse(prevStr) : null;
            } catch (_) {
              previousUser = null;
            }
          }
        } catch (e) {
          // best-effort; ignore migration errors
          console.warn('passwordHash migration from previousEmail failed:', e?.message || e);
        }
      }

      // Build new data preserving flat structure and critical fields
      const now = new Date().toISOString();
      const bodyObj = {
        rsEmail: userData.rsEmail,
        rsName: userData.rsName ?? existingUser?.rsName ?? '',
        rsRank: userData.rsRank ?? existingUser?.rsRank ?? '',
        createdDate: existingUser?.createdDate || previousUser?.createdDate || now,
        lastUpdated: now
      };

      // SECURITY: Only preserve passwordHash from existing user, never from client input
      if (existingUser?.passwordHash) {
        bodyObj.passwordHash = existingUser.passwordHash;
      } else if (previousUser?.passwordHash) {
        bodyObj.passwordHash = previousUser.passwordHash;
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
        let text = '';
        try { text = await putResp.text(); } catch (_) { /* ignore */ }
        console.error('save user: put failed, falling back to local:', text);
        // Fall back to local persistence to avoid 5xx
        try {
          await writeLocalUser(writePrefix, bodyObj);
          return res.json({ ok: true, path: `local:${writePrefix}.json`, method: 'local', fallback: 'put-failed' });
        } catch (err) {
          console.error('save user: local write failed after put error:', err);
          return res.status(500).json({ error: 'Local write failed' });
        }
      }
      const result = await putResp.json();
      return res.json({ ok: true, path: result?.content?.path || filePath, commit: result?.commit?.sha || null, method: 'direct' });
    }

    // Fallback: dispatch workflow when direct write is not possible
    if (dispatchToken) {
      try {
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
        if (resp.ok) {
          return res.json({ ok: true, dispatched: true, method: 'dispatch' });
        }
        const text = await resp.text();
        console.error('save user: dispatch failed:', text);
        // Do not hard-fail; fall back to local persistence to avoid 500s in production
      } catch (e) {
        console.error('save user: dispatch error, falling back to local:', e?.message || e);
      }
      // Continue to local filesystem fallback below
    }

      // Local filesystem fallback when no tokens are available
    try {
      // Always write to new email path locally as well
      const writePrefix = sanitizePrefix(userData.rsEmail);
      // Merge with existing local user to preserve passwordHash
      const existingUser = await readLocalUser(writePrefix);
      // Try migration from previousEmail in local mode
      let previousUser = null;
      if ((!existingUser || !existingUser.passwordHash) && previousEmail && isValidUsername(previousEmail)) {
        // Prefer GitHub read using client-provided token when available
        previousUser = null;
        try {
          const clientToken = req.headers['x-github-token'] || req.body?.token || '';
          if (clientToken) {
            const prevPrefix = sanitizePrefix(previousEmail);
            const prevApi = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prevPrefix}.json`;
            const prevResp = await fetch(prevApi, {
              headers: {
                'Authorization': `Bearer ${clientToken}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            });
            if (prevResp.status === 200) {
              const prev = await prevResp.json();
              try {
                const prevStr = Buffer.from(prev.content || '', 'base64').toString('utf8');
                previousUser = prevStr ? JSON.parse(prevStr) : null;
              } catch (_) {
                previousUser = null;
              }
            }
          }
        } catch (_) { /* ignore */ }
        // If GitHub read not possible or failed, try local fallback
        if (!previousUser) {
          try { previousUser = await readLocalUser(sanitizePrefix(previousEmail)); } catch (_) { previousUser = null; }
        }
      }
      const now = new Date().toISOString();
      const bodyObj = {
        rsEmail: userData.rsEmail,
        rsName: userData.rsName ?? existingUser?.rsName ?? '',
        rsRank: userData.rsRank ?? existingUser?.rsRank ?? '',
        createdDate: existingUser?.createdDate || previousUser?.createdDate || now,
        lastUpdated: now
      };
      if (existingUser?.passwordHash) {
        bodyObj.passwordHash = existingUser.passwordHash;
      } else if (previousUser?.passwordHash) {
        bodyObj.passwordHash = previousUser.passwordHash;
      }
      await writeLocalUser(writePrefix, bodyObj);
      return res.json({ ok: true, path: `local:${writePrefix}.json`, method: 'local' });
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
app.post('/api/evaluation/save', saveRateLimit, requireAuth, async (req, res) => {
  try {
    const { evaluation, userEmail } = req.body || {};
    if (!evaluation || !evaluation.evaluationId) {
      return res.status(400).json({ error: 'Missing evaluation.evaluationId' });
    }
    if (!userEmail || !isValidUsername(userEmail)) {
      return res.status(400).json({ error: 'Invalid or missing username' });
    }
    // Enforce that the request user matches the authenticated session
    try {
      const reqUser = sanitizePrefix(userEmail);
      const sessUser = sanitizePrefix(req.sessionUser || '');
      if (!sessUser || reqUser !== sessUser) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }
    } catch (_) { return res.status(403).json({ error: 'Forbidden' }); }

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

// List evaluations for a user. Uses server token when available; falls back to local storage.
app.get('/api/evaluations/list', requireAuth, async (req, res) => {
  try {
    const username = String((req.query.username || req.query.email || '')).trim();
    if (!username) return res.status(400).json({ error: 'Missing username query param' });
    try {
      const reqUser = sanitizePrefix(username);
      const sessUser = sanitizePrefix(req.sessionUser || '');
      if (!sessUser || reqUser !== sessUser) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }
    } catch (_) { return res.status(403).json({ error: 'Forbidden' }); }

  const fitrepToken = process.env.FITREP_DATA || req.headers['x-github-token'] || req.query.token || '';
    const prefix = sanitizePrefix(username);
    const dirPath = `users/${prefix}/evaluations`;

    // Attempt listing via GitHub Contents API when token available
    if (fitrepToken) {
      const listUrl = `https://api.github.com/repos/${DATA_REPO}/contents/${dirPath}`;
      const resp = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${fitrepToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (resp.status === 404) {
        return res.json({ ok: true, evaluations: [] });
      }
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(502).json({ error: `List failed: ${text}` });
      }
      const items = await resp.json();
      const files = Array.isArray(items) ? items.filter(i => i.type === 'file') : [];
      const evaluations = [];
      for (const f of files) {
        try {
          const fileApi = `https://api.github.com/repos/${DATA_REPO}/contents/${f.path}`;
          const fileResp = await fetch(fileApi, {
            headers: {
              'Authorization': `Bearer ${fitrepToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (!fileResp.ok) continue;
          const fileData = await fileResp.json();
          const contentStr = Buffer.from(fileData.content || '', 'base64').toString('utf8');
          const ext = String(f.name || '').split('.').pop().toLowerCase();
          if (ext === 'json') {
            try {
              const obj = JSON.parse(contentStr);
              if (obj && obj.evaluation) {
                evaluations.push(obj.evaluation);
              } else if (obj && obj.id) {
                evaluations.push({
                  evaluationId: obj.id,
                  occasion: obj.occasion || null,
                  completedDate: obj.completedDate || null,
                  fitrepAverage: obj.fitrepAverage || null,
                  marineInfo: obj.marine || {},
                  rsInfo: obj.rs || {},
                  sectionIComments: obj.sectionIComments || '',
                  traitEvaluations: Array.isArray(obj.traitEvaluations) ? obj.traitEvaluations : []
                });
              }
            } catch (_) { /* ignore parse errors */ }
          } else if (ext === 'yml' || ext === 'yaml') {
            try {
              const ev = parseEvaluationYamlMinimal(contentStr || '');
              if (ev) evaluations.push(ev);
            } catch (_) { /* ignore yaml parse errors */ }
          } else {
            // Unknown extension: attempt JSON parse as a best effort
            try {
              const obj = JSON.parse(contentStr);
              if (obj && obj.evaluation) evaluations.push(obj.evaluation);
            } catch (_) { /* ignore */ }
          }
        } catch (_) { /* ignore individual file errors */ }
      }
      return res.json({ ok: true, evaluations });
    }

    // Fallback: read from local filesystem
    try {
      const evalDir = path.join(LOCAL_DATA_DIR, prefix, 'evaluations');
      let entries = [];
      try {
        entries = await fsp.readdir(evalDir, { withFileTypes: true });
      } catch (_) {
        return res.json({ ok: true, evaluations: [] });
      }
      const evaluations = [];
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        const name = ent.name || '';
        if (!name.toLowerCase().endsWith('.json')) continue;
        const fp = path.join(evalDir, name);
        try {
          const str = await fsp.readFile(fp, 'utf8');
          const obj = JSON.parse(str);
          if (obj && obj.evaluation) {
            evaluations.push(obj.evaluation);
          }
        } catch (_) { /* ignore file read/parse errors */ }
      }
      return res.json({ ok: true, evaluations });
    } catch (err) {
      console.error('list evaluations: local read failed:', err);
      return res.status(500).json({ error: 'Local read failed' });
    }
  } catch (err) {
    console.error('list evaluations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Load user data via server using FITREP_DATA
app.get('/api/user/load', requireAuth, async (req, res) => {
  try {
    const username = String((req.query.username || req.query.email || '')).trim();
    if (!username) return res.status(400).json({ error: 'Missing username query param' });
    try {
      const reqUser = sanitizePrefix(username);
      const sessUser = sanitizePrefix(req.sessionUser || '');
      if (!sessUser || reqUser !== sessUser) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }
    } catch (_) { return res.status(403).json({ error: 'Forbidden' }); }
    const token = process.env.FITREP_DATA;
    if (!token) return res.status(500).json({ error: 'Server missing FITREP_DATA' });

    const prefix = sanitizePrefix(username);
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

// Feedback submission endpoint: creates GitHub issues or stores locally
app.post('/api/feedback', feedbackRateLimit, async (req, res) => {
  try {
    const { type, title, description, email, context } = req.body || {};
    const t = String(type || '').toLowerCase();
    const typeSafe = ['bug', 'feature', 'ux'].includes(t) ? t : 'other';
    const titleSan = sanitizeString(title).trim().substring(0, 200);
    const descSan = sanitizeString(description).trim().substring(0, 50000);
    const emailSan = sanitizeString(email).trim().substring(0, 200);
    if (!titleSan || !descSan) {
      return res.status(400).json({ error: 'Missing title or description' });
    }

    const repo = process.env.GITHUB_REPO || process.env.MAIN_REPO || 'SemperAdmin/Fitness-Report-Evaluator';
    // Prefer a dedicated GitHub token for issue creation; fall back to dispatch/data tokens
    const token = process.env.GITHUB_TOKEN || process.env.DISPATCH_TOKEN || process.env.FITREP_DATA;

    if (!token) {
      // Fallback: store feedback locally for later triage in development
      try { await ensureLocalDir(); } catch (_) {}
      const fbDir = path.join(LOCAL_BASE_DIR, 'feedback');
      await fsp.mkdir(fbDir, { recursive: true });
      const now = new Date().toISOString().replace(/[:.]/g, '-');
      const fname = `${now}-${Math.random().toString(36).slice(2, 8)}.json`;
      const payload = { type: typeSafe, title: titleSan, description: descSan, email: emailSan, context: (context || {}), createdAt: new Date().toISOString() };
      await fsp.writeFile(path.join(fbDir, fname), JSON.stringify(payload, null, 2), 'utf8');
      return res.json({ ok: true, stored: 'local', file: fname });
    }

    const issueBody = [
      `Type: ${typeSafe}`,
      '',
      'Description:',
      descSan,
      '',
      'Context:',
      `- Route: ${(context && context.route) ? String(context.route) : ''}`,
      `- User-Agent: ${(context && context.userAgent) ? String(context.userAgent) : ''}`,
      `- Screen: ${(context && context.screen) ? String(context.screen) : ''}`,
      `- Viewport: ${(context && context.viewport) ? String(context.viewport) : ''}`,
      `- Theme: ${(context && context.theme) ? String(context.theme) : ''}`,
      `- Timestamp: ${(context && context.timestamp) ? String(context.timestamp) : new Date().toISOString()}`,
      emailSan ? `- Reporter Email: ${emailSan}` : ''
    ].filter(Boolean).join('\n');

    const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `[Feedback] ${typeSafe}: ${titleSan}`,
        body: issueBody,
        labels: ['feedback', typeSafe]
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('feedback issue create failed:', text);
      // Graceful fallback: if token lacks permission or credentials are invalid, store locally
      if (resp.status === 401 || resp.status === 403) {
        try { await ensureLocalDir(); } catch (_) {}
        const fbDir = path.join(LOCAL_BASE_DIR, 'feedback');
        await fsp.mkdir(fbDir, { recursive: true });
        const now = new Date().toISOString().replace(/[:.]/g, '-');
        const fname = `${now}-${Math.random().toString(36).slice(2, 8)}.json`;
        const payload = { type: typeSafe, title: titleSan, description: descSan, email: emailSan, context: (context || {}), createdAt: new Date().toISOString(), githubError: text };
        await fsp.writeFile(path.join(fbDir, fname), JSON.stringify(payload, null, 2), 'utf8');
        return res.json({ ok: true, stored: 'local', file: fname, reason: 'github_unauthorized' });
      }
      return res.status(502).json({ error: 'GitHub issue creation failed' });
    }
    const data = await resp.json();
    return res.json({ ok: true, issueUrl: data.html_url, issueNumber: data.number });
  } catch (err) {
    console.error('feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Server-side validation fallback endpoint
// POST body: { field: string, value: string }
// Response: { valid: boolean, message: string, suggestions?: string[] }
app.post('/api/validate/field', validationRateLimit, async (req, res) => {
  try {
    const { field, value } = req.body || {};
    const f = String(field || '').trim();
    const vRaw = String(value ?? '').trim();
    const v = sanitizeString(vRaw);
    if (!f) {
      return res.status(400).json({ valid: false, message: 'Missing field' });
    }
    if (v.length === 0) {
      return res.status(400).json({ valid: false, message: 'Missing value' });
    }

    // Authentication for sensitive fields
    const sensitive = new Set(['username']);
    if (sensitive.has(f) && !req.sessionUser) {
      return res.status(401).json({ valid: false, message: 'Not authenticated' });
    }

    const cacheKey = `${f}:${v.toLowerCase()}`;
    const cached = validationCache.get(cacheKey);
    if (cached) {
      console.log(`[validate] cache hit ${f}=${v} ->`, cached.valid);
      return res.json(cached);
    }

    let result = { valid: true, message: 'OK' };
    const suggestions = [];

    if (f === 'username') {
      // Format check
      if (!isValidUsername(v)) {
        result = { valid: false, message: 'Invalid username format' };
      } else {
        const prefix = sanitizePrefix(v);
        const token = process.env.FITREP_DATA || DISPATCH_TOKEN || '';
        let taken = false;
        if (token) {
          try {
            const apiUrl = `https://api.github.com/repos/${DATA_REPO}/contents/users/${prefix}.json`;
            const resp = await fetch(apiUrl, {
              headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
            });
            taken = resp.status === 200;
          } catch (e) {
            console.warn('validate username: github read failed:', e?.message || e);
          }
        }
        if (!taken) {
          try {
            const existing = await readLocalUser(prefix);
            taken = Boolean(existing);
          } catch (_) { /* assume not taken on local read error */ }
        }
        if (taken) {
          result = { valid: false, message: 'Username is already taken' };
          // Suggest alternatives
          const base = prefix.replace(/_+/g, '-');
          suggestions.push(`${base}-${Math.floor(Math.random() * 1000)}`);
          suggestions.push(`${base}.1`);
        }
      }
    } else if (f === 'rankLabel' || f === 'label') {
      const lower = v.toLowerCase();
      if (RESERVED_LABELS.has(lower)) {
        result = { valid: false, message: 'Label is reserved' };
        suggestions.push(`${lower}-custom`);
        suggestions.push(`${lower}-user`);
      } else if (!isValidRank(v)) {
        result = { valid: false, message: 'Invalid label format' };
      }
    } else if (f === 'email') {
      if (!isValidEmail(v)) {
        result = { valid: false, message: 'Invalid email address' };
      }
    } else {
      // Unknown field: basic sanitation only
      if (v.length > 200) {
        result = { valid: false, message: 'Value too long' };
      }
    }

    const payload = suggestions.length ? { ...result, suggestions } : result;
    validationCache.set(cacheKey, payload);
    console.log(`[validate] ${f}=${v} ->`, payload.valid ? 'valid' : 'invalid');
    return res.json(payload);
  } catch (err) {
    console.error('validate/field error:', err);
    return res.status(500).json({ valid: false, message: 'Internal server error' });
  }
});

// Debug minimal GitHub configuration exposure (safe for dev)
app.get('/api/debug/github', (req, res) => {
  try {
    const expose = process.env.ALLOW_DEV_TOKEN === 'true';
    return res.json({
      ok: true,
      mainRepo: MAIN_REPO,
      dataRepo: DATA_REPO,
      githubRepo: process.env.GITHUB_REPO || MAIN_REPO,
      tokenPresent: Boolean(process.env.GITHUB_TOKEN),
      dispatchPresent: Boolean(DISPATCH_TOKEN),
      devTokenExposureEnabled: expose
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server if executed directly
if (require.main === module) {
  const port = process.env.PORT || 10000;
  // Serve static files for local preview after all API routes
  app.use(express.static('.'));
  const commitSha = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  const listRoutes = () => {
    try {
      const routes = [];
      const stack = (app && app._router && app._router.stack) ? app._router.stack : [];
      for (const layer of stack) {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase()).join(',');
          routes.push(`${methods} ${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
          for (const h of layer.handle.stack) {
            if (h.route && h.route.path) {
              const methods = Object.keys(h.route.methods || {}).map(m => m.toUpperCase()).join(',');
              routes.push(`${methods} ${h.route.path}`);
            }
          }
        }
      }
      console.log('[routes]', routes.sort().join(' | '));
    } catch (_) {}
  };
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${port}`);
    if (commitSha) console.log('[build] commit', commitSha);
    listRoutes();
  });
}

module.exports = app;
