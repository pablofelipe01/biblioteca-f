import "server-only";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_BUCKET } from "@/lib/images";

export interface SignedImage {
  path: string;
  url: string;
}

/**
 * Firma rutas del bucket privado con la sesión del usuario (respeta las
 * políticas de Storage). Devuelve un mapa ruta → URL; las rutas que el usuario
 * no puede leer simplemente no aparecen.
 */
export async function signImagePaths(
  paths: (string | null | undefined)[],
  expiresIn = 60 * 60,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(unique, expiresIn);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

export function toSignedList(
  paths: string[] | null | undefined,
  urls: Record<string, string>,
): SignedImage[] {
  return (paths ?? [])
    .filter((p) => urls[p])
    .map((p) => ({ path: p, url: urls[p] }));
}
