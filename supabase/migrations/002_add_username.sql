-- Add username column and optional user_email for broader app usage
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Optionally add user_email to distinguish from rs_email (kept for backward compatibility)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Backfill username from existing rs_email when username is NULL
UPDATE public.users
  SET username = rs_email
  WHERE username IS NULL;

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_user_email ON public.users (user_email);

COMMIT;
