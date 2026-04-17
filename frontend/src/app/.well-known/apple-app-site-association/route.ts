import { NextResponse } from 'next/server';

// Apple-App-Site-Association (AASA) file for Universal Links.
// Tells iOS to open the APEXISpro app directly instead of Safari
// when these paths are tapped on a device with the app installed.
//
// Replace YOUR_TEAM_ID with your Apple Developer Team ID:
// developer.apple.com → Account → Membership Details → Team ID
const AASA = {
  applinks: {
    details: [
      {
        appIDs: ['949W22S7SP.com.apexis.ios'],
        components: [
          { '/': '/auth/login-redirect*' },
          { '/': '/auth/invite*' },
          { '/': '/auth/onboarding*' },
        ],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
