/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Empty turbopack config to silence webpack warning
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Defensive aliases for optional Keyv adapters (prevent bundling errors)
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@keyv/redis': false,
      '@keyv/mongo': false,
      '@keyv/sqlite': false,
      '@keyv/postgres': false,
      '@keyv/mysql': false,
      '@keyv/etcd': false,
      '@keyv/offline': false,
      '@keyv/tiered': false,
    };
    return config;
  },
};
