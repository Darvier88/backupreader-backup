/**
 * Pedir el análisis desde la interfaz, con worker si lo hay.
 *
 * EL RESPALDO NO ES OPCIONAL
 * --------------------------
 * Un Worker puede no arrancar: navegador viejo, una extensión de por medio,
 * una política de contenido estricta. Si eso pasa, se calcula en el hilo
 * principal: la pestaña se queda quieta unos segundos en un chat enorme,
 * pero la función sigue estando. Es el mismo patrón que la subida de
 * backups, que ya hace esto.
 *
 * SOLO IMPORTA LA ÚLTIMA PETICIÓN
 * -------------------------------
 * Si alguien mueve el umbral de 1 a 4 y a 8 horas seguidas, salen tres
 * peticiones y solo vale la última. Por eso cada una lleva id y las
 * respuestas viejas se tiran: sin esto, una respuesta lenta puede pisar a
 * una más nueva y dejar en pantalla cifras que no son las de los ajustes
 * que se ven.
 */

import { analizar, type Analisis, type OpcionesAnalisis } from "./analizar";
import type { EntradaAnalisis, SalidaAnalisis } from "./worker";

export type ResultadoAnalisis = {
  analisis: Analisis;
  /** Cuánto tardó, para poder medirlo sin instrumentar nada. */
  ms: number;
  /** `false` si hubo que calcularlo en el hilo principal. */
  conWorker: boolean;
};

let worker: Worker | null = null;
let workerImposible = false;
let siguienteId = 1;

function obtenerWorker(): Worker | null {
  if (workerImposible) return null;
  if (worker) return worker;
  if (typeof Worker === "undefined") {
    workerImposible = true;
    return null;
  }
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    return worker;
  } catch {
    workerImposible = true;
    return null;
  }
}

/** Tira el worker: la próxima petición hará uno nuevo o irá por el respaldo. */
export function olvidarWorker() {
  try {
    worker?.terminate();
  } catch {
    /* da igual: lo que importa es no reutilizarlo */
  }
  worker = null;
}

function enElHilo(filas: string[][], opciones: OpcionesAnalisis): ResultadoAnalisis {
  const empezo = Date.now();
  const analisis = analizar(filas, opciones);
  return { analisis, ms: Date.now() - empezo, conWorker: false };
}

/**
 * Analiza el chat. Si el worker falla, lo hace aquí mismo.
 *
 * `señal` permite abandonar una petición que ya no interesa; el worker sigue
 * un rato con ella, pero el resultado se descarta.
 */
export function pedirAnalisis(
  filas: string[][],
  opciones: OpcionesAnalisis = {},
  senal?: AbortSignal
): Promise<ResultadoAnalisis> {
  const w = obtenerWorker();
  if (!w) return Promise.resolve(enElHilo(filas, opciones));

  const id = siguienteId++;

  return new Promise<ResultadoAnalisis>((resolve, reject) => {
    const limpiar = () => {
      w.removeEventListener("message", alLlegar);
      w.removeEventListener("error", alFallar);
      senal?.removeEventListener("abort", alAbortar);
    };

    const alLlegar = (ev: MessageEvent<SalidaAnalisis>) => {
      const msg = ev.data;
      /* Una respuesta de otra petición: no es la nuestra, se ignora. */
      if (!msg || msg.id !== id) return;
      limpiar();
      if (msg.tipo === "listo") resolve({ analisis: msg.analisis, ms: msg.ms, conWorker: true });
      else reject(new Error(msg.mensaje));
    };

    const alFallar = () => {
      limpiar();
      /* El worker se ha roto: se tira y se calcula aquí, que es peor pero
         funciona. */
      olvidarWorker();
      workerImposible = true;
      resolve(enElHilo(filas, opciones));
    };

    const alAbortar = () => {
      limpiar();
      reject(new DOMException("análisis cancelado", "AbortError"));
    };

    w.addEventListener("message", alLlegar);
    w.addEventListener("error", alFallar);
    senal?.addEventListener("abort", alAbortar);

    const entrada: EntradaAnalisis = { tipo: "analizar", id, filas, opciones };
    try {
      w.postMessage(entrada);
    } catch (e) {
      alFallar();
    }
  });
}
