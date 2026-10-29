# Congreso virtual — Wompi y PayPal (pagos) + Zoom (acceso)

**Status: construido, no verificado todavía contra una cuenta real.** Esto
se construyó sin credenciales reales de Wompi ni de Zoom — el formato de
la firma de integridad del checkout y la verificación del checksum del
webhook siguen exactamente la documentación pública de Wompi
(docs.wompi.co); el registro de participantes de Zoom sigue la
documentación pública de Zoom (developers.zoom.us) para Server-to-Server
OAuth. Lo que **no** se ha probado todavía: una transacción real llegando
a Wompi y volviendo, y una llamada real a la API de Zoom devolviendo un
`join_url`. Antes de cobrarle a un asistente real, sigue "Primera prueba
real" al final de este documento. Lo mismo vale para PayPal (2026-10-29):
está probado contra su API simulada (Orders v2, webhooks y reembolsos tal
como los documenta PayPal); la primera prueba real es la "Compra de prueba
en sandbox" de su sección.

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

# PayPal (pagos en dólares) — cinco variables, un juego para sandbox y otro
# para live: ver "PayPal (pagos en dólares)" más abajo.
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

## Checkout de una página (Manicuristas Imparables) y códigos de descuento

Desde el 2026-10-29 los botones de la landing de Imparables llevan a
`/[evento]/checkout`: tus datos (primero el país, que preselecciona el tipo
de documento, el indicativo del celular y la moneda; luego nombre,
documento —y razón social si es empresa—, correo y celular), perfil y pago
en una sola página, con el evento y el código de descuento al lado (o
plegados arriba en el celular). La tarifa de la etapa («hasta el …, ¡luego
sube!») va en pequeño debajo del botón de pagar. Al tocar «Pagar» (en
pesos; en dólares, ver "PayPal" más abajo):

1. `/api/register` crea la inscripción «pendiente de pago» y el pago
   (`NF-<id del pago>`), con el descuento calculado ahí mismo —nunca el que
   manda el navegador— y devuelve los datos firmados para la ventana de Wompi.
2. Se abre la ventana de Wompi (WidgetCheckout) encima de la página; si no
   carga, la página de pago de Wompi. Al terminar, Wompi lleva a
   `/[evento]/pago`, que confirma como siempre.
3. En «¡Pago confirmado!» se pregunta (opcional) el Instagram/TikTok.

Los códigos se crean en `/admin/events/[id]/descuentos`: porcentaje
(1–95) o monto fijo en pesos, para cualquier entrada o una sola, con
vencimiento y máximo de usos opcionales. Un uso cuenta solo cuando el pago
se aprueba, y ningún código deja el total por debajo de $1.500 (el mínimo
de Wompi). Los demás eventos siguen con su formulario de siempre.

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

## PayPal (pagos en dólares)

Desde el 2026-10-29, una entrada con **precio en USD** (Editar evento →
Entradas → «Precio en USD (opcional, para pagar con PayPal)») se puede
pagar en dólares con PayPal en el checkout de una página. En «Pago»
aparecen dos opciones, «Pesos · Wompi» y «Dólares · PayPal», cada una con
su total: el país donde vive la persona decide con cuál arranca (fuera de
Colombia, dólares), pero siempre la puede cambiar —alguien de fuera que
prefiera pagar en pesos elige Wompi, y una vez que la persona elige, el
país ya no la cambia—. Sin precio en USD, o sin PayPal configurado, el
checkout queda solo con Wompi. Los demás eventos (su formulario de
siempre) siguen solo en pesos.

Cómo funciona (Orders v2, con el SDK de JavaScript de PayPal):

1. Al tocar el botón de PayPal, el checkout revisa el formulario y llama
   a `/api/register` con `currency: "USD"`: crea la inscripción «pendiente
   de pago» y un pago PayPal en USD (`NF-<id del pago>`), con el descuento
   calculado ahí. En dólares solo aplican los códigos de **porcentaje**;
   los de monto fijo son en pesos («Ese código solo aplica pagando en
   pesos»). Mínimo: US$1.
2. `POST /api/paypal/orders` crea la orden con el monto de ese pago
   —nunca uno del navegador—, con `custom_id` e `invoice_id` = `NF-…`.
3. La persona aprueba en la ventana de PayPal (cuenta PayPal o tarjeta) y
   `POST /api/paypal/orders/<orderId>/capture` captura en el servidor. Si
   la captura queda COMPLETED por el monto, la moneda y la referencia del
   pago, confirma: la misma confirmación idempotente de Wompi (correo,
   Zoom, todo igual). Si PayPal rechaza la tarjeta, su ventana se abre otra
   vez para pagar de otra forma, con la misma orden.
4. La persona llega a `/[evento]/pago?…&paypal=<orderId>`, que vuelve a
   leer la orden en PayPal y muestra «¡Pago confirmado!».
5. El webhook `POST /api/paypal/events` es el respaldo (pestaña cerrada,
   pagos que PayPal deja pendientes). Verifica cada evento con PayPal
   (`/v1/notifications/verify-webhook-signature` y `PAYPAL_WEBHOOK_ID`; si
   no pasa, responde 401) y vuelve a consultar a PayPal antes de actuar:
   - `PAYMENT.CAPTURE.COMPLETED` confirma. Si la captura ya había
     confirmado, no pasa nada: nunca se confirma dos veces.
   - `PAYMENT.CAPTURE.DENIED` marca el pago rechazado.
   - `PAYMENT.CAPTURE.REFUNDED`: reembolso **total** → el pago queda
     REFUNDED, la inscripción se cancela y se cancela su registro en Zoom
     (si el evento tiene reunión); reembolso **parcial** → solo se anota lo
     reembolsado y la persona conserva su cupo.
   - Un evento que no es de Nail Fest (sin `NF-`): 200, sin hacer nada.
   - PayPal o la base de datos fallando en ese momento: 500, y PayPal lo
     reintenta.

Las credenciales nunca llegan al navegador: los botones usan solo el
client id, que es público.

### Las variables: un juego para sandbox, otro para live

PayPal separa sandbox y live como dos apps distintas (developer.paypal.com
→ **Apps & Credentials**, con el interruptor Sandbox/Live arriba), cada
una con su Client ID, su Secret y su propio webhook. **Las cinco variables
tienen que salir de la misma app.**

Sandbox (pruebas, sin dinero real):

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<Client ID de la app de Sandbox>
PAYPAL_CLIENT_SECRET=<Secret de la app de Sandbox>
PAYPAL_WEBHOOK_ID=<Webhook ID del webhook de la app de Sandbox>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<el mismo Client ID de Sandbox>
```

Live (cobro real):

```
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=<Client ID de la app de Live>
PAYPAL_CLIENT_SECRET=<Secret de la app de Live>
PAYPAL_WEBHOOK_ID=<Webhook ID del webhook de la app de Live>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<el mismo Client ID de Live>
```

`PAYPAL_ENV` decide todo lo del servidor: la URL del API
(`https://api-m.sandbox.paypal.com` o `https://api-m.paypal.com`) y, con
ella, la creación y la captura de órdenes, la lectura de órdenes y
reembolsos y la verificación de cada webhook. Vacía cuenta como sandbox.
Los botones del navegador cargan el mismo SDK en los dos casos: el client
id decide si corren en sandbox o en live. Si `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
no es igual a `PAYPAL_CLIENT_ID` (un cambio a medias), el checkout esconde
PayPal y deja un aviso en los logs, en vez de mostrar un botón que no
podría cobrar. Mientras esté en sandbox, el checkout lo dice: «Modo de
pruebas (sandbox)».

### Crear la app y el webhook (una vez por entorno)

1. developer.paypal.com → entra con la cuenta PayPal Business → **Apps &
   Credentials** → interruptor en **Sandbox** → **Create App** (tipo
   Merchant). Copia el Client ID y el Secret.
2. Dentro de la app → **Webhooks** → **Add Webhook**: URL
   `https://nailfest.lat/api/paypal/events`, eventos «Payment capture
   completed», «Payment capture denied» y «Payment capture refunded».
   Guarda y copia el **Webhook ID**.
3. Lo mismo con el interruptor en **Live** cuando vayas a cobrar de verdad
   (la app de Live pide la cuenta Business verificada).

### Compra de prueba en sandbox

1. En Vercel → Settings → Environment Variables (Production), carga el
   juego de **sandbox** y haz **Redeploy**. Vercel solo aplica cambios de
   variables en un deploy nuevo, y `NEXT_PUBLIC_PAYPAL_CLIENT_ID` además
   queda dentro del build.
2. Para que nadie real vea PayPal mientras pruebas: en el admin, «Copiar a
   nuevo evento» sobre Imparables (la copia trae las entradas y el diseño,
   no la reunión de Zoom), publica la copia y, en sus Entradas, ponle
   «Precio en USD» a la entrada que está a la venta hoy (ej. 1.00). La
   entrada del evento real se queda sin precio en USD: ahí nadie ve PayPal.
3. developer.paypal.com → **Testing Tools → Sandbox Accounts**: PayPal ya
   trae una cuenta **Personal** (la compradora) y una **Business** (la
   tuya). En la Personal → el ícono de la columna «Manage Accounts» →
   **View/Edit Account** → pestaña Profile: copia el correo y la contraseña
   («System-generated password»).
4. Abre `https://nailfest.lat/<slug de la copia>/checkout`, elige un país
   de fuera de Colombia (o «Dólares · PayPal»), llena el formulario con tu
   correo y toca el botón de PayPal. Entra con la cuenta Personal de
   sandbox y paga.
5. Debe pasar: llegas a `/<slug>/pago` con «¡Pago confirmado!», te llega el
   correo de confirmación, y en el admin la inscripción queda confirmada.
   En el panel **Webhooks Events** de sandbox (cómo llegar:
   https://developer.paypal.com/api/rest/webhooks/events-dashboard/), con la
   app elegida, aparece `PAYMENT.CAPTURE.COMPLETED` recibido (check verde),
   y la persona sigue con un solo pago confirmado: captura y webhook no
   confirman dos veces. Desde ahí también se puede reenviar un evento.
6. Reembolso: entra a https://www.sandbox.paypal.com con la cuenta
   **Business** de sandbox → Activity (Actividad) → ese pago → Refund
   (Reembolsar). Uno **parcial** deja la inscripción confirmada; uno
   **total** la cancela (en Webhooks Events llega
   `PAYMENT.CAPTURE.REFUNDED`). Para probar también la cancelación en Zoom,
   pon antes un ID de reunión en la copia.
7. Si algo falla: Vercel → Logs, buscando `paypal`.

### Pasar de sandbox a live

1. Crea la app y el webhook en **Live** (arriba).
2. En Vercel cambia **las cinco** variables al juego de live (con
   `PAYPAL_ENV=live`) y haz **Redeploy**.
3. Ponle «Precio en USD» a las entradas reales de Imparables (cada etapa
   tiene el suyo).
4. Vuelve a poner en borrador la copia de prueba. No se puede borrar,
   porque ya tiene una inscripción.
5. Opcional: una compra real pequeña con tu propia cuenta PayPal, y
   reembolsarla desde paypal.com.

Para volver a sandbox es el mismo paso al revés: las cinco variables del
juego de sandbox y Redeploy.

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
   `report:read:list_meeting_polls:admin`. Para que un reembolso total de
   PayPal también saque a la persona de la reunión (su link deja de
   funcionar), agrega `meeting:update:registrant_status:admin` (o
   `webinar:update:registrant_status:admin` si usas Webinars); sin ese
   scope el reembolso igual cancela la inscripción en Nail Fest, solo que
   Zoom no se entera (queda en los logs como `zoom: cancelRegistrant
   failed`). Nunca la variante `:master` de ninguno de estos — esa es solo
   para cuentas con sub-cuentas.
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

- **Precio en USD solo en el checkout de una página** (Imparables) — los
  demás eventos cobran solo en pesos con su formulario de siempre.
- **Un reembolso no bloquea la entrada en la puerta** — un reembolso total
  de PayPal cancela la inscripción y su registro en Zoom, pero el escáner
  de la puerta (`lib/scan.ts`) no revisa todavía si la inscripción fue
  cancelada. Para el congreso virtual no importa; para un evento
  presencial pago con PayPal habría que agregarlo.
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
