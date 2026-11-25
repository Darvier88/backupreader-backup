/**
 * El conversor de HTML a JSON: que lo que saca sea indistinguible de una
 * descarga de Instagram en JSON.
 *
 * El HTML de estas pruebas está copiado de la estructura real de un export
 * (las mismas etiquetas y las mismas clases), con el contenido inventado.
 */

import { describe, it, expect } from "vitest";
import utf8 from "utf8";

import {
  aFormatoMeta,
  bloquesDeMensaje,
  comoLoEscribeMeta,
  fechaEnMs,
  hiloDeHtml,
  mensajeDeBloque,
  resolverRuta,
  textoVisible,
  tituloDeHtml,
} from "../../herramientas/lib/instagram-html";
import { arreglarTexto, parsearInstagram } from "../../lib/parsear-instagram";

/** Un bloque de mensaje con las clases que usa Meta. */
const bloque = (autor: string, cuerpo: string, fecha: string) =>
  `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">` +
  `<h2 class="_3-95 _2pim _a6-h _a6-i">${autor}</h2>` +
  `<div class="_3-95 _a6-p"><div><div></div><div>${cuerpo}</div><div></div><div></div></div></div>` +
  `<div class="_3-94 _a6-o">${fecha}</div>` +
  `</div>`;

/** Una página, con la cabecera que trae el export. */
const pagina = (titulo: string, bloques: string[]) =>
  `<html><head><title>Instagram</title></head>` +
  `<body class="_5vb_ _2yq _a7o5"><div class="_li"><div class="_a705">` +
  `<header class="_as-_ _a70a"><div class="_a70d"><h1 id="">${titulo}</h1>` +
  `<aside class="_aoaa">Descargado el <time datetime="">November 24, 2026 at 8:32 PM UTC</time></aside>` +
  `</div></header>` +
  `<main class="_a706">${bloques.join("")}</main>` +
  `</div></div></body></html>`;

describe("fechas", () => {
  const enMs = (y: number, mes: number, d: number, h: number, min: number) =>
    new Date(y, mes - 1, d, h, min, 0, 0).getTime();

  it("lee el formato en que vino el export de verdad", () => {
    expect(fechaEnMs("Sep 14, 2017 8:09 am")).toBe(enMs(2017, 9, 14, 8, 9));
    expect(fechaEnMs("November 24, 2026 at 8:32 PM UTC")).toBe(enMs(2026, 11, 24, 20, 32));
  });

  it("lee los formatos de los demás idiomas en los que sale la descarga", () => {
    expect(fechaEnMs("25 nov 2026, 2:18 p. m.")).toBe(enMs(2026, 11, 25, 14, 18));
    expect(fechaEnMs("25 de noviembre de 2026 14:18")).toBe(enMs(2026, 11, 25, 14, 18));
    expect(fechaEnMs("1 de enero de 2020 0:05")).toBe(enMs(2020, 1, 1, 0, 5));
  });

  it("no inventa medianoche cuando el texto no es una fecha", () => {
    expect(fechaEnMs("Hola, ¿qué tal?")).toBeNull();
    expect(fechaEnMs("")).toBeNull();
    expect(fechaEnMs("8:09 am")).toBeNull();
  });

  it("distingue el día del mes cuando uno de los dos no puede ser mes", () => {
    expect(fechaEnMs("25/11/2026 14:18")).toBe(enMs(2026, 11, 25, 14, 18));
    expect(fechaEnMs("11/25/2026 14:18")).toBe(enMs(2026, 11, 25, 14, 18));
  });

  it("las 12 de la noche y las 12 del mediodía no se confunden", () => {
    expect(fechaEnMs("Sep 14, 2017 12:30 am")).toBe(enMs(2017, 9, 14, 0, 30));
    expect(fechaEnMs("Sep 14, 2017 12:30 pm")).toBe(enMs(2017, 9, 14, 12, 30));
  });
});

describe("bloques", () => {
  it("encuentra un mensaje por página y no se mete en los divs de dentro", () => {
    const html = pagina("Ana", [
      bloque("Ana", "hola", "Sep 14, 2017 8:09 am"),
      bloque("Luis", "qué tal", "Sep 14, 2017 8:10 am"),
    ]);
    expect(bloquesDeMensaje(html)).toHaveLength(2);
  });

  it("no cuenta la cabecera como un mensaje", () => {
    /* La cabecera lleva un `<h1>` y una fecha; si el corte por `<main>` fallara,
       saldría un mensaje de más con la fecha de la descarga. */
    const html = pagina("Ana", [bloque("Ana", "hola", "Sep 14, 2017 8:09 am")]);
    const hilo = hiloDeHtml([html]);
    expect(hilo.paginas[0].messages).toHaveLength(1);
    expect(hilo.paginas[0].messages?.[0].content).toBe("hola");
  });

  it("sigue encontrando los mensajes si Meta cambia las clases", () => {
    const sinClases = pagina("Ana", [
      bloque("Ana", "hola", "Sep 14, 2017 8:09 am"),
      bloque("Luis", "qué tal", "Sep 14, 2017 8:10 am"),
    ]).replace(/pam _3-95 _2ph- _a6-g uiBoxWhite noborder/g, "_xx1 _xx2");
    const bloques = bloquesDeMensaje(sinClases);
    expect(bloques).toHaveLength(2);
    expect(mensajeDeBloque(bloques[0]).content).toBe("hola");
  });
});

describe("un mensaje", () => {
  it("saca autor, fecha y texto", () => {
    const m = mensajeDeBloque(bloque("Ana García", "hola, ¿nos vemos?", "Sep 14, 2017 8:09 am"));
    expect(m.sender_name).toBe("Ana García");
    expect(m.content).toBe("hola, ¿nos vemos?");
    expect(m.timestamp_ms).toBe(new Date(2017, 8, 14, 8, 9).getTime());
  });

  it("conserva los saltos de línea", () => {
    const m = mensajeDeBloque(bloque("Ana", "primera<br>segunda", "Sep 14, 2017 8:09 am"));
    expect(m.content).toBe("primera\nsegunda");
  });

  it("deshace las entidades", () => {
    const m = mensajeDeBloque(bloque("Ana", "t&uacute;&nbsp;&amp; yo &lt;3", "Sep 14, 2017 8:09 am"));
    expect(m.content).toContain("& yo <3");
  });

  it("no repite el nombre ni la fecha dentro del texto", () => {
    const m = mensajeDeBloque(bloque("Ana", "hola", "Sep 14, 2017 8:09 am"));
    expect(m.content).toBe("hola");
  });

  it("no cuenta las reacciones como texto de quien escribió", () => {
    const con =
      `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">` +
      `<h2>Ana</h2>` +
      `<div class="_3-95 _a6-p"><div><div>hola</div>` +
      `<div class="_a6-q"><ul><li>❤️ Luis</li></ul></div></div></div>` +
      `<div class="_3-94 _a6-o">Sep 14, 2017 8:09 am</div></div>`;
    expect(mensajeDeBloque(con).content).toBe("hola");
  });

  it("saca una foto como adjunto y no como enlace", () => {
    const cuerpo =
      `<a href="your_instagram_activity/messages/inbox/ana_123/photos/456.jpg">` +
      `<img src="your_instagram_activity/messages/inbox/ana_123/photos/456.jpg" class="_a6_o"/></a>`;
    const m = mensajeDeBloque(bloque("Ana", cuerpo, "Sep 14, 2017 8:09 am"));
    expect(m.photos).toEqual([
      { uri: "your_instagram_activity/messages/inbox/ana_123/photos/456.jpg" },
    ]);
    expect(m.share).toBeUndefined();
  });

  it("separa vídeo, audio y gif por su extensión", () => {
    const base = "your_instagram_activity/messages/inbox/ana_123";
    const cuerpo =
      `<video controls><source src="${base}/videos/1.mp4"/></video>` +
      `<audio controls src="${base}/audio/2.m4a"></audio>` +
      `<img src="${base}/gifs/3.gif"/>`;
    const m = mensajeDeBloque(bloque("Ana", cuerpo, "Sep 14, 2017 8:09 am"));
    expect(m.videos).toEqual([{ uri: `${base}/videos/1.mp4` }]);
    expect(m.audio_files).toEqual([{ uri: `${base}/audio/2.m4a` }]);
    expect(m.gifs).toEqual([{ uri: `${base}/gifs/3.gif` }]);
    expect(m.photos).toBeUndefined();
  });

  it("resuelve los «..» cuando la media está fuera de la conversación", () => {
    /* En un export en HTML la media puede vivir en otra carpeta del zip, y la
       página sube niveles para llegar a ella. Si no se resolvieran los «..»,
       el archivo se buscaría donde no está y el adjunto se quedaría fuera del
       zip convertido sin que nadie se enterara. */
    const cuerpo = `<img src="../../../media/photos/202611/456.jpg"/>`;
    const m = mensajeDeBloque(
      bloque("Ana", cuerpo, "Sep 14, 2017 8:09 am"),
      "your_instagram_activity/messages/inbox/ana_123"
    );
    expect(m.photos).toEqual([{ uri: "your_instagram_activity/media/photos/202611/456.jpg" }]);
  });

  it("deja la ruta en paz cuando ya viene desde la raíz", () => {
    expect(resolverRuta("your_instagram_activity/messages/inbox/a_1/photos/9.jpg", "x/y")).toBe(
      "your_instagram_activity/messages/inbox/a_1/photos/9.jpg"
    );
    expect(resolverRuta("/media/9.jpg", "x/y")).toBe("media/9.jpg");
  });

  it("deshace el escapado de la URL, que es donde se pierden los acentos", () => {
    expect(resolverRuta("photos/caf%C3%A9.jpg", "hilo")).toBe("hilo/photos/café.jpg");
  });

  it("completa la ruta cuando el HTML enlaza relativo", () => {
    const cuerpo = `<img src="photos/456.jpg"/>`;
    const m = mensajeDeBloque(
      bloque("Ana", cuerpo, "Sep 14, 2017 8:09 am"),
      "your_instagram_activity/messages/inbox/ana_123"
    );
    expect(m.photos).toEqual([
      { uri: "your_instagram_activity/messages/inbox/ana_123/photos/456.jpg" },
    ]);
  });

  it("un enlace de fuera va como compartido, no como adjunto", () => {
    const cuerpo = `<a href="https://www.instagram.com/p/ABC/">https://www.instagram.com/p/ABC/</a>`;
    const m = mensajeDeBloque(bloque("Ana", cuerpo, "Sep 14, 2017 8:09 am"));
    expect(m.share).toEqual({ link: "https://www.instagram.com/p/ABC/" });
    expect(m.photos).toBeUndefined();
  });

  it("una misma foto enlazada dos veces es un adjunto, no dos", () => {
    const uri = "your_instagram_activity/messages/inbox/ana_123/photos/456.jpg";
    const m = mensajeDeBloque(
      bloque("Ana", `<a href="${uri}"><img src="${uri}"/></a>`, "Sep 14, 2017 8:09 am")
    );
    expect(m.photos).toHaveLength(1);
  });
});

describe("una conversación", () => {
  it("saca el título de la cabecera", () => {
    expect(tituloDeHtml(pagina("Ana García", []))).toBe("Ana García");
  });

  it("arma los participantes con quienes firman los mensajes", () => {
    const html = pagina("Ana", [
      bloque("Ana", "hola", "Sep 14, 2017 8:10 am"),
      bloque("Luis", "qué tal", "Sep 14, 2017 8:09 am"),
    ]);
    const { paginas } = hiloDeHtml([html]);
    expect((paginas[0].participants || []).map((p) => p.name).sort()).toEqual([
      "Ana",
      "Luis",
    ]);
  });

  it("un mensaje sin fecha se queda al lado del anterior, no en 1970", () => {
    const html = pagina("Ana", [
      bloque("Ana", "el nuevo", "Sep 14, 2017 8:10 am"),
      bloque("Ana", "sin fecha", "(no se pudo leer)"),
      bloque("Luis", "el viejo", "Sep 14, 2017 8:00 am"),
    ]);
    const { paginas, informe } = hiloDeHtml([html]);
    expect(informe.sinFecha).toBe(1);
    const filas = parsearInstagram(paginas as never);
    /* Si se hubiera quedado en cero, «sin fecha» abriría la conversación. */
    expect(filas.map((f) => f[2])).toEqual(["el viejo", "sin fecha", "el nuevo"]);
  });

  it("el informe cuenta los bloques, para que nada se pierda en silencio", () => {
    const html = pagina("Ana", [
      bloque("Ana", "uno", "Sep 14, 2017 8:09 am"),
      bloque("", "dos", "Sep 14, 2017 8:08 am"),
    ]);
    const { informe } = hiloDeHtml([html]);
    expect(informe.bloques).toBe(2);
    expect(informe.sinAutor).toBe(1);
  });
});

describe("de punta a punta: lo que sale lo lee el parser de siempre", () => {
  it("varias páginas quedan en orden, de la más vieja a la más nueva", () => {
    /* Como en el export de verdad: message_1 es el bloque MÁS RECIENTE, y
       dentro de cada página los mensajes van del más nuevo al más viejo. */
    const p1 = pagina("Ana", [
      bloque("Ana", "cuatro", "Sep 14, 2017 9:00 am"),
      bloque("Luis", "tres", "Sep 14, 2017 8:30 am"),
    ]);
    const p2 = pagina("Ana", [
      bloque("Ana", "dos", "Sep 13, 2017 9:00 am"),
      bloque("Luis", "uno", "Sep 13, 2017 8:30 am"),
    ]);

    const { paginas } = hiloDeHtml([p1, p2], {
      rutaHilo: "your_instagram_activity/messages/inbox/ana_123",
    });
    const filas = parsearInstagram(paginas as never);

    expect(filas.map((f) => f[2])).toEqual(["uno", "dos", "tres", "cuatro"]);
    expect(filas[0][0]).toBe("2017-09-13 08:30");
    expect(filas[3][1]).toBe("Ana");
  });

  it("dos mensajes del mismo minuto conservan el orden en que se escribieron", () => {
    /* El HTML no trae segundos: los dos caen en la misma marca de tiempo y lo
       único que los ordena es cómo venían. */
    const html = pagina("Ana", [
      bloque("Ana", "y otra cosa", "Sep 14, 2017 8:09 am"),
      bloque("Ana", "una cosa", "Sep 14, 2017 8:09 am"),
    ]);
    const { paginas } = hiloDeHtml([html]);
    expect(parsearInstagram(paginas as never).map((f) => f[2])).toEqual([
      "una cosa",
      "y otra cosa",
    ]);
  });

  it("una foto llega al chat como el adjunto que la aplicación ya sabe resolver", () => {
    const uri = "your_instagram_activity/messages/inbox/ana_123/photos/456.jpg";
    const html = pagina("Ana", [
      bloque("Ana", `mira esto<br><a href="${uri}"><img src="${uri}"/></a>`, "Sep 14, 2017 8:09 am"),
    ]);
    const { paginas } = hiloDeHtml([html]);
    const filas = parsearInstagram(paginas as never);
    expect(filas[0][2]).toBe("mira esto <adjunto: 456.jpg>");
  });

  it("el texto sale con los acentos y los emojis puestos", () => {
    /* La prueba de verdad: se escribe como lo escribe Meta y se lee con el
       parser de la aplicación. Si el estropeado y el arreglo no encajaran,
       aquí saldría «cumpleaÃ±os». */
    const html = pagina("Ana", [
      bloque("Ana Muñoz", "feliz cumpleaños 🎉", "Sep 14, 2017 8:09 am"),
    ]);
    const { paginas } = hiloDeHtml([html]);
    const comoMeta = paginas.map((p) => aFormatoMeta(p, utf8));

    /* Por el camino va estropeado, igual que en una descarga en JSON. */
    expect(comoMeta[0].messages?.[0].content).not.toBe("feliz cumpleaños 🎉");

    const filas = parsearInstagram(JSON.parse(JSON.stringify(comoMeta)) as never);
    expect(filas[0][1]).toBe("Ana Muñoz");
    expect(filas[0][2]).toBe("feliz cumpleaños 🎉");
  });

  it("un emoji sobrevive aunque el mensaje no lleve ningún acento", () => {
    /* `utf8.decode` solo avisa de que el texto ya estaba bien cuando se
       tropieza con un byte imposible, y un acento es lo que se lo pone
       delante. Sin acento, se traga el emoji y lo deja en un carácter de
       control: «buenas noches ». Un mensaje no tiene por qué llevar acentos. */
    const html = pagina("Ana", [bloque("Ana", "buenas noches 🌙", "Sep 14, 2017 8:09 am")]);
    const { paginas } = hiloDeHtml([html]);
    const comoMeta = paginas.map((p) => aFormatoMeta(p, utf8));
    const filas = parsearInstagram(JSON.parse(JSON.stringify(comoMeta)) as never);
    expect(filas[0][2]).toBe("buenas noches 🌙");
  });

  it("si el HTML ya viniera mal codificado, también se arregla", () => {
    /* Meta escribe así sus páginas en muchas descargas: «cumpleaÃ±os». */
    const roto = utf8.encode("cumpleaños");
    expect(arreglarTexto(comoLoEscribeMeta(roto, utf8))).toBe("cumpleaños");
    /* Y si viniera bien, se queda bien: no se puede saber de antemano cuál de
       las dos es, así que las dos tienen que acabar igual. */
    expect(arreglarTexto(comoLoEscribeMeta("cumpleaños", utf8))).toBe("cumpleaños");
  });

  it("el texto plano no se toca", () => {
    expect(comoLoEscribeMeta("hola", utf8)).toBe("hola");
    expect(textoVisible("<div>hola<br>mundo</div>")).toBe("hola\nmundo");
  });
});
