-- Add email column to admin_users table if it doesn't exist
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- Update existing admin users with their emails
UPDATE public.admin_users au
SET email = u.email
FROM auth.users u
WHERE au.admin_id = u.id AND au.email IS NULL;

-- Insert the three admin users if they don't exist
-- First, get the user IDs from auth.users
INSERT INTO public.admin_users (admin_id, display_name, role, email)
SELECT u.id, 'Hostiggo', 'ADMIN', u.email
FROM auth.users u
WHERE u.email = 'hostiggo@gmail.com'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.admin_users (admin_id, display_name, role, email)
SELECT u.id, 'Rijusmit Biswas', 'ADMIN', u.email
FROM auth.users u
WHERE u.email = 'rijusmit.biswas@gmail.com'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.admin_users (admin_id, display_name, role, email)
SELECT u.id, 'Rijusmit Biswas', 'ADMIN', u.email
FROM auth.users u
WHERE u.email = 'talk.riju@gmail.com'
ON CONFLICT (email) DO NOTHING;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email) WHERE email IS NOT NULL;
