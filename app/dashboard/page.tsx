'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';

const fetcher = async <T,>(url: string) => {
  try {
    return await fetchJSON<T>(url);
  } catch (err) {
    console.error('Fetch error:', err);
    return [] as T;
  }
};

type RecentIntake = {
  id: string;
  builderName: string;
  communityName: string;
  lot: string;
  modelPlanName: string;
  dueDate: string | null;
  createdAt: string | null;
  services: string[];
};

export default function DashboardPage() {
  // Fetch current user membership to check role
  const { data: membership } = useSWR<{ userId: string; orgId: string; role: string } | null>('/api/me', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  // Only fetch blue book if user is admin or backoffice
  const canAccessBlueBook = membership?.role === 'admin' || membership?.role === 'backoffice';

  const { data: blueBookEntries = [] } = useSWR<any[]>(
    canAccessBlueBook ? '/api/blue-book' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
  const { data: recentIntakes = [] } = useSWR<RecentIntake[]>(
    '/api/job-requests/recent',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  // Fetch dispatch batches for scheduled count
  const { data: dispatchBatches = [] } = useSWR<any[]>(
    '/api/dispatch-batches',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  // Fetch my upcoming jobs (for contractors)
  const { data: myAssignments = [] } = useSWR<any[]>(
    membership?.role === 'FOREMAN' || membership?.role === 'CREW' ? '/api/users/me/assignments' : null,
    fetcher
  );

  // Calculate dynamic stats
  const activeJobCount = blueBookEntries.filter((e: any) => e.status !== 'COMPLETE').length;
  const pendingIntakeCount = recentIntakes.length;
  const scheduledTodayCount = dispatchBatches.filter((b: any) => {
    const today = new Date().toISOString().split('T')[0];
    return b.serviceDate === today && b.status === 'SENT';
  }).length;

  const stats = [
    { name: 'Active Jobs', value: activeJobCount.toString(), change: activeJobCount > 0 ? `+${activeJobCount}` : '0', icon: '📋' },
    { name: 'Pending Intakes', value: pendingIntakeCount.toString(), change: pendingIntakeCount > 0 ? `+${pendingIntakeCount}` : '0', icon: '📝' },
    { name: 'Scheduled Today', value: scheduledTodayCount.toString(), change: '0', icon: '📅' },
    { name: 'Dispatch Batches', value: dispatchBatches.length.toString(), change: dispatchBatches.length > 0 ? `+${dispatchBatches.length}` : '0', icon: '🚀' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome to Lunas OS - Construction Cleanup Management"
      />

      <main className="px-6 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${stat.change.startsWith('+') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                  }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Blue Book Snapshot and Recent Intakes - Layout depends on user role */}
        <div className={`grid grid-cols-1 ${canAccessBlueBook ? 'lg:grid-cols-3' : ''} gap-6 mb-8`}>
          {/* Blue Book Info Card - Only for admin/backoffice */}
          {canAccessBlueBook && (
            <div className="lg:col-span-1">
              {/* ... existing blue book card content ... */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">📘 Blue Book</h2>
                  <Link
                    href="/blue-book"
                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors backdrop-blur-sm"
                  >
                    View All →
                  </Link>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm opacity-90 mb-1">Total Jobs</p>
                    <p className="text-3xl font-bold">{blueBookEntries.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm opacity-90 mb-1">Active</p>
                    <p className="text-2xl font-bold">
                      {blueBookEntries.filter((e: any) => e.status !== 'COMPLETE').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm opacity-90 mb-1">Completed</p>
                    <p className="text-2xl font-bold">
                      {blueBookEntries.filter((e: any) => e.status === 'COMPLETE').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* My Upcoming Meetings - Only for Contractors */}
          {!canAccessBlueBook && (
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 dark:from-indigo-600 dark:to-indigo-900 rounded-lg shadow-lg p-6 text-white h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">📅 My Upcoming Schedule</h2>
                  <Link
                    href="/schedule"
                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors backdrop-blur-sm"
                  >
                    View Full Schedule →
                  </Link>
                </div>
                {myAssignments.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                    <p className="text-sm opacity-90">No jobs assigned yet for the upcoming days.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {myAssignments.slice(0, 5).map((job: any) => (
                      <div key={job.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{job.date ? new Date(job.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${job.status === 'SENT' ? 'bg-green-400/30 text-green-100' : 'bg-white/20'}`}>{job.status}</span>
                        </div>
                        <p className="text-sm font-bold truncate">{job.community} · Lot {job.lot}</p>
                        <p className="text-xs opacity-90 truncate">{job.builder}</p>
                        <p className="text-xs mt-1 italic opacity-80">{job.service}</p>
                      </div>
                    ))}
                    {myAssignments.length > 5 && (
                      <p className="text-[10px] text-center opacity-70 mt-2">+ {myAssignments.length - 5} more assignments</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Intake Submissions */}
          <div className={canAccessBlueBook ? 'lg:col-span-2' : ''}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Intakes</h2>
              {recentIntakes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recent intake submissions yet. Complete the intake form to see them here.
                </p>
              ) : (
                <div className="space-y-4">
                  {recentIntakes.map((intake) => (
                    <div
                      key={intake.id}
                      className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-slate-700 last:pb-0 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {intake.builderName} · {intake.communityName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Lot {intake.lot} &middot;{' '}
                            {intake.services.length ? intake.services.join(', ') : 'Services pending'}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                          {intake.modelPlanName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          Due{' '}
                          {intake.dueDate
                            ? new Date(intake.dueDate).toLocaleDateString()
                            : 'TBD'}
                        </span>
                        <span>
                          Submitted{' '}
                          {intake.createdAt
                            ? new Date(intake.createdAt).toLocaleString()
                            : 'Just now'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Blue Book Recent Entries Table - Only for admin/backoffice */}
        {canAccessBlueBook && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Blue Book Entries</h2>
              <Link
                href="/blue-book"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
              >
                View All Entries →
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {blueBookEntries.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-5xl mb-3">📘</div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">No Blue Book entries yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">Start tracking your construction projects!</p>
                  <Link
                    href="/blue-book"
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Create First Entry
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Builder</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Community</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lot</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {blueBookEntries.slice(0, 5).map((entry: any) => {
                        const categoryLabel = entry.accountCategoryCode
                          ? `${entry.accountCategoryCode} – ${entry.accountCategoryName || ''}`.trim()
                          : entry.serviceName || '—';
                        const startDateLabel = entry.startDate
                          ? new Date(entry.startDate).toLocaleDateString()
                          : '—';
                        const amountLabel = entry.amount
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(entry.amount))
                          : '—';

                        return (
                          <tr key={entry.id} className={entry.status === 'COMPLETE' ? 'bg-green-100/30 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {entry.builderName || entry.builderId || '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {typeof entry.communityName === 'string' ? entry.communityName : entry.communityId || '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {entry.lot || '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {categoryLabel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {startDateLabel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {amountLabel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.status === 'COMPLETE'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  }`}
                              >
                                {entry.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
