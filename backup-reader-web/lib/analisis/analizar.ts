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
import { deducirFormato, type FormatoFecha } from "./fechaHora";
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
import {
  MIN_CONVERSACIONES,
  MIN_DIAS,
  MIN_MENSAJES,
  MIN_MESES,
  MIN_RESPUESTAS,
} from "./umbrales";

/**
 * Qué tiene el chat y qué pide cada cifra.
 *
 * Existe para que la interfaz no tenga que saber de umbrales: pregunta si
 * una métrica llega, y si no, enseña cuánto le falta. Antes el panel entero
 * desaparecía por debajo de cien mensajes; contar cuánto escribe cada uno se
 * puede hacer con cuarenta, lo que no se puede es hablar de ritmos.
 */
export type Cobertura = {
  /** `tiene` de lo que hay, `pide` del mínimo, `llega` si basta. */
  mensajes: Medida3;
  conversaciones: Medida3;
  /** Respuestas de quien MENOS tiene: la mediana de uno solo no vale. */
  respuestas: Medida3;
  dias: Medida3;
  meses: Medida3;
};

type Medida3 = { tiene: number; pide: number; llega: boolean };

const medir = (tiene: number, pide: number): Medida3 => ({
  tiene,
  pide,
  llega: tiene >= pide,
});

/**
 * Sube cuando cambia la forma del resultado: las cachés viejas se rehacen.
 *
 * 2: mapa por cubos de cuatro horas, meses incompletos marcados y el tramo
 *    de cinco minutos en los tiempos de respuesta.
 * 3: el formato de fecha deducido, para poder avisar cuando no es seguro.
 * 4: la cobertura por métrica, y los mínimos nuevos (parecido a 5 puntos,
 *    10 conversaciones, 30 respuestas por persona, 14 días, 2 meses).
 * 5: «quién escribe detrás de ti» en grupos, con su línea base.
 */
export const VERSION_ANALISIS = 7;

export type OpcionesAnalisis = OpcionesNormalizar & {
  /** Quién es «tú»: hace falta para «quién escribe detrás de ti». */
  yo?: string;
  /** Horas de silencio que separan dos conversaciones. */
  umbralHoras?: number;
  /** Qué se mide en las tendencias. */
  medida?: Medida;
};

export type Analisis = {
  v: number;
  /** Con qué ajustes se calculó: si cambian, hay que recalcular. */
  ajustes: { umbralHoras: number; medida: Medida; idioma: string; yo?: string };

  /** De cuándo a cuándo, y qué quedó fuera. */
  desde: number | null;
  hasta: number | null;
  totalFilas: number;
  mensajesContables: number;
  eliminados: number;
  sistema: number;
  sinFecha: number;
  autores: string[];
  /**
   * Hay algo que contar: al menos dos personas y mensajes con fecha.
   *
   * No es «hay bastante»: eso lo dice `cobertura`, métrica por métrica.
   */
  suficiente: boolean;
  /** Qué llega y qué no, por métrica. */
  cobertura: Cobertura;
  /**
   * Qué formato de fecha se dedujo y si el chat lo demuestra.
   *
   * Cuando `seguro` es falso, el chat no tiene ninguna fecha con un número
   * mayor que 12 y no hay manera de saber si 3/4 es el 3 de abril o el 4 de
   * marzo. Las cifras del día a día aguantan, pero «mensajes por mes» puede
   * estar entero desplazado, y eso hay que decirlo antes de enseñar la
   * gráfica, no después.
   */
  formatoFecha: FormatoFecha;

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

  /* El formato se deduce aparte para poder devolverlo: `normalizar` lo usa
     por dentro pero no lo cuenta, y la interfaz necesita saber si es fiable. */
  const formatoFecha =
    opciones.formato ?? deducirFormato(filas, opciones.diaPrimeroPorDefecto ?? true);

  const chat = normalizar(filas, { ...opciones, formato: formatoFecha });
  const mensajes = contables(chat);
  const turnos = agruparEnTurnos(mensajes);
  const conversaciones = partirEnConversaciones(mensajes, umbralHoras);
  const cuando = actividad(mensajes);

  const respuestas = tiempoDeRespuesta(turnos, umbralHoras);
  const serie = tendencias(cuando.porMes, medida, {
    desde: chat.desde,
    hasta: chat.hasta,
  });

  return {
    v: VERSION_ANALISIS,
    ajustes: { umbralHoras, medida, idioma, yo: opciones.yo },

    desde: chat.desde ? chat.desde.getTime() : null,
    hasta: chat.hasta ? chat.hasta.getTime() : null,
    totalFilas: filas.length,
    mensajesContables: mensajes.length,
    eliminados: chat.eliminados,
    sistema: chat.sistema,
    sinFecha: chat.sinFecha,
    autores: chat.autores,
    suficiente: mensajes.length > 0 && chat.autores.length >= 2,
    cobertura: {
      mensajes: medir(mensajes.length, MIN_MENSAJES),
      conversaciones: medir(conversaciones.length, MIN_CONVERSACIONES),
      respuestas: medir(
        respuestas.porAutor.length > 0
          ? Math.min(...respuestas.porAutor.map((r) => r.respuestas))
          : 0,
        MIN_RESPUESTAS
      ),
      dias: medir(cuando.diasConMensajes, MIN_DIAS),
      meses: medir(serie.mesesEnteros, MIN_MESES),
    },
    formatoFecha,

    volumen: escribeMas(mensajes, turnos),
    inicios: iniciaMas(mensajes, umbralHoras, conversaciones),
    respuestas,
    actividad: cuando,
    /* Las fechas de los extremos son lo que deja saber qué meses están a
       medias: sin ellas, la gráfica dibuja enero bajo sin decir que el
       archivo empieza el día 12. */
    tendencias: serie,
    emojis: emojis(mensajes),
    palabras: palabrasFrecuentes(mensajes, { idioma }),
    expresiones: disculpasYAgradecimientos(mensajes),
    grupo: grupos(chat, mensajes, umbralHoras, opciones.yo),
  };
}
