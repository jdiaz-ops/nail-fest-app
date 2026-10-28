-- Manicuristas Imparables (the team, 2026-10-28): new lines on Pau's, Oskar's,
-- Karen's and Fabi's cards, in the team's words, and Alejandro's without
-- «Te enseña a ordenar tu plata». Only where each card still reads as the
-- previous version left it.
UPDATE "Event"
SET "landingBlocks" = (replace(replace(replace(replace(replace("landingBlocks"::text,
    to_jsonb('De la mesa de manicure a CEO de El Imperio de las Uñas, una cadena de 7 spas. Aprendió a cobrar sin culpa y a delegar.'::text)::text,
    to_jsonb('Empezó en una mesa de manicure. Hoy es CEO de El Imperio de las Uñas: 7 spas en Bogotá, academia propia y un negocio que factura miles de millones al año.'::text)::text),
    to_jsonb('Empresario y creador de marca. Cierra el congreso con visión, redes y la actitud para sobresalir.'::text)::text,
    to_jsonb('Del humor de la mesa de trabajo creó un personaje que siguen cientos de miles en todo Latam. Se convirtió en la voz del gremio con un solo mensaje: con esta profesión cualquiera puede sobresalir.'::text)::text),
    to_jsonb('Creadora del Método Esencia. Te ayuda a descubrir lo que te hace única y a convertirlo en tu sello.'::text)::text,
    to_jsonb('Su lema es: «La vida es una historia, escribe la tuya». Karen escribió la suya: de la mesa pasó a maestra, y hoy más de 150 mil la siguen para aprender de ella.'::text)::text),
    to_jsonb('Artista de uñas y estratega de centros de belleza. Te enseña a llenar tu agenda: la técnica ya no es suficiente.'::text)::text,
    to_jsonb('Sabe lo frustrante que es hacer uñas bien y aun así no avanzar. Lleva más de 6 años sacando manicuristas de ahí: más de 400 certificadas que hoy viven de su talento. Su regla es simple: la técnica ya no es suficiente, hay que saber llenar la agenda.'::text)::text),
    to_jsonb('«El Señor Finanzas». Asesor de negocios de belleza con 15 años en administración y marketing. Te enseña a ordenar tu plata.'::text)::text,
    to_jsonb('«El Señor Finanzas». Asesor de negocios de belleza con 15 años en administración y marketing.'::text)::text))::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
