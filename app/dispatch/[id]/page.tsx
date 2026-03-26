'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { use } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useConvexUser } from '@/hooks/useConvexUser';
import { getFriendlyName } from '@/lib/utils/community-display';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
    assignmentId?: string;
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
    const { t } = useTranslation();
    const { data: session } = useConvexUser();
    const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';
    const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'backoffice';

    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; jobId: string | null }>({
        isOpen: false,
        jobId: null,
    });

    // Convex reactive query - returns undefined while loading, null if not found
    const dispatch = useQuery(api.queries.getDispatchBatchById, { batchId: id as any }) as DispatchDetail | undefined | null;
    const isLoading = dispatch === undefined;

    // Convex mutations
    const completeMutation = useMutation(api.assignmentFunctions.complete);
    const removeMutation = useMutation(api.assignmentFunctions.remove);

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
            // Find the assignment ID for this job from the dispatch data
            const job = dispatch?.jobs?.find(j => j.id === completeModal.jobId);
            const assignmentId = (job as any)?.assignmentId;
            if (assignmentId) {
                await completeMutation({ id: assignmentId });
            }
        } catch (error) {
            console.error('Failed to mark job complete', error);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.jobId) return;
        try {
            // Find the assignment ID for this job from the dispatch data
            const job = dispatch?.jobs?.find(j => j.id === deleteModal.jobId);
            const assignmentId = (job as any)?.assignmentId;
            if (assignmentId) {
                await removeMutation({ id: assignmentId });
            }
            toast.success('Job removed from dispatch');
        } catch (error) {
            console.error('Failed to delete assignment', error);
            toast.error('Failed to remove job');
        }
    };

    if (isLoading) {
        return (
            <>
                <PageHeader title={t('dispatch.title')} description={t('common.loading')} />
                <main className="px-6 py-6">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                    </div>
                </main>
            </>
        );
    }

    if (!dispatch) {
        return (
            <>
                <PageHeader
                    title={t('dispatch.title')}
                    description="Error loading dispatch"
                    action={
                        <Link href="/dispatch" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                            {t('common.back')}
                        </Link>
                    }
                />
                <main className="px-6 py-6">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
                        <p className="text-red-500">Failed to load dispatch details. This batch may not exist yet.</p>
                    </div>
                </main>
            </>
        );
    }

    const dateStr = dispatch.serviceDate
        ? new Date(dispatch.serviceDate + 'T12:00:00').toLocaleDateString()
        : 'Not scheduled';

    return (
        <>
            <PageHeader
                title={`Dispatch: ${dispatch.crewName}`}
                description={`${dispatch.jobs?.length || 0} jobs assigned`}
                action={
                    <Link href="/dispatch" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        {t('common.back')}
                    </Link>
                }
            />
            <main className="px-6 py-6">
                {/* Dispatch Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('dispatch.title')}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.crew')}</p>
                            <p className="text-lg font-semibold text-blue-600">{dispatch.crewName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.foreman')}</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{dispatch.foremanName || '—'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dispatch.serviceDate')}</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{dateStr}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.status')}</p>
                            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${dispatch.status === 'COMPLETE'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : dispatch.status === 'SENT' || dispatch.status === 'DISPATCHED'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                {dispatch.status === 'SENT' ? 'DISPATCHED' : dispatch.status || 'PENDING'}
                            </span>
                        </div>
                    </div>
                    {dispatch.notes && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('common.notes')}</p>
                            <p className="text-gray-900 dark:text-gray-100">{dispatch.notes}</p>
                        </div>
                    )}
                </div>

                {/* Jobs List */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dispatch.yourAssignedJobs')}</h2>
                    </div>

                    {!dispatch.jobs || dispatch.jobs.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            No jobs assigned to this dispatch yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.community')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.builder')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.lot')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.service')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.foreman')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('schedule.walkTime')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                    {(dispatch.jobs || [])
                                        .sort((a, b) => (a.walkTime || '').localeCompare(b.walkTime || ''))
                                        .map((job) => (
                                            <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {getFriendlyName(job.communityName || '—')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {job.builderName || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {job.lot || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {job.serviceName || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {job.assignedForeman || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {job.walkTime || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${job.status === 'COMPLETE'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
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
                                                            className="px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
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
                title={t('schedule.markComplete')}
                message="Are you sure you want to mark this job as complete?"
                confirmText={t('common.complete')}
                variant="primary"
            />

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, jobId: null })}
                onConfirm={handleDeleteConfirm}
                title="Remove Job from Dispatch"
                message="Are you sure you want to remove this job from this dispatch batch? This will also remove any associated Blue Book entries."
                confirmText={t('common.delete')}
                variant="danger"
            />
        </>
    );
}
