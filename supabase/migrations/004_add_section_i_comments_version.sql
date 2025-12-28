-- Migration: Add comments version tracking to evaluations
-- Description: Adds section_i_comments_version to track edits to evaluation comments
-- Date: 2025-12-26
BEGIN;

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS section_i_comments_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.evaluations.section_i_comments_version IS 'Version counter for Section I comments; increments on edit';

COMMIT;
