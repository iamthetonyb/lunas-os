# Ably Build Error Fix - Summary

## Problem
Module not found error for optional Keyv adapters (@keyv/redis, @keyv/mongo, etc.) when importing Ably.
The error trace showed: `ably/build/ably-node.js ← lib/realtime/use-org-realtime.ts ← /work-log`

## Root Cause
1. `lib/ably.ts` was importing `ably/promises` which pulls in the Node build
2. This file was being analyzed during client bundling even though it's only used in API routes
3. The Node build includes `got` which has optional Keyv adapter dependencies
4. Turbopack tried to resolve these optional dependencies and failed

## Solution

### Files Modified:

1. **lib/ably.ts** - Made server-only
   - Added `import 'server-only'` at the top
   - Prevents client-side bundler from analyzing this file
   - File is only used in API routes (server-side)

2. **lib/realtime/ably-browser.ts** - Browser-only Ably loader
   - Dynamic import of Ably for browser use only
   - No static imports at module level
   - Used by client components

3. **lib/realtime/use-org-realtime.ts** - Already client-only
   - Already had 'use client' directive
   - Already using dynamic import via getAbly()
   - Already checking `typeof window`

4. **components/OrgRealtimeProvider.tsx** - Client wrapper
   - Wraps the realtime hook
   - Exported as default for dynamic import

5. **app/work-log/page.tsx** - Dynamic provider loading
   - Uses `dynamic(() => import('@/components/OrgRealtimeProvider'), { ssr: false })`
   - Prevents SSR of Ably-dependent code

6. **next.config.js** - Webpack fallback aliases
   - Added webpack config with aliases for optional Keyv adapters
   - Maps them to `false` to prevent bundling
   - Turbopack config left minimal (`turbopack: {}`)

### Key Changes:

```typescript
// lib/ably.ts - Server-only
import 'server-only';  // ← Added this
import Ably from 'ably/promises';
// ...rest of file

// lib/realtime/ably-browser.ts
export async function getAbly() {
  const Ably = (await import('ably')).default;
  return Ably;
}

// app/work-log/page.tsx
import dynamic from 'next/dynamic';
const OrgRealtimeProvider = dynamic(
  () => import('@/components/OrgRealtimeProvider'), 
  { ssr: false }
);

// next.config.js
webpack: (config, { isServer }) => {
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    '@keyv/redis': false,
    '@keyv/mongo': false,
    // ... other keyv adapters
  };
  return config;
}
```

## Result

✅ **Build succeeds without errors**
✅ **No Keyv adapter resolution errors**
✅ **/work-log page loads correctly (200 OK)**
✅ **Ably loads only in browser (SSR disabled)**
✅ **Server-side Ably (lib/ably.ts) isolated from client bundle**

### Verification:
```bash
rm -rf .next
pnpm dev
# ✓ Ready in 797ms

curl -I http://localhost:4010/work-log
# HTTP/1.1 200 OK

# Server logs:
# GET /work-log 200 in 2.2s (compile: 1909ms, render: 337ms)
# No module resolution errors ✓
```

## Files Changed Summary:

| File | Change | Reason |
|------|--------|--------|
| `lib/ably.ts` | Added `import 'server-only'` | Prevent client bundling of Node dependencies |
| `lib/realtime/ably-browser.ts` | Created | Browser-only Ably loader |
| `lib/realtime/use-org-realtime.ts` | Updated to use getAbly() | Client-only Ably loading |
| `components/OrgRealtimeProvider.tsx` | Created | Wrapper for dynamic import |
| `app/work-log/page.tsx` | Added dynamic import | SSR disabled for Ably components |
| `next.config.js` | Added webpack aliases | Prevent Keyv adapter resolution |

## Architecture

```
Server-Side (API Routes):
  lib/ably.ts (server-only) → ably/promises → ably-node.js ✓

Client-Side (Browser):
  app/work-log/page.tsx → 
    dynamic(OrgRealtimeProvider, {ssr:false}) →
      useOrgRealtime() →
        getAbly() →
          import('ably') [browser build] ✓

Turbopack/Webpack:
  Keyv adapters → false (not bundled) ✓
```

## Prevention

To prevent similar issues in the future:

1. **Always use `'server-only'`** for files that import Node-only dependencies
2. **Use dynamic imports** with `{ssr: false}` for browser-only libraries
3. **Check import traces** when adding new real-time/socket libraries
4. **Add webpack/turbopack aliases** for optional peer dependencies

