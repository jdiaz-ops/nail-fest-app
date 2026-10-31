-- Manicuristas Imparables' «Lo que vas a resolver en un solo día», as the team
-- asked (2026-10-31): its cards without the «Con …» line of faces and names.
-- Content, so it can be put back from the admin.
UPDATE "Event" e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN x.b->>'type' = 'slides' AND x.b->>'style' = 'results'
        THEN jsonb_set(x.b, '{items}', (SELECT COALESCE(jsonb_agg(jsonb_set(it, '{who}', '""'::jsonb) ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(x.b->'items') WITH ORDINALITY AS y(it, o)))
      ELSE x.b
    END
    ORDER BY x.ordinality
  )
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS x(b, ordinality)
)
WHERE e.theme = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND jsonb_array_length(e."landingBlocks") > 0;
