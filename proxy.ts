import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/forgot-password(.*)',
  '/reset-password(.*)',
  '/work-log/public(.*)', // Public work log (no login required)
  '/t/(.*)',               // Public ticket submission
  '/terms(.*)',            // Public terms page
  '/privacy(.*)',          // Public privacy policy page
  '/api/auth/(.*)',        // Auth API routes (password reset)
  '/api/telegram/(.*)',    // Telegram webhook
  '/api/uploadthing(.*)',  // File uploads
]);

export default clerkMiddleware(async (auth, req) => {
  // Bypass auth in development for local testing/recording
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    return;
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
}, {
  signInUrl: '/login',
  signUpUrl: '/login',
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
