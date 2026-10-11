/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'sharp', 'xlsx'],
  },
}

module.exports = nextConfig
