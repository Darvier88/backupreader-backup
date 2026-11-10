/**
 * Sacar de un título de backup lo que hay que enseñar.
 *
 * Los nombres vienen como los dejó la exportación: "Chat de WhatsApp con Mamá
 * Tue, Sep 15, 2026, 07 PM", "WhatsApp Chat - Yuli Yepes.zip". Al usuario eso
 * no le dice nada que no sepa: él sabe que es un chat de WhatsApp, lo que
 * quiere ver es con quién.
 *
 * Estas funciones vivían dentro de `DashboardScreen`. Se sacan aquí porque el
 * inicio, el panel y los resultados de búsqueda tienen que nombrar los chats
 * igual: si cada pantalla recorta el título a su manera, el mismo chat aparece
 * con tres nombres distintos y parecen tres.
 */

/** Separa "Nombre  Tue, Sep 15, 2026, 07 PM" en nombre y fecha. */
export function partirTitulo(completo: string): { nombre: string; fecha: string } {
  if (!completo) return { nombre: "", fecha: "" };
  const m = completo.match(
    /^(.*?)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+.*(?:AM|PM))\s*$/i
  );
  if (m) {
    const fecha = m[2].trim().replace(/,\s*(\d{1,2}\s*[AP]M)\s*$/i, " · $1");
    return { nombre: m[1].trim(), fecha };
  }
  return { nombre: completo, fecha: "" };
}

/** El nombre del contacto, sin el envoltorio que pone la exportación. */
export function nombreDelContacto(titulo: string): string {
  if (!titulo) return "";
  return partirTitulo(titulo)
    .nombre.replace(/\.zip$/i, "")
    .replace(/^Chat de WhatsApp con\s+/i, "")
    .replace(/^WhatsApp Chat -\s*/i, "")
    .replace(/^Chat con\s+/i, "")
    .trim();
}

/**
 * Las iniciales para el avatar.
 *
 * Dos letras si hay dos palabras ("Yuli Yepes" → "YY"), y si no las dos
 * primeras del nombre ("TG" → "TG", "Mamá" → "MA"). Se usan iniciales y no
 * una foto porque no tenemos fotos: la exportación de WhatsApp no las trae, y
 * un avatar genérico repetido en toda la lista no distingue una fila de otra,
 * que es justo para lo que está ahí.
 */
export function iniciales(nombre: string): string {
  const limpio = nombreDelContacto(nombre) || (nombre || "").trim();
  if (!limpio) return "?";

  const palabras = limpio
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p));

  if (palabras.length === 0) return "?";

  if (palabras.length === 1) {
    /* Una sola palabra: sus dos primeras letras. Con una sola letra, todas las
       filas de un nombre que empiece igual se verían idénticas. */
    const sola = palabras[0].replace(/[^\p{L}\p{N}]/gu, "");
    return (sola.slice(0, 2) || "?").toUpperCase();
  }

  const primera = palabras[0].replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1);
  const segunda = palabras[1].replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1);
  return ((primera + segunda) || "?").toUpperCase();
}
