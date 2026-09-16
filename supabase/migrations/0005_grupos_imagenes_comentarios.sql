-- ============================================================================
-- LeoAventura · Ajustes docente/estudiante
--  - Imágenes de referencia en tareas y misiones (rutas en Storage).
--  - Tareas grupales: grupos numerados + integrantes (asignados por el docente
--    o elegidos por el estudiante). Cada integrante responde y se califica por
--    separado; el grupo organiza y agrupa resultados.
--  - Comentario del docente (texto/emoticones) en cada entrega.
--  - Bucket privado `leo-images` para imágenes de referencia y respuestas.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

-- ============ TAREAS / MISIONES ============
alter table assignments add column if not exists reference_images text[] not null default '{}';
alter table assignments add column if not exists is_group boolean not null default false;
alter table assignments add column if not exists group_mode text not null default 'teacher';
alter table assignments add column if not exists group_max_size int;
alter table assignments add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignments_group_mode_check'
  ) then
    alter table assignments
      add constraint assignments_group_mode_check
      check (group_mode in ('teacher', 'self'));
  end if;
end $$;

alter table missions add column if not exists reference_images text[] not null default '{}';

-- ============ ENTREGAS ============
alter table submissions add column if not exists teacher_comment text;
alter table submissions add column if not exists teacher_commented_at timestamptz;

-- ============ GRUPOS ============
create table if not exists assignment_groups (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  number int not null,
  name text,
  created_at timestamptz default now(),
  unique (assignment_id, number)
);
create index if not exists assignment_groups_assignment_idx on assignment_groups (assignment_id);

create table if not exists assignment_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references assignment_groups(id) on delete cascade,
  -- Denormalizado para garantizar un solo grupo por estudiante en cada tarea.
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (assignment_id, student_id)
);
create index if not exists agm_group_idx on assignment_group_members (group_id);

alter table assignment_groups        enable row level security;
alter table assignment_group_members enable row level security;

-- Lectura: docente/admin de la org; alumno si la tarea le es visible.
-- (Los nombres de compañeros los resuelve el servidor; profiles sigue cerrado.)
drop policy if exists ag_select on assignment_groups;
create policy ag_select on assignment_groups
  for select using (
    exists (
      select 1 from assignments a
      where a.id = assignment_groups.assignment_id
        and a.org_id = auth_org()
        and (
          auth_role() in ('profesor','admin')
          or (auth_role() = 'alumno' and a.is_published and a.grade = auth_grade())
        )
    )
  );

drop policy if exists ag_write on assignment_groups;
create policy ag_write on assignment_groups
  for all using (
    exists (
      select 1 from assignments a
      where a.id = assignment_groups.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  ) with check (
    exists (
      select 1 from assignments a
      where a.id = assignment_groups.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

drop policy if exists agm_select on assignment_group_members;
create policy agm_select on assignment_group_members
  for select using (
    exists (
      select 1 from assignments a
      where a.id = assignment_group_members.assignment_id
        and a.org_id = auth_org()
        and (
          auth_role() in ('profesor','admin')
          or (auth_role() = 'alumno' and a.is_published and a.grade = auth_grade())
        )
    )
  );

-- Escritura directa solo docente/admin. La autoinscripción del alumno la hace
-- el servidor (valida modo 'self', cupo y curso) con la service key.
drop policy if exists agm_write on assignment_group_members;
create policy agm_write on assignment_group_members
  for all using (
    exists (
      select 1 from assignments a
      where a.id = assignment_group_members.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  ) with check (
    exists (
      select 1 from assignments a
      where a.id = assignment_group_members.assignment_id
        and auth_role() in ('profesor','admin')
        and a.org_id = auth_org()
    )
  );

-- ============ STORAGE: bucket privado de imágenes ============
-- Rutas:
--   <org_id>/refs/<archivo>                 imágenes de referencia (docente)
--   <org_id>/answers/<student_id>/<archivo> imágenes de respuestas (alumno)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leo-images', 'leo-images', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists leo_images_select on storage.objects;
create policy leo_images_select on storage.objects
  for select to authenticated using (
    bucket_id = 'leo-images'
    and (storage.foldername(name))[1] = public.auth_org()::text
    and (
      (storage.foldername(name))[2] = 'refs'
      or public.auth_role() in ('profesor','admin')
      or (
        (storage.foldername(name))[2] = 'answers'
        and (storage.foldername(name))[3] = auth.uid()::text
      )
    )
  );

drop policy if exists leo_images_insert on storage.objects;
create policy leo_images_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'leo-images'
    and (storage.foldername(name))[1] = public.auth_org()::text
    and (
      (
        (storage.foldername(name))[2] = 'refs'
        and public.auth_role() in ('profesor','admin')
      )
      or (
        (storage.foldername(name))[2] = 'answers'
        and (storage.foldername(name))[3] = auth.uid()::text
      )
    )
  );

drop policy if exists leo_images_delete on storage.objects;
create policy leo_images_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'leo-images'
    and (storage.foldername(name))[1] = public.auth_org()::text
    and (
      owner_id = auth.uid()::text
      or public.auth_role() in ('profesor','admin')
    )
  );
