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
const { getStorageMode, isSupabaseAvailable } = require('./supabaseClient');
const { createUser, getUserByEmail } = require('./supabaseService');

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
 * Validate rank format
 * @param {string} rank - Rank to validate
 * @returns {boolean} True if valid
 */
function isValidRank(rank) {
  if (!rank || typeof rank !== 'string') return false;
  const trimmed = rank.trim();
  // Allow common USMC ranks
  const validRanks = [
    'Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', 'MGySgt', 'SgtMaj',
    '2ndLt', '1stLt', 'Capt', 'Maj', 'LtCol', 'Col', 'BGen', 'MajGen', 'LtGen', 'Gen',
  ];
  return validRanks.includes(trimmed) || (trimmed.length > 0 && trimmed.length < 20);
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
    const { rank, name, email, password, username: rawUsername } = req.body || {};
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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Route to appropriate storage backend
    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await createAccountSupabase(
        { username, name, rank, passwordHash },
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
 * Create account using Supabase
 */
async function createAccountSupabase({ username, name, rank, passwordHash }, res) {
  try {
    // Check if user already exists
    const { data: existing } = await getUserByEmail(username);

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Create new user
    const { data, error } = await createUser({
      rsEmail: username,
      rsName: name,
      rsRank: rank,
      passwordHash,
    });

    if (error) {
      console.error('Supabase createUser error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create account' });
    }

    return res.json({
      ok: true,
      userId: data.id,
      email: data.rs_email,
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
 * Login using Supabase
 */
async function loginSupabase({ username, password }, req, res) {
  try {
    // Get user from database
    const { data: user, error } = await getUserByEmail(username);

    if (error) {
      console.error('Supabase getUserByEmail error:', error);
      return res.status(500).json({ error: 'Login failed' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Create session
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.rsEmail = user.rs_email;
    req.session.rsName = user.rs_name;
    req.session.rsRank = user.rs_rank;

    // Save session (if using express-session)
    if (req.session.save) {
      return new Promise((resolve) => {
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ error: 'Login failed' });
          }

          return res.json({
            ok: true,
            user: {
              id: user.id,
              email: user.rs_email,
              name: user.rs_name,
              rank: user.rs_rank,
            },
            method: 'supabase',
          });
        });
      });
    }

    // No session middleware, return user data
    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.rs_email,
        name: user.rs_name,
        rank: user.rs_rank,
      },
      method: 'supabase',
    });
  } catch (err) {
    console.error('Error in loginSupabase:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createAccountHandler,
  loginHandler,

  // Export validators for reuse
  isValidUsername,
  isValidRank,
  isValidName,
  isStrongPassword,
};
