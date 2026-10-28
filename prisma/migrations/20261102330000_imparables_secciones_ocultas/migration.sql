-- Manicuristas Imparables (the team, 2026-10-28):
--   · the first stage is called «Etapa Creyente»;
--   · Monday's title is «Tu plan para lograrlo.», with no step named on its
--     talks (so no route under the day's subtitle either);
--   · «Apenas estoy empezando» and «Mi caso es distinto» lose their proof line;
--   · Results and «Tu boleta» (with its guarantee card) are hidden; so are
--     «Ya hice cursos y no me sirvieron» and the questions about experience
--     and IVA — each moved, as it is, into a hidden block of its own right
--     after the one it was in, so nothing is lost.
-- Each change only where the page still reads as the previous version left it.

UPDATE "TicketType" SET "name" = 'Etapa Creyente'
WHERE "name" = 'Etapa 1' AND "eventId" IN (SELECT "id" FROM "Event" WHERE "theme" = 'IMPARABLES');

UPDATE "Event"
SET "landingBlocks" = (
  replace(replace(replace(replace(replace(replace(replace(replace("landingBlocks"::text,
    to_jsonb('Ahora te toca a ti. Este es tu plan para lograrlo.'::text)::text, to_jsonb('Tu plan para lograrlo.'::text)::text),
    to_jsonb('Paso 1 · Ordena tus números'::text)::text, '""'),
    to_jsonb('Paso 2 · Encuentra tu sello'::text)::text, '""'),
    to_jsonb('Paso 3 · Atrae'::text)::text, '""'),
    to_jsonb('Paso 4 · Fideliza'::text)::text, '""'),
    to_jsonb('Paso 5 · Traza tu ruta'::text)::text, '""'),
    to_jsonb('Paula empezó en una mesa de manicure y hoy es CEO de El Imperio de las Uñas.'::text)::text, '""'),
    to_jsonb('Maria Carolina empezó desde nada y hoy forma educadoras en Chile; la escuchas en el panel.'::text)::text, '""')
)::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';

DO $$
DECLARE
  ev record;
  b jsonb;
  it jsonb;
  kept jsonb;
  moved jsonb;
  result jsonb;
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" FROM "Event" WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' LOOP
    result := '[]'::jsonb;
    FOR b IN SELECT value FROM jsonb_array_elements(ev."landingBlocks") LOOP
      IF (b->>'type' = 'heading' AND b->>'title' IN ('Lo que vas a resolver en estos dos días', 'Entre más temprano, menos pagas'))
        OR (b->>'type' = 'slides' AND b->>'style' = 'results')
        OR b->>'type' = 'prices'
        OR (b->>'type' = 'card' AND b->>'eyebrow' = 'Garantía de 30 minutos') THEN
        b := b || '{"hidden": true}'::jsonb;
      END IF;
      IF b->>'type' IN ('faq', 'slides') AND jsonb_typeof(b->'items') = 'array' AND (b->'hidden') IS DISTINCT FROM 'true'::jsonb THEN
        kept := '[]'::jsonb;
        moved := '[]'::jsonb;
        FOR it IN SELECT value FROM jsonb_array_elements(b->'items') LOOP
          IF (b->>'type' = 'faq' AND it->>'question' IN ('¿Necesito experiencia?', '¿La boleta incluye IVA?'))
            OR (b->>'style' = 'doubts' AND it->>'title' = 'Ya hice cursos y no me sirvieron.') THEN
            moved := moved || jsonb_build_array(it);
          ELSE
            kept := kept || jsonb_build_array(it);
          END IF;
        END LOOP;
        IF jsonb_array_length(moved) > 0 THEN
          result := result || jsonb_build_array(jsonb_set(b, '{items}', kept), jsonb_set(b, '{items}', moved) || '{"hidden": true}'::jsonb);
          CONTINUE;
        END IF;
      END IF;
      result := result || jsonb_build_array(b);
    END LOOP;
    UPDATE "Event" SET "landingBlocks" = result WHERE "id" = ev."id";
  END LOOP;
END $$;
