/**
 * El único sitio donde se decide cómo se parsea un chat.
 *
 * POR QUÉ TIENE QUE SER UNO SOLO
 * ------------------------------
 * Esta decisión se toma en tres momentos: al pintar la conversación, al
 * construir el índice de búsqueda, y al sacar el fragmento de un resultado. El
 * índice guarda NÚMEROS de mensaje, así que si cualquiera de los tres parseara
 * distinto, los números dejarían de corresponder: buscarías una palabra y
 * saltarías a otro mensaje, o verías un fragmento que no es el que coincidió.
 * Estaba repetido en los tres, que es justo como empiezan a separarse.
 */

import { parsearTextoChat } from "./parsear-chat";
import { parsearTextoInstagram } from "./parsear-instagram";

export type ChatLeido = {
  /** El texto de la primera pieza. */
  texto: string;
  /** El nombre de la primera pieza, para reconocer un .json. */
  nombre: string;
  /** Todas las piezas: Instagram parte las conversaciones largas en varias. */
  textos?: string[];
};

export function filasDelChat(chat: ChatLeido, origen?: string): string[][] {
  const esInstagram =
    origen === "instagram" || (chat.nombre || "").toLowerCase().endsWith(".json");

  if (!esInstagram) return parsearTextoChat(chat.texto);

  /* `textos` puede faltar si quien llama viene de una versión vieja del
     lector; entonces se parsea lo que haya, que es mejor que nada. */
  return parsearTextoInstagram(chat.textos?.length ? chat.textos : [chat.texto]);
}
