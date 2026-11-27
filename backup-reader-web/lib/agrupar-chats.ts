import type { FileList } from "../models/Files";

/**
 * Agrupa los chats de la barra lateral por plataforma.
 *
 * POR QUÉ AQUÍ Y NO DENTRO DEL PANEL
 * ----------------------------------
 * Hay dos paneles, el de escritorio y el del móvil, y tienen que agrupar
 * igual. Metido en cada uno, el día que cambie una regla cambiará en uno solo
 * y nadie se dará cuenta: la lista no falla, solo sale distinta según el
 * tamaño de la pantalla.
 *
 * LAS REGLAS, Y POR QUÉ
 * ---------------------
 * - Un grupo vacío no sale. Enseñar un apartado «Instagram» a quien solo tiene
 *   WhatsApp es decirle que le falta algo.
 * - Con una sola plataforma no sale ninguna cabecera. Una cabecera que siempre
 *   dice lo mismo no informa, solo ocupa sitio y empuja los chats hacia abajo.
 * - El orden es fijo (WhatsApp, Instagram, otros) y no por número de chats: una
 *   lista que se reordena sola cuando subes un chat te obliga a buscar otra vez
 *   el que ya sabías dónde estaba.
 * - Dentro de cada grupo NO se toca el orden que traían, que ya viene decidido
 *   (los cifrados primero, y entre ellos los más recientes).
 */

export type Plataforma = "whatsapp" | "instagram" | "other" | "desconocido";

export type GrupoDeChats = {
  plataforma: Plataforma;
  chats: FileList[];
};

/* El orden en que salen. Fijo a propósito. */
const ORDEN: Plataforma[] = ["whatsapp", "instagram", "other", "desconocido"];

/**
 * De qué plataforma es un chat.
 *
 * Sin origen es un chat bloqueado: con la bóveda cerrada no se puede abrir su
 * manifiesto, así que no se sabe ni su nombre ni de dónde viene. Va a su propio
 * grupo en vez de colarse en el de WhatsApp, que sería adivinar.
 */
export const plataformaDe = (chat: FileList): Plataforma =>
  chat.origen === "whatsapp" || chat.origen === "instagram" || chat.origen === "other"
    ? chat.origen
    : "desconocido";

/**
 * Los grupos a pintar, en orden y sin los vacíos.
 *
 * `conCabecera` dice si hay que escribir el nombre de la plataforma encima de
 * cada grupo: solo cuando hay más de uno.
 */
export function agruparPorPlataforma(chats: FileList[] | null | undefined): {
  grupos: GrupoDeChats[];
  conCabecera: boolean;
} {
  const lista = chats || [];
  const grupos: GrupoDeChats[] = [];

  for (const plataforma of ORDEN) {
    const suyos = lista.filter((c) => plataformaDe(c) === plataforma);
    if (suyos.length) grupos.push({ plataforma, chats: suyos });
  }

  return { grupos, conCabecera: grupos.length > 1 };
}
