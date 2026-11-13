import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Los dos endpoints, ejecutados de verdad.
 *
 * El otro fichero prueba la aritmética. Este llama a los handlers reales
 * —`/api/discounts/validate` y `/api/subscriptions/create`— con un Stripe
 * falso delante, y comprueba lo que de verdad cuesta dinero si se equivoca:
 *
 *  - que el descuento llegue a Stripe en la llamada que crea la suscripción,
 *    y no solo se pinte en pantalla;
 *  - que un código malo ABORTE el cobro en vez de cobrar el precio entero a
 *    quien acaba de ver un total con descuento;
 *  - que el importe se lea de Stripe y no del navegador;
 *  - que un 100% se marque como "hoy no se cobra" y aun así guarde la tarjeta.
 *
 * El doble es de Stripe, no de nuestra lógica: el código que corre aquí es el
 * de los endpoints, línea por línea.
 */

/* `vi.mock` se eleva por encima de los imports, así que el estado compartido
   tiene que crearse con `vi.hoisted` o el factory no lo vería. */
const h = vi.hoisted(() => {
  /* Los handlers leen la clave al cargarse y responden 500 sin ella. Se pone
     aquí, en el bloque elevado, porque esto corre antes de cualquier
     `import()` de un handler; en un `beforeEach` llegaría tarde y los tests
     medirían el guard de configuración en vez del comportamiento. */
  process.env.STRIPE_SECRET_KEY = "sk_test_de_mentira";

  return {
  precios: {} as Record<string, any>,
  promos: {} as Record<string, any>,
  /* Lo que se le pidió a Stripe, para poder afirmar sobre ello. */
  llamadas: {
    subsCreate: [] as any[],
    attach: [] as any[],
    pricesRetrieve: [] as string[],
    promoList: [] as any[],
    customersCreate: [] as any[],
    intentsCreate: [] as any[],
  },
  /* Lo que `subscriptions.create` va a devolver. */
  facturaDevuelta: { amount_due: 299, currency: "usd" } as any,
  /* Para simular que Stripe rechaza el cupón por su cuenta. */
  errorAlCrear: null as any,
  };
});

vi.mock("stripe", () => {
  class StripeFalso {
    prices = {
      retrieve: async (id: string) => {
        h.llamadas.pricesRetrieve.push(id);
        const p = h.precios[id];
        if (!p) {
          const e: any = new Error("No such price");
          e.code = "resource_missing";
          throw e;
        }
        return p;
      },
    };
    promotionCodes = {
      list: async (params: any) => {
        h.llamadas.promoList.push(params);
        const encontrado = h.promos[params.code];
        /* Se respeta el filtro `active: true` de la llamada real: un código
           desactivado no lo devuelve Stripe. */
        if (!encontrado) return { data: [] };
        if (params.active === true && encontrado.active === false) return { data: [] };
        return { data: [encontrado] };
      },
    };
    paymentMethods = {
      attach: async (pm: string, opts: any) => {
        h.llamadas.attach.push({ pm, opts });
        return {};
      },
    };
    customers = {
      create: async (params: any) => {
        h.llamadas.customersCreate.push(params);
        return { id: "cus_nuevo" };
      },
    };
    paymentIntents = {
      create: async (params: any) => {
        h.llamadas.intentsCreate.push(params);
        return { id: "pi_1", client_secret: "pi_1_secret" };
      },
    };
    subscriptions = {
      create: async (params: any) => {
        h.llamadas.subsCreate.push(params);
        if (h.errorAlCrear) throw h.errorAlCrear;
        return { id: "sub_1", latest_invoice: h.facturaDevuelta };
      },
    };
  }
  return { default: StripeFalso };
});

/* --- req/res de mentira, con lo que usan los handlers --- */

function hacerRes() {
  const r: any = {
    codigo: 0,
    cuerpo: null as any,
    cabeceras: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      r.cabeceras[k] = v;
      return r;
    },
    status(c: number) {
      r.codigo = c;
      return r;
    },
    json(b: any) {
      r.cuerpo = b;
      return r;
    },
  };
  return r;
}

const PRECIO = "price_mensual";

beforeEach(() => {
  h.precios = { [PRECIO]: { unit_amount: 299, currency: "usd" } };
  h.promos = {
    VERANO: {
      id: "promo_verano",
      code: "VERANO",
      active: true,
      coupon: { percent_off: 20, valid: true, duration: "once" },
    },
    TODOGRATIS: {
      id: "promo_gratis",
      code: "TODOGRATIS",
      active: true,
      coupon: { percent_off: 100, valid: true, duration: "forever" },
    },
    VENCIDO: {
      id: "promo_vencido",
      code: "VENCIDO",
      active: true,
      expires_at: 1,
      coupon: { percent_off: 50, valid: true, duration: "once" },
    },
    APAGADO: {
      id: "promo_apagado",
      code: "APAGADO",
      active: false,
      coupon: { percent_off: 50, valid: true, duration: "once" },
    },
  };
  h.llamadas = { subsCreate: [], attach: [], pricesRetrieve: [], promoList: [], customersCreate: [], intentsCreate: [] };
  h.facturaDevuelta = { amount_due: 299, currency: "usd" };
  h.errorAlCrear = null;
});

async function validar(body: any) {
  const { default: handler } = await import("../../pages/api/discounts/validate");
  const res = hacerRes();
  await handler({ method: "POST", body } as any, res);
  return res;
}

async function crear(body: any) {
  const { default: handler } = await import("../../pages/api/subscriptions/create");
  const res = hacerRes();
  await handler({ method: "POST", body } as any, res);
  return res;
}

/* ================================================================== *
 *  Validar
 * ================================================================== */

describe("POST /api/discounts/validate", () => {
  it("un código bueno devuelve el total con descuento", async () => {
    const res = await validar({ code: "VERANO", priceId: PRECIO });

    expect(res.codigo).toBe(200);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.precioCentavos).toBe(299);
    expect(res.cuerpo.totalCentavos).toBe(239);
    expect(res.cuerpo.ahorroCentavos).toBe(60);
    expect(res.cuerpo.gratisHoy).toBe(false);
    expect(res.cuerpo.descripcion).toContain("20%");
  });

  it("el importe se lee de Stripe, no del navegador", async () => {
    /* Si se fiara de un precio enviado, el resumen podría mostrar un total
       que no es el que se va a cobrar. */
    await validar({ code: "VERANO", priceId: PRECIO, precioCentavos: 1 });
    expect(h.llamadas.pricesRetrieve).toEqual([PRECIO]);
  });

  it("lo que escribe el usuario se busca en mayúsculas", async () => {
    /* El filtro `code` de Stripe distingue mayúsculas aunque el canje no. */
    const res = await validar({ code: "  verano ", priceId: PRECIO });
    expect(res.cuerpo.ok).toBe(true);
    expect(h.llamadas.promoList[0].code).toBe("VERANO");
    /* Y se devuelve el código tal como lo guarda Stripe. */
    expect(res.cuerpo.codigo).toBe("VERANO");
  });

  it("un código del 100% se marca como gratis hoy", async () => {
    const res = await validar({ code: "TODOGRATIS", priceId: PRECIO });
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.totalCentavos).toBe(0);
    expect(res.cuerpo.gratisHoy).toBe(true);
  });

  it("un código vencido se rechaza con su motivo, no con un error", async () => {
    const res = await validar({ code: "VENCIDO", priceId: PRECIO });
    /* 200 y no 400: la petición estaba bien hecha, el código no sirve. Un 400
       haría que el navegador lo tratara como fallo de la aplicación en vez de
       enseñar el motivo. */
    expect(res.codigo).toBe(200);
    expect(res.cuerpo.ok).toBe(false);
    expect(res.cuerpo.motivo).toMatch(/venció/i);
  });

  it("un código desactivado no se encuentra", async () => {
    const res = await validar({ code: "APAGADO", priceId: PRECIO });
    expect(res.cuerpo.ok).toBe(false);
    expect(res.cuerpo.motivo).toMatch(/no existe|no está activo/i);
  });

  it("uno inexistente no revela si existió alguna vez", async () => {
    const res = await validar({ code: "NOEXISTE", priceId: PRECIO });
    expect(res.cuerpo.ok).toBe(false);
    /* Mismo mensaje que para el desactivado. */
    expect(res.cuerpo.motivo).toMatch(/no existe o ya no está activo/i);
  });

  it("sin código pide uno, sin precio es un fallo nuestro", async () => {
    const a = await validar({ code: "  ", priceId: PRECIO });
    expect(a.codigo).toBe(400);
    expect(a.cuerpo.motivo).toMatch(/escribe/i);

    const b = await validar({ code: "VERANO" });
    expect(b.codigo).toBe(400);
    expect(b.cuerpo.error).toBe("sin-precio");
  });

  it("un precio que no existe culpa a la aplicación, no al código", async () => {
    const res = await validar({ code: "VERANO", priceId: "price_fantasma" });
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toBe("precio-no-encontrado");
    /* Sin `motivo`: la pantalla no debe decirle al usuario que su código está
       mal cuando el problema es nuestro. */
    expect(res.cuerpo.motivo).toBeUndefined();
  });

  it("un GET no se atiende", async () => {
    const { default: handler } = await import("../../pages/api/discounts/validate");
    const res = hacerRes();
    await handler({ method: "GET", body: {} } as any, res);
    expect(res.codigo).toBe(405);
    expect(res.cabeceras["Allow"]).toBe("POST");
  });
});

/* ================================================================== *
 *  Crear la suscripción
 * ================================================================== */

describe("POST /api/subscriptions/create", () => {
  it("sin código, la llamada a Stripe queda igual que siempre", async () => {
    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
    });

    expect(res.cuerpo.success).toBe(true);
    expect(h.llamadas.subsCreate).toHaveLength(1);
    /* Sin descuento no se manda la clave: la llamada es la de antes. */
    expect(h.llamadas.subsCreate[0]).not.toHaveProperty("promotion_code");
    expect(res.cuerpo.conDescuento).toBe(false);
    /* Y no se consulta ningún código. */
    expect(h.llamadas.promoList).toHaveLength(0);
  });

  it("con código, el descuento llega a Stripe", async () => {
    /* Lo que de verdad importa: que el descuento no se quede en la pantalla.
       Si esta clave no llegara, el usuario vería 2,39 y pagaría 2,99. */
    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "VERANO",
    });

    expect(res.cuerpo.success).toBe(true);
    expect(h.llamadas.subsCreate[0].promotion_code).toBe("promo_verano");
    expect(res.cuerpo.conDescuento).toBe(true);
  });

  it("el código se resuelve aquí otra vez, no se confía en el navegador", async () => {
    await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "verano",
    });
    /* Se vuelve a consultar a Stripe por el texto, en mayúsculas. */
    expect(h.llamadas.promoList[0].code).toBe("VERANO");
    expect(h.llamadas.promoList[0].active).toBe(true);
  });

  it("si el código ya no vale, NO se cobra nada", async () => {
    /* El caso que protege el dinero del usuario: seguir sin el descuento
       sería cobrarle más de lo que aceptó en pantalla. */
    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "VENCIDO",
    });

    expect(res.cuerpo.success).toBe(false);
    expect(res.cuerpo.codigoRechazado).toBe(true);
    expect(res.cuerpo.motivo).toMatch(/venció/i);
    /* Ni suscripción ni tarjeta adjuntada. */
    expect(h.llamadas.subsCreate).toHaveLength(0);
    expect(h.llamadas.attach).toHaveLength(0);
  });

  it("un código inexistente tampoco cobra", async () => {
    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "INVENTADO",
    });
    expect(res.cuerpo.codigoRechazado).toBe(true);
    expect(h.llamadas.subsCreate).toHaveLength(0);
  });

  it("un código en blanco se trata como si no hubiera código", async () => {
    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "   ",
    });
    expect(res.cuerpo.success).toBe(true);
    expect(h.llamadas.subsCreate[0]).not.toHaveProperty("promotion_code");
  });

  it("con 100% de descuento dice que hoy no se cobra, y guarda la tarjeta", async () => {
    h.facturaDevuelta = { amount_due: 0, currency: "usd" };

    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "TODOGRATIS",
    });

    expect(res.cuerpo.success).toBe(true);
    expect(res.cuerpo.sinCobroHoy).toBe(true);
    expect(res.cuerpo.cobradoCentavos).toBe(0);
    /* La tarjeta se adjunta igual: cuando el descuento se acabe hay que poder
       cobrar la renovación. */
    expect(h.llamadas.attach).toHaveLength(1);
    expect(h.llamadas.subsCreate[0].default_payment_method).toBe("pm_1");
  });

  it("el importe cobrado sale de la factura de Stripe, no de nuestra cuenta", async () => {
    /* Si Stripe redondeara distinto que nosotros, esta es la cifra buena. */
    h.facturaDevuelta = { amount_due: 240, currency: "usd" };
    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "VERANO",
    });
    expect(res.cuerpo.cobradoCentavos).toBe(240);
    expect(res.cuerpo.moneda).toBe("usd");
  });

  it("si Stripe rechaza el cupón, el mensaje no culpa a la tarjeta", async () => {
    /* Nuestra comprobación puede dejar pasar algo que Stripe sí rechaza
       (`first_time_transaction`, por ejemplo). Decir "verifica los datos de
       tu tarjeta" mandaría al usuario a revisar algo que está perfecto. */
    const e: any = new Error("This promotion code cannot be redeemed.");
    e.param = "promotion_code";
    h.errorAlCrear = e;

    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "VERANO",
    });

    expect(res.codigo).toBe(200);
    expect(res.cuerpo.success).toBe(false);
    expect(res.cuerpo.codigoRechazado).toBe(true);
  });

  it("sin la clave de Stripe no se cobra nada", async () => {
    /* Esto salió solo al escribir estos tests: me faltaba la variable y los
       dos endpoints respondieron 500 sin tocar Stripe. Es el comportamiento
       correcto y vale la pena fijarlo: si en un despliegue falta la clave,
       lo que tiene que pasar es que nadie pueda pagar, no que se creen
       suscripciones contra una clave vacía. */
    const antes = process.env.STRIPE_SECRET_KEY;
    const antesPublica = process.env.NEXT_PUBLIC_STRIPE_KEYS;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_KEYS;
    vi.resetModules();

    try {
      const { default: handler } = await import("../../pages/api/subscriptions/create");
      const res = hacerRes();
      await handler(
        {
          method: "POST",
          body: { customerId: "cus_1", paymentMethodId: "pm_1", planId: PRECIO },
        } as any,
        res
      );

      expect(res.codigo).toBe(500);
      expect(res.cuerpo.success).toBe(false);
      expect(res.cuerpo.error).toBe("stripe-sin-configurar");
      expect(h.llamadas.subsCreate).toHaveLength(0);
      expect(h.llamadas.attach).toHaveLength(0);
    } finally {
      if (antes === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = antes;
      if (antesPublica === undefined) delete process.env.NEXT_PUBLIC_STRIPE_KEYS;
      else process.env.NEXT_PUBLIC_STRIPE_KEYS = antesPublica;
      vi.resetModules();
    }
  });

  it("ya no usa NEXT_PUBLIC_STRIPE_KEYS como respaldo de la clave secreta", async () => {
    /* Con solo la variable vieja puesta, el endpoint tiene que comportarse
       como si no hubiera clave. Si alguien vuelve a añadir el respaldo, la
       clave secreta volvería a depender de un nombre que acaba en el
       navegador en cuanto un componente lo menciona. */
    const antes = process.env.STRIPE_SECRET_KEY;
    const antesPublica = process.env.NEXT_PUBLIC_STRIPE_KEYS;
    delete process.env.STRIPE_SECRET_KEY;
    process.env.NEXT_PUBLIC_STRIPE_KEYS = "sk_test_vieja_no_debe_usarse";
    vi.resetModules();

    try {
      const { default: handler } = await import("../../pages/api/subscriptions/create");
      const res = hacerRes();
      await handler(
        {
          method: "POST",
          body: { customerId: "cus_1", paymentMethodId: "pm_1", planId: PRECIO },
        } as any,
        res
      );

      expect(res.codigo).toBe(500);
      expect(res.cuerpo.error).toBe("stripe-sin-configurar");
      expect(h.llamadas.subsCreate).toHaveLength(0);
    } finally {
      if (antes === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = antes;
      if (antesPublica === undefined) delete process.env.NEXT_PUBLIC_STRIPE_KEYS;
      else process.env.NEXT_PUBLIC_STRIPE_KEYS = antesPublica;
      vi.resetModules();
    }
  });

  it("un fallo de tarjeta sigue siendo un fallo de tarjeta", async () => {
    /* El complemento del anterior: un error que NO es del cupón no debe
       disfrazarse de código rechazado, o el usuario quitaría el código y
       seguiría sin poder pagar. */
    const e: any = new Error("Your card was declined.");
    e.code = "card_declined";
    h.errorAlCrear = e;

    const res = await crear({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      planId: PRECIO,
      discountCode: "VERANO",
    });

    expect(res.codigo).toBe(500);
    expect(res.cuerpo.success).toBe(false);
    expect(res.cuerpo.codigoRechazado).toBeUndefined();
  });

  it("customer/create y payment/intents no llaman a Stripe sin STRIPE_SECRET_KEY", async () => {
    /* Antes se construía Stripe con la cadena "undefined", se le llamaba
       igual y el error de Stripe llegaba entero al navegador. */
    const antes = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    try {
      const { default: crearCliente } = await import("../../pages/api/customer/create");
      const r1 = hacerRes();
      await crearCliente({ method: "POST", body: { name: "Ana", email: "a@b.com", uid: "u1" } } as any, r1);
      expect(r1.codigo).toBe(500);
      expect(r1.cuerpo.error).toBe("stripe-sin-configurar");

      const { default: intents } = await import("../../pages/api/payment/intents");
      const r2 = hacerRes();
      await intents({ method: "POST", body: JSON.stringify({ amount: 299, description: "x" }) } as any, r2);
      expect(r2.codigo).toBe(500);
      expect(r2.cuerpo.error).toBe("stripe-sin-configurar");

      expect(h.llamadas.customersCreate).toHaveLength(0);
      expect(h.llamadas.intentsCreate).toHaveLength(0);
    } finally {
      if (antes === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = antes;
      vi.resetModules();
    }
  });

  it("payment/intents devuelve un error limpio, sin el objeto de Stripe", async () => {
    const antes = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    vi.resetModules();
    try {
      const { default: intents } = await import("../../pages/api/payment/intents");
      const r = hacerRes();
      /* Cuerpo que no es JSON: JSON.parse lanza un error SIN statusCode, que
         antes acababa en res.status(undefined). */
      await intents({ method: "POST", body: "{no es json" } as any, r);
      expect(r.codigo).toBe(500);
      expect(r.cuerpo.ok).toBe(false);
      expect(Object.keys(r.cuerpo).sort()).toEqual(["error", "mensaje", "ok"]);
    } finally {
      if (antes === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = antes;
      vi.resetModules();
    }
  });
});
