/**
 * Cuándo se abrió cada chat por última vez EN ESTE NAVEGADOR, para «Abierto
 * hoy» / «Abierto 2 sep» en Recientes (8b).
 *
 * Solo la ruta opaca del backup y una marca de tiempo, en localStorage: no
 * hay nombres de contactos ni contenido. Si el almacenamiento falla
 * (navegación privada, cuota), Recientes cae a la fecha de guardado.
 */

const CLAVE = "br:aperturas";

function leer(): Record<string, number> {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const datos = crudo ? JSON.parse(crudo) : {};
    return datos && typeof datos === "object" ? datos : {};
  } catch {
    return {};
  }
}

export function registrarApertura(ruta: string): void {
  if (typeof window === "undefined" || !ruta) return;
  try {
    const datos = leer();
    datos[ruta] = Date.now();
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    /* Sin almacenamiento no pasa nada: Recientes enseña la fecha de guardado. */
  }
}

export function ultimaApertura(ruta: string): number | null {
  if (typeof window === "undefined") return null;
  const ts = leer()[ruta];
  return typeof ts === "number" ? ts : null;
}

/** Borra el registro de un chat (al eliminarlo). */
export function olvidarApertura(ruta: string): void {
  if (typeof window === "undefined") return;
  try {
    const datos = leer();
    delete datos[ruta];
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    /* Igual que arriba. */
  }
}

/** «Hoy», «Ayer» o «2 sep», según el idioma. */
export function etiquetaApertura(ts: number, idioma: string, hoy = new Date()): "hoy" | "ayer" | string {
  const d = new Date(ts);
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(d, hoy)) return "hoy";
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, ayer)) return "ayer";
  return d.toLocaleDateString(idioma.startsWith("en") ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== hoy.getFullYear() ? { year: "numeric" } : {}),
  }).replace(".", "");
}
