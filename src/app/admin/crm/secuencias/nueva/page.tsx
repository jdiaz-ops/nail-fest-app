import Link from "next/link";
import { requirePageUser } from "@/lib/auth/guard";
import { sequenceEditorOptions } from "@/lib/sequences/admin";
import SequenceEditor from "@/components/SequenceEditor";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

export default async function NewSequencePage() {
  await requirePageUser(["ADMIN"]);
  const options = await sequenceEditorOptions();
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
        <Link href="/admin/crm/secuencias">← Secuencias</Link>
      </p>
      <CrmPageHeader title="Nueva secuencia" subtitle="Elige a quién le llega (un segmento) y qué le llega, y cuándo. Se guarda apagada." />
      <SequenceEditor sequence={null} options={options} />
    </div>
  );
}
