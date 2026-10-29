-- Manicuristas Imparables (the team, 2026-10-29): a section right under the
-- cover, before the speakers — «¿Qué tienen en común todos los
-- conferencistas?» and two paragraphs in the team's words (added once, before
-- the speakers' title) — and the speakers' section loses its title, «De quién
-- vas a aprender», keeping «Conferencistas» over it.
DO $$
DECLARE
  ev record;
  b jsonb;
  result jsonb;
  intro jsonb := jsonb_build_array(
    jsonb_build_object('type', 'heading', 'eyebrow', '', 'title', '¿Qué tienen en común todos los conferencistas?', 'intro', ''),
    jsonb_build_object('type', 'text', 'html', '<p>Ninguno empezó arriba. Mesa alquilada, precios bajos, tres clientas, mil dudas. Lo único que tenían era una decisión: <strong>dejar de pensar en pequeño</strong>.</p><p>Hoy tienen marcas, sedes y academias. Y vienen a contarte cómo lo hicieron y a darte las estrategias y herramientas para que tú también lo logres.</p>'));
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" FROM "Event"
      WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
        AND NOT "landingBlocks" @> '[{"type": "heading", "title": "¿Qué tienen en común todos los conferencistas?"}]'::jsonb LOOP
    result := '[]'::jsonb;
    FOR b IN SELECT value FROM jsonb_array_elements(ev."landingBlocks") LOOP
      IF b->>'type' = 'heading' AND b->>'eyebrow' = 'Conferencistas' THEN
        result := result || intro;
      END IF;
      result := result || jsonb_build_array(b);
    END LOOP;
    UPDATE "Event" SET "landingBlocks" = result WHERE "id" = ev."id";
  END LOOP;
END $$;

UPDATE "Event"
SET "landingBlocks" = replace("landingBlocks"::text, to_jsonb('De quién vas a aprender'::text)::text, '""')::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
