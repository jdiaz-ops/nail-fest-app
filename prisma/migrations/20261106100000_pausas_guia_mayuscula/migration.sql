-- Manicuristas Imparables (the team, 2026-11-02): under «@ssanchezacademy», in the active breaks' «Guiada por»,
-- «Manicurista y fisioterapeuta» with a capital M. Only where it's still as 20261106090000_pausas_guia wrote it.
UPDATE "Event"
SET "landingBlocks" = replace(
      "landingBlocks"::text,
      '@ssanchezacademy · manicurista y fisioterapeuta',
      '@ssanchezacademy · Manicurista y fisioterapeuta'
    )::jsonb
WHERE theme = 'IMPARABLES'
  AND jsonb_typeof("landingBlocks") = 'array'
  AND "landingBlocks"::text LIKE '%@ssanchezacademy · manicurista y fisioterapeuta%';
