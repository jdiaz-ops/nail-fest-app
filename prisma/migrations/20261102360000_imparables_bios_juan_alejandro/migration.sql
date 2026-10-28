-- Manicuristas Imparables (the team, 2026-10-28): Juan Tenorio's and Alejandro
-- Salinas's cards in the team's words. Only where each still reads as the
-- previous version left it.
UPDATE "Event"
SET "landingBlocks" = (replace(replace("landingBlocks"::text,
    to_jsonb('Asesor de negocios de belleza, con más de 500 salones y barberías transformados.'::text)::text,
    to_jsonb('No habla de teoría: habla de lo que hizo. Primero construyó su propia cadena de 5 barberías en Bogotá. Luego le enseñó su método a 500+ salones y barberías que hoy son rentables.'::text)::text),
    to_jsonb('«El Señor Finanzas». Asesor de negocios de belleza con 15 años en administración y marketing.'::text)::text,
    to_jsonb('«El Señor Finanzas». 9 años dentro de la cadena de uñas más grande de México, 6 certificaciones oficiales de belleza desarrolladas con el gobierno y más de 2.000 negocios capacitados en 8 países. Si no sabes cuánto ganas, él te enseña a saberlo.'::text)::text))::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
