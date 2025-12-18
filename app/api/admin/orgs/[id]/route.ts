import { getDb } from '@/lib/db/get-db';
import { orgs } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safe, ok, err } from '@/lib/api/http';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

const paramsSchema = z.object({
    id: z.string().uuid(),
});

const updateOrgSchema = z.object({
    name: z.string().min(1, 'Name is required'),
});

export const PUT = safe(async (req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
    await requireMembership(['admin']);
    const db = await getDb();

    const params = await paramsPromise;
    const paramsParsed = paramsSchema.safeParse(params);
    if (!paramsParsed.success) {
        return err('Invalid organization ID', 400);
    }

    const { id: orgId } = paramsParsed.data;

    const body = await req.json();
    const parsed = updateOrgSchema.safeParse(body);

    if (!parsed.success) {
        return err('Invalid organization data', 400, parsed.error.flatten());
    }

    const { name } = parsed.data;

    // Check if org exists
    const existingOrg = await db.query.orgs.findFirst({
        where: (orgs, { eq }) => eq(orgs.id, orgId),
    });

    if (!existingOrg) {
        return err('Organization not found', 404);
    }

    // Update org
    const [updatedOrg] = await db
        .update(orgs)
        .set({ name })
        .where(eq(orgs.id, orgId))
        .returning();

    return ok({
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
    });
});

export const DELETE = safe(async (req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
    await requireMembership(['admin']);
    const db = await getDb();

    const params = await paramsPromise;
    const paramsParsed = paramsSchema.safeParse(params);
    if (!paramsParsed.success) {
        return err('Invalid organization ID', 400);
    }

    const { id: orgId } = paramsParsed.data;

    // Check if org exists
    const existingOrg = await db.query.orgs.findFirst({
        where: (orgs, { eq }) => eq(orgs.id, orgId),
    });

    if (!existingOrg) {
        return err('Organization not found', 404);
    }

    // Delete org (memberships will be orphaned - might need cascade)
    await db.delete(orgs).where(eq(orgs.id, orgId));

    return ok({ message: 'Organization deleted successfully' });
});
