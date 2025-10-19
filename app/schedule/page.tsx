'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ScheduleKanban } from '@/components/schedule-kanban';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SchedulePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: assignments, mutate } = useSWR('/api/assignments?status=DRAFT', fetcher);
  const { data: crews } = useSWR('/api/crews', fetcher);
  const scheduleRange = useMemo(() => {
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, [date]);

  const { data: upcomingJobs = [] } = useSWR(
    `/api/schedule/blue-book?start=${scheduleRange.start}&end=${scheduleRange.end}`,
    fetcher
  );

  const handleAutoDraft = async () => {
    await fetch(`/api/schedule/auto-draft?date=${date}`, {
      method: 'POST',
    });
    mutate();
  };

  const handleApproveAndSend = async () => {
    const assignmentIds = assignments?.map((a: any) => a.id) || [];
    await fetch('/api/schedule/approve-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assignmentIds }),
    });
    mutate();
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
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Jobs</h2>
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
          {upcomingJobs.length === 0 ? (
            <p className="text-gray-600">No jobs scheduled in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Contractor</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Builder</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Community</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Job</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {upcomingJobs.map((job: any) => {
                    const contractor = job.contractorName || job.serviceName || '—';
                    const builder = job.builderName || '—';
                    const community = job.communityName || '—';
                    const jobLabel = job.jobNumber || job.invoiceNumber || job.lot || '—';
                    const notesParts = [
                      job.lot ? `Lot ${job.lot}` : null,
                      job.startDate ? `Start ${new Date(job.startDate).toLocaleDateString()}` : null,
                    ].filter(Boolean);
                    const notes = notesParts.join(' • ') || '—';

                    return (
                      <tr key={job.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{contractor}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{builder}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{community}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{jobLabel}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{notes}</td>
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
