import { describe, expect, it } from "vitest";
import { closingSubject, imparablesClosingEmail, type ImparablesClosing } from "./closingEmail";

const base = (over: Partial<ImparablesClosing> = {}): ImparablesClosing => ({
  firstName: "Laura",
  eventName: "Manicuristas Imparables",
  cover: { date: "4 de julio 2027", note: "Congreso virtual en vivo" },
  recordings: { url: "https://nailfest.lat/mi-congreso/reg_1.firma", until: "martes 3 de agosto" },
  diploma: { url: "https://nailfest.lat/api/diploma/reg_1.firma?descargar" },
  review: { url: "https://nailfest.lat/resena/qr_1" },
  helpUrl: "https://wa.me/573001234567",
  sponsors: [],
  images: { header: "https://nailfest.lat/imparables/correo-cabecera.png", logo: "https://nailfest.lat/logo.png" },
  site: { url: "https://nailfest.lat", host: "nailfest.lat" },
  ...over,
});

describe("Manicuristas Imparables' closing email", () => {
  it("thanks her and brings her recordings, her diploma and her review, each with her own link", () => {
    const { subject, html, text } = imparablesClosingEmail(base());
    expect(subject).toBe(closingSubject("Manicuristas Imparables"));
    expect(subject).toBe("Tus grabaciones y tu diploma de Manicuristas Imparables");
    expect(html).toContain("¡Gracias, Laura!");
    expect(html).toContain("GRACIAS POR SER IMPARABLE");
    expect(html).toContain('href="https://nailfest.lat/mi-congreso/reg_1.firma"');
    expect(html).toContain("martes 3 de agosto");
    expect(html).toContain('href="https://nailfest.lat/api/diploma/reg_1.firma?descargar"');
    expect(html).toContain("Descargar mi diploma");
    expect(html).toContain('href="https://nailfest.lat/resena/qr_1"');
    expect(text).toContain("hasta el martes 3 de agosto: https://nailfest.lat/mi-congreso/reg_1.firma");
    expect(text).toContain("Déjanos tu reseña: https://nailfest.lat/resena/qr_1");
  });

  it("says who organizes it and, under it, the brands that support it, at its top", () => {
    const sponsors = [
      { name: "Marca uno", url: "https://nailfest.lat/imparables/marcas/marca-1.png" },
      { name: "Marca dos", url: "https://blob.example/marca-2.png" },
    ];
    const { html, text } = imparablesClosingEmail(base({ sponsors }));
    expect(html).toContain("ORGANIZA");
    expect(html).toContain("CON EL APOYO DE");
    expect(html).toContain('src="https://nailfest.lat/imparables/marcas/marca-1.png"');
    expect(html).toContain('alt="Marca dos"');
    // Above her thanks.
    expect(html.indexOf("CON EL APOYO DE")).toBeLessThan(html.indexOf("¡Gracias, Laura!"));
    expect(text).toContain("Con el apoyo de Marca uno y Marca dos");

    const alone = imparablesClosingEmail(base());
    expect(alone.html).toContain("ORGANIZA");
    expect(alone.html).not.toContain("CON EL APOYO DE");
    expect(alone.text).not.toContain("Con el apoyo de");
  });

  it("opens her review already rated from each of the five stars", () => {
    const { html } = imparablesClosingEmail(base());
    for (let n = 1; n <= 5; n++) expect(html).toContain(`href="https://nailfest.lat/resena/qr_1?estrellas=${n}"`);
  });

  it("does without what it doesn't have: her name, her diploma, her review, the team's WhatsApp", () => {
    const { html, text } = imparablesClosingEmail(base({ firstName: "", diploma: null, review: null, helpUrl: null }));
    expect(html).toContain("¡Gracias por estar!");
    expect(html).not.toContain("Descargar mi diploma");
    expect(html).not.toContain("Dejar mi reseña");
    expect(html).not.toContain("Escríbenos por WhatsApp");
    expect(text).not.toContain("TU DIPLOMA");
  });

  it("escapes what comes from people", () => {
    const { html } = imparablesClosingEmail(base({ firstName: "<b>Ana</b>" }));
    expect(html).toContain("¡Gracias, &lt;b&gt;Ana&lt;/b&gt;!");
    expect(html).not.toContain("<b>Ana</b>");
  });
});
