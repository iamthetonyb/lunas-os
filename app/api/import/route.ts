import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ParsedRow = Record<string, string>;

/**
 * POST /api/import — Parse uploaded file (CSV, Excel, or OCR text) into rows.
 * Returns normalized rows for the client to review before committing to Convex.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const ocrText = formData.get('ocrText') as string | null;

        // If OCR text was sent (PDF/image processed client-side), parse it
        if (ocrText) {
            const rows = parseOcrText(ocrText);
            return NextResponse.json({ success: true, rows, source: 'ocr' });
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const ext = file.name.split('.').pop()?.toLowerCase();
        let rows: ParsedRow[] = [];

        if (ext === 'csv') {
            const text = await file.text();
            rows = parseCsv(text);
        } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
            const buffer = await file.arrayBuffer();
            rows = parseExcel(buffer);
        } else {
            return NextResponse.json(
                { error: `Unsupported file type: .${ext}. Use CSV, Excel, or process images/PDFs client-side with OCR.` },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, rows, source: ext, rowCount: rows.length });
    } catch (err: any) {
        console.error('Import error:', err);
        return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
    }
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

    // Try to detect tabular data — lines with consistent delimiters
    const tabCount = lines.filter((l) => l.includes('\t')).length;
    const pipeCount = lines.filter((l) => l.includes('|')).length;

    if (tabCount > lines.length * 0.5) {
        // Tab-delimited OCR output
        return parseCsv(lines.join('\n').replace(/\t/g, ','));
    }

    if (pipeCount > lines.length * 0.5) {
        // Pipe-delimited (common in OCR table detection)
        const cleaned = lines
            .map((l) => l.replace(/^\||\|$/g, '').trim())
            .filter((l) => !l.match(/^[-|+\s]+$/)); // remove separator lines
        return parseCsv(cleaned.join('\n').replace(/\|/g, ','));
    }

    // Fallback: try CSV-like parsing
    if (lines[0].includes(',')) {
        return parseCsv(lines.join('\n'));
    }

    // Last resort: each line is a row with space-separated values
    // Return raw lines with index
    return lines.map((line, i) => ({ lineNumber: String(i + 1), rawText: line }));
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Normalize column headers to match Blue Book / Job Request field names */
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
