import { describe, expect, it } from "vitest";
import { imparablesBody, imparablesEventEmail, type ImparablesEventEmailFrame } from "./eventEmail";

const file = (name: string, n: number) => ({ name, file: `https://nailfest.lat/imparables/kit/${n}.jpg`, mini: `https://nailfest.lat/imparables/kit/mini/${n}.jpg` });
const frame: ImparablesEventEmailFrame = {
  eventName: "Manicuristas Imparables",
  cover: { date: "4 de julio 2027", note: "Congreso virtual en vivo" },
  share: { line: "Hoy está a $90.000 y luego sube a $120.000: compartirle esto es un buen regalo.", url: "https://wa.me/?text=hola" },
  helpUrl: "https://wa.me/573001234567",
  images: { header: "https://nailfest.lat/imparables/correo-cabecera.png", logo: "https://nailfest.lat/logo.png", asistire: "https://nailfest.lat/imparables/asistire-muestra-4-julio.jpg" },
  kit: { wallpapers: [file("Imparable", 1), file("Cobro", 2), file("Agenda", 3)] },
  site: { url: "https://nailfest.lat", host: "nailfest.lat" },
};
const mail = {
  subject: "Faltan 7 días",
  bodyHtml: "<h1>Laura, ya casi es domingo</h1><p>Nos vemos en vivo.</p>",
  band: "Faltan 7 días",
  asistire: "https://nailfest.lat/asistire/reg_1.firma",
  kit: { pageUrl: "https://nailfest.lat/asistire/reg_1.firma/kit" },
  colega: true,
  banner: null,
};

describe("Manicuristas Imparables' design for its event's emails", () => {
  it("frames the email as the team wrote it: the cover with the day, the gold band, its text, the footer", () => {
    const { subject, html, text } = imparablesEventEmail(frame, mail);
    expect(subject).toBe("Faltan 7 días");
    // Under the mark: the pillars, the day and what it is (the team, 2026-11-04).
    expect(html).toContain("MENTALIDAD · DINERO · MARKETING");
    expect(html).toContain("4 de julio 2027");
    expect(html).toContain("Congreso virtual en vivo");
    expect(html.indexOf("MENTALIDAD · DINERO · MARKETING")).toBeLessThan(html.indexOf("4 de julio 2027"));
    expect(html).not.toContain("En vivo por Zoom");
    expect(html).toContain("FALTAN 7 DÍAS");
    expect(html).toContain("Laura, ya casi es domingo");
    expect(html).toContain("Nos vemos en vivo.");
    expect(html).toContain("Recibes este correo porque compraste tu entrada a Manicuristas Imparables.");
    expect(text).toContain("Nos vemos en vivo.");
  });

  it("adds the blocks it switches on, in order: «Asistiré», the kit, the colleague — each with her links", () => {
    const { html, text } = imparablesEventEmail(frame, mail);
    const at = (s: string) => html.indexOf(s);
    expect(at("¡Cuéntale a todos que vas!")).toBeGreaterThan(at("Nos vemos en vivo."));
    expect(at("Tu kit Imparable")).toBeGreaterThan(at("¡Cuéntale a todos que vas!"));
    expect(at("¿Conoces a una colega que lo necesita?")).toBeGreaterThan(at("Tu kit Imparable"));
    expect(html).toContain('href="https://nailfest.lat/asistire/reg_1.firma"');
    expect(html).not.toContain("Hacer mi foto de perfil");
    expect(html).toContain('href="https://nailfest.lat/asistire/reg_1.firma/kit"');
    for (let n = 1; n <= 3; n++) expect(html).toContain(`href="https://nailfest.lat/imparables/kit/${n}.jpg"`);
    // Six wallpapers: three to a row.
    const six = imparablesEventEmail({ ...frame, kit: { wallpapers: [1, 2, 3, 4, 5, 6].map((n) => file(`Fondo ${n}`, n)) } }, mail).html;
    const kit = six.slice(six.indexOf("Tu kit Imparable"), six.indexOf("Ver todo mi kit"));
    expect(kit.match(/<tr><td style="padding:0 5px;">/g)).toHaveLength(2);
    for (let n = 1; n <= 6; n++) expect(kit).toContain(`kit/mini/${n}.jpg`);
    expect(html).not.toMatch(/plantilla/i);
    expect(html).toContain('href="https://wa.me/?text=hola"');
    expect(text).toContain("TU KIT IMPARABLE");
    expect(text).not.toContain("/marco");
  });

  it("leaves out what the email switches off, and the band when it has none", () => {
    const { html, text } = imparablesEventEmail(frame, { ...mail, band: null, asistire: null, kit: null, colega: false });
    expect(html).not.toContain("FALTAN 7 DÍAS");
    expect(html).not.toContain("¡Cuéntale a todos que vas!");
    expect(html).not.toContain("Tu kit Imparable");
    expect(html).not.toContain("¿Conoces a una colega que lo necesita?");
    expect(text).not.toContain("TU KIT IMPARABLE");
  });
});

describe("its text, ordered", () => {
  it("turns a link alone on its line into a button, a short line ending in «:» into a subtitle, an emoji line into a row", () => {
    const html = imparablesBody(
      '<p>Lo que necesitas:</p><p>📍 Un lugar tranquilo</p><p>con buena señal</p><p><a href="https://nailfest.lat/x">Ver la agenda</a></p><p>⚠️ Llega temprano</p>'
    );
    expect(html).toMatch(/font-weight:800;color:#6e5230;[^"]*">Lo que necesitas:<\/div>/);
    expect(html).toContain("📍");
    expect(html).toContain("con buena señal");
    expect(html).toContain('<a href="https://nailfest.lat/x" style="display:inline-block;');
    expect(html).toContain(">Ver la agenda</a>");
    expect(html).toContain("background:#f3e6cc;border:1px solid #c9a46a");
  });

  it("leaves out the wide image it opens with (the cover says it) and her ticket's tag", () => {
    const html = imparablesBody('<p><img src="https://x/banner.jpg"></p><p>Hola</p><p>{{BOLETA}}</p>', "https://x/banner.jpg");
    expect(html).not.toContain("banner.jpg");
    expect(html).not.toContain("{{BOLETA}}");
    expect(html).toContain("Hola");
  });

  it("keeps links and images in the design's marks", () => {
    const html = imparablesBody('<p>Mira <a href="https://nailfest.lat">la página</a></p><figure><img src="https://x/foto.jpg"></figure>');
    expect(html).toContain('<a href="https://nailfest.lat" style="color:#6e5230;font-weight:800;text-decoration:underline;">la página</a>');
    expect(html).toContain('<img src="https://x/foto.jpg" style="display:block;width:100%;');
  });
});
