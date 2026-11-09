/**
 * Los pasos de borrado de Storage y Firestore.
 *
 * Están aquí y no dentro del endpoint para que se puedan probar. Un endpoint
 * de Next solo se ejecuta con un servidor levantado; esto se llama desde un
 * test con un doble en lugar del bucket y se comprueba la contabilidad —
 * cuántos borró, cuántos fallaron, cuántos quedan— que es donde un error se
 * traduce en "la cuenta se borró" con archivos dentro.
 *
 * Las dependencias entran por parámetro, con el valor real por defecto, así
 * que el endpoint las llama sin pasar nada.
 */

/**
 * Las dependencias reales se cargan con `import()` dentro de la función, no
 * arriba. Si `admin-servidor` se importara en la cabecera, cargar este módulo
 * arrastraría el Admin SDK entero —y con él `jsonwebtoken`, `grpc` y medio
 * Google Cloud— aunque el llamador vaya a pasar un doble. El test de esta
 * lógica no necesita nada de eso.
 */
async function bucketPorDefecto(): Promise<BucketComoSea> {
  const { bucketAdmin } = await import("./admin-servidor");
  return bucketAdmin() as unknown as BucketComoSea;
}

async function dbPorDefecto(): Promise<any> {
  const { dbAdmin } = await import("./admin-servidor");
  return dbAdmin();
}

/**
 * Cuántos objetos de Storage se borran como máximo en una llamada.
 *
 * No es el límite de lo que se puede borrar, sino de lo que cabe en una
 * función de Vercel antes de que la corte por tiempo. Pasado el tope se
 * responde `quedan` y se sigue en la siguiente llamada.
 */
export const TOPE_ARCHIVOS = 1500;

/** Borrados en paralelo. Suficiente para ir rápido sin que Storage limite. */
const EN_PARALELO = 12;

export type PasoStorage = {
  borrados: number;
  fallidos: number;
  quedan: number;
};

/** Lo mínimo que este módulo necesita de un bucket. */
export type BucketComoSea = {
  getFiles(opciones: { prefix: string }): Promise<[Array<{ delete(o?: any): Promise<any> }>, ...unknown[]]>;
};

/**
 * Borra `backups/{uid}/**`, hasta el tope.
 *
 * Un fallo al borrar un objeto cuenta como pendiente, no solo como fallo. Si
 * no, un objeto que se resistió dejaría `quedan` en cero, el endpoint daría
 * el paso por terminado y borraría la cuenta con basura dentro del bucket:
 * datos cifrados de alguien que ya no existe, que nadie volvería a mirar
 * porque la cuenta ya no sale en ninguna lista.
 */
export async function borrarStorage(
  uid: string,
  bucketDado?: BucketComoSea
): Promise<PasoStorage> {
  const bucket = bucketDado ?? (await bucketPorDefecto());
  const prefijo = `backups/${uid}/`;
  const [archivos] = await bucket.getFiles({ prefix: prefijo });

  const aBorrar = archivos.slice(0, TOPE_ARCHIVOS);
  const paso: PasoStorage = {
    borrados: 0,
    fallidos: 0,
    quedan: archivos.length - aBorrar.length,
  };

  for (let i = 0; i < aBorrar.length; i += EN_PARALELO) {
    const lote = aBorrar.slice(i, i + EN_PARALELO);
    const hechos = await Promise.allSettled(
      lote.map((f) => f.delete({ ignoreNotFound: true }))
    );
    for (const h of hechos) {
      if (h.status === "fulfilled") paso.borrados++;
      else {
        paso.fallidos++;
        console.error("Storage: no se pudo borrar un objeto de", uid, h.reason);
      }
    }
  }

  paso.quedan += paso.fallidos;
  return paso;
}

export type PasoFirestore = {
  backups: number;
  boveda: boolean;
  estado: boolean;
  perfil: boolean;
};

/** Tamaño de lote de Firestore; el límite de la API es 500 escrituras. */
const POR_LOTE = 400;

/**
 * Borra los documentos de Firestore de este usuario.
 *
 * La subcolección va PRIMERO. En Firestore, borrar un documento no borra lo
 * que tiene debajo: si se borrara `vaults/{uid}` antes que
 * `vaults/{uid}/backups/*`, los metadatos de los chats seguirían ahí, vivos
 * bajo un padre que ya no existe, y seguirían saliendo en la consulta
 * `collectionGroup("backups")` que alimenta el listado del panel. El usuario
 * desaparecería de la tabla y sus chats seguirían contados.
 */
export async function borrarFirestore(
  uid: string,
  dbDada?: any
): Promise<PasoFirestore> {
  const db = dbDada ?? (await dbPorDefecto());
  const paso: PasoFirestore = {
    backups: 0,
    boveda: false,
    estado: false,
    perfil: false,
  };

  const backups = await db.collection("vaults").doc(uid).collection("backups").get();
  const docs = backups.docs ?? [];
  for (let i = 0; i < docs.length; i += POR_LOTE) {
    const trozo = docs.slice(i, i + POR_LOTE);
    const lote = db.batch();
    for (const d of trozo) lote.delete(d.ref);
    await lote.commit();
    paso.backups += trozo.length;
  }

  await db.collection("vaults").doc(uid).delete();
  paso.boveda = true;

  await db.collection("userStatus").doc(uid).delete();
  paso.estado = true;

  await db.collection("users").doc(uid).delete();
  paso.perfil = true;

  return paso;
}

/* `confirmacionValida` vive en `admin-permisos` junto con `esSuperAdmin`: son
   las dos comprobaciones que deciden si un borrado procede, y conviene que se
   lean juntas. */
export { confirmacionValida } from "./admin-permisos";
