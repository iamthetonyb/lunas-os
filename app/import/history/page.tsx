'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

type ActiveTarget = 'blueBook' | 'jobRequests' | 'builders' | 'communities' | 'services';

const TARGET_LABELS: Record<ActiveTarget, string> = {
    blueBook: 'Blue Book',
    jobRequests: 'Job Requests',
    builders: 'Builders',
    communities: 'Communities',
    services: 'Services',
};

const TARGET_COLORS: Record<ActiveTarget, string> = {
    blueBook: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    jobRequests: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    builders: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    communities: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    services: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800',
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PAGE_SIZE = 20;

export default function ImportHistoryPage() {
    const [page, setPage] = useState(0);
    const imports = useQuery(api.queries.getImportHistory, { limit: PAGE_SIZE * (page + 1) }) ?? [];

    const currentPage = imports.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const hasMore = imports.length === PAGE_SIZE * (page + 1);

    return (
        <>
            <PageHeader
                title="Import History"
                description="Previously uploaded documents and their import results"
                action={
                    <Link
                        href="/import"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        New Import
                    </Link>
                }
            />
            <main className="px-6 py-6">
                {imports.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No imports yet.</p>
                        <Link href="/import" className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-block">
                            Upload your first document
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">File</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Date</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Targets</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Rows</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Result</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Size</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {currentPage.map((record) => {
                                    const res = (() => {
                                        try { return JSON.parse(record.results) as Record<string, { success: number; errors: number }>; }
                                        catch { return null; }
                                    })();
                                    const totalSuccess = res ? Object.values(res).reduce((s, r) => s + r.success, 0) : 0;
                                    const totalErrors = res ? Object.values(res).reduce((s, r) => s + r.errors, 0) : 0;

                                    return (
                                        <tr key={record._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/import/history/${record._id}`}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium truncate block max-w-[240px]"
                                                    title={record.fileName}
                                                >
                                                    {record.fileName}
                                                </Link>
                                                {record.documentType && (
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">
                                                        {record.documentType}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                                {new Date(record.createdAt).toLocaleDateString()}{' '}
                                                <span className="text-gray-400 dark:text-gray-500">
                                                    {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {record.detectedTargets.map((t) => (
                                                        <span
                                                            key={t}
                                                            className={`text-[10px] px-1.5 py-0.5 rounded border ${TARGET_COLORS[t as ActiveTarget] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                                        >
                                                            {TARGET_LABELS[t as ActiveTarget] ?? t}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                                                {record.rowCount}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-medium ${totalErrors > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {totalSuccess} ok
                                                </span>
                                                {totalErrors > 0 && (
                                                    <span className="text-xs text-red-500 dark:text-red-400 ml-1">
                                                        {totalErrors} err
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums text-xs">
                                                {formatFileSize(record.fileSize)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Page {page + 1}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!hasMore}
                                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
