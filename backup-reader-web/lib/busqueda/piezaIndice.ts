/**
 * El índice, cifrado y empaquetado como una pieza más del backup.
 *
 * DÓNDE VIVE Y POR QUÉ AHÍ
 * ------------------------
 * En `backups/{uid}/{backupId}/p/idx`, o sea en el mismo sitio que las piezas
 * normales, con un id fijo en vez de un UUID.
 *
 * Las alternativas eran peores. Una ruta nueva, tipo `.../index`, obligaría a
 * cambiar `storage.rules` y a desplegarlas, y ese archivo reemplaza por
 * completo las reglas que haya en la consola: un despliegue con prisa es la
 * forma de dejar una colección viva sin reglas. Anotar el índice en el
 * manifiesto obligaría a reescribirlo, y el manifiesto es lo único que sabe
 * dónde está cada pieza del backup: tocarlo para añadir una comodidad de
 * búsqueda arriesga el backup entero.
 *
 * Con un id fijo no hace falta ninguna de las dos cosas. Las reglas ya
 * permiten escribir en `p/{pieceId}` sin mirar la forma del id, y el índice se
 * pide directamente por su ruta sin leer antes el manifiesto, que es
 * justamente lo que hace rápida la búsqueda.
 *
 * El id fijo no puede chocar con una pieza real: los ids de pieza los genera
 * `newId()`, que devuelve UUID, y "idx" no lo es.
 *
 * El AAD es el mismo que el de cualquier pieza, así que el servidor tampoco
 * puede colar el índice de un backup en otro.
 */

import {
  packPiece,
  openPiece,
  encryptFile,
  pieceAad,
  piecePath,
} from "../backupreader-crypto";

import {
  construirIndice,
  indiceVigente,
  ID_PIEZA_INDICE,
  type IndiceChat,
} from "./indice";

/** Dónde está el índice de este backup. */
export const rutaDelIndice = (uid: string, backupId: string) =>
  piecePath(uid, backupId, ID_PIEZA_INDICE);

const aadDelIndice = (backupId: string) => pieceAad(backupId, ID_PIEZA_INDICE);

/** Cifra un índice y lo deja listo para subir. */
export async function empaquetarIndice(
  indice: IndiceChat,
  dek: Uint8Array
): Promise<Blob> {
  const json = new Blob([JSON.stringify(indice)], { type: "application/json" });
  const enc = await encryptFile(json, dek, { aad: aadDelIndice(indice.backupId) });
  return packPiece(enc);
}

/**
 * Descifra un índice descargado.
 *
 * Devuelve null en vez de lanzar cuando el contenido no es un índice utilizable
 * —de otra versión del formato, o corrupto—. Quien llama lo trata como "este
 * chat no está indexado" y lo vuelve a indexar, que es exactamente lo que hay
 * que hacer: un índice viejo no es un error, es trabajo pendiente.
 */
export async function abrirIndice(
  blob: Blob,
  dek: Uint8Array,
  backupId: string
): Promise<IndiceChat | null> {
  try {
    const plano = await openPiece(blob, dek, {
      mime: "application/json",
      aad: aadDelIndice(backupId),
    });
    const datos = JSON.parse(await plano.text());
    return indiceVigente(datos) ? datos : null;
  } catch (error) {
    console.warn("El índice de", backupId, "no se pudo leer:", error);
    return null;
  }
}

/**
 * Construye el índice de un chat ya descifrado y lo deja subido.
 *
 * Recibe `subir` y no lo hace por su cuenta para no arrastrar aquí la sesión
 * de Firebase: esto se puede probar con un doble.
 */
export async function indexarYSubir(args: {
  uid: string;
  backupId: string;
  nombre: string;
  filas: string[][];
  dek: Uint8Array;
  subir: (ruta: string, blob: Blob) => Promise<void>;
}): Promise<IndiceChat> {
  const indice = construirIndice({
    backupId: args.backupId,
    nombre: args.nombre,
    filas: args.filas,
  });
  const blob = await empaquetarIndice(indice, args.dek);
  await args.subir(rutaDelIndice(args.uid, args.backupId), blob);
  return indice;
}
