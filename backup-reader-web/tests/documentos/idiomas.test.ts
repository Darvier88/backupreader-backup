import { describe, expect, it } from "vitest";
import { documentoAdjunto, esAdjuntoOmitido, nombreDelAdjunto } from "../../lib/nombre-de-adjunto";

describe("adjuntos en varios idiomas", () => {
  it("Android: la marca en los 6 idiomas", () => {
    for (const marca of ["archivo adjunto", "file attached", "arquivo anexado", "fichier joint", "Datei angehängt", "file allegato"]) {
      expect(nombreDelAdjunto(`IMG-20261113-WA0001.jpg (${marca})`)).toBe("IMG-20261113-WA0001.jpg");
      expect(documentoAdjunto(`Contrato firmado.pdf (${marca})`)?.archivo).toBe("Contrato firmado.pdf");
    }
  });
  it("iPhone: la marca en los 6 idiomas", () => {
    for (const marca of ["adjunto", "attached", "anexado", "pièce jointe", "Anhang", "allegato"]) {
      expect(nombreDelAdjunto(`‎<${marca}: 00000003-PHOTO-2026-11-13-15-27-05.jpg>`)).toBe(
        "00000003-PHOTO-2026-11-13-15-27-05.jpg"
      );
      expect(documentoAdjunto(`Contrato.pdf • 3 páginas ‎<${marca}: 00000012-Contrato.pdf>`)?.archivo).toBe(
        "00000012-Contrato.pdf"
      );
    }
  });
  it("un texto entre < > que no es un archivo no es adjunto", () => {
    expect(documentoAdjunto("<nota: esto no es un archivo>")).toBeNull();
  });
  it("avisos de multimedia omitida", () => {
    for (const aviso of [
      "<Multimedia omitido>", "imagen omitida", "<Media omitted>", "image omitted", "document omitted",
      "<Mídia oculta>", "<Médias omis>", "<Medien ausgeschlossen>", "<Media omessi>", "‎audio omitido",
    ]) {
      expect(esAdjuntoOmitido(aviso)).toBe(true);
    }
    expect(esAdjuntoOmitido("me dijo que la imagen omitida era fea")).toBe(false);
    expect(esAdjuntoOmitido("hola")).toBe(false);
  });
});
