/**
 * Supabase Service Layer
 *
 * This module provides a clean API for database operations, abstracting
 * Supabase implementation details from the Express routes.
 *
 * All functions return standardized responses: { data, error }
 */

const { getClient, isSupabaseAvailable } = require('./supabaseClient');

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
async function createUser({ rsEmail, rsName, rsRank, passwordHash }) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true); // Use admin client for user creation

    const { data, error } = await client
      .from('users')
      .insert([
        {
          rs_email: rsEmail,
          rs_name: rsName,
          rs_rank: rsRank,
          password_hash: passwordHash,
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
 * Get user by email
 * @param {string} rsEmail - User email
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
async function getUserByEmail(rsEmail) {
  if (!isSupabaseAvailable()) {
    return { data: null, error: new Error('Supabase not available') };
  }

  try {
    const client = getClient(true); // Use admin to bypass RLS

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('rs_email', rsEmail)
      .single();

    if (error) {
      // Not found is not an error in this context
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error };
    }

    return { data, error: null };
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

    // Filter out immutable fields
    const allowedUpdates = {
      rs_name: updates.rsName,
      rs_rank: updates.rsRank,
      last_updated: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(
      (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const { data, error } = await client
      .from('users')
      .update(allowedUpdates)
      .eq('rs_email', rsEmail)
      .select()
      .single();

    if (error) {
      return { data: null, error };
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

    const { data, error } = await client
      .from('users')
      .update({
        rs_email: newEmail,
        last_updated: new Date().toISOString(),
      })
      .eq('rs_email', oldEmail)
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
    const { data: user, error: userError } = await getUserByEmail(
      evaluationData.rsEmail
    );

    if (userError || !user) {
      return {
        data: null,
        error: userError || new Error('User not found'),
      };
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
      sync_status: evaluationData.syncStatus || 'synced',
      saved_at: evaluationData.savedAt || new Date().toISOString(),
    };

    // Check if evaluation exists
    const { data: existing } = await client
      .from('evaluations')
      .select('id')
      .eq('evaluation_id', evaluationData.evaluationId)
      .single();

    let savedEval;
    if (existing) {
      // Update existing evaluation
      const { data, error } = await client
        .from('evaluations')
        .update(evalRecord)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return { data: null, error };
      savedEval = data;
    } else {
      // Insert new evaluation
      const { data, error } = await client
        .from('evaluations')
        .insert([evalRecord])
        .select()
        .single();

      if (error) return { data: null, error };
      savedEval = data;
    }

    // Save trait evaluations if provided
    if (evaluationData.traitEvaluations && evaluationData.traitEvaluations.length > 0) {
      // Delete existing traits for this evaluation
      await client
        .from('trait_evaluations')
        .delete()
        .eq('evaluation_id', savedEval.id);

      // Insert new traits
      const traits = evaluationData.traitEvaluations.map((trait) => ({
        evaluation_id: savedEval.id,
        section: trait.section,
        trait: trait.trait,
        grade: trait.grade,
        grade_number: trait.gradeNumber,
      }));

      const { error: traitError } = await client
        .from('trait_evaluations')
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
      .from('evaluations')
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
      .from('evaluations')
      .select('*')
      .eq('evaluation_id', evaluationId)
      .single();

    if (evalError) {
      return { data: null, error: evalError };
    }

    // Get traits
    const { data: traits, error: traitError } = await client
      .from('trait_evaluations')
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
      .from('evaluations')
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

  // Evaluation operations
  saveEvaluation,
  getEvaluationsByUser,
  getEvaluationById,
  deleteEvaluation,
};
