-- Manicuristas Imparables' speakers, as the team asked (2026-10-26): Maris's,
-- Fabi's, Alejandro Salinas's and Oskar's cards say who they are and what
-- each one teaches (Maris: beating the fear and daring to show yourself),
-- without the lines the team struck out. Only where each card still reads
-- as before.
WITH speaker ("name", "before", "after") AS (
  VALUES
    ('Maris', 'De empezar desde nada a formar educadoras en toda Chile. En vivo desde Chile.', 'De empezar desde nada en otro país a formar educadoras en toda Chile. Te enseña a vencer el miedo y atreverte a mostrarte.'),
    ('Fabi', 'Nail artist y estratega de centros de belleza. La técnica ya no es suficiente.', 'Estratega de centros de belleza. Te enseña a llenar tu agenda con estrategias y contenido que traen clientas.'),
    ('Alejandro Salinas', 'Asesor de negocios de belleza, 15 años de experiencia en administración, finanzas y marketing.', 'Asesor de negocios de belleza, 15 años en administración, finanzas y marketing. Te muestra cómo usar la IA para ganar tiempo y clientas.'),
    ('Oskar', 'Empresario y creador de marca. De creértela a sobresalir: visión, redes y la ruta final.', 'Te contagia la energía para creértela y sobresalir: visión, redes y la ruta final.')
)
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN b.block ->> 'type' = 'people' AND jsonb_typeof(b.block -> 'items') = 'array' THEN jsonb_set(b.block, '{items}', COALESCE((
        SELECT jsonb_agg(CASE WHEN s."name" IS NULL THEN i.item ELSE i.item || jsonb_build_object('tag', s."after") END ORDER BY i.n)
        FROM jsonb_array_elements(b.block -> 'items') WITH ORDINALITY AS i(item, n)
        LEFT JOIN speaker AS s ON s."name" = i.item ->> 'name' AND s."before" = i.item ->> 'tag'
      ), '[]'::jsonb))
      ELSE b.block
    END
    ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
