# Backup Reader · Modelo de datos cifrados (Etapa 2)

Formato v1 · Este documento congela las decisiones. Cambiarlas después de tener
datos de usuarios cifrados es caro, así que lo que esté aquí se respeta o se
sube `FORMAT_VERSION`.

---

## El problema que resuelve

Hoy la app encuentra los archivos listando Storage y armando rutas con el
nombre real:

```
backups/{uid}/whatsapp/WhatsApp Chat - María Pérez Sep 2025/IMG-20240101-WA0003.jpg
```

Eso tiene dos consecuencias. La primera es que el servidor ve con quién chatea
el usuario, cuántas fotos tiene y cuándo: subir blobs cifrados a esas mismas
rutas no sería E2EE defendible, porque lo más sensible de un backup de WhatsApp
es justamente con quién hablas. La segunda es que si le pones nombres
aleatorios a los blobs para arreglar lo anterior, la app pierde la única forma
que tenía de encontrarlos.

De ahí sale el manifiesto: es lo que traduce `IMG-20240101-WA0003.jpg` al blob
opaco que hay que descargar, y va cifrado con la misma DEK que todo lo demás.

---

## Distribución en Storage

```
backups/{uid}/{backupId}/manifest        JSON del manifiesto, cifrado
backups/{uid}/{backupId}/p/{pieceId}     una pieza cifrada, sin extensión
```

`backupId` y `pieceId` son UUID v4 (`crypto.randomUUID()`). Sin extensión y sin
nada derivado del nombre real.

El prefijo `{uid}` se mantiene en claro a propósito: es lo que usan las reglas
de Storage para decidir el dueño, y lo que usa la cuota de almacenamiento. El
servidor ya sabe de qué usuario es cada archivo (lo subió autenticado), así que
ocultarlo no compraría nada.

Cada objeto es **un solo blob**: `header || ciphertext`, con la cabecera de
secretstream ocupando los primeros 24 bytes (`HEADER_BYTES`). No se guarda la
cabecera en un campo aparte ni se suben dos objetos por archivo.

Content-type siempre `application/octet-stream`. No es cosmético: la Cloud
Function `unzip` filtra por `application/zip`, así que este content-type ya la
desactiva para las subidas nuevas sin tener que desplegar nada.

### Lo que el servidor puede deducir de todos modos

Vale la pena tenerlo escrito, porque "E2EE" no significa "invisible":

- cuántos backups tiene el usuario y cuándo los subió
- cuántas piezas tiene cada backup y el tamaño de cada una
- el patrón de acceso (qué blobs descarga y cuándo)

Lo que **no** puede deducir: nombres de chats, nombres de contactos, nombres de
archivo, tipos de archivo, contenido de mensajes, ni qué pieza es el chat y
cuál una foto.

El tamaño de cada pieza sigue filtrando algo (una pieza de 40 KB es
probablemente un audio, una de 3 MB una foto). Rellenar a bloques fijos lo
taparía, a costa de almacenamiento. Decisión: **no se hace en v1**. Si algún
día importa, se sube `FORMAT_VERSION` y se añade padding.

---

## Distribución en Firestore

```
vaults/{uid}                       VaultRecord (salts + envoltorios)
vaults/{uid}/backups/{backupId}    metadatos no sensibles del backup
```

`vaults/{uid}` es el `VaultRecord` tal cual: versión, parámetros de KDF, los dos
salts y los dos envoltorios de la DEK. Nunca la contraseña, nunca el código de
recuperación, nunca la DEK.

`vaults/{uid}/backups/{backupId}` lleva **solo**:

```ts
{ createdAt, pieceCount, cipherBytes, encVersion: 2, fmt: 1 }
```

Deliberadamente sin nombre. El nombre del chat es el dato más sensible del
backup y vive dentro del manifiesto cifrado. Esto tiene una consecuencia de
interfaz que hay que asumir: **la barra lateral de chats no se puede pintar sin
desbloquear la bóveda**, porque los nombres no existen en claro en ningún lado.
Antes de desbloquear solo se puede mostrar "3 backups, 1.2 GB".

### Por qué el índice de piezas no va en Firestore

Un chat con 3 000 fotos serían 3 000 documentos y 3 000 lecturas cada vez que
alguien abre el chat. El manifiesto es una sola descarga de Storage de unos
pocos cientos de KB. También evita que Firestore vea el conteo exacto por tipo.

---

## El manifiesto

Se guarda cifrado en `backups/{uid}/{backupId}/manifest`. En claro es:

```ts
{
  fmt: 1,                    // FORMAT_VERSION con el que se escribió
  blockSize: 65536,          // tamaño de bloque usado al cifrar
  backupId: "3f2a…",
  name: "WhatsApp Chat - María Pérez",
  source: "whatsapp",        // whatsapp | instagram | other
  createdAt: 1758600000000,
  pieces: [
    { id: "8f3a…", name: "_chat.txt", kind: "chat",
      mime: "text/plain; charset=utf-8", size: 184320, cipherSize: 184600 },
    { id: "b01c…", name: "IMG-20240101-WA0003.jpg", kind: "image",
      mime: "image/jpeg", size: 2458112, cipherSize: 2458900 },
  ]
}
```

`fmt` y `blockSize` van dentro a propósito. Antes el tamaño de bloque estaba
implícito en `decryptFile`: el día que se cambiara, los archivos viejos habrían
dejado de descifrarse sin forma de saber por qué. Ahora se lee del manifiesto.

Al abrir un manifiesto con `fmt` mayor al que entiende la app, se muestra
"actualiza la página" en vez de fallar con un error críptico.

---

## Amarre por AAD

Cada pieza se cifra con datos asociados autenticados:

```
pieza:      br1:{backupId}:{pieceId}
manifiesto: br1:{backupId}:manifest
```

No se cifran, pero quedan autenticados. Si el servidor intercambia el blob de
una pieza por el de otra (aunque sea del mismo usuario y del mismo backup), el
AAD no coincide y el descifrado **falla** en vez de entregar el archivo
equivocado. Cuesta nada y cierra un hueco real: sin esto, un servidor
malicioso podría hacer que la foto que el usuario cree estar viendo sea otra.

El prefijo `br1` es el versionado del esquema de AAD, por si algún día cambia
la forma de las rutas.

---

## Cómo se resuelve la media al leer

Esto reemplaza al `getAsset(fullPath + '/' + nombre)` de hoy.

Al abrir un chat, la app descarga y descifra el manifiesto, y construye un
índice de nombre normalizado a pieza (`indexByName`). Cuando `ChatView`
encuentra una referencia a un archivo en el texto del mensaje, la busca en ese
índice en vez de armar una ruta.

La normalización de nombres tiene que limpiar tres cosas:

1. Las entradas del zip traen la carpeta delante
   (`WhatsApp Chat - X/IMG.jpg`), pero en el texto del chat aparece el nombre
   suelto. Se toma solo el nombre base.
2. WhatsApp mete caracteres invisibles (U+200E y compañía) en las líneas del
   export. Se eliminan.
3. iOS y Android exportan con mayúsculas distintas. Todo a minúsculas.

Ante nombres duplicados dentro de un mismo backup, gana el primero. Es lo mismo
que hacía el comportamiento anterior al listar la carpeta.

---

## Ciclo de vida

**Subida.** Se genera un `backupId`. Por cada pieza del zip: se genera un
`pieceId`, se cifra con su AAD, se sube el blob. Al terminar, se arma el
manifiesto con los metadatos acumulados, se cifra, se sube, y recién entonces
se escribe el documento de Firestore.

El orden importa: **el documento de Firestore se escribe al final**. Así, si la
subida se corta a la mitad, el backup simplemente no aparece en la lista y lo
que quedó en Storage son blobs huérfanos. Nunca se muestra un backup que no se
pueda abrir.

**Limpieza de huérfanos.** Blobs sin documento de Firestore que los referencie.
Como el servidor no puede leer el manifiesto, no puede distinguirlos solo. Se
resuelve con una regla de ciclo de vida en el bucket: borrar objetos bajo
`backups/{uid}/*/p/` con más de N días cuyo backup no tenga documento. En la
práctica basta con que el cliente, al detectar una subida interrumpida, borre el
prefijo antes de reintentar.

**Borrado.** Borrar el backup es borrar el prefijo de Storage y el documento de
Firestore. No hay nada más que limpiar.

**Cuotas.** `cipherBytes` del documento de Firestore, no el cálculo del cliente.
El ciphertext pesa unos 17 bytes más por bloque de 64 KiB, o sea un 0.03% de
sobrecarga: irrelevante para las cuotas de plan.

---

## Convivencia con lo viejo (adelanto de la Etapa 8)

`encVersion` distingue los backups. Los v1 (texto plano, rutas por nombre) se
siguen leyendo exactamente como hoy. Todo lo que se sube desde el deploy es v2.

La regla para que esto no se vuelva un problema: **el branching vive en una sola
función**. Un `loadBackup(backupId)` que devuelve la misma forma para ambas
versiones, y la interfaz nunca se entera. Si el `if (encVersion === 2)` se
filtra a `ChatView` o a los drawers, ya perdimos.

---

## Resumen de decisiones congeladas

| Decisión | Valor | Por qué |
|---|---|---|
| Ids | UUID v4, sin extensión | nada derivado del nombre real |
| Prefijo uid | en claro | lo necesitan las reglas y las cuotas |
| Empaquetado | `header \|\| ciphertext`, un blob | un objeto por archivo |
| Content-type | `application/octet-stream` | desactiva la CF `unzip` sola |
| Índice de piezas | en el manifiesto | 3 000 docs por chat sería absurdo |
| Nombre del chat | solo en el manifiesto | es el dato más sensible |
| AAD | `br1:{backupId}:{pieceId}` | impide intercambio de piezas |
| Padding de tamaños | no en v1 | filtra el tamaño, se asume |
| Orden de escritura | Firestore al final | nunca mostrar un backup ilegible |
