/**
 * Cómo se agrupan los chats de la barra lateral.
 *
 * Son reglas de las que no fallan nunca: la lista siempre sale. Si una se
 * rompe, lo que se ve es un apartado «Instagram» vacío, o los chats
 * cambiándose de sitio solos, y eso no lo detecta nada.
 */

import { describe, expect, it } from "vitest";

import { agruparPorPlataforma, plataformaDe } from "../../lib/agrupar-chats";
import type { FileList } from "../../models/Files";

const chat = (name: string, origen?: FileList["origen"]): FileList => ({
  name,
  fullPath: "backups/u/" + name,
  cifrado: true,
  origen,
});

describe("de qué plataforma es cada chat", () => {
  it("lo dice su origen", () => {
    expect(plataformaDe(chat("a", "whatsapp"))).toBe("whatsapp");
    expect(plataformaDe(chat("b", "instagram"))).toBe("instagram");
    expect(plataformaDe(chat("c", "other"))).toBe("other");
  });

  it("un chat bloqueado no se adivina", () => {
    /* Con la bóveda cerrada no se puede abrir su manifiesto, así que no se
       sabe de dónde viene. Meterlo en WhatsApp sería inventárselo. */
    expect(plataformaDe(chat("d"))).toBe("desconocido");
    expect(plataformaDe({ ...chat("e"), origen: undefined })).toBe("desconocido");
  });
});

describe("los grupos de la barra lateral", () => {
  it("con una sola plataforma no hay cabeceras", () => {
    /* Una cabecera que siempre dice lo mismo no informa: ocupa sitio y empuja
       los chats hacia abajo. */
    const { grupos, conCabecera } = agruparPorPlataforma([
      chat("Ana", "whatsapp"),
      chat("Luis", "whatsapp"),
    ]);
    expect(conCabecera).toBe(false);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].chats).toHaveLength(2);
  });

  it("un grupo vacío no sale", () => {
    /* Enseñar un apartado «Instagram» a quien solo tiene WhatsApp es decirle
       que le falta algo. */
    const { grupos } = agruparPorPlataforma([chat("Ana", "whatsapp")]);
    expect(grupos.map((g) => g.plataforma)).toEqual(["whatsapp"]);
  });

  it("con las dos, cabeceras y WhatsApp primero", () => {
    const { grupos, conCabecera } = agruparPorPlataforma([
      chat("Nick", "instagram"),
      chat("Ana", "whatsapp"),
    ]);
    expect(conCabecera).toBe(true);
    expect(grupos.map((g) => g.plataforma)).toEqual(["whatsapp", "instagram"]);
  });

  it("el orden no depende de cuántos chats tenga cada una", () => {
    /* Una lista que se reordena sola al subir un chat obliga a buscar otra vez
       el que ya sabías dónde estaba. */
    const { grupos } = agruparPorPlataforma([
      chat("i1", "instagram"),
      chat("i2", "instagram"),
      chat("i3", "instagram"),
      chat("w1", "whatsapp"),
    ]);
    expect(grupos.map((g) => g.plataforma)).toEqual(["whatsapp", "instagram"]);
  });

  it("dentro de un grupo se respeta el orden que traían", () => {
    /* Ya viene decidido: los cifrados primero y entre ellos los más
       recientes. Reordenar aquí lo desharía. */
    const { grupos } = agruparPorPlataforma([
      chat("tercero", "whatsapp"),
      chat("primero", "whatsapp"),
      chat("segundo", "whatsapp"),
    ]);
    expect(grupos[0].chats.map((c) => c.name)).toEqual(["tercero", "primero", "segundo"]);
  });

  it("los bloqueados van al final y en su propio grupo", () => {
    const { grupos } = agruparPorPlataforma([
      chat("bloqueado"),
      chat("Nick", "instagram"),
      chat("Ana", "whatsapp"),
      chat("viejo", "other"),
    ]);
    expect(grupos.map((g) => g.plataforma)).toEqual([
      "whatsapp",
      "instagram",
      "other",
      "desconocido",
    ]);
  });

  it("con la bóveda cerrada son todos bloqueados, así que tampoco hay cabeceras", () => {
    const { grupos, conCabecera } = agruparPorPlataforma([chat("a"), chat("b")]);
    expect(conCabecera).toBe(false);
    expect(grupos[0].plataforma).toBe("desconocido");
  });

  it("sin chats no hay grupos y no revienta", () => {
    expect(agruparPorPlataforma([]).grupos).toEqual([]);
    expect(agruparPorPlataforma(null).grupos).toEqual([]);
    expect(agruparPorPlataforma(undefined).conCabecera).toBe(false);
  });

  it("ningún chat se pierde por el camino", () => {
    /* Lo que más importa: agrupar reparte, no descarta. Un chat que no
       aparece en la barra lateral es un chat que el usuario cree perdido. */
    const todos = [
      chat("a", "whatsapp"),
      chat("b", "instagram"),
      chat("c", "other"),
      chat("d"),
      chat("e", "whatsapp"),
    ];
    const { grupos } = agruparPorPlataforma(todos);
    const repartidos = grupos.flatMap((g) => g.chats.map((c) => c.name));
    expect(repartidos.slice().sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});
