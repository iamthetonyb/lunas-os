import { getDb } from '@/lib/db/get-db';
import { contractRates } from '@/db/schema';
import { json } from '@/lib/utils/json';
import { withTimeout } from '@/lib/api-helpers';
import { ne } from 'drizzle-orm';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    // Only return active rates (soft delete filter)
    const rates = await db.query.contractRates.findMany({
      where: ne(contractRates.active, false),
    });
    return json(rates ?? []);
  } catch (error) {
    console.error('Error fetching contract rates:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to load contract rates' }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const data = await withTimeout(req.json(), 5000);
    const [newRate] = await withTimeout(
      db.insert(contractRates).values(data).returning(),
      8000
    );
    return json(newRate, 201);
  } catch (error) {
    console.error('Error creating contract rate:', error);
    return json({ ok: false, error: (error as Error).message ?? 'Failed to create contract rate' }, 500);
  }
}
