'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { use } from 'react';
import useSWR, { mutate } from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { useSession } from 'next-auth/react';
import { getFriendlyName } from '@/lib/utils/community-display';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useState } from 'react';
import { toast } from 'sonner';

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

type DispatchDetail = {
    id: string;
    serviceDate: string | null;
    status: string | null;
    crewName: string;
    foremanName: string;
    notes?: string | null;
    jobs: DispatchJob[];
};

type DispatchJob = {
    id: string;
    communityName: string | null;
    builderName: string | null;
    lot: string | null;
    address: string | null;
    serviceName: string | null;
    walkTime: string | null;
    dueDate: string | null;
    status: string | null;
    assignedForeman: string | null;
};

export default function DispatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: session } = useSession();
    const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';
    const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'backoffice';

    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; jobId: string | null }>({
        isOpen: false,
        jobId: null,
    });

    const { data: dispatch, error, isLoading } = useSWR<DispatchDetail>(
        `/api/dispatch-batches/${id}`,
        fetcher
    );

    const [completeModal, setCompleteModal] = useState<{ isOpen: boolean; jobId: string | null }>({
        isOpen: false,
        jobId: null,
    });

    const openCompleteModal = (jobId: string) => {
        setCompleteModal({ isOpen: true, jobId });
    };

    const openDeleteModal = (jobId: string) => {
        setDeleteModal({ isOpen: true, jobId });
    };

    const handleMarkCompleteConfirm = async () => {
        if (!completeModal.jobId) return;
        try {
            await fetchJSON('/api/schedule/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: completeModal.jobId }),
            });
            mutate(`/api/dispatch-batches/${id}`);
        } catch (error) {
            console.error('Failed to mark job complete', error);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.jobId) return;
        try {
            await fetchJSON(`/api/assignments/${deleteModal.jobId}`, {
                method: 'DELETE',
            });
            mutate(`/api/dispatch-batches/${id}`);
            toast.success('Job removed from dispatch');
        } catch (error) {
            console.error('Failed to delete assignment', error);
            toast.error('Failed to remove job');
        }
    };

    if (isLoading) {
        return (
            <>
                <PageHeader title="Dispatch Details" description="Loading..." />
                <main className="px-6 py-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                        <p className="text-gray-500">Loading dispatch details...</p>
                    </div>
                </main>
            </>
        );
    }

    if (error || !dispatch) {
        return (
            <>
                <PageHeader
                    title="Dispatch Details"
                    description="Error loading dispatch"
                    action={
                        <Link href="/dispatch" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                            ← Back to Dispatch
                        </Link>
                    }
                />
                <main className="px-6 py-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                        <p className="text-red-500">Failed to load dispatch details. This batch may not exist yet.</p>
                    </div>
                </main>
            </>
        );
    }

    const dateStr = dispatch.serviceDate
        ? new Date(dispatch.serviceDate).toLocaleDateString()
        : 'Not scheduled';

    return (
        <>
            <PageHeader
                title={`Dispatch: ${dispatch.crewName}`}
                description={`${dispatch.jobs?.length || 0} jobs assigned`}
                action={
                    <Link href="/dispatch" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        ← Back to Dispatch
                    </Link>
                }
            />
            <main className="px-6 py-6">
                {/* Dispatch Summary */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Dispatch Summary</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Crew</p>
                            <p className="text-lg font-semibold text-blue-600">{dispatch.crewName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Foreman</p>
                            <p className="text-lg font-semibold text-gray-900">{dispatch.foremanName || '—'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Service Date</p>
                            <p className="text-lg font-semibold text-gray-900">{dateStr}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${dispatch.status === 'COMPLETE'
                                ? 'bg-green-100 text-green-800'
                                : dispatch.status === 'SENT' || dispatch.status === 'DISPATCHED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {dispatch.status === 'SENT' ? 'DISPATCHED' : dispatch.status || 'PENDING'}
                            </span>
                        </div>
                    </div>
                    {dispatch.notes && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500 mb-1">Notes</p>
                            <p className="text-gray-900">{dispatch.notes}</p>
                        </div>
                    )}
                </div>

                {/* Jobs List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Assigned Jobs</h2>
                    </div>

                    {!dispatch.jobs || dispatch.jobs.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No jobs assigned to this dispatch yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Builder</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foreman</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Walk Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dispatch.jobs.map((job) => (
                                        <tr key={job.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {getFriendlyName(job.communityName || '—')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.builderName || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.lot || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.serviceName || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.assignedForeman || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.walkTime || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${job.status === 'COMPLETE'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {job.status || 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                                                {isContractor && job.status !== 'COMPLETE' && (
                                                    <button
                                                        onClick={() => openCompleteModal(job.id)}
                                                        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                                        title="Mark Complete"
                                                    >
                                                        ✓
                                                    </button>
                                                )}
                                                {/* Visible to contractors OR explicitly allowed for admins/backoffice */}
                                                {(isAdmin || !isContractor) && (
                                                    <button
                                                        onClick={() => openDeleteModal(job.id)}
                                                        className="px-3 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100 transition-colors"
                                                        title="Remove Job"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            <ConfirmationModal
                isOpen={completeModal.isOpen}
                onClose={() => setCompleteModal({ isOpen: false, jobId: null })}
                onConfirm={handleMarkCompleteConfirm}
                title="Mark Job Complete"
                message="Are you sure you want to mark this job as complete?"
                confirmText="Complete"
                variant="primary"
            />

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, jobId: null })}
                onConfirm={handleDeleteConfirm}
                title="Remove Job from Dispatch"
                message="Are you sure you want to remove this job from this dispatch batch? This will also remove any associated Blue Book entries."
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
}
