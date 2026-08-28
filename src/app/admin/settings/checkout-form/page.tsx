import { getCheckoutQuestions } from "@/lib/checkoutForm";
import CheckoutFormEditor from "./CheckoutFormEditor";

export const dynamic = "force-dynamic";

export default async function CheckoutFormPage() {
  const questions = await getCheckoutQuestions();

  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Checkout form</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Las preguntas que se le hacen a cualquiera que se registre a un evento — esto es real:
        agregar, editar, borrar o mover una pregunta aquí cambia el formulario de inscripción de
        inmediato. Nombre y Correo son obligatorios siempre (son la forma de identificar a la
        persona); Celular, Cédula, Ciudad y Profesión se pueden marcar opcionales pero no
        borrarse, porque alimentan el CRM y los segmentos.
      </p>

      <CheckoutFormEditor
        initialQuestions={questions.map((q) => ({
          id: q.id,
          key: q.key,
          label: q.label,
          type: q.type,
          required: q.required,
          options: q.options,
          locked: q.locked,
        }))}
      />
    </div>
  );
}
