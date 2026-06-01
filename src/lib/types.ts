// Tipos del dominio. Reflejan el modelo de datos de Supabase (§3 del spec).

export type Role = "alumno" | "profesor" | "admin";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string | null;
  role: Role;
  full_name: string | null;
  grade: string | null;
  avatar_url: string | null;
  total_points: number;
  streak_days: number;
  created_at: string;
}

export interface AccessLink {
  label: string;
  url: string;
  type?: string; // 'dominio_publico' | 'biblioteca' | 'repositorio' | ...
}

export interface Resource {
  id: string;
  org_id: string | null;
  source: "catalogo" | "profesor";
  isbn: string | null;
  title: string;
  author: string | null;
  illustrator: string | null;
  edition: string | null;
  publisher: string | null;
  pages: number | null;
  city: string | null;
  published_year: string | null;
  editorial_collection: string | null;
  genre: string | null;
  fundamental_areas: string | null;
  keywords: string[] | null;
  reading_experience: string | null;
  author_nationality: string | null;
  school_cycle: string | null;
  collection: string | null;
  tag_ethnicity: boolean;
  tag_afro: boolean;
  tag_women: boolean;
  tag_disability: boolean;
  synopsis: string | null;
  cover_url: string | null;
  access_links: AccessLink[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  org_id: string | null;
  teacher_id: string | null;
  resource_id: string | null;
  title: string;
  chapter_label: string | null;
  instructions: string | null;
  excerpt_text: string | null;
  grade: string | null;
  due_at: string | null;
  is_published: boolean;
  created_at: string;
}

export type MissionType = "quiz" | "open" | "creative";

export interface QuizData {
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string;
}

export interface OpenData {
  prompt: string;
  rubric: string;
}

export interface CreativeData {
  prompt: string;
  min_words: number;
}

export type MissionData = QuizData | OpenData | CreativeData;

export interface Mission {
  id: string;
  assignment_id: string;
  mission_number: number;
  type: MissionType;
  title: string | null;
  data: MissionData;
  points: number;
  created_at: string;
}

export interface Submission {
  id: string;
  mission_id: string;
  student_id: string | null;
  response: unknown;
  ai_feedback: string | null;
  ai_score: number | null;
  teacher_score: number | null;
  earned_points: number;
  status: "submitted" | "graded";
  created_at: string;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface UserBadge {
  id: string;
  student_id: string | null;
  badge_id: string | null;
  awarded_at: string;
}

export interface StudentQuestion {
  id: string;
  student_id: string | null;
  assignment_id: string | null;
  question: string;
  teacher_response: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AiConversation {
  id: string;
  student_id: string | null;
  assignment_id: string | null;
  question: string;
  ai_response: string | null;
  created_at: string;
}

export interface ReadingProgress {
  id: string;
  student_id: string | null;
  assignment_id: string | null;
  percent: number;
  updated_at: string;
}

// ---- Valores canónicos para filtros del catálogo (§5) ----
export const SCHOOL_CYCLES = [
  "Ciclo 1 - Preescolar",
  "Ciclo 2 - Básica primaria",
  "Ciclo 3 - Básica secundaria",
  "Ciclo 4 - Media vocacional",
  "Pedagogía",
] as const;

export const READING_EXPERIENCES = ["Niños", "Jóvenes", "Adultos"] as const;

export const DIVERSITY_TAGS = [
  { key: "tag_ethnicity", label: "Etnia" },
  { key: "tag_afro", label: "Afro" },
  { key: "tag_women", label: "Mujeres" },
  { key: "tag_disability", label: "Discapacidad" },
] as const;
