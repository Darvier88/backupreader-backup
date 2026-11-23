/**
 * De dónde salió un backup: WhatsApp, Instagram u otra cosa.
 *
 * POR QUÉ NO VALE MIRAR EL NOMBRE DEL ARCHIVO
 * -------------------------------------------
 * Antes esto miraba si el nombre del zip contenía «WhatsApp» o «instagram».
 * Con WhatsApp cuela, porque el nombre lo pone WhatsApp («WhatsApp Chat -
 * Ana.zip»). Con Instagram no: Meta nombra la descarga de formas que cambian
 * con el idioma y con la fecha, y la gente además los renombra antes de
 * subirlos. Un export legítimo acababa marcado como «otro», y entonces se
 * intentaba leer su JSON como si fuera el texto plano de WhatsApp.
 *
 * Lo que sí es estable es lo que hay DENTRO: Instagram guarda las
 * conversaciones en `messages/inbox/<hilo>/message_1.json`, y WhatsApp deja un
 * `_chat.txt` (o un «WhatsApp Chat con Ana.txt»). Eso es lo que se mira aquí.
 *
 * El nombre del archivo se sigue usando, pero como último recurso.
 */

import type { BackupSource } from "./types";

/** `.../messages/inbox/ana_123/message_1.json`, que es la firma de Instagram. */
const MENSAJES_INSTAGRAM = /(^|\/)messages\/(inbox|archived_threads|message_requests)\//i;
const ARCHIVO_INSTAGRAM = /(^|\/)message_\d+\.json$/i;

const CHAT_WHATSAPP = /(^|\/)_chat\.txt$/i;
const TXT_WHATSAPP = /whats\s*app.*\.txt$/i;

/**
 * Un export de Instagram pedido en HTML en vez de en JSON.
 *
 * Meta deja elegir el formato al pedir la descarga, y en HTML no hay ningún
 * `message_N.json`: solo páginas pensadas para mirarlas en un navegador, sin
 * las marcas de tiempo ni los autores en un sitio fijo del que leerlos.
 *
 * Importa reconocerlo porque, sin esto, el zip se cifra, se sube, gasta cuota,
 * y al abrirlo la aplicación dice «no se pudo abrir el chat, revisa tu
 * conexión», que es mentira y deja a la persona sin saber qué hacer.
 */
export function pareceInstagramEnHtml(nombres: string[]): boolean {
  return (nombres || []).some((n) => /(^|\/)message_\d+\.html$/i.test(n || ""));
}

/** Si esta entrada del zip es uno de los archivos de mensajes de Instagram. */
export function esArchivoDeMensajes(nombre: string): boolean {
  return ARCHIVO_INSTAGRAM.test(nombre || "");
}

/** Deduce el origen a partir del nombre del archivo. Último recurso. */
export function origenPorNombre(nombreArchivo: string): BackupSource {
  const n = nombreArchivo || "";
  if (/whats\s*app/i.test(n)) return "whatsapp";
  if (/instagram|\bmeta\b/i.test(n)) return "instagram";
  return "other";
}

/**
 * Deduce el origen a partir de lo que hay dentro del zip.
 *
 * `nombres` son las rutas de las entradas, tal cual vienen. No hace falta
 * abrir el zip otra vez: quien sube ya las tiene de haberlas procesado.
 */
export function origenDeArchivos(nombres: string[], nombreArchivo = ""): BackupSource {
  const lista = nombres || [];

  if (lista.some((n) => MENSAJES_INSTAGRAM.test(n) || ARCHIVO_INSTAGRAM.test(n))) {
    return "instagram";
  }
  if (lista.some((n) => CHAT_WHATSAPP.test(n) || TXT_WHATSAPP.test(n))) {
    return "whatsapp";
  }
  return origenPorNombre(nombreArchivo);
}
