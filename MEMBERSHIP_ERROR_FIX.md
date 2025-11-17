# Membership Error Fix Summary

## Changes Made

### 1. Enhanced Error Logging in `lib/api/http.ts`
- **safe() wrapper**: Now logs full error stack traces and details
- Returns structured error responses with `{ error, details }` even when empty
- Preserves Zod error flattening for validation failures

```typescript
console.error('API Handler Error:', msg, error?.stack || '');
console.error('Full error object:', error);
return NextResponse.json(
  { error: 'Internal server error', details: msg || 'Unknown' },
  { status: (error as any)?.status ?? 500 }
);
```

### 2. Enhanced Membership API in `app/api/admin/users/route.ts`
- **POST handler**: Added comprehensive logging at each step:
  - Logs incoming body with type and keys
  - Logs parsed payload after Zod validation
  - Wraps DB operations in try/catch with specific error logging
  - Logs successful membership save

```typescript
console.log('Incoming membership update body:', body);
console.log('Body type:', typeof body, 'Keys:', Object.keys(body || {}));
console.log('Parsed payload:', payload);
// ... DB operation ...
console.log('Membership saved successfully:', membership);
```

### 3. Enhanced Client Error Handling in `app/users/page.tsx`
- **handleMembershipSubmit**: Now handles empty error.data gracefully
- Logs full error details to browser console
- Shows user-friendly error messages with validation details

```typescript
console.log('Submitting membership data:', membership);
// ... on error ...
console.error('Membership submit failed with data:', err.data);
if (!err.data || Object.keys(err.data).length === 0) {
  err.data = { error: 'Unknown server error' };
}
```

### 4. Confirmed Contractor Navigation in `components/navigation.tsx`
- ✅ Dashboard is included in contractor-allowed pages
- Contractor users see: Dashboard, Intake, Work Log, Schedule

## Testing Instructions

### 1. Server is Running
The dev server is running at http://localhost:4010

### 2. Test Through UI (Recommended)
1. Open browser to http://localhost:4010
2. Login as admin user (admin@lunas.local)
3. Navigate to /users page
4. Try to save a membership assignment
5. Check both:
   - **Browser Console**: Will show "Submitting membership data:" and "failed with data:" logs
   - **Server Terminal**: Will show detailed logs from API route

### 3. Expected Server Logs on Success
```
Incoming membership update body: { userId: '...', orgId: '...', role: 'contractor' }
Body type: object Keys: [ 'userId', 'orgId', 'role' ]
Parsed payload: { userId: '...', orgId: '...', role: 'contractor' }
Membership saved successfully: { id: '...', orgId: '...', userId: '...', role: 'contractor', ... }
```

### 4. Expected Server Logs on Validation Error
```
Incoming membership update body: { ... invalid data ... }
Body type: object Keys: [ ... ]
Membership validation failed: { fieldErrors: {...}, formErrors: [...] }
```

### 5. Expected Server Logs on DB Error
```
Incoming membership update body: { ... }
Body type: object Keys: [ ... ]
Parsed payload: { ... }
DB error during membership update: Error: ...
DB error stack: ...
API Handler Error: ...
Full error object: ...
```

## Database Schema Reference

### Users Table
- id (uuid, primary key)
- email (text, unique)
- name (text, nullable)
- phone (text, nullable)

### Orgs Table
- id (uuid, primary key)
- name (text)
- slug (text, unique)

### Org Members Table
- id (uuid, primary key)
- orgId (uuid, FK to orgs, cascade delete)
- userId (uuid, FK to users, cascade delete)
- role (enum: 'admin', 'backoffice', 'contractor')
- createdAt (timestamp)
- Unique constraint: (orgId, userId)

### Current Test Data
```sql
-- User
id: 3feadc8b-8b51-474e-b016-f12b89cf6f1b
email: admin@lunas.local

-- Org
id: ded38a64-c228-4870-aa0a-f1ffa0fcc7af
name: Lunas
```

## Troubleshooting

### If you still see "Cannot read properties of undefined (reading 'keyAsName')"
- This was the original Zod error formatting issue
- Now handled by `.flatten()` which provides structured errors
- Check that Zod validation is using `safeParse()` not `parse()`

### If you see empty {} error response
- Check server terminal for "API Handler Error:" logs
- Will now include stack trace and details
- Likely a DB constraint violation or auth issue

### If contractor can't see Dashboard
- Verify in `components/navigation.tsx`:
  ```typescript
  const contractorAllowed = new Set(['Dashboard', 'Intake', 'Work Log', 'Schedule']);
  ```
- This is now confirmed correct

## Next Steps

1. **Test in Browser**: Login and try saving a membership assignment
2. **Share Logs**: If error persists, share:
   - Browser console output (look for "Submitting..." and "failed with...")
   - Server terminal output (look for "Incoming membership...", "API Handler Error:")
3. **Verify Fix**: Successful save should:
   - Show "Membership saved." alert in UI
   - Add/update row in org_members table
   - Refresh users list showing new membership badge

## Files Modified

1. `lib/api/http.ts` - Enhanced safe() wrapper with detailed error logging
2. `app/api/admin/users/route.ts` - Added step-by-step logging in POST handler
3. `app/users/page.tsx` - Improved client error handling with empty data check
4. `components/navigation.tsx` - Confirmed Dashboard in contractor access (no change needed)
