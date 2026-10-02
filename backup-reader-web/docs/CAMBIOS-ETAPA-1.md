# Etapa 1 · Cambios al núcleo criptográfico

Qué cambió respecto de la versión de Fase 0 y cómo comprobarlo.

---

## Bugs corregidos

### 1. Archivos de 0 bytes se cifraban mal (`fileCipher.ts`)

Si `plain.size === 0`, `readBlocks` no producía ningún bloque, así que nunca se
emitía el tag FINAL y el ciphertext quedaba vacío. Lo feo es que el cifrado no
fallaba: el error aparecía al leer, con "falta la marca de bloque final". Los
exports de WhatsApp sí traen entradas vacías de vez en cuando.

Ahora, con tamaño 0 se empuja un bloque vacío con tag FINAL.

### 2. Se perdía el mime type (`zipStream.ts`)

`entry.getData(new BlobWriter())` devolvía un Blob sin tipo, así que
`encryptFile` guardaba `application/octet-stream` para todo. Al reproducir, el
object URL en un `<img>` o un `<video>` no habría renderizado nada.

Ahora se deduce el mime de la extensión (tabla `MIME_BY_EXT`), se pasa al
`BlobWriter` y queda guardado en el manifiesto.

### 3. `record.kdf` se guardaba pero no se leía (`vault.ts`)

`unlockWithPassword` derivaba la KEK con la constante `KDF`, no con los
parámetros del record. Funcionaba porque coincidían; el día que subieras la
memoria a 128 MiB, todas las bóvedas existentes habrían dejado de abrirse.

Ahora se leen del record, acotados por `KDF_LIMITS`: el piso impide que un
servidor malicioso degrade el KDF a algo rompible por fuerza bruta, el techo
impide que mande un `memLimit` absurdo y tumbe la pestaña.

### 4. La salida se acumulaba entera en el heap (`fileCipher.ts`)

La *lectura* sí era en streaming, pero todos los chunks cifrados quedaban en un
array hasta armar el Blob al final. Para 286 MB eso deberían ser ~286 MB de RAM,
no los ~9 MB que dice el README de Fase 0. O la medición midió otra cosa, o el
navegador hizo algo que no se vio.

Ahora un `BlobBuilder` empaca sub-Blobs cada 8 MiB (`BLOB_FLUSH_BYTES`), para
que el navegador pueda respaldarlos en disco. `decryptFile` tenía el mismo
patrón y también está arreglado.

**Vale la pena volver a medir esto en el celular** y actualizar el README con el
número real.

---

## Mejoras

### Amarre por AAD

`encryptFile` y `decryptFile` aceptan `opts.aad`. La app pasa ahí el id de la
pieza, así que el servidor no puede intercambiar el blob de una pieza por el de
otra sin que el descifrado falle. Detalle en `MODELO-DATOS.md`.

### `blockSize` explícito

Antes estaba implícito en `decryptFile`: cambiarlo habría roto los archivos
viejos en silencio. Ahora se pasa como opción y se guarda en el manifiesto.

### El zip se abre una sola vez

`processBackupZip` abría el zip dos veces, una solo para contar las piezas, o
sea leyendo el directorio central por partida doble. Ahora `openZip()` devuelve
el índice completo y se itera una vez.

### Código de recuperación: caracteres ambiguos

El alfabeto base32 no tiene 0, 1 ni 8. Si alguien copiaba a mano y escribía un
cero por una O, `normalizeRecovery` lo borraba en silencio y el código quedaba
corto: el desbloqueo fallaba sin pista. Ahora se mapean `0→O`, `1→I`, `8→B`
antes de filtrar.

### Borrado de claves

`wipe()` (memzero) sobre las KEK después de usarlas, y `lockVault(dek)` para
cerrar sesión. No es garantía fuerte en JavaScript, pero acorta la ventana en
que una clave queda legible en un heap snapshot.

---

## Archivos nuevos

- **`paths.ts`** — rutas de Storage y Firestore, content-type, generación de
  ids y AAD. Punto único de verdad, para que las reglas de Firebase y el código
  no se desincronicen.
- **`manifest.ts`** — empaquetado de piezas, cifrado del manifiesto, índice por
  nombre. Es lo que reemplaza a `getAsset(ruta + nombre)`.
- **`selftest.ts`** — pruebas de regresión.

---

## Cómo probarlo

En el banco de pruebas Vite, añadir un botón:

```ts
import { runSelfTest } from "./backupreader-crypto";

const resultados = await runSelfTest();
console.table(resultados);
```

Cubre: archivo vacío, 1 byte, exactamente 64 KiB, 64 KiB + 1, 5 MiB, mime type,
truncamiento, alteración de un byte, amarre por AAD, los dos caminos de
desbloqueo, cambio de contraseña, parámetros de KDF degradados, código de
recuperación con caracteres ambiguos, y normalización de nombres.

Deben salir **14 en verde**. Hazlo también en el celular antes de cerrar la
etapa: es el entorno donde importa.

Por separado, vuelve a correr la prueba de los 286 MB midiendo la memoria en las
devtools, para confirmar el arreglo del punto 4.

---

## Instalación

Mismas dependencias que antes, no hay nuevas:

```bash
npm i libsodium-wrappers-sumo @zip.js/zip.js
npm i -D @types/libsodium-wrappers-sumo
```

Los archivos van en `lib/backupreader-crypto/` del proyecto Next, y se importan
solo desde componentes de cliente o con `dynamic(..., { ssr: false })`.

Nota de compatibilidad: el proyecto usa TypeScript 4.9. Los casts a `BlobPart`
que verás en un par de sitios son para versiones más nuevas de TS, que
endurecieron los tipos de `Uint8Array`. No hacen falta en 4.9 pero tampoco
molestan.
