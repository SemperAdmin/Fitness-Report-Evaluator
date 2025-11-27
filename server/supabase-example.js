// server/supabase-example.js

const { createClient } = require('@supabase/supabase-js');

// --- Configuration ---
// IMPORTANT: Replace with your actual Supabase URL and anon key.
// In a real application, these should be loaded securely from environment variables.
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Initialize the Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * --- Converted Function (Corrected) ---
 *
 * This function demonstrates how to update the app-specific settings for a user.
 * It replicates the logic of the original `updateAppSetting` function by
 * fetching a user's evaluation data, modifying a JSONB field, and saving it back.
 *
 * @param {string} username - The username (formerly accountId) of the user.
 * @param {string} newSetting - The new setting to add to the 'projectSettings' array.
 * @returns {Promise<object>} The updated evaluation object from Supabase.
 */
async function updateAppSettingInSupabase(username, newSetting) {
  if (!username) {
    throw new Error('Username is required.');
  }
  if (!newSetting) {
    throw new Error('New setting is required.');
  }

  // 1. Get the account ID from the username
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('username', username)
    .single();

  if (accountError) {
    console.error(`Error fetching account for username '${username}':`, accountError.message);
    throw new Error(`Account with username '${username}' not found.`);
  }

  const accountId = account.id;

  // 2. Fetch the latest evaluation record for that account
  // For this example, we'll just get the first one we find.
  const { data: currentEvaluation, error: fetchError } = await supabase
    .from('evaluations')
    .select('id, evaluation_data')
    .eq('account_id', accountId)
    .limit(1)
    .single();

  if (fetchError) {
    console.error(`Error fetching evaluation for account ID '${accountId}':`, fetchError.message);
    throw new Error('Could not find existing evaluation data for this user.');
  }

  // 3. Modify the projectSettings array in the JSONB data
  const updatedEvaluationData = { ...currentEvaluation.evaluation_data };
  if (!updatedEvaluationData.projectSettings) {
    updatedEvaluationData.projectSettings = [];
  }
  updatedEvaluationData.projectSettings.push(newSetting);

  // 4. Update the record in the 'evaluations' table with the modified data
  const { data: updatedEvaluation, error: updateError } = await supabase
    .from('evaluations')
    .update({ evaluation_data: updatedEvaluationData })
    .eq('id', currentEvaluation.id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating evaluation in Supabase:', updateError.message);
    throw updateError;
  }

  console.log(`Successfully added setting for user: ${username}`);
  return updatedEvaluation;
}

// --- Example Usage ---
async function main() {
  const testUsername = 'u1234';
  const newSettingToAdd = 'notifications_on';

  try {
    console.log(`--- Attempting to add setting '${newSettingToAdd}' for user '${testUsername}'... ---`);
    const result = await updateAppSettingInSupabase(testUsername, newSettingToAdd);
    console.log('--- Example Result ---');
    console.log('Updated evaluation data:', result.evaluation_data);
    console.log('Full updated record:', result);
  } catch (err) {
    console.error('\n--- Example Failed ---');
    console.error('The example usage failed. This is expected if you have not configured your Supabase credentials or if the user/evaluation does not exist in the database.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateAppSettingInSupabase };
