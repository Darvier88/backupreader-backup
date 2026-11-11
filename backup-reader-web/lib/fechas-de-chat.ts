/**
 * Fechas de los mensajes de un chat.
 *
 * El parseo guarda en cada mensaje una cadena como "9/8/26 08:10" o
 * "2026-09-08 08:10", y hasta ahora se pintaba entera debajo de cada burbuja.
 * En una conversación de mil mensajes eso repite la misma fecha mil veces: lo
 * que cambia de un mensaje al siguiente es la hora, no el día. El día importa
 * una vez, cuando cambia, y por eso va en un separador y no en la burbuja.
 *
 * EL ORDEN DE DÍA Y MES NO SIEMPRE SE SABE
 * ----------------------------------------
 * WhatsApp exporta "9/8/26" sin decir si es el 9 de agosto o el 8 de
 * septiembre: depende del idioma del teléfono que exportó. Aquí se resuelve
 * así, en este orden:
 *
 *   1. Si algún número pasa de 12, ese es el día y no hay duda.
 *   2. Si no, se usa el orden del idioma de quien lee (español día primero,
 *      inglés de EE. UU. mes primero).
 *
 * El paso 2 puede equivocarse, así que solo decide la ETIQUETA que se enseña.
 * La agrupación en días NO depende de él: se agrupa por la cadena de fecha tal
 * cual venía, de modo que dos mensajes del mismo día caen siempre juntos aunque
 * el día y el mes estén intercambiados. Un separador con el nombre del día
 * equivocado es un fallo de lectura; mezclar mensajes de días distintos sería
 * un fallo de contenido, y ese no se permite.
 */

export type FechaHora = {
  /** La parte de fecha tal cual venía ("9/8/26", "2026-09-08"), o "". */
  fecha: string;
  /** La parte de hora tal cual venía ("08:10", "8:10 PM"), o "". */
  hora: string;
};

/** Separa lo que el parseo dejó junto. */
export function partirFechaHora(texto: string | null | undefined): FechaHora {
  const valor = (texto || "").trim();
  if (!valor) return { fecha: "", hora: "" };

  const hora = valor.match(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?\s?[Mm]\.?)?/);
  const fecha = valor.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);

  return {
    fecha: fecha ? fecha[0] : "",
    hora: hora ? hora[0].trim() : "",
  };
}

/**
 * La clave con la que se agrupan los mensajes de un mismo día.
 *
 * Es la fecha en crudo, sin interpretar. Ver la nota de arriba: interpretarla
 * podría juntar o separar días mal, y aquí eso no se puede permitir.
 */
export function claveDeDia(texto: string | null | undefined): string {
  return partirFechaHora(texto).fecha;
}

/** Convierte la fecha en un `Date`, o `null` si no se entiende. */
export function aFecha(fecha: string, diaPrimero: boolean): Date | null {
  if (!fecha) return null;

  const iso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  const partes = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!partes) return null;

  const a = Number(partes[1]);
  const b = Number(partes[2]);
  let anio = Number(partes[3]);
  /* "26" es 2026 y no 1926: estos son chats exportados, no documentos
     históricos, y WhatsApp no existía en 1926. */
  if (anio < 100) anio += 2000;

  let dia: number;
  let mes: number;
  if (a > 12) {
    dia = a;
    mes = b;
  } else if (b > 12) {
    dia = b;
    mes = a;
  } else {
    dia = diaPrimero ? a : b;
    mes = diaPrimero ? b : a;
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(anio, mes - 1, dia);
  return isNaN(d.getTime()) ? null : d;
}

/** ¿El idioma de quien lee escribe el día antes que el mes? */
export function idiomaConDiaPrimero(idioma: string | null | undefined): boolean {
  /* El inglés de Estados Unidos es la excepción conocida; el resto de los
     idiomas que puede tener la aplicación escriben el día primero. */
  return !/^en(-US)?$/i.test((idioma || "").trim());
}

/** ¿Son el mismo día del calendario? */
function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * El texto del separador de día.
 *
 * `hoy` y `ayer` llegan traducidos desde fuera, porque esta función no sabe de
 * i18n y las traducciones no deben vivir en una librería pura.
 */
export function etiquetaDeDia(
  fecha: string,
  opciones: {
    idioma?: string;
    hoy: string;
    ayer: string;
    ahora?: Date;
    /** «28 AGO 2026»: el formato corto del separador del chat (1a). */
    corta?: boolean;
  }
): string {
  const diaPrimero = idiomaConDiaPrimero(opciones.idioma);
  const d = aFecha(fecha, diaPrimero);
  /* Si no se entiende, se enseña tal cual vino. Un separador con la fecha en
     crudo sigue separando; uno vacío deja al lector sin saber dónde empieza
     cada día. */
  if (!d) return fecha;

  const ahora = opciones.ahora ?? new Date();
  if (mismoDia(d, ahora)) return opciones.hoy;

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(d, ayer)) return opciones.ayer;

  try {
    if (opciones.corta) {
      const dia = d.getDate();
      const mes = d
        .toLocaleDateString(opciones.idioma || undefined, { month: "short" })
        .replace(/\./g, "")
        .slice(0, 3);
      return `${dia} ${mes} ${d.getFullYear()}`.toUpperCase();
    }
    return d.toLocaleDateString(opciones.idioma || undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: d.getFullYear() === ahora.getFullYear() ? undefined : "numeric",
    });
  } catch {
    return fecha;
  }
}
