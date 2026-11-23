import { describe, it, expect } from "vitest";
import { BlobWriter, BlobReader, ZipWriter } from "@zip.js/zip.js";

import {
  createVault,
  uploadBackup,
  openManifest,
  openPiece,
  indexByName,
  findChatPiece,
  findChatPieces,
  pieceAad,
  piecePath,
  manifestPath,
  newId,
} from "../../lib/backupreader-crypto";
import { filasDelChat } from "../../lib/filas-del-chat";
import { nombreDelAdjunto } from "../../lib/nombre-de-adjunto";
import { construirIndice, buscarEnIndice } from "../../lib/busqueda/indice";

/**
 * El viaje completo de un export de Instagram PARTIDO EN VARIOS ARCHIVOS.
 *
 * Es el caso que se colaba: `findChatPiece` devolvía una sola pieza, así que
 * de una conversación larga se leía solo el trozo más reciente y el chat se
 * abría con menos mensajes sin que nada avisara. Un chat que abre bien pero
 * incompleto es peor que uno que falla, porque nadie lo mira dos veces.
 *
 * Y de paso lo otro: el índice de búsqueda guarda NÚMEROS de mensaje, así que
 * si el indexador parseara distinto que la pantalla, buscar una palabra te
 * llevaría a otro mensaje. Aquí se busca algo que vive en el archivo VIEJO,
 * que es el que antes ni se leía.
 *
 * No necesita emulador: el almacén es un Map, pero con las rutas reales.
 */

const UID = "uid-instagram";
const HILO = "your_instagram_activity/messages/inbox/ana_123";

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
  crypto.getRandomValues(b);
  return b;
};

const mensaje = (ms: number, quien: string, extra: Record<string, unknown> = {}) => ({
  sender_name: quien,
  timestamp_ms: ms,
  ...extra,
});

/* El 1 es el bloque MÁS RECIENTE, y dentro de cada archivo los mensajes van
   del más nuevo al más viejo. Así es como los escribe Instagram. */
const MESSAGE_1 = JSON.stringify({
  participants: [{ name: "Ana" }, { name: "Beto" }],
  title: "Ana",
  messages: [
    mensaje(5000, "Ana", { photos: [{ uri: `${HILO}/photos/gato.jpg` }] }),
    mensaje(4000, "Beto", { content: "el cuarto" }),
  ],
});

const MESSAGE_2 = JSON.stringify({
  participants: [{ name: "Ana" }, { name: "Beto" }],
  title: "Ana",
  messages: [
    mensaje(3000, "Ana", { content: "el tercero" }),
    mensaje(2000, "Beto", { content: "aguacate" }), // la palabra que se busca
    mensaje(1000, "Ana", { content: "el primero" }),
  ],
});

async function subirYLeer() {
  const { dek } = await createVault("contraseña-de-prueba-larga");
  const foto = bytesAleatorios(1024);

  const zip = await zipDePrueba([
    [`${HILO}/message_1.json`, MESSAGE_1],
    [`${HILO}/message_2.json`, MESSAGE_2],
    [`${HILO}/photos/gato.jpg`, foto],
  ]);

  const backupId = newId();
  const objetos = new Map<string, Blob>();

  /* El nombre del archivo NO dice «instagram» a propósito: así se comprueba
     que el origen sale de lo que hay dentro del zip, que es lo que pasa de
     verdad cuando alguien renombra la descarga. */
  const { manifest } = await uploadBackup(zip, dek, "respaldo-del-movil.zip", {
    backupId,
    sinWorker: true,
    subirPieza: async (id, blob) => {
      objetos.set(piecePath(UID, backupId, id), blob);
    },
    subirManifiesto: async (blob) => {
      objetos.set(manifestPath(UID, backupId), blob);
    },
  });

  const leido = await openManifest(objetos.get(manifestPath(UID, backupId))!, dek, backupId);

  /* Lo mismo que hace `leerTextoDelChat`: todas las piezas de chat. */
  const piezas = findChatPieces(leido);
  const textos: string[] = [];
  for (const pieza of piezas) {
    const blob = await openPiece(objetos.get(piecePath(UID, backupId, pieza.id))!, dek, {
      mime: pieza.mime,
      aad: pieceAad(backupId, pieza.id),
    });
    textos.push(await blob.text());
  }

  return { dek, backupId, objetos, manifest: leido, piezas, textos, foto };
}

describe("un export de Instagram partido en varios archivos", () => {
  it("se reconoce como Instagram aunque el zip se llame otra cosa", async () => {
    const { manifest } = await subirYLeer();
    expect(manifest.source).toBe("instagram");
  });

  it("los message_N.json se guardan como pieza de chat, no como documento", async () => {
    const { piezas } = await subirYLeer();
    expect(piezas).toHaveLength(2);
    expect(piezas.every((p) => p.kind === "chat")).toBe(true);
  });

  it("se leen TODOS, no solo el más reciente", async () => {
    const { manifest, textos } = await subirYLeer();

    const filas = filasDelChat(
      { texto: textos[0], nombre: "message_2.json", textos },
      manifest.source
    );

    /* Cinco mensajes: dos del archivo nuevo y tres del viejo. Con una sola
       pieza salían dos, y el chat parecía completo. */
    expect(filas).toHaveLength(5);
    expect(filas.map((f) => f[2])).toEqual([
      "el primero",
      "aguacate",
      "el tercero",
      "el cuarto",
      expect.stringContaining("gato.jpg"),
    ]);
  });

  it("la foto se resuelve contra el manifiesto por su nombre", async () => {
    const { manifest, textos, objetos, backupId, dek, foto } = await subirYLeer();

    const filas = filasDelChat(
      { texto: textos[0], nombre: "message_1.json", textos },
      manifest.source
    );
    const nombre = nombreDelAdjunto(filas[4][2]);
    expect(nombre).toBe("gato.jpg");

    const pieza = indexByName(manifest).get("gato.jpg")!;
    expect(pieza).toBeTruthy();

    const blob = await openPiece(objetos.get(piecePath(UID, backupId, pieza.id))!, dek, {
      mime: pieza.mime,
      aad: pieceAad(backupId, pieza.id),
    });
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(foto);
  });

  it("buscar una palabra de CUALQUIERA de los archivos cae en el mensaje correcto", async () => {
    const { manifest, textos } = await subirYLeer();

    const filas = filasDelChat(
      { texto: textos[0], nombre: "message_1.json", textos },
      manifest.source
    );

    const indice = construirIndice({ backupId: "b", nombre: "Ana", filas });

    /* Una palabra de cada archivo: «aguacate» vive en el viejo y «cuarto» en
       el reciente. Con una sola de las dos, la prueba pasaba aunque se leyera
       un único archivo, y no probaba lo que dice probar. */
    for (const palabra of ["aguacate", "cuarto"]) {
      const encontrado = buscarEnIndice(indice, palabra);
      expect(encontrado, palabra).not.toBeNull();
      expect(encontrado!.mensajes.length, palabra).toBeGreaterThan(0);
      /* Lo que importa no es que encuentre algo, sino que el NÚMERO que
         guarda el índice apunte a la fila que de verdad lleva la palabra. */
      for (const n of encontrado!.mensajes) {
        expect(filas[n][2]).toContain(palabra);
      }
    }
  });

  it("findChatPiece sigue devolviendo la primera, para quien espera una sola", async () => {
    const { manifest, piezas } = await subirYLeer();
    expect(findChatPiece(manifest)!.id).toBe(piezas[0].id);
  });
});
