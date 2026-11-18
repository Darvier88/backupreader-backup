/**
 * Qué emojis usa cada uno.
 *
 * UN EMOJI NO ES UN CARÁCTER
 * --------------------------
 * «👍🏽» son dos puntos de código (el pulgar y el tono de piel) y «👨‍👩‍👧» son
 * cinco, unidos por caracteres invisibles. Contando caracteres, una familia
 * sale tres veces y un pulgar moreno sale como pulgar amarillo más una
 * mancha de color. Hay que contar GRUPOS DE GRAFEMAS, que es exactamente lo
 * que la persona ve como un emoji, y para eso está `Intl.Segmenter` con
 * granularidad "grapheme".
 *
 * LOS TONOS DE PIEL NO SE JUNTAN
 * ------------------------------
 * «👍» y «👍🏽» se cuentan aparte: son la misma idea pero no el mismo emoji,
 * y juntarlos borraría una elección de la persona. En cambio las variantes
 * de presentación (el VS16 invisible que convierte «❤» en «❤️») sí se
 * normalizan, porque ahí no hay elección: depende del teclado.
 */

import type { Mensaje } from "./tipos";

/* Qué cuenta como emoji. `Extended_Pictographic` incluye los pictogramas y
   deja fuera dígitos, letras y signos; los indicadores regionales son las
   banderas, que no son pictográficas por separado. */
const ES_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Los invisibles que no cambian qué emoji es. */
const VARIANTES = /[︎️]/g;

let segmentador: Intl.Segmenter | null | undefined;
function grafemas(): Intl.Segmenter | null {
  if (segmentador !== undefined) return segmentador;
  segmentador =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("es", { granularity: "grapheme" })
      : null;
  return segmentador;
}

/**
 * Los emojis de un texto, uno por uno, en orden.
 *
 * Sin `Intl.Segmenter` devuelve lista vacía en vez de contar mal: una cifra
 * equivocada es peor que no enseñar la tarjeta.
 */
export function emojisDe(texto: string): string[] {
  const seg = grafemas();
  if (!seg || !texto) return [];

  const salida: string[] = [];
  for (const { segment } of seg.segment(texto)) {
    if (!ES_EMOJI.test(segment)) continue;
    const limpio = segment.replace(VARIANTES, "");
    if (limpio) salida.push(limpio);
  }
  return salida;
}

export type EmojiContado = {
  emoji: string;
  total: number;
  /** Cuántas veces lo usa cada persona. */
  porAutor: Record<string, number>;
  /** Índice de un mensaje donde aparece, para poder ir a verlo. */
  ejemplo: number;
};

export type Emojis = {
  /** Los más usados del chat, de más a menos. */
  top: EmojiContado[];
  /** El favorito de cada persona, el que más usa. */
  favoritoPorAutor: Record<string, string>;
  /** Cuántos emojis ha escrito cada persona en total. */
  totalPorAutor: Record<string, number>;
  total: number;
};

/** Cuenta los emojis del chat. `cuantos` es el tamaño del top. */
export function emojis(mensajes: Mensaje[], cuantos = 10): Emojis {
  const cuenta = new Map<string, EmojiContado>();
  const totalPorAutor: Record<string, number> = {};
  let total = 0;

  for (const m of mensajes) {
    for (const e of emojisDe(m.contenido)) {
      let fila = cuenta.get(e);
      if (!fila) {
        fila = { emoji: e, total: 0, porAutor: {}, ejemplo: m.indice };
        cuenta.set(e, fila);
      }
      fila.total++;
      fila.porAutor[m.autor] = (fila.porAutor[m.autor] || 0) + 1;
      totalPorAutor[m.autor] = (totalPorAutor[m.autor] || 0) + 1;
      total++;
    }
  }

  const top = [...cuenta.values()]
    .sort((a, b) => b.total - a.total || a.emoji.localeCompare(b.emoji))
    .slice(0, cuantos);

  /* El favorito se busca sobre TODOS los emojis, no sobre el top del chat:
     el emoji de alguien puede no estar entre los más usados en conjunto. */
  const favoritoPorAutor: Record<string, string> = {};
  for (const autor of Object.keys(totalPorAutor)) {
    let mejor: { emoji: string; n: number } | null = null;
    for (const fila of cuenta.values()) {
      const n = fila.porAutor[autor] || 0;
      if (n > 0 && (!mejor || n > mejor.n)) mejor = { emoji: fila.emoji, n };
    }
    if (mejor) favoritoPorAutor[autor] = mejor.emoji;
  }

  return { top, favoritoPorAutor, totalPorAutor, total };
}
