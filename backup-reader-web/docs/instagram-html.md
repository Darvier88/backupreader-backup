# Un export de Instagram que vino en HTML

Instagram deja elegir el formato de la descarga de mensajes: **JSON** o
**HTML**. BackupReader lee el de JSON. Si la descarga salió en HTML, la
aplicación lo detecta y no la abre.

## Por qué no se lee el HTML directamente

El export de JSON trae cada mensaje con su autor y su marca de tiempo en un
campo. El de HTML trae páginas para mirar en el navegador: el mismo contenido,
pero envuelto en etiquetas con nombres generados (`_a6-g`, `_a6-p`) que pueden
cambiar de una descarga a otra, y con la fecha escrita en palabras y en el
idioma de la cuenta.

Leerlo dentro de la aplicación significaría que el día que Meta renombre una
clase, las conversaciones de alguien empiecen a salir con mensajes de menos sin
que nada falle. Así que esa parte vive fuera: en una herramienta que se corre a
mano, que dice lo que ha entendido y que se puede volver a correr.

## El conversor

```bash
# Convertir el export entero, con todas sus conversaciones
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip"

# Ver qué hay dentro sin convertir nada
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip" --lista

# Convertir solo algunas (los números que salen en --lista)
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip" --hilo 1,3,7
```

Deja **un** `convertido-<nombre del export>.zip` al lado del original, con todas
las conversaciones dentro. Ese zip es el que se sube a BackupReader: por dentro
tiene la misma estructura que habría tenido la descarga en JSON, así que lo lee
`lib/parsear-instagram.ts`, el parser de siempre, sin ningún camino aparte.

El original no se toca, y el conversor no se conecta a nada: lee el zip que se
le da y escribe otro al lado.

### Uno solo, y no uno por conversación

Porque es lo que hace que el zip convertido sea indistinguible de la descarga
buena. La aplicación ya sabe abrir un export con todas las conversaciones
dentro: las lista, deja elegir y sube **solo** la elegida (`soloPrefijo`). Sacar
368 archivos obligaría a elegir antes, aquí, a ciegas y en una terminal.

Una conversación de la que no se reconoce ningún mensaje no entra en el zip: una
carpeta vacía solo sirve para confundir al elegir. El informe dice cuántas
fueron.

### La lista va por mensajes, no por lo que ocupa el HTML

En un export en HTML casi todas las conversaciones pesan 0,0 MB: el HTML de una
charla de diez mensajes ocupa lo mismo que el de otra de doce, y los dos gigas
del zip están en la media. Por eso la lista lee las páginas y dice cuántos
mensajes tiene cada una, que es lo que hace que alguien reconozca la suya.

El **número** de la lista (lo que se le pasa a `--hilo`) no se ordena por eso,
sino por lo que ocupan las páginas, que es un buen parecido y se sabe sin
leerlas. Tiene que salir igual al listar y al convertir: un número que
significara una cosa en una orden y otra en la siguiente sería una trampa.

### La media puede estar fuera de la carpeta de la conversación

Y esto es lo que obliga a hacer dos cosas.

En un export en JSON, las fotos de una conversación cuelgan de su propia
carpeta. En uno en HTML no tiene por qué: la página puede enlazarlas subiendo
niveles (`../../../media/other/202401/foto.jpg`), con la media en una carpeta
aparte del export. Así que:

1. **Hay que resolver los `..`** en vez de dar por hecho dónde está el archivo,
   o se busca donde no está y el adjunto se queda fuera del zip sin que nadie se
   entere. Si aun así no aparece por su ruta, se busca por el nombre suelto.
2. **La copia va DENTRO de la carpeta de la conversación**, aunque en el export
   estuviera fuera, y las `uri` del JSON se reescriben para que apunten ahí. No
   es por orden: al subir, la aplicación sube solo lo que cuelga del prefijo de
   la conversación elegida (`soloPrefijo`, en `StorageContext`), así que una
   foto guardada en otra carpeta del zip no se subiría y en el chat saldría un
   adjunto que no se puede abrir.

Si una página nombra un archivo que no viene en la descarga, el informe lo dice
(«adjuntos que no están en el zip»): el mensaje sigue apareciendo con su
adjunto, pero no hay archivo que enseñar.

### Lo que la aplicación hace con un export en HTML

Nada: lo detecta (`esInstagramEnHtml`) y lo rechaza, y así se queda. El
conversor vive fuera a propósito, y meterlo dentro cambiaría eso.

Lo que sí hace el aviso es decir **qué hacer**, porque esa descarga ya no sirve
y la siguiente tarda días: nombra dónde está la opción del formato (perfil → Tu
actividad → Descargar tu información) y que se puede pedir solo los mensajes.
Si el aviso no lo dijera, la persona volvería a pedir lo mismo y esperaría otra
vez para nada. `tests/documentos/avisosTraducidos.test.ts` lo vigila, junto con
que ningún aviso se quede sin traducir al inglés.

### Lo que dice el informe

Al convertir, el programa cuenta los mensajes que ha reconocido, y también:

- **sin fecha legible**: bloques en los que la fecha venía en un formato que no
  supo leer. Esos mensajes se quedan junto al anterior en vez de irse al
  principio de la conversación. Si este número no es cero, hay un formato de
  fecha que falta en `fechaEnMs`.
- **sin autor**: normalmente avisos del sistema, que no llevan `<h2>`.

Si una conversación sale con **cero mensajes**, el conversor lo dice y la salta
en vez de escribir un zip vacío.

## Lo que el HTML no trae

- **Segundos.** La fecha llega al minuto, así que dos mensajes del mismo minuto
  comparten marca de tiempo. Se conserva el orden en que venían, que es el que
  tenían.
- **`participants`.** No hay lista de participantes: se arma con quienes
  aparecen firmando mensajes. En un grupo, alguien que se fue sin escribir nada
  no sale.
- **Qué audio era una nota de voz y cuál una canción.** Igual que en el export
  de JSON.

## Las páginas .html no se copian al zip convertido

A propósito, y es lo primero que comprueba la prueba de punta a punta: con una
sola página `.html` que quedara dentro, `esInstagramEnHtml` volvería a dar
positivo y la aplicación rechazaría el zip convertido.

## Dónde está cada cosa

| Archivo | Qué hace |
| --- | --- |
| `herramientas/convertir-instagram-html.mjs` | El programa: abre el zip, lista o convierte, escribe el zip de salida. |
| `herramientas/lib/instagram-html.mjs` | Leer el HTML: bloques, autor, fecha, texto y adjuntos. Sin tocar disco. |
| `herramientas/esqueleto-html-instagram.mjs` | Saca la estructura del HTML sin su contenido, para poder ajustar lo de arriba sin pedirle a nadie sus conversaciones. |
| `tests/instagram-html/convertir.test.ts` | Las piezas: fechas, bloques, adjuntos, codificación. |
| `tests/instagram-html/conversorZip.test.ts` | De punta a punta: se fabrica un export en HTML, se corre el programa de verdad y el resultado se lee con el código de la aplicación. |

## De paso: un fallo en `arreglarTexto`

Escribiendo esto salió un fallo que ya estaba en la aplicación. Meta escribe el
texto del export mal codificado a propósito (`cumpleaños` llega como
`cumpleaÃ±os`), y `arreglarTexto` lo deshace con `utf8.decode`, confiando en
que lance cuando el texto YA estaba bien.

No siempre lanza. Con «cumpleaños 🎂» sí, porque la ñ no encaja como principio
de secuencia. Pero con **«buenas noches 🌙», donde el emoji es lo único fuera
del alfabeto, no lanza**: lee el emoji como si fuera un byte, lo recorta y
devuelve «buenas noches » con un carácter de control en su sitio. Es decir, el
acento era lo que salvaba al mensaje.

Arreglado comprobando antes si el texto puede estar mal codificado: el
estropicio escribe cada byte como un carácter, y un byte no pasa de 255, así
que un texto con un emoji de verdad ya estaba bien y no hay nada que deshacer.
