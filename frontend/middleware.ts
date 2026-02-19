/**
 * Next.js Middleware for Route Protection
 *
 * User Architecture:
 * - System Users (tenant_id=null): Routed to /admin/*
 * - Tenant Users (tenant_id=UUID): Routed to /dashboard/*
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/accept-invite'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userCookie = request.cookies.get('user')?.value;

  // Public routes (allow access)
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (!userCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // User is authenticated - handle role-based routing
  try {
    const user = JSON.parse(decodeURIComponent(userCookie));

    // Determine if user is a system user (tenant_id is null or missing)
    const isSystemUser = user.tenant_id === null || user.tenant_id === undefined;

    // System User routing (platform management)
    if (isSystemUser) {
      if (!pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    } else {
      // Tenant User routing (business operations)
      if (pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
