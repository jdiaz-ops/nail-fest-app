import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import UsersPanel from "./UsersPanel";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requirePageUser(["ADMIN"]);

  const users = await db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, lastLoginAt: true },
  });

  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Usuarios</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Cuentas con acceso al panel. <strong>Admin</strong> ve todo. <strong>Staff</strong> solo puede
        seleccionar el evento y escanear entradas en la puerta — nada más.
      </p>
      <UsersPanel
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
