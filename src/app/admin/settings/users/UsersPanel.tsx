"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "STAFF" | "COORDINADOR";

interface UserRow {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const ERROR_LABEL: Record<string, string> = {
  username_taken: "Ese usuario ya existe.",
  last_admin: "No puedes dejar la cuenta sin ningún admin activo.",
  cannot_delete_self: "No puedes borrar tu propia cuenta.",
};

interface ApiErrorBody {
  error?: string;
  // From zod's safeParse — server validation failures (username con
  // espacios, contraseña muy corta, etc.) come back with la razón
  // específica acá; mostrar un "algo salió mal" genérico para esto era en
  // sí mismo un problema real de usabilidad, no solo un mensaje sin pulir.
  issues?: { path: (string | number)[]; message: string }[];
}

function errorMessage(body: unknown): string {
  const parsed = body as ApiErrorBody | null;
  if (parsed?.error === "invalid_body" && parsed.issues?.[0]) {
    const issue = parsed.issues[0];
    const field = issue.path[0];
    const fieldLabel = field === "username" ? "Usuario" : field === "password" ? "Contraseña" : String(field ?? "");
    return fieldLabel ? `${fieldLabel}: ${issue.message}` : issue.message;
  }
  return (parsed?.error && ERROR_LABEL[parsed.error]) || "Algo salió mal. Intenta de nuevo.";
}

function relativeDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

export default function UsersPanel({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();

  return (
    <div style={{ marginTop: 20 }}>
      <CreateUserForm onCreated={() => router.refresh()} />

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginTop: 24 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Usuario</th>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Rol</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
              <th style={{ padding: "10px 12px" }}>Último acceso</th>
              <th style={{ padding: "10px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRowItem key={u.id} user={u} isSelf={u.id === currentUserId} onChanged={() => router.refresh()} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no hay usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleSelect({ id, value, onChange, disabled }: { id?: string; value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Role)}>
      <option value="STAFF">Staff</option>
      <option value="COORDINADOR">Coordinador</option>
      <option value="ADMIN">Admin</option>
    </select>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name: name || undefined, role, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(errorMessage(await res.json().catch(() => null)));
      return;
    }
    setUsername("");
    setName("");
    setPassword("");
    setRole("STAFF");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px 1fr auto", gap: 12, alignItems: "end" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="new-username">Usuario</label>
          <input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="juan.puerta" required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="new-name">Nombre (opcional)</label>
          <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="new-role">Rol</label>
          <RoleSelect id="new-role" value={role} onChange={setRole} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="new-password">Contraseña</label>
          <input id="new-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" required minLength={8} />
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Creando…" : "Crear usuario"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>}
    </form>
  );
}

function UserRowItem({ user, isSelf, onChanged }: { user: UserRow; isSelf: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setRowError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setRowError(errorMessage(await res.json().catch(() => null)));
      return;
    }
    onChanged();
  }

  async function handleToggleActive() {
    const verb = user.active ? "desactivar" : "activar";
    if (!confirm(`¿${verb.charAt(0).toUpperCase() + verb.slice(1)} a ${user.username}?${user.active ? " Se cierra su sesión de inmediato." : ""}`)) return;
    await patch({ active: !user.active });
  }

  async function handleRoleChange(role: Role) {
    if (role === user.role) return;
    await patch({ role });
  }

  async function handleSubmitReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setRowError("mínimo 8 caracteres");
      return;
    }
    await patch({ password: newPassword });
    setNewPassword("");
    setResetting(false);
  }

  async function handleDelete() {
    if (!confirm(`¿Borrar la cuenta de ${user.username}? Esto no se puede deshacer.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setRowError(errorMessage(await res.json().catch(() => null)));
      return;
    }
    onChanged();
  }

  return (
    <>
      <tr style={{ borderTop: "1px solid #f0efec", opacity: user.active ? 1 : 0.55 }}>
        <td style={{ padding: "10px 12px", fontWeight: 600 }}>
          {user.username} {isSelf && <span style={{ fontWeight: 400, color: "#5b5f6b" }}>(tú)</span>}
        </td>
        <td style={{ padding: "10px 12px" }}>{user.name || "—"}</td>
        <td style={{ padding: "10px 12px" }}>
          {isSelf ? <RoleBadge role={user.role} /> : <RoleSelect value={user.role} disabled={busy} onChange={handleRoleChange} />}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <span
            style={{
              display: "inline-flex",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: user.active ? "#e8f6ef" : "#f6f5f2",
              color: user.active ? "#0e6b4c" : "#5b5f6b",
            }}
          >
            {user.active ? "Activo" : "Inactivo"}
          </span>
        </td>
        <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{relativeDate(user.lastLoginAt)}</td>
        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
          <button onClick={() => setResetting((v) => !v)} disabled={busy} style={linkButtonStyle}>
            Contraseña
          </button>
          {!isSelf && (
            <>
              <button onClick={handleToggleActive} disabled={busy} style={linkButtonStyle}>
                {user.active ? "Desactivar" : "Activar"}
              </button>
              <button onClick={handleDelete} disabled={busy} style={{ ...linkButtonStyle, color: "var(--danger)" }}>
                Borrar
              </button>
            </>
          )}
        </td>
      </tr>
      {resetting && (
        <tr style={{ borderTop: "1px solid #f0efec", background: "#faf9f7" }}>
          <td colSpan={6} style={{ padding: "10px 12px" }}>
            <form onSubmit={handleSubmitReset} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#5b5f6b" }}>Nueva contraseña para {user.username}:</span>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
                minLength={8}
                style={{ flex: "0 0 220px" }}
              />
              <button className="primary" type="submit" disabled={busy}>
                Guardar
              </button>
              <button type="button" onClick={() => setResetting(false)} style={linkButtonStyle}>
                Cancelar
              </button>
            </form>
          </td>
        </tr>
      )}
      {rowError && (
        <tr>
          <td colSpan={6} style={{ padding: "0 12px 10px", color: "var(--danger)", fontSize: 13 }}>
            {rowError}
          </td>
        </tr>
      )}
    </>
  );
}

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", COORDINADOR: "Coordinador", STAFF: "Staff" };
const ROLE_STYLE: Record<Role, { bg: string; ink: string }> = {
  ADMIN: { bg: "#e3faf7", ink: "var(--accent-ink)" },
  COORDINADOR: { bg: "#fdf1e6", ink: "#8a5a1f" },
  STAFF: { bg: "#f6f5f2", ink: "#5b5f6b" },
};

function RoleBadge({ role }: { role: Role }) {
  const style = ROLE_STYLE[role];
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.ink,
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--link)",
  cursor: "pointer",
  fontSize: 13,
  padding: "4px 8px",
};
