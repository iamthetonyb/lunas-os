import { getDb } from '@/lib/db/get-db';
import { builders } from '@/db/schema';
import { json } from '@/lib/utils/json';
import { requireMembership } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
  try {
    const db = await getDb();
    const allBuilders = await db.query.builders.findMany();
    return json(allBuilders ?? []);
  } catch (error) {
    console.error('Error fetching builders:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load builders' }, 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireMembership(['admin', 'backoffice']);
    const db = await getDb();
    const body = await req.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return json({ ok: false, error: 'Builder name is required' }, 400);
    }

    const [newBuilder] = await db.insert(builders).values({
      name: body.name.trim(),
    }).returning();

    return json(newBuilder, 201);
  } catch (error) {
    console.error('Error creating builder:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to create builder' }, 500);
  }
}
