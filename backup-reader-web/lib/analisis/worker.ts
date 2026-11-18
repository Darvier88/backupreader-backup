/// <reference lib="webworker" />

/**
 * El análisis, fuera del hilo principal.
 *
 * POR QUÉ
 * -------
 * Un chat de cincuenta mil mensajes son unos cuantos segundos de cuentas.
 * Hechas en el hilo principal, la pestaña se queda congelada todo ese rato:
 * no responde el scroll, no se puede cambiar de pestaña ni cancelar. En un
 * worker, la interfaz sigue viva y puede enseñar que está calculando.
 *
 * LO QUE VIAJA Y LO QUE NO
 * ------------------------
 * Entran las filas del chat, que ya están descifradas en memoria, y sale el
 * resultado. Las dos cosas se quedan dentro de la pestaña: un worker es otro
 * hilo del mismo navegador, no un servidor. Aquí no hay ni una petición de
 * red, y ese es el punto de toda la función.
 */

import { analizar, type Analisis, type OpcionesAnalisis } from "./analizar";

export type EntradaAnalisis = {
  tipo: "analizar";
  /** Para emparejar la respuesta si llegan dos peticiones seguidas. */
  id: number;
  filas: string[][];
  opciones: OpcionesAnalisis;
};

export type SalidaAnalisis =
  | { tipo: "listo"; id: number; analisis: Analisis; ms: number }
  | { tipo: "error"; id: number; mensaje: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<EntradaAnalisis>) => {
  const msg = ev.data;
  if (!msg || msg.tipo !== "analizar") return;

  const empezo = Date.now();
  try {
    const analisis = analizar(msg.filas, msg.opciones);
    const salida: SalidaAnalisis = {
      tipo: "listo",
      id: msg.id,
      analisis,
      ms: Date.now() - empezo,
    };
    ctx.postMessage(salida);
  } catch (e: any) {
    const salida: SalidaAnalisis = {
      tipo: "error",
      id: msg.id,
      mensaje: e?.message || "fallo al analizar",
    };
    ctx.postMessage(salida);
  }
};

export {};
