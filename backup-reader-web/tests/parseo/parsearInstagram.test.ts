import { describe, expect, it } from "vitest";

import {
  arreglarTexto,
  nombreDeUri,
  nombreDelHilo,
  parsearInstagram,
  parsearTextoInstagram,
  textoDelMensaje,
} from "../../lib/parsear-instagram";
import { nombreDelAdjunto } from "../../lib/nombre-de-adjunto";
import { partirFechaHora } from "../../lib/fechas-de-chat";

const RUTA = "your_instagram_activity/messages/inbox/ana_123";

const mensaje = (extra: Record<string, unknown> = {}) => ({
  sender_name: "Ana",
  timestamp_ms: 1763900000000,
  ...extra,
});

describe("el texto mal codificado de Meta", () => {
  it("se arregla", () => {
    /* «cumpleaños» tal como lo escribe Meta: los dos bytes de la ñ sueltos. */
    expect(arreglarTexto("cumpleaÃ±os")).toBe("cumpleaños");
  });

  it("deja en paz el texto que ya estaba bien", () => {
    /* Esto es lo que protege un export correcto: `utf8.decode` lanzaría, y sin
       el respaldo el mensaje saldría destrozado. */
    expect(arreglarTexto("cumpleaños 🎂")).toBe("cumpleaños 🎂");
  });

  it("no se come un emoji solo porque el mensaje no lleve acentos", () => {
    /* Aquí no basta con esperar a que `utf8.decode` lance, porque no lanza: en
       «cumpleaños 🎂» se tropieza con la ñ, pero sin ningún acento delante lee
       el emoji como si fuera un byte, lo recorta y deja un carácter de control
       en su sitio. El acento no puede ser lo que salve al mensaje. */
    expect(arreglarTexto("buenas noches 🌙")).toBe("buenas noches 🌙");
    expect(arreglarTexto("🎉🎉🎉")).toBe("🎉🎉🎉");
    expect(arreglarTexto("ok 👍")).toBe("ok 👍");
  });

  it("también en el nombre de quien escribe", () => {
    const filas = parsearInstagram({ messages: [mensaje({ sender_name: "MartÃ­n" })] });
    expect(filas[0][1]).toBe("Martín");
  });
});

describe("el orden", () => {
  it("devuelve del más viejo al más nuevo, aunque el archivo venga al revés", () => {
    const filas = parsearInstagram({
      messages: [
        mensaje({ timestamp_ms: 3000, content: "tercero" }),
        mensaje({ timestamp_ms: 2000, content: "segundo" }),
        mensaje({ timestamp_ms: 1000, content: "primero" }),
      ],
    });
    expect(filas.map((f) => f[2])).toEqual(["primero", "segundo", "tercero"]);
  });

  it("junta varios message_N.json, donde el 1 es el MÁS RECIENTE", () => {
    const nuevo = { messages: [mensaje({ timestamp_ms: 4000, content: "d" }), mensaje({ timestamp_ms: 3000, content: "c" })] };
    const viejo = { messages: [mensaje({ timestamp_ms: 2000, content: "b" }), mensaje({ timestamp_ms: 1000, content: "a" })] };
    const filas = parsearInstagram([nuevo, viejo]);
    expect(filas.map((f) => f[2])).toEqual(["a", "b", "c", "d"]);
  });

  it("dos mensajes de la misma marca de tiempo conservan su orden", () => {
    const filas = parsearInstagram({
      messages: [
        mensaje({ timestamp_ms: 1000, content: "el de después" }),
        mensaje({ timestamp_ms: 1000, content: "el de antes" }),
      ],
    });
    expect(filas.map((f) => f[2])).toEqual(["el de antes", "el de después"]);
  });
});

describe("la fecha", () => {
  it("sale en un formato que el resto de la aplicación entiende", () => {
    const filas = parsearInstagram({ messages: [mensaje({ timestamp_ms: Date.UTC(2026, 10, 23, 12, 0) })] });
    const { fecha, hora } = partirFechaHora(filas[0][0]);
    expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hora).toMatch(/^\d{2}:\d{2}$/);
  });

  it("no deja el día y el mes a interpretación", () => {
    /* Con "9/8/26" habría que adivinar si es agosto o septiembre; con el año
       delante no hay nada que adivinar. */
    const filas = parsearInstagram({ messages: [mensaje({ timestamp_ms: 1763900000000 })] });
    expect(filas[0][0]).not.toMatch(/\//);
  });
});

describe("los adjuntos", () => {
  it("una foto se escribe de forma que el resto ya sabe leer", () => {
    const texto = textoDelMensaje(mensaje({ photos: [{ uri: `${RUTA}/photos/456.jpg` }] }));
    expect(nombreDelAdjunto(texto)).toBe("456.jpg");
  });

  it("vídeos, audios, gifs y stickers también", () => {
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ videos: [{ uri: `${RUTA}/videos/v.mp4` }] }, "v.mp4"],
      [{ audio_files: [{ uri: `${RUTA}/audio/a.m4a` }] }, "a.m4a"],
      [{ gifs: [{ uri: `${RUTA}/gifs/g.gif` }] }, "g.gif"],
      [{ sticker: { uri: `${RUTA}/stickers/s.webp` } }, "s.webp"],
    ];
    for (const [campo, esperado] of casos) {
      expect(nombreDelAdjunto(textoDelMensaje(mensaje(campo)))).toBe(esperado);
    }
  });

  it("el pie va delante y el adjunto detrás", () => {
    const texto = textoDelMensaje(
      mensaje({ content: "mira esto", photos: [{ uri: `${RUTA}/photos/1.jpg` }] })
    );
    expect(texto.indexOf("mira esto")).toBeLessThan(texto.indexOf("1.jpg"));
  });

  it("un mensaje con tres fotos las menciona todas", () => {
    const texto = textoDelMensaje(
      mensaje({
        photos: [{ uri: `${RUTA}/photos/1.jpg` }, { uri: `${RUTA}/photos/2.jpg` }, { uri: `${RUTA}/photos/3.jpg` }],
      })
    );
    expect(texto).toContain("1.jpg");
    expect(texto).toContain("2.jpg");
    expect(texto).toContain("3.jpg");
  });

  it("de la uri se queda solo el nombre, que es como indexa el manifiesto", () => {
    expect(nombreDeUri(`${RUTA}/photos/456.jpg`)).toBe("456.jpg");
    expect(nombreDeUri("")).toBe("");
  });
});

describe("lo compartido", () => {
  it("conserva el enlace, que es lo único que queda del mensaje", () => {
    const texto = textoDelMensaje(mensaje({ share: { link: "https://www.instagram.com/p/abc/" } }));
    expect(texto).toContain("https://www.instagram.com/p/abc/");
  });

  it("no repite el pie cuando es igual que el contenido", () => {
    const texto = textoDelMensaje(
      mensaje({ content: "mira", share: { link: "https://x.test/1", share_text: "mira" } })
    );
    expect(texto.match(/mira/g)).toHaveLength(1);
  });
});

describe("un mensaje retirado", () => {
  it("se escribe como lo escribe WhatsApp, para que se trate igual", () => {
    expect(textoDelMensaje(mensaje({ is_unsent: true }))).toBe("Se eliminó este mensaje");
  });
});

describe("partiendo del texto del archivo", () => {
  it("lee uno o varios", () => {
    const uno = JSON.stringify({ messages: [mensaje({ timestamp_ms: 2000, content: "b" })] });
    const dos = JSON.stringify({ messages: [mensaje({ timestamp_ms: 1000, content: "a" })] });
    expect(parsearTextoInstagram([uno, dos]).map((f) => f[2])).toEqual(["a", "b"]);
  });

  it("un archivo roto no tira la conversación entera", () => {
    const bueno = JSON.stringify({ messages: [mensaje({ content: "sigo aquí" })] });
    expect(parsearTextoInstagram(["{roto", bueno]).map((f) => f[2])).toEqual(["sigo aquí"]);
  });

  it("un export vacío no revienta", () => {
    expect(parsearInstagram({})).toEqual([]);
    expect(parsearTextoInstagram("{}")).toEqual([]);
  });
});

describe("el nombre del hilo", () => {
  it("usa el título de Instagram", () => {
    expect(nombreDelHilo({ title: "Ana", participants: [{ name: "Ana" }] })).toBe("Ana");
  });

  it("si no hay título, usa a los participantes", () => {
    expect(nombreDelHilo({ participants: [{ name: "Ana" }, { name: "Beto" }] })).toBe("Ana, Beto");
  });

  it("también lo arregla si viene mal codificado", () => {
    expect(nombreDelHilo({ title: "MartÃ­n" })).toBe("Martín");
  });
});
