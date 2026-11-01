-- Manicuristas Imparables (the team, 2026-11-01): «Guías para descargar» leaves «Todo lo que trae tu boleta».
-- Only that card goes; the other cards of the list stay as they are.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
    AND "landingBlocks"::text LIKE '%Guías para descargar%'
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
changed AS (
  SELECT id, i,
    CASE
      WHEN b->>'type' = 'points' AND jsonb_typeof(b->'items') = 'array' THEN
        jsonb_set(b, '{items}', (
          SELECT coalesce(jsonb_agg(it.value ORDER BY it.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(b->'items') WITH ORDINALITY AS it(value, ordinality)
          WHERE trim(coalesce(it.value->>'title', '')) <> 'Guías para descargar'
        ))
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
