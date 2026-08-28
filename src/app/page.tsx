import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await db.event.findMany({ orderBy: { startsAt: "asc" } });
  return (
    <main style={{ maxWidth: 480, margin: "64px auto", padding: "0 20px" }}>
      <h1>Nail Fest</h1>
      <p>Eventos abiertos:</p>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/${e.slug}`}>
              {e.name} — {e.city}
            </Link>
          </li>
        ))}
      </ul>
      {events.length === 0 && (
        <p>
          No hay eventos todavía. Corre <code>npm run db:seed</code> para crear uno de prueba.
        </p>
      )}
    </main>
  );
}
