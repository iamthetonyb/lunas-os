'use client';

import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { getAbly } from './ably-browser';

export function useOrgRealtime(orgId?: string | null) {
  const channelRef = useRef<any>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!orgId) return;

    const key = process.env.NEXT_PUBLIC_ABLY_KEY;
    if (!key) {
      console.info('[realtime] disabled: missing NEXT_PUBLIC_ABLY_KEY');
      return;
    }

    let disposed = false;

    async function boot() {
      try {
        const Ably = await getAbly();
        if (disposed) return;

        const client = new Ably.Realtime({ key, clientId: orgId || 'anon' });
        const channel = client.channels.get(`org:${orgId}`);

        clientRef.current = client;
        channelRef.current = channel;

        channel.subscribe((message: any) => {
          if (message?.name === 'serviceLogs.updated') {
            mutate(
              (key: string) => typeof key === 'string' && key.startsWith('/api/service-logs'),
              undefined,
              { revalidate: true }
            );
          }
          if (message?.name === 'dispatch.updated') {
            mutate(
              (key: string) => typeof key === 'string' && key.startsWith('/api/dispatch-batches'),
              undefined,
              { revalidate: true }
            );
            mutate(
              (key: string) => typeof key === 'string' && key.startsWith('/api/schedule/assignments'),
              undefined,
              { revalidate: true }
            );
          }
          if (message?.name === 'intake.updated') {
            mutate(
              (key: string) => typeof key === 'string' && (key.startsWith('/api/intake') || key.startsWith('/api/job-requests')),
              undefined,
              { revalidate: true }
            );
            mutate(
              (key: string) => typeof key === 'string' && key.startsWith('/api/schedule/assignments'),
              undefined,
              { revalidate: true }
            );
          }
        });
      } catch (err) {
        console.error('[realtime] boot failed', err);
      }
    }

    boot();

    return () => {
      disposed = true;
      try {
        channelRef.current?.detach?.();
        clientRef.current?.close?.();
      } catch {
        // ignore cleanup failures
      }
    };
  }, [orgId]);

  return channelRef;
}
