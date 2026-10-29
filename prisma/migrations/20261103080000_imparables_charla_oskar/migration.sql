-- Manicuristas Imparables (the team, 2026-10-29): Oskar Garzón's talk in the
-- program as approved — «Atrévete y piensa en grande», and under it «Redes,
-- actitud y orgullo por tu oficio: lo que necesitas para dejar de pensar en
-- pequeño.». Only on his line where it still reads as before.
UPDATE "Event"
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'agenda' AND jsonb_typeof(b -> 'rows') = 'array' THEN
      jsonb_set(b, '{rows}', coalesce((
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(r) = 'object' AND r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Oskar%'
                 AND (r ->> 'topic' = 'Piensa en grande y hazte ver'
                      OR r ->> 'text' IN ('Visión, redes y la actitud para sobresalir. Cierre del congreso y tu ruta final.', 'Visión, redes y la actitud para sobresalir.'))
              THEN r || '{"topic": "Atrévete y piensa en grande", "text": "Redes, actitud y orgullo por tu oficio: lo que necesitas para dejar de pensar en pequeño."}'::jsonb
            ELSE r
          END
          ORDER BY k)
        FROM jsonb_array_elements(b -> 'rows') WITH ORDINALITY AS t(r, k)), '[]'::jsonb))
    ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements("landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
