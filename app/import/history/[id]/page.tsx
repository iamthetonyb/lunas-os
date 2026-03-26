'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { useState, useMemo, useCallback, useRef } from 'react';
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

const TARGET_COLORS: Record<ActiveTarget, string> = {
    blueBook: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    jobRequests: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    builders: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    communities: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    services: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800',
};

const ENTITY_PAGES: Record<string, string> = {
    builder: '/settings',
    community: '/settings',
    service: '/settings',
    blueBookEntry: '/blue-book',
    jobRequest: '/schedule',
};

// All possible destination fields across targets (deduplicated)
const ALL_DEST_FIELDS: { value: string; label: string }[] = [
    { value: '__skip__', label: '-- Skip --' },
    { value: 'lot', label: 'Lot' },
    { value: 'builderName', label: 'Builder Name' },
    { value: 'communityName', label: 'Community Name' },
    { value: 'serviceName', label: 'Service Name' },
    { value: 'amount', label: 'Amount' },
    { value: 'checkNumber', label: 'Check Number' },
    { value: 'checkDate', label: 'Check Date' },
    { value: 'checkTotal', label: 'Check Total' },
    { value: 'invoiceNumber', label: 'Invoice Number' },
    { value: 'isAch', label: 'Is ACH' },
    { value: 'poNumber', label: 'PO Number' },
    { value: 'accountCategoryName', label: 'Account Category' },
    { value: 'accountCategoryCode', label: 'Account Category Code' },
    { value: 'startDate', label: 'Start Date' },
    { value: 'dueDate', label: 'Due Date' },
    { value: 'status', label: 'Status' },
    { value: 'modelPlanCode', label: 'Model/Plan Code' },
    { value: 'modelPlanSqft', label: 'Sq Ft' },
    { value: 'assignedForemanName', label: 'Foreman' },
    { value: 'crewName', label: 'Crew' },
    { value: 'address', label: 'Address' },
    { value: 'notes', label: 'Notes' },
];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type TabId = 'mapped' | 'raw' | 'entities' | 'mapping';

export default function ImportDetailPage() {
    const { t } = useTranslation();
    const params = useParams();
    const importId = params.id as string;

    const record = useQuery(api.queries.getImportById, { id: importId as Id<'importHistory'> });
    const entities = useQuery(api.queries.getImportedEntities, { importId: importId as Id<'importHistory'> });
    const updateEntityData = useMutation(api.mutations.updateImportedEntityData);
    const updateImportRecord = useMutation(api.mutations.updateImportRecord);

    const [editingEntity, setEditingEntity] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editRowValues, setEditRowValues] = useState<Record<string, string>>({});
    const [viewTab, setViewTab] = useState<TabId>('mapped');
    const [saving, setSaving] = useState(false);
    const [editMapping, setEditMapping] = useState<Record<string, string> | null>(null);
    const [reExtracting, setReExtracting] = useState(false);
    const reExtractRef = useRef<HTMLInputElement>(null);

    const results = useMemo(() => {
        if (!record?.results) return null;
        try { return JSON.parse(record.results) as Record<string, { success: number; errors: number }>; }
        catch { return null; }
    }, [record?.results]);

    const parsedRows = useMemo(() => {
        if (!record?.parsedRows) return [];
        try { return JSON.parse(record.parsedRows) as Record<string, string>[]; }
        catch { return []; }
    }, [record?.parsedRows]);

    const rawRows = useMemo(() => {
        if (!record?.rawRows) return [];
        try { return JSON.parse(record.rawRows) as Record<string, string>[]; }
        catch { return []; }
    }, [record?.rawRows]);

    const fieldMapping = useMemo(() => {
        if (!record?.fieldMapping) return {};
        try { return JSON.parse(record.fieldMapping) as Record<string, string>; }
        catch { return {}; }
    }, [record?.fieldMapping]);

    // Active mapping = editing draft or saved mapping
    const activeMapping = editMapping ?? fieldMapping;

    const mappedColumns = useMemo(() => {
        if (parsedRows.length === 0) return [];
        const allKeys = new Set<string>();
        parsedRows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
        return Array.from(allKeys);
    }, [parsedRows]);

    const rawColumns = useMemo(() => {
        if (rawRows.length === 0) return [];
        const allKeys = new Set<string>();
        rawRows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
        return Array.from(allKeys);
    }, [rawRows]);

    const totalSuccess = results ? Object.values(results).reduce((s, r) => s + r.success, 0) : 0;
    const totalErrors = results ? Object.values(results).reduce((s, r) => s + r.errors, 0) : 0;

    // ── Re-map raw rows using a mapping ──────────────────────────────────
    const applyMapping = useCallback((rows: Record<string, string>[], mapping: Record<string, string>) => {
        return rows.map(row => {
            const mapped: Record<string, string> = {};
            for (const [srcCol, destField] of Object.entries(mapping)) {
                if (destField === '__skip__' || !destField) continue;
                const val = row[srcCol];
                if (val !== undefined && val !== '') {
                    mapped[destField] = val;
                }
            }
            return mapped;
        });
    }, []);

    // Preview what mapped data will look like with current draft mapping
    const mappingPreviewCount = useMemo(() => {
        if (!editMapping) return 0;
        const sourceRows = rawRows.length > 0 ? rawRows : parsedRows;
        const remapped = applyMapping(sourceRows, editMapping);
        const nonEmpty = remapped.filter(r => Object.keys(r).length > 0);
        return nonEmpty.length;
    }, [editMapping, rawRows, parsedRows, applyMapping]);

    // ── Re-extract: upload same file to update rawRows ───────────────────
    const handleReExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setReExtracting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            if (['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'].includes(ext)) {
                formData.append('ocr', 'true');
            }
            const res = await fetch('/api/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const ocrRows: Record<string, string>[] = data.rows ?? [];
            // Save rawRows + update mapping if auto-detected
            const newMapping: Record<string, string> = {};
            if (data.fieldMapping) {
                for (const [src, dest] of Object.entries(data.fieldMapping)) {
                    newMapping[src] = dest as string;
                }
            }
            for (const col of data.unmappedColumns ?? []) {
                if (!newMapping[col]) newMapping[col] = '__skip__';
            }

            const remapped = applyMapping(ocrRows, Object.keys(newMapping).length > 0 ? newMapping : fieldMapping);

            await updateImportRecord({
                id: importId as Id<'importHistory'>,
                rawRows: JSON.stringify(ocrRows),
                parsedRows: JSON.stringify(remapped),
                ...(Object.keys(newMapping).length > 0 ? { fieldMapping: JSON.stringify(newMapping) } : {}),
            });
            setEditMapping(null);
            toast.success(t('import.reExtracted', { rows: ocrRows.length, fields: Object.keys(ocrRows[0] ?? {}).length }));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t('import.failed'));
        } finally {
            setReExtracting(false);
            if (reExtractRef.current) reExtractRef.current.value = '';
        }
    };

    if (record === undefined) {
        return (
            <>
                <PageHeader title={t('common.loading')} />
                <main className="px-6 py-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-24 bg-gray-200 dark:bg-slate-700 rounded-lg" />
                        <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded-lg" />
                    </div>
                </main>
            </>
        );
    }

    if (record === null) {
        return (
            <>
                <PageHeader title={t('import.importNotFound')} />
                <main className="px-6 py-6">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">{t('import.importNotFoundMessage')}</p>
                        <Link href="/import/history" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                            {t('import.backToHistory')}
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    // ── Field Mapping editing ────────────────────────────────────────────
    const handleMappingEditStart = () => {
        setEditMapping({ ...fieldMapping });
    };

    const handleMappingChange = (srcCol: string, destField: string) => {
        setEditMapping(prev => prev ? { ...prev, [srcCol]: destField } : { [srcCol]: destField });
    };

    const handleMappingSave = async () => {
        if (!editMapping) return;
        setSaving(true);
        try {
            // Re-derive parsedRows from rawRows using the new mapping
            const sourceRows = rawRows.length > 0 ? rawRows : parsedRows;
            const remapped = applyMapping(sourceRows, editMapping);

            await updateImportRecord({
                id: importId as Id<'importHistory'>,
                fieldMapping: JSON.stringify(editMapping),
                parsedRows: JSON.stringify(remapped),
            });
            setEditMapping(null);
            toast.success(t('import.mappingUpdated'));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t('import.failed'));
        } finally {
            setSaving(false);
        }
    };

    const handleMappingCancel = () => setEditMapping(null);

    // ── Entity editing ──────────────────────────────────────────────────
    const handleEditStart = (entityId: string, currentData: string) => {
        try {
            setEditValues(JSON.parse(currentData));
            setEditingEntity(entityId);
        } catch {
            toast.error(t('import.failed'));
        }
    };

    const handleEditSave = async (entityId: string) => {
        try {
            await updateEntityData({
                id: entityId as Id<'importedEntities'>,
                mappedData: JSON.stringify(editValues),
            });
            setEditingEntity(null);
            setEditValues({});
            toast.success(t('import.entityUpdated'));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t('import.failed'));
        }
    };

    // ── Row editing (mapped data) ───────────────────────────────────────
    const handleRowEditStart = (index: number) => {
        setEditingRow(index);
        setEditRowValues({ ...parsedRows[index] });
    };

    const handleRowEditSave = async () => {
        if (editingRow === null) return;
        setSaving(true);
        try {
            const updated = [...parsedRows];
            updated[editingRow] = { ...editRowValues };
            await updateImportRecord({
                id: importId as Id<'importHistory'>,
                parsedRows: JSON.stringify(updated),
            });
            setEditingRow(null);
            setEditRowValues({});
            toast.success(t('import.rowUpdated'));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t('import.failed'));
        } finally {
            setSaving(false);
        }
    };

    const handleAddField = () => {
        const key = prompt(t('import.fieldName'));
        if (key && key.trim()) {
            setEditRowValues(prev => ({ ...prev, [key.trim()]: '' }));
        }
    };

    // ── Tab config ──────────────────────────────────────────────────────
    const tabs: { id: TabId; label: string }[] = [
        { id: 'mapped', label: `${t('import.mappedData')} (${parsedRows.length})` },
        { id: 'raw', label: `${t('import.rawExtraction')} (${rawRows.length})` },
        { id: 'entities', label: `${t('import.linkedEntities')} (${entities?.length ?? 0})` },
        { id: 'mapping', label: t('import.fieldMapping') },
    ];

    return (
        <>
            <PageHeader
                title={record.fileName}
                description={`Imported ${new Date(record.createdAt).toLocaleDateString()} at ${new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                action={
                    <Link
                        href="/import/history"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        {t('import.backToHistory')}
                    </Link>
                }
            />
            <main className="px-6 py-6 space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('import.rowsProcessed')}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{record.rowCount}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('import.imported2')}</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">{totalSuccess}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('import.errors')}</p>
                        <p className={`text-2xl font-bold tabular-nums ${totalErrors > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'}`}>
                            {totalErrors}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('import.fileSize')}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFileSize(record.fileSize)}</p>
                    </div>
                </div>

                {/* Result breakdown */}
                {results && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('import.resultsByTarget')}</h3>
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(results)
                                .filter(([, r]) => r.success > 0 || r.errors > 0)
                                .map(([target, r]) => (
                                    <div key={target} className="flex items-center gap-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TARGET_COLORS[target as ActiveTarget] ?? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}>
                                            {TARGET_LABELS[target as ActiveTarget] ?? target}
                                        </span>
                                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">{r.success} {t('import.ok')}</span>
                                        {r.errors > 0 && <span className="text-xs text-red-500 dark:text-red-400">{r.errors} {t('import.err')}</span>}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setViewTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                viewTab === tab.id
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Mapped Data tab (editable) ──────────────────────────── */}
                {viewTab === 'mapped' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                        {parsedRows.length === 0 ? (
                            <p className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                                {t('import.noMappedData')}
                            </p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
                                        {mappedColumns.map(col => (
                                            <th key={col} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">{col}</th>
                                        ))}
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 w-20 sticky right-0 bg-gray-50 dark:bg-slate-700/50" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {parsedRows.map((row, i) => {
                                        const isEditing = editingRow === i;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                <td className="px-3 py-2 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                                                {isEditing ? (
                                                    <>
                                                        {Object.keys(editRowValues).map(col => (
                                                            <td key={col} className="px-1 py-1">
                                                                <input
                                                                    type="text"
                                                                    value={editRowValues[col] ?? ''}
                                                                    onChange={e => setEditRowValues(prev => ({ ...prev, [col]: e.target.value }))}
                                                                    className="w-full text-xs border border-blue-300 dark:border-blue-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-2 py-1 text-right sticky right-0 bg-white dark:bg-slate-800">
                                                            <div className="flex gap-1 justify-end">
                                                                <button onClick={handleAddField} className="px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30" title={t('import.addField')}>+</button>
                                                                <button onClick={handleRowEditSave} disabled={saving} className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{t('common.save')}</button>
                                                                <button onClick={() => { setEditingRow(null); setEditRowValues({}); }} className="px-1.5 py-0.5 text-[10px] border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300">{t('common.cancel')}</button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        {mappedColumns.map(col => (
                                                            <td key={col} className="px-3 py-2 text-gray-700 dark:text-gray-200 max-w-[200px] truncate" title={row[col] ?? ''}>
                                                                {row[col] ?? ''}
                                                            </td>
                                                        ))}
                                                        <td className="px-2 py-2 text-right sticky right-0 bg-white dark:bg-slate-800">
                                                            <button
                                                                onClick={() => handleRowEditStart(i)}
                                                                className="px-1.5 py-0.5 text-[10px] border border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600"
                                                            >
                                                                {t('common.edit')}
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ── Raw Extraction tab (read-only, all fields) ──────────── */}
                {viewTab === 'raw' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                        {/* Hidden file input for re-extraction */}
                        <input ref={reExtractRef} type="file" className="hidden" onChange={handleReExtract} accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp" />
                        {rawRows.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('import.noRawData')}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-3">
                                    {t('import.reUploadPrompt')}
                                </p>
                                <button
                                    onClick={() => reExtractRef.current?.click()}
                                    disabled={reExtracting}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
                                >
                                    {reExtracting ? t('import.extracting') : t('import.reExtractFromFile')}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50 flex items-center justify-between">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t('import.rawFieldsInfo', { count: rawColumns.length })}
                                    </p>
                                    <button
                                        onClick={() => reExtractRef.current?.click()}
                                        disabled={reExtracting}
                                        className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 shrink-0"
                                    >
                                        {reExtracting ? t('import.extracting') : t('import.reExtract')}
                                    </button>
                                </div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                                            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
                                            {rawColumns.map(col => {
                                                const isMapped = Object.values(fieldMapping).includes(col) || Object.keys(fieldMapping).includes(col);
                                                return (
                                                    <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                                        <span className={isMapped ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}>
                                                            {col}
                                                        </span>
                                                        {!isMapped && <span className="text-[8px] ml-1 text-gray-300 dark:text-gray-600">{t('import.unmapped')}</span>}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {rawRows.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                <td className="px-3 py-2 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                                                {rawColumns.map(col => (
                                                    <td key={col} className="px-3 py-2 text-gray-700 dark:text-gray-200 max-w-[200px] truncate" title={row[col] ?? ''}>
                                                        {row[col] ?? <span className="text-gray-300 dark:text-gray-600">&mdash;</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                )}

                {/* ── Linked Entities tab (editable) ──────────────────────── */}
                {viewTab === 'entities' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {!entities || entities.length === 0 ? (
                            <p className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                                {t('import.noLinkedEntities')}
                            </p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('import.entityType')}</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('import.entityData')}</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('common.status')}</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {entities.map((entity) => {
                                        const data = (() => {
                                            try { return JSON.parse(entity.mappedData) as Record<string, string>; }
                                            catch { return {}; }
                                        })();
                                        const isEditing = editingEntity === entity._id;

                                        return (
                                            <tr key={entity._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                        TARGET_COLORS[(entity.entityType === 'blueBookEntry' ? 'blueBook' : entity.entityType === 'jobRequest' ? 'jobRequests' : entity.entityType + 's') as ActiveTarget]
                                                        ?? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                                                    }`}>
                                                        {entity.entityType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <div className="space-y-1">
                                                            {Object.entries(editValues).map(([key, val]) => (
                                                                <div key={key} className="flex items-center gap-2">
                                                                    <label className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0">{key}</label>
                                                                    <input
                                                                        type="text"
                                                                        value={val}
                                                                        onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 flex-1"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(data).map(([key, val]) => (
                                                                <span key={key} className="text-xs">
                                                                    <span className="text-gray-400 dark:text-gray-500">{key}: </span>
                                                                    <span className="text-gray-700 dark:text-gray-200">{val}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${entity.existed ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                                        {entity.existed ? t('import.existed') : t('import.entityCreated')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {isEditing ? (
                                                        <div className="flex gap-1 justify-end">
                                                            <button onClick={() => handleEditSave(entity._id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">{t('common.save')}</button>
                                                            <button onClick={() => { setEditingEntity(null); setEditValues({}); }} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300">{t('common.cancel')}</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-1 justify-end">
                                                            <button onClick={() => handleEditStart(entity._id, entity.mappedData)} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600">{t('common.edit')}</button>
                                                            {ENTITY_PAGES[entity.entityType] && (
                                                                <Link href={ENTITY_PAGES[entity.entityType]} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-600">{t('common.viewAll')}</Link>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ── Field Mapping tab (editable with dropdowns) ────────── */}
                {viewTab === 'mapping' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {Object.keys(activeMapping).length === 0 ? (
                            <p className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                                {t('import.noFieldMapping')}
                            </p>
                        ) : (
                            <>
                                {/* Toolbar */}
                                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50 flex items-center justify-between gap-3">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {editMapping
                                            ? t('import.editingMappingInfo', { count: mappingPreviewCount })
                                            : t('import.mappedOfTotal', { mapped: Object.values(activeMapping).filter(v => v && v !== '__skip__').length, total: Object.keys(activeMapping).length })}
                                    </p>
                                    <div className="flex gap-2">
                                        {editMapping ? (
                                            <>
                                                <button
                                                    onClick={handleMappingSave}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                                                >
                                                    {saving ? t('import.saving') : t('import.saveAndRemap')}
                                                </button>
                                                <button
                                                    onClick={handleMappingCancel}
                                                    className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={handleMappingEditStart}
                                                className="px-3 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium"
                                            >
                                                {t('import.editMappingBtn')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('import.sourceColumn')}</th>
                                            <th className="px-4 py-2 text-center font-medium text-gray-400 dark:text-gray-500 w-12">&rarr;</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('import.destinationField')}</th>
                                            {editMapping && <th className="px-4 py-2 text-left font-medium text-gray-400 dark:text-gray-500 w-28">{t('import.sample')}</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {Object.entries(activeMapping).map(([src, dest]) => {
                                            // Grab a sample value from the first row that has this column
                                            const sourceRows = rawRows.length > 0 ? rawRows : parsedRows;
                                            const sampleVal = sourceRows.find(r => r[src])
                                                ?.[src] ?? '';

                                            return (
                                                <tr key={src} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                                    <td className="px-4 py-2 text-gray-700 dark:text-gray-200 font-mono text-xs">{src}</td>
                                                    <td className="px-4 py-2 text-center text-gray-400">&rarr;</td>
                                                    <td className="px-4 py-2">
                                                        {editMapping ? (
                                                            <select
                                                                value={dest || '__skip__'}
                                                                onChange={e => handleMappingChange(src, e.target.value)}
                                                                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 w-full max-w-[220px]"
                                                            >
                                                                {ALL_DEST_FIELDS.map(f => (
                                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                                ))}
                                                            </select>
                                                        ) : dest === '__skip__' ? (
                                                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">{t('import.skip')}</span>
                                                        ) : (
                                                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                                                {ALL_DEST_FIELDS.find(f => f.value === dest)?.label ?? dest}
                                                            </span>
                                                        )}
                                                    </td>
                                                    {editMapping && (
                                                        <td className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 max-w-[120px] truncate" title={sampleVal}>
                                                            {sampleVal || <span className="text-gray-300 dark:text-gray-600">&mdash;</span>}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                )}
            </main>
        </>
    );
}
