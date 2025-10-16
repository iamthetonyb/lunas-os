'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BlueBookPage() {
  const { data: blueBookEntries, error } = useSWR('/api/blue-book', fetcher);

  if (error) return (
    <AppLayout>
      <PageHeader title="Blue Book" description="Project tracking and management" />
      <main className="px-6 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Failed to load data</p>
        </div>
      </main>
    </AppLayout>
  );

  return (
    <AppLayout>
      <PageHeader title="Blue Book" description="Project tracking and management" />
      <main className="px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {!blueBookEntries ? (
            <div className="p-6">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Builder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Community</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blueBookEntries?.map((entry: any) => (
                    <tr key={entry.id} className={entry.status === 'COMPLETE' ? 'bg-green-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.builderId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.communityId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.lot}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.serviceId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          entry.status === 'COMPLETE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
