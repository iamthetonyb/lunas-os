import { getDb } from '@/lib/db/get-db';
import { modelPlans } from '@/db/schema';
import { NextResponse } from 'next/server';
import { withApiHandler, withTimeout, errorResponse } from '@/lib/api-helpers';
import { ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const db = await getDb();

export async function GET() {
  return withApiHandler(
    async () => {
      // Only return active model plans (soft delete filter)
      const allModelPlans = await db.query.modelPlans.findMany({
        where: ne(modelPlans.active, false),
      });
      return allModelPlans || [];
    },
    []
  );
}

export async function POST(req: Request) {
  try {
    const data = await withTimeout(req.json(), 5000);
    const newModelPlan = await withTimeout(
      db.insert(modelPlans).values(data).returning(),
      8000
    );
    return NextResponse.json(newModelPlan[0]);
  } catch (error) {
    console.error('Error creating model plan:', error);
    return errorResponse('Failed to create model plan');
  }
}
