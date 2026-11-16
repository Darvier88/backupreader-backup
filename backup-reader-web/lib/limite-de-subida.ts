/**
 * Tope del .zip que se sube.
 *
 * Los 200 MB de antes venían de la versión vieja, cuando una Cloud Function
 * descomprimía el .zip en el servidor. Ahora el .zip se abre en el navegador
 * entrada a entrada (zip.js lee el archivo por trozos, no lo carga entero) y
 * cada archivo de dentro se cifra por bloques; el único tope real es
 * MAX_ENCRYPT_BYTES (1 GiB por archivo de dentro), que también aplican las
 * reglas de Storage. 2 GB deja entrar casi cualquier export de WhatsApp sin
 * dejar que un archivo enorme se quede a medias en un móvil con poca memoria.
 */
/* En bytes decimales, para que el aviso diga «2 GB» y no «2,1 GB». */
export const MAX_ZIP_BYTES = 2_000_000_000;

const PREFIJO = "zip-too-big:";

/** Código de error para AvisoDeErrores, con el tamaño del .zip dentro. */
export const codigoZipGrande = (bytes: number) => `${PREFIJO}${bytes}`;

/** El tamaño que lleva el código, o null si no es este error. */
export function bytesDeZipGrande(codigo: string): number | null {
  if (!codigo.startsWith(PREFIJO)) return null;
  const n = Number(codigo.slice(PREFIJO.length));
  return Number.isFinite(n) ? n : null;
}
