import { auth } from '@/lib/auth-edge'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const path = req.nextUrl.pathname
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', path)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/products/:path*',
    '/stock/:path*',
    '/pos/:path*',
    '/sales/:path*',
    '/invoices/:path*',
    '/alerts/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/scan/:path*',
    '/more/:path*',
    '/api/files/:path*',
    '/api/sync/:path*',
    '/api/export/:path*',
  ],
}
