import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { signImagePaths, toSignedList, type SignedImage } from "@/lib/images-server";
import { effectiveScore } from "@/lib/grades";
import AventuraClient from "./AventuraClient";
import type { Assignment, Mission, AccessLink } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export interface StudentMission {
  id: string;
  mission_number: number;
  type: Mission["type"];
  title: string | null;
  points: number;
  // Datos SIN la respuesta correcta (no filtramos correct_index/explanation al cliente).
  data: Record<string, unknown>;
  reference_images: SignedImage[];
  done: boolean;
  earned_points: number;
  ai_feedback: string | null;
  /** Puntaje efectivo 0–100 (nota del docente si existe, si no la de IA). */
  score: number | null;
  teacher_comment: string | null;
  answer_text: string | null;
  answer_images: SignedImage[];
}

export interface StudentQuestion {
  id: string;
  question: string;
  teacher_response: string | null;
  created_at: string;
}

export interface GroupInfo {
  mode: "teacher" | "self";
  maxSize: number | null;
  myGroupId: string | null;
  groups: { id: string; number: number; name: string | null; members: string[] }[];
}

export default async function AventuraPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const session = await getSessionProfile();
  const supabase = await createClient();

  // RLS: solo llega si la tarea está publicada para el curso/org del alumno.
  const { data: assignment } = await supabase
    .from("assignments")
    .select("*, resource:resources(title, author, access_links, cover_url, isbn)")
    .eq("id", assignmentId)
    .single();

  if (!assignment || !session) notFound();

  const { data: missionsData } = await supabase
    .from("missions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("mission_number", { ascending: true });

  const missions = (missionsData as Mission[] | null) ?? [];

  // Entregas previas del alumno para esta aventura.
  type SubRow = {
    mission_id: string;
    earned_points: number;
    ai_feedback: string | null;
    ai_score: number | null;
    teacher_score: number | null;
    teacher_comment: string | null;
    response: Record<string, unknown> | null;
    status: string;
  };
  const submissionByMission = new Map<string, SubRow>();
  if (missions.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select(
        "mission_id, earned_points, ai_feedback, ai_score, teacher_score, teacher_comment, response, status",
      )
      .eq("student_id", session.userId)
      .in(
        "mission_id",
        missions.map((m) => m.id),
      );
    for (const s of (subs as SubRow[] | null) ?? []) {
      if (s.status === "graded") submissionByMission.set(s.mission_id, s);
    }
  }

  // Preguntas del alumno para esta aventura, con la respuesta del profe (si la hay).
  const { data: questionsData } = await supabase
    .from("student_questions")
    .select("id, question, teacher_response, created_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", session.userId)
    .order("created_at", { ascending: false });
  const questions = (questionsData as StudentQuestion[] | null) ?? [];

  const a = assignment as Assignment & {
    resource: {
      title: string;
      author: string | null;
      access_links: AccessLink[];
      cover_url: string | null;
      isbn: string | null;
    } | null;
  };

  // Firmamos todas las imágenes (referencias + respuestas propias) de una vez.
  const answerImages = (s: SubRow | undefined): string[] => {
    const imgs = s?.response?.images;
    return Array.isArray(imgs) ? imgs.filter((p): p is string => typeof p === "string") : [];
  };
  const urls = await signImagePaths([
    ...(a.reference_images ?? []),
    ...missions.flatMap((m) => m.reference_images ?? []),
    ...missions.flatMap((m) => answerImages(submissionByMission.get(m.id))),
  ]);

  // Saneamos los datos de cada misión para NO enviar la respuesta correcta al navegador.
  const studentMissions: StudentMission[] = missions.map((m) => {
    const raw = (m.data ?? {}) as unknown as Record<string, unknown>;
    let safeData: Record<string, unknown> = raw;
    if (m.type === "quiz") {
      safeData = { question: raw.question, options: raw.options };
    }
    const sub = submissionByMission.get(m.id);
    return {
      id: m.id,
      mission_number: m.mission_number,
      type: m.type,
      title: m.title,
      points: m.points,
      data: safeData,
      reference_images: toSignedList(m.reference_images, urls),
      done: !!sub,
      earned_points: sub?.earned_points ?? 0,
      ai_feedback: sub?.ai_feedback ?? null,
      score: sub ? effectiveScore(sub) : null,
      teacher_comment: sub?.teacher_comment ?? null,
      answer_text:
        typeof sub?.response?.text === "string" ? (sub.response.text as string) : null,
      answer_images: toSignedList(answerImages(sub), urls),
    };
  });

  // Grupos: la tarea ya fue validada con RLS arriba; los nombres de los
  // compañeros los leemos con la service key (profiles está cerrado al alumno).
  let group: GroupInfo | null = null;
  if (a.is_group) {
    const admin = createAdminClient();
    const [{ data: groupRows }, { data: memberRows }] = await Promise.all([
      admin
        .from("assignment_groups")
        .select("id, number, name")
        .eq("assignment_id", a.id)
        .order("number", { ascending: true }),
      admin
        .from("assignment_group_members")
        .select("group_id, student_id, student:profiles(full_name)")
        .eq("assignment_id", a.id),
    ]);
    const members = (memberRows as unknown as {
      group_id: string;
      student_id: string;
      student: { full_name: string | null } | null;
    }[] | null) ?? [];
    group = {
      mode: a.group_mode === "self" ? "self" : "teacher",
      maxSize: a.group_max_size,
      myGroupId: members.find((m) => m.student_id === session.userId)?.group_id ?? null,
      groups: ((groupRows as { id: string; number: number; name: string | null }[] | null) ?? []).map(
        (g) => ({
          ...g,
          members: members
            .filter((m) => m.group_id === g.id)
            .map((m) =>
              m.student_id === session.userId
                ? "Tú"
                : (m.student?.full_name ?? "Compañero/a"),
            ),
        }),
      ),
    };
  }

  return (
    <div>
      <Link
        href="/mis-tareas"
        className="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis tareas
      </Link>
      <AventuraClient
        assignmentId={a.id}
        title={a.title}
        chapterLabel={a.chapter_label}
        instructions={a.instructions}
        excerpt={a.excerpt_text ?? ""}
        accessLinks={
          Array.isArray(a.resource?.access_links) ? a.resource!.access_links : []
        }
        referenceImages={toSignedList(a.reference_images, urls)}
        missions={studentMissions}
        questions={questions}
        orgId={session.profile?.org_id ?? null}
        userId={session.userId}
        group={group}
      />
    </div>
  );
}
