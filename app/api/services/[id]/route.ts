import { db } from '@/db';
import { services } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const data = await req.json();
  const updatedService = await db.update(services).set(data).where(eq(services.id, params.id)).returning();
  return NextResponse.json(updatedService[0]);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await db.delete(services).where(eq(services.id, params.id));
  return new Response(null, { status: 204 });
}
