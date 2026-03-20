/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  staticPageGenerationTimeout: 300,
  turbopack: {},
  experimental: {
    prefetchInlining: true,
    appNewScrollHandler: true,
    viewTransition: true,
  },
  serverExternalPackages: ['@react-email/render', 'resend', 'bcryptjs'],
};
