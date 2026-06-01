import { createClient } from "@/lib/supabase/server";
import QuestionItem from "./QuestionItem";
import { MessageCircleQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

export interface QuestionRow {
  id: string;
  question: string;
  teacher_response: string | null;
  created_at: string;
  student: { full_name: string | null; grade: string | null } | null;
  assignment: { title: string } | null;
}

export default async function PreguntasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_questions")
    .select(
      "id, question, teacher_response, created_at, student:profiles(full_name, grade), assignment:assignments(title)",
    )
    .order("teacher_response", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  const rows = (data as unknown as QuestionRow[] | null) ?? [];
  const pending = rows.filter((r) => !r.teacher_response).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Preguntas de estudiantes</h1>
        <p className="text-muted text-sm">
          {pending} sin responder · {rows.length} en total
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16">
          <MessageCircleQuestion className="h-8 w-8" />
          <p>No hay preguntas todavía.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((q) => (
            <QuestionItem key={q.id} question={q} />
          ))}
        </ul>
      )}
    </div>
  );
}
