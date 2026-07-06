/**
 * Carga los usuarios del piloto "Grupo Postalfabetización Fundación Guaicaramo".
 * Crea (idempotente):
 *   - 1 institución "Fundación Guaicaramo"
 *   - 1 docente (Andrea Ramírez Matiz)
 *   - 24 participantes (alumnos), curso "PA-2026"
 *
 * Login: número de documento + PIN = últimos 4 dígitos del documento.
 * (Ver src/lib/login-id.ts — el documento se mapea a un email interno.)
 *
 * Uso:  npm run seed:guaicaramo
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { idToEmail, pinFromId, isValidId } from "../src/lib/login-id";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* las variables podrían venir ya del entorno */
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_NAME = "Fundación Guaicaramo";
const GRADE = "PA-2026";

const TEACHER = { id: "1122626594", name: "Andrea Ramírez Matiz" };

// 24 participantes: [documento (T.I.), nombre completo].
const STUDENTS: { id: string; name: string }[] = [
  { id: "1122628179", name: "Juan Pablo Molina Parra" },
  { id: "1063972790", name: "Joel David Sánchez García" },
  { id: "1122628189", name: "Gabriela Hortua González" },
  { id: "1122627653", name: "Kalleth Johanny Vallejo Ricaurte" },
  { id: "1129245192", name: "Juliana Andrea González Buitrago" },
  { id: "1124244798", name: "Tahianna Ramírez Arteaga" },
  { id: "1122628079", name: "Mayra Valentina Bonilla Gaitan" },
  { id: "1118575925", name: "Gabriel Zaeed Chona Gómez" },
  { id: "1122628138", name: "Danna Nahomi González Machado" },
  { id: "1027301429", name: "Ángel Felipe Bonilla Sarmiento" },
  { id: "1122627918", name: "Keyler Daniel Romero Rey" },
  { id: "1230344194", name: "Julián David Vergara Durango" },
  { id: "1122628119", name: "Samuel Jacobo Díaz Varela" },
  { id: "1122534386", name: "Jerónimo Murillo Cortes" },
  { id: "1122627994", name: "Kamila Andrea Matiz Villalba" },
  { id: "1122628207", name: "Samy Elizabeth Barrera Diaz" },
  { id: "1063972149", name: "Sheryl Johana Villarreal López" },
  { id: "1230343416", name: "Jazlyn Amaury Garzón Bohorquez" },
  { id: "1029969035", name: "Mariana Rincon Mora" },
  { id: "1029967689", name: "Jefer Stiven Calderón Galán" },
  { id: "1144725752", name: "María José Nieto Muñoz" },
  { id: "1122628305", name: "Ian Daniel Casas León" },
  { id: "1088352029", name: "Samara Torres Cabezas" },
  { id: "1122627667", name: "Dilan Estiven Ubaque Moreno" },
];

async function getOrCreateOrg(): Promise<string> {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la org");
  return data.id;
}

async function findUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function getOrCreateUser(
  email: string,
  password: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (data?.user) return data.user.id;
  if (error && /already|registered|exists/i.test(error.message)) {
    const id = await findUserByEmail(email);
    if (id) {
      // aseguramos que el PIN (password) quede correcto aunque ya existiera
      await supabase.auth.admin.updateUserById(id, { password });
      return id;
    }
  }
  throw new Error(`No se pudo crear/obtener ${email}: ${error?.message}`);
}

async function upsertUser(
  num: string,
  name: string,
  role: "profesor" | "alumno",
  orgId: string,
  grade: string | null,
): Promise<void> {
  if (!isValidId(num)) throw new Error(`Documento inválido: ${num} (${name})`);
  const userId = await getOrCreateUser(idToEmail(num), pinFromId(num), {
    full_name: name,
    role,
    org_id: orgId,
    ...(grade ? { grade } : {}),
  });
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, full_name: name, role, org_id: orgId, grade });
  if (error) throw new Error(`profiles ${name}: ${error.message}`);
}

async function main() {
  // Verificación temprana: documentos duplicados romperían la unicidad de login.
  const ids = [TEACHER.id, ...STUDENTS.map((s) => s.id)];
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`Documento duplicado en la lista: ${dup}`);

  console.log("→ Institución…");
  const orgId = await getOrCreateOrg();

  console.log("→ Docente…");
  await upsertUser(TEACHER.id, TEACHER.name, "profesor", orgId, null);

  console.log(`→ ${STUDENTS.length} participantes (curso ${GRADE})…`);
  for (const s of STUDENTS) {
    await upsertUser(s.id, s.name, "alumno", orgId, GRADE);
  }

  console.log("\n✅ Grupo cargado. Login = documento + PIN (últimos 4 dígitos).\n");
  console.log("  Institución:", ORG_NAME, "· Curso:", GRADE);
  console.log("  ─────────────────────────────────────────────");
  console.log(
    `  DOCENTE   ${TEACHER.id}  PIN ${pinFromId(TEACHER.id)}   ${TEACHER.name}`,
  );
  console.log("  ─────────────────────────────────────────────");
  for (const s of STUDENTS) {
    console.log(`  ALUMNO    ${s.id}  PIN ${pinFromId(s.id)}   ${s.name}`);
  }
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
