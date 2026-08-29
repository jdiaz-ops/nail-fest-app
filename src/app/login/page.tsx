import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

// Already logged in and hitting /login anyway (bookmark, back button) —
// send them straight to where their role actually lives instead of
// showing the form again.
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "STAFF" ? "/admin/scan" : "/admin");

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f7", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Nail Fest</div>
          <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>Inicia sesión para continuar</div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
