import { db } from '@/db';
import { modelPlans } from '@/db/schema';
import { NextResponse } from 'next/server';
import { withApiHandler, withTimeout, errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return withApiHandler(
    async () => {
      const allModelPlans = await db.query.modelPlans.findMany();
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
