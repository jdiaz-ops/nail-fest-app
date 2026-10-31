-- Manicuristas Imparables' «Lo que vas a resolver en un solo día» goes under
-- the speakers, right before the program (the team, 2026-10-31). Matched by
-- what the blocks are; an event without them is left as it is.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality::numeric AS i,
    LEAD(e.value->>'type') OVER (PARTITION BY ev.id ORDER BY e.ordinality) AS next_type
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
anchors AS (
  -- The program's heading: the one right before the first agenda block.
  SELECT id, MIN(i) AS agenda_heading FROM el WHERE b->>'type' = 'heading' AND next_type = 'agenda' GROUP BY id
),
placed AS (
  SELECT el.id, el.b,
    CASE
      WHEN a.agenda_heading IS NOT NULL AND el.b->>'type' = 'heading' AND el.b->>'title' = 'Lo que vas a resolver en un solo día' THEN a.agenda_heading - 0.2
      WHEN a.agenda_heading IS NOT NULL AND el.b->>'type' = 'slides' AND el.b->>'style' = 'results' THEN a.agenda_heading - 0.1
      ELSE el.i
    END AS k
  FROM el LEFT JOIN anchors a USING (id)
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY k) AS blocks FROM placed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
