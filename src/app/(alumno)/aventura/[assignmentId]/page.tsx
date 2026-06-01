import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
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
  done: boolean;
  earned_points: number;
  ai_feedback: string | null;
  ai_score: number | null;
}

export default async function AventuraPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*, resource:resources(title, author, access_links, cover_url, isbn)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) notFound();

  const { data: missionsData } = await supabase
    .from("missions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("mission_number", { ascending: true });

  const missions = (missionsData as Mission[] | null) ?? [];

  // Entregas previas del alumno para esta aventura.
  const submissionByMission = new Map<
    string,
    { earned_points: number; ai_feedback: string | null; ai_score: number | null }
  >();
  if (session && missions.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("mission_id, earned_points, ai_feedback, ai_score, status")
      .eq("student_id", session.userId)
      .in(
        "mission_id",
        missions.map((m) => m.id),
      );
    for (const s of (subs as
      | {
          mission_id: string;
          earned_points: number;
          ai_feedback: string | null;
          ai_score: number | null;
          status: string;
        }[]
      | null) ?? []) {
      if (s.status === "graded") {
        submissionByMission.set(s.mission_id, {
          earned_points: s.earned_points,
          ai_feedback: s.ai_feedback,
          ai_score: s.ai_score,
        });
      }
    }
  }

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
      done: !!sub,
      earned_points: sub?.earned_points ?? 0,
      ai_feedback: sub?.ai_feedback ?? null,
      ai_score: sub?.ai_score ?? null,
    };
  });

  const a = assignment as Assignment & {
    resource: {
      title: string;
      author: string | null;
      access_links: AccessLink[];
      cover_url: string | null;
      isbn: string | null;
    } | null;
  };

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
        missions={studentMissions}
      />
    </div>
  );
}
