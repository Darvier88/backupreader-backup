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
 * ¿Vale la pena buscar este término?
 *
 * Una sola letra coincidiría con casi todo y dejaría el mensaje lleno de
 * marcas que no ayudan a leer. Un emoji suelto no: «❤» es un carácter de
 * longitud 1, pero marcarlo es justamente lo que se pide al tocar «❤️ · 47»
 * en el análisis, y no aparece dentro de ninguna palabra.
 */
/**
 * Una consulta que no es un texto literal, sino una forma.
 *
 * Existe por los enlaces: «compartir link» no es una palabra que aparezca
 * escrita en ningún mensaje, y buscar sus trozos («http», «www.») cuenta mal
 * —`https://www.x.com` llevaría dos marcas y `github.com/x` ninguna—, de modo
 * que la cifra de la tarjeta y la del filtro dejaban de coincidir, que es lo
 * único que hace comprobable una cifra.
 *
 * Viaja como texto y no como `RegExp` porque vive en el estado de React y se
 * pasa por props: una expresión con bandera global arrastra `lastIndex` entre
 * llamadas y acabaría saltándose coincidencias según quién buscara antes.
 * Aquí se construye una nueva en cada búsqueda.
 */
export type Patron = { patron: string };

/** Lo que se puede buscar: una palabra, varias, o una forma. */
export type Terminos = string | string[] | Patron;

const esPatron = (c: unknown): c is Patron =>
  !!c && typeof c === "object" && typeof (c as Patron).patron === "string";

const vale = (c: string) => c.length >= 2 || (c.length === 1 && !/[\p{L}\p{N}]/u.test(c));

/**
 * Parte un texto en trozos, marcando dónde aparece la consulta.
 *
 * Devuelve el texto entero, no solo las coincidencias: quien lo pinta necesita
 * lo de alrededor para que el mensaje se siga leyendo.
 *
 * VARIOS TÉRMINOS A LA VEZ
 * ------------------------
 * La consulta puede ser una lista. Hace falta para filtrar el chat desde el
 * análisis: «disculpas» no es una palabra, son «perdón», «lo siento» y
 * «disculpa», y el contador tiene que decir cuántas hay de las tres juntas.
 * Con un término suelto se comporta exactamente igual que antes.
 *
 * Cuando dos términos coinciden en el mismo sitio gana el más largo: con
 * «perdón» y «perdona» en la lista, marcar solo «perdón» dejaría la «a»
 * suelta fuera de la marca.
 */
export function partirPorCoincidencias(
  texto: string,
  consulta: Terminos
): Trozo[] {
  const limpio = (texto ?? "").toString();
  const patron = esPatron(consulta) ? consulta.patron : null;
  const lista = patron
    ? []
    : (Array.isArray(consulta) ? consulta : [consulta as string])
        .map((c) => (c ?? "").trim())
        .filter(vale);

  if (!limpio || (!patron && lista.length === 0)) {
    return [{ texto: limpio, coincide: false, indice: -1 }];
  }

  const { plano, mapa } = normalizarConMapa(limpio);
  const agujas = lista.map((c) => normalizarConMapa(c).plano).filter(Boolean);
  if (!patron && agujas.length === 0) {
    return [{ texto: limpio, coincide: false, indice: -1 }];
  }

  /* Una por búsqueda, nunca compartida: con bandera global, `lastIndex` se
     queda donde acabó la anterior. */
  const regex = patron ? new RegExp(patron, "gi") : null;

  const trozos: Trozo[] = [];
  let cursorOriginal = 0;
  let desde = 0;
  let nEncontradas = 0;

  while (true) {
    /* La más temprana de todas; a igual posición, la más larga. */
    let posPlano = -1;
    let largo = 0;
    if (regex) {
      regex.lastIndex = desde;
      const m = regex.exec(plano);
      /* Una coincidencia vacía no avanzaría y dejaría el bucle girando. */
      if (m && m[0].length > 0) {
        posPlano = m.index;
        largo = m[0].length;
      }
    } else {
      for (const a of agujas) {
        const p = plano.indexOf(a, desde);
        if (p === -1) continue;
        if (posPlano === -1 || p < posPlano || (p === posPlano && a.length > largo)) {
          posPlano = p;
          largo = a.length;
        }
      }
    }
    if (posPlano === -1) break;

    /* De vuelta al original: dónde empieza, y dónde empieza lo siguiente. El
       final es el principio del carácter de después, no `mapa[fin]`, porque un
       carácter del original puede ocupar varias posiciones del normalizado. */
    const iniOriginal = mapa[posPlano];
    const finPlano = posPlano + largo;
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
export function contiene(texto: string, consulta: Terminos): boolean {
  /* Con una forma no hay atajo barato: se busca igual que al partir, para
     que responda exactamente lo mismo. */
  if (esPatron(consulta)) {
    return partirPorCoincidencias(texto, consulta).some((t) => t.coincide);
  }
  const lista = (Array.isArray(consulta) ? consulta : [consulta])
    .map((c) => (c ?? "").trim())
    .filter(vale);
  if (!texto || lista.length === 0) return false;
  const { plano } = normalizarConMapa(texto);
  return lista.some((c) => {
    const { plano: aguja } = normalizarConMapa(c);
    return !!aguja && plano.includes(aguja);
  });
}

/** Cuántas veces aparece la consulta en el texto. */
export function cuantasVeces(texto: string, consulta: Terminos): number {
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
