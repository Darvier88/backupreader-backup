/**
 * Tope del .zip que se sube.
 *
 * Los 200 MB de antes venían de la versión vieja, cuando una Cloud Function
 * descomprimía el .zip en el servidor. Ahora el .zip se abre en el navegador
 * entrada a entrada (zip.js lee el archivo por trozos, no lo carga entero) y
 * cada archivo de dentro se cifra por bloques; el único tope real es
 * MAX_ENCRYPT_BYTES (1 GiB por archivo de dentro), que también aplican las
 * reglas de Storage.
 */
/* En bytes decimales, para que el aviso diga «3 GB» y no «3,2 GB».
   Subir de 2 a 3 GB no cambia la memoria: el pico lo marca el archivo más
   grande de dentro (tope de 1 GiB), no el .zip entero. Lo que crece es el
   tiempo de subida; para eso están el wake lock y los reintentos al volver
   a la pestaña (StorageContext `subir`, LoadingComponent). */
export const MAX_ZIP_BYTES = 3_000_000_000;

const PREFIJO = "zip-too-big:";
/* Lo que se pasa de tamaño es una conversación de Instagram, no el .zip. El
   consejo que hay que dar es otro: allí no existe «exportar sin archivos», y
   lo que pesa es la conversación elegida, no la descarga entera. */
const PREFIJO_HILO = "hilo-too-big:";

/** Código de error para AvisoDeErrores, con el tamaño dentro. */
export const codigoZipGrande = (bytes: number, deInstagram = false) =>
  `${deInstagram ? PREFIJO_HILO : PREFIJO}${bytes}`;

/** El tamaño que lleva el código, o null si no es este error. */
export function bytesDeZipGrande(codigo: string): number | null {
  const prefijo = codigo.startsWith(PREFIJO_HILO) ? PREFIJO_HILO : PREFIJO;
  if (!codigo.startsWith(prefijo)) return null;
  const n = Number(codigo.slice(prefijo.length));
  return Number.isFinite(n) ? n : null;
}

/** Si el que se pasó de tamaño era una conversación de Instagram. */
export const esHiloGrande = (codigo: string) => codigo.startsWith(PREFIJO_HILO);
