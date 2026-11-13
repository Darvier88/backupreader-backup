import { EXT_DOCUMENTO } from "./documentos";

/**
 * Adjuntos en el texto de un export de WhatsApp.
 *
 * CÓMO APARECE UN ADJUNTO, SEGÚN DE DÓNDE VENGA EL EXPORT
 * -------------------------------------------------------
 *  - Android:  «NOMBRE.ext (archivo adjunto)». La marca va en el idioma del
 *    teléfono: «file attached», «arquivo anexado», «fichier joint»,
 *    «Datei angehängt», «file allegato»… Los documentos conservan su nombre
 *    original, con espacios.
 *  - iPhone:   «<adjunto: 00000012-NOMBRE.ext>» («attached», «anexado»,
 *    «pièce jointe», «Anhang», «allegato»…). Los documentos llevan delante
 *    «NOMBRE.ext • 3 páginas».
 *  - Sin media (export «sin archivos», y el de WhatsApp Web / Windows, que
 *    nunca los incluye): el mensaje dice «<Multimedia omitido>»,
 *    «imagen omitida», «<Media omitted>», etc. No hay archivo que buscar.
 */

/** Marca de Android, en los idiomas que se usan (y alguno más, por si acaso). */
const MARCAS_ANDROID = [
  "archivo adjunto", // es
  "file attached", // en
  "arquivo anexado", // pt
  "ficheiro anexado", // pt-PT
  "fichier joint", // fr
  "datei angehängt", // de
  "file allegato", // it
  "bestand bijgevoegd", // nl
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MARCA_ANDROID = `\\((?:${MARCAS_ANDROID.map(escapar).join("|")})\\)`;

/* iPhone: «<palabra(s): nombre>». La palabra cambia con el idioma, así que se
   acepta cualquiera corta; el formato con < > y dos puntos es inconfundible. */
const MARCA_IOS = `<[^<>:\\n]{2,25}:\\s*([^<>\\n]+?)\\s*>`;

const EXT_MEDIA =
  "jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff|svg|mp4|avi|mov|mkv|webm|3gp|wmv|flv|mpg|mpeg|mp3|wav|aac|flac|opus|m4a|ogg|amr|" +
  EXT_DOCUMENTO.join("|");

const limpiar = (texto: string) =>
  texto.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "").replace(/[  ]/g, " ");

/**
 * El nombre del archivo adjunto que menciona un mensaje, o null.
 * Para fotos, audios y vídeos (los documentos usan `documentoAdjunto`).
 */
export function nombreDelAdjunto(text: string): string | null {
  if (!text) return null;
  const clean = limpiar(text);

  // 0) El mensaje empieza por «NOMBRE CON ESPACIOS.ext (marca de Android)».
  let m = clean.match(new RegExp(`^\\s*(.+?\\.(?:${EXT_MEDIA}))\\s*${MARCA_ANDROID}`, "i"));
  if (m) return m[1].trim();

  // 1) «NOMBRE.ext (marca de Android)» en cualquier punto.
  m = clean.match(new RegExp(`([^\\s:<>]+\\.(?:${EXT_MEDIA}))\\s*${MARCA_ANDROID}`, "i"));
  if (m) return m[1].trim();

  // 2) iPhone: «<adjunto: NOMBRE>» en cualquier idioma.
  m = clean.match(new RegExp(MARCA_IOS, "i"));
  if (m && new RegExp(`\\.(?:${EXT_MEDIA})$`, "i").test(m[1])) return m[1].trim();

  // 3) Un nombre de archivo suelto con extensión de media.
  m = clean.match(new RegExp(`([^\\s:<>]+\\.(?:${EXT_MEDIA}))\\b`, "i"));
  if (m) return m[1].trim();

  return null;
}

const PATRON_DOC = `(?:${EXT_DOCUMENTO.join("|")})`;

/**
 * Si el mensaje ES un documento adjunto, su archivo y el texto que lo
 * acompaña (el pie que se escribe al mandarlo). Si no, null.
 *
 * Exige la marca de adjunto de WhatsApp. Sin eso, un mensaje que solo NOMBRA
 * un archivo («te mando informe.pdf») se convertiría en tarjeta y su texto
 * desaparecería.
 */
export function documentoAdjunto(texto: string | undefined | null): { archivo: string; resto: string } | null {
  if (!texto) return null;
  const limpio = limpiar(texto);

  let m = limpio.match(new RegExp(`^\\s*(.+?\\.${PATRON_DOC})\\s*${MARCA_ANDROID}`, "i"));
  let archivo = m ? m[1] : null;
  if (!m) {
    const ios = limpio.match(new RegExp(MARCA_IOS, "i"));
    if (ios && new RegExp(`\\.${PATRON_DOC}$`, "i").test(ios[1])) {
      m = ios;
      archivo = ios[1];
    }
  }
  if (!m || !archivo) return null;

  const resto = (limpio.slice(0, m.index) + limpio.slice((m.index ?? 0) + m[0].length))
    /* iPhone pone delante «Contrato.pdf • 3 páginas»: eso no es un pie. */
    .replace(new RegExp(`^\\s*[^\\n]*\\.${PATRON_DOC}\\s*•[^\\n]*`, "i"), "")
    .trim();
  return { archivo: archivo.trim(), resto };
}

/* Avisos de «este adjunto no se incluyó en el export». Android los pone entre
   < >, iPhone como «imagen omitida». En los 6 idiomas más comunes. */
const OMITIDOS = [
  // es
  "multimedia omitido", "archivo omitido", "imagen omitida", "video omitido", "vídeo omitido",
  "audio omitido", "documento omitido", "sticker omitido", "gif omitido", "contacto omitido",
  // en
  "media omitted", "image omitted", "video omitted", "audio omitted", "document omitted",
  "sticker omitted", "gif omitted", "contact card omitted", "file omitted",
  // pt
  "mídia oculta", "arquivo de mídia oculto", "imagem ocultada", "vídeo omitido", "áudio ocultado",
  "documento omitido", "figurinha omitida", "mídia omitida",
  // fr
  "médias omis", "fichier omis", "image absente", "vidéo absente", "audio omis", "document omis",
  "autocollant omis",
  // de
  "medien ausgeschlossen", "medien weggelassen", "bild weggelassen", "video weggelassen",
  "audio weggelassen", "dokument weggelassen", "sticker weggelassen",
  // it
  "media omessi", "immagine omessa", "video omesso", "audio omesso", "documento omesso",
  "sticker omesso",
];
const PATRON_OMITIDO = new RegExp(`^\\s*<?\\s*(?:${OMITIDOS.map(escapar).join("|")})\\s*>?\\s*$`, "i");

/** ¿El mensaje es solo el aviso de que el adjunto no viene en el export? */
export function esAdjuntoOmitido(texto: string | undefined | null): boolean {
  return !!texto && PATRON_OMITIDO.test(limpiar(texto));
}
