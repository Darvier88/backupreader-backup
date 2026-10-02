import { processBackupZip } from "./processBackup";
import { buildManifest, packPiece, packManifest, cipherBytes } from "./manifest";
import type { BackupManifest, BackupSource, PieceMeta } from "./types";
import type { MensajeSalida } from "./uploadWorker";

/**
 * Orquestador de la subida cifrada.
 *
 * Separa QUÉ se cifra (esto) de DÓNDE se sube (el callback `subirPieza`), para
 * que el módulo no dependa de Firebase y se pueda probar contra un almacén
 * falso en memoria.
 */

export interface SubidaOpciones {
  /**
   * Id del backup. OBLIGATORIO y generado por quien llama (con `newId()`).
   *
   * Va aquí y no se genera dentro a propósito: las rutas de Storage lo
   * necesitan DENTRO de `subirPieza`, que corre mientras `uploadBackup` todavía
   * no ha devuelto nada. Generarlo dentro obligaba a leerlo del resultado, que
   * en ese momento aún no existe.
   */
  backupId: string;
  /** Sube una pieza ya cifrada. Debe resolver cuando esté realmente subida. */
  subirPieza: (id: string, blob: Blob) => Promise<void>;
  /** Sube el manifiesto cifrado. */
  subirManifiesto: (blob: Blob) => Promise<void>;
  /** Progreso 0..100. */
  onProgreso?: (pct: number) => void;
  /** Piezas que no se pudieron cifrar (demasiado grandes o con error). */
  onOmitida?: (name: string, motivo: string) => void;
  /** Fuerza la vía sin worker. Solo para pruebas. */
  sinWorker?: boolean;
}

export interface SubidaResultado {
  backupId: string;
  manifest: BackupManifest;
  omitidas: Array<{ name: string; motivo: string }>;
}

/** Deduce el origen a partir del nombre del archivo. */
export function detectarOrigen(nombreArchivo: string): BackupSource {
  if (nombreArchivo.includes("WhatsApp")) return "whatsapp";
  if (nombreArchivo.toLowerCase().includes("instagram")) return "instagram";
  return "other";
}

/**
 * Cifra y sube un backup completo.
 *
 * Orden importante: primero todas las piezas, después el manifiesto, y el
 * documento de Firestore lo escribe quien llama, AL FINAL. Así, si la subida
 * se corta a la mitad, el backup simplemente no aparece en la lista y lo que
 * queda en Storage son blobs huérfanos. Nunca se muestra un backup que no se
 * pueda abrir.
 */
export async function uploadBackup(
  zipFile: File | Blob,
  dek: Uint8Array,
  nombre: string,
  opts: SubidaOpciones
): Promise<SubidaResultado> {
  const { backupId } = opts;
  const piezas: PieceMeta[] = [];
  const omitidas: Array<{ name: string; motivo: string }> = [];

  const anotarOmitida = (name: string, motivo: string) => {
    omitidas.push({ name, motivo });
    opts.onOmitida?.(name, motivo);
  };

  const usarWorker =
    !opts.sinWorker && typeof Worker !== "undefined" && typeof window !== "undefined";

  if (usarWorker) {
    try {
      await procesarConWorker(zipFile, dek, backupId, piezas, anotarOmitida, opts);
    } catch (err) {
      // Si el worker no arranca (bundler, CSP, navegador viejo), se sigue en el
      // hilo principal: la interfaz se atasca un poco, pero la subida funciona.
      console.warn("Worker no disponible, cifrando en el hilo principal:", err);
      piezas.length = 0;
      await procesarEnHilo(zipFile, dek, backupId, piezas, anotarOmitida, opts);
    }
  } else {
    await procesarEnHilo(zipFile, dek, backupId, piezas, anotarOmitida, opts);
  }

  const manifest = buildManifest({
    backupId,
    name: nombre,
    source: detectarOrigen(nombre),
    pieces: piezas,
  });

  await opts.subirManifiesto(await packManifest(manifest, dek));

  return { backupId, manifest, omitidas };
}

// --- Vía con worker ---

function procesarConWorker(
  zipFile: File | Blob,
  dek: Uint8Array,
  backupId: string,
  piezas: PieceMeta[],
  anotarOmitida: (n: string, m: string) => void,
  opts: SubidaOpciones
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./uploadWorker.ts", import.meta.url), {
      type: "module",
    });

    // Cola serializada: las subidas van de una en una y el worker espera el ack.
    let cadena: Promise<void> = Promise.resolve();

    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "fallo del worker"));
    };

    worker.onmessage = (ev: MessageEvent<MensajeSalida>) => {
      const msg = ev.data;

      switch (msg.tipo) {
        case "pieza":
          cadena = cadena
            .then(() => opts.subirPieza(msg.meta.id, msg.blob))
            .then(() => {
              piezas.push(msg.meta);
              worker.postMessage({ tipo: "ack" });
            })
            .catch((err) => {
              worker.postMessage({ tipo: "cancelar" });
              worker.terminate();
              reject(err);
            });
          break;

        case "omitida":
          anotarOmitida(msg.name, msg.motivo);
          break;

        case "progreso":
          opts.onProgreso?.(msg.total ? (msg.hechas / msg.total) * 100 : 0);
          break;

        case "fin":
          cadena.then(() => {
            worker.terminate();
            resolve();
          });
          break;

        case "error":
          worker.terminate();
          reject(new Error(msg.mensaje));
          break;
      }
    };

    worker.postMessage({ tipo: "empezar", zipFile, dek, backupId });
  });
}

// --- Vía sin worker (respaldo y pruebas) ---

async function procesarEnHilo(
  zipFile: File | Blob,
  dek: Uint8Array,
  backupId: string,
  piezas: PieceMeta[],
  anotarOmitida: (n: string, m: string) => void,
  opts: SubidaOpciones
): Promise<void> {
  for await (const r of processBackupZip(zipFile, dek, {
    backupId,
    onProgress: (hechas, total) =>
      opts.onProgreso?.(total ? (hechas / total) * 100 : 0),
    onEncrypted: async ({ id, name, kind, encrypted }) => {
      await opts.subirPieza(id, packPiece(encrypted));
      piezas.push({
        id,
        name,
        kind,
        mime: encrypted.mimeType,
        size: encrypted.size,
        cipherSize: encrypted.cipherSize,
      });
    },
  })) {
    if (r.status !== "encrypted") {
      anotarOmitida(r.name, r.error || r.status);
    }
  }
}

export { cipherBytes };
