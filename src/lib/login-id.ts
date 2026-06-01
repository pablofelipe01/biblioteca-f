// Login por ID + PIN (§ flujo real: usuarios pregrabados).
// Supabase Auth usa email+contraseña, así que mapeamos el ID de 8 dígitos a un
// email interno y el PIN (últimos 4 del ID) es la contraseña.
// Este módulo es PURO (sin imports de Next) para poder usarlo también en scripts.

export const LOGIN_EMAIL_DOMAIN = "leoaventura.local";

/** Convierte un ID de 8 dígitos en el email interno usado por Supabase Auth. */
export function idToEmail(id: string): string {
  return `${id.trim()}@${LOGIN_EMAIL_DOMAIN}`;
}

/** El PIN son los últimos 4 dígitos del ID. */
export function pinFromId(id: string): string {
  return id.trim().slice(-4);
}

/** Valida que el ID tenga exactamente 8 dígitos. */
export function isValidId(id: string): boolean {
  return /^\d{8}$/.test(id.trim());
}

/** Valida que el PIN tenga exactamente 4 dígitos. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin.trim());
}
