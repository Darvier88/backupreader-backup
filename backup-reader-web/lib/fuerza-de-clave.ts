/**
 * Cómo de buena es una clave de cifrado (pantalla 5a).
 *
 * POR QUÉ UN MEDIDOR Y NO SOLO UN MÍNIMO
 * --------------------------------------
 * La comprobación de antes era «al menos 10 caracteres», y el usuario solo se
 * enteraba al pulsar el botón. Eso enseña a cumplir el mínimo y nada más:
 * «1234567890» pasa.
 *
 * El medidor responde mientras se escribe, así que se ve en el momento que
 * añadir una palabra más mejora la clave. No bloquea: una clave corta sigue
 * sin poder guardarse, pero una larga y simple se guarda avisando. La
 * diferencia importa porque esta clave no se puede recuperar, y la alternativa
 * a una clave simple que el usuario recuerda suele ser una compleja que
 * apunta en un papel o que olvida.
 *
 * NO MIDE ENTROPÍA DE VERDAD
 * --------------------------
 * Una medida honesta de la fuerza necesita un diccionario de contraseñas
 * filtradas y un modelo de patrones; eso son cientos de kilobytes que habría
 * que descargar en una pantalla que se ve una vez. Esto cuenta longitud y
 * variedad, que es lo que el usuario puede cambiar, y por eso las etiquetas
 * hablan de la clave («corta», «simple») y no prometen un tiempo de descifrado
 * que no sabemos calcular.
 */

/** Por debajo de esto no se deja guardar. */
export const MIN_LARGO = 10;

export type Nivel = "corta" | "simple" | "buena" | "excelente";

export type Fuerza = {
  nivel: Nivel;
  /** De 0 a 4, para pintar la barra. */
  puntos: number;
  /** Si se puede guardar. */
  valida: boolean;
};

/** Cuántas clases distintas de carácter hay: minúscula, mayúscula, cifra, otro. */
function variedad(clave: string): number {
  let n = 0;
  if (/\p{Ll}/u.test(clave)) n++;
  if (/\p{Lu}/u.test(clave)) n++;
  if (/\p{N}/u.test(clave)) n++;
  if (/[^\p{L}\p{N}]/u.test(clave)) n++;
  return n;
}

/** Una sola letra o cifra repetida, o una secuencia obvia. */
function esDemasiadoSimple(clave: string): boolean {
  if (/^(.)\1+$/u.test(clave)) return true;
  const bajo = clave.toLowerCase();
  const seguidas = "0123456789abcdefghijklmnopqrstuvwxyz";
  if (bajo.length >= 6 && seguidas.includes(bajo)) return true;
  /* Un teclado entero seguido es tan común como "123456". */
  if ("qwertyuiopasdfghjklzxcvbnm".includes(bajo) && bajo.length >= 6) return true;
  return false;
}

export function medirFuerza(clave: string): Fuerza {
  const texto = clave ?? "";

  if (texto.length < MIN_LARGO) {
    return { nivel: "corta", puntos: texto.length === 0 ? 0 : 1, valida: false };
  }

  if (esDemasiadoSimple(texto)) {
    /* Larga pero toda igual o en orden. Se avisa, pero se deja guardar: el
       usuario es dueño de sus chats, y bloquearle aquí solo consigue que
       escriba otra cosa que tampoco recuerda. */
    return { nivel: "simple", puntos: 1, valida: true };
  }

  const clases = variedad(texto);

  /* La longitud pesa más que la variedad, que es como funciona de verdad:
     una frase larga en minúsculas aguanta más que ocho caracteres con
     símbolos, y además se recuerda. */
  if (texto.length >= 20 || (texto.length >= 16 && clases >= 3)) {
    return { nivel: "excelente", puntos: 4, valida: true };
  }

  if (texto.length >= 14 || clases >= 3) {
    return { nivel: "buena", puntos: 3, valida: true };
  }

  return { nivel: "simple", puntos: 2, valida: true };
}

/** ¿Coinciden las dos escrituras de la clave? (pantalla 5b) */
export function coinciden(primera: string, segunda: string): boolean {
  return segunda.length > 0 && primera === segunda;
}
