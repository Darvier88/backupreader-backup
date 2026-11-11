/**
 * «Recordar en este dispositivo por 30 días» (pantalla 8a).
 *
 * QUÉ SE GUARDA Y QUÉ NO
 * ----------------------
 * Nunca la contraseña de cifrado, y nunca la DEK en claro. Se guarda la DEK
 * CIFRADA con una llave AES-GCM que genera el navegador con
 * `extractable: false`: el navegador la puede usar, pero no la entrega a nadie,
 * ni siquiera a esta página. IndexedDB guarda el objeto CryptoKey tal cual (es
 * clonable), así que la llave no sale nunca del almacén del navegador.
 *
 * Consecuencias:
 *  - Copiar la carpeta del perfil a otra máquina no sirve: la llave queda
 *    atada a este navegador.
 *  - Quien tenga ESTE navegador con la sesión abierta durante esos 30 días
 *    puede leer los chats sin escribir la clave. Ese es el precio de la
 *    casilla, y por eso va desmarcada, solo en escritorio y con el aviso de
 *    no usarla en un computador compartido.
 *  - Un script que se colara en la página mientras la bóveda está abierta ya
 *    podría leer la DEK en memoria; esto no lo empeora.
 *
 * Se borra al cerrar sesión, al vencer, desde «Olvidar este dispositivo» en
 * Mi cuenta, y si el registro de la bóveda deja de existir.
 *
 * Todo lo que falla aquí (navegación privada, IndexedDB bloqueado, WebCrypto
 * ausente) se trata como «no hay nada recordado»: lo peor que pasa es que se
 * pide la clave, que es lo que pasaba antes.
 */

const BD = "br-recordar";
const ALMACEN = "claves";
const VERSION_BD = 1;
export const DIAS_RECORDAR = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

type Entrada = {
  uid: string;
  llave: CryptoKey;
  iv: Uint8Array;
  cifrada: ArrayBuffer;
  vence: number;
};

const disponible = (): boolean =>
  typeof window !== "undefined" &&
  typeof indexedDB !== "undefined" &&
  !!window.crypto?.subtle;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pet = indexedDB.open(BD, VERSION_BD);
    pet.onupgradeneeded = () => {
      const bd = pet.result;
      if (!bd.objectStoreNames.contains(ALMACEN)) {
        bd.createObjectStore(ALMACEN, { keyPath: "uid" });
      }
    };
    pet.onsuccess = () => resolve(pet.result);
    pet.onerror = () => reject(pet.error);
  });
}

function operar<T>(
  modo: IDBTransactionMode,
  fn: (almacen: IDBObjectStore) => IDBRequest
): Promise<T> {
  return abrir().then(
    (bd) =>
      new Promise<T>((resolve, reject) => {
        const tx = bd.transaction(ALMACEN, modo);
        const pet = fn(tx.objectStore(ALMACEN));
        pet.onsuccess = () => resolve(pet.result as T);
        pet.onerror = () => reject(pet.error);
        tx.oncomplete = () => bd.close();
        tx.onabort = () => bd.close();
      })
  );
}

/** Guarda la DEK de `uid` durante 30 días. Devuelve si se pudo. */
export async function recordarClave(uid: string, dek: Uint8Array): Promise<boolean> {
  if (!disponible() || !uid) return false;
  try {
    const llave = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // no extraíble: es lo que hace que esto valga la pena
      ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifrada = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, llave, dek);
    const entrada: Entrada = {
      uid,
      llave,
      iv,
      cifrada,
      vence: Date.now() + DIAS_RECORDAR * MS_DIA,
    };
    await operar<IDBValidKey>("readwrite", (a) => a.put(entrada));
    return true;
  } catch (err) {
    console.warn("No se pudo recordar la clave en este dispositivo", err);
    return false;
  }
}

/** La DEK recordada para `uid`, o null si no hay, venció o no se puede abrir. */
export async function claveRecordada(uid: string): Promise<Uint8Array | null> {
  if (!disponible() || !uid) return null;
  try {
    const entrada = await operar<Entrada | undefined>("readonly", (a) => a.get(uid));
    if (!entrada) return null;
    if (Date.now() > entrada.vence) {
      await olvidarClave(uid);
      return null;
    }
    const claro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: entrada.iv },
      entrada.llave,
      entrada.cifrada
    );
    return new Uint8Array(claro);
  } catch (err) {
    /* Entrada corrupta o llave inservible: se borra para no volver a
       intentarlo en cada carga. */
    console.warn("No se pudo usar la clave recordada", err);
    await olvidarClave(uid);
    return null;
  }
}

/** ¿Hay una clave recordada (vigente) para `uid`? Sin descifrarla. */
export async function hayClaveRecordada(uid: string): Promise<boolean> {
  if (!disponible() || !uid) return false;
  try {
    const entrada = await operar<Entrada | undefined>("readonly", (a) => a.get(uid));
    return !!entrada && Date.now() <= entrada.vence;
  } catch {
    return false;
  }
}

export async function olvidarClave(uid: string): Promise<void> {
  if (!disponible() || !uid) return;
  try {
    await operar<undefined>("readwrite", (a) => a.delete(uid));
  } catch {
    /* Nada que hacer: si no se puede abrir el almacén, tampoco se puede leer. */
  }
}

/** Borra todo lo recordado en este navegador. Se usa al cerrar sesión. */
export async function olvidarTodo(): Promise<void> {
  if (!disponible()) return;
  try {
    await operar<undefined>("readwrite", (a) => a.clear());
  } catch {
    /* Igual que arriba. */
  }
}
