'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import { useState } from 'react';
import useSWR from 'swr';
import { ScheduleKanban } from '@/components/schedule-kanban';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SchedulePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: assignments, mutate } = useSWR('/api/assignments?status=DRAFT', fetcher);
  const { data: crews } = useSWR('/api/crews', fetcher);

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
    <AppLayout>
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
    </AppLayout>
  );
}
