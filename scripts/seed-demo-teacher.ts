/**
 * Usuarios de DEMOSTRACIÓN dentro de una institución existente (idempotente):
 *   - 1 docente (sin curso fijo: puede asignar tareas a cualquier curso)
 *   - alumnos ficticios en varios cursos "DEMO-*", para mostrar el lado alumno
 * No toca a los usuarios reales del grupo.
 *
 * Los documentos de demo empiezan por 9 y los nombres llevan "(demo)" para que
 * nunca se confundan con los participantes reales (menores).
 *
 * Login: número de documento + PIN = últimos 4 dígitos del documento.
 *
 * Uso:  npm run seed:demo-teacher
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

// El docente no se ata a un curso: `grade` va en null y puede crear tareas
// para cualquier curso de su institución.
const TEACHER = { id: "79454772", name: "Pablo Acebedo" };

// Alumnos ficticios en 3 cursos de demo. Documento 9000ggnn → PIN = ggnn.
const DEMO_STUDENTS: { id: string; name: string; grade: string }[] = [
  { id: "90000601", name: "Sofía Gómez (demo)", grade: "DEMO-6A" },
  { id: "90000602", name: "Mateo Ruiz (demo)", grade: "DEMO-6A" },
  { id: "90000603", name: "Valentina Cruz (demo)", grade: "DEMO-6A" },
  { id: "90000901", name: "Tomás Vega (demo)", grade: "DEMO-9B" },
  { id: "90000902", name: "Luciana Pardo (demo)", grade: "DEMO-9B" },
  { id: "90000903", name: "Emiliano Soto (demo)", grade: "DEMO-9B" },
  { id: "90001101", name: "Camila Niño (demo)", grade: "DEMO-11A" },
  { id: "90001102", name: "Daniel Ávila (demo)", grade: "DEMO-11A" },
  { id: "90001103", name: "Antonia Cano (demo)", grade: "DEMO-11A" },
];

async function findOrg(): Promise<string> {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .maybeSingle();
  if (!data) {
    throw new Error(
      `No existe la institución "${ORG_NAME}". Corre primero el seed del grupo.`,
    );
  }
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
      await supabase.auth.admin.updateUserById(id, { password, user_metadata: metadata });
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
  // Documentos duplicados romperían la unicidad de login.
  const ids = [TEACHER.id, ...DEMO_STUDENTS.map((s) => s.id)];
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`Documento duplicado en la lista: ${dup}`);

  console.log("→ Institución…");
  const orgId = await findOrg();

  console.log("→ Docente…");
  await upsertUser(TEACHER.id, TEACHER.name, "profesor", orgId, null);

  console.log(`→ ${DEMO_STUDENTS.length} alumnos de demo…`);
  for (const s of DEMO_STUDENTS) {
    await upsertUser(s.id, s.name, "alumno", orgId, s.grade);
  }

  console.log("\n✅ Usuarios de demo listos. Login = documento + PIN (últimos 4).\n");
  console.log("  Institución:", ORG_NAME);
  console.log("  ─────────────────────────────────────────────");
  console.log(
    `  DOCENTE   ${TEACHER.id}  PIN ${pinFromId(TEACHER.id)}   ${TEACHER.name}`,
  );
  console.log("  ─────────────────────────────────────────────");
  for (const s of DEMO_STUDENTS) {
    console.log(
      `  ALUMNO    ${s.id}  PIN ${pinFromId(s.id)}   ${s.name}  (${s.grade})`,
    );
  }
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
