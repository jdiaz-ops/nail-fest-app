import { PrismaClient } from "@prisma/client";
import { seedBaseline } from "../src/lib/seed";

const db = new PrismaClient();

seedBaseline(db)
  .then(({ eventSlug }) => console.log(`Seeded event: /${eventSlug}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
