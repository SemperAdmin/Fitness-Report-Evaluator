-- Add username column and optional user_email for broader app usage
BEGIN;

ALTER TABLE public.fit_users
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Optionally add user_email to distinguish from rs_email (kept for backward compatibility)
ALTER TABLE public.fit_users
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Backfill username from existing rs_email when username is NULL
UPDATE public.fit_users
  SET username = rs_email
  WHERE username IS NULL;

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_fit_users_username ON public.fit_users (username);
CREATE INDEX IF NOT EXISTS idx_fit_users_user_email ON public.fit_users (user_email);

COMMIT;
