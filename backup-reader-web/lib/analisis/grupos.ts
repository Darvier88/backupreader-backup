/**
 * Los chats de más de dos personas.
 *
 * EN UN GRUPO NO HAY VEREDICTO, HAY TABLA
 * ---------------------------------------
 * Las tarjetas de 1:1 dicen «X escribe más», y en un grupo de catorce eso no
 * significa nada: alguien tiene que ser el primero, y serlo no dice nada de
 * nadie. Lo que sí se puede leer de un grupo es cómo se reparte, y para eso
 * la forma correcta es una tabla ordenable, no un titular.
 *
 * EL SILENCIO TAMBIÉN ES UN DATO
 * ------------------------------
 * Quien está en el grupo y no escribe desde hace meses sale igual, con su
 * última fecha. Es una de las pocas cosas que un grupo grande no deja ver y
 * que a la gente le interesa.
 *
 * «QUIÉN RESPONDE A QUIÉN» NO ESTÁ AQUÍ
 * -------------------------------------
 * En un grupo, que B escriba después de A no significa que le conteste: hay
 * tres conversaciones a la vez y WhatsApp solo marca la respuesta cuando se
 * cita expresamente, cosa que el export no conserva. Inventar un grafo de
 * afinidades con ese dato sería dibujar relaciones que no constan.
 */

import type { ChatNormalizado, Mensaje } from "./tipos";
import { partirEnConversaciones, UMBRAL_POR_DEFECTO } from "./iniciaMas";
import { emojisDe } from "./emojis";

export type FilaDeGrupo = {
  autor: string;
  mensajes: number;
  palabras: number;
  /** Porcentaje de los mensajes del grupo. */
  porcentajeMensajes: number;
  /** Palabras por mensaje, para ver quién escribe largo y quién corto. */
  palabrasPorMensaje: number;
  /** Cuántas conversaciones rompe el silencio. */
  inicios: number;
  /** Fotos, vídeos, audios y documentos que ha mandado. */
  media: number;
  notasDeVoz: number;
  emojis: number;
  /* Marcas de tiempo, no `Date`: el resultado entero se guarda cifrado como
     JSON, y un `Date` vuelve de ahí convertido en texto. */
  primero: number | null;
  ultimo: number | null;
};

export type Grupo = {
  esGrupo: boolean;
  personas: number;
  filas: FilaDeGrupo[];
  totalMensajes: number;
  conversaciones: number;
  /** Quien lleva más tiempo sin escribir, si hace más de 30 días. */
  masCallado: { autor: string; ultimo: number } | null;
};

const MEDIA = new Set(["imagen", "video", "audio", "documento", "sticker", "multimedia"]);
const DIA = 24 * 60 * 60 * 1000;
/** Por debajo de un mes, «lleva tiempo sin escribir» no describe nada. */
const DIAS_CALLADO = 30;

/**
 * La tabla del grupo.
 *
 * `chat` se usa solo para saber cuántas personas hay; los conteos salen de
 * los mensajes contables, igual que en el resto.
 */
export function grupos(
  chat: ChatNormalizado,
  mensajes: Mensaje[],
  umbralHoras: number = UMBRAL_POR_DEFECTO
): Grupo {
  const conversaciones = partirEnConversaciones(mensajes, umbralHoras);
  const inicios = new Map<string, number>();
  for (const c of conversaciones) inicios.set(c.inicia, (inicios.get(c.inicia) || 0) + 1);

  const porAutor = new Map<string, FilaDeGrupo>();
  const nueva = (autor: string): FilaDeGrupo => ({
    autor,
    mensajes: 0,
    palabras: 0,
    porcentajeMensajes: 0,
    palabrasPorMensaje: 0,
    inicios: inicios.get(autor) || 0,
    media: 0,
    notasDeVoz: 0,
    emojis: 0,
    primero: null,
    ultimo: null,
  });

  /* Todos los que han escrito alguna vez, aunque luego no tengan nada que
     contar: quien lleva medio año callado tiene que salir en la tabla. */
  for (const autor of chat.autores) porAutor.set(autor, nueva(autor));

  for (const m of mensajes) {
    let fila = porAutor.get(m.autor);
    if (!fila) {
      fila = nueva(m.autor);
      porAutor.set(m.autor, fila);
    }
    fila.mensajes++;
    fila.palabras += m.palabras;
    if (MEDIA.has(m.tipo)) fila.media++;
    if (m.tipo === "audio") fila.notasDeVoz++;
    fila.emojis += emojisDe(m.contenido).length;
    if (m.fecha) {
      const t = m.fecha.getTime();
      if (fila.primero === null || t < fila.primero) fila.primero = t;
      if (fila.ultimo === null || t > fila.ultimo) fila.ultimo = t;
    }
  }

  const totalMensajes = mensajes.length;
  const filas = [...porAutor.values()]
    .map((f) => ({
      ...f,
      porcentajeMensajes:
        totalMensajes > 0 ? Math.round((f.mensajes / totalMensajes) * 1000) / 10 : 0,
      palabrasPorMensaje: f.mensajes > 0 ? Math.round((f.palabras / f.mensajes) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.mensajes - a.mensajes || a.autor.localeCompare(b.autor));

  /* «El más callado» se mide contra el último mensaje DEL GRUPO, no contra
     hoy: un export de hace dos años dejaría a todo el mundo callado. */
  const finDelChat = chat.hasta;
  let masCallado: Grupo["masCallado"] = null;
  if (finDelChat) {
    for (const f of filas) {
      if (f.ultimo === null) continue;
      const dias = (finDelChat.getTime() - f.ultimo) / DIA;
      if (dias < DIAS_CALLADO) continue;
      if (!masCallado || f.ultimo < masCallado.ultimo) {
        masCallado = { autor: f.autor, ultimo: f.ultimo };
      }
    }
  }

  return {
    esGrupo: filas.length > 2,
    personas: filas.length,
    filas,
    totalMensajes,
    conversaciones: conversaciones.length,
    masCallado,
  };
}
