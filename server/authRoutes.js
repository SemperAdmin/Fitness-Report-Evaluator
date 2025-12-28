/**
 * Authentication Routes with Supabase Support
 *
 * This module provides account creation and login endpoints that support:
 * 1. Supabase (primary, recommended)
 * 2. GitHub Data Repository (legacy)
 * 3. Local filesystem (fallback)
 *
 * Routes:
 * - POST /api/account/create
 * - POST /api/account/login
 */

const bcrypt = require('bcryptjs');
const supabaseClient = require('./supabaseClient');
const { getStorageMode, isSupabaseAvailable, supabase, supabaseAdmin, USERS_TABLE } = supabaseClient;
const MilitaryData = require('../js/militaryData.js');
const { createUser, getUserByEmail } = require('./supabaseService');

const crypto = require('crypto');
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-weak-secret-change-in-prod';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 60 * 60 * 1000);
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || 'semperadmin').trim().toLowerCase();
const inferredHostedSecure = (
  process.env.COOKIE_SECURE === 'true' ||
  process.env.NODE_ENV === 'production' ||
  (process.env.RENDER_EXTERNAL_URL && String(process.env.RENDER_EXTERNAL_URL).startsWith('https')) ||
  (process.env.VERCEL && process.env.VERCEL === '1')
);
const COOKIE_SECURE = inferredHostedSecure;
const COOKIE_SAMESITE = COOKIE_SECURE ? 'None' : 'Lax';

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

function signSessionPayload(payload) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const h = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  return `${data}.${h}`;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 100) return false;
  // Allow email format or simple usernames
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9._-]+$/;
  return emailRegex.test(trimmed) || usernameRegex.test(trimmed);
}

/**
 * Validate rank against MilitaryData
 * @param {string} rank - Rank to validate
 * @returns {boolean} True if valid
 */
function isValidRank(rank) {
  if (!rank || typeof rank !== 'string') return false;
  const trimmed = rank.trim();

  // Get all valid rank values
  const allRanks = MilitaryData.getAllRanks().map(r => r.value);

  return allRanks.includes(trimmed);
}

/**
 * Validate name format
 * @param {string} name - Name to validate
 * @returns {boolean} True if valid
 */
function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if strong enough
 */
function isStrongPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  // Must have uppercase, lowercase, and number
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasUpper && hasLower && hasNumber;
}

// ============================================================================
// ACCOUNT CREATION ENDPOINT
// ============================================================================

/**
 * Create new user account
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function createAccountHandler(req, res) {
  try {
    const { rank, branch, name, email, password, username: rawUsername } = req.body || {};
    const username = String(rawUsername || email || '').trim();

    // Validation
    if (!rank || !name || !username || !password) {
      return res.status(400).json({
        error: 'Missing fields: rank, name, username/email, password',
      });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    if (!isValidRank(rank)) {
      return res.status(400).json({ error: 'Invalid rank' });
    }

    if (!isValidName(name)) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with upper, lower, and number',
      });
    }

    // Route to appropriate storage backend
    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await createAccountSupabase(
        { username, name, rank, branch, password },
        res
      );
    } else {
      // Legacy mode - delegate back to original server.js handlers
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in createAccount:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Create account using Supabase Auth
 */
async function createAccountSupabase({ username, name, rank, branch, password }, res) {
  try {
    const toAuthEmail = (u) => {
      const s = String(u || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(s) ? s : `${s}@local.dev`;
    };
    const authEmail = toAuthEmail(username);
    // 1. Try sign up with Supabase Auth (best-effort)
    let userId = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: password,
        options: {
          data: {
            full_name: name,
            rank: rank,
            branch: branch || 'USMC',
            username: username,
          },
        },
      });
      if (authError) {
        console.error('Supabase Auth signUp error:', authError);
      } else {
        userId = authData?.user?.id || null;
      }
    } catch (e) {
      console.error('Supabase Auth signUp exception:', e?.message || e);
    }

    const { getClient } = require('./supabaseClient');
    const adminClient = getClient(true);
    const passwordHash = await bcrypt.hash(password, 12);
    // 2. Create user record in public.users
    let userData = null;
    let userError = null;
    try {
      const resp = await adminClient
        .from(USERS_TABLE)
        .insert({
          id: userId,
          rs_email: authEmail,
          rs_name: name,
          rs_rank: rank,
          password_hash: passwordHash,
          created_date: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();
      userData = resp.data;
      userError = resp.error || null;
    } catch (e) {
      userError = e;
    }

    if (userError) {
      console.warn('Admin insert failed; attempting anon insert:', userError?.message || userError);
      try {
        const resp2 = await supabase
          .from(USERS_TABLE)
          .insert({
            rs_email: authEmail,
            rs_name: name,
            rs_rank: rank,
            password_hash: passwordHash,
            created_date: new Date().toISOString(),
            last_updated: new Date().toISOString(),
          })
          .select()
          .single();
        userData = resp2.data;
        userError = resp2.error || null;
      } catch (e2) {
        userError = e2;
      }
    }

    if (userError) {
      console.error('Supabase users insert error:', userError);
      return res.status(500).json({ error: (userError.message || String(userError)) });
    }

    return res.json({
      ok: true,
      userId: userId,
      email: userData.rs_email,
      method: 'supabase',
    });
  } catch (err) {
    console.error('Error in createAccountSupabase:', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

// ============================================================================
// LOGIN ENDPOINT
// ============================================================================

/**
 * User login
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function loginHandler(req, res) {
  try {
    const { username: rawUsername, email, password } = req.body || {};
    const username = String(rawUsername || email || '').trim();

    // === ADD THIS LINE ===
    console.log(`[DEBUG LOGIN] Server received login attempt for user: ${username}`);
    // === END ADDITION ===

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username/email or password' });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // Route to appropriate storage backend
    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await loginSupabase({ username, password }, req, res);
    } else {
      // Legacy mode - delegate back to original server.js handlers
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Login using Supabase Auth
 */
async function loginSupabase({ username, password }, req, res) {
  try {
    const toAuthEmail = (u) => {
      const s = String(u || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(s) ? s : `${s}@local.dev`;
    };
    const authEmail = toAuthEmail(username);
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: password,
    });
    if (authError) {
      console.error(`[DEBUG LOGIN] Supabase Auth failed:`, authError.message);
      try {
        const { getClient, supabase } = require('./supabaseClient');
        let client = null;
        try { client = getClient(true); } catch (_) { client = supabase; }

        // Try multiple identifiers in order: rs_email, username
        const candidates = [
          { column: 'rs_email', value: authEmail },
          { column: 'username', value: username }
        ];
        let userRow = null;
        for (const c of candidates) {
          try {
            const { data, error } = await client
              .from(USERS_TABLE)
              .select('*')
              .ilike(c.column, c.value)
              .limit(1);
            if (!error && Array.isArray(data) && data.length) {
              userRow = data[0];
              console.log(`[DEBUG LOGIN] Fallback match on ${c.column}:`, !!userRow);
              break;
            }
          } catch (qErr) {
            console.warn(`[DEBUG LOGIN] Lookup error on ${c.column}:`, qErr?.message || qErr);
            continue;
          }
        }
        console.log('[DEBUG LOGIN] Fallback resolved row:', !!userRow, 'has hash:', userRow && typeof userRow.password_hash === 'string' && userRow.password_hash.length > 0);
        const allowNoHash = String(process.env.ALLOW_DEV_LOGIN_NO_HASH || '').trim().toLowerCase() === 'true';
        let ok = false;
        if (userRow.password_hash && typeof userRow.password_hash === 'string' && userRow.password_hash.length) {
          ok = await bcrypt.compare(password, userRow.password_hash);
        } else if (allowNoHash) {
          ok = true;
        }
        if (!ok) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        const userData = userRow;
        console.log('[DEBUG LOGIN] Fallback verified via users.password_hash for', userData.rs_email);
        let csrfToken = null;
        let sessionToken = null;
        try {
          const now = Date.now();
        const payload = { u: String(userData.rs_email || '').trim(), iat: now, exp: now + SESSION_TTL_MS };
          sessionToken = signSessionPayload(payload);
          csrfToken = crypto.randomBytes(32).toString('hex');
          const cookies = [
            serializeCookie('fitrep_session', sessionToken, { httpOnly: true, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: SESSION_TTL_MS / 1000 }),
            serializeCookie('fitrep_csrf', csrfToken, { httpOnly: false, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: SESSION_TTL_MS / 1000 })
          ];
          res.setHeader('Set-Cookie', cookies);
        } catch (_) {
          console.warn('Failed to set session cookies');
        }
        const fallbackUsername = String(userData.rs_email || '').trim().toLowerCase();
        const fallbackIsAdmin = fallbackUsername === ADMIN_USERNAME;

        return res.json({
          ok: true,
          user: {
            id: userData.id,
            username: fallbackUsername,
            email: userData.rs_email,
            full_name: userData.rs_name,
            rank: userData.rs_rank,
            branch: userData.branch,
            rsEmail: userData.rs_email,
            rsName: userData.rs_name,
            rsRank: userData.rs_rank,
            isAdmin: fallbackIsAdmin,
          },
          csrfToken,
          sessionToken,
          method: 'supabase-fallback',
        });
      } catch (_) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
    }

    const user = authData.user;
    console.log(`[DEBUG LOGIN] Supabase Auth success for user ID:`, user.id);

    // 2. Fetch user data from public.users
    const { data: userData, error: userError } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('id', user.id)
      .single();

    let resolvedUser = userData || null;
    if (userError || !userData) {
      const meta = user?.user_metadata || user?.user_metadata || user?.app_metadata || {};
      const email = user?.email || '';
      const usernameCandidate = (meta.username || (email ? String(email).split('@')[0] : ''));
      resolvedUser = {
        id: user.id,
        email,
        name: meta.full_name || '',
        rank: meta.rank || '',
        branch: meta.branch || 'USMC',
        username: usernameCandidate,
      };
    }

    // Create cookie-based session compatible with server middleware
    let csrfToken = null;
    let sessionToken = null;
    try {
      const now = Date.now();
      const loginEmail = String(resolvedUser.rs_email || resolvedUser.email || authEmail || '').trim().toLowerCase();
      const payload = { u: loginEmail, iat: now, exp: now + SESSION_TTL_MS };
      sessionToken = signSessionPayload(payload);
      csrfToken = crypto.randomBytes(32).toString('hex');
      const cookies = [
        serializeCookie('fitrep_session', sessionToken, { httpOnly: true, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: SESSION_TTL_MS / 1000 }),
        serializeCookie('fitrep_csrf', csrfToken, { httpOnly: false, path: '/', sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, maxAge: SESSION_TTL_MS / 1000 })
      ];
      const prev = res.getHeader('Set-Cookie');
      if (prev && Array.isArray(prev)) {
        res.setHeader('Set-Cookie', [...prev, ...cookies]);
      } else if (typeof prev === 'string' && prev.length) {
        res.setHeader('Set-Cookie', [prev, ...cookies]);
      } else {
        res.setHeader('Set-Cookie', cookies);
      }
    } catch (_) { /* best-effort */ }

    // Save session (if using express-session)
    if (req.session && req.session.save) {
      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ error: 'Login failed' });
          }

          const loginUsername = String(resolvedUser.username || resolvedUser.rs_email || resolvedUser.email || '').trim().toLowerCase();
          const userIsAdmin = loginUsername === ADMIN_USERNAME;

          return res.json({
            ok: true,
            user: {
              id: user.id,
              username: loginUsername,
              email: resolvedUser.rs_email || resolvedUser.email,
              full_name: resolvedUser.rs_name || resolvedUser.name || resolvedUser.full_name,
              rank: resolvedUser.rs_rank || resolvedUser.rank,
              branch: resolvedUser.branch,
              rsEmail: resolvedUser.rs_email || resolvedUser.email,
              rsName: resolvedUser.rs_name || resolvedUser.name || resolvedUser.full_name,
              rsRank: resolvedUser.rs_rank || resolvedUser.rank,
              isAdmin: userIsAdmin,
            },
            csrfToken,
            sessionToken,
            method: 'supabase',
          });
        });
      });
    }

    // No session middleware, return user data
    const loginUsername2 = String(resolvedUser.username || resolvedUser.rs_email || resolvedUser.email || '').trim().toLowerCase();
    const userIsAdmin2 = loginUsername2 === ADMIN_USERNAME;

    return res.json({
      ok: true,
      user: {
        id: user.id,
        username: loginUsername2,
        email: resolvedUser.rs_email || resolvedUser.email,
        full_name: resolvedUser.rs_name || resolvedUser.name || resolvedUser.full_name,
        rank: resolvedUser.rs_rank || resolvedUser.rank,
        branch: resolvedUser.branch,
        rs_email: resolvedUser.rs_email || resolvedUser.email,
        rs_name: resolvedUser.rs_name || resolvedUser.name || resolvedUser.full_name,
        rs_rank: resolvedUser.rs_rank || resolvedUser.rank,
        isAdmin: userIsAdmin2,
      },
      csrfToken,
      sessionToken,
      method: userError || !userData ? 'supabase-auth-only' : 'supabase',
    });
  } catch (err) {
    console.error('Error in loginSupabase:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

async function resetPasswordHandler(req, res) {
  try {
    const { rsEmail, username, newPassword, confirmPassword } = req.body || {};
    const u = String(username || '').trim();
    const e = String(rsEmail || '').trim();
    const np = String(newPassword || '');
    const cp = String(confirmPassword || '');
    if (!u || !e || !np || !cp) {
      return res.status(400).json({ error: 'Missing fields: rsEmail, username, newPassword, confirmPassword' });
    }
    if (!isValidUsername(u)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    if (!isStrongPassword(np)) {
      return res.status(400).json({ error: 'Weak password: use at least 8 chars with upper, lower, and number' });
    }
    if (np !== cp) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    const storageMode = getStorageMode();
    if (!(storageMode === 'supabase' && isSupabaseAvailable())) {
      return res.status(501).json({ error: 'Legacy storage mode - use original endpoint' });
    }
    const toAuthEmail = (s) => {
      const t = String(s || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(t) ? t : `${t}@local.dev`;
    };
    const emailAuth = toAuthEmail(e);
    const usernameAuth = toAuthEmail(u);
    const { getClient } = require('./supabaseClient');
    let client = null;
    try { client = getClient(true); } catch (_) { client = supabase; }
    let userRow = null;
    try {
      const { data } = await client.from(USERS_TABLE).select('*').ilike('rs_email', emailAuth).limit(1);
      userRow = Array.isArray(data) ? data[0] : data;
    } catch (_) {}
    if (!userRow) {
      const { data } = await client.from(USERS_TABLE).select('*').ilike('username', u).limit(1);
      userRow = Array.isArray(data) ? data[0] : data;
    }
    if (!userRow) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const unameMatch = String(userRow.username || '').trim().toLowerCase() === String(u).toLowerCase();
    const emailMatch = String(userRow.rs_email || '').trim().toLowerCase() === String(emailAuth).toLowerCase();
    if (!unameMatch && !emailMatch) {
      return res.status(403).json({ error: 'Provided email and username do not match account' });
    }
    const hash = await bcrypt.hash(np, 12);
    let authUpdated = false;
    try {
      if (userRow.id && supabaseAdmin) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userRow.id, { password: np });
        authUpdated = !authErr;
      }
    } catch (_) {
      authUpdated = false;
    }
    const { error: updErr } = await client
      .from(USERS_TABLE)
      .update({ password_hash: hash, last_updated: new Date().toISOString() })
      .eq('rs_email', userRow.rs_email)
      .select()
      .single();
    if (updErr) {
      return res.status(500).json({ error: 'Failed to update password' });
    }
    return res.json({ ok: true, method: 'supabase', authUpdated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createAccountHandler,
  loginHandler,
  resetPasswordHandler,

  // Export validators for reuse
  isValidUsername,
  isValidRank,
  isValidName,
  isStrongPassword,
};
