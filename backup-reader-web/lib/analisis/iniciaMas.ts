/**
 * Dónde empieza una conversación y quién la empieza.
 *
 * UNA CONVERSACIÓN ES LO QUE PASA ENTRE DOS SILENCIOS
 * ---------------------------------------------------
 * Un chat de WhatsApp no tiene principio ni final: es una línea de mensajes
 * de años. Lo que la gente llama «una conversación» es un rato de mensajes
 * seguidos, y lo que lo separa del siguiente es un silencio largo. Así que
 * hace falta decir cuánto es «largo», y no hay un número correcto: cuatro
 * horas parte bien el día de quien se escribe a diario, y parte mal el de
 * quien se escribe una vez por semana.
 *
 * Por eso el umbral se elige en Ajustes (1, 4 u 8 horas) y el valor por
 * defecto es cuatro. Cambiarlo recalcula; no es un detalle escondido, es
 * parte de la pregunta.
 *
 * EMPEZAR NO ES MEJOR QUE RESPONDER
 * ---------------------------------
 * Esta métrica dice quién rompe el silencio más veces, y nada más. Quien
 * empieza menos puede ser quien responde siempre al minuto. La interfaz lo
 * enseña sin adjetivos y con el reparto a la vista.
 */

import type { Mensaje } from "./tipos";
import { compararReparto, type Comparacion } from "./umbrales";

/** Los umbrales de silencio que se pueden elegir, en horas. */
export const UMBRALES_HORAS = [1, 4, 8] as const;
export type UmbralHoras = (typeof UMBRALES_HORAS)[number];
export const UMBRAL_POR_DEFECTO: UmbralHoras = 4;

const HORA_MS = 60 * 60 * 1000;

/** Un rato de conversación: los mensajes seguidos sin un silencio largo. */
export type Conversacion = {
  /** Quien rompió el silencio. */
  inicia: string;
  /** Índice (en las filas originales) del mensaje que la abre. */
  indiceApertura: number;
  inicio: Date;
  fin: Date;
  mensajes: number;
};

/**
 * Parte los mensajes en conversaciones.
 *
 * SE MIRA EL HUECO ENTRE MENSAJES, NO ENTRE TURNOS
 * ------------------------------------------------
 * Un turno no se corta por tiempo a propósito (ver `turnos.ts`), así que si
 * se midieran solo los huecos entre turnos, alguien que escribe «hola» y
 * vuelve a escribir seis horas después sin que el otro haya dicho nada
 * seguiría estando en la misma conversación, y su segundo mensaje —que es
 * claramente volver a empezar— no contaría como inicio. Por eso esto baja al
 * mensaje: una conversación nueva puede empezar en mitad de un turno.
 */
export function partirEnConversaciones(
  mensajes: Mensaje[],
  umbralHoras: number = UMBRAL_POR_DEFECTO
): Conversacion[] {
  const umbral = Math.max(0, umbralHoras) * HORA_MS;
  const conversaciones: Conversacion[] = [];
  let anterior: Date | null = null;

  for (const m of mensajes) {
    if (!m.fecha) continue;

    const nueva = !anterior || m.fecha.getTime() - anterior.getTime() >= umbral;
    if (nueva) {
      conversaciones.push({
        inicia: m.autor,
        indiceApertura: m.indice,
        inicio: m.fecha,
        fin: m.fecha,
        mensajes: 1,
      });
    } else {
      const actual = conversaciones[conversaciones.length - 1];
      actual.fin = m.fecha;
      actual.mensajes++;
    }
    anterior = m.fecha;
  }

  return conversaciones;
}

export type QuienInicia = {
  conversaciones: number;
  /** Cuántas conversaciones rompe el silencio cada persona. */
  porAutor: Record<string, number>;
  /** El mismo dato en porcentaje, para la barra. */
  porcentajes: Record<string, number>;
  /** Quién empieza más, o «parecido». Solo con dos personas. */
  masInicios: Comparacion<string>;
  /** El umbral con el que se calculó, para poder enseñarlo. */
  umbralHoras: number;
};

/**
 * Quién empieza las conversaciones.
 *
 * `conversaciones` se puede pasar ya calculado para no repetir el trabajo.
 */
export function iniciaMas(
  mensajes: Mensaje[],
  umbralHoras: number = UMBRAL_POR_DEFECTO,
  conversaciones?: Conversacion[]
): QuienInicia {
  const lista = conversaciones ?? partirEnConversaciones(mensajes, umbralHoras);

  /* Todos los que escriben entran en el reparto, aunque no hayan empezado
     nunca. Si no, quien empieza todas las conversaciones sale solo en la
     barra con un 100 % y, al haber un único nombre, la comparación de dos
     no se hace y el titular acaba diciendo «parecido», que es justo lo
     contrario de lo que ha pasado. */
  const porAutor: Record<string, number> = {};
  for (const m of mensajes) if (m.autor) porAutor[m.autor] = porAutor[m.autor] || 0;
  for (const c of lista) porAutor[c.inicia] = (porAutor[c.inicia] || 0) + 1;

  const total = lista.length;
  const porcentajes: Record<string, number> = {};
  for (const [autor, n] of Object.entries(porAutor)) {
    porcentajes[autor] = total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
  }

  const autores = Object.keys(porAutor).sort((a, b) => a.localeCompare(b));
  const masInicios =
    autores.length === 2
      ? compararReparto(autores[0], porAutor[autores[0]], autores[1], porAutor[autores[1]])
      : { mayor: null, parecido: true };

  return { conversaciones: total, porAutor, porcentajes, masInicios, umbralHoras };
}
