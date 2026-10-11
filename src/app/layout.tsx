import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getTenantTheme } from '@/lib/tenant'
import { BrandStyle } from '@/components/BrandStyle'
import { TenantThemeInjector } from '@/components/TenantThemeInjector'

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Epossis',
    template: `%s · ${process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Epossis'}`,
  },
  description: 'Inventory & point-of-sale — scan, sell, sync.',
  appleWebApp: {
    capable: true,
    title: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Epossis',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTenantTheme()
  return (
    <html lang="en">
      <body>
        <BrandStyle theme={theme} />
        <TenantThemeInjector theme={theme} />
        {children}
      </body>
    </html>
  )
}
