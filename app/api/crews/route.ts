import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
  try {
    const db = await getDb();
    const allCrews = await db.query.crews.findMany();
    return json(allCrews ?? []);
  } catch (error) {
    console.error('Error fetching crews:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load crews' }, 500);
  }
}
