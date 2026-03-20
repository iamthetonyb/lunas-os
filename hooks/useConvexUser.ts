import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * Bridge hook: Clerk identity → Convex user profile.
 * Returns a session-compatible shape so consuming code needs minimal changes.
 * Drop-in replacement for `useSession()` from NextAuth.
 */
export function useConvexUser() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;

  const convexUser = useQuery(
    api.queries.getUserByEmail,
    email ? { email } : 'skip'
  );

  // Return a shape compatible with the old useSession().data.session pattern
  if (!isLoaded) {
    return { data: null, status: 'loading' as const, user: null };
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
