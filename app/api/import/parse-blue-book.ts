import * as XLSX from 'xlsx';

type ParsedRow = Record<string, string>;

// Patterns used to identify columns and data
const LOT_HEADERS = /^(lots?|lot\s*#?|lot\s*num(ber)?)$/i;
const PLAN_HEADERS = /^(plans?|models?|model\s*plan|floor\s*plan|elevation)$/i;
const SQFT_HEADERS = /^(sq\s*ft|sqft|square\s*feet|sf|area)$/i;
const DATE_FOREMAN_PATTERN = /^(\d{1,2}\/\d{1,2})\s+(.+)$/;
const SERVICE_CODE_SUB = /^\d{4,5}\s*-\s*T\d/i;
const PROJECT_HEADER = /^(Project\s*Name|Community|Subdivision|Development)\s*:\s*/i;

/**
 * Try to parse an Excel buffer as a Blue Book (construction job tracker).
 *
 * Uses heuristic detection — not tied to specific cell positions:
 * 1. Scans for a project/community header in the first rows (merged cells)
 * 2. Finds the header row by pattern-matching column labels (Lot, Plan, SqFt)
 * 3. Auto-detects service phase columns (any column after known columns whose data
 *    contains "MM/DD Name" entries)
 * 4. Expands each lot × service entry into its own row
 *
 * Returns null if the file doesn't match Blue Book patterns.
 */
export function tryParseBlueBook(buffer: ArrayBuffer): ParsedRow[] | null {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet['!ref']) return null;

    const range = XLSX.utils.decode_range(sheet['!ref']!);

    const getCell = (r: number, c: number): unknown => {
        const addr = XLSX.utils.encode_cell({ r, c });
        return sheet[addr]?.v ?? null;
    };

    // ── Step 1: Find community/project name ─────────────────────────
    // Check merged cells and early rows for a project header
    let communityName = '';

    // Check first 5 rows for "Project Name: ..." or similar
    for (let r = 0; r <= Math.min(4, range.e.r) && !communityName; r++) {
        for (let c = 0; c <= range.e.c && !communityName; c++) {
            const v = getCell(r, c);
            if (typeof v !== 'string') continue;
            const match = v.match(PROJECT_HEADER);
            if (match) {
                communityName = v.slice(match[0].length).trim();
            }
        }
    }

    // Fallback: use the first merged cell's text if it spans 3+ columns
    if (!communityName && sheet['!merges']) {
        for (const merge of sheet['!merges']) {
            if (merge.s.r <= 2 && (merge.e.c - merge.s.c) >= 2) {
                const v = getCell(merge.s.r, merge.s.c);
                if (typeof v === 'string' && v.length > 3) {
                    communityName = v.replace(PROJECT_HEADER, '').trim();
                    break;
                }
            }
        }
    }

    // ── Step 2: Find header row by pattern-matching ─────────────────
    // Scan rows 0-15 for one containing lot/plan-like headers
    let headerRow = -1;
    let lotCol = -1;
    let planCol = -1;
    let sqftCol = -1;

    for (let r = 0; r <= Math.min(15, range.e.r); r++) {
        let foundLot = -1;
        let foundPlan = -1;
        let foundSqft = -1;

        for (let c = 0; c <= range.e.c; c++) {
            const v = getCell(r, c);
            if (typeof v !== 'string') continue;
            const trimmed = v.trim();
            if (LOT_HEADERS.test(trimmed)) foundLot = c;
            if (PLAN_HEADERS.test(trimmed)) foundPlan = c;
            if (SQFT_HEADERS.test(trimmed)) foundSqft = c;
        }

        // Need at least Lot column; Plan is strongly preferred
        if (foundLot >= 0 && foundPlan >= 0) {
            headerRow = r;
            lotCol = foundLot;
            planCol = foundPlan;
            sqftCol = foundSqft;
            break;
        }
    }

    if (headerRow < 0 || lotCol < 0) return null;

    // If sqft wasn't found by header, guess it's the column before lot (common layout)
    if (sqftCol < 0 && lotCol > 0) {
        // Verify by checking if data in that column is numeric (sqft values)
        let numCount = 0;
        for (let r = headerRow + 1; r <= Math.min(headerRow + 5, range.e.r); r++) {
            const v = getCell(r, lotCol - 1);
            if (typeof v === 'number' && v > 500 && v < 20000) numCount++;
        }
        if (numCount >= 2) sqftCol = lotCol - 1;
    }

    // ── Step 3: Detect service phase columns ────────────────────────
    // Service columns are text headers after the core columns (lot/plan/sqft)
    // whose data rows contain "MM/DD Name" entries.
    const coreColSet = new Set([lotCol, planCol, sqftCol].filter(c => c >= 0));
    const candidateSvcCols: { col: number; name: string }[] = [];

    for (let c = 0; c <= range.e.c; c++) {
        if (coreColSet.has(c)) continue;
        const hdr = getCell(headerRow, c);
        if (typeof hdr !== 'string' || !hdr.trim()) continue;

        // Check if data in this column contains "MM/DD Name" entries
        let matchCount = 0;
        for (let r = headerRow + 1; r <= Math.min(headerRow + 20, range.e.r); r++) {
            const v = getCell(r, c);
            if (typeof v === 'string' && DATE_FOREMAN_PATTERN.test(v.trim())) matchCount++;
        }

        if (matchCount >= 1) {
            candidateSvcCols.push({ col: c, name: hdr.trim() });
        }
    }

    // Must have at least 1 service column with date/foreman data
    if (candidateSvcCols.length === 0) return null;

    // ── Step 4: Parse data rows ─────────────────────────────────────
    const rows: ParsedRow[] = [];

    for (let r = headerRow + 1; r <= range.e.r; r++) {
        const lotVal = getCell(r, lotCol);
        const planVal = planCol >= 0 ? getCell(r, planCol) : null;

        // Skip repeated headers
        if (typeof lotVal === 'string' && LOT_HEADERS.test(lotVal)) continue;
        if (typeof planVal === 'string' && PLAN_HEADERS.test(planVal)) continue;

        // Skip service code sub-headers ("22702 - T3")
        const anySvcVal = getCell(r, candidateSvcCols[0].col);
        if (typeof anySvcVal === 'string' && SERVICE_CODE_SUB.test(anySvcVal)) continue;

        // Lot must be present (number or numeric string)
        const lotNum = typeof lotVal === 'number' ? lotVal
            : typeof lotVal === 'string' && /^\d+$/.test(lotVal.trim()) ? parseInt(lotVal)
            : null;
        if (lotNum === null) continue;

        const sqftVal = sqftCol >= 0 ? getCell(r, sqftCol) : null;
        const sqft = typeof sqftVal === 'number' ? String(sqftVal) : '';
        const lot = String(lotNum);
        const plan = typeof planVal === 'string' ? planVal : '';

        let hasEntry = false;

        for (const { col, name: svcName } of candidateSvcCols) {
            const v = getCell(r, col);
            if (!v || typeof v !== 'string') continue;

            const m = v.trim().match(DATE_FOREMAN_PATTERN);
            if (!m) continue;

            hasEntry = true;
            const row: ParsedRow = {
                lot,
                serviceName: svcName,
                startDate: m[1],
                assignedForemanName: m[2].trim(),
            };
            if (communityName) row.communityName = communityName;
            if (plan) row.modelPlanCode = plan;
            if (sqft) row.modelPlanSqft = sqft;
            rows.push(row);
        }

        // Lot with no service entries — still include as base row
        if (!hasEntry) {
            const row: ParsedRow = { lot };
            if (communityName) row.communityName = communityName;
            if (plan) row.modelPlanCode = plan;
            if (sqft) row.modelPlanSqft = sqft;
            rows.push(row);
        }
    }

    return rows.length > 0 ? rows : null;
}

/**
 * Convert an Excel sheet to a plain-text representation for LLM extraction.
 * Preserves the cell grid layout so the LLM can understand structure.
 */
export function excelSheetToText(buffer: ArrayBuffer): string {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet['!ref']) return '';

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const lines: string[] = [];

    // Include sheet name
    lines.push(`Sheet: ${wb.SheetNames[0]}`);
    lines.push('');

    for (let r = 0; r <= range.e.r; r++) {
        const cells: string[] = [];
        for (let c = 0; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = sheet[addr];
            cells.push(cell ? String(cell.v) : '');
        }
        // Skip fully empty rows
        if (cells.every(c => !c)) continue;
        lines.push(cells.join('\t'));
    }

    return lines.join('\n');
}
