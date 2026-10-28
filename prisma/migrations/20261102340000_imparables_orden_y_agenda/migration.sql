-- Manicuristas Imparables (the team, 2026-10-28):
--   · the headline goes without its period;
--   · the speakers in the team's order — Cris, Jimena, Pau, Oskar, Juan, Karen,
--     Fabi, Alejandro — with Karen's full name and photo, and Alejandro's
--     nickname, «El Señor Finanzas»; Maria Carolina's line tells where she
--     comes from;
--   · the program has «Agenda» alone over it, and «Ceremonia de cierre» last;
--   · «Tu hoja de ruta imparable» in what the ticket brings;
--   · «¿Todavía lo estás pensando?» is hidden, kept for later.
-- Each change only where the page still reads as the previous version left it.

UPDATE "Event" SET "subtitle" = '<p>Mentalidad · Dinero · Marketing</p><p>Deja de pensar en pequeño</p><p>Inspírate en quienes empezaron desde abajo, con tus mismos miedos, y hoy tienen el negocio y la vida que sueñas. <strong>Aprende cómo lo hicieron y replica sus estrategias para ganar</strong>.</p>'
WHERE "theme" = 'IMPARABLES' AND "subtitle" = '<p>Mentalidad · Dinero · Marketing</p><p>Deja de pensar en pequeño.</p><p>Inspírate en quienes empezaron desde abajo, con tus mismos miedos, y hoy tienen el negocio y la vida que sueñas. <strong>Aprende cómo lo hicieron y replica sus estrategias para ganar</strong>.</p>';

UPDATE "Event"
SET "landingBlocks" = (
  replace(replace(replace(replace(replace(replace(replace(replace("landingBlocks"::text,
    to_jsonb('Así son los dos días'::text)::text, '""'),
    to_jsonb('Karen'::text)::text, to_jsonb('Karen Pinzón'::text)::text),
    to_jsonb('Karen, Fabi Pinillo Martínez y Juan Tenorio'::text)::text, to_jsonb('Karen Pinzón, Fabi Pinillo Martínez y Juan Tenorio'::text)::text),
    to_jsonb('Asesor de negocios de belleza con 15 años en administración, finanzas y marketing. Te enseña a ordenar tu plata.'::text)::text,
      to_jsonb('«El Señor Finanzas». Asesor de negocios de belleza con 15 años en administración y marketing. Te enseña a ordenar tu plata.'::text)::text),
    to_jsonb('De empezar desde nada a formar educadoras en toda Chile. En vivo desde Chile.'::text)::text,
      to_jsonb('De migrar de Venezuela a Chile y volver a empezar desde cero, a formar a las futuras educadoras del país.'::text)::text),
    to_jsonb('Agradecimientos'::text)::text, to_jsonb('Ceremonia de cierre'::text)::text),
    to_jsonb('Tu hoja de ruta personal'::text)::text, to_jsonb('Tu hoja de ruta imparable'::text)::text),
    to_jsonb('Sales con tu plan listo para aplicar.'::text)::text, to_jsonb('Sales con tu plan y estrategias listas para aplicar.'::text)::text)
)::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';

DO $$
DECLARE
  ev record;
  b jsonb;
  result jsonb;
  speakers text[] := ARRAY['Cristina Sierra', 'Jimena Montalban', 'Paula Chacón', 'Oskar Garzón', 'Juan Tenorio', 'Karen Pinzón', 'Fabi Pinillo Martínez', 'Alejandro Salinas'];
  karen text := '/imparables/karen.jpg';
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" FROM "Event" WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' LOOP
    result := '[]'::jsonb;
    FOR b IN SELECT value FROM jsonb_array_elements(ev."landingBlocks") LOOP
      -- «¿Todavía lo estás pensando?», its title and its cards
      IF (b->>'type' = 'heading' AND b->>'title' = '¿Todavía lo estás pensando?') OR (b->>'type' = 'slides' AND b->>'style' = 'doubts') THEN
        b := b || '{"hidden": true}'::jsonb;
      END IF;
      -- The speakers' cards: in the team's order (anyone else after them, as they were), Karen with her photo
      IF b->>'type' = 'people' AND jsonb_typeof(b->'items') = 'array' AND b->'items' @> '[{"name": "Jimena Montalban"}]'::jsonb THEN
        b := jsonb_set(b, '{items}', (
          SELECT jsonb_agg(
            CASE WHEN it->>'name' = 'Karen Pinzón' AND coalesce(it->>'photoUrl', '') = '' THEN it || jsonb_build_object('photoUrl', karen) ELSE it END
            ORDER BY coalesce(array_position(speakers, it->>'name'), 1000), k)
          FROM jsonb_array_elements(b->'items') WITH ORDINALITY AS t(it, k)));
      END IF;
      -- Her photo in the program too
      IF b->>'type' = 'agenda' AND jsonb_typeof(b->'rows') = 'array' THEN
        b := jsonb_set(b, '{rows}', (
          SELECT jsonb_agg(
            CASE WHEN r->>'instructor' = 'Karen Pinzón' AND coalesce(r->>'photoUrl', '') = '' THEN r || jsonb_build_object('photoUrl', karen) ELSE r END
            ORDER BY k)
          FROM jsonb_array_elements(b->'rows') WITH ORDINALITY AS t(r, k)));
      END IF;
      result := result || jsonb_build_array(b);
    END LOOP;
    UPDATE "Event" SET "landingBlocks" = result WHERE "id" = ev."id";
  END LOOP;
END $$;
