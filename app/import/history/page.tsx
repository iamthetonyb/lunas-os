'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

type ActiveTarget = 'blueBook' | 'jobRequests' | 'builders' | 'communities' | 'services';

const TARGET_LABELS: Record<ActiveTarget, string> = {
    blueBook: 'Blue Book',
    jobRequests: 'Job Requests',
    builders: 'Builders',
    communities: 'Communities',
    services: 'Services',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
    blueBookEntry: 'Blue Book Entry',
    jobRequest: 'Job Request',
    builder: 'Builder',
    community: 'Community',
    service: 'Service',
};

const TARGET_COLORS: Record<ActiveTarget, string> = {
    blueBook: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    jobRequests: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    builders: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    communities: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    services: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800',
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
    blueBookEntry: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    jobRequest: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    builder: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    community: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    service: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function entitySummary(data: string): string {
    try {
        const parsed = JSON.parse(data);
        const parts: string[] = [];
        if (parsed.serviceName) parts.push(parsed.serviceName);
        if (parsed.builderName) parts.push(parsed.builderName);
        if (parsed.communityName) parts.push(parsed.communityName);
        if (parsed.lot) parts.push(`Lot ${parsed.lot}`);
        if (parsed.amount) parts.push(parsed.amount);
        return parts.join(' · ') || '—';
    } catch { return '—'; }
}

const PAGE_SIZE = 20;

// ── Delete Selection Modal ─────────────────────────────────────────
function DeleteSelectionModal({
    importId,
    onClose,
    onConfirm,
}: {
    importId: string;
    onClose: () => void;
    onConfirm: (keepEntityIds: string[]) => void;
}) {
    const { t } = useTranslation();
    const entities = useQuery(api.queries.getImportedEntities, {
        importId: importId as Id<'importHistory'>,
    });
    const [unchecked, setUnchecked] = useState<Set<string>>(new Set());

    const grouped = useMemo(() => {
        if (!entities) return {};
        const groups: Record<string, typeof entities> = {};
        for (const e of entities) {
            const type = e.entityType;
            if (!groups[type]) groups[type] = [];
            groups[type].push(e);
        }
        return groups;
    }, [entities]);

    const deletableEntities = useMemo(() => {
        if (!entities) return [];
        return entities.filter(e => !e.existed);
    }, [entities]);

    const deleteCount = deletableEntities.length - unchecked.size;
    const keepCount = unchecked.size;

    const toggleEntity = (entityId: string) => {
        setUnchecked(prev => {
            const next = new Set(prev);
            if (next.has(entityId)) next.delete(entityId);
            else next.add(entityId);
            return next;
        });
    };

    const selectAll = () => setUnchecked(new Set());
    const deselectAll = () => {
        setUnchecked(new Set(deletableEntities.map(e => e.entityId)));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('import.selectRecords')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('import.deleteWarning')}
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {entities === undefined ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                            {t('import.loadingEntities')}
                        </p>
                    ) : deletableEntities.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                            {t('import.noLinkedEntities')}
                        </p>
                    ) : (
                        <>
                            {/* Select/Deselect all */}
                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    onClick={selectAll}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {t('import.selectAll')}
                                </button>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <button
                                    onClick={deselectAll}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {t('import.deselectAll')}
                                </button>
                            </div>

                            {/* Grouped entities */}
                            {Object.entries(grouped).map(([type, items]) => (
                                <div key={type} className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ENTITY_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {ENTITY_TYPE_LABELS[type] ?? type}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            ({items.length})
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {items.map(entity => {
                                            const isPreExisting = entity.existed;
                                            const isChecked = !isPreExisting && !unchecked.has(entity.entityId);
                                            return (
                                                <label
                                                    key={entity._id}
                                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                                                        isPreExisting
                                                            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/30 opacity-60'
                                                            : isChecked
                                                              ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10'
                                                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800'
                                                    }`}
                                                >
                                                    {isPreExisting ? (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 italic w-4 text-center">—</span>
                                                    ) : (
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleEntity(entity.entityId)}
                                                            className="rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500"
                                                        />
                                                    )}
                                                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                                                        {entitySummary(entity.mappedData)}
                                                    </span>
                                                    {isPreExisting && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                                                            {t('import.preExisting')}
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="text-xs space-y-0.5">
                        <p className="text-red-600 dark:text-red-400 font-medium">
                            {t('import.recordsToDelete', { count: deleteCount })}
                        </p>
                        {keepCount > 0 && (
                            <p className="text-green-600 dark:text-green-400">
                                {t('import.recordsToKeep', { count: keepCount })}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => onConfirm(Array.from(unchecked))}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                            {t('import.deleteImport')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function ImportHistoryPage() {
    const { t } = useTranslation();
    const [page, setPage] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const softDelete = useMutation(api.mutations.softDeleteImport);
    const restoreImport = useMutation(api.mutations.restoreImport);
    const [showDeleted, setShowDeleted] = useState(false);
    const imports = useQuery(api.queries.getImportHistory, { limit: PAGE_SIZE * (page + 1), includeDeleted: showDeleted }) ?? [];

    const currentPage = imports.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const hasMore = imports.length === PAGE_SIZE * (page + 1);

    const handleDelete = async (keepEntityIds: string[]) => {
        if (!deleteTarget) return;
        try {
            await softDelete({
                id: deleteTarget as Id<"importHistory">,
                keepEntityIds,
            });
            toast.success(t('import.deletedSuccess'));
            setDeleteTarget(null);
        } catch {
            toast.error(t('import.deleteError'));
        }
    };

    return (
        <>
            <PageHeader
                title={t('import.history')}
                description={t('import.historyDescription')}
                action={
                    <Link
                        href="/import"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        {t('import.title')}
                    </Link>
                }
            />
            <main className="px-6 py-6">
                <div className="flex items-center justify-end gap-2 mb-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
                        {t('import.showDeleted')}
                    </label>
                </div>
                {imports.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('import.noImports')}</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('import.file')}</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('common.date')}</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('import.targets')}</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('import.rows')}</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('import.result')}</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('import.size')}</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('common.actions')}</th>
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
                                        <tr key={record._id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${record.deletedAt ? 'opacity-60' : ''}`}>
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
                                                    {record.detectedTargets.map((target) => (
                                                        <span
                                                            key={target}
                                                            className={`text-[10px] px-1.5 py-0.5 rounded border ${TARGET_COLORS[target as ActiveTarget] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                                        >
                                                            {TARGET_LABELS[target as ActiveTarget] ?? target}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                                                {record.rowCount}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-medium ${totalErrors > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    {totalSuccess} {t('import.ok')}
                                                </span>
                                                {totalErrors > 0 && (
                                                    <span className="text-xs text-red-500 dark:text-red-400 ml-1">
                                                        {totalErrors} {t('import.err')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums text-xs">
                                                {formatFileSize(record.fileSize)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {record.deletedAt ? (
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <span className="text-[10px] text-red-500 dark:text-red-400 italic">{t('import.deleted')}</span>
                                                        <button
                                                            onClick={() => {
                                                                restoreImport({ id: record._id as Id<"importHistory"> });
                                                                toast.success(t('import.restored'));
                                                            }}
                                                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                                        >
                                                            {t('import.restore')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteTarget(record._id)}
                                                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                                                        title={t('import.deleteImport')}
                                                    >
                                                        {t('common.delete')}
                                                    </button>
                                                )}
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
                                {t('common.previous')}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t('pagination.showing', { start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, imports.length), total: imports.length })}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!hasMore}
                                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('common.next')}
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Selection modal — replaces the simple confirmation dialog */}
            {deleteTarget && (
                <DeleteSelectionModal
                    importId={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                />
            )}
        </>
    );
}
