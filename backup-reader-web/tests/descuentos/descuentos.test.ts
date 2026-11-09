import { describe, it, expect, beforeAll } from "vitest";

import i18n from "i18next";

import {
  aplicarCupon,
  avisoDeRestriccion,
  cantidadEnPalabras,
  claveDeDescripcion,
  descuentoEnPalabras,
  duracionEnPalabras,
  motivoDeRechazo,
  normalizarCodigo,
} from "../../lib/descuentos";

/**
 * Los códigos de descuento.
 *
 * Lo que importa de estos tests: que lo que la pantalla PROMETE coincida con
 * lo que Stripe va a COBRAR. Un resumen que dice 2,39 y un cargo de 2,99 es
 * una queja y una devolución; al revés, es dinero regalado. Así que casi todo
 * lo de aquí es aritmética de centavos y casos límite de redondeo.
 *
 * Lo segundo: que un código que Stripe va a rechazar se rechace ANTES, y con
 * un motivo en palabras. Decirle "código inválido" a alguien cuyo código
 * venció ayer no le sirve de nada.
 */

describe("aplicar un cupón", () => {
  it("un porcentaje redondea al centavo, como hace Stripe", () => {
    /* 2,99 con 20% = 0,598 de descuento. Sin redondear, el total saldría
       2,392 y la pantalla mostraría un importe que no existe como dinero. */
    const r = aplicarCupon(299, { percent_off: 20 });
    expect(r.ahorroCentavos).toBe(60);
    expect(r.totalCentavos).toBe(239);
    expect(r.gratisHoy).toBe(false);
  });

  it("un porcentaje con medio centavo redondea hacia arriba", () => {
    /* 2,99 al 50% = 1,495 de descuento.

       ESTE TEST FIJA NUESTRA ELECCIÓN, NO LA DE STRIPE. No he podido
       confirmar en su documentación hacia dónde redondea Stripe el medio
       centavo, y el caso se da con precios reales: 50% sobre 2,99 y sobre
       3,99 caen los dos en medio centavo. Si al probarlo en modo de prueba
       resulta que Stripe redondea al revés, lo que hay que cambiar es el
       redondeo de `aplicarCupon` y estos dos números. El test está aquí para
       que ese cambio sea de una línea y no una cacería. */
    const r = aplicarCupon(299, { percent_off: 50 });
    expect(r.ahorroCentavos).toBe(150);
    expect(r.totalCentavos).toBe(149);

    const s = aplicarCupon(399, { percent_off: 50 });
    expect(s.ahorroCentavos).toBe(200);
    expect(s.totalCentavos).toBe(199);
  });

  it("un porcentaje con decimales no rompe la cuenta", () => {
    const r = aplicarCupon(399, { percent_off: 33.33 });
    expect(r.ahorroCentavos).toBe(133);
    expect(r.totalCentavos).toBe(266);
    expect(r.ahorroCentavos + r.totalCentavos).toBe(399);
  });

  it("un importe fijo se resta tal cual", () => {
    const r = aplicarCupon(399, { amount_off: 100, currency: "usd" });
    expect(r.ahorroCentavos).toBe(100);
    expect(r.totalCentavos).toBe(299);
  });

  it("el 100% deja el total en cero y lo marca como gratis", () => {
    /* El caso que necesita camino aparte: Stripe no genera cobro y la
       pantalla no debe hablar de un cargo que no existió. */
    const r = aplicarCupon(299, { percent_off: 100 });
    expect(r.totalCentavos).toBe(0);
    expect(r.ahorroCentavos).toBe(299);
    expect(r.gratisHoy).toBe(true);
  });

  it("un importe fijo mayor que el precio no deja el total en negativo", () => {
    /* Stripe no devuelve dinero por un cupón demasiado grande, y un total
       negativo en pantalla sería absurdo. */
    const r = aplicarCupon(299, { amount_off: 1000, currency: "usd" });
    expect(r.totalCentavos).toBe(0);
    expect(r.ahorroCentavos).toBe(299);
    expect(r.gratisHoy).toBe(true);
  });

  it("un importe fijo exactamente igual al precio deja cero", () => {
    const r = aplicarCupon(299, { amount_off: 299, currency: "usd" });
    expect(r.totalCentavos).toBe(0);
    expect(r.gratisHoy).toBe(true);
  });

  it("un cupón sin descuento no cambia nada", () => {
    const r = aplicarCupon(299, {});
    expect(r.totalCentavos).toBe(299);
    expect(r.ahorroCentavos).toBe(0);
    expect(r.gratisHoy).toBe(false);
  });

  it("el porcentaje manda si vinieran los dos", () => {
    /* Stripe no permite un cupón con porcentaje e importe a la vez, pero si
       llegara uno así hay que elegir de forma determinista en vez de sumar
       los dos descuentos. */
    const r = aplicarCupon(1000, { percent_off: 10, amount_off: 900 });
    expect(r.ahorroCentavos).toBe(100);
    expect(r.totalCentavos).toBe(900);
  });

  it("un precio de cero no se vuelve gratis ni negativo", () => {
    const r = aplicarCupon(0, { percent_off: 50 });
    expect(r.totalCentavos).toBe(0);
    expect(r.ahorroCentavos).toBe(0);
    /* No es "gratis hoy" por un descuento: ya era cero. */
    expect(r.gratisHoy).toBe(false);
  });

  it("lo descontado más lo pagado siempre es el precio", () => {
    /* La propiedad que de verdad tiene que cumplirse. Si alguna combinación
       la rompe, el resumen no cuadra. */
    for (const precio of [99, 100, 299, 399, 999, 1000, 1234, 9999]) {
      for (const pct of [1, 7, 10, 20, 33.33, 50, 66.67, 99, 100]) {
        const r = aplicarCupon(precio, { percent_off: pct });
        expect(r.ahorroCentavos + r.totalCentavos).toBe(precio);
        expect(r.totalCentavos).toBeGreaterThanOrEqual(0);
        expect(r.ahorroCentavos).toBeLessThanOrEqual(precio);
      }
    }
  });
});

describe("cuánto dura el descuento, en palabras", () => {
  it("lo dice para cada duración de Stripe", () => {
    expect(duracionEnPalabras({ duration: "forever" })).toContain("mientras");
    expect(duracionEnPalabras({ duration: "once" })).toContain("primer mes");
    expect(
      duracionEnPalabras({ duration: "repeating", duration_in_months: 3 })
    ).toContain("3 meses");
  });

  it("un repeating de un mes no dice 'durante los primeros 1 meses'", () => {
    expect(duracionEnPalabras({ duration: "repeating", duration_in_months: 1 })).toBe(
      "solo en el primer mes"
    );
  });

  it("un repeating sin meses no inventa una duración", () => {
    expect(duracionEnPalabras({ duration: "repeating" })).toBe("");
  });

  it("el texto del descuento incluye cuánto y por cuánto tiempo", () => {
    const texto = descuentoEnPalabras(
      { percent_off: 20, duration: "repeating", duration_in_months: 3 },
      "usd"
    );
    expect(texto).toContain("20%");
    expect(texto).toContain("3 meses");
  });

  it("un porcentaje entero no sale con decimales de adorno", () => {
    expect(descuentoEnPalabras({ percent_off: 20, duration: "once" }, "usd")).toContain(
      "20%"
    );
    expect(
      descuentoEnPalabras({ percent_off: 20, duration: "once" }, "usd")
    ).not.toContain("20.00%");
  });

  it("un importe fijo sale con su moneda", () => {
    const texto = descuentoEnPalabras(
      { amount_off: 150, currency: "usd", duration: "once" },
      "usd"
    );
    expect(texto).toContain("1.50 USD");
  });

  it("un cupón sin descuento cae en su nombre", () => {
    expect(descuentoEnPalabras({ name: "Promo lanzamiento" }, "usd")).toBe(
      "Promo lanzamiento"
    );
  });
});

describe("motivos para rechazar un código", () => {
  const bueno = {
    code: "VERANO",
    active: true,
    coupon: { percent_off: 20, valid: true, duration: "once" },
  };

  it("un código bueno no se rechaza", () => {
    expect(motivoDeRechazo(bueno, 299, "usd")).toBeNull();
  });

  it("uno desactivado se rechaza", () => {
    expect(motivoDeRechazo({ ...bueno, active: false }, 299, "usd")).toMatch(/activo/i);
  });

  it("un cupón ya no válido se rechaza", () => {
    expect(
      motivoDeRechazo({ ...bueno, coupon: { percent_off: 20, valid: false } }, 299, "usd")
    ).toMatch(/válido/i);
  });

  it("uno vencido se rechaza, y uno que vence mañana no", () => {
    const ahora = 1_700_000_000_000;
    const ayer = Math.floor((ahora - 86_400_000) / 1000);
    const manana = Math.floor((ahora + 86_400_000) / 1000);

    expect(motivoDeRechazo({ ...bueno, expires_at: ayer }, 299, "usd", ahora)).toMatch(
      /venció/i
    );
    expect(
      motivoDeRechazo({ ...bueno, expires_at: manana }, 299, "usd", ahora)
    ).toBeNull();
  });

  it("uno agotado se rechaza, y uno con un uso de margen no", () => {
    expect(
      motivoDeRechazo({ ...bueno, max_redemptions: 10, times_redeemed: 10 }, 299, "usd")
    ).toMatch(/máximo/i);
    expect(
      motivoDeRechazo({ ...bueno, max_redemptions: 10, times_redeemed: 9 }, 299, "usd")
    ).toBeNull();
  });

  it("respeta el importe mínimo, y el límite exacto sí pasa", () => {
    const conMinimo = {
      ...bueno,
      restrictions: { minimum_amount: 500, minimum_amount_currency: "usd" },
    };
    expect(motivoDeRechazo(conMinimo, 299, "usd")).toMatch(/mínimo/i);
    expect(motivoDeRechazo(conMinimo, 500, "usd")).toBeNull();
  });

  it("el mínimo en otra moneda no se compara como si fuera la misma", () => {
    /* Comparar 500 ARS con 299 USD como si fueran el mismo número daría un
       rechazo o un pase falso. */
    const otraMoneda = {
      ...bueno,
      restrictions: { minimum_amount: 500, minimum_amount_currency: "ars" },
    };
    expect(motivoDeRechazo(otraMoneda, 299, "usd")).toMatch(/moneda/i);
  });

  it("un importe fijo en otra moneda se rechaza", () => {
    /* Restar 500 ARS a 299 USD no significa nada, y Stripe lo rechaza. */
    const enPesos = {
      ...bueno,
      coupon: { amount_off: 500, currency: "ars", valid: true },
    };
    expect(motivoDeRechazo(enPesos, 299, "usd")).toMatch(/moneda/i);
  });

  it("un importe fijo en la misma moneda pasa", () => {
    const enDolares = {
      ...bueno,
      coupon: { amount_off: 100, currency: "usd", valid: true },
    };
    expect(motivoDeRechazo(enDolares, 299, "usd")).toBeNull();
  });

  it("la moneda se compara sin importar mayúsculas", () => {
    const enDolares = {
      ...bueno,
      coupon: { amount_off: 100, currency: "USD", valid: true },
    };
    expect(motivoDeRechazo(enDolares, 299, "usd")).toBeNull();
  });

  it("un cupón que no descuenta nada se rechaza", () => {
    /* Aceptarlo enseñaría "descuento aplicado" sin bajar el total ni un
       centavo. */
    expect(
      motivoDeRechazo({ ...bueno, coupon: { valid: true } }, 299, "usd")
    ).toMatch(/no aplica/i);
  });

  it("sin cupón asociado se rechaza", () => {
    expect(motivoDeRechazo({ code: "X", active: true }, 299, "usd")).toMatch(
      /descuento/i
    );
  });

  it("sin código se rechaza", () => {
    expect(motivoDeRechazo({}, 299, "usd")).toBeTruthy();
  });
});

describe("el aviso de primera compra", () => {
  it("avisa cuando el código es solo para la primera compra", () => {
    /* `first_time_transaction` no se puede comprobar sin un cliente de
       Stripe, y en el checkout todavía no existe. Mejor avisar que dejar que
       la sorpresa llegue en el recibo. */
    const aviso = avisoDeRestriccion({
      code: "NUEVOS",
      restrictions: { first_time_transaction: true },
    });
    expect(aviso).toMatch(/primera compra/i);
  });

  it("no avisa cuando no hay esa restricción", () => {
    expect(avisoDeRestriccion({ code: "X" })).toBeNull();
    expect(
      avisoDeRestriccion({ code: "X", restrictions: { first_time_transaction: false } })
    ).toBeNull();
  });
});

describe("normalizar lo que escribió el usuario", () => {
  it("pasa a mayúsculas y quita espacios", () => {
    /* El filtro `code` de la API de Stripe distingue mayúsculas aunque el
       canje no. Sin esto, escribir "verano24" no encontraría "VERANO24" y el
       usuario vería "ese código no existe" teniendo uno bueno. */
    expect(normalizarCodigo("  verano24 ")).toBe("VERANO24");
    expect(normalizarCodigo("VeRaNo24")).toBe("VERANO24");
  });

  it("una cadena de solo espacios queda vacía", () => {
    expect(normalizarCodigo("   ")).toBe("");
  });
});

describe("la descripción del descuento, en los dos idiomas", () => {
  /**
   * El servidor NO manda la frase montada, manda la clave y la cifra. En
   * inglés el orden cambia —"20% off, first month only"— así que pegar trozos
   * traducidos no sirve: hace falta una frase entera por caso.
   *
   * Y el proyecto solo tiene tabla `en`: el español sale de la propia clave.
   * Eso depende de que i18next interpole también las claves que no encuentra.
   * Si no lo hiciera, un usuario en español vería "{{cantidad}}" literal en
   * el resumen, justo antes de pagar. Por eso se comprueba aquí y no se
   * supone.
   */
  const TABLA = {
    "{{cantidad}} de descuento, mientras tengas la suscripción":
      "{{cantidad}} off, for as long as you stay subscribed",
    "{{cantidad}} de descuento, solo en el primer mes":
      "{{cantidad}} off, first month only",
    "{{cantidad}} de descuento, durante los primeros {{meses}} meses":
      "{{cantidad}} off for the first {{meses}} months",
    "{{cantidad}} de descuento": "{{cantidad}} off",
  };

  beforeAll(async () => {
    await i18n.init({
      lng: "es",
      fallbackLng: "es",
      interpolation: { escapeValue: false },
      resources: { en: { translation: TABLA } },
    });
  });

  const frase = (cupon: any, moneda = "usd") =>
    i18n.t(claveDeDescripcion(cupon), {
      cantidad: cantidadEnPalabras(cupon, moneda),
      meses: cupon.duration_in_months ?? 0,
    } as any);

  it("en español sale la frase completa, sin llaves sueltas", async () => {
    await i18n.changeLanguage("es");

    expect(frase({ percent_off: 20, duration: "once" })).toBe(
      "20% de descuento, solo en el primer mes"
    );
    expect(frase({ percent_off: 20, duration: "repeating", duration_in_months: 3 })).toBe(
      "20% de descuento, durante los primeros 3 meses"
    );
    expect(frase({ amount_off: 150, currency: "usd", duration: "forever" })).toBe(
      "1.50 USD de descuento, mientras tengas la suscripción"
    );
  });

  it("en inglés sale traducida, con el orden propio del idioma", async () => {
    await i18n.changeLanguage("en");

    expect(frase({ percent_off: 20, duration: "once" })).toBe(
      "20% off, first month only"
    );
    expect(frase({ percent_off: 20, duration: "repeating", duration_in_months: 3 })).toBe(
      "20% off for the first 3 months"
    );
    expect(frase({ amount_off: 150, currency: "usd", duration: "forever" })).toBe(
      "1.50 USD off, for as long as you stay subscribed"
    );
  });

  it("nunca queda una llave de interpolación a la vista", async () => {
    for (const lng of ["es", "en"]) {
      await i18n.changeLanguage(lng);
      for (const cupon of [
        { percent_off: 20, duration: "once" },
        { percent_off: 50, duration: "forever" },
        { amount_off: 100, currency: "usd", duration: "repeating", duration_in_months: 6 },
        { percent_off: 10, duration: "repeating", duration_in_months: 1 },
        { percent_off: 10 },
      ]) {
        const t = frase(cupon);
        expect(t).not.toContain("{{");
        expect(t).not.toContain("}}");
        expect(t.length).toBeGreaterThan(3);
      }
    }
  });

  it("un repeating de un mes usa la frase de un solo mes", () => {
    expect(claveDeDescripcion({ duration: "repeating", duration_in_months: 1 })).toBe(
      "{{cantidad}} de descuento, solo en el primer mes"
    );
  });

  it("la cantidad son cifras y no se traduce", () => {
    expect(cantidadEnPalabras({ percent_off: 20 }, "usd")).toBe("20%");
    expect(cantidadEnPalabras({ percent_off: 33.33 }, "usd")).toBe("33.33%");
    expect(cantidadEnPalabras({ amount_off: 150, currency: "usd" }, "usd")).toBe("1.50 USD");
    expect(cantidadEnPalabras({}, "usd")).toBe("");
  });

  it("toda clave que genera el servidor existe en la tabla de inglés", () => {
    /* Si alguien añade una duración nueva y olvida traducirla, el usuario en
       inglés vería la frase en español. Mejor que falle aquí. */
    const duraciones: any[] = [
      { duration: "once" },
      { duration: "forever" },
      { duration: "repeating", duration_in_months: 1 },
      { duration: "repeating", duration_in_months: 5 },
      { duration: "repeating" },
      {},
    ];
    for (const d of duraciones) {
      expect(Object.keys(TABLA)).toContain(claveDeDescripcion(d));
    }
  });
});
