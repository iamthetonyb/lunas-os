import { db } from '@/db';
import { modelPlans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const data = await req.json();
  const updatedModelPlan = await db.update(modelPlans).set(data).where(eq(modelPlans.id, params.id)).returning();
  return NextResponse.json(updatedModelPlan[0]);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await db.delete(modelPlans).where(eq(modelPlans.id, params.id));
  return new Response(null, { status: 204 });
}
