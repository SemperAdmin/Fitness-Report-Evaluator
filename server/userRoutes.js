/**
 * User Profile Routes with Supabase Support
 *
 * This module provides user profile management endpoints:
 * - POST /api/user/save - Update user profile
 * - GET /api/user/load - Load user profile
 * - POST /api/user/migrate-email - Change user email
 */

const { getStorageMode, isSupabaseAvailable, getClient, USERS_TABLE } = require('./supabaseClient');
const { getUserByEmail, updateUser, updateUserEmail } = require('./supabaseService');

// ============================================================================
// MIDDLEWARE: Require Authentication
// ============================================================================

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req, res, next) {
  const hasSession = Boolean(req.session && req.session.rsEmail);
  const hasCookieUser = Boolean(req.sessionUser);
  if (!hasSession && !hasCookieUser) {
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
    const rsEmail = req.session?.rsEmail || req.sessionUser || req.query.email;

    if (!rsEmail) {
      return res.status(400).json({ error: 'Email required' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await loadUserSupabase(rsEmail, req, res);
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
async function loadUserSupabase(rsEmail, req, res) {
  try {
    const { data: user, error } = await getUserByEmail(rsEmail);

    if (error) {
      console.error('Error loading user:', error);
      return res.status(500).json({ error: 'Failed to load user profile' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let contactEmail = (user.rs_email || (req?.session?.rsEmail) || null);
    
    // Fallback to GitHub if email is missing or looks like a username/placeholder
    const isPlaceholder = (s) => !String(s).includes('@') || String(s).endsWith('@local.dev');
    if (!contactEmail || isPlaceholder(contactEmail)) {
      try {
        const token = process.env.FITREP_DATA || '';
        const repo = process.env.DATA_REPO || 'SemperAdmin/Fitness-Report-Evaluator-Data';
        if (token) {
          const prefix = String(rsEmail || '').trim().toLowerCase().split('@')[0];
          const apiUrl = `https://api.github.com/repos/${repo}/contents/users/${prefix}.json`;
          const resp = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (resp.ok) {
            const data = await resp.json();
            try {
              const jsonStr = Buffer.from(data.content || '', 'base64').toString('utf8');
              const obj = JSON.parse(jsonStr);
              contactEmail = obj && (obj.rsEmail || obj.contactEmail) ? String(obj.rsEmail || obj.contactEmail).trim() : contactEmail;
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
    return res.json({
      rsEmail: user.rs_email || user.username || rsEmail,
      username: user.username || '',
      rsName: user.rs_name,
      rsRank: user.rs_rank,
      contactEmail,
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
    const body = req.body || {};
    const { rsEmail, rsName, rsRank, previousEmail, username } = body;
    const contactEmail =
      (body && body.contactEmail) ||
      (body && body.userData && body.userData.contactEmail) ||
      null;

    if (!rsEmail || !rsName || !rsRank) {
      return res.status(400).json({ error: 'Missing required fields: rsEmail, rsName, rsRank' });
    }

    // SECURITY: Ensure user is authenticated and can only update their own profile
    const sessionEmail = req.session?.rsEmail || req.sessionUser;
    if (!sessionEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const s1 = String(sessionEmail || '').trim().toLowerCase();
    const sKey = s1.includes('@') ? s1.split('@')[0] : s1;
    const allowed = [rsEmail, previousEmail]
      .filter(Boolean)
      .some((v) => {
        const r1 = String(v || '').trim().toLowerCase();
        const rKey = r1.includes('@') ? r1.split('@')[0] : r1;
        return Boolean(sKey && rKey && sKey === rKey);
      });
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden: Cannot update another user\'s profile' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await saveUserSupabase(
        { rsEmail, rsName, rsRank, previousEmail, contactEmail, username },
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
    return res.status(500).json({ 
      error: 'Internal server error',
      details: err.message || err
    });
  }
}

/**
 * Save user to Supabase
 */
async function saveUserSupabase({ rsEmail, rsName, rsRank, previousEmail, contactEmail, username }, req, res) {
  try {
    // Handle email migration if previousEmail is provided
    if (previousEmail && previousEmail !== rsEmail) {
      const { data: migrated, error: migrateError } = await updateUserEmail(
        previousEmail,
        rsEmail
      );

      if (migrateError) {
        console.error('Error migrating email:', migrateError);
        const msg = migrateError.message || '';
        const status = msg.includes('already exists') ? 409 : 500;
        return res.status(status).json({
          error: 'Failed to update email',
          details: msg,
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
          username: migrated.username || '',
          rsName: migrated.rs_name,
          rsRank: migrated.rs_rank,
        },
        emailMigrated: true,
      });
    }

    // Regular profile update
    // Use passed contactEmail or fallback to body
    const finalContactEmail = contactEmail ||
      (req.body && req.body.contactEmail) ||
      (req.body && req.body.userData && req.body.userData.contactEmail) ||
      null;

    const { data: updated, error } = await updateUser(rsEmail, { 
      rsName, 
      rsRank, 
      contactEmail: finalContactEmail,
      username: username // Use provided username (from body) instead of forcing email
    });

    if (error) {
      console.error('Error updating user:', error);
      const msg = error.message || '';
      const status = (msg.includes('already exists') || (error.code === '23505')) ? 409 : 500;
      return res.status(status).json({ 
        error: 'Failed to update profile',
        details: msg || error 
      });
    }

    // Update session
    if (req.session) {
      req.session.rsName = rsName;
      req.session.rsRank = rsRank;
      if (contactEmail) {
        req.session.contactEmail = contactEmail;
      }
    }

    try {
      const token = process.env.FITREP_DATA || '';
      const repo = process.env.DATA_REPO || 'SemperAdmin/Fitness-Report-Evaluator-Data';
      if (token) {
        const prefix = String(rsEmail || '').trim().toLowerCase().split('@')[0];
        const filePath = `users/${prefix}.json`;
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        let sha = '';
        try {
          const getResp = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (getResp.status === 200) {
            const existing = await getResp.json();
            sha = existing.sha || '';
          }
        } catch (_) {}
        const now = new Date().toISOString();
        const bodyObj = {
          rsEmail: updated?.rs_email || rsEmail,
          rsName,
          rsRank,
          branch: 'USMC',
          contactEmail: (updated?.rs_email || rsEmail) || null,
          username: String(rsEmail || '').trim().toLowerCase(),
          full_name: rsName,
          rank: rsRank,
          createdDate: updated?.created_date || now,
          lastUpdated: now
        };
        const contentStr = JSON.stringify(bodyObj, null, 2);
        const contentB64 = Buffer.from(contentStr, 'utf8').toString('base64');
        const msg = sha ? `Update profile via Server - ${now}` : `Create profile via Server - ${now}`;
        const putBody = { message: msg, content: contentB64, branch: 'main', ...(sha && { sha }) };
        try {
          const putResp = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(putBody)
          });
          if (!putResp.ok) {
            try { await putResp.text(); } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}

    return res.json({
      ok: true,
      user: {
        rsEmail: updated.rs_email,
        username: updated.username || '',
        rsName: updated.rs_name,
        rsRank: updated.rs_rank,
        contactEmail: updated.rs_email || null,
      },
    });
  } catch (err) {
    console.error('Error in saveUserSupabase:', err);
    return res.status(500).json({ 
      error: 'Failed to save profile',
      details: err.message || err
    });
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
    const { confirm } = req.body || {};
    const rsEmail = (req.body?.rsEmail || req.query?.rsEmail || req.session?.rsEmail || '').trim();

    // Require explicit confirmation
    if (confirm !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: 'Confirmation required',
        hint: 'Send { confirm: "DELETE_MY_ACCOUNT" } to confirm deletion',
      });
    }

    // Ensure user can only delete their own account
    if (!rsEmail || req.session?.rsEmail !== rsEmail) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      // Note: Deleting user will CASCADE delete all evaluations and traits
      const client = getClient(true);

      const { error } = await client.from(USERS_TABLE).delete().eq('rs_email', rsEmail);

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
