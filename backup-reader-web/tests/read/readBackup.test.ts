import { describe, it, expect } from "vitest";
import { BlobWriter, BlobReader, ZipWriter } from "@zip.js/zip.js";

import {
  createVault,
  uploadBackup,
  newId,
  piecePath,
  manifestPath,
  abrirBackup,
  leerTextoDelChat,
  leerPieza,
  resolverMedia,
  handleDeBackup,
  esHandleV2,
  backupIdDeHandle,
  findChatPiece,
  type Descargar,
} from "../../lib/backupreader-crypto";

/**
 * Lectura de backups cifrados (Etapa 6).
 *
 * Cada prueba sube de verdad y luego lee de verdad, contra un almacén falso en
 * memoria. Es el ciclo completo: si esto pasa, lo que la Etapa 5 sube hoy se
 * puede abrir mañana.
 */

const UID = "uid-ana";

const CHAT_TXT = `[12/01/2024, 10:15:03] María: Hola
[12/01/2024, 10:15:30] Yo: ¿Viste la foto?
[12/01/2024, 10:16:01] María: IMG-20240112-WA0003.jpg (archivo adjunto)
[12/01/2024, 10:17:10] María: AUDIO-20240112-WA0004.opus (archivo adjunto)
`;

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

/** Sube un backup y devuelve todo lo necesario para leerlo después. */
async function subirYPreparar(
  entradas: Array<[string, Uint8Array | string]>,
  nombre = "WhatsApp Chat - María.zip"
) {
  const { dek } = await createVault("contraseña-de-prueba-larga");
  const zip = await zipDePrueba(entradas);
  const backupId = newId();
  const almacen = new Map<string, Blob>();

  await uploadBackup(zip, dek, nombre, {
    backupId,
    sinWorker: true,
    subirPieza: async (id, blob) => {
      almacen.set(piecePath(UID, backupId, id), blob);
    },
    subirManifiesto: async (blob) => {
      almacen.set(manifestPath(UID, backupId), blob);
    },
  });

  const descargar: Descargar = async (ruta) => {
    const b = almacen.get(ruta);
    if (!b) throw new Error(`404 ${ruta}`);
    return b;
  };

  return { dek, backupId, almacen, descargar };
}

describe("identificador de backup", () => {
  it("distingue v2 de las rutas v1", () => {
    const id = "3f2a8c1e-0000-4000-8000-000000000000";
    const handle = handleDeBackup(id);

    expect(esHandleV2(handle)).toBe(true);
    expect(backupIdDeHandle(handle)).toBe(id);

    // Una ruta v1 no debe confundirse nunca con un handle cifrado.
    const v1 = `backups/${UID}/whatsapp/WhatsApp Chat - María Sep 2025`;
    expect(esHandleV2(v1)).toBe(false);
    expect(backupIdDeHandle(v1)).toBeNull();
  });
});

describe("abrir un backup cifrado", () => {
  it("recupera el nombre del chat y el índice de piezas", async () => {
    const { dek, backupId, descargar } = await subirYPreparar([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
      ["WhatsApp Chat - María/IMG-20240112-WA0003.jpg", bytesAleatorios(4096)],
    ]);

    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    expect(abierto.backupId).toBe(backupId);
    expect(abierto.manifest.name).toBe("WhatsApp Chat - María.zip");
    expect(abierto.manifest.pieces).toHaveLength(2);
    // El índice traduce el nombre del texto del chat a la pieza opaca.
    expect(abierto.porNombre.has("img-20240112-wa0003.jpg")).toBe(true);
  });

  it("el texto del chat sale idéntico", async () => {
    const { dek, backupId, descargar } = await subirYPreparar([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
    ]);

    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    const chat = await leerTextoDelChat(UID, abierto, dek, descargar);
    expect(chat).not.toBeNull();
    expect(chat!.texto).toBe(CHAT_TXT);
  });

  it("una DEK distinta no abre el manifiesto", async () => {
    const { backupId, descargar } = await subirYPreparar([
      ["chat/_chat.txt", "secreto"],
    ]);
    const otra = await createVault("la-contraseña-del-atacante");
    await expect(abrirBackup(UID, backupId, otra.dek, descargar)).rejects.toThrow();
  });

  it("un backup sin pieza de chat devuelve null en vez de reventar", async () => {
    const { dek, backupId, descargar } = await subirYPreparar([
      ["backup/foto.jpg", bytesAleatorios(1024)],
    ]);
    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    expect(findChatPiece(abierto.manifest)).toBeUndefined();
    expect(await leerTextoDelChat(UID, abierto, dek, descargar)).toBeNull();
  });
});

describe("resolver media por el nombre del chat", () => {
  it("encuentra la foto y sale byte a byte", async () => {
    const foto = bytesAleatorios(32 * 1024);
    const { dek, backupId, descargar } = await subirYPreparar([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
      ["WhatsApp Chat - María/IMG-20240112-WA0003.jpg", foto],
    ]);

    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    const r = await resolverMedia(UID, abierto, "IMG-20240112-WA0003.jpg", dek, descargar);

    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.pieza.mime).toBe("image/jpeg");
    expect(r.pieza.kind).toBe("image");

    // El contenido descifrado coincide con el original.
    const pieza = abierto.porNombre.get("img-20240112-wa0003.jpg")!;
    const blob = await leerPieza(UID, backupId, pieza, dek, descargar, abierto.manifest.blockSize);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(foto);

    URL.revokeObjectURL(r.objectUrl);
  });

  it("el audio Opus conserva su tipo", async () => {
    const { dek, backupId, descargar } = await subirYPreparar([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
      ["WhatsApp Chat - María/AUDIO-20240112-WA0004.opus", bytesAleatorios(2048)],
    ]);

    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    const r = await resolverMedia(
      UID, abierto, "AUDIO-20240112-WA0004.opus", dek, descargar
    );

    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    // En v2 el .opus se guarda tal cual; no hay conversión a .mp3 en el servidor.
    expect(r.pieza.kind).toBe("audio");
    expect(r.pieza.mime).toContain("opus");
    URL.revokeObjectURL(r.objectUrl);
  });

  it("encuentra la media aunque el nombre venga con ruta o invisibles", async () => {
    // WhatsApp mete U+200E en las líneas, y el zip guarda la carpeta delante.
    const { dek, backupId, descargar } = await subirYPreparar([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
      ["WhatsApp Chat - María/IMG-20240112-WA0003.jpg", bytesAleatorios(512)],
    ]);

    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    for (const variante of [
      "IMG-20240112-WA0003.jpg",
      "‎IMG-20240112-WA0003.JPG",
      "WhatsApp Chat - María/IMG-20240112-WA0003.jpg",
    ]) {
      const r = await resolverMedia(UID, abierto, variante, dek, descargar);
      expect(r.estado).toBe("ok");
      if (r.estado === "ok") URL.revokeObjectURL(r.objectUrl);
    }
  });

  it("un archivo que no está devuelve no-encontrada", async () => {
    const { dek, backupId, descargar } = await subirYPreparar([
      ["WhatsApp Chat - María/_chat.txt", CHAT_TXT],
    ]);
    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    const r = await resolverMedia(UID, abierto, "NO-EXISTE.jpg", dek, descargar);
    expect(r.estado).toBe("no-encontrada");
  });

  it("no descifra una pieza que el servidor haya cambiado de sitio", async () => {
    /* El AAD ata cada pieza a su id. Si el servidor sirve el blob de otra
       pieza, el descifrado FALLA en vez de entregar el archivo equivocado.
       Y falla lanzando, no devolviendo "no-encontrada": una pieza manipulada
       no es lo mismo que una que no está, y convertir un fallo de integridad
       en un "no encontrado" lo escondería. Quien llama lo captura y muestra el
       aviso de error. */
    const { dek, backupId, almacen, descargar } = await subirYPreparar([
      ["chat/_chat.txt", "hola"],
      ["chat/a.jpg", bytesAleatorios(1024)],
      ["chat/b.jpg", bytesAleatorios(1024)],
    ]);

    const abierto = await abrirBackup(UID, backupId, dek, descargar);
    const a = abierto.porNombre.get("a.jpg")!;
    const b = abierto.porNombre.get("b.jpg")!;

    // Intercambiar los blobs de a.jpg y b.jpg.
    const blobA = almacen.get(piecePath(UID, backupId, a.id))!;
    almacen.set(piecePath(UID, backupId, a.id), almacen.get(piecePath(UID, backupId, b.id))!);
    almacen.set(piecePath(UID, backupId, b.id), blobA);

    await expect(
      resolverMedia(UID, abierto, "a.jpg", dek, descargar)
    ).rejects.toThrow();
  });
});
