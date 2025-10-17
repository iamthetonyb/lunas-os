import { NextResponse } from 'next/server';

export type ApiHandler = (req: Request, context?: any) => Promise<NextResponse | Response>;

/**
 * Wraps API route handlers with error handling and timeout
 */
export function withErrorHandling(handler: ApiHandler, timeoutMs = 10000): ApiHandler {
  return async (req: Request, context?: any) => {
    try {
      // Race the handler against a timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );

      const response = await Promise.race([
        handler(req, context),
        timeoutPromise
      ]);

      return response;
    } catch (error: any) {
      console.error('[API Error]', error);
      
      // Handle specific error types
      if (error.message === 'Request timeout') {
        return NextResponse.json(
          { error: 'Request timeout', message: 'The request took too long to process' },
          { status: 504 }
        );
      }

      if (error.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'Database connection failed', message: 'Unable to connect to database' },
          { status: 503 }
        );
      }

      // Generic error response
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          message: error.message || 'An unexpected error occurred',
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        },
        { status: 500 }
      );
    }
  };
}
