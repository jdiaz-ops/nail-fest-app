import type { CheckoutQuestion, Person, Registration } from "@prisma/client";

// One place that turns "the live checkout questions + a real
// Registration/Person" into the same "buyer details" list Ticket
// Tailor's order modal shows — every question that exists today (cedula,
// city, profession, Instagram/TikTok, and whatever an admin has added in
// /admin/settings/checkout-form), not a hardcoded subset. Locked
// questions read from the real Person/Registration columns they're
// backed by; everything else reads from Registration.customFields — see
// CheckoutQuestion's own schema comment for that mapping.
export interface BuyerField {
  key: string;
  label: string;
  value: string;
  locked: boolean;
}

export function buildBuyerFields(
  questions: CheckoutQuestion[],
  person: Pick<Person, "firstName" | "lastName" | "email" | "phone" | "city" | "profession">,
  registration: Pick<Registration, "customFields">
): BuyerField[] {
  const customFields = (registration.customFields as Record<string, string> | null) ?? {};
  return questions.map((q) => {
    let value = "";
    switch (q.key) {
      case "fullName":
        value = [person.firstName, person.lastName].filter(Boolean).join(" ");
        break;
      case "email":
        value = person.email;
        break;
      case "phone":
        value = person.phone ?? "";
        break;
      case "city":
        value = person.city ?? "";
        break;
      case "profession":
        value = person.profession ?? "";
        break;
      default:
        value = customFields[q.key] ?? "";
    }
    return { key: q.key, label: q.label, value, locked: q.locked };
  });
}
