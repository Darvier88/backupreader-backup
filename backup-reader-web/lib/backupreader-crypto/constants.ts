/**
 * Constantes del núcleo criptográfico de Backup Reader.
 * Validadas en la Fase 0 (Android) del prototipo.
 */

/** Parámetros de Argon2id para derivar la KEK. m=64 MiB, t=3. */
export const KDF = {
  opsLimit: 3,
  memLimit: 64 * 1024 * 1024, // 64 MiB
} as const;

/**
 * Pisos y techos aceptados al LEER los parámetros de un VaultRecord.
 *
 * El record trae sus propios parámetros de KDF (para que subirlos en el futuro
 * no rompa las bóvedas viejas). Pero ese record viene del servidor, así que hay
 * que acotarlo: el piso evita que un servidor malicioso degrade el KDF a algo
 * que se pueda romper por fuerza bruta, y el techo evita que mande un memLimit
 * absurdo que tumbe la pestaña del navegador.
 */
export const KDF_LIMITS = {
  minOps: 2,
  maxOps: 10,
  minMem: 32 * 1024 * 1024, // 32 MiB
  maxMem: 512 * 1024 * 1024, // 512 MiB
} as const;

/** Tamaño de bloque para el cifrado por streaming (secretstream). */
export const CHUNK_SIZE = 64 * 1024; // 64 KiB

/**
 * Tamaño de la cabecera de crypto_secretstream_xchacha20poly1305.
 * Se exporta porque la app guarda cada pieza como `header || ciphertext` en un
 * solo blob, y al leer necesita saber por dónde cortar.
 */
export const HEADER_BYTES = 24;

/**
 * Cada cuántos bytes de salida se empaca un sub-Blob intermedio.
 *
 * Sin esto, cifrar 300 MB deja 300 MB de Uint8Array vivos en el heap hasta el
 * final. Empacando por tramos, el navegador puede respaldar esos Blobs en disco
 * y el pico de RAM se queda en este valor.
 */
export const BLOB_FLUSH_BYTES = 8 * 1024 * 1024; // 8 MiB

/**
 * Política de tamaños (decisión de diseño):
 *  - Se PUEDE cifrar/guardar hasta 1 GiB por archivo (el cifrado por bloques
 *    mantiene la memoria baja, así que archivos grandes no son problema).
 *  - La REPRODUCCIÓN directa en el navegador se limita a 300 MiB; por encima
 *    se ofrece descargar o reproducir por streaming (Service Worker), porque
 *    meter un archivo enorme en un <video>/<audio> congela la pantalla en móvil.
 *
 * El tope de reproducción es provisional para iOS; se ajustará cuando se
 * pruebe en un iPhone real.
 */
export const MAX_ENCRYPT_BYTES = 1024 * 1024 * 1024; // 1 GiB por archivo
export const INLINE_PLAYBACK_MAX_BYTES = 300 * 1024 * 1024; // 300 MiB

/** Versión del VaultRecord (esquema de claves). */
export const VAULT_VERSION = 1 as const;

/**
 * Versión del FORMATO de los datos cifrados (cómo se empaqueta cada pieza y
 * qué contiene el manifiesto). Se guarda dentro del manifiesto: si algún día
 * cambia CHUNK_SIZE o el empaquetado, los backups viejos se siguen pudiendo
 * leer mirando este número.
 */
export const FORMAT_VERSION = 1 as const;
