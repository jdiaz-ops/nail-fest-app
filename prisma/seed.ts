import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PROFESSIONS = ["Manicurista", "Estilista", "Estudiante", "Maquillista", "Otro"];

async function main() {
  for (const label of PROFESSIONS) {
    await db.professionOption.upsert({ where: { label }, update: {}, create: { label } });
  }

  const event = await db.event.upsert({
    where: { slug: "bogota-2026" },
    update: {},
    create: {
      slug: "bogota-2026",
      name: "Nail Fest Bogotá 2026",
      city: "Bogotá",
      startsAt: new Date("2026-11-14T14:00:00-05:00"),
      endsAt: new Date("2026-11-14T20:00:00-05:00"),
      capacity: 10000,
    },
  });

  console.log(`Seeded event: /${event.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
