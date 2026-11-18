/**
 * Un chat entra, un resultado sale.
 *
 * Todas las métricas en una sola pasada de preparación: normalizar y agrupar
 * en turnos es lo caro, y hacerlo una vez por tarjeta multiplicaría por siete
 * el trabajo sobre un chat de cincuenta mil mensajes.
 *
 * EL RESULTADO ES LO QUE SE GUARDA CIFRADO
 * ----------------------------------------
 * Esta forma es el contrato con la caché (`piezaAnalisis.ts`) y con la
 * interfaz. Cambiarla obliga a subir `VERSION_ANALISIS`, y entonces las
 * cachés viejas se recalculan solas en vez de leerse mal.
 *
 * NO HAY TEXTO DEL CHAT AQUÍ DENTRO
 * ---------------------------------
 * Salvo las palabras y los emojis contados, que son el dato en sí, lo que
 * sale son números e ÍNDICES de mensaje. Los ejemplos no llevan el texto:
 * llevan la posición, y la interfaz va a buscar el mensaje a la lista que ya
 * está descifrada en memoria. Así lo que se guarda, aun estando cifrado,
 * tampoco es una copia de la conversación.
 */

import { normalizar, contables, type OpcionesNormalizar } from "./normalizar";
import { agruparEnTurnos } from "./turnos";
import { escribeMas, type Volumen } from "./escribeMas";
import {
  iniciaMas,
  partirEnConversaciones,
  UMBRAL_POR_DEFECTO,
  type QuienInicia,
} from "./iniciaMas";
import { tiempoDeRespuesta, type TiemposDeRespuesta } from "./tiempoDeRespuesta";
import { actividad, type Actividad } from "./actividad";
import { tendencias, type Medida, type Tendencias } from "./tendencias";
import { emojis, type Emojis } from "./emojis";
import { palabrasFrecuentes, type Palabras } from "./palabrasFrecuentes";
import {
  disculpasYAgradecimientos,
  type Expresiones,
} from "./disculpasYAgradecimientos";
import { grupos, type Grupo } from "./grupos";
import { MIN_MENSAJES } from "./umbrales";

/** Sube cuando cambia la forma del resultado: las cachés viejas se rehacen. */
export const VERSION_ANALISIS = 1;

export type OpcionesAnalisis = OpcionesNormalizar & {
  /** Horas de silencio que separan dos conversaciones. */
  umbralHoras?: number;
  /** Qué se mide en las tendencias. */
  medida?: Medida;
};

export type Analisis = {
  v: number;
  /** Con qué ajustes se calculó: si cambian, hay que recalcular. */
  ajustes: { umbralHoras: number; medida: Medida; idioma: string };

  /** De cuándo a cuándo, y qué quedó fuera. */
  desde: number | null;
  hasta: number | null;
  totalFilas: number;
  mensajesContables: number;
  eliminados: number;
  sistema: number;
  sinFecha: number;
  autores: string[];
  /** Si el chat llega al mínimo para enseñar algo. */
  suficiente: boolean;

  volumen: Volumen;
  inicios: QuienInicia;
  respuestas: TiemposDeRespuesta;
  actividad: Actividad;
  tendencias: Tendencias;
  emojis: Emojis;
  palabras: Palabras;
  expresiones: Expresiones;
  grupo: Grupo;
};

/** Calcula todo. Es pura: mismas filas y mismos ajustes, mismo resultado. */
export function analizar(filas: string[][], opciones: OpcionesAnalisis = {}): Analisis {
  const umbralHoras = opciones.umbralHoras ?? UMBRAL_POR_DEFECTO;
  const medida: Medida = opciones.medida ?? "mensajes";
  const idioma = opciones.idioma || "es";

  const chat = normalizar(filas, opciones);
  const mensajes = contables(chat);
  const turnos = agruparEnTurnos(mensajes);
  const conversaciones = partirEnConversaciones(mensajes, umbralHoras);
  const cuando = actividad(mensajes);

  return {
    v: VERSION_ANALISIS,
    ajustes: { umbralHoras, medida, idioma },

    desde: chat.desde ? chat.desde.getTime() : null,
    hasta: chat.hasta ? chat.hasta.getTime() : null,
    totalFilas: filas.length,
    mensajesContables: mensajes.length,
    eliminados: chat.eliminados,
    sistema: chat.sistema,
    sinFecha: chat.sinFecha,
    autores: chat.autores,
    suficiente: mensajes.length >= MIN_MENSAJES,

    volumen: escribeMas(mensajes, turnos),
    inicios: iniciaMas(mensajes, umbralHoras, conversaciones),
    respuestas: tiempoDeRespuesta(turnos, umbralHoras),
    actividad: cuando,
    tendencias: tendencias(cuando.porMes, medida),
    emojis: emojis(mensajes),
    palabras: palabrasFrecuentes(mensajes, { idioma }),
    expresiones: disculpasYAgradecimientos(mensajes),
    grupo: grupos(chat, mensajes, umbralHoras),
  };
}
