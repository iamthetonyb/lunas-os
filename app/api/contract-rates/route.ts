import { db } from '@/db';
import { contractRates } from '@/db/schema';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const rates = await db.query.contractRates.findMany();
    return NextResponse.json(rates || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching contract rates:', error);
    // Return empty array with 200 status to prevent crashes
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newRate = await db.insert(contractRates).values(data).returning();
    return NextResponse.json(newRate[0]);
  } catch (error) {
    console.error('Error creating contract rate:', error);
    return NextResponse.json({ error: 'Failed to create contract rate' }, { status: 500 });
  }
}
