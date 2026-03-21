'use client';

import { PageHeader } from '@/components/page-header';
import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

type ParsedRow = Record<string, string>;

type ImportTarget = 'blueBook' | 'jobRequests' | 'builders' | 'communities' | 'services' | 'unknown';

const OCR_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'];
const SPREADSHEET_EXTENSIONS = ['csv', 'xlsx', 'xls', 'ods'];

const TARGET_LABELS: Record<ImportTarget, string> = {
    blueBook: 'Blue Book',
    jobRequests: 'Job Requests',
    builders: 'Builders',
    communities: 'Communities',
    services: 'Services',
    unknown: 'Unknown',
};

export default function ImportPage() {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [importTarget, setImportTarget] = useState<ImportTarget>('blueBook');
    const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
    const [ocrRawText, setOcrRawText] = useState<string | null>(null);
    const [ocrConfidence, setOcrConfidence] = useState(0);
    const [detectionConfidence, setDetectionConfidence] = useState(0);
    const [unmappedCols, setUnmappedCols] = useState<string[]>([]);

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
    const isSpreadsheet = SPREADSHEET_EXTENSIONS.includes(fileExt);
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

            // Auto-detect data type from columns
            if (data.detectedType && data.detectedType !== 'unknown') {
                setImportTarget(data.detectedType);
                setDetectionConfidence(data.confidence ?? 0);
            }
            setUnmappedCols(data.unmappedColumns ?? []);

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

    const handleImport = async () => {
        if (parsedRows.length === 0 || importTarget === 'unknown') return;
        setImporting(true);
        let success = 0;
        let errors = 0;

        for (const row of parsedRows) {
            try {
                if (importTarget === 'blueBook') {
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
                } else if (importTarget === 'jobRequests') {
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
                } else if (importTarget === 'builders') {
                    const name = row.builderName || row.name;
                    if (!name) { errors++; continue; }
                    await createBuilder({ name });
                } else if (importTarget === 'communities') {
                    const name = row.communityName || row.name;
                    if (!name) { errors++; continue; }
                    const builderId = resolveId(row.builderName, builders);
                    await createCommunity({
                        name,
                        builderId: builderId as Id<'builders'> | undefined,
                    });
                } else if (importTarget === 'services') {
                    const name = row.serviceName || row.name;
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
            toast.success(`Imported ${success} ${TARGET_LABELS[importTarget]} records`);
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
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <>
            <PageHeader
                title={t('import.title')}
                description={t('import.description')}
            />
            <main className="px-6 py-6 space-y-6">
                {/* Import target selector — auto-detected but overridable */}
                <div className="flex flex-wrap items-center gap-2">
                    {(['blueBook', 'jobRequests', 'builders', 'communities', 'services'] as ImportTarget[]).map((target) => (
                        <button
                            key={target}
                            onClick={() => setImportTarget(target)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                importTarget === target
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            {TARGET_LABELS[target]}
                        </button>
                    ))}
                    {detectionConfidence > 0 && parsedRows.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            Auto-detected: {TARGET_LABELS[importTarget]} ({detectionConfidence}% match)
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
                                CSV, Excel, PDF, or Image (PNG, JPG) — OCR powered by Tesseract.js
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
                                        <span>Running PaddleOCR v5 — scanning document...</span>
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
                            OCR Raw Text ({ocrConfidence}% confidence) — PaddleOCR v5
                        </summary>
                        <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-3 rounded">
                            {ocrRawText}
                        </pre>
                    </details>
                )}

                {/* Preview table */}
                {parsedRows.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        {unmappedCols.length > 0 && (
                            <div className="mb-3 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                                <strong>Unmapped columns:</strong> {unmappedCols.join(', ')} — these won't be imported. If they contain important data, check the column names match expected fields.
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Preview ({parsedRows.length} rows)
                            </h3>
                            <div className="flex items-center gap-3">
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
                                        {columns.map((col) => (
                                            <th key={col} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {parsedRows.slice(0, 100).map((row, i) => (
                                        <tr key={i} className="text-gray-700 dark:text-gray-300">
                                            <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                                            {columns.map((col) => (
                                                <td key={col} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                                                    {row[col] || '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
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
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        PDF and image files are processed server-side using PaddleOCR v5 (ONNX Runtime) for high-accuracy text recognition with preprocessing.
                    </p>
                </div>
            </main>
        </>
    );
}
