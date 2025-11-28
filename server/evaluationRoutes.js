/**
 * Evaluation Routes with Supabase Support
 *
 * This module provides fitness report evaluation management endpoints:
 * - POST /api/evaluation/save - Save/update an evaluation
 * - GET /api/evaluations/list - List all evaluations for a user
 * - GET /api/evaluation/:id - Get a single evaluation with traits
 * - DELETE /api/evaluation/:id - Delete an evaluation
 */

const { getStorageMode, isSupabaseAvailable } = require('./supabaseClient');
const {
  saveEvaluation,
  getEvaluationsByUser,
  getFullEvaluationsByUser,
  getEvaluationById,
  deleteEvaluation,
} = require('./supabaseService');

// ============================================================================
// SAVE EVALUATION
// ============================================================================

/**
 * Save or update an evaluation
 * POST /api/evaluation/save
 *
 * Request body format:
 * {
 *   rsEmail: string,
 *   rsName: string,
 *   rsRank: string,
 *   evaluationId: string,
 *   occasion: string,
 *   completedDate: string (ISO date),
 *   fitrepAverage: string,
 *   marineInfo: {
 *     name: string,
 *     rank: string,
 *     evaluationPeriod: { from: string, to: string }
 *   },
 *   sectionIComments: string,
 *   traitEvaluations: [
 *     { section: string, trait: string, grade: string, gradeNumber: number }
 *   ],
 *   syncStatus: string
 * }
 */
async function saveEvaluationHandler(req, res) {
  try {
    const evaluationData = req.body;

    // Validation
    if (!evaluationData || !evaluationData.evaluationId) {
      return res.status(400).json({ error: 'Missing evaluationId' });
    }

    if (!evaluationData.rsEmail) {
      return res.status(400).json({ error: 'Missing rsEmail' });
    }

    // Optional: Verify user owns this evaluation (based on session)
    if (req.session?.rsEmail && req.session.rsEmail !== evaluationData.rsEmail) {
      return res.status(403).json({
        error: 'Cannot save evaluation for another user',
      });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await saveEvaluationSupabase(evaluationData, res);
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in saveEvaluation:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Save evaluation to Supabase
 */
async function saveEvaluationSupabase(evaluationData, res) {
  try {
    const { data, error } = await saveEvaluation(evaluationData);

    if (error) {
      console.error('Error saving evaluation:', error);
      return res.status(500).json({
        error: 'Failed to save evaluation',
        details: error.message,
      });
    }

    return res.json({
      ok: true,
      evaluation: {
        id: data.id,
        evaluationId: data.evaluation_id,
        marineName: data.marine_name,
        marineRank: data.marine_rank,
        completedDate: data.completed_date,
        fitrepAverage: data.fitrep_average,
      },
      method: 'supabase',
    });
  } catch (err) {
    console.error('Error in saveEvaluationSupabase:', err);
    return res.status(500).json({ error: 'Failed to save evaluation' });
  }
}

// ============================================================================
// LIST EVALUATIONS
// ============================================================================

/**
 * List all evaluations for a user
 * GET /api/evaluations/list?email=user@example.mil
 */
async function listEvaluationsHandler(req, res) {
  try {
    const rsEmail = req.query.email || req.session?.rsEmail;

    if (!rsEmail) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Optional: Ensure user can only list their own evaluations
    if (req.session?.rsEmail && req.session.rsEmail !== rsEmail) {
      return res.status(403).json({
        error: 'Cannot list evaluations for another user',
      });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await listEvaluationsSupabase(rsEmail, res);
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in listEvaluations:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * List evaluations from Supabase
 */
async function listEvaluationsSupabase(rsEmail, res) {
  try {
    const { data: evaluations, error } = await getEvaluationsByUser(rsEmail);

    if (error) {
      console.error('Error listing evaluations:', error);
      return res.status(500).json({ error: 'Failed to list evaluations' });
    }

    // Format for frontend compatibility
    const formatted = evaluations.map((eval) => ({
      evaluationId: eval.evaluation_id,
      marineName: eval.marine_name,
      marineRank: eval.marine_rank,
      occasion: eval.occasion,
      completedDate: eval.completed_date,
      fitrepAverage: eval.fitrep_average?.toString(),
      syncStatus: eval.sync_status,
      createdAt: eval.created_at,
      updatedAt: eval.updated_at,
    }));

    return res.json({
      evaluations: formatted,
      count: formatted.length,
      method: 'supabase',
    });
  } catch (err) {
    console.error('Error in listEvaluationsSupabase:', err);
    return res.status(500).json({ error: 'Failed to list evaluations' });
  }
}

// ============================================================================
// GET SINGLE EVALUATION
// ============================================================================

/**
 * Get a single evaluation with all traits
 * GET /api/evaluation/:evaluationId
 */
async function getEvaluationHandler(req, res) {
  try {
    const { evaluationId } = req.params;

    if (!evaluationId) {
      return res.status(400).json({ error: 'Evaluation ID required' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await getEvaluationSupabase(evaluationId, req, res);
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in getEvaluation:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get evaluation from Supabase
 */
async function getEvaluationSupabase(evaluationId, req, res) {
  try {
    const { data: evaluation, error } = await getEvaluationById(evaluationId);

    if (error) {
      console.error('Error getting evaluation:', error);
      return res.status(500).json({ error: 'Failed to get evaluation' });
    }

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    // Optional: Verify user owns this evaluation
    if (req.session?.rsEmail && req.session.rsEmail !== evaluation.rsEmail) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(evaluation);
  } catch (err) {
    console.error('Error in getEvaluationSupabase:', err);
    return res.status(500).json({ error: 'Failed to get evaluation' });
  }
}

// ============================================================================
// DELETE EVALUATION
// ============================================================================

/**
 * Delete an evaluation
 * DELETE /api/evaluation/:evaluationId
 */
async function deleteEvaluationHandler(req, res) {
  try {
    const { evaluationId } = req.params;

    if (!evaluationId) {
      return res.status(400).json({ error: 'Evaluation ID required' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await deleteEvaluationSupabase(evaluationId, req, res);
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
        hint: 'Set STORAGE_MODE=supabase and configure Supabase credentials',
      });
    }
  } catch (err) {
    console.error('Error in deleteEvaluation:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Delete evaluation from Supabase
 */
async function deleteEvaluationSupabase(evaluationId, req, res) {
  try {
    // First, verify user owns this evaluation
    const { data: evaluation } = await getEvaluationById(evaluationId);

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    if (req.session?.rsEmail && req.session.rsEmail !== evaluation.rsEmail) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete evaluation (traits will cascade delete)
    const { data: success, error } = await deleteEvaluation(evaluationId);

    if (error) {
      console.error('Error deleting evaluation:', error);
      return res.status(500).json({ error: 'Failed to delete evaluation' });
    }

    return res.json({
      ok: true,
      message: 'Evaluation deleted successfully',
    });
  } catch (err) {
    console.error('Error in deleteEvaluationSupabase:', err);
    return res.status(500).json({ error: 'Failed to delete evaluation' });
  }
}

// ============================================================================
// BULK OPERATIONS (Optional)
// ============================================================================

/**
 * Export all evaluations for a user (JSON format)
 * GET /api/evaluations/export?email=user@example.mil
 */
async function exportEvaluationsHandler(req, res) {
  try {
    const rsEmail = req.query.email || req.session?.rsEmail;

    if (!rsEmail) {
      return res.status(400).json({ error: 'Email required' });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      // Use optimized single-query function to avoid N+1 problem
      const { data: fullEvaluations, error } = await getFullEvaluationsByUser(rsEmail);

      if (error) {
        return res.status(500).json({ error: 'Failed to export evaluations' });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="evaluations-${rsEmail}-${Date.now()}.json"`
      );

      return res.json({
        exportedAt: new Date().toISOString(),
        userEmail: rsEmail,
        count: fullEvaluations.length,
        evaluations: fullEvaluations,
      });
    } else {
      return res.status(501).json({
        error: 'Legacy storage mode - use original endpoint',
      });
    }
  } catch (err) {
    console.error('Error in exportEvaluations:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  saveEvaluationHandler,
  listEvaluationsHandler,
  getEvaluationHandler,
  deleteEvaluationHandler,
  exportEvaluationsHandler,
};
