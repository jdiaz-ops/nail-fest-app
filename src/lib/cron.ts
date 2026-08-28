import { NextRequest } from "next/server";

/**
 * Two ways a cron-protected route gets authorized:
 *
 * 1. Vercel Cron Jobs (declared in vercel.json's `crons`, no dashboard
 *    clicking needed) trigger a GET request and, when the `CRON_SECRET` env
 *    var is set, automatically attach `Authorization: Bearer <CRON_SECRET>`.
 *    See https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 * 2. The older `x-cron-secret` header, for manual testing (curl) or a
 *    different scheduler (GitHub Actions, etc).
 *
 * Both check against a secret that must be set — an unset secret never
 * authorizes anything, so leaving CRON_SECRET/INTERNAL_CRON_SECRET blank
 * doesn't accidentally open these routes up.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const bearer = req.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;

  const legacy = req.headers.get("x-cron-secret");
  if (process.env.INTERNAL_CRON_SECRET && legacy === process.env.INTERNAL_CRON_SECRET) return true;

  return false;
}
