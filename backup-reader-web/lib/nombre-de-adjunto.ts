import { EXT_DOCUMENTO } from "./documentos";

/**
 * El nombre del archivo adjunto que menciona un mensaje de WhatsApp, o null.
 *
 * Formatos que salen en los exports:
 *  - Android: «NOMBRE.ext (archivo adjunto)» / «NOMBRE.ext (file attached)».
 *    Los documentos conservan su nombre original, con espacios.
 *  - iPhone: «<adjunto: 00000012-NOMBRE.ext>» / «<attached: …>».
 *  - Cualquier otro: un nombre suelto con extensión de media.
 */
export function nombreDelAdjunto(text: string): string | null {
  if (!text) return null;
  const clean = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "");

  const mediaExt =
    "jpg|jpeg|png|gif|webp|bmp|tiff|svg|mp4|avi|mov|mkv|webm|3gp|wmv|flv|mpg|mpeg|mp3|wav|aac|flac|opus|m4a|ogg|" +
    EXT_DOCUMENTO.join("|");

  // 0) El mensaje entero es "NOMBRE CON ESPACIOS.ext (archivo adjunto)".
  //    Los documentos conservan su nombre original, que casi siempre lleva
  //    espacios («Contrato firmado.pdf»), y el patrón 1 se quedaba solo con
  //    la última palabra.
  let m = clean.match(
    new RegExp(`^\\s*(.+?\\.(?:${mediaExt}))\\s*\\((?:archivo adjunto|file attached)\\)`, "i")
  );
  if (m) return m[1].trim();

  // 1) "NOMBRE.ext (archivo adjunto)" / "(file attached)"
  m = clean.match(
    new RegExp(`([^\\s:<>]+\\.(?:${mediaExt}))\\s*\\((?:archivo adjunto|file attached)\\)`, "i")
  );
  if (m) return m[1].trim();

  // 2) Formato con corchetes: "<...: NOMBRE>"
  m = clean.match(/<[^:]+:\s*([^>]+)>/);
  if (m) return m[1].trim();

  // 3) Nombre de archivo suelto con extensión de media
  m = clean.match(new RegExp(`([^\\s:<>]+\\.(?:${mediaExt}))\\b`, "i"));
  if (m) return m[1].trim();

  return null;
}

const PATRON_DOC = `(?:${EXT_DOCUMENTO.join("|")})`;

/**
 * Si el mensaje ES un documento adjunto, su archivo y el texto que lo
 * acompaña (el pie que se escribe al mandarlo). Si no, null.
 *
 * Más estricto que `nombreDelAdjunto`: exige la marca de adjunto de WhatsApp
 * («(archivo adjunto)», «(file attached)», «<adjunto: …>», «<attached: …>»).
 * Sin eso, un mensaje que solo NOMBRA un archivo («te mando informe.pdf») se
 * convertiría en tarjeta y su texto desaparecería.
 */
export function documentoAdjunto(texto: string | undefined | null): { archivo: string; resto: string } | null {
  if (!texto) return null;
  const limpio = texto.replace(/[​-‍﻿‎‏]/g, "");

  let m = limpio.match(
    new RegExp(`^\\s*(.+?\\.${PATRON_DOC})\\s*\\((?:archivo adjunto|file attached)\\)`, "i")
  );
  if (!m) {
    m = limpio.match(new RegExp(`<(?:adjunto|attached|archivo adjunto):\\s*([^>]+?\\.${PATRON_DOC})\\s*>`, "i"));
  }
  if (!m) return null;

  const resto = (limpio.slice(0, m.index) + limpio.slice((m.index ?? 0) + m[0].length))
    /* iPhone pone delante «Contrato.pdf • 3 páginas»: eso no es un pie. */
    .replace(new RegExp(`^\\s*[^\\n]*\\.${PATRON_DOC}\\s*•[^\\n]*`, "i"), "")
    .trim();
  return { archivo: m[1].trim(), resto };
}
