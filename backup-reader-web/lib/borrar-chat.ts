/**
 * Borrar UN chat del usuario: sus objetos de Storage y su registro de
 * Firestore.
 *
 * Es el hermano pequeño de `lib/admin-borrado.ts`. Aquel borra una cuenta
 * entera desde el servidor con el Admin SDK; este borra un solo chat desde el
 * navegador, con la sesión del propio dueño. Las reglas ya permiten las dos
 * cosas que necesita: `allow read` (que cubre list) y `allow delete` sobre
 * `backups/{uid}/**`.
 *
 * POR QUÉ SE LISTA EN VEZ DE LEER EL MANIFIESTO
 * ---------------------------------------------
 * El manifiesto sabe qué piezas tiene el backup, así que lo natural sería
 * leerlo y borrar lo que diga. No se hace, por tres razones:
 *
 *  - Leerlo exige la bóveda desbloqueada. Borrar no debería: si alguien quiere
 *    deshacerse de un chat, obligarle a escribir la contraseña de cifrado
 *    primero es pedirle que abra lo que quiere tirar.
 *  - Un manifiesto ilegible —subida a medias, formato de una versión futura—
 *    dejaría el chat imposible de borrar. Es justo el que más estorba.
 *  - El manifiesto solo conoce las piezas que él registró. Si una subida se
 *    cortó después de subir piezas y antes de escribir el manifiesto, esas
 *    piezas no aparecen en ningún sitio. Listar el prefijo las encuentra.
 *
 * Listar devuelve la verdad de lo que hay en Storage, que es lo que se quiere
 * dejar vacío.
 *
 * EL ORDEN
 * --------
 * Primero los objetos, el registro de Firestore al final. Si se borrara el
 * registro primero y luego fallara Storage, el chat desaparecería de la lista
 * y sus blobs se quedarían ahí: datos cifrados que el usuario cree borrados,
 * que siguen ocupando su cuota y que ya no puede volver a seleccionar para
 * reintentar. Al revés, un fallo deja el chat en la lista y se puede repetir.
 *
 * Nada de esto lanza por un objeto que ya no está: borrar dos veces el mismo
 * chat tiene que ser inofensivo, porque es exactamente lo que va a pasar
 * cuando alguien pulse el botón, no vea respuesta y vuelva a pulsar.
 */

/** Cuántos objetos se borran a la vez. Suficiente sin que Storage limite. */
const EN_PARALELO = 12;

/** Lo que una página de listado devuelve. */
export type Pagina = {
  rutas: string[];
  /** Token de la siguiente página, o null/undefined si no hay más. */
  siguiente?: string | null;
};

/**
 * Lo mínimo que este módulo necesita del mundo exterior.
 *
 * Entra por parámetro en vez de importar `firebase/storage` directamente para
 * que la lógica —la paginación, la contabilidad, el orden— se pueda probar con
 * dobles, sin bucket ni sesión. Es lo mismo que hace `admin-borrado.ts` y por
 * el mismo motivo.
 */
export type Dependencias = {
  /** Lista una página de objetos bajo el prefijo. */
  listar: (prefijo: string, pageToken?: string) => Promise<Pagina>;
  /** Borra un objeto. Puede fallar si ya no existe; se trata como borrado. */
  borrar: (ruta: string) => Promise<void>;
};

export type ResultadoBorrado = {
  /** Objetos que ya no están en Storage al terminar. */
  borrados: number;
  /** Objetos que se resistieron y siguen ahí. */
  fallidos: number;
  /** Rutas que fallaron, para poder decir cuáles. */
  rutasFallidas: string[];
};

/**
 * ¿Este error significa "ya no estaba"?
 *
 * Un objeto que no existe es el resultado que se buscaba, así que cuenta como
 * borrado y no como fallo. Distinguirlo importa: si contara como fallo, un
 * segundo intento sobre un chat ya borrado reportaría que no se pudo borrar
 * nada, y el usuario pensaría que su chat sigue ahí.
 */
function esNoEncontrado(error: any): boolean {
  const codigo = error?.code || error?.serverResponse?.error?.status || "";
  return (
    codigo === "storage/object-not-found" ||
    error?.status === 404 ||
    error?.code_ === "storage/object-not-found"
  );
}

/**
 * Borra todos los objetos bajo un prefijo, paginando hasta el final.
 *
 * La paginación no es un detalle: `list()` de Storage devuelve como mucho 1000
 * entradas por página, y un backup con muchas fotos pasa de mil piezas. Sin
 * seguir el token se borrarían las primeras mil, el recuento diría que todo
 * fue bien, y el resto quedaría ahí para siempre.
 */
export async function borrarObjetos(
  prefijo: string,
  deps: Dependencias
): Promise<ResultadoBorrado> {
  const salida: ResultadoBorrado = { borrados: 0, fallidos: 0, rutasFallidas: [] };

  /* Se vuelve a listar hasta que una pasada no encuentre nada.
   *
   * Listar y borrar a la vez es delicado: se está modificando aquello que se
   * recorre. Storage pagina con un cursor por nombre, así que borrar lo ya
   * visitado no desplaza el cursor y una sola pasada bastaría. Pero eso es una
   * garantía de la implementación del servidor, no del contrato, y si fuera
   * por posición cada borrado correría la ventana y se saltarían objetos sin
   * que nada lo delate: el recuento diría que todo fue bien.
   *
   * Repetir hasta vaciar no depende de esa garantía. Y de paso cubre el caso
   * de que llegue un objeto nuevo a mitad del borrado.
   */
  const MAX_PASADAS = 10;
  for (let pasada = 0; pasada < MAX_PASADAS; pasada++) {
    const antes = salida.borrados + salida.fallidos;
    await unaPasada(prefijo, deps, salida);
    const encontrados = salida.borrados + salida.fallidos - antes;
    /* Nada que borrar, o solo lo que ya falló antes y va a volver a fallar. */
    if (encontrados === 0 || encontrados === salida.fallidos) break;
  }

  return salida;
}

/** Una vuelta completa al prefijo, siguiendo la paginación hasta el final. */
async function unaPasada(
  prefijo: string,
  deps: Dependencias,
  salida: ResultadoBorrado
): Promise<void> {
  let pageToken: string | undefined = undefined;

  do {
    const pagina: Pagina = await deps.listar(prefijo, pageToken);

    for (let i = 0; i < pagina.rutas.length; i += EN_PARALELO) {
      const lote = pagina.rutas.slice(i, i + EN_PARALELO);
      const resultados = await Promise.all(
        lote.map(async (ruta) => {
          try {
            await deps.borrar(ruta);
            return { ruta, ok: true };
          } catch (error) {
            if (esNoEncontrado(error)) return { ruta, ok: true };
            console.warn("No se pudo borrar", ruta, error);
            return { ruta, ok: false };
          }
        })
      );
      for (const r of resultados) {
        if (r.ok) salida.borrados++;
        else if (!salida.rutasFallidas.includes(r.ruta)) {
          /* Sin el `includes`, una ruta que falla en cada pasada se contaría
             diez veces y el aviso hablaría de diez archivos pendientes cuando
             es uno solo. */
          salida.fallidos++;
          salida.rutasFallidas.push(r.ruta);
        }
      }
    }

    pageToken = pagina.siguiente ?? undefined;
  } while (pageToken);
}

/**
 * Qué salió mal, como clave y no como frase.
 *
 * El servidor —o en este caso la librería— no arma el texto. Devuelve qué
 * pasó y la pantalla lo traduce, porque en inglés el orden de la frase cambia
 * y pegar trozos traducidos no funciona. Es la misma lección que dejó el
 * descuento: un texto en español montado fuera de la pantalla acaba saliendo
 * en medio de una página en inglés.
 */
export type ClaveAviso =
  | "sin-sesion"
  | "chat-no-reconocido"
  | "ya-hay-borrado"
  | "quedaron-archivos"
  | "registro-no-borrado"
  | "fallo-general";

export type ResultadoChat = ResultadoBorrado & {
  /** Si el registro de Firestore se llegó a borrar. */
  registroBorrado: boolean;
  /** Qué contar al usuario. Null si todo fue bien. */
  aviso: ClaveAviso | null;
};

/**
 * Borra un chat entero: objetos primero, registro después.
 *
 * `borrarRegistro` se pasa por parámetro y es opcional en la práctica: los
 * backups v1 en texto plano no tienen registro en Firestore, solo carpeta en
 * Storage, así que para esos se llama sin él.
 */
export async function borrarChat(
  prefijo: string,
  deps: Dependencias & { borrarRegistro?: () => Promise<void> }
): Promise<ResultadoChat> {
  const objetos = await borrarObjetos(prefijo, deps);

  /* Con objetos sin borrar NO se toca el registro. Quitarlo sacaría el chat de
     la lista dejando sus blobs dentro, y entonces ya no habría forma de
     reintentar desde la interfaz. */
  if (objetos.fallidos > 0) {
    return { ...objetos, registroBorrado: false, aviso: "quedaron-archivos" };
  }

  if (!deps.borrarRegistro) {
    return { ...objetos, registroBorrado: false, aviso: null };
  }

  try {
    await deps.borrarRegistro();
    return { ...objetos, registroBorrado: true, aviso: null };
  } catch (error) {
    /* Los archivos ya no están, así que el chat está vacío, pero su registro
       sigue y va a aparecer en la lista como un backup que no se puede abrir.
       Se dice, en vez de dar el borrado por bueno. */
    console.error("Se borraron los archivos pero no el registro:", error);
    return { ...objetos, registroBorrado: false, aviso: "registro-no-borrado" };
  }
}
