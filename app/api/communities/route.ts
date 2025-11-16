import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
  try {
    const db = await getDb();
    const communities = await db.query.communities.findMany();
    return json(communities ?? []);
  } catch (error) {
    console.error('Error fetching communities:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load communities' }, 500);
  }
}
