import { describe, it, expect } from "vitest";
import { BlobWriter, ZipWriter } from "@zip.js/zip.js";

import {
  createVault,
  uploadBackup,
  abrirBackup,
  indexByName,
  piecePath,
  manifestPath,
  newId,
} from "../../lib/backupreader-crypto";
import type { BackupAbierto } from "../../lib/backupreader-crypto";

/**
 * El chat recién subido tiene que salir en la lista.
 *
 * EL FALLO QUE CUBRE
 * ------------------
 * Al terminar una subida, StorageContext refresca la barra lateral con
 * `getFiles`, y `listarCifrados` volvía a DESCARGAR y descifrar el manifiesto
 * que se acababa de subir segundos antes. Si esa descarga fallaba una sola
 * vez, el `catch` omitía el backup y el chat no aparecía: la subida había ido
 * bien, el chat estaba en Storage y en Firestore, pero la pantalla no lo
 * mostraba. Al volver a entrar más tarde la descarga iba bien y aparecía.
 *
 * Se notaba sobre todo en cuentas recién creadas, porque es el primer chat.
 *
 * Aquí se reproduce con una descarga que falla la primera vez, y se comprueba
 * que sembrando la caché con el manifiesto que YA está en memoria el backup
 * aparece igual.
 *
 * No necesita emulador ni red: almacén en memoria y el crypto de verdad.
 */

const UID = "uid-ana";

const CHAT = `[12/01/2024, 10:15:03] María: Hola
[12/01/2024, 10:15:30] Yo: ¿Viste la foto?
`;

async function zipDePrueba() {
  const salida = new BlobWriter("application/zip");
  const writer = new ZipWriter(salida);
  await writer.add("WhatsApp Chat - María/_chat.txt", {
    readable: new Blob([CHAT]).stream(),
  });
  await writer.close();
  return salida.getData();
}

/** Sube a un Map en memoria usando las rutas reales de Storage. */
async function subirABackup(dek: Uint8Array) {
  const backupId = newId();
  const objetos = new Map<string, Blob>();
  const { manifest } = await uploadBackup(await zipDePrueba(), dek, "María.zip", {
    backupId,
    sinWorker: true,
    subirPieza: async (id, blob) => {
      objetos.set(piecePath(UID, backupId, id), blob);
    },
    subirManifiesto: async (blob) => {
      objetos.set(manifestPath(UID, backupId), blob);
    },
  });
  return { backupId, manifest, objetos };
}

/**
 * `listarCifrados` tal cual está en StorageContext: mira la caché, si no está
 * descarga, y si la descarga falla omite el backup de la lista.
 */
async function listar(
  backupId: string,
  dek: Uint8Array,
  cache: Map<string, BackupAbierto>,
  descargar: (ruta: string) => Promise<Blob>
): Promise<string[]> {
  const nombres: string[] = [];
  try {
    const cacheado = cache.get(backupId);
    const abierto = cacheado ?? (await abrirBackup(UID, backupId, dek, descargar));
    if (abierto) nombres.push(abierto.manifest.name);
  } catch {
    /* Omitido: es justo lo que hacía desaparecer el chat. */
  }
  return nombres;
}

describe("la lista después de subir", () => {
  it("SIN sembrar la caché, una descarga que falla hace desaparecer el chat", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { backupId, objetos } = await subirABackup(dek);

    /* La primera descarga falla, como pasaría con un corte momentáneo justo
       después de subir. */
    let intentos = 0;
    const descargarQueFalla = async (ruta: string) => {
      intentos++;
      if (intentos === 1) throw new Error("fallo de red");
      return objetos.get(ruta)!;
    };

    const nombres = await listar(backupId, dek, new Map(), descargarQueFalla);

    expect(nombres).toEqual([]); // el chat no se ve: el fallo reproducido
  });

  it("SEMBRANDO la caché con el manifiesto en memoria, el chat aparece", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { backupId, manifest, objetos } = await subirABackup(dek);

    /* El arreglo: tras subir se guarda en la caché el manifiesto que
       `uploadBackup` ya devolvió, sin volver a bajar nada. */
    const cache = new Map<string, BackupAbierto>();
    cache.set(backupId, { backupId, manifest, porNombre: indexByName(manifest) });

    let intentos = 0;
    const descargarQueFalla = async (ruta: string) => {
      intentos++;
      if (intentos === 1) throw new Error("fallo de red");
      return objetos.get(ruta)!;
    };

    const nombres = await listar(backupId, dek, cache, descargarQueFalla);

    expect(nombres).toEqual(["María.zip"]);
    expect(intentos).toBe(0); // ni siquiera se intentó descargar
  });

  it("el manifiesto sembrado es equivalente al que se descargaría", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { backupId, manifest, objetos } = await subirABackup(dek);

    const descargar = async (ruta: string) => objetos.get(ruta)!;
    const bajado = await abrirBackup(UID, backupId, dek, descargar);

    /* Si no fueran equivalentes, sembrar la caché arreglaría la lista pero
       rompería la lectura del chat, que usa el mismo objeto. */
    expect(bajado!.manifest.name).toBe(manifest.name);
    expect(bajado!.manifest.pieces.length).toBe(manifest.pieces.length);
    expect([...indexByName(manifest).keys()].sort()).toEqual(
      [...bajado!.porNombre.keys()].sort()
    );
  });
});
