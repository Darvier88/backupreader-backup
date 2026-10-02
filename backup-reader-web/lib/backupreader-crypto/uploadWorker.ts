/// <reference lib="webworker" />

import { processBackupZip } from "./processBackup";
import type { PieceMeta } from "./types";

/**
 * Worker de cifrado.
 *
 * Descomprime el zip y cifra cada pieza fuera del hilo principal, para que la
 * interfaz siga respondiendo mientras se procesa un backup grande. Sin esto,
 * cifrar un vídeo de 50 MB congela la pantalla ~750 ms justo cuando el usuario
 * está mirando la barra de progreso.
 *
 * Control de flujo: el worker NO sigue con la pieza siguiente hasta que el
 * hilo principal confirma que subió la anterior. Sin esa confirmación, el
 * worker corre mucho más rápido que la red y acumula en memoria decenas de
 * piezas cifradas esperando subida.
 */

type MensajeEntrada =
  | { tipo: "empezar"; zipFile: Blob; dek: Uint8Array; backupId: string }
  | { tipo: "ack" }
  | { tipo: "cancelar" };

export type MensajeSalida =
  | { tipo: "pieza"; meta: PieceMeta; blob: Blob }
  | { tipo: "omitida"; name: string; motivo: string }
  | { tipo: "progreso"; hechas: number; total: number }
  | { tipo: "fin" }
  | { tipo: "error"; mensaje: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Espera el ack del hilo principal antes de continuar. */
let resolverAck: (() => void) | null = null;
let cancelado = false;

const esperarAck = () =>
  new Promise<void>((resolve) => {
    resolverAck = resolve;
  });

ctx.addEventListener("message", async (ev: MessageEvent<MensajeEntrada>) => {
  const msg = ev.data;

  if (msg.tipo === "ack") {
    resolverAck?.();
    resolverAck = null;
    return;
  }

  if (msg.tipo === "cancelar") {
    cancelado = true;
    resolverAck?.();
    return;
  }

  if (msg.tipo !== "empezar") return;

  try {
    const { zipFile, dek, backupId } = msg;

    for await (const r of processBackupZip(zipFile, dek, {
      backupId,
      onProgress: (hechas, total) =>
        ctx.postMessage({ tipo: "progreso", hechas, total } as MensajeSalida),
      onEncrypted: async ({ id, name, kind, encrypted }) => {
        if (cancelado) return;

        const blob = new Blob([encrypted.header as BlobPart, encrypted.ciphertext]);
        const meta: PieceMeta = {
          id,
          name,
          kind,
          mime: encrypted.mimeType,
          size: encrypted.size,
          cipherSize: encrypted.cipherSize,
        };

        ctx.postMessage({ tipo: "pieza", meta, blob } as MensajeSalida);
        await esperarAck();
      },
    })) {
      if (cancelado) break;
      if (r.status !== "encrypted") {
        ctx.postMessage({
          tipo: "omitida",
          name: r.name,
          motivo: r.error || r.status,
        } as MensajeSalida);
      }
    }

    ctx.postMessage({ tipo: "fin" } as MensajeSalida);
  } catch (err) {
    ctx.postMessage({
      tipo: "error",
      mensaje: err instanceof Error ? err.message : String(err),
    } as MensajeSalida);
  }
});
