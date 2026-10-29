import { Cinzel, Manrope } from "next/font/google";

// Manicuristas Imparables' two faces, shared by its page and its checkout.
export const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--imp-display" });
export const manrope = Manrope({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--imp-body" });
