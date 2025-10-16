import { db } from '@/db';
import { contractRates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const data = await req.json();
  const updatedRate = await db.update(contractRates).set(data).where(eq(contractRates.id, params.id)).returning();
  return NextResponse.json(updatedRate[0]);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await db.delete(contractRates).where(eq(contractRates.id, params.id));
  return new Response(null, { status: 204 });
}
