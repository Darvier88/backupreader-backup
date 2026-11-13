/**
 * «Buscar en tus chats» del panel lateral y ⌘K desde cualquier pantalla (12d).
 *
 * El buscador general vive en el inicio (InicioChats). Desde otro sitio —un
 * chat abierto, Mi cuenta— hay que ir primero al inicio y, cuando el campo ya
 * esté montado, darle el foco. Por eso no basta con un evento: el campo puede
 * no existir todavía cuando se pide. Se deja una marca que el campo mira al
 * montarse, y además se avisa por si ya está en pantalla.
 */
const EVENTO = "br:buscar";
let pendiente = false;

export function pedirBusqueda(): void {
  pendiente = true;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

/** La consume el buscador: devuelve si había una petición y la borra. */
export function tomarBusquedaPendiente(): boolean {
  const habia = pendiente;
  pendiente = false;
  return habia;
}

export function alPedirBusqueda(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}
