-- Manicuristas Imparables (the team, 2026-10-28): Heidy's card also says she
-- created Manicuristas Imparables. The sentence lives inside the card's text,
-- so it is replaced as it stands there; only where it still reads as before.
UPDATE "Event"
SET "landingBlocks" = replace("landingBlocks"::text,
    'Hoy es cofundadora de H La Cosedora, Nail Fest y Guerra de Pinceles, tiene un récord Guinness y pasó por Shark Tank.',
    'Hoy es cofundadora de H La Cosedora, Nail Fest y Guerra de Pinceles, y creadora de Manicuristas Imparables. Tiene un récord Guinness y pasó por Shark Tank.')::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
