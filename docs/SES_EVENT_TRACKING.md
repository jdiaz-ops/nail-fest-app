# Tracking de entregas, aperturas y clics de correo

Esto conecta el envío real de SES con `EmailLog` y con el historial por
persona (`/admin/crm/personas/[id]`) — sin esto, `EmailLog.status` se queda
en `SENT` para siempre y el timeline nunca muestra "abrió el correo" ni
"clic en el correo". El código que RECIBE estos eventos ya está listo
(`/api/webhooks/ses`); lo que falta es decirle a AWS que los mande ahí, y
eso solo se puede hacer desde la consola de AWS.

1. **Genera un secreto** para la URL del webhook (cualquier cadena larga
   aleatoria sirve, por ejemplo `openssl rand -hex 24`). Agrégalo a las
   variables de entorno del proyecto en Vercel:
   ```
   SES_WEBHOOK_SECRET=el-secreto-que-generaste
   ```
   La URL completa del webhook queda:
   `https://tu-dominio.vercel.app/api/webhooks/ses?token=el-secreto-que-generaste`

2. **Reutiliza (o crea) el topic de SNS.** Si ya seguiste `SES_SETUP.md`
   paso 3, ya existe un topic de SNS recibiendo Bounce/Complaint — puedes
   usar ese mismo. Si no:
   - SNS console → Topics → Create topic → tipo "Standard" → nómbralo, por
     ejemplo `nailfest-ses-events`.

3. **Suscribe el webhook al topic:**
   - Dentro del topic → Create subscription.
   - Protocol: `HTTPS`.
   - Endpoint: la URL completa del paso 1 (con el `?token=...` incluido).
   - Crea la suscripción. Va a quedar en estado "Pending confirmation" —
     nuestro endpoint confirma la suscripción automáticamente apenas SNS le
     mande el mensaje de confirmación (usualmente en segundos). Si después
     de un minuto sigue en "Pending", revisa los logs de la función en
     Vercel para ver si el POST llegó y qué pasó.

4. **Conecta el topic a los Configuration Sets** — hay que hacerlo para
   los dos (`nailfest-transactional` Y `nailfest-marketing`, ambos definidos
   en `SES_SETUP.md`):
   - SES console → Configuration sets → `nailfest-transactional` → Event
     destinations → Add destination.
   - Destination type: SNS topic → selecciona el topic del paso 2.
   - Event types a marcar: **Send, Delivery, Open, Click, Bounce, Complaint**
     (Reject y Rendering failure son opcionales, no se usan hoy).
   - Repite lo mismo para `nailfest-marketing`.

5. **Prueba real:** registra una entrada de prueba (o usa `/reenviar`), y
   abre el correo que llega. Después de unos segundos, entra a
   `/admin/crm/personas/[esa-persona]` y confirma que aparece "Abrió el
   correo" en el historial. El clic funciona igual, dando clic a cualquier
   link del correo.

**Nota sobre "aperturas":** Apple Mail Privacy Protection precarga la
imagen de tracking de SES sin que la persona haya visto el correo de
verdad — vas a ver más "aperturas" de las reales, sobre todo en correos a
`@icloud.com`/`@me.com` o abiertos desde el cliente de correo de iPhone.
Los clics no tienen ese problema — son la señal más confiable de las dos.

**Seguridad del webhook:** el endpoint valida el `?token=` en la URL antes
de procesar nada — sin el secreto correcto, responde 401 sin tocar la base
de datos. Eso evita que cualquiera que adivine la URL pueda inyectar
eventos falsos, pero no es verificación real de firma SNS (que requiere
descargar el certificado público de AWS y validar la firma PKCS1v15/SHA1
del mensaje) — un endurecimiento razonable para más adelante, no
implementado todavía.
