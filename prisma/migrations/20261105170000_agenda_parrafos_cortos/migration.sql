-- The program's paragraphs, shorter, as the team asked (2026-10-31).
UPDATE "Event" e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN x.b->>'type' = 'agenda' THEN jsonb_set(x.b, '{rows}', (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN r->>'kind' = 'day' AND r->>'takeaway' = 'Vas a escuchar cuatro historias que se parecen a la tuya: la mesa alquilada, el miedo a cobrar, el día en que casi lo dejan. Y vas a escribir en tu cuaderno el miedo que desde hoy dejas de usar como excusa.'
              THEN jsonb_set(r, '{takeaway}', '"Vas a escuchar cuatro historias que se parecen a la tuya: la mesa alquilada, el miedo a cobrar, el día en que casi lo dejan."'::jsonb)
            WHEN r->>'kind' = 'day' AND r->>'takeaway' = 'Ahora te toca a ti. Paso a paso, con tus propios números y tu propio Instagram abiertos, vas a armar el plan: cuánto cobrar, cómo verte, cómo atraer, cómo retener. Al final, Oskar cierra y tú firmas tu ruta.'
              THEN jsonb_set(r, '{takeaway}', '"Ahora te toca a ti. Paso a paso, con tus propios números, vas a armar el plan: cuánto cobrar, cómo verte, cómo atraer, cómo retener."'::jsonb)
            ELSE r
          END ORDER BY o), '[]'::jsonb)
        FROM jsonb_array_elements(x.b->'rows') WITH ORDINALITY AS y(r, o)))
      ELSE x.b
    END
    ORDER BY x.ordinality
  )
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS x(b, ordinality)
)
WHERE e.theme = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND jsonb_array_length(e."landingBlocks") > 0;
