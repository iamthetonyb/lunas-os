import { getDb } from '@/lib/db/get-db';
import { assignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@/lib/utils/json';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, params.id),
    });

    if (!assignment) {
      return json({ ok: false, error: 'Assignment not found' }, 404);
    }

    return json(assignment);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load assignment' }, 500);
  }
}
