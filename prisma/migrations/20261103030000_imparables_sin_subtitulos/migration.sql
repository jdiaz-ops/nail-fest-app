-- Manicuristas Imparables (the team, 2026-10-29, on the one-day page):
--   · no line under «Agenda» (the day and its hours), and no subtitle under
--     each part's title, the morning's and the afternoon's;
--   · what the ticket brings without «Tu hoja de ruta imparable» nor
--     «Descuentos exclusivos»;
--   · «¿Qué tienen en común todos los conferencistas de Manicuristas
--     Imparables?».
-- (The route of the afternoon's steps and the hours under the cover's button
-- on a phone are gone from the page itself.) Each change only where the page
-- still reads as the previous version left it.

UPDATE "Event"
SET "landingBlocks" = replace(replace(replace(replace("landingBlocks"::text,
    to_jsonb('Domingo 27 de junio · 8:00 a. m. a 7:00 p. m. · hora Colombia'::text)::text, '""'),
    to_jsonb('Cómo atravesaron las dificultades, tomaron riesgos y vencieron sus miedos para llegar donde están.'::text)::text, '""'),
    to_jsonb('Tus números, tu esencia, cómo atraer clientas y hacer que vuelvan: tu plan para ganar más y convertirte en la dueña de tu negocio.'::text)::text, '""'),
    to_jsonb('¿Qué tienen en común todos los conferencistas?'::text)::text, to_jsonb('¿Qué tienen en común todos los conferencistas de Manicuristas Imparables?'::text)::text)::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';

UPDATE "Event" e
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'points' AND jsonb_typeof(b -> 'items') = 'array' THEN
      jsonb_set(b, '{items}', coalesce((
        SELECT jsonb_agg(it ORDER BY k)
        FROM jsonb_array_elements(b -> 'items') WITH ORDINALITY AS t(it, k)
        WHERE coalesce(it ->> 'title', '') NOT IN ('Tu hoja de ruta imparable', 'Descuentos exclusivos')), '[]'::jsonb))
    ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array';
