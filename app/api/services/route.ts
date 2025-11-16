import { getDb } from '@/lib/db/get-db';
import { services } from '@/db/schema';
import { json } from '@/lib/utils/json';
import { withTimeout } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const allServices = await db.query.services.findMany();
    return json(allServices ?? []);
  } catch (error) {
    console.error('Error fetching services:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load services' }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const data = await withTimeout(req.json(), 5000);
    const [newService] = await withTimeout(
      db.insert(services).values(data).returning(),
      8000
    );
    return json(newService, 201);
  } catch (error) {
    console.error('Error creating service:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to create service' }, 500);
  }
}
