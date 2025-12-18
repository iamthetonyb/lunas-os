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
function getServiceRowColor(serviceName: string, isDispatched: boolean, isRescheduled: boolean): string {
  if (isRescheduled) return 'bg-purple-100';
  const lower = serviceName.toLowerCase();
  if (lower.includes('tub') || lower.includes('window')) return 'bg-green-100';
  if (lower.includes('sweep')) return isDispatched ? 'bg-yellow-200' : 'bg-yellow-100';
  if (lower.includes('power wash') || lower.includes('wash')) return 'bg-blue-100';
  return 'bg-white';
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

  // Handle inline foreman selection - persist to database
  const handleForemanSelect = async (jobId: string, foremanName: string) => {
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
        const jobId = job.jobRequestServiceId || job.id;
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

    // Always show Unassigned tab
    orderedTabs.push({
      id: UNASSIGNED_FOREMAN.id,
      name: UNASSIGNED_FOREMAN.name,
      count: counts[UNASSIGNED_FOREMAN.id] ?? decoratedJobs.length, // Default all jobs to unassigned
    });

    return orderedTabs;
  }, [decoratedJobs, selectedForemenMap]);

  const [activeForemanId, setActiveForemanId] = useState<string>('all');

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
      closeRescheduleModal();
    } catch (error) {
      console.error('Failed to reschedule job', error);
      alert('Failed to reschedule job. Please try again.');
    }
  };

  const handleMarkComplete = async (jobId: string) => {
    try {
      await fetchJSON('/api/schedule/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      mutateAssignments();
    } catch (error) {
      console.error('Failed to mark job complete', error);
      alert('Failed to mark job complete. Please try again.');
    }
  };

  const handleAutoDraft = async () => {
    try {
      await fetchJSON(`/api/schedule/auto-draft?date=${date}`, {
        method: 'POST',
      });
      mutateAssignments();
    } catch (error) {
      console.error('Failed to auto-draft schedule', error);
      alert('Auto-draft failed. Please try again.');
    }
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
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleAutoDraft}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Auto-Draft
            </button>
          </div>
        }
      />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Services</h2>
              <p className="text-sm text-gray-500">
                Showing start dates from {scheduleRange.start} to {scheduleRange.end}
              </p>
            </div>
            <Link
              href="/blue-book"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Manage Blue Book →
            </Link>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm transition ${activeForemanId === 'all'
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                }`}
              onClick={() => setActiveForemanId('all')}
            >
              All Foremen ({decoratedJobs.length})
            </button>
            {foremanTabs.map((foreman) => (
              <button
                key={foreman.id}
                type="button"
                className={`rounded-full border px-4 py-2 text-sm transition ${activeForemanId === foreman.id
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                  }`}
                onClick={() => setActiveForemanId(foreman.id)}
              >
                {foreman.name} ({foreman.count})
              </button>
            ))}
          </div>
          {decoratedJobs.length === 0 ? (
            <p className="text-gray-600">No services scheduled in this window.</p>
          ) : visibleJobs.length === 0 ? (
            <p className="text-gray-600">
              No services scheduled for the selected foreman in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Assign Foreman</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Builder</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Community</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Services</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleJobs.map((job) => {
                    const foreman = job.foremanName || 'Unassigned Foreman';
                    const builder = job.builderName || '—';
                    const community = job.communityName || '—';
                    const serviceLabel = job.serviceDisplay || '—';

                    const serviceLower = serviceLabel.toLowerCase();
                    const isExtraService = serviceLower.includes('extra');
                    const isSweepService = serviceLower.includes('sweep');
                    const isPowerWashService = serviceLower.includes('power wash');

                    const walkTime = (job as { walkTime?: string | null; walk_time?: string | null })
                      .walkTime ?? (job as { walk_time?: string | null }).walk_time ?? null;
                    const rescheduledDate = rescheduledJobs.get(job.id);
                    const notesParts = [
                      job.lot ? `Lot ${job.lot}` : null,
                      walkTime ? `Walk ${walkTime}` : null,
                      rescheduledDate ? `Rescheduled to ${new Date(rescheduledDate).toLocaleDateString()}` : null,
                    ].filter(Boolean);
                    const notes = notesParts.join(' • ') || '—';

                    const startDateStamp = job.startDate
                      ? new Date(job.startDate).toLocaleDateString()
                      : null;

                    const isRescheduled = rescheduledJobs.has(job.id);
                    const rowColor = getServiceRowColor(serviceLabel, false, isRescheduled);

                    return (
                      <tr key={job.id} className={rowColor}>
                        <td className="px-4 py-2 text-sm">
                          {!isContractor ? (
                            <select
                              value={selectedForemenMap.get(job.id) || ''}
                              onChange={(e) => handleForemanSelect(job.id, e.target.value)}
                              className={`w-full px-2 py-1 border rounded text-sm ${selectedForemenMap.get(job.id) ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                            >
                              <option value="">Select Foreman...</option>
                              {FOREMEN_DIRECTORY.map((f) => (
                                <option key={f.id} value={f.name}>{f.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-gray-900">
                              {selectedForemenMap.get(job.id) || 'Not assigned'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{builder}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{getFriendlyName(community)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          <span className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium">
                            {serviceLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {startDateStamp && (
                            <span className="mr-2 inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {startDateStamp}
                            </span>
                          )}
                          {notes}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
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
                                onClick={() => handleMarkComplete(job.id)}
                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                title="Mark job complete"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              onClick={() => openRescheduleModal(job)}
                              className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                              disabled={isRescheduled}
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
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    Dispatch Job
                  </Dialog.Title>

                  {dispatchModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                      <p><strong>Community:</strong> {getFriendlyName(dispatchModal.job.communityName || '')}</p>
                      <p><strong>Lot:</strong> {dispatchModal.job.lot || '—'}</p>
                      <p><strong>Service:</strong> {dispatchModal.job.serviceDisplay}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Show the assigned foreman (from table dropdown) */}
                    {dispatchModal.job && (
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <p className="text-sm">
                          <strong>Assigned Foreman:</strong>{' '}
                          {selectedForemenMap.get(dispatchModal.job.id) || 'Not selected - use table dropdown first'}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Crew Member
                      </label>
                      <select
                        value={dispatchModal.selectedCrew}
                        onChange={(e) => setDispatchModal((prev) => ({ ...prev, selectedCrew: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    Reschedule Job
                  </Dialog.Title>

                  {rescheduleModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                      <p><strong>Community:</strong> {getFriendlyName(rescheduleModal.job.communityName || '')}</p>
                      <p><strong>Lot:</strong> {rescheduleModal.job.lot || '—'}</p>
                      <p><strong>Service:</strong> {rescheduleModal.job.serviceDisplay}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select New Date
                    </label>
                    <input
                      type="date"
                      value={rescheduleModal.selectedDate}
                      onChange={(e) => setRescheduleModal((prev) => ({ ...prev, selectedDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Next business day auto-selected. Change if needed.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={closeRescheduleModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
    </>
  );
}
