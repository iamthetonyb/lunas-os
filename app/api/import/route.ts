import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { generateObject, generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { tryParseBlueBook, excelSheetToText } from './parse-blue-book';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ParsedRow = Record<string, string>;

const OCR_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'];

/**
 * POST /api/import — Parse uploaded file into structured rows.
 *
 * - CSV/Excel: parsed server-side with papaparse/xlsx
 * - PDF/Images: Vision LLM extracts structured data (Sharp preprocessing → GPT-4o-mini)
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
        const fileNameHints = extractFileNameHints(file.name);

        // Vision OCR path: PDF/image files → Sharp preprocessing → Vision LLM
        if (doOcr || OCR_EXTENSIONS.includes(ext)) {
            const { rows, rawText, confidence } = await runVisionOcr(file);
            const detection = detectDataType(rows, fileNameHints);
            return NextResponse.json({
                success: true,
                rows,
                source: 'ocr',
                rowCount: rows.length,
                ocrText: rawText,
                ocrConfidence: confidence,
                ...detection,
            });
        }

        // Spreadsheet path
        let rows: ParsedRow[] = [];
        let source = ext;
        if (ext === 'csv') {
            const text = await file.text();
            rows = parseCsv(text);
        } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
            const buffer = await file.arrayBuffer();
            rows = parseExcel(buffer);

            // If heuristic parsing found nothing useful, fall back to LLM extraction
            if (rows.length === 0 || !hasRecognizedFields(rows)) {
                const text = excelSheetToText(buffer);
                if (text.length > 50) {
                    const result = await generateObject({
                        model: getExtractionModel(),
                        schema: visionRowSchema,
                        messages: [{
                            role: 'user',
                            content: EXTRACTION_PROMPT + '\n\nSpreadsheet data:\n' + text,
                        }],
                    });
                    const llmResult = buildOcrResult(result.object);
                    if (llmResult.rows.length > 0) {
                        rows = llmResult.rows;
                        source = 'llm';
                    }
                }
            }
        } else {
            return NextResponse.json(
                { error: `Unsupported file type: .${ext}` },
                { status: 400 }
            );
        }

        const detection = detectDataType(rows, fileNameHints);
        return NextResponse.json({
            success: true,
            rows,
            source,
            rowCount: rows.length,
            ...detection,
        });
    } catch (err: any) {
        console.error('Import error:', err);
        return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
    }
}

// ── Vision OCR (Sharp + Vision LLM) ─────────────────────────────────

// Model priority: Gemini 2.5 Flash Lite (1K free/mo) → GPT-5 Nano (OpenRouter) → GPT-4o-mini (OpenAI)
function getExtractionModel() {
    // 1. Google AI — Gemini 2.5 Flash Lite (FREE tier: 1K pages/mo)
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
        return google('gemini-2.5-flash-lite');
    }
    // 2. OpenRouter — GPT-5 Nano ($0.05/M input)
    if (process.env.OPENROUTER_API_KEY) {
        const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
        return openrouter('openai/gpt-5-nano');
    }
    // 3. Direct OpenAI — GPT-4o-mini ($0.15/M)
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai('gpt-4o-mini');
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'];

const extractedRowSchema = z.object({
    field: z.string().describe('Field name (e.g. builderName, serviceName, amount, modelPlanCode, unitRate)'),
    value: z.string().describe('The value for this field'),
});

const visionRowSchema = z.object({
    rows: z.array(z.array(extractedRowSchema)).describe(
        'Each distinct data row from the document as an array of field-value pairs. Use normalized field names: ' +
        'lot, communityName, builderName, serviceName, amount, checkNumber, checkDate, checkTotal, ' +
        'invoiceNumber, poNumber, dueDate, startDate, address, status, notes, modelPlanCode, ' +
        'modelPlanSqft, contactName, contactEmail, pricePerSqft, unitRate, unitType, scopeOfWork, ' +
        'equipmentType, rentalRate, rentalPeriod, proposalDate, effectiveDate, category'
    ),
    rawText: z.string().describe('The full raw text content of the document, preserving layout'),
    documentType: z.string().describe('Type of document: proposal, contract, invoice, spreadsheet, ledger, schedule, form, other'),
    confidence: z.number().min(0).max(100).describe('How confident you are in the extraction accuracy (0-100)'),
});

const EXTRACTION_PROMPT = `Extract ALL structured data from this construction document.

Rules:
- Return every distinct data item as its own object in the rows array
- For MODEL PLAN tables: each plan row gets its own object with modelPlanCode, modelPlanSqft, pricePerSqft, amount
- For ADDITIONAL WORK / EQUIPMENT items (trucks, dumpsters, laborers, pressure washers, bobcats, etc.): each gets its own row with serviceName, unitRate, unitType (e.g. "per hour", "per unit", "7 day rental"), category="additionalWork"
- For CONTRACTOR INFO: one row with builderName, communityName, contactName, contactEmail, proposalDate, effectiveDate, scopeOfWork, category="contractInfo"
- For invoice line items: each line gets its own row with serviceName, amount, checkNumber, invoiceNumber, etc.
- Use these field names when the data matches: lot, communityName, builderName, serviceName, amount, checkNumber, checkDate, checkTotal, invoiceNumber, poNumber, dueDate, startDate, address, status, notes, modelPlanCode, modelPlanSqft, pricePerSqft, unitRate, unitType, contactName, contactEmail, proposalDate, effectiveDate, scopeOfWork, equipmentType, rentalRate, rentalPeriod, category
- All values must be strings
- Capture EVERYTHING — even data we don't route yet (equipment rates, contact info, scope descriptions) is valuable
- Include the full raw text preserving layout
- Rate your confidence 0-100`;

async function runVisionOcr(file: File): Promise<{ rows: ParsedRow[]; rawText: string; confidence: number }> {
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isPdf = ext === 'pdf';
    const isImage = IMAGE_EXTENSIONS.includes(ext);

    if (isPdf) {
        // Extract text from PDF using pdfjs-dist (pure JS, no native deps)
        const pdfText = await extractPdfText(rawBuffer);

        if (pdfText.trim().length > 50) {
            // Text-based PDF — send extracted text to LLM for structured parsing (no vision needed)
            const result = await generateObject({
                model: getExtractionModel(),
                schema: visionRowSchema,
                messages: [{
                    role: 'user',
                    content: EXTRACTION_PROMPT + '\n\nDocument text:\n' + pdfText,
                }],
            });
            return buildOcrResult(result.object);
        }
        // Scanned/image-only PDF — fall through to error for now
        throw new Error('Scanned PDF detected — image-only PDFs require a canvas renderer. Please convert to PNG/JPG first.');
    }

    if (!isImage) throw new Error(`Unsupported file type for vision OCR: .${ext}`);

    // Image files: Sharp preprocessing → single-call vision extraction
    const sharp = (await import('sharp')).default;
    const processed = await sharp(rawBuffer)
        .grayscale()
        .normalize()
        .sharpen()
        .resize({ width: 2400, withoutEnlargement: true })
        .removeAlpha()
        .jpeg({ quality: 85 })
        .toBuffer();

    // Single call: vision → text with embedded JSON extraction
    const visionPrompt = `You are a construction document parser. Look at this image and extract ALL data.

Return your response in EXACTLY this format — raw text first, then JSON:

---RAW TEXT---
(paste all text you can read from the image here, preserving layout)

---JSON DATA---
(a JSON array of objects, each object representing one data row with these field names when applicable: lot, communityName, builderName, serviceName, amount, checkNumber, checkDate, checkTotal, invoiceNumber, poNumber, startDate, status, modelPlanCode, modelPlanSqft, assignedForemanName, crewName, address, notes)

Example JSON:
[{"lot":"101","communityName":"Highrock","builderName":"Toll Brothers","serviceName":"Frame Sweep","startDate":"7/31","assignedForemanName":"Connie"}]

Extract EVERY row of data you can see. All values must be strings.`;

    const textResult = await generateText({
        model: getExtractionModel(),
        messages: [{
            role: 'user',
            content: [
                { type: 'image' as const, image: new Uint8Array(processed) },
                { type: 'text' as const, text: visionPrompt },
            ],
        }],
    });

    const fullResponse = textResult.text;

    // Parse the response: extract raw text and JSON sections
    const rawTextMatch = fullResponse.match(/---RAW TEXT---\s*([\s\S]*?)(?=---JSON DATA---|$)/i);
    const jsonMatch = fullResponse.match(/---JSON DATA---\s*([\s\S]*)/i);
    const rawText = rawTextMatch?.[1]?.trim() || fullResponse;

    let rows: ParsedRow[] = [];
    let confidence = 30;

    if (jsonMatch) {
        try {
            // Extract JSON array from the response (handle markdown code fences)
            let jsonStr = jsonMatch[1].trim();
            jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                rows = parsed.map((row: any) => {
                    const normalized: ParsedRow = {};
                    for (const [key, val] of Object.entries(row)) {
                        if (val !== null && val !== undefined && val !== '') {
                            normalized[normalizeHeader(key)] = String(val).trim();
                        }
                    }
                    return normalized;
                }).filter((r: ParsedRow) => Object.keys(r).length > 0);
                confidence = 70;
            }
        } catch (parseErr) {
            console.warn('JSON extraction from vision failed, falling back to text parsing:', parseErr);
        }
    }

    // Fallback: if JSON extraction failed, parse the raw text heuristically
    if (rows.length === 0 && rawText.length > 20) {
        rows = parseOcrText(rawText);
        confidence = 40;
    }

    return { rows, rawText, confidence };
}

function buildOcrResult(extracted: z.infer<typeof visionRowSchema>): { rows: ParsedRow[]; rawText: string; confidence: number } {
    const normalizedRows: ParsedRow[] = extracted.rows.map(fieldPairs => {
        const normalized: ParsedRow = {};
        for (const { field, value } of fieldPairs) {
            normalized[normalizeHeader(field)] = String(value ?? '').trim();
        }
        return normalized;
    });
    return { rows: normalizedRows, rawText: extracted.rawText, confidence: extracted.confidence };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(buffer));
    // text is an array of strings (one per page)
    return Array.isArray(text) ? text.join('\n\n--- Page Break ---\n\n') : String(text);
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
    // Try Blue Book format first (multi-section layout with "Project Name:" header)
    const blueBookRows = tryParseBlueBook(buffer);
    if (blueBookRows) return blueBookRows;

    // Standard tabular parsing — try all sheets, pick the one with most recognized fields
    const workbook = XLSX.read(buffer, { type: 'array' });
    let bestRows: ParsedRow[] = [];
    let bestScore = 0;

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (raw.length === 0) continue;

        const rows = raw.map((row) => {
            const normalized: ParsedRow = {};
            for (const [key, val] of Object.entries(row)) {
                normalized[normalizeHeader(key)] = String(val ?? '').trim();
            }
            return normalized;
        });

        // Score by recognized field count
        const allCols = new Set<string>();
        rows.forEach(r => Object.keys(r).forEach(k => allCols.add(k)));
        const known = ['lot', 'communityName', 'builderName', 'serviceName', 'amount',
            'checkNumber', 'startDate', 'assignedForemanName', 'modelPlanCode', 'address'];
        const score = known.filter(k => allCols.has(k)).length;

        if (score > bestScore || (score === bestScore && rows.length > bestRows.length)) {
            bestRows = rows;
            bestScore = score;
        }
    }

    // If no sheet had recognized fields, fall back to first sheet
    if (bestRows.length === 0) {
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        bestRows = raw.map((row) => {
            const normalized: ParsedRow = {};
            for (const [key, val] of Object.entries(row)) {
                normalized[normalizeHeader(key)] = String(val ?? '').trim();
            }
            return normalized;
        });
    }

    return bestRows;
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
type FileNameHints = { targetBoosts: Partial<Record<ImportTarget, number>>; inferredBuilder?: string };

/**
 * Extract routing hints from the filename.
 * e.g. "Pulte_Blue_Book_March_2024.xlsx" → boost blueBook, infer builder "Pulte"
 */
function extractFileNameHints(fileName: string): FileNameHints {
    const name = fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[_\-]+/g, ' ');
    const boosts: Partial<Record<ImportTarget, number>> = {};

    // Blue Book signals
    if (/blue\s*book|ledger|payment|check\s*register|accounts?\s*payable|ap\s*report/i.test(name)) {
        boosts.blueBook = 10;
    }
    // Job Request / Schedule signals
    if (/job\s*request|work\s*order|schedule|dispatch|service\s*request|intake/i.test(name)) {
        boosts.jobRequests = 10;
    }
    // Contract signals — boost multiple targets
    if (/contract|agreement|scope|proposal|bid/i.test(name)) {
        boosts.blueBook = (boosts.blueBook ?? 0) + 5;
        boosts.jobRequests = (boosts.jobRequests ?? 0) + 5;
        boosts.builders = (boosts.builders ?? 0) + 5;
        boosts.communities = (boosts.communities ?? 0) + 5;
    }
    // Builder list
    if (/builder|vendor|contractor\s*list/i.test(name)) {
        boosts.builders = (boosts.builders ?? 0) + 8;
    }
    // Community list
    if (/communit|subdivision|neighborhood|development/i.test(name)) {
        boosts.communities = (boosts.communities ?? 0) + 8;
    }
    // Service list
    if (/service|price\s*list|rate\s*sheet|scope\s*of\s*work/i.test(name)) {
        boosts.services = (boosts.services ?? 0) + 8;
    }

    // Try to infer a builder name from the filename
    // Common pattern: "BuilderName_BlueBook.xlsx" or "Pulte - March 2024.csv"
    const knownBuilders = ['pulte', 'kb homes', 'kb home', 'lennar', 'dr horton', 'meritage', 'taylor morrison', 'toll brothers', 'shea homes'];
    let inferredBuilder: string | undefined;
    for (const b of knownBuilders) {
        if (name.includes(b)) {
            inferredBuilder = b.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
            break;
        }
    }

    return { targetBoosts: boosts, inferredBuilder };
}

/**
 * Analyze actual cell values for data-type clues when headers are missing or generic.
 * Looks at a sample of rows to detect patterns like dollar amounts, dates, check numbers, etc.
 */
function analyzeDataValues(rows: ParsedRow[]): Partial<Record<ImportTarget, number>> {
    const boosts: Partial<Record<ImportTarget, number>> = {};
    const sample = rows.slice(0, 20);

    let dollarCount = 0;
    let dateCount = 0;
    let checkNumCount = 0;
    let lotCount = 0;
    let addressCount = 0;

    for (const row of sample) {
        for (const val of Object.values(row)) {
            if (!val) continue;
            // Dollar amounts: $1,234.56 or 1234.56
            if (/^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/.test(val.trim())) dollarCount++;
            // Dates: MM/DD/YYYY, YYYY-MM-DD, etc.
            if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val.trim()) || /^\d{4}-\d{2}-\d{2}/.test(val.trim())) dateCount++;
            // Check numbers: 4-8 digit numbers
            if (/^\d{4,8}$/.test(val.trim())) checkNumCount++;
            // Lot patterns: "Lot 5", "L-12", "123" (short number)
            if (/^(lot\s*#?\s*\d+|l[-\s]?\d+|\d{1,4})$/i.test(val.trim())) lotCount++;
            // Address patterns
            if (/^\d+\s+\w+\s+(st|ave|blvd|dr|rd|ln|ct|way|pl|cir)/i.test(val.trim())) addressCount++;
        }
    }

    // Financial data → Blue Book
    if (dollarCount >= 3) boosts.blueBook = (boosts.blueBook ?? 0) + 5;
    if (checkNumCount >= 2) boosts.blueBook = (boosts.blueBook ?? 0) + 4;

    // Scheduling data → Job Requests
    if (dateCount >= 3) boosts.jobRequests = (boosts.jobRequests ?? 0) + 3;
    if (addressCount >= 2) boosts.jobRequests = (boosts.jobRequests ?? 0) + 4;

    // Lots → both Blue Book and Job Requests
    if (lotCount >= 3) {
        boosts.blueBook = (boosts.blueBook ?? 0) + 2;
        boosts.jobRequests = (boosts.jobRequests ?? 0) + 2;
    }

    return boosts;
}

/**
 * Multi-route detection: score ALL targets independently so a single
 * contract/spreadsheet can fan out to builders, communities, job requests,
 * blue book entries, etc. in one import.
 *
 * Uses three signal layers:
 * 1. Column headers (strongest signal)
 * 2. Filename keywords (moderate signal)
 * 3. Data value patterns (supporting signal when headers are weak/missing)
 */
function detectDataType(rows: ParsedRow[], fileNameHints?: FileNameHints): {
    detectedType: ImportTarget;
    confidence: number;
    detectedTargets: TargetScore[];
    fieldMapping: Record<string, string>;
    unmappedColumns: string[];
    inferredBuilder?: string;
} {
    const empty = {
        detectedType: 'unknown' as ImportTarget, confidence: 0,
        detectedTargets: [] as TargetScore[], fieldMapping: {} as Record<string, string>,
        unmappedColumns: [] as string[], inferredBuilder: fileNameHints?.inferredBuilder,
    };
    if (rows.length === 0) return empty;

    const allCols = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => allCols.add(k)));
    const cols = Array.from(allCols);

    // Analyze data values for extra clues
    const dataBoosts = analyzeDataValues(rows);

    // Per-target field definitions
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

    // Score every target independently
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

        // Add filename boost
        const fnBoost = fileNameHints?.targetBoosts[targetName as ImportTarget] ?? 0;
        score += fnBoost;
        // If filename strongly hints at this target, relax the required-column check
        if (fnBoost >= 5) hasRequired = true;

        // Add data value boost
        const dvBoost = dataBoosts[targetName as ImportTarget] ?? 0;
        score += dvBoost;
        // If data values strongly hint at this target, relax the required-column check
        if (dvBoost >= 5) hasRequired = true;

        if (hasRequired && score > 0) {
            const isEntity = ['builders', 'communities', 'services'].includes(targetName);
            const isStandaloneEntity = isEntity && cols.length <= 4;

            if (!isEntity || isStandaloneEntity || score >= 3) {
                const maxPossible = Array.from(def.all).reduce((sum, f) => sum + (def.strong.has(f) ? 3 : 1), 0);
                const confidence = Math.min(95, Math.round((score / maxPossible) * 100));
                detectedTargets.push({ type: targetName as ImportTarget, confidence });
            }
        }
    }

    detectedTargets.sort((a, b) => b.confidence - a.confidence);

    const unmappedColumns = cols.filter(c => !allKnown.has(c) && !['lineNumber', 'rawText'].includes(c));

    const primary = detectedTargets[0];
    return {
        detectedType: primary?.type ?? 'unknown',
        confidence: primary?.confidence ?? 0,
        detectedTargets,
        fieldMapping,
        unmappedColumns,
        inferredBuilder: fileNameHints?.inferredBuilder,
    };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Check if parsed rows have at least some recognized system fields. */
function hasRecognizedFields(rows: ParsedRow[]): boolean {
    if (rows.length === 0) return false;
    const allCols = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => allCols.add(k)));
    const known = ['lot', 'communityName', 'builderName', 'serviceName', 'amount',
        'checkNumber', 'startDate', 'assignedForemanName', 'modelPlanCode',
        'modelPlanSqft', 'address', 'status', 'dueDate', 'invoiceNumber'];
    const matchCount = known.filter(k => allCols.has(k)).length;
    return matchCount >= 2;
}

function normalizeHeader(raw: string): string {
    const h = raw.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const map: Record<string, string> = {
        lot: 'lot',
        lots: 'lot',
        lotnumber: 'lot',
        lotno: 'lot',
        community: 'communityName',
        communityname: 'communityName',
        subdivision: 'communityName',
        projectname: 'communityName',
        project: 'communityName',
        development: 'communityName',
        neighborhood: 'communityName',
        builder: 'builderName',
        buildername: 'builderName',
        companyname: 'builderName',
        company: 'builderName',
        contractor: 'builderName',
        contractorname: 'builderName',
        divisionname: 'builderName',
        division: 'builderName',
        vendorname: 'builderName',
        vendor: 'builderName',
        clientname: 'builderName',
        client: 'builderName',
        gc: 'builderName',
        generalcontractor: 'builderName',
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
        contactname: 'contactName',
        contactperson: 'contactName',
        contactemail: 'contactEmail',
        email: 'contactEmail',
        contactphone: 'contactPhone',
        phone: 'contactPhone',
        pricepersqft: 'pricePerSqft',
        pricesqft: 'pricePerSqft',
        unitrate: 'unitRate',
        unittype: 'unitType',
        scopeofwork: 'scopeOfWork',
        scope: 'scopeOfWork',
        equipmenttype: 'equipmentType',
        equipment: 'equipmentType',
        rentalrate: 'rentalRate',
        rentalperiod: 'rentalPeriod',
        proposaldate: 'proposalDate',
        effectivedate: 'effectiveDate',
        category: 'category',
    };
    return map[h] || raw.trim();
}
