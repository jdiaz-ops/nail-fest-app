import { describe, expect, it } from "vitest";
import { designedSections, leadingEmoji, nailFestEventEmail, topBlocks, type NailFestEventEmailFrame } from "./eventEmail";

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
  `<p><a href="https://nailfest.lat/cucuta?utm_source=email" target="_blank" rel="noopener noreferrer">Ver el cronograma</a></p>`,
].join("");

const FRAME: NailFestEventEmailFrame = {
  eventName: "Nail Fest Cúcuta",
  city: "Cúcuta",
  dates: "Sábado 7 y domingo 8 de noviembre",
  venue: "Hotel Casino Internacional",
  helpUrl: "https://wa.me/573001234567",
  instagram: { handle: "@nailfest_co", url: "https://www.instagram.com/nailfest_co" },
  logo: "https://nailfest.lat/logo.png",
  site: { url: "https://nailfest.lat", host: "nailfest.lat" },
};

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
});

describe("the body, ordered", () => {
  const sections = designedSections(BODY);

  it("two cards: the message, and what comes after the line, titled by its first line", () => {
    expect(sections).toHaveLength(2);
    expect(sections[0]!.title).toBeNull();
    expect(sections[1]!.title).toBe("Resolvemos tus dudas");
  });

  it("emoji lines as rows, a short line ending in «:» as a subtitle, the warning in a box with the line under it", () => {
    const main = sections[0]!.parts.join("");
    expect(main).toContain(">🛍️</td>");
    expect(main).toMatch(/text-transform:uppercase;">Prepárate para disfrutar de<\/div>/);
    expect(main).toMatch(/background:#fff1ea[^"]*"><tr><td[^>]*><table[\s\S]*⚠️[\s\S]*Para ingresar/);
    expect(main).toContain('src="https://blob.example/banner.jpg"');
    expect(main).toContain("border-radius:14px");
  });

  it("answers line up with their question; a lone link is a button", () => {
    const faq = sections[1]!.parts.join("");
    expect(faq).toMatch(/margin:-4px 0 12px 30px;[^"]*">Es una feria comercial/);
    expect(faq).toContain("border-top:1px solid #b7e8e3");
    expect(faq).toMatch(/<a href="https:\/\/nailfest\.lat\/cucuta\?utm_source=email"[^>]*>Ver el cronograma<\/a>/);
  });
});

describe("the email", () => {
  it("in the event's frame, with its band, the PDF's note and the footer", () => {
    const { subject, html, text } = nailFestEventEmail(FRAME, { subject: "¡Falta 1 semana!", bodyHtml: BODY, band: "Falta 1 semana", pdfAttached: true });
    expect(subject).toBe("¡Falta 1 semana!");
    expect(html).toContain(">Cúcuta</div>");
    expect(html).toContain("Sábado 7 y domingo 8 de noviembre");
    expect(html).toContain("Falta 1 semana</td>");
    expect(html).toContain("Tu entrada va adjunta");
    expect(html).toContain("Escríbenos por WhatsApp");
    expect(text).toContain("Tu entrada va adjunta en PDF");
  });

  it("no band nor PDF note when there's none", () => {
    const { html } = nailFestEventEmail({ ...FRAME, helpUrl: null }, { subject: "Hola", bodyHtml: "<p>Hola</p>", band: " ", pdfAttached: false });
    expect(html).not.toContain("letter-spacing:0.16em;text-transform:uppercase;\">");
    expect(html).not.toContain("Tu entrada va adjunta");
    expect(html).not.toContain("Escríbenos por WhatsApp");
  });
});
