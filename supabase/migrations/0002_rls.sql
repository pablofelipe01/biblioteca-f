-- ============================================================================
-- LeoAventura · Row Level Security (§3)
-- Helpers SECURITY DEFINER para leer rol/org/grade del usuario SIN recursión
-- (consultar profiles dentro de una política de profiles causaría recursión).
-- Multi-tenant por org_id. Autorización con auth.uid().
-- ============================================================================

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_org()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_grade()
returns text language sql stable security definer set search_path = public as $$
  select grade from public.profiles where id = auth.uid();
$$;

-- Habilitar RLS en todas las tablas
alter table organizations     enable row level security;
alter table profiles          enable row level security;
alter table resources         enable row level security;
alter table assignments       enable row level security;
alter table missions          enable row level security;
alter table submissions       enable row level security;
alter table badges            enable row level security;
alter table user_badges       enable row level security;
alter table student_questions enable row level security;
alter table ai_conversations  enable row level security;
alter table reading_progress  enable row level security;

-- ============ ORGANIZATIONS ============
drop policy if exists org_select on organizations;
create policy org_select on organizations
  for select using (id = auth_org());

drop policy if exists org_admin_write on organizations;
create policy org_admin_write on organizations
  for all using (auth_role() = 'admin' and id = auth_org())
  with check (auth_role() = 'admin' and id = auth_org());

-- ============ PROFILES ============
-- Lectura: la propia fila; profesor/admin leen perfiles de su misma org.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (
    id = auth.uid()
    or (auth_role() in ('profesor','admin') and org_id = auth_org())
  );

-- Actualización: solo la propia fila. (Columnas sensibles protegidas por GRANT abajo.)
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Evita que el cliente modifique puntos/racha/rol/org directamente.
-- El servidor (service key) sí puede, porque omite RLS y estos GRANT.
revoke update (total_points, streak_days, last_submission_date, role, org_id)
  on profiles from authenticated;

-- ============ RESOURCES ============
drop policy if exists resources_select on resources;
create policy resources_select on resources
  for select using (org_id is null or org_id = auth_org());

drop policy if exists resources_write on resources;
create policy resources_write on resources
  for all using (auth_role() in ('profesor','admin'))
  with check (auth_role() in ('profesor','admin'));

-- ============ ASSIGNMENTS ============
-- Profesor/admin ven las de su org; alumno ve las publicadas de su org y su grado.
drop policy if exists assignments_select on assignments;
create policy assignments_select on assignments
  for select using (
    (auth_role() in ('profesor','admin') and org_id = auth_org())
    or (
      auth_role() = 'alumno'
      and org_id = auth_org()
      and is_published = true
      and grade = auth_grade()
    )
  );

drop policy if exists assignments_write on assignments;
create policy assignments_write on assignments
  for all using (
    auth_role() in ('profesor','admin') and org_id = auth_org()
  ) with check (
    auth_role() in ('profesor','admin') and org_id = auth_org()
  );

-- ============ MISSIONS ============
-- Visibles si la asignación padre es visible para el usuario.
drop policy if exists missions_select on missions;
create policy missions_select on missions
  for select using (
    exists (
      select 1 from assignments a
      where a.id = missions.assignment_id
        and (
          (auth_role() in ('profesor','admin') and a.org_id = auth_org())
          or (
            auth_role() = 'alumno'
            and a.org_id = auth_org()
            and a.is_published = true
            and a.grade = auth_grade()
          )
        )
    )
  );

drop policy if exists missions_write on missions;
create policy missions_write on missions
  for all using (
    exists (
      select 1 from assignments a
      where a.id = missions.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  ) with check (
    exists (
      select 1 from assignments a
      where a.id = missions.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

-- ============ SUBMISSIONS ============
-- Alumno: las suyas. Profesor/admin: las de misiones de sus asignaciones (su org).
drop policy if exists submissions_select on submissions;
create policy submissions_select on submissions
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from missions m
      join assignments a on a.id = m.assignment_id
      where m.id = submissions.mission_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

-- Alumno crea las suyas.
drop policy if exists submissions_insert on submissions;
create policy submissions_insert on submissions
  for insert with check (student_id = auth.uid());

-- Profesor/admin ajustan calificación de las suyas (teacher_score, etc.).
-- (La calificación automática de IA la escribe el servidor con service key.)
drop policy if exists submissions_update on submissions;
create policy submissions_update on submissions
  for update using (
    exists (
      select 1 from missions m
      join assignments a on a.id = m.assignment_id
      where m.id = submissions.mission_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

-- ============ BADGES (catálogo global de logros) ============
drop policy if exists badges_select on badges;
create policy badges_select on badges
  for select using (auth.uid() is not null);

drop policy if exists badges_admin_write on badges;
create policy badges_admin_write on badges
  for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ USER_BADGES ============
-- (El otorgamiento lo hace el servidor con service key.)
drop policy if exists user_badges_select on user_badges;
create policy user_badges_select on user_badges
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = user_badges.student_id
        and auth_role() in ('profesor','admin')
        and p.org_id = auth_org()
    )
  );

-- ============ STUDENT_QUESTIONS ============
drop policy if exists sq_select on student_questions;
create policy sq_select on student_questions
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from assignments a
      where a.id = student_questions.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

drop policy if exists sq_insert on student_questions;
create policy sq_insert on student_questions
  for insert with check (student_id = auth.uid());

drop policy if exists sq_update on student_questions;
create policy sq_update on student_questions
  for update using (
    exists (
      select 1 from assignments a
      where a.id = student_questions.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

-- ============ AI_CONVERSATIONS ============
drop policy if exists ai_conv_select on ai_conversations;
create policy ai_conv_select on ai_conversations
  for select using (student_id = auth.uid());

drop policy if exists ai_conv_insert on ai_conversations;
create policy ai_conv_insert on ai_conversations
  for insert with check (student_id = auth.uid());

-- ============ READING_PROGRESS ============
drop policy if exists rp_all on reading_progress;
create policy rp_all on reading_progress
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
