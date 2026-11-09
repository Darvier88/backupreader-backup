/**
 * La pasada que indexa los chats que todavía no tienen índice.
 *
 * POR QUÉ HACE FALTA UNA PASADA Y NO BASTA CON INDEXAR AL ABRIR
 * ------------------------------------------------------------
 * Lo barato sería construir el índice de cada chat la primera vez que se abre,
 * aprovechando que entonces ya está descifrado en memoria. Pero entonces un
 * chat que nunca se abrió no tendría índice, y buscar en él no daría nada.
 *
 * Y el problema no es que falte: es que la búsqueda saldría VACÍA SIN DECIR
 * QUE ESTÁ INCOMPLETA. Quien busca "Yuli" y no ve nada concluye que no hay
 * nada, no que falta por mirar. Una búsqueda lenta se nota y se espera; una
 * búsqueda que miente no se nota nunca.
 *
 * De ahí las dos cosas que hace este módulo: recorrer todo una vez, y llevar
 * la cuenta de lo que falta para que la pantalla pueda decirlo.
 *
 * LA REANUDACIÓN NO NECESITA GUARDAR NINGÚN PROGRESO
 * --------------------------------------------------
 * No hay un registro de "iba por el chat 7". Lo pendiente se deduce: son los
 * backups cuyo documento de Firestore no dice que ya estén indexados. Eso es
 * mejor que un contador por tres motivos:
 *
 *  - Sobrevive a cerrar la pestaña, a quedarse sin batería y a cambiar de
 *    dispositivo, sin escribir nada extra.
 *  - No se puede desincronizar. Un contador puede decir que terminó cuando no,
 *    y entonces nadie vuelve a mirar.
 *  - Un chat nuevo entra solo en la lista de pendientes.
 *
 * Esto es un trabajo de fondo que compite con lo que el usuario está haciendo
 * —descifrar es caro en CPU—, así que va de uno en uno y con una pausa entre
 * chats, no en paralelo.
 */

export type EstadoIndexado = {
  /** Cuántos chats hay en total. */
  total: number;
  /** Cuántos ya tienen índice utilizable. */
  hechos: number;
  /** Cuántos no se pudieron indexar y no se van a reintentar en esta pasada. */
  fallidos: number;
  /** El chat que se está indexando ahora, o null entre uno y otro. */
  enCurso: string | null;
  /** Si la pasada sigue viva. */
  corriendo: boolean;
};

export const estadoInicial: EstadoIndexado = {
  total: 0,
  hechos: 0,
  fallidos: 0,
  enCurso: null,
  corriendo: false,
};

export type OpcionesPasada = {
  /** Los backupId que todavía no tienen índice. */
  pendientes: string[];
  /** Cuántos chats hay en total, indexados o no. */
  total: number;
  /** Construye y guarda el índice de un chat. Debe lanzar si no pudo. */
  indexarUno: (backupId: string) => Promise<void>;
  /** Se llama en cada cambio de estado, para pintar el progreso. */
  onProgreso: (estado: EstadoIndexado) => void;
  /** Devuelve true para abandonar la pasada (bóveda bloqueada, sesión cerrada). */
  debeParar?: () => boolean;
  /** Pausa entre chats, en ms. Deja respirar al hilo principal. */
  pausaMs?: number;
  /** Para los tests: evita esperar de verdad. */
  esperar?: (ms: number) => Promise<void>;
};

const PAUSA_POR_DEFECTO = 150;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Indexa los pendientes, de uno en uno, informando del progreso.
 *
 * Un chat que falla NO detiene la pasada. Un backup ilegible —subida a medias,
 * formato de una versión futura— no puede bloquear el indexado de los otros
 * cuarenta: si lo hiciera, un solo chat roto dejaría la búsqueda inservible
 * para toda la cuenta. Se cuenta como fallido y se sigue.
 *
 * Devuelve el estado final para que quien llama sepa si quedó algo pendiente,
 * y así pueda decidir si reintentar más tarde.
 */
export async function indexarPendientes(
  opciones: OpcionesPasada
): Promise<EstadoIndexado> {
  const esperar = opciones.esperar ?? dormir;
  const pausa = opciones.pausaMs ?? PAUSA_POR_DEFECTO;

  const estado: EstadoIndexado = {
    total: opciones.total,
    hechos: Math.max(0, opciones.total - opciones.pendientes.length),
    fallidos: 0,
    enCurso: null,
    corriendo: true,
  };
  opciones.onProgreso({ ...estado });

  for (const backupId of opciones.pendientes) {
    if (opciones.debeParar?.()) break;

    estado.enCurso = backupId;
    opciones.onProgreso({ ...estado });

    try {
      await opciones.indexarUno(backupId);
      estado.hechos++;
    } catch (error) {
      /* Va como error y no como aviso: un chat sin índice es un chat en el que
         la búsqueda no va a encontrar nada, y eso tiene que ser visible en la
         consola en vez de desaparecer entre los warnings normales. */
      console.error(`No se pudo indexar el backup ${backupId}:`, error);
      estado.fallidos++;
    }

    estado.enCurso = null;
    opciones.onProgreso({ ...estado });

    if (pausa > 0) await esperar(pausa);
  }

  estado.corriendo = false;
  estado.enCurso = null;
  opciones.onProgreso({ ...estado });
  return { ...estado };
}

/**
 * Qué decirle al usuario sobre el estado de la búsqueda.
 *
 * Devuelve una clave y sus datos, no una frase: en inglés el orden cambia y
 * pegar trozos traducidos no funciona.
 */
export type AvisoBusqueda =
  | { clave: "completa" }
  | { clave: "indexando"; faltan: number; total: number }
  | { clave: "faltan-chats"; faltan: number };

export function avisoDeBusqueda(estado: EstadoIndexado): AvisoBusqueda {
  const faltan = Math.max(0, estado.total - estado.hechos);
  if (faltan === 0) return { clave: "completa" };
  if (estado.corriendo) {
    return { clave: "indexando", faltan, total: estado.total };
  }
  /* Ya no está corriendo y aun así falta: son los que fallaron. Se dice igual,
     porque el usuario necesita saber que su búsqueda no cubre todo. */
  return { clave: "faltan-chats", faltan };
}
