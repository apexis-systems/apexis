import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const token = request.cookies.get('token')?.value;

    const { pathname } = request.nextUrl;

    const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/');

    // Allow public assets
    if (
        pathname.startsWith('/_next') || 
        pathname.startsWith('/api') || 
        pathname === '/favicon.ico' || 
        pathname.startsWith('/app-icon.png') ||
        pathname.startsWith('/.well-known/')
    ) {
        return NextResponse.next();
    }

    const token_project = request.cookies.get('token_project')?.value;
    const token_superadmin = request.cookies.get('token_superadmin')?.value;

    const isSuperAdminPath = pathname.startsWith('/superadmin');
    const isProjectPath = pathname.startsWith('/admin') || pathname.startsWith('/contributor') || pathname.startsWith('/client');
    const isRoot = pathname === '/';

    // 1. Handle SuperAdmin Paths
    if (isSuperAdminPath) {
        if (!token_superadmin) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }
        if (token !== token_superadmin) {
            const response = NextResponse.redirect(request.url);
            response.cookies.set('token', token_superadmin, { path: '/', maxAge: 60 * 60 * 24 * 30 });
            return response;
        }
    }

    // 2. Handle Project Paths or Root
    if (isProjectPath || isRoot) {
        if (!token_project) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (token !== token_project) {
            const response = NextResponse.redirect(request.url);
            response.cookies.set('token', token_project, { path: '/', maxAge: 60 * 60 * 24 * 30 });
            return response;
        }
    }

    // 3. Handle Auth Route Redirection (if logged in, don't show login pages)
    const isSuperAdminLogin = pathname === '/auth/login';
    const isProjectLogin = pathname === '/login';

    if (isProjectLogin && token_project) {
        return NextResponse.redirect(new URL('/', request.url));
    }
    if (isSuperAdminLogin && token_superadmin) {
        return NextResponse.redirect(new URL('/superadmin/dashboard', request.url));
    }

    // 4. Default Allow
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
