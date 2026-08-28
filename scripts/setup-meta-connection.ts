// One-time (or per-rotation) setup: reads the System User token from the
// environment, encrypts it, and stores the MetaConnection row. Run with:
//   META_SYSTEM_USER_TOKEN=... META_AD_ACCOUNT_ID=act_... META_PIXEL_ID=... \
//     APP_SECRET_KEY=... npx tsx scripts/setup-meta-connection.ts
// See docs/META_SETUP.md for how to generate the token itself.
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "../src/lib/crypto";

const db = new PrismaClient();

async function main() {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const pixelId = process.env.META_PIXEL_ID;

  if (!token || !adAccountId || !pixelId) {
    throw new Error(
      "META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID and META_PIXEL_ID must all be set in the environment."
    );
  }

  await db.metaConnection.create({
    data: {
      adAccountId: adAccountId.replace(/^act_/, ""),
      pixelId,
      systemUserTokenEnc: encryptSecret(token),
    },
  });

  console.log("MetaConnection stored (token encrypted at rest).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
