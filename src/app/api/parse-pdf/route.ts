import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";

export const runtime = "nodejs";

// Vercel limita el cuerpo de una función serverless a ~4.5 MB. Mantente por
// debajo para que la petición llegue al handler (y no la rechace la plataforma
// con un HTML de error antes de ejecutarse).
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(req: NextRequest) {
  const session = await getSessionProfile();
  if (!session?.profile) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!["profesor", "admin"].includes(session.profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Falta el archivo PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El PDF supera el tamaño máximo (4 MB). Usa uno más liviano o pega el texto a mano." },
      { status: 413 },
    );
  }

  try {
    // Import dinámico: si la carga del módulo (o su binario nativo) falla en el
    // entorno serverless, lo capturamos aquí y respondemos JSON en vez de HTML.
    const { PDFParse } = await import("pdf-parse");

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const text = (result.text ?? "").replace(/\s+\n/g, "\n").trim();
    if (!text) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del PDF (¿es un PDF escaneado?)." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, pages: result.total ?? result.pages?.length ?? 0 });
  } catch (err) {
    console.error("parse-pdf error:", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      { error: "No se pudo procesar el PDF.", detail },
      { status: 500 },
    );
  }
}
