/**
 * «Guardado hoy» / «Guardado ayer» / «Guardado 2 sep» en Recientes (8b).
 *
 * POR QUÉ LA FECHA DE GUARDADO Y NO LA DE APERTURA
 * ------------------------------------------------
 * Antes esto decía «Abierto hoy», y la última apertura se anotaba en el
 * `localStorage` del navegador. Eso quiere decir que era de ESE navegador:
 * quien abría un chat en el móvil y luego entraba desde el portátil veía dos
 * historiales distintos sin saber por qué, y ninguno de los dos mentía.
 *
 * La alternativa era guardar la apertura en el servidor, y ahí la cuenta sale
 * mal: por una lista mejor ordenada, el servidor pasaría a saber a qué hora
 * lee cada uno sus conversaciones. No es el contenido, pero sigue siendo algo
 * que hoy no sabe y que no necesita saber para nada.
 *
 * La fecha de guardado ya está en Firestore, porque es lo que se usa para la
 * cuota, así que no le cuenta nada nuevo a nadie, y es la misma en todos los
 * dispositivos porque es un dato del chat y no de quien lo mira.
 */

/** ¿Son el mismo día del calendario? */
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Devuelve `"hoy"`, `"ayer"` o una fecha corta («2 sep», «Sep 2»), según el
 * idioma de quien lee. El año solo aparece si no es el año en curso: en una
 * lista de chats recientes, repetir «2026» en cada fila es ruido.
 */
export function etiquetaDeGuardado(
  ts: number,
  idioma: string,
  hoy = new Date()
): "hoy" | "ayer" | string {
  const d = new Date(ts);
  if (mismoDia(d, hoy)) return "hoy";
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, ayer)) return "ayer";
  return d
    .toLocaleDateString(idioma.startsWith("en") ? "en-US" : "es-ES", {
      day: "numeric",
      month: "short",
      ...(d.getFullYear() !== hoy.getFullYear() ? { year: "numeric" } : {}),
    })
    .replace(".", "");
}
