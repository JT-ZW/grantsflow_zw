import type { NextConfig } from "next";

// Content-Security-Policy
// 'unsafe-inline' is required by Next.js for inline scripts/styles in production builds.
// 'unsafe-eval' is required by some Next.js internals (e.g. webpack HMR in dev).
// connect-src includes Supabase API + WebSocket endpoints.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options",          value: "DENY" },
  // Prevent MIME sniffing
  { key: "X-Content-Type-Options",   value: "nosniff" },
  // Control referrer info
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  // Restrict browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HTTP Strict Transport Security (2 years, include subdomains, preload)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content Security Policy
  { key: "Content-Security-Policy", value: CSP },
  // Cross-Origin policies
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],

  experimental: {
    serverActions: {
      // Must be at least as large as the max allowed file upload size.
      // Uploads are capped at 20 MB in actions; add 5 MB overhead for form data.
      bodySizeLimit: "25mb",
    },
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
