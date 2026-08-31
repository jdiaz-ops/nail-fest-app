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
    // serverComponentsExternalPackages alone fixed the RESOLUTION
    // mechanism (confirmed live: the error moved from "Cannot find
    // module '#standard-fonts/Helvetica'" to a real filesystem path,
    // meaning Node's own resolver is now correctly turning that subpath
    // import into ./js/standard-fonts/Helvetica.cjs) but Vercel's file
    // tracer (@vercel/nft) still doesn't SHIP every file pdfkit actually
    // needs at runtime — verified directly against the real
    // route.js.nft.json trace manifests after adding a narrower
    // js/standard-fonts/**/* include: the tracer had followed pdfkit's
    // ESM entry (js/pdfkit.node.mjs) for its static analysis, but the
    // deployed function's require() at runtime actually resolves through
    // the CJS entry (js/pdfkit.js) instead — which was then missing
    // entirely, a second, different MODULE_NOT_FOUND. Rather than keep
    // chasing individual files through this ESM/CJS + subpath-imports
    // resolution mismatch, include the WHOLE package — small library,
    // and the one glob that's actually correct regardless of which
    // entry point or lazily-`imports`-mapped file ends up used.
    outputFileTracingIncludes: {
      "/api/**": ["./node_modules/pdfkit/**/*"],
    },
  },
};

module.exports = nextConfig;
