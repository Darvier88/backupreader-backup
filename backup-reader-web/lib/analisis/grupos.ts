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
 * «QUIÉN RESPONDE A QUIÉN» NO ESTÁ AQUÍ, Y LO QUE SÍ ESTÁ VA CON SU BASE
 * ----------------------------------------------------------------------
 * En un grupo, que B escriba después de A no significa que le conteste: hay
 * tres conversaciones a la vez y WhatsApp solo marca la respuesta cuando se
 * cita expresamente, cosa que el export no conserva.
 *
 * Lo que sí se puede contar es quién escribe DETRÁS de ti, y aun así la
 * cifra sola engaña: quien manda el 31 % de los mensajes del grupo va a
 * salir el primero detrás de ti por pura aritmética. Por eso cada persona
 * lleva su parte del grupo al lado. Lo que dice algo es la diferencia entre
 * las dos: estar detrás de ti el 46 % de las veces cuando solo escribes el
 * 31 % del grupo es quince puntos de más, y eso sí es un dato.
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

/** Quién escribe justo detrás de una persona, contra su peso en el grupo. */
export type DetrasDeTi = {
  autor: string;
  /** Veces que ha escrito justo detrás, dentro de la ventana. */
  veces: number;
  /** Porcentaje de las veces que alguien escribe detrás de ti. */
  porcentajeDetras: number;
  /** Su porcentaje de mensajes del grupo entero: la línea base. */
  porcentajeGrupo: number;
  /** La diferencia, que es lo único que significa algo. */
  diferencia: number;
};

export type Grupo = {
  esGrupo: boolean;
  personas: number;
  filas: FilaDeGrupo[];
  totalMensajes: number;
  conversaciones: number;
  /** Quien lleva más tiempo sin escribir, si hace más de 30 días. */
  masCallado: { autor: string; ultimo: number } | null;
  /**
   * Quién escribe detrás de una persona, con su línea base.
   *
   * Vacío si no se pidió o si no hay suficientes casos. NO es «quién te
   * responde»: el archivo no dice a quién contesta cada mensaje.
   */
  detrasDe: DetrasDeTi[];
};

const MEDIA = new Set(["imagen", "video", "audio", "documento", "sticker", "multimedia"]);
/** Cuánto puede tardar un mensaje en contar como «detrás de» otro. */
const VENTANA_DETRAS = 10 * 60 * 1000;
/** Por debajo de esto, la cifra es ruido y no se enseña. */
const MIN_DETRAS = 20;
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
  umbralHoras: number = UMBRAL_POR_DEFECTO,
  /** De quién se quiere saber quién escribe detrás. Normalmente, tú. */
  deQuien?: string
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

  /* Quién escribe detrás de `deQuien`, dentro de la ventana. Se mira el
     mensaje siguiente de OTRA persona: si quien escribe detrás es la misma
     persona, está siguiendo su propio mensaje, no respondiendo a nadie. */
  const detrasDe: DetrasDeTi[] = [];
  if (deQuien) {
    const cuenta = new Map<string, number>();
    let total = 0;
    for (let i = 0; i < mensajes.length - 1; i++) {
      if (mensajes[i].autor !== deQuien) continue;
      const mio = mensajes[i].fecha;
      if (!mio) continue;
      for (let j = i + 1; j < mensajes.length; j++) {
        const otro = mensajes[j];
        if (otro.autor === deQuien) break;
        if (!otro.fecha) break;
        if (otro.fecha.getTime() - mio.getTime() > VENTANA_DETRAS) break;
        cuenta.set(otro.autor, (cuenta.get(otro.autor) || 0) + 1);
        total++;
        break;
      }
    }

    if (total >= MIN_DETRAS) {
      const porPeso = new Map(filas.map((f) => [f.autor, f.porcentajeMensajes]));
      for (const [autor, veces] of cuenta) {
        const porcentajeDetras = Math.round((veces / total) * 1000) / 10;
        const porcentajeGrupo = porPeso.get(autor) ?? 0;
        detrasDe.push({
          autor,
          veces,
          porcentajeDetras,
          porcentajeGrupo,
          diferencia: Math.round((porcentajeDetras - porcentajeGrupo) * 10) / 10,
        });
      }
      detrasDe.sort((a, b) => b.porcentajeDetras - a.porcentajeDetras);
    }
  }

  return {
    esGrupo: filas.length > 2,
    personas: filas.length,
    filas,
    totalMensajes,
    conversaciones: conversaciones.length,
    masCallado,
    detrasDe,
  };
}
