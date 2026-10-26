-- Manicuristas Imparables (2026-10-26, the team's document): Karen joins
-- with a talk of her own on Monday; Maria Carolina (Maris) moves from the
-- speakers to the panel, which moves to Sunday at 10:25 a. m. as its star
-- talk (a small tag, no box). Sunday tells the stories; Monday is a plan in
-- five steps, each talk tagged with its step (Alejandro: the money; Karen:
-- her essence; Fabi: attracting clients; Juan: keeping them; Oskar closes the
-- congress in 30 minutes). Every talk has its new title and subtitle, every
-- card its new line; the speakers' section is «Las que te lo van a contar.»;
-- the results go after the program, with who gives each one, and nothing on
-- the page speaks of artificial intelligence.
-- Only on pages that still have Maris among the speakers (the version before
-- this one), keeping the photos the team uploaded: each speaker keeps hers,
-- Maris takes hers to the panel and the host's lines keep the host's.
DO $mig$
DECLARE
  new_speakers jsonb := $j$[{"name": "Jimena Montalban", "handle": "@jimenanails", "tag": "La manicurista que se convirtió en empresaria. Fundadora de JimenaNails, 10 años construyendo su marca y a sí misma.", "photoUrl": "/imparables/jimena.jpg", "tone": "pink"}, {"name": "Paula Chacón", "handle": "@soypauc_tuprofe", "tag": "De la mesa a CEO de El Imperio de las Uñas, una cadena de 7 spas. Los miedos que tuvo que vencer: cobrar sin culpa y armar un equipo.", "photoUrl": "/imparables/pau.jpg", "tone": "pink"}, {"name": "Cristina Sierra", "handle": "@cris_sierra17", "tag": "Fundadora de Cristina Sierra Nail Experts: 10 sedes y más de un millón de seguidores. Resiliencia: cómo levantarse de lo más duro.", "photoUrl": "/imparables/cris.jpg", "tone": "pink"}, {"name": "Alejandro Salinas", "handle": "@salinas.beautybusiness", "tag": "Asesor de negocios de belleza, 15 años de experiencia en administración, finanzas y marketing. Precios, costos y cuánto te queda de verdad.", "photoUrl": "/imparables/salinas.jpg", "tone": "pink"}, {"name": "Karen", "handle": "@karenw.trainer", "tag": "Creadora del Método Esencia. Tu esencia es tu marca: deja de copiar y crea tu sello.", "photoUrl": "", "tone": "pink"}, {"name": "Fabi Pinillo Martínez", "handle": "@fabiversatill", "tag": "Nail artist y estratega de centros de belleza. La técnica ya no es suficiente.", "photoUrl": "/imparables/fabi.jpg", "tone": "pink"}, {"name": "Juan Tenorio", "handle": "@don.juantenorio", "tag": "Asesor de negocios de belleza, con más de 500 salones y barberías transformados. Clientas que vuelven y te recomiendan.", "photoUrl": "/imparables/juan.jpg", "tone": "pink"}, {"name": "Oskar Garzón", "handle": "@oskarivanquebelleza", "tag": "Empresario y creador de marca. Cierra el congreso: visión, actitud y tu ruta final.", "photoUrl": "/imparables/oskar.jpg", "tone": "pink"}]$j$::jsonb;
  maris jsonb := $j${"name": "Maria Carolina Sebastia Sandoval", "handle": "@maris_nails_oficial", "tag": "De empezar desde nada a formar educadoras en toda Chile. En vivo desde Chile.", "photoUrl": "/imparables/maris.jpg", "tone": "pink"}$j$::jsonb;
  new_rows jsonb := $j$[{"kind": "day", "chip": "Domingo 27 de junio", "topic": "Lo lograron con los mismos miedos que tú. Ahora te cuentan cómo.", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "9:00 a. m. a 1:45 p. m.", "tone": "pink", "takeaway": "Cómo atravesaron las dificultades, tomaron riesgos y vencieron sus miedos para llegar donde están.", "label": "", "star": false}, {"kind": "session", "chip": "9:00 a. m.", "topic": "Bienvenida", "instructor": "", "photoUrl": "/imparables/heidy.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Con Heidy Aristizábal, maestra de ceremonias", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "9:15 a. m.", "topic": "Lo que nadie te cuenta de crecer", "instructor": "Jimena Montalban", "photoUrl": "/imparables/jimena.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Las decisiones y los riesgos que la llevaron de la mesa de manicure a una marca internacional.", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "10:15 a. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "10:25 a. m.", "topic": "Panel «El día que decidí cambiar»", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Cuatro historias reales de transformación", "tone": "teal", "takeaway": "", "label": "Charla estrella", "star": false}, {"kind": "session", "chip": "11:10 a. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "11:25 a. m.", "topic": "Créete el cuento: cobra lo que vales y deja de hacerlo todo sola", "instructor": "Paula Chacón", "photoUrl": "/imparables/pau.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Los miedos que tuvo que vencer: cobrar sin culpa, delegar y armar un equipo.", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "12:25 p. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "12:35 p. m.", "topic": "Lo que no te rompe te hace imparable", "instructor": "Cristina Sierra", "photoUrl": "/imparables/cris.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "La historia detrás de 10 sedes: resiliencia para levantarse de lo más duro.", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "1:35 p. m.", "topic": "Cierre del día y sorteo", "instructor": "", "photoUrl": "/imparables/heidy.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Con Heidy Aristizábal", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "day", "chip": "Lunes 28 de junio", "topic": "Ahora te toca a ti. Este es tu plan para lograrlo.", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "9:00 a. m. a 2:00 p. m.", "tone": "pink", "takeaway": "Tus números, tu esencia, cómo atraer clientas y hacer que vuelvan: tu plan para ganar más y convertirte en la dueña de tu negocio.", "label": "", "star": false}, {"kind": "session", "chip": "9:00 a. m.", "topic": "Repaso", "instructor": "", "photoUrl": "/imparables/heidy.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Con Heidy Aristizábal", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "9:05 a. m.", "topic": "Ordena tu plata: precios, costos y cuánto te queda de verdad", "instructor": "Alejandro Salinas", "photoUrl": "/imparables/salinas.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Sal sabiendo cuánto cobrar, cuánto gastas y cuánto te queda, con herramientas sencillas que puedes usar desde mañana.", "tone": "teal", "takeaway": "", "label": "Paso 1 · Tus números", "star": false}, {"kind": "session", "chip": "9:55 a. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "10:05 a. m.", "topic": "Tu esencia es tu marca: deja de copiar y crea tu sello", "instructor": "Karen", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Descubre lo que te hace única y conviértelo en una marca que tus clientas reconozcan y busquen.", "tone": "teal", "takeaway": "", "label": "Paso 2 · Tu esencia", "star": false}, {"kind": "session", "chip": "10:55 a. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "11:05 a. m.", "topic": "Agenda llena: estrategias y contenido que traen clientas", "instructor": "Fabi Pinillo Martínez", "photoUrl": "/imparables/fabi.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Del primer mensaje a la cita confirmada: qué publicar y cómo responder.", "tone": "teal", "takeaway": "", "label": "Paso 3 · Atraer", "star": false}, {"kind": "session", "chip": "11:55 a. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "12:05 p. m.", "topic": "Clientas que vuelven: cómo hacer que te elijan, regresen y te recomienden", "instructor": "Juan Tenorio", "photoUrl": "/imparables/juan.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Servicio y experiencia para que cada clienta gaste más en cada visita.", "tone": "teal", "takeaway": "", "label": "Paso 4 · Retener", "star": false}, {"kind": "session", "chip": "12:55 p. m.", "topic": "Pausa activa", "instructor": "", "photoUrl": "", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "", "tone": "teal", "takeaway": "", "label": "", "star": false}, {"kind": "session", "chip": "1:05 p. m.", "topic": "Piensa en grande y hazte ver", "instructor": "Oskar Garzón", "photoUrl": "/imparables/oskar.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Visión, redes y la actitud para sobresalir. Cierre del congreso y tu ruta final.", "tone": "teal", "takeaway": "", "label": "Paso 5 · Tu ruta", "star": false}, {"kind": "session", "chip": "1:35 p. m.", "topic": "Agradecimientos y anuncio de la próxima edición", "instructor": "", "photoUrl": "/imparables/heidy.jpg", "brand": "", "brandLogoUrl": "", "handles": "", "sponsored": false, "text": "Con Heidy Aristizábal", "tone": "teal", "takeaway": "", "label": "", "star": false}]$j$::jsonb;
  new_results jsonb := $j$[{"title": "Llena tu agenda sin depender del voz a voz", "text": "Contenido que atrae clientas, una marca con tu sello y clientas que vuelven y te recomiendan.", "who": "Karen, Fabi Pinillo Martínez y Juan Tenorio"}, {"title": "Cobra lo que vales, sin culpa", "text": "Cuánto cobrar, cuánto ahorrar y cómo hablar de plata con tus clientas.", "who": "Paula Chacón y Alejandro Salinas"}, {"title": "De la mesa a dueña de tu marca", "text": "Pasar de atender sola a tener salón, equipo o academia, y empezar de cero si te toca.", "who": "Jimena Montalban, Cristina Sierra y el panel"}]$j$::jsonb;
  caso text := $t$Maria Carolina empezó desde nada y hoy forma educadoras en Chile; la escuchas en el panel.$t$;
  ev record;
  arr jsonb[];
  n int;
  i int;
  sp int;
  pc int;
  ag int;
  rh int;
  old_items jsonb;
  speakers jsonb;
  maris_photo text;
  maris_item jsonb;
  host_photo text;
  rest jsonb[];
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" AS blocks FROM "Event" WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' LOOP
    arr := ARRAY(SELECT x.value FROM jsonb_array_elements(ev.blocks) WITH ORDINALITY AS x(value, k) ORDER BY x.k);
    n := coalesce(array_length(arr, 1), 0);
    sp := NULL;
    pc := NULL;
    ag := NULL;
    rh := NULL;
    FOR i IN 1..n LOOP
      CONTINUE WHEN jsonb_typeof(arr[i]) <> 'object';
      -- The panel: a card with no photo right before people.
      IF pc IS NULL AND i < n AND arr[i] ->> 'type' = 'card' AND coalesce(arr[i] ->> 'imageUrl', '') = '' AND arr[i + 1] ->> 'type' = 'people' THEN
        pc := i;
      END IF;
      -- The speakers: the first people that aren't the panel's.
      IF sp IS NULL AND arr[i] ->> 'type' = 'people'
         AND NOT (i > 1 AND arr[i - 1] ->> 'type' = 'card' AND coalesce(arr[i - 1] ->> 'imageUrl', '') = '') THEN
        sp := i;
      END IF;
      IF ag IS NULL AND arr[i] ->> 'type' = 'agenda' THEN
        ag := i;
      END IF;
      IF rh IS NULL AND i < n AND arr[i] ->> 'type' = 'heading' AND lower(btrim(coalesce(arr[i] ->> 'eyebrow', ''))) = 'resultados'
         AND arr[i + 1] ->> 'type' = 'slides' AND coalesce(arr[i + 1] ->> 'style', 'results') = 'results' THEN
        rh := i;
      END IF;
    END LOOP;

    -- Only the version before this one: Maris still among the speakers.
    CONTINUE WHEN sp IS NULL OR jsonb_typeof(arr[sp] -> 'items') IS DISTINCT FROM 'array';
    old_items := arr[sp] -> 'items';
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(old_items) x WHERE jsonb_typeof(x) = 'object' AND lower(x ->> 'handle') = '@maris_nails_oficial'
    );
    SELECT x ->> 'photoUrl' INTO maris_photo
      FROM jsonb_array_elements(old_items) x
      WHERE jsonb_typeof(x) = 'object' AND lower(x ->> 'handle') = '@maris_nails_oficial'
      LIMIT 1;

    -- The speakers: the eight cards in their order, each keeping the photo the team gave her.
    SELECT jsonb_agg(
             CASE WHEN m.o IS NULL THEN s.e
                  ELSE s.e || jsonb_build_object(
                    'photoUrl', CASE WHEN coalesce(m.o ->> 'photoUrl', '') <> '' THEN m.o ->> 'photoUrl' ELSE s.e ->> 'photoUrl' END,
                    'tone', coalesce(m.o -> 'tone', s.e -> 'tone'))
             END ORDER BY s.k)
      INTO speakers
      FROM jsonb_array_elements(new_speakers) WITH ORDINALITY AS s(e, k)
      LEFT JOIN LATERAL (
        SELECT x AS o FROM jsonb_array_elements(old_items) x
        WHERE jsonb_typeof(x) = 'object' AND lower(x ->> 'handle') = lower(s.e ->> 'handle')
        LIMIT 1
      ) m ON true;
    arr[sp] := jsonb_set(arr[sp], '{items}', speakers);
    IF sp > 1 AND arr[sp - 1] ->> 'type' = 'heading' THEN
      arr[sp - 1] := jsonb_set(arr[sp - 1], '{title}', to_jsonb($t$Las que te lo van a contar.$t$::text));
    END IF;

    -- The panel: on Sunday now, and Maris in the place of «La que volvió a empezar desde cero».
    IF pc IS NOT NULL THEN
      IF lower(coalesce(arr[pc] ->> 'eyebrow', '')) LIKE 'panel%' THEN
        arr[pc] := jsonb_set(arr[pc], '{eyebrow}', to_jsonb($t$Panel · Domingo 27 · 10:25 a. m.$t$::text));
      END IF;
      IF jsonb_typeof(arr[pc + 1] -> 'items') = 'array' THEN
        maris_item := maris || jsonb_build_object('photoUrl', coalesce(nullif(maris_photo, ''), maris ->> 'photoUrl'));
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements(arr[pc + 1] -> 'items') x
          WHERE jsonb_typeof(x) = 'object' AND btrim(coalesce(x ->> 'name', '')) = '' AND x ->> 'tag' = 'La que volvió a empezar desde cero'
        ) THEN
          arr[pc + 1] := jsonb_set(arr[pc + 1], '{items}', (
            SELECT jsonb_agg(
                     CASE WHEN jsonb_typeof(x.v) = 'object' AND btrim(coalesce(x.v ->> 'name', '')) = '' AND x.v ->> 'tag' = 'La que volvió a empezar desde cero'
                          THEN maris_item || jsonb_build_object('tone', coalesce(x.v -> 'tone', maris_item -> 'tone'))
                          ELSE x.v END ORDER BY x.k)
            FROM jsonb_array_elements(arr[pc + 1] -> 'items') WITH ORDINALITY AS x(v, k)));
        ELSE
          arr[pc + 1] := jsonb_set(arr[pc + 1], '{items}', (arr[pc + 1] -> 'items') || jsonb_build_array(maris_item));
        END IF;
      END IF;
    END IF;

    -- The program: Sunday's stories, Monday's five steps; each speaker's line
    -- with her photo, the host's with the host's.
    IF ag IS NOT NULL THEN
      host_photo := NULL;
      IF jsonb_typeof(arr[ag] -> 'rows') = 'array' THEN
        SELECT r ->> 'photoUrl' INTO host_photo
          FROM jsonb_array_elements(arr[ag] -> 'rows') r
          WHERE jsonb_typeof(r) = 'object' AND btrim(coalesce(r ->> 'instructor', '')) = '' AND coalesce(r ->> 'photoUrl', '') <> ''
          LIMIT 1;
      END IF;
      arr[ag] := jsonb_set(arr[ag], '{rows}', (
        SELECT jsonb_agg(
                 CASE WHEN btrim(r.v ->> 'instructor') <> ''
                        THEN r.v || jsonb_build_object('photoUrl', coalesce(
                          (SELECT x ->> 'photoUrl' FROM jsonb_array_elements(speakers) x WHERE x ->> 'name' = r.v ->> 'instructor' LIMIT 1),
                          r.v ->> 'photoUrl'))
                      WHEN coalesce(r.v ->> 'photoUrl', '') <> '' AND host_photo IS NOT NULL
                        THEN r.v || jsonb_build_object('photoUrl', host_photo)
                      ELSE r.v END ORDER BY r.k)
        FROM jsonb_array_elements(new_rows) WITH ORDINALITY AS r(v, k)));
    END IF;

    -- The results: who gives each one and nothing about AI; then, after the program.
    IF rh IS NOT NULL AND jsonb_typeof(arr[rh + 1] -> 'items') = 'array' THEN
      arr[rh + 1] := jsonb_set(arr[rh + 1], '{items}', (
        SELECT coalesce(jsonb_agg(
                 CASE WHEN m.u IS NULL OR jsonb_typeof(x.v) <> 'object' THEN x.v
                      ELSE x.v || jsonb_build_object(
                        'who', m.u ->> 'who',
                        'text', CASE WHEN coalesce(x.v ->> 'text', '') ~* '(inteligencia artificial|\mIA\M)' THEN m.u ->> 'text' ELSE x.v ->> 'text' END)
                 END ORDER BY x.k), '[]'::jsonb)
        FROM jsonb_array_elements(arr[rh + 1] -> 'items') WITH ORDINALITY AS x(v, k)
        LEFT JOIN LATERAL (SELECT u FROM jsonb_array_elements(new_results) u WHERE u ->> 'title' = x.v ->> 'title' LIMIT 1) m ON true));
      IF ag IS NOT NULL AND rh < ag THEN
        rest := arr[1:rh - 1] || arr[rh + 2:n];
        -- The program sits two places up once the results are out.
        arr := rest[1:ag - 2] || ARRAY[arr[rh], arr[rh + 1]] || rest[ag - 1:n - 2];
      END IF;
    END IF;

    -- «Mi caso es distinto»: Maria Carolina is heard on the panel.
    FOR i IN 1..coalesce(array_length(arr, 1), 0) LOOP
      IF arr[i] ->> 'type' = 'slides' AND arr[i] ->> 'style' = 'doubts' AND jsonb_typeof(arr[i] -> 'items') = 'array' THEN
        arr[i] := jsonb_set(arr[i], '{items}', (
          SELECT coalesce(jsonb_agg(
                   CASE WHEN x.v ->> 'title' = 'Mi caso es distinto.' AND x.v ->> 'note' = 'Maria Carolina empezó desde nada y hoy forma educadoras en Chile.'
                        THEN jsonb_set(x.v, '{note}', to_jsonb(caso))
                        ELSE x.v END ORDER BY x.k), '[]'::jsonb)
          FROM jsonb_array_elements(arr[i] -> 'items') WITH ORDINALITY AS x(v, k)));
      END IF;
    END LOOP;

    UPDATE "Event" SET "landingBlocks" = to_jsonb(arr) WHERE "id" = ev."id";
  END LOOP;
END
$mig$;
