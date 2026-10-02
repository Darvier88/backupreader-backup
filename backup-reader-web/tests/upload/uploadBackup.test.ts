import { describe, it, expect } from "vitest";
import { BlobWriter, BlobReader, ZipWriter } from "@zip.js/zip.js";

import {
  createVault,
  uploadBackup,
  detectarOrigen,
  openManifest,
  openPiece,
  indexByName,
  findChatPiece,
  normalizeName,
  cipherBytes,
  pieceAad,
  piecePath,
  manifestPath,
  newId,
  HEADER_BYTES,
  FORMAT_VERSION,
} from "../../lib/backupreader-crypto";

/**
 * Subida cifrada de extremo a extremo, contra un almacén falso en memoria.
 *
 * No necesita emulador: lo que se comprueba es que un zip real entra, sale
 * cifrado, y vuelve a salir idéntico. Es la prueba que cubre el hueco entre la
 * Etapa 5 (subir) y la 6 (leer): si esto pasa, lo que se sube hoy se podrá
 * leer mañana.
 *
 * Todas usan `sinWorker: true` porque en Node no hay Worker. La vía con worker
 * se prueba a mano en el navegador (ver README-ETAPA-5.md).
 */

/** Construye un zip parecido a un export de WhatsApp. */
async function zipDePrueba(entradas: Array<[string, Uint8Array | string]>) {
  const salida = new BlobWriter("application/zip");
  const writer = new ZipWriter(salida);
  for (const [nombre, contenido] of entradas) {
    const bytes =
      typeof contenido === "string" ? new TextEncoder().encode(contenido) : contenido;
    await writer.add(nombre, new BlobReader(new Blob([bytes as BlobPart])));
  }
  await writer.close();
  return salida.getData();
}

const bytesAleatorios = (n: number) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) {
    crypto.getRandomValues(b.subarray(i, Math.min(i + 65536, n)));
  }
  return b;
};

const UID = "uid-ana";

/**
 * Sube a un Map en memoria, usando las RUTAS REALES de Storage.
 *
 * Usar `piecePath`/`manifestPath` y no una clave inventada no es un detalle:
 * una versión anterior leía el `backupId` del resultado de `uploadBackup`, que
 * durante la subida todavía no existe, y las piezas acababan en
 * `backups/{uid}/undefined/p/`. Con claves inventadas las pruebas pasaban
 * igual; con las rutas reales, no.
 */
async function subir(
  zip: Blob,
  dek: Uint8Array,
  nombre: string,
  onProgreso?: (p: number) => void
) {
  const backupId = newId();
  const objetos = new Map<string, Blob>();
  const res = await uploadBackup(zip, dek, nombre, {
    backupId,
    sinWorker: true,
    subirPieza: async (id, blob) => {
      objetos.set(piecePath(UID, backupId, id), blob);
    },
    subirManifiesto: async (blob) => {
      objetos.set(manifestPath(UID, backupId), blob);
    },
    onProgreso,
  });
  return { ...res, objetos };
}

/** Atajos para leer del Map con las rutas reales. */
const leerPieza = (o: Map<string, Blob>, b: string, id: string) =>
  o.get(piecePath(UID, b, id))!;
const leerManif = (o: Map<string, Blob>, b: string) => o.get(manifestPath(UID, b))!;

const CHAT_TXT = `[12/01/2024, 10:15:03] María: Hola
[12/01/2024, 10:15:30] Yo: ¿Viste la foto?
[12/01/2024, 10:16:01] María: IMG-20240112-WA0003.jpg (archivo adjunto)
`;

describe("subida cifrada", () => {
  it("un zip completo entra y vuelve a salir idéntico", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const foto = bytesAleatorios(64 * 1024);

    const zip = await zipDePrueba([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
      ["WhatsApp Chat - María/IMG-20240112-WA0003.jpg", foto],
      ["WhatsApp Chat - María/AUDIO-20240112-WA0004.opus", bytesAleatorios(2048)],
      ["WhatsApp Chat - María/vacio.txt", new Uint8Array(0)],
    ]);

    const { backupId, objetos, omitidas } = await subir(
      zip,
      dek,
      "WhatsApp Chat - María.zip"
    );

    expect(omitidas).toHaveLength(0);
    expect(objetos.size).toBe(5); // 4 piezas + manifiesto

    // Ningún nombre real aparece en las claves que ve el servidor.
    for (const clave of objetos.keys()) {
      expect(clave).not.toContain("María");
      expect(clave).not.toContain("chat");
      expect(clave).not.toContain(".jpg");
    }

    const manifest = await openManifest(leerManif(objetos, backupId), dek, backupId);
    expect(manifest.fmt).toBe(FORMAT_VERSION);
    expect(manifest.name).toBe("WhatsApp Chat - María.zip");
    expect(manifest.source).toBe("whatsapp");
    expect(manifest.pieces).toHaveLength(4);

    // El texto del chat se recupera tal cual.
    const chat = findChatPiece(manifest)!;
    const texto = await openPiece(leerPieza(objetos, backupId, chat.id), dek, {
      mime: chat.mime,
      aad: pieceAad(backupId, chat.id),
    });
    expect(await texto.text()).toBe(CHAT_TXT);

    // La foto se resuelve por el nombre que aparece en el chat, y sale byte a byte.
    const pieza = indexByName(manifest).get(
      normalizeName("IMG-20240112-WA0003.jpg")
    )!;
    expect(pieza.kind).toBe("image");
    expect(pieza.mime).toBe("image/jpeg");

    const salida = await openPiece(leerPieza(objetos, backupId, pieza.id), dek, {
      mime: pieza.mime,
      aad: pieceAad(backupId, pieza.id),
    });
    expect(new Uint8Array(await salida.arrayBuffer())).toEqual(foto);
  });

  it("el audio Opus conserva tipo y mime", async () => {
    const { dek } = await createVault("contraseña-para-el-audio");
    const zip = await zipDePrueba([["chat/AUDIO-01.opus", bytesAleatorios(2048)]]);
    const { backupId, objetos } = await subir(zip, dek, "chat.zip");

    const manifest = await openManifest(leerManif(objetos, backupId), dek, backupId);
    expect(manifest.pieces[0].kind).toBe("audio");
    expect(manifest.pieces[0].mime).toContain("opus");
  });

  it("un archivo vacío no rompe la subida", async () => {
    // Era un bug real antes de la Etapa 1: el cifrado no fallaba, pero el
    // descifrado sí, meses después.
    const { dek } = await createVault("contraseña-del-vacio");
    const zip = await zipDePrueba([
      ["chat/_chat.txt", "hola"],
      ["chat/vacio.dat", new Uint8Array(0)],
    ]);
    const { backupId, objetos, omitidas } = await subir(zip, dek, "chat.zip");

    expect(omitidas).toHaveLength(0);
    const manifest = await openManifest(leerManif(objetos, backupId), dek, backupId);
    const vacia = manifest.pieces.find((p) => p.name.endsWith("vacio.dat"))!;
    expect(vacia.size).toBe(0);

    const salida = await openPiece(leerPieza(objetos, backupId, vacia.id), dek, {
      mime: vacia.mime,
      aad: pieceAad(backupId, vacia.id),
    });
    expect(salida.size).toBe(0);
  });

  it("cada blob es cabecera + ciphertext en un solo objeto", async () => {
    const { dek } = await createVault("contraseña-de-cabeceras");
    const zip = await zipDePrueba([["chat/a.txt", "abc"]]);
    const { backupId, objetos } = await subir(zip, dek, "chat.zip");

    const manifest = await openManifest(leerManif(objetos, backupId), dek, backupId);
    const p = manifest.pieces[0];
    expect(leerPieza(objetos, backupId, p.id).size).toBe(HEADER_BYTES + p.cipherSize);
  });

  it("la DEK equivocada no abre nada", async () => {
    const { dek } = await createVault("la-buena-contraseña");
    const otra = await createVault("la-mala-contraseña");
    const zip = await zipDePrueba([["chat/_chat.txt", "secreto"]]);
    const { backupId, objetos } = await subir(zip, dek, "chat.zip");

    await expect(
      openManifest(leerManif(objetos, backupId), otra.dek, backupId)
    ).rejects.toThrow();
  });

  it("el manifiesto está atado a su backupId", async () => {
    const { dek } = await createVault("contraseña-del-manifiesto");
    const zip = await zipDePrueba([["chat/_chat.txt", "hola"]]);
    const { backupId, objetos } = await subir(zip, dek, "chat.zip");

    // Con otro backupId el AAD no coincide: el servidor no puede mover un
    // manifiesto de un backup a otro sin que se note.
    await expect(
      openManifest(leerManif(objetos, backupId), dek, "otro-backup-id")
    ).rejects.toThrow();
    await expect(
      openManifest(leerManif(objetos, backupId), dek, backupId)
    ).resolves.toBeTruthy();
  });

  it("una pieza no se puede descifrar con el id de otra", async () => {
    const { dek } = await createVault("contraseña-del-intercambio");
    const zip = await zipDePrueba([
      ["chat/a.txt", "primero"],
      ["chat/b.txt", "segundo"],
    ]);
    const { backupId, objetos } = await subir(zip, dek, "chat.zip");

    const manifest = await openManifest(leerManif(objetos, backupId), dek, backupId);
    const [a, b] = manifest.pieces;

    await expect(
      openPiece(leerPieza(objetos, backupId, a.id), dek, { aad: pieceAad(backupId, b.id) })
    ).rejects.toThrow();
  });

  it("cipherBytes cuadra con lo subido", async () => {
    const { dek } = await createVault("contraseña-del-tamaño");
    const zip = await zipDePrueba([
      ["chat/a.bin", bytesAleatorios(10 * 1024)],
      ["chat/b.bin", bytesAleatorios(20 * 1024)],
    ]);

    let subidos = 0;
    const backupId = newId();
    const objetos = new Map<string, Blob>();
    await uploadBackup(zip, dek, "chat.zip", {
      backupId,
      sinWorker: true,
      subirPieza: async (id, blob) => {
        subidos += blob.size;
        objetos.set(piecePath(UID, backupId, id), blob);
      },
      subirManifiesto: async (blob) => {
        objetos.set(manifestPath(UID, backupId), blob);
      },
    });

    const manifest = await openManifest(leerManif(objetos, backupId), dek, backupId);
    // cipherBytes no cuenta las cabeceras: la diferencia son 24 B por pieza.
    expect(subidos - cipherBytes(manifest)).toBe(
      HEADER_BYTES * manifest.pieces.length
    );
  });

  it("el progreso avanza hasta 100 sin retroceder", async () => {
    const { dek } = await createVault("contraseña-del-progreso");
    const zip = await zipDePrueba([
      ["chat/a.txt", "1"],
      ["chat/b.txt", "2"],
      ["chat/c.txt", "3"],
      ["chat/d.txt", "4"],
    ]);

    const avances: number[] = [];
    await subir(zip, dek, "chat.zip", (p) => avances.push(p));

    expect(avances.length).toBeGreaterThan(0);
    expect(avances[avances.length - 1]).toBe(100);
    for (let i = 1; i < avances.length; i++) {
      expect(avances[i]).toBeGreaterThanOrEqual(avances[i - 1]);
    }
  });

  it("las rutas de Storage llevan el backupId real", async () => {
    /* Regresión: antes el backupId se leía del resultado de uploadBackup, que
       durante la subida todavía no existe, y todo acababa en
       `backups/{uid}/undefined/`. Firestore sí guardaba el id bueno, así que
       el backup quedaba ilegible. */
    const { dek } = await createVault("contraseña-de-las-rutas");
    const zip = await zipDePrueba([
      ["chat/_chat.txt", "hola"],
      ["chat/foto.jpg", bytesAleatorios(512)],
    ]);
    const { backupId, objetos } = await subir(zip, dek, "chat.zip");

    expect(objetos.size).toBe(3);
    for (const ruta of objetos.keys()) {
      expect(ruta).not.toContain("undefined");
      expect(ruta.startsWith(`backups/${UID}/${backupId}/`)).toBe(true);
    }
    expect(objetos.has(manifestPath(UID, backupId))).toBe(true);
  });

  it("detecta el origen por el nombre del archivo", () => {
    expect(detectarOrigen("WhatsApp Chat - X.zip")).toBe("whatsapp");
    expect(detectarOrigen("instagram-export.zip")).toBe("instagram");
    expect(detectarOrigen("cosas.zip")).toBe("other");
  });
});
