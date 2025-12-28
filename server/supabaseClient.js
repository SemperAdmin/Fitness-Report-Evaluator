/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client for database operations.
 * It provides both admin (service role) and public (anon key) clients.
 *
 * Usage:
 *   const { supabase, supabaseAdmin } = require('./supabaseClient');
 *   const { data, error } = await supabase.from('users').select('*');
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Environment variables validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_USERS_TABLE = process.env.SUPABASE_USERS_TABLE || 'fit_users';
const SUPABASE_EVALUATIONS_TABLE = process.env.SUPABASE_EVALUATIONS_TABLE || 'evaluations';
const SUPABASE_TRAITS_TABLE = process.env.SUPABASE_TRAITS_TABLE || 'trait_evaluations';

// Check if Supabase is configured
const isSupabaseConfigured = !!(SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SECRET_KEY));

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  console.warn('   Falling back to legacy GitHub/local storage.');
}

/**
 * Public Supabase client (uses anon key with Row Level Security)
 * Use this for client-initiated requests where RLS policies apply
 */
const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, (SUPABASE_ANON_KEY || SUPABASE_SECRET_KEY), {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // Server-side, don't persist
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Admin Supabase client (uses service role key, bypasses RLS)
 * Use this for server-side operations that need elevated privileges
 * IMPORTANT: Never expose this client to the frontend!
 */
const supabaseAdmin = isSupabaseConfigured && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY)
  ? createClient(SUPABASE_URL, (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Get storage mode from environment
 * @returns {'supabase' | 'github' | 'local'} Current storage mode
 */
function getStorageMode() {
  const mode = process.env.STORAGE_MODE || 'supabase';

  if (mode === 'supabase' && !isSupabaseConfigured) {
    console.warn('⚠️  STORAGE_MODE=supabase but Supabase not configured. Using fallback.');
    return 'github'; // Fallback to existing GitHub storage
  }

  return mode;
}

/**
 * Check if Supabase is available and configured
 * @returns {boolean} True if Supabase is ready to use
 */
function isSupabaseAvailable() {
  return isSupabaseConfigured && supabase !== null;
}

/**
 * Get appropriate client based on admin privileges needed
 * @param {boolean} needsAdmin - Whether admin privileges are required
 * @returns {Object} Supabase client instance
 */
function getClient(needsAdmin = false) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  if (needsAdmin) {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing)');
    }
    return supabaseAdmin;
  }

  return supabase;
}

module.exports = {
  supabase,
  supabaseAdmin,
  getStorageMode,
  isSupabaseAvailable,
  isSupabaseConfigured,
  getClient,
  USERS_TABLE: SUPABASE_USERS_TABLE,
  EVALUATIONS_TABLE: SUPABASE_EVALUATIONS_TABLE,
  TRAITS_TABLE: SUPABASE_TRAITS_TABLE,
};
