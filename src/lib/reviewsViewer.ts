import { requireUser } from "@/lib/auth/guard";

/** Whether the person looking at a public page is logged-in staff — the
 * only viewers who get to see sample reviews (lib/reviews.ts). Reads the
 * session cookie; never throws, never redirects. */
export async function viewerCanSeeSamples(): Promise<boolean> {
  try {
    const auth = await requireUser(["ADMIN", "COORDINADOR"]);
    return !("response" in auth);
  } catch {
    return false;
  }
}
