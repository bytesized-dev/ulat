import type { NextConfig } from "next";

// Headers every response carries. There is no Strict-Transport-Security: the
// hub falls back to plain HTTP on the local network when the certificate
// fails, and HSTS would lock phones out of that fallback.
const securityHeaders = [
  // A response typed text/plain is never executed as a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No framing, so a page over the top cannot drive the hub.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Families record voice notes, responders take photos and both set a home
  // location, so this origin may ask. Embedded frames may not.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // pnpm dev behind Caddy is served as the hub name, see infra/README.md. Without
  // this the dev server blocks its own assets for that origin.
  allowedDevOrigins: ["hub.cjjutba.dev"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
