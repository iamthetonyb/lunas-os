'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { 
      signal: controller.signal,
      cache: 'no-store' 
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Fetch error:', err);
    return [];
  }
};

export default function DashboardPage() {
  const { data: blueBookEntries = [], error } = useSWR('/api/blue-book', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false
  });
  
  const stats = [
    { name: 'Active Jobs', value: '12', change: '+2', icon: '📋' },
    { name: 'Pending Intakes', value: '8', change: '+3', icon: '📝' },
    { name: 'Scheduled Today', value: '5', change: '0', icon: '📅' },
    { name: 'Invoices Due', value: '$12,450', change: '+5%', icon: '💰' },
  ];

  const recentActivity = [
    { type: 'Intake', message: 'New intake submitted for Project ABC', time: '5 min ago' },
    { type: 'Schedule', message: 'Job scheduled for tomorrow', time: '15 min ago' },
    { type: 'Dispatch', message: 'Crew dispatched to Site XYZ', time: '1 hour ago' },
    { type: 'Invoice', message: 'Invoice #1234 sent', time: '2 hours ago' },
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
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  stat.change.startsWith('+') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Blue Book Snapshot - Now takes full width where Quick Actions were */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Blue Book Info Card */}
          <div className="lg:col-span-1">
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
                  <p className="text-sm opacity-90 mb-1">Total Projects</p>
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

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-slate-700 last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{activity.type}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{activity.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Blue Book Recent Entries Table */}
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
                        <tr key={entry.id} className={entry.status === 'COMPLETE' ? 'bg-green-50 dark:bg-green-900/10' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {entry.builderName || entry.builderId || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {entry.communityName || entry.communityId || '—'}
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
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                entry.status === 'COMPLETE'
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
      </main>
    </>
  );
}
