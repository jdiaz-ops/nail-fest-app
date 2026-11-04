import { button, C, emailDocument, esc, eyebrow, sans, serif, stars } from "./emailFrame";

// Manicuristas Imparables' closing email (the team, 2026-11-04: «al terminar tenemos que enviar un correo con la página
// de acceso a las grabaciones + descargar el diploma virtual + pedir reseña»): after the congress, in its design — thank
// you; her recordings page, until the day they close; her diploma, to download; and her review, with five stars that
// open it already rated. Each link is hers. At its top, under the gold band, «Organiza Nail Fest» and the brands that
// support it (the team, 2026-11-04). Previewed and tested from «Después del pago» → «Correo de cierre»; nothing sends
// it to buyers yet.

export interface ImparablesClosing {
  /** «Laura», or «». */
  firstName: string;
  /** «Manicuristas Imparables» */
  eventName: string;
  /** «Domingo 4 de julio de 2027» */
  date: string;
  /** Her recordings page, and the last day it shows them: «martes 3 de agosto». */
  recordings: { url: string; until: string };
  /** Her diploma, to download. */
  diploma: { url: string } | null;
  /** Her review page. */
  review: { url: string } | null;
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  /** The brands under «Con el apoyo de», at most four: their logos' full addresses, and their names. */
  sponsors: { name: string; url: string }[];
  images: { header: string; logo: string };
  site: { url: string; host: string };
}

/** «Marca uno, Marca dos y Marca tres» */
function listed(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : (names[0] ?? "");
}

export function closingSubject(eventName: string): string {
  return `Tus grabaciones y tu diploma de ${eventName}`;
}

export function imparablesClosingEmail(c: ImparablesClosing): { subject: string; html: string; text: string } {
  const hello = c.firstName ? `¡Gracias, ${c.firstName}!` : "¡Gracias por estar!";
  const subject = closingSubject(c.eventName);
  const section = (inner: string, style = "") => `<tr><td class="px" align="center" style="padding:28px 32px 30px;${style}">${inner}</td></tr>`;
  const title = (text: string, color: string = C.INK) => `<div style="${serif(21, 800, color, "line-height:1.25;")}">${esc(text)}</div>`;
  const line = (text: string, color: string = C.WARM) => `<div style="margin:10px auto 18px;max-width:420px;${sans(15, 400, color, "line-height:1.55;")}">${text}</div>`;

  // «ORGANIZA» and Nail Fest's logo; under them, a thin line, «CON EL APOYO DE» and the brands' logos in a row, each
  // one fitted to 110 × 30 (the cover's «Organiza» and «Con el apoyo de»).
  const brands = c.sponsors.filter((sponsor) => sponsor.url).slice(0, 4);
  const organiza = `<tr><td class="px" align="center" style="padding:26px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>
<td style="${sans(11.5, 800, C.WARM, "letter-spacing:0.16em;")}">ORGANIZA</td>
<td style="padding-left:12px;"><img src="${esc(c.images.logo)}" width="44" height="35" alt="Nail Fest" style="display:block;border:0;width:44px;height:35px;"></td>
</tr></table>${
    brands.length
      ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 0;width:100%;max-width:320px;"><tr><td style="border-top:1px solid ${C.LINE};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>
<div style="margin-top:12px;${sans(10.5, 700, C.SOFT, "letter-spacing:0.16em;")}">CON EL APOYO DE</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:10px auto 0;"><tr>${brands
          .map(
            (brand) =>
              `<td align="center" valign="middle" style="padding:6px 10px;"><img src="${esc(brand.url)}" width="110" alt="${esc(brand.name)}" style="display:block;border:0;width:auto;height:auto;max-width:110px;max-height:30px;"></td>`
          )
          .join("")}</tr></table>`
      : ""
  }
</td></tr>`;

  const rows = [
    organiza,
    `<tr><td class="px" style="padding:24px 32px 6px;">
<div style="${serif(30)}">${esc(hello)}</div>
<div style="margin-top:12px;${sans(16, 400, C.WARM, "line-height:1.6;")}">Gracias por ser parte de <b style="color:${C.INK};">${esc(c.eventName)}</b>. Lo que viviste el domingo no se queda ahí: aquí tienes todo para seguir.</div>
</td></tr>`,
    section(
      `${eyebrow("Las grabaciones")}
<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
${title("Vuelve a ver cada charla")}
${line(`La grabación de cada charla, para verla las veces que quieras hasta el <b style="color:${C.INK};">${esc(c.recordings.until)}</b>.`)}
${button(c.recordings.url, "Ver las grabaciones")}`
    ),
    ...(c.diploma
      ? [
          section(
            `${eyebrow("Tu diploma")}
<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
${title("Tu diploma, con tu nombre")}
${line("Tu diploma digital de participación. Descárgalo, imprímelo o compártelo.")}
${button(c.diploma.url, "Descargar mi diploma")}`,
            `background:${C.CARD};border-top:1px solid ${C.LINE};`
          ),
        ]
      : []),
    ...(c.review
      ? [
          section(
            `${title("¿Cómo te fue?", C.CREAM)}
${line("Tu opinión nos ayuda a que la próxima edición sea aún mejor. Toca las estrellas y cuéntanos: te toma un minuto.", C.CREAM_SOFT)}
<div style="margin:0 0 18px;">${stars(c.review.url)}</div>
${button(c.review.url, "Dejar mi reseña")}`,
            `background:${C.CHOCOLATE};`
          ),
        ]
      : []),
    ...(c.helpUrl
      ? [
          `<tr><td class="px" align="center" style="padding:22px 32px 6px;${sans(14.5, 400, C.WARM)}">¿Dudas? <a href="${esc(c.helpUrl)}" style="font-weight:800;color:${C.BRONZE_DEEP};">Escríbenos por WhatsApp</a></td></tr>`,
        ]
      : []),
  ];

  const html = emailDocument({
    title: subject,
    preheader: "Las grabaciones de cada charla, tu diploma y una pregunta: ¿cómo te fue?",
    header: { image: c.images.header, alt: c.eventName, line: c.date },
    band: "GRACIAS POR SER IMPARABLE",
    rows,
    footer: { logo: c.images.logo, siteUrl: c.site.url, host: c.site.host, why: `Recibes este correo porque compraste tu entrada a ${c.eventName}.` },
  });

  const named = brands.map((brand) => brand.name.trim()).filter(Boolean);
  const text = [
    hello,
    `Gracias por ser parte de ${c.eventName}. Lo que viviste el domingo no se queda ahí: aquí tienes todo para seguir.`,
    `LAS GRABACIONES\nLa grabación de cada charla, para verla las veces que quieras hasta el ${c.recordings.until}: ${c.recordings.url}`,
    ...(c.diploma ? [`TU DIPLOMA\nTu diploma digital de participación, con tu nombre: ${c.diploma.url}`] : []),
    ...(c.review ? [`¿CÓMO TE FUE?\nTu opinión nos ayuda a que la próxima edición sea aún mejor. Déjanos tu reseña: ${c.review.url}`] : []),
    ...(c.helpUrl ? [`¿Dudas? Escríbenos por WhatsApp: ${c.helpUrl}`] : []),
    `Organiza Nail Fest · ${c.site.host}${named.length ? `\nCon el apoyo de ${listed(named)}` : ""}\nRecibes este correo porque compraste tu entrada a ${c.eventName}.`,
  ].join("\n\n");

  return { subject, html, text };
}
