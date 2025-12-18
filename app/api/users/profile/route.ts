import { getDb } from '@/lib/db/get-db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safe, ok, err } from '@/lib/api/http';
import { auth } from '@/auth';

export const runtime = 'nodejs';

const updateProfileSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    preferredLang: z.enum(['EN', 'ES_MX']).optional(),
    preferredContactMethod: z.enum(['email', 'call', 'text']).optional(),
});

export const PUT = safe(async (req: Request) => {
    const session = await auth();
    if (!session?.user?.id) {
        return err('Unauthorized', 401);
    }

    const db = await getDb();
    const userId = session.user.id;

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
        return err('Invalid data', 400, parsed.error.flatten());
    }

    const updateData: any = {
        ...parsed.data,
        updatedAt: new Date(),
    };

    const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

    return ok({
        id: updatedUser.id,
        name: updatedUser.name,
        preferredLang: updatedUser.preferredLang,
        preferredContactMethod: updatedUser.preferredContactMethod,
    });
});

export const GET = safe(async (req: Request) => {
    const session = await auth();
    if (!session?.user?.id) {
        return err('Unauthorized', 401);
    }

    const db = await getDb();
    const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
    });

    if (!user) {
        return err('User not found', 404);
    }

    return ok({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredLang: user.preferredLang,
        preferredContactMethod: user.preferredContactMethod,
    });
});
