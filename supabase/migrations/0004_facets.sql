-- ============================================================================
-- LeoAventura · Facetas del catálogo (§5/§7)
-- RPC que devuelve los valores distintos de género y área fundamental
-- para construir los filtros. SECURITY DEFINER: el catálogo es global/compartido,
-- así que cualquier usuario autenticado puede leer estas listas.
-- ============================================================================
create or replace function public.catalog_facets()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'genres', (
      select coalesce(json_agg(g order by g), '[]'::json)
      from (select distinct genre as g from resources
            where genre is not null and is_active) s
    ),
    'areas', (
      select coalesce(json_agg(a order by a), '[]'::json)
      from (select distinct fundamental_areas as a from resources
            where fundamental_areas is not null and is_active) s
    )
  );
$$;

grant execute on function public.catalog_facets() to authenticated;
