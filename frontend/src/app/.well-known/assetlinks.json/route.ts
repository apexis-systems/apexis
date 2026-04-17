import { NextResponse } from 'next/server';

// Digital Asset Links file for Android App Links.
// Tells Android to open the APEXISpro app directly instead of Chrome
// when these paths are tapped on a device with the app installed.
const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.apexis.app',
      sha256_cert_fingerprints: [
        'C9:78:D7:9F:E6:B0:5B:ED:B4:C3:8E:00:E7:5C:47:E4:60:DB:9B:B0:61:12:8F:A9:09:EB:A6:14:C7:7E:5A:6B',
      ],
    },
  },
];

export function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
