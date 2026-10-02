import { getSodium, toB64, fromB64, wipe } from "./sodium";
import { KDF, KDF_LIMITS, VAULT_VERSION } from "./constants";
import type { CreatedVault, KdfParams, VaultRecord, WrappedKey } from "./types";

/**
 * Envelope encryption (KEK / DEK).
 *
 *  - La contraseña (o el código de recuperación) deriva una KEK con Argon2id.
 *  - Se genera una DEK aleatoria: es la clave que cifra los datos.
 *  - La KEK solo ENVUELVE (cifra) la DEK, no los datos.
 *
 * Ventaja: cambiar la contraseña solo re-envuelve la DEK (unos bytes), sin
 * re-cifrar todos los chats. Y el código de recuperación envuelve una segunda
 * copia de la misma DEK.
 */

/**
 * Acota los parámetros de KDF que vienen en el record.
 *
 * El record lo entrega el servidor. El piso impide que un servidor malicioso
 * mande ops=1, mem=8KiB y convierta la contraseña en algo rompible por fuerza
 * bruta; el techo impide que mande mem=4GiB y tumbe la pestaña.
 */
function clampKdf(params: KdfParams | undefined): { opsLimit: number; memLimit: number } {
  if (!params || params.alg !== "argon2id") {
    // Record sin parámetros (o de un algoritmo desconocido): usar los de Fase 0.
    return { opsLimit: KDF.opsLimit, memLimit: KDF.memLimit };
  }
  const memBytes = params.memMiB * 1024 * 1024;
  const ops = Math.min(Math.max(params.ops, KDF_LIMITS.minOps), KDF_LIMITS.maxOps);
  const mem = Math.min(Math.max(memBytes, KDF_LIMITS.minMem), KDF_LIMITS.maxMem);
  return { opsLimit: ops, memLimit: mem };
}

// Deriva una clave de 32 bytes desde un secreto (contraseña/código) + salt.
async function deriveKEK(
  secret: string,
  salt: Uint8Array,
  params: { opsLimit: number; memLimit: number }
): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_pwhash(
    s.crypto_secretbox_KEYBYTES,
    s.from_string(secret),
    salt,
    params.opsLimit,
    params.memLimit,
    s.crypto_pwhash_ALG_ARGON2ID13
  );
}

// Envuelve (cifra) la DEK con una KEK → {nonce, ciphertext}.
async function wrap(dek: Uint8Array, kek: Uint8Array): Promise<WrappedKey> {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const ct = s.crypto_secretbox_easy(dek, nonce, kek);
  return { n: toB64(s, nonce), c: toB64(s, ct) };
}

// Desenvuelve la DEK; devuelve null si la clave (contraseña/código) es incorrecta.
async function unwrap(w: WrappedKey, kek: Uint8Array): Promise<Uint8Array | null> {
  const s = await getSodium();
  try {
    return s.crypto_secretbox_open_easy(fromB64(s, w.c), fromB64(s, w.n), kek);
  } catch {
    return null;
  }
}

/** Genera un código de recuperación legible (base32 A-Z2-7, en grupos de 4). */
export async function generateRecoveryCode(): Promise<string> {
  const s = await getSodium();
  const bytes = s.randombytes_buf(20); // 160 bits de entropía
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += A[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += A[(val << (5 - bits)) & 31];
  return (out.match(/.{1,4}/g) || [out]).join("-");
}

/**
 * Normaliza el código de recuperación tal como lo escribe el usuario.
 *
 * El alfabeto base32 no tiene 0, 1 ni 8, así que si alguien copia a mano y
 * escribe un cero por una O, antes se borraba en silencio y el código quedaba
 * más corto: el desbloqueo fallaba sin pista de por qué. Ahora se mapean los
 * ambiguos antes de filtrar.
 */
export function normalizeRecovery(code: string): string {
  return (code || "")
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/8/g, "B")
    .replace(/[^A-Z2-7]/g, "");
}

/**
 * Registro: crea la cuenta cifrada.
 * Devuelve { record } (para guardar en el servidor), { recoveryCode } (mostrar
 * UNA vez) y { dek } (en memoria, para cifrar/descifrar en esta sesión).
 */
export async function createVault(password: string): Promise<CreatedVault> {
  const s = await getSodium();
  const pwSalt = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  const recSalt = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  const recoveryCode = await generateRecoveryCode();
  const dek = s.randombytes_buf(s.crypto_secretbox_KEYBYTES); // clave de datos aleatoria

  const params = { opsLimit: KDF.opsLimit, memLimit: KDF.memLimit };
  const kekPw = await deriveKEK(password, pwSalt, params);
  const kekRec = await deriveKEK(normalizeRecovery(recoveryCode), recSalt, params);

  const record: VaultRecord = {
    version: VAULT_VERSION,
    kdf: { alg: "argon2id", memMiB: KDF.memLimit / (1024 * 1024), ops: KDF.opsLimit },
    pwSalt: toB64(s, pwSalt),
    recSalt: toB64(s, recSalt),
    wrapPassword: await wrap(dek, kekPw),
    wrapRecovery: await wrap(dek, kekRec),
  };

  await wipe(kekPw, kekRec);
  return { record, recoveryCode, dek };
}

/** Desbloquea con la contraseña. Devuelve la DEK, o null si es incorrecta. */
export async function unlockWithPassword(
  record: VaultRecord,
  password: string
): Promise<Uint8Array | null> {
  const s = await getSodium();
  // Los parámetros salen del RECORD, no de la constante: así subir el KDF en el
  // futuro no deja fuera a las bóvedas ya creadas.
  const kek = await deriveKEK(password, fromB64(s, record.pwSalt), clampKdf(record.kdf));
  const dek = await unwrap(record.wrapPassword, kek);
  await wipe(kek);
  return dek;
}

/** Desbloquea con el código de recuperación. Devuelve la DEK, o null si es incorrecto. */
export async function unlockWithRecovery(
  record: VaultRecord,
  recoveryCode: string
): Promise<Uint8Array | null> {
  const s = await getSodium();
  const kek = await deriveKEK(
    normalizeRecovery(recoveryCode),
    fromB64(s, record.recSalt),
    clampKdf(record.kdf)
  );
  const dek = await unwrap(record.wrapRecovery, kek);
  await wipe(kek);
  return dek;
}

/**
 * Cambia la contraseña sin re-cifrar los datos: solo re-envuelve la DEK.
 * Requiere la DEK (obtenida al desbloquear). Devuelve el record actualizado.
 *
 * Aprovecha para subir el record a los parámetros de KDF actuales.
 */
export async function changePassword(
  record: VaultRecord,
  dek: Uint8Array,
  newPassword: string
): Promise<VaultRecord> {
  const s = await getSodium();
  const pwSalt = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  const params = { opsLimit: KDF.opsLimit, memLimit: KDF.memLimit };
  const kek = await deriveKEK(newPassword, pwSalt, params);
  const updated: VaultRecord = {
    ...record,
    kdf: { alg: "argon2id", memMiB: KDF.memLimit / (1024 * 1024), ops: KDF.opsLimit },
    pwSalt: toB64(s, pwSalt),
    wrapPassword: await wrap(dek, kek),
  };
  await wipe(kek);
  return updated;
}

/** Regenera el código de recuperación (p. ej. si el usuario lo perdió pero está desbloqueado). */
export async function resetRecoveryCode(
  record: VaultRecord,
  dek: Uint8Array
): Promise<{ record: VaultRecord; recoveryCode: string }> {
  const s = await getSodium();
  const recSalt = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  const recoveryCode = await generateRecoveryCode();
  const kek = await deriveKEK(
    normalizeRecovery(recoveryCode),
    recSalt,
    { opsLimit: KDF.opsLimit, memLimit: KDF.memLimit }
  );
  const updated = {
    record: { ...record, recSalt: toB64(s, recSalt), wrapRecovery: await wrap(dek, kek) },
    recoveryCode,
  };
  await wipe(kek);
  return updated;
}

/** Cierra la sesión criptográfica: borra la DEK de memoria. */
export async function lockVault(dek: Uint8Array | null): Promise<void> {
  await wipe(dek);
}
