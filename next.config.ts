import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  experimental: { cpus: 1 },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org https://oauth.telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src https://oauth.telegram.org; connect-src 'self' https://*.mux.com https://storage.googleapis.com; media-src 'self' blob: https://*.mux.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
    ] }];
  },
};
export default config;
