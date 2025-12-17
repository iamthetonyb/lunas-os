-- ============================================
-- CREATE ADMIN USER IN PRODUCTION DATABASE
-- ============================================
-- 
-- Run this SQL in DigitalOcean Database Console:
-- 1. Go to: DigitalOcean Dashboard → Databases → dev-db-lunas
-- 2. Click "Open Console" button (top right)
-- 3. Copy-paste ALL of the SQL below
-- 4. Press Enter to execute
--
-- Login credentials after running:
--   Email: admin@lunas.local
--   Password: dev
--
-- ============================================

-- Step 1: Create default organization
INSERT INTO orgs (id, name, slug, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Lunas Construction',
  'lunas-construction',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET name = 'Lunas Construction'
RETURNING id, name;

-- Step 2: Create admin user with password 'dev'
-- Password hash: bcrypt('dev', 10 rounds)
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'admin@lunas.local',
  'admin',
  'ADMIN',
  '$2b$10$EklTgMVG9M6.WjdIAjR1yusw3TOAKW6lsxupYNbaK/ythuanuKD7O',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
  password_hash = '$2b$10$EklTgMVG9M6.WjdIAjR1yusw3TOAKW6lsxupYNbaK/ythuanuKD7O',
  role = 'ADMIN'
RETURNING id, email, name, role;

-- Step 3: Link admin user to organization
INSERT INTO org_members (user_id, org_id, role, created_at, updated_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, org_id) 
DO UPDATE SET role = 'ADMIN'
RETURNING user_id, org_id, role;

-- Step 4: Verify everything worked (should show the admin user details)
SELECT 
  u.id, 
  u.email, 
  u.name, 
  u.role as user_role,
  om.org_id, 
  om.role as org_role,
  o.name as org_name
FROM users u
LEFT JOIN org_members om ON om.user_id = u.id
LEFT JOIN orgs o ON o.id = om.org_id
WHERE u.email = 'admin@lunas.local';

-- ============================================
-- SUCCESS! You should see output like:
--
-- id                  | email             | name  | user_role | org_id               | org_role | org_name
-- --------------------|-------------------|-------|-----------|----------------------|----------|------------------
-- b0000000-0000-...   | admin@lunas.local | admin | ADMIN     | a0000000-0000-...    | ADMIN    | Lunas Construction
--
-- Now go to: https://lunas-app-pwfcl.ondigitalocean.app/login
-- Login with: admin@lunas.local / dev
-- ============================================
