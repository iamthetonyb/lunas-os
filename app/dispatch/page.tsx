'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession } from 'next-auth/react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useState, useEffect, useMemo } from 'react';

type DispatchBatch = {
  id: string;
  serviceDate: string | null;
  status: string | null;
  crewName: string;
  foremanName: string;
  jobCount: number;
};

export default function DispatchPage() {
  const { data: session } = useSession();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';
  const isAdmin = session?.user?.role === 'ADMIN';
  const currentUserName = session?.user?.name;

  // Date state for day-by-day filtering (hydration-safe)
  const [date, setDate] = useState('');
  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Convex reactive query - no refreshInterval needed, Convex is realtime
  const allBatches = useQuery(api.queries.getDispatchBatches) ?? [];

  // Convex mutation for deleting batches
  const deleteBatchMutation = useMutation(api.mutations.deleteDispatchBatch);

  // Filter batches by selected date (client-side since getDispatchBatches returns all)
  const batches = useMemo(() => {
    if (!date) return [];
    return allBatches.filter((batch) => batch.serviceDate === date);
  }, [allBatches, date]);

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; batchId: string | null }>({
    isOpen: false,
    batchId: null,
  });

  // Filter batches for contractors to only show their assigned jobs
  // Also filter out batches with 0 jobs (empty batches after re-dispatch)
  const displayBatches = (isContractor && currentUserName
    ? batches.filter(batch =>
      batch.foremanName?.toLowerCase() === currentUserName.toLowerCase() ||
      batch.crewName?.toLowerCase() === currentUserName.toLowerCase()
    )
    : batches
  ).filter(batch => batch.jobCount > 0); // Auto-hide empty batches

  const openDeleteModal = (batchId: string) => {
    setDeleteModal({ isOpen: true, batchId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.batchId) return;
    try {
      await deleteBatchMutation({ batchId: deleteModal.batchId as any });
    } catch (error) {
      console.error('Failed to delete batch', error);
    }
  };

  // Date navigation helpers
  const handlePrevDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <>
      <PageHeader
        title="Dispatch"
        description={isContractor ? "Your assigned jobs" : "Manage crew dispatch and job batches"}
        action={
          <div className="flex items-center gap-2">
            {!isContractor && (
              <Link href="/intake" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
                + New Job
              </Link>
            )}
            <button
              onClick={handlePrevDay}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-300"
            >
              ←
            </button>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-2 py-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-900 dark:text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">📅</span>
            </div>
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-300"
            >
              →
            </button>
          </div>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {displayBatches.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {isContractor
                ? `No jobs assigned to you for ${new Date(date + 'T12:00:00').toLocaleDateString()}.`
                : `No dispatch batches found for ${new Date(date + 'T12:00:00').toLocaleDateString()}. Create one from the Schedule page.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Crew
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Foreman
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Service Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Jobs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {displayBatches.map((batch) => {
                    // Use a more robust date parsing to avoid timezone shifts
                    // Manual parsing to ensure MM/DD/YYYY without timezone shift
                    const dateStr = batch.serviceDate
                      ? new Date(batch.serviceDate).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
                      : '—';
                    const status = batch.status ?? 'PENDING';

                    return (
                      <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {batch.crewName}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {batch.foremanName || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {dateStr}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status === 'COMPLETE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : status === 'SENT' || status === 'DISPATCHED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                            {status === 'SENT' ? 'DISPATCHED' : status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 font-semibold">
                            {batch.jobCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <Link
                              href={`/dispatch/${batch.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                            >
                              View Details
                            </Link>
                            {isAdmin && (
                              <button
                                onClick={() => openDeleteModal(batch.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
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
      </main >

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, batchId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Dispatch Batch"
        message="Are you sure you want to delete this dispatch batch? This action cannot be undone and will reset the assigned jobs."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
