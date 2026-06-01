/**
 * Datos de prueba para LeoAventura (login por ID + PIN).
 * Crea (idempotente):
 *   - 1 institución "Colegio Demo LeoAventura"
 *   - 1 admin, 3 profesores, 15 alumnos (5 por grado en 6A, 7B, 8C)
 *   - 1 aventura PUBLICADA por grado (3 misiones cada una)
 *
 * Login: ID de 8 dígitos + PIN = últimos 4 dígitos del ID.
 *
 * Uso:  npm run seed:test
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { idToEmail, pinFromId } from "../src/lib/login-id";

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

const ADMIN = { id: "10000000", name: "Admin Demo" };

const TEACHERS = [
  { id: "10000001", name: "Ana Pérez", grade: "6A" },
  { id: "10000002", name: "Beto Ríos", grade: "7B" },
  { id: "10000003", name: "Carla Díaz", grade: "8C" },
];

const STUDENT_NAMES = [
  "Sofía Gómez", "Mateo Ruiz", "Valentina Cruz", "Samuel León", "Isabella Mora",
  "Tomás Vega", "Luciana Pardo", "Emiliano Soto", "Martina Rey", "Joaquín Lara",
  "Camila Niño", "Daniel Ávila", "Antonia Cano", "Simón Bravo", "Renata Ortiz",
];

// 3 grados × 5 alumnos. IDs: 2000 0g xx (g=grado 0..2, xx=01..05)
const GRADES = ["6A", "7B", "8C"];
const STUDENTS = GRADES.flatMap((grade, g) =>
  Array.from({ length: 5 }, (_, i) => {
    const seq = (g * 100 + (i + 1)).toString().padStart(4, "0"); // 0001, 0101, 0201…
    return {
      id: `2000${seq}`,
      name: STUDENT_NAMES[g * 5 + i],
      grade,
    };
  }),
);

// Un par de alumnos de 10º (10A). IDs 200010xx -> PIN 1001/1002.
const EXTRA_STUDENTS = [
  { id: "20001001", name: "Mariana Castro", grade: "10A" },
  { id: "20001002", name: "Felipe Romero", grade: "10A" },
];
const ALL_STUDENTS = [...STUDENTS, ...EXTRA_STUDENTS];

// Fragmento ORIGINAL (sin derechos de terceros), apto para ~secundaria.
const EXCERPT = `La noche en que el faro dejó de girar, Mateo supo que algo andaba mal. Desde su ventana, en lo alto del pueblo, el haz de luz siempre barría el mar como un brazo paciente. Pero esa madrugada el faro quedó quieto, apuntando a un solo punto negro del océano, como si hubiera visto algo que no se atrevía a soltar.

Bajó corriendo por el sendero de piedras, con el corazón golpeándole las costillas. El viejo farero, don Elías, no contestaba. La puerta de hierro estaba entreabierta y, dentro, los engranajes descansaban cubiertos de una escarcha imposible para el verano. En el suelo, junto a una libreta abierta, había una sola frase escrita con letra temblorosa: "Si la luz se detiene, no la enciendas tú".

Mateo dudó. Afuera, las olas habían dejado de sonar. El silencio era tan espeso que podía oír su propia respiración. Entonces, en el punto negro que el faro señalaba, una luz pequeña parpadeó tres veces, como respondiendo a una pregunta que nadie había hecho todavía.`;

function missionsFor(assignmentId: string) {
  return [
    {
      assignment_id: assignmentId,
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
      assignment_id: assignmentId,
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
      assignment_id: assignmentId,
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
}

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
  role: "admin" | "profesor" | "alumno",
  orgId: string,
  grade: string | null,
): Promise<string> {
  const userId = await getOrCreateUser(idToEmail(num), pinFromId(num), {
    full_name: name,
    role,
    org_id: orgId,
    ...(grade ? { grade } : {}),
  });
  await supabase
    .from("profiles")
    .upsert({ id: userId, full_name: name, role, org_id: orgId, grade });
  return userId;
}

async function main() {
  console.log("→ Institución…");
  const orgId = await getOrCreateOrg();

  console.log("→ Admin…");
  await upsertUser(ADMIN.id, ADMIN.name, "admin", orgId, null);

  console.log("→ Profesores…");
  const teacherIds: Record<string, string> = {};
  for (const t of TEACHERS) {
    teacherIds[t.grade] = await upsertUser(t.id, t.name, "profesor", orgId, null);
  }

  console.log("→ Alumnos…");
  for (const s of ALL_STUDENTS) {
    await upsertUser(s.id, s.name, "alumno", orgId, s.grade);
  }

  // Un recurso real para la portada (opcional).
  const { data: resource } = await supabase
    .from("resources")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  console.log("→ Limpiando aventuras demo previas…");
  await supabase
    .from("assignments")
    .delete()
    .eq("org_id", orgId)
    .ilike("title", "Aventura%");

  console.log("→ Creando una aventura publicada por grado…");
  const due = new Date();
  due.setDate(due.getDate() + 14);
  // Carla Díaz (profe de 8C) también atiende 10A.
  const aventuraGrades = [
    { grade: "6A", teacherId: teacherIds["6A"] },
    { grade: "7B", teacherId: teacherIds["7B"] },
    { grade: "8C", teacherId: teacherIds["8C"] },
    { grade: "10A", teacherId: teacherIds["8C"] },
  ];
  for (const { grade, teacherId } of aventuraGrades) {
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .insert({
        org_id: orgId,
        teacher_id: teacherId,
        resource_id: resource?.id ?? null,
        title: `Aventura: El faro del fin del mundo · ${grade}`,
        chapter_label: "Fragmento de apertura",
        instructions:
          "Lee el fragmento con calma y completa las tres misiones. ¡Usa el tutor si tienes dudas!",
        excerpt_text: EXCERPT,
        grade,
        due_at: due.toISOString(),
        is_published: true,
      })
      .select("id")
      .single();
    if (aErr || !assignment) throw new Error(aErr?.message ?? "No se pudo crear la aventura");
    const { error: mErr } = await supabase.from("missions").insert(missionsFor(assignment.id));
    if (mErr) throw new Error(mErr.message);
  }

  // Reporte
  console.log("\n✅ Datos de prueba listos. Login = ID (8 díg) + PIN (últimos 4).\n");
  console.log("  Institución:", ORG_NAME);
  console.log("  ─────────────────────────────────────────────");
  console.log(`  ADMIN     ${ADMIN.id}  PIN ${pinFromId(ADMIN.id)}   ${ADMIN.name}`);
  console.log("  ─────────────────────────────────────────────");
  for (const t of TEACHERS) {
    console.log(
      `  PROFESOR  ${t.id}  PIN ${pinFromId(t.id)}   ${t.name}  (grado ${t.grade})`,
    );
  }
  console.log("  ─────────────────────────────────────────────");
  for (const s of ALL_STUDENTS) {
    console.log(
      `  ALUMNO    ${s.id}  PIN ${pinFromId(s.id)}   ${s.name}  (${s.grade})`,
    );
  }
  console.log("\n  Aventura publicada en cada grado: 6A, 7B, 8C y 10A.");
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
