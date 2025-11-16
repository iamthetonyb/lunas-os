import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { getDb } = await import('@/lib/db/get-db');
    await getDb();
    return NextResponse.json({
      ok: true,
      provider: process.env.DATABASE_PROVIDER || 'sqlite',
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
