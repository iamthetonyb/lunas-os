'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { useSession } from 'next-auth/react';
import { getFriendlyName } from '@/lib/utils/community-display';

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

type DispatchBatch = {
  id: string;
  serviceDate: string | null;
  status: string | null;
  crewName?: string | null;
  foremanName?: string | null;
  jobCount?: number;
};

export default function DispatchPage() {
  const { data: session } = useSession();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  // Fetch dispatch batches from API
  const { data: batches = [] } = useSWR<DispatchBatch[]>(
    '/api/dispatch-batches',
    fetcher
  );

  // Fallback to mock data if API not yet returning data
  const displayBatches = batches.length > 0 ? batches : [
    { id: 'batch-001', serviceDate: new Date().toISOString(), status: 'PENDING', crewName: 'Carmen', foremanName: 'Anahi', jobCount: 5 },
    { id: 'batch-002', serviceDate: new Date().toISOString(), status: 'DISPATCHED', crewName: 'Yadira', foremanName: 'Chayo', jobCount: 8 },
    { id: 'batch-003', serviceDate: new Date().toISOString(), status: 'COMPLETE', crewName: 'Luis D', foremanName: 'Blanca', jobCount: 6 },
  ];

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Manage crew dispatch and job batches"
        action={!isContractor ? (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Batch
          </button>
        ) : undefined}
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dispatch ID (Crew)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Foreman
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jobs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayBatches.map((batch) => {
                  const dateStr = batch.serviceDate
                    ? new Date(batch.serviceDate).toLocaleDateString()
                    : '—';
                  const status = batch.status ?? 'PENDING';

                  return (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-blue-600">
                          {batch.crewName || batch.id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {batch.foremanName || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dateStr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status === 'COMPLETE'
                            ? 'bg-green-100 text-green-800'
                            : status === 'DISPATCHED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {batch.jobCount ?? 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Link
                          href={`/dispatch/${batch.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
