import { describe, it, expect } from "vitest";
import { BlobWriter, BlobReader, ZipWriter } from "@zip.js/zip.js";

import {
  createVault,
  uploadBackup,
  openManifest,
  indexByName,
  findChatPieces,
  manifestPath,
  piecePath,
  newId,
} from "../../lib/backupreader-crypto";
import { hilosDeInstagram } from "../../lib/backupreader-crypto/hilosInstagram";

/**
 * Elegir UNA conversación de un export de Instagram, que las trae todas.
 *
 * Lo que se comprueba no es solo que la lista salga, sino que al subir no se
 * cuele nada de las demás: si se colara, se estaría cifrando y cobrando
 * almacenamiento por conversaciones que la persona no pidió subir, y el chat
 * que se abriera sería uno al azar.
 */

const UID = "uid-eleccion";
const BASE = "your_instagram_activity/messages";

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

const relleno = (n: number) => "x".repeat(n);

const hilo = (titulo: string, quienes: string[], extra = "") =>
  JSON.stringify({
    title: titulo,
    participants: quienes.map((name) => ({ name })),
    messages: [{ sender_name: quienes[0], timestamp_ms: 1763900000000, content: `hola ${extra}` }],
  });

/* Tres conversaciones: una grande con foto, una pequeña, y una archivada con
   el título mal codificado, que es como lo escribe Meta. */
const ENTRADAS: Array<[string, Uint8Array | string]> = [
  [`${BASE}/inbox/anagarcia_1182939/message_1.json`, hilo("Ana García", ["Ana García", "Yo"], relleno(400))],
  [`${BASE}/inbox/anagarcia_1182939/photos/gato.jpg`, relleno(2000)],
  [`${BASE}/inbox/beto_99/message_1.json`, hilo("Beto", ["Beto", "Yo"])],
  [`${BASE}/archived_threads/martin_77/message_1.json`, hilo("MartÃ­n", ["MartÃ­n", "Yo"])],
];

describe("las conversaciones de un export de Instagram", () => {
  it("se listan todas, con su nombre de verdad", async () => {
    const hilos = await hilosDeInstagram(await zipDePrueba(ENTRADAS));

    expect(hilos).toHaveLength(3);
    expect(hilos.map((h) => h.nombre).sort()).toEqual(["Ana García", "Beto", "Martín"]);
  });

  it("la más pesada va primero, que es la que la gente busca", async () => {
    const hilos = await hilosDeInstagram(await zipDePrueba(ENTRADAS));
    expect(hilos[0].nombre).toBe("Ana García");
    expect(hilos[0].bytes).toBeGreaterThan(hilos[1].bytes);
  });

  it("dice de dónde sale cada una y cuántos archivos tiene", async () => {
    const hilos = await hilosDeInstagram(await zipDePrueba(ENTRADAS));
    const ana = hilos.find((h) => h.nombre === "Ana García")!;
    const martin = hilos.find((h) => h.nombre === "Martín")!;

    expect(ana.bandeja).toBe("inbox");
    expect(ana.archivos).toBe(2); // el json y la foto
    expect(ana.participantes).toEqual(["Ana García", "Yo"]);
    expect(martin.bandeja).toBe("archived_threads");
  });

  it("una conversación con el json roto sigue en la lista", async () => {
    const hilos = await hilosDeInstagram(
      await zipDePrueba([...ENTRADAS, [`${BASE}/inbox/rota_8871234/message_1.json`, "{no es json"]])
    );
    /* Se queda con el nombre de la carpeta, sin el identificador que le pega
       Instagram, en vez de desaparecer. */
    expect(hilos.map((h) => h.nombre)).toContain("rota");
  });

  it("un zip de WhatsApp no tiene conversaciones que elegir", async () => {
    const hilos = await hilosDeInstagram(
      await zipDePrueba([["WhatsApp Chat - Ana/_chat.txt", "[1/1/26, 10:00:00] Ana: hola"]])
    );
    expect(hilos).toEqual([]);
  });
});

describe("al subir la conversación elegida", () => {
  it("no se cifra nada de las demás", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const zip = await zipDePrueba(ENTRADAS);

    const hilos = await hilosDeInstagram(zip);
    const ana = hilos.find((h) => h.nombre === "Ana García")!;

    const backupId = newId();
    const objetos = new Map<string, Blob>();
    const { manifest } = await uploadBackup(zip, dek, "Ana García", {
      backupId,
      sinWorker: true,
      soloPrefijo: ana.prefijo,
      subirPieza: async (id, blob) => {
        objetos.set(piecePath(UID, backupId, id), blob);
      },
      subirManifiesto: async (blob) => {
        objetos.set(manifestPath(UID, backupId), blob);
      },
    });

    /* Dos piezas: el json y la foto. Las otras conversaciones ni se tocan. */
    expect(manifest.pieces).toHaveLength(2);
    for (const pieza of manifest.pieces) {
      expect(pieza.name).toContain("anagarcia_1182939");
      expect(pieza.name).not.toContain("beto_99");
      expect(pieza.name).not.toContain("martin_77");
    }

    const leido = await openManifest(objetos.get(manifestPath(UID, backupId))!, dek, backupId);
    expect(leido.source).toBe("instagram");
    expect(findChatPieces(leido)).toHaveLength(1);
    expect(indexByName(leido).get("gato.jpg")).toBeTruthy();
  });

  it("sin elegir nada se sube todo, que es lo que hace WhatsApp", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const zip = await zipDePrueba(ENTRADAS);

    const backupId = newId();
    const { manifest } = await uploadBackup(zip, dek, "todo.zip", {
      backupId,
      sinWorker: true,
      subirPieza: async () => {},
      subirManifiesto: async () => {},
    });

    expect(manifest.pieces).toHaveLength(ENTRADAS.length);
  });

  it("el progreso cuenta solo lo que se va a cifrar", async () => {
    const { dek } = await createVault("contraseña-de-prueba-larga");
    const zip = await zipDePrueba(ENTRADAS);
    const hilos = await hilosDeInstagram(zip);
    const beto = hilos.find((h) => h.nombre === "Beto")!;

    const avance: number[] = [];
    await uploadBackup(zip, dek, "Beto", {
      backupId: newId(),
      sinWorker: true,
      soloPrefijo: beto.prefijo,
      subirPieza: async () => {},
      subirManifiesto: async () => {},
      onProgreso: (p) => avance.push(p),
    });

    /* Si el total contara las entradas de las otras conversaciones, la barra
       se quedaría a un cuarto y parecería colgada. */
    expect(avance.at(-1)).toBe(100);
  });
});
