-- ============================================================================
-- LeoAventura · Ajustes 2 (observaciones generales)
--  - Observación general del docente para todo el curso en una tarea.
--  - Observación general del docente para cada estudiante en una tarea
--    (además de los comentarios por pregunta que ya existen en submissions).
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

-- ============ OBSERVACIÓN GENERAL DEL CURSO ============
alter table assignments add column if not exists general_comment text;
alter table assignments add column if not exists general_commented_at timestamptz;

-- ============ OBSERVACIÓN GENERAL POR ESTUDIANTE ============
create table if not exists assignment_feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  comment text not null,
  updated_at timestamptz default now(),
  unique (assignment_id, student_id)
);

alter table assignment_feedback enable row level security;

-- Lectura: el propio estudiante; docente/admin de la org de la tarea.
drop policy if exists af_select on assignment_feedback;
create policy af_select on assignment_feedback
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from assignments a
      where a.id = assignment_feedback.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

-- Escritura: solo docente/admin de la org de la tarea.
drop policy if exists af_write on assignment_feedback;
create policy af_write on assignment_feedback
  for all using (
    exists (
      select 1 from assignments a
      where a.id = assignment_feedback.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  ) with check (
    exists (
      select 1 from assignments a
      where a.id = assignment_feedback.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );
