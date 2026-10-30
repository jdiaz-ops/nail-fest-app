import localFont from "next/font/local";

// The site's faces, served from here (2026-10-30): the very files Google
// Fonts gave next/font/google — their latin subsets, which hold Spanish —,
// kept in the repo since Google started answering some of them with
// addresses next/font 14 can't read and the deploy died in its loader
// («Cannot read properties of null (reading '1')»). One per way the pages
// asked for them, declared as Google's CSS declared them: one weight, its
// static file, and the class sets that weight; several, the same variable
// file at each of them. Licenses: OFL.txt.

/** Fraunces Black alone (the class sets its weight, 900). */
export const fraunces900 = localFont({ src: "./fraunces-black.woff2", weight: "900", adjustFontFallback: "Times New Roman" });

/** Fraunces at 800 and 900. */
export const fraunces800and900 = localFont({
  src: [
    { path: "./fraunces-variable.woff2", weight: "800" },
    { path: "./fraunces-variable.woff2", weight: "900" },
  ],
  adjustFontFallback: "Times New Roman",
});

/** Fraunces at 600 and 900 (the admin's titles). */
export const fraunces600and900 = localFont({
  src: [
    { path: "./fraunces-variable.woff2", weight: "600" },
    { path: "./fraunces-variable.woff2", weight: "900" },
  ],
  adjustFontFallback: "Times New Roman",
});

/** Nail Fest's «Asistiré» and screens (components/nailfest/fonts.ts): Fraunces at 700 and 900, as --nf-display. */
export const frauncesNailFest = localFont({
  src: [
    { path: "./fraunces-variable.woff2", weight: "700" },
    { path: "./fraunces-variable.woff2", weight: "900" },
  ],
  variable: "--nf-display",
  adjustFontFallback: "Times New Roman",
});

/** And Inter at 400–800, as --nf-body. */
export const interNailFest = localFont({
  src: [
    { path: "./inter-variable.woff2", weight: "400" },
    { path: "./inter-variable.woff2", weight: "600" },
    { path: "./inter-variable.woff2", weight: "700" },
    { path: "./inter-variable.woff2", weight: "800" },
  ],
  variable: "--nf-body",
});

/** Manicuristas Imparables (components/imparables/fonts.ts): Cinzel at 700–900, as --imp-display. */
export const cinzelImparables = localFont({
  src: [
    { path: "./cinzel-variable.woff2", weight: "700" },
    { path: "./cinzel-variable.woff2", weight: "800" },
    { path: "./cinzel-variable.woff2", weight: "900" },
  ],
  variable: "--imp-display",
  adjustFontFallback: "Times New Roman",
});

/** And Manrope at 400–800, as --imp-body. */
export const manropeImparables = localFont({
  src: [
    { path: "./manrope-variable.woff2", weight: "400" },
    { path: "./manrope-variable.woff2", weight: "600" },
    { path: "./manrope-variable.woff2", weight: "700" },
    { path: "./manrope-variable.woff2", weight: "800" },
  ],
  variable: "--imp-body",
});
