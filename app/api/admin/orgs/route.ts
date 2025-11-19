import { getDb } from '@/lib/db/get-db';
import { orgs } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { z } from 'zod';
import { slugify } from '@/lib/utils/slugify';
import { json } from '@/lib/utils/json';
import { InferInsertModel } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// Force the insert type to Postgres only — this bypasses the union type error
type InsertOrg = InferInsertModel<typeof orgs>;

const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireMembership(['admin']);
    const db = await getDb();
    const body = createOrgSchema.parse(await req.json());

    const slug = body.slug ? slugify(body.slug) : slugify(body.name);
    if (!slug) {
      return json({ ok: false, error: 'Invalid slug' }, 400);
    }

    // Force Postgres-only insert path – eliminates the union type completely
    const result = await db
      .insert(orgs)
      .values({
        name: body.name,
        slug,
      } as InsertOrg)
      .onConflictDoNothing({ target: orgs.slug })
      .returning();
    
    const [created] = result;

    if (!created) {
      return json({ ok: false, error: 'Slug already exists' }, 409);
    }

    return json(created, 201);
  } catch (error: any) {
    if (error?.status) {
      return json({ ok: false, error: error.message }, error.status);
    }
    console.error('Error creating org:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to create org' }, 500);
  }
}
