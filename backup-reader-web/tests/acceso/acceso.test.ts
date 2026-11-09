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
