import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24, fontSize: 14 }}>
        <Link href="/admin/registrations">Inscritos</Link>
        <Link href="/admin/broadcasts">Broadcasts</Link>
        <Link href="/admin/segments">Segmentos</Link>
        <Link href="/admin/meta">Meta</Link>
      </nav>
      {children}
    </div>
  );
}
