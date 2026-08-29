/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdfkit (used by lib/ticketPdf.ts, for the PDF ticket attached to the
    // confirmation email) loads its built-in Helvetica font metrics
    // (.afm files under node_modules/pdfkit/js/data) from disk at runtime
    // by filename, not via require()/import — Next's build-time file
    // tracer can't see that and would otherwise leave them out of the
    // serverless function bundle on Vercel, which works fine in `npm run
    // build && npm start` locally (full node_modules present) but throws
    // "Could not find font file" in production once only the traced
    // subset ships. Every /api route is covered since sendTicketEmail()
    // (and therefore pdfkit) is reachable from more than one of them
    // (register, resend-ticket, admin resend).
    outputFileTracingIncludes: {
      "/api/**": ["./node_modules/pdfkit/js/data/**/*"],
    },
  },
};

module.exports = nextConfig;
