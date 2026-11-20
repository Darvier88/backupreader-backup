/**
 * Cuánto tarda cada uno en contestar.
 *
 * QUÉ CUENTA COMO RESPUESTA
 * -------------------------
 * Un turno que llega después de otro de la otra persona, dentro de la misma
 * conversación. Si el hueco pasa del umbral de silencio, eso no es una
 * respuesta tardía: es una conversación nueva, y meterla aquí convertiría
 * «me escribió al día siguiente» en «tardó catorce horas en contestar».
 *
 * SE MIDE DESDE QUE EL OTRO DEJÓ DE ESCRIBIR
 * ------------------------------------------
 * Si alguien manda cinco mensajes en diez minutos, contestar al quinto no es
 * tardar diez minutos más: es contestar cuando terminó de hablar.
 *
 * MEDIANA, Y TAMBIÉN EL REPARTO
 * -----------------------------
 * La media se va a las nubes con una noche dormida de por medio. Se da la
 * mediana —la respuesta típica— y, además, cuántas caen bajo un minuto, bajo
 * una hora y por encima, porque «tarda 20 minutos» describe mal a quien
 * contesta al instante la mitad de las veces y a las dos horas la otra mitad.
 */

import { mediana } from "./turnos";
import type { Turno } from "./tipos";
import { UMBRAL_POR_DEFECTO } from "./iniciaMas";
import { compararDuraciones, type Comparacion } from "./umbrales";

const MINUTO = 60 * 1000;
const HORA_MS = 60 * MINUTO;

export type RespuestasDeAutor = {
  autor: string;
  /** Cuántas veces ha contestado. */
  respuestas: number;
  /** La respuesta típica, en milisegundos. */
  medianaMs: number;
  /** Reparto por tramos, para que una mediana no esconda dos costumbres. */
  bajoUnMinuto: number;
  bajoUnaHora: number;
  masDeUnaHora: number;
  /**
   * Respuestas en cinco minutos o menos, y su porcentaje.
   *
   * POR QUÉ CINCO Y NO LA MEDIANA
   * -----------------------------
   * La mediana dice cuánto tarda la respuesta del medio, y eso deja fuera lo
   * que la gente nota de verdad: si el otro está pendiente. Dos personas con
   * la misma mediana de doce minutos pueden ser una que contesta al vuelo la
   * mitad de las veces y tarda mucho la otra mitad, y otra que siempre tarda
   * un rato medio. El porcentaje por debajo de cinco minutos separa esos dos
   * casos, que es justo lo que la mediana junta.
   */
  bajoCincoMinutos: number;
  porcentajeBajoCincoMinutos: number;
};

export type TiemposDeRespuesta = {
  porAutor: RespuestasDeAutor[];
  totalRespuestas: number;
  /** Quién tarda más, o «parecido». Solo con dos personas. */
  tardaMas: Comparacion<string>;
  umbralHoras: number;
};

/** Los tiempos de respuesta de cada persona. */
export function tiempoDeRespuesta(
  turnos: Turno[],
  umbralHoras: number = UMBRAL_POR_DEFECTO
): TiemposDeRespuesta {
  const umbral = Math.max(0, umbralHoras) * HORA_MS;

  const esperas = new Map<string, number[]>();
  for (let i = 1; i < turnos.length; i++) {
    const turno = turnos[i];
    const anterior = turnos[i - 1];
    if (turno.autor === anterior.autor) continue; /* no debería pasar */

    const espera = turno.inicio.getTime() - anterior.fin.getTime();
    if (espera < 0) continue; /* export desordenado: mejor no contarlo */
    /* Pasado el umbral ya no es una respuesta tardía, es otra conversación. */
    if (espera >= umbral) continue;

    const lista = esperas.get(turno.autor) || [];
    lista.push(espera);
    esperas.set(turno.autor, lista);
  }

  const porAutor: RespuestasDeAutor[] = [...esperas.entries()]
    .map(([autor, lista]) => {
      const bajoCincoMinutos = lista.filter((ms) => ms <= 5 * MINUTO).length;
      return {
        autor,
        respuestas: lista.length,
        medianaMs: mediana(lista) ?? 0,
        bajoUnMinuto: lista.filter((ms) => ms < MINUTO).length,
        bajoUnaHora: lista.filter((ms) => ms >= MINUTO && ms < 60 * MINUTO).length,
        masDeUnaHora: lista.filter((ms) => ms >= 60 * MINUTO).length,
        bajoCincoMinutos,
        porcentajeBajoCincoMinutos:
          lista.length > 0 ? Math.round((bajoCincoMinutos / lista.length) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => a.medianaMs - b.medianaMs || a.autor.localeCompare(b.autor));

  const totalRespuestas = porAutor.reduce((n, a) => n + a.respuestas, 0);

  const tardaMas =
    porAutor.length === 2
      ? compararDuraciones(
          porAutor[0].autor,
          porAutor[0].medianaMs,
          porAutor[1].autor,
          porAutor[1].medianaMs,
          /* Menos de un minuto de diferencia no lo nota nadie. */
          { proporcion: 1.5, suelo: MINUTO }
        )
      : { mayor: null, parecido: true };

  return { porAutor, totalRespuestas, tardaMas, umbralHoras };
}
