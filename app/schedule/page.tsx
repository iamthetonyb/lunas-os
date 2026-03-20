'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSession } from 'next-auth/react';
import { ScheduleKanban } from '@/components/schedule-kanban';
import { getFriendlyName } from '@/lib/utils/community-display';
import { Dialog, Transition } from '@headlessui/react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { toast } from 'sonner';
import { JobCard } from '@/components/schedule/job-card';
import { useTranslation } from 'react-i18next';

type ForemanConfig = {
  id: string;
  name: string;
  codes?: string[];
  keywords?: string[];
};

const FOREMEN_DIRECTORY: ForemanConfig[] = [
  { id: 'anahi', name: 'Anahi', codes: ['22702'], keywords: ['sweep'] },
  { id: 'blanca', name: 'Blanca', keywords: ['power wash', 'wash'] },
  { id: 'chayo', name: 'Chayo', codes: ['22712'], keywords: ['tubs', 'windows', 'q/a'] },
  { id: 'francisco', name: 'Francisco', keywords: ['extra', 'service'] },
  { id: 'raudel', name: 'Raudel', keywords: ['final clean', 'touch'] },
].sort((a, b) => a.name.localeCompare(b.name));
const UNASSIGNED_FOREMAN = { id: 'unassigned', name: 'Unassigned', nameKey: 'common.unassigned' as const };

// Crew members loaded from Convex (see useQuery below)

// Helper: Get next business day (skip weekends)
function getNextBusinessDay(fromDate: Date): Date {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + 1);
  // If Friday (5), skip to Monday
  if (fromDate.getDay() === 5) {
    next.setDate(next.getDate() + 2);
  }
  return next;
}

// Helper: Get next business day (skip weekends)
const getNextDate = (current: string) => {
  const date = new Date(current);
  date.setDate(date.getDate() + 1);
  // Optional: Skip weekends if needed, but simple next day is standard nav
  return date.toISOString().split('T')[0];
};

const getPrevDate = (current: string) => {
  const date = new Date(current);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

// Helper: Get service-based row color
function getServiceRowColor(serviceName: string, isDispatched: boolean, isRescheduled: boolean, isComplete: boolean, isExtraWork?: boolean): string {
  if (isExtraWork) return 'bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500'; // Extra work / duplicate
  if (isComplete) return 'bg-slate-100/50 dark:bg-slate-800/50 border-l-4 border-slate-500 opacity-75'; // Completed: Slate + Opacity
  if (isDispatched) return 'bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500'; // Dispatched: Green
  if (isRescheduled) return 'bg-purple-100 dark:bg-purple-900/20';

  const lower = serviceName.toLowerCase();
  if (lower.includes('tub') || lower.includes('window')) return 'bg-green-50 dark:bg-green-900/10'; // Lighter green for specific services if not dispatched
  if (lower.includes('sweep')) return 'bg-orange-50 dark:bg-orange-900/20';
  if (lower.includes('power wash') || lower.includes('wash')) return 'bg-blue-50 dark:bg-blue-900/10';
  return 'bg-white dark:bg-slate-800';
}

type UpcomingJob = {
  id: string;
  startDate: string | null;
  builderName?: string | null;
  communityName?: string | null;
  lot?: string | null;
  contractorName?: string | null;
  serviceName?: string | null;
  jobNumber?: string | null;
  accountCategoryCode?: string | null;
  invoiceNumber?: string | null;
  amount?: string | null;
  status?: string | null;
  walkTime?: string | null;
  walk_time?: string | null;
  requestedBy?: string | null;
  assignedForemanName?: string | null;
  jobRequestServiceId?: string | null;
  originalStartDate?: string | null;
  isExtraWork?: boolean | null;
};

type DecoratedJob = UpcomingJob & {
  foremanId: string;
  foremanName: string;
  serviceDisplay: string;
};

type DraftAssignment = {
  id: string;
  crewId?: string | null;
};

type DispatchModalState = {
  isOpen: boolean;
  job: DecoratedJob | null;
  selectedForeman: string;
  selectedCrew: string;
};

type RescheduleModalState = {
  isOpen: boolean;
  job: DecoratedJob | null;
  selectedDate: string;
};

function resolveForemanForJob(job: UpcomingJob): ForemanConfig | typeof UNASSIGNED_FOREMAN {
  // First priority: Use the requestedBy field if it matches a foreman name
  if (job.requestedBy) {
    const requestedByLower = job.requestedBy.toLowerCase().trim();
    const byName = FOREMEN_DIRECTORY.find((foreman) =>
      foreman.name.toLowerCase() === requestedByLower ||
      foreman.id.toLowerCase() === requestedByLower
    );
    if (byName) return byName;
  }

  // Second priority: Match by service code
  const code = job.accountCategoryCode?.trim();
  if (code) {
    const byCode = FOREMEN_DIRECTORY.find((foreman) => foreman.codes?.includes(code));
    if (byCode) return byCode;
  }

  // Third priority: Match by service name keywords
  const serviceName = (job.serviceName ?? job.contractorName ?? '').toLowerCase();
  if (serviceName) {
    const byKeyword = FOREMEN_DIRECTORY.find((foreman) =>
      foreman.keywords?.some((keyword) => serviceName.includes(keyword))
    );
    if (byKeyword) return byKeyword;
  }

  return UNASSIGNED_FOREMAN;
}

export default function SchedulePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();

  // Fix for Hydration Mismatch: Initialize with empty string or stable value, then update on mount
  const [date, setDate] = useState('');
  useEffect(() => {
    // Set to local date on client side
    setDate(new Date().toISOString().split('T')[0]);
  }, []);
  const [dispatchModal, setDispatchModal] = useState<DispatchModalState>({
    isOpen: false,
    job: null,
    selectedForeman: '',
    selectedCrew: '',
  });
  const [rescheduleModal, setRescheduleModal] = useState<RescheduleModalState>({
    isOpen: false,
    job: null,
    selectedDate: '',
  });
  const [rescheduledJobs, setRescheduledJobs] = useState<Map<string, string>>(new Map()); // jobId -> new date
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'primary' | 'danger';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'primary',
  });

  // Convex mutations
  const assignForemanMutation = useMutation(api.mutations.assignForeman);
  const dispatchJobMutation = useMutation(api.mutations.dispatchJob);
  const rescheduleJobMutation = useMutation(api.mutations.rescheduleJob);
  const completeJobMutation = useMutation(api.assignmentFunctions.complete);

  // Handle inline foreman selection - persist to database (Convex reactivity updates UI automatically)
  const handleForemanChange = async (jobId: string, foremanName: string) => {
    try {
      await assignForemanMutation({ jobId: jobId as any, foremanName: foremanName || undefined });
    } catch (error) {
      console.error('Failed to save foreman assignment:', error);
    }
  };

  // Check if current user is a contractor (foreman/crew)
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  const scheduleRange = useMemo(() => {
    // Guard: If date is empty (initial render before useEffect), use today as fallback
    if (!date) {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }
    // Single day filter - show only jobs for the selected date
    const selectedDate = new Date(date);
    const dateStr = selectedDate.toISOString().split('T')[0];
    return {
      start: dateStr,
      end: dateStr, // Same day - strict single-day filter
    };
  }, [date]);

  // Convex queries - reactive, no need for SWR polling or cache invalidation
  const upcomingJobs = useQuery(api.queries.getScheduleJobs, date ? { startDate: scheduleRange.start, endDate: scheduleRange.end } : 'skip') ?? [];
  const crews = useQuery(api.queries.getCrews) ?? [];
  const crewNames = useMemo(() => crews.map((c: any) => c.name).sort(), [crews]);

  const decoratedJobs = useMemo<DecoratedJob[]>(
    () =>
      (upcomingJobs ?? []).map((job) => {
        const foreman = resolveForemanForJob(job as any);
        const serviceDisplay = job.serviceName
          ? (job as any).accountCategoryCode
            ? `${(job as any).accountCategoryCode} – ${job.serviceName}`
            : job.serviceName
          : (job as any).contractorName ?? '—';

        return {
          ...job,
          foremanId: foreman.id,
          foremanName: foreman.name,
          serviceDisplay,
        } as DecoratedJob;
      }),
    [upcomingJobs]
  );

  const foremanTabs = useMemo(() => {
    // If contractor, only show their own tab
    if (isContractor && session?.user?.name) {
      const userName = session.user.name;
      const myConfig = FOREMEN_DIRECTORY.find(f => f.name.toLowerCase() === userName.toLowerCase()) || { id: 'me', name: userName };
      const count = decoratedJobs.filter(job =>
        job.assignedForemanName?.toLowerCase() === userName.toLowerCase()
      ).length;
      return [{ id: myConfig.id, name: myConfig.name, count }];
    }

    // Single source of truth: assignedForemanName from database
    const counts: Record<string, number> = {};
    decoratedJobs.forEach((job) => {
      const assignedForeman = job.assignedForemanName;
      if (assignedForeman) {
        const foremanConfig = FOREMEN_DIRECTORY.find(f => f.name === assignedForeman);
        if (foremanConfig) {
          counts[foremanConfig.id] = (counts[foremanConfig.id] ?? 0) + 1;
        }
      } else {
        counts[UNASSIGNED_FOREMAN.id] = (counts[UNASSIGNED_FOREMAN.id] ?? 0) + 1;
      }
    });

    const orderedTabs = FOREMEN_DIRECTORY.map((foreman) => ({
      id: foreman.id,
      name: foreman.name,
      count: counts[foreman.id] ?? 0,
    }));

    if (!isContractor) {
      orderedTabs.push({
        id: UNASSIGNED_FOREMAN.id,
        name: UNASSIGNED_FOREMAN.name,
        count: counts[UNASSIGNED_FOREMAN.id] ?? 0,
      });
    }

    return orderedTabs;
  }, [decoratedJobs, isContractor, session?.user?.name]);

  const [activeForemanId, setActiveForemanId] = useState<string>('all');

  // Handle default tab for contractors
  useEffect(() => {
    if (isContractor && session?.user?.name && activeForemanId === 'all') {
      const userName = session.user.name;
      const myConfig = FOREMEN_DIRECTORY.find(f => f.name.toLowerCase() === userName.toLowerCase());
      if (myConfig) {
        setActiveForemanId(myConfig.id);
      }
    }
  }, [isContractor, session?.user?.name, activeForemanId]);

  useEffect(() => {
    if (activeForemanId === 'all') return;
    if (!foremanTabs.some((foreman) => foreman.id === activeForemanId)) {
      setActiveForemanId('all');
    }
  }, [activeForemanId, foremanTabs]);

  const visibleJobs = useMemo(() => {
    let jobs = decoratedJobs;

    // Filter by selected foreman tab — single source: assignedForemanName from DB
    if (activeForemanId !== 'all') {
      const selectedName = FOREMEN_DIRECTORY.find(f => f.id === activeForemanId)?.name;
      jobs = jobs.filter(job => {
        if (activeForemanId === 'unassigned') {
          return !job.assignedForemanName;
        }
        return job.assignedForemanName === selectedName;
      });
    }

    // For contractors, filter to only show jobs assigned to them
    if (isContractor && session?.user?.name) {
      const userName = session.user.name.toLowerCase();
      jobs = jobs.filter(job =>
        job.assignedForemanName?.toLowerCase() === userName
      );
    }

    // Sort by: 1) Foreman name, 2) walkTime ascending
    jobs = [...jobs].sort((a, b) => {
      const foremanA = (a.assignedForemanName || 'ZZZ Unassigned').toLowerCase();
      const foremanB = (b.assignedForemanName || 'ZZZ Unassigned').toLowerCase();
      if (foremanA !== foremanB) return foremanA.localeCompare(foremanB);
      const timeA = a.walkTime || a.walk_time || '23:59';
      const timeB = b.walkTime || b.walk_time || '23:59';
      return timeA.localeCompare(timeB);
    });

    return jobs;
  }, [activeForemanId, decoratedJobs, isContractor, session?.user?.name]);

  // Group jobs by community for display
  const jobsByCommunity = useMemo(() => {
    const grouped: Record<string, DecoratedJob[]> = {};
    visibleJobs.forEach((job) => {
      const community = job.communityName || 'Unknown';
      if (!grouped[community]) grouped[community] = [];
      grouped[community].push(job);
    });
    // Sort communities alphabetically
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleJobs]);

  const [dispatchSuccessCallback, setDispatchSuccessCallback] = useState<(() => void) | null>(null);

  const openDispatchModal = (job: DecoratedJob, onSuccess?: () => void) => {
    setDispatchSuccessCallback(() => onSuccess);
    setDispatchModal({
      isOpen: true,
      job,
      selectedForeman: '',
      selectedCrew: '',
    });
  };

  const closeDispatchModal = () => {
    setDispatchModal({ isOpen: false, job: null, selectedForeman: '', selectedCrew: '' });
    setDispatchSuccessCallback(null);
  };

  const handleDispatch = async () => {
    if (!dispatchModal.job || !dispatchModal.selectedCrew) {
      alert('Please select a crew member.');
      return;
    }
    // Get foreman from database (reactive via Convex)
    const foremanName = dispatchModal.job.assignedForemanName || 'Unassigned';
    try {
      await dispatchJobMutation({
        jobId: dispatchModal.job.id as any,
        foremanName,
        crewName: dispatchModal.selectedCrew,
        serviceDate: dispatchModal.job.startDate || '',
      });
      toast.success(`Job dispatched to ${dispatchModal.selectedCrew}!`);

      // Trigger optimistic update callback if present
      if (dispatchSuccessCallback) {
        dispatchSuccessCallback();
      }

      closeDispatchModal();
    } catch (error) {
      console.error('Failed to dispatch job', error);
      toast.error('Failed to dispatch job. Please try again.');
    }
  };

  const openRescheduleModal = (job: DecoratedJob) => {
    const nextDay = getNextBusinessDay(new Date());
    setRescheduleModal({
      isOpen: true,
      job,
      selectedDate: nextDay.toISOString().split('T')[0],
    });
  };

  const closeRescheduleModal = () => {
    setRescheduleModal({ isOpen: false, job: null, selectedDate: '' });
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleModal.job || !rescheduleModal.selectedDate) return;
    try {
      await rescheduleJobMutation({
        jobId: rescheduleModal.job.id as any,
        newDate: rescheduleModal.selectedDate,
      });
      closeRescheduleModal();
    } catch (error) {
      console.error('Failed to reschedule job', error);
      alert('Failed to reschedule job. Please try again.');
    }
  };

  const handleMarkComplete = async (jobId: string, currentStatus?: string) => {
    // Determine action based on current status (if available from UI) or assume COMPLETE
    const isComplete = currentStatus === 'COMPLETE';
    const action = isComplete ? 'mark as incomplete' : 'mark as complete';

    setConfirmModal({
      isOpen: true,
      title: isComplete ? 'Undo Completion' : 'Mark Job Complete',
      message: `Are you sure you want to ${action}?`,
      variant: isComplete ? 'primary' : 'primary', // Can use danger/warning if needed
      onConfirm: async () => {
        try {
          await completeJobMutation({ id: jobId as any });
        } catch (error) {
          console.error('Failed to toggle job completion', error);
          alert('Failed to update job status.');
        }
      },
    });
  };

  const handleAutoDraft = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Auto-Draft Schedule',
      message: 'This will automatically assign available crews to unassigned jobs for the next 14 days. Proceed?',
      variant: 'primary',
      onConfirm: async () => {
        try {
          // Auto-draft: assigns foremen to jobs based on rules
          // This feature will be re-implemented as a Convex action
          toast.info('Auto-draft is being migrated. Use manual assignment for now.');
        } catch (error) {
          console.error('Failed to auto-draft schedule', error);
        }
      },
    });
  };

  const handleApproveAndSend = async () => {
    try {
      // Approve-send: batch-approves all draft assignments
      // This feature will be re-implemented as a Convex action
      toast.info('Approve & Send is being migrated. Use individual dispatch for now.');
    } catch (error) {
      console.error('Failed to approve schedule', error);
      alert('Failed to approve assignments.');
    }
  };

  return (
    <>
      <PageHeader
        title={t('schedule.title')}
        description={t('schedule.description')}
        action={
          <div className="flex items-center gap-2">
            {!isContractor && (
              <button
                onClick={handleAutoDraft}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap text-sm font-medium transition-colors"
                title={t('schedule.autoDraft')}
              >
                {t('schedule.autoDraft')}
              </button>
            )}
            <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg border border-gray-300 dark:border-slate-600 p-1">
              <button
                onClick={() => setDate(getPrevDate(date))}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-300"
                title="Previous Day"
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
                onClick={() => setDate(getNextDate(date))}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-300"
                title="Next Day"
              >
                →
              </button>
            </div>
          </div>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('schedule.upcomingServices')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing start dates from {scheduleRange.start} to {scheduleRange.end}
              </p>
            </div>
            {!isContractor && (
              <Link
                href="/blue-book"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                {t('schedule.manageBlueBook')}
              </Link>
            )}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {!isContractor && (
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-sm transition ${activeForemanId === 'all'
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                onClick={() => setActiveForemanId('all')}
              >
                {t('schedule.allForemen')} ({decoratedJobs.length})
              </button>
            )}
            {foremanTabs.map((foreman) => (
              <button
                key={foreman.id}
                type="button"
                className={`rounded-full border px-4 py-2 text-sm transition ${activeForemanId === foreman.id
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                onClick={() => setActiveForemanId(foreman.id)}
              >
                {foreman.name} ({foreman.count})
              </button>
            ))}
          </div>
          {decoratedJobs.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">{t('schedule.noServices')}</p>
          ) : visibleJobs.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              {t('schedule.noServicesForForeman')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    {!isContractor && (
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('schedule.assignForeman')}</th>
                    )}
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.builder')}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.community')}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('schedule.service')}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.notes')}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                  {visibleJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isContractor={isContractor}
                      rescheduledDate={rescheduledJobs.get(job.id)}
                      selectedForemanName={job.assignedForemanName ?? undefined}
                      foremenDirectory={FOREMEN_DIRECTORY}
                      onForemanChange={handleForemanChange}
                      onDispatch={openDispatchModal}
                      onMarkComplete={handleMarkComplete}
                      onReschedule={openRescheduleModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Dispatch Modal */}
      <Transition appear show={dispatchModal.isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeDispatchModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="scale-95 opacity-0"
                enterTo="scale-100 opacity-100"
                leave="ease-in duration-150"
                leaveFrom="scale-100 opacity-100"
                leaveTo="scale-95 opacity-0"
              >
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white dark:bg-slate-800 p-6 shadow-2xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('schedule.dispatchJob')}
                  </Dialog.Title>

                  {dispatchModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                      <p><strong>{t('common.community')}:</strong> {getFriendlyName(dispatchModal.job.communityName || '')}</p>
                      <p><strong>{t('common.lot')}:</strong> {dispatchModal.job.lot || '—'}</p>
                      <p><strong>{t('common.service')}:</strong> {dispatchModal.job.serviceDisplay}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Show the assigned foreman (from table dropdown) */}
                    {dispatchModal.job && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>{t('schedule.assignedForeman')}:</strong>{' '}
                          {dispatchModal.job.assignedForemanName || t('schedule.notSelected')}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('schedule.selectCrewMember')}
                      </label>
                      <select
                        value={dispatchModal.selectedCrew}
                        onChange={(e) => setDispatchModal((prev) => ({ ...prev, selectedCrew: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('schedule.chooseCrewMember')}</option>
                        {crewNames.map((crew: string) => (
                          <option key={crew} value={crew}>{crew}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={closeDispatchModal}
                      className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleDispatch}
                      disabled={!dispatchModal.selectedCrew}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('schedule.dispatched')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Reschedule Modal */}
      <Transition appear show={rescheduleModal.isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeRescheduleModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="scale-95 opacity-0"
                enterTo="scale-100 opacity-100"
                leave="ease-in duration-150"
                leaveFrom="scale-100 opacity-100"
                leaveTo="scale-95 opacity-0"
              >
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white dark:bg-slate-800 p-6 shadow-2xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('schedule.rescheduleJob')}
                  </Dialog.Title>

                  {rescheduleModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                      <p><strong>{t('common.community')}:</strong> {getFriendlyName(rescheduleModal.job.communityName || '')}</p>
                      <p><strong>{t('common.lot')}:</strong> {rescheduleModal.job.lot || '—'}</p>
                      <p><strong>{t('common.service')}:</strong> {rescheduleModal.job.serviceDisplay}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('schedule.selectNewDate')}
                    </label>
                    <input
                      type="date"
                      value={rescheduleModal.selectedDate}
                      onChange={(e) => setRescheduleModal((prev) => ({ ...prev, selectedDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('schedule.nextBusinessDayHint')}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={closeRescheduleModal}
                      className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleRescheduleConfirm}
                      disabled={!rescheduleModal.selectedDate}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('schedule.confirmReschedule')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </>
  );
}
