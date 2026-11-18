/**
 * Quién pide perdón y quién da las gracias.
 *
 * POR QUÉ ESTAS DOS Y NO OTRAS
 * ----------------------------
 * Son las dos cosas que la gente reconoce al instante en sus propias
 * conversaciones y que casi nadie sabría estimar: «perdona» y «gracias»
 * aparecen cientos de veces en un chat de años y nadie lleva la cuenta.
 *
 * ESTO NO ES UN JUICIO
 * --------------------
 * Pedir perdón mucho no es malo ni bueno, y dar las gracias tampoco. La
 * interfaz enseña el número y un ejemplo que se puede abrir, y no dice qué
 * significa. Buena parte de los «perdona» de cualquier chat son «perdona,
 * estaba en el metro», que no es una disculpa por nada.
 *
 * SE BUSCA SOBRE EL TEXTO, NO SOBRE PALABRAS SUELTAS
 * --------------------------------------------------
 * «muchas gracias» es una vez, no dos, y «graciasss» cuenta. Por eso van
 * expresiones regulares sobre el texto y no una lista de palabras.
 */

import type { Mensaje } from "./tipos";

/* Las formas se escriben una vez y se compilan juntas. `\p{L}` evita que
   «gracioso» cuente como «gracias» o «sorry» dentro de otra palabra. */
const palabras = (formas: string[]) =>
  new RegExp(`(?<!\\p{L})(?:${formas.join("|")})(?!\\p{L})`, "giu");

/** «perdona», «lo siento», «sorry», «desculpa»… */
const DISCULPAS = palabras([
  "perd[oó]n+a?m?e?",
  "perd[oó]n+",
  "perdona+d?",
  "disculpa+m?e?",
  "disculpe",
  "lo siento+",
  "mil perdones",
  "sorry+",
  "my bad",
  "apologi[sz]e",
  "desculpa+",
  "pardon",
  "d[ée]sol[ée]+",
  "entschuldigung",
  "scusa+",
]);

/** «gracias», «thanks», «obrigado»… */
const AGRADECIMIENTOS = palabras([
  "gracias+",
  "graci[ñn]as",
  "te lo agradezco",
  "agradecid[oa]",
  "thank you",
  "thanks+",
  "thx",
  "ty",
  "obrigad[oa]+",
  "merci+",
  "danke",
  "grazie",
]);

export type Expresion = {
  autor: string;
  total: number;
  /** Por cada cien mensajes suyos, para poder comparar a quien escribe más. */
  porCienMensajes: number;
  /** Índices de mensajes donde aparece, para enseñarlos. */
  ejemplos: number[];
};

export type Expresiones = {
  disculpas: Expresion[];
  agradecimientos: Expresion[];
  totalDisculpas: number;
  totalAgradecimientos: number;
};

const MAX_EJEMPLOS = 5;

function contar(mensajes: Mensaje[], patron: RegExp): Expresion[] {
  const porAutor = new Map<string, { total: number; ejemplos: number[] }>();
  const mensajesPorAutor = new Map<string, number>();

  for (const m of mensajes) {
    mensajesPorAutor.set(m.autor, (mensajesPorAutor.get(m.autor) || 0) + 1);

    /* `matchAll` con una expresión global necesita el índice a cero en cada
       texto; si no, se salta coincidencias del mensaje siguiente. */
    patron.lastIndex = 0;
    const encontradas = (m.contenido || "").match(patron);
    if (!encontradas || encontradas.length === 0) continue;

    const fila = porAutor.get(m.autor) || { total: 0, ejemplos: [] };
    fila.total += encontradas.length;
    if (fila.ejemplos.length < MAX_EJEMPLOS) fila.ejemplos.push(m.indice);
    porAutor.set(m.autor, fila);
  }

  return [...porAutor.entries()]
    .map(([autor, fila]) => {
      const suyos = mensajesPorAutor.get(autor) || 0;
      return {
        autor,
        total: fila.total,
        porCienMensajes: suyos > 0 ? Math.round((fila.total / suyos) * 1000) / 10 : 0,
        ejemplos: fila.ejemplos,
      };
    })
    .sort((a, b) => b.total - a.total || a.autor.localeCompare(b.autor));
}

/** Cuántas veces pide perdón y da las gracias cada persona. */
export function disculpasYAgradecimientos(mensajes: Mensaje[]): Expresiones {
  const disculpas = contar(mensajes, DISCULPAS);
  const agradecimientos = contar(mensajes, AGRADECIMIENTOS);

  return {
    disculpas,
    agradecimientos,
    totalDisculpas: disculpas.reduce((n, d) => n + d.total, 0),
    totalAgradecimientos: agradecimientos.reduce((n, a) => n + a.total, 0),
  };
}
