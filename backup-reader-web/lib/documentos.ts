/**
 * Documentos adjuntos en un chat de WhatsApp (PDF, Word, Excel, etc.).
 *
 * El export de WhatsApp trae los documentos que se mandaron junto a las fotos
 * y audios, pero la app solo reconocía imágenes, vídeos y audios: un PDF salía
 * como texto suelto con su nombre y no aparecía en «Media».
 *
 * No va HTML a propósito: un .html abierto desde un blob: corre con el origen
 * de la web, con acceso a la sesión. Esos se quedan como texto.
 */
export const EXT_DOCUMENTO = [
  "pdf",
  "doc", "docx", "odt", "rtf",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "txt", "vcf",
] as const;

const PATRON = new RegExp(`\\.(${EXT_DOCUMENTO.join("|")})\\b`, "i");

/** ¿El mensaje menciona un documento adjunto? */
export function esDocumento(texto: string | undefined | null): boolean {
  return !!texto && PATRON.test(texto);
}

export function extension(nombre: string): string {
  const m = nombre.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

/** Etiqueta corta del tipo, para la tarjeta («PDF», «Word»…). */
export function tipoDeDocumento(nombre: string): string {
  const ext = extension(nombre);
  if (ext === "pdf") return "PDF";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "Word";
  if (["xls", "xlsx", "ods"].includes(ext)) return "Excel";
  if (ext === "csv") return "CSV";
  if (["ppt", "pptx", "odp"].includes(ext)) return "PowerPoint";
  if (ext === "vcf") return "Contacto";
  if (ext === "txt") return "Texto";
  return ext.toUpperCase() || "Documento";
}

/**
 * El nombre para enseñar. En iPhone el archivo del export lleva delante un
 * número de 8 cifras («00000012-Contrato.pdf»); eso no lo escribió nadie.
 */
export function nombreVisible(nombre: string): string {
  return nombre.replace(/^\d{8}-/, "");
}

/** Los PDF se abren en otra pestaña; el resto se descarga. */
export function seAbreEnElNavegador(nombre: string): boolean {
  return extension(nombre) === "pdf";
}
