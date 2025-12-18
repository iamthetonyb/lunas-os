'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export default function DispatchPage() {
  const { data: session } = useSession();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';
  const isAdmin = session?.user?.role === 'ADMIN';
  const currentUserName = session?.user?.name;

  // Real-time Convex query
  const batches = useQuery(api.queries.getDispatchBatches);

  // Convex mutation
  const deleteBatchMutation = useMutation(api.mutations.deleteDispatchBatch);

  // Filter batches for contractors
  const displayBatches = batches
    ? isContractor && currentUserName
      ? batches.filter(batch =>
        batch.foremanName?.toLowerCase() === currentUserName.toLowerCase() ||
        batch.crewName?.toLowerCase() === currentUserName.toLowerCase()
      )
      : batches
    : [];

  const handleDelete = async (batchId: Id<"dispatchBatches">) => {
    if (!confirm('Are you sure you want to delete this dispatch batch? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteBatchMutation({ batchId });
    } catch (error) {
      console.error('Failed to delete batch', error);
      alert('Failed to delete dispatch batch. Please try again.');
    }
  };

  if (!batches) {
    return (
      <>
        <PageHeader title="Dispatch" description="Loading..." />
        <main className="px-6 py-6">
          <div className="animate-pulse bg-gray-100 rounded-lg h-64"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dispatch"
        description={isContractor ? "Your assigned jobs (Real-time)" : "Manage crew dispatch and job batches (Real-time)"}
        action={!isContractor ? (
          <Link
            href="/intake"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Job
          </Link>
        ) : undefined}
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {displayBatches.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {isContractor
                ? "No jobs assigned to you yet."
                : "No dispatch batches found. Create one from the Schedule page."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Crew
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Foreman
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service Date
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
                            {batch.crewName}
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
                            : status === 'SENT' || status === 'DISPATCHED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {status === 'SENT' ? 'DISPATCHED' : status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold">
                            {batch.jobCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <Link
                              href={`/dispatch/${batch.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Details
                            </Link>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(batch.id as Id<"dispatchBatches">)}
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
