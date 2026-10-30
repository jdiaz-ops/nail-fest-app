import { Fraunces, Inter } from "next/font/google";

// Nail Fest's two faces for its «Asistiré» image and page (2026-10-30), as in
// its confirmation email: Fraunces for the event's name, Inter for the rest.
export const fraunces = Fraunces({ subsets: ["latin"], weight: ["700", "900"], variable: "--nf-display" });
export const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--nf-body" });
