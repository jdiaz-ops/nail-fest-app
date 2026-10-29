-- Manicuristas Imparables (the team, 2026-10-29): MEU (Mujeres Empresarias
-- Unidas) joins what Heidy cofounded, before Manicuristas Imparables. The
-- sentence lives inside her card's text, so it is replaced as it stands
-- there; only where it still reads as before.
UPDATE "Event"
SET "landingBlocks" = replace("landingBlocks"::text,
    'Hoy es cofundadora de H La Cosedora, Nail Fest, Guerra de Pinceles y Manicuristas Imparables.',
    'Hoy es cofundadora de H La Cosedora, Nail Fest, Guerra de Pinceles, MEU (Mujeres Empresarias Unidas) y Manicuristas Imparables.')::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
