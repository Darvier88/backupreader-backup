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
  /**
   * El archivo no cubre el mes entero.
   *
   * POR QUÉ IMPORTA
   * ---------------
   * Un export que empieza el 12 de enero y acaba el 15 de septiembre tiene
   * dos meses a medias en las puntas. Dibujados como los demás, enero y
   * septiembre salen bajos y la gráfica cuenta una historia que no pasó:
   * «empezasteis flojo y lo habéis dejado». No es que hablaran menos, es que
   * hay medio mes menos de archivo.
   *
   * Se marcan en vez de quitarlos porque quitarlos escondería que el archivo
   * no empieza donde empieza la conversación.
   */
  parcial: boolean;
  /** Días del mes que cubre el archivo, para poder explicarlo. */
  diasCubiertos: number;
  /** Días que tiene ese mes. */
  diasDelMes: number;
};

export type Tendencias = {
  medida: Medida;
  /** Todos los meses entre el primero y el último, huecos incluidos. */
  serie: PuntoDelMes[];
  /** El mes con más actividad, o `null` si no hay ninguna. */
  masActivo: PuntoDelMes | null;
  /** Meses enteros que cubre el archivo: lo que decide si hay tendencia. */
  mesesEnteros: number;
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

/** Cuántos días tiene un mes. El 0 del mes siguiente es su último día. */
const diasDe = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();

function rellenar(
  porMes: Actividad["porMes"],
  medida: Medida,
  /** Primer y último mensaje del chat, para saber qué meses están a medias. */
  desde?: Date | null,
  hasta?: Date | null
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
    const diasDelMes = diasDe(anio, mes);

    /* El archivo empieza en `desde` y acaba en `hasta`. Para el primer mes
       del chat se cubren los días que quedan desde ese día; para el último,
       los que van hasta ese día. Los de en medio están enteros. */
    let primerDia = 1;
    let ultimoDia = diasDelMes;
    if (desde && desde.getFullYear() === anio && desde.getMonth() + 1 === mes) {
      primerDia = desde.getDate();
    }
    if (hasta && hasta.getFullYear() === anio && hasta.getMonth() + 1 === mes) {
      ultimoDia = hasta.getDate();
    }
    const diasCubiertos = Math.max(0, ultimoDia - primerDia + 1);

    serie.push({
      clave,
      anio,
      mes,
      valor: valores.get(clave) ?? 0,
      parcial: diasCubiertos < diasDelMes,
      diasCubiertos,
      diasDelMes,
    });
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
  opciones: {
    /** Meses a cada lado de la comparación. */
    mesesPorTramo?: number;
    /** Primer y último mensaje del chat, para marcar los meses a medias. */
    desde?: Date | null;
    hasta?: Date | null;
  } = {}
): Tendencias {
  const serie = rellenar(porMes, medida, opciones.desde, opciones.hasta);

  const conValor = serie.filter((p) => p.valor > 0);
  const masActivo = conValor.length
    ? conValor.reduce((mejor, p) => (p.valor > mejor.valor ? p : mejor))
    : null;

  /* La comparación solo mira meses enteros. Un último mes a medias baja la
     media del tramo reciente sin que nadie haya escrito menos, y entonces
     esto anunciaría una caída que solo existe porque el archivo se exportó
     a mitad de mes. Es el error más fácil de cometer aquí y el más difícil
     de ver después. */
  const completos = serie.filter((p) => !p.parcial);

  /* El tramo se adapta a lo que hay: tres meses a cada lado cuando se puede,
     y la mitad de lo disponible cuando no. Exigir siempre seis meses enteros
     dejaba sin tendencia a casi cualquier chat de medio año, que es
     justamente cuando a la gente le interesa. Con dos meses la comparación
     es ruidosa, y por eso la interfaz enseña la serie entera al lado. */
  const mesesPorTramo =
    opciones.mesesPorTramo ?? Math.max(1, Math.min(3, Math.floor(completos.length / 2)));

  let comparacion: Tendencias["comparacion"] = null;
  if (completos.length >= mesesPorTramo * 2) {
    const reciente = media(completos.slice(-mesesPorTramo).map((p) => p.valor));
    const anterior = media(
      completos.slice(-mesesPorTramo * 2, -mesesPorTramo).map((p) => p.valor)
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

  return { medida, serie, mesesEnteros: completos.length, masActivo, comparacion };
}
