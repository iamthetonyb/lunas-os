import { getDb } from '@/lib/db/get-db';
import { assignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(req: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    if (status) {
      const filteredAssignments = await db.query.assignments.findMany({
        where: eq(assignments.status, status as any),
      });
      return json(filteredAssignments ?? []);
    }

    const allAssignments = await db.query.assignments.findMany();
    return json(allAssignments ?? []);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load assignments' }, 500);
  }
}
