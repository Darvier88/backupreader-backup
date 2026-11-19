/**
 * El análisis, cifrado y guardado como una pieza más del backup.
 *
 * POR QUÉ SE GUARDA
 * -----------------
 * Calcularlo cuesta unos segundos en un chat grande, y los ajustes no cambian
 * casi nunca. Guardar el resultado convierte abrir la pestaña en algo
 * instantáneo a partir de la segunda vez.
 *
 * DÓNDE, Y POR QUÉ AHÍ
 * --------------------
 * En `backups/{uid}/{backupId}/p/ana`, el mismo sitio que las piezas normales
 * y que el índice de búsqueda, con un id fijo en vez de un UUID. Las reglas
 * de Storage ya permiten escribir en `p/{pieceId}` sin mirar la forma del id,
 * así que no hay que tocar `storage.rules` ni desplegarlas, que es la parte
 * peligrosa: ese archivo reemplaza por completo las reglas que haya en la
 * consola. El id fijo no puede chocar con una pieza real, porque los ids de
 * pieza son UUID y "ana" no lo es.
 *
 * Al vivir dentro del prefijo del backup, el borrado del chat se la lleva por
 * delante sin saber que existe: barre el prefijo entero.
 *
 * QUÉ LLEVA DENTRO, Y QUÉ NO
 * --------------------------
 * El resultado del análisis —cifras e índices de mensaje— y la elección de
 * «quién eres tú». NO lleva texto del chat: los ejemplos son posiciones, y
 * quien los enseña va a buscar el mensaje a la lista descifrada en memoria.
 * Aun así va cifrado con la misma DEK y el mismo AAD que cualquier pieza, así
 * que el servidor no puede leerlo ni colar el análisis de un backup en otro.
 *
 * UNA VERSIÓN VIEJA NO ES UN ERROR
 * --------------------------------
 * Si la forma del resultado cambió, o los ajustes guardados no son los que se
 * piden ahora, esto devuelve null y quien llama recalcula. Es trabajo
 * pendiente, no un fallo.
 */

import {
  packPiece,
  openPiece,
  encryptFile,
  pieceAad,
  piecePath,
} from "../backupreader-crypto";

import { VERSION_ANALISIS, type Analisis } from "./analizar";

/** Id fijo de la pieza. No es un UUID, así que no choca con ninguna real. */
export const ID_PIEZA_ANALISIS = "ana";

/** Lo que se guarda: el análisis, más lo que el usuario eligió a mano. */
export type AnalisisGuardado = {
  v: number;
  /** El resultado completo. */
  analisis: Analisis;
  /**
   * Quién es «tú» en este chat.
   *
   * Va aquí dentro y no en localStorage: localStorage es de un navegador, se
   * pierde al cambiar de dispositivo o al limpiar el sitio, y además dejaría
   * un nombre de la conversación guardado en claro fuera de la bóveda.
   */
  yo?: string;
  /**
   * El formato de fecha que el usuario confirmó a mano.
   *
   * Solo hace falta cuando el chat no lo demuestra (ningún día pasa del 12).
   * Va aquí y no en localStorage por lo mismo que `yo`: se perdería al
   * cambiar de dispositivo, y entonces el chat volvería a enseñar las
   * métricas en espera como si nunca se hubiera preguntado.
   */
  diaPrimero?: boolean;
  /**
   * Las métricas que el usuario marcó con «Esto no cuadra».
   *
   * Qué métrica y cuándo, nada más: ni texto del chat, ni nombres, ni las
   * cifras que se estaban enseñando. Van aquí dentro, cifradas con el resto,
   * por lo mismo que la elección de «quién eres tú»: es una nota sobre esta
   * conversación y no tiene por qué salir de la bóveda.
   */
  senales?: Array<{ metrica: string; cuando: number }>;
  /** Cuándo se calculó, para poder decirlo si hace falta. */
  cuando: number;
};

export const rutaDelAnalisis = (uid: string, backupId: string) =>
  piecePath(uid, backupId, ID_PIEZA_ANALISIS);

const aadDelAnalisis = (backupId: string) => pieceAad(backupId, ID_PIEZA_ANALISIS);

/** Cifra el análisis y lo deja listo para subir. */
export async function empaquetarAnalisis(
  guardado: AnalisisGuardado,
  dek: Uint8Array,
  backupId: string
): Promise<Blob> {
  const json = new Blob([JSON.stringify(guardado)], { type: "application/json" });
  const enc = await encryptFile(json, dek, { aad: aadDelAnalisis(backupId) });
  return packPiece(enc);
}

/** ¿Sirve lo guardado para lo que se pide ahora? */
export function analisisVigente(
  guardado: AnalisisGuardado | null,
  ajustes: Analisis["ajustes"]
): boolean {
  if (!guardado || guardado.v !== VERSION_ANALISIS) return false;
  const a = guardado.analisis?.ajustes;
  if (!a) return false;
  return (
    a.umbralHoras === ajustes.umbralHoras &&
    a.medida === ajustes.medida &&
    a.idioma === ajustes.idioma
  );
}

/**
 * Descifra un análisis descargado.
 *
 * `null` si no se puede usar: de otra versión, con otros ajustes o corrupto.
 * Quien llama lo recalcula.
 */
export async function abrirAnalisis(
  blob: Blob,
  dek: Uint8Array,
  backupId: string
): Promise<AnalisisGuardado | null> {
  try {
    const plano = await openPiece(blob, dek, {
      mime: "application/json",
      aad: aadDelAnalisis(backupId),
    });
    const datos = JSON.parse(await plano.text()) as AnalisisGuardado;
    return datos && datos.v === VERSION_ANALISIS ? datos : null;
  } catch (error) {
    console.warn("El análisis de", backupId, "no se pudo leer:", error);
    return null;
  }
}

/**
 * Guarda el análisis de un chat.
 *
 * Recibe `subir` y `anotarTamano` en vez de hablar con Firebase por su cuenta,
 * para poder probarlo con dobles y no arrastrar aquí la sesión.
 *
 * `anotarTamano` existe porque el espacio ocupado NO lo suma Storage: sale de
 * `cipherBytes` en el registro del backup, que se escribe al subirlo. Sin
 * avisar, esta pieza ocuparía sitio sin aparecer en la cuenta que ve el
 * usuario. Se pasa el tamaño de la pieza y el de la anterior, si la había,
 * para que quien lleva la cuenta no sume dos veces al recalcular.
 */
export async function guardarAnalisis(args: {
  uid: string;
  backupId: string;
  guardado: AnalisisGuardado;
  dek: Uint8Array;
  subir: (ruta: string, blob: Blob) => Promise<void>;
  anotarTamano?: (bytes: number) => Promise<void>;
}): Promise<number> {
  const blob = await empaquetarAnalisis(args.guardado, args.dek, args.backupId);
  await args.subir(rutaDelAnalisis(args.uid, args.backupId), blob);
  await args.anotarTamano?.(blob.size);
  return blob.size;
}
