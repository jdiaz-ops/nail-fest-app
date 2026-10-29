"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { COUNTRY_CODES, GENERIC_ID_PLACEHOLDER, GENERIC_PHONE_PLACEHOLDER, stripTrunkZero } from "@/lib/countryCodes";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";
import { attributionFromSearchParams } from "@/lib/utm";
import { pesos } from "@/lib/imparables/stages";
import type { WompiWidgetParams } from "@/lib/payments/wompi";
import { getValidFbc, track } from "@/components/tracking";
import { openWompiWidget } from "@/components/wompiWidget";
import { Tiara } from "./ImpArt";

// Manicuristas Imparables' one-page checkout (2026-10-29), after
// Marcolini's. On the left, numbered: contact, details, profile, payment; on
// the right (on a phone, folded on top of the form) what's being bought —
// the ticket, how many, a discount code, the total, until when today's price
// holds. Paying registers the person through /api/register (pending payment,
// with the discount worked out there again) and opens Wompi's own window
// over the page with what it signed; if that window doesn't load, Wompi's
// page instead. Wompi sends the buyer on to /[eventSlug]/pago, which
// confirms. Free events keep their usual form.

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
};

// The field paying found empty, to say so right under it.
const Missing = createContext<string | null>(null);

export interface ImpCheckoutProps {
  eventSlug: string;
  backHref: string;
  name: { pre: string; big: string };
  /** "27 y 28 de junio de 2027" */
  dates: string;
  /** "Congreso virtual · 100% en vivo" */
  format: string;
  ticket: { id: string; name: string; price: number; normalPrice: number | null; min: number; max: number };
  /** Until when today's price holds ("31 marzo 2027"), when a higher one comes after it. */
  until: string | null;
  professions: string[];
  /** The first few things the ticket includes («Qué incluye»). */
  includes: string[];
}

interface Applied {
  code: string;
  label: string;
  discountCents: number;
}

export default function ImpCheckout({ eventSlug, backHref, name, dates, format, ticket, until, professions, includes }: ImpCheckoutProps) {
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", docNumber: "", company: "", city: "", phone: "", profession: "", website: "" });
  const [qty, setQty] = useState(Math.max(1, ticket.min));
  const [country, setCountry] = useState("CO");
  const [phoneCountry, setPhoneCountry] = useState("CO");
  const [docType, setDocType] = useState("CC");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const opened = useRef(false);

  // Opening the checkout: the same counts the modal used to keep — Meta's
  // InitiateCheckout, Clarity's funnel, and our own (/api/funnel/open).
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    window.clarity?.("event", "abrir_registro");
    track("InitiateCheckout");
    fetch("/api/funnel/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventSlug }), keepalive: true }).catch(() => {});
  }, [eventSlug]);

  const docs = country === "CO" ? DOCS_CO : DOCS_ABROAD;
  const doc = docs.find((d) => d.value === docType) ?? docs[0]!;
  const idHint = country === "CO" ? undefined : (COUNTRY_CODES.find((c) => c.iso2 === country)?.idPlaceholder ?? GENERIC_ID_PLACEHOLDER);
  const phoneHint = COUNTRY_CODES.find((c) => c.iso2 === phoneCountry)?.phonePlaceholder ?? GENERIC_PHONE_PLACEHOLDER;

  const subtotal = ticket.price * qty;
  const discount = applied ? applied.discountCents / 100 : 0;
  const total = subtotal - discount;

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
  }

  // A code's discount depends on how many: asked again whenever that changes.
  async function checkCode(typed: string, count: number) {
    setCheckingCode(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/checkout/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, ticketTypeId: ticket.id, ticketCount: count, code: typed }),
      });
      const body = await res.json();
      if (body?.ok) {
        setApplied({ code: body.code, label: body.label, discountCents: body.discountCents });
        setCode("");
      } else {
        setApplied(null);
        setCodeError(body?.message ?? "Ese código no aplica.");
      }
    } catch {
      setCodeError("No pudimos revisar el código, intenta de nuevo.");
    } finally {
      setCheckingCode(false);
    }
  }

  function changeQty(next: number) {
    setQty(next);
    if (applied) void checkCode(applied.code, next);
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

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (paying) return;
    setError(null);
    setNotice(null);
    const firstInvalid = e.currentTarget.querySelector<HTMLElement>(":invalid");
    if (firstInvalid) {
      setMissing(firstInvalid.closest("[data-label]")?.getAttribute("data-label") ?? null);
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus({ preventScroll: true });
      return;
    }
    setMissing(null);
    setPaying(true);

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
          discountCode: applied?.code,
          website: form.website,
        }),
      });
    } catch {
      setPaying(false);
      setError("No pudimos completar tu registro, intenta de nuevo.");
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPaying(false);
      if (body?.error === "discount_invalid") {
        setApplied(null);
        setError(`${body.message ?? "Ese código ya no aplica."} Revisa el total antes de pagar.`);
      } else {
        setError(REGISTER_ERRORS[body?.error] ?? "Algo salió mal, intenta de nuevo.");
      }
      return;
    }
    if (!body?.requiresPayment) {
      // Already paid before (a resend): nothing to charge.
      setPaying(false);
      setNotice("Ya tienes tu cupo confirmado. Te reenviamos la confirmación a tu correo.");
      return;
    }

    const wompi = body.wompi as WompiWidgetParams | undefined;
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
    if (!openedWindow) window.location.assign(body.checkoutUrl);
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
                if (code.trim()) void checkCode(code.trim(), qty);
              }
            }}
          />
          <button type="button" onClick={() => void checkCode(code.trim(), qty)} disabled={!code.trim() || checkingCode}>
            {checkingCode ? "…" : "Aplicar"}
          </button>
        </div>
      )}
      {codeError && <p className="imp-co-code-err">{codeError}</p>}
    </div>
  );

  const totals = (
    <dl className="imp-co-tot">
      <div>
        <dt>
          {ticket.name} × {qty}
        </dt>
        <dd>{pesos(subtotal)}</dd>
      </div>
      {applied && (
        <div className="imp-co-disc">
          <dt>Descuento {applied.code}</dt>
          <dd>−{pesos(discount)}</dd>
        </div>
      )}
      <div className="imp-co-total">
        <dt>Total</dt>
        <dd>
          {pesos(total)} <small>COP</small>
        </dd>
      </div>
    </dl>
  );

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
      <div className="imp-co-line">
        <div>
          <b>{ticket.name}</b>
          <span>
            {ticket.normalPrice && <s>{pesos(ticket.normalPrice)}</s>} {pesos(ticket.price)} por cupo
          </span>
        </div>
        {ticket.max > 1 && (
          <div className="imp-co-qty" aria-label="Cupos">
            <button type="button" onClick={() => changeQty(Math.max(Math.max(1, ticket.min), qty - 1))} disabled={qty <= Math.max(1, ticket.min)} aria-label="Un cupo menos">
              −
            </button>
            <span>{qty}</span>
            <button type="button" onClick={() => changeQty(Math.min(ticket.max, qty + 1))} disabled={qty >= ticket.max} aria-label="Un cupo más">
              +
            </button>
          </div>
        )}
      </div>
      {includes.length > 0 && (
        <ul className="imp-co-inc">
          {includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {codeBox}
      {totals}
      {until && (
        <p className="imp-co-up">
          Tarifa {ticket.name} hasta el {until}. ¡Luego sube!
        </p>
      )}
    </div>
  );

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
                {ticket.normalPrice && !applied && <s>{pesos(ticket.normalPrice * qty)}</s>}
                <b>{pesos(total)}</b>
              </span>
            </button>
            {summaryOpen && <div className="imp-co-fold-in">{summary}</div>}
          </div>

          <Missing.Provider value={missing}>
            <form
              className="imp-co-form"
              noValidate
              onSubmit={pay}
              onInput={(e) => {
                if (missing && (e.target as HTMLElement).closest(`[data-label="${missing}"]`)) setMissing(null);
              }}
            >
              <div className="imp-co-head">
                <h1 className="imp-co-h1">Reserva tu cupo</h1>
                <p>Tus datos y el pago, en un solo paso.</p>
              </div>

              <section className="imp-co-sec">
                <h2 className="imp-co-h">
                  <i>1</i>Contacto
                </h2>
                <Field label="Correo electrónico" hint="Ahí te llega tu entrada.">
                  <input className="imp-co-in" type="email" inputMode="email" autoComplete="email" required {...field("email")} onBlur={saveDraft} />
                </Field>
              </section>

              <section className="imp-co-sec">
                <h2 className="imp-co-h">
                  <i>2</i>Tus datos
                </h2>
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
                  <i>3</i>Tu perfil
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
                  <i>4</i>Pago
                </h2>
                <div className="imp-co-pay">
                  <div className="imp-co-pay-h">
                    <span className="imp-co-dot" aria-hidden="true" />
                    <b>Wompi</b>
                    <span className="imp-co-badges">
                      <span>Tarjeta</span>
                      <span>PSE</span>
                      <span>Nequi</span>
                      <span>Bancolombia</span>
                    </span>
                  </div>
                  <p>Al tocar «Pagar» se abre la ventana segura de Wompi encima de esta página. Todas las transacciones son seguras y están encriptadas.</p>
                </div>
              </section>

              {/* On a phone the total comes again right before paying, with the code. */}
              <div className="imp-co-recap">
                {codeBox}
                {totals}
              </div>

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
              <button type="submit" className="imp-co-btn" disabled={paying}>
                <Lock />
                {paying ? "Abriendo el pago…" : `Pagar ${pesos(total)}`}
              </button>
              <p className="imp-co-legal">
                Al tocar «Pagar» aceptas nuestros{" "}
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
