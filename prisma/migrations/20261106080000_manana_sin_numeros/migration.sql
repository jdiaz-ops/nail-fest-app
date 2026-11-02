-- Manicuristas Imparables (the team, 2026-11-02): the morning's line ends at «el miedo a cobrar.» — without «Y antes
-- del almuerzo, tus números en orden.». Wherever the page still has that sentence, word for word. (The code's own copy:
-- lib/imparables/transformacion.ts.)
UPDATE "Event"
SET "landingBlocks" = replace("landingBlocks"::text, ' Y antes del almuerzo, tus números en orden.', '')::jsonb
WHERE theme = 'IMPARABLES'
  AND jsonb_typeof("landingBlocks") = 'array'
  AND "landingBlocks"::text LIKE '% Y antes del almuerzo, tus números en orden.%';
