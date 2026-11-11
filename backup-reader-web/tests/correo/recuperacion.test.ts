import { describe, expect, it } from "vitest";

import { correoDeRecuperacion, enlaceDeRecuperacion } from "../../lib/correo/recuperacion";

const DE_FIREBASE =
  "https://backup-reader.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC-123_xyz&apiKey=AIzaFalsa&lang=en";

describe("enlaceDeRecuperacion", () => {
  it("saca el código de Firebase y lo cuelga de nuestra pantalla", () => {
    expect(enlaceDeRecuperacion(DE_FIREBASE, "https://backupreader.com")).toBe(
      "https://backupreader.com/accion?mode=resetPassword&oobCode=ABC-123_xyz"
    );
  });

  it("no arrastra la clave de API ni el idioma de Firebase", () => {
    const enlace = enlaceDeRecuperacion(DE_FIREBASE, "https://backupreader.com")!;
    expect(enlace).not.toContain("apiKey");
    expect(enlace).not.toContain("lang=");
  });

  it("aguanta una base con barra final", () => {
    expect(enlaceDeRecuperacion(DE_FIREBASE, "https://backupreader.com/")).not.toContain("//accion");
  });

  it("escapa el código, que va dentro de una URL", () => {
    const raro = "https://x/__/auth/action?mode=resetPassword&oobCode=" + encodeURIComponent("a+b/c=d");
    const enlace = enlaceDeRecuperacion(raro, "https://backupreader.com")!;
    /* Si no se escapara, el `+` llegaría a la pantalla como un espacio y el
       código no valdría, con un error imposible de entender para el usuario. */
    expect(enlace).toContain("oobCode=a%2Bb%2Fc%3Dd");
  });

  it("devuelve null si no hay código o la base está vacía", () => {
    expect(enlaceDeRecuperacion("https://x/__/auth/action?mode=resetPassword", "https://b.com")).toBeNull();
    expect(enlaceDeRecuperacion("no es una url", "https://b.com")).toBeNull();
    expect(enlaceDeRecuperacion(DE_FIREBASE, "")).toBeNull();
  });
});

describe("correoDeRecuperacion", () => {
  const enlace = "https://backupreader.com/accion?mode=resetPassword&oobCode=ABC";

  it("trae el enlace en el HTML y en el texto", () => {
    const { html, texto } = correoDeRecuperacion(enlace, "es");
    /* En el HTML el `&` va escapado como `&amp;`, que es lo correcto dentro
       de un atributo: el cliente de correo lo devuelve a `&` al pulsarlo. En
       la versión de texto va tal cual, porque ahí no hay nada que escapar. */
    expect(html).toContain(`href="${enlace.replace(/&/g, "&amp;")}"`);
    expect(texto).toContain(enlace);
  });

  it("distingue la contraseña de acceso de la clave de cifrado", () => {
    /* Es la confusión que más soporte genera: sin esta frase, quien recupera
       la contraseña cree que ya tiene acceso a sus chats. */
    const { html } = correoDeRecuperacion(enlace, "es");
    expect(html).toContain("clave de cifrado");
  });

  it("cambia de idioma", () => {
    expect(correoDeRecuperacion(enlace, "en").asunto).toBe("Reset your BackupReader password");
    expect(correoDeRecuperacion(enlace, "es").asunto).toContain("Recupera tu contraseña");
    expect(correoDeRecuperacion(enlace, "en").html).toContain("encryption key");
  });

  it("dice qué hacer si no fuiste tú", () => {
    for (const idioma of ["es", "en"] as const) {
      const { texto } = correoDeRecuperacion(enlace, idioma);
      expect(texto.toLowerCase()).toMatch(/ignorar|ignore/);
    }
  });

  it("escapa el enlace al meterlo en el HTML", () => {
    /* El enlace viene de nuestro propio código, pero si algún día llegara
       con comillas, se saldría del atributo href. */
    const malicioso = 'https://backupreader.com/accion?x="><script>alert(1)</script>';
    const { html } = correoDeRecuperacion(malicioso, "es");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;");
  });

  it("manda también versión en texto, no solo HTML", () => {
    const { texto } = correoDeRecuperacion(enlace, "es");
    expect(texto.length).toBeGreaterThan(80);
    expect(texto).not.toContain("<");
  });
});
