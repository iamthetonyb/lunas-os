import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ParsedRow = Record<string, string>;

const OCR_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'];

/**
 * POST /api/import — Parse uploaded file into structured rows.
 *
 * - CSV/Excel: parsed server-side with papaparse/xlsx
 * - PDF/Images: OCR via PaddleOCR v5 (ONNX Runtime, server-side)
 * - ocrText field: raw text already OCR'd, parse into rows
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const ocrText = formData.get('ocrText') as string | null;
        const doOcr = formData.get('ocr') === 'true';

        // If pre-OCR'd text was sent, parse it
        if (ocrText) {
            const rows = parseOcrText(ocrText);
            const detection = detectDataType(rows);
            return NextResponse.json({ success: true, rows, source: 'ocr', ...detection });
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

        // OCR path: PDF/image files
        if (doOcr || OCR_EXTENSIONS.includes(ext)) {
            const { text, confidence } = await runPaddleOcr(file);
            const rows = parseOcrText(text);
            const detection = detectDataType(rows);
            return NextResponse.json({
                success: true,
                rows,
                source: 'ocr',
                rowCount: rows.length,
                ocrText: text,
                ocrConfidence: confidence,
                ...detection,
            });
        }

        // Spreadsheet path
        let rows: ParsedRow[] = [];
        if (ext === 'csv') {
            const text = await file.text();
            rows = parseCsv(text);
        } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
            const buffer = await file.arrayBuffer();
            rows = parseExcel(buffer);
        } else {
            return NextResponse.json(
                { error: `Unsupported file type: .${ext}` },
                { status: 400 }
            );
        }

        const detection = detectDataType(rows);
        return NextResponse.json({
            success: true,
            rows,
            source: ext,
            rowCount: rows.length,
            ...detection,
        });
    } catch (err: any) {
        console.error('Import error:', err);
        return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
    }
}

// ── PaddleOCR ────────────────────────────────────────────────────────

async function runPaddleOcr(file: File): Promise<{ text: string; confidence: number }> {
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Dynamic imports to avoid bundling ONNX/sharp at build time
    const { PaddleOcrService } = await import('paddleocr');
    const ort = await import('onnxruntime-node');
    const sharp = (await import('sharp')).default;

    // Preprocess: convert to high-contrast grayscale, boost to 300 DPI equivalent
    const image = sharp(rawBuffer)
        .grayscale()
        .normalize()      // maximize contrast
        .sharpen()         // sharpen edges for better text detection
        .resize({ width: 2400, withoutEnlargement: true }); // ~300 DPI for letter-size

    const { data, info } = await image
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // PaddleOCR expects { data: Uint8Array, width, height } with RGB channels
    // sharp grayscale outputs 1 channel — expand to 3 channels
    const rgb = new Uint8Array(info.width * info.height * 3);
    for (let i = 0; i < data.length; i++) {
        rgb[i * 3] = data[i];
        rgb[i * 3 + 1] = data[i];
        rgb[i * 3 + 2] = data[i];
    }

    const imageInput = {
        data: rgb,
        width: info.width,
        height: info.height,
    };

    const service = new PaddleOcrService({ ort: ort as any });
    await service.initialize();
    const result = await service.recognize(imageInput as any);
    await service.destroy();

    // Combine all detected text blocks
    const lines: string[] = [];
    let totalConfidence = 0;
    let blockCount = 0;

    if (Array.isArray(result)) {
        for (const block of result) {
            const text = (block as any).text ?? (block as any).value ?? '';
            const score = (block as any).score ?? (block as any).confidence ?? 0;
            if (text) {
                lines.push(text);
                totalConfidence += score;
                blockCount++;
            }
        }
    }

    return {
        text: lines.join('\n'),
        confidence: blockCount > 0 ? Math.round((totalConfidence / blockCount) * 100) : 0,
    };
}

// ── Parsers ──────────────────────────────────────────────────────────

function parseCsv(text: string): ParsedRow[] {
    const result = Papa.parse<ParsedRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => normalizeHeader(h),
    });
    return result.data;
}

function parseExcel(buffer: ArrayBuffer): ParsedRow[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    return raw.map((row) => {
        const normalized: ParsedRow = {};
        for (const [key, val] of Object.entries(row)) {
            normalized[normalizeHeader(key)] = String(val ?? '').trim();
        }
        return normalized;
    });
}

function parseOcrText(text: string): ParsedRow[] {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // Detect tabular delimiters
    const tabCount = lines.filter((l) => l.includes('\t')).length;
    const pipeCount = lines.filter((l) => l.includes('|')).length;

    if (tabCount > lines.length * 0.5) {
        return parseCsv(lines.join('\n').replace(/\t/g, ','));
    }

    if (pipeCount > lines.length * 0.5) {
        const cleaned = lines
            .map((l) => l.replace(/^\||\|$/g, '').trim())
            .filter((l) => !l.match(/^[-|+\s]+$/));
        return parseCsv(cleaned.join('\n').replace(/\|/g, ','));
    }

    if (lines[0].includes(',')) {
        return parseCsv(lines.join('\n'));
    }

    // Fallback: raw lines
    return lines.map((line, i) => ({ lineNumber: String(i + 1), rawText: line }));
}

// ── Auto-Detection ───────────────────────────────────────────────────

type ImportTarget = 'blueBook' | 'jobRequests' | 'builders' | 'communities' | 'services' | 'unknown';

type TargetScore = { type: ImportTarget; confidence: number };

/**
 * Multi-route detection: score ALL targets independently so a single
 * contract/spreadsheet can fan out to builders, communities, job requests,
 * blue book entries, etc. in one import.
 *
 * Each target has required + bonus columns. A target qualifies if at least
 * one of its required columns is present.
 */
function detectDataType(rows: ParsedRow[]): {
    detectedType: ImportTarget;
    confidence: number;
    detectedTargets: TargetScore[];
    fieldMapping: Record<string, string>;
    unmappedColumns: string[];
} {
    const empty = { detectedType: 'unknown' as ImportTarget, confidence: 0, detectedTargets: [], fieldMapping: {}, unmappedColumns: [] };
    if (rows.length === 0) return empty;

    const allCols = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => allCols.add(k)));
    const cols = Array.from(allCols);

    // ── Per-target field definitions ──────────────────────────────────
    // "required" = at least 1 must be present for the target to qualify
    // "strong"   = heavily weighted (3 pts vs 1 pt)
    const targets: Record<Exclude<ImportTarget, 'unknown'>, {
        required: Set<string>; strong: Set<string>; all: Set<string>;
    }> = {
        blueBook: {
            required: new Set(['amount', 'checkNumber', 'invoiceNumber', 'checkTotal', 'isAch']),
            strong: new Set(['checkNumber', 'checkDate', 'checkTotal', 'invoiceNumber', 'isAch', 'accountCategoryCode', 'accountCategoryName', 'amount']),
            all: new Set(['lot', 'communityName', 'builderName', 'amount', 'checkNumber', 'checkDate', 'checkTotal', 'invoiceNumber', 'isAch', 'poNumber', 'accountCategoryName', 'accountCategoryCode', 'startDate', 'status', 'modelPlanCode', 'modelPlanSqft', 'assignedForemanName', 'crewName', 'serviceName']),
        },
        jobRequests: {
            required: new Set(['serviceName', 'lot']),
            strong: new Set(['dueDate', 'address', 'notes', 'serviceName']),
            all: new Set(['lot', 'communityName', 'builderName', 'serviceName', 'dueDate', 'startDate', 'address', 'notes', 'poNumber', 'assignedForemanName', 'crewName', 'status']),
        },
        builders: {
            required: new Set(['builderName']),
            strong: new Set(['builderName']),
            all: new Set(['builderName']),
        },
        communities: {
            required: new Set(['communityName']),
            strong: new Set(['communityName']),
            all: new Set(['communityName', 'builderName']),
        },
        services: {
            required: new Set(['serviceName']),
            strong: new Set(['serviceName']),
            all: new Set(['serviceName']),
        },
    };

    // ── Score every target independently ──────────────────────────────
    const fieldMapping: Record<string, string> = {};
    const allKnown = new Set<string>();
    const detectedTargets: TargetScore[] = [];

    for (const [targetName, def] of Object.entries(targets)) {
        let score = 0;
        let hasRequired = false;

        for (const col of cols) {
            if (def.all.has(col)) {
                score += def.strong.has(col) ? 3 : 1;
                allKnown.add(col);
                if (!fieldMapping[col]) fieldMapping[col] = col;
            }
            if (def.required.has(col)) hasRequired = true;
        }

        if (hasRequired && score > 0) {
            // Entity targets (builders/communities/services) only qualify
            // as standalone when column count is low — otherwise they're
            // just part of a larger dataset and will be auto-created
            const isEntity = ['builders', 'communities', 'services'].includes(targetName);
            const isStandaloneEntity = isEntity && cols.length <= 4;

            if (!isEntity || isStandaloneEntity || score >= 3) {
                const maxPossible = Array.from(def.all).reduce((sum, f) => sum + (def.strong.has(f) ? 3 : 1), 0);
                const confidence = Math.min(95, Math.round((score / maxPossible) * 100));
                detectedTargets.push({ type: targetName as ImportTarget, confidence });
            }
        }
    }

    // Sort by confidence descending
    detectedTargets.sort((a, b) => b.confidence - a.confidence);

    // Unmapped columns
    const unmappedColumns = cols.filter(c => !allKnown.has(c) && !['lineNumber', 'rawText'].includes(c));

    // Primary = highest confidence
    const primary = detectedTargets[0];
    return {
        detectedType: primary?.type ?? 'unknown',
        confidence: primary?.confidence ?? 0,
        detectedTargets,
        fieldMapping,
        unmappedColumns,
    };
}

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeHeader(raw: string): string {
    const h = raw.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const map: Record<string, string> = {
        lot: 'lot',
        lotnumber: 'lot',
        lotno: 'lot',
        community: 'communityName',
        communityname: 'communityName',
        subdivision: 'communityName',
        builder: 'builderName',
        buildername: 'builderName',
        service: 'serviceName',
        servicename: 'serviceName',
        servicedescription: 'serviceName',
        accountcategory: 'accountCategoryName',
        accountcategoryname: 'accountCategoryName',
        accountcategorycode: 'accountCategoryCode',
        acctcatcode: 'accountCategoryCode',
        startdate: 'startDate',
        date: 'startDate',
        scheduledate: 'startDate',
        scheduleddate: 'startDate',
        duedate: 'dueDate',
        status: 'status',
        amount: 'amount',
        total: 'amount',
        price: 'amount',
        checknumber: 'checkNumber',
        checkno: 'checkNumber',
        checknum: 'checkNumber',
        checkdate: 'checkDate',
        checktotal: 'checkTotal',
        invoicenumber: 'invoiceNumber',
        invoiceno: 'invoiceNumber',
        invoice: 'invoiceNumber',
        ponumber: 'poNumber',
        po: 'poNumber',
        foreman: 'assignedForemanName',
        foremanname: 'assignedForemanName',
        crew: 'crewName',
        crewname: 'crewName',
        address: 'address',
        modelplan: 'modelPlanCode',
        model: 'modelPlanCode',
        plan: 'modelPlanCode',
        sqft: 'modelPlanSqft',
        squarefeet: 'modelPlanSqft',
        notes: 'notes',
        ach: 'isAch',
    };
    return map[h] || raw.trim();
}
