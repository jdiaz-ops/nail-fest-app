-- Manicuristas Imparables (the team, 2026-10-26). Under the name, the cover
-- says «Nadie nace imparable. Se hace.» and, under it, what she takes home;
-- the speakers' cards drop their talk's title (the program says it) and keep
-- lines of about the same length, so the cards keep their proportions. Each
-- text only where it still reads as the previous version left it.
UPDATE "Event"
SET "subtitle" = '<p>Nadie nace imparable. <strong>Se hace.</strong></p><p>Tuvieron tus mismos miedos y hoy te cuentan cómo los atravesaron. Y tú sales con lo que a ellas les faltó al principio: qué te hace única, cuánto cobrar, estrategias para llenar tu agenda y cómo hacer que vuelvan.</p>'
WHERE "theme" = 'IMPARABLES' AND "subtitle" = '<p>Tienes el talento. Ya es hora de construir un negocio que crece.</p>';

WITH bios(handle, old_line, new_line) AS (
  VALUES
    ('@soypauc_tuprofe', 'Empezó atendiendo en una mesa de manicure y hoy es CEO de El Imperio de las Uñas, una cadena de 7 spas. Para crecer tuvo que vencer el autosabotaje, cobrar sin culpa y aprender a delegar en un equipo.', 'De la mesa de manicure a CEO de El Imperio de las Uñas, una cadena de 7 spas. Aprendió a cobrar sin culpa y a delegar.'),
    ('@cris_sierra17', 'Fundadora de Cristina Sierra Nail Experts: 10 sedes y más de un millón de seguidores. Resiliencia: cómo levantarse de lo más duro.', 'Fundadora de Cristina Sierra Nail Experts: 10 sedes y más de un millón de seguidores. Una historia de resiliencia y superación.'),
    ('@salinas.beautybusiness', 'Asesor de negocios de belleza, 15 años de experiencia en administración, finanzas y marketing. Precios, costos y cuánto te queda de verdad.', 'Asesor de negocios de belleza con 15 años en administración, finanzas y marketing. Te enseña a ordenar tu plata.'),
    ('@karenw.trainer', 'Creadora del Método Esencia.', 'Creadora del Método Esencia. Te ayuda a descubrir lo que te hace única y a convertirlo en tu sello.'),
    ('@fabiversatill', 'Nail artist y estratega de centros de belleza. La técnica ya no es suficiente.', 'Nail artist y estratega de centros de belleza. Te enseña a llenar tu agenda: la técnica ya no es suficiente.'),
    ('@don.juantenorio', 'Asesor de negocios de belleza, con más de 500 salones y barberías transformados. Clientas que vuelven y te recomiendan.', 'Asesor de negocios de belleza, con más de 500 salones y barberías transformados.'),
    ('@oskarivanquebelleza', 'Empresario y creador de marca. Cierra el congreso: visión, actitud y tu ruta final.', 'Empresario y creador de marca. Cierra el congreso con visión, redes y la actitud para sobresalir.')
)
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(b.block) = 'object' AND b.block ->> 'type' = 'people' AND jsonb_typeof(b.block -> 'items') = 'array' THEN jsonb_set(b.block, '{items}', (
        SELECT coalesce(jsonb_agg(
          CASE WHEN m.new_line IS NULL THEN p.item ELSE jsonb_set(p.item, '{tag}', to_jsonb(m.new_line)) END
          ORDER BY p.n), '[]'::jsonb)
        FROM jsonb_array_elements(b.block -> 'items') WITH ORDINALITY AS p(item, n)
        LEFT JOIN bios m ON jsonb_typeof(p.item) = 'object' AND lower(p.item ->> 'handle') = m.handle AND p.item ->> 'tag' = m.old_line))
      ELSE b.block
    END ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
