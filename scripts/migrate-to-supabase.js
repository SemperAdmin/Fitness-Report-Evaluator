// scripts/migrate-to-supabase.js

const { createClient } = require('@supabase/supabase-js');

// --- Configuration ---
// IMPORTANT: Replace with your actual Supabase URL and service_role key.
// It's best to load these from environment variables (.env file).
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY';

// Initialize the Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Sample Data (as requested in the prompt) ---
// In a real scenario, you would read these from your actual JSON files.
const shared_json_data = [
  {
    "accountId": "u1234",
    "email": "test@example.com",
    "createdAt": "2023-01-01T00:00:00Z",
    "rsName": "Test User",
    "rsRank": "Sgt",
    "passwordHash": "$2a$12$somehashedpasswordstring..."
  }
];

const app_json_data = [
  {
    "accountId": "u1234",
    "lastProjectName": "My First Project",
    "projectSettings": ["dark_mode", "autosave_on"]
  }
];

/**
 * Migrates data from local JSON structures to Supabase tables.
 */
async function migrateData() {
  console.log('Starting migration...');

  // 1. Migrate Accounts
  console.log('Migrating accounts...');
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .insert(
      shared_json_data.map(user => ({
        username: user.accountId,
        email: user.email,
        password_hash: user.passwordHash,
        name: user.rsName,
        rank: user.rsRank,
        created_at: user.createdAt
      }))
    )
    .select();

  if (accountError) {
    console.error('Error migrating accounts:', accountError.message);
    return;
  }
  console.log(`Successfully inserted ${accounts.length} accounts.`);

  const accountIdMap = new Map();
  accounts.forEach(acc => {
    accountIdMap.set(acc.username, acc.id);
  });

  // 2. Migrate App-Specific Data (Evaluations)
  console.log('Migrating app-specific data (evaluations)...');
  const evaluationsToInsert = app_json_data
    .map(appData => {
      const supabaseAccountId = accountIdMap.get(appData.accountId);
      if (!supabaseAccountId) {
        console.warn(`Could not find a matching account for accountId: ${appData.accountId}. Skipping.`);
        return null;
      }
      return {
        account_id: supabaseAccountId,
        evaluation_data: appData
      };
    })
    .filter(Boolean);

  if (evaluationsToInsert.length > 0) {
    const { error: evaluationError } = await supabase
      .from('evaluations')
      .insert(evaluationsToInsert);

    if (evaluationError) {
      console.error('Error migrating evaluations:', evaluationError.message);
      return;
    }
    console.log(`Successfully inserted ${evaluationsToInsert.length} evaluation records.`);
  } else {
    console.log('No new evaluations to insert.');
  }

  console.log('Migration complete!');
}

// Run the migration
migrateData().catch(console.error);
