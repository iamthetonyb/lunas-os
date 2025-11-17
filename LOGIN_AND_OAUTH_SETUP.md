# Login & OAuth Setup

## Overview
The main portal now requires authentication. Unauthenticated users are redirected to `/login`, and authenticated users accessing `/` are redirected to `/dashboard`.

## Features

### 1. **Email/Password Login**
- Default credentials work as before
- Uses `DEV_EMAILS` and `DEV_PASSWORD` from `.env.local`
- Example: `dispatcher@lunas.com` / `password`

### 2. **Google OAuth** (Optional)
To enable Google sign-in:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:4010/api/auth/callback/google`
4. Set in `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

### 3. **Microsoft/Azure AD OAuth** (Optional)
To enable Microsoft sign-in:
1. Go to [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Register a new application
3. Add redirect URI: `http://localhost:4010/api/auth/callback/azure-ad`
4. Set in `.env.local`:
   ```
   AZURE_AD_CLIENT_ID=your_client_id
   AZURE_AD_CLIENT_SECRET=your_client_secret
   AZURE_AD_TENANT_ID=your_tenant_id
   ```

## Files Modified

- **app/page.tsx** - Redirects to /login or /dashboard based on auth state
- **app/login/page.tsx** - Enhanced with OAuth buttons (Google & Microsoft)
- **auth.ts** - Added Google and Azure AD providers
- **.env.example** - Documented OAuth environment variables
- **components/conditional-layout.tsx** - Excludes /api/auth from layout

## How It Works

1. **Unauthenticated access**: Any route except `/login`, `/signin`, `/api/auth`, `/health` redirects to login
2. **OAuth buttons**: Only displayed if corresponding env vars are set
3. **After login**: Users are redirected to `/dashboard` or the originally requested page

## Testing

1. **Without OAuth** (default):
   ```bash
   # Just use email/password
   # Email: dispatcher@lunas.com
   # Password: password (or whatever DEV_PASSWORD is set to)
   ```

2. **With Google OAuth**:
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Restart server
   - Click "Google" button on login page

3. **With Microsoft OAuth**:
   - Set `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
   - Restart server
   - Click "Microsoft" button on login page

## Notes

- OAuth providers are **optional** - the app works fine with just email/password
- If OAuth env vars are not set, the respective buttons won't appear
- The app uses `next-auth` v5 (beta 30) with Next.js 16.0.3
- Session strategy is JWT (no database session storage needed for OAuth)
