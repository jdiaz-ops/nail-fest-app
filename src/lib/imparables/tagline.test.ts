import { describe, expect, it } from "vitest";
import { sentencePerLine } from "./tagline";

const BR = '<br class="imp-tag-br">';

describe("the cover's headline, a sentence a line on a computer", () => {
  it("breaks after each sentence that another follows", () => {
    expect(sentencePerLine("<p>Empezaron desde abajo, con tus mismos miedos. Hoy tienen el negocio que sueñas.</p>")).toBe(
      `<p>Empezaron desde abajo, con tus mismos miedos.${BR} Hoy tienen el negocio que sueñas.</p>`
    );
    expect(sentencePerLine("<p>¿Lista? ¡Vamos!</p>")).toBe(`<p>¿Lista?${BR} ¡Vamos!</p>`);
  });

  it("leaves one sentence, a number or an abbreviation before lowercase, and its tags as they are", () => {
    expect(sentencePerLine("<p>Hoy tienen el negocio que sueñas.</p>")).toBe("<p>Hoy tienen el negocio que sueñas.</p>");
    expect(sentencePerLine("<p>Más de 3.5 millones, etc. y más</p>")).toBe("<p>Más de 3.5 millones, etc. y más</p>");
    expect(sentencePerLine('<p><a href="https://nailfest.lat/a. B">Uno.</a> Dos</p>')).toBe('<p><a href="https://nailfest.lat/a. B">Uno.</a> Dos</p>');
  });
});
