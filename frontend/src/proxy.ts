import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Example redirect: /desktop -> /dashboard
    if (pathname.startsWith('/desktop') || pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Example: redirect root to login
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Example: Proxy configuration (if needed to an external API)
    // if (pathname.startsWith('/api/')) {
    //   const url = new URL(request.url);
    //   url.hostname = 'api.yourbackend.com'; // Adjust to your actual backend API
    //   url.port = '443';
    //   url.protocol = 'https:';
    //   return NextResponse.rewrite(url);
    // }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
