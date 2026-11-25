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
# 1. Ver qué conversaciones hay dentro. Esto no lee ningún mensaje:
#    solo mira el índice del zip.
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip"

# 2. Convertir la que se quiera, por su número de la lista
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip" --hilo 3

# varias a la vez, o todas
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip" --hilo 3,7,12
node herramientas/convertir-instagram-html.mjs "C:\ruta\instagram.zip" --todas
```

Deja un `convertido-<nombre>.zip` por conversación, al lado del original. Ese
zip es el que se sube a BackupReader: por dentro tiene la misma estructura que
habría tenido la descarga en JSON, así que lo lee
`lib/parsear-instagram.ts`, el parser de siempre, sin ningún camino aparte.

El original no se toca, y el conversor no se conecta a nada: lee el zip que se
le da y escribe otro al lado.

### Un zip por conversación

Un backup es una conversación, así que lo que se sube es una. Separarlas en el
conversor hace que cada zip pese lo que pesa esa conversación y no la descarga
entera, que son gigas.

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
