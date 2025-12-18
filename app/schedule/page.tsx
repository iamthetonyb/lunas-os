'use client';

import { Fragment, useMemo, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Dialog, Transition } from '@headlessui/react';
import { PageHeader } from '@/components/page-header';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

// Foreman directory for dropdown options
const FOREMEN_DIRECTORY = [
  { id: 'anahi', name: 'Anahi' },
  { id: 'blanca', name: 'Blanca' },
  { id: 'chayo', name: 'Chayo' },
  { id: 'francisco', name: 'Francisco' },
  { id: 'raudel', name: 'Raudel' },
];

const CREW_MEMBERS = ['Crew A', 'Crew B', 'Crew C', 'Crew D', 'Crew E'];

const UNASSIGNED_FOREMAN = { id: 'unassigned', name: 'Unassigned' };

// Helper to get friendly community name
function getFriendlyName(name: string): string {
  return name || 'Unknown Community';
}

// Get next business day
function getNextBusinessDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

type DispatchModalState = {
  isOpen: boolean;
  job: any | null;
  selectedCrew: string;
};

type RescheduleModalState = {
  isOpen: boolean;
  job: any | null;
  selectedDate: string;
  reason: string;
};

export default function SchedulePage() {
  const { data: session } = useSession();
  const isContractor = session?.user?.role === 'FOREMAN' || session?.user?.role === 'CREW';

  // Date range for schedule
  const [date] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const scheduleRange = useMemo(() => {
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, [date]);

  // Real-time Convex queries
  const jobs = useQuery(api.queries.getScheduleJobs, {
    startDate: scheduleRange.start,
    endDate: scheduleRange.end,
  });

  // Convex mutations
  const assignForemanMutation = useMutation(api.mutations.assignForeman);
  const rescheduleJobMutation = useMutation(api.mutations.rescheduleJob);
  const dispatchJobMutation = useMutation(api.mutations.dispatchJob);

  // Local state
  const [dispatchModal, setDispatchModal] = useState<DispatchModalState>({
    isOpen: false,
    job: null,
    selectedCrew: '',
  });

  const [rescheduleModal, setRescheduleModal] = useState<RescheduleModalState>({
    isOpen: false,
    job: null,
    selectedDate: '',
    reason: '',
  });

  const [activeForemanId, setActiveForemanId] = useState<string>('all');

  // Handle foreman selection - instant real-time sync
  const handleForemanSelect = async (jobId: Id<"jobRequestServices">, foremanName: string) => {
    try {
      await assignForemanMutation({
        jobId,
        foremanName: foremanName || undefined
      });
    } catch (error) {
      console.error('Failed to assign foreman:', error);
    }
  };

  // Calculate foreman tabs from live data
  const foremanTabs = useMemo(() => {
    if (!jobs) return [];

    const counts: Record<string, number> = {};
    jobs.forEach((job) => {
      if (job.assignedForemanName) {
        const foreman = FOREMEN_DIRECTORY.find(f => f.name === job.assignedForemanName);
        if (foreman) {
          counts[foreman.id] = (counts[foreman.id] ?? 0) + 1;
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

    orderedTabs.push({
      id: UNASSIGNED_FOREMAN.id,
      name: UNASSIGNED_FOREMAN.name,
      count: counts[UNASSIGNED_FOREMAN.id] ?? (jobs?.length || 0),
    });

    return orderedTabs;
  }, [jobs]);

  // Filter jobs by active foreman tab
  const visibleJobs = useMemo(() => {
    if (!jobs) return [];
    let filtered = jobs;

    if (activeForemanId !== 'all') {
      if (activeForemanId === UNASSIGNED_FOREMAN.id) {
        filtered = filtered.filter(job => !job.assignedForemanName);
      } else {
        const foremanName = FOREMEN_DIRECTORY.find(f => f.id === activeForemanId)?.name;
        filtered = filtered.filter(job => job.assignedForemanName === foremanName);
      }
    }

    // For contractors, show only their jobs
    if (isContractor && session?.user?.name) {
      const userName = session.user.name.toLowerCase();
      filtered = filtered.filter(job =>
        job.assignedForemanName?.toLowerCase() === userName
      );
    }

    return filtered;
  }, [jobs, activeForemanId, isContractor, session?.user?.name]);

  // Group jobs by community
  const groupedByCommunity = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    visibleJobs.forEach((job) => {
      const community = job.communityName || 'Unknown';
      if (!grouped[community]) grouped[community] = [];
      grouped[community].push(job);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleJobs]);

  // Modal handlers
  const openDispatchModal = (job: any) => {
    setDispatchModal({ isOpen: true, job, selectedCrew: '' });
  };

  const closeDispatchModal = () => {
    setDispatchModal({ isOpen: false, job: null, selectedCrew: '' });
  };

  const handleDispatch = async () => {
    if (!dispatchModal.job || !dispatchModal.selectedCrew) {
      alert('Please select a crew member.');
      return;
    }

    try {
      await dispatchJobMutation({
        jobId: dispatchModal.job.id,
        foremanName: dispatchModal.job.assignedForemanName || 'Unassigned',
        crewName: dispatchModal.selectedCrew,
        serviceDate: dispatchModal.job.startDate || new Date().toISOString().split('T')[0],
      });
      closeDispatchModal();
    } catch (error) {
      console.error('Failed to dispatch job:', error);
      alert('Failed to dispatch job. Please try again.');
    }
  };

  const openRescheduleModal = (job: any) => {
    const nextDay = getNextBusinessDay(new Date());
    setRescheduleModal({
      isOpen: true,
      job,
      selectedDate: nextDay.toISOString().split('T')[0],
      reason: '',
    });
  };

  const closeRescheduleModal = () => {
    setRescheduleModal({ isOpen: false, job: null, selectedDate: '', reason: '' });
  };

  const handleReschedule = async () => {
    if (!rescheduleModal.job || !rescheduleModal.selectedDate) {
      alert('Please select a date.');
      return;
    }

    try {
      await rescheduleJobMutation({
        jobId: rescheduleModal.job.id,
        newDate: rescheduleModal.selectedDate,
        reason: rescheduleModal.reason || undefined,
      });
      closeRescheduleModal();
    } catch (error) {
      console.error('Failed to reschedule job:', error);
      alert('Failed to reschedule. Please try again.');
    }
  };

  if (!jobs) {
    return (
      <>
        <PageHeader title="Schedule" description="Loading..." />
        <main className="px-6 py-6">
          <div className="animate-pulse bg-gray-100 rounded-lg h-64"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Schedule"
        description={isContractor ? 'Your assigned jobs' : 'Manage job scheduling and dispatch (Real-time)'}
      />
      <main className="px-6 py-6 space-y-6">
        {/* Foreman Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveForemanId('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${activeForemanId === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All ({jobs.length})
          </button>
          {foremanTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveForemanId(tab.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${activeForemanId === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {tab.name} ({tab.count})
            </button>
          ))}
        </div>

        {/* Jobs Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {visibleJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No jobs found for this view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Walk Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foreman</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {getFriendlyName(job.communityName || '')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{job.lot || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{job.serviceName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{job.walkTime || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {job.rescheduledDate ? (
                          <span className="text-purple-600 font-medium">
                            {job.rescheduledDate} (rescheduled)
                          </span>
                        ) : (
                          job.startDate || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!isContractor ? (
                          <select
                            value={job.assignedForemanName || ''}
                            onChange={(e) => handleForemanSelect(job.id, e.target.value)}
                            className={`w-full px-2 py-1 border rounded text-sm ${job.assignedForemanName
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300'
                              }`}
                          >
                            <option value="">Select Foreman...</option>
                            {FOREMEN_DIRECTORY.map((f) => (
                              <option key={f.id} value={f.name}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-medium text-gray-900">
                            {job.assignedForemanName || 'Not assigned'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${job.status === 'DISPATCHED'
                              ? 'bg-blue-100 text-blue-800'
                              : job.status === 'COMPLETE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openDispatchModal(job)}
                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            disabled={job.status === 'DISPATCHED'}
                          >
                            Dispatch
                          </button>
                          <button
                            onClick={() => openRescheduleModal(job)}
                            className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                          >
                            Reschedule
                          </button>
                        </div>
                      </td>
                    </tr>
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
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    Dispatch Job
                  </Dialog.Title>

                  {dispatchModal.job && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                      <p><strong>Community:</strong> {getFriendlyName(dispatchModal.job.communityName || '')}</p>
                      <p><strong>Lot:</strong> {dispatchModal.job.lot || '—'}</p>
                      <p><strong>Service:</strong> {dispatchModal.job.serviceName || '—'}</p>
                      <p><strong>Assigned Foreman:</strong> {dispatchModal.job.assignedForemanName || 'Not selected'}</p>
                    </div>
                  )}

                  <div className="space-y-4">
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
                      <p><strong>Current Date:</strong> {rescheduleModal.job.startDate || '—'}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Date
                      </label>
                      <input
                        type="date"
                        value={rescheduleModal.selectedDate}
                        onChange={(e) => setRescheduleModal((prev) => ({ ...prev, selectedDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason (optional)
                      </label>
                      <textarea
                        value={rescheduleModal.reason}
                        onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reason: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        rows={2}
                        placeholder="Why is this being rescheduled?"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={closeRescheduleModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={!rescheduleModal.selectedDate}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reschedule
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
