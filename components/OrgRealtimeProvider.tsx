'use client';

import { PropsWithChildren } from 'react';
import { useOrgRealtime } from '@/lib/realtime/use-org-realtime';

export default function OrgRealtimeProvider({ children, orgId }: PropsWithChildren<{ orgId?: string }>) {
  useOrgRealtime(orgId || 'org');
  return <>{children}</>;
}
