# Congreso virtual — Wompi (pagos) + Zoom (acceso)

**Status: construido, no verificado todavía contra una cuenta real.** Esto
se construyó sin credenciales reales de Wompi ni de Zoom — el formato de
la firma de integridad del checkout y la verificación del checksum del
webhook siguen exactamente la documentación pública de Wompi
(docs.wompi.co); el registro de participantes de Zoom sigue la
documentación pública de Zoom (developers.zoom.us) para Server-to-Server
OAuth. Lo que **no** se ha probado todavía: una transacción real llegando
a Wompi y volviendo, y una llamada real a la API de Zoom devolviendo un
`join_url`. Antes de cobrarle a un asistente real, sigue "Primera prueba
real" al final de este documento.

## Variables de entorno necesarias

En Vercel (o `.env.local` para probar en tu máquina):

```
# Wompi — dashboard.wompi.co → tu comercio → API Keys. El MISMO comercio
# que usa marcolini.lat (ver "Cuenta compartida con Marcolini" más abajo).
WOMPI_PUBLIC_KEY=pub_test_...       # pub_prod_... en producción
WOMPI_PRIVATE_KEY=prv_test_...      # prv_prod_... en producción — con ella se consulta cada transacción antes de confirmar
WOMPI_INTEGRITY_SECRET=...          # dashboard.wompi.co → API Keys → "Secreto de integridad"
WOMPI_EVENTS_SECRET=...             # dashboard.wompi.co → API Keys → "Secreto de eventos" (DISTINTO del de integridad)
RELAY_SHARED_SECRET=...             # `openssl rand -hex 32` — el MISMO valor que Marcolini manda en x-relay-secret
# Sandbox o producción sale del prefijo de las llaves (_test_ / _prod_): WOMPI_ENV ya no se usa.

# Zoom — marketplace.zoom.us → Develop → Build App → "Server-to-Server OAuth"
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_WEBHOOK_SECRET_TOKEN=...        # de la MISMA app, pestaña Feature -> Event Subscriptions — ver esa sección más abajo. Distinto de ZOOM_CLIENT_SECRET.
```

## Wompi — paso a paso

1. Crea una cuenta en Wompi (comercio.wompi.co) si no la tienes — el
   negocio ya la tiene según lo hablado, solo hace falta entrar a
   **Configuración → API Keys** y copiar las 4 llaves de arriba. Empieza
   siempre con las de **sandbox** (`pub_test_`/`prv_test_`) — puedes
   probar todo el flujo completo (incluyendo tarjetas de prueba que Wompi
   documenta) sin mover dinero real.
2. **Eventos:** la "URL de Eventos" del comercio NO apunta a Nail Fest:
   apunta a Marcolini, que reenvía a `https://nailfest.lat/api/wompi/events`
   los eventos cuya referencia empieza por `NF-` (ver la sección
   siguiente). Es lo que confirma un pago cuando el cliente ya no está
   mirando la pantalla; hay un SEGUNDO camino de confirmación, el que corre
   cuando el cliente vuelve a `/[evento]/pago`, así que el registro no
   depende SOLO de que el evento llegue a tiempo. En los dos casos la
   transacción se consulta al API de Wompi con la llave privada antes de
   confirmar (ver `lib/payments/wompiEvents.ts` y
   `lib/payments/confirmRegistrationPayment.ts`).
3. Cuando ya quieras cobrar de verdad: cambia a las llaves
   `pub_prod_`/`prv_prod_` y a los secretos de producción (Wompi separa
   sandbox y producción como dos "comercios" distintos, cada uno con sus
   propias llaves y su propia configuración de eventos).

## Cuenta compartida con Marcolini — cómo llegan los eventos

Este comercio de Wompi (el mismo `pago a H la Cosedora` que verás en el
checkout — Wompi no deja personalizar ese nombre por transacción) lo
usan también marcolini.lat y una integración con Shopify (Conexa). Wompi
solo permite UNA "URL de Eventos" por comercio, y desde el 2026-10-29 esa
URL es la de Marcolini:

- Toda referencia que genera Nail Fest empieza por `NF-` (`NF-<id del
  pago>`, una por intento de pago).
- Marcolini recibe todos los eventos del comercio, le responde 200 a
  Wompi de inmediato y reenvía los `NF-` a
  `https://nailfest.lat/api/wompi/events` con el body intacto y el header
  `x-relay-secret` (= `RELAY_SHARED_SECRET`, el mismo valor en los dos
  proyectos). Si Nail Fest no responde 2xx, Marcolini reintenta hasta 4
  veces. Los eventos de Shopify también se los reenvía Marcolini: Nail
  Fest ya no reenvía nada.
- `/api/wompi/events` acepta el reenvío (header correcto y, además, el
  checksum de Wompi si `WOMPI_EVENTS_SECRET` está cargado) o un evento
  directo de Wompi (checksum); si no pasa ninguna, responde 401. Antes de
  confirmar, consulta la transacción al API de Wompi y confirma con lo
  que dice el API, no el body. Responde 500 si Wompi o la base de datos
  fallan en ese momento, para que Marcolini reintente.
- `/api/webhooks/wompi` (la URL de antes) sigue funcionando igual, por si
  algún evento llega directo de Wompi.

## Zoom — paso a paso

1. **marketplace.zoom.us** (con tu cuenta de Zoom, no la de un usuario
   cualquiera) → **Develop → Build App → Server-to-Server OAuth** (no
   "OAuth" normal — ese pide login de usuario, este autentica como la
   cuenta misma, que es lo que necesita un registro automático desde el
   servidor).
2. En **Scopes**, agrega `meeting:write:registrant:admin` (si vas a usar
   Reuniones normales) o `webinar:write:registrant:admin` (si vas a usar
   Webinars — el add-on pago de Zoom, necesario solo si esperas más
   asistentes de los que tu plan de Reuniones permite). Si además quieres
   asistencia real y resultados de encuestas (ver más abajo), agrega
   también `report:read:list_meeting_participants:admin` (funciona con
   plan Pro — la versión de "Dashboard" del mismo dato exige Business) y
   `report:read:list_meeting_polls:admin`. Nunca la variante `:master` de
   ninguno de estos — esa es solo para cuentas con sub-cuentas.
3. Copia Account ID, Client ID y Client Secret a las variables de arriba.
4. **En la Reunión/Webinar misma** (zoom.us, no el marketplace): actívale
   **Registration** y ponla en **Aprobación automática** — si queda en
   "Manual", la API de Zoom deja de devolver el `join_url` en la
   respuesta (solo se lo manda por correo directamente a esa persona,
   nunca a tu servidor) y el correo de confirmación de Nail Fest saldría
   sin el link de acceso.
5. En el evento (`/admin/events/[id]/edit` → Formato → Virtual/Híbrido →
   Acceso virtual), pega el ID numérico de esa Reunión/Webinar.

## Notificaciones adaptadas al formato del evento

Un evento VIRTUAL ya no manda el mismo correo/WhatsApp que uno presencial
("preséntala en la entrada" no aplica cuando no hay entrada física):

- **Correo** — tanto la plantilla por defecto como el editor de
  "Confirmación del evento" (`/admin/events/[id]/confirmation` y
  `/admin/settings/confirmation`) ya adaptan solo, según
  `Event.format`: un evento VIRTUAL no incluye el bloque de código QR
  (no hay puerta donde escanearlo); uno HÍBRIDO sí lo mantiene. Si ya
  tenías guardada la plantilla con el texto original ("Lugar: {{...}} —
  {{...}}"), se actualiza sola al usar los nuevos merge tags
  (`{{EVENTO_UBICACION_LINEA}}`, `{{EVENTO_ACCESO_VIRTUAL_BOTON}}`,
  `{{EVENTO_INSTRUCCION_ENTRADA}}`) — no hace falta volver a guardarla a
  mano. También puedes cambiar el **asunto** del correo ahora (antes
  estaba fijo en código) — mismo editor, campo "Asunto del correo",
  arriba del cuerpo.
- **El link personal de Zoom NO se manda en ningún lado al momento de
  inscribirse** (ni en el correo, ni por WhatsApp, ni en la landing de
  pago) — deliberado: alguien puede inscribirse meses antes del
  congreso, y ese link no debe quedar ahí sin usarse (y fácil de
  perder) todo ese tiempo. En cambio, se manda solo por **WhatsApp**,
  poco antes de que empiece el evento (`ZOOM_ACCESS_REMINDER_MINUTES_BEFORE`
  en `lib/registrationConfirmation.ts`, 30 minutos por defecto — cámbialo
  ahí si quieres otro tiempo). Ese envío usa la misma automatización de
  Automatizaciones, con su propio disparador **"Poco antes de un evento
  virtual"** — necesitas crear y hacer aprobar en Meta una plantilla para
  ese disparador (con una variable mapeada a `ZOOM_LINK`, o con un botón
  de acción cuyo enlace apunte a `/api/zoom-join/{{1}}` — ver
  `docs/WHATSAPP_SETUP.md` para las dos formas) antes de que este envío
  funcione; sin eso, el recordatorio simplemente no sale (no es un
  error, solo no está configurado todavía).
- **WhatsApp — "Cuando alguien se registra"** — a diferencia del correo,
  una plantilla de WhatsApp aprobada por Meta tiene el texto FIJO, así
  que no se puede adaptar sola. En **Automatizaciones**
  (`/admin/crm/whatsapp/automatizaciones`) este disparador acepta,
  además de la plantilla de siempre, una plantilla aparte solo para
  eventos VIRTUALES ("+ Usar una plantilla distinta para eventos
  virtuales") — necesitas crear y hacer aprobar esa segunda plantilla en
  Meta con el texto correcto antes de poder elegirla aquí. Sin
  configurarla, un evento virtual sigue usando la plantilla de siempre
  tal cual (nada cambia hasta que la agregues). Ver
  `docs/WHATSAPP_SETUP.md` para cómo mapear las variables de cualquiera
  de los dos disparadores.
- **Pedirlo por WhatsApp, o reenviarlo tú manualmente** — si alguien
  escribe pidiendo su link de acceso, el agente de IA de Bandeja (si
  está activo en esa conversación) lo detecta y lo manda solo, igual que
  ya hacía con el PDF de la entrada. También puedes mandarlo tú a mano
  desde `/admin/crm/whatsapp/bandeja` → abre la conversación → sección
  "Entradas" → botón "Enviar link de Zoom por WhatsApp" (solo aparece
  para inscripciones a eventos virtuales/híbridos). En ambos casos, si
  el link todavía no se había generado, se genera ahí mismo antes de
  enviarlo.
- **Verlo en el admin** — en `/admin/events/[id]/tickets` ("Entradas emitidas"), cada evento
  virtual/híbrido tiene una columna "Zoom" (Generado/Pendiente) en la
  tabla, y el detalle de cada inscripción muestra el link completo (con
  botón "Copiar") o, si todavía no existe, un botón "Generar ahora" para
  reintentarlo a mano.
- **Incluirlo en un "Correo del evento"** — el editor de
  `/admin/events/[id]/broadcasts` (para eventos virtuales/híbridos) tiene
  un botón "Insertar link personal de Zoom" que agrega `{{ZOOM_LINK}}` —
  cada destinatario recibe su propio link real al enviarse. Pensado para
  un correo que mandes cerca del evento (el mismo día, o programado
  "antes de que empiece"): usarlo en un correo con mucha anticipación
  contradice la razón de ser del recordatorio automático.

## Asistencia en tiempo real (Event Subscriptions) — opcional, un paso más

Esto es lo que llena el panel **"En vivo (Zoom)"** dentro de cada evento
virtual/híbrido en el admin — quién está conectado en este momento
mientras el congreso está pasando. Es un paso APARTE de los Scopes de
arriba, y el orden importa: la URL del webhook tiene que estar realmente
desplegada y funcionando ANTES de pegarla en Zoom, porque Zoom la
verifica al instante en cuanto la guardas.

1. En la misma app de Zoom, pestaña **Feature** → activa **"Event
   Subscriptions"**.
2. Agrega la URL: `https://<tu-dominio>/api/webhooks/zoom`.
3. Marca los eventos `meeting.participant_joined` y
   `meeting.participant_left`.
4. Zoom te muestra un **Secret Token** al guardar — cópialo a Vercel como
   `ZOOM_WEBHOOK_SECRET_TOKEN` (distinto del Client Secret de más arriba).
5. Al guardar la URL, Zoom manda una verificación automática — si el
   despliegue con este código ya está en producción, pasa sola; si no,
   Zoom la va a rechazar y toca reintentar después de desplegar.

## Primera prueba real

Antes de vender la primera entrada real:

1. Con las llaves de sandbox (`pub_test_`/`prv_test_`), crea un evento virtual de prueba con un
   TicketType a precio bajo (ej. $1.000) y regístrate tú mismo — Wompi
   documenta tarjetas de prueba que siempre aprueban/rechazan a propósito.
2. Confirma que: (a) `/[evento]/pago` muestra "¡Pago confirmado!", (b) te
   llega el correo con el link de Zoom (si configuraste uno), (c) en
   `/admin/events/[id]` la persona aparece como CONFIRMED, no
   PENDING_PAYMENT.
3. Repite con una tarjeta de prueba que Wompi rechaza — confirma que
   `/[evento]/pago` muestra el mensaje de rechazo y que NO te llega
   ningún correo de ticket.
4. Solo entonces cambia a las llaves de producción.

## Lo que falta / limitaciones conocidas de esta primera versión

- **PayPal no está construido todavía** — el modelo de datos (`Payment.provider`)
  ya lo contempla, pero solo Wompi tiene una implementación real hoy.
- **Un `PENDING_PAYMENT` abandonado nunca expira solo** — si alguien abre
  el checkout de Wompi y nunca paga, ese registro se queda en
  `PENDING_PAYMENT` indefinidamente (no bloquea nada — un TicketType
  paga no cuenta cupo vendido hasta que el pago aprueba — pero ensucia el
  reporte). Un cron que cancele intentos viejos es un buen próximo paso,
  no construido en esta ronda.
- **Zoom Fase 1, no Fase 2** — el link de Zoom es personal pero no
  de un solo uso real; ver la conversación del chat sobre por qué y
  cuál sería el Fase 2 (una sala propia con token firmado).
- **El recordatorio de acceso a Zoom no se reprograma si editas la
  fecha del evento** — se agenda (vía QStash) en el momento en que la
  persona se confirma, para la fecha de inicio que el evento tenía EN
  ESE MOMENTO. Si después cambias `Event.startsAt` en Editar evento, los
  recordatorios ya agendados no se mueven — seguirían saliendo a la hora
  original. Un mecanismo para cancelar/reprogramar esos envíos al editar
  el evento es un buen próximo paso, no construido en esta ronda.
- **Resultados de encuestas de Zoom — todavía NO construido.** El scope
  (`report:read:list_meeting_polls:admin`) está documentado arriba y se
  puede agregar desde ya, pero la llamada real a la API que trae esos
  resultados y los guarda en algún lado no existe todavía en el código —
  quedó pendiente para una próxima ronda.
- **El panel "En vivo (Zoom)" depende 100% de que Event Subscriptions
  esté bien configurado** (ver esa sección arriba) — sin eso, la página
  simplemente no tiene datos que mostrar, no es un error, solo se ve
  vacía.
