/**
 * User Profile Routes with Supabase Support
 *
 * This module provides user profile management endpoints:
 * - POST /api/user/save - Update user profile
 * - GET /api/user/load - Load user profile
 * - POST /api/user/migrate-email - Change user email
 */

const { getStorageMode, isSupabaseAvailable } = require('./supabaseClient');
const { getUserByEmail, updateUser, updateUserEmail } = require('./supabaseService');

// ============================================================================
// MIDDLEWARE: Require Authentication
// ============================================================================

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.rsEmail) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// ============================================================================
// LOAD USER PROFILE
// ============================================================================

/**
 * Load user profile
 * GET /api/user/load
 */
async function loadUserHandler(req, res) {
  try {
    const rsEmail = req.session?.rsEmail || req.query.email;

    if (!rsEmail) {
      return res.status(400).json({ error: 'Email required' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await loadUserSupabase(rsEmail, res);
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in loadUser:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Load user from Supabase
 */
async function loadUserSupabase(rsEmail, res) {
  try {
    const { data: user, error } = await getUserByEmail(rsEmail);

    if (error) {
      console.error('Error loading user:', error);
      return res.status(500).json({ error: 'Failed to load user profile' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user profile in format expected by frontend
    return res.json({
      rsEmail: user.rs_email,
      rsName: user.rs_name,
      rsRank: user.rs_rank,
      createdDate: user.created_date,
      lastUpdated: user.last_updated,
      evaluationFiles: [], // Deprecated field for compatibility
      evaluations: [], // Deprecated field for compatibility
    });
  } catch (err) {
    console.error('Error in loadUserSupabase:', err);
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
}

// ============================================================================
// SAVE USER PROFILE
// ============================================================================

/**
 * Save/update user profile
 * POST /api/user/save
 */
async function saveUserHandler(req, res) {
  try {
    const { rsEmail, rsName, rsRank, previousEmail } = req.body || {};

    if (!rsEmail || !rsName || !rsRank) {
      return res.status(400).json({ error: 'Missing required fields: rsEmail, rsName, rsRank' });
    }

    // SECURITY: Ensure user can only update their own profile
    if (!req.session?.rsEmail || (req.session.rsEmail !== rsEmail && req.session.rsEmail !== previousEmail)) {
      return res.status(403).json({ error: 'Unauthorized: Cannot update another user\'s profile' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await saveUserSupabase(
        { rsEmail, rsName, rsRank, previousEmail },
        req,
        res
      );
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in saveUser:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Save user to Supabase
 */
async function saveUserSupabase({ rsEmail, rsName, rsRank, previousEmail }, req, res) {
  try {
    // Handle email migration if previousEmail is provided
    if (previousEmail && previousEmail !== rsEmail) {
      const { data: migrated, error: migrateError } = await updateUserEmail(
        previousEmail,
        rsEmail
      );

      if (migrateError) {
        console.error('Error migrating email:', migrateError);
        return res.status(500).json({
          error: 'Failed to update email',
          details: migrateError.message,
        });
      }

      // Update session
      if (req.session) {
        req.session.rsEmail = rsEmail;
      }

      return res.json({
        ok: true,
        user: {
          rsEmail: migrated.rs_email,
          rsName: migrated.rs_name,
          rsRank: migrated.rs_rank,
        },
        emailMigrated: true,
      });
    }

    // Regular profile update
    const { data: updated, error } = await updateUser(rsEmail, { rsName, rsRank });

    if (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    // Update session
    if (req.session) {
      req.session.rsName = rsName;
      req.session.rsRank = rsRank;
    }

    return res.json({
      ok: true,
      user: {
        rsEmail: updated.rs_email,
        rsName: updated.rs_name,
        rsRank: updated.rs_rank,
      },
    });
  } catch (err) {
    console.error('Error in saveUserSupabase:', err);
    return res.status(500).json({ error: 'Failed to save profile' });
  }
}

// ============================================================================
// DELETE USER (Optional - for admin/cleanup)
// ============================================================================

/**
 * Delete user account (Admin only - implement with caution)
 * POST /api/user/delete
 */
async function deleteUserHandler(req, res) {
  try {
    const { rsEmail, confirm } = req.body || {};

    // Require explicit confirmation
    if (confirm !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: 'Confirmation required',
        hint: 'Send { confirm: "DELETE_MY_ACCOUNT" } to confirm deletion',
      });
    }

    // Ensure user can only delete their own account
    if (req.session?.rsEmail !== rsEmail) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      // Note: Deleting user will CASCADE delete all evaluations and traits
      const { getClient } = require('./supabaseClient');
      const client = getClient(true);

      const { error } = await client.from('users').delete().eq('rs_email', rsEmail);

      if (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: 'Failed to delete account' });
      }

      // Clear session
      if (req.session) {
        req.session.destroy();
      }

      return res.json({ ok: true, message: 'Account deleted successfully' });
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
      });
    }
  } catch (err) {
    console.error('Error in deleteUser:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  requireAuth,
  loadUserHandler,
  saveUserHandler,
  deleteUserHandler,
};
