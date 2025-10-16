/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable experimental features that might interfere
  experimental: {
    // Ensure webpack is used for CSS processing
    esmExternals: true,
  },
};
module.exports = nextConfig;
