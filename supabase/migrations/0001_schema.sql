-- ============================================================================
-- LeoAventura · Esquema base (§3 del spec)
-- Tablas, índices y trigger handle_new_user. Las políticas RLS van en 0002.
-- ============================================================================

-- ============ INSTITUCIONES Y PERFILES ============
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Perfil ligado a Supabase Auth (auth.users). El id ES el auth.uid().
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  role text not null default 'alumno' check (role in ('alumno','profesor','admin')),
  full_name text,
  grade text,                -- curso del alumno, ej "7B"
  avatar_url text,
  total_points int default 0,
  streak_days int default 0,
  last_submission_date date,  -- soporte interno para cálculo de racha
  created_at timestamptz default now()
);

-- ============ CATÁLOGO (proviene del Excel PNLE) ============
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),        -- null = global / compartido
  source text not null default 'catalogo'          -- 'catalogo' | 'profesor'
    check (source in ('catalogo','profesor')),
  isbn text,
  title text not null,
  author text,
  illustrator text,
  edition text,
  publisher text,
  pages int,
  city text,
  published_year text,
  editorial_collection text,
  genre text,
  fundamental_areas text,
  keywords text[],
  reading_experience text,
  author_nationality text,
  school_cycle text,
  collection text,
  tag_ethnicity boolean default false,
  tag_afro boolean default false,
  tag_women boolean default false,
  tag_disability boolean default false,
  synopsis text,
  cover_url text,
  access_links jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
-- upsert por isbn en el seed. Índice único NO parcial para que ON CONFLICT (isbn)
-- pueda inferirlo. Postgres trata los NULL como distintos, así que se permiten
-- múltiples filas sin ISBN (esas nunca generan conflicto y simplemente se insertan).
create unique index if not exists resources_isbn_unique on resources (isbn);
create index if not exists resources_keywords_idx on resources using gin (keywords);
create index if not exists resources_school_cycle_idx on resources (school_cycle);
create index if not exists resources_genre_idx on resources (genre);
create index if not exists resources_fundamental_areas_idx on resources (fundamental_areas);
create index if not exists resources_reading_experience_idx on resources (reading_experience);
create index if not exists resources_org_idx on resources (org_id);

-- ============ ASIGNACIONES / TAREAS ============
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  teacher_id uuid references profiles(id),
  resource_id uuid references resources(id),
  title text not null,
  chapter_label text,
  instructions text,
  excerpt_text text,
  grade text,
  due_at timestamptz,
  is_published boolean default false,
  created_at timestamptz default now()
);
create index if not exists assignments_org_grade_idx on assignments (org_id, grade);
create index if not exists assignments_teacher_idx on assignments (teacher_id);

-- ============ MISIONES (retos por tarea) ============
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  mission_number int not null,
  type text not null check (type in ('quiz','open','creative')),
  title text,
  data jsonb not null,
  points int default 10,
  created_at timestamptz default now()
);
create index if not exists missions_assignment_idx on missions (assignment_id);

-- ============ ENTREGAS ============
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  student_id uuid references profiles(id),
  response jsonb not null,
  ai_feedback text,
  ai_score numeric,
  teacher_score numeric,
  earned_points int default 0,
  status text default 'submitted' check (status in ('submitted','graded')),
  created_at timestamptz default now()
);
create index if not exists submissions_student_idx on submissions (student_id);
create index if not exists submissions_mission_idx on submissions (mission_id);

-- ============ GAMIFICACIÓN ============
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  icon text
);
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  badge_id uuid references badges(id),
  awarded_at timestamptz default now(),
  unique (student_id, badge_id)
);

-- ============ INTERACCIÓN ============
create table if not exists student_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  assignment_id uuid references assignments(id),
  question text not null,
  teacher_response text,
  is_read boolean default false,
  created_at timestamptz default now()
);
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  assignment_id uuid references assignments(id),
  question text not null,
  ai_response text,
  created_at timestamptz default now()
);
create table if not exists reading_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id),
  assignment_id uuid references assignments(id),
  percent numeric default 0,
  updated_at timestamptz default now(),
  unique (student_id, assignment_id)
);

-- ============ TRIGGER: crear perfil al registrarse ============
-- Lee metadatos opcionales pasados en signUp (full_name, role, org_id, grade).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, org_id, grade)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'alumno'),
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    new.raw_user_meta_data ->> 'grade'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
