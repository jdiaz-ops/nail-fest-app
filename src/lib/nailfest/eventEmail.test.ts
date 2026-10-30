import { describe, expect, it } from "vitest";
import { designedSections, leadingEmoji, nailFestEventEmail, paragraphLines, topBlocks, type NailFestEventEmailFrame } from "./eventEmail";

// Tomorrow's email for Nail Fest Cúcuta, as the editor stores it (2026-10-30).
const BODY = [
  `<figure class="tiptap-image" data-align="none"><img src="https://blob.example/banner.jpg" alt="" style="max-width:100%;height:auto;border-radius:8px;"></figure>`,
  `<p>⏳ ¡La cuenta regresiva ha comenzado! En solo <strong>1 semana</strong>, Nail Fest Cúcuta abrirá sus puertas.</p>`,
  `<p>Prepárate para disfrutar de:</p>`,
  `<p>🛍️ Más de 25 marcas expositoras con productos, novedades y promociones especiales.</p>`,
  `<p>📍 <strong>Lugar:</strong> Hotel Casino Internacional — Cl 11 # 2E-75 - Los Caobos - Cúcuta</p>`,
  `<p>⚠️ <strong>IMPORTANTE:</strong></p>`,
  `<p>Para ingresar <strong>GRATIS</strong> debes presentar tu <strong>boleta de ingreso</strong>.</p>`,
  `<p>—</p>`,
  `<p><strong>Equipo Nail Fest</strong></p>`,
  `<hr>`,
  `<p><strong>Resolvemos tus dudas:</strong></p>`,
  `<p>✅ <strong>No necesitas llevar materiales.</strong></p>`,
  `<p>Es una feria comercial y todas las demostraciones son gratuitas.</p>`,
  `<p>✅ <strong>Parqueadero disponible.</strong><br>Sí (con costo).</p>`,
  `<p>Somos comunidad, gracias por ayudarnos. 💜<br><br>✅ <strong>Niños pueden ingresar sin boleta.</strong><br>Pero habrá mucho público.</p>`,
  `<p><a href="https://nailfest.lat/cucuta?utm_source=email" target="_blank" rel="noopener noreferrer">Ver el cronograma</a></p>`,
].join("");

const FRAME: NailFestEventEmailFrame = {
  eventName: "Nail Fest Cúcuta",
  heading: { name: "Nail Fest Cúcuta", days: "7 y 8", month: "de noviembre", detail: "Sábado y domingo · 2026" },
  venue: "Hotel Casino Internacional",
  share: { url: "https://wa.me/?text=hola", free: true },
  helpUrl: "https://wa.me/573001234567",
  instagram: { handle: "@nailfest_co", url: "https://www.instagram.com/nailfest_co" },
  logo: "https://nailfest.lat/logo.png",
  asistireImage: "https://nailfest.lat/nailfest/asistire-muestra.jpg",
  site: { url: "https://nailfest.lat", host: "nailfest.lat" },
};
const BANNER = "https://blob.example/banner.jpg";
const mail = { subject: "¡Falta 1 semana!", bodyHtml: BODY, band: "Falta 1 semana", asistire: "https://nailfest.lat/asistire/r1.sig", colega: true, banner: BANNER };

describe("the body's blocks", () => {
  it("are its top-level elements, nested ones inside", () => {
    const blocks = topBlocks(`<p>uno <strong>dos</strong></p><hr><ul><li><p>tres</p></li></ul>suelto`);
    expect(blocks.map((b) => b.tag)).toEqual(["p", "hr", "ul", "p"]);
    expect(blocks[3]!.inner).toBe("suelto");
  });

  it("a line's leading emoji, even inside its bold", () => {
    expect(leadingEmoji("⚠️ <strong>IMPORTANTE:</strong>")).toEqual({ emoji: "⚠️", rest: "<strong>IMPORTANTE:</strong>" });
    expect(leadingEmoji("<strong>✅ Listo</strong>")).toEqual({ emoji: "✅", rest: "<strong>Listo</strong>" });
    expect(leadingEmoji("1 semana")).toBeNull();
    expect(leadingEmoji("¡Hola!")).toBeNull();
  });

  it("a paragraph's lines (Shift+Enter) as the paragraphs they are, each with its own tags closed", () => {
    expect(paragraphLines("Somos comunidad. 💜<br><br>✅ <strong>Niños</strong><br>Pero")).toEqual(["Somos comunidad. 💜", "✅ <strong>Niños</strong><br>Pero"]);
    expect(paragraphLines("—<br><strong>Equipo Nail Fest</strong>")).toEqual(["—", "<strong>Equipo Nail Fest</strong>"]);
    expect(paragraphLines("<strong>uno<br>✅ dos</strong>")).toEqual(["<strong>uno</strong>", "<strong>✅ dos</strong>"]);
  });
});

describe("the body, ordered", () => {
  const sections = designedSections(BODY, BANNER);

  it("two cards: the message, and what comes after the line, titled by its first line", () => {
    expect(sections).toHaveLength(2);
    expect(sections[0]!.title).toBeNull();
    expect(sections[1]!.title).toBe("Resolvemos tus dudas");
  });

  it("emoji lines as rows, a short line ending in «:» as a subtitle, the warning in a box with the line under it", () => {
    const main = sections[0]!.parts.join("");
    expect(main).toContain(">🛍️</td>");
    expect(main).toMatch(/color:#0f7d75;[^"]*">Prepárate para disfrutar de:<\/div>/);
    expect(main).not.toContain("text-transform:uppercase");
    expect(main).toMatch(/background:#fff1ea[^"]*"><tr><td[^>]*><table[\s\S]*⚠️[\s\S]*Para ingresar/);
    expect(main).not.toContain("banner.jpg");
  });

  it("keeps an image it opens with that isn't the banner", () => {
    expect(designedSections(BODY, null)[0]!.parts.join("")).toContain('src="https://blob.example/banner.jpg"');
  });

  it("answers line up with their question, lines in one paragraph apart; a lone link is a button", () => {
    const faq = sections[1]!.parts.join("");
    expect(faq).toMatch(/&nbsp;<\/td><td[^>]*>Es una feria comercial/);
    expect(faq).toMatch(/>✅<\/td><td[^>]*><strong[^>]*>Niños pueden ingresar sin boleta\.<\/strong><br>Pero habrá mucho público\./);
    expect(faq).toContain("border-top:1px solid #b7e8e3");
    expect(faq).toMatch(/<a href="https:\/\/nailfest\.lat\/cucuta\?utm_source=email"[^>]*>Ver el cronograma<\/a>/);
  });
});

describe("the email", () => {
  it("in the event's frame, with its band, her «Asistiré», a colleague and the footer — no note on the PDF", () => {
    const { subject, html, text } = nailFestEventEmail(FRAME, mail);
    expect(subject).toBe("¡Falta 1 semana!");
    expect(html).toContain(">Nail Fest Cúcuta</div>");
    expect(html).toContain(">7 y 8</div>");
    expect(html).toContain(">de noviembre</div>");
    expect(html).toContain(">Sábado y domingo&nbsp;·&nbsp;2026</div>");
    expect(html).toContain("Falta 1 semana</td>");
    expect(html).not.toContain("Tu entrada va adjunta");
    expect(html).toContain("Escríbenos por WhatsApp");
    expect(html).toContain('href="https://nailfest.lat/asistire/r1.sig"');
    expect(html).toContain("¿Vas con una colega?");
    expect(html).toContain('href="https://wa.me/?text=hola"');
    expect(text).not.toContain("Tu entrada va adjunta");
  });

  it("its message, her «Asistiré» and the colleague, then its doubts", () => {
    const { html } = nailFestEventEmail(FRAME, mail);
    const at = (s: string) => html.indexOf(s);
    expect(at("Equipo Nail Fest")).toBeLessThan(at("¡Cuéntale a todos que vas!"));
    expect(at("¡Cuéntale a todos que vas!")).toBeLessThan(at("¿Vas con una colega?"));
    expect(at("¿Vas con una colega?")).toBeLessThan(at("Resolvemos tus dudas"));
    expect(at("Ver el cronograma")).toBeLessThan(at("Síguenos en"));
  });

  it("the band as it's written, the page's faces, its name and days as images when there are", () => {
    const { html } = nailFestEventEmail(FRAME, mail);
    expect(html).not.toContain("text-transform");
    expect(html).toMatch(/letter-spacing:0\.02em;[^"]*">Falta 1 semana<\/td>/);
    expect(html).toContain("family=Fraunces");
    expect(html).not.toContain("Quicksand");
    // Without Fraunces (Gmail), titles fall to a bold sans, never a newspaper serif.
    expect(html).not.toMatch(/[^-]serif/);
    const nameImage = { url: "https://nailfest.lat/api/correo/titulo?k=nombre&t=Nail%20Fest%20C%C3%BAcuta&s=abc", width: 252, height: 46 };
    const daysImage = { url: "https://nailfest.lat/api/correo/titulo?k=dias&t=7%20y%208&s=def", width: 139, height: 66 };
    const lettered = nailFestEventEmail({ ...FRAME, heading: { ...FRAME.heading, nameImage, daysImage } }, mail).html;
    expect(lettered).toContain('<img src="https://nailfest.lat/api/correo/titulo?k=nombre&amp;t=Nail%20Fest%20C%C3%BAcuta&amp;s=abc" width="252" height="46" alt="Nail Fest Cúcuta"');
    expect(lettered).toContain('width="139" height="66" alt="7 y 8"');
    expect(lettered).not.toContain(">Nail Fest Cúcuta</div>");
    expect(lettered).toContain(">de noviembre</div>");
  });

  it("her tickets where it says «{{BOLETA}}», in words in its text; nothing there without them", () => {
    const tickets = {
      list: [{ qrImageUrl: "https://nailfest.lat/api/ticket-qr/tok", holder: "Laura Gómez", label: "General", code: "ABCD1234" }],
      people: 1,
      pdfAttached: false,
    };
    const body = "<p>(Tu boleta)</p><p>{{BOLETA}}</p><p>📣 Estamos a solo horas de abrir las puertas.</p>";
    const { html, text } = nailFestEventEmail(FRAME, { ...mail, bodyHtml: body, tickets });
    expect(html).toContain('src="https://nailfest.lat/api/ticket-qr/tok"');
    // (the first «Estamos…» is the preheader's)
    expect(html.indexOf("Código QR de tu entrada")).toBeLessThan(html.lastIndexOf("Estamos a solo horas"));
    expect(html).not.toContain("{{BOLETA}}");
    expect(text).toContain("Código: ABCD1234");
    expect(text).not.toContain("{{BOLETA}}");
    const none = nailFestEventEmail(FRAME, { ...mail, bodyHtml: body, tickets: null });
    expect(none.html).not.toContain("Código QR de tu entrada");
    expect(none.html).not.toContain("{{BOLETA}}");
  });

  it("nothing Gmail drops: no positioning, no negative margins", () => {
    const { html } = nailFestEventEmail(FRAME, mail);
    expect(html).not.toMatch(/position\s*:/);
    expect(html).not.toMatch(/margin:[^;"]*-\d/);
  });

  it("no band when there's none, nor the modules the email leaves out", () => {
    const { html, text } = nailFestEventEmail({ ...FRAME, helpUrl: null }, { ...mail, bodyHtml: "<p>Hola</p>", band: " ", asistire: null, colega: false });
    expect(html).not.toContain("¿Vas con una colega?");
    expect(text).not.toContain("COLEGA");
    expect(html).not.toContain("letter-spacing:0.02em;line-height:1.35;");
    expect(html).not.toContain("Escríbenos por WhatsApp");
    expect(html).not.toContain("Crear mi imagen");
  });
});
