/**
 * Las palabras que distinguen a este chat.
 *
 * QUÉ CUENTA
 * ----------
 * Palabras de los mensajes de texto. Ni nombres de archivo ni avisos del
 * sistema: eso lo escribió WhatsApp, no las personas. El filtro de ruido
 * (`stopwords.ts`) quita lo que sale en todos los chats, que si no la lista
 * sería siempre «de, que, la, y».
 *
 * LAS FORMAS NO SE JUNTAN
 * -----------------------
 * «comida» y «comidas» van por separado. Unirlas pide un lematizador, que
 * para el español son varios megabytes de diccionario y, al tener que estar
 * en el navegador, es una descarga que no compensa para una lista de diez
 * palabras. Pasarlas por una regla casera («quita la -s final») rompe más de
 * lo que arregla: «mes» no es el plural de «me».
 *
 * CADA PALABRA GUARDA DÓNDE SE DIJO
 * ---------------------------------
 * Para poder tocar una palabra y saltar a un mensaje donde aparece, que es
 * lo que convierte una lista de palabras en algo que se puede mirar.
 */

import { esRuido } from "./stopwords";
import type { Mensaje } from "./tipos";

/* Tipos de mensaje cuyo texto lo escribió una persona. */
const CON_TEXTO = new Set(["texto", "imagen", "video", "audio", "documento", "sticker", "multimedia"]);

let segmentadores = new Map<string, Intl.Segmenter>();
function segmentador(idioma: string): Intl.Segmenter | null {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return null;
  let s = segmentadores.get(idioma);
  if (!s) {
    s = new Intl.Segmenter(idioma, { granularity: "word" });
    segmentadores.set(idioma, s);
  }
  return s;
}

/** Las palabras de un texto, en minúsculas, sin puntuación ni emojis. */
export function partirEnPalabras(texto: string, idioma = "es"): string[] {
  const limpio = (texto || "").trim();
  if (!limpio) return [];

  const seg = segmentador(idioma);
  if (!seg) {
    return limpio
      .toLowerCase()
      .split(/[^\p{Letter}\p{Number}'’-]+/u)
      .filter(Boolean);
  }

  const salida: string[] = [];
  for (const s of seg.segment(limpio)) {
    if (!s.isWordLike) continue;
    salida.push(s.segment.toLowerCase());
  }
  return salida;
}

export type PalabraContada = {
  palabra: string;
  total: number;
  porAutor: Record<string, number>;
  /** Índice de un mensaje donde aparece. */
  ejemplo: number;
};

export type Palabras = {
  top: PalabraContada[];
  /** Palabras distintas que se han dicho, después del filtro de ruido. */
  distintas: number;
};

/** Las palabras más usadas del chat. */
export function palabrasFrecuentes(
  mensajes: Mensaje[],
  opciones: { idioma?: string; cuantas?: number } = {}
): Palabras {
  const idioma = opciones.idioma || "es";
  const cuantas = opciones.cuantas ?? 15;
  const cuenta = new Map<string, PalabraContada>();

  for (const m of mensajes) {
    if (!CON_TEXTO.has(m.tipo)) continue;
    /* Un adjunto sin pie no aporta palabras, y su nombre de archivo tampoco:
       `normalizar` ya dejó el texto limpio, pero el pie puede estar vacío. */
    for (const palabra of partirEnPalabras(m.contenido, idioma)) {
      if (esRuido(palabra)) continue;
      let fila = cuenta.get(palabra);
      if (!fila) {
        fila = { palabra, total: 0, porAutor: {}, ejemplo: m.indice };
        cuenta.set(palabra, fila);
      }
      fila.total++;
      fila.porAutor[m.autor] = (fila.porAutor[m.autor] || 0) + 1;
    }
  }

  const top = [...cuenta.values()]
    .sort((a, b) => b.total - a.total || a.palabra.localeCompare(b.palabra))
    .slice(0, cuantas);

  return { top, distintas: cuenta.size };
}
