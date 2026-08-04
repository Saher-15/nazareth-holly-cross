const withNextIntl = require('next-intl/plugin')('./src/i18n.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.googleapis.com' },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
