# Configuración de Supabase (manual)

Tú creas el proyecto y aplicas las migraciones. Pasos:

## 1. Crear el proyecto
- Crea un proyecto en https://supabase.com/dashboard.
- Copia a `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL` → Project Settings → API → Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → API → Project API keys → `anon` `public`
  - `SUPABASE_SERVICE_KEY` → API → Project API keys → `service_role` (SECRETO)

## 2. Aplicar migraciones
En orden, desde el SQL Editor del dashboard (o con la CLI de Supabase):

1. `migrations/0001_schema.sql`
2. `migrations/0002_rls.sql`
3. `migrations/0003_seed_badges.sql`

Con la CLI:
```bash
supabase link --project-ref <tu-ref>
supabase db push        # o ejecuta cada archivo con: supabase db execute -f <archivo>
```

## 3. Crear una institución y un admin
El trigger `handle_new_user` crea el perfil automáticamente al registrarse (rol `alumno`
por defecto). Para tener un admin y una institución:

```sql
-- 1) crea la institución
insert into organizations (name) values ('Mi Institución') returning id;

-- 2) registra un usuario desde la app (/login) y luego promuévelo a admin:
update profiles
set role = 'admin', org_id = '<id-de-la-institucion>'
where id = (select id from auth.users where email = 'tu-correo@dominio.com');
```

Alternativamente, al registrar puedes pasar metadatos (`role`, `org_id`, `grade`,
`full_name`) en `supabase.auth.signUp({ options: { data: {...} } })` y el trigger los aplica.

## 4. Seed del catálogo
Con `.env.local` configurado (incluida la service key):
```bash
npm run seed:catalog
```
Carga ~2.740 títulos desde `Listado 2.500 títulos con curaduria PNLEOBE.xlsx`.

> **Nota de seguridad:** `service_role` y `ANTHROPIC_API_KEY` solo viven en el servidor.
> Nunca las expongas al navegador.
