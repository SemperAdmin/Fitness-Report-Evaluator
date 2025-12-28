-- Add branch column to existing users table
ALTER TABLE public.fit_users 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'USMC';

-- Add comment to document the column
COMMENT ON COLUMN public.fit_users.branch IS 'Military branch (USMC, USA, USN, USAF, USCG, USSF)';
