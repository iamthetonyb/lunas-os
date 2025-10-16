import { db } from '@/db';
import { contractRates } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function GET() {
  const rates = await db.query.contractRates.findMany();
  return NextResponse.json(rates);
}

export async function POST(req: Request) {
  const data = await req.json();
  const newRate = await db.insert(contractRates).values(data).returning();
  return NextResponse.json(newRate[0]);
}
