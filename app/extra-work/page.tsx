'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';

const OrgRealtimeProvider = dynamic(() => import('@/components/OrgRealtimeProvider'), { ssr: false });

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

type JobRequest = {
  id: string;
  dueDate: string;
  builderName: string;
  communityName: string;
  lot: string;
  address: string | null;
  notes: string | null;
  isExtraWork: boolean;
  services: { id: string; name: string }[];
  createdAt: string;
};

export default function ExtraWorkPage() {
  const { data: session } = useSession();
  // Redirect contractors away (handled by UI message or middleware, but user requested specific behavior here)
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  const { data: jobs, isLoading } = useSWR<JobRequest[]>('/api/job-requests?isExtraWork=true', fetcher, {
    revalidateOnFocus: false,
  });

  if (isContractor) {
    return (
      <main className="px-6 py-6 space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h2>
          <p className="text-yellow-700">The Extra Work page is only accessible to admin and back office staff.</p>
        </div>
      </main>
    );
  }

  return (
    <OrgRealtimeProvider orgId={session?.user?.orgId ?? undefined}>
      <main className="px-6 py-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Extra Work</h1>
            <p className="text-gray-500">Track and manage extra work job requests.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Due Date</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Builder / Community</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Lot / Address</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Services</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && (!jobs || jobs.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No extra work requests found.
                  </td>
                </tr>
              )}
              {jobs?.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{job.builderName}</div>
                    <div className="text-xs text-gray-500">{job.communityName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">Lot {job.lot}</div>
                    <div className="text-xs text-gray-500">{job.address}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="flex flex-wrap gap-1">
                      {job.services?.map(s => (
                        <span key={s.id} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate" title={job.notes ?? ''}>
                    {job.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </OrgRealtimeProvider>
  );
}
