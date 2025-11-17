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
      console.error('[safe wrapper] API Handler Error:', msg);
      console.error('[safe wrapper] Stack:', error?.stack || '(no stack)');
      console.error('[safe wrapper] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // Handle Zod errors specially
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.flatten() },
          { status: 400 }
        );
      }
      
      // Return error with details - ensure we always return a valid JSON response
      const errorResponse = {
        error: msg || 'Internal server error',
        details: error?.detail || error?.code || error?.toString?.() || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      };
      
      console.error('[safe wrapper] Returning error response:', errorResponse);
      
      return NextResponse.json(
        errorResponse,
        { status: (error as any)?.status ?? 500 }
      );
    }
  };
}
