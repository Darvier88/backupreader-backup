/**
 * El índice de búsqueda de un chat: construirlo, y buscar dentro de él.
 *
 * QUÉ PROBLEMA RESUELVE
 * ---------------------
 * Los mensajes viven cifrados en Storage y solo se descifran al abrir su chat.
 * Para buscar en TODOS los chats habría que bajarlos y descifrarlos todos cada
 * vez que alguien escribe en el buscador. Con unos pocos es instantáneo; con
 * cincuenta chats de años, la pestaña se congela.
 *
 * El índice es un resumen pequeño: qué palabras aparecen y en qué mensajes.
 * Se construye una vez, se guarda cifrado junto al backup, y a partir de ahí
 * buscar es leer unos kilobytes en vez de gigas.
 *
 * NO GUARDA EL TEXTO DE LOS MENSAJES
 * ----------------------------------
 * Solo las palabras y los números de mensaje donde salen. Por dos razones:
 *
 *  - Tamaño. Guardar los textos sería duplicar el chat entero, y entonces el
 *    índice ya no sería un atajo.
 *  - Para enseñar el fragmento hace falta abrir ese chat de todas formas, y
 *    abrir UN chat es rápido. La búsqueda global dice en qué chats hay algo y
 *    cuántas veces; el fragmento aparece al entrar.
 *
 * Esto no es una concesión de privacidad: el índice se cifra con la misma DEK
 * que todo lo demás. Pero conviene saber que un índice, por su naturaleza,
 * revela más estructura que un blob opaco si alguien lograse descifrarlo.
 */

/** Versión del formato. Si cambia, los índices viejos se reconstruyen. */
export const VERSION_INDICE = 1;

/**
 * Id de la pieza donde vive el índice.
 *
 * Fijo y legible, al contrario que los ids de pieza normales, que son UUID.
 * Precisamente por eso no puede chocar con ninguno: `newId()` nunca devuelve
 * "idx". Ser fijo es lo que permite pedir el índice sin leer antes el
 * manifiesto, que es lo que hace rápida la búsqueda.
 *
 * Las reglas de Storage ya permiten escribir en `p/{pieceId}` sin mirar la
 * forma del id, así que el índice entra sin tocarlas ni desplegar nada.
 */
export const ID_PIEZA_INDICE = "idx";

/**
 * Tope de apariciones guardadas por palabra.
 *
 * Sin tope, una palabra como "que" en un chat de diez años tendría decenas de
 * miles de posiciones y el índice pesaría más que el chat. Pasado el tope se
 * guarda el recuento real y se marca que la lista está recortada: la búsqueda
 * puede decir "más de 500" en vez de mentir con un número redondo.
 */
export const TOPE_APARICIONES = 500;

/** Longitud mínima de palabra que se indexa. */
const MIN_LARGO = 2;

export type IndiceChat = {
  v: number;
  backupId: string;
  /** Nombre del chat, para poder enseñar resultados sin abrir el manifiesto. */
  nombre: string;
  /** Quiénes hablan en el chat. Es lo que hace que buscar un contacto funcione. */
  contactos: string[];
  /** Cuántos mensajes tiene el chat. */
  mensajes: number;
  /** palabra → números de mensaje donde aparece. */
  palabras: Record<string, number[]>;
  /** Palabras cuya lista se recortó, con su recuento real. */
  recortadas: Record<string, number>;
};

/**
 * Normaliza texto para comparar: minúsculas y sin tildes.
 *
 * Sin quitar tildes, buscar "Yuli" no encontraría "Yulí" y buscar "accion" no
 * encontraría "acción". En un chat en español eso es la mitad de las
 * búsquedas fallando por un acento que nadie escribe en un buscador.
 */
export function normalizar(texto: string): string {
  /* La ñ se aparta ANTES de descomponer, no después.
   *
   * `normalize("NFD")` parte la ñ en n + tilde, y el barrido de diacríticos se
   * la lleva por delante dejando una n. Pero en español la ñ no es una n con
   * acento, es otra letra: con ella convertida en n, buscar "ano" encontraría
   * "año". Reconstruirla después de barrer no se puede, porque la marca que la
   * distinguía ya no está. Por eso se cambia por un carácter de control, que
   * NFD no toca y que no aparece en un texto de chat, y se devuelve al final.
   */
  const MARCA = "\u0001";
  return (texto || "")
    .toLowerCase()
    .replace(/ñ/g, MARCA)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(new RegExp(MARCA, "g"), "ñ");
}

/**
 * Parte un texto en palabras indexables.
 *
 * Se parte por todo lo que no sea letra o número, así que los emojis, la
 * puntuación y los saltos de línea actúan de separador y no acaban dentro de
 * una palabra.
 */
export function tokenizar(texto: string): string[] {
  const limpio = normalizar(texto);
  const crudas = limpio.split(/[^\p{L}\p{N}ñ]+/u);
  const salida: string[] = [];
  for (const p of crudas) {
    if (p.length >= MIN_LARGO) salida.push(p);
  }
  return salida;
}

/**
 * Construye el índice de un chat ya descifrado.
 *
 * `filas` es lo que devuelve el parseo del chat: [fecha, remitente, mensaje].
 * Se indexan el remitente y el mensaje. La fecha no: buscar "2024" y que
 * salgan los nueve mil mensajes de ese año no le sirve a nadie, y engorda el
 * índice sin aportar.
 */
export function construirIndice(args: {
  backupId: string;
  nombre: string;
  filas: string[][];
}): IndiceChat {
  const palabras: Record<string, number[]> = {};
  const recortadas: Record<string, number> = {};
  const contactos = new Set<string>();

  args.filas.forEach((fila, i) => {
    const remitente = (fila?.[1] || "").trim();
    if (remitente) contactos.add(remitente);

    /* El remitente entra al índice además de a la lista de contactos: así
       buscar "Yuli" encuentra también los mensajes que ELLA escribió, no solo
       los que la nombran. */
    const texto = `${remitente} ${fila?.[2] || ""}`;

    /* Un Set por mensaje: si "Yuli" sale tres veces en el mismo mensaje, ese
       mensaje aparece una vez. Sin esto, el recuento de resultados contaría
       repeticiones dentro de un mismo mensaje como si fueran mensajes. */
    for (const palabra of new Set(tokenizar(texto))) {
      const lista = palabras[palabra];
      if (!lista) {
        palabras[palabra] = [i];
        continue;
      }
      if (lista.length < TOPE_APARICIONES) {
        lista.push(i);
      } else {
        recortadas[palabra] = (recortadas[palabra] ?? TOPE_APARICIONES) + 1;
      }
    }
  });

  return {
    v: VERSION_INDICE,
    backupId: args.backupId,
    nombre: args.nombre,
    contactos: [...contactos],
    mensajes: args.filas.length,
    palabras,
    recortadas,
  };
}

export type ResultadoEnChat = {
  backupId: string;
  nombre: string;
  /** Contactos cuyo nombre encaja con lo buscado. */
  contactos: string[];
  /** Números de mensaje que encajan, ordenados. */
  mensajes: number[];
  /** Cuántos encajan de verdad, que puede ser más que `mensajes.length`. */
  total: number;
  /** Si el recuento es un mínimo porque el índice venía recortado. */
  aproximado: boolean;
};

/**
 * Busca una consulta dentro de un índice.
 *
 * COINCIDE POR PREFIJO, NO POR PALABRA EXACTA
 * -------------------------------------------
 * Quien escribe "Yuli" espera encontrar a "Yulisa", y quien escribe "cumple"
 * espera "cumpleaños". Exigir la palabra completa haría que el buscador
 * pareciera roto justo en el caso más común, que es escribir a medias.
 *
 * Con varias palabras se exige que el mensaje las tenga TODAS, que es lo que
 * la gente espera al añadir una palabra para afinar. Si fuera "cualquiera",
 * añadir palabras daría más resultados en vez de menos.
 */
export function buscarEnIndice(
  indice: IndiceChat,
  consulta: string
): ResultadoEnChat | null {
  const terminos = tokenizar(consulta);
  /* Una consulta de una sola letra se ignora: coincidiría con casi todo y la
     respuesta no diría nada. Se devuelve null y no un resultado vacío para
     que quien llama distinga "no busqué" de "busqué y no hay". */
  if (terminos.length === 0) return null;

  const claves = Object.keys(indice.palabras);
  let interseccion: Set<number> | null = null;
  let aproximado = false;

  for (const termino of terminos) {
    const delTermino = new Set<number>();
    for (const clave of claves) {
      if (!clave.startsWith(termino)) continue;
      if (indice.recortadas[clave]) aproximado = true;
      for (const n of indice.palabras[clave]) delTermino.add(n);
    }

    if (interseccion === null) {
      interseccion = delTermino;
    } else {
      for (const n of [...interseccion]) {
        if (!delTermino.has(n)) interseccion.delete(n);
      }
    }
    /* Si un término no aparece, el AND ya no puede dar nada: se corta sin
       recorrer los demás. */
    if (interseccion.size === 0) break;
  }

  const mensajes = [...(interseccion ?? [])].sort((a, b) => a - b);

  const contactos = indice.contactos.filter((c) => {
    const n = normalizar(c);
    return terminos.some((t) => n.split(/[^\p{L}\p{N}ñ]+/u).some((p) => p.startsWith(t)));
  });

  if (mensajes.length === 0 && contactos.length === 0) return null;

  return {
    backupId: indice.backupId,
    nombre: indice.nombre,
    contactos,
    mensajes,
    total: mensajes.length,
    aproximado,
  };
}

/** ¿Este índice sirve, o hay que reconstruirlo? */
export function indiceVigente(indice: unknown): indice is IndiceChat {
  const i = indice as IndiceChat;
  return (
    !!i &&
    typeof i === "object" &&
    i.v === VERSION_INDICE &&
    typeof i.palabras === "object" &&
    Array.isArray(i.contactos)
  );
}
