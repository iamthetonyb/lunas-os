import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEffect, useRef } from 'react';

/**
 * Bridge hook: Clerk identity → Convex user profile.
 * Auto-creates Convex user on first Clerk sign-in.
 * Drop-in replacement for `useSession()` from NextAuth.
 */
export function useConvexUser() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;

  // In dev mode with auth bypass, use fallback admin user
  const bypassAuth = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  const devFallbackUser = useQuery(
    api.queries.getUserByEmail,
    bypassAuth && !isSignedIn ? { email: 'tony@test.com' } : 'skip'
  );

  const convexUser = useQuery(
    api.queries.getUserByEmail,
    email ? { email } : 'skip'
  );

  // Auto-create Convex user on first Clerk sign-in
  const ensureUser = useMutation(api.mutations.ensureUser);
  const ensuredRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSignedIn && email && convexUser === null && ensuredRef.current !== email) {
      ensuredRef.current = email;
      ensureUser({
        email,
        name: clerkUser?.fullName ?? undefined,
      }).catch(() => {
        // Reset so it retries on next render
        ensuredRef.current = null;
      });
    }
  }, [isSignedIn, email, convexUser, ensureUser, clerkUser?.fullName]);

  if (!isLoaded) {
    return { data: null, status: 'loading' as const, user: null };
  }

  // Dev bypass: return fallback user as authenticated
  if (bypassAuth && !isSignedIn && devFallbackUser) {
    const user = {
      id: devFallbackUser._id,
      email: devFallbackUser.email ?? 'tony@test.com',
      name: devFallbackUser.name ?? 'Admin',
      role: devFallbackUser.role ?? 'ADMIN',
      orgId: devFallbackUser.orgId ?? null,
      orgRole: devFallbackUser.orgRole ?? null,
    };
    return { data: { user }, status: 'authenticated' as const, user };
  }

  if (!isSignedIn || !clerkUser) {
    return { data: null, status: 'unauthenticated' as const, user: null };
  }

  const user = {
    id: convexUser?._id ?? clerkUser.id,
    email: email ?? '',
    name: convexUser?.name ?? clerkUser.fullName ?? email ?? '',
    role: convexUser?.role ?? 'VIEWER',
    orgId: convexUser?.orgId ?? null,
    orgRole: convexUser?.orgRole ?? null,
  };

  return {
    data: { user },
    status: 'authenticated' as const,
    user,
  };
}
