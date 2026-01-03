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


  const handleUpdate = async (id: string, field: string, value: any) => {
    // Basic optimistic UI could be added here, but for now we rely on mutate
    try {
      await fetchJSON(`/api/job-requests/${id}`, {
        method: 'PUT', // Using PUT or we might need a PATCH endpoint. 
        // Existing PUT requires full payload. We should check if we can partial update or if we need to implement PATCH.
        // Step 4333 shows PUT expects full payload (zod schema).
        // I might need to implement a PATCH or just use what I have.
        // Wait, the PUT logic re-creates services too.
        // I should probably Implement a PATCH route or separate update logic for these fields.
        // But user said "Update POST ...". No, they said "Restore Editable Input Fields... Ensure they save to the DB".
        // I will implement a PATCH in job-requests/[id] first? Or allow partial PUT?
        // The existing PUT validation is strict.
        // I'll add a PATCH handler to `app/api/job-requests/[id]/route.ts` in the next tool call? 
        // Or assume I can use a new endpoint.
        // I'll use a new helper `updateJobRequestField` which calls a new PATCH.
      });
      // Actually, I'll write the UI code assuming PATCH exists, then fix the backend.
    } catch (e) {
      console.error(e);
      // toast error
    }
  };

  // START: Re-implementing UI with Inputs
  // Since I can't easily replace the whole file content structure without `read_file` confirming lines,
  // I will replace the TABLE BODY content.

  return (
    <OrgRealtimeProvider orgId={session?.user?.orgId ?? undefined}>
      <main className="px-6 py-6 space-y-6">
        {/* ... Header ... */}
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
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Price</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Notes</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
              )}
              {!isLoading && (!jobs || jobs.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No extra work requests found.</td></tr>
              )}
              {jobs?.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  {/* ... Date, Builder, Lot ... (Static) */}
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
                  {/* Editable Fields */}
                  <td className="px-4 py-3 text-gray-900">
                    <input
                      type="number"
                      defaultValue={(job as any).amount || ''}
                      className="w-24 px-2 py-1 border rounded"
                      placeholder="$0.00"
                      onBlur={(e) => {
                        const val = e.target.value;
                        fetchJSON(`/api/job-requests/${job.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ amount: val })
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <input
                      type="text"
                      defaultValue={job.notes || ''}
                      className="w-full px-2 py-1 border rounded"
                      placeholder="Notes..."
                      onBlur={(e) => {
                        fetchJSON(`/api/job-requests/${job.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notes: e.target.value })
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <select
                      defaultValue={(job as any).status || ''}
                      className="w-32 px-2 py-1 border rounded"
                      onChange={(e) => {
                        fetchJSON(`/api/job-requests/${job.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: e.target.value })
                        });
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="BILLED">Billed</option>
                    </select>
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
