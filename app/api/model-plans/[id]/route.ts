import { getDb } from '@/lib/db/get-db';
import { modelPlans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';

const db = await getDb();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const data = await req.json();
  const updatedModelPlan = await db.update(modelPlans).set(data).where(eq(modelPlans.id, id)).returning();
  return NextResponse.json(updatedModelPlan[0]);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  await db.delete(modelPlans).where(eq(modelPlans.id, id));
  return new Response(null, { status: 204 });
}
