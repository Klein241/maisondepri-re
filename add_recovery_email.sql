-- Add recovery_email column to profiles table
-- This is used for password reset functionality
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_email TEXT;

-- Allow users to update their own recovery_email
-- (Existing RLS policies on profiles should already allow self-update)
