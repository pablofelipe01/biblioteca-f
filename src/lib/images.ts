// Imágenes (referencias del docente y respuestas del alumno) en el bucket
// privado `leo-images`. Las rutas se guardan en BD; para mostrarlas el servidor
// genera URLs firmadas (ver `signImagePaths` en images-server.ts).

export const IMAGE_BUCKET = "leo-images";
export const MAX_IMAGES = 4;

/** Lado mayor máximo al redimensionar en el navegador (ahorra datos en zonas rurales). */
const MAX_SIDE = 1600;

export type ImageFolder = "refs" | `answers/${string}`;

/** Ruta válida de respuesta para un alumno concreto. */
export function isOwnAnswerPath(path: string, orgId: string, studentId: string): boolean {
  return (
    path.startsWith(`${orgId}/answers/${studentId}/`) &&
    !path.includes("..")
  );
}

/**
 * Reduce la imagen a JPEG de máx. 1600 px antes de subirla. Los GIF se suben
 * tal cual para no perder la animación.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
