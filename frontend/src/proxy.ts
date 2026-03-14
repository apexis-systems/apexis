import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const token = request.cookies.get('token')?.value;

    const { pathname } = request.nextUrl;

    const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/');

    // Allow public assets
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico' || pathname.startsWith('/app-icon.png')) {
        return NextResponse.next();
    }

    // If user tries to access login/signup while already logged in
    // Exception: Allow invitation/onboarding routes so they can complete account setup or switch
    const isInviteOrOnboarding = pathname === '/auth/invite' || pathname === '/auth/superadmin-onboarding';

    if (isAuthRoute && token && !isInviteOrOnboarding) {
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
