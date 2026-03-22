'use client';

import { PageHeader } from '@/components/page-header';
import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

type ParsedRow = Record<string, string>;
type ActiveTarget = 'blueBook' | 'jobRequests' | 'builders' | 'communities' | 'services';
type FieldMapping = Record<string, string>; // sourceCol → destField or '__skip__'
type TargetScore = { type: ActiveTarget; confidence: number };

const OCR_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'];

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

// Destination fields per import target
const TARGET_FIELDS: Record<ActiveTarget, { value: string; label: string }[]> = {
    blueBook: [
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
        { value: 'status', label: 'Status' },
        { value: 'modelPlanCode', label: 'Model/Plan Code' },
        { value: 'modelPlanSqft', label: 'Sq Ft' },
        { value: 'assignedForemanName', label: 'Foreman' },
        { value: 'crewName', label: 'Crew' },
    ],
    jobRequests: [
        { value: 'lot', label: 'Lot' },
        { value: 'builderName', label: 'Builder Name' },
        { value: 'communityName', label: 'Community Name' },
        { value: 'serviceName', label: 'Service Name' },
        { value: 'dueDate', label: 'Due Date' },
        { value: 'startDate', label: 'Start/Scheduled Date' },
        { value: 'address', label: 'Address' },
        { value: 'notes', label: 'Notes' },
        { value: 'poNumber', label: 'PO Number' },
        { value: 'assignedForemanName', label: 'Foreman' },
        { value: 'crewName', label: 'Crew' },
        { value: 'status', label: 'Status' },
    ],
    builders: [
        { value: 'builderName', label: 'Builder Name' },
    ],
    communities: [
        { value: 'communityName', label: 'Community Name' },
        { value: 'builderName', label: 'Builder Name' },
    ],
    services: [
        { value: 'serviceName', label: 'Service Name' },
    ],
};

// Required mapped fields for each target to fire on a row
const TARGET_REQUIRED: Record<ActiveTarget, string[]> = {
    blueBook: ['lot'],
    jobRequests: ['lot', 'serviceName'],
    builders: ['builderName'],
    communities: ['communityName'],
    services: ['serviceName'],
};

export default function ImportPage() {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [importResult, setImportResult] = useState<Record<ActiveTarget, { success: number; errors: number }> | null>(null);
    const [ocrRawText, setOcrRawText] = useState<string | null>(null);
    const [ocrConfidence, setOcrConfidence] = useState(0);
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
    const [mappingConfirmed, setMappingConfirmed] = useState(false);
    const [detectedTargets, setDetectedTargets] = useState<TargetScore[]>([]);
    const [selectedTargets, setSelectedTargets] = useState<Set<ActiveTarget>>(new Set());

    // Convex data
    const builders = useQuery(api.queries.getBuilders, {}) ?? [];
    const communities = useQuery(api.queries.getCommunities, {}) ?? [];

    // Mutations
    const createBlueBookEntry = useMutation(api.seedHelpers.createBlueBookEntry);
    const createJobRequest = useMutation(api.mutations.createJobRequest);
    const createBuilder = useMutation(api.mutations.createBuilder);
    const createCommunity = useMutation(api.mutations.createCommunity);
    const createService = useMutation(api.mutations.createService);

    // Derived
    const fileExt = selectedFile?.name.split('.').pop()?.toLowerCase() ?? '';
    const isOcrFile = OCR_EXTENSIONS.includes(fileExt);
    const columns = useMemo(() => {
        if (parsedRows.length === 0) return [];
        const allKeys = new Set<string>();
        parsedRows.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
        return Array.from(allKeys);
    }, [parsedRows]);

    // Merge fields from ALL selected targets (deduplicated)
    const availableFields = useMemo(() => {
        const seen = new Set<string>();
        const fields: { value: string; label: string }[] = [];
        for (const target of selectedTargets) {
            for (const f of TARGET_FIELDS[target]) {
                if (!seen.has(f.value)) {
                    seen.add(f.value);
                    fields.push(f);
                }
            }
        }
        return fields;
    }, [selectedTargets]);

    const mappedCount = Object.values(fieldMapping).filter(v => v && v !== '__skip__').length;

    // ── Handlers ──────────────────────────────────────────────────────

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setParsedRows([]);
            setImportResult(null);
            setOcrRawText(null);
            setOcrConfidence(0);
            setFieldMapping({});
            setMappingConfirmed(false);
            setDetectedTargets([]);
            setSelectedTargets(new Set());
        }
    };

    const handleParseFile = async () => {
        if (!selectedFile) return;
        setParsing(true);
        setParsedRows([]);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            if (isOcrFile) formData.append('ocr', 'true');

            const res = await fetch('/api/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setParsedRows(data.rows ?? []);
            setMappingConfirmed(false);

            // Multi-route detection
            const targets: TargetScore[] = (data.detectedTargets ?? []).filter(
                (t: { type: string; confidence: number }) => t.type !== 'unknown'
            ) as TargetScore[];
            setDetectedTargets(targets);

            // Auto-select all detected targets
            setSelectedTargets(new Set(targets.map((t: TargetScore) => t.type)));

            // Build initial field mapping from auto-detection
            const autoMapping: FieldMapping = {};
            if (data.fieldMapping) {
                for (const [src, dest] of Object.entries(data.fieldMapping)) {
                    autoMapping[src] = dest as string;
                }
            }
            for (const col of data.unmappedColumns ?? []) {
                if (!autoMapping[col]) autoMapping[col] = '__skip__';
            }
            setFieldMapping(autoMapping);

            if (data.ocrText) {
                setOcrRawText(data.ocrText);
                setOcrConfidence(data.ocrConfidence ?? 0);
            }

            const count = targets.length;
            const names = targets.map((t: TargetScore) => TARGET_LABELS[t.type]).join(', ');
            const msg = isOcrFile
                ? `OCR complete — ${data.rows?.length ?? 0} rows, routing to: ${names}`
                : `Parsed ${data.rows?.length ?? 0} rows — routing to: ${count > 0 ? names : 'select a target'}`;
            toast.success(msg);
        } catch (err: any) {
            toast.error(err.message || 'Failed to parse file');
        } finally {
            setParsing(false);
        }
    };

    const resolveId = (name: string | undefined, list: { _id: string; name: string }[]): string | undefined => {
        if (!name) return undefined;
        const lower = name.toLowerCase().trim();
        return list.find((item) => item.name.toLowerCase() === lower)?._id;
    };

    const remapRow = (row: ParsedRow): ParsedRow => {
        const mapped: ParsedRow = {};
        for (const [srcCol, destField] of Object.entries(fieldMapping)) {
            if (destField === '__skip__' || !destField) continue;
            const val = row[srcCol];
            if (val !== undefined && val !== '') {
                mapped[destField] = val;
            }
        }
        return mapped;
    };

    // Check if a row has the required fields for a target
    const rowQualifies = (row: ParsedRow, target: ActiveTarget): boolean => {
        const required = TARGET_REQUIRED[target];
        return required.every(f => row[f] && row[f].trim() !== '');
    };

    const toggleTarget = (target: ActiveTarget) => {
        setSelectedTargets(prev => {
            const next = new Set(prev);
            if (next.has(target)) next.delete(target);
            else next.add(target);
            return next;
        });
        setMappingConfirmed(false);
    };

    // Multi-target import: fan out each row to all selected targets it qualifies for
    const handleImport = async () => {
        if (parsedRows.length === 0 || selectedTargets.size === 0 || !mappingConfirmed) return;
        setImporting(true);
        const results: Record<ActiveTarget, { success: number; errors: number }> = {
            blueBook: { success: 0, errors: 0 },
            jobRequests: { success: 0, errors: 0 },
            builders: { success: 0, errors: 0 },
            communities: { success: 0, errors: 0 },
            services: { success: 0, errors: 0 },
        };

        // Dedup entity creation (don't create same builder/community/service twice)
        const createdBuilders = new Set<string>();
        const createdCommunities = new Set<string>();
        const createdServices = new Set<string>();

        for (const raw of parsedRows) {
            const row = remapRow(raw);

            // Builders
            if (selectedTargets.has('builders') && row.builderName && !createdBuilders.has(row.builderName.toLowerCase())) {
                try {
                    await createBuilder({ name: row.builderName });
                    createdBuilders.add(row.builderName.toLowerCase());
                    results.builders.success++;
                } catch { results.builders.errors++; }
            }

            // Communities
            if (selectedTargets.has('communities') && row.communityName && !createdCommunities.has(row.communityName.toLowerCase())) {
                try {
                    const builderId = resolveId(row.builderName, builders);
                    await createCommunity({
                        name: row.communityName,
                        builderId: builderId as Id<'builders'> | undefined,
                    });
                    createdCommunities.add(row.communityName.toLowerCase());
                    results.communities.success++;
                } catch { results.communities.errors++; }
            }

            // Services
            if (selectedTargets.has('services') && row.serviceName && !createdServices.has(row.serviceName.toLowerCase())) {
                try {
                    await createService({ name: row.serviceName });
                    createdServices.add(row.serviceName.toLowerCase());
                    results.services.success++;
                } catch { results.services.errors++; }
            }

            // Job Requests
            if (selectedTargets.has('jobRequests') && rowQualifies(row, 'jobRequests')) {
                try {
                    const builderId = resolveId(row.builderName, builders);
                    const communityId = resolveId(row.communityName, communities);
                    await createJobRequest({
                        lot: row.lot || undefined,
                        dueDate: row.dueDate || row.startDate || undefined,
                        address: row.address || undefined,
                        notes: row.notes || undefined,
                        poNumber: row.poNumber || undefined,
                        builderId: builderId as Id<'builders'> | undefined,
                        communityId: communityId as Id<'communities'> | undefined,
                        services: [{ serviceName: row.serviceName }],
                    });
                    results.jobRequests.success++;
                } catch { results.jobRequests.errors++; }
            }

            // Blue Book
            if (selectedTargets.has('blueBook') && rowQualifies(row, 'blueBook')) {
                try {
                    const builderId = resolveId(row.builderName, builders);
                    const communityId = resolveId(row.communityName, communities);
                    await createBlueBookEntry({
                        lot: row.lot || undefined,
                        startDate: row.startDate || undefined,
                        status: row.status || undefined,
                        amount: row.amount || undefined,
                        accountCategoryName: row.accountCategoryName || undefined,
                        accountCategoryCode: row.accountCategoryCode || undefined,
                        checkNumber: row.checkNumber || undefined,
                        checkDate: row.checkDate || undefined,
                        checkTotal: row.checkTotal || undefined,
                        poNumber: row.poNumber || undefined,
                        isAch: row.isAch === 'true' || row.isAch === 'yes' || row.isAch === '1' ? true : undefined,
                        builderId: builderId as Id<'builders'> | undefined,
                        communityId: communityId as Id<'communities'> | undefined,
                        source: 'import',
                    });
                    results.blueBook.success++;
                } catch { results.blueBook.errors++; }
            }
        }

        setImportResult(results);
        setImporting(false);

        const totalSuccess = Object.values(results).reduce((s, r) => s + r.success, 0);
        const totalErrors = Object.values(results).reduce((s, r) => s + r.errors, 0);
        const summary = Object.entries(results)
            .filter(([, r]) => r.success > 0 || r.errors > 0)
            .map(([t, r]) => `${TARGET_LABELS[t as ActiveTarget]}: ${r.success}`)
            .join(', ');

        if (totalErrors === 0) {
            toast.success(`Imported ${totalSuccess} records — ${summary}`);
        } else {
            toast.warning(`Imported ${totalSuccess}, ${totalErrors} failed — ${summary}`);
        }
    };

    const handleClear = () => {
        setSelectedFile(null);
        setParsedRows([]);
        setImportResult(null);
        setOcrRawText(null);
        setOcrConfidence(0);
        setFieldMapping({});
        setMappingConfirmed(false);
        setDetectedTargets([]);
        setSelectedTargets(new Set());
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleMappingChange = (sourceCol: string, destField: string) => {
        setFieldMapping(prev => ({ ...prev, [sourceCol]: destField }));
        setMappingConfirmed(false);
    };

    // All 5 targets for manual selection
    const allTargets: ActiveTarget[] = ['blueBook', 'jobRequests', 'builders', 'communities', 'services'];

    return (
        <>
            <PageHeader
                title={t('import.title')}
                description={t('import.description')}
            />
            <main className="px-6 py-6 space-y-6">
                {/* File upload area */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.ods,.pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {!selectedFile ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                        >
                            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
                                Click to select a file
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                CSV, Excel, PDF, or Image (PNG, JPG)
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                                        isOcrFile ? 'bg-purple-500' : 'bg-green-500'
                                    }`}>
                                        {fileExt.toUpperCase().slice(0, 3)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                            {isOcrFile && ' — will use OCR'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={handleClear} className="text-sm text-gray-500 hover:text-red-500">
                                    Remove
                                </button>
                            </div>

                            {parsing && isOcrFile && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-1">
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Scanning document...</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500 rounded-full animate-pulse w-2/3" />
                                    </div>
                                </div>
                            )}

                            {parsedRows.length === 0 && !parsing && (
                                <button
                                    onClick={handleParseFile}
                                    disabled={parsing}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                                >
                                    {isOcrFile ? 'Scan & Parse' : 'Parse File'}
                                </button>
                            )}

                            {parsing && !isOcrFile && (
                                <div className="flex items-center justify-center py-3 text-gray-600 dark:text-gray-400">
                                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Parsing spreadsheet...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* OCR raw text */}
                {ocrRawText && parsedRows.length > 0 && (
                    <details className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            OCR Raw Text ({ocrConfidence}% confidence)
                        </summary>
                        <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-3 rounded">
                            {ocrRawText}
                        </pre>
                    </details>
                )}

                {/* Step 1: Route selection — checkboxes for detected targets */}
                {parsedRows.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            Route Data
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Select where this data should go. Multiple targets can be imported at once.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {allTargets.map((target) => {
                                const detected = detectedTargets.find(d => d.type === target);
                                const isSelected = selectedTargets.has(target);
                                return (
                                    <button
                                        key={target}
                                        onClick={() => toggleTarget(target)}
                                        className={`relative px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                                            isSelected
                                                ? TARGET_COLORS[target]
                                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                                isSelected
                                                    ? 'border-current bg-current/20'
                                                    : 'border-gray-300 dark:border-gray-600'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span>{TARGET_LABELS[target]}</span>
                                        </div>
                                        {detected && (
                                            <span className="text-[10px] opacity-70 mt-0.5 block ml-6">
                                                {detected.confidence}% match
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Column Mapping */}
                {parsedRows.length > 0 && selectedTargets.size > 0 && !mappingConfirmed && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Map Columns
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Review how each column maps to your selected fields.
                                </p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {mappedCount} of {columns.length} mapped
                            </span>
                        </div>

                        <div className="space-y-2 mb-6">
                            {columns.map((col) => {
                                const dest = fieldMapping[col] || '__skip__';
                                const isSkipped = dest === '__skip__';
                                const sampleValues = parsedRows
                                    .slice(0, 3)
                                    .map((r) => r[col])
                                    .filter(Boolean)
                                    .join(', ');
                                return (
                                    <div
                                        key={col}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                                            isSkipped
                                                ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 opacity-60'
                                                : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
                                        }`}
                                    >
                                        <div className="w-1/3 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{col}</p>
                                            {sampleValues && (
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                                    e.g. {sampleValues}
                                                </p>
                                            )}
                                        </div>
                                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                        <select
                                            value={dest}
                                            onChange={(e) => handleMappingChange(col, e.target.value)}
                                            className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-2 py-1.5"
                                        >
                                            <option value="__skip__">-- Skip --</option>
                                            {availableFields.map((f) => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mini preview */}
                        {mappedCount > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Preview (first 3 rows)</h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-slate-700">
                                            <tr>
                                                {Object.entries(fieldMapping)
                                                    .filter(([, v]) => v && v !== '__skip__')
                                                    .map(([, dest]) => (
                                                        <th key={dest} className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                                                            {availableFields.find(f => f.value === dest)?.label || dest}
                                                        </th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {parsedRows.slice(0, 3).map((raw, i) => {
                                                const mapped = remapRow(raw);
                                                return (
                                                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                                                        {Object.entries(fieldMapping)
                                                            .filter(([, v]) => v && v !== '__skip__')
                                                            .map(([, dest]) => (
                                                                <td key={dest} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                                                                    {mapped[dest] || <span className="text-gray-300 dark:text-gray-600">&mdash;</span>}
                                                                </td>
                                                            ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {mappedCount === 0 ? 'Map at least one column to proceed' : `${mappedCount} column${mappedCount > 1 ? 's' : ''} mapped`}
                            </p>
                            <button
                                onClick={() => setMappingConfirmed(true)}
                                disabled={mappedCount === 0}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm Mapping
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Final review + import */}
                {parsedRows.length > 0 && mappingConfirmed && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Ready to Import ({parsedRows.length} rows)
                                </h3>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {Array.from(selectedTargets).map(t => (
                                        <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border ${TARGET_COLORS[t]}`}>
                                            {TARGET_LABELS[t]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setMappingConfirmed(false)}
                                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                >
                                    Edit Mapping
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={importing || !!importResult}
                                    className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {importing ? 'Importing...' : `Import ${parsedRows.length} rows`}
                                </button>
                            </div>
                        </div>

                        {/* Import results breakdown */}
                        {importResult && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                                {Object.entries(importResult)
                                    .filter(([, r]) => r.success > 0 || r.errors > 0)
                                    .map(([t, r]) => (
                                        <div key={t} className={`px-3 py-2 rounded-lg border text-xs ${TARGET_COLORS[t as ActiveTarget]}`}>
                                            <p className="font-medium">{TARGET_LABELS[t as ActiveTarget]}</p>
                                            <p className="mt-0.5">
                                                <span className="text-green-600 dark:text-green-400">{r.success} done</span>
                                                {r.errors > 0 && <span className="text-red-500 ml-1">{r.errors} failed</span>}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        )}

                        <div className="overflow-x-auto max-h-96">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">#</th>
                                        {Object.entries(fieldMapping)
                                            .filter(([, v]) => v && v !== '__skip__')
                                            .map(([, dest]) => (
                                                <th key={dest} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                                    {availableFields.find(f => f.value === dest)?.label || dest}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {parsedRows.slice(0, 100).map((raw, i) => {
                                        const mapped = remapRow(raw);
                                        return (
                                            <tr key={i} className="text-gray-700 dark:text-gray-300">
                                                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                                                {Object.entries(fieldMapping)
                                                    .filter(([, v]) => v && v !== '__skip__')
                                                    .map(([, dest]) => (
                                                        <td key={dest} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                                                            {mapped[dest] || '—'}
                                                        </td>
                                                    ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {parsedRows.length > 100 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                                    Showing first 100 of {parsedRows.length} rows
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Supported formats */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm">
                        Supported Formats
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-800 dark:text-blue-200">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 font-bold text-[10px]">CSV</span>
                            <span>Comma-separated</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 font-bold text-[10px]">XLS</span>
                            <span>Excel spreadsheets</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-[10px]">PDF</span>
                            <span>OCR scan</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-[10px]">IMG</span>
                            <span>Photo OCR scan</span>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
