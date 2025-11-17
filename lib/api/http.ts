import { NextResponse } from 'next/server';
import { z } from 'zod';

export function ok<T = unknown>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data ?? null, init);
}

// Fixed Zod 'keyAsName' by flattening errors
export function err(message: string, status = 500, data?: unknown) {
  // If data is a Zod error, flatten it for clean output
  if (data instanceof z.ZodError) {
    return NextResponse.json(
      { error: message, details: data.flatten() },
      { status: status || 400 }
    );
  }
  return NextResponse.json(
    { error: message, details: data ? String(data) : undefined },
    { status }
  );
}

export function safe<T extends { params: any }>(
  fn: (req: Request, context: T) => Promise<Response>
) {
  return async (req: Request, context: T) => {
    try {
      return await fn(req, context);
    } catch (error: any) {
      const msg = error?.message || String(error);
      // Enhanced error logging with stack trace
      console.error('API Handler Error:', msg, error?.stack || '');
      console.error('Full error object:', error);
      
      // Handle Zod errors specially
      if (error instanceof z.ZodError) {
        return err('Validation failed', 400, error);
      }
      
      // Return error with details even if empty
      return NextResponse.json(
        { error: 'Internal server error', details: msg || 'Unknown' },
        { status: (error as any)?.status ?? 500 }
      );
    }
  };
}
