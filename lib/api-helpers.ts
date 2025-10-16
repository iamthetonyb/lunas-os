/**
 * API helper utilities for robust error handling and timeouts
 */

import { NextResponse } from 'next/server';

/**
 * Wraps a promise with a timeout to prevent hanging requests
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds (default: 8000)
 * @returns The result or throws timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 8000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Standard error response with proper headers
 */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

/**
 * Standard success response with proper headers
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * Wraps an API handler with timeout and error handling
 */
export async function withApiHandler<T>(
  handler: () => Promise<T>,
  fallback: T,
  timeoutMs: number = 8000
): Promise<NextResponse> {
  try {
    const result = await withTimeout(handler(), timeoutMs);
    return successResponse(result);
  } catch (error) {
    console.error('API handler error:', error);
    // Return fallback data with success status to prevent client crashes
    return successResponse(fallback);
  }
}
