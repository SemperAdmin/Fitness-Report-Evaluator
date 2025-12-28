-- Migration: Add justification text to trait_evaluations
-- Description: Stores RS-provided text evidence/justification per trait
-- Date: 2025-12-26

ALTER TABLE public.trait_evaluations
  ADD COLUMN IF NOT EXISTS justification TEXT;

-- Optional: basic length check (commented out to avoid blocking long comments)
-- ALTER TABLE public.trait_evaluations
--   ADD CONSTRAINT trait_justification_length CHECK (char_length(justification) <= 4000);

