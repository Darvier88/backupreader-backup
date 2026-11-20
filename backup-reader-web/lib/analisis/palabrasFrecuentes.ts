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
 * UN ENLACE NO SON SIETE PALABRAS
 * -------------------------------
 * `https://www.youtube.com/watch?v=...` se parte en «https», «www»,
 * «youtube», «com», «watch»..., y esos trozos se colaban en la lista como si
 * fueran cosas de las que habláis. No lo son: nadie dice «https». Los
 * enlaces se sacan del texto antes de contar y se suman en una sola fila,
 * «compartir link», que sí dice algo: cuántas veces os pasáis cosas.
 *
 * LOS NOMBRES DE LOS DEL GRUPO NO SON TEMAS
 * -----------------------------------------
 * «gilliam» y «yousra» salían entre lo que más se habla, y no son cosas de
 * las que se hable: son quienes hablan. Aparecen mucho porque la gente se
 * llama por su nombre, así que encabezan la lista y desplazan a lo que sí
 * dice algo de la conversación.
 *
 * El precio es conocido: en un grupo con una Rosa, la flor deja de contar.
 * Vale la pena, porque un nombre entre los temas no informa nunca y la flor
 * casi nunca es de lo que más se habla.
 *
 * CADA PALABRA GUARDA DÓNDE SE DIJO
 * ---------------------------------
 * Para poder tocar una palabra y saltar a un mensaje donde aparece, que es
 * lo que convierte una lista de palabras en algo que se puede mirar.
 */

import { esRuido } from "./stopwords";
import type { Mensaje } from "./tipos";

/**
 * La fila de los enlaces.
 *
 * Es una clave de i18n, no un texto suelto: en inglés la lista dice
 * «shared link». Y lleva un hueco al empezar para que no choque con una
 * palabra real que alguien escriba, porque las palabras van en minúscula y
 * sin espacios.
 */
export const FILA_ENLACE = "compartir link";

/**
 * Qué se considera un enlace.
 *
 * Tres formas, que son las que de verdad aparecen en un chat: con esquema
 * (`https://…`), empezando por `www.`, y el dominio pelado con barra
 * (`youtube.com/algo`), que es lo que queda cuando alguien copia a medias.
 * No se intenta cazar un dominio suelto sin barra («nos vemos en casa.com»
 * es raro, pero «etc.» o «a.m.» no son enlaces y saldrían marcados).
 */
export const PATRON_ENLACE =
  "(?:https?://|www\\.)[^\\s]+|\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.[a-z]{2,}/[^\\s]*";

/* La misma forma que usa el filtro del chat: contar y marcar tienen que dar
   la misma cifra, o la tarjeta deja de ser comprobable. */
const ENLACE = new RegExp(PATRON_ENLACE, "gi");

/** Cuántos enlaces hay en un texto, y el texto sin ellos. */
export function separarEnlaces(texto: string): { enlaces: number; resto: string } {
  let enlaces = 0;
  const resto = (texto || "").replace(ENLACE, () => {
    enlaces++;
    /* Un espacio y no vacío: pegar lo de antes con lo de después inventaría
       una palabra que nadie escribió. */
    return " ";
  });
  return { enlaces, resto };
}

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
  opciones: { idioma?: string; cuantas?: number; nombres?: string[] } = {}
): Palabras {
  const idioma = opciones.idioma || "es";
  const cuantas = opciones.cuantas ?? 15;
  const cuenta = new Map<string, PalabraContada>();

  /* Cada trozo de cada nombre: «María José» quita también «maría» y «josé»,
     que es como la llaman de verdad en los mensajes. */
  const nombres = new Set<string>();
  for (const n of opciones.nombres ?? []) {
    for (const trozo of partirEnPalabras(n, idioma)) nombres.add(trozo);
  }

  for (const m of mensajes) {
    if (!CON_TEXTO.has(m.tipo)) continue;
    /* Un adjunto sin pie no aporta palabras, y su nombre de archivo tampoco:
       `normalizar` ya dejó el texto limpio, pero el pie puede estar vacío. */
    const { enlaces, resto } = separarEnlaces(m.contenido);
    if (enlaces > 0) {
      let fila = cuenta.get(FILA_ENLACE);
      if (!fila) {
        fila = { palabra: FILA_ENLACE, total: 0, porAutor: {}, ejemplo: m.indice };
        cuenta.set(FILA_ENLACE, fila);
      }
      /* Cada enlace cuenta: dos en un mensaje son dos veces que se comparte
         algo, no una. */
      fila.total += enlaces;
      fila.porAutor[m.autor] = (fila.porAutor[m.autor] || 0) + enlaces;
    }

    for (const palabra of partirEnPalabras(resto, idioma)) {
      if (esRuido(palabra) || nombres.has(palabra)) continue;
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
