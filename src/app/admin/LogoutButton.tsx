"use client";

export default function LogoutButton({ style }: { style?: React.CSSProperties }) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        background: "transparent",
        border: "none",
        color: "#e8e4dc",
        fontSize: 13,
        cursor: "pointer",
        padding: "8px 12px",
        ...style,
      }}
    >
      Cerrar sesión
    </button>
  );
}
