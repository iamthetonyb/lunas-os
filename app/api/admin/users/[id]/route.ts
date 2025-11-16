import { getDb } from '@/lib/db/get-db';
import { users } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safe, ok, err } from '@/lib/api/http';
import bcrypt from 'bcrypt';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export const PUT = safe(async (req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) => {
  await requireMembership(['admin']);
  const db = await getDb();

  const params = await paramsPromise;
  const paramsParsed = paramsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return err('Invalid user ID', 400);
  }

  const { id: userId } = paramsParsed.data;

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return err('Invalid user data', 400, parsed.error.flatten());
  }

  const { name, email, phone, password } = parsed.data;

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
  });

  if (!existingUser) {
    return err('User not found', 404);
  }

  // Prepare update data
  const updateData: any = {
    name,
    phone: phone || null,
    updatedAt: new Date(),
  };

  // Only hash and update password if provided
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  // Update user (email is immutable in edit mode, but we keep it in the form for display)
  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning();

  return ok({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    phone: updatedUser.phone,
  });
});
