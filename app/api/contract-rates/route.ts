import { db } from '@/db';
import { contractRates } from '@/db/schema';
import { NextResponse } from 'next/server';
import { withApiHandler, withTimeout, errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return withApiHandler(
    async () => {
      const rates = await db.query.contractRates.findMany();
      return rates || [];
    },
    []
  );
}

export async function POST(req: Request) {
  try {
    const data = await withTimeout(req.json(), 5000);
    const newRate = await withTimeout(
      db.insert(contractRates).values(data).returning(),
      8000
    );
    return NextResponse.json(newRate[0]);
  } catch (error) {
    console.error('Error creating contract rate:', error);
    return errorResponse('Failed to create contract rate');
  }
}
