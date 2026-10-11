import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Epossis',
    short_name: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Epossis',
    description: 'Inventory & point-of-sale',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: process.env.NEXT_PUBLIC_PLATFORM_PRIMARY || '#3b82f6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
