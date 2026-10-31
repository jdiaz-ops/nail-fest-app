-- Manicuristas Imparables' program (the team, 2026-10-31): each part's
-- header says only its name — «Mañana», «Tarde» — not the hour it starts;
-- the hour is on its first line anyway.
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
      WHEN b->>'type' = 'agenda' AND jsonb_typeof(b->'rows') = 'array' THEN
        jsonb_set(b, '{rows}', (
          SELECT coalesce(jsonb_agg(
            CASE
              WHEN r.value->>'kind' = 'day' THEN
                jsonb_set(r.value, '{chip}', to_jsonb(regexp_replace(r.value->>'chip', '\s*·\s*\d{1,2}[:.]\d{2}.*$', '')))
              ELSE r.value
            END ORDER BY r.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(b->'rows') WITH ORDINALITY AS r(value, ordinality)
        ))
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
