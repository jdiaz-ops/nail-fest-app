-- Manicuristas Imparables (the team, 2026-10-29): no star talk — the panel's
-- line in the program goes without «★ Charla estrella» and without its box,
-- like every other talk; any tag that says it goes too.
UPDATE "Event"
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'agenda' AND jsonb_typeof(b -> 'rows') = 'array' THEN
      jsonb_set(b, '{rows}', coalesce((
        SELECT jsonb_agg(
          CASE WHEN jsonb_typeof(r) = 'object' THEN
            r || jsonb_build_object('star', false) || CASE WHEN coalesce(r ->> 'label', '') ILIKE '%charla estrella%' THEN '{"label": ""}'::jsonb ELSE '{}'::jsonb END
          ELSE r END
          ORDER BY k)
        FROM jsonb_array_elements(b -> 'rows') WITH ORDINALITY AS t(r, k)), '[]'::jsonb))
    ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements("landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
