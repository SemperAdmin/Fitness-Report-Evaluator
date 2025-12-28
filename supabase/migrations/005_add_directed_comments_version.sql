BEGIN;

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS directed_comments TEXT;

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS directed_comments_version INTEGER NOT NULL DEFAULT 1;

COMMIT;
