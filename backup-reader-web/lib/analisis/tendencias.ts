/**
 * Cómo ha ido cambiando el chat con el tiempo.
 *
 * LOS MESES SIN NADA TAMBIÉN SON DATO
 * -----------------------------------
 * Si en una gráfica se dibujan solo los meses con mensajes, tres meses de
 * silencio se encogen hasta desaparecer y la línea parece continua. Aquí la
 * serie se rellena con ceros de punta a punta: los silencios se ven, que es
 * justo lo que cuenta de la historia de un chat.
 *
 * COMPARAR SIN REGAÑAR
 * --------------------
 * Se comparan los últimos meses con los anteriores y se dice «más», «menos»
 * o «parecido», con las dos cifras al lado. Nada de «habláis un 40 % menos»
 * como titular: un chat que baja puede ser dos personas que ahora se ven en
 * persona. El dato se enseña; la conclusión es de quien lo lee.
 */

import type { Actividad } from "./actividad";

/** Qué se mide en la serie. Lo elige Ajustes. */
export type Medida = "mensajes" | "palabras" | "notasDeVoz";

export type PuntoDelMes = {
  /** «aaaa-mm». */
  clave: string;
  anio: number;
  /** 1 a 12. */
  mes: number;
  valor: number;
};

export type Tendencias = {
  medida: Medida;
  /** Todos los meses entre el primero y el último, huecos incluidos. */
  serie: PuntoDelMes[];
  /** El mes con más actividad, o `null` si no hay ninguna. */
  masActivo: PuntoDelMes | null;
  /** Media mensual del tramo reciente y del anterior, y qué pasó. */
  comparacion: {
    meses: number;
    reciente: number;
    anterior: number;
    direccion: "mas" | "menos" | "parecido";
  } | null;
};

/** Por debajo de este cambio, los dos tramos son el mismo. */
const MARGEN = 0.2;

function rellenar(
  porMes: Actividad["porMes"],
  medida: Medida
): PuntoDelMes[] {
  if (porMes.length === 0) return [];

  const valores = new Map(porMes.map((m) => [m.clave, m[medida]]));
  const primero = porMes[0];
  const ultimo = porMes[porMes.length - 1];

  const serie: PuntoDelMes[] = [];
  let anio = primero.anio;
  let mes = primero.mes;

  /* Tope por si llegara una fecha disparatada: 100 años de chat es de sobra
     y evita que un año corrupto haga una serie infinita. */
  for (let i = 0; i < 1200; i++) {
    const clave = `${anio}-${String(mes).padStart(2, "0")}`;
    serie.push({ clave, anio, mes, valor: valores.get(clave) ?? 0 });
    if (anio === ultimo.anio && mes === ultimo.mes) break;
    mes++;
    if (mes > 12) {
      mes = 1;
      anio++;
    }
  }

  return serie;
}

const media = (valores: number[]) =>
  valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

/**
 * La serie por meses y la comparación entre el tramo reciente y el anterior.
 *
 * `mesesPorTramo` es cuántos meses entran en cada lado de la comparación; se
 * necesita el doble de meses en la serie para que haya comparación.
 */
export function tendencias(
  porMes: Actividad["porMes"],
  medida: Medida = "mensajes",
  mesesPorTramo = 3
): Tendencias {
  const serie = rellenar(porMes, medida);

  const conValor = serie.filter((p) => p.valor > 0);
  const masActivo = conValor.length
    ? conValor.reduce((mejor, p) => (p.valor > mejor.valor ? p : mejor))
    : null;

  let comparacion: Tendencias["comparacion"] = null;
  if (serie.length >= mesesPorTramo * 2) {
    const reciente = media(serie.slice(-mesesPorTramo).map((p) => p.valor));
    const anterior = media(
      serie.slice(-mesesPorTramo * 2, -mesesPorTramo).map((p) => p.valor)
    );

    let direccion: "mas" | "menos" | "parecido" = "parecido";
    if (anterior === 0 && reciente === 0) direccion = "parecido";
    else if (anterior === 0) direccion = "mas";
    else {
      const cambio = (reciente - anterior) / anterior;
      if (cambio > MARGEN) direccion = "mas";
      else if (cambio < -MARGEN) direccion = "menos";
    }

    comparacion = {
      meses: mesesPorTramo,
      reciente: Math.round(reciente * 10) / 10,
      anterior: Math.round(anterior * 10) / 10,
      direccion,
    };
  }

  return { medida, serie, masActivo, comparacion };
}
