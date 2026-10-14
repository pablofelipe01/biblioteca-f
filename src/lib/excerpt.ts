// Convierte el fragmento pegado por el docente en párrafos legibles.
//
// - Si el texto trae líneas en blanco, esas separan párrafos (y los saltos
//   simples dentro de un párrafo se respetan, p. ej. en poesía).
// - Si no, cada salto de línea es un párrafo (lo habitual al copiar de Word).
// - En ambos casos se unen las líneas cortadas a la mitad de una oración
//   (típico al copiar de un PDF): la línea anterior es larga y no termina en
//   puntuación, y la siguiente empieza en minúscula. Las líneas cortas (versos)
//   no se unen.

const ENDS_SENTENCE = /[.!?…:;»"”)\]]$/;
const STARTS_LOWER = /^[a-záéíóúüñ]/;
const MIN_WRAPPED_LINE = 40;

function unwrap(lines: string[]): string[] {
  const out: string[] = [];
  let prevLine = ""; // última línea física (no el párrafo acumulado)
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    const wrapped =
      !!prev &&
      prevLine.length >= MIN_WRAPPED_LINE &&
      !ENDS_SENTENCE.test(prevLine) &&
      STARTS_LOWER.test(line);
    prevLine = line;
    if (wrapped) {
      out[out.length - 1] = prev.endsWith("-")
        ? prev.slice(0, -1) + line
        : `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

export function toParagraphs(text: string): string[] {
  const t = text.replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  if (/\n[ \t]*\n/.test(t)) {
    return t
      .split(/\n[ \t]*\n+/)
      .map((block) => unwrap(block.split("\n")).join("\n"))
      .filter(Boolean);
  }
  return unwrap(t.split("\n"));
}
