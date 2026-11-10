/**
 * Encontrar dónde aparece lo buscado dentro de un texto, para poder pintarlo.
 *
 * EL PROBLEMA DE LOS ÍNDICES
 * --------------------------
 * Buscar tiene que ignorar mayúsculas y tildes: quien escribe "documentos"
 * espera encontrar "Documentos", y quien escribe "mama" espera "mamá". Lo
 * natural sería normalizar el texto y buscar ahí.
 *
 * Pero entonces las posiciones que se obtienen son del texto NORMALIZADO, y lo
 * que hay que pintar es el ORIGINAL. Y no miden lo mismo: `"café".normalize
 * ("NFD")` convierte la "é" en dos caracteres, así que a partir de ahí cada
 * posición va corrida. Resaltar con esos números pinta el trozo equivocado, y
 * el error crece con cada tilde que haya antes.
 *
 * La solución es normalizar carácter a carácter, guardando de qué posición del
 * original vino cada uno. Así se busca sobre el texto normalizado y se pinta
 * sobre el original, sin que nada se descoloque.
 *
 * La ñ se respeta, igual que en el índice: en español no es una n con tilde,
 * es otra letra, y buscar "ano" no debería encontrar "año".
 */

/** Un trozo de texto, dicho si es coincidencia o no. */
export type Trozo = {
  texto: string;
  /** Si este trozo es una de las coincidencias. */
  coincide: boolean;
  /** Qué número de coincidencia es, empezando en 0. -1 si no coincide. */
  indice: number;
};

/**
 * Normaliza conservando, para cada carácter del resultado, de qué posición del
 * original salió.
 */
function normalizarConMapa(texto: string): { plano: string; mapa: number[] } {
  let plano = "";
  const mapa: number[] = [];

  for (let i = 0; i < texto.length; i++) {
    const original = texto[i];
    const bajo = original.toLowerCase();

    if (bajo === "ñ") {
      plano += "ñ";
      mapa.push(i);
      continue;
    }

    /* Se descompone y se quitan los diacríticos de ESTE carácter. El resultado
       puede ser más de una letra ("ﬁ" → "fi") o ninguna (un acento suelto).
       Todas apuntan a la misma posición del original, que es lo que permite
       recomponer el tramo exacto después. */
    const sinTilde = bajo.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const c of sinTilde) {
      plano += c;
      mapa.push(i);
    }
  }

  return { plano, mapa };
}

/**
 * Parte un texto en trozos, marcando dónde aparece la consulta.
 *
 * Devuelve el texto entero, no solo las coincidencias: quien lo pinta necesita
 * lo de alrededor para que el mensaje se siga leyendo.
 */
export function partirPorCoincidencias(texto: string, consulta: string): Trozo[] {
  const limpio = (texto ?? "").toString();
  const termino = (consulta ?? "").trim();

  /* Una sola letra coincidiría con casi todo y dejaría el mensaje lleno de
     marcas que no ayudan a leer. */
  if (!limpio || termino.length < 2) {
    return [{ texto: limpio, coincide: false, indice: -1 }];
  }

  const { plano, mapa } = normalizarConMapa(limpio);
  const { plano: aguja } = normalizarConMapa(termino);
  if (!aguja) return [{ texto: limpio, coincide: false, indice: -1 }];

  const trozos: Trozo[] = [];
  let cursorOriginal = 0;
  let desde = 0;
  let nEncontradas = 0;

  while (true) {
    const posPlano = plano.indexOf(aguja, desde);
    if (posPlano === -1) break;

    /* De vuelta al original: dónde empieza, y dónde empieza lo siguiente. El
       final es el principio del carácter de después, no `mapa[fin]`, porque un
       carácter del original puede ocupar varias posiciones del normalizado. */
    const iniOriginal = mapa[posPlano];
    const finPlano = posPlano + aguja.length;
    const finOriginal = finPlano < mapa.length ? mapa[finPlano] : limpio.length;

    if (iniOriginal > cursorOriginal) {
      trozos.push({
        texto: limpio.slice(cursorOriginal, iniOriginal),
        coincide: false,
        indice: -1,
      });
    }

    trozos.push({
      texto: limpio.slice(iniOriginal, finOriginal),
      coincide: true,
      indice: nEncontradas++,
    });

    cursorOriginal = finOriginal;
    desde = finPlano;
  }

  if (cursorOriginal < limpio.length) {
    trozos.push({
      texto: limpio.slice(cursorOriginal),
      coincide: false,
      indice: -1,
    });
  }

  return trozos.length ? trozos : [{ texto: limpio, coincide: false, indice: -1 }];
}

/** ¿Aparece la consulta en este texto? Más barato que partirlo entero. */
export function contiene(texto: string, consulta: string): boolean {
  const termino = (consulta ?? "").trim();
  if (!texto || termino.length < 2) return false;
  const { plano } = normalizarConMapa(texto);
  const { plano: aguja } = normalizarConMapa(termino);
  return !!aguja && plano.includes(aguja);
}

/** Cuántas veces aparece la consulta en el texto. */
export function cuantasVeces(texto: string, consulta: string): number {
  return partirPorCoincidencias(texto, consulta).filter((t) => t.coincide).length;
}

/**
 * Un fragmento alrededor de la primera coincidencia, para los resultados de la
 * búsqueda global.
 *
 * Un mensaje largo no cabe en una fila de resultados, y cortarlo por el
 * principio puede dejar fuera justo la palabra que se buscaba. Se recorta
 * alrededor de la coincidencia, con unos caracteres de contexto a cada lado.
 */
export function fragmentoAlrededor(
  texto: string,
  consulta: string,
  contexto = 40
): string {
  const limpio = (texto ?? "").toString();
  const trozos = partirPorCoincidencias(limpio, consulta);
  const primera = trozos.findIndex((t) => t.coincide);
  if (primera === -1) return limpio.slice(0, contexto * 2);

  let posicion = 0;
  for (let i = 0; i < primera; i++) posicion += trozos[i].texto.length;

  const ini = Math.max(0, posicion - contexto);
  const fin = Math.min(limpio.length, posicion + trozos[primera].texto.length + contexto);

  return (
    (ini > 0 ? "…" : "") + limpio.slice(ini, fin) + (fin < limpio.length ? "…" : "")
  );
}
