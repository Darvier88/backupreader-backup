import { describe, expect, it } from "vitest";
import { esArchivoBasura, findChatPiece } from "../../lib/backupreader-crypto/manifest";

const pieza = (name: string, size = 100, kind = name.endsWith(".txt") ? "chat" : "image") =>
  ({ id: name, name, kind, mime: "", size, cipherSize: size } as any);
const manifiesto = (...pieces: any[]) => ({ pieces } as any);

describe("findChatPiece", () => {
  it("iPhone: _chat.txt aunque haya otro .txt antes", () => {
    const m = manifiesto(pieza("00000005-notas.txt", 50), pieza("_chat.txt", 10));
    expect(findChatPiece(m)?.name).toBe("_chat.txt");
  });
  it("Android / Web: «Chat de WhatsApp con Ana.txt» antes que un documento .txt", () => {
    const m = manifiesto(pieza("lista de la compra.txt", 900), pieza("Chat de WhatsApp con Ana.txt", 300));
    expect(findChatPiece(m)?.name).toBe("Chat de WhatsApp con Ana.txt");
    expect(findChatPiece(manifiesto(pieza("WhatsApp Chat with Ana.txt")))?.name).toBe("WhatsApp Chat with Ana.txt");
  });
  it("zip rehecho en Mac: ignora __MACOSX y ._", () => {
    const m = manifiesto(
      pieza("__MACOSX/Chat/._Chat de WhatsApp con Ana.txt", 4000),
      pieza("Chat/._otro.txt", 4000),
      pieza("Chat/Chat de WhatsApp con Ana.txt", 300)
    );
    expect(findChatPiece(m)?.name).toBe("Chat/Chat de WhatsApp con Ana.txt");
  });
  it("sin nombre reconocible: el .txt más grande", () => {
    const m = manifiesto(pieza("a.txt", 10), pieza("b.txt", 5000));
    expect(findChatPiece(m)?.name).toBe("b.txt");
  });
});

describe("esArchivoBasura", () => {
  it("reconoce la basura de Mac y Windows", () => {
    for (const n of ["__MACOSX/x/._a.txt", "carpeta/._foto.jpg", ".DS_Store", "x/Thumbs.db", "desktop.ini"]) {
      expect(esArchivoBasura(n)).toBe(true);
    }
    for (const n of ["_chat.txt", "IMG-20261113-WA0001.jpg", "Chat/Contrato.pdf"]) {
      expect(esArchivoBasura(n)).toBe(false);
    }
  });
});
