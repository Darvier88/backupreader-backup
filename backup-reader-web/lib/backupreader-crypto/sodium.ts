import sodium from "libsodium-wrappers-sumo";

/**
 * Devuelve la instancia de libsodium ya inicializada.
 * Usa la build "sumo" porque incluye Argon2id (crypto_pwhash), que la
 * estándar no trae.
 */
let readyPromise: Promise<typeof sodium> | null = null;

export function getSodium(): Promise<typeof sodium> {
  if (!readyPromise) {
    readyPromise = sodium.ready.then(() => sodium);
  }
  return readyPromise;
}

// --- Helpers base64 (para serializar salts, nonces y envoltorios) ---
export function toB64(s: typeof sodium, u: Uint8Array): string {
  return s.to_base64(u, s.base64_variants.ORIGINAL);
}
export function fromB64(s: typeof sodium, b: string): Uint8Array {
  return s.from_base64(b, s.base64_variants.ORIGINAL);
}

/**
 * Borra una clave de memoria en cuanto deja de usarse.
 *
 * No es una garantía fuerte en JavaScript (el GC pudo copiar el buffer antes),
 * pero acorta la ventana en que la DEK o una KEK quedan legibles en un volcado
 * de memoria o en un heap snapshot de las devtools. Es barato, así que se hace.
 */
export async function wipe(...keys: Array<Uint8Array | null | undefined>): Promise<void> {
  const s = await getSodium();
  for (const k of keys) {
    if (k && k.length) {
      try {
        s.memzero(k);
      } catch {
        k.fill(0); // respaldo por si memzero no está disponible
      }
    }
  }
}
