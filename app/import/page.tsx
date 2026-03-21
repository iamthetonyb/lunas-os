'use client';

import { PageHeader } from '@/components/page-header';
import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

type ParsedRow = Record<string, string>;

type ImportTarget = 'auto' | 'blueBook' | 'jobRequests' | 'builders' | 'communities' | 'services' | 'unknown';

// Column → destination field mapping
type FieldMapping = Record<string, string>; // sourceCol → destField or '__skip__'

const OCR_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'];
const TARGET_LABELS: Record<ImportTarget, string> = {
    auto: 'Auto-Detect',
    blueBook: 'Blue Book',
    jobRequests: 'Job Requests',
    builders: 'Builders',
    communities: 'Communities',
    services: 'Services',
    unknown: 'Unknown',
};

// Destination fields per import target
const TARGET_FIELDS: Record<Exclude<ImportTarget, 'unknown' | 'auto'>, { value: string; label: string }[]> = {
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
        { value: 'name', label: 'Builder Name' },
    ],
    communities: [
        { value: 'name', label: 'Community Name' },
        { value: 'builderName', label: 'Builder Name' },
    ],
    services: [
        { value: 'name', label: 'Service Name' },
    ],
};

export default function ImportPage() {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [importTarget, setImportTarget] = useState<ImportTarget>('auto');
    const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
    const [ocrRawText, setOcrRawText] = useState<string | null>(null);
    const [ocrConfidence, setOcrConfidence] = useState(0);
    const [detectionConfidence, setDetectionConfidence] = useState(0);
    const [unmappedCols, setUnmappedCols] = useState<string[]>([]);
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
    const [mappingConfirmed, setMappingConfirmed] = useState(false);
    const [autoDetectedTarget, setAutoDetectedTarget] = useState<ImportTarget>('unknown');

    // When "Auto-Detect" is selected, use whatever the server detected
    const resolvedTarget: ImportTarget = importTarget === 'auto' ? autoDetectedTarget : importTarget;

    // Convex data for resolving names → IDs
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
            setAutoDetectedTarget('unknown');
        }
    };

    const handleParseFile = async () => {
        if (!selectedFile) return;
        setParsing(true);
        setParsedRows([]);

        try {
            // All processing happens server-side:
            // - CSV/Excel: parsed with papaparse/xlsx
            // - PDF/Images: OCR via PaddleOCR v5 + ONNX Runtime
            const formData = new FormData();
            formData.append('file', selectedFile);
            if (isOcrFile) formData.append('ocr', 'true');

            const res = await fetch('/api/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setParsedRows(data.rows ?? []);
            setMappingConfirmed(false);

            // Store auto-detected type (used when importTarget === 'auto')
            if (data.detectedType && data.detectedType !== 'unknown') {
                setAutoDetectedTarget(data.detectedType);
                setDetectionConfidence(data.confidence ?? 0);
            }
            setUnmappedCols(data.unmappedColumns ?? []);

            // Build initial field mapping from auto-detection
            const autoMapping: FieldMapping = {};
            if (data.fieldMapping) {
                for (const [src, dest] of Object.entries(data.fieldMapping)) {
                    autoMapping[src] = dest as string;
                }
            }
            // Mark unmapped columns as skip
            for (const col of data.unmappedColumns ?? []) {
                if (!autoMapping[col]) autoMapping[col] = '__skip__';
            }
            setFieldMapping(autoMapping);

            if (data.ocrText) {
                setOcrRawText(data.ocrText);
                setOcrConfidence(data.ocrConfidence ?? 0);
            }

            const targetLabel = TARGET_LABELS[data.detectedType as ImportTarget] ?? 'data';
            const msg = isOcrFile
                ? `OCR complete — ${data.rows?.length ?? 0} rows detected as ${targetLabel} (${data.ocrConfidence ?? 0}% OCR confidence)`
                : `Parsed ${data.rows?.length ?? 0} rows — detected as ${targetLabel} (${data.confidence ?? 0}% match)`;
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

    // Remap a raw row using the user-confirmed field mapping
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

    const handleImport = async () => {
        if (parsedRows.length === 0 || resolvedTarget === 'unknown' || resolvedTarget === 'auto' || !mappingConfirmed) return;
        setImporting(true);
        let success = 0;
        let errors = 0;

        for (const raw of parsedRows) {
            const row = remapRow(raw);
            try {
                if (resolvedTarget === 'blueBook') {
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
                } else if (resolvedTarget === 'jobRequests') {
                    const builderId = resolveId(row.builderName, builders);
                    const communityId = resolveId(row.communityName, communities);
                    const services = row.serviceName
                        ? [{ serviceName: row.serviceName, scheduledDate: row.startDate || undefined }]
                        : [];
                    if (services.length === 0) { errors++; continue; }
                    await createJobRequest({
                        lot: row.lot || undefined,
                        dueDate: row.dueDate || row.startDate || undefined,
                        address: row.address || undefined,
                        notes: row.notes || undefined,
                        poNumber: row.poNumber || undefined,
                        builderId: builderId as Id<'builders'> | undefined,
                        communityId: communityId as Id<'communities'> | undefined,
                        services,
                    });
                } else if (resolvedTarget === 'builders') {
                    const name = row.name || row.builderName;
                    if (!name) { errors++; continue; }
                    await createBuilder({ name });
                } else if (resolvedTarget === 'communities') {
                    const name = row.name || row.communityName;
                    if (!name) { errors++; continue; }
                    const builderId = resolveId(row.builderName, builders);
                    await createCommunity({
                        name,
                        builderId: builderId as Id<'builders'> | undefined,
                    });
                } else if (resolvedTarget === 'services') {
                    const name = row.name || row.serviceName;
                    if (!name) { errors++; continue; }
                    await createService({ name });
                }
                success++;
            } catch (err) {
                console.error('Row import error:', err);
                errors++;
            }
        }

        setImportResult({ success, errors });
        setImporting(false);
        if (errors === 0) {
            toast.success(`Imported ${success} ${TARGET_LABELS[resolvedTarget]} records`);
        } else {
            toast.warning(`Imported ${success}, ${errors} failed`);
        }
    };

    const handleClear = () => {
        setSelectedFile(null);
        setParsedRows([]);
        setImportResult(null);
        setOcrRawText(null);
        setOcrConfidence(0);
        setDetectionConfidence(0);
        setUnmappedCols([]);
        setFieldMapping({});
        setMappingConfirmed(false);
        setAutoDetectedTarget('unknown');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleChangeTarget = (target: ImportTarget) => {
        setImportTarget(target);
        setMappingConfirmed(false);
        // Determine the effective target for field lookup
        const effective = target === 'auto' ? autoDetectedTarget : target;
        if (effective !== 'unknown' && effective !== 'auto' && columns.length > 0) {
            const fields = TARGET_FIELDS[effective];
            const fieldValues = new Set(fields.map(f => f.value));
            const newMapping: FieldMapping = {};
            for (const col of columns) {
                const current = fieldMapping[col];
                if (current && current !== '__skip__' && fieldValues.has(current)) {
                    newMapping[col] = current;
                } else if (fieldValues.has(col)) {
                    newMapping[col] = col;
                } else {
                    newMapping[col] = '__skip__';
                }
            }
            setFieldMapping(newMapping);
        }
    };

    const handleMappingChange = (sourceCol: string, destField: string) => {
        setFieldMapping(prev => ({ ...prev, [sourceCol]: destField }));
        setMappingConfirmed(false);
    };

    // Count how many columns are mapped (not skipped)
    const mappedCount = Object.values(fieldMapping).filter(v => v && v !== '__skip__').length;
    const availableFields = resolvedTarget !== 'unknown' && resolvedTarget !== 'auto' ? TARGET_FIELDS[resolvedTarget] : [];

    return (
        <>
            <PageHeader
                title={t('import.title')}
                description={t('import.description')}
            />
            <main className="px-6 py-6 space-y-6">
                {/* Import target selector — auto-detected but overridable */}
                <div className="flex flex-wrap items-center gap-2">
                    {(['auto', 'blueBook', 'jobRequests', 'builders', 'communities', 'services'] as ImportTarget[]).map((target) => (
                        <button
                            key={target}
                            onClick={() => handleChangeTarget(target)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                importTarget === target
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            {TARGET_LABELS[target]}
                        </button>
                    ))}
                    {detectionConfidence > 0 && resolvedTarget !== 'unknown' && parsedRows.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            Detected: {TARGET_LABELS[resolvedTarget]} ({detectionConfidence}% match)
                        </span>
                    )}
                </div>

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

                            {/* OCR processing indicator */}
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

                            {/* Parse button */}
                            {parsedRows.length === 0 && !parsing && (
                                <button
                                    onClick={handleParseFile}
                                    disabled={parsing}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                                >
                                    {isOcrFile ? 'Run OCR & Parse' : 'Parse File'}
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

                {/* OCR raw text preview */}
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

                {/* Step 2: Column Mapping */}
                {parsedRows.length > 0 && !mappingConfirmed && resolvedTarget !== 'unknown' && resolvedTarget !== 'auto' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Map Columns
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Review how each column maps to {TARGET_LABELS[resolvedTarget]} fields. Change any mapping or skip columns you don&apos;t need.
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
                                            <option value="__skip__">-- Skip (don&apos;t import) --</option>
                                            {availableFields.map((f) => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sample preview with current mapping */}
                        {mappedCount > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Preview with mapping (first 3 rows)</h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-slate-700">
                                            <tr>
                                                {Object.entries(fieldMapping)
                                                    .filter(([, v]) => v && v !== '__skip__')
                                                    .map(([, dest]) => {
                                                        const label = availableFields.find(f => f.value === dest)?.label || dest;
                                                        return (
                                                            <th key={dest} className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                                                                {label}
                                                            </th>
                                                        );
                                                    })}
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
                                                                    {mapped[dest] || <span className="text-gray-300 dark:text-gray-600">—</span>}
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
                                {mappedCount === 0
                                    ? 'Map at least one column to proceed'
                                    : `${mappedCount} column${mappedCount > 1 ? 's' : ''} will be imported`}
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

                {/* Step 3: Final preview + import */}
                {parsedRows.length > 0 && mappingConfirmed && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Ready to Import ({parsedRows.length} rows)
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Importing as <strong>{TARGET_LABELS[resolvedTarget]}</strong> with {mappedCount} mapped field{mappedCount > 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setMappingConfirmed(false)}
                                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                >
                                    Edit Mapping
                                </button>
                                {importResult && (
                                    <span className="text-sm">
                                        <span className="text-green-600 font-medium">{importResult.success} imported</span>
                                        {importResult.errors > 0 && (
                                            <span className="text-red-500 font-medium ml-2">{importResult.errors} failed</span>
                                        )}
                                    </span>
                                )}
                                <button
                                    onClick={handleImport}
                                    disabled={importing || !!importResult}
                                    className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {importing ? 'Importing...' : `Import ${parsedRows.length} rows`}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-96">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">#</th>
                                        {Object.entries(fieldMapping)
                                            .filter(([, v]) => v && v !== '__skip__')
                                            .map(([, dest]) => {
                                                const label = availableFields.find(f => f.value === dest)?.label || dest;
                                                return (
                                                    <th key={dest} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                                        {label}
                                                    </th>
                                                );
                                            })}
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
