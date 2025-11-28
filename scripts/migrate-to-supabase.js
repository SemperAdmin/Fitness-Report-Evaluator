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
};

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Local data paths
const LOCAL_USERS_DIR = path.join(__dirname, '../server/local-data/users');

// GitHub configuration
const GITHUB_DATA_REPO = process.env.DATA_REPO || 'SemperAdmin/Fitness-Report-Evaluator-Data';
const GITHUB_TOKEN = process.env.FITREP_DATA;
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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
    const dataFiles = files.filter((f) => f.endsWith('.json') || f.endsWith('.yaml'));

    log(`  Found ${dataFiles.length} evaluation files for ${rsEmail}`, 'verbose');

    const evaluations = [];
    for (const file of dataFiles) {
      try {
        const filePath = path.join(userEvalDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const evalData = JSON.parse(content);

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

/**
 * Load user JSON files from GitHub Data repository
 */
async function loadGitHubUsers() {
  if (!GITHUB_TOKEN) {
    log('GitHub token (FITREP_DATA) not configured', 'error');
    return [];
  }

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_DATA_REPO}/contents/users`;

    log(`Fetching user list from GitHub: ${GITHUB_DATA_REPO}/users`, 'verbose');

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const files = await response.json();
    const jsonFiles = files.filter((f) => f.type === 'file' && f.name.endsWith('.json'));

    log(`Found ${jsonFiles.length} user files in GitHub repo`, 'verbose');

    const users = [];
    for (const file of jsonFiles) {
      try {
        // Fetch file content
        const fileResponse = await fetch(file.url, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!fileResponse.ok) {
          log(`Error fetching ${file.name}: ${fileResponse.statusText}`, 'warn');
          continue;
        }

        const fileData = await fileResponse.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        const userData = JSON.parse(content);

        // Filter by specific user if specified
        if (options.specificUser && userData.rsEmail !== options.specificUser) {
          continue;
        }

        users.push({
          filename: file.name,
          data: userData,
        });
      } catch (err) {
        log(`Error reading ${file.name}: ${err.message}`, 'warn');
      }
    }

    return users;
  } catch (err) {
    log(`Error loading users from GitHub: ${err.message}`, 'error');
    return [];
  }
}

/**
 * Load evaluation files for a user from GitHub repository
 */
async function loadGitHubEvaluations(rsEmail) {
  if (!GITHUB_TOKEN) {
    return [];
  }

  try {
    const emailPrefix = rsEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const apiUrl = `https://api.github.com/repos/${GITHUB_DATA_REPO}/contents/users/${emailPrefix}/evaluations`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 404) {
      // No evaluations directory for this user
      return [];
    }

    if (!response.ok) {
      log(`  Error fetching evaluations for ${rsEmail}: ${response.statusText}`, 'warn');
      return [];
    }

    const files = await response.json();
    const dataFiles = files.filter((f) => f.type === 'file' && (f.name.endsWith('.json') || f.name.endsWith('.yaml')));

    log(`  Found ${dataFiles.length} evaluation files for ${rsEmail}`, 'verbose');

    const evaluations = [];
    for (const file of dataFiles) {
      try {
        const fileResponse = await fetch(file.url, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!fileResponse.ok) {
          log(`  Error fetching ${file.name}: ${fileResponse.statusText}`, 'warn');
          continue;
        }

        const fileData = await fileResponse.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        const evalData = JSON.parse(content);

        evaluations.push({
          filename: file.name,
          data: evalData,
        });
      } catch (err) {
        log(`  Error reading ${file.name}: ${err.message}`, 'warn');
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
    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id, rs_email')
      .eq('rs_email', rsEmail)
      .single();

    if (existing) {
      log(`  User already exists: ${rsEmail}`, 'verbose');
      stats.usersSkipped++;
      return existing;
    }

    // Insert new user
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          rs_email: rsEmail,
          rs_name: rsName,
          rs_rank: rsRank,
          password_hash: passwordHash,
          created_date: createdDate || new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      log(`  Error creating user ${rsEmail}: ${error.message}`, 'error');
      stats.usersErrored++;
      stats.errors.push({ type: 'user', email: rsEmail, error: error.message });
      return null;
    }

    log(`  ✅ Created user: ${rsEmail}`, 'success');
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
    if (evaluation.traitEvaluations) {
      stats.traitsCreated += evaluation.traitEvaluations.length;
    }
    return;
  }

  try {
    // Check if evaluation already exists
    const { data: existing } = await supabase
      .from('evaluations')
      .select('id')
      .eq('evaluation_id', evaluation.evaluationId)
      .single();

    if (existing) {
      log(`    Evaluation already exists: ${evaluation.evaluationId}`, 'verbose');
      stats.evaluationsSkipped++;
      return;
    }

    // Prepare evaluation record
    const evalRecord = {
      user_id: userId,
      evaluation_id: evaluation.evaluationId,
      version: evalData.version || '1.0',
      occasion: evaluation.occasion,
      completed_date: evaluation.completedDate,
      fitrep_average: evaluation.fitrepAverage
        ? parseFloat(evaluation.fitrepAverage)
        : null,
      marine_name: evaluation.marineInfo?.name,
      marine_rank: evaluation.marineInfo?.rank,
      evaluation_period_from: evaluation.marineInfo?.evaluationPeriod?.from,
      evaluation_period_to: evaluation.marineInfo?.evaluationPeriod?.to,
      rs_name: evaluation.rsInfo?.name || evalData.rsName,
      rs_email: evaluation.rsInfo?.email || evalData.rsEmail,
      rs_rank: evaluation.rsInfo?.rank || evalData.rsRank,
      section_i_comments: evaluation.sectionIComments,
      sync_status: evaluation.syncStatus || 'synced',
      saved_at: evalData.savedAt || new Date().toISOString(),
    };

    // Insert evaluation
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

    // Migrate trait evaluations
    if (evaluation.traitEvaluations && evaluation.traitEvaluations.length > 0) {
      const traits = evaluation.traitEvaluations.map((trait) => ({
        evaluation_id: savedEval.id,
        section: trait.section,
        trait: trait.trait,
        grade: trait.grade,
        grade_number: trait.gradeNumber,
      }));

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

    log(`    ✅ Created evaluation: ${evaluation.evaluationId}`, 'success');
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
  if (options.specificUser) {
    log(`Specific User: ${options.specificUser}`, 'info');
  }
  console.log('');

  try {
    // Load users based on source
    let users = [];
    let loadEvaluationsFunc;

    if (options.source === 'local') {
      users = await loadLocalUsers();
      loadEvaluationsFunc = loadLocalEvaluations;
    } else if (options.source === 'github') {
      users = await loadGitHubUsers();
      loadEvaluationsFunc = loadGitHubEvaluations;
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
      const evaluations = await loadEvaluationsFunc(userFile.data.rsEmail);

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
// RUN MIGRATION
// ============================================================================

migrate().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
