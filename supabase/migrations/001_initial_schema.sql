-- Migration: Initial Schema for USMC Fitness Report Evaluator
-- Description: Creates tables for users, evaluations, and trait evaluations
-- Date: 2025-11-27

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
-- 1. FIT_USERS TABLE
-- Stores Reporting Senior (RS) user accounts for Fitness Report Evaluator
CREATE TABLE IF NOT EXISTS fit_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rs_email TEXT UNIQUE NOT NULL,
  rs_name TEXT NOT NULL,
  rs_rank TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT users_email_check CHECK (rs_email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- Index for fast email lookups (login)
CREATE INDEX idx_users_email ON fit_users(rs_email);

-- Index for filtering by rank
CREATE INDEX idx_users_rank ON fit_users(rs_rank);

-- ============================================================================
-- 2. EVALUATIONS TABLE
-- ============================================================================
-- Stores fitness report evaluations for Marines
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fit_users(id) ON DELETE CASCADE,

  -- Evaluation Identifiers
  evaluation_id TEXT UNIQUE NOT NULL,
  version TEXT DEFAULT '1.0',

  -- Evaluation Metadata
  occasion TEXT,
  completed_date DATE,
  fitrep_average NUMERIC(3,1), -- e.g., 5.8

  -- Marine Information
  marine_name TEXT NOT NULL,
  marine_rank TEXT NOT NULL,
  evaluation_period_from DATE,
  evaluation_period_to DATE,

  -- Reporting Senior Information (denormalized for report generation)
  rs_name TEXT NOT NULL,
  rs_email TEXT NOT NULL,
  rs_rank TEXT NOT NULL,

  -- Comments and Status
  section_i_comments TEXT,
  section_i_comments_version INTEGER NOT NULL DEFAULT 1,
  directed_comments TEXT,
  directed_comments_version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT DEFAULT 'synced',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT evaluations_fitrep_avg_check CHECK (fitrep_average >= 1.0 AND fitrep_average <= 7.0),
  CONSTRAINT evaluations_period_check CHECK (evaluation_period_from <= evaluation_period_to)
);

-- Indexes for performance
CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_evaluations_evaluation_id ON evaluations(evaluation_id);
CREATE INDEX idx_evaluations_completed_date ON evaluations(completed_date DESC);
CREATE INDEX idx_evaluations_marine_name ON evaluations(marine_name);

-- ============================================================================
-- 3. TRAIT EVALUATIONS TABLE
-- ============================================================================
-- Stores individual trait grades for each evaluation
-- MCO 1610.7B defines 14 traits across 5 sections
CREATE TABLE IF NOT EXISTS trait_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,

  -- Trait Information
  section TEXT NOT NULL, -- A, B, C, D, E
  trait TEXT NOT NULL,
  grade TEXT NOT NULL, -- A, B, C, D, E, F, G
  grade_number INTEGER NOT NULL, -- 1-7 (1=A, 7=G)

  -- Constraints
  CONSTRAINT trait_section_check CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
  CONSTRAINT trait_grade_check CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  CONSTRAINT trait_grade_number_check CHECK (grade_number >= 1 AND grade_number <= 7),

  -- Ensure each trait appears only once per evaluation
  CONSTRAINT trait_unique_per_eval UNIQUE (evaluation_id, section, trait)
);

-- Index for fast lookups by evaluation
CREATE INDEX idx_trait_evaluations_evaluation_id ON trait_evaluations(evaluation_id);
CREATE INDEX idx_trait_evaluations_section ON trait_evaluations(section);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE fit_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trait_evaluations ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY users_select_own ON fit_users
  FOR SELECT
  USING (auth.uid()::text = id::text OR rs_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY users_update_own ON fit_users
  FOR UPDATE
  USING (auth.uid()::text = id::text OR rs_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Users can only access their own evaluations
CREATE POLICY evaluations_select_own ON evaluations
  FOR SELECT
  USING (user_id IN (SELECT id FROM fit_users WHERE auth.uid()::text = id::text));

CREATE POLICY evaluations_insert_own ON evaluations
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM fit_users WHERE auth.uid()::text = id::text));

CREATE POLICY evaluations_update_own ON evaluations
  FOR UPDATE
  USING (user_id IN (SELECT id FROM fit_users WHERE auth.uid()::text = id::text));

CREATE POLICY evaluations_delete_own ON evaluations
  FOR DELETE
  USING (user_id IN (SELECT id FROM fit_users WHERE auth.uid()::text = id::text));

-- Trait evaluations inherit access from parent evaluation
CREATE POLICY trait_evaluations_select_own ON trait_evaluations
  FOR SELECT
  USING (evaluation_id IN (
    SELECT e.id FROM evaluations e
    INNER JOIN fit_users u ON e.user_id = u.id
    WHERE auth.uid()::text = u.id::text
  ));

CREATE POLICY trait_evaluations_insert_own ON trait_evaluations
  FOR INSERT
  WITH CHECK (evaluation_id IN (
    SELECT e.id FROM evaluations e
    INNER JOIN fit_users u ON e.user_id = u.id
    WHERE auth.uid()::text = u.id::text
  ));

CREATE POLICY trait_evaluations_update_own ON trait_evaluations
  FOR UPDATE
  USING (evaluation_id IN (
    SELECT e.id FROM evaluations e
    INNER JOIN fit_users u ON e.user_id = u.id
    WHERE auth.uid()::text = u.id::text
  ));

CREATE POLICY trait_evaluations_delete_own ON trait_evaluations
  FOR DELETE
  USING (evaluation_id IN (
    SELECT e.id FROM evaluations e
    INNER JOIN fit_users u ON e.user_id = u.id
    WHERE auth.uid()::text = u.id::text
  ));

-- ============================================================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for evaluations table
CREATE TRIGGER update_evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for fit_users table
CREATE TRIGGER update_fit_users_last_updated
  BEFORE UPDATE ON fit_users
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated_column();

-- ============================================================================
-- 6. HELPER VIEWS
-- ============================================================================

-- View: Recent evaluations with Marine and RS info
CREATE OR REPLACE VIEW recent_evaluations AS
SELECT
  e.id,
  e.evaluation_id,
  e.marine_name,
  e.marine_rank,
  e.occasion,
  e.completed_date,
  e.fitrep_average,
  e.rs_name,
  e.rs_rank,
  e.sync_status,
  e.created_at,
  e.updated_at,
  u.rs_email,
  COUNT(t.id) as trait_count
FROM evaluations e
INNER JOIN fit_users u ON e.user_id = u.id
LEFT JOIN trait_evaluations t ON e.id = t.evaluation_id
GROUP BY e.id, e.evaluation_id, e.marine_name, e.marine_rank, e.occasion,
         e.completed_date, e.fitrep_average, e.rs_name, e.rs_rank,
         e.sync_status, e.created_at, e.updated_at, u.rs_email
ORDER BY e.completed_date DESC NULLS LAST, e.created_at DESC;

-- Function to get full evaluation with traits
CREATE OR REPLACE FUNCTION get_evaluation_with_traits(eval_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'evaluation', row_to_json(e.*),
    'traits', COALESCE(json_agg(row_to_json(t.*)), '[]'::json)
  ) INTO result
  FROM evaluations e
  LEFT JOIN trait_evaluations t ON e.id = t.evaluation_id
  WHERE e.id = eval_id
  GROUP BY e.id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. SEED DATA (Optional - for testing)
-- ============================================================================
-- Uncomment to add test data

/*
-- Test user
INSERT INTO users (rs_email, rs_name, rs_rank, password_hash)
VALUES (
  'test.user@example.mil',
  'Test User',
  'Capt',
  '$2a$12$WAGOukvnoWN6dUn1vUV.WeRGvom4rSI8BcTzeSduX/CDLsRbcOOYC'
) ON CONFLICT (rs_email) DO NOTHING;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
--   1. users - Reporting Senior accounts
--   2. evaluations - Fitness report evaluations
--   3. trait_evaluations - Individual trait grades
--
-- Security:
--   - Row Level Security (RLS) enabled
--   - Users can only access their own data
--
-- Triggers:
--   - Auto-update timestamps on modification
--
-- Next Steps:
--   1. Run this migration in Supabase Dashboard or via CLI
--   2. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env
--   3. Install @supabase/supabase-js: npm install @supabase/supabase-js
--   4. Run data migration script to import existing JSON data
-- ============================================================================
