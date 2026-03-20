import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/forgot-password(.*)',
  '/reset-password(.*)',
  '/t/(.*)',               // Public ticket submission
  '/api/auth/(.*)',        // Auth API routes (password reset)
  '/api/telegram/(.*)',    // Telegram webhook
  '/api/uploadthing(.*)',  // File uploads
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
