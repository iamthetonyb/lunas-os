import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/__e2e-ready') {
    return NextResponse.next();
  }
  console.log('Middleware executed for:', request.nextUrl.pathname);
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};