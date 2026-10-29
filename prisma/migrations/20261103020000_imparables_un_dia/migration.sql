-- Manicuristas Imparables in one day (the team, 2026-10-29): Sunday 27 June
-- 2027, from 8:00 a. m. to 7:00 p. m., Bogotá — no Monday any more.
--   · The event's span and its one day (Event.scheduleDays), so the page, the
--     emails and WhatsApp's dates say so; the last price stage («Precio
--     normal») now closes when the congress does. Its public name, which
--     titles the page and a shared link: «Manicuristas Imparables · 27 de
--     junio de 2027».
--   · The program: one date in two parts — the morning, the stories, from
--     8:00; the afternoon, the plan in five steps, from 1:45, each talk with
--     its step — with a lunch, without «Repaso» nor «Cierre del día», and
--     «Cierre y sorteo» last. Every talk keeps its subtitle, its photo and its
--     speaker as they are. The panel is the star talk and names Maris. Under
--     «Agenda», the day and its hours.
--   · The panel's card, what the ticket brings and the questions: the
--     recordings' answer second, then the hours'.
--   · The hidden texts that still said two days.
-- Each change only where the page still reads as the previous version left it.

UPDATE "Event"
SET "startsAt" = TIMESTAMP '2027-06-27 13:00:00',
    "endsAt" = TIMESTAMP '2027-06-28 00:00:00',
    "scheduleDays" = '[{"opensAt": "2027-06-27T13:00:00.000Z", "closesAt": "2027-06-28T00:00:00.000Z"}]'::jsonb,
    "publicName" = regexp_replace("publicName", '\s*[-–—|·:]?\s*27\s*(&|y)\s*28\s+(de\s+)?junio(\s+de)?\s+2027\s*$', ' · 27 de junio de 2027', 'i'),
    "updatedAt" = now()
WHERE "theme" = 'IMPARABLES'
  AND ("slug" = 'manicuristas-imparables-2027' OR ("startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = DATE '2027-06-27');

-- «Precio normal» closed when the second day did (2:00 p. m. on the 28th).
UPDATE "TicketType" t
SET "hideAfter" = TIMESTAMP '2027-06-28 00:00:00',
    "updatedAt" = now()
FROM "Event" e
WHERE t."eventId" = e."id" AND e."theme" = 'IMPARABLES' AND t."hideAfter" = TIMESTAMP '2027-06-28 19:00:00';

DO $$
DECLARE
  ev record;
  b jsonb;
  result jsonb;
  old jsonb;
  maris_photo text;
  faq_done boolean;
  items jsonb;
  live jsonb;
  hrs jsonb;
  others jsonb;
  heidy text := '/imparables/heidy.jpg';
  blank jsonb := '{"kind": "session", "chip": "", "topic": "", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}';
  live_a text := 'Las grabaciones de todas las charlas quedan disponibles durante 30 días en nailfest.lat, con tu cuenta, para que las veas cuando puedas.';
  hours_a text := 'Domingo 27 de junio de 2027, de 8:00 a. m. a 7:00 p. m., hora Colombia, con una hora de almuerzo y pausas activas. Si estás en otro país, ajusta la hora a tu zona.';
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" FROM "Event" WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' LOOP
    -- Maris's photo as her panel card has it (the team may have put a better one there).
    maris_photo := NULL;
    SELECT x ->> 'photoUrl' INTO maris_photo
      FROM jsonb_array_elements(ev."landingBlocks") blk
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN blk ->> 'type' = 'people' AND jsonb_typeof(blk -> 'items') = 'array' THEN blk -> 'items' ELSE '[]'::jsonb END) x
      WHERE jsonb_typeof(x) = 'object' AND lower(x ->> 'handle') = '@maris_nails_oficial' AND coalesce(x ->> 'photoUrl', '') <> ''
      LIMIT 1;
    faq_done := false;
    result := '[]'::jsonb;
    FOR b IN SELECT value FROM jsonb_array_elements(ev."landingBlocks") LOOP
      -- The program: only the two-day version (a day of its own for Monday).
      IF b ->> 'type' = 'agenda' AND jsonb_typeof(b -> 'rows') = 'array'
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(b -> 'rows') r WHERE r ->> 'kind' = 'day' AND r ->> 'chip' ~* '^\s*lunes') THEN
        old := b -> 'rows';
        b := jsonb_set(b, '{rows}', jsonb_build_array(
          -- The morning: the stories
          blank || '{"kind": "day", "tone": "pink", "chip": "Mañana · 8:00 a. m.", "topic": "Lo lograron con los mismos miedos que tú. Ahora te cuentan cómo.", "text": "8:00 a. m. a 1:45 p. m.", "takeaway": "Cómo atravesaron las dificultades, tomaron riesgos y vencieron sus miedos para llegar donde están."}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'topic' ILIKE 'Bienvenida%' ORDER BY k LIMIT 1),
                   blank || jsonb_build_object('photoUrl', heidy))
            || '{"chip": "8:00 a. m.", "topic": "Bienvenida", "text": "Con Heidy Aristizábal, maestra de ceremonias", "label": "", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Jimena%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Jimena Montalban", "topic": "Lo que nadie te cuenta de crecer", "text": "Las decisiones y los riesgos que la llevaron de la mesa de manicure a una marca internacional.", "photoUrl": "/imparables/jimena.jpg"}'::jsonb)
            || '{"chip": "8:15 a. m.", "label": "", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'topic' ILIKE '%El día que decidí cambiar%' ORDER BY k LIMIT 1),
                   blank || '{"topic": "Panel «El día que decidí cambiar»"}'::jsonb)
            || jsonb_build_object('chip', '9:20 a. m.', 'label', '', 'star', true, 'instructor', 'Maris', 'handles', '@maris_nails_oficial',
                                  'photoUrl', coalesce(maris_photo, '/imparables/maris.jpg'), 'text', 'desde Chile'),
          blank || '{"chip": "10:20 a. m.", "topic": "Pausa activa"}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Paula%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Paula Chacón", "topic": "Créete el cuento: cobra lo que vales y deja de hacerlo todo sola", "text": "Los miedos que tuvo que vencer: cobrar sin culpa, delegar y armar un equipo.", "photoUrl": "/imparables/pau.jpg"}'::jsonb)
            || '{"chip": "10:35 a. m.", "label": "", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Cristina%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Cristina Sierra", "topic": "Lo que no te rompe te hace imparable", "text": "La historia detrás de 10 sedes: resiliencia para levantarse de lo más duro.", "photoUrl": "/imparables/cris.jpg"}'::jsonb)
            || '{"chip": "11:40 a. m.", "label": "", "star": false}'::jsonb,
          blank || '{"chip": "12:40 p. m.", "topic": "Almuerzo"}'::jsonb,
          -- The afternoon: the plan, in five steps
          blank || '{"kind": "day", "tone": "pink", "chip": "Tarde · 1:45 p. m.", "topic": "Ahora te toca a ti. Este es tu plan para lograrlo.", "text": "1:45 p. m. a 7:00 p. m.", "takeaway": "Tus números, tu esencia, cómo atraer clientas y hacer que vuelvan: tu plan para ganar más y convertirte en la dueña de tu negocio."}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Alejandro%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Alejandro Salinas", "topic": "Ordena tu plata: precios, costos y cuánto te queda de verdad", "text": "Sal sabiendo cuánto cobrar, cuánto gastas y cuánto te queda, con herramientas sencillas que puedes usar desde mañana.", "photoUrl": "/imparables/salinas.jpg"}'::jsonb)
            || '{"chip": "1:45 p. m.", "label": "Paso 1 · Tus números", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Karen%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Karen Pinzón", "topic": "Tu esencia es tu marca: deja de copiar y crea tu sello", "text": "Descubre lo que te hace única y conviértelo en una marca que tus clientas reconozcan y busquen.", "photoUrl": "/imparables/karen.jpg"}'::jsonb)
            || '{"chip": "2:50 p. m.", "label": "Paso 2 · Tu esencia", "star": false}'::jsonb,
          blank || '{"chip": "3:50 p. m.", "topic": "Pausa activa"}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Fabi%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Fabi Pinillo Martínez", "topic": "Agenda llena: estrategias y contenido que traen clientas", "text": "Del primer mensaje a la cita confirmada: qué publicar y cómo responder.", "photoUrl": "/imparables/fabi.jpg"}'::jsonb)
            || '{"chip": "4:05 p. m.", "label": "Paso 3 · Atraer", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Juan%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Juan Tenorio", "topic": "Clientas que vuelven: cómo hacer que te elijan, regresen y te recomienden", "text": "Servicio y experiencia para que cada clienta gaste más en cada visita.", "photoUrl": "/imparables/juan.jpg"}'::jsonb)
            || '{"chip": "5:10 p. m.", "label": "Paso 4 · Retener", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'instructor' ILIKE 'Oskar%' ORDER BY k LIMIT 1),
                   blank || '{"instructor": "Oskar Garzón", "topic": "Piensa en grande y hazte ver", "text": "Visión, redes y la actitud para sobresalir. Cierre del congreso y tu ruta final.", "photoUrl": "/imparables/oskar.jpg"}'::jsonb)
            || '{"chip": "6:15 p. m.", "label": "Paso 5 · Tu ruta", "star": false}'::jsonb,
          coalesce((SELECT r FROM jsonb_array_elements(old) WITH ORDINALITY AS t(r, k) WHERE r ->> 'kind' = 'session' AND r ->> 'topic' ILIKE ANY (ARRAY['Ceremonia de cierre%', 'Agradecimientos%']) ORDER BY k LIMIT 1),
                   blank || jsonb_build_object('photoUrl', heidy))
            || '{"chip": "6:45 p. m.", "topic": "Cierre y sorteo", "text": "Con Heidy Aristizábal", "label": "", "star": false}'::jsonb
        ));
      END IF;

      -- Under «Agenda», the day and its hours (where it has no line of its own yet)
      IF b ->> 'type' = 'heading' AND b ->> 'eyebrow' = 'Agenda' AND coalesce(b ->> 'intro', '') = '' THEN
        b := b || '{"intro": "Domingo 27 de junio · 8:00 a. m. a 7:00 p. m. · hora Colombia"}'::jsonb;
      END IF;

      -- The panel's card: its new hour, no day (there is only one)
      IF b ->> 'type' = 'card' AND b ->> 'eyebrow' = 'Panel · Domingo 27 · 10:25 a. m.' THEN
        b := b || '{"eyebrow": "Panel · 9:20 a. m."}'::jsonb;
      END IF;

      -- What the ticket brings
      IF b ->> 'type' = 'points' AND jsonb_typeof(b -> 'items') = 'array' AND jsonb_array_length(b -> 'items') > 0 THEN
        b := jsonb_set(b, '{items}', (
          SELECT jsonb_agg(
            CASE
              WHEN it ->> 'title' = '2 días en vivo' THEN it || '{"title": "Un día completo en vivo", "text": "9 conferencistas y un panel, de 8 a. m. a 7 p. m., desde tu celular."}'::jsonb
              WHEN it ->> 'title' = 'Tu hoja de ruta imparable' THEN it || '{"text": "Un cuaderno imprimible que llenas durante las charlas. Sales con tu plan de 90 días."}'::jsonb
              WHEN it ->> 'title' = 'Repetición por 30 días' THEN it || '{"text": "Lo que te pierdas lo ves cuando puedas, durante 30 días."}'::jsonb
              ELSE it
            END
            ORDER BY k)
          FROM jsonb_array_elements(b -> 'items') WITH ORDINALITY AS t(it, k)));
      END IF;

      -- The questions on the page (the first list shown): the recordings' answer
      -- second, the hours' third — each added if it isn't there — the rest as they were.
      IF NOT faq_done AND b ->> 'type' = 'faq' AND NOT coalesce((b ->> 'hidden')::boolean, false) AND jsonb_typeof(b -> 'items') = 'array' THEN
        items := b -> 'items';
        live := NULL;
        hrs := NULL;
        SELECT value INTO live FROM jsonb_array_elements(items) WITH ORDINALITY AS t(value, k) WHERE value ->> 'question' ILIKE '%verlo en vivo%' ORDER BY k LIMIT 1;
        SELECT value INTO hrs FROM jsonb_array_elements(items) WITH ORDINALITY AS t(value, k) WHERE value ->> 'question' ILIKE '%horario%' ORDER BY k LIMIT 1;
        SELECT coalesce(jsonb_agg(value ORDER BY k), '[]'::jsonb) INTO others
          FROM jsonb_array_elements(items) WITH ORDINALITY AS t(value, k)
          WHERE NOT (coalesce(value ->> 'question', '') ILIKE '%verlo en vivo%' OR coalesce(value ->> 'question', '') ILIKE '%horario%');
        live := coalesce(live, '{"question": "¿Y si no puedo verlo en vivo?"}'::jsonb) || jsonb_build_object('answer', live_a);
        hrs := coalesce(hrs, '{"question": "¿Cuál es el horario?"}'::jsonb) || jsonb_build_object('answer', hours_a);
        b := jsonb_set(b, '{items}',
          CASE WHEN jsonb_array_length(others) = 0 THEN jsonb_build_array(live, hrs)
               ELSE jsonb_build_array(others -> 0, live, hrs) || (others - 0) END);
        faq_done := true;
      END IF;

      result := result || jsonb_build_array(b);
    END LOOP;
    UPDATE "Event" SET "landingBlocks" = result WHERE "id" = ev."id";
  END LOOP;
END $$;

-- The hidden texts that still said two days, for the day they're shown again.
UPDATE "Event"
SET "landingBlocks" = replace(replace("landingBlocks"::text,
    to_jsonb('Lo que vas a resolver en estos dos días'::text)::text, to_jsonb('Lo que vas a resolver en un solo día'::text)::text),
    to_jsonb('Son dos días, de 9:00 a. m. a 2:00 p. m., desde tu celular.'::text)::text, to_jsonb('Es un solo día, de 8:00 a. m. a 7:00 p. m., desde tu celular.'::text)::text)::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
