import { NextResponse } from 'next/server';

export function ok<T = unknown>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data ?? null, init);
}

export function err(message: string, status = 500, data?: unknown) {
  return NextResponse.json({ error: message, data }, { status });
}

export function safe<T extends { params: any }>(
  fn: (req: Request, context: T) => Promise<Response>
) {
  return async (req: Request, context: T) => {
    try {
      return await fn(req, context);
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('[api error]', msg, error?.stack || '');
      return err(msg, (error as any)?.status ?? 500);
    }
  };
}
