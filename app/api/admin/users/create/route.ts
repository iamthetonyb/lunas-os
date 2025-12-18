import { getDb } from '@/lib/db/get-db';
import { users } from '@/db/schema';
import { requireMembership } from '@/lib/auth/guards';
import { z } from 'zod';
import { safe, ok, err } from '@/lib/api/http';
import bcrypt from 'bcrypt';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  preferredContactMethod: z.enum(['email', 'call', 'text']).default('email'),
});

export const POST = safe(async (req: Request) => {
  await requireMembership(['admin']);
  const db = await getDb();

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return err('Invalid user data', 400, parsed.error.flatten());
  }

  const { name, email, phone, password, preferredContactMethod } = parsed.data;

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  });

  if (existingUser) {
    return err('User with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      phone: phone || null,
      passwordHash,
      preferredContactMethod,
      role: 'CUSTOMER', // default role
    })
    .returning();

  return ok(
    {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
    },
    { status: 201 }
  );
});
