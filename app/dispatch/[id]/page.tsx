'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export default function DispatchDetailPage() {
    const params = useParams();
    const batchId = params.id as string;

    // Real-time Convex query
    const batch = useQuery(api.queries.getDispatchBatchById, {
        batchId: batchId as Id<"dispatchBatches">
    });

    if (!batch) {
        return (
            <>
                <PageHeader
                    title="Dispatch Details"
                    description="Loading..."
                    action={<Link href="/dispatch" className="text-blue-600 hover:text-blue-800">← Back to Dispatch</Link>}
                />
                <main className="px-6 py-6">
                    <div className="animate-pulse bg-gray-100 rounded-lg h-64"></div>
                </main>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={`Dispatch: ${batch.crewName || 'Details'}`}
                description={`${batch.foremanName || 'No foreman'} • ${batch.serviceDate || 'No date'} (Real-time)`}
                action={<Link href="/dispatch" className="text-blue-600 hover:text-blue-800">← Back to Dispatch</Link>}
            />
            <main className="px-6 py-6 space-y-6">
                {/* Summary Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Crew</p>
                            <p className="text-lg font-semibold text-gray-900">{batch.crewName || '—'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Foreman</p>
                            <p className="text-lg font-semibold text-gray-900">{batch.foremanName || '—'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Service Date</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {batch.serviceDate ? new Date(batch.serviceDate).toLocaleDateString() : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${batch.status === 'COMPLETE'
                                    ? 'bg-green-100 text-green-800'
                                    : batch.status === 'SENT'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {batch.status}
                            </span>
                        </div>
                    </div>
                    {batch.notes && (
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-gray-500">Notes</p>
                            <p className="text-gray-900">{batch.notes}</p>
                        </div>
                    )}
                </div>

                {/* Jobs Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Assigned Jobs ({batch.jobs?.length || 0})
                        </h2>
                    </div>
                    {batch.jobs && batch.jobs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Builder</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Walk Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {batch.jobs.map((job: any) => (
                                        <tr key={job.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.communityName || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.builderName || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.lot || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.serviceName || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {job.walkTime || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.status === 'COMPLETE'
                                                        ? 'bg-green-100 text-green-800'
                                                        : job.status === 'SENT'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {job.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No jobs in this dispatch batch.
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
