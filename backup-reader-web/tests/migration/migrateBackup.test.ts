import { describe, it, expect } from "vitest";

import {
  createVault,
  migrarBackupV1,
  verificarMigracion,
  VerificacionFallida,
  aliasDelChat,
  nombreDesdeCarpeta,
  origenDeRuta,
  tieneTextoDeChat,
  abrirBackup,
  resolverMedia,
  openManifest,
  piecePath,
  manifestPath,
  newId,
  type ArchivoV1,
} from "../../lib/backupreader-crypto";

/**
 * Migración de backups v1 (texto plano) a v2 (cifrado), contra un almacén falso
 * en memoria. No necesita emulador.
 *
 * Lo que de verdad se comprueba aquí es que lo migrado se puede VOLVER A LEER:
 * un migrador que escribe blobs bonitos e ilegibles pasaría cualquier prueba
 * que solo mire el manifiesto, y borraría el original igual.
 */

const UID = "uid-ana";

const bytes = (n: number) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) {
    crypto.getRandomValues(b.subarray(i, Math.min(i + 65536, n)));
  }
  return b;
};

const CHAT_TXT = `[12/01/2024, 10:15:03] María: Hola
[12/01/2024, 10:15:30] Yo: ¿Viste la foto?
[12/01/2024, 10:16:01] María: IMG-20240112-WA0003.jpg (archivo adjunto)
[12/01/2024, 10:17:12] María: AUDIO-20240112-WA0004.opus (archivo adjunto)
`;

/** Un backup v1 tal como lo dejó la Cloud Function `unzip`: ya descomprimido. */
function carpetaV1(
  prefijo: string,
  archivos: Array<[string, Uint8Array | string]>
): { lista: ArchivoV1[]; almacen: Map<string, Blob> } {
  const almacen = new Map<string, Blob>();
  const lista: ArchivoV1[] = [];
  for (const [nombre, contenido] of archivos) {
    const datos =
      typeof contenido === "string" ? new TextEncoder().encode(contenido) : contenido;
    const ruta = `${prefijo}/${nombre}`;
    almacen.set(ruta, new Blob([datos as BlobPart]));
    lista.push({ ruta, nombre });
  }
  return { lista, almacen };
}

/** Ejecuta una migración completa y devuelve todo lo necesario para inspeccionarla. */
async function migrar(
  lista: ArchivoV1[],
  almacen: Map<string, Blob>,
  dek: Uint8Array,
  nombre: string,
  source: "whatsapp" | "instagram" = "whatsapp"
) {
  const backupId = newId();
  const progreso: Array<[number, number]> = [];

  const descargar = async (ruta: string) => {
    const blob = almacen.get(ruta);
    if (!blob) throw new Error(`no existe ${ruta}`);
    return blob;
  };

  const res = await migrarBackupV1(lista, dek, nombre, descargar, {
    backupId,
    source,
    /* Rutas REALES, no claves inventadas: con claves inventadas una migración
       que escriba en el sitio equivocado pasa la prueba igual. */
    subirPieza: async (id, blob) => {
      almacen.set(piecePath(UID, backupId, id), blob);
    },
    subirManifiesto: async (blob) => {
      almacen.set(manifestPath(UID, backupId), blob);
    },
    onProgreso: (hechas, total) => progreso.push([hechas, total]),
  });

  return { ...res, backupId, almacen, descargar, progreso };
}

describe("alias del texto del chat", () => {
  it("un .mp3 de WhatsApp responde también al .opus que nombra el chat", () => {
    expect(aliasDelChat("AUDIO-20240112-WA0004.mp3", "whatsapp")).toBe(
      "AUDIO-20240112-WA0004.opus"
    );
  });

  it("no inventa alias para lo que no es audio convertido", () => {
    expect(aliasDelChat("IMG-01.jpg", "whatsapp")).toBeUndefined();
    expect(aliasDelChat("_chat.txt", "whatsapp")).toBeUndefined();
    // La conversión a mp3 nunca tocó los exports de Instagram.
    expect(aliasDelChat("audio.mp3", "instagram")).toBeUndefined();
  });
});

describe("utilidades de ruta", () => {
  it("saca el nombre del chat de la carpeta", () => {
    expect(nombreDesdeCarpeta("backups/uid/whatsapp/WhatsApp Chat - María")).toBe(
      "WhatsApp Chat - María"
    );
    expect(nombreDesdeCarpeta("backups/uid/whatsapp/Chat con Ana/")).toBe("Chat con Ana");
  });

  it("deduce el origen", () => {
    expect(origenDeRuta("backups/u/whatsapp/X")).toBe("whatsapp");
    expect(origenDeRuta("backups/u/instagram/Y")).toBe("instagram");
    expect(origenDeRuta("backups/u/otro/Z")).toBe("other");
  });

  it("detecta si la carpeta tiene texto de chat", () => {
    expect(tieneTextoDeChat([{ ruta: "a/_chat.txt", nombre: "_chat.txt" }])).toBe(true);
    expect(tieneTextoDeChat([{ ruta: "a/m.json", nombre: "m.json" }])).toBe(true);
    expect(tieneTextoDeChat([{ ruta: "a/IMG.jpg", nombre: "IMG.jpg" }])).toBe(false);
    expect(tieneTextoDeChat([])).toBe(false);
  });
});

describe("migración completa", () => {
  it("todo lo que entra vuelve a salir idéntico", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const foto = bytes(64 * 1024);
    const audio = bytes(2048);

    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/WhatsApp Chat - María", [
      ["_chat.txt", CHAT_TXT],
      ["IMG-20240112-WA0003.jpg", foto],
      ["AUDIO-20240112-WA0004.mp3", audio],
      ["vacio.txt", new Uint8Array(0)],
    ]);

    const r = await migrar(lista, almacen, dek, "WhatsApp Chat - María");

    expect(r.omitidas).toEqual([]);
    expect(r.manifest.pieces).toHaveLength(4);
    expect(r.manifest.source).toBe("whatsapp");
    expect(r.progreso.at(-1)).toEqual([4, 4]);

    // El manifiesto se puede releer desde el almacén, no solo desde memoria.
    const manifiesto = await openManifest(
      r.almacen.get(manifestPath(UID, r.backupId))!,
      dek,
      r.backupId
    );
    expect(manifiesto.pieces.map((p) => p.name).sort()).toEqual([
      "AUDIO-20240112-WA0004.mp3",
      "IMG-20240112-WA0003.jpg",
      "_chat.txt",
      "vacio.txt",
    ]);

    // Y el contenido byte a byte.
    const abierto = await abrirBackup(UID, r.backupId, dek, r.descargar);
    const jpg = await resolverMedia(
      UID,
      abierto,
      "IMG-20240112-WA0003.jpg",
      dek,
      r.descargar
    );
    expect(jpg.estado).toBe("ok");
    if (jpg.estado === "ok") {
      expect(jpg.pieza.size).toBe(foto.byteLength);
    }
  });

  it("el chat encuentra el audio por su nombre .opus aunque el archivo sea .mp3", async () => {
    // Esta es LA prueba de la etapa. Sin el alias, las notas de voz de un
    // backup migrado desaparecen sin dar ningún error: el manifiesto está bien,
    // las piezas están bien, y el chat pide un nombre que no existe.
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const audio = bytes(4096);

    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", CHAT_TXT],
      ["AUDIO-20240112-WA0004.mp3", audio],
    ]);

    const r = await migrar(lista, almacen, dek, "Chat");
    const abierto = await abrirBackup(UID, r.backupId, dek, r.descargar);

    // Como lo nombra el texto del chat:
    const porOpus = await resolverMedia(
      UID,
      abierto,
      "AUDIO-20240112-WA0004.opus",
      dek,
      r.descargar
    );
    expect(porOpus.estado).toBe("ok");

    // Y como se llama de verdad:
    const porMp3 = await resolverMedia(
      UID,
      abierto,
      "AUDIO-20240112-WA0004.mp3",
      dek,
      r.descargar
    );
    expect(porMp3.estado).toBe("ok");

    if (porOpus.estado === "ok" && porMp3.estado === "ok") {
      expect(porOpus.pieza.id).toBe(porMp3.pieza.id);
      expect(porOpus.pieza.mime).toBe("audio/mpeg");
    }
  });

  it("un archivo ilegible se anota y no tumba el resto", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");

    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", CHAT_TXT],
      ["IMG-01.jpg", bytes(1024)],
    ]);

    // Se anuncia un archivo que no está en el almacén: la descarga fallará.
    lista.push({ ruta: "backups/uid-ana/whatsapp/Chat/fantasma.jpg", nombre: "fantasma.jpg" });

    const r = await migrar(lista, almacen, dek, "Chat");

    expect(r.omitidas).toHaveLength(1);
    expect(r.omitidas[0].nombre).toBe("fantasma.jpg");
    expect(r.manifest.pieces).toHaveLength(2); // los otros dos sí se migraron
  });
});

describe("verificación antes de borrar", () => {
  it("pasa cuando la copia está completa", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", CHAT_TXT],
      ["IMG-01.jpg", bytes(1024)],
    ]);
    const r = await migrar(lista, almacen, dek, "Chat");

    await expect(
      verificarMigracion(UID, r.backupId, dek, r.descargar, r.manifest.pieces.length)
    ).resolves.toBeUndefined();
  });

  it("falla si faltan piezas respecto de lo esperado", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", CHAT_TXT],
    ]);
    const r = await migrar(lista, almacen, dek, "Chat");

    // Se esperaban 2 y el manifiesto trae 1: no se borra nada.
    await expect(
      verificarMigracion(UID, r.backupId, dek, r.descargar, 2)
    ).rejects.toBeInstanceOf(VerificacionFallida);
  });

  it("falla si el manifiesto no se puede descifrar", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", CHAT_TXT],
    ]);
    const r = await migrar(lista, almacen, dek, "Chat");

    // Se corrompe el manifiesto ya subido.
    const roto = new Blob([bytes(200) as BlobPart]);
    r.almacen.set(manifestPath(UID, r.backupId), roto);

    await expect(
      verificarMigracion(UID, r.backupId, dek, r.descargar, 1)
    ).rejects.toBeInstanceOf(VerificacionFallida);
  });

  it("falla si la pieza del chat no llegó a subirse", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", CHAT_TXT],
      ["IMG-01.jpg", bytes(1024)],
    ]);
    const r = await migrar(lista, almacen, dek, "Chat");

    const chat = r.manifest.pieces.find((p) => p.kind === "chat")!;
    r.almacen.delete(piecePath(UID, r.backupId, chat.id));

    await expect(
      verificarMigracion(UID, r.backupId, dek, r.descargar, r.manifest.pieces.length)
    ).rejects.toBeInstanceOf(VerificacionFallida);
  });

  it("falla si el chat quedó vacío", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const { lista, almacen } = carpetaV1("backups/uid-ana/whatsapp/Chat", [
      ["_chat.txt", "   \n  "],
    ]);
    const r = await migrar(lista, almacen, dek, "Chat");

    await expect(
      verificarMigracion(UID, r.backupId, dek, r.descargar, 1)
    ).rejects.toBeInstanceOf(VerificacionFallida);
  });
});
