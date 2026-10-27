-- Manicuristas Imparables (the team, 2026-10-27): the wording a marketing
-- review proposed and the team approved. One button everywhere («Quiero mi
-- cupo»); one guarantee, said the same way everywhere («Garantía de 30
-- minutos: …»), and the refund answer in short lines; «De quién vas a
-- aprender» over the speakers, called «Conferencistas», as plain Spanish as
-- the rest («Artista de uñas»); Sunday's «Así lo lograron» against Monday's
-- «Ahora te toca a ti», whose steps make a route of verbs; what the ticket
-- includes, by value and with what it gives; the closing echoes «Nadie nace
-- imparable». Every text only where it still reads as the previous version
-- left it (the button's label, whatever it says).
UPDATE "Event" SET "registerButtonLabel" = 'Quiero mi cupo' WHERE "theme" = 'IMPARABLES';
UPDATE "Event" SET "ctaNote" = 'Garantía de 30 minutos: si en la primera media hora sientes que no es para ti, te devolvemos el 100%.' WHERE "theme" = 'IMPARABLES' AND "ctaNote" = 'Garantía sin preguntas: si en los primeros 30 minutos del congreso sientes que no es para ti, te devolvemos el 100%.';
UPDATE "Event" SET "closingText" = 'Nadie nace imparable. Nos vemos el 27 de junio.' WHERE "theme" = 'IMPARABLES' AND "closingText" = 'Tienes el talento. Ahora, a construir tu negocio.';

UPDATE "Event"
SET "landingBlocks" = (replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace("landingBlocks"::text,
      to_jsonb('Lo lograron con los mismos miedos que tú. Ahora te cuentan cómo.'::text)::text, to_jsonb('Así lo lograron'::text)::text),
      to_jsonb('Paso 1 · Tus números'::text)::text, to_jsonb('Paso 1 · Ordena tus números'::text)::text),
      to_jsonb('Paso 2 · Tu esencia'::text)::text, to_jsonb('Paso 2 · Encuentra tu sello'::text)::text),
      to_jsonb('Paso 3 · Atraer'::text)::text, to_jsonb('Paso 3 · Atrae'::text)::text),
      to_jsonb('Paso 4 · Retener'::text)::text, to_jsonb('Paso 4 · Fideliza'::text)::text),
      to_jsonb('Paso 5 · Tu ruta'::text)::text, to_jsonb('Paso 5 · Traza tu ruta'::text)::text),
      to_jsonb('Nail artist y estratega de centros de belleza. Te enseña a llenar tu agenda: la técnica ya no es suficiente.'::text)::text, to_jsonb('Artista de uñas y estratega de centros de belleza. Te enseña a llenar tu agenda: la técnica ya no es suficiente.'::text)::text),
      to_jsonb('Contenido que atrae clientas, una marca con tu sello y clientas que vuelven y te recomiendan.'::text)::text, to_jsonb('Contenido que atrae, una marca con tu sello y clientas que vuelven y te recomiendan.'::text)::text),
      to_jsonb('Garantía sin preguntas'::text)::text, to_jsonb('Garantía de 30 minutos'::text)::text),
      to_jsonb('<p>Si en los primeros 30 minutos del primer día sientes que esto no es para ti, escríbenos y te devolvemos el 100%. Sin preguntas.</p>'::text)::text, to_jsonb('<p>Si en la primera media hora sientes que no es para ti, te devolvemos el 100%.</p>'::text)::text),
      to_jsonb('Son dos mañanas, de 9:00 a. m. a 2:00 p. m., desde tu celular. Y si no puedes en vivo, tienes la repetición por 30 días.'::text)::text, to_jsonb('Son dos días, de 9:00 a. m. a 2:00 p. m., desde tu celular.'::text)::text),
      to_jsonb('Si en los primeros 30 minutos no es para ti, te devolvemos el 100%.'::text)::text, to_jsonb('Garantía de 30 minutos: si en la primera media hora sientes que no es para ti, te devolvemos el 100%.'::text)::text),
      to_jsonb('Sí, de dos formas. Si en los primeros 30 minutos del primer día sientes que el congreso no es para ti, escríbenos y te devolvemos el 100%, sin preguntas. Y dentro de los 5 días hábiles siguientes a tu compra también te devolvemos el 100%, siempre que el congreso no haya empezado. Fuera de eso no hacemos devoluciones, pero puedes pasarle tu boleta a otra persona escribiéndonos hasta el 25 de junio, y si no puedes verlo en vivo tienes la repetición por 30 días. Si Nail Fest cambia la fecha o cancela el congreso, tú eliges: te devolvemos todo o usas tu boleta en la nueva fecha. Para pedirlo, escríbenos por WhatsApp con el correo de tu compra; el dinero vuelve por el mismo medio de pago en máximo 30 días.'::text)::text, to_jsonb('Sí, en estos casos:
• Garantía de 30 minutos: si en la primera media hora sientes que no es para ti, te devolvemos el 100%.
• Si te arrepientes dentro de los 5 días hábiles siguientes a tu compra, también te devolvemos el 100%, siempre que el congreso no haya empezado.
• Si Nail Fest cambia la fecha o cancela el congreso, tú eliges: te devolvemos todo o usas tu boleta en la nueva fecha.
Fuera de estos casos no hacemos devoluciones, pero puedes pasarle tu boleta a otra persona escribiéndonos hasta el 25 de junio, y si no puedes verlo en vivo tienes la repetición por 30 días.
Para pedirlo, escríbenos por WhatsApp con el correo de tu compra; el dinero vuelve por el mismo medio de pago en máximo 30 días.'::text)::text))::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';

-- The speakers' heading and what the ticket includes, as whole blocks.
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN b.block ->> 'type' = 'heading' AND b.block ->> 'eyebrow' = 'Speakers' AND b.block ->> 'title' = 'Las que te lo van a contar.'
        THEN b.block || jsonb_build_object('eyebrow', 'Conferencistas', 'title', 'De quién vas a aprender')
      WHEN b.block ->> 'type' = 'points' AND b.block -> 'items' = '[{"title": "2 días en vivo", "text": ""}, {"title": "8 speakers y un panel", "text": ""}, {"title": "Pausas activas", "text": ""}, {"title": "Guías de los speakers para descargar", "text": ""}, {"title": "Repetición por 30 días", "text": ""}, {"title": "Certificado digital de asistencia con tu nombre", "text": ""}, {"title": "Descuentos exclusivos de los speakers", "text": ""}, {"title": "Tu hoja de ruta personal al final", "text": ""}]'::jsonb
        THEN jsonb_set(b.block, '{items}', '[{"title": "Tu hoja de ruta personal", "text": "Sales con tu plan listo para aplicar."}, {"title": "2 días en vivo", "text": "Con 8 conferencistas y un panel, desde tu celular."}, {"title": "Repetición por 30 días", "text": "Si te pierdes algo, lo ves cuando puedas."}, {"title": "Guías para descargar", "text": "El material de cada conferencista."}, {"title": "Certificado digital", "text": "De asistencia, con tu nombre."}, {"title": "Descuentos exclusivos", "text": "De los conferencistas, solo para quienes asisten."}]'::jsonb)
      ELSE b.block
    END ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
