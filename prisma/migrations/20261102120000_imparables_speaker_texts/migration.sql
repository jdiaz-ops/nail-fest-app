-- Manicuristas Imparables' speakers in the team's words (2026-10-26): the
-- line on each one's card and the title of her talk, which the program
-- shows under her name (Oskar's talk also has a subtitle: the row's «Nota
-- extra»). Only those texts change, in the events already made from the
-- template (theme IMPARABLES), each speaker found by her name; the hours,
-- the order and the rest of the page stay as they are. The team edits them
-- later in the event's «Contenido» (Cris Sierra's title is provisional).
WITH speaker ("name", "handle", "tag", "talk", "subtitle") AS (
  VALUES
    ('Jimena', '@jimenanails', 'La manicurista que se convirtió en empresaria. Fundadora de JimenaNails, 10 años construyendo su marca y a sí misma.', 'De la mesa a una marca internacional', ''),
    ('Pau', '@soypauc_tuprofe', 'De la mesa a CEO de El Imperio de las Uñas. Miedos, autosabotaje y cobrar sin culpa.', 'Créete el cuento y cobra lo que vales', ''),
    ('Juan Tenorio', '@don.juantenorio', 'Asesor de negocios de belleza, con más de 500 salones y barberías transformados. Precios, valor y rentabilidad.', 'Tu salón factura, pero ¿cuánto te queda?', ''),
    ('Cris Sierra', '@cris_sierra17', 'Fundadora de Cristina Sierra Nail Experts: 10 sedes y más de un millón de seguidores. Una historia de superación.', 'La historia detrás de 10 sedes', ''),
    ('Maris', '@maris_nails_oficial', 'De empezar desde nada a formar educadoras en toda Chile. En vivo desde Chile.', 'Empezar de cero en otro país y atreverse a mostrarse', ''),
    ('Fabi', '@fabiversatill', 'Nail artist y estratega de centros de belleza. La técnica ya no es suficiente.', 'Agenda llena: estrategias y contenido que traen clientas', ''),
    ('Alejandro Salinas', '@salinas.beautybusiness', 'Asesor de negocios de belleza, 15 años de experiencia en administración, finanzas y marketing.', 'IA para tu negocio: menos horas, más clientas', ''),
    ('Oskar', '@oskarivanquebelleza', 'Empresario y creador de marca. De creértela a sobresalir: visión, redes y la ruta final.', 'Piensa en grande y hazte ver', 'Visión, redes y la actitud para sobresalir.')
)
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      -- The speakers' cards: her handle and her line.
      WHEN b.block ->> 'type' = 'people' AND jsonb_typeof(b.block -> 'items') = 'array' THEN jsonb_set(b.block, '{items}', COALESCE((
        SELECT jsonb_agg(CASE WHEN s."name" IS NULL THEN i.item ELSE i.item || jsonb_build_object('handle', s."handle", 'tag', s."tag") END ORDER BY i.n)
        FROM jsonb_array_elements(b.block -> 'items') WITH ORDINALITY AS i(item, n)
        LEFT JOIN speaker AS s ON s."name" = i.item ->> 'name'
      ), '[]'::jsonb))
      -- The program: under her name, her talk and its subtitle.
      WHEN b.block ->> 'type' = 'agenda' AND jsonb_typeof(b.block -> 'rows') = 'array' THEN jsonb_set(b.block, '{rows}', COALESCE((
        SELECT jsonb_agg(
          CASE WHEN s."name" IS NULL OR COALESCE(r.line ->> 'kind', 'session') <> 'session' THEN r.line ELSE r.line || jsonb_build_object('topic', s."talk", 'text', s."subtitle") END
          ORDER BY r.n)
        FROM jsonb_array_elements(b.block -> 'rows') WITH ORDINALITY AS r(line, n)
        LEFT JOIN speaker AS s ON s."name" = r.line ->> 'instructor'
      ), '[]'::jsonb))
      ELSE b.block
    END
    ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
-- Nothing here may fail on a page saved some other way: only lists of blocks.
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
