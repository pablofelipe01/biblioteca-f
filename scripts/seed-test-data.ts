/**
 * Datos de prueba para LeoAventura.
 * Crea (idempotente):
 *   - 1 institución "Colegio Demo LeoAventura"
 *   - 1 profesor  (profe.demo@leoaventura.test)
 *   - 1 alumno    (alumno.demo@leoaventura.test) — mismo org_id y grade "7B"
 *   - 1 aventura PUBLICADA con un fragmento original + 3 misiones (quiz, abierta, creativa)
 *
 * Uso:  npm run seed:test
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

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

const ORG_NAME = "Colegio Demo LeoAventura";
const GRADE = "7B";
const PASSWORD = "Demo1234!";
const PROFE_EMAIL = "profe.demo@leoaventura.test";
const ALUMNO_EMAIL = "alumno.demo@leoaventura.test";
const ASSIGNMENT_TITLE = "Aventura demo: El faro del fin del mundo";

// Fragmento ORIGINAL (sin derechos de terceros), apto para ~7º grado.
const EXCERPT = `La noche en que el faro dejó de girar, Mateo supo que algo andaba mal. Desde su ventana, en lo alto del pueblo, el haz de luz siempre barría el mar como un brazo paciente. Pero esa madrugada el faro quedó quieto, apuntando a un solo punto negro del océano, como si hubiera visto algo que no se atrevía a soltar.

Bajó corriendo por el sendero de piedras, con el corazón golpeándole las costillas. El viejo farero, don Elías, no contestaba. La puerta de hierro estaba entreabierta y, dentro, los engranajes descansaban cubiertos de una escarcha imposible para el verano. En el suelo, junto a una libreta abierta, había una sola frase escrita con letra temblorosa: "Si la luz se detiene, no la enciendas tú".

Mateo dudó. Afuera, las olas habían dejado de sonar. El silencio era tan espeso que podía oír su propia respiración. Entonces, en el punto negro que el faro señalaba, una luz pequeña parpadeó tres veces, como respondiendo a una pregunta que nadie había hecho todavía.`;

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
  // listUsers está paginado; recorremos hasta encontrarlo.
  for (let page = 1; page <= 20; page++) {
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
  metadata: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (data?.user) return data.user.id;
  // Si ya existe, lo buscamos.
  if (error && /already|registered|exists/i.test(error.message)) {
    const id = await findUserByEmail(email);
    if (id) return id;
  }
  throw new Error(`No se pudo crear/obtener ${email}: ${error?.message}`);
}

async function main() {
  console.log("→ Institución…");
  const orgId = await getOrCreateOrg();

  console.log("→ Profesor…");
  const profeId = await getOrCreateUser(PROFE_EMAIL, {
    full_name: "Profe Demo",
    role: "profesor",
    org_id: orgId,
  });

  console.log("→ Alumno…");
  const alumnoId = await getOrCreateUser(ALUMNO_EMAIL, {
    full_name: "Alumno Demo",
    role: "alumno",
    org_id: orgId,
    grade: GRADE,
  });

  // Aseguramos rol/org/grade en profiles (por si el trigger no recibió metadata).
  await supabase
    .from("profiles")
    .upsert({ id: profeId, full_name: "Profe Demo", role: "profesor", org_id: orgId });
  await supabase.from("profiles").upsert({
    id: alumnoId,
    full_name: "Alumno Demo",
    role: "alumno",
    org_id: orgId,
    grade: GRADE,
  });

  // Un recurso real del catálogo para la portada (opcional).
  const { data: resource } = await supabase
    .from("resources")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // Aventura limpia: borramos la demo previa de este profe (cascade borra misiones/entregas).
  console.log("→ Limpiando aventura demo previa (si existe)…");
  await supabase
    .from("assignments")
    .delete()
    .eq("teacher_id", profeId)
    .eq("title", ASSIGNMENT_TITLE);

  console.log("→ Creando aventura publicada…");
  const due = new Date();
  due.setDate(due.getDate() + 14);
  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .insert({
      org_id: orgId,
      teacher_id: profeId,
      resource_id: resource?.id ?? null,
      title: ASSIGNMENT_TITLE,
      chapter_label: "Fragmento de apertura",
      instructions:
        "Lee el fragmento con calma y completa las tres misiones. ¡Usa el tutor si tienes dudas!",
      excerpt_text: EXCERPT,
      grade: GRADE,
      due_at: due.toISOString(),
      is_published: true,
    })
    .select("id")
    .single();
  if (aErr || !assignment) throw new Error(aErr?.message ?? "No se pudo crear la aventura");

  console.log("→ Creando misiones…");
  const missions = [
    {
      assignment_id: assignment.id,
      mission_number: 1,
      type: "quiz",
      title: "El secreto del faro",
      points: 10,
      data: {
        question: "¿Qué frase encontró Mateo escrita en la libreta de don Elías?",
        options: [
          "“Enciende la luz cuanto antes”",
          "“Si la luz se detiene, no la enciendas tú”",
          "“El mar guarda todos los secretos”",
          "“Vuelve a casa antes del amanecer”",
        ],
        correct_index: 1,
        explanation:
          "La libreta advertía: “Si la luz se detiene, no la enciendas tú”, lo que aumenta el misterio.",
      },
    },
    {
      assignment_id: assignment.id,
      mission_number: 2,
      type: "open",
      title: "Tu interpretación",
      points: 15,
      data: {
        prompt:
          "¿Por qué crees que la advertencia dice que Mateo NO debe encender la luz? Argumenta con pistas del fragmento.",
        rubric:
          "Una buena respuesta conecta la advertencia con detalles del texto (la escarcha imposible, el silencio, la luz que parpadea) y propone una interpretación razonada.",
      },
    },
    {
      assignment_id: assignment.id,
      mission_number: 3,
      type: "creative",
      title: "Tu turno de crear",
      points: 20,
      data: {
        prompt:
          "Escribe qué pasa justo después de que la luz parpadea tres veces. ¿Qué hace Mateo?",
        min_words: 40,
      },
    },
  ];
  const { error: mErr } = await supabase.from("missions").insert(missions);
  if (mErr) throw new Error(mErr.message);

  console.log("\n✅ Datos de prueba listos.\n");
  console.log("  Institución:", ORG_NAME, `(${orgId})`);
  console.log("  ──────────────────────────────────────────");
  console.log("  PROFESOR  →", PROFE_EMAIL, "/", PASSWORD);
  console.log("  ALUMNO    →", ALUMNO_EMAIL, "/", PASSWORD, `(grado ${GRADE})`);
  console.log("  ──────────────────────────────────────────");
  console.log("  Aventura publicada:", ASSIGNMENT_TITLE, "con 3 misiones.");
  console.log("\n  Entra a /login, prueba el alumno en /mis-tareas y el profe en /tareas.");
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
