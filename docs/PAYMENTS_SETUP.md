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

## Zoom — paso a paso

1. **marketplace.zoom.us** (con tu cuenta de Zoom, no la de un usuario
   cualquiera) → **Develop → Build App → Server-to-Server OAuth** (no
   "OAuth" normal — ese pide login de usuario, este autentica como la
   cuenta misma, que es lo que necesita un registro automático desde el
   servidor).
2. En **Scopes**, agrega `meeting:write:registrant` (si vas a usar
   Reuniones normales) o `webinar:write:registrant` (si vas a usar
   Webinars — el add-on pago de Zoom, necesario solo si esperas más
   asistentes de los que tu plan de Reuniones permite).
3. Copia Account ID, Client ID y Client Secret a las variables de arriba.
4. **En la Reunión/Webinar misma** (zoom.us, no el marketplace): actívale
   **Registration** y ponla en **Aprobación automática** — si queda en
   "Manual", la API de Zoom deja de devolver el `join_url` en la
   respuesta (solo se lo manda por correo directamente a esa persona,
   nunca a tu servidor) y el correo de confirmación de Nail Fest saldría
   sin el link de acceso.
5. En el evento (`/admin/events/[id]/edit` → Formato → Virtual/Híbrido →
   Acceso virtual), pega el ID numérico de esa Reunión/Webinar.

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
