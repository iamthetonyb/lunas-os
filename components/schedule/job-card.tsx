'use client';

import { useState, useEffect } from 'react';
import { getFriendlyName } from '@/lib/utils/community-display';

// Helper: Get service-based row color (Duplicated for component isolation as requested)
function getServiceRowColor(serviceName: string, isDispatched: boolean, isRescheduled: boolean, isComplete: boolean, isExtraWork?: boolean): string {
    if (isExtraWork) return 'bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500';
    if (isComplete) return 'bg-slate-100/50 dark:bg-slate-800/50 border-l-4 border-slate-500 opacity-75';
    if (isDispatched) return 'bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500';
    if (isRescheduled) return 'bg-purple-100 dark:bg-purple-900/20';

    const lower = serviceName.toLowerCase();
    if (lower.includes('tub') || lower.includes('window')) return 'bg-green-50 dark:bg-green-900/10';
    if (lower.includes('sweep')) return 'bg-orange-50 dark:bg-orange-900/20';
    if (lower.includes('power wash') || lower.includes('wash')) return 'bg-blue-50 dark:bg-blue-900/10';
    return 'bg-white dark:bg-slate-800';
}

function formatTime(timeStr: string | null) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    if (!h) return timeStr;
    return `${parseInt(h, 10)}:${m || '00'}`;
}

function formatDisplayDate(dateStr: string | null) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${month}/${day}/${year}`;
}

type Foreman = { id: string; name: string };

type JobCardProps = {
    job: any; // Using any to avoid complex type duplication from page.tsx for now, strictly following field usages
    isContractor: boolean;
    rescheduledDate?: string; // date string or null
    selectedForemanName?: string;
    foremenDirectory: Foreman[];
    onForemanChange: (id: string, value: string) => void;
    onDispatch: (job: any, onSuccess: () => void) => void;
    onMarkComplete: (id: string, status: string) => void;
    onReschedule: (job: any) => void;
};

export function JobCard({
    job,
    isContractor,
    rescheduledDate,
    selectedForemanName,
    foremenDirectory,
    onForemanChange,
    onDispatch,
    onMarkComplete,
    onReschedule,
}: JobCardProps) {
    // Local state for optimistic updates
    const [status, setStatus] = useState(job.status);

    // Sync with prop updates (e.g. SWR revalidation)
    useEffect(() => {
        setStatus(job.status);
    }, [job.status]);

    const assignedForeman = selectedForemanName || job.assignedForemanName;
    const builder = job.builderName || '—';
    const serviceLabel = job.serviceDisplay || '—';

    const isExtraWork = job.isExtraWork === true;

    const rawWalkTime = job.walkTime ?? job.walk_time ?? null;
    const walkTime = formatTime(rawWalkTime);
    const originalDate = job.originalStartDate;

    const startDateStamp = job.startDate ? formatDisplayDate(job.startDate) : null;

    const statusUpper = (status || '').toUpperCase();
    const isRescheduled = !!job.rescheduledDate || !!rescheduledDate;
    const isComplete = statusUpper === 'COMPLETE';
    const isDispatched = statusUpper === 'SENT' || statusUpper === 'DISPATCHED';

    const rowColor = getServiceRowColor(serviceLabel, isDispatched, isRescheduled, isComplete, isExtraWork);

    const handleDispatchClick = () => {
        onDispatch(job, () => {
            // Optimistic update callback
            setStatus('DISPATCHED');
        });
    };

    const handleCompleteClick = (newStatus: string) => {
        setStatus(newStatus); // Immediate update
        onMarkComplete(job.id, newStatus);
    };

    return (
        <tr className={rowColor}>
            {!isContractor && (
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-300">
                    <select
                        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-slate-700 dark:text-white dark:ring-slate-600"
                        value={assignedForeman || ''}
                        onChange={(e) => onForemanChange(job.id, e.target.value)}
                    >
                        <option value="">Unassigned</option>
                        {foremenDirectory.map((f) => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                        ))}
                    </select>
                </td>
            )}
            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{builder}</td>
            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                {job.communityName} (Lot {job.lot || '—'})
            </td>
            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                <span className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium">
                    {isComplete && <span className="text-gray-500 font-bold">✓</span>}
                    {isExtraWork && <span className="text-red-600" title="Extra Work / Duplicate">⚠️</span>}
                    {serviceLabel}
                </span>
            </td>
            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-300">
                <div className="flex flex-col gap-1">
                    {startDateStamp && (
                        <span className="inline-flex items-center self-start rounded-md bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                            {startDateStamp}
                        </span>
                    )}
                    <div className="space-y-0.5">
                        <p>{job.lot ? `Lot ${job.lot}` : null}</p>
                        {walkTime && <p className="text-xs opacity-75">Walk: {walkTime}</p>}
                        {originalDate && originalDate !== job.startDate && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Original: {formatDisplayDate(originalDate)}
                            </p>
                        )}
                        {rescheduledDate && (
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Resched: {formatDisplayDate(rescheduledDate)}
                            </p>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                <div className="flex gap-2">
                    {!isContractor ? (
                        /* Admin view */
                        isDispatched ? (
                            <button
                                onClick={handleDispatchClick}
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 font-medium"
                            >
                                Re-Dispatch
                            </button>
                        ) : (
                            <button
                                onClick={handleDispatchClick}
                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            >
                                Dispatch to
                            </button>
                        )
                    ) : (
                        /* Contractor view */
                        isComplete ? (
                            <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded border border-green-300 dark:border-green-700">
                                <span className="text-green-700 dark:text-green-300 text-xs font-bold">Completed</span>
                                <button
                                    onClick={() => handleCompleteClick(job.status || 'COMPLETE')}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    title="Undo completion"
                                >
                                    ↩
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => handleCompleteClick('COMPLETE')}
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                title="Mark job complete"
                            >
                                ✓ Mark Done
                            </button>
                        )
                    )}

                    <button
                        onClick={() => onReschedule(job)}
                        className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                    >
                        Reschedule
                    </button>
                </div>
            </td>
        </tr>
    );
}
