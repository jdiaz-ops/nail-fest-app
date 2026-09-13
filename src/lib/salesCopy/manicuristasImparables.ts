// The full "guion de venta" copy for Manicuristas Imparables, as HTML —
// shared by scripts/seed-manicuristas-sales-page.ts (CLI, for a machine
// with DB access) and /api/admin/dev/seed-sales-copy (a one-tap admin
// action for when you're on your phone, no terminal). One source so the
// two paths can never drift.
//
// This is stored into Event.description — the SAME rich-text field the
// admin's own "Descripción" editor (EventForm.tsx) writes, rendered by
// the SAME public page (EventRegistration.tsx) next to the untouched
// registration/checkout sidebar. No new schema, no new render branch.
//
// Placeholder/draft content: the speaker bios, the 2-day schedule and the
// two testimonials are FABRICATED per explicit instruction ("es un
// draft") — replace them with the real bios/cronograma/testimonios before
// launch.
//
// Left OUT on purpose vs. the original guion PDF: the Early Bird/Regular/
// Full price-tier language and the "el precio sube en cada etapa"
// countdown (that's the tiered-pricing build, explicitly deferred — "no
// haga el 2 aún"), and the Addi installment-payment mention (Wompi is the
// only payment method actually wired up so far — see
// docs/PAYMENTS_SETUP.md). Both can be added back into this same text
// once those features exist.
//
// Only allowed tags/attributes from sanitizeEventDescription (h2/h3, p,
// ul/li, strong/em, blockquote, hr, br, a) are used here — verified this
// round-trips through sanitizeEventDescription() unchanged (aside from
// <hr>/<br> self-closing normalization).
export const MANICURISTAS_SALES_PAGE_HTML = `
<h2>De manicurista que espera clientas a dueña de un negocio que las atrae</h2>
<p>2 días en vivo, 100% virtuales, donde vas a construir en tiempo real la manicurista profesional que ya eres capaz de ser — con las herramientas que hoy te faltan.</p>
<p>Sabes hacer uñas increíbles. Pero llenar tu agenda, cobrar lo que vales y hacer crecer tu negocio sola — eso nadie te lo enseñó.</p>
<hr>
<h2>Un congreso pensado para que ejecutes, no solo para que escuches</h2>
<p>Nail Fest ha reunido a miles de manicuristas y estudiantes en todo Colombia. Ahora llevamos esa misma comunidad a un congreso virtual de 2 días, con expertas de la industria — para que salgas con algo concreto en la mano, no solo con apuntes.</p>
<blockquote>«Después de una feria de Nail Fest monté mi primera pauta en redes y en un mes dupliqué mis citas.»<br>— Valentina R., Bogotá</blockquote>
<blockquote>«Aprendí a cobrar lo que valía mi trabajo. Dejé de regalar mi tiempo.»<br>— Carolina M., Medellín</blockquote>
<p>Vas a salir de estos 2 días con algo que hoy no tienes: tu primera pauta en Meta corriendo, tu cuadernillo lleno de un plan de acción, y una comunidad que te empuja a ejecutarlo.</p>
<hr>
<h2>Esto es todo lo que recibes cuando entras hoy</h2>
<ul>
<li><strong>Entrada en vivo a los 2 días del congreso</strong> — $150.000</li>
<li><strong>Cuadernillo de seguimiento</strong> (notas + ejercicios de cada speaker) — $40.000</li>
<li><strong>Plantillas digitales</strong> (precios, redes, presupuesto) — $60.000</li>
<li><strong>Plantilla de consentimiento/contrato</strong> para tus clientas — $30.000</li>
<li><strong>Slides descargables</strong> de cada speaker — $50.000</li>
<li><strong>Grabaciones de las charlas</strong> — 30 días de acceso — $80.000</li>
<li><strong>Certificado digital de asistencia</strong> con tu nombre — $20.000</li>
</ul>
<p><strong>Valor total: $430.000.</strong> Tu inversión hoy: <strong>$80.000</strong>.</p>
<hr>
<h2>Esto es lo que vas a vivir en los 2 días</h2>
<p><strong>Día 1 — domingo 27 de junio</strong></p>
<ul>
<li>10:00 a.m. — De manicurista a marca: cómo construir tu identidad en redes — Jimenails</li>
<li>12:00 p.m. — Cobra lo que vales: pricing sin miedo — Alesandro</li>
<li>2:00 p.m. — Cómo crear tu primera pauta en Meta, en vivo — Juan Tenorio</li>
</ul>
<p><strong>Día 2 — lunes 28 de junio</strong></p>
<ul>
<li>10:00 a.m. — Clientas que vuelven: experiencia y fidelización — Cristina Sierra</li>
<li>12:00 p.m. — Preguntas en vivo con todo el panel de expertas</li>
<li>2:00 p.m. — Cierre + plan de acción del reto post-evento — equipo Nail Fest</li>
</ul>
<p><em>Horarios en hora Colombia. El cronograma final con la duración exacta de cada bloque se confirma antes del evento.</em></p>
<hr>
<h2>Quiénes te acompañan estos 2 días</h2>
<p><strong>Jimenails</strong><br>Nail artist y educadora, con años construyendo su marca personal desde el nail art y las redes sociales. En este congreso te enseña a convertir tu trabajo en una identidad que atrae clientas solas.</p>
<p><strong>Alesandro</strong><br>Especialista en pricing y estrategia de negocio para manicuristas. Te enseña a poner precios que reflejen tu trabajo real, sin miedo a "perder" clientas.</p>
<p><strong>Juan Tenorio</strong><br>Especialista en pauta digital y crecimiento en Meta. Te lleva paso a paso, desde cero, a crear tu primera campaña publicitaria en vivo durante el congreso.</p>
<p><strong>Cristina Sierra</strong><br>Manicurista y experta en experiencia de cliente. Te enseña cómo lograr que una clienta que te visita una vez, vuelva siempre.</p>
<hr>
<h2>¿Es para ti?</h2>
<p><strong>Es para ti si:</strong></p>
<ul>
<li>Eres manicurista y quieres dejar de depender solo del voz a voz para conseguir clientas.</li>
<li>Eres estudiante y quieres aprender de expertas antes de abrir tu propio negocio.</li>
<li>Ya tienes clientas, pero sientes que no cobras lo que vales.</li>
<li>Quieres aprender a hacer tu propia pauta digital sin pagarle a una agencia.</li>
</ul>
<p><strong>No es para ti si:</strong></p>
<ul>
<li>Buscas una fórmula mágica sin poner en práctica nada de lo que aprendas.</li>
<li>No tienes intención de atender clientas de uñas ni de crecer un negocio en esta industria.</li>
</ul>
<hr>
<h2>Cupos limitados</h2>
<p>Este congreso tiene cupo para <strong>1.000 personas en simultáneo</strong>. Cuando se acaban, se acaban — no hay reposición ni segunda tanda.</p>
<hr>
<h2>Recibes $430.000 en valor real por solo $80.000</h2>
<p>Dos días en vivo, un plan de acción concreto, y todo lo que necesitas para ejecutar — no solo para escuchar.</p>
<p>Si en los primeros 30 minutos del Día 1 sientes que esto no es para ti, escríbenos y te devolvemos tu dinero. Sin preguntas.</p>
<hr>
<h2>Preguntas frecuentes</h2>
<h3>¿Y si no puedo estar en vivo los dos días?</h3>
<p>No hay problema. Tienes acceso a las grabaciones durante 30 días para verlas cuando puedas.</p>
<h3>¿Sirve si soy estudiante y aún no tengo mi propio negocio?</h3>
<p>Sí. El contenido está pensado tanto para quien ya tiene clientas como para quien se está preparando para empezar.</p>
<h3>¿Necesito experiencia previa en pauta digital o en Meta Ads?</h3>
<p>No. La clase de pauta en Meta parte desde cero y te lleva paso a paso a crear tu primera campaña en vivo.</p>
<h3>¿Cómo recibo mi acceso al evento?</h3>
<p>Después de tu registro, recibes por correo y WhatsApp tu confirmación. El link único de acceso a las sesiones en Zoom te llega más cerca de la fecha del evento.</p>
<h3>¿Hay devolución si no me gusta?</h3>
<p>Sí, dentro de los primeros 30 minutos del Día 1 puedes solicitar el reembolso completo.</p>
<hr>
<p><strong>P.D.</strong> Si llegaste hasta aquí sin leer todo: por $80.000 recibes 2 días en vivo con expertas de la industria, tu cuadernillo de trabajo, plantillas listas para usar, grabaciones por 30 días y tu certificado — con garantía de devolución en los primeros 30 minutos si sientes que no es para ti. Los cupos son limitados a 1.000 personas. Asegura el tuyo ahora.</p>
`.trim();
