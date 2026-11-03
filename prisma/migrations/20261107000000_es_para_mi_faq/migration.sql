-- Manicuristas Imparables (the team, 2026-11-03): «¿Me sirve si llevo poco tiempo? ¿Y si llevo muchos años?» gives its
-- place in the questions to «¿Me sirve si trabajo en mi casa?», with its own answer. Wherever the page has them word
-- for word. (The code's own copy: lib/imparables/transformacion.ts.)
UPDATE "Event"
SET "landingBlocks" = replace(replace("landingBlocks"::text,
    '"¿Me sirve si llevo poco tiempo? ¿Y si llevo muchos años?"',
    '"¿Me sirve si trabajo en mi casa?"'),
    '"Sirve si ya tienes clientas y sientes que estás estancada. Las historias de la mañana son para las dos; el plan de la tarde se arma con tus números, lleves uno o quince años."',
    '"Sí. La mayoría de las conferencistas empezaron exactamente ahí. El plan de la tarde se arma con tus números, sean los que sean."')::jsonb
WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
  AND "landingBlocks"::text LIKE '%¿Me sirve si llevo poco tiempo? ¿Y si llevo muchos años?%';
