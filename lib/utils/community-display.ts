/**
 * Utility functions for community name display
 * - Friendly names for schedule/intake pages
 * - Original names (with numbers) for blue-book billing
 */

/**
 * Convert community name to user-friendly format
 * - Removes trailing numbers (e.g., "Aries 3000" → "Aries")
 * - Expands DW abbreviation to "Del Webb"
 * - Expands LLV to "Lake Las Vegas"
 */
export function getFriendlyName(name: string): string {
    if (!name) return '';

    // Remove trailing numbers (e.g., "Aries - 3000" or "Aries 3000")
    // DISABLED: User confirmed numbers are part of the name
    let friendly = name; // .replace(/\s*-?\s*\d+$/, '').trim();

    // Convert DW abbreviations
    friendly = friendly
        .replace(/^DW\s+/i, 'Del Webb ')
        .replace(/^DW$/i, 'Del Webb')
        .replace(/\bLLV\b/gi, 'Lake Las Vegas');

    return friendly;
}

/**
 * Get display name based on context
 * - blue-book: Keep original name with numbers for billing clarity
 * - schedule/intake: Use friendly name
 */
export function getDisplayName(
    name: string,
    context: 'schedule' | 'intake' | 'blue-book'
): string {
    if (context === 'blue-book') return name; // Keep original for billing
    return getFriendlyName(name);
}

/**
 * Parse lot number from Pulte job number
 * e.g., "8770-00102" → "00102"
 */
export function parseLotNumber(jobNumber: string): string | null {
    if (!jobNumber) return null;
    const parts = jobNumber.split('-');
    if (parts.length >= 2) {
        return parts[1];
    }
    return null;
}

/**
 * Parse community code from Pulte job number
 * e.g., "8770-00102" → "8770"
 */
export function parseCommunityCode(jobNumber: string): string | null {
    if (!jobNumber) return null;
    const parts = jobNumber.split('-');
    if (parts.length >= 1) {
        return parts[0];
    }
    return null;
}
