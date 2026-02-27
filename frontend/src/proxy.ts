import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const token = request.cookies.get('token')?.value;

    const { pathname } = request.nextUrl;

    const isAuthRoute = pathname === '/login' || pathname === '/signup';

    // Allow public assets
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
        return NextResponse.next();
    }

    // If user tries to access login/signup while already logged in
    if (isAuthRoute && token) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // If user tries to access protected routes without a token
    if (!token && !isAuthRoute && pathname !== '/') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
