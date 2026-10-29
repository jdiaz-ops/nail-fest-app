-- Manicuristas Imparables (the team, 2026-10-29): the lunch as a band of its
-- own at the end of the morning — «1 hora de almuerzo», «De 12:40 a 1:45 p. m.».
UPDATE "Event"
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'agenda' AND jsonb_typeof(b -> 'rows') = 'array' THEN
      jsonb_set(b, '{rows}', coalesce((
        SELECT jsonb_agg(
          CASE WHEN jsonb_typeof(r) = 'object' AND r ->> 'kind' = 'session' AND btrim(coalesce(r ->> 'topic', '')) = 'Almuerzo' AND coalesce(r ->> 'text', '') = '' THEN
            r || '{"topic": "1 hora de almuerzo", "text": "De 12:40 a 1:45 p. m."}'::jsonb
          ELSE r END
          ORDER BY k)
        FROM jsonb_array_elements(b -> 'rows') WITH ORDINALITY AS t(r, k)), '[]'::jsonb))
    ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements("landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
