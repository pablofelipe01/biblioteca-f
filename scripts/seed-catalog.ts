/**
 * Ingesta del catálogo PNLE (§5).
 * Lee `Listado 2.500 títulos con curaduria PNLEOBE.xlsx`, hoja `Consolidado base`,
 * y hace upsert por ISBN en la tabla `resources` con la SERVICE KEY.
 *
 * Uso:  npm run seed:catalog
 *       npm run seed:catalog -- "/ruta/al/archivo.xlsx"
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { existsSync } from "node:fs";

// --- Cargar .env.local (Node 20.12+/24) ---
try {
  process.loadEnvFile(".env.local"); // Node >= 20.12
} catch {
  // si ya están en el entorno, seguimos
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local",
  );
  process.exit(1);
}

const DEFAULT_XLSX =
  "/Users/pablofelipe/Documents/Listado 2.500 títulos con curaduria PNLEOBE.xlsx";
const XLSX_PATH = process.argv[2] || DEFAULT_XLSX;
const SHEET = "Consolidado base";
const BATCH_SIZE = 500;

if (!existsSync(XLSX_PATH)) {
  console.error(`No se encontró el Excel en: ${XLSX_PATH}`);
  console.error(`Pásalo como argumento: npm run seed:catalog -- "/ruta/archivo.xlsx"`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Helpers de normalización ---
function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function toInt(v: unknown): number | null {
  const str = s(v);
  if (!str) return null;
  const n = parseInt(str.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function toKeywords(v: unknown): string[] | null {
  const str = s(v);
  if (!str) return null;
  const arr = str
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return arr.length ? arr : null;
}

// 'X', 'x', o cualquier celda no vacía => true
function toTag(v: unknown): boolean {
  return s(v) !== null;
}

// Corrige el typo del archivo ("Peescolar" -> "Preescolar") y normaliza espacios.
function normSchoolCycle(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  return str.replace("Peescolar", "Preescolar");
}

// Unifica variantes de mayúsculas del género (cuento/CUENTO/Cuento -> Cuento)
// usando "sentence case": primera letra mayúscula, resto minúscula.
function normGenre(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normReadingExperience(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  const low = str.toLowerCase();
  if (low.startsWith("niñ") || low.startsWith("nin")) return "Niños";
  if (low.startsWith("jó") || low.startsWith("jo")) return "Jóvenes";
  if (low.startsWith("adult")) return "Adultos";
  return str; // valor inesperado: lo guardamos tal cual
}

type Row = Record<string, unknown>;

interface ResourceInsert {
  source: "catalogo";
  org_id: null;
  is_active: true;
  access_links: [];
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
}

function mapRow(r: Row): ResourceInsert | null {
  const title = s(r["TITULO"]);
  if (!title) return null; // sin título no es un recurso válido
  return {
    source: "catalogo",
    org_id: null,
    is_active: true,
    access_links: [],
    isbn: s(r["ISBN"]),
    title,
    author: s(r["AUTOR"]),
    illustrator: s(r["ILUSTRADOR/ES"]),
    edition: s(r["EDICIÓN"]),
    publisher: s(r["EDITORIAL"]),
    pages: toInt(r["PÁGINAS"]),
    city: s(r["CIUDAD"]),
    published_year: s(r["FECHA DE PUBLICACIÓN"]),
    editorial_collection: s(r["COLECCIÓN EDITORIAL"]),
    genre: normGenre(r["GÉNERO"]),
    fundamental_areas: s(r["ÁREAS FUNDAMENTALES"]),
    keywords: toKeywords(r["PALABRAS CLAVE"]),
    reading_experience: normReadingExperience(r["EXPERIENCIA LECTORA"]),
    author_nationality: s(r["NACIONALIDAD DEL AUTOR"]),
    school_cycle: normSchoolCycle(r["CICLO ESCOLAR"]),
    collection: s(r["COLECCIÓN"]),
    tag_ethnicity: toTag(r["ETNIA"]),
    tag_afro: toTag(r["AFRO"]),
    tag_women: toTag(r["MUJERES"]),
    tag_disability: toTag(r["DISCAPACIDAD"]),
    synopsis: s(r["RESEÑA"]),
  };
}

async function main() {
  console.log(`Leyendo: ${XLSX_PATH}`);
  const wb = XLSX.readFile(XLSX_PATH);
  if (!wb.SheetNames.includes(SHEET)) {
    console.error(`No existe la hoja "${SHEET}". Hojas: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  const sheet = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  console.log(`Filas leídas: ${rows.length}`);

  const mapped = rows.map(mapRow).filter((x): x is ResourceInsert => x !== null);
  console.log(`Filas válidas (con título): ${mapped.length}`);

  // Separar por ISBN: con ISBN -> upsert; sin ISBN -> insert simple.
  const withIsbn = mapped.filter((m) => m.isbn);
  const withoutIsbn = mapped.filter((m) => !m.isbn);

  // Deduplicar por ISBN dentro del archivo (nos quedamos con el último).
  const byIsbn = new Map<string, ResourceInsert>();
  for (const m of withIsbn) byIsbn.set(m.isbn as string, m);
  const dedupWithIsbn = [...byIsbn.values()];
  if (withIsbn.length !== dedupWithIsbn.length) {
    console.log(
      `ISBN duplicados en el archivo: ${withIsbn.length - dedupWithIsbn.length} (se conserva el último de cada uno)`,
    );
  }

  let okWith = 0;
  for (let i = 0; i < dedupWithIsbn.length; i += BATCH_SIZE) {
    const batch = dedupWithIsbn.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("resources")
      .upsert(batch, { onConflict: "isbn" });
    if (error) {
      console.error(`Error en lote (con ISBN) ${i}:`, error.message);
      process.exit(1);
    }
    okWith += batch.length;
    console.log(`  upsert con ISBN: ${okWith}/${dedupWithIsbn.length}`);
  }

  // Filas sin ISBN: insertar solo si no hay ya catálogo cargado (evita duplicar en re-runs).
  let okWithout = 0;
  if (withoutIsbn.length) {
    const { count } = await supabase
      .from("resources")
      .select("id", { count: "exact", head: true })
      .is("isbn", null)
      .eq("source", "catalogo");
    if ((count ?? 0) > 0) {
      console.log(
        `Saltando ${withoutIsbn.length} filas sin ISBN (ya existen ${count} sin ISBN; evita duplicados).`,
      );
    } else {
      for (let i = 0; i < withoutIsbn.length; i += BATCH_SIZE) {
        const batch = withoutIsbn.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("resources").insert(batch);
        if (error) {
          console.error(`Error en lote (sin ISBN) ${i}:`, error.message);
          process.exit(1);
        }
        okWithout += batch.length;
        console.log(`  insert sin ISBN: ${okWithout}/${withoutIsbn.length}`);
      }
    }
  }

  const { count: total } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("source", "catalogo");

  console.log(`\n✅ Listo. Recursos de catálogo en la BD: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
