import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';
import { communityLots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

/**
 * GET /api/community-lots?communityId={id}
 * Returns lots for a specific community
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const communityId = searchParams.get('communityId');

        if (!communityId) {
            return json({ ok: false, error: 'communityId is required' }, 400);
        }

        const db = await getDb();
        const lots = await db
            .select()
            .from(communityLots)
            .where(eq(communityLots.communityId, communityId));

        return json(lots ?? []);
    } catch (error) {
        console.error('Error fetching community lots:', error);
        return json({ ok: false, error: (error as Error).message ?? 'Failed to load lots' }, 500);
    }
}
