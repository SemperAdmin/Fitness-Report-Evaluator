#!/usr/bin/env node

/**
 * Data Migration Script: JSON Files → Supabase
 *
 * This script migrates existing user and evaluation data from JSON files
 * (local or GitHub) to Supabase PostgreSQL database.
 *
 * Usage:
 *   node scripts/migrate-to-supabase.js [options]
 *
 * Options:
 *   --source=local         Migrate from local JSON files (default)
 *   --source=github        Migrate from GitHub Data repository
 *   --dry-run              Preview migration without writing to database
 *   --users-only           Migrate only user profiles (no evaluations)
 *   --user=<email>         Migrate specific user only
 *   --verbose              Show detailed logging
 *
 * Examples:
 *   node scripts/migrate-to-supabase.js --dry-run
 *   node scripts/migrate-to-supabase.js --source=local --verbose
 *   node scripts/migrate-to-supabase.js --user=test.user@example.mil
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const yaml = require('js-yaml');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const args = process.argv.slice(2);
const options = {
  source: getArg('source', 'local'),
  dryRun: hasArg('dry-run'),
  usersOnly: hasArg('users-only'),
  specificUser: getArg('user'),
  verbose: hasArg('verbose'),
  purge: hasArg('purge'),
  localDir: getArg('local-dir'),
};

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USERS_TABLE = process.env.SUPABASE_USERS_TABLE || 'fit_users';
const EVALUATIONS_TABLE = process.env.SUPABASE_EVALUATIONS_TABLE || 'evaluations';
const TRAITS_TABLE = process.env.SUPABASE_TRAITS_TABLE || 'trait_evaluations';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Local data paths
const LOCAL_USERS_DIR = options.localDir
  ? path.resolve(options.localDir)
  : path.join(__dirname, '../server/local-data/users');

// Statistics
const stats = {
  usersProcessed: 0,
  usersCreated: 0,
  usersSkipped: 0,
  usersErrored: 0,
  evaluationsProcessed: 0,
  evaluationsCreated: 0,
  evaluationsSkipped: 0,
  evaluationsErrored: 0,
  traitsCreated: 0,
  errors: [],
};

let HAS_DIRECTED = true;
let HAS_SEC_I_VERSION = true;
let HAS_DIRECTED_VERSION = true;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getArg(name, defaultValue = null) {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
}

function hasArg(name) {
  return args.includes(`--${name}`);
}

function log(message, level = 'info') {
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    warn: '⚠️ ',
    error: '❌',
    verbose: '  ',
  }[level];

  if (level === 'verbose' && !options.verbose) return;

  console.log(`${prefix} ${message}`);
}

/**
 * Normalize a username or email into an auth-compatible email.
 * If the input already looks like an email, return it as-is.
 * Otherwise, append "@local.dev".
 */
function toAuthEmail(u) {
  const s = String(u || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(s) ? s : `${s}@local.dev`;
}

/**
 * Checks for known non-date status strings (like "pending", "local-only")
 * and converts them to null for safe database insertion into TIMESTAMPTZ columns.
 * @param {string} value - The date string candidate.
 * @returns {string|null} - The original value or null if it was a status string.
 */
function sanitizeDate(value) {
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'pending' || lowerValue === 'local-only' || value.trim() === '') {
      return null;
    }
  }
  return value;
}

async function columnExists(table, column) {
  try {
    const { error } = await supabase.from(table).select(column).limit(1);
    if (error) return false;
    return true;
  } catch (_) {
    return false;
  }
}

async function initSchemaFlags() {
  HAS_DIRECTED = await columnExists('evaluations', 'directed_comments');
  HAS_SEC_I_VERSION = await columnExists('evaluations', 'section_i_comments_version');
  HAS_DIRECTED_VERSION = await columnExists('evaluations', 'directed_comments_version');
}


// ============================================================================
// DATA LOADING FUNCTIONS
// ============================================================================

/**
 * Load user JSON files from local filesystem
 */
async function loadLocalUsers() {
  try {
    const files = await fs.readdir(LOCAL_USERS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    log(`Found ${jsonFiles.length} user files in ${LOCAL_USERS_DIR}`, 'verbose');

    const users = [];
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(LOCAL_USERS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const userData = JSON.parse(content);

        // Filter by specific user if specified
        if (options.specificUser && userData.rsEmail !== options.specificUser) {
          continue;
        }

        users.push({
          filename: file,
          data: userData,
        });
      } catch (err) {
        log(`Error reading ${file}: ${err.message}`, 'warn');
      }
    }

    return users;
  } catch (err) {
    if (err.code === 'ENOENT') {
      log(`Local users directory not found: ${LOCAL_USERS_DIR}`, 'warn');
      return [];
    }
    throw err;
  }
}

/**
 * Load evaluation files for a user from local filesystem
 */
async function loadLocalEvaluations(rsEmail) {
  const emailPrefix = rsEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const userEvalDir = path.join(LOCAL_USERS_DIR, emailPrefix, 'evaluations');

  try {
    await fs.access(userEvalDir);
  } catch {
    // No evaluations directory
    return [];
  }

  try {
    const files = await fs.readdir(userEvalDir);
    const dataFiles = files.filter((f) => {
      const lower = f.toLowerCase();
      return lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml');
    });

    log(`  Found ${dataFiles.length} evaluation files for ${rsEmail}`, 'verbose');

    const evaluations = [];
    for (const file of dataFiles) {
      try {
        const filePath = path.join(userEvalDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lower = file.toLowerCase();
        let evalData;
        if (lower.endsWith('.json')) {
          evalData = JSON.parse(content);
        } else {
          evalData = yaml.load(content);
        }

        evaluations.push({
          filename: file,
          data: evalData,
        });
      } catch (err) {
        log(`  Error reading ${file}: ${err.message}`, 'warn');
      }
    }

    return evaluations;
  } catch (err) {
    log(`  Error loading evaluations for ${rsEmail}: ${err.message}`, 'warn');
    return [];
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate a single user to Supabase
 */
async function migrateUser(userData) {
  stats.usersProcessed++;

  const { rsEmail, rsName, rsRank, passwordHash, createdDate } = userData;

  if (!rsEmail || !rsName || !rsRank || !passwordHash) {
    log(`Skipping invalid user data: ${JSON.stringify(userData)}`, 'warn');
    stats.usersSkipped++;
    return null;
  }

  log(`Migrating user: ${rsEmail}`, 'info');

  if (options.dryRun) {
    log(`  [DRY RUN] Would create user: ${rsName} (${rsRank})`, 'verbose');
    stats.usersCreated++;
    return { id: 'dry-run-id', rs_email: rsEmail };
  }

  try {
    const authEmail = toAuthEmail(rsEmail);
    // Check if user already exists
    const { data: existing } = await supabase
      .from(USERS_TABLE)
      .select('id, rs_email')
      .eq('rs_email', authEmail)
      .single();

    if (existing) {
      log(`  User already exists: ${authEmail}`, 'verbose');
      stats.usersSkipped++;
      return existing;
    }
    // Fallback: resolve by username if rs_email lookup did not find a row
    let existingByUsername = null;
    try {
      const { data: rows } = await supabase
        .from(USERS_TABLE)
        .select('id, rs_email, username')
        .ilike('username', rsEmail)
        .limit(1);
      existingByUsername = Array.isArray(rows) ? rows[0] : rows;
    } catch (_) {}
    if (existingByUsername && existingByUsername.id) {
      log(`  User already exists by username: ${rsEmail}`, 'verbose');
      stats.usersSkipped++;
      return { id: existingByUsername.id, rs_email: existingByUsername.rs_email };
    }

    // Insert new user
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .insert([
        {
          rs_email: authEmail,
          rs_name: rsName,
          rs_rank: rsRank,
          password_hash: passwordHash,
          created_date: createdDate || new Date().toISOString(),
          last_updated: new Date().toISOString(),
          username: rsEmail
        },
      ])
      .select()
      .single();

    if (error) {
      // If insert failed due to uniqueness, resolve and return existing row
      if (/duplicate key value/i.test(error.message || '')) {
        let resolved = null;
        try {
          const { data: ex1 } = await supabase
            .from(USERS_TABLE)
            .select('id, rs_email')
            .eq('rs_email', authEmail)
            .single();
          resolved = ex1 || null;
        } catch (_) {}
        if (!resolved) {
          try {
            const { data: rows } = await supabase
              .from(USERS_TABLE)
              .select('id, rs_email, username')
              .ilike('username', rsEmail)
              .limit(1);
            resolved = Array.isArray(rows) ? rows[0] : rows;
          } catch (_) {}
        }
        if (resolved && resolved.id) {
          log(`  User exists; using existing: ${resolved.rs_email || authEmail}`, 'verbose');
          stats.usersSkipped++;
          return { id: resolved.id, rs_email: resolved.rs_email || authEmail };
        }
        log(`  Error creating user ${authEmail}: ${error.message}`, 'error');
        stats.usersErrored++;
        stats.errors.push({ type: 'user', email: authEmail, error: error.message });
        return null;
      } else {
        log(`  Error creating user ${authEmail}: ${error.message}`, 'error');
        stats.usersErrored++;
        stats.errors.push({ type: 'user', email: authEmail, error: error.message });
        return null;
      }
    }

    log(`  ✅ Created user: ${authEmail}`, 'success');
    stats.usersCreated++;
    return data;
  } catch (err) {
    log(`  Error migrating user ${rsEmail}: ${err.message}`, 'error');
    stats.usersErrored++;
    stats.errors.push({ type: 'user', email: rsEmail, error: err.message });
    return null;
  }
}

/**
 * Migrate a single evaluation to Supabase
 */
async function migrateEvaluation(evalData, userId) {
  stats.evaluationsProcessed++;

  const evaluation = evalData.evaluation || evalData;

  if (!evaluation.evaluationId) {
    log(`  Skipping evaluation without ID`, 'warn');
    stats.evaluationsSkipped++;
    return;
  }

  log(`  Migrating evaluation: ${evaluation.evaluationId}`, 'verbose');

  if (options.dryRun) {
    log(`    [DRY RUN] Would create evaluation for ${evaluation.marineInfo?.name}`, 'verbose');
    stats.evaluationsCreated++;
    if (Array.isArray(evaluation.traitEvaluations)) {
      stats.traitsCreated += evaluation.traitEvaluations.length;
    }
    return;
  }

  try {
    // Check if evaluation already exists
    const { data: existing } = await supabase
      .from('evaluations')
      .select('id, section_i_comments, section_i_comments_version, directed_comments, directed_comments_version')
      .eq('evaluation_id', evaluation.evaluationId)
      .single();

    let savedEvalId = existing ? existing.id : null;
    if (existing) {
      log(`    Evaluation already exists: ${evaluation.evaluationId}`, 'verbose');
    }

    // Prepare evaluation record
    const evalRecord = {
      user_id: userId,
      evaluation_id: evaluation.evaluationId,
      version: evalData.version || '1.0',
      occasion: evaluation.occasion,
      completed_date: sanitizeDate(evaluation.completedDate),
      fitrep_average: evaluation.fitrepAverage
        ? parseFloat(evaluation.fitrepAverage)
        : null,
      marine_name: evaluation.marineInfo?.name,
      marine_rank: evaluation.marineInfo?.rank,
      evaluation_period_from: sanitizeDate(evaluation.marineInfo?.evaluationPeriod?.from), // UPDATED
      evaluation_period_to: sanitizeDate(evaluation.marineInfo?.evaluationPeriod?.to),     // UPDATED
      rs_name: evaluation.rsInfo?.name || evalData.rsName,
      rs_email: toAuthEmail(evaluation.rsInfo?.email || evalData.rsEmail),
      rs_rank: evaluation.rsInfo?.rank || evalData.rsRank,
      section_i_comments: evaluation.sectionIComments,
      ...(HAS_DIRECTED ? { directed_comments: evaluation.directedComments } : {}),
      sync_status: evalData.syncStatus || 'synced',
      saved_at: sanitizeDate(evalData.savedAt || new Date().toISOString()),               // UPDATED
    };

    if (!savedEvalId) {
      if (HAS_SEC_I_VERSION) evalRecord.section_i_comments_version = 1;
      if (HAS_DIRECTED_VERSION) evalRecord.directed_comments_version = 1;
      const { data: savedEval, error: evalError } = await supabase
        .from('evaluations')
        .insert([evalRecord])
        .select()
        .single();

      if (evalError) {
        log(`    Error creating evaluation: ${evalError.message}`, 'error');
        stats.evaluationsErrored++;
        stats.errors.push({
          type: 'evaluation',
          id: evaluation.evaluationId,
          error: evalError.message,
        });
        return;
      }

      stats.evaluationsCreated++;
      savedEvalId = savedEval.id;
    } else {
      if (HAS_SEC_I_VERSION) {
        const prevComments = existing.section_i_comments || '';
        const newComments = evaluation.sectionIComments || '';
        const prevVer = Number(existing.section_i_comments_version || 1);
        const nextVer = prevVer + (newComments !== prevComments ? 1 : 0);
        evalRecord.section_i_comments_version = nextVer;
      }
      if (HAS_DIRECTED_VERSION && HAS_DIRECTED) {
        const prevDirected = existing.directed_comments || '';
        const newDirected = evaluation.directedComments || '';
        const prevDirectedVer = Number(existing.directed_comments_version || 1);
        const nextDirectedVer = prevDirectedVer + (newDirected !== prevDirected ? 1 : 0);
        evalRecord.directed_comments_version = nextDirectedVer;
      }
      const { error: updateError } = await supabase
        .from('evaluations')
        .update(evalRecord)
        .eq('id', savedEvalId);
      if (updateError) {
        log(`    Error updating evaluation: ${updateError.message}`, 'error');
        stats.evaluationsErrored++;
        stats.errors.push({
          type: 'evaluation',
          id: evaluation.evaluationId,
          error: updateError.message,
        });
        return;
      }
    }

    // Migrate trait evaluations
    if (Array.isArray(evaluation.traitEvaluations) && evaluation.traitEvaluations.length > 0) {
      const sectionMap = {
        'Mission Accomplishment': 'A',
        'Leadership': 'B',
        'Individual Character': 'C',
        'Intellect and Wisdom': 'D',
        'Fulfillment of Evaluation Responsibilities': 'E',
      };
      const traits = evaluation.traitEvaluations.map((trait) => {
        const sect = trait.section;
        const normalizedSection = typeof sect === 'string'
          ? (sectionMap[sect] || sect)
          : sect;
        return {
          evaluation_id: savedEvalId,
          section: normalizedSection,
          trait: trait.trait,
          grade: trait.grade,
          grade_number: trait.gradeNumber,
          justification: trait.justification || null,
        };
      });

      // Replace any existing traits for this evaluation id
      await supabase
        .from('trait_evaluations')
        .delete()
        .eq('evaluation_id', savedEvalId);

      const { error: traitError } = await supabase
        .from('trait_evaluations')
        .insert(traits);

      if (traitError) {
        log(`    Error creating traits: ${traitError.message}`, 'error');
        stats.errors.push({
          type: 'traits',
          evaluationId: evaluation.evaluationId,
          error: traitError.message,
        });
      } else {
        stats.traitsCreated += traits.length;
        log(`    ✅ Created ${traits.length} trait evaluations`, 'verbose');
      }
    }

    log(`    ✅ Ensured evaluation: ${evaluation.evaluationId}`, 'success');
  } catch (err) {
    log(`    Error migrating evaluation: ${err.message}`, 'error');
    stats.evaluationsErrored++;
    stats.errors.push({
      type: 'evaluation',
      id: evaluation.evaluationId,
      error: err.message,
    });
  }
}

// ============================================================================
// MAIN MIGRATION LOGIC
// ============================================================================

async function migrate() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 USMC FITREP EVALUATOR - Data Migration to Supabase');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  log(`Source: ${options.source}`, 'info');
  log(`Dry Run: ${options.dryRun ? 'Yes' : 'No'}`, 'info');
  log(`Users Only: ${options.usersOnly ? 'Yes' : 'No'}`, 'info');
  log(`Local Dir: ${LOCAL_USERS_DIR}`, 'info');
  if (options.specificUser) {
    log(`Specific User: ${options.specificUser}`, 'info');
  }
  console.log('');

  try {
    await initSchemaFlags();
    if (options.purge && !options.dryRun) {
      await purgeAllData();
      console.log('');
    } else if (options.purge && options.dryRun) {
      log('DRY RUN: Would purge all existing data from Supabase tables', 'warn');
      console.log('');
    }

    // Load users based on source
    let users = [];
    if (options.source === 'local') {
      users = await loadLocalUsers();
    } else if (options.source === 'github') {
      log('GitHub source not yet implemented. Use --source=local', 'error');
      process.exit(1);
    } else {
      log(`Unknown source: ${options.source}`, 'error');
      process.exit(1);
    }

    if (users.length === 0) {
      log('No users found to migrate', 'warn');
      return;
    }

    log(`Found ${users.length} user(s) to migrate\n`, 'info');

    // Migrate each user
    for (const userFile of users) {
      const migratedUser = await migrateUser(userFile.data);

      if (!migratedUser || options.usersOnly) {
        continue;
      }

      // Load and migrate evaluations for this user
      const evaluations = await loadLocalEvaluations(userFile.data.rsEmail);

      if (evaluations.length > 0) {
        log(`  Found ${evaluations.length} evaluations`, 'info');

        for (const evalFile of evaluations) {
          await migrateEvaluation(evalFile.data, migratedUser.id);
        }
      }

      console.log(''); // Blank line between users
    }

    // Print summary
    printSummary();
  } catch (err) {
    log(`Fatal error during migration: ${err.message}`, 'error');
    console.error(err);
    process.exit(1);
  }
}

function printSummary() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 Migration Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Users:`);
  console.log(`  Processed: ${stats.usersProcessed}`);
  console.log(`  Created:   ${stats.usersCreated}`);
  console.log(`  Skipped:   ${stats.usersSkipped}`);
  console.log(`  Errors:    ${stats.usersErrored}`);
  console.log('');

  if (!options.usersOnly) {
    console.log(`Evaluations:`);
    console.log(`  Processed: ${stats.evaluationsProcessed}`);
    console.log(`  Created:   ${stats.evaluationsCreated}`);
    console.log(`  Skipped:   ${stats.evaluationsSkipped}`);
    console.log(`  Errors:    ${stats.evaluationsErrored}`);
    console.log('');

    console.log(`Trait Evaluations:`);
    console.log(`  Created:   ${stats.traitsCreated}`);
    console.log('');
  }

  if (stats.errors.length > 0) {
    console.log(`❌ Errors (${stats.errors.length}):`);
    stats.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.type}] ${err.email || err.id}: ${err.error}`);
    });
    console.log('');
  }

  if (options.dryRun) {
    console.log('⚠️  DRY RUN - No data was written to the database');
  } else {
    console.log('✅ Migration complete!');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// PURGE EXISTING DATA
// ============================================================================

async function fetchAllIds(table, column = 'id', pageSize = 1000) {
  const ids = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(column).range(from, to);
    if (error) {
      throw new Error(`Error fetching ids from ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    ids.push(...data.map((r) => r[column]));
    hasMore = data.length >= pageSize;
    from += pageSize;
  }
  return ids;
}

async function purgeAllData() {
  log('⚠️  Purging existing data from Supabase (users, evaluations, traits)', 'warn');
  try {
    const userIds = await fetchAllIds(USERS_TABLE, 'id');
    if (userIds.length === 0) {
      log('No users found to purge', 'info');
      return;
    }
    const chunkSize = 1000;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const { error } = await supabase.from(USERS_TABLE).delete().in('id', chunk);
      if (error) {
        throw new Error(`Error deleting users: ${error.message}`);
      }
      log(`Deleted ${chunk.length} user(s) (cascade removed evaluations and traits)`, 'verbose');
    }
    log('✅ Purge complete', 'success');
  } catch (err) {
    log(`Error during purge: ${err.message}`, 'error');
    throw err;
  }
}

// ============================================================================
// RUN MIGRATION
// ============================================================================

migrate().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
