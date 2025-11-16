import { getDb } from '@/lib/db/get-db';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
  try {
    const db = await getDb();
    const builders = await db.query.builders.findMany();
    return json(builders ?? []);
  } catch (error) {
    console.error('Error fetching builders:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load builders' }, 500);
  }
}
