-- Manicuristas Imparables (the team, 2026-10-29): no «Paso 1», «Paso 2»… on
-- the afternoon's talks — each tag keeps only its step's name («Tus números»,
-- «Tu esencia», «Atraer», «Retener», «Tu ruta»).
UPDATE "Event"
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'agenda' AND jsonb_typeof(b -> 'rows') = 'array' THEN
      jsonb_set(b, '{rows}', coalesce((
        SELECT jsonb_agg(
          CASE WHEN jsonb_typeof(r) = 'object' AND coalesce(r ->> 'label', '') ~* '^\s*paso\s*[0-9]+\s*[·:.–—-]\s*\S' THEN
            r || jsonb_build_object('label', regexp_replace(r ->> 'label', '^\s*paso\s*[0-9]+\s*[·:.–—-]\s*', '', 'i'))
          ELSE r END
          ORDER BY k)
        FROM jsonb_array_elements(b -> 'rows') WITH ORDINALITY AS t(r, k)), '[]'::jsonb))
    ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements("landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
