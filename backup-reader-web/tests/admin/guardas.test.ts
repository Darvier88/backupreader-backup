import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { confirmacionValida, esSuperAdmin } from "../../lib/admin-permisos";

/**
 * Los guardas del panel de administración.
 *
 * Son cuatro líneas de código y es donde un error cuesta más caro: el panel
 * borra cuentas de forma irreversible. Lo que se comprueba aquí no es que
 * funcione el camino bueno, sino que los caminos malos cierren:
 *
 *  - Olvidarse de configurar la variable de entorno NO debe abrir el panel.
 *  - Un correo parecido NO debe pasar.
 *  - Una confirmación que no corresponde al usuario NO debe valer.
 */

const ORIGINAL = {
  uids: process.env.SUPER_ADMIN_UIDS,
  correos: process.env.SUPER_ADMIN_EMAILS,
};

beforeEach(() => {
  delete process.env.SUPER_ADMIN_UIDS;
  delete process.env.SUPER_ADMIN_EMAILS;
});

afterEach(() => {
  /* Se restauran para no contaminar otros tests del mismo proceso. */
  if (ORIGINAL.uids === undefined) delete process.env.SUPER_ADMIN_UIDS;
  else process.env.SUPER_ADMIN_UIDS = ORIGINAL.uids;
  if (ORIGINAL.correos === undefined) delete process.env.SUPER_ADMIN_EMAILS;
  else process.env.SUPER_ADMIN_EMAILS = ORIGINAL.correos;
});

describe("quién es super admin", () => {
  it("sin nada configurado, NADIE lo es", () => {
    /* El caso que importa de verdad. Con la condición escrita al revés
       —"lista vacía, pasan todos"— olvidarse de poner la variable en Vercel
       dejaría el borrado de cuentas abierto a cualquier usuario registrado. */
    expect(esSuperAdmin("uid-cualquiera", "alguien@ejemplo.com")).toBe(false);
    expect(esSuperAdmin("", "")).toBe(false);
  });

  it("una lista de solo comas o espacios cuenta como vacía", () => {
    process.env.SUPER_ADMIN_UIDS = " , ,, ";
    expect(esSuperAdmin("uid-ana", "ana@ejemplo.com")).toBe(false);
  });

  it("reconoce por uid", () => {
    process.env.SUPER_ADMIN_UIDS = "uid-ana, uid-beto";
    expect(esSuperAdmin("uid-beto", "beto@ejemplo.com")).toBe(true);
    expect(esSuperAdmin("uid-carla", "carla@ejemplo.com")).toBe(false);
  });

  it("reconoce por correo sin importar mayúsculas ni espacios", () => {
    process.env.SUPER_ADMIN_EMAILS = " Ana@Ejemplo.com ";
    expect(esSuperAdmin("uid-ana", "ana@ejemplo.com")).toBe(true);
    expect(esSuperAdmin("uid-ana", "ANA@EJEMPLO.COM")).toBe(true);
  });

  it("un correo parecido no pasa", () => {
    process.env.SUPER_ADMIN_EMAILS = "ana@ejemplo.com";
    expect(esSuperAdmin("uid-x", "ana@ejemplo.co")).toBe(false);
    expect(esSuperAdmin("uid-x", "ana@ejemplo.com.attacker.net")).toBe(false);
    expect(esSuperAdmin("uid-x", "xana@ejemplo.com")).toBe(false);
  });

  it("una cuenta sin correo no se cuela por la lista de correos", () => {
    process.env.SUPER_ADMIN_EMAILS = "ana@ejemplo.com";
    expect(esSuperAdmin("uid-x", "")).toBe(false);
  });
});

describe("la confirmación de un borrado", () => {
  it("pide el correo del usuario", () => {
    const r = confirmacionValida("ana@ejemplo.com", "ana@ejemplo.com", "uid-ana");
    expect(r.vale).toBe(true);
    expect(r.esperado).toBe("ana@ejemplo.com");
  });

  it("tolera mayúsculas y espacios de los lados", () => {
    expect(
      confirmacionValida("  ANA@Ejemplo.com ", "ana@ejemplo.com", "uid-ana").vale
    ).toBe(true);
  });

  it("no vale el correo de otro, ni uno parecido, ni vacío", () => {
    expect(confirmacionValida("beto@ejemplo.com", "ana@ejemplo.com", "uid-ana").vale).toBe(false);
    expect(confirmacionValida("ana@ejemplo.co", "ana@ejemplo.com", "uid-ana").vale).toBe(false);
    expect(confirmacionValida("", "ana@ejemplo.com", "uid-ana").vale).toBe(false);
    expect(confirmacionValida("   ", "ana@ejemplo.com", "uid-ana").vale).toBe(false);
  });

  it("no vale el uid cuando la cuenta SÍ tiene correo", () => {
    /* Si valieran los dos, el admin podría confirmar con el uid que ya tiene
       copiado de otra fila sin mirar de quién es el correo. */
    expect(confirmacionValida("uid-ana", "ana@ejemplo.com", "uid-ana").vale).toBe(false);
  });

  it("si la cuenta no tiene correo, se pide el uid", () => {
    const r = confirmacionValida("uid-ana", "", "uid-ana");
    expect(r.vale).toBe(true);
    expect(r.esperado).toBe("uid-ana");
  });

  it("una cuenta sin correo ni uid no se puede confirmar con cadena vacía", () => {
    expect(confirmacionValida("", "", "").vale).toBe(false);
  });

  it("no vale nada que no sea texto", () => {
    expect(confirmacionValida(true, "ana@ejemplo.com", "uid-ana").vale).toBe(false);
    expect(confirmacionValida(undefined, "ana@ejemplo.com", "uid-ana").vale).toBe(false);
    expect(confirmacionValida({ toString: () => "ana@ejemplo.com" }, "ana@ejemplo.com", "uid-ana").vale).toBe(false);
  });
});
