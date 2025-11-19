'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { ScheduleKanban } from '@/components/schedule-kanban';
import { fetchJSON } from '@/lib/utils/fetch-json';

const fetcher = <T,>(url: string) => fetchJSON<T>(url);

type ForemanConfig = {
  id: string;
  name: string;
  codes?: string[];
  keywords?: string[];
};

const FOREMEN_DIRECTORY: ForemanConfig[] = [
  { id: 'anahi', name: 'Anahi', codes: ['22702'], keywords: ['sweep'] },
  { id: 'chayo', name: 'Chayo', codes: ['22712'], keywords: ['tubs', 'windows', 'q/a'] },
  { id: 'blanca', name: 'Blanca', keywords: ['power wash', 'wash'] },
  { id: 'raudel', name: 'Raudel', keywords: ['final clean', 'touch'] },
  { id: 'francisco', name: 'Francisco', keywords: ['extra', 'service'] },
];
const UNASSIGNED_FOREMAN = { id: 'unassigned', name: 'Unassigned' };

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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: assignments, mutate } = useSWR<DraftAssignment[]>(
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
    const counts: Record<string, number> = {};
    decoratedJobs.forEach((job) => {
      counts[job.foremanId] = (counts[job.foremanId] ?? 0) + 1;
    });

    const orderedTabs = FOREMEN_DIRECTORY.map((foreman) => ({
      id: foreman.id,
      name: foreman.name,
      count: counts[foreman.id] ?? 0,
    }));

    const unassignedCount = counts[UNASSIGNED_FOREMAN.id] ?? 0;
    if (unassignedCount > 0) {
      orderedTabs.push({
        id: UNASSIGNED_FOREMAN.id,
        name: UNASSIGNED_FOREMAN.name,
        count: unassignedCount,
      });
    }

    return orderedTabs;
  }, [decoratedJobs]);

  const [activeForemanId, setActiveForemanId] = useState<string>('all');

  useEffect(() => {
    if (activeForemanId === 'all') return;
    if (!foremanTabs.some((foreman) => foreman.id === activeForemanId)) {
      setActiveForemanId('all');
    }
  }, [activeForemanId, foremanTabs]);

  const visibleJobs = useMemo(() => {
    if (activeForemanId === 'all') return decoratedJobs;
    return decoratedJobs.filter((job) => job.foremanId === activeForemanId);
  }, [activeForemanId, decoratedJobs]);

  const handleAutoDraft = async () => {
    try {
      await fetchJSON(`/api/schedule/auto-draft?date=${date}`, {
        method: 'POST',
      });
      mutate();
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
      mutate();
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
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeForemanId === 'all'
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
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeForemanId === foreman.id
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
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Foreman</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Builder</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Community</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Services</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
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
                    const notesParts = [
                      job.lot ? `Lot ${job.lot}` : null,
                      walkTime ? `Walk ${walkTime}` : null,
                    ].filter(Boolean);
                    const notes = notesParts.join(' • ') || '—';

                    const startDateStamp = job.startDate
                      ? new Date(job.startDate).toLocaleDateString()
                      : null;

                    const serviceClasses = [
                      'inline-flex items-center rounded-md px-3 py-1 text-sm font-medium transition',
                      isPowerWashService
                        ? 'bg-blue-100 text-blue-800'
                        : isSweepService
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800',
                      isExtraService ? 'text-red-600' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <tr key={job.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{foreman}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{builder}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{community}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          <span className={serviceClasses}>{serviceLabel}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {startDateStamp && (
                            <span className="mr-2 inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {startDateStamp}
                            </span>
                          )}
                          {notes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Draft Assignments</h2>
            <button 
              onClick={handleApproveAndSend} 
              disabled={!assignments || assignments.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve & Send
            </button>
          </div>
          {crews && assignments ? (
            <ScheduleKanban crews={crews} assignments={assignments} />
          ) : (
            <p className="text-gray-600">Loading schedule...</p>
          )}
        </div>
      </main>
    </>
  );
}
