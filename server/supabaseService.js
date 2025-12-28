/**
 * Supabase Service Layer
 *
 * This module provides a clean API for database operations, abstracting
 * Supabase implementation details from the Express routes.
 *
 * All functions return standardized responses: { data, error }
 */

const { getClient, isSupabaseAvailable, USERS_TABLE, EVALUATIONS_TABLE, TRAITS_TABLE } = require('./supabaseClient');

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Create a new user account
 * @param {Object} userData - User data
 * @param {string} userData.rsEmail - User email (unique identifier)
 * @param {string} userData.rsName - User full name
 * @param {string} userData.rsRank - User rank
 * @param {string} userData.passwordHash - bcrypt hashed password
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function createUser({ email, name, rank, username, passwordHash }) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true); // Use admin client for user creation

    const { data, error } = await client
      .from(USERS_TABLE)
      .insert([
        {
          rs_email: email,
          rs_name: name,
          rs_rank: rank,
          password_hash: passwordHash || '',
          created_date: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      // Check for duplicate email
      if (error.code === '23505') {
        return {
          data: null,
          error: new Error('An account with this email already exists'),
        };
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error creating user:', err);
    return { data: null, error: err };
  }
}

/**
 * Ensure a user exists, creating a minimal record if missing
 * @param {string} rsEmail
 * @param {string} rsName
 * @param {string} rsRank
 */
async function ensureUserExists(identifier, rsName, rsRank) {
  const existing = await getUserByEmail(identifier);
  if (existing && existing.data) return { data: existing.data, error: null };
  const authEmail = `${String(identifier || '').trim().toLowerCase()}@local.dev`;
  return await createUser({ email: authEmail, name: rsName, rank: rsRank, username: identifier, passwordHash: '' });
}

/**
 * Get user by email
 * @param {string} rsEmail - User email
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function getUserByEmail(identifier) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true); // Use admin to bypass RLS

    let { data, error } = await client
      .from(USERS_TABLE)
      .select('*')
      .ilike('rs_email', identifier)
      .limit(1);
    const candidate = Array.isArray(data) ? data[0] : data;
    if (!candidate) {
      const { data: byUsername } = await client
        .from(USERS_TABLE)
        .select('*')
        .ilike('username', identifier)
        .limit(1);
      const cand2 = Array.isArray(byUsername) ? byUsername[0] : byUsername;
      if (!cand2) {
        return { data: null, error: null };
      }
      return { data: cand2, error: null };
    }
    return { data: candidate, error: null };
  } catch (err) {
    console.error('Error getting user:', err);
    return { data: null, error: err };
  }
}

/**
 * Update user profile
 * @param {string} rsEmail - User email (identifier)
 * @param {Object} updates - Fields to update
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function updateUser(rsEmail, updates) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);
    let { data: existingUser, error: lookupError } = await getUserByEmail(rsEmail);

    // FALLBACK: If user not found by identifier, try finding by rs_name if provided
    // This handles cases where rs_email is NULL in DB but user exists with name
    if ((!existingUser || !existingUser.id) && updates.rsName) {
      try {
        const { data: byName } = await client
          .from(USERS_TABLE)
          .select('*')
          .eq('rs_name', updates.rsName)
          .limit(1);
        
        if (byName && byName.length > 0) {
          // If rank also matches (if provided), or just trust the name
          const candidate = byName[0];
          if (!updates.rsRank || candidate.rs_rank === updates.rsRank) {
            existingUser = candidate;
            lookupError = null;
          }
        }
      } catch (_) {}
    }

    if (lookupError) {
      return { data: null, error: lookupError };
    }
    if (!existingUser || !existingUser.id) {
      return { data: null, error: new Error('User not found') };
    }

    // Safe Update Strategy:
    // 1. Attempt to update only standard fields (rs_email, rs_name, rs_rank)
    // 2. If successful, attempt to update username (ignoring errors if column missing)
    
    // Standard fields (guaranteed to exist)
    const standardUpdates = {
      rs_name: updates.rsName,
      rs_rank: updates.rsRank,
      last_updated: new Date().toISOString(),
    };

    if (updates.contactEmail && updates.contactEmail.includes('@')) {
      standardUpdates.rs_email = updates.contactEmail;
    }
    
    // Self-healing: If rs_email is NULL, force it
    if (!existingUser.rs_email && !standardUpdates.rs_email) {
      const newEmail = updates.contactEmail || (rsEmail.includes('@') ? rsEmail : null);
      if (newEmail) standardUpdates.rs_email = newEmail;
    }

    // Remove undefined
    Object.keys(standardUpdates).forEach(
      (key) => standardUpdates[key] === undefined && delete standardUpdates[key]
    );

    // Execute Standard Update
    const { data, error } = await client
      .from(USERS_TABLE)
      .update(standardUpdates)
      .eq('id', existingUser.id)
      .select()
      .single();

    if (error) {
      // If standard update fails, return error immediately
      return { data: null, error };
    }

    // Optional fields (might not exist in schema)
    if (updates.username) {
      try {
        await client
          .from(USERS_TABLE)
          .update({ username: updates.username })
          .eq('id', existingUser.id);
      } catch (err) {
        // Ignore username update failures (column missing, etc.)
        // This ensures the main profile update succeeds even if username fails
        console.warn('Username update skipped:', err.message);
      }
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error updating user:', err);
    return { data: null, error: err };
  }
}

/**
 * Update user email (migration scenario)
 * @param {string} oldEmail - Current email
 * @param {string} newEmail - New email
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function updateUserEmail(oldEmail, newEmail) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);
    const { data: existingUser, error: lookupError } = await getUserByEmail(oldEmail);
    if (lookupError) {
      return { data: null, error: lookupError };
    }
    if (!existingUser || !existingUser.id) {
      return { data: null, error: new Error('User not found') };
    }

    // Idempotency check: If email is already updated, return success
    if (existingUser.rs_email === newEmail) {
      return { data: existingUser, error: null };
    }

    const { data, error } = await client
      .from(USERS_TABLE)
      .update({
        rs_email: newEmail,
        last_updated: new Date().toISOString(),
      })
      .eq('id', existingUser.id)
      .select()
      .single();

    if (error) {
      // Check for duplicate email
      if (error.code === '23505') {
        return {
          data: null,
          error: new Error('An account with this email already exists'),
        };
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error updating user email:', err);
    return { data: null, error: err };
  }
}

// ============================================================================
// EVALUATION OPERATIONS
// ============================================================================

/**
 * Create or update an evaluation
 * @param {Object} evaluationData - Full evaluation object
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function saveEvaluation(evaluationData) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);

    // Get user ID from email
    let { data: user, error: userError } = await getUserByEmail(
      evaluationData.rsEmail
    );

    if (userError || !user) {
      const rsNameMaybe = evaluationData.rsInfo?.name || evaluationData.rsName || '';
      const rsRankMaybe = evaluationData.rsInfo?.rank || evaluationData.rsRank || '';
      const ensured = await ensureUserExists(evaluationData.rsEmail, rsNameMaybe, rsRankMaybe);
      if (ensured.error || !ensured.data) {
        return {
          data: null,
          error: ensured.error || (userError || new Error('User not found')),
        };
      }
      user = ensured.data;
    }

    // Prepare evaluation record
    const evalRecord = {
      user_id: user.id,
      evaluation_id: evaluationData.evaluationId,
      version: evaluationData.version || '1.0',
      occasion: evaluationData.occasion,
      completed_date: evaluationData.completedDate,
      fitrep_average: evaluationData.fitrepAverage
        ? parseFloat(evaluationData.fitrepAverage)
        : null,
      marine_name: evaluationData.marineInfo?.name,
      marine_rank: evaluationData.marineInfo?.rank,
      evaluation_period_from: evaluationData.marineInfo?.evaluationPeriod?.from,
      evaluation_period_to: evaluationData.marineInfo?.evaluationPeriod?.to,
      rs_name: evaluationData.rsInfo?.name || evaluationData.rsName,
      rs_email: evaluationData.rsInfo?.email || evaluationData.rsEmail,
      rs_rank: evaluationData.rsInfo?.rank || evaluationData.rsRank,
      section_i_comments: evaluationData.sectionIComments,
      directed_comments: evaluationData.directedComments,
      sync_status: evaluationData.syncStatus || 'synced',
      saved_at: evaluationData.savedAt || new Date().toISOString(),
    };

    // Check if evaluation exists (and get comments for versioning)
    const { data: existing } = await client
      .from(EVALUATIONS_TABLE)
      .select('id, section_i_comments, section_i_comments_version, directed_comments, directed_comments_version')
      .eq('evaluation_id', evaluationData.evaluationId)
      .single();

    let savedEval;
    if (existing) {
      const prevComments = existing.section_i_comments || '';
      const newComments = evaluationData.sectionIComments || '';
      const prevVersion = Number(existing.section_i_comments_version || 1);
      const nextVersion = prevVersion + (newComments !== prevComments ? 1 : 0);
      evalRecord.section_i_comments_version = nextVersion;
      const prevDirected = existing.directed_comments || '';
      const newDirected = evaluationData.directedComments || '';
      const prevDirectedVersion = Number(existing.directed_comments_version || 1);
      const nextDirectedVersion = prevDirectedVersion + (newDirected !== prevDirected ? 1 : 0);
      evalRecord.directed_comments_version = nextDirectedVersion;
      // Update existing evaluation
      const { data, error } = await client
        .from(EVALUATIONS_TABLE)
        .update(evalRecord)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return { data: null, error };
      savedEval = data;
    } else {
      evalRecord.section_i_comments_version = 1;
      evalRecord.directed_comments_version = 1;
      // Insert new evaluation
      const { data, error } = await client
        .from(EVALUATIONS_TABLE)
        .insert([evalRecord])
        .select()
        .single();

      if (error) return { data: null, error };
      savedEval = data;
    }

    // Normalize trait evaluations (support object maps from UI) and save if provided
    let traitsSrc = evaluationData.traitEvaluations;
    if (traitsSrc && !Array.isArray(traitsSrc) && typeof traitsSrc === 'object') {
      try { traitsSrc = Object.values(traitsSrc); } catch (_) { traitsSrc = []; }
    }
    if (Array.isArray(traitsSrc) && traitsSrc.length > 0) {
      // Delete existing traits for this evaluation
      await client
        .from(TRAITS_TABLE)
        .delete()
        .eq('evaluation_id', savedEval.id);

      // Insert new traits
      const sectionMap = {
        'Mission Accomplishment': 'A',
        'Leadership': 'B',
        'Individual Character': 'C',
        'Intellect and Wisdom': 'D',
        'Fulfillment of Evaluation Responsibilities': 'E',
      };
      const traits = traitsSrc.map((trait) => {
        const s = trait.section;
        const normalized =
          typeof s === 'string'
            ? (sectionMap[s] || s)
            : s;
        return {
          evaluation_id: savedEval.id,
          section: normalized,
          trait: trait.trait,
          grade: String(trait.grade || '').toUpperCase(),
          grade_number: Math.min(7, Math.max(1, Number(trait.gradeNumber || 0))),
          justification: trait.justification || null,
        };
      });

      const { error: traitError } = await client
        .from(TRAITS_TABLE)
        .insert(traits);

      if (traitError) {
        console.error('Error saving traits:', traitError);
        return { data: savedEval, error: traitError };
      }
    }

    return { data: savedEval, error: null };
  } catch (err) {
    console.error('Error saving evaluation:', err);
    return { data: null, error: err };
  }
}

/**
 * Get all evaluations for a user
 * @param {string} rsEmail - User email
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
async function getEvaluationsByUser(rsEmail) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);

    // Get user
    const { data: user, error: userError } = await getUserByEmail(rsEmail);
    if (userError || !user) {
      return { data: null, error: userError || new Error('User not found') };
    }

    // Get evaluations
    const { data, error } = await client
      .from(EVALUATIONS_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('completed_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Error getting evaluations:', err);
    return { data: null, error: err };
  }
}

/**
 * Get all evaluations with traits for a user (optimized - single query with join)
 * @param {string} rsEmail - User email
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
async function getFullEvaluationsByUser(rsEmail) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);

    // 1. Resolve user first to get user_id (definitive source for account ownership)
    let userId = null;
    const { data: user, error: uErr } = await getUserByEmail(rsEmail);
    if (!uErr && user && user.id) {
      userId = user.id;
    }

    let evaluations = [];

    // 2. Query by user_id if available (primary method)
    if (userId) {
      const { data: evalByUserId, error: userErr } = await client
        .from(EVALUATIONS_TABLE)
        .select(`
          *,
          trait_evaluations (
            id,
            section,
            trait,
            grade,
            grade_number,
            justification
          )
        `)
        .eq('user_id', userId)
        .order('completed_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (userErr) {
        console.warn('Error fetching evaluations by user_id (falling back to email):', userErr);
      } else if (Array.isArray(evalByUserId)) {
        evaluations = evalByUserId;
      }
    }

    // 3. Fallback: Query by denormalized rs_email if no evaluations found via user_id
    // This handles legacy data, mixed records during migration, or cases where user_id might be missing
    if (!evaluations.length) {
      const { data: evalByEmail, error: emailErr } = await client
        .from(EVALUATIONS_TABLE)
        .select(`
          *,
          trait_evaluations (
            id,
            section,
            trait,
            grade,
            grade_number,
            justification
          )
        `)
        .ilike('rs_email', rsEmail)
        .order('completed_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (emailErr) {
        return { data: null, error: emailErr };
      }
      if (Array.isArray(evalByEmail)) {
        evaluations = evalByEmail;
      }
    }

    // Format to match frontend JSON structure
    const formatted = (evaluations || []).map((ev) => ({
      version: ev.version,
      savedAt: ev.saved_at,
      rsEmail: ev.rs_email,
      rsName: ev.rs_name,
      rsRank: ev.rs_rank,
      evaluation: {
        evaluationId: ev.evaluation_id,
        occasion: ev.occasion,
        completedDate: ev.completed_date,
        fitrepAverage: ev.fitrep_average?.toString(),
        marineInfo: {
          name: ev.marine_name,
          rank: ev.marine_rank,
          evaluationPeriod: {
            from: ev.evaluation_period_from,
            to: ev.evaluation_period_to,
          },
        },
        rsInfo: {
          name: ev.rs_name,
          email: ev.rs_email,
          rank: ev.rs_rank,
        },
        sectionIComments: ev.section_i_comments,
        sectionICommentsVersion: ev.section_i_comments_version,
        directedComments: ev.directed_comments,
        directedCommentsVersion: ev.directed_comments_version,
        traitEvaluations: (ev.trait_evaluations || []).map((trait) => ({
          id: trait.id,
          section: trait.section,
          trait: trait.trait,
          grade: trait.grade,
          gradeNumber: trait.grade_number,
          justification: trait.justification,
        })),
        syncStatus: ev.sync_status,
      },
    }));

    return { data: formatted, error: null };
  } catch (err) {
    console.error('Error getting full evaluations:', err);
    return { data: null, error: err };
  }
}

/**
 * Get a single evaluation with all traits
 * @param {string} evaluationId - Evaluation ID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function getEvaluationById(evaluationId) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);

    // Get evaluation
    const { data: evaluation, error: evalError } = await client
      .from(EVALUATIONS_TABLE)
      .select('*')
      .eq('evaluation_id', evaluationId)
      .single();

    if (evalError) {
      return { data: null, error: evalError };
    }

    // Get traits
    const { data: traits, error: traitError } = await client
      .from(TRAITS_TABLE)
      .select('*')
      .eq('evaluation_id', evaluation.id)
      .order('section')
      .order('trait');

    if (traitError) {
      console.error('Error getting traits:', traitError);
    }

    // Combine into single object matching JSON structure
    const result = {
      version: evaluation.version,
      savedAt: evaluation.saved_at,
      rsEmail: evaluation.rs_email,
      rsName: evaluation.rs_name,
      rsRank: evaluation.rs_rank,
      evaluation: {
        evaluationId: evaluation.evaluation_id,
        occasion: evaluation.occasion,
        completedDate: evaluation.completed_date,
        fitrepAverage: evaluation.fitrep_average?.toString(),
        marineInfo: {
          name: evaluation.marine_name,
          rank: evaluation.marine_rank,
          evaluationPeriod: {
            from: evaluation.evaluation_period_from,
            to: evaluation.evaluation_period_to,
          },
        },
        rsInfo: {
          name: evaluation.rs_name,
          email: evaluation.rs_email,
          rank: evaluation.rs_rank,
        },
        sectionIComments: evaluation.section_i_comments,
        sectionICommentsVersion: evaluation.section_i_comments_version,
        directedComments: evaluation.directed_comments,
        directedCommentsVersion: evaluation.directed_comments_version,
        traitEvaluations: traits || [],
        syncStatus: evaluation.sync_status,
      },
    };

    return { data: result, error: null };
  } catch (err) {
    console.error('Error getting evaluation:', err);
    return { data: null, error: err };
  }
}

/**
 * Delete an evaluation and all its traits
 * @param {string} evaluationId - Evaluation ID
 * @returns {Promise<{data: boolean, error: Error|null}>}
 */
async function deleteEvaluation(evaluationId) {
  if (!isSupabaseAvailable()) {
    return { data: false, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true);

    // Delete evaluation (traits will cascade delete)
    const { error } = await client
      .from(EVALUATIONS_TABLE)
      .delete()
      .eq('evaluation_id', evaluationId);

    if (error) {
      return { data: false, error };
    }

    return { data: true, error: null };
  } catch (err) {
    console.error('Error deleting evaluation:', err);
    return { data: false, error: err };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // User operations
  createUser,
  getUserByEmail,
  updateUser,
  updateUserEmail,
  ensureUserExists,

  // Evaluation operations
  saveEvaluation,
  getEvaluationsByUser,
  getFullEvaluationsByUser,
  getEvaluationById,
  deleteEvaluation,
};
