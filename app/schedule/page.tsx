'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useEffect, useMemo, useState, Fragment } from 'react';
import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';
import { ScheduleKanban } from '@/components/schedule-kanban';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { getFriendlyName } from '@/lib/utils/community-display';
import { Dialog, Transition } from '@headlessui/react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useOrgRealtime } from '@/lib/realtime/use-org-realtime';

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

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
const UNASSIGNED_FOREMAN = { id: 'unassigned', name: 'Unassigned' };

// Full crew list for dispatch (sorted alphabetically)
const CREW_MEMBERS = [
  'Adriana', 'Alan', 'Alejandro', 'Alfonso', 'Anahi', 'Antonio M',
  'Arnulfo', 'Bicho', 'Blanca', 'Carmen', 'Chayo', 'Conchita',
  'Efren', 'Fernando', 'Francisco', 'Guillermo', 'Ignacio', 'Johnny',
  'Jose V', 'Kimberley', 'Letty', 'Luis D', 'Lupe', 'Lupe P',
  'Paco L', 'Paco M', 'Pancho', 'Ramon M', 'Raudel', 'Ricardo',
  'Rogelio', 'Sergio C', 'Sergio E', 'Susana', 'Yadira'
];

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

// Helper: Get service-based row color
function getServiceRowColor(serviceName: string, isDispatched: boolean, isRescheduled: boolean, isComplete: boolean): string {
  if (isComplete) return 'bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500'; // Highlight completed jobs
  if (isRescheduled) return 'bg-purple-100 dark:bg-purple-900/20';
  const lower = serviceName.toLowerCase();
  if (lower.includes('tub') || lower.includes('window')) return 'bg-green-100 dark:bg-green-900/20';
  if (lower.includes('sweep')) return isDispatched ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-orange-50 dark:bg-orange-900/20';
  if (lower.includes('power wash') || lower.includes('wash')) return 'bg-blue-100 dark:bg-blue-900/20';
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
  const { data: session } = useSession();
  const orgId = (session?.user as any)?.orgId;
  useOrgRealtime(orgId);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
  const [selectedForemenMap, setSelectedForemenMap] = useState<Map<string, string>>(new Map()); // jobId -> foremanName
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

  // Handle inline foreman selection - persist to database
  const handleForemanChange = async (jobId: string, foremanName: string) => {
    // Update local state immediately for responsive UI
    setSelectedForemenMap(prev => {
      const newMap = new Map(prev);
      if (foremanName === '') {
        newMap.delete(jobId);
      } else {
        newMap.set(jobId, foremanName);
      }
      return newMap;
    });

    // Persist to database
    try {
      await fetchJSON('/api/schedule/assign-foreman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, foremanName: foremanName || null }),
      });
      // Refresh data to ensure consistency
      mutateAssignments();
    } catch (error) {
      console.error('Failed to save foreman assignment:', error);
    }
  };

  // Check if current user is a contractor (foreman/crew)
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  const { data: assignments, mutate: mutateAssignments } = useSWR<DraftAssignment[]>(
    '/api/assignments?status=DRAFT',
    fetcher
  );
  const { data: crews } = useSWR<any[]>('/api/crews', fetcher);
  const scheduleRange = useMemo(() => {
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, [date]);

  const { data: upcomingJobs = [] } = useSWR<UpcomingJob[]>(
    `/api/schedule/blue-book?start=${scheduleRange.start}&end=${scheduleRange.end}`,
    fetcher
  );

  // Initialize foreman map from saved data when jobs load
  useEffect(() => {
    if (upcomingJobs && upcomingJobs.length > 0) {
      const initialMap = new Map<string, string>();
      upcomingJobs.forEach((job) => {
        const jobId = job.id; // Use the same ID consistently
        if (job.assignedForemanName) {
          initialMap.set(jobId, job.assignedForemanName);
        }
      });
      if (initialMap.size > 0) {
        setSelectedForemenMap(initialMap);
      }
    }
  }, [upcomingJobs]);

  const decoratedJobs = useMemo<DecoratedJob[]>(
    () =>
      (upcomingJobs ?? []).map((job) => {
        const foreman = resolveForemanForJob(job);
        const serviceDisplay = job.serviceName
          ? job.accountCategoryCode
            ? `${job.accountCategoryCode} – ${job.serviceName}`
            : job.serviceName
          : job.contractorName ?? '—';

        return {
          ...job,
          foremanId: foreman.id,
          foremanName: foreman.name,
          serviceDisplay,
        };
      }),
    [upcomingJobs]
  );

  const foremanTabs = useMemo(() => {
    // If contractor, only show their own tab
    if (isContractor && session?.user?.name) {
      const userName = session.user.name;
      const myConfig = FOREMEN_DIRECTORY.find(f => f.name.toLowerCase() === userName.toLowerCase()) || { id: 'me', name: userName };

      // Find count for this contractor
      const count = decoratedJobs.filter(job => {
        const assigned = selectedForemenMap.get(job.id);
        return assigned?.toLowerCase() === userName.toLowerCase();
      }).length;

      return [{ id: myConfig.id, name: myConfig.name, count }];
    }

    // Count jobs that have been manually assigned vs unassigned
    const counts: Record<string, number> = {};
    decoratedJobs.forEach((job) => {
      const assignedForeman = selectedForemenMap.get(job.id);
      if (assignedForeman) {
        // Find the foreman id by name
        const foremanConfig = FOREMEN_DIRECTORY.find(f => f.name === assignedForeman);
        if (foremanConfig) {
          counts[foremanConfig.id] = (counts[foremanConfig.id] ?? 0) + 1;
        }
      } else {
        // Job is unassigned
        counts[UNASSIGNED_FOREMAN.id] = (counts[UNASSIGNED_FOREMAN.id] ?? 0) + 1;
      }
    });

    const orderedTabs = FOREMEN_DIRECTORY.map((foreman) => ({
      id: foreman.id,
      name: foreman.name,
      count: counts[foreman.id] ?? 0,
    }));

    // Always show Unassigned tab (for non-contractors)
    if (!isContractor) {
      orderedTabs.push({
        id: UNASSIGNED_FOREMAN.id,
        name: UNASSIGNED_FOREMAN.name,
        count: counts[UNASSIGNED_FOREMAN.id] ?? decoratedJobs.length,
      });
    }

    return orderedTabs;
  }, [decoratedJobs, selectedForemenMap, isContractor, session?.user?.name]);

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

    // Filter by selected foreman tab
    if (activeForemanId !== 'all') {
      if (activeForemanId === UNASSIGNED_FOREMAN.id) {
        // Show jobs that haven't been manually assigned
        jobs = jobs.filter(job => !selectedForemenMap.get(job.id));
      } else {
        // Show jobs assigned to the selected foreman
        const selectedForemanName = FOREMEN_DIRECTORY.find(f => f.id === activeForemanId)?.name;
        jobs = jobs.filter(job => selectedForemenMap.get(job.id) === selectedForemanName);
      }
    }

    // For contractors, filter to only show jobs assigned to them
    if (isContractor && session?.user?.name) {
      const userName = session.user.name.toLowerCase();
      jobs = jobs.filter(job => {
        const assignedForeman = selectedForemenMap.get(job.id);
        return assignedForeman?.toLowerCase() === userName;
      });
    }


    return jobs;
  }, [activeForemanId, decoratedJobs, isContractor, session?.user?.name, selectedForemenMap]);

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

  const openDispatchModal = (job: DecoratedJob) => {
    setDispatchModal({
      isOpen: true,
      job,
      selectedForeman: '',
      selectedCrew: '',
    });
  };

  const closeDispatchModal = () => {
    setDispatchModal({ isOpen: false, job: null, selectedForeman: '', selectedCrew: '' });
  };

  const handleDispatch = async () => {
    if (!dispatchModal.job || !dispatchModal.selectedCrew) {
      alert('Please select a crew member.');
      return;
    }
    // Get foreman from the inline table selector
    const foremanName = selectedForemenMap.get(dispatchModal.job.id) || 'Unassigned';
    try {
      await fetchJSON('/api/schedule/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: dispatchModal.job.id,
          foremanName: foremanName,
          crewName: dispatchModal.selectedCrew,
        }),
      });
      mutateAssignments();
      closeDispatchModal();
    } catch (error) {
      console.error('Failed to dispatch job', error);
      alert('Failed to dispatch job. Please try again.');
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
      await fetchJSON('/api/schedule/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: rescheduleModal.job.id, newDate: rescheduleModal.selectedDate }),
      });
      setRescheduledJobs((prev) => new Map(prev).set(rescheduleModal.job!.id, rescheduleModal.selectedDate));
      mutateAssignments();
      mutate(`/api/schedule/blue-book?start=${scheduleRange.start}&end=${scheduleRange.end}`);
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
          await fetchJSON('/api/schedule/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
          });
          mutateAssignments();
          mutate(`/api/schedule/blue-book?start=${scheduleRange.start}&end=${scheduleRange.end}`);
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
          await fetchJSON(`/api/schedule/auto-draft?date=${date}`, {
            method: 'POST',
          });
          mutateAssignments();
        } catch (error) {
          console.error('Failed to auto-draft schedule', error);
        }
      },
    });
  };

  const handleApproveAndSend = async () => {
    const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);
    try {
      await fetchJSON('/api/schedule/approve-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignmentIds }),
      });
      mutateAssignments();
    } catch (error) {
      console.error('Failed to approve schedule', error);
      alert('Failed to approve assignments.');
    }
  };

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Manage job scheduling and crew assignments"
        action={
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
            {!isContractor && (
              <button
                onClick={handleAutoDraft}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Auto-Draft
              </button>
            )}
          </div>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Services</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing start dates from {scheduleRange.start} to {scheduleRange.end}
              </p>
            </div>
            {!isContractor && (
              <Link
                href="/blue-book"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Manage Blue Book →
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
                All Foremen ({decoratedJobs.length})
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
            <p className="text-gray-600 dark:text-gray-400">No services scheduled in this window.</p>
          ) : visibleJobs.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              No services scheduled for the selected foreman in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    {!isContractor && (
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Assign Foreman</th>
                    )}
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Builder</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Community</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Services</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                  {visibleJobs.map((job) => {
                    const foreman = job.foremanName || 'Unassigned Foreman';
                    const builder = job.builderName || '—';
                    const community = job.communityName || '—';
                    const serviceLabel = job.serviceDisplay || '—';

                    const serviceLower = serviceLabel.toLowerCase();
                    const isExtraService = serviceLower.includes('extra');
                    const isSweepService = serviceLower.includes('sweep');
                    const isPowerWashService = serviceLower.includes('power wash');

                    const formatTime = (timeStr: string | null) => {
                      if (!timeStr) return null;
                      // Expecting "HH:mm" or "HH:mm:ss"
                      // We want "H:mm" (e.g. "9:00", "10:00")
                      // If it is 24 hour: "14:00" -> "14:00" (User didn't specify AM/PM preference, just "top of hour")
                      // But usually user wants "9:00" not "09:00"
                      const [h, m] = timeStr.split(':');
                      if (!h) return timeStr;
                      return `${parseInt(h, 10)}:${m || '00'}`;
                    };

                    const rawWalkTime = (job as { walkTime?: string | null; walk_time?: string | null })
                      .walkTime ?? (job as { walk_time?: string | null }).walk_time ?? null;
                    const walkTime = formatTime(rawWalkTime);
                    // Date display fix: Use manual slice to avoid timezone shift
                    const formatDisplayDate = (dateStr: string | null) => {
                      if (!dateStr) return null;
                      // dateStr is likely "YYYY-MM-DD"
                      const [year, month, day] = dateStr.split('-');
                      if (!year || !month || !day) return dateStr;
                      return `${month}/${day}/${year}`;
                    };

                    const rescheduledDate = rescheduledJobs.get(job.id);
                    const originalDate = job.originalStartDate;

                    const notesParts = [
                      job.lot ? `Lot ${job.lot}` : null,
                      walkTime ? `Walk ${walkTime}` : null,
                      originalDate && originalDate !== job.startDate ? `Original Date: ${formatDisplayDate(originalDate)}` : null,
                      rescheduledDate ? `Rescheduled to ${formatDisplayDate(rescheduledDate)}` : null,
                    ].filter(Boolean);
                    const notes = notesParts.join(' • ') || '—';

                    const startDateStamp = job.startDate
                      ? formatDisplayDate(job.startDate)
                      : null;


                    const isRescheduled = rescheduledJobs.has(job.id);
                    const isComplete = job.status === 'COMPLETE';
                    const rowColor = getServiceRowColor(serviceLabel, false, isRescheduled, isComplete);

                    return (
                      <tr key={job.id} className={rowColor}>
                        {!isContractor && (
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-300">
                            {!isContractor && !job.id.includes('-') ? (
                              <select
                                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-slate-700 dark:text-white dark:ring-slate-600"
                                value={selectedForemenMap.get(job.id) || ''}
                                onChange={(e) => handleForemanChange(job.id, e.target.value)}
                              >
                                <option value="">Select Foreman...</option>
                                {FOREMEN_DIRECTORY.map((f) => (
                                  <option key={f.id} value={f.name}>{f.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-medium text-gray-900 dark:text-white">
                                {selectedForemenMap.get(job.jobRequestServiceId || job.id) || 'Not assigned'}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{builder}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{getFriendlyName(community)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          <span className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium">
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
                              /* Admin view: Dispatch to button */
                              <button
                                onClick={() => openDispatchModal(job)}
                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                              >
                                Dispatch to
                              </button>
                            ) : (
                              /* Contractor view: Green checkmark for job done */
                              <button
                                onClick={() => handleMarkComplete(job.id, job.status || 'PENDING')}
                                className={`px-2 py-1 text-xs rounded hover:opacity-90 ${isComplete ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'}`}
                                title={isComplete ? "Mark as incomplete" : "Mark job complete"}
                              >
                                {isComplete ? '↩' : '✓'}
                              </button>
                            )}

                            {/* Reschedule button - visible to everyone */}
                            <button
                              onClick={() => openRescheduleModal(job)}
                              className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                            >
                              Reschedule
                            </button>
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
                    Dispatch Job
                  </Dialog.Title>

                  {dispatchModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                      <p><strong>Community:</strong> {getFriendlyName(dispatchModal.job.communityName || '')}</p>
                      <p><strong>Lot:</strong> {dispatchModal.job.lot || '—'}</p>
                      <p><strong>Service:</strong> {dispatchModal.job.serviceDisplay}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Show the assigned foreman (from table dropdown) */}
                    {dispatchModal.job && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>Assigned Foreman:</strong>{' '}
                          {selectedForemenMap.get(dispatchModal.job.id) || 'Not selected - use table dropdown first'}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Crew Member
                      </label>
                      <select
                        value={dispatchModal.selectedCrew}
                        onChange={(e) => setDispatchModal((prev) => ({ ...prev, selectedCrew: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Choose crew member...</option>
                        {CREW_MEMBERS.map((crew) => (
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
                      Cancel
                    </button>
                    <button
                      onClick={handleDispatch}
                      disabled={!dispatchModal.selectedCrew}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Dispatch
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
                    Reschedule Job
                  </Dialog.Title>

                  {rescheduleModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-900 dark:text-gray-100">
                      <p><strong>Community:</strong> {getFriendlyName(rescheduleModal.job.communityName || '')}</p>
                      <p><strong>Lot:</strong> {rescheduleModal.job.lot || '—'}</p>
                      <p><strong>Service:</strong> {rescheduleModal.job.serviceDisplay}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select New Date
                    </label>
                    <input
                      type="date"
                      value={rescheduleModal.selectedDate}
                      onChange={(e) => setRescheduleModal((prev) => ({ ...prev, selectedDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Next business day auto-selected. Change if needed.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={closeRescheduleModal}
                      className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRescheduleConfirm}
                      disabled={!rescheduleModal.selectedDate}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Reschedule
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
