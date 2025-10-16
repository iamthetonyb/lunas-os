/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Disable ESLint during builds to allow deployment with warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/__e2e-ready',
        destination: '/',
        permanent: true,
      },
    ];
  },
  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
