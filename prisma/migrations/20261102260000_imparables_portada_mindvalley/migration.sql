-- Manicuristas Imparables (the team, 2026-10-27): a cover in Mindvalley's
-- style. «El talento solo no paga las cuentas.» under the name, then why and
-- what for — «nada va a cambiar» and «Mentalidad · Dinero · Marketing» in
-- bronze; the speakers' photos in a strip with their names under it (the
-- cover's image keeps that line as its caption); the button «Quiero hacerlo
-- diferente»; «Nadie nace imparable. Se hace.» moves to the closing. Zoom is
-- named nowhere on the page. Each text only where it still reads as the
-- previous version left it (the button's label, whatever it says).
UPDATE "Event" SET "subtitle" = '<p>El talento solo no paga las cuentas.</p><p>Tienes el talento. Si no cambias cómo piensas, vendes y cobras, <strong>nada va a cambiar</strong>. Dos días en vivo con quienes ya lo hicieron: <strong>Mentalidad · Dinero · Marketing</strong>.</p>' WHERE "theme" = 'IMPARABLES' AND "subtitle" = '<p>Nadie nace imparable. <strong>Se hace.</strong></p><p>Tuvieron tus mismos miedos y hoy te cuentan cómo los atravesaron. Y tú sales con lo que a ellas les faltó al principio: qué te hace única, cuánto cobrar, estrategias para llenar tu agenda y cómo hacer que vuelvan.</p>';
UPDATE "Event" SET "closingText" = 'Nadie nace imparable. Se hace.' WHERE "theme" = 'IMPARABLES' AND "closingText" IN ('Nadie nace imparable. Nos vemos el 27 de junio.', 'Tienes el talento. Ahora, a construir tu negocio.');
UPDATE "Event" SET "registerButtonLabel" = 'Quiero hacerlo diferente' WHERE "theme" = 'IMPARABLES';

UPDATE "Event"
SET "landingBlocks" = (replace(replace("landingBlocks"::text,
      to_jsonb('Por Zoom. En el celular descargas la app gratis una sola vez y entras con tu enlace personal, que te llega por correo y por WhatsApp; antes de empezar te mandamos recordatorios. También puedes verlo desde el computador.'::text)::text, to_jsonb('Con tu enlace personal, que te llega por correo y por WhatsApp; antes de empezar te mandamos recordatorios. Lo ves desde el celular o desde el computador.'::text)::text),
      to_jsonb('Sí. Es 100% en vivo por Zoom, así que lo ves desde cualquier país. Las horas de la agenda están en hora Colombia. Si necesitas ayuda para pagar desde afuera, escríbenos por WhatsApp.'::text)::text, to_jsonb('Sí. Es 100% en vivo y en línea, así que lo ves desde cualquier país. Las horas de la agenda están en hora Colombia. Si necesitas ayuda para pagar desde afuera, escríbenos por WhatsApp.'::text)::text))::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';

-- The cover's image (one before the first section title) with no caption
-- yet: the line under the speakers' strip.
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN b.block ->> 'type' = 'image' AND coalesce(b.block ->> 'caption', '') = ''
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS h(block, n)
             WHERE h.n < b.n AND h.block ->> 'type' = 'heading')
        THEN b.block || jsonb_build_object('caption', 'Jimena, Pau, Cris, Alejandro, Karen, Fabi, Juan Tenorio, Oskar')
      ELSE b.block
    END ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
