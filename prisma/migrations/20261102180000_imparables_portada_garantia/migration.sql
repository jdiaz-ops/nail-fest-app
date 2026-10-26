-- Manicuristas Imparables, as the team asked (2026-10-26): under the cover's
-- button, a guarantee instead of «Imparables pasa una vez al año.» (the
-- «Texto debajo del botón», shown there with a shield — only where it still
-- says that, or nothing); the «Por qué ahora» section hidden (its heading
-- and the blocks under it until the next heading get `hidden`, so they stay
-- in the editor and leave the page); and two speakers' lines shortened, Pau's
-- with her chain of 7 spas — only where each still reads as before.
UPDATE "Event"
SET "ctaNote" = 'Garantía sin preguntas: si en los primeros 30 minutos del congreso sientes que no es para ti, te devolvemos el 100%.'
WHERE "theme" = 'IMPARABLES'
  AND ("ctaNote" IS NULL OR btrim("ctaNote") IN ('', 'Imparables pasa una vez al año.'));

WITH hook AS (
  SELECT e."id",
    (SELECT min(x.i) FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS x(b, i)
      WHERE x.b->>'type' = 'heading' AND lower(btrim(x.b->>'eyebrow')) = lower('Por qué ahora')) AS starts
  FROM "Event" e
  WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array'
), bounds AS (
  SELECT h."id", h.starts,
    (SELECT min(x.i) FROM "Event" e, jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS x(b, i)
      WHERE e."id" = h."id" AND x.i > h.starts AND x.b->>'type' = 'heading') AS ends
  FROM hook h
  WHERE h.starts IS NOT NULL
)
UPDATE "Event" e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE WHEN x.i = bd.starts OR (bd.ends IS NOT NULL AND x.i > bd.starts AND x.i < bd.ends)
      THEN x.b || '{"hidden": true}'::jsonb ELSE x.b END
    ORDER BY x.i)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS x(b, i)
)
FROM bounds bd
WHERE e."id" = bd."id";

WITH speaker ("name", "before", "after") AS (
  VALUES
    ('Pau', 'De la mesa a CEO de El Imperio de las Uñas. Miedos, autosabotaje y cobrar sin culpa.', 'De la mesa a CEO de El Imperio de las Uñas, una cadena de 7 spas.'),
    ('Juan Tenorio', 'Asesor de negocios de belleza, con más de 500 salones y barberías transformados. Precios, valor y rentabilidad.', 'Asesor de negocios de belleza, con más de 500 salones y barberías transformados.')
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
