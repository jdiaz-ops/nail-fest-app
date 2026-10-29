-- Manicuristas Imparables (the team, 2026-10-29): the program's two parts say
-- only when they start — «Mañana · 8:00 a. m.», «Tarde · 1:45 p. m.» — with no
-- title under them, and the afternoon's talks go without their step's tag.
-- Only where the page still reads as the previous version left it.
UPDATE "Event"
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'agenda' AND jsonb_typeof(b -> 'rows') = 'array' THEN
      jsonb_set(b, '{rows}', coalesce((
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(r) = 'object' AND r ->> 'kind' = 'day'
                 AND r ->> 'topic' IN ('Lo lograron con los mismos miedos que tú. Ahora te cuentan cómo.', 'Ahora te toca a ti. Este es tu plan para lograrlo.')
              THEN r || '{"topic": ""}'::jsonb
            WHEN jsonb_typeof(r) = 'object' AND r ->> 'label' IN ('Tus números', 'Tu esencia', 'Atraer', 'Retener', 'Tu ruta')
              THEN r || '{"label": ""}'::jsonb
            ELSE r
          END
          ORDER BY k)
        FROM jsonb_array_elements(b -> 'rows') WITH ORDINALITY AS t(r, k)), '[]'::jsonb))
    ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements("landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
