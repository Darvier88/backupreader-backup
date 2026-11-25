import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regla de acceso con suscripciones canceladas.
 *
 * Se prueba aquí y no a mano porque los dos fallos posibles son caros y
 * silenciosos: dejar entrar para siempre a quien canceló (no hay webhook de
 * Stripe que limpie `user.plan`), o cortarle el acceso el mismo día a quien ya
 * pagó el mes.
 *
 * `config/trial` lee la variable de entorno al importarse, así que cada caso
 * resetea los módulos y vuelve a importar.
 */

const DIA = 24 * 60 * 60 * 1000;

async function cargar(pruebaActiva: boolean) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED = pruebaActiva ? "true" : "false";
  return await import("../../config/acceso");
}

describe("tieneAcceso", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("deja entrar con plan y sin cancelación", async () => {
    const { tieneAcceso } = await cargar(false);
    expect(tieneAcceso({ plan: "plan_x" }, 999)).toBe(true);
  });

  it("deja entrar con el plan cancelado pero aún vigente", async () => {
    const { tieneAcceso } = await cargar(false);
    const dentroDeUnaSemana = Date.now() + 7 * DIA;
    expect(tieneAcceso({ plan: "plan_x", planCancelAt: dentroDeUnaSemana }, 999)).toBe(true);
  });

  it("NO deja entrar con el plan cancelado y vencido", async () => {
    const { tieneAcceso } = await cargar(false);
    const ayer = Date.now() - DIA;
    expect(tieneAcceso({ plan: "plan_x", planCancelAt: ayer }, 999)).toBe(false);
  });

  it("no deja entrar sin plan cuando la prueba está apagada", async () => {
    const { tieneAcceso } = await cargar(false);
    expect(tieneAcceso({ plan: null }, 0)).toBe(false);
    expect(tieneAcceso(null, 0)).toBe(false);
  });

  it("deja entrar sin plan si la prueba está encendida y no ha caducado", async () => {
    const { tieneAcceso } = await cargar(true);
    expect(tieneAcceso({ plan: null }, 3)).toBe(true);
    expect(tieneAcceso({ plan: null }, 99)).toBe(false);
  });

  it("con el plan vencido todavía vale la prueba, si está encendida", async () => {
    const { tieneAcceso } = await cargar(true);
    const ayer = Date.now() - DIA;
    expect(tieneAcceso({ plan: "plan_x", planCancelAt: ayer }, 2)).toBe(true);
  });

  it("planCancelAt a null no cancela nada", async () => {
    const { tieneAcceso } = await cargar(false);
    expect(tieneAcceso({ plan: "plan_x", planCancelAt: null }, 999)).toBe(true);
  });
});

describe("planCancelado", () => {
  it("solo es cierto mientras la fecha no haya pasado", async () => {
    const { planCancelado } = await cargar(false);
    expect(planCancelado({ plan: "p", planCancelAt: Date.now() + DIA })).toBe(true);
    expect(planCancelado({ plan: "p", planCancelAt: Date.now() - DIA })).toBe(false);
    expect(planCancelado({ plan: "p" })).toBe(false);
    expect(planCancelado(null)).toBe(false);
  });
});

describe("la bandera de la prueba gratuita", () => {
  /* Lo que se vigila aquí no es el valor, es el DEFECTO. Antes la condición
     era `!== "false"`, así que olvidarse de poner la variable regalaba 15 días
     de producto sin avisar de nada. */
  async function cargarCon(valor: string | undefined) {
    vi.resetModules();
    if (valor === undefined) delete process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED;
    else process.env.NEXT_PUBLIC_FREE_TRIAL_ENABLED = valor;
    return await import("../../config/trial");
  }

  it("está APAGADA si la variable no existe", async () => {
    expect((await cargarCon(undefined)).FREE_TRIAL_ENABLED).toBe(false);
  });

  it("está apagada con cualquier valor que no sea encenderla", async () => {
    for (const v of ["", "false", "no", "0", "si", "sí", "yes"]) {
      expect((await cargarCon(v)).FREE_TRIAL_ENABLED, v).toBe(false);
    }
  });

  it("se enciende con true o con 1, y no distingue mayúsculas ni espacios", async () => {
    for (const v of ["true", "1", "TRUE", " true "]) {
      expect((await cargarCon(v)).FREE_TRIAL_ENABLED, v).toBe(true);
    }
  });

  it("apagada, nadie entra por prueba aunque acabe de registrarse", async () => {
    const { isWithinTrial } = await cargarCon(undefined);
    expect(isWithinTrial(0)).toBe(false);
  });

  it("encendida, se entra mientras dure y no después", async () => {
    const { isWithinTrial } = await cargarCon("true");
    expect(isWithinTrial(0)).toBe(true);
    /* El día 15 todavía cuenta: la condición es `< FREE_TRIAL_DAYS + 1`, así
       que la ventana real son 16 días contando el de alta. Se deja como
       estaba; aquí solo se fija para que nadie la mueva sin querer. */
    expect(isWithinTrial(15)).toBe(true);
    expect(isWithinTrial(16)).toBe(false);
    /* Una fecha futura no debería dar acceso. */
    expect(isWithinTrial(-1)).toBe(false);
  });
});
