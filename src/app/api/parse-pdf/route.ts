import { NextResponse, type NextRequest } from "next/server";
import { PDFParse } from "pdf-parse";
import { getSessionProfile } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

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
      { error: "El PDF supera el tamaño máximo (15 MB)." },
      { status: 413 },
    );
  }

  try {
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
    return NextResponse.json(
      { error: "No se pudo procesar el PDF." },
      { status: 500 },
    );
  }
}
