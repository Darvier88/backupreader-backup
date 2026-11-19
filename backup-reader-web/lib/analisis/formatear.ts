/**
 * Cifras del análisis en palabras.
 *
 * «1.847.392 ms» no es una respuesta a «cuánto tardas en contestar». Lo que
 * se enseña es «unos 20 min», con la precisión que la cifra aguanta: dar
 * «20 min 32 s» sugiere que el dato tiene una exactitud que no tiene, porque
 * es la mediana de cientos de conversaciones.
 */

/** Unidad de una duración, ya redondeada, para traducir con `t()`. */
export type Duracion =
  | { unidad: "segundos"; valor: number }
  | { unidad: "minutos"; valor: number }
  | { unidad: "horas"; valor: number }
  | { unidad: "dias"; valor: number };

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Pasa milisegundos a la unidad en la que la cifra se lee bien. */
export function duracion(ms: number): Duracion {
  const n = Math.max(0, ms);
  if (n < MINUTO) return { unidad: "segundos", valor: Math.max(1, Math.round(n / 1000)) };
  if (n < HORA) return { unidad: "minutos", valor: Math.round(n / MINUTO) };
  if (n < DIA) return { unidad: "horas", valor: Math.round((n / HORA) * 10) / 10 };
  return { unidad: "dias", valor: Math.round((n / DIA) * 10) / 10 };
}

/** Un número con los separadores del idioma. */
export function numero(n: number, idioma = "es"): string {
  try {
    return new Intl.NumberFormat(idioma).format(n);
  } catch {
    return String(n);
  }
}

/** Una fecha corta («13 ene 2026»), para el rango de arriba. */
export function fechaCorta(fecha: Date, idioma = "es"): string {
  try {
    return new Intl.DateTimeFormat(idioma, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(fecha);
  } catch {
    return fecha.toISOString().slice(0, 10);
  }
}

/**
 * Un número con su nombre, en singular o plural.
 *
 * Las claves de i18n de esta aplicación son la frase en español, así que el
 * plural automático de i18next no funciona (sin recursos para «es», `t`
 * devuelve la propia clave). Esto lo resuelve a mano, que para dos formas no
 * hace falta más: sin ello sale «1 palabras por turno».
 *
 * `traducir` es la `t` de i18next, que se pasa para no acoplar este módulo
 * a la instancia.
 */
export function conNombre(
  n: number,
  singular: string,
  plural: string,
  traducir: (clave: string, opciones?: any) => unknown,
  idioma = "es"
): string {
  const clave = Math.abs(n) === 1 ? singular : plural;
  return String(traducir(clave, { n: numero(n, idioma) }) ?? "");
}
