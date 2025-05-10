import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_TOKEN_NAME = 'auth-token'; // Example token name
const PROTECTED_ROUTES_PREFIX = '/'; // Assuming all app routes are under / except login
const PUBLIC_ROUTES = ['/login']; // Routes accessible without authentication

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = request.cookies.get(AUTH_TOKEN_NAME)?.value;

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  if (!authToken && !isPublicRoute && pathname !== '/login') {
    // If not authenticated and trying to access a protected route (not login itself)
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname); // Optional: pass redirect info
    return NextResponse.redirect(loginUrl);
  }

  if (authToken && pathname === '/login') {
    // If authenticated and trying to access login page, redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For root path, if not authenticated, redirect to login. If authenticated, allow to proceed (it will hit src/app/page.tsx which redirects to /dashboard)
  if (pathname === '/' && !authToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }


  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|img).*)',
  ],
};
