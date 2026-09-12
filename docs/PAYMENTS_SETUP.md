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
# Wompi — dashboard.wompi.co → tu comercio → API Keys
WOMPI_PUBLIC_KEY=pub_test_...       # pub_prod_... en producción
WOMPI_PRIVATE_KEY=prv_test_...      # prv_prod_... en producción (no se usa hoy, reservada)
WOMPI_INTEGRITY_SECRET=...          # dashboard.wompi.co → API Keys → "Secreto de integridad"
WOMPI_EVENTS_SECRET=...             # dashboard.wompi.co → API Keys → "Secreto de eventos" (DISTINTO del de integridad)
WOMPI_ENV=sandbox                   # "sandbox" mientras pruebas, "production" cuando ya cobres de verdad

# Zoom — marketplace.zoom.us → Develop → Build App → "Server-to-Server OAuth"
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_WEBHOOK_SECRET_TOKEN=...        # de la MISMA app, pestaña Feature -> Event Subscriptions — ver esa sección más abajo. Distinto de ZOOM_CLIENT_SECRET.

# Solo si este comercio de Wompi es compartido con otra integración (ver
# "Cuenta compartida con Shopify" más abajo) — la URL que HOY está puesta
# en "URL de Eventos" del dashboard de Wompi, ANTES de reemplazarla por la
# nuestra. Cópiala primero, no la pierdas.
WOMPI_SHOPIFY_RELAY_URL=https://wompi-event-shopify.conexa.ai/api/v1/shopify/webhooks/...
```

## Wompi — paso a paso

1. Crea una cuenta en Wompi (comercio.wompi.co) si no la tienes — el
   negocio ya la tiene según lo hablado, solo hace falta entrar a
   **Configuración → API Keys** y copiar las 4 llaves de arriba. Empieza
   siempre con las de **sandbox** (`pub_test_`/`prv_test_`) — puedes
   probar todo el flujo completo (incluyendo tarjetas de prueba que Wompi
   documenta) sin mover dinero real.
2. **Configuración → Webhooks (Eventos)** → pega la URL:
   `https://<tu-dominio>/api/webhooks/wompi`. Esto es lo que confirma un
   pago cuando el cliente ya no está mirando la pantalla (ver
   `lib/payments/confirmRegistrationPayment.ts` — hay un SEGUNDO camino de
   confirmación, el que corre cuando el cliente vuelve a `/[evento]/pago`,
   así que el registro no depende SOLO de que este webhook llegue a
   tiempo).
3. Cuando ya quieras cobrar de verdad: repite el proceso con las llaves
   `pub_prod_`/`prv_prod_`, cambia `WOMPI_ENV=production`, y verifica que
   el webhook de Eventos también esté configurado en el modo producción
   del dashboard (Wompi separa sandbox/producción como dos "comercios"
   distintos, cada uno con su propia config de webhooks).

## Cuenta compartida con Shopify — por qué el webhook hace un "relevo"

Este comercio de Wompi (el mismo `pago a H la Cosedora` que verás en el
checkout — Wompi no deja personalizar ese nombre por transacción) ya
tenía su "URL de Eventos" apuntando a una integración con Shopify
(`wompi-event-shopify.conexa.ai/...`) antes de que Nail Fest la
necesitara también. Wompi solo permite UNA URL de eventos por comercio —
no una lista — así que no se puede simplemente agregar la nuestra al
lado.

La solución (ver `lib/payments/wompi.ts`'s `relayToOtherIntegration` y
`/api/webhooks/wompi`'s propio comentario): esta ruta ahora es la ÚNICA
URL de eventos del comercio. Cada evento que le llega se revisa contra
las propias transacciones de Nail Fest (`Payment` en la base de datos);
si es nuestro, se procesa normal; si NO es nuestro, se reenvía intacto a
la URL que antes tenía Shopify — que sigue recibiendo exactamente lo
mismo que recibía antes, sin enterarse de que pasó por acá.

**Antes de cambiar nada en el dashboard de Wompi:**
1. Copia el valor ACTUAL de "URL de Eventos" (Configuración → Webhooks)
   → guárdalo en Vercel como `WOMPI_SHOPIFY_RELAY_URL`.
2. Espera a que ese cambio esté desplegado (mismo motivo que con Zoom:
   la variable nueva necesita un redeploy).
3. Solo entonces, en el dashboard de Wompi, reemplaza "URL de Eventos"
   por `https://<tu-dominio>/api/webhooks/wompi`.

**El riesgo real que esto acepta**: si el servidor de Nail Fest tiene un
problema, la integración de Shopify se queda sin su aviso de pagos
también, hasta que se resuelva — antes, cada una era independiente. Es
un riesgo aceptado a propósito, no un descuido — si algún día prefieres
eliminarlo del todo, la alternativa es un comercio de Wompi separado
exclusivamente para Nail Fest (más trámite, cero riesgo compartido).

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
  ese disparador (con una variable mapeada a `ZOOM_LINK`, ver
  `docs/WHATSAPP_SETUP.md`) antes de que este envío funcione; sin eso,
  el recordatorio simplemente no sale (no es un error, solo no está
  configurado todavía).
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

1. Con `WOMPI_ENV=sandbox`, crea un evento virtual de prueba con un
   TicketType a precio bajo (ej. $1.000) y regístrate tú mismo — Wompi
   documenta tarjetas de prueba que siempre aprueban/rechazan a propósito.
2. Confirma que: (a) `/[evento]/pago` muestra "¡Pago confirmado!", (b) te
   llega el correo con el link de Zoom (si configuraste uno), (c) en
   `/admin/events/[id]` la persona aparece como CONFIRMED, no
   PENDING_PAYMENT.
3. Repite con una tarjeta de prueba que Wompi rechaza — confirma que
   `/[evento]/pago` muestra el mensaje de rechazo y que NO te llega
   ningún correo de ticket.
4. Solo entonces cambia a `WOMPI_ENV=production` con las llaves de
   producción.

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
