-- Remove duplicate/overlapping policies on user_roles
-- Keep the ones with auth.uid() IS NOT NULL checks and consolidate

-- Drop old duplicates (without auth.uid() IS NOT NULL checks)
DROP POLICY IF EXISTS "Admin can delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update user_roles" ON public.user_roles;

-- Drop redundant SELECT policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;

-- Remaining consolidated policies:
-- "Admin can delete roles" (DELETE, with NULL check) ✓
-- "Admin can insert roles" (INSERT, with NULL check) ✓
-- "Admin can update roles" (UPDATE, with NULL check) ✓
-- "Users can view their own roles" (SELECT, self-view with NULL check) ✓

-- Add back admin SELECT with proper NULL check
CREATE POLICY "Admin can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));