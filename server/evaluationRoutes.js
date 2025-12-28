/**
 * Evaluation Routes with Supabase Support
 *
 * This module provides fitness report evaluation management endpoints:
 * - POST /api/evaluation/save - Save/update an evaluation
 * - GET /api/evaluations/list - List all evaluations for a user
 * - GET /api/evaluation/:id - Get a single evaluation with traits
 * - DELETE /api/evaluation/:id - Delete an evaluation
 */

// Support node-fetch v3 in CommonJS via dynamic import wrapper
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const { getStorageMode, isSupabaseAvailable } = require('./supabaseClient');
const {
  saveEvaluation,
  getEvaluationsByUser,
  getFullEvaluationsByUser,
  getEvaluationById,
  deleteEvaluation,
} = require('./supabaseService');

// GitHub configuration for repository_dispatch
const DISPATCH_TOKEN = process.env.DISPATCH_TOKEN;
const MAIN_REPO = process.env.MAIN_REPO || 'SemperAdmin/Fitness-Report-Evaluator';

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
    let evaluationData = req.body;
    if (evaluationData && evaluationData.evaluation && evaluationData.userEmail) {
      const ev = evaluationData.evaluation || {};
      const userEmail = evaluationData.userEmail || '';
      evaluationData = {
        rsEmail: ev?.rsInfo?.email || userEmail,
        rsName: ev?.rsInfo?.name || '',
        rsRank: ev?.rsInfo?.rank || '',
        evaluationId: ev?.evaluationId,
        occasion: ev?.occasion,
        completedDate: ev?.completedDate,
        fitrepAverage: ev?.fitrepAverage,
        marineInfo: ev?.marineInfo || {},
        sectionIComments: ev?.sectionIComments || '',
        directedComments: ev?.directedComments || '',
        traitEvaluations: Array.isArray(ev?.traitEvaluations)
          ? ev.traitEvaluations
          : (ev?.traitEvaluations && typeof ev.traitEvaluations === 'object'
            ? Object.values(ev.traitEvaluations)
            : []),
        rsInfo: ev?.rsInfo || { email: userEmail, name: '', rank: '' },
        savedAt: ev?.savedAt || new Date().toISOString(),
        syncStatus: ev?.syncStatus || 'synced'
      };
    }

    // Validation
    if (!evaluationData || !evaluationData.evaluationId) {
      return res.status(400).json({ error: 'Missing evaluationId' });
    }

    if (!evaluationData.rsEmail) {
      return res.status(400).json({ error: 'Missing rsEmail' });
    }

    // Optional: Verify user owns this evaluation (based on session)
    const sessionEmail = req.session?.rsEmail || req.sessionUser || '';
    if (sessionEmail) {
      const s1 = String(sessionEmail || '').trim().toLowerCase();
      const r1 = String(evaluationData.rsEmail || '').trim().toLowerCase();
      const sKey = s1.includes('@') ? s1.split('@')[0] : s1;
      const rKey = r1.includes('@') ? r1.split('@')[0] : r1;
      if (sKey && rKey && sKey !== rKey) {
      return res.status(403).json({
        error: 'Cannot save evaluation for another user',
      });
    }
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

    const SUPABASE_ONLY = String(process.env.SUPABASE_ONLY || 'false').toLowerCase() === 'true';
    if (DISPATCH_TOKEN && !SUPABASE_ONLY) {
      try {
        // Destructure evaluation data for cleaner payload construction
        const {
          evaluationId,
          occasion,
          completedDate,
          fitrepAverage,
          marineInfo,
          rsName,
          rsEmail,
          rsRank,
          sectionIComments,
          directedComments,
          traitEvaluations,
        } = evaluationData;

        const payload = {
          event_type: 'save-evaluation',
          client_payload: {
            evaluation: {
              evaluationId,
              occasion,
              completedDate,
              fitrepAverage,
              marineInfo,
              rsInfo: {
                rsName,
                rsEmail,
                rsRank,
              },
              sectionIComments,
              directedComments,
              traitEvaluations,
            },
            createdBy: {
              name: rsName,
              email: rsEmail,
              rank: rsRank,
            },
          },
        };

        const resp = await fetch(`https://api.github.com/repos/${MAIN_REPO}/dispatches`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DISPATCH_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error('⚠ GitHub workflow dispatch failed:', text);
        }
      } catch (dispatchErr) {
        console.error('⚠ GitHub workflow dispatch error:', dispatchErr.message);
      }
    } else {
      // Supabase-only or no dispatch token; skip GitHub workflow
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
    let rsEmail = req.query.email || req.session?.rsEmail || req.sessionUser;
    const sessionEmail = req.session?.rsEmail || req.sessionUser;
    const s1 = String(sessionEmail || '').trim();
    let rEmail = String(rsEmail || '').trim();
    if (!rEmail) {
      return res.status(400).json({ error: 'Email required' });
    }
    if (!rEmail.includes('@') && s1.includes('@')) {
      rEmail = s1;
    }

    if (s1 && s1 !== rEmail && s1.split('@')[0] !== rEmail.split('@')[0]) {
      return res.status(403).json({
        error: 'Cannot list evaluations for another user',
      });
    }

    const storageMode = getStorageMode();

    if (storageMode === 'supabase' && isSupabaseAvailable()) {
      return await listEvaluationsSupabase(rEmail, res);
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
    const { data: fullEvaluations, error } = await getFullEvaluationsByUser(rsEmail);

    if (error) {
      console.error('Error listing evaluations:', error);
      return res.status(500).json({ error: 'Failed to list evaluations' });
    }

    // Return evaluation objects including traitEvaluations for grid rendering
    const formatted = (fullEvaluations || []).map((obj) => obj.evaluation);

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
    const sessionEmail = req.session?.rsEmail || req.sessionUser;
    if (
      sessionEmail &&
      String(sessionEmail).trim().toLowerCase() !== String(evaluation.rsEmail || '').trim().toLowerCase()
    ) {
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

    const sessionEmailDel = req.session?.rsEmail || req.sessionUser;
    if (
      sessionEmailDel &&
      String(sessionEmailDel).trim().toLowerCase() !== String(evaluation.rsEmail || '').trim().toLowerCase()
    ) {
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
