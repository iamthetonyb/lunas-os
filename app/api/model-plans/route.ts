import { db } from '@/db';
import { modelPlans } from '@/db/schema';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const allModelPlans = await db.query.modelPlans.findMany();
    return NextResponse.json(allModelPlans || []);
  } catch (error) {
    console.error('Error fetching model plans:', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newModelPlan = await db.insert(modelPlans).values(data).returning();
    return NextResponse.json(newModelPlan[0]);
  } catch (error) {
    console.error('Error creating model plan:', error);
    return NextResponse.json({ error: 'Failed to create model plan' }, { status: 500 });
  }
}
