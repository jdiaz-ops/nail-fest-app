/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit (used by lib/ticketPdf.ts — the PDF ticket attached to the
  // confirmation email, and served live by /api/ticket-pdf/[token] for
  // the WhatsApp resend button) resolves its built-in standard fonts
  // (Helvetica etc.) through a Node "subpath import" —
  // `#standard-fonts/Helvetica`, mapped via pdfkit's own package.json
  // `imports` field — not a plain require()/import path. Next's
  // webpack/turbopack bundler doesn't preserve that resolution mechanism
  // when it bundles a dependency into its own module format, so a
  // bundled pdfkit throws `Cannot find module '#standard-fonts/Helvetica'`
  // in the deployed function even though it works locally (`npm run
  // build && npm start` runs against the full, unbundled node_modules).
  // serverComponentsExternalPackages tells Next to leave this package
  // alone — require() it straight from node_modules at runtime using
  // Node's own resolver, which DOES understand subpath imports
  // correctly. Still under `experimental` on Next 14.2 (this stabilized
  // to a top-level `serverExternalPackages` key in a later Next
  // version — checked against the actual installed next/dist type defs
  // rather than assumed, since guessing wrong here silently no-ops).
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
    // Belt-and-suspenders alongside the above: makes sure the .afm font
    // data files themselves are physically present in the deployed
    // function's filesystem, in case Vercel's own tracer for an
    // "external" package ever narrows what it ships instead of the
    // whole package directory. Harmless either way, cheap insurance.
    outputFileTracingIncludes: {
      "/api/**": ["./node_modules/pdfkit/js/data/**/*"],
    },
  },
};

module.exports = nextConfig;
