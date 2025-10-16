import { db } from '@/db';
import { services } from '@/db/schema';
import { NextResponse } from 'next/server';
import { withApiHandler, withTimeout, errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return withApiHandler(
    async () => {
      const allServices = await db.query.services.findMany();
      return allServices || [];
    },
    [] // fallback to empty array
  );
}

export async function POST(req: Request) {
  try {
    const data = await withTimeout(req.json(), 5000);
    const newService = await withTimeout(
      db.insert(services).values(data).returning(),
      8000
    );
    return NextResponse.json(newService[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    return errorResponse('Failed to create service');
  }
}
