# Multi-Tenant Authentication Fix

## Problem
Users were getting 403 "Insufficient role" errors when accessing the dashboard. The session did not include `orgId` and `orgRole` from the `org_members` table, causing role-based access control to fail.

## Root Cause
The NextAuth session callbacks in `auth.ts` were only loading the `role` from the `users` table, not the org-specific `role` from `org_members`. Contractors need their `orgRole` (from `org_members`) to be checked, not their general `role` (from `users`).

## Solution

### 1. Updated Session Loading (auth.ts)
- Modified JWT callback to load both `users.role` and `org_members.role` (as `orgRole`)
- Added `orgId` from `org_members` to the session
- Session now includes: `session.user.{id, role, orgId, orgRole}`

### 2. Updated TypeScript Types (next-auth.d.ts)
- Added `orgRole` to the `Session` interface
- Added `orgRole` to the `JWT` interface

### 3. Enhanced Error Logging (lib/auth/guards.ts)
- `requireMembership` now logs detailed role check failures with:
  - Current user role
  - Required roles
  - User email
- Error messages include both required and current role for debugging

### 4. Fixed Navigation Filtering (components/navigation.tsx)
- Changed from checking `session.user.role` (user table) to `session.user.orgRole` (org_members table)
- Contractors (`orgRole='contractor'`) now see only:
  - Dashboard
  - Intake
  - Work Log  
  - Schedule
- Admins (`orgRole='admin'`) see all navigation items
- Backoffice (`orgRole='backoffice'`) see all navigation items

### 5. Relaxed API Access (app/api/job-requests/recent/route.ts)
- Changed from `requireMembership()` to `requireMembership([])` to allow any authenticated user with org membership (not role-specific)

## Database Setup

### Tables
- `users`: General user info (email, name, global `role`)
- `org_members`: Org-specific membership (userId, orgId, org-specific `role`)
- `orgs`: Organizations (name, slug)

### Roles
**User Roles** (users.role - global):
- ADMIN, DISPATCHER, FOREMAN, CREW, OFFICE, CUSTOMER

**Org Roles** (org_members.role - org-specific):
- admin: Full access to all features
- backoffice: Full access to all features
- contractor: Limited access (Dashboard, Intake, Work Log, Schedule only)

## Test Users

Both users have password: `dev` (from `DEV_PASSWORD` env var)

### Admin User
```sql
Email: admin@lunas.local
Users.role: ADMIN
Org: Lunas (lunas)
Org_members.role: admin
Access: All pages and features
```

### Contractor User
```sql
Email: iam@thetonyb.com
Users.role: CUSTOMER
Org: Lunas (lunas)
Org_members.role: contractor
Access: Dashboard, Intake, Work Log, Schedule only
```

## Testing

1. **Login as Admin**:
   - Email: `admin@lunas.local`
   - Password: `dev`
   - Expected: See all navigation items
   - Can access: Dashboard, Intake, Work Log, Schedule, Dispatch, Blue Book, Contracts, Invoicing, Import, Users, Settings

2. **Login as Contractor**:
   - Email: `iam@thetonyb.com`
   - Password: `dev`
   - Expected: See limited navigation items
   - Can access: Dashboard, Intake, Work Log, Schedule
   - Cannot access: Blue Book, Contracts, Users, Settings, etc.

3. **Verify API Access**:
   - Contractors accessing admin-only APIs (e.g., `/api/admin/users`) should get 403 with detailed error:
     ```json
     {
       "error": "Insufficient role. Required: admin, Current: contractor",
       "details": "ForbiddenError: ...",
       "stack": "..." // in development only
     }
     ```

## Verification Commands

Check users and org memberships:
```sql
SELECT u.email, u.role as user_role, om.role as org_role, o.name as org_name
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN orgs o ON om.org_id = o.id;
```

Expected output:
```
       email       | user_role | org_role |  org_name
-------------------+-----------+----------+------------
 admin@lunas.local | ADMIN     | admin    | Lunas
 iam@thetonyb.com  | CUSTOMER  | contractor | Lunas
```

## Files Modified

1. `auth.ts` - Load orgId/orgRole into session
2. `next-auth.d.ts` - Add orgRole type
3. `lib/auth/guards.ts` - Enhanced error logging
4. `components/navigation.tsx` - Filter by orgRole
5. `app/api/job-requests/recent/route.ts` - Allow any authenticated user
6. `app/api/me/route.ts` - Return membership data (userId, orgId, role)

## Error Scenarios

### Expected Errors (Working Correctly)
- ✅ Contractor accessing `/users` page → 403 "Insufficient role"
- ✅ Contractor accessing `/api/admin/*` → 403 with detailed error
- ✅ Unauthenticated user → Redirect to `/login`

### Fixed Errors
- ✅ Was: 403 "Insufficient role" with empty `{}` data on dashboard
- ✅ Now: Dashboard loads successfully, role-based navigation works
- ✅ Was: Navigation showed all items for contractors
- ✅ Now: Contractors see only allowed pages

## Environment Variables

Required in `.env.local`:
```bash
DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://localhost:5432/lunas
AUTH_SECRET=<your-secret>
DEV_PASSWORD=dev  # Default password for seeded users
```

## Next Steps

To add more users:
1. Go to `/users` page (admin only)
2. Click "Create User" button
3. Fill in email, name, password
4. Select org membership and role
5. User can now login with their credentials

To change contractor access:
- Modify the `contractorAllowed` Set in `components/navigation.tsx`
- Update API route guards to allow contractor role where needed
