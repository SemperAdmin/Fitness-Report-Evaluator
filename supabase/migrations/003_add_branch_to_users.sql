-- Add branch column to existing users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'USMC';

-- Add comment to document the column
COMMENT ON COLUMN public.users.branch IS 'Military branch (USMC, USA, USN, USAF, USCG, USSF)';
