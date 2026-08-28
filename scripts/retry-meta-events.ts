// Manual/local convenience wrapper around the same logic /api/meta/retry
// calls over HTTP — useful for testing without standing up a cron job yet.
//   npx tsx scripts/retry-meta-events.ts
import { processDueMetaEvents } from "../src/lib/meta/capi";

processDueMetaEvents()
  .then((result) => {
    console.log(`Retried ${result.attempted}, sent ${result.sent}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
