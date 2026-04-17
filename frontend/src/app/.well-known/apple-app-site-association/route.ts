import { NextResponse } from 'next/server';

const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ['949W22S7SP.com.apexis.ios'],
        paths: ['/auth/login-redirect*', '/auth/invite*', '/auth/onboarding*'],
        components: [
          { '/': '/auth/login-redirect*' },
          { '/': '/auth/invite*' },
          { '/': '/auth/onboarding*' },
        ],
      },
    ],
  },
  webcredentials: {
    apps: ['949W22S7SP.com.apexis.ios']
  }
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
