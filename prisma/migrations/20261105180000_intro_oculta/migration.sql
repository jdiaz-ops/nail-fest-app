-- Manicuristas Imparables' intro — «¿Qué tienen en común todos los
-- conferencistas…?» and its two paragraphs — hidden, as the team asked
-- (2026-10-31). Content: it can be shown again from the admin.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i,
    LAG(e.value) OVER (PARTITION BY ev.id ORDER BY e.ordinality) AS prev
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
changed AS (
  SELECT id, i,
    CASE
      WHEN b->>'type' = 'heading' AND b->>'title' LIKE '¿Qué tienen en común%' THEN jsonb_set(b, '{hidden}', 'true'::jsonb)
      WHEN b->>'type' = 'text' AND prev->>'type' = 'heading' AND prev->>'title' LIKE '¿Qué tienen en común%' THEN jsonb_set(b, '{hidden}', 'true'::jsonb)
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
