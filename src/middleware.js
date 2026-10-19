// middleware.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { auth } from './app/auth';
import { canAccessPath, getRoleHome } from './lib/roleRedirect';

export async function middleware(req) {
  const session = await auth();

  const path = req.nextUrl.pathname;

  console.log('🛡️ Middleware path:', path);
  console.log('🛡️ Session:', session ? 'EXISTS' : 'NULL');

  // Public routes
  if (
    path === '/' ||
    path.startsWith('/about') ||
    path.startsWith('/login') ||
    path.startsWith('/events') ||
    path.startsWith('/shop') ||
    path.startsWith('/blogs') ||
    path.startsWith('/contact') ||
    path.startsWith('/organizer/register') ||
    path.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Protected routes
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path.startsWith('/organizer') ||
    path.startsWith('/member') ||
    path.startsWith('/finance')
  ) {
    if (session?.user) {
      if (String(session.user.status || '').toLowerCase() === 'suspended') {
        return NextResponse.redirect(
          new URL(`/login?next=${encodeURIComponent(path)}`, req.url)
        );
      }

      const role = session.user.role;
      if (canAccessPath(role, path)) {
        return NextResponse.next();
      }

      return NextResponse.redirect(new URL(getRoleHome(role), req.url));
    }

    console.log('❌ No session, redirecting to login');
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(path)}`, req.url)
    );
  }

  // If authenticated user is accessing public route, allow.
  if (session) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/admin/:path*',
    '/organizer/:path*',
    '/member/:path*',
    '/finance/:path*',
  ],
};
