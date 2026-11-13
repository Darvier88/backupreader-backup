import { describe, expect, it } from "vitest";
import { documentoAdjunto, nombreDelAdjunto } from "../../lib/nombre-de-adjunto";
import { esDocumento, nombreVisible, seAbreEnElNavegador, tipoDeDocumento } from "../../lib/documentos";

describe("documentoAdjunto", () => {
  it("Android en español, nombre con espacios", () => {
    expect(documentoAdjunto("Contrato firmado final.pdf (archivo adjunto)")).toEqual({
      archivo: "Contrato firmado final.pdf",
      resto: "",
    });
  });
  it("Android en inglés, con pie debajo", () => {
    expect(documentoAdjunto("Budget 2026.xlsx (file attached)\nAquí va el presupuesto")).toEqual({
      archivo: "Budget 2026.xlsx",
      resto: "Aquí va el presupuesto",
    });
  });
  it("iPhone con prefijo numérico y páginas", () => {
    expect(
      documentoAdjunto("‎Contrato.pdf • 3 páginas ‎<adjunto: 00000012-Contrato.pdf>")
    ).toEqual({ archivo: "00000012-Contrato.pdf", resto: "" });
    expect(documentoAdjunto("<attached: 00000007-Notas de clase.docx>")?.archivo).toBe(
      "00000007-Notas de clase.docx"
    );
  });
  it("todos los tipos de documento", () => {
    for (const ext of ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "csv", "txt", "vcf"]) {
      expect(documentoAdjunto(`Archivo de prueba.${ext} (archivo adjunto)`)?.archivo).toBe(`Archivo de prueba.${ext}`);
    }
  });
  it("NO convierte en tarjeta un texto que solo nombra un archivo", () => {
    expect(documentoAdjunto("te mando informe.pdf mañana")).toBeNull();
    expect(documentoAdjunto("revisa notas.txt")).toBeNull();
  });
  it("las fotos, audios y vídeos no son documentos", () => {
    expect(documentoAdjunto("IMG-20260101-WA0001.jpg (archivo adjunto)")).toBeNull();
    expect(documentoAdjunto("<adjunto: 00000003-AUDIO.opus>")).toBeNull();
  });
  it("nada de HTML", () => {
    expect(documentoAdjunto("pagina.html (archivo adjunto)")).toBeNull();
  });
});

describe("nombreDelAdjunto", () => {
  it("conserva los espacios del nombre", () => {
    expect(nombreDelAdjunto("Mi documento largo.pdf (archivo adjunto)")).toBe("Mi documento largo.pdf");
  });
  it("sigue leyendo fotos como antes", () => {
    expect(nombreDelAdjunto("IMG-20260101-WA0001.jpg (archivo adjunto)")).toBe("IMG-20260101-WA0001.jpg");
    expect(nombreDelAdjunto("<adjunto: 00000003-PHOTO-2026.jpg>")).toBe("00000003-PHOTO-2026.jpg");
  });
});

describe("documentos", () => {
  it("tipo, nombre visible y cómo se abre", () => {
    expect(tipoDeDocumento("a.pdf")).toBe("PDF");
    expect(tipoDeDocumento("a.DOCX")).toBe("Word");
    expect(tipoDeDocumento("a.xlsx")).toBe("Excel");
    expect(tipoDeDocumento("a.pptx")).toBe("PowerPoint");
    expect(nombreVisible("00000012-Contrato.pdf")).toBe("Contrato.pdf");
    expect(nombreVisible("Contrato 2026.pdf")).toBe("Contrato 2026.pdf");
    expect(seAbreEnElNavegador("x.pdf")).toBe(true);
    expect(seAbreEnElNavegador("x.docx")).toBe(false);
    expect(esDocumento("algo.pdf")).toBe(true);
  });
});
