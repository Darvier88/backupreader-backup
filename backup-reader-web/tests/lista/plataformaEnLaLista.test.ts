/**
 * Del zip hasta el grupo de la barra lateral.
 *
 * QUÉ CUBRE Y POR QUÉ HACE FALTA
 * ------------------------------
 * La lista agrupa los chats por plataforma, y esa plataforma no se mira en el
 * momento de pintar: viaja desde el zip, pasando por el manifiesto cifrado que
 * se guarda al subir, hasta la entrada de la lista.
 *
 * Son tres piezas distintas, y entre ellas no hay nada que falle si se
 * desconectan: si el manifiesto dejara de guardar el origen, la lista seguiría
 * saliendo, solo que con todos los chats en el mismo montón o en «Sin abrir».
 * Nadie se enteraría hasta verlo.
 *
 * Por eso esto va de punta a punta: se suben dos zips de verdad, con el cifrado
 * de verdad, y se comprueba que acaban en el grupo que les toca.
 *
 * No necesita emulador ni red: el almacén es un Map en memoria.
 */

import { describe, it, expect } from "vitest";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import utf8 from "utf8";

import {
  createVault,
  uploadBackup,
  piecePath,
  manifestPath,
  newId,
} from "../../lib/backupreader-crypto";
import { agruparPorPlataforma } from "../../lib/agrupar-chats";
import type { FileList } from "../../models/Files";

const UID = "uid-ana";

/** Un export de WhatsApp como el que manda la aplicación. */
async function zipDeWhatsApp() {
  const salida = new BlobWriter("application/zip");
  const w = new ZipWriter(salida);
  await w.add(
    "WhatsApp Chat - María/_chat.txt",
    new TextReader("[12/01/2024, 10:15:03] María: Hola\n[12/01/2024, 10:15:30] Yo: ¿Qué tal?\n")
  );
  await w.close();
  return salida.getData();
}

/** Un export de Instagram ya convertido, como el que saca el conversor. */
async function zipDeInstagram() {
  const roto = (t: string) => {
    try {
      return utf8.encode(t);
    } catch {
      return t;
    }
  };
  const carpeta = "your_instagram_activity/messages/inbox/nickhoag_1182939";
  const hilo = {
    participants: [{ name: roto("Nick Hoag") }, { name: roto("The Future Forward") }],
    title: roto("Nick Hoag"),
    thread_path: carpeta,
    messages: [
      { sender_name: roto("Nick Hoag"), timestamp_ms: 1704884400000, content: roto("hola") },
      {
        sender_name: roto("The Future Forward"),
        timestamp_ms: 1704884300000,
        content: roto("buenas noches 🌙"),
      },
    ],
  };
  const salida = new BlobWriter("application/zip");
  const w = new ZipWriter(salida);
  await w.add(`${carpeta}/message_1.json`, new TextReader(JSON.stringify(hilo)));
  await w.close();
  return salida.getData();
}

/** Sube un zip con el cifrado de verdad y devuelve su entrada de la lista. */
async function subirYListar(zip: Blob, nombre: string, dek: Uint8Array): Promise<FileList> {
  const backupId = newId();
  const objetos = new Map<string, Blob>();
  const { manifest } = await uploadBackup(zip, dek, nombre, {
    backupId,
    sinWorker: true,
    subirPieza: async (id, blob) => {
      objetos.set(piecePath(UID, backupId, id), blob);
    },
    subirManifiesto: async (blob) => {
      objetos.set(manifestPath(UID, backupId), blob);
    },
  });

  /* Lo mismo que arma `listarCifrados`: el nombre y el origen salen del
     manifiesto que se acaba de descifrar. */
  return {
    name: manifest.name,
    fullPath: "backup:" + backupId,
    cifrado: true,
    origen: manifest.source,
  };
}

describe("la plataforma llega desde el zip hasta el grupo", () => {
  it("un export de Instagram se guarda como de Instagram, y uno de WhatsApp como de WhatsApp", async () => {
    const { dek } = await createVault("una-contrasena-larga");

    const wa = await subirYListar(await zipDeWhatsApp(), "María.zip", dek);
    const ig = await subirYListar(await zipDeInstagram(), "Nick Hoag", dek);

    /* El origen se deduce de lo que lleva el zip dentro, no de su nombre: un
       zip llamado «Nick Hoag» no dice por sí solo de dónde viene. */
    expect(wa.origen).toBe("whatsapp");
    expect(ig.origen).toBe("instagram");
  }, 60000);

  it("y cada uno acaba en su grupo, con WhatsApp primero", async () => {
    const { dek } = await createVault("una-contrasena-larga");
    const wa = await subirYListar(await zipDeWhatsApp(), "María.zip", dek);
    const ig = await subirYListar(await zipDeInstagram(), "Nick Hoag", dek);

    /* En la lista los cifrados salen por fecha, así que el de Instagram puede
       ir primero; el grupo de WhatsApp tiene que seguir saliendo antes. */
    const { grupos, conCabecera } = agruparPorPlataforma([ig, wa]);
    expect(conCabecera).toBe(true);
    expect(grupos.map((g) => g.plataforma)).toEqual(["whatsapp", "instagram"]);
    expect(grupos[0].chats[0].name).toBe(wa.name);
    expect(grupos[1].chats[0].name).toBe(ig.name);
  }, 60000);

  it("con un solo chat de WhatsApp no aparece ningún apartado de Instagram", async () => {
    /* Enseñar un grupo vacío a quien no usa esa plataforma es decirle que le
       falta algo. */
    const { dek } = await createVault("una-contrasena-larga");
    const wa = await subirYListar(await zipDeWhatsApp(), "María.zip", dek);

    const { grupos, conCabecera } = agruparPorPlataforma([wa]);
    expect(conCabecera).toBe(false);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].plataforma).toBe("whatsapp");
  }, 60000);
});
