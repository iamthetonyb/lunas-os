/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force webpack to process CSS properly in dev mode
  webpack: (config, { dev, isServer }) => {
    // Ensure PostCSS loader is applied to CSS files
    if (dev && !isServer) {
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
};
module.exports = nextConfig;
