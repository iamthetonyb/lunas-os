import { getDb } from '@/lib/db/get-db';
import { communities } from '@/db/schema';
import { json } from '@/lib/utils/json';
import { requireMembership } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export async function GET() {
  try {
    const db = await getDb();
    const allCommunities = await db.query.communities.findMany();
    return json(allCommunities ?? []);
  } catch (error) {
    console.error('Error fetching communities:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load communities' }, 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireMembership(['admin', 'backoffice']);
    const db = await getDb();
    const body = await req.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return json({ ok: false, error: 'Community name is required' }, 400);
    }

    const [newCommunity] = await db.insert(communities).values({
      name: body.name.trim(),
      builderId: body.builderId || null,
    }).returning();

    return json(newCommunity, 201);
  } catch (error) {
    console.error('Error creating community:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to create community' }, 500);
  }
}
