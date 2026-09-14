import { requirePageUser } from "@/lib/auth/guard";
import PhoneCountryFixClient from "@/components/admin/PhoneCountryFixClient";
import PersonDedupeClient from "@/components/admin/PersonDedupeClient";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

// Built from a real finding: a meaningful slice of stored phone numbers
// carry the wrong/missing/extra country code (confirmed by cross-
// referencing against Ciudad — a "+1"/"+32"/etc number with a Colombian
// city on file, and digits that are an exact 10-digit CO mobile shape
// once you look past the prefix, is not a coincidence), and duplicate
// phones are overwhelmingly the same person registering more than once
// with a typo'd name/email, not people sharing a line. Unlike Higiene/
// Etiquetar/Supresiones (one-time migration tools, retired), this stays
// in the nav — new registrations keep producing both patterns, so this
// is ongoing maintenance, not a one-off cleanup.
export default async function TelefonosPage() {
  await requirePageUser(["ADMIN"]);

  return (
    <div>
      <CrmPageHeader
        title="Teléfonos y WhatsApp"
        subtitle="Corrige números colombianos guardados con el código de país equivocado (o ausente), y fusiona a la misma persona registrada más de una vez con el mismo teléfono."
      />

      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Código de país equivocado</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
        Un celular colombiano real puede estar guardado con "+1", "+32" o sin ningún código — el número de la persona no cambió, solo
        el prefijo está mal. Se corrige únicamente cuando lo que queda, quitando el prefijo guardado, es sin duda un celular
        colombiano de 10 dígitos — nunca una adivinanza.
      </p>
      <PhoneCountryFixClient />

      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "36px 0" }} />

      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Fusionar duplicados por teléfono</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
        Person.email tiene restricción única — dos correos idénticos son imposibles. Lo que el correo sí puede esconder es la misma
        persona registrada dos veces con dos correos distintos; el teléfono es la señal más fuerte para detectarlo.
      </p>
      <PersonDedupeClient />
    </div>
  );
}
