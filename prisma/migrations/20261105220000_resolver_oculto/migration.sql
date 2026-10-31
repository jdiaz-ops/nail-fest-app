-- Manicuristas Imparables (the team, 2026-10-31): «Lo que vas a resolver en
-- un solo día» and its three cards leave the page — hidden, so the admin can
-- show them again — and the band «Tu negocio no va a ser el mismo. Y tú
-- tampoco.» takes their place (components/imparables/ImparablesPage.tsx).
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
changed AS (
  SELECT id, i,
    CASE
      WHEN (b->>'type' = 'heading' AND b->>'title' LIKE 'Lo que vas a resolver%')
        OR (b->>'type' = 'slides' AND b->>'style' = 'results')
        THEN jsonb_set(b, '{hidden}', 'true'::jsonb)
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
