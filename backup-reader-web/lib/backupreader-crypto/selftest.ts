import { getSodium } from "./sodium";
import { encryptFile, decryptFile } from "./fileCipher";
import { createVault, unlockWithPassword, unlockWithRecovery, changePassword, normalizeRecovery } from "./vault";
import { packPiece, unpackPiece, openPiece, normalizeName } from "./manifest";
import { CHUNK_SIZE } from "./constants";
import { pieceAad } from "./paths";

/**
 * Pruebas de regresión del núcleo criptográfico.
 *
 * Cubren en particular los casos que fallaban antes de la Etapa 1: archivo
 * vacío, bordes exactos del tamaño de bloque, mime type que se perdía, y
 * ahora también el amarre por AAD.
 *
 * Se ejecuta desde vitest (tests/crypto/selftest.test.ts) y desde la página
 * de medición en el navegador:
 *   const r = await runSelfTest(); console.table(r);
 */

export interface SelfTestResult {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

async function check(
  name: string,
  fn: () => Promise<string>
): Promise<SelfTestResult> {
  const t0 = performance.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      ms: Math.round(performance.now() - t0),
    };
  }
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) {
    crypto.getRandomValues(b.subarray(i, Math.min(i + 65536, n)));
  }
  return b;
}

/**
 * Huella del contenido, para comprobar que el round-trip no lo altera.
 *
 * Usa SHA-256 cuando hay contexto seguro. Sobre HTTP en una IP de red local
 * —como al abrir el banco de pruebas desde el móvil— `crypto.subtle` no
 * existe, así que cae a un checksum simple: aquí solo hace falta detectar
 * diferencias entre dos buffers, no resistir ataques.
 */
async function sha256(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (crypto?.subtle?.digest) {
    const d = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 16777619) >>> 0;
    h2 = Math.imul(h2 + bytes[i] + i, 2246822519) >>> 0;
  }
  return `${bytes.length}-${h1.toString(16)}-${h2.toString(16)}`;
}

/** Cifra y descifra un buffer, verificando el hash. */
async function roundTrip(bytes: Uint8Array, dek: Uint8Array, mime = "application/octet-stream") {
  const original = new Blob([bytes as BlobPart], { type: mime });
  const enc = await encryptFile(original, dek);
  const packed = packPiece(enc);
  const out = await openPiece(packed, dek, { mime });

  if (out.size !== original.size) {
    throw new Error(`tamaño distinto: ${out.size} vs ${original.size}`);
  }
  const [a, b] = await Promise.all([sha256(original), sha256(out)]);
  if (a !== b) throw new Error("el hash no coincide tras el round-trip");
  if (out.type !== mime) throw new Error(`mime perdido: "${out.type}" en vez de "${mime}"`);
  return out;
}

export async function runSelfTest(): Promise<SelfTestResult[]> {
  const s = await getSodium();
  const dek = s.randombytes_buf(s.crypto_secretbox_KEYBYTES);
  const results: SelfTestResult[] = [];

  // --- Bordes de tamaño (el caso vacío era un bug real) ---

  results.push(
    await check("archivo vacío (0 bytes)", async () => {
      const out = await roundTrip(new Uint8Array(0), dek);
      return `${out.size} bytes, round-trip ok`;
    })
  );

  results.push(
    await check("archivo de 1 byte", async () => {
      await roundTrip(randomBytes(1), dek);
      return "ok";
    })
  );

  results.push(
    await check("exactamente un bloque (64 KiB)", async () => {
      await roundTrip(randomBytes(CHUNK_SIZE), dek);
      return "ok";
    })
  );

  results.push(
    await check("un bloque + 1 byte", async () => {
      await roundTrip(randomBytes(CHUNK_SIZE + 1), dek);
      return "ok";
    })
  );

  results.push(
    await check("varios bloques (5 MiB)", async () => {
      const out = await roundTrip(randomBytes(5 * 1024 * 1024), dek);
      return `${(out.size / 1024 / 1024).toFixed(1)} MiB ok`;
    })
  );

  // --- Mime type (se perdía en zipStream) ---

  results.push(
    await check("el mime type sobrevive", async () => {
      const out = await roundTrip(randomBytes(1024), dek, "image/jpeg");
      return `type = "${out.type}"`;
    })
  );

  // --- Integridad ---

  results.push(
    await check("un ciphertext truncado se detecta", async () => {
      const enc = await encryptFile(new Blob([randomBytes(200 * 1024) as BlobPart]), dek);
      const cortado = enc.ciphertext.slice(0, enc.ciphertext.size - 100);
      try {
        await decryptFile(enc.header, cortado, dek);
      } catch {
        return "rechazado como se esperaba";
      }
      throw new Error("aceptó un archivo truncado");
    })
  );

  results.push(
    await check("un byte alterado se detecta", async () => {
      const enc = await encryptFile(new Blob([randomBytes(100 * 1024) as BlobPart]), dek);
      const buf = new Uint8Array(await enc.ciphertext.arrayBuffer());
      buf[Math.floor(buf.length / 2)] ^= 0xff;
      try {
        await decryptFile(enc.header, new Blob([buf as BlobPart]), dek);
      } catch {
        return "rechazado como se esperaba";
      }
      throw new Error("aceptó un ciphertext alterado");
    })
  );

  results.push(
    await check("el AAD impide intercambiar piezas", async () => {
      const aadA = pieceAad("backup-1", "pieza-A");
      const aadB = pieceAad("backup-1", "pieza-B");
      const enc = await encryptFile(new Blob([randomBytes(4096) as BlobPart]), dek, { aad: aadA });
      const { header, ciphertext } = unpackPiece(packPiece(enc));
      try {
        await decryptFile(await header, ciphertext, dek, undefined, { aad: aadB });
      } catch {
        return "descifrar con el id equivocado falla, correcto";
      }
      throw new Error("descifró una pieza con el id de otra");
    })
  );

  // --- Bóveda ---

  results.push(
    await check("bóveda: los dos caminos de desbloqueo", async () => {
      const { record, recoveryCode, dek: d0 } = await createVault("contraseña-de-prueba");
      const d1 = await unlockWithPassword(record, "contraseña-de-prueba");
      const d2 = await unlockWithRecovery(record, recoveryCode);
      const mala = await unlockWithPassword(record, "contraseña-incorrecta");
      if (!d1 || !d2) throw new Error("un camino de desbloqueo devolvió null");
      if (mala) throw new Error("aceptó una contraseña incorrecta");
      if (s.to_base64(d1) !== s.to_base64(d0)) throw new Error("la DEK por contraseña no coincide");
      if (s.to_base64(d2) !== s.to_base64(d0)) throw new Error("la DEK por código no coincide");
      return "contraseña y código devuelven la misma DEK";
    })
  );

  results.push(
    await check("cambiar contraseña conserva la DEK", async () => {
      const { record, dek: d0 } = await createVault("vieja");
      const nuevo = await changePassword(record, d0, "nueva");
      const d1 = await unlockWithPassword(nuevo, "nueva");
      const vieja = await unlockWithPassword(nuevo, "vieja");
      if (!d1) throw new Error("no abrió con la contraseña nueva");
      if (vieja) throw new Error("la contraseña vieja todavía abre");
      if (s.to_base64(d1) !== s.to_base64(d0)) throw new Error("la DEK cambió");
      return "la DEK sobrevive, la contraseña vieja ya no sirve";
    })
  );

  results.push(
    await check("bóveda: parámetros de KDF del record", async () => {
      const { record, recoveryCode } = await createVault("x");
      // Simula un record escrito con parámetros distintos a la constante actual.
      const bajado = { ...record, kdf: { ...record.kdf, ops: 1, memMiB: 1 } };
      const d = await unlockWithRecovery(bajado, recoveryCode);
      // Con el piso aplicado, esos parámetros degradados NO deben abrir la bóveda.
      if (d) throw new Error("aceptó parámetros de KDF degradados");
      return "los parámetros degradados quedan acotados por el piso";
    })
  );

  results.push(
    await check("código de recuperación: caracteres ambiguos", async () => {
      const { record, recoveryCode } = await createVault("y");
      const confuso = recoveryCode.replace(/O/g, "0").replace(/I/g, "1").replace(/B/g, "8");
      const d = await unlockWithRecovery(record, confuso.toLowerCase());
      if (!d) throw new Error("no aceptó el código con 0/1/8 en vez de O/I/B");
      if (normalizeRecovery(confuso) !== normalizeRecovery(recoveryCode)) {
        throw new Error("la normalización no es estable");
      }
      return "0→O, 1→I, 8→B y minúsculas funcionan";
    })
  );

  // --- Índice de nombres ---

  results.push(
    await check("normalizeName limpia rutas e invisibles", async () => {
      const casos: Array<[string, string]> = [
        ["WhatsApp Chat - X/IMG-0003.jpg", "img-0003.jpg"],
        ["\u200eIMG-0003.JPG", "img-0003.jpg"],
        ["carpeta/sub/AUDIO-01.opus", "audio-01.opus"],
      ];
      for (const [entrada, esperado] of casos) {
        const salida = normalizeName(entrada);
        if (salida !== esperado) throw new Error(`"${entrada}" → "${salida}", se esperaba "${esperado}"`);
      }
      return `${casos.length} casos ok`;
    })
  );

  return results;
}