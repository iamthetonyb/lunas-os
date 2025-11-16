import { ok } from '@/lib/api/http';
import { auth } from '@/auth';

export const runtime = 'nodejs';

export const GET = async () => {
  const session = await auth();
  return ok(session);
};
