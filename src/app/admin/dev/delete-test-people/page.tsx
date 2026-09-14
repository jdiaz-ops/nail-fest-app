import { requirePageUser } from "@/lib/auth/guard";
import DeleteTestPeopleForm from "@/components/admin/DeleteTestPeopleForm";

export const dynamic = "force-dynamic";

// One-off utility, not linked from any nav — for permanently deleting
// confirmed test/junk Person rows (e.g. typo'd emails entered while
// testing the registration form's typo-suggestion feature). Unlike the
// suppression tools this app used to have, this actually deletes the
// row and its data (registrations, consents, WhatsApp conversations) —
// never a guess at "this looks fake," only exact emails a human pastes
// in, always previewed before the real delete. Safe to leave in place:
// it does nothing until someone pastes emails and confirms.
export default async function DeleteTestPeoplePage() {
  await requirePageUser(["ADMIN"]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Borrar personas de prueba</h1>
      <p style={{ fontSize: 13.5, color: "#5b5f6b", margin: "0 0 20px" }}>
        Borra permanentemente — no solo suprime consentimiento — los perfiles de correos exactos que pegues abajo, junto con sus
        registros, consentimientos y conversaciones de WhatsApp. No adivina quién "parece" de prueba: solo actúa sobre los correos
        exactos que escribas, y siempre te muestra una vista previa antes de borrar de verdad.
      </p>
      <DeleteTestPeopleForm />
    </main>
  );
}
