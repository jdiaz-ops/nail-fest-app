/** First word is firstName, everything else is lastName — matches how
 * our previous ticketing platform's single "Nombre y Apellido" field has
 * always worked, so the live form (RegistrationForm.tsx) and the
 * historical CSV import (lib/import/doorlistCsv.ts) split names
 * identically. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}
