"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { COUNTRY_CODES, GENERIC_ID_PLACEHOLDER, GENERIC_PHONE_PLACEHOLDER, stripTrunkZero } from "@/lib/countryCodes";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";
import { attributionFromSearchParams } from "@/lib/utm";
import type { CheckoutTicket } from "@/lib/imparables/pricing";
import { dollars, pesos } from "@/lib/imparables/stages";
import type { WompiWidgetParams } from "@/lib/payments/wompi";
import { getValidFbc, track } from "@/components/tracking";
import { openWompiWidget } from "@/components/wompiWidget";
import PayPalButtons from "@/components/PayPalButtons";
import { Tiara } from "./ImpArt";

// Manicuristas Imparables' one-page checkout (2026-10-29), after
// Marcolini's. On the left, numbered: the buyer's details, profile, payment;
// on the right (on a phone, folded on top of the form) the event and a
// discount code. Paying in pesos registers the person through /api/register
// (pending payment, with the discount worked out there again) and opens
// Wompi's own window over the page with what it signed; if that window
// doesn't load, Wompi's page instead. Wompi sends the buyer on to
// /[eventSlug]/pago, which confirms. Paying in dollars — a ticket with a USD
// price, PayPal set up — PayPal's own buttons take the place of «Pagar»
// (components/PayPalButtons.tsx): the same registration, then PayPal's order,
// captured on the server once the buyer approves, and on to /pago too. Where
// the buyer lives picks the currency to start with (dollars outside
// Colombia); they can always change it. Free events keep their usual form.

type Currency = "COP" | "USD";

interface Doc {
  value: string;
  short: string;
  field: string;
  company?: boolean;
  /** Its type for Wompi's window (legalIdType), when Wompi takes it. */
  wompi?: string;
}

const DOCS_CO: Doc[] = [
  { value: "CC", short: "CC", field: "Cédula de ciudadanía", wompi: "CC" },
  { value: "CE", short: "CE", field: "Cédula de extranjería", wompi: "CE" },
  { value: "PPT", short: "PPT", field: "Número de PPT" },
  { value: "PAS", short: "Pasaporte", field: "Número de pasaporte", wompi: "PP" },
  { value: "NIT", short: "NIT", field: "NIT de la empresa", company: true, wompi: "NIT" },
];
const DOCS_ABROAD: Doc[] = [
  { value: "DOC", short: "Documento", field: "Documento de identidad" },
  { value: "PAS", short: "Pasaporte", field: "Número de pasaporte" },
  { value: "EMP", short: "Empresa", field: "Documento de la empresa", company: true },
];

// What /api/register's refusals mean to the buyer (the same as the modal's, EventRegistration.tsx).
const REGISTER_ERRORS: Record<string, string> = {
  event_not_found: "Este evento ya no está disponible.",
  not_permitted: "No podemos completar tu registro con este correo.",
  email_domain_invalid: "Ese correo no parece existir — revisa que el dominio (después de la @) esté bien escrito.",
  missing_required_fields: "Faltan campos obligatorios — revisa el formulario.",
  email_mismatch: "Los correos no coinciden — revísalos.",
  invalid_country: "Elige el país donde vives.",
  sold_out: "Justo se agotaron los cupos de esta entrada mientras llenabas el formulario.",
  invalid_ticket_quantity: "La cantidad elegida ya no es válida — ajústala en el resumen.",
  ticket_window_closed: "Este precio ya cerró. Recarga la página para ver el de hoy.",
  no_ticket_on_sale: "Ahora mismo no hay cupos a la venta.",
  usd_not_available: "Esta entrada no se puede pagar en dólares. Elige pagar en pesos con Wompi.",
  paypal_not_configured: "PayPal no está disponible ahora mismo. Puedes pagar en pesos con Wompi.",
  tier_sold_out: "Este nivel se agotó mientras llenabas el formulario. Vuelve a la página para elegir otro.",
  invalid_ticket_type: "Esta entrada ya no está disponible. Vuelve a la página y elígela de nuevo.",
};

function money(currency: Currency, cents: number): string {
  return currency === "USD" ? dollars(cents) : pesos(cents / 100);
}

// The field paying found empty, to say so right under it.
const Missing = createContext<string | null>(null);

export interface ImpCheckoutProps {
  eventSlug: string;
  backHref: string;
  name: { pre: string; big: string };
  /** "27 de junio de 2027" */
  dates: string;
  /** "Congreso virtual · 100% en vivo" */
  format: string;
  /** The price stage on sale (lib/imparables/pricing.ts): in pesos; in dollars (cents), when it has a USD price. */
  ticket: CheckoutTicket;
  /** Whether it takes a discount code — not for now (2026-10-29). */
  codes: boolean;
  professions: string[];
  /** PayPal's buttons (lib/payments/paypal.ts's paypalCheckoutConfig) — null without PayPal, or without a USD price. */
  paypal: { clientId: string } | null;
  /** The version of the page it's the checkout of (/v/<slug>, lib/imparables/versions.ts): its link, and its special
   * price's name when the ticket is at it. */
  version?: { slug: string; special: { label: string } | null } | null;
  /** On a version that sells the ticket levels (lib/imparables/tiers.ts; the team's boceto, 2026-10-31): «Tu entrada»
   * — Imparable, and Círculo and Élite to change it for. */
  levels?: CheckoutLevels | null;
}

/** One of «Tu entrada»'s choices. */
export interface CheckoutChoice {
  slug: string;
  name: string;
  /** Its small tag: «★ La más elegida», «20 cupos». */
  tag: string | null;
  /** Imparable's first line: its stage, bold, and its normal price («Etapa Creyente · precio normal $150.000»). */
  note: { strong: string; rest: string | null } | null;
  /** What it brings. */
  line: string;
  /** What she buys with it. */
  ticket: CheckoutTicket;
}

export interface CheckoutLevels {
  title: string;
  intro: string;
  /** Imparable first: the others show what they add to it. */
  choices: CheckoutChoice[];
  /** The one chosen when the checkout opens. */
  chosen: string;
}

interface Applied {
  code: string;
  label: string;
  /** In the currency it was worked out for. */
  discountCents: number;
  currency: Currency;
}

interface Registered {
  checkoutUrl?: string;
  wompi?: WompiWidgetParams;
  paypal?: { paymentId: string };
}

export default function ImpCheckout({ eventSlug, backHref, name, dates, format, ticket: openedWith, codes, professions, paypal, version = null, levels = null }: ImpCheckoutProps) {
  // What's on sale: the stage the page opened with, until paying finds another one is (/api/register's price_changed).
  const [ticket, setTicket] = useState(openedWith);
  // The version's special price, while the ticket is at it.
  const [special, setSpecial] = useState(version?.special ?? null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", docNumber: "", company: "", city: "", phone: "", profession: "", website: "" });
  const [qty, setQty] = useState(Math.max(1, ticket.min));
  const [country, setCountry] = useState("CO");
  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [docType, setDocType] = useState("CC");
  const [currency, setCurrency] = useState<Currency>("COP");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  // «Tu entrada»: its choices (Imparable's ticket follows a change of stage) and the one she's buying.
  const [choices, setChoices] = useState(levels?.choices ?? []);
  const [chosen, setChosen] = useState(levels?.chosen ?? null);
  const opened = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Once the buyer picks a currency themselves, the country no longer changes it.
  const currencyPicked = useRef(false);
  // Only the latest code check counts (the currency or the count can change while one is on its way).
  const codeAsk = useRef(0);
  // Whether paying already said what went wrong — PayPal's own onError comes after it.
  const explained = useRef(false);

  // Opening the checkout: the same counts the modal used to keep — Meta's
  // InitiateCheckout, Clarity's funnel, and our own (/api/funnel/open).
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    window.clarity?.("event", "abrir_registro");
    track("InitiateCheckout");
    fetch("/api/funnel/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug, version: version?.slug }),
      keepalive: true,
    }).catch(() => {});
  }, [eventSlug, version?.slug]);

  const docs = country === "CO" ? DOCS_CO : DOCS_ABROAD;
  const doc = docs.find((d) => d.value === docType) ?? docs[0]!;
  const idHint = country === "CO" ? undefined : (COUNTRY_CODES.find((c) => c.iso2 === country)?.idPlaceholder ?? GENERIC_ID_PLACEHOLDER);
  const phoneHint = COUNTRY_CODES.find((c) => c.iso2 === phoneCountry)?.phonePlaceholder ?? GENERIC_PHONE_PLACEHOLDER;

  const canPayUsd = paypal !== null && ticket.usdCents !== null;
  const usd = canPayUsd && currency === "USD";
  // What each currency comes to, in its own cents (a code's discount only in the currency it was worked out for).
  const totalCents = (cur: Currency) => (cur === "USD" ? (ticket.usdCents ?? 0) : ticket.price * 100) * qty - (applied?.currency === cur ? applied.discountCents : 0);
  const shown: Currency = usd ? "USD" : "COP";
  const normalCents = usd ? ticket.fullUsdCents : ticket.fullPrice !== null ? ticket.fullPrice * 100 : null;
  const total = money(shown, totalCents(shown));

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  function fullPhone(): string {
    const digits = form.phone.replace(/[^0-9]/g, "");
    const dial = WORLD_COUNTRIES.find((c) => c.iso2 === phoneCountry)?.dialCode ?? "";
    return digits ? `${dial}${stripTrunkZero(digits)}` : "";
  }

  function chooseCountry(iso2: string) {
    setCountry(iso2);
    setPhoneCountry(iso2);
    setDocType(iso2 === "CO" ? "CC" : "DOC");
    if (canPayUsd && !currencyPicked.current) changeCurrency(iso2 === "CO" ? "COP" : "USD");
  }

  function changeCurrency(next: Currency) {
    if (next === currency) return;
    setCurrency(next);
    setError(null);
    setNotice(null);
    if (applied) void checkCode(applied.code, qty, next);
  }

  // A code's discount depends on how many and in which currency: asked again whenever either changes.
  async function checkCode(typed: string, count: number, cur: Currency) {
    const ask = ++codeAsk.current;
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/checkout/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, ticketTypeId: ticket.id, ticketCount: count, code: typed, currency: cur }),
      });
      const body = await res.json();
      if (ask !== codeAsk.current) return;
      if (body?.ok) {
        setApplied({ code: body.code, label: body.label, discountCents: body.discountCents, currency: cur });
        setCode("");
      } else {
        setApplied(null);
        setCodeError(body?.message ?? "Ese código no aplica.");
      }
    } catch {
      if (ask === codeAsk.current) setCodeError("No pudimos revisar el código, intenta de nuevo.");
    } finally {
      if (ask === codeAsk.current) setCheckingCode(false);
    }
  }

  function changeQty(next: number) {
    setQty(next);
    if (applied) void checkCode(applied.code, next, shown);
  }

  // Someone who leaves after giving their email can still be reminded (see /api/register/draft).
  function saveDraft() {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return;
    const { utmSource, utmMedium, utmCampaign } = attributionFromSearchParams(new URLSearchParams(window.location.search));
    fetch("/api/register/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventSlug,
        email: form.email.trim(),
        phone: fullPhone() || undefined,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        city: form.city.trim() || undefined,
        profession: form.profession || undefined,
        country,
        ticketTypeId: ticket.id,
        ticketCount: qty,
        utmSource,
        utmMedium,
        utmCampaign,
        version: version?.slug,
      }),
    }).catch(() => {});
  }

  // What Wompi's window can show already filled: only what it takes (a
  // Colombian mobile, and the document when it's CC, CE, NIT or passport).
  function customerData(): Record<string, string> {
    const data: Record<string, string> = { email: form.email.trim(), fullName: `${form.firstName} ${form.lastName}`.trim() };
    const mobile = form.phone.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
    if (phoneCountry === "CO" && /^3\d{9}$/.test(mobile)) {
      data.phoneNumber = mobile;
      data.phoneNumberPrefix = "+57";
    }
    if (country === "CO" && doc.wompi && form.docNumber.trim()) {
      data.legalId = form.docNumber.replace(/-\d$/, "").replace(/[^0-9A-Za-z]/g, "");
      data.legalIdType = doc.wompi;
    }
    return data;
  }

  // The first field paying finds empty, pointed out right under it: false while there's one.
  function ready(): boolean {
    const firstInvalid = formRef.current?.querySelector<HTMLElement>(":invalid");
    if (firstInvalid) {
      setMissing(firstInvalid.closest("[data-label]")?.getAttribute("data-label") ?? null);
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus({ preventScroll: true });
      return false;
    }
    setMissing(null);
    return true;
  }

  function fail(message: string) {
    explained.current = true;
    setError(message);
  }

  // Registers the buyer (pending payment) in `cur`: /api/register's answer,
  // or null once it's said why not (a refusal, or a ticket paid already).
  async function register(cur: Currency): Promise<Registered | null> {
    const customFields: Record<string, string> = { tipoDocumento: doc.short, cedula: form.docNumber.trim() };
    if (doc.company && form.company.trim()) customFields.razonSocial = form.company.trim();
    const cookie = document.cookie.match(/(?:^|; )_fbp=([^;]*)/);

    let res: Response;
    try {
      res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          email: form.email.trim(),
          phone: fullPhone(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          city: form.city.trim(),
          profession: form.profession,
          country,
          customFields,
          // Implicit in paying, spelled out in the line under the button (same as the modal).
          consents: { logistics: true, marketing: true, advertising: true, whatsapp: true },
          attribution: attributionFromSearchParams(new URLSearchParams(window.location.search)),
          fbc: getValidFbc(),
          fbp: cookie?.[1] ? decodeURIComponent(cookie[1]) : undefined,
          ticketTypeId: ticket.id,
          ticketCount: qty,
          discountCode: applied?.currency === cur ? applied.code : undefined,
          currency: cur,
          shownUnitCents: cur === "USD" ? (ticket.usdCents ?? undefined) : ticket.price * 100,
          website: form.website,
          version: version?.slug,
          tier: chosen ?? undefined,
        }),
      });
    } catch {
      fail("No pudimos completar tu registro, intenta de nuevo.");
      return null;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body?.error === "price_changed" && body.ticket) {
        // The stage changed since the page opened (one closed on its date or
        // its cap): its price, shown before anything is charged — paying
        // again pays it.
        const next = body.ticket as CheckoutTicket;
        const count = Math.min(Math.max(qty, next.min), next.max);
        const inUsd = cur === "USD" && next.usdCents !== null;
        setTicket(next);
        // Imparable is the stage on sale: its choice in «Tu entrada» says the new one too.
        if (chosen && chosen === choices[0]?.slug) setChoices((cs) => cs.map((c, i) => (i === 0 ? { ...c, ticket: next } : c)));
        setSpecial(body.special ? (version?.special ?? null) : null);
        setQty(count);
        if (cur === "USD" && !inUsd) setCurrency("COP");
        const hadCode = applied !== null;
        setApplied(null);
        explained.current = true;
        setNotice(
          `El precio cambió: ahora es ${inUsd ? money("USD", next.usdCents! * count) : money("COP", next.price * 100 * count)} (${next.name}).${hadCode ? " Vuelve a aplicar tu código." : ""} Revisa el total y vuelve a ${cur === "USD" ? "tocar el botón de PayPal" : "tocar «Pagar»"}.`
        );
      } else if (body?.error === "discount_invalid") {
        setApplied(null);
        fail(`${body.message ?? "Ese código ya no aplica."} Revisa el total antes de pagar.`);
      } else if (body?.error === "already_bought") {
        // Moving up after buying is her link's, paying only the difference — with a level bought here; a ticket
        // bought elsewhere moves up with the team.
        fail(
          body.tier
            ? `Ya tienes tu boleta con este correo (${body.tier}). Para pasarte de nivel, abre el enlace «Ver cómo» de tu correo de confirmación: pagas solo la diferencia.`
            : "Ya tienes tu boleta con este correo. Si quieres pasarte de nivel, escríbenos por WhatsApp y lo hacemos contigo."
        );
      } else {
        fail(REGISTER_ERRORS[body?.error] ?? "Algo salió mal, intenta de nuevo.");
      }
      return null;
    }
    if (!body?.requiresPayment) {
      // Already paid before (a resend): nothing to charge.
      explained.current = true;
      setNotice("Ya tienes tu cupo confirmado. Te reenviamos la confirmación a tu correo.");
      return null;
    }
    return body as Registered;
  }

  // A choice in «Tu entrada»: its ticket at its own price — Círculo and Élite one, no code —; «Pagar» says its total.
  function choose(choice: CheckoutChoice) {
    if (choice.slug === chosen) return;
    setChosen(choice.slug);
    setTicket(choice.ticket);
    setQty((q) => Math.min(Math.max(q, choice.ticket.min), choice.ticket.max));
    setApplied(null);
    if (choice.ticket.usdCents === null) setCurrency("COP");
    setNotice(null);
  }

  // What a choice costs in «Tu entrada», in the currency shown: Imparable's price, and the others' over it («+ $100.000»).
  function choicePrice(choice: CheckoutChoice, index: number): string {
    const base = choices[0]!;
    const inUsd = shown === "USD" && choice.ticket.usdCents !== null && base.ticket.usdCents !== null;
    const cents = (c: CheckoutChoice) => (inUsd ? c.ticket.usdCents! : c.ticket.price * 100);
    if (index === 0) return money(inUsd ? "USD" : "COP", cents(choice));
    return `+ ${money(inUsd ? "USD" : "COP", Math.max(0, cents(choice) - cents(base)))}`;
  }

  // «Pagar», in pesos: Wompi's window.
  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (paying || usd) return;
    setError(null);
    setNotice(null);
    if (!ready()) return;
    setPaying(true);

    const body = await register("COP");
    if (!body) {
      setPaying(false);
      return;
    }
    const wompi = body.wompi;
    const openedWindow = wompi
      ? await openWompiWidget(wompi, customerData(), (transactionId) => {
          if (transactionId) {
            const back = new URL(wompi.redirectUrl);
            back.searchParams.set("id", transactionId);
            window.location.assign(back.toString());
          } else {
            setPaying(false);
            setNotice("Cerraste la ventana de pago sin terminar. Puedes intentarlo de nuevo cuando quieras.");
          }
        })
      : false;
    if (!openedWindow && body.checkoutUrl) window.location.assign(body.checkoutUrl);
  }

  // PayPal's buttons, in dollars: the same checks as «Pagar» before its
  // window opens, then the same registration and PayPal's order for it;
  // once the buyer approves, the capture on the server, which says where
  // to go next (/pago).
  function paypalClick(): boolean {
    explained.current = false;
    setError(null);
    setNotice(null);
    return ready();
  }

  async function paypalCreateOrder(): Promise<string> {
    const body = await register("USD");
    if (!body?.paypal) throw new Error("not registered"); // register said why
    const res = await fetch("/api/paypal/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: body.paypal.paymentId }),
    }).catch(() => null);
    const order = res?.ok ? await res.json().catch(() => null) : null;
    if (!order?.id) {
      fail("PayPal no respondió. Intenta de nuevo en un momento, o paga en pesos con Wompi.");
      throw new Error("no order");
    }
    return order.id as string;
  }

  async function paypalApprove(orderId: string, restart: () => Promise<void>) {
    setPaying(true);
    setNotice("Confirmando tu pago con PayPal…");
    const res = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.retry) {
      // A card PayPal declined: its window again, to pay another way.
      setPaying(false);
      setNotice("PayPal rechazó ese medio de pago. Elige otro para terminar.");
      return restart();
    }
    if (body?.redirect) {
      window.location.assign(body.redirect);
      return;
    }
    setPaying(false);
    setNotice(null);
    fail("No pudimos confirmar tu pago con PayPal. Si se te cobró, escríbenos y lo revisamos.");
  }

  const codeBox = (
    <div className="imp-co-code">
      {applied ? (
        <p className="imp-co-applied">
          <span>
            Código <b>{applied.code}</b> · {applied.label}
          </span>
          <button type="button" onClick={() => setApplied(null)}>
            Quitar
          </button>
        </p>
      ) : (
        <div className="imp-co-code-row">
          <input
            className="imp-co-in"
            placeholder="Código de descuento"
            aria-label="Código de descuento"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (code.trim()) void checkCode(code.trim(), qty, shown);
              }
            }}
          />
          <button type="button" onClick={() => void checkCode(code.trim(), qty, shown)} disabled={!code.trim() || checkingCode}>
            {checkingCode ? "…" : "Aplicar"}
          </button>
        </div>
      )}
      {codeError && <p className="imp-co-code-err">{codeError}</p>}
    </div>
  );

  // The event, how many (only when a purchase can take more than one) and a discount code.
  const summary = (
    <div className="imp-co-sum">
      <div className="imp-co-ev">
        <Tiara />
        <p className="imp-co-ev-name">
          {name.pre && <span>{name.pre}</span>}
          <b>{name.big}</b>
        </p>
        <p className="imp-co-ev-when">
          {dates}
          <br />
          {format}
        </p>
      </div>
      {ticket.max > 1 && (
        <div className="imp-co-line">
          <b>Cupos</b>
          <div className="imp-co-qty" aria-label="Cupos">
            <button type="button" onClick={() => changeQty(Math.max(Math.max(1, ticket.min), qty - 1))} disabled={qty <= Math.max(1, ticket.min)} aria-label="Un cupo menos">
              −
            </button>
            <span>{qty}</span>
            <button type="button" onClick={() => changeQty(Math.min(ticket.max, qty + 1))} disabled={qty >= ticket.max} aria-label="Un cupo más">
              +
            </button>
          </div>
        </div>
      )}
      {special && ticket.fullPrice !== null && (
        // A version's special price (2026-10-30): its name, with the full price struck beside it.
        <div className="imp-co-special">
          <p className="imp-co-line">
            <b>{special.label}</b>
            <span>
              <s>{money("COP", ticket.fullPrice * 100)}</s> {money("COP", ticket.price * 100)}
            </span>
          </p>
        </div>
      )}
      {codes && codeBox}
    </div>
  );

  const wompiBadges = (
    <span className="imp-co-badges">
      <span>Tarjeta</span>
      <span>PSE</span>
      <span>Nequi</span>
      <span>Bancolombia</span>
    </span>
  );
  const wompiNote = "Al tocar «Pagar» se abre la ventana segura de Wompi encima de esta página. Todas las transacciones son seguras y están encriptadas.";

  return (
    <div className="imp-co">
      <header className="imp-co-top">
        <a className="imp-co-back" href={backHref}>
          <span aria-hidden="true">←</span>
          <span className="imp-co-back-t">Volver</span>
        </a>
        <a className="imp-co-mark" href={backHref}>
          {name.pre && <span>{name.pre} </span>}
          <b>{name.big}</b>
        </a>
        <span className="imp-co-safe">
          <Lock />
          Pago seguro
        </span>
      </header>

      <div className="imp-co-grid">
        <div className="imp-co-main">
          <div className="imp-co-fold imp-co-dark">
            <button type="button" className="imp-co-fold-b" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((o) => !o)}>
              <span>
                {summaryOpen ? "Ocultar resumen" : "Ver resumen"} <Chevron open={summaryOpen} />
              </span>
              <span className="imp-co-fold-p">
                {normalCents !== null && applied?.currency !== shown && <s>{money(shown, normalCents * qty)}</s>}
                <b>{total}</b>
              </span>
            </button>
            {summaryOpen && <div className="imp-co-fold-in">{summary}</div>}
          </div>

          <Missing.Provider value={missing}>
            <form
              ref={formRef}
              className="imp-co-form"
              noValidate
              onSubmit={pay}
              onInput={(e) => {
                if (missing && (e.target as HTMLElement).closest(`[data-label="${missing}"]`)) setMissing(null);
              }}
            >
              <div className="imp-co-head">
                <h1 className="imp-co-h1">Reserva tu cupo</h1>
              </div>

              <section className="imp-co-sec">
                <h2 className="imp-co-h">
                  <i>1</i>Tus datos
                </h2>
                {/* Where they live first: it picks the document's types, the phone's code and the currency. */}
                <div className="imp-co-two">
                  <Field label="País donde vives">
                    <select className="imp-co-in" value={country} onChange={(e) => chooseCountry(e.target.value)}>
                      {WORLD_COUNTRIES.map((c) => (
                        <option key={c.iso2} value={c.iso2}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ciudad">
                    <input className="imp-co-in" autoComplete="address-level2" required {...field("city")} />
                  </Field>
                </div>
                <div className="imp-co-two">
                  <Field label="Nombre">
                    <input className="imp-co-in" autoComplete="given-name" required {...field("firstName")} />
                  </Field>
                  <Field label="Apellidos">
                    <input className="imp-co-in" autoComplete="family-name" required {...field("lastName")} />
                  </Field>
                </div>
                <div className="imp-co-doc">
                  <Field label="Documento">
                    <select className="imp-co-in" value={doc.value} onChange={(e) => setDocType(e.target.value)}>
                      {docs.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.short}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={doc.field}>
                    <input className="imp-co-in" inputMode={doc.value === "PAS" ? "text" : "numeric"} placeholder={idHint} required {...field("docNumber")} />
                  </Field>
                </div>
                {doc.company && (
                  <Field label="Razón social" hint="La factura sale a nombre de la empresa.">
                    <input className="imp-co-in" autoComplete="organization" required {...field("company")} />
                  </Field>
                )}
                <Field label="Correo electrónico">
                  <input className="imp-co-in" type="email" inputMode="email" autoComplete="email" required {...field("email")} onBlur={saveDraft} />
                </Field>
                <div className={`imp-co-field${missing === "Celular con WhatsApp" ? " is-missing" : ""}`} data-label="Celular con WhatsApp">
                  <span className="imp-co-lab">Celular con WhatsApp</span>
                  <div className="imp-co-phone">
                    <select className="imp-co-in" value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)} aria-label="Código del país">
                      {WORLD_COUNTRIES.map((c) => (
                        <option key={c.iso2} value={c.iso2}>
                          {COUNTRY_CODES.find((k) => k.iso2 === c.iso2)?.label ?? `${c.iso2} ${c.dialCode}`}
                        </option>
                      ))}
                    </select>
                    <input className="imp-co-in" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={phoneHint} required {...field("phone")} />
                  </div>
                  {missing === "Celular con WhatsApp" && <span className="imp-co-err">Falta tu celular.</span>}
                </div>
              </section>

              <section className="imp-co-sec">
                <h2 className="imp-co-h">
                  <i>2</i>Tu perfil
                </h2>
                <div className={`imp-co-opts${missing === "Tu perfil" ? " is-missing" : ""}`} role="radiogroup" aria-label="Tu perfil" data-label="Tu perfil">
                  <p className="imp-co-q">¿Cuál de estas opciones te describe mejor?</p>
                  {professions.map((p) => (
                    <label className="imp-co-opt" key={p}>
                      <input type="radio" name="profession" value={p} required checked={form.profession === p} onChange={() => setForm((f) => ({ ...f, profession: p }))} />
                      <span>{p}</span>
                    </label>
                  ))}
                  {missing === "Tu perfil" && <span className="imp-co-err">Elige la opción que más se parece a ti.</span>}
                </div>
              </section>

              <section className="imp-co-sec">
                <h2 className="imp-co-h">
                  <i>3</i>Pago
                </h2>
                {levels && choices.length > 0 && (
                  // «Tu entrada»: Imparable chosen; Círculo and Élite as what they add to it.
                  <div className="imp-co-tiers" role="radiogroup" aria-label={levels.title}>
                    <p className="imp-co-tiers-h">{levels.title}</p>
                    <p className="imp-co-tiers-i">{levels.intro}</p>
                    {choices.map((choice, i) => (
                      <label key={choice.slug} className={`imp-co-tier${choice.slug === chosen ? " is-on" : ""}`}>
                        <input type="radio" name="imp-tier" value={choice.slug} checked={choice.slug === chosen} onChange={() => choose(choice)} />
                        <span className="imp-co-tier-b">
                          {choice.tag && <span className="imp-co-tier-tag">{choice.tag}</span>}
                          <span className="imp-co-tier-top">
                            <b>{choice.name}</b>
                            <span>{choicePrice(choice, i)}</span>
                          </span>
                          <span className="imp-co-tier-s">
                            {choice.note && (
                              <>
                                <b>{choice.note.strong}</b>
                                {choice.note.rest && ` · ${choice.note.rest}`}
                                <br />
                              </>
                            )}
                            {choice.line}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {canPayUsd ? (
                  // Only the country's way to pay (2026-10-29): in pesos with
                  // Wompi from Colombia, in dollars with PayPal from anywhere
                  // else — and, small under it, the other one, for whoever
                  // needs it (a Colombian abroad, a card PayPal won't take).
                  <div className="imp-co-pays">
                    <div className="imp-co-pay imp-co-pay-opt imp-co-pay-one is-on">
                      <span className="imp-co-pay-h">
                        <span className="imp-co-dot" aria-hidden="true" />
                        <b>{usd ? "Dólares · PayPal" : "Pesos · Wompi"}</b>
                        <span className="imp-co-pay-amt">{money(shown, totalCents(shown))}</span>
                      </span>
                      {usd ? (
                        <>
                          <span className="imp-co-badges">
                            <span>Cuenta PayPal</span>
                            <span>Tarjeta</span>
                          </span>
                          <span className="imp-co-pay-p">
                            Paga con los botones de PayPal al final: se abre su ventana segura encima de esta página, con tu cuenta PayPal o con tarjeta.
                          </span>
                        </>
                      ) : (
                        <>
                          {wompiBadges}
                          <span className="imp-co-pay-p">{wompiNote}</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className="imp-co-switch"
                      onClick={() => {
                        currencyPicked.current = true;
                        changeCurrency(usd ? "COP" : "USD");
                      }}
                    >
                      {usd ? "Pagar en pesos con Wompi" : "Pagar en dólares con PayPal"}
                    </button>
                  </div>
                ) : (
                  <div className="imp-co-pay">
                    <div className="imp-co-pay-h">
                      <span className="imp-co-dot" aria-hidden="true" />
                      <b>Wompi</b>
                      {wompiBadges}
                    </div>
                    <p>{wompiNote}</p>
                  </div>
                )}
              </section>

              {/* On a phone the code comes again right before paying. */}
              {codes && <div className="imp-co-recap">{codeBox}</div>}

              {/* Honeypot: always empty from a person (see /api/register). */}
              <input className="imp-co-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" {...field("website")} />

              {error && (
                <p className="imp-co-note is-error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="imp-co-note" role="status">
                  {notice}
                </p>
              )}
              <div className="imp-co-end">
                {usd && paypal ? (
                  <PayPalButtons
                    clientId={paypal.clientId}
                    onClick={paypalClick}
                    createOrder={paypalCreateOrder}
                    onApprove={paypalApprove}
                    onCancel={() => setNotice("Cerraste PayPal sin terminar. Puedes intentarlo de nuevo cuando quieras.")}
                    onError={() => {
                      if (!explained.current) setError("PayPal tuvo un problema. Intenta de nuevo, o paga en pesos con Wompi.");
                    }}
                  />
                ) : (
                  <button type="submit" className="imp-co-btn" disabled={paying}>
                    <Lock />
                    {paying ? "Abriendo el pago…" : `Pagar ${total}`}
                  </button>
                )}
                <p className="imp-co-legal">
                  {usd ? "Al pagar con PayPal" : "Al tocar «Pagar»"} aceptas nuestros{" "}
                  <a href="/terminos" target="_blank" rel="noreferrer">
                    términos y condiciones
                  </a>{" "}
                  y nuestra{" "}
                  <a href="/privacidad" target="_blank" rel="noreferrer">
                    política de privacidad
                  </a>
                  ; autorizas el tratamiento de tus datos para enviarte tu entrada y la información operativa de este evento (incluyendo por WhatsApp al número que
                  registraste); y autorizas recibir novedades de futuros eventos de Nail Fest y que te mostremos publicidad relevante en Meta con tus datos (de forma
                  cifrada).
                </p>
              </div>
            </form>
          </Missing.Provider>
        </div>

        <aside className="imp-co-side imp-co-dark">
          <div className="imp-co-side-in">{summary}</div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const missing = useContext(Missing) === label;
  return (
    <label className={`imp-co-field${missing ? " is-missing" : ""}`} data-label={label}>
      <span className="imp-co-lab">{label}</span>
      {children}
      {missing ? <span className="imp-co-err">Falta este dato.</span> : hint && <span className="imp-co-hint">{hint}</span>}
    </label>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s ease" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
