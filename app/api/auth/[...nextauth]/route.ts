// Legacy NextAuth route — auth is now handled by Clerk middleware.
// Keep this file to prevent 404s on any lingering OAuth callbacks.
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}

export function POST() {
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}
